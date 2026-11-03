Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-121 — Kế hoạch

Đặc tả: `tasks/TASK-121-spec.md`. Giữ stack, dependency, giá, lô 50, xác minh, khóa và chạy nền hiện có.

1. Thêm test trước: transport Kiot mặc định không dùng fetch toàn cục; HTTP cục bộ ngắt socket giữa body, GET thử lại, PUT không thử lại, JSON rỗng/cụt và timeout.
2. Thay transport mặc định bằng `node:https`/`node:http`, giữ giao diện fetcher để test cũ không gọi mạng thật. Timeout 30 giây bao trùm cả body.
3. Tái sử dụng phục hồi journal khi khởi động cho lưới an toàn fatal: chặn công việc/ghi mới, chờ ghi đang thực hiện, phục hồi từ checkpoint; log đã che bí mật rồi thoát trong thời gian giới hạn, không tiếp tục chạy tiến trình lỗi.
4. Chuẩn hóa lỗi mất kết nối/JSON của API trên trang; giữ lỗi nghiệp vụ và AbortError.
5. Chạy test tập trung, typecheck, thử E2E fixture nếu sandbox cho phép; không chạy full core in-process. Claude chạy toàn bộ kiểm tra và review độc lập. Viết result với bằng chứng và giới hạn.

Không gọi Kiot/Sapo thật, không đọc/in khóa, không thao tác server đang chạy, không commit. Bảo toàn thay đổi có sẵn.
