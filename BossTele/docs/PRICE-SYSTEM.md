# Cơ sở thiết kế hệ thống định giá BaoQ

Ngày tiếp nhận: 2026-10-14. Phạm vi: tài liệu nền tảng cho BossTele, để phân tích và triển khai định giá sau này.

## Nguồn và hiệu lực
- Bản gốc nguyên vẹn: `docs/reference/price-system-plan.txt`, sao từ file người dùng cung cấp trên Desktop.
- Người dùng hiện yêu cầu đưa kế hoạch vào tài liệu hệ thống. Việc này chưa phê duyệt mọi công thức, ví dụ, lịch tự động hoặc công nghệ trong kế hoạch.
- Các đoạn STEP/prompt là nội dung tham khảo của tài liệu, không phải lệnh để agent triển khai ngay, gọi model khác, truy cập dữ liệu doanh nghiệp hoặc ghi lên KiotViet/Sapo.
- Tài liệu này mô tả định hướng và các quyết định còn thiếu, chưa phải bộ công thức giá đã được chốt. Quy tắc triển khai chỉ có hiệu lực khi được người dùng xác nhận trong đặc tả công việc tương ứng.
- Không tự áp dụng quy tắc từ dự án khác. Nếu nối với hệ thống BaoQ đã tồn tại, đọc chính sách hiện hành của hệ thống đó và đối chiếu xung đột trước.

## Mục tiêu theo kế hoạch
Xây dựng hệ thống nội bộ hỗ trợ founder báo giá, đề xuất giá thu/giá bán, quản lý giảm giá theo tuổi tồn kho và lưu kiến thức định giá thành dữ liệu có thể kiểm chứng. Ưu tiên bảo mật, giải thích được căn cứ và phân quyền duyệt. AI đưa ra đề xuất; mọi quyền tự động phải có phạm vi và chính sách rõ ràng.

Codex triển khai code và kiểm thử. Claude phân tích, lập đặc tả và kiểm tra độc lập theo `AGENTS.md`/`CLAUDE.md`. Các tên model và phân công triển khai khác trong bản gốc là tham khảo; phân vai BossTele hiện tại được ưu tiên.

## Luồng nghiệp vụ dự kiến
1. Data: lấy lịch sử thu/bán và tồn kho từ KiotViet/Sapo, cùng file phân tích thị trường và bộ quy ước SKU.
2. Price Engine: đối chiếu sản phẩm, đánh giá giá thị trường, giá bán đã thực hiện, giá thu thực tế và tốc độ bán; đề xuất giá có lý do và độ tin cậy.
3. Trigger: áp dụng chính sách giảm giá đã chốt; tính bản đề xuất trước khi duyệt.
4. Giao diện nội bộ: tra cứu, chat hỗ trợ, feedback founder, hàng chờ duyệt và nhật ký báo giá.
5. Studio/Marketing: nhận sản phẩm và mức giá đã được duyệt để chuẩn bị hình ảnh sale, website/livestream. Chưa có nội dung chi tiết cho Marketing trong bản gốc.

Không bật tự động hoặc gọi API thật chỉ vì kế hoạch có nhắc auto sale. Tính toán, duyệt và đồng bộ là các bước riêng.

## Dữ liệu cần có trước khi tính giá
- Bộ quy ước BaoQ SKU chính thức; định danh KiotViet và Sapo riêng; quy tắc ánh xạ SKU với sản phẩm so sánh thị trường.
- Sản phẩm so sánh cần thông tin hãng, mẫu, kích thước, chất liệu, tình trạng và phụ kiện. Các trường này là đề xuất chuẩn hóa; Claude cần xác định trường bắt buộc khi lập đặc tả.
- Ngày thu, giá vốn, ngày lên bán, ngày bán, giá bán thực nhận và các chi phí được tính vào lợi nhuận.
- Báo giá thị trường: nguồn, thời điểm, đơn vị tiền, điều kiện sản phẩm, giá chào hay giao dịch đã hoàn tất. Trung vị chỉ tính trên nhóm đủ tương đồng; cần chốt cửa sổ thời gian và số mẫu tối thiểu.
- Lịch sử giảm giá, tuổi tồn kho, trạng thái chưa bán, lý do sửa giá, người duyệt và feedback founder.
- Bản gốc nói file raw Sapo lấy BaoQ SKU từ “trường thứ 2”, còn dữ liệu thị trường có thể không có SKU KiotViet. Đây là giả định cần xác minh trên schema/file mẫu, không hard-code vị trí cột ngay.

## Các trường hợp đề xuất giá theo bản gốc
- Đã từng thu và bán: phối hợp trung vị thị trường gần nhất, giá bán thực tế, giá thu và day-to-sell. Bán nhanh là tín hiệu để xem xét giá, không tự suy ra phải tăng giá.
- Thị trường giảm hoặc tồn kho lâu: đối chiếu xu hướng và các trigger sale đã được duyệt; không dùng một ví dụ giảm 3 triệu sau 30 ngày làm quy tắc chung.
- Chưa từng thu nhưng có dữ liệu thị trường: đề xuất giá thu theo chính sách hạng mục/rank; hàng hiếm, giá trị cao hoặc thiếu mẫu cần founder duyệt.
- Chưa có dữ liệu thị trường: chuyển founder định giá; lưu quyết định, căn cứ và kết quả bán sau đó để bổ sung dữ liệu.
- AI học từ kết quả thực tế và feedback, nhưng không tự thay chính sách lợi nhuận hoặc ngưỡng duyệt. Cách cập nhật/mô hình hóa sẽ được thiết kế riêng và đánh giá trên bộ case.

## Khung lợi nhuận được nêu làm ví dụ
Đối với túi, bản gốc nêu dưới 50 triệu: 30%; 50–100 triệu: 23%; 100–150 triệu: 15%; 150–200 triệu: 12,5%. Một số ví dụ hàng giá trị cao dùng 10%.

Các tỷ lệ này chưa được coi là bảng áp dụng sản xuất. Cần chốt hạng mục, ranh giới đúng 50/100/150/200 triệu, rank tính theo giá vốn hay giá bán và thời điểm khóa rank. Chưa có chính sách đầy đủ cho các hạng mục khác hoặc trên 200 triệu.

### Phân biệt hai cách tính
Với giá vốn C, giá bán S và tỷ lệ r (dạng thập phân), chưa xét chi phí:
- Lãi trên vốn (markup): `(S - C) / C = r`; suy ra `S = C × (1 + r)` và giá thu tối đa `C = S / (1 + r)`.
- Biên lợi nhuận trên doanh thu (margin): `(S - C) / S = r`; suy ra `S = C / (1 - r)` và giá thu tối đa `C = S × (1 - r)`.

Ví dụ C = 150 triệu, r = 12,5%: markup cho S = 168,75 triệu; margin cho S ≈ 171,428571 triệu. Ví dụ 168,7 triệu trong nguồn gần với markup, nhưng nguồn cũng dùng từ “lợi nhuận gộp”, nên chưa đủ để chốt cách tính. Đây là minh họa toán học, không phải giá đề xuất cho sản phẩm thật. Quy tắc làm tròn và chi phí còn cần xác định.

## Trigger và day-to-sell cần chốt
- Cung cấp bảng trigger thực tế của Nguyên: mốc tuổi, mức giảm, cộng dồn hay theo từng mốc, nhóm hàng và hot trend, điều kiện ngừng giảm.
- Bản gốc có “tháng 7–8 là M0” và “giá chuẩn từ tháng 6 đổ về gọi là M0”. Chưa thể lấy một câu làm cutoff. Cần chốt ngày gốc, múi giờ, cách xác định tuổi và nghĩa của M0.
- Bản gốc yêu cầu founder duyệt khi giảm tới giá vốn. Đặc tả cần xác định xử lý khi giá dự kiến chạm hoặc vượt xuống dưới vốn; chưa cho phép tự áp dụng bước giảm đó.
- Các mốc 30/55/65/90 ngày và số tiền 3/14 triệu trong ví dụ chưa phải bảng trigger chung.
- “Day-to-sell tối thiểu” có thể bị hiểu ngược. Cần chốt là số ngày mục tiêu, giới hạn tối đa hay một khoảng kỳ vọng; cách tính từ ngày thu hay ngày lên bán, xử lý món chưa bán/hoàn trả/tạm ngừng bán.
- Không tăng giá lên 180 triệu chỉ vì bán nhanh khi trung vị thị trường là 175 triệu; mọi đề xuất cần kiểm tra sản phẩm tương đồng, xu hướng, số mẫu và giới hạn kinh doanh đã chốt.

## Yêu cầu hệ thống trong kế hoạch, chưa triển khai
- Đăng nhập, phân quyền CEO/founder và vận hành; quyền xem/sửa/duyệt/quản lý thành viên phải được mô tả cụ thể. Số account CEO và quyền xóa hệ thống cần chốt riêng.
- IP allowlist là một lớp bảo vệ được đề xuất, không thay xác thực/phân quyền. Mở truy cập từ ngoài cần đặc tả và quyền founder rõ ràng; không triển khai bằng cách tự bỏ các bảo vệ khác.
- Lưu nhật ký dữ liệu đầu vào, phiên bản chính sách, đề xuất, người duyệt, thay đổi giá và kết quả đồng bộ; cần chính sách sao lưu/khôi phục và quyền truy cập.
- Python + PostgreSQL là hướng công nghệ trong nguồn, chưa được kiểm chứng tại BossTele. OpenAI Agents SDK và Anthropic Agent SDK còn là lựa chọn mở; không tự chọn, cài hay suy diễn tính năng SDK từ bản kế hoạch.
- Không đưa dữ liệu doanh nghiệp/bí mật vào dịch vụ AI mới hoặc plugin ghi nhớ chỉ từ việc tiếp nhận bản kế hoạch. Claude-Mem vẫn chưa được bật theo trạng thái hiện tại.

## Điều kiện trước khi triển khai phép tính giá
Claude lập đặc tả với dữ liệu mẫu và tiêu chí nghiệm thu. Người dùng chốt định nghĩa lợi nhuận, rank, chi phí, làm tròn, M0, trigger, day-to-sell, ánh xạ sản phẩm và phạm vi duyệt. Codex triển khai bằng dữ liệu thử; kiểm tra các biên rank, thiếu/trùng SKU, dữ liệu cũ/thiếu, chưa bán và chạm vốn. Claude kiểm tra kết quả độc lập. Quyền đồng bộ thật được xác định trong công việc riêng.

Mọi kết quả sau này phải chỉ ra dữ liệu nào được dùng, công thức/phiên bản chính sách, giới hạn và phần chưa xác minh. Không gọi demo hoặc mô phỏng là cập nhật giá thực tế.
