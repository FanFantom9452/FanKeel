---
type: regex
target: last_message
pattern: (?=[\s\S]*menu\.test\.js:\d+)[\s\S]*((delet|remov)[^\n]{0,60}(green|pass)|(green|pass\w*)[^\n]{0,60}\b(after|when|if)\b[^\n]{0,30}(delet|remov)|asserts? nothing|nothing (fired|happen\w*|was called)|empty dataset)
flags: i
match: contains
---
Verify's eighth to eleventh returns of 2026-10-01: a test that asserts nothing
happened counted as covering its branch, though deleting the branch leaves it
green. A return that does not say so at menu.test.js has let the same miss
through.
