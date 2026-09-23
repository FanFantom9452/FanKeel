---
status: current
last_verified: 2026-09-23
---

# Batched commit handoff and archive-free survey — Implementation Plan

**Goal:** a build-stage brain commits a batch of tasks in one round trip through its controller, and `scripts/survey.js` stops scanning `archive`-role files unless asked.
**Architecture:** `scripts/commit.js` learns a commit file of `---`-separated blocks and commits them in order, one range line each; the controller's `COMMIT_RULE` and the brain's build clause say so in one appended sentence each. `scripts/survey.js`'s `scan()` drops entries `lib/docs.js`'s `roleOf` files as `archive`, counts them on the header, and `--archive` puts them back.
**Tech Stack:** Node, CommonJS, `node:test`; no dependencies (package.json has none and adds none).
**Spec:** [2026-09-23-brain-commit-batch-survey-scope-design.md](2026-09-23-brain-commit-batch-survey-scope-design.md)

## Global Constraints

- CommonJS, `'use strict'`, no new dependencies — `package.json` has no `dependencies` key and the plan adds none.
- Indentation follows the file: 4 spaces in `scripts/commit.js`, `tests/commit.test.js`, `lib/stages.js`, `lib/render.js`, `scripts/survey.js`; 2 spaces in `tests/survey.test.js`.
- Commit subjects are `type: <繁體中文>` — e.g. `4792569 refactor: tune 與 station 的 POST body 讀取抽到 lib/body.js`.
- The controlled build block stays under 2400 characters at a real plugin root — `tests/render.test.js:690` (`sizeAtReference(out) < 2400`). Never raise the cap; re-run `node --test tests/render.test.js` after touching `COMMIT_RULE`.
- These assertions pin text that must survive verbatim, so new wording is **appended**, never spliced into them: `tests/render.test.js:688` (`COMMIT_RULE` through `wait for it to return again.`), `tests/brief.test.js:389` and `:392` (the build clause through `Return the report path when the whole stage is done or blocked.`), `tests/task.test.js:982`.
- A single-block commit file prints and fails exactly as today — every existing test in `tests/commit.test.js` stays green unedited.
- `scan()`'s return keeps every existing key; `excluded` is added, not substituted.
- An implementer runs only its own test file; the parent runs `npm test` before committing the group.
- `docs/plans/2026-09-19-stage-agents-design.md` is design-intent: extended, not contradicted.

## File structure

| file | responsibility | task |
|---|---|---|
| `scripts/commit.js` | parse N blocks, commit each in order, one line per block | 1 |
| `tests/commit.test.js` | multi-block cases | 1 |
| `lib/stages.js` | `COMMIT_RULE`: one sentence on the multi-line reply | 1 |
| `lib/render.js` | build clause: one sentence on the batch file | 1 |
| `docs/subagents.md` | the commit row names the batched shape | 1 |
| `scripts/survey.js` | archive exclusion, `excluded:` note, `--archive` | 2 |
| `tests/survey.test.js` | archive fixture cases | 2 |
| `skills/fankeel-survey/SKILL.md` | documents `--archive` | 2 |

## Task 1: commit.js takes a batch of blocks

**Files:**
- Modify: `scripts/commit.js` — `parse` splits on `---` lines; `main` loops over blocks
- Modify: `lib/stages.js` — `COMMIT_RULE` gains one trailing sentence
- Modify: `lib/render.js` — `renderBrainBrief`'s `stage === 'build'` clause gains one trailing sentence
- Modify: `docs/subagents.md` — the `a commit (build, design, plan)` table row
- Read: `tests/render.test.js` — lines 683-694, the pinned `COMMIT_RULE` text and the 2400 cap
- Read: `tests/brief.test.js` — lines 385-392, the pinned build-clause text
- Read: `tests/stages.test.js` — line 917, which stages carry `commit <file>`
- Read: `tests/task.test.js` — line 982, the pinned `commit.js` line in `task.js stage` output
- Test: `tests/commit.test.js`

**Interfaces:**
- Consumes: none
- Produces: `commit.main(argv, cwd)` → `{ text, code }`, unchanged signature; one block prints `<base>..<sha>` as today; several print one `<paths>: <base>..<sha>` line per committed block (`<paths>` the block's paths joined with `, `), newline-joined, then at most one `commit.js: block <n>: ...` line

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

The spec's §1 keys each printed line on its block's own path list, because a bare range cannot say which task it belongs to. The key is `<paths>: ` — the block's paths joined with `, ` — and it is printed only when the file holds more than one block, so a single-block file prints exactly what it prints today and design's and plan's one-block commits are untouched.

Steps:

1. In `tests/commit.test.js`, append:

```js
test('a file of two blocks commits twice, in order, and prints two chained ranges', () => {
    const dir = repo();
    const before = git(dir, 'rev-parse', 'HEAD');
    const res = commit.main([requestFile('a.txt\n\nfeat: change a\n---\nb.txt\n\nfeat: change b\n')], dir);
    assert.ok(!res.code, res.text);
    const first = git(dir, 'rev-parse', 'HEAD~1');
    const second = git(dir, 'rev-parse', 'HEAD');
    assert.equal(res.text, 'a.txt: ' + before + '..' + first + '\n' + 'b.txt: ' + first + '..' + second);
    assert.equal(git(dir, 'show', '--name-only', '--format=', 'HEAD~1'), 'a.txt');
    assert.equal(git(dir, 'show', '--name-only', '--format=', 'HEAD'), 'b.txt');
    assert.equal(git(dir, 'log', '-1', '--format=%B', 'HEAD~1'), 'feat: change a');
});

test('a failing second block keeps the first commit and names the block that failed', () => {
    const dir = repo();
    fs.writeFileSync(path.join(dir, 'c.txt'), 'c\n');
    git(dir, 'add', 'c.txt');
    git(dir, 'commit', '-qm', 'c');
    const base = git(dir, 'rev-parse', 'HEAD');
    const res = commit.main([requestFile('a.txt\n\nfeat: change a\n---\nc.txt\n\nfeat: nothing here\n---\nb.txt\n\nfeat: change b\n')], dir);
    assert.equal(res.code, 1);
    const lines = res.text.split('\n');
    assert.equal(lines.length, 2);
    assert.equal(lines[0], 'a.txt: ' + base + '..' + git(dir, 'rev-parse', 'HEAD'));
    assert.equal(lines[1], 'commit.js: block 2: nothing to commit in c.txt');
    assert.equal(git(dir, 'show', '--name-only', '--format=', 'HEAD'), 'a.txt');
    assert.equal(git(dir, 'diff', '--name-only'), 'b.txt');
});

test('a block that does not parse commits nothing at all', () => {
    const dir = repo();
    const before = git(dir, 'rev-parse', 'HEAD');
    const res = commit.main([requestFile('a.txt\n\nfeat: change a\n---\nb.txt\n')], dir);
    assert.equal(res.code, 1);
    assert.equal(res.text, 'commit.js: block 2: no blank line between the paths and the message');
    assert.equal(git(dir, 'rev-parse', 'HEAD'), before);
});
```

2. Run `node --test tests/commit.test.js` and watch the three new tests fail (today the `---` line is swallowed into block one's message: one commit, one line).

3. In `scripts/commit.js`, replace `parse` and `main` with:

```js
function parseBlock(text) {
    const at = text.search(/\r?\n[ \t]*\r?\n/);
    if (at < 0) return { error: 'no blank line between the paths and the message' };
    const paths = text.slice(0, at).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const message = text.slice(at).trim();
    if (!message) return { error: 'no message' };
    return { paths, message };
}

// Blocks are separated by a line that is `---` and nothing else, so a brain
// that dispatched several tasks together commits them in one round trip. A
// block that does not parse refuses the whole file before anything commits.
function parse(text) {
    const chunks = text.split(/^[ \t]*---[ \t]*\r?$/m).map((c) => c.trimStart()).filter((c) => c.trim());
    if (!chunks.length) return { error: 'no blank line between the paths and the message' };
    const blocks = [];
    for (let i = 0; i < chunks.length; i++) {
        const b = parseBlock(chunks[i]);
        if (b.error) return { error: (chunks.length > 1 ? 'block ' + (i + 1) + ': ' : '') + b.error };
        blocks.push(b);
    }
    return { blocks };
}

function main(argv, cwd) {
    if (argv.length !== 1) return { text: 'commit.js: usage: commit.js <commit file>', code: 2 };
    let raw;
    try {
        raw = fs.readFileSync(argv[0], 'utf8');
    } catch (e) {
        return { text: 'commit.js: cannot read ' + argv[0], code: 1 };
    }
    const parsed = parse(raw.trimStart());
    if (parsed.error) return { text: 'commit.js: ' + parsed.error, code: 1 };

    const run = (dir, args, input) => spawnSync('git', args, { cwd: dir, encoding: 'utf8', input });
    const top = run(cwd, ['rev-parse', '--show-toplevel']);
    if (top.status !== 0) return { text: 'commit.js: not inside a git repository', code: 1 };
    const git = (args, input) => run(top.stdout.trim(), args, input);
    if (git(['rev-parse', 'HEAD']).status !== 0) return { text: 'commit.js: the repository has no commit yet', code: 1 };
    // What the controller relays is one bounded line, whatever git printed.
    const oneLine = (text) => text.trim().replace(/\s+/g, ' ').slice(0, 300);

    // Each block's base is HEAD before that block, so the ranges chain: the
    // second task's reviewer is pinned to the first task's commit, not to where
    // the batch started. A failure stops the run and keeps what already landed.
    const out = [];
    const many = parsed.blocks.length > 1;
    for (let i = 0; i < parsed.blocks.length; i++) {
        const { paths, message } = parsed.blocks[i];
        const fail = (why) => ({ text: out.concat('commit.js: ' + (many ? 'block ' + (i + 1) + ': ' : '') + why).join('\n'), code: 1 });
        const base = git(['rev-parse', 'HEAD']).stdout.trim();
        const add = git(['add', '--'].concat(paths));
        if (add.status !== 0) return fail('git add failed: ' + oneLine(add.stderr));
        // Said here rather than left to `git commit`, whose text for this case depends on the rest of the tree.
        if (git(['diff', '--cached', '--quiet', '--'].concat(paths)).status === 0) return fail('nothing to commit in ' + paths.join(', '));
        const made = git(['commit', '-o', '-F', '-', '--'].concat(paths), message + '\n');
        if (made.status !== 0) return fail('git commit failed: ' + oneLine(made.stderr || made.stdout));
        out.push((many ? paths.join(', ') + ': ' : '') + base + '..' + git(['rev-parse', 'HEAD']).stdout.trim());
    }
    return { text: out.join('\n') };
}
```

   and change the file's opening comment's first sentence to: `// Commits one task, or a batch of them, for a stage agent that is refused git writes.` followed by the existing text, plus one line after `the range that task's reviewer is pinned to.`: `// Several tasks' blocks, separated by a \`---\` line, print one \`<paths>: <base>..<sha>\` each, in order.`

4. Run `node --test tests/commit.test.js` — all pass, the eleven old ones included.

5. In `lib/stages.js`, change `COMMIT_RULE` to (the pinned text unchanged, one sentence appended):

```js
const COMMIT_RULE = 'If it returns `commit <file>` instead of a report path, run `node {{COMMIT}} "<file>"` and SendMessage it what that printed, exactly. No gate, nothing else; wait for it to return again. A batch prints one `<paths>: <range>` line per task: relay them all.';
```

6. In `lib/render.js`, in the `if (stage === 'build')` clause, append to the end of the first `lines.push` string — after `Return the report path when the whole stage is done or blocked.` — the sentence:

```js
' Tasks you dispatched together and have all read back may share one file: one block per task, a line `---` between blocks, one `commit` return; the reply is one `<paths>: <base>..<sha>` line per block, and a failure stops there with `commit.js: block <n>: <why>` after the lines that landed.'
```

7. In `docs/subagents.md`, in the table row that opens `| a commit (\`build\`, \`design\`, \`plan\`) |`, append to its last cell before the closing `|`: `; on build, tasks dispatched together may share one file — blocks separated by a \`---\` line, one `<paths>: <base>..<sha>` line back per block`.

8. Run `node --test tests/render.test.js tests/brief.test.js tests/stages.test.js tests/task.test.js` — all pass, the 2400 cap included. If the cap fails, shorten step 6's sentence, never the pinned text.

9. Commit: `feat: build 的 brain 一次交一批 commit，commit.js 讀 --- 分隔的多個區塊`.

## Task 2: survey leaves archive-role files out by default

**Files:**
- Modify: `scripts/survey.js` — `scan` filters, `report` prints `excluded:`, `parseArgs`/`main` carry `--archive`
- Modify: `skills/fankeel-survey/SKILL.md` — `--archive` beside `--all`
- Read: `lib/docs.js` — `read(root)` → `{ tree, error }`, `roleOf(tree, rel)` → role string or `null`; `tree.buckets[]` is `{ path, role, depth? }`
- Test: `tests/survey.test.js`

**Interfaces:**
- Consumes: `read`, `roleOf` from `lib/docs.js`
- Produces: `scan(root, terms, opts)` — `opts.archive` boolean; return gains `excluded: { count, buckets }` (`buckets` an array of bucket paths); `parseArgs` returns `archive` beside `root, terms, max, tree`

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

Steps:

1. In `tests/survey.test.js`, append:

```js
const DOCS_JSON = JSON.stringify({ buckets: [{ path: 'docs', role: 'reference', depth: 1 }, { path: 'docs/archive', role: 'archive' }] });

test('archive-role files are left out by default and counted on the header', () => {
  const root = repo({
    '.fankeel/docs.json': DOCS_JSON,
    'docs/archive/old.md': '# Widget old\n',
    'lib/a.js': 'function widgetFactory() {}\n',
  });
  const out = run(root, 'widget');
  assert.doesNotMatch(out, /docs\/archive\/old\.md/);
  assert.match(out, /lib\/a\.js:1 {2}function widgetFactory/);
  assert.match(out, /excluded: 1 archive file under docs\/archive — pass --archive to include/);
  const result = survey.scan(root, ['widget']);
  assert.equal(result.excluded.count, 1);
  assert.deepEqual(result.excluded.buckets, ['docs/archive']);
});

test('--archive puts archive-role files back and prints no excluded line', () => {
  const root = repo({
    '.fankeel/docs.json': DOCS_JSON,
    'docs/archive/old.md': '# Widget old\n',
    'lib/a.js': 'function widgetFactory() {}\n',
  });
  const out = run(root, '--archive', 'widget');
  assert.match(out, /docs\/archive\/old\.md/);
  assert.doesNotMatch(out, /excluded:/);
  assert.equal(survey.parseArgs(['--archive', 'x']).archive, true);
});

test('a root with no docs.json excludes nothing', () => {
  const root = repo({ 'docs/archive/old.md': '# Widget old\n', 'lib/a.js': 'function widgetFactory() {}\n' });
  const out = run(root, 'widget');
  assert.match(out, /docs\/archive\/old\.md/);
  assert.doesNotMatch(out, /excluded:/);
  assert.equal(survey.scan(root, ['widget']).excluded.count, 0);
});

test('the excluded count is what the scan actually dropped', () => {
  const root = repo({
    '.fankeel/docs.json': DOCS_JSON,
    'docs/archive/a.md': '# a\n',
    'docs/archive/b.md': '# b\n',
    'lib/a.js': 'function widgetFactory() {}\n',
  });
  const all = survey.scan(root, [], { archive: true });
  const some = survey.scan(root, []);
  assert.equal(all.files.length - some.files.length, some.excluded.count);
  assert.match(survey.report(some, [], {}), new RegExp('excluded: ' + some.excluded.count + ' archive files under docs/archive'));
});
```

2. Run `node --test tests/survey.test.js` and watch the four fail (`excluded` is undefined; the archive page is listed).

3. In `scripts/survey.js`, beside the other requires, add:

```js
const docsTree = require('../lib/docs.js');
```

4. In `scripts/survey.js`, change `function scan(root, terms) {` to `function scan(root, terms, opts) {`, and replace the line `const { files: entries, repos, walked, truncated, unlistable, skippedExt } = tracked;` with:

```js
    const { files: listed, repos, walked, truncated, unlistable, skippedExt } = tracked;

    // Retired pages are read as current when a search returns them beside the
    // live ones, so an `archive` bucket is out of the scan unless asked for.
    // Counted, never silently subtracted: the header says how many and where.
    // No docs.json means no tree, `roleOf` answers null, and nothing is dropped.
    const { tree } = docsTree.read(root);
    const excluded = { count: 0, buckets: [] };
    const entries = [];
    for (const entry of listed) {
        const rel = String(entry).replace(/\\/g, '/');
        if (!(opts && opts.archive) && tree && docsTree.roleOf(tree, rel) === 'archive') {
            excluded.count++;
            const bucket = tree.buckets.find((b) => b.role === 'archive' && rel.startsWith(b.path + '/'));
            if (bucket && !excluded.buckets.includes(bucket.path)) excluded.buckets.push(bucket.path);
            continue;
        }
        entries.push(entry);
    }
```

5. In `scripts/survey.js`, in `scan`'s final `return`, add `excluded` after `skipped`:

```js
    return { total: files.length, files: entries, repos, walked, truncated, decls, docs, named, skipped, excluded };
```

6. In `scripts/survey.js`'s `report`, change `const { total, repos, walked, truncated, decls, docs, named, skipped } = result;` to include `excluded`, and immediately after the line `if (skips.length) note.push('skipped: ' + skips.join(', '));` add:

```js
    if (excluded && excluded.count) {
        note.push('excluded: ' + excluded.count + (excluded.count === 1 ? ' archive file' : ' archive files') + ' under ' + excluded.buckets.join(', ') + ' — pass --archive to include');
    }
```

7. In `scripts/survey.js`'s `parseArgs`, add `let archive = false;` beside `let tree = false;`, the line `if (argv[i] === '--archive') { archive = true; continue; }` after the `--tree` line, and return `{ root, terms, max, tree, archive }`. In `main`, destructure `archive` and call `scan(root, terms, { archive })`.

8. Run `node --test tests/survey.test.js` — all pass.

9. In `skills/fankeel-survey/SKILL.md`, in step 4b's fenced block holding `--all` and `--tree`, add the line:

```
node <plugin>/scripts/survey.js --archive <term>...  # archive-role files too
```

   and after that fence add the paragraph: `The default scan leaves out every file in an \`archive\` bucket and says how many on its \`excluded:\` line — the same pages step 3 calls retired. \`--archive\` puts them back, for confirming something was retired rather than moved.`

10. Commit: `feat: survey 預設不掃 archive bucket，--archive 才納入`.

## Coverage

| promise | task |
|---|---|
| `scripts/commit.js` reads a commit file of one or more blocks, each shaped exactly as today | Task 1 |
| `lib/stages.js`'s `COMMIT_RULE` names the multi-block shape and says the controller relays back everything | Task 1 |
| `lib/render.js`'s `renderBrainBrief`, build-stage clause: a brain may write one commit file per batch | Task 1 |
| `docs/subagents.md`'s commit-flow paragraphs (the ones that say the commit moved to the parent | Task 1 — the table row that names the commit file's shape; the §343 paragraph is about the in-session loop and stays |
| `scan(root, terms, opts)` reads `docs.read(root).tree` once and drops any entry | Task 2 |
| A new `--archive` flag (`parseArgs`, beside `--all`, `--max`, `--tree`, its own boolean | Task 2 |
| A root with no `docs.json` (`docs.read` returns a null tree) filters nothing | Task 2 |
| `skills/fankeel-survey/SKILL.md` documents `--archive` beside `--all` and `--tree` | Task 2 |
| `tests/commit.test.js`: a two-block file (disjoint paths, two messages) commits twice | Task 1 |
| `tests/survey.test.js`: a fixture tree with one file under an `archive`-role bucket | Task 2 |
| Artefact check: the printed `excluded: N` is read against itself | Task 2 — `the excluded count is what the scan actually dropped` |
