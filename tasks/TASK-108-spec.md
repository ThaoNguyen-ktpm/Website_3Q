# TASK-108: Sale AI tự đọc chỉ mục SKU Sapo, bỏ dòng nhắc và nút bấm tay

- Dự án: web (Sale AI trong `Webstie/server/src/sale-ai`)
- Người phụ trách: Codex (thực hiện), Claude (chạy test, review)
- Trạng thái: `ready`
- Ngày giao: 30/10/2026. Bảo: "tự động luôn đi, không cần tui phải nhấn".

## Hiện trạng

- Sau TASK-104, kho Sale AI mới trống. Trang Sale AI hiện dòng "Cần đọc chỉ mục SKU Sapo: bấm Đọc chỉ mục SKU Sapo" cùng nút `#sapo-index` (`public/live-ui.js:35`, xử lý ở dòng ~63). Ở chế độ Sapo có thêm panel "Kết nối Sapo" với nút `#sapo-refresh` (`public/live-ui.js:97-98`).
- Chỉ mục được đọc bằng `SapoService.refresh()` (`lib/sapo.js:61`): **chỉ GET** danh sách sản phẩm Sapo (`client.all()`), ghi vào kho `sapo-state.store`. Route tay: `POST /api/sapo/refresh` (`core.js:115`), chạy trong `perform()` và xoá `prepared`.
- `status()` (`lib/sapo.js:59`) trả `ready=false` khi `catalogBinding` chưa khớp, tức chưa đọc chỉ mục.

## Yêu cầu

1. **Tự đọc chỉ mục Sapo, không cần bấm:**
   - **Sau mỗi lần "Tải lại từ Kiot"** thành công (`/api/kiot/refresh`, `refreshTable`): gọi `sapo.refresh()` trong cùng lượt `perform()` (cùng khoá), sau khi bảng Kiot xong.
     - Đọc Sapo lỗi thì **không** làm hỏng lần tải Kiot. Bảng Kiot vẫn cập nhật; lưu lỗi để giao diện báo ngắn.
   - **Khi máy chủ khởi động**, Sapo đã có khoá mà `status().ready === false`: tự đọc một lần ở nền, sau khi lõi sẵn sàng.
     - Không chặn việc mở cổng; không chạy song song với một lượt ghi (dùng cùng khoá).
     - Lỗi thì ghi log ngắn (không in khoá), lần "Tải lại từ Kiot" sau sẽ thử lại.
   - Giữ quy tắc hiện có: đọc lại chỉ mục thì xoá `prepared`, như route tay. Ở bước tự đọc lúc khởi động, chỉ xoá khi chỉ mục thật sự thay đổi, để không mất một lượt xác nhận đang chờ.
   - Chỉ GET Sapo. **Không** PUT, không đổi giá hay mô tả.
2. **Giao diện (`public/live-ui.js`):**
   - Bỏ dòng nhắc và nút `#sapo-index`; bỏ nút `#sapo-refresh` và panel "Kết nối Sapo" nếu panel chỉ để bấm nút đó.
   - Đang tự đọc: không hiện gì, hoặc một chữ nhỏ "Đang đọc Sapo…".
   - Đọc lỗi: một dòng ngắn "Chưa đọc được Sapo, sẽ thử lại khi Tải lại từ Kiot", không có nút.
   - Sapo **chưa cấu hình khoá**: giữ thông báo hiện có "Sapo chưa kết nối — chưa thể cập nhật chung".
   - Có thể giữ route `POST /api/sapo/refresh` cho máy gọi, nhưng không hiện nút.
3. Không đổi logic ghi giá, rollback, kiểm tra trước/sau ghi, đối chiếu mã `sapoSku`, quy tắc giá TASK-105.

## Test (`server/src/sale-ai/test/`, chạy bằng `node --test`)

Dùng Sapo giả, chỉ GET:
- "Tải lại từ Kiot" thành công thì `sapo.status().ready === true`, chỉ mục có sản phẩm.
- Sapo giả báo lỗi: tải Kiot vẫn thành công, trạng thái có lỗi Sapo, không ném lỗi ra API.
- Khởi động với kho Sapo trống và có khoá: tự đọc một lần, sau đó `ready === true`.
- Sapo giả không nhận PUT nào trong mọi ca trên.
- Giao diện: HTML dựng ra không còn `#sapo-index` và `#sapo-refresh`.

Lưu ý TASK-104 review: nhiều test đang chạy trên `test/legacy-server.js` (bản chép). Test mới phải chạy qua `core.js` thật.

## Cách làm

- Codex chạy `-a never`. Lệnh bị sandbox chặn (spawn EPERM) thì ghi lại, không xin quyền. Claude chạy `npm run build`, `npm test` tại `Webstie` và kiểm giao diện ở 8787.
- Không gọi Kiot/Sapo thật. Không in khoá. Không dừng hay khởi động lại server đang chạy. Không đổi thay đổi chưa commit của task khác. Không commit.
- Ghi `tasks/TASK-108-result.md`.
