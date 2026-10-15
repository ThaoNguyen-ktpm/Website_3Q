# PRODUCT — BaoQ Luxury (Website_3Q)

## Platform
web

## Stack
React 19 + Vite 7 (`client/`), Express + Prisma MySQL (`server/`), npm workspaces. BossTele (`BossTele/`) là công cụ nội bộ riêng (Node, Telegram), không phải giao diện web.

## Users
Nội bộ BaoQ Luxury: Bảo và nhân viên được cấp quyền. Không dành cho khách hàng công khai. (Bảo xác nhận 2026-10-15.)

## Product Purpose
Công cụ web nội bộ của BaoQ Luxury, doanh nghiệp mua, bán và ký gửi hàng hiệu (túi, ví, phụ kiện, đồng hồ). Hiện có: đăng nhập Google theo danh sách email cho phép, trang danh sách sản phẩm mẫu.

## Positioning
Chưa xác định. (Không suy diễn.)

## Operating Context
Dùng trên máy tính và điện thoại của nhân viên. Truy cập chỉ sau khi đăng nhập; chưa đăng nhập thì mọi trang chuyển về `/dang-nhap`.

## Capabilities and Constraints
- Đăng nhập chỉ bằng Google; chỉ email trong `GOOGLE_ALLOWED_EMAILS` vào được; phiên bằng cookie httpOnly 7 ngày.
- API dữ liệu yêu cầu phiên đăng nhập.
- Quy trình: Claude viết đặc tả và review, Codex code; thay đổi cấp 2 cần Bảo trả lời "OK" (xem `CLAUDE.md`, `AGENTS.md`).
- Trang đăng nhập có mô hình 3D túi (`BirkinBag3D`) do phiên khác thêm; Bảo yêu cầu giữ nguyên, không sửa code túi.

## Brand Commitments
- Tên: BaoQ Luxury. Khẩu hiệu: BUY · SELL · CONSIGN.
- Logo: monogram "bq" trong khung oval vòm, chữ "BAOQ LUXURY" có chân, màu đồng (#ae8d6c) — file `client/public/brand/baoq-logo.png` (nền #201502) và `baoq-logo-transparent.png`.
- Giọng: sang, tiết chế, tin cậy. Ngắn gọn, lịch sự, không phô trương. (Bảo xác nhận 2026-10-15.)

## Evidence on Hand
Logo thương hiệu; video nền đăng nhập `client/public/login-background.mp4`. Chưa có ảnh sản phẩm thật, đánh giá hay số liệu kinh doanh dùng được trên web.

## Product Principles
- Bảo là người quyết định cuối; không tự đặt chính sách khi còn mơ hồ.
- Không ghi bí mật, token, mật khẩu vào code hay tài liệu.

## Accessibility & Inclusion
Ngôn ngữ giao diện: tiếng Việt (cần font hỗ trợ dấu tiếng Việt). Giữ focus nhìn thấy được, tôn trọng `prefers-reduced-motion`.
