---
status: current
last_verified: 2026-09-27
---

# `## Waiting` warning, `todo-check --migrate`, and the resumed stage agent's answer file Implementation Plan

**Goal:** orient warns about entries still under the retired `## Waiting`, `todo-check --migrate` moves the typed ones out, and `hooks/resume.js` writes a controlled stage's answer file whenever the answered questions are the handoff's own gate.
**Architecture:** Three independent edits, one per design section. `todoBlock()` gains one conditional line; `todo-check.js` gains two unexported functions (`migrate`, `leftovers`) and a `--migrate` branch in `main()` that writes and then runs the unchanged check; `resume.js` swaps its `!mine.inflight` condition for the `readGate` + `gateMatches` pair `hooks/gate.js` already uses, with an absent `multiSelect` read as `false` on both sides.
**Tech Stack:** Node.js built-ins only (`node:fs`, `node:path`, `node:util`), CommonJS, `node --test`.
**Spec:** [design.md](../../../.fankeel/build/task-20260926T224445/design.md)

## Global Constraints

Generated 2026-09-27 from `node scripts/map.js` (300 markdown files, 3 planned), `.fankeel/map.md`, `package.json`, `CONTRIBUTING.md` (there is no `CLAUDE.md` — `CONTRIBUTING.md:3` says so) and the suite.

- **CommonJS, strict.** Every file touched opens with `'use strict';` and uses `require` / `module.exports` (`scripts/todo-check.js:2`, `hooks/resume.js:2`, `tests/gate.test.js:1`).
- **Indentation is per directory:** 4 spaces in `scripts/` and `hooks/` (`scripts/orient.js`, `scripts/todo-check.js`, `hooks/resume.js`); 2 spaces in `tests/*.test.js` (`tests/orient.test.js`, `tests/todo-check.test.js`, `tests/gate.test.js`).
- **Tests run with `node --test`** — `package.json` `"test": "node --test"`. An implementer runs only its own test file; the parent runs `npm test` before committing a group.
- **No dependencies, none added.** `package.json` has no `dependencies` field; `CONTRIBUTING.md` lists "no new dependency" under Maintenance. Only `node:` built-ins.
- **Every hook exits 0 on every path** (`CONTRIBUTING.md:17`, `README.md:258`). New code in `hooks/resume.js` stays inside the existing `try { … } catch (e) { /* housekeeping */ }`.
- **`lib/` is pure; nothing in `lib/` reaches into `scripts/` or `hooks/`** (`CONTRIBUTING.md:15`). This plan changes no `lib/` file.
- **Every exported name needs an importer, and a new test file must be `git add`ed before `tests/source.test.js` sees it** (`CONTRIBUTING.md:19`). `migrate` and `leftovers` stay unexported; no new test file is created.
- **Scratch directories come from `tests/tmp.js`** (`tmp(prefix)`), which removes them at exit.
- **Version numbers move only through `scripts/version.js`** (`CONTRIBUTING.md:24`). This plan moves none.
- **`TODO.md`:** one bullet per deferred thing under `## Ready`, `## Needs a decision`, `## Blocked` or `## Watch` (`CONTRIBUTING.md:22`); whoever finishes the work removes the entry in the same change (`TODO.md:5`). `tests/todo-check.test.js:205` runs the check on this repository's own `TODO.md`, so it must stay clean.
- **Filing:** `docs/90-agent/plans` is the `plan` bucket, `docs/90-agent/reference` is `reference` (`.fankeel/map.md`, filing). A new page gets its `docs/README.md` index row in the same change (`CONTRIBUTING.md:20`) — this plan page's own row goes in with its commit.
- **After a documentation edit, `node scripts/docs-check.js`** must still pass (the map's signpost: "Every reference still resolves").
- **`hooks/resume.js` stays one `PostToolUse` entry on `AskUserQuestion`, timeout 5** (`tests/resume.test.js:230-238`); no manifest change.
- **Commit subjects** use the repository's prefixes: `feat:`, `fix:`, `docs:` (`git log`).

## File structure

| file | task | responsibility after this plan |
|---|---|---|
| `scripts/orient.js` | 1 | `todoBlock()` also counts `## Waiting` entries and prints one warning line |
| `tests/orient.test.js` | 1 | the warning line and its absence |
| `scripts/todo-check.js` | 2 | `migrate()`, `leftovers()`, `--migrate` in `main()` |
| `tests/todo-check.test.js` | 2 | five `--migrate` tests |
| `TODO.md` | 2, 3 | header names `--migrate` (2); the resume.js Ready entry removed (3) |
| `hooks/resume.js` | 3 | writes the answer on a gate match, not on an absent mark |
| `tests/gate.test.js` | 3 | the 09-27 reproduction, the design's check, the control; two existing tests updated |
| `docs/90-agent/reference/subagents.md` | 3 | the answer row and the in-flight paragraph |
| `docs/90-agent/reference/registry.md` | 3 | the answer-file sentence in the build-files row |

## Task 1: orient warns about entries left under `## Waiting`

**Files:**
- Modify: `scripts/orient.js` — `todoBlock()`, one line pushed between the Watch timings loop (ends line 564) and the `patrol:` line (565)
- Test: `tests/orient.test.js`

**Interfaces:**
- Consumes: nothing from other tasks. `all` (already `todoCheck.entries(text)` at `scripts/orient.js:518`) tags an entry under `## Waiting` — under a `###` or not — with `section: 'Waiting'`.
- Produces: the line `  Waiting <n> entry|entries — retired heading, not offered; run todo-check --migrate`. `<n>` is singular/plural the way the `tally` lines above it are (`1 entry`, `2 entries`); the design's `<n> entries` is the plural form of the same line.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

**Step 1 — write the failing test.** In `tests/orient.test.js`, after the test `'the todo: block lists every Watch timing, stale ones first, and never marks one due'` (ends line 726), add:

```js
// `## Waiting` was split on 2026-09-27. An entry still under it is counted by
// none of the lines above and offered by nothing, so the block says so once,
// right after the Watch timings, with the command that moves it.
test('the todo: block warns once about entries left under ## Waiting, after the Watch timings', () => {
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
    '## Waiting',
    '',
    '### an old timing',
    'lifts when: x. 09-01.',
    '',
    '- b',
  ].join('\n') + '\n';
  commitTodo(root, opts, body, '2026-09-01T00:00:00Z');

  const lines = reportAt(root, 2026, 9, 3).split(/\r?\n/);
  const warn = lines.findIndex((l) => l === '  Waiting 1 entry — retired heading, not offered; run todo-check --migrate');
  assert.notEqual(warn, -1, lines.join('\n'));
  assert.match(lines[warn - 1], /^\s+a demand appears \(1\)$/, 'right after the Watch timings');
  assert.match(lines[warn + 1], /^  patrol: /);
});

// The control: with nothing under `## Waiting` the block is what it was.
test('the todo: block says nothing about ## Waiting when nothing is under it', () => {
  const root = workspace({});
  const opts = initGit(root);
  commitTodo(root, opts, '## Ready\n\n## Needs a decision\n\n## Watch\n', '2026-09-01T00:00:00Z');
  assert.doesNotMatch(reportAt(root, 2026, 9, 3), /^  Waiting /m);
});
```

**Step 2 — run it and watch it fail.**

```
node --test tests/orient.test.js
```

Expect `✖ the todo: block warns once about entries left under ## Waiting, after the Watch timings` (`warn` is `-1`). The control passes before and after — it is the byte-for-byte guard; pushing the line unconditionally is the mutation that turns it red.

**Step 3 — implement.** In `scripts/orient.js`, in `todoBlock()`, replace:

```js
    lines.push('  patrol: ' + (patrol ? dueCount + ' due + ' + staleCount + ' stale, offer one option'
        : 'none due or stale, not offered'));
```

with, in `scripts/orient.js`:

```js
    // An entry under the retired heading is counted by nothing above and offered
    // by nothing: say so once, with the command that moves it.
    const waitingCount = all.filter((e) => e.section === 'Waiting').length;
    if (waitingCount > 0) {
        lines.push('  Waiting ' + waitingCount + (waitingCount === 1 ? ' entry' : ' entries')
            + ' — retired heading, not offered; run todo-check --migrate');
    }
    lines.push('  patrol: ' + (patrol ? dueCount + ' due + ' + staleCount + ' stale, offer one option'
        : 'none due or stale, not offered'));
```

**Step 4 — run it and watch it pass.**

```
node --test tests/orient.test.js
```

**Step 5 — commit.**

```
git commit -o scripts/orient.js tests/orient.test.js -m "feat: orient warns about entries left under ## Waiting"
```

## Task 2: `todo-check --migrate`

**Files:**
- Modify: `scripts/todo-check.js` — `migrate()` and `leftovers()` added above the `--root <dir>` comment (line 597); `main()` (602-615) gains the `migrate` option and branch
- Modify: `TODO.md` — the paragraph at lines 60-73 that names `## Waiting` mentions `--migrate`
- Test: `tests/todo-check.test.js`

**Interfaces:**
- Consumes: nothing from other tasks. Inside the file: `conditionAt(text)` (line 137, returns `{ kind, event }` or `null`), `entries(text)` (230), `check(file, now)` (343), `report(result)` (538), `RETIRED` (76), `TIMED` (74).
- Produces: `node scripts/todo-check.js --migrate [--root <dir> | <file>]`. Its first output line is `fankeel todo-check --migrate: <n> timing(s) to ## Blocked, <m> to ## Watch, <k> left under ## Waiting` followed, when `<k>` > 0, by one `  <file>:<line>  <title>` line per leftover; then the normal report. `main(argv, now)` keeps its signature and return shape `{ text, ok }`; `ok` is the post-migrate check's. `module.exports` is unchanged.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

**Step 1 — write the failing tests.** In `tests/todo-check.test.js`, at the end of the file (after line 748; `NOW`, `stampFor` and `fixture` are already defined above), add:

```js
// `--migrate`: the move off `## Waiting` for a file still on it. One timing of
// each kind the design names — typed for Blocked, typed for Watch, untyped.
const MIGRATE = [
  '# TODO',
  '',
  '## Ready',
  '',
  '- r',
  '',
  '## Needs a decision',
  '',
  '- n',
  '',
  '## Waiting',
  '',
  '### a release lands',
  'after: the 1.0 release. ' + stampFor(2) + '.',
  '',
  '- a',
  '',
  '### it breaks again',
  'if: the pool overflows. ' + stampFor(2) + '.',
  '',
  '- b',
  '',
  '### nobody said',
  'lifts when: x. ' + stampFor(2) + '.',
  '',
  '- c',
].join('\n') + '\n';
// The same file with the untyped timing gone: everything in it can be placed.
const TYPED = MIGRATE.slice(0, MIGRATE.indexOf('### nobody said')).replace(/\n+$/, '\n');

test('--migrate moves a typed timing to Blocked or Watch and leaves an untyped one under Waiting, named', () => {
  const file = fixture(MIGRATE);
  const { text, ok } = todo.main(['--migrate', file], NOW);
  const after = fs.readFileSync(file, 'utf8');
  const ts = todo.timings(after, NOW);
  assert.deepEqual(ts.map((t) => [t.section, t.title]), [['Blocked', 'a release lands'], ['Watch', 'it breaks again']]);
  assert.deepEqual(ts.map((t) => t.items.map((e) => e.text)), [['a'], ['b']]);
  const waiting = todo.entries(after).filter((e) => e.section === 'Waiting');
  assert.deepEqual(waiting.map((e) => e.text), ['c']);
  const problems = todo.check(file, NOW).problems;
  assert.deepEqual(problems.map((p) => [p.kind, p.line]), [['unclassified', waiting[0].line]], 'todo-check names only the Waiting one');
  assert.equal(ok, false, 'the leftover still fails the run');
  assert.match(text, /1 timing to ## Blocked, 1 to ## Watch, 1 left under ## Waiting/);
  assert.match(text, /TODO\.md:\d+  nobody said/);
});

test('--migrate keeps CRLF, removes an emptied ## Waiting, and leaves what is above it byte-for-byte', () => {
  const file = fixture(TYPED.replace(/\n/g, '\r\n'));
  const { ok } = todo.main(['--migrate', file], NOW);
  const after = fs.readFileSync(file, 'utf8');
  assert.equal(ok, true);
  assert.doesNotMatch(after, /## Waiting/);
  assert.equal(after.split('\n').length, after.split('\r\n').length, 'every line still ends CRLF');
  const top = TYPED.slice(0, TYPED.indexOf('## Waiting')).replace(/\n/g, '\r\n');
  assert.ok(after.startsWith(top), 'Ready and Needs a decision are what they were');
});

test('--migrate appends to an existing ## Blocked and leaves an entry under no timing where it is', () => {
  const file = fixture([
    '# TODO', '', '## Blocked', '', '### already here', 'on: 09-20. ' + stampFor(2) + '.', '', '- x', '',
    '## Watch', '', '## Waiting', '', '- loose', '', '### node lands', 'upstream: node 24. ' + stampFor(2) + '.', '', '- a',
  ].join('\n') + '\n');
  const { text } = todo.main(['--migrate', file], NOW);
  const after = fs.readFileSync(file, 'utf8');
  assert.deepEqual(todo.timings(after, NOW).map((t) => [t.section, t.title]), [['Blocked', 'already here'], ['Blocked', 'node lands']]);
  assert.ok(after.indexOf('### node lands') < after.indexOf('## Watch'), 'at the end of Blocked, before the next heading');
  assert.deepEqual(todo.entries(after).filter((e) => e.section === 'Waiting').map((e) => e.text), ['loose']);
  assert.match(text, /TODO\.md:\d+  loose/);
});

test('--migrate on a file with no ## Waiting writes nothing', () => {
  const body = '# TODO\r\n\r\n## Ready\r\n\r\n- r\r\n';
  const file = fixture(body);
  todo.main(['--migrate', file], NOW);
  assert.equal(fs.readFileSync(file, 'utf8'), body);
});

// The exit code is the check's on the migrated file: 1 while a leftover stands,
// 0 once everything was placed.
test('--migrate exits with the check it runs afterwards', () => {
  const code = (body) => {
    try {
      execFileSync(process.execPath, [SCRIPT, '--migrate', fixture(body)], { encoding: 'utf8' });
      return 0;
    } catch (e) {
      return e.status;
    }
  };
  assert.equal(code(MIGRATE), 1);
  assert.equal(code(TYPED), 0);
});
```

**Step 2 — run them and watch them fail.**

```
node --test tests/todo-check.test.js
```

Expect four `✖` — the first three and the exit-code test (`--migrate` is ignored today, so `## Waiting` stays and `TYPED` exits 1). `--migrate on a file with no ## Waiting writes nothing` passes before and after; it guards "nothing outside changes".

**Step 3 — implement.** In `scripts/todo-check.js`, immediately above the comment that opens `` // `--root <dir>` the way every other script here takes it. `` (line 597), add:

```js
// `--migrate`: the one move off the retired `## Waiting`. A `###` timing whose
// condition line is typed moves whole — heading, condition line and entries —
// to the end of the section that takes that condition; anything a script
// cannot place stays where it is, for a person. Sections split at `#` and `##`
// only: under `## Waiting` a `###` is a timing, the same reading `entries()`
// gives it. The file keeps the line ending its first line break uses.
function migrate(text) {
    const eol = /\r\n/.test(text) ? '\r\n' : '\n';
    const lines = text.split(/\r?\n/);
    const trailing = lines.length > 1 && lines[lines.length - 1] === '';
    if (trailing) lines.pop();
    const sections = [{ head: null, body: [] }];
    for (const line of lines) {
        if (/^#{1,2}\s/.test(line)) sections.push({ head: line, body: [] });
        else sections[sections.length - 1].body.push(line);
    }
    const nameOf = (s) => (s.head === null ? null : s.head.replace(/^#+\s*/, '').trim());
    const find = (name) => sections.findIndex((s) => nameOf(s) === name);
    const waiting = sections[find(RETIRED)];
    if (!waiting) return { text, blocked: 0, watch: 0 };

    // What precedes the first `###` stays; each `###` runs to the next.
    const keep = [];
    const chunks = [];
    for (const line of waiting.body) {
        if (/^#{3,6}\s/.test(line)) chunks.push([line]);
        else if (chunks.length) chunks[chunks.length - 1].push(line);
        else keep.push(line);
    }
    const moves = { Blocked: [], Watch: [] };
    for (const chunk of chunks) {
        const next = chunk.slice(1).find((l) => l.trim());
        const cond = next && !/^[-*]\s/.test(next) ? conditionAt(next) : null;
        if (!cond) keep.push(...chunk);
        else moves[cond.kind === 'if' ? 'Watch' : 'Blocked'].push(chunk);
    }

    const trim = (body) => {
        while (body.length && !body[body.length - 1].trim()) body.pop();
        return body;
    };
    const touched = new Set();
    for (const [name, after] of [['Blocked', ['Needs a decision', 'Ready']], ['Watch', ['Blocked', 'Needs a decision', 'Ready']]]) {
        if (!moves[name].length) continue;
        let at = find(name);
        if (at === -1) {
            const anchor = after.map(find).find((i) => i !== -1);
            at = anchor === undefined ? sections.length : anchor + 1;
            sections.splice(at, 0, { head: '## ' + name, body: [] });
        }
        const s = sections[at];
        trim(s.body);
        for (const chunk of moves[name]) s.body.push('', ...trim(chunk.slice()));
        touched.add(s);
    }
    waiting.body = keep;
    if (keep.every((l) => !l.trim())) sections.splice(sections.indexOf(waiting), 1);
    else touched.add(waiting);
    // A section this wrote to ends in one blank line before the next heading,
    // and in none at the end of the file.
    for (const s of touched) {
        trim(s.body);
        if (sections.indexOf(s) !== sections.length - 1) s.body.push('');
    }
    const out = [];
    for (const s of sections) {
        if (s.head !== null) out.push(s.head);
        out.push(...s.body);
    }
    return { text: out.join(eol) + (trailing ? eol : ''), blocked: moves.Blocked.length, watch: moves.Watch.length };
}

// What is still under `## Waiting` once a migration has run, for a person to
// file: every `###` timing there, and every entry under none. `{ line, title }`,
// in file order.
function leftovers(text) {
    const lines = text.split(/\r?\n/);
    const out = [];
    let section = '';
    for (let i = 0; i < lines.length; i++) {
        const h = /^(#{1,6})\s+(.*)$/.exec(lines[i]);
        if (!h) continue;
        if (h[1].length >= 3 && section === RETIRED) {
            out.push({ line: i + 1, title: h[2].trim() });
            continue;
        }
        if (h[1].length >= 3 && TIMED.includes(section)) continue;
        section = h[2].trim();
    }
    for (const e of entries(text)) {
        if (e.section === RETIRED && e.timing === null) out.push({ line: e.line, title: e.text.replace(/\s+/g, ' ').trim() });
    }
    return out.sort((a, b) => a.line - b.line);
}

```

Then, in `scripts/todo-check.js`, replace the whole of `main()` (lines 602-615) with:

```js
function main(argv, now) {
    const { values, positionals } = parseArgs({
        args: argv, strict: false, allowPositionals: true, options: { root: { type: 'string' }, migrate: { type: 'boolean' } },
    });
    // `--root` with nothing after it comes back `true`, not a string — the old
    // loop read that case as `''` (`argv[++i] || ''`) rather than failing, and
    // this keeps that same silent fallback rather than adopting `parseArgs`'s
    // own "needs a value" refusal.
    const root = typeof values.root === 'string' ? values.root : '';
    // A positional argument is still a path to a file. A flag's value is not one.
    const at = positionals[0] || path.join(resolveRoot(root || undefined), 'TODO.md');
    const file = path.resolve(at);
    // `--migrate` writes first and then checks what it wrote, so what it could
    // not place still fails the run.
    const head = [];
    if (values.migrate === true) {
        let before = null;
        try {
            before = fs.readFileSync(file, 'utf8');
        } catch (e) { /* no file: the check below says so */ }
        if (before !== null) {
            const moved = migrate(before);
            if (moved.text !== before) fs.writeFileSync(file, moved.text);
            const left = leftovers(moved.text);
            head.push('fankeel todo-check --migrate: ' + moved.blocked + (moved.blocked === 1 ? ' timing' : ' timings')
                + ' to ## Blocked, ' + moved.watch + ' to ## Watch, ' + left.length + ' left under ## Waiting'
                + (left.length ? ' — no typed condition, for a person to file:' : '.'));
            for (const l of left) head.push('  ' + file + ':' + l.line + '  ' + l.title);
            head.push('');
        }
    }
    const result = check(file, now);
    return { text: head.concat(report(result)).join('\n'), ok: result.missing || !result.problems.length };
}
```

The `if (require.main === module)` block and `module.exports` stay as they are.

**Step 4 — the header paragraph.** In `TODO.md`, lines 67-68, replace:

```md
where it belongs, an entry under any other heading — `## Waiting` included — is
one nobody said the state of, an entry under `## Blocked` or `## Watch` under no
```

with, in `TODO.md`:

```md
where it belongs, an entry under any other heading — `## Waiting` included, which
`node scripts/todo-check.js --migrate` empties of every timing whose condition is
typed — is one nobody said the state of, an entry under `## Blocked` or `## Watch` under no
```

**Step 5 — run them and watch them pass.**

```
node --test tests/todo-check.test.js
node scripts/todo-check.js
```

Every test passes, including `this project’s own TODO.md is an index`; the second command prints a clean run for the repository's own file.

**Step 6 — commit.**

```
git commit -o scripts/todo-check.js tests/todo-check.test.js TODO.md -m "feat: todo-check --migrate moves typed timings off ## Waiting"
```

## Task 3: resume.js writes the answer for a matching gate

**Files:**
- Modify: `hooks/resume.js` — the two `require` lines (23-24) and the answer block (69-80); no `singleByDefault` helper (see the ruling below)
- Modify: `lib/handoff.js` — `readGate()` (218-231): a filed question with no `multiSelect` is returned with `multiSelect: false`
- Test: `tests/handoff.test.js`
- Modify: `docs/90-agent/reference/subagents.md` — the `the answer` row (line 523) and the in-flight paragraph (lines 757-761)
- Modify: `docs/90-agent/reference/registry.md` — the answer-file sentence in the build-files row (line 42)
- Modify: `TODO.md` — the `〔stage-agents〕09-27 受控 survey 第二輪` Ready entry (line 85) is removed; this task delivers it
- Read: `hooks/gate.js` — line 157 is the `readGate(...)` call this task copies; line 185 its `gateMatches`
- Read: `hooks/brief.js` — line 49, the `markInflight` every `SubagentStart` for a `fankeel-brain` runs
- Read: `lib/handoff.js` — `handoffPath`, `answerPath`, `writeAnswer`, `readGate`, `gateMatches` (245: absent vs `false` `multiSelect` do not match, on purpose), `lapOf`
- Read: `lib/stages.js` — `controlling`, `nextStage`, `normaliseRoute`, `FULL_ROUTE`
- Test: `tests/gate.test.js`

**Interfaces:**
- Consumes: nothing from other tasks. From `lib/handoff.js`: `readGate(file, next, route)` → gate object `{ questions, next }`, `{ invalid, detail, next }`, or `null`; `gateMatches(asked, filed)` → boolean (`isDeepStrictEqual`); `handoffPath(root, data, stage[, lap])`, `answerPath(root, data, stage[, lap])` → path or `null`; `writeAnswer(file, text)`. From `lib/stages.js`: `controlling(stage, values)` → boolean, `nextStage(stage, route)`, `normaliseRoute(route)`, `FULL_ROUTE`.
- Produces: no new name outside `hooks/resume.js` (`singleByDefault` is file-local). Behaviour: `<stage>-answer.md` is written iff the stage is controlled, the handoff's gate reads, and `tool_input.questions` equal its `questions` once an absent `multiSelect` is read as `false` on both sides — independent of `inflight`.

**Dispatch:** implementer, sonnet — the plan carries the code and the reproduction; transcription plus tests.

**Ruling at the plan gate, 2026-09-27 — overrides the steps below where they differ.** The fix goes in the shared layer so `hooks/gate.js` clears `inflight` too, but `gateMatches` stays strict: `tests/handoff.test.js:347` (66641c65) pins that a `multiSelect` dropped from the *asked* copy is a real difference. The 09-27 miss was the other direction — the *filed* gate lacked the key. So `readGate` fills it on the filed side only; `resume.js` then compares with plain `gateMatches(asked, gate.questions)`, exactly as `hooks/gate.js` does. Skip every `singleByDefault` snippet below and call `gateMatches(asked, gate.questions)` where they call it through `singleByDefault`. In `lib/handoff.js`, in `readGate()`, replace the final `return` with:

```js
    if (bad) return { invalid: bad.at, detail: bad.detail, next: gate.next };
    // A question filed with no `multiSelect` is asked single-select, and the
    // host sends `multiSelect: false` with it — so the filed side reads as
    // that. The asked side is never filled: gateMatches still tells a value
    // dropped in transit from one that was sent (tests/handoff.test.js).
    gate.questions = gate.questions.map((q) => (q && typeof q === 'object' && !('multiSelect' in q)
        ? Object.assign({}, q, { multiSelect: false }) : q));
    return gate;
```

In `tests/handoff.test.js`, after the `gateMatches: a missing multiSelect does not match…` test, add:

```js
test('readGate: a filed question with no multiSelect reads as multiSelect: false', () => {
  const g = gateOf('q');
  delete g.questions[0].multiSelect;
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fk-gate-')), 'survey.md');
  fs.writeFileSync(file, '# r\n\n```json gate\n' + JSON.stringify(g) + '\n```\n');
  const read = readGate(file, 'design', ['survey', 'design']);
  assert.equal(read.questions[0].multiSelect, false);
  assert.equal(gateMatches(gateOf('q').questions, read.questions), true);
});
```

(Adjust the imports and the `readGate` arguments to whatever the file's existing `readGate` tests use; run it red first — it fails before the `readGate` change.) The Task 3 reproduction in `tests/gate.test.js` must then pass with `hooks/gate.js` unchanged, and additionally assert that `inflight` is gone from the record after the gate hook runs.

**Which cause it was.** Neither a lap mismatch nor a re-mark after the clear on its own. The record for session 98e63df0-1414-4076-ba9f-2c68afa7a406 (task started `2026-09-26T18:02:05.890Z`) has `lapped: 1` and one `survey` move, so `lapOf` is 2 for both `hooks/brief.js` and `hooks/gate.js` — both read `survey-2.md`, the file the agent wrote. Its survey agent's transcript (agent ad2d3ea81bafdf166, under the session directory's subagents folder) shows `SubagentStart` firing on every `SendMessage` delivery — ten times, the last at 18:55:01 — so `hooks/brief.js` re-marked `inflight` before each gate. At 18:50:43 and 18:56:16 the controller asked the gate with `"multiSelect": false`; `survey-2.md`'s gate carries no `multiSelect` key, and `gateMatches` (`isDeepStrictEqual`, `lib/handoff.js:245`) tells an absent key from `false`. The header was `設計走向`, not the stage's, so `hooks/gate.js` neither denied it nor cleared the mark — it printed `gate not confirmed — … does not copy the handoff's gate word for word` — and `resume.js`, seeing `inflight`, wrote no `survey-2-answer.md`. **The design's letter — `readGate` + `gateMatches` as `hooks/gate.js` calls them — would still miss this case** (checked: the reproduction below stays red with a plain `gateMatches(asked, gate.questions)`). So `resume.js` reads an absent `multiSelect` as `false` on both sides before comparing; `gateMatches` itself, `hooks/gate.js` and the handoff test at line 347 are unchanged. This is the one point where the plan goes past the approved design, and the plan gate should rule on it.

**Step 1 — reproduce 09-27, and write the design's check and its control.** In `tests/gate.test.js`, beside `const RESUME = …` (line 18), add:

```js
const BRIEF = path.join(ROOT, 'hooks', 'brief.js');
```

Then, in `tests/gate.test.js`, after the test `'stage.agents: the pair in order, a matching gate clears the mark and its answer is written'` (ends line 218), add:

```js
const ANSWER = (root) => path.join(root, '.fankeel', 'build', 'task-20260919T093012', 'survey-answer.md');
// What SubagentStart runs for a stage agent — at its dispatch and again on
// every SendMessage delivered to it.
const brainStarts = (root) => run(BRIEF, root, { hook_event_name: 'SubagentStart', agent_type: 'fankeel:fankeel-brain', agent_id: 'a3f9c2' });

// 2026-09-27, session 98e63df0-1414-4076-ba9f-2c68afa7a406: the survey agent,
// resumed by SendMessage, handed back survey-2.md with a gate whose question
// carried no `multiSelect`, and the controller asked it with
// `multiSelect: false` under a header that was not the stage's. gateMatches
// told the two apart, so gate.js neither denied it nor cleared the mark
// SubagentStart had re-set on the last SendMessage, and resume.js wrote no
// survey-2-answer.md.
test('stage.agents: a gate asked with a multiSelect: false its file left out still writes the answer, though gate.js leaves the mark', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { stage: 'survey', started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-cfg-') });
  agentsOn(root);
  const filed = [{ question: 'survey 的結論可以進 design 嗎？', header: '設計走向', options: [{ label: '進 design', description: 'a' }, { label: '暫停', description: 'b' }] }];
  const asked = [Object.assign({}, filed[0], { multiSelect: false })];
  handoff(root, { questions: filed, next: 'n' });
  brainStarts(root);
  const out = JSON.parse(run(GATE, root, { tool_input: askOf(asked) }));
  assert.match(out.systemMessage, /does not copy the handoff's gate word for word/, 'the 09-27 message');
  assert.equal(readEntry(root, MINE).inflight.stage, 'survey', 'the 09-27 state: the mark stands at an answered gate');
  run(RESUME, root, { tool_input: askOf(asked), tool_response: { answers: { [filed[0].question]: '進 design' } } });
  assert.ok(fs.existsSync(ANSWER(root)), 'the answer the stage agent was told to read');
});

// The design's check: the mark still set, the questions the gate's own.
// SubagentStart fires again on a SendMessage delivery, so a mark can be
// re-set after gate.js cleared it and before the answer lands.
test('stage.agents: the answer to a matching gate is written though a SendMessage re-marked the stage agent in flight', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { stage: 'survey', started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-cfg-') });
  agentsOn(root);
  handoff(root, { questions: QUESTIONS, next: 'n' });
  brainStarts(root);
  run(GATE, root, { tool_input: askOf(QUESTIONS) });
  assert.equal(readEntry(root, MINE).inflight, undefined, 'gate.js matched and cleared it');
  brainStarts(root);
  assert.equal(readEntry(root, MINE).inflight.stage, 'survey');
  run(RESUME, root, { tool_input: askOf(QUESTIONS), tool_response: { answers: { 'q?': '進 design' } } });
  assert.ok(fs.existsSync(ANSWER(root)));
});

// The control: a question the controller wrote itself is not the gate, and
// its answer is not the stage agent's — with the mark standing or not.
test('stage.agents: a question the controller asked on its own writes nothing, in flight or not', () => {
  const own = [{ header: '開新任務', question: '要不要先開一個新任務？', options: [{ label: '要', description: 'a' }, { label: '不要', description: 'b' }] }];
  for (const inflight of [null, { stage: 'survey', at: 1758000000000, agentId: 'a3f9c2' }]) {
    const root = tmp('fankeel-gate-');
    seed(root, MINE, Object.assign({ stage: 'survey', started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-cfg-') }, inflight ? { inflight } : {}));
    agentsOn(root);
    handoff(root, { questions: QUESTIONS, next: 'n' });
    run(RESUME, root, { tool_input: askOf(own), tool_response: { answers: { [own[0].question]: '要' } } });
    assert.equal(fs.existsSync(ANSWER(root)), false, inflight ? 'in flight' : 'not in flight');
  }
});
```

**Step 2 — run them and watch them fail.**

```
node --test tests/gate.test.js
```

Expect exactly these three `✖` (checked against the current `hooks/resume.js`): the 09-27 test (no answer file), the design's check (no answer file — the mark stands), and the control (the not-in-flight arm writes one today).

**Step 3 — implement.** In `hooks/resume.js`, replace lines 23-24:

```js
const { controlling } = require('../lib/stages.js');
const { answerPath, writeAnswer } = require('../lib/handoff.js');
```

with, in `hooks/resume.js`:

```js
const { controlling, nextStage, normaliseRoute, FULL_ROUTE } = require('../lib/stages.js');
const { handoffPath, answerPath, writeAnswer, readGate, gateMatches } = require('../lib/handoff.js');
```

In `hooks/resume.js`, between the last `require` line and `function main(raw) {`, add:

```js
// A question with no `multiSelect` is asked single-select, so for the answer
// file a missing one reads as `false` on both sides. On 2026-09-27 the
// controller asked survey-2.md's gate with `multiSelect: false` the file left
// out; `gateMatches` keeps the two apart on purpose — hooks/gate.js wants a
// word-for-word copy — so it missed, and no answer was written.
const singleByDefault = (questions) => (Array.isArray(questions)
    ? questions.map((q) => (q && typeof q === 'object' && !('multiSelect' in q) ? Object.assign({}, q, { multiSelect: false }) : q))
    : questions);

```

In `hooks/resume.js`, replace the answer block (lines 69-80, from `// \`stage.agents\`: the answer left where` through its `catch`) with:

```js
    // `stage.agents`: the answer left where the stage agent is told to look, so
    // the controller relays a path and never retypes what the user said —
    // written when the questions answered are the handoff's own gate, read the
    // way hooks/gate.js reads it, and never for a question the controller asked
    // itself. Not on `inflight`: SubagentStart fires on every SendMessage
    // delivery and hooks/brief.js re-marks the agent each time, so the mark
    // says nothing about which question this answer is to.
    try {
        if (controlling(mine.stage, profile && profile.values)) {
            const gate = readGate(handoffPath(root, mine, mine.stage), nextStage(mine.stage, mine.route), normaliseRoute(mine.route) || FULL_ROUTE);
            const asked = payload.tool_input && payload.tool_input.questions;
            const file = answerPath(root, mine, mine.stage);
            const response = payload.tool_response;
            if (gate && file && response != null && gateMatches(singleByDefault(asked), singleByDefault(gate.questions))) {
                writeAnswer(file, typeof response === 'string' ? response : JSON.stringify(response, null, 2));
            }
        }
    } catch (e) { /* housekeeping */ }
```

**Step 4 — the two existing tests that answered with no question.** They ran `resume.js` with no `tool_input`, which under the new rule is a question that matches nothing. In `tests/gate.test.js`, in `'stage.agents at survey: the answer is written beside the handoff'` (line 176), replace:

```js
  agentsOn(root);
  run(RESUME, root, { tool_response: { answers: { 'q?': '暫停' } } });
```

with, in `tests/gate.test.js`:

```js
  agentsOn(root);
  handoff(root, { questions: QUESTIONS, next: 'n' });
  run(RESUME, root, { tool_input: askOf(QUESTIONS), tool_response: { answers: { 'q?': '暫停' } } });
```

and in `tests/gate.test.js`, in `'stage.agents: the pair in order, a matching gate clears the mark and its answer is written'` (line 211), replace:

```js
  run(RESUME, root, { tool_response: { answers: { 'q?': '進 design' } } });
  assert.ok(fs.existsSync(path.join(root, '.fankeel', 'build', 'task-20260919T093012', 'survey-answer.md')));
```

with, in `tests/gate.test.js`:

```js
  run(RESUME, root, { tool_input: askOf(QUESTIONS), tool_response: { answers: { 'q?': '進 design' } } });
  assert.ok(fs.existsSync(path.join(root, '.fankeel', 'build', 'task-20260919T093012', 'survey-answer.md')));
```

`'stage.agents: an answer while the stage agent is still in flight is not written as the gate answer'` (line 202) is left as it is and still passes: no questions, no match.

**Step 5 — run them and watch them pass.**

```
node --test tests/gate.test.js
```

**Step 6 — the documents this made false.** In `docs/90-agent/reference/subagents.md`, line 523, replace:

```md
| the answer | `hooks/resume.js` | writes it to the answer file — only once `inflight` is clear, which `hooks/gate.js` does when the question reaching the user matches the file's gate; a question asked while the stage agent is still in flight writes nothing; the controller's `SendMessage` names the path |
```

with, in `docs/90-agent/reference/subagents.md`:

```md
| the answer | `hooks/resume.js` | writes it to the answer file when the questions answered match the handoff's `json gate` — `readGate` and `gateMatches`, the helpers `hooks/gate.js` uses, with a question missing `multiSelect` read as `multiSelect: false` on both sides — whether or not `inflight` still stands, since `SubagentStart` re-marks it on every `SendMessage` delivery; a question the controller asked on its own writes nothing; the controller's `SendMessage` names the path |
```

In `docs/90-agent/reference/subagents.md`, lines 757-761, replace:

```md
  `SubagentStop` hook, so nothing else does. Two cases it does not cover: after a
  gate answered with anything but option one the controller SendMessages the same
  agent, no `SubagentStart` fires, and the mark is already gone while that agent
  works again; and an agent that died leaves its mark until the next gate or the
  SendMessage fallback.
```

with, in `docs/90-agent/reference/subagents.md`:

```md
  `SubagentStop` hook, so nothing else does. `SubagentStart` fires again on every
  `SendMessage` delivered to a running or resumed agent — ten times for one survey
  agent on 2026-09-27 — and each re-marks it, so the mark says an agent was
  reached since the last matching gate, not that one is working, and
  `hooks/resume.js` does not read it. An agent that died leaves its mark until the
  next gate or the SendMessage fallback.
```

In `docs/90-agent/reference/registry.md`, line 42, replace the fragment:

```md
`hooks/resume.js` writes `<stage>-answer.md`, through `writeAnswer`, once a gate's question is answered — only a gate `hooks/gate.js` confirmed matched the handoff, word for word, which cleared `inflight`; a question the controller asked itself while the stage agent is in flight writes nothing (`hooks/resume.js:75`)
```

with, in `docs/90-agent/reference/registry.md`:

```md
`hooks/resume.js` writes `<stage>-answer.md`, through `writeAnswer`, once a gate's question is answered — only when the questions answered match the handoff's `json gate` (`readGate` and `gateMatches`, a missing `multiSelect` read as `false` on both sides), whether or not `inflight` still stands; a question the controller asked itself writes nothing
```

In `TODO.md`, under `## Ready`, delete this entry (line 85) — the work it names is this task:

```text
- 〔stage-agents〕09-27 受控 survey 第二輪（站 agent 經 SendMessage 續用）答了選項二，`survey-2-answer.md` 沒被寫出；`resume.js` 只在沒有 `inflight` 時寫，controller 的 Write 又被 guard 擋，只能把答案打進訊息 — [hooks/resume.js](hooks/resume.js).
```

**Step 7 — check the documents and the index.**

```
node scripts/docs-check.js
node scripts/todo-check.js
```

Both clean.

**Step 8 — commit.**

```
git commit -o hooks/resume.js tests/gate.test.js docs/90-agent/reference/subagents.md docs/90-agent/reference/registry.md TODO.md -m "fix: resume.js writes the answer for a matching gate, not an absent in-flight mark"
```

## Coverage

| promise | task |
|---|---|
| `todoBlock()` in `scripts/orient.js` counts entries whose `section` is `Waiting`; when the count is above zero it adds one line after the Watch timings | Task 1 |
| With no `## Waiting` entries the `todo:` block is byte-for-byte what it is today. | Task 1 (the control test) |
| `node scripts/todo-check.js --migrate [--root <dir> \| <file>]` rewrites the file in place: each `###` timing under `## Waiting` whose condition line starts `on:`, `after:` or `upstream:` moves … to the end of `## Blocked`; one starting `if:` moves to the end of `## Watch`. | Task 2 |
| A missing `## Blocked` or `## Watch` is created: Blocked after `## Needs a decision` (or after `## Ready`, or at the end), Watch after Blocked. | Task 2 |
| A timing with no typed condition, and any entry under `## Waiting` outside a `###`, stays under `## Waiting`; `--migrate` prints each one's line and title | Task 2 |
| After writing, the normal check runs on the result and its exit code is the command's | Task 2 |
| The file keeps its line endings; nothing outside `## Waiting`, `## Blocked` and `## Watch` changes. | Task 2 |
| `hooks/resume.js` writes `answerPath(...)` when the stage is controlled and the answered `tool_input.questions` match the handoff's `json gate` | Task 3 — plus an absent `multiSelect` read as `false`; see "Which cause it was" |
| A question the controller asked on its own, not matching the gate, still writes nothing. | Task 3 (the control test) |
| The 09-27 cause is reproduced first: a stage agent resumed by SendMessage leaves `inflight` standing when its gate is answered | Task 3, Step 1 |
| check | the column heading of the table below; no promise of its own |
| orient on a TODO.md with one `## Waiting` entry prints the warning line | Task 1 |
| `--migrate` on a fixture with one `after:`, one `if:` and one untyped timing leaves one Blocked, one Watch, one Waiting, and todo-check names only the Waiting one | Task 2 |
| resume.js, with `inflight` still set and the answered questions equal to the handoff's gate, writes `<stage>-answer.md` | Task 3 |
