---
label: survey
title: survey --affected 與閱讀順序
description: graphify 與 Understand-Anything 試裝後都移除；它們唯一勝出的點子是「列出改一個檔會影響誰」與閱讀順序，改用 requireGraph 做進 survey.js 與 map.md
state: done
link: scripts/survey.js
stamp: 2026-10-23
done:
  at: 2026-10-24
  sha: a9f302c0
  disposition: done
  session: 53b0565d-b2ca-45b3-ad53-dda251c5e46b
---

來源：2026-10-22 使用者要求 clone、深度分析、實際安裝並試跑 graphify 與 Understand-Anything，沒用就移除（session 23fd8947）。三份判決：[graphify-knowledge-graph](../judgements/2026-10-22-graphify-knowledge-graph.md)、[graphify-run-it](../judgements/2026-10-22-graphify-run-it.md)、[understand-anything](../judgements/2026-10-22-understand-anything.md)。graphify 在 5 題實戰對照中 0 勝、token 約 2.5 倍；Understand-Anything 全量分析排了 152 次 opus 派工、推估約 700 萬 token，超過上限而中止。兩者都已移除。

要做成：一、survey.js 加 --affected <file>：用 lib/requires.js 的 requireGraph 列出直接 require 它的檔案與對應測試，含行號；二、map.md 加一節閱讀順序，依被 require 次數由葉到根排；三、順手補 import cycles 一節（graphify 找到的兩組循環是真的：lib/profile.js 與 lib/stages.js、lib/handoff.js 與 lib/todo.js 與 lib/plain.js），並讓 requireGraph 認動態 import()（lib/board.js:57 目前漏掉）。

完成條件：survey.js --affected lib/stages.js 一次呼叫就列出 graphify-run-it 判決 Q1 的 15 個非測試檔與 18 個直接測試；map.md 出現閱讀順序與循環兩節；suite 綠。

## 完成紀錄

requireGraph 讀得到 import()，survey.js --affected 列出誰引用某個檔，map.md 多了閱讀順序與循環引用. 詳見 [任務紀錄](../records/2026-10.md#r-2026-10-23-53b0565d)

- commit 466c87db
- commit a9f302c0
- commit f2ea374c
- commit 5b05ab8b
- commit ed4fff5a
