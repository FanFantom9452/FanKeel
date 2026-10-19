---
label: judge
title: 受控站擋 ask 寫檔
description: 在受控站（stage.agents 列出的 survey、build、verify）執行 /fankeel-ask 時，guard 擋下主控寫 brief，也擋下 judge.js record 的 shell 寫檔，判決無法歸檔
state: ready
link: hooks/guard.js
---

來源：2026-10-19 session 7a19c544 在 survey 站執行 /fankeel-ask 分析 TencentDB-Agent-Memory。skills/fankeel-ask/SKILL.md 的第一步要主控把 brief 寫到 .fankeel/build/ask/，第三步要主控跑 judge.js record；但 hooks/guard.js 在受控站對主控的 Write 與會寫檔的 Bash 一律拒絕（「is a controlled stage — its stage agent does the writing here」）。當時的繞法是 task.js route 加上 design、task.js stage design 移到不受控的站，才寫得了 brief 並歸檔，任務路線因此被改動。

要變成：受控站也能跑完 /fankeel-ask 四步，不必改路線。可能做法：guard 對主控寫 .fankeel/build/ask/ 與執行 judge.js record 放行；或照 todo-5 的做法，由 skill 改成派 agent 寫 brief、由判官端或 judge.js 自己落檔。需先決定哪一種不會削弱受控站「主控只派工、轉路徑、問」的原則。

完成的樣子：tests/guard.test.js 有一個案例：受控站的主控寫 .fankeel/build/ask/<n>-<slug>-brief.md 與跑 judge.js record 時不被擋（或 skill 改走的路徑被測到）；在 survey 站實跑一次 /fankeel-ask 能歸檔。
