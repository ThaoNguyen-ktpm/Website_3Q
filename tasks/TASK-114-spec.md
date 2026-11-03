Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-114: Lịch sử Sale AI, gộp "Xem N sản phẩm" và "Xem danh sách lỗi" thành một chỗ xem đúng nghĩa

- Dự án: web (Sale AI trong `Webstie/server/src/sale-ai`)
- Người phụ trách: Codex (thực hiện), Claude (chạy test, kiểm giao diện, review)
- Trạng thái: `ready`. **Làm sau TASK-113** (cùng thư mục Sale AI).
- Ngày giao: 02/11/2026. Bảo: "2 bảng đều cho người dùng xem chung một ý nghĩa, hãy sửa lại logic cho đúng".

## Hiện trạng (lượt 09:58 02/11/2026)

- Dòng Lịch sử có 2 nút (`public/live-ui.js` ~dòng 104):
  - "Xem ${summary.total} sản phẩm" = `update.items` (64 món đã vào bước kiểm tra), mở `showUpdateDetails(…, errorsOnly=false)`;
  - "Xem danh sách lỗi (${issueCount})" = `issueCount(update)` (`lib/update-report.js`) = món lỗi trong `items` + `update.skipped` (1.250 món chưa gửi) = 1.314.
- Thông báo `summaryText`: "Đã cập nhật thành công 0/64 sản phẩm. Lỗi 64 sản phẩm. Không gửi cập nhật 1250 sản phẩm". Mẫu số 64 sai ý nghĩa: cả lượt Bảo chọn 1.314 món.
- Khi cả lượt lỗi, hai nút gần như trùng nội dung; khi có món thành công, "Xem 64" lại không có 1.250 món chưa gửi.

## Yêu cầu

1. **Tổng của lượt** = mọi món của lượt: `items` + `skipped` + `unchanged` (đã đúng giá, nếu có danh sách mã). Viết một hàm dùng chung trong `lib/update-report.js` trả: tổng, thành công, lỗi (theo bước: lỗi kiểm tra / lỗi ghi / chưa xác minh), chưa gửi, đã đúng giá. Mọi chỗ hiển thị dùng hàm này.
2. **Dòng tóm tắt và thông báo sau khi cập nhật**, ví dụ: "0/1.314 thành công · 64 lỗi kiểm tra · 1.250 chưa gửi". Bỏ kiểu "0/64". Bỏ nhóm bằng 0. Áp cho lượt cập nhật và lượt khôi phục; Kiot/Sapo tách dòng như hiện nay nếu cần.
3. **Chỉ còn một nút** trên mỗi dòng Lịch sử: "Xem chi tiết (1.314 món)". Mở một hộp có **3 thẻ lọc**:
   - Tất cả;
   - Thành công;
   - Lỗi + chưa gửi (có số).

   Có lỗi thì mở sẵn thẻ lỗi. Thanh "Cập nhật lại … món lỗi" (`retry-selection`, TASK-102) nằm ở thẻ lỗi như hiện nay. Mỗi dòng ghi rõ trạng thái: Thành công / Lỗi kiểm tra — chưa ghi / Lỗi khi ghi / Chưa xác minh / Chưa gửi / Đã đúng giá, kèm lý do (`failureReason`).
4. Nút "Khôi phục giá + mô tả" giữ nguyên.
5. Lượt cũ đã lưu (không có trường mới) vẫn hiện đúng: tính từ `items`, `skipped`, `unchanged` có sẵn. Không sửa dữ liệu đã lưu.
6. **Không đổi:** logic ghi giá, kiểm tra, rollback, `retry-selection`, quy tắc giá.

## Test

- `update-report`: lượt mẫu 64 lỗi kiểm tra + 1.250 skipped thì tổng 1.314, thành công 0, lỗi 64, chưa gửi 1.250; câu tóm tắt đúng mẫu. Lượt có thành công + lỗi + đã đúng giá thì đếm đúng từng nhóm.
- Giao diện (test dựng HTML trong `server/src/sale-ai/test/`): một nút "Xem chi tiết (N món)"; hộp có 3 thẻ, số trên thẻ khớp; thẻ lỗi có thanh cập nhật lại.
- E2E `saleAiUpdateAll.test.ts` 14 ca vẫn đạt (sửa assertion chữ nếu trùng chữ cũ, giữ ý nghĩa).

## Cách làm

- Codex chạy `-a never`. Lệnh bị sandbox chặn thì ghi lại, không xin quyền. Claude chạy `npm test`, E2E, `npm run build` và kiểm Lịch sử ở 8787.
- Không gọi Kiot/Sapo thật. Không dừng hay khởi động lại server. Không đổi thay đổi chưa commit của task khác. Không commit. Ghi `tasks/TASK-114-result.md`.
