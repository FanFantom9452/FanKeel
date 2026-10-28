---
label: suite
title: node 內建覆蓋率試跑
description: suite.js 加 --coverage，用 node 內建覆蓋率對改動檔跑一次，結果寫 suite.json；只試跑
state: ready
link: scripts/suite.js
---

來源：docs/90-agent/judgements/2026-10-28-uncle-bob-measure-not-read.md「四件 take」#4。現況：沒有任何腳本量測試覆蓋率；package.json 無任何依賴，node >=22.5 內建 --experimental-test-coverage，零安裝可用。不裝 c8／stryker（零依賴硬規矩）。

目標檔：scripts/suite.js（:17 取 package.json test 指令處）。

第一個具體改動：加 `--coverage` 選項，追加 `--experimental-test-coverage --test-coverage-include=<changed files>`，把每檔 line% 寫進 suite.json，約 40 行 JS 加測試。

只做試跑：先在一個真實 task 跑一次，看有沒有 reviewer 漏掉的未覆蓋改動行；有才接進 verify，沒有就收回。照 graphify 判決的有界零成本試跑處理（2026-10-22:70）。

完成條件：--coverage 可用且 suite.json 有每檔 line%；一次真實 task 的試跑結果記回本條，並寫明是否接進 verify。
