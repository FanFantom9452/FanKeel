---
name: fankeel-style
description: Set the Claude Code output style without opening /config. Use when the user asks for shorter answers, less preamble, a fixed reply format, fewer output tokens, a review voice, or says replies have got long-winded — and when they ask what style is active or to go back to normal. Also for "講短一點", "省 token", "輸出風格", "換回原本的".
argument-hint: "[terse|pipeline|review|off]"
version: 0.9.1
---

# fankeel-style

Sets `outputStyle` in `settings.json` — the same field `/config` writes — so
nobody has to go and find it.

## Why this is worth a script

An output style is appended to the **system prompt**. It is sent verbatim on
every single request and compaction never touches the system prompt, so it does
not fade the way a ruleset injected into the conversation does. It is also one
copy however long the session runs, where anything injected per turn adds a fresh
copy to the transcript each time.

That makes it the right home for how Claude talks. The only thing wrong with it
is that the user has to go and pick it, and people do not go and change settings.
They ask. This is what to run when they do.

## The script

```
node <plugin>/scripts/style.js                                   # what is set, and the choices
node <plugin>/scripts/style.js terse --session <id> --root <dir> # set it
node <plugin>/scripts/style.js off --session <id> --root <dir>   # back to Claude Code's default
```

`<plugin>` is two directories up from this file — resolve `../../scripts/style.js`
against the directory this SKILL.md was loaded from.

`--session` and `--root` are optional and only matter while a fankeel task is
active: they let the script bridge the gap described below. Pass the session id
from the `FANKEEL ACTIVE` block when it is there, and the project root as
`--root`. Leave both off otherwise.

Quote what the script printed. Do not paraphrase it — it reports whether the file
actually changed, and "already set" and "set" are different answers.

## The three

| | |
|---|---|
| `terse` | Everyday work. Result first, no preamble, no tool narration. |
| `pipeline` | Running the fankeel pipeline. Terse, plus the question discipline — never wrap up silently, every question carries its own background and every option its trade-off. |
| `review` | Reviews and audits. Findings only, one line each, most severe first, no praise and no redesigns. |

All three are terse underneath, so any of them cuts output. Recommend `terse`
unless the user is doing one of the other two things.

If the user has not said which, offer the three with what each is for and let
them pick. Do not choose for them — this changes the voice of every session on
the machine, including ones they are not looking at.

## The gap, and the digest

Whether a running session picks up a `settings.json` change without restarting is
recorded in the script as `SETTINGS_RELOAD_IS_LIVE`. While that is false, setting
a style also writes a four-line digest into the fankeel session entry, and the
hook injects it on every prompt so the voice starts immediately. The full style
takes over from the next session.

Say which of the two the user is getting. "It's set" when they will not see it
until they restart is the kind of thing that makes people stop trusting a tool.

## What not to do

- **Do not edit `settings.json` by hand.** The script preserves every other key,
  backs the file up before its first change, refuses to overwrite a file that
  does not parse, and writes through a temporary file so an interrupted write
  cannot leave half a settings file. Reproducing that inline is how a settings
  file gets lost.
- **Do not set a style the user did not ask for**, and do not set one because the
  conversation seems long. It is their setting.
- **Do not promise the style will apply retroactively.** It changes what is sent
  from the next request, not what was already said.
