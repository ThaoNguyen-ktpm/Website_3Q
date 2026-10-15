# Ponytail dùng chung cho Website_3Q

## Bản cài
- Nguồn: https://github.com/DietrichGebert/ponytail.git
- Phiên bản: v5.2.0, commit `2961b52fc1fe6a5a87c7a959a79512e5c2f3ffe5`.
- Mã nguồn tải về: `vendor/ponytail`, checkout cố định commit.
- 6 skill gốc được cài bằng trình `skill-installer`; từ 2026-10-15 chuyển lên `D:\Website_3Q\.agents\skills` để website và BossTele dùng chung.
- `D:\Website_3Q\.claude\skills` và `BossTele\.claude\skills` là junction tới `D:\Website_3Q\.agents\skills`, nên Claude và Codex dùng cùng file.
- Giấy phép MIT: `docs/PONYTAIL-LICENSE.txt`; nguồn và SHA256 từng skill: `docs/ponytail-install.json`.

## Cách dùng
Mở phiên mới tại `D:\Website_3Q` để agent phát hiện các skill vừa cài. Ponytail mặc định mức `full` theo hướng dẫn dự án: giải quyết đủ yêu cầu với thay đổi nhỏ, tái sử dụng code, giữ kiểm tra đầu vào và xử lý lỗi.

Trong Codex, gọi skill cục bộ bằng tên:
```text
$ponytail
$ponytail-review kiểm tra add.js và test/add.test.js
$ponytail-audit kiểm tra code dự án, bỏ qua vendor/ponytail
$ponytail-debt
$ponytail-gain
$ponytail-help
```

Trong Claude Code, gọi các lệnh tương ứng:
```text
/ponytail
/ponytail-review kiểm tra add.js và test/add.test.js
/ponytail-audit kiểm tra code dự án, bỏ qua vendor/ponytail
/ponytail-debt
/ponytail-gain
/ponytail-help
```

Nếu giao diện chưa liệt kê skill, yêu cầu agent đọc trực tiếp `D:\Website_3Q\.agents\skills\<tên>\SKILL.md` và làm theo. Có thể nói `ponytail lite`, `ponytail full`, `ponytail ultra` hoặc `stop ponytail` để đổi/tắt hướng dẫn trong phiên.

Codex vẫn code toàn bộ dự án; Claude vẫn phân tích, đề xuất và kiểm tra. Review/audit chỉ báo cáo trừ khi có yêu cầu sửa riêng.

## Giới hạn bản cài
Đây là bản skill cục bộ, không phải plugin marketplace. Không cài lifecycle hooks, statusline hay cơ chế lưu mức hoạt động xuyên phiên. Các hướng dẫn plugin toàn cục trong `ponytail-help` không áp dụng cho bản cài này; đổi mức bằng yêu cầu trong phiên. `ponytail-gain` hiển thị benchmark công bố của tác giả, không đo mức tiết kiệm của BossTele.

Đã kiểm tra đủ 6 skill có metadata và SHA256 khớp nguồn ở cả hai đường dẫn. Claude Code đã gọi `/ponytail-help` thành công và trả thẻ tham khảo bằng tiếng Việt; bằng chứng lưu tại `tasks/TASK-002-claude-smoke.json`. Chưa kiểm thử hành vi cả 6 skill hoặc việc gọi skill qua giao diện Codex sau khi nạp lại.

Lưu ý kiểm chứng: `claude --restricted` không phát hiện các skill dự án trong lần thử này. Lần gọi thành công dùng `--setting-sources project --tools Read,Skill --allowedTools Read Skill --strict-mcp-config --no-session-persistence`. Thẻ help gốc vẫn mô tả plugin có namespace và hooks; với bản cài này dùng tên skill cục bộ và hướng dẫn ở tài liệu này.

## Cập nhật
Không tự `git pull` hay dùng auto-update. Khi người dùng yêu cầu cập nhật, chọn commit mới, cập nhật source và cả 6 skill có kiểm tra checksum, đồng thời cập nhật manifest. Junction giúp Claude nhận cùng bản mới. Không thay nguyên `AGENTS.md` hoặc `CLAUDE.md` bằng tài liệu upstream vì sẽ mất phân vai dự án.
