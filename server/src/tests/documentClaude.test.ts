import Anthropic from '@anthropic-ai/sdk';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { env } from '../config/env.js';
import { documentStore } from '../models/documentStore.js';
import { embed } from '../services/documentEmbeddingService.js';
import { answerWithClaude, askDocuments } from '../services/documentQaGraph.js';

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('@anthropic-ai/sdk', async importOriginal => {
  const sdk = await importOriginal<typeof import('@anthropic-ai/sdk')>();
  return { ...sdk, default: class extends sdk.default { messages = { create }; } };
});
vi.mock('../config/env.js', () => ({ env: { ANTHROPIC_API_KEY: 'test-only-never-sent' } }));
vi.mock('../models/documentStore.js', () => ({ documentStore: { read: vi.fn() } }));
vi.mock('../services/documentEmbeddingService.js', () => ({ embed: vi.fn(async () => [1, 0]) }));
const source = { documentId: 'one', name: 'Nội quy.pdf', page: 2, text: 'Hạn đổi trả là 15 ngày.', excerpt: 'Hạn đổi trả là 15 ngày.' };
beforeEach(() => {
  vi.clearAllMocks(); env.ANTHROPIC_API_KEY = 'test-only-never-sent';
  for (const key of ['LANGSMITH_TRACING', 'LANGCHAIN_TRACING_V2', 'LANGCHAIN_TRACING', 'LANGCHAIN_VERBOSE']) vi.stubEnv(key, '');
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network forbidden'); }));
  create.mockResolvedValue({ stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: 'private' }, { type: 'text', text: '15 ngày, theo Nội quy.pdf trang 2.' }] });
  vi.mocked(documentStore.read).mockResolvedValue([{ id: 'one', name: 'Nội quy.pdf', pages: 2, uploadedAt: '', uploadedBy: '', chunks: [{ text: source.text, page: 2, vector: [1, 0] }] }]);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it('runs the real retrieve → answer graph, cites the page and excludes thinking/vectors', async () => {
  const result = await askDocuments({ question: 'Hạn đổi trả?' });
  expect(result).toEqual({ answer: '15 ngày, theo Nội quy.pdf trang 2.', sources: [{ documentId: 'one', name: 'Nội quy.pdf', page: 2, excerpt: source.text }] });
  expect(embed).toHaveBeenCalledWith('query: Hạn đổi trả?');
  const input = create.mock.calls[0][0];
  expect(input.model).toBe('claude-opus-5-5');
  expect(input.output_config).toEqual({ effort: 'low' });
  expect(input).not.toHaveProperty('thinking');
  expect(input.system[0].cache_control).toEqual({ type: 'ephemeral' });
  expect(JSON.parse(input.messages[0].content).documents).toEqual([{ name: 'Nội quy.pdf', page: 2, text: source.text }]);
});
it.each([429, 500, 503, 529])('sanitizes Anthropic %i as retryable 503', async status => {
  create.mockRejectedValue(new Anthropic.APIError(status, undefined, 'private provider error', new Headers()));
  await expect(answerWithClaude('?', [source])).rejects.toMatchObject({ statusCode: 503, message: 'Claude đang bận. Vui lòng thử lại sau.' });
});
it.each([400, 401, 403])('sanitizes Anthropic %i as 502', async status => {
  create.mockRejectedValue(new Anthropic.APIError(status, undefined, 'private provider error', new Headers()));
  await expect(answerWithClaude('?', [source])).rejects.toMatchObject({ statusCode: 502, message: 'Không thể nhận câu trả lời từ Claude. Vui lòng thử lại.' });
});
it('handles connection failures without exposing the raw error', async () => {
  create.mockRejectedValue(new Error('test-only-never-sent'));
  await expect(answerWithClaude('?', [source])).rejects.toMatchObject({ statusCode: 502, message: 'Không thể nhận câu trả lời từ Claude. Vui lòng thử lại.' });
});
it('uses a polite refusal even when the provider response includes other text', async () => {
  create.mockResolvedValue({ stop_reason: 'refusal', content: [{ type: 'text', text: 'raw refusal' }] });
  expect(await answerWithClaude('?', [source])).toBe('Xin lỗi, tôi không thể trả lời yêu cầu này. Bạn vui lòng thử một câu hỏi khác về tài liệu.');
});
it('preserves an explicit lack-of-information answer from Claude', async () => {
  create.mockResolvedValue({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Tài liệu không có thông tin về việc này.' }] });
  expect((await askDocuments({ question: 'Một câu ngoài tài liệu?' })).answer).toBe('Tài liệu không có thông tin về việc này.');
});
