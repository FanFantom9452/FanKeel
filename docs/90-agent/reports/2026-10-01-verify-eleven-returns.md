---
status: current
last_verified: 2026-10-09
---

# verify 的十一次退回，2026-10-01

這段原本嵌在 `skills/fankeel-build/SKILL.md` reviewer 模板的 Part 2 裡（2026-10-09 之前的 430 到 466 行），2026-10-09 依[工作流評審](2026-10-09-workflow-review.md)第二條搬到這裡：模板只留規則，機械的三件事由 `scripts/review-check.js` 印表，事故記錄是一份有日期的報告。每一條是 verify 那次退回 build 時發現 review 漏掉的東西，逐字保留，英文原文。

## 逐次

- 2026-10-01: verify's twelfth return found the rule's sentences contradicting each other, "and asserts its own effect" against "red on deletion"; hdl-k's header comment claimed the returns-before tests assert their branch's effect when hdl-k:185, :282 and :793 assert only `writes.page == 0`; and table citations were offset by 2, hdl-j:385 being :387; build's review checked none of them
- 2026-10-01: verify's second return to build listed ten such listeners
- 2026-10-01: verify's fifth return found .fwrap, .pg input[name^="pg-"] and .tdf's [data-todo] with zero hits though the event names all had hits
- 2026-10-01: verify's sixth return found ten click branches counted as covered by render/view-test hits though no press reached them
- 2026-10-01: verify's seventh return found `closest('[data-gop]')` and `closest('[data-gho]')` untested — the review walked only the ten branches it was handed, and counted a keydown test on the same selector as covering the click branch
- 2026-10-01: verify's eighth return found `[data-answer]` and `[data-tune-notify]` with hits only in probes that assert the branch does not fire, and the rule had been written but never applied to the listener it was written for
- 2026-10-01: verify's ninth return found hdl-k's doesNotThrow and nothing-fired tests counted as hits, and a block-delete mutation that killed the harness read as red
- 2026-10-01: verify's tenth return found the rule sentence ("must fail on its own branch's deletion") contradicted by its definition, which called only assert-nothing tests guards, so positive-count and toggle-back tests that stayed green on deletion counted as hits, and the review never opened the table's cited lines at the commit
- 2026-10-01: verify's eleventh return found the counter-example check had tried the rule against only one example, which never put the rule's two sentences against each other: "asserting that nothing happened does not count" and the guard definition (green on deletion) disagreed, so hdl-k:122, hdl-i:141 and hdl-j:387 were mis-judged, and hdl-k's header comment claimed an assertion :121 did not make.
