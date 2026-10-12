---
label: pane
title: Pane 列出沒在跑的 session
description: Pane 與輸入框上方那一行只看 active 為 true，不查 session 是否還活著，幾週前沒收尾的任務被列成鄰居，還算成共用檔案
state: ready
link: hooks/pane.ts
---

來源：使用者 2026-10-12 在 SBIR 工作區的 Claude Desktop session 24c05bd3 看到 Pane 的「其他 session」列出 22、12、39、30 天前的四個 session，底下一列紅色的共用 Trovara/perf/README.md，輸入框上方也有旗號 1；他問這裡明明只有一個 session 在跑，為什麼會觸發共用。查到的：hooks/pane.ts:171 的鄰居只判斷 isActive(other)，hooks/compact.ts 的 isActive 只看 active 是不是 true，hooks/pane-status.ts:172-175 的共用是 claims 的交集，hooks/pane-band.ts:37-38 的旗號數同樣不篩，hooks 底下沒有任何 pane 檔查 liveness。command hook 這一側（lib/live.js:90-141、lib/guard.js:129-130、hooks/inject.js:228）會先用 isLive 過濾，所以注入塊不列那四筆，兩邊不一致。資料：F:/ymlab/SBIR/ProjectWorkspace/.fankeel/sessions 有 122 筆、active 為 true 的 5 筆，e0e4ea99（land，30 天前）的 claims 含那個檔；C:/Users/user/.claude/sessions 只有三個 pid 檔，沒有那四個 id。要變成：Pane 與上方那一行用跟 lib/live.js 同一條規則決定誰是鄰居（mod 不能 require lib，要在 hooks 的 ts 裡讀 configDir 的 sessions 目錄，讀不到時照 command hook 的規則視為活），沒在跑的不列、不算共用。那四筆舊 entry 沒收尾是另一件事，/fankeel 的 Clear out 可以處理。完成條件：有測試釘住沒在跑的 active entry 不出現在鄰居區塊與旗號數；mod 能不能知道一個 pid 還活著先查引擎型別檔，不能就把做法寫回這裡改成待決定；真機在 SBIR 工作區看一次。
