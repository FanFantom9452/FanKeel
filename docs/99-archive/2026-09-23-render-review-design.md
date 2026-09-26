---
status: current
---

# 渲染審查與逐塊即時調 — 設計

`〔render〕` 與 `〔design〕` 兩條 TODO 併成一個 task。survey 的結論：
`scripts/render.js` 一次只截一頁、沒有角色；`fankeel-reviewer` 的 `render`
lens 只比對同源數字，不對照 mockup；`data-block` 已在
`assets/station/station.js` 上，但沒有只重寫一塊的機制。這份設計推翻
[2026-09-23-todo-ten.md](../03-decisions/2026-09-23-todo-ten.md) 的「前端審查
agent：不另開 agent」一列——使用者在本 task 的 survey 關卡改判為獨立 agent。

mockup：`.fankeel/build/2026-09-23-render-review/mockup.html`（不提交），
畫的是 §3 的 overlay。

## survey 量到的底（前提，不是承諾）

- impeccable 的 live 是本機 helper server 注入 `live.js`、long-poll 傳事件、
  由 applier 依 `sourceHint` 與逐字相符的原始碼片段改檔；它的 finish reviewer
  自己不渲染，由 parent 截圖後逐元素對照核可的 comp。
- browser-use 是 Python＋Playwright＋LLM API key，不引入；只借「每個角色一個
  瀏覽器 profile」的做法。
- Jev（TypeSafe AI）是雲端 API、不吃圖，不採用。

## 1. render.js：多頁、多角色

- 專案在 `.fankeel/render.json`（提交）宣告 `pages: [{ name, url }]` 與
  `roles: [{ name, pages? }]`；角色沒寫 `pages` 就是全部頁面。
- `node scripts/render.js --config [<render.json>]` 對每個「角色 × 頁面」各跑一次
  headless，瀏覽器帶 `--user-data-dir=.fankeel/build/render/profiles/<role>`，
  輸出 `.fankeel/build/render/<role>/<page>.png` 與 `.html`，最後寫
  `.fankeel/build/render/index.json` 列出每一格的路徑與結束碼。
- `node scripts/render.js login <role> <url>` 用同一個 profile 目錄開有視窗的
  瀏覽器，使用者手動登入後關掉；登入狀態只存在 `.fankeel/build/`（已 gitignore），
  從不提交。
- 原本的單頁用法 `render.js <url-or-file>` 不變。
- `render.json` 讀不懂、角色指到不存在的頁面，一律非零退出並說是哪一列；
  任一格 PNG 沒寫出，`index.json` 照寫，整體非零退出。

## 2. `fankeel-render-reviewer`：對照 mockup 的渲染審查

- 新 agent 檔 `agents/fankeel-render-reviewer.md`，`model: sonnet`，工具
  Read、Grep、Glob、Bash；Bash 只准 `node scripts/render.js`，不改任何原始碼。
- 輸入：需求原文、核可的 mockup 路徑、`index.json`、`render.json`。它先用
  `render.js` 以同尺寸截 mockup，再逐格讀截圖與 DOM。
- 第 0 步證據：每一格 PNG 存在、不是空白、尺寸與設定相符；任一格不合格就只回
  `disposition: recapture` 加缺哪幾格，不做審查。
- 逐元素表：以 mockup 的 `data-block` 為列、角色為欄，每格判
  `match`／`adaptation`／`missing`／`contradicted`／`added`；
  `adaptation` 要引出需求或使用者答案作依據，否則算缺陷。
- 角色差異：`render.json` 或需求說某角色不該看到的區塊出現了，算 `contradicted`。
- 回傳第一行是 `disposition: recapture|fix|ship` 三字之一，接逐元素表、
  最多八條依嚴重度排序的修正、一行「不能動的」。
- build 裡每個動到頁面的 task 落地後派它；verify 對所有角色與頁面完整跑一輪。
- `fankeel-reviewer.md` 的 `## Render` 一節與 Bash 的 `render.js` 權限收回；
  `skills/fankeel-verify/SKILL.md` 改派新 agent；`lib/guard.js` 的
  `READ_ONLY_AGENTS` 與 `lib/stages.js` 的 `STAGE_AGENTS`（build、verify）加上它。

## 3. 注入式逐塊即時調：`scripts/tune.js`

- `node scripts/tune.js serve <dir> [--port]` 對一個靜態目錄起本機 server，
  回 HTML 時在 `</body>` 前注入 `<script src="/__live/overlay.js">`；
  原始檔不被修改，所以沒有收尾要清。
- overlay（`assets/tune/overlay.js`）照 mockup 的五個狀態：hover 描出
  `data-block` 與名稱、點選後停靠的小面板、送出後的狀態膠囊與佇列數、
  完成時閃一下、被退回時的警示；角落有開關，`Esc` 關面板。
- 送出是 `POST /__live/request { page, block, note }`，server 附上 id 寫進
  `.fankeel/build/tune/queue.jsonl`。
- session 端 `node scripts/tune.js wait` 阻塞到下一筆請求，印出 JSON；
  parent 派 implementer 只重寫那個 `data-block` 元素，完成後跑
  `node scripts/tune.js done <id>`。
- `done` 先檢查：把改動前後的檔案各自拿掉該區塊元素，剩下的必須逐字相同；
  不同就把檔案還原、回報被動到的區塊名，overlay 顯示退回。
- 通過後 server 經 SSE 通知頁面重新載入，overlay 標出剛改的區塊。
- 只支援 `data-block` 逐字寫在所服務檔案裡的靜態 HTML（mockup 與靜態頁）；
  框架產生的頁面不在這次範圍。
- `skills/fankeel-design/SKILL.md` 的 mockup 步驟之後加「逐塊即時調」：
  mockup 帶 `data-block`，核可前可用 `tune.js` 逐塊調。

## 4. 測試

- `tests/render-cli.test.js`：兩角色 × 兩頁的 `render.json` 產出四組檔案，
  `index.json` 列四格；壞設定非零退出。現在會紅（`--config` 是未知旗標）。
- `tests/tune.test.js`：`POST /__live/request` 後 `wait` 印出同一筆；改到區塊外的
  `done` 還原檔案並回報區塊名；只改區塊內的 `done` 通過；注入後的 HTML
  帶 overlay script 而磁碟上的檔案不變。
- agent 的受控跑一次：一張 mockup 有 `nav`、實作少了 `nav` 的截圖，應回 `fix`
  且表上 `nav` 為 `missing`；一張空白截圖應回 `recapture`。
- 產物列：`index.json` 列出的格數等於磁碟上 `.png` 的數量。

## 5. 文件

- 新增決策紀錄，說明為何推翻 2026-09-23 的「不另開 agent」。
- `docs/90-agent/reference/subagents.md` 與 `skills/fankeel/SKILL.md` 的 agent 清單加上新 agent。
- `TODO.md`：`〔render〕`、`〔design〕` 兩條移除；`〔agents〕` Jev 那條以
  「Jev 是雲端、不吃圖」結案；moondream 本地篩子掛 `## Waiting`。

## 不做的事

- 不引入 browser-use、Playwright 或任何 npm 依賴。
- 不做本地判斷模型（moondream／UI-TARS）；掛 Waiting。
- 不支援框架頁面的逐塊調，不改原始碼來注入。

## 未驗證

- 用有視窗瀏覽器登入後的 profile 目錄，`--headless=new` 是否讀得到同一份
  cookie（Edge 與 Chrome 都未試）。
