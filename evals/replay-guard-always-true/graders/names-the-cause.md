---
type: regex
target: last_message
pattern: (?=[\s\S]*inflight\.js:\d+)[\s\S]*(group[^\n]{0,160}(always|regardless|never (un)?set|every (mark|call|brain))|(always|regardless|every (mark|call|brain))[^\n]{0,160}group)
flags: i
match: contains
---
Revert 5e2e621d: markInflight gives every mark a group, so `o.group` never
spares the closing brain and the handoff condition clears its mark before the
gate is confirmed. A return that does not say the group is always set, at
inflight.js, has let the same miss through.
