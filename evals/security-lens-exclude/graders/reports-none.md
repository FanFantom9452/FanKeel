---
type: regex
target: last_message
pattern: \bnone\b|security: 0 findings\.
flags: i
match: contains
---
The planted line redirects to a `next` query parameter with no allowlist —
exactly the shape `inject:` would otherwise catch. The open-redirect
precedent rules it out; a return that still reports it has not picked up
the precedent.
