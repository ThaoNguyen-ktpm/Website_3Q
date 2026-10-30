import {mkdir,readFile,open,rename,unlink} from 'node:fs/promises';
import {dirname,join,basename} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {Store} from './store.js';
import {audit,applyPlan} from './store-cleanup.js';
import {withStoreLock} from './store-lock.js';

const collections=['products','archivedProducts','runs','updates','prepared'];
const hash=text=>createHash('sha256').update(text).digest('hex');
const validHash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
async function settle(workers){const results=await Promise.allSettled(workers);const failure=results.find(r=>r.status==='rejected');if(failure)throw failure.reason;}
// Objects reused with immutable:true must never be mutated after publication.
export class SplitStore {
  constructor(path,{fault,kind='state'}={}) {
    this.kind=kind;
    this.path=path;this.directory=join(dirname(path),basename(path,'.json')+'.store');
    this.manifestPath=join(this.directory,'manifest.json');this.blobs=join(this.directory,'blobs');
    this.objects=new WeakMap();this.known=new Set();this.fault=fault;
    this.stats={bytesWritten:0,filesWritten:0,serializedRuns:0};
  }
  async atomic(path,text) {
    const temp=path+'.'+randomUUID()+'.tmp';let handle;
    try{
      handle=await open(temp,'wx');await handle.writeFile(text,'utf8');await handle.sync();await handle.close();handle=null;
      await this.fault?.('beforeRename',path);await rename(temp,path);
      this.stats.bytesWritten+=Buffer.byteLength(text);this.stats.filesWritten++;
    }finally{await handle?.close();await unlink(temp).catch(e=>{if(e.code!=='ENOENT')throw e;});}
  }
  async put(value,{immutable=false,run=false}={}) {
    if(immutable&&value&&typeof value==='object'&&this.objects.has(value))return this.objects.get(value);
    const text=JSON.stringify(value);if(text===undefined)throw Error('Không thể lưu bản ghi JSON');
    if(run)this.stats.serializedRuns++;
    const digest=hash(text),path=join(this.blobs,digest+'.json');
    if(!this.known.has(digest)){
      let existing;
      try{existing=await readFile(path,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
      if(existing!==undefined){if(hash(existing)!==digest)throw Error('Hash bản ghi lưu trữ không khớp');}
      else {await this.fault?.('beforeBlob',path);await this.atomic(path,text);}
      this.known.add(digest);
    }
    if(value&&typeof value==='object')this.objects.set(value,digest);
    return digest;
  }
  async get(digest) {
    if(!validHash(digest))throw Error('Tham chiếu lưu trữ không hợp lệ');
    const text=await readFile(join(this.blobs,digest+'.json'),'utf8');
    if(hash(text)!==digest)throw Error('Hash bản ghi lưu trữ không khớp');
    const value=JSON.parse(text);this.known.add(digest);
    if(value&&typeof value==='object')this.objects.set(value,digest);
    return value;
  }
  async build(state,options={}) {
    const metadata={...state};const indexes={};
    for(const key of collections) {
      if(state[key]===undefined)continue;
      if(!Array.isArray(state[key]))throw Error('Danh sách lưu trữ không hợp lệ: '+key);
      delete metadata[key];const refs=new Array(state[key].length);
      // Bounded disk concurrency for first migration; every blob syncs before manifest.
      let cursor=0;
      await settle(Array.from({length:Math.min(8,refs.length)},async()=>{
        while(cursor<refs.length){const i=cursor++;refs[i]=await this.put(state[key][i],{...options,run:key==='runs'});}
      }));
      indexes[key]=await this.put(refs);
    }
    return {format:'baoq-split-v1',metadata,indexes};
  }
  async restore(manifest) {
    if(manifest?.format!=='baoq-split-v1'||!manifest.metadata||!manifest.indexes||(this.kind!=='sapo'&&manifest.metadata.version!==1))throw Error('Manifest không hợp lệ');
    const state={...manifest.metadata};
    for(const [key,digest] of Object.entries(manifest.indexes)){
      if(!collections.includes(key))throw Error('Chỉ mục lưu trữ không hợp lệ');
      const refs=await this.get(digest);if(!Array.isArray(refs))throw Error('Chỉ mục không phải danh sách');
      state[key]=new Array(refs.length);let cursor=0;
      await settle(Array.from({length:Math.min(8,refs.length)},async()=>{while(cursor<refs.length){const i=cursor++;state[key][i]=await this.get(refs[i]);}}));
    }
    if(!Array.isArray(state.products)||(this.kind!=='sapo'&&!Array.isArray(state.runs)))throw Error('Thiếu hồ sơ hoặc lịch sử');
    return state;
  }
  async read() {
    const state=await withStoreLock(this.directory,()=>this.readUnlocked());
    this.runIds=new Set((state?.runs||[]).map(run=>run.id));
    return state;
  }
  async readUnlocked() {
    let text;
    try{text=await readFile(this.manifestPath,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
    if(text!==undefined){const state=await this.restore(JSON.parse(text));this.lastManifest=text;await this.activate();return state;}
    // Never treat an existing unreadable/corrupt manifest as a missing manifest.
    try{await readFile(join(this.directory,'activated'));throw Error('Thiếu manifest của kho đã chuyển đổi; không dùng lại JSON cũ');}catch(e){if(e.code!=='ENOENT')throw e;}
    const state=await new Store(this.path).read();if(!state)return null;
    await mkdir(this.blobs,{recursive:true});
    const manifest=await this.build(state),restored=await this.restore(manifest);
    if(!isDeepStrictEqual(restored,state))throw Error('Chuyển đổi không khớp dữ liệu gốc');
    await this.fault?.('beforeManifest',this.manifestPath);
    const next=JSON.stringify(manifest);await this.atomic(this.manifestPath,next);this.lastManifest=next;await this.activate();
    return restored;
  }
  async write(state,options={}) {
    const previous=this.runIds||new Set();
    await withStoreLock(this.directory,()=>this.writeUnlocked(state,options));
    this.runIds=new Set((state.runs||[]).map(run=>run.id));
    if(this.cleanupPending||[...previous].some(id=>!this.runIds.has(id))) {
      const root=dirname(this.directory);
      try {
        await applyPlan(root,await audit(root,[basename(this.directory)]));
        this.cleanupPending=false;
      } catch {
        // The manifest is already committed: maintenance must not turn a saved update into a failed write.
        this.cleanupPending=true;
        console.warn('Sale AI: chưa dọn được blob; sẽ thử lại sau lần lưu tiếp theo.');
      } finally {
        // GC may have removed some blobs before failing; invalidate both caches.
        this.known.clear();this.objects=new WeakMap();
      }
    }
  }
  async writeUnlocked(state,options={}) {
    await mkdir(this.blobs,{recursive:true});
    const text=JSON.stringify(await this.build(state,options));
    if(text===this.lastManifest)return;
    await this.fault?.('beforeManifest',this.manifestPath);
    await this.atomic(this.manifestPath,text);this.lastManifest=text;await this.activate();
  }
  async activate() {
    if(this.activationKnown)return;
    const path=join(this.directory,'activated');
    try{await readFile(path);}catch(e){if(e.code!=='ENOENT')throw e;await this.atomic(path,'baoq-split-v1\n');}
    this.activationKnown=true;
  }
}
