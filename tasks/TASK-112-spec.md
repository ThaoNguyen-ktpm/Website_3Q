# TASK-112: Sửa bộ test E2E Sale AI (14 ca lỗi 409 sau TASK-108)

- Dự án: web (Sale AI)
- Người phụ trách: Codex (thực hiện), Claude (chạy test, review)
- Trạng thái: `ready`. Gấp: Bảo cần cập nhật giá M1 hôm nay (02/11/2026).

## Lỗi

`SALE_AI_E2E=1 npx vitest run src/tests/saleAiUpdateAll.test.ts` (tại `Webstie/server`): **14/14 lỗi**, cùng chỗ `loadTable` (dòng ~97), bước `POST /api/kiot/refresh` trả **409** thay vì 200. Ngày 30/10 (review TASK-104) bộ này còn đạt 14/14.

Nguyên nhân Claude đoán (Codex xác nhận):
- TASK-108 thêm `readSapoOnStartup` trong `core.js`: khi tạo lõi, nếu Sapo có khoá mà chưa sẵn sàng, lõi tự đọc chỉ mục Sapo ở nền qua `perform()`, giữ khoá `operationBusy`.
- Fixture E2E (`createSaleAi({... fixture:true})`) gọi refresh ngay, nên đụng khoá và nhận 409 "Đang xử lý một lượt khác, vui lòng chờ" (`core.js:56`).

## Yêu cầu

1. Xác nhận nguyên nhân. Sửa để bộ E2E chạy lại đúng ý nghĩa cũ (14 ca), cách gọn nhất, ví dụ:
   - lõi trả về promise của lần đọc Sapo lúc khởi động (`sale.startupSapoRead` hoặc tương tự), fixture `await` nó trước khi chạy ca;
   - **hoặc** fixture tắt đọc lúc khởi động bằng tuỳ chọn rõ ràng (ví dụ `readSapoOnStartup:false`), và giữ một test riêng cho hành vi đọc lúc khởi động.
   - **Không** sửa assertion của 14 ca để chấp nhận 409.
2. Nếu đúng là trong vài giây đầu sau khởi động, bấm "Tải lại từ Kiot" bị 409: ghi rõ trong kết quả. Không đổi hành vi thật trong task này, trừ khi sửa rất nhỏ và an toàn (ví dụ refresh chờ lượt đọc Sapo khởi động xong thay vì báo 409); khi đó thêm test.
3. Không đổi logic ghi giá, rollback, quy tắc giá.

## Kiểm tra

Codex chạy `-a never`; lệnh bị sandbox chặn thì ghi lại. Claude sẽ chạy:
- `SALE_AI_E2E=1 npx vitest run src/tests/saleAiUpdateAll.test.ts`: 14/14;
- `npm test` tại `Webstie`.

Không commit. Không dừng hay khởi động lại server đang chạy. Ghi `tasks/TASK-112-result.md`.
