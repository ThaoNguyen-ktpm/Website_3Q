# TASK-105: Sale AI, quy tắc bậc M mới theo ngày tạo hàng

- Dự án: web (Sale AI)
- Người phụ trách: Codex (thực hiện, kiểm tra), Claude (đặc tả, review)
- Trạng thái: `ready`
- Ngày giao: 29/10/2026
- Bảo cần dùng Sale AI để sửa giá sớm. Làm nhanh, nhưng giữ đủ test.

## Quy định Bảo chốt ngày 29/10/2026

Áp theo **ngày tạo hàng trên Kiot** (giờ Việt Nam, `creationDay`):

| Nhóm | Ngày tạo | Quy tắc |
|---|---|---|
| A | **trước 01/07/2026** | **Không giảm nữa**, ở mọi ngày xét. |
| B | **01/07/2026 – 15/10/2026** (tính cả hai đầu) | Trước 01/11/2026 là M0, chưa giảm. **Ngày 01/11/2026 thành M1**, sau đó cứ 15 ngày lên một bậc: 16/11 M2, 01/12 M3, 16/12 M4, 31/12 M5, 15/01/2027 M6; tối đa M6. **Hàng hot (tên có `!`) tính như hàng thường**, không có 45 ngày M0. |
| C | **từ 16/10/2026** | **Giữ nguyên quy tắc hiện tại**: M0 từ ngày tạo, hàng thường lên M1 sau 15 ngày, hàng hot giữ M0 45 ngày. |

- Bảng mức giảm và quyền sale theo từng bậc M **giữ nguyên** (`bands`, `baseAllowance`). Chỉ đổi cách tính bậc M theo ngày.
- Nhóm A "không giảm nữa": Claude hiểu là Sale AI **không đổi giá và không ghi gì** cho các món này. Cụ thể:
  - trả trạng thái loại trừ, giống món hết tồn: `status: 'excluded'`, lý do "Hàng tạo trước 01/07/2026: không giảm";
  - không tính giá, quyền sale, ghi chú; không đưa vào lượt cập nhật Kiot/Sapo.

  Nếu cách này làm vỡ chỗ khác (bảng, thống kê, BossTele), ghi rõ trong kết quả.

## Hiện trạng

`D:\BaoQ-AI\lib\pricing.js` (đang chạy ở cổng 4310):
- `START='2026-10-01'`, `M1_CUTOFF='2026-10-01'`, `STEP_DAYS=15`, `HOT_M0_DAYS=45`;
- `ageFields()`: hàng tạo trước 01/10 là M1 từ 01/10; hàng tạo từ 01/10 là M0 rồi lên bậc theo tuổi;
- `calculate()` gọi `ageFields()`, rồi tính `markdown`, `price`, `allowance`.

Test liên quan ở gốc `D:\BaoQ-AI`: `preoct-m1.test.js`, `start-date.test.js`, `fifteen-days.test.js`, `cycle.test.js`, `shared-catalog.test.js`; dữ liệu mẫu `lib/samples.js`, `lib/fake-sync.js`.

**Bản sao trong TASK-104** (đang làm dở, Codex khác đang tạm dừng chờ duyệt): `D:\Website_3Q\Webstie\server\src\sale-ai\lib\pricing.js` và test đã chép sang `Webstie/server/src/sale-ai/test/`.

## Yêu cầu

1. Sửa `D:\BaoQ-AI\lib\pricing.js`:
   - thêm hằng ngày rõ tên, ví dụ: `NO_MARKDOWN_BEFORE='2026-07-01'`, `BATCH_FROM='2026-07-01'`, `BATCH_TO='2026-10-15'`, `BATCH_M1='2026-11-01'`;
   - sửa `ageFields()` / `calculate()` theo bảng trên;
   - `saleStartDate` của nhóm B là `2026-11-01`, `ageDays` tính từ ngày đó; trước 01/11 trả M0;
   - đổi `POLICY` sang tên mới (ví dụ `baoq-2026-10-29-jul-batch-v9`) để kho biết công thức đã đổi;
   - giữ nguyên kiểm tra P0, giá tay ≥ 600 triệu, ngày tạo sai hoặc tương lai, hết tồn;
   - giữ nguyên mốc `START` (ngày xét trước 01/10/2026 vẫn báo lỗi).
2. Cập nhật test và dữ liệu mẫu đang khẳng định quy tắc cũ, cho khớp quy tắc mới. Thêm test cho các ví dụ ở mục Nghiệm thu.
3. Áp **cùng thay đổi** cho bản sao TASK-104: `Webstie/server/src/sale-ai/lib/pricing.js` và test tương ứng trong `Webstie/server/src/sale-ai/test/` (nếu có). Hai bản `pricing.js` phải giống hệt nhau. Ghi SHA-256 mới vào kết quả, để TASK-104 cập nhật danh sách SHA của nó.
4. Chỉ sửa `pricing.js`, test và dữ liệu mẫu. **Không** đụng phần ghi giá, rollback, router, `dev.mjs`, hay các file TASK-104 khác.
5. Kiểm `D:\Website_3Q\Webstie\BossTele\sale-price.js` và test `BossTele/test/sale-price.test.js`: BossTele dùng `calculate()` của Sale AI. Cập nhật test nếu khẳng định bậc M theo quy tắc cũ. BossTele phải hiện nhóm A là "không giảm", không báo lỗi.

## Quy tắc an toàn

- Không gửi cập nhật hay rollback thật lên Kiot/Sapo. Không bật `SALE_AI_BATCH`. Không gọi kết quả là "giá chốt".
- Không xoá file nào trong `D:\BaoQ-AI`. Không commit.
- Không dừng hay khởi động lại server đang chạy. Claude sẽ khởi động lại sau khi review.

## Nghiệm thu (test tự động, ngày xét cố định)

| Ngày tạo | Tên | Ngày xét | Kết quả mong đợi |
|---|---|---|---|
| 15/03/2026 | thường | 01/11/2026 | excluded, "không giảm" |
| 30/06/2026 | hot `!` | 15/01/2027 | excluded |
| 01/07/2026 | thường | 31/10/2026 | M0, giá = P0 |
| 01/07/2026 | thường | 01/11/2026 | M1 |
| 20/08/2026 | thường | 16/11/2026 | M2 |
| 20/08/2026 | hot `!` | 01/11/2026 | M1 (như hàng thường) |
| 15/10/2026 | thường | 30/11/2026 | M2 |
| 15/10/2026 | thường | 31/12/2026 | M5 |
| 15/10/2026 | thường | 01/03/2027 | M6 (tối đa) |
| 16/10/2026 | thường | 31/10/2026 | M1 (quy tắc cũ: tạo + 15 ngày) |
| 16/10/2026 | hot `!` | 29/11/2026 | M0 (quy tắc cũ: hot giữ 45 ngày) |
| 20/10/2026 | thường | 29/10/2026 | M0 |

Mức giảm và quyền sale của từng bậc M khớp bảng cũ (test đang có giữ nguyên ý nghĩa).

## Lệnh kiểm tra

- `node --test` tại `D:\BaoQ-AI`: toàn bộ qua.
- `node --test` tại `Webstie/server/src/sale-ai/test` (bản sao TASK-104), nếu đã chạy được.
- `npm test` tại `D:\Website_3Q\Webstie\BossTele`.

## Kết quả

Ghi `D:\Website_3Q\tasks\TASK-105-result.md`:
- file đã sửa, SHA-256 hai bản `pricing.js`;
- test đã đổi và lý do;
- kết quả từng lệnh;
- điểm còn vướng, nếu có.
