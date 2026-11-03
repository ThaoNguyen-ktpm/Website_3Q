import {mkdir,rmdir,lstat,readdir,readFile,writeFile,unlink,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
const startedAt=new Date(Date.now()-process.uptime()*1000).toISOString(),startupId=randomUUID();
const LEGACY_TTL_MS=10*60*1000,held=new Set();
const alive=pid=>{try{process.kill(pid,0);return true;}catch(e){if(e.code==='ESRCH')return false;return true;}};
async function reap(lock){
 try{
  const stat=await lstat(lock),files=await readdir(lock);
  if(!stat.isDirectory()||stat.isSymbolicLink())return false;
  if(files.length===1&&/^owner-[\w-]+\.json$/.test(files[0])){
   const owner=JSON.parse(await readFile(join(lock,files[0]),'utf8'));
   if(!Number.isSafeInteger(owner.pid)||owner.pid<=0||alive(owner.pid))return false;
   // Unique owner filename prevents another reaper deleting a replacement owner's file.
   await unlink(join(lock,files[0]));
  }else if(files.length||Date.now()-stat.mtimeMs<LEGACY_TTL_MS)return false;
  // Never recurse: a replacement live lock already contains its owner file.
  await rmdir(lock);console.warn(`Sale AI: gỡ khoá bỏ lại ${lock}`);return true;
 }catch(e){if(['ENOENT','ENOTEMPTY','EEXIST'].includes(e.code))return false;if(e instanceof SyntaxError)return false;throw e;}
}
async function exists(lock){try{await lstat(lock);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}}
async function maintenanceActive(directory){const lock=join(directory,'.maintenance-lock');if(await reap(lock))return false;return exists(lock);}
async function claim(lock){
 if(await exists(lock))throw Object.assign(Error('Lock exists'),{code:'EEXIST'});
 const token=randomUUID(),file=`owner-${token}.json`,pending=lock+'.'+token;
 await mkdir(pending);
 try{
  await writeFile(join(pending,file),JSON.stringify({pid:process.pid,createdAt:new Date().toISOString(),startedAt,startupId,token}),'utf8');
  // Publish a populated directory atomically; there is no ownerless acquisition window.
  await rename(pending,lock);
 }catch(e){await unlink(join(pending,file)).catch(()=>{});await rmdir(pending).catch(()=>{});throw e;}
 let finish;const done=new Promise(resolve=>{finish=resolve;});held.add(done);
 let released=false;
 return async()=>{if(released)return;await unlink(join(lock,file));await rmdir(lock);released=true;held.delete(done);finish();};
}
export async function acquireStoreLock(directory,{maintenance=false}={}){
 await mkdir(directory,{recursive:true});const lock=join(directory,'.write-lock');
 for(let attempt=0;;attempt++){
  if(!maintenance&&await maintenanceActive(directory))throw Error('Store busy: maintenance lock exists');
  try{
   const release=await claim(lock);
   if(!maintenance&&await maintenanceActive(directory)){await release();throw Error('Store busy: maintenance lock exists');}
   return release;
  }catch(e){if(!['EEXIST','ENOTEMPTY','EPERM','EACCES'].includes(e.code)||!await exists(lock))throw e;
   if(await reap(lock))continue;
   if(maintenance||attempt>=100)throw Error('Store busy: writer/maintenance lock exists');await delay(20);
  }
 }
}
export async function acquireMaintenanceLock(directory){
 await mkdir(directory,{recursive:true});const maintenance=join(directory,'.maintenance-lock');let releaseMaintenance;
 for(;;){try{releaseMaintenance=await claim(maintenance);break;}catch(e){if(!await exists(maintenance))throw e;if(!await reap(maintenance))throw Error('Store busy: maintenance lock exists');}}
 try{const release=await acquireStoreLock(directory,{maintenance:true});return async()=>{try{await release();}finally{await releaseMaintenance();}};}catch(e){await releaseMaintenance();throw e;}
}
/** Wait for owners to release normally; never unlock a writer still doing I/O. */
export async function waitForStoreLocks(timeoutMs=5000){
 const deadline=Date.now()+timeoutMs;
 while(held.size&&Date.now()<deadline)await delay(Math.min(20,Math.max(0,deadline-Date.now())));
 return held.size===0;
}
export async function withStoreLock(directory,operation){
 const release=await acquireStoreLock(directory);try{return await operation();}finally{await release();}
}
