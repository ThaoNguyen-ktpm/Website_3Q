# TASK-013 — Chữ và logo trang đăng nhập (skill design-taste-frontend)

- Dự án: web (`client/`).
- Người phụ trách: Claude (đặc tả, review), Codex (triển khai).
- Trạng thái: ready — Bảo duyệt "OK" ngày 2026-10-15.
- Hành động gần nhất: Claude đã chép logo vào `client/public/brand/baoq-logo.png` (903×738, nền đặc `#201502`, màu đồng trung bình `#ae8d6c`, phần hình ở x=37..838, y=84..667, lệch trái 14px so với tâm ảnh) và cài `@fontsource/cormorant-garamond` vào workspace `client`.
- Bước tiếp theo: Codex triển khai, ghi `tasks/TASK-013-result.md`, đặt `ready_for_review`.
- Phạm vi duyệt: chỉ `client/src/pages/LoginPage.tsx`, phần CSS `.login-*` trong `client/src/style.css`, import font. Không đổi logic đăng nhập, video, server.

## Luật thiết kế bắt buộc (skill design-taste-frontend)
Không nhãn nhỏ chữ hoa giãn cách phía trên tiêu đề; không gradient; không bóng đổ, không glow; không viền 1px; không glass/blur; không emoji; tối đa 2 font; chữ đọc chính màu đậm đủ, ≥16px. Ngoại lệ ghi nhận: dòng "BUY · SELL · CONSIGN" nằm trong file logo thương hiệu, giữ nguyên.

## Token màu (CSS custom properties trên `.login-page`)
- `--login-ground: #120c03` — nền dự phòng phẳng khi không có video (thay gradient hiện tại).
- `--login-card: #201502` — nền thẻ, trùng nền logo để logo liền vào thẻ.
- `--login-heading: #e6d3b8` — tiêu đề.
- `--login-ink: #f3eadc` — câu phụ.
- `--login-muted: #bba88f` — dòng điều khoản.
- `--login-accent: #ae8d6c` — viền focus.
- `--login-error: #ffb4a6` — lỗi.

## Bố cục
- Giữ video nền, lớp tối `.login-shade`, `transform: scale(1.28)` như TASK-012.
- Bỏ link chữ "BaoQLuxury" phía trên thẻ và nhãn "PORTAL ACCESS".
- Thẻ `.login-card`: `width: min(100%, 440px)`, nền `--login-card`, góc vuông (`border-radius: 0`), không viền, không bóng, padding 48px 40px (≤520px: 32px 24px), căn giữa nội dung.
- Thứ tự trong thẻ:
  1. Logo `<img src="/brand/baoq-logo.png" alt="BaoQ Luxury — Buy · Sell · Consign" width="903" height="738">`, hiển thị rộng 240px (≤520px: 200px), `height: auto`, `transform: translateX(1.55%)` để phần hình nằm đúng tâm (14/903). Khoảng cách dưới 24px.
  2. `<h1>` "Đăng nhập": Cormorant Garamond 500, 44px (≤520px: 36px), `line-height: 1`, `letter-spacing: -0.01em`, màu `--login-heading`.
  3. Câu phụ `<p>`: "Dành cho tài khoản Google đã được BaoQ Luxury cấp quyền." font hệ thống hiện có, 16px, `line-height: 1.5`, màu `--login-ink`. Cách tiêu đề 12px, cách nút 32px.
  4. Nút Google chính thức: giữ `renderButton`, đổi tùy chọn thành `theme: 'filled_black'`, `shape: 'rectangular'`, `text: 'continue_with'`, `locale: 'vi'`, `size: 'large'`. Trạng thái tải/lỗi giữ như cũ, màu lỗi `--login-error`.
  5. Dòng điều khoản: 14px, `line-height: 1.5`, màu `--login-muted`, cách nút 32px.
- Focus nhìn thấy được: `outline: 2px solid var(--login-accent)`.

## Font
- Import `@fontsource/cormorant-garamond/500.css` (đã có bản tiếng Việt trong gói). Không gọi Google Fonts CDN. Chỉ 2 họ font: Cormorant Garamond (tiêu đề) và font hệ thống hiện có.

## Chuyển động
- Logo, tiêu đề, câu phụ, nút, điều khoản lần lượt hiện: `opacity 0→1` và `translateY(16px→0)`, 600ms, `cubic-bezier(.2,.7,.2,1)`, trễ tăng dần 80ms, chạy một lần khi tải trang. Chỉ dùng CSS (`animation-fill-mode: both`); không ẩn nội dung bằng JS.
- `@media (prefers-reduced-motion: reduce)`: bỏ animation, nội dung hiện ngay.

## Kiểm tra
- `npm run build`, `npm test` đạt.
- Không tràn ngang ở 360px; tiêu đề một dòng ở mọi cỡ.
- Không còn `radial-gradient`, `box-shadow`, `border: 1px` trong các rule `.login-*`.

## Ngoài phạm vi
Sửa file logo, header/trang chủ, logic đăng nhập, commit.
