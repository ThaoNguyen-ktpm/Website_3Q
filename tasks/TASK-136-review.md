Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-136 — Review

- Dự án: web
- Người review: Claude · Ngày: 03/11/2026
- Trạng thái: `verified`.
- Bước tiếp theo: Bảo xem trên web thật (đăng nhập Admin, Điều hành → Kiểm tra) khi tiện.

## Phạm vi đã xem
Đặc tả `TASK-136-spec.md`, `TASK-136-result.md`, `frontend/src/v2-frame.tsx`, `frontend/src/app-v2.css`, phần nhúng của `server/src/v2/mockup/baoq-mockup-v2.html`, `frontend/task041.spec.ts`.

## Bằng chứng (Claude tự chạy)
- `npx playwright test -c task041.config.ts` tại `Webstie/frontend`: **20/20 đạt**. Trong đó có test lịch sử "survives reload and history": đang ở `#page=v2-tx`, F5 rồi Back về `#page=v2-dashboard`. Test này hỏng ổn định trước TASK-136.
- Test mới "V2 content uses page scroll; detail overlays cover and lock the window" kiểm ở 1440×1000, 1024×900 và 390×844:
  - iframe phủ cửa sổ, khung chi tiết cao bằng cửa sổ (92% trên điện thoại).
  - `#main` của V2 không nhảy chỗ khi mở; header web `inert`; trang cha khoá cuộn.
  - Focus vào tiêu đề và Tab bị giữ trong khung.
  - Đóng bằng Esc, nút X, bấm vùng mờ và Back đều trả đúng vị trí cuộn và focus.
  - Hộp bản ghi (Thu–bán) và hộp món hàng (Tồn kho) nằm giữa cửa sổ.
  - Link sâu `#page=v2-checks&alert=DEMO-E01` sau F5 vẫn mở lớp phủ cấp cửa sổ.
  - Không cuộn ngang ở 390.
- Lần chạy đầu hỏng 1 assertion: test bắt trang Thu–bán cao hơn 844px, nhưng dữ liệu mẫu của trang chỉ cao 689px ở 390×844. Đây là kỳ vọng sai của test, không phải lỗi app. Codex đổi khối đó sang `#page=v2-dashboard` (khoảng 3300px), giữ nguyên các assertion; chạy lại đạt.
- Ảnh chụp riêng của Claude (đăng nhập giả lập Admin, Playwright, 1440×900 và 390×844):
  - Kiểm tra: khung "Chi tiết cảnh báo" cao từ mép trên tới đáy cửa sổ, sát phải; header web, menu trái và danh sách đều mờ và tối, giống ảnh V2 mở trực tiếp Bảo gửi.
  - Thu–bán: hộp "Chi tiết bản ghi" nằm giữa cửa sổ, nền mờ.
  - Tổng quan: không viền bo góc, toàn bộ biểu đồ và khối hiện liền trong trang, cuộn bằng trang web.
- `npm run build` tại `Webstie`: exit 0.
- `npm test` tại `Webstie`: exit 0 — shared 32/32, server Vitest 490 đạt (18 skipped), Sale AI 413/413.

## Phát hiện
Không có lỗi trong app.

## Kết luận
Đạt.
