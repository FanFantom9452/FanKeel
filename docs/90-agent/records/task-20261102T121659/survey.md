fankeel map — 1444 markdown files, 4 planned, not built, 423 retired, 124 undeclared（`.fankeel/map.md`）。
fankeel survey — 3675 files, matching: shell, description, cd；source: git；skipped: 1 over the size cap, 1795 with no pattern for their extension；excluded: 423 archive、91 decision、284 report。

## 新要求：shell 列只看到 `cd F:/ymlab/fankeel && node ...`

結論：這件事是新的，沒有任何 TODO 條目涵蓋，而且可以做成一條 bounded 的建置項。原因有兩個，都在我們自己的程式裡，不必等 Claude Code 改。

- hooks/pane.ts:714-721 — Pane 記背景 shell 時只存 `call.command`，不存 Bash 的 `description`；hooks/pane-shell.ts:60-62 的 `commandLine` 只取第一行再壓空白，前綴 `cd F:/ymlab/fankeel && ` 便佔掉大半列寬，剩下的看不出是哪支腳本、做什麼。
- lib/shells.js:65-77 — 站台與 transcript 讀到的 shell 同樣只取 `b.input.command`，但同一個 tool_use 的 `input.description` 就在手邊；lib/phone.js:219 已經是「description 優先、command 第一行其次」，證明這個取法在本專案有先例。
- lib/stages.js:702 — 控制器的 AWAIT_RULE 只說「用 Bash `run_in_background` 跑 await.js」，沒有要求 `description`，也沒有說不要 `cd`；hooks/title.js:23 只改寫 `Agent|Task` 的 description，Bash 沒人補。因此背景 Bash 的描述全靠模型自由發揮，常是空的。
- lib/plantasks.js:449 — Workflow 的 implementer 提示明寫「cd into it before every command」，這是目前唯一一處由我們指示 `cd` 的地方；其餘 `cd` 前綴（`cd F:/ymlab/fankeel && node ...`）找不到任何 skill、agent 檔或 stage 規則指示，應是模型自己的習慣（無法由此確認，見下）。

可做的三件事，由便宜到貴：一、`commandLine` 與 station 列先剝掉開頭的 `cd <path> &&`，再把 `node <plugin>/scripts/<name>.js` 縮成 `<name>.js`，不靠任何人配合；二、Pane 與 lib/shells.js 一併存 `description`，有就顯示它，沒有才退回第一點的命令；三、AWAIT_RULE、COMMIT 規則與 suite 的背景呼叫（skills/fankeel-build/SKILL.md:552）加一句「背景 Bash 必帶 `description`，例如 `await: waiting on stage agent`，且不要 `cd`」，並考慮在 guard 或另一支 PreToolUse hook 對缺 description 的 `run_in_background` Bash 用 `updatedInput` 補一個（照 hooks/title.js 的作法）。

與 await-18（評估 Monitor 取代背景 Bash）的關係：兩者碰同一個呼叫（await.js 的背景 Bash），但 await-18 問的是「換不換成 Monitor」，這條問的是「顯示什麼」。若 await-18 改用 Monitor，Monitor 有自己的描述欄，這條的第三點要重做；所以建議本條先做第一、二點（與呼叫形式無關），第三點排在 await-18 結論之後。pane-18（watch）是 Pane 要不要列 monitor 與 workflow，也無關這條。

沒能確認的：一、Claude 桌面 app 的 shell 面板究竟顯示 `description` 還是 `command`，我無法從本機驗證；二、Pane 的 `tool.call` 事件是否帶 `description` 欄（hooks/pane.ts:717 只宣告了 `tool`、`command`，模組型別檔不在 repo 內），若沒有，Pane 要改從 transcript 取（lib/shells.js 已會）；三、`cd` 前綴是否真的是模型習慣而非某個我沒搜到的提示（我搜了 lib、hooks、scripts、agents、skills、commands，只有 plantasks.js:449 一處）。

## TODO 全表盤點

entries: 41 listed, 41 in TODO

### Ready
- await-17 逾時轉背景的 lost 判斷 — 讀 scripts/await.js 與 judgement，仍未做 — do now（與 await-18 同一個檔，一起評估）
- await-18 評估 Monitor 取代背景 Bash — 讀條目與 guard.js 範圍，未做；與本次 shell 標示共用同一個呼叫 — do now
- compact-8 Desktop 閒置壓縮的分工 — 讀條目，來源 judgement 今天才寫，仍成立 — do now
- docs-14 ask skill 註明判官已 xhigh — 讀條目，目標句尚未寫入 — do now
- docs-15 subagent 背景語意改寫 — 讀條目，subagents.md 該段尚未改 — do now
- fix-1 title.js 認 SUBAGENT_EFFORT — 開 lib/title.js:153-155，只認 fm.effort，仍成立 — do now
- gate-21 dispatch gate 走 decider — 讀條目與 hooks/dispatch-gate.js 範圍，未做 — do now
- init-4 建議執行 /auto-mode-setup — 讀條目，未做 — do now
- registry-2 spend 與 render 補架子 — 開 lib/spend.js:120，仍是 `registry.readAll(root)` 沒帶 shelf，仍成立 — do now
- tour-2 station 導覽之後做回來 — 讀條目，導覽今天才移除，要不要重做與重做成什麼是使用者的決定 — needs the user
- verify-5 verify 加 blast-radius lens — 讀條目與 gate-22 的關係，判官認定的唯一缺口 — do now

### Needs a decision
- gate-22 先問完、剩下自己跑 — 讀條目，使用者已答「過夜仍要跑」，現在要不要重開 gate-13 — needs the user

### Blocked
- audit-1 Trovara 的 docs 搬到 preset — after: 新機器測試，條件未成 — waiting on 使用者換到新機器
- build-1 knip unused exports 未開 — upstream: knip 認得 CJS namespace，條目記到 6.41.0 仍未解 — waiting on knip 新版
- docs-1 流程圖由腳本生成並防漂移 — after: 另一個專案先做，條件未成 — waiting on 使用者在別的專案做出流程圖
- foreign-1 在別的專案跑一週，數崩壞 — after: 別的專案跑滿一週，未成 — waiting on 一個非 fankeel 專案跑滿一週
- model-4 fast 只給 sonnet 子 agent — upstream: Sonnet 支援 fast，未見 — waiting on Claude Code 的 fast 設定
- security-1 Security lens 交本地模型篩 — upstream: 另一個專案定案，未見 — waiting on AI CODING SECURITY 定案
- spend-6 主對話 1h cache write 佔 29% — on: 11-03，今天 11-02 未到 — waiting on 11-03
- station-70 量測表：估算對實際額度 — on: 11-07，未到 — waiting on 11-07

### Watch
- await-15 await 測試偶發紅 — 事件（再紅）未發生 — keep
- design-2 design class 其餘是架構任務 — 事件（下個前端任務）未到 — keep
- entry-1 多目標交付要不要 compiler — 事件（第二個 host）未到 — keep
- entry-4 station 圖需要真瀏覽器驗證 — 事件（真 gate 標記）未到 — keep
- explain-2 發版時做講解影片 — 事件未到 — keep
- flaky-1 reviewcheck 偶發失敗 — 事件（全套再紅）未到 — keep
- flaky-3 inject 髒檔測試偶發失敗 — 同上 — keep
- flaky-4 task-worktree 偶發失敗 — 同上 — keep
- flaky-5 serve 測試整套負載下偶發失敗 — 同上 — keep
- flaky-6 station 加入測試偶發失敗 — 同上 — keep
- model-3 brain 該用 opus 還是 sonnet — 事件（來回或缺陷偏高）未到 — keep
- notify-3 通知做回來，不走第三方 — 事件未到 — keep
- pane-18 monitor 與 workflow 清單 — 事件（引擎出背景清單 API）未到 — keep
- ponytail-1 Ponytail 5.3.2 比較與借鏡 — 事件未到 — keep
- render-2 本地模型篩渲染審查 — 事件未到 — keep
- stage-agents-10 allow 規則下 no verdict 再現 — 事件未到 — keep
- survey-1 Unlisted language patterns — 事件未到 — keep
- survey-2 graphify 接為查詢工具 — 事件未到 — keep
- test-1 station-cli 測試偶爾逾時 — 事件未到 — keep
- test-8 並行測試撞 Windows 認可上限 — 事件未到 — keep
- test-14 全套才紅的兩個測試 — 事件未到 — keep

（所有 Watch 的戳記為 2026-11-01 或 11-02，都不到 60 天，沒有過期的需要問是否保留。）

do now: await-17, await-18, compact-8, docs-14, docs-15, fix-1, gate-21, init-4, registry-2, verify-5，另加新項「shell 標示看得出在跑什麼」
needs the user: gate-22, tour-2
waiting on: audit-1 新機器、build-1 knip、docs-1 別的專案、foreign-1 一週、model-4 fast 設定、security-1 定案、spend-6 11-03、station-70 11-07

planned, not built: 4 頁 design-intent（map 列出，與本任務無關）
not found: 無 TODO 條目涵蓋 shell 標示；搜 `description` 與 Bash 的規則、skill、agent 檔都沒有「背景 Bash 要帶 description」的規則
unknown: 桌面 app 的 shell 面板顯示欄位、Pane `tool.call` 事件是否帶 description、`cd` 前綴的來源
skipped: 1 個超過大小上限的檔與 1795 個無對應語言樣式的檔，只回報數量；對本題無影響（相關檔皆為 js/ts/md，均已搜到）
class: bounded — 流程已在 repo（Pane、shells、AWAIT_RULE），改的是顯示與一句規則；patrol 的 route 本就 survey,plan,build,verify,land
route: unchanged

reads:
hooks/pane-shell.ts — commandLine 與 Shell 型別，改顯示的主要地方
hooks/pane.ts — 714-721 行的 tool.call 記錄，確認事件是否帶 description
lib/shells.js — 65-77 行，站台一側的 shell 來源，加 description
lib/stages.js — 702 行 AWAIT_RULE，加「必帶 description、不 cd」
lib/phone.js — 219 行的 description 優先寫法，照抄
hooks/title.js — Agent 的 description 改寫範例，若要為 Bash 補 description 的 hook 照此
docs/90-agent/todo/await-18.md — 與本項共用 await.js 的背景 Bash，先定順序

## 使用者回答後的核對

使用者選了 Stay in Survey，要我先核對兩件未確認的事；另外兩題已定：「先問完、剩下自己跑」那條決定要重開，station 導覽條目改成 Watch（事件：使用者提出要對外展示或錄導覽）。

核對結果，結論先說：Pane 要顯示 description 是做得到的，而且 description 多半已經有，只是我們沒拿來顯示。
- Pane 事件帶 description：型別檔 docs/90-agent/reports/evidence/2026-10-03-mod-probe-3/mod/.claude-plugin/types/claude-code-tools/index.d.ts:194-200 的 Bash 參數有 `command` 與 `description?`，同檔第 3 行說 `e.tool === "Bash"` 會收窄到這些參數，所以 hooks/pane.ts:717 的 `call` 加一個 `description` 欄位就拿得到，不必改讀 transcript。
- 模型本來就會給 description：本 session 的 transcript（C:/Users/user/.claude/projects/F--ymlab-fankeel/00e02e3b-0423-4b5a-b47f-5fd542011de7.jsonl）裡 await.js 的背景呼叫是 `{"command":"cd F:/ymlab/fankeel && node scripts/await.js --session ...","description":"Wait for the survey stage agent","run_in_background":true}`。所以 `cd F:/ymlab/fankeel && ` 是模型自己加的習慣，沒有任何規則指示，而 description 已經寫得清楚，但 Pane 與站台列只顯示 command，這才是使用者看到一排 cd 的原因。
- 修正範圍因此縮小：第二點（存並優先顯示 description）是主要修法；第一點（剝 cd 前綴）當作沒有 description 時的退路；第三點的規則改成「description 要帶」的一句提醒，不必再補 hook。
- 仍無法核對：Claude 桌面 app 自己的 shell 面板顯示哪個欄位；那是 app 內部的畫面，本機看不到。若使用者說的是 app 自己的面板而不是 fankeel 的 Pane，我們能做的只剩讓 description 一律存在、寫得有意義（規則一句加上 hook 補缺），顯示欄位是 app 決定的。這點請使用者在計畫時確認是哪一個面板。

使用者答了：看到那一排 `cd XXX && …` 的是 fankeel 的 Pane。所以那個不能核對的疑問已解，範圍定為 Pane（hooks/pane.ts、hooks/pane-shell.ts、hooks/pane-status.ts），不是 app 自己的面板。做法照上面：Pane 的 tool.call 處理存 `description`，shells 列有 description 就顯示它，沒有才剝 `cd <path> &&` 前綴並把腳本路徑縮成腳本名；站台一側（lib/shells.js）同樣處理以保持一致。

class: bounded，route: unchanged。

```json gate
{"questions":[{"header":"Survey→Plan","question":"Survey -> Plan | fankeel : TODO 全表盤點 + shell 標示看得出在跑什麼","options":[{"label":"Go to Plan (Recommended)","description":"接受 bounded 分類；把 10 條 do now、重開無人值守決定、station 導覽改 Watch 與新項「shell 標示」排進計畫。新項只動 fankeel 的 Pane：存並優先顯示 description，沒有時剝 cd 前綴，站台列同步；規則補一句背景 Bash 要帶 description。"},{"label":"Stay in Survey","description":"範圍已定為 Pane，沒有待核對的事；只在使用者想改動分類或盤點結果時才留下。"},{"label":"暫停","description":"盤點與新項都先停在這裡，待使用者決定；兩個已答的處置也先不執行。"}]}],"next":"Plan：10 條 do now 加 Pane shell 標示新項，先存並顯示 description"}
```
