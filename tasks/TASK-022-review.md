# TASK-022 — Review: nền toàn màn hình + admin tông tối

- Người review: Claude. Trạng thái: verified.

## Nguyên nhân ban đầu
`PatternWaves` (phiên khác thêm) nằm trong `<main>`, mà `main` có `max-width:1600px; margin:auto` → nền chỉ phủ vùng nội dung. Viền cam/xanh trong ảnh Bảo gửi là lớp tô của DevTools khi chọn `<main>`.

## Bằng chứng
- `tsc` client sạch; `npm run build --workspace client` đạt.
- Kết xuất component (API giả, không tạo phiên) ở 1440×900: `.admin-background` phủ đúng 0,0 → 1440×900, có canvas WebGL (2160×1350, DPR 1.5); hoa văn chấm tím hiện phía sau sidebar/topbar/panel.
- Tương phản chữ (đo trên nền thực tế): chữ phụ tiêu đề 10.16:1; mô tả panel, nhãn ô, menu 7.31:1; chữ trong ô nhập 14.45:1 — đều ≥ 4.5:1.
- Chỉ sửa `client/src/admin/views/App.jsx`, `client/src/admin/styles.css`; không đụng `.login-*`, túi 3D, `PatternWaves.tsx`.
