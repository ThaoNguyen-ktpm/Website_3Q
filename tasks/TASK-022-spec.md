# TASK-022 — Nền PatternWaves phủ toàn màn hình + giao diện admin tông tối

- Dự án: web (`client/`). Người phụ trách: Claude (đặc tả, review), Codex (code).
- Trạng thái: ready — Bảo yêu cầu 2026-10-16: nền chưa phủ hết màn hình; đổi giao diện thành đen cho hợp background.
- Hiện trạng: `client/src/components/PatternWaves.tsx` (WebGL qua `ogl`, do phiên khác thêm) đang render trong `<main>` (`div.main-background`) của `client/src/admin/views/App.jsx`; `main` có `max-width:1600px; margin:auto` → nền chỉ phủ vùng nội dung. Admin đang tông sáng (`#f6f7fb`, panel `#fff`).

## 1. Nền phủ toàn màn hình
- Bỏ `div.main-background` khỏi `<main>`. Đặt một lớp nền duy nhất ở gốc shell admin: `position: fixed; inset: 0; z-index: 0; pointer-events: none`, chứa `<PatternWaves backgroundColor="#07070c" color="#8c7cf0" opacity={0.55} fade="edges" />` (giữ preset mặc định). Sidebar, topbar, workspace nằm trên (`position: relative; z-index: 1`, sidebar fixed giữ z-index cao hơn).
- `main`: bỏ giới hạn làm nền bị hở — nội dung vẫn có `max-width` để dễ đọc, nhưng nền không phụ thuộc `main`.
- Giữ `prefers-reduced-motion` (component đã xử lý). Không sửa nội dung `PatternWaves.tsx` ngoài việc truyền props.

## 2. Tông tối (chỉ trong `client/src/admin/styles.css`, phạm vi `@scope (.admin-page)`)
Token mới trên `:scope`:
- `--page: #07070c` (nền dự phòng khi WebGL không chạy), chữ chính `#ecebf3`, `--muted: #a3a1b8`, `--border: #262433`, `--surface: rgba(20,19,30,.86)`, `--surface-2: rgba(28,26,40,.92)` (input, hàng hover, popover), `--primary: #8c7cf0`, chữ trên nút chính `#0d0b16` hoặc trắng — chọn bản đạt tương phản ≥ 4.5:1.
- Áp cho: sidebar, topbar (nền `--surface`, viền `--border`), panel/thẻ/bảng, header bảng, hàng hover, input/select/textarea (nền `--surface-2`, chữ sáng, placeholder `--muted`, focus `--primary`), nút phụ, badge trạng thái (giữ sắc độ màu nhưng nền tối, chữ sáng đủ tương phản), drawer + nền mờ phía sau, popover thông báo + menu tài khoản, toast, trạng thái rỗng/lỗi/đang tải, biểu đồ (lưới/nhãn trục sáng hơn, giữ màu series), nav item active, scrollbar (`scrollbar-color`), `::selection`, `color-scheme: dark` cho control gốc.
- Không dùng blur/glass, không gradient mới, không bóng phát sáng. Không đổi bố cục, chữ, chức năng.
- Không sửa trang đăng nhập, `.login-*`, code túi 3D.

## Kiểm tra (Codex)
`tsc` client sạch. Claude kiểm tra trực quan + tương phản.

Không commit, không cài gói.
