# Lịch tự động cập nhật giá Kiot — TASK-137, TASK-138

Chỉ bật trên **một máy**: các máy có kho riêng, bật đồng thời sẽ ghi Kiot hai lần.

1. Không cần sửa `.env`. Mọi máy chạy Sale AI đều có thể bật/tắt và đổi giờ trên trang.
2. Vào Sale AI → Kết quả, bật công tắc và xác nhận ngay trên trang. Mặc định **Tắt, 10:00**. Dùng **Đổi giờ**, chọn HH:MM, Lưu và xác nhận để đổi giờ.
3. Lịch chỉ nhận lượt khi công tắc trong kho của máy đó là **Bật**, theo điều kiện lịch bên dưới. Tắt công tắc ngừng nhận lượt mới; giao diện khoá cài đặt trong lượt đang chạy.

Lịch luôn dùng giờ Việt Nam (Asia/Ho_Chi_Minh), Thứ 2–Thứ 7, nghỉ Chủ nhật. Kiểm tra mỗi 15 giây. Cửa sổ chạy là **5 phút**, gồm thời điểm đã cài và không gồm thời điểm cộng đúng 5 phút. Máy tắt/ngủ quá cửa sổ sẽ bỏ ngày đó, không chạy bù. Khi đổi giờ, lần tới hiển thị trên trang; ngày đã nhận lượt sẽ không chạy thêm dù đổi giờ hoặc khởi động lại. Ngày được lưu **trước khi tải Kiot**; đang bận cũng ghi nhận ngày và không thử lại.

Kho cài đặt `server/data/sale-ai/auto-update.json` nằm ngoài thư mục công khai, gồm giờ, công tắc, ngày nhận lịch và nhật ký thay đổi cài đặt (ai, trước/sau, thời gian) cùng các lượt không ghi Kiot. Các mục này xuất hiện trong **Lịch sử Sale AI**. Nhật ký ghi giá vẫn dùng kho `kiot-state.store` hiện có. Không chuyển/xoá các file kho để tránh mất dấu ngày đã chạy.

Lượt tự động tải lại Kiot, dựng bảng hôm nay và chọn mọi trang, chỉ M1–M6 lệch giá. M0 không ghi. Trên **2.000 món** lệch giá thì dừng để kiểm tra tay (tính cả món sau đó bị giữ vì sửa tay). Không có món cần đổi vẫn lưu Lịch sử. Lượt bận, tải lỗi và vượt ngưỡng đều có dòng Lịch sử.

Giá mong thấy là giá ghi và xác minh thành công gần nhất trong nhật ký `updates` theo ID Kiot, kể cả cập nhật tay/khôi phục. Không lấy lượt chưa xác minh, lỗi hoặc chỉ đọc thấy đã đúng giá. Chưa từng ghi thì dùng P0. Giá hiện tại khác giá mong thấy sẽ được giữ và liệt kê tại **Giữ giá sửa tay** với giá hiện tại, giá Sale AI ghi trước, giá dự kiến. Không tính là lỗi, không vào thử lại. Bảo có thể cập nhật tay như trước; lần ghi thành công đó thành mốc đối chiếu mới.

Chỉ ghi giá Kiot, theo luồng chuẩn: khoá chung, policy, dấu vân tay, lô 50, nhật ký trước gửi và xác minh sau ghi. Trạng thái `unknown` không được tự gửi lại. Không ghi mô tả, không gọi Sapo, không nhắn Telegram. Mọi kết quả và lỗi xem tại Lịch sử; các món lỗi dùng chức năng cập nhật lại hiện có.

Kiểm thử nghiệm thu do Claude chạy theo `tasks/TASK-137-spec.md` và `tasks/TASK-138-spec.md`, chỉ bằng đồng hồ và adapter giả. Không dùng dữ liệu/kết nối thật để chạy test.
