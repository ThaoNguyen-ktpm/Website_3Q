'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateTargetPrice } = require('../target-price');

test('exact target prices, ceiling, zero rate and integer values beyond Number precision', () => {
  const parameters = { capital: '150000000', expenses: '0', method: 'markup', rate: '12.5' };
  assert.equal(calculateTargetPrice(parameters).sellingPrice, '168750000');
  assert.equal(calculateTargetPrice({ ...parameters, method: 'margin' }).sellingPrice, '171428572');
  assert.equal(calculateTargetPrice({ capital: '1', expenses: '0', method: 'markup', rate: '0.000000000000000001' }).sellingPrice, '2');
  assert.equal(calculateTargetPrice({ ...parameters, capital: '9007199254740993', expenses: '1', rate: '0' }).sellingPrice, '9007199254740994');
  assert.equal(calculateTargetPrice({ capital: '100', expenses: '20', method: 'markup', rate: '10' }).sellingPrice, '132');
  assert.equal(calculateTargetPrice({ capital: '1', expenses: '0', method: 'margin', rate: '99.999' }).sellingPrice, '100000');
  for (const update of [{ capital: '0' }, { expenses: '-1' }, { capital: '1.5' }, { rate: 'NaN' }, { rate: '-1' }, { method: 'other' }, { method: 'margin', rate: '100' }]) {
    assert.throws(() => calculateTargetPrice({ ...parameters, ...update }));
  }
});

