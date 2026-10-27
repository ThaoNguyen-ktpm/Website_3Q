'use strict';

const { createProductSearch, configurationStatus } = require('./lib/product-search');
const { loadConnectionConfig } = require('./lib/connection-config');

function parseArgs(args) {
  const parsed = {};
  const valueFlags = ['source', 'name', 'sku', 'page', 'max-pages'];
  for (let index = 0; index < args.length; index++) {
    const flag = args[index].replace(/^--/, '');
    if (args[index] !== `--${flag}` || Object.hasOwn(parsed, flag)) throw new Error('Tham số không hợp lệ hoặc bị lặp.');
    if (['help', 'status'].includes(flag)) { parsed[flag] = true; continue; }
    if (!valueFlags.includes(flag) || index + 1 >= args.length) throw new Error('Tham số không hợp lệ hoặc thiếu giá trị.');
    parsed[flag] = args[++index];
  }
  if (parsed.name !== undefined && parsed.sku !== undefined) throw new Error('Chỉ chọn --name hoặc --sku.');
  return parsed;
}

async function main(args = process.argv.slice(2)) {
  try {
    const flags = parseArgs(args);
    if (flags.help) {
      console.log('node search-products.js --source kiotviet|sapo-web|sapo-pos|all --name "Chanel"\nnode search-products.js --source all --sku SP000001\nnode search-products.js --status\nTùy chọn: --page 1, --max-pages 20 (quét SKU Sapo Web).');
      return;
    }
    const config = loadConnectionConfig();
    if (flags.status) { console.log(JSON.stringify(configurationStatus(config), null, 2)); return; }
    const results = await createProductSearch(config)({
      source: flags.source || 'all', kind: flags.sku !== undefined ? 'sku' : 'name', query: flags.sku ?? flags.name,
      page: flags.page === undefined ? 1 : Number(flags.page), maxPages: flags['max-pages'] === undefined ? 20 : Number(flags['max-pages']),
    });
    console.log(JSON.stringify(results, null, 2));
    if (results.some(result => result.status === 'error' || result.complete === false)) process.exitCode = 2;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

if (require.main === module) main();
module.exports = { parseArgs, main };
