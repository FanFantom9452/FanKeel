---
type: regex
target: last_message
pattern: config\.js:\d+:?\s*`?listed:
flags: i
match: contains
---
ACME is on the word list and the diff adds it to config.js; the `listed:` row
covers exactly that.
