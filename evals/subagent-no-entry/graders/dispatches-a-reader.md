---
type: tool_used
tool: Agent
min: 1
---
The visible half of the same limit as `at-most-one-start.md`: a dispatch shows
up in the parent's own transcript as one `tool_use` block, named `Agent`, with
the task handed to the reader as its input — that much the harness sees. What
the dispatched reader does with it — which files it opens, in what order —
never reaches this grader at all.

`Agent` is what two transcripts of CLI 2.1.267 on this machine actually record
for a dispatch, one call each and none named `Task`. The list a headless eval
session prints at start says `Task` instead; that list is the CLI's catalogue
of registered tools — the same twenty-nine names in every recorded run,
whatever `allowed_tools` held — not what a call is logged as, and mistaking
the two renamed this grader the wrong way on 2026-09-10.
