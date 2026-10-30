import request from 'supertest';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { app } from '../app.js';
import { documentStore } from '../models/documentStore.js';
import { documentAskLimiter } from '../routes/documentRoutes.js';
import { env } from '../config/env.js';
import { embed } from '../services/documentEmbeddingService.js';
import * as auditModel from '../models/auditLogModel.js';

// Exercise the router's auth gate without a real account/session/DB.
vi.mock('../middlewares/requireAuth.js', () => ({ requireAuth: (req: any, res: any, next: any) => {
  const role = req.get('X-Test-Role');
  if (!role) return res.status(401).json({ error: { message: 'Bạn chưa đăng nhập.' } });
  res.locals.user = { id: role === 'ADMIN' ? 1 : 2, fullName: 'Bảo', email: 'test@example.test',
    permissions: role === 'ADMIN' ? ['documents.view', 'documents.manage'] : role === 'MANAGER' ? ['documents.view'] : [] };
  next();
} }));
vi.mock('../config/env.js', () => ({ env: { APP_ORIGIN: 'http://localhost:8787', ANTHROPIC_API_KEY: '' } }));
vi.mock('../models/documentStore.js', () => ({ documentStore: { read: vi.fn(), list: vi.fn(), add: vi.fn(), remove: vi.fn() } }));
vi.mock('../models/auditLogModel.js', () => ({ create: vi.fn(async () => ({})), list: vi.fn(), deleteBefore: vi.fn() }));
vi.mock('../services/documentEmbeddingService.js', () => ({ embed: vi.fn(async () => [1, 0]) }));

/** Small in-memory PDF fixture, including xref offsets; no application/demo data. */
function pdfFixture(text = 'BaoQ internal policy') {
  const content = text ? `BT /F1 12 Tf 30 100 Td (${text}) Tj ET` : '';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = '%PDF-1.7\n'; const offsets = [0];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const start = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return Buffer.from(pdf);
}
const metadata = { id: '29001f63-6edf-491c-931c-e22dd7f2ed27', name: 'Nội quy.pdf', pages: 1, uploadedAt: '', uploadedBy: 'Bảo' };
const get = (role?: string) => { const call = request(app).get('/api/documents'); return role ? call.set('X-Test-Role', role) : call; };
const post = (path = '', role = 'ADMIN') => request(app).post(`/api/documents${path}`).set('Origin', 'http://localhost:8787').set('X-Test-Role', role);
const upload = (pdf: Buffer, role = 'ADMIN') => post('', role).set('Content-Type', 'application/pdf').set('X-File-Name', encodeURIComponent('Nội quy.pdf')).send(pdf);

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of ['LANGSMITH_TRACING', 'LANGCHAIN_TRACING_V2', 'LANGCHAIN_TRACING', 'LANGCHAIN_VERBOSE']) vi.stubEnv(key, '');
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network is forbidden in TASK-027 tests'); }));
  env.ANTHROPIC_API_KEY = '';
  vi.mocked(documentStore.read).mockResolvedValue([]);
  vi.mocked(documentStore.list).mockResolvedValue([metadata]);
  vi.mocked(documentStore.add).mockResolvedValue(metadata);
  vi.mocked(documentStore.remove).mockResolvedValue();
  documentAskLimiter.resetKey('1'); documentAskLimiter.resetKey('2');
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it('requires login and enforces view/manage permissions on every endpoint', async () => {
  expect((await get()).status).toBe(401);
  expect((await get('STAFF')).status).toBe(403);
  expect((await get('MANAGER')).body.documents).toEqual([metadata]);
  expect((await upload(Buffer.from('%PDF-'), 'MANAGER')).status).toBe(403);
  expect((await post('/ask', 'STAFF').send({ question: 'Nội quy?' })).status).toBe(403);
  expect((await request(app).delete(`/api/documents/${metadata.id}`).set('Origin', 'http://localhost:8787').set('X-Test-Role', 'MANAGER')).status).toBe(403);
});
it('rejects forged, wrong-type, oversized and malformed PDFs without persistence', async () => {
  expect((await upload(Buffer.from('fake'))).status).toBe(400);
  expect((await post().send({ file: 'fake' })).status).toBe(400);
  expect((await upload(Buffer.alloc(20 * 1024 * 1024 + 1))).status).toBe(400);
  expect((await upload(Buffer.from('%PDF-broken'))).status).toBe(400);
  expect(documentStore.add).not.toHaveBeenCalled();
});
it('extracts a real PDF, preserves page/passage prefix, saves metadata and records upload audit', async () => {
  const result = await upload(pdfFixture());
  expect(result.status).toBe(201);
  expect(result.body.document).toEqual(metadata);
  expect(documentStore.add).toHaveBeenCalledWith(expect.objectContaining({ pages: 1, name: 'Nội quy.pdf', chunks: [expect.objectContaining({ page: 1, text: 'BaoQ internal policy', vector: [1, 0] })] }), expect.any(Buffer));
  expect(embed).toHaveBeenCalledWith('passage: BaoQ internal policy');
  expect(auditModel.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'document.upload', targetId: metadata.id }));
});
it('returns 422 for an image-only/blank PDF and does not embed it', async () => {
  const result = await upload(pdfFixture(''));
  expect(result.status).toBe(422);
  expect(result.body.error.message).toBe('Tài liệu không có văn bản để đọc (có thể là ảnh scan).');
  expect(embed).not.toHaveBeenCalled();
});
it('deletes and records audit without logging document content', async () => {
  const result = await request(app).delete(`/api/documents/${metadata.id}`).set('Origin', 'http://localhost:8787').set('X-Test-Role', 'ADMIN');
  expect(result.status).toBe(204);
  expect(documentStore.remove).toHaveBeenCalledWith(metadata.id);
  expect(auditModel.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'document.delete', targetId: metadata.id, before: undefined, after: undefined }));
});
it('answers an empty library immediately without embedding or Claude configuration', async () => {
  const result = await post('/ask').send({ question: 'Nội quy?' });
  expect(result.status).toBe(200);
  expect(result.body).toEqual({ answer: 'Chưa có tài liệu nào được tải lên.', sources: [] });
  expect(embed).not.toHaveBeenCalled();
});
it('validates question length/type before reading documents', async () => {
  for (const question of ['', ' ', 'a'.repeat(1001), 42]) expect((await post('/ask').send({ question })).status).toBe(400);
  expect(documentStore.read).not.toHaveBeenCalled();
});
it('returns a safe 503 when Claude has no key and does not load embedding', async () => {
  vi.mocked(documentStore.read).mockResolvedValue([{ ...metadata, chunks: [] }]);
  const result = await post('/ask').send({ question: 'Nội quy?' });
  expect(result.status).toBe(503);
  expect(result.body.error.message).toBe('Chưa cấu hình khóa Claude.');
  expect(embed).not.toHaveBeenCalled();
});
it('limits questions by user while allowing a different user on the same IP', async () => {
  for (let i = 0; i < 20; i++) expect((await post('/ask').send({ question: 'Nội quy?' })).status).toBe(200);
  expect((await post('/ask').send({ question: 'Nội quy?' })).status).toBe(429);
  expect((await post('/ask', 'MANAGER').send({ question: 'Nội quy?' })).status).toBe(200);
});
it.each(['LANGSMITH_TRACING', 'LANGCHAIN_TRACING_V2', 'LANGCHAIN_TRACING', 'LANGCHAIN_VERBOSE'])('fails closed before embedding when %s could export/log internal data', async key => {
  env.ANTHROPIC_API_KEY = 'test-only-never-sent';
  vi.mocked(documentStore.read).mockResolvedValue([{ ...metadata, chunks: [] }]);
  vi.stubEnv(key, 'true');
  const result = await post('/ask').send({ question: 'Nội quy?' });
  expect(result.status).toBe(503);
  expect(result.body.error.code).toBe('DOCUMENT_TRACING_DISABLED');
  expect(embed).not.toHaveBeenCalled();
});
