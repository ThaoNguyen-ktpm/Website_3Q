# TASK-036 — Kết quả: web và Sale AI dùng chung một lần tải KiotViet

- Dự án: web + BossTele + `D:\BaoQ-AI`. Trạng thái: done, Claude làm trực tiếp theo yêu cầu của Bảo (2026-10-19): "tui muốn nó lấy chung dữ liệu ko cần lấy 2 lần khác nhau".

## Thay đổi
- `BossTele/lib/product-search.js`: chi tiết Kiot giữ thêm `categoryId` và `taxPresent` (Sale AI cần để đối chiếu và chặn ghi giá khi có thuế).
- `server/src/services/catalogStore.ts`: `rawRows(source)`. `server/src/routes/internalRoutes.ts`: `POST /internal/catalog/sync` (loopback + `INTERNAL_TOKEN`) chạy `catalogStore.sync()` một lần rồi trả dòng Kiot gốc; lỗi/thiếu trang → 502, không trả dữ liệu dở.
- `scripts/dev.mjs`: Sale AI nhận cùng `INTERNAL_TOKEN`.
- `D:\BaoQ-AI\lib\shared-catalog.js` (mới) + `server.js`: client Kiot thật của Sale AI có `all()` gọi web sync rồi đổi dòng web về dạng Kiot `/products` (`rawFromWebRow`) và đi qua `normalizeProduct` như cũ; P0, lưu trữ, fingerprint không đổi. Web tắt hoặc khác token (404) → Sale AI tự tải Kiot như trước. Ghi giá và đọc lại từng món vẫn gọi Kiot trực tiếp.
- `server/src/routes/saleAiRoutes.ts`: giữ `Host` gốc khi chuyển tiếp, vì Sale AI chỉ nhận POST khi Origin = http://<Host> (trước đó mọi nút ghi trong trang Sale AI nhúng sẽ bị từ chối).

## Kiểm tra
- Web build đạt, `npm test` 28 file / 430 test; BossTele 100/100; Sale AI `node --test *.test.js` 213/213 (thêm `shared-catalog.test.js`: dòng web chuẩn hóa giống hệt dòng Kiot, lọc tồn/kinh doanh chi nhánh 44466, rơi về Kiot khi web tắt/404, không dùng dữ liệu thiếu/trùng/thiếu thuế).
- Thật (đã sao lưu manifest Sale AI vào `D:\BaoQ-AI\data\archives\kiot-state-manifest-before-task036.json`): POST `/api/kiot/refresh` với Host/Origin như qua web → 49 giây, `importStats.source = "website"`, đọc 5.473, giữ 4.483 món; `catalog-cache.json` của web cập nhật cùng lúc 15:52:54. P0 giữ nguyên (SP014899 26tr, SP000009 5tr; SP024867 nay có P0 Sale AI 46tr).
- Chưa bấm thử trong trang Sale AI khi đã đăng nhập web.

## Giới hạn
- Sale AI mở bằng shortcut riêng (không qua `npm run dev`) không có token → vẫn tự tải Kiot.
- Một lần tải lại trong Sale AI cũng làm mới danh mục web (cùng một lần tải).
