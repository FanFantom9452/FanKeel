---
status: current
---

# Chartroom board on the session card Implementation Plan

**Goal:** a task's `*.board` files in its build directory are drawn server-side as SVG and shown as thumbnails on that session's card in the station.
**Architecture:** Chartroom's render subset (core 3 files, geometry 7 files, ESM, no dependencies) is copied verbatim into `lib/chartroom/` under its own `{"type":"module"}`; `lib/board.js` (CJS) lists a directory's boards, resolves one name safely and renders it through a once-loaded dynamic `import()`. `lib/station.js` gives each session `boards[]`, `scripts/station.js` serves `GET /station/board/<sessionId>/<name>.svg` without the nonce, and `assets/station/station.js` draws the approved `AI 畫的圖` block as `<img>` thumbnails.
**Tech Stack:** Node `>=22.5` (`package.json:8`; the local machine runs v24.21.0, so the 22.5 path is reasoned, not run), `node:test` + `node:assert/strict`, no dependencies; Chartroom source `F:/ymlab/_ext/chartroom` at commit `47506de1108a904de3184b8dc007f2034e2af892`.
**Spec:** [2026-10-20-chartroom-board-design.md](2026-10-20-chartroom-board-design.md)

## Global Constraints

From `node scripts/map.js` (`.fankeel/map.md`), `package.json`, `CONTRIBUTING.md`, `README.md` and the tests. The repository has no `CLAUDE.md`; `README.md` is the map's signpost.

- `package.json:8` — `"engines": { "node": ">=22.5" }`. Do not raise it; no `require(esm)` (design §2).
- `package.json` has no `dependencies`; `CONTRIBUTING.md:36` — "no new dependency". The vendored copy is source, not a package.
- `package.json` — the suite is `node --test --test-timeout=300000 --test-force-exit --require ./tests/subprocess-timeout.js`; an implementer runs only `node --test tests/<own>.test.js`.
- `README.md:218` — "`lib/` the logic, as functions tested directly; nothing here reaches into scripts/ or hooks/". `lib/board.js` requires nothing from `scripts/`.
- `lib/` and `scripts/` are CommonJS with `'use strict';` and 4-space indentation (`lib/station.js:17-30`, `scripts/station.js:31-54`). The vendored `lib/chartroom/**` is ESM and stays byte-identical to its source.
- `.fankeel/map.md` filing: plans in `docs/90-agent/plans` (role plan), reference in `docs/90-agent/reference`, todo in `docs/90-agent/todo`, skills are reference.
- `knip.json` — entries are `hooks/*.js`, `scripts/*.js`, `tests/**/*.test.js`, `"exclude": ["exports"]`: `lib/board.js` imports the vendored files with literal specifiers so they stay reachable; unused vendored exports are not a finding.
- Every test that needs a scratch directory takes it from `tests/tmp.js` (`tmp(prefix)`), which removes it at exit.
- `tests/station-i18n.test.js:45-53` — each `loc()` key in `assets/station/station.js` carries its section's prefix; code between `// ---- the completion record` (`:3848`) and `// ---- 儀表板 (\`#/\`), again` (`:3897`) is prefix `rec`. Every key needs an English entry in `assets/station/i18n.js`, every English entry is used, no English value holds CJK.
- `tests/station-i18n.test.js:30-39` — every CJK string literal in `assets/station/station.js` is the Chinese argument of a `loc('key', '…'` on the same line.
- `tests/design-skill.test.js:13-17` — `skills/fankeel-design/SKILL.md` must not contain `方向` or `逐塊`, and must contain `tune`.
- `lib/plantasks.js:353-354` — `READ_CAP = 1500`, `FILE_CAP = 3`: `assets/station/station.js` (6856 lines), `assets/station/station.css` (2543) and the long station files are named by range below.
- Commit subjects are `type: lowercase summary` (`feat:`, `fix:`, `test:`, `docs:`, `chore:` in `git log`).
- Profile `dispatch.floor` is `sonnet`; this task is `architectural`, so `dispatchFor` (`lib/profile.js:294-298`) raises every implementer to `opus` at effort `high`.

## Risks

- A vendored file imports something outside the ten copied (e.g. `geometry/index.js`, `snap.js`, `core/index.js`) — Task 1 — checked at plan time: the ten import only each other; Task 1's step 3 greps every `import` after the copy and fails the step if any specifier names a file not copied.
- Dynamic `import()` of ESM from CJS on Node 22.5 behaves differently from the v24 this machine runs — Task 1 — `import()` from CJS is unflagged since Node 12; the test runs on whatever `node` is installed, and verify notes 22.5 as reasoned, not run.
- `ParseError` thrown inside the ESM realm is the same realm (one process), but the route checks `e.name === 'ParseError'` rather than `instanceof` so no import of the class is needed in `scripts/station.js` — Task 2.
- `gather()` now does one `readdirSync` per session per request (149 sessions on this machine) — Task 2 — a missing directory throws `ENOENT` fast and is caught; Task 2 does not add any read of file contents to `gather()`.
- `../x.svg` in a request is normalised away by `new URL()` (`scripts/station.js:393`) before routing, so it reaches the final `fail(404, 'not here')` rather than the board route; `..%2Fx` reaches the route and fails the name rule — Task 2 tests both.
- An SVG opened as a top-level tab can run script, unlike one in `<img>` — Task 2 sends `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'` on the route.
- A static (`file://`) copy of the station has no board route, so a thumbnail there would be a broken image — Task 3 draws the block only when served.

## Task 1: Vendored render code and lib/board.js

**Files:**
- Modify: `lib/chartroom/` — new: `core/{format,fields,util}.js`, `geometry/{measure,layout,route,lanes,shapes,scene,svg}.js` copied verbatim, `package.json` and `README.md` written by heredoc
- Modify: `lib/board.js` — new: `NAME`, `listBoards`, `boardFile`, `renderBoard`
- Read: `F:/ymlab/_ext/chartroom/bin/chartroom.js` — the render recipe at :211-218 (`parse` → `scene(doc, viewId, approxMeasure)` → `toSVG`)
- Test: `tests/board.test.js`
- Test: `tests/fixtures/levelmark.board` — copy of `F:/ymlab/_ext/chartroom/examples/levelmark.board`

**Interfaces:**
- Consumes: none
- Produces: `require('./board.js')` / `require('../lib/board.js')` exporting
  - `NAME` — `RegExp` `/^[0-9A-Za-z._-]+$/`, the rule a board name (file name without `.board`) must pass
  - `listBoards(dir: string|null) → Array<{ name: string, updated: number }>` — `*.board` files directly in `dir` whose name passes `NAME`, sorted by name, `updated` = `Math.round(mtimeMs)`; `[]` for `null` or a missing directory
  - `boardFile(dir: string|null, name: string) → string|null` — absolute path of `<dir>/<name>.board` when `name` passes `NAME`, the file sits directly in `dir` and is a file; else `null`
  - `async renderBoard(text: string) → string` — the SVG of the board's root view; rejects with the vendored `ParseError` (`err.name === 'ParseError'`) on malformed text
  - `tests/fixtures/levelmark.board` — 20 lines; root view `系統總覽` holds 7 node records (2 of them `shape:"frame"`) and 4 edge records

**Dispatch:** implementer, opus, high — the architectural floor.

1. Copy the render subset and the fixture:

```sh
SRC=F:/ymlab/_ext/chartroom
mkdir -p lib/chartroom/core lib/chartroom/geometry tests/fixtures
cp $SRC/src/core/format.js $SRC/src/core/fields.js $SRC/src/core/util.js lib/chartroom/core/
cp $SRC/src/geometry/measure.js $SRC/src/geometry/layout.js $SRC/src/geometry/route.js $SRC/src/geometry/lanes.js $SRC/src/geometry/shapes.js $SRC/src/geometry/scene.js $SRC/src/geometry/svg.js lib/chartroom/geometry/
cp $SRC/examples/levelmark.board tests/fixtures/levelmark.board
git -C $SRC rev-parse HEAD
```

   The last line must print `47506de1108a904de3184b8dc007f2034e2af892`; if it prints another commit, put that one in the README below instead.

2. Write the package marker and the README:

```sh
printf '{"type":"module"}\n' > lib/chartroom/package.json
cat > lib/chartroom/README.md <<'EOF'
# lib/chartroom — vendored

Copied verbatim from Chartroom (`F:/ymlab/_ext/chartroom`), commit
`47506de1108a904de3184b8dc007f2034e2af892`: `src/core/{format,fields,util}.js`
and `src/geometry/{measure,layout,route,lanes,shapes,scene,svg}.js` — the
render subset, 1768 lines. ESM under this directory's `{"type":"module"}`;
`lib/board.js` loads it with dynamic `import()`. `src/server/` is not copied.

Do not edit these files: re-copy from the source repository and update the
commit above. Design: docs/90-agent/plans/2026-10-20-chartroom-board-design.md.
EOF
```

3. Check the copy is closed under its own imports and exact:

```sh
grep -hn "from '" lib/chartroom/core/*.js lib/chartroom/geometry/*.js | grep -v "from '\./\(format\|fields\|util\|measure\|layout\|route\|lanes\|shapes\|scene\|svg\)\.js'\|from '\.\./core/\(format\|fields\)\.js'" ; echo "exit=$?"
wc -l lib/chartroom/core/*.js lib/chartroom/geometry/*.js | tail -1
for f in core/format core/fields core/util geometry/measure geometry/layout geometry/route geometry/lanes geometry/shapes geometry/scene geometry/svg; do cmp lib/chartroom/$f.js F:/ymlab/_ext/chartroom/src/$f.js || echo "DIFF $f"; done
```

   Expect no import lines printed (`exit=1`), `1768 total`, and no `DIFF`.

4. Write the failing test. In `tests/board.test.js`:

```js
'use strict';
// lib/board.js: a task's .board files, listed and drawn to SVG by the
// Chartroom render code vendored in lib/chartroom/
// (docs/90-agent/plans/2026-10-20-chartroom-board-design.md §1-§2).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const board = require('../lib/board.js');
const tmp = require('./tmp.js');

const FIXTURE = fs.readFileSync(path.join(__dirname, 'fixtures', 'levelmark.board'), 'utf8');
const recs = (text) => text.split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l));
const count = (svg, type) => (svg.match(new RegExp('data-type="' + type + '"', 'g')) || []).length;
const line = (o) => JSON.stringify(o) + '\n';

test('renderBoard draws one group per node record and one per edge record of the root view', async () => {
    const all = recs(FIXTURE);
    const root = all[0].root;
    const nodes = all.filter((r) => r.node && r.in === root).length;
    const edges = all.filter((r) => r.edge && r.in === root).length;
    assert.deepEqual([nodes, edges], [7, 4], 'the fixture is levelmark.board as copied');
    const svg = await board.renderBoard(FIXTURE);
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.equal(count(svg, 'node') + count(svg, 'frame'), nodes);
    assert.equal(count(svg, 'edge'), edges);
});

test('a board with no coordinates lays out with no two node boxes overlapping', async () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const text = line({ chartroom: 1, title: 't', root: 'v' }) + line({ view: 'v', title: 'v' })
        + ids.map((id) => line({ node: id, in: 'v', label: id + '\n第二行' })).join('')
        + [['a', 'b'], ['a', 'c'], ['b', 'd'], ['c', 'e']].map(([from, to], i) => line({ edge: 'e' + i, in: 'v', from, to })).join('');
    const svg = await board.renderBoard(text);
    const boxes = [...svg.matchAll(/data-type="node"><rect [^>]*?\bx="(-?[\d.]+)" y="(-?[\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)]
        .map((m) => m.slice(1).map(Number));
    assert.equal(boxes.length, ids.length);
    for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
            const [ax, ay, aw, ah] = boxes[i];
            const [bx, by, bw, bh] = boxes[j];
            assert.ok(!(ax < bx + bw && bx < ax + aw && ay < by + bh && by < ay + ah), ids[i] + ' overlaps ' + ids[j]);
        }
    }
});

test('malformed text rejects with ParseError', async () => {
    await assert.rejects(board.renderBoard('not json\n'), { name: 'ParseError' });
});

test('listBoards lists *.board directly in the directory, by name, and [] where there is none', () => {
    const dir = tmp('fankeel-board-');
    for (const f of ['b.board', 'a.board', 'bad name.board']) fs.writeFileSync(path.join(dir, f), FIXTURE);
    fs.writeFileSync(path.join(dir, 'notes.md'), 'x');
    fs.mkdirSync(path.join(dir, 'sub'));
    fs.writeFileSync(path.join(dir, 'sub', 'c.board'), FIXTURE);
    const got = board.listBoards(dir);
    assert.deepEqual(got.map((b) => b.name), ['a', 'b']);
    assert.ok(got.every((b) => Number.isInteger(b.updated) && b.updated > 0));
    assert.deepEqual(board.listBoards(path.join(dir, 'missing')), []);
    assert.deepEqual(board.listBoards(null), []);
});

test('boardFile resolves a name inside the directory, and null for anything else', () => {
    const dir = tmp('fankeel-board-');
    fs.writeFileSync(path.join(dir, 'a.board'), FIXTURE);
    fs.mkdirSync(path.join(dir, 'sub'));
    fs.writeFileSync(path.join(dir, 'sub', 'c.board'), FIXTURE);
    assert.equal(board.boardFile(dir, 'a'), path.join(path.resolve(dir), 'a.board'));
    for (const bad of ['../a', 'sub/c', 'sub\\c', 'missing', '', 'a b', '..', '%2e%2e']) {
        assert.equal(board.boardFile(dir, bad), null, JSON.stringify(bad));
    }
    assert.equal(board.boardFile(null, 'a'), null);
});
```

5. Run it and watch it fail (`Cannot find module '../lib/board.js'`):

```
node --test tests/board.test.js
```

6. Write the implementation. In `lib/board.js`:

```js
'use strict';
// A task's Chartroom boards: the `*.board` files directly in its build
// directory (`handoff.dirFor`, lib/handoff.js), listed for the station's
// session card and drawn to SVG by the render code vendored under
// lib/chartroom/ — ESM, loaded once with dynamic import(), which needs no
// flag on the Node 22.5 floor (docs/90-agent/plans/2026-10-20-chartroom-board-design.md §2).
const fs = require('node:fs');
const path = require('node:path');

// What a board's name — its file name without `.board` — may be: the
// station's route takes it from a URL, and this is what keeps it a name.
const NAME = /^[0-9A-Za-z._-]+$/;
const EXT = '.board';

function listBoards(dir) {
    if (!dir) return [];
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
        return [];
    }
    const out = [];
    for (const d of entries) {
        if (!d.isFile() || !d.name.endsWith(EXT)) continue;
        const name = d.name.slice(0, -EXT.length);
        if (!NAME.test(name)) continue;
        let st;
        try {
            st = fs.statSync(path.join(dir, d.name));
        } catch (e) {
            continue;
        }
        out.push({ name, updated: Math.round(st.mtimeMs) });
    }
    return out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

// The file a name stands for, or null: the name must pass NAME and the
// file must sit directly in `dir`, so no request reaches outside it.
function boardFile(dir, name) {
    if (!dir || typeof name !== 'string' || !NAME.test(name)) return null;
    const base = path.resolve(dir);
    const file = path.resolve(base, name + EXT);
    if (path.dirname(file) !== base) return null;
    try {
        return fs.statSync(file).isFile() ? file : null;
    } catch (e) {
        return null;
    }
}

let loading = null;
function load() {
    if (!loading) {
        loading = Promise.all([
            import('./chartroom/core/format.js'),
            import('./chartroom/geometry/measure.js'),
            import('./chartroom/geometry/scene.js'),
            import('./chartroom/geometry/svg.js'),
        ]).then(([format, measure, built, svg]) => ({
            parse: format.parse, rootOf: format.rootOf, approxMeasure: measure.approxMeasure, scene: built.scene, toSVG: svg.toSVG,
        }), (e) => {
            loading = null;
            throw e;
        });
    }
    return loading;
}

// bin/chartroom.js:211-218's recipe, on the board's root view. A malformed
// board rejects with Chartroom's ParseError.
async function renderBoard(text) {
    const m = await load();
    const doc = m.parse(String(text));
    return m.toSVG(m.scene(doc, m.rootOf(doc), m.approxMeasure));
}

module.exports = { NAME, listBoards, boardFile, renderBoard };
```

7. Run it and watch it pass:

```
node --test tests/board.test.js
```

8. Commit: `feat: vendor chartroom render code and draw a .board as svg`.

## Task 2: Session boards[] and the board route

**Files:**
- Modify: `lib/station.js:486-830` — `boardDir` and `boards` on each gathered session (:490); `boards` on each serialised session (:810); plus one `require('./board.js')` line beside `handoff` at :28
- Modify: `scripts/station.js:540-570` — the `GET /station/board/<sessionId>/<name>.svg` branch after the shot branch (:546-566); plus one `require('../lib/board.js')` line beside `handoff` at :45
- Modify: `docs/90-agent/reference/station.md:620-1109` — the route documented after the shot paragraph (:626-630); one superseded line above the `/chartroom/` section (:1078)
- Read: `lib/board.js` — `listBoards`, `boardFile`, `renderBoard`
- Read: `lib/handoff.js` — `dirFor(root, data)` at :44
- Read: `tests/fixtures/levelmark.board` — the board the test serves
- Read: `tests/station-detail.test.js` — the fixture and `serve({ port: 0 })` pattern this test copies (:23-41, :98-130)
- Test: `tests/station-board.test.js`

**Interfaces:**
- Consumes: from Task 1, `listBoards(dir) → [{ name, updated }]`, `boardFile(dir, name) → string|null`, `async renderBoard(text) → string` (rejects with `err.name === 'ParseError'`)
- Produces: each element of `window.STATION.sessions` carries `boards: Array<{ name: string, updated: number }>` (`[]` when none); each gathered session (`gather().registries[i].sessions[j]`) carries `boardDir: string|null` and `boards`; `GET /station/board/<sessionId>/<name>.svg` → 200 as image/svg+xml with the header content-security-policy: default-src 'none'; style-src 'unsafe-inline' and cache-control: no-store, 422 as plain text with the parser's message, 404 otherwise

**Dispatch:** implementer, opus, high — the architectural floor.

1. Write the failing test. In `tests/station-board.test.js`:

```js
'use strict';
// A task's boards on the station: each session serialises the *.board files
// in its build directory as boards[], and serve draws one at
// GET /station/board/<sessionId>/<name>.svg without the nonce
// (docs/90-agent/plans/2026-10-20-chartroom-board-design.md §3, §4, §6).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const registry = require('../lib/registry.js');
const station = require('../lib/station.js');
const tmp = require('./tmp.js');

const SID = 'aaaaaaaa-1111-4111-8111-111111111111';
const BARE = 'bbbbbbbb-2222-4222-8222-222222222222';
const NONE = 'cccccccc-3333-4333-8333-333333333333';
const T = (s) => '2026-09-11T10:00:' + String(s).padStart(2, '0') + '.000Z';
const BOARD = fs.readFileSync(path.join(__dirname, 'fixtures', 'levelmark.board'), 'utf8');
const plain = (v) => JSON.parse(JSON.stringify(v));

// SID started at T(0), so its build directory is task-20260911T100000 and
// holds a.board and broken.board; BARE started at T(5) and has none.
function fixture() {
    const base = tmp('fankeel-station-board-');
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(r1);
    const common = { stage: 'build', route: ['build'], active: false, claims: [], updated: T(9), configDir: cfg, ended: { at: T(9), reason: 'exit' } };
    registry.writeSession(r1, SID, Object.assign({ task: 'with a board', started: T(0) }, common));
    registry.writeSession(r1, BARE, Object.assign({ task: 'without one', started: T(5) }, common));
    const dir = path.join(r1, '.fankeel', 'build', 'task-20260911T100000');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'a.board'), BOARD);
    fs.writeFileSync(path.join(dir, 'broken.board'), 'not json\n');
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'), JSON.stringify({ [path.resolve(r1)]: T(0) }) + '\n');
    return { cfg, r1 };
}

const get = (url) => new Promise((resolve, reject) => {
    http.get(url, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], csp: res.headers['content-security-policy'], text }));
    }).on('error', reject);
});

test('each session serialises the boards in its build directory, by name, and [] where it has none', () => {
    const f = fixture();
    const win = {};
    vm.runInNewContext(station.serialize(station.gather({ configDir: f.cfg, details: false })), { window: win });
    const by = Object.fromEntries(win.STATION.sessions.map((s) => [s.id, plain(s.boards)]));
    assert.deepEqual(by[SID].map((b) => b.name), ['a', 'broken']);
    assert.ok(by[SID].every((b) => Number.isInteger(b.updated) && b.updated > 0));
    assert.deepEqual(by[BARE], []);
});

test('serve draws a board as image/svg+xml without the nonce, 422 for a malformed one, 404 for anything else', async () => {
    const f = fixture();
    const { serve } = require('../scripts/station.js');
    const s = await serve({ configDir: f.cfg, roots: [f.r1], port: 0, idleMs: 60e3, open: false });
    try {
        const ok = await get(s.url + 'station/board/' + SID + '/a.svg');
        assert.equal(ok.status, 200);
        assert.equal(ok.type, 'image/svg+xml');
        assert.match(ok.text, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
        assert.match(ok.csp, /default-src 'none'/);
        const broken = await get(s.url + 'station/board/' + SID + '/broken.svg');
        assert.equal(broken.status, 422);
        assert.match(broken.text, /JSON/);
        for (const bad of ['/../x.svg', '/..%2Fx.svg', '/missing.svg', '/a.board.svg']) {
            assert.equal((await get(s.url + 'station/board/' + SID + bad)).status, 404, bad);
        }
        assert.equal((await get(s.url + 'station/board/' + NONE + '/a.svg')).status, 404, 'an unknown session');
        assert.equal((await get(s.url + 'station/board/' + BARE + '/a.svg')).status, 404, 'another session\'s board');
    } finally {
        s.close();
    }
});

test('station.md documents the board route and marks the /chartroom/ section superseded for task diagrams', () => {
    const md = fs.readFileSync(path.join(__dirname, '..', 'docs', '90-agent', 'reference', 'station.md'), 'utf8');
    assert.match(md, /`GET \/station\/board\/<sessionId>\/<name>\.svg`/);
    assert.match(md, /Superseded for task diagrams by \[2026-10-20-chartroom-board-design\.md\]\(\.\.\/plans\/2026-10-20-chartroom-board-design\.md\)/);
});
```

2. Run it and watch it fail (`boards` is `undefined`; the route answers `404 not here`):

```
node --test tests/station-board.test.js
```

3. In `lib/station.js`, after `const handoff = require('./handoff.js');` (:28), add:

```js
const board = require('./board.js');
```

4. In `lib/station.js`, in `gather()`'s `sessions.push({` (:489), directly after the `sessionId,` line, add:

```js
                // The task's Chartroom boards, `*.board` in its build
                // directory (lib/board.js); the board route reads `boardDir`.
                boardDir: handoff.dirFor(root, data),
                boards: board.listBoards(handoff.dirFor(root, data)),
```

5. In `lib/station.js`, in `serialize()`'s `sessions:` map, directly after the line `pending: s.pending || null,` (:810), add:

```js
            boards: Array.isArray(s.boards) ? s.boards : [],
```

6. In `scripts/station.js`, after `const handoff = require('../lib/handoff.js');` (:45), add:

```js
const board = require('../lib/board.js');
```

7. In `scripts/station.js`, directly after the closing `}` of the `if (req.method === 'GET' && shotOf) {` branch (:566) and before the `/station/health` branch (:567), add:

```js
        const boardOf = /^\/station\/board\/([0-9A-Za-z-]+)\/([^/]+)\.svg$/.exec(url.pathname);
        if (req.method === 'GET' && boardOf) {
            // A task's .board drawn to SVG for its session card (lib/board.js).
            // No nonce, like the shot above: a GET that writes nothing. The
            // name has to pass board.NAME and resolve directly inside that
            // session's own build directory; a board that does not parse is
            // 422 with the parser's message. The CSP is for the full SVG opened
            // in its own tab, where an SVG could otherwise run script.
            const hit = modelNow({ details: false }).registries.flatMap((r) => r.sessions).find((x) => x.sessionId === boardOf[1]);
            const file = hit ? board.boardFile(hit.boardDir, boardOf[2]) : null;
            if (!file) return fail(404, 'no such board for that session');
            let text;
            try {
                text = fs.readFileSync(file, 'utf8');
            } catch (e) {
                return fail(404, 'no such board for that session');
            }
            let svg;
            try {
                svg = await board.renderBoard(text);
            } catch (e) {
                return e && e.name === 'ParseError' ? fail(422, e.message) : fail(500, 'cannot draw that board: ' + (e && e.message));
            }
            return send(200, 'image/svg+xml', svg, Object.assign({ 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'" }, noStore));
        }
```

8. In `docs/90-agent/reference/station.md`, after the paragraph ending `cannot be on a served page.` (:630), add:

```md
`GET /station/board/<sessionId>/<name>.svg` draws a task's Chartroom board —
`<name>.board` directly in that session's build directory,
`.fankeel/build/task-<started>/` (`handoff.dirFor`) — to SVG with the render
code vendored in `lib/chartroom/` (`lib/board.js`), for the session card's
`AI 畫的圖` block; each session in `station-data.js` lists its boards as
`boards: [{ name, updated }]`. Like the screenshot it skips the nonce: it is a
GET that writes nothing. `<name>` must match `^[0-9A-Za-z._-]+$` and resolve
inside that directory, or the answer is 404; a board that does not parse is
422 with the parser's message. The SVG goes out with
`Content-Security-Policy: default-src 'none'`, so one opened in its own tab
runs no script.
```

9. In `docs/90-agent/reference/station.md`, directly above the paragraph that opens `Under \`/chartroom/<name>/\` the served station hands a request to` (:1078), add:

```md
Superseded for task diagrams by [2026-10-20-chartroom-board-design.md](../plans/2026-10-20-chartroom-board-design.md):
a task's architecture, flow or dependency diagram is a `.board` in its build
directory, drawn by `GET /station/board/<sessionId>/<name>.svg` above. This
route stays for the per-project `.fankeel/architecture.board`.
```

10. Run it and watch it pass, then check the new link resolves:

```
node --test tests/station-board.test.js
node scripts/docs-check.js
```

11. Commit: `feat: station serves a task's boards as svg`.

## Task 3: The AI 畫的圖 block on the session card

**Files:**
- Modify: `assets/station/station.js:3848-3953` — `boardsHtml(s, served)` after `recordPageHtml` (:3885-3889), exported; called after `recordPageHtml(s)` in the session page (:3952)
- Modify: `assets/station/station.css:2525-2543` — the mockup's `.boards` / `.bd-*` rules after `.recp-none` (:2539)
- Modify: `assets/station/i18n.js:885-900` — six `rec.board*` English entries after `'rec.noneYet'` (:899)
- Read: `.fankeel/build/2026-10-20-chartroom-board/mockup.html` — the approved `data-block="boards"` markup and its `/* new: the boards block` CSS
- Read: `tests/station-gate-route.test.js` — the `boot(hash)` pattern (:20-41) this test copies
- Read: `tests/station-i18n.test.js` — the key-prefix and CJK-literal rules (:30-53)
- Test: `tests/station-boards-card.test.js`

**Interfaces:**
- Consumes: from Task 2, each `window.STATION.sessions[i]` carries `boards: Array<{ name: string, updated: number }>` and the served route `station/board/<sessionId>/<name>.svg`; neither is needed to build or test this task (the test supplies `boards` itself)
- Produces: `boardsHtml(s: { id, started, boards }, served: boolean) → string` on `module.exports` of `assets/station/station.js`; `''` when not served or `boards` is empty; else `<section class="panel boards" data-block="boards">` with one `<img>` per board

**Dispatch:** implementer, opus, high — the architectural floor.

1. Write the failing test. In `tests/station-boards-card.test.js`:

```js
'use strict';
// The session card's AI 畫的圖 block (docs/90-agent/plans/2026-10-20-chartroom-board-design.md §5;
// mockup .fankeel/build/2026-10-20-chartroom-board/mockup.html, data-block="boards"):
// one <img> thumbnail per board, opening the full SVG in a new tab; no board, no block.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

global.window = { STATION: { serve: false, pricesVerified: '2026-09-04' } };
const V = require('../assets/station/station.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
const CSS = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.css'), 'utf8');
const NOW = Date.parse('2026-10-18T12:00:00.000Z');
const PK = 'F:\\ws\\alpha';
const BOARDS = [{ name: 'levelmark', updated: 11 }, { name: 'levelmark-runtime', updated: 22 }];
const S = { id: 's1', started: '2026-09-11T10:00:00.000Z', boards: BOARDS };
const imgs = (html) => [...html.matchAll(/<img src="([^"]+)"/g)].map((m) => m[1]);

// station.js booted on `hash`, served, with one session holding `boards`;
// returns the page's HTML. fetch never answers, so no poll lands mid-test.
function boot(hash, boards) {
    const els = {};
    const el = (tag) => ({ tagName: String(tag || 'div').toUpperCase(), innerHTML: '', textContent: '', className: '', title: '',
        placeholder: '', attrs: {}, style: {}, hidden: false, parentNode: null,
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {}, focus() {} });
    els.page = el('div');
    const win = { location: { hash }, addEventListener() {}, scrollTo() {}, STATION_DETAIL: {},
        setInterval: () => 1, setTimeout: () => 1, clearTimeout() {}, clearInterval() {},
        navigator: { language: 'zh-TW' }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-24', serve: true, nonce: 'N0NCE',
            projects: [{ root: PK, gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {},
            sessions: [{ id: 's1', pkey: PK, root: PK, task: 't-s1', state: 'down', route: ['survey', 'build'], stage: 'build', hasDetail: false,
                stages: [], notes: [], claims: [], conflicts: [], burn: 0, backtracks: 0, updated: NOW - 1000, started: '2026-09-11T10:00:00.000Z', days: [], boards }] } };
    const doc = { hidden: false, documentElement: el('html'), body: el('body'), title: '', head: { appendChild() {} },
        getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener() {}, createElement: el, querySelectorAll: () => [], querySelector: () => null };
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: () => new Promise(() => {}), module: { exports: {} } });
    return els.page.innerHTML;
}

test('boardsHtml draws one <img> per board, each opening its SVG in a new tab, and the build directory under them', () => {
    const html = V.boardsHtml(S, true);
    assert.match(html, /^<section class="panel boards" data-block="boards" aria-labelledby="boards-h">/);
    assert.deepEqual(imgs(html), ['station/board/s1/levelmark.svg?v=11', 'station/board/s1/levelmark-runtime.svg?v=22']);
    assert.equal((html.match(/<a class="bd" href="station\/board\/s1\/[^"]+" target="_blank" rel="noopener"/g) || []).length, 2);
    assert.match(html, /AI 畫的圖<small>2 張・點一下在新分頁開完整的圖<\/small>/);
    assert.match(html, /<span class="bd-nm"><b>levelmark<\/b>\.board<\/span>/);
    assert.match(html, /<p class="bd-src">檔案在 <span class="mono">\.fankeel\/build\/task-20260911T100000\/<\/span><\/p>/);
    assert.equal((html.match(/<svg/g) || []).length, 1, 'only the heading icon is inline SVG; the boards are <img>');
});

test('no board, no block; and a static copy, which has no route to draw one, draws none', () => {
    assert.equal(V.boardsHtml(Object.assign({}, S, { boards: [] }), true), '');
    assert.equal(V.boardsHtml({ id: 's1' }, true), '');
    assert.equal(V.boardsHtml(S, false), '');
});

test('a board name is escaped where it is drawn', () => {
    const html = V.boardsHtml({ id: 's1', started: S.started, boards: [{ name: 'x"><script>', updated: 1 }] }, true);
    assert.doesNotMatch(html, /<script>/);
});

test('the served session page shows one <img> per entry of boards[], after the record and before the tabs', () => {
    const html = boot('#/s/s1', BOARDS);
    const block = /<section class="panel boards" data-block="boards"[\s\S]*?<\/section>/.exec(html);
    assert.ok(block, 'the block is on the page');
    assert.equal(imgs(block[0]).length, BOARDS.length);
    assert.ok(html.indexOf('data-block="boards"') < html.indexOf('data-block="session-tabs"'));
    assert.doesNotMatch(boot('#/s/s1', []), /data-block="boards"/);
});

test('station.css carries the mockup\'s boards block', () => {
    for (const rule of ['.boards{', '.bd-grid{', '.bd{', '.bd-th img{', '.bd-ft{', '.bd-nm{', '.bd-go{', '.bd-src{']) {
        assert.ok(CSS.includes(rule), rule);
    }
});
```

2. Run it and watch it fail (`V.boardsHtml is not a function`):

```
node --test tests/station-boards-card.test.js
```

3. In `assets/station/station.js`, directly after the closing `}` of `function recordPageHtml(s)` (:3889), add:

```js
    // A task's Chartroom boards (lib/board.js), drawn by the served station at
    // GET /station/board/<id>/<name>.svg — the mockup's data-block="boards".
    // An <img>, never inline SVG: the labels are an agent's, and an SVG in an
    // <img> runs no script. A static copy has no route to draw them, so it
    // shows no block; `?v=` is the file's mtime, so a redrawn board reloads.
    function boardsHtml(s, served) {
        var list = s && Array.isArray(s.boards) ? s.boards : [];
        if (!served || !list.length) return '';
        var id = encodeURIComponent(String(s.id));
        var at = String(s.started || '').replace(/[-:]/g, '').slice(0, 15);
        var icon = '<svg class="ico" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
            + '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>';
        return '<section class="panel boards" data-block="boards" aria-labelledby="boards-h"><div class="h2" id="boards-h">' + icon
            + loc('rec.boards', 'AI 畫的圖') + '<small>' + loc('rec.boardsHint', '{n} 張・點一下在新分頁開完整的圖', { n: list.length }) + '</small></div>'
            + '<ul class="bd-grid">' + list.map(function (b) {
                var src = 'station/board/' + id + '/' + encodeURIComponent(String(b.name)) + '.svg?v=' + encodeURIComponent(String(b.updated));
                return '<li><a class="bd" href="' + esc(src) + '" target="_blank" rel="noopener" title="' + esc(loc('rec.boardOpen', '{f}，在新分頁開完整的圖', { f: b.name + '.board' })) + '">'
                    + '<span class="bd-th"><img src="' + esc(src) + '" alt="' + esc(loc('rec.boardAlt', '{f} 的縮圖', { f: b.name })) + '" loading="lazy" decoding="async"></span>'
                    + '<span class="bd-ft"><span class="bd-nm"><b>' + esc(b.name) + '</b>.board</span><span class="bd-go">' + loc('rec.boardGo', '開新分頁') + '</span></span></a></li>';
            }).join('') + '</ul>'
            + (/^\d{8}T\d{6}$/.test(at) ? '<p class="bd-src">' + loc('rec.boardsIn', '檔案在 {d}', { d: '<span class="mono">' + esc('.fankeel/build/task-' + at + '/') + '</span>' }) + '</p>' : '')
            + '</section>';
    }
    if (typeof module !== 'undefined' && module.exports) module.exports.boardsHtml = boardsHtml;
```

4. In `assets/station/station.js`, in the session page's return (:3952), change `+ sessionHeadHtml(s, x) + '</section>' + recordPageHtml(s)` to:

```js
            + sessionHeadHtml(s, x) + '</section>' + recordPageHtml(s) + boardsHtml(s, Boolean(S.serve))
```

5. In `assets/station/station.css`, directly after the `.recp-none{…}` rule (:2539), add the mockup's block verbatim:

```css
/* the session card's boards block (AI 畫的圖) — mockup data-block="boards" */
.boards{padding-top:18px;padding-bottom:16px}
.boards .h2{margin:0 0 12px;font-weight:600}
/* the narrow fallback is in the track: min(220px,100%) folds to one column */
.bd-grid{list-style:none;margin:0;padding:0;display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(min(220px,100%),1fr))}
.bd{display:flex;flex-direction:column;min-height:44px;text-decoration:none;color:var(--fg);border:1px solid var(--line);border-radius:var(--r-sm);overflow:hidden;background:var(--soft);transition:border-color .16s ease-out}
.bd:hover{border-color:var(--line-2)}
.bd:hover .bd-go{color:var(--fg)}
.bd:focus-visible{outline:2px solid var(--ink);outline-offset:2px;border-radius:var(--r-sm)}
.bd-th{display:flex;align-items:center;justify-content:center;aspect-ratio:16/10;padding:10px;background:var(--inset);border-bottom:1px solid var(--line)}
.bd-th img{display:block;width:auto;height:auto;max-width:100%;max-height:100%;min-width:0;min-height:0}
.bd-ft{display:flex;align-items:baseline;gap:10px;padding:9px 12px 10px;background:var(--panel)}
.bd-nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:12.5px/1.5 var(--mono);color:var(--mute)}
.bd-nm b{font-weight:600;color:var(--fg)}
.bd-go{flex:none;font-size:12px;line-height:1.5;color:var(--fg-2)}
.bd-src{margin:12px 0 0;padding-top:10px;border-top:1px solid var(--line);font-size:12px;line-height:1.5;color:var(--mute)}
.bd-src .mono{font-family:var(--mono);color:var(--fg-2)}
@media(prefers-reduced-motion:reduce){.bd{transition:none}}
```

6. In `assets/station/i18n.js`, directly after `'rec.noneYet': 'The completion record is written at land.',` (:899), add:

```js
            'rec.boards': 'Diagrams the AI drew',
            'rec.boardsHint': '{n} · click one to open the full diagram in a new tab',
            'rec.boardOpen': '{f}, opens the full diagram in a new tab',
            'rec.boardAlt': 'Thumbnail of {f}',
            'rec.boardGo': 'New tab',
            'rec.boardsIn': 'Files in {d}',
```

7. Run it and the i18n rules, and watch both pass:

```
node --test tests/station-boards-card.test.js tests/station-i18n.test.js tests/station-record.test.js
```

8. Commit: `feat: session card shows a task's boards as thumbnails`.

## Task 4: Superseded record and the design rule

**Files:**
- Modify: `docs/90-agent/todo/station-15.md` — one superseded line at the end of `## 完成紀錄`'s paragraph, before the commit list
- Modify: `skills/fankeel-design/SKILL.md:207-223` — one rule in `### 6. Present in sections`, after the paragraph ending `the boundaries need work.` (:222)
- Read: `docs/90-agent/plans/2026-10-20-chartroom-board-design.md` — §6, the two edits' wording
- Test: `tests/board-docs.test.js`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, opus, high — the architectural floor.

1. Write the failing test. In `tests/board-docs.test.js`:

```js
'use strict';
// Design §6 (docs/90-agent/plans/2026-10-20-chartroom-board-design.md): the
// station-15 completion record says task diagrams moved to the board design,
// and the design skill files a task's diagram as a .board in the build
// directory, sequence and gantt staying Mermaid.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
const LINK = '[2026-10-20-chartroom-board-design.md](../plans/2026-10-20-chartroom-board-design.md)';

test('station-15\'s completion record is marked superseded for task diagrams', () => {
    const t = read('docs/90-agent/todo/station-15.md');
    const record = t.slice(t.indexOf('## 完成紀錄'));
    assert.ok(record.includes(LINK), 'the record links the board design');
    assert.match(record, /任務的架構、流程與依賴圖改由/);
});

test('the design skill files a task diagram as a .board in the build directory, sequence and gantt as Mermaid', () => {
    const d = read('skills/fankeel-design/SKILL.md');
    assert.match(d, /\*\*A task's diagram is a `\.board`\.\*\*/);
    assert.match(d, /one record per line, no coordinates/);
    assert.match(d, /Sequence and gantt diagrams stay Mermaid\./);
    assert.doesNotMatch(d, /方向|逐塊/);
});
```

2. Run it and watch it fail:

```
node --test tests/board-docs.test.js
```

3. In `docs/90-agent/todo/station-15.md`, after the `## 完成紀錄` paragraph that ends `專案卡片也多了開啟白板的連結。` and before `- commit 94f510ec`, add one paragraph:

```md
任務的架構、流程與依賴圖改由 [2026-10-20-chartroom-board-design.md](../plans/2026-10-20-chartroom-board-design.md) 取代：寫成任務 build 目錄裡的 .board 檔，由監控站畫成 SVG 掛在 session 卡片上；這裡的 /chartroom/ 路由只留給專案自己的 architecture.board。
```

4. In `skills/fankeel-design/SKILL.md`, in `### 6. Present in sections`, after the paragraph ending `the boundaries need work.`, add:

```md
**A task's diagram is a `.board`.** An architecture, flow or dependency
diagram for a task is a Chartroom `.board` in its build directory,
`.fankeel/build/task-<started>/<name>.board` — one record per line, no
coordinates; the station lays it out and draws it on the session card.
Sequence and gantt diagrams stay Mermaid.
```

5. Run it, the skill's own test and the todo check, and watch them pass:

```
node --test tests/board-docs.test.js tests/design-skill.test.js
node scripts/todo-check.js
node scripts/docs-check.js
```

6. Commit: `docs: task diagrams are .board files the station draws`.

## Coverage

| promise | task |
|---|---|
| `lib/chartroom/core/` holds `format.js`, `fields.js`, `util.js`, copied verbatim from `F:/ymlab/_ext/chartroom/src/core/`. | Task 1 |
| `lib/chartroom/geometry/` holds `measure`, `layout`, `route`, `lanes`, `shapes`, `scene`, `svg` (`.js`), copied verbatim from `src/geometry/` — 1768 lines in all. | Task 1 |
| `lib/chartroom/package.json` is `{"type":"module"}`, so the copies stay ESM and unchanged. | Task 1 |
| `lib/chartroom/README.md` names the source repository and the commit copied. | Task 1 |
| `src/server/` is not copied: step 1 never edits a board, and `store.js`'s `Atomics.wait` stall (judgement :176) never enters fankeel. | Task 1 |
| `lib/board.js` (CJS) exports `async renderBoard(text)`, which loads the ESM modules with dynamic `import()` once and runs `parse(text)` → `scene(doc, rootOf(doc), approxMeasure)` → `toSVG(built)` | Task 1 |
| Dynamic `import()` from CJS works on Node 22.5 without a flag, so the floor stays `>=22.5`; `require(esm)` is not used. | Task 1 |
| A `ParseError` comes back as a thrown error; the route turns it into a 422 with the message as text. | Task 1 (rejects), Task 2 (422) |
| A task's boards are `*.board` directly in its build directory, `handoff.dirFor(root, data)` (`lib/handoff.js:44`) — `.fankeel/build/task-<started>/`. They are archived with that directory. | Task 1 (`listBoards`), Task 2 (`boardDir`) |
| The per-project `.fankeel/architecture.board` and the `/chartroom/<name>/` route stay as they are (judgement :224, :239). | Task 2 — not touched; station.md says the route stays |
| Each session in `serialize()` (`lib/station.js:780`) gains `boards: [{ name, updated }]`, `name` without `.board`, sorted by name; `[]` when the directory has none. | Task 2 |
| `scripts/station.js` serves `GET /station/board/<sessionId>/<name>.svg`, `Content-Type: image/svg+xml`, beside `/station/shot/<id>.png` (:546) and, like it, without the nonce. | Task 2 |
| `<name>` must match `^[0-9A-Za-z._-]+$` and resolve inside that session's build directory; anything else is a 404. | Task 1 (`boardFile`), Task 2 (404) |
| The session card shows an `AI 畫的圖` block listing each board by name with its SVG as an `<img>` thumbnail, opening the full SVG in a new tab — the mockup at `.fankeel/build/2026-10-20-chartroom-board/mockup.html` is what is approved. | Task 3 |
| `<img>` rather than inline SVG: the board's labels are written by an agent, and an SVG in an `<img>` cannot run script or reach the page. | Task 3 (and Task 2's CSP for the opened tab) |
| No board, no block. | Task 3 |
| `docs/90-agent/todo/station-15.md`'s completion record and `docs/90-agent/reference/station.md:1061-1109` each gain one line saying they are superseded by this design for task diagrams (judgement :249). | Task 4 (station-15), Task 2 (station.md) |
| The fankeel-design skill gains one rule: an architecture, flow or dependency diagram for a task is a `.board` in the build directory, one record per line, no coordinates; sequence and gantt stay Mermaid (judgement :222). | Task 4 |
| `tests/board.test.js`: `renderBoard` on a copy of `examples/levelmark.board` (as `tests/fixtures/levelmark.board`) returns an SVG whose node and edge counts equal the board's records; a board with no coordinates lays out with no two node boxes overlapping; malformed text throws. | Task 1 |
| `tests/station-board.test.js`: a session whose build directory holds `a.board` serialises `boards: [{name:'a',…}]`; `GET /station/board/<id>/a.svg` answers 200 `image/svg+xml`; `../x`, an unknown session and a missing name answer 404. | Task 2 |
| The artefact check: the station page for that session shows one `<img>` per entry of `boards[]`, read from the rendered page and counted against the serialised list. | Task 3 (booted page in `tests/station-boards-card.test.js`); verify repeats it on the served page in a browser |
