import { fileURLToPath } from 'node:url';
import { ApiError } from '../middlewares/errorHandler.js';

async function loadExtractor() {
  const { pipeline, env } = await import('@huggingface/transformers');
  env.cacheDir = fileURLToPath(new URL('../../data/models/', import.meta.url));
  return pipeline('feature-extraction', 'Xenova/multilingual-e5-small', { dtype: 'q8' });
}
let extractor: ReturnType<typeof loadExtractor> | undefined;
// Serialize CPU inference to avoid simultaneous model loads and unbounded inference memory.
let pending: Promise<unknown> = Promise.resolve();
export function embed(text: string): Promise<number[]> {
  const result = pending.then(async () => {
    try {
      extractor ??= loadExtractor();
      const model = await extractor;
      const output = await model(text, { pooling: 'mean', normalize: true });
      const vector = Array.from(output.data, Number);
      if (!vector.length || !vector.every(Number.isFinite)) throw new Error('Invalid embedding');
      return vector;
    } catch {
      extractor = undefined;
      throw new ApiError(503, 'EMBEDDING_UNAVAILABLE', 'Chưa thể chạy mô hình embedding cục bộ. Vui lòng thử lại.');
    }
  });
  pending = result.catch(() => undefined);
  return result;
}
