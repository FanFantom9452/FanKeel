結論：build 留下的四項未驗證都補驗過了，加上你要求的真實判官實測，全部成立，沒有需要退回 build 的項目。

```
$ node --test tests/render.test.js   (lib/render.js:881 的 '  - inflight: ' 改成 '  - inflite: ')
ℹ pass 76  ℹ fail 1   — 失敗的正是 "a judge's brief carries the profile's dispatch.inflight ..."；還原後 git diff --stat 為空，未改動時 77 pass 0 fail

$ echo '{SubagentStart, agent_type: fankeel:fankeel-judge}' | node hooks/brief.js
  - inflight: unlimited — the most fankeel:fankeel-reader you send in one response (profile dispatch.inflight); unlimited means no cap.

真實派出一位 fankeel-judge 問「你能派幾位 reader、數字從哪來」
pick: unlimited — no cap ...; 引用了自己 brief 裡的 `inflight: unlimited` 那一行，並追到 lib/render.js:881 與 agents/fankeel-judge.md:31-37

$ node scripts/suite.js --session 30421c7e-7fcf-4361-be33-90b25dd1ebbb --fast
suite: 6146 pass, 0 fail @ 3e55cbf8

$ node scripts/docs-check.js
9 references that no longer resolve
```

- 新 render 測試能變紅 — held：mutator（sonnet）改掉 `inflight:` 字樣，77 pass 變 76 pass 1 fail，且只有該測試失敗，檔案已還原。
- 真實判官 brief 帶值 — held：hook 輸出與真實判官自己引用的 brief 行一致，在 `dispatch.inflight: unlimited` 下判官認定不設上限（它因清單只有兩行而派兩位 reader）。
- 整個 fast suite 重跑 — held：在最新 commit 3e55cbf8 上 6146 pass、0 fail。
- docs-check — 已執行，9 項未解析，全部與本任務無關（見下）。
- docs: none — 判官相關頁面沒有仍寫「最多八位」的地方。
- fixed here: none。
- 一個觀察：那位判官載入的是已安裝外掛的舊版說明，仍寫「最多八位」，硬碟上的新版已改為以 brief 的 `inflight:` 為準。這是 plugin update 之後才會一致，不是本任務的缺陷，但 land 後要記得更新外掛。
- 其他任務留下的紅燈，未處理：`docs/03-decisions/2026-11-02-session-shelf.md:1` 缺決定頁標題；`docs/README.md:402` 指向不存在的 `scripts/tour-record.js`；`skills/fankeel-plan/rationale.md:29`、`:31` 指向不存在的 professor 計畫頁；`docs/90-agent/reference/improvement-brief.md:992`、`:1053`、`skills/fankeel-survey/SKILL.md:309`、`docs/90-agent/todo/model-3.md:12` 行號已移動；`docs/90-agent/todo/notify-2.md:18` 有裸 commit 雜湊。`docs/90-agent/reference/sources.md` 與 `docs/README.md` 在工作樹有別的任務的未提交修改。
- adversary: nothing（上一輪已跑；它沒有自己重跑 hook 或 suite）。

沒檢查的部分：沒用 12 之類的數字 profile 做真實判官實測，數字值只靠 render 測試涵蓋。

reads:
lib/render.js — 判官 `inflight:` 行（879-882）
agents/fankeel-judge.md — 判官如何使用 `inflight:`（31-39）

```json gate
{"questions":[{"header":"Verify→Land","question":"Verify -> Land | fankeel : 判官 reader 數讀 profile","options":[{"label":"Go to Land (Recommended)","description":"mutation 驗證測試會變紅、真實判官確實讀到 inflight: unlimited、suite 6146 全綠；docs-check 的 9 項紅燈都屬其他任務；land 後需 plugin update 讓已安裝的判官說明同步"},{"label":"Back to Build","description":"若想改判官說明或補數字 profile 的測試，退回 build"},{"label":"暫停","description":"先停在這裡，之後再決定是否收尾"}]}],"next":"land：含真實判官實測在內的驗證都成立，可收尾；land 後做 plugin update"}
```
