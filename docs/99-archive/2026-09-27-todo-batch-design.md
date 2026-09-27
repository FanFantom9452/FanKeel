---
status: current
last_verified: 2026-09-27
---

# TODO 大批次：工具修補、docs 工具、review、圖、station

session f44b1c61-9b5a-441c-b2b1-b11576edf535 的 design，五節逐節經使用者同意。它描述的是要做成的樣子。
survey：`.fankeel/build/task-20260927T073715/survey.md`。mockup：`.fankeel/build/2026-09-27-station-batch/mockup.html` — 方向（原樣定稿，細節交 build 的 render reviewer）。
另含 ab.sh 重跑（使用者已核准約 $30），不需要 design，在 build 跑。

## 1. 工具修補

- `scripts/commit.js`：列出的 path 是某個 staged rename 的新路徑時，`git diff --cached -M --name-status` 找到的舊路徑併進同一個 `commit -o`。
- `scripts/tune.js` `doneLive`：`stray` 全是 wait 之後才出現的 untracked 新檔（HEAD 與 snapshot 都沒有）時，只把它們移到 `.stray/`，保留 `--src` 的改動，settle 為 done 並附一行說明；只要有一個 tracked 檔，照舊整批還原。
- `scripts/residue.js` `scan`：`git -C <wt> status --porcelain` 有輸出的 worktree 不列入 `worktrees`，改列新的 `dirty` 區（context，不是缺陷）。
- 測試：git mv 後 commit 的 `--stat` 同時列刪除與新增；`--src` 改一行加上 `.playwright-mcp/x.png` 仍 done 且改動還在；已合併的 dirty worktree 不在 `worktrees`。

## 2. docs 工具

- `declaredSymbols` 從名字集合改成名字 → 宣告檔清單。
- `docs-check.js docs-for <path>`：讀 positional；列 owner（`source_of_truth` 寫了此檔的頁）與 mentions（頁中反引號 `x()` 的 `x` 宣告在此檔）。docs-check 不新增 finding。
- `lib/docs.js` 加 `sourcesOf(root, files)`，仿 `bindingOf` 逐頁收 `source_of_truth`。
- `lib/profile.js` 由 `KEYS` 與 `PRESETS.balanced` 產生 `docs/01-guide/profile.md` 的 key 表，放在標記之間；`scripts/profile-table.js` 寫入；測試重新產生後比對，仿 `tests/stage-registry.test.js`。
- 新頁 `docs/90-agent/reference/shared-libs.md`，`source_of_truth: lib/hook.js, lib/report.js`，並登入 `docs/README.md`；`documents.md` 補一段 `docs-for`。
- 測試：fixture 兩頁，`docs-for lib/a.js` 列出並分標 owner/mentions；改 `KEYS` 一條 `desc` 讓 profile-table 測試轉紅；docs-audit 不再報 `hook.js`、`report.js` 沒被點名。

## 3. review 強化

- 主審、security、silent-failure 三種 lens 的 finding 行尾加 `— fails when <輸入或狀態> → <錯誤結果>`；寫不出就不報。cuts 與 comment lens 不變。
- `fankeel-reviewer.md` 加 `## Verify` 模式：逐條讀 finding，標 `CONFIRMED`、`PLAUSIBLE` 或丟掉。
- build 與 verify 的 skill：第一輪有 finding 時多派一個驗證 reviewer，一次審查一個，不是每條一個。
- 所有 lens 不報：diff 外既存的問題、linter 會抓的、純風格挑剔、被 `eslint-disable`/`noqa` 類註解消音的。
- security lens 另加上游的 16 條硬排除、17 條判例與 `conf: 0.x`，低於 0.7 不報；原文先從 Anthropic 的 `claude-code-security-review` 取得並確認授權。
- 測試：reviewer 合約測試斷言三種格式帶 `fails when` 且有 `## Verify`；`evals/security-lens/` 加一個應排除案例，從報出變成 `none`。

## 4. 圖

- 新 `lib/requires.js`：解析 tracked `.js` 的相對 `require('./…')` 與 `import … from './…'`，回傳 `{from, to, line}` 邊。
- `lib/map.js` `buildMap()` 在 tree 之後加 orientation 段：被 require 最多的前 5 個檔，與跨頂層目錄的 dir→dir 邊數（`report.section` 截斷）。
- `lib/plantasks.js` 加 `requireConflicts(tasks, root)`：同一組內 A 的 Files require B 的 Files 而 Consumes 未宣告，就報；`scripts/ledger.js` `groupsReport` 印出，帶此診斷的組不走 `workflow`。只看得到 Modify 的既有檔，Create 的檔在 plan 時還不存在。
- `agents/fankeel-reader.md` Return 段：每行標 `EXTRACTED` 或 `INFERRED`；關係寫 `A --rel--> B at=file:line`。
- 測試：fixture plan 中 Task 1 改 `a.js`、Task 2 改 `b.js`、`a.js` require `b.js` 且無 Consumes，`groups` 印出 require 診斷且不判 workflow；本 repo 的 orientation 段有內容。

## 5. Station

- `lib/station.js` `gather()` 的 row 帶 `gateAt`；`dashGate`、`liveGate` 用 `gateAt || pending.at || updated` 計時。`handoff.js` 不改。
- row 帶 `inflight` 與 `subagents`（讀該 session 的 `subagents/*.meta.json`，只列還在跑的）；#/live 的 session 卡加第三列，照 mockup 的 `live-subagents`。
- `scripts/station.js` 的 `/station/station-data.js` 加 2 秒 memo，同時的請求共用一次 `gather()`。
- `GET /station/search?q=`：只掃 docs.json 裡 role 為 reference、decision 的頁（audience 為 human 的 reference 標為 guide），最多 20 筆附 snippet；文件頁頂端加搜尋框，照 mockup 的 `docs-search`；靜態 `index.html` 顯示需開 serve。
- `PAGES` 加 `tour`，導覽列加入口，照 mockup 的 `tour-nav`；靜態檔改清單放行，涵蓋 `tour*.js/css/html` 與 `i18n.js`。
- 新 `assets/station/i18n.js`：英文表與 `loc(key, zh, vars)`，中文留在呼叫處當 fallback，預設依 `navigator.language`，存 localStorage；標題列加切換，照 mockup 的 `lang-switch`。i18n 最後做。
- `docs/90-agent/reference/station.md`:546 的「沒有全文搜尋」改寫，補 search、i18n、tour。
- 測試：row 有 `gateAt` 時渲染的「等了 N 分」等於 now − gateAt；search 搜得到 reference 頁、搜不到 archive 頁；`GET /station/tour.js` 回 200；EN 模式下導覽列與標題沒有 CJK 字。

## 未驗證

- 只看 meta.json 判斷不出 subagent 還在跑，可能要看 jsonl 的 mtime；plan 時確認。
- 產生器能否原樣重現 profile 表把 8 個 `prompt.*` 合成一列的寫法。

## 對照 map

- `.fankeel/map.md`:15 描述 residue 的「a worktree whose branch is merged」要改一句。
- `docs/90-agent/reference/station.md`:546、`documents.md`、`subagents.md` 各要補一段。
- 鄰居 session 的 claims 含 `TODO.md`；land 時改 TODO 會撞，屆時問使用者。
