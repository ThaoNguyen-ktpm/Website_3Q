# TASK-111: Review của Claude

- Ngày: 30/10/2026
- Kết luận: **verified**

## Bằng chứng (Claude tự chạy)

- `npm run build` tại `Webstie`: đạt.
- `npm test` tại `Webstie`: frontend 3 pass; vitest server 461 pass, 14 skip (giảm 7 do gỡ test API sản phẩm); lõi Sale AI 287/287.
- `npm test` tại `Webstie/BossTele`: 139/139.
- `git grep` `5173|4310|BaoQ-AI|legacy-server|/api/products` trong `Webstie` (trừ skill, vendor, lockfile): không còn.
- Claude xoá thư mục rỗng `scripts/.task020-test-*` (0 file) mà sandbox Codex không xoá được.
- Sau khởi động lại `npm run dev`:
  - chỉ còn cổng 4000, 8787;
  - `/` 200, `/api/auth/config` 200;
  - `/api/documents` và `/sale-ai/api/status` chưa đăng nhập 401;
  - `/api/products` 404 (đã gỡ).

## Ghi chú

- Bảng `Product` trong DB giữ nguyên, chờ Bảo quyết.
- Còn `BossTele/vendor/claude-mem` (299MB) thuộc TASK-042, cần thao tác Git ngoài sandbox.
- Bản sao lưu `Webstie/.task-110-client-backup/` giữ tới khi Bảo xác nhận 8787 ổn.

Chưa commit.
