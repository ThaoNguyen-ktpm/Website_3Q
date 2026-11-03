Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-123 — Kết quả triển khai

- Dự án: web (Sale AI).
- Người phụ trách: Codex triển khai; Claude chạy test và review.
- Trạng thái: `ready_for_review`.
- Hành động gần nhất: thêm điều kiện bảo vệ lượt đang theo dõi và test hồi quy `job:null`.
- Bước tiếp theo: Claude chạy các bộ kiểm tra trong spec và review độc lập. Chưa ghi `verified`.

## Thay đổi

1. `Webstie/server/src/sale-ai/public/app.js`: thêm `observedJob&&` trước phép so sánh `status.job?.id===observedJob` trong polling `/api/status`. Khi chưa theo dõi lượt nào, nhánh dừng ngay; khi có ID được theo dõi nhưng `job:null`, phép so sánh không khớp nên không đọc `.status` của null.
2. Rà `public/app.js` và `public/live-ui.js`: chỉ tìm thấy một phép so sánh ID có lỗi này. Nhánh `status.job?.status==='running'` đã kiểm tra trạng thái bằng optional chaining trước khi đọc `.kind`; `live-ui.js` không có truy cập `job` hoặc phép so sánh `?.id===` cùng kiểu. Không sửa `live-ui.js`.
3. `Webstie/server/src/sale-ai/test/background-ui.test.js`: thêm test chạy API helper, `renderProgress` và callback polling thật trong VM, với fetch thay bằng phản hồi kiểm thử `/api/status` có `job:null`, chưa có `observedJob`. Hai nhịp polling kiểm tra không phát thông báo lỗi, ô tiến độ vẫn ẩn, nội dung bảng được giữ, trạng thái polling được giải phóng và không gọi API chi tiết lượt. Dùng cách kiểm thử VM sẵn có; không thêm dependency hay nới lỏng test cũ.

## Kiểm tra thực tế

- `node --check Webstie/server/src/sale-ai/public/app.js`: exit 0.
- `node --check Webstie/server/src/sale-ai/test/background-ui.test.js`: exit 0.
- `git diff --check -- Webstie/server/src/sale-ai/public/app.js`: không báo lỗi whitespace.
- Rà tĩnh các truy cập job và phép so sánh ID trong hai file UI bằng `rg`.
- Không có lệnh bị sandbox chặn trong phiên này.

Theo yêu cầu, Codex chưa chạy test hoặc build. Test mới chưa được chạy để xác nhận đỏ/xanh; bằng chứng hiện có chỉ là kiểm tra cú pháp và rà mã. VM giữ bảng có sẵn để kiểm tra polling không làm hỏng bảng; chưa thay thế kiểm tra hiển thị bằng trình duyệt.

Claude cần chạy: `npm run build`, `npm test` tại `Webstie`; `node --test *.test.js` tại `Webstie/server/src/sale-ai/test`; E2E 5 lần; `npm test` tại `Webstie/BossTele`, theo spec. Có thể chạy riêng `node --test background-ui.test.js` tại thư mục test lõi để kiểm tra hồi quy trước.

Không gọi Kiot/Sapo thật, không đọc/in khóa, không dừng hoặc khởi động lại server, không commit. Giữ nguyên các thay đổi có sẵn ngoài phạm vi TASK-123.
