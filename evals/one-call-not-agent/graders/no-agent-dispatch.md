---
type: tool_used
tool: Agent
max: 0
---
One named file is one `Read` call away. Dispatching a subagent to read it
back is the overhead `docs/reports/evidence/2026-09-03-dispatch-vs-inline/`
already measured for much larger reads; here there is nothing to split.
