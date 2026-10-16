# TASK-023 — Kết quả triển khai Be sáng

- Dự án: web (`client/`). Người triển khai: Codex.
- Trạng thái: `ready_for_review`.
- Hành động gần nhất: đổi bảng màu admin theo hướng Be sáng Bảo đã chọn; hoàn tất kiểm tra nguồn, TypeScript và tương phản màu.
- Bước tiếp theo: Claude kiểm tra độc lập ảnh desktop/mobile, độ rõ của sóng nền, trạng thái tương tác; chạy lại build/test trong môi trường cho phép tạo tiến trình con.

## Thay đổi

- `client/src/admin/styles.css`: nền `#F8F3E7`, surface `rgba(255,252,246,.9)`, surface phụ `#F3EBDD`, viền `#E6D8C2`, chữ `#3B2A1A`, muted `#6E5A45`; thêm `--accent: #D2B48C`, `--accent-strong: #C9AE85`. Giữ tên `--primary` cho màu chữ nhấn nâu `#7A5A34` vì các selector có sẵn dùng token này cho chữ/link/icon.
- Nút chính nền accent, chữ `#2A1D10`, hover/focus dùng accent-strong. Logo chữ nâu, ô logo be; menu chọn be nhạt/chữ nâu; badge xanh/vàng/đỏ dịu giữ phân biệt và chữ tối. Selection, scrollbar, lớp phủ và bóng sẵn có chuyển sang hệ be/nâu; `color-scheme: light`.
- Panel, sidebar, topbar, drawer và popover dùng surface theo spec; input/header bảng/hàng hover dùng surface phụ. Không thêm gradient, blur hay glow.
- `client/src/admin/views/App.jsx`: chỉ đổi props PatternWaves thành `backgroundColor="#F8F3E7"`, `color="#C9AE85"`, `opacity={0.7}`; giữ nguyên vị trí toàn màn hình và `fade="edges"`.
- `client/src/admin/components/Charts.jsx`: thay màu tím bằng series chính `#B08A5B`, so sánh `#C9AE85` giữ nét đứt, vùng tô be nhạt và nền vòng `#E6D8C2`; CSS đồng bộ legend, lưới và nhãn trục.
- Chỉ sửa ba file giao diện được spec cho phép và thêm báo cáo này. Không đổi logic/bố cục, `.login-*`, túi 3D hay `PatternWaves.tsx`; không commit, không cài gói. Bảo toàn các thay đổi có sẵn của workspace.

## Kiểm tra thực tế

- `npm.cmd run build`: **chưa đạt**. TypeScript server và client qua; Vite dừng khi tải config vì esbuild gặp `Error: spawn EPERM`.
- `npm.cmd test`: **không chạy được test**. Vitest báo 8 lỗi khởi tạo forks worker do `spawn EPERM`, không có test nào chạy; kết thúc mã 1 sau timeout đóng worker. Không coi là test đạt.
- `node_modules/.bin/tsc.cmd -b client`: **PASS**, mã 0 sau chỉnh sửa cuối.
- Self-check chạy trực tiếp bằng Node, không tạo file kiểm thử: parse CSS bằng PostCSS, transpile hai file JSX bằng TypeScript; assert chỉ một PatternWaves đúng props mới, không còn các mã tím cũ, comparison vẫn nét đứt và color-scheme sáng: **PASS**.
- Tính WCAG từ sRGB nguồn: chữ chính/nền trang **12.38:1**; muted/nền trang **5.91:1**, muted/surface phụ **5.52:1**; chữ nhấn/nền trang **5.68:1**, chữ nhấn/nền menu chọn **4.53:1**; chữ nút chính **8.31:1**, hover **7.71:1**. Badge xanh **5.74:1**, đỏ **5.34:1**, vàng **5.21:1**, xanh dương **5.47:1** — đều ≥ 4.5:1.
- Với surface alpha .9, tính thêm biên bảo thủ khi ghép trên nền đen: chữ chính **10.70:1**, muted **5.11:1**, chữ nhấn **4.91:1**. Đây là tính màu nguồn, không phải đo computed style/screenshot thực tế.
- Impeccable detector chạy một lần trên ba file: mã 1, cảnh báo font, màu, cỡ chữ và bo góc khác `DESIGN.md` vốn mô tả trang đăng nhập. Giữ bảng màu TASK-023 và cấu trúc admin có sẵn; không sửa tài liệu thiết kế ngoài phạm vi.

## Giới hạn

- Chưa kiểm tra trực quan desktop/mobile, WebGL, fallback hay reduced-motion trong trình duyệt. `opacity={0.7}` nằm trong khoảng spec gợi ý, cần Claude duyệt ảnh về độ rõ và mức ảnh hưởng đến chữ.
- Chưa có review độc lập của Claude; code hoàn tất nhưng chưa được Claude kiểm tra, không ghi `verified`.
