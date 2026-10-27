'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createProductSearch, configurationStatus } = require('../lib/product-search');
const { parseArgs } = require('../search-products');

const config = {
  kiotviet: { retailer: 'fixture-shop', clientId: 'fixture-id', clientSecret: 'fixture-secret' },
  sapoWeb: { domain: 'fixture-shop.mysapo.net', authType: 'token', accessToken: 'fixture-token' },
};
function response(body, status = 200) { return { ok: status >= 200 && status < 300, status, json: async () => body }; }
function stub(responses) {
  const calls = [];
  return {
    calls,
    fetch: async (url, options) => {
      calls.push({ url: String(url), options });
      if (!responses.length) throw new Error('Unexpected network request');
      return responses.shift();
    },
  };
}
const product = { id: 12, name: 'Chanel', variants: [{ id: 34, sku: 'B01', title: 'Black', price: '1500000', inventory_management: 'bizweb', inventory_quantity: 2 }] };

test('missing keys and unknown POS contract make zero network calls', async () => {
  const transport = stub([]);
  const results = await createProductSearch({}, transport.fetch)({ source: 'all', kind: 'name', query: 'Chanel' });
  assert.deepEqual(results.map(r => r.code), ['missing_config', 'missing_config', 'needs_api_contract']);
  assert.equal(transport.calls.length, 0);
  assert.equal(configurationStatus(config)[0].status, 'configured_not_connected');
  assert.equal(JSON.stringify(configurationStatus(config)).includes('fixture-secret'), false);
});

test('Kiot name search authenticates once, paginates and keeps identifiers', async () => {
  const transport = stub([response({ access_token: 'fixture-bearer', expires_in: 3600 }),
    response({ total: 201, data: [{ id: 1, code: 'B01', name: 'Chanel', basePrice: 10, inventories: [{ onHand: 2 }, { onHand: 3 }] }] }),
    response({ total: 201, data: [] })]);
  const search = createProductSearch(config, transport.fetch);
  const [result] = await search({ source: 'kiotviet', kind: 'name', query: 'Chanel', page: 2 });
  assert.equal(transport.calls[0].options.method, 'POST');
  assert.equal(transport.calls[0].options.body.get('scopes'), 'PublicApi.Access');
  assert.equal(new URL(transport.calls[1].url).searchParams.get('currentItem'), '100');
  assert.equal(transport.calls[1].options.headers.Authorization, 'Bearer fixture-bearer');
  assert.equal(result.items[0].productId, 1);
  assert.equal(result.items[0].onHand, 5);
  assert.equal(result.hasMore, true);
  await search({ source: 'kiotviet', kind: 'name', query: 'Chanel', page: 3 });
  assert.equal(transport.calls.length, 3);
  assert.ok(transport.calls.every(call => call.options.redirect === 'error'));
});

test('exact Kiot SKU rejects a mismatched response and treats 404 as not found', async () => {
  const transport = stub([response({ access_token: 'fixture-bearer' }), response({ id: 1, code: 'b01' })]);
  const [result] = await createProductSearch(config, transport.fetch)({ source: 'kiotviet', kind: 'sku', query: 'B01' });
  assert.equal(result.code, 'invalid_response');
  const missing = stub([response({ access_token: 'fixture-bearer' }), response({}, 404)]);
  const [notFound] = await createProductSearch(config, missing.fetch)({ source: 'kiotviet', kind: 'sku', query: 'B01' });
  assert.deepEqual(notFound.items, []);
  assert.equal(notFound.status, 'ok');
});

test('Sapo Web name search reads products with token and preserves variant ID', async () => {
  const transport = stub([response({ products: [product] })]);
  const [result] = await createProductSearch(config, transport.fetch)({ source: 'sapo-web', kind: 'name', query: 'Chanel' });
  const url = new URL(transport.calls[0].url);
  assert.equal(url.pathname, '/admin/products.json');
  assert.equal(url.searchParams.get('query'), 'Chanel');
  assert.equal(transport.calls[0].options.headers['X-Sapo-Access-Token'], 'fixture-token');
  assert.equal(transport.calls[0].options.method, undefined);
  assert.deepEqual(result.items[0], { source: 'sapo-web', productId: 12, variantId: 34, sku: 'B01', name: 'Chanel — Black', price: 1500000, onHand: 2 });
});

test('Sapo private-app Basic auth keeps credentials out of URL and output', async () => {
  const basicConfig = { sapoWeb: { domain: 'fixture-shop.mysapo.net', authType: 'basic', apiKey: 'fixture-key', apiSecret: 'fixture-secret' } };
  const transport = stub([response({ products: [product] })]);
  const result = await createProductSearch(basicConfig, transport.fetch)({ source: 'sapo-web', kind: 'name', query: 'Chanel' });
  assert.equal(new URL(transport.calls[0].url).username, '');
  assert.equal(transport.calls[0].options.headers.Authorization, `Basic ${Buffer.from('fixture-key:fixture-secret').toString('base64')}`);
  assert.equal(JSON.stringify(result).includes('fixture-secret'), false);
});

test('Sapo exact SKU scan finds matches across pages without merging duplicate SKU', async () => {
  const firstPage = Array.from({ length: 250 }, (_, i) => ({ ...product, id: i, variants: [{ id: i + 1, sku: 'other' }] }));
  firstPage[0] = product;
  const transport = stub([response({ products: firstPage }), response({ products: [product, { ...product, id: 56 }] })]);
  const [result] = await createProductSearch(config, transport.fetch)({ source: 'sapo-web', kind: 'sku', query: 'B01' });
  assert.equal(transport.calls.length, 2);
  assert.equal(new URL(transport.calls[0].url).searchParams.has('query'), false);
  assert.equal(result.items.length, 3);
  assert.equal(result.complete, true);
  assert.equal(result.pagesScanned, 2);
});

test('limited SKU scan reports incomplete even with no matching rows', async () => {
  const page = Array.from({ length: 250 }, () => ({ ...product, variants: [{ id: 34, sku: 'other' }] }));
  const transport = stub([response({ products: page })]);
  const [result] = await createProductSearch(config, transport.fetch)({ source: 'sapo-web', kind: 'sku', query: 'B01', maxPages: 1 });
  assert.equal(result.complete, false);
  assert.deepEqual(result.items, []);
  assert.ok(result.warning);
});

test('bad Sapo domains fail before sending credentials', async () => {
  for (const domain of ['http://shop.mysapo.net', 'shop.mysapo.net.evil.example', 'https://user:secret@shop.mysapo.net', 'https://shop.mysapo.net/admin', '127.0.0.1']) {
    const transport = stub([]);
    const [result] = await createProductSearch({ sapoWeb: { ...config.sapoWeb, domain } }, transport.fetch)({ source: 'sapo-web', kind: 'name', query: 'Chanel' });
    assert.equal(result.code, 'invalid_config');
    assert.equal(transport.calls.length, 0);
  }
});

test('HTTP and transport errors never echo provider response or secret', async () => {
  for (const status of [401, 403, 429, 500]) {
    const transport = stub([response({ message: 'fixture-secret' }, status)]);
    const [result] = await createProductSearch(config, transport.fetch)({ source: 'sapo-web', kind: 'name', query: 'Chanel' });
    assert.equal(result.code, `http_${status}`);
    assert.equal(JSON.stringify(result).includes('fixture-secret'), false);
  }
  const [network] = await createProductSearch(config, async () => { throw new Error('fixture-token'); })({ source: 'sapo-web', kind: 'name', query: 'Chanel' });
  assert.equal(network.code, 'network_error');
  assert.equal(JSON.stringify(network).includes('fixture-token'), false);
});

test('malformed response is an error, not an empty catalog', async () => {
  for (const body of [{}, null, { products: [{ id: null, variants: [] }] }]) {
    const transport = stub([response(body)]);
    const [result] = await createProductSearch(config, transport.fetch)({ source: 'sapo-web', kind: 'name', query: 'Chanel' });
    assert.equal(result.code, 'invalid_response');
  }
});

test('one failed platform does not discard successful platform results', async () => {
  const fetchImpl = async (url) => {
    if (String(url).includes('connect/token')) return response({ access_token: 'fixture-bearer' });
    if (String(url).includes('public.kiotapi.com')) return response({}, 403);
    return response({ products: [product] });
  };
  const results = await createProductSearch(config, fetchImpl)({ source: 'all', kind: 'name', query: 'Chanel' });
  assert.deepEqual(results.map(r => r.status), ['error', 'ok', 'error']);
  assert.equal(results[1].items[0].sku, 'B01');
});

test('invalid CLI options and queries cause no requests', async () => {
  assert.throws(() => parseArgs(['--sku', 'A', '--name', 'B']));
  assert.throws(() => parseArgs(['--source', 'kiotviet', '--source', 'sapo-web']));
  assert.throws(() => parseArgs(['--unknown']));
  const transport = stub([]);
  const search = createProductSearch(config, transport.fetch);
  for (const options of [{ kind: 'name', query: '' }, { kind: 'sku', query: '..' }, { kind: 'sku', query: ' B01' }, { kind: 'name', query: 'A', page: 0 }, { kind: 'name', query: 'A', maxPages: 101 }]) {
    await assert.rejects(() => search(options));
  }
  assert.equal(transport.calls.length, 0);
});

test('name search filters unrelated API rows and unknown stock/price stay null', async () => {
  const transport = stub([response({ access_token: 'fixture-bearer' }), response({ data: [{ id: 1, name: 'Other brand' }, { id: 2, name: 'CHANEL Classic', basePrice: ' ' }] })]);
  const [kiot] = await createProductSearch(config, transport.fetch)({ source: 'kiotviet', kind: 'name', query: 'Chanel' });
  assert.equal(kiot.items.length, 1);
  assert.equal(kiot.items[0].productId, 2);
  assert.equal(kiot.items[0].price, null);
  const webTransport = stub([response({ products: [{ ...product, name: 'Other brand' }, { ...product, variants: [{ ...product.variants[0], inventory_management: null }] }] })]);
  const [web] = await createProductSearch(config, webTransport.fetch)({ source: 'sapo-web', kind: 'name', query: 'Chanel' });
  assert.equal(web.items.length, 1);
  assert.equal(web.items[0].onHand, null);
});
