# TASK-134 — Header web dùng lại logo cũ "BAOQ LUXURY" (vàng đồng, không dòng phụ)

- Dự án: web
- Người giao: Claude · Người làm: Codex
- Trạng thái: `ready`
- Hành động gần nhất: Bảo yêu cầu ngày 03/11/2026, gửi ảnh logo ở header Điều hành V2: "lấy cái logo củ này đem qua web của tui".
- Bước tiếp theo: Codex triển khai, ghi `tasks/TASK-134-result.md`, đặt `ready_for_review`.

## Mục tiêu
Logo trên thanh header của web (frontend, cổng 8787) giống logo ở header Điều hành V2: chữ "BAOQ LUXURY" màu vàng đồng trên nền espresso, **không** có dòng "BUY · SELL · CONSIGN". Logo này cắt từ `frontend/public/brand/baoq-logo-original.jpg`. File này giống từng byte với ảnh `--logo` nhúng trong V2, đã kiểm bằng `cmp`.

Hiện tại header dùng `/brand/baoq-wordmark.png` (chữ của trang shop, có dòng phụ) và bị CSS đổi thành màu trắng (`filter:brightness(0) invert(1)`). Bảo chọn kiểu đó ngày 27/10/2026 và nay đổi lại.

## Phạm vi
- `Webstie/frontend/src/app-header.tsx:26` và `Webstie/frontend/src/main.tsx:26`: trong nút `.brand`, thay `<img className="wordmark-img" src="/brand/baoq-wordmark.png" …/>` bằng khung cắt logo gốc theo đúng CSS **đã có** ở `app-v2.css:5-13` (`.wordmark` + `.wordmark img`, có kích thước riêng cho màn dưới 700px):
  `<span className="wordmark"><img src="/brand/baoq-logo-original.jpg" alt="" width="2048" height="2048"/></span>` (hoặc kích thước tương đương). Nút giữ `aria-label="BAOQ Luxury, Trang chủ"` và hành vi bấm như cũ.
- `Webstie/frontend/src/app-v2.css:259-262`: bỏ khối "Bảo 2026-10-27: header logo = the shop site's wordmark…" (`.brand{padding:5px …}`, `.wordmark-img`, media query) để `.brand` về padding gốc của `app-v2-base.css`. Thay comment đó bằng một dòng ghi lý do: "Bảo 2026-11-03: header dùng lại logo gốc cắt bằng CSS (.wordmark), như V2."

## Ngoài phạm vi
- Trang đăng nhập (`login.tsx:31`, logo vuông đầy đủ): giữ nguyên.
- Logo trong menu (`.drawer-logo`), Điều hành V2 (`server/src/v2/**`) và trang shop `D:\HTML`.
- Không xoá `frontend/public/brand/baoq-wordmark.png` (chỉ là file không còn dùng; Bảo có thể đổi lại).
- File đang được Codex khác sửa: TASK-131 (`shared/`, BossTele, `server/src/services`), TASK-133 (`server/src/v2/mockup/…`, `frontend/task041.spec.ts`).

## Tiêu chí nghiệm thu
1. `grep -rn "wordmark-img\|baoq-wordmark" Webstie/frontend/src` không còn kết quả.
2. Mở web khi chưa đăng nhập (trang chào) và khi đã đăng nhập: header hiện "BAOQ LUXURY" màu vàng đồng, không có dòng "BUY · SELL · CONSIGN", không có viền hay ô nền lệch màu quanh chữ, giống header V2. Kiểm ở bề rộng desktop và dưới 700px (chữ nhỏ lại, không bị cắt mất chữ). Bấm logo về Trang chủ. Ghi ảnh chụp hoặc bằng chứng trình duyệt vào result.
3. `npm run build` và `npm test` tại `D:\Website_3Q\Webstie` đạt.
4. Không chạy được trình duyệt trong sandbox thì ghi `blocked` cho mục 2, không thay bằng mô phỏng; Claude sẽ tự kiểm.

## Lệnh kiểm tra
```
cd D:\Website_3Q\Webstie && npm run build && npm test
```

## Vùng code
- **Điểm vào:** `frontend/src/app-header.tsx:26` (`AppHeader`, nút `.brand`), `frontend/src/main.tsx:26` (header trang chưa đăng nhập), `frontend/src/app-v2.css:259-262`.
- **Dùng lại:** `frontend/src/app-v2.css:5-13` (`.wordmark`, `.wordmark img`, media dưới 700px), `frontend/src/app-v2-base.css:64-65` (`.brand`, `.wordmark`).
- **Phạm vi ảnh hưởng:** mọi trang có header. `frontend/qa.spec.ts:116-118` đã chờ sẵn `.wordmark img` (QA chạy tay, không nằm trong `npm test`).
- **Không đụng:** `login.tsx`, `server/src/v2/**`, `shared/**`, `BossTele/**`.

## Điểm còn cần quyết định
Không có.
