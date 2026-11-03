// Load a COPY of the given Sale AI data dir with the project's store code and touch every update/run. No network.
import {cpSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const src = process.argv[2];
const dir = mkdtempSync(join(tmpdir(), 'saleai-integrity-'));
cpSync(src, dir, {recursive: true});
for (const st of ['kiot-state.store','sapo-state.store','state.store']) for (const l of ['.write-lock','.maintenance-lock']) rmSync(join(dir, st, l), {recursive: true, force: true});
try {
  const {createSaleAi} = await import('file:///D:/Website_3Q/Webstie/server/src/sale-ai/core.js');
  const {KiotClient} = await import('file:///D:/Website_3Q/Webstie/server/src/sale-ai/lib/kiot.js');
  const {SapoClient} = await import('file:///D:/Website_3Q/Webstie/server/src/sale-ai/lib/sapo.js');
  const noNet = () => { throw new Error('network disabled'); };
  const client = new KiotClient({credentials: {retailer: 'x', client: 'x', secret: 'x'}, fetcher: noNet}); client.all = noNet;
  const sale = await createSaleAi({dataDir: dir.replace(/\\/g, '/') + '/', client, sapoClient: new SapoClient({shop: 'x.mysapo.net', key: 'x', secret: 'x'}, noNet), readSapoOnStartup: false, sapoWrite: false, kiotDescription: false, batchWrites: true});
  const s = sale.real.state;
  const items = (s.updates || []).reduce((n, u) => n + (u.items?.length || 0), 0);
  const rows = (s.runs || []).reduce((n, r) => n + (r.rows?.length || 0), 0);
  console.log('LOAD OK products', s.products?.length, 'updates', s.updates?.length, 'items', items, 'runs', s.runs?.length, 'rows', rows);
  await sale.shutdown?.();
} catch (e) { console.log('LOAD ERROR', e.message); }
rmSync(dir, {recursive: true, force: true});
