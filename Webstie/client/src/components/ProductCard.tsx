import type { Product } from '../api/products';

const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });

export function ProductCard({ product }: { product: Product }) {
  return (
    <li className="product-card">
      <div className="product-art" aria-hidden="true">
        <span>{product.category}</span>
      </div>
      <div className="product-details">
        <p className="product-category">{product.category}</p>
        <h2>{product.name}</h2>
        <p className="product-price">{vnd.format(product.priceVnd)}</p>
      </div>
    </li>
  );
}
