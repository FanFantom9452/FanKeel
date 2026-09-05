---
status: current
last_verified: 2026-09-05
source_of_truth: this file is the plan; lib/station.js, scripts/station.js, scripts/task.js, hooks/inject.js, hooks/leave.js are what ships
---

# The Station at Hand Implementation Plan

**Goal:** the station page is rewritten at the `/fankeel` prompt and by every `task.js` verb that moves an entry, a copy of it sits at `.fankeel/station.html` in the registry the user is in, and `discover()` remembers every registry it has ever seen instead of only the ones a session is running in.
**Architecture:** `lib/station.js` grows in one seam — `discover()` gains a roots file and a one-off walk, `write()` takes a `root`, writes twice, rewrites the roots file and returns counts — and the four places that already change an entry call it: `scripts/task.js` from its two badge writers, `hooks/inject.js` on the `/fankeel` prompt, `hooks/leave.js` as today, `scripts/station.js` with a new `--scan`. `renderInit` carries a `station:` line, paid for by two rationale sentences the fankeel skill already holds. A `.gitignore` append is lifted out of `scripts/map.js` into `lib/registry.js` so the copy is ignored the same way the map is.
**Tech Stack:** Node 24 (`v24.9.0`), `node --test`, no dependencies and none may be added (`package.json` has none).
**Spec:** [docs/plans/2026-09-05-station-at-hand-design.md](2026-09-05-station-at-hand-design.md).

## Global Constraints

Taken from the project on 2026-09-05 at `801cc3a`, not remembered.

1. `README.md` *Development* — `lib/` is pure logic and nothing in it requires `scripts/` or `hooks/`; every hook exits 0 on every path and a `SessionEnd` hook writes nothing to stdout; all eight hooks are tested as subprocesses with real payloads; `npm test` is `node --test`; `claude plugin validate .` must pass.
2. `tests/render.test.js:558` — the init block is under 1400 characters at a 59-character reference plugin root (`sizeAtReference`). Today: `init 1391 chars at a 59-char root`. A line added to `renderInit` is paid for inside `INIT`; the cap is not raised.
3. `tests/registry.test.js:212` and `:219` — `writeSession` on a fresh root lays down exactly `sessions/\n`, and an existing `.fankeel/.gitignore` is never overwritten. The append added here touches neither: it writes only when a line is missing.
4. `tests/task.test.js:615-636` — no test may leave a file under the real `~/.claude`. Every `task.js` write of the page goes to `claudeDir(opts)`, the same directory the badge goes to, which the suite points at a fixture.
5. `.claude-plugin/plugin.json` — `hooks/inject.js` runs under `"timeout": 5` seconds on every prompt. `lib/station.js` measured 2026-09-05: `gather` 180 ms, `render` 3 ms, for 3 registries and 137 entries. Task 3 re-measures after the real scan.
6. `lib/station.js:12-15` and `docs/collisions.md` — a config directory that cannot be read counts as live, and the row says `live?`. Unchanged.
7. `lib/stages.js:186` and `git log` — commit subject `type: what changed`, lowercase, under 60 characters; one bullet per change in the body only when the subject cannot hold it.
8. `.fankeel/map.md` filing — `docs/plans` is `plan`, `docs` and `skills` are `reference`; the design this plan argues from is the map's one *planned, not built* page, and this plan joins it until the work lands. `docs/README.md` is the index and is maintained by hand, so both files get a row.
9. Indentation: 4 spaces in `lib/`, `scripts/`, `hooks/`, `tests/station.test.js`, `tests/station-cli.test.js`, `tests/leave.test.js`; 2 spaces in `tests/registry.test.js`, `tests/task.test.js`, `tests/inject.test.js`, `tests/render.test.js`, `tests/stages.test.js`. Match the file you are in.
10. `lib/stages.js` writes an em dash as `—` inside rule strings. Tool input for prose files is literal characters, never `\uXXXX` escapes.
11. `tests/contract.test.js`, `tests/skills.test.js` and `tests/output-styles.test.js` read the skills as fixtures; keep `npm test` green after every task, but do not list a suite a task only has to keep green under `Test:`.
12. `node scripts/todo-check.js` exits 0 today and must after Task 6: every `TODO.md` link resolves, none lands on a plan, decision, report or archive, every entry is under 200 characters and under one of the three headings.

## File structure

| file | responsibility after this plan |
|---|---|
| `lib/registry.js` | owns the `.fankeel/` layout, now including `ensureIgnored(projectRoot, names)` — the one append to `.fankeel/.gitignore` |
| `scripts/map.js` | calls `registry.ensureIgnored` instead of its own `keepIgnored` |
| `lib/station.js` | discovery from five sources including `<configDir>/fankeel/roots.json` and a `scan` walk; `write()` writes the page twice, rewrites the roots file, returns counts |
| `scripts/station.js` | `--scan <dir>`, repeatable; prints the counts after the path |
| `scripts/task.js` | `showBadge` and `hideBadge` rewrite the page after the badge |
| `hooks/leave.js` | passes `root` so the copy lands beside the ending session |
| `hooks/inject.js` | writes the page on the `/fankeel` prompt, before the block that names it |
| `lib/render.js` | `renderInit` takes `station` and prints one line |
| `lib/stages.js` | `INIT` loses two rationale sentences the fankeel skill holds; `INIT_TEMPLATE` gains a slot |
| `docs/station.md`, `skills/fankeel-station/SKILL.md`, `README.md`, `skills/fankeel/SKILL.md`, `TODO.md`, `docs/README.md` | say where the page is, when it is written, and how a registry is found |

## Task 1: One append to `.fankeel/.gitignore`

**Files:**
- Modify: `lib/registry.js` — add `ensureIgnored` after `ensureLayout` (`:196-203`) and export it
- Modify: `scripts/map.js` — drop `IGNORE_LINE` (`:16`) and `keepIgnored` (`:26-41`); call `registry.ensureIgnored` at `:47`
- Test: `tests/registry.test.js`

**Interfaces:**
- Consumes: nothing from an earlier task.
- Produces: `registry.ensureIgnored(projectRoot: string, names: string[]): boolean` — creates `<projectRoot>/.fankeel/` if missing, appends each name not already a line of `.fankeel/.gitignore`, returns `true` when it wrote. Task 2 calls it with `['station.html']`.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus the test.

**Steps:**

1. Add the failing test to `tests/registry.test.js`, after the test ending at `:226` (`an existing .fankeel/.gitignore is never overwritten`). `tmpRoot` is the helper the tests above it use.

```js
// The append `scripts/map.js` had for `map.md`, lifted here so the station's
// copy under `.fankeel/` is ignored the same way. It writes only when a line is
// missing: a file somebody edited by hand comes back byte-identical.
test('ensureIgnored appends only what is missing and leaves a complete file alone', () => {
  const root = tmpRoot();
  assert.equal(registry.ensureIgnored(root, ['sessions/', 'station.html']), true);
  const ignore = path.join(root, '.fankeel', '.gitignore');
  assert.equal(fs.readFileSync(ignore, 'utf8'), 'sessions/\nstation.html\n');
  fs.writeFileSync(ignore, 'sessions/\nscratch/\nstation.html\n');
  assert.equal(registry.ensureIgnored(root, ['station.html']), false);
  assert.equal(fs.readFileSync(ignore, 'utf8'), 'sessions/\nscratch/\nstation.html\n');
});
```

2. Run it and watch it fail:

```
node --test tests/registry.test.js 2>&1 | grep -E "^ℹ (pass|fail)|✖"
```

Expected: one `✖` (`registry.ensureIgnored is not a function`) and `ℹ fail 1`. The spec reporter prints `✔`/`✖` and `ℹ pass`/`ℹ fail`; there are no `ok` lines.

3. In `lib/registry.js`, after `ensureLayout` (the function ending at `:203`), add:

```js
// Appends what is missing and touches nothing else, so a line somebody added by
// hand survives. `scripts/map.js` and `lib/station.js` both put a generated
// file under `.fankeel/`, and two copies of this append were two lists.
function ensureIgnored(projectRoot, names) {
    const dir = stateDir(projectRoot);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, '.gitignore');
    let text = '';
    try {
        text = fs.readFileSync(file, 'utf8');
    } catch (e) { /* first run */ }
    const lines = text.split(/\r?\n/).filter(Boolean);
    const missing = names.filter((n) => !lines.includes(n));
    if (!missing.length) return false;
    fs.writeFileSync(file, lines.concat(missing).join('\n') + '\n');
    return true;
}
```

   Add `ensureIgnored,` and `renameRetrying,` to the `module.exports` object at `:602`, after `ensureLayout,`. `renameRetrying` (`:229`) is not exported today; Task 2 writes `roots.json` through it, and this is the task that opens the exports object.

4. In `scripts/map.js`: delete line 16 (`const IGNORE_LINE = 'map.md';`) and the `keepIgnored` function with its comment (`:26-41`). Add `const registry = require('../lib/registry.js');` after the `lib/map.js` require at `:13`. Replace the call at `:47`:

```js
    keepIgnored(stateDir);
```
   with
```js
    // The map is generated, so committing it would put a file in review that
    // nobody wrote. sessions/ is the registry and build/ is one plan's ledger.
    registry.ensureIgnored(root, ['sessions/', 'build/', 'map.md']);
```

5. Run and watch it pass, then the two suites that pin the ignore file:

```
node --test tests/registry.test.js tests/map-cli.test.js tests/map.test.js 2>&1 | grep -E "^ℹ (pass|fail)|✖"
```

Expected: `ℹ fail 0`. `tests/map-cli.test.js:35-50` pins `map.md`, `sessions/` and `build/` each once after two runs.

6. Commit: `feat: one append to .fankeel/.gitignore, in registry.js`.

## Task 2: `lib/station.js` — roots file, scan, two copies, counts

**Files:**
- Modify: `lib/station.js` — header comment `:4-8`, `discover` `:40-54`, `stationPath` `:259`, `write` `:263-269`, `module.exports` `:271`
- Test: `tests/station.test.js`

**Interfaces:**
- Consumes: `registry.ensureIgnored(projectRoot, names)` and `registry.renameRetrying(temp, file)` from Task 1.
- Produces:
  - `write(opts): { file: string, copy: string | null, registries: number, live: number, stale: number, down: number }` — `opts` as before plus `root?: string` (the registry to copy into; ignored unless `<root>/.fankeel/sessions/` exists), `scan?: string[]` (directories to walk), `now?: number`. Tasks 3, 4 and 5 read the return.
  - `discover(opts)` additionally reads `roots.json` and walks `opts.scan`.
  - `scanRoots(dir: string): string[]`, `readRoots(configDir: string): { [root: string]: string }`, `rootsPath(configDir: string): string` — exported for the tests and for Task 3.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus the tests.

**Steps:**

1. In `tests/station.test.js`, replace the test at `:99-104` (`write puts the page under <configDir>/fankeel/station.html`) with these three. `fixture()` above them makes two registries, `r1` found through a lead and `r2` through a running session's `cwd`, with one `live`, one `stale` and one `down` session between them.

```js
test('write returns the counts and both paths, copies the page into the caller\'s registry, and ignores it there', () => {
    const f = fixture();
    const out = station.write({ configDir: f.cfg, root: f.r1 });
    assert.equal(out.file, path.join(f.cfg, 'fankeel', 'station.html'));
    assert.equal(out.copy, path.join(f.r1, '.fankeel', 'station.html'));
    assert.deepEqual([out.registries, out.live, out.stale, out.down], [2, 1, 1, 1]);
    assert.ok(fs.readFileSync(out.file, 'utf8').includes('live one'));
    assert.equal(fs.readFileSync(out.copy, 'utf8'), fs.readFileSync(out.file, 'utf8'));
    assert.match(fs.readFileSync(path.join(f.r1, '.fankeel', '.gitignore'), 'utf8'), /^station\.html$/m);
    station.write({ configDir: f.cfg, root: f.r1 });
    const lines = fs.readFileSync(path.join(f.r1, '.fankeel', '.gitignore'), 'utf8').split(/\r?\n/);
    assert.equal(lines.filter((l) => l === 'station.html').length, 1, 'a second write does not duplicate the line');
    // A root with no registry gets no copy and no .fankeel/ — a hook handing
    // over its launch directory must not create one there.
    const bare = path.join(f.base, 'no-registry');
    fs.mkdirSync(bare);
    assert.equal(station.write({ configDir: f.cfg, root: bare }).copy, null);
    assert.equal(fs.existsSync(path.join(bare, '.fankeel')), false);
});

// What the lead forgets. A lead is cleared with its badge, so a registry with no
// task running in it had nothing pointing at it: 3 of at least 11 on 2026-09-05.
test('discover reads roots.json; write stamps the present, keeps the gone for thirty days, then drops them', () => {
    const f = fixture();
    const now = Date.now();
    const r3 = path.join(f.base, 'ws-three');
    registry.ensureLayout(r3);
    const gone = path.join(f.base, 'gone');
    const old = path.join(f.base, 'older');
    fs.mkdirSync(path.join(f.cfg, 'fankeel'), { recursive: true });
    fs.writeFileSync(station.rootsPath(f.cfg), JSON.stringify({
        [r3]: new Date(now - 5 * DAY).toISOString(),
        [gone]: new Date(now - 5 * DAY).toISOString(),
        [old]: new Date(now - 31 * DAY).toISOString(),
    }));
    const found = station.discover({ configDir: f.cfg });
    assert.ok(found.roots.includes(path.resolve(r3)), 'a root only roots.json names');
    assert.deepEqual(found.gone, [gone, old].map((p) => path.resolve(p)).sort());
    station.write({ configDir: f.cfg, now });
    const roots = station.readRoots(f.cfg);
    assert.equal(roots[path.resolve(r3)], new Date(now).toISOString());
    assert.equal(roots[path.resolve(f.r1)], new Date(now).toISOString(), 'a root found through a lead is remembered');
    assert.equal(roots[path.resolve(gone)], new Date(now - 5 * DAY).toISOString(), 'gone keeps its stamp');
    assert.equal(path.resolve(old) in roots, false, 'gone for 31 days is dropped');
    fs.writeFileSync(station.rootsPath(f.cfg), '{not json');
    assert.deepEqual(station.readRoots(f.cfg), {}, 'an unreadable file is empty, not fatal');
});

test('scanRoots finds a registry two levels down, skips node_modules and dot-directories, and stops at its depth', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-station-scan-'));
    const deep = path.join(base, 'a', 'b');
    registry.ensureLayout(deep);
    registry.ensureLayout(path.join(base, 'node_modules', 'pkg'));
    registry.ensureLayout(path.join(base, '.hidden', 'ws'));
    registry.ensureLayout(path.join(base, '1', '2', '3', '4', '5', '6', '7'));
    assert.deepEqual(station.scanRoots(base), [path.resolve(deep)]);
    const found = station.discover({ configDir: path.join(base, 'cfg'), scan: [base] });
    assert.ok(found.roots.includes(path.resolve(deep)));
});
```

2. Run and watch them fail:

```
node --test tests/station.test.js 2>&1 | grep -E "^ℹ (pass|fail)|✖"
```

Expected: three `✖` and `ℹ fail 3` — `out.file` is undefined because `write` returns a string, `station.rootsPath` is not a function, `station.scanRoots` is not a function.

3. Rewrite the header comment at `lib/station.js:4-8`:

```js
// Discovery is the part nothing else here does. A registry is per workspace and
// `findStateRoot` walks up from one directory, so no reader knows more than one.
// Five sources, unioned: the `root=` field of every lead under `modes/`, the
// `cwd` of every running Claude Code session walked up to its registry, the
// roots file every `write` below rewrites, any directory the caller asks to
// have walked, and whatever the caller names. Leads are pointers and die with
// the badge; the roots file is what remembers; the registry is the record.
```

4. After `hasRegistry` (`:32-38`), add the roots file and the walk:

```js
function rootsPath(configDir) {
    return path.join(String(configDir == null ? '' : configDir), 'fankeel', 'roots.json');
}

// What the lead forgets. A lead is cleared with its badge — at `down`, `clear`,
// `adopt` and the prompt after a stand-down — so a registry with no task
// running in it has nothing pointing at it, and on 2026-09-05 the page found 3
// of at least 11. This file is rewritten by every `write`: a root seen with a
// `sessions/` directory is stamped now, a root that has gone keeps its last
// stamp, and one gone for longer than the badge TTL is dropped.
const ROOT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function readRoots(configDir) {
    let data;
    try {
        data = JSON.parse(fs.readFileSync(rootsPath(configDir), 'utf8'));
    } catch (e) {
        return {};
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    const out = {};
    for (const [root, seen] of Object.entries(data)) {
        if (typeof seen === 'string' && Number.isFinite(Date.parse(seen))) out[root] = seen;
    }
    return out;
}

// Written to a sibling and renamed, the way `lib/registry.js` writes an entry:
// `task.js`, `inject.js` and `leave.js` can all write this in the same second,
// and a torn read here is the page forgetting every registry at once.
function rememberRoots(configDir, registries, now) {
    const old = readRoots(configDir);
    const next = {};
    for (const r of registries) {
        if (!r.gone) next[r.root] = new Date(now).toISOString();
        else if (old[r.root] && now - Date.parse(old[r.root]) <= ROOT_TTL_MS) next[r.root] = old[r.root];
    }
    const file = rootsPath(configDir);
    const temp = file + '.' + process.pid + '.tmp';
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(temp, JSON.stringify(next, null, 2) + '\n');
    registry.renameRetrying(temp, file);
    return next;
}

// The one-off walk behind `--scan`: every directory under `dir`, to six levels,
// that holds `.fankeel/sessions/`. Not a default and not a hook — a home
// directory is minutes, and %TEMP% held 297,088 test fixtures on 2026-09-05.
const SCAN_DEPTH = 6;
const SCAN_SKIP = new Set(['node_modules', '.git']);

function scanRoots(dir, depth) {
    const left = typeof depth === 'number' ? depth : SCAN_DEPTH;
    const out = [];
    const abs = resolved(dir);
    if (!abs) return out;
    if (hasRegistry(abs)) out.push(abs);
    if (left <= 0) return out;
    let names;
    try {
        names = fs.readdirSync(abs, { withFileTypes: true });
    } catch (e) {
        return out;
    }
    for (const d of names) {
        if (!d.isDirectory() || SCAN_SKIP.has(d.name) || d.name.startsWith('.')) continue;
        out.push(...scanRoots(path.join(abs, d.name), left - 1));
    }
    return out;
}
```

   `renameRetrying` is defined at `lib/registry.js:229` and Task 1 exported it beside `ensureIgnored` — this is the second caller of the Windows-safe rename, and the reason it retries is in the comment above it. Touch nothing in `lib/registry.js` here.

5. In `discover` (`:40-54`), after the `runningSessions` loop and before the `opts.roots` loop, add:

```js
    for (const root of Object.keys(readRoots(configDir))) add(root);
    for (const dir of opts.scan || []) for (const root of scanRoots(dir)) add(root);
```

6. Replace `write` (`:263-269`) and the export line:

```js
function write(opts) {
    const configDir = String(opts.configDir == null ? '' : opts.configDir);
    const now = typeof opts.now === 'number' ? opts.now : Date.now();
    const model = gather(Object.assign({}, opts, { now }));
    const html = render(model, { plugin: opts.plugin });
    const file = stationPath(configDir);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, html);
    rememberRoots(configDir, model.registries, now);
    // The copy beside the user, and only into a registry that exists: a caller
    // handing over its launch directory must not grow a `.fankeel/` there. The
    // canonical file above is always the newest; this one is refreshed by the
    // sessions in this registry, and the page header dates both.
    let copy = null;
    const root = opts.root ? resolved(opts.root) : null;
    if (root && hasRegistry(root)) {
        try {
            registry.ensureIgnored(root, ['station.html']);
            copy = path.join(root, '.fankeel', 'station.html');
            fs.writeFileSync(copy, html);
        } catch (e) {
            copy = null;
        }
    }
    const counts = { live: 0, stale: 0, down: 0 };
    for (const r of model.registries) for (const s of r.sessions) counts[s.state]++;
    return {
        file,
        copy,
        registries: model.registries.filter((r) => !r.gone).length,
        live: counts.live,
        stale: counts.stale,
        down: counts.down,
    };
}

module.exports = { discover, gather, render, write, scanRoots, readRoots, rootsPath };
```

7. Run and watch them pass, and the two suites that call `write` through the CLI and the hook — both still read the page by path and are green until Tasks 3 and 4 change what they print:

```
node --test tests/station.test.js tests/station-cli.test.js tests/leave.test.js 2>&1 | grep -E "^ℹ (pass|fail)|✖"
```

Expected: `ℹ fail 0`. `scripts/station.js:139` prints `'fankeel station — ' + file` where `file` is now an object; that line prints `[object Object]` until Task 3 and no test pins it, but if `tests/station-cli.test.js:49` fails on `out.includes(file)`, that is Task 3's first step arriving early — do Task 3 step 3 now and say so in the return.

8. Commit: `feat: station remembers its registries, scans on request, writes beside the user`.

## Task 3: `scripts/station.js --scan`, the counts, and the measurement

**Files:**
- Modify: `scripts/station.js` — usage comment `:5-11`, `parseArgs` `:28-43`, `serve`'s `gatherOpts` `:67`, `main` `:153-155`
- Test: `tests/station-cli.test.js`

**Interfaces:**
- Consumes: `station.write(opts)` returning `{ file, copy, registries, live, stale, down }`, `opts.scan`, `opts.root` (Task 2); `registry.findStateRoot(dir)` (`lib/registry.js:79`, existing).
- Produces: nothing a later task calls. The command's stdout gains a second line — `  <n> registries · <l> live, <s> stale, <d> down`, then `  ·  copy at <path>` when there is one.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription, the test, and one timed run on this machine.

**Steps:**

1. In `tests/station-cli.test.js`, change the test at `:49-55` and add one after it. The `fixture()` above has one registry `r1` with a `live` and a `stale` session; pass `cwd: f.base` so the process's own working directory — this repository, which has a registry — does not join the count.

```js
test('the default form writes the page, prints its path and the counts', () => {
    const f = fixture();
    const out = execFileSync(process.execPath, [CLI], { cwd: f.base, env: { ...process.env, CLAUDE_CONFIG_DIR: f.cfg }, encoding: 'utf8' });
    const file = path.join(f.cfg, 'fankeel', 'station.html');
    assert.ok(out.includes(file));
    assert.match(out, /1 registries · 1 live, 1 stale, 0 down/);
    assert.ok(fs.readFileSync(file, 'utf8').includes('stale'));
});

test('--scan walks a directory for registries, and the next run remembers what it found', () => {
    const f = fixture();
    const far = path.join(f.base, 'elsewhere', 'deep', 'ws2');
    registry.ensureLayout(far);
    registry.writeSession(far, 'cccccccc-3333-4333-8333-333333333333', { task: 'scanned', stage: 'land', route: ['survey', 'land'],
        active: false, claims: [], started: new Date().toISOString(), updated: new Date().toISOString(), configDir: f.cfg });
    const env = { ...process.env, CLAUDE_CONFIG_DIR: f.cfg };
    const out = execFileSync(process.execPath, [CLI, '--scan', path.join(f.base, 'elsewhere')], { cwd: f.base, env, encoding: 'utf8' });
    assert.match(out, /2 registries · 1 live, 1 stale, 1 down/);
    assert.ok(fs.readFileSync(path.join(f.cfg, 'fankeel', 'station.html'), 'utf8').includes('scanned'));
    const again = execFileSync(process.execPath, [CLI], { cwd: f.base, env, encoding: 'utf8' });
    assert.match(again, /2 registries/, 'roots.json remembered the scanned registry');
    const inside = execFileSync(process.execPath, [CLI], { cwd: far, env, encoding: 'utf8' });
    assert.match(inside, /copy at /);
    assert.ok(fs.existsSync(path.join(far, '.fankeel', 'station.html')), 'run from inside a registry, the copy lands there');
});
```

2. Run and watch them fail:

```
node --test tests/station-cli.test.js 2>&1 | grep -E "^ℹ (pass|fail)|✖"
```

Expected: `ℹ fail 2` — `station: unknown argument --scan` exits 2, and the counts line is absent.

3. In `scripts/station.js`: add `const registry = require('../lib/registry.js');` after the `lib/station.js` require at `:22`. In `parseArgs`, add `scan: []` to the `out` object and this branch after the `--root` one:

```js
        else if (a === '--scan' && argv[i + 1]) out.scan.push(argv[++i]);
```

   In `serve`, the `gatherOpts` line becomes:

```js
    const gatherOpts = { configDir, roots: opts.roots || [], scan: opts.scan || [], cwd: process.cwd() };
```

   and `main` passes `scan: args.scan` into `serve(...)`. Replace the three lines at `:153-155`:

```js
    const out = station.write({
        configDir, roots: args.roots, scan: args.scan, cwd: process.cwd(),
        root: registry.findStateRoot(process.cwd()), plugin: PLUGIN,
    });
    process.stdout.write('fankeel station — ' + out.file + '\n'
        + '  ' + out.registries + ' registries · ' + out.live + ' live, ' + out.stale + ' stale, ' + out.down + ' down'
        + (out.copy ? '  ·  copy at ' + out.copy : '') + '\n');
    if (args.open) openInBrowser(out.file);
```

   Update the usage comment at `:5-11`: the first form is `node scripts/station.js [--root <dir>]... [--scan <dir>]... [--open]`, and add one sentence: `--scan` walks a directory for registries once; what it finds is remembered in `<configDir>/fankeel/roots.json`, so it is run once per drive.

4. Run and watch them pass:

```
node --test tests/station-cli.test.js 2>&1 | grep -E "^ℹ (pass|fail)|✖"
```

Expected: `ℹ fail 0`.

5. The measurement the design left unverified. On this machine, in the repository:

```
time node scripts/station.js --scan F:/ymlab --scan F:/MC_Server
time node scripts/station.js
```

   Quote both `real` figures and the counts line in the return. The second run is what every `task.js` verb and the `/fankeel` prompt will pay from Task 4 on; the field report expects it to name at least 11 registries. If the second run is over 2 seconds, say so before Task 5 is dispatched — that is the hook with a five-second budget.

6. Commit: `feat: station --scan, and the counts after the path`.

## Task 4: `task.js` and `leave.js` rewrite the page

**Files:**
- Modify: `scripts/task.js` — requires near `:1-20`, `showBadge` `:83-116`, `hideBadge` `:117-125` and its three callers `:729`, `:828`, `:872`
- Modify: `hooks/leave.js` — the `station.write` call at `:50`
- Test: `tests/task.test.js`, `tests/leave.test.js`

**Interfaces:**
- Consumes: `station.write({ configDir, root, plugin })` (Task 2).
- Produces: nothing a later task calls.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus the tests.

**Steps:**

1. In `tests/task.test.js`, the test at `:101-105` pins `.fankeel/.gitignore` to exactly `sessions/\n` after `start`. It now also carries `station.html`, so change its last line to:

```js
  const ignore = fs.readFileSync(path.join(dir, '.fankeel', '.gitignore'), 'utf8');
  assert.match(ignore, /^sessions\/$/m);
  assert.match(ignore, /^station\.html$/m, 'start writes the station copy and keeps it out of git');
```

   Then add, after it:

```js
// The page is rewritten by every verb that moves an entry, so it is current
// when the user opens it and not only when a session ends. `note` moves no
// row the summary shows and leaves the page alone; the next verb catches up.
test('start regenerates the station in the config dir and beside the registry; note does not', () => {
  const dir = root();
  run(dir, ['start', '--session', A, '--task', 'tidy the project cards']);
  const page = path.join(dir, 'cfg', 'fankeel', 'station.html');
  const copy = path.join(dir, '.fankeel', 'station.html');
  assert.ok(fs.readFileSync(page, 'utf8').includes('tidy the project cards'));
  assert.equal(fs.readFileSync(copy, 'utf8'), fs.readFileSync(page, 'utf8'));
  run(dir, ['note', 'a dead end', '--session', A]);
  assert.equal(fs.readFileSync(page, 'utf8').includes('a dead end'), false, 'note does not rewrite the page');
  run(dir, ['down', '--session', A]);
  assert.match(fs.readFileSync(page, 'utf8'), /class="s down"/, 'down rewrites it through hideBadge');
});
```

   In `tests/leave.test.js`, add to the end of the first test (after the `station.html` assertion at `:59`):

```js
    assert.equal(fs.readFileSync(path.join(f.root, '.fankeel', 'station.html'), 'utf8'),
        fs.readFileSync(path.join(f.cfg, 'fankeel', 'station.html'), 'utf8'), 'the copy lands beside the ending session');
```

2. Run and watch them fail:

```
node --test tests/task.test.js tests/leave.test.js 2>&1 | grep -E "^ℹ (pass|fail)|✖"
```

Expected: `ℹ fail 3` — no `station.html` under `cfg/fankeel/` after `start`, no `station.html` line in the ignore file, no copy beside the ending session.

3. In `scripts/task.js`, add with the other requires: `const station = require('../lib/station.js');` and `const PLUGIN = path.resolve(__dirname, '..');` — `task.js` has no `PLUGIN` today; `scripts/station.js:26` spells the same one. Add this function after `hideBadge`:

```js
// The page is rewritten wherever the entry changes — every verb goes through
// one of the two badge writers above — so it is current when the user opens
// it, not only when a session ends. `note` and `next` move no row the summary
// shows and go through neither; the next verb catches the page up.
function refreshStation(dir, root) {
    try {
        station.write({ configDir: dir, root, plugin: PLUGIN });
    } catch (e) { /* housekeeping; never worth failing a write that succeeded */ }
}
```

   At the end of `showBadge`, after the `try` block that writes the lead, add `refreshStation(dir, root);`. Change `hideBadge`'s signature to `function hideBadge(opts, sessionId, root)` and add `refreshStation(dir, root);` after its `try` block. Change the three callers: `hideBadge(opts, id)` at `:729` to `hideBadge(opts, id, root)`, `hideBadge(opts, from)` at `:828` to `hideBadge(opts, from, root)`, `hideBadge(opts, target)` at `:872` to `hideBadge(opts, target, root)`. All three are inside `cmdDown`, `cmdAdopt` and `cmdClear`, whose first parameter is `root`.

4. In `hooks/leave.js`, the call at `:50` becomes:

```js
        station.write({ configDir: live.liveConfigDir(), cwd: registry.launchRoot(payload), root });
```

   `root` is `registry.rootFor(payload)`, already in scope at `:33`; when it is the launch directory rather than a registry, `write` makes no copy.

5. Run and watch them pass, and the rest of the suite:

```
node --test tests/task.test.js tests/leave.test.js 2>&1 | grep -E "^ℹ (pass|fail)|✖"
npm test 2>&1 | grep -E "^ℹ (pass|fail)"
```

Expected: `ℹ fail 0` on both.

6. Commit: `feat: every task.js verb and every session end rewrite the station`.

## Task 5: The `/fankeel` prompt writes the page and says where it is

**Files:**
- Modify: `hooks/inject.js` — requires `:18-27`, the `starting` branch `:60-90`
- Modify: `lib/render.js` — `renderInit` `:229-243`
- Modify: `lib/stages.js` — `INIT` `:131-132`, `INIT_TEMPLATE` `:137-142`
- Test: `tests/inject.test.js`, `tests/render.test.js`

**Interfaces:**
- Consumes: `station.write({ configDir, cwd, root, plugin })` returning `{ file, live, stale, ... }` (Task 2); `PLUGIN_ROOT` from `lib/render.js` (existing).
- Produces: `renderInit({ sessionId, station })` where `station` is `write`'s return or `null`; one line `station: <s> stale, <l> live — <file>` after the id lines when it is given. Nothing later consumes it.

**Dispatch:** implementer, sonnet — the plan carries the code and the exact strings; transcription plus the tests, with the cap diagnostic quoted in the return.

**Steps:**

1. In `tests/render.test.js`, after the test at `:557-563` (`the init block is capped like every other block of rules`), add:

```js
// The page is written a moment before this block, so the figure is this
// prompt's. The line is paid for inside `INIT`: two rationale sentences the
// fankeel skill already holds left it, and the cap did not move.
test('the init block carries the station line when it is given one, and stays under the cap with it', (t) => {
  const out = renderInit({ sessionId: MINE, station: { file: 'C:/Users/you/.claude/fankeel/station.html', live: 2, stale: 8, down: 131 } });
  assert.match(out, /^station: 8 stale, 2 live — C:\/Users\/you\/\.claude\/fankeel\/station\.html$/m);
  const size = sizeAtReference(out);
  t.diagnostic('init+st'.padEnd(7) + size + ' chars at a ' + REFERENCE_ROOT + '-char root  (' + out.length + ' here)');
  assert.ok(size < 1400, 'init block with a station line is ' + size + ' chars');
  assert.doesNotMatch(renderInit({ sessionId: MINE }), /^station:/m, 'no page, no line');
  assert.match(out, /<the station line, if any>/, 'the shape has a slot for it');
});
```

   In `tests/inject.test.js`, extend the test at `:394-400` (`a /fankeel prompt is answered with the id the hooks use`) with two lines before its closing brace:

```js
  assert.match(text, /^station: \d+ stale, \d+ live — /m, 'the block names the page');
  assert.ok(fs.existsSync(path.join(cfg, 'fankeel', 'station.html')), 'the page was written at the prompt');
```

   and add after it:

```js
test('a /fankeel prompt inside a registry leaves a copy of the page beside it', () => {
  const root = tmp('fankeel-hook-');
  const cfg = tmp('fankeel-cfg-');
  seed(root, THEIRS, { active: false });
  run({ session_id: MINE, cwd: root, prompt: '/fankeel' }, cfg);
  assert.ok(fs.existsSync(path.join(root, '.fankeel', 'station.html')));
  assert.match(fs.readFileSync(path.join(root, '.fankeel', '.gitignore'), 'utf8'), /^station\.html$/m);
});
```

2. Run and watch them fail:

```
node --test tests/render.test.js tests/inject.test.js 2>&1 | grep -E "^ℹ (pass|fail)|✖"
```

Expected: `ℹ fail 3` — no `station:` line from `renderInit`, none in the hook's context and no page written, no copy.

3. In `lib/stages.js`, two rules lose their rationale sentence — both sentences are in `skills/fankeel/SKILL.md` under **Asking** and **Start does not stop there** — and the template gains a slot. At `:131`:

```js
    'Ask with AskUserQuestion, never in prose: the project only when the root holds more than one, then the task. Never ask for a file list — claims are recorded as the edits land.',
```
   becomes
```js
    'Ask with AskUserQuestion, never in prose: the project only when the root holds more than one, then the task. Never ask for a file list.',
```

   At `:132`:

```js
    'Then `{{TASK}} start`, and begin the first stage on the route in the same turn — `--route` can make that something other than `survey`. "Entry written, shall I begin?" spends a turn on a question whose answer is always yes.',
```
   becomes
```js
    'Then `{{TASK}} start`, and begin the first stage on the route in the same turn — `--route` can make that something other than `survey`.',
```

   `INIT_TEMPLATE` at `:137-142` becomes:

```js
const INIT_TEMPLATE = [
    '<what orient returned>',
    '<the TODO.md clusters, or the recent commits>',
    '<the station line, if any>',
    '',
    'then AskUserQuestion',
].join('\n');
```

4. In `lib/render.js`, `renderInit` (`:229-243`) becomes:

```js
function renderInit({ sessionId, station }) {
    if (!sessionId) return null;
    const lines = [
        'fankeel: this session is ' + sessionId,
        'That is the id every hook here reads. Pass it to --session; an id read',
        'off a path on screen may be a different one.',
    ];
    // Where the page is and what is waiting on it. `hooks/inject.js` writes the
    // page a moment before building this, so the figure is this prompt's.
    if (station && typeof station.file === 'string') {
        lines.push('station: ' + station.stale + ' stale, ' + station.live + ' live — ' + station.file);
    }
    lines.push('', PLUGIN_MARK + ' = ' + PLUGIN_ROOT, 'init rules:');
    for (const rule of initRules(SCRIPTS)) lines.push('  - ' + rule);
    lines.push('', 'output shape:');
    for (const line of INIT_TEMPLATE.split('\n')) lines.push(line ? '  ' + line : '');
    return lines.join('\n');
}
```

5. In `hooks/inject.js`: add `const station = require('../lib/station.js');` after the `lib/badge.js` require at `:20`, and change the `lib/render.js` require at `:22` to `const { render, renderInit, PLUGIN_ROOT } = require('../lib/render.js');`. In the `starting` branch, the block at `:60-90` currently computes `starting`, writes the context, then reads `const dir = claudeConfigDir();`. Move that `const dir = claudeConfigDir();` line up to directly after `const starting = startsFankeel(payload.prompt);`, and between it and the `if (starting && registry.sessionPath(root, sessionId))` output block insert:

```js
        // The page, before the block that names it. `write` is a few hundred
        // milliseconds against this hook's five-second budget, and a failure
        // here costs one line of the block rather than the block.
        let page = null;
        if (starting && dir) {
            try {
                page = station.write({ configDir: dir, cwd: launch, root, plugin: PLUGIN_ROOT });
            } catch (e) { /* housekeeping */ }
        }
```

   and change the output block's `additionalContext: renderInit({ sessionId }),` to `additionalContext: renderInit({ sessionId, station: page }),`. Delete the later `const dir = claudeConfigDir();` so `dir` is declared once.

6. Run and watch them pass, quote the two diagnostics, then the whole suite:

```
node --test tests/render.test.js tests/inject.test.js tests/stages.test.js 2>&1 | grep -E "^ℹ (pass|fail)|✖|chars at a"
npm test 2>&1 | grep -E "^ℹ (pass|fail)"
```

Expected: `ℹ fail 0`, and two `init` diagnostics both under 1400 — the block without a station line lost about 130 characters and the one with it gains about 70 plus the 29-character slot. Put both figures in the return.

7. Commit: `feat: the /fankeel prompt writes the station and names it`.

## Task 6: The documents say where the page is and when it is written

**Files:**
- Modify: `docs/station.md` — frontmatter `last_verified`, the decisions sentence `:10-12`, the sources table `:15-24`, `## Two forms` `:52-58`
- Modify: `skills/fankeel-station/SKILL.md` — frontmatter `last_verified`, `:12-20`
- Modify: `README.md` — `:129-132`
- Modify: `skills/fankeel/SKILL.md` — `:25`, `:81`, `:515-516`
- Modify: `TODO.md` — `:54`, `:65`
- Modify: `docs/README.md` — two rows after `:42`

**Interfaces:**
- Consumes: nothing by code. It describes Tasks 2–5 and runs after them.
- Produces: nothing a later task calls.

**Dispatch:** implementer, sonnet — the plan carries the exact text; transcription, then `todo-check` and `docs-check` green.

**Steps:**

1. `docs/station.md`. Set `last_verified: 2026-09-05`. The sentence at `:10-12` becomes:

```markdown
Every fankeel session on this machine, on one page. This is the reference for
what is on it and where it comes from; the decisions are in
[plans/2026-09-04-session-station-design.md](plans/2026-09-04-session-station-design.md)
and, for how it is found and when it is written,
[plans/2026-09-05-station-at-hand-design.md](plans/2026-09-05-station-at-hand-design.md).
```

   The table under `## Where the registries come from` becomes six rows, and the sentence before it says "Six sources, unioned:":

```markdown
| source | what it finds |
|---|---|
| `~/.claude/fankeel/roots.json` | every registry any write of the page has seen with a `sessions/` directory, for thirty days after it last had one. Rewritten by every write, which is what remembers a registry after its last lead is cleared |
| `~/.claude/modes/<id>/fankeel.lead`, its `root=` line | every registry a session is running a task in right now — the lead is cleared with the badge at `down`, `clear`, `adopt` and the prompt after a stand-down, and pruned after thirty days |
| `~/.claude/sessions/<pid>.json`, its `cwd`, walked up | every registry a running session is in, whether or not it has started a task |
| the directory the command runs in, walked up — at `SessionEnd`, the ending session's own launch directory | the registry in front of you, including the one whose session is leaving the running set at that moment |
| `--scan <dir>` | a one-off walk of `<dir>`, six levels deep, skipping `node_modules`, `.git` and dot-directories. What it finds is remembered, so it is run once per drive |
| `--root <dir>` | anything else |
```

   Replace `## Two forms` and its paragraph with:

```markdown
## When it is written, and where

`lib/station.js`'s `write` runs at four moments: the `/fankeel` prompt
(`hooks/inject.js`, which then names the page and its `stale` count in the
block it injects), every `task.js` verb that moves an entry — `start`,
`stage`, `task`, `route`, `guard`, `adopt`, `down` and `clear`, not `note` or
`next` — every session end (`hooks/leave.js`), and `node scripts/station.js`.
Each writes `~/.claude/fankeel/station.html`, the copy that is always newest,
and, when the caller is inside a registry, the same page at
`<registry>/.fankeel/station.html`, kept out of git by a line the write adds.
That copy is refreshed by the sessions in its registry; the header on both
says when it was generated.

`serve` runs a loopback server only while clearing; it renders afresh on
every request, takes a POST from the clear button on a `stale` row, answers
`409` for a `live` one and `403` without the per-run nonce, and exits after
ten idle minutes. The static copies carry the `task.js clear` command on each
`stale` row instead of the button.
```

2. `skills/fankeel-station/SKILL.md`. Set `last_verified: 2026-09-05`. Lines `:12-20` become:

```markdown
# fankeel-station

The station is a page, not a process. It is rewritten at the `/fankeel`
prompt, by every `task.js` verb that moves an entry, and when a session ends,
so opening it is enough — from the registry you are in:

    .fankeel/station.html

or the copy that is always newest:

    node <plugin>/scripts/station.js --open

`<plugin>` is two directories up from this file. The page finds registries
through a roots file every write refreshes (`~/.claude/fankeel/roots.json`),
the leads under `~/.claude/modes/` of sessions running a task now, and the
working directory of every running session. A registry none of those has
seen yet is found once by `--scan <dir>` — one run per drive, and it is
remembered from then on — or named with `--root <dir>`.
```

3. `README.md:129-132` becomes:

```markdown
Every session this machine has run, live or abandoned or stood down, is one
page: the station. It is rewritten at `/fankeel`, by every `task.js` verb and
at every session end, and a copy sits at `.fankeel/station.html` in the
registry you are in; `node scripts/station.js --open` opens the newest.
`serve` in place of that is the clearing form — it runs the page as a server
for as long as putting an abandoned session down takes.
```

4. `skills/fankeel/SKILL.md`. At `:25` and `:81`, `sessions/, map.md, build/` becomes `sessions/, map.md, build/, station.html`. At `:515-516`:

```markdown
excludes what is per-machine or regenerated, `sessions/` and `map.md` and
`build/`, and this is the one it deliberately leaves in. One
```
   becomes
```markdown
excludes what is per-machine or regenerated, `sessions/` and `map.md` and
`build/` and `station.html`, and this is the one it deliberately leaves in. One
```

5. `TODO.md`. Delete the entry at `:65` (`station.js discover()` never walks the filesystem …) and the blank line after it. Replace the entry at `:54` with:

```markdown
- `station.js` prints a path and a counts line, so a session can read how many are stale; the rows themselves have no `--json` — [scripts/station.js](scripts/station.js).
```

6. `docs/README.md`. After the row at `:42` (the session-station plan), add:

```markdown
| Why the station forgot registries — the lead dies with the badge — and where the page is written now: at `/fankeel`, at every verb, beside the user | [plans/2026-09-05-station-at-hand-design.md](plans/2026-09-05-station-at-hand-design.md) |
| The six tasks that made the station remember, scan, write twice and say so | [plans/2026-09-05-station-at-hand.md](plans/2026-09-05-station-at-hand.md) |
```

7. Check:

```
node scripts/todo-check.js; echo exit $?
node scripts/docs-check.js 2>&1 | tail -5; echo exit $?
npm test 2>&1 | grep -E "^ℹ (pass|fail)"
```

Expected: `exit 0`, `exit 0`, `ℹ fail 0`. `docs-check` reports a `roots.json` or `station.html` symbol only if a page names one nothing declares — both are paths, not symbols.

8. Commit: `docs: the station is written at /fankeel, at every verb, beside the user`.
