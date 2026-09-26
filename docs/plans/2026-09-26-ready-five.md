---
status: design-intent
---

# TODO Ready 五條 Implementation Plan

**Goal:** Land the five `## Ready` entries of `TODO.md` — audit as a standing cleanup, the task exchange `context.md`, the next front-end design task, opt-in gate answering on the page, and the wizard-motion flake — as one plan.
**Architecture:** Five independent subsystems, each in its own files, grouped by `ledger.js groups` rather than ordered by hand. The station's front-end work (Tasks 9–11) is serialised on `assets/station/station.js`; the move of fankeel's own docs to the `audience` preset (Task 13) runs after every other dispatched task because it rewrites paths across the whole tree, and the Trovara run (Task 14) is the user's, last.
**Tech Stack:** Node v24.9.0, CommonJS, zero npm dependencies, `node --test`; a Chromium-family browser found by `findBrowser()` in `scripts/render.js` for the two headless tests.
**Spec:** [2026-09-26-ready-five-design.md](2026-09-26-ready-five-design.md)

## Global Constraints

Generated from `node scripts/map.js` (290 markdown files, 4 planned-not-built, 146 retired, 8 undeclared), `.fankeel/map.md`, `package.json`, `.fankeel/profile.json`, `.fankeel/docs.json` and the tests. This repository has no `CLAUDE.md`.

- `package.json` has `"scripts": { "test": "node --test", "clean": "node scripts/tmp-clean.js" }` and no `"dependencies"`. Add none.
- CommonJS, `'use strict';` at the top of every module. Four-space indent in `lib/`, `scripts/`, `hooks/`, `assets/`; a test keeps the indent of the file it is in (two spaces in most, four in the station tests).
- `lib/` reaches nothing in `scripts/` or `hooks/` (README tree, `lib/` row). Scripts are thin wrappers over `lib/`.
- Every hook reads stdin and exits 0 on every path (`run(main)` in `lib/hook.js`); new work in `hooks/gate.js` stays inside its existing `try`.
- Every scratch directory in a test comes from `tests/tmp.js` (`tmp(prefix)`), which removes it at exit.
- Caps already asserted: the ordinary subagent brief stays under 1400 characters (`tests/brief.test.js:148-153`); the injected block cap is `BLOCK_CAP = 2400` (`lib/render.js:527`), never raised; `GATE_STATION_MAX = 600` (`lib/profile.js:130`); `PROMPT_MAX = 200` (`lib/profile.js:142`); a `TODO.md` line is held to todo-check's 200-character cap.
- `assets/station/station.js` exports its pure functions through the `module.exports` block at `station.js:2060`; the tests `require` it with `global.window = { STATION: {} }`. Every class it renders has a rule in `station.css` (`tests/station-shell.test.js:160`), and a rule copied from the mockup that nothing renders is removed (git log: `fix: drop four dead toast CSS rules Task 8 copied unused`). No CRLF in the station files (`tests/station-shell.test.js:65`).
- Every animation rests under `prefers-reduced-motion` (`tests/station-wizard-motion.test.js`).
- The mockup is `.fankeel/build/2026-09-26-ready-five/mockup.html`, approved **方向**: build implements toward it, the render reviewer checks it per `data-block` (`float-icon`, `gate-countdown`, `editing-pulse`, `wizard-gate-station`, `wizard-design`). `.fankeel/build/` is gitignored.
- Commit subjects are `feat:` / `fix:` / `docs:` / `chore:` / `style:` / `test:` plus a lower-case sentence (git log). Land is a local merge, no push (`.fankeel/profile.json`: `land.integration: merge`, `land.push: false`).
- An implementer runs only its own test command; the parent runs `npm test` before committing a group (`scripts/ledger.js` brief footer).
- `tests/source.test.js` reads `git ls-files`: `git add` a new file before running it, or an unused export passes.
- Never `git stash`, `git checkout`, `git reset`, `git clean` in this tree; never `find /`.
- `TODO.md` and `docs/README.md` are exempt from `ledger.js ready`'s conflict check. The task that delivers a `## Ready` entry removes its line from `TODO.md` and runs `node scripts/todo-check.js`.
- Every dated report at the top of `docs/reports/` has exactly one row in `docs/sources.md` (`tests/sources-doc.test.js:13`), and the heading's count moves with it.

## Task 1: wizard-motion flake — a profile per headless spawn

**Files:**
- Modify: `scripts/render.js` — the one-page mode gives its two spawns a temporary `--user-data-dir`
- Modify: `TODO.md` — the 〔test〕 Ready line goes
- Test: `tests/station-wizard-motion.test.js`
- Read: `tests/tmp.js` — `tmp(prefix)`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus a six-way concurrency proof.

`findBrowser()` has two callers that spawn headless Chromium without a profile of their own: `shoot()` in `tests/station-wizard-motion.test.js` and the one-page mode of `scripts/render.js` (`main()`, `shoot(..., [])`), which `tests/render-cli.test.js` runs in the same suite. `tests/station-cli.test.js` spawns no browser (`grep headless|chrome|msedge` finds nothing there), so the design's "so `station-cli` gets it too" lands on `render-cli`, the other caller; say so in the report.

- [ ] **Step 1: Measure red.** From the repo root, three times:

```sh
node -e "const {spawn}=require('child_process');let fail=0,done=0;for(let i=0;i<6;i++){const c=spawn(process.execPath,['--test','tests/station-wizard-motion.test.js'],{stdio:'ignore'});c.on('close',(code)=>{if(code)fail++;if(++done===6){console.log('failed '+fail+' of 6');process.exit(fail?1:0)}})}"
```

Record each `failed N of 6` line. If all three read `failed 0 of 6`, say that red was not reproduced — the fix below is still the design's, but the proof in Step 4 is then only half a proof.

- [ ] **Step 2: Give the test's spawns their own profile.** In `tests/station-wizard-motion.test.js`, replace `shoot()` with:

```js
// Its own profile per spawn. Two Chromium processes on the default profile
// hand the second one's URL to the first, and the second exits with nothing
// on stdout — the `the page never reported` failure the suite saw on 09-26.
function shoot(file, reduce) {
    const profileDir = tmp('fankeel-wizmotion-profile-');
    const args = ['--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + profileDir, '--virtual-time-budget=2000'];
    if (reduce) args.push('--force-prefers-reduced-motion');
    const r = spawnSync(findBrowser(), args.concat(['--dump-dom', pathToFileURL(file).href]), { encoding: 'utf8', timeout: 60000 });
    const m = /RUN=(\d+) RM=(true|false)/.exec(r.stdout || '');
    assert.ok(m, 'the page never reported: ' + String(r.stderr || '').slice(0, 300));
    return { running: Number(m[1]), reduced: m[2] === 'true' };
}
```

- [ ] **Step 3: Give `render.js`'s one-page mode the same.** In `scripts/render.js`, add `const os = require('node:os');` beside `const { spawnSync } = require('node:child_process');`, and in `main()` replace the line `const err = shoot(browser, toUrl(target), png, html, args.size, []);` with:

```js
    // A profile of its own for this run, removed after: two renders at once on
    // the default profile hand one URL to the other browser, and the second
    // exits having written nothing.
    const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-render-'));
    let err;
    try {
        err = shoot(browser, toUrl(target), png, html, args.size, ['--user-data-dir=' + profileDir]);
    } finally {
        fs.rmSync(profileDir, { recursive: true, force: true });
    }
```

- [ ] **Step 4: Measure green.** Run the Step 1 command three times; every line must read `failed 0 of 6`. Then `node --test tests/station-wizard-motion.test.js tests/render-cli.test.js`.
- [ ] **Step 5:** Delete the `〔test〕wizard-motion …` line from `## Ready` in `TODO.md`; run `node scripts/todo-check.js`.
- [ ] **Step 6: Commit** — `fix: a browser profile per headless spawn, so concurrent tests stop handing URLs to each other`.

## Task 2: audit in batches, and the fortnight reminder

**Files:**
- Modify: `lib/docs.js` — `bucketOf(tree, rel)`
- Modify: `scripts/docs-audit.js` — `batches(root)`, `--batches`, `--batch <n>`, `--record`
- Modify: `scripts/orient.js` — `auditLine(dir, now)` at the end of the `todo:` block
- Modify: `skills/fankeel-audit/SKILL.md` — the reading half in batches; `--record`
- Test: `tests/docs.test.js`
- Test: `tests/docs-audit.test.js`
- Test: `tests/orient.test.js`
- Read: `lib/tracked.js` — `trackedFiles(root)`

**Interfaces:**
- Consumes: none
- Produces: `bucketOf(tree, rel) -> bucket | null` in `lib/docs.js`; `batches(root) -> [{ bucket, part, of, pages }]`, `recordRun(root, at) -> file`, `BATCH_PAGES = 40` in `scripts/docs-audit.js`; `.fankeel/audit.json` shaped `{ "last": "YYYY-MM-DD" }`

**Dispatch:** implementer, sonnet — the plan carries the code; three small additions and their tests.

The three additions share nothing but their test run.

- [ ] **Step 1: Write the failing tests.** Append to `tests/docs.test.js`:

```js
test('bucketOf names the bucket a file is filed under, depth and nesting included', () => {
  const t = docs.normalise(docs.PRESETS.flat);
  assert.equal(docs.bucketOf(t, 'docs/plans/x.md').path, 'docs/plans');
  assert.equal(docs.bucketOf(t, 'docs/a.md').path, 'docs');
  assert.equal(docs.bucketOf(t, 'docs/notes/deep/x.md'), null, 'depth 1 keeps a deeper page out of docs');
  assert.equal(docs.bucketOf(t, 'README.md'), null, 'a signpost is in no bucket');
  assert.equal(docs.bucketOf(null, 'docs/a.md'), null);
});
```

Append to `tests/docs-audit.test.js`:

```js
// The reading half of /fankeel-audit: one batch per bucket, at most 40 pages,
// so a 319-page repository is split rather than cut off at whatever one
// reader could hold.
test('the reading half is batched: one batch per bucket, at most 40 pages, archive left out', () => {
  const files = { 'README.md': '# r\n' };
  for (let i = 0; i < 90; i++) files['docs/p' + String(i).padStart(2, '0') + '.md'] = '# p\n';
  for (let i = 1; i <= 3; i++) files['docs/plans/2026-01-0' + i + '-x.md'] = '# plan\n';
  files['docs/archive/old.md'] = '# old\n';
  const root = withTree(tree(files), 'flat');
  const b = audit.batches(root);
  assert.deepEqual(b.map((x) => [x.bucket, x.part, x.of, x.pages.length]), [
    ['.', 1, 1, 1], ['docs', 1, 3, 40], ['docs', 2, 3, 40], ['docs', 3, 3, 10], ['docs/plans', 1, 1, 3],
  ]);
  assert.ok(!b.some((x) => x.pages.includes('docs/archive/old.md')), 'an archive page was sent to a reader');
  assert.equal(b.reduce((n, x) => n + x.pages.length, 0), 94);
});

test('--batches lists the batches, --batch <n> prints one batch\'s pages, --record stamps .fankeel/audit.json', () => {
  const files = {};
  for (let i = 0; i < 45; i++) files['docs/p' + String(i).padStart(2, '0') + '.md'] = '# p\n';
  const root = withTree(tree(files), 'flat');
  const listed = audit.main(['--root', root, '--batches'], NOW);
  assert.equal(listed.code, 0);
  assert.match(listed.text, /^1\. docs 1\/2 — 40 pages$/m);
  assert.match(listed.text, /^2\. docs 2\/2 — 5 pages$/m);
  const one = audit.main(['--root', root, '--batch', '2'], NOW);
  assert.deepEqual(one.text.split('\n'), ['docs/p40.md', 'docs/p41.md', 'docs/p42.md', 'docs/p43.md', 'docs/p44.md']);
  assert.equal(audit.main(['--root', root, '--batch', '9'], NOW).code, 2);
  assert.equal(fs.existsSync(path.join(root, '.fankeel', 'audit.json')), false, 'listing batches is not a run');
  audit.main(['--root', root, '--record'], NOW);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, '.fankeel', 'audit.json'), 'utf8')), { last: '2026-08-21' });
});
```

Append to `tests/orient.test.js`:

```js
// .fankeel/audit.json is what /fankeel-audit leaves behind (docs-audit.js
// --record). Past 14 days the todo: block says how long; up to it, nothing.
test('the todo: block says how many days since the last audit once it is past 14, and nothing before', () => {
  const root = workspace({ '.fankeel/audit.json': JSON.stringify({ last: '2026-09-01' }) + '\n' });
  const opts = initGit(root);
  commitTodo(root, opts, '## Ready\n\n## Needs a decision\n\n## Waiting\n', '2026-09-01T00:00:00Z');
  assert.match(reportAt(root, 2026, 9, 16), /^ {2}audit: 15 天未跑$/m);
  assert.doesNotMatch(reportAt(root, 2026, 9, 14), /audit:/);
  assert.doesNotMatch(reportAt(root, 2026, 9, 15), /audit:/, '14 days is not more than 14');
});
```

- [ ] **Step 2: Run and watch them fail:** `node --test tests/docs.test.js tests/docs-audit.test.js tests/orient.test.js` — `docs.bucketOf is not a function`, `audit.batches is not a function`, no `audit:` line.
- [ ] **Step 3: `bucketOf`.** In `lib/docs.js`, after `roleOf`, add, and add `bucketOf` to `module.exports`:

```js
// The bucket a file is filed under, or null — `roleOf`'s walk, returning the
// bucket rather than its role, and without the signpost case: a root file is
// reference by being a signpost, not by sitting in a bucket.
function bucketOf(tree, rel) {
    const p = String(rel || '').replace(/\\/g, '/').replace(/^\.\//, '');
    if (!p || !tree) return null;
    for (const b of tree.buckets) {
        if (p === b.path || !p.startsWith(b.path + '/')) continue;
        if (b.depth && p.slice(b.path.length + 1).split('/').length > b.depth) continue;
        return b;
    }
    return null;
}
```

- [ ] **Step 4: Batches and the record.** In `scripts/docs-audit.js`, after `sweep()`, add:

```js
// The reading half of /fankeel-audit, split so a large repository is read
// whole rather than cut off: one batch per bucket, at most BATCH_PAGES pages
// each. Archive and fixture pages are not read — an archive may be out of
// date by design and a fixture describes nothing — and the root signposts are
// one batch of their own, `.`.
const BATCH_PAGES = 40;
function batches(root) {
    const listed = trackedFiles(root);
    if (!listed) return [];
    const declared = docs.read(root);
    const implied = declared.tree ? null : docs.detect(root);
    const tree = declared.tree || (implied ? docs.normalise(docs.PRESETS[implied]) : null);
    const groups = new Map();
    for (const rel of listed.files.filter(isMarkdown)) {
        const b = docs.isSignpost(rel) ? { path: '.', role: 'reference' }
            : tree ? docs.bucketOf(tree, rel)
                : { path: rel.includes('/') ? rel.split('/')[0] : '.', role: 'reference' };
        if (!b || b.role === 'archive' || b.role === 'fixture') continue;
        if (!groups.has(b.path)) groups.set(b.path, []);
        groups.get(b.path).push(rel);
    }
    const out = [];
    for (const bucket of [...groups.keys()].sort()) {
        const pages = groups.get(bucket).sort();
        const of = Math.ceil(pages.length / BATCH_PAGES);
        for (let i = 0; i < of; i++) out.push({ bucket, part: i + 1, of, pages: pages.slice(i * BATCH_PAGES, (i + 1) * BATCH_PAGES) });
    }
    return out;
}

function batchesReport(list) {
    const pages = list.reduce((n, b) => n + b.pages.length, 0);
    return ['fankeel docs-audit — ' + list.length + ' reading batches, ' + pages + ' pages, at most ' + BATCH_PAGES + ' each', '']
        .concat(list.map((b, i) => (i + 1) + '. ' + b.bucket + ' ' + b.part + '/' + b.of + ' — ' + b.pages.length + (b.pages.length === 1 ? ' page' : ' pages')))
        .join('\n');
}

// What `orient`'s todo: block reads to say how long since the last audit.
// Committed, like docs.json: it is the project's, not this machine's.
function recordRun(root, at) {
    const file = path.join(root, '.fankeel', 'audit.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ last: new Date(at).toISOString().slice(0, 10) }, null, 2) + '\n');
    return file;
}
```

In `scripts/docs-audit.js`'s `parseArgs`, make `TAKES_VALUE` `new Set(['--root', '--since', '--batch'])`, extend the options to `{ root: { type: 'string' }, since: { type: 'string' }, quiet: { type: 'boolean' }, batches: { type: 'boolean' }, batch: { type: 'string' }, record: { type: 'boolean' } }`, and add to the returned object:

```js
        batches: Boolean(values.batches),
        batch: /^\d+$/.test(String(values.batch)) && Number(values.batch) > 0 ? Number(values.batch) : null,
        record: Boolean(values.record),
```

Replace `main()` in `scripts/docs-audit.js` with:

```js
function main(argv, now) {
    const { root, since, settled, quiet, batches: listing, batch, record } = parseArgs(argv);
    const at = typeof now === 'number' ? now : Date.now();
    if (listing || batch !== null) {
        const list = batches(root);
        if (listing) return { text: batchesReport(list), code: 0 };
        const one = list[batch - 1];
        if (!one) return { text: 'docs-audit: no batch ' + batch + ' — there are ' + list.length, code: 2 };
        return { text: one.pages.join('\n'), code: 0 };
    }
    const r = sweep(root, since, at, settled);
    if (record && r) recordRun(root, at);
    const bad = defects(r) > 0;
    const text = report(r);
    return { text: quiet && !bad ? '' : text, code: bad ? 1 : 0 };
}
```

and make the exports `module.exports = { sweep, report, main, parseArgs, defects, pointsAt, DEFAULT_SINCE, batches, recordRun, BATCH_PAGES };`.

- [ ] **Step 5: The reminder.** In `scripts/orient.js`, above `todoBlock`, add:

```js
// `/fankeel-audit` stamps `.fankeel/audit.json` (`docs-audit.js --record`).
// Past AUDIT_DAYS the todo: block says so, riding a prompt the user already
// opens; up to it, and with no stamp at all, it says nothing.
const AUDIT_DAYS = 14;
function auditLine(dir, now) {
    let last;
    try {
        last = JSON.parse(fs.readFileSync(path.join(dir, '.fankeel', 'audit.json'), 'utf8')).last;
    } catch (e) {
        return null;
    }
    const at = Date.parse(last);
    if (!Number.isFinite(at)) return null;
    const days = Math.floor((now - at) / 86400000);
    return days > AUDIT_DAYS ? '  audit: ' + days + ' 天未跑' : null;
}
```

and at the end of `todoBlock` in `scripts/orient.js`, replace `return lines;` with:

```js
    const audit = auditLine(dir, now);
    if (audit) lines.push(audit);
    return lines;
```

- [ ] **Step 6: The skill.** In `skills/fankeel-audit/SKILL.md`, under `## Run all five`, change the docs-audit line of the command block to `node <plugin>/scripts/docs-audit.js [--root <dir>] [--since <days>] --record`, and after the paragraph that starts "`--root` picks one project" add:

```md
`--record` writes `.fankeel/audit.json` — `{ "last": "<date>" }`, committed —
and `orient`'s `todo:` block says `audit: N 天未跑` once that is more than 14
days old. That line is the whole reminder: no cron, no routine.
```

In `skills/fankeel-audit/SKILL.md`, under `## The part only reading finds`, after the paragraph that starts "So dispatch it:", add:

```md
**A large tree is read in batches, never truncated.**
`node <plugin>/scripts/docs-audit.js --batches` lists them — one per bucket,
at most 40 pages each, archive and fixture pages left out. Send one
`fankeel:fankeel-reader` per batch, four in one response at most, each told
its batch number and to run `node <plugin>/scripts/docs-audit.js --batch <n>`
for its pages, and asked which page describes something that no longer
exists. 319 pages are eight readers, not one reader holding the first forty.
```

- [ ] **Step 7: Run and watch them pass:** `node --test tests/docs.test.js tests/docs-audit.test.js tests/orient.test.js tests/skills.test.js`.
- [ ] **Step 8: Commit** — `feat: audit reads in 40-page batches and orient says when it last ran`.

## Task 3: docs-move.js — the move table, then the move

**Files:**
- Modify: `scripts/docs-move.js` — new: `plan` and `apply`
- Modify: `docs/documents.md` — one paragraph naming the script
- Test: `tests/docs-move.test.js`
- Read: `lib/docs.js` — `bucketOf`, `PRESETS`, `normalise`, `read`, `write`, `roleOf`
- Read: `scripts/docs-check.js` — `LINK`, `CODE`, `external`, `isMarkdown`, `scan`
- Read: `scripts/docs-audit.js` — `sweep` (the page count the table is held to)
- Read: `lib/tracked.js` — `trackedFiles`
- Read: `lib/registry.js` — `resolveRoot`

**Interfaces:**
- Consumes: `bucketOf` from Task 2
- Produces: `planMoves(root, toName, place) -> [{ from, to }]`, `applyMoves(root, rows, toName, { rewrite }) -> { moved, rewritten, dirs }`, `writeTable(file, rows)`, `readTable(file)`, `rewriteText(text, oldRel, newRel, files, dirs)`, `dirMoves(rows) -> Map`, `bucketTargets(from, to) -> Map`, `nextTree(from, to, targets)`; the CLI `node scripts/docs-move.js plan --to <preset> --out <moves.tsv> [--place <from>=<to>]… | apply --to <preset> --table <moves.tsv>`

**Dispatch:** implementer, opus — the relative-link rewrite has to be reasoned against each page's old and new location at once, and a slip there points five hundred links at the wrong place.

How a bucket moves, which the tests pin: a bucket of the source preset's own (flat's docs/plans, docs/decisions, docs/reports, docs/archive) goes to the target's bucket of the same role, the `audience: agent` one where there are several; a bucket nested in a moving one moves inside it (docs/reports/evidence → docs/90-agent/reports/evidence); any other bucket under docs/ moves to docs/90-agent/<its name> keeping its role (docs/judgements → docs/90-agent/judgements); the top-level pages of a `depth` bucket go to the target's reference bucket (docs/90-agent/reference) except the index, which stays; buckets outside docs/ stay. A code span is rewritten only when it names a moved **file** exactly — a directory in a code span, like a skill's docs/plans/, describes any project's layout and is left alone.

The whole script is below; its tests come first.

- [ ] **Step 1: Write the failing test** `tests/docs-move.test.js`:

```js
'use strict';
// scripts/docs-move.js: a flat tree moved to audience, links and all. The
// table comes first so a gate can show it; the move rewrites every relative
// link and every code-span file path that pointed at a moved page.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const docs = require('../lib/docs.js');
const move = require('../scripts/docs-move.js');
const { scan } = require('../scripts/docs-check.js');
const audit = require('../scripts/docs-audit.js');
const tmp = require('./tmp.js');

function repo(files) {
  const root = tmp('fankeel-docsmove-');
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(root, ...rel.split('/'));
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
  }
  docs.write(root, Object.assign({}, docs.PRESETS.flat, {
    buckets: docs.PRESETS.flat.buckets.concat([
      { path: 'docs/reports/evidence', role: 'fixture' },
      { path: 'docs/judgements', role: 'report' },
      { path: 'skills', role: 'reference' },
    ]),
  }));
  const git = (args) => execFileSync('git', args, { cwd: root, stdio: ['ignore', 'ignore', 'ignore'] });
  git(['init', '-q']);
  git(['config', 'user.email', 't@example.com']);
  git(['config', 'user.name', 'test']);
  git(['add', '-A']);
  git(['commit', '-qm', 'flat']);
  return root;
}

// Every page links another across a bucket boundary; one names a file by a
// code span with a line number, one names the evidence file by a code span.
const FLAT = {
  'lib/a.js': 'const target = 1;\n',
  'docs/README.md': '# index\n\n- [pipeline](pipeline.md)\n- [plan](plans/2026-01-01-x.md)\n- [why](decisions/why.md)\n'
    + '- [run](reports/2026-01-02-run.md)\n- [judged](judgements/2026-01-03-j.md)\n',
  'docs/pipeline.md': '# pipeline\n\nSee [the plan](plans/2026-01-01-x.md#steps) and `docs/decisions/why.md:3`, built by `lib/a.js`.\n',
  'docs/plans/2026-01-01-x.md': '# plan\n\n## steps\n\nBack to [pipeline](../pipeline.md); evidence in `docs/reports/evidence/2026-01-02-run/out.txt`.\n',
  'docs/decisions/why.md': '# why\n\nline two\nline three\n',
  'docs/reports/2026-01-02-run.md': '# run\n\nRaw: [out](evidence/2026-01-02-run/out.txt).\n',
  'docs/reports/evidence/2026-01-02-run/out.txt': 'raw\n',
  'docs/archive/old.md': '# old\n\nWas [pipeline](../pipeline.md).\n',
  'docs/judgements/2026-01-03-j.md': '# j\n\nAsked about [why](../decisions/why.md).\n',
};

test('a flat tree moved to audience: the table has a row per page, and docs-check finds nothing dead after', () => {
  const root = repo(FLAT);
  assert.deepEqual(scan(root, []).findings, [], 'the fixture is clean before the move, or the zero after it proves nothing');
  const pages = audit.sweep(root, 14, Date.now()).markdown;
  const table = path.join(root, '.fankeel', 'build', 'p', 'moves.tsv');
  move.writeTable(table, move.planMoves(root, 'audience', {}));
  const rows = move.readTable(table);
  assert.equal(rows.filter((r) => r.from.endsWith('.md')).length, pages, 'one row per page docs-audit counted before the move');
  assert.deepEqual(Object.fromEntries(rows.map((r) => [r.from, r.to])), {
    'docs/README.md': 'docs/README.md',
    'docs/archive/old.md': 'docs/99-archive/old.md',
    'docs/decisions/why.md': 'docs/03-decisions/why.md',
    'docs/judgements/2026-01-03-j.md': 'docs/90-agent/judgements/2026-01-03-j.md',
    'docs/pipeline.md': 'docs/90-agent/reference/pipeline.md',
    'docs/plans/2026-01-01-x.md': 'docs/90-agent/plans/2026-01-01-x.md',
    'docs/reports/2026-01-02-run.md': 'docs/90-agent/reports/2026-01-02-run.md',
    'docs/reports/evidence/2026-01-02-run/out.txt': 'docs/90-agent/reports/evidence/2026-01-02-run/out.txt',
  });

  const r = move.applyMoves(root, rows, 'audience');
  assert.equal(r.moved, 7);
  assert.deepEqual(scan(root, []).findings, [], 'a link or path the move left dead');
  const pipeline = fs.readFileSync(path.join(root, 'docs', '90-agent', 'reference', 'pipeline.md'), 'utf8');
  assert.match(pipeline, /\]\(\.\.\/plans\/2026-01-01-x\.md#steps\)/);
  assert.match(pipeline, /`docs\/03-decisions\/why\.md:3`/);
  assert.match(fs.readFileSync(path.join(root, 'docs', 'README.md'), 'utf8'), /\]\(90-agent\/reference\/pipeline\.md\)/);
  const tree = docs.read(root).tree;
  assert.equal(tree.preset, 'audience');
  assert.equal(docs.roleOf(tree, 'docs/90-agent/judgements/2026-01-03-j.md'), 'report');
  assert.equal(docs.roleOf(tree, 'docs/90-agent/reports/evidence/2026-01-02-run/out.txt'), 'fixture');
  assert.equal(docs.roleOf(tree, 'docs/README.md'), 'reference');
  assert.equal(docs.roleOf(tree, 'skills/x/SKILL.md'), 'reference', 'a bucket outside docs/ stays declared');
});

test('a page outside docs/ that links in is rewritten too, and a move without the rewrite is what the check catches', () => {
  const files = Object.assign({}, FLAT, { 'skills/x/SKILL.md': '# x\n\nRead [the pipeline](../../docs/pipeline.md), `docs/pipeline.md`; plans live in `docs/plans/`.\n' });
  const root = repo(files);
  move.applyMoves(root, move.planMoves(root, 'audience', {}), 'audience');
  const skill = fs.readFileSync(path.join(root, 'skills', 'x', 'SKILL.md'), 'utf8');
  assert.match(skill, /\]\(\.\.\/\.\.\/docs\/90-agent\/reference\/pipeline\.md\), `docs\/90-agent\/reference\/pipeline\.md`/);
  assert.match(skill, /`docs\/plans\/`/, 'a directory in a code span describes any project and is left alone');

  const control = repo(files);
  move.applyMoves(control, move.planMoves(control, 'audience', {}), 'audience', { rewrite: false });
  assert.ok(scan(control, []).findings.length > 0, 'moving without the rewrite leaves nothing dead, so the zero above cannot fail');
});

test('--place puts one page where the gate said, and refuses a page that is not there', () => {
  const root = repo(FLAT);
  const rows = move.planMoves(root, 'audience', { 'docs/pipeline.md': 'docs/02-architecture/pipeline.md' });
  assert.equal(rows.find((r) => r.from === 'docs/pipeline.md').to, 'docs/02-architecture/pipeline.md');
  assert.throws(() => move.planMoves(root, 'audience', { 'docs/nope.md': 'docs/01-guide/nope.md' }), /docs\/nope\.md/);
});

test('plan writes the table and moves nothing', () => {
  const root = repo(FLAT);
  const out = path.join(root, '.fankeel', 'build', 'p', 'moves.tsv');
  const r = move.main(['plan', '--root', root, '--to', 'audience', '--out', out]);
  assert.equal(r.code, 0);
  assert.match(r.text, /8 rows — 7 pages, 7 files move/);
  assert.ok(fs.existsSync(path.join(root, 'docs', 'pipeline.md')), 'plan moved a file');
  assert.equal(move.main(['plan', '--root', root, '--to', 'nope', '--out', out]).code, 2);
});
```

- [ ] **Step 2: Run and watch it fail:** `node --test tests/docs-move.test.js` — `Cannot find module '../scripts/docs-move.js'`.
- [ ] **Step 3: Write** `scripts/docs-move.js`:

```js
#!/usr/bin/env node
'use strict';
// scripts/docs-move.js: move a docs tree from the preset its docs.json names
// to another preset's buckets — a table first, a move second.
//
//   node scripts/docs-move.js plan --to <preset> --out <moves.tsv> [--root <dir>] [--place <from>=<to>]...
//   node scripts/docs-move.js apply --to <preset> --table <moves.tsv> [--root <dir>]
//
// `plan` writes `<from>\t<to>`, one row per tracked file under the docs root
// that moves and one per page whether or not it moves (the index stays, from
// and to equal), and moves nothing: the gate shows the table. `apply` runs
// `git mv` for every row that moves, rewrites every relative link and every
// code-span file path in every tracked markdown file that pointed at a moved
// file, and writes the new `.fankeel/docs.json`.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { parseArgs } = require('node:util');
const docs = require('../lib/docs.js');
const { trackedFiles } = require('../lib/tracked.js');
const { resolveRoot } = require('../lib/registry.js');
const { LINK, CODE, external, isMarkdown } = require('./docs-check.js');

const posix = path.posix;
const under = (p, dir) => p === dir || p.startsWith(dir + '/');

// Where each moving bucket of `from` goes under `to`. Parents are placed
// before their children, so a nested bucket rides inside its parent's move.
function bucketTargets(from, to) {
    const docRoot = to.index.split('/')[0];
    const kept = new Set(to.buckets.map((b) => b.path));
    const agent = to.buckets.find((b) => b.audience === 'agent');
    const agentRoot = agent ? posix.dirname(agent.path) : docRoot;
    const stockTree = docs.PRESETS[from.preset] ? docs.normalise(docs.PRESETS[from.preset]) : null;
    const stock = stockTree ? stockTree.buckets : [];
    const byRole = (role) => {
        const same = to.buckets.filter((b) => b.role === role);
        return same.find((b) => b.audience === 'agent') || same[0] || null;
    };
    const out = new Map();
    const sorted = from.buckets.slice().sort((a, b) => a.path.length - b.path.length || (a.path < b.path ? -1 : 1));
    for (const b of sorted) {
        if (!under(b.path, docRoot) || b.depth || kept.has(b.path)) continue;
        let parent = null;
        for (const p of out.keys()) if (b.path.startsWith(p + '/') && (!parent || p.length > parent.length)) parent = p;
        if (parent) { out.set(b.path, out.get(parent) + b.path.slice(parent.length)); continue; }
        const isStock = stock.some((s) => s.path === b.path && s.role === b.role);
        const target = isStock ? byRole(b.role) : null;
        out.set(b.path, target ? target.path : agentRoot + '/' + posix.basename(b.path));
    }
    return out;
}

// Where one tracked file goes: inside its bucket's move, or — a top-level
// page of a depth bucket such as flat's `docs` — into the target's bucket of
// the same role. The index stays; a file in no bucket stays.
function destination(rel, from, to, targets) {
    const b = docs.bucketOf(from, rel);
    if (!b || rel === to.index) return rel;
    if (targets.has(b.path)) return targets.get(b.path) + rel.slice(b.path.length);
    if (b.depth && under(b.path, to.index.split('/')[0])) {
        const same = to.buckets.filter((x) => x.role === b.role);
        const target = same.find((x) => x.audience === 'agent') || same[0];
        return target ? target.path + rel.slice(b.path.length) : rel;
    }
    return rel;
}

function planMoves(root, toName, place) {
    const to = docs.PRESETS[toName] ? docs.normalise(docs.PRESETS[toName]) : null;
    if (!to) throw new Error('no preset named ' + toName + ' — one of: ' + Object.keys(docs.PRESETS).join(', '));
    const { tree: from, error } = docs.read(root);
    if (!from) throw new Error(error || 'no .fankeel/docs.json under ' + root + ' — nothing says where the pages are now');
    const listed = trackedFiles(root);
    const docRoot = to.index.split('/')[0];
    const targets = bucketTargets(from, to);
    const placed = place || {};
    const rows = [];
    for (const rel of listed.files.slice().sort()) {
        if (!under(rel, docRoot)) continue;
        const dest = Object.prototype.hasOwnProperty.call(placed, rel) ? placed[rel] : destination(rel, from, to, targets);
        if (dest !== rel || isMarkdown(rel)) rows.push({ from: rel, to: dest });
    }
    for (const k of Object.keys(placed)) {
        if (!rows.some((r) => r.from === k)) throw new Error('--place names ' + k + ', which is not a tracked file under ' + docRoot);
    }
    return rows;
}

function writeTable(file, rows) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, rows.map((r) => r.from + '\t' + r.to).join('\n') + '\n');
}

function readTable(file) {
    return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => {
        const [from, to] = line.split('\t');
        if (!from || !to) throw new Error(file + ': a row is not <from>\\t<to>: ' + line);
        return { from, to };
    });
}

// The directories that moved whole: every row under the old directory landed
// under one new one. `docs` itself never qualifies while its index stays.
function dirMoves(rows) {
    const cand = new Map();
    for (const r of rows) {
        if (r.from === r.to || posix.basename(r.from) !== posix.basename(r.to)) continue;
        let a = posix.dirname(r.from);
        let b = posix.dirname(r.to);
        while (a !== '.' && b !== '.' && a !== b) {
            if (!cand.has(a)) cand.set(a, b);
            if (posix.basename(a) !== posix.basename(b)) break;
            a = posix.dirname(a);
            b = posix.dirname(b);
        }
    }
    const out = new Map();
    for (const [a, b] of cand) {
        const inside = rows.filter((r) => r.from.startsWith(a + '/'));
        if (inside.length && inside.every((r) => r.to === b + r.from.slice(a.length))) out.set(a, b);
    }
    return out;
}

function mapPath(p, files, dirs) {
    if (files.has(p)) return files.get(p);
    if (dirs.has(p)) return dirs.get(p);
    let best = null;
    for (const d of dirs.keys()) if (p.startsWith(d + '/') && (!best || d.length > best.length)) best = d;
    return best ? dirs.get(best) + p.slice(best.length) : null;
}

// One page's text after the move. `oldRel` is where it was, `newRel` where it
// is now; a link is re-pointed when its target moved or the page did. A code
// span is rewritten only when it names a moved file exactly.
function rewriteText(text, oldRel, newRel, files, dirs) {
    const oldDir = posix.dirname(oldRel);
    const newDir = posix.dirname(newRel);
    const link = new RegExp(LINK.source, 'g');
    let out = text.replace(link, (whole, ref, anchor) => {
        if (external(ref) || ref.startsWith('/')) return whole;
        const target = posix.normalize(posix.join(oldDir, ref)).replace(/\/$/, '');
        if (target.startsWith('..')) return whole;
        const moved = mapPath(target, files, dirs);
        if (moved === null && oldDir === newDir) return whole;
        let next = posix.relative(newDir, moved === null ? target : moved) || posix.basename(target);
        if (ref.endsWith('/')) next += '/';
        const at = whole.lastIndexOf('(' + ref);
        return whole.slice(0, at) + '(' + next + whole.slice(at + 1 + ref.length);
    });
    const code = new RegExp(CODE.source, 'g');
    out = out.replace(code, (whole, inner) => {
        const m = /^(.*?)(:\d+(?:-\d+)?)?$/.exec(inner);
        return files.has(m[1]) ? '`' + files.get(m[1]) + (m[2] || '') + '`' : whole;
    });
    return out;
}

function mv(root, srcs, dest) {
    execFileSync('git', ['mv', '--', ...srcs, dest], { cwd: root, stdio: ['ignore', 'ignore', 'pipe'] });
}

// The tree to write after the move: the target preset's buckets, every
// source bucket that moved under its new path, every bucket outside the docs
// root as it was, and the docs root itself at depth 1 while the index sits
// directly in it — or the index is filed nowhere.
function nextTree(from, to, targets) {
    const docRoot = to.index.split('/')[0];
    const buckets = to.buckets.map((b) => Object.assign({}, b));
    const has = (p) => buckets.some((b) => b.path === p);
    for (const b of from.buckets) {
        const moved = targets.get(b.path);
        if (!moved && under(b.path, docRoot)) continue;
        const p = moved || b.path;
        if (!has(p)) buckets.push(Object.assign({}, b, { path: p }));
    }
    if (posix.dirname(to.index) === docRoot && !has(docRoot)) buckets.push({ path: docRoot, role: 'reference', depth: 1 });
    const out = { preset: to.preset, index: to.index, buckets };
    if (from.layout) out.layout = from.layout;
    return out;
}

function applyMoves(root, rows, toName, opts) {
    const rewrite = !(opts && opts.rewrite === false);
    const to = docs.PRESETS[toName] ? docs.normalise(docs.PRESETS[toName]) : null;
    const { tree: from } = docs.read(root);
    if (!to || !from) throw new Error('apply needs a preset to move to and a .fankeel/docs.json to move from');
    const moving = rows.filter((r) => r.from !== r.to);
    const files = new Map(moving.map((r) => [r.from, r.to]));
    const dirs = dirMoves(rows);
    const byDir = new Map();
    for (const r of moving) {
        if (posix.basename(r.from) !== posix.basename(r.to)) {
            fs.mkdirSync(path.join(root, posix.dirname(r.to)), { recursive: true });
            mv(root, [r.from], r.to);
            continue;
        }
        const dir = posix.dirname(r.to);
        if (!byDir.has(dir)) byDir.set(dir, []);
        byDir.get(dir).push(r.from);
    }
    for (const [dir, srcs] of byDir) {
        fs.mkdirSync(path.join(root, dir), { recursive: true });
        for (let i = 0; i < srcs.length; i += 50) mv(root, srcs.slice(i, i + 50), dir);
    }
    let rewritten = 0;
    if (rewrite) {
        const back = new Map(moving.map((r) => [r.to, r.from]));
        for (const rel of trackedFiles(root).files.filter(isMarkdown)) {
            const full = path.join(root, rel);
            const text = fs.readFileSync(full, 'utf8');
            const next = rewriteText(text, back.get(rel) || rel, rel, files, dirs);
            if (next !== text) { fs.writeFileSync(full, next); rewritten++; }
        }
    }
    docs.write(root, nextTree(from, to, bucketTargets(from, to)));
    return { moved: moving.length, rewritten, dirs: dirs.size };
}

const fail = (msg) => ({ text: 'docs-move: ' + msg, code: 2 });

function main(argv) {
    let parsed;
    try {
        parsed = parseArgs({ args: argv, allowPositionals: true, strict: true, options: {
            root: { type: 'string' }, to: { type: 'string' }, out: { type: 'string' }, table: { type: 'string' }, place: { type: 'string', multiple: true },
        } });
    } catch (e) {
        return fail(e.message);
    }
    const { values, positionals } = parsed;
    const root = resolveRoot(values.root);
    if (!values.to || !docs.PRESETS[values.to]) return fail('--to is one of: ' + Object.keys(docs.PRESETS).join(', '));
    try {
        if (positionals[0] === 'plan') {
            if (!values.out) return fail('plan needs --out <moves.tsv>');
            const place = {};
            for (const p of values.place || []) {
                const i = p.indexOf('=');
                if (i < 1) return fail('--place is <from>=<to>: ' + p);
                place[p.slice(0, i)] = p.slice(i + 1);
            }
            const rows = planMoves(root, values.to, place);
            const out = path.resolve(values.out);
            writeTable(out, rows);
            const pages = rows.filter((r) => isMarkdown(r.from)).length;
            const moving = rows.filter((r) => r.from !== r.to).length;
            return { text: 'docs-move: ' + rows.length + ' rows — ' + pages + ' pages, ' + moving + ' files move — ' + out, code: 0 };
        }
        if (positionals[0] === 'apply') {
            if (!values.table) return fail('apply needs --table <moves.tsv>');
            const r = applyMoves(root, readTable(path.resolve(values.table)), values.to);
            return { text: 'docs-move: moved ' + r.moved + ' files, ' + r.dirs + ' directories whole, rewrote ' + r.rewritten + ' pages; wrote .fankeel/docs.json', code: 0 };
        }
    } catch (e) {
        return fail(e.message);
    }
    return fail('usage: docs-move.js plan --to <preset> --out <moves.tsv> [--place <from>=<to>]... | apply --to <preset> --table <moves.tsv>');
}

if (require.main === module) {
    const r = main(process.argv.slice(2));
    process.stdout.write(r.text + '\n');
    process.exit(r.code);
}

module.exports = { bucketTargets, planMoves, dirMoves, rewriteText, applyMoves, nextTree, readTable, writeTable, main };
```

- [ ] **Step 4: Run and watch it pass:** `git add scripts/docs-move.js tests/docs-move.test.js && node --test tests/docs-move.test.js tests/source.test.js`.
- [ ] **Step 5: The page.** In `docs/documents.md`, after the paragraph that introduces the three presets (the one beginning "The three shapes that ship"), add:

```md
A tree that outgrows its shape moves with `scripts/docs-move.js`: `plan --to
<preset> --out <moves.tsv>` writes one row per page — old path, new path —
and moves nothing, so the table can be read at a gate; `apply --table` runs
`git mv`, re-points every relative link and every code-span file path that
named a moved page, and rewrites `.fankeel/docs.json`. `--place <from>=<to>`
puts one page somewhere its role alone would not.
```

- [ ] **Step 6: Commit** — `feat: docs-move.js moves a docs tree to another preset, table first`.

## Task 4: context.md — the task's exchange of verified facts

**Files:**
- Modify: `lib/handoff.js` — `contextPath(root, data)`
- Modify: `scripts/context.js` — new: `add` and `show`
- Modify: `lib/render.js` — `renderBrief` names the path
- Modify: `docs/subagents.md` — a section on the file
- Test: `tests/context-md.test.js`
- Test: `tests/brief.test.js`
- Read: `lib/registry.js` — `resolveRoot`, `readSession`
- Read: `lib/docs.js` — `projectRootsFor`

**Interfaces:**
- Consumes: none
- Produces: `contextPath(root, data) -> string | null` in `lib/handoff.js`; `add(file, { fact, at, sha }) -> { ok, added, dropped, count, reason }`, `show(file, head) -> string[]`, `readEntries(file)`, `CAP = 40` in `scripts/context.js`; the CLI `node scripts/context.js add "<fact>" --at <path:line> --session <id> [--root <dir>]` and `node scripts/context.js show --session <id> [--root <dir>]`

**Dispatch:** implementer, sonnet — the plan carries the code; a small CLI, one helper and one brief line.

A tests/context.test.js already exists — it tests lib/context.js — so the new file is `tests/context-md.test.js`.

- [ ] **Step 1: Write the failing tests.** Create `tests/context-md.test.js`:

```js
'use strict';
// scripts/context.js: a task's verified facts, one per line — the fact, its
// path:line, and the short sha it was read at — capped at 40, oldest dropped.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const ctx = require('../scripts/context.js');
const { contextPath } = require('../lib/handoff.js');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'context.js');
const SID = 'cccccccc-0000-4000-8000-000000000001';
const file = () => path.join(tmp('fankeel-ctx-'), 'context.md');

test('41 adds leave 40 lines, the oldest gone', () => {
  const f = file();
  for (let i = 1; i <= 41; i++) ctx.add(f, { fact: 'fact ' + i, at: 'lib/a.js:' + i, sha: 'abc1234' });
  const lines = fs.readFileSync(f, 'utf8').trim().split('\n');
  assert.equal(lines.length, 40);
  assert.equal(lines[0], '- fact 2 — lib/a.js:2 @ abc1234');
  assert.equal(lines[39], '- fact 41 — lib/a.js:41 @ abc1234');
});

test('an exact duplicate adds nothing; the same fact read again at a new sha replaces its line', () => {
  const f = file();
  ctx.add(f, { fact: 'x is 3', at: 'lib/a.js:4', sha: 'abc1234' });
  assert.equal(ctx.add(f, { fact: 'x is 3', at: 'lib/a.js:4', sha: 'abc1234' }).added, false);
  assert.equal(fs.readFileSync(f, 'utf8'), '- x is 3 — lib/a.js:4 @ abc1234\n');
  ctx.add(f, { fact: 'x is 3', at: 'lib/a.js:4', sha: 'def5678' });
  assert.equal(fs.readFileSync(f, 'utf8'), '- x is 3 — lib/a.js:4 @ def5678\n');
});

test('show marks a line read at a sha that is not HEAD with (舊)', () => {
  const f = file();
  ctx.add(f, { fact: 'old', at: 'lib/a.js:1', sha: 'abc1234' });
  ctx.add(f, { fact: 'new', at: 'lib/a.js:2', sha: 'def5678' });
  assert.deepEqual(ctx.show(f, 'def5678'), ['- old — lib/a.js:1 @ abc1234 (舊)', '- new — lib/a.js:2 @ def5678']);
});

test('a fact with no path:line, or no text, is refused and writes nothing', () => {
  const f = file();
  assert.equal(ctx.add(f, { fact: 'x', at: 'lib/a.js', sha: 'abc1234' }).ok, false);
  assert.equal(ctx.add(f, { fact: '  ', at: 'lib/a.js:1', sha: 'abc1234' }).ok, false);
  assert.equal(fs.existsSync(f), false);
});

test('the CLI finds the task by session, stamps HEAD\'s short sha, and show reads it back', () => {
  const root = tmp('fankeel-ctx-root-');
  const git = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  git(['init', '-q']);
  git(['config', 'user.email', 't@example.com']);
  git(['config', 'user.name', 'test']);
  fs.writeFileSync(path.join(root, 'a.js'), 'x\n');
  git(['add', '-A']);
  git(['commit', '-qm', 'a']);
  const head = git(['rev-parse', '--short', 'HEAD']).trim();
  const data = { task: 't', stage: 'build', active: true, started: '2026-09-26T01:28:47.000Z', updated: new Date().toISOString() };
  fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
  fs.writeFileSync(path.join(root, '.fankeel', 'sessions', SID + '.json'), JSON.stringify(data));
  const run = (...args) => execFileSync(process.execPath, [SCRIPT, ...args, '--session', SID, '--root', root], { encoding: 'utf8' });
  run('add', 'a.js holds x', '--at', 'a.js:1');
  const f = contextPath(root, data);
  assert.match(f, /\/\.fankeel\/build\/task-20260926T012847\/context\.md$/);
  assert.equal(fs.readFileSync(f, 'utf8'), '- a.js holds x — a.js:1 @ ' + head + '\n');
  assert.equal(run('show').trim(), '- a.js holds x — a.js:1 @ ' + head);
});
```

Append to `tests/brief.test.js`:

```js
// docs/plans/2026-09-26-ready-five-design.md §2: the brief names the task's
// context.md by path, so a subagent reads it on demand — never its contents.
test('the brief names the task\'s context.md by path and never inlines it', () => {
  const root = tmp();
  seed(root, { started: '2026-09-19T09:30:12.345Z' });
  const file = path.join(root, '.fankeel', 'build', 'task-20260919T093012', 'context.md');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '- a secret fact — lib/a.js:1 @ abc1234\n');
  const text = contextOf(run(root, start(root)));
  assert.match(text, /context: \S*\/\.fankeel\/build\/task-20260919T093012\/context\.md — /);
  assert.match(text, /scripts\/context\.js add/);
  assert.ok(!text.includes('a secret fact'), 'the brief inlined the file');
});
```

- [ ] **Step 2: Run and watch them fail:** `node --test tests/context-md.test.js tests/brief.test.js`.
- [ ] **Step 3: The path.** In `lib/handoff.js`, after `pendingPath`, add, and add `contextPath` to `module.exports`:

```js
// The task's exchange of verified facts — `scripts/context.js` is its only
// writer. Beside the handoffs and not per stage: a fact read in build is as
// true in verify, until HEAD moves past the sha it was read at.
function contextPath(root, data) {
    const dir = dirFor(root, data);
    return dir ? dir + '/context.md' : null;
}
```

- [ ] **Step 4: The writer.** Create `scripts/context.js`:

```js
#!/usr/bin/env node
'use strict';
// scripts/context.js: the task's exchange of verified facts,
// `.fankeel/build/task-<started>/context.md`, one per line:
//
//   - <fact> — <path:line> @ <short sha>
//
//   node scripts/context.js add "<fact>" --at <path:line> --session <id> [--root <dir>]
//   node scripts/context.js show --session <id> [--root <dir>]
//
// The only writer. Any subagent may call it; the brief names the file's path
// and never its contents. `add` stamps `git rev-parse --short HEAD`, drops an
// exact duplicate, replaces the same fact read again at a new sha, and keeps
// the newest CAP lines. `show` marks a line whose sha is not HEAD `(舊)`: it
// may still be true, and a reader re-checks it rather than trusting it.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { parseArgs } = require('node:util');
const registry = require('../lib/registry.js');
const { projectRootsFor } = require('../lib/docs.js');
const { contextPath } = require('../lib/handoff.js');

const CAP = 40;
const LINE = /^- (.+) — (\S+) @ ([0-9a-f]{4,40})$/;
const AT = /^[^\s]+:\d+(?:-\d+)?$/;

const lineOf = (e) => '- ' + e.fact + ' — ' + e.at + ' @ ' + e.sha;

function readEntries(file) {
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch (e) { return []; }
    return text.split(/\r?\n/).map((l) => LINE.exec(l)).filter(Boolean).map((m) => ({ fact: m[1], at: m[2], sha: m[3] }));
}

function add(file, entry) {
    const fact = String((entry && entry.fact) || '').replace(/\s+/g, ' ').trim();
    const at = String((entry && entry.at) || '').trim();
    const sha = String((entry && entry.sha) || '').trim();
    if (!fact) return { ok: false, reason: 'a fact needs its text' };
    if (!AT.test(at)) return { ok: false, reason: '--at is <path:line>, got ' + (at || 'nothing') };
    if (!/^[0-9a-f]{4,40}$/.test(sha)) return { ok: false, reason: 'no sha to stamp: is this a git repository?' };
    const entries = readEntries(file);
    if (entries.some((e) => e.fact === fact && e.at === at && e.sha === sha)) return { ok: true, added: false, dropped: 0, count: entries.length };
    const next = entries.filter((e) => !(e.fact === fact && e.at === at)).concat([{ fact, at, sha }]);
    const dropped = Math.max(0, next.length - CAP);
    const kept = next.slice(dropped);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, kept.map(lineOf).join('\n') + '\n');
    return { ok: true, added: true, dropped, count: kept.length };
}

// A sha is HEAD when either short form is a prefix of the other: git widens a
// short sha as the repository grows, and the same commit reads 7 or 9 long.
function show(file, head) {
    const h = String(head || '');
    return readEntries(file).map((e) => lineOf(e) + (h && (e.sha.startsWith(h) || h.startsWith(e.sha)) ? '' : ' (舊)'));
}

function headOf(dir) {
    try {
        return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch (e) {
        return '';
    }
}

function main(argv) {
    let parsed;
    try {
        parsed = parseArgs({ args: argv, allowPositionals: true, strict: true, options: {
            at: { type: 'string' }, session: { type: 'string' }, root: { type: 'string' },
        } });
    } catch (e) {
        return { text: 'context: ' + e.message, code: 2 };
    }
    const { values, positionals } = parsed;
    const usage = 'usage: context.js add "<fact>" --at <path:line> --session <id> | show --session <id>';
    if (!values.session) return { text: 'context: --session <id> is required. ' + usage, code: 2 };
    const root = registry.resolveRoot(values.root);
    const mine = registry.readSession(root, values.session);
    const file = mine ? contextPath(root, mine) : null;
    if (!file) return { text: 'context: no task with a readable start for session ' + values.session + ' under ' + root, code: 2 };
    const project = projectRootsFor(root, mine.project ? [mine.project] : [])[0] || root;
    if (positionals[0] === 'add') {
        const r = add(file, { fact: positionals.slice(1).join(' '), at: values.at, sha: headOf(project) });
        if (!r.ok) return { text: 'context: ' + r.reason + '. ' + usage, code: 2 };
        return { text: 'context: ' + (r.added ? 'added' : 'already there') + ' (' + r.count + '/' + CAP + (r.dropped ? ', oldest dropped' : '') + ') ' + file, code: 0 };
    }
    if (positionals[0] === 'show') {
        const lines = show(file, headOf(project));
        return { text: lines.length ? lines.join('\n') : 'context: none yet — ' + file, code: 0 };
    }
    return { text: 'context: ' + usage, code: 2 };
}

if (require.main === module) {
    const r = main(process.argv.slice(2));
    process.stdout.write(r.text + '\n');
    process.exit(r.code);
}

module.exports = { add, show, readEntries, main, CAP };
```

- [ ] **Step 5: The brief line.** In `lib/render.js`, change the handoff import to `const { handoffPath, commitPath, answerPath, contextPath, readsOf, previousHandoff } = require('./handoff.js');`, and in `renderBrief`, right after the `lines.push('  - The project map is at .fankeel/map.md …')` line, add:

```js
    // The task's verified facts, by path only: a subagent that needs one reads
    // the file, and one that does not pays nothing for it.
    const ctxFile = contextPath(root, data);
    if (ctxFile) lines.push('  - context: ' + ctxFile + ' — facts already verified in this task; read it before re-reading code, add one with `node ' + PLUGIN_ROOT + '/scripts/context.js add`.');
```

- [ ] **Step 6: The page.** In `docs/subagents.md`, after the section `### What a stage agent is told to read, and what it may write`, add:

```md
### The task's context.md

`.fankeel/build/task-<started>/context.md` (`contextPath` in `lib/handoff.js`)
holds what a subagent verified, one fact a line: the fact, `path:line`, and the
short sha it was read at. `scripts/context.js add "<fact>" --at <path:line>
--session <id>` is the only writer — any subagent may call it — and keeps the
newest 40, dropping an exact duplicate and replacing a fact read again at a
new sha. `context.js show` marks a line whose sha is not HEAD `(舊)`. The
ordinary brief names the file's path and never its contents, where the
`reads:` block above is copied inline; whether that saves anything is
measured, not assumed — `docs/reports/2026-09-26-context-md.md`.
```

- [ ] **Step 7: Run and watch them pass:** `git add scripts/context.js tests/context-md.test.js && node --test tests/context-md.test.js tests/brief.test.js tests/handoff.test.js tests/source.test.js`. The brief must stay under 1400 characters (`tests/brief.test.js:148`); if it does not, shorten the line's wording, never the cap.
- [ ] **Step 8: Commit** — `feat: context.md, the task's exchange of verified facts, named by path in the brief`.

## Task 5: the page hands a gate back to the terminal

**Files:**
- Modify: `lib/handoff.js` — `handedOffSince(file, since)`; `readPending` carries `at`
- Modify: `hooks/gate.js` — the wait ends on a hand-off
- Modify: `scripts/station.js` — `POST /answer` takes `handoff=terminal`
- Test: `tests/gate.test.js`
- Test: `tests/station-answer.test.js`

**Interfaces:**
- Consumes: none
- Produces: `handedOffSince(file, since) -> boolean` in `lib/handoff.js`; `readPending` returns `{ questions, until, at }`; `POST /answer` with the form field `handoff=terminal` writes `{ "handoff": "terminal" }` to the answer file (201), 400 for any other value, 409 with no held gate

**Dispatch:** implementer, sonnet — the plan carries the code; one predicate, one loop line, one route branch.

- [ ] **Step 1: Write the failing tests.** Append to `tests/gate.test.js`:

```js
// 「交給終端／手機」 on the page: the hook stops waiting at once and the
// question goes to the terminal, where Remote Control already carries it.
test('gate.station: a hand-off the page writes ends the wait at once, and the question goes to the terminal', async () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { stage: 'design', started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-cfg-') });
  stationOn(root, 30);
  const pending = path.join(taskDir(root), 'design-pending.json');
  const answer = path.join(taskDir(root), 'design-answer.md');
  const started = Date.now();
  const done = runAsync(GATE, root, { tool_input: askOf(QUESTIONS) });
  for (let i = 0; i < 50 && !fs.existsSync(pending); i++) await new Promise((r) => setTimeout(r, 100));
  assert.ok(fs.existsSync(pending), 'the hook never wrote the pending file');
  fs.writeFileSync(answer, JSON.stringify({ handoff: 'terminal' }) + '\n');
  const out = await done;
  assert.equal(out.trim(), '', 'a hand-off is not an answer');
  assert.ok(Date.now() - started < 15000, 'the hook waited out its 30 s instead of stopping');
  assert.equal(fs.existsSync(pending), false, 'the pending file outlived the wait');
});
```

Append to `tests/station-answer.test.js`:

```js
test('POST /answer with handoff=terminal writes the hand-off the hook stops on, and only while a gate is held', async () => {
    const f = fixture(Date.now() + 60e3);
    assert.equal(typeof served(f).pending.at, 'number', 'the page needs when the wait began to draw the countdown');
    const { serve } = require('../scripts/station.js');
    const s = await serve({ configDir: f.cfg, roots: [f.r1], port: 0, idleMs: 60e3, open: false });
    try {
        const data = await request(s.url + 'station/station-data.js');
        const nonce = /"nonce":"([^"]+)"/.exec(data.text)[1];
        const post = (o) => request(s.url + 'answer', new URLSearchParams(Object.assign({ nonce, root: f.r1, id: SID }, o)).toString());
        const file = answerPath(f.r1, f.data, 'build');
        assert.equal((await post({ handoff: 'phone' })).status, 400, 'terminal is the one hand-off there is');
        assert.equal(fs.existsSync(file), false);
        const ok = await post({ handoff: 'terminal' });
        assert.equal(ok.status, 201);
        assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { handoff: 'terminal' });
        fs.unlinkSync(pendingPath(f.r1, f.data, 'build'));
        assert.equal((await post({ handoff: 'terminal' })).status, 409, 'no gate is held any more');
    } finally {
        s.close();
    }
});
```

- [ ] **Step 2: Run and watch them fail:** `node --test tests/gate.test.js tests/station-answer.test.js` — the gate test waits the full 30 s and fails its timing assertion; the route writes nothing for `handoff`.
- [ ] **Step 3: The predicate and `at`.** In `lib/handoff.js`, in `readPending`, change the return to `return { questions: got.questions, until: got.until, at: Number.isFinite(got.at) ? got.at : null };`, and after `answersSince` add, exporting `handedOffSince`:

```js
// The page's 「交給終端／手機」: `{ "handoff": "terminal" }` written to the
// answer file after `since`. hooks/gate.js stops waiting on it, and the
// question reaches the terminal as it would on a timeout.
function handedOffSince(file, since) {
    const at = mtimeOf(file);
    if (at === null || at <= since) return false;
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8')).handoff === 'terminal';
    } catch (e) {
        return false;
    }
}
```

- [ ] **Step 4: The wait.** In `hooks/gate.js`, add `handedOffSince` to the names it takes from handoff.js, and in `stationAnswers`'s loop replace `if (got) return got;` with:

```js
            if (got) return got;
            if (handedOffSince(answer, since)) return null;
```

- [ ] **Step 5: The route.** In `scripts/station.js`, in the `POST /answer` branch, right after the `if (!pending) { fail(409, …); return; }` block, add:

```js
            // 「交給終端／手機」: not an answer. The hook stops waiting and the
            // question goes to the terminal, where Remote Control carries it.
            const hand = form.get('handoff');
            if (hand !== null) {
                if (hand !== 'terminal') {
                    fail(400, 'handoff is terminal');
                    return;
                }
                handoff.writeAnswer(handoff.answerPath(reg.root, mine, mine.stage), JSON.stringify({ handoff: 'terminal' }) + '\n');
                res.writeHead(201, { 'content-type': 'text/plain; charset=utf-8' });
                res.end('handed to the terminal\n');
                return;
            }
```

- [ ] **Step 6: Run and watch them pass:** `node --test tests/gate.test.js tests/station-answer.test.js tests/handoff.test.js`.
- [ ] **Step 7: Commit** — `feat: the page can hand a held gate back to the terminal at once`.

## Task 6: profile — `design.mockup: auto` and `design.skill` as a list

**Files:**
- Modify: `lib/profile.js` — `auto`; `parseDesignSkill`; `mockupClause` for a list and for `auto`
- Test: `tests/profile.test.js`

**Interfaces:**
- Consumes: none
- Produces: `KEYS['design.mockup'].values` = `['false', 'auto', 'sonnet', 'opus', 'fable']`; `parseValue('design.skill', raw)` returns `{ value: string[] }` in `KEYS['design.skill'].values` order, a string read as a comma list; `mockupClause(values) -> string`

**Dispatch:** implementer, sonnet — the plan carries the code; a schema change and its tests.

- [ ] **Step 1: Write the failing tests.** Append to `tests/profile.test.js`:

```js
// docs/plans/2026-09-26-ready-five-design.md §3: both refused before this.
test('design.mockup takes auto, and design.skill takes a list — a string still reads as a list of one', () => {
    assert.deepEqual(profile.parseValue('design.mockup', 'auto'), { value: 'auto' });
    assert.deepEqual(profile.parseValue('design.skill', ['impeccable:impeccable', 'frontend-design:frontend-design']),
        { value: ['frontend-design:frontend-design', 'impeccable:impeccable'] });
    assert.deepEqual(profile.parseValue('design.skill', 'impeccable:impeccable'), { value: ['impeccable:impeccable'] });
    assert.deepEqual(profile.parseValue('design.skill', 'impeccable:impeccable,taste-skill:soft-skill'),
        { value: ['taste-skill:soft-skill', 'impeccable:impeccable'] });
    assert.match(profile.parseValue('design.skill', ['impeccable:impeccable', 'nope:nope']).error, /^design\.skill is one or more of: /);
    assert.match(profile.parseValue('design.skill', []).error, /^design\.skill is one or more of: /);
    const d = dir();
    const cfg = path.join(d, 'cfg');
    fs.mkdirSync(path.join(d, '.fankeel'), { recursive: true });
    fs.writeFileSync(profile.projectFile(d), JSON.stringify({ 'design.mockup': 'auto', 'design.skill': ['impeccable:impeccable', 'frontend-design:frontend-design'] }));
    const got = profile.read(d, cfg);
    assert.equal(got.values['design.mockup'], 'auto');
    assert.deepEqual(got.values['design.skill'], ['frontend-design:frontend-design', 'impeccable:impeccable']);
});

test('the mockup clause names every listed skill, and auto says it draws unasked and opens the page', () => {
    assert.equal(profile.mockupClause({ 'design.skill': ['frontend-design:frontend-design', 'impeccable:impeccable'] }),
        'naming `frontend-design:frontend-design`, `impeccable:impeccable`, under `.fankeel/build/`, path on `spec:`.');
    assert.equal(profile.mockupClause({ 'design.mockup': 'auto' }),
        'front-end work only, unasked, then `tune.js serve` opened in the browser; under `.fankeel/build/`, path on `spec:`.');
    assert.equal(profile.mockupClause({}), 'under `.fankeel/build/`, path on `spec:` — the gate approves the page, not the paragraph.');
});
```

In the existing test `design.skill is one of the six design skills; unset carries no source` (`tests/profile.test.js:123`), change `assert.equal(on.values['design.skill'], 'frontend-design:frontend-design');` to `assert.deepEqual(on.values['design.skill'], ['frontend-design:frontend-design']);`.

- [ ] **Step 2: Run and watch them fail:** `node --test tests/profile.test.js`.
- [ ] **Step 3: The schema.** In `lib/profile.js`, replace the two `KEYS` rows:

```js
    'design.mockup': { values: ['false', 'auto', 'sonnet', 'opus', 'fable'], builtin: false, desc: '有前端的專案，design 站先做頁面時用哪個模型；auto 前端工作不問就畫、畫完開頁面；false 不做' },
    'design.skill': { values: ['taste-skill:taste-skill', 'taste-skill:soft-skill', 'taste-skill:minimalist-skill', 'frontend-design:frontend-design', 'ui-ux-pro-max:ui-ux-pro-max', 'impeccable:impeccable'], builtin: null, desc: 'mockup 另外載入哪些 design skill，可多選（逗號分隔）；fankeel 指南一律載入' },
```

After `parseGateStation` in `lib/profile.js`, add:

```js
// `design.skill`: one or more of its values, as an array or a comma list, kept
// in `values` order so two profiles naming the same set compare equal. A
// single string is a list of one — every profile written before this.
function parseDesignSkill(raw) {
    const allowed = KEYS['design.skill'].values;
    const list = Array.isArray(raw) ? raw : String(raw).split(',');
    const names = list.map((n) => String(n).trim().toLowerCase()).filter(Boolean);
    if (!names.length || names.some((n) => !allowed.includes(n))) return { error: 'design.skill is one or more of: ' + allowed.join(', ') };
    return { value: allowed.filter((n) => names.includes(n)) };
}
```

and in `parseValue`, after the `gate.station` line, add `if (key === 'design.skill') return parseDesignSkill(raw);`.

- [ ] **Step 4: The clause.** Replace `mockupClause` in `lib/profile.js`:

```js
// The clause `design.mockup`'s `when` rule fills with a token. Never falsy —
// `substitute` skips a falsy value and would ship the raw token — so the
// unset branch is spelled out in full, byte-for-byte what the rule read
// before `design.skill` existed. `auto` leads with what it changes: no
// question before drawing, and the tune page opened after.
function mockupClause(values) {
    const raw = values && values['design.skill'];
    const skills = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const auto = Boolean(values) && values['design.mockup'] === 'auto';
    const head = auto ? 'front-end work only, unasked, then `tune.js serve` opened in the browser; ' : '';
    if (skills.length) return head + 'naming ' + skills.map((s) => '`' + s + '`').join(', ') + ', under `.fankeel/build/`, path on `spec:`.';
    if (auto) return head + 'under `.fankeel/build/`, path on `spec:`.';
    return 'under `.fankeel/build/`, path on `spec:` — the gate approves the page, not the paragraph.';
}
```

- [ ] **Step 5: Run and watch them pass:** `node --test tests/profile.test.js tests/render.test.js tests/stages.test.js tests/brief.test.js tests/station.test.js` — the rule it fills sits near `BLOCK_CAP`; a cap failure is fixed by shortening the `auto` clause, never the cap.
- [ ] **Step 6: Commit** — `feat: design.mockup auto, and design.skill as a list`.

## Task 7: design-guide.md, and the mockup agent reads it first

**Files:**
- Modify: `skills/fankeel-design/design-guide.md` — new: fankeel's one-page design rules
- Modify: `agents/fankeel-mockup.md` — the guide first, then every named skill
- Modify: `skills/fankeel-design/SKILL.md` — step 3: the guide, a list of skills, `auto`
- Test: `tests/design-guide.test.js`
- Read: `lib/profile.js` — the six `design.skill` values and `auto`
- Read: `assets/station/station.css` — what fankeel's own station already does
- Read: `C:/Users/Owner/.claude/plugins/cache/taste-skill/taste-skill/1.0.0/skills/taste-skill/SKILL.md` — installed (also `soft-skill`, `minimalist-skill` beside it)
- Read: `C:/Users/Owner/.claude/plugins/cache/claude-code-plugins/frontend-design/1.1.0/skills/frontend-design/SKILL.md` — installed
- Read: `C:/Users/Owner/.claude/plugins/cache/ui-ux-pro-max-skill/ui-ux-pro-max/2.13.0/.claude/skills/ui-ux-pro-max/SKILL.md` — installed
- Read: `C:/Users/Owner/.claude/plugins/cache/impeccable/impeccable/4.4.0/skills/impeccable/SKILL.md` — installed, the newer of 4.3.1 and 4.4.0

**Interfaces:**
- Consumes: `design.mockup` value `auto` and `design.skill` as a list, from Task 6
- Produces: `skills/fankeel-design/design-guide.md`

**Dispatch:** implementer, opus — distilling four installed design skills into one page is a design judgement, and the rules themselves are not in this plan.

All four skills are installed on this machine (paths above, checked 2026-09-26). If one is gone when this runs, write the guide from the others and say which was missing in the guide's frontmatter and the report.

- [ ] **Step 1: Write the failing test** `tests/design-guide.test.js`:

```js
'use strict';
// skills/fankeel-design/design-guide.md: fankeel's own design rules, one
// page, read by every mockup before any design skill a prompt names.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const GUIDE = path.join(ROOT, 'skills', 'fankeel-design', 'design-guide.md');

test('the guide is one page, with its six sections, and names the four skills it is distilled from', () => {
    const text = fs.readFileSync(GUIDE, 'utf8');
    const lines = text.split('\n').length;
    assert.ok(lines <= 150, 'the guide is ' + lines + ' lines; one page is 150');
    for (const h of ['## Direction', '## Type', '## Colour', '## Space and layout', '## Motion', '## Never']) {
        assert.ok(text.includes('\n' + h + '\n'), 'no ' + h + ' section');
    }
    for (const s of ['taste-skill', 'frontend-design', 'ui-ux-pro-max', 'impeccable']) assert.ok(text.includes(s), 'the guide does not name ' + s);
    assert.match(text, /prefers-reduced-motion/);
});

test('the mockup agent reads the guide first, and the design skill takes a list and auto', () => {
    const agent = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-mockup.md'), 'utf8');
    assert.match(agent, /skills\/fankeel-design\/design-guide\.md/);
    assert.doesNotMatch(agent.replace(/\s+/g, ' '), /a prompt that names none is a prompt to say so/);
    const design = fs.readFileSync(path.join(ROOT, 'skills', 'fankeel-design', 'SKILL.md'), 'utf8').replace(/\s+/g, ' ');
    assert.match(design, /\[design-guide\.md\]\(design-guide\.md\)/);
    assert.match(design, /`design\.mockup: auto`/);
    assert.match(design, /`design\.skill` is a list/);
});
```

- [ ] **Step 2: Run and watch it fail:** `node --test tests/design-guide.test.js`.
- [ ] **Step 3: Distil the guide.** Read the four installed skills in full. Write `skills/fankeel-design/design-guide.md` in this shape — frontmatter, six sections, each rule one line ending with its source tag, at most 150 lines, English, no paths into the plugin cache (the page is shipped to other machines):

```md
---
status: current
last_verified: 2026-09-26
source_of_truth: distilled on 2026-09-26 from taste-skill 1.0.0 (taste-skill, soft-skill, minimalist-skill), frontend-design 1.1.0, ui-ux-pro-max 2.13.0 and impeccable 4.4.0, as installed; no file in this repository is its upstream
---

# fankeel design guide

Read by every mockup `fankeel-mockup` draws, before any design skill the
prompt names; a named skill is more specific and wins where it disagrees,
and the mockup says so in one line. Each rule ends with where it came from:
[taste], [frontend-design], [ui-ux-pro-max], [impeccable], or [all] where
every one of them says it.

## Direction
## Type
## Colour
## Space and layout
## Motion
## Never
```

Under each heading, the rules the four agree on first, then the ones only one makes that fankeel's own station already follows (read `assets/station/station.css` for what that is). `## Motion` states that every animation rests under `prefers-reduced-motion`. `## Never` holds the anti-patterns the four name — the templated defaults they each warn against.

- [ ] **Step 4: The agent.** In `agents/fankeel-mockup.md`, change the frontmatter `description`'s sentence `Loads the design skill the prompt names before drawing.` to `Reads fankeel's design guide, then loads every design skill the prompt names, before drawing.`, and replace the first paragraph under `## Before drawing` with:

```md
Read `<plugin>/skills/fankeel-design/design-guide.md` first — fankeel's own
design rules, one page, the floor every mockup stands on; `<plugin>` is the
root the `scripts/render.js` below sits under. Then load, with the `Skill`
tool, each design skill the prompt names, in the order named, and follow them
where they are more specific than the guide. Where one contradicts the guide,
the named skill wins for this page — say so in one line of the return. A
prompt that names no skill is the guide alone: draw from it, and do not pick
a skill yourself.
```

- [ ] **Step 5: The design skill.** In `skills/fankeel-design/SKILL.md`, step `### 3. The mockup — frontend work only`, replace the sentences from `Name one installed design skill in the prompt` through `by the session dispatching it.` with:

```md
Every mockup reads [design-guide.md](design-guide.md) — fankeel's own page
of design rules — before it draws; the agent file says so, and the prompt
need not. On top of it, name the installed design skills the agent should
load: every entry of `design.skill` when the profile sets it — the injected
mockup rule names them all; copy each one — and otherwise the ones you judge
fit, from `taste-skill:taste-skill`, `taste-skill:soft-skill`,
`taste-skill:minimalist-skill`, `frontend-design:frontend-design`,
`ui-ux-pro-max:ui-ux-pro-max` and `impeccable:impeccable`, or none: the guide
alone is a complete brief. **No profile value reaches a subagent**, so the
skills and the output path have to be written into the prompt by the session
dispatching it.
```

and in `skills/fankeel-design/SKILL.md` replace the paragraph that starts "`design.skill` can pin that choice" with:

```md
`design.skill` is a list, and a single name reads as a list of one.
**`design.mockup: auto`** takes the question out: when you judge the task to
be frontend work, dispatch the mockup without asking first, then run
`node <plugin>/scripts/tune.js serve <the mockup's directory>` and open the
url it prints in the browser (`start` on Windows, `open` on macOS,
`xdg-open` elsewhere). Work that puts nothing on a screen draws nothing,
whatever the value.
```

- [ ] **Step 6: Run and watch it pass:** `git add skills/fankeel-design/design-guide.md tests/design-guide.test.js && node --test tests/design-guide.test.js tests/agents.test.js tests/skills.test.js && node scripts/docs-check.js`.
- [ ] **Step 7: Commit** — `feat: fankeel's own design guide, read by every mockup before the skills it names`.

## Task 8: editing-pulse — the block tune is working on

**Files:**
- Modify: `scripts/tune.js` — `/__live/queue` lists what is being edited, with its round
- Modify: `assets/tune/overlay.js` — a pulsing ring with `編輯中 第 N 輪` on each, none under reduced motion
- Test: `tests/tune.test.js`
- Test: `tests/tune-overlay.test.js`
- Read: `.fankeel/build/2026-09-26-ready-five/mockup.html` — the `editing-pulse` block and its `.edp` rules

**Interfaces:**
- Consumes: none
- Produces: `GET /__live/queue` returns `{ pending, editing: [{ id, block, round }] }`

**Dispatch:** implementer, sonnet — the plan carries the code; one endpoint field and one overlay element.

- [ ] **Step 1: Write the failing tests.** Append to `tests/tune.test.js`:

```js
// docs/plans/2026-09-26-ready-five-design.md §3, editing-pulse: the overlay
// rings the block tune is working on, so the queue has to say which it is.
test('the queue names the block being edited and which round of it this is', async (t) => {
    const cwd = tmp('fankeel-tune-');
    fs.mkdirSync(path.join(cwd, 'site'));
    fs.writeFileSync(path.join(cwd, 'site', 'page.html'), PAGE);
    const base = await startServer(t, cwd);
    const queue = async () => JSON.parse((await request(base + '__live/queue', 'GET')).text);
    await request(base + '__live/request', 'POST', { page: '/page.html', block: 'now', note: 'one' });
    assert.deepEqual((await queue()).editing, [], 'queued is not being edited yet');
    spawnSync(process.execPath, [CLI, 'wait', '--timeout', '5'], { cwd, encoding: 'utf8' });
    assert.deepEqual((await queue()).editing, [{ id: 'r-0001', block: 'now', round: 1 }]);
    spawnSync(process.execPath, [CLI, 'done', 'r-0001'], { cwd, encoding: 'utf8' });
    await request(base + '__live/request', 'POST', { page: '/page.html', block: 'now', note: 'two' });
    spawnSync(process.execPath, [CLI, 'wait', '--timeout', '5'], { cwd, encoding: 'utf8' });
    assert.deepEqual((await queue()).editing, [{ id: 'r-0002', block: 'now', round: 2 }]);
});
```

Append to `tests/tune-overlay.test.js`:

```js
test('a block tune is editing carries a quiet pulse and its round, and none under reduced motion', () => {
    const text = fs.readFileSync(SRC, 'utf8');
    assert.match(text, /\.fk-live-edp\{[^}]*animation:fk-live-edp /);
    assert.match(text, /@media \(prefers-reduced-motion:reduce\)\{[^']*\.fk-live-edp\{animation:none/);
    assert.ok(text.includes('編輯中 第 '), 'the ring does not say which round');
    assert.match(text, /q\.editing/);
    assert.match(text, /setInterval\(refreshQueue, 2000\)/);
});
```

- [ ] **Step 2: Run and watch them fail:** `node --test tests/tune.test.js tests/tune-overlay.test.js`.
- [ ] **Step 3: The endpoint.** In `scripts/tune.js`, replace the `/__live/queue` branch with:

```js
        if (pathname === '/__live/queue') {
            const rows = requests();
            const pending = rows.filter((r) => r.status === 'queued' || r.status === 'taken').length;
            // What `wait` has handed out and `done` has not settled, with how
            // many times that block has been asked for so far — the round.
            const editing = rows.filter((r) => r.status === 'taken')
                .map((r) => ({ id: r.id, block: r.block, round: rows.filter((x) => x.block === r.block && x.id <= r.id).length }));
            return send(res, 200, TYPES['.json'], JSON.stringify({ pending, editing }));
        }
```

- [ ] **Step 4: The ring.** In `assets/tune/overlay.js`, add to the `CSS` array, before `'@keyframes fk-live-pulse…'`:

```js
        '.fk-live-edp{position:absolute;pointer-events:none;z-index:2147482998;border-radius:6px;box-shadow:0 0 0 1.5px #22b8cf,0 0 0 5px rgba(34,184,207,.18);animation:fk-live-edp 2.8s ease-in-out infinite}',
        '.fk-live-edp span{position:absolute;top:-9px;right:14px;padding:0 7px;font:600 11px/18px ui-monospace,Menlo,Consolas,monospace;color:#1d2026;background:#22b8cf;border-radius:4px}',
        '@keyframes fk-live-edp{0%,100%{opacity:.4}50%{opacity:1}}',
```

replace the reduced-motion line in `assets/tune/overlay.js` with:

```js
        '@media (prefers-reduced-motion:reduce){.fk-live-pill i{animation:none}.fk-live-flash{transition:none}.fk-live-edp{animation:none;opacity:.85}}',
```

and replace `refreshQueue` in `assets/tune/overlay.js` with:

```js
    // The queue count, and a ring on every block `tune.js wait` has handed out
    // and `done` has not settled — read every two seconds, because `wait`
    // runs in another process and says nothing to this page when it picks a
    // request up.
    var rings = [];
    function refreshQueue() {
        fetch('/__live/queue').then(function (res) { return res.json(); }).then(function (q) {
            queue.textContent = '佇列 ' + q.pending;
            rings.forEach(function (r) { r.remove(); });
            rings = (q.editing || []).map(function (job) {
                var target = find(job.block);
                if (!target) return null;
                var ring = el('div', 'fk-live-edp', '<span>編輯中 第 ' + job.round + ' 輪</span>');
                place(ring, target, 5);
                return ring;
            }).filter(Boolean);
        });
    }
    setInterval(refreshQueue, 2000);
```

- [ ] **Step 5: Run and watch them pass:** `node --test tests/tune.test.js tests/tune-overlay.test.js`.
- [ ] **Step 6: Commit** — `feat: tune rings the block it is editing, with the round, and rests under reduced motion`.

## Task 9: the floating icon — notifications and held gates in one place

**Files:**
- Modify: `assets/station/station.js` — `floatHtml`, `gateCountdownHtml`, `noteHtml`, `floatNotes`, `clock`; toasts, the tune chip and the session page's held-gate form removed
- Modify: `assets/station/station.css` — the float-icon and gate-countdown rules from the mockup; the toast and chip rules removed
- Modify: `assets/station/index.html` — one `<div class="fk" id="fk" data-block="float-icon"></div>`; `#toasts` and `#tunechip` gone
- Modify: `docs/station.md` — the two sections that describe the held gate and the toasts
- Modify: `tests/station-tune.test.js` — the toast and chip test becomes a note test
- Modify: `tests/station-live.test.js` — the hidden-tab test reads `#fk`
- Test: `tests/station-float.test.js`
- Read: `scripts/station.js` — `POST /answer`, `handoff=terminal`
- Read: `.fankeel/build/2026-09-26-ready-five/mockup.html` — blocks `float-icon`, `gate-countdown`, and their CSS in the page's `<style>`

**Interfaces:**
- Consumes: `handoff=terminal` and `readPending`'s `at`, from Task 5
- Produces: `floatHtml(sessions, notes, open, now, picked, permission) -> string`, `gateCountdownHtml(s, now, picked) -> string`, `noteHtml(n) -> string`, `floatNotes(sessions, notes) -> [{ id, block, status }]`, `clock(sec) -> 'm:ss'`, exported from `assets/station/station.js`; `toastHtml` and `tuneChipHtml` no longer exported

**Dispatch:** implementer, opus — three channels come out of a 4,654-line file whose redraw, click and poll paths all touch them, and the fake-DOM harness in `tests/station-live.test.js` has to keep working; the glue is reasoned in place, not transcribed.

- [ ] **Step 1: Write the failing test** `tests/station-float.test.js`:

```js
'use strict';
// The floating icon (docs/plans/2026-09-26-ready-five-design.md §3-§4): one
// place for notifications and held gates, replacing the toasts, the tune
// chip and the session page's own held-gate form.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

global.window = { STATION: { serve: true } };
const V = require('../assets/station/station.js');

const Q1 = [{ question: '往 plan 走嗎？', header: 'mockup', multiSelect: false, options: [
    { label: '可以', description: 'a' }, { label: '改一個 block', description: 'b' }, { label: '整個重畫', description: 'c' }] }];
const NOW = Date.UTC(2026, 8, 26, 1, 0, 0);
const held = (questions, left) => ({ id: 's1', root: '/r', project: 'fankeel', stage: 'design', task: 'Ready 五條',
    pending: { questions, at: NOW - (60 - left) * 1000, until: NOW + left * 1000 } });

test('a held single-choice gate is its options as buttons, a countdown, and 交給終端／手機', () => {
    const html = V.floatHtml([held(Q1, 44)], [], false, NOW, {}, 'granted');
    assert.match(html, /data-block="gate-countdown"/);
    for (let i = 0; i < 3; i++) assert.match(html, new RegExp('data-gop="' + i + '"'));
    assert.match(html, /<span class="gsec">0:44<\/span>/);
    assert.match(html, /style="width:73\.3%"/);
    assert.match(html, /data-gho>交給終端／手機</);
    assert.match(html, /<span class="fkn">1<\/span>/);
    assert.match(html, /aria-label="通知與 gate：1 件，1 個 gate 在等"/);
});

test('a gate of two questions, or a multi-select one, keeps the full form inside the panel', () => {
    const two = [Q1[0], { question: '哪些？', header: '範圍', multiSelect: true, options: [{ label: 'a', description: '' }, { label: 'b', description: '' }] }];
    const html = V.floatHtml([held(two, 30)], [], false, NOW, {}, 'granted');
    assert.match(html, /data-block="pending-gate"/);
    assert.doesNotMatch(html, /data-gop=/);
    assert.match(html, /data-gho/);
});

test('settled tune requests and a block being edited are notes; with nothing, the panel says so and the badge is empty', () => {
    const s = { id: 's2', root: '/r', tune: { open: 1, done: 3, rejected: 0, url: 'http://127.0.0.1:7819/',
        items: [{ id: 'r-0004', block: 'wizard-steps', status: 'taken' }] } };
    const html = V.floatHtml([s], [{ id: 'r-0003', block: 'dash-live', status: 'done' }], true, NOW, {}, 'default');
    assert.match(html, /class="nt edit"[\s\S]*編輯中：<code>wizard-steps<\/code>/);
    assert.match(html, /class="nt done"[\s\S]*已修改完成：<code>dash-live<\/code>/);
    assert.match(html, /tune 完成 <b>3<\/b>/);
    assert.match(html, />127\.0\.0\.1:7819</);
    assert.match(html, /data-tune-notify/);
    assert.match(html, /<span class="fkn">2<\/span>/);
    const none = V.floatHtml([], [], false, NOW, {}, 'granted');
    assert.match(none, /沒有新通知/);
    assert.match(none, /<span class="fkn"><\/span>/);
});

test('the page has one floating icon and no toast box, tune chip or session-page gate form left', () => {
    const page = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'index.html'), 'utf8');
    assert.match(page, /<div class="fk" id="fk" data-block="float-icon"><\/div>/);
    assert.doesNotMatch(page, /id="toasts"|id="tunechip"/);
    const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
    assert.doesNotMatch(src, /\+ pendingGateHtml\(s, view\.pg\)/, 'the session page still draws its own held gate');
    assert.equal(V.toastHtml, undefined);
    assert.equal(V.tuneChipHtml, undefined);
});
```

- [ ] **Step 2: Run and watch it fail:** `node --test tests/station-float.test.js`.
- [ ] **Step 3: The pure half.** In `assets/station/station.js`, replace `toastHtml` and `tuneChipHtml` (keep `toastText` — the browser notification still says it) with:

```js
    // The one place notifications and held gates appear (2026-09-26 design
    // §3): a button in the corner with the count, a panel with the gates
    // first. `notes` are the page's own — settled tune requests, newest first
    // — and what tune is editing right now is read off each session's queue.
    function floatNotes(sessions, notes) {
        var editing = [];
        (sessions || []).forEach(function (s) {
            ((s.tune && s.tune.items) || []).forEach(function (it) {
                if (it.status === 'taken') editing.push({ id: it.id, block: it.block, status: 'edit' });
            });
        });
        return editing.concat(notes || []);
    }
    function noteHtml(n) {
        var t = n.status === 'edit' ? ['edit', '<i></i>', '編輯中：', 'tune 正在改這個 block，頁面上有外框標出它。']
            : n.status === 'done' ? ['done', '✓', '已修改完成：', '改過的頁面由 tune 自己重新載入。']
                : ['rej', '✕', '沒有修改：', '要求超出這個 block，已退回。'];
        return '<div class="nt ' + t[0] + '" data-note="' + esc(n.id) + '"><span class="ti" aria-hidden="true">' + t[1] + '</span>'
            + '<span class="tt">' + t[2] + '<code>' + esc(n.block) + '</code></span>'
            + (n.status === 'edit' ? '' : '<button class="tx" type="button" data-note-x aria-label="關閉">×</button>')
            + '<span class="tb">' + t[3] + '</span></div>';
    }
    function clock(sec) { return Math.floor(sec / 60) + ':' + (sec % 60 < 10 ? '0' : '') + (sec % 60); }
    // A held gate of one single-choice question is answered by its options as
    // buttons; any other shape keeps the full form, `pendingGateHtml`. The
    // countdown runs from the hook's own `at` to `until`.
    function gateCountdownHtml(s, now, picked) {
        var p = s.pending, q = p.questions[0];
        var total = Math.max(1, Math.round((p.until - (isFinite(p.at) ? p.at : p.until - 60000)) / 1000));
        var left = Math.max(0, Math.min(total, Math.round((p.until - now) / 1000)));
        var body = p.questions.length === 1 && !q.multiSelect && S.serve
            ? '<p class="gq"><small>' + esc(q.header || '') + '</small>' + esc(q.question) + '</p><div class="gops" role="group" aria-label="回答">'
                + (q.options || []).map(function (o, i) {
                    return '<button type="button" class="gop" data-gop="' + i + '"><b>' + esc(o.label) + '</b><small>' + esc(o.description || '')
                        + '</small><kbd>' + (i + 1) + '</kbd></button>';
                }).join('') + '</div>'
            : pendingGateHtml(s, picked);
        return '<div class="gc" data-block="gate-countdown" data-pg-root="' + esc(s.root) + '" data-pg-id="' + esc(s.id) + '" data-until="' + p.until
            + '" data-total="' + total + '"><div class="gsrc"><span class="mono">' + esc(s.project || '') + '</span><i aria-hidden="true"></i><span class="mono">'
            + esc(s.stage || '') + '</span><span class="t">' + esc(s.task || '') + '</span></div>' + body
            + '<div class="gtm"><div class="gbar" aria-hidden="true"><i style="width:' + (left / total * 100).toFixed(1) + '%"></i></div>'
            + '<span class="gsec">' + clock(left) + '</span><small>時間到，問題回到 terminal 問</small></div>'
            + (S.serve ? '<button type="button" class="gho" data-gho>交給終端／手機</button>'
                + '<p class="ghs">網頁不再等，問題馬上在 terminal 問；Remote Control 在手機上也看得到。</p>' : '')
            + '<p class="gend" role="status" aria-live="polite"></p></div>';
    }
    var FK_BELL = '<svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'
        + '<path d="M5 8a5 5 0 0 1 10 0v4l1.5 2.5h-13L5 12z"/><path d="M8.2 16.5a2 2 0 0 0 3.6 0"/></svg>';
    function floatHtml(sessions, notes, open, now, picked, permission) {
        var held = (sessions || []).filter(function (s) { return s.pending && s.pending.questions && s.pending.questions.length; });
        var all = floatNotes(sessions, notes), n = held.length + all.length, tune = null, done = 0;
        (sessions || []).forEach(function (s) {
            if (!s.tune) return;
            done += s.tune.done;
            if (!tune && s.tune.url) tune = s.tune;
        });
        return '<section class="fkp" id="fkp" aria-label="通知與 gate"' + (open || held.length ? '' : ' hidden') + '>'
            + '<div class="fkh"><b>通知與 gate</b><span class="n">' + n + ' 件</span><span class="spacer"></span>'
            + (all.some(function (x) { return x.status !== 'edit'; }) ? '<button class="lk" type="button" data-note-clear>清掉通知</button>' : '') + '</div>'
            + (held.length ? '<div class="fks">等你回答 <b>' + held.length + '</b></div>'
                + held.map(function (s) { return gateCountdownHtml(s, now, picked); }).join('') : '')
            + '<div class="fks">通知 <b>' + all.length + '</b></div>' + all.map(noteHtml).join('')
            + (all.length ? '' : '<p class="fkempty">沒有新通知。</p>')
            + '<div class="fkf"><span>tune 完成 <b>' + done + '</b></span>'
            + (tune ? '<a href="' + esc(tune.url) + '" target="_blank" rel="noopener">' + esc(tune.url.replace(/^https?:\/\//, '').replace(/\/$/, '')) + '</a>' : '')
            + '<span class="spacer"></span>'
            + (permission === 'default' ? '<button type="button" class="btn" data-tune-notify>背景時通知我</button>' : '') + '</div></section>'
            + '<button type="button" class="fkb" data-fkb aria-expanded="' + Boolean(open || held.length) + '" aria-controls="fkp" aria-label="通知與 gate：' + n + ' 件'
            + (held.length ? '，' + held.length + ' 個 gate 在等' : '') + '">' + FK_BELL + '<span class="fkn">' + (n ? n : '') + '</span></button>';
    }
```

In the `module.exports` block, replace `toastHtml: toastHtml, toastText: toastText, tuneChipHtml: tuneChipHtml,` with `toastText: toastText, floatHtml: floatHtml, gateCountdownHtml: gateCountdownHtml, noteHtml: noteHtml, floatNotes: floatNotes, clock: clock,`.

- [ ] **Step 4: The glue** in `assets/station/station.js`'s page IIFE:
  - Add `notes: []` and `fkOpen: false` to the `view` object, and replace `drawChip()` with:

```js
    function drawFloat() {
        var fk = doc.getElementById('fk');
        if (!fk) return;
        var held = S.sessions.some(function (s) { return s.pending && s.pending.questions && s.pending.questions.length; });
        fk.innerHTML = floatHtml(S.sessions, view.notes, view.fkOpen, S.serve ? Date.now() : NOW, view.pg, w.Notification ? w.Notification.permission : 'denied');
        fk.className = 'fk' + (held ? ' hasgate' : '');
    }
```

  and rename every `drawChip()` call to `drawFloat()`.
  - In `tuneNotify` in `assets/station/station.js`, replace the toast append (`if (box) box.innerHTML += toastHtml(ev);` and the `var box = …` line) so each event is kept and drawn:

```js
    function tuneNotify(prev, next) {
        var evs = tuneEvents(prev, next);
        if (!evs.length) return;
        view.notes = evs.concat(view.notes).slice(0, 20);
        evs.forEach(function (ev) {
            if (doc.hidden && w.Notification && w.Notification.permission === 'granted') {
                try { new w.Notification(toastText(ev)); } catch (err) { /* the browser refused it */ }
            }
        });
        drawFloat();
    }
```

  - Remove `+ pendingGateHtml(s, view.pg)` from the session page (it was `station.js:2563`), and the `[data-toast-x]` click branch.
  - In the document click handler of `assets/station/station.js`, before the `[data-tune-notify]` branch, add:

```js
        if (e.target.closest('[data-fkb]')) { view.fkOpen = !view.fkOpen; drawFloat(); return; }
        var nx = e.target.closest('[data-note-x]');
        if (nx) {
            var nid = nx.closest('.nt').getAttribute('data-note');
            view.notes = view.notes.filter(function (x) { return x.id !== nid; });
            drawFloat();
            return;
        }
        if (e.target.closest('[data-note-clear]')) { view.notes = []; drawFloat(); return; }
        var gop = e.target.closest('[data-gop]');
        if (gop) {
            gatePost(gop.closest('.gc'), function (form, who) {
                var q = who.pending.questions[0], o = q.options[Number(gop.getAttribute('data-gop'))], a = {};
                a[q.question] = o.label;
                form.set('answers', JSON.stringify(a));
            }, '已送出：');
            return;
        }
        if (e.target.closest('[data-gho]')) {
            gatePost(e.target.closest('.gc'), function (form) { form.set('handoff', 'terminal'); }, '已交給終端：');
            return;
        }
```

  - Beside `pgSync` in `assets/station/station.js`, add the poster, the per-second countdown and the number keys:

```js
    // One POST /answer from the floating icon: an option, or the hand-off.
    function gatePost(gc, fill, said) {
        var who = S.sessions.filter(function (x) { return x.id === gc.getAttribute('data-pg-id'); })[0];
        var end = gc.querySelector('.gend');
        if (!who || !who.pending) return;
        var form = new URLSearchParams();
        form.set('nonce', S.nonce || '');
        form.set('root', gc.getAttribute('data-pg-root'));
        form.set('id', gc.getAttribute('data-pg-id'));
        fill(form, who);
        fetch('answer', { method: 'POST', body: form }).then(function (r) {
            return r.text().then(function (t) {
                end.className = 'gend ' + (r.ok ? 'ok' : 'bad');
                end.textContent = (r.ok ? said : r.status + ' — ') + t.trim();
            });
        }, function () {
            end.className = 'gend bad';
            end.textContent = '送不出去：serve 還在跑嗎？';
        });
    }
    // The countdown moves every second between re-reads.
    w.setInterval(function () {
        if (!doc.querySelectorAll) return;
        [].forEach.call(doc.querySelectorAll('#fk .gc[data-until]'), function (g) {
            var total = Number(g.getAttribute('data-total')) || 60;
            var left = Math.max(0, Math.round((Number(g.getAttribute('data-until')) - Date.now()) / 1000));
            var sec = g.querySelector('.gsec'), bar = g.querySelector('.gbar i');
            if (sec) sec.textContent = clock(left);
            if (bar) bar.style.width = (left / total * 100).toFixed(1) + '%';
        });
    }, 1000);
    // 1–4 pick an option of the first held gate, the <kbd> on each button.
    doc.addEventListener('keydown', function (e) {
        if (!/^[1-4]$/.test(e.key) || e.altKey || e.ctrlKey || e.metaKey) return;
        var t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
        var b = doc.querySelector && doc.querySelector('#fk .gc [data-gop="' + (Number(e.key) - 1) + '"]');
        if (b) { e.preventDefault(); b.click(); }
    });
```

- [ ] **Step 5: The shell and the styles.** In `assets/station/index.html`, delete `<span id="tunechip" hidden></span>` and `<div class="toasts" id="toasts" role="status" aria-live="polite"></div>`, and put `<div class="fk" id="fk" data-block="float-icon"></div>` where the toast box was. In `assets/station/station.css`, delete the `.toasts`, `.toast…` and `.tchip…` rules, and copy verbatim from the `<style>` of `.fankeel/build/2026-09-26-ready-five/mockup.html` every rule whose selector starts with `.fk`, `.gc`, `.gsrc`, `.gq`, `.gops`, `.gop`, `.gtm`, `.gbar`, `.gsec`, `.gho`, `.ghs`, `.gend`, `.nt` or `.fks`, with their `prefers-reduced-motion` counterparts. Keep only rules for classes `floatHtml` renders — `tests/station-shell.test.js:160` checks the other direction.
- [ ] **Step 6: The tests this changes.** In `tests/station-tune.test.js`, replace the test `the toast names the block; the chip counts and links the tune page` with one that asserts `V.noteHtml({ id: 'r-0001', block: 'wizard-step', status: 'done' })` matches `/class="nt done"[\s\S]*已修改完成：<code>wizard-step<\/code>/` and the `rejected` status matches `/class="nt rej"[\s\S]*沒有修改：<code>model-cost<\/code>/`. In `tests/station-live.test.js`, in the test `a hidden tab with a tune request in progress re-reads, and says when the block is done`, change `p.doc.getElementById('toasts').innerHTML` to `p.doc.getElementById('fk').innerHTML`.
- [ ] **Step 7: The page.** In `docs/station.md`, rewrite `## Answering a gate from the page` so the held gate is shown in the floating icon's panel as a countdown from the hook's `at` to `until` — one single-choice question as buttons 1–4, anything else as the full form with 其他 — with 「交給終端／手機」 posting `handoff=terminal` to `POST /answer`, which writes `{ "handoff": "terminal" }` and the hook stops waiting on at once (`handedOffSince` in `lib/handoff.js`); and rewrite the first paragraph of `## When a tuned block is done` so a settled request is a note in the same panel, a block `tune.js wait` handed out is a 編輯中 note, and the masthead chip and the toasts are gone.
- [ ] **Step 8: Run and watch them pass:** `git add tests/station-float.test.js && node --test tests/station-float.test.js tests/station-tune.test.js tests/station-live.test.js tests/station-answer.test.js tests/station-shell.test.js tests/station.test.js tests/source.test.js`.
- [ ] **Step 9: Commit** — `feat: one floating icon for notifications and held gates, with a countdown and a hand-off`.

## Task 10: the station repaints only what changed

**Files:**
- Modify: `assets/station/station.js` — `changedParts`, `partsOf`; `draw()` replaces only changed top-level blocks
- Modify: `docs/station.md` — the redraw paragraph
- Test: `tests/station-repaint.test.js`

**Interfaces:**
- Consumes: none
- Produces: `changedParts(was, now) -> number[] | null`, exported from `assets/station/station.js`

**Dispatch:** implementer, sonnet — the plan carries the code; one pure function and a guarded branch in `draw()`.

- [ ] **Step 1: Write the failing test** `tests/station-repaint.test.js`:

```js
'use strict';
// docs/plans/2026-09-26-ready-five-design.md §3: the station repaints only the
// sections whose markup changed, instead of the whole page every 3 s.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

global.window = { STATION: {} };
const V = require('../assets/station/station.js');

test('changedParts names only the blocks whose markup moved, and null when the page changed shape', () => {
    assert.deepEqual(V.changedParts(['<a>1</a>', '<b>2</b>', '<c>3</c>'], ['<a>1</a>', '<b>9</b>', '<c>3</c>']), [1]);
    assert.deepEqual(V.changedParts(['<a>1</a>'], ['<a>1</a>']), []);
    assert.equal(V.changedParts(['<a>1</a>'], ['<a>1</a>', '<b>2</b>']), null);
    assert.equal(V.changedParts(null, ['<a>1</a>']), null);
});

test('draw replaces only the changed blocks when the page keeps its shape, and falls back to a whole redraw', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
    const at = src.indexOf('    function draw() {');
    const draw = src.slice(at, at + 5000);
    assert.match(draw, /changedParts\(drawnParts, parts\)/);
    assert.match(draw, /replaceChild\(/);
    assert.match(draw, /p\.innerHTML = html;/);
});
```

- [ ] **Step 2: Run and watch it fail:** `node --test tests/station-repaint.test.js`.
- [ ] **Step 3: The pure half.** In `assets/station/station.js`, beside `pendingGateHtml`, add, and export `changedParts: changedParts`:

```js
    // Which of the page's top-level blocks a redraw has to replace: the
    // indices whose markup changed, or null when the list changed shape and
    // the page is drawn whole. `was` is what the last draw wrote, not what the
    // DOM holds now — a <details> the reader opened is the reader's.
    function changedParts(was, now) {
        if (!was || !now || was.length !== now.length) return null;
        var out = [];
        for (var i = 0; i < now.length; i++) if (was[i] !== now[i]) out.push(i);
        return out;
    }
```

- [ ] **Step 4: The glue.** In `assets/station/station.js`, next to `var drawnHash = null;`, add `var drawnParts = null;` and:

```js
    // The page's top-level elements as markup, or null where this document
    // cannot parse a fragment (the test harness's fake DOM) or the view put
    // bare text at the top level — both mean draw it whole.
    function partsOf(html) {
        var t = doc.createElement('template');
        if (!t || !t.content || !t.content.children) return null;
        t.innerHTML = html;
        var loose = [].some.call(t.content.childNodes, function (n) { return n.nodeType === 3 && n.textContent.trim(); });
        return loose ? null : [].map.call(t.content.children, function (c) { return c.outerHTML; });
    }
```

In `draw()` in `assets/station/station.js`, replace `p.innerHTML = (VIEWS[route.view] || dashPage)(route);` with:

```js
        var html = (VIEWS[route.view] || dashPage)(route);
        var parts = partsOf(html);
        var changed = samePage && parts ? changedParts(drawnParts, parts) : null;
        if (changed && p.children && p.children.length === parts.length) {
            changed.forEach(function (i) {
                var t = doc.createElement('template');
                t.innerHTML = parts[i];
                p.replaceChild(t.content.firstElementChild, p.children[i]);
            });
        } else {
            p.innerHTML = html;
        }
        drawnParts = parts;
```

- [ ] **Step 5: The page.** In `docs/station.md`, in the paragraph that starts "The second is that the served page keeps itself current", after "A redraw keeps which sections were open," insert: "A redraw on the same view replaces only the top-level blocks whose markup changed since the last draw (`changedParts`), so an unchanged section keeps its DOM, its scroll and its focus; a view that changed shape is drawn whole."
- [ ] **Step 6: Run and watch it pass:** `node --test tests/station-repaint.test.js tests/station-live.test.js tests/station-live-page.test.js tests/station.test.js`.
- [ ] **Step 7: Commit** — `feat: the station repaints only the blocks whose markup changed`.

## Task 11: the wizard — mockup auto, several skills, and the gate question

**Files:**
- Modify: `assets/station/station.js` — `WIZ_STEPS` `front` and `answer`; `wizFrontHtml`, `wizSkillHtml`, `wizText`, `wizApply` (`data-m`), `wizCards` (suggested value); per-step `data-block`
- Modify: `assets/station/station.css` — the `.fq`, `.fqc`, `.fbar.solo`, `.fmul`, `.fskt`, `.fsk.lock`, `.fsk.mul` rules from the mockup
- Modify: `TODO.md` — the 〔design〕 and 〔gate〕 Ready lines go
- Test: `tests/station-wizard.test.js`
- Read: `lib/profile.js` — `design.mockup` values with `auto`; `design.skill` as a list
- Read: `.fankeel/build/2026-09-26-ready-five/mockup.html` — blocks `wizard-design`, `wizard-gate-station`, and the two scene `<svg>` in the latter

**Interfaces:**
- Consumes: `parseDesignSkill` and the `auto` value, from Task 6
- Produces: the wizard posts `design.skill` as `a,b` and `design.mockup` as `auto`; `data-block="wizard-design"` and `data-block="wizard-gate-station"`

**Dispatch:** implementer, sonnet — the plan carries the code; string rendering over the existing wizard state.

- [ ] **Step 1: Write the failing tests.** Append to `tests/station-wizard.test.js`:

```js
// docs/plans/2026-09-26-ready-five-design.md §3-§4, mockup blocks
// wizard-design and wizard-gate-station.
test('step 3 lays out false, three models and auto, and design.skill is several chips with the guide always in', () => {
    let W = load();
    W = V.wizApply(W, KEYS, PROFILES, { go: '2' });
    const html = V.wizHtml(KEYS, W, PROFILES, CTX);
    assert.match(html, /data-block="wizard-design"/);
    for (const o of ['false', 'sonnet', 'opus', 'fable', 'auto']) {
        assert.match(html, new RegExp('class="fsg[^"]*" role="radio" aria-checked="(true|false)" tabindex="-?\\d" data-h="\\d"><b>' + o));
    }
    assert.match(html, /class="fsk lock" aria-pressed="true" aria-disabled="true"/);
    W = V.wizApply(W, KEYS, PROFILES, { h: '4' });
    assert.equal(W.val['design.mockup'], 'auto');
    W = V.wizApply(W, KEYS, PROFILES, { k: 'design.skill', m: 'impeccable:impeccable' });
    W = V.wizApply(W, KEYS, PROFILES, { k: 'design.skill', m: 'frontend-design:frontend-design' });
    assert.equal(W.val['design.skill'], 'frontend-design:frontend-design,impeccable:impeccable');
    assert.deepEqual(V.wizChanges(KEYS, W, PROFILES).filter((c) => c.key === 'design.skill'),
        [{ key: 'design.skill', value: 'frontend-design:frontend-design,impeccable:impeccable' }]);
    W = V.wizApply(W, KEYS, PROFILES, { k: 'design.skill', m: 'impeccable:impeccable' });
    assert.equal(W.val['design.skill'], 'frontend-design:frontend-design');
    W = V.wizApply(W, KEYS, PROFILES, { k: 'design.skill', m: 'frontend-design:frontend-design' });
    assert.equal(W.val['design.skill'], null);
});

test('a design.skill list the profile already holds loads as the chips it names', () => {
    const P = JSON.parse(JSON.stringify(PROFILES));
    P.projects[APP].values['design.skill'] = ['frontend-design:frontend-design', 'impeccable:impeccable'];
    P.projects[APP].sources['design.skill'] = 'project';
    const W = V.wizLoad(P, KEYS, APP);
    assert.equal(W.val['design.skill'], 'frontend-design:frontend-design,impeccable:impeccable');
    W.step = 2;
    assert.match(V.wizHtml(KEYS, W, P, CTX), /data-m="impeccable:impeccable" aria-pressed="true"/);
});

test('the 答 gate step is two cards, 60 s suggested and off still the default', () => {
    const W = load();
    W.step = V.WIZ_STEPS.findIndex((s) => s.id === 'answer');
    const html = V.wizHtml(KEYS, W, PROFILES, CTX);
    assert.match(html, /data-block="wizard-gate-station"/);
    assert.match(html, /class="ch" data-k="gate\.station" data-o="60" aria-pressed="false"><span class="rec">建議<\/span>/);
    assert.match(html, /class="ch" data-k="gate\.station" data-o="off" aria-pressed="true">/);
    assert.equal(W.val['gate.station'], 'off');
});
```

In the existing test `step 3 offers design.skill only while design.mockup is on`, change `data-o="impeccable:impeccable"` to `data-m="impeccable:impeccable"`; in `each option is a card carrying data-k and data-o, with a scene on the five animated keys`, add `gate.station` to the keys it expects a scene on.

- [ ] **Step 2: Run and watch them fail:** `node --test tests/station-wizard.test.js`.
- [ ] **Step 3: The steps.** In `assets/station/station.js`, in `WIZ_STEPS`, give `front` `q: '這個專案的前端，mockup 要怎麼畫？'`, `sub: '有前端的話，design 站會先畫一頁 mockup 給你看，再談實作。'` and a fifth habit `{ l: '有，自動畫', b: '前端工作不問就畫，畫完直接開頁面。', s: { 'design.mockup': 'auto' } }`; give `answer` `q: '要不要在網頁上直接回答 gate？'` and `sub: 'gate 發出後，先在這頁右下角的圖示裡等你 60 秒；逾時，或你按「交給終端／手機」，問題就回到 terminal，Remote Control 也看得到。等的時候 terminal 不顯示問題。'`. Beside `WIZ_CARD_VALUES`, add:

```js
    // gate.station as the mockup draws it: two cards, 60 s suggested whatever
    // the habit pills pre-picked, and off the builtin.
    WIZ_CARD_VALUES['gate.station'] = ['60', 'off'];
    WIZ_CARD_TEXT['gate.station'] = { '60': { l: '等 60 秒', d: '人在頁面旁邊時，點一下就答完。' }, off: { l: '不用，在 terminal 答', d: 'gate 直接在 terminal 問，網頁不接。' } };
    var WIZ_SUGGEST = { 'gate.station': '60' };
    // The card a step is drawn in, named the way the approved mockup names it.
    var WIZ_BLOCK = { front: 'wizard-design', answer: 'wizard-gate-station' };
```

Add `WIZ_SCENES['gate.station'] = { '60': '<svg …>', off: '<svg …>' }` with the two `<svg>` elements copied verbatim from the `.wstg` spans of the `wizard-gate-station` block in the mockup. In `wizCards`, replace the `建議` expression `(hasRec && wizSame(r, o) ? '<span class="rec">建議</span>' : '')` with `(wizSame(WIZ_SUGGEST[k] !== undefined ? WIZ_SUGGEST[k] : (hasRec ? r : undefined), o) ? '<span class="rec">建議</span>' : '')`. In both `wizStepHtml` branches, replace `data-block="wizard-step"` with `data-block="' + (WIZ_BLOCK[st.id] || 'wizard-step') + '"`.

- [ ] **Step 4: A list in the wizard's text form.** In `assets/station/station.js`, replace `wizText` and change its two callers in `wizOwn` and `wizBelow` to pass `k` (`wizText(p.values[k], k)`, `wizText(m.values[k], k)`):

```js
    function wizText(v, k) {
        if (v === undefined || v === null) return null;
        if (!Array.isArray(v)) return String(v);
        return k === 'stage.agents' ? wizNorm(v) : v.join(',');
    }
```

and in `wizApply` in `assets/station/station.js`, before the `if (d.st !== undefined)` branch, add:

```js
        // A design.skill chip toggles one skill in or out; the list keeps the
        // key's own order, and none at all is unset (fankeel's guide alone).
        if (d.m !== undefined) {
            var have = W.val[d.k] ? String(W.val[d.k]).split(',') : [], at = have.indexOf(d.m);
            if (at >= 0) have.splice(at, 1); else have.push(d.m);
            var order = keys[d.k] ? keys[d.k].values : have;
            have = order.filter(function (o) { return have.indexOf(o) >= 0; });
            W.val[d.k] = have.length ? have.join(',') : null;
            return W;
        }
```

- [ ] **Step 5: Step 3's layout.** Replace `wizFrontHtml` and `wizSkillHtml` in `assets/station/station.js`:

```js
    var WIZ_FE_AUTO = { o: 'auto', h: 4, d: '直接畫，畫完開頁面' };
    var WIZ_FE_NONE = { o: 'false', h: 0, d: '沒有前端，不畫' };
    function wizFrontHtml(keys, W) {
        var v = W.val['design.mockup'], on = v !== null && v !== 'false';
        var seg = function (m) {
            var chk = v === m.o, bars = '';
            if (m.cost) for (var j = 0; j < 4; j++) bars += '<i' + (j < m.cost ? ' class="on"' : '') + '></i>';
            return '<button type="button" class="fsg' + (m.warn ? ' warn' : '') + '" role="radio" aria-checked="' + chk + '" tabindex="'
                + (chk || (v === null && m.o === 'opus') ? 0 : -1) + '" data-h="' + m.h + '"><b>' + m.o
                + (m.o === 'opus' ? '<span class="frc">建議</span>' : '') + '</b><span class="fsd">' + (m.warn ? WIZ_FE_WARN : '') + m.d + '</span>'
                + (m.cost ? '<span class="fcost" aria-hidden="true">' + bars + '</span>' : '') + '</button>';
        };
        return '<h2 class="q">這個專案的前端，mockup 要怎麼畫？</h2><p class="wqs">有前端的話，design 站會先畫一頁 mockup 給你看，再談實作。</p>'
            + '<div class="fem"><div class="fmh"><span class="fml">誰來畫</span><code>design.mockup</code></div>'
            + '<div class="fq" role="radiogroup" aria-label="design.mockup">'
            + '<div class="fqc none" aria-hidden="true"></div><div class="fqc" aria-hidden="true"><span>畫之前先問你</span></div>'
            + '<div class="fqc" aria-hidden="true"><span>不問</span></div>'
            + '<div class="fbar solo">' + seg(WIZ_FE_NONE) + '</div>'
            + '<div class="fbar">' + WIZ_FE_MODELS.map(seg).join('') + '</div>'
            + '<div class="fbar solo">' + seg(WIZ_FE_AUTO) + '</div></div>'
            + (on ? wizSkillHtml(keys, W) : '') + '</div>';
    }
    // design.skill: fankeel's guide always in, then any of the six on top,
    // grouped by the plugin before the colon. Each chip toggles one (`data-m`).
    function wizSkillHtml(keys, W) {
        var v = W.val['design.skill'], on = v ? String(v).split(',') : [], groups = [], by = {};
        (keys['design.skill'] ? keys['design.skill'].values : []).forEach(function (o) {
            var i = o.indexOf(':'), pl = i > 0 ? o.slice(0, i) : o;
            if (!by[pl]) { by[pl] = []; groups.push(pl); }
            by[pl].push(o);
        });
        return '<div class="fskw"><div class="fmh"><span class="fml">設計 skill</span><code>design.skill</code><span class="fmul">可多選</span>'
            + '<span class="fskt">指南' + (on.length ? ' + ' + on.length + ' 個' : '') + '</span></div>'
            + '<p class="fskn">fankeel 指南一律載入；另外勾的 skill，會一起交給畫 mockup 的 agent。</p>'
            + '<div class="fskg" role="group" aria-label="design.skill">'
            + '<div class="fskc self"><span class="fskh">內建</span><span class="fskl"><button type="button" class="fsk lock" aria-pressed="true" aria-disabled="true"'
            + ' title="一律包含，不能取消">fankeel 指南<span>（一律包含）</span></button></span></div>'
            + groups.map(function (pl) {
                return '<div class="fskc"><span class="fskh">' + esc(pl) + '</span><span class="fskl">' + by[pl].map(function (o) {
                    var i = o.indexOf(':');
                    return '<button type="button" class="fsk mul" data-k="design.skill" data-m="' + esc(o) + '" aria-pressed="' + (on.indexOf(o) >= 0) + '">'
                        + esc(i > 0 ? o.slice(i + 1) : o) + '</button>';
                }).join('') + '</span></div>';
            }).join('') + '</div></div>';
    }
```

In the front branch of `wizStepHtml`, the call becomes `wizFrontHtml(keys, W)`. In the `keydown` handler for the model bar, change `b.parentNode.querySelectorAll('.fsg')` to `b.closest('.fq').querySelectorAll('.fsg')`, so the arrows walk all five.

- [ ] **Step 6: The styles.** Copy verbatim into `assets/station/station.css` the mockup's rules for `.fq`, `.fqc`, `.fbar.solo`, `.frc`, `.fmul`, `.fskt`, `.fsk.lock`, `.fsk.mul` and the `wizard-gate-station` card, and delete the `.fe2`, `.fseg`, `.frec` and `.fadv` rules nothing renders any more.
- [ ] **Step 7:** Delete the `〔design〕` and `〔gate〕` lines from `## Ready` in `TODO.md`; run `node scripts/todo-check.js`.
- [ ] **Step 8: Run and watch them pass:** `node --test tests/station-wizard.test.js tests/station-wizard-motion.test.js tests/station-shell.test.js tests/station.test.js`.
- [ ] **Step 9: Commit** — `feat: the wizard offers mockup auto, several design skills, and gate answering at 60 s`.

## Task 12: measure what context.md saves

**Files:**
- Modify: `docs/reports/2026-09-26-context-md.md` — new: the paired A/B, its numbers and what they do not show
- Modify: `docs/reports/evidence/2026-09-26-context-md/ab.sh` — new: the harness, from `2026-09-26-ab-profile-pin/ab.sh`
- Modify: `docs/sources.md` — one row, `CONTEXT-MD-260926`, and the heading's count
- Modify: `TODO.md` — the 〔context〕 Ready line goes
- Read: `scripts/context.js` — what arm A's subagents call
- Read: `docs/reports/evidence/2026-09-26-ab-profile-pin/ab.sh` — the harness copied
- Read: `docs/reports/evidence/2026-09-26-ab-profile-pin/pin.sh` — pins `stage.agents` by commit

**Interfaces:**
- Consumes: `contextPath` and `scripts/context.js` from Task 4
- Produces: `docs/reports/2026-09-26-context-md.md`

**Dispatch:** in-session — a paired headless run costs real money, its cap has to be put to the user before it starts, and the arms have to be watched; no subagent can ask.

- [ ] **Step 1: Pin the two arms.** Let `S` be the sha Task 4 landed (`git log -1 --format=%H -- scripts/context.js`), written out in full. Create two worktrees at `S` under `.fankeel/build/2026-09-26-context-md/` — `with/` and `without/` — and in `without/` reverse Task 4's `lib/render.js` hunk and commit it there, so the only difference between the arms is whether the brief names the file:

```sh
git worktree add .fankeel/build/2026-09-26-context-md/with S
git worktree add .fankeel/build/2026-09-26-context-md/without S
git -C .fankeel/build/2026-09-26-context-md/without show S -- lib/render.js | git -C .fankeel/build/2026-09-26-context-md/without apply -R
git -C .fankeel/build/2026-09-26-context-md/without commit -qam "ab: the brief does not name context.md"
```

- [ ] **Step 2: The harness.** Copy `docs/reports/evidence/2026-09-26-ab-profile-pin/ab.sh` to `docs/reports/evidence/2026-09-26-context-md/ab.sh` and change only: the header comment (this measurement, its two arms), `BASE` to the full `S`, `EVID` and `WORK` to this directory and `.fankeel/build/2026-09-26-context-md`, the arms to the two worktrees instead of two models (both `--model sonnet`), and `stage.agents` pinned to `survey,build,verify` in both through `pin.sh`, so build runs in a brain whose implementers get the brief. Keep its task (the todo-check line-number entry), route, `CAP` and `--max-budget-usd`. Write `git rev-parse HEAD` and `git status --porcelain` into its provenance log.
- [ ] **Step 3: Ask before spending.** Run `DRY=1 bash docs/reports/evidence/2026-09-26-context-md/ab.sh`, then AskUserQuestion with the two arms, the per-arm cap and the total, option one being the run. Stop here on anything but option one, and record that the measurement was not run in the report.
- [ ] **Step 4: Run it**, then count per arm from the `result` lines of each `claude -p --output-format json` output: `modelUsage` input, output, cache-read and cache-write tokens by model, and `total_cost_usd` — the maximum of the repeated `result` lines per call, never their sum; `duration_ms` is not the measure. Also count, in arm `with/`, the lines of its `context.md` and how many `context.js add` calls its transcripts hold (`<session>/subagents/*.jsonl`).
- [ ] **Step 5: The report.** Write `docs/reports/2026-09-26-context-md.md` with frontmatter `status: current`, `last_verified: 2026-09-26`, `source_of_truth: docs/reports/evidence/2026-09-26-context-md/ab.sh`; the headline figure (arm `with` against arm `without`, tokens and dollars), a table per arm, `S` in full, n=1 per arm stated as the evidence level, and what it cannot show. Add its row to `docs/sources.md` (ID `CONTEXT-MD-260926`) and move the heading's count by one. If `node scripts/docs-audit.js` lists the page as missing from `docs/README.md`, add its row there.
- [ ] **Step 6:** Delete the `〔context〕` line from `## Ready` in `TODO.md`; `node scripts/todo-check.js`; `node --test tests/sources-doc.test.js`; remove both worktrees with `git worktree remove`.
- [ ] **Step 7: Commit** — `docs: context.md measured, paired, n=1 per arm`.

## Task 13: move fankeel's own docs to the audience preset

**Files:**
- Modify: `.fankeel/docs.json` — rewritten by `docs-move.js apply`
- Modify: `docs/README.md` — the Roles table names the new buckets; links re-pointed
- Modify: `README.md` — the `docs/` row of the tree; links re-pointed
- Modify: `TODO.md` — links re-pointed; one `## Needs a decision` entry added
- Modify: `CONTRIBUTING.md` — links re-pointed
- Modify: `.ignore` — `docs/archive/` becomes `docs/99-archive/`
- Modify: `knip.json` — `docs/reports/evidence/**` becomes `docs/90-agent/reports/evidence/**`
- Modify: `lib/render.js` — `newestPlan` reads the plan bucket from `docs.json`
- Modify: `scripts/judge.js` — the judgements directory and its index row read from `docs.json`
- Modify: `assets/station/station.js` — the `docs/station.md` literal at the TODO spot
- Modify: `docs/sources.md` — moved, and its report links re-pointed
- Modify: `docs/station.md` — moved
- Modify: `docs/subagents.md` — moved
- Modify: `docs/documents.md` — moved
- Modify: `agents/fankeel-brain.md` — links re-pointed
- Modify: `agents/fankeel-reviewer.md` — links re-pointed
- Modify: `skills/fankeel/SKILL.md` — links re-pointed
- Modify: `skills/fankeel-ask/SKILL.md` — links re-pointed
- Modify: `skills/fankeel-audit/SKILL.md` — links re-pointed
- Modify: `skills/fankeel-audit/rationale.md` — links re-pointed
- Modify: `skills/fankeel-build/SKILL.md` — links re-pointed
- Modify: `skills/fankeel-build/rationale.md` — links re-pointed
- Modify: `skills/fankeel-station/SKILL.md` — links re-pointed
- Modify: `evals/one-call-not-agent/graders/no-agent-dispatch.md` — the evidence path
- Modify: `tests/ab-pin.test.js` — the evidence path it reads
- Modify: `tests/agents.test.js` — the report path it reads
- Modify: `tests/contract.test.js` — `docs/development.md` and the count of pages directly in `docs/`
- Modify: `tests/docs-audit.test.js` — the real `docs/pipeline.md` it reads
- Modify: `tests/docs.test.js` — the real `docs/documents.md` it reads
- Modify: `tests/pipeline-doc.test.js` — `PIPELINE`
- Modify: `tests/render.test.js` — the real `docs/pipeline.md` it reads
- Modify: `tests/skills.test.js` — `docs/development.md` and the pages directly in `docs/`
- Modify: `tests/sources-doc.test.js` — `docs/reports` and `docs/sources.md`
- Modify: `tests/station-doc.test.js` — `docs/station.md`
- Read: `scripts/docs-move.js` — the tool
- Read: `tests/station-wizard-motion.test.js` — lands first (Task 1)
- Read: `scripts/orient.js` — lands first (Task 2)
- Read: `scripts/docs-audit.js` — lands first (Task 2)
- Read: `scripts/context.js` — lands first (Task 4)
- Read: `hooks/gate.js` — lands first (Task 5)
- Read: `scripts/station.js` — lands first (Task 5)
- Read: `lib/profile.js` — lands first (Task 6)
- Read: `skills/fankeel-design/design-guide.md` — lands first (Task 7)
- Read: `assets/tune/overlay.js` — lands first (Task 8)
- Read: `docs/reports/2026-09-26-context-md.md` — lands first (Task 12), and moves here

Beyond the files above, every tracked file under `docs/` moves: `moves.tsv` is the list, and the gate shows it.

**Interfaces:**
- Consumes: `planMoves`, `applyMoves` and the `docs-move.js` CLI from Task 3
- Produces: `.fankeel/docs.json` with `"preset": "audience"`; this plan's own path becomes `docs/90-agent/plans/2026-09-26-ready-five.md`

**Dispatch:** in-session — the move table goes to the user at a gate before anything moves, and the fixes after it are whatever the suite names, which no plan can list in advance.

It runs after every other dispatched task because it rewrites paths in files all of them touch. After it commits, every `ledger.js` call takes `--plan docs/90-agent/plans/2026-09-26-ready-five.md`; the ledger directory is keyed by the basename, so its progress carries over.

- [ ] **Step 1: The table.** Placements: `docs/development.md` to `docs/01-guide/` (it is how to work on fankeel) and `docs/pipeline.md` to `docs/02-architecture/` (the seven stages, the architecture at a glance); everything else as its role files it.

```sh
node scripts/docs-move.js plan --to audience --place docs/development.md=docs/01-guide/development.md --place docs/pipeline.md=docs/02-architecture/pipeline.md --out .fankeel/build/2026-09-26-ready-five/moves.tsv
```

- [ ] **Step 2: The artefact row.** The table's page rows equal the markdown files git tracks under `docs/` before the move:

```sh
test "$(grep -c '\.md	' .fankeel/build/2026-09-26-ready-five/moves.tsv)" -eq "$(git ls-files docs | grep -c '\.md$')" && echo rows-match
```

- [ ] **Step 3: The gate.** AskUserQuestion: the table's path, its three counts (rows, pages, files that move), the two placements, and that this plan moves with it. Option one applies it. Anything else stops the task, recorded in the ledger.
- [ ] **Step 4: Apply, then check.**

```sh
node scripts/docs-move.js apply --to audience --table .fankeel/build/2026-09-26-ready-five/moves.tsv
node scripts/docs-check.js
```

`docs-check` must report nothing dead. A generic directory in a code span — a skill's docs/plans/, which describes any project — is left as it is unless `docs-check` names it.

- [ ] **Step 5: The code that hard-codes the flat tree.** In `lib/render.js`, `newestPlan` reads the plan bucket rather than the flat plans directory:

```js
    const { tree } = require('./docs.js').read(projectRoot);
    const bucket = tree && tree.buckets.find((b) => b.role === 'plan');
    const dir = path.join(projectRoot, ...(bucket ? bucket.path : 'docs/plans').split('/'));
```

and in `scripts/judge.js`, the judgements directory and the index row come from `docs.json` (add `const docs = require('../lib/docs.js');` if it is not there):

```js
    const { tree } = docs.read(projectRoot);
    const bucket = tree && tree.buckets.find((b) => /(^|\/)judgements$/.test(b.path));
    const dir = path.join(projectRoot, ...(bucket ? bucket.path : 'docs/judgements').split('/'));
```

with `const rel = path.relative(path.dirname(indexFile), file).split(path.sep).join('/');` in place of `'judgements/' + path.basename(file)`. Point `assets/station/station.js`'s `'docs/station.md'` at the page's new path, `.ignore` at `docs/99-archive/`, `knip.json` at `docs/90-agent/reports/evidence/**`.
- [ ] **Step 6: The suite names the rest.** Run `npm test`. Every failure here is a test reading a real page by its flat path (the ten tests in the Files block) or counting the pages directly in `docs/`: point each at the page's new path from `moves.tsv`, and where a test counts `docs/*.md` (`tests/contract.test.js`'s WORDS count, `tests/skills.test.js:515`) make it count the pages of the same bucket where they now live. Update `docs/README.md`'s Roles table to the buckets `docs.json` now declares, and the `docs/` row of the tree in `README.md`. Repeat until `npm test` is green.
- [ ] **Step 7: What the move leaves undone.** `lib/stages.js` tells design and plan to write under `docs/plans/`, which is no longer a bucket here. Add under `## Needs a decision` in `TODO.md`: `- 〔docs〕lib/stages.js 的 design/plan artifact 仍寫 docs/plans/；fankeel 改 audience 後計畫桶是 docs/90-agent/plans——改讀 docs.json 的 plan 桶，同 newestPlan — [lib/stages.js](lib/stages.js).` Run `node scripts/todo-check.js`, `node scripts/docs-audit.js` and `node scripts/map.js`.
- [ ] **Step 8: Commit** — `docs: fankeel's own docs move to the audience preset`, with `git show --stat HEAD` pasted into the ledger.

## Task 14: run the move on Trovara

**Files:**
- Modify: `TODO.md` — the 〔audit〕 Ready line goes once Trovara has moved
- Read: `scripts/docs-move.js` — the tool, run against another repository
- Read: `.fankeel/build/2026-09-26-ready-five/moves.tsv` — what fankeel's own move looked like

**Interfaces:**
- Consumes: the `docs-move.js` CLI from Task 3, proven on fankeel in Task 13
- Produces: none in this repository

**Dispatch:** user — Trovara (`F:/ymlab/SBIR/ProjectWorkspace/Trovara`) is another repository: its move is committed there, from a session opened there, at the user's own gate.

- [ ] **Step 1:** In a session opened in Trovara: if it has no `.fankeel/docs.json`, declare the shape it has now first (`/fankeel` survey offers it); `docs-move.js` refuses to plan without one.
- [ ] **Step 2:** `node F:/ymlab/fankeel/scripts/docs-move.js plan --to audience --root F:/ymlab/SBIR/ProjectWorkspace/Trovara --out F:/ymlab/SBIR/ProjectWorkspace/Trovara/.fankeel/build/audience-move/moves.tsv`, then the same row check as Task 13 Step 2 against Trovara's `git ls-files docs`.
- [ ] **Step 3:** Read the table; `apply`; `node F:/ymlab/fankeel/scripts/docs-check.js --root F:/ymlab/SBIR/ProjectWorkspace/Trovara` reports nothing dead; commit in Trovara.
- [ ] **Step 4:** `node F:/ymlab/fankeel/scripts/docs-audit.js --root F:/ymlab/SBIR/ProjectWorkspace/Trovara --batches` — its 319 pages as batches of at most 40 — then `--record`, and commit `.fankeel/audit.json` there.
- [ ] **Step 5:** Back in fankeel, delete the `〔audit〕` line from `## Ready` in `TODO.md`, `node scripts/todo-check.js`, and commit `docs: the audit Ready entry is done, Trovara moved`.

## Coverage

| promise | task |
|---|---|
| fankeel's own docs move from the `flat` preset to `audience`: `01-guide`, `02-architecture`, `03-decisions`, `90-agent`, `99-archive`, with `.fankeel/docs.json` rewritten to match. | Task 13 (the tool: Task 3) |
| `scripts/docs-move.js` produces the move table — old path, new path, one row per page — from a `docs.json` and a target preset, and applies it with `git mv` plus a rewrite of every relative link that pointed at a moved page. | Task 3 |
| The table is written to `.fankeel/build/<plan>/moves.tsv` before anything moves, so the gate can show it. | Task 3 (`plan` writes, moves nothing), Task 13 Steps 1–3 |
| `/fankeel-audit`'s reading half goes out in batches: one reader per bucket, at most 40 pages each, so a 319-page repository is split rather than truncated. | Task 2 (Trovara's 319 in Task 14 Step 4) |
| `/fankeel-audit` records its run in `.fankeel/audit.json` (`{ "last": "<ISO date>" }`, committed); `orient`'s `todo:` block prints `audit: N 天未跑` once it is more than 14 days old, and nothing when it is not. | Task 2 |
| After fankeel's own move lands, the same script runs on Trovara (`F:/ymlab/SBIR/ProjectWorkspace/Trovara`) — a `user` task, because it is another repository. | Task 14 |
| `.fankeel/build/task-<started>/context.md` holds verified facts, one per line: the fact, `path:line`, and the short sha it was read at. | Task 4 |
| `scripts/context.js add "<fact>" --at <path:line> --session <id>` is the only writer: it stamps the sha from `git rev-parse --short HEAD`, drops an exact duplicate, and at 40 entries drops the oldest. | Task 4 |
| Any subagent may call it; the brief (`hooks/brief.js`) names the file's path and never inlines its contents. | Task 4 (the line is built in `renderBrief`, which `hooks/brief.js` calls) |
| A line whose sha is not HEAD is shown with `(舊)` by `context.js show`, so a reader knows to re-check it rather than trust it. | Task 4 |
| The saving is measured, not asserted: one build with the file and one without, paired, `modelUsage` compared, written to `docs/reports/2026-09-xx-context-md.md`. | Task 12 (`docs/reports/2026-09-26-context-md.md`) |
| `design.mockup` gains `auto`: when design judges the task to be front-end work it dispatches `fankeel-mockup` without asking, then runs `tune.js serve` and opens the browser. Non-front-end work draws nothing. | Task 6 (schema, clause), Task 7 (the design skill's rule), Task 11 (the wizard) |
| `design.skill` becomes a list (`lib/profile.js` schema, the wizard, and the injected mockup rule); a single string still reads as a list of one. | Task 6 (schema, `mockupClause`), Task 11 (wizard) |
| `skills/fankeel-design/design-guide.md` is fankeel's own one-page design rules, distilled from taste-skill, frontend-design, ui-ux-pro-max and impeccable. `fankeel-mockup` always reads it; the skills `design.skill` lists are loaded on top of it. | Task 7 |
| One floating icon (`float-icon`) replaces the three separate channels — toasts, the tune chip, the per-session 懸著的 gate — as the single place notifications and pending gates appear. | Task 9 |
| A block being edited in a tune loop carries a quiet animation (`editing-pulse`), and none under `prefers-reduced-motion`. | Task 8 (the ring on the tuned page), Task 9 (the 編輯中 note) |
| The station repaints only the sections whose data changed, instead of the whole page every 3 s. | Task 10 |
| The settings wizard asks whether to answer gates on the station page (`wizard-gate-station`), suggesting 60 s; off stays the default. | Task 11 |
| A pending gate lights the floating icon with a countdown (`gate-countdown`), its options as buttons. | Task 9 (`at` for the countdown: Task 5) |
| 「交給終端／手機」 ends the page's wait at once: `hooks/gate.js` stops waiting and the question goes to the terminal, where Remote Control already carries it to a phone. No Remote Control integration is built. | Task 5 (hook, route), Task 9 (the button) |
| On timeout the question goes to the terminal, as today. | Task 5 — unchanged; `tests/gate.test.js`'s existing timeout test stays green |
| Every headless-Chromium spawn in the tests gets its own `--user-data-dir` under a temporary directory. Without one, concurrent spawns share the default profile, and a second instance can hand its URL to the first and exit with nothing on stdout — which is the `the page never reported` failure. | Task 1 |
| The fix goes where `findBrowser()` callers build their arguments, so `station-cli` gets it too. | Task 1 — the callers are the wizard-motion test and `render.js`'s one-page mode (run by `render-cli`); `station-cli` spawns no browser, which the report says |
| 1 — a `docs-move.js` test: a fixture `flat` tree moved to `audience` leaves `docs-check.js` at zero dead links; the artefact row — `moves.tsv` row count equals the pages `docs-audit` counted before the move | Task 3 (`tests/docs-move.test.js`), Task 13 Step 2 |
| 1 — an `orient` test: an `audit.json` 15 days old prints the line, 13 days old prints nothing | Task 2 (`tests/orient.test.js`) |
| 2 — a `context.js` test: 41 adds leave 40 lines, the oldest gone; a duplicate adds nothing; a line at an old sha shows `(舊)` | Task 4 (`tests/context-md.test.js`) |
| 3 — a `profile.js` test: `design.mockup: "auto"` and `design.skill: [..]` validate; today both are refused | Task 6 |
| 3 — the render reviewer against `mockup.html`, per `data-block` | Tasks 8, 9, 11 (build's render reviewer), per block `float-icon`, `gate-countdown`, `editing-pulse`, `wizard-gate-station`, `wizard-design` |
| 4 — a `gate.js` test: a hand-off answer written by the page ends the wait before the timeout | Task 5 |
| 5 — six copies of `station-wizard-motion.test.js` run concurrently: fails now, passes after | Task 1 Steps 1 and 4 |
