# Source integration contract — pending source fixtures
Audit supplied by parent; workbook was read only, not copied or migrated. No verified current balance; no selected period, TL01 blocker; inspected input starts blank. Header row 5, input row 6. Hidden helpers, named ranges, complete formula coverage and 20,000-row capacity not proven.

Navigation maps: Tổng quan đối soát → Tổng hợp; Thu–bán → Thu-bán/Bán Sapo/Khoản thu/Mua Kiot; Ký gửi → Ký gửi/Hồ sơ ký gửi/Phân bổ; Tiền & đối chiếu → Ngân hàng/Khoản thu/Phân bổ; Kiểm tra; Chốt kỳ & điều chỉnh → Sổ chốt/Điều chỉnh; Thiết lập & nguồn → Thiết lập/Danh mục/Từ điển/Hướng dẫn.

- Legacy KG = cash collection, never consignment.
- Bank key: uppercase(trim(bank))#uppercase(trim(account))#uppercase(trim(original transaction ID)). No fuzzy amount/name/partial ID match.
- Sapo key: order#line; SKU alone invalid. Duplicate, canceled, returned and nonnumeric lines zero per source contract. Refund fixture in app is a separate synthetic revenue event, not a reproduced workbook rule.
- Referenced Kiot invoice must not duplicate a Sapo sale.
- Receipts: payment ID, order, optional line, receipt/refund, positive amount, method, money key, Sapo date. Actual date comes from money evidence.
- Kiot: voucher#line, document type, SKU/item, date, goods type, positive amount, status, supplier, method, evidence/note.
- Allocation: money key, target type, voucher/order, consignment line, amount, manual verification, basis/note.
- Consignment: owner/account, amount owed, agreement; eligibility and latest valid receipt/owner payout determine date. Owner payout already reduces profit; do not subtract again in bridge.
- Bridge specification: opening + Partner ratio × actual purchased-goods collections + Bảo ratio × valid purchases − Bảo purchase outflow + purchase refunds + Partner ratio × eligible consignment profit − Bảo→Partner + Partner→Bảo + approved adjustments.
- Ratios (currently 40/60), tolerance (currently 0 VND), suspected unit threshold (currently 500000), approver (currently Bảo) must be configurable, never authoritative hardcoded values.
- Closed history changes quarantine source change and block next close. Approved current-period adjustments preserve before/after evidence; never overwrite history.

App only implements synthetic revenue/cost sums and an idempotency/closed-change contract test. No bridge, close, adjustment or source write endpoint is implemented. PostgreSQL DDL is a starting review artifact, not a completed ledger migration. Authentication and persisted grants require design/approval before live access.

Price System document supplied by user: https://docs.google.com/document/d/1jz4zUi6k6qo7k-JDCDSBBZn3Q_sHVeRzH3oYUfx9m3o/edit . It describes plans, not verified implementation. No API, schema, idempotency or export samples supplied. Portal boundary should retain internal_item_id, BAOQ SKU, optional source IDs, policy_version, evaluation/source timestamps, provenance, approval_state and external reference. BAOQ SKU joins own products; market research lacking SKU must not be blindly joined. Auto-sale approval and reapproval after cost floor remain external. M0 date and margin/markup conflicts remain unresolved; do not guess thresholds. Earlier broad 3CEO/public/IP plans are superseded by CEO-only overview and explicit section grants. No AI provider integration.

Voice clarification: desired profit basis is gross margin on sale price, price = cost / (1 − target margin). This supersedes conflicting markup examples. Band values, effective dates and full policy are still unapproved; no pricing engine or document edits performed.

Further authoritative voice constraints: margin cost base is only the item's purchase price; fees are separate. Auto-sale age begins at existing authoritative ready-to-sale date, meaning photographed AND published on website AND social channels. Reuse the existing status/date and SKU identifier. Do not derive auto-sale age from receipt date, rebuild SKU logic or resolve historical M0 by assumption. Inventory aging in this demo is a synthetic inventory-age fixture and explicitly NOT an auto-sale clock.

## Superseding scope and ready-date decision

The user replaced scope with UI scaffold/design and developer handoff only. Backend/auth/database/integration implementation is halted; any earlier implementation descriptions are historical, unused by the static UI.

**Latest ready-to-sale rule: earliest website OR social publication timestamp after photography.** This explicitly supersedes earlier AND/both-channel wording above. Reuse existing SKU/status/date. Historical M0 remains unresolved. Role chooser is UI simulation only, not security.
