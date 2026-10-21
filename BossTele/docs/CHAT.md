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

## Bot Telegram riêng (TASK-030)
Claude Code channels chưa được Anthropic bật cho tài khoản này (`Channels are not currently available`), nên BossTele dùng bot riêng `telegram-bot.js` thay cho plugin.

- Chạy cùng web: `npm run dev` tại `D:\Website_3Q` (đặt `BOSSTELE=0` để chỉ chạy web). Chạy riêng: `node telegram-bot.js` tại `BossTele`. Bot lỗi không làm tắt web.
- Token và danh sách người được phép đọc từ `~/.claude/channels/telegram/.env` và `access.json` (`allowFrom`). Người lạ và nhóm bị bỏ qua, không trả lời.
- Lệnh ở mục Mẫu câu do bot tự xử lý bằng `createChatSession`, không gọi Claude.
- Câu còn lại hỏi server web trước (`POST /internal/assistant`, TASK-032): server chạy đúng phần trả lời bằng code của trợ lý web (sửa chính tả thương hiệu, giá chốt, tra sản phẩm, "mẫu khác") với quyền `products.view` + `products.cost`. Bot gửi dòng tóm tắt rồi mỗi sản phẩm một thẻ ảnh (tên, SKU, giá, tồn, Hot); gợi ý thành nút trả lời. Đường này chỉ nhận kết nối từ chính máy và header `x-internal-token` = `INTERNAL_TOKEN`; `npm run dev` tạo token mới mỗi lần chạy và truyền cho cả server lẫn bot. Không có token hoặc server tắt thì bot chuyển sang Claude.
- Câu server không tự trả lời được mà qua `storeQuestion` thì gửi tới `claude -p` (gói Claude của Bảo, chỉ riêng Bảo dùng), chỉ được chạy `node catalog.js` (danh mục KiotViet giống trang Tìm kiếm của web, đọc `server/data/catalog-cache.json`, mới nhất trước, có giá vốn cao nhất giữa các chi nhánh) và `node search-products.js` (kiểm tồn trực tiếp). Claude trả lời theo mẫu trợ lý web: một dòng tóm tắt rồi mỗi sản phẩm một dòng `• SKU · Tên · Giá · Còn N`, tối đa 10 dòng, "mẫu khác" để xem tiếp. Mỗi chat giữ một cuộc hội thoại Claude, làm mới sau 30 phút không nhắn. Câu khác, ảnh, tệp nhận câu từ chối cố định.
- Giá thị trường (2026-10-20, `lib/market-lookup.js`, skill `.claude/skills/tra-gia-thi-truong/SKILL.md`): tin có "thị trường", "giá ngoài", "giá tham khảo", "trên mạng/google", "giá hãng", "resale" hoặc tên trang bán lại (Fashionphile, Vestiaire…) đi nhánh này trước giá sale và trợ lý web. Bot tra SKU trong tin qua server web (tên, giá niêm yết, tồn, ảnh; không gửi giá vốn), lấy tỷ giá hôm nay từ open.er-api.com, rồi gọi `claude -p` một lần với nội dung SKILL.md làm hướng dẫn và ảnh sản phẩm đính kèm. Phiên này chỉ có WebSearch/WebFetch: không Bash, không đọc file, không MCP, không cài đặt/hook người dùng, chạy trong thư mục tạm rỗng, nên trang web lạ không lái được nó đọc `.env` hay dữ liệu shop. Trả về tối đa 3 tin (tóm tắt giá hãng + secondhand thấp/trung bình/cao, nguồn kèm link, so với giá shop), tắt xem trước link; mất khoảng 2–3 phút, bot gửi "Đang tra…" và giữ trạng thái đang nhập. Sửa cách tra hoặc định dạng trong SKILL.md, không cần sửa code.
- Plugin `telegram@claude-plugins-official` phải tắt (`enabledPlugins` trong `~/.claude/settings.json` = false); nếu bật, mọi phiên Claude sẽ giành bot (lỗi `Conflict`). Bản sao cài đặt cũ: `settings.json.before-bosstele-bot.bak`.
- Trí nhớ (TASK-034, `lib/boss-memory.js`, dữ liệu ở `data/memory/`, không đưa lên git): mỗi chat giữ 20 lượt gần nhất trong `chat-<id>.json` (khởi động lại vẫn nhớ, "mẫu khác" vẫn chạy); Claude nhận 10 lượt gần nhất, kể cả câu bot tự trả lời bằng code. Sổ ghi nhớ dài hạn `BOSS.md` (tối đa 50 dòng "- ", sửa tay được) được gửi kèm mỗi lần gọi Claude. Bảo nhắn `nhớ: …` / `quên: …` / `/nho` để thêm, xóa, xem; Claude tự thêm bằng dòng `GHI NHỚ: …` khi Bảo dặn thói quen hay quy ước, bot lưu và báo "(Đã ghi nhớ: …)".
- Bot xử lý từng tin một: khi Claude đang trả lời (khoảng 10–60 giây), tin sau phải chờ.

Ghép nối người dùng mới (Bảo 20/10/2026): `access.json` để `dmPolicy: pairing`. Người chưa có quyền nhắn bot thì nhận **mã ghép nối** 6 ký tự (hạn 1 giờ, mỗi người một mã). Bảo duyệt trên máy: `node lib/telegram-access.js approve <MÃ>` (hoặc nhờ Claude Code chạy), không duyệt qua Telegram. Bot đọc lại danh sách mỗi tin nên không cần khởi động lại. Người được thêm thấy giá vốn, lời và dùng Claude như Bảo.

Ảnh sản phẩm → bản nháp (Bảo 20/10/2026, chỉ soạn nháp): gửi ảnh vào bot, chữ kèm ảnh là thông tin của Bảo (giá thu, tình trạng…). Mặc định soạn nháp lên Kiot theo skill baoq-up-kiot. Chữ kèm có "web" thì soạn nháp đăng web (dang-san-pham-baoq; có "giày/dép/guốc" thì dang-giay-baoq). Skill đọc từ `~/.claude/skills/synced` (đồng bộ từ claude.ai). Claude chỉ có WebSearch/WebFetch, không có công cụ ghi; bot ghi rõ "Bản nháp — chưa ghi lên đâu cả". Skill kế toán chưa gắn: cần file sổ đối soát (.xlsx) đang nằm trong project trên claude.ai.

## Các trường hợp thu mua và bán (Bảo 20/10/2026)

| # | Trường hợp | Bot làm gì | Ở đâu |
|---|---|---|---|
| 2 | Cùng tên khác mẫu | Chỉ tính món cùng mẫu, size, chất liệu; ghi SKU các món đã dùng | luật trong `lib/listing-draft.js` |
| 3 | Giá Kiot là giá niêm yết | Ưu tiên món đã bán; món còn hàng quá 60 ngày không làm giá giữa | như trên |
| 4 | Ít mẫu hoặc cũ | Dưới 2 món hoặc cũ hơn 6 tháng thì tra thêm web, ghi `(Kiot+web)` | như trên |
| 6 | Hàng hiếm, giá trị cao | Từ 200tr hoặc tên có từ khóa (Birkin, Kelly, VCA, Patek…) thì ghi cần Bảo/Nguyên duyệt | `price-tiers.json` → `founderReview` |
| 7 | Danh mục khác túi | Mỗi danh mục Kiot một bảng lời; chưa có bảng thì không gợi ý giá thu | `price-tiers.json` → `categories` |
| 8 | Lô nhiều món | Album ảnh = một món nhiều góc; album có chữ "lô"/"mỗi ảnh" = mỗi ảnh một món, có giá thu từng món và tổng | `collectAlbum`, `withLotPrices` |
| 9 | Web còn bán nhưng Kiot hết/đang giữ | Nhắn "lệch kho"; 9 giờ sáng tự báo Bảo nếu có. Chỉ đọc Sapo, không sửa web | `lib/stock-gap.js` |
| 10 | Khách đã cọc giữ | Kiot đặt hàng (`reserved`) → báo "Đang giữ cho khách (đã cọc)" trên bot và trợ lý web | `held()`, `tools.ts` |
| 11 | Nhân viên chốt dưới vốn | Nhân viên không thấy vốn; bot nhắn Bảo "… dưới vốn X. Cần anh duyệt." | `closeSuggest` |
| 12 | Nhân viên thấy giá vốn | Mọi người trừ chủ (`owner` trong access.json, mặc định id đầu tiên) không thấy vốn, lời, % lời | `staff`, `BOSSTELE_HIDE_COST`, header `x-bosstele-staff` |

Chưa làm: giá bán thật theo hóa đơn Kiot (trường hợp 3 đầy đủ), kiểm định hàng giả (1), tách hàng ký gửi (5).

## Bộ lọc plugin Telegram (cũ, plugin đang tắt)
Plugin `telegram@claude-plugins-official` đã được nối bộ lọc qua `lib/telegram-product-guard.js`. Sau khi quyền truy cập/pairing và phản hồi cấp phép được xử lý, tin nhắn văn bản khớp các mẫu lệnh ở trên, hoặc câu tự do về sản phẩm, giá, tồn kho, thương hiệu, khách hàng, doanh thu của BaoQ (TASK-029), được chuyển sang Claude. Câu ngoài phạm vi nhận câu từ chối cố định trực tiếp từ plugin, không gửi notification chat tới Claude. Media/tệp đính kèm bị từ chối, kể cả caption khớp mẫu, trước khi tải file.

Khởi động lại phiên Claude đang kết nối bot để nạp bản sửa. Tại PowerShell trong `D:\Website_3Q\BossTele`, sau khi thoát phiên cũ:
```powershell
claude --channels plugin:telegram@claude-plugins-official
```

Câu tự do được nhận khi có từ khóa cửa hàng (`storeQuestion` trong `lib/telegram-product-guard.js`), ví dụ `túi Chanel nào đang bán chạy?`, `SP014899 lời bao nhiêu`. Câu không có từ khóa, câu ghép bằng `;`, ký tự điều khiển hoặc hơn 500 ký tự vẫn bị chặn. Đây là bộ lọc theo từ khóa, không hiểu nghĩa: câu ngoài luồng có chứa từ khóa vẫn có thể lọt qua. Câu tự do chạy bằng gói Claude của Bảo, chỉ dùng cho riêng Bảo. Tin nhắn hợp lệ vẫn đi qua Claude và có thể dùng lượt model; khác với AI đang tắt trong chat terminal. Không áp dụng giới hạn sản phẩm cho cuộc chat phát triển trực tiếp với Codex/Claude.

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

## Giá chốt với khách

Giá chốt với khách (TASK-040, Bảo 20/10/2026): "SP… giá chốt" (hoặc "khách trả…", "giá chốt nên là nhiu" ngay sau một thẻ) → bot gửi thẻ có giá bán, vốn, lời, tuổi tồn, M, Hot, Sale AI, rồi hỏi khách trả bao nhiêu (nút Tra giá thị trường, Bỏ qua). Gõ giá (58tr, 58,5 triệu, 58tr5, 58.000.000) → dòng lời/thấp hơn giá bán do code tính, kèm một dòng gợi ý của Claude dựa trên dữ kiện và góp ý cũ. Nút Hợp lý / Chưa đúng → Chưa đúng thì Bảo gõ giá chốt và lý do. Góp ý lưu ở `BossTele/data/price-feedback.jsonl` (không vào git), lần sau hỏi cùng SKU hoặc cùng mẫu (3+ chữ trùng trong tên) Claude đọc lại. Công thức giá chốt chưa có (PRICE-SYSTEM, TASK-040 phần tính giá để sau); gợi ý không phải công thức.

## AI và giới hạn
AI mặc định tắt, chưa có model/SDK/network provider. `phân tích giá` hợp lệ trả “Chưa cấu hình nhà cung cấp AI”, số lượt gọi model vẫn 0. Điểm nối tương lai chỉ nhận task cố định, các trường sản phẩm đã chọn và phép tính; không nhận dòng chat gốc, lịch sử, khóa hoặc toàn danh mục. Bản hiện tại không có cờ/env cho người dùng tự bật AI.

Để thử bằng pipe trên Windows PowerShell 5.1, đặt `$OutputEncoding = [System.Text.UTF8Encoding]::new($false)` trước khi gửi tiếng Việt sang Node; gõ trực tiếp trong terminal UTF-8 tránh lỗi mã hóa pipe.

Không có web, tài khoản nhiều người, Sapo POS, tự động sale hoặc ghi API. AI phục vụ phát triển/review code là quá trình riêng, không phải lượt AI trong ứng dụng. Chưa đo tỷ lệ tiết kiệm token.
