/** Kiot codes are case-insensitive and may have one alphanumeric suffix. */
export function extractSkus(text: string): string[] {
  return (text.match(/(?<![A-Za-z0-9])SP\d{4,}(?:_[A-Za-z0-9]+)?(?![A-Za-z0-9])/gi) ?? []).map(sku => sku.toUpperCase());
}

/** Exact codes win; a bare base may resolve only when there is one candidate. */
export function matchingSkus<T extends { sku: string }>(items: T[], sku: string): T[] {
  const code = sku.toUpperCase();
  const exact = items.find(item => item.sku.toUpperCase() === code);
  return exact ? [exact] : code.includes('_') ? [] : items.filter(item => item.sku.split('_')[0].toUpperCase() === code);
}

export const skuChoice = (items: { sku: string }[]) => `Có nhiều sản phẩm cùng mã gốc. Bạn chọn mã nào: ${items.slice(0, 5).map(item => item.sku).join(', ')}?`;
