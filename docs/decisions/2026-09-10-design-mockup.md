---
status: current
last_verified: 2026-09-10
source_of_truth: lib/profile.js, lib/stages.js, skills/fankeel-design/SKILL.md
---

# 一個鍵同時是開關與模型 — 決策

使用者的問題是「前端設計的工作流程步驟可能需要更強的模型」。survey 的第一個發現
就把它拆成兩個問題，而那個拆法決定了整個做法。

## `when` 的鍵只能是 profile 鍵，所以軸要拆成兩個

`holds()`（`lib/stages.js:137-142`）讀的是 `values[key]`，`rulesFor` 的 values 預設是
`profile.read().values`（`lib/stages.js:555`），`lib/render.js:132` 傳進去的也只有
`profile.values`。條件載入這個機制**只**吃 profile 鍵。

而「這是不是前端任務」是 per-task 的。兩者接不上。

拆法是：per-project 的那一半（**這個專案有前端嗎**）進 profile，per-task 的那一半
（**這個任務碰不碰畫面**）留在規則的散文裡，跟 `class` 一樣是說出來讓人推翻的判斷。
不去改 `when` 的取值來源——那是簡報 §2.2 的條件載入矩陣，今天卡在 `## Waiting` 等
`registry.json` 落地，而且它動到 `land` 已經依賴的介面。

## 為什麼是一個鍵，不是兩個

`parseValue`（`lib/profile.js:56-63`）把字串 `'false'` 轉成布林 `false`，而 `holds()`
把布林 `false` 與字串 `'false'` 都當關。所以值域 `['false', 'sonnet', 'opus', 'fable']`
的一個鍵，`false` 就是「這個專案沒有前端」，任何模型名就是「有，而且那一步吃這個」。
兩支檔案的既有邏輯一行都不用改。

考慮過只在規則裡寫死 `opus`——那更小。否決的理由是 tier：這個 repo 自己的規則說，
能被 script 檢查或拒絕的東西就放 script 層，而 profile 鍵正是那一層（`task.js profile
set` 會拒絕值域外的值），寫死在散文裡則只能被讀。

## 為什麼內建是 `false` 而不是 `opus`

預設開啟會讓每個後端專案的 design 都多付一段注入字元，而它們永遠用不到。
`dispatch.floor` 的 `sonnet` 也不對——這個鍵存在的理由就是視覺設計不該吃那個 floor。
開啟時建議 `opus`：`docs/plans/2026-09-09-design-class-prompt.md:269` 把實作交給 Opus，
mockup 是實作產物；`fable` 是寫作與判斷層，那是 `judge.model` 內建 `fable` 的理由。

## template 沒有拿到槽

`template` 不經過 `when` 過濾（`lib/stages.js:555` 只過濾 `found.when`），所以加在
template 的 `mockup:` 槽連沒有前端的專案都要付。產物路徑改寫在既有的 `spec:` 行上。
關閉時這次改動的注入成本因此是**零**；開啟時量到 2357 / 2400。

## 產物路徑名的是 stem，不是 ledger

第一版寫成「ledger 用的同一個目錄名」。全分支 review 指出 `bounded` 沒有 plan 也就沒有
ledger；實際上比那更廣——`design` 跑在 `plan` **之前**，所以任何 class 在寫 mockup
的當下都還沒有 ledger 目錄（`lib/ledger.js:48-50` 從 plan 的 basename 推它）。
能知道的是 stem：design 檔、plan 檔與 ledger 目錄共用 `<date>-<topic>`，沒有檔案的
`bounded` 就從日期與題目直接取。

## 這次沒做，而且是刻意的

- 不讓 `when` 讀 task-level 的值（簡報 §2.2，等 `registry.json`）
- 不做 frontend / backend / docs 的第三個維度，另開 cycle
- 不實作 `docs/plans/2026-09-09-design-class-prompt.md` 的 design class
- 不給模型選擇加程式碼強制。`renderBrief`（`lib/render.js:359`）沒有 profile 參數，
  `hooks/brief.js` 也不傳，所以**沒有任何 profile 值到得了 subagent**——模型與路徑
  都得由派它的 session 寫進 prompt。這個新鍵繼承 `dispatch.floor` 的同一個缺口，
  那條在 `TODO.md` 的 `## Needs a decision` 底下，落地時兩個鍵一起受惠。

## 建到一半才發現的兩件事

`lib/stages.js` 插進三行，底下每一條 `path:line` 引用就位移三格——四支 skill 共十一條。
`docs-check` 會把每一條的正確新行號算出來，所以那次修正是照它的輸出改，再用它自己驗。

`tests/` 的縮排是逐檔的，不是逐目錄的：`profile.test.js` 4 空格，`stages.test.js`
2 空格。計畫的 Global Constraints 從前者取樣卻寫成後者，implementer 照著寫，檔案就
混排了。從一個檔案推整個目錄是這次唯一真正的規格錯誤。
