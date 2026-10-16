# TASK-024 — Review: Admin chính cố định trong controller

- Người review: Claude. Trạng thái: verified (test + đọc code); thao tác thật trên giao diện bằng tài khoản Admin khác: chờ Bảo thử.

## Bằng chứng
- `server/src/config/primaryAdmin.ts`: hằng `PRIMARY_ADMIN_EMAIL = 'nvthao.12a5.20@gmail.com'` + `isPrimaryAdmin()` (trim, lowercase), có comment nguồn yêu cầu. Không DB, không .env.
- `staffController.updateStaff`: đọc đích qua `staff.getById` (không gọi Prisma ở controller); đích là Admin chính mà người thao tác không phải → 403 "Không thể thay đổi tài khoản Admin chính." trước khi gọi `staff.update`. Đích không tồn tại → service trả 404 như cũ.
- `getStaff`/`createStaff`/`updateStaff`/`/api/auth/google`/`/api/auth/me` trả thêm `isPrimaryAdmin`.
- Client: Badge "Admin chính"; nút "Sửa" dòng Admin chính chỉ hiện khi người dùng là Admin chính.
- Schema/seed/migration không bị sửa trong task này (mtime trước thời điểm tạo spec).
- `npm test`: 9 file, 223/223 đạt (gồm `primaryAdmin.test.ts` mới của Codex, 25 test); `npm run build --workspace client` đạt.

## Thay đổi test cũ (quy tắc mục 4 — ghi lý do)
- 3 test trong `auth.test.ts` so khớp tuyệt đối `{ user: publicUser }` thất bại vì response nay có thêm `isPrimaryAdmin` theo spec TASK-024. Claude thêm `isPrimaryAdmin: false` vào fixture `publicUser` (user mẫu không phải Admin chính), giữ nguyên `toEqual` tuyệt đối — không nới lỏng. Có comment tại fixture.
