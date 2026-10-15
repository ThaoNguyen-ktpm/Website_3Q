# Chat terminal BossTele

Chạy tại `D:\Website_3Q\BossTele` bằng `npm.cmd run chat`. Node >= 22; không cần cài dependency mới. API đọc từ `.env` hiện có, không in khóa.

## Mẫu câu
```text
tìm tên "Chanel" nguồn=kiot
tìm sku SP022466 nguồn=sapo
xem thêm
chọn 2
tính giá vốn=150000000 chi_phí=0 cách=markup tỷ_lệ=12.5
phân tích giá
trợ giúp
thoát
```
Các mẫu có dấu, chữ thường và thứ tự tham số như trên. Có thể bỏ `nguồn` để dùng `all` = KiotViet + Sapo Web; không bao gồm POS. Tên cần dấu nháy kép; SKU giữ hoa/thường và dùng chữ/số ASCII, dấu chấm, gạch ngang, gạch dưới hoặc slash. Không nhận câu ghép, ký tự điều khiển hoặc hơn 500 ký tự. Câu sai/ngoài phạm vi nhận câu hướng dẫn cố định, không gọi API/model.

Ví dụ `tôi muốn đi chơi z` bị chặn trước khi gọi API/AI. Trong terminal, bộ lọc chạy trong `chat.js` qua `createChatSession`.

## Bộ lọc Telegram
Plugin `telegram@claude-plugins-official` đã được nối bộ lọc qua `lib/telegram-product-guard.js`. Sau khi quyền truy cập/pairing và phản hồi cấp phép được xử lý, chỉ tin nhắn văn bản khớp các mẫu lệnh ở trên mới được chuyển sang Claude. Câu ngoài phạm vi nhận câu từ chối cố định trực tiếp từ plugin, không gửi notification chat tới Claude. Media/tệp đính kèm bị từ chối, kể cả caption khớp mẫu, trước khi tải file.

Khởi động lại phiên Claude đang kết nối bot để nạp bản sửa. Tại PowerShell trong `D:\Website_3Q\BossTele`, sau khi thoát phiên cũ:
```powershell
claude --channels plugin:telegram@claude-plugins-official
```

Đây là bộ lọc theo mẫu lệnh; câu tự do về sản phẩm cũng cần đổi sang mẫu. Tin nhắn hợp lệ vẫn đi qua Claude và có thể dùng lượt model; khác với AI đang tắt trong chat terminal. Không áp dụng giới hạn sản phẩm cho cuộc chat phát triển trực tiếp với Codex/Claude.

`node scripts/install-telegram-product-guard.js` cài lại bộ lọc nếu cập nhật plugin làm mất bản sửa. Script xác định bản plugin từ registry cục bộ, tạo backup `server.ts.bosstele-before-product-guard-*.bak`, kiểm tra cấu trúc trước khi sửa và đọc lại file sau khi ghi. Đường dẫn bộ lọc gắn với checkout này; giữ `D:\Website_3Q\BossTele` để plugin tải được module.

## Tra cứu và chọn sản phẩm
- Hiển thị tối đa 10 dòng mỗi lần, xen kẽ hai nguồn khi cùng có dữ liệu.
- `xem thêm` dùng hết kết quả đã có trước khi lấy trang tiếp theo. SKU Sapo quét từng trang 250 sản phẩm; nếu chưa quét hết, luôn có cảnh báo. Trang rỗng không chứng minh sản phẩm không có nếu còn trang hoặc lỗi.
- `chọn N` chọn dòng của màn hình kết quả gần nhất. SKU trùng không gộp; giữ nguồn, productId và variantId riêng. Chọn sản phẩm khác hoặc tìm mới sẽ xóa phép tính cũ.
- Kết quả thành công được cache trong bộ nhớ 2 phút, tối đa 50 truy vấn/trang theo LRU; lỗi không cache. Cache gắn với một phiên và bộ cấu hình đã đọc, không chia sẻ giữa cửa hàng hoặc ghi xuống đĩa. Muốn thay khóa/cửa hàng hãy mở lại phiên.
- Luôn hiển thị thời điểm lấy dữ liệu UTC theo ISO; kết quả buffered quá 2 phút có cảnh báo và không tự âm thầm đổi dữ liệu. Tìm lại để làm mới.
- Lỗi từng nguồn vẫn hiện riêng; kết quả nguồn còn lại được giữ. `xem thêm` có thể thử lại nguồn lỗi theo thao tác chủ động của người dùng, không retry tự động.

## Tính giá
Nhập tiền nguyên VND không âm, vốn > 0, tỷ lệ không âm dùng dấu chấm thập phân. Không dùng dấu phân cách hàng nghìn, số mũ hoặc ký hiệu tiền. Margin phải dưới 100%. Bắt buộc nhập cả bốn tham số; chi phí có thể là 0.

`C = vốn + chi_phí`. Markup: `C × (1 + tỷ_lệ/100)`. Margin: `C / (1 − tỷ_lệ/100)`. Phép tính dùng phân số BigInt chính xác và làm tròn lên đến đồng. Hiển thị tham số/công thức; không suy ra mục tiêu từ bảng lợi nhuận trong bản kế hoạch.

Máy tính có thể dùng độc lập; `phân tích giá` cần chọn sản phẩm rồi tính giá cho sản phẩm đó. Giá trả về là giá theo mục tiêu nhập, không kết luận về thị trường và không cập nhật lên Kiot/Sapo.

## AI và giới hạn
AI mặc định tắt, chưa có model/SDK/network provider. `phân tích giá` hợp lệ trả “Chưa cấu hình nhà cung cấp AI”, số lượt gọi model vẫn 0. Điểm nối tương lai chỉ nhận task cố định, các trường sản phẩm đã chọn và phép tính; không nhận dòng chat gốc, lịch sử, khóa hoặc toàn danh mục. Bản hiện tại không có cờ/env cho người dùng tự bật AI.

Để thử bằng pipe trên Windows PowerShell 5.1, đặt `$OutputEncoding = [System.Text.UTF8Encoding]::new($false)` trước khi gửi tiếng Việt sang Node; gõ trực tiếp trong terminal UTF-8 tránh lỗi mã hóa pipe.

Không có web, tài khoản nhiều người, Sapo POS, tự động sale hoặc ghi API. AI phục vụ phát triển/review code là quá trình riêng, không phải lượt AI trong ứng dụng. Chưa đo tỷ lệ tiết kiệm token.
