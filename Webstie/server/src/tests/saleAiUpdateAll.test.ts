// TASK-119: every "Chọn tất cả → Cập nhật giá Kiot" situation, end to end: the website (/sale-ai/ with login,
// permission and same-origin checks) → the embedded Sale AI handler in fixture mode → fake Kiot and Sapo. Nothing real is written.
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { app } from '../app.js';
import { getSaleAi } from '../sale-ai/runtime.js';
vi.mock('../sale-ai/runtime.js', () => ({getSaleAi: vi.fn(),getSaleAiUnavailableReason:()=> 'Sale AI đang khởi động — đang thử lại.'}));

vi.mock('../config/env.js', () => ({ env: { APP_ORIGIN: 'http://localhost:8787' } }));
vi.mock('../middlewares/requireAuth.js', () => ({ requireAuth: (req: any, res: any, next: any) => {
  if (!req.get('X-Test-User')) return res.status(401).json({ error: { message: 'Bạn chưa đăng nhập.' } });
  res.locals.user = { id: 1, permissions: ['sale.manage'] }; next();
} }));

const saleAiDir = new URL('../sale-ai/', import.meta.url);
// Slow (real Sale AI journal on disk): run with SALE_AI_E2E=1 npx vitest run src/tests/saleAiUpdateAll.test.ts
const available = process.env.SALE_AI_E2E === '1' && existsSync(new URL('core.js',saleAiDir));
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// kiotLot: one bulk Kiot write of a lot (TASK-102, 50 products); kiotUpdate: one product (restore, old engine).
type Hooks = { kiotLot?: (codes: string[], call: number) => Promise<void> | void; kiotUpdate?: (code: string, call: number) => Promise<void> | void; sapoUpdate?: (sku: string) => Promise<void> | void; sapoRead?: () => Promise<void> | void };
async function start(count: number, { p0 = 35e6, legacy = false, sapoMissing = [] as string[], hooks = {} as Hooks, extra = [] as { code: string; price: number }[] } = {}) {
  const { createSaleAi } = await import('../sale-ai/core.js');
  const { normalizeProduct } = await import('../sale-ai/lib/kiot.js');
  const { SplitStore } = await import('../sale-ai/lib/split-store.js');
  // Real Sale AI stores in a temp folder: same save cost as production, no legacy store is touched.
  const dir = mkdtempSync(join(tmpdir(), 'sale-ai-e2e-'));
  const raw = [...Array.from({ length: count }, (_, n) => ({ code: `SP${String(n + 1).padStart(6, '0')}`, price: p0 })), ...extra];
  const kiot = raw.map((item, n) => normalizeProduct({ id: n + 1, code: item.code, name: `Túi ${n + 1}`, basePrice: item.price, createdDate: '2026-09-01T09:00:00',
    isActive: true, description: 'Kiot gốc', inventories: [{ branchId: 44466, onHand: 1 }] }));
  const sapos = kiot.filter((p: any) => !sapoMissing.includes(p.code)).map((p: any, n: number) => ({ id: 5000 + n, content: '<b>Web gốc</b>', variants: [{ id: 9000 + n, sku: p.code, price: p.currentPrice }] }));
  let kiotCalls = 0, kiotLots = 0;
  let now = Date.parse('2026-11-16T03:00:00Z');
  const pauses: number[] = [];
  const writes = { kiot: [] as string[], sapo: [] as string[] };
  const sapoCalls: string[] = [];
  if(!legacy)priceOnlyChecks.push(()=>{
    expect(sapoCalls).toEqual([]);
    expect(kiot.every((p: any)=>p.notes==='Kiot gốc'||p.notes==='Kiot gốc (sửa tay)')).toBe(true);
  });
  // Kiot lists products by modification time; every change here (ours or a hand edit) goes through edit().
  const modified = new Map<number, number>();
  const edit = (product: any, fields: object) => { Object.assign(product, fields); modified.set(product.id, now); };
  const client: any = {
    all: async () => structuredClone(kiot),
    product: async (id: number) => structuredClone(kiot.find((p: any) => p.id === id)),
    update: async (product: any, body: any) => {
      if(!legacy)expect(Object.keys(body)).toEqual(['basePrice']);
      kiotCalls++;
      await hooks.kiotUpdate?.(product.code, kiotCalls);
      writes.kiot.push(product.code);
      edit(kiot.find((p: any) => p.id === product.id), { currentPrice: body.basePrice, ...('description' in body?{notes:body.description}:{}) });
    },
    listModified: async (since: string) => {
      const list = kiot.filter((p: any) => (modified.get(p.id) ?? -Infinity) >= Date.parse(since));
      client.lastPages = Math.max(1, Math.ceil(list.length / 100));
      return structuredClone(list);
    },
    updateMany: async (entries: any[]) => {
      kiotLots++;
      await hooks.kiotLot?.(entries.map(e => e.product.code), kiotLots);
      for (const { product, fields } of entries) {
        if(!legacy)expect(Object.keys(fields)).toEqual(['basePrice']);
        writes.kiot.push(product.code);
        edit(kiot.find((p: any) => p.id === product.id), { currentPrice: fields.basePrice, ...('description' in fields?{notes:fields.description}:{}) });
      }
    },
  };
  const sapoClient = {
    all: async () => { sapoCalls.push('LIST');await hooks.sapoRead?.(); return structuredClone(sapos); },
    product: async (id: number) => {sapoCalls.push('GET');return structuredClone(sapos.find(p => p.id === id));},
    update: async (id: number, variantId: number, price: number, content?: string) => {
      sapoCalls.push('PUT');
      const product = sapos.find(p => p.id === id)!;
      await hooks.sapoUpdate?.(product.variants[0].sku);
      writes.sapo.push(product.variants[0].sku);
      product.variants.find(v => v.id === variantId)!.price = price;
      if (content !== undefined && content !== null) product.content = content;
    },
    restore: async (id: number, variants: { id: number; price: number }[], content?: string) => {
      sapoCalls.push('RESTORE');
      const product = sapos.find(p => p.id === id)!;
      for (const variant of variants) product.variants.find(v => v.id === variant.id)!.price = variant.price;
      if (content !== undefined && content !== null) product.content = content;
    },
  };
  const timings: any[] = [];
  const sale = await createSaleAi({ store: new SplitStore(join(dir, 'state.json')), liveStore: new SplitStore(join(dir, 'kiot-state.json')), sapoStore: new SplitStore(join(dir, 'sapo-state.json'), { kind: 'sapo' }), client, sapoClient, source: { load: async () => [] },
    // Startup Sapo reads have their own tests; these cases control catalog loading explicitly.
    fixture: true, sapoWrite:legacy, kiotDescription:legacy, batchWrites: true, readSapoOnStartup: false, clock: () => new Date(now) });
  // Rate-limit waits and modification timestamps must advance on the same fixture clock.
  sale.live.sleep = async (ms: number) => { pauses.push(ms); now += ms; };
  sale.live.timingSink = (t: any) => { timings.push(t); };
  vi.mocked(getSaleAi).mockReturnValue(sale);
  return { sale, kiot, sapos, writes, timings, pauses, edit, get kiotCalls() { return kiotCalls; }, get kiotLots() { return kiotLots; } };
}
const servers: http.Server[] = [];
const priceOnlyChecks: (()=>void)[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map(server => new Promise(resolve => server.close(resolve))));for(const check of priceOnlyChecks.splice(0))check(); });

// Same requests and headers the embedded page sends through the website.
// Host as Vite's proxy sends it (rewritten to the API address), not the browser's.
const get = (path: string) => request(app).get(`/sale-ai${path}${path.includes('?') ? '&' : '?'}dataset=real`).set('X-Test-User', '1').set('Host', '127.0.0.1:4000');
const post = async (path: string, body: object = {}) => {
  const response=await request(app).post(`/sale-ai${path}?dataset=real`).set('X-Test-User', '1').set('Host', '127.0.0.1:4000')
    .set('Origin', 'http://localhost:8787').send({ ...body, dataset: 'real' });
  if(response.status!==202)return response;
  // Await the accepted job itself, not repeated HTTP polling on wall-clock delays.
  await getSaleAi()!.waitForJob(response.body.id);
  const job=await get('/api/jobs/'+encodeURIComponent(response.body.id));
  expect(job.status).toBe(200);
  expect(['completed','failed']).toContain(job.body.status);
  return job.body.status==='completed'?{...response,status:200,body:job.body.result}
    :{...response,status:job.body.errorStatus,body:{error:job.body.error}};
};
async function loadTable({ sapoIndex = getSaleAi()!.live.sapoWrite !== false } = {}) {
  expect((await post('/api/kiot/refresh')).status).toBe(200);
  if (sapoIndex) expect((await post('/api/sapo/refresh')).status).toBe(200);
  expect((await post('/api/table/ensure')).status).toBe(200);
  const view = (await get('/api/view?view=results')).body;
  return { runId: view.runs[0].id as string, view };
}
async function selectAllAndPrepare() {
  const { runId } = await loadTable();
  const selection = (await get(`/api/kiot/selection?runId=${runId}&q=`)).body;
  const prepare = await post('/api/kiot/prepare', { runId, codes: selection.codes, excludedCodes: selection.excludedCodes ?? [], continueOnError: true });
  return { runId, selection, prepare };
}
const commit = (id: string) => post('/api/kiot/commit', { id, confirmed: true });
const summary = (update: any) => ({ outcome: update.outcome, kiot: update.platformSummary?.kiot, sapo: update.platformSummary?.sapo, items: update.items?.length, skipped: update.skipped?.length, issues: update.issueCount });

describe.skipIf(!available)('Sale AI "cập nhật toàn bộ" through the website', () => {
  it('TASK-125. verified writes refresh the table and repeated background selection skips without PUT or retry',async()=>{
    const f=await start(2),{runId}=await loadTable();
    const first=await post('/api/kiot/update',{runId,codes:['SP000001'],confirmed:true});
    expect(first.body.outcome).toBe('success');
    const view=(await get('/api/view?view=results')).body,run=view.runs[0];
    const row=run.rows.find((r:any)=>r.code==='SP000001');
    expect(row.currentPrice).toBe(row.price);expect(row.notesBefore).toBe('Kiot gốc');expect(row.liveReadAt).toBeTruthy();
    const selection=(await get('/api/kiot/selection?runId='+run.id)).body;
    expect(selection.codes).toEqual(['SP000002']);expect(selection.excludedCodes).toEqual([]);
    const again=await post('/api/kiot/update',{runId:run.id,codes:['SP000001'],confirmed:true});
    expect(again.body.outcome).toBe('success');expect(again.body.items[0].status).toBe('unchanged');
    expect(again.body.items[0].platforms.kiot.requestSent).toBe(false);expect(again.body.issueCount).toBe(0);
    expect(f.writes.kiot).toEqual(['SP000001']);expect(f.writes.sapo).toEqual([]);
    const retry=(await get('/api/kiot/retry-selection?updateId='+again.body.id)).body;
    expect(retry.codes).toEqual([]);expect(retry.total).toBe(0);
  });
  it('16. TASK-118 null Sapo description writes, verifies and restores empty HTML',async()=>{
    const f=await start(1,{legacy:true});(f.sapos[0] as {content:string|null}).content=null;f.sale.live.sapoDescription=true;
    const {runId}=await loadTable();
    const update=await post('/api/kiot/update',{runId,codes:['SP000001'],confirmed:true});
    expect(update.body.outcome).toBe('success');expect(f.sapos[0].content).toContain('BAOQ');
    const restore=await post('/api/kiot/restore/prepare',{sourceId:update.body.id});
    expect(restore.status).toBe(200);
    const result=await post('/api/kiot/restore/commit',{id:restore.body.id,confirmed:true});
    expect(result.body.outcome).toBe('success');expect(f.sapos[0].content??'').toBe('');
  });
  it('17. TASK-119 zero Sapo price still updates Kiot and never reads Sapo',async()=>{
    const f=await start(1);f.sapos[0].variants[0].price=0;
    const {runId}=await loadTable();
    const update=await post('/api/kiot/update',{runId,codes:['SP000001'],confirmed:true});
    expect(update.body.items[0].status).toBe('done');
    expect(f.writes).toEqual({kiot:['SP000001'],sapo:[]});
    const retry=await get('/api/kiot/retry-selection?updateId='+update.body.id);expect(retry.body.codes).toEqual([]);
  });
  it('1. happy path: every product gets P_M on Kiot, descriptions and Sapo stay intact', async () => {
    const f = await start(Number(process.env.S1_COUNT || 50));
    const { selection, prepare } = await selectAllAndPrepare();
    expect(selection.codes).toHaveLength(Number(process.env.S1_COUNT || 50));
    expect(prepare.status).toBe(200);
    const result = await commit(prepare.body.id);
    expect(result.status).toBe(200);
    const t = f.timings.find(x => x.kind === 'commit') ?? f.timings.at(-1);
    console.log('S1', { count: selection.codes.length, commitMs: Math.round(t?.totalMs), saveMs: Math.round(t?.saveMs), publishMs: Math.round(t?.publishMs) }, summary(result.body));
    expect(result.body.outcome).toBe('success');
    expect(f.writes.kiot.length).toBe(Number(process.env.S1_COUNT || 50));
    expect(f.kiot.every((p: any) => p.currentPrice === 33_400_000)).toBe(true); // TASK-105 batch: 01/11 is M1; 16/11 is M2 = 35 - 1.6
    expect(f.sapos.every(p => p.variants[0].price === 35e6 && p.content === '<b>Web gốc</b>')).toBe(true);
  });

  // Commit time grows faster than the product count (journal saved before every request): 100 → 9,7 s, 200 → 31,6 s, 300 → 50,4 s.
  it('2. scale: selecting and checking 4.500 products goes through the embedded router in one request each', async () => {
    const f = await start(4500);
    const started = Date.now();
    const { selection, prepare } = await selectAllAndPrepare();
    const bodyBytes = JSON.stringify({ codes: selection.codes }).length;
    console.log('S2', { bodyBytes, ms: Date.now() - started, prepared: prepare.body.items?.length });
    expect(prepare.status).toBe(200);
    expect(prepare.body.items).toHaveLength(4500);
    expect(f.writes.kiot.length).toBe(0);
  }, 120_000);

  it('3. Sapo index not read yet: Kiot update still succeeds', async () => {
    // TASK-108: Kiot reload also reads Sapo, so fail that read to keep the index unavailable.
    // TASK-119: the disabled Sapo path must never invoke this hook; Kiot remains writable.
    const f = await start(5, { hooks: { sapoRead: () => { throw new Error('Sapo fixture: chưa đọc được chỉ mục'); } } });
    const { runId } = await loadTable({ sapoIndex: false });
    expect(f.sale.sapo.status().ready).toBe(false);
    const selection = (await get(`/api/kiot/selection?runId=${runId}&q=`)).body;
    const prepare = await post('/api/kiot/prepare', { runId, codes: selection.codes, excludedCodes: [], continueOnError: true });
    console.log('S3', prepare.status, prepare.body.error);
    expect(prepare.status).toBe(200);
    expect((await commit(prepare.body.id)).body.outcome).toBe('success');
    expect(f.writes.kiot.length).toBe(5);expect(f.writes.sapo).toEqual([]);
  });

  it('4. products edited on Kiot after the check are skipped, the rest are written', async () => {
    const f = await start(20);
    const { prepare } = await selectAllAndPrepare();
    for (const product of f.kiot.slice(0, 3)) f.edit(product, { notes: product.notes + ' (sửa tay)' });
    const result = await commit(prepare.body.id);
    console.log('S4', summary(result.body));
    expect(f.writes.kiot).not.toContain('SP000001');
    expect(f.writes.kiot.length).toBe(17);
  });

  it('5. Kiot rate limit (HTTP 429) on one lot: that lot fails, Kiot pauses, the other lots continue, nothing is retried', async () => {
    const f = await start(120, { hooks: { kiotLot: (_codes, call) => { if (call === 2) throw Object.assign(new Error('Kiot trả HTTP 429'), { httpStatus: 429, uncertain: false, retryAfter: 1 }); } } });
    const { prepare } = await selectAllAndPrepare();
    const result = await commit(prepare.body.id);
    console.log('S5', summary(result.body), 'kiotLots', f.kiotLots);
    expect(f.writes.kiot.length).toBe(70);
    expect(f.kiotLots).toBe(3);
    expect(f.writes.sapo.length).toBe(0);
    expect(f.pauses).toEqual([1000]);
  }, 30_000);

  it('6. Kiot timeout on one lot: that lot is unknown, no retry, the next lots continue', async () => {
    const f = await start(120, { hooks: { kiotLot: (_codes, call) => { if (call === 1) throw Object.assign(new Error('timeout'), { uncertain: true }); } } });
    const { prepare } = await selectAllAndPrepare();
    const result = await commit(prepare.body.id);
    const statuses = new Set(result.body.items.slice(0, 50).map((i: any) => i.platforms.kiot.status));
    console.log('S6', summary(result.body), [...statuses]);
    expect([...statuses]).toEqual(['unknown']);
    expect(f.kiotLots).toBe(3);
    expect(f.writes.kiot.length).toBe(70);
  });

  it('7. Kiot permission lost (HTTP 403): Kiot stops without touching Sapo', async () => {
    const f = await start(120, { hooks: { kiotLot: (_codes, call) => { if (call === 2) throw Object.assign(new Error('forbidden'), { httpStatus: 403 }); } } });
    const { prepare } = await selectAllAndPrepare();
    const result = await commit(prepare.body.id);
    console.log('S7', summary(result.body));
    expect(f.kiotLots).toBe(2);
    expect(f.writes.kiot.length).toBe(50);
    expect(f.writes.sapo.length).toBe(0);
  });

  it('8. products without a Sapo SKU still update Kiot', async () => {
    const f = await start(10, { sapoMissing: ['SP000002', 'SP000005'] });
    const { prepare } = await selectAllAndPrepare();
    const result = await commit(prepare.body.id);
    const errors = (await get(`/api/history/updates/${encodeURIComponent(result.body.id)}?page=1&size=10&errorsOnly=true`)).body;
    console.log('S8', summary(result.body), errors.pagination?.items?.map((i: any) => i.code));
    expect(f.writes.kiot).toContain('SP000002');expect(f.writes.kiot).toContain('SP000005');
    expect(errors.pagination.items).toEqual([]);
  });

  it('9. double click / second tab: a second commit or reload while updating is refused', async () => {
    const f = await start(40, { hooks: { kiotLot: () => sleep(600) } });
    const { prepare } = await selectAllAndPrepare();
    const first = commit(prepare.body.id).then(r => r);
    await sleep(100);
    const second = await commit(prepare.body.id);
    const reload = await post('/api/kiot/refresh');
    const done = await first;
    console.log('S9', { second: [second.status, second.body.error], reload: [reload.status, reload.body.error], first: summary(done.body) });
    expect(second.status).toBe(409);
    expect(reload.status).toBe(409);
    expect(f.writes.kiot.length).toBe(40);
  });

  it('10. closing the page during the update: Sale AI keeps going and history has the result', async () => {
    const f = await start(40, { hooks: { kiotLot: () => sleep(600) } });
    const { prepare } = await selectAllAndPrepare();
    const web = app.listen(0, '127.0.0.1');
    servers.push(web);
    await new Promise(resolve => web.once('listening', resolve));
    const body = JSON.stringify({ id: prepare.body.id, confirmed: true, dataset: 'real' });
    const aborted = http.request({ host: '127.0.0.1', port: (web.address() as AddressInfo).port, method: 'POST', path: '/sale-ai/api/kiot/commit?dataset=real',
      headers: { 'X-Test-User': '1', Host: '127.0.0.1:4000', Origin: 'http://localhost:8787', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } });
    aborted.on('error', () => {});
    aborted.end(body);
    await sleep(150);
    aborted.destroy();
    for (let i = 0; i < 1200 && f.writes.kiot.length < 40; i++) await sleep(50);
    await sleep(500);
    const history = (await get('/api/view?view=history')).body;
    console.log('S10', { kiotWrites: f.writes.kiot.length, latest: history.history?.[0]?.update?.outcome });
    expect(f.writes.kiot.length).toBe(40);
    expect(history.history[0].update.outcome).toBe('success');
  });

  it('11. rollback puts back only Kiot prices, keeping descriptions and Sapo intact', async () => {
    const f = await start(15);
    const { prepare } = await selectAllAndPrepare();
    const update = (await commit(prepare.body.id)).body;
    const restorePrepare = await post('/api/kiot/restore/prepare', { sourceId: update.id });
    const restore = await post('/api/kiot/restore/commit', { id: restorePrepare.body.id, confirmed: true });
    console.log('S11', restorePrepare.status, restore.status, summary(restore.body));
    expect(restore.status).toBe(200);
    expect(f.kiot.every((p: any) => p.currentPrice === 35e6)).toBe(true);
    expect(f.sapos.every(p => p.variants[0].price === 35e6)).toBe(true);
  });

  it('12. products from 600 million are absent from the table and are not sent', async () => {
    const f = await start(5, { extra: [{ code: 'SP900001', price: 700e6 }] });
    const { selection, prepare } = await selectAllAndPrepare();
    expect(selection.codes).not.toContain('SP900001');
    expect(selection.excludedCodes).not.toContain('SP900001');
    const view = await get('/api/view');
    expect(view.body.runs[0].hiddenOver600mCount).toBe(1);
    expect(view.body.runs[0].rows.some((r: any) => r.code === 'SP900001')).toBe(false);
    const result = await commit(prepare.body.id);
    console.log('S12', { codes: selection.codes.length, excluded: selection.excludedCodes, ...summary(result.body) });
    expect(f.writes.kiot).not.toContain('SP900001');
    expect(f.writes.sapo).not.toContain('SP900001');
    expect(f.writes.kiot.length).toBe(5);
  });

  it('13. second update of the same day skips products already at the right Kiot price', async () => {
    const f = await start(60);
    await commit((await selectAllAndPrepare()).prepare.body.id);
    f.edit(f.kiot[0], {currentPrice:35e6});
    const { selection, prepare } = await selectAllAndPrepare();
    const result = await commit(prepare.body.id);
    console.log('S13', summary(result.body), result.body.unchanged, result.body.message);
    // TASK-125: select-all excludes correct prices before confirmation.
    expect(selection.codes).toEqual(['SP000001']);
    expect(selection.excludedCodes).toEqual([]);
    expect(prepare.body.unchanged).toBe(0);
    expect(result.body.items.map((i: any) => i.code)).toEqual(['SP000001']);
    expect(f.writes.kiot.length).toBe(61);
    expect(f.writes.sapo.length).toBe(0);
  });

  it('15. Sapo PUT 429 is not resent; the other products and Kiot continue after a pause', async () => {
    const attempts: string[] = [];
    const f = await start(4, { legacy:true, hooks: { sapoUpdate: sku => {
      attempts.push(sku);
      if (sku === 'SP000001') throw Object.assign(new Error('Sapo PUT: HTTP 429'), { httpStatus: 429, retryAfter: 2, uncertain: false });
    } } });
    const result = await commit((await selectAllAndPrepare()).prepare.body.id);
    expect(result.status).toBe(200);
    expect(result.body.platformSummary.kiot.succeeded).toBe(4);
    expect(result.body.platformSummary.sapo.succeeded).toBe(3);
    expect(result.body.items[0].platforms.sapo.status).toBe('write_failed');
    expect(result.body.items[0].platforms.sapo.error).toContain('Sapo quá giới hạn — chưa ghi');
    expect(attempts.filter(sku => sku === 'SP000001')).toHaveLength(1);
    expect(f.pauses.some(ms => ms >= 2000)).toBe(true);
    expect(f.writes.sapo).not.toContain('SP000001');
  });

  it('14. history "Cập nhật lại các món lỗi": only the failed products, checked again, then written', async () => {
    const f = await start(120, { hooks: { kiotLot: (_codes, call) => { if (call === 2) throw Object.assign(new Error('timeout'), { uncertain: true }); } } });
    const first = (await commit((await selectAllAndPrepare()).prepare.body.id)).body;
    await loadTable();
    const retry = await get(`/api/kiot/retry-selection?updateId=${encodeURIComponent(first.id)}`);
    expect(retry.status).toBe(200);
    expect([retry.body.total, retry.body.codes.length, retry.body.notEligible]).toEqual([50, 50, 0]);
    const prepare = await post('/api/kiot/prepare', { runId: retry.body.runId, codes: retry.body.codes, continueOnError: true });
    const result = await commit(prepare.body.id);
    console.log('S14', summary(result.body), result.body.message);
    expect(result.body.outcome).toBe('success');
    expect(f.writes.kiot.length).toBe(120);
    expect(f.writes.sapo.length).toBe(0);
    expect(f.kiot.every((p: any) => p.currentPrice === result.body.items[0].row.price)).toBe(true);
  });
});
