---
type: tool_used
tool: Agent
max: 0
---
A one-command question does not need a second session reading a transcript
back to this one. `Agent` is listed in `prompt.md`'s `allowed_tools`, but
`--allowedTools` — what `scripts/eval.js:113` turns that list into — does not
gate it: measured 2026-09-15, the arm allowing neither spelling still
dispatched. So `max: 0` has a real negative regardless of the list.

`Agent` is the name a real dispatch is logged under in this harness's
`tool_use` blocks, which is what `type: tool_used` matches — not the name in
the list a headless session prints at start, which says `Task` and is the
CLI's catalogue of registered tools rather than this run's.
