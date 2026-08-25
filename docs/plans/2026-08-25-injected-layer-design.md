---
status: current
last_verified: 2026-08-25
source_of_truth: lib/stages.js, lib/render.js, scripts/orient.js, tests/stages.test.js
---

# The fuller copy is in the copy that decays

Two things hold the shape of a stage's report: a `template` in
`lib/stages.js`, restated on every prompt by `hooks/inject.js`, and an
`## Output` block in that stage's `SKILL.md`, read once on entering the
stage. They are the same artefact written twice.

They have drifted, and the drift runs one way. In five of seven stages the
injected template is a **strict subset** of the skill's:

| stage | in the skill, not in the injection |
|---|---|
| `survey` | the map summary, `planned, not built:`, `class:` |
| `design` | `proves it done:`, `against the map:` |
| `build` | `ledger: <n> of <m> complete` |
| `verify` | `docs: <page:line that is now false>` |
| `audit` | both quoted scanner blocks, the two-pages-disagree line |

`plan` and `land` match.

Every dropped line has a rule behind it that **is** injected, as prose. The
comment at `lib/stages.js:69-79` says why that is not enough:

> The rule survived a design stage writing nine hundred words, and the reason
> is that describing a shape and showing one are not the same instruction.

So the fuller copy sits in the copy that recedes by thousands of tokens a
turn, and the thinner copy sits in the one that never does. That is backwards.

## What changes

### 1. The five templates are brought up to the skill's version

Cost, measured, per turn — one stage's template is injected at a time:

| stage | template now | added |
|---|---|---|
| `survey` | 155 | +92 |
| `design` | 158 | +113 |
| `build` | 120 | +27 |
| `verify` | 111 | +47 |
| `audit` | 142 | +200 |

Nothing caps a template. `tests/stages.test.js:82-85` caps **rules** at 2000
characters and every stage stays where it is.

### 2. A test pins the two copies together

Re-copying resets the clock. It does not stop the next drift, because the
duplication is the cause and it survives the fix.

The skills cannot simply point at `stages.js`: a skill is also read with no
task open — `/fankeel-audit` is the shipped example — and then nothing is
being injected at all. Both copies have to exist.

So: for each stage, every line of `templateFor(name)` must appear, in order,
inside that skill's `## Output` section. Fence markers and blank lines are
ignored on both sides — `verify` splits its Output across two fences, and
where the lines sit is not the claim. The skill may hold more; it may not
hold less, and it may not hold a different version of a line the injection
also has.

### 3. `audit` gains the rule that names its skill

Six stages carry a pointer to the skill holding their full protocol.
`audit` does not — `lib/stages.js:191` names the `/fankeel-audit` command
and frames it as a fortnightly deep pass, which is a different instruction.
On a route that reaches `audit`, the defect table in
`skills/fankeel-audit/SKILL.md` is never loaded.

`audit` has 774 characters of headroom under the cap. The rule is 52.

### 4. The class's `means` is injected

`CLASSES[name].means` is printed once, by `task.js start`, and never again.
For `spike` it carries the only sentence in the system that bounds what a
spike may build:

> a feasibility question whose output is an answer. **Anything built is
> labelled throwaway.**

`spike`'s route is `survey,build`. It reaches neither `design`, which holds
the one rule about cutting what the ask does not require, nor `audit`, which
delegates over-engineering to ponytail. Injecting `means` beside the route
is what covers that route.

The entry already stores `class` (`scripts/task.js start` writes it).

### 5. `orient` says which question it answered

`scripts/orient.js:245` calls `registry.readActive` with no liveness filter
— the only one of five callers that does not. The other four run every entry
through `lib/live.js`. Both readings are correct: `readActive` reports
intent, `isLive` reports fact. The output does not say which it is showing,
so `orient` reporting `1 active` beside `task.js show` reporting none reads
as a contradiction.

It becomes `2 entries (1 active, 0 live)`.

## What is deliberately not built

**A simplicity rule on `build`.** `build` has 82 characters of headroom and
the rule would be about 103, so it would have to displace one — which
`tests/stages.test.js:72-81` says is the intended cost of the cap. It is not
paid here, because `tests/stages.test.js:87-91` records that this exact
comparison was already made:

> Most of that list was already here in one form or another, and the
> delegation is deliberate where it is not: over-engineering is ponytail's
> subject, and the audit rules name it rather than restating it.

The uncovered case is `spike`, and item 4 answers it for less.

**Generating one copy from the other.** A generator is more machinery than a
test, and the test catches the same failure at the same moment.

## Testing

| Claim | What proves it |
|---|---|
| the templates match | the new pinning test fails when `stages.js` is reverted |
| nothing grew past its cap | the existing 2000-character test, unchanged |
| `audit` names its skill | the existing per-stage pointer test extended to seven |
| `means` reaches the prompt | a render test for a `spike` entry |
| `orient` labels its count | a CLI test asserting both numbers |

Red-green is required on the pinning test: revert one template line, watch it
fail, restore.
