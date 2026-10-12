export type Product = {
  id: number;
  name: string;
  priceVnd: number;
  category: string;
};

export async function getProducts(signal?: AbortSignal): Promise<Product[]> {
  const response = await fetch('/api/products', { signal });
  if (!response.ok) throw new Error('Không thể tải danh sách sản phẩm.');
  const data = (await response.json()) as { products: Product[] };
  return data.products;
}
