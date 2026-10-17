---
label: brief
title: spawn 紀錄的先後
description: 新 session 載入 835fffb7 的 mod 後，看 brain 的 SubagentStart 跑時 spawn 紀錄在不在
state: done
done:
  at: 2026-10-17
  sha: 1ca28b3c
  disposition: done
  session: 645460d7-d1cc-49a8-ae5e-e3579296bd98
---

10-17 verify 想驗 mod 的 agent.spawn 紀錄是不是在 SubagentStart 之前寫好，但那個 session 的 mod 早於 835fffb7 載入，派出一個 reader 前後都沒有 .fankeel/build/spawn 目錄，所以沒驗到。做法：release 之後開新 session，派一個 fankeel-brain，比對紀錄的 at 與 registry inflight 的 at，或看 brief.js 有沒有判成巢狀。紀錄晚到也不算失敗，brief.js 照舊退回 transcript 與 meta；照實記下哪一種。

## 完成紀錄

10-17 新 session 派 brain 實測：SubagentStart hook 約 15:02:20.011 起跑、135ms；spawn 紀錄 at 20.028，inflight.at 20.116；續跑那圈紀錄也早 inflight 90ms。inflight 是讀完紀錄後才寫，退回路線也判非巢狀，所以只證明極可能早到，靠約 17ms 的競速，非保證。確證要等一個真巢狀 brain 讓 hook 讀到非空 parentAgentId。

- commit 835fffb7
- commit 1ca28b3c
