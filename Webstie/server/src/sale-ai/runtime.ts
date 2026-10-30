import { createSaleAi } from './core.js';
import { KiotClient, inStock, normalizeProduct } from './lib/kiot.js';
import { rawFromWebRow } from './lib/shared-catalog.js';
import { SapoClient } from './lib/sapo.js';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { catalogStore } from '../services/catalogStore.js';

let current: Awaited<ReturnType<typeof createSaleAi>> | undefined;
let starting: Promise<void> | undefined;
export const getSaleAi = () => current;

/** Start once after listen; initialization never holds up the web port. */
export function startSaleAi(): Promise<void> {
  return starting ??= (async () => {
    // Use the same authoritative project configuration as catalog search; never mix or log credentials.
    const { loadConnectionConfig } = createRequire(import.meta.url)('../../../BossTele/lib/connection-config.js');
    const { kiotviet, sapoWeb } = loadConnectionConfig(fileURLToPath(new URL('../../../BossTele/', import.meta.url)));
    const client = new KiotClient({ credentials: {
      retailer: kiotviet.retailer, client: kiotviet.clientId, secret: kiotviet.clientSecret,
    } });
    client.all = async (progress: (value: {loaded: number; total: number; kept: number}) => void = () => {}) => {
      await catalogStore.sync();
      const data = catalogStore.rawRows('kiotviet');
      if (data.status !== 'ok' || !data.complete) throw new Error('Danh mục Kiot chưa đầy đủ; vui lòng tải lại');
      const seen = new Set<number>();
      const kept = [];
      for (const row of data.rows) {
        if (typeof row.productId !== 'number' || !Number.isSafeInteger(row.productId) || seen.has(row.productId) || typeof row.detail?.taxPresent !== 'boolean') {
          throw new Error('Danh mục Kiot thiếu ID, thông tin thuế hoặc trùng sản phẩm');
        }
        seen.add(row.productId);
        const product = normalizeProduct(rawFromWebRow(row));
        if (inStock(product)) kept.push(product);
      }
      Object.assign(client, {lastImport: {read: seen.size, kept: kept.length, filtered: seen.size - kept.length, source: 'website'}});
      progress({ loaded: seen.size, total: seen.size, kept: kept.length });
      return kept;
    };
    current = await createSaleAi({ client, sapoClient: new SapoClient({shop: sapoWeb.domain, key: sapoWeb.apiKey, secret: sapoWeb.apiSecret}) });
    const check = () => current!.keepCurrent().catch(() => console.error('Sale AI: không thể cập nhật bảng hôm nay.'));
    await check();
    setInterval(check, 15_000).unref();
  })().catch(() => { console.error('Sale AI: khởi tạo thất bại; kiểm tra kho dữ liệu và cấu hình.'); });
}
