---
label: stage-agents
title: 接縫「profile 中途翻轉」
description: 接縫「profile 中途翻轉」：受控站跑到一半在站頁套 preset，看下一次 inject、brief、gate、resume、guard 各做了什麼 — [docs/subagents.md](docs/90-agent/reference/subagents.md).
state: blocked
link: docs/90-agent/reference/subagents.md
group: 受控 build/verify 實跑
timing: after: 跑過一次 stage.agents=all 的真實 task（main 含 08c4ecf、安裝版 0.80.0 兩半 09-28 已達成）
stamp: 2026-10-05
---

來源：db16197d（2026-09-24）把 subagents.md 的六個接縫各拆成一條 TODO.md bullet，這條由 657dcec5（2026-09-21）那行「受控 build／verify 還有十來個接縫沒實跑過」拆出，當時 stage.agents 受控站從沒在 profile 改動下實跑過。

要做成：在受控站跑到一半，從站頁套一個 preset，記下下一次 inject、brief、gate、resume、guard 各讀到新舊哪一份 profile，把結果寫進 subagents.md「The profile moves under a running stage」一節。

完成條件：跑過一次 stage.agents=all 的真實 task 並在中途翻轉 profile，五個 hook 的實際行為寫進 subagents.md，這條 TODO 才關。

2026-10-04 跑過一次：resume 與 guard 有了答案，inject、brief、gate 還要一次把在跑的站移出 `stage.agents` 的翻轉才分得出來；這條維持 blocked。
