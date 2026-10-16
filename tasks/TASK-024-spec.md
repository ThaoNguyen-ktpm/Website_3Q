# TASK-024 — Admin chính cố định trong controller

- Dự án: web (`server/`, `client/`). Người phụ trách: Claude (đặc tả, review), Codex (code).
- Trạng thái: ready — Bảo yêu cầu 2026-10-16: "riêng gmail nvthao.12a5.20@gmail.com là admin chính, acc admin khác không được thay đổi — sửa trong controller, không sửa trong database".
- Áp dụng `CLAUDE.md`/`AGENTS.md` mục "Quy tắc code": không cài gói, không sửa/nới test hiện có (chỉ THÊM test mới), không xóa comment, xử lý lỗi đầy đủ, có kiểu.

## Yêu cầu
- `server/src/controllers/staffController.ts`: hằng `PRIMARY_ADMIN_EMAIL = 'nvthao.12a5.20@gmail.com'` (có comment giải thích: yêu cầu của Bảo, cố định trong code, không lưu DB). So sánh không phân biệt hoa thường, sau trim.
- `updateStaff`: trước khi gọi `staff.update`, lấy nhân viên đích qua service (thêm hàm đọc `getById` trong `staffService` nếu chưa có — controller KHÔNG gọi Prisma). Nếu đích là Admin chính và người thao tác (`response.locals.user.email`) không phải Admin chính → 403 `ApiError('FORBIDDEN', 'Không thể thay đổi tài khoản Admin chính.')` (không ghi gì vào DB). Đích không tồn tại → để service trả 404 như hiện tại.
- Admin chính tự sửa mình: giữ các luật hiện có của service (đổi họ tên/số điện thoại được; không tự đổi vai trò/trạng thái/quyền).
- `getStaff`: mỗi nhân viên trong response thêm `isPrimaryAdmin: boolean` (tính ở controller). Không đổi các trường khác.
- `GET /api/auth/me` (`authController`): thêm `isPrimaryAdmin` cho người dùng hiện tại (dùng cùng hằng — export từ một chỗ duy nhất, ví dụ `server/src/config/primaryAdmin.ts` được controller import; hằng vẫn được khai báo trong code, không qua DB/.env).
- Client (`client/src/admin/views/App.jsx`, `client/src/api/*.ts` kiểu dữ liệu): bảng nhân viên hiện Badge nhỏ "Admin chính" ở dòng có `isPrimaryAdmin`; nút "Sửa" của dòng đó ẩn với người dùng không phải Admin chính. Lỗi 403 từ server vẫn hiện trong drawer nếu có.
- Không thay đổi schema/migration/seed/dữ liệu.

## Test (THÊM file mới `server/src/tests/primaryAdmin.test.ts`, không sửa test cũ)
- Admin khác PATCH Admin chính (họ tên, vai trò, trạng thái, quyền) → 403 đúng message, service `update` không được gọi.
- Admin chính PATCH chính mình đổi họ tên → 200.
- Admin khác PATCH nhân viên thường → vẫn 200 như cũ.
- Email Admin chính viết hoa/khoảng trắng vẫn nhận đúng.
- `GET /api/staff` có `isPrimaryAdmin` đúng; `/api/auth/me` có `isPrimaryAdmin`.

Không commit. Ghi `tasks/TASK-024-result.md`.
