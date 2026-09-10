---
type: tool_used
tool: Agent
max: 0
---
A one-command question does not need a second session reading a transcript
back to this one — a dispatch tool stays in `prompt.md`'s `allowed_tools`
precisely so this assertion has something to fail against.

`Agent` is the name a real dispatch is logged under in this harness's
`tool_use` blocks, which is what `type: tool_used` matches — not the name in
the available-tool list a headless session prints at start, which says `Task`.
