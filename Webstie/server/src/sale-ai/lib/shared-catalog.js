import { BRANCH } from './kiot.js';

// Bảo 2026-10-19 (TASK-036): Website_3Q already downloads the whole KiotViet catalog. "Tải lại sản phẩm từ Kiot" asks it to
// sync once and reuses those rows instead of a second download. Writes and per-product re-reads still go to Kiot directly.
// Before embedding, a separately started tool without the website token downloaded Kiot here.
// TASK-111: that standalone adapter is retired; runtime.ts now supplies the catalog callback directly.

/** A website catalog row back in the shape of a Kiot /products item, so normalizeProduct stays the single mapping. */
export function rawFromWebRow(row) {
  const detail = row.detail ?? {};
  return {
    id: row.productId, code: row.sku, name: detail.name ?? row.name, fullName: detail.fullName ?? null, basePrice: row.price,
    createdDate: detail.createdDate, isActive: detail.isActive, description: detail.description, modifiedDate: detail.modifiedDate,
    categoryId: detail.categoryId,
    // The website keeps only whether Kiot reports any tax; normalizeProduct turns it back into taxPresent.
    saleTax: detail.taxPresent === true,
    inventories: (detail.inventories ?? []).filter(inventory => inventory.branchId === BRANCH).map(({ branchId, onHand }) => ({ branchId, onHand })),
  };
}
