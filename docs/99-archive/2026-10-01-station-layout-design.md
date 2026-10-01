---
status: current
last_verified: 2026-10-01
---

# STATION 版面重排：總覽、session 頁、live、專案頁 TODO（承接 promo v5）

session 71988848-cff4-4f3d-99cb-f9626dfbddac 的 design。survey 的 gate 使用者選「進 design，重排各頁版面」。
這頁描述要做成的樣子，不是現在的樣子。

色盤、mast、檔案樹 nav、卡片外觀已在 keel 層（`assets/station/station.css:1646` 起，
見 `docs/90-agent/plans/2026-10-01-todo-sweep-design.md` 第 4 節）；這次只動版面與密度。
mockup：`.fankeel/build/2026-10-01-station-layout/mockup.html`（gitignored，只在主 checkout；
design 時開在 http://127.0.0.1:7862/.fankeel/build/2026-10-01-station-layout/mockup.html），gate 核可的是那一頁。
新的 CSS 一律掛在 `:root[data-style=keel]` 底下；經典樣式依第 5 節拿掉（使用者在 mockup 調整 r-0035 決定），keel 是唯一的樣式。現有功能除了經典樣式切換，一項不減。

## 1. 專案頁的 TODO 面板（使用者點名：todo-done 捲動太長）

- `todoPanelHtml`（`assets/station/station.js:2362`）的 `NEWEST` 由 10 改為 3：收起時 `todo-done` 只是一條摘要列加最新 3 筆。
- 摘要列：已完成總數、每個完成日一根小條（依 `at` 分組計數）、依 `disposition` 的計數，右邊是既有的「展開全部（N）」鈕。
- 展開後摘要列留在頂端，鈕改「收起，只留最新 3 筆」，欄頭與第 4 筆前的虛線 cut 照舊。
- 整個 TODO 面板移到專案頁標頭正下方，在圖表、map.md 說明與 session 表之前。
- `docs/90-agent/reference/station.md:979` 的「newest ten」隨改動更新。

## 2. 總覽（`#/`）

- 新增頁首 `data-block="dash-head"`：標題、一條細線、一行 mono 狀態列（live session 數、等你的 gate 數、今天花費、Ready 數），「調整卡片」鈕留在右側。
- `dashboard` 改兩欄（7fr / 5fr）：寬欄放 `dash-live`、`dash-recent`、`dash-spend`，窄欄放 `waiting-card`、`dash-todo`；`dashPage`（`station.js:2825`）加兩個 `.dcol` 包層，卡片選擇器的順序在各欄內生效。
- `dash-live` 與 `waiting-card` 拿掉大數字，改為卡頭的計數 pill；`dash-spend` 的數字與長條並排成一條。

## 3. Sessions 列表與單一 session

- 新增頁首 `sessions-head`：標題與狀態列；`subtabs` 移入頁首右側，畫成片中的分頁條。
- 列表每列一行，過長的 task 以「…」截斷、全文放 `title`；stage 用 24px glyph 加「0N / 0M stage」。
- 單一 session 的標頭命名為 `session-head`：64px glyph 依 route 填滿、「0N / 0M stage」在標題上方、meta chips、全寬 rail、七個讀數一條等寬列。
- 分頁列命名為 `session-tabs`，作用中的分頁為 keel 色加上緣線；`cost-share`、`filter-bar` 與時間軸版面不變。

## 4. Live（`#/live`）

- 新增頁首 `live-head`：「正在跑 N · 可能已經停了 N · gate 狀態」，`subtabs` 在右。
- `now` 的各組直接放在紙面上，不再包一層 panel；`live-gate` 空狀態為一條白色橫條。
- `live-run` 每個 session 一張浮起的卡：40px glyph、stage 計數、project chip、15px 粗體 task、rail；`live-subagents` 為卡內淺灰框，model 欄加寬（修掉「Sonnet 5.5 · medium」壓到說明的重疊）。
- `live-maybe` 的各 lane 共用一張卡（`liveMaybe`，`station.js:1581`，加 `div.lv-card` 包層），每 lane 一列；keel 下該列隱藏 rail 與 root 路徑。
- `float-icon`、`gate-countdown`、`live-idle` 不變。

## 5. 外觀：只留 keel，主題鈕放進 mast（mockup 調整 r-0034、r-0035）

使用者：「這兩個請你放在相同位置吧 設計部分」（r-0034），再來「不要經典樣式了 我們就用這個就好」（r-0035）。
r-0035 刪的是整個區塊，`lib/tune.js:55` 的 `outside()` 會退回；使用者在 gate 選「先手動把經典樣式從 mockup 刪掉」，於是繞過 `tune.js done` 直接改檔，mockup 五個畫面的 mast 都只剩主題鈕。

- 主題鈕（`button.themebtn[data-themecycle]`，今天在 nav 底的 `div.navfoot`，`station.js:1451`）移到 mast，包在 `<div class="appear" role="group" aria-label="外觀">`；`div.navfoot` 拿掉。
- `station.js:4546` 的點擊委派今天只聽 `#nav [data-themecycle]`，改成不限 `#nav`，主題鈕移出 nav 後仍能切換。
- 經典樣式拿掉：`assets/station/index.html:14` 的 `#styletog`（`data-block="style-classic"`）與 `:6` 讀 `station.style` 的 inline script 刪除，`<html data-style="keel">` 固定；`station.js` 的 `#styletog` 點擊處理（:2850 起）、`styleSync`（:5093 起）、`applyChrome` 的 `set('styletog', …)`（:5084）與 `mast.styleTitle`／`mast.styleClassic` 字串一併刪除。
- 只為經典樣式存在的部分刪除：`.c-only` 元素（`station.js:2692` 的 `routeDots` 副本）與 `station.css` 中 `:root:not([data-style=keel])` 的規則；不掛 keel 的基礎規則是 keel 覆寫的底層，保留不動。
- `docs/90-agent/reference/station.md:688-690`（`station.style` 與 `style-classic`）與 `tests/station-keel.test.js`、`tests/station-keel-live.test.js` 中測切換的部分隨改動更新或刪除。

## 6. 驗收

- `tests/station-todo-panel.test.js:49` 改為：done 超過 3 筆、未展開時只渲染 3 個 done `td-row` 加展開鈕，摘要列的 disposition 計數總和等於 `t.done.length`——改動前失敗（今天渲染 10 筆、沒有摘要列），改動後通過。
- 新測試：`dashPage` 的輸出含 `dash-head`，其 Ready 數等於同一份 `S.projects[].todos` 中 `state==='ready'` 的條數，且等於 `dash-todo` 各列 Ready 數之和。
- 新測試：mast 裡的 `.appear` 含 `[data-themecycle]`，nav 裡沒有 `[data-themecycle]`；在 mast 的主題鈕上派 click 會切換 `data-theme`——改動前失敗（鈕在 nav、監聽限 `#nav`）。
- 新測試：`index.html` 不含 `styletog` 與 `station.style`；`localStorage` 存了 `station.style=classic` 時載入頁面，`<html>` 仍是 `data-style="keel"`——改動前失敗（inline script 會拿掉 `data-style`）。
- 渲染出的頁：mockup 上每個 `data-block` 在實頁上仍各出現一次。
- 全套 `node --test` 綠。
