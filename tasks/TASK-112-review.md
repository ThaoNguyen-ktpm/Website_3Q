Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-112: Review của Claude

- Ngày: 02/11/2026
- Kết luận: **verified**

## Bằng chứng (Claude tự chạy)

- `SALE_AI_E2E=1 npx vitest run src/tests/saleAiUpdateAll.test.ts`: **14/14** (trước sửa: 14/14 lỗi 409).
- `npm test` tại `Webstie`: frontend 3; vitest server 461 pass, 14 skip; lõi Sale AI 288/288.
- Hành vi thật không đổi: `readSapoOnStartup` mặc định `true`. Trong vài giây đầu sau khởi động, "Tải lại từ Kiot" có thể báo "Đang xử lý một lượt khác" (409); chờ rồi bấm lại.

## Kiểm bảng hôm nay (đọc kho thật, không ghi)

- Bảng 02/11/2026, policy v10: 1.583 dòng (M1 1.330, M0 250, chờ giá duyệt 3); ẩn 2.886 món trước 01/07.
- Tính lại cả 1.583 dòng bằng `calculate()`: 0 lệch; 0 sai nhóm ngày; 0 giá hoặc net ≤ 0; giá Kiot lưu = P0 ở mọi món.
- Dữ liệu Kiot tải lúc 30/10: cần "Tải lại từ Kiot" trước khi cập nhật.
