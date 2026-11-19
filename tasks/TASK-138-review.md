Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-138 — Review của Claude

- Nội dung: bỏ lớp chặn "chỉ Laptop" (`SALE_AI_AUTO_UPDATE`) của tự động cập nhật giá.
- Kết luận: **`verified`**
- Ngày: 04/11/2026

## Đã xem

- Code chạy (`server/src`, không tính test) không còn `SALE_AI_AUTO_UPDATE`, `autoUpdateAllowed`, "chỉ Laptop", "Máy: Laptop". Cài đặt vẫn mặc định Tắt, 10:00. Kho thật chưa có `auto-update.json`, tức chưa bật.

## Bằng chứng

| Lệnh | Kết quả |
|---|---|
| `npm run build` | đạt |
| `npm test` (Webstie) | frontend 6, server 491 đạt / 18 bỏ qua, `test:sale-ai` đạt |
| `node --test` lõi Sale AI | 432/432 |
| E2E ×5 | 18/18 cả 5 lần |
| BossTele | 112/112 |

## Giới hạn

- Hai máy đều bật được. Chỉ bật một máy (đã ghi trong câu xác nhận và `AUTO-UPDATE.md`).
- Chưa chạy lịch thật trên Kiot.
