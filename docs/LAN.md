# Dùng web từ laptop khác qua wifi chung

Bảo 20/10/2026. Máy chạy `npm run dev` (máy chủ) mở cổng 5173 cho các máy cùng wifi (`vite --host`). MacBook hay laptop khác mở web bằng IP của máy chủ. Google không cho đăng nhập trên địa chỉ IP, nên người dùng vào bằng **link đăng nhập dùng một lần** do quản lý tạo.

## Máy chủ

1. Chạy `npm run dev` tại `D:\Website_3Q`.
2. Lần đầu, Windows hỏi có cho Node.js nhận kết nối không: chọn **Mạng riêng (Private)**, bấm **Allow**. Không chọn mạng công cộng.
3. Nên đặt IP cố định cho máy chủ trong router (DHCP reservation), để link luôn đúng địa chỉ. Ngày 20/10/2026 IP là `192.168.110.213`.

## Cho một người vào từ MacBook

1. Quản lý mở mục **Nhân viên** trên máy chủ, bấm **Link đăng nhập** ở dòng của người đó.
   - Link được chép sẵn và hiện ngay dưới nút, dạng `http://192.168.110.213:5173/dang-nhap?ma=…`.
2. Gửi link qua Zalo. Người đó mở link bằng Chrome hoặc Safari trên Mac (cùng wifi) là vào được.
3. Lần đăng nhập giữ được **7 ngày**. Hết 7 ngày thì quản lý tạo link mới.

Quy tắc của link:
- Chỉ dùng được **1 lần** và hết hạn sau **10 phút**.
- Khởi động lại `npm run dev` thì các link chưa dùng mất hiệu lực.
- Mỗi lần tạo link đều ghi vào mục **Nhật ký** (không ghi mã).
- Chỉ người có quyền "Quản lý nhân viên và vai trò" mới tạo được link.
- Link cho tài khoản Admin chỉ Admin tạo được. Tài khoản đang tạm ngưng thì không tạo được.

Mở web bằng IP mà không có link: trang đăng nhập báo cần mở link do quản lý gửi.

## Lưu ý an toàn

- Mọi máy cùng wifi đều mở được trang đăng nhập. Chỉ ai có link còn hạn mới vào được.
- Ai có link trong 10 phút đó thì vào được bằng tài khoản ghi trên link. Chỉ gửi link cho đúng người, không gửi vào nhóm chat.
- Không bật khi máy chủ dùng chung wifi với khách. Cho máy chủ dùng wifi nội bộ riêng.
- Muốn tắt truy cập từ máy khác:
  - Trong `client/package.json`, đổi `vite --host` thành `vite --host localhost`.
  - Trong `client/vite.config.ts`, đổi `host: true` thành `host: 'localhost'`.

## Cách cũ (không cần nữa)

`scripts/mac-forward.py` (MacBook) và `netsh interface portproxy` (Windows) chuyển `localhost:5173` sang máy chủ để dùng đăng nhập Google. Vẫn dùng được nếu muốn đăng nhập bằng Google trên máy khác.
