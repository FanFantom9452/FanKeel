---
status: design-intent
---

# The Station Skill Retired — Implementation Plan

**Goal:** retire `skills/fankeel-station/`, move its routing phrases and its opening instructions to where they still land, and give `scripts/station.js` a `--json` that prints the rows.
**Architecture:** three tasks that share no file. Task 1 deletes the skill and moves its four phrases into the `fankeel` skill's description, rewriting the one current sentence that named it and the three counts the deletion changes. Task 2 brings `docs/station.md` up to the code with a test that reads the flags off the parser. Task 3 adds `--json` to `scripts/station.js`, printing what `gather()` returns and writing nothing.
**Tech Stack:** Node, no dependencies; `node --test`; markdown with YAML frontmatter that `tests/skills.test.js` parses by regex.
**Spec:** [2026-09-07-station-skill-retired-design.md](2026-09-07-station-skill-retired-design.md)

## Global Constraints

- No `CLAUDE.md` in this repository: the constraints below are the tests and the tree.
- `.gitattributes` — `* text=auto eol=lf`. Every file lands LF.
- `package.json:8` — `"test": "node --test"`. No `dependencies` key exists and none may be added.
- `tests/skills.test.js:41` — `fm.name` equals the directory name. `:50-52` — a description is over 60 and under 500 characters and matches `/Use for|Use when/`.
- `tests/contract.test.js:275` — `found.size` is the number of files carrying `version:` — `package.json`, `.claude-plugin/plugin.json` and every `skills/*/SKILL.md` — and `tests/version.test.js:100` pins the same count against the real tree. Both read `fs.readdirSync('skills')`, so deleting a skill directory moves both.
- `.fankeel/map.md` filing — `skills — reference`, `docs — reference`, `docs/plans — plan`, index `docs/README.md`. Nothing under `docs/plans/` is edited by any task here: a plan records a moment, and the three station plans naming `/fankeel-station` stay as they are.
- Indentation matches the file: 4 spaces in `scripts/station.js` and `tests/station-cli.test.js`, 2 spaces in `tests/skills.test.js` and `tests/version.test.js`.
- Commit shape, as the last twenty commits: `type: subject`, one bullet per change naming its module, one closing paragraph on why.
- `node scripts/docs-check.js` prints `Every reference resolves.` on `main` today and must still after each task.

## File structure

| file | responsibility after this plan |
|---|---|
| `skills/fankeel-station/` | gone |
| `skills/fankeel/SKILL.md` | the one skill; its description routes the station phrases, `:600` says where the page is |
| `tests/skills.test.js` | pins the phrases on the `fankeel` description and that no skill names `/fankeel-station` |
| `tests/contract.test.js`, `tests/version.test.js`, `README.md` | the version-file count, ten |
| `TODO.md` | two `## Ready` entries fewer |
| `docs/station.md` | the reference, now with how to open the page, `--port`, `--idle`, the first-run exception and `--json` |
| `tests/station-doc.test.js` | every flag `parseArgs` accepts is on `docs/station.md` |
| `scripts/station.js` | `--json` |
| `tests/station-cli.test.js` | `--json` prints the rows and writes nothing; refuses a verb |

## Task 1: The skill goes, and its words move

**Files:**
- Modify: `skills/fankeel-station/SKILL.md` — deleted, and the directory with it
- Modify: `skills/fankeel/SKILL.md` — `description` in the frontmatter; the sentence at `:600`
- Modify: `tests/contract.test.js` — `:275`, `11` becomes `10`
- Modify: `tests/version.test.js` — `:98-100`, `eleven` and `11` become `ten` and `10`
- Modify: `README.md` — `:286-289`, `eleven` becomes `ten` twice, `nine skills` becomes `eight skills`
- Modify: `TODO.md` — the `## Ready` bullets at `:67` and `:71` removed, each with the blank line under it
- Test: `tests/skills.test.js`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — six files, each edit named to the line; the plan carries every sentence.

### Steps

1. In `tests/skills.test.js`, after the `for (const n of names) { ... }` block that holds the description test (its closing `}` is at `:54`), add:

```js
// The station skill was retired on 2026-09-07: the `/fankeel` prompt writes the
// page and names it, so a second skill was a second door to one room. Its
// routing phrases moved into the fankeel skill's description, and nothing
// current may send a reader to the skill that is gone.
test('the fankeel skill routes the station phrases, and no skill names /fankeel-station', () => {
  const fm = frontmatter(read('fankeel'));
  for (const phrase of ['show all sessions', 'clean up old sessions', '監控站']) {
    assert.ok(fm.description.includes(phrase), 'fankeel description lacks "' + phrase + '"');
  }
  for (const n of names) {
    assert.equal(read(n).includes('/fankeel-station'), false, n + ' still names /fankeel-station');
  }
});
```

2. Run `node --test tests/skills.test.js` and watch it fail: the `fankeel` description lacks every phrase, and `fankeel-station` names itself.

3. Delete `skills/fankeel-station/` from the working tree — `rm -r skills/fankeel-station` — and nothing else: the parent stages the deletion when it commits, so `git rm` is not used.

4. In `skills/fankeel/SKILL.md`, the frontmatter `description:` line becomes exactly this, one line:

```
description: Task registry and development discipline for long-running projects. Use for /fankeel, starting or pausing a task, asking what this or another session is working on, moving to the next stage, or the station — "show all sessions", "which sessions are still open", "clean up old sessions", "監控站". Runs a task through a route it picks from survey, design, plan, build, verify, audit and land, and warns — optionally blocks — when another live session shares your files.
```

5. In `skills/fankeel/SKILL.md`, the paragraph at `:600` — one line today, `For every registry on the machine rather than this one, ` followed by the skill name — becomes:

```
For every registry on the machine rather than this one, the station. The
`station:` line of the `/fankeel` block names the page and counts its `stale`
rows; `.fankeel/station.html` in the registry is the copy beside you, and
`node <plugin>/scripts/station.js --open` opens the newest. `serve --open` in
place of `--open` runs it as a page with a `clear` button on every stale row.
The page is written at this prompt, before the block that names it, so there
is nothing to invoke; [docs/station.md](../../docs/station.md) is the reference.
```

6. Run `node --test tests/skills.test.js` and watch it pass — including the length test at `:51`: the new description is under 500 characters.

7. In `tests/contract.test.js:275`, `assert.equal(found.size, 11,` becomes `assert.equal(found.size, 10,`. In `tests/version.test.js:98`, the test name `the real repository has the eleven places the contract test counts` becomes `the real repository has the ten places the contract test counts`, and `:100` `assert.equal(rows.length, 11,` becomes `assert.equal(rows.length, 10,`. The comments above each already say eight skills and ten; leave them.

8. In `README.md:286-289`: `in the eleven files that carry it` becomes `in the ten files that carry it`; `each of the nine skills` becomes `each of the eight skills`; `fails when the eleven` becomes `fails when the ten`. `:292`, `right in nine places`, describes a past release and stays.

9. In `TODO.md`, remove the bullet at `:67` (it begins `` - `skills/fankeel/SKILL.md:599` sends people to `/fankeel-station` ``) and the bullet at `:71` (it begins `` - `station.js` prints a path and a counts line ``), each with the blank line that follows it.

10. Run `node --test tests/contract.test.js tests/version.test.js tests/skills.test.js` and watch all three pass. Run `node scripts/docs-check.js`: it prints `Every reference resolves.` If instead it names `skills/fankeel-station/SKILL.md` under a plan, stop and say so in the return — do not edit anything under `docs/plans/`.

11. Commit: `fix: the station skill retired; its phrases route through the fankeel skill`.

## Task 2: The reference page catches up with the code

**Files:**
- Modify: `docs/station.md` — an opening paragraph, the first-run row, the `serve` paragraph, a `--json` paragraph, `last_verified`
- Test: `tests/station-doc.test.js`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries every sentence and the test.

### Steps

1. Create `tests/station-doc.test.js`:

```js
'use strict';

// Every flag `scripts/station.js` parses is on the station page. On
// 2026-09-07 `--port`, `--idle` and `--open` were on no page at all, and a
// flag nobody can find is a flag nobody uses. The flags are read off the
// parser rather than listed here, so a new one has to be documented to stay
// green.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

test('every flag the station CLI parses appears on docs/station.md', () => {
    const src = fs.readFileSync(path.join(ROOT, 'scripts', 'station.js'), 'utf8');
    const flags = [...new Set([...src.matchAll(/a === '(--[a-z]+)'/g)].map((m) => m[1]))];
    assert.ok(flags.length >= 5, 'the parser moved: ' + flags.join(', '));
    const page = fs.readFileSync(path.join(ROOT, 'docs', 'station.md'), 'utf8');
    for (const flag of flags) {
        assert.ok(page.includes(flag), flag + ' is on no page');
    }
});
```

2. Run `node --test tests/station-doc.test.js` and watch it fail on `--open`, `--port` or `--idle`.

3. In `docs/station.md`, after the intro paragraph — it ends at `:15`, the line that links the station-reads-back design — and before `## Where the registries come from`, add one paragraph:

```
To open it: `.fankeel/station.html` in the registry you are in is the copy
beside you, `node scripts/station.js --open` opens the newest, and
`node scripts/station.js serve --open` runs it as a page with a `clear`
button on every stale row. The `/fankeel` prompt writes the page and names it
on the block's `station:` line, so there is nothing to invoke. An argument
`scripts/station.js` does not know exits 2 before anything is written.
```

4. In the sources table, the row beginning `| the first run, when there is no `roots.json` at all |`: the cell text `one walk of every drive, under a five-second budget. What stops it repeating` becomes `one walk of every drive, under a five-second budget, on the default form only — `serve` and `--forget` return before the check, so a first `serve` on a machine sees only what the leads and running sessions point at. What stops it repeating`. The rest of the cell is unchanged.

5. In the `serve` paragraph under `## When it is written, and where` — it begins `` `serve` runs a loopback server only while clearing `` — the words `and exits after ten idle minutes.` become `and exits after ten idle minutes — `--port <n>` binds a chosen port instead of one the OS picks, and `--idle <minutes>` moves the ten.` (the sentence's next words, `The static copies carry`, are unchanged).

6. Under `## When it is written, and where`, after the paragraph that ends `says when it was generated.` and before the `serve` paragraph, add:

```
`node scripts/station.js --json` is the same model as one JSON document on
stdout, and it writes nothing — no page, no `roots.json`, no first-run walk.
`registries[].sessions[]` is the rows, each carrying its `state`, so a session
that wants the stale ones filters on that rather than parsing the counts line.
It takes `--root` and `--scan` as the default form does, and refuses `serve`
and `--forget` with exit 2.
```

7. In the frontmatter, `last_verified: 2026-09-06` becomes `last_verified: 2026-09-07`.

8. Run `node --test tests/station-doc.test.js` and watch it pass. Run `node scripts/docs-check.js`: `Every reference resolves.`

9. Commit: `docs: the station page says how to open it, and names the three flags it never had`.

## Task 3: `--json` prints the rows

**Files:**
- Modify: `scripts/station.js` — `parseArgs` and `main`
- Read: `lib/station.js` — `gather(opts)` at `:231` builds the model from `opts.configDir`, `opts.roots`, `opts.scan`, `opts.cwd`, `opts.root` and `opts.deadline`; `write(opts)` at `:688` is the caller to mirror
- Test: `tests/station-cli.test.js`

**Interfaces:**
- Consumes: `station.gather(opts)` from `lib/station.js`, returning `{ generatedAt, configDir, pricesVerified, registries: [{ root, gone, unreadable, sessions: [{ sessionId, state, unknown, task, project, stage, route, ... }] }], scanStats }`
- Produces: `node scripts/station.js --json` — that object, `JSON.stringify`'d, one line on stdout, exit 0; exit 2 with a line on stderr when `serve` or `--forget` is beside it

**Dispatch:** implementer, sonnet — the plan carries the code and both tests.

### Steps

1. In `tests/station-cli.test.js`, the line `const { execFileSync } = require('node:child_process');` becomes `const { execFileSync, spawnSync } = require('node:child_process');`. Then, after the test `the default form writes the page, prints its path and the counts`, add:

```js
test('--json prints the rows as one JSON document and writes nothing', () => {
    const f = fixture();
    const env = { ...process.env, CLAUDE_CONFIG_DIR: f.cfg };
    const out = execFileSync(process.execPath, [CLI, '--json'], { cwd: f.base, env, encoding: 'utf8' });
    const model = JSON.parse(out);
    const states = model.registries.flatMap((r) => r.sessions.map((s) => s.state)).sort();
    assert.deepEqual(states, ['live', 'stale']);
    assert.equal(fs.existsSync(path.join(f.cfg, 'fankeel', 'station.html')), false, '--json wrote the page');
    assert.equal(fs.existsSync(path.join(f.r1, '.fankeel', 'station.html')), false, '--json wrote the copy');
});

test('--json refuses a verb, the way an unknown argument is refused', () => {
    const f = fixture();
    const env = { ...process.env, CLAUDE_CONFIG_DIR: f.cfg };
    for (const argv of [['--json', 'serve'], ['--json', '--forget', f.r1]]) {
        const r = spawnSync(process.execPath, [CLI, ...argv], { cwd: f.base, env, encoding: 'utf8' });
        assert.equal(r.status, 2, argv.join(' '));
        assert.match(r.stderr, /--json/);
    }
});
```

2. Run `node --test tests/station-cli.test.js` and watch the two fail: `--json` is an unknown argument today, exit 2 with `station: unknown argument --json`.

3. In `scripts/station.js`, in `parseArgs`, the initial object gains a field — `const out = { verb: null, roots: [], scan: [], open: false, port: 0, idleMs: 10 * 60e3, forget: null };` becomes:

```js
    const out = { verb: null, roots: [], scan: [], open: false, port: 0, idleMs: 10 * 60e3, forget: null, json: false };
```

and, in `scripts/station.js`, before the `else {` that writes `unknown argument`, one more branch:

```js
        else if (a === '--json') out.json = true;
```

4. In `scripts/station.js`, in `main()`, directly after `const configDir = live.liveConfigDir();` and before `if (args.forget) {`, add:

```js
    // The rows, for a session that wants to read them rather than a page. It
    // walks nothing and writes nothing: `gather` builds the same model
    // `write` renders, from the same sources, and the first-run scan below
    // is the default form's — a five-second walk behind a flag a script
    // calls would be a surprise, not a service.
    if (args.json) {
        if (args.verb || args.forget) {
            process.stderr.write('station: --json prints the rows and takes no verb\n');
            process.exit(2);
        }
        const model = station.gather({
            configDir, roots: args.roots, scan: args.scan, cwd: process.cwd(),
            deadline: scanDeadline(args.scan),
            root: registry.findStateRoot(process.cwd()),
        });
        process.stdout.write(JSON.stringify(model) + '\n');
        return;
    }
```

5. Run `node --test tests/station-cli.test.js` and watch every test in the file pass, the two new ones included.

6. Commit: `feat: station --json prints the rows and writes nothing`.

## Coverage

| promise | task |
|---|---|
| `skills/fankeel-station/` is deleted; nothing else in the tree lists skills by name, so the two manifests need no edit. | Task 1 |
| `skills/fankeel/SKILL.md:600` says where the page is instead of naming a skill | Task 1 |
| The `fankeel` skill's `description` gains the retired skill's routing phrases | Task 1 |
| `tests/contract.test.js:275` and `tests/version.test.js:100` count ten; `README.md:286-289` says ten files and eight skills. | Task 1 |
| `TODO.md:67` and `TODO.md:71` are removed in the same change. | Task 1 |
| A short opening paragraph on `docs/station.md` says how to open the page | Task 2 |
| The `serve` paragraph names `--port <n>` and `--idle <minutes>`, with their defaults | Task 2 |
| The first-run row of the sources table says the walk runs on the default form only | Task 2 |
| `last_verified` moves to 2026-09-07. | Task 2 |
| `node scripts/station.js --json` prints the model `gather()` returns as one JSON document on stdout and writes nothing | Task 3 |
| `--json` beside `serve` or `--forget` is refused with exit 2, the way an unknown argument is. | Task 3 |
| `docs/station.md` says, under "When it is written, and where", what a session does with it | Task 2 |
| `tests/station-cli.test.js` — `--json` prints JSON whose sessions carry `state`, one `live` and one `stale`, and leaves no `station.html` in the config directory | Task 3 |
| `tests/station-cli.test.js` — every `--flag` `parseArgs` accepts appears on `docs/station.md` | Task 2 — written as `tests/station-doc.test.js`, so Tasks 2 and 3 share no file |
| `tests/skills.test.js` — the `fankeel` skill's description carries "監控站" and "clean up old sessions", and no skill names `/fankeel-station` | Task 1 |
| `tests/contract.test.js`, `tests/version.test.js` — green at ten | Task 1 |
| end to end — the `N stale` the default form prints on this registry equals the count of `state == "stale"` in `--json`'s output | verify — run by hand on this registry at the gate; no task writes it |
