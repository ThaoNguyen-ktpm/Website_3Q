# TASK-136 — V2 trong web chạy như trang thường: bỏ ô, khung chi tiết phủ cả cửa sổ

- Dự án: web
- Người giao: Claude · Người làm: Codex
- Trạng thái: `ready`
- Thay cho: TASK-135. TASK-135 làm khung V2 cao một màn hình và cuộn bên trong, đi ngược ý Bảo.
- Hành động gần nhất: ngày 03/11/2026 Bảo gửi 3 ảnh. Ảnh 1–2 là V2 mở trực tiếp (`/v2/mockup/baoq-mockup-v2.html#view=checks&alert=DEMO-E01`): khung "Chi tiết cảnh báo" cao từ mép trên tới đáy cửa sổ, cả trang phía sau bị mờ. Ảnh 3 là web hiện tại: V2 bị nhốt trong ô bo góc, biểu đồ bị cắt, phải cuộn trong ô. Bảo xác nhận cách hiểu bên dưới ("ok làm đi").
- Bước tiếp theo: Codex triển khai, ghi `tasks/TASK-136-result.md`, đặt `ready_for_review`.

## Mục tiêu
Trong web (`#page=v2-*`), V2 trông và chạy như khi mở trực tiếp:
1. **Không còn ô:** nội dung V2 dài bao nhiêu hiện bấy nhiêu ngay trong cột phải, không viền, không bo góc, không thanh cuộn riêng. Cả trang web cuộn chung như một trang bình thường.
2. **Lớp phủ cấp cửa sổ:** mở khung chi tiết cảnh báo (`alert`), chi tiết bản ghi (`record`), chi tiết món hàng (`item`) hoặc việc (`task`) thì:
   - Khung chi tiết nằm sát phải, cao từ mép trên tới đáy **cửa sổ trình duyệt**, không phải đáy iframe. Trên điện thoại vẫn trượt từ dưới lên, 92% chiều cao cửa sổ.
   - Khung hộp giữa (`.dialog`) nằm giữa **cửa sổ**.
   - **Toàn bộ web** phía sau (header web, band tiêu đề, tab, menu trái, nội dung V2) bị phủ tối và làm mờ như ảnh 1–2.
   - Trang phía sau không cuộn được khi lớp phủ đang mở. Đóng bằng nút X, Esc, bấm vùng mờ hoặc Back thì về đúng chỗ đang xem, không nhảy vị trí cuộn.

## Yêu cầu
1. **Chiều cao theo nội dung:** khôi phục cơ chế iframe cao theo nội dung (`baoq-v2-height` gửi chiều cao `#main` của V2, `V2Frame` nhận trong khoảng 400–200000px, giữ kiểm tra origin/source) hoặc cơ chế tương đương. Bỏ CSS của TASK-135 khiến `#main`/`.ops-layout`/`.ops-main` cao `100dvh` và iframe cuộn bên trong (`frontend/src/app-v2.css`, khoảng dòng 209–219). Bỏ CSS `html.embedded` của TASK-135 làm trang nhúng cuộn bên trong (V2, khoảng dòng 558–562). Iframe V2 (`.ws-v2-frame`) không viền, không bo góc, nền trùng nền trang.
2. **Lớp phủ:** dùng chính bảng chi tiết hiện có của V2 (`syncLayer`, `alertSheet`, `taskSheet`, `recordDialog`, `itemDialog`). **Không** dựng lại nội dung chi tiết trong React, **không** mở iframe thứ hai giữ trạng thái riêng, vì dữ liệu việc (`store.tasks`) chỉ nằm trong bộ nhớ của trang V2. Cách gợi ý (Codex được chọn cách khác đạt cùng tiêu chí):
   - V2 ở chế độ nhúng gửi `{type:'baoq-v2-overlay', open:true|false}` lên trang cha mỗi khi `overlay` (task/record/item/alert) mở hoặc đóng. Không gửi cho menu `drawer` (đã ẩn khi nhúng).
   - Trang cha nhận (kiểm origin và source như các message khác) thì đặt iframe thành `position:fixed; inset:0; width:100vw; height:100dvh` với `z-index` trên header web và các nút nổi (chat, Telegram). Đồng thời khoá cuộn trang cha và làm mờ, phủ tối các phần web không chứa iframe (header, band, tab, menu trái), vì `backdrop-filter` trong iframe không làm mờ được trang cha.
   - Trong iframe lúc đó: nền trong suốt, `#main` giữ đúng vị trí và bề rộng như trước khi phóng to (trang cha gửi toạ độ khung cũ), để nội dung V2 phía sau không nhảy chỗ. `.scrim` của V2 phủ cả cửa sổ.
   - Đóng thì trả iframe về chỗ cũ và cuộn trang cha về đúng vị trí trước khi mở.
3. **Bàn phím và trợ năng:** khi mở, focus vào tiêu đề khung (như hiện tại). Tab chỉ chạy trong khung chi tiết. Phần web phía sau `inert` hoặc tương đương. Esc đóng. Đóng xong focus trả về đúng nút đã mở.
4. **Điều hướng giữ nguyên:** `baoq-v2-route`/`baoq-v2-view`, URL `#page=v2-…&alert=…` (mở link sâu thẳng vào cảnh báo cũng hiện lớp phủ cấp cửa sổ), Back/Forward, F5, phân quyền Admin.
5. **Lỗi lịch sử cần sửa luôn:** test `task041.spec.ts` "V2 embeds without duplicate shell… survives reload and history" đang hỏng, lặp lại ổn định (Claude chạy 3 lần ngày 03/11/2026): sau khi đang ở `#page=v2-tx` mà F5, bấm Back vẫn đứng ở `#page=v2-tx` thay vì về `#page=v2-dashboard`. Chưa rõ lỗi có từ TASK-132 hay do TASK-135. Tìm nguyên nhân gốc và sửa; không nới test.
6. Khung Sale AI (`price-system.tsx`) và V2 mở trực tiếp (không `embed=1`) không đổi.

## Ngoài phạm vi
- Nội dung, số liệu, nhãn trong V2. Logo (TASK-134) và ô vai trò demo (TASK-133) đã xong.
- `shared/`, BossTele, `server/src/services` (TASK-131).

## Tiêu chí nghiệm thu
1. Đăng nhập Admin, mở `#page=v2-checks`, bấm một cảnh báo:
   - Khung chi tiết cao từ mép trên tới đáy cửa sổ, sát phải.
   - Header web, band, tab, menu trái và danh sách đều bị phủ tối và mờ. Nút chat/Telegram nằm dưới lớp phủ hoặc bị ẩn.
   - Trang sau không cuộn được.
   - Đóng bằng X, Esc, bấm vùng mờ và Back đều về đúng chỗ cũ.
   
   Làm tương tự với Thu–bán (`record`), Tồn kho (`item`) và mở link sâu `#page=v2-checks&alert=DEMO-E01` sau F5.
2. Tổng quan và Thu–bán: không còn ô bo góc; biểu đồ và bảng hiện hết, cuộn bằng thanh cuộn của trang web, không có thanh cuộn thứ hai bên trong.
3. Kích thước 1440×1000, 1024×900 và 390×844 đều đạt mục 1–2. Ở 390 không có cuộn ngang.
4. Toàn bộ `npx playwright test -c task041.config.ts` tại `Webstie/frontend` đạt, gồm test lịch sử ở yêu cầu 5. Thay hai test TASK-135 (ô cao một màn hình, cuộn trong khung) bằng test cho hành vi mới: khung chi tiết cao bằng cửa sổ, iframe cao theo nội dung, trang cha bị khoá cuộn khi mở. Ghi lý do đổi test trong result.
5. `npm run build` và `npm test` tại `D:\Website_3Q\Webstie` đạt.
6. Sandbox chặn chạy test hoặc trình duyệt thì ghi `blocked`, không xin quyền; Claude sẽ tự chạy.

## Lệnh kiểm tra
```
cd D:\Website_3Q\Webstie && npm run build && npm test
cd D:\Website_3Q\Webstie\frontend && npx playwright test -c task041.config.ts
```

## Vùng code
- **Điểm vào:**
  - `frontend/src/v2-frame.tsx` (`V2Frame`: bộ nhận message, style iframe)
  - `frontend/src/app-v2.css` (khoảng 208–219: `.ws-frame`, `.ws-v2-frame`, các luật `:has(.ws-v2-frame)` của TASK-135)
  - `server/src/v2/mockup/baoq-mockup-v2.html`:
    - `html.embedded` (khoảng 558–567)
    - `.scrim`, `.sheet`, `.dialog` (khoảng 189–250)
    - `lockPage` (1238), `syncLayer` (khoảng 1245–1256), `closeLayer`
    - script nhúng (khoảng 1358–1385)
- **Phạm vi ảnh hưởng:** mọi trang `#page=v2-*` (`frontend/src/apps.ts`). `frontend/src/workspace.tsx` dựng `.ops-layout` và header. `scripts/copy-v2.mjs` chép V2 vào `dist` khi build.
- **Test liên quan:** `frontend/task041.spec.ts` (khoảng 180–280; hàm `expectV2Viewport` của TASK-135 cần thay).
- **Không đụng:** `frontend/src/price-system.tsx`, `server/src/sale-ai/**`, `shared/**`, `BossTele/**`.

## Điểm còn cần quyết định
Không có.
