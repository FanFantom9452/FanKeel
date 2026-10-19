---
label: gate
title: 無人值守要不要做
description: 是否允許宣告離開時由 profile 常備答案代答階段 gate；判官建議不做，因 gate.js 的去重與 handoff 流程建立在 gate 一定被問上
state: done
link: hooks/gate.js
done:
  at: 2026-10-19
  sha: d794bfc8
  disposition: abandoned
  session: d3262697-a4ab-4038-a006-e5286871ceb9
---

來源：2026-10-19 判官比較 cursor/plugins 的 pstack 與 fankeel（docs/90-agent/judgements/2026-10-18-cursor-plugins-pstack.md，比較表 #1、#21，判官評為 C 拒）。pstack 的 principle-never-block-on-the-human 與 07-overnight 指南支持過夜自主跑：可檢驗的結束謂詞、新 worktree、決策日誌、使用者說 going to bed 就不再問，只有不可逆動作仍停。fankeel 每階段結束必問（skills/fankeel/SKILL.md:386、:469-472），gate.station 只改變在哪裡答、不改變是否問。

要決定的是：要不要一個 profile 鍵（例如在 gate.away 下）讓使用者宣告離開時以常備答案代答指定階段的 gate。判官判斷不加，因為 gate.js 的去重、handoff 複製檢查與 resume 流程全建立在「gate 一定被問」之上，但這是設計立場不是事實。

完成的樣子：使用者選定做或不做；若做，另開設計任務並改 gate.js 與其測試；若不做，把理由寫進決策紀錄後關閉本條。

## 完成紀錄

決定不做無人值守自動回答關卡，理由寫進決策紀錄：使用者宣告離開時，關卡仍然要問人，不加由常備答案代答關卡的設定。

- commit d794bfc8
