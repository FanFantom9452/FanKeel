---
status: current
---

# station 三層：30 天直方圖、專案頁、session 時間線

`architectural` 任務，需求在 2026-09-14 的對話裡確認。核心問題永遠是：一個任務花了多少時間、
多少 token、換算多少錢，花在流程的哪一段。mockup 在
`.fankeel/build/2026-09-14-station-three-levels/mockup.html`，不 commit，外觀一起重做。

## 為什麼

- 花費只在 SessionEnd 寫一次，依 stage 的時鐘窗切（`hooks/leave.js:87`、`hooks/leave.js:40`），
  沒有按日；session 的 `day` 是開始日（`lib/detail.js:476`）。
- 總覽的 `flow()` 按開始日切的是 burn 不是錢（`assets/station/station.js:283`）；專案篩選一次只能
  選一個 registry 根（`assets/station/station.js:141`）。
- session 詳情有 stage 比例條（`assets/station/station.js:813`）、context 圖
  （`assets/station/station.js:1014`）、派工列（`assets/station/station.js:1135`），但沒有真的時間軸；
  每次等待的長度資料在（`lib/replay.js:114` 的 `askedAt` 與 `t`）卻沒畫；input 與 output 分開定價
  （`lib/prices.js:14`），畫面只顯示合計（`assets/station/station.js:1121`）。
- 使用者設定沒有 `cleanupPeriodDays`，最舊的 transcript 是 2026-08-15，也就是 transcript 活 30 天；
  而快取版本一升就丟（`lib/detail.js:512`），transcript 不在時整個 session 消失（`lib/detail.js:517`）。
- 按日切做得到：2026-09-14 這個 session 的 13 個 agent 檔共 475 筆有 `usage` 的 request，475 筆都帶 `timestamp`。

## 1. 按日彙總

- `extract()` 多出 `days`：每列是一組 `day`、`stage`、`model`、`who`，`who` 是 `main`、`agent` 或 `workflow`，帶五種 token（`input`、`output`、`cacheRead`、`cacheWrite5m`、`cacheWrite1h`）與這五種各自的 USD。
- 每一筆 request 依自己的 `timestamp` 歸到產頁那台機器的本地日期；跨午夜的 session 分到兩天。
- 一筆 request 的 `stage` 是 `seq` 裡時間不晚於它的最後一步（`stageSequence()`，`lib/detail.js:157`）；`seq` 先取 transcript 裡的 `task.js stage` 指令，沒有才用 `moves` 或 `clock`，所以沒有 `clock` 的 session 也分得出 stage。早於第一步的 request 記為 `null`。
- 一個 session 所有 `days` 列的 USD 加總，等於同一次 `extract()` 算出的 `usd`（`lib/detail.js:481`）。
- `extract()` 多出 `spans`：每列是 `day`、`stage`、`who` 與毫秒數，`who` 是 `main`、`wait`、`agent` 或 `workflow`；`main` 是 `seq` 相鄰兩步之間的時間減掉等待後按日切，最後一步算到最後一筆 request；`wait` 是 `waits` 按日切；`agent` 與 `workflow` 是 launch 到 return 按日切。
- `extract()` 多出 `waits`：每一次 gate 的提問時間、回答時間與當時的 stage，不受 `events` 列數上限影響。
- `VERSION` 升到 2。版本不符的快取，transcript 還在就重讀；transcript 已不在就照舊回傳，頁面把沒有 `days` 的舊快取整筆 `usd` 算在它的 `day`、stage 為 `null`。
- `serialize()` 把每個 session 的 `days`、`spans` 帶進 `station-data.js`，首頁與專案頁不載入 detail 檔。
- 專案的 key 是 registry 根加上 session 的 `project`；沒有 `project` 的 session 歸在它的 registry 根。
- 三層的花費一律從 `days` 加總，不用 SessionEnd 寫進 registry 的 `usage`，所以進行中的 session 也算得到。

## 2. 首頁：30 天直方圖

- 最近 30 個本地日各一根長條，今天在最右，只讀 `days` 與 `spans`。
- 高度可切換 token、花費、時間；分段可切換依 model、依專案、依 stage、主 session 對 agent。時間沒有 model 可分，時間配依 model 這一組停用並寫出原因。
- 時間是 `spans` 裡 `main`、`agent`、`workflow` 的毫秒和：agent 與主 session 同時在跑時各算各的，量的是工作量而不是牆鐘；`wait` 不算進時間，等待佔比是 `wait` 除以 `main` 加 `wait`。
- 每根長條的總數等於它各分段的和。
- KPI 四格：30 天花費、token、active 時間、等待佔比，各自對前 30 天的差；前期沒資料時沿用 `delta()` 的「前期無資料」。
- 點一根長條打開某日花費：當天總數、依專案、model、stage、主 session 對 agent 的拆分，以及當天有花費的 session 與各自當天花了多少；總數與那根長條相同。
- 專案清單列出每個專案的 30 天花費、session 數、最後活動，點進專案頁；近期 sessions 表留在首頁，點進 session 頁。
- 直方圖取代 `flow()` 與 `weekBars()`；`gauge()` 併入等待佔比那格；`routeLedger()` 移到專案頁。

## 3. 專案頁

- 標頭是名稱、路徑、30 天花費、token、active 時間。
- 主圖的 x 是 30 天的時間，每個 session 在它的開始時間一個點，y 可切換 token 或花費，依時間連線，點進 session 頁。
- 「對照專案」選另一個專案，在同一組軸上多畫一條線、共用 y 軸；TODO 的「兩個專案並排」就是這個。
- sessions 表列出 task、開始、時長、stage 進度、花費、token、model 組成；勾兩列進現有的 `cmpPage()`。
- 頁尾是只算這個專案的 `routeLedger()`。

## 4. Session 頁

- 四個分頁：時間線（預設）、花費、派工、事件；現有的 context 圖、tasks 與上升清單收在時間線分頁下方。
- 時間線是真的時間軸，從 `seq` 的第一步開始到最後一筆 request；stage 段的寬度等於實際經過的時間，`waits` 的每一次等待畫成斜線空窗並標出時長。
- 每個 agent 與 workflow 各一條 bar，從 launch 到 return，標出做了什麼、model、token、花費；workflow 可展開成它的 agents。
- 主 session 的每筆 request 在時間軸上一個刻度，依 model 上色；context 折線疊在同一條軸上，agent 回傳進主 context 的位置標出字元數。
- 花費分頁是 stage × model 的表，`input`、`output`、`cacheRead`、`cacheWrite` 各自的 token 與 USD，主 session 與 agent 各一個小計；總數等於這個 session 所有 `days` 列的 USD 和。
- 派工分頁在現有 `dispatchHtml()` 的每列多出 input 與 output 的 token 與 USD。
- 事件分頁是現有的 `replayHtml()`，gate 那列多出等待時長。

## 5. 外觀、路由、文件

- `assets/station/index.html` 與 `station.css` 依核准的 mockup 重做；`side`、`q`、`gen`、`nreg`、`cfg`、`page` 六個 id 留作掛載點（`tests/station-shell.test.js:51`）。
- 三層用 `location.hash` 路由：`#/`、`#/p/<key>`、`#/s/<id>`、`#/d/<day>`；從 `file://` 開也能上一頁。
- 頁面照舊不載入任何外部資源（`docs/decisions/2026-09-04-session-station-design.md:120`）。
- `docs/station.md` 描述總覽的那段改寫成三層，serve「只在清除時」那句改成與 `scripts/station.js:13` 一致。
- `TODO.md` 的〔station〕總覽改版那條刪掉。

## 不做

- effort 與 fast mode：transcript 讀不到紀錄，這次不顯示。
- 依資料自動調 model 或 effort：之後拿這份資料做，不在這次。
- 掃描方式不改：`discover()` 讀記住的清單，深度 8 的 `scanRoots()` 只在第一次或 `--scan` 時跑（`lib/station.js:131`）。

## 檔案

| file | change | dispatch |
|---|---|---|
| `lib/usage.js` | 主 session 與 agent 檔的每筆 request 保留 `timestamp`、`model` 與五種 token | implementer, sonnet |
| `lib/detail.js` | `days`、`spans`、`waits`、每種 token 的 USD；`VERSION` 2；transcript 不在時保留舊快取 | implementer, sonnet |
| `lib/station.js` | `serialize()` 帶 `days`、`spans`，專案 key | implementer, sonnet |
| `assets/station/index.html`、`assets/station/station.css` | 依 mockup 重做 | implementer, sonnet |
| `assets/station/station.js` | hash 路由、首頁、專案頁、session 四分頁 | implementer, sonnet |
| `tests/detail.test.js`、`tests/detail-cache.test.js`、`tests/station-view.test.js`、`tests/station-shell.test.js` | 下表每一列 | implementer, sonnet，隨各自的任務 |
| `docs/station.md`、`TODO.md` | 三層的描述、serve 那句、刪 TODO 條目 | implementer, sonnet |

## What proves it done

| test | 怎麼證明 |
|---|---|
| 跨午夜分日 | fixture：一個 session 跨午夜，主 session 加一個 agent、兩個 model；`days` 分到兩天，USD 加總等於 `usd`。現在沒有 `days`，紅 |
| stage 歸屬 | fixture 沒有 `clock`、transcript 有兩次 `task.js stage`；兩段的 request 各歸各的 stage，第一步之前的記 `null`；把歸屬改成永遠取第一步，紅 |
| 等待空窗 | fixture 兩次 gate；`waits` 兩列，長度等於回答減提問 |
| 舊快取不丟 | v1 快取、transcript 刪掉，`detailOf` 仍回傳它；拿掉保留那一行，紅 |
| 專案 key | 同一 registry 兩個 `project` 的 session 分成兩個專案 |
| 頁面對帳 | 從產出的 `station-data.js` 與頁面的純函式：某天長條總數 = 某日花費總數 = 當天各 session 花費和；session 花費分頁總數 = 該 session `days` 的 USD 和 |
| 全套 | `node --test` 顯示 `ℹ fail 0` |
| 文件 | `node scripts/docs-check.js` 與 `node scripts/todo-check.js` exit 0 |

## 未驗證

- transcript 活 30 天是從最舊檔的日期推的，沒有查 Claude Code 的文件。
- 214 個 session 裡只有 107 個有 `clock`（2026-09-14 量）；另外 107 個靠 transcript 的 `task.js stage` 指令分 stage，其中多少真的有指令，還沒量。
