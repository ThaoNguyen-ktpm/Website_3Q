import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return <main className="content"><h1>Không tìm thấy trang</h1><Link to="/">Về trang chủ</Link></main>;
}
