Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-136 — V2 cuộn cùng trang và chi tiết phủ cửa sổ

- Dự án: web.
- Người thực hiện: Codex. Người kiểm tra độc lập: Claude.
- Trạng thái: `ready_for_review`.
- Hành động gần nhất: triển khai thay hành vi TASK-135, cập nhật test và chạy kiểm tra trong sandbox ngày 03/11/2026.
- Bước tiếp theo: Claude chạy build, test chung và toàn bộ Playwright TASK-041 trong môi trường cho phép; nghiệm thu trực quan trước khi ghi `verified`.

## Thay đổi

1. `Webstie/frontend/src/v2-frame.tsx`: khôi phục chiều cao từ `baoq-v2-height`, chỉ chấp nhận số hữu hạn trong 400–200000px. Một iframe duy nhất được giữ suốt phiên, kể cả khi mở chi tiết; không tái tạo sheet bằng React hay tạo iframe thứ hai. Slot giữ chiều cao nội dung khi iframe chuyển sang fixed phủ viewport. Nhận thông báo overlay, gửi tọa độ khung cũ cho V2; khóa body ở vị trí cuộn cũ, bù bề rộng scrollbar, đặt inert các nhánh DOM ngoài iframe. Backdrop cấp trang cha làm mờ header/band/tab/menu, scrim V2 phủ tối toàn cửa sổ. Đóng hoặc unmount khôi phục style, inert và vị trí cuộn. Listener dùng callback ref để không tháo khóa mỗi lần route cha render lại. Mọi message đều kiểm origin/source.
2. `Webstie/frontend/src/app-v2.css`: thay CSS TASK-135 ép shell cao 100dvh/cuộn trong iframe bằng iframe theo nội dung, không viền, không bo góc, nền trong suốt trên nền trang. Chỉ lúc mở chi tiết iframe mới fixed cao 100dvh, z-index 10001; backdrop cha ở 10000, trên header và nút nổi.
3. `Webstie/server/src/v2/mockup/baoq-mockup-v2.html`: gửi chiều cao `#main` bằng ResizeObserver, gửi trạng thái overlay ngay cả với link sâu lúc tải trang; nhận tọa độ để giữ main ở vị trí/bề rộng cũ khi iframe phủ cửa sổ. Sheet/dialog vẫn là nội dung và dữ liệu trong bộ nhớ của runtime V2 hiện có. Giữ chiều cao sheet mobile 92dvh. Khôi phục main về flow khi đóng. Bổ sung xử lý Shift+Tab từ tiêu đề và loại panel đang đóng khỏi lựa chọn panel hiện tại khi đóng/mở nhanh.
4. Cầu nối lịch sử: lúc khởi động, pageshow hoặc hash được khôi phục trong iframe, gửi `baoq-v2-ready` để hỏi route hiện tại từ cha; không gửi hash đó lên cha dưới dạng một điều hướng mới. Chỉ các thao tác điều hướng của người dùng mới gửi `baoq-v2-view`. Module Goods/KPI được đồng bộ ở document bubble sau handler của module, kể cả khi handler dùng replaceState. Giữ kiểm tra view hợp lệ, điều hướng Admin và đường đi route/view hiện có.

## Lỗi Back sau F5

Rà code xác định một luồng có thể gây lỗi: bridge cũ gọi `reportView()` cả lúc boot và hashchange do lịch sử iframe phục hồi; cha nhận hash khác URL hiện tại sẽ gán `location.hash`, tạo thêm lịch sử. Sau F5, iframe được khởi tạo từ src của trang hiện tại; khi Back phục hồi các entry cha/con, hash của con có thể bị hiểu thành điều hướng mới và đẩy cha trở lại trang vừa rời.

Thay đổi trên tách phục hồi lịch sử khỏi điều hướng người dùng và để cha quyết định route khi con tải/phục hồi. Test gốc **vẫn giữ** chuỗi Thu–bán → reload → Back phải về Tổng quan → Forward phải về Thu–bán; không nới assertion hay timeout. Kiểm tra fixture xác nhận boot/khôi phục không phát view và route cha không bị echo. **Chưa xác nhận tái hiện hay hết lỗi trên browser thật**, vì Playwright bị sandbox chặn. Đây là chẩn đoán dựa trên code và fixture, cần Claude xác nhận bằng test hồi quy.

## Test và file bàn giao

- `Webstie/frontend/task041.spec.ts`: thay đúng hai test TASK-135 vì yêu cầu cũ (khung cao phần viewport còn lại, cuộn trong iframe) đã bị TASK-136 thay thế có chủ đích. Test mới đo chiều cao iframe theo `#main`, không bo góc/cuộn trong iframe; sheet/scrim phủ viewport, vị trí main được giữ, body fixed/inert, Tab trong panel, trả focus/cuộn khi đóng bằng X/Esc/scrim/Back ở 1440×1000, 1024×900, 390×844. Thêm record/item ở ba kích thước, dialog giữa viewport desktop, link cảnh báo sâu sau reload và message overlay sai origin/source. Giữ các test phân quyền, điều hướng, F5 và lịch sử đã có. Các ảnh chụp chỉ được cấu hình trong test, **chưa tạo được ảnh thực tế**.
- `tasks/TASK-136-bridge-check.cjs`: kiểm tra actual bridge trích từ HTML và actual receiver TS được transpile bằng TypeScript đã cài. DOM/hook fixture chỉ phục vụ kiểm thử; không gọi API thật, không thay dữ liệu ứng dụng và không phải nghiệm thu trình duyệt.
- `tasks/TASK-136-plan.md`: kế hoạch triển khai.
- Log kiểm tra: `TASK-136-build.log`, `TASK-136-test.log`, `TASK-136-browser-before.log`, `TASK-136-browser.log`, `TASK-136-ui-check.log` trong `tasks/`.

## Kiểm tra thực tế

- **Đạt, exit 0:** `npm.cmd run typecheck` tại `Webstie/frontend`.
- **Đạt, exit 0:** `npx.cmd tsc --noEmit --module esnext --target ES2022 --moduleResolution bundler --jsx react-jsx --lib ES2022,DOM --esModuleInterop --skipLibCheck task041.spec.ts` tại frontend, sau các sửa test cuối.
- **Đạt, exit 0:** `node tasks/TASK-136-bridge-check.cjs` tại repo root: hai nhóm assertions cho boot/history, origin/source, route không echo, height/giới hạn height, tọa độ overlay, module control, direct-mode bridge không chạy, khóa/inert/phục hồi scroll và cleanup khi unmount.
- **Đạt:** `node:vm.Script` phân tích hai script classic inline của HTML V2; kiểm tra UTF-8 selector iframe và `git diff --check` cho CSS/test không có lỗi. Chỉ là kiểm tra cú pháp/tĩnh.
- **Đạt, exit 0:** khám phá `playwright test -c task041.config.ts --list`: nhận diện 20 test. Đây không phải chạy test.
- **Blocked, exit 1:** `npm.cmd run build` tại `Webstie`: server TypeScript và copy tài nguyên qua; frontend TypeScript qua; Vite/esbuild dừng ở `Error: spawn EPERM` khi tải vite.config.ts. Không khẳng định build đầy đủ thành công.
- **Blocked, exit 1:** `npm.cmd test` tại `Webstie`: cả 7 file shared (catalog-fetcher, connection-config, money, product-search-detail, product-search, target-price, text) không khởi chạy được vì spawn EPERM. Chuỗi dừng trước frontend/server/Sale AI. Không sửa file hoặc lệnh test thuộc TASK-131 để né lỗi.
- **Blocked, exit 1:** `npx.cmd playwright test -c task041.config.ts` tại frontend: `Error: spawn EPERM`, chưa chạy browser. Lần chạy chọn hai test trước sửa cũng bị cùng lỗi. Không có bằng chứng red/green trình duyệt, screenshot hay nghiệm thu kích thước thật; không xin quyền theo yêu cầu.
- **Rà tĩnh UI:** Impeccable detector ghi 20 cảnh báo trên HTML V2 (19 cramped-padding, 1 side-tab) ở các selector/nội dung có sẵn; không sửa thiết kế ngoài phạm vi. Không coi detector là kiểm tra render.
- Có rà soát tĩnh nội bộ bằng skill requesting-code-review; đã sửa selector test bị lỗi UTF-8 và thời điểm đồng bộ module được phát hiện. Đây không thay cho review độc lập của Claude.

## Phạm vi và giới hạn

Không sửa `shared/`, BossTele, `server/src/services`, Price System, Sale AI; không thêm dependency, không bật bot/dịch vụ, không commit và không chuyển nhánh. Bảo toàn thay đổi có sẵn. Build chạy script copy dist hiện có. CSS embedded mới chỉ áp dụng khi embed=1; nội dung, số liệu và shell trực tiếp giữ nguyên. Sửa focus trap/đóng nhanh cũng được giới hạn ở chế độ embedded.

Claude cần xác minh toàn bộ tiêu chí browser: độ mờ/tối của cả shell và nút nổi; cuộn chuột/cảm ứng/bàn phím; resize khi panel mở; Back/Forward/F5; link sâu; focus và đóng/mở nhanh; dialog mobile và dữ liệu việc còn nguyên trong iframe. Hành vi history riêng bên trong module KPI có sẵn không được viết lại trong task này. Mọi kiểm tra nghiệm thu browser và bộ build/test đầy đủ vẫn `blocked`; chưa ghi `verified`.

## Bổ sung sau review Claude — sửa test cuộn trang

Máy: Laptop (DESKTOP-4G5GOSR). Chỉ đổi hash ở block cuộn trang cuối của test `V2 content uses page scroll; detail overlays cover and lock the window` từ `#page=v2-tx` sang `#page=v2-dashboard`. Theo review Claude, fixture Thu–bán cao khoảng 689px ở 390×844, còn Tổng quan khoảng 3300px, phù hợp với assertion chiều cao > 844. Giữ nguyên mọi assertion; không sửa code ứng dụng, không commit. So sánh nội dung trước/sau xác nhận test chỉ đổi đúng hash này; `git diff --check` đạt. Lệnh tại frontend `npx.cmd playwright test -c task041.config.ts --grep "V2 content uses page scroll; detail overlays cover and lock the window" --reporter=line` bị chặn bởi `Error: spawn EPERM` (exit 1), chưa xác minh browser. Trạng thái bổ sung: `ready_for_review`.
