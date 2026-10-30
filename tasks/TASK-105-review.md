# TASK-105: Review của Claude

- Ngày: 29/10/2026
- Kết luận: **verified**

## Phạm vi đã xem

- `D:\BaoQ-AI\lib\pricing.js`: hằng mới `NO_MARKDOWN_BEFORE`, `BATCH_FROM`, `BATCH_TO`, `BATCH_M1`; `ageFields()`; điều kiện loại trừ trong `calculate()`; `POLICY = 'baoq-2026-10-29-jul-batch-v9'`.
- Bản sao TASK-104 `Webstie/server/src/sale-ai/lib/pricing.js`: SHA-256 trùng bản gốc (`372828bac67453cecd73…`).
- `TASK-105-result.md` của Codex.

## Bằng chứng

- **12 ví dụ nghiệm thu** chạy với `calculate()` thật (P0 30 triệu): cả 12 đúng.
  - Nhóm A, tạo trước 01/07: trả `excluded`, lý do "Hàng tạo trước 01/07/2026: không giảm".
  - Nhóm B, tạo 01/07–15/10: M0 tới 31/10, M1 ngày 01/11, M2 ngày 16/11, M5 ngày 31/12, M6 tối đa; hàng hot tính như hàng thường.
  - Nhóm C, tạo từ 16/10: giữ quy tắc cũ (tạo 16/10 lên M1 ngày 31/10; hàng hot giữ M0 45 ngày).
  - Mức giảm và quyền sale theo bảng cũ: M1 29,2 triệu / 1,46 triệu; M5 25,4 triệu / 0.
- `node --test *.test.js` tại `D:\BaoQ-AI`: **271/271 qua** (Claude tự chạy).
- `npm test` tại `Webstie/BossTele`: **130/130 qua** (Claude tự chạy).
- Đã khởi động lại `npm run dev` (tab "web 3Q dev"). Sale AI cổng 4310 chạy bằng tiến trình mới (PID 22164), đã nạp `pricing.js` mới.

## Lưu ý

- Hàng giá tay (P0 ≥ 600 triệu) tạo trước 01/07 cũng bị loại (không giảm). Khớp ý "không giảm nữa".
- Bản sao TASK-104: Codex báo 272/273, 1 lỗi `split-store` có cả với công thức cũ v8. Lỗi này thuộc phạm vi TASK-104, không do TASK-105; sẽ xem khi review TASK-104.
- Không ghi Kiot/Sapo thật. Chưa commit.
