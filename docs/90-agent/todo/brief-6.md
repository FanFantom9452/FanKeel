---
label: brief
title: brief.js 哪段搬到 spawn
description: 互動式 n=3 探測成立後，決定子代理 brief 的哪一部分改由 agent.spawn 改寫 prompt 與 session.append 送進子代理 — [hooks/brief.js](hooks/brief.js).
state: done
link: hooks/brief.js
done:
  at: 2026-10-17
  sha: 1ca28b3c
  disposition: done
  session: 398cc390-8239-42f0-8311-1f7f73c7bb88
---

來源：2026-10-17 TODO 全表盤點實測「子代理 brief 改走 spawn」。互動式 session 帶 mod 啟動後，同一個回應派出的三個子代理，transcript 第 1 行都是 agent.spawn 改寫後的 prompt；對執行中的子代理呼叫 session.append，那一列寫進它的 transcript，它的下一則回應接在那一列後面。兩條路都成立，所以現在要決定的是搬什麼：hooks/brief.js 目前在 SubagentStart 交出的 brief，哪一部分改成 agent.spawn 直接寫進 prompt，哪一部分在子代理跑到一半時用 session.append 補，哪一部分留在 command hook。共通規則照 2026-10-07 mod 重開決策：mod 沒載入時 hooks/brief.js 照舊運作。完成條件：一份 design 寫出搬移的範圍、mod 沒載入時的退路與一個會紅的測試，使用者核准後轉成 ready。

## 完成紀錄（2026-10-17）

使用者選了「brief 搬最小一步」：brief 本身留在 hooks/brief.js，因為 brain brief 要用 profile、stages、handoff 這些 lib/ 模組，mod 引擎 require 不到 lib/。835fffb7 讓 hooks/mod.ts 在 agent.spawn 拿到 agentId 後，把 prompt 第一行（最多 200 字元）、subagentType、parentAgentId 寫進 .fankeel/build/spawn/<agentId>.json。1ca28b3c 讓 hooks/brief.js 的 promptOfAgent 與 nestedBrain 先讀這個檔，讀不到才照舊讀 transcript 與 meta；mod 沒載入時沒有這個檔，行為與之前一樣。tests/brief.test.js 的新測試在沒有 transcript、也沒有 meta 時靠這個檔判成巢狀；把讀檔那段拿掉測試就會紅。真機上這個檔在 SubagentStart 跑的時候是不是已經寫好，這次沒驗到，另開 brief-7。
