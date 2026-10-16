# TASK-019 — Nhật ký thao tác (AuditLog)

- Dự án: web. Người phụ trách: Claude (đặc tả, review, migration), Codex (code).
- Trạng thái: ready — Bảo duyệt kế hoạch bảo mật mục 6 ("thực hiện", 2026-10-16). Giữ nhật ký 1 năm.
- Bước tiếp theo: Codex code + test, ghi `tasks/TASK-019-result.md`. KHÔNG chạy prisma migrate/generate. Chạy song song với TASK-020 (Codex khác) — CHỈ sửa file liệt kê dưới đây; không đụng `scripts/`, `.githooks/`, `.gitleaksignore`, `docs/BACKUP.md`.

## Schema
```prisma
model AuditLog {
  id         Int      @id @default(autoincrement())
  actorId    Int?
  actorEmail String?  @db.VarChar(191)
  action     String   @db.VarChar(64)
  targetType String?  @db.VarChar(32)
  targetId   String?  @db.VarChar(64)
  before     Json?
  after      Json?
  ip         String?  @db.VarChar(64)
  createdAt  DateTime @default(now())
  @@index([createdAt])
  @@index([actorId])
  @@index([action])
}
```
Không quan hệ khóa ngoại (giữ log khi nhân viên đổi).

## Ghi log (server)
- `models/auditLogModel.ts`, `services/auditService.ts` với `record({ actor, action, targetType, targetId, before, after, ip })`; ghi log lỗi không được làm hỏng thao tác chính (try/catch, log lỗi ra console không kèm dữ liệu nhạy cảm).
- Hành động:
  - `auth.login` (thành công: actor = staff), `auth.login_denied` (bị từ chối: actorEmail nếu có, lý do: `not_staff`, `disabled`, `unverified_email`, `sub_mismatch`; không ghi token), `auth.logout`.
  - `staff.create` (after = bản ghi an toàn + quyền), `staff.update` (before/after chỉ các trường đổi: fullName, phone, role, status, customPermissions, permissions).
- `before`/`after` không bao giờ chứa `googleSub`, token, cookie.
- IP lấy từ `request.ip` (đã có `trust proxy` khi cấu hình).
- Dọn log cũ: hàm `purgeOlderThan(days)` + chạy khi server khởi động và mỗi 24h, xóa log quá 365 ngày (`AUDIT_RETENTION_DAYS`, mặc định 365).

## Quyền và API
- Thêm quyền `audit.view` (nhãn "Xem nhật ký thao tác") vào danh mục `server/src/config/permissions.ts`; ADMIN có (vì ADMIN = tất cả); không thêm vào mẫu MANAGER/STAFF.
- `GET /api/audit-logs?action=&actorId=&page=&pageSize=` (`requireAuth`, `requirePermission('audit.view')`): zod query strict, `pageSize` ≤ 100 (mặc định 25), sắp xếp mới nhất trước; trả `{ items, total, page, pageSize }`; mỗi item có nhãn hành động tiếng Việt.

## Client (design admin)
- Mục menu mới "Nhật ký" (icon sẵn có phù hợp) chỉ khi có `audit.view`, route hash `#audit`.
- Bảng: Thời gian, Người thực hiện, Hành động (Badge), Đối tượng, Chi tiết (tóm tắt thay đổi before → after dạng chữ), IP. Bộ lọc hành động + người thực hiện, phân trang. Trạng thái đang tải / lỗi / rỗng.
- File: `client/src/api/audit.ts`, `client/src/admin/views/App.jsx` (+ CSS cần thiết trong `client/src/admin/styles.css`).

## Tests
- Ghi log khi đăng nhập thành công/bị từ chối/đăng xuất, tạo/sửa nhân viên (đúng before/after, không có googleSub).
- Ghi log thất bại không làm hỏng request.
- `/api/audit-logs`: 401 không phiên, 403 thiếu quyền, phân trang và lọc, pageSize > 100 → 400.
- `purgeOlderThan` xóa đúng mốc.

## Ngoài phạm vi
Xuất log, cảnh báo realtime. Không commit, không cài gói, không sửa túi 3D, `.login-*`.
