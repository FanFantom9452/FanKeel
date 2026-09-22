---
status: design-intent
---

# TODO.md 全清：Ready 1 條與 Needs a decision 9 條

2026-09-23。survey 由四個 sonnet reader 讀過十條的現況；design 關卡上四個方向
都由使用者選定（小項全照建議、三欄先出 mockup、render 腳本加 lens、TokenBar 做而
compiler 掛起）。每一節是一條 TODO，節內第一層 bullet 是承諾。

## 1. `ctx.js` 的 `woken` fixture

- `tests/ctx.test.js` 加一個 agent 檔的 fixture，裡面有一行會觸發喚醒的 `type:'user'` 行，斷言 `m.stages[0].woken` 不為 0；現有 agent 檔 fixture（約 `:210-233`）只由 `assistant()`／`side()` 組成，`woken` 恆為 0。
- `isAgentFile` 不動：`ae4e96e` 已查證 `summarise` 判 null 的寫法會誤判混合檔，理由在 `scripts/ctx.js:90-97` 的註解。
- `TODO.md` 的 `## Ready` 那條刪掉。

## 2. `docs/README.md` 的 *built* 標籤與 frontmatter

- 六頁 archive 的 frontmatter 由 `status: design-intent` 改為 `status: current`：`docs/archive/2026-09-18-todo-six-design.md`、`docs/archive/2026-09-18-todo-six.md`、`docs/archive/2026-09-18-todo-nineteen-design.md`、`docs/archive/2026-09-18-todo-nineteen.md`、`docs/archive/2026-09-19-station-live-design.md`、`docs/archive/2026-09-19-station-live.md`。三組的程式都已存在（`lib/gates.js` 的 `labels`、`docs/documents.md:25`、`lib/serve.js` 的 `probe`）。
- `docs/README.md:105` 那列（`docs/archive/2026-09-05-stage-division.md`）的標籤由 *design-intent* 改為 *built*；該頁 frontmatter 已是 `current`，`scripts/ledger.js` 的 `groups` 在。
- 封存時 `status` 沒翻的根因不在這一輪修：docs-audit 只看 `role==='plan'` 的頁（`scripts/docs-audit.js:578-591`），封存後就沒人看。記一條 TODO，不改掃描器。

## 3. `path:行-行` 引用補引文

- 五條沒帶引文的範圍引用各補一句短引文，走 docs-check 既有的引文比對（`scripts/docs-check.js:366-385`）：`docs/collisions.md:305`、`docs/subagents.md:110`、`docs/subagents.md:112`、`docs/subagents.md:116`、`skills/fankeel-build/rationale.md:132`。
- docs-check 的嚴重度不改：沒帶引文的範圍仍只列不擋。
- `docs-check` 的 `cited with no quote` 計數由 5 降到 0。

## 4. `task.js task` 改名時蓋戳

- `cmdTask`（`scripts/task.js` 約 `:809`，設好 `d.stage = route[0]` 之後）呼叫 `registry.stampEntry(d, route[0], now)`，與 `cmdStart`（`scripts/task.js:614`）一致：`moves` 從 `[[head, now]]` 重新開始，`clock[head]` 從改名那一刻算。
- `tests/task.test.js` 加一個測試：改名後 `moves` 長度為 1、時間是改名時刻，不是下一次 hook sighting。
- `docs/registry.md:31` 說這是刻意的那句改寫成新行為。

## 5. stage-agents 的兩個缺口

- **第二層不再平鋪**：`lib/usage.js` 的 `agentFiles()`（`:160-190`）讀出每個 agent 檔的父 agent，站頁把站 agent 自己派的 reader／reviewer／implementer 縮排在它底下，不再與它並列。欄位名（`parentAgentId` 或其他）由 plan 先從一份真實的巢狀 transcript 讀出來再定。
- **插話不起第二個站 agent**：站 agent 出發時 registry 記一個 in-flight 標記（stage 與時刻），由 `SubagentStart` hook 寫、交回 handoff 檔時由 `hooks/gate.js` 清；主控 block 在標記存在時說「已有一個 <stage> 站 agent 在跑，用 SendMessage 找它，不要再派」。
- 兩者各有測試：巢狀 fixture 的縮排，與標記存在時主控 block 的那一行。
- 第 1 缺口（design 跨輪對話，`lib/stages.js:614-621` 已寫）與 build 兩回合提交的成本，併入 `## Waiting` 既有的「受控 build/verify 實跑」timing，那條 Needs a decision 刪掉。

## 6. serve 察覺自己跑的是舊程式

- `scripts/station.js` 啟動時算一個 fingerprint（`lib/station.js`、`assets/station/station.js` 與 `package.json` 版本的 mtime＋大小），放進 health 回應（`scripts/station.js:414`）。
- `lib/serve.js` 的 `probe()`／`ensureServe`（`:46-85`、`:114-143`）比對磁碟上的 fingerprint，不一致時結束舊的 process 並起新的，當作「沒在跑」處理。
- 測試：改一個被 fingerprint 的檔之後，`ensureServe` 回報重啟。

## 7. 站首頁：左側功能列與設定精靈

- 這一輪只交 mockup：`.fankeel/build/2026-09-23-todo-ten/mockup.html`，由 opus 產出，不提交。三欄版在 design 關卡被否決，核可的是第二版。
- 核可的版面：左側功能列切換「現在／近 30 天／最近 sessions／專案／文件／設定」；設定是七步精靈（收尾、任務大小、前端、context、撞檔、模型、監控站），以開發習慣的問題推出 `lib/profile.js` 全部十個 `KEYS`；所有選擇是按鈕群組或 chip，沒有下拉選單；最後一頁逐列改值、標出改過建議、每列「清成 (ask)」、選寫入範圍後一顆「寫入 N 鍵」。
- 三張習慣預設卡併入精靈第 4 步與第 1 步；日細節面板、清掉 stale 的提示、專案卡的「套用機器預設」鈕這版不放。
- 實作另開一個 task：那條 Needs a decision 改寫成 `## Ready` 的一條，指向本 spec §7 與 mockup 的路徑。

## 8. 前端審查：render 腳本與 reviewer 的 lens

- 新增 `scripts/render.js`：找本機的 Chromium 系瀏覽器（Edge、Chrome，或 `ms-playwright` 快取），以 `--headless --screenshot` 與 `--dump-dom` 產出一張 PNG 與 render 後的 DOM，路徑印在 stdout。不加任何 npm 依賴。
- `agents/fankeel-reviewer.md` 加一個 `render` lens：被派到有畫面的改動時，跑 `scripts/render.js`、Read 那張 PNG，並從 DOM 裡對兩個由同一來源推出的數字；Bash 的允許範圍加上這支腳本。
- `skills/fankeel-verify/SKILL.md` 在派 reviewer 處說明何時帶 `render` lens。
- 測試：`scripts/render.js` 對一個固定的本地 HTML 產出非空 PNG 與含指定文字的 DOM；找不到瀏覽器時非零退出並說明。
- 「Jev 這類小判斷模型當篩子」不在這一輪：repo 裡查不到 Jev 指什麼。

## 9. TokenBar 的 5h／7d 序列（另一個 repo）

- `F:\ymlab\TokenBar` 的 `statusline.ps1` 在 payload 解析後（約 `:371`）無條件 append 一行 JSONL：時間、`five_hour.used_percentage`、`five_hour.resets_at`、`seven_day.used_percentage`、`seven_day.resets_at`、`cost.total_cost_usd`。
- `statusline.sh` 做同樣的事；plan 先讀它確認結構。
- TokenBar 自己 commit，fankeel 這邊只刪那條 TODO 並在 `scripts/spend.js` 相關文件記下序列檔的位置。

## 10. 多平台 compiler 與 Waiting 的整理

- 多平台 compiler 那條移到 `## Waiting`，timing「第二個平台的使用者」，lifts when：出現第二個 host 的使用者或 issue。
- 「受控站開到 build」timing 已解除（`6fb1b3a` 讓 session 記錄存 `stage.agents`），它的條目移到 `## Needs a decision`，那個 timing 刪掉。
- `node scripts/todo-check.js` exit 0。

## 成功條件

- 新測試（§1、§4、§5、§6、§8）在改動前紅、改動後綠，整套 `npm test` 綠。
- `node scripts/docs-check.js` 的 unquoted 計數為 0，其餘不增。
- `node scripts/todo-check.js` exit 0，`## Needs a decision` 由 9 條變為本 spec 留下的條數。
- 產出物一列：`scripts/render.js` 對真實站頁產出的 PNG 裡，首頁的 session 總數與 DOM 裡同一來源的列數相等。
