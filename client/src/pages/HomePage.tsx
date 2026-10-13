import { Footer } from '../components/Footer';
import { ProductCard } from '../components/ProductCard';
import { useProducts } from '../hooks/useProducts';

export function HomePage() {
  const state = useProducts();

  return (
    <>
      <main className="content">
        <div className="intro">
          <p className="eyebrow">CỬA HÀNG MẪU</p>
          <h1>Khám phá sản phẩm</h1>
          <p>Túi xách, đồng hồ và phụ kiện trong dự án thử nghiệm.</p>
        </div>

        {state.status === 'loading' && <p role="status">Đang tải sản phẩm…</p>}
        {state.status === 'error' && <p role="alert">{state.message}</p>}
        {state.status === 'success' && (
          <section aria-label="Danh sách sản phẩm">
            <p className="product-count">{state.products.length} sản phẩm</p>
            {state.products.length === 0 ? (
              <p>Chưa có sản phẩm nào.</p>
            ) : (
              <ul className="product-grid">
                {state.products.map((product) => <ProductCard key={product.id} product={product} />)}
              </ul>
            )}
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
