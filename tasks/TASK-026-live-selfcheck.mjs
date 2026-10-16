// Explicitly read-only: provider GETs and Kiot OAuth only. No DB or credential output.
import { performance } from 'node:perf_hooks';
import { catalogStore, parseProductsQuery } from '../server/dist/services/catalogStore.js';
const started = performance.now();
const catalog = await catalogStore.products(parseProductsQuery({}), false);
const sku = await catalogStore.products(parseProductsQuery({ q: 'SP000094' }), false);
const chanel = await catalogStore.products(parseProductsQuery({ q: 'tui chanel' }), false);
console.log(JSON.stringify({
  durationMs: Math.round(performance.now() - started), sources: catalog.sources,
  mergedTotal: catalog.catalogTotal, syncedAt: catalog.syncedAt,
  SP000094: { matches: sku.total, sources: sku.items[0]?.sources ?? [], expectedName: sku.items[0]?.name === 'Soft Trunk Lv Của Nguyên' },
  accentFreeChanelMatches: chanel.total,
}, null, 2));
if (Object.values(catalog.sources).some(source => source.status !== 'ok')) process.exitCode = 1;
