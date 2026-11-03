Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-132 — Kết quả triển khai

- Dự án: web (`D:\Website_3Q\Webstie`). Ngày: 03/11/2026.
- Codex triển khai; Claude chạy test/build và review độc lập.
- Trạng thái: `ready_for_review`, chưa `verified`. Code đã triển khai; chưa có kết quả chạy assertion hay nghiệm thu trình duyệt cho TASK-132.
- Bước tiếp theo: Claude chạy các bộ kiểm tra và chụp ảnh Windows được liệt kê bên dưới.

## Thay đổi

1. Thống nhất danh sách Điều hành trong `apps.ts`, dùng cho drawer, sidebar và tabs:
   - Báo cáo: Tổng quan, Thu–bán, Tồn kho, Kiểm tra, Chi phí, Hàng hóa & hiệu quả vốn, KPI Sale.
   - Quản lý: giữ Nhân viên, Nhật ký, Tài liệu theo quyền hiện có; giữ/bổ sung nhãn THẬT ở cả ba cách điều hướng.
   - Chưa kết nối nguồn: 5 mục V2 trong nhóm thu gọn, tự mở khi đang ở một mục trong nhóm.
   - Khác: Chính sách và ← Trang chủ. Không cấp thêm quyền cho Manager/STAFF; V2 chỉ dành cho Admin.
2. Route web là `#page=v2-dashboard`, `v2-tx`, `v2-inventory`, `v2-checks`, `v2-costs`, `v2-goods`, `v2-kpi`; các mục chưa kết nối là `v2-reconcile`, `v2-consignment`, `v2-cash`, `v2-close`, `v2-settings`.
   - Tile Điều hành của Admin và mục Tổng quan mở route mới trong web.
   - Link cũ `overview`, `transactions`, `inventory`, `errors`, `costs` chuyển tương ứng sang V2 bằng `replaceState`; 5 route chưa kết nối cũ cũng được chuyển.
   - Giữ trạng thái chi tiết/module trong hash web, ví dụ `#page=v2-kpi&k_view=sale&k_sale=Lan`; Chính sách vẫn dùng trang thật của web và giữ tham số `group` khi đi từ V2.
3. `V2Frame` nằm trong `ops-main`, dưới band/breadcrumb web. URL khởi tạo là `/v2/mockup/baoq-mockup-v2.html?embed=1#view=<màn>`; mục chưa kết nối dùng `#view=nc&page=<mục>`.
   - Nhận `baoq-v2-height`, kiểm tra kiểu/số hữu hạn và giới hạn chiều cao 400–200000 px.
   - Nhận `baoq-v2-view` kèm hash, kiểm tra origin, source đúng iframe và allowlist màn; không mở URL do message cung cấp.
   - Web gửi `baoq-v2-route` khi route đổi. Iframe kiểm tra origin/source cha, cập nhật bằng replaceState; web sở hữu history để tránh hai bước Back cho một lần điều hướng. Thuộc tính `src` giữ URL khởi tạo của lần mount; route tiếp theo được đồng bộ bằng message, F5 khởi tạo lại từ hash web hiện tại.
4. HTML V2 có chế độ `?embed=1`: ẩn header, Menu/VI–EN, breadcrumb/tiêu đề lớn, sidebar/tabs và footer riêng; giữ thanh vai trò demo, kỳ dữ liệu, Tùy chỉnh tổng quan, nhãn và ghi chú Dữ liệu demo. ResizeObserver theo dõi chiều cao nội dung, không lấy chiều cao viewport iframe làm chiều cao trang.
   - Link nội bộ và thao tác `go` báo route về web khi nhúng; link Trang chủ trở về portal của web.
   - Không có `embed` vẫn dùng khung và điều hướng riêng như TASK-130.
5. Token serif V2 đổi sang `"Palatino Linotype","Georgia","Times New Roman",serif`, ưu tiên font hỗ trợ tiếng Việt thay vì Baskerville/Palatino. Áp dụng cho cả nhúng và độc lập. **Chưa chụp ảnh hay xác minh dấu trên Windows**; cần Claude kiểm tra trực quan, không coi sửa stack font là bằng chứng đã hết lỗi.
6. CSP V2 đổi riêng `frame-ancestors 'none'` thành `'self'` để cho phép web cùng nguồn nhúng. Giữ nguyên X-Frame-Options SAMEORIGIN hiện có, auth, quyền Admin, same-origin, no-store, route tĩnh và đường dẫn/handler snapshot TASK-130.
7. Đã bỏ phần báo cáo React cũ trong `dashboard.tsx` (Overview, biểu đồ, AlertSheet, kiểu/dữ liệu phụ trợ chỉ dùng cho báo cáo cũ) và phần tải/render bảng, bộ lọc/kỳ, persona demo, dialog bản ghi cũ trong `workspace.tsx`. `dashboard.tsx` còn shell chung OpsBand/OpsSide/OpsTabs.
   - Giữ `demo-data.json` vì Chính sách còn import.
   - Chủ ý giữ `simulated-api.ts` và dòng import JSON `with {type:'json'}` theo yêu cầu trực tiếp “TASK-130 and its test fix are done; keep them”; giao diện Điều hành không còn import module này.
   - Giữ toàn bộ module V2, dữ liệu demo V2, chính sách/tỷ lệ và chức năng thật ngoài phạm vi.

## File trong lần triển khai này

- `Webstie/frontend/src/apps.ts`, `access.ts`, `app-header.tsx`, `app-v2-base.css`, `dashboard.tsx`, `workspace.tsx`.
- `Webstie/frontend/src/v2-frame.tsx` (mới).
- `Webstie/frontend/v2.unit.spec.ts`, `task041.spec.ts`.
- `Webstie/server/src/routes/v2Routes.ts`, `tests/v2.test.ts`.
- `Webstie/server/src/v2/mockup/baoq-mockup-v2.html`, `Webstie/server/src/v2/README.md`.
- `tasks/TASK-132-plan.md`, `tasks/TASK-132-result.md` (mới).

## Test đã viết/cập nhật, chưa chạy

- Unit trên component thật: nhóm menu/nhãn THẬT, Admin/Manager/STAFF, allowlist, iframe URL, chuyển link cũ và giữ tham số chi tiết/module.
- Playwright trong `task041.spec.ts`: mock API đăng nhập chỉ trong test, phục vụ đúng file runtime V2 từ disk qua allowlist; snapshot test trả 404, không đọc snapshot thật. Kiểm tra shell nhúng bị ẩn, controls còn hiện, height đổi, link đổi route/menu active, F5/Back/Forward, message sai source/origin/màn bị bỏ qua, mobile không tràn và chế độ độc lập.
- Test server bổ sung iframe cùng nguồn và giữ 401/403; giữ các test module, CSP, snapshot, cache, traversal của TASK-130.
- Thay kỳ vọng cũ có chủ đích: bỏ Tổng quan cũ (demo) khỏi menu và không khởi tạo persona demo của React nữa. Không bỏ kiểm tra phân quyền hay sửa cấu hình test/worker/timeout.
- Theo phân công Claude chạy toàn bộ test, Codex không chạy test suite/browser; chưa có bằng chứng red/green cho test mới. Typecheck dưới đây không thay thế chạy assertion.

## Kiểm tra thực tế của Codex

- `hostname` → `DESKTOP-4G5GOSR`.
- Tại `Webstie/frontend`: `node node_modules/typescript/bin/tsc --noEmit` → exit 0, đã chạy lại sau thay đổi cuối.
- Tại `Webstie/frontend`: `node node_modules/typescript/bin/tsc --target ES2022 --lib ES2022,DOM --module ESNext --moduleResolution Bundler --jsx react-jsx --strict --noEmit --skipLibCheck --resolveJsonModule v2.unit.spec.ts task041.spec.ts` → exit 0. Kiểm tra cả file test ngoài include của tsconfig frontend.
- Tại `Webstie`: `node node_modules/typescript/bin/tsc -p server/tsconfig.json --noEmit` → exit 0, đã chạy lại sau thay đổi cuối.
- Node qua stdin, dùng `vm.Script` parse script inline → 2 script HTML parse được; không thực thi runtime/trình duyệt.
- Node qua stdin, dùng SHA-256 so với nguồn `D:/v2-src/du-lieu/docs/design-proposals/` → **9/9 module/CSS khớp nguồn**, gồm `model.mjs`, `income.mjs`, `engine.js`, `data.js`. Kiểm tra tĩnh cũng xác nhận bản sửa import JSON TASK-130 còn nguyên.
- Impeccable `detect --json` trên các file giao diện thay đổi → một warning ở `app-v2-base.css:291` về vạch menu active 3 px đã có sẵn; giữ nguyên ngoài phạm vi. Không phải bằng chứng browser/a11y đạt.
- `git diff --check` theo các file tracked đã sửa → exit 0, chỉ có cảnh báo LF/CRLF của Git. File mới/untracked được kiểm tra UTF-8 và whitespace riêng trước bàn giao.
- Không có lệnh bị sandbox chặn trong lượt này; không xin approval. Một lệnh `rg` ban đầu dùng wildcard đường dẫn PowerShell không hợp lệ đã được thay bằng glob `-g`; không phải lỗi sandbox.

## Claude cần xác minh

1. `npm run build`, `npm test` tại `Webstie`; BossTele `npm test` theo spec. Kiểm tra `v2.test.ts`, lõi Sale AI và E2E vì có thay đổi CSP server. Không suy diễn kết quả từ TASK-130 sang TASK-132.
2. Unit frontend theo `unit.config.ts`; browser theo `task041.config.ts` trong môi trường Claude được phép chạy server kiểm thử. Codex không chạy cấu hình này vì có webServer tự khởi động.
3. Trình duyệt thật qua web đang chạy, Bảo đăng nhập Admin: tile Điều hành → V2 trong khung chung → 7 màn báo cáo, 5 mục chưa kết nối → Nhân viên/Nhật ký/Tài liệu thật. Kiểm tra F5, Back/Forward, chi tiết từ dashboard, chiều cao tăng/giảm và Console.
4. Chụp ảnh Windows desktop/mobile khi nhúng và mở độc lập; xem trực tiếp dấu ở “Tổng quan điều hành”, “Doanh thu & kết quả theo tuần”. Test browser đã đặt điểm xuất ảnh nhưng **chưa tạo ảnh**, chưa thể khẳng định font hiển thị đúng. Kiểm tra cả Mac nếu có thiết bị.
5. Các test browser dùng fixture không chứng minh cookie Admin, CSP qua proxy hay snapshot thật hoạt động; cần kiểm tra đăng nhập thật riêng.

Không đọc `.env`, khóa hoặc token; không đọc snapshot thật, không gọi dịch vụ ngoài, không đổi dữ liệu thật, API quản lý, đăng nhập, Sale AI, Kiot/Sapo hay BossTele. Không cài dependency, không dừng/khởi động lại server, không commit/push. Bảo toàn các thay đổi có sẵn ngoài phạm vi.
