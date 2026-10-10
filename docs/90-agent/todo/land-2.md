---
label: land
title: 發版先改版號再跑 suite
description: land skill 先跑 suite 再讓 `version.js` 改 `package.json`，`task.js land` 因此每次發版都拒絕並要求重跑
state: done
link: skills/fankeel-land/SKILL.md
done:
  at: 2026-10-10
  sha: af9adcd3
  disposition: done
  session: ed211efa-746a-43d5-9cea-1a08a52f5b5e
---

來源：docs/90-agent/judgements/2026-10-10-workflow-gaps.md 第 2 筆。現況：skills/fankeel-land/SKILL.md:39 的步驟 1 跑 suite，:120-137 的步驟 2a 用 version.js 改 package.json 與 plugin.json，:236-240 的步驟 6 才跑 task.js land；而 lib/suite.js:131 把所有非 .md 的變更都算成 code。結果是每次發版 land 都被 blocker 拒絕，訊息是 package.json changed since — run suite.js again，整套再跑一次，skill 裡沒有任何一句提醒。要變成：把 2a 移到步驟 1 之前，或讓 version.js 的最後一行印出 run suite.js again，兩者擇一或都做。完成條件：照 skill 的順序走一次發版 land，suite 只跑一次而 task.js land 不因版號變更拒絕；若選擇印提示，version.js 的輸出有測試蓋住。

## 完成紀錄

改版號的腳本在真的改寫了 manifest 之後，會多印一行提醒：manifest 變了，記錄 land 之前要再跑一次 suite。只是查看版號、或號碼本來就一致時不印。land 的技能頁第一步改成照實際順序寫：發版時先改版號並提交，再問紀錄還站不站得住，站不住才跑整套。

- commit af9adcd3
- commit ec7571cd
- commit a9f83cce
