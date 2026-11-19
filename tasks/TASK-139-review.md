Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-139 — Review của Claude

- Dự án: web (Sale AI)
- Ngày: 10/11/2026
- Kết luận: **`verified`** trên dữ liệu giả lập. Chưa chạy với Kiot thật (xem Giới hạn).

## Bằng chứng (Claude tự chạy)
| Lệnh | Kết quả |
|---|---|
| `npm run build` tại `Webstie` | exit 0 |
| `npm test` tại `Webstie` | exit 0. Shared 32/32, server Vitest 491 đạt (18 skipped), Sale AI 458/458 |
| `npm test` tại `Webstie/BossTele` | 114/114 |

Test mới: `approval.test.js`, `approval-api.test.js`, `approval-ui.test.js`, `below-cost.test.js`. Các test này phủ đủ tiêu chí 1:
- thiếu vốn và P0 ≤ vốn → `excluded`
- `needs_approval`; `autoSelection` bỏ qua món chờ duyệt
- cờ duyệt do máy chủ kiểm, người duyệt lấy từ phiên đăng nhập (không lấy từ request)
- giá vốn đổi lúc preflight → dừng
- Giữ giá không gửi PUT; nhãn Lịch sử đúng

Kiểm tra trình duyệt: frontend thật (8787) + Sale AI fixture (client Kiot giả, kho trong bộ nhớ). Tên, giá, giá vốn lấy từ sản phẩm thật. Không chạm kho thật, Kiot hay Sapo.
- Tab `Duyệt (13)` hiện cạnh Bảng giá sale và Lịch sử.
- Nhóm Chờ duyệt (1): SP023370_KG, M0 → M1, có nút Duyệt và Duyệt tất cả.
- Nhóm Đã lỡ giảm dưới vốn (12): nút Trả về giá vốn / Giữ giá; phân trang 10 dòng.
- Bấm Duyệt hiện hộp "Duyệt 1 món thấp hơn giá vốn tổng 1.000.000đ. Giá sẽ được ghi lên Kiot." kèm bảng giá. Bấm Hủy không ghi gì.
- Bảng giá sale không có món chờ duyệt.

Đọc code:
- `pricing.js:70-71,90`
- `kiot.js:67-69` (giá vốn cao nhất các chi nhánh)
- `live.js:49` (so giá vốn mới đọc từ Kiot)
- `live.js:166-197,298-313`
- `approval.js` (nhóm Đã lỡ dùng `expectedKiotPrices`)
- `view-data.js:18`

Shop hiện chỉ có 1 chi nhánh (6.043 món trong `catalog-cache.json`), nên so giá vốn lúc ghi không báo lỗi nhầm.

## Phát hiện (thấp, không chặn) — đã sửa 10/11/2026
1. Thứ tự tab là `Bảng giá sale | Duyệt | Lịch sử`, demo đặt Duyệt sau Lịch sử.
2. Dòng mô tả dưới tiêu đề vẫn là "Kiểm tra giá trước khi ghi lên Kiot + Sapo."; câu "Món giảm xuống dưới giá vốn…" nằm ở dòng riêng bên dưới.
3. Cột "Thấp hơn vốn" chưa tô đỏ hay thêm dấu trừ như demo. Nút "Trả về giá vốn tất cả" chưa là nút chính.

## Giới hạn
- Chưa ghi thật lên Kiot/Sapo. Lần ghi thật đầu tiên cần Bảo cho phép và theo dõi.
- **Sau khi cập nhật, kho Sale AI cũ chưa có giá vốn.** Phải bấm **Tải lại từ Kiot** thì mới tính được. Trước lúc đó mọi món bị loại vì "Thiếu giá vốn", nên lượt tự động không ghi món nào.

## Kiểm tra lại sau khi sửa 3 phát hiện (10/11/2026)
- Tab: `Bảng giá sale | Lịch sử | Duyệt (13)`.
- Mô tả view Duyệt: "Món giảm xuống dưới giá vốn: chỉ ghi lên Kiot khi bấm Duyệt.", không còn dòng trùng.
- Cột Thấp hơn vốn có dấu trừ và màu đỏ. Nút Trả về giá vốn là nút chính, Giữ giá là nút phụ.
- `npm run build` exit 0; `npm test` exit 0 (shared 32/32, server 491 đạt, Sale AI 458/458).
- Trình duyệt: frontend tạm cổng 8793 + Sale AI fixture. Ảnh chụp đúng như demo.
