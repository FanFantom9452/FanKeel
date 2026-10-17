---
label: stage-agents
title: allow 規則下 no verdict 再現
description: 放行規則 `Edit(/.fankeel/build/**)` 在檔案裡，auto mode 在 10-08、10-14 仍回 no verdict；10-10 `claude --debug` 看到規則有讀到，10-14 那次沒開 debug — [subagents.md](docs/90-agent/reference/subagents.md).
state: watch
link: docs/90-agent/reference/subagents.md
group: 放行規則有沒有效
timing: if: no verdict 下次再發生 — 當場開 claude --debug 看判定走到哪
stamp: 2026-10-18
---

來源：報告 docs/90-agent/reports/2026-09-28-allow-rule-probe.md 隨 45e53abe（2026-09-28）進來，「watch-three」這個標籤出自 docs/90-agent/plans/2026-09-28-watch-three.md（e60ac583 只改寫 TODO.md 的 bullet 與 subagents.md）；報告用 10 次 headless claude -p（A 帶 local 設定、B 不帶）量 `Edit(/.fankeel/build/**)`，兩組都 5/5 寫成功，重現不出 auto mode 在 09-22 對站 agent 回的 no verdict。

## 10-08 再發生

2026-10-09 擴大 Haiku 角色測試與飄移（session 8846548c）的 land 從 transcript 數出來：10-08 auto mode 回 no verdict 共 10 次（時間是 UTC）。

- 主 session 4 次，18:27 到 18:28：Write `.fankeel/build/probe/main-tiny.txt`、Write `.fankeel/build/probe/main-4k.txt`、Edit `.fankeel/build/probe/main-bash.txt`、Write 根目錄的 `fk-probe-root.txt`。
- 三個 brain 子 agent 共 6 次：16:11 與 16:17 Write `.fankeel/build/task-20261008T155402/survey.md`；16:31 Write 設計頁（plans 資料夾）、16:33 Write `.fankeel/build/task-20261008T155402/design.md`；17:46 Write 計畫頁（plans 資料夾）、17:48 Write `.fankeel/build/task-20261008T155402/plan.md`。

規則：`.claude/settings.local.json` 第 4 行是 `Edit(/.fankeel/build/**)`。這個檔最後一次修改在 16:36（加一條 gate-check 的 Bash 規則），之後 17:48、18:27 兩次、18:28 一次，共四次寫的都是這條規則涵蓋的路徑，仍然 no verdict，所以這四次規則確定在檔案裡。拒絕訊息只說 classifier 沒有判定，看不出規則有沒有被讀到。當時 session 用 `--plugin-dir` 載入、開著 Remote Control、切換過多次模式；使用者切到 accept edits 之後，同樣的寫入都成功。

證據：`~/.claude/projects/F--ymlab-fankeel/8846548c-26e8-4b4a-a6cd-c8d649c9de33.jsonl` 與同名資料夾下的 subagents/，tool_result 開頭是 "The server-side auto mode classifier gave no verdict"。

## 10-10 實跑

使用者在 auto mode 下開 `claude --debug`（v2.1.296，debug 檔 `~/.claude/debug/e901f755-1bb1-450d-86bc-8b5852332415.txt`，transcript 的 `permissionMode` 四筆都是 `auto`），請它 Write `.fankeel/build/probe.md`：

- 第 16 行，啟動時 `Applying permission update: Adding 4 allow rule(s) to destination 'localSettings'`，第一條就是 `Edit(/.fankeel/build/**)`：規則有被讀到。
- 第 530–535 行，`guard.js`、`budget.js` 兩個 PreToolUse hook 回 0 之後，`tool_dispatch_start tool=Write ... permissionDecisionMs=8`，中間沒有任何 API request：判定看來是在本機由規則放行，沒有送到 classifier（debug 檔沒有直接寫出比中的規則）。
- 第 542 行寫入成功，沒有跳出確認。

所以「auto mode、主 session、規則在檔案裡」這一次沒有重現 no verdict。10-08 那次和這次不同的地方：用 `--plugin-dir` 載入、開著 Remote Control、中途切換過多次模式，而且六次發生在 brain 子 agent 裡。

## 10-14 再發生

session 82155bbc 的 transcript（2026-10-14）：一個子 agent 對 `docs/90-agent/todo/pane-2.md` 做了三次 Edit，三次都回 "auto mode's classifier gave no verdict"，是 10-10 之後第一次。`Edit(/.fankeel/build/**)` 不涵蓋 `docs/90-agent/todo/`，所以這次是 no verdict 再發生，不是涵蓋路徑的規則被略過。當時沒有開 `claude --debug`，判定走到哪一步仍不知道。

要做成：報告那半已在 10-08 補完；剩下的是 no verdict 再發生時，在同一個 session 裡用 `claude --debug` 查判定走到哪一步。

完成條件：no verdict 再發生時，當場用 `claude --debug` 看規則有沒有被讀到、判定有沒有走到 classifier，並寫進報告；或確認不再發生後關掉此條。
