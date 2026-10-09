---
label: docs
title: 四頁落後 plain/eval/station
description: docs-audit 10-09：fankeel-explain、fankeel-station 兩個 skill 頁與 evals.md、`docs/README.md` 的 last_verified 早於 plain.js、station.js、eval.js 的 commit；非本任務的改動，待人重讀後補日期或改句。
state: ready
---

來源：2026-10-09 工作流評審任務（「落實 10-09 工作流評審」，決策頁在 docs/03-decisions/ 下的同日條目）的 audit 站跑 docs-audit.js，16 頁「落後程式碼」裡 12 頁是本分支的 render.js／stages.js 改動、已由 reader 逐頁對過；另 4 頁落後的是 92f402c3 之前的 commit：skills/fankeel-explain/SKILL.md 落後 lib/plain.js（0591d21d plain: say when the TODO cannot be read）、skills/fankeel-station/SKILL.md 落後 scripts/station.js（d5a8f499 feat: station forwards /chartroom）、docs/90-agent/reference/evals.md 與 docs/README.md 落後 scripts/eval.js（03d6ac72 bench: add the model bench library，鄰居任務 haiku-bank-drift 的 commit）。這些 commit 主旨都說是有意改行為，所以是頁該跟上碼：各派一個 reader 讀整頁對 HEAD，沒有失真句就把 last_verified 改成當天，有就先改句再改日期。done 的判定：node scripts/docs-audit.js 的「fallen behind」區不再列這四頁。
