# Website thương mại điện tử thử nghiệm

Dự án mẫu để làm quen Paperclip. Chỉ dùng dữ liệu thử; không kết nối KiotViet, Sapo, cổng thanh toán hoặc dịch vụ thật. Phương thức thanh toán trong schema chỉ là COD.

## Yêu cầu

- Node.js 20.19+ hoặc 22.12+ và npm.
- SQLite lưu ở `server/prisma/dev.db`. File này không được commit.

## Cài đặt

Mở terminal tại `D:\Website`:

```powershell
Copy-Item server\.env.example server\.env
# Đổi SEED_ADMIN_PASSWORD trong server\.env thành mật khẩu riêng dài ít nhất 12 ký tự.
npm install
npm run db:migrate
npm run db:seed
```

Nếu `server/.env` đã tồn tại từ bản MySQL, cập nhật `DATABASE_URL="file:./dev.db"` trong file đó trước khi chạy migration. Seed tạo 3 danh mục, 10 sản phẩm mẫu và tài khoản admin có mật khẩu hash bằng bcrypt. Chạy lại seed không tạo bản ghi trùng theo email hoặc slug.

## Chạy thử

Mở hai terminal tại `D:\Website`:

```powershell
npm run dev --workspace server
```

```powershell
npm run dev --workspace client
```

- Web: http://localhost:5173
- Kiểm tra API: http://localhost:4000/api/health
- Sản phẩm: http://localhost:4000/api/products
- Lọc theo danh mục: http://localhost:4000/api/products?category=tui-xach

Vite chuyển tiếp `/api` tới cổng 4000. Dự án không dùng cổng 3100. Dừng hai lệnh dev bằng Ctrl+C sau khi thử.

## Kiểm tra

```powershell
npm run build
npm test
```

## Cấu trúc

- `server/prisma/schema.prisma` và `migrations`: schema SQLite và migration. Giá tiền là số nguyên VND; migration kiểm tra giá và số lượng không âm.
- `server/prisma/seed.ts`: dữ liệu giả và tài khoản admin mẫu.
- `server/src/routes`: chỉ gắn URL với controller.
- `server/src/controllers`: validate query bằng zod, nhận request và trả response.
- `server/src/services`: chuyển dữ liệu từ model thành kết quả API.
- `server/src/models`: truy cập Prisma.
- `server/src/middlewares`: định dạng lỗi API thống nhất.
- `client/src/pages`, `components`, `api`, `hooks`: giao diện React và gọi API.

Đây là bộ khung và trang danh sách sản phẩm. API đăng nhập, giỏ hàng và đặt hàng chưa được triển khai.
