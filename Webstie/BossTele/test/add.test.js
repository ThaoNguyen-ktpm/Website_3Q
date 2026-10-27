'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { parseFiniteNumber, add } = require('../add');
const cli = path.join(__dirname, '..', 'add.js');

function check(args, status, stdout, stderr) {
  const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, status);
  assert.equal(result.stdout, stdout);
  assert.equal(result.stderr, stderr);
}

test('parses decimal forms and adds finite numbers', () => {
  for (const value of ['1', '-5', '+3', '2.5', '.5', '5.', '1e3', '-1.2E-4', '0', '-0']) {
    assert.equal(parseFiniteNumber(value), Number(value));
  }
  assert.equal(add(2, 3), 5);
  assert.throws(() => add(Infinity, 0), /expected finite numbers/);
  assert.throws(() => add(1e308, 1e308), /result overflow/);
});

for (const [args, expected] of [
  [['2', '3'], '5'], [['-1.5', '0.5'], '-1'], [['1e3', '.5'], '1000.5'],
  [['+3', '-0'], '3'], [['-0', '-0'], '0'], [['0.1', '0.2'], '0.30000000000000004'],
  [['1.7976931348623157e308', '0'], '1.7976931348623157e+308'],
]) {
  test(`CLI success: ${args.join(' ')}`, () => check(args, 0, `${expected}\n`, ''));
}

for (const args of [[], ['1'], ['1', '2', '3']]) {
  test(`rejects ${args.length} arguments`, () => {
    check(args, 2, '', `Error: expected exactly 2 numbers, got ${args.length}\nUsage: node add.js <a> <b>\n`);
  });
}

for (const value of ['', ' 1', '1 ', '1\n', '1\r\n', 'abc', '1abc', '0x10', '1_000', '1,5', 'Infinity', 'NaN', '--1', '1e', '.', '1e400']) {
  test(`rejects invalid value ${JSON.stringify(value)} in either position`, () => {
    assert.throws(() => parseFiniteNumber(value), /invalid number/);
    for (const args of [[value, '1'], ['1', value]]) {
      check(args, 1, '', `Error: invalid number: "${value}"\n`);
    }
  });
}

test('reports the first invalid argument only', () => {
  check(['abc', 'xyz'], 1, '', 'Error: invalid number: "abc"\n');
});

for (const value of ['1e308', '-1e308']) {
  test(`rejects overflow for ${value}`, () => {
    check([value, value], 1, '', 'Error: result overflow\n');
  });
}
