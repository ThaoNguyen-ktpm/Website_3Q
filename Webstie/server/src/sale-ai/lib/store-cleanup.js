import {readFile,readdir,lstat,realpath,unlink,writeFile} from 'node:fs/promises';
import {resolve,join,basename,dirname,relative,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createConnection} from 'node:net';
import {acquireMaintenanceLock} from './store-lock.js';
const hash=data=>createHash('sha256').update(data).digest('hex');
const digestPattern=/^[a-f0-9]{64}$/;
const storeNames=['kiot-state.store','sapo-state.store','state.store'];
const collections=new Set(['products','archivedProducts','runs','updates','prepared']);
const canonical=p=>process.platform==='win32'?resolve(p).toLowerCase():resolve(p);
async function safePath(path){
 const info=await lstat(path);
 if(info.isSymbolicLink()||canonical(await realpath(path))!==canonical(path))throw Error('Unsafe link/path: '+basename(path));
 return info;
}
async function verifiedBlob(blobs,digest){
 if(!digestPattern.test(digest))throw Error('Invalid blob reference');
 const path=join(blobs,digest+'.json'),info=await safePath(path);
 if(!info.isFile())throw Error('Invalid blob file');
 const bytes=await readFile(path);if(hash(bytes)!==digest)throw Error('Blob hash mismatch: '+digest);
 return {value:JSON.parse(bytes.toString('utf8')),bytes:bytes.length};
}
export async function audit(root,names=storeNames){
 root=resolve(root);await safePath(root);
 const stores=[];
 for(const name of names){
  if(!storeNames.includes(name))throw Error('Invalid store');
  const directory=join(root,name);
  try{await safePath(directory);}catch(e){if(e.code==='ENOENT')continue;throw e;}
  // A read of a new Sapo store creates its directory before the first catalog save.
  if((await readdir(directory)).every(name=>['.write-lock','.maintenance-lock'].includes(name)))continue;
  const blobs=join(directory,'blobs');await safePath(blobs);
  const manifestPath=join(directory,'manifest.json');await safePath(manifestPath);
  const manifestBytes=await readFile(manifestPath),manifest=JSON.parse(manifestBytes.toString('utf8'));
  if(manifest.format!=='baoq-split-v1'||!manifest.metadata||!manifest.indexes||typeof manifest.indexes!=='object'||Array.isArray(manifest.indexes)||!manifest.indexes.products||(name!=='sapo-state.store'&&(!manifest.indexes.runs||manifest.metadata.version!==1)))throw Error('Invalid manifest');
  const referenced=new Set(),counts={};
  for(const [collection,digest] of Object.entries(manifest.indexes)){
   if(!collections.has(collection))throw Error('Invalid manifest collection');
   const index=await verifiedBlob(blobs,digest);if(!Array.isArray(index.value))throw Error('Invalid index');
   referenced.add(digest);counts[collection]=index.value.length;
   for(const ref of index.value){if(!digestPattern.test(ref))throw Error('Invalid record reference');referenced.add(ref);}
  }
  let keptBytes=0;for(const digest of referenced)keptBytes+=(await verifiedBlob(blobs,digest)).bytes;
  const candidates=[];
  for(const entry of await readdir(blobs,{withFileTypes:true})){
   if(!entry.isFile()||!/^([a-f0-9]{64})\.json$/.test(entry.name))throw Error('Invalid blob entry/link: '+entry.name);
   if(!referenced.has(entry.name.slice(0,-5))){const blob=await verifiedBlob(blobs,entry.name.slice(0,-5));candidates.push({name:entry.name,bytes:blob.bytes});}
  }
  candidates.sort((a,b)=>a.name.localeCompare(b.name));
  if(hash(await readFile(manifestPath))!==hash(manifestBytes))throw Error('Manifest changed during audit');
  stores.push({name,manifestHash:hash(manifestBytes),counts,keptFiles:referenced.size,keptBytes,candidates});
 }
 if(!stores.length)throw Error('No stores found');
 return {format:'baoq-cleanup-v1',root,stores};
}
export async function applyPlan(root,plan,{onLocked}={}){
 if(plan?.format!=='baoq-cleanup-v1'||canonical(plan.root)!==canonical(root))throw Error('Invalid cleanup plan/root');
 const names=plan.stores.map(store=>store.name);
 await audit(root,names);const releases=[];
 try{
 for(const store of plan.stores){if(!storeNames.includes(store.name))throw Error('Invalid store');releases.push(await acquireMaintenanceLock(join(resolve(root),store.name)));}
 const current=await audit(root,names);
 if(JSON.stringify(current)!==JSON.stringify(plan))throw Error('Cleanup plan or manifest changed; audit again');
 await onLocked?.();
 // Validate every store before deleting any file. Stores must remain offline.
 let deletedFiles=0,deletedBytes=0;
 for(const store of current.stores){
  const directory=join(current.root,store.name),blobs=join(directory,'blobs');
  for(const candidate of store.candidates){
   if(!/^[a-f0-9]{64}\.json$/.test(candidate.name))throw Error('Invalid candidate path');
   if(hash(await readFile(join(directory,'manifest.json')))!==store.manifestHash)throw Error('Manifest changed during cleanup');
   const target=join(blobs,candidate.name);await verifiedBlob(blobs,candidate.name.slice(0,-5));
   await unlink(target);deletedFiles++;deletedBytes+=candidate.bytes;
  }
 }
 const after=await audit(root,names);
 for(let i=0;i<current.stores.length;i++)if(current.stores[i].manifestHash!==after.stores[i].manifestHash||JSON.stringify(current.stores[i].counts)!==JSON.stringify(after.stores[i].counts))throw Error('Store changed after cleanup');
 return {deletedFiles,deletedBytes,after};
 }finally{for(const release of releases.reverse())await release();}
}
