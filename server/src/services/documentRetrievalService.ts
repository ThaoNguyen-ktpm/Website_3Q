import type { StoredDocument } from '../models/documentStore.js';

export type DocumentSource = { documentId: string; name: string; page: number; excerpt: string };
export type RetrievedChunk = DocumentSource & { text: string };
function cosine(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length || !a.every(Number.isFinite) || !b.every(Number.isFinite)) return -Infinity;
  const norm = Math.hypot(...a) * Math.hypot(...b);
  return norm ? a.reduce((sum, value, index) => sum + value * b[index], 0) / norm : -Infinity;
}

export function retrieveChunks(documents: StoredDocument[], query: number[]): RetrievedChunk[] {
  return documents.flatMap(document => document.chunks.map(chunk => ({
    documentId: document.id, name: document.name, page: chunk.page,
    text: chunk.text, excerpt: chunk.text.slice(0, 200), score: cosine(query, chunk.vector),
  }))).filter(chunk => Number.isFinite(chunk.score)).sort((a, b) => b.score - a.score).slice(0, 6)
    .map(({ score: _score, ...chunk }) => chunk);
}
