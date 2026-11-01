---
label: plan
title: plan 超過 context 時的拆組
description: 大專案拆組時 plan 要寫清各組介面與相依；plan 階段長到超過 context 要有處理規則 — [fankeel-plan](skills/fankeel-plan/SKILL.md).
state: done
link: skills/fankeel-plan/SKILL.md
done:
  at: 2026-11-02
  sha: caeb62dd
  disposition: done
  session: 56cbbc34-06e8-4768-a2a1-7741e5d6a847
---

來源：2026-11-01 教授談話（語音 261101_151532.txt L687–L797）。前端重構的 plan 長到約 350K 就自動壓縮，德隆的設計文件也超過一個 context。要做成：一、大專案拆組時，frame 與 plan 必須寫明每一組的介面，以及它對其他組的相依；二、定一條規則，plan 階段長到超過 context 時怎麼切、誰接手、前面的結論怎麼帶過去。相關的已完成條目：「brain 模式照相依圖派組」「stage brain 撞上限沒規則」，做之前先讀它們，避免重複。完成條件：skills/fankeel-plan/SKILL.md 有這兩條寫法，且拿一個會超過 context 的大計畫走一遍，plan 不再被自動壓縮截斷。

## 完成紀錄

plan 超過一個 context 時拆成索引加每組一份，build 依相依順序逐組跑. 詳見 [任務紀錄](../records/2026-11.md#r-2026-11-01-56cbbc34)

- commit bfb7f9ec
- commit c1f04927
