# Bảo vệ HTTP (TASK-018)

API dùng Helmet, giới hạn 300 request/phút/IP trên `/api`, 10 request/phút/IP trên `/api/auth/google`. Bộ đếm nằm trong bộ nhớ từng tiến trình; khi chạy nhiều tiến trình cần dùng kho bộ đếm chung. Test thông thường bỏ qua limiter; test riêng bật bằng `createLimiter(limit, true)`.

`APP_ORIGIN` mặc định `http://localhost:5173`, phải là origin HTTP(S) không có đường dẫn hoặc dấu `/` cuối. CORS và kiểm tra Origin dùng chung giá trị này. POST/PUT/PATCH/DELETE yêu cầu Origin khớp chính xác, hoặc khi thiếu Origin thì Referer phải bắt đầu bằng `APP_ORIGIN + '/'`.

Chỉ đặt `TRUST_PROXY` bằng số hop của proxy triển khai đã kiểm soát. Không đặt thì Express không tin header chuyển tiếp. Production dùng cookie `__Host-sid`, Secure, HttpOnly, SameSite=Lax, Path=/, không Domain; môi trường khác dùng `sid`. Cookie `sid` cũ không được dùng khi chuyển sang production; người dùng cần đăng nhập lại.

## CSP production để áp ở Caddy (TASK-021)

```text
default-src 'self'; script-src 'self' https://accounts.google.com/gsi/client; style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://*.googleusercontent.com; media-src 'self'; connect-src 'self' https://accounts.google.com/gsi/; frame-src https://accounts.google.com/gsi/; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

Vite preview dùng CSP trên. Vite dev bổ sung `ws://localhost:5173` cho HMR và `'unsafe-inline'` vào script-src cho preamble của React Refresh. Production không cho inline script hoặc WebSocket dev; inline style vẫn được phép cho giao diện hiện có và Google Sign-In.

HTML dev/preview có nosniff, Referrer-Policy strict-origin-when-cross-origin và X-Frame-Options DENY. HSTS API chỉ bật khi NODE_ENV=production (15552000 giây, includeSubDomains). HTTPS/Caddy thực tế và đăng nhập Google thật cần được kiểm tra khi triển khai, chưa được xác minh bởi test cục bộ.
