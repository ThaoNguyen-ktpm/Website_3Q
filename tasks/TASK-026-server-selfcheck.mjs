// No database or provider calls; supplements (does not replace) the HTTP/Vitest suite.
import assert from 'node:assert/strict';
import { catalogStore, createCatalogStore, parseProductsQuery } from '../server/dist/services/catalogStore.js';
import { getCatalogProducts, syncCatalogProducts } from '../server/dist/controllers/catalogController.js';
import { catalogRouter } from '../server/dist/routes/catalogRoutes.js';
import { requirePermission } from '../server/dist/middlewares/requirePermission.js';

const row = (source, sku, id = 1) => ({ source, sku, productId: id, variantId: source === 'kiotviet' ? null : id, name: 'Túi Chanel Đen', price: source === 'kiotviet' ? 10 : 20, onHand: 2, detail: { images: source === 'kiotviet' ? [] : ['https://image.test/a'], createdDate: '2026-01-01', createdOn: '2026-02-01', inventories: [{ branchId: 1, cost: 8 }] } });
const ok = (source, items = [row(source, 'SKU')]) => ({ source, status: 'ok', complete: true, items });
const q = (text = '', page = 1, pageSize = 20) => parseProductsQuery({ q: text, page, pageSize });
assert.deepEqual(parseProductsQuery({}), { q: '', page: 1, pageSize: 20 });
for (const input of [{ q: 'a'.repeat(201) }, { q: ['a'] }, { page: '0' }, { page: '1.5' }, { page: '' }, { page: '9007199254740992' }, { pageSize: 25 }]) assert.throws(() => parseProductsQuery(input), error => error.statusCode === 400);
for (const size of [15, 20, 30, 50, 100]) assert.equal(parseProductsQuery({ pageSize: String(size) }).pageSize, size);
const store = createCatalogStore({ fetchAll: async source => ok(source, [row(source, source === 'kiotviet' ? ' sku ' : 'SKU'), row(source, '', 2), row(source, source, 3)]) });
const merged = await store.products(q(), false);
assert.equal(merged.total, 5); assert.equal(new Set(merged.items.map(item => item.key)).size, 5);
const shared = merged.items.find(item => item.sources.length === 2);
assert.equal(shared.price, 10); assert.equal(shared.image, 'https://image.test/a'); assert.equal(shared.createdAt, '2026-01-01');
assert.equal(merged.items[0].createdAt, '2026-02-01'); assert.ok(!JSON.stringify(merged).includes('"cost"'));
assert.equal((await store.products(q('sku'), true)).items[0].kiot.inventories[0].cost, 8);
assert.equal((await store.products(q('tui chanel den'), false)).total, 5);
assert.equal((await store.products(q('missing', 999), false)).page, 1);
const many = createCatalogStore({ fetchAll: async source => ok(source, source === 'kiotviet' ? Array.from({ length: 31 }, (_, i) => row(source, `SKU${i}`, i)) : []) });
assert.deepEqual((( { page, pageCount, total, items }) => [page, pageCount, total, items.length])(await many.products(q('', 999, 15), false)), [3, 3, 31, 1]);
let time = 0, calls = 0;
const pending = [];
const cached = createCatalogStore({ now: () => time, fetchAll: source => { calls++; return new Promise(resolve => pending.push({ source, resolve })); } });
const a = cached.products(q(), false), b = cached.products(q(), false);
assert.equal(calls, 2);
pending.splice(0).forEach(({ source, resolve }) => resolve(ok(source, [row(source, source)])));
assert.equal((await a).total, 2); await b;
time = 600001;
assert.equal((await cached.products(q(), false)).syncing, true); assert.equal(calls, 4);
const joined = cached.sync();
pending.splice(0).forEach(({ source, resolve }) => resolve(source === 'kiotviet' ? { source, status: 'error', items: [], message: 'PRIVATE' } : ok(source, [row(source, 'new')])));
await joined;
const stale = await cached.products(q(), false);
assert.equal(stale.total, 2); assert.equal(stale.sources.kiotviet.status, 'error'); assert.ok(!JSON.stringify(stale).includes('PRIVATE'));
let round = 0;
const partial = createCatalogStore({ fetchAll: async source => {
  if (!round) return ok(source);
  if (source === 'kiotviet') throw new Error('PRIVATE');
  return { ...ok(source, [row(source, 'partial')]), complete: false };
} });
await partial.products(q(), false); round++; await partial.sync();
assert.equal((await partial.products(q(), false)).items[0].sku, 'SKU');
time = 0;
const cooldown = createCatalogStore({ now: () => time, fetchAll: async source => ok(source) });
const first = cooldown.forceSync();
await assert.rejects(cooldown.forceSync(), error => error.statusCode === 429);
assert.ok(!('items' in await first));
time = 59999; await assert.rejects(cooldown.forceSync(), error => error.statusCode === 429);
time = 60000; await cooldown.forceSync();
let failBoth = false;
const failureClock = createCatalogStore({ now: () => time, fetchAll: async source => {
  if (failBoth) throw new Error('PRIVATE');
  return ok(source);
} });
const successTime = (await failureClock.products(q(), false)).syncedAt;
failBoth = true; time += 60000; await failureClock.sync();
assert.equal((await failureClock.products(q(), false)).syncedAt, successTime, 'failed attempts must not replace successful sync time');
// Invoke the real controllers with request/response doubles (not an HTTP test).
const originalProducts = catalogStore.products, originalSync = catalogStore.forceSync;
const headers = {}, response = { locals: { user: { permissions: ['products.view'] } }, set: (key,value) => { headers[key] = value; }, json: value => { response.body = value; } };
let received, denied;
try {
  catalogStore.products = async (query, cost) => { received = { query, cost }; return { items: [] }; };
  await getCatalogProducts({ query: {} }, response, error => { throw error; });
  assert.deepEqual(received, { query: { q: '', page: 1, pageSize: 20 }, cost: false });
  assert.equal(headers['Cache-Control'],'no-store');
  response.locals.user.permissions.push('products.cost');
  await getCatalogProducts({ query: { q: 'SKU' } }, response, error => { throw error; }); assert.equal(received.cost,true);
  await getCatalogProducts({ query: { page: '0' } }, response, error => { denied = error; }); assert.equal(denied.statusCode,400);
  catalogStore.forceSync = async () => ({ syncing:false,total:5,sources:{} });
  await syncCatalogProducts({},response,error=>{throw error;}); assert.ok(!('items' in response.body));
  requirePermission('products.view')({}, { locals: { user: { permissions: [] } } }, error => { denied = error; }); assert.equal(denied.statusCode,403);
  assert.deepEqual(catalogRouter.stack.map(layer=>[layer.route.path,Object.keys(layer.route.methods)[0]]),[['/search','get'],['/products','get'],['/sync','post']]);
} finally { catalogStore.products = originalProducts; catalogStore.forceSync = originalSync; }
console.log('TASK-026 server selfcheck passed: validation, merge, blanks, sort, accent folding, paging, cost isolation, parallel/single-flight/stale refresh, retained failed/incomplete sources and cooldown. No HTTP or live-provider verification.');
