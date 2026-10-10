---
status: design-intent
last_verified: 2026-10-11
---

# fankeel 面板：一個 Pane，狀態在上，gate 在下

session f0a58f35-ae39-4954-89d6-e0b9129a4082 的 design。這頁是要做的事，不是現狀。mockup 在 `.fankeel/build/2026-10-11-fankeel-pane/mockup.html`（未進 git），gate 核准的是那一頁。

一句話：`hooks/pane.ts` 在現有的 mod 裡加一個 id 為 `fankeel` 的 Pane，由 `/fankeel-pane` 開關，讀這個 session 的 registry 檔畫出任務狀態，有 gate 在等時在同一個 Pane 頂端畫出 gate 並把答案寫進 answer 檔；mod 沒載入時一切照舊。

它改掉 [gate Pane 設計](2026-10-07-gate-pane-design.md) 的一件事：Pane 的 id 從 `fankeel-gate` 變成共用的 `fankeel`，gate 是它的一個區塊，不是另一個 Pane。那一頁其餘的決定（做法 A、250 ms 輪詢、寫前先 stat、交給終端、多選題逐項一個 Input）原樣沿用。

## 1. 開與關

- `session.start` 以 `$.command.register` 註冊 `fankeel-pane`；`command.run` 開著就 `$.ui.close({ id: 'fankeel' })`，沒開就 `$.ui.open({ id: 'fankeel', title: 'fankeel' })`。使用者自己開的 Pane 任何寬度都落位。
- mod 不在 `session.start` 自己開 Pane：沒被要求的面板佔掉 44 欄。
- pending 檔出現而 Pane 沒開時，mod 自己 `$.ui.open`；回 `isPlaced: false` 就發一則 `$.ui.toast`，說 gate 在等、`/fankeel-pane` 開面板。自己開的那一次，在 pending 檔消失時關掉；使用者開的不關。

## 2. 狀態區塊

- 資料只有一個來源：`.fankeel/sessions/<id>.json`，找法用 `hooks/compact.ts` 的 `findEntry`（改成 export，不再寫一份）。
- 區塊與 mockup 的 `data-block` 同名同序：`head`（task 最多兩行、class）、`route`（階段名、圓點、`N of M`）、`memory`（`next`、`notes`）、`touched`（`claims` 的數目與最後三個路徑，從尾端截）、`cost`（`clock` 與 `waited` 算出的每站分鐘）、`neighbours`、`foot`（id 前 8 碼、`guard`）。
- `neighbours` 以 `$.fs.list` 讀同一個 `sessions/` 目錄，列出 `active: true` 而且不是自己的；mod 查不了 pid，所以每一列帶 `updated` 的年齡，不宣稱它活著。與自己的 `claims` 有交集時多一行 clash。
- 沒有 active 的 entry 時只畫 `empty`：沒有任務、`/fankeel` 開一個。
- 列數超過 `e.viewport.rows` 時從下往上丟區塊，順序 `cost`、`touched`、`neighbours`、`memory`；`head`、`route`、`gate`、`foot` 不丟。
- 重畫靠第 3 節的同一個 `$.clock.every`：registry 檔的內容變了才 `update` atom。

## 3. gate 區塊

- pending 檔的找法、answer 檔的路徑、送出前的檢查、寫前先 stat、`交給終端` 寫 `{ "handoff": "terminal" }`，全照 gate Pane 設計第 3 節與第 6 節的決定。
- 單選題每個選項一個 `plain` Button，hotkey 1 到 4；`交給終端` 的 hotkey 是 `t`。推薦的選項粗體。
- hotkey 要 Pane 有焦點才有效，所以 gate 區塊底下有一行 dim 的提示說怎麼進面板。

## 4. 寫法

- `hooks/pane.ts`，不用 JSX，直接呼叫全域的 `h`：`tests/` 以 node 的型別剝除 `import()` 載入 hooks 模組，`.tsx` 載不進來，`hooks/hooks.json` 的 `modules` 也就不必改。
- 畫面是純函式：`statusTree(entry, neighbours, rows)` 與 `gateTree(pending)` 回傳樹，`register` 只接線。測試餵 fixture、讀樹裡的字。
- mod 不能 require `lib/`：`dirFor`、pending 的 `until` 檢查、答案的檢查在 `hooks/pane.ts` 再寫一次，由測試釘到 `lib/handoff.js`，做法同 `HARD`。

## 5. 不做的事

- 不做設定鍵、不做分頁、不列 stood-down 的 session、不畫 station 頁已經有的花費曲線。
- 不改 `hooks/gate.js`、不改 station 頁。
- 不在 AbovePrompt 另做一份。

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
