'use strict';

// Bảo 2026-10-20 case 9: products sold out on Kiot (the source of truth) or held for a customer that the website still offers,
// so a customer could order something already gone. Read-only: the Sapo Web list (createCatalogFetcher) against the Kiot
// snapshot the website keeps. The bot only reports; hiding the products on the website stays with Bảo.
const reservedOf = row => (row.detail?.inventories ?? []).reduce((sum, inventory) => sum + (Number(inventory.reserved) || 0), 0);

function stockGaps(kiotRows, sapoRows) {
  const kiot = new Map(kiotRows.map(row => [row.sku, row]));
  const gaps = [];
  for (const web of sapoRows) {
    const shop = web.sku && kiot.get(web.sku);
    // On sale on the website: published, and stock either not tracked or above zero.
    if (!shop || !web.detail?.publishedOn || (web.onHand !== null && web.onHand <= 0)) continue;
    const reason = (shop.onHand ?? 0) <= 0 ? 'Kiot đã hết' : reservedOf(shop) >= shop.onHand ? 'khách đã cọc giữ' : null;
    if (reason) gaps.push({ sku: web.sku, name: shop.name, reason, url: web.detail.webUrl ?? null });
  }
  return gaps;
}

function stockGapText(gaps, { syncedAt = null, limit = 20 } = {}) {
  const when = syncedAt ? ` (Kiot cập nhật ${new Date(syncedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })})` : '';
  if (!gaps.length) return `Web và Kiot khớp: không có món nào web còn bán mà Kiot đã hết hoặc khách đang giữ${when}.`;
  return [
    `Web còn bán ${gaps.length} món nhưng Kiot đã hết hoặc khách đang giữ${when}:`,
    ...gaps.slice(0, limit).map(gap => `- ${gap.sku} ${gap.name} (${gap.reason})${gap.url ? ` ${gap.url}` : ''}`),
    ...(gaps.length > limit ? [`… và ${gaps.length - limit} món nữa`] : []),
    'Ẩn hoặc tắt bán các món này trên web (bot không tự sửa).',
  ].join('\n');
}

module.exports = { stockGaps, stockGapText };
