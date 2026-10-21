# TASK-037 — Kết quả: thử mọi tình huống "Chọn tất cả → Cập nhật Kiot + Sapo"

- Dự án: web + `D:\BaoQ-AI`. Trạng thái: done (phần tốc độ ghi nhật ký để việc riêng). Claude làm trực tiếp theo yêu cầu của Bảo (2026-10-19): "test xem tất cả trường hợp xảy ra khi cập nhật toàn bộ và sửa nó". Không ghi giá thật: Sale AI chạy chế độ fixture với Kiot/Sapo giả, kho SplitStore thật trong thư mục tạm.

## Bộ thử
`server/src/tests/saleAiUpdateAll.test.ts` — web thật (`/sale-ai/` + đăng nhập/quyền/nguồn giả lập) → Sale AI thật → Kiot/Sapo giả, gửi đúng chuỗi yêu cầu của trang: tải lại, đọc chỉ mục Sapo, selection, prepare, commit, lịch sử, khôi phục. Chạy: `SALE_AI_E2E=1 npx vitest run src/tests/saleAiUpdateAll.test.ts` (bỏ qua trong `npm test` thường vì chậm).

| # | Tình huống | Kết quả |
|---|---|---|
| 1 | Bình thường (50/300 món) | Đạt: mọi món lên P_M trên Kiot và Sapo |
| 2 | 4.500 món: chọn + kiểm tra qua web | Đạt: 49 KB, 20 giây, chưa ghi món nào |
| 3 | Chưa đọc chỉ mục Sapo | Chặn trước khi ghi (đúng); trước đây không có nút đọc vì Thiết lập bị ẩn → đã sửa |
| 4 | Món bị sửa tay trên Kiot sau khi kiểm tra | Bỏ qua 3 món đó ở cả hai bên, 17 món còn lại ghi |
| 5 | Kiot 429 (quá giới hạn) ở 3 món | 3 món lỗi, không thử lại, các món khác tiếp tục, Sapo đủ |
| 6 | Kiot hết thời gian chờ | Món đó "chưa xác định", không đọc lại/thử lại, món sau tiếp tục |
| 7 | Kiot mất quyền (403) giữa chừng | Kiot dừng (7 món không gửi), Sapo vẫn xong 10/10 |
| 8 | Thiếu SKU trên Sapo | 2 món vào danh sách lỗi, không ghi bên nào |
| 9 | Bấm Cập nhật 2 lần / tải lại khi đang cập nhật | Lần sau bị từ chối 409, lượt đầu xong bình thường |
| 10 | Đóng trang giữa lượt | Sale AI vẫn chạy hết, Lịch sử ghi success |
| 11 | Khôi phục sau cập nhật | Giá cũ về đủ trên Kiot và Sapo |
| 12 | Hàng từ 600 triệu chưa có giá duyệt | Không gửi, ghi vào danh sách chờ |

## Lỗi tìm thấy và đã sửa
1. `.env` của Sale AI trống → ghi giá sẽ báo "Thiếu/sai cấu hình Kiot trong .env", Sapo "chưa kết nối". Sửa: `scripts/dev.mjs` đọc `BossTele/.env` và chỉ truyền 6 khóa cùng tên (`KIOT_*`, `SAPO_*`) vào tiến trình Sale AI (không chép ra file). Sau khi chạy lại: Sapo "đã kết nối", sẵn sàng.
2. Nút "Đọc chỉ mục SKU Sapo" chỉ có ở trang Thiết lập đang ẩn → thêm nút cạnh cảnh báo ở Kết quả (`D:\BaoQ-AI\public\live-ui.js`), đổi câu báo trong `lib/sapo.js`.
3. (Lượt trước) chuyển tiếp làm sai `Host` khiến mọi POST bị Sale AI từ chối — đã sửa ở TASK-036.

## Chưa sửa (đề xuất việc riêng)
- Thời gian lưu nhật ký tăng nhanh hơn số món (lưu cả nhật ký trước mỗi yêu cầu): 100 món 9,7 giây, 200 món 31,6 giây, 300 món 50,4 giây (Kiot/Sapo giả trả ngay). Ước 4.500 món ~3 giờ chỉ riêng phần này, chưa tính mạng. Tạm thời nên cập nhật theo nhóm (lọc Theo M hoặc từ khóa, vài trăm món mỗi lượt).
- Kiot 429 hiện làm hỏng từng món còn lại thay vì dừng/chờ; với 4.500 món có thể chạm giới hạn của KiotViet (chưa biết con số chính xác). Đổi chính sách thử lại cần Bảo duyệt.

## Kiểm tra
- Bộ thử E2E 12/12; web build đạt, `npm test` 28 file / 430 test (bộ E2E bỏ qua); Sale AI `node --test *.test.js` 213/213.
- Thật: sau `npm run dev`, `GET /api/sapo/status` → `{"connected":true,"ready":true}`. Chưa bấm Cập nhật thật.

## Cập nhật 19/10/2026 (Bảo: "load trang báo Yêu cầu không hợp lệ" và "tăng tốc nhật ký: món lỗi mới lưu, còn lại chạy tiếp, chỉ báo tổng số thành công")
- Lỗi khi mở trang: trang tự gửi POST `table/ensure`; Vite (proxy dạng chuỗi dùng changeOrigin) đổi Host sang 127.0.0.1:4000 nên Sale AI thấy Origin ≠ Host và từ chối. Sửa `saleAiRoutes.ts`: luôn gửi Host = host của `APP_ORIGIN` (Origin đã được `requireSameOrigin` kiểm). Test mới trong `saleAiProxy.test.ts`; bộ E2E nay gửi Host như Vite (127.0.0.1:4000).
- Nhật ký theo đợt (`D:\BaoQ-AI\lib\joint-update.js`, `JOURNAL_WINDOW = 100`): đầu mỗi đợt đánh dấu cả đợt "đang gửi" và lưu một lần; bỏ lưu sau mỗi món thành công và sau mỗi lỗi tiếp tục được (lưu ở đợt kế/cuối lượt); lỗi dừng bên (401/403) vẫn lưu ngay. Món được đánh dấu mà dừng trước khi gửi thì `requestSent=false`. Khôi phục sau sự cố không đổi: mọi món chưa có kết quả cuối → chưa xác định.
- Thông báo (`lib/update-report.js`): "Đã cập nhật thành công X/Y sản phẩm." + "Lỗi Z sản phẩm." khi có lỗi (nút Xem sản phẩm lỗi giữ nguyên). Khôi phục giữ câu cũ.
- `D:\BaoQ-AI\docs\CURRENT.md` mục 4 ghi quy tắc mới. Test mới `journal-window.test.js` (lưu "đang gửi" trước mỗi request, mất điện giữa đợt không báo "chưa gửi", lỗi ghi lịch sử + câu tổng kết).
- Đo (Kiot/Sapo giả, SplitStore thật): 300 món 50,4 s → 1,7 s; 1.000 món 6,3 s; 4.500 món 128 s (trước ước ~3 giờ). E2E 12/12 với 4.500 món ở tình huống 1. Sale AI 235/235, web 431 test đạt.
