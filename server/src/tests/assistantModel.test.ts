import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { callModel } from '../services/assistant/model.js';
import { env } from '../config/env.js';
const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('../config/env.js', () => ({ env: { ANTHROPIC_API_KEY: '', LLM_BASE_URL: 'http://local.test', LLM_MODEL: 'qwen3:8b' } }));
vi.mock('@anthropic-ai/sdk', () => { class APIError extends Error { status?: number; } return { default: Object.assign(class { messages = { create }; }, { APIError }) }; });
beforeEach(() => { env.ANTHROPIC_API_KEY = ''; vi.resetAllMocks(); vi.stubGlobal('fetch', vi.fn()); });
afterEach(() => vi.unstubAllGlobals());
it('uses native Ollama tools and normalizes calls, never enabling reasoning', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ message: { content: '<think></think>', tool_calls: [{ function: { name: 'tim_san_pham', arguments: { q: 'SP1', limit: 1 } } }] } })));
  const result = await callModel('system', [{ role: 'user', content: 'SP1?' }], true);
  expect(result.calls[0].name).toBe('tim_san_pham'); expect(result.text).toBe('');
  const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string); expect(body.think).toBe(false); expect(body.options.num_ctx).toBe(8192); expect(body.tools).toHaveLength(6); // 6th tool: tinh_gia (BossTele price calculator, Bảo 2026-10-17)
});
it('prefers Claude and preserves tool ids and grouped tool results', async () => {
  env.ANTHROPIC_API_KEY = 'test-only'; create.mockResolvedValue({ content: [{ type: 'text', text: 'Đã tìm' }], stop_reason: 'end_turn' });
  const result = await callModel('system', [{ role: 'user', content: 'Túi?' }, { role: 'assistant', content: '', calls: [{ id: 'a', name: 'tim_san_pham', arguments: { q: 'tui', limit: 1 } }, { id: 'b', name: 'huong_dan_su_dung', arguments: { chu_de: 'Tìm kiếm' } }] }, { role: 'tool', content: '{}', callId: 'a', name: 'tim_san_pham' }, { role: 'tool', content: '{}', callId: 'b', name: 'huong_dan_su_dung' }], true);
  expect(result.text).toBe('Đã tìm'); expect(fetch).not.toHaveBeenCalled();
  const payload = create.mock.calls[0][0]; expect(payload.model).toBe('claude-opus-5-5'); expect(payload.output_config.effort).toBe('low'); expect(payload.tool_choice.type).toBe('auto'); expect(payload.tools.every((tool: any) => tool.strict)).toBe(true); expect(payload.messages[2].content).toHaveLength(2);
});
it.each([429, 500, 400])('maps Ollama HTTP %s to safe errors', async status => {
  vi.mocked(fetch).mockResolvedValue(new Response('sensitive provider payload', { status }));
  await expect(callModel('system', [{ role: 'user', content: 'Chào' }])).rejects.toMatchObject({ statusCode: status === 400 ? 502 : 503 });
});
it.each(['not json', '{}', '{"message":{"tool_calls":[{"function":{"name":"x","arguments":"broken"}}]}}'])('rejects malformed output without leaking it', async body => {
  vi.mocked(fetch).mockResolvedValue(new Response(body)); await expect(callModel('system', [{ role: 'user', content: 'Chào' }])).rejects.toMatchObject({ statusCode: 502 });
});
it('maps timeouts/network failures to safe 503', async () => {
  vi.mocked(fetch).mockRejectedValue(Error('secret')); await expect(callModel('system', [{ role: 'user', content: 'Chào' }])).rejects.toMatchObject({ statusCode: 503 });
});
