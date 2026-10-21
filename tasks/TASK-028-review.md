# TASK-028 — Review: bong bóng chat trợ lý Website_3Q

- Người review: Claude. Trạng thái: verified (build/test, chạy thật với Ollama `qwen3:8b`, giao diện); qua phiên Google thật trên web: chờ Bảo thử.

## Bằng chứng
- `npm run build`: đạt. `npm test`: 22 file, 351/351 đạt (gồm 4 file test mới; 18 file test cũ không đổi). `/api/assistant/chat` chưa đăng nhập → 401.
- Chạy thật (embedding/KiotViet/Ollama thật, gọi `chat()` trực tiếp):
  - "SP000094 còn hàng không?" → đúng tên, tồn 1, giá 35.000.000 (Admin còn thấy giá vốn), nguồn SKU. 47 s lần đầu (đồng bộ danh mục + nạp mô hình).
  - "Thêm nhân viên ở đâu?" → menu Nhân viên, quyền `staff.manage`, nguồn Hướng dẫn. 6 s.
  - "Cho tôi xem danh sách nhân viên" với quyền STAFF → báo không có quyền, không lộ dữ liệu.
  - "Hàng hot trend có những món nào?" → liệt kê hàng có "!" kèm giá, tồn. 35 s.
  - "Thời tiết…", "Viết code Python…", "Kể chuyện cười" → câu từ chối cố định, `offTopic: true`, < 1 s.
  - "Quy trình ký gửi thế nào?" → đi vào trợ lý, trả lời chưa có thông tin (chưa có PDF nào được tải lên).
- Giao diện (phiên giả lập, phản hồi giả): nút tròn góc phải, khung "Trợ lý BaoQ · Chỉ hỗ trợ về Website_3Q", lời chào, tin người dùng bên phải nền tím, tin bot bên trái, chip nguồn, giờ gửi, nút đóng ✕.

## Claude sửa sau lần chạy thật đầu tiên
- Trung bình — classifier `qwen3:8b` chặn nhầm câu đúng chủ đề ("Quy trình ký gửi thế nào?", "danh sách nhân viên"). `graph.ts`: thêm ví dụ vào prompt phân loại; nếu mô hình không trả `ON` nhưng câu chứa thuật ngữ rõ ràng của cửa hàng (sản phẩm, SKU, tồn kho, ký gửi, tài liệu, nhân viên, nhật ký, thương hiệu…) thì vẫn cho qua; còn lại giữ fail-closed. Test fail-closed cũ vẫn đạt.
- Trung bình — không liệt kê được hàng Hot trend. `tools.ts`: `tim_san_pham` thêm `hot_trend` (q có thể null), lọc tên có "!", tối đa 10 món; `limit` thường giữ ≤ 5.
- Thấp — trả lời chứa `**…**` trong khi widget hiện text thuần. `graph.ts`: bỏ nhấn mạnh/heading Markdown trước khi trả.

## Giới hạn
- Bộ lọc từ khóa có thể cho qua câu ngoài luồng có chứa từ của cửa hàng; khi đó prompt trợ lý vẫn yêu cầu chỉ dùng dữ liệu công cụ, nhưng mô hình nhỏ không đảm bảo tuyệt đối.
- Đơn hàng, Khách hàng, Tổng quan là dữ liệu mẫu trong trình duyệt — trợ lý không đọc được.
- Danh sách nhân viên/nhật ký cần DB; chưa thử với DB thật trong lần này.

## Kết luận
verified, kèm giới hạn trên.

## Cập nhật (Bảo, 2026-10-17): tắt mục Tài liệu
- `App.jsx`: bỏ `['documents','bag','Tài liệu']` khỏi `nav` (có comment cách bật lại); trang `#documents` không mở được. Code, API `/api/documents/*` và test TASK-027 giữ nguyên.
- `websiteGuide.md`: mục Tài liệu ghi "đang tắt". Gợi ý widget "Quy trình ký gửi thế nào?" đổi thành "Hàng hot trend có những món nào?" (cập nhật `TASK-028-ui-selfcheck.mjs` tương ứng).
- Build đạt; 351/351 test; selfcheck widget đạt.

## Cập nhật (Bảo, 2026-10-17): gắn tính giá BossTele + giờ Việt Nam
- `tools.ts`: công cụ mới `tinh_gia` gọi `BossTele/lib/target-price.js` (`calculateTargetPrice`, BigInt, làm tròn lên) — markup/margin, `von` nhập tay hoặc `sku` lấy giá vốn KiotViet (cần `products.cost`; nhiều chi nhánh khác giá → dùng giá cao nhất, có ghi chú). Nạp lười để import module không phụ thuộc URL `file:`. Schema không dùng transform (JSON Schema không biểu diễn được). Kèm câu nhắc "giá theo mục tiêu, không cập nhật KiotViet".
- Nhật ký: thời gian hiển thị giờ Việt Nam (`Asia/Ho_Chi_Minh`) thay cho UTC.
- `graph.ts`: thêm từ khóa tính giá/markup/margin/lợi nhuận vào bộ lọc chủ đề. `websiteGuide.md`: mục "Tính giá bán".
- Test: mới `assistantPrice.test.ts` (9 test). Cập nhật số công cụ 5 → 6 trong `assistantModel.test.ts` và `TASK-028-selfcheck.mjs` (đổi có chủ đích, có comment).
- Bằng chứng: build đạt; 23 file, 360/360 test; selfcheck 50/50. Chạy thật Ollama: "vốn 31 triệu markup 15%" → 35.650.000 (đúng); "SP000094 margin 20%" → 38.750.000 (31.000.000 / 0,8, đúng); người không có `products.cost` → báo không có quyền; nhật ký hiện 14:35:10 17/10/2026 (đúng giờ VN).
- Bảo thấy câu trả lời "2 phần" (nội dung + chip nguồn lặp lại từng món). `AssistantWidget.jsx`: thay danh sách chip bằng một dòng nhỏ "Nguồn: …" gom theo loại (ví dụ "KiotViet · 3 sản phẩm", "công thức tính giá BossTele"); CSS `.assistant-sources` thành chữ mờ một dòng. Build đạt, 360/360 test, selfcheck widget đạt; trình duyệt hiển thị đúng.
- Bảo: câu trả lời danh sách sản phẩm "gói mắt". `tools.ts` trả thêm `products` (SKU, tên, giá, tồn, hot trend, ảnh https KiotViet) từ `tim_san_pham`; `graph.ts` gom tối đa 10 thẻ, chỉ thêm `products` vào response khi có; prompt dặn mô hình chỉ tóm tắt 1–2 câu khi đã có thẻ. Widget: thẻ sản phẩm (ảnh 44px, tên 2 dòng, SKU, giá, nhãn Còn N/Hết hàng/Hot), đoạn văn tách dòng thoáng hơn; CSS scoped mới. Chạy thật Ollama "hàng hot trend": tóm tắt 1 câu + 10 thẻ, 10/10 ảnh tải được. Build đạt, 360/360 test, 2 selfcheck đạt.
- Bảo: bỏ chữ "Website_3Q" trên khung chat. Bỏ dòng phụ dưới tiêu đề; placeholder "Nhập câu hỏi…"; lời chào "Chào bạn, mình có thể giúp gì cho bạn?"; câu từ chối "…về BaoQ Luxury (…)"; prompt dặn không nhắc tên Website_3Q. Cập nhật `TASK-028-ui-selfcheck.mjs` theo chữ mới. Build đạt, 360/360 test, 2 selfcheck đạt.
- Bảo: trả lời ngắn, dạng thẻ, không văn dài. `graph.ts`: khi có thẻ sản phẩm, server thay chữ của mô hình bằng một dòng cố định "Có N sản phẩm [Hot trend] phù hợp:" (mô hình nhỏ vẫn liệt kê tên dù đã dặn); câu trả lời khác giới hạn 600 ký tự và prompt dặn tối đa 3 câu ngắn. Chạy thật: "hottrend của LV" → "Có 5 sản phẩm Hot trend phù hợp:" + 5 thẻ; "SP000094 còn hàng không?" → "Có 1 sản phẩm phù hợp:" + 1 thẻ. Build đạt, 360/360 test, selfcheck đạt.

## Cập nhật (Bảo, 2026-10-17): gợi ý tên thương hiệu khi gõ sai
- `catalogStore.ts`: thêm `brands()` — tên thương hiệu (tradeMarkName) từ danh mục KiotViet đã đồng bộ (hiện 85 tên), tự cập nhật theo KiotViet.
- Mới `services/assistant/brands.ts`: `findBrandTypos` so từng cụm 1–3 từ trong câu hỏi với tên thương hiệu và bí danh (Saint Laurent→YSL, Bvlgari→BVL, Van Cleef→VCA…) bằng khoảng cách Damerau–Levenshtein; tên < 5 chữ cái không sửa (LV, MCM, Dior…), 5–7 chữ cho sai 1, ≥ 8 chữ cho sai 2, phải trùng chữ đầu; bỏ "Brand lạ". Không đọc được danh mục → bỏ qua kiểm tra.
- `graph.ts`: phát hiện gõ sai → trả ngay "Có phải bạn muốn tìm "Chanel"?" + `suggestions` (câu đã sửa), không gọi mô hình. Widget: nút gợi ý dưới tin bot, bấm là gửi câu đã sửa.
- Test mới `assistantBrands.test.ts` (11). Build đạt; 24 file, 371/371 test; 2 selfcheck đạt. Chạy thật: "Chanle"→Chanel, "hermess"→Hermes, "Balenciga"→Balenciaga, "Louis Vuiton"→Louis Vuitton (gợi ý tức thì); "Gucci", câu không có thương hiệu → trả lời bình thường. Trình duyệt: bấm gợi ý gửi đúng câu đã sửa và hiện thẻ sản phẩm.

## Sửa lỗi bịa dữ liệu (Bảo, 2026-10-17)
- Phát hiện: "mẫu hot chanel" → bot trả "Chanel Classic Flap Bag (SKU: CH001), tồn 50, giá 1.200.000 VND" — **bịa**: không có SKU CH001 trên KiotViet; thực tế có 2 món Chanel hot trend (SP024215 146.000.000đ, SP024033 95.000.000đ). Nguyên nhân: qwen3:8b không gọi công cụ, bắt chước câu trả lời cũ trong lịch sử.
- Sửa 1 — tra bằng code: mới `services/assistant/router.ts` `productQuery` nhận ra câu hỏi sản phẩm (SKU `SP\d+`; thương hiệu chính xác/bí danh như LV; "hot/trend/hottrend"; từ loại hàng như túi, giày, đồng hồ) → gọi thẳng `tim_san_pham`, trả "Có N sản phẩm … phù hợp (hiện 10 món mới nhất):" + thẻ, không qua mô hình; không có kết quả → "Không tìm thấy sản phẩm … trên KiotViet." `tim_san_pham` thêm `brand` (lọc theo thương hiệu KiotViet, không theo tên) và lọc thêm từ khóa trong tên; trả `total`.
- Sửa 2 — chốt chặn: câu trả lời của mô hình có SKU/giá/số tồn mà lượt đó không gọi công cụ nào → thay bằng "Mình chưa tra được dữ liệu cho câu này…".
- Chạy thật: "mẫu hot chanel" → 2 thẻ đúng SP024215, SP024033; "hottrend của LV" → 8 thẻ; "SP024215 giá bao nhiêu" → 1 thẻ; "túi Hermes" → 260 món, hiện 10 mới nhất; "giày Dior" → 39; hướng dẫn, tính giá, câu ngoài luồng vẫn đúng.
- Test mới `assistantRouter.test.ts` (13). `TASK-028-selfcheck.mjs` đổi câu SKU sang câu đi qua mô hình (SKU nay được code xử lý). Build đạt; 25 file, 384/384 test; 2 selfcheck đạt.

## Hiểu câu nối tiếp + bộ lọc (Bảo, 2026-10-17)
- Bảo hỏi "mẫu khác" thì bot từ chối. `router.ts`: `resolveProductQuery` nhận câu nối tiếp ngắn (≤ 4 từ: "mẫu khác", "xem thêm", "còn nữa không", "tiếp"…) → lấy lại câu tra sản phẩm gần nhất trong lịch sử, sang trang sau (10 món/trang). Bộ lọc đọc từ câu hỏi: giá ("dưới 50 triệu", "từ 30 đến 60 triệu", "trên 100tr"), "còn hàng", sắp xếp "rẻ nhất"/"đắt nhất"; "túi" (có dấu) lọc loại túi. `tim_san_pham` thêm `in_stock`, `min_price`, `max_price`, `sort`, `offset`; hàng chưa có giá (0đ) xếp cuối khi sắp theo giá.
- Chạy thật hội thoại: "túi Chanel" → 230 món; "mẫu khác" → 11–20/230; "Thêm nhân viên ở đâu?" → hướng dẫn (không bị nhầm là "xem thêm"). "túi Hermes dưới 50 triệu", "Gucci còn hàng rẻ nhất" (bắt đầu 200 nghìn, không còn món 0đ), "túi LV từ 30 đến 60 triệu còn hàng", "đồng hồ Cartier đắt nhất" đều đúng bộ lọc.
- Test `assistantRouter.test.ts` mở rộng (19). Build đạt; 25 file, 390 test đạt; 2 selfcheck đạt.

## Câu hỏi giá chốt (Bảo, 2026-10-17)
- Lỗi: "SP014899 … đề xuất giá chốt cho khách" → bot chỉ trả thẻ sản phẩm (bộ định tuyến thấy SKU). Chính sách giá chốt BaoQ chưa duyệt (`BossTele/docs/PRICE-SYSTEM.md`), nên bot không được tự đặt con số.
- Mới `services/assistant/pricing.ts` (chạy trước tra sản phẩm): nhận "giá chốt / chốt giá / đề xuất giá / giảm được bao nhiêu / lời-lãi bao nhiêu / giá vốn" + SKU (lấy SKU ở câu hiện tại hoặc lượt trước). Có `products.cost`: trả giá bán, giá vốn (cao nhất các chi nhánh), đang lời bao nhiêu (% trên vốn và trên giá bán), nói rõ chính sách chưa duyệt, kèm nút "lời 10/15/20%". "lời X%" → giá thấp nhất = công thức markup BossTele, và "có thể giảm tối đa …" hoặc cảnh báo giá hiện tại đã thấp hơn mức đó. Thiếu `products.cost` → chỉ giá bán, không lộ vốn.
- Chạy thật: SP014899 → giá bán 26.000.000đ, vốn 29.400.000đ, **đang lỗ 3.400.000đ**; "lời 15%" → 33.810.000đ, cảnh báo giá hiện tại thấp hơn 7.810.000đ. SP024215 "lời 10%" → 126.500.000đ, có thể giảm tối đa 19.500.000đ.
- Test mới `assistantPricing.test.ts` (6). Build đạt; 26 file, 396/396 test; 2 selfcheck đạt.
- Bảo hoãn việc cho bot tự đề xuất giá chốt theo bảng lợi nhuận mẫu (PRICE-SYSTEM) — "tính sau, nhớ nhắc". Chưa thay đổi code; đã ghi nhắc vào memory của Claude.
- Bảo: câu trả lời giá chốt chỉ cần ngắn → `pricing.ts` trả "Chưa đề ra giá chốt." (vẫn kèm thẻ sản phẩm và nút "lời 10/15/20%"). Build đạt, 396/396 test.
