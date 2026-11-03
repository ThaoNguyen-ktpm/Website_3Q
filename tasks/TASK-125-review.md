Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-125 — Review của Claude

- Nội dung: Món đã đúng giá thì bỏ qua, không báo "Kiot đã thay đổi"
- Kết luận: **`verified`**
- Ngày: 03/11/2026

## Ghi chú

- Lần review đầu (`TASK-126-review.md`) có 4 lỗi của TASK-125: lô vẫn gửi món đã đúng giá, E2E, nhãn nút, tab "Đã đúng giá". Codex đã sửa; lần chạy lại đạt hết.
- Regex câu lỗi `joint-update.test.js:65,67` vẫn kiểm "Kiot đã thay đổi (giá…)" và "bấm Tải lại từ Kiot".
- Chưa thử trên Kiot thật sau sửa.

## Bằng chứng (Claude chạy lại, 03/11/2026 ~10:00, sau mọi sửa của TASK-119…126)

| Lệnh | Kết quả |
|---|---|
| `npm run build` (Webstie) | đạt |
| `npm test` (Webstie) | 465 đạt, 18 bỏ qua (18 ca E2E chỉ chạy khi `SALE_AI_E2E=1`) |
| `node --test` lõi Sale AI | 413/413 |
| `SALE_AI_E2E=1 npx vitest run src/tests/saleAiUpdateAll.test.ts` ×5 | 18/18 cả 5 lần |
| BossTele `npm test` | 140/140 |
| Nạp bản chép dữ liệu thật hiện hành bằng `createSaleAi`, không mạng (`tasks/TASK-126-store-integrity.mjs`) | `LOAD OK products 4476 updates 16 items 7288 runs 7 rows 11115` |
