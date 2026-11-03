<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->

## Serena (Bảo 2026-11-02)

MCP `serena` (Serena 2, công cụ `serena_repl`, đọc code bằng language server TypeScript; cấu hình `.serena/project.yml`).
- Tra cứu, đọc code, phạm vi ảnh hưởng: dùng CodeGraph trước (nhanh hơn).
- Dùng Serena khi cần chính xác theo ngữ nghĩa: tìm mọi chỗ dùng một hàm/biến (`s.lsp.find_referencing_symbols`), tìm định nghĩa, đổi tên hoặc chuyển symbol qua nhiều file. Gọi `s.info("lsp")` / `s.info("edit")` để xem cách dùng.
- Lần gọi đầu mỗi phiên mất vài giây để khởi động language server. Không có Serena thì làm như cũ.
