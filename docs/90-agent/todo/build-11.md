---
label: build
title: 種類紀律 lens
description: bug-fix／perf／refactor 各自的短紀律寫進 design 準則表與 implementer；修補第 3 輪強制寫下共同前提
state: ready
link: agents/fankeel-implementer.md
---

來源：2026-10-19 判官比較 cursor/plugins 的 pstack 與 fankeel（docs/90-agent/judgements/2026-10-18-cursor-plugins-pstack.md，比較表 #3、#35、#6，判官評為 B、前五名第二）。pstack 有 23 本 playbook，每本都帶種類專屬紀律：bug-fix 要自己在同一介面重現、先 commit 會失敗的 repro；perf 要先有基線、找限制因子、至少 5 次取中位數與範圍；refactor 要先釘住行為契約、不留 shim、沒降低讀者負擔就 revert。dyl-stack 另外要求修 bug 前寫 `Root cause: X because Y`。principle-attack-the-premise 則是兩次共前提的修法失敗後先寫下前提再測。

要變成：不引入 23 本 playbook，只在 skills/fankeel-design 準則表與 agents/fankeel-implementer 的 bug-fix 節補上這三種 lens，build 的修補迴圈第 3 輪要求寫下共同前提。

完成的樣子：三個檔各多幾行、skills-check 與現有測試通過，一個 bug 任務的 implementer brief 裡看得到重現與 Root cause 要求。工作量小，約 60 行。
