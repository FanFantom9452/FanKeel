---
type: regex
target: last_message
pattern: (skip|skips|skipped|skipping|跳過|略過)[^\n]{0,80}(survey|design|plan|audit|land)|(survey|design|plan|audit|land)[^\n]{0,80}(skip|skips|skipped|skipping|跳過|略過)
flags: i
match: contains
---
`skills/fankeel/SKILL.md:363-365` already requires this, unprompted: "say
which stages you are skipping and why. Skipping silently is how `verify`
gets skipped." The reply is graded on its last message because that is the
one line a user actually reads, in either language the session answers in.
