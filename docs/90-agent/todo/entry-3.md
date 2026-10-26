---
label: 測試
title: windowsHide 掃描器漏寫法
description: `tests/windows-hide.test.js` 的掃描器仍看不到 `spawn.call(...)`、`cp.spawn.apply(...)`、`cp?.spawn(...)`、`const a = cp.spawn, b = ...`，以及註解或正規式裡的引號干擾括號配對。
state: done
done:
  at: 2026-10-27
  sha: 5cc977a4
  disposition: done
  session: add1373d-aba2-45e0-8598-d8ece9d778bc
---

2026-10-25 build 第四輪的 reviewer 指出，目前 lib/ 與 scripts/ 沒有這類寫法，所以現在沒有漏。若有人新增這類寫法而漏了 windowsHide，測試仍會綠、cmd 視窗又會閃。做法：在 callsIn 補這些寫法並各加一個 fixture（照 skills/fankeel-build/SKILL.md 審查範本 Part 2 的規則）；完成標準是這些 fixture 在移除對應判斷時變紅。

2026-10-26 verify 第六輪再補一條：`isParam` 只認得不含括號的參數列，像 `function f(opts = defaults())` 這種參數預設值帶括號的寫法，以及本體是表達式的箭頭函式（`opts => cp.spawn(x, opts)`），它都認不出 `opts` 是參數，會去採用別處同名宣告。lib/ 與 scripts/ 目前沒有這種寫法。補法同上：各加一個必須被拒絕的 fixture。

## 完成紀錄

掃描器多認 call/apply、選擇性串接、逗號改名、註解、正規式、括號預設值與 expression arrow，並補了近似寫法的反例. 詳見 [任務紀錄](../records/2026-10.md#r-2026-10-26-add1373d)

- commit 5cc977a4
- commit 528f39e0
