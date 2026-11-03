'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { fold } = require('../text');

test('fold removes Vietnamese accents and đ/Đ, retaining punctuation and decimals', () => {
  assert.equal(fold('TÚI CHANEL ĐỎ đẸP 47,6tr! 20%'), 'tui chanel do dep 47,6tr! 20%');
  assert.equal(fold('e\u0302\u0301'), 'e');
});

test('fold accepts nullish values and converts values to strings', () => {
  assert.equal(fold(null), '');
  assert.equal(fold(undefined), '');
  assert.equal(fold(123), '123');
  assert.equal(fold(''), '');
});
