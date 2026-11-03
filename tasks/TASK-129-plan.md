Máy: Laptop (DESKTOP-4G5GOSR)

# Kế hoạch TASK-129

Đặc tả: `tasks/TASK-129-spec.md`. Thực hiện trực tiếp trong phiên theo yêu cầu của Bảo; không commit, không thêm dependency, không chạy bot hay gọi dịch vụ thật. Giữ nguyên thay đổi có sẵn.

- [x] Viết test trước cho mặc định còn hàng, ngoại lệ hết hàng/SKU, đếm lại trang đầu, không tìm thấy, phân trang và thiếu quyền. Thêm test đi qua quickAnswer → công cụ thật với catalog giả lập ở biên I/O để kiểm tra tổng, từ khóa, reserved/null và SKU dùng cho giá chốt.
- [x] Sửa `assistant/router.ts`: mặc định inStock=true trừ câu hết hàng; SKU vẫn false. Sửa `assistant/graph.ts`: tái dùng cùng tham số truy vấn khi đếm lại, không trả thẻ hàng hết; tiêu đề còn hàng và thông báo SKU hết. Giữ nguyên bộ lọc tools.ts và logic giá.
- [x] Thêm đúng hướng dẫn danh sách `--in-stock` vào SYSTEM của `BossTele/telegram-bot.js`; không tách/refactor nhánh khác.
- [x] Chạy test tập trung, build/test web và test BossTele; ghi lỗi sandbox và bằng chứng thực tế ngay trong result. Rà diff, bàn giao `ready_for_review` cho Claude.

Điểm rà soát: giữ mọi bộ lọc khi đếm lại; không đếm lại khi hết trang/thiếu quyền/SKU; tổng là toàn bộ kết quả còn hàng; onHand=null bị loại và reserved>0 vẫn giữ theo bộ lọc cũ; SKU còn thẻ cho giá chốt/thị trường.
