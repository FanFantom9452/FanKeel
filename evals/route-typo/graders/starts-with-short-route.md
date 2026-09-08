---
type: tool_used
tool: Bash
input_match: task\.js start\b[^\n]*--route\W{1,4}build,verify
min: 1
---
The fankeel skill says a typo fix is `build,verify`. The input is matched as
JSON, so `\W{1,4}` lets a space, a quote and its escaping backslash through.
