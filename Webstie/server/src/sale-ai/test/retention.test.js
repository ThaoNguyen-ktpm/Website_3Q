import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Simulator } from '../lib/service.js';
import { SplitStore } from '../lib/split-store.js';
import { audit, applyPlan } from '../lib/store-cleanup.js';
import { acquireStoreLock } from '../lib/store-lock.js';

test('eight different days retain seven runs and remove orphaned run blobs', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sale-retention-'));
  const store = new SplitStore(join(dir, 'state.json'));
  const sim = new Simulator(store, { load: async () => [] });
  await sim.initialize();
  for (let n = 1; n <= 8; n++) await sim.run(`2026-10-${String(n).padStart(2, '0')}`);
  assert.equal(sim.state.runs.length, 7);
  assert.equal(sim.state.runs.at(-1).day, '2026-10-02');
  const manifest = JSON.parse(await readFile(store.manifestPath, 'utf8'));
  const refs = new Set(Object.values(manifest.indexes));
  for (const digest of Object.values(manifest.indexes)) {
    for (const ref of JSON.parse(await readFile(join(store.blobs, digest + '.json'), 'utf8'))) refs.add(ref);
  }
  assert.equal((await readdir(store.blobs)).length, refs.size);
  assert.deepEqual((await new SplitStore(store.path).read()).runs, sim.state.runs);
});

test('cleanup failure after publication keeps disk and simulator on the same committed state', async()=>{
 const dir=await mkdtemp(join(tmpdir(),'sale-gc-failure-'));
 const store=new SplitStore(join(dir,'state.json'));
 const sim=new Simulator(store,{load:async()=>[]},undefined,{maxRuns:1});
 await sim.initialize();await sim.run('2026-10-01');
 await writeFile(join(store.blobs,'unexpected.json'),'{}');
 await sim.run('2026-10-02');
 assert.deepEqual((await new SplitStore(store.path).read()).runs,sim.state.runs);
 assert.equal(sim.state.runs[0].day,'2026-10-02');
});

test('first cut after reopening also cleans orphaned blobs and maintenance refuses an active writer', async()=>{
 const dir=await mkdtemp(join(tmpdir(),'sale-gc-restart-'));
 const path=join(dir,'state.json');
 const first=new Simulator(new SplitStore(path),{load:async()=>[]});
 await first.initialize();
 for(let n=1;n<=7;n++)await first.run(`2026-10-0${n}`);
 const store=new SplitStore(path), restarted=new Simulator(store,{load:async()=>[]});
 await restarted.initialize();await restarted.run('2026-10-08');
 assert.equal((await audit(dir)).stores[0].candidates.length,0);
 const plan=await audit(dir), release=await acquireStoreLock(store.directory);
 try{await assert.rejects(applyPlan(dir,plan),/busy/);}finally{await release();}
 assert.equal((await new SplitStore(path).read()).runs.length,7);
});

test('prepared and running updates protect their runs, then release them; limit is configurable', async () => {
  let disk;
  const sim = new Simulator({ read: async () => disk, write: async s => { disk = structuredClone(s); } }, { load: async () => [] }, undefined, { maxRuns: 2 });
  await sim.initialize();
  const first = await sim.run('2026-10-01');
  sim.state.prepared = [{ runId: first.id }];
  const second = await sim.run('2026-10-02');
  sim.state.updates = [{ runId: second.id, attempts: [{ status: 'running' }] }];
  await sim.run('2026-10-03'); await sim.run('2026-10-04');
  assert.deepEqual(sim.state.runs.map(r => r.day), ['2026-10-04', '2026-10-03', '2026-10-02', '2026-10-01']);
  sim.state.prepared = []; sim.state.updates[0].attempts[0].status = 'completed';
  await sim.run('2026-10-05');
  assert.equal(sim.state.runs.length, 2);
});
