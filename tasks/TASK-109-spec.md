# TASK-109: Bảng Sale AI không tải hàng tạo trước 01/07/2026

- Dự án: web (Sale AI trong `Webstie/server/src/sale-ai`)
- Người phụ trách: Codex (thực hiện), Claude (chạy test, review)
- Trạng thái: `ready`
- Ngày giao: 30/10/2026. Bảo: "các sản phẩm trước ngày 1/7/2026 không được giảm thêm nên không cần load lên".

## Hiện trạng (Claude đo trên kho đang chạy, bảng ngày 30/10)

- Bảng có 4.469 dòng:
  - 1.580 `simulated`;
  - 3 `waiting` ("Chờ nhập giá duyệt riêng");
  - **2.886 `excluded` "Hàng tạo trước 01/07/2026: không giảm"** (quy tắc TASK-105, `lib/pricing.js` `NO_MARKDOWN_BEFORE`).
- Các dòng này hiện lên bảng: giá "—", sale "—". Chúng làm bảng dài thêm 2/3, và mỗi bảng `runs` lưu thêm từng ấy dòng.

## Yêu cầu

1. Khi tạo bảng kết quả (`runs`), **không đưa vào bảng** các món bị loại vì "tạo trước 01/07/2026". Nhận diện bằng điều kiện ngày, **không** bằng so chữ lý do: thêm cờ hoặc mã lý do rõ ràng ở `calculate()`, ví dụ `excludedReason: 'before_no_markdown'`.
   - Các loại trừ khác (hết tồn, ngừng kinh doanh…) giữ như hiện tại.
   - Hồ sơ sản phẩm (`products`) vẫn giữ, vì P0 và lịch sử cần cho lần sau. Chỉ không đưa vào bảng.
2. Giao diện Sale AI hiện **một dòng tóm tắt** cạnh số món, ví dụ: "Đã ẩn 2.886 món tạo trước 01/07/2026 (không giảm)". Lưu số này cùng bảng.
3. "Chọn tất cả (mọi trang)", bộ lọc M, tìm kiếm, phân trang, tổng số món chỉ tính các dòng còn lại.
4. Tìm đúng một mã thuộc nhóm bị ẩn (ví dụ `SP012811_KG`): không có dòng, hiện câu "SP012811_KG tạo trước 01/07/2026: không giảm, không hiện trong bảng". Nếu làm việc này phức tạp, ghi lại để làm sau.
5. Không đổi:
   - quy tắc giá TASK-105;
   - logic ghi giá, rollback, kiểm tra trước/sau ghi;
   - `BossTele/sale-price.js` (vẫn trả "không giảm" khi hỏi mã cũ);
   - phần tự đọc Sapo của TASK-108.
6. Bảng cũ đã lưu (trước task này) không cần sửa. Lần "Kiểm thử" sau tạo bảng mới theo cách mới.

## Test (`server/src/sale-ai/test/`, chạy bằng `node --test`, đi qua `core.js` thật)

- Danh mục giả có món tạo 15/03/2026, 30/06/2026, 01/07/2026, 20/10/2026. Bảng chỉ có 2 món sau; số "đã ẩn" = 2.
- Món hết tồn tạo sau 01/07 vẫn xử lý như cũ.
- "Chọn tất cả" không chứa món bị ẩn; `prepare` với mã bị ẩn bị từ chối như món không có trong bảng.
- Kích thước bảng (số dòng) giảm đúng.

## Cách làm

- Codex chạy `-a never`. Lệnh bị sandbox chặn (spawn EPERM) thì ghi lại, không xin quyền. Claude chạy `npm run build`, `npm test` tại `Webstie`, và kiểm trang Sale AI ở 8787.
- Không gọi Kiot/Sapo thật. Không in khoá. Không dừng hay khởi động lại server đang chạy. Không đổi thay đổi chưa commit của task khác. Không commit.
- Ghi `tasks/TASK-109-result.md`.

## Bổ sung (Claude, 30/10/2026 chiều)

Bảng đang lưu không tự tạo lại. `ensureCurrent()` trong `core.js` chỉ tạo bảng mới khi sang ngày mới, khi dữ liệu Kiot đổi, hoặc khi `POLICY` đổi; TASK-109 chưa đổi `POLICY`. Ở chế độ thật không có nút "Kiểm thử", nên Bảo vẫn thấy bảng cũ có 2.886 món trước 01/07.

**Sửa:**
- Đổi `POLICY` trong `server/src/sale-ai/lib/pricing.js` thành `baoq-2026-10-30-hide-before-jul-v10`. Mở trang Sale AI (gọi `/api/table/ensure`) sẽ tự tạo bảng mới.
- Cập nhật test nào đang so khớp đúng chuỗi `POLICY` cũ.
- Không đổi gì khác.
