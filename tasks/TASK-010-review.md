# TASK-010 — Review đăng nhập Google

- Dự án: web.
- Người review: Claude.
- Trạng thái: verified cho phần code; đăng nhập Google thật: blocked (chờ Bảo tạo Client ID).
- Hành động gần nhất: đọc toàn bộ thay đổi, sinh migration + Prisma client, chạy build/test, kiểm tra API và giao diện trên trình duyệt.
- Bước tiếp theo: Bảo tạo Google Client ID, điền `server/.env`, áp migration vào MySQL; sau đó thử đăng nhập thật.

## Phạm vi đã xem
Server: `config/env.ts`, `services/{authService,googleTokenVerifier}.ts`, `controllers/authController.ts`, `routes/authRoutes.ts`, `models/userModel.ts`, `app.ts`, `middlewares/errorHandler.ts`, `prisma/schema.prisma`, `.env.example`, `tests/{auth,authConfig}.test.ts`.
Client: `api/auth.ts`, `hooks/useAuth.ts`, `pages/LoginPage.tsx`, `App.tsx`, `components/Header.tsx`, `style.css`, `package.json`, `vite.config.ts`.

## Việc Claude làm thay Codex (trong phạm vi đã duyệt)
Sandbox Codex bị `spawn EPERM`, không chạy được Prisma CLI. Claude chạy:
- `prisma migrate diff --from-schema-datamodel <schema HEAD> --to-schema-datamodel prisma/schema.prisma --script` → `server/prisma/migrations/20261015000000_google_login/migration.sql` (thêm `googleSub` VARCHAR(191) NULL unique, `passwordHash` thành NULL). Không chạy migration vào database.
- `prisma generate`. Lần đầu lỗi `EPERM` vì 5 tiến trình dev server Claude bật lúc 11:17 chưa tắt hẳn và giữ DLL engine; Claude dừng đúng 5 tiến trình đó (đã đối chiếu dòng lệnh), chạy lại thành công.
- Còn 3 file `node_modules/.prisma/client/query_engine-windows.dll.node.tmp*` từ các lần generate lỗi. Chưa xóa (cần Bảo xác nhận).

## Bằng chứng kiểm tra
- `npm run build` tại `D:\Website_3Q`: đạt.
- `npm test`: 4 file, 47/47 test đạt.
- Không có `a1radar` trong `server/`, `client/` (`git grep -il`).
- Không có log `credential`/`passwordHash`; controller không gọi Prisma; `userModel` không select `passwordHash`.
- API qua proxy Vite (`localhost:5173`), chưa có `GOOGLE_CLIENT_ID`/`SESSION_SECRET`: `/config` 503 `AUTH_NOT_CONFIGURED`; `/google` 503; `/me` 401 `UNAUTHENTICATED`.
- Trình duyệt `/dang-nhap`: không có header chung; wordmark "BaoQLuxury", "PORTAL ACCESS", "Đăng nhập", dòng phụ, thông báo "Đăng nhập Google chưa được cấu hình.", dòng điều khoản. Viewport 360px: `scrollWidth` 360, không tràn ngang.
- Đã tắt hẳn dev server sau kiểm tra (không còn tiến trình nghe cổng 4000/5173).

## Đối chiếu đặc tả
Đạt: cấu hình optional + 503; `/config`, `/google`, `/me`, `/logout`; danh sách email (rỗng = chặn); `email_verified`; liên kết user theo email giữ role, user mới CUSTOMER, chặn email đã gắn `sub` khác; cookie `sid` ký, httpOnly, Lax, `secure` khi production, 7 ngày, server tự kiểm tra tuổi phiên và user còn tồn tại; host Vite `localhost`; nút GIS chính thức; xử lý lỗi tải script.

## Phát hiện
Không có lỗi chặn nghiệm thu. Ghi chú nhỏ:
- `client/package.json`: script `preview` vẫn `--host 127.0.0.1`; Google sẽ từ chối origin này nếu dùng `vite preview`. Chỉ ảnh hưởng khi chạy preview.
- `Header.tsx`: nút "Đăng xuất" chưa có CSS riêng.

## Ngoài phạm vi task, cần Bảo biết
- Commit `519aaf4` (11:27, tác giả `AI-Agent`) đã revert commit SQLite; schema hiện là MySQL. Không do TASK-010.
- 86 file đang staged (toàn bộ `BossTele/`, `.agents/`, `tasks/`…), gồm `BossTele/vendor/claude-mem` và `vendor/ponytail` dạng repo lồng. Không do TASK-010; Claude không đổi trạng thái stage.

## Kết luận
verified cho code và kiểm thử cục bộ. Chưa kiểm chứng đăng nhập Google thật và migration trên MySQL.
