import type { MessageParam, Tool } from '@anthropic-ai/sdk/resources/messages';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { ApiError } from '../../middlewares/errorHandler.js';
import { cleanModelText, sendClaude, sendOllama } from '../modelTransport.js';
import { toolDefinitions } from './tools.js';

export type ToolCall = { id: string; name: string; arguments: unknown };
export type ModelMessage = { role: 'user' | 'assistant' | 'tool'; content: string; calls?: ToolCall[]; callId?: string; name?: string };
export type ModelReply = { text: string; calls: ToolCall[] };
const ollamaReply = z.object({ message: z.object({
  content: z.string().default(''),
  tool_calls: z.array(z.object({ function: z.object({ name: z.string().min(1), arguments: z.record(z.string(), z.unknown()) }) })).max(5).default([]),
}) });

/** Normalize tool protocols without exposing raw provider errors to the API. */
export async function callModel(system: string, messages: ModelMessage[], tools = false): Promise<ModelReply> {
  if (env.ANTHROPIC_API_KEY) {
    const history: MessageParam[] = [];
    for (const message of messages) {
      if (message.role === 'tool') {
        const block = { type: 'tool_result' as const, tool_use_id: message.callId!, content: message.content };
        const previous = history.at(-1);
        if (previous?.role === 'user' && Array.isArray(previous.content) && previous.content.every(item => item.type === 'tool_result')) previous.content.push(block);
        else history.push({ role: 'user', content: [block] });
      } else if (message.calls?.length) {
        history.push({ role: 'assistant', content: message.calls.map(call => ({ type: 'tool_use', id: call.id, name: call.name, input: call.arguments })) });
      } else history.push({ role: message.role, content: message.content });
    }
    const result = await sendClaude({
      model: 'claude-opus-5-5', max_tokens: 16000, output_config: { effort: 'low' }, system,
      messages: history,
      ...(tools ? { tools: toolDefinitions.map(tool => ({ name: tool.name, description: tool.description, input_schema: tool.parameters, strict: true })) as Tool[], tool_choice: { type: 'auto' as const } } : {}),
    });
    if (result.stop_reason === 'refusal') return { text: '', calls: [] };
    return {
      text: result.content.filter(block => block.type === 'text').map(block => block.text).join('\n').trim(),
      calls: result.content.filter(block => block.type === 'tool_use').map(block => ({ id: block.id, name: block.name, arguments: block.input })),
    };
  }
  const data = await sendOllama([
    { role: 'system', content: system },
    ...messages.map(message => ({ role: message.role, content: message.content,
      ...(message.role === 'tool' ? { tool_name: message.name } : {}),
      ...(message.calls?.length ? { tool_calls: message.calls.map(call => ({ function: { name: call.name, arguments: call.arguments } })) } : {}),
    })),
  ], tools ? toolDefinitions.map(tool => ({ type: 'function', function: { name: tool.name, description: tool.description, parameters: tool.parameters } })) : undefined);
  const parsed = ollamaReply.safeParse(data);
  if (!parsed.success) throw new ApiError(502, 'LLM_ERROR', 'Phản hồi mô hình AI không hợp lệ. Vui lòng thử lại.');
  return { text: cleanModelText(parsed.data.message.content), calls: parsed.data.message.tool_calls.map((call, index) => ({ id: `tool-${index}`, name: call.function.name, arguments: call.function.arguments })) };
}
