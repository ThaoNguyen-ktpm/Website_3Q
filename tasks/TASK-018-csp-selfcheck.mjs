// Static Vite config checks; does not replace browser CSP verification.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import config from '../client/vite.config.ts';

const dev = config.server.headers;
const preview = config.preview.headers;
const production = readFileSync(new URL('../docs/SECURITY.md', import.meta.url), 'utf8').match(/```text\n([^]+?)\n```/)[1];
assert.equal(preview['Content-Security-Policy'], production);
assert.ok(!production.includes('ws:'));
assert.ok(!production.split(';').find(d => d.includes('script-src')).includes('unsafe-inline'));
assert.ok(dev['Content-Security-Policy'].includes("script-src 'self' 'unsafe-inline'"));
assert.ok(dev['Content-Security-Policy'].includes('ws://localhost:5173'));
for (const headers of [dev, preview]) {
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
  assert.equal(headers['X-Frame-Options'], 'DENY');
}
console.log('PASS: dev/preview headers, dev-only script/HMR exceptions, production CSP matches SECURITY.md');
