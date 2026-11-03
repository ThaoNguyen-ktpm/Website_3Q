Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-132: Đưa Điều hành V2 vào khung chính của web, chung menu với chức năng thật

- Dự án: web (`D:\Website_3Q\Webstie`)
- Người phụ trách: Codex (thực hiện), Claude (chạy test, review)
- Trạng thái: `ready`. Làm sau TASK-130 (đã gắn V2 thành trang riêng `/v2/mockup/baoq-mockup-v2.html`, sau đăng nhập, chỉ Admin).

## Yêu cầu của Bảo (03/11/2026)

> "cho phần v2 này vào phần chính lun đi vì phần điều hành củ của tui có mấy chức năng thật"

Hiện V2 mở thành trang riêng, có header, menu và breadcrumb của nó. Các chức năng thật của Điều hành (Nhân viên, Nhật ký, Tài liệu) chỉ có trong khung web cũ. Bảo muốn **một khung Điều hành duy nhất**: V2 nằm trong web và dùng chung menu với các chức năng thật.

## Cách làm (Claude chọn, theo mẫu Sale AI đã chạy ổn)

Nhúng V2 bằng iframe cùng nguồn trong khung Điều hành của web, giống `frontend/src/price-system.tsx`. Ở đó iframe `/sale-ai/` tự chỉnh chiều cao qua `postMessage({type:'baoq-sale-ai-height'})`, và Sale AI có chế độ `embedded`. Không viết lại V2 bằng React trong task này.

## Yêu cầu

1. **Menu Điều hành chung** (`workspace.tsx`, `OpsSide`/`OpsTabs`/`AppSide`, `apps.ts`), với Admin:
   - **Báo cáo:** Tổng quan, Thu–bán, Tồn kho, Kiểm tra, Chi phí, Hàng hóa & hiệu quả vốn, KPI Sale. Đây là các màn của V2, dữ liệu demo hoặc snapshot.
   - **Quản lý:** Nhân viên, Nhật ký, Tài liệu (thật, giữ nhãn "THẬT").
   - **Chưa kết nối nguồn:** các mục của V2 (Tổng quan đối soát, Ký gửi, Tiền & đối chiếu, Chốt kỳ & điều chỉnh, Thiết lập & nguồn), đặt trong nhóm thu gọn như web đang làm.
   - **Khác:** Chính sách, ← Trang chủ.
   - Người không phải Admin chỉ thấy mục Quản lý mà họ có quyền, như hiện tại.
2. **Mỗi màn V2 là một trang của web**, ví dụ `#page=ops&view=dashboard`; Codex chọn tên route và giữ thống nhất. Trang này hiện V2 trong iframe `/v2/mockup/baoq-mockup-v2.html?embed=1#view=<view>`, nằm trong `ops-main`, dưới thanh tiêu đề và breadcrumb của web.
   - Ô "Điều hành" ở trang chủ mở Tổng quan theo route mới, không mở trang V2 riêng nữa.
3. **Chế độ nhúng của V2** (`?embed=1`), sửa tối thiểu trong `server/src/v2/mockup/baoq-mockup-v2.html`, **không** đụng `model.mjs`, `income.mjs`, `engine.js`, `data.js`, chính sách hay tỷ lệ:
   - ẩn header BAOQ LUXURY, nút Menu, VI/EN, breadcrumb và tiêu đề lớn, cột menu trái, footer của V2;
   - giữ phần nội dung, kể cả "Tùy chỉnh tổng quan", "Kỳ dữ liệu", "Vai trò demo" và nhãn "Dữ liệu demo". Các nút này đặt gọn ở đầu nội dung;
   - báo chiều cao cho web bằng `postMessage` cùng nguồn, ví dụ `{type:'baoq-v2-height'}`;
   - liên kết nội bộ của V2 (ví dụ "Xem chi tiết" sang Thu–bán) báo web đổi route, ví dụ `{type:'baoq-v2-view', view}`, để menu web sáng đúng mục và F5 vẫn đúng màn.
   - Mở trực tiếp `/v2/mockup/baoq-mockup-v2.html` (không `embed`) vẫn chạy như TASK-130.
4. **Lỗi dấu tiếng Việt ở tiêu đề serif.** Hiện "Tổng quan điề`u hành", "kế´t quả theo tuầ`n" bị vỡ dấu, cả trên Mac lẫn Windows. Nguyên nhân: `--serif:"Baskerville","Palatino","Georgia",serif` của V2 không có font hỗ trợ dấu chồng tiếng Việt trên Windows.
   - Web đang dùng `"Baskerville","Palatino","Palatino Linotype","Georgia",serif` (`frontend/src/app-v2-base.css:20`).
   - Sửa token font của V2 để dấu hiển thị đúng ở cả chế độ nhúng lẫn trang riêng, ví dụ dùng cùng stack với web. Ghi rõ đã thử trên Windows bằng ảnh chụp.
5. **Bỏ báo cáo demo cũ của web** (`dashboard.tsx`: Tổng quan cũ, Thu–bán, Hàng tồn kho, Kiểm tra, Chi phí bản demo) khỏi menu, vì V2 thay thế.
   - Xoá code không còn dùng nếu xoá an toàn: `dashboard.tsx` phần báo cáo, `simulated-api.ts`, `demo-data.json` nếu không nơi nào khác dùng. `policy.tsx` đang import `demo-data.json`, phải giữ cho Chính sách.
   - Ghi rõ đã xoá gì. Link cũ `#page=overview` (và các trang demo cũ) chuyển sang màn V2 tương ứng.
6. **Không đổi:** đăng nhập, quyền, API thật (Nhân viên, Nhật ký, Tài liệu), Sale AI, Kiot/Sapo, BossTele, route `/v2/` sau đăng nhập và cách phục vụ snapshot KPI của TASK-130.

## Test

- Unit/Playwright frontend: menu Admin có đủ ba nhóm; Manager/STAFF không thấy Báo cáo V2; route V2 hiện iframe đúng `src`; `#page=overview` chuyển đúng; F5 giữ màn.
- V2 `?embed=1`: không có header/menu riêng; gửi `baoq-v2-height`; bấm liên kết nội bộ thì gửi `baoq-v2-view`. Không `embed` thì như cũ.
- Server: test TASK-130 (`v2.test.ts`) vẫn đạt.
- Toàn bộ `npm test` tại `Webstie` chạy hết và đạt, kể cả frontend.

## Lệnh kiểm tra (Claude chạy)

- `npm run build`, `npm test` tại `Webstie`; BossTele `npm test`; lõi Sale AI và E2E nếu đụng server.
- Trình duyệt (Bảo đăng nhập Admin): Điều hành hiện V2 trong khung web, menu chung, tiêu đề đúng dấu, Console không lỗi đỏ.

## Cách làm

- Codex chạy `-a never`. Lệnh bị sandbox chặn thì ghi lại, không xin quyền.
- Không đọc `.env`, khoá, token. Không dừng hay khởi động lại server. Không commit, không push.
- Ghi kết quả vào `tasks/TASK-132-result.md`.
