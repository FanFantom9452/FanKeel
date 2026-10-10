---
label: docs
title: pipeline 頁的規則引文過期
description: `docs/02-architecture/pipeline.md` 引的 build 規則比 `lib/stages.js` 舊，docs-check 看不到
state: ready
link: docs/02-architecture/pipeline.md
---

來源：docs/90-agent/judgements/2026-10-10-workflow-gaps.md 第 3 筆。現況：docs/02-architecture/pipeline.md:127、131、134-140 引用的 build 規則，少了 lib/stages.js:304 的 task.js intends、:308 的 At close: suite, then docs-check，以及 :316 模板裡的 docs-check: 行。這一頁標著 last_verified: 2026-10-09 卻示範舊規則；引文區塊沒有 path:line，所以 docs-check 檢查不到，讀者從這頁學到的注入內容是錯的。docs-1 只管 mermaid 流程圖而且是 blocked，不涵蓋引文區塊。要變成：tests/ 加一條測試，斷言 rulesFor(build) 與 templateFor(build) 的每一行都出現在該頁的 fence 內，並把頁面補到與程式一致。完成條件：頁面與 lib/stages.js 一致，改掉 stages.js 任一行 build 規則而不改頁面時那條測試會紅。
