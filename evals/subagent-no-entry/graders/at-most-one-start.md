---
type: tool_used
tool: Bash
input_match: task\.js start\b
max: 1
---
`scripts/eval.js` only reads the top-level session's own stdout
(`spawnClaude` in `runOnce`, `lib/eval.js:64-73` `toolCalls()` walking
`msg.type === 'assistant'` blocks of that one stream) — a dispatched
subagent's transcript is a separate sidecar the harness never opens. This
grader can therefore only see whether the PARENT session calls `task.js
start` more than once; it cannot see, and does not claim to see, whether a
dispatched subagent registers a second entry of its own.
