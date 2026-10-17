---
label: docs
title: 文件整併：一件事寫兩頁
description: compact.at、title 覆寫、judge.js record、ledger.js ready、version.js 各留一頁當來源
state: ready
---

來源：2026-10-18 文件審查那一輪，讀者對照 81 組描述同一份程式碼的頁面時，找到幾處兩頁都把同一個機制完整講了一遍、互相沒有指向對方。當時只修了說錯的句子，沒有整併。要做的事：compact.at 以 docs/01-guide/profile.md 為來源，skills/fankeel-init/SKILL.md 只留問題與指令；title 覆寫以 docs/90-agent/reference/subagents.md 為來源，model-choice.md 只留決定與連結；judge.js record 以 skills/fankeel-ask/SKILL.md 為來源，subagents.md 只留一句指過去；ledger.js ready 以 skills/fankeel-build/SKILL.md 為來源；version.js 的理由以 docs/01-guide/development.md 為來源，fankeel-land SKILL 只留三個指令。另外 running-agent 判定以 station.md 為來源、seen/claims 以 collisions.md 為來源，registry.md 各留一句指標。完成的標準：每個機制只有一頁完整解釋，另一頁有連結指過去，docs-check 與整套測試全綠。
