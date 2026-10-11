---
status: design-intent
last_verified: 2026-10-12
---

# fankeel 面板：一個 Pane，狀態在上，gate 在下

session f0a58f35-ae39-4954-89d6-e0b9129a4082 的 design。這頁是要做的事，不是現狀。mockup 在 `.fankeel/build/2026-10-11-fankeel-pane/mockup.html`（未進 git），gate 核准的是那一頁。

一句話：`hooks/pane.ts` 在現有的 mod 裡加一個 id 為 `fankeel` 的 Pane，由 `/fankeel-pane` 開關，讀這個 session 的 registry 檔畫出任務狀態，有 gate 在等時在同一個 Pane 頂端畫出 gate 並把答案寫進 answer 檔；mod 沒載入時一切照舊。

它改掉 [gate Pane 設計](2026-10-07-gate-pane-design.md) 的一件事：Pane 的 id 從 `fankeel-gate` 變成共用的 `fankeel`，gate 是它的一個區塊，不是另一個 Pane。那一頁其餘的決定（做法 A、250 ms 輪詢、寫前先 stat、交給終端、多選題逐項一個 Input）原樣沿用。

## 1. 開與關

- `session.start` 以 `$.command.register` 註冊 `fankeel-pane`；`command.run` 開著就 `$.ui.close({ id: 'fankeel' })`，沒開就 `$.ui.open({ id: 'fankeel', title: 'fankeel' })`。使用者自己開的 Pane 任何寬度都落位。
- ~~mod 不在 `session.start` 自己開 Pane：沒被要求的面板佔掉 44 欄。~~ 10-12 改了，見第 6 節。
- pending 檔出現而 Pane 沒開時，mod 自己 `$.ui.open`；回 `isPlaced: false` 就發一則 `$.ui.toast`，說 gate 在等、`/fankeel-pane` 開面板。自己為 gate 開的那一次，在 pending 檔消失時關掉；使用者開的不關，為任務開的（第 6 節）也不關。

## 2. 狀態區塊

- 資料只有一個來源：`.fankeel/sessions/<id>.json`，找法同 `hooks/compact.ts` 的 `findEntry`。build 時改了：`claude plugin validate` 不接受把 `$` 傳進 import 來的函式，所以 `hooks/pane.ts` 有自己的一份，只共用 `parentOf`。
- 區塊與 mockup 的 `data-block` 同名同序：`head`（task 最多兩行、class）、`route`（階段名、圓點、`N of M`）、`memory`（`next`、`notes`）、`touched`（`claims` 的數目與最後三個路徑，從尾端截）、`cost`（`clock` 與 `waited` 算出的每站分鐘）、`neighbours`、`foot`（id 前 8 碼、`guard`）。
- `neighbours` 以 `$.fs.list` 讀同一個 `sessions/` 目錄，列出 `active: true` 而且不是自己的；mod 查不了 pid，所以每一列帶 `updated` 的年齡，不宣稱它活著。與自己的 `claims` 有交集時多一行 clash。
- 沒有 active 的 entry 時只畫 `empty`：沒有任務、`/fankeel` 開一個。
- 列數超過 `e.viewport.rows` 時從下往上丟區塊，順序 `cost`、`touched`、`neighbours`、`memory`；`head`、`route`、`gate`、`foot` 不丟。
- 重畫靠第 3 節的同一個 `$.clock.every`：registry 檔的內容變了才 `update` atom。

## 3. gate 區塊

- pending 檔的找法、answer 檔的路徑、送出前的檢查、寫前先 stat、`交給終端` 寫 `{ "handoff": "terminal" }`，全照 gate Pane 設計第 3 節與第 6 節的決定。build 時改了一處：「已有檔就不寫」只對比這個 gate 的 `at` 更新的 answer 檔成立，否則同一個 stage 的第二個 gate 在 Pane 裡答不了。
- 單選題每個選項一個 `plain` Button，hotkey 1 到 4；`交給終端` 的 hotkey 是 `t`。推薦的選項粗體。
- hotkey 要 Pane 有焦點才有效，所以 gate 區塊底下有一行 dim 的提示說怎麼進面板。

## 4. 寫法

- `hooks/pane.ts`，不用 JSX，直接呼叫全域的 `h`：`tests/` 以 node 的型別剝除 `import()` 載入 hooks 模組，`.tsx` 載不進來，`hooks/hooks.json` 的 `modules` 也就不必改。
- 畫面是純函式：`statusTree(entry, neighbours, rows)` 與 `gateTree(pending)` 回傳樹，`register` 只接線。測試餵 fixture、讀樹裡的字。
- mod 不能 require `lib/`：`dirFor`、pending 的 `until` 檢查、答案的檢查在 `hooks/pane.ts` 再寫一次，由測試釘到 `lib/handoff.js`，做法同 `HARD`。

## 5. 不做的事

- 不做設定鍵、不做分頁、不列 stood-down 的 session、不畫 station 頁已經有的花費曲線。
- 不改 `hooks/gate.js`、不改 station 頁。
- ~~不在 AbovePrompt 另做一份。~~ 10-12 改了，見第 6 節。

## 6. 10-12 改版：輸入框上方的兩行，與重排的 Pane

第 1 到 5 節做完之後，使用者在 Claude Desktop 實測，改了兩件事：隨時要看的資訊移到輸入框上方的 `AbovePrompt`，Pane 只放要查才看的。使用者核准的是畫在真機上的原型，不是 HTML mockup：原型的程式在 `.fankeel/build/task-20261010T203351/pane-prototype.ts.txt`（未進 git），Pane 的內容由 [judgement](../judgements/2026-10-11-pane-content.md) 定。這一節與前面衝突時，以這一節為準。

- `ui.render` 多一個 `{ component: 'AbovePrompt' }` 的 hook：session 有 active 的 entry 時畫兩行，沒有就 `next(e)`，整條不出現。
- 第一行：`▌FANKEEL <STAGE>`、route 長度個圓點（到目前階段為止實心）、`⚿ <guard>`、有別的 active session 的 `claims` 與自己的有交集時 `⚑<n>`、task 標題截尾。
- 第二行：`next` 與最後一則 `next` 內容、`claims` 的數目、`N of M` 與這個階段到現在的分鐘；有 pending 檔時改成黃底的 `gate 在等` 與第一題的問題。
- 顏色是 TokenBar 的 fankeel 色階，以 hex 寫在 `hooks/pane-band.ts`：`survey #5f5f87`、`design #5f5fd7`、`plan #5f87af`、`build #5f87d7`、`verify #5fafff`、`audit #5fd787`、`land #5fd7ff`；空心圓點 `#585858`、guard `#d7af5f`、`⚑` `#ff5f5f`、標題 `#bcbcbc`、次要字 `#8a8a8a`。左邊的色帶與階段同色，有 `⚑` 時是 `#ff0000`。
- Pane 的區塊改成由上到下 `gate`、`context`、`plan`、`notes`、`neighbours`、`touched`、`foot`；`head`、`route`、`memory` 的 `next`、`cost`、`foot` 的 guard 拿掉，因為上面兩行已經有，`cost` 則是 station 頁已經畫了。列數不夠時的丟棄順序是 `touched`、`neighbours`、`notes`、`plan`、`context`；`gate` 與 `foot` 不丟。
- `gate` 區塊畫完整的題目：每個選項的 `description` 折行畫在它的 Button 底下，不因列數不夠而丟掉。第 3 節與 `hooks/pane-gate.ts` 現在的「先丟 description」改掉；gate 比 Pane 高時由 Pane 自己的捲動處理。
- `context` 兩列：`$.session.usage().context.tokens` 與自動 compact 的門檻（`FANKEEL_COMPACT_AT`，沒有就 `HARD`）；數字一律粗體，到門檻時連整列粗體；第二列是 compact 會留下的東西，與 `hooks/compact.ts` 的 `instructionsFor` 同一份清單。
- `plan` 兩列：`claims` 裡的 plan 檔在 `.fankeel/build/<basename>/progress.md` 有 ledger 時，畫完成的 task 數與總數（圓點與 `tasks N of M`），第二列是 plan 的檔名；沒有 ledger 就沒有這個區塊。
- 兩個畫面的資料都來自 `hooks/pane.ts` 同一個 `look`，重畫的比對鍵加上 token 數與 ledger 的內容。
- `/fankeel-pane` 開不了時的訊息不再一律說終端太窄：`$.session.surfaces()` 沒有能放 Pane 的 surface 時，說這裡畫不了面板。
- session 有 active 的 entry 時 mod 自己開 Pane，一個任務只開一次：使用者關掉就不再為同一個任務開，新的 gate 來時才再開。任務結束時關掉 mod 自己開的；使用者開的不關。registry 檔連續 20 個 tick（五秒）讀不懂時算作沒有任務。使用者在真機看過之後要的（10-12）。
- 文件寫明兩件實測到的事：Remote Control 與手機不畫 mod；Claude Desktop 讀的是安裝時的快照，改版後要 `claude plugin update fankeel@fankeel` 才看得到。

## What proves it done

| 證明 | 怎麼看 |
|---|---|
| 狀態區塊讀得出 registry | `tests/pane.test.js`：fixture entry 餵進 `statusTree`，樹裡有 task、`design`、`2 of 7`；現在沒有這個檔，紅 |
| 圓點與 `N of M` 同源 | 同一個測試：實心圓點數等於 N，圓點總數等於 M，兩者都等於 route 長度與 stage 的位置 |
| 樹不超過 viewport | 同一個測試：`rows` 給 18 與 44，樹的列數都不超過，而且 `head`、`route`、`foot` 都在 |
| Pane 寫的 answer 檔與 station 的同形 | 測試以 `lib/handoff.js` 的 `answersSince` 讀 mod 寫出的檔，讀得到同一份答案 |
| mod 只多掛該掛的 | `tests/mod.test.js` 的事件清單改成新的一份，多一個少一個都紅 |
| mod 沒載入時不變 | 不按 Enable 跑一次 gate，照舊由 AskUserQuestion 問 |
| 真機 | 按 Enable、`/fankeel-pane`，Pane 畫出這個任務；答一次 gate；窄終端看到 toast |
| 上方兩行讀得出 registry（10-12） | `tests/pane-band.test.js`：fixture entry 在 `build`、route 七站，第一行有 `FANKEEL BUILD`、四個 `#5f87d7` 的實心圓點與三個空心；現在沒有這個檔，紅 |
| 上方兩行與 Pane 同源（10-12） | 同一個 fixture 畫兩個畫面：上方的 `N of M`、`claims` 數目、`⚑` 的數目，等於 Pane 的 `touched` 數目與 `neighbours` 的 clash 列數 |
| gate 的 description 不丟（10-12） | `tests/pane-gate.test.js`：四個選項各帶 description、Pane 只有 18 列，每一個 description 的字都在樹裡；現在會被丟，紅 |
| 真機（10-12） | 終端與 Claude Desktop 各開一個有任務的 session：上方兩行與 Pane 都畫出同一個階段；答一次 gate |
