// Run: node --experimental-transform-types tasks/TASK-027-selfcheck.mjs
// Fallback for the sandbox: execute real source without Vitest/esbuild child processes.
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve, sep } from 'node:path';

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.endsWith('.js') && context.parentURL?.includes('/server/src/')) {
    const candidate = new URL(specifier.replace(/\.js$/, '.ts'), context.parentURL);
    if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
  }
  return nextResolve(specifier, context);
} });
globalThis.fetch = () => { throw new Error('Network forbidden in selfcheck'); };
const { createDocumentStore } = await import('../server/src/models/documentStore.ts');
const { chunkPages, validatePdf } = await import('../server/src/services/documentIngestService.ts');
const { retrieveChunks } = await import('../server/src/services/documentRetrievalService.ts');
const { rolePermissions } = await import('../server/src/config/permissions.ts');
const base = fileURLToPath(new URL('./', import.meta.url));
const directory = await mkdtemp(join(base, '.task027-check-'));
try {
  const store = createDocumentStore(directory);
  const draft = { name: 'Nội quy.pdf', pages: 2, uploadedAt: '2026-10-17T00:00:00.000Z', uploadedBy: 'Bảo', chunks: [{ text: 'Đổi trả trong 15 ngày.', page: 2, vector: [1, 0] }] };
  const items = await Promise.all([store.add(draft, Buffer.from('%PDF-one')), store.add(draft, Buffer.from('%PDF-two'))]);
  assert.equal((await store.list()).length, 2);
  assert.equal('chunks' in (await store.list())[0], false);
  assert.deepEqual((await store.read())[0].chunks[0].vector, [1, 0]);
  assert.equal(await readFile(join(directory, `${items[0].id}.pdf`), 'utf8'), '%PDF-one');
  await store.remove(items[0].id);
  assert.deepEqual(await store.list(), [items[1]]);
  await assert.rejects(store.remove('../outside'), { statusCode: 400 });
  await assert.rejects(store.remove(items[0].id), { statusCode: 404 });
  const stored = await store.read();
  assert.deepEqual(retrieveChunks(stored, [1, 0]).map(({ name, page, excerpt }) => ({ name, page, excerpt })), [{ name: 'Nội quy.pdf', page: 2, excerpt: 'Đổi trả trong 15 ngày.' }]);
  assert.deepEqual(retrieveChunks(stored, [0, 0]), []);
  const candidates = [{ ...stored[0], chunks: [{ text: 'wrong', page: 1, vector: [100, 100] }, ...Array.from({ length: 6 }, (_, i) => ({ text: 'a'.repeat(250), page: i + 2, vector: [1, 0] }))] }];
  assert.deepEqual(retrieveChunks(candidates, [1, 0]).map(chunk => chunk.page), [2, 3, 4, 5, 6, 7]);
  assert.equal(retrieveChunks(candidates, [1, 0])[0].excerpt.length, 200);
  assert.deepEqual(chunkPages(['', 'a'.repeat(1100)]), [{ text: 'a'.repeat(1000), page: 2 }, { text: 'a'.repeat(250), page: 2 }]);
  assert.throws(() => chunkPages([' ', '\n']), { statusCode: 422 });
  assert.equal(validatePdf(Buffer.from('%PDF-1.7'), encodeURIComponent('Nội quy.pdf')), 'Nội quy.pdf');
  for (const [pdf, name] of [[Buffer.from('fake'), 'a.pdf'], [Buffer.alloc(20 * 1024 * 1024 + 1), 'a.pdf'], [Buffer.from('%PDF-1.7'), '%ZZ'], [Buffer.from('%PDF-1.7'), '..%2Fsecret.pdf']]) assert.throws(() => validatePdf(pdf, name), { statusCode: 400 });
  assert.ok(rolePermissions.ADMIN.includes('documents.manage'));
  assert.ok(rolePermissions.MANAGER.includes('documents.view'));
  assert.ok(!rolePermissions.MANAGER.includes('documents.manage'));
  assert.ok(!rolePermissions.STAFF.includes('documents.view'));
  await writeFile(join(directory, 'index.json'), '{broken');
  await assert.rejects(store.add(draft, Buffer.from('%PDF-new')), { statusCode: 503 });
  assert.equal(await readFile(join(directory, 'index.json'), 'utf8'), '{broken');
  for (const contents of ['null', '{}', '[{"id":"unsafe"}]']) {
    await writeFile(join(directory, 'index.json'), contents);
    await assert.rejects(store.read(), { statusCode: 503 });
    await assert.rejects(store.add(draft, Buffer.from('%PDF-new')), { statusCode: 503 });
    assert.equal(await readFile(join(directory, 'index.json'), 'utf8'), contents);
  }
  assert.deepEqual((await readdir(directory)).sort(), [`${items[1].id}.pdf`, 'index.json'].sort());
  console.log('PASS: local store/concurrent writes/delete, invalid index, PDF validation, page chunks, cosine/top6, excerpts and default permissions. No network or DB queries.');
} finally {
  const target = resolve(directory);
  assert.ok(target.startsWith(resolve(base) + sep) && target.includes('.task027-check-'));
  await rm(target, { recursive: true, force: true });
}
