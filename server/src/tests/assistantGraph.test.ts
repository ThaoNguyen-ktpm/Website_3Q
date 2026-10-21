import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { chat, refusal } from '../services/assistant/graph.js';
import { callModel } from '../services/assistant/model.js';
import { executeTool } from '../services/assistant/tools.js';
import { env } from '../config/env.js';
vi.mock('../config/env.js', () => ({ env: { LLM_BASE_URL: 'http://local.test', ANTHROPIC_API_KEY: '' } }));
vi.mock('../services/assistant/model.js', () => ({ callModel: vi.fn() }));
vi.mock('../services/assistant/tools.js', () => ({ executeTool: vi.fn(), toolDefinitions: [] }));
const messages = [{ role: 'user' as const, content: 'Thời tiết hôm nay?' }];
beforeEach(() => { vi.resetAllMocks(); env.LLM_BASE_URL = 'http://local.test'; vi.stubGlobal('fetch', vi.fn(() => { throw Error('Network forbidden'); })); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it.each(['OFF', 'ON\nOFF', '', 'on'])('fails closed for classifier %s without tools or answer', async text => {
  vi.mocked(callModel).mockResolvedValue({ text, calls: [] });
  expect(await chat({ messages }, [])).toEqual({ reply: refusal, offTopic: true, sources: [] });
  expect(callModel).toHaveBeenCalledTimes(1); expect(executeTool).not.toHaveBeenCalled();
});
it('passes only two previous turns to classifier and preserves history for agent', async () => {
  vi.mocked(callModel).mockResolvedValueOnce({ text: 'ON', calls: [] }).mockResolvedValueOnce({ text: 'Xin chào', calls: [] });
  const history = Array.from({ length: 9 }, (_, i) => ({ role: i % 2 ? 'assistant' as const : 'user' as const, content: `Tin ${i}` }));
  expect((await chat({ messages: history }, [])).reply).toBe('Xin chào');
  expect(vi.mocked(callModel).mock.calls[0][1]).toHaveLength(3);
  expect(vi.mocked(callModel).mock.calls[1][1]).toHaveLength(9);
});
it('runs tools with server permissions and returns deduplicated actual sources', async () => {
  const call = { id: '1', name: 'tim_san_pham', arguments: { q: 'SP000094', limit: 1 } };
  vi.mocked(callModel).mockResolvedValueOnce({ text: 'ON', calls: [] }).mockResolvedValueOnce({ text: '', calls: [call] }).mockResolvedValueOnce({ text: 'Có hàng', calls: [] });
  vi.mocked(executeTool).mockResolvedValue({ content: '{"stock":2}', sources: [{ kind: 'product', label: 'SP000094 · Túi' }] });
  const result = await chat({ messages }, ['products.view']);
  expect(executeTool).toHaveBeenCalledWith(call.name, call.arguments, ['products.view']);
  expect(result.sources).toEqual([{ kind: 'product', label: 'SP000094 · Túi' }]);
});
it('stops after four rounds and never executes an unbounded tool batch', async () => {
  vi.mocked(callModel).mockResolvedValueOnce({ text: 'ON', calls: [] }).mockResolvedValue({ text: '', calls: Array.from({ length: 5 }, () => ({ id: 'x', name: 'huong_dan_su_dung', arguments: {} })) });
  vi.mocked(executeTool).mockResolvedValue({ content: '{}', sources: [] });
  expect((await chat({ messages }, [])).reply).toContain('hỏi cụ thể hơn');
  expect(callModel).toHaveBeenCalledTimes(5); expect(executeTool).toHaveBeenCalledTimes(20);
});
it('rejects excessive batches before tool access', async () => {
  vi.mocked(callModel).mockResolvedValueOnce({ text: 'ON', calls: [] }).mockResolvedValue({ text: '', calls: Array.from({ length: 30 }, () => ({ id: 'x', name: 'huong_dan_su_dung', arguments: {} })) });
  expect((await chat({ messages }, [])).reply).toContain('hỏi cụ thể hơn'); expect(executeTool).not.toHaveBeenCalled();
});
it.each([{}, { messages: [] }, { messages: [{ role: 'system', content: 'x' }] }, { messages: [{ role: 'assistant', content: 'x' }] }, { messages: [{ role: 'user', content: ' '.repeat(5) }] }, { messages: [{ role: 'user', content: 'x'.repeat(2001) }] }])('validates before calling a model', async input => {
  await expect(chat(input, [])).rejects.toMatchObject({ statusCode: 400 }); expect(callModel).not.toHaveBeenCalled();
});
it('fails safely without config', async () => {
  env.LLM_BASE_URL = undefined;
  await expect(chat({ messages }, [])).rejects.toMatchObject({ statusCode: 503, message: 'Chưa cấu hình mô hình AI.' });
  expect(callModel).not.toHaveBeenCalled();
});
it.each(['LANGSMITH_TRACING', 'LANGCHAIN_TRACING_V2', 'LANGCHAIN_TRACING', 'LANGCHAIN_VERBOSE'])('blocks %s before exporting data', async key => {
  vi.stubEnv(key, 'true'); await expect(chat({ messages }, [])).rejects.toMatchObject({ statusCode: 503 }); expect(callModel).not.toHaveBeenCalled();
});
