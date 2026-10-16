---
status: design-intent
---

# TODO 全表盤點（10-16 晚）：拿掉 turn.running、子代理樹的 token 與排序 — Design

這次盤點做三件事。一件是 Ready 條目「拿掉沒人畫的 turn.running」，另外兩件是使用者在 survey 時加的 Pane 子代理樹改動。三件都改 `hooks/pane.ts` 或子代理樹，所以留在同一個任務。需要 Desktop 真機的 Ready 條目這次不動；「0.111.4 mod 載入」使用者已在 Desktop 看到，land 站以 `todo.js done` 關閉。

路線是 patrol 的 `survey,plan,build,verify,land`，沒有 design 站，所以這份 design 由 plan 站寫，在 plan 的關卡一起核准。

## 1. 拿掉沒人畫的 turn.running

10-16 路線圓點不再呼吸以後，`turn.running` 只剩 Pane 重畫 key 在讀，沒有東西拿它來畫。

- 刪掉 `hooks/turn.ts`。
- `hooks/pane.ts`：拿掉 `import { turn }`、重畫 key 裡的 `turn.running`、`on('turn.start')` 那支 hook 和它的註解。
- `hooks/compact.ts`：拿掉 `import { turn }` 和 `turn.complete` 裡清旗標、重畫的那個 `if` 區塊，其餘的壓縮邏輯不動；註解改成只說引擎不允許第二支沒有 matcher 的 `turn.complete`。
- 測試：`tests/mod.test.js` 的 hook 清單少一個 `turn.start`；`tests/pane.test.js` 的 `wired()` 不再重設旗標，刪掉兩條只測旗標的測試，hook 測試只測 `turn.complete`，band 那條不再呼叫 `turn.start`；`tests/compact.test.js` 刪掉清旗標那一條。

## 2. 子代理樹：跑著的排前面

使用者原話：「派出去的 AGENT 還沒完成的要往上排 優先顯示」。

- 排序已經把跑著的放在跑完的前面，但只看節點自己。改成看「自己或底下任何一個還在跑」：一個已經結束的 brain，只要底下還有 reader 在跑，就和跑著的排在一起。
- 同一類裡面仍然是新的在前。
- 裁切不變：最上層 6 個、每個底下 3 個。因為跑著的排在前面，被收成「還有 N 個」的會先是跑完的。

## 3. 子代理樹：每個 agent 的 token

使用者原話：「消耗時間之外也顯示消耗 TOKEN 量」。口徑在 plan 站定了：input、cache 寫入、output 相加，不含 cache 讀取。本 session 的 survey agent 量出來是 input 78、cache 寫入 78,526、output 814，合計 79,418；Claude Code 通知寫 78,834，對得上。只算 input 加 output 的話是 892。

- 數字來源：`<subagents>/agent-<id>.jsonl` 每一則 `type: "assistant"` 的 `message.usage`。同一個 `requestId` 會寫好幾行，所以照 `lib/usage.js` 的做法：每個 `requestId` 只算一次，以最後一行為準；沒有 `requestId` 的行各算一次。
- `hooks/pane-agents.ts` 新增純函式 `agentTokens(text)`，回傳合計，沒有任何 usage 時回 `null`；另一個 `tokenLabel(n)` 把數字寫成 `892`、`79.4k`、`1.7M`。
- `AgentFile` 與 `AgentNode` 多一個 `tokens: number | null`。
- `hooks/pane.ts` 的 `agentsOf` 在 jsonl 有列出時讀它、算出 token，並以 `mtimeMs:size` 快取，檔案沒動就不重讀；沒有 jsonl 時是 `null`。
- `hooks/pane-status.ts` 每一列在分鐘之後接 ` · 79.4k`；`tokens` 是 `null` 時不畫這一段，不畫成 0。

## 4. tasks 超過十個改畫長條

使用者在 verify 站說：「TASK 3 OF 3 這種設計，超過 10 個就改為長條顯示吧，不然遇到大任務很佔據版面」。所以退回 build 加做。

- Desktop 的 `tasksSvg`（`hooks/pane-svg.ts`）：`GRID_MAX` 從 30 改成 10。九個以內仍是一列 30px 的格子，十個是一列十個 24px 的格子，十一個起畫四段的長條（完成、在跑、你的、還沒做）。
- 終端的 `tasksBlock` 不動：它在六個以內全列，更多本來就折成幾列。

## 5. Pane 拿掉 context 區塊

使用者在 build 站說：「PANE 的 CONTEXT 也刪除吧，因為 BAND 已經有 CONTEXT 顯示了」。

- 終端的 `contextBlock` 與 Desktop 的 `contextSvg` 都拿掉，`statusRows` 與 `paneParts` 不再有 `context` 這一塊，`DROP` 的註解也不再提它。
- 只為它而存在的東西一起拿掉：`SAID`、`KEPT`，以及 `hooks/pane-status.ts` 只為它 import 的 `HARD`、`nearCompact`。band 的 `ctx` 長條與 ⚠（`hooks/pane-bar.ts` 的 `nearCompact`、`ctxPaint`）不動。
- `hooks/pane.ts` 照樣讀 context，因為 band 要用；Pane 那一側若因此不再讀 `context`，就不再傳。

## What proves it done

| test | how |
|---|---|
| turn.running 沒了 | `grep -rn "turn.running\|turn.ts" hooks tests` 沒有輸出；`tests/mod.test.js` 的清單是 `command.run`、`session.start`、`turn.complete`、兩個 `ui.render`。 |
| 跑著的排前面 | `tests/pane-agents.test.js`：一個已結束、底下有跑著的子節點的根，排在一個比它新但整棵都結束的根前面。 |
| token 合計 | `tests/pane-agents.test.js`：同一個 `requestId` 兩行只算最後一行，沒有 `requestId` 的行各算一次，cache 讀取不算，沒有 usage 時回 `null`；`tokenLabel` 寫出 `892`、`79.4k`、`1.7M`。 |
| token 畫出來 | `tests/pane-status.test.js` 的子代理樹那條，根那一列是 ` ○ survey stage agent · opus 5.5 · high · 10 分 · 79.4k`，沒有 token 的子節點沒有那一段；`tests/pane.test.js`：jsonl 在時 Pane 那一列有 token 的字樣，沒有 jsonl 的那一列沒有。 |
| 十一個起畫長條 | `tests/pane-svg.test.js`：十個 task 是十個 24px 的格子，十一個是四段長條（`['在跑 1', '還沒做 10']`）。 |
| Pane 沒有 context 區塊 | `grep -rn "contextBlock\|contextSvg\|SAID\|KEPT" hooks tests` 沒有輸出；`tests/pane-status.test.js`：tokens 超過門檻時 `statusRows` 也沒有 `block === 'context'` 的列；band 的 `ctx` 測試照舊全綠。 |

## Files

| file | change |
|---|---|
| `hooks/turn.ts` | 刪除 |
| `hooks/pane.ts` | 拿掉 turn 旗標與 `turn.start`；`agentsOf` 讀 jsonl |
| `hooks/compact.ts` | 拿掉清旗標的區塊 |
| `tests/pane.test.js` | turn 測試刪改；token 那一列 |
| `tests/mod.test.js` | hook 清單 |
| `tests/compact.test.js` | 刪清旗標那條 |
| `hooks/pane-agents.ts` | 排序看整棵；`agentTokens`、`tokenLabel`、`tokens` 欄位 |
| `tests/pane-agents.test.js` | 排序與 token 測試 |
| `hooks/pane-status.ts` | 列尾接 token |
| `tests/pane-status.test.js` | 子代理樹那條加 token；context 區塊的測試拿掉 |
| `hooks/pane-svg.ts` | `GRID_MAX` 10；拿掉 `contextSvg` |
| `tests/pane-svg.test.js` | 長條門檻的測試；context 圖的測試拿掉 |
| `docs/01-guide/profile.md` | tasks 的門檻、Pane 沒有 context 區塊 |

## Unverified

- 互動式 session 的子代理 jsonl 會不會落地：10-03 的探測只看到 meta，這個 session 看到的有落地。沒有的時候這一段不畫，不會錯，但真機上要看一次才知道 Desktop 下有沒有數字。
- jsonl 跑著的時候每個請求都在長，`mtimeMs:size` 一動就整檔重讀；一個 agent 的檔通常在 1 MB 以下，沒有量過最大的會多大。
