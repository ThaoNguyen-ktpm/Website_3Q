Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-138: Bỏ lớp chặn "chỉ Laptop" của tự động cập nhật giá

- Dự án: web (Sale AI)
- Người phụ trách: Codex (thực hiện), Claude (chạy test, review)
- Trạng thái: `ready`. Làm trên nền TASK-137 (đã `verified`).

## Yêu cầu của Bảo (04/11/2026)

> "sao nút này bị chặn và báo chỉ laptop thôi z bỏ cái chặn đó đi"

Ảnh: dòng "Máy này không chạy lịch (chỉ Laptop)", công tắc và "Đổi giờ" bị khoá, vì máy chưa có `SALE_AI_AUTO_UPDATE=1`.

## Yêu cầu

1. Bỏ điều kiện biến môi trường `SALE_AI_AUTO_UPDATE` (`runtime.ts` truyền `autoUpdateAllowed`, `core.js`, `lib/auto-update.js`). Mọi máy chạy Sale AI đều bật/tắt và đổi giờ được trên giao diện. Lịch chạy khi và chỉ khi công tắc trong kho của máy đó là **Bật**.
2. Cài đặt vẫn **mặc định Tắt, 10:00**. Không có lệnh nào tự bật thay Bảo.
3. Giao diện:
   - bỏ trạng thái "Máy này không chạy lịch (chỉ Laptop)" và việc khoá công tắc / "Đổi giờ";
   - bỏ chữ "Máy: Laptop" cố định. Nếu cần hiện máy thì dùng tên máy thật (`os.hostname()`), ví dụ "Máy: DESKTOP-4G5GOSR";
   - khung xác nhận khi Bật thêm một câu ngắn: "Chỉ bật trên một máy để tránh ghi Kiot hai lần."
4. Bỏ code và test chỉ dành cho lớp chặn. Cập nhật test còn lại theo hành vi mới, không nới các kiểm tra khác: lịch, cửa sổ 5 phút, Chủ nhật, M0, giữ giá sửa tay, ngưỡng 2.000, API cài đặt.
5. Cập nhật `server/src/sale-ai/AUTO-UPDATE.md`: không cần sửa `.env`; bật trên trang; chỉ bật một máy.
6. Không đổi gì khác của TASK-137.

## Lệnh kiểm tra (Claude chạy)

`npm run build`, `npm test`, `node --test` lõi Sale AI, E2E 5 lần, BossTele `npm test`.

## Cách làm

- Codex chạy `-a never`. Không gọi Kiot/Sapo thật. Không đọc hay sửa `.env`. Không bật lịch. Không restart server. Không commit.
- Ghi kết quả vào `tasks/TASK-138-result.md`.
