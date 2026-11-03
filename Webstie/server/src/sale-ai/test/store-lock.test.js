import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,utimes,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {acquireStoreLock,acquireMaintenanceLock,waitForStoreLocks} from '../lib/store-lock.js';
import {createSaleAi} from '../core.js';
import {SapoClient} from '../lib/sapo.js';

async function fixture(t){const dir=await mkdtemp(join(tmpdir(),'sale-lock-'));assert.ok(dir.startsWith(join(tmpdir(),'sale-lock-')));t.after(()=>rm(dir,{recursive:true,force:true}));return dir;}
test('TASK-117 locks publish PID, time and startup identity and release cleanly',async t=>{
 const dir=await fixture(t),release=await acquireStoreLock(dir),files=await readdir(join(dir,'.write-lock'));
 assert.equal(files.length,1);const owner=JSON.parse(await readFile(join(dir,'.write-lock',files[0]),'utf8'));
 assert.equal(owner.pid,process.pid);assert.ok(owner.startedAt);assert.ok(owner.createdAt);assert.ok(owner.token);
 await release();assert.deepEqual(await readdir(dir),[]);
});
for(const name of ['.write-lock','.maintenance-lock'])test(`TASK-117 dead owner recovered: ${name}`,async t=>{
 const dir=await fixture(t),lock=join(dir,name);await mkdir(lock);
 await writeFile(join(lock,'owner-dead.json'),JSON.stringify({pid:2147483647,token:'dead',startedAt:'old',createdAt:'old'}));
 const logs=[],original=console.warn;console.warn=(...args)=>logs.push(args.join(' '));
 try{const release=await acquireMaintenanceLock(dir);await release();}finally{console.warn=original;}
 assert.ok(logs.some(s=>s.includes('gỡ khoá bỏ lại')));assert.deepEqual(await readdir(dir),[]);
});
test('TASK-117 live owners are never reaped even with an old timestamp',async t=>{
 const dir=await fixture(t),release=await acquireStoreLock(dir);
 const old=new Date(Date.now()-3600000);await utimes(join(dir,'.write-lock'),old,old);
 await assert.rejects(acquireMaintenanceLock(dir),/Store busy/);assert.equal((await readdir(join(dir,'.write-lock'))).length,1);await release();
});
test('TASK-117 legacy empty lock only recovered after ten minutes',async t=>{
 const dir=await fixture(t),lock=join(dir,'.write-lock');await mkdir(lock);
 await assert.rejects(acquireMaintenanceLock(dir),/Store busy/);
 const old=new Date(Date.now()-601000);await utimes(lock,old,old);
 const release=await acquireMaintenanceLock(dir);await release();assert.deepEqual(await readdir(dir),[]);
});
test('TASK-117 drain waits for normal release and never unlinks a live writer on timeout',async t=>{
 const dir=await fixture(t),release=await acquireStoreLock(dir);
 try{assert.equal(await waitForStoreLocks(1),false);assert.equal((await readdir(join(dir,'.write-lock'))).length,1);}
 finally{await release();}
 assert.equal(await waitForStoreLocks(10),true);
});
test('TASK-117 concurrent reapers leave exactly one maintenance owner',async t=>{
 const dir=await fixture(t),lock=join(dir,'.maintenance-lock');await mkdir(lock);
 await writeFile(join(lock,'owner-dead.json'),JSON.stringify({pid:2147483647}));
 const results=await Promise.allSettled([acquireMaintenanceLock(dir),acquireMaintenanceLock(dir)]);
 const owners=results.filter(r=>r.status==='fulfilled');assert.equal(owners.length,1);
 await owners[0].value();assert.deepEqual(await readdir(dir),[]);
});
test('TASK-117 full offline initialization recovers a dead writer during store cleanup',async t=>{
 const dir=await fixture(t);
 const options={dataDir:dir,client:{},sapoClient:new SapoClient({},()=>{throw Error('Unexpected network');}),readSapoOnStartup:false};
 const first=await createSaleAi(options);await first.shutdown();
 const lock=join(dir,'kiot-state.store','.write-lock');await mkdir(lock);
 await writeFile(join(lock,'owner-dead.json'),JSON.stringify({pid:2147483647}));
 const reopened=await createSaleAi(options);assert.ok(reopened.handler);assert.equal(await reopened.shutdown(),true);
 assert.ok(!(await readdir(join(dir,'kiot-state.store'))).includes('.write-lock'));
});
