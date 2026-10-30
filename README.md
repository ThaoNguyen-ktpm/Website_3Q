# BaoQ Luxury — Website_3Q

Ứng dụng nằm trong [`Webstie/`](Webstie/README.md): website (server và frontend 8787), BossTele, script chạy và tài liệu vận hành. Frontend có lockfile riêng; cài bằng `npm ci --prefix Webstie/frontend`.

```sh
cd Webstie
npm run dev
```

Ở gốc có quy tắc cho AI (`AGENTS.md`, `CLAUDE.md`, `.agents/`, `.claude/`) và hồ sơ công việc (`tasks/`). Sale AI chạy trong Express tại `/sale-ai/`, kho dữ liệu mới ở `Webstie/server/data/sale-ai/`; kho dự án cũ giữ làm lịch sử.
