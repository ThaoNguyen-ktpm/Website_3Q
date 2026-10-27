# Nguồn tham khảo của skill tra-gia-thi-truong

Tìm trên GitHub ngày 20/10/2026 (từ khóa: luxury resale price, claude skill price comparison, fashionphile/vestiaire scraper, SKILL.md shopping). Không có skill hay dự án nào làm đúng việc tra giá túi hiệu secondhand; các repo gần nhất đều nhỏ (dưới 10 sao). Không cài, không chạy script của repo nào; chỉ đọc và viết lại các ý dưới đây bằng lời của BossTele trong SKILL.md.

| Repo | License | Lấy gì | Không lấy vì sao |
|---|---|---|---|
| DaizeDong/shopping-aggregator (`skills/shopping-aggregator/reference/domains/auction-resale.md`) | MIT, © 2026 DaizeDong | Giá đã bán khác giá đang rao; link eBay Sold `LH_Sold=1&LH_Complete=1` (xanh = bán, đỏ = không bán); gộp nhiều tin của cùng một người bán; không trộn tình trạng; ghi mức tin cậy khi chỉ có giá rao | Phần còn lại dành cho Amazon/Taobao/vé máy bay, cần Playwright và sổ cấu hình riêng |
| OmarSaleh506/skills (`skills/shop-scout/SKILL.md`) | MIT, © 2026 Omar Alwahiby | Tìm theo nhóm nguồn cố định bằng `site:`; tìm 0 kết quả thì thử lại một lần; tối đa một lượt tìm rộng, không tìm thêm để săn giá; trang chặn bot thì nói rõ | Cần Firecrawl (Docker tự chạy hoặc API key trả phí) để đọc trang dùng JavaScript; nhắm hàng mới bán lẻ ở Ả Rập |
| kirvahe/claude-buy-skill (`references/price-analysis.md`) | MIT, © 2026 kirvahe | Đối chiếu ý: kết luận giá theo mốc thấp nhất/trung bình (BossTele đã có quy tắc tương tự) | Dành cho mua hàng mới ở Tây Ban Nha (Amazon, Idealo), cần Playwright |
| frshzg/luxury-marketplace-scrapers, amoltathesoftwareengineer/luxury-resale-tracker, các Apify actor Fashionphile/Vestiaire | Không có license | Không dùng | Không có license nên không được chép; scraper cần cookie/Cloudflare hoặc tài khoản Apify trả phí |

Nếu sau này muốn đọc được Shopee/Mercari/Vestiaire ổn định hơn: cân nhắc Firecrawl tự chạy (theo shop-scout) hoặc một API tìm kiếm trả phí. Cả hai cần Bảo đồng ý cài đặt hoặc trả phí trước.
