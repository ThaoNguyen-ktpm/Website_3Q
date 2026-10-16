# TASK-019 — Nhật ký thao tác

- Dự án: web. Người phụ trách: Codex (triển khai), Claude (review/migration).
- Trạng thái: ready_for_review.
- Hành động gần nhất: hoàn tất code; 198/198 test server qua bằng runner có sẵn và self-check component/API client qua.
- Bước tiếp theo: Claude review độc lập, thực hiện migration/generate theo phân vai, rồi kiểm tra DB và trình duyệt trong môi trường cho phép.
- Giới hạn: không migrate/generate Prisma, không cài gói, không sửa server/.env, không commit; không đụng TASK-020, túi 3D và .login-*.
- Bằng chứng: kiểm tra cục bộ với dữ liệu thử/mocks bên dưới. Chưa được Claude kiểm tra độc lập; không ghi verified.

## Thay đổi và file thuộc TASK-019

- `server/prisma/schema.prisma`: thêm model AuditLog đúng đặc tả, ba index createdAt/actorId/action, không khóa ngoại. Không tạo hoặc chạy migration, không generate client.
- `server/src/models/auditLogModel.ts`: create, list/count cùng bộ lọc, thứ tự createdAt desc rồi id desc, phân trang trong DB; deleteMany chỉ xóa createdAt nhỏ hơn mốc lưu giữ.
- `server/src/services/auditService.ts`: record với try/catch và thông báo console cố định, không in lỗi DB hoặc dữ liệu đầu vào. Snapshot dùng danh sách trường được phép, chỉ nhận scalar/quyền dạng chuỗi, loại googleSub/token/cookie và object lồng nhau; thời gian của bản ghi nhân viên an toàn được đổi sang ISO. Nhãn hành động tiếng Việt, query zod strict, pageSize mặc định 25/tối đa 100, từ chối tham số lạ/lặp hoặc số không hợp lệ. purgeOlderThan và lịch dọn khi khởi động/mỗi 24h, timer unref.
- `server/src/config/env.ts`, `server/src/server.ts`: AUDIT_RETENTION_DAYS mặc định 365, số nguyên 1–36500; khởi động lịch dọn sau khi server bắt đầu lắng nghe. Không sửa `.env` hay `.env.example`.
- `server/src/config/permissions.ts`: audit.view có nhãn tiếng Việt, ADMIN được hưởng từ allPermissions; loại khỏi mẫu MANAGER, STAFF giữ nguyên. Quyền tùy chỉnh vẫn có thể cấp audit.view theo cơ chế hiện có.
- `server/src/routes/auditRoutes.ts`, `server/src/app.ts`: GET /api/audit-logs với requireAuth và requirePermission('audit.view'), trả items/total/page/pageSize.
- `server/src/services/authService.ts`, `server/src/controllers/authController.ts`: ghi đăng nhập thành công, từ chối với bốn lý do not_staff/disabled/unverified_email/sub_mismatch, cả trường hợp staff thay đổi trong transaction hoặc trùng Google subject. Actor/email lấy từ kết quả xác thực; không lưu credential/sub. Logout ghi actor khi đọc được phiên hợp lệ, vẫn xóa cookie nếu tra cứu/log lỗi; logout không phiên vẫn 204 như trước. IP truyền từ request.ip.
- `server/src/services/staffService.ts`, `server/src/controllers/staffController.ts`: ghi staff.create sau khi transaction hoàn tất, snapshot bản ghi an toàn kèm quyền; staff.update chỉ ghi các trường đổi trong fullName/phone/role/status/customPermissions/permissions. So sánh quyền theo tập hợp, không ghi khác biệt chỉ do thứ tự. Thao tác thất bại không tạo log thành công; lỗi ghi audit không làm hỏng thao tác chính. IP và actor truyền từ request.
- `client/src/api/audit.ts`, `client/src/admin/views/App.jsx`, `client/src/admin/styles.css`: menu Nhật ký với icon clock, hash #audit và kiểm tra audit.view, API client, bảng sáu cột, badge, nội dung thay đổi dạng chữ, lọc hành động và mã nhân viên, phân trang, loading/error/retry/empty. Lọc bằng mã nhân viên không phụ thuộc staff.view, dùng được cả khi người xem chỉ có audit.view. Giữ mẫu thiết kế admin hiện tại; bảng có vùng cuộn, nội dung dài xuống dòng.
- Test: thêm `server/src/tests/audit.test.ts`, bổ sung `auth.test.ts`, `staff.test.ts`, `authConfig.test.ts`; thêm `tasks/TASK-019-ui-selfcheck.mjs` và báo cáo này. Không sửa cấu hình runner cũ.

## Bằng chứng cục bộ (2026-10-16)

Chạy tại `D:\Website_3Q`, PowerShell, không cài gói:

1. `npm.cmd test`: không chạy được tests vì Vitest forks bị `spawn EPERM`. Không coi lệnh mặc định đã qua.
2. `node node_modules/vitest/vitest.mjs run --config tasks/TASK-018-vitest.config.ts --configLoader native`: **8 file, 198/198 tests qua, exit 0**. Dùng nguyên runner TASK-018 hiện có. Có cảnh báo MODULE_TYPELESS_PACKAGE_JSON của config TS, không sửa package.json.
3. `node tasks/TASK-019-ui-selfcheck.mjs`: **PASS, exit 0**. Kiểm tra menu/route theo quyền, bảng và nhãn tiếng Việt, before → after, tải/lỗi/rỗng/thử lại, bộ lọc, phân trang, abort, URL query/credentials và lỗi API. Đây là kiểm tra component/event và fetch bằng mocks, không phải trình duyệt thật.
4. `npm.cmd run build`: dừng ở server tsc do Prisma Client cũ thiếu AuditLogCreateInput/AuditLogWhereInput/prisma.auditLog, kèm lỗi suy diễn kiểu item từ model chưa có. Không generate/migrate để xử lý, theo yêu cầu Bảo.
5. `node node_modules/typescript/bin/tsc -p server/tsconfig.json --noEmit`: cùng các lỗi Prisma cũ trên; chưa kết luận build server qua.
6. `npm.cmd run build --workspace client`: client tsc qua, Vite bị `spawn EPERM` khi tạo esbuild. `node node_modules/typescript/bin/tsc -b client/tsconfig.json`: **qua**. Chưa kết luận production bundle hoàn tất.
7. `git diff --check`: **qua**, chỉ cảnh báo chuẩn hóa LF/CRLF ở các file hiện có.
8. Impeccable detector trên App.jsx/styles.css đã chạy một lần: báo drift của mẫu admin hiện có so với DESIGN.md dành cho đăng nhập (font/màu/cỡ chữ/radius); phần thêm mới tiếp tục dùng token và mẫu admin. Không đổi thiết kế chung hoặc tài liệu thiết kế ngoài phạm vi.

Tests server kiểm tra: đăng nhập/đăng xuất/thêm/sửa nhân viên có log và actor/IP; đủ bốn lý do từ chối và race trong transaction; snapshot an toàn, đúng trường đổi/quyền; audit thất bại không đổi kết quả request hoặc lộ lỗi nhạy cảm; 401/403/quyền tùy chỉnh; strict query, filter, pagination, pageSize >100 trả 400, lỗi DB an toàn; mốc xóa strictly older, lịch khởi động/24h, tiếp tục sau lỗi, cấu hình thời hạn.

## Giới hạn và bàn giao

- Chưa chạy trên DB có bảng AuditLog: Claude cần migration và generate client trước khi xác minh ghi/đọc/xóa log thật. Ở trạng thái DB/client hiện tại, thao tác chính vẫn chạy khi ghi audit lỗi nhưng nhật ký chưa được lưu; API nhật ký cần model/bảng mới để hoạt động.
- Chưa kiểm tra trình duyệt desktop/mobile, Google Sign-In thật, proxy/IP thật, DB thật hoặc việc chờ 24h thực tế. Lịch được kiểm tra bằng fake timers, DB/Google dùng mocks.
- Không triển khai xuất log hoặc cảnh báo realtime. Không commit/cài gói/sửa server/.env, không chạy bất kỳ prisma migrate/generate nào, không sửa túi 3D hoặc .login-*.
- Không sửa `scripts/`, `.githooks/`, `.gitleaksignore`, `docs/BACKUP.md` hoặc file TASK-020; các thay đổi đồng thời ở các đường dẫn đó thuộc phiên khác. Giữ nguyên các thay đổi có sẵn trong checkout, bao gồm migration đã bị xóa từ trước.
- Code hoàn tất và **ready_for_review**, chưa được Claude kiểm tra độc lập.
