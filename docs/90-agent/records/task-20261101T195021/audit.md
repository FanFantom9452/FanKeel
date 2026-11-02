# audit — retro-all 匯出 ZIP 回傳

node scripts/docs-check.js
  4 references that no longer resolve — rationale.md:29,31 (plans moved to archive), todo/model-3.md:12, todo/notify-2.md:18; none from this change.

node scripts/residue.js
  before: .claude/worktrees/agent-*/… — 1921 paths, spent agent worktrees from this and earlier builds.
  cleaned (user chose 全清): 33 worktrees + branches removed, 294 shell dirs deleted, 9 spent branches deleted; nice-euler-d96cbb, quirky-haslett-21e2dc (desktop) left.
  after: 3 paths nobody has decided about — .claude/, .fankeel/tmp/, .playwright-mcp/ (pre-existing).

knip --dependencies · deptry — neither installed; the project has no dependencies (package.json).

node scripts/docs-audit.js
  26 reference documents fallen behind their code; none name record.js, zip.js or retro-all — pre-existing, not from this change.

- docs/02-architecture/layout.md:120-135 — the `lib/` tree has no `lib/zip.js` row (new, required by scripts/record.js:20).
- docs/03-decisions — no page records that retro-all now returns a masked ZIP instead of pushing; 2026-10-20-retro-bundle.md is dated and stays, a new decision page is warranted at land.
- fixed here: scripts/record.js homePattern trailing dot (`C:\Users\ann.`) now masked — bf800993, test red before (18/1) and green after (19/0).

adversary: layout.md missing lib/zip.js; a new decision page warranted. Nothing else false — pipeline.md:824-826, fankeel-land SKILL.md:280-281, concepts.md:75 still match the code.
routed: TODO — land-11 worktree remove 失敗堆積 (b7e7a9ae): commit.js:184-185 keeps a worktree with scratch; Windows leaves unregistered dirs.
prompt lens: none
clean: skills/fankeel-retro-all/SKILL.md, docs/01-guide/concepts.md, docs/02-architecture/pipeline.md, skills/fankeel-land/SKILL.md, docs/90-agent/reference/documents.md

```json gate
{"questions":[{"header":"Audit→Land","question":"Audit -> Land | fankeel : retro-all 改成匯出 ZIP 回傳，不 push","options":[{"label":"Go to Land (Recommended)","description":"接受審查：layout.md 補 lib/zip.js 一行、land 時寫一份新決定頁（retro-all 改回傳遮蔽過的 ZIP、不 push）；結尾句點漏洞已修（bf800993），worktree 已全清，累積原因記成 TODO land-11（b7e7a9ae）。"},{"label":"Stay in Audit","description":"沒有未決的事：清理已做完，其餘 docs-check/docs-audit 項是舊的、不動。"},{"label":"暫停","description":"next 設為：進 Land，補 layout.md、寫決定頁、發版 0.148.0。"}],"multiSelect":false}],"next":"進 Land：補 layout.md、寫決定頁、發版"}
```
