import type { Permission } from '../../config/permissions.js';
import { fold } from './brands.js';
import { executeTool, type ProductCard, type Source } from './tools.js';

type Reply = { reply: string; offTopic: false; sources: Source[]; products?: ProductCard[]; suggestions?: string[] };
type Message = { role: string; content: string };

// "giá chốt", "chốt giá", "đề xuất giá", "giảm được bao nhiêu", "lời bao nhiêu"… — negotiation/profit questions, not look-ups.
const pricingIntent = /\bgia chot\b|\bchot gia\b|\bde xuat gia\b|\bgia de xuat\b|\bgiam (duoc|gia|bao nhieu|toi da)\b|\bthuong luong\b|\bdeal\b|\bgia (thap nhat|san|toi thieu)\b|\b(loi|lai) (bao nhieu|may|duoc)\b|\bbien loi nhuan\b|\bgia von\b/;
const targetRate = /\b(?:loi|lai|markup)\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*%/;
// Keeps "%" and decimals, which the brand fold strips.
const light = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').toLowerCase();
const vnd = (value: number) => `${Math.round(value).toLocaleString('vi-VN')}đ`;
const pct = (value: number) => `${value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`;

/** Last SKU mentioned in the conversation (current question first, then earlier turns). */
function lastSku(messages: Message[]) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const sku = messages[i].content.match(/\bSP\d{4,}\b/gi)?.at(-1);
    if (sku) return sku.toUpperCase();
  }
  return null;
}

/**
 * Closing-price questions answered from real KiotViet numbers. BaoQ's pricing policy is not approved
 * yet (BossTele/docs/PRICE-SYSTEM.md), so the assistant never invents a "giá chốt"; it shows price, cost
 * and current profit, and computes the floor price for a profit rate the user picks.
 */
export async function pricingAnswer(messages: Message[], permissions: Permission[]): Promise<Reply | null> {
  const question = fold(messages.at(-1)!.content);
  const rate = light(messages.at(-1)!.content).match(targetRate)?.[1]?.replace(',', '.');
  if (!pricingIntent.test(question) && !rate) return null;
  const sku = lastSku(messages);
  if (!sku) return rate ? null : { reply: 'Bạn cho mình SKU sản phẩm (ví dụ SP014899) để mình tính giá chốt nhé.', offTopic: false, sources: [] };
  const found = await executeTool('tim_san_pham', { q: sku, limit: 1 }, permissions);
  const product = found.products?.find(item => item.sku === sku);
  if (!product) return { reply: found.content.includes('không có quyền') ? 'Bạn không có quyền xem sản phẩm.' : `Không tìm thấy SKU ${sku} trên KiotViet.`, offTopic: false, sources: [] };
  const costs = ((JSON.parse(found.content) as { items?: { sku: string; cost?: { cost: number | null }[] }[] }).items ?? [])
    .find(item => item.sku === sku)?.cost?.map(row => row.cost).filter((value): value is number => typeof value === 'number' && value > 0) ?? [];
  const base = { offTopic: false as const, sources: found.sources, products: [product] };
  if (!permissions.includes('products.cost')) {
    return { ...base, reply: `Giá bán hiện tại ${product.price ? vnd(product.price) : 'chưa có'}. Bạn không có quyền xem giá vốn nên mình không tính được mức giá chốt.` };
  }
  if (!costs.length) return { ...base, reply: `${sku} chưa có giá vốn trên KiotViet nên mình chưa tính được giá chốt. Giá bán hiện tại ${product.price ? vnd(product.price) : 'chưa có'}.` };
  // Branches can disagree on cost; the highest keeps the floor price safe.
  const cost = Math.max(...costs);
  if (rate) {
    const calculation = JSON.parse((await executeTool('tinh_gia', { sku, cach: 'markup', ty_le: rate }, permissions)).content) as { sellingPrice?: string; message?: string };
    if (!calculation.sellingPrice) return { ...base, reply: calculation.message ?? 'Không tính được giá với mức lời này.' };
    const floor = Number(calculation.sellingPrice);
    const room = product.price ? product.price - floor : null;
    return { ...base, sources: [...found.sources, { kind: 'price', label: `Tính giá · ${sku} · markup ${rate}%` }],
      reply: `Giá thấp nhất để lời ${rate}% trên vốn: ${vnd(floor)}.${room === null ? '' : room >= 0
        ? ` So với giá bán ${vnd(product.price!)}, có thể giảm tối đa ${vnd(room)}.`
        : ` Giá bán hiện tại ${vnd(product.price!)} đang thấp hơn mức này ${vnd(-room)}, không nên giảm thêm.`}` };
  }
  // Bảo 2026-10-17: keep it short — no closing price is set yet (PRICE-SYSTEM pending).
  return { ...base, reply: 'Chưa đề ra giá chốt.',
    suggestions: [10, 15, 20].map(value => `${sku} giá chốt lời ${value}%`) };
}
