---
status: design-intent
last_verified: 2026-09-06
source_of_truth: scripts/todo-check.js, TODO.md
---

# `## Waiting` names its event Implementation Plan

**Goal:** every `## Waiting` entry says what event would lift it, `todo-check`
refuses one that does not, and the seven-day list prints that event instead of
telling the reader they have not looked lately.

**Architecture:** `lifts when: <event>` is a clause at the end of the entry,
before the `MM-DD` stamp, because `STAMP` is anchored at the end. It replaces the
trailing sentence most entries already carry — `None observed.`, `add a row when
one is actually needed.` — rather than adding length, which is why the cap does
not move and why the four entries that cannot fill the slot are exactly the four
that never named an event. Those four leave `TODO.md` for the source files they
describe, as comments.

**Tech Stack:** Node's `node:test` and `node:assert`. No dependencies, and none
may be added.

**Spec:** in chat — `bounded`, no spec file. The approach and its trade-offs were
agreed on 2026-09-06.

## Global Constraints

- `package.json:8` — the suite is `node --test`. `private: true`, no
  `dependencies` key, and this repository is zero-dependency by rule
  (`scripts/station.js:16`). Nothing here adds one.
- `.gitattributes:1` — `* text=auto eol=lf`. Write LF; a whole-file CRLF flip is
  a diff nobody can read.
- There is no `CLAUDE.md` in this repository. Conventions come from the code
  around the change.
- `.fankeel/docs.json:12-15` — `docs/plans` is role `plan`. This file carries
  `status: design-intent` and is archived once the work lands.
- `.fankeel/map.md:64` — the only page naming this section is the archived
  `docs/archive/2026-08-31-todo-waiting-backlog.md`. No current reference page
  describes the `## Waiting` convention, so nothing outside the files below has
  to move.
- `scripts/todo-check.js:42` — `MAX_ENTRY_CHARS = 200`. Unchanged. The three
  longest `## Waiting` entries today are 200, 198 and 195 characters, and all
  three are in the set that leaves in Task 4.
- `scripts/todo-check.js:95` — `REREAD_DAYS = 7`. Unchanged.
- `scripts/todo-check.js:100` — `STAMP = /(?:^|\s)(\d{2})-(\d{2})\.?$/` is
  anchored at the end of the entry. The event clause goes **before** the stamp,
  never after, or every stamp in the file stops parsing.
- `tests/todo-check.test.js:36-42` — the `TODAY` constant is the precedent for
  this whole shape: when the stamp became a problem in its own right, a
  fixture-wide default kept each test reporting only the thing it is about.
  Task 1 does the same for the event.
- `tests/todo-check.test.js:13-21,34` — `fixture(body, extra)` and
  `kinds(file, now)` are the helpers. Use them; do not write new ones.
- `scripts/todo-check.js:324` — `module.exports = { MAX_ENTRY_CHARS,
  REREAD_DAYS, SECTIONS, linksIn, check, main }`. Task 2 adds `report`.
- `node --test` here prints `✔` and `✖` per test and a summary of `ℹ pass N` /
  `ℹ fail N`. There are no TAP `ok` / `not ok` lines, so a filter for them
  matches nothing and reads as silence rather than as green — this was ruled on
  during the 2026-09-05 build and is recorded in that plan's ledger. Judge a run
  on the summary lines and on an unpiped exit code.

## File structure

| file | responsibility after this change |
|---|---|
| `scripts/todo-check.js` | the rule: what an entry must carry, and what the seven-day list says |
| `tests/todo-check.test.js` | every case of that rule, including the controls |
| `skills/fankeel/SKILL.md`, `skills/fankeel-land/SKILL.md` | the two places that tell someone how to file under `## Waiting` |
| `tests/skills.test.js` | pins those two anchors to the rule |
| `TODO.md` | thirteen entries re-filed, and a preamble that describes the rule as it now is |
| `lib/stages.js`, `lib/dirty.js`, `scripts/ledger.js` | three recorded uncertainties, each next to the code it is about |

## Task 1: an entry that names no event is refused

**Files:**
- Modify: `scripts/todo-check.js` — add `LIFTS`, `liftsAt()`, and the `unlifted`
  problem beside the `undated` one
- Test: `tests/todo-check.test.js`

**Interfaces:**
- Consumes: nothing
- Produces: `liftsAt(text: string): string | null` — the event with its trailing
  full stop and any `MM-DD` stamp removed, or `null` when the entry has no
  `lifts when:` clause or an empty one. The problem `kind` is the string
  `'unlifted'`.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription
plus tests.

### Steps

1. Add below `STAMP` at `scripts/todo-check.js:100`:

```js
// The event that would lift the entry, named rather than left to the reader.
// `## Waiting` already declares what it waits on — real use, upstream, or
// another entry landing — and this is that declaration written down per entry
// instead of per heading. It sits before the stamp because `STAMP` is anchored
// at the end, and it is read by stripping that stamp back off the tail.
const LIFTS = /\blifts when:\s*(.+)$/i;

function liftsAt(text) {
    const m = LIFTS.exec(text.replace(/\s+/g, ' ').trim());
    if (!m) return null;
    const event = m[1].replace(STAMP, '').trim().replace(/\.$/, '').trim();
    return event || null;
}
```

2. In `check()`, inside the `if (entry.section === 'Waiting')` block, after the
   `if (stamped === null) { ... } else { ... }` that ends at
   `scripts/todo-check.js:212`, add:

```js
            // Independent of the stamp. An entry can carry a date and still be
            // waiting for nothing, and that is the case the date cannot show:
            // it is refreshed by being read, so a thing nobody is waiting for
            // reads exactly like a thing somebody checked this morning.
            if (liftsAt(entry.text) === null) {
                problems.push({
                    line: entry.line,
                    kind: 'unlifted',
                    detail: 'no "lifts when:" clause. Name the event that would make this actionable'
                        + ' — real use, upstream, or another entry landing. An entry that cannot name'
                        + ' one is not waiting for anything: it belongs under another heading, or as'
                        + ' a comment in the code it is about.',
                });
            }
```

3. Change the fixture helper at `tests/todo-check.test.js:341` so every existing
   stamp test keeps reporting only the stamp. This is the `TODAY` precedent at
   `:36-42`, applied to the event:

```js
// Every fixture below is about the stamp, so an event is spliced in for it —
// without one each of these would report `unlifted` as well as the one thing it
// is checking. The splice goes before the stamp, never after: `STAMP` is
// anchored at the end of the entry, so a clause appended after a date stops
// that date being a date.
const STAMP_TAIL = /\s*\d{2}-\d{2}\.?$/;
const LIFTS_CLAUSE = 'lifts when: an overflow is observed.';
const waiting = (entry) => fixture('# TODO\n\n## Waiting\n\n- '
  + (STAMP_TAIL.test(entry) ? entry.replace(STAMP_TAIL, ' ' + LIFTS_CLAUSE + '$&') : entry + ' ' + LIFTS_CLAUSE)
  + '\n');
```

4. Run `node --test tests/todo-check.test.js`. Every existing test passes
   unchanged — that is the point of step 3, and if any of them changed
   expectation instead, step 3 was done wrong.

5. Add these tests at the end of `tests/todo-check.test.js`:

```js
// The rule the stamp could not carry. A date says when somebody last looked; it
// cannot say whether there is anything to look for, and twelve of thirteen
// entries on 2026-09-06 were waiting on no event at all.
test('a Waiting entry that names no event is refused', () => {
  const file = fixture('# TODO\n\n## Waiting\n\n- Whether the pool ever overflows. None observed. '
    + stampFor(2) + '.\n');
  assert.deepEqual(kinds(file, NOW), ['unlifted']);
  assert.equal(todo.main([file]).ok, false);
});

test('a Waiting entry naming its event passes', () => {
  const file = fixture('# TODO\n\n## Waiting\n\n- Whether the pool ever overflows.'
    + ' lifts when: an overflow is observed. ' + stampFor(2) + '.\n');
  assert.deepEqual(kinds(file, NOW), []);
});

// `lifts when:` with nothing after it is the form that would pass a check for
// the words alone, which is the check this is not.
test('an empty lifts clause names no event', () => {
  const file = fixture('# TODO\n\n## Waiting\n\n- Whether the pool ever overflows. lifts when: '
    + stampFor(2) + '.\n');
  assert.deepEqual(kinds(file, NOW), ['unlifted']);
});

// The control. Without it this rule passes just as well when it fires on every
// entry in the file, and `Ready` is the section whose bullets are the
// specification — an event there would be a second thing to write for nothing.
test('a Ready or Needs a decision entry needs no event', () => {
  const file = fixture('# TODO\n\n## Ready\n\n- a\n\n## Needs a decision\n\n- b\n');
  assert.deepEqual(kinds(file, NOW), []);
});

// The stamp has to survive the clause, because `STAMP` is end-anchored and the
// clause is the thing now sitting in front of it.
test('the event does not stop the stamp being read', () => {
  const file = fixture('# TODO\n\n## Waiting\n\n- a. lifts when: it happens. ' + stampFor(20) + '.\n');
  const result = todo.check(file, NOW);
  assert.deepEqual(result.problems, []);
  assert.equal(result.overdue[0].days, 20);
});
```

6. Run `node --test tests/todo-check.test.js`, watch the five fail, write the
   code from steps 1-2, run it again and watch them pass.

7. Commit.

## Task 2: the seven-day list says what to go and check

**Files:**
- Modify: `scripts/todo-check.js` — carry the event onto each `overdue` row,
  reword the heading of that list, print the event, export `report`, and record
  the DST uncertainty evicted from `TODO.md` in Task 4
- Test: `tests/todo-check.test.js`

**Interfaces:**
- Consumes: `liftsAt(text)` from Task 1
- Produces: `overdue` rows gain `lifts: string | null`; `report(result)` is
  exported from `scripts/todo-check.js`

**Dispatch:** implementer, sonnet — the plan carries the code; transcription
plus tests.

### Steps

1. At `scripts/todo-check.js:211`, carry the event onto the row:

```js
                if (days >= REREAD_DAYS) overdue.push({ line: entry.line, days, text: entry.text, lifts: liftsAt(entry.text) });
```

2. Replace the heading and the row at `scripts/todo-check.js:279-283` with:

```js
        lines.push('', '  due for a re-read — nobody has said these events have not happened in '
            + REREAD_DAYS + ' days or more:');
        for (const o of result.overdue) {
            // The event, not the entry. What a reader can act on is whether the
            // thing has happened, and the rest of the entry is the part they
            // already skipped every time the menu left this section out.
            const short = (o.lifts || o.text).replace(/\s+/g, ' ').trim();
            lines.push('    ' + result.file + ':' + o.line + '  ' + String(o.days).padStart(3)
                + ' days  ' + (short.length > 72 ? short.slice(0, 71) + '…' : short));
        }
```

3. Add `report` to `module.exports` at `scripts/todo-check.js:324`:

```js
module.exports = { MAX_ENTRY_CHARS, REREAD_DAYS, SECTIONS, linksIn, check, report, main };
```

4. Beside `stampAt` in `scripts/todo-check.js`, record the uncertainty Task 4
   deletes from `TODO.md`:

```js
// Whether the day arithmetic slips a day across a DST transition is untested.
// It matches `docs-audit.js`'s `daysBetween`, and every machine this has run on
// keeps one offset all year, so there has been nothing to observe rather than
// something observed and dismissed.
```

5. Add these tests at the end of `tests/todo-check.test.js`:

```js
// What the list is for. It used to report that nobody had read the section,
// which is a fact about the reader; the event is a fact about the world, and
// only one of the two can be gone and checked.
test('the re-read list names the event to check', () => {
  const file = fixture('# TODO\n\n## Waiting\n\n- a. lifts when: the pool overflows. ' + stampFor(20) + '.\n');
  const result = todo.check(file, NOW);
  assert.equal(result.overdue[0].lifts, 'the pool overflows');
  assert.match(todo.report(result), /the pool overflows/);
});

// The control. The line above passes against a report that prints the whole
// entry, which is what it printed before.
test('the re-read list does not print the rest of the entry', () => {
  const file = fixture('# TODO\n\n## Waiting\n\n- the pool is unbounded. lifts when: it overflows. '
    + stampFor(20) + '.\n');
  assert.doesNotMatch(todo.report(todo.check(file, NOW)), /unbounded/);
});
```

6. Run `node --test tests/todo-check.test.js`, watch the two fail, write the
   code from steps 1-3, run it again and watch them pass.

7. Run `node --test` for the whole suite. `TODO.md` still fails at this point,
   and that is Task 4's job, not a regression: this task's gate is
   `tests/todo-check.test.js` green.

8. Commit.

## Task 3: the two places that teach the convention

**Files:**
- Modify: `skills/fankeel/SKILL.md` — line 563, the row in the four-places table
- Modify: `skills/fankeel-land/SKILL.md` — line 80, the same row in its own table
- Test: `tests/skills.test.js`

**Interfaces:**
- Consumes: the spelling `lifts when:` from Task 1
- Produces: nothing any other task reads

**Dispatch:** implementer, sonnet — two table rows and one test; the plan
carries all three.

### Steps

1. `skills/fankeel/SKILL.md:563` becomes:

```markdown
| Work deliberately deferred | `TODO.md`, one line, linking to the detail, under the heading for what it is short of — and under `## Waiting`, `lifts when: <the event>` and then a `MM-DD` stamp |
```

2. `skills/fankeel-land/SKILL.md:80` becomes:

```markdown
| work deliberately deferred | `TODO.md`, one line, under the heading for what it is short of — under `## Waiting`, `lifts when: <the event>` then a `MM-DD` stamp, or `todo-check` fails the gate below |
```

3. Add to `tests/skills.test.js`, after the test at `:69`:

```js
// Both places that tell someone how to file under `## Waiting` have to name the
// event, because `todo-check` fails on an entry without one and a skill that
// teaches the older shape teaches a step that fails its own gate. That is not
// hypothetical: c55c373 fixed exactly this for the stamp, in three skills.
test('the two places that teach the Waiting convention name the event', () => {
  for (const n of ['fankeel', 'fankeel-land']) {
    assert.match(read(n), /lifts when:/, n + ' teaches a Waiting entry with no event');
  }
});
```

4. Run `node --test tests/skills.test.js`, watch it fail, make the two edits,
   run it again and watch it pass.

5. Commit.

## Task 4: the thirteen entries, re-filed

**Files:**
- Modify: `TODO.md` — the preamble at lines 26-48, and all thirteen
  `## Waiting` entries
- Modify: `lib/stages.js` — the `Done when` uncertainty, as a comment on
  `ALWAYS[0]`
- Modify: `lib/dirty.js` — the MCP-write uncertainty, as a comment where
  `git status --porcelain` is read
- Modify: `scripts/ledger.js` — the disjointness uncertainty, as a comment on
  the `prose.length` gate
- Test: none — this task writes no test file. Its gate is
  `node scripts/todo-check.js` exiting 0 with thirteen entries down to five,
  which no test file can assert about this repository's own `TODO.md`.

**Interfaces:**
- Consumes: `liftsAt` and the `unlifted` kind from Task 1; from Task 2, the
  `report` export and the reworded heading it prints, which step 4 below
  describes in `TODO.md`
- Produces: nothing any other task reads

**Dispatch:** in-session — every entry's destination is a judgement made in this
task's own survey, entry by entry, against evidence gathered here. A dispatched
implementer would have to redo the reading to make the same calls, and the
reading is the expensive half.

### Steps

1. Four entries move to `## Ready`, because the event they named has already
   happened. Drop the stamp: `## Ready` does not take one.

   - the `LANDED_QUIET` settle period — seven plans have landed since the
     eight it was measured from
   - the `brief-probe` fixture — the fresh terminal it wanted has happened
   - whether an output style reaches subagents — what it needs is a style set
     in `/config`, which is a person, not an event
   - whether `docs-audit`'s pairs are worth reading — what it needs is more
     reading, which is a person

2. Four entries leave `TODO.md` for the code they are about. The sentence moves;
   nothing is summarised away. The fourth, the DST one, was written in Task 2
   step 4 — delete its entry here and do not write it twice.

   - `Done when` and the gate loop → `lib/stages.js`, on `ALWAYS[0]`
   - an MCP write tool → `lib/dirty.js`, where the porcelain is read
   - the DST transition → already in `scripts/todo-check.js`
   - the disjointness sentence → `scripts/ledger.js`, on the `prose.length` gate

3. Five entries stay, each gaining `lifts when:` **in place of** its trailing
   sentence, before the stamp. The trailing sentence is already the event in
   four of the five:

   - `ledger.js`'s ignored flag: `None observed.` → `lifts when: a verb is seen
     ignoring a flag in a real run.`
   - language patterns beyond the ten: `add a row when one is actually needed.`
     → `lifts when: a repository needs an eleventh.`
   - the per-`agent_type` brief: `which deserves its own is real use's answer.`
     → `lifts when: real use shows a type whose brief should differ.`
   - the per-style `turn-reminder`: `lifts when: Claude Code ships a file-level
     key for it.`
   - `fanoutSync`'s payload: `lifts when: a 64MB overflow is observed.`

4. Rewrite `TODO.md:26-48`. The paragraph at 26-33 says the stamp is what the
   heading asks for; it now asks for two things, and the event is the one that
   says whether the entry belongs there at all. The paragraph at 35-48 lists
   what `todo-check` enforces — it enforces six things now, not five — and
   describes the seven-day list in the wording Task 2 replaced.

5. Run `node scripts/todo-check.js` **unpiped** and read its exit code with
   `echo $?`. A pipe reports the exit code of the last command in it, not of the
   check.

6. Run `node --test` for the whole suite.

7. Commit.

## Not in this plan, and why

- **Machine-checked events.** Two of the five surviving events could be checked
  by a script — "a repository needs an eleventh" is `skipped.noPattern`, "seven
  more plans have landed" is a count of `docs/archive/`. The other three cannot
  be, and a check that covers two entries out of five costs more than the
  reading it saves. The event is written for a person to answer.
- **`REREAD_DAYS`.** It has never printed anything: it landed in `c55c373` on
  2026-09-01 in the same commit that re-stamped every entry to that day, so the
  oldest stamp in the file is five days old and the first possible firing is
  2026-09-08. There is no evidence to change it on.
- **`MAX_ENTRY_CHARS`.** The clause replaces a sentence rather than adding one,
  so the cap is not under new pressure. If a surviving entry cannot be written
  inside 200 characters, that is the cap doing its job and the detail belongs in
  the file the entry points at.
- **A `--waiting` verb.** A way to print the section on demand is worth having
  and is not this change: the entries have to carry events before a listing of
  them is worth reading.
