import { Link } from 'react-router-dom';

export function Header() {
  return (
    <header className="site-header">
      <Link to="/" className="brand">Website thử nghiệm</Link>
      <span>Paperclip · Task 1</span>
    </header>
  );
}
