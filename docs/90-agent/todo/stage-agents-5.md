---
label: stage-agents
title: 接縫「profile 中途翻轉」
description: 接縫「profile 中途翻轉」：受控站跑到一半在站頁套 preset，看下一次 inject、brief、gate、resume、guard 各做了什麼 — [docs/subagents.md](docs/90-agent/reference/subagents.md).
state: ready
link: docs/90-agent/reference/subagents.md
---

來源：db16197d（2026-09-24）把 subagents.md 的六個接縫各拆成一條 TODO.md bullet，這條由 657dcec5（2026-09-21）那行「受控 build／verify 還有十來個接縫沒實跑過」拆出，當時 stage.agents 受控站從沒在 profile 改動下實跑過。

要做成：在受控站跑到一半，從站頁套一個 preset，記下下一次 inject、brief、gate、resume、guard 各讀到新舊哪一份 profile，把結果寫進 subagents.md「The profile moves under a running stage」一節。

完成條件：跑過一次 stage.agents=all 的真實 task 並在中途翻轉 profile，五個 hook 的實際行為寫進 subagents.md，這條 TODO 才關。

2026-10-04 跑過一次：resume 與 guard 有了答案，inject、brief、gate 還要一次把在跑的站移出 `stage.agents` 的翻轉才分得出來；當時這條維持 blocked。

2026-10-15 盤點：`after:` 的條件在 09-28 與 10-04 已經滿足，使用者選改標 ready。剩下的是一次受控翻轉：受控站跑到一半，由使用者在站頁套一個把在跑的站移出 `stage.agents` 的 preset，看 inject、brief、gate 各讀到哪一份 profile。

## 探測步驟（2026-10-16 盤點寫成）

10-04 那次的翻轉保留了 survey，所以 inject、brief、gate 分不出新舊；這次要把在跑的站整個移出 `stage.agents`。每個 hook 每次呼叫都重讀 profile（`lib/profile.js:374` 是 `function profileFor(root, mine) {`），session 紀錄則在 `task.js start` 時抄下一份 `stage.agents`，比對兩者就知道讀的是哪一份。

1. 開一個用完即丟的 task，先 `node scripts/task.js profile set stage.agents all`，讓 brain 跑一個不是 survey 的站（例如 `--route "design,land"` 的 design）。記下 `.fankeel/profile.json` 與 session 紀錄裡的 `stage.agents`。
2. brain 還在跑時，打開站頁 `#/settings`，到 context 步驟點「不在意，全部自己跑」（`stage.agents=false`），在確認步驟送出（`assets/station/station.js:2014` 是 `{ id: 'agents', t: 'context'`；寫入專案的 .fankeel/profile.json）。
3. 逐項看新舊：
   - inject：下一個 prompt 的區塊還有沒有 `You are the controller for <stage>`。有是舊，沒有、換成一般站規則是新。
   - brief：SendMessage 給 brain，讓它重新觸發 SubagentStart；brief 開頭是 `you are the stage agent for` 是舊，`you are a subagent of` 是新。
   - gate：brain 交回後問 gate；出現 the gate in <handoff> cannot be asked 的拒絕（`hooks/gate.js:276` 是 `permissionDecisionReason: 'fankeel: the gate in '`）或照常驗過是舊，出現 gate not confirmed 的訊息（`hooks/gate.js:258` 是 `'fankeel: gate not confirmed — '`）是新。
   - resume：回答後 `.fankeel/build/<task>/<stage>-answer.md` 有寫出是舊，沒寫是新。
   - guard：controller 自己 Edit 一個檔，被擋下 is a controlled stage（`hooks/guard.js:159` 是 `is a controlled stage — its stage`）是舊，放行是新；再派一次 `fankeel:fankeel-brain`，被擋下 is not on stage.agents（`hooks/guard.js:186` 是 `permissionDecisionReason: 'fankeel: `）是新。
4. `node scripts/task.js profile set stage.agents survey` 還原，把五項結果寫進 `docs/90-agent/reference/subagents.md` 的「The profile moves under a running stage」一節，然後關閉本條。
