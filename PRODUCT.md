# PRODUCT — BaoQ Luxury (Website_3Q)

## Platform
web

## Stack
React 19 + Vite 6 (`Webstie/frontend/`), Express + Prisma MySQL (`Webstie/server/`), npm workspaces. BossTele (`BossTele/`) là công cụ nội bộ riêng (Node, Telegram), không phải giao diện web.

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
- TASK-110: chỉ giữ giao diện 8787; bỏ giao diện cũ và mô hình túi 3D.

## Brand Commitments
- Tên: BaoQ Luxury. Khẩu hiệu: BUY · SELL · CONSIGN.
- Logo: monogram "bq" trong khung oval vòm, chữ "BAOQ LUXURY" có chân, màu đồng (#ae8d6c) — file `Webstie/frontend/public/brand/baoq-logo-original.jpg` và `baoq-wordmark.png`.
- Giọng: sang, tiết chế, tin cậy. Ngắn gọn, lịch sự, không phô trương. (Bảo xác nhận 2026-10-15.)

## Evidence on Hand
Logo thương hiệu trong `Webstie/frontend/public/brand/`. Chưa có ảnh sản phẩm thật, đánh giá hay số liệu kinh doanh dùng được trên web.

## Product Principles

Tài liệu nội bộ (TASK-027): trong admin, mở **Tài liệu** để hỏi đáp PDF đã tải lên. Admin có quyền tải lên/xóa; Quản lý mặc định chỉ xem và hỏi. PDF phải có chữ (không OCR), tối đa 20 MB. PDF, chỉ mục và embedding được lưu ở `server/data/`; lần đầu cần mạng để tải `Xenova/multilingual-e5-small` vào cache máy. Bảo tự điền `ANTHROPIC_API_KEY` trong `server/.env` để bật trả lời bằng Claude. Câu hỏi và tối đa 6 đoạn tài liệu liên quan được gửi tới Anthropic; giao diện hiển thị nguồn tên/trang để đối chiếu, không lưu lịch sử hỏi đáp. Chỉ chạy một tiến trình server dùng kho JSON này.

- Bảo là người quyết định cuối; không tự đặt chính sách khi còn mơ hồ.
- Không ghi bí mật, token, mật khẩu vào code hay tài liệu.

## Accessibility & Inclusion
Ngôn ngữ giao diện: tiếng Việt (cần font hỗ trợ dấu tiếng Việt). Giữ focus nhìn thấy được, tôn trọng `prefers-reduced-motion`.
