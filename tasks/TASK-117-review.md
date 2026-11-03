Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-117: Review của Claude

- Ngày: 02/11/2026
- Kết luận: **verified**

## Bằng chứng (Claude tự chạy, sau TASK-118 + TASK-117)

- `npm run build` tại `Webstie`: đạt.
- `npm test` tại `Webstie`: frontend 3; vitest server 463 pass, 17 skip; lõi Sale AI 331/331.
- E2E `SALE_AI_E2E=1 npx vitest run src/tests/saleAiUpdateAll.test.ts`: 17/17, **5 lần liên tiếp**.
- `npm test` tại `Webstie/BossTele`: 140/140.
- Chạy thật: máy chủ tự khởi động lại trong lúc Codex sửa, để lại khoá cũ ở cả 3 kho. Sale AI mới log "khởi tạo thất bại: Store busy" vài lần, rồi tự "gỡ khoá bỏ lại" và lên bình thường; không còn khoá; bảng v11 còn nguyên.
- TASK-118 dựa trên dữ liệu Sapo thật (GET): `content:null` (533 món) và `price:0` (18 món).

Chưa commit.
