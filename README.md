# Website thử nghiệm

Khung dự án thương mại điện tử để làm quen Paperclip. Hiện chỉ có trang chủ và API kiểm tra trạng thái. Không dùng dữ liệu thật, không kết nối KiotViet/Sapo hay cổng thanh toán.

## Yêu cầu

- Node.js 20.19+ hoặc 22.12+ và npm.
- Git.

## Cài đặt

Cần có MySQL đang chạy và database `shop_test`. Tạo database bằng tài khoản MySQL có quyền phù hợp:

```sql
CREATE DATABASE shop_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Mở terminal tại `D:\Website`:

```powershell
Copy-Item server\.env.example server\.env
# Sửa DATABASE_URL trong server\.env theo tài khoản MySQL của bạn.
npm install
npm run db:push
```

`DATABASE_URL` có dạng `mysql://USER:PASSWORD@localhost:3306/shop_test`. Đổi `USER` và `PASSWORD` thành thông tin kết nối MySQL của bạn; mã hóa URL nếu mật khẩu chứa ký tự đặc biệt. `npm install` tạo Prisma Client. `db:push` đồng bộ schema vào database `shop_test`; lệnh này cần MySQL hoạt động. File `.env` được Git bỏ qua. Nếu đã có `server/.env` từ bản SQLite, hãy sửa `DATABASE_URL` trước khi chạy `db:push`.

## Chạy thử

Mở hai terminal tại `D:\Website`:

```powershell
npm run dev --workspace server
```

```powershell
npm run dev --workspace client
```

- Web: http://localhost:5173
- API: http://localhost:4000/api/health → `{"status":"ok"}`

Vite chuyển tiếp `/api` sang cổng 4000 khi chạy ở chế độ dev. Không dùng cổng 3100.

## Kiểm tra

```powershell
npm run build
npm test
```

## Cấu trúc

- `server/src/routes`: khai báo đường dẫn.
- `server/src/controllers`: xử lý request/response.
- `server/src/services`: nơi đặt nghiệp vụ khi có chức năng mua hàng.
- `server/src/models`: truy cập Prisma.
- `server/src/middlewares`: xử lý lỗi và các middleware tiếp theo.
- `server/prisma/schema.prisma`: schema MySQL. Giá sản phẩm là số nguyên VND (`priceVnd`).
- `client/src/pages`, `components`, `api`, `hooks`: giao diện và gọi API.

Task này chưa triển khai tài khoản, sản phẩm, giỏ hàng hoặc thanh toán. Khi bổ sung tài khoản, mật khẩu cần được hash bằng bcrypt và secret đặt trong `.env`; thanh toán chỉ dùng COD giả lập.
