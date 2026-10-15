'use strict';

function createPricingAi({ enabled = false, provider = null } = {}) {
  let calls = 0;
  return {
    get calls() { return calls; },
    async analyze(product, calculation) {
      if (!enabled || typeof provider !== 'function') return { status: 'disabled', message: 'Chưa cấu hình nhà cung cấp AI' };
      const payload = {
        task: 'explain_target_price',
        product: { source: product.source, productId: product.productId, variantId: product.variantId, sku: product.sku, name: product.name, price: product.price, onHand: product.onHand },
        calculation: { capital: calculation.capital, expenses: calculation.expenses, cost: calculation.cost, method: calculation.method, rate: calculation.rate, sellingPrice: calculation.sellingPrice, formula: calculation.formula },
      };
      calls++;
      return provider(payload);
    },
  };
}

module.exports = { createPricingAi };
