# TASK-018 — Kết quả triển khai

- Dự án: web. Người phụ trách: Codex (triển khai), Claude (review độc lập).
- Trạng thái: ready_for_review.
- Hành động gần nhất: hoàn tất triển khai; 143/143 test qua với cấu hình runner riêng, TypeScript và kiểm tra CSP tĩnh qua.
- Bước tiếp theo: Claude review độc lập; chạy lại build/test mặc định và kiểm tra giao diện dưới CSP trong môi trường cho phép tạo tiến trình con.
- Giới hạn: không cài gói, không sửa server/.env, không commit, không xóa file, không sửa túi 3D hoặc rule .login-*.
- Workspace có nhiều thay đổi từ trước, bao gồm các file migration đã bị xóa trước khi bắt đầu; bảo toàn các thay đổi này.

## Thay đổi

- `server/src/config/env.ts`, `server/.env.example`: APP_ORIGIN mặc định localhost:5173, kiểm tra origin HTTP(S) không đường dẫn; TRUST_PROXY tùy chọn, số hop nguyên không âm. CORS và kiểm tra Origin dùng cùng APP_ORIGIN.
- `server/src/app.ts`: tắt x-powered-by; Helmet CSP API chỉ default-src/frame-ancestors none, CORP same-origin, referrer no-referrer, HSTS chỉ production (15552000 giây, includeSubDomains); trust proxy khi được cấu hình.
- `server/src/middlewares/rateLimit.ts`: 300/phút/IP trên toàn API, 10/phút/IP trên đường dẫn auth/google, trả 429 với body tiếng Việt đúng đặc tả; header RateLimit-* draft-6, tắt header legacy; bỏ qua môi trường test trừ khi tạo limiter với enforceInTest=true.
- `server/src/middlewares/requireSameOrigin.ts`: kiểm tra tất cả POST/PUT/PATCH/DELETE dưới /api trước xử lý JSON/route, dùng Referer chỉ khi thiếu Origin, trả lỗi BAD_ORIGIN theo envelope error chuẩn của API.
- `server/src/config/sessionCookie.ts`, `server/src/controllers/authController.ts`, `server/src/middlewares/requireAuth.ts`: dùng cùng tên/options để đặt, đọc và xóa cookie; production __Host-sid Secure/Path=/, không Domain; môi trường khác sid.
- `client/vite.config.ts`: headers HTML cho dev và preview, CSP theo đặc tả. Chỉ dev cho inline script React Refresh và WebSocket localhost:5173; preview dùng CSP production không có hai ngoại lệ này.
- `docs/SECURITY.md`: chuỗi CSP production cho TASK-021, cấu hình Origin/proxy/cookie và giới hạn bộ đếm trong bộ nhớ từng tiến trình.
- Test sửa/thêm: `server/src/tests/auth.test.ts`, `staff.test.ts`, `authConfig.test.ts`, `security.test.ts`; Origin hợp lệ cho test ghi cũ, kiểm tra headers/HSTS, CSRF, cookie production đọc qua cả /me và requireAuth, từ chối cookie sid cũ, cấu hình Origin/proxy, auth 11 request và API 301 request.
- `tasks/TASK-018-vitest.config.ts`: runner riêng cho Windows bị hạn chế tạo tiến trình con; threads, native config loader, TypeScript đã cài sẵn để chuyển TS thay esbuild, preserveSymlinks; giữ NODE_ENV runtime cho test chuyển môi trường. Không đổi script/config chạy mặc định của dự án.
- `tasks/TASK-018-csp-selfcheck.mjs`: kiểm tra cấu hình CSP dev/preview, các header HTML và đối chiếu chính xác CSP production với tài liệu. Đây là kiểm tra tĩnh, không phải kiểm tra trình duyệt.

## Bằng chứng cục bộ (2026-10-16)

Các lệnh chạy tại `D:\Website_3Q`, trong PowerShell:

1. `npm.cmd run build`: server tsc và client tsc qua; Vite dừng với `spawn EPERM` khi khởi tạo esbuild. Chưa thể kết luận build production hoàn tất.
2. `npm.cmd test`: không chạy được test do `spawn EPERM` khi Vitest tạo forks worker. Đây là lỗi môi trường, không ghi nhận test mặc định đã đạt.
3. `node node_modules/vitest/vitest.mjs run --config tasks/TASK-018-vitest.config.ts --configLoader native`: **7 file, 143/143 test qua**, exit 0. Có cảnh báo MODULE_TYPELESS_PACKAGE_JSON do config TS nằm ngoài workspace type=module; không sửa package.json chỉ để bỏ cảnh báo.
4. `node tasks/TASK-018-csp-selfcheck.mjs`: PASS, exit 0.
5. `node node_modules/typescript/bin/tsc -p server/tsconfig.json --noEmit`: qua, exit 0.
6. `node node_modules/typescript/bin/tsc -b client/tsconfig.json`: qua, exit 0.
7. `git diff --check`: qua, exit 0; chỉ cảnh báo chuẩn hóa LF/CRLF.

Đã thử Vitest threads trực tiếp và Vite `--configLoader native`: vẫn EPERM ở bước Windows realpath gọi `net use`/esbuild; runner riêng ở mục 3 mới chạy thành công. Không cài hoặc sửa gói để xử lý hạn chế này.

## Chưa xác minh và rủi ro còn lại

- Chưa kiểm tra bằng trình duyệt: nút Google, font admin, video, túi 3D và HMR dưới CSP. Chuỗi CSP và build TypeScript đã kiểm tra; không coi chúng là bằng chứng giao diện chạy bình thường.
- Chưa xác minh Google Sign-In thật, cookie trên HTTPS/proxy thật, HSTS trên triển khai thật hoặc Caddy (TASK-021).
- Limiter dùng bộ nhớ riêng từng tiến trình; chạy nhiều tiến trình cần kho bộ đếm chung và cấu hình proxy đúng số hop.
- Không sửa server/.env, không cài gói, không commit, không xóa file, không sửa code túi 3D/rule .login-*. Các thay đổi các phần đó đang có trong git status là từ trước nhiệm vụ.
- Code hoàn tất, **chưa được Claude kiểm tra độc lập**; không đặt verified.
