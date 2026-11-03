Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-113: Sale AI tôn trọng giới hạn gọi API của Sapo (lỗi HTTP 429)

- Dự án: web (Sale AI trong `Webstie/server/src/sale-ai`)
- Người phụ trách: Codex (thực hiện), Claude (chạy test, review)
- Trạng thái: `ready`. **Gấp**: Bảo đang cập nhật giá M1 ngày 02/11/2026.

## Lỗi thật (lượt 09:58 02/11/2026, `joint-v1`)

- "Đã cập nhật thành công 0/64 sản phẩm. Lỗi 64 sản phẩm. Không gửi cập nhật 1250 sản phẩm."
- Mọi món: Kiot `preflight_failed`, Sapo `preflight_failed`, `requestSent:false`. **Không có gì được ghi.**
- Nguyên nhân hiển thị: "Sapo GET: HTTP 429" (Too Many Requests).

## Nguyên nhân (Claude đã đọc code)

- `lib/joint-update.js:28`: bước kiểm tra trước khi ghi gọi `readPool(update.items, …, limit=2)`. Mỗi món đọc song song Kiot (`readProduct`) và Sapo (`sapo.read`), tức khoảng 2 GET Sapo cùng lúc, liên tục, không giãn nhịp.
- `lib/sapo.js` `SapoClient.request`: không giới hạn tốc độ, không đọc header giới hạn, không thử lại khi 429. Sapo API (kiểu leaky bucket như Shopify, thường 40 yêu cầu tồn, xả khoảng 2/giây; Codex kiểm theo tài liệu Sapo và header thực tế) trả 429 sau vài chục yêu cầu.
- 429 khiến `failed=true` (`stopsPlatform` hoặc không `continueOnError`), toàn lượt dừng ở bước kiểm tra. Lỗi Sapo còn gắn sang cả Kiot vì `Promise.all`.
- Quy tắc mã Sapo (`sapoSku = code.split('_')[0]`, `lib/sapo.js:44`) **không liên quan** và đang đúng.

## Yêu cầu

1. **Giới hạn tốc độ dùng chung cho mọi yêu cầu Sapo** của tiến trình (đọc chỉ mục, đọc từng món, PUT ghi, restore):
   - đọc header giới hạn Sapo trả về (ví dụ `X-Sapo-Api-Call-Limit: used/limit`, kiểm đúng tên header thật), giữ nhịp an toàn dưới giới hạn;
   - không có header thì mặc định tối đa ~2 yêu cầu/giây.
2. **GET bị 429:** chờ `Retry-After` (không có thì lùi dần, ví dụ 2s, 4s, 8s), thử lại tối đa 3 lần. Đọc thì thử lại an toàn.
3. **PUT bị 429:** không tự gửi lại mù. Ghi trạng thái lỗi "Sapo quá giới hạn — chưa ghi" cho đúng món đó, để "Cập nhật lại các món lỗi" xử lý sau; tạm nghỉ phía Sapo như `pauseFor` đang làm cho Kiot ở `batch-joint.js`. Các món sau tiếp tục khi hết thời gian nghỉ. Nhịp giới hạn ở mục 1 phải đủ để 429 lúc ghi gần như không xảy ra.
4. **Bước kiểm tra trước khi ghi:** 429 sau khi đã thử lại thì chỉ đánh lỗi món đó, không dừng cả lượt, khi `continueOnError` bật. Lỗi Sapo không gắn sang Kiot nếu đọc Kiot thành công; ghi rõ bên nào lỗi.
5. Giao diện trong lúc chạy hiện "Đang chờ giới hạn Sapo…" khi đang nghỉ. Tiến độ vẫn cập nhật.
6. **Không đổi:** quy tắc giá, logic so sánh dấu vân tay, rollback, quy tắc mã `sapoSku`, `SALE_AI_BATCH`.

## Test (`node --test` qua `core.js` thật + E2E vitest)

- Sapo giả: giới hạn 40 tồn, xả 2/giây, vượt thì trả 429 kèm `Retry-After`. Cập nhật 300 món: không món nào lỗi 429; tổng thời gian tuân theo nhịp (dùng đồng hồ giả).
- Sapo giả trả 429 ngẫu nhiên cho GET: thử lại rồi thành công; quá 3 lần thì chỉ món đó lỗi, các món khác vẫn ghi.
- PUT 429: món đó lỗi "chưa ghi", không gửi lại tự động, lượt tiếp tục.
- E2E `saleAiUpdateAll.test.ts` 14 ca vẫn đạt; thêm ca 429 Sapo nếu hợp lý.

## Cách làm

- Codex chạy `-a never`. Lệnh bị sandbox chặn thì ghi lại, không xin quyền. Claude chạy `npm test`, E2E, `npm run build`.
- Không gọi Sapo/Kiot thật. Không dừng hay khởi động lại server. Không commit. Ghi `tasks/TASK-113-result.md`.

## Sửa thêm sau review (Claude, 02/11/2026 10:20)

Claude chạy ngoài sandbox:
- `npm test` tại `Webstie`: đạt (vitest server 461, lõi Sale AI 297);
- E2E `SALE_AI_E2E=1 npx vitest run src/tests/saleAiUpdateAll.test.ts`: **14 đạt, 1 lỗi**. Ca "5. Kiot rate limit (HTTP 429) on one lot…" (`saleAiUpdateAll.test.ts:164`) **timeout 30.000ms**.

Yêu cầu:
- Tìm vì sao ca 5 chạy quá 30 giây. Khả năng: bộ giãn nhịp Sapo hoặc phần nghỉ sau 429 dùng `setTimeout`/đồng hồ thật, thay vì `service.sleep`/`clock` giả mà fixture E2E truyền vào.
- Mọi chờ đợi mới (giãn nhịp Sapo, nghỉ sau 429, lùi dần) phải dùng `sleep`/`clock` có thể thay trong test, như `batch-joint.js` đang làm.
- Không nới timeout của test để che lỗi.
- Hành vi thật giữ nguyên.
- Claude sẽ chạy lại E2E 15 ca.
