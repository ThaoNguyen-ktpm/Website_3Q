# TASK-135 — Kế hoạch triển khai

- Mục tiêu: khung V2 dùng hết vùng nhìn thấy của cột phải, cuộn nội dung bên trong, sheet/scrim theo viewport iframe.
- Đặc tả: `tasks/TASK-135-spec.md`; giữ stack React/CSS hiện có, không thêm dependency, không commit/chuyển nhánh.
- Phương án: class riêng `ws-v2-frame`; shell V2 dùng flex cao `100dvh`, trừ header, band, tabs và padding có sẵn. Không sửa workspace hoặc CSS nền nếu có thể giới hạn bằng `:has()`.
- Phạm vi: `frontend/src/v2-frame.tsx`, `frontend/src/app-v2.css`, `server/src/v2/mockup/baoq-mockup-v2.html`, `frontend/task041.spec.ts`.
- Không sửa shared, BossTele, services, Sale AI và Price System. Bảo toàn TASK-133/134 cùng thay đổi đang có.

## Các bước

- [x] Cập nhật test trình duyệt: khung bằng phần viewport còn lại (tối thiểu 400px), resize desktop/mobile, sheet/scrim phủ khung, nội dung dài cuộn tới cuối; giữ kiểm tra điều hướng và origin/source.
- [x] Thử test trước triển khai: bị `spawn EPERM`, chưa chứng minh được chu kỳ red/green.
- [x] Bỏ sender/receiver `baoq-v2-height`; giữ nguyên `baoq-v2-route`/`baoq-v2-view`. CSS V2 cao theo shell, sidebar có vùng cuộn riêng; iframe ẩn scrollbar nhưng không khóa cuộn. Sheet mobile dùng viewport động của iframe.
- [x] Chạy build, test chung, typecheck và thử E2E; kiểm tra kiểu đạt, build/test/E2E blocked do sandbox. Rà tĩnh nội bộ, chờ Claude kiểm tra độc lập.
- [x] Viết `TASK-135-result.md` bằng tiếng Việt, trạng thái `ready_for_review`; ghi `blocked` cho nghiệm thu trình duyệt.

## Điểm cần rà

Khung thấp vẫn tối thiểu 400px; tabs trên mobile có thể nhiều hàng; sidebar dài cuộn độc lập; sheet khóa nền và mở lại không mất khả năng cuộn; direct V2 và Sale AI giữ cách hiển thị hiện có. Kiểm tra giao diện thực tế thuộc các mục 1–4 của spec, không thay bằng kiểm tra tĩnh.
