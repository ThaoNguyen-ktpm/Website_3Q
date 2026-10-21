import { ApiError } from '../middlewares/errorHandler.js';
import { documentStore } from '../models/documentStore.js';
import { embed } from './documentEmbeddingService.js';
import * as audit from './auditService.js';

export const maxPdfBytes = 20 * 1024 * 1024;
export function validatePdf(pdf: unknown, encodedName: string | undefined): string {
  if (!Buffer.isBuffer(pdf) || pdf.length > maxPdfBytes || pdf.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new ApiError(400, 'INVALID_PDF', 'Chọn tài liệu PDF hợp lệ, tối đa 20 MB.');
  }
  let name: string;
  try { name = decodeURIComponent(encodedName ?? '').trim(); }
  catch { throw new ApiError(400, 'INVALID_FILE_NAME', 'Tên tài liệu không hợp lệ.'); }
  if (!name || name.length > 255 || /[\x00-\x1f\x7f/\\]/.test(name) || !/\.pdf$/i.test(name)) {
    throw new ApiError(400, 'INVALID_FILE_NAME', 'Tên tài liệu không hợp lệ.');
  }
  return name;
}

export function chunkPages(pages: string[]): { text: string; page: number }[] {
  const chunks: { text: string; page: number }[] = [];
  pages.forEach((text, index) => {
    text = text.trim();
    for (let start = 0; start < text.length; start += 850) {
      chunks.push({ text: text.slice(start, start + 1000), page: index + 1 });
      if (start + 1000 >= text.length) break;
    }
  });
  if (!chunks.length) throw new ApiError(422, 'PDF_WITHOUT_TEXT', 'Tài liệu không có văn bản để đọc (có thể là ảnh scan).');
  return chunks;
}

export async function extractPages(pdf: Buffer): Promise<string[]> {
  const { getDocumentProxy, extractText } = await import('unpdf');
  let document: Awaited<ReturnType<typeof getDocumentProxy>> | undefined;
  try {
    // unpdf 1.9 bundles a PDF.js build without eval; its default options already suit Node.
    document = await getDocumentProxy(new Uint8Array(pdf));
    const { text } = await extractText(document, { mergePages: false });
    return text;
  } catch { throw new ApiError(400, 'INVALID_PDF', 'Không thể đọc tài liệu PDF. Tài liệu có thể bị lỗi hoặc được bảo vệ.'); }
  // PDFDocumentProxy has no destroy() in this PDF.js; tear down through its loading task.
  finally { await document?.loadingTask.destroy(); }
}

export async function ingestDocument(pdf: unknown, encodedName: string | undefined, actor: { id: number; fullName: string; email: string }, ip?: string) {
  const name = validatePdf(pdf, encodedName);
  const buffer = pdf as Buffer;
  const pages = await extractPages(buffer);
  const chunks = [];
  for (const chunk of chunkPages(pages)) chunks.push({ ...chunk, vector: await embed(`passage: ${chunk.text}`) });
  const document = await documentStore.add({ name, pages: pages.length, uploadedAt: new Date().toISOString(), uploadedBy: actor.fullName, chunks }, buffer);
  await audit.record({ actor, action: 'document.upload', targetType: 'document', targetId: document.id, ip });
  return document;
}

export async function deleteDocument(id: string, actor: { id: number; email: string }, ip?: string) {
  await documentStore.remove(id);
  await audit.record({ actor, action: 'document.delete', targetType: 'document', targetId: id, ip });
}
