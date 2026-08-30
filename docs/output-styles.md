---
status: current
last_verified: 2026-08-31
source_of_truth: output-styles/, lib/stages.js
---

# Output styles

Three styles ship with the plugin. Why a style rather than a ruleset injected at the top of a session.

Three, picked in `/config` like any other output style. They are not part of the
mode and do not switch with it — a style is a Claude Code setting, not this
plugin's state.

A skill for setting one used to ship here and was removed in 0.20.0. It saved a
trip to `/config` and cost a second always-on skill description, an entry field
and a per-turn digest to cover the gap before the setting took effect. One trip
to a settings screen is the cheaper half of that trade.

| Style | For |
|---|---|
| `fankeel-terse` | Everyday work. Result first, no preamble, no tool narration, every identifier and error string verbatim. |
| `fankeel-pipeline` | Running the pipeline. Adds the question discipline — never wrap up silently, every question carries its own background and every option its trade-off. |
| `fankeel-review` | Reviews and audits. Findings only, one line each, most severe first, no praise and no redesigns. |

## Why a style rather than an injected ruleset

A plugin that sets your voice by injecting a ruleset at `SessionStart` is putting
it in the **conversation** — the part that gets compacted, summarised and pushed
back by hundreds of thousands of tokens. That is why such rulesets fade on a long
session.

An output style is appended to the **system prompt**:

```
You are an interactive agent that helps users according to your "Output Style"
below, which describes how you should respond to user queries.

# Output Style: fankeel-terse
...
```

Every request carries it verbatim. Compaction rewrites the conversation and never
the system prompt, so it cannot be diluted — and after the first request it is
inside the cached prefix, so it is close to free.

Claude Code also injects its own per-turn reminder while a style is active, which
is the other half of what an injected ruleset was doing, at no cost here.

## Setting it without /config — removed in 0.20.0

A `fankeel-style` skill used to write `outputStyle` into `settings.json` for you,
and it is worth recording why it went rather than leaving a gap where it was.

A `settings.json` change is not picked up by a session already running, so the
skill also had to put a four-line digest of the chosen style on the session entry
and inject it every turn until the real style took over next session. That is
three moving parts — a second always-on skill description, an entry field, and a
per-turn injection — to save one trip to a settings screen. `/config` is one
keystroke and it has none of them.

The three styles are unaffected. They ship with the plugin and appear in the
`/config` picker like any other.

## What is deliberately not done

- **No `force-for-plugin: true`.** That flag applies a plugin's style
  automatically and overrides whatever the user chose. fankeel is opt-in per
  session and does not get to seize the voice of every session on the machine.
- **No style is set for the user.** Name the one that does what they asked for
  and let them pick it. A style changes the voice of every session on the
  machine, including ones they are not looking at.

The four always-on rules in the per-turn injection overlap `fankeel-pipeline` on
purpose. A style is the user's choice and a hook cannot see which one is active,
so moving those rules into the style would mean losing them whenever the user
picked something else. Four lines a turn is the cheaper price.

[Back to the index](README.md) · [Back to the front page](../README.md)
