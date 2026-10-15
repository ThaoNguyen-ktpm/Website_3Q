# TASK-013 — Review chữ và logo trang đăng nhập

- Dự án: web.
- Người review: Claude (skill design-taste-frontend).
- Trạng thái: verified.
- Hành động gần nhất: lint + inspect của skill, xem ảnh chụp 1440/768/390, một vòng sửa, build/test.
- Bước tiếp theo: Bảo xem trực tiếp; quyết định có đưa `.taste-skill/` vào `.gitignore` không.

## Bằng chứng
- `npm run build` đạt; `npm test` 4 file, 55/55 đạt.
- `lint.mjs client/src/pages/LoginPage.tsx`: 0 FAIL, 0 WARN.
- `inspect.mjs http://localhost:5173/dang-nhap` sau vòng 1: tiêu đề "Đăng nhập" 1 dòng ở cả 3 cỡ (44/44/36px, Cormorant Garamond 500 đã tải thật); chữ đọc 16px/1.5; không tràn ngang.
- Ảnh chụp: logo liền vào thẻ (nền `#201502` trùng nền logo), thẻ góc vuông không viền/bóng, câu phụ một dòng, điều khoản 2 dòng, bản điện thoại gọn.

## Vòng sửa 1 (Codex)
Điều khoản 14px → 16px và rút gọn; câu phụ rút gọn thành một dòng; `--login-ink` `#f3eadc` → `#ece6de`; logo 240 → 260px; "BaoQLuxury" → "BaoQ Luxury".

## Kết quả inspect còn lại và lý do giữ
- FAIL `few-pictures` (cần ≥4 ảnh) và WARN `still-page` (cần ≥8 phần tử chuyển động): luật cho trang nhiều mục; trang đăng nhập là một màn hình, đã có video nền và 5 phần tử hiện dần (ngoại lệ "component" của skill).
- WARN `font-count` / `font-fallback` "Google Sans": do nút đăng nhập chính thức của Google tự khai báo, không thuộc code dự án.
- WARN `palette-cream` với `#ece6de`: là màu chữ trên nền nâu, độ bão hòa thấp; giữ.
- Ngoại lệ thương hiệu: dòng "BUY · SELL · CONSIGN" chữ hoa giãn cách nằm trong file logo.

## Ngoài phạm vi, ghi nhận
- `lint.mjs client/src/style.css`: 4 FAIL, 2 WARN ở CSS trang chủ cũ (viền header/footer, `.eyebrow`, gradient ảnh sản phẩm, `100vh`, hộp viền 1px). Không sửa trong task này.
- Skill tạo thư mục `.taste-skill/inspect/` (ảnh chụp, report) ở gốc dự án; chưa có trong `.gitignore`.

## Kết luận
verified.

## Sửa vòng 2: logo nền trong suốt, nằm trên thẻ (yêu cầu trực tiếp của Bảo)
- Claude tạo `client/public/brand/baoq-logo-transparent.png` từ `baoq-logo.png` bằng script Node (zlib): tách nền `#201502` thành trong suốt có tính alpha từng điểm ảnh (giữ viền mịn), cắt sát còn 816×600. File gốc giữ nguyên.
- Codex: logo ra khỏi thẻ, đặt ngay trên thẻ, rộng 300px (≤520px: 220px), cách thẻ 32px; bỏ `translateX` bù lệch và `--login-offset`.
- Lần chạy Codex đầu bị treo ở "Reading additional input from stdin" (không sửa file); Claude dừng đúng 2 tiến trình của lần chạy đó (PID 37004, 41244) và chạy lại với stdin đóng.
- `npm run build` đạt; `npm test` 55/55 đạt; inspect: tiêu đề 1 dòng ở 3 cỡ, chữ đọc 16px; FAIL/WARN còn lại giống vòng 1 (đã nêu lý do).
- Ảnh chụp 1440/390: logo trong suốt trên video, nằm giữa phía trên thẻ, không lệch.
- Kết luận: verified.

## Sửa vòng 3: hướng "Bỏ thẻ" (Bảo chọn)
- Codex: `.login-card` trong suốt, một cột tối đa 440px; lớp tối 55%; tiêu đề 48/38px; nút Google `outline`, `rectangular`, rộng tối đa 360px; điều khoản 14px "Bằng việc tiếp tục, bạn đồng ý với điều khoản của BaoQ Luxury.".
- `npm run build` đạt; `npm test` 55/55 đạt; inspect: tiêu đề 1 dòng ở 3 cỡ.
- Thay đổi ngoài task: lúc 16:03 một phiên khác thêm túi 3D (`BirkinBag3D`, `client/src/three/`, `client/src/assets/`, dependency `three`) và bố cục 2 cột `.login-layout` (trái: đăng nhập, phải: túi). Bảo xác nhận giữ nguyên, không đụng code túi. Vì vậy cột đăng nhập nằm bên trái trên desktop là theo bố cục đó, không phải lỗi.
- Còn tồn tại (chưa sửa, chờ Bảo): FAIL `body-size` vì điều khoản 14px theo lựa chọn của Bảo; trên điện thoại chữ "Luxury." rơi lẻ dòng. Chưa kiểm chứng túi 3D hiển thị đúng (khung canvas 688×680 có mặt, ảnh chụp inspect không thấy túi).
- Kết luận: verified cho phần đăng nhập; túi 3D ngoài phạm vi review.

## Sửa vòng 4: làm cột đăng nhập hài hòa (yêu cầu trực tiếp của Bảo)
- Codex: logo 300 → 200px (≤520px: 170px); tiêu đề 48 → 40px (≤520px: 34px); câu phụ chuyển sang Cormorant Garamond 500 cỡ 20px; màu chữ gom về dải đồng-ngà (`--login-heading` #dcc4a3, `--login-ink` #e9e1d6, `--login-muted` #a8957d); cột 360px; nút Google và điều khoản rộng 320px; điều khoản `text-wrap: balance`; khoảng cách 32/10/28/20px.
- Không sửa code túi 3D (`BirkinBag3D.tsx`, `client/src/three/` không có diff; các rule `.login-layout`, `.login-panel`, `.login-bag` giữ nguyên).
- `npm run build` đạt; `npm test` 55/55 đạt; inspect: tiêu đề 1 dòng ở 3 cỡ (40/40/34px).
- Ảnh chụp 1440/390: logo dẫn đầu, tiêu đề và câu phụ cùng họ chữ, nút thẳng hàng với cột chữ, điều khoản 2 dòng cân, hết chữ lẻ "Luxury.".
- Còn tồn tại: FAIL `body-size` (điều khoản 14px theo lựa chọn của Bảo); trong ảnh chụp inspect cột phải (túi 3D) vẫn trống, chưa kiểm chứng túi hiển thị.
- Kết luận: verified cho cột đăng nhập.
