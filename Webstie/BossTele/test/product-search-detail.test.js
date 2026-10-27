'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createProductSearch } = require('../lib/product-search');
const config = { kiotviet: { retailer: 'test', clientId: 'test', clientSecret: 'test' }, sapoWeb: { domain: 'test.mysapo.net', authType: 'token', accessToken: 'test' } };
const response = data => ({ ok: true, json: async () => data });

test('detail Kiot is opt-in, whitelists fields and normalizes inventory and HTTPS images', async () => {
  const product = { id: 1, code: 'SKU', name: 'Chanel', basePrice: 10, privateKey: 'hidden', images: ['https://images.test/a', 'http://bad.test/a', 'javascript:bad'], attributes: [{ attributeName: 'Màu', attributeValue: 'Đen', secret: true }], inventories: [{ branchId: 2, branchName: 'Kho', onHand: '3', reserved: '1', cost: '5', privateKey: 'hidden' }] };
  const search = createProductSearch(config, async url => response(String(url).includes('connect/token') ? { access_token: 'test', expires_in: 3600 } : { data: [product], total: 1 }));
  const query = { source: 'kiotviet', kind: 'name', query: 'Chanel' };
  const [plain] = await search(query);
  assert.equal('detail' in plain.items[0], false);
  const [rich] = await search({ ...query, detail: true });
  assert.deepEqual(rich.items[0].detail.images, ['https://images.test/a']);
  assert.deepEqual(rich.items[0].detail.attributes, [{ name: 'Màu', value: 'Đen' }]);
  assert.deepEqual(rich.items[0].detail.inventories, [{ branchId: 2, branchName: 'Kho', onHand: 3, reserved: 1, cost: 5 }]);
  assert.equal(rich.items[0].detail.modifiedDate, null);
  assert.equal(JSON.stringify(rich).includes('hidden'), false);
});

test('detail Sapo puts variant image first, deduplicates, maps options and tags', async () => {
  const product = { id: 1, name: 'Chanel', content: '<p>Mô tả</p>', tags: 'bag, black, ', options: [{ name: 'Màu', position: 1 }], images: [{ id: 8, src: 'https://images.test/product' }, { id: 9, src: 'https://images.test/variant' }, { src: 'data:bad' }], variants: [{ id: 2, sku: 'SKU', image_id: 9, option1: 'Đen', compare_at_price: '20', price: '10', barcode: '123' }] };
  const search = createProductSearch(config, async () => response({ products: [product] }));
  const [result] = await search({ source: 'sapo-web', kind: 'name', query: 'Chanel', detail: true });
  const detail = result.items[0].detail;
  assert.deepEqual(detail.images, ['https://images.test/variant', 'https://images.test/product']);
  assert.deepEqual(detail.options, [{ name: 'Màu', value: 'Đen' }]);
  assert.deepEqual(detail.tags, ['bag', 'black']);
  assert.equal(detail.compareAtPrice, 20);
  assert.equal(detail.description, '<p>Mô tả</p>');
  assert.equal(detail.createdOn, null);
});

test('detail also reaches exact SKU paths without adding endpoints', async () => {
  const calls = [];
  const search = createProductSearch(config, async url => {
    calls.push(String(url));
    return response(String(url).includes('connect/token') ? { access_token: 'test' } : { id: 1, code: 'SKU', name: 'Chanel' });
  });
  const [result] = await search({ source: 'kiotviet', kind: 'sku', query: 'SKU', detail: true });
  assert.equal(result.items[0].detail.name, 'Chanel');
  assert.equal(calls.length, 2);
  assert.ok(calls[1].endsWith('/products/code/SKU'));
});

test('Kiot detail keeps categoryId and whether Kiot reports any tax (shared with Sale AI)', async () => {
  const { createCatalogFetcher } = require('../lib/product-search');
  const page = products => ({ ok: true, status: 200, json: async () => ({ total: products.length, data: products }) });
  const calls = [];
  const fetchImpl = async url => {
    calls.push(String(url));
    if (String(url).includes('/connect/token')) return { ok: true, status: 200, json: async () => ({ access_token: 't', expires_in: 3600 }) };
    return page([{ id: 1, code: 'SP1', name: 'A', basePrice: 1, categoryId: 7, taxRate: 10, inventories: [] }, { id: 2, code: 'SP2', name: 'B', basePrice: 1, inventories: [] }]);
  };
  const config = { kiotviet: { retailer: 'r', clientId: 'c', clientSecret: 's', baseUrl: 'https://public.kiotapi.com', tokenUrl: 'https://id.kiotviet.vn/connect/token' } };
  const result = await createCatalogFetcher(config, fetchImpl)('kiotviet');
  assert.deepEqual(result.items.map(item => [item.detail.categoryId, item.detail.taxPresent]), [[7, true], [null, false]]);
});
