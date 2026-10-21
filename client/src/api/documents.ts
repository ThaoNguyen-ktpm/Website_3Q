export type DocumentMetadata = { id: string; name: string; pages: number; uploadedAt: string; uploadedBy: string };
export type DocumentAnswer = { answer: string; sources: { documentId: string; name: string; page: number; excerpt: string }[] };

async function documentRequest<T>(path = '', init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/documents${path}`, { ...init, credentials: 'include', cache: 'no-store' });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message ?? 'Không thể xử lý tài liệu. Vui lòng thử lại.');
  if (!data) throw new Error('Phản hồi tài liệu không hợp lệ. Vui lòng thử lại.');
  return data;
}
export const listDocuments = (signal?: AbortSignal) => documentRequest<{ documents: DocumentMetadata[] }>('', { signal });
export const uploadDocument = (file: File, signal?: AbortSignal) => documentRequest<{ document: DocumentMetadata }>('', {
  method: 'POST', headers: { 'Content-Type': 'application/pdf', 'X-File-Name': encodeURIComponent(file.name) }, body: file, signal,
});
export const deleteDocument = (id: string, signal?: AbortSignal) => documentRequest<void>(`/${encodeURIComponent(id)}`, { method: 'DELETE', signal });
export const askDocuments = (question: string, signal?: AbortSignal) => documentRequest<DocumentAnswer>('/ask', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question }), signal,
});
