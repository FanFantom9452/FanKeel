---
type: tool_used
tool: Agent
max: 0
---
A one-command question does not need a second session reading a transcript
back to this one. A dispatch tool is listed in `prompt.md`'s `allowed_tools`,
but that listing is not what leaves this assertion something to fail against:
`--allowedTools`, which is what `scripts/eval.js` turns that list into, does not
gate the dispatch tool at all. Measured 2026-09-15 — the arm naming neither
spelling dispatched anyway. So the model can call `Agent` whatever the list
says, and `max: 0` has a real negative either way.

`Agent` is the name a real dispatch is logged under in this harness's
`tool_use` blocks, which is what `type: tool_used` matches — not the name in
the list a headless session prints at start, which says `Task` and is the
CLI's catalogue of registered tools rather than this run's.
