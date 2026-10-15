'use strict';

const DECIMAL = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;

function parseFiniteNumber(value) {
  if (typeof value !== 'string' || value.trim() !== value || !DECIMAL.test(value) || !Number.isFinite(Number(value))) {
    throw new Error(`invalid number: "${value}"`);
  }
  return Number(value);
}

function add(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new Error('expected finite numbers');
  }
  const result = a + b;
  if (!Number.isFinite(result)) throw new Error('result overflow');
  return result;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length !== 2) {
    console.error(`Error: expected exactly 2 numbers, got ${args.length}`);
    console.error('Usage: node add.js <a> <b>');
    process.exitCode = 2;
  } else {
    try {
      console.log(String(add(parseFiniteNumber(args[0]), parseFiniteNumber(args[1]))));
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exitCode = 1;
    }
  }
}

module.exports = { parseFiniteNumber, add };
