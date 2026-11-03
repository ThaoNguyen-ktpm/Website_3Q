Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-123 — Review của Claude

- Nội dung: Trang báo "Cannot read properties of null (reading 'status')" sau F5
- Kết luận: **`verified`**
- Ngày: 03/11/2026

## Kiểm chứng

- Claude dựng lại được lỗi trên bản chép (cổng 4598) với `/api/status` trả `job:null`.
- Sau sửa: chạy bản chép (cổng 4599), chờ 8 giây qua nhiều vòng hỏi trạng thái, không còn lỗi. Có test hồi quy trong `background-ui.test.js`.

## Bằng chứng (Claude chạy lại, 03/11/2026 ~10:00, sau mọi sửa của TASK-119…126)

| Lệnh | Kết quả |
|---|---|
| `npm run build` (Webstie) | đạt |
| `npm test` (Webstie) | 465 đạt, 18 bỏ qua (18 ca E2E chỉ chạy khi `SALE_AI_E2E=1`) |
| `node --test` lõi Sale AI | 413/413 |
| `SALE_AI_E2E=1 npx vitest run src/tests/saleAiUpdateAll.test.ts` ×5 | 18/18 cả 5 lần |
| BossTele `npm test` | 140/140 |
| Nạp bản chép dữ liệu thật hiện hành bằng `createSaleAi`, không mạng (`tasks/TASK-126-store-integrity.mjs`) | `LOAD OK products 4476 updates 16 items 7288 runs 7 rows 11115` |
