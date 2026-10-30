# TASK-041 — Kế hoạch kiểm tra và sửa

**Mục tiêu:** kiểm tra code chưa commit đúng phạm vi TASK-041, sửa lỗi đã tái hiện, thêm test và bàn giao Claude.
**Đặc tả:** `tasks/TASK-041-spec.md`. Giữ React/Vite/Express và dependency hiện có, giữ giao diện v3, không sửa BossTele, skill hoặc tích hợp ngoài.

1. Kiểm tra diff, auth, origins, các quyền API và giao diện; chạy test hiện có làm mốc.
2. Thêm test hồi quy trước khi sửa: quyền theo ba vai trò và quyền tùy chỉnh; mã/link đăng nhập; localStorage hỏng; đăng nhập khi Google tải chậm; hủy/thử lại trợ lý. Dùng Playwright đã cài cho frontend và Vitest hiện có cho server.
3. Sửa tối thiểu tại `frontend/src` và server nếu tìm được lỗi. Tách hàm thuần để kiểm thử khi cần, không thiết kế lại giao diện hoặc thêm tính năng.
4. Chạy `npm.cmd run build`, `npm.cmd test` tại Webstie; typecheck, Vite build tạm và test frontend. Kiểm tra chuỗi nội bộ không nằm trong index chunk; kiểm tra trang ngoài và các vai trò bằng trình duyệt với fixture được ghi rõ trong test.
5. Review độc lập code, xử lý phát hiện có bằng chứng, ghi `tasks/TASK-041-result.md` với trạng thái `ready_for_review`, số test và giới hạn xác minh thật. Không tự commit/push.

**Trọng tâm:** route lạ và quyền bị thu hồi; recent có null/sai kiểu; nút Google tải xong khi link đang đăng nhập; dialog đóng rồi mở lại; origin 8787/wifi và origin giả mạo. Kiểm tra API mô phỏng không thay thế đăng nhập Google, wifi hay Anthropic thật.
