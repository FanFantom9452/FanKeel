---
status: current
last_verified: 2026-09-04
source_of_truth: lib/registry.js, lib/render.js, lib/context.js, lib/dirty.js, scripts/task.js, hooks/touch.js, hooks/inject.js, hooks/carry.js, hooks/gate.js, hooks/resume.js
---

# The registry, and what it remembers

Where the files live, what is in version control, the two capped memory fields, and what the injected block says when a session has been compacting.

# Files it writes

One registry for the workspace, one docs tree per repository:

```
workspace/                     <- Claude Code opened here
├── .fankeel/
│   ├── .gitignore          sessions/, map.md, build/
│   └── sessions/           the registry, one file per session, never committed
├── Waypoint/               a repository
│   ├── .fankeel/
│   │   └── docs.json       its docs tree, committed with the documents
│   └── docs/
└── KB/
    └── .fankeel/docs.json  its own
```

| Path | In version control | Written by |
|---|---|---|
| `.fankeel/sessions/{session_id}.json` | No — `.fankeel/.gitignore` excludes it | `task.js`; `inject.js` / `resume.js` for `updated` and `clock`; `inject.js` for `burn`; `touch.js` and `inject.js` for `claims`; `gate.js` and `resume.js` for `gateAt` and `waited`; `leave.js` for `ended`, `model` and `usage`, once, at `SessionEnd` — first seen from the hooks 2026-09-01 (a `gateAt`, in a neighbouring project's registry) and 2026-09-02 (a `waited`, here), both in processes started after the manifest carried `gate.js` |
| `.fankeel/sessions/{session_id}.lock` | No — same line covers it | any writer, for the length of one change |
| `.fankeel/.gitignore` | Yes | `lib/registry.js:200` creates it holding `sessions/` alone; `scripts/map.js:37` adds `build/` and `map.md`, on every map run rather than at creation |
| `<project>/.fankeel/docs.json` | Yes | `docs.write`, per repository |
| `~/.claude/modes/{session_id}/fankeel` | n/a | `task.js`, on the turn it changes; `inject.js`, every prompt |
| `~/.claude/modes/{session_id}/fankeel.lead` | n/a | `task.js`, on the turn it changes; `inject.js`, every prompt |
| `<configDir>/fankeel/station.html` | n/a | the station page, rewritten by `hooks/leave.js` and by `scripts/station.js` |

The registry is found by walking up for **`.fankeel/sessions/`**, not for
`.fankeel/`. The marker has to be the thing the registry owns, because the two
things under that directory belong at different levels: one registry at the level
the projects share, so two sessions in two repositories can see each other, and
one docs tree per repository, version-controlled with the documents it describes.

Looking for the parent directory found both, and declaring a docs tree for one
project quietly created a second registry for anyone who opened a session inside
it — with the first still live one level above. Neither side could see the other
and both looked healthy, which is the worst way for a collision warning to fail.

Which docs tree applies comes from the task's **project** and the first path
segment of every file it has claimed, not from where the session is open: a
project of `Waypoint` means `Waypoint/.fankeel/docs.json`, and a claim under a
second repository brings that repository's tree in as well.

State lives in the project rather than under `~/.claude/` so that a repository
checked out twice on one machine gets one registry rather than two.

# Task memory

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
keeps. It is never version-controlled and it dies when the task is stood down —
or renamed, because `task.js task` clears `notes` and `next` along with `claims`
when one task becomes the next. If a note still matters after the task lands, it
was never a note, and `land` is where it moves to one of the four.

A third field is written by nobody the user talks to. `claims` holds every file
this task has edited — at most sixty, each recorded whole and never truncated,
because nothing here is a path a human retypes. The two writers reach that cap
from opposite directions. A path arriving on its own drops the oldest to make
room (`lib/registry.js:551`); a git pass holding more than sixty is refused
whole rather than trimmed (`lib/dirty.js:173`), because trimming it would evict
every claim an edit earned and put build output in its place.
[collisions.md](collisions.md) is the page for that. Two hooks append to it,
which is why the table above lists hooks rather than a command as its writer.
`hooks/touch.js` adds a path the first time an edit lands on it.
`hooks/inject.js` adds, once a prompt, every path git reports dirty whose
mtime is later than the task's `started` — the writes that reached the disk
without any tool a hook matches, a `sed` or a `node -e` or a build script. Which
of the two recorded a path is not distinguishable afterwards and does not need to
be: the field says where the work went. No subcommand sets it. `adopt` carries it across, because where the work went belongs
to the task rather than to the session, and `task` clears it, because a task that
has just been renamed has touched nothing yet.

# What a stage cost

Three fields, none of them typed by anyone, and all three cleared when `task`
renames the task — for the reason `burn` is cleared: stage names come round
again, so a first sighting left behind reports two tasks as the cost of one
stage.

```json
"burn":   { "survey": [120000, 342000] },
"clock":  { "survey": [1756659679797, 1756660399797] },
"waited": { "survey": 240000 }
```

`waited` is a gate that stayed open four minutes. Until 2026-09-02 no hook had
written one — the one record carrying it, session `cb8cee7b`'s
`{"verify":28660}`, was a stamp run by hand while the field was being built —
for the reason under **The pair that measures it** below; since then every
session of a process started after the install carries one.
`skills/fankeel/SKILL.md` shows the same record without it, because that example
is a record rather than a set of shapes.

`burn` is tokens and `clock` is milliseconds, and they are the same shape for the
same reason: the first sighting is gone the moment it is not written down, and
one sighting is a position rather than a distance. Both report `null` for a stage
sampled once, and for one sampled backwards — which `burn` reaches whenever
compaction moves the figure down.

**Where they are written is where they differ, and it is deliberate.** `burn`
sits inside `touch()`'s guard on the token figure. `hooks/inject.js` passes one;
`hooks/resume.js` passes none, because an answer to an `AskUserQuestion` is a
tool result rather than a prompt — so a stage that ends at a gate refreshes
`updated` and records no burn at all. A clock has no threshold to fall below, so
it is written beside `updated` and every touch is a sighting.

`waited` is a running total rather than a pair, because a stage may open more
than one gate and what is worth knowing is their sum. A gate that opened and was
answered inside one millisecond still adds its zero: leaving it out would read,
downstream, exactly like a stage that never opened one.

**The pair that measures it is `PreToolUse`/`PostToolUse` on
`AskUserQuestion`, and both halves run — in a process that started after the
manifest carried `hooks/gate.js`.** Hook-written `waited` appears in this
repository's registry from 2026-09-02, in every session of such a process —
three by the time this was written, this one's design gate among them: session
`922c64a8`, `{"design": 20828}`, stamped by `gate.js` and folded in by
`resume.js` twenty seconds later. The same day's
[process-state review](reports/2026-09-02-process-state-review.md) found
a `gateAt` the hook had stamped in a neighbouring project's registry, in a
process begun eight hours after the install.

**Why it was silent for two days is settled, and it is the registration.**
Claude Code reads its hook list once, at process start, so a `plugin.json` that
gains an entry afterwards registers nothing in that process until it restarts —
and `/clear` starts a session without starting a process. The process that ran
this work began 2026-08-31 23:55:39, two hours before the manifest carrying the
entry; every session it opened from then on, three of them under `/clear`, ran
`resume.js` at every answer and `gate.js` at none, while a fixture control ran
`gateOpen` against a scratch registry and the stamp appeared. The entry being
plainly there in the installed manifest is what made this easy to talk oneself
out of: being there is not the same as being loaded.

**It is silent no longer.** `hooks/resume.js` reads the record after the answer
and before it closes the gate, so a record with no `gateAt` at that moment is a
`PreToolUse` that did not run, and the short block it sends back carries one
`gate:` line saying so — that `waited` will stay empty for as long as the process
lives, and that a restart is what loads the hook. It reads `gateAt` rather than
`waited`, because `gateClose` returns success without writing when the record has
no `stage` or the interval comes out negative, so a missing `waited` is two hooks
confounded where a missing `gateAt` is one. It is stateless, like `context:` —
sent at every answer, and the skill says to pass it on once. Nothing else could
have noticed: `waitedOf` hides an absent total exactly the way it hides a stage
that opened no gate.

`adopt` carries `waited` across and not `gateAt`: that is an interval with one
end, and the next answer in the adopting session would close it against a stamp
from another one.

`Stop` was the obvious alternative and is the wrong one, which is why the pair
was built this way and why replacing it is not simply a matter of moving to
`Stop`. `Stop` fires when Claude finishes responding, and a session pausing on a
tool call has not finished responding — this pipeline's gate is a tool call, so
`Stop` never fires at one. It would have measured the typing gap between two
turns and missed the wait this pipeline actually accumulates.

`gateAt` is the one transient field here. A `gateAt` nothing consumes — the
session dies at a gate — is overwritten by the next one rather than repaired:
the interval it measured has no end, so there is nothing to recover.

None of the three reaches the injected block, which is capped at 2400 characters
and renders `build` at 2394. `task.js show` prints `burn:` and `time:`, and the
stage transition names what the stage it left cost, which is the one moment the
figure is finished.

# What ending records

Three more fields, written once, by `hooks/leave.js` at `SessionEnd`, and by
nothing else:

- `ended` — `{ at, reason }`, `reason` one of `clear`, `logout`,
  `prompt_input_exit`, `other`. Present on a record that is still
  `active: true` when the session ended without the task being stood down.
- `model` — the model that produced the most output tokens in the transcript,
  written at the same moment.
- `usage` — `{ requests, models: { <id>: { input, output, cacheRead,
  cacheWrite5m, cacheWrite1h } }, subagents? }`, `requests` and `models`
  summed once per `requestId` over the whole transcript and staying the
  session's own. `subagents` — `{ agents, requests, models, wallMs }` — is
  present when the session ran agents: it sums every transcript under the
  session's own `subagents/` directory, one entry per Background Agent or
  Workflow agent, with the sidechain flag counted rather than skipped, since
  every line in those transcripts carries it. Absent when neither the
  transcript nor any agent transcript could be read; with only the agents
  readable, `requests` is 0, `models` is empty and `model` is not written.

# Reading it from outside

Every reader here but one filters on `active === true`, and nothing deletes an
entry — `down` and `clear` both deactivate, so a claim put down by mistake can
still be adopted back with its notes intact. The two together mean the registry holds
every task the workspace has ever run while no view showed any of them: 53 of 54
entries on this repository the day the flag below was written, 26 of them
carrying a `burn` figure nothing could print.

```
node scripts/task.js show --all
```

The whole directory, newest first by `updated`, one line an entry — the date, the
stage it reached, the summed `burn` and `clock` over its route, then the task. The
sums rather than the per-stage breakdown `show` prints for the entry a session
owns: a breakdown is for reading one task, a total is for comparing two. A stage
sampled once has no distance to report, so a task too short to be sampled twice
shows a dash rather than a zero.

Uncapped, and the flag is why. It was capped at 25, with the `... and N more, not
listed` line copied from `scripts/survey.js` — but 25 is that script's
`DEFAULT_MAX`, the number it prints with no flag, and its own `--all` sets the cap
to `Infinity`. The borrowed half was the wrong half: a flag whose entire meaning
is *every one of them* was truncating the one reader who had typed it, and on this
repository the tail it cut was 30 of 55 entries.

The registry does only grow — `down` and `clear` both deactivate and nothing
deletes — which is the argument for a bound somewhere, and three things already
carry it. The `every entry:` header above is the count for anyone who does not
want to scroll. `show` without the flag still filters on `active`. And a reader
who wants the first N has `head`, which is why there is no `--max N` here to
reinvent it.

The **rows** are what is uncapped. Each row is bounded at 120 characters, and the
two are not the same promise: `--all` means every entry, and it never meant every
character. Uncapping put thirty more rows on screen and that is what exposed the
column with no width of its own — the task is last precisely so the columns
before it stay aligned, which is also what makes it the only one able to push a
row past the terminal. A wrapped row's second line starts at column 0, where it
reads as a row of its own and the date column stops being scannable. Measured
here the day after the 55 above, one entry further on: 32 of 56 rows were over
100 characters and the widest was 189, while the median task ran 68. That
measurement is what moved the bound from 100 to 120: at 100 the task column got
62 characters and the median row lost six of them to a `…`, which is more than
half the listing losing its tail. At 120 it gets 82 and the median survives
whole; the widest still does not, and the `…` still says where.
The whole task is still in the entry's own file, and `show` without the flag
still prints this session's in full.

The bound is on the line rather than on the task because the columns ahead of the
task may yet change width; `entryLine` measures the ones it actually rendered and
gives the task what is left. The 80-column argument that first picked 100 does
not survive the arithmetic — a 100-character row already wraps at 80, so nothing
that was being held was given up by widening it.

The header carries the one number no reader had: how many files were entries by
name and did not parse. `readFile` turns a parse failure into null and every hook
then returns quietly, which is right in a hook — a miss is what a session not
using the plugin looks like, and nearly always is — and leaves a corrupt entry
visible in no view at all. `readAll` counts it on the way past, so the one caller
that is a person asking rather than a hook firing can say so out loud.

`--all` asks the operating system nothing. `active` is what an entry says about
itself, where the `other live sessions` block above it is `lib/live.js` measuring
a process. An entry listed here may have no terminal behind it, and putting that
claim down is what `/fankeel` → **Clear out** is for.

# The mode never switches itself off

A session is in fankeel mode exactly when it owns an active task. There is no
separate flag to disagree with, and no way to be in the mode without having said
what you are working on.

Nothing turns it off on a timer or at the end of a session. Claude Code sessions
resume — a resumed or compacted session is the same session — so a hook clearing
the flag at session end would drop you out of the mode behind your back and the
mode would appear to switch itself off at random. Only standing a task down ends
it.

`/clear` is the third case, and it is the one that behaves the other way. It
keeps the process and takes a **new** session id: `<config>/sessions/<pid>.json`
is rewritten, the old id leaves the running set, and the entry it owned is judged
dead by every reader at once while staying `active: true`. Nothing is corrupted
and no collision appears — the task simply stops being read.

`hooks/carry.js` is what says so. It runs on `SessionStart` with `matcher:
"clear|fork"`, and on the first prompt of the new session it names the task,
where on its route it got to, its notes and its `next`, with the `adopt` command
already carrying both ids. A cleared session's predecessor is certainly gone; a
forked one might still be running, and it is the liveness check at `carry.js:67`
that keeps the offer from firing over a session that is still there.

**Stand the task down before clearing and there is nothing to offer.** An entry
cleared the other way round is put down by `/fankeel` → **Clear out**, which
never takes the task with it.

| continuation | session id | the entry |
|---|---|---|
| `resume` | the same | still read, still yours |
| `compact` | the same | still read, still yours |
| `/clear` | **new** | active, unread, offered back by `hooks/carry.js` |

# When compaction has already cost something

```
context: 1.1M tokens dropped to compaction so far, 308k in play now,
--session 302790e6-e652-4cab-af1c-e45d239516cc. Start a fresh session before the
next one. A new terminal and /fankeel → Adopt carries this task over with its
notes and its route.
```

Read from the transcript, which records what every compaction cost:

```json
"compactMetadata": { "trigger": "manual", "preTokens": 479852,
                     "postTokens": 24905, "cumulativeDroppedTokens": 1120198 }
```

Cumulative, so the most recent entry is the whole answer — no counting, and no
need for the window size, which neither the hook payload nor the transcript
carries. The trigger is that a compaction happened at all: one is already proof
the window filled, which is what a percentage would only be a proxy for.

The session id rides this line and only this line. It is disclosed in the `init`
block, which a session sees only while it has no task; once it owns one the block
never repeats it, so the session that most needs it is the one that cannot get
it — after a compaction the id is out of context and every `task.js` call needs
`--session <id>`. This line is already conditional on something having been
dropped, which is exactly that case, so a session that has never compacted still
has the id where it first saw it and pays nothing.

Only the last 512KB of the transcript is read, before every prompt, so a
thirteen-megabyte session costs the same as a fresh one. A compaction older than
that window reads as none — which is the right failure, since it means a great
deal has happened since without another one.

A statusline can show the percentage. What it cannot know is that there is a task
in flight, or that **Adopt** moves it — task, project, claims, stage, route, notes,
`next`, and what the stages have cost in wall-clock — into a fresh session in one
step.

**The cost history is where that list stops being a copy.** `clock` and `waited`
measure the wall, which does not care which session read it, so they go over.
`burn` measures *a session's own context*, and its two slots are sightings of
one: subtract the source's first from the adopting session's latest and the
answer is a distance between two different rulers — negative, and so silently
`null`, or positive and carrying the whole of the new session's baseline. It is
left behind, and a stage adopted mid-flight reports its burn from the adopt
onward.

`clock` goes over as a **distance with a new origin**: `adopt` writes
`[stamp - clockOf(source, stage), stamp]`, so the stage keeps what it cost and
loses the gap between the source falling quiet and somebody picking it up. That
gap is already reported twice — by `updated`, and by the `(last seen 16d ago)`
line — and a third telling would bill a stage for the fortnight nobody was on
it. `gateAt` does not go over at all: it is an interval with one end, and the
next answer in the adopting session would close it against a stamp from another
one.

The hook writes exactly one registry file: this session's own. It never writes
another session's, and never deletes one.

# One writer at a time

Writing the file is atomic — a sibling, then a rename — but reading it, changing
one field and writing it back is not, and that is what every writer here does.
Four of them are registered in hooks. `inject.js` writes
on every prompt — once for `updated`, and once more for every new path the git
pass claims, since `lib/dirty.js:180` calls `addClaim` per path and each one
takes the lock — in every session on the machine. That second number is usually
zero after a task's first prompt, because `covers` skips a path already held.
`resume.js` writes once per answered question, and `gate.js` once per question
asked, in a process that registered it — the reason above — so four writers
contend here, and three in a process that did not.

`touch.js` fires on every edit but writes on almost none of them: it
returns at `hooks/touch.js:42` when the path is already claimed, which is what
makes a task editing one file two hundred times cost the registry one write. Measured, two processes adding twenty
claims each kept 20 to 24 of the 40, and every one of those writes returned
success.

So a change to one record is taken under `sessions/{session_id}.lock`, a
directory rather than a file, because a holder that dies leaves no open handle
behind. This is what git does with `.git/index.lock`. It is **advisory** —
nothing enforces it, and it works because every writer goes through `update` or
`replace` in `lib/registry.js`, both of which take it. A record edited by hand
defeats it, the way it defeats everything else here.

Going through the module was the rule for a long time and it was not enough.
`writeSession` is in the same module and takes no lock — it is the atomic write
the two above are built on — and nine writes in `scripts/task.js` called it
directly, so `stage`, `task`, `route`, `guard`, `down`, `clear`, `start` and
`adopt` each read the record, changed a field and wrote it back with nothing
holding the file. A claim landing in that window was put back the way it was.
Fixed 2026-08-29; the rule is the entry point, not the file it lives in.

A writer waits up to a second in five-millisecond steps, and a lock older than
five seconds is treated as abandoned and broken. Both numbers are measurements
rather than tastes: the longest legitimate hold is 8.6ms, and no writer reached
the wait cap even with eight processes on one record. A writer that does reach it
gives up rather than writing anyway — a dropped claim comes back on the next edit
to that path, where a clobbered record does not.

# The id the hooks use

Every hook reads `payload.session_id`, and the entry it looks for is that id plus
`.json`. An entry written under any other id is one no hook will ever find — and
every one of them is silent about it, correctly: a miss is what a session that
never used the plugin looks like, which is nearly always what it is.

That cost one session two hours. A background task's output directory carried a
second session id, in the same shape as the real one, and it went into every
`task.js` call while the hooks read the other. No injections, no claims, and a
statusline badge under an id the statusline does not read.

Two things close it, both upstream of the hooks:

| | |
|---|---|
| `scripts/task.js` | `--session` is checked against Claude Code's own `<config>/sessions/<pid>.json`. An id refused is one the scan did not find **while finding others**, and the message lists those with the directory each was opened in. Two results allow: a directory that cannot be read, and a scan that found nobody at all. Neither is evidence, because a refusal must never come from a failed measurement — and a scan that cannot see the session doing the asking has failed, whatever it returned. `lib/live.js:124` keeps the same rule for the same directory. |
| `hooks/inject.js` | a `/fankeel` prompt is answered with the `init` block: this session's id — the one that hook is itself holding — and the rules for the step before there is a task. |

`clear <id>` and `adopt <id>` take the other session's id positionally rather
than through `--session`, so a dead neighbour is still reachable. That is what
those two commands are for.

[Back to the index](README.md) · [Back to the front page](../README.md)
