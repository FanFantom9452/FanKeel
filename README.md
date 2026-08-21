# fankeel

A keel is the one structural member a hull cannot lose.

Long-running projects rot in ways that are invisible from inside any one session.
Components get rebuilt because nobody knew an equivalent existed. Design documents
pile up after the work they described has shipped. Conventions hold for a month
and then quietly stop. And two terminals open on the same repository will happily
edit the same file, because neither knows the other is there.

fankeel is a Claude Code plugin that carries a development discipline and states
it on every prompt rather than once at the top of a session. It holds a task, moves
it through five stages, keeps a capped note of what has been tried, and shows which
other live sessions are in the same files.

## Install

```
claude plugin marketplace add FanFantom9452/fankeel
claude plugin install fankeel@fankeel
```

Restart Claude Code afterwards. Nothing else is installed: no dependencies, and
the tests run on `node --test`, which is built in.

## Use

```
/fankeel
```

It lists what every live session in this repository is working on and asks what
you want to do — carry on, start a task, adopt one, stand it down, or clear out
entries whose terminal is long gone.

Before it asks anything it looks. Opening with "give me a task and a scope" and
nothing on screen is answerable in a repository you just opened and useless in a
directory holding five projects, where the honest reply is another question — and
a scope guessed to avoid that question is what makes the collision warnings
untrustworthy later. So `/fankeel` runs a scanner first:

```
$ node <plugin>/scripts/orient.js

fankeel orient — F:\workspace

registry: none at or above here. Starting a task creates one at F:\workspace.

5 under it:
  TypeDesk  git main, clean               370 files
  Waypoint     git feat/task-board, 1 untracked  463 files
  Roster        no git                         77 files
  KB            git main, 1 untracked         910 files
  notebin    git main, clean                97 files
```

Name a place and it goes there instead, breaking that one down to the level a
scope actually gets written at:

```
$ node <plugin>/scripts/orient.js Waypoint

named:
  Waypoint  git feat/task-board, 1 untracked  463 files

inside it:
  Waypoint/api/     134 files
  Waypoint/e2e/      93 files
  Waypoint/web/     199 files
  ...
  (and 12 files loose at the top)
```

For a single project it also says which of `CLAUDE.md`, `AGENTS.md`, `README.md`,
`TODO.md` and `CONTRIBUTING.md` are there — and says so plainly when none are —
and prints the last five commits, because what a project is in the middle of is
not visible in a listing of directories.

It writes nothing. A `scope` entry may be a file, a directory or a glob — a
directory covers everything under it, so `Waypoint/web/src` is one entry rather
than two hundred.

Every change to a registry entry goes through one script rather than being
hand-written — `task.js start`, `stage`, `scope`, `note`, `next`, `guard`, `down`,
`adopt`. It creates `.fankeel/.gitignore` with the directory, enforces the caps,
names a collision at the moment a scope is declared, and refuses rather than
guessing: no scope, no start. It was the last operation without a script, and it
failed the way unsupported steps fail — quietly, leaving no registry at all, with
the missing badge as the only symptom.

Starting a task does not then stop to ask whether to begin. The entry goes in at
`survey`, and taking stock is what `survey` is for, so it happens in the same
turn — otherwise the badge reads `[FANKEEL:SURVEY]` at the exact moment nothing
has been surveyed.

Starting a task puts this session in fankeel mode. From then on every prompt
carries the task, what has been tried, the other live sessions, and the rules for
the stage you are in:

```
FANKEEL ACTIVE — rework the 7d deviation colour ramp @ build
scope: statusline.ps1, statusline.sh, preview.ps1
next: wire the badge word into TokenBar

so far:
  - ANSI 256 has no true mid green; 46 to 83 to 120 is the only clean run
  - decided 12h for stale, not 24h - survives a night, not a forgotten window

also in progress:
  - retune the 5h ramp @ design  (scope: statusline.ps1)  << overlaps: statusline.ps1
  - triage the colour issues @ survey  (scope: README.md)  (last seen 16d ago)

stage rules:
  - Never stop silently mid-stage. End every step by asking what comes next, and always offer a pause.
  - Put a question’s background inside the question itself. Give every option its trade-off, recommended first.
  - Say what you actually did. A step you skipped, a test that failed, a thing you could not check — say so plainly.
  - Finish what you start. Do not stop where the happy path works and the rest is "later".
  - Follow the patterns already in this repository rather than your own defaults.
  - Anything genuinely deferred goes in TODO.md as one line pointing at where the detail lives — never as a comment nobody will find.
```

The rules are restated in full every turn rather than pointed at. A pointer is
only as strong as the salience of what it points at, and what it points at recedes
by thousands of tokens a turn. Only the current stage's rules are sent, never all
five stages', which is what keeps a per-turn restatement affordable — around 300
tokens loaded as above.

## Stages

| Stage | Produces |
|---|---|
| `survey` | a statement of what already exists |
| `design` | an approach someone agreed to |
| `build` | the change itself |
| `verify` | evidence, not confidence |
| `land` | a repository no dirtier than you found it |

### survey carries a scanner, not an instruction

The rule that says "check whether this already exists" is the kind that gets
agreed with and skipped, which is exactly why components get built twice. So
`survey` names a script instead, with its resolved path, and the rule requires
quoting the output:

```
$ node <plugin>/scripts/survey.js badge

fankeel survey — 23 tracked files, matching: badge

files whose name matches:
  lib/badge.js
  tests/badge.test.js

declarations:
  lib/badge.js:22  function badgeWord(stage, clash) {
  lib/badge.js:36  function writeBadge(claudeDir, sessionId, word) {
  ...

documentation:
  docs/decisions/fankeel-shell.md:96  ## Smaller calls, with their reasons
```

It reads `git ls-files` and the working tree on every run, so **nothing is
stored and nothing can go stale**. A written index of "what this project already
has" disagrees with the code within months and is then read back with confidence,
which is worse than having none. Declarations are found in JavaScript,
TypeScript, Vue and Svelte script blocks, PowerShell, Python, shell, Go, Rust,
C#/Java/Kotlin/Swift, Ruby, and CSS classes, custom properties and mixins, plus
markdown headings. Anything else is matched on filename alone. The patterns are
deliberately shallow, because the goal is to notice a name exists, not to parse
the language — a missed declaration costs one line of a report, and a real parser
would cost a dependency this plugin does not have.

"Nothing matched" is a finding, and the rule asks for the terms that were tried —
so the next person knows which synonyms were already ruled out.

A task starts at `survey`. At the end of a stage you are offered the next one,
staying put, or pausing — never told a stage is complete and left there. Short
tasks may skip forward, but the skip is said out loud, because skipping silently
is how `verify` gets skipped.

Each stage also carries one line about the **shape** of its output — `survey`
quotes the scanner rather than paraphrasing it, `build` says almost nothing
because the diff is the output, `verify` quotes the command and the line that
decided it. This is the dynamic half that an output style cannot do: the system
prompt is fixed for the session, and the stage is not.

`land` has no successor. What follows it is a new task, which is a decision rather
than a transition.

## Output styles

Three, set with the `fankeel-style` skill:

```
/fankeel:fankeel-style terse      # everyday
/fankeel:fankeel-style review     # audits
/fankeel:fankeel-style off        # back to Claude Code's default
```

Or just say it — "answers are too long", "省 token", "give me a review voice" —
and the skill picks itself up. That is the whole point of it existing: an output
style is the right mechanism and `/config` is where people never go.

| Style | For |
|---|---|
| `fankeel-terse` | Everyday work. Result first, no preamble, no tool narration, every identifier and error string verbatim. |
| `fankeel-pipeline` | Running the pipeline. Adds the question discipline — never wrap up silently, every question carries its own background and every option its trade-off. |
| `fankeel-review` | Reviews and audits. Findings only, one line each, most severe first, no praise and no redesigns. |

### Why a style rather than an injected ruleset

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

### Setting it without /config

`scripts/style.js` writes `outputStyle` into `settings.json` — the same field
`/config` writes, and nothing fankeel-specific: a style set this way survives
uninstalling the plugin, because it is the user's setting rather than this
plugin's state.

The script is careful with that file, because other tools write it too. Every
other key is preserved, the first change backs it up, a file that does not parse
is reported instead of overwritten, and the write goes through a temporary file
so an interruption cannot leave half a settings file.

**The gap.** Whether a running session picks up a `settings.json` change without
restarting is recorded as `SETTINGS_RELOAD_IS_LIVE` in that script. While it is
false, setting a style also puts a four-line digest on the fankeel session entry
and the hook injects it each prompt, so the voice starts immediately; the full
style takes over next session. Four lines rather than the whole file, because a
digest injected every turn accumulates — paying that to enforce brevity would be
self-defeating.

### What is deliberately not done

- **No `force-for-plugin: true`.** That flag applies a plugin's style
  automatically and overrides whatever the user chose. fankeel is opt-in per
  session and does not get to seize the voice of every session on the machine.
- **No style is set for the user.** The skill offers the three and waits. This
  changes the voice of every session on the machine, including ones they are not
  looking at.

The three always-on rules in the per-turn injection overlap `fankeel-pipeline` on
purpose. A style is the user's choice and a hook cannot see which one is active,
so moving those rules into the style would mean losing them whenever the user
picked something else. Three lines a turn is the cheaper price.

## Subagents

A subagent starts with its own context and none of the parent's. The per-prompt
injection never reaches it — that rides on the user's prompt, and a subagent does
not have one. So a `SubagentStart` hook hands it a brief instead: the task, the
scope, what its return value costs, and the voice digest if a style is set.
Background subagents get the same brief. One started with an isolated context
does not, which is Claude Code's decision rather than something to work around.

### Why this is the best-value text in the plugin

The arithmetic is lopsided in a way nothing else here is.

Everything a subagent **reads** costs input tokens in a context that is thrown
away the moment it finishes. What it **returns** costs output tokens — five times
the price — and then sits in the parent's context for the rest of the session,
competing for the window and pulling compaction forward.

So spending 280 tokens on a brief to take a thousand off a return value is worth
it every single time, and it is worth it even when nothing else about the
delegation changes.

### What it deliberately is not

- **Not the stage rules.** A subagent is not running the pipeline; it is doing one
  bounded job inside somebody else's stage. "Commit the reason, not the diff" is
  instructions for work it is not doing.
- **Not a registry entry.** A subagent is not a session and does not own a task.
  Giving it one would put a second claimant on its own parent's files.
- **Not a replacement for what compressing agents already do.** If a subagent
  already knows how to return little, this adds the thing it cannot know: which
  task it belongs to and which files are spoken for.

The scope guard reaches subagents on its own — `PreToolUse` fires inside them —
so a subagent editing a file another live session claimed hits the same block the
parent would.

## Task memory

Two fields on the task, both capped in code: at most five notes of 100
characters, and one `next` line of 120.

```json
"notes": ["ANSI 256 has no true mid green; 46 to 83 to 120 is the only clean run"],
"next":  "wire the badge word into TokenBar"
```

The caps are the design, not a limitation. Claude Code already remembers in four
places — `CLAUDE.md` for project conventions, its own memory directory for durable
facts, git history for what landed and why, the compaction summary for earlier in
the session. A fifth store would overlap all of them while being the one nobody
reviews, which is how a memory file turns into a source of confident wrong
answers.

What none of the four holds is the state of a task **in flight**: what was tried
and failed, what was decided along the way, what to pick up next. That is all this
keeps. It is never version-controlled and it dies when the task is stood down; if
a note still matters after the task lands, it was never a note, and `land` is
where it moves to one of the four.

## The mode never switches itself off

A session is in fankeel mode exactly when it owns an active task. There is no
separate flag to disagree with, and no way to be in the mode without having said
what you are working on.

Nothing turns it off on a timer or at the end of a session. Claude Code sessions
resume — a resumed or compacted session is the same session — so a hook clearing
the flag at session end would drop you out of the mode behind your back and the
mode would appear to switch itself off at random. Only standing a task down ends
it.

## Collisions are about files, not names

Two sessions collide when their declared **scopes** overlap. One person writes
"colour ramp" and the other writes "fix 7d"; a check on the name sees two
unrelated tasks, while the file is what actually gets overwritten.

Scope entries are globs. `src/**` and `src/a.ts` overlap whichever was declared
first, `src/*.ts` stops at one path segment, and a bare directory name covers what
is under it.

By default an overlap is **reported, not blocked** — the warning rides on every
prompt and `[FANKEEL:CLASH]` sits in the statusline.

### Making it block

A warning that only ever warns is an instruction, and instructions get agreed
with and skipped. So a session can ask for the overlap to be enforced, by putting
one field on its own entry:

| `guard` | What an edit inside another live session's scope does |
|---|---|
| absent | Nothing. The warning is all you get. This is the default. |
| `"ask"` | Raises a permission prompt naming the task that holds the file. |
| `"deny"` | Is refused outright. |

It is off by default on purpose. A block is only as good as the `scope` field it
reads, nobody yet knows how accurately scope gets declared, and a plugin whose
first act is to lock you out of your own repository does not get a second chance.
Turn it on for the sessions that need it, and `"ask"` before `"deny"`.

Two rules keep it from becoming a lockout:

- **A stale claim never blocks.** A terminal killed yesterday would otherwise
  hold a file shut until someone edited the JSON by hand.
- **The older claim holds.** When both sessions declared the file, the newer one
  yields — so two sessions that both named it cannot block each other into a
  stalemate.

## Stale entries

A terminal killed outright leaves an entry claiming to be in progress. Rather than
expire it — which would mean the mode switching itself off — fankeel annotates it:

```
  - retune the 5h ramp @ build  (last seen 19d ago)
```

That is the whole mechanism. Being stale writes nothing, deactivates nothing and
hides nothing. If the owning session comes back, its next prompt refreshes the
timestamp and it stops being stale. `/fankeel` offers to clear genuinely dead
entries, and only ever on your say-so.

## Statusline

fankeel writes one word to `~/.claude/modes/<session_id>/fankeel`.
[TokenBar](https://github.com/FanFantom9452/ClaudeCodeCLI-TokenBar) renders any
flag it finds there, so no change is needed on that side:

```
[FANKEEL:SURVEY]   [FANKEEL:DESIGN]   [FANKEEL:BUILD]   [FANKEEL:VERIFY]   [FANKEEL:LAND]   [FANKEEL:CLASH]
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
                          survey = 60; design = 62; build = 68; verify = 75; land = 81
                          clash = 196 }
```

```sh
# ~/.claude/tokenbar-config.sh
WORD_COLORS="fankeel:survey=60 fankeel:design=62 fankeel:build=68 fankeel:verify=75 fankeel:land=81 fankeel:clash=196"
```

Dark slate through to sky blue as the stage advances, and `clash` in red — the one
badge on that line that is a warning rather than a state.

## Files it writes

| Path | In version control | Written by |
|---|---|---|
| `.fankeel/sessions/{session_id}.json` | No — `.fankeel/.gitignore` excludes it | `/fankeel`, and the hook for `updated` |
| `.fankeel/.gitignore` | Yes | Created with the directory |
| `~/.claude/modes/{session_id}/fankeel` | n/a | The hook, every prompt |

State lives in the project rather than under `~/.claude/` so that a repository
checked out twice on one machine gets one registry rather than two. Only the
volatile half is excluded, so anything added under `.fankeel/` later is versioned
by default — but task memory is deliberately not one of those things, and lives on
the entry inside `sessions/`.

The hook writes exactly one registry file: this session's own. It never writes
another session's, and never deletes one.

## Uninstall

```
claude plugin uninstall fankeel@fankeel
claude plugin marketplace remove fankeel
```

`.fankeel/` is left in place — it is the project's, not the plugin's. Delete it by
hand if you want it gone. Stale `~/.claude/modes/<session_id>/fankeel` flags are
pruned after 30 days while the plugin is installed; after uninstalling, remove any
that remain.

## Development

```
npm test
claude plugin validate .
```

`lib/` is pure logic, tested directly. `hooks/` is where stdin, stdout and process
exit live, and both hooks are tested as subprocesses with real payloads.

Both exit 0 on every path, including every error path. A `UserPromptSubmit` hook
that throws blocks the prompt it was called for and a `PreToolUse` hook that
throws blocks the edit, and a plugin that can wedge your terminal is worse than no
plugin.

`node scripts/todo-check.js` says whether [TODO.md](TODO.md) is still an index —
every link resolving, no entry carrying detail that belongs in the file it points
at. The `land` stage rules call for it, because a plan deleted at `land` is a link
that just died.

Why things are the way they are is in
[docs/decisions/fankeel-shell.md](docs/decisions/fankeel-shell.md).
