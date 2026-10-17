---
label: brief
title: spawn 紀錄的先後
description: 新 session 載入 835fffb7 的 mod 後，看 brain 的 SubagentStart 跑時 spawn 紀錄在不在
state: ready
---

10-17 verify 想驗 mod 的 agent.spawn 紀錄是不是在 SubagentStart 之前寫好，但那個 session 的 mod 早於 835fffb7 載入，派出一個 reader 前後都沒有 .fankeel/build/spawn 目錄，所以沒驗到。做法：release 之後開新 session，派一個 fankeel-brain，比對紀錄的 at 與 registry inflight 的 at，或看 brief.js 有沒有判成巢狀。紀錄晚到也不算失敗，brief.js 照舊退回 transcript 與 meta；照實記下哪一種。
