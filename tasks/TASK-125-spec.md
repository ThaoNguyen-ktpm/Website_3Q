Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-125: Món đã đúng giá trên Kiot thì bỏ qua, không báo "Kiot đã thay đổi"

- Dự án: web (Sale AI)
- Người phụ trách: Codex (thực hiện), Claude (chạy test, review)
- Trạng thái: `ready`. Làm sau TASK-124.

## Lỗi thật (02/11/2026 14:58)

- Bảo chọn 3 món SP024880_18102026, SP024879_18102026, SP024878_18102026 và bấm "Cập nhật giá Kiot".
- Kết quả: 0/3 thành công, 3 "chưa gửi". Lý do: "Kiot đã thay đổi (thông tin khác); bấm Tải lại từ Kiot rồi kiểm thử lại".
- Nhật ký cho thấy cả 3 món đã ghi giá Kiot thành công (`done`) ở lượt 13:37 cùng ngày. SP024880 còn thành công ở các lượt 11:02, 11:03, 11:46. Bảng dùng dữ liệu Kiot đọc lúc 10:49, nên `liveBase` của dòng bảng đã cũ so với Kiot sau khi chính Sale AI ghi giá.
- Cộng dồn trong ngày: 1.304/1.311 món M1 đã ghi Kiot thành công. Các lượt sau thì phần lớn món bị chặn như trên: lượt 13:49 có 100 món, lượt 14:29 có 151 món.
- Bảng vẫn hiện dòng đó là "Kiot: cập nhật thành công và kiểm chứng" và "Đủ điều kiện kiểm thử", vẫn cho chọn.

## Yêu cầu

1. **Sau khi ghi thành công**, cập nhật luôn dòng bảng của món đó (snapshot Kiot mới: `liveBase`, `liveReadAt`, `currentPrice`, `notesBefore`). Lượt sau so với dữ liệu mới, không so với dữ liệu 10:49. Áp dụng cho cả ghi từng món và ghi theo lô.
2. **Món đã đúng giá** (giá Kiot hiện tại = giá dự kiến; với TASK-119 không cần ghi chú BAOQ):
   - bảng hiện rõ "Đã đúng giá trên Kiot", không tính vào "Cập nhật giá Kiot (N món)" khi chọn tất cả;
   - nếu vẫn bị gửi (chọn tay, dữ liệu cũ), lượt nền đánh dấu `unchanged` / "Bỏ qua (đã đúng giá)", **không** báo lỗi, không vào "Cập nhật lại các món lỗi". `operation.batch.unchanged` đã có.
3. Món bị **người khác sửa trên Kiot** (giá khác giá dự kiến, hoặc mô tả hay thông tin khác đổi, mà không phải do Sale AI ghi) vẫn bị chặn như cũ.
4. Câu lỗi "Kiot đã thay đổi" nói rõ hơn khi có thể: "giá Kiot hiện X, dự kiến Y" hoặc "thông tin khác (tên/mô tả/tồn kho)".
5. Không đổi: quy tắc giá, chỉ ghi giá, ghi theo lô, xác minh, khoá, phục hồi.

## Test

- Món đã ghi thành công ở lượt trước, bảng chưa tải lại: lượt sau chọn lại thì thành "Bỏ qua (đã đúng giá)", không có PUT, không có lỗi.
- Món bị sửa giá tay trên Kiot sau khi bảng đọc: vẫn `preflight_failed`.
- Sau một lượt thành công, bảng hiện "Đã đúng giá trên Kiot" và nút đếm không tính món đó.
- E2E `saleAiUpdateAll.test.ts` đạt.

## Lệnh kiểm tra (Claude chạy)

`npm run build`, `npm test`, `node --test` lõi Sale AI, E2E 5 lần, BossTele `npm test`.

## Cách làm

- Codex chạy `-a never`. Không gọi Kiot/Sapo thật. Không dừng hay khởi động lại server. Không commit.
- Ghi kết quả vào `tasks/TASK-125-result.md`.
