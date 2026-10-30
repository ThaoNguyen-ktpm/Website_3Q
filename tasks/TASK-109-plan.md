# TASK-109 — Kế hoạch triển khai

Đặc tả: `tasks/TASK-109-spec.md`. Triển khai trực tiếp theo yêu cầu của Bảo; không commit, không gọi dịch vụ thật, không thay đổi tiến trình máy chủ.

1. Viết test qua `core.js` với ba store bộ nhớ và client fixture: bốn ngày 15/03, 30/06, 01/07, 20/10/2026; kiểm tra còn hai dòng, ẩn hai món, giữ hồ sơ/P0. Thêm hết tồn, phân trang, tìm kiếm, M, chọn tất cả và prepare mã bị ẩn; kiểm tra lưu/đọc lại bảng và giữ bảng cũ.
2. `lib/pricing.js`: thêm `excludedReason: 'before_no_markdown'` tại nhánh loại trừ sẵn có, giữ nguyên thứ tự kiểm tra và quy tắc giá. `lib/service.js`: lọc sau khi ghép snapshot theo vị trí, lưu `hiddenBeforeNoMarkdownCount` cùng bảng.
3. `lib/view-data.js`: cho phép metadata số ẩn đi qua API. `public/app.js`: hiện dòng tóm tắt cạnh tổng số món trong phân trang dùng chung. Giữ bảng cũ không có metadata như hiện tại.
4. Cập nhật test `jul-batch.test.js` vì đặc tả chủ đích đổi từ dòng excluded sang không có dòng. Chạy test mới trước/sau sửa, toàn bộ test lõi và các kiểm tra phù hợp; ghi rõ EPERM nếu bị chặn.
5. Viết `tasks/TASK-109-result.md` trạng thái `ready_for_review`, liệt kê bằng chứng và giới hạn. Thông báo tìm đúng mã bị ẩn để làm sau theo mục 4 đặc tả, tránh lưu thêm danh sách mã vào mỗi bảng.

Rà soát: ngày biên và múi giờ Việt Nam; các loại trừ khác giữ nguyên; không lệch snapshot sau lọc; bảng cũ không sửa; số ẩn không thay đổi theo tìm kiếm/M. Không thêm dependency hay thay đổi logic ghi/khôi phục/Sapo.
