Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-117: Sale AI tự gỡ khoá ghi bị bỏ lại; báo rõ lỗi khởi tạo; sửa E2E ca 14 chập chờn

- Dự án: web (Sale AI)
- Người phụ trách: Codex (thực hiện), Claude (chạy test, review)
- Trạng thái: `ready`. **Giao sau khi Bảo cập nhật M1 xong ngày 02/11/2026** (sửa code làm máy chủ tự khởi động lại).

## Sự cố 02/11/2026 11:22

- Máy chủ tự khởi động lại (`tsx watch`) để nạp code TASK-116, đúng lúc tiến trình cũ đang ghi kho. Tiến trình cũ bị tắt, để lại thư mục khoá rỗng `server/data/sale-ai/kiot-state.store/.write-lock` (11:22:21).
- Tiến trình mới (11:22:22) khởi tạo Sale AI → `store-cleanup.applyPlan` → `acquireMaintenanceLock` → "Store busy: writer/maintenance lock exists".
- `runtime.ts` `startSaleAi()` nuốt lỗi, chỉ in "Sale AI: khởi tạo thất bại; kiểm tra kho dữ liệu và cấu hình." và **không thử lại**. Trang báo "Sale AI tạm thời không khả dụng" mãi.
- Claude đã gỡ tay khoá rỗng (sau khi xác nhận không còn tiến trình giữ) và khởi động lại; Sale AI chạy lại bình thường.

## Yêu cầu

1. **Khoá có chủ** (`lib/store-lock.js`): khi tạo `.write-lock` / `.maintenance-lock`, ghi kèm thông tin chủ (PID, thời điểm, mã tiến trình khởi động).
   - Khi gặp khoá có sẵn: nếu PID chủ **không còn chạy** (hoặc khoá cũ không có thông tin chủ và tồn tại quá X phút, ví dụ 10 phút) thì coi là khoá bỏ lại → ghi log rõ, gỡ, tiếp tục.
   - PID còn chạy thì giữ hành vi chờ/từ chối như cũ.
   - Không bao giờ gỡ khoá đang có tiến trình sống giữ.
2. **Báo lỗi khởi tạo rõ ràng** (`runtime.ts`): log lý do thật (không in khoá bí mật). Trạng thái 503 của trang kèm câu ngắn dễ hiểu (ví dụ "Kho Sale AI đang bị khoá — đang thử lại"). **Tự thử lại** khởi tạo theo chu kỳ (ví dụ 15 giây), không cần khởi động lại máy chủ.
3. **Tắt êm** khi máy chủ dừng (SIGINT/SIGTERM, khởi động lại của `tsx watch`): chờ lượt ghi đang chạy kết thúc (giới hạn vài giây) và gỡ khoá trước khi thoát.
4. **E2E ca 14 chập chờn** (`src/tests/saleAiUpdateAll.test.ts`, "history Cập nhật lại các món lỗi…"): đôi khi quá 5.000ms (Claude chạy 3 lần: lỗi, đạt, lỗi). Chờ lượt nền theo tiến trình/đồng hồ giả, không nới timeout.
5. Không đổi logic giá, ghi, rollback, giới hạn Sapo, chạy nền TASK-116.

## Test

- Khoá bỏ lại có PID không tồn tại → khởi tạo thành công, có log "gỡ khoá bỏ lại".
- Khoá cũ không có thông tin chủ, quá hạn → gỡ; chưa quá hạn → không gỡ.
- Khoá của tiến trình đang sống → không gỡ.
- `startSaleAi` lần đầu lỗi, lần sau hết lỗi → tự lên, không khởi động lại máy chủ.
- E2E 15 ca đạt **5 lần liên tiếp**.

## Cách làm

- Codex chạy `-a never`. Lệnh bị sandbox chặn thì ghi lại, không xin quyền. Claude chạy `npm test`, E2E (nhiều lần), `npm run build`.
- Không gọi Kiot/Sapo thật. Không dừng hay khởi động lại server. Không commit. Ghi `tasks/TASK-117-result.md`.
