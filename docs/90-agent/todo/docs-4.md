---
label: docs
title: 11 頁 reference 落後於程式碼
description: docs-audit 10-09 列出 11 頁 reference 的 verified 日期早於它點名的程式碼變更，都不是 fk/8846548c 造成的 — [scripts/docs-audit.js](scripts/docs-audit.js)
state: ready
link: scripts/docs-audit.js
---

來源：fk/8846548c（擴大 Haiku 角色測試與飄移）的 audit 階段，2026-10-09 在 09d23770 跑 `node scripts/docs-audit.js`。那次 audit 只讀這條分支碰過的頁面；下面這幾頁在 14 天視窗內被列為「fallen behind the code they describe」，但點名的 commit 都不在 64c58829..HEAD 裡，也沒有任何開著的 TODO 在追。

- skills/fankeel-explain/SKILL.md（lib/plain.js）
- skills/fankeel-station/SKILL.md（scripts/station.js）
- skills/fankeel-design/SKILL.md、skills/fankeel-plan/SKILL.md、skills/fankeel-verify/SKILL.md（lib/stages.js）
- agents/fankeel-brain.md、agents/fankeel-brain-high.md、agents/fankeel-brain-xhigh.md（hooks/title.js）
- docs/90-agent/reference/registry.md（lib/prices.js）
- docs/02-architecture/pipeline.md（tests/render.test.js）

要做成：每頁對它點名的 commit 讀一次，照 fankeel-audit 的 drift 兩種讀法判斷是頁面該跟上，還是程式碼本身可疑；頁面跟上的就改並更新 last_verified，可疑的另開 decision。
