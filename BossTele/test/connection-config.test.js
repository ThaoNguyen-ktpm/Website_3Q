'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadConnectionConfig, configFromEnv } = require('../lib/connection-config');

function temporaryRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bosstele-env-test-'));
  t.after(() => { fs.unlinkSync(path.join(root, '.env')); fs.rmdirSync(root); });
  return root;
}

test('loads exact user variable names, BOM, comments and quoted secrets without evaluation', t => {
  const root = temporaryRoot(t);
  fs.writeFileSync(path.join(root, '.env'), '\uFEFFKIOT_RETAILER=baoqluxury\r\nKIOT_CLIENT_ID=fixture-id\r\nKIOT_CLIENT_SECRET="fixture#secret$()"\r\nSAPO_SHOP=baoqluxury.mysapo.net\r\nSAPO_API_KEY=fixture-key\r\nSAPO_API_SECRET=fixture-password # comment\r\n');
  const config = loadConnectionConfig(root, { KIOT_CLIENT_SECRET: 'unrelated-process-secret' });
  assert.equal(config.kiotviet.retailer, 'baoqluxury');
  assert.equal(config.kiotviet.clientId, 'fixture-id');
  assert.equal(config.kiotviet.clientSecret, 'fixture#secret$()');
  assert.equal(config.sapoWeb.authType, 'basic');
  assert.equal(config.sapoWeb.apiKey, 'fixture-key');
  assert.equal(config.sapoWeb.apiSecret, 'fixture-password');
});

test('existing .env does not fill blank credentials from process env', t => {
  const root = temporaryRoot(t);
  fs.writeFileSync(path.join(root, '.env'), 'KIOT_RETAILER=baoqluxury\nKIOT_CLIENT_SECRET=\n');
  const config = loadConnectionConfig(root, { KIOT_CLIENT_SECRET: 'other-shop-secret', SAPO_API_KEY: 'other-shop-key' });
  assert.equal(config.kiotviet.clientSecret, '');
  assert.equal(config.sapoWeb.apiKey, '');
});

test('optional Sapo OAuth token selects token auth', () => {
  const config = configFromEnv({ SAPO_SHOP: 'fixture.mysapo.net', SAPO_ACCESS_TOKEN: 'fixture-token' });
  assert.equal(config.sapoWeb.authType, 'token');
  assert.equal(config.sapoWeb.accessToken, 'fixture-token');
});
