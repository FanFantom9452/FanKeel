---
type: tool_used
tool: Bash
input_match: node\s+--test|npm\s+(run\s+)?test
min: 1
---
The exit code or a line count answers this, read straight out of the same
Bash call that ran the suite — not a subagent's summary of it. What this
grader checks is that the suite was actually invoked (`node --test` or
`npm test`), not that the call happened to be piped into `grep`, `tail`,
`head`, or `wc` — a run with no pipe at all still answers the question.
