---
status: current
last_verified: 2026-08-22
source_of_truth: lib/badge.js
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

TokenBar renders an unknown flag on a neutral gray-to-white ramp, which makes
every stage the same colour. To have the badge brighten as the work moves along,
add the words to your own TokenBar config — it matches an exact mode word before
it falls back to the four intensity tiers:

```powershell
# ~/.claude/tokenbar-config.ps1
$badgeColors.fankeel = @{ off = 240; lite = 62; full = 68; ultra = 81
                          survey = 60; design = 62; build = 68
                          verify = 75; audit = 78; land = 81
                          clash = 196 }
```

```sh
# ~/.claude/tokenbar-config.sh
WORD_COLORS="fankeel:survey=60 fankeel:design=62 fankeel:build=68 fankeel:verify=75 fankeel:land=81 fankeel:clash=196"
```

Dark slate through to sky blue as the stage advances, and `clash` in red — the one
badge on that line that is a warning rather than a state.

[Back to the index](README.md) · [Back to the front page](../README.md)
