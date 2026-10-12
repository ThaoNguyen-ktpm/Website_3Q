import { useHealth } from '../hooks/useHealth';

export function HomePage() {
  const health = useHealth();
  const status = health === 'online' ? 'API sẵn sàng' : health === 'loading' ? 'Đang kiểm tra API…' : 'API chưa kết nối';

  return (
    <main className="content">
      <p className="eyebrow">DỰ ÁN THỬ</p>
      <h1>Khung cửa hàng đã sẵn sàng.</h1>
      <p>Đây là bản khởi tạo. Sản phẩm, giỏ hàng và đặt hàng sẽ được bổ sung ở các task tiếp theo.</p>
      <div className="status" role="status">{status}</div>
    </main>
  );
}
