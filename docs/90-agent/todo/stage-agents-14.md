---
label: stage-agents
title: 死 agent 的 inflight 標記
description: 停掉的 agent 的標記到 await.js 判 lost 才清（晚了約 11 分鐘）；group 標記只在 await.js 回報交接檔時清，別條路徑到的就留著
state: done
link: hooks/gate.js
done:
  at: 2026-10-05
  sha: df42ef45
  disposition: done
  session: 7dd8cae1-9f94-407e-bc69-ca3f51c93296
---

來源：2026-10-04 stage-agents-4 的實跑看到兩次。第一次：視窗 B（session c5f050e3-5f12-481a-a465-68725c68f38f）的 survey agent ac92bbf3bbe0c911d 被 SendMessage 續用後標記以同一 agentId、lap 仍是 1 回來，使用者停掉該 agent；標記留到 B 的 await.js 判 lost 才清（scripts/await.js:187），約在 agent 的 transcript 停筆後 11 分鐘，而 idle 預設是 180 秒（scripts/await.js:43），為什麼拖那麼久不知道（見 docs/90-agent/reports/2026-10-04-controlled-stages.md 的「第二個 agent」）。第二次：session 106c6f2b 的 build 第 2、3 組同時跑，第 1、3、4、5 組的標記都清了，第 2 組的標記（group 2、agentId a9422f42efcdab69d、kind group）還在記錄裡，雖然 build-g2.md 已落地、agent 已收尾；原因是 group 標記只由 await.js 回報該組交接檔時清（scripts/await.js:184-187），這個 session 沒有任何一次 await.js 回報第 2 組的交接檔，第 2、3 組都在外面時那次回的是第 3 組的 commit 請求，第 2 組的報告路徑只以 agent 的回報訊息到主控，那不清任何東西。第三次（同一 session，同日稍晚）：prompt 為 `build close` 的 brain（a1519545e15492a97）派出後，主控區塊寫「A build stage agent is already running for group 3」，但 build close 不屬於任何 ledger group，第 3 組那時早已提交收尾；標記的 group 是怎麼算出 3 的，沒查。lib/stages.js 的 marksOf 旁的設計註解說死 agent 留下的標記只有 SendMessage 才會發現。要決定：停掉的 agent 該不該不等 await.js 的 idle 就清（例如加 SubagentStop hook，plugin.json 目前沒有），以及 11 分鐘的延遲從哪來；交接檔以任何路徑到達（不只 await.js 的結果）是否都該清 group 標記。本條不修東西。完成條件：上述決定寫進 docs/90-agent/reference/subagents.md，標記該清沒清的情形有修法與測試，或寫明為什麼留著。

## 完成紀錄

交接檔已經落地的 build 組，現在會清掉自己的執行中標記，不再擋住主控。收尾用的 close 標記不再寫出一個不存在的組號。停掉的 agent 為什麼拖到 await 判 lost 才清標記，這個決定寫進 subagents 頁，並說明為什麼留著。兩種情形各有測試守著。

- commit bd92357d
- commit df42ef45
- commit e77c9481
