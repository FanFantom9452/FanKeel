這個任務改了 suite、gate、record、ci-status 之後，有 10 處文件說的已經不是程式現在做的事，外加 test-audit.js 一個誤判 bug；沒有死連結是本次造成的。

```
node scripts/docs-check.js
3 references that no longer resolve:
  gone: docs/90-agent/plans/2026-11-02-professor-d-plan-split.md:22  links to rationale.md  [plan]
  moved: docs/90-agent/todo/model-3.md:12  lib/stages.js:722 does not hold `model`  [todo]
  bare-code: docs/90-agent/todo/notify-2.md:18  "a233443d" stands where its name should be  [todo]

node scripts/residue.js
10 paths nobody has decided about: .claude/ .fankeel/tmp/ .playwright-mcp/ docs/90-agent/judgements/2026-11-01-{agent-desktop,kg-into-fankeel,shared-session-state}.{md,html} docs/90-agent/plans/
10 worktrees are already merged into main (clean); 14 merged but not clean; 9 spent agent branches
ignored weight: .fankeel/build/ 659.9M, .claude/worktrees/ 231.6M, .fankeel/station/ 102.4M

knip --dependencies · deptry
knip not installed · deptry not installed

node scripts/docs-audit.js --record
26 reference documents have fallen behind the code they describe (lib/stages.js, hooks/gate.js, hooks/inject.js, scripts/task.js commits of this task)
15 documents are missing from docs/README.md (this task's 7 plans, 4 records, plus 4 older)
126 pairs describe the same code

node scripts/test-audit.js
test-audit: 0 stale, 16 duplicate
memory-check: 4 indexed, 4 on disk, no broken citation · input-check: 763 B
```

- skills/fankeel-design/SKILL.md:267-268 — 「route 上有 plan 時 design 不寫報告」；hooks/gate.js:356-364 現在會拒絕沒有 design.md 的關卡，lib/stages.js:592-594 註解同樣過時
- docs/90-agent/reference/subagents.md:705,710-711 — 「session 內的 design 不寫報告」，同上已不成立
- docs/90-agent/reference/subagents.md:615 — 只說 patrol survey 檢查報告；現在每個 session 內的關卡都檢查（`reportMissing`）
- skills/fankeel-build/SKILL.md:184-189 — 「沒 plan 時磁碟上只有 design.md」「design.md is missing」已不符
- design、plan、build、verify、survey 的 SKILL.md — 都沒寫「問關卡前先寫報告」，只靠 lib/stages.js:612-618 印一次
- skills/fankeel-land/SKILL.md:93,94,395 — 沒提 `.fankeel/suite.json` daily 層與 `suite: ok|red`、`— red at <dir>: <run>`
- skills/fankeel-land/SKILL.md:412 — 「其他主機都是 Gitea」，ci-status.js:35-42 已把 gitlab、bitbucket、azure 排除
- skills/fankeel-land/SKILL.md:419-422 — 漏了無 origin 時的 `ci: unknown`；token 比對含 port、被拒後仍試 credential fill
- docs/README.md:838 — records 說成只在 land 寫；scripts/record.js:313-339 每次換站就 commit 該站報告
- scripts/test-audit.js:189 — 去空白也去掉字串內的空白，`tests/station-hdl-d.test.js:118` 與 :134 被誤判重複
- bench/ 的 10 筆重複是刻意的對照組，spec §4 沒說要跳過，屬規格缺口

adversary: 推翻 2 條——init-scout:72 的 nightly 規則可配到 `pytest -m nightly`；layout.md 的清單本來就只列「最先值得打開的檔」。另補出 subagents.md:615、:705 兩條。
routed: TODO「hand-off 記 HEAD 留或刪」已收 registry.md:531-533 的 handoffSha 與 adopt 輸出
clean: drive.md、shared-libs.md、collisions.md、statusline.md、documents.md、model-choice.md、init SKILL、init-scout、layout.md、development.md、lib/stages.js land 區塊——沒有與程式矛盾的句子
not checked: troubleshooting.md、pipeline.md 的 suite 段落；程式碼瘦身三審（兩週一次，上次 10-26，未到期）

- lib/render.js:242 — GATE_LINKS_RULE 要求把網址抄進選項一；使用者 11-02 指正：網址印在問題之前，選項裡不要有

```json gate
{"questions":[{"header":"Audit→Land","question":"Audit -> Land | fankeel : 教授 11-01 功能","multiSelect":false,"options":[{"label":"Go to Land (Recommended)","description":"先由 fixer 改 land、design、build SKILL 與 stage SKILL 的報告規則、stages.js:592-594 註解、README.md:838、subagents.md:615/705；implementer 修 test-audit.js 字串內空白、把 render.js 的 GATE_LINKS_RULE 改成網址印在問題前不放進選項，各加測試；bench/ 跳過與否記 TODO，worktree 不動，再進 land"},{"label":"Stay in Audit","description":"還沒定的一件事：test-audit 要不要預設跳過 bench/ 這類刻意重複的對照組（spec 沒寫）"},{"label":"暫停","description":"停在 audit，next 設為「依 audit.md 修 10 處文件、test-audit 空白 bug 與 GATE_LINKS_RULE 後進 land」"},{"label":"Go to Land，並清 worktree","description":"同第一項，另外移除 10 個已合併且乾淨的 worktree 與 9 個用完的 agent 分支（14 個不乾淨的不動）"}]}],"next":"依 audit.md 修 10 處文件、test-audit 空白 bug 與 GATE_LINKS_RULE 後進 land"}
```
