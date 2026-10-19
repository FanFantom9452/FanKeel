---
label: skills
title: stage skill 瘦身
description: build SKILL 806 行、fankeel 1243 行，pstack 一本 playbook 約 21 行；是否先用 input-check 量化再設行數上限
state: done
link: scripts/input-check.js
done:
  at: 2026-10-20
  sha: 26ede4e4
  disposition: done
  session: 45487ab9-c8fc-44c7-a0db-d46d41bb4796
---

來源：2026-10-19 判官比較 cursor/plugins 的 pstack 與 fankeel（docs/90-agent/judgements/2026-10-18-cursor-plugins-pstack.md，比較表 #39、#7，判官評為 B 討論）。pstack 每次 /poteto-mode 的文字載入約 190–340 行（mode 149 行加一本 playbook），重量放在子代理面板上；fankeel 常駐注入小（每 prompt 約 2.2k 字元），但進入階段時讀一次的 SKILL.md 很長：fankeel 1243、build 806、survey 414、plan 396、land 357。另一個相關但獨立的問題是 architectural 任務是否值得「兩個候選草圖再由 judge 選一」（pstack architect＋arena），Claude Code 只有同家族模型，對抗訊號弱、成本雙倍。

要決定的是：要不要用 scripts/input-check.js 量化每個 stage skill 實際載入成本後設上限並瘦身，以及 architectural design 要不要多候選。

完成的樣子：使用者選定方向；若瘦身，另開任務並有一個行數或位元組上限的測試；若不做，記錄理由後關閉。

## 完成紀錄

每個 SKILL.md 有自己的位元組上限，略高於目前大小。 詳見[任務紀錄](../records/2026-10.md#r-2026-10-19-45487ab9)

- commit 26ede4e4
