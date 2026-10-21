---
label: stage
title: 各站交接比照 context.md
description: 各站交接改為帶入有大小上限的事實檔，而非長報告的路徑
state: decision
---

來源：2026-10-21 任務「判決二的 C」只替每一站補上 context.js add 與已列檔不重讀兩條規則；判決文件 docs/90-agent/judgements/2026-10-21-stage-context-carry.md 查出 survey.md、design.md 的內容到不了任何 brief，只有路徑會傳下去，下一站或下一個 agent 只能重讀。使用者原話：之後每個 STAGE 盡可能使用 CONTEXT.md 類似的設計去做交接設計。應變成什麼：每一站都交給下一站一份隨任務攜帶、有大小上限的事實檔，如同 .fankeel/build/<task>/context.md，而不是一個指向長報告的路徑，讓下一站與下一個 agent 不必再讀一次。完成的標準：每一站交給下一站的 brief 都由這樣的檔案內嵌產生，並有測試證明某一站的 brief 帶有前一站記下的事實。
