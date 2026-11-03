Máy: Laptop (DESKTOP-4G5GOSR)

# Kế hoạch TASK-115 rồi TASK-114

Thực hiện trực tiếp theo hai spec đã duyệt, không chờ xác nhận thêm, không commit, không đụng server đang chạy hoặc dịch vụ thật.

1. TASK-115: thêm test biên 599.999.999/600.000.000, bảng 650 triệu, số ẩn, chọn/retry và bảo toàn manualPricing cũ; bổ sung BossTele và đổi ca E2E 12. Chạy test trước sửa để xác nhận lỗi.
2. Loại hàng từ 600 triệu tại calculate(), lọc bảng sau snapshot; truyền hiddenOver600mCount qua view và hiển thị cùng số ẩn cũ. Đổi POLICY. Gỡ helper/saveManual và test riêng không còn caller; giữ dữ liệu và endpoint 410, giữ fingerprint/rollback. Cập nhật assertion cũ theo chính sách mới.
3. Kiểm tra focused TASK-115, ghi TASK-115-result.md rồi tiếp tục TASK-114.
4. TASK-114: test tổng 64+1.250=1.314, nhóm lỗi, thành công, chưa gửi và danh sách đã đúng giá; test HTML một nút và ba thẻ. Dùng chung updateReport(update) cho số đếm và summaryText; giữ updateSummary(items) cho engine ghi hiện có.
5. API chi tiết hợp nhất items/skipped/unchanged có mã, hỗ trợ filter all/success/issues và errorsOnly cũ; lịch sử nhận tổng hợp mới không sửa kho. Hộp chi tiết ba thẻ, mở lỗi khi có lỗi, retry chỉ ở thẻ lỗi; giữ rollback và phân trang/lần thử.
6. Chạy suite lõi, BossTele, E2E fixture và build/test website theo khả năng sandbox. Ghi rõ lệnh chặn, không xin quyền. Viết TASK-114-result.md, trạng thái ready_for_review.

Rà soát: giữ nguyên dữ liệu cũ và thay đổi TASK-112/113; test hồi quy không gửi hàng 600 triệu, không đếm trùng mã skipped, không coi chưa xác minh là thành công, không bịa mã cho unchanged dạng số cũ, reset trang khi đổi thẻ. Claude kiểm tra độc lập sau bàn giao.
