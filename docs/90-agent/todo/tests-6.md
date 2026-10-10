---
label: tests
title: suite 紀錄保留每一次執行
description: `lib/suite.js` 的 record 只留最後一跑，偶發紅燈重跑變綠後失敗名單就被覆寫
state: ready
link: lib/suite.js
---

來源：docs/90-agent/judgements/2026-10-10-workflow-gaps.md 第 1 筆。現況：lib/suite.js:89-95 的 record 每次覆寫 suite.json，只留最後一次執行；lib/suite.js:118-120 與 scripts/task.js:1479-1480 讓紅燈成為 task.js land 的 refusal。所以偶發紅一次就得重跑整套約 3900 項，重跑變綠後第一跑的 failed 名單消失，證據只能靠人手抄進 TODO（fa81b4bb 就是這樣）。merge 之後那一跑用 npm test（skills/fankeel-land/SKILL.md:261），完全不記錄。要變成：record 改成累加 runs[]；task.js land 印出 green on run N 與先前紅過的測試名，land 模板的 suite: 行帶上這一句。相關條目 test-1、test-4 只記證據，tests-5 只留單跑。完成條件：同一棵樹先紅後綠各跑一次，suite.json 兩筆都在，task.js land 的輸出列出第一跑紅的測試名，並有測試蓋住。
