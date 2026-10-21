import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { ApiError } from '../middlewares/errorHandler.js';
import type { CatalogItem, CatalogResult, CatalogSource } from './catalogSearchService.js';

type Detail = NonNullable<CatalogItem['detail']>;
export type MergedProduct = {
  key: string; sku: string; name: string; price: number | null; onHand: number | null;
  image: string | null; images: string[]; createdAt: string | null;
  sources: CatalogSource[]; kiot?: Detail; sapo?: Detail;
};
type SourceState = { status: 'ok' | 'error'; count: number; message?: string };
type FetchAll = (source: CatalogSource) => Promise<CatalogResult>;
export type CatalogSnapshot = { rows: Partial<Record<CatalogSource, CatalogItem[]>>; complete: CatalogSource[]; syncedAt: string | null };
type SnapshotStore = { load: () => CatalogSnapshot | null; save: (snapshot: CatalogSnapshot) => void };
const allSources: CatalogSource[] = ['kiotviet', 'sapo-web'];
const integer = (fallback: number) => z.preprocess(value => typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value, z.number().int().min(1).max(Number.MAX_SAFE_INTEGER).default(fallback));
const productsSchema = z.object({ q: z.string().max(200).trim().default(''), page: integer(1), pageSize: integer(20).refine(value => [15, 20, 30, 50, 100].includes(value)) });
export type ProductsQuery = z.infer<typeof productsSchema>;

export function parseProductsQuery(input: unknown): ProductsQuery {
  const result = productsSchema.safeParse(input);
  if (!result.success) throw new ApiError(400, 'VALIDATION_ERROR', 'Từ khóa tối đa 200 ký tự; trang từ 1; số dòng là 15, 20, 30, 50 hoặc 100.');
  return result.data;
}

const fold = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').toLowerCase();
const imagesOf = (detail?: Detail): string[] => Array.isArray(detail?.images) ? detail.images.filter((image): image is string => typeof image === 'string') : [];
const dateOf = (value: unknown): string | null => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;

/** Kiot owns commercial fields; Sapo supplements web details and appends its images after Kiot ones (no duplicates). */
function mergeCatalog(rows: Record<CatalogSource, CatalogItem[]>, sources: CatalogSource[]): MergedProduct[] {
  const merged = new Map<string, MergedProduct>();
  for (const source of sources) for (const row of rows[source]) {
    const sku = row.sku.trim();
    const key = sku ? `sku:${sku.toLowerCase()}` : `${source}:${row.productId}:${row.variantId ?? ''}`;
    const existing = merged.get(key);
    if (existing) {
      if (!existing.sources.includes(source)) existing.sources.push(source);
      if (source === 'sapo-web') {
        existing.sapo ??= row.detail;
        existing.images = [...new Set([...existing.images, ...imagesOf(row.detail)])]; existing.image = existing.images[0] ?? null;
      }
      continue;
    }
    const images = imagesOf(row.detail);
    merged.set(key, {
      key, sku, name: row.name, price: row.price, onHand: row.onHand,
      image: images[0] ?? null, images,
      createdAt: dateOf(source === 'kiotviet' ? row.detail?.createdDate : row.detail?.createdOn),
      sources: [source], ...(source === 'kiotviet' ? { kiot: row.detail } : { sapo: row.detail }),
    });
  }
  return [...merged.values()].sort((a, b) => (Date.parse(b.createdAt ?? '') || 0) - (Date.parse(a.createdAt ?? '') || 0) || a.key.localeCompare(b.key));
}

export function createCatalogStore({ fetchAll, now = Date.now, sources = allSources, snapshot }: { fetchAll: FetchAll; now?: () => number; sources?: CatalogSource[]; snapshot?: SnapshotStore }) {
  const rows: Record<CatalogSource, CatalogItem[]> = { kiotviet: [], 'sapo-web': [] };
  const complete = new Set<CatalogSource>();
  let items: MergedProduct[] = [], syncedAt: string | null = null, lastAttempt: number | null = null;
  let lastForced: number | null = null, pending: Promise<void> | null = null;
  // Only report sources this store syncs, so the page never warns about a source that is turned off.
  let state = Object.fromEntries(sources.map(source => [source, { status: 'error', count: 0 }])) as Record<CatalogSource, SourceState>;
  const status = () => ({ total: items.length, syncedAt, syncing: pending !== null, sources: structuredClone(state) });
  // Bảo 2026-10-19: show the last saved catalog at once after a restart; products() then refreshes it in the background.
  try {
    const saved = snapshot?.load();
    if (saved) for (const source of sources) if (Array.isArray(saved.rows[source]) && saved.complete.includes(source)) {
      rows[source] = saved.rows[source]!; complete.add(source);
      state[source] = { status: 'ok', count: rows[source].length };
    }
    if (complete.size) { items = mergeCatalog(rows, sources); syncedAt = saved!.syncedAt; lastAttempt = 0; }
  } catch { /* a broken snapshot only means a normal first sync */ }

  function sync(): Promise<void> {
    if (pending) return pending;
    pending = Promise.all(sources.map(async source => {
      try {
        const result = await fetchAll(source);
        // BossTele returns sanitized codes/messages (no keys); log them so a failed sync has a visible cause.
        if (result.status !== 'ok') console.error(`Đồng bộ ${source} lỗi: ${result.code ?? 'unknown'} ${result.message ?? ''}`);
        if (result.status !== 'ok' || !Array.isArray(result.items) || result.items.some(row => !row || typeof row.sku !== 'string' || typeof row.name !== 'string')) throw new Error('source_error');
        if (result.complete !== true) {
          if (!complete.has(source)) rows[source] = result.items;
          state[source] = { status: 'error', count: rows[source].length, message: 'Chưa tải hết danh mục (giới hạn 200 trang); đang giữ dữ liệu đã có.' };
          return;
        }
        rows[source] = result.items; complete.add(source);
        state[source] = { status: 'ok', count: result.items.length };
      } catch {
        state[source] = { status: 'error', count: rows[source].length, message: 'Không đồng bộ được nguồn; đang giữ dữ liệu đã có. Vui lòng thử lại.' };
      }
    })).then(() => {
      items = mergeCatalog(rows, sources);
      lastAttempt = now();
      if (sources.some(source => state[source].status === 'ok')) {
        syncedAt = new Date(lastAttempt).toISOString();
        try { snapshot?.save({ rows, complete: [...complete], syncedAt }); } catch { /* the in-memory catalog still works */ }
      }
    }).finally(() => { pending = null; });
    return pending;
  }

  return {
    sync,
    async forceSync() {
      const elapsed = lastForced === null ? Infinity : now() - lastForced;
      if (elapsed < 60000) throw new ApiError(429, 'SYNC_COOLDOWN', `Vui lòng chờ ${Math.ceil((60000 - elapsed) / 1000)} giây trước khi đồng bộ lại.`);
      lastForced = now();
      await sync();
      return status();
    },
    /** Raw synced rows of one source, for the Sale AI tool on this machine (TASK-036). */
    rawRows(source: CatalogSource) {
      return { rows: rows[source], complete: complete.has(source), syncedAt, status: state[source]?.status ?? 'error', message: state[source]?.message };
    },
    /** Distinct KiotViet brand names (tradeMarkName) in the synced catalog. */
    async brands() {
      if (lastAttempt === null) await sync();
      return [...new Set(items.map(item => item.kiot?.tradeMarkName).filter((name): name is string => typeof name === 'string' && name.trim() !== ''))];
    },
    async products(query: ProductsQuery, canViewCost: boolean) {
      if (lastAttempt === null) await sync();
      else if (now() - lastAttempt >= 600000) void sync();
      const needle = fold(query.q);
      const filtered = items.filter(item => fold(item.name).includes(needle) || fold(item.sku).includes(needle));
      const total = filtered.length, pageCount = Math.max(1, Math.ceil(total / query.pageSize)), page = Math.min(query.page, pageCount);
      const visible = structuredClone(filtered.slice((page - 1) * query.pageSize, page * query.pageSize));
      if (!canViewCost) for (const item of visible) for (const detail of [item.kiot, item.sapo]) {
        for (const inventory of detail?.inventories ?? []) delete inventory.cost;
      }
      return { ...status(), catalogTotal: items.length, items: visible, total, page, pageSize: query.pageSize, pageCount };
    },
  };
}

const require = createRequire(import.meta.url);
const bossRoot = fileURLToPath(new URL('../../../BossTele/', import.meta.url));
const { createCatalogFetcher } = require(`${bossRoot}/lib/product-search.js`) as { createCatalogFetcher: (config: unknown) => FetchAll };
const { loadConnectionConfig } = require(`${bossRoot}/lib/connection-config.js`) as { loadConnectionConfig: (root: string) => unknown };
let fetcher: FetchAll | undefined;
// Server-only file (gitignored server/data/): it holds branch cost, which products() strips per user as before.
const snapshotFile = fileURLToPath(new URL('../../data/catalog-cache.json', import.meta.url));
// Bảo 2026-10-16: the search page reads KiotViet only (Sapo hit its rate limit during syncs).
export const catalogStore = createCatalogStore({ sources: ['kiotviet'], snapshot: {
  load: () => JSON.parse(readFileSync(snapshotFile, 'utf8')) as CatalogSnapshot,
  save: value => { mkdirSync(dirname(snapshotFile), { recursive: true }); writeFileSync(snapshotFile, JSON.stringify(value)); },
}, fetchAll: async source => {
  fetcher ??= createCatalogFetcher(loadConnectionConfig(bossRoot));
  return fetcher(source);
} });
