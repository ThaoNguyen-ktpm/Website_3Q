export type AssistantMessage = { role: 'user' | 'assistant'; content: string };
export type AssistantProduct = { sku: string; name: string; price: number | null; onHand: number | null; hotTrend: boolean; image: string | null };
export type AssistantReply = { reply: string; offTopic: boolean; sources: { kind: 'product' | 'document' | 'guide' | 'staff' | 'audit' | 'price'; label: string }[]; products?: AssistantProduct[]; suggestions?: string[] };

export async function askAssistant(messages: AssistantMessage[], signal?: AbortSignal): Promise<AssistantReply> {
  const response = await fetch('/api/assistant/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', cache: 'no-store',
    body: JSON.stringify({ messages: messages.slice(-10) }), signal,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message ?? 'Không thể kết nối trợ lý. Vui lòng thử lại.');
  if (typeof data?.reply !== 'string' || !Array.isArray(data.sources)) throw new Error('Phản hồi trợ lý không hợp lệ. Vui lòng thử lại.');
  return data;
}
