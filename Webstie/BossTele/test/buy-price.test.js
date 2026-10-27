'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { maxBuyPrice, withBuyPrice, loadConfig } = require('../lib/buy-price');

// Bảo 2026-10-20: purchase hint from the example tiers (price-tiers.json); gợi ý, chưa phải chính sách.
const bags = [{ under: 50e6, profit: 0.3 }, { under: 100e6, profit: 0.23 }, { under: 150e6, profit: 0.15 }, { under: 200e6, profit: 0.125 }, { under: null, profit: 0.1 }];
const config = { categories: { 'Túi': bags }, founderReview: { atLeast: 200e6, keywords: ['Birkin', 'VCA'] } };

test('the tier is the one whose cost range holds the result, rounded down to 100.000đ', () => {
  assert.deepEqual([40e6, 64.9e6, 65e6, 330e6].map(sale => maxBuyPrice(sale, bags)),
    [{ cost: 30.7e6, profit: 0.3 }, { cost: 49.9e6, profit: 0.3 }, { cost: 52.8e6, profit: 0.23 }, { cost: 300e6, profit: 0.1 }]);
  assert.deepEqual(Object.keys(loadConfig().categories), ['Túi']);
});

test('the market line becomes the range, the purchase hint and a check of Bảo\'s own price', () => {
  const reply = 'Tên: Túi Chanel Vanity\nDanh mục: Túi\nGiá thị trường (Kiot): 55000000-75000000, giữa 65000000, 2 món: SP024754, SP024640\nHỏi Bảo:\n1. Size?';
  assert.equal(withBuyPrice(reply, 54e6, config), 'Tên: Túi Chanel Vanity\nDanh mục: Túi\nGiá thị trường (Kiot): 55tr–75tr, giữa 65tr\n'
    + 'Giá thu tối đa: 52,8tr (lời 23% trên vốn) — gợi ý, chưa phải chính sách\nGiá thu 54tr: cao hơn mức gợi ý 1,2tr\nHỏi Bảo:\n1. Size?');
  assert.equal(withBuyPrice('Giá thị trường: chưa tìm được', null, config), 'Giá thị trường: chưa tìm được');
});

test('a category without a table gets no hint, and rare or high-value items go to Bảo/Nguyên', () => {
  assert.match(withBuyPrice('Tên: Rolex Datejust\nDanh mục: Đồng hồ\nGiá thị trường (web): 250000000-300000000, giữa 280000000', null, config),
    /Giá thu tối đa: chưa có tỷ lệ lời cho Đồng hồ \(thêm vào price-tiers\.json\)$/);
  assert.match(withBuyPrice('Tên: Túi Hermès Birkin 25\nDanh mục: Túi\nGiá thị trường (web): 150000000-190000000, giữa 170000000', null, config),
    /Giá thu: cần Bảo\/Nguyên duyệt \(hàng hiếm hoặc giá trị cao\); theo bảng lời 15% là 147,8tr$/);
});
