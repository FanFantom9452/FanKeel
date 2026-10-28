---
label: verify
title: verify 記突變殺率
description: verify 的證據列記突變 applied/killed/survived，每個 survivor 一行 path:line
state: ready
link: skills/fankeel-verify/SKILL.md
---

來源：docs/90-agent/judgements/2026-10-28-uncle-bob-measure-not-read.md「四件 take」#1。現況：fankeel-mutator 一次只收一個突變（agents/fankeel-mutator.md:17-21），survivor 進 context.md 並在 gate 送回 build（skills/fankeel-verify/SKILL.md:327-329），但沒有任何地方記殺死幾個、存活幾個。

目標檔：skills/fankeel-verify/SKILL.md 的 claim 表（:62-68 附近）、agents/fankeel-verifier.md:20-21 的列說明。

第一個具體改動：claim 表加一列 `| Tests catch faults | mutations applied N / killed K / survived S，每個 survivor 一行 path:line | one mutation |`；verifier 的證據列多這三個數字；tests/ 加一條斷言。不進每輪注入（karpathy 判決 :104）。成本低，約 5 行 markdown。對到 compact-1.md:14 那次拿掉條件、九項測試仍綠的存活者事故（有事故、沒數字）。

完成條件：claim 表與 verifier 證據列都有這三個數字，測試斷言兩處文字一致。
