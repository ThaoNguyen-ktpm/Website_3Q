# TASK-007 — Chat terminal tiết kiệm token

- Nguồn đặc tả: kế hoạch người dùng đã gửi cùng lệnh PLEASE IMPLEMENT THIS PLAN ngày 2026-10-14.
- Phân vai: Codex triển khai; Claude review độc lập.
- Phạm vi: CLI chat theo mẫu, API Kiot/Web chỉ đọc, hiển thị 10 dòng, cache 120 giây/50 truy vấn, chọn dòng hiện tại, tính markup/margin chính xác với vốn+chi phí, AI tắt và bộ đếm lượt gọi.
- Chặn bằng parser trước API/AI: câu không khớp đầy đủ, câu ghép, thiếu tham số, hơn 500 ký tự.
- AI analysis cần sản phẩm+phép tính; nếu chưa provider thì thông báo cố định, không gọi model.
- Không triển khai web, multi-user, POS, cập nhật giá hay tự động hóa.
- Nghiệm thu: test grammar/công thức/cache/paging/AI count, test hồi quy, live tên và SKU chỉ đọc, Claude review code/bằng chứng. Phải phân biệt fixture với live.
- Cách dùng và chi tiết hành vi: `docs/CHAT.md`.
