# TASK-006 — Kết nối thật qua .env

- Người phụ trách: Codex triển khai và kiểm chứng trực tiếp.
- Trạng thái: live_read_verified cho tìm tên KiotViet/Sapo Web; chưa có Claude review độc lập thay đổi .env.
- Yêu cầu: đọc khóa từ `.env` với các biến KIOT_RETAILER/CLIENT_ID/CLIENT_SECRET và SAPO_SHOP/API_KEY/API_SECRET.
- Hành động gần nhất: thêm loader `.env`, chạy test và gọi API chỉ đọc.
- Bước tiếp theo: dùng CLI tìm sản phẩm; bổ sung hợp đồng Sapo POS nếu muốn kết nối POS.

## Thay đổi
- `lib/connection-config.js`: dùng parser dotenv có sẵn của Node, ánh xạ đúng tên biến. File .env được ưu tiên và không trộn khóa với nguồn khác.
- `search-products.js`: dùng loader mới, giữ tương thích JSON khi không có env.
- `.env.example`: ví dụ đúng tên biến, không có khóa.
- `test/connection-config.test.js`: BOM/CRLF, dấu nháy/comment, không thực thi nội dung secret, không bù khóa từ môi trường khác.
- `docs/PRODUCT-SEARCH.md`: cập nhật cách dùng và giới hạn đã xác minh.

## Bằng chứng
- Không sửa hoặc in nội dung `.env`; trạng thái cấu hình Kiot/Web đều đủ trường.
- `npm.cmd test`: 46/46 test đạt, 0 lỗi; log `TASK-006-tests.txt`.
- Live ngày 2026-10-14: tên “Chanel”, KiotViet trả 100 kết quả trang đầu; Sapo Web trả 250 biến thể trang đầu; cả hai `hasMore: true`.
- Kiểm tra endpoint SKU Kiot và kết quả lưu tại `TASK-006-live.json`.
- Token Kiot lấy qua endpoint OAuth; sản phẩm hai nền tảng chỉ gọi GET. Báo cáo chỉ chứa trạng thái/số lượng/SKU mẫu, không chứa khóa.

## Giới hạn
- Sapo credentials trong .env hiện là Sapo Web private app, không chứng minh quyền truy cập POS.
- Chưa quét toàn bộ danh mục hoặc kiểm tra live toàn bộ tình huống lỗi/phân trang/SKU Sapo.
- Chưa có review độc lập của Claude cho thay đổi lần này; review trước đã kiểm tra adapter sản phẩm, không bao gồm loader .env mới.
- Không sửa giá hoặc dữ liệu trên Kiot/Sapo.
