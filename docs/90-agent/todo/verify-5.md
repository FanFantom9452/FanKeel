---
label: verify
title: verify 加 blast-radius lens
description: lib/lenses.js 算 base..HEAD 改到的每個檔被幾個檔案 require／import，超過門檻就把呼叫者列進對手審查員的簡報
state: ready
link: lib/lenses.js
---

來源：docs/90-agent/judgements/2026-11-02-pstack-video-summary.md 的 pick A（之後因使用者回答改走 B，見 gate-22；這條仍是判官認定的唯一缺口）。pstack 的 `blast-radius` skill 在 10-18 由 opus 讀者讀過，但比較表沒有它的列（docs/90-agent/judgements/2026-10-18-cursor-plugins-pstack.md:110 只在 delegated 名單出現），所以依風險分級審查從沒被判過。

現況：fankeel 只依宣告的 class 抬模型（skills/fankeel-verify/SKILL.md:165 的 dispatch.floor），以及 `sensitive.review` 開關（:273-275）；verify 在派對手前跑 lib/lenses.js 並列出觸發的 lens（:269-271），沒有任何地方量改動的 fan-in。2026-10-29 anthropic-review 判決 :69 拒的是給人簽核的風險分級，沒有考慮機器算出、只擴大審查員閱讀範圍的 fan-in。

第一個具體改動：lib/lenses.js 對 range 內每個改到的檔，用 `git grep` 數 require／import 它的檔案數，超過 profile 門檻就輸出 `## Blast radius` 與呼叫者清單；skills/fankeel-verify/SKILL.md:269-271 在 Silent failure／Comment 旁點名它。先開 lib/lenses.js 確認沒有同名功能（判官未讀，would flip if）。

完成條件：tests/ 一條測試——改一個被 N 個檔引用的檔時 lens 觸發並列出 N 個呼叫者，現在失敗、改完通過。
