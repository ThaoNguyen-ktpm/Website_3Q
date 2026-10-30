import {mkdir,rmdir,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
async function maintenanceActive(directory){try{await lstat(join(directory,'.maintenance-lock'));return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}}
export async function acquireStoreLock(directory,{maintenance=false}={}){
 await mkdir(directory,{recursive:true});const lock=join(directory,'.write-lock');
 for(let attempt=0;;attempt++){
  if(!maintenance&&await maintenanceActive(directory))throw Error('Store busy: maintenance lock exists');
  try{await mkdir(lock);break;}catch(e){if(e.code!=='EEXIST')throw e;if(maintenance||attempt>=100)throw Error('Store busy: writer/maintenance lock exists');await delay(20);}
 }
 if(!maintenance&&await maintenanceActive(directory)){await rmdir(lock);throw Error('Store busy: maintenance lock exists');}
 return ()=>rmdir(lock);
}
export async function acquireMaintenanceLock(directory){
 const maintenance=join(directory,'.maintenance-lock');await mkdir(maintenance);
 try{const release=await acquireStoreLock(directory,{maintenance:true});return async()=>{try{await release();}finally{await rmdir(maintenance);}};}catch(e){await rmdir(maintenance);throw e;}
}
export async function withStoreLock(directory,operation){
 const release=await acquireStoreLock(directory);try{return await operation();}finally{await release();}
}
