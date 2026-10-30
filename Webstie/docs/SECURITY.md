# Bảo vệ HTTP (TASK-018)

API dùng Helmet, giới hạn 300 request/phút/IP trên `/api`, 10 request/phút/IP trên `/api/auth/google`. Bộ đếm nằm trong bộ nhớ từng tiến trình; khi chạy nhiều tiến trình cần dùng kho bộ đếm chung. Test thông thường bỏ qua limiter; test riêng bật bằng `createLimiter(limit, true)`.

`APP_ORIGIN` mặc định `http://localhost:8787`, phải là origin HTTP(S) không có đường dẫn hoặc dấu `/` cuối. CORS dùng địa chỉ chính. Kiểm tra cùng nguồn cho API chấp nhận `APP_ORIGIN`, `EXTRA_ORIGINS`, hoặc IP LAN riêng có cùng scheme/cổng với một địa chỉ đã cấu hình (`config/origins.ts`); khi thiếu Origin thì kiểm tra origin của Referer. Frontend gọi API qua proxy cùng nguồn nên LAN không cần gọi chéo nguồn trực tiếp sang cổng 4000.

Chỉ đặt `TRUST_PROXY` bằng số hop của proxy triển khai đã kiểm soát. Không đặt thì Express không tin header chuyển tiếp. Production dùng cookie `__Host-sid`, Secure, HttpOnly, SameSite=Lax, Path=/, không Domain; môi trường khác dùng `sid`. Cookie `sid` cũ không được dùng khi chuyển sang production; người dùng cần đăng nhập lại.

## CSP production để áp ở Caddy (TASK-021)

```text
default-src 'self'; script-src 'self' https://accounts.google.com/gsi/client; style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://*.googleusercontent.com https://cdn2-retail-images.kiotviet.vn https://cdn1-retail-images.kiotviet.vn https://cdn-images.kiotviet.vn https://bizweb.dktcdn.net; media-src 'self'; connect-src 'self' https://accounts.google.com/gsi/; frame-src 'self' https://accounts.google.com/gsi/; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

Vite preview dùng CSP của `frontend/vite.config.ts`, gồm ảnh sản phẩm từ KiotViet/Sapo và iframe cùng nguồn cho Sale AI. Vite dev bổ sung `ws:` cho HMR khi mở bằng localhost hoặc IP LAN. Frontend không dùng plugin React Refresh nên script không cần `'unsafe-inline'`. Production không cho inline script hoặc WebSocket dev; inline style vẫn được phép cho giao diện hiện có và Google Sign-In.

HTML dev/preview có nosniff, Referrer-Policy strict-origin-when-cross-origin và X-Frame-Options DENY. HSTS API chỉ bật khi NODE_ENV=production (15552000 giây, includeSubDomains). HTTPS/Caddy thực tế và đăng nhập Google thật cần được kiểm tra khi triển khai, chưa được xác minh bởi test cục bộ.
