Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-118: Sale AI nhận sản phẩm Sapo không có mô tả; bỏ qua món Sapo giá 0

- Dự án: web (Sale AI)
- Người phụ trách: Codex (thực hiện), Claude (chạy test, review)
- Trạng thái: `ready`. **Gấp**: còn 555 món M1 chưa cập nhật ngày 02/11/2026. **Làm trước TASK-117, trong cùng lượt.**

## Lỗi thật

Lượt 11:46 02/11: 756/1.311 thành công. "Cập nhật lại các món lỗi" lúc 12:23: 555/555 lỗi kiểm tra, chưa ghi:

| Số món | Lỗi | Claude đọc Sapo thật (chỉ GET) |
|---|---|---|
| 533 | "Sapo: chưa xác minh được cấu trúc giá/mô tả" | ví dụ SP024335_26092026, SP024288_26092026: `content: null`, variants có `sku`, `price` hợp lệ |
| 18 | "Sapo: dữ liệu phiên bản không hợp lệ" | ví dụ SP024795_14102026, SP024794_14102026: `content` có chữ, **`price: 0`** |
| 4 | "Kiot thay đổi trước khi gửi" | đúng, giữ nguyên |

Nguồn: `lib/sapo.js` `validateSapoProduct`:
- `typeof p.content!=='string'` thì ném lỗi "chưa xác minh được cấu trúc giá/mô tả";
- `Number(v.price)<=0` thì ném lỗi "dữ liệu phiên bản không hợp lệ".

## Yêu cầu

1. **Mô tả rỗng (`content: null`) là hợp lệ**, coi như chuỗi rỗng khi kiểm tra, khi tạo ghi chú mới và khi so dấu vân tay. Kiểm tra trước/sau ghi vẫn chặt như cũ.
   - Khôi phục (rollback) món có mô tả gốc `null` phải trả về đúng "không có mô tả". Codex kiểm Sapo API nhận `null` hay `""`, ghi rõ cách chọn, có test.
   - Cấu trúc khác vẫn bị từ chối như cũ: thiếu `variants`, variant không có `sku`, giá âm hoặc không phải số.
2. **Sapo giá 0** (Bảo quyết 02/11/2026: **bỏ qua cả hai bên**): món mà Sapo có variant `price === 0` thì **không ghi Kiot, không ghi Sapo**.
   - Trạng thái riêng, ví dụ `skipped_sapo_zero_price`, lý do "Sapo đang để giá 0 — bỏ qua, xử lý tay trên Sapo".
   - Không tính là lỗi. Không vào "Cập nhật lại các món lỗi". Lịch sử (TASK-114) có nhóm riêng, ví dụ "Bỏ qua (Sapo giá 0): 18".
   - Dòng tóm tắt lượt: "x/1.311 thành công · y lỗi · 18 bỏ qua (Sapo giá 0)".
3. Giữ nguyên: quy tắc giá, giới hạn Sapo (TASK-113), chạy nền (TASK-116), quy tắc mã `sapoSku`.

## Test

- Sapo giả có món `content:null`: kiểm tra qua, ghi giá + ghi chú, xác minh sau ghi qua; rollback trả về "không mô tả".
- Sapo giả có món `price:0`: không gửi PUT Kiot hay Sapo; trạng thái bỏ qua; không có trong `retry-selection`.
- E2E `saleAiUpdateAll.test.ts` đạt; thêm 2 ca trên nếu hợp lý.

## Cách làm

- Codex chạy `-a never`. Lệnh bị sandbox chặn thì ghi lại, không xin quyền. Claude chạy `npm test`, E2E, `npm run build`.
- Không gọi Kiot/Sapo thật. Không dừng hay khởi động lại server. Không commit. Ghi `tasks/TASK-118-result.md`.
- Xong thì làm tiếp **TASK-117** (`tasks/TASK-117-spec.md`: khoá ghi bị bỏ lại, báo lỗi khởi tạo, E2E ca 14 chập chờn); ghi `tasks/TASK-117-result.md`.
