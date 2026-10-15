---
name: BaoQ Luxury
description: Công cụ nội bộ mua · bán · ký gửi hàng hiệu — tối, đồng, tiết chế
colors:
  ground: "#120c03"
  brand-brown: "#201502"
  bronze: "#ae8d6c"
  heading: "#e8d3b4"
  ink: "#e9e1d6"
  muted: "#a8957d"
  error: "#ffb4a6"
  scrim: "rgba(0,0,0,.55)"
typography:
  display:
    fontFamily: "Cormorant Garamond, serif"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.01em"
  lede:
    fontFamily: "Cormorant Garamond, serif"
    fontSize: "20px"
    fontWeight: 500
    lineHeight: 1.4
  note:
    fontFamily: "Cormorant Garamond, serif"
    fontSize: "17px"
    fontWeight: 500
    lineHeight: 1.45
rounded:
  none: "0px"
spacing:
  xs: "10px"
  sm: "20px"
  md: "28px"
  lg: "32px"
components:
  login-column:
    width: "360px"
  login-logo:
    width: "200px"
  google-button:
    width: "320px"
    rounded: "{rounded.none}"
---

# DESIGN — BaoQ Luxury

## Overview
Trích từ trang đăng nhập hiện tại (`client/src/pages/LoginPage.tsx`, rule `.login-*` trong `client/src/style.css`), 2026-10-15. Video nền tối toàn màn hình với lớp tối 55%; một cột căn giữa: logo đồng, tiêu đề serif, câu phụ serif, nút Google, dòng điều khoản. Trên desktop, cột đăng nhập nằm bên trái trong bố cục 2 cột, cột phải là mô hình 3D túi (`.login-layout`, `.login-bag` — không sửa). CSS trang chủ cũ (`.site-header`, `.product-*`, nền #f7f8f4) là di sản chưa thiết kế lại.

## Colors
Dải đồng-ngà ăn theo logo trên nền gần đen. `bronze` là màu logo và viền focus; `heading` cho tiêu đề; `ink` cho chữ đọc; `muted` cho ghi chú. Nền phẳng `ground` khi video không chạy. Không gradient.

## Typography
Cormorant Garamond (tự chứa qua `@fontsource/cormorant-garamond`, có tiếng Việt): tiêu đề 700 cỡ 40px (≤520px: 34px), một dòng; câu phụ 500 cỡ 20px; điều khoản 500 cỡ 17px. Font hệ thống chỉ còn trong nút Google và thông báo trạng thái. (Bảo chọn trong live mode 2026-10-15.)

## Layout
Cột tối đa 360px; logo 200px (≤520px: 170px); khoảng cách logo→tiêu đề 32px, tiêu đề→câu phụ 10px, câu phụ→nút 28px, nút→điều khoản 20px. Điều khoản `text-wrap: balance`.

## Elevation & Depth
Không glow, không blur, không bóng trên khối. Ngoại lệ do Bảo chọn (2026-10-15): tiêu đề đăng nhập có bóng chữ hai lớp `0 1px 0 rgba(0,0,0,.35), 0 6px 18px rgba(0,0,0,.6)` để nổi trên video.

## Shapes
Góc vuông (nút Google `shape: rectangular`).

## Components
- Nút Google: nút chính thức Google Identity Services, `theme: outline`, `size: large`, `text: continue_with`, `locale: vi`, rộng tối đa 320px.
- Chuyển động vào: logo → tiêu đề → câu phụ → nút → điều khoản, mỗi phần trễ 80ms, 600ms, opacity + translateY 16px; tắt khi `prefers-reduced-motion`.

## Do's and Don'ts
- Do: giữ logo thương hiệu nguyên bản (gồm dòng BUY · SELL · CONSIGN).
- Do: dùng đúng các token màu trên.
- Don't: thêm viền 1px, bóng (ngoài bóng chữ tiêu đề), gradient, nhãn chữ hoa nhỏ phía trên tiêu đề.
- Don't: sửa code túi 3D.
