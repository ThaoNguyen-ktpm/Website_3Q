# TASK-023 — Admin tông be sáng (thay tông tối TASK-022)

- Dự án: web (`client/`). Người phụ trách: Claude (đặc tả, review), Codex (code).
- Trạng thái: ready — Bảo yêu cầu 2026-10-16 đổi màu trang và hiệu ứng sang bảng màu be gửi kèm; chọn hướng "Be sáng".
- Bảng màu của Bảo: Nâu be `#D2B48C`, Be đậm `#C9AE85`, Be nhạt `#F8F3E7` (ô thứ 3 bị cắt trong ảnh, Claude lấy mẫu pixel).

## Token (`client/src/admin/styles.css`, trong `@scope (.admin-page)`, thay token tối hiện tại)
- `--page: #F8F3E7` (nền dự phòng khi WebGL không chạy)
- `--surface: rgba(255, 252, 246, .9)` (sidebar, topbar, panel, drawer, popover)
- `--surface-2: #F3EBDD` (input, header bảng, hàng hover, nút phụ)
- `--border: #E6D8C2`
- chữ chính `#3B2A1A`; `--muted: #6E5A45` (≥ 4.5:1 trên `--surface` và `--page`)
- `--accent: #D2B48C` (nền nút chính, nền mục menu đang chọn dạng nhạt, chấm trạng thái), `--accent-strong: #C9AE85` (viền focus, hover nút chính, viền chọn)
- chữ trên nút chính: `#2A1D10` (đảm bảo ≥ 4.5:1 trên `#D2B48C`)
- chữ nhấn / link / tiêu đề cột đang chọn: `#7A5A34` (đủ tương phản trên nền kem). KHÔNG dùng `#D2B48C`/`#C9AE85` làm màu chữ trên nền sáng.
- `color-scheme: light`; `::selection` nền `#E9D9BF` chữ `#2A1D10`; scrollbar tông be.
- Thay mọi chỗ tím (`#8c7cf0`, `#7055d9`, `#a28be6`, `#e4dcff`, …) bằng hệ be/nâu tương ứng; badge trạng thái giữ phân biệt màu (xanh/vàng/đỏ dịu) nhưng chữ đủ tương phản; biểu đồ: series chính `#B08A5B` (đậm hơn để nhìn rõ đường), series so sánh `#C9AE85` nét đứt, lưới `#E6D8C2`, nhãn trục `--muted`.
- Logo chữ "maison." và ô icon logo: đổi tím → nâu (`#7A5A34`, ô nền `#D2B48C`).
- Không blur/glass, không gradient mới, không glow.

## Hiệu ứng nền (`client/src/admin/views/App.jsx`)
`<PatternWaves backgroundColor="#F8F3E7" color="#C9AE85" … />` — chỉnh `opacity` để hoạ tiết thấy rõ nhưng không lấn chữ (gợi ý 0.6–0.8; Claude sẽ duyệt ảnh). Không sửa `PatternWaves.tsx`.

## Ngoài phạm vi
Trang đăng nhập (`.login-*`), túi 3D, logic, bố cục. Không commit, không cài gói. Chỉ sửa `client/src/admin/styles.css`, `client/src/admin/views/App.jsx` (props nền + màu inline nếu có, kể cả màu trong `client/src/admin/components/Charts.jsx` nếu màu tím nằm ở đó), ghi `tasks/TASK-023-result.md`.
