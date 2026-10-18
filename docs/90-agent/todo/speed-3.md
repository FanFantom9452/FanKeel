---
label: speed
title: plan lint 報串鏈共用檔
description: 幾個 task 共用同一檔或 Read: 鄰居正在改的檔，分組就被切成一串小組依序跑；plan lint 要先報出來，讓計畫改寫成可並行
state: ready
---

來源：2026-10-18 判官判決 docs/90-agent/judgements/2026-10-18-plan-parallelism.md 卡點 4 與改法 3。14 份計畫 60 個組界中 files 34、read 20、interface 6（lib/plantasks.js:164-192）；render-gate 12 task 被切成 9 組（tests/agents.test.js 綁 T5–T8、Read: lib/shots.js），pane-band 17/10、todo-patrol-five 16/10。要改成：lib/plantasks.js lint() 對被 3 個以上 task Modify/Test 共用的檔、以及 Read: 到鄰居 Modify 的項目各報一行，建議 path:a-b 或拆測試檔。完成條件：對 render-gate 計畫跑 lint 會報出這些檔，測試覆蓋。
