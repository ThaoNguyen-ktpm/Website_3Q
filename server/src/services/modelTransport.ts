import type { MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages';
import { env } from '../config/env.js';
import { ApiError } from '../middlewares/errorHandler.js';

/** Shared provider transport; callers retain their own prompts and response fallbacks. */
export async function sendClaude(params: MessageCreateParamsNonStreaming) {
  if (!env.ANTHROPIC_API_KEY) throw new ApiError(503, 'CLAUDE_NOT_CONFIGURED', 'Chưa cấu hình khóa Claude.');
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  try {
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 60_000, maxRetries: 0 });
    return await client.messages.create(params);
  } catch (error) {
    if (error instanceof Anthropic.APIError && (error.status === 429 || (error.status !== undefined && error.status >= 500))) {
      throw new ApiError(503, 'CLAUDE_UNAVAILABLE', 'Claude đang bận. Vui lòng thử lại sau.');
    }
    throw new ApiError(502, 'CLAUDE_ERROR', 'Không thể nhận câu trả lời từ Claude. Vui lòng thử lại.');
  }
}

export async function sendOllama(messages: unknown[], tools?: unknown[]) {
  if (!env.LLM_BASE_URL) throw new ApiError(503, 'LLM_NOT_CONFIGURED', 'Chưa cấu hình mô hình AI trên máy.');
  // shortcut: native Ollama only; OpenAI-compatible servers need a separate adapter.
  const url = new URL('/api/chat', env.LLM_BASE_URL);
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, redirect: 'error',
      // The first question after idle loads the model onto the GPU and can take over a minute.
      signal: AbortSignal.timeout(180_000),
      body: JSON.stringify({ model: env.LLM_MODEL, stream: false, think: false,
        options: { num_ctx: 8192, temperature: 0.2 }, messages, ...(tools ? { tools } : {}) }),
    });
  } catch { throw new ApiError(503, 'LLM_UNAVAILABLE', 'Mô hình AI trên máy không phản hồi. Kiểm tra Ollama đã bật chưa.'); }
  if (response.status === 429 || response.status >= 500) throw new ApiError(503, 'LLM_UNAVAILABLE', 'Mô hình AI trên máy đang bận. Vui lòng thử lại sau.');
  if (!response.ok) throw new ApiError(502, 'LLM_ERROR', 'Không thể nhận câu trả lời từ mô hình AI trên máy.');
  return response.json().catch(() => null) as Promise<unknown>;
}

export const cleanModelText = (content: string) => content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
export function assertTracingDisabled(code: string, message: string) {
  if (['LANGSMITH_TRACING', 'LANGCHAIN_TRACING_V2', 'LANGCHAIN_TRACING', 'LANGCHAIN_VERBOSE'].some(key => {
    const value = process.env[key]?.trim().toLowerCase();
    return value && value !== 'false' && value !== '0';
  })) throw new ApiError(503, code, message);
}
