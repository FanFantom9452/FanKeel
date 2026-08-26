---
status: current
last_verified: 2026-08-26
source_of_truth: lib/stages.js, lib/render.js, skills/fankeel-survey/SKILL.md, skills/fankeel-design/SKILL.md, skills/fankeel-plan/SKILL.md, skills/fankeel-build/SKILL.md, skills/fankeel-verify/SKILL.md, skills/fankeel-audit/SKILL.md, skills/fankeel-land/SKILL.md, scripts/residue.js
---

# The pipeline

What `/fankeel` does, the seven stages, how a route through them is chosen for
one task rather than picked from a menu, and the steps inside each stage.

# Use

```
/fankeel
```

It lists what every live session in this repository is working on and asks what
you want to do — carry on, start a task, adopt one, stand it down, or clear out
entries whose terminal is long gone.

Before it asks anything it looks. Opening with "give me a task" and nothing on
screen is answerable in a repository you just opened and useless in a directory
holding five projects, where the honest reply is another question and the
exchange costs two turns before any work starts. So `/fankeel` runs a scanner
first:

```
$ node <plugin>/scripts/orient.js

fankeel orient — F:\workspace

registry: none at or above here. Starting a task creates one at F:\workspace.

5 under it:
  Waypoint  git feat/task-board, 1 untracked  463 files  today
  KB        git main, 1 untracked             910 files  3d ago
  TypeDesk  git main, clean                   370 files  1mo ago
  notebin   git main, clean                    97 files  1mo ago
  Roster    no git                             77 files
```

Most recently committed first, with the age on every row so the order is
explicable rather than merely different. In a directory of five, the one touched
this morning is almost always the one being asked about.

The skill asks with `AskUserQuestion` rather than in prose — which project and
what the task is, in one call with the options already on screen.
Making someone retype a row of a listing they can see is the same waste as asking
with nothing on screen at all.

Name a place and it goes there instead, breaking that one down a level so what it
is made of is on screen too:

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

It writes nothing. Orientation that changes what it is describing is not
orientation.

Every change to a registry entry goes through one script rather than being
hand-written — `task.js start`, `task`, `stage`, `note`, `next`, `guard`, `down`,
`adopt`. It creates `.fankeel/.gitignore` with the directory, enforces the caps
and refuses rather than guessing. It was the last operation without a script, and
it failed the way unsupported steps fail — quietly, leaving no registry at all,
with the missing badge as the only symptom.

It also sets the badge itself on `start`, `task`, `stage`, `adopt` and `down`.
The hook runs *before* a prompt, so a badge left to it alone appears only when the
user types again — and for that whole gap, turning the mode on is indistinguishable
from failing to turn it on.

Starting a task does not then stop to ask whether to begin. The entry goes in at
`survey`, and taking stock is what `survey` is for, so it happens in the same
turn — otherwise the badge reads `▌FANKEEL SURVEY` at the exact moment nothing
has been surveyed.

Starting a task puts this session in fankeel mode. From then on every prompt
carries the task, what has been tried, the other live sessions, and the rules for
the stage you are in:

```
FANKEEL ACTIVE — rework the 7d deviation colour ramp @ build  (4 of 7)
route: survey → design → plan → [build] → verify → audit → land
class: architectural — a new subsystem, or a change to an interface something else depends on.
project: Waypoint
touched: statusline.ps1, statusline.sh, preview.ps1
next: wire the badge word into TokenBar

so far:
  - ANSI 256 has no true mid green; 46 to 83 to 120 is the only clean run
  - decided 12h for stale, not 24h - survives a night, not a forgotten window

also in progress:
  - retune the 5h ramp @ design  (touched: statusline.ps1)  << overlaps: statusline.ps1
  - triage the colour issues @ survey  (touched: README.md)  (last seen 16d ago)

<plugin> = C:\Users\you\.claude\plugins\cache\fankeel\fankeel\0.31.0
stage rules:
  - Never end a step silently or in prose. Ask with AskUserQuestion — next stage, stay, and pause at least, never dropping the pause. Option one is the approval: say what it approves.
  - The background goes inside the question call — in the option descriptions, beside the option each belongs to, never as a paragraph in the stem. The stem is one line. Recommended option first.
  - Say what you actually did. A step you skipped, a test that failed, a thing you could not check — say so plainly.
  - Write tool input in literal characters, never as \uXXXX escapes: escaped calls corrupt mid-word and fail to parse. Name a code concept in code — `overdue`, not a translation of it.
  - Finish what you start. Do not stop where the happy path works and the rest is "later".
  - From a plan (the fankeel-build skill has the loop): `node <plugin>/scripts/ledger.js --plan <f> show` first; never redo a task it lists complete. One reviewer per task, then `complete <n> "<what landed>"`. After a compaction it beats memory.
  - Decide rather than stall, recording `Ruling: what — why — costs if wrong`. Only four things stop the loop: irreversible, security-sensitive, a side effect outside this workspace, every path forward a guess.
  - Every changed line traces to the ask. Follow the patterns here; do not improve adjacent code, comments or formatting in passing. Remove what your own change orphaned; dead code you did not create gets mentioned, not deleted.
  - Anything deferred goes in TODO.md as one line pointing at the detail, never a comment nobody will find.
  - A new document is the last resort: use an existing page, or write a generator when it derives from code. One written carries status, last_verified and source_of_truth.
  - Output: one line per file, then the question. Under 80 words; the diff is the output, prose for what it cannot show.

output shape:
  - path +12/-3 — what changed
  - path (new) — what it is

  ledger: <n> of <m> complete
  deferred: <TODO.md line, or omit this line>
  then AskUserQuestion
```

The rules are restated in full every turn rather than pointed at. A pointer is
only as strong as the salience of what it points at, and what it points at recedes
by thousands of tokens a turn. Only the current stage's rules are sent, never all
seven stages', which is what keeps a per-turn restatement affordable — 2873
characters loaded as above, about 717 tokens.

It grows when growing it is worth something, because the two sides of that trade
are not priced the same. This block is read once a turn by the model and never by
the user; the answer it shapes is read by the user every time. The only limit
worth keeping is whether the block still gets read to the end — past that point a
preamble is skimmed, and skimmed rules are no rules.

Every stage's last rule is the shape of its output, and they are all the same
shape: what the stage produced, then the question. What differs is the form and
how much room it gets — 120 words for a survey, 200 for a design, 80 for a build,
one line per finding for an audit, one paragraph for a land. A number can be
missed; a direction cannot be, and *in the fewest words that let someone say yes
or no* let a design stage run to nine hundred.

Picking the first option *is* the approval, which is why the rule says the option
has to name what it approves. "Build it" is a stage; "build this approach —
due-rules.js first, then the four pages" is a decision someone can make. It
matters most after `design`, where the product is a proposal and the gate is the
only place it gets accepted.

The first rule names the tool, and that is the point of it. It used to say *end
every step by asking what comes next*, and a real design stage duly ended with
three numbered options in a paragraph — which is asking, and is also the failure:
the options were on screen and the reader still had to type one back. Naming
`AskUserQuestion` in the skill file was not enough, because a skill file is read
once at session start and this rides every prompt.

# The answer is not a prompt

That last claim had a hole in it, and a real session found it. *Every prompt*
means every prompt somebody types. An answer to an AskUserQuestion comes back as
a tool result, and `UserPromptSubmit` does not fire for a tool result — so a
session driven the way this pipeline asks to be driven is the one session where
the block never returns. One run spent 511 transcript entries and forty-four
minutes on a single injection.

The step that broke was the one where another skill's output contract — *End
with the only metric that matters: `net: -<N> lines possible.`* — was loaded
twelve entries before generation, competing with rules five hundred entries
behind it. It ended in prose with no question at all, and the user had to type
`CONTINUE` to get the pipeline moving again. The turn after that had the block
back, and gated properly. Eleven of the twelve steps in that session ended in an
AskUserQuestion; the twelfth is the one that had a competing contract nearer to
hand than its own rules.

So there is a second hook. `PostToolUse` matched to `AskUserQuestion` — and to
nothing else — sends a short form back the moment an answer lands:

```
FANKEEL ACTIVE — rework the 7d deviation colour ramp @ build  (4 of 7)
route: survey → design → plan → [build] → verify → audit → land
class: architectural — a new subsystem, or a change to an interface something else depends on.

<plugin> = C:\Users\you\.claude\plugins\cache\fankeel\fankeel\0.31.0
stage rules:
  - Never end a step silently or in prose. Ask with AskUserQuestion — next stage, stay, and pause at least, never dropping the pause. Option one is the approval: say what it approves.
  - The background goes inside the question call — in the option descriptions, beside the option each belongs to, never as a paragraph in the stem. The stem is one line. Recommended option first.
  - Say what you actually did. A step you skipped, a test that failed, a thing you could not check — say so plainly.
  - Write tool input in literal characters, never as \uXXXX escapes: escaped calls corrupt mid-word and fail to parse. Name a code concept in code — `overdue`, not a translation of it.
  - Finish what you start. Do not stop where the happy path works and the rest is "later".
  - From a plan (the fankeel-build skill has the loop): `node <plugin>/scripts/ledger.js --plan <f> show` first; never redo a task it lists complete. One reviewer per task, then `complete <n> "<what landed>"`. After a compaction it beats memory.
  - Decide rather than stall, recording `Ruling: what — why — costs if wrong`. Only four things stop the loop: irreversible, security-sensitive, a side effect outside this workspace, every path forward a guess.
  - Every changed line traces to the ask. Follow the patterns here; do not improve adjacent code, comments or formatting in passing. Remove what your own change orphaned; dead code you did not create gets mentioned, not deleted.
  - Anything deferred goes in TODO.md as one line pointing at the detail, never a comment nobody will find.
  - A new document is the last resort: use an existing page, or write a generator when it derives from code. One written carries status, last_verified and source_of_truth.
  - Output: one line per file, then the question. Under 80 words; the diff is the output, prose for what it cannot show.

output shape:
  - path +12/-3 — what changed
  - path (new) — what it is

  ledger: <n> of <m> complete
  deferred: <TODO.md line, or omit this line>
  then AskUserQuestion
```

Where the task is, the rules for the stage, the shape — 1762 to 2427 characters
depending on the stage and the class, around 500 tokens. Deliberately not the full block: the
touched list, the notes and the other live sessions cannot have moved between a question
going out and its answer coming back, they are already in the context a few
thousand tokens up, and a stage runs through several questions. Repeating them
each time leaves a pile of copies disagreeing about which stage this is.

The cost is not what it looks like. The whole conversation is sent on every model
call whether or not anything is injected, and a prompt cache is a prefix — text
appended at the end never invalidates it. A real turn in that session billed
`cache_read 243,455` against `cache_creation 788`: the history at a tenth of the
price, and only the new tail written. Twelve answers at ~500 tokens is about
6,000 tokens of cache write across a whole session, which buys back the one
thing this plugin exists to hold.

The other way to close it was a `Stop` hook returning `decision: block` when a
turn ends without a question. That is a harder gate and it was not taken: it
costs a whole extra model turn every time it fires, which is output rather than
input and therefore the expensive half; it loops if the hook forgets to check
`stop_hook_active`; and it blocks the legitimate case where somebody asks a
plain question mid-task and gets a plain answer.

# Stages, and the route through them

| Stage | Produces |
|---|---|
| `survey` | a statement of what already exists |
| `design` | an approach someone agreed to |
| `plan` | a decomposition someone with no context could execute |
| `build` | the change itself |
| `verify` | evidence, not confidence |
| `audit` | a list of what is no longer true |
| `land` | a repository no dirtier than you found it |

That column is what a stage is graded on, which is not the same question as what
it has you do. The second question is answered stage by stage in
[Inside each stage](#inside-each-stage) below, and in one line each on the
[front page](../README.md).

### Three classes, three routes

Assembling a route by hand is a decision made silently. A class is the same
decision made out loud, which is what lets somebody disagree with it before four
stages of work hang off it.

| Class | Route | What it means |
|---|---|---|
| `spike` | `survey,build` | a feasibility question whose output is an answer. Anything built is labelled throwaway |
| `bounded` | `survey,design,build,verify,land` | a scoped change to a flow already in this repository. Design happens in chat: no spec file, no plan file |
| `architectural` | all seven | a new subsystem, or a change to an interface something else depends on |

```
node <plugin>/scripts/task.js start --session <id> --task "..." --class bounded
```

`--class` and `--route` together are refused rather than ranked: whichever one
lost would be a decision the user made and cannot see. Bounded measures the
repository rather than your familiarity with it — it means the flow being changed
is already here to read, so a new project is architectural however well you know
the kind of thing it is. When in doubt, take the heavier one.

## Inside each stage

The table above says what each stage produces. Below is how each one gets there:
the steps, the scripts, and the branch the stage actually has. They are not seven
copies of one shape — `build` is a loop, `verify` is a lookup from claim to
evidence, `land` is a sequence that stops dead on a red suite — and the shape is
most of what there is to know about a stage.

Every one of them ends at the same gate, so the gate is drawn once, on the
[front page](../README.md), and left off all seven here.

### survey

Six steps, and the first three read the project before the fourth searches it.
The order is the point: a scan run before the map is a scan whose results have
nothing to be read against.

```mermaid
flowchart TD
    A["<b>1 · locate</b><br/>orient<br/>root, git state, is this a worktree"]
    B["<b>2 · read the map</b><br/>map writes .fankeel/map.md<br/><i>read the file, not the summary</i>"]
    C{"<b>3 · take stock of the contracts</b><br/>every page carries a declared status"}
    C1["<b>planned, not built</b><br/>design-intent. What the system is<br/>meant to become — not drift"]
    C2["<b>retired</b><br/>true once, read as though<br/>it still were"]
    C3["<b>undeclared</b><br/>dated by git, so dated by whoever<br/>last touched it, not by a reader"]
    D0["<b>scope from the tree</b><br/>which directories hold the answer<br/><i>the only input there is before the first term —<br/>scope and dispatch in one response</i>"]
    D["<b>4 · targeted scan</b><br/>survey, one or more terms<br/><i>nothing matched is a finding —<br/>say which terms you tried</i>"]
    D2{"<b>4b · did one pass cover it?</b>"}
    D4["<b>report the gap</b><br/>say what was not covered and why<br/><i>not a dispatch, and not a silence</i>"]
    D3["<b>dispatch readers</b><br/>several in one response, one lens each<br/><i>one reader with the list where the lens is the same</i><br/><i>never a round spent asking permission to read</i><br/><i>say how many, and on which model</i>"]
    E{"<b>5 · classify, out loud</b><br/>measured against this repository,<br/>not against your familiarity"}
    E1["<b>spike</b><br/>survey, build"]
    E2["<b>bounded</b><br/>survey, design, build, verify, land"]
    E3["<b>architectural</b><br/>all seven"]
    F["<b>6 · write it down</b><br/>task start, class picks the route<br/><i>no file list is declared</i>"]

    A --> B --> C
    C --> C1
    C --> C2
    C --> C3
    C1 --> D0
    C2 --> D0
    C3 --> D0
    D0 --> D
    D --> D2
    D2 -- "a section capped → --all<br/>the walk truncated → --root" --> D
    D2 -- "the reading is wide, nothing matched,<br/>or a <b>skipped:</b> line names paths a reader can open" --> D3
    D2 -- "a <b>skipped:</b> line counts what nothing can open —<br/>unreadable files, unlistable directories" --> D4
    D2 -- yes --> E
    D3 --> E
    D4 --> E
    E -- "a feasibility question" --> E1
    E -- "a flow already here to read" --> E2
    E -- "a new subsystem, or an interface<br/>something else depends on" --> E3
    E1 --> F
    E2 --> F
    E3 --> F
```

Step 3 is the one with no counterpart in any other stage. A page marked
`design-intent` describes what the system is meant to become; treating it as a
description of the code is the specific failure survey exists to prevent, and it
is invisible unless somebody looked at the status line.

Step 5 is said out loud so it can be overridden. A classification made silently
is one nobody can disagree with — and the class is what four stages of work hang
off. The ratchet runs one way: hidden complexity found mid-task upgrades the
route, and nothing downgrades it.

### design

The gate never scales down. What scales is the artefact — a short design in chat
for a bounded change, a committed spec for an architectural one — and the two
paths diverge only at step 6.

```mermaid
flowchart TD
    A["<b>1 · one question at a time</b><br/>purpose, constraints, success criteria"]
    A0{"several independent<br/>subsystems in the ask?"}
    A1["say so first. Decompose, and give<br/>each piece its own cycle"]
    B["<b>2 · two or three approaches</b><br/>trade-offs, recommendation first<br/><i>no abstraction for single-use code,<br/>no error handling for impossible states</i>"]
    C["<b>3 · the success criterion</b><br/>the test that fails now and passes<br/>after. 'Make it work' is not one"]
    D["<b>4 · check against the map</b><br/>does this contradict a page<br/>the map lists as current?"]
    E["<b>5 · present in sections</b><br/>architecture, components, data flow,<br/>errors, testing — approve each"]
    F{"class?"}
    J["design happens in chat.<br/>No spec file, no plan file."]
    G["<b>6 · the spec</b><br/>docs/plans/&lt;date&gt;-&lt;topic&gt;-design.md<br/>status: design-intent, committed"]
    H["<b>7 · self-review</b><br/>placeholders · internal consistency ·<br/>scope · ambiguity · against the project"]
    I["a person reads it, and you wait"]

    A --> A0
    A0 -- yes --> A1
    A0 -- no --> B
    B --> C --> D --> E --> F
    F -- "bounded" --> J
    F -- "architectural" --> G
    G --> H
    H --> I
```

Step 4 has no counterpart anywhere else either. A self-review checks a document
against itself; only this step checks it against the project. A design that
quietly contradicts a page marked current is a contradiction that ships.

### plan

The stage exists on its own for one reason, and it is the third box.

```mermaid
flowchart TD
    A["<b>the file</b><br/>docs/plans/&lt;date&gt;-&lt;topic&gt;.md"]
    B["<b>the header</b><br/>goal · architecture · tech stack ·<br/>the spec this argues from"]
    C["<b>Global Constraints</b><br/><i>generated from map.md, not remembered</i><br/>exact values copied, not restated"]
    D["<b>file structure, before tasks</b><br/>what each file is responsible for"]
    E["<b>right-size the tasks</b><br/>the smallest unit carrying its own<br/>test cycle. Split only where a reviewer<br/>could reject one and pass its neighbour"]
    F["<b>per task</b><br/>files · interfaces consumed and<br/>produced · steps"]
    G["<b>every step is two to five minutes</b><br/>write the failing test → watch it fail →<br/>implement → watch it pass → commit"]
    H{"<b>self-review, before the gate</b>"}
    H1["every spec requirement<br/>has a task"]
    H2["no TBD · no 'add appropriate error<br/>handling' · no 'similar to Task N'"]
    H3["a name a later task uses is the<br/>name an earlier task defined"]

    A --> B --> C --> D --> E --> F --> G --> H
    H --> H1
    H --> H2
    H --> H3
```

A constraint restated approximately is a constraint that will be violated
approximately. The version floors, the naming rules, the platform requirements —
those come out of the map at plan time, not out of what anybody remembers of the
spec.

### build

The only stage that loops, and the only one whose memory is a file rather than a
conversation.

```mermaid
flowchart TD
    S1["<b>an isolated workspace</b>"]
    S2["<b>open the ledger</b><br/>ledger show<br/><i>after a compaction, trust it over memory</i>"]
    S3["<b>scan the plan first</b><br/>tasks that contradict each other,<br/>or contradict the constraints"]
    L{"a task the ledger does<br/>not list as complete?"}
    T1["record BASE"]
    T2{"the task's <b>Dispatch:</b> line"}
    T2a["<b>implement here</b><br/><i>every changed line traces to the task.<br/>Do not improve adjacent code on the way past</i>"]
    T2b["<b>dispatch an implementer</b><br/>pass the model explicitly<br/><i>it commits and returns a sha, never a diff</i>"]
    T3["test first where the task says so<br/><i>a test you did not watch fail is a test<br/>whose meaning you do not know</i>"]
    T4["commit"]
    T5["<b>one reviewer</b><br/>the task text, BASE..&lt;sha&gt;,<br/>and map.md — never the session's history"]
    T6{"findings?"}
    T7["fix round<br/><i>bounded at five</i>"]
    T8["ledger complete,<br/>'what landed'"]
    R["<b>one whole-branch review</b><br/>when the last task is done"]

    S1 --> S2 --> S3 --> L
    L -- yes --> T1
    T1 --> T2
    T2 -- "in-session" --> T2a
    T2 -- "implementer, model" --> T2b
    T2a --> T3
    T3 --> T4
    T4 --> T5
    T2b --> T5
    T5 --> T6
    T6 -- yes --> T7
    T7 --> T5
    T6 -- no --> T8
    T8 --> L
    L -- "none left" --> R
```

A running plan does not wait on a person. What happens when something blocks it
is the other half of the stage:

```mermaid
flowchart TD
    Q{"something blocks the loop"}
    S["<b>stop and ask</b>"]
    D["<b>rule on it</b><br/>ledger ruling:<br/>what · why · what it costs if wrong"]
    C["carry on"]

    Q -- "irreversible or destructive" --> S
    Q -- "security-sensitive" --> S
    Q -- "a side effect outside this workspace —<br/>a merge, a push to a shared branch,<br/>a publish" --> S
    Q -- "every path forward is a guess" --> S
    Q -- "anything else, the plan's<br/>own defects included" --> D
    D --> C
```

A wrong ruling costs rework the user can see and undo. A session parked on a
question costs their whole day and buys nothing. A finding you overrule is a
ruling, not a silence.

### verify

Not a checklist — a lookup. Every claim has one thing that establishes it, and
the things that feel like they establish it do not.

```mermaid
flowchart TD
    A{"what are you claiming?"}
    A1["the test command's output, 0 failures<br/><i>not a previous run</i>"]
    A2["the original symptom, retested<br/><i>not 'the code changed'</i>"]
    A3["revert the fix, watch it fail, restore<br/><i>not 'it passes once'</i>"]
    A4["the VCS diff<br/><i>not the agent's report</i>"]
    A5["line by line against the plan<br/><i>not 'the tests pass'</i>"]
    B{"did you run it<br/>in <i>this</i> message?"}
    C["then you cannot claim it yet.<br/>Run it."]
    D["docs-check<br/><i>which page did this change<br/>just make untrue?</i>"]
    D1["<b>dispatch readers</b><br/>several in one response, one per page<br/><i>four the ceiling, sonnet the floor</i><br/><i>the path to a diff file, never a pasted diff</i>"]
    E{"anything half-built?"}
    F["back to build.<br/>Verify is not where<br/>the bar gets lowered."]
    G["quote the command and the<br/>one line that decided it"]

    A -- "tests pass" --> A1
    A -- "bug fixed" --> A2
    A -- "regression test works" --> A3
    A -- "an agent finished" --> A4
    A -- "requirements met" --> A5
    A1 --> B
    A2 --> B
    A3 --> B
    A4 --> B
    A5 --> B
    B -- no --> C
    C --> B
    B -- yes --> D
    D --> D1
    D1 --> E
    E -- yes --> F
    E -- no --> G
```

"Should", "probably", "seems to", and any expression of satisfaction before the
command has run — "Great", "Perfect", "Done" — are the stage's red flags.
Rewording does not exempt anything: a phrasing that implies success without a run
is the same claim.

### audit

Two scanners, and then the part neither of them can do.

```mermaid
flowchart TD
    A["docs-check<br/><i>every reference still resolves</i>"]
    B["docs-audit<br/><i>the deeper sweep, 14 days</i>"]
    C{"what came back?"}
    D1["<b>fallen behind the code they describe</b>"]
    D2["<b>plans look landed</b><br/>a record, not a plan"]
    D3["<b>index</b><br/>declared but not written, or<br/>entries pointing at nothing"]
    D4["<b>diagrams behind their directory</b><br/>the files one leaves out read<br/>as files that do not exist"]
    E1["<b>pairs describing the same code</b><br/>where single source of truth breaks"]
    E2["<b>unfiled · undeclared ·<br/>linked from nowhere</b>"]
    F["<b>the part only reading finds</b><br/>open both, find the claim each makes<br/>about that file, say which one the<br/>code supports. Name the line."]
    F1["<b>dispatch readers</b><br/>several in one response, one per pair<br/><i>four the ceiling, sonnet the floor</i><br/><i>compare what comes back against itself</i>"]
    G["<b>report, then ask, then act</b><br/><i>never move a document unasked —<br/>every one is a link somebody holds</i>"]

    A --> C
    B --> C
    C -- "defects · the run fails" --> D1
    C -- "defects" --> D2
    C -- "defects" --> D3
    C -- "defects" --> D4
    C -- "context, not evidence" --> E1
    C -- "context" --> E2
    E1 --> F
    E2 --> F
    D1 --> G
    D2 --> G
    D3 --> G
    D4 --> G
    F --> F1
    F1 --> G
```

The context sections are the ones to act on first when they appear, because every
defect check above them gets sharper once they are gone. A page that declares
`status: design-intent` stops being reported as fallen behind; a pair where one
page names the other as its `source_of_truth` stops being a pair.

### land

A sequence with two places it stops, and a menu it is not allowed to answer.

```mermaid
flowchart TD
    A["<b>1 · the full suite</b><br/>on the tree you are about to integrate<br/><i>a green run earlier only proves<br/>the tree it ran on</i>"]
    A0{"green?"}
    A1["<b>report the failures and stop.</b><br/>The menu comes after a green run."]
    B["<b>2 · close the documents</b><br/>todo-check · last_verified on every page<br/>re-read and found true · archive the<br/>landed plan, after asking"]
    C["<b>3 · rewrite the map</b><br/>the project looks different now, and<br/>the next task starts from this file"]
    D["<b>4 · land the notes</b><br/>a convention → CLAUDE.md · a durable fact<br/>→ memory · why → the commit message ·<br/>deferred work → TODO.md"]
    E["<b>5 · detect the workspace,<br/>confirm the base</b>"]
    F{"<b>6 · the menu</b><br/><i>integration is the user's decision</i>"}
    F1["merge back to base locally"]
    F2["push and open a PR"]
    F3["keep the branch as-is"]
    G["<b>re-run the suite on<br/>the merged result</b>"]
    G0{"green?"}
    G1["<b>stop.</b> Nothing is pushed, so it<br/>is recoverable — leave the branch<br/>and the worktree in place"]
    G2["clean the worktree,<br/>then delete the branch"]
    H["<b>keep the worktree</b> —<br/>PR feedback gets fixed there"]

    A --> A0
    A0 -- no --> A1
    A0 -- yes --> B
    B --> C
    C --> D
    D --> E
    E --> F
    F --> F1 --> G --> G0
    G0 -- no --> G1
    G0 -- yes --> G2
    F --> F2 --> H
    F --> F3
```

Discarding the work is not on that menu. It happens when the user asks for it in
so many words, and then only against the typed word `discard`. A worktree whose
removal is refused for uncommitted files never gets `--force` on anyone's own
initiative — those files exist nowhere else.

## The project map

```
node <plugin>/scripts/map.js   —>   .fankeel/map.md
```

Written at `survey`, rewritten at `land`, read by everything in between.
Generated rather than maintained, git-ignored, and carrying `status: generated`
so the documentation sweep skips it.

It holds the signpost file's navigation table, the filing declared in
`docs.json`, and — the part nothing else reports — **every page's declared
status**. That last section is the one the rest was built for:

```
planned, not built — 2:
  docs/archive/2026-08-22-seven-stage-pipeline.md
  docs/roadmap.md
```

A page marked `status: design-intent` describes what the system is *meant* to
become. It is not drifting when the code does not match it; it is doing its job.
Without somewhere to read that, a roadmap gets written into an architecture page
and then read as a description of what exists — which is how a stage designs
against a system nobody has built yet.

Three properties, each a requirement rather than a nicety. It is a **file**, so a
subagent is handed a path instead of a paste — everything pasted into a dispatch
prompt stays resident and is re-read every later turn. It is **generated**, so it
cannot rot into the failure `/fankeel-audit` exists to catch. And it is **per
project rather than per task**, so two sessions in one repository read the same
map and it outlives the task that built it.

**A task's route is these stages in some order, chosen for that task.** A typo fix
is `build,verify`. A documentation sweep is `survey,audit,land`. A feature is all
six. The route is assembled at the start from what the task actually is, not
picked off a menu, and confirmed along with the task line:

```
$ node <plugin>/scripts/task.js start --session <id>       --task "fix the 7d ramp" --route "build,verify"

fankeel — started, at build   route: build → verify
```

Every step must be one of the stages above, no repeats, `land` last if it is
there at all. `stage` refuses a stage that is not on the route; `route` changes
the route when the task turns out to be a different shape than it looked.

A fixed five made the progress indicator lie in both directions — two-stage work
sat at 2 of 5 looking permanently unfinished, and longer work got no credit for
the stages it invented. The route is what `●●●○○` on the statusline counts.

## audit checks what stopped being true

Documents outlive the code they describe, and a document read as current when it
is not produces exactly the confident wrong answer this plugin exists to prevent.

```
$ node <plugin>/scripts/docs-check.js

fankeel docs-check — 17 markdown files, tree: flat
  1 decision, 2 plan, 14 reference

12 in no bucket — nobody has said how long these stay true:
  docs/00-overview.md
  ...

3 references that no longer resolve:
  gone: docs/02-database.md:556  names docs/a.md  [reference]
  orphan: docs/03-api.md:88  createSession() is not declared anywhere  [reference]
  into-archive: docs/01-architecture.md:14  points at retired docs/archive/2026-01-01-old.md  [reference]
```

Only what can be decided mechanically, and fast enough to sit in front of every
land. Whether two documents contradict each other is not mechanical, and a script
that guessed would produce findings nobody could act on.

Beside it runs the one scanner that is not about documents at all:

```
$ node <plugin>/scripts/residue.js

fankeel residue — on main

1 path nobody has decided about — not committed, not ignored:
  .claude/

1 worktree is already merged into main:
  /repo/.claude/worktrees/registry-staleness  (worktree-registry-staleness)

2 environments nothing here can rebuild or run:
  services/spec-rag/.venv  105.2M
      no Python manifest beside it; interpreter gone: C:\Users\user\...\Python311
  bench/.venv-mineru  4.0G (at least)
      interpreter gone: C:\Users\user\...\pythoncore-3.12-64

4 ignored paths carry weight:
  release/  73.1G
  node_modules/  412.0M
```

Untracked and unignored means somebody has to commit it, ignore it or delete it
and nobody has; a worktree whose branch is merged is one already spent; an
environment with no manifest beside it and an interpreter that is not on this
machine is weight nobody can use. Those three fail the run. Weight and empty
directories are context — a 73 GB build directory is not a bug, but not knowing
about it is.

There is no heuristic for "unused" anywhere in it and nothing is ever deleted by
it. **Two of the five sections need git and three do not**, so it answers outside
a repository as well as in one — which is where it finds the most, because a tree
nobody ran `git init` in is invisible to every check that starts from what is
committed.

Environments are found by `pyvenv.cfg` rather than by a list of directory names:
one real directory holds six of them side by side — `.venv-docling` through
`.venv-struct` — and another holds `.venv` beside `.venv-uv`. The marker names
every one without being maintained.

Which declared package is never used is a different question, and not one this
answers. It needs a package-name-to-module table — `Pillow` imports as `PIL`,
`pycryptodome` as `Crypto` — so the `audit` rules name `knip --dependencies` and
`deptry` instead, and say plainly when neither is installed.

**What gets checked depends on the document's role.** An archive naming deleted
code is an archive doing its job; a reference page doing the same is the bug. A
plan naming files that do not exist yet is a plan. Reporting the three alike is
how a checker ends up nine parts noise and read once.

## the sweep, roughly fortnightly

A page where every reference resolves can still describe a system that was
replaced last month, and finding those costs a reading session — so the deep pass
runs on the cadence `/ponytail-audit` runs on, and is the documentation half of
the same fortnight.

```
$ node <plugin>/scripts/docs-audit.js

fankeel docs-audit — 18 markdown files, tree: flat (implied by the directories, not declared), window: 14 days

3 reference documents have fallen behind the code they describe:
  docs/01-architecture.md  (last touched 23d ago; web/src/pages/editor-page.js changed 22d after it)
  CLAUDE.md  (last touched 22d ago; e2e/helpers.js changed 21d after it)
  ...

1 plan looks landed — everything named now exists:
  docs/plans/2026-07-27-waypoint-mvp.md  (25 files, untouched 23d)

2 documents are missing from docs/README.md:
  docs/plans/2026-08-21-due-rules-unify.md
  ...

12 pairs describe the same code — read these against each other, strongest first:
  docs/01-architecture.md  ×  docs/06-config.md  (shared/canvas_rules.py, web/src/lib/canvas-rules.js +2)
  ...
```

It narrows rather than judges. Nothing mechanical decides that two pages
disagree; this turns *read all forty documents looking for disagreements* into
*read these two*. Only the first four sections fail the run — pairs, orphans and
uncovered directories are true of almost every healthy repository, and a command
that always exits non-zero has an exit code that means nothing.

A file half the documentation mentions is common ground, not a subject:
`api/entrypoint.sh` named in five pages produced ten pairs on the first real run,
none worth reading, and they pushed the pair sharing four files off the list.

Dates come from the commit log in one `git log`, not one per file, and fall back
to mtime for a working tree with no history. Where no `docs.json` exists the tree
is inferred from the directories, so it is worth running on a project that never
opted in.

For the code half, `audit` uses what is installed — `/ponytail-audit` if ponytail
is there, a graph query if graphify or codegraph is — and says plainly when none
of them are rather than implying a check ran.

[Back to the index](README.md) · [Back to the front page](../README.md)
