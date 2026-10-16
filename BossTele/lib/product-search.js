'use strict';

const SOURCES = ['kiotviet', 'sapo-web', 'sapo-pos'];
class SearchError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

function required(config, keys) {
  for (const key of keys) {
    if (typeof config[key] !== 'string' || !config[key].trim()) {
      throw new SearchError('missing_config', `Chưa điền ${key} trong cấu hình cục bộ.`);
    }
  }
}

function sapoOrigin(config) {
  required(config, ['domain']);
  let url;
  try { url = new URL(config.domain.includes('://') ? config.domain : `https://${config.domain}`); }
  catch { throw new SearchError('invalid_config', 'Domain Sapo Web không hợp lệ.'); }
  if (url.protocol !== 'https:' || !/^[a-z0-9][a-z0-9-]*\.mysapo\.net$/i.test(url.hostname)
      || url.port || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new SearchError('invalid_config', 'Sapo Web cần domain HTTPS dạng shop.mysapo.net, không kèm đường dẫn hoặc khóa.');
  }
  return url.origin;
}

function sapoHeaders(config) {
  if (config.authType === 'token') {
    required(config, ['accessToken']);
    return { 'X-Sapo-Access-Token': config.accessToken };
  }
  if (config.authType !== 'basic') throw new SearchError('invalid_config', 'authType Sapo Web phải là basic hoặc token.');
  required(config, ['apiKey', 'apiSecret']);
  if (config.apiKey.includes(':')) throw new SearchError('invalid_config', 'API key Sapo Web không hợp lệ.');
  return { Authorization: `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString('base64')}` };
}

function validateSource(source, config) {
  if (source === 'kiotviet') {
    required(config.kiotviet || {}, ['retailer', 'clientId', 'clientSecret']);
  } else if (source === 'sapo-web') {
    sapoOrigin(config.sapoWeb || {}); sapoHeaders(config.sapoWeb || {});
  } else if (source === 'sapo-pos') {
    throw new SearchError('needs_api_contract', 'Cần tài liệu endpoint/xác thực Sapo POS do Sapo cấp; chưa gọi API POS.');
  } else throw new SearchError('invalid_source', 'Nguồn tìm kiếm không hợp lệ.');
}

function configurationStatus(config) {
  return SOURCES.map(source => {
    try { validateSource(source, config); return { source, status: 'configured_not_connected' }; }
    catch (error) { return { source, status: error.code, message: error.message }; }
  });
}

function numberOrNull(value) {
  if (!['string', 'number'].includes(typeof value) || (typeof value === 'string' && !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function matchesName(row, query) {
  return row.name.normalize('NFKC').toLocaleLowerCase('vi').includes(query.normalize('NFKC').toLocaleLowerCase('vi'));
}

async function requestJson(fetchImpl, url, options = {}) {
  let response;
  try {
    response = await fetchImpl(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(15000) });
  } catch {
    throw new SearchError('network_error', 'Không kết nối được API, hết thời gian chờ hoặc có redirect.');
  }
  if (!response.ok) {
    const messages = { 401: 'Khóa hết hạn hoặc không hợp lệ.', 403: 'Tài khoản chưa có quyền đọc sản phẩm.', 429: 'API giới hạn tốc độ; hãy thử lại sau.' };
    throw new SearchError(`http_${response.status}`, messages[response.status] || `API trả HTTP ${response.status}.`);
  }
  try { return await response.json(); }
  catch { throw new SearchError('invalid_response', 'API không trả JSON hợp lệ.'); }
}

function textOrNull(value) { return typeof value === 'string' ? value : null; }
function booleanOrNull(value) { return typeof value === 'boolean' ? value : null; }
function httpsImages(values) {
  return [...new Set(values.filter(value => {
    if (typeof value !== 'string') return false;
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; }
    catch { return false; }
  }))];
}

function kiotDetail(product, inventories) {
  return {
    ...Object.fromEntries(['name', 'fullName', 'categoryName', 'tradeMarkName', 'unit', 'description', 'createdDate', 'modifiedDate'].map(key => [key, textOrNull(product[key])])),
    weight: numberOrNull(product.weight), masterProductId: numberOrNull(product.masterProductId),
    ...Object.fromEntries(['isActive', 'allowsSale', 'hasVariants'].map(key => [key, booleanOrNull(product[key])])),
    images: httpsImages(Array.isArray(product.images) ? product.images : []),
    attributes: (Array.isArray(product.attributes) ? product.attributes : []).filter(Boolean).map(a => ({ name: textOrNull(a.attributeName), value: textOrNull(a.attributeValue) })),
    inventories: inventories.map(i => ({ branchId: numberOrNull(i.branchId), branchName: textOrNull(i.branchName), onHand: numberOrNull(i.onHand), reserved: numberOrNull(i.reserved), cost: numberOrNull(i.cost) })),
  };
}

function sapoDetail(product, variant) {
  const images = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
  const variantImage = images.find(image => image.id === variant.image_id);
  return {
    productName: textOrNull(product.name), variantTitle: textOrNull(variant.title), vendor: textOrNull(product.vendor), productType: textOrNull(product.product_type),
    tags: typeof product.tags === 'string' ? product.tags.split(',').map(tag => tag.trim()).filter(Boolean) : [],
    description: textOrNull(product.content) || textOrNull(product.body_html),
    images: httpsImages([variant.image?.src, variant.image, variantImage?.src, product.image?.src, ...images.map(image => image.src)]),
    options: (Array.isArray(product.options) ? product.options : []).filter(Boolean).slice(0, 3).map((option, index) => ({ name: textOrNull(option.name), value: textOrNull(variant[`option${option.position || index + 1}`]) })),
    barcode: textOrNull(variant.barcode), compareAtPrice: numberOrNull(variant.compare_at_price), weight: numberOrNull(variant.weight), weightUnit: textOrNull(variant.weight_unit), inventoryManagement: textOrNull(variant.inventory_management),
    createdOn: textOrNull(product.created_on), modifiedOn: textOrNull(product.modified_on), publishedOn: textOrNull(product.published_on), alias: textOrNull(product.alias),
  };
}

function kiotRow(product, detail = false) {
  if (!product || product.id === undefined || product.id === null) throw new SearchError('invalid_response', 'Sản phẩm KiotViet thiếu ID.');
  const inventories = Array.isArray(product.inventories) ? product.inventories : [];
  const quantities = inventories.map(i => numberOrNull(i.onHand));
  return {
    source: 'kiotviet', productId: product.id, variantId: null, sku: product.code || '',
    name: product.fullName || product.name || '', price: numberOrNull(product.basePrice),
    onHand: quantities.length && quantities.every(q => q !== null) ? quantities.reduce((a, b) => a + b, 0) : null,
    ...(detail ? { detail: kiotDetail(product, inventories) } : {}),
  };
}

function sapoRows(products, detail = false) {
  return products.flatMap(product => {
    if (!product || product.id === undefined || product.id === null || !Array.isArray(product.variants)) {
      throw new SearchError('invalid_response', 'Sản phẩm Sapo Web thiếu ID hoặc variants.');
    }
    return product.variants.map(variant => {
      if (!variant || variant.id === undefined || variant.id === null) throw new SearchError('invalid_response', 'Biến thể Sapo Web thiếu ID.');
      return {
        source: 'sapo-web', productId: product.id, variantId: variant.id, sku: variant.sku || '',
        name: [product.name, variant.title].filter(Boolean).join(' — '),
        price: numberOrNull(variant.price), onHand: variant.inventory_management ? numberOrNull(variant.inventory_quantity) : null,
        ...(detail ? { detail: sapoDetail(product, variant) } : {}),
      };
    });
  });
}

function createKiotAuth(config, fetchImpl) {
  let kiotToken;
  let tokenExpiresAt = 0;
  return async function kiotAuth() {
    if (kiotToken && Date.now() < tokenExpiresAt) return kiotToken;
    const credentials = config.kiotviet;
    const body = new URLSearchParams({ scopes: 'PublicApi.Access', grant_type: 'client_credentials', client_id: credentials.clientId, client_secret: credentials.clientSecret });
    const result = await requestJson(fetchImpl, 'https://id.kiotviet.vn/connect/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
    });
    if (typeof result?.access_token !== 'string' || !result.access_token) throw new SearchError('invalid_response', 'KiotViet không trả access token hợp lệ.');
    kiotToken = result.access_token;
    tokenExpiresAt = Date.now() + Math.max(0, (numberOrNull(result.expires_in) || 0) - 60) * 1000;
    return kiotToken;
  };
}

function createProductSearch(config, fetchImpl = fetch) {
  const kiotAuth = createKiotAuth(config, fetchImpl);

  async function searchOne(source, { kind, query, page, maxPages, startPage, detail }) {
    validateSource(source, config);
    if (source === 'kiotviet') {
      const headers = { Retailer: config.kiotviet.retailer, Authorization: `Bearer ${await kiotAuth()}` };
      if (kind === 'sku') {
        try {
          const result = await requestJson(fetchImpl, `https://public.kiotapi.com/products/code/${encodeURIComponent(query)}`, { headers });
          const row = kiotRow(result, detail);
          if (row.sku !== query) throw new SearchError('invalid_response', 'SKU API trả về không khớp chính xác SKU được hỏi.');
          return { source, status: 'ok', items: [row], complete: true };
        } catch (error) {
          if (error.code === 'http_404') return { source, status: 'ok', items: [], complete: true };
          throw error;
        }
      }
      const url = new URL('https://public.kiotapi.com/products');
      url.search = new URLSearchParams({ name: query, pageSize: '100', currentItem: String((page - 1) * 100), includeInventory: 'true' });
      const result = await requestJson(fetchImpl, url, { headers });
      if (!Array.isArray(result?.data)) throw new SearchError('invalid_response', 'KiotViet thiếu danh sách data.');
      const total = numberOrNull(result.total);
      return { source, status: 'ok', items: result.data.map(product => kiotRow(product, detail)).filter(row => matchesName(row, query)), page, total, hasMore: total === null ? result.data.length === 100 : page * 100 < total };
    }
    const origin = sapoOrigin(config.sapoWeb);
    const headers = sapoHeaders(config.sapoWeb);
    const items = [];
    // shortcut: exact SKU scans at most maxPages × 250 products; use a catalog index when repeated scans are costly.
    for (let currentPage = kind === 'sku' ? startPage : page, scanned = 0; scanned < (kind === 'sku' ? maxPages : 1); currentPage++, scanned++) {
      const url = new URL('/admin/products.json', origin);
      const parameters = { limit: '250', page: String(currentPage) };
      if (kind === 'name') parameters.query = query;
      url.search = new URLSearchParams(parameters);
      const result = await requestJson(fetchImpl, url, { headers });
      if (!Array.isArray(result?.products)) throw new SearchError('invalid_response', 'Sapo Web thiếu danh sách products.');
      const rows = sapoRows(result.products, detail);
      items.push(...rows.filter(row => kind === 'sku' ? row.sku === query : matchesName(row, query)));
      if (kind === 'name') return { source, status: 'ok', items, page, hasMore: result.products.length === 250 };
      if (result.products.length < 250) return { source, status: 'ok', items, complete: startPage === 1, pagesScanned: scanned + 1, hasMore: false, nextPage: null };
    }
    return { source, status: 'ok', items, complete: false, pagesScanned: maxPages, hasMore: true, nextPage: startPage + maxPages, warning: 'Chưa quét hết danh mục; kết quả SKU có thể còn thiếu.' };
  }

  return async function search(options) {
    const { source = 'all', kind, query, page = 1, maxPages = 20, startPage = 1, detail = false } = options;
    if (!['name', 'sku'].includes(kind) || typeof query !== 'string' || !query.trim() || query.length > 200) {
      throw new SearchError('invalid_query', 'Cần tên hoặc SKU từ 1 đến 200 ký tự.');
    }
    if (kind === 'sku' && query.trim() !== query) throw new SearchError('invalid_query', 'SKU không được có khoảng trắng ở đầu/cuối.');
    if (kind === 'sku' && ['.', '..'].includes(query)) throw new SearchError('invalid_query', 'SKU không hợp lệ.');
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(startPage) || startPage < 1 || !Number.isInteger(maxPages) || maxPages < 1 || maxPages > 100) {
      throw new SearchError('invalid_query', 'page phải >= 1; maxPages phải từ 1 đến 100.');
    }
    const sources = source === 'all' ? SOURCES : [source];
    if (sources.some(s => !SOURCES.includes(s))) throw new SearchError('invalid_source', 'Nguồn tìm kiếm không hợp lệ.');
    return Promise.all(sources.map(async selected => {
      try { return await searchOne(selected, { kind, query: kind === 'name' ? query.trim() : query, page, maxPages, startPage, detail }); }
      catch (error) {
        return { source: selected, status: 'error', code: error instanceof SearchError ? error.code : 'unexpected_error', message: error instanceof SearchError ? error.message : 'Không xử lý được phản hồi API.', items: [] };
      }
    }));
  };
}

/** Read complete catalogs with bounded, sequential pagination per source. */
function createCatalogFetcher(config, fetchImpl = fetch) {
  const kiotAuth = createKiotAuth(config, fetchImpl);
  return async function fetchAll(source) {
    try {
      if (!['kiotviet', 'sapo-web'].includes(source)) throw new SearchError('invalid_source', 'Nguồn danh mục không hợp lệ.');
      validateSource(source, config);
      const isKiot = source === 'kiotviet';
      const headers = isKiot
        ? { Retailer: config.kiotviet.retailer, Authorization: `Bearer ${await kiotAuth()}` }
        : sapoHeaders(config.sapoWeb);
      const items = [];
      let offset = 0;
      for (let page = 1; page <= 200; page++) {
        const url = new URL(isKiot ? 'https://public.kiotapi.com/products' : '/admin/products.json', isKiot ? undefined : sapoOrigin(config.sapoWeb));
        url.search = new URLSearchParams(isKiot
          ? { pageSize: '100', currentItem: String(offset), includeInventory: 'true', orderBy: 'createdDate', orderDirection: 'Desc' }
          : { limit: '250', page: String(page) });
        const result = await requestJson(fetchImpl, url, { headers });
        const products = isKiot ? result?.data : result?.products;
        if (!Array.isArray(products)) throw new SearchError('invalid_response', 'Nguồn không trả danh sách sản phẩm hợp lệ.');
        if (isKiot) {
          const total = numberOrNull(result.total);
          if (total === null || !Number.isSafeInteger(total) || total < 0 || (!products.length && offset < total)) {
            throw new SearchError('invalid_response', 'Phân trang KiotViet không hợp lệ hoặc thiếu dữ liệu.');
          }
          items.push(...products.map(product => kiotRow(product, true)));
          offset += products.length;
          if (offset >= total) return { source, status: 'ok', items, complete: true };
        } else {
          const rows = sapoRows(products, true);
          for (const row of rows) row.detail.webUrl = typeof row.detail.alias === 'string' && /^[a-z0-9_-]+$/i.test(row.detail.alias)
            ? new URL(`/${row.detail.alias}`, sapoOrigin(config.sapoWeb)).href : null;
          items.push(...rows);
          if (products.length < 250) return { source, status: 'ok', items, complete: true };
        }
      }
      return { source, status: 'ok', items, complete: false };
    } catch (error) {
      return { source, status: 'error', code: error instanceof SearchError ? error.code : 'unexpected_error', message: error instanceof SearchError ? error.message : 'Không xử lý được phản hồi API.', items: [] };
    }
  };
}

module.exports = { createProductSearch, createCatalogFetcher, configurationStatus, SearchError };
