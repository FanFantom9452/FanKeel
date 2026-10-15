---
status: design-intent
approved: 2026-10-16
last_verified: 2026-10-16
---

# task.js stage 換站時印出新一站的規則

session d2a48637-e6c1-48cd-a27b-eeca86bc04e9 的 design。這頁是要做的事，不是現況。

一句話：`task.js stage <name>` 換站成功後，用 inject 同一個 `rulesLines` 印出新一站的 stage rules 與 output shape，最後一行叫 session 在同一回合開工。

## 為什麼

`cmdStage`（`scripts/task.js` 結尾，`effortHint` 之後）只印換站行與 effort 建議；只有 `stage.agents` 管轄的站才印 `controllerLines`。一般站的規則要等下一個 prompt（`hooks/inject.js`）或下一次 AskUserQuestion 回答（`hooks/resume.js`）才注入。gate 核准、跑完 `task.js stage` 之後畫面上沒有任何東西推 session 往下做，它就收回合。2026-10-16 的 TODO 盤點在 design→plan 實際停過一次。

## 1. 換站印出規則

- `lib/render.js` 匯出 `rulesLines`；它現有三個呼叫者（`render`、`renderResume`、`renderBrief`）行為不變。
- `cmdStage` 在新一站不歸 `stage.agents` 管時，印 `rulesLines(data, { values }, { root, sessionId: id })` 的全部行：facts 行、`<plugin> =` 行、`stage rules:`、`output shape:`——與 inject 注入的是同一份文字，不另寫一份。
- 新一站歸 `stage.agents` 管時，維持現在的 `controllerLines`（`Now <stage>, through its stage agent…`），不再另印 `rulesLines`，免得 controller 規則出現兩次；`tests/task-control.test.js` 斷言的那行標頭不變。
- 兩種情況最後都加一行：`進到這一站後在同一回合開工，不要先收回合。`
- `build` 的 hands 清單、`land` 的 todo 收尾行照舊接在後面。

## 2. 測試

- 新測試：建一個 route 含 plan 的任務，`task.js stage plan` 的 stdout 含 `rulesFor('plan')` 的第一條規則、`output shape:` 與 `templateFor('plan')` 的第一行，以及同回合開工那一行。改動前紅，改動後綠。
- 整套 `npm test`（`FANKEEL_BROWSER` 指向 chrome.exe 完整路徑）綠。

## 不做

- `start` 與 `task`（改名）仍印 `FIRST_STEP`；它們的問題（開站沒規則）不在這次範圍。
- stdout 長度不設上限：`BLOCK_CAP` 只管注入的區塊。

## 對照地圖

- `skills/fankeel/SKILL.md` 的「Each stage's rules are injected on every prompt … and again each time an AskUserQuestion of yours is answered」在改動後少說了一處；audit 站補上 `task.js stage` 也印。
