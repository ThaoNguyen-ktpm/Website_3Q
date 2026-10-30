# Bàn giao công việc Claude và Codex

Claude giao việc bằng đặc tả và kiểm tra kết quả. Codex viết và sửa code toàn bộ dự án `D:\Website_3Q` (website và BossTele).

## Tài liệu cho mỗi công việc
- `TASK-xxx-spec.md`: Claude viết mục tiêu, phạm vi, yêu cầu, tiêu chí nghiệm thu và mục **Vùng code** (xem bên dưới).
- `TASK-xxx-result.md`: Codex viết thay đổi đã thực hiện, bằng chứng kiểm tra và giới hạn.
- `TASK-xxx-review.md`: Claude viết phát hiện, bằng chứng kiểm tra độc lập và kết luận.

Đánh số tiếp từ `TASK-009`; `TASK-001` đến `TASK-008` của BossTele được lưu tại `BossTele/tasks/`. Sửa bổ sung cùng một công việc thì cập nhật các tài liệu tương ứng, giữ lại bằng chứng cần thiết.

Mỗi tài liệu ghi: mã công việc, dự án (`web` hoặc `BossTele`), người phụ trách, trạng thái, hành động gần nhất, bước tiếp theo và bằng chứng.

## Mục Vùng code trong spec
Claude lấy từ CodeGraph (`codegraph_explore`, `codegraph impact`, `codegraph affected`) để Codex bắt đầu đúng chỗ, không phải tự dò repo:
- **Điểm vào:** file và symbol cần sửa, kèm `file:dòng`.
- **Phạm vi ảnh hưởng:** nơi gọi và phụ thuộc cần kiểm tra lại.
- **Test liên quan:** file test bị ảnh hưởng, gồm cả test cần thêm.
- **Không đụng:** file hoặc vùng nằm ngoài phạm vi.

Số dòng có thể lệch khi code đổi; Codex chạy lại `codegraph_explore` với tên symbol trước khi sửa.

## Trạng thái
`proposed` → `ready` → `in_progress` → `ready_for_review` → `verified`.

Nếu review phát hiện lỗi: `changes_requested` → Codex sửa → `ready_for_review` → Claude kiểm tra lại.
Nếu thiếu thông tin hoặc môi trường cần thiết, ghi `blocked` cùng nguyên nhân và điều kiện tiếp tục.

Đặc tả `ready` phải dựa trên yêu cầu đã được người dùng giao hoặc chấp thuận.

## Cách sử dụng
1. Mở Claude tại `D:\Website_3Q`, yêu cầu phân tích và lập đặc tả theo `CLAUDE.md`.
2. Mở Codex tại cùng thư mục, yêu cầu triển khai đặc tả đã thống nhất theo `AGENTS.md`.
3. Yêu cầu Claude kiểm tra code và kết quả; Codex xử lý các lỗi được ghi nhận.

Các file này hướng dẫn vai trò và lưu bàn giao; chúng không tự khởi chạy, kết nối hay điều phối hai ứng dụng.

## Website sau TASK-110

Giao diện duy nhất ở `Webstie/frontend/`, cổng 8787; API cổng 4000. Chạy dev/build/test tại `Webstie/`; build/test gốc gồm frontend và server. Frontend có lockfile độc lập: cài bằng `npm ci --prefix frontend`. Tài liệu nằm trong Điều hành → Quản lý, dùng API và quyền tài liệu hiện có. Kiểm thử đăng nhập Google, link dùng một lần, tài liệu và LAN cần bằng chứng trình duyệt riêng; không thay thế bằng typecheck.

## Sale AI sau TASK-104

Sale AI là lõi JS trong máy chủ Express (`Webstie/server/src/sale-ai/`), API và giao diện cũ ở `/sale-ai/`, sau đăng nhập, `sale.manage` và same-origin. Không bật tiến trình Sale AI riêng. Kho mới ở `Webstie/server/data/sale-ai/` (gitignored), không nhập dữ liệu cũ.

Test lõi: `node --test *.test.js` tại `Webstie/server/src/sale-ai/test`, hoặc `npm run test:sale-ai` tại server. `npm test` server chạy Vitest riêng rồi test lõi; không để Vitest quét node:test. Build chép JS và public vào dist.

Đánh số task phải tính cả `D:\BaoQ-AI\tasks` cũ; không tái sử dụng số đã có ở đó. Kho cũ giữ nguyên để lưu trữ. TASK-104 chưa cho phép kiểm thử ghi/khôi phục thật và không bật batch sản xuất. Đọc result/review để biết phần chưa xác minh trên máy đang chạy.
