# Hướng dẫn Website_3Q / BaoQ Luxury

## Tổng quan
Menu Tổng quan (#overview), quyền dashboard.view: theo dõi doanh thu, trạng thái đơn và các khoảng ngày. Đây là dữ liệu mẫu lưu trong trình duyệt, server trợ lý không có số liệu này. Xem trực tiếp trên trang, không dùng như báo cáo kinh doanh thật. Xuất báo cáo CSV cần reports.export.

## Tìm kiếm
Menu Tìm kiếm (#search), quyền products.view: tìm tên hoặc SKU không dấu; đồng bộ danh mục KiotViet chỉ đọc, xem chi tiết, tồn, giá bán, danh mục, thương hiệu. Giá vốn cần products.cost. Nhãn Hot trend đánh dấu sản phẩm có dấu ! trong tên; nhãn tồn kho cho biết còn, hết hoặc sắp hết hàng. Bấm sản phẩm để xem chi tiết và tồn theo chi nhánh. Dữ liệu có thời điểm đồng bộ; nguồn lỗi có thể giữ dữ liệu cũ. Không sửa dữ liệu KiotViet từ trang này.

## Sản phẩm
Menu Sản phẩm (#products), quyền products.view: danh sách dữ liệu mẫu trong trình duyệt; thêm/sửa sản phẩm mẫu cần products.edit. Dữ liệu mẫu này khác danh mục thật ở Tìm kiếm. Trợ lý không đọc localStorage và không có số liệu sản phẩm mẫu.

## Đơn hàng
Menu Đơn hàng (#orders), quyền orders.view; xử lý cần orders.edit. Đây là dữ liệu mẫu trong trình duyệt, không phải đơn hàng thật. Xem/lọc trực tiếp tại Đơn hàng; trợ lý không có số liệu. Xuất CSV cần reports.export.

## Khách hàng
Menu Khách hàng (#customers), quyền customers.view; sửa cần customers.edit. Danh sách là dữ liệu mẫu lưu trong trình duyệt, trợ lý không đọc được. Xem trực tiếp tại Khách hàng.

## Tài liệu
Mục Tài liệu (hỏi đáp PDF nội bộ) hiện đang tắt, không có trên menu. Trợ lý không trả lời theo tài liệu PDF.

## Nhân viên
Thêm nhân viên ở menu Nhân viên (#team), nút Thêm nhân viên. Xem danh sách cần staff.view; thêm, sửa nhân viên, vai trò và quyền cần staff.manage. Dùng email Google đã được cho phép để đăng nhập. Có thể đặt trạng thái đang hoạt động hoặc tạm ngưng. Quyền thực tế có thể tùy chỉnh theo nhân viên; thiếu quyền hãy nhờ Admin kiểm tra.

## Nhật ký
Menu Nhật ký (#audit), quyền audit.view: xem thời gian, người thực hiện, hành động; lọc hành động hoặc mã nhân viên, phân trang. Gồm đăng nhập/đăng xuất, thêm/sửa nhân viên, tải/xóa tài liệu. Trợ lý chỉ đọc nhật ký, không sửa hay xóa.

## Cài đặt
Menu Cài đặt (#settings), quyền settings.manage: thiết lập cửa hàng trong giao diện mẫu lưu trình duyệt. Không đổi kết nối hoặc khóa API qua trợ lý.

## Vai trò và quyền mặc định
Admin (ADMIN) có mọi quyền. Quản lý (MANAGER) có mọi quyền trừ staff.manage, settings.manage, audit.view, products.cost, documents.manage. Nhân viên (STAFF) có dashboard.view, products.view, orders.view, orders.edit, customers.view, customers.edit. Quyền thực tế do máy chủ xác định; menu chỉ hiện theo quyền hiện tại. Trợ lý chỉ đọc, không tạo đơn, sửa giá hay thay quyền. Chào bạn, trợ lý hỗ trợ các câu hỏi về Website_3Q và BaoQ Luxury.

## Tính giá bán
Trợ lý tính giá bán theo vốn bằng công thức của BossTele (công cụ tinh_gia). Markup: (vốn + chi phí) × (1 + tỷ lệ/100). Margin: (vốn + chi phí) / (1 − tỷ lệ/100), margin phải dưới 100%. Làm tròn lên đến đồng. Có thể nhập số vốn, hoặc đưa SKU để lấy giá vốn KiotViet (cần quyền products.cost). Kết quả là giá theo mục tiêu, không tự cập nhật lên KiotViet.
