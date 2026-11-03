Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-118 — Kết quả

- Dự án: web / Sale AI. Người thực hiện: Codex.
- Trạng thái: `ready_for_review`; chưa được Claude kiểm tra độc lập.
- Hành động gần nhất: triển khai TASK-118 trước TASK-117, chạy kiểm tra fixture tập trung.
- Bước tiếp theo: Claude chạy full test, E2E và build theo spec; tiếp tục TASK-117 trong cùng lượt.

## Thay đổi

- `sapo.js`: chấp nhận `content:null`, chuẩn hoá thành chuỗi rỗng; fingerprint coi null và rỗng tương đương, tạo ghi chú được; vẫn từ chối thiếu mô tả (undefined), variants, SKU sai kiểu, giá âm/không hợp lệ. Giá 0 được chấp nhận để phân loại bỏ qua.
- `joint-update.js`, `batch-joint.js`: đối chiếu Sapo giá 0 trước khi gửi cả hai bên, không PUT Kiot/Sapo; trạng thái `skipped_sapo_zero_price`, lý do xử lý tay; không tính lượt chỉ có thành công/bỏ qua là thất bại. Batch cần thêm GET Sapo tại cổng gửi trước khi chạy hai writer; vẫn dùng limiter hiện có.
- `update-report.js`, `view-data.js`, `public/live-ui.js`, `core.js`, `service.js`: nhóm lịch sử riêng, tóm tắt số bỏ qua, không đưa vào lỗi/retry; giữ trạng thái bỏ qua khi nạp lại kho.
- Test bổ sung trong `sapo.test.js`, `joint-update.test.js`, `background-update.test.js`; cập nhật đúng một assertion cũ từ từ chối giá 0 thành chấp nhận để phân loại theo đặc tả mới; bổ sung giá âm/null/chuỗi rỗng/sai số vẫn bị từ chối.

## Quyết định rollback mô tả

Đọc tài liệu công khai chính thức: [thuộc tính Product](https://support.sapo.vn/cac-thuoc-tinh-cua-product) xác định content là HTML; [PUT Product](https://support.sapo.vn/phuong-thuc-put-cua-product) dùng content dạng chuỗi. Tài liệu không xác nhận PUT null có xoá mô tả hay bỏ qua trường. Chọn gửi **`content:""` rõ ràng** khi khôi phục mô tả null; không bỏ trường, không suy đoán PUT null. Readback null/rỗng có cùng fingerprint; test kiểm payload và rollback fixture. Chưa xác minh API thật chấp nhận chuỗi rỗng vì yêu cầu cấm gọi thật.

## Kiểm tra thực tế

- `node --test --test-name-pattern=TASK-118 Webstie/server/src/sale-ai/test/joint-update.test.js Webstie/server/src/sale-ai/test/background-update.test.js`: sandbox chặn `spawn EPERM`.
- Cùng lệnh thêm `--test-isolation=none`: 4/4 đạt (null + rollback, giá 0 ở variant khác, background thường/batch, không PUT hai bên, không retry, nhóm lịch sử không lỗi).
- `node --test --test-isolation=none Webstie/server/src/sale-ai/test/sapo.test.js Webstie/server/src/sale-ai/test/joint-update.test.js Webstie/server/src/sale-ai/test/update-report.test.js Webstie/server/src/sale-ai/test/history-details.test.js`: 40/40 đạt (~2,45 giây).

Không chạy toàn bộ lõi in-process; full suite/build/E2E dành Claude. Không gọi Kiot/Sapo thật, không in khoá, không stop/restart, không commit. Bảo toàn diff có sẵn.

## Bổ sung khi tích hợp TASK-117

- Bổ sung 2 ca E2E HTTP trong `saleAiUpdateAll.test.ts`: mô tả null/ghi chú/rollback và giá 0/không PUT/retry rỗng. E2E bị chặn trước khi chạy bởi `spawn EPERM`; xem TASK-117-result.md.
- Test payload restore dùng `content:""` và fingerprint null/rỗng đạt. Giữ trạng thái bỏ qua và số lỗi bằng 0 khi nạp lại lượt bị gián đoạn; hai ca joint TASK-118 chạy lại đạt 2/2.
- Kiểm tra chung TASK-117/TASK-118 theo tên: 13/13 đạt tại thời điểm chạy, chỉ fixture/offline. Typecheck server đạt; không thay thế review độc lập của Claude.
