'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createCatalogFetcher } = require('../lib/product-search');
const config = { kiotviet: { retailer: 'test', clientId: 'test', clientSecret: 'test' }, sapoWeb: { domain: 'test.mysapo.net', authType: 'token', accessToken: 'test' } };
const response = data => ({ ok: true, json: async () => data });
const kiot = id => ({ id, code: `SKU${id}`, name: 'Túi', inventories: [{ cost: 5 }], secret: 'PRIVATE' });
const sapo = id => ({ id, name: 'Túi', variants: [{ id, sku: `SKU${id}` }] });

test('fetches all Kiot pages sequentially with detail whitelist and cached OAuth', async () => {
  const calls = [];
  const fetchAll = createCatalogFetcher(config, async (input, options) => {
    const url = new URL(input); calls.push({ url, options });
    if (url.pathname.includes('token')) return response({ access_token: 'test', expires_in: 3600 });
    const offset = Number(url.searchParams.get('currentItem'));
    return response({ data: Array.from({ length: offset ? 1 : 100 }, (_, i) => kiot(offset + i)), total: 101 });
  });
  const result = await fetchAll('kiotviet');
  assert.equal(result.complete, true); assert.equal(result.items.length, 101);
  assert.equal(result.items[0].detail.inventories[0].cost, 5);
  assert.ok(!JSON.stringify(result).includes('PRIVATE'));
  assert.equal(calls.length, 3);
  assert.equal(calls[2].url.searchParams.get('currentItem'), '100');
  for (const { url, options } of calls.slice(1)) {
    assert.equal(options.method || 'GET', 'GET');
    assert.equal(url.searchParams.get('pageSize'), '100');
    assert.equal(url.searchParams.get('includeInventory'), 'true');
    assert.equal(url.searchParams.get('orderBy'), 'createdDate');
    assert.equal(url.searchParams.get('orderDirection'), 'Desc');
  }
  await fetchAll('kiotviet');
  assert.equal(calls.filter(({ url }) => url.pathname.includes('token')).length, 1);
});
test('Sapo paginates products rather than variants until a short page', async () => {
  const pages = [];
  const result = await createCatalogFetcher(config, async input => {
    const url = new URL(input), page = Number(url.searchParams.get('page')); pages.push(page);
    assert.equal(url.searchParams.get('limit'), '250');
    return response({ products: Array.from({ length: page === 1 ? 250 : 1 }, (_, i) => sapo(page * 1000 + i)) });
  })('sapo-web');
  assert.deepEqual(pages, [1, 2]); assert.equal(result.items.length, 251); assert.equal(result.complete, true);
});
test('both sources stop at 200 pages and report incomplete', async () => {
  for (const source of ['kiotviet', 'sapo-web']) {
    let pages = 0;
    const result = await createCatalogFetcher(config, async input => {
      if (String(input).includes('connect/token')) return response({ access_token: 'test' });
      pages++;
      return response(source === 'kiotviet' ? { data: Array.from({ length: 100 }, (_, i) => kiot(pages * 100 + i)), total: 20001 } : { products: Array.from({ length: 250 }, (_, i) => sapo(pages * 250 + i)) });
    })(source);
    assert.equal(pages, 200); assert.equal(result.complete, false);
  }
});
test('source errors discard partial pages, do not retry or expose credentials, other source still works', async () => {
  let attempts = 0;
  const fetchAll = createCatalogFetcher(config, async input => {
    if (String(input).includes('connect/token')) return response({ access_token: 'test' });
    if (String(input).includes('kiotapi')) { attempts++; throw new Error('PRIVATE'); }
    return response({ products: [sapo(1)] });
  });
  const [failed, good] = await Promise.all([fetchAll('kiotviet'), fetchAll('sapo-web')]);
  assert.equal(failed.status, 'error'); assert.deepEqual(failed.items, []); assert.equal(attempts, 1);
  assert.ok(!JSON.stringify(failed).includes('PRIVATE')); assert.equal(good.items.length, 1);
});
test('rejects malformed pagination and premature empty Kiot pages', async () => {
  for (const data of [{ data: [], total: 10 }, { data: [kiot(1)], total: -1 }, { data: [kiot(1)] }, { data: null, total: 1 }]) {
    const result = await createCatalogFetcher(config, async input => response(String(input).includes('token') ? { access_token: 'test' } : data))('kiotviet');
    assert.equal(result.status, 'error'); assert.deepEqual(result.items, []);
  }
});
test('Sapo supplies a credential-free storefront link only for a valid alias', async () => {
  const result = await createCatalogFetcher(config, async () => response({ products: [
    { ...sapo(1), alias: 'tui-chanel' }, { ...sapo(2), alias: '//untrusted.test' },
  ] }))('sapo-web');
  assert.equal(result.items[0].detail.webUrl, 'https://test.mysapo.net/tui-chanel');
  assert.equal(result.items[1].detail.webUrl, null);
});
test('empty catalogs complete successfully and a second-page failure discards partial items', async () => {
  const empty = createCatalogFetcher(config, async input => response(String(input).includes('token') ? { access_token: 'test' } : String(input).includes('kiotapi') ? { data: [], total: 0 } : { products: [] }));
  for (const source of ['kiotviet', 'sapo-web']) {
    const result = await empty(source); assert.equal(result.complete, true); assert.deepEqual(result.items, []);
  }
  let calls = 0;
  const failed = await createCatalogFetcher(config, async () => {
    calls++;
    return calls === 1 ? response({ products: Array.from({ length: 250 }, (_, i) => sapo(i)) }) : { ok: false, status: 429 };
  })('sapo-web');
  assert.equal(calls, 2); assert.equal(failed.code, 'http_429'); assert.deepEqual(failed.items, []);
});
