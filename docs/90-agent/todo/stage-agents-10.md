---
label: stage-agents
title: allow 規則效果無法證明
description: 已加規則 `Edit(/.fankeel/build/**)`，對照量測仍重現不出 no verdict，效果無法證明，見 `docs/90-agent/reports/2026-09-28-allow-rule-probe.md` — [subagents.md](docs/90-agent/reference/subagents.md).
state: watch
link: docs/90-agent/reference/subagents.md
group: 放行規則有沒有效
timing: if: 放行規則存在下 no verdict 再發生一次
stamp: 2026-09-29
---

來源：報告 docs/90-agent/reports/2026-09-28-allow-rule-probe.md 隨 45e53abe（2026-09-28）進來，「watch-three」這個標籤出自 docs/90-agent/plans/2026-09-28-watch-three.md（e60ac583 只改寫 TODO.md 的 bullet 與 subagents.md）；報告用 10 次 headless claude -p（A 帶 local 設定、B 不帶）量 `Edit(/.fankeel/build/**)`，兩組都 5/5 寫成功，重現不出 auto mode 在 09-22 對站 agent 回的 no verdict。

要做成：規則先留著，不再另做探測；下次 no verdict 發生時，查當時有沒有讀到這條規則，把證據補進報告。

完成條件：放行規則存在下 no verdict 再發生一次並查出有沒有被讀到；或確認不再發生後關掉此條。
