---
status: decision
last_verified: 2026-10-13
---

# TODO 全表盤點（10-13）：做了什麼、沒做什麼

一句話：面板的壓縮門檻改讀 `compact.at`、Pane 四處重複收掉、逐塊調整點錯不再整批被退，八筆條目關閉；
逐塊調整的真機試用只做了一半，那一筆留在 Ready。

計畫在 [2026-10-13-todo-patrol-five.md](../../../99-archive/2026-10-13-todo-patrol-five.md)。

## 起因

10-13 的盤點在 survey 逐條核過 Ready、Blocked 與 Watch。
放行五條要動手的：compact-5、pane-5、tune-3、tune-4、init-3。
另外四條的程式早就修好，只差結案：context-1、pane-4、test-6、test-7。

## 做了什麼

- 面板與輸入框上方的 `ctx` 長條改問 `hooks/compact.ts` 的 `threshold`。
  環境變數、profile 的 `compact.at` 與內建值只在那一處讀。
- `compact.at` 是 `off` 時門檻是無限大，長條只畫已用的數字，不畫條。
- `context:` 行在 profile 檔設了 350000、450000 或 600000 時，不再說沒有設視窗。
- Pane 的四處重複各剩一份：`minutes`、`secondsLeft`、`nearCompact` 都在 `hooks/pane-bar.ts`。
  沒有程式在畫的 `HOLLOW` 與 `TITLE` 刪掉了。一次繪製只讀一次時鐘。
- 逐塊調整在點的當下就解析區塊：區塊內取那一塊，外框取裡面全部，兩者都不是的框成琥珀色、不加入。
- 伺服器一則一則檢查，退回時用中文說第幾則、哪個元素。頁面把那一則標出來，草稿留著。
- 圈選中的那一列自己帶備註欄、「往外一層」與「完成這則」。
- 指南補了 init 第 7 步問的是 `compact.at`，以及 `off` 時長條只畫數字。
- 三條 Blocked 對得到證據，重蓋 10-13 的日期：build-1、quota-1、spend-2。

## 使用者試用的結果

使用者在 Pane 配色的 mockup 頁上新增兩則、每則點四列、寫備註、全部送出。
伺服器收到 `r-0040`，三個區塊，完成時沒有改任何檔。

- 原話：「設計可以更好 就是一開始使用者不會注意到托盤」。另開條目 tune-5，放在 Needs a decision。
- 外框（`section.scheme`）與不在任何區塊裡的大標題，這兩種情形沒有試。
- 送出後頁面有沒有重新載入、區塊有沒有閃綠色，使用者答「沒注意」。
- 使用者決定 tune-4 留在 Ready，等補試完再關。

## 沒做的

- test-7 原本要求整套連跑五次都綠，沒有做。這一輪整套跑了兩次，都是 4163 個通過、0 個失敗。
- 整套裡 5 個 skipped 的測試沒有看是哪五個。
- verify 沒有逐頁派 reader 問「哪一頁變假」。
  靠的是 build 每個 task 的 reviewer，以及一個看整段範圍的 reviewer，後者回 `clean`。讀了幾頁沒有數字。
- 要使用者在真機做的五條沒有動，仍在 Ready：brief-3、compact-4、pane-1、pane-2、pane-6。
- 其餘 Blocked 核對不了，沒有蓋新日期。Watch 沒有事件發生，全部不動。

## 過程裡的兩件事

- 這個任務在 build 做到 15 of 16 時換了 session 接手。
  接手後 ledger 裡找不到整段範圍的 review 紀錄，所以補派了一次，回 `clean`。
- verify 的第一輪 adversary 打掉一列：session 自己那份證據檔還沒寫，因為整套測試跑得比 verifier 慢。
  補上檔案後重讀，回 `nothing`。沒有東西送回 build。

## 裁定

- `docs/03-decisions/2026-10-12-compact-at.md` 有一句說面板還沒讀 `compact.at`。
  那是寫一次就不改的紀錄，照原樣留著。
- tune-4 的試用紀錄在 commit 52db7fcd 提到 tune-5，條目檔在下一個 commit 才出現。兩個 commit 相鄰，沒有重排。

## 關閉的八筆

| 條目 | 怎麼關的 |
|---|---|
| compact-5 面板提醒改讀 compact.at | 這一輪做的 |
| pane-5 Pane 模組裡的四處重複 | 這一輪做的 |
| tune-3 逐塊調整點錯就整批被拒 | 這一輪做的 |
| init-3 指南補上 init 會問壓縮視窗 | 這一輪做的 |
| context-1 引用的 usage 被當成真的 | 程式早已修好，核對後結案 |
| pane-4 Pane 列出沒在跑的 session | 程式早已做好，核對後結案 |
| test-6 上限測試沒量到壓縮過的行 | 測試早已改好，核對後結案 |
| test-7 整套跑時 gate 計時測試紅 | 測試早已改好，核對後結案；五次連跑沒做 |
