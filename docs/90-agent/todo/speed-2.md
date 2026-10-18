---
label: speed
title: 收尾三件事並行
description: build 收尾時 fast suite、整條分支審查、docs-check 依序跑，每場末尾 18–29 分鐘沒有 agent 在動；改成背景 suite 與另兩件同跑
state: ready
---

來源：2026-10-18 判官判決 docs/90-agent/judgements/2026-10-18-plan-parallelism.md 卡點 3 與改法 2。workflow-gaps、render-gate、deny-posix-helpers、station-dashboard 四場收尾段 18–29 分鐘無 agent，suite 相鄰紀錄間距 3.3–5 分。要改成：skills/fankeel-build/SKILL.md:596-599 讓 suite.js --fast 以 run_in_background 跑，同時派 whole-branch reviewer 並跑 docs-check；lib/suite.js 的 record 補 ms 欄，之後才量得到每次 suite 時長。完成條件：SKILL 寫明並行順序與 suite 紅時怎麼合流，suite.json 每筆有 ms，測試覆蓋。
