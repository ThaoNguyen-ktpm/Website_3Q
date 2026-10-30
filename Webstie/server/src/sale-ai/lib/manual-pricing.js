// Shared by the local server and browser. No AI or external service calls.
export function validateManual(price, allowance) {
  if (!Number.isSafeInteger(price) || price <= 0) throw new Error('Giá bán tay phải là số nguyên đồng lớn hơn 0');
  if (!Number.isSafeInteger(allowance) || allowance < 0) throw new Error('Quyền sale phải là số nguyên đồng từ 0 trở lên');
  if (allowance >= price) throw new Error('Giá chốt thấp nhất phải lớn hơn 0');
}

export function percentageSuggestion(base, percent, subtract = false) {
  if (percent === '' || percent == null) return null;
  if (!Number.isSafeInteger(base) || base <= 0) throw new Error('Cần giá cơ sở nguyên đồng lớn hơn 0 để gợi ý');
  const value = String(percent).trim();
  if (!/^\d+(?:\.\d+)?$/.test(value) || Number(value) > 100) throw new Error('Tỷ lệ phải từ 0 đến 100%');
  const [whole, fraction = ''] = value.split('.');
  const numerator = BigInt(whole + fraction);
  const denominator = 100n * 10n ** BigInt(fraction.length);
  const amount = BigInt(base) * numerator;
  if (amount % denominator !== 0n) throw new Error('Gợi ý có phần lẻ đồng. Hãy nhập số tiền nguyên đồng, không tự làm tròn.');
  const discount = Number(amount / denominator);
  return subtract ? base - discount : discount;
}
