Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-135 — Khung Điều hành V2 phủ cột phải

- Dự án: web.
- Người thực hiện: Codex; người kiểm tra độc lập: Claude.
- Trạng thái: `ready_for_review`.
- Hành động gần nhất: triển khai theo spec ngày 03/11/2026, xác định lại vị trí code sau TASK-133/134 và chạy kiểm tra trong sandbox.
- Bước tiếp theo: Claude chạy lại build/test và nghiệm thu trình duyệt theo tiêu chí 1–4; chưa ghi `verified`.

## Thay đổi và file liên quan

1. `Webstie/frontend/src/v2-frame.tsx:5–22`: bỏ state chiều cao, inline height và receiver `baoq-v2-height`; thêm class riêng `ws-v2-frame`. Giữ nguyên URL khởi tạo, đồng bộ route, `onLoad`, bộ nhận view và kiểm tra origin/source.
2. `Webstie/frontend/src/app-v2.css:209–219`: chỉ shell có khung V2 dùng flex cao `100dvh`, có phần dành cho header, band, tabs và padding đáy hiện có. Grid nhận phần còn lại; iframe rộng 100%, cao 100%, tối thiểu 400px. Cột phải có sticky; menu trái có vùng cuộn riêng khi dài. Giữ nguyên tỉ lệ cột và quy tắc tabs dưới 1100px, điều chỉnh padding band dưới 700px theo CSS nền.
3. `Webstie/server/src/v2/mockup/baoq-mockup-v2.html:558–562,1362–1382`: embedded html cao bằng viewport iframe, body được dài theo nội dung; ẩn scrollbar nhưng không đặt overflow hidden cho cuộn thông thường. Sheet mobile dùng `92dvh`, tối đa 100% iframe. Bỏ toàn bộ sender chiều cao, ResizeObserver và listener chỉ phục vụ chiều cao; giữ điều hướng view/route và xác thực origin/source. Chế độ V2 trực tiếp giữ CSS hiện có.
4. `Webstie/frontend/task041.spec.ts:188–274`: thay kỳ vọng height khác 900 bằng phép đo chiều cao bằng phần viewport còn lại sau đệm đáy, tối thiểu 400px. Lý do: chiều cao nay do layout quyết định, không còn nhận từ nội dung. Thêm test resize 1440×1000, 1024×900, 390×844; kiểm tra sheet/scrim, kích thước sheet mobile 92% viewport iframe, đóng bằng Escape và nội dung Thu–bán cuộn tới cuối trong iframe. Giữ các test navigation/history/reload và origin/source đã có.

Không sửa `shared/`, `BossTele/`, `server/src/services/`, Price System hoặc Sale AI. Class riêng giới hạn CSS mới cho V2; không dùng `.ws-frame` chung để thay chiều cao Sale AI. Không thêm dependency, không commit, không chuyển nhánh; bảo toàn thay đổi có sẵn của các task khác. Build đã chạy script copy tài nguyên vào dist theo quy trình hiện có.

## Kiểm tra thực tế

- **Đạt:** `npm.cmd run typecheck` tại `Webstie/frontend` (exit 0).
- **Đạt:** `npx.cmd tsc --noEmit --module esnext --target ES2022 --moduleResolution bundler --jsx react-jsx --lib ES2022,DOM --esModuleInterop --skipLibCheck task041.spec.ts` tại frontend (exit 0); kiểm tra cả kiểu của test trình duyệt.
- **Đạt:** `npx.cmd playwright test -c task041.config.ts --grep 'V2 embeds|V2 short lists' --list` (exit 0), nhận diện đúng 2 test. Đây chỉ là khám phá test, không phải chạy test.
- **Đạt:** dùng `node:vm.Script` phân tích 2 script classic inline trong HTML V2; chỉ kiểm tra cú pháp, không thực thi giao diện.
- **Đạt:** tìm `baoq-v2-height|reportHeight|heightFrame|lastHeight` trong hai file sender/receiver không còn kết quả; kiểm tra diff không có lỗi whitespace.
- **Blocked — build đầy đủ:** `npm.cmd run build` tại `Webstie` (exit 1). Server TypeScript/copy tài nguyên và frontend TypeScript qua; Vite bị chặn khi esbuild spawn tiến trình (`Error: spawn EPERM`). Log: [TASK-135-build.log](TASK-135-build.log).
- **Blocked — test chung:** `npm.cmd test` tại `Webstie` (exit 1), dừng ở 7 file shared do `spawn EPERM`, trước khi chạy các ca kiểm thử. Frontend/server/Sale AI chưa được chạy bởi chuỗi này. Không sửa file thuộc TASK-131 để né lỗi. Log: [TASK-135-test.log](TASK-135-test.log).
- **Blocked — trình duyệt, tiêu chí 1–4:** `npx.cmd playwright test -c task041.config.ts --grep 'V2 embeds|V2 short lists'` tại frontend (exit 1), `Error: spawn EPERM`. Đã thử trước và sau triển khai; chưa có kết quả red/green hoặc ảnh chụp thực tế. Log lần sau: [TASK-135-browser.log](TASK-135-browser.log). Không xin quyền, không cài browser, không dùng mô phỏng thay nghiệm thu.
- **Rà tĩnh giao diện:** Impeccable detector chạy một lần, exit 2 với 19 cảnh báo `cramped-padding` và 1 `side-tab` tại các selector/nội dung cũ trong HTML V2, ngoài thay đổi TASK-135. Không chỉnh thiết kế không liên quan. Log: [TASK-135-ui-check.log](TASK-135-ui-check.log). Đây không phải kiểm tra render.
- Đã có rà soát tĩnh nội bộ bổ sung; chưa có kiểm tra độc lập của Claude và không coi đó là nghiệm thu.

## Giới hạn và bàn giao

Code đã triển khai và kiểm tra kiểu/cú pháp; toàn bộ nghiệm thu giao diện thực tế vẫn **blocked**. Claude cần kiểm tra cảnh báo và nút sát đáy, scrim phủ kín, tất cả trang dài (Tổng quan, Thu–bán, Tồn kho, Chi phí, Hàng hóa, KPI Sale, Chính sách), cuộn chuột/cảm ứng/bàn phím, khóa/phục hồi cuộn khi đóng sheet, resize, menu, Back/Forward và F5. Test mới tự động kiểm một trang dài; không thay cho danh sách nghiệm thu đầy đủ.

Khi header, band, tabs và padding khiến vùng còn lại thấp hơn 400px, vẫn giữ tối thiểu 400px đúng spec; trang ngoài có thể cần cuộn để tới đáy khung. Assertion mới ghi rõ ngoại lệ này, không đòi trang ngoài luôn hết cuộn ở màn hình thấp. Cần xác minh thực tế nhánh này trên điện thoại; chưa khẳng định sticky/sheet hoạt động đúng trong mọi kích thước.
