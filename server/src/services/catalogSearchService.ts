import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { ApiError } from '../middlewares/errorHandler.js';

export type CatalogSource = 'kiotviet' | 'sapo-web';
export type Inventory = { branchId: number | null; branchName: string | null; onHand: number | null; reserved: number | null; cost?: number | null };
export type CatalogItem = {
  source: CatalogSource; productId: number | string; variantId: number | string | null;
  sku: string; name: string; price: number | null; onHand: number | null;
  detail?: { inventories?: Inventory[]; [field: string]: unknown };
};
export type CatalogResult = {
  source: CatalogSource; status: 'ok' | 'error'; items: CatalogItem[];
  page?: number; hasMore?: boolean; nextPage?: number | null;
  complete?: boolean; warning?: string; code?: string; message?: string;
};
const querySchema = z.object({
  q: z.string().trim().min(1).max(200),
  kind: z.enum(['name', 'sku']).default('name'),
  source: z.enum(['all', 'kiotviet', 'sapo-web']).default('all'),
  page: z.preprocess(value => typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value, z.number().int().min(1).max(Number.MAX_SAFE_INTEGER).default(1)),
});
export type CatalogQuery = z.infer<typeof querySchema>;
type SearchOptions = { source: CatalogSource; kind: 'name' | 'sku'; query: string; page: number; startPage: number; detail: true };
type Search = (options: SearchOptions) => Promise<CatalogResult[]>;
type Dependencies = { loadConfig: () => unknown; createSearch: (config: unknown) => Search };

export function parseCatalogQuery(input: unknown): CatalogQuery {
  const parsed = querySchema.safeParse(input);
  if (!parsed.success || (parsed.data.kind === 'sku' && ['.', '..'].includes(parsed.data.q))) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Nhập từ khóa từ 1–200 ký tự, kiểu tìm và nguồn hợp lệ, trang là số nguyên từ 1.');
  }
  return parsed.data;
}

// Both src/services and dist/services are two directories below server/.
const require = createRequire(import.meta.url);
const bossRoot = fileURLToPath(new URL('../../../BossTele/', import.meta.url));
const { createProductSearch } = require(`${bossRoot}/lib/product-search.js`) as { createProductSearch: Dependencies['createSearch'] };
const { loadConnectionConfig } = require(`${bossRoot}/lib/connection-config.js`) as { loadConnectionConfig: (root: string) => unknown };

export function createCatalogSearch(dependencies: Dependencies) {
  let search: Search | undefined;
  return async (query: CatalogQuery, canViewCost: boolean) => {
    const sources: CatalogSource[] = query.source === 'all' ? ['kiotviet', 'sapo-web'] : [query.source];
    const failure = (source: CatalogSource, code: string): CatalogResult => ({
      source, status: 'error', items: [], page: query.page, hasMore: false, code,
      message: code === 'configuration_error' ? 'Không đọc được cấu hình kết nối sản phẩm.' : 'Không xử lý được phản hồi nguồn sản phẩm. Vui lòng thử lại.',
    });
    try { search ??= dependencies.createSearch(dependencies.loadConfig()); }
    catch { return { results: sources.map(source => failure(source, 'configuration_error')), canViewCost }; }
    const results = await Promise.all(sources.map(async source => {
      try {
        const [result] = await search!({ source, kind: query.kind, query: query.q, page: query.page, startPage: query.page, detail: true });
        return { ...result, page: query.page, hasMore: result.hasMore ?? false, items: result.items.map(item => {
          if (canViewCost || !item.detail?.inventories) return item;
          return { ...item, detail: { ...item.detail, inventories: item.detail.inventories.map(({ cost: _cost, ...inventory }) => inventory) } };
        }) };
      } catch { return failure(source, 'unexpected_error'); }
    }));
    return { results, canViewCost };
  };
}

export const searchCatalog = createCatalogSearch({ loadConfig: () => loadConnectionConfig(bossRoot), createSearch: createProductSearch });
