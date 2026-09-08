---
type: regex
target: trace
pattern: build[,\s→]+verify
flags: i
match: contains
---
The survey skill says the class is said out loud so it can be overridden. It
is said when the route is chosen, at the start, so the trace is the target:
the first measured run said "Route is `build → verify`" in its first message
and ended on a question, and `last_message` missed it.
