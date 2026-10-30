// TASK-037: every "Chọn tất cả → Cập nhật Kiot + Sapo" situation, end to end: the website (/sale-ai/ with login,
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
vi.mock('../sale-ai/runtime.js', () => ({getSaleAi: vi.fn()}));

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
type Hooks = { kiotLot?: (codes: string[], call: number) => Promise<void> | void; kiotUpdate?: (code: string, call: number) => Promise<void> | void; sapoUpdate?: (sku: string) => Promise<void> | void };
async function start(count: number, { p0 = 35e6, sapoMissing = [] as string[], hooks = {} as Hooks, extra = [] as { code: string; price: number }[] } = {}) {
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
  const writes = { kiot: [] as string[], sapo: [] as string[] };
  // Kiot lists products by modification time; every change here (ours or a hand edit) goes through edit().
  const modified = new Map<number, number>();
  const edit = (product: any, fields: object) => { Object.assign(product, fields); modified.set(product.id, Date.parse('2026-11-16T03:00:00Z')); };
  const client: any = {
    all: async () => structuredClone(kiot),
    product: async (id: number) => structuredClone(kiot.find((p: any) => p.id === id)),
    update: async (product: any, body: any) => {
      kiotCalls++;
      await hooks.kiotUpdate?.(product.code, kiotCalls);
      writes.kiot.push(product.code);
      edit(kiot.find((p: any) => p.id === product.id), { currentPrice: body.basePrice, notes: body.description });
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
        writes.kiot.push(product.code);
        edit(kiot.find((p: any) => p.id === product.id), { currentPrice: fields.basePrice, notes: fields.description });
      }
    },
  };
  const sapoClient = {
    all: async () => structuredClone(sapos),
    product: async (id: number) => structuredClone(sapos.find(p => p.id === id)),
    update: async (id: number, variantId: number, price: number, content?: string) => {
      const product = sapos.find(p => p.id === id)!;
      await hooks.sapoUpdate?.(product.variants[0].sku);
      writes.sapo.push(product.variants[0].sku);
      product.variants.find(v => v.id === variantId)!.price = price;
      if (content !== undefined && content !== null) product.content = content;
    },
    restore: async (id: number, variants: { id: number; price: number }[], content?: string) => {
      const product = sapos.find(p => p.id === id)!;
      for (const variant of variants) product.variants.find(v => v.id === variant.id)!.price = variant.price;
      if (content !== undefined && content !== null) product.content = content;
    },
  };
  const timings: any[] = [];
  const sale = await createSaleAi({ store: new SplitStore(join(dir, 'state.json')), liveStore: new SplitStore(join(dir, 'kiot-state.json')), sapoStore: new SplitStore(join(dir, 'sapo-state.json'), { kind: 'sapo' }), client, sapoClient, source: { load: async () => [] },
    fixture: true, batchWrites: true, clock: () => new Date('2026-11-16T03:00:00Z') });
  sale.live.timingSink = (t: any) => { timings.push(t); };
  vi.mocked(getSaleAi).mockReturnValue(sale);
  return { sale, kiot, sapos, writes, timings, edit, get kiotCalls() { return kiotCalls; }, get kiotLots() { return kiotLots; } };
}
const servers: http.Server[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map(server => new Promise(resolve => server.close(resolve)))); });

// Same requests and headers the embedded page sends through the website.
// Host as Vite's proxy sends it (rewritten to the API address), not the browser's.
const get = (path: string) => request(app).get(`/sale-ai${path}${path.includes('?') ? '&' : '?'}dataset=real`).set('X-Test-User', '1').set('Host', '127.0.0.1:4000');
const post = (path: string, body: object = {}) => request(app).post(`/sale-ai${path}?dataset=real`).set('X-Test-User', '1').set('Host', '127.0.0.1:4000')
  .set('Origin', 'http://localhost:8787').send({ ...body, dataset: 'real' });
async function loadTable({ sapoIndex = true } = {}) {
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
  it('1. happy path: every product gets P_M on Kiot and Sapo', async () => {
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
    expect(f.sapos.every(p => p.variants[0].price === 33_400_000)).toBe(true);
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

  it('3. Sapo index not read yet: the update is refused before any write', async () => {
    const f = await start(5);
    const { runId } = await loadTable({ sapoIndex: false });
    const selection = (await get(`/api/kiot/selection?runId=${runId}&q=`)).body;
    const prepare = await post('/api/kiot/prepare', { runId, codes: selection.codes, excludedCodes: [], continueOnError: true });
    console.log('S3', prepare.status, prepare.body.error);
    expect(prepare.status).not.toBe(200);
    expect(f.writes.kiot.length + f.writes.sapo.length).toBe(0);
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
    expect(f.writes.sapo.length).toBe(120);
  }, 30_000); // fixed test clock: each Retry-After wait sleeps the full second

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

  it('7. Kiot permission lost (HTTP 403): Kiot stops, Sapo still finishes', async () => {
    const f = await start(120, { hooks: { kiotLot: (_codes, call) => { if (call === 2) throw Object.assign(new Error('forbidden'), { httpStatus: 403 }); } } });
    const { prepare } = await selectAllAndPrepare();
    const result = await commit(prepare.body.id);
    console.log('S7', summary(result.body));
    expect(f.kiotLots).toBe(2);
    expect(f.writes.kiot.length).toBe(50);
    expect(f.writes.sapo.length).toBe(120);
  });

  it('8. products without a Sapo SKU are listed as errors and not written anywhere', async () => {
    const f = await start(10, { sapoMissing: ['SP000002', 'SP000005'] });
    const { prepare } = await selectAllAndPrepare();
    const result = await commit(prepare.body.id);
    const errors = (await get(`/api/history/updates/${encodeURIComponent(result.body.id)}?page=1&size=10&errorsOnly=true`)).body;
    console.log('S8', summary(result.body), errors.pagination?.items?.map((i: any) => i.code));
    expect(f.writes.kiot).not.toContain('SP000002');
    expect(errors.pagination.items.map((i: any) => i.code).sort()).toEqual(['SP000002', 'SP000005']);
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

  it('11. rollback after the update puts back the old prices on both platforms', async () => {
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

  it('12. products from 600 million without an approved price are not sent', async () => {
    const f = await start(5, { extra: [{ code: 'SP900001', price: 700e6 }] });
    const { selection, prepare } = await selectAllAndPrepare();
    const result = await commit(prepare.body.id);
    console.log('S12', { codes: selection.codes.length, excluded: selection.excludedCodes, ...summary(result.body) });
    expect(f.writes.kiot).not.toContain('SP900001');
    expect(f.writes.kiot.length).toBe(5);
  });

  it('13. second update of the same day skips products already right on both sides', async () => {
    const f = await start(60);
    await commit((await selectAllAndPrepare()).prepare.body.id);
    f.sapos[0].variants[0].price = 35e6;
    const { prepare } = await selectAllAndPrepare();
    const result = await commit(prepare.body.id);
    console.log('S13', summary(result.body), result.body.unchanged, result.body.message);
    expect(prepare.body.unchanged).toBe(59);
    expect(result.body.items.map((i: any) => i.code)).toEqual(['SP000001']);
    expect(f.writes.kiot.length).toBe(60);
    expect(f.writes.sapo.length).toBe(61);
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
    expect(f.writes.sapo.length).toBe(120);
    expect(f.kiot.every((p: any) => p.currentPrice === result.body.items[0].row.price)).toBe(true);
  });
});
