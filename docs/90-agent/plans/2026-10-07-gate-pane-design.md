---
status: planned
approved: 2026-10-09
last_verified: 2026-10-07
---

# Pane 上的 gate 介面：與 station 頁的 gate 面板怎麼分工

> 2026-10-11：[fankeel 面板的設計](2026-10-11-fankeel-pane-design.md) 改掉這頁兩件事——Pane 的 id 是共用的 `fankeel`，gate 是它的一個區塊，不是 `fankeel-gate`；多題與多選的 gate 先不畫 Input，Pane 只顯示並提供「交給終端」。其餘決定照這頁。

session 2b986530-5d60-4247-8515-3b847b277508 的 design 草稿，來自 TODO 全表盤點（10-07）的 plan；依 [重開 mod 路線](../../03-decisions/2026-10-07-mod-reopen.md) 第五項。這頁是要做的事，不是現狀；核准之後另開 task 實作。

一句話：gate 只有一份——hooks/gate.js 寫的 pending 檔與 answer 檔；station 頁的面板與 Pane 都只是它的兩個畫面，誰先寫進 answer 檔誰算數，mod 沒載入時一切照舊走 AskUserQuestion。

## 1. 現況：station 頁已經能回答 gate

`docs/90-agent/reference/station.md:1147` 那一節說了五件事：

1. `gate.station` 設成秒數時，`hooks/gate.js` 把每個放行的問題先扣住那麼久，終端才看得到（`stationAnswers`，`hooks/gate.js:126`）。
2. 扣住期間它寫 `<stage>-pending.json`（內容是 `{ questions, at, until }`，`hooks/gate.js:135`），每 200 ms 讀一次同目錄的 `<stage>-answer.md`（`POLL_MS`，`hooks/gate.js:120`），不論怎麼結束都刪掉 pending 檔（`hooks/gate.js:144`）。兩個路徑都由 `fileFor` 算出（`pendingPath`，`lib/handoff.js:97`；`answerPath`，`lib/handoff.js:72`），落在 `.fankeel/build/task-<started>/`。
3. 浮動圖示的面板顯示扣住的 gate：單一個單選題是一排按鈕，鍵 1 到 4 也能按；其他情形是整份表單，每題多一個「其他」框，每題都有答案才能送出。
4. 按鈕或送出打 `POST /answer`：檢查 nonce、這個 session 有沒有扣住的 gate（409）、每個答案都對到問過的題、每題都有答案（400），再把 `{ "answers": { … } }` 寫進 answer 檔（`docs/90-agent/reference/station.md:1163`）。hook 只收比等待起點新的檔（`answersSince`，`lib/handoff.js:115`）。
5. 「交給終端／手機」寫 `{ "handoff": "terminal" }`，hook 立刻停止等待（`handedOffSince`，`lib/handoff.js:164`），問題照常到終端（`docs/90-agent/reference/station.md:1170`）。

## 2. Pane 能做什麼

型別檔是本機的 `.claude-plugin/types/claude-code/index.d.ts`（未進 git，行號以 2026-10-07 那一份為準）。

- 開：`$.ui.open(pane: PaneOpenArgs)`（`index.d.ts:2398`）。`PaneOpenArgs`（`index.d.ts:7058`）有 `id`（1 到 64 個字母、數字、`_`、`-`；同 id 只有一個，再開只換標題，`index.d.ts:7065`）、`title`（`index.d.ts:7073`）、`focus`（只是請求，composer 有字時不給，`index.d.ts:7082`），另有 `closeOnEscape`、`holdToasts`、`rows`、`columns`。plugin 自己開、不是回應使用者輸入的 pane，在終端窄於 144 欄時不畫，回 `{ isPlaced: false, reason }`（`index.d.ts:7052-7056`）。
- 關與列：`$.ui.close({ id })`（`index.d.ts:2412`），沒開的 id 不理；`$.ui.panes()` 列出本 plugin 開著的 pane，模組重載後也找得到（`index.d.ts:2425`）。
- 位置：render props 的 `Pane.placement` 是 `dock`（全螢幕 transcript 旁，終端 110 欄起）或 `inline`（prompt 上方），唯讀（`index.d.ts:9796`）。`Pane` 在每個介面都會顯示（Raised on every surface，`index.d.ts:9768`）；`AbovePrompt` 只在終端與 Desktop（`index.d.ts:9711`）。
- Button：`hotkey` 是一個數字或一個小寫字母，在 pane 拿到焦點時按下它（`index.d.ts:1018`）；按下時 plugin 收到 `onPress(e: UiPressArgument)`（`index.d.ts:1091`）。
- Input：Enter 時呼叫 `onSubmit(value: string, e: UiInputArgument)`，在 plugin 自己的環境裡跑，除非它要求，否則不起模型回合（`index.d.ts:5324`）；每次改字呼叫 `onInput`（`index.d.ts:5319`）。
- 讀寫檔（第 1 步 (a) 的答案）：能讀也能寫。`hooks/compact.ts` 用 `$.session.root()` 往上找 `.fankeel/sessions/<id>.json`，以 `$.fs.exists` 與 `$.fs.read` 讀它（`hooks/compact.ts:47-52`）；型別檔另有 `$.fs.write(path, text)`，會建出缺少的目錄（`index.d.ts:3147`），與 `$.fs.list`（`index.d.ts:3161`）。所以 mod 能直接寫 answer 檔，第 3 節取做法 A。

## 3. 分工

做法 A（mod 能寫檔時）：mod 在 pending 檔出現時以 `$.ui.open` 開一個 id 為 `fankeel-gate` 的 Pane，單選題畫成 Button（hotkey 1 到 4），其他題畫成 Input；送出時照 POST /answer 的同一套檢查，把 `{ "answers": { … } }` 寫進同一個 answer 檔，hooks/gate.js 不必知道答案從哪來；pending 檔消失時 `$.ui.close`。

細節：

- 找檔：mod 照 `hooks/compact.ts` 的找法讀 registry，從 `started` 算出 task 目錄（`dirFor`，`lib/handoff.js:13`），在目錄裡找 `<stage>-pending.json`。answer 檔路徑直接由 pending 檔名把 `-pending.json` 換成 `-answer.md` 得到：`stationAnswers` 呼叫 `pendingPath` 與 `answerPath` 時都不帶 lap（`hooks/gate.js:129-130`），兩者的 lap 一定相同，mod 不必重算 `lapOf`。
- 檢查：與 `POST /answer` 同一套——pending 檔還在且 `until` 未過（同 `readPending`，`lib/handoff.js:104`）、每個答案對到問過的題、每題都有答案；不過就不寫。mod 不能 require `lib/`（`hooks/compact.ts:6`），這幾條要在 mod 裡再寫一次，由測試釘到 `lib/handoff.js` 與 station 的檢查上，做法同 `HARD`。
- 交給終端：Pane 也放一個「交給終端／手機」Button，寫 `{ "handoff": "terminal" }`，與 station 頁同一個效果。

不選的做法——做法 B（mod 不能寫檔時）：mod 用 `$.http.fetch`（`index.d.ts:3388`）打 station 的 `POST /answer`。不選，因為 (a) 的答案是能寫；而且這條路要求 station 正在跑，還要拿到 station 頁的 nonce，mod 從哪裡合法取得那個 nonce 說不清。

## 4. mod 沒載入時

gate 照舊：gate.station 有設就等 station 頁，沒設或逾時就由 AskUserQuestion 在終端問。這一點不因 Pane 而變。

## 5. 不做的事

- 不做第二份 gate 狀態；pending 與 answer 檔是唯一的真相。
- 不改 station 頁的面板。
- 不在 AbovePrompt 另做一份（只在終端與 Desktop）。

## 6. 待決問題

- mod 怎麼知道 pending 檔出現了：hooks/gate.js 等待時是同步迴圈（`hooks/gate.js:125`），mod 能不能在那段時間用 `$.clock.every`（`index.d.ts:3362`）輪詢、輪詢間隔多少，要實測。 決定（2026-10-09）：`$.clock.every` 每 250 ms 輪詢 pending 檔；實作時實測能否在 gate.js 的同步等待期間觸發。
- 自己開的 Pane 在終端窄於 144 欄時不畫（`index.d.ts:7052-7056`）：這時是否改用 `$.ui.toast` 提示，或乾脆不開，待定。 決定（2026-10-09）：Pane 不畫時發一則 `$.ui.toast` 說 gate 在等，gate 照舊由 AskUserQuestion 或 station 頁回答。
- 兩邊在同一個 200 ms 輪詢間隔內都寫了 answer 檔，後寫的蓋掉先寫的，hook 讀到的是後者；要不要讓 mod 寫前先比對 answer 檔的 mtime，待定。 決定（2026-10-09）：mod 寫 answer 檔前先 stat，已有檔或 pending 已消失就不寫並關 Pane。
- 多選題與「其他」框在 Input 裡怎麼表達（逗號分隔或逐項一個 Input），要使用者定。 決定（2026-10-09）：逐項一個 Input，輸入 y 算選；「其他」是最後一個自由文字 Input。
- Pane 在手機與 VS Code 上的實際樣子與 hotkey 是否可用，型別檔只說會顯示，要實測。 決定（2026-10-09）：實作時在手機與 VS Code 各答一次 gate，結果與 hotkey 可用性寫進 What proves it done；不可用就落到 toast 路線。

## What proves it done

| 證明 | 怎麼看 |
|---|---|
| Pane 回答的 gate 與 station 頁回答的 gate 寫出同一種 answer 檔 | 兩邊各答一次，比對兩個 answer 檔的 JSON 形狀 |
| mod 沒載入時 gate 行為不變 | 不按 Enable 跑一次受控 stage，gate 照舊由 AskUserQuestion 問 |
| 一邊答了，另一邊收起 | 在 station 頁答，Pane 在 pending 檔消失後關閉 |
