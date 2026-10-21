# TASK-039 — Kết quả: mốc ngày bắt đầu đổi sang 01/10/2026

- Dự án: `D:\BaoQ-AI` (Sale AI) + BossTele. Trạng thái: done, Claude làm trực tiếp theo yêu cầu của Bảo (2026-10-19): "sửa Ngày bắt đầu lấy ngày muộn hơn giữa ngày tạo và 13/10/2026 thành 1/10/2026, bước nhảy là 15, test 10 sản phẩm khác nhau" và "cập nhật cho BossTele về ngày đó luôn".

## Thay đổi
- `D:\BaoQ-AI\lib\pricing.js`: `START` 2026-10-13 → 2026-10-01; câu báo "Ngày xét trước mốc 01/10/2026"; `POLICY` → `baoq-2026-10-19-start01-v8` (bản đề xuất cũ bị vô hiệu, bảng tính lại; lịch sử/P0 giữ nguyên). Bước M 15 ngày, mốc M1 cho hàng tạo trước 01/10, hottrend M0 45 ngày: không đổi. Bản trước khi sửa lưu tạm ở scratchpad.
- Test Sale AI theo mốc mới: `start-date`, `preoct-m1`, `fifteen-days`, `note-first`, `simulator`, `cycle` (tuổi tính từ 01/10; hàng tạo sau mốc tính từ ngày tạo của nó).
- Tài liệu: skill `baoq-pricing/SKILL.md`, `docs/CURRENT.md`; BossTele `docs/SALE-PRICE.md`. BossTele gọi thẳng `calculate` của Sale AI nên tự theo mốc mới.

## 10 sản phẩm thật (xét 19/10/2026, chỉ đọc, cùng P0)
| SKU | Loại / ngày tạo | P0 | Mốc cũ 13/10 | Mốc mới 01/10 |
|---|---|---|---|---|
| SP024383 | thường, 30/09 | 36,5tr | tuổi 6, M1, 35,7tr | tuổi 18, M2, 34,9tr; quyền 1,745tr; thấp nhất 33,155tr |
| SP024373 | thường, 30/09 | 1,3tr | M1, 1,3tr | M2, 1,3tr (dưới 2tr không giảm) |
| SP024380 | thường, 30/09 | 2tr | M1, 1,8tr | M2, 1,6tr; quyền 0 |
| SP024374 | thường, 30/09 | 115tr | M1, 112,5tr | M2, 110tr; quyền 6tr; thấp nhất 104tr |
| SP024357 | hottrend, 28/09 | 64tr | M1, 62,5tr | M2, 61tr; quyền 3,05tr; thấp nhất 57,95tr |
| SP024453 | thường, 04/10 | 4tr | tuổi 6, M0, 4tr | tuổi 15, M1, 3,8tr |
| SP024752 | thường, 12/10 | 9,5tr | tuổi 6, M0 | tuổi 7, M0, 9,5tr; quyền 0,8tr |
| SP024882 | thường, 19/10 | 45tr | M0 | M0 (tuổi 0), quyền 2,25tr |
| SP024540 | hottrend, 07/10 | 105tr | tuổi 6, M0 | tuổi 12, M0 (hottrend giữ M0 45 ngày) |
| SP024860 | thường, 17/10 | 640tr | chờ giá duyệt | chờ giá duyệt riêng (từ 600tr) |

## Kiểm tra
- Sale AI `node --test *.test.js` 235/235; BossTele `npm test` 100/100.
- Hệ quả: hàng tạo trước 01/10 hôm nay ở M2 (trước là M1) và lên M3 ngày 31/10. Giá trên Kiot/Sapo chỉ đổi khi bấm Cập nhật.
