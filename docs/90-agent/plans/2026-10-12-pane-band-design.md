---
status: design-intent
approved: 2026-10-12
last_verified: 2026-10-12
---

# band 只畫流程與數值，Pane 畫細節

session 88d97abd-517b-4278-93fd-55c331259f41 的 design，來自 TODO 條目「Pane 配色與右欄資訊重新規劃」與同一次的 TODO 全表盤點。這頁是要做的事，不是現況。

一句話：輸入框上方的兩列（band）只回答「到哪一站、額度還剩多少」，右側的 Pane 回答「這個任務的細節、此刻要不要出手」；撞檔只算還活著的 session。

使用者核准的是 mockup 的版本 C：`.fankeel/build/2026-10-12-pane-band/mockup.html`（未進 git）。它依據的判決是 [band 與 Pane 該怎麼重新設計](../judgements/2026-10-12-pane-band-redesign.md)，之後使用者又改了四處：`next` 回到 Pane、band 不放句子、context 與額度的長條照 TokenBar 畫、Remote Control 不畫。這四處以本頁為準。

2026-10-12 使用者在真機看過之後又改了一處，依據是[Pane 每列的色軌，與畫了兩次的讀數](../judgements/2026-10-12-pane-rail-dup.md)的 `## Duplicate`：量表（長條、數字、百分比、偏差值、警示符號）全部只在 band；Pane 只畫 band 不畫的東西，也就是重置時間與 compact 的那句話。第 1、2、3 節與檢查表已照它改寫。

## 1. band

- 第 1 列是流程：色軌 `▌`、`FANKEEL <STAGE>` 徽章、route 的圓點（到目前這站為止實心，之後空心）、`tasks N/M`（有 ledger 才畫）、`本站 N 分`、`等你 N 分`。
- gate 在等時，第 1 列在 `tasks N/M` 之後多畫 ` gate 在等 ` 徽章與 `還 N 秒`；題目文字不在 band。
- 第 2 列是三條長條，以 `│` 分隔：`ctx <bar> 212k/450k`、`5h <bar> 66%`、`7d <bar> 58% -6%`；有活著的 session 撞檔時列尾多 `⚑N`。
- band 不再畫任務標題、`next`、`⚿ guard`、`N 檔`、`N of M`。
- 長條 10 格，用八分格字元 `▏▎▍▌▋▊▉█` 畫已用的部分，其餘是 `░`。
- 第 1 列放不下時依序丟 `本站 N 分`、`等你 N 分`、`tasks N/M`；徽章、圓點、gate 徽章與倒數不丟。
- 第 2 列放不下時依序：縮窄 `│` 兩側的空格、三條長條一起縮短（最短 5 格）、丟 7d、丟 5h；`ctx` 與 `⚑N` 不丟。
- band 在任何列寬都不畫 `↻` 重置倒數：重置時間只在 Pane 的用量額度塊，Pane 關著時看不到重置時間，用量本身仍在 band。
- 撞檔時兩列的色軌是紅色，否則是目前這站的顏色。

## 2. 長條的顏色

- 三條長條共用 TokenBar 的一條漸層：xterm 46、83、120、157、194（綠）→ 190、226、220、214、208（變熱）→ 196、198、199、200、201（紅到紫），寫成 hex；標籤、軌道與 `│` 用 240（`#585858`）。
- `ctx` 的百分比是 tokens 除以自動 compact 的門檻，不是模型視窗；顏色用 TokenBar 的 ≤500k 級距：32% 起最淺的綠、40% 起黃、60% 起紅、80% 起紫，80% 起數字後多一個 `⚠`。
- `5h` 的顏色看已用百分比：40% 起最淺的綠、60% 起黃、80% 起紅、95% 起紫並加 `⚠`。
- `7d` 的顏色只看偏差值（已用百分比減去這個視窗已過的比例乘以 100），不看用了多少；偏差 `+7` 起 `⚠`、`+10` 起 `💥`、`+14` 起 `💀` 並轉紫；已用 95% 起一律紫。
- 偏差值由 `resetsAt` 往回推 7 天算出；沒有 `resetsAt` 時不畫偏差值，`7d` 的顏色改看已用百分比。
- 額度的數值來自引擎 `session.measure` 的 `rateLimits`（`kind`、`percentUsed`、`resetsAt`）；陣列是空的時候，band 的 `5h`、`7d` 與 Pane 的用量額度塊都不畫。
- `width()` 把 `⚠` 算一格、`💥` 與 `💀` 算兩格。

## 3. Pane

- 由上到下的塊：task、gate、撞檔、tasks、context、用量額度、session、notes、foot；每一塊左邊一條自己的固定色軌，內文不指定顏色（跟隨終端佈景）。
- task 塊：任務標題折行全寫（粗體），其下 `next:` 全文折行；不再畫 route 與分鐘。
- gate 塊：徽章列多 `還 N 秒`；題目、選項、說明照現在的畫法。
- 撞檔塊：每個與活著的 session 共用的檔兩列——`⚑ <路徑尾>`，其下是對方任務的標題、`@ <stage>` 與多久前更新。
- tasks 塊：標題列 `tasks N of M`；總數 6 個以內全列，否則完成的折成一列 `✓ 完成 N`、接著第一個未完成的任務與之後兩個、最後一列 `還有 N 個`；`inflight` 指到目前這站時，在跑的那一列尾巴寫 `· 出去 N 分`，20 分起琥珀色。
- 沒有 ledger 但 `inflight` 指到目前這站時，tasks 塊退成一列 `agent 出去 N 分 · 第 N 組`。
- context 塊只在 tokens 到門檻的 80% 起才畫，兩列，沒有數字也沒有長條：`context  快要自動 compact 了`，到門檻時改成 `context  已到門檻，compact 中`（琥珀色粗體）；其下 `留 task · stage · plan · agent · handoff`。
- 用量額度塊：標題 `用量額度`，引擎給了 `resetsAt` 的視窗各一列，只寫重置時間——`5h  1h 46m 後重置`、`7d  2d 12h 30m 後重置`，已經過了的寫 `已重置`；沒有 `resetsAt` 的視窗沒有列，兩個都沒有就沒有這一塊；長條、百分比、`剩 N%` 與偏差值只在 band。
- session 塊用中文說明，程式裡的值寫在旁邊：`別的 session 也在改同一個檔時` 一列，其下 `直接擋下，不能改  guard deny`（`ask` 是 `先問你`，`off` 是 `只提醒`）；`這個任務改過的檔` 一列，其下 `N 個  claims`。
- 不畫 Remote Control。
- 列數不夠時依序丟 session、notes、用量額度、tasks 的窗（留標題列）；task、gate、撞檔、context、foot 不丟。

## 4. 撞檔只算活著的 session

- 每次 prompt，`hooks/inject.js` 把這個 registry 裡活著的 session id 寫進 `.fankeel/build/live.json`（`{ at, ids }`），活不活用 `lib/live.js` 現有的判斷。
- mod 讀那個檔：鄰居的 id 不在 `ids` 裡就不算鄰居，band 的 `⚑N` 與 Pane 的撞檔塊都不算它。
- 鄰居的 registry 檔比 `live.json` 的 `at` 還新（它在清單寫下之後才動過）時，不在 `ids` 裡也算活著。
- 檔案不存在、讀不出來、或 `lib/live.js` 回報判斷不出來時，照現在的行為把 active 的鄰居都算進來——寧可多報，不可漏報。

## 5. 盤點帶進來的三筆

- 「引用的 usage 被當成真的」：`lib/context.js` 讀 transcript 尾端時只認 assistant 列的 `message.usage` 與 `compact_boundary` 列，不再取任何一列裡最後一個長得像 usage 的字串。
- 「上限測試沒量到壓縮過的行」：`tests/render.test.js` 那一筆斷言改成真的量到壓縮過的行，`lib/context.js` 的 `DROPPED` 對得上它。
- 「整套跑時 gate 計時測試紅」：`tests/gate.test.js` 的計時斷言不再依賴整套測試並行時的排程，單跑與整套跑都綠。

## 6. 不做的事

- 不動 TokenBar 的 repo，也不讀它寫的檔；額度只從引擎拿。
- 不畫 plan 站與 verify 站的細項進度——registry 沒有那份資料。
- 不改逐塊調整工具（另有兩筆 TODO）。
- 不做 Remote Control 的顯示，等真機探測。

## What proves it done

| 檢查 | 現在 | 之後 |
|---|---|---|
| `tests/pane-band.test.js`：第 1 列是徽章、圓點、`tasks N/M` 與分鐘，沒有任務標題與 guard | 紅 | 綠 |
| `tests/pane-band.test.js`：第 2 列是 `ctx`、`5h`、`7d` 三條長條，`rateLimits` 是空的時候只剩 `ctx` | 紅 | 綠 |
| `tests/pane-band.test.js`：80、70、50 格寬時兩列都不超寬，丟棄順序如第 1 節 | 紅 | 綠 |
| `tests/pane-status.test.js`：task 塊有 `next:` 全文、沒有 route；session 塊是中文說明 | 紅 | 綠 |
| `tests/pane-status.test.js`：30 個任務時 tasks 塊不超過 7 列 | 紅 | 綠 |
| `tests/pane.test.js`：id 不在 `live.json` 的 active 鄰居不算撞檔；沒有 `live.json` 時照舊算 | 紅 | 綠 |
| 成品自己對得上：同一組輸入下，band 的 `⚑N` 等於 Pane 撞檔塊列出的 session 數；`ctx` 的數字只在 band，Pane 的 context 塊不重畫任何數字 | 沒有這個檢查 | 綠 |
| 使用者在 Claude Desktop 真機看一次 band 與 Pane | 沒看過 | 看過 |
