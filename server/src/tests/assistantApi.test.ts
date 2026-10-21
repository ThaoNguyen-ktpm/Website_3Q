import request from 'supertest';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { app } from '../app.js';
import { chat } from '../services/assistant/graph.js';
import { assistantLimiter } from '../routes/assistantRoutes.js';
vi.mock('../config/env.js', () => ({ env: { APP_ORIGIN: 'http://localhost:5173' } }));
vi.mock('../middlewares/requireAuth.js', () => ({ requireAuth: (req: any, res: any, next: any) => {
  if (!req.get('X-Test-User')) return res.status(401).json({ error: { message: 'Bạn chưa đăng nhập.' } });
  res.locals.user = { id: Number(req.get('X-Test-User')), permissions: [] }; next();
} }));
vi.mock('../services/assistant/graph.js', () => ({ chat: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); for (const id of ['1', '2']) assistantLimiter.resetKey(id); vi.mocked(chat).mockResolvedValue({ reply: 'Xin chào', offTopic: false, sources: [] }); vi.stubGlobal('fetch', vi.fn(() => { throw Error('Network forbidden'); })); });
afterEach(() => vi.unstubAllGlobals());
const post = (id = '1') => request(app).post('/api/assistant/chat').set('Origin', 'http://localhost:5173').set('X-Test-User', id).send({ messages: [{ role: 'user', content: 'Chào' }] });
it('requires authentication without requiring extra permission and sends no-store', async () => {
  expect((await request(app).post('/api/assistant/chat').set('Origin', 'http://localhost:5173').send({})).status).toBe(401);
  const result = await post(); expect(result.status).toBe(200); expect(result.headers['cache-control']).toBe('no-store');
  expect(chat).toHaveBeenCalledWith({ messages: [{ role: 'user', content: 'Chào' }] }, []);
});
it('limits by user id and isolates users sharing an IP', async () => {
  for (let i = 0; i < 20; i++) expect((await post()).status).toBe(200);
  const limited = await post(); expect(limited.status).toBe(429); expect(limited.headers['cache-control']).toBe('no-store'); expect((await post('2')).status).toBe(200);
});
it('rejects cross-origin writes before invoking the model', async () => {
  expect((await request(app).post('/api/assistant/chat').set('Origin', 'https://evil.test').send({})).status).toBe(403); expect(chat).not.toHaveBeenCalled();
});
