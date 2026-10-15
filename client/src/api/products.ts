export type Product = {
  id: number;
  name: string;
  priceVnd: number;
  category: string;
};

export class UnauthenticatedError extends Error {}

export async function getProducts(signal?: AbortSignal): Promise<Product[]> {
  const response = await fetch('/api/products', { signal, credentials: 'include' });
  if (response.status === 401) throw new UnauthenticatedError();
  if (!response.ok) throw new Error('Không thể tải danh sách sản phẩm.');
  const data = (await response.json()) as { products: Product[] };
  return data.products;
}
