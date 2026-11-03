# TASK-131 — Kế hoạch triển khai

Máy: Laptop (DESKTOP-4G5GOSR)

Mục tiêu: gom hàm bỏ dấu, mã SP và ghi tiền vào CommonJS shared, giữ nguyên từng ký tự trả lời theo `tasks/TASK-131-spec.md`.

- [x] Thêm test shared cho dấu tiếng Việt, đ/Đ, null, chữ hoa và định dạng tiền; chạy trước khi tạo module.
- [x] Tạo `shared/text.js`, `shared/money.js`; chuyển nguyên `BossTele/lib/sku.js` sang `shared/sku.js`. Bổ sung export có kiểu generic tại `server/src/config/shared.js`.
- [x] Đổi import trong 13 nơi bỏ dấu, các nơi gọi SKU và tiền được chỉ định. Giữ wrapper `brands.fold`, alias `light`, mọi comment và tỷ giá `market-lookup`. Test SKU chỉ đổi đường dẫn import.
- [x] Chạy build/test web, BossTele, shared; kiểm cú pháp, vị trí định nghĩa, đường dẫn module từ src/dist và bộ lọc plugin từ thư mục khác. Ghi riêng mọi lỗi `spawn EPERM` và kiểm thật bị chặn.
- [x] Ghi báo cáo tiếng Việt `tasks/TASK-131-result.md`, trạng thái `ready_for_review`; không commit/đổi nhánh.

Giới hạn: không thêm dependency; không sửa frontend, Sale AI, dữ liệu, vendor, backup hoặc quy tắc nghiệp vụ. Claude kiểm tra độc lập sau bàn giao.
