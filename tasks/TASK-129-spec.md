Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-129: Trợ lý chỉ hiện sản phẩm còn hàng; tìm ra toàn hàng hết thì báo hết hàng

- Dự án: web (trợ lý quản trị) + BossTele (dùng chung câu trả lời)
- Người phụ trách: Codex (làm), Claude (chạy test, review)
- Trạng thái: `ready`
- Hành động gần nhất: 03/11/2026, Claude viết đặc tả theo yêu cầu và ảnh chụp của Bảo.
- Bước tiếp theo: Codex làm, ghi `TASK-129-result.md`; Claude review vào `TASK-129-review.md`.

## Yêu cầu của Bảo (03/11/2026)

Ảnh: khung trợ lý trên web hiện thẻ "CỌC Dây chuyền Van Cleef…", "CỌC Túi LV Carryall…", "Túi LV Capucines BB" đều gắn nhãn **Hết hàng**.

> "sao nó hiện thị hết hàng ko z - hiện thị sản phẩm nào còn thôi chứ nếu tìm mà hết hàng thì báo hết hàng"

## Hiện trạng

- Câu tra sản phẩm đi qua `quickAnswer` → `lookupAnswer` (`server/src/services/assistant/graph.ts:46-87`) → công cụ `tim_san_pham` (`services/assistant/tools.ts:75-105`).
- `productQuery` (`services/assistant/router.ts:48-74`) chỉ đặt `inStock = true` khi câu hỏi có "còn hàng", "còn sẵn", "có sẵn". Mặc định `false`, nên trả cả hàng hết.
- Bộ lọc còn hàng có sẵn: `tools.ts:88`, `(item.onHand ?? 0) > 0`.
- Bot BossTele gọi cùng `quickAnswer` qua `/internal/assistant`, nên sửa ở server áp dụng cho cả web và Telegram.

## Yêu cầu

1. **Mặc định chỉ còn hàng:** câu tra theo tên, thương hiệu, Hot trend, khoảng giá, sắp xếp (không phải SKU) gọi `tim_san_pham` với `in_stock: true`, kể cả khi người hỏi không nói "còn hàng".
2. **Toàn hàng hết thì báo:** nếu kết quả còn hàng = 0 (trang đầu, `offset = 0`), chạy lại đúng truy vấn đó với `in_stock: false`.
   - Có N món (N > 0): trả lời `Có N sản phẩm <mô tả> nhưng đều đã hết hàng.`, **không** gửi thẻ sản phẩm.
   - Vẫn 0: giữ câu cũ `Không tìm thấy sản phẩm … trên KiotViet.`
3. **Câu tiêu đề:** khi có hàng, ghi rõ là hàng còn: `Có N sản phẩm <mô tả> còn hàng` (+ phần "hiện X món mới nhất" như cũ). N là tổng số món **còn hàng**.
4. **"Mẫu khác"/"xem thêm":** phân trang trên danh sách còn hàng; hết trang thì giữ câu `Đã hết sản phẩm … để xem thêm.`
5. **Hỏi đúng hàng hết:** câu có "hết hàng" (ví dụ "túi Chanel nào hết hàng") thì không lọc còn hàng, trả như hiện tại.
6. **Tra theo SKU:** vẫn trả đúng món đó kèm thẻ. Nếu tồn ≤ 0, câu trả lời ghi `<SKU> đã hết hàng.` (giả định: Bảo vẫn muốn thấy thẻ của món đã hỏi đích danh; ghi rõ trong result để Bảo xác nhận).
7. **Món đang cọc** (tồn > 0 nhưng có `reserved`): giữ nguyên cách hiện thị hiện tại, **không** đổi nghĩa "cọc" hay tồn kho trong task này.
8. **Món không quản lý tồn** (`onHand = null`): giữ đúng cách lọc `in_stock` hiện có ở `tools.ts:88`, không đổi.
9. **BossTele, nhánh Claude** (`BossTele/telegram-bot.js`, hằng `SYSTEM`): thêm một dòng hướng dẫn: tra danh sách thì mặc định `node catalog.js ... --in-stock`; không có món còn thì trả "Có N món … nhưng đều đã hết hàng" (chạy lại không có `--in-stock` để đếm). Hỏi đúng hàng hết hoặc theo SKU thì không thêm cờ.

## Ngoài phạm vi

- Trang Tìm kiếm sản phẩm (`frontend/src/price-system.tsx`) và Sale AI: không đổi.
- Không đổi giao diện thẻ, nhãn "Hết hàng"/"Hot", câu trả lời giá chốt/giá sale.
- Không đổi nghĩa tồn/cọc của Kiot (Bảo chưa chốt).

## Vùng code

- **Điểm vào:** `server/src/services/assistant/router.ts` (`productQuery`, giá trị `inStock`); `server/src/services/assistant/graph.ts` (`lookupAnswer`, câu tiêu đề, nhánh 0 kết quả); `BossTele/telegram-bot.js` (`SYSTEM`).
- **Phạm vi ảnh hưởng:**
  - `services/assistant/tools.ts` (`tim_san_pham`, biến `broad` ở dòng 80 phụ thuộc `inStock`; kiểm tra tìm theo từ khóa vẫn đúng khi bật in_stock);
  - `routes/internalRoutes.ts` (`/internal/assistant`, dùng cho bot);
  - nhánh bot `saleAnswer`/`marketAnswer`/`closeProduct` gọi `quick` với SKU (`telegram-bot.js`): SKU phải vẫn trả món hết hàng để tính giá và tra thị trường.
- **Test liên quan:** `server/src/tests/assistantRouter.test.ts`, `assistantGraph.test.ts`, `assistantTools.test.ts`, `assistantBrands.test.ts`, `internalApi.test.ts`; `BossTele/test/telegram-bot.test.js` nếu có kiểm nội dung `SYSTEM`.
  - Test hiện có kỳ vọng `inStock: false` mặc định là thay đổi có chủ đích; sửa kỳ vọng và ghi lý do trong result.
  - Thêm test cho:
    - chỉ còn hàng;
    - toàn hết hàng → câu "đều đã hết hàng", không thẻ;
    - không có gì → câu cũ;
    - "mẫu khác";
    - câu hỏi "hết hàng";
    - SKU hết hàng;
    - SKU dùng cho giá chốt vẫn trả món hết hàng.
- **Không đụng:** xem Ngoài phạm vi.

## Tiêu chí nghiệm thu

1. Hỏi "túi LV" (có cả món còn và hết) → chỉ thẻ món còn hàng; tiêu đề ghi "còn hàng", tổng đúng số món còn.
2. Truy vấn mà mọi món đều hết → một câu "Có N sản phẩm … nhưng đều đã hết hàng.", không thẻ.
3. Không món nào khớp → câu "Không tìm thấy…" như cũ.
4. "mẫu khác" chỉ ra món còn hàng.
5. Hỏi SKU món hết hàng → có thẻ, câu ghi "đã hết hàng"; giá chốt và tra thị trường theo SKU của bot vẫn chạy.
6. `npm run build` và `npm test` tại `Webstie/` đạt; `npm test` tại `Webstie/BossTele` đạt.

## Lệnh kiểm tra

```
cd D:\Website_3Q\Webstie && npm run build && npm test
cd D:\Website_3Q\Webstie\BossTele && npm test
```

Nếu sandbox chặn chạy test (spawn EPERM), ghi rõ trong result, không xin quyền; Claude sẽ tự chạy.
