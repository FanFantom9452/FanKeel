---
status: current
last_verified: 2026-09-15
source_of_truth: scripts/eval.js, lib/eval.js, evals/route-typo/case.yaml
---

# Behaviour evals

One case in the layout `claude plugin eval` reads, a runner beside it that works
without early access, and the six ways an operator's own machine can leak into a
run.

`evals/<case>/` holds cases in the layout `claude plugin eval` reads. Whether
this machine has it is read in an empty directory: "currently in early access"
means not enabled here, "No eval cases found" means it is. On 2.1.272 a
non-interactive run stops at a trust gate before it answers either way, so the
probe needs `--trust-plugin` to get that far — and on 2026-09-15 it answered
`No eval cases found`, so it is enabled here. The runner below needs none of
that, and runs the same case on this tree:

    node scripts/eval.js evals/route-typo --model sonnet

One `claude -p` per run, in a scaffolded temp repository with only this plugin
loaded (`--setting-sources project --plugin-dir .`), graded against
`graders/*.md`; `tool_used` and `regex` are graded, `llm` is reported as
skipped. A regex `target: trace` here reads the assistant text only, not the
whole transcript the official runner means by it — a pattern that expects a
tool call belongs to `tool_used`. Any failed grader exits 1. With early access:

    claude plugin eval . --json results.json --threshold 0.7 --model claude-sonnet-5 --no-publish

## The six contamination channels

`i-have-adhd`'s eval runner names six channels an operator's own world can leak
into a run, contaminating the comparison. This runner's landing for each:

| # | channel | landed |
|---|---|---|
| 1 | working directory | each run gets an empty temp directory (`scripts/eval.js:103`, `fs.mkdtempSync`) |
| 2 | operator's settings | `--setting-sources project` (`scripts/eval.js:109`, `--setting-sources`) |
| 3 | its own always-on flag | fankeel has no persistent always-on flag, so there is nothing here to point to |
| 4 | model version | `--model` has no default (`scripts/eval.js:61`, `: null`); missing it exits 1 before anything spawns (`scripts/eval.js:173`, `!a.model`) |
| 5 | cost | `costOf()` (`lib/eval.js:91`, `costOf`) reads `total_cost_usd`/`usage` off the result message, printed per run (`scripts/eval.js:143`, `cost $`) and in `--json`; `--max-budget-usd` passes through to `claude` (`scripts/eval.js:111`, `--max-budget-usd`) |
| 6 | tools | `--allowedTools` (`scripts/eval.js:113`, `--allowedTools`) |
