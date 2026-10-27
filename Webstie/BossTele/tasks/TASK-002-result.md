# TASK-002 — Cài Ponytail dùng chung

- Người phụ trách: Codex.
- Trạng thái: installed; đã smoke-test Claude, chưa có review độc lập toàn bộ cài đặt.
- Yêu cầu: cài repository Ponytail vào BossTele để dùng chung.
- Hành động gần nhất: cài 6 skill, liên kết Claude, cập nhật hướng dẫn và gọi help thành công.
- Bước tiếp theo: mở lượt/phiên Codex mới để nạp skill; dùng Claude review/audit theo phân vai.

## Cài đặt
- Repository: `vendor/ponytail`, commit `2961b52fc1fe6a5a87c7a959a79512e5c2f3ffe5` (v5.2.0).
- Trình cài: `skill-installer/scripts/install-skill-from-github.py`, `--method git`, `--ref` commit cố định, `--dest D:\BossTele\.agents\skills`.
- 6 skill: ponytail, ponytail-review, ponytail-audit, ponytail-debt, ponytail-gain, ponytail-help.
- `.claude/skills` junction tới `.agents/skills`.
- Bổ sung `AGENTS.md` và `CLAUDE.md`, giữ phân vai Codex code / Claude phân tích-review.
- Giấy phép, hướng dẫn và manifest checksum trong `docs/`.

## Bằng chứng
- Kiểm tra 6/6 file SKILL.md tồn tại, có name/description, SHA256 khớp nguồn; đường dẫn Claude trả cùng hash.
- `git -C vendor/ponytail rev-parse HEAD`: commit khớp manifest.
- Claude `/ponytail-help` trong phiên nạp skill dự án: thành công, trả thẻ hướng dẫn tiếng Việt; JSON gốc ở `TASK-002-claude-smoke.json`.
- Lần thử `--restricted` không phát hiện skill; bỏ cờ đó, giữ tool chỉ Read/Skill và chỉ nạp cấu hình dự án thì gọi được.

## Giới hạn
- Bản cài project-local, không plugin marketplace, không lifecycle hooks/statusline/mode flag xuyên phiên.
- Chưa thử gọi skill trên giao diện Codex sau nạp lại và chưa chạy đầy đủ 6 skill.
- Không sửa code demo, không chạy các bài test của mã nguồn vendor như thể chúng là kiểm thử BossTele.
