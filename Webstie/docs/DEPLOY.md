# Checklist HTTPS khi triển khai — TASK-021

Đây là hướng dẫn chuẩn bị, chưa triển khai thật. Chưa có tên miền/máy chủ; TASK-021 không cài phần mềm, đổi DNS hoặc khởi động dịch vụ. Mẫu giả định Caddy và API cùng máy Linux, mã nguồn tại `/srv/baoq`, Caddy là proxy duy nhất. Các lệnh trên máy chủ dưới đây chỉ chạy khi triển khai đã được cho phép và công cụ cần thiết đã có sẵn.

## Chuẩn bị máy chủ và dữ liệu

- [ ] Chọn tên miền thật; khi triển khai, trỏ DNS A/AAAA đúng máy chủ (chỉ giữ AAAA nếu IPv6 hoạt động). Cho phép HTTP 80 và HTTPS 443 tới Caddy, cùng kết nối ra ngoài để cấp/gia hạn chứng chỉ Let's Encrypt. Bảo toàn thư mục dữ liệu chứng chỉ của Caddy qua các lần cập nhật.
- [ ] Chặn truy cập từ Internet tới API 4000 và MySQL 3306 bằng firewall; chỉ cho Caddy cùng máy truy cập API. `server/src/server.ts` hiện gọi `app.listen(env.PORT)` mà không chỉ định host, nên không được giả định API chỉ lắng nghe loopback. Kiểm tra từ máy ngoài rằng hai cổng này không truy cập được.
- [ ] MySQL chỉ lắng nghe loopback hoặc mạng riêng được kiểm soát. Tạo user DB riêng cho ứng dụng, giới hạn host và quyền trên đúng database; không dùng root hoặc quyền quản trị toàn máy. Tách tài khoản migration/backup khi cần quyền cao hơn; user runtime chỉ có quyền dữ liệu cần thiết.
- [ ] Sao lưu trước migration/cập nhật; thử restore vào DB thử và đối chiếu dữ liệu theo [BACKUP.md](BACKUP.md). Script hiện tại là PowerShell/Windows với đường dẫn MySQL XAMPP, không phải lịch backup Linux đã sẵn sàng. Khi chuyển máy chủ, chuẩn bị và kiểm chứng công cụ/lịch tương ứng; giữ bản sao được bảo vệ trên nơi lưu khác.
- [ ] Chỉ dùng dữ liệu thử theo phạm vi dự án. Không kết nối KiotViet, Sapo, thanh toán hoặc dịch vụ thật khác; Google Sign-In là ngoại lệ đã được duyệt.

## Build và chạy API

- [ ] Cấu hình riêng `server/.env` trên máy chủ, hạn chế quyền đọc; không đưa bí mật vào Git, client hoặc log. Giữ `DATABASE_URL`, `GOOGLE_CLIENT_ID` và `SESSION_SECRET` riêng (secret ít nhất 32 ký tự). `GOOGLE_CLIENT_ID` phải thuộc OAuth Client sẽ cấu hình bên dưới. Không chép env/bí mật từ máy khác vào tài liệu.
- [ ] Đặt các biến sau cho **tiến trình API**, thay `<tên miền>` bằng hostname thật. `APP_ORIGIN` không có đường dẫn hoặc dấu `/` cuối:

```dotenv
NODE_ENV=production
PORT=4000
APP_ORIGIN=https://<tên miền>
TRUST_PROXY=1
```

`TRUST_PROXY=1` chỉ phù hợp mô hình một proxy Caddy được kiểm soát. Nếu thêm CDN/proxy, phải kiểm tra lại số hop và đường truy cập trước khi dùng; không tin header chuyển tiếp từ kết nối Internet trực tiếp.

- [ ] Tại Webstie/ trên máy build có dependencies (cài server bằng npm ci và frontend bằng npm ci --prefix frontend), chạy (shell Linux; trên Windows PowerShell dùng `npm.cmd` thay `npm`):

```sh
npm run build
npm test
```

Build gốc biên dịch server và frontend (gồm TypeScript và Vite). Đưa **toàn bộ** `frontend/dist` tới `/srv/baoq/frontend/dist`, cho user Caddy quyền đọc và duyệt thư mục; không phục vụ gốc repo hoặc `server/.env`. Đưa bản build server cùng dependencies runtime tới máy chủ. Khi cần migration, dùng tài khoản migration riêng và lệnh `npm run db:migrate` sau backup; không tự seed/xóa dữ liệu.

Mẫu Caddy chuyển `/sale-ai` và `/sale-ai/*` tới Express, giữ CSP và chính sách iframe cùng nguồn do Sale AI trả về. CSP/X-Frame-Options của giao diện không áp lên các đường dẫn này; cần kiểm tra iframe thật qua proxy khi nghiệm thu triển khai.

- [ ] Chạy API qua trình quản lý dịch vụ của máy chủ để tự khởi động lại, giữ thư mục làm việc `/srv/baoq/server` và env production. Lệnh tiến trình tương ứng từ gốc repo:

```sh
npm run start --workspace server
```

Không dùng Vite dev/preview để phục vụ production. Client gọi `/api` cùng origin qua Caddy. Khi `NODE_ENV=production`, cookie trở thành `__Host-sid`: Secure, HttpOnly, SameSite=Lax, Path=/, không Domain; cần HTTPS. Cookie `sid` cũ không còn được dùng, người dùng phải đăng nhập lại.

## Google OAuth và Caddy

- [ ] Trong Google Cloud Console → OAuth Client đang dùng → **Authorized JavaScript origins**, thêm chính xác `https://<tên miền>` (không đường dẫn). Kiểm tra tài khoản thử được phép trong cấu hình OAuth và là Staff đang hoạt động với quyền phù hợp. Không ghi OAuth token/cookie vào báo cáo.
- [ ] Sao chép [Caddyfile.example](../deploy/Caddyfile.example) thành cấu hình dịch vụ Caddy trên máy chủ. Đặt `APP_DOMAIN` cho **tiến trình Caddy**, chỉ là hostname, không có `https://`, port hay đường dẫn. Đây là biến khác `APP_ORIGIN` của API; biến shell tạm không tự truyền vào dịch vụ hệ thống.
- [ ] Kiểm tra cú pháp với hostname giả, không khởi động Caddy/cấp chứng chỉ. Ví dụ trong PowerShell tại `D:\Website_3Q`, khi `caddy` đã có:

```powershell
$env:APP_DOMAIN = 'shop.example.com'
caddy adapt --config .\deploy\Caddyfile.example --adapter caddyfile --pretty
Remove-Item Env:APP_DOMAIN
```

Nếu đã có `APP_DOMAIN` trước đó, dùng shell riêng cho ví dụ để không mất giá trị cũ. Trên máy chủ phải kiểm tra lại cấu hình thực với hostname thật trước khi nạp vào dịch vụ; `adapt` chỉ kiểm tra chuyển đổi cấu hình, không chứng minh DNS/TLS hoạt động.
- [ ] Khi đã được phép triển khai, nạp cấu hình đã kiểm tra vào dịch vụ Caddy. Mẫu chỉ định ACME Let's Encrypt, bật HTTPS tự động, nén zstd/gzip; `handle /api/*` giữ tiền tố `/api`, chuyển tới `127.0.0.1:4000`. Các đường khác dùng static/SPA fallback. `/assets/*` chỉ cache dài với phản hồi thành công; asset thiếu trả lỗi, không trả HTML có cache immutable. HTML gồm `/`, `/index.html` và SPA fallback có `Cache-Control: no-store`.
- [ ] CSP sao chép nguyên chuỗi production từ [SECURITY.md](SECURITY.md): không inline script hoặc WebSocket dev; inline style vẫn được phép. Mẫu đặt security headers khi gửi phản hồi, kể cả phản hồi API; kiểm tra không bị upstream/CDN ghi đè hoặc nhân đôi. HSTS có `includeSubDomains`: bảo đảm các subdomain cần dùng cũng hỗ trợ HTTPS trước khi bật.

## Kiểm tra sau triển khai (chưa thực hiện trong TASK-021)

Dùng tài khoản/dữ liệu thử được phép; ghi kết quả thực tế, thời điểm và URL, không ghi bí mật.

- [ ] Kiểm tra HTTPS/chứng chỉ hợp lệ, HTTP chuyển sang HTTPS. Chạy trên shell máy kiểm tra (`curl.exe` nếu dùng Windows PowerShell), thay hostname và asset bằng giá trị thật:

```sh
curl -I http://shop.example.com/
curl -I https://shop.example.com/
curl -I https://shop.example.com/index.html
curl -I https://shop.example.com/dang-nhap
curl -I https://shop.example.com/assets/<file-co-hash-tu-dist>
curl -I https://shop.example.com/assets/khong-ton-tai.js
curl -I https://shop.example.com/api/health
```

HTML phải có `no-store`, asset thật có `public, max-age=31536000, immutable`, asset thiếu trả 404 không có immutable. API health phải trả phản hồi API, không phải HTML. Đối chiếu CSP, HSTS `max-age=15552000; includeSubDomains`, nosniff, DENY, Referrer-Policy `strict-origin-when-cross-origin`, Permissions-Policy và không có `Server` trên HTTPS, kể cả API.
- [ ] Chạy đánh giá tên miền đã công khai trên [Security Headers](https://securityheaders.com/), đối chiếu header thực tế; điểm đánh giá không thay thế thử luồng ứng dụng.
- [ ] Trong trình duyệt: tải trực tiếp rồi refresh trang SPA, kiểm tra Console không có lỗi CSP; font, ảnh, video và Google Sign-In hoạt động. Đăng nhập Google thật bằng tài khoản thử được phép, kiểm tra DevTools có `__Host-sid` với các thuộc tính trên, gọi API sau đăng nhập, đăng xuất và đăng nhập lại. Không coi unit test là bằng chứng OAuth thật hoạt động.
- [ ] Kiểm tra CSRF không cần đăng nhập: lệnh sau phải trả 403 với mã `BAD_ORIGIN`, không phải lỗi proxy/HTML:

```sh
curl -i -X POST https://shop.example.com/api/auth/logout -H 'Origin: https://invalid.example'
```

- [ ] Trong cửa sổ kiểm thử được phép, gửi 11 POST `/api/auth/google` với `Origin: https://<tên miền>`, `Content-Type: application/json`, body `{}` trong một phút từ cùng IP. Khi bộ đếm ban đầu trống, 10 lần đầu dự kiến 400 do thiếu credential, lần 11 phải 429 `RATE_LIMITED` (không gửi token Google). API chung giới hạn 300/phút/IP; chờ hết cửa sổ ít nhất 60 giây trước khi thử đăng nhập lại. Kiểm tra hai IP thử độc lập không dùng chung bộ đếm do sai proxy. Limiter hiện ở bộ nhớ từng tiến trình; nhiều tiến trình cần kho đếm chung trước khi mở rộng.

Tham chiếu cú pháp chính thức: [handle và giữ đường dẫn](https://caddyserver.com/docs/caddyfile/directives/handle), [header và deferred operations](https://caddyserver.com/docs/caddyfile/directives/header), [TLS/ACME issuer](https://caddyserver.com/docs/caddyfile/directives/tls). Kết quả cục bộ và giới hạn xác minh được ghi trong [TASK-021-result.md](../tasks/TASK-021-result.md).
