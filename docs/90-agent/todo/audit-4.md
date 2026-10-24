---
label: audit
title: CSS 死碼掃描器
description: repo 內沒有任何工具能找出沒人用的 CSS class；做一支掃描器或採用現成工具，接進 audit 階段
state: done
done:
  at: 2026-10-25
  sha: 4f9133dc
  disposition: done
  session: a2f7a8a8-8f0b-4f0e-ad4e-9e5104598011
---

來源：2026-10-24 TODO 全表盤點 survey。使用者問「station.css 的死樣式」（docs/90-agent/todo/station-54.md）是怎麼發現的：答案是 build review 在設定精靈與文件卡刪掉後注意到，之後靠手動 grep 確認；repo 裡沒有任何腳本能偵測沒用到的 CSS。survey.js 只列出 CSS class 宣告，knip／deptry 不讀 CSS。使用者的重點：這主要是大型系統與 React 這類框架的問題，長期架構成長時死碼會累積，小專案影響較小。要做成什麼：一支掃描器（fankeel 腳本，或在文件中寫明的現成工具），從 CSS 取出 class selector，檢查 js／html／jsx／tsx／vue／svelte 是否引用；名稱的前綴出現在樣板字串或字串串接裡時，標成「可能是動態組出」而不是死碼。動手前先調查現成工具（例如 PurgeCSS、UnCSS、瀏覽器 CSS coverage），合用就直接採用或引用，不要從零寫。完成條件：掃描器（或選定的工具）對 assets/station/ 執行時，若已知的死 .wz／.dsx 規則還在就要報出來（刪掉後則報無），且不可把 split-bar（assets/station/docs-page.js 有用）誤報為死碼；並接進 audit 階段的程式碼那一半，或在該處寫成文件。

## 完成紀錄

新增 scripts/css-dead.js，從 CSS 取出 class 檢查引用，樣板字串組出的前綴標成可能是動態，並接進 audit 階段。詳見 [任務紀錄](../records/2026-10.md#r-2026-10-24-a2f7a8a8)

- commit 4f9133dc
- commit 6c14767b
