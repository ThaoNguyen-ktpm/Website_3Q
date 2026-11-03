Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-120 — Review của Claude

- Nội dung: Ghi giá Kiot theo lô 50 món; món chưa gửi khi dừng là "chưa gửi"
- Kết luận: **`verified`**
- Ngày: 03/11/2026

## Kiểm chứng thật

- Lô đầu ngày 02/11 13:49: 50 món `done` qua `PUT /listupdatedproducts`.
- Log máy chủ 15:03: PUT lô 698–765 ms, `listModified` 346–445 ms.
- Dừng lượt 13:37 giữa chừng: sau khi khởi động lại, 912 món thành `not_sent`, không phải `unknown`.

## Bằng chứng (Claude chạy lại, 03/11/2026 ~10:00, sau mọi sửa của TASK-119…126)

| Lệnh | Kết quả |
|---|---|
| `npm run build` (Webstie) | đạt |
| `npm test` (Webstie) | 465 đạt, 18 bỏ qua (18 ca E2E chỉ chạy khi `SALE_AI_E2E=1`) |
| `node --test` lõi Sale AI | 413/413 |
| `SALE_AI_E2E=1 npx vitest run src/tests/saleAiUpdateAll.test.ts` ×5 | 18/18 cả 5 lần |
| BossTele `npm test` | 140/140 |
| Nạp bản chép dữ liệu thật hiện hành bằng `createSaleAi`, không mạng (`tasks/TASK-126-store-integrity.mjs`) | `LOAD OK products 4476 updates 16 items 7288 runs 7 rows 11115` |
