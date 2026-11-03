Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-119 — Review của Claude

- Nội dung: Chỉ ghi giá Kiot; không ghi mô tả Kiot, không đụng Sapo
- Kết luận: **`verified`**
- Ngày: 03/11/2026

## Đã xem

- Diff `runtime.ts` (`sapoWrite:false`, `kiotDescription:false`), `joint-update.js`, `batch-joint.js`, `batch-update.js`, `restore.js`, `live-ui.js`.
- Lệnh ghi Kiot chỉ gửi `basePrice`. Xác minh sau ghi kiểm tra cả giá lẫn mô tả không đổi. Lượt cũ có Sapo bị chặn hoàn tác tự động, kèm câu "Lượt cũ có Sapo — cần hoàn tác tay".

## Kiểm chứng thật

Lượt 13:37 và 15:03 ngày 02/11 trên Kiot thật: nhãn "Cập nhật giá Kiot", không có platform Sapo, `kiotDescription:false`. Lượt 15:03: 1.301/1.305 món `done`.

## Điểm cần Bảo biết

Món Sapo giá 0 nay vẫn được cập nhật giá Kiot (giả định ở yêu cầu 6 của spec). Bảo chưa phản đối.

## Bằng chứng (Claude chạy lại, 03/11/2026 ~10:00, sau mọi sửa của TASK-119…126)

| Lệnh | Kết quả |
|---|---|
| `npm run build` (Webstie) | đạt |
| `npm test` (Webstie) | 465 đạt, 18 bỏ qua (18 ca E2E chỉ chạy khi `SALE_AI_E2E=1`) |
| `node --test` lõi Sale AI | 413/413 |
| `SALE_AI_E2E=1 npx vitest run src/tests/saleAiUpdateAll.test.ts` ×5 | 18/18 cả 5 lần |
| BossTele `npm test` | 140/140 |
| Nạp bản chép dữ liệu thật hiện hành bằng `createSaleAi`, không mạng (`tasks/TASK-126-store-integrity.mjs`) | `LOAD OK products 4476 updates 16 items 7288 runs 7 rows 11115` |
