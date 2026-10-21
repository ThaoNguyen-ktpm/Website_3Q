import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { z } from 'zod';
import { ApiError } from '../middlewares/errorHandler.js';

export type DocumentChunk = { text: string; page: number; vector: number[] };
export type StoredDocument = {
  id: string; name: string; pages: number; uploadedAt: string; uploadedBy: string; chunks: DocumentChunk[];
};
export type DocumentMetadata = Omit<StoredDocument, 'chunks'>;
const metadata = ({ chunks: _chunks, ...item }: StoredDocument): DocumentMetadata => item;
const indexSchema = z.array(z.strictObject({
  id: z.uuid(), name: z.string().min(1).max(255), pages: z.number().int().positive(),
  uploadedAt: z.string(), uploadedBy: z.string(),
  chunks: z.array(z.strictObject({ text: z.string(), page: z.number().int().positive(), vector: z.array(z.number()).min(1) })),
}));

/** One server process owns this local index; serialize read/modify/write operations. */
export function createDocumentStore(directory: string) {
  const indexPath = join(directory, 'index.json');
  let pending: Promise<unknown> = Promise.resolve();
  function exclusive<T>(action: () => Promise<T>): Promise<T> {
    const result = pending.then(action);
    pending = result.catch(() => undefined);
    return result;
  }
  async function read(): Promise<StoredDocument[]> {
    try { return indexSchema.parse(JSON.parse(await readFile(indexPath, 'utf8'))); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw new ApiError(503, 'DOCUMENT_STORE_ERROR', 'Không thể đọc kho tài liệu. Vui lòng thử lại.');
    }
  }
  async function save(documents: StoredDocument[]) {
    const temporary = join(directory, `index-${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, JSON.stringify(documents), { flag: 'wx', mode: 0o600 });
      await rename(temporary, indexPath);
    } finally { await unlink(temporary).catch(() => undefined); }
  }
  return {
    read,
    async list(): Promise<DocumentMetadata[]> { return (await read()).map(metadata); },
    add(draft: Omit<StoredDocument, 'id'>, pdf: Buffer): Promise<DocumentMetadata> {
      return exclusive(async () => {
        await mkdir(directory, { recursive: true });
        const documents = await read();
        const document = { ...draft, id: randomUUID() };
        const pdfPath = join(directory, `${document.id}.pdf`);
        const temporary = `${pdfPath}.tmp`;
        try {
          await writeFile(temporary, pdf, { flag: 'wx', mode: 0o600 });
          await rename(temporary, pdfPath);
          await save([...documents, document]);
        } catch (error) {
          await unlink(pdfPath).catch(() => undefined);
          throw error;
        } finally { await unlink(temporary).catch(() => undefined); }
        return metadata(document);
      });
    },
    remove(id: string): Promise<void> {
      return exclusive(async () => {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
          throw new ApiError(400, 'VALIDATION_ERROR', 'Mã tài liệu không hợp lệ.');
        }
        const documents = await read();
        if (!documents.some(document => document.id === id)) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy tài liệu.');
        // Keep the index recoverable if deleting the PDF fails before the index commit.
        const pdfPath = join(directory, `${id}.pdf`);
        const tombstone = `${pdfPath}.delete`;
        await rename(pdfPath, tombstone);
        try { await save(documents.filter(document => document.id !== id)); }
        catch (error) { await rename(tombstone, pdfPath); throw error; }
        await unlink(tombstone);
      });
    },
  };
}

export const documentStore = createDocumentStore(fileURLToPath(new URL('../../data/documents/', import.meta.url)));
