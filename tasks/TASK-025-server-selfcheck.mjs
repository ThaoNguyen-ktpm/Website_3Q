// Supplementary checks when the sandbox cannot start Vitest workers. No DB or network.
import assert from 'node:assert/strict';
import { createCatalogSearch, parseCatalogQuery } from '../server/dist/services/catalogSearchService.js';
import { getCatalogSearch } from '../server/dist/controllers/catalogController.js';
import { requirePermission } from '../server/dist/middlewares/requirePermission.js';
import { rolePermissions } from '../server/dist/config/permissions.js';

const query = parseCatalogQuery({ q: ' Chanel ' });
assert.deepEqual(query, { q: 'Chanel', kind: 'name', source: 'all', page: 1 });
for (const input of [{}, { q: '' }, { q: ['a', 'b'] }, { q: 'a', source: 'sapo-pos' }, { q: 'a', kind: 'bad' }, ...['', '0', '1.5', 'Infinity', '9007199254740992'].map(page => ({ q: 'a', page })), { q: 'a'.repeat(201) }]) {
  assert.throws(() => parseCatalogQuery(input), error => error.statusCode === 400 && error.code === 'VALIDATION_ERROR');
}
let initialized = 0;
const calls = [];
const item = { source: 'kiotviet', name: 'Chanel', productId: 1, variantId: null, sku: 'SKU', price: 10, onHand: 2, detail: { inventories: [{ branchId: 1, branchName: 'Kho', onHand: 2, reserved: 1, cost: 8 }] } };
const service = createCatalogSearch({ loadConfig: () => ({}), createSearch: () => {
  initialized++;
  return async options => { calls.push(options); return [{ source: options.source, status: 'ok', items: [item], hasMore: true, nextPage: 21, warning: 'Chưa quét hết' }]; };
} });
const hidden = await service(query, false);
assert.equal(JSON.stringify(hidden).includes('"cost"'), false);
assert.equal(item.detail.inventories[0].cost, 8);
assert.deepEqual(calls.map(call => call.source), ['kiotviet', 'sapo-web']);
assert.ok(calls.every(call => call.detail === true));
assert.equal((await service(query, true)).results[0].items[0].detail.inventories[0].cost, 8);
assert.equal(initialized, 1);
await service({ ...query, source: 'sapo-web', kind: 'sku', page: 21 }, false);
assert.equal(calls.at(-1).startPage, 21);
const failed = createCatalogSearch({ loadConfig: () => { throw new Error('PRIVATE'); }, createSearch: () => { throw new Error('Must not initialize'); } });
const errors = await failed(query, false);
assert.deepEqual(errors.results.map(result => result.status), ['error', 'error']);
assert.ok(!JSON.stringify(errors).includes('PRIVATE'));
const partial = createCatalogSearch({ loadConfig: () => ({}), createSearch: () => async ({ source }) => {
  if (source === 'kiotviet') throw new Error('PRIVATE');
  return [{ source, status: 'ok', items: [item] }];
} });
assert.deepEqual((await partial(query, false)).results.map(result => result.status), ['error', 'ok']);
const missing = createCatalogSearch({ loadConfig: () => ({}), createSearch: () => async ({ source }) => [{ source, status: source === 'kiotviet' ? 'error' : 'ok', items: source === 'kiotviet' ? [] : [item], code: source === 'kiotviet' ? 'missing_config' : undefined }] });
const available = await missing(query, false);
assert.equal(available.results[0].code, 'missing_config');
assert.equal(available.results[1].items.length, 1);
assert.ok(rolePermissions.ADMIN.includes('products.cost'));
assert.ok(!rolePermissions.MANAGER.includes('products.cost'));
assert.ok(!rolePermissions.STAFF.includes('products.cost'));
let denial;
requirePermission('products.view')({}, { locals: { user: { permissions: [] } } }, error => { denial = error; });
assert.equal(denial.statusCode, 403);
let validation;
await getCatalogSearch({ query: { q: '' } }, {}, error => { validation = error; });
assert.equal(validation.statusCode, 400);
console.log('TASK-025 server selfcheck: validation, singleton, two sources only, cost stripping, independent errors, SKU continuation and permission defaults passed. Not a replacement for the HTTP/Vitest suite.');
