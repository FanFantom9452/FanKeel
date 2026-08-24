---
status: current
last_verified: 2026-08-24
source_of_truth: lib/badge.js, hooks/inject.js
---

# The statusline badge

The one word fankeel writes, how TokenBar renders it, and how to give each stage its own colour.

# Statusline

fankeel writes one word to `~/.claude/modes/<session_id>/fankeel`.
[TokenBar](https://github.com/FanFantom9452/ClaudeCodeCLI-TokenBar) renders any
flag it finds there, so no change is needed on that side:

```
[FANKEEL:SURVEY]  [FANKEEL:DESIGN]  [FANKEEL:BUILD]  [FANKEEL:VERIFY]  [FANKEEL:AUDIT]  [FANKEEL:LAND]  [FANKEEL:CLASH]
```

The word is the stage, not an intensity. An intensity is a constant you set once
and then stop noticing; a statusline earns its space by showing what changes.
`clash` takes the slot when another live session is in your files, because at that
moment the collision matters more than the stage — and the stage is still in the
injected text.

That trade is forced by the badge having room for one word, and it is not forced
anywhere else. The lead line states the collision in a field of its own — `others`,
rendered `⚑2` — so it keeps the stage in `word`: saying the collision twice there
would cost the one fact on that line with nowhere else to live. `inject.js` writes
the two files from the same collision check and deliberately does not send the
same word to both.

TokenBar renders a flag it has no palette for on a neutral gray-to-white ramp,
which would make every stage the same colour. From **v1.4.0** it carries one for
these seven, so nothing has to be set up:

| | | | | | | |
|---|---|---|---|---|---|---|
| `survey` | `design` | `plan` | `build` | `verify` | `audit` | `land` |
| 60 | 62 | 67 | 68 | 75 | 78 | 81 |

Dark slate through to sky blue as the stage advances, and `clash` in 196 — the one
badge on that line that is a warning rather than a state. Both TokenBar ports ship
the same seven numbers and were checked against each other rendering them.

Before v1.4.0 this was a block you wrote yourself, which is exactly why it now
ships: `tokenbar-config` is never touched by the updater, so a palette written
there is frozen the day it is written. The seventh stage arrived and every
hand-written copy was one short — and a stage with no colour does not read as a
stage without a colour. It reads as a broken badge.

To use your own, name the words in your config: an exact mode word is matched
before the four intensity tiers, and naming any of them replaces all seven, so
carry the whole set.

```powershell
# ~/.claude/tokenbar-config.ps1
$badgeColors.fankeel = @{ off = 240; lite = 245; full  = 250; ultra = 255
                          survey =  39; design = 141; plan  = 170
                          build  = 214; verify =  80; audit = 180
                          land   =  78; clash  = 196 }
```

```sh
# ~/.claude/tokenbar-config.sh
WORD_COLORS="fankeel:survey=39 fankeel:design=141 fankeel:plan=170 fankeel:build=214 fankeel:verify=80 fankeel:audit=180 fankeel:land=78 fankeel:clash=196"
```

[Back to the index](README.md) · [Back to the front page](../README.md)
