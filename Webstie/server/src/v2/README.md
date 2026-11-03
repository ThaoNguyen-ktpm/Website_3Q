# Điều hành V2 — TASK-130

Nguồn: https://github.com/baon102102-prog/du-lieu, nhánh `v2-dashboard-20261102`, commit `224f2af`.

- HTML và KPI từ `docs/design-proposals/plan-mockup-v1/v2/mockup/`.
- `mockup/goods/` là thư mục thật, chứa đúng `app.js`, `data.js`, `engine.js`, `app-ops.scoped.css` từ `docs/design-proposals/ops-modules-v2/`. Không cần brand rời; HTML có ảnh nhúng.
- Chỉ chép file chạy; không chép QA, test, tài liệu nguồn, index độc lập không dùng hay dữ liệu thật. Các file `model.mjs`, `income.mjs`, `engine.js`, `data.js` giữ nguyên byte nguồn. Không đổi chính sách/tỷ lệ V2.
- TASK-130, thay đổi trong HTML: liên kết Trang chủ ở brand, menu, breadcrumb Điều hành/Chính sách và sidebar về `/#page=portal`; các liên kết thao tác demo giữ nguyên.
- TASK-133, thay đổi bổ sung trong HTML: bỏ ô chọn Vai trò demo, nút Dữ liệu demo và ghi chú bật ra từ nút đó trên mọi màn, cả khi nhúng; giữ vai trò mặc định CEO, ô Kỳ dữ liệu và nhãn dữ liệu demo trong bảng/bản ghi. Khi chép lại từ nguồn `du-lieu`, giữ các thay đổi này.
- `/v2/` dùng phiên đăng nhập web và chỉ cho `ADMIN` (giống `overview` trong frontend `access.ts`, không dùng riêng `dashboard.view` vì STAFF/MANAGER cũng có quyền đó).
- Snapshot thật nằm ngoài static root tại `server/data/v2/kpi-snapshot.json`, chỉ trả qua `/v2/mockup/kpi/snapshot.json`, `Cache-Control: no-store`. Thiếu file trả 404; không chép vào Git hoặc dist. Các màn demo giữ nguyên nhãn dữ liệu demo từ nguồn.
- Build server chạy `scripts/copy-v2.mjs` để chép runtime vào `dist/v2/mockup/`. Không phụ thuộc clone nguồn khi chạy/build.

## Nhúng trong web — TASK-132

- Route web `#page=v2-dashboard` và `#page=v2-<màn>` dùng chung menu báo cáo/quản lý. HTML `?embed=1` chỉ giữ nội dung và các điều khiển còn lại (Kỳ dữ liệu, Tùy chỉnh tổng quan); đường dẫn không có `embed` giữ khung riêng. Ô Vai trò demo và nút Dữ liệu demo đã bỏ theo TASK-133 ở cả hai chế độ.
- Bridge cùng nguồn: `baoq-v2-height` báo chiều cao, `baoq-v2-view` báo hash nội bộ; web gửi `baoq-v2-route` khi đổi route. Cả hai phía kiểm tra origin/source; web chỉ mở màn trong allowlist. Web sở hữu history, hash iframe dùng replaceState để không tạo hai bước Back cho một lần điều hướng.
- CSP cho phép frame cùng nguồn (`frame-ancestors 'self'`); auth/Admin/no-store và snapshot không đổi.
- Font serif ưu tiên Palatino Linotype, rồi Georgia/Times New Roman để tránh Baskerville/Palatino thiếu dấu chồng tiếng Việt. Cần Claude xác minh bằng ảnh trên Windows, cả nhúng và độc lập.
- Không đổi các module tính toán, dữ liệu hay chính sách/tỷ lệ từ nguồn.
