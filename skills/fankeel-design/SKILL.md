---
name: fankeel-design
description: The design stage — one approach with its trade-offs, a success criterion that can fail, and a check against the project map before anything is built. Use for the design stage of a fankeel task, choosing between approaches, writing a spec, or when an approach needs approving before implementation.
version: 0.24.0
status: current
last_verified: 2026-08-22
source_of_truth: lib/stages.js
---

# fankeel-design

Produces an approach someone agreed to — and for `architectural`, a spec file.

## The gate never scales down

The artefact scales with the task. A bounded change gets a few sentences in chat;
an architectural one gets a spec file. **The approval does not scale.** "Too
simple to need a design" means a short design, not no design — simple tasks are
where unexamined assumptions cause the most wasted work.

Presenting a design and starting work in the same message is skipping the gate.

## The steps

### 1. One question at a time

Purpose, constraints, success criteria. One per message — if a topic needs more,
break it up. Prefer multiple choice; open-ended is fine when the answer is not a
menu.

If the request describes several independent subsystems, say so **before**
spending questions on the details of one. A project too large for a single design
gets decomposed first, and each piece gets its own cycle.

### 2. Two or three approaches

With trade-offs. Lead with the recommendation and say why.

Cut ruthlessly: no features beyond the ask, no abstraction for single-use code,
no configurability nobody requested, no error handling for impossible states. If
two hundred lines could be fifty, it should be fifty.

### 3. The success criterion

**Name the test that fails now and passes after.** "Make it work" is not a
criterion — weak criteria are what turn an independent build loop into constant
clarification.

| Ask | Criterion |
|---|---|
| "add validation" | tests for the invalid inputs, failing, then passing |
| "fix the bug" | a test reproducing it, failing, then passing |
| "refactor X" | the suite green before and after |

If a simpler approach exists, or the ask itself looks wrong, say so before
building it.

### 4. Check against the map

Read `.fankeel/map.md`. Two questions:

- Does this approach contradict a page the map lists as current?
- Is anything here really `design-intent` — something the design describes as
  though it exists?

This is the step with no counterpart anywhere else. A spec self-review checks the
spec against itself; a design that quietly contradicts a page marked current is a
contradiction that ships.

### 5. Present in sections

Scale each section to its complexity — a few sentences if straightforward, up to
200–300 words if nuanced. Ask after each whether it holds. Cover architecture,
components, data flow, error handling, testing.

Break the system into units with one clear purpose each, communicating through
defined interfaces. For each: what does it do, how is it used, what does it
depend on? If someone cannot answer those without reading its internals, the
boundaries need work.

### 6. The spec — `architectural` only

`docs/plans/YYYY-MM-DD-<topic>-design.md`, with `status: design-intent`
frontmatter, committed.

A design is not filed as reference: it describes what is meant to be, and the
documentation sweep grades reference pages as claims about what is.

### 7. Self-review, then a person reads it

1. **Placeholders** — any TBD, incomplete section, or vague requirement. Fix them.
2. **Internal consistency** — do sections contradict each other?
3. **Scope** — focused enough for one plan, or does it need decomposing?
4. **Ambiguity** — could a requirement be read two ways? Pick one, make it explicit.
5. **Against the project** — step 4 again, now against the written text.

Then ask the user to read it, and wait.

## Output

```
<the approach, one sentence>

| file | change |
|---|---|
| path | what happens to it |

proves it done: <the test that fails now and passes after>
against the map: <the page it touches, or "no conflict">
unverified: <the one thing you have not checked>
then AskUserQuestion
```

Under 200 words. One approach, not a catalogue.
