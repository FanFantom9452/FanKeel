---
type: tool_used
tool: Agent
max: 0
---
One named file is one `Read` call away. Dispatching a subagent to read it
back is the overhead `docs/reports/evidence/2026-09-03-dispatch-vs-inline/`
already measured for much larger reads; here there is nothing to split.

`Agent` is the name a real dispatch is logged under in this harness's
`tool_use` blocks, which is what `type: tool_used` matches. The available-tool
list a headless session prints at start says `Task`; those are two different
things, and reading one for the other is how these graders were renamed the
wrong way on 2026-09-10 and back again on 2026-09-11.
