Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-116: Cập nhật nhiều món trong Sale AI chạy nền, không bị cắt sau 5 phút

- Dự án: web (Sale AI trong `Webstie/server/src/sale-ai`)
- Người phụ trách: Codex (thực hiện), Claude (chạy test, review)
- Trạng thái: `ready`. **Gấp**: Bảo đang cập nhật M1 ngày 02/11/2026.

## Lỗi thật (02/11/2026 ~10:55)

- Bảo chọn 1.311 món M1, bấm "Cập nhật Kiot + Sapo (1311 món)". Không có giá nào đổi, không có dòng Lịch sử.
- Log máy chủ: `BAOQ timings {"kind":"prepare", "networkMs":308241…}`. Bước `prepare` đọc lại từng món (GET Kiot `/products/:id` + GET Sapo, có giãn nhịp Sapo của TASK-113) mất **308 giây**.
- Node HTTP server mặc định `requestTimeout = 300000ms`. Yêu cầu `POST /sale-ai/api/kiot/prepare` bị cắt; trang không nhận `proposal` nên **không gọi** `POST /api/kiot/commit` (`public/live-ui.js:80-83`). Kho còn 1 `prepared` 1.311 món, không có `update`.
- Lượt nhỏ chạy bình thường: 2 lượt 1 món lúc 11:02, 11:03 thành công.
- `commit` cho ~1.300 món còn lâu hơn (giới hạn Sapo ~2 yêu cầu/giây): cũng không được phụ thuộc vào một yêu cầu HTTP đang mở.

## Yêu cầu

1. **Chạy nền:** bấm "Cập nhật Kiot + Sapo (N món)" thì máy chủ nhận việc, **trả ngay** (ví dụ 202 + mã lượt), rồi tự chạy kiểm tra và ghi ở nền. Trang theo dõi tiến độ bằng API trạng thái sẵn có (`/api/view` `busy`/`progress`, `live.progress`, `operation.platforms`) cho tới khi xong, rồi hiện kết quả và làm mới Lịch sử. Áp cho cả "Cập nhật lại các món lỗi" (`live-ui.js:169-171`).
   - Bấm nút vẫn coi là xác nhận như hiện nay (`confirmed:true`); không thêm hộp hỏi.
   - Đóng hoặc tải lại trang khi đang chạy: trang mở lại thấy tiến độ đang chạy, rồi kết quả trong Lịch sử.
   - Khoá "Đang xử lý một lượt khác" (409) giữ nguyên trong suốt cả lượt nền.
2. **Không đọc hai lần:** bước ghi (`joint-update.js` / `batch-joint.js`) đã đọc lại từng món và so dấu vân tay ngay trước khi ghi. Bước chuẩn bị cho lượt nền chỉ làm kiểm tra cục bộ (policy, P0, dòng bảng, mã Sapo trong chỉ mục) và **không** GET từng món. Kiểm tra an toàn trước khi ghi giữ nguyên.
3. **Không phụ thuộc thời gian HTTP:** đặt rõ timeout HTTP của máy chủ cho các yêu cầu thường (không tắt hẳn). Không yêu cầu nào của Sale AI được chạy quá vài giây.
4. Thông báo tiến độ trên trang dễ hiểu, ví dụ:
   - "Đang kiểm tra và cập nhật 1.311 món · 230/1.311 · Kiot lô 5/27 · Đang chờ giới hạn Sapo…";
   - xong: dòng tóm tắt TASK-114 ("x/1.311 thành công · …").
5. `prepared` cũ còn treo (1.311 món, 02/11 10:58) không gây lỗi; có thể bỏ khi tạo lượt mới.
6. **Không đổi:** quy tắc giá, so dấu vân tay, rollback, giới hạn Sapo (TASK-113), ẩn hàng trước 01/07 và từ 600tr.

## Test

- Lượt 1.500 món với Kiot/Sapo giả có độ trễ và đồng hồ giả: API trả ngay (dưới 1 giây thật); lượt chạy hết ở nền; Lịch sử có kết quả; không món nào bị GET hai lần trước khi ghi.
- Trong lúc chạy: `/api/view` báo `busy` và tiến độ; lượt thứ hai bị 409.
- "Cập nhật lại các món lỗi" chạy theo cùng cách.
- E2E `saleAiUpdateAll.test.ts` 15 ca vẫn đạt; chỉnh cho luồng nền nếu cần, giữ ý nghĩa từng ca.

## Cách làm

- Codex chạy `-a never`. Lệnh bị sandbox chặn thì ghi lại, không xin quyền. Claude chạy `npm test`, E2E, `npm run build`.
- Không gọi Kiot/Sapo thật. Không dừng hay khởi động lại server. Không commit. Ghi `tasks/TASK-116-result.md`.
