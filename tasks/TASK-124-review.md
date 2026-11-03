Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-124 — Review của Claude

- Nội dung: Kiot từ chối lô (HTTP 420) sau khi đổi sang node:https
- Kết luận: **`verified`**
- Ngày: 03/11/2026

## Kiểm chứng

- `kiotFetch` đặt `Content-Length` bằng `Buffer.byteLength(payload,'utf8')` và bỏ `Transfer-Encoding` (`lib/kiot.js:17`).
- Trên Kiot thật sau sửa: lượt 02/11 15:02 (3/3 `done`) và 15:03 (1.301 `done`), không còn 420.

## Bằng chứng (Claude chạy lại, 03/11/2026 ~10:00, sau mọi sửa của TASK-119…126)

| Lệnh | Kết quả |
|---|---|
| `npm run build` (Webstie) | đạt |
| `npm test` (Webstie) | 465 đạt, 18 bỏ qua (18 ca E2E chỉ chạy khi `SALE_AI_E2E=1`) |
| `node --test` lõi Sale AI | 413/413 |
| `SALE_AI_E2E=1 npx vitest run src/tests/saleAiUpdateAll.test.ts` ×5 | 18/18 cả 5 lần |
| BossTele `npm test` | 140/140 |
| Nạp bản chép dữ liệu thật hiện hành bằng `createSaleAi`, không mạng (`tasks/TASK-126-store-integrity.mjs`) | `LOAD OK products 4476 updates 16 items 7288 runs 7 rows 11115` |
