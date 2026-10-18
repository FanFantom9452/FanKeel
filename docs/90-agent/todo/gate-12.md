---
label: gate
title: 被拒的 gate 留下 gateAt
description: hooks/gate.js:213 gateOpen runs before refuse(); a refused ask leaves the registry gateAt stamp, so station shows waiting
state: blocked
stamp: 2026-10-18
---

hooks/gate.js:213 calls registry.gateOpen before the refuse() calls at :248 :266 :295 :314 :331; gateClose runs only in hooks/resume.js:65 (PostToolUse), which a denied call never fires. Every station waiting signal reads the stamp: assets/station/station.js gateAt (關卡 tab), :1788, :2982, :3016. Fix: open the gate after the refusals pass, or close it on refuse. Unchecked: whether PostToolUse fires when the user cancels an AskUserQuestion.
