# TASK-135 — Khung Điều hành V2 phủ kín cột phải (`.ops-main`), bảng chi tiết cao hết khung

- Dự án: web
- Người giao: Claude · Người làm: Codex
- Trạng thái: `ready`
- Hành động gần nhất: Bảo yêu cầu ngày 03/11/2026, kèm ảnh trang Kiểm tra: "chi tiết cảnh báo đang bị giới hạn theo khung, tui muốn bỏ giới hạn đó… kiểu chia 2/8", rồi "tui muốn phần bên phải được sử dụng full thẻ ops-main này".
- Bước tiếp theo: Codex triển khai **sau khi TASK-133 và TASK-134 xong** (cùng file V2 và `app-v2.css`), ghi `tasks/TASK-135-result.md`, đặt `ready_for_review`.

## Hiện trạng
- Layout chia 2 cột: menu `.ops-side` (khoảng 2 phần) và `.ops-main` (khoảng 8 phần), trong `.ops-layout`.
- Các trang V2 nằm trong `<iframe class="ws-frame">` (`frontend/src/v2-frame.tsx`). Iframe cao theo nội dung: V2 gửi `baoq-v2-height` = chiều cao `#main` (`baoq-mockup-v2.html`, khoảng dòng 1358–1366), và frame nhận giá trị đó trong khoảng 400–200000px.
- Bảng chi tiết (`.sheet`, `position:fixed; top:0; bottom:0`) và lớp mờ (`.scrim`, `inset:0`) nằm **trong** iframe, nên chỉ cao bằng iframe. Trang có ít dữ liệu (vd Kiểm tra: iframe khoảng 559px) thì bảng chi tiết bị kẹp thấp và phải cuộn trong khung nhỏ, phần dưới `.ops-main` để trống.

## Mục tiêu
Trên các trang V2 trong web, iframe chiếm **toàn bộ vùng `.ops-main` nhìn thấy được**: rộng hết cột phải, cao từ mép trên khung tới đáy cửa sổ trình duyệt. Mở chi tiết cảnh báo hay bản ghi thì `.sheet` cao hết khung đó và lớp mờ phủ kín khung, kể cả khi danh sách ngắn.

## Yêu cầu
1. Chiều cao iframe = phần cửa sổ còn lại tính từ mép trên iframe tới đáy cửa sổ (trừ header sticky `--header-h` và khoảng đệm đáy hiện có), tối thiểu 400px. Tính lại khi đổi cỡ cửa sổ. Dùng `dvh` hoặc tính bằng JS đều được; chọn cách ngắn và đúng trên cả điện thoại.
2. Nội dung V2 dài hơn khung thì **cuộn bên trong iframe**, không kéo dài iframe nữa. Bỏ hoặc thôi dùng cơ chế `baoq-v2-height` cho chiều cao. Nếu xoá phần gửi chiều cao trong V2 thì xoá luôn phần nhận trong `v2-frame.tsx`, không để code chết.
   - `html.embedded, html.embedded body{min-height:0;height:auto}` (V2 khoảng dòng 558) phải đổi để trang nhúng cuộn được trong iframe.
   - Thanh cuộn vẫn theo quy tắc ẩn thanh cuộn của Bảo ngày 27/10 (`app-v2.css`, "no visible scrollbars"). Trang nhúng cũng ẩn thanh cuộn nhưng vẫn cuộn được bằng chuột, cảm ứng và bàn phím.
3. Iframe nằm yên khi cuộn trang ngoài. Gợi ý: `position:sticky; top:var(--header-h)` hoặc để `.ops-layout` cao đúng một màn hình. Chọn cách không tạo hai thanh cuộn lồng nhau cho cùng một nội dung.
4. Giữ nguyên: điều hướng `baoq-v2-route`/`baoq-v2-view`, kiểm tra origin/source của message, URL `#page=v2-…`, Back/Forward, phân quyền Admin.
5. Dưới 700px (layout 1 cột): iframe vẫn cao hết phần màn hình còn lại dưới header. `.sheet` trên điện thoại (`height:92vh`, trượt từ dưới lên) phải nằm trong iframe và không bị cắt.
6. Khung Sale AI ở trang Price System (`price-system.tsx`, `baoq-sale-ai-height`) **không đổi** trong task này.

## Ngoài phạm vi
- Thay `.sheet` bằng cột chi tiết cố định cạnh danh sách, hoặc đổi tỉ lệ cột menu/nội dung.
- Nội dung, số liệu, nhãn trong V2. TASK-133 (bỏ ô vai trò demo) và TASK-134 (logo) đã xử lý riêng.
- `shared/`, BossTele, `server/src/services` (TASK-131).

## Tiêu chí nghiệm thu
1. Đăng nhập Admin, mở Điều hành → Kiểm tra (`#page=v2-checks`), bấm một cảnh báo: bảng "Chi tiết cảnh báo" cao từ mép trên tới đáy vùng nội dung bên phải, nút "Mở bản ghi liên quan / Xem tất cả cảnh báo" nằm sát đáy cửa sổ. Không còn khoảng trắng bên dưới khung. Lớp mờ phủ kín cột phải.
2. Tổng quan, Thu–bán, Tồn kho, Chi phí, Hàng hóa & hiệu quả vốn, KPI Sale và Chính sách: nội dung dài cuộn được trong khung và cuộn tới cuối được. Không có hai thanh cuộn cho cùng một nội dung. Menu trái và header vẫn dùng được.
3. Đổi cỡ cửa sổ (desktop và dưới 700px): khung tự cao lại theo cửa sổ.
4. Điều hướng: bấm mục menu trái, tab trong V2, Back/Forward và F5 đều mở đúng màn như trước.
5. `npm run build` và `npm test` tại `D:\Website_3Q\Webstie` đạt. `frontend/task041.spec.ts` đang kiểm chiều cao frame khác 900 (khoảng dòng 203). Nếu kỳ vọng đó không còn đúng thì đổi thành kiểm iframe cao bằng vùng nhìn thấy, và ghi lý do trong result.
6. Không chạy được trình duyệt trong sandbox thì ghi `blocked` cho mục 1–4, không thay bằng mô phỏng; Claude sẽ tự kiểm.

## Lệnh kiểm tra
```
cd D:\Website_3Q\Webstie && npm run build && npm test
```

## Vùng code
- **Điểm vào:** `frontend/src/v2-frame.tsx` (`V2Frame`, state `height`, bộ nhận message), `frontend/src/app-v2.css:208` (`.ws-frame`), `frontend/src/app-v2-base.css:282` và `app-v2.css:253,299` (`.ops-layout`), `server/src/v2/mockup/baoq-mockup-v2.html`: CSS `html.embedded` (khoảng 558–567), `.sheet`/`.scrim` (khoảng 189–229), script nhúng gửi chiều cao (khoảng 1358–1366).
- **Phạm vi ảnh hưởng:** mọi trang `#page=v2-*` (danh sách trong `frontend/src/apps.ts`). Build server chép V2 sang `dist/v2/mockup/` qua `scripts/copy-v2.mjs`.
- **Test liên quan:** `frontend/task041.spec.ts` (khoảng dòng 190–210).
- **Không đụng:** `frontend/src/price-system.tsx`, `server/src/sale-ai/**`, `shared/**`, `BossTele/**`.

## Điểm còn cần quyết định
Không có.
