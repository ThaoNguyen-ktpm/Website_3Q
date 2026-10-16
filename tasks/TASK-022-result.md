# TASK-022 — Kết quả triển khai

- Dự án: web (`client/`). Người triển khai: Codex.
- Trạng thái: `ready_for_review`.
- Hành động gần nhất: hoàn tất nền toàn màn hình và tông tối; kiểm tra TypeScript, cú pháp CSS và các cặp tương phản chính.
- Bước tiếp theo: Claude kiểm tra độc lập giao diện desktop/mobile, tương phản thực tế và các trạng thái tương tác; chạy lại build/test trong môi trường cho phép tạo tiến trình con.

## Thay đổi

- `client/src/admin/views/App.jsx`: chuyển một instance PatternWaves từ trong `main` ra ngay gốc `.app-shell`; truyền `backgroundColor="#07070c"`, `color="#8c7cf0"`, `opacity={0.55}`, `fade="edges"`. Không đổi preset hay nội dung component.
- `client/src/admin/styles.css`: lớp `.admin-background` cố định toàn viewport, `inset: 0`, `z-index: 0`, không nhận pointer; workspace/topbar nằm trên, sidebar giữ `position: fixed` và z-index 30. Nội dung giữ giới hạn 1600px.
- Đổi token và màu sáng có sẵn sang tông tối trong `@scope (.admin-page)`: sidebar/topbar, panel, bảng, control, hover/focus, nút, badge, drawer/overlay, thông báo/tài khoản, toast, trạng thái rỗng/lỗi/tải, thanh cuộn và selection. Control gốc dùng `color-scheme: dark`.
- Biểu đồ: đổi nền vùng tô, lưới, nhãn, viền điểm và nền vòng tròn bằng CSS; giữ màu series và dữ liệu.
- Nút chính dùng chữ `#0d0b16`; badge/nav tím dùng nền `#282036` để chữ `--primary` đạt tương phản tối thiểu 4.5:1.
- Không cần sửa `AdminPage.tsx`. Không thay bố cục, chữ, chức năng; không sửa `.login-*`, túi 3D, `PatternWaves.tsx`; không cài gói, không commit.

## Kiểm tra thực tế

- `node_modules/.bin/tsc.cmd -b client`: **PASS**, mã thoát 0 (chạy lại sau thay đổi cuối).
- Parse `client/src/admin/styles.css` bằng PostCSS đã cài: **PASS**.
- Assert cấu trúc nguồn: đúng một `<PatternWaves ...>`, nằm trước `main`, không còn `.main-background` trong App: **PASS**.
- Tính WCAG từ giá trị sRGB của các cặp màu đặc: chữ/nút chính **5.81:1**, hover **7.65:1**; badge xanh **7.67:1**, tím **4.63:1**, vàng **8.14:1**, hồng **7.47:1**; chữ muted trên nền control đặc tương đương `#1c1a28` **6.80:1**. Đây là phép tính màu nguồn, chưa thay thế kiểm tra computed style và nền alpha thực tế trong trình duyệt.
- `npm.cmd run build`: **chưa hoàn thành**. TypeScript server/client qua, Vite dừng khi tải cấu hình vì esbuild gặp `Error: spawn EPERM`.
- `npm.cmd test`: **không chạy được test**. Vitest báo 8 lỗi tạo forks worker do `spawn EPERM`, sau đó timeout đóng worker; không có test nào chạy. Không coi đây là bộ test đạt.
- Impeccable detector đã chạy trên hai file: mã thoát 1, có cảnh báo font/màu/cỡ chữ/bo góc khác `DESIGN.md` vốn mô tả trang đăng nhập. Giữ font, kích thước, bố cục admin có sẵn và bảng màu TASK-022 theo yêu cầu; không sửa tài liệu thiết kế ngoài phạm vi.

## Giới hạn

- Chưa kiểm tra trực quan trong trình duyệt, WebGL thực tế, reduced-motion, fallback khi WebGL lỗi hoặc tương phản trên các lớp nền alpha. Giữ nguyên xử lý reduced-motion của PatternWaves.
- Chưa có review độc lập của Claude; không ghi `verified`.
- Workspace có nhiều thay đổi sẵn từ trước; chỉ chỉnh hai file triển khai được chỉ định và thêm báo cáo này.
