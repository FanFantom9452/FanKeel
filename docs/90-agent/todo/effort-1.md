---
label: effort
title: 每個子代理的 effort
description: 依 2026-10-07 mod 重開決策的第四項：以 turn.step 依 agentId 改寫每個子代理的 effort，取代 implementer-high 與 -xhigh 的 agent 檔複本
state: done
link: hooks/mod.ts
group: 子代理 brief 改走 mod
timing: after: brief-3 的探測成立，agentId 與 Dispatch 行對得上
stamp: 2026-10-15
done:
  at: 2026-10-15
  sha: 927044a5bb5738c463fd3d703ac9f0d53c303e93
  disposition: done
---

來源：docs/03-decisions/2026-10-07-mod-reopen.md 的第四項。已知：turn.step 的輸入帶 agentId，model 與 effort 每次請求都可改寫，d.ts 沒有 fast 或 speed 欄位；10-03 第三輪量到改的 effort 真的送進請求。依賴：要先有 brief-3 建立的 agentId 與 Dispatch 行的對應。第一步：brief-3 成立後，寫一個 turn.step hook 依對應改 effort，量一次請求本文。完成條件：成立就決定 fankeel-implementer-high 等複本是否退役；不成立就關閉本條。共通規則：mod 沒載入時照 agent 檔的 effort 跑。

## 完成紀錄

派工時傳 effort 就會蓋過 agent 檔的設定（10-15 探針：帶 high 的派工記到 effortValue high，沒帶的是 medium）。六個 effort 複本與產生它們的腳本已刪，不必靠 mod 的 turn.step 改寫。

- commit a39793bcc9638110ac677fc6dab10ffe3f1fe9be
- commit 26fd985947584daa75cdcfb012e281a2b21032e5
- commit cc76d8d3a43b5fa3f8bac89e926b9b404ba7b6d7
- commit 927044a5bb5738c463fd3d703ac9f0d53c303e93
