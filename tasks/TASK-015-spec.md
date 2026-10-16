# TASK-015 — Bảng nhân viên, phân quyền theo vai trò, trang Nhân viên thật

- Dự án: web (`server/`, `client/`).
- Người phụ trách: Claude (đặc tả, review, chạy Prisma/DB), Codex (code).
- Trạng thái: ready — Bảo giao toàn quyền 2026-10-16 ("tui cho bạn toàn quyền stack này, hồi tui kiểm tra giao diện"). Ma trận quyền dưới đây là đề xuất của Claude; Bảo xem lại sau và có thể đổi.
- Bước tiếp theo: Codex triển khai, ghi `tasks/TASK-015-result.md`, `ready_for_review`. Claude chạy migration/seed sau khi Codex xong.

## Database (Claude làm, không phải Codex)
- DB chính thức: `baoq_luxury` trên MySQL XAMPP `localhost:3306`, cùng tài khoản đang có trong `server/.env`. `shop_test` giữ nguyên.
- Sau khi Codex sửa schema: Claude chạy `prisma migrate dev --name init` (tạo DB + migration đầu tiên), `prisma generate`, `npm run db:seed`.

## Vai trò và quyền (đề xuất)
Quyền:
| Khóa | Ý nghĩa |
|---|---|
| `dashboard.view` | Xem Tổng quan |
| `reports.export` | Xuất báo cáo CSV |
| `products.view` / `products.edit` | Xem / thêm, sửa sản phẩm |
| `orders.view` / `orders.edit` | Xem / xử lý đơn hàng |
| `customers.view` / `customers.edit` | Xem / sửa khách hàng |
| `staff.view` / `staff.manage` | Xem / thêm, sửa nhân viên và vai trò |
| `settings.manage` | Sửa Cài đặt cửa hàng |

Vai trò:
| Vai trò (`StaffRole`) | Nhãn | Quyền |
|---|---|---|
| `OWNER` | Chủ cửa hàng | Tất cả |
| `MANAGER` | Quản lý | Tất cả trừ `staff.manage`, `settings.manage` |
| `SALES` | Bán hàng | `dashboard.view`, `products.view`, `orders.view`, `orders.edit`, `customers.view`, `customers.edit` |
| `WAREHOUSE` | Kho & thu mua | `dashboard.view`, `products.view`, `products.edit`, `orders.view` |
| `ACCOUNTANT` | Kế toán | `dashboard.view`, `reports.export`, `products.view`, `orders.view`, `customers.view` |

Quy tắc nghiệp vụ (server bắt buộc):
- Chỉ người có `staff.manage` được thêm/sửa nhân viên. Chỉ `OWNER` được gán hoặc gỡ vai trò `OWNER`.
- Không tự hạ vai trò hoặc tự tạm ngưng chính mình.
- Luôn còn ít nhất 1 `OWNER` đang hoạt động.
- Không xóa nhân viên; dùng trạng thái Tạm ngưng.

Ma trận đặt một chỗ: `server/src/config/permissions.ts` (vai trò → quyền, nhãn tiếng Việt). Client nhận danh sách quyền qua API, không tự định nghĩa lại.

## Schema (`server/prisma/schema.prisma`)
```prisma
enum StaffRole { OWNER MANAGER SALES WAREHOUSE ACCOUNTANT }
enum StaffStatus { ACTIVE DISABLED }
model Staff {
  id          Int         @id @default(autoincrement())
  email       String      @unique @db.VarChar(191)
  fullName    String      @db.VarChar(120)
  phone       String?     @db.VarChar(20)
  role        StaffRole   @default(SALES)
  status      StaffStatus @default(ACTIVE)
  googleSub   String?     @unique @db.VarChar(191)
  lastLoginAt DateTime?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
}
```
Các model khác giữ nguyên (sẽ được tạo bảng trống cùng lúc).

## Server
- `models/staffModel.ts`: Prisma cho Staff (find by email/id/googleSub, list, create, update, count active owners).
- `services/staffService.ts`: list, create, update + toàn bộ quy tắc nghiệp vụ trên; lỗi `ApiError` (400 `VALIDATION_ERROR`, 403 `FORBIDDEN`, 404 `NOT_FOUND`, 409 `EMAIL_EXISTS`, 409 `LAST_OWNER`).
- `controllers/staffController.ts` + `routes/staffRoutes.ts` tại `/api/staff`: `GET /` (`staff.view`), `POST /` (`staff.manage`), `PATCH /:id` (`staff.manage`). zod strict: `email` (trim, lowercase, email, ≤191), `fullName` (trim, 1–120), `phone` (tùy chọn, ≤20, chỉ số/khoảng trắng/+), `role`, `status`.
- `middlewares/requirePermission.ts`: `requirePermission(key)` sau `requireAuth`; thiếu quyền → 403 `FORBIDDEN` "Bạn không có quyền thực hiện thao tác này.".
- Đăng nhập (`authService.ts`): sau khi xác minh Google + `email_verified`, tìm Staff theo email; phải `ACTIVE`, nếu không → 403 `EMAIL_NOT_ALLOWED` (giữ thông điệp cũ). Lưu `googleSub` nếu trống (khác sub đã lưu → 403), cập nhật `lastLoginAt`. Bỏ kiểm `GOOGLE_ALLOWED_EMAILS` khi đăng nhập.
- Phiên: cookie ký `{ staffId, createdAt }`, ≤ 7 ngày; `readSession` đọc Staff từ DB, phải `ACTIVE` (tạm ngưng = mất phiên ngay).
- Người dùng công khai (`/api/auth/google`, `/api/auth/me`, `response.locals.user`): `{ id, email, fullName, role, roleLabel, permissions: string[] }`.
- `GET /api/staff/roles`: danh sách vai trò `{ role, label, permissions: [{ key, label }] }` cho form (cần `staff.view`).
- `prisma/seed.ts`: mặc định chỉ tạo/cập nhật `OWNER` ACTIVE cho từng email trong `GOOGLE_ALLOWED_EMAILS` (fullName = phần trước @ nếu chưa có). Dữ liệu mẫu cũ (danh mục, sản phẩm, admin mật khẩu) chỉ chạy khi `SEED_SAMPLE_DATA=true`; khi không bật thì không yêu cầu `SEED_ADMIN_PASSWORD`.
- `.env.example`: ghi `DATABASE_URL` trỏ `baoq_luxury`, giải thích `GOOGLE_ALLOWED_EMAILS` nay là danh sách chủ cửa hàng khởi tạo khi seed, thêm `SEED_SAMPLE_DATA=false`.
- Tests: `auth.test.ts` (mock staffModel: active/disabled/không có/googleSub khác/phiên staff bị tạm ngưng → 401), `staff.test.ts` mới (quyền 401/403, tạo, trùng email 409, chỉ OWNER gán OWNER, không tự hạ/tạm ngưng, giữ ≥1 OWNER, validation). `products.test.ts`, `authConfig.test.ts` đạt.

## Client (`client/src/admin/`, giữ design system của admin: Drawer, Field, Badge, Avatar, PanelHeading, `.button`, màu/khoảng cách sẵn có)
- `client/src/api/auth.ts`: `AuthUser` theo shape mới. Thêm `client/src/api/staff.ts` (list, roles, create, update; đọc `error.message`).
- Thanh trên (`views/App.jsx`): bỏ khối `.admin-session` (email + nút rời) và hồ sơ mẫu "Nguyễn An". Thay bằng hồ sơ thật cùng kiểu: Avatar chữ cái đầu từ `fullName`, tên, `roleLabel`, nút chevron mở menu nhỏ (kiểu popover như panel thông báo) chứa email và "Đăng xuất". Giữ "Bản xem trước", chuông thông báo.
- Điều hướng theo quyền: mục menu chỉ hiện khi có quyền xem (Tổng quan `dashboard.view`, Sản phẩm `products.view`, Đơn hàng `orders.view`, Khách hàng `customers.view`, Nhân viên `staff.view`, Cài đặt `settings.manage`). Hash tới trang không có quyền → khối "Bạn không có quyền xem trang này". Trang mặc định = trang đầu tiên được phép. Ẩn "Xuất báo cáo" khi thiếu `reports.export`, nút thêm/sửa sản phẩm khi thiếu `products.edit`.
- Trang Nhân viên: dữ liệu từ `/api/staff` (bỏ `seedTeam` khỏi trang này). Cột: Thành viên (Avatar, tên, email), Vai trò, Trạng thái (Badge Đang hoạt động/Tạm ngưng), Đăng nhập gần nhất, thao tác "Sửa" (khi có `staff.manage`). Thanh công cụ: ô tìm kiếm hiện có + nút chính "Thêm nhân viên" (khi có `staff.manage`). Có trạng thái đang tải, lỗi, rỗng.
- Drawer "Thêm nhân viên"/"Sửa nhân viên": Họ tên*, Email Google*, Số điện thoại, Vai trò (select từ `/api/staff/roles`), Trạng thái; bên dưới vai trò hiện danh sách quyền của vai trò đang chọn (chỉ đọc). Lưu → gọi API, đóng drawer, cập nhật bảng, toast. Lỗi server hiện trong drawer. Ẩn lựa chọn `OWNER` nếu người dùng không phải OWNER. Email không sửa được khi đang sửa.
- `client/src/pages/AdminPage.tsx`: truyền `user` đầy đủ.
- Các trang khác giữ dữ liệu mẫu.

## Tiêu chí nghiệm thu
- `npm run build`, `npm test` đạt; migration `init` tạo bảng `Staff`; seed tạo OWNER cho email trong `GOOGLE_ALLOWED_EMAILS`.
- Server chặn đúng quyền (test); client ẩn đúng mục.
- Không sửa code túi 3D, không sửa `.login-*`, không cài dependency, không commit.

## Ngoài phạm vi
API thật cho sản phẩm/đơn/khách, nhật ký thao tác, xóa nhân viên, quyền tùy chỉnh từng người.
