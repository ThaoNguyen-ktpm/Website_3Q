import { expect, it } from 'vitest';
import { chunkPages, validatePdf } from '../services/documentIngestService.js';
import { retrieveChunks } from '../services/documentRetrievalService.js';

it('rejects forged, oversized PDFs and unsafe file names before parsing', () => {
  expect(() => validatePdf(Buffer.from('not PDF'), 'test.pdf')).toThrow();
  expect(() => validatePdf(Buffer.alloc(20 * 1024 * 1024 + 1), 'test.pdf')).toThrow();
  expect(() => validatePdf(Buffer.from('%PDF-1.7'), '%ZZ')).toThrow();
  expect(() => validatePdf(Buffer.from('%PDF-1.7'), '..%2Fsecret.pdf')).toThrow();
  expect(validatePdf(Buffer.from('%PDF-1.7'), encodeURIComponent('Nội quy.pdf'))).toBe('Nội quy.pdf');
});
it('keeps page numbers and exactly 150 characters of overlap', () => {
  const text = 'a'.repeat(1100);
  expect(chunkPages(['', text])).toEqual([{ text: 'a'.repeat(1000), page: 2 }, { text: 'a'.repeat(250), page: 2 }]);
  expect(() => chunkPages([' ', '\n'])).toThrow('Tài liệu không có văn bản');
});
it('ranks by cosine rather than magnitude, returns six, excludes invalid vectors', () => {
  const documents = [{ id: 'one', name: 'Nội quy.pdf', pages: 7, uploadedAt: '', uploadedBy: '', chunks: [
    { text: 'wrong', page: 1, vector: [100, 100] },
    ...Array.from({ length: 6 }, (_, i) => ({ text: 'right'.repeat(60), page: i + 2, vector: [1, 0] })),
    { text: 'zero', page: 8, vector: [0, 0] },
  ] }];
  const result = retrieveChunks(documents, [1, 0]);
  expect(result).toHaveLength(6);
  expect(result.map(item => item.page)).toEqual([2, 3, 4, 5, 6, 7]);
  expect(result[0]).toMatchObject({ documentId: 'one', name: 'Nội quy.pdf' });
  expect(result[0].excerpt).toHaveLength(200);
});
