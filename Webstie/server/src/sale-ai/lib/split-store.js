import {mkdir,readFile,open,rename,unlink} from 'node:fs/promises';
import {dirname,join,basename} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {gzipSync,gunzipSync} from 'node:zlib';
import {Store} from './store.js';
import {cleanupLocked} from './store-cleanup.js';
import {withStoreLock} from './store-lock.js';
import {compactJournal,journalItem,chunkedJournal,journalChildren} from './journal-storage.js';

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
    this.objects=new WeakMap();this.known=new Set();this.pendingBlobs=new Map();this.fault=fault;
    this.stats={bytesWritten:0,filesWritten:0,serializedRuns:0,cleanupMs:0};
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
    let text=JSON.stringify(value);if(text===undefined)throw Error('Không thể lưu bản ghi JSON');
    if(run)this.stats.serializedRuns++;
    // Tables repeat long descriptions; compress only run blobs, leaving BossTele's products intact.
    if(run&&Buffer.byteLength(text)>65536)text=JSON.stringify({format:'baoq-gzip-run-v1',data:gzipSync(text).toString('base64')});
    const digest=hash(text),path=join(this.blobs,digest+'.json');
    if(!this.known.has(digest)){
      let writing=this.pendingBlobs.get(digest);
      if(!writing){
       writing=(async()=>{
        let existing;
        try{existing=await readFile(path,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
        if(existing!==undefined){if(hash(existing)!==digest)throw Error('Hash bản ghi lưu trữ không khớp');}
        else {await this.fault?.('beforeBlob',path);await this.atomic(path,text);}
        this.known.add(digest);
       })();
       this.pendingBlobs.set(digest,writing);
      }
      try{await writing;}finally{if(this.pendingBlobs.get(digest)===writing)this.pendingBlobs.delete(digest);}
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
  async chunks(items){
    const refs=new Array(Math.ceil(items.length/50));let cursor=0;
    await settle(Array.from({length:Math.min(8,refs.length)},async()=>{while(cursor<refs.length){const i=cursor++;refs[i]=await this.put(items.slice(i*50,(i+1)*50));}}));
    return refs;
  }
  async putUpdate(update,options){
    if(options.immutable&&this.objects.has(update))return this.objects.get(update);
    if(!compactJournal(update))return this.put(update,options);
    const {items,attempts=[],...metadata}=update;
    const record={...metadata,storage:'baoq-update-chunks-v1',itemChunks:await this.chunks(items.map(journalItem)),attempts:[]};
    for(const {items:reports=[],...attempt} of attempts)record.attempts.push({...attempt,itemChunks:await this.chunks(reports)});
    const digest=await this.put(record);this.objects.set(update,digest);return digest;
  }
  async getUpdate(digest){
    const record=await this.get(digest);if(!chunkedJournal(record))return record;
    journalChildren(record); // Validate the complete descriptor before restoring any state.
    const readChunks=async refs=>{const items=[];for(const ref of refs){const part=await this.get(ref);if(!Array.isArray(part)||part.length>50)throw Error('Khối nhật ký không hợp lệ');items.push(...part);}return items;};
    const {storage,itemChunks,attempts,...metadata}=record;
    const update={...metadata,items:await readChunks(itemChunks),attempts:[]};
    for(const {itemChunks,...attempt} of attempts)update.attempts.push({...attempt,items:await readChunks(itemChunks)});
    this.objects.set(update,digest);return update;
  }
  async getRun(digest){
    const record=await this.get(digest);if(record?.format!=='baoq-gzip-run-v1')return record;
    if(typeof record.data!=='string')throw Error('Bảng nén không hợp lệ');
    const run=JSON.parse(gunzipSync(Buffer.from(record.data,'base64')).toString('utf8'));
    this.objects.set(run,digest);return run;
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
        while(cursor<refs.length){const i=cursor++;refs[i]=key==='updates'?await this.putUpdate(state[key][i],options):await this.put(state[key][i],{...options,run:key==='runs'});}
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
      await settle(Array.from({length:Math.min(8,refs.length)},async()=>{while(cursor<refs.length){const i=cursor++;state[key][i]=key==='updates'?await this.getUpdate(refs[i]):key==='runs'?await this.getRun(refs[i]):await this.get(refs[i]);}}));
    }
    if(!Array.isArray(state.products)||(this.kind!=='sapo'&&!Array.isArray(state.runs)))throw Error('Thiếu hồ sơ hoặc lịch sử');
    return state;
  }
  async read() {
    const state=await withStoreLock(this.directory,()=>this.readUnlocked());
    this.runIds=new Set((state?.runs||[]).map(run=>run.id));
    if(state)this.cleanupPending=true;
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
    const nextRuns=new Set((state.runs||[]).map(run=>run.id));
    await withStoreLock(this.directory,async()=>{
     await this.writeUnlocked(state,options);
     if(options.cleanup||this.cleanupPending||[...previous].some(id=>!nextRuns.has(id))) {
      const cleanupStart=performance.now();
      try {
        await cleanupLocked(this.directory);
        this.cleanupPending=false;
      } catch {
        // The manifest is already committed: maintenance must not turn a saved update into a failed write.
        this.cleanupPending=true;
        console.warn('Sale AI: chưa dọn được blob; sẽ thử lại sau lần lưu tiếp theo.');
      } finally {
        this.stats.cleanupMs+=performance.now()-cleanupStart;
        // GC may have removed some blobs before failing; invalidate both caches.
        this.known.clear();this.objects=new WeakMap();
      }
     }
    });
    this.runIds=nextRuns;
  }
  async writeUnlocked(state,options={}) {
    await mkdir(this.blobs,{recursive:true});
    const manifest=await this.build(state,options);
    // Live saves retain checkpoint roots until an ordinary (quiescent) save retires them.
    // Publish roots with the new manifest before any sweep can remove old blobs.
    if(this.lastManifest&&(options.immutable||options.stableRuns)){
      const previous=JSON.parse(this.lastManifest),roots=[...(previous.recoveryIndexes||[])];
      if(JSON.stringify(previous.indexes)!==JSON.stringify(manifest.indexes))roots.push(previous.indexes);
      if(roots.length)manifest.recoveryIndexes=roots;
    }
    const text=JSON.stringify(manifest);
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
