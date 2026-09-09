---
name: fankeel-design
description: The design stage — one approach with its trade-offs, a success criterion that can fail, and a check against the project map before anything is built. Use for the design stage of a fankeel task, choosing between approaches, writing a spec, or when an approach needs approving before implementation.
version: 0.57.0
status: current
last_verified: 2026-09-09
source_of_truth: lib/stages.js, lib/plantasks.js
---

# fankeel-design

Produces an approach someone agreed to — and for `architectural`, a spec file.

**Done when** one approach, its file table, the criterion that fails now and
passes after, the check against the map and the one unverified thing are all on
screen. A second approach is a catalogue, not more design.

- **One path, never a search.** `<plugin>` is two directories up from this
  file; resolve every script this skill names against that root and nowhere
  else. One exception, and it is a different root rather than a search for
  one: where the registry root's own `package.json` names `fankeel`, the
  scripts to run are the working tree's, because the installed copy lags it
  by a release.
- **No fallback path.** Never the working directory, a home directory, a
  global skill root, or another copy found by name — that one path resolves,
  or none does.
- **A missing script stops the stage, named.** Say which path you resolved
  and that it is not in this plugin install — never a guess at where it
  moved, never a workaround.

## Not a defect

| Looks like a finding | Why it is not |
|---|---|
| Only one approach presented, no rejected alternative shown | `lib/stages.js:252` calls a second one a catalogue (`not a catalogue`) — trade-offs on the one approach chosen are the design, not a comparison table. |
| The map check returning `no conflict` with nothing else said | `lib/stages.js:249` allows exactly that (`say you checked and found none`) — a stated absence is a complete answer, not a check cut short. |
| Config, error handling or abstraction the ask never requested, left out | `lib/stages.js:247` requires it (`Cut whatever the stated ask does not require`) — the smaller design is the correct one, not an unfinished one. |
| A design with no mockup | Step 3 is a per-task judgement, and `lib/stages.js` carries the rule behind `when: 'design.mockup'` — a task that changes no screen gets no mockup, and a project with no front end never sees the step at all. |

## The gate never scales down

The artefact scales with the task. A bounded change gets a few sentences in chat;
an architectural one gets a spec file. **The approval does not scale.** "Too
simple to need a design" means a short design, not no design — simple tasks are
where unexamined assumptions cause the most wasted work.

Where there is a mockup, the page is what the gate approves — the object of the
approval, not an attachment to it.

Presenting a design and starting work in the same message is skipping the gate.

## The steps

### 1. One question at a time

Purpose, constraints, success criteria. One per message — if a topic needs more,
break it up. Prefer multiple choice; open-ended is fine when the answer is not a
menu.

If the request describes several independent subsystems, say so **before**
spending questions on the details of one. A project too large for a single design
gets decomposed first, and each piece gets its own cycle.

### 2. One approach

With trade-offs. Lead with it and say why.

Cut ruthlessly: no features beyond the ask, no abstraction for single-use code,
no configurability nobody requested, no error handling for impossible states. If
two hundred lines could be fifty, it should be fifty.

### 3. The mockup — frontend work only

Decide per task whether this is frontend work — whether the change puts
something on a screen a person looks at. Say which way you decided, because it
is a judgement someone can overturn, like `class`. `design.mockup` answers a
different question: whether the project has a front end at all.

The artefact is one HTML page covering every screen the approach changes,
written to `.fankeel/build/<the directory name the ledger uses>/mockup.html` —
beside the ledger, and not committed.

Dispatch it as `implementer, <the value of design.mockup>`. Visual design does
not take `dispatch.floor`, which is why the key carries a model at all. Name one
installed design skill in the prompt — `taste-skill:taste-skill`,
`taste-skill:soft-skill`, `taste-skill:minimalist-skill`,
`frontend-design:frontend-design`, `ui-ux-pro-max:ui-ux-pro-max` or
`impeccable:impeccable` — one, not the list. **No profile value reaches a
subagent**, so the model and the output path have to be written into the prompt
by the session dispatching it.

Then the path goes on the `spec:` line, and option one's description points at
the page. The gate approves the page, not the paragraph.

### 4. The success criterion

**Name the test that fails now and passes after.** "Make it work" is not a
criterion — weak criteria are what turn an independent build loop into constant
clarification.

| Ask | Criterion |
|---|---|
| "add validation" | tests for the invalid inputs, failing, then passing |
| "fix the bug" | a test reproducing it, failing, then passing |
| "refactor X" | the suite green before and after |

**And one row on the artefact, wherever the change produces one.** A rendered
page, a written file, a printed report — checked against itself, not against a
unit: two figures the artefact derives from one source have to agree. Unit
tests each passed on 2026-09-06 while a station row's cost cell and the curve
under it disagreed by a factor of three, because no criterion had named the
artefact.

Name the check rather than the widget it lands on. That curve was deleted on
2026-09-08 and the criterion outlived it: the same row was met by reading a
total out of the rendered page and summing the field it came from, which is a
sentence the redesign could not falsify.

If a simpler approach exists, or the ask itself looks wrong, say so before
building it.

### 5. Check against the map

Read `.fankeel/map.md`. Two questions:

- Does this approach contradict a page the map lists as current?
- Is anything here really `design-intent` — something the design describes as
  though it exists?

This is the step with no counterpart anywhere else. A spec self-review checks the
spec against itself; a design that quietly contradicts a page marked current is a
contradiction that ships.

### 6. Present in sections

Scale each section to its complexity — a few sentences if straightforward, up to
200–300 words if nuanced. Ask after each whether it holds. Cover architecture,
components, data flow, error handling, testing.

**Number the sections whose bullets are promises** — `## 1. The curve`,
`## 2. Discovery` — and write each promise as a first-level bullet. That is
what `plan`'s coverage table is built from and what `ledger.js lint` reads:
a bullet under an unnumbered heading is context, and a nested bullet is
detail of the one above it.

Break the system into units with one clear purpose each, communicating through
defined interfaces. For each: what does it do, how is it used, what does it
depend on? If someone cannot answer those without reading its internals, the
boundaries need work.

### 7. The spec — `architectural` only

`docs/plans/YYYY-MM-DD-<topic>-design.md`, with `status: design-intent`
frontmatter, committed.

A design is not filed as reference: it describes what is meant to be, and the
documentation sweep grades reference pages as claims about what is.

### 8. Self-review, then a person reads it

1. **Placeholders** — any TBD, incomplete section, or vague requirement. Fix them.
2. **Internal consistency** — do sections contradict each other?
3. **Scope** — focused enough for one plan, or does it need decomposing?
4. **Ambiguity** — could a requirement be read two ways? Pick one, make it explicit.
5. **Against the project** — step 5 again, now against the written text.

Then ask the user to read it, and wait.

## Output

```
<the approach, one sentence>

| file | change | dispatch |
|---|---|---|
| path | what happens to it | implementer, sonnet — or in-session, with why |

proves it done: <the test that fails now and passes after>
against the map: <the page it touches, or "no conflict">
unverified: <the one thing you have not checked>
spec: <the docs/plans path — architectural — or "in chat">
then AskUserQuestion
```

Under 200 words. One approach, not a catalogue.

The third column is the plan's `**Dispatch:**` line in its two forms —
`implementer, <model>` with `sonnet` as the floor, or `in-session — <why>` — and
the same two exceptions decide it: a pipe already removes the leftovers, or it
is one tool call. Everything else is an implementer, and
a row without one is a design failure, in the same list as a `change` cell that
could not brief a stranger. `build` reads the cell and says how many go out and
on which model, so the count is decided here and announced there. Rows that
share no file and feed nothing to each other are `plan`'s work, not a wider
table.
