import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { Permission } from '../../config/permissions.js';
import { catalogStore } from '../catalogStore.js';
import { documentStore } from '../../models/documentStore.js';
import { embed } from '../documentEmbeddingService.js';
import { retrieveChunks } from '../documentRetrievalService.js';
import * as staff from '../staffService.js';
import * as audit from '../auditService.js';
import { extractSkus, matchingSkus, skuChoice } from './sku.js';

export type Source = { kind: 'product' | 'document' | 'guide' | 'staff' | 'audit' | 'price'; label: string };
type PriceCalculation = { capital: string; expenses: string; cost: string; method: string; rate: string; sellingPrice: string; formula: string };
// Same exact BigInt calculator BossTele uses, so the model never does price arithmetic itself.
// Loaded on first use so importing this module never depends on resolving a file: URL.
const loadCalculator = () => (createRequire(import.meta.url)(fileURLToPath(new URL('../../../../BossTele/lib/target-price.js', import.meta.url))) as
  { calculateTargetPrice: (input: { capital: string; expenses: string; method: string; rate: string }) => PriceCalculation }).calculateTargetPrice;
const money = z.union([z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), z.string().trim().regex(/^\d{1,15}$/)]);
const percent = z.union([z.number().nonnegative().max(1000), z.string().trim().regex(/^\d{1,4}(\.\d{1,4})?$/)]);
// Tool schemas are exported as JSON Schema, which cannot carry zod transforms; normalise after parsing.
const asRate = (value: number | string) => typeof value === 'number' ? value.toFixed(4).replace(/\.?0+$/, '') : value;
// KiotViet uses 0 for products without a selling price.
const priced = (price: number | null) => price && price > 0 ? price : 0;
const vnTime = (date: Date) => date.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });
// reserved: units a customer has a deposit on (Kiot đặt hàng), Bảo 2026-10-20.
export type ProductCard = { sku: string; name: string; price: number | null; onHand: number | null; reserved?: number; hotTrend: boolean; image: string | null };
export type ToolResult = { content: string; sources: Source[]; products?: ProductCard[] };
const term = z.string().trim().min(1).max(200);
const schemas = {
  tim_san_pham: z.strictObject({ q: term.nullish(), hot_trend: z.boolean().default(false), brand: term.nullish(), limit: z.number().int().min(1).max(5).default(5),
    in_stock: z.boolean().default(false), min_price: z.number().int().nonnegative().nullish(), max_price: z.number().int().nonnegative().nullish(),
    sort: z.enum(['newest', 'cheap', 'expensive']).default('newest'), offset: z.number().int().min(0).max(100000).default(0) })
    .refine(value => value.q || value.hot_trend || value.brand || value.in_stock || value.min_price != null || value.max_price != null),
  hoi_tai_lieu: z.strictObject({ question: z.string().trim().min(1).max(2000) }),
  huong_dan_su_dung: z.strictObject({ chu_de: term }),
  danh_sach_nhan_vien: z.strictObject({ q: term.nullish() }),
  tinh_gia: z.strictObject({ sku: term.nullish(), von: money.nullish(), chi_phi: money.nullish(), cach: z.enum(['markup', 'margin']), ty_le: percent })
    .refine(value => value.sku || value.von),
  nhat_ky_thao_tac: z.strictObject({ action: z.enum(Object.keys(audit.actionLabels) as [string, ...string[]]).nullish(), limit: z.number().int().min(1).max(10).default(10) }),
};
const descriptions: Record<keyof typeof schemas, string> = {
  tim_san_pham: 'Tìm tên hoặc SKU không dấu trong danh mục thật; xem tồn, giá. hot_trend=true liệt kê hàng Hot trend (tên có dấu !); brand lọc theo thương hiệu; in_stock chỉ hàng còn; min_price/max_price theo VND; sort newest/cheap/expensive; offset để xem trang sau.',
  hoi_tai_lieu: 'Tìm sáu đoạn tài liệu nội bộ liên quan câu hỏi.',
  huong_dan_su_dung: 'Tra hướng dẫn menu, quyền, vai trò và giới hạn dữ liệu mẫu của website.',
  danh_sach_nhan_vien: 'Danh sách nhân viên; lọc tên, email hoặc vai trò.',
  tinh_gia: 'Tính giá bán theo vốn bằng công thức BossTele. cach=markup: (vốn+chi_phi)×(1+ty_le/100); cach=margin: (vốn+chi_phi)/(1−ty_le/100). Truyền von (VND nguyên) hoặc sku để lấy giá vốn KiotViet; chi_phi mặc định 0.',
  nhat_ky_thao_tac: 'Xem các thao tác gần nhất; lọc mã hành động nếu cần.',
};
export const toolDefinitions = Object.entries(schemas).map(([name, schema]) => {
  const parameters = z.toJSONSchema(schema);
  delete parameters.$schema;
  // Strict tool schemas require all properties; nullable arguments represent omitted filters.
  parameters.required = Object.keys(parameters.properties ?? {});
  return { name, description: descriptions[name as keyof typeof schemas], parameters };
});
const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').toLowerCase();
function output(data: unknown, sources: Source[] = []): ToolResult {
  const serialized = JSON.stringify(data);
  let content = serialized;
  let excerpt = serialized.slice(0, 3500);
  while (content.length > 4000) {
    content = JSON.stringify({ truncated: true, excerpt });
    excerpt = excerpt.slice(0, Math.floor(excerpt.length * 0.8));
  }
  return { content, sources: sources.map(source => ({ ...source, label: source.label.slice(0, 200) })) };
}
const denied = (label: string) => output({ message: `Bạn không có quyền xem ${label}.` });

/** Validate model arguments and enforce permissions before any read or embedding. */
export async function executeTool(name: string, args: unknown, permissions: Permission[]): Promise<ToolResult> {
  if (!Object.hasOwn(schemas, name)) return output({ message: 'Công cụ không hợp lệ.' });
  const parsed = schemas[name as keyof typeof schemas].safeParse(args);
  if (!parsed.success) return output({ message: 'Tham số công cụ không hợp lệ.' });
  switch (name) {
    case 'tim_san_pham': {
      if (!permissions.includes('products.view')) return denied('sản phẩm');
      const { q, hot_trend: hotTrend, brand, limit, in_stock: inStock, min_price: minPrice, max_price: maxPrice, sort, offset } = schemas.tim_san_pham.parse(args);
      const cost = permissions.includes('products.cost');
      // Hot trend items carry "!" in their KiotViet name; search for it directly when no name is given.
      // Brand filters use the KiotViet brand field (names often abbreviate, e.g. "LV"); text words must all appear in the name.
      const words = (q ?? '').split(/\s+/).map(fold).filter(Boolean);
      const broad = Boolean(brand || hotTrend || inStock || minPrice != null || maxPrice != null || sort !== 'newest' || offset);
      const sku = q && extractSkus(q)[0] === q.toUpperCase() ? q : null;
      const result = await catalogStore.products({ q: broad ? (hotTrend ? '!' : '') : q!, page: 1, pageSize: broad || sku ? 100000 : 15 }, cost);
      const candidates = sku ? matchingSkus(result.items, sku) : result.items;
      if (sku && candidates.length > 1) return output({ message: skuChoice(candidates), candidates: candidates.slice(0, 5).map(item => item.sku) });
      const matching = candidates.filter(item => (!hotTrend || item.name.includes('!'))
        && (!brand || fold(String(item.kiot?.tradeMarkName ?? item.sapo?.vendor ?? '')) === fold(brand))
        && (!broad || words.every(word => fold(item.name).includes(word)))
        && (!inStock || (item.onHand ?? 0) > 0)
        && (minPrice == null || priced(item.price) >= minPrice) && (maxPrice == null || (priced(item.price) > 0 && priced(item.price) <= maxPrice)));
      // Catalog order is newest first; price sorts keep unpriced (0/null) items last.
      if (sort !== 'newest') matching.sort((a, b) => {
        const x = priced(a.price), y = priced(b.price);
        if (!x || !y) return (x ? 0 : 1) - (y ? 0 : 1);
        return sort === 'cheap' ? x - y : y - x;
      });
      const items = matching.slice(offset, offset + (broad ? 10 : limit)).map(item => ({
        name: item.name, sku: item.sku, price: item.price, onHand: item.onHand, hotTrend: item.name.includes('!'),
        reserved: (item.kiot?.inventories ?? []).reduce((sum, row) => sum + (Number((row as { reserved?: number }).reserved) || 0), 0),
        category: item.kiot?.categoryName ?? item.sapo?.productType ?? null,
        brand: item.kiot?.tradeMarkName ?? item.sapo?.vendor ?? null,
        ...(cost ? { cost: item.kiot?.inventories?.map(row => ({ branch: row.branchName, cost: row.cost ?? null })) ?? [] } : {}),
      }));
      // Structured copies drive the widget's product cards; the model only needs to summarise.
      const images = new Map(result.items.map(item => [item.sku, typeof item.image === 'string' && item.image.startsWith('https://') ? item.image : null]));
      const products: ProductCard[] = items.map(item => ({ sku: item.sku, name: item.name, price: item.price, onHand: item.onHand, reserved: item.reserved, hotTrend: item.hotTrend, image: images.get(item.sku) ?? null }));
      return { ...output({ items, total: broad || sku ? matching.length : result.total, syncedAt: result.syncedAt, sources: result.sources,
        ...(!cost ? { notice: 'Bạn không có quyền xem giá vốn.' } : {}) }, items.map(item => ({ kind: 'product', label: `${item.sku} · ${item.name}` }))), products };
    }
    case 'hoi_tai_lieu': {
      if (!permissions.includes('documents.view')) return denied('tài liệu');
      const documents = await documentStore.read();
      if (!documents.length) return output({ message: 'Chưa có tài liệu nào được tải lên.' });
      const { question } = schemas.hoi_tai_lieu.parse(args);
      const chunks = retrieveChunks(documents, await embed(`query: ${question}`));
      // Keep all six passages represented within the per-tool context budget.
      const items = chunks.map(({ name, page, text }) => ({ name: name.slice(0, 150), page, text: text.slice(0, 400) }));
      return output(items, items.map(item => ({ kind: 'document', label: `${item.name} · trang ${item.page}` })));
    }
    case 'huong_dan_su_dung': {
      const { chu_de } = schemas.huong_dan_su_dung.parse(args);
      // Source-relative path remains valid for both src and dist without a build copy step.
      const guide = await readFile(new URL('../../../src/services/assistant/websiteGuide.md', import.meta.url), 'utf8');
      const words = fold(chu_de).split(/\s+/).filter(word => word.length > 1);
      const sections = guide.split(/^## /m).slice(1).map(text => ({ text, score: words.filter(word => fold(text).includes(word)).length }))
        .filter(item => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
      return output(sections.map(item => item.text), sections.map(item => ({ kind: 'guide', label: `Hướng dẫn · ${item.text.split('\n')[0]}` })));
    }
    case 'danh_sach_nhan_vien': {
      if (!permissions.includes('staff.view')) return denied('nhân viên');
      const { q } = schemas.danh_sach_nhan_vien.parse(args);
      const matches = (await staff.list()).filter(row => !q || fold(`${row.fullName} ${row.email} ${row.role} ${row.roleLabel}`).includes(fold(q)));
      const items = matches.slice(0, 10).map(row => ({ fullName: row.fullName, email: row.email, role: row.roleLabel, status: row.status, lastLoginAt: row.lastLoginAt }));
      return output({ total: matches.length, truncated: matches.length > items.length, items }, items.map(row => ({ kind: 'staff', label: row.fullName })));
    }
    case 'nhat_ky_thao_tac': {
      if (!permissions.includes('audit.view')) return denied('nhật ký thao tác');
      const { action, limit } = schemas.nhat_ky_thao_tac.parse(args);
      const result = await audit.list({ ...(action ? { action } : {}), page: '1', pageSize: String(limit) });
      // Show Vietnam time; raw Date serialises as UTC and confused readers.
      const items = result.items.map(row => ({ time: vnTime(row.createdAt), actor: row.actorEmail, action: row.actionLabel }));
      return output(items, items.map(row => ({ kind: 'audit', label: `${row.action} · ${row.time}` })));
    }
    case 'tinh_gia': {
      const { sku, von, chi_phi, cach, ty_le: rawRate } = schemas.tinh_gia.parse(args);
      const ty_le = asRate(rawRate);
      let capital = von == null ? null : String(von);
      let product: { sku: string; name: string; price: number | null } | null = null;
      let note: string | undefined;
      if (!capital) {
        if (!permissions.includes('products.view')) return denied('sản phẩm');
        if (!permissions.includes('products.cost')) return output({ message: 'Bạn không có quyền xem giá vốn; hãy nhập số vốn để tính.' });
        const candidates = matchingSkus((await catalogStore.products({ q: sku!, page: 1, pageSize: 100000 }, true)).items, sku!);
        if (candidates.length > 1) return output({ message: skuChoice(candidates), candidates: candidates.slice(0, 5).map(item => item.sku) });
        const found = candidates[0];
        if (!found) return output({ message: `Không tìm thấy SKU ${sku}.` });
        const costs = [...new Set((found.kiot?.inventories ?? []).map(row => row.cost).filter((value): value is number => typeof value === 'number' && value > 0))];
        if (!costs.length) return output({ message: `SKU ${found.sku} chưa có giá vốn trên KiotViet; hãy nhập số vốn để tính.` });
        // Branches can disagree; price from the highest cost so the margin is never overstated.
        capital = String(Math.round(Math.max(...costs)));
        if (costs.length > 1) note = `Các chi nhánh có giá vốn khác nhau (${costs.join(', ')}); đã dùng giá cao nhất.`;
        product = { sku: found.sku, name: found.name, price: found.price };
      }
      let calculation: PriceCalculation;
      try { calculation = loadCalculator()({ capital, expenses: chi_phi == null ? '0' : String(chi_phi), method: cach, rate: ty_le }); }
      catch (error) { return output({ message: error instanceof Error ? error.message : 'Tham số tính giá không hợp lệ.' }); }
      return output({ ...calculation, ...(product ? { product } : {}), ...(note ? { note } : {}),
        notice: 'Giá theo mục tiêu nhập, chưa phải kết luận về giá thị trường; trợ lý không cập nhật giá lên KiotViet.' },
        [{ kind: 'price', label: `Tính giá · ${product ? product.sku : 'vốn ' + capital} · ${cach} ${ty_le}%` }]);
    }
  }
  return output({ message: 'Công cụ không hợp lệ.' });
}
