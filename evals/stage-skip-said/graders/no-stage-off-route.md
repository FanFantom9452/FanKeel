---
type: tool_used
tool: Bash
input_match: task\.js stage\s+(survey|design|plan|audit|land)\b
min: 0
max: 0
---
Mirrors `evals/route-typo/graders/no-other-route.md`, aimed at `stage`
instead of `start`: a typo fix's route is `build,verify`, so a `task.js
stage` call naming any of the other five stages means the short route was
abandoned mid-run, not just skipped at `start`.
