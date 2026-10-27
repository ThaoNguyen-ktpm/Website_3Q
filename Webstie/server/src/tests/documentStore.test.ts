import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { createDocumentStore } from '../models/documentStore.js';

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
it('persists concurrent documents, lists metadata only and deletes the original PDF', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'task027-')); directories.push(directory);
  const store = createDocumentStore(directory);
  const draft = { name: 'Quy định.pdf', pages: 1, uploadedAt: '2026-10-17T00:00:00.000Z', uploadedBy: 'Bảo', chunks: [{ text: 'Đổi trả', page: 1, vector: [1, 0] }] };
  const documents = await Promise.all([store.add(draft, Buffer.from('%PDF-one')), store.add(draft, Buffer.from('%PDF-two'))]);
  expect(await store.list()).toHaveLength(2);
  expect((await store.list())[0]).not.toHaveProperty('chunks');
  expect((await store.read())[0].chunks[0].vector).toEqual([1, 0]);
  await store.remove(documents[0].id);
  await expect(readFile(join(directory, `${documents[0].id}.pdf`))).rejects.toMatchObject({ code: 'ENOENT' });
  expect(await store.list()).toEqual([documents[1]]);
  await expect(store.remove('../../elsewhere')).rejects.toMatchObject({ statusCode: 400 });
  await expect(store.remove(documents[0].id)).rejects.toMatchObject({ statusCode: 404 });
});
