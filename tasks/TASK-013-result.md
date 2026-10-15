# TASK-013 — Kết quả chữ và logo trang đăng nhập

- Dự án: web (`client/`).
- Người phụ trách: Codex (triển khai); Claude (review độc lập).
- Trạng thái: `ready_for_review`.
- Hành động gần nhất: Sửa vòng 4 theo yêu cầu trực tiếp của Bảo ngày 2026-10-15, làm cột đăng nhập hài hòa.
- Bước tiếp theo: Claude review độc lập vòng 4 và kiểm tra giao diện trên trình duyệt.

## Thay đổi

- `client/src/pages/LoginPage.tsx`: import font có sẵn `@fontsource/cormorant-garamond/500.css`; bỏ link chữ và nhãn PORTAL ACCESS; thêm logo đúng đường dẫn, alt, kích thước gốc; thay câu phụ đúng spec; bổ sung `shape: 'rectangular'` cho kiểu và tùy chọn nút Google chính thức. Giữ nguyên logic xác thực, điều hướng, xử lý lỗi/tải và video.
- `client/src/style.css`: chỉ sửa khối CSS đăng nhập; thêm đủ 7 token màu, nền phẳng, thẻ vuông rộng tối đa 440px, padding và kích thước responsive đúng spec. Logo 240/200px, bù tâm 1,55%; tiêu đề Cormorant Garamond 500 cỡ 44/36px; câu phụ 16px; điều khoản 14px; focus 2px màu accent. Giữ lớp tối và video scale 1.28.
- Chuyển động CSS cho 5 thành phần: 600ms, cubic-bezier(.2,.7,.2,1), opacity và translateY 16px về 0, trễ 0/80/160/240/320ms, fill-mode both. Keyframe giữ bù ngang của logo; reduced-motion bỏ animation và tiếp tục ẩn video theo hành vi cũ.
- Không cài gói, sửa logo, đổi server, commit hay xóa file. Các thay đổi có sẵn khác trong workspace được giữ nguyên. Không thay đổi spec hoặc trạng thái stage.
- Áp dụng Ponytail full và các quy tắc design-taste-frontend theo thiết kế đã duyệt; không tạo hướng thiết kế mới hoặc thêm nội dung ngoài spec. Dòng chữ hoa trong logo thương hiệu được giữ nguyên theo ngoại lệ của spec.

## Kiểm tra thực tế

Thực hiện tại `D:\Website_3Q`, dùng `npm.cmd` trong PowerShell:

- `npm.cmd run build`: **exit 1**. TypeScript server (`tsc -p tsconfig.json`) và client (`tsc -b`) đã qua; Vite dừng khi nạp `client/vite.config.ts`: `Error: spawn EPERM` trong `esbuild` (`ensureServiceIsRunning`). Chưa xác nhận tạo được bản build hoàn chỉnh.
- `npm.cmd test`: **exit 1**. Vitest v5.0.3 không khởi tạo được forks worker cho cả 4 file `auth.test.ts`, `authConfig.test.ts`, `products.test.ts`, `app.test.ts`: nguyên nhân `spawn EPERM`. Kết quả `Test Files no tests`, `Tests no tests`, `Errors 4 errors`; sau đó timeout khi dừng worker. Không có test nào chạy thành công trong lần này.
- Kiểm tra tĩnh bằng Node/assert trên mã nguồn: **đạt** — khối đăng nhập không còn `radial-gradient`, `box-shadow`, `border: 1px`; không còn wordmark/PORTAL ACCESS; đúng import font, shape nút, kích thước ảnh; giữ scale video; có reduced-motion và tắt animation. Logo tồn tại; file font resolve được từ package đã cài và có subset `vietnamese`.
- `git diff --check -- client/src/style.css`: **đạt**.

## Giới hạn chưa xác minh

- Chưa chạy kiểm tra trực quan/inspector trên trình duyệt; chưa đo thực tế tiêu đề một dòng, overflow 360px, focus bên trong iframe Google, chuyển động và reduced-motion. Tính theo CSS ở 360px: thẻ rộng 328px, vùng nội dung 280px, logo 200px, tùy chọn width nút Google tối đa 280px; đây là kiểm tra theo mã nguồn, không phải bằng chứng trình duyệt.
- Chưa kiểm chứng đăng nhập Google thật. Không thao tác tài khoản hoặc dữ liệu bên ngoài.
- Code đã hoàn tất trong phạm vi spec; chưa được Claude kiểm tra độc lập, chưa đặt `verified`.

## Sửa vòng 1

- Ngày: 2026-10-15. Trạng thái: `ready_for_review`; chờ Claude kiểm tra độc lập bản sửa vòng 1.
- Căn cứ: bốn chỉnh sửa theo review Claude được Bảo giao trực tiếp trong phiên; chưa có file `tasks/TASK-013-review.md` tại thời điểm thực hiện. Yêu cầu mới nhất này thay thế các giá trị tương ứng trong spec ban đầu.
- `client/src/pages/LoginPage.tsx`: câu phụ thành “Chỉ dành cho tài khoản đã được cấp quyền.”; điều khoản thành “Khi tiếp tục, bạn đồng ý với điều khoản và chính sách bảo mật của BaoQ Luxury.”.
- Chỉ sửa rule `.login-*` trong `client/src/style.css`: điều khoản 16px; `--login-ink: #ece6de`; logo rộng 260px, giữ nguyên 200px ở màn hình ≤520px.
- Không sửa logic đăng nhập, video hoặc phần khác; không commit, không xóa file, không thay đổi stage. Giữ nguyên công việc có sẵn trong workspace.
- Kiểm tra tại thư mục gốc bằng PowerShell:
  - Kiểm tra tĩnh bằng Node/assert: **đạt** cho hai chuỗi nội dung chính xác, điều khoản 16px, token màu và logo 260/200px.
  - `git diff --check -- client/src/style.css client/src/pages/LoginPage.tsx tasks/TASK-013-result.md`: **đạt**.
  - `npm.cmd run build`: **exit 1**; TypeScript server và client qua, Vite/esbuild không nạp được cấu hình do `spawn EPERM`.
  - `npm.cmd test`: không chạy được test; cả bốn file test lỗi khởi tạo forks worker do `spawn EPERM`, báo `Test Files no tests`, `Tests no tests`, `Errors 4 errors`.
- Giới hạn: chưa kiểm tra trực quan trên trình duyệt hoặc đăng nhập Google thật; chưa xác nhận build/test hoàn chỉnh. Bước tiếp theo: Claude review vòng 1 và chạy build/test trong môi trường cho phép spawn.

## Sửa vòng 2

- Ngày: 2026-10-15. Trạng thái: `ready_for_review`; chờ Claude kiểm tra độc lập vòng 2. Review `verified` trước đó áp dụng cho vòng 1.
- Căn cứ: yêu cầu trực tiếp của Bảo; thay thế bố cục và kích thước logo trong spec ban đầu.
- `client/src/pages/LoginPage.tsx`: đưa logo ra khỏi `.login-card`, đặt ngay trước thẻ trong `.login-page`; dùng `/brand/baoq-logo-transparent.png`, kích thước gốc 816×600 và giữ nguyên alt.
- `client/src/style.css`: logo rộng 300px, màn hình ≤520px rộng 220px, `height: auto`, cách thẻ 32px; `position: relative` và `z-index: 1` như thẻ để nằm trên video. Bỏ `translateX(1.55%)` và biến `--login-offset` khỏi rule logo và keyframe `login-enter`.
- Giữ logo hiện dần đầu tiên, các độ trễ tiếp theo và reduced-motion; không thêm bóng, glow, viền hoặc gradient. Giữ nguyên `baoq-logo.png` cũ và các thay đổi khác trong workspace; không commit.
- Kiểm tra: đọc lại thay đổi và chạy `git diff --check` trong phạm vi ba file; không chạy build/test theo yêu cầu của Bảo (Claude sẽ chạy).
- Giới hạn: chưa kiểm tra trực quan hoặc xác nhận build/test cho vòng 2; code đã hoàn tất, chưa được Claude review vòng 2.

## Sửa vòng 3

- Ngày: 2026-10-15. Trạng thái: `ready_for_review`; chưa được Claude kiểm tra độc lập vòng 3.
- Căn cứ: yêu cầu trực tiếp của Bảo, chọn hướng “Bỏ thẻ”; thay thế các thông số tương ứng của các vòng trước.
- `client/src/style.css`: chỉ sửa rule `.login-*`; `.login-card` trong suốt, padding 0, một cột căn giữa rộng tối đa 440px; bỏ token `--login-card` không còn dùng. Lớp tối đổi thành `rgba(0,0,0,.55)`.
- Logo giữ rộng 300px (≤520px: 220px), cách tiêu đề 40px. Tiêu đề 48px (≤520px: 38px), giữ font/màu; câu phụ cách tiêu đề 12px, nút cách câu phụ 32px. Vùng nút rộng tối đa 360px; điều khoản cách nút 24px, cỡ 14px, line-height 1.5, màu `--login-muted`.
- `client/src/pages/LoginPage.tsx`: kiểu và lời gọi `renderButton` dùng `theme: 'outline'`, giữ `shape: 'rectangular'`, `size: 'large'`, `text: 'continue_with'`, `locale: 'vi'`; width là `Math.min(360, button.current.clientWidth)`. Điều khoản: “Bằng việc tiếp tục, bạn đồng ý với điều khoản của BaoQ Luxury.”.
- Giữ thẻ `section` và `aria-labelledby`, video, bố cục túi 3D, animation/reduced-motion, logic đăng nhập và xử lý lỗi/tải. Không thêm bóng, glow, text-shadow, viền, gradient hoặc blur.
- Kiểm tra: đọc lại mã nguồn và `git diff --check` trong phạm vi ba file; không chạy build/test theo yêu cầu. Không commit, không xóa file.
- Giới hạn: chưa kiểm tra trực quan trên trình duyệt, nút Google thật hoặc build/test của vòng 3; không dùng bằng chứng `verified` của vòng trước để xác nhận vòng này.

## Sửa vòng 4

- Ngày: 2026-10-15. Trạng thái: `ready_for_review`; code đã hoàn tất, chưa được Claude kiểm tra độc lập vòng 4.
- Căn cứ: yêu cầu trực tiếp của Bảo; chỉ chỉnh thông số cột đăng nhập, giữ nguyên bố cục và túi 3D.
- `client/src/style.css`: token heading `#dcc4a3`, ink `#e9e1d6`, muted `#a8957d`; logo 200px (≤520px: 170px), margin-bottom 32px; card max-width 360px; tiêu đề 40px (≤520px: 34px), giữ Cormorant Garamond 500, line-height 1, letter-spacing -0.01em.
- Câu phụ Cormorant Garamond 500, 20px/1.4, màu ink, margin 10px 0 28px; vùng nút max-width 320px; điều khoản 14px/1.5, màu muted, margin-top 20px, max-width 320px, text-wrap balance.
- `client/src/pages/LoginPage.tsx`: chỉ đổi width của `renderButton` thành `Math.min(320, button.current.clientWidth)`; giữ nút outline.
- Không sửa `BirkinBag3D`, `client/src/three`, `client/src/assets`, `.login-layout`, `.login-bag`, `.login-panel`; giữ animation, video và lớp tối. Không thêm bóng, glow, viền hoặc gradient.
- Kiểm tra: đọc lại thay đổi và kiểm tra khoảng trắng bằng `git diff --check`; không chạy build/test theo yêu cầu. Không commit, không xóa file.
- Giới hạn: chưa xác minh trực quan trên trình duyệt, nút Google thật hoặc build/test của vòng 4; kết quả review các vòng trước không xác nhận vòng này.
