Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-115: Sale AI bỏ hẳn hàng giá gốc từ 600 triệu

- Dự án: web (Sale AI trong `Webstie/server/src/sale-ai`) + BossTele
- Người phụ trách: Codex (thực hiện), Claude (chạy test, review)
- Trạng thái: `ready`. Gấp: Bảo chờ cập nhật giá M1 hôm nay (02/11/2026). **Làm trước TASK-114, trong cùng lượt.**
- Bảo: "bỏ nó ra luôn đi, không cần bỏ vào Sale AI 600 triệu trở lên".

## Hiện trạng

- `lib/pricing.js` `calculate()`: `p0 >= 600e6` thì cần `manualPricing` (giá tay duyệt riêng). Không có thì trả `waiting` "Chờ nhập giá duyệt riêng".
- Bảng 02/11 có 3 món như vậy (SP024860_17102026 640tr, SP023821_12092026 920tr, SP022266 650tr). Chúng nằm trong bảng và làm "Cập nhật lại các món lỗi" báo "3 món không đủ điều kiện".

## Yêu cầu

1. Món có **P0 ≥ 600.000.000đ không vào bảng Sale AI**, giống cách TASK-109 ẩn hàng tạo trước 01/07/2026:
   - `calculate()` trả loại trừ với mã lý do rõ ràng (ví dụ `excludedReason:'over_600m'`), lý do "Giá gốc từ 600 triệu: không giảm";
   - bảng không chứa các dòng này; dòng tóm tắt thêm: "Đã ẩn N món từ 600 triệu (không giảm)";
   - không đưa vào lượt cập nhật hay "Cập nhật lại các món lỗi"; không ghi gì lên Kiot/Sapo cho các món này.
2. Phần **giá tay duyệt riêng** (`manualPricing`, `lib/manual-pricing.js`, API/giao diện nhập giá tay) không còn dùng:
   - bỏ đường nhập giá tay khỏi giao diện;
   - giữ dữ liệu `manualPricing` cũ trong kho (không xoá, không migration);
   - code không còn ai gọi thì xoá kèm test riêng của nó; ghi bằng chứng.
3. Đổi `POLICY` sang tên mới (ví dụ `baoq-2026-11-02-hide-600m-v11`) để bảng tự tạo lại khi mở trang. Cập nhật mọi test so khớp chuỗi `POLICY`, kể cả `BossTele/test/sale-price.test.js`.
4. BossTele (`BossTele/sale-price.js`): hỏi giá sale món ≥ 600 triệu thì trả "không giảm (giá gốc từ 600 triệu)", không báo lỗi.
5. **Không đổi:** quy tắc bậc M của các món khác (TASK-105, TASK-109), logic ghi giá, rollback, giới hạn Sapo (TASK-113).

## Test

- `calculate()` với P0 599.999.999 (tính như thường) và 600.000.000 (bị loại, mã `over_600m`).
- Bảng từ danh mục giả có món 650tr: không có dòng; số "đã ẩn từ 600 triệu" = 1.
- `retry-selection` không tính món ≥600tr là "không đủ điều kiện" (vì đã không có trong lượt mới).
- BossTele: mã ≥600tr trả "không giảm".
- E2E `saleAiUpdateAll.test.ts`: ca "12. products from 600 million without an approved price are not sent" đổi sang ý nghĩa mới (món ≥600tr không có trong bảng, không gửi); các ca khác giữ nguyên.

## Cách làm

- Codex chạy `-a never`. Lệnh bị sandbox chặn thì ghi lại, không xin quyền. Claude chạy `npm test`, E2E, `npm run build`, `npm test` BossTele.
- Không gọi Kiot/Sapo thật. Không dừng hay khởi động lại server. Không commit. Ghi `tasks/TASK-115-result.md`.
- Xong TASK-115 thì làm tiếp **TASK-114** (`tasks/TASK-114-spec.md`) trong cùng lượt; ghi `tasks/TASK-114-result.md`.
