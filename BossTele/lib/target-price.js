'use strict';

function calculateTargetPrice({ capital, expenses, method, rate }) {
  if (![capital, expenses].every(value => typeof value === 'string' && /^\d+$/.test(value))
      || typeof rate !== 'string' || !/^\d+(?:\.\d+)?$/.test(rate)
      || !['markup', 'margin'].includes(method)) throw new Error('Tham số tính giá không hợp lệ.');
  const cost = BigInt(capital) + BigInt(expenses);
  if (BigInt(capital) <= 0n) throw new Error('Vốn phải lớn hơn 0.');
  const [whole, fraction = ''] = rate.split('.');
  const scale = 10n ** BigInt(fraction.length);
  const rateInteger = BigInt(whole + fraction);
  const hundred = 100n * scale;
  if (method === 'margin' && rateInteger >= hundred) throw new Error('Margin phải dưới 100%.');
  const numerator = method === 'markup' ? cost * (hundred + rateInteger) : cost * hundred;
  const denominator = method === 'markup' ? hundred : hundred - rateInteger;
  return {
    capital: BigInt(capital).toString(), expenses: BigInt(expenses).toString(), cost: cost.toString(), method, rate,
    sellingPrice: ((numerator + denominator - 1n) / denominator).toString(),
    formula: method === 'markup' ? '(vốn + chi_phí) × (1 + tỷ_lệ/100)' : '(vốn + chi_phí) / (1 − tỷ_lệ/100)',
  };
}

module.exports = { calculateTargetPrice };
