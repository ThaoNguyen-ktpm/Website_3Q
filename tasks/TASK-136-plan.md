# TASK-136 — Kế hoạch triển khai

Máy: Laptop (DESKTOP-4G5GOSR)

Đặc tả: `tasks/TASK-136-spec.md`. Giữ React/TypeScript/CSS và runtime V2 hiện có, không thêm dependency, không commit/chuyển nhánh. Không sửa shared, BossTele, services, Sale AI.

1. Thay hai test TASK-135 trong `Webstie/frontend/task041.spec.ts`: iframe theo chiều cao `#main`, chi tiết phủ viewport ở 1440×1000, 1024×900, 390×844; kiểm khóa/phục hồi cuộn, focus, các cách đóng, record/item và link sâu. Giữ nguyên kiểm tra Back sau F5. Chạy trước khi sửa và ghi nhận nếu sandbox chặn.
2. `Webstie/frontend/src/v2-frame.tsx`: nhận height 400–200000; mở rộng chính iframe đang chạy, giữ placeholder và tọa độ cũ; khóa cuộn và inert các nhánh DOM bên ngoài iframe, backdrop cấp trang cha; cleanup đầy đủ. Xác thực origin/source mọi message.
3. `Webstie/frontend/src/app-v2.css`: bỏ layout 100dvh TASK-135; iframe không viền/bo góc, cao theo nội dung. Backdrop không làm thay đổi containing block của iframe.
4. `Webstie/server/src/v2/mockup/baoq-mockup-v2.html`: sender height ResizeObserver, thông báo overlay, nhận tọa độ để cố định main; dùng nguyên sheet/dialog, focus trap và dữ liệu trong bộ nhớ. Phân biệt điều hướng người dùng với phục hồi lịch sử của iframe; trang cha quyết định route khi tải/phục hồi. Không thay đổi chế độ trực tiếp.
5. Chạy typecheck, cú pháp inline, build/test toàn dự án và Playwright task041. Ghi lệnh, exit code, giới hạn và nguyên nhân đổi test vào result tiếng Việt, trạng thái ready_for_review. Claude nghiệm thu độc lập.

Các điểm rà soát: link sâu khi khởi động; đóng/mở nhanh; resize trong overlay; focus từ tiêu đề bằng Shift+Tab; thoát trang khi overlay mở; message giả origin/source; Back/Forward sau reload không thêm entry từ iframe.
