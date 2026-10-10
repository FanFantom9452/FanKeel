---
label: skills
title: 九份 One path 段落要有人比對
description: 「One path, never a search」同一段在九個 skill 各寫一份，`skills-check.js` 不比對，漂移沒人看得到
state: done
link: scripts/skills-check.js
done:
  at: 2026-10-10
  sha: 142a2118
  disposition: done
  session: ed211efa-746a-43d5-9cea-1a08a52f5b5e
---

來源：docs/90-agent/judgements/2026-10-10-workflow-gaps.md 第 6 筆。現況：skills/fankeel-build/SKILL.md:20-31、fankeel-verify:20-31、fankeel-land:18-29、fankeel-ask:20-31 等九個 skill 各有一份相同的 One path, never a search 段落。要改一次解析規則（例如 package.json names fankeel 那個例外）就得改九處；scripts/skills-check.js 只查腳本路徑，不比對這段文字，其中一份漏改不會有任何東西提醒。cuts-1 管的是程式 helper，不涵蓋 skill 文字。要變成：skills-check.js 斷言九份逐字相同，或把這段收進 fankeel skill 一處、其他八份改成指過去，兩者擇一。完成條件：只改其中一份的一個字時 skills-check.js 會失敗並指出是哪個檔；或九份只剩一份，其餘指向它，而且 skills-check.js 驗得到那個指向。

## 完成紀錄

audit、survey、init 三份技能頁的 One path 那一條改成和其他技能頁逐字相同。技能檢查多了一項：每份技能頁的這一條要和多數相同，不同的那一份會被列出來並讓檢查失敗。還有三個洞沒補：票數相同時取走訪順序的第一份、只有一份帶這一條時沒得比、整份沒有這一條的技能頁不會被列出。

- commit 142a2118
- commit e8e56564
- commit b0e056f8
