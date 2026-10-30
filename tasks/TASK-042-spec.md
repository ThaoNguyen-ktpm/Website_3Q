# TASK-042 — Dọn repo: một bản skill, bỏ claude-mem, sửa tài liệu, xoá file thử nghiệm

- Dự án: web (toàn repo `D:\Website_3Q`)
- Người phụ trách: Codex (thực hiện, kiểm tra), Claude (đặc tả, review)
- Trạng thái: `ready`
- Hành động gần nhất, ngày 29/10/2026:
  - Claude kiểm tra repo và báo cáo 11 điểm cần cải thiện.
  - Bảo chọn làm trước các điểm 4, 5, 7, 8.
- Bước tiếp theo: Codex làm theo đặc tả này, viết `TASK-042-result.md`. Claude review.

## Mục tiêu

Repo gọn và đúng hiện trạng:
- skill chỉ lưu một bản trong Git;
- bỏ submodule không dùng;
- tài liệu mô tả đúng dự án hiện tại;
- không còn trang thử nghiệm bỏ dở.

Không đổi hành vi của web, BossTele hay Sale AI.

## Điều kiện trước khi làm

- Làm **sau** TASK-041, hoặc trên nhánh riêng, để không lẫn với 39 thay đổi chưa commit của TASK-041.
- Không đụng `.env`, `server/data/`, `BossTele/data/`.

## Phạm vi

### 1. Skill: một bản trong Git (điểm 4)

Hiện trạng đã kiểm tra:
- Trên đĩa chỉ có một bản: `.agents/skills`.
- `.claude/skills` và `Webstie/BossTele/.claude/skills` là **junction** (tạo ngày 15/10) trỏ về `D:\Website_3Q\.agents\skills`.
- Git (`core.symlinks=false`) không nhận ra junction, nên lưu nội dung 3 lần: mỗi nơi 201 file, giống hệt nhau.
- `CLAUDE.md` ghi "`.claude/skills` liên kết tới `.agents/skills`" — đúng trên đĩa, sai trong Git.
- Ba skill mới chưa vào Git (`inventory-planner`, `review-reputation`, `social-content-engine`) hiện ra ở cả 3 nơi vì cùng một junction.

Yêu cầu:
1. Chỉ `.agents/skills` được theo dõi trong Git. Gỡ `.claude/skills` và `Webstie/BossTele/.claude/skills` khỏi chỉ mục bằng `git rm -r --cached`; **không xoá junction trên đĩa**. Thêm hai đường dẫn này vào `.gitignore`.
2. Thêm script tạo lại junction cho máy mới hoặc bản clone mới, ví dụ `Webstie/scripts/link-skills.cmd` dùng `mklink /J`. Script không làm gì nếu junction đã có, và báo rõ khi thư mục đích đang là thư mục thật.
3. Worktree của Claude (`.claude/worktrees/*`) hiện nhận skill dưới dạng bản chép từ Git. Sau khi gỡ, kiểm tra một worktree mới vẫn dùng được skill: hoặc qua `.worktreeinclude`, hoặc ghi rõ bước chạy script. Ghi cách đã chọn vào kết quả.
4. Sửa câu trong `CLAUDE.md` và `AGENTS.md` cho khớp: nguồn duy nhất là `.agents/skills`; hai thư mục kia là junction tạo bằng script.
5. Ba skill mới chưa theo dõi: **đưa vào Git trong `.agents/skills`** (Bảo chốt ngày 29/10/2026).
   - Gồm `inventory-planner` (23 file), `review-reputation` (23 file), `social-content-engine` (24 file); chỉ có `.md`, `.html`, `.txt`, không có script.
   - Hook gitleaks phải qua khi commit.

### 2. Bỏ submodule `claude-mem` (điểm 5)

Hiện trạng:
- `Webstie/BossTele/vendor/claude-mem` (299MB) chỉ được tải về để chuẩn bị cho TASK-003.
- Bước cài plugin bị từ chối (xem `Webstie/BossTele/tasks/TASK-003-result.md`). Không có code nào dùng.
- `vendor/ponytail` vẫn là nguồn của skill Ponytail: **giữ nguyên**.

Yêu cầu:
1. Gỡ submodule `claude-mem` đúng cách: `git submodule deinit`, `git rm`, xoá mục trong `.gitmodules` và `.git/modules`.
2. Sửa tên mục `ponytail` trong `.gitmodules` cho khớp đường dẫn: `[submodule "Webstie/BossTele/vendor/ponytail"]` (đây là điểm 10 trong báo cáo, làm luôn vì cùng file).
3. Trong `Webstie/BossTele/docs/`, gom `CLAUDE-MEM.md`, `claude-mem-env.proposed.json`, `claude-mem-settings.proposed.json` vào `docs/archive/`. Thêm một dòng đầu `CLAUDE-MEM.md`: "Đã dừng ngày 29/10/2026, submodule đã gỡ". Giữ nguyên `tasks/TASK-003-result.md`.
4. Bỏ dòng `.claude-mem/` trong `Webstie/BossTele/.gitignore` nếu không còn gì tạo ra thư mục đó.

### 3. Tài liệu đúng hiện trạng (điểm 7)

Yêu cầu:
1. **`Webstie/README.md`**: viết lại; bản hiện tại vẫn là "Website thử nghiệm… không kết nối KiotViet". Nội dung tối thiểu:
   - ứng dụng gồm gì: máy chủ API, trang cũ `client` (5173), trang mới `frontend` (8787), BossTele, liên kết Sale AI `D:\BaoQ-AI`;
   - `npm run dev` bật những gì, ở cổng nào;
   - lệnh build/test;
   - mở qua wifi (dẫn sang `docs/LAN.md`);
   - nơi đặt `.env` (không ghi giá trị).
   Ngắn, tiếng Việt.
2. **Tài liệu còn lại từ bản mẫu Webstie** (scaffold Python/FastAPI đã dừng), dời vào `Webstie/docs/archive/`:
   - `developer-handoff.md`, `verification.md`, `historical-application-verification.md`, `template-provenance.md`;
   - `source-contract.md`: dời vào `Webstie/docs/reference/`, không xoá, vì có bản đồ nguồn đối soát dùng cho Điều hành sau này.
3. **`Webstie/docs/LAN.md`**: thêm trang mới `http://<IP>:8787`. Link đăng nhập tạo ở trang nào thì mở trang đó. Khung đăng nhập có ô dán link.
4. **`DESIGN.md` (gốc)** đang mô tả giao diện tối kiểu cũ ("tối, đồng"). Cập nhật theo giao diện Webstie v3 đã duyệt: nền sáng, espresso `#211604`, walnut `#68452d`, champagne, font Playfair Display và Be Vietnam Pro. Nguồn token: `Webstie/frontend/src/app-v2-base.css`. Chỉ ghi token và quy tắc đang dùng thật.
5. **`PRODUCT.md`**: đọc lại; sửa chỗ lệch với hiện trạng (trang 8787, phân quyền theo vai trò, trang ngoài chỉ hiện thông tin shop). Không thêm định hướng mới.
6. Thư mục `docs/` ở gốc đang trống: xoá. Git không theo dõi thư mục trống nên chỉ cần xoá trên đĩa.
7. Sửa các đường dẫn tới file bị dời: tìm bằng `git grep` tên file trong `*.md`, trừ `vendor/`.

### 4. Xoá file thử nghiệm trong `Webstie/client` (điểm 8)

Đây là công cụ dựng thử túi 3D cho trang đăng nhập cũ. Chỉ chúng tham chiếu lẫn nhau, không có script npm nào gọi.

Xoá:
- `bag-preview.html`, `src/bag-preview.tsx`;
- `compare.html`, `src/compare.ts`;
- `render-4k.html`, `src/render-4k.ts`, `vite.render.config.ts`;
- `task-015-preview.html`.

**Giữ:** `src/components/BirkinBag3D.tsx` và `src/three/*`, vì `src/pages/LoginPage.tsx` vẫn dùng. Sửa `src/three/README.md` bỏ phần nói về các file đã xoá.

## Tiêu chí nghiệm thu

1. `git ls-files .claude/skills Webstie/BossTele/.claude/skills` rỗng. `git ls-files .agents/skills` có 271 file: 201 file cũ cộng 70 file của 3 skill mới.
2. Trên máy hiện tại Claude Code và Codex vẫn thấy đủ skill: kiểm tra junction còn nguyên và có ví dụ một skill được nhận.
3. Script link skill chạy được hai lần liên tiếp mà không lỗi.
4. `git submodule status` chỉ còn `ponytail`; `.gitmodules` không còn `claude-mem`; thư mục `vendor/claude-mem` không còn.
5. `git grep -n "Website thử nghiệm"` không còn trong README. Không còn link hỏng tới file đã dời.
6. `npm run build` và `npm test` tại `D:\Website_3Q\Webstie` đạt như trước (438 test máy chủ). `npm test` tại `Webstie/BossTele` đạt (128 test). `npm run build --workspace client` đạt.
7. Trang cũ 5173 vẫn mở trang đăng nhập có túi 3D.
8. `TASK-042-result.md` ghi:
   - dung lượng repo trước và sau (`git count-objects -vH`, dung lượng thư mục không tính `node_modules`);
   - cách chọn cho skill trong worktree;
   - danh sách file đã dời hoặc xoá.

## Lệnh kiểm tra

```
cd D:\Website_3Q
git ls-files .claude/skills Webstie/BossTele/.claude/skills | measure-object
git submodule status
cd Webstie
npm run build
npm test
cd BossTele
npm test
```

## Vùng code

- **Điểm vào:** `.gitignore`, `.gitmodules`, `CLAUDE.md`, `AGENTS.md`, `.worktreeinclude`, `Webstie/scripts/` (script mới), `Webstie/README.md`, `Webstie/docs/*`, `DESIGN.md`, `PRODUCT.md`, `Webstie/BossTele/docs/*claude-mem*`, `Webstie/client/*.html`, `Webstie/client/src/{bag-preview.tsx,compare.ts,render-4k.ts}`, `Webstie/client/vite.render.config.ts`, `Webstie/client/src/three/README.md`.
- **Phạm vi ảnh hưởng:** cách Claude Code và Codex tìm skill (thư mục máy hiện tại và worktree mới); `tsconfig` của client nếu có liệt kê file bị xoá.
- **Test liên quan:** không có test tự động cho skill; dùng tiêu chí 1–3. Build và test hiện có cho phần còn lại.
- **Không đụng:** code chạy của server, client (trừ file thử nghiệm đã nêu), frontend, BossTele; `vendor/ponytail`; `.env`, `data/`; `D:\BaoQ-AI`.

## Điểm cần quyết định (Bảo)

1. ~~Ba skill mới có đưa vào Git không?~~ Đã chốt 29/10/2026: **đưa vào** (mục 1.5).
2. Nếu sau này bỏ hẳn trang cũ 5173, thì `BirkinBag3D` và `src/three` cũng bỏ theo. Việc đó không thuộc TASK-042.
