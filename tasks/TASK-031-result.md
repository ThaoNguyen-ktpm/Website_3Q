# TASK-031 — Kết quả: tải trước danh mục trang Tìm kiếm

- Dự án: web. Trạng thái: done, Claude làm trực tiếp theo yêu cầu của Bảo (2026-10-19): mỗi lần mở trang Tìm kiếm phải chờ "Đang đồng bộ sản phẩm từ KiotViet…"; muốn sản phẩm được tải trước.

## Thay đổi
- `server/src/server.ts`: gọi `catalogStore.sync()` ngay khi server khởi động.
- `server/src/services/catalogStore.ts`: tùy chọn `snapshot` cho `createCatalogStore`; bản mặc định lưu danh mục sau mỗi lần đồng bộ thành công vào `server/data/catalog-cache.json` (gitignored) và nạp lại khi khởi động. Có snapshot thì `products()` trả ngay, rồi làm mới ở nền (quy tắc 10 phút cũ). Snapshot hỏng hoặc chưa đủ thì đồng bộ như trước.
- `server/src/tests/catalogStore.test.ts`: 2 test (trả snapshot ngay + làm mới nền + lưu; snapshot hỏng/chưa đủ).

## Kiểm tra
- `npm run build` đạt; `npm test`: 26 file, 398 test đạt.
- Thật: server khởi động 10:46:43, snapshot 6,5 MB ghi lúc 10:47. Giả lập khởi động lại: nạp module 120 ms, `products()` 54 ms trả 20/5.451 sản phẩm, `syncing: true`.

## Giới hạn
- Snapshot chứa giá vốn theo chi nhánh, chỉ nằm trên máy chủ; API vẫn bỏ `cost` khi người xem không có `products.cost`.
- Lần chạy đầu tiên trên máy mới (chưa có snapshot) vẫn chờ một lần đồng bộ, khoảng 30–60 giây sau khi server khởi động.
