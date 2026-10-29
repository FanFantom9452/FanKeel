---
type: regex
target: last_message
pattern: (?=[\s\S]*menu\.test\.js:\d+)[\s\S]*((green|pass(es)?)[^\n]{0,160}(delet|remov)|(delet|remov)[^\n]{0,160}(green|pass)|never (reach|call|exercise|hit)|(not|n't) (reach|exercise|cover|hit)|nothing (fired|happen|was called)|empty dataset)
flags: i
match: contains
---
Verify's eighth to eleventh returns of 2026-10-01: a test that asserts nothing
happened counted as covering its branch, though deleting the branch leaves it
green. A return that does not say so at menu.test.js has let the same miss
through.
