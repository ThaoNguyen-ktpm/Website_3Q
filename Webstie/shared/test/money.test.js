'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { vnd, tr } = require('../money');

test('vnd rounds to dong and preserves the Vietnamese currency suffix', () => {
  assert.equal(vnd(46000000), '46.000.000đ');
  assert.equal(vnd(1234.6), '1.235đ');
  assert.equal(vnd(0), '0đ');
  assert.equal(vnd(-1234.6), '-1.235đ');
});

test('tr formats millions with at most two decimal places', () => {
  assert.equal(tr(47600000), '47,6tr');
  assert.equal(tr(47678900), '47,68tr');
  assert.equal(tr(46000000), '46tr');
  assert.equal(tr(0), '0tr');
  assert.equal(tr(-47600000), '-47,6tr');
});
