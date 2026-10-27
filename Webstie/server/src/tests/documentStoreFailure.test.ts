import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createDocumentStore } from '../models/documentStore.js';

const fault = vi.hoisted(() => ({ failIndexCommit: false }));
vi.mock('node:fs/promises', async importOriginal => {
  const fs = await importOriginal<typeof import('node:fs/promises')>();
  return { ...fs, rename: async (from: string, to: string) => {
    if (fault.failIndexCommit && to.endsWith('index.json')) throw new Error('disk write failed');
    return fs.rename(from, to);
  } };
});
let directory = '';
beforeEach(async () => { fault.failIndexCommit = false; directory = await mkdtemp(join(tmpdir(), 'task027-failure-')); });
afterEach(async () => { await rm(directory, { recursive: true, force: true }); });
const draft = { name: 'Nội quy.pdf', pages: 1, uploadedAt: '2026-10-17T00:00:00.000Z', uploadedBy: 'Bảo', chunks: [{ text: 'Nội quy', page: 1, vector: [1, 0] }] };
it('rolls back a failed upload index commit and keeps the old index and PDF', async () => {
  const store = createDocumentStore(directory);
  const first = await store.add(draft, Buffer.from('%PDF-original'));
  const before = await readFile(join(directory, 'index.json'), 'utf8');
  fault.failIndexCommit = true;
  await expect(store.add(draft, Buffer.from('%PDF-new'))).rejects.toThrow('disk write failed');
  expect(await readFile(join(directory, 'index.json'), 'utf8')).toBe(before);
  expect((await readdir(directory)).sort()).toEqual([`${first.id}.pdf`, 'index.json'].sort());
});
it('restores the PDF after a failed delete index commit and accepts the next mutation', async () => {
  const store = createDocumentStore(directory);
  const first = await store.add(draft, Buffer.from('%PDF-original'));
  fault.failIndexCommit = true;
  await expect(store.remove(first.id)).rejects.toThrow('disk write failed');
  expect(await store.list()).toEqual([first]);
  expect(await readFile(join(directory, `${first.id}.pdf`), 'utf8')).toBe('%PDF-original');
  fault.failIndexCommit = false;
  await store.remove(first.id);
  expect(await store.list()).toEqual([]);
});
it('refuses to overwrite an unreadable index', async () => {
  const store = createDocumentStore(directory);
  await writeFile(join(directory, 'index.json'), '{broken');
  await expect(store.add(draft, Buffer.from('%PDF-new'))).rejects.toMatchObject({ statusCode: 503 });
  expect(await readFile(join(directory, 'index.json'), 'utf8')).toBe('{broken');
});
it.each(['null', '{}', '[{"id":"unsafe"}]'])('rejects a parseable but invalid index: %s', async contents => {
  const store = createDocumentStore(directory);
  await writeFile(join(directory, 'index.json'), contents);
  await expect(store.read()).rejects.toMatchObject({ statusCode: 503 });
  await expect(store.add(draft, Buffer.from('%PDF-new'))).rejects.toMatchObject({ statusCode: 503 });
  expect(await readFile(join(directory, 'index.json'), 'utf8')).toBe(contents);
});
