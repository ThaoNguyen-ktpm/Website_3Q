# Kế hoạch TASK-130

- Dùng đặc tả `TASK-130-spec.md` làm thiết kế đã được giao; triển khai trực tiếp, không đổi giao diện hay chính sách V2.
- Viết test server cho mọi tài nguyên sau đăng nhập/Admin, snapshot có/thiếu/lỗi, cache, module và traversal. Viết test frontend cho các liên kết V2 và tổng quan demo còn lại. Claude chạy test và trình duyệt theo yêu cầu người dùng; không tuyên bố chu kỳ red/green đã chạy.
- Chép HTML, 5 module/CSS KPI và 4 file goods cần tải; không chép tài liệu/QA/test/dữ liệu thật. Giữ nguyên byte các file tính toán bị cấm sửa. Sửa riêng các liên kết Trang chủ trong HTML.
- Tạo `v2Routes.ts`: role ADMIN như `access.ts`, đường dẫn snapshot cố định ngoài static root, no-store, CSP nội bộ, static chỉ `src/v2/mockup`. Gắn sau cookieParser/requireAuth và requireSameOrigin trong `app.ts`.
- Thêm script copy V2 và nối vào build server; proxy Vite `/v2`. Điều hướng tile/menu/sidebar/tab tới V2; giữ `#page=overview` với nhãn Tổng quan cũ (demo). Không đổi quyền vai trò khác.
- Kiểm tra tĩnh diff, danh sách file, hash nguồn và cú pháp; ghi rõ kiểm tra chưa chạy trong result. Không đọc bí mật, sửa nguồn, quản lý server, commit/push hay cài dependency.
