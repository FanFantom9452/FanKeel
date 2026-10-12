---
status: decision
last_verified: 2026-10-12
---

# 壓縮門檻改成 profile 的 `compact.at`（10-12）：init 問四檔，不再寫使用者的設定檔

一句話：`/fankeel-init` 改問壓縮門檻的四個檔位，答案存成 profile 的 `compact.at`，只在跑 fankeel 任務的 session 生效，不再把 `CLAUDE_CODE_AUTO_COMPACT_WINDOW` 寫進使用者的 `settings.json`。

這取代同一天[壓縮視窗由 init 幫忙設](2026-10-12-init-compact-window.md)裡「寫使用者層設定檔」的那一部分；那份決定的其餘部分照舊，也沒有被改動。

## 決定

- init 第 7 步問一題，四個選項：`450000`（預設、建議）、`350000`（保守，較早壓縮、較省 token）、`600000`（寬鬆，留較多內容、較耗 token）、不設（`off`，fankeel 不壓縮，極耗 token）。
- 答案用 `task.js profile set compact.at <值> --default` 存成這台機器的預設。`compact.at` 已經有人選過（來源不是 `builtin`）就不再問。沒有回答就什麼都不寫。
- 門檻只在正在跑 fankeel 任務的 session 生效，由既有的 `hooks/compact.ts` 在主對話的 context 到那個 token 數時壓縮。這台機器上其他的 Claude Code session 完全不受影響。
- init 不再寫使用者的 `settings.json`，也不再執行 `compact-window.js set` 或 `decline`；它只還在執行 `compact-window.js show`，用來告訴使用者這台機器是否已有整機的視窗。

## 為什麼

- 使用者要的是分檔，而且只對 fankeel 任務生效。
- 主機沒有「只對某個任務」的視窗開關；`CLAUDE_CODE_AUTO_COMPACT_WINDOW` 是整台機器的，會套到每個 session。
- 整機的視窗若是 450K，會比 600K 的 `compact.at` 更早觸發，所以兩者不能同時問；問 `compact.at` 才做得到「只管 fankeel 任務」。

## 放棄了什麼

- 不能填自己的數字：`compact.at` 只收這四個值。
- 350000 和 600000 沒有量過。
- `hooks/pane.ts` 顯示的門檻仍然讀 `FANKEEL_COMPACT_AT`，沒有就用 450000，不讀 `compact.at`：那個檔被另一個進行中的任務佔著。
- `scripts/compact-window.js` 的 `set` 和 `decline` 留在 repo 裡，init 不再呼叫它們。
- 已經回答過舊問題的機器，舊問題寫下的東西仍然留在那裡，這個決定不會去清。
