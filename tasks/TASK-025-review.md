# TASK-025 — Review: mục Tìm kiếm (KiotViet + Sapo Web)

- Người review: Claude. Trạng thái: verified (code, build/test, dữ liệu thật qua service, giao diện với dữ liệu thật); tìm kiếm qua route HTTP bằng phiên Google thật: chờ Bảo thử.

## Phạm vi đã xem
`BossTele/lib/product-search.js` (tùy chọn `detail`), `server/src/services/catalogSearchService.ts`, `controllers/catalogController.ts`, `routes/catalogRoutes.ts`, `app.ts`, `config/permissions.ts`, `client/vite.config.ts`, `client/src/admin/views/App.jsx`, `client/src/admin/styles.css`, test mới.

## Bằng chứng
- `npm run build` tại gốc: đạt (Vite build xong). `npm test` tại gốc: 10 file, 239/239 đạt (gồm `catalogSearch.test.ts`: 401/403, query sai, ẩn `cost`, lỗi một nguồn, cursor SKU). `npm test` tại `BossTele`: 67/67 đạt; test cũ không bị sửa.
- Server: route `GET /api/catalog/search` sau `requireAuth` + `requirePermission('products.view')`; zod kiểm tra query; `Cache-Control: no-store`; thiếu `products.cost` → xóa `cost` trên bản sao (không mutate dữ liệu lib); lỗi cấu hình/nguồn → message chung, không lộ khóa. Chỉ gọi `kiotviet` và `sapo-web`.
- Gọi thật (chỉ đọc) qua `server/dist/services/catalogSearchService.js`, từ khóa "Chanel": KiotViet `ok` (total 645, hasMore), Sapo Web `ok` (hasMore). Host ảnh trong kết quả: `cdn2-retail-images.kiotviet.vn`, `cdn1-retail-images.kiotviet.vn`, `bizweb.dktcdn.net` — đều có trong CSP `img-src`.
- Dev server chạy lại: `/api/health` 200; `/api/catalog/search` chưa đăng nhập → 401 đúng.
- Giao diện (trình duyệt trong app, phiên giả lập chỉ ở trình duyệt, dữ liệu là kết quả thật ở trên): menu "Tìm kiếm" ngay dưới "Tổng quan"; nhóm KiotViet/Sapo với số kết quả; ảnh thật tải được, console không còn lỗi CSP sau khi tải lại trang; drawer có gallery, giá/tồn/trạng thái, bảng thông tin, tồn theo chi nhánh có cột giá vốn (người có quyền), mô tả text thuần. 375px: lưới 1 cột, không tràn ngang.

## Phát hiện
- Thấp — `Cân nặng 0` hiện trong drawer: Kiot trả `weight: 0` khi chưa nhập, nên dòng này là nhiễu. Đề xuất ẩn khi `weight` = 0. Không chặn nghiệm thu.
- Ghi chú — ảnh dùng `loading="lazy"`; khi tab chạy nền ảnh tải chậm hơn, không phải lỗi.

## Giới hạn
- Chưa chạy tìm kiếm qua route HTTP với cookie phiên Google thật (cần Bảo đăng nhập). Route và phân quyền đã có test HTTP (supertest) đạt.
- Nếu sản phẩm khác dùng host ảnh khác 4 host đã khai báo, ảnh đó sẽ bị CSP chặn và hiện placeholder; bổ sung host cụ thể khi gặp.

## Kết luận
verified, kèm giới hạn trên. Không có lỗi cần trả về Codex.
