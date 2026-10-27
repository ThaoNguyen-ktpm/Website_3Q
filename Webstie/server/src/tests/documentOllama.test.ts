import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { env } from '../config/env.js';
import { documentStore } from '../models/documentStore.js';
import { answerWithOllama, askDocuments } from '../services/documentQaGraph.js';

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('@anthropic-ai/sdk', async importOriginal => {
  const sdk = await importOriginal<typeof import('@anthropic-ai/sdk')>();
  return { ...sdk, default: class extends sdk.default { messages = { create }; } };
});
vi.mock('../config/env.js', () => ({ env: { ANTHROPIC_API_KEY: '', LLM_BASE_URL: 'http://localhost:11434', LLM_MODEL: 'qwen3:8b' } }));
vi.mock('../models/documentStore.js', () => ({ documentStore: { read: vi.fn() } }));
vi.mock('../services/documentEmbeddingService.js', () => ({ embed: vi.fn(async () => [1, 0]) }));
const source = { documentId: 'one', name: 'Nội quy.pdf', page: 2, text: 'Hạn đổi trả là 15 ngày.', excerpt: 'Hạn đổi trả là 15 ngày.' };
const reply = (content: string, status = 200) => new Response(JSON.stringify({ message: { role: 'assistant', content } }), { status });
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(env, { ANTHROPIC_API_KEY: '', LLM_BASE_URL: 'http://localhost:11434', LLM_MODEL: 'qwen3:8b' });
  for (const key of ['LANGSMITH_TRACING', 'LANGCHAIN_TRACING_V2', 'LANGCHAIN_TRACING', 'LANGCHAIN_VERBOSE']) vi.stubEnv(key, '');
  fetchMock = vi.fn(async () => reply('<think>\n\n</think>\n15 ngày, theo Nội quy.pdf trang 2.'));
  vi.stubGlobal('fetch', fetchMock);
  vi.mocked(documentStore.read).mockResolvedValue([{ id: 'one', name: 'Nội quy.pdf', pages: 2, uploadedAt: '', uploadedBy: '', chunks: [{ text: source.text, page: 2, vector: [1, 0] }] }]);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it('uses Ollama when no Claude key is set and strips the empty think block', async () => {
  const result = await askDocuments({ question: 'Hạn đổi trả?' });
  expect(result.answer).toBe('15 ngày, theo Nội quy.pdf trang 2.');
  expect(create).not.toHaveBeenCalled();
  const [url, init] = fetchMock.mock.calls[0];
  expect(String(url)).toBe('http://localhost:11434/api/chat');
  const body = JSON.parse(init.body);
  expect(body).toMatchObject({ model: 'qwen3:8b', stream: false, think: false, options: { num_ctx: 8192 } });
  expect(JSON.parse(body.messages[1].content).documents).toEqual([{ name: 'Nội quy.pdf', page: 2, text: source.text }]);
});
it('prefers Claude when a key is set and never calls the local model', async () => {
  env.ANTHROPIC_API_KEY = 'test-only-never-sent';
  create.mockResolvedValue({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Claude trả lời.' }] });
  expect((await askDocuments({ question: 'Hạn đổi trả?' })).answer).toBe('Claude trả lời.');
  expect(fetchMock).not.toHaveBeenCalled();
});
it('keeps the original 503 when neither Claude nor a local model is configured', async () => {
  Object.assign(env, { ANTHROPIC_API_KEY: '', LLM_BASE_URL: undefined });
  await expect(askDocuments({ question: 'Hạn đổi trả?' })).rejects.toMatchObject({ statusCode: 503, message: 'Chưa cấu hình khóa Claude.' });
});
it('maps an unreachable Ollama to a safe 503', async () => {
  fetchMock.mockRejectedValue(new TypeError('fetch failed'));
  await expect(answerWithOllama('?', [source])).rejects.toMatchObject({ statusCode: 503, message: 'Mô hình AI trên máy không phản hồi. Kiểm tra Ollama đã bật chưa.' });
});
it.each([[500, 503], [429, 503], [404, 502]])('maps Ollama HTTP %i to %i', async (status, expected) => {
  fetchMock.mockResolvedValue(reply('', status));
  await expect(answerWithOllama('?', [source])).rejects.toMatchObject({ statusCode: expected });
});
it('falls back to the no-information answer for an empty reply', async () => {
  fetchMock.mockResolvedValue(reply('<think></think>'));
  expect(await answerWithOllama('?', [source])).toBe('Tài liệu không có thông tin phù hợp để trả lời câu hỏi này.');
});
