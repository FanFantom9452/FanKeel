---
label: suite
title: node 內建覆蓋率試跑
description: suite.js 加 --coverage，用 node 內建覆蓋率對改動檔跑一次，結果寫 suite.json；只試跑
state: done
link: scripts/suite.js
done:
  at: 2026-10-29
  sha: 3ff933ca
  disposition: done
  session: 598148c3-467b-4a42-9cbe-55dda6fd46a6
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

build 之後另在主樹跑過一次全套 `scripts/suite.js --fast --coverage`，覆蓋 lib/docs.js 99.24、lib/map.js 99.62、lib/suite.js 99.32、scripts/suite.js 100（line %）；那次沒有再跑不帶 --coverage 的全套，所以全套的時間比值仍未量，上面 0.99 只是單檔試跑的比值。

結論：暫定接，全套帶 --coverage 已跑過，還缺的只有全套的時間比值。單檔比值低於 1.5×，成本可忽略；接進 verify 前要再量一次全套帶與不帶 --coverage 的比值。

## 完成紀錄

suite.js 有了 --coverage，suite.json 記每個改動檔的行覆蓋率；試跑結論是暫定接進 verify，接之前還要量全套的時間比值。詳見 [任務紀錄](../records/2026-10.md#r-2026-10-28-598148c3)

- commit ef523b1f
- commit 7e82e53d
- commit 08f55b05
- commit 3ff933ca
