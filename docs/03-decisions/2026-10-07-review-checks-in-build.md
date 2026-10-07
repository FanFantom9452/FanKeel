---
status: current
last_verified: 2026-10-07
source_of_truth: skills/fankeel-build/SKILL.md, tests/skills.test.js
---

# 五項 review 檢查為什麼寫進 build skill

## 決定

- 五項 review 檢查寫進 `skills/fankeel-build/SKILL.md`：
  - 第 6 步新增「會推翻 verify 列的發現要在本任務立刻修」。
  - reviewer 範本 Part 3 新增三項：(a) 每個顯示面都讀新欄位；(b) 新字串走字串表；(c) 每處標記都有經呼叫端渲染、移除就轉紅的測試，範圍是整個 repo。
  - docs-check 收尾段新增「稱為更早就有的列，先在第一個 BASE 上用 `git show` 核對」。
- `tests/skills.test.js` 新增一個測試，釘住這幾句（commit 1bad4d5c，計畫 317488de）。

## 為什麼

- 2026-10-06 的 task 被 verify 退回 build 五次，每次都由 controller 手加一行 review 檢查，這些檢查只活在那一輪。
- 寫進 skill 後，下個 task 沿用，不必再靠 controller 重新想起。

## 沒做的

- 測試釘的五句中有四句（"not the changed file alone"、"reads the new field"、"string table for translation"、"checked on the build's first BASE"）沒有逐一做變異驗證。
- SKILL.md 說 controller「手動加了五次」，這在 repo 內無紀錄可證，只有引用的七個 commit sha 存在。
- 全套測試曾有一次無法解釋的偶發失敗，重跑後 3659 通過、0 失敗。
