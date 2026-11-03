Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-129 — Review

- Dự án: web + BossTele
- Người review: Claude
- Trạng thái: `verified` (tiêu chí 1–6 bằng test). Chưa thử tay trên giao diện và Telegram.
- Hành động gần nhất: 03/11/2026, Claude đọc result và code, tự chạy build/test ngoài sandbox, khởi động lại `npm run dev`.
- Bước tiếp theo: Bảo thử trên web và Telegram; Bảo xác nhận giả định SKU hết hàng vẫn hiện thẻ.

## Phạm vi đã xem

- `server/src/services/assistant/router.ts`: mặc định `inStock = !/\bhet hang\b/` cho câu tra danh sách; SKU giữ `false`.
- `server/src/services/assistant/graph.ts` (`lookupAnswer`):
  - trang đầu không có món còn thì gọi lại đúng truy vấn với `in_stock: false` để đếm, trả câu "… nhưng đều đã hết hàng", không thẻ;
  - tiêu đề "còn hàng";
  - SKU tồn ≤ 0 thì câu "<SKU> đã hết hàng." và giữ thẻ.
- `BossTele/telegram-bot.js`: thêm 1 dòng `SYSTEM` (mặc định `--in-stock`).
- Test: `assistantRouter.test.ts`, `assistantBrands.test.ts` (đổi kỳ vọng tiêu đề "còn hàng", đúng đặc tả), `assistantStock.test.ts` (mới).

## Bằng chứng (Claude tự chạy, 03/11/2026)

| Lệnh | Kết quả |
|---|---|
| `npm run build` tại `Webstie/` | Đạt |
| `npm test` tại `Webstie/` | shared 28/28; Vitest 31 file, 484 đạt, 18 bỏ qua (trước 465, thêm 19); Sale AI 413/413 |
| `npm test` tại `Webstie/BossTele` | 112/112 |

## Nhận xét

- Đúng đặc tả. Không đổi bộ lọc tồn (`onHand ?? 0 > 0`), món cọc có tồn > 0 vẫn hiện.
- Nhánh đếm "câu hỏi số lượng" của bot (bỏ phần "(hiện N món…)") vẫn đúng với tiêu đề mới; câu trả lời số lượng giờ thành "Có N sản phẩm … còn hàng."
- Không có lỗi cần trả lại.

## Giới hạn

Chưa thử bằng tay trên khung trợ lý web (trình duyệt của Claude chưa đăng nhập) và trên Telegram.
