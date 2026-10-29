---
type: regex
target: last_message
pattern: (?=[\s\S]*inflight\.js:\d+)[\s\S]*(group[^\n]{0,60}\b(always (set|present|defined|truthy|assigned|satisfied|true)|never unset|set on every|(on|in) every (record|mark|entry|brain))\b|group[^\n]{0,100}(tautolog|never discriminat)|every [\w ]{0,20}\b(carries|has|gets) a group|(markInflight|every (mark|call|brain))[^\n]{0,80}\b(sets?|gives?|giving|assigns?|setting)\b[^\n]{0,40}group)
flags: i
match: contains
---
Revert 5e2e621d: markInflight gives every mark a group, so `o.group` never
spares the closing brain and the handoff condition clears its mark before the
gate is confirmed. A return that does not say the group is always set, at
inflight.js, has let the same miss through.
