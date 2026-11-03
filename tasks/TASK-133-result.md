Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-133 — Kết quả triển khai

- Ngày: 03/11/2026.
- Trạng thái: `ready_for_review`. Code đã triển khai; chưa được Claude kiểm tra độc lập, chưa `verified`.
- Đặc tả: `tasks/TASK-133-spec.md`; đọc code hiện tại sau TASK-132 và tìm lại vị trí trước khi sửa. Không có file review TASK-132/TASK-133 tại thời điểm bắt đầu.

## Thay đổi

- `Webstie/server/src/v2/mockup/baoq-mockup-v2.html`: bỏ ô Vai trò demo, nút Dữ liệu demo và ghi chú ở home, band chung và Chính sách, áp dụng chung cho độc lập/nhúng. Bỏ helper `bandControls()` rỗng, selector/nhánh click, nhánh đổi role và nhánh Escape đóng ghi chú; giữ xử lý Escape cho drawer/dialog.
- Bỏ CSS `.chip-demo`, `.demo-note` và ba khóa dịch `role`, `demo`, `demoNote` trong cả vi/en. Giữ `.role-select` và kích thước mobile của select cho Kỳ dữ liệu.
- Giữ `store.role:'ceo'`, grants/quyền, dữ liệu, module hàng hóa/KPI, bridge và bố cục TASK-132; giữ `demoData` và các nhãn dữ liệu demo trong bảng/bản ghi.
- `Webstie/frontend/task041.spec.ts:200,202`: đổi đúng hai assertion từ `toBeVisible()` sang `toHaveCount(0)`. Đây là thay đổi hành vi có chủ đích theo yêu cầu mới của Bảo ở TASK-133, thay yêu cầu giữ điều khiển của TASK-132. Không sửa timeout, worker, fixture hay cấu hình kiểm thử.
- `Webstie/server/src/v2/README.md`: ghi khác biệt TASK-133 để khi chép lại từ `du-lieu` không đưa điều khiển trở lại; sửa mô tả chế độ nhúng cho đúng.
- `tasks/TASK-133-plan.md`, `tasks/TASK-133-result.md`: kế hoạch và bàn giao.

## Kiểm tra thực tế

1. `hostname` → `DESKTOP-4G5GOSR`.
2. Tại `Webstie/frontend`, `npx.cmd --no-install playwright test task041.spec.ts --config task041.config.ts`, chạy sau cập nhật assertion trước khi sửa HTML, và chạy lại sau triển khai → cả hai lần exit 1, `Error: spawn EPERM`. **blocked** trước khi chạy assertion; không có bằng chứng red/green, ảnh chụp hay Console trình duyệt. Dùng cấu hình hiện có `task041.config.ts`, không đổi cấu hình để né sandbox.
3. Tại `Webstie`, `npm.cmd run build` → exit 1. Server `tsc -p tsconfig.json && node scripts/copy-sale-ai.mjs && node scripts/copy-v2.mjs` đã hoàn tất; frontend `tsc --noEmit` qua rồi Vite/esbuild không tải được `vite.config.ts` do `spawn EPERM`. **Build toàn bộ blocked**, không báo đạt.
4. Tại `Webstie`, `npm.cmd test` → exit 1 ngay ở shared: 0 pass/7 fail do `spawn EPERM` khi Node tạo tiến trình test con, gồm `catalog-fetcher`, `connection-config`, `money`, `product-search-detail`, `product-search`, `target-price`, `text`. Chưa chạy tới test frontend/server/Sale AI. **Test chung blocked**, không kết luận lỗi logic TASK-131 hay TASK-133 từ kết quả này.
5. Node qua stdin (`vm.Script`, `assert`, UTF-8 fatal decoder), sau khi đặt `$OutputEncoding` UTF-8 → exit 0: 2 script inline parse được; không còn `Vai trò demo`, `id="role"`, `demo-chip`, `demo-note`; CEO, CSS/control kỳ dữ liệu và `demoData` vi/en còn nguyên; `Webstie/server/dist/v2/mockup/baoq-mockup-v2.html` khớp nguồn từng byte. Đây chỉ là kiểm tra tĩnh, không thực thi DOM/runtime hoặc thay nghiệm thu trình duyệt. Lần kiểm tra đầu bị lỗi do PowerShell truyền chữ Việt sang stdin thành dấu `?`; đã sửa encoding của lệnh và chạy lại thành công, không sửa sản phẩm vì lỗi này.
6. `git diff --check -- Webstie/frontend/task041.spec.ts Webstie/server/src/v2/README.md Webstie/server/src/v2/mockup/baoq-mockup-v2.html` → exit 0. README/HTML đang untracked từ task trước nên Git không kiểm tra diff hai file này; kiểm tra UTF-8/whitespace riêng cho các file bàn giao.
7. Impeccable `context --target .../baoq-mockup-v2.html` cho phép tinh giản hẹp trên giao diện hiện có; `detect --json .../baoq-mockup-v2.html` → exit 1, cảnh báo padding `nav-item` và vạch active `.side-link` 3 px tại các phần giữ nguyên ngoài phạm vi. Không sửa thiết kế ngoài yêu cầu; detector không thay bằng chứng browser.

## Claude cần xác minh

- Chạy lại `npm run build`, `npm test` tại `Webstie`, Playwright với `--config task041.config.ts` tại frontend trong môi trường được phép tạo tiến trình.
- Đăng nhập Admin thật, kiểm tra `/v2/` và bản nhúng: Tổng quan, Thu–bán, Hàng hóa, KPI, Chính sách; xác nhận không còn hai điều khiển/ghi chú, hiển thị CEO như trước, Kỳ dữ liệu còn ở các màn vốn có, Console không lỗi JS. Chụp ảnh làm bằng chứng. Chưa xác minh các tiêu chí trực quan này trong sandbox.
- `Webstie/frontend/qa.spec.ts` và `visual-capture.spec.ts` vẫn gọi `getByLabel('Vai trò demo')` (file thứ hai dùng regex `Vai trò demo|Demo role`); giữ nguyên theo đặc tả, là QA cũ chạy tay ngoài `npm test`.

Không sửa `shared/`, BossTele, `server/src/services`, `frontend/src/**`, module goods/KPI hay task khác. Không cài dependency, đọc bí mật, gọi dịch vụ thật, commit, chuyển nhánh hoặc xin approval. Giữ các thay đổi có sẵn của người dùng/Codex khác; build chỉ sinh artifact theo script hiện có.
