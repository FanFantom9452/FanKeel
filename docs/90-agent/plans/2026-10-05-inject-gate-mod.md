---
status: design-intent
---

# 函式 hook、注入節流與 gate 報告面板：不做，寫成決策 Implementation Plan

**Goal:** 寫一頁決策紀錄，說明為什麼不把注入改成行程內函式 hook、也不在終端或 Desktop 加 gate 報告面板，把節流的想法併進 inject-3「注入先開 server」，並為這三份新頁補索引列。
**Architecture:** 只有一個 task，三個檔：新決策頁 `docs/03-decisions/2026-10-05-inject-gate-mod.md`、`docs/90-agent/todo/inject-3.md` 內文多一段、`docs/README.md` 多三列索引（決策頁、設計稿、本計畫）。不動任何程式。inject-4 與 gate-6 兩條 TODO 已列在本 task registry 的 `todo` 欄，由 land 以 `todo.js done` 關閉（子代理被分類器擋時由使用者以 `!` 執行），本計畫不關，免得 land 再關一次時報 `already done`。
**Tech Stack:** Node v24.9.0（`node scripts/docs-check.js`、`node scripts/todo-check.js`），git 2.44.0.windows.1，fankeel 0.98.0，Claude Code 2.1.289（決策頁裡的版本號）。
**Spec:** [2026-10-05-inject-gate-mod-design.md](2026-10-05-inject-gate-mod-design.md)

## Global Constraints

由 `node scripts/map.js`（574 份 markdown、12 份 planned 未建）、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`）、`package.json` 與 `.fankeel/profile.json` 產生：

- 新頁或改名的頁，要在同一個變更裡補 `docs/README.md` 的索引列（`CONTRIBUTING.md`「Documentation」那列）；`docs/03-decisions` 是 decision 角色，`docs/90-agent/plans` 是 plan 角色，不必改 `.fankeel/docs.json`。
- TODO 條目在 `docs/90-agent/todo/`，沒有 `TODO.md`；開放中的條目受 `node scripts/docs-check.js` 的 gone、symbol、quote 檢查：條目內文不寫 `path:line`，不把不存在的名字放進反引號。改完跑 `node scripts/todo-check.js`，exit 0。
- 行尾 LF（`.gitattributes`：`* text=auto eol=lf`）。檔案用 Edit／Write 改，不用 heredoc（heredoc 吃反斜線）。
- 這次 build 由 stage agent 跑：實作者在自己的 worktree 裡工作，開工前先 `git reset --hard <build agent 給的 sha>`；實作者不 commit、不 `git add`、不 `git stash`，改完就回報要提交的路徑與訊息。每則 commit 訊息最後兩行是 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` 與 `Claude-Session: https://claude.ai/code/session_01BkjkUicyfPuMVG8DTZDVoy`。
- 文件裡的 session id 寫成 `session <id>`，不寫裸的 8 位 hex；commit 寫成 `commit <sha>`。
- profile：`language` 是 繁體中文，`gate.station` 是 `off`，`guard` 是 `deny`，`land.push` 是 `false`。

## Risks

- 決策頁引用的事實若與來源不符，頁面就是錯的決策依據 — Task 1 — 第 1 步先打開 Read 列的四個來源，逐點核對；找不到的點刪掉並在回報裡說，不憑記憶補。
- inject-3 是開放條目，新段落若放進反引號名字或 `path:line`，`docs-check` 會擋 — Task 1 — 新段落不含反引號與行號，第 4 步跑 `docs-check` 與 `todo-check` 確認。
- inject-4、gate-6 若在 build 被關，land 照 registry 的 `todo` 欄再關一次會失敗 — Task 1 — 本 task 不碰這兩個條目檔。

## Task 1: 決策頁、inject-3 補節流、三列索引

**Files:**
- Modify: `docs/03-decisions/2026-10-05-inject-gate-mod.md` — 新檔，決策紀錄
- Modify: `docs/90-agent/todo/inject-3.md` — 內文最後加一段節流
- Modify: `docs/README.md` — 決策頁、設計稿、本計畫三列索引
- Read: `docs/90-agent/plans/2026-10-05-inject-gate-mod-design.md` — 這次設計的結論與證據
- Read: `docs/03-decisions/2026-10-03-mod-route.md` — 擱置理由與重新評估的時機
- Read: `docs/90-agent/reports/2026-10-05-inject-timing.md` — `station.write` 中位數 1756.3ms
- Read: `hooks/inject.js` — `station.write` 只在 `starting` 時跑
- Read: `docs/90-agent/reference/station.md` — `gate.station` 的浮動面板與「交給終端／手機」

**Interfaces:**
- Consumes: none
- Produces: `docs/03-decisions/2026-10-05-inject-gate-mod.md`（land 關 inject-4、gate-6 時，`--record` 指向這頁）

**Dispatch:** implementer, sonnet

1. 打開 Read 列的檔（設計稿是整體脈絡，其餘是四點的來源），確認下面決策頁「為什麼」的四點都在來源裡寫著：mod 路線那頁的旗標與每 session 啟用；計時報告的 1756.3ms 與 94%；`hooks/inject.js` 裡 `station.write` 只在 `starting` 時跑；station.md 的 `gate.station` 浮動面板與「交給終端／手機」。有一點來源裡找不到，就把那一點刪掉並在回報裡說。

2. 寫新檔 `docs/03-decisions/2026-10-05-inject-gate-mod.md`：

```md
---
status: decision
last_verified: 2026-10-05
---

# 函式 hook、注入節流與 gate 報告面板（10-05）：決策紀錄

一句話：fankeel 不把 UserPromptSubmit 注入改成行程內的函式 hook，也不在終端或 Desktop 加 gate 報告面板；節流的想法併進 TODO 條目 inject-3「注入先開 server」，inject-4 與 gate-6 隨這份紀錄關閉。

使用者在 2026-10-05 這個 task 的 design gate 選了這個方向。設計稿是 [2026-10-05-inject-gate-mod-design.md](../90-agent/plans/2026-10-05-inject-gate-mod-design.md)。

## 為什麼

- 函式 hook 就是擱置中的 mod 路線：Claude Code 裡行程內的 hook 是 plugin 的 hooks module，也就是 [mod 路線決策](2026-10-03-mod-route.md) 擱置的那條路。這一輪讀了本機 Claude Code 2.1.289 的執行檔：hooks module 仍受 `tengu_plugin_hooks_modules` 旗標控制，每個 session 仍要在 `/plugin` 按 Enable for this session 才載入。那頁寫的重新評估條件都還沒成立。
- 節流的收益小：`station.write` 只在打 `/fankeel` 的那一輪跑，一個任務通常只打一次；[注入計時報告](../90-agent/reports/2026-10-05-inject-timing.md) 量到它的中位數是 1756.3ms，佔該路徑 94%，離五秒逾時還遠。真正可能逼近五秒的是冷啟動與慢磁碟，那是 inject-3 要處理的，所以節流放進 inject-3 一起決定。
- 報告面板已經有了：command hook 只能回傳文字，畫不了終端或 Desktop 的介面。瀏覽器這一側，`gate.station` 設成秒數時，gate 會顯示在 station 頁的浮動面板並能直接回答，還有「交給終端／手機」把問題交回終端（[station 參考頁](../90-agent/reference/station.md) 的 Answering a gate from the page）。手機與遠端仍看 AskUserQuestion，維持原樣。

## 定了什麼

- 不做函式 hook：注入繼續用 command hook（`hooks/inject.js`）。
- 不做終端或 Desktop 的報告面板：要在網頁上看並回答 gate，就把 profile 的 `gate.station` 設成秒數。
- 節流併進 inject-3：先開 server 之後，再評估短間隔內跳過這一輪的 `write`，間隔由冷啟動量測決定。

## 沒做的

- hooks.json 是否接受 `type: "function"` 沒有查證：執行檔裡找不到列出可用型別的 schema，只能從它帶 JS callback 推斷不行。結論不受影響，因為就算可以，hooks module 的旗標與每 session 啟用仍擋在前面。
- 重新評估的時機：沿用 mod 路線那頁的條件——hooks module 不再受 rollout 旗標控制、啟用也不必使用者動手。
```

3. 在 `docs/90-agent/todo/inject-3.md` 內文最後一段（以 `來源：2026-10-05 注入計時報告` 開頭、以 `改了就有測試。` 結尾那段）之後，空一行加入下面這段（不含反引號、不寫行號）：

```md
節流（2026-10-05 由 inject-4 併入，決策頁 2026-10-05-inject-gate-mod）：先開 server 之後，若 station 頁在短時間內剛寫過，就評估是否跳過這一輪的 write；間隔由冷啟動量測決定，並說明頁面因此落後時使用者看不看得出來。
```

4. 在 `docs/README.md` 找到以 `| TODO 全表盤點第五輪（10-05）定了什麼` 開頭的那一列，在它下面加入三列：

```md
| 函式 hook、注入節流與 gate 報告面板（10-05）定了什麼：都不做；函式 hook 就是擱置中的 mod 路線，面板已由 `gate.station` 的 station 頁提供，節流併進 inject-3 | [decisions/2026-10-05-inject-gate-mod.md](03-decisions/2026-10-05-inject-gate-mod.md) — *繁體中文* |
| 那份決定的 design：hooks module 仍受旗標控制、`station.write` 中位數 1.76 秒、`gate.station` 已能在頁面答 gate | [plans/2026-10-05-inject-gate-mod-design.md](90-agent/plans/2026-10-05-inject-gate-mod-design.md) — *design-intent, 繁體中文* |
| 那份設計的一個 task：決策頁、inject-3 補節流、索引 | [plans/2026-10-05-inject-gate-mod.md](90-agent/plans/2026-10-05-inject-gate-mod.md) — *design-intent, 繁體中文* |
```

5. 驗證，三個都要 exit 0：

```sh
node scripts/docs-check.js; echo "docs-check exit $?"
node scripts/todo-check.js; echo "todo-check exit $?"
node scripts/todo.js list | grep -n "inject-3\|inject-4\|gate-6"
```

   第三行要列出 inject-3、inject-4、gate-6 三條（後兩條由 land 關，這裡仍開著）。`docs-check` 若因新檔未 `git add` 而報它，照實回報，不自己 `git add`。

6. 不 commit。回報三個路徑：`docs/03-decisions/2026-10-05-inject-gate-mod.md`、`docs/90-agent/todo/inject-3.md`、`docs/README.md`；訊息：

```text
docs: record why inject stays a command hook and gate gets no terminal panel

- why: the function hook is the shelved mod route, write is 1.76s median, gate.station already answers on the page — docs/03-decisions/2026-10-05-inject-gate-mod.md
- the throttle folds into the server-first entry — docs/90-agent/todo/inject-3.md
- three index rows: the decision, its design, this plan — docs/README.md
```

## Coverage

| promise | task |
|---|---|
| 新增 `docs/03-decisions/2026-10-05-inject-gate-mod.md`，`status: decision`，寫明三件事各自的結論與上面的證據 | Task 1 |
| 在 `.fankeel/docs.json` 不必加條目：`docs/03-decisions` 已整個登記為 decision。 | Task 1（不改 docs.json；索引列在 `docs/README.md`） |
| 在 `docs/90-agent/todo/inject-3.md` 的完成條件後加一句：先開 server 之後，若 station 頁在短時間內剛寫過 | Task 1 |
| `inject-4`（注入改函式 hook 加節流）與 `gate-6`（gate 加報告面板）以 `todo.js done` 關閉，紀錄指向第 1 節的決策頁 | struck — 兩條已在本 task registry 的 `todo` 欄，由 land 以 `todo.js done` 關閉並以 `--record` 指向決策頁；分類器擋下時由使用者以 `!` 執行 |
| 現在 `node scripts/todo.js list` 會列出 inject-4 與 gate-6，做完後不再列出。 | land（Task 1 第 5 步確認 build 後仍列出） |
| `node scripts/docs-check.js` 對新決策頁通過，裡面引用的路徑都解析得到。 | Task 1 |
