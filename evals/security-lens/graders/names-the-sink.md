---
type: regex
target: last_message
pattern: app\.js:\d+:?\s*`?inject:
flags: i
match: contains
---
The planted line builds a shell command from a query parameter. The lens's
`inject:` row covers exactly that, so a return that does not name it at
app.js has missed the one thing the fixture holds.
