export type CatalogSource = 'kiotviet' | 'sapo-web';
export type CatalogQuery = { q: string; kind: 'name' | 'sku'; source: 'all' | CatalogSource; page: number };
export type CatalogDetail = {
  name?: string | null; fullName?: string | null; categoryName?: string | null; tradeMarkName?: string | null;
  unit?: string | null; weight?: number | null; description?: string | null; images: string[];
  attributes?: { name: string | null; value: string | null }[];
  isActive?: boolean | null; allowsSale?: boolean | null; hasVariants?: boolean | null; masterProductId?: number | null;
  createdDate?: string | null; modifiedDate?: string | null;
  inventories?: { branchId: number | null; branchName: string | null; onHand: number | null; reserved: number | null; cost?: number | null }[];
  productName?: string | null; variantTitle?: string | null; vendor?: string | null; productType?: string | null;
  tags?: string[]; options?: { name: string | null; value: string | null }[]; barcode?: string | null;
  compareAtPrice?: number | null; weightUnit?: string | null; inventoryManagement?: string | null;
  createdOn?: string | null; modifiedOn?: string | null; publishedOn?: string | null; alias?: string | null; webUrl?: string | null;
};
export type CatalogItem = {
  source: CatalogSource; productId: number | string; variantId: number | string | null;
  sku: string; name: string; price: number | null; onHand: number | null; detail: CatalogDetail;
};
export type CatalogResult = {
  source: CatalogSource; status: 'ok' | 'error'; items: CatalogItem[]; page: number; hasMore: boolean;
  nextPage?: number | null; complete?: boolean; warning?: string; code?: string; message?: string;
};
export type CatalogResponse = { results: CatalogResult[]; canViewCost: boolean };

export async function searchCatalog(query: CatalogQuery, signal?: AbortSignal): Promise<CatalogResponse> {
  const parameters = new URLSearchParams({ ...query, page: String(query.page) });
  const response = await fetch(`/api/catalog/search?${parameters}`, { credentials: 'include', signal, cache: 'no-store' });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message ?? 'Không thể tìm sản phẩm. Vui lòng thử lại.');
  if (!data || !Array.isArray(data.results)) throw new Error('Phản hồi tìm kiếm không hợp lệ. Vui lòng thử lại.');
  return data;
}

export type MergedCatalogItem = {
  key: string; sku: string; name: string; price: number | null; onHand: number | null;
  image: string | null; images: string[]; createdAt: string | null;
  sources: CatalogSource[]; kiot?: CatalogDetail; sapo?: CatalogDetail;
};
export type CatalogSyncState = {
  total: number; syncedAt: string | null; syncing: boolean;
  sources: Record<CatalogSource, { status: 'ok' | 'error'; count: number; message?: string }>;
};
export type ProductsQuery = { q: string; page: number; pageSize: number };
export type CatalogProductsResponse = CatalogSyncState & { catalogTotal: number; items: MergedCatalogItem[]; page: number; pageSize: number; pageCount: number };

export async function listCatalogProducts(query: ProductsQuery, signal?: AbortSignal): Promise<CatalogProductsResponse> {
  const parameters = new URLSearchParams({ q: query.q, page: String(query.page), pageSize: String(query.pageSize) });
  const response = await fetch(`/api/catalog/products?${parameters}`, { credentials: 'include', signal, cache: 'no-store' });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message ?? 'Không tải được danh mục. Vui lòng thử lại.');
  if (!data || !Array.isArray(data.items) || !data.sources || !Number.isInteger(data.pageCount)) throw new Error('Phản hồi danh mục không hợp lệ. Vui lòng thử lại.');
  return data;
}

export async function syncCatalogProducts(signal?: AbortSignal): Promise<CatalogSyncState> {
  const response = await fetch('/api/catalog/sync', { method: 'POST', credentials: 'include', signal, cache: 'no-store' });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message ?? 'Không đồng bộ được danh mục. Vui lòng thử lại.');
  if (!data?.sources || typeof data.syncing !== 'boolean') throw new Error('Phản hồi đồng bộ không hợp lệ. Vui lòng thử lại.');
  return data;
}
