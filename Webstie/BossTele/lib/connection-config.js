'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');

function configFromEnv(values) {
  return {
    kiotviet: {
      retailer: values.KIOT_RETAILER || '',
      clientId: values.KIOT_CLIENT_ID || '',
      clientSecret: values.KIOT_CLIENT_SECRET || '',
    },
    sapoWeb: {
      domain: values.SAPO_SHOP || '',
      authType: values.SAPO_ACCESS_TOKEN ? 'token' : 'basic',
      apiKey: values.SAPO_API_KEY || '',
      apiSecret: values.SAPO_API_SECRET || '',
      accessToken: values.SAPO_ACCESS_TOKEN || '',
    },
  };
}

function loadConnectionConfig(root = path.join(__dirname, '..'), environment = process.env) {
  const envPath = path.join(root, '.env');
  if (fs.existsSync(envPath)) {
    try {
      // The requested project .env is authoritative; do not mix credentials from another source.
      return configFromEnv(parseEnv(fs.readFileSync(envPath, 'utf8').replace(/^\uFEFF/, '')));
    } catch { throw new Error('Không đọc được .env hợp lệ trong thư mục BossTele.'); }
  }
  const connectionKeys = ['KIOT_RETAILER', 'KIOT_CLIENT_ID', 'KIOT_CLIENT_SECRET', 'SAPO_SHOP', 'SAPO_API_KEY', 'SAPO_API_SECRET', 'SAPO_ACCESS_TOKEN'];
  if (connectionKeys.some(key => environment[key] !== undefined)) return configFromEnv(environment);
  try {
    const config = JSON.parse(fs.readFileSync(path.join(root, 'config', 'connections.local.json'), 'utf8').replace(/^\uFEFF/, ''));
    if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error();
    return config;
  } catch { throw new Error('Chưa có cấu hình hợp lệ trong .env hoặc config/connections.local.json.'); }
}

module.exports = { configFromEnv, loadConnectionConfig };
