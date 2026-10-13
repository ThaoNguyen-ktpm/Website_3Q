import { findProducts } from '../models/productModel.js';

export async function listProducts(categorySlug?: string) {
  const products = await findProducts(categorySlug);
  return products.map((product) => ({
    id: product.id,
    name: product.name,
    priceVnd: product.priceVnd,
    category: product.category.name,
  }));
}
