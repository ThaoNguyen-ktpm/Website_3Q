# TASK-104 — Kế hoạch triển khai

**Mục tiêu:** tiếp tục từ 1.3 theo quyết định Bảo, đưa Sale AI vào Express hiện có; giữ giao diện và lõi giá.
**Đặc tả:** `tasks/TASK-104-spec.md`, gồm hai mục bàn giao cuối.
**Cách thực hiện:** Codex triển khai trực tiếp trong phiên; Claude review sau theo phân vai đã chốt. Không commit.

- [x] Xuất `updates` và `prepared` từ manifest/blob đã kiểm hash; tạo file mới bằng `wx`, không sửa dữ liệu nguồn.
- [x] Chép lib/public/test, ghi SHA-256 nguồn; giữ adapter HTTP cũ chỉ trong test để chạy nguyên bộ hồi quy, router sản phẩm dùng Express trong cùng tiến trình.
- [x] Test trước cho retention 7 bảng, bảo vệ runId của prepared/running, dọn blob với maintenance lock và không chạy cùng writer.
- [x] Tạo runtime JS và router Express; khởi tạo bất đồng bộ một lần từ server.ts, trả 503 trước sẵn sàng; giữ auth/permission/same-origin và giới hạn body.
- [x] Thay tải danh mục vòng HTTP bằng callback catalogStore.sync/rawRows; truyền khóa qua bộ nhớ, bỏ tiến trình/cổng riêng trong dev.mjs.
- [x] Chuyển BossTele và 14 E2E sang lõi/kho mới; sửa thông báo lỗi nhúng, tài liệu vận hành.
- [x] Chạy node --test, build, npm test, E2E, BossTele, kiểm tra dist, dev/cổng, quyền, tải Kiot chỉ đọc; đo dung lượng/saveMs/API khác khi mô phỏng và cập nhật fixture.
- [x] Kiểm diff bảo toàn thay đổi có sẵn, quét bí mật, cập nhật result với mọi giới hạn; ready_for_review khi đủ kiểm tra, chưa gọi verified.

Các trường hợp cần chú ý: ghi đồng thời nhận 409; dọn blob thất bại không mất manifest; prepared bảo vệ bảng cũ; thiếu quyền vẫn 403 cả static/API; dist có đủ JS/public và đường dẫn dữ liệu giống src.

Ngày 30/10: đã thực hiện các bước triển khai/kiểm tra có thể chạy; tick kiểm tra bao gồm đã thử và ghi giới hạn, không có nghĩa mọi lệnh đều pass. Vitest/E2E/client build bị spawn EPERM; không chạy dev/restart hoặc ghi thật. Kết quả và bước Claude cần tiếp tục ở TASK-104-result.md.
