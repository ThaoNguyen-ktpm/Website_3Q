# TASK-005 — Kết nối tìm sản phẩm

- Người phụ trách: Codex triển khai; Claude review code khi có báo cáo riêng.
- Trạng thái: ready_for_live_setup cho Kiot/Web; chờ vị trí khóa API và tài liệu Sapo POS để hoàn tất kết nối thật.
- Yêu cầu: tìm sản phẩm bằng API KiotViet và cả Sapo Web/POS; người dùng xác nhận đã có khóa.
- Hành động gần nhất: triển khai Kiot Retail/Web, tạo cấu hình riêng và chạy test fixture.
- Bước tiếp theo: nhận đường dẫn khóa hoặc người dùng tự điền config, đối chiếu hợp đồng POS, chạy kiểm tra chỉ đọc từng nguồn với dữ liệu thật.

## Thay đổi
- `lib/product-search.js`: token Kiot, tìm tên/SKU, Sapo Web basic/token, phân trang, kết quả tách nguồn, timeout và lỗi an toàn.
- `search-products.js`: CLI tìm sản phẩm và kiểm tra tình trạng cấu hình.
- `config/connections.example.json`: mẫu 3 nguồn; `connections.local.json` tạo với trường trống, được gitignore.
- `test/product-search.test.js`: test kết nối bằng transport giả lập.
- `package.json`: chạy test giới hạn thư mục test của BossTele, tránh tự chạy test vendor.
- `docs/PRODUCT-SEARCH.md`: cấu hình, lệnh dùng, nguồn API và giới hạn.

## Kiểm chứng
- `node --check` cho CLI và thư viện: đạt.
- `npm.cmd test`: 43/43 test đạt, 0 lỗi; kết quả ở `TASK-005-tests.txt`; đã bổ sung kiểm tra lọc tên cục bộ và dữ liệu giá/tồn chưa xác định sau review.
- `node search-products.js --status`: Kiot/Web thiếu cấu hình, POS cần API contract; không gửi request thật.
- Fixture kiểm tra token/cache, phân trang, SKU chính xác, basic/token, không lộ khóa qua lỗi/URL, một nền tảng lỗi không xóa kết quả bên còn lại và thiếu config không gọi API.

## Chưa hoàn tất
- Người dùng chưa cung cấp vị trí file khóa hoặc điền cấu hình trong phiên này; chưa xác minh API tài khoản thật.
- Sapo POS chưa có tài liệu chính thức của tài khoản; cố ý chưa suy đoán endpoint/schema/auth.
- Review vòng đầu của Claude ở `TASK-005-review.md`: tự chạy 42/42 test đạt, kết luận ready_for_live_setup. Codex đã xử lý góp ý lọc tên cục bộ và tồn không quản lý; Claude đọc lại code/test/log tại `TASK-005-review-followup.md`, kết luận ready_for_live_setup. Lần follow-up không tự chạy lại test. Đã sửa ghi chú phân trang Sapo theo góp ý bổ sung.
- Không ghi dữ liệu Kiot/Sapo, không triển khai tính giá hoặc web UI, không bật Claude-Mem.
