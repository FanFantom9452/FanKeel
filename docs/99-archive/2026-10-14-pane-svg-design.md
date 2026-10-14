---
status: current
approved: 2026-10-14
last_verified: 2026-10-14
---

# Desktop 用 Svg 畫 band 與 Pane，終端維持文字

session 71205e7c-7fd5-4e57-ab63-2b27c40bcaec 的 design。這頁寫的是要做的事，不是現況。

一句話：新增一個純函式模組，把 `statusRows` 和 `bandRows` 已經算好的同一份資料畫成 `<svg>` 字串；`hooks/pane.ts` 的兩個 `ui.render` 依 `e.surface` 分流：`desktop` 畫引擎的 `Svg` 元素，其餘照舊畫 `Box` 和 `Text`。

使用者核准的是 mockup `.fankeel/build/2026-10-14-pane-svg/mockup.html`（未進 git，由同目錄的 `gen.mjs` 產生），包括 tuning 請求 r-0041 改過的三塊。哪裡和本頁不一致，以 mockup 為準。10-13 的配色決定（[Pane 配色](../../03-decisions/2026-10-13-pane-colour.md)）照用：標題和色條都用灰 `#8a8a8a`，顏色只用在狀態上。

## 1. 分流

- `ui.render` 在 `e.surface === 'desktop'` 時，從 `$.ui.resolve(e)` 取 `Svg`。其他 surface 的輸出和現在逐位元相同。
- 每張 Svg 的 `alt` 是同一塊文字版的內容，由同一份 rows 產生。
- Svg 裡的文字一律灰 `#8a8a8a`。顏色只給圖形：站色、gate、撞檔、⚠。
- 不加 `isInteractive` 的 Svg，Desktop 會當成圖片畫。只有 tasks 那塊用 `isInteractive`，因為要靠 `<title>` 顯示每個 task 的名稱。

## 2. band（data-block band-row1、band-row2）

- 第 1 列的 route 每一點都用自己那一站的顏色（`stageColor(route[i])`）。走完的站是實心，目前這站是實心加一圈，還沒到的站是空心。狀態靠形狀表達，不靠顏色。
- `tasks N/M` 畫成分段的小格，數字放在旁邊。
- gate 在等時畫倒數環，環的意思是：題目在監控站網頁上還可以作答的秒數，也就是 `gate.station` 的那段等待。畫環需要總秒數，所以 `BandInput` 除了 `gateUntil`，還要多帶 gate 開始的時間（pending 檔裡的 `at`）。
- 第 2 列的 ctx、5h、7d 畫成量表，用灰槽 `#585858` 和 TokenBar 的配色。ctx 在 compact 點畫一條灰線，7d 在平均進度的位置畫一個刻度。
- `⚑N` 照現在的位置，放在第 2 列最後。

## 3. Pane（data-block pane-route、pane-clash、pane-tasks、pane-context）

- 任務標題和 `next:` 維持文字。下面是站點時間軸：每一站下方畫一條長條代表它花的分鐘數（來自 entry 的 `clock`），gate 等待的時間用黃色接在長條末端（來自 `waited`）。
- 撞檔畫成小關係圖：左邊是共用的檔案，右邊是其他 session，中間用紅線連起來；每個 session 標出它的站色、站名和幾分鐘前動過。
- tasks 依數量分三種畫法：9 個以下排一排格子；10 到 30 個每排 10 格；超過 30 個收成一條分段進度條（完成／在跑／你的／還沒做），下面寫出正在跑的 task，以及最多三個你的 task 的名稱。
- context 量表以 `compact.at` 為刻度：80% 的位置畫黃線，compact 點畫灰線。
- context 到門檻後顯示的文字依 profile 變化：`compact.at` 是數字時寫「已到門檻，這輪回完自動 compact」；是 `off` 時寫「已到門檻，自動 compact 已關閉」，並提示可以手動 `/compact`。
- `compact.at` 為 `off` 時 context 塊照樣畫，刻度用內建的 450000，compact 點畫成虛線。這是新行為：現在 `threshold()` 回傳 Infinity，整塊不畫。終端文字版（`hooks/pane-status.ts` 的 context 那幾列）也要改成同一句。
- notes 和 foot 維持文字。

## 4. 帶進來的六筆 TODO

- 「面板真機沒看完的四件事」和「Pane 新配色真機沒看過」：build 完成後在 Desktop 真機看新版 Svg。兩筆的完成紀錄寫看到了什麼。
- 「Pane 顯示遠端控制狀態」：使用者在真機上跑 `FANKEEL_PANE_PROBE=1`，看 Remote Control 開和關時有沒有差別。分得出來就加一行狀態；分不出來，條目改成 Blocked。
- 「子代理 brief 改走 spawn」、「Desktop 真機看壓縮視窗」、「實測安裝版 mod 啟動就載入」：都要使用者自己在真機上操作，與畫面無關。plan 把它們標成 `**Dispatch:** user`，由使用者決定做或跳過。

## 5. 不做的事

- 終端的 `Raster` 和 `Image`：終端維持文字。
- compact 改成在 stage 結束時才壓縮：沒有在這次的設計範圍內。
- band 的高度維持兩列。

## What proves it done

- `tests/pane-svg.test.js`：surface 是 desktop 時，band 和 Pane 的樹裡有 `Svg` 元素，`source` 不超過 131072 字元，`alt` 等於同一份資料畫出的文字版。這個測試現在會失敗。
- 圖和字要對得上：從同一份資料畫出的 Svg 裡讀出數字（tasks 的 `4/9`、context 的 tokens），要和文字版的數字一致。
- 終端那條路的現有 Pane 測試，期望值一個都不改，照樣全過。
- route 圓點：短路線 `survey,plan,build,verify,land` 的第 2 點顏色是 `RAMP.plan`，不是 `RAMP.design`。
- `compact.at` 為 `off` 時，desktop 和終端都畫出「自動 compact 已關閉」。
