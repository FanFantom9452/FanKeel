---
label: skills
title: 九份 One path 段落要有人比對
description: 「One path, never a search」同一段在九個 skill 各寫一份，`skills-check.js` 不比對，漂移沒人看得到
state: ready
link: scripts/skills-check.js
---

來源：docs/90-agent/judgements/2026-10-10-workflow-gaps.md 第 6 筆。現況：skills/fankeel-build/SKILL.md:20-31、fankeel-verify:20-31、fankeel-land:18-29、fankeel-ask:20-31 等九個 skill 各有一份相同的 One path, never a search 段落。要改一次解析規則（例如 package.json names fankeel 那個例外）就得改九處；scripts/skills-check.js 只查腳本路徑，不比對這段文字，其中一份漏改不會有任何東西提醒。cuts-1 管的是程式 helper，不涵蓋 skill 文字。要變成：skills-check.js 斷言九份逐字相同，或把這段收進 fankeel skill 一處、其他八份改成指過去，兩者擇一。完成條件：只改其中一份的一個字時 skills-check.js 會失敗並指出是哪個檔；或九份只剩一份，其餘指向它，而且 skills-check.js 驗得到那個指向。
