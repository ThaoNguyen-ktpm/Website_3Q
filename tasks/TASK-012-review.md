# TASK-012 — Review video nền trang đăng nhập

- Dự án: web.
- Người review: Claude.
- Trạng thái: verified.
- Hành động gần nhất: đọc thay đổi `LoginPage.tsx`, `style.css`; chạy build/test; kiểm tra trên trình duyệt (server Bảo đang chạy).
- Bước tiếp theo: không có. Khi bàn giao, giữ `client/public/login-background.mp4` trong dự án.

## Bằng chứng
- Video: `client/public/login-background.mp4`, 2.299.383 byte, giống hệt bản gốc (`cmp`); không bị `.gitignore` bỏ qua. Bản gốc vẫn ở thư mục `outputs`.
- `npm run build`: đạt; `client/dist/login-background.mp4` có trong bản build.
- `npm test`: 4 file, 55/55 đạt.
- Trình duyệt `/dang-nhap`: video tải từ `/login-background.mp4` (1280×720, `readyState` 4, đang phát); lớp tối 38%; thẻ đăng nhập nằm trên video và nhận click (`elementFromPoint`); 360px không tràn ngang.
- Đúng đặc tả: đường dẫn tương đối gốc site, `muted autoplay loop playsInline`, `aria-hidden`, ẩn video khi `prefers-reduced-motion`, gradient cũ giữ làm nền dự phòng.

## Phát hiện
Không có lỗi.

## Kết luận
verified.

## Sửa bổ sung: video phủ kín màn hình
- Nguyên nhân: CSS đã đúng (khung video = viewport, object-fit cover). File video có sẵn viền đen hai bên; phần hình thật ở cột x=133..1146 trên 1280, cố định ở 5 thời điểm đo (0,8s đến 7,6s).
- Sửa: `.login-background` thêm `transform: scale(1.28)`, `transform-origin: center` (1.28 > 1280/1014).
- Kiểm chứng: viewport 2000x980, video hiển thị x=-280 rộng 2560 (tỉ lệ 2,0), phần hình thật từ x=-14 đến x=2014, phủ kín; thẻ đăng nhập vẫn ở trên và nhận click; không cuộn ngang. Theo công thức cover, chiều ngang luôn phủ kín với mọi tỉ lệ màn hình. Đánh đổi: trên/dưới bị cắt thêm khoảng 22%.
- `npm run build` đạt; `npm test` 55/55 đạt.
- Kết luận: verified.
