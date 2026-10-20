---
status: current
last_verified: 2026-10-20
source_of_truth: scripts/record.js, lib/bundle.js, agents/fankeel-retro.md
---

# Retro Bundle Implementation Plan

**Goal:** a task's whole session — main transcript, every subagent, tool calls and results — survives land as one masked gzip bundle, the land retro reads it and is filed verbatim, and `/fankeel-retro-all` reviews every bundle for recurring problems.
**Architecture:** `lib/bundle.js` packs and unpacks transcripts, masking every string through `lib/sensitive.js`'s new `redact()`. `scripts/record.js` grows `session`, `retro` and `sessions` verbs that write under the task's existing record anchor. `scripts/conversation.js` reads a bundle and can keep tool turns; the retro agent and the land skill switch to the bundle; a new skill fans retros out over bundles.
**Tech Stack:** Node ≥ 22.5 (`package.json` engines), `node:zlib` gzip, `node:test`; no dependencies.
**Spec:** [2026-10-20-retro-bundle-design.md](2026-10-20-retro-bundle-design.md)

## Global Constraints

- No dependencies: `package.json` has none, and none are added. Gzip is `node:zlib`.
- Node `>=22.5` (`package.json:8`).
- Four-space indentation in `lib/` and `scripts/`; two in `tests/` where the file already uses two (`tests/init-entry.test.js`), four where it uses four (`tests/record.test.js`).
- `scripts/record.js` keeps `OPTIONS` a literal object: `lib/skills.js` reads a script's flags from it (`scripts/record.js:20`).
- A record failure prints to stdout and exits 1 through `fail()` (`scripts/record.js:34-37`); nothing is written before a refusal.
- The land stage's rules stay within `budget: 2500` bytes and its last rule stays the `Output:` one (`tests/stages.test.js:1191-1203`).
- Every skill has a byte cap in `tests/skill-size.test.js` `CAPS`, the smallest multiple of 100 above its size.
- A skill's `version:` equals `package.json`'s `version` (`0.111.46` today; `scripts/version.js`).
- Agent effort pins are asserted in `tests/agents.test.js:258-265`; `fankeel-retro` stays `medium`.
- `.fankeel/sessions/` is the registry's own directory (`lib/registry.js:215-218`); bundles never go there.
- Files over 1500 lines (`READ_CAP`, `lib/plantasks.js`) are modified by range: `scripts/task.js` is 1825 lines.
- Test keys are built at run time (`'sk-ant-' + 'x'.repeat(24)`), never written whole in a file, so no scanner or push protection sees a key-shaped literal.

## Risks

- `usage.textOf` of a tool result whose content is an image block returns `''` — Task 3 — the test uses text results only; an image result renders as an empty block, which is acceptable.
- A word in `.fankeel/sensitive.txt` with regex characters — Task 1 — `redact` escapes it; its test includes `a.b`.
- A bundle of a 100 MB session is held in memory whole — Task 2 — `pack` reads file by file; the measured largest session (57 MB + 115 MB raw) fits under Node's string limit per file.

## Task 1: `redact()` in lib/sensitive.js

**Files:**
- Modify: `lib/sensitive.js` — add `SHAPES`, `redact`, export `readList`
- Test: `tests/sensitive-redact.test.js`

**Interfaces:**
- Consumes: none
- Produces: `redact(value, words, counts) -> value` — a deep copy with every string masked; `counts` (an object, mutated) gains `{ [kind]: n }`. `readList(root) -> { words: string[], error: string|null }` exported as is.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Write the failing test, in `tests/sensitive-redact.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { redact } = require('../lib/sensitive.js');

const KEY = 'sk-ant-' + 'x'.repeat(24);

test('redact masks a key shape and a listed word in every string, and leaves keys and numbers alone', () => {
    const counts = {};
    const out = redact({ a: 'use ' + KEY + ' now', b: [{ c: 'Trovara ships' }], n: 3, ok: true, sk: 'plain' }, ['trovara'], counts);
    assert.equal(out.a, 'use [REDACTED:key] now');
    assert.equal(out.b[0].c, '[REDACTED:word] ships');
    assert.equal(out.n, 3);
    assert.equal(out.ok, true);
    assert.equal(out.sk, 'plain');
    assert.deepEqual(counts, { key: 1, word: 1 });
});

test('a listed word with regex characters is matched literally', () => {
    const out = redact('a.b and axb', ['a.b'], {});
    assert.equal(out, '[REDACTED:word] and axb');
});

test('a private key block is masked whole', () => {
    const block = '-----BEGIN RSA PRIVATE KEY-----\nAAAA\n-----END RSA PRIVATE KEY-----';
    assert.equal(redact('x ' + block + ' y', [], {}), 'x [REDACTED:private-key] y');
});
```

2. Run `node --test tests/sensitive-redact.test.js` and watch it fail: `redact is not a function`.
3. Write the implementation. In `lib/sensitive.js`, after `readList`, add:

```js
// Secrets no list has to name: the shapes a key, a token or a private key is
// written in. A bundle (lib/bundle.js) masks these and the listed words in
// every string it carries, so a transcript can leave this machine.
const SHAPES = [
    ['private-key', /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g],
    ['key', /sk-ant-[A-Za-z0-9_-]{16,}/g],
    ['key', /\bsk-[A-Za-z0-9]{32,}\b/g],
    ['key', /\bAKIA[0-9A-Z]{16}\b/g],
    ['token', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g],
    ['token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/g],
];

function maskText(text, words, counts) {
    let out = text;
    const hit = (kind) => () => {
        counts[kind] = (counts[kind] || 0) + 1;
        return '[REDACTED:' + kind + ']';
    };
    for (const [kind, re] of SHAPES) out = out.replace(re, hit(kind));
    for (const w of words) out = out.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), hit('word'));
    return out;
}

// A deep copy of `value` with every string masked; object keys are not.
function redact(value, words, counts) {
    const c = counts || {};
    const list = words || [];
    if (typeof value === 'string') return maskText(value, list, c);
    if (Array.isArray(value)) return value.map((v) => redact(v, list, c));
    if (value && typeof value === 'object') {
        const out = {};
        for (const k of Object.keys(value)) out[k] = redact(value[k], list, c);
        return out;
    }
    return value;
}
```

   and change the last line of `lib/sensitive.js` to:

```js
module.exports = { scan, isCommit, listed, commitVerdict, redact, readList, SHAPES };
```

4. Run `node --test tests/sensitive-redact.test.js` and watch it pass.
5. Commit.

## Task 2: lib/bundle.js

**Files:**
- Modify: `lib/bundle.js` — new file
- Read: `lib/detail.js` — `transcriptOf(configDir, sessionId)`
- Test: `tests/bundle.test.js`

**Interfaces:**
- Consumes: `redact(value, words, counts)` from Task 1.
- Produces: `filesOf(configDir, sessionId) -> [{ rel, file }]` (main first, its rel the session id plus .jsonl, then each subagent file under the session id's subagents directory, sorted); `pack(sessions, files, words, counts) -> Buffer` (gzip); `unpack(buf) -> { head: { bundle: 1, sessions, files, redacted }, parts: Map<rel, object[]> }`.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Write the failing test, in `tests/bundle.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const tmp = require('./tmp.js');
const bundle = require('../lib/bundle.js');

const A = 'aaaaaaaa-1111-2222-3333-444444444444';
const KEY = 'sk-ant-' + 'x'.repeat(24);

function seed() {
    const cfg = tmp('fankeel-bundle-');
    const dir = path.join(cfg, 'projects', 'p');
    fs.mkdirSync(path.join(dir, A, 'subagents'), { recursive: true });
    fs.writeFileSync(path.join(dir, A + '.jsonl'), [
        JSON.stringify({ type: 'user', message: { role: 'user', content: 'my key is ' + KEY } }),
        '{"torn',
        JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'ls' } }] } }),
    ].join('\n') + '\n');
    fs.writeFileSync(path.join(dir, A, 'subagents', 'agent-x.jsonl'), JSON.stringify({ type: 'user', message: { role: 'user', content: 'Trovara' } }) + '\n');
    return cfg;
}

test('filesOf names the main transcript first, then each subagent', () => {
    const files = bundle.filesOf(seed(), A);
    assert.deepEqual(files.map((f) => f.rel), [A + '.jsonl', A + '/subagents/agent-x.jsonl']);
});

test('pack masks every string, and unpack gives back every parsed line by part', () => {
    const cfg = seed();
    const counts = {};
    const gz = bundle.pack([A], bundle.filesOf(cfg, A), ['trovara'], counts);
    const text = zlib.gunzipSync(gz).toString('utf8');
    assert.ok(!text.includes(KEY), 'the key survived');
    assert.ok(text.includes('[REDACTED:key]'));
    assert.deepEqual(counts, { key: 1, word: 1 });
    const { head, parts } = bundle.unpack(gz);
    assert.deepEqual(head.sessions, [A]);
    assert.deepEqual(head.redacted, { key: 1, word: 1 });
    assert.equal(parts.get(A + '.jsonl').length, 2);
    assert.equal(parts.get(A + '/subagents/agent-x.jsonl')[0].message.content, '[REDACTED:word]');
    assert.ok(text.includes('"raw":"{\\"torn"'), 'a torn line is kept as raw text');
});

test('filesOf of an unknown session is empty', () => {
    assert.deepEqual(bundle.filesOf(seed(), 'bbbbbbbb-0000-0000-0000-000000000000'), []);
});
```

2. Run `node --test tests/bundle.test.js` and watch it fail: `Cannot find module '../lib/bundle.js'`.
3. Write `lib/bundle.js`:

```js
'use strict';

// A task's sessions as one file that can leave this machine: every line of
// each main transcript and of its subagents, every string masked by
// lib/sensitive.js's `redact`, gzip'd. Line one is the head; every other line
// is `{ f: <part>, e: <entry> }`, or `{ f, raw }` for a line that did not parse,
// so nothing the transcript held is dropped
// (docs/90-agent/plans/2026-10-20-retro-bundle-design.md §1).

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { transcriptOf } = require('./detail.js');
const { redact } = require('./sensitive.js');

function filesOf(configDir, sessionId) {
    const main = transcriptOf(configDir, sessionId);
    if (!main) return [];
    const out = [{ rel: sessionId + '.jsonl', file: main }];
    const dir = path.join(path.dirname(main), sessionId, 'subagents');
    let names = [];
    try {
        names = fs.readdirSync(dir).filter((n) => n.endsWith('.jsonl')).sort();
    } catch (e) { /* no subagents */ }
    for (const n of names) out.push({ rel: sessionId + '/subagents/' + n, file: path.join(dir, n) });
    return out;
}

function pack(sessions, files, words, counts) {
    const c = counts || {};
    const lines = [];
    for (const f of files) {
        for (const raw of fs.readFileSync(f.file, 'utf8').split('\n')) {
            if (!raw) continue;
            let e;
            try { e = JSON.parse(raw); } catch (err) { e = undefined; }
            lines.push(JSON.stringify(e && typeof e === 'object' ? { f: f.rel, e: redact(e, words, c) } : { f: f.rel, raw: redact(raw, words, c) }));
        }
    }
    const head = JSON.stringify({ bundle: 1, sessions, files: files.map((f) => f.rel), redacted: c });
    return zlib.gzipSync(head + '\n' + lines.join('\n') + '\n');
}

function unpack(buf) {
    const rows = zlib.gunzipSync(buf).toString('utf8').split('\n').filter(Boolean);
    const head = JSON.parse(rows[0]);
    const parts = new Map(head.files.map((r) => [r, []]));
    for (const raw of rows.slice(1)) {
        const row = JSON.parse(raw);
        if (!parts.has(row.f)) parts.set(row.f, []);
        if (row.e !== undefined) parts.get(row.f).push(row.e);
    }
    return { head, parts };
}

module.exports = { filesOf, pack, unpack };
```

4. Run `node --test tests/bundle.test.js` and watch it pass.
5. Commit.

## Task 3: conversation.js reads a bundle and keeps tool turns

**Files:**
- Modify: `lib/conversation.js` — `turnsOf(entries, opts)` with `opts.tools`; `markdownOf` renders `tool` and `result` turns
- Modify: `scripts/conversation.js` — `--bundle`, `--part`, `--list`, `--tools`
- Test: `tests/conversation-bundle.test.js`

**Interfaces:**
- Consumes: `unpack(buf)` from Task 2.
- Produces: `turnsOf(entries, { tools: boolean })` — turns of kind `tool` `{ kind, at, name, text, id }` and `result` `{ kind, at, text, id }` when `tools`; unchanged without it. CLI `conversation.js --bundle <file> [--part <rel>] [--list] [--tools] [--format md|jsonl] [--out <file>]`.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Write the failing test, in `tests/conversation-bundle.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');
const bundle = require('../lib/bundle.js');
const { turnsOf } = require('../lib/conversation.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'conversation.js');
const A = 'aaaaaaaa-1111-2222-3333-444444444444';
const ENTRIES = [
    { type: 'user', timestamp: '2026-10-20T01:00:00Z', message: { role: 'user', content: 'list it' } },
    { type: 'assistant', timestamp: '2026-10-20T01:00:01Z', message: { id: 'm1', role: 'assistant', content: [{ type: 'text', text: 'ok' }, { type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'ls' } }] } },
    { type: 'user', timestamp: '2026-10-20T01:00:02Z', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'a.txt' }] } },
];

function seedBundle() {
    const cfg = tmp('fankeel-convb-');
    const dir = path.join(cfg, 'projects', 'p');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, A + '.jsonl'), ENTRIES.map((e) => JSON.stringify(e)).join('\n') + '\n');
    const file = path.join(cfg, 'b.jsonl.gz');
    fs.writeFileSync(file, bundle.pack([A], bundle.filesOf(cfg, A), [], {}));
    return file;
}

test('turnsOf keeps tool calls and results only when asked', () => {
    assert.deepEqual(turnsOf(ENTRIES).turns.map((t) => t.kind), ['user', 'claude']);
    const kinds = turnsOf(ENTRIES, { tools: true }).turns.map((t) => t.kind);
    assert.deepEqual(kinds, ['user', 'claude', 'tool', 'result']);
    const tool = turnsOf(ENTRIES, { tools: true }).turns[2];
    assert.equal(tool.name, 'Bash');
    assert.equal(tool.text, '{"command":"ls"}');
});

test('--bundle --tools gives as many tool turns as the source has tool_use blocks', () => {
    const out = execFileSync(process.execPath, [SCRIPT, '--bundle', seedBundle(), '--tools', '--format', 'jsonl'], { encoding: 'utf8' });
    const turns = out.trim().split('\n').map((l) => JSON.parse(l));
    assert.equal(turns.filter((t) => t.kind === 'tool').length, 1);
    assert.equal(turns.filter((t) => t.kind === 'result')[0].text, 'a.txt');
});

test('--bundle --list names each part', () => {
    const out = execFileSync(process.execPath, [SCRIPT, '--bundle', seedBundle(), '--list'], { encoding: 'utf8' });
    assert.match(out, new RegExp('^' + A + '\\.jsonl  3 lines$', 'm'));
});

test('markdown shows a tool call and its result', () => {
    const out = execFileSync(process.execPath, [SCRIPT, '--bundle', seedBundle(), '--tools'], { encoding: 'utf8' });
    assert.match(out, /### Tool · Bash/);
    assert.match(out, /<details><summary>Result<\/summary>/);
});
```

2. Run `node --test tests/conversation-bundle.test.js` and watch it fail.
3. Write the implementation. In `lib/conversation.js`, change the head of `turnsOf` to take options:

```js
function turnsOf(entries, opts) {
    const tools = Boolean(opts && opts.tools);
```

   In `lib/conversation.js`, in `turnsOf`'s user-content loop, replace the `tool_result` branch with:

```js
            for (const b of Array.isArray(content) ? content : []) {
                if (b && b.type === 'tool_result') {
                    if (tools) turns.push({ kind: 'result', at, text: usage.textOf(b.content).trim(), id: b.tool_use_id || null });
                    else skipped.tool += 1;
                } else if (b && b.type === 'text' && typeof b.text === 'string') typed(b.text, at);
            }
```

   In `lib/conversation.js`, in `turnsOf`'s assistant-content loop, make the first statement of the loop body:

```js
            if (tools && b && b.type === 'tool_use') {
                turns.push({ kind: 'tool', at, name: String(b.name || ''), text: JSON.stringify(b.input || {}), id: b.id || null });
                lastId = null;
                continue;
            }
```

   In `lib/conversation.js`, in `markdownOf`, before the final `else` branch, add:

```js
        } else if (t.kind === 'tool') {
            out.push('### Tool · ' + t.name + ' · ' + stamp(t.at), '', '````json', t.text, '````', '');
        } else if (t.kind === 'result') {
            out.push('<details><summary>Result</summary>', '', '````text', t.text, '````', '', '</details>', '');
```

   and in the header comment of `lib/conversation.js`, after "A subagent's own transcript is not read.", add the line `// With { tools: true }, tool calls and tool results are turns of their own.`

   In `scripts/conversation.js`, add `const bundle = require('../lib/bundle.js');` after the `conversation` require, add these lines to `HELP` after the usage line:

```js
    '       node scripts/conversation.js --bundle <file.jsonl.gz> [--part <rel>] [--list] [--tools] [--format md|jsonl] [--out <file>]',
    '--bundle reads a bundle record.js session wrote; --part picks one transcript in it, the first by default;',
    '--list prints its parts. --tools keeps tool calls and tool results as turns.',
```

   and in `scripts/conversation.js` add to the `options` of `parseArgs`:

```js
            bundle: { type: 'string' },
            part: { type: 'string' },
            list: { type: 'boolean' },
            tools: { type: 'boolean' },
```

   Then in `scripts/conversation.js` replace everything from `if (values.help || !values.session) {` down to the line `read.skipped.unparsed = stats.unparsed;` with:

```js
    if (values.help || (!values.session && !values.bundle)) {
        process.stdout.write(HELP + '\n');
        return values.help ? 0 : 2;
    }
    const format = values.format || 'md';
    if (format !== 'md' && format !== 'jsonl') {
        process.stderr.write('conversation: --format is md or jsonl, not ' + format + '\n');
        return 2;
    }
    const stats = { unparsed: 0 };
    let entries;
    let file;
    let session = values.session;
    if (values.bundle) {
        const { head, parts } = bundle.unpack(fs.readFileSync(values.bundle));
        if (values.list) {
            process.stdout.write(head.files.map((r) => r + '  ' + (parts.get(r) || []).length + ' lines').join('\n') + '\n');
            return 0;
        }
        const rel = values.part || head.files[0];
        if (!parts.has(rel)) {
            process.stderr.write('conversation: no part ' + rel + ' in ' + values.bundle + '\n');
            return 1;
        }
        entries = parts.get(rel);
        file = values.bundle + '#' + rel;
        session = session || head.sessions[0];
    } else {
        const configDir = values['config-dir'] || liveConfigDir();
        file = transcriptOf(configDir, values.session);
        if (!file) {
            process.stderr.write('conversation: no transcript for session ' + values.session + ' under ' + configDir + '/projects\n');
            return 1;
        }
        entries = entriesOf(file, stats);
        if (!entries) {
            process.stderr.write('conversation: cannot read ' + file + '\n');
            return 1;
        }
    }
    const read = conversation.turnsOf(entries, { tools: Boolean(values.tools) });
    read.skipped.unparsed = stats.unparsed;
```

   and in the `markdownOf` call on the next line, pass `{ session, file }` instead of `{ session: values.session, file }`.
4. Run `node --test tests/conversation-bundle.test.js tests/conversation.test.js` and watch both pass.
5. Commit.

## Task 4: adopt remembers the session it took over

**Files:**
- Modify: `scripts/task.js:1385-1420` — `sessions` in `cmdAdopt`'s `data`
- Test: `tests/adopt-sessions.test.js`

**Interfaces:**
- Consumes: none
- Produces: registry entry field `sessions: string[]` — every earlier session id this task passed through, oldest first.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Write the failing test, in `tests/adopt-sessions.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const registry = require('../lib/registry.js');
const tmp = require('./tmp.js');

const TASK = path.join(__dirname, '..', 'scripts', 'task.js');
const A = 'aaaaaaaa-0000-4000-8000-00000000000a';
const B = 'bbbbbbbb-0000-4000-8000-00000000000b';
const C = 'cccccccc-0000-4000-8000-00000000000c';

function task(p, session, args) {
  const r = spawnSync(process.execPath, [TASK, ...args, '--session', session, '--root', p.dir, '--claude-dir', p.cfg], {
    encoding: 'utf8', cwd: p.dir, env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: p.cfg, FANKEEL_SERVE: 'off' }),
  });
  return { out: r.stdout + r.stderr, code: r.status };
}

test('adopt records the source session, and a second adopt carries the first', () => {
  const p = { dir: tmp('fankeel-adopt-'), cfg: tmp('fankeel-cfg-') };
  fs.mkdirSync(path.join(p.dir, '.fankeel'), { recursive: true });
  registry.ensureLayout(p.dir);
  const now = new Date().toISOString();
  registry.writeSession(p.dir, A, { task: 'retro bundle', stage: 'build', route: ['design', 'build', 'land'], active: true, claims: [], started: now, updated: now });
  let r = task(p, B, ['adopt', A]);
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(registry.readSession(p.dir, B).sessions, [A]);
  r = task(p, C, ['adopt', B]);
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(registry.readSession(p.dir, C).sessions, [A, B]);
});
```

2. Run `node --test tests/adopt-sessions.test.js` and watch it fail: `sessions` is `undefined`.
3. Write the implementation. In `scripts/task.js`, in `cmdAdopt`'s `data` literal, after the `started:` property, add:

```js
        // Every session this task passed through, oldest first, so land's
        // export (`record.js session`) can bundle all of them.
        sessions: (Array.isArray(source.sessions) ? source.sessions : []).concat(from),
```

4. Run `node --test tests/adopt-sessions.test.js tests/init-entry.test.js` and watch both pass.
5. Commit.

## Task 5: `record.js session` and `record.js sessions --list`

**Files:**
- Modify: `scripts/record.js` — `activeEntry`, `recordsRel`, `appendUnder`, `exportSession`, `listBundles`; `write` uses the first two
- Read: `lib/bundle.js` — `filesOf`, `pack` from Task 2
- Read: `lib/sensitive.js` — `readList` from Task 1
- Read: `lib/registry.js` — `ensureIgnored(projectRoot, names)`, `update`
- Test: `tests/record-bundle.test.js`

**Interfaces:**
- Consumes: `filesOf`, `pack` from Task 2; `readList` from Task 1; registry field `sessions` from Task 4.
- Produces: in `scripts/record.js`, `activeEntry(opts) -> { root, mine, projectRoot }`, `recordsRel(projectRoot) -> string`, `appendUnder(file, anchor, text) -> boolean`, exported beside `parse` and `problems`. Registry `record.bundle = { path, bytes, committed, sessions, redacted }`. CLI `record.js session --session <id> [--commit]` and `record.js sessions --list`.

**Dispatch:** implementer, opus — the anchor insertion has to be reasoned about against a month file holding other entries, not transcribed.

1. Write the failing test, in `tests/record-bundle.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { execFileSync } = require('node:child_process');
const registry = require('../lib/registry.js');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'record.js');
const A = 'aaaaaaaa-1111-2222-3333-444444444444';
const KEY = 'sk-ant-' + 'x'.repeat(24);
const GOOD = [
    '要求: 收尾時把整場對話存下來。',
    '做了什麼:',
    '  - 收尾時可以匯出整場對話',
    '為什麼這樣做: 沒有原始紀錄，只能聽一個 agent 的說法。',
    '驗過・沒驗過: 單元測試全過；沒有在真的收尾裡跑過。',
    '還剩什麼: 沒有。',
].join('\n');

function seed() {
    const root = tmp('fankeel-recb-');
    registry.ensureLayout(root);
    const now = new Date().toISOString();
    registry.writeSession(root, A, { task: '匯出對話', stage: 'land', route: ['design', 'land'], active: true, claims: [], started: now, updated: now });
    fs.writeFileSync(path.join(root, '.fankeel', 'sensitive.txt'), 'Trovara\n');
    const cfg = path.join(root, 'cfg');
    const dir = path.join(cfg, 'projects', 'p');
    fs.mkdirSync(path.join(dir, A, 'subagents'), { recursive: true });
    fs.writeFileSync(path.join(dir, A + '.jsonl'), JSON.stringify({ type: 'user', timestamp: now, message: { role: 'user', content: 'key ' + KEY + ' for trovara' } }) + '\n');
    fs.writeFileSync(path.join(dir, A, 'subagents', 'agent-x.jsonl'), JSON.stringify({ type: 'user', message: { role: 'user', content: 'hi' } }) + '\n');
    return { root, cfg };
}

function run(s, args, input) {
    try {
        return { out: execFileSync(process.execPath, [SCRIPT, ...args, '--root', s.root, '--config-dir', s.cfg], { encoding: 'utf8', input: input || '' }), code: 0 };
    } catch (e) {
        return { out: String(e.stdout || '') + String(e.stderr || ''), code: e.status };
    }
}

const monthFile = (root) => path.join(root, 'docs', '90-agent', 'records', new Date().toISOString().slice(0, 7) + '.md');

test('session before write is refused and writes nothing', () => {
    const s = seed();
    const r = run(s, ['session', '--session', A]);
    assert.equal(r.code, 1);
    assert.match(r.out, /record\.js write/);
    assert.equal(fs.existsSync(path.join(s.root, '.fankeel', 'bundles')), false);
});

test('session writes a masked local bundle, ignored by git, and links it under the record', () => {
    const s = seed();
    assert.equal(run(s, ['write', '--session', A], GOOD).code, 0);
    const r = run(s, ['session', '--session', A]);
    assert.equal(r.code, 0, r.out);
    const dir = path.join(s.root, '.fankeel', 'bundles');
    const [name] = fs.readdirSync(dir);
    assert.match(name, /^\d{4}-\d{2}-\d{2}-aaaaaaaa\.jsonl\.gz$/);
    const text = zlib.gunzipSync(fs.readFileSync(path.join(dir, name))).toString('utf8');
    assert.ok(!text.includes(KEY), 'the key survived');
    assert.ok(text.includes('[REDACTED:key]') && text.includes('[REDACTED:word]'));
    assert.ok(text.includes(A + '/subagents/agent-x.jsonl'));
    assert.match(fs.readFileSync(path.join(s.root, '.fankeel', '.gitignore'), 'utf8'), /^bundles\/$/m);
    assert.match(fs.readFileSync(monthFile(s.root), 'utf8'), /- 對話紀錄：\.fankeel\/bundles\/\S+（[\d.]+ MB，local）/);
    assert.equal(registry.readSession(s.root, A).record.bundle.committed, false);
});

test('--commit puts a small bundle in the records bucket', () => {
    const s = seed();
    run(s, ['write', '--session', A], GOOD);
    assert.equal(run(s, ['session', '--session', A, '--commit']).code, 0);
    const dir = path.join(s.root, 'docs', '90-agent', 'records', 'sessions');
    assert.equal(fs.readdirSync(dir).length, 1);
    assert.match(fs.readFileSync(monthFile(s.root), 'utf8'), /committed）/);
});

test('sessions --list names each bundle and whether a retro of it is filed', () => {
    const s = seed();
    run(s, ['write', '--session', A], GOOD);
    run(s, ['session', '--session', A]);
    const r = run(s, ['sessions', '--list']);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /\.fankeel\/bundles\/\S+aaaaaaaa\.jsonl\.gz\s+[\d.]+ MB\s+local\s+retro: none/);
});
```

2. Run `node --test tests/record-bundle.test.js` and watch it fail.
3. Write the implementation. In `scripts/record.js`, add the requires after `const live = require('../lib/live.js');`:

```js
const bundle = require('../lib/bundle.js');
const sensitive = require('../lib/sensitive.js');
```

   In `scripts/record.js`, add to `OPTIONS`:

```js
    commit: { type: 'boolean' },
    list: { type: 'boolean' },
    transcript: { type: 'string' },
    cross: { type: 'boolean' },
```

   In `scripts/record.js`, before `function write(opts)`, add:

```js
// A bundle over this stays on this machine even with --commit: a long session
// gzips to tens of MB (docs/90-agent/judgements/2026-10-20-retro-land-vs-skill.md).
const BUNDLE_MAX = 2 * 1024 * 1024;

function activeEntry(opts) {
    if (!opts.session) fail('--session <id> is required: the record belongs to one task.');
    const root = opts.root ? path.resolve(opts.root) : registry.rootFor({ cwd: process.cwd() });
    const mine = registry.readSession(root, opts.session);
    if (!mine || mine.active !== true) fail('No active entry for ' + opts.session + ' under ' + root);
    const projectRoot = docs.projectRootsFor(root, opts.project ? [opts.project] : (mine.project ? [mine.project] : []))[0] || root;
    return { root, mine, projectRoot };
}

function recordsRel(projectRoot) {
    const { tree } = docs.read(projectRoot);
    const bucket = tree && tree.buckets.find((b) => /(^|\/)records$/.test(b.path));
    return bucket ? bucket.path : 'docs/90-agent/records';
}

// `text` goes at the end of the section `anchor` opens: before the next
// entry's anchor, or at the end of the file. False when the anchor is not there.
function appendUnder(file, anchor, text) {
    let before;
    try { before = fs.readFileSync(file, 'utf8'); } catch (e) { return false; }
    const at = before.indexOf('<a id="' + anchor + '"></a>');
    if (at < 0) return false;
    const next = before.indexOf('\n<a id="', at + 1);
    const cut = next < 0 ? before.length : next + 1;
    const head = before.slice(0, cut).replace(/\n*$/, '\n');
    const tail = before.slice(cut);
    fs.writeFileSync(file, head + text.replace(/\n*$/, '\n') + (tail ? '\n' + tail : ''));
    return true;
}
```

   In `scripts/record.js`, in `write`, replace its first five lines (from `if (!opts.session)` through `const projectRoot = ...`) with:

```js
    const { root, mine, projectRoot } = activeEntry(opts);
```

   and in `scripts/record.js`'s `write` replace the three lines from `const { tree } = docs.read(projectRoot);` through `const rel = (bucket ? ...` with:

```js
    const rel = recordsRel(projectRoot) + '/' + new Date(now).toISOString().slice(0, 7) + '.md';
```

   In `scripts/record.js`, after `write`, add:

```js
function exportSession(opts) {
    const { root, mine, projectRoot } = activeEntry(opts);
    if (!mine.record) fail('No record for ' + opts.session + ' yet: run `record.js write` first, so the bundle has an entry to hang under.');
    const list = sensitive.readList(projectRoot);
    if (list.error) fail('Nothing written: .fankeel/sensitive.txt exists but could not be read (' + list.error + '), so nothing could be masked against it.');
    const configDir = opts['config-dir'] || mine.configDir || live.liveConfigDir();
    const ids = (Array.isArray(mine.sessions) ? mine.sessions : []).concat(opts.session);
    const files = [].concat(...ids.map((id) => bundle.filesOf(configDir, id)));
    if (!files.length) fail('Nothing written: no transcript for ' + ids.join(', ') + ' under ' + configDir + '/projects.');
    const counts = {};
    const gz = bundle.pack(ids, files, list.words, counts);
    const name = new Date().toISOString().slice(0, 10) + '-' + String(opts.session).slice(0, 8) + '.jsonl.gz';
    const committed = Boolean(opts.commit) && gz.length <= BUNDLE_MAX;
    const rel = committed ? recordsRel(projectRoot) + '/sessions/' + name : '.fankeel/bundles/' + name;
    if (!committed) registry.ensureIgnored(projectRoot, ['bundles/']);
    const file = path.join(projectRoot, ...rel.split('/'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, gz);
    const size = (gz.length / 1048576).toFixed(1) + ' MB';
    const month = path.join(projectRoot, ...mine.record.file.split('/'));
    if (!appendUnder(month, mine.record.anchor, '- 對話紀錄：' + rel + '（' + size + '，' + (committed ? 'committed' : 'local') + '）')) {
        fail('Bundle written to ' + rel + ', but ' + mine.record.file + ' has no #' + mine.record.anchor + ' to link it under.');
    }
    registry.update(root, opts.session, (d) => {
        d.record.bundle = { path: rel, bytes: gz.length, committed, sessions: ids, redacted: counts };
    });
    const out = ['bundle: ' + rel, 'size: ' + size + '，' + files.length + ' transcripts from ' + ids.length + ' sessions',
        'masked: ' + (Object.keys(counts).map((k) => k + ' ' + counts[k]).join(', ') || 'nothing')];
    if (opts.commit && !committed) out.push('kept local: over ' + BUNDLE_MAX / 1048576 + ' MB, so it was not put where git would carry it.');
    process.stdout.write(out.join('\n') + '\n');
}

function listBundles(opts) {
    const root = opts.root ? path.resolve(opts.root) : registry.rootFor({ cwd: process.cwd() });
    const projectRoot = opts.project ? path.resolve(opts.project) : root;
    const records = recordsRel(projectRoot);
    const recordsDir = path.join(projectRoot, ...records.split('/'));
    let months = '';
    try {
        for (const n of fs.readdirSync(recordsDir)) if (n.endsWith('.md')) months += fs.readFileSync(path.join(recordsDir, n), 'utf8');
    } catch (e) { /* no records yet */ }
    const rows = [];
    for (const [dir, where] of [['.fankeel/bundles', 'local'], [records + '/sessions', 'committed']]) {
        let names = [];
        try { names = fs.readdirSync(path.join(projectRoot, ...dir.split('/'))).filter((n) => n.endsWith('.jsonl.gz')).sort(); } catch (e) { continue; }
        for (const n of names) {
            const bytes = fs.statSync(path.join(projectRoot, ...dir.split('/'), n)).size;
            const filed = months.includes('<summary>retro ' + n.slice(11, 19) + ' ');
            rows.push(dir + '/' + n + '  ' + (bytes / 1048576).toFixed(1) + ' MB  ' + where + '  retro: ' + (filed ? 'filed' : 'none'));
        }
    }
    process.stdout.write((rows.length ? rows.join('\n') : 'no bundles') + '\n');
}
```

   In `scripts/record.js`, replace `main` with:

```js
function main(argv) {
    const { values, positionals } = parseArgv({ args: argv, options: OPTIONS, allowPositionals: true });
    const verb = positionals[0];
    if (verb === 'write') return write(values);
    if (verb === 'session') return exportSession(values);
    if (verb === 'sessions' && values.list) return listBundles(values);
    fail('record.js write|session|sessions --list --session <id> [--commit] [--root <dir>] [--project <dir>] [--config-dir <dir>]');
}
```

   and in `scripts/record.js` replace the exports line with:

```js
module.exports = { parse, problems, activeEntry, recordsRel, appendUnder };
```

4. Run `node --test tests/record-bundle.test.js tests/record.test.js tests/record-lock.test.js` and watch all pass.
5. Commit.

## Task 6: `record.js retro`, and `--cross`

**Files:**
- Modify: `scripts/record.js` — `fileRetro`, `fileCross`, the `retro` verb
- Modify: `scripts/judge.js` — export `answerFromTranscript`
- Test: `tests/record-retro.test.js`

**Interfaces:**
- Consumes: `activeEntry`, `recordsRel`, `appendUnder` from Task 5; `answerFromTranscript(file) -> string` from `scripts/judge.js`.
- Produces: CLI `record.js retro --session <id> --transcript <agent jsonl> < disposition` and `record.js retro --cross < report`; registry `record.retro = { at, turns, hunks }`; a `<summary>retro <id8> · <iso> · 原文</summary>` block that `sessions --list` (Task 5) detects.

**Dispatch:** implementer, opus — two refusals and an insertion between other entries have to be reasoned about, not transcribed.

1. Write the failing test, in `tests/record-retro.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const registry = require('../lib/registry.js');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'record.js');
const A = 'aaaaaaaa-1111-2222-3333-444444444444';
const B = 'bbbbbbbb-1111-2222-3333-444444444444';
const GOOD = [
    '要求: 回顧要留下原文。',
    '做了什麼:',
    '  - 回顧的原文會存進紀錄',
    '為什麼這樣做: 轉述會走樣。',
    '驗過・沒驗過: 單元測試全過；沒有在真的收尾裡跑過。',
    '還剩什麼: 沒有。',
].join('\n');
const HANDBACK = 'retro: ' + A + ' — 12 turns read, 1 hunks\nevidence: turn 3 — "mover committed directly"\n--- a/x.md\n+++ b/x.md';

function seed() {
    const root = tmp('fankeel-recr-');
    registry.ensureLayout(root);
    const now = new Date().toISOString();
    for (const id of [A, B]) registry.writeSession(root, id, { task: 'task ' + id.slice(0, 1), stage: 'land', route: ['design', 'land'], active: true, claims: [], started: now, updated: now });
    const agent = path.join(root, 'agent-r.jsonl');
    const write = (text) => fs.writeFileSync(agent, JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', name: 'SubagentHandback', input: { message: text } }] } }) + '\n');
    write(HANDBACK);
    return { root, agent, write };
}

function run(s, args, input) {
    try {
        return { out: execFileSync(process.execPath, [SCRIPT, ...args, '--root', s.root, '--config-dir', path.join(s.root, 'cfg')], { encoding: 'utf8', input: input || '' }), code: 0 };
    } catch (e) {
        return { out: String(e.stdout || '') + String(e.stderr || ''), code: e.status };
    }
}

const monthFile = (root) => path.join(root, 'docs', '90-agent', 'records', new Date().toISOString().slice(0, 7) + '.md');

test('a retro is filed verbatim between its anchor and the next entry', () => {
    const s = seed();
    run(s, ['write', '--session', A], GOOD);
    run(s, ['write', '--session', B], GOOD);
    const r = run(s, ['retro', '--session', A, '--transcript', s.agent], '採納: x.md hunk 1 → fixer');
    assert.equal(r.code, 0, r.out);
    const text = fs.readFileSync(monthFile(s.root), 'utf8');
    const at = text.indexOf('<summary>retro aaaaaaaa ');
    assert.ok(at > text.indexOf('<a id="r-') && at < text.lastIndexOf('<a id="r-'), 'not under A');
    assert.ok(text.includes(HANDBACK));
    assert.ok(text.includes('採納: x.md hunk 1 → fixer'));
    assert.deepEqual([registry.readSession(s.root, A).record.retro.turns, registry.readSession(s.root, A).record.retro.hunks], [12, 1]);
});

test('a hand-back that does not open with retro: is refused and nothing changes', () => {
    const s = seed();
    run(s, ['write', '--session', A], GOOD);
    const before = fs.readFileSync(monthFile(s.root), 'utf8');
    s.write('handing back now');
    const r = run(s, ['retro', '--session', A, '--transcript', s.agent]);
    assert.equal(r.code, 1);
    assert.match(r.out, /retro: <session>/);
    assert.equal(fs.readFileSync(monthFile(s.root), 'utf8'), before);
});

test('a retro with no record yet is refused', () => {
    const s = seed();
    const r = run(s, ['retro', '--session', A, '--transcript', s.agent]);
    assert.equal(r.code, 1);
    assert.match(r.out, /record\.js write/);
});

test('--cross files a report as its own section, and refuses one with no recurring: line', () => {
    const s = seed();
    assert.equal(run(s, ['retro', '--cross'], 'nothing here').code, 1);
    const r = run(s, ['retro', '--cross'], 'recurring: mover commits — 2/3 bundles — evidence: aaaaaaaa#12, bbbbbbbb#40');
    assert.equal(r.code, 0, r.out);
    const text = fs.readFileSync(monthFile(s.root), 'utf8');
    assert.match(text, /<a id="x-\d{4}-\d{2}-\d{2}"><\/a>\n\n## \d{4}-\d{2}-\d{2} 跨 session 回顧/);
    assert.ok(text.includes('recurring: mover commits'));
});
```

2. Run `node --test tests/record-retro.test.js` and watch it fail.
3. Write the implementation. In `scripts/judge.js`, change its last line to:

```js
module.exports = { firstLine, freePath, indexRow, answerFromTranscript };
```

   In `scripts/record.js`, after `listBundles`, add:

```js
const RETRO_HEAD = /^retro: (\S+) — (\d+) turns read, (\d+) hunks/;

// The retro's hand-back as it returned it, copied from its transcript the way
// judge.js copies a judgement, and the disposition the gate settled on stdin.
function fileRetro(opts) {
    const { root, mine, projectRoot } = activeEntry(opts);
    if (!mine.record) fail('No record for ' + opts.session + ' yet: a retro is filed under the task\'s record, so run `record.js write` first.');
    if (!opts.transcript) fail('--transcript <session>/subagents/agent-<id>.jsonl is required: the hand-back is copied from there, never retyped.');
    const { answerFromTranscript } = require('./judge.js');
    const answer = answerFromTranscript(opts.transcript).trim();
    const head = RETRO_HEAD.exec(answer);
    if (!head) fail('Nothing written: the hand-back does not open with `retro: <session> — <n> turns read, <n> hunks`, so it is not what the retro returned.');
    const disposition = fs.readFileSync(0, 'utf8').trim();
    const at = new Date().toISOString();
    const block = ['', '<details>', '<summary>retro ' + String(opts.session).slice(0, 8) + ' · ' + at + ' · 原文</summary>', '',
        '````text', answer, '````', '', '```text', disposition || '（沒有處置）', '```', '', '</details>'].join('\n');
    const month = path.join(projectRoot, ...mine.record.file.split('/'));
    if (!appendUnder(month, mine.record.anchor, block)) fail('Nothing written: ' + mine.record.file + ' has no #' + mine.record.anchor + '.');
    registry.update(root, opts.session, (d) => {
        d.record.retro = { at, turns: Number(head[2]), hunks: Number(head[3]) };
    });
    process.stdout.write('filed: ' + mine.record.file + '#' + mine.record.anchor + '\n');
}

// /fankeel-retro-all's ranked report, as its own section of the month file.
function fileCross(opts) {
    const root = opts.root ? path.resolve(opts.root) : registry.rootFor({ cwd: process.cwd() });
    const projectRoot = opts.project ? path.resolve(opts.project) : root;
    const report = fs.readFileSync(0, 'utf8').trim();
    if (!/^(recurring: |clean$)/m.test(report)) fail('Nothing written: a cross-bundle report holds `recurring:` lines, or `clean`.');
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    const rel = recordsRel(projectRoot) + '/' + day.slice(0, 7) + '.md';
    const file = path.join(projectRoot, ...rel.split('/'));
    const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const base = 'x-' + day;
    const taken = (before.match(new RegExp('<a id="' + base + '(-\\d+)?"></a>', 'g')) || []).length;
    const anchor = taken ? base + '-' + (taken + 1) : base;
    const head = before ? before.replace(/\n*$/, '\n\n') : '# 任務完成紀錄 ' + day.slice(0, 7) + '\n\n';
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, head + ['<a id="' + anchor + '"></a>', '', '## ' + day + ' 跨 session 回顧', '', '````text', report, '````', ''].join('\n'));
    process.stdout.write('filed: ' + rel + '#' + anchor + '\n');
}
```

   In `scripts/record.js`, in `main`, before the `fail(` line, add:

```js
    if (verb === 'retro') return values.cross ? fileCross(values) : fileRetro(values);
```

   and change that `fail(` text to `'record.js write|session|retro|sessions --list --session <id> [--commit] [--transcript <jsonl>] [--cross] [--root <dir>] [--project <dir>] [--config-dir <dir>]'`.
4. Run `node --test tests/record-retro.test.js tests/record-bundle.test.js tests/judge.test.js` and watch all pass.
5. Commit.

## Task 7: the retro reads a bundle, and land asks for the export

**Files:**
- Modify: `agents/fankeel-retro.md` — opus; `bundle <path>`; `--tools`
- Modify: `skills/fankeel-land/SKILL.md:250-263` — the export question, then the retro, then `record.js retro`
- Modify: `lib/stages.js:396-405` — one land rule before `Output:`
- Test: `tests/agents.test.js`
- Test: `tests/stages.test.js`
- Test: `tests/skill-size.test.js` — raise the `fankeel-land` cap

**Interfaces:**
- Consumes: CLI `record.js session` (Task 5), `record.js retro` (Task 6), `conversation.js --bundle --tools` (Task 3).
- Produces: retro brief form `session <id>`, `bundle <path>`, `<plugin>`.

**Dispatch:** in-session — prose in three files that must say one thing, with two existing tests rewritten to match it.

1. Write the failing tests. In `tests/agents.test.js`, in the test `'the retro reads one session through conversation.js and returns a diff with evidence'`, replace `assert.equal(f.model, 'sonnet');` with `assert.equal(f.model, 'opus');` and `assert.match(job, /scripts\/conversation\.js --session <id>/);` with:

```js
    assert.match(job, /scripts\/conversation\.js --bundle <path> --part <id>\.jsonl --tools/);
    assert.match(job, /`bundle <path>`/);
```

   In `tests/stages.test.js`, in the test `'land may dispatch the retro reviewer, and its skill sends it only on a yes'`, replace `assert.match(land, /scripts\/conversation\.js --session <id>/);` with:

```js
  assert.match(land, /scripts\/record\.js session --session <id>/);
  assert.match(land, /scripts\/record\.js retro --session <id> --transcript/);
  assert.match(land, /scripts\/conversation\.js --bundle <path> --tools/);
  assert.ok(byName('land').rules.some((r) => /record\.js session/.test(r)), 'the land rules do not ask for the export');
```

2. Run `node --test tests/agents.test.js tests/stages.test.js` and watch both fail.
3. Write the change. In `agents/fankeel-retro.md`, set the frontmatter `model: opus`, and replace the `## Job` paragraph that begins "Your brief names" with:

```md
Your brief names `session <id>`, `<plugin>`, and `bundle <path>` — a bundle
`record.js session` wrote, every string already masked. Run
`node <plugin>/scripts/conversation.js --bundle <path> --list` for its parts,
then `node <plugin>/scripts/conversation.js --bundle <path> --part <id>.jsonl --tools`
from the project root and read what it prints: what the user typed, what
Claude wrote and every tool call and result, in order, with every compaction
marked. Open a `subagents/` part only where a hand-back you cite is the
evidence. A brief with no bundle reads
`node <plugin>/scripts/conversation.js --session <id> --tools` instead. A long
read comes back as `Output too large` with `Full output saved to: <file>`;
Read that file in parts rather than running the script again.
```

   In `agents/fankeel-retro.md`, in `## Refuse`, change "Never read a transcript other than the one the brief names" to "Never read a transcript other than the session or bundle the brief names".

   In `skills/fankeel-land/SKILL.md`, replace the paragraph that begins `**A retro, offered and never assumed.**` with:

```md
**An export, asked every time; a retro, offered after it.** After `record.js
write` and before standing the task down, the gate asks one question it never
skips: export this session? On yes, `node <plugin>/scripts/record.js session --session <id>`
packs the main transcript and every subagent transcript of this session and of
the sessions it was adopted from, masks every word of `.fankeel/sensitive.txt`
and every key shape as `[REDACTED:<kind>]`, writes
`.fankeel/bundles/<day>-<id8>.jsonl.gz`, and adds a `對話紀錄` line under the
task's record; `--commit` puts a bundle of 2 MB or less in the records bucket
instead, so it travels with the work. Only after an export is the retro offered,
as an option on the gate: `fankeel-retro` reads the bundle with
`scripts/conversation.js --bundle <path> --tools` and returns a unified diff
proposing edits to `skills/` or `CLAUDE.md`, one `evidence:` line per hunk, and
writes nothing. The option's description says what it costs and what it reads:
the whole session, tool results included, passes through one opus context, tens
of thousands of tokens on a long session, and that bundle holds everything said
here — so nothing runs until the user says yes in this session. On the yes, say
how many and on which model before it goes: one `subagent_type: fankeel:fankeel-retro`,
on the opus its file pins, its prompt naming `session <id>`, `bundle <path>` and
`<plugin>`. Its diff is shown at the next gate and never applied on the same
yes; an approved hunk goes to one `fankeel:fankeel-fixer` per file, as the
slimmer's do. Then file it: `node <plugin>/scripts/record.js retro --session <id> --transcript <session>/subagents/agent-<id>.jsonl`,
the disposition — which hunks were approved, which rejected and why, where each
`backlog:` went — on stdin. The bundle and the filed retro are what
`/fankeel-retro-all` reads later. A land brain sends it only when its brief
carries that yes; otherwise its gate carries the offer.
```

   In `lib/stages.js`, in the land stage's `rules`, insert before the rule that begins `'Output: `:

```js
            'The gate always asks to export this session (`record.js session`); the retro is offered only after it, and filed by `record.js retro`.',
```

   Then measure the land skill — `node -e "console.log(require('fs').statSync('skills/fankeel-land/SKILL.md').size)"` — and in `tests/skill-size.test.js` set `'fankeel-land'` in `CAPS` to the smallest multiple of 100 above that number; the paragraph is longer, and the cap is a decision made there.
4. Run `node --test tests/agents.test.js tests/stages.test.js tests/skill-size.test.js` and watch all pass.
5. Commit.

## Task 8: `/fankeel-retro-all`

**Files:**
- Modify: `skills/fankeel-retro-all/SKILL.md` — new skill
- Modify: `docs/90-agent/reference/subagents.md` — the retro is sent at land and by the skill
- Test: `tests/skill-size.test.js`

**Interfaces:**
- Consumes: `record.js sessions --list` (Task 5), `record.js retro --cross` (Task 6), retro brief `bundle <path>` (Task 7).
- Produces: none

**Dispatch:** implementer, opus — a skill's prose has to hold its own rules against the plugin's existing ones, not be transcribed.

1. Write the failing test. In `tests/skill-size.test.js`, add to `CAPS`, in byte order:

```js
    'fankeel-retro-all': 4400,
```

2. Run `node --test tests/skill-size.test.js` and watch it fail: a cap for no skill.
3. Write `skills/fankeel-retro-all/SKILL.md`:

```md
---
name: fankeel-retro-all
description: Review every exported session bundle for problems that recur across tasks — this machine's and other users' — and propose skill, agent or stage-rule edits only for what recurs. Use for /fankeel-retro-all, "跑全部 retro", "回顧所有 session", or after pulling bundles another user committed.
version: 0.111.46
status: current
last_verified: 2026-10-20
source_of_truth: scripts/record.js, agents/fankeel-retro.md
---

# fankeel-retro-all

Produces a ranked list of problems that recur across bundles, filed, and at
most five edits for the user to approve.

**Done when** every bundle the user picked has a retro, filed or fresh, the
recurring problems are ranked with their evidence, the report is filed with
`record.js retro --cross`, and the gate has asked about the edits.

- **One path, never a search.** `<plugin>` is two directories up from this
  file; resolve every script against that root. Where the registry root's own
  `package.json` names `fankeel`, run the working tree's scripts.
- **A missing script stops this, named.**

## 1. List

`node <plugin>/scripts/record.js sessions --list` prints one row per bundle:
its path, size, `local` or `committed`, and `retro: filed` or `retro: none`.
Ask the user which to read — all, or a range by date — with `AskUserQuestion`.

## 2. Read

A bundle with `retro: filed` costs nothing: read its `<details>` block from
the month file under `docs/90-agent/records/`, found by `<summary>retro <id8>`.

A bundle with `retro: none` gets one `subagent_type: fankeel:fankeel-retro`,
on the opus its file pins, prompt `session <id8>`, `bundle <path>` and
`<plugin>`. Send at most `dispatch.inflight` in one response (eight by
default), and say how many and on which model in that response. A bundle
never passes through this context whole: only the retros' returns do.

## 3. Rank

A problem is **recurring** when two or more bundles carry evidence for it.
Only a recurring problem gets a hunk — at most five, the most bundles first —
and those hunks may touch `skills/`, `agents/`, `lib/stages.js` or
`CLAUDE.md`. A problem seen once is listed as `once:` with no hunk, because
one session is not evidence for a rule. A fix that needs code is a `backlog:`
line.

The report, in this order:

    recurring: <problem> — <k>/<n> bundles — evidence: <id8> turn <t>, <id8> turn <t>
    <unified diff for it>
    once: <problem> — <id8> turn <t>
    backlog: <what code would make it impossible> — <path>

Nothing recurring: the single line `clean`.

## 4. File, then the gate

Pipe the report to `node <plugin>/scripts/record.js retro --cross`, which files
it as its own section of the month's records file. Then ask with
`AskUserQuestion`: approve the hunks, which go to one
`fankeel:fankeel-fixer` per file; turn the `backlog:` lines into TODO entries
with `todo.js new --state decision`; or neither. Nothing is applied before
the answer.
```

   Then measure it — `node -e "console.log(require('fs').statSync('skills/fankeel-retro-all/SKILL.md').size)"` — and set its `CAPS` entry to the smallest multiple of 100 above that number.

   In `docs/90-agent/reference/subagents.md`, replace "`fankeel-retro` is sent at `land` alone, and only on the user's yes." with "`fankeel-retro` is sent at `land`, only on the user's yes and only after an export, and by `/fankeel-retro-all`, one per bundle with no retro filed."
4. Run `node --test tests/skill-size.test.js tests/skills.test.js tests/version.test.js` and watch all pass.
5. Commit.

## Coverage

| promise | task |
|---|---|
| check | struck — the header of the design's proof table, not a promise |
| `node scripts/record.js session --session <id>` packs the main transcript and every `subagents/*.jsonl` | Task 5 |
| Every string in every line is masked before it is written | Task 1, Task 2 |
| A `.fankeel/sensitive.txt` that exists and cannot be read stops the export | Task 5 |
| The bundle goes to `.fankeel/bundles/<day>-<id8>.jsonl.gz`, git-ignored. `--commit` writes it | Task 5 |
| The task's record entry gets one line, `- 對話紀錄：<path>` | Task 5 |
| `scripts/conversation.js --bundle <file>` reads a bundle in place of `--session` | Task 3 |
| `--tools` keeps tool calls and tool results as turns of their own | Task 3 |
| `adopt` records the source session in `sessions` on the new entry | Task 4 |
| `node scripts/record.js retro --session <id> --transcript <agent jsonl>` takes the retro's hand-back verbatim | Task 6 |
| A hand-back whose first line is not `retro: ` is refused | Task 6 |
| `record.js retro --cross` files a cross-bundle report | Task 6 |
| `record.js sessions --list` prints every bundle, local and committed | Task 5 |
| Land's gate always asks whether to export this session | Task 7 |
| The retro runs on opus; `task.js profile set agent.fankeel-retro.model` still overrides it | Task 7 |
| `/fankeel-retro-all` lists bundles, reads every retro already filed | Task 8 |
| A problem is recurring when two or more bundles carry evidence for it | Task 8 |
| Its report is filed with `record.js retro --cross` | Task 8 |
| a session holding a fake `sk-ant-` key exported, then gunzipped | Task 5 |
| `conversation.js --bundle <f> --tools --format jsonl` gives as many tool turns | Task 3 |
| a retro hand-back filed with `record.js retro` sits between its anchor | Task 6 |
