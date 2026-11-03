Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-130: Gắn giao diện Điều hành V2 (Tổng quan, KPI Sale, Hàng hóa/Kho) vào web 8787, sau đăng nhập

- Dự án: web (`D:\Website_3Q\Webstie`)
- Người phụ trách: Codex (thực hiện), Claude (chạy test, kiểm tra trình duyệt, review)
- Trạng thái: `ready`. Bảo yêu cầu ngày 03/11/2026: "tui muốn cập nhật trang tổng quan giống thằng này qua web của tui", "lấy dữ liệu qua cho chạy đc". Ảnh mẫu là `http://192.168.110.60:8789/v2/mockup/baoq-mockup-v2.html#view=dashboard` (máy Mac của Bảo).

## Nguồn V2 (Claude đã lấy sẵn, chỉ đọc)

- `D:\v2-src\du-lieu`: clone nhánh `v2-dashboard-20261102` (commit `224f2af`) của `github.com/baon102102-prog/du-lieu`, `core.symlinks=false`.
- Khung V2: `docs/design-proposals/plan-mockup-v1/v2/mockup/`
  - `baoq-mockup-v2.html` (433 KB, tự chứa CSS và JS);
  - `kpi/` (`controller.mjs`, `model.mjs`, `income.mjs`, `view.mjs`, `style.css`, `index.html`);
  - `goods`: symlink hỏng khi clone trên Windows, trỏ tới `../../../ops-modules-v2`.
- Module Hàng hóa/Kho: `docs/design-proposals/ops-modules-v2/` (`app.js`, `data.js`, `engine.js`, `app-ops.scoped.css`, `app-ops.css`, `app-v2*.css`, `brand/`, `index.html`).
- V2 tải module bằng đường dẫn tương đối: `MOD_BASE=new URL('.',…)`, `kpi/controller.mjs`, `goods/app.js|data.js|engine.js|app-ops.scoped.css`. KPI đọc `new URL('./snapshot.json', import.meta.url)`, tức `kpi/snapshot.json`.
- Không gọi mạng ngoài (đã kiểm). Dữ liệu demo nằm trong HTML/JS.
- **Dữ liệu thật KPI:** Claude đã lấy `snapshot.json` từ máy Mac (Bảo yêu cầu) về `Webstie/server/data/v2/kpi-snapshot.json`. File đã bị gitignore (`Webstie/server/data/`). Phiên bản `NOV2026-20261030-r2`, 134 đơn, 47 phiếu thu.

## Yêu cầu

1. **Chép V2 vào web, chỉ file chạy:**
   - Khung vào `Webstie/server/src/v2/mockup/` (HTML và `kpi/` gồm `.mjs` và `style.css`, `index.html` nếu V2 cần).
   - Module Hàng hóa vào `Webstie/server/src/v2/mockup/goods/` dưới dạng **thư mục thật** (không symlink hay junction trong Git), chỉ các file `goods/*` mà V2 tải, cộng `brand/` nếu cần.
   - **Không chép** `qa/`, `src/`, `*.test.mjs`, `capture-report.json`, file `.md`.
   - Ghi nguồn (repo, nhánh, commit `224f2af`) trong `Webstie/server/src/v2/README.md`.
   - Không sửa `model.mjs`, `income.mjs`, `engine.js`, `data.js`, chính sách hay tỷ lệ của V2.
2. **Phục vụ sau đăng nhập.** Express phục vụ `/v2/` theo cùng mẫu `/sale-ai` (`app.ts:37-40`): `cookieParser`, `requireAuth`, quyền giống trang Tổng quan hiện tại (chỉ Admin; Codex xác định quyền thật đang dùng cho `overview`), `requireSameOrigin` nếu phù hợp, header CSP đủ cho V2 chạy (script inline, `import()` module cùng nguồn). Chưa đăng nhập thì không xem được file nào dưới `/v2/`.
   - `GET /v2/mockup/kpi/snapshot.json` trả `server/data/v2/kpi-snapshot.json`, cùng điều kiện đăng nhập, `Cache-Control: no-store`. Không có file thì trả 404 để V2 tự báo "Chưa đủ dữ liệu".
   - Không phục vụ thư mục nào khác của `server/data`.
3. **Vite** (`frontend/vite.config.ts`): proxy thêm `'/v2'` sang API, giống `'/sale-ai'`.
4. **Điều hướng trong web:**
   - Ô "Điều hành" ở trang chủ (`#page=portal`) và mục "Tổng quan" trong Điều hành mở V2 tại `/v2/mockup/baoq-mockup-v2.html#view=dashboard`.
   - Trang tổng quan cũ (`#page=overview`, demo) vẫn còn, đổi tên thành "Tổng quan cũ (demo)" trong menu Điều hành.
   - Trong V2, mục "Trang chủ" (breadcrumb/brand về `#view=home`) nên dẫn về `/#page=portal` của web, nếu sửa được bằng một thay đổi nhỏ ngoài các file cấm ở yêu cầu 1. Ghi rõ đã sửa gì.
5. **Không đổi:** đăng nhập, API, cơ sở dữ liệu, Sale AI, tích hợp Kiot/Sapo, BossTele.

## Điểm Claude đã chọn mặc định (Bảo có thể đổi)

- V2 nằm sau đăng nhập, chỉ Admin. Lý do: web 8787 mở được từ LAN, và KPI có dữ liệu bán hàng thật.
- V2 mở thành trang riêng, không lồng iframe, vì V2 có header và menu riêng.
- Trang tổng quan cũ được giữ lại, không xoá.

## Test

- Server: chưa đăng nhập thì `GET /v2/mockup/baoq-mockup-v2.html` và `/v2/mockup/kpi/snapshot.json` bị chặn (401/redirect như `/sale-ai`). Admin thì 200. Người không đủ quyền thì 403. Có snapshot thì trả JSON, thiếu file thì 404. Không truy cập được file ngoài thư mục V2 (thử `..`).
- Frontend: ô Điều hành và mục Tổng quan trỏ đúng link V2; còn mục "Tổng quan cũ (demo)".
- Toàn bộ test cũ đạt.

## Lệnh kiểm tra (Claude chạy)

- `npm run build`, `npm test` tại `Webstie`; BossTele `npm test`.
- Trình duyệt (Claude): đăng nhập Admin, mở V2 từ trang chủ; Tổng quan, KPI Sale và Hàng hóa không trắng trang; Console không có lỗi đỏ; KPI dùng snapshot thật.

## Cách làm

- Codex chạy `-a never`. Lệnh bị sandbox chặn thì ghi lại, không xin quyền.
- Không đọc hay in `.env`, khoá, token. Không push, không commit. Không dừng hay khởi động lại server.
- Ghi kết quả vào `tasks/TASK-130-result.md`.
- Sao lưu trước khi sửa: Claude đã chép `D:\Website_3Q_backup_20261103` (bỏ `node_modules` và `.claude\worktrees`).
