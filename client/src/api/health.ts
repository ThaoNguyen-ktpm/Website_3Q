export type Health = { status: 'ok' };

export async function getHealth(signal?: AbortSignal): Promise<Health> {
  const response = await fetch('/api/health', { signal });
  if (!response.ok) throw new Error('Không thể kết nối API.');
  return response.json() as Promise<Health>;
}
