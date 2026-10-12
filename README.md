# Website thử nghiệm

Khung dự án thương mại điện tử để làm quen Paperclip. Dữ liệu chỉ dùng để thử nghiệm; không kết nối KiotViet, Sapo hoặc cổng thanh toán thật. Thanh toán được thiết kế cho COD giả lập.

## Yêu cầu

- Node.js 20.19+ hoặc 22.12+ và npm.
- MySQL với database `shop_test`.

## Cài đặt database

Tạo database MySQL bằng tài khoản có quyền phù hợp:

```sql
CREATE DATABASE shop_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Mở terminal tại `D:\Website`:

```powershell
Copy-Item server\.env.example server\.env
# Sửa DATABASE_URL và SEED_ADMIN_PASSWORD trong server\.env.
npm install
npm run db:migrate
npm run db:seed
```

`DATABASE_URL` có dạng `mysql://USER:PASSWORD@localhost:3306/shop_test`. Mã hóa URL nếu mật khẩu MySQL có ký tự đặc biệt. `SEED_ADMIN_PASSWORD` phải là mật khẩu riêng dài ít nhất 12 ký tự; không dùng giá trị `CHANGE_ME` trong file ví dụ. Có thể sửa `SEED_ADMIN_EMAIL` nếu muốn đổi email admin mẫu. File `.env` được Git bỏ qua.

Migration tạo các bảng `User`, `Category`, `Product`, `Cart`, `CartItem`, `Order`, `OrderItem`. Seed tạo 3 danh mục (Túi xách, Đồng hồ, Phụ kiện), 10 sản phẩm mẫu và 1 tài khoản admin có mật khẩu hash bằng bcrypt. Chạy lại seed sẽ cập nhật các bản ghi mẫu theo `slug` hoặc email, không tạo bản sao. Ảnh sản phẩm có trường `imageUrl` nhưng các bản ghi mẫu để trống vì chưa có tài nguyên ảnh trong dự án.

Nếu database cũ đã được tạo bằng `db:push`, hãy dùng database `shop_test` mới, rỗng cho migration đầu tiên. `db:push` chỉ phù hợp khi thử schema tạm thời; quy trình này dùng `db:migrate` để ghi nhận lịch sử migration.

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

Vite chuyển tiếp `/api` sang cổng 4000 trong chế độ dev. Không dùng cổng 3100.

## Kiểm tra

```powershell
npm run build
npm test
```

## Cấu trúc

- `server/prisma/schema.prisma`: mô hình dữ liệu MySQL; mọi giá tiền là số nguyên VND.
- `server/prisma/migrations`: migration SQL.
- `server/prisma/seed.ts`: dữ liệu mẫu và tài khoản admin.
- `server/src/routes`: khai báo đường dẫn.
- `server/src/controllers`: xử lý request và response.
- `server/src/services`: nghiệp vụ mua hàng khi được triển khai.
- `server/src/models`: truy cập Prisma.
- `server/src/middlewares`: xử lý lỗi và middleware.
- `client/src/pages`, `components`, `api`, `hooks`: giao diện và gọi API.

Dự án hiện chưa triển khai API tài khoản, sản phẩm, giỏ hàng hoặc đặt hàng. Schema đã sẵn sàng cho các bước đó.
