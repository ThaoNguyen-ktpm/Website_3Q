# TASK-012 — Kết quả video nền trang đăng nhập

- Dự án: web (`client/`).
- Người phụ trách: Codex (triển khai); Claude (review độc lập).
- Trạng thái: ready_for_review.
- Hành động gần nhất: triển khai video nền theo spec đã duyệt, chạy build/test và đối chiếu code.
- Bước tiếp theo: Claude review độc lập, chạy lại build/test trong môi trường cho phép tạo tiến trình con và kiểm tra giao diện ở 360px.

## Thay đổi

- `client/src/pages/LoginPage.tsx`: thêm video `/login-background.mp4` và lớp phủ trước nội dung; đầy đủ `autoPlay`, `muted`, `loop`, `playsInline`, `aria-hidden="true"`, `preload="auto"` theo spec. Giữ nguyên logic đăng nhập.
- `client/src/style.css`: thêm `position: relative`, `overflow: hidden` cho trang; giữ gradient dự phòng; video và lớp phủ cố định toàn màn hình, không nhận thao tác chuột; wordmark và card ở `z-index: 1`. Ẩn video khi `prefers-reduced-motion: reduce`.
- `tasks/TASK-012-result.md`: ghi kết quả và giới hạn kiểm chứng.
- Video có sẵn tại `client/public/login-background.mp4`, kích thước 2.299.383 byte; không sửa video. Không cài dependency, không commit, không xóa file. Bảo toàn các thay đổi có sẵn trong workspace.

## Kiểm tra thực tế

Chạy tại `D:\Website_3Q`, dùng `npm.cmd` trên PowerShell:

- `npm.cmd run build`: exit code 1. TypeScript server và client đã chạy qua; Vite thất bại khi nạp `client/vite.config.ts` do esbuild gọi tiến trình con bị `Error: spawn EPERM`. Chưa hoàn tất build. Sau lần chạy này, `Test-Path client/dist/login-background.mp4` trả về `False`.
- `npm.cmd test`: exit code 1. Vitest không khởi tạo được forks worker cho cả 4 file test do `spawn EPERM`; báo 4 unhandled errors, `Test Files no tests`, `Tests no tests`. Không có test nào được chạy thành công trong lần này.
- `git diff --check -- client/src/pages/LoginPage.tsx client/src/style.css`: đạt, không báo lỗi khoảng trắng.
- Đối chiếu code: đường dẫn video tính từ gốc site; gradient và card không phụ thuộc trạng thái tải video; các lớp trang trí có `pointer-events: none`; nội dung nằm trên video và lớp phủ.

## Giới hạn

- Chưa kiểm chứng bằng trình duyệt: video phát tự động, bấm wordmark/nút Google, giảm chuyển động, video lỗi tải và không tràn ngang tại viewport 360px. Đối chiếu CSS không thay thế kiểm tra trình duyệt.
- Chưa xác minh video được chép vào bản build vì Vite bị `spawn EPERM`.
- Code đã hoàn tất theo phạm vi spec nhưng chưa được Claude kiểm tra độc lập; không ghi `verified`.

## Sửa bổ sung

- Trạng thái: `ready_for_review`.
- Theo yêu cầu của Bảo ngày 2026-10-15, sửa `client/src/style.css`: giữ `object-fit: cover`, thêm `transform: scale(1.28)` và `transform-origin: center` cho `.login-background`, kèm comment giải thích hệ số. Dựa trên số đo Claude cung cấp: video rộng 1280px, phần hình thật rộng khoảng 1014px ở giữa; 1.28 lớn hơn 1280/1014 (~1.262), giúp đẩy viền đen cố định ra ngoài màn hình.
- `npm.cmd run build`: exit code 1; TypeScript server/client chạy qua, Vite bị `spawn EPERM` khi esbuild tạo tiến trình con.
- `npm.cmd test`: Vitest báo 4 lỗi `spawn EPERM` khi khởi tạo forks worker; không có test nào chạy thành công.
- `git diff --check -- client/src/style.css tasks/TASK-012-result.md`: đạt.
- Chỉ sửa CSS và phần bổ sung này; không sửa video, không commit. Chưa kiểm tra trực quan trên trình duyệt sau thay đổi; Claude cần review độc lập phần bổ sung và kiểm tra video phủ kín màn hình, gồm viewport 360px.
