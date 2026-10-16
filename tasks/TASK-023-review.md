# TASK-023 — Review: admin tông be sáng

- Người review: Claude. Trạng thái: verified.

## Phát hiện và sửa
- Sau khi Codex đổi token, tiêu đề trang và chữ phụ/footer vẫn trắng/xám (tương phản 1.11:1 và 1.79:1 trên nền kem). Nguồn: khối rule cũ trong `client/src/style.css` (phiên thêm PatternWaves viết cho nền tối trong `<main>`: `.admin-page .page-title h1 {color:#fff}`, `.page-title p, .page-footer, .inline-summary {color:#b5b8c4}`, `.main-background`, `.admin-page main {isolation}`). Khối này lỗi thời từ TASK-022 → Claude xóa; màu lấy lại từ token trong `admin/styles.css`.

## Bằng chứng
- `npm run build --workspace client` đạt; không còn mã màu tím cũ trong mã admin.
- Kết xuất component (API giả, vai trò Nhân viên) 1440×900: nền kem, panel ngà, chữ nâu, nút/mục chọn màu be, biểu đồ nâu be; hoạ tiết chấm be hiện sau nội dung.
- Tương phản: tiêu đề trang 12.38:1; chữ phụ tiêu đề, footer 5.91:1; nhãn chỉ số, mô tả panel 6.39:1; header bảng 5.52:1; mục menu đang chọn 4.53:1; chữ trên nút chính 8.31:1 — tất cả ≥ 4.5:1.

## Ghi chú cho Bảo
- Tab nhân viên trong ảnh hiện giao diện sáng cũ là bản chưa tải lại; giao diện không khác nhau theo vai trò. Tải lại cứng (Ctrl+Shift+R).
- Ô màu thứ 3 bị cắt trong ảnh; Claude lấy mẫu pixel `#F8F3E7`.
