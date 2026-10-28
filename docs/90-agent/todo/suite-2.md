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

## 試跑 2026-10-28

試跑環境：registry 條目在主樹，worktree 看不到，`scripts/suite.js --session … --fast --coverage` 回 no active entry，所以改直接呼叫 `runSuite`，指令是 `node --test tests/suite.test.js`（只跑這一檔，不是 test:fast 全套），涵蓋 `lib/suite.js` 與 `scripts/suite.js`；沒有寫 suite.json。

- lib/suite.js：97.26% line
- scripts/suite.js：100% line
- 有覆蓋率 20149 ms，無覆蓋率 20265 ms，比值 0.99

結論：暫定接，待 --fast 全套量測。比值低於 1.5×，成本可忽略；但這是單檔量測，接進 verify 前要在真實 task 的 `--fast --coverage` 再量一次全套的比值。
