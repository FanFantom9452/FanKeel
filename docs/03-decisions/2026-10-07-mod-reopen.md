---
status: decision
last_verified: 2026-10-07
---

# 重開 mod 路線（10-07）：決策紀錄

> **10-12 註記**（這頁是 10-07 的紀錄，下面不改寫；現況見 [fankeel 面板 design 第 6 節](../90-agent/plans/2026-10-11-fankeel-pane-design.md)）：
> - 第 17 行說 Pane 在終端、Desktop、VS Code 與手機上都能開。真機只在 Claude Desktop 看過 Pane 與輸入框上方兩行；Remote Control 與手機畫不出 mod。終端與 VS Code 還沒有真機結果，記在 [pane-1](../90-agent/todo/pane-1.md)。
> - 第 22 行說 `hooks/mod.ts` 只剩 compact，已不對：`hooks/mod.ts:7`（`pane(on, options)`）也掛上了 Pane，上方兩行與 Pane 由 `hooks/pane.ts` 畫。
> - 第 26 與 32 行把第三到五項列為未做。第五項（Pane 上的 gate 介面）已做，見 `hooks/pane.ts` 的 gate 區塊與 `hooks/pane-gate.ts`。第三項（子代理 brief）與第四項（每個子代理的 effort）仍未做，`hooks/` 裡沒有 `agent.spawn` 或 `turn.step`。

一句話：fankeel 重開 mod 路線，mod 只做 command hook 做不到的事，command hook 照舊是底層；前提是使用者接受每個 session 在 `/plugin` 按一次 Enable for this session。這份紀錄取代 [10-03 的 mod 路線擱置](2026-10-03-mod-route.md) 與 [10-05 的函式 hook 與 gate 報告面板](2026-10-05-inject-gate-mod.md)，await-title 隨這份紀錄移除。

設計稿是 [2026-10-07-mod-reopen-design.md](../99-archive/2026-10-07-mod-reopen-design.md)，計畫是 [2026-10-07-mod-reopen.md](../99-archive/2026-10-07-mod-reopen.md)。

## 為什麼

- 10-03 的第一個理由是子代理拿不到 `prompt.compose` 的結果。這一條不再擋路：`agent.spawn` 改寫的 prompt 已量到成為子代理 transcript 的第 1 行（[mod-probe-3](../90-agent/reports/2026-10-03-mod-probe-3.md) 第 14 行，headless，n=1），子代理的 brief 可以走這條路，不必經過 `prompt.compose`。
- 10-03 的第二個理由是 hooks module 由 rollout 旗標決定載入。這一條降為接受的風險：旗標被撤時，下面那條共通規則讓 fankeel 照 command hook 跑。
- 10-03 的第三個理由是要改使用者設定。使用者在 2026-10-07 接受每個 session 在 `/plugin` 按一次 Enable for this session，這不改任何設定檔，所以不再與「裝好後大部分不需要修改 Claude 設定」衝突。
- 10-05 否決終端或 Desktop 的 gate 報告面板，理由是 command hook 畫不了介面；mod 的 Pane 在終端、Desktop、VS Code 與手機上都能開（Claude Code 2.1.292 的型別檔），所以這一條一併取代。

## 定了什麼

- 五項只有 mod 做得到的能力，依這個次序做：
  1. 拆 await-title：已證實不成立，host 拒絕從 `tool.call` hook 呼叫 `command.run`，而 `turn.complete` 要等使用者答完才來（[title-3](../90-agent/todo/title-3.md)）。這個 task 內已做完，`hooks/mod.ts` 只剩 compact。
  2. 自動 compact 與改寫每次 compaction 的指示：`hooks/compact.ts` 已落地，互動式實測壓縮成功；剩下的判準與文字在既有條目 [compact-2](../90-agent/todo/compact-2.md)，不另開。
  3. 子代理完整 brief：由 `agent.spawn` 改寫 prompt 取代 `hooks/brief.js` 的一部分。價值最高，但互動式 n>1 沒量過、`session.append` 對執行中的子代理沒測過，所以第一步是探測（[brief-3](../90-agent/todo/brief-3.md)）。
  4. 每個子代理的 effort：由 `turn.step` 依 agentId 改寫，依賴第三項建立的 agentId 與 Dispatch 行的對應，所以排在它後面（[effort-1](../90-agent/todo/effort-1.md)）。
  5. Pane 上的 gate 介面：範圍最大、與其他項不相依，放最後；動手前先讀 station 頁已有的 gate 面板，避免兩套（[gate-7](../90-agent/todo/gate-7.md)）。
- 共通規則：每個 mod 都要在沒載入時無害。旗標關、沒按 Enable、或 hook 拋錯或逾時被略過時，fankeel 照 command hook 的行為跑，不丟工作。
- 仍維持 10-05 的一條：UserPromptSubmit 注入不改成函式 hook，繼續用 `hooks/inject.js`。

## 沒做的

- 第三到五項只開了條目，沒有實作。
- 重新評估的時機：rollout 旗標被撤、Enable 在手機或 Remote Control 上按不到、或 `agent.spawn` 改寫在互動式 n>1 下不穩定。
