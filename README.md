# Website thử nghiệm

Khung dự án thương mại điện tử để làm quen Paperclip. Hiện chỉ có trang chủ và API kiểm tra trạng thái. Không dùng dữ liệu thật, không kết nối KiotViet/Sapo hay cổng thanh toán.

## Yêu cầu

- Node.js 20.19+ hoặc 22.12+ và npm.
- Git.

## Cài đặt

Mở terminal tại `D:\Website`:

```powershell
npm install
Copy-Item server\.env.example server\.env
npm run db:push
```

`npm install` tạo Prisma Client. `db:push` tạo SQLite `server/prisma/dev.db` theo `DATABASE_URL` trong `server/.env`. File `.env` và database được bỏ qua bởi Git.

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
- `server/prisma/schema.prisma`: schema SQLite. Giá sản phẩm là số nguyên VND (`priceVnd`).
- `client/src/pages`, `components`, `api`, `hooks`: giao diện và gọi API.

Task này chưa triển khai tài khoản, sản phẩm, giỏ hàng hoặc thanh toán. Khi bổ sung tài khoản, mật khẩu cần được hash bằng bcrypt và secret đặt trong `.env`; thanh toán chỉ dùng COD giả lập.
