# TASK-011 — Review bắt đăng nhập trước khi vào web

- Dự án: web.
- Người review: Claude.
- Trạng thái: verified cho code và luồng chưa đăng nhập; luồng sau khi đăng nhập Google thật: chờ Bảo thử.
- Hành động gần nhất: đọc thay đổi, chạy build/test, thử API và chuyển hướng trên trình duyệt (dùng server Bảo đang chạy, không bật server mới).
- Bước tiếp theo: Bảo đăng nhập bằng Google, xác nhận vào được trang chủ, xem được sản phẩm, đăng xuất về `/dang-nhap`.

## Phạm vi đã xem
`server/src/middlewares/requireAuth.ts`, `app.ts`, `tests/products.test.ts`; `client/src/components/RequireAuth.tsx`, `App.tsx`, `pages/LoginPage.tsx`, `pages/HomePage.tsx`, `components/Header.tsx`, `hooks/useAuth.ts`, `hooks/useProducts.ts`, `api/products.ts`.

## Bằng chứng
- `npm run build`: đạt. `npm test`: 4 file, 55/55 đạt.
- Qua proxy Vite: `/api/products` không cookie → 401 `UNAUTHENTICATED`; `/api/health` 200; `/api/auth/config` 200.
- Trình duyệt: mở `/` → chuyển `/dang-nhap`; nút Google chính thức hiển thị (Client ID của Bảo đã nhận).
- Đối chiếu đặc tả: middleware dùng `readSession`, không gọi Prisma; guard bọc mọi route trừ `/dang-nhap`, hiện trạng thái khi đang tải; `from` chỉ nhận đường dẫn nội bộ (chặn `//`, `\`, vòng lặp `/dang-nhap`); đăng xuất về `/dang-nhap`; 401 từ API sản phẩm xóa user để guard chuyển trang.

## Phát hiện
Không có lỗi chặn nghiệm thu.

## Giới hạn
Chưa thử đăng nhập Google thật (cần tài khoản Google của Bảo) nên chưa kiểm chứng: vào trang chủ sau đăng nhập, tải sản phẩm có cookie, đăng xuất trên trình duyệt. Migration `googleSub` trên MySQL chưa được xác nhận đã chạy.

## Kết luận
verified (phần đã kiểm chứng ở trên).
