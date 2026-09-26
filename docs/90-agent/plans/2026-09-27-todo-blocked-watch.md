---
status: design-intent
---

# TODO Blocked / Watch Implementation Plan

**Goal:** Split `TODO.md`'s `## Waiting` into `## Blocked` (a typed condition a session can check) and `## Watch` (an `if:` event only whoever meets it knows), in the checker, `orient`, the INIT rule, the pages that teach it, a decision record, and the file itself.
**Architecture:** `scripts/todo-check.js` owns the convention: `SECTIONS` gains `Blocked` and `Watch` and loses `Waiting`, a `###` is a timing under either, and the line after it is parsed as `on:`/`after:`/`upstream:`/`if:` instead of `lifts when:`. `timings()` returns `section`, `kind`, `due` (Blocked only) and `stale` (Watch only, 60 days), and `scripts/orient.js` prints the two sections and one patrol slot from those fields. Everything else is text: one INIT clause, six skill/doc pages, a decision record, and the `TODO.md` migration of §6.
**Tech Stack:** Node CJS (`'use strict'`, `require`), no dependencies, tests `node --test` (package.json `"test": "node --test"`), fankeel 0.79.0.
**Spec:** [2026-09-27-todo-blocked-watch-design.md](2026-09-27-todo-blocked-watch-design.md)

## Global Constraints

Generated from `node scripts/map.js` (298 markdown files, 4 planned, 150 retired), `.fankeel/map.md`, `package.json`, `CONTRIBUTING.md` and the caps the suite asserts. No `CLAUDE.md` exists at the root.

1. No dependencies may be added: `package.json` has no `dependencies` block and `"private": true`; only `node:` built-ins.
2. `scripts/*.js` and `lib/*.js` indent 4 spaces; `tests/todo-check.test.js`, `tests/orient.test.js`, `tests/render.test.js`, `tests/skills.test.js` indent 2 spaces. Match the file.
3. INIT cap, exact: `assert.ok(size < 1400, 'init block with a station line is ' + size + ' chars');` at `tests/render.test.js:565`, and `assert.ok(size < 1400, 'init block is ' ...)` at `tests/render.test.js:553`, both measured at the 59-character `REFERENCE_ROOT`. Measured on 2026-09-27 before this plan: init 1225, init+st 1342 — 57 characters of room. Task 3's clause adds 28 (82 against 54), landing at 1370. Never raise the cap.
4. Unchanged numbers in `scripts/todo-check.js`: `MAX_ENTRY_CHARS = 200` (:53), `REREAD_DAYS = 7` (:108), `MAX_TITLE_WIDTH = 28` (:141). New: `STALE_DAYS = 60`.
5. Every exported name needs an importer (`CONTRIBUTING.md:19`); `STALE_DAYS` is imported by `tests/todo-check.test.js`. A new file must be `git add`ed before `tests/source.test.js` can see it.
6. A frontmatter key other than `status`, `last_verified`, `source_of_truth` holding a bare path that resolves fails `tests/source.test.js:177` — the `superseded_by` value in Task 5 is backticked.
7. A new page gets its `docs/README.md` index row in the same change (`CONTRIBUTING.md:20`).
8. An overturned decision record keeps `status`; the overturned sentence gets a parenthetical annotation in place (`docs/90-agent/reference/documents.md:254-257`). Task 5 does both that and the design's `superseded_by`.
9. `TODO.md` migration is exactly the design's §6 table: Blocked `on:` 1 (gates 滿一週), Blocked `after:` 5, Blocked `upstream:` 2, Watch `if:` 15, one entry to `## Ready` (進行中卡片改版第二步), one to `## Needs a decision` (重跑成對量測). Blocked + Watch timings = 23; with the two moved = 25. Stamps stay `09-26`.
10. Every question in a gate is validated, not only the first: header at most `MAX_HEADER_WIDTH = 12` columns (`lib/handoff.js:156`), 2 to 4 options (`lib/handoff.js:184-185`), at most `MAX_QUESTIONS = 4` (`lib/handoff.js:164`); only option one's stage label is checked on `questions[0]` alone (`lib/handoff.js:204`). No code change in `lib/handoff.js` or `hooks/gate.js`.
11. Tasks 1, 2 and 6 are red between each other: after Task 1 alone, `tests/todo-check.test.js`'s `this project’s own TODO.md is an index` fails (the real `TODO.md` still says `## Waiting`) and `tests/orient.test.js` fails until Task 2. The full suite is green only once 1, 2 and 6 have all landed — the parent runs it before committing any of the three.
12. An implementer runs only its own test file (`node --test <its Test: file>`); the parent runs `npm test` before committing.
13. Edits go through Edit/Write, never `sed` (a sed that matched nothing once produced a commit claiming a change). CJK in `TODO.md` is moved by cut-and-paste of existing lines, never retyped.
14. Commits are local, subject style `feat:`/`fix:`/`docs:` as in `git log`; no push.
15. Skill pages and `docs/01-guide`, `docs/02-architecture` are English; `docs/03-decisions` pages are 繁體中文.

## Task 1: todo-check accepts Blocked and Watch

**Files:**
- Modify: `scripts/todo-check.js` — `SECTIONS`, the condition parser, `entries()`, `timings()`, `check()`, `report()`, exports
- Test: `tests/todo-check.test.js`

**Interfaces:**
- Consumes: none
- Produces: `SECTIONS = ['Ready', 'Needs a decision', 'Blocked', 'Watch']`; `STALE_DAYS = 60`; `timings(text, now)` returns `{ line, section, title, kind, event, stamp, date, days, due, stale, items }[]` where `section` is `'Blocked' | 'Watch'`, `kind` is `'on' | 'after' | 'upstream' | 'if' | null`, `due` is always `false` under Watch and `stale` always `false` under Blocked; `check(file, now)` returns the old fields plus `stale: { line, days, title, event, count }[]`, and `overdue` items carry `kind` and `event` (no `lifts`); problem kinds `unconditioned`, `wrong section`, `bad date` replace `unlifted`.

**Dispatch:** implementer, sonnet

### Step 1: the failing tests

In `tests/todo-check.test.js`, append at the end of the file:

```js
// 2026-09-27: `## Waiting` split in two. `## Blocked` holds what a session can
// check — a date, another piece of work, an upstream release; `## Watch` holds
// what only whoever meets it knows, and is never due, only stale.
const watchFixture = (body) => fixture('# TODO\n\n## Watch\n\n' + body);

test('an on: under ## Watch is refused, and so is an if: under ## Blocked', () => {
  assert.deepEqual(kinds(watchFixture('### t\non: 09-05. ' + stampFor(2) + '.\n\n- a\n'), NOW), ['wrong section']);
  for (const key of ['after', 'upstream']) {
    assert.deepEqual(kinds(watchFixture('### t\n' + key + ': x. ' + stampFor(2) + '.\n\n- a\n'), NOW), ['wrong section'], key);
  }
  assert.deepEqual(kinds(timingFixture('### t\nif: it breaks. ' + stampFor(2) + '.\n\n- a\n'), NOW), ['wrong section']);
});

// The control: each condition under its own heading passes, so the rule above
// is measuring the pairing and not "has a condition".
test('each condition under its own heading passes', () => {
  assert.deepEqual(kinds(watchFixture('### t\nif: it breaks. ' + stampFor(2) + '.\n\n- a\n'), NOW), []);
  for (const line of ['on: 09-05.', 'after: x.', 'upstream: y.']) {
    assert.deepEqual(kinds(timingFixture('### t\n' + line + ' ' + stampFor(2) + '.\n\n- a\n'), NOW), [], line);
  }
});

test('an on: not followed by an MM-DD is a bad date', () => {
  assert.deepEqual(kinds(timingFixture('### t\non: next week. ' + stampFor(2) + '.\n\n- a\n'), NOW), ['bad date']);
  assert.deepEqual(kinds(timingFixture('### t\non: 13-40. ' + stampFor(2) + '.\n\n- a\n'), NOW), ['bad date']);
});

test('## Waiting is no longer a heading: its entries are unclassified and name the two that replaced it', () => {
  const file = fixture('# TODO\n\n## Ready\n\n- r\n\n## Waiting\n\n### t\nlifts when: x. ' + stampFor(2) + '.\n\n- a\n');
  const problems = todo.check(file, NOW).problems;
  assert.deepEqual(problems.map((p) => p.kind), ['unclassified']);
  assert.match(problems[0].detail, /under "Waiting"/);
  assert.match(problems[0].detail, /## Blocked/);
  assert.match(problems[0].detail, /## Watch/);
});

// A file still wholly on the old heading is not a repository with its own
// vocabulary — `vocabulary` would otherwise spare it and pass the run.
test('a TODO.md still using ## Waiting alone is not another vocabulary', () => {
  const file = fixture('# TODO\n\n## Waiting\n\n### t\nlifts when: x. ' + stampFor(2) + '.\n\n- a\n');
  assert.deepEqual(kinds(file, NOW), ['unclassified']);
  assert.equal(todo.check(file, NOW).vocabulary, null);
  assert.equal(todo.main([file], NOW).ok, false);
});

test('a Watch entry under no timing is untimed, and the fix names if:', () => {
  const [p] = todo.check(fixture('# TODO\n\n## Watch\n\n- a\n'), NOW).problems;
  assert.equal(p.kind, 'untimed');
  assert.match(p.detail, /if: <the event>/);
});

test('a Watch timing stamped 61 days ago is stale, 59 days ago is not, and neither is ever due', () => {
  const at = (days) => todo.check(watchFixture('### t\nif: it breaks. ' + stampFor(days) + '.\n\n- a\n'), NOW);
  const old = at(61);
  assert.deepEqual(old.problems, [], 'a stale Watch timing is not a defect');
  assert.equal(old.stale.length, 1);
  assert.equal(old.stale[0].days, 61);
  assert.deepEqual(old.overdue, [], 'a Watch timing is never due');
  assert.deepEqual(at(59).stale, []);
  assert.equal(at(todo.STALE_DAYS).stale.length, 1, 'sixty days is stale');
});

test('the stale list prints the event and does not fail the run', () => {
  const file = watchFixture('### t\nif: the pool overflows. ' + stampFor(61) + '.\n\n- a\n');
  const { text, ok } = todo.main([file], NOW);
  assert.equal(ok, true);
  assert.match(text, /## Watch timings not re-read in 60 days or more/);
  assert.match(text, /61 days\s+t \(1\) — if: the pool overflows/);
});

test('a Blocked on: whose date has passed is due', () => {
  const result = todo.check(timingFixture('### t\non: 08-25. ' + stampFor(20) + '.\n\n- a\n'), NOW);
  assert.deepEqual(result.problems, []);
  assert.equal(result.overdue.length, 1);
  assert.equal(todo.mmdd(result.overdue[0].date), '08-25');
});
```

### Step 2: the existing tests move to the new headings

In `tests/todo-check.test.js`, inside string literals only (leave comments that describe history, at the `c50a5d5` block and the N26 block, as they are): replace every `## Waiting` with `## Blocked`, and every `lifts when:` with `after:`. Then these exact edits.

In `tests/todo-check.test.js`, replace the whole `test('all three headings are accepted', ...)` with:

```js
test('all four headings are accepted', () => {
  const body = todo.SECTIONS.map((s) => (s === 'Blocked'
    ? '## Blocked\n\n### one under Blocked\nafter: it happens. ' + TODAY + '.\n\n- one under Blocked\n'
    : s === 'Watch'
      ? '## Watch\n\n### one under Watch\nif: it happens. ' + TODAY + '.\n\n- one under Watch\n'
      : '## ' + s + '\n\n- one under ' + s + ' ' + TODAY + '.\n')).join('\n');
  const file = fixture('# TODO\n\n' + body);
  assert.deepEqual(kinds(file), []);
  assert.deepEqual(todo.check(file).counts, { Ready: 1, 'Needs a decision': 1, Blocked: 1, Watch: 1 });
});
```

In `tests/todo-check.test.js`, in `an index whose links all resolve passes`, the count assertion becomes:

```js
  assert.match(out, /1 entries — 1 ready, 0 needs a decision, 0 blocked, 0 watch/);
```

In `tests/todo-check.test.js`, in `a TODO.md whose every entry is off-convention reports once and passes`:

```js
  assert.match(out, /does not use the four headings/);
```

In `tests/todo-check.test.js`, in `a clean run reports the count under each heading`:

```js
  assert.match(out, /4 entries — 2 ready, 1 needs a decision, 1 blocked, 0 watch/);
```

In `tests/todo-check.test.js`, `'unlifted'` becomes `'unconditioned'` in `a Waiting entry that names no event is refused` and `an empty lifts clause names no event`; in `a timing with no lifts line is unlifted and undated` the assertion becomes:

```js
  assert.deepEqual(kinds(file, NOW).sort(), ['unconditioned', 'undated']);
```

In `tests/todo-check.test.js`, `the re-read list names the event to check` reads the field by its new name:

```js
  assert.equal(result.overdue[0].event, 'the pool overflows');
```

In `tests/todo-check.test.js`, the three date tests use `on:` — after the global replace their fixtures read `after: 09-05 onward, a week of gates.`, `after: 01-05 onward.` and `after: 09-05 onward.`; change each `after:` there to `on:`, and the report assertion in `the re-read list prints a due date timing by its date, with its title` to:

```js
  assert.match(text, /09-05\s+gates \(1\) — on: 09-05 onward/);
```

### Step 3: run and watch it fail

```
node --test tests/todo-check.test.js
```

Expect the nine new tests and the edited ones red (`wrong section`, `bad date`, `stale`, `unconditioned`, `STALE_DAYS` do not exist yet).

### Step 4: the implementation

In `scripts/todo-check.js`, replace the header comment's Waiting paragraph (the eight lines from `// Under \`## Waiting\` entries sit beneath a \`###\` timing` through `// twelve of thirteen entries named no event at all.`) with:

```js
// Under `## Blocked` and `## Watch` entries sit beneath a `###` timing — what
// they wait for — and the line after it carries a typed condition ending in a
// date stamp. Blocked takes `on: MM-DD`, `after: <work>` and `upstream: <thing>`:
// conditions a session can go and check. Watch takes `if: <event>`: an incident
// or a demand only whoever meets it will know of. A timing with no stamp is one
// nobody can age, one with no condition is one nobody is waiting for, and a
// condition under the other heading is misfiled — on 2026-09-27 a patrol found
// sixteen timings whose only question was "has it happened", which nobody could
// answer.
```

In `scripts/todo-check.js`, replace `const SECTIONS = ['Ready', 'Needs a decision', 'Waiting'];` with:

```js
const SECTIONS = ['Ready', 'Needs a decision', 'Blocked', 'Watch'];

// Under these two a `###` is a timing, not a heading, and each takes its own
// conditions. `Waiting` is the heading both replaced on 2026-09-27: a `###`
// under it still groups (so its entries report as unclassified under
// "Waiting", not under the timing's title), and it is never spared as another
// vocabulary.
const TIMED = ['Blocked', 'Watch'];
const CONDITIONS = { Blocked: ['on', 'after', 'upstream'], Watch: ['if'] };
const RETIRED = 'Waiting';

// A Watch timing is never due: nobody can check its event. What can go stale
// is the decision to keep watching, and sixty days is when it is asked again.
const STALE_DAYS = 60;
```

In `scripts/todo-check.js`, replace the `LIFTS` comment block, `const LIFTS = ...` and `function liftsAt(text) {...}` (from `// The event that would lift the entry, named rather than left to the reader.` through the closing brace of `liftsAt`) with:

```js
// The condition line: a key naming the kind of wait, then what it waits for,
// then the stamp. Anchored at the start of the line — a key buried mid-sentence
// is prose, not a condition. The stamp is stripped off the tail the same way
// `STAMP` finds it. What this cannot do: grade whether the text names anything
// real. `after: it seems worth revisiting.` passes.
const CONDITION = /^(on|after|upstream|if):\s*(.*)$/i;

function conditionAt(text) {
    const m = CONDITION.exec(text.replace(/\s+/g, ' ').trim());
    if (!m) return null;
    const event = m[2].replace(STAMP, '').trim().replace(/\.$/, '').trim();
    return { kind: m[1].toLowerCase(), event: event || null };
}
```

In `scripts/todo-check.js`, directly after `function dateAt(event, stamped) {...}`, add:

```js
// Whether an `on:` names a day the calendar has. 2000 is a leap year, so
// `02-29` is accepted here and left to `dateAt` to place in a year that has it.
function validOn(event) {
    const m = event === null ? null : DATE.exec(event);
    if (!m) return false;
    const month = Number(m[1]);
    const day = Number(m[2]);
    const at = new Date(2000, month - 1, day);
    return at.getMonth() === month - 1 && at.getDate() === day;
}
```

In `scripts/todo-check.js`, in `entries()`, replace:

```js
            // Under `## Waiting` a `###` is a timing, not a section: the entries
            // below it wait for the same thing and lift together. Anywhere else
            // it is a heading like any other, and still unclassified.
            if (/^#{3,6}\s/.test(line) && section === 'Waiting') {
```

In `scripts/todo-check.js`, with:

```js
            // Under `## Blocked` or `## Watch` a `###` is a timing, not a
            // section: the entries below it wait for the same thing and lift
            // together. Under the retired `## Waiting` it groups too, so its
            // entries are reported under "Waiting". Anywhere else it is a
            // heading like any other, and still unclassified.
            if (/^#{3,6}\s/.test(line) && (TIMED.includes(section) || section === RETIRED)) {
```

In `scripts/todo-check.js`, replace the comment above `timings()` and the whole function with:

```js
// Every `###` under `## Blocked` or `## Watch`, with the line after it read as
// its condition: the kind of wait, what it waits for, and the day somebody last
// agreed it still does. The first non-blank line is taken whatever it says, so
// a line with a stamp and no key is `unconditioned` rather than `undated` too.
// Blocked is due — `on:` from its date, the others seven days after the stamp;
// Watch is never due and goes stale sixty days after the stamp.
function timings(text, now) {
    const at = now === undefined ? Date.now() : now;
    const lines = text.split(/\r?\n/);
    const found = entries(text);
    const out = [];
    let section = '';
    for (let i = 0; i < lines.length; i++) {
        const h = /^(#{1,6})\s+(.*)$/.exec(lines[i]);
        if (!h) continue;
        if (h[1].length >= 3 && (TIMED.includes(section) || section === RETIRED)) {
            if (section === RETIRED) continue;
            let j = i + 1;
            while (j < lines.length && !lines[j].trim()) j++;
            const next = j < lines.length && !/^#{1,6}\s|^[-*]\s/.test(lines[j]) ? lines[j] : '';
            const cond = next ? conditionAt(next) : null;
            const kind = cond ? cond.kind : null;
            const event = cond ? cond.event : null;
            const stamp = next ? stampAt(next, at) : null;
            const date = kind === 'on' ? dateAt(event, stamp) : null;
            const days = stamp === null ? null : Math.floor((at - stamp) / 86400000);
            const watch = section === 'Watch';
            const due = watch ? false : date !== null ? at >= date : days !== null && days >= REREAD_DAYS;
            const stale = watch && days !== null && days >= STALE_DAYS;
            out.push({ line: i + 1, section, title: h[2].trim(), kind, event, stamp, date, days, due, stale,
                items: found.filter((e) => e.timing === i + 1) });
            continue;
        }
        section = h[2].trim();
    }
    return out;
}
```

In `scripts/todo-check.js`, in `check()`: the missing-file return becomes

```js
        return { file, missing: true, problems: [], overdue: [], stale: [] };
```

In `scripts/todo-check.js`, `const overdue = [];` is followed by `const stale = [];`. Replace the `untimed` block (from `// The stamp is asked for under \`Waiting\` and nowhere else.` through its closing brace) with:

```js
        // The stamp is asked for under `Blocked` and `Watch` and nowhere else.
        // `Ready` and `Needs a decision`'s newest few are read every time
        // `/fankeel` offers a menu, so those are looked at whether or not anyone
        // meant to; the two timed sections are the ones that are skipped by
        // design and therefore the ones that need a date to say when they last
        // were not.
        if (TIMED.includes(entry.section) && entry.timing === null) {
            const line = entry.section === 'Watch' ? 'if: <the event>' : 'on: MM-DD, after: <what> or upstream: <what>';
            problems.push({
                line: entry.line,
                kind: 'untimed',
                detail: 'under ## ' + entry.section + ' but under no ### timing. Put it beneath the ### naming what it'
                    + ' waits for, or open one: a title, then a "' + line + '. MM-DD." line.',
            });
        }
```

In `scripts/todo-check.js`, in the `unclassified` push, replace the `detail:` expression with:

```js
                detail: (entry.section ? 'under "' + entry.section + '"' : 'under no heading')
                    + '. Every entry sits under one of ' + SECTIONS.map((s) => '## ' + s).join(' · ')
                    + ', which is what says whether it can be started today.'
                    + (entry.section === RETIRED
                        ? ' ## Waiting was split on 2026-09-27: ## Blocked takes on:, after: and upstream:; ## Watch takes if:.'
                        : ''),
```

In `scripts/todo-check.js`, replace the timings loop in `check()` (from `// The stamp and the event live on the timing now,` through the `if (t.due) overdue.push(...)` line) with:

```js
    // The stamp and the condition live on the timing, one line for every entry
    // beneath it, so what used to be asked of each entry is asked here.
    for (const t of timings(text, at)) {
        if (t.stamp === null) {
            problems.push({
                line: t.line,
                kind: 'undated',
                detail: 'no MM-DD stamp on its condition line. End that line with the date somebody last read'
                    + ' this timing and confirmed it still holds — without one it cannot be told from'
                    + ' one nobody has looked at since it was filed.',
            });
        }
        if (t.kind === null || (t.event === null && t.kind !== 'on')) {
            problems.push({
                line: t.line,
                kind: 'unconditioned',
                detail: 'no condition on the line after it. Under ## Blocked write "on: MM-DD", "after: <what>"'
                    + ' or "upstream: <what>"; under ## Watch, "if: <the event>". A timing that cannot'
                    + ' name one is not waiting for anything.',
            });
        } else if (!CONDITIONS[t.section].includes(t.kind)) {
            problems.push({
                line: t.line,
                kind: 'wrong section',
                detail: '"' + t.kind + ':" belongs under ' + (t.kind === 'if' ? '## Watch' : '## Blocked')
                    + ', not ## ' + t.section + '. Blocked takes on:, after: and upstream: — something a session'
                    + ' can check; Watch takes if: — an event only whoever meets it knows.',
            });
        } else if (t.kind === 'on' && !validOn(t.event)) {
            problems.push({
                line: t.line,
                kind: 'bad date',
                detail: '"on:" is not followed by an MM-DD. It is the day the date is compared against;'
                    + ' a wait with no day is an "after:".',
            });
        }
        if (!t.items.length) {
            problems.push({
                line: t.line,
                kind: 'empty timing',
                detail: 'no entries under it. A timing lifts the entries beneath it; with none it is'
                    + ' waiting for nothing — remove it.',
            });
        }
        const w = width(t.title);
        if (w > MAX_TITLE_WIDTH) {
            problems.push({
                line: t.line,
                kind: 'long title',
                detail: w + ' columns, cap is ' + MAX_TITLE_WIDTH + ' — a CJK character counts two.'
                    + ' The title names the timing; the condition goes on the line after it.',
            });
        }
        if (t.due) overdue.push({ line: t.line, days: t.days, title: t.title, kind: t.kind, event: t.event, date: t.date, count: t.items.length });
        if (t.stale) stale.push({ line: t.line, days: t.days, title: t.title, event: t.event, count: t.items.length });
    }
```

In `scripts/todo-check.js`, the `vocabulary` expression gains one clause, and the return carries `stale`:

```js
    const vocabulary = found.length > 0
        && named.length === found.length
        && off.length === found.length
        && !found.some((e) => e.section === RETIRED)
        ? [...new Set(found.map((e) => e.section))]
        : null;
```

In `scripts/todo-check.js`, the return:

```js
    overdue.sort((a, b) => b.days - a.days);
    stale.sort((a, b) => b.days - a.days);
    return { file, missing: false, count: found.length, counts, problems, overdue, stale, needsDecisionDue, vocabulary };
```

In `scripts/todo-check.js`, in `report()`: the vocabulary sentence says four instead of three:

```js
        lines.push('This TODO.md does not use the four headings ' + SECTIONS.map((s) => '## ' + s).join(' · ')
            + ' — it uses ' + result.vocabulary.map((s) => '## ' + s).join(' · ')
            + '. Nothing here says which entries can be started today, which is what those four are for.');
```

In `scripts/todo-check.js`, the overdue block is replaced by an overdue block and a stale block:

```js
    // Below the verdict and outside it. These are not defects — a timing can
    // sit correctly filed for a month — so the run stays green and the list is
    // the prompt to go and look.
    if (result.overdue && result.overdue.length) {
        lines.push('', '  due for a re-read — the date has come, or nobody has checked the condition in '
            + REREAD_DAYS + ' days or more:');
        for (const o of result.overdue) {
            const when = o.date !== null ? mmdd(o.date) + '   ' : String(o.days).padStart(3) + ' days';
            const short = (o.title + ' (' + o.count + ') — ' + (o.kind ? o.kind + ': ' : '') + (o.event || '')).replace(/\s+/g, ' ').trim();
            lines.push('    ' + result.file + ':' + o.line + '  ' + when + '  '
                + (short.length > 72 ? short.slice(0, 71) + '…' : short));
        }
    }
    // Watch is never due. What a stale one asks is whether to keep watching —
    // keep it and restamp, or drop it — not whether its event happened.
    if (result.stale && result.stale.length) {
        lines.push('', '  ## Watch timings not re-read in ' + STALE_DAYS + ' days or more — keep and restamp, or drop:');
        for (const o of result.stale) {
            const short = (o.title + ' (' + o.count + ') — if: ' + (o.event || '')).replace(/\s+/g, ' ').trim();
            lines.push('    ' + result.file + ':' + o.line + '  ' + String(o.days).padStart(3) + ' days  '
                + (short.length > 72 ? short.slice(0, 71) + '…' : short));
        }
    }
```

In `scripts/todo-check.js`, the export line becomes:

```js
module.exports = { MAX_ENTRY_CHARS, REREAD_DAYS, STALE_DAYS, SECTIONS, linksIn, entries, timings, width, mmdd, check, report, main };
```

### Step 5: run and watch it pass

```
node --test tests/todo-check.test.js
```

Every test green except `this project’s own TODO.md is an index`, which stays red until Task 6 migrates the real `TODO.md` (Global Constraint 11). Any other red is this task's.

### Step 6: commit

Hand back to the parent; it commits after running the full suite with Tasks 2 and 6 (Global Constraint 11).

## Task 2: orient prints Blocked, Watch and one patrol slot

**Files:**
- Modify: `scripts/orient.js` — `todoBlock()` and the comment above `AUDIT_DAYS`
- Read: `scripts/todo-check.js` — `timings()` fields `section`, `due`, `stale`, `date`; `mmdd()`
- Test: `tests/orient.test.js`

**Interfaces:**
- Consumes: from Task 1, `todoCheck.timings(text, now)` items `{ section: 'Blocked' | 'Watch', title, date, due, stale, items }` and `todoCheck.mmdd(ms)`.
- Produces: the `todo:` block lines `  Blocked <n> timing(s), <m> entry/entries — <k> due`, `  Watch <n> timing(s), <m> entry/entries — <s> stale`, and `  patrol: <k> due + <s> stale, offer one option` or `  patrol: none due or stale, not offered`.

**Dispatch:** implementer, sonnet

### Step 1: the failing tests

In `tests/orient.test.js`, replace every `'## Waiting'` in the fixtures of `the todo: block offers the newest edits under Needs a decision, oldest edit last`, `a Ready entry drops the offer from 4 to 3`, `what is offered plus "and N more" equals todo-check's own count`, `editing only the heading after the last entry does not touch that entry's edit time`, `an edit to a continuation line alone moves its entry to first`, `a tie keeps the entry later in the file first, all the way down the shown list`, `an uncommitted edit outranks even a commit dated in the future` and `the todo: block says how many days since the last audit...` with `'## Blocked'` (in the audit test the literal is `'## Ready\n\n## Needs a decision\n\n## Blocked\n'`). In `editing only the heading...` the replace becomes `bodyV2.replace('## Blocked', '##  Blocked')`. In `what is offered plus...` the slice end becomes:

```js
  const waitingIdx = out.indexOf('\n  Blocked ', start);
```

In `tests/orient.test.js`, in `the todo: block offers the newest edits under Needs a decision, oldest edit last`, replace the final `Waiting 0 timings` assertion with:

```js
  assert.match(out, /Blocked 0 timings, 0 entries — 0 due/);
  assert.match(out, /Watch 0 timings, 0 entries — 0 stale/);
  assert.match(out, /patrol: none due or stale, not offered/);
```

In `tests/orient.test.js`, replace `test('a non-due Waiting timing still takes a slot from Needs a decision', ...)` with:

```js
test('a Blocked timing that is not due takes no slot from Needs a decision', () => {
  const root = workspace({});
  const opts = initGit(root);
  const body = [
    '## Ready',
    '',
    '## Needs a decision',
    '- Entry one',
    '- Entry two',
    '- Entry three',
    '- Entry four',
    '- Entry five',
    '',
    '## Blocked',
    '',
    '### gates a week old',
    'on: 09-25 onward, a week of gates. 09-18.',
    '',
    '- a',
  ].join('\n') + '\n';
  commitTodo(root, opts, body, '2026-09-18T00:00:00Z');

  const out = reportAt(root, 2026, 9, 20);
  assert.match(out, /Needs a decision 5 — newest 4 by last edit, offer these:/);
  assert.match(out, /Blocked 1 timing, 1 entry — 0 due/);
  assert.match(out, /patrol: none due or stale, not offered/);
});
```

In `tests/orient.test.js`, replace `test('the todo: block lists every Waiting timing and marks the due ones', ...)` with:

```js
test('the todo: block lists every Blocked timing and marks the due ones', () => {
  const root = workspace({});
  const opts = initGit(root);
  const body = [
    '## Ready',
    '',
    '## Needs a decision',
    '',
    '## Blocked',
    '',
    '### gates a week old',
    'on: 09-25 onward, a week of gates. 09-18.',
    '',
    '- a',
    '',
    '### an overflow seen',
    'after: an overflow is observed. 09-01.',
    '',
    '- b',
    '- c',
  ].join('\n') + '\n';
  commitTodo(root, opts, body, '2026-09-18T00:00:00Z');

  const early = reportAt(root, 2026, 9, 20);
  assert.match(early, /Blocked 2 timings, 3 entries — 1 due/);
  const lines = early.split(/\r?\n/);
  const head = lines.findIndex((l) => /Blocked 2 timings/.test(l));
  assert.match(lines[head + 1], /^\s+due\s+an overflow seen \(2\)$/, 'the due timing comes first');
  assert.match(lines[head + 2], /^\s+09-25\s+gates a week old \(1\)$/, 'a date not yet reached shows the date');
  assert.match(early, /patrol: 1 due \+ 0 stale, offer one option/);

  const late = reportAt(root, 2026, 9, 26);
  assert.match(late, /Blocked 2 timings, 3 entries — 2 due/);
});

test('the todo: block lists every Watch timing, stale ones first, and never marks one due', () => {
  const root = workspace({});
  const opts = initGit(root);
  const body = [
    '## Ready',
    '',
    '## Needs a decision',
    '',
    '## Watch',
    '',
    '### a demand appears',
    'if: someone asks for it. 09-01.',
    '',
    '- a',
    '',
    '### an incident again',
    'if: it breaks again. 07-01.',
    '',
    '- b',
    '- c',
  ].join('\n') + '\n';
  commitTodo(root, opts, body, '2026-09-01T00:00:00Z');

  const out = reportAt(root, 2026, 9, 3);
  assert.match(out, /Blocked 0 timings, 0 entries — 0 due/);
  assert.match(out, /Watch 2 timings, 3 entries — 1 stale/);
  const lines = out.split(/\r?\n/);
  const head = lines.findIndex((l) => /Watch 2 timings/.test(l));
  assert.match(lines[head + 1], /^\s+stale\s+an incident again \(2\)$/, 'the stale timing comes first');
  assert.match(lines[head + 2], /^\s+a demand appears \(1\)$/);
  assert.match(out, /patrol: 0 due \+ 1 stale, offer one option/);
});
```

In `tests/orient.test.js`, replace `test('a Waiting timing takes one option from Needs a decision whether or not it is due', ...)` and the comment above it with:

```js
// The control: the patrol takes one of AskUserQuestion's four slots only while
// a Blocked timing is due or a Watch timing is stale, and one slot covers both.
test('the patrol takes one option from Needs a decision only while something is due or stale', () => {
  const root = workspace({});
  const opts = initGit(root);
  const body = [
    '## Ready',
    '',
    '## Needs a decision',
    '- Entry one',
    '- Entry two',
    '- Entry three',
    '- Entry four',
    '- Entry five',
    '',
    '## Blocked',
    '',
    '### an overflow seen',
    'after: an overflow is observed. 09-01.',
    '',
    '- b',
    '',
    '## Watch',
    '',
    '### a demand appears',
    'if: someone asks for it. 09-01.',
    '',
    '- w',
  ].join('\n') + '\n';
  commitTodo(root, opts, body, '2026-09-01T00:00:00Z');
  assert.match(reportAt(root, 2026, 9, 3), /Needs a decision 5 — newest 4 by last edit, offer these:/, 'nothing due or stale: no slot');
  assert.match(reportAt(root, 2026, 9, 20), /Needs a decision 5 — newest 3 by last edit, offer these:/, 'a due Blocked timing: one slot');
  assert.match(reportAt(root, 2026, 11, 5), /Needs a decision 5 — newest 3 by last edit, offer these:/, 'due and stale together: still one slot');
});
```

### Step 2: run and watch it fail

```
node --test tests/orient.test.js
```

### Step 3: the implementation

In `scripts/orient.js`, replace the comment line `// Waiting is listed in full, one line per timing, and offered as one option whenever any exists.` with:

```js
// Blocked and Watch are listed in full, one line per timing, and share one
// patrol option only while a Blocked timing is due or a Watch timing is stale.
```

In `scripts/orient.js`, replace `todoBlock()` from `const readyCount = ...` to the end of the timing loop (the line before `const audit = auditLine(dir, now);`) with:

```js
    const blocked = timings.filter((t) => t.section === 'Blocked');
    const watch = timings.filter((t) => t.section === 'Watch');
    const readyCount = all.filter((e) => e.section === 'Ready').length;
    const blockedCount = all.filter((e) => e.section === 'Blocked').length;
    const watchCount = all.filter((e) => e.section === 'Watch').length;
    const dueCount = blocked.filter((t) => t.due).length;
    const staleCount = watch.filter((t) => t.stale).length;
    const patrol = dueCount + staleCount > 0;
    const needsCount = needs.length;
    // AskUserQuestion takes four. Ready's section is one option when it has
    // entries, and the patrol is one more only while a Blocked timing is due
    // or a Watch timing is stale — one slot for both, and Watch alone, never
    // due, takes none.
    const limit = 4 - (readyCount > 0 ? 1 : 0) - (patrol ? 1 : 0);
    const shown = ordered.slice(0, limit);

    const lines = ['todo: TODO.md', '  Ready ' + readyCount];
    if (needsCount === 0) {
        lines.push('  Needs a decision 0');
    } else {
        lines.push('  Needs a decision ' + needsCount + ' — newest ' + shown.length
            + ' by last edit, offer these:');
        for (const e of shown) {
            const t = e.text.replace(/\s+/g, ' ').trim();
            lines.push('    ' + (t.length > TODO_ENTRY_WIDTH ? t.slice(0, TODO_ENTRY_WIDTH - 1) + '…' : t));
        }
        const more = needsCount - shown.length;
        if (more > 0) lines.push('    and ' + more + ' more, not listed — Other takes one by name');
    }
    // Every timing, every time: what is waiting is on screen whether or not
    // it is offered, the way a skill's description is. Due and stale first.
    const tally = (name, ts, n, tail) => '  ' + name + ' ' + ts.length
        + (ts.length === 1 ? ' timing, ' : ' timings, ') + n + (n === 1 ? ' entry' : ' entries') + ' — ' + tail;
    lines.push(tally('Blocked', blocked, blockedCount, dueCount + ' due'));
    for (const t of blocked.filter((x) => x.due).concat(blocked.filter((x) => !x.due))) {
        const col = t.due ? 'due' : t.date !== null ? todoCheck.mmdd(t.date) : '';
        lines.push('    ' + col.padEnd(7) + t.title + ' (' + t.items.length + ')');
    }
    lines.push(tally('Watch', watch, watchCount, staleCount + ' stale'));
    for (const t of watch.filter((x) => x.stale).concat(watch.filter((x) => !x.stale))) {
        lines.push('    ' + (t.stale ? 'stale' : '').padEnd(7) + t.title + ' (' + t.items.length + ')');
    }
    lines.push('  patrol: ' + (patrol ? dueCount + ' due + ' + staleCount + ' stale, offer one option'
        : 'none due or stale, not offered'));
```

### Step 4: run and watch it pass

```
node --test tests/orient.test.js
```

### Step 5: commit

Hand back to the parent (Global Constraint 11).

## Task 3: the INIT clause names Blocked and Watch

**Files:**
- Modify: `lib/stages.js` — `INIT[1]`, one clause
- Test: `tests/render.test.js`

**Interfaces:**
- Consumes: none
- Produces: the INIT sentence `` `## Blocked`/`## Watch` share one option when `orient` marks any `due` or `stale`; ``

**Dispatch:** implementer, sonnet

### Step 1: the failing test

In `tests/render.test.js`, replace `test('init offers ## Waiting as one option whenever orient lists a timing', ...)` with:

```js
test('init offers ## Blocked and ## Watch one shared option, only when orient marks due or stale', () => {
  const out = renderInit({ sessionId: MINE });
  assert.match(out, /`## Blocked`\/`## Watch` share one option when `orient` marks any `due` or `stale`;/);
  assert.doesNotMatch(out, /## Waiting/);
});
```

### Step 2: run and watch it fail

```
node --test tests/render.test.js
```

### Step 3: the implementation

In `lib/stages.js`, inside `INIT[1]`, replace the clause

```
`## Waiting` is one option whenever it holds a timing;
```

with

```
`## Blocked`/`## Watch` share one option when `orient` marks any `due` or `stale`;
```

Nothing else in the string changes. The clause is 82 characters against 54, so init+st moves from 1342 to 1370 against the `< 1400` at `tests/render.test.js:565`.

### Step 4: run and watch it pass

```
node --test tests/render.test.js
```

Read the `init+st` diagnostic line and confirm it is under 1400 (expected 1370).

### Step 5: commit

```
git commit -o lib/stages.js tests/render.test.js -m "feat: INIT offers Blocked and Watch one patrol option when due or stale"
```

## Task 4: the pages that teach the convention

**Files:**
- Modify: `skills/fankeel/SKILL.md` — the deferred-work row, the headings sentence, the orient description, the menu paragraph
- Modify: `skills/fankeel-survey/SKILL.md` — `## Waiting tasks` becomes `## Blocked and Watch tasks`
- Modify: `skills/fankeel-build/SKILL.md` — `## Waiting tasks` becomes `## Blocked and Watch tasks`
- Modify: `skills/fankeel-land/SKILL.md` — the deferred-work row
- Modify: `skills/fankeel-audit/rationale.md` — the `routed:` paragraph
- Modify: `docs/01-guide/development.md` — the todo-check section
- Modify: `docs/02-architecture/pipeline.md` — two sentences naming `## Waiting`
- Modify: `CONTRIBUTING.md` — the `TODO.md` row
- Read: `lib/handoff.js` — gate validation at :156, :164, :174-212, quoted in the survey text
- Test: `tests/skills.test.js`

**Interfaces:**
- Consumes: none (the words `on:`, `after:`, `upstream:`, `if:`, `due`, `stale`, 60 days and the section name `## Blocked and Watch tasks` are fixed by this plan, not read from code)
- Produces: the section heading `## Blocked and Watch tasks` in both stage skills, which `skills/fankeel/SKILL.md` points at by path

**Dispatch:** implementer, sonnet

### Step 1: the failing tests

In `tests/skills.test.js`, replace the comment block and `test('every place that teaches the Waiting convention names the event before the stamp', ...)` with:

```js
// Four places tell someone how to file under `## Blocked` and `## Watch`, and
// `todo-check` fails a timing whose condition is missing, misfiled or undated.
// Each place is anchored to its own row or sentence, so a stray `if:` elsewhere
// on a long page cannot keep this green. Not hypothetical: c55c373 rolled the
// stamp out in three places in one commit and left the older shape in two more.
test('every place that teaches the Blocked/Watch convention names all four conditions and the stamp', () => {
  const need = ['## Blocked', '## Watch', 'on: MM-DD', 'after:', 'upstream:', 'if:', '`MM-DD` stamp'];
  for (const n of ['fankeel', 'fankeel-land']) {
    const row = read(n).split(/\r?\n/).find((l) => l.includes('## Blocked'));
    assert.ok(row, n + ' has no row naming ## Blocked');
    for (const s of need) assert.ok(row.includes(s), n + ' row does not name ' + s);
    assert.ok(!row.includes('lifts when:'), n + ' row still teaches lifts when:');
  }
  const prose = [
    ['docs/development.md', path.join(ROOT, 'docs', '01-guide', 'development.md'), '### <timing>` heading'],
    ['skills/fankeel-audit/rationale.md', path.join(DIR, 'fankeel-audit', 'rationale.md'), 'One routed to `## Blocked`'],
  ];
  for (const [label, file, anchor] of prose) {
    const flat = fs.readFileSync(file, 'utf8').replace(/\s+/g, ' ');
    const at = flat.indexOf(anchor);
    assert.ok(at !== -1, label + ' no longer has the sentence this test anchors on');
    const window = flat.slice(at, at + 700);
    for (const s of need.slice(2)) assert.ok(window.includes(s), label + ' does not name ' + s);
    assert.ok(!flat.includes('lifts when:'), label + ' still teaches lifts when:');
  }
});
```

In `tests/skills.test.js`, replace the comment block and `test('survey and build each carry their own half of the Waiting rule; fankeel points at both', ...)` with:

```js
// The patrol rule lives in the two stage skills that run it, because a stage
// agent reads its own skill and not skills/fankeel/SKILL.md — a real 2026-09-25
// survey run skipped the multiSelect step for exactly that reason.
test('survey and build each carry their own half of the Blocked/Watch patrol; fankeel points at both', () => {
  const survey = read('fankeel-survey');
  const surveySection = /\n## Blocked and Watch tasks\n[\s\S]*?\n## /.exec(survey);
  assert.ok(surveySection, 'fankeel-survey has no ## Blocked and Watch tasks section');
  assert.match(surveySection[0], /multiSelect: true/);
  assert.match(surveySection[0], /questions 2 to 4/);
  assert.match(surveySection[0], /at most twelve/);
  assert.doesNotMatch(survey, /## Waiting tasks/);

  const build = read('fankeel-build');
  const buildSection = /\n## Blocked and Watch tasks\n[\s\S]*?\n## /.exec(build);
  assert.ok(buildSection, 'fankeel-build has no ## Blocked and Watch tasks section');
  assert.match(buildSection[0], /## Ready/);
  assert.match(buildSection[0], /`if:`/);
  assert.doesNotMatch(buildSection[0], /lifts when:/);

  const fankeel = read('fankeel');
  assert.match(fankeel, /skills\/fankeel-survey\/SKILL\.md.*## Blocked and Watch tasks/s);
  assert.match(fankeel, /skills\/fankeel-build\/SKILL\.md.*## Blocked and Watch tasks/s);
  assert.doesNotMatch(fankeel, /## Waiting/);
});
```

### Step 2: run and watch it fail

```
node --test tests/skills.test.js
```

### Step 3: the text

In `skills/fankeel/SKILL.md`, the `Work deliberately deferred` row becomes:

```md
| Work deliberately deferred | `TODO.md`, one line, linking to the detail, under the heading for what it is short of — under `## Blocked`, beneath a `### <timing>` whose next line is `on: MM-DD`, `after: <what>` or `upstream: <what>`; under `## Watch`, one whose next line is `if: <the event>`; either line ending in a `MM-DD` stamp |
```

In `skills/fankeel/SKILL.md`, `of that convention — \`## Ready\`, \`## Needs a decision\`, \`## Waiting\` — and it` becomes:

```md
of that convention — `## Ready`, `## Needs a decision`, `## Blocked`, `## Watch` — and it
```

In `skills/fankeel/SKILL.md`, the two lines `block — the Ready count, Needs a decision's newest few by last edit, and every` / `Waiting timing, due ones first. It writes nothing.` become:

```md
block — the Ready count, Needs a decision's newest few by last edit, every
Blocked timing, due ones first, and every Watch timing, stale ones first. It writes nothing.
```

In `skills/fankeel/SKILL.md`, the text from `` `## Waiting` is one option whenever `orient`'s `todo:` block lists `` through `` `skills/fankeel-build/SKILL.md`'s `## Waiting tasks`. `land` runs `todo-check`. `` becomes:

```md
`## Blocked` and `## Watch` share one option — the patrol — and only while
`orient`'s `todo:` block marks a Blocked timing `due` or a Watch timing `stale`;
Watch on its own takes no slot. Their timings are never options one by one — six
unpickable rows are how a menu stops being read — but every one is listed in that
block each time, so what is waiting is on screen whether or not it is offered.
Picking the patrol starts a task with `--route "survey,build,land"`. `survey`'s
own skill and `build`'s own skill each carry their half of what that route does —
`skills/fankeel-survey/SKILL.md`'s `## Blocked and Watch tasks` and
`skills/fankeel-build/SKILL.md`'s `## Blocked and Watch tasks`. `land` runs `todo-check`.
```

(The sentence that follows, `Any other heading, or none, means clustering by hand`, stays.)

In `skills/fankeel-survey/SKILL.md`, replace the whole `## Waiting tasks` section (heading through the paragraph ending `the gate stays a separate, later question.`) with:

```md
## Blocked and Watch tasks

A task started by picking the patrol at `/fankeel` — offered while `orient`'s
`todo:` block marks a `## Blocked` timing `due` or a `## Watch` timing `stale` —
arrives on `--route "survey,build,land"`, and this stage's job on it is narrower
than the six steps above.

**Blocked, the due ones.** Every due Blocked timing is checked here directly,
never put to the user as "has it happened": each is under Blocked because a
session can check it. An `on:` is due because its day came — check that what it
was waiting for is now possible. An `after:` names another piece of work — check
the repository, its registry (`.fankeel/sessions/*.json` and the like) and
`git log`. An `upstream:` names a release or a project outside this one — check
it there. One whose condition checked out is lifted, folded into `## Ready` or
`## Needs a decision` per this stage's ordinary judgement; one that did not is
restamped with today's date.

**Watch, the stale ones.** A stale Watch timing — its stamp sixty days old or
more — is never asked whether its event happened: only whoever meets that event
knows, and they move the entry themselves when they do. What it is asked is
whether to keep it. The stale ones ride this stage's own gate call as questions
2 to 4 — `questions[0]` stays the gate, the only question whose option one must
name the next stage — each holding at most four timings in `TODO.md`'s own
order, `multiSelect: true`, each option's `label` the timing's title and its
`description` the `if:` event, the question asking which to keep. That is at most
twelve per patrol; the rest wait for the next one. Every question in the call is
validated, not only the first: a header at most 12 columns, a CJK character
counting two, and 2 to 4 options — so a question left holding a single timing
asks it as two options, keep and drop, with `multiSelect: false`. A timing kept
is restamped with today's date; one not kept is dropped, heading, `if:` line and
entries.
```

In `skills/fankeel-build/SKILL.md`, replace the whole `## Waiting tasks` section (heading through the paragraph ending `one hunk each.`) with:

```md
## Blocked and Watch tasks

A task started by picking the patrol at `/fankeel` arrives on
`--route "survey,build,land"`. By the time it reaches this stage `survey` has
checked every due `## Blocked` timing and put the stale `## Watch` timings it
had room for to the user as keep-or-drop, so there is no gate left to ask here,
only the moves those answers decide. A Blocked timing whose condition checked
out has its whole entry moved, together, to `## Ready` or `## Needs a decision`,
whichever survey sent it to, dropping its `###` heading and its `on:`, `after:`
or `upstream:` line. One that did not check out gets today's date as its stamp;
an `on:` whose day came while the work is still not possible gets a later
`on:` date instead. A Watch timing the user kept gets today's date as its stamp;
one the user dropped is deleted — heading, `if:` line and entries. All of a
batch's changes land in one commit — the stamps, the lifts and the drops
together — the way a batch of stamps and one lift landed in commit `22eff773`
on 2026-09-25, one hunk each.

A Watch entry also leaves by another door, not through this stage: a session
that meets the event an `if:` names moves the entry to `## Ready` or
`## Needs a decision` itself, dropping the `###` and the `if:` line.
```

In `skills/fankeel-land/SKILL.md`, the `work deliberately deferred` row becomes:

```md
| work deliberately deferred | `TODO.md`, one line, under the heading for what it is short of — under `## Blocked`, beneath a `### <timing>` whose next line is `on: MM-DD`, `after: <what>` or `upstream: <what>`; under `## Watch`, one whose next line is `if: <the event>`; either line ending in a `MM-DD` stamp; step 2's `todo-check` ran before this note existed, so run it again once the notes land |
```

In `skills/fankeel-audit/rationale.md`, the paragraph under `## Output` from `` `routed:` is the line that keeps `` through `` `todo-check.js` refuses it. `` becomes:

```md
`routed:` is the line that keeps a finding alive past this turn. Anything you
are not fixing here goes to `TODO.md` under `## Ready`, `## Needs a decision`,
`## Blocked` or `## Watch`, and that line names which — a finding that exists
only in this report is one the next sweep finds again from scratch. One routed to
`## Blocked` waits on something a session can check — a date, another piece of
work, an upstream release — and goes beneath the `### <timing>` it waits for,
whose next line is `on: MM-DD`, `after: <what>` or `upstream: <what>`; one routed
to `## Watch` waits for an incident or a demand only whoever meets it will know
of, under a line `if: <the event>`. Either line ends in a `MM-DD` stamp, or
`todo-check.js` refuses it.
```

In `docs/01-guide/development.md`, in the first todo-check paragraph, `every entry filed under \`## Ready\`, \`## Needs a decision\` or` / `` `## Waiting`, which is what says `` becomes `` every entry filed under `## Ready`, `## Needs a decision`, `## Blocked` or `## Watch`, which is what says ``, and `entry uses those three` becomes `entry uses those four`.

In `docs/01-guide/development.md`, replace the paragraph from `` Under `## Waiting`, entries are grouped by what they wait for `` through `` and `/fankeel` offers one option whenever it holds any. `` with:

```md
Under `## Blocked` and `## Watch`, entries are grouped by what they wait for: a
`### <timing>` heading at most 28 columns wide — a CJK character counts two —
whose next line is a typed condition and then a `MM-DD` stamp. `## Blocked`
takes the conditions a session can check: `on: MM-DD` for a date,
`after: <another piece of work>`, `upstream: <a release or project outside this one>`.
`## Watch` takes the one only whoever meets it can: `if: <the event>` — an
incident happening again, a demand turning up. todo-check fails an entry under
either heading with no timing, a timing with no entries, one missing its
condition or its stamp, a condition under the wrong heading (`if:` under
Blocked; `on:`, `after:` or `upstream:` under Watch), an `on:` not followed by an
`MM-DD`, and a title over the width; an entry under `## Waiting`, the heading
both replaced on 2026-09-27, is unclassified. The stamp is the day somebody last
read that timing and agreed it still holds — not the day it was filed. A Blocked
`on:` is due from its date; an `after:` or `upstream:` is due once its stamp is
seven days old, and the patrol's survey goes and checks it. A Watch timing is
never due: once its stamp is sixty days old it is **stale**, and what it asks is
not whether its event happened but whether it is still worth keeping — kept, the
stamp moves forward; dropped, it is deleted. Due and stale timings print below
the verdict without failing the run. `orient` lists every timing each time, and
`/fankeel` offers one patrol option whenever any is due or stale. A Watch entry
whose event arrives is moved to `## Ready` or `## Needs a decision` by the
session that met it.
```

In `docs/01-guide/development.md`, `` nobody writes `lifts when:` or a date on those bullets `` becomes `nobody writes a condition or a date on those bullets`.

In `docs/02-architecture/pipeline.md`, `` through Other, and `## Waiting` as one option whenever it holds a timing. A root `` becomes:

```md
through Other, and `## Blocked` and `## Watch` as one shared option only while a Blocked timing is due or a Watch timing stale. A root
```

and `` prints a `todo:` block (Ready, Needs a decision, Waiting) and the last five `` becomes `` prints a `todo:` block (Ready, Needs a decision, Blocked, Watch) and the last five ``.

In `CONTRIBUTING.md`, the `TODO.md` row becomes:

```md
| `TODO.md` | itself | One bullet per deferred thing, filed under `## Ready`, `## Needs a decision`, `## Blocked` or `## Watch`. No detail that belongs in the file the bullet links to. |
```

### Step 4: run and watch it pass

```
node --test tests/skills.test.js
```

Then `git grep -n "lifts when" -- skills docs/01-guide docs/02-architecture CONTRIBUTING.md` returns nothing, and `git grep -n "## Waiting" -- skills docs/01-guide docs/02-architecture CONTRIBUTING.md` returns only the `docs/01-guide/development.md` sentence naming it as the heading replaced on 2026-09-27.

### Step 5: commit

```
git commit -o skills/fankeel/SKILL.md skills/fankeel-survey/SKILL.md skills/fankeel-build/SKILL.md skills/fankeel-land/SKILL.md skills/fankeel-audit/rationale.md docs/01-guide/development.md docs/02-architecture/pipeline.md CONTRIBUTING.md tests/skills.test.js -m "docs: the skills and guide teach Blocked and Watch"
```

## Task 5: the decision record

**Files:**
- Modify: `docs/03-decisions/2026-09-27-todo-blocked-watch.md` — new file, the decision record
- Modify: `docs/03-decisions/2026-09-19-waiting-triggers.md` — `superseded_by` in frontmatter, three rows annotated
- Modify: `docs/README.md` — one index row for the new record

**Interfaces:**
- Consumes: none
- Produces: `docs/03-decisions/2026-09-27-todo-blocked-watch.md`

**Dispatch:** implementer, sonnet

### Step 1: the check that fails first

```
node scripts/docs-check.js
```

Record its last line; the new page does not exist yet, so nothing names it.

### Step 2: the record

Create `docs/03-decisions/2026-09-27-todo-blocked-watch.md` with:

```md
---
status: decision
last_verified: 2026-09-27
---

# TODO 分類重設：Blocked 與 Watch — 決策紀錄

一句話：`TODO.md` 的 `## Waiting` 拆成兩個標題。`## Blocked` 放能檢查的等待，條件行是 `on: MM-DD`、`after: <文字>` 或 `upstream: <文字>`；`## Watch` 放只有撞到的人知道的事，條件行是 `if: <事件>`。

設計見 [../90-agent/plans/2026-09-27-todo-blocked-watch-design.md](../90-agent/plans/2026-09-27-todo-blocked-watch-design.md)，計畫見 [../90-agent/plans/2026-09-27-todo-blocked-watch.md](../90-agent/plans/2026-09-27-todo-blocked-watch.md)。

## 為什麼

09-27 巡查 `## Waiting` 時，16 個時機只能問人「發生了沒」，人答不出來，只能重蓋戳記；受控 survey 的見證提問又被 `hooks/gate.js` 擋下（`questions[0]` 的選項一必須是站名）。使用者選了方案 A：四個標題，Blocked 用分型條件。

## 定案

| 問題 | 定案 | 取代 09-19 的哪一條 |
|---|---|---|
| 標題 | 四個：`## Ready`、`## Needs a decision`、`## Blocked`、`## Watch`；`## Waiting` 底下的條目報成 unclassified | 「標題掛在哪」裡的 `## Waiting` |
| 條件行 | 分型：Blocked 用 `on:`、`after:`、`upstream:`，Watch 用 `if:`；放錯區、`on:` 後面不是 `MM-DD` 都拒絕 | 「要不要 kind 標籤：不加」 |
| 誰判斷 | Blocked 的 `on:` 由程式比日期；`after:`、`upstream:` 戳記滿 7 天 `due`，由 survey 去查。Watch 不問發生了沒，戳記滿 60 天 `stale`，只問還留嗎 | 「誰判斷」裡「只有人看得到的事，用一次 multiSelect 問」 |
| 在哪裡看到 | `orient` 分 Blocked、Watch 兩段；`/fankeel` 有 `due` 或 `stale` 時給一個巡查選項，Watch 本身不佔格 | 「在哪裡看到」裡「有 `due` 時給一個選項」 |
| stale 怎麼問 | survey gate 同一次呼叫的第 2–4 題，每題最多 4 條、`multiSelect: true`，一次最多 12 條，其餘留到下次 | 新增 |
| 事件發生時 | 撞到的 session 把 Watch 條目搬進 `## Ready` 或 `## Needs a decision`，拿掉 `###` 和 `if:` 行 | 新增 |

照舊：`### <時機>` 分組、行尾 `MM-DD` 戳記、標題 28 欄上限、7 天的 due 門檻、程式只判日期。

## 搬移

25 個時機：Blocked 8（`on:` 1、`after:` 5、`upstream:` 2）、Watch 15、搬進 `## Ready` 1、搬進 `## Needs a decision` 1。戳記照舊是 09-26。

## 沒驗到的

stale 的 Watch 放在 survey gate 的第 2–4 題，還沒從受控 survey 實際送出過一次。`lib/handoff.js` 每一題都驗：header 最多 12 欄、選項 2 到 4 個；只有「選項一是站名」只驗 `questions[0]`。所以只剩一條的題目要寫成「留／刪」兩個選項。
```

### Step 3: the record it replaces

In `docs/03-decisions/2026-09-19-waiting-triggers.md`, the frontmatter becomes:

```md
---
status: decision
last_verified: 2026-09-19
superseded_by: `docs/03-decisions/2026-09-27-todo-blocked-watch.md`
---
```

In `docs/03-decisions/2026-09-19-waiting-triggers.md`, append to the 定案 cell of three rows, inside the cell and before its closing `|`, the annotation `（09-27 起由 [2026-09-27-todo-blocked-watch.md](2026-09-27-todo-blocked-watch.md) 取代）`: the `誰判斷` row, the `要不要 kind 標籤` row and the `在哪裡看到` row. The body, `status` and `last_verified` are otherwise untouched.

### Step 4: the index row

In `docs/README.md`, directly after the row whose description begins `The four tasks that land it` (the 09-19 plan), add:

```md
| Why `## Waiting` split into `## Blocked` (a condition a session can check: `on:`, `after:`, `upstream:`) and `## Watch` (`if:` an event only whoever meets it knows), and which rows of the 09-19 decision that replaces | [decisions/2026-09-27-todo-blocked-watch.md](03-decisions/2026-09-27-todo-blocked-watch.md) — *繁體中文* |
```

### Step 5: run and watch it pass

```
git add docs/03-decisions/2026-09-27-todo-blocked-watch.md
node scripts/docs-check.js
node --test tests/source.test.js
```

`docs-check` exits 0 with every reference resolving, including the backticked `superseded_by` value; `tests/source.test.js` stays green (the value is backticked, so `no frontmatter key nothing reads carries a repository path` skips it).

### Step 6: commit

```
git commit -o docs/03-decisions/2026-09-27-todo-blocked-watch.md docs/03-decisions/2026-09-19-waiting-triggers.md docs/README.md -m "docs: decision — TODO Waiting splits into Blocked and Watch"
```

## Task 6: TODO.md moves to Blocked and Watch

**Files:**
- Modify: `TODO.md` — preamble rewritten; 25 timings moved per the design's §6
- Read: `scripts/todo-check.js` — the parser Task 1 left, which this file must pass

**Interfaces:**
- Consumes: from Task 1, `SECTIONS = ['Ready', 'Needs a decision', 'Blocked', 'Watch']` and the `on:`/`after:`/`upstream:`/`if:` condition line; from Task 2, the `Blocked <n> timings` and `Watch <n> timings` lines of `orient`'s `todo:` block
- Produces: none

**Dispatch:** implementer, sonnet

### Step 1: the check that fails first

```
node scripts/todo-check.js
```

After Task 1 this exits 1: every entry under `## Waiting` is `unclassified`.

### Step 2: the preamble

In `TODO.md`, the table becomes:

```md
| Heading | What it is waiting for | What `/fankeel` does with it |
|---|---|---|
| `## Ready` | nothing but someone's hands. The bullet is the specification | the whole section is offered as **one** task |
| `## Needs a decision` | a person, to settle what the change should be | the newest few `orient` lists, one task each, starting at `design` |
| `## Blocked` | something a session can check: a date, another piece of work, an upstream release | grouped under `### <timing>`; every timing listed; a due one earns the patrol option |
| `## Watch` | an event only whoever meets it will know of: an incident happening again, a demand turning up | grouped under `### <timing>`; every timing listed; a stale one earns the patrol option; whoever meets the event moves the entry out |
```

In `TODO.md`, `of the three they are short of. A later reader has to guess.` becomes `of the four they are short of. A later reader has to guess.`, and the two lines `` Under `## Waiting` a `###` is not a topic either: it is the timing its entries `` / `wait for, and they lift together when it comes.` become:

```md
Under `## Blocked` and `## Watch` a `###` is not a topic either: it is the timing
its entries wait for, and they lift together when it comes.
```

In `TODO.md`, replace the four paragraphs from `` Under `## Waiting` entries sit beneath a `### <timing>` `` through `what gets scheduled.` (the last line before `## Ready`) with:

```md
Under `## Blocked` and `## Watch` entries sit beneath a `### <timing>` — a title
at most 28 columns wide, a CJK character counting two — whose next line is a
typed condition and then a `MM-DD` stamp. Under `## Blocked` the condition is one
a session can check: `on: MM-DD` for a date, `after: <another piece of work>`, or
`upstream: <a release or project outside this one>`. Under `## Watch` it is
`if: <the event>` — an incident happening again, a demand turning up — which
nobody can check and only whoever meets it will know of. On 2026-09-27 a patrol
of the old `## Waiting` found sixteen timings of this second kind: the only
question it could ask of them was whether they had happened, and nobody could
answer. The stamp is **the day somebody last read the timing and agreed it still
holds**, not the day it was filed: re-read one, decide it stays, and move the
stamp forward in the same change. The stamp goes last, because that is where the
check looks for it.

A Blocked `on:` is due that day; an `after:` or `upstream:` is due once its stamp
is seven days old, and the patrol's survey goes and checks it. A Watch timing is
never due. Once its stamp is sixty days old it is stale, and the patrol asks only
whether to keep it — kept, the stamp moves forward; dropped, it goes. When a
session meets the event an `if:` names, that session moves the entry to
`## Ready` or `## Needs a decision` itself and drops the `###` and the `if:` line.
`## Ready` and `## Needs a decision`'s newest few are read aloud every time
`/fankeel` offers a menu, so those get looked at whether anyone meant to or not;
`orient` lists every Blocked and Watch timing each time, and `/fankeel` offers
one patrol option whenever any is due or stale.

`node scripts/todo-check.js` enforces every one of these: a link that no longer
resolves is an entry someone forgot to close, a `path:line` whose line is past
the end of the file is a citation the code moved out from under, a link that
still resolves but points at a plan, a decision record, a report or an archive is
the same entry one step earlier — those four roles record a moment rather than
the present — an entry over the length cap is detail written here instead of
where it belongs, an entry under any other heading — `## Waiting` included — is
one nobody said the state of, an entry under `## Blocked` or `## Watch` under no
timing is one nobody said what it waits for, a timing with no stamp is one nobody
can tell a fresh deferral from a forgotten one, a timing with no condition is one
nobody is waiting for, a condition under the wrong heading is a misfiled one, an
`on:` with no `MM-DD` after it is a date nobody can compare, a timing with no
entries is waiting for nothing, and a title over 28 columns is a sentence where a
name belongs.

It also prints, without failing the run, every Blocked timing that is due and
every Watch timing that is stale. Neither list is a defect report: a timing can
sit there correctly filed for a month. The sections are drained by being read, so
the reading is what gets scheduled.
```

### Step 3: the migration

Move lines by cut and paste; never retype a bullet (Global Constraint 13). The file ends up in this order: `## Ready`, `## Needs a decision`, `## Blocked`, `## Watch`; the `## Waiting` heading is deleted.

**To `## Ready`** — the bullet under `### 進行中卡片改版第二步` is appended below the existing Trovara bullet; its `###` line and `lifts when:` line are deleted.

**To `## Needs a decision`** — in `TODO.md`, a new `## Needs a decision` heading after `## Ready`, holding the bullet under `### 重跑成對量測` with its text changed to:

```md
- 〔stage-agents〕ab.sh 改成在 worktree 裡 commit profile（`pin.sh`）；修好的 script 還沒重跑，重跑要核准約 $30（09-25 兩個 arm 合計） — [docs/reports/evidence/2026-09-26-ab-profile-pin/ab.sh](docs/90-agent/reports/evidence/2026-09-26-ab-profile-pin/ab.sh).
```

and its `###` line and `lifts when:` line deleted.

**To `## Blocked`**, in this order, each `###` block moved whole with its bullets, and only its `lifts when: ` prefix changed to the key shown (the rest of the line, stamp included, is kept as it is):

| `###` title | `lifts when: ` becomes |
|---|---|
| gates 滿一週 | `on: ` |
| 交接後 context 仍過 400k | `after: ` |
| docs-audit 報未點名模組 | `after: ` |
| brain 的 context 撐不住 | `after: ` |
| 受控 build/verify 實跑 | `after: ` |
| TokenBar 寫出真實序列 | `after: ` |
| knip 認得 CJS namespace | `upstream: ` |
| AI CODING SECURITY 定案 | `upstream: ` |

The `gates 滿一週` line then reads `` on: 10-02 起，registry 的 `gates` 累積滿一週. 09-26. `` — it opens with `10-02`, so `validOn` accepts it and it is due on 10-02.

**To `## Watch`**, in this order, each `###` block moved whole, `lifts when: ` becoming `if: `:

需要第十一種語言 · 下一個前端任務 · guard 測試再紅一次 · 放行規則有沒有效 · 第二個平台的使用者 · sonnet 花費成瓶頸或要離線 · implementer 互相蓋檔 · 站頁介面只有中文 · 文件全文搜尋有人要 · 首次繪圖變慢一次 · gate 等待時間量不準 · tune 還原誤刪一次 · 即時 session 缺 subagent · git mv 漏一半提交 · 兩個 hook 逾時

### Step 4: run and watch it pass

```
node scripts/todo-check.js
node scripts/orient.js
node --test tests/todo-check.test.js
git grep -n "lifts when:\|## Waiting" -- TODO.md
```

`todo-check.js` exits 0 and prints `2 ready, 1 needs a decision, 16 blocked, 15 watch`. `orient.js`'s `todo:` block prints `Blocked 8 timings, 16 entries` and `Watch 15 timings, 15 entries` — 8 + 15 = 23, and with the one moved to Ready and the one moved to Needs a decision, 25. `this project’s own TODO.md is an index` is green. The `git grep` prints only the two preamble lines that name `## Waiting` as the heading that was replaced, and no `lifts when:`.

### Step 5: commit

The parent runs `npm test`, then commits Tasks 1, 2 and 6 (Global Constraint 11):

```
git commit -o scripts/todo-check.js tests/todo-check.test.js scripts/orient.js tests/orient.test.js TODO.md -m "feat: TODO Waiting splits into Blocked and Watch — todo-check, orient, the file"
```

## Coverage

| promise | task |
|---|---|
| `TODO.md` 的標題是 `## Ready`、`## Needs a decision`、`## Blocked`、`## Watch`；`## Waiting` 不再被接受。 | Task 1 (SECTIONS, retired-heading detail, vocabulary guard), Task 6 |
| `Blocked` 放能檢查的等待：前一件事、日期、上游。`Watch` 放事故再發生與需求出現，只有撞到的人知道。 | Task 1 (CONDITIONS), Task 4, Task 6 (preamble) |
| 兩區都用 `### <時機>` 分組，標題上限仍是顯示寬度 28 欄。 | Task 1 (TIMED in entries() and timings(); MAX_TITLE_WIDTH unchanged) |
| `### <時機>` 的下一行是一個分型條件，取代 `lifts when:`：Blocked 用 `on: MM-DD`、`after: <文字>`、`upstream: <文字>`；Watch 用 `if: <事件>`。行尾照舊是 `MM-DD.` 戳記。 | Task 1 (CONDITION, conditionAt) |
| 型別放錯區就被 `todo-check.js` 拒絕：Blocked 底下的 `if:`、Watch 底下的 `on:`／`after:`／`upstream:`。 | Task 1 (`wrong section`) |
| `on:` 後面必須是 `MM-DD`，否則拒絕。 | Task 1 (`bad date`, validOn) |
| Blocked：`on:` 由程式比日期，日期到了就 `due`；`after:`、`upstream:` 在戳記滿 7 天時 `due`，由 survey 去查。 | Task 1 (due), Task 4 (survey section) |
| Watch：戳記滿 60 天算 `stale`，不問「發生了沒」，只問「還留嗎」；留就重蓋戳記，不留就刪。 | Task 1 (STALE_DAYS, stale list), Task 4 (survey and build sections) |
| Watch 的條目在事件發生時，由撞到的 session 搬進 `## Ready` 或 `## Needs a decision`，拿掉 `###` 和 `if:` 行。 | Task 4 (build section, development.md), Task 6 (preamble) |
| `orient.js` 的 `todo:` 區塊分兩行：Blocked 列每個時機、`due` 在前；Watch 列每個時機的標題與 `stale` 數。 | Task 2 |
| `/fankeel` 有 `due` 或 `stale` 時給一個「巡查」選項，兩者合在同一格；Watch 本身不佔選單格。 | Task 2 (patrol slot), Task 3 (INIT), Task 4 (skills/fankeel/SKILL.md) |
| 巡查走 `survey,build,land`。survey 直接查 due 的 Blocked；stale 的 Watch 放進 survey gate 同一次呼叫的第 2–4 題，每題最多 4 條、`multiSelect: true`，一次最多 12 條，其餘留到下次。`lib/handoff.js:204` 只驗 `questions[0]`。 | Task 4 (survey section; the validation note corrected per Global Constraint 10) |
| `lib/stages.js` 的 INIT 句改寫成 Blocked／Watch，init+station 注入仍在 1400 以下。 | Task 3 |
| `skills/fankeel/SKILL.md`、`skills/fankeel-survey/SKILL.md`、`skills/fankeel-build/SKILL.md`、`skills/fankeel-land/SKILL.md`、`skills/fankeel-audit/rationale.md`、`docs/01-guide/development.md` 改成 Blocked／Watch 的寫法。 | Task 4 |
| 新決策 `docs/03-decisions/2026-09-27-todo-blocked-watch.md` 寫明取代 09-19 決策的哪幾條；09-19 那頁加 `superseded_by`。 | Task 5 |
| `tests/todo-check.test.js`、`tests/skills.test.js` 的錨點跟著改。 | Task 1, Task 4 |
| Blocked `on:` — gates 滿一週（10-02） | Task 6 |
| Blocked `after:` — 交接後 context 仍過 400k、docs-audit 報未點名模組、brain 的 context 撐不住、受控 build/verify 實跑、TokenBar 寫出真實序列 | Task 6 |
| Blocked `upstream:` — knip 認得 CJS namespace、AI CODING SECURITY 定案 | Task 6 |
| Watch `if:` — the fifteen timings from 需要第十一種語言 to 兩個 hook 逾時 | Task 6 |
| `## Ready` — 進行中卡片改版第二步（已核准） | Task 6 |
| `## Needs a decision` — 重跑成對量測（要核准約 $30） | Task 6 |
| `tests/todo-check.test.js` 新增的測試現在是紅的、改完是綠的：`## Watch` 底下的 `on:` 被拒；`## Waiting` 被報成未知標題；Watch 戳記 61 天前 → `stale`、59 天前 → 不 stale；Blocked `on:` 過期 → `due`。 | Task 1 (Step 1 red, Step 5 green) |
| 產物那一列：搬完後的 `TODO.md` 跑 `todo-check.js` exit 0，而且 `orient.js` 印出的 Blocked 與 Watch 時機數加起來是 23；Ready 那 1 條、Needs a decision 那 1 條另外算，總數對得上 25。 | Task 6 (Step 4) |
