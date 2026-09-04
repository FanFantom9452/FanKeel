---
status: design-intent
last_verified: 2026-09-04
source_of_truth: docs/plans/2026-09-04-session-station-design.md
---

# Session Station Implementation Plan

**Goal:** one page showing every fankeel session on this machine, what each
cost, and a button to put an abandoned one down; current the moment a session
ends; TokenBar untouched and not required.

**Architecture:** fankeel's own lead files gain the registry root, so the
station can find every registry from `<configDir>/modes/`. A `SessionEnd` hook
sums the transcript once and records `ended`, `model` and `usage` on the
session's own entry, then regenerates a static page. A local server runs only
while the user is clearing, and calls the same `clearEntry` the CLI does.

**Tech Stack:** Node 24.9.0 on this machine, no `engines` floor declared;
`node:http`, `node:fs`, `node:path`, `node:os`, `node:crypto`,
`node:child_process`; zero dependencies and none may be added; `node --test`.

**Spec:** [docs/plans/2026-09-04-session-station-design.md](2026-09-04-session-station-design.md)

## Global Constraints

Generated on 2026-09-04 from `node <plugin>/scripts/map.js`, `package.json`,
`.gitattributes`, the hooks manifest and the test suite. There is no
`CLAUDE.md` and no `AGENTS.md`; conventions come from the code.

**Code shape**
- `'use strict';` first line of every file; CommonJS `require`; 4-space indent;
  `const fs = require('node:fs');` style imports; single quotes.
- Hooks open with `#!/usr/bin/env node`, go through `lib/hook.js`'s
  `run(main)` and `parse(raw)`, exit 0 on every path, and a hook on a
  non-blocking event writes nothing to stdout (`hooks/touch.js:1-17`).
- Every function that reads the disk degrades to a count, a `null` or an empty
  list; nothing here throws past its caller.
- Comments explain why, in full sentences; the repository's files are half
  comment and that is the house style.

**Files and filing**
- `package.json`: `"scripts": { "test": "node --test" }`, no dependencies, no
  `engines`. `.gitattributes`: `* text=auto eol=lf`.
- `.fankeel/map.md` filing: `docs/` reference, `docs/plans/` plan,
  `docs/reports/` report, `docs/decisions/` decision, `docs/archive/` archive,
  `skills/` reference, `output-styles/` reference; index `docs/README.md`.
- Every markdown page under `docs/` and every `skills/*/SKILL.md` opens with
  frontmatter `status`, `last_verified`, `source_of_truth`; a skill adds `name`,
  `description`, `version`.
- The hooks manifest is `.claude-plugin/plugin.json` (the `hooks` key). There is
  no `hooks/hooks.json`.
- `.fankeel/.gitignore` holds `sessions/`, `map.md`, `build/`. Nothing new is
  written under `.fankeel/` by this plan.

**Pinned by the suite**
- `tests/contract.test.js:296-335` derives the hook count from the manifest,
  requires the `hooks/` directory listing to equal the manifest's hook filenames
  (sorted `deepEqual`), and requires `README.md` and `tests/hook.test.js` to
  match `/all N\s+hooks/` and `README.md` to match `/The other M are not
  load-bearing/`, where blocking events are `UserPromptSubmit` and `PreToolUse`.
  Today N is 7 and M is 4; `SessionEnd` is non-blocking, so both become
  8 and 5 in the same change that adds `hooks/leave.js`.
- `tests/contract.test.js:260-280` pins one version string across
  `package.json`, `.claude-plugin/plugin.json` and every `skills/*/SKILL.md`,
  and asserts `found.size === 10`. A new skill makes that 11, and its
  `version:` must equal `package.json`'s (`0.43.0` at the time of writing).
- `tests/task.test.js:645-693` — `clear`: a cold claim exits 0 and prints
  `/cleared: the ramp/`; a fresh one exits 1 and prints `/the ramp @ design/`
  and `/--force/`; `--force` exits 0; clearing yourself exits 1 and mentions
  `` `down` ``. These strings do not change.
- `tests/task.test.js:912` — `show --all` prints
  `/31 total — 1 active, 30 stood down, 0 unreadable/`; unaffected.
- `tests/task.test.js:35-46` — the CLI test helper is
  `run(dir, args, env)`: spawns `scripts/task.js` with `--root <dir>
  --claude-dir <dir>/cfg` and `CLAUDE_CONFIG_DIR=<dir>/cfg`.
- `tests/inject.test.js:54-61` — the hook test helper is `run(payload,
  claudeDir)`: `execFileSync(process.execPath, [hook], { input:
  JSON.stringify(payload), env: { ...process.env, CLAUDE_CONFIG_DIR: claudeDir
  } })`. Each hook test file carries its own copy.
- `tests/live.test.js:27-39` — a running-session file is
  `<configDir>/sessions/<pid>.json` holding `{ pid, sessionId, cwd, startedAt,
  procStart, version, kind, entrypoint, status }`; `pid: process.pid` makes it
  live.
- Every lead assertion in `tests/inject.test.js` and `tests/task.test.js` is a
  per-line regex (`/^word=build$/m`, `/^guard=ask$/m`, negative
  `/^steps=/m`); none asserts the line count or the whole file, so a new
  `root=` line breaks none of them.
- `tests/registry.test.js:164-166` round-trips a fixture's own fields; no test
  enumerates the record's key set, so `ended`, `model`, `usage` break nothing.
- `tests/hook.test.js:39-41` — `run.length === 1` on `lib/hook.js`.

**Caps in code**
- `lib/badge.js:19-20,76-77` — `MAX_WORD = 16`, `SESSION_ID =
  /^[0-9a-fA-F][0-9a-fA-F-]{7,63}$/`, `MAX_LEAD_VALUE = 160`, and `writeLead`
  writes only keys in `LEAD_KEYS`, in that order, skipping empty values.
- `lib/registry.js` — `MAX_CLAIMS = 60`, `MAX_NOTES = 5`, `MAX_NOTE_LEN =
  100`, `MAX_NEXT_LEN = 120`, `STALE_MS`; `isStale(data, now)` and
  `ageText(data, now)` at :586-600 are the age rule and its wording.
- TokenBar (`F:/ymlab/TokenBar/statusline.ps1:590,598`, external): drops a lead
  over 1024 bytes or after its twelfth line. Today's largest lead is 317 bytes
  in seven lines; `root=` is one more line.

**Invariants** (`skills/fankeel/SKILL.md`, *Invariants*): never write another
session's file except `adopt`/`clear`; never set `active: false` unasked; never
edit `updated` or `claims`; never delete a session file; never advance `stage`
silently; never set `guard`. `hooks/leave.js` writes its own session's entry,
sets `ended`, `model`, `usage` and nothing else.

**Commits**: short subject, one bullet per change naming its module, one
closing paragraph where there is a why; trailers
`Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and
`Claude-Session: https://claude.ai/code/session_013VxWxwtc9NuF6RWG2RQQXB`.

## File structure

| file | responsibility |
|---|---|
| `lib/badge.js` (modify) | `root` joins `LEAD_KEYS`; `readLeads(claudeDir)` lists every lead |
| `hooks/inject.js`, `scripts/task.js` (modify) | the three lead writers pass `root` |
| `lib/usage.js` (new) | one transcript → `{ model, usage }`, one `usage` per `requestId` |
| `lib/prices.js` (new) | dated USD table and `costOf` |
| `lib/clear.js` (new) | `clearEntry`: the checks `cmdClear` makes, returned rather than printed |
| `scripts/task.js` (modify) | `cmdClear` calls `clearEntry` and prints what it printed before |
| `lib/station.js` (new) | `discover`, `gather`, `render`, `write`: the page as data and as HTML |
| `scripts/station.js` (new) | the CLI: write the page, open it, or `serve` |
| `hooks/leave.js` (new), `.claude-plugin/plugin.json` (modify) | `SessionEnd`: record the end, regenerate the page |
| `README.md`, `tests/hook.test.js` (modify) | the hook count the contract test reads |
| `skills/fankeel-station/SKILL.md` (new) | `/fankeel-station` |
| `docs/station.md` (new), `docs/registry.md`, `docs/statusline.md`, `docs/README.md`, `README.md`, `skills/fankeel/SKILL.md` (modify) | what is on disk, the fields, the lead key, the index |
| `tests/badge.test.js`, `tests/inject.test.js` (modify); `tests/usage.test.js`, `tests/prices.test.js`, `tests/clear.test.js`, `tests/station.test.js`, `tests/station-cli.test.js`, `tests/leave.test.js` (new); `tests/contract.test.js` (modify) | the criterion |

Tasks 1 and 4 both modify `scripts/task.js` and run in sequence. Tasks 2 and
3 share nothing with anything before Task 5. Task 5 needs 1 and 3; Task 6
needs 4 and 5; Task 7 needs 2 and 5; Task 8 needs all of them.

## Task 1: `root` in the lead, and a reader for every lead

**Files:**
- Modify: `lib/badge.js` — `LEAD_KEYS` gains `root`; new `readLeads`; both exported
- Modify: `hooks/inject.js` — the init lead at :106 and the per-prompt lead at :200 pass `root`
- Modify: `scripts/task.js` — `showBadge` takes `root` and passes it; every caller supplies it
- Test: `tests/badge.test.js`
- Test: `tests/inject.test.js`

**Interfaces:**
- Consumes: `badge.writeLead(claudeDir, sessionId, fields)` (`lib/badge.js:89`), `SESSION_ID` (`lib/badge.js:20`)
- Produces: `readLeads(claudeDir) → Array<{ sessionId: string, fields: { word, step?, steps?, title?, where?, guard?, others?, root? } }>`, every value a string; `LEAD_KEYS` exported. Lead key `root` = the absolute registry root the session runs under.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

**Steps**

1. Add to `tests/badge.test.js`, using the file's existing temp-dir helper and
   `SID` constant:

```js
test('readLeads lists every lead under modes/ with its fields, root included', () => {
    const dir = tmp();
    const other = 'abcdef01-2345-6789-abcd-ef0123456789';
    assert.equal(badge.writeLead(dir, SID, { word: 'build', step: 3, steps: 5, title: 't', root: 'F:\\ws' }), true);
    assert.equal(badge.writeLead(dir, other, { word: 'init', step: 0, root: '/home/u/ws' }), true);
    fs.mkdirSync(path.join(dir, 'modes', 'not-a-session-id'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'modes', 'not-a-session-id', 'fankeel.lead'), 'word=build\n');
    const leads = badge.readLeads(dir).sort((a, b) => a.sessionId.localeCompare(b.sessionId));
    assert.deepEqual(leads.map((l) => l.sessionId), [other, SID].sort());
    const mine = leads.find((l) => l.sessionId === SID);
    assert.deepEqual(mine.fields, { word: 'build', step: '3', steps: '5', title: 't', root: 'F:\\ws' });
    assert.equal(leads.find((l) => l.sessionId === other).fields.root, '/home/u/ws');
});

test('readLeads returns [] where modes/ is absent, and skips a lead with no word', () => {
    const dir = tmp();
    assert.deepEqual(badge.readLeads(dir), []);
    fs.mkdirSync(path.join(dir, 'modes', SID), { recursive: true });
    fs.writeFileSync(path.join(dir, 'modes', SID, 'fankeel.lead'), 'root=F:\\ws\n');
    assert.deepEqual(badge.readLeads(dir), []);
});
```

   `tmp()` is whatever the file already names its temp-directory helper; if it
   is called something else, use that name. Run
   `node --test tests/badge.test.js` and watch both fail on `readLeads is not
   a function`.

2. In `lib/badge.js`, change line 76 and add the reader after `writeLead`:

```js
const LEAD_KEYS = ['word', 'step', 'steps', 'title', 'where', 'guard', 'others', 'root'];
```

```js
// Every lead under `modes/`, with its fields. This is how the station finds
// the registries: `root` is the one field that names one, and it is in the
// lead because the lead is the one per-session file that already crosses
// workspaces. A directory that is not a session id, a file that cannot be
// read, and a lead with no `word` are skipped — the same silence the writer
// keeps. Values come back as the strings on disk; nothing is parsed here.
function readLeads(claudeDir) {
    const modes = path.join(String(claudeDir == null ? '' : claudeDir), 'modes');
    let names;
    try {
        names = fs.readdirSync(modes);
    } catch (e) {
        return [];
    }
    const out = [];
    for (const name of names) {
        if (!SESSION_ID.test(name)) continue;
        let text;
        try {
            text = fs.readFileSync(path.join(modes, name, 'fankeel.lead'), 'utf8');
        } catch (e) {
            continue;
        }
        const fields = {};
        for (const line of text.split(/\r?\n/)) {
            const i = line.indexOf('=');
            if (i < 1) continue;
            const key = line.slice(0, i).trim();
            if (!LEAD_KEYS.includes(key)) continue;
            const value = line.slice(i + 1).trim();
            if (value) fields[key] = value;
        }
        if (!fields.word) continue;
        out.push({ sessionId: name, fields });
    }
    return out;
}
```

   Extend the export line to
   `module.exports = { MAX_WORD, LEAD_KEYS, badgeWord, writeBadge, readBadge, clearBadge, writeLead, readLeads, clearLead, pruneBadges };`.
   Run the two tests; both pass.

3. Add to `tests/inject.test.js`, beside the existing lead assertions and using
   its `run(payload, claudeDir)` helper and whatever fixture puts a session in
   `build`:

```js
test('the lead names the registry root', () => {
    // Reuse the fixture the `/^word=build$/m` test builds; `root` is that
    // fixture's registry directory and `claudeDir` its config directory.
    const lead = fs.readFileSync(path.join(claudeDir, 'modes', SID, 'fankeel.lead'), 'utf8');
    assert.match(lead, new RegExp('^root=' + root.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&') + '$', 'm'));
});
```

   Copy the setup lines of the neighbouring `word=build` test into this one
   rather than sharing state between tests. Run it; it fails with no `root=`
   line.

4. In `hooks/inject.js`, line 106 becomes
   `badge.writeLead(dir, sessionId, { word: 'init', step: 0, root });` and the
   object at :200-209 gains `root,` as its last property (after `others`).
   `root` is the `const root = registry.rootFor(payload);` at :54 and is in
   scope at both places. Run the test; it passes.

5. In `scripts/task.js`, `showBadge` becomes
   `function showBadge(opts, sessionId, word, data, root)` and the
   `writeLead` object at :94-107 gains `root,` after `others`. Then every
   call site — `grep -n 'showBadge(' scripts/task.js` — passes `root` as the
   fifth argument; each caller is a `cmdX(root, opts)` function, so `root` is
   already in scope. Add to `tests/task.test.js`, next to the test that
   asserts `/^word=build$/m` after a `stage` command:

```js
assert.match(lead, /^root=/m);
```

   on the same lead text that test already reads. Run
   `node --test tests/badge.test.js tests/inject.test.js tests/task.test.js`;
   all green.

6. Commit: `feat: the lead names its registry root, and readLeads lists every lead`.

## Task 2: `lib/usage.js` — one transcript, summed once per request

**Files:**
- Modify: `lib/usage.js`
- Test: `tests/usage.test.js`

**Interfaces:**
- Consumes: nothing from this plan.
- Produces: `summarise(transcriptPath) → { model: string, usage: { requests: number, models: { [modelId]: { input, output, cacheRead, cacheWrite5m, cacheWrite1h } } } } | null`. `null` when the file cannot be read or holds no assistant line with usage.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

**Steps**

1. Write `tests/usage.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const usage = require('../lib/usage.js');

const line = (o) => JSON.stringify(o) + '\n';
const assistant = (requestId, model, u, extra) => line(Object.assign({
    type: 'assistant', requestId, message: { model, usage: u },
}, extra || {}));

function transcript(lines) {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-usage-')), 't.jsonl');
    fs.writeFileSync(file, lines.join(''));
    return file;
}

test('one request written three times counts once; the model with more output is the model', () => {
    const file = transcript([
        line({ type: 'user', message: { role: 'user', content: 'hi' } }),
        assistant('req_1', 'claude-fable-5-1', { input_tokens: 10, output_tokens: 100, cache_read_input_tokens: 1000,
            cache_creation_input_tokens: 40, cache_creation: { ephemeral_5m_input_tokens: 10, ephemeral_1h_input_tokens: 30 } }),
        assistant('req_1', 'claude-fable-5-1', { input_tokens: 10, output_tokens: 100, cache_read_input_tokens: 1000,
            cache_creation_input_tokens: 40, cache_creation: { ephemeral_5m_input_tokens: 10, ephemeral_1h_input_tokens: 30 } }),
        assistant('req_1', 'claude-fable-5-1', { input_tokens: 10, output_tokens: 100, cache_read_input_tokens: 1000,
            cache_creation_input_tokens: 40, cache_creation: { ephemeral_5m_input_tokens: 10, ephemeral_1h_input_tokens: 30 } }),
        assistant('req_2', 'claude-sonnet-5', { input_tokens: 5, output_tokens: 7, cache_read_input_tokens: 0, cache_creation_input_tokens: 12 }),
        'not json\n',
    ]);
    assert.deepEqual(usage.summarise(file), {
        model: 'claude-fable-5-1',
        usage: {
            requests: 2,
            models: {
                'claude-fable-5-1': { input: 10, output: 100, cacheRead: 1000, cacheWrite5m: 10, cacheWrite1h: 30 },
                'claude-sonnet-5': { input: 5, output: 7, cacheRead: 0, cacheWrite5m: 12, cacheWrite1h: 0 },
            },
        },
    });
});

test('sidechain lines and lines without usage are skipped; a line with no requestId counts on its own', () => {
    const file = transcript([
        assistant('req_9', 'claude-opus-5', { input_tokens: 1, output_tokens: 1 }, { isSidechain: true }),
        line({ type: 'assistant', message: { model: 'claude-opus-5' } }),
        line({ type: 'assistant', message: { model: 'claude-opus-5', usage: { input_tokens: 2, output_tokens: 3 } } }),
        line({ type: 'assistant', message: { model: 'claude-opus-5', usage: { input_tokens: 2, output_tokens: 3 } } }),
    ]);
    const seen = usage.summarise(file);
    assert.equal(seen.usage.requests, 2);
    assert.deepEqual(seen.usage.models['claude-opus-5'], { input: 4, output: 6, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 });
});

test('null for a missing file and for a transcript with nothing to sum', () => {
    assert.equal(usage.summarise(path.join(os.tmpdir(), 'fankeel-no-such-transcript.jsonl')), null);
    assert.equal(usage.summarise(transcript([line({ type: 'user' })])), null);
});
```

   Run `node --test tests/usage.test.js`; fails on `Cannot find module`.

2. Write `lib/usage.js`:

```js
'use strict';
// What a session's transcript says it spent, summed once at the end of the
// session rather than on every prompt — `lib/context.js` reads a tail sixty
// times an hour; this reads the whole file once, when nothing is waiting on it.
//
// Every `type: "assistant"` line carries `message.model` and `message.usage`.
// One request writes several such lines with the same usage on each: measured
// 2026-09-04, 76 assistant lines for 25 `requestId`s, one of them six times
// with `output_tokens: 1061` on every copy. Summing lines over-counts
// threefold, so the sum is over distinct `requestId`, last line winning. A line
// with no `requestId` at all is counted on its own — there is nothing to
// de-duplicate it against.
//
// Cache writes arrive split by TTL under `cache_creation` on current
// transcripts, and as one `cache_creation_input_tokens` figure on older ones;
// the undivided figure is counted as five-minute writes, the cheaper rate.
const fs = require('node:fs');

const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

function summarise(transcriptPath) {
    let text;
    try {
        text = fs.readFileSync(transcriptPath, 'utf8');
    } catch (e) {
        return null;
    }
    const byRequest = new Map();
    let anonymous = 0;
    for (const raw of text.split('\n')) {
        if (!raw) continue;
        let entry;
        try {
            entry = JSON.parse(raw);
        } catch (e) {
            continue;
        }
        if (!entry || entry.type !== 'assistant' || entry.isSidechain === true) continue;
        const message = entry.message;
        if (!message || typeof message !== 'object') continue;
        if (typeof message.model !== 'string' || !message.usage || typeof message.usage !== 'object') continue;
        const key = typeof entry.requestId === 'string' && entry.requestId
            ? entry.requestId
            : 'anonymous-' + (anonymous++);
        byRequest.set(key, { model: message.model, usage: message.usage });
    }
    if (!byRequest.size) return null;

    const models = {};
    for (const { model, usage } of byRequest.values()) {
        const m = models[model] || (models[model] = { input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 });
        m.input += num(usage.input_tokens);
        m.output += num(usage.output_tokens);
        m.cacheRead += num(usage.cache_read_input_tokens);
        const split = usage.cache_creation;
        if (split && typeof split === 'object') {
            m.cacheWrite5m += num(split.ephemeral_5m_input_tokens);
            m.cacheWrite1h += num(split.ephemeral_1h_input_tokens);
        } else {
            m.cacheWrite5m += num(usage.cache_creation_input_tokens);
        }
    }
    let model = null;
    for (const id of Object.keys(models)) {
        if (model === null || models[id].output > models[model].output) model = id;
    }
    return { model, usage: { requests: byRequest.size, models } };
}

module.exports = { summarise };
```

   Run the tests; all three pass.

3. Commit: `feat: lib/usage.js sums a transcript once per request`.

## Task 3: `lib/prices.js` — a dated table and `costOf`

**Files:**
- Modify: `lib/prices.js`
- Test: `tests/prices.test.js`

**Interfaces:**
- Consumes: the `models` shape Task 2 produces.
- Produces: `verified: 'YYYY-MM-DD'`, `perMillion: { [modelId]: { input, output, cacheRead, cacheWrite5m, cacheWrite1h } }`, `rateFor(modelId) → rates | null`, `costOf(models) → { usd: number, priced: string[], unpriced: string[] }`.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

**Steps**

1. Write `tests/prices.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const prices = require('../lib/prices.js');

test('the table carries a date and five rates per model', () => {
    assert.match(prices.verified, /^\d{4}-\d{2}-\d{2}$/);
    for (const [id, r] of Object.entries(prices.perMillion)) {
        for (const k of ['input', 'output', 'cacheRead', 'cacheWrite5m', 'cacheWrite1h']) {
            assert.equal(typeof r[k], 'number', id + '.' + k);
            assert.ok(r[k] > 0, id + '.' + k);
        }
    }
});

test('rateFor matches an exact id, then the same id without its date', () => {
    assert.equal(prices.rateFor('claude-sonnet-5'), prices.perMillion['claude-sonnet-5']);
    assert.equal(prices.rateFor('claude-haiku-4-5'), prices.perMillion['claude-haiku-4-5-20251001']);
    assert.equal(prices.rateFor('claude-haiku-4-5-20251001'), prices.perMillion['claude-haiku-4-5-20251001']);
    assert.equal(prices.rateFor('claude-nothing-9'), null);
    assert.equal(prices.rateFor(undefined), null);
});

test('costOf prices what it knows and names what it does not', () => {
    const out = prices.costOf({
        'claude-sonnet-5': { input: 1e6, output: 1e6, cacheRead: 1e6, cacheWrite5m: 1e6, cacheWrite1h: 1e6 },
        'claude-nothing-9': { input: 1e6, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 },
    });
    assert.equal(out.usd, 2 + 10 + 0.2 + 2.5 + 4);
    assert.deepEqual(out.priced, ['claude-sonnet-5']);
    assert.deepEqual(out.unpriced, ['claude-nothing-9']);
    assert.deepEqual(prices.costOf(undefined), { usd: 0, priced: [], unpriced: [] });
});
```

   Run it; fails on `Cannot find module`.

2. Write `lib/prices.js`:

```js
'use strict';
// USD per million tokens, and the day the figures were read. This is the one
// thing in the station that goes stale on a schedule nobody here controls, so
// the page prints `verified` next to every dollar figure rather than letting a
// number look current because it looks precise.
//
// Read on 2026-09-04 from platform.claude.com/docs/en/build-with-claude/prompt-caching
// (the pricing page itself returned 404 that day). Cache reads are 0.1× input
// on every model but Claude Fable 5.1, where they are 0.025×; five-minute cache
// writes are 1.25× input and one-hour writes 2×. The dated Haiku id is what a
// transcript carries; `rateFor` also answers the undated alias.
const verified = '2026-09-04';

const perMillion = {
    'claude-fable-5-1':          { input: 10, output: 50, cacheRead: 0.25, cacheWrite5m: 12.5, cacheWrite1h: 20 },
    'claude-opus-5':             { input: 5,  output: 25, cacheRead: 0.5,  cacheWrite5m: 6.25, cacheWrite1h: 10 },
    'claude-sonnet-5':           { input: 2,  output: 10, cacheRead: 0.2,  cacheWrite5m: 2.5,  cacheWrite1h: 4 },
    'claude-haiku-4-5-20251001': { input: 1,  output: 5,  cacheRead: 0.1,  cacheWrite5m: 1.25, cacheWrite1h: 2 },
};

const undated = (id) => id.replace(/-\d{8}$/, '');

function rateFor(modelId) {
    if (typeof modelId !== 'string' || !modelId) return null;
    if (perMillion[modelId]) return perMillion[modelId];
    const want = undated(modelId);
    for (const id of Object.keys(perMillion)) {
        if (undated(id) === want) return perMillion[id];
    }
    return null;
}

function costOf(models) {
    const out = { usd: 0, priced: [], unpriced: [] };
    for (const [id, m] of Object.entries(models || {})) {
        const r = rateFor(id);
        if (!r) {
            out.unpriced.push(id);
            continue;
        }
        out.priced.push(id);
        out.usd += (m.input * r.input + m.output * r.output + m.cacheRead * r.cacheRead
            + m.cacheWrite5m * r.cacheWrite5m + m.cacheWrite1h * r.cacheWrite1h) / 1e6;
    }
    return out;
}

module.exports = { verified, perMillion, rateFor, costOf };
```

   Run the tests; all pass.

3. Commit: `feat: lib/prices.js, a dated price table and costOf`.

## Task 4: `lib/clear.js` — the checks `clear` makes, returned

**Files:**
- Modify: `lib/clear.js`
- Modify: `scripts/task.js` — `cmdClear` calls `clearEntry`; its messages and exit codes do not change
- Test: `tests/clear.test.js`

**Interfaces:**
- Consumes: `registry.sessionPath`, `readSession`, `isStale`, `ageText`, `update` (`lib/registry.js`).
- Produces: `clearEntry(root, targetId, { callerId?, force?, now? }) → { ok: true, data } | { ok: false, reason: 'none' | 'self' | 'invalid' | 'missing' | 'inactive' | 'fresh' | 'write', data?, age? }`.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

**Steps**

1. Write `tests/clear.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const registry = require('../lib/registry.js');
const { clearEntry } = require('../lib/clear.js');

const A = 'aaaaaaaa-1111-4111-8111-111111111111';
const B = 'bbbbbbbb-2222-4222-8222-222222222222';
const DAY = 24 * 3600e3;

function root() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-clear-'));
    registry.ensureLayout(dir);
    return dir;
}
function entry(root, id, updated) {
    registry.writeSession(root, id, {
        task: 'the ramp', stage: 'design', route: ['survey', 'design', 'build'], active: true,
        claims: [], started: new Date(updated).toISOString(), updated: new Date(updated).toISOString(),
    });
}

test('a stale entry is put down; the write is active:false and nothing else', () => {
    const r = root();
    const then = Date.now() - 30 * DAY;
    entry(r, B, then);
    const before = registry.readSession(r, B);
    const out = clearEntry(r, B, { callerId: A, now: Date.now() });
    assert.equal(out.ok, true);
    const after = registry.readSession(r, B);
    assert.equal(after.active, false);
    for (const k of Object.keys(before)) {
        if (k !== 'active') assert.deepEqual(after[k], before[k], k);
    }
});

test('a fresh entry is refused without force, and cleared with it', () => {
    const r = root();
    entry(r, B, Date.now());
    const refused = clearEntry(r, B, { callerId: A });
    assert.equal(refused.ok, false);
    assert.equal(refused.reason, 'fresh');
    assert.equal(refused.age, '<1h');
    assert.equal(refused.data.task, 'the ramp');
    assert.equal(registry.readSession(r, B).active, true);
    assert.equal(clearEntry(r, B, { callerId: A, force: true }).ok, true);
    assert.equal(registry.readSession(r, B).active, false);
});

test('self, an invalid id, a missing entry and a stood-down one each name their reason', () => {
    const r = root();
    assert.equal(clearEntry(r, A, { callerId: A }).reason, 'self');
    assert.equal(clearEntry(r, 'nope', { callerId: A }).reason, 'invalid');
    assert.equal(clearEntry(r, B, { callerId: A }).reason, 'missing');
    entry(r, B, Date.now() - 30 * DAY);
    assert.equal(clearEntry(r, B, { callerId: A }).ok, true);
    assert.equal(clearEntry(r, B, { callerId: A }).reason, 'inactive');
    assert.equal(clearEntry(r, undefined, { callerId: A }).reason, 'none');
});

test('with no caller there is no self to refuse', () => {
    const r = root();
    entry(r, B, Date.now() - 30 * DAY);
    assert.equal(clearEntry(r, B, {}).ok, true);
});
```

   If `registry.writeSession` refuses a record missing a field the reader
   requires, look at how `tests/registry.test.js` builds its fixture and add
   the same fields. Run; fails on `Cannot find module`.

2. Write `lib/clear.js`:

```js
'use strict';
// The checks `task.js clear` makes, in the order it makes them, ending in the
// one write it does. Returned rather than printed so that the station's server
// can make exactly the same decision from a button that the CLI makes from a
// command line — two copies of this list would be two lists.
//
// Age and not liveness, on purpose, and `docs/collisions.md` says why: a recent
// timestamp is the one sign the owner may simply have stepped away, and
// `--force` exists for the case a reader can see and the registry cannot. The
// server adds a liveness check of its own before calling this, because it has
// just measured liveness for the page; the CLI does not, and keeps its rule.
//
// It never deletes. `active: false` is the whole write, so a claim cleared by
// mistake can be adopted back with its notes and its `next` intact.
const registry = require('./registry.js');

function clearEntry(root, targetId, opts) {
    const { callerId, force, now } = opts || {};
    if (!targetId) return { ok: false, reason: 'none' };
    if (callerId && targetId === callerId) return { ok: false, reason: 'self' };
    if (!registry.sessionPath(root, targetId)) return { ok: false, reason: 'invalid' };

    const data = registry.readSession(root, targetId);
    if (!data) return { ok: false, reason: 'missing' };
    if (data.active !== true) return { ok: false, reason: 'inactive', data };

    const at = typeof now === 'number' ? now : Date.now();
    if (!registry.isStale(data, at) && force !== true) {
        return { ok: false, reason: 'fresh', data, age: registry.ageText(data, at) };
    }

    // The age gate ran on the read a moment ago; the write goes under the
    // target's lock, so a hook of theirs still firing keeps its claim rather
    // than having it rolled back by this deactivation.
    if (!registry.update(root, targetId, (d) => { d.active = false; })) {
        return { ok: false, reason: 'write', data };
    }
    return { ok: true, data };
}

module.exports = { clearEntry };
```

   Run the tests; all pass.

3. In `scripts/task.js`, add `const { clearEntry } = require('../lib/clear.js');`
   beside the other `lib/` requires, and replace the body of `cmdClear` from
   its first line down to and including the `registry.update(...)` line with:

```js
function cmdClear(root, opts) {
    const id = requireSession(opts);
    const target = opts.positional[0];
    if (!target) fail('Give the session id to clear.');
    const out = clearEntry(root, target, { callerId: id, force: opts.force === true });
    if (!out.ok) {
        // Each `fail` ends the command; the strings are the ones the tests read.
        if (out.reason === 'self') fail('That is this session. Use `down`, which prints the notes that are about to die.');
        if (out.reason === 'invalid') fail('Not a session id: ' + target);
        if (out.reason === 'missing') fail('No entry for ' + target + ' under ' + root);
        if (out.reason === 'inactive') return 'fankeel — already stood down.';
        if (out.reason === 'fresh') {
            fail('That entry was last seen ' + (out.age ? out.age + ' ago' : 'recently') + ': '
                + (out.data.task || 'untitled') + ' @ ' + (out.data.stage || '?')
                + NL + 'Pass --force if you know the terminal is gone.');
        }
        fail('Could not write the entry.');
    }
    hideBadge(opts, target);
```

   Everything from `hideBadge(opts, target);` to the end of the function —
   the comment beginning `// Prose rather than a command` and the return it
   explains — stays exactly as it is. The comment block above the old
   function (`// The second place another session's file is written...`)
   stays too; the paragraph that began `// Age, not liveness` moved to
   `lib/clear.js` and is deleted here. Run
   `node --test tests/task.test.js tests/clear.test.js`; the four `clear`
   assertions at :645-693 stay green.

4. Commit: `refactor: clear's checks move to lib/clear.js; task.js clear prints as before`.

## Task 5: `lib/station.js` — discover, gather, render, write

**Files:**
- Modify: `lib/station.js`
- Test: `tests/station.test.js`

**Interfaces:**
- Consumes: `badge.readLeads` (Task 1); `prices.costOf`, `prices.verified` (Task 3); `registry.readAll`, `findStateRoot`, `burnOf`, `clockOf`, `waitedOf`, `claimsOf`, `notesOf`, `nextOf`, `updatedAt` (`lib/registry.js`); `live.runningSessions`, `runningIds` (`lib/live.js`); `positionIn` (`lib/stages.js`); `tokens` (`lib/context.js`).
- Produces:
  - `discover({ configDir, roots?, cwd? }) → { roots: string[], gone: string[] }` — absolute, de-duplicated, sorted.
  - `gather({ configDir, roots?, cwd?, now? }) → Model`, where `Model = { generatedAt, configDir, pricesVerified, registries: Registry[] }`, `Registry = { root, gone: boolean, unreadable, build: { name, files }[], mapAt: string|null, sessions: Row[] }`, `Row = { sessionId, state: 'live'|'stale'|'down', unknown: boolean, task, project, stage, route, step, steps, started, updated, ended, model, usage, cost, burn, clock, waited, claims, notes, next, guard, configDir }`.
  - `render(model, { serve?: boolean, nonce?: string, plugin?: string }) → string` (a whole HTML document).
  - `write({ configDir, roots?, cwd?, plugin? }) → string` — the path written, `<configDir>/fankeel/station.html`. (`stationPath` stays internal: the fix round `c01f045` took it out of the exports because nothing imported it.)

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

**Steps**

1. Write `tests/station.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const registry = require('../lib/registry.js');
const badge = require('../lib/badge.js');
const station = require('../lib/station.js');

const LIVE = 'aaaaaaaa-1111-4111-8111-111111111111';
const STALE = 'bbbbbbbb-2222-4222-8222-222222222222';
const DOWN = 'cccccccc-3333-4333-8333-333333333333';
const DAY = 24 * 3600e3;

// Two registries, one config dir. One session is running (this process's pid),
// one is active with nobody behind it, one is stood down with usage recorded.
function fixture() {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-station-'));
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws-one');
    const r2 = path.join(base, 'ws-two');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(r1);
    registry.ensureLayout(r2);
    const now = Date.now();
    const at = (ms) => new Date(ms).toISOString();
    registry.writeSession(r1, LIVE, { task: 'live one', project: 'ws-one', stage: 'build', route: ['survey', 'build', 'verify'],
        active: true, claims: ['a.js'], started: at(now - 3600e3), updated: at(now - 60e3), configDir: cfg });
    registry.writeSession(r1, STALE, { task: 'stale one', stage: 'design', route: ['survey', 'design', 'build'],
        active: true, claims: [], started: at(now - 40 * DAY), updated: at(now - 30 * DAY), configDir: cfg,
        ended: { at: at(now - 30 * DAY), reason: 'clear' } });
    registry.writeSession(r2, DOWN, { task: 'down two', stage: 'land', route: ['survey', 'build', 'land'],
        active: false, claims: [], started: at(now - 2 * DAY), updated: at(now - DAY), configDir: cfg,
        notes: ['a note'], next: 'nothing',
        model: 'claude-sonnet-5', usage: { requests: 3, models: { 'claude-sonnet-5': { input: 1e6, output: 1e6, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 } } } });
    fs.writeFileSync(path.join(r2, '.fankeel', 'sessions', 'broken.json'), '{not json');
    fs.mkdirSync(path.join(r1, '.fankeel', 'build', '2026-09-04-thing'), { recursive: true });
    fs.writeFileSync(path.join(r1, '.fankeel', 'build', '2026-09-04-thing', 'ledger.md'), '# ledger\n');
    // Discovery: r1 through a lead, r2 through a running session's cwd.
    badge.writeLead(cfg, STALE, { word: 'design', step: 2, steps: 3, root: r1 });
    fs.writeFileSync(path.join(cfg, 'sessions', process.pid + '.json'), JSON.stringify({
        pid: process.pid, sessionId: LIVE, cwd: path.join(r2, 'deeper'), startedAt: at(now - 3600e3),
        procStart: 0, version: '2.0.0', kind: 'interactive', entrypoint: 'cli', status: 'idle',
    }));
    return { base, cfg, r1, r2 };
}

test('discover finds a registry through a lead, one through a running cwd, and one by --root; a gone one is named', () => {
    const f = fixture();
    const gone = path.join(f.base, 'gone');
    badge.writeLead(f.cfg, DOWN, { word: 'land', root: gone });
    const out = station.discover({ configDir: f.cfg, roots: [f.r2], cwd: os.tmpdir() });
    assert.deepEqual(out.roots, [f.r1, f.r2].map((p) => path.resolve(p)).sort());
    assert.deepEqual(out.gone, [path.resolve(gone)]);
});

test('gather classifies live, stale and down, counts unreadable, prices usage, lists build/', () => {
    const f = fixture();
    const m = station.gather({ configDir: f.cfg });
    assert.equal(m.registries.length, 2);
    const one = m.registries.find((r) => r.root === path.resolve(f.r1));
    const two = m.registries.find((r) => r.root === path.resolve(f.r2));
    assert.deepEqual(one.sessions.map((s) => [s.sessionId, s.state]), [[LIVE, 'live'], [STALE, 'stale']]);
    assert.equal(one.sessions[0].unknown, false);
    assert.deepEqual(one.build, [{ name: '2026-09-04-thing', files: 1 }]);
    assert.equal(one.unreadable, 0);
    assert.equal(two.unreadable, 1);
    const down = two.sessions[0];
    assert.equal(down.state, 'down');
    assert.equal(down.ended, null);
    assert.equal(down.cost.usd, 12);
    assert.deepEqual(down.cost.unpriced, []);
    assert.equal(one.sessions[1].ended.reason, 'clear');
    assert.equal(m.pricesVerified.length, 10);
});

test('render names every task, marks state, shows the price date, and draws the clear control only under serve and only on stale rows', () => {
    const f = fixture();
    const m = station.gather({ configDir: f.cfg });
    const page = station.render(m, { plugin: 'C:/plug' });
    assert.match(page, /<!doctype html>/i);
    for (const t of ['live one', 'stale one', 'down two']) assert.ok(page.includes(t), t);
    assert.match(page, /prices 2026-\d{2}-\d{2}|prices \d{4}-\d{2}-\d{2}/);
    assert.ok(page.includes('task.js clear ' + STALE));
    assert.ok(!page.includes('<form'));
    assert.ok(!page.includes('<script src='));
    const served = station.render(m, { serve: true, nonce: 'n0nce' });
    assert.ok(served.includes('name="nonce" value="n0nce"'));
    assert.equal((served.match(/action="\/clear"/g) || []).length, 1);
    assert.ok(served.includes('value="' + STALE + '"'));
    assert.ok(!served.includes('value="' + LIVE + '"'));
});

test('write puts the page under <configDir>/fankeel/station.html', () => {
    const f = fixture();
    const file = station.write({ configDir: f.cfg });
    assert.equal(file, path.join(f.cfg, 'fankeel', 'station.html'));
    assert.ok(fs.readFileSync(file, 'utf8').includes('live one'));
});
```

   Run; fails on `Cannot find module`.

2. Write `lib/station.js`:

```js
'use strict';
// Every fankeel session on this machine, as data and as a page.
//
// Discovery is the part nothing else here does. A registry is per workspace and
// `findStateRoot` walks up from one directory, so no reader knows more than one.
// Three sources, unioned: the `root=` field of every lead under `modes/`, the
// `cwd` of every running Claude Code session walked up to its registry, and
// whatever the caller names. Leads are pointers; the registry is the record.
//
// Liveness is asked of `runningIds` directly rather than through `readLive`,
// whose self-check is right for a hook — a scan that cannot see the caller is
// a scan not to be trusted — and wrong for a page with no session of its own.
// A directory that cannot be read still counts as live, as `docs/collisions.md`
// says, and the row says `live?` so the doubt is visible.
const fs = require('node:fs');
const path = require('node:path');
const registry = require('./registry.js');
const badge = require('./badge.js');
const live = require('./live.js');
const prices = require('./prices.js');
const { positionIn } = require('./stages.js');
const { tokens } = require('./context.js');

const resolved = (p) => {
    try {
        return path.resolve(String(p));
    } catch (e) {
        return null;
    }
};

const hasRegistry = (root) => {
    try {
        return fs.statSync(path.join(root, '.fankeel', 'sessions')).isDirectory();
    } catch (e) {
        return false;
    }
};

function discover(opts) {
    const configDir = String(opts.configDir == null ? '' : opts.configDir);
    const seen = new Set();
    const gone = new Set();
    const add = (root) => {
        const abs = root && resolved(root);
        if (!abs) return;
        (hasRegistry(abs) ? seen : gone).add(abs);
    };
    for (const lead of badge.readLeads(configDir)) add(lead.fields.root);
    for (const s of live.runningSessions(configDir) || []) {
        if (s.cwd) add(registry.findStateRoot(s.cwd));
    }
    for (const root of opts.roots || []) add(root);
    if (opts.cwd) add(registry.findStateRoot(opts.cwd));
    return { roots: [...seen].sort(), gone: [...gone].sort() };
}

// Minutes, rounded, with hours above sixty of them — the shape `task.js` uses.
const mins = (ms) => {
    const m = Math.round(ms / 60000);
    if (m < 60) return m + 'm';
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r ? h + 'h' + r + 'm' : h + 'h';
};

const sum = (data, of) => {
    let total = null;
    for (const stage of Array.isArray(data.route) ? data.route : []) {
        const v = of(data, stage);
        if (v !== null) total = (total || 0) + v;
    }
    return total;
};

function buildDirs(root) {
    const dir = path.join(root, '.fankeel', 'build');
    let names;
    try {
        names = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
        return [];
    }
    const out = [];
    for (const d of names) {
        if (!d.isDirectory()) continue;
        let files = 0;
        try {
            files = fs.readdirSync(path.join(dir, d.name), { recursive: true, withFileTypes: true })
                .filter((f) => f.isFile()).length;
        } catch (e) { /* counted as zero */ }
        out.push({ name: d.name, files });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
}

function mapDate(root) {
    try {
        return fs.statSync(path.join(root, '.fankeel', 'map.md')).mtime.toISOString();
    } catch (e) {
        return null;
    }
}

function gather(opts) {
    const configDir = String(opts.configDir == null ? '' : opts.configDir);
    const now = typeof opts.now === 'number' ? opts.now : Date.now();
    const found = discover(opts);
    // One liveness scan per config dir this page needs, for the life of this call.
    const scans = new Map();
    const idsIn = (dir) => {
        if (!scans.has(dir)) scans.set(dir, live.runningIds(dir));
        return scans.get(dir);
    };
    const registries = [];
    for (const root of found.roots) {
        const all = registry.readAll(root);
        const sessions = [];
        for (const { sessionId, data } of all.entries) {
            const theirs = typeof data.configDir === 'string' && data.configDir ? data.configDir : configDir;
            const ids = idsIn(theirs);
            const running = ids ? ids.has(sessionId) : true;
            const at = positionIn(data.route, data.stage) || {};
            const usage = data.usage && typeof data.usage === 'object' ? data.usage : null;
            sessions.push({
                sessionId,
                state: data.active !== true ? 'down' : running ? 'live' : 'stale',
                unknown: data.active === true && !ids,
                task: typeof data.task === 'string' ? data.task : '',
                project: registry.projectOf ? (registry.projectOf(data) || '') : (data.project || ''),
                stage: typeof data.stage === 'string' ? data.stage : '',
                route: Array.isArray(data.route) ? data.route : [],
                step: at.step || 0,
                steps: at.steps || 0,
                started: typeof data.started === 'string' ? data.started : null,
                updated: registry.updatedAt(data),
                ended: data.ended && typeof data.ended === 'object' ? data.ended : null,
                model: typeof data.model === 'string' ? data.model : null,
                usage,
                cost: usage && usage.models ? prices.costOf(usage.models) : null,
                burn: sum(data, registry.burnOf),
                clock: sum(data, registry.clockOf),
                waited: sum(data, registry.waitedOf),
                claims: registry.claimsOf(data),
                notes: registry.notesOf(data),
                next: registry.nextOf(data),
                guard: typeof data.guard === 'string' ? data.guard : '',
                configDir: theirs,
            });
        }
        sessions.sort((a, b) => (b.updated || 0) - (a.updated || 0));
        registries.push({ root, gone: false, unreadable: all.unreadable, build: buildDirs(root), mapAt: mapDate(root), sessions });
    }
    for (const root of found.gone) {
        registries.push({ root, gone: true, unreadable: 0, build: [], mapAt: null, sessions: [] });
    }
    return { generatedAt: new Date(now).toISOString(), configDir, pricesVerified: prices.verified, registries };
}

const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const day = (iso) => (typeof iso === 'string' ? iso.slice(0, 10) : '—');
const stamp = (ms) => (Number.isFinite(ms) ? new Date(ms).toISOString().replace('T', ' ').slice(0, 16) : '—');
const dots = (step, steps) => (steps ? '●'.repeat(Math.min(step, steps)) + '○'.repeat(Math.max(0, steps - step)) : '');

const CSS = `
:root{--bg:#fafaf8;--fg:#1d1d1b;--mute:#6b6b66;--line:#e2e2dc;--live:#2f7d32;--stale:#b26a00;--down:#8a8a85;--panel:#fff}
@media(prefers-color-scheme:dark){:root{--bg:#161614;--fg:#e8e8e2;--mute:#9a9a92;--line:#2c2c28;--live:#7ed184;--stale:#f0b35a;--down:#7a7a74;--panel:#1f1f1c}}
body{margin:0;padding:24px;background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,sans-serif}
h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:28px 0 8px}
.meta{color:var(--mute);font-size:12px}
details.s{border:1px solid var(--line);border-radius:6px;margin:6px 0;background:var(--panel)}
details.s>summary{display:grid;grid-template-columns:82px 64px 110px 1fr 120px 90px 70px;gap:10px;padding:8px 12px;cursor:pointer;align-items:center;list-style:none}
details.s>summary::-webkit-details-marker{display:none}
.state{font-weight:600}.live .state{color:var(--live)}.stale .state{color:var(--stale)}.down .state{color:var(--down)}
.stage{font-family:ui-monospace,monospace;white-space:nowrap}
.task{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.more{padding:6px 12px 12px;border-top:1px solid var(--line);color:var(--mute);font-size:13px}
.more dt{float:left;clear:left;width:70px;color:var(--fg)}.more dd{margin:0 0 4px 80px;word-break:break-all}
code{font-family:ui-monospace,monospace;font-size:12px}
form.clear{margin-top:8px}form.clear button{padding:4px 10px}
.gone{color:var(--stale)}
`;

function row(s, opts, root) {
    const usd = s.cost && s.cost.priced.length ? '$' + s.cost.usd.toFixed(2) : '';
    const unpriced = s.cost && s.cost.unpriced.length ? ' (' + s.cost.unpriced.join(', ') + ' unpriced)' : '';
    const outTok = s.usage && s.usage.models
        ? tokens(Object.values(s.usage.models).reduce((n, m) => n + (m.output || 0), 0)) + ' out'
        : '';
    const state = s.state + (s.unknown ? '?' : '');
    const ended = s.ended ? stamp(Date.parse(s.ended.at)) + ' (' + esc(s.ended.reason) + ')' : '—';
    let clear = '';
    if (s.state === 'stale') {
        clear = opts.serve
            ? `<form class="clear" method="post" action="/clear">`
                + `<input type="hidden" name="root" value="${esc(root)}">`
                + `<input type="hidden" name="id" value="${esc(s.sessionId)}">`
                + `<input type="hidden" name="nonce" value="${esc(opts.nonce || '')}">`
                + `<label><input type="checkbox" name="force" value="1"> force</label> `
                + `<button type="submit">clear</button></form>`
            : `<dt>clear</dt><dd><code>node ${esc(opts.plugin || '<plugin>')}/scripts/task.js clear ${esc(s.sessionId)} --root "${esc(root)}" --session &lt;your session id&gt;</code></dd>`;
    }
    return `<details class="s ${s.state}"><summary>`
        + `<span>${esc(day(s.started))}</span>`
        + `<span class="state">${esc(state)}</span>`
        + `<span class="stage">${esc(s.stage)} ${dots(s.step, s.steps)}</span>`
        + `<span class="task" title="${esc(s.task)}">${esc(s.task)}</span>`
        + `<span>${esc(usd || outTok)}${esc(unpriced)}</span>`
        + `<span>${esc(s.burn !== null ? tokens(s.burn) : '—')} / ${esc(s.clock !== null ? mins(s.clock) : '—')}</span>`
        + `<span>${esc(s.model ? s.model.replace(/^claude-/, '') : '')}</span>`
        + `</summary><div class="more"><dl>`
        + `<dt>session</dt><dd><code>${esc(s.sessionId)}</code></dd>`
        + `<dt>project</dt><dd>${esc(s.project || '—')}</dd>`
        + `<dt>route</dt><dd>${esc(s.route.join(' → '))}</dd>`
        + `<dt>updated</dt><dd>${esc(stamp(s.updated))}</dd>`
        + `<dt>ended</dt><dd>${ended}</dd>`
        + `<dt>waited</dt><dd>${esc(s.waited !== null ? mins(s.waited) : '—')}</dd>`
        + `<dt>touched</dt><dd>${esc(s.claims.join(' ') || '—')}</dd>`
        + `<dt>notes</dt><dd>${s.notes.length ? s.notes.map(esc).join('<br>') : '—'}</dd>`
        + `<dt>next</dt><dd>${esc(s.next || '—')}</dd>`
        + `<dt>guard</dt><dd>${esc(s.guard || 'ask (default)')}</dd>`
        + clear
        + `</dl></div></details>`;
}

function render(model, opts) {
    opts = opts || {};
    const counts = { live: 0, stale: 0, down: 0 };
    for (const r of model.registries) for (const s of r.sessions) counts[s.state]++;
    let body = `<h1>fankeel station</h1>`
        + `<p class="meta">generated ${esc(stamp(Date.parse(model.generatedAt)))} · `
        + `${model.registries.filter((r) => !r.gone).length} registries · `
        + `${counts.live} live, ${counts.stale} stale, ${counts.down} down · `
        + `cost in USD at prices ${esc(model.pricesVerified)}; burn / clock are this session's own context and wall-clock`
        + (opts.serve ? ' · serving; this page re-reads the registries on every load' : '')
        + `</p>`;
    for (const r of model.registries) {
        body += `<h2>${esc(r.root)}${r.gone ? ' <span class="gone">— gone: no sessions/ here any more</span>' : ''}</h2>`;
        if (r.gone) continue;
        body += `<p class="meta">${r.sessions.length} sessions, ${r.unreadable} unreadable`
            + (r.mapAt ? ` · map.md ${esc(day(r.mapAt))}` : ' · no map.md')
            + (r.build.length ? ` · build/: ${r.build.map((b) => esc(b.name) + ' (' + b.files + ')').join(', ')}` : ' · no build/')
            + `</p>`;
        for (const s of r.sessions) body += row(s, opts, r.root);
    }
    return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`
        + `<title>fankeel station</title><style>${CSS}</style></head><body>${body}</body></html>\n`;
}

function stationPath(configDir) {
    return path.join(String(configDir == null ? '' : configDir), 'fankeel', 'station.html');
}

function write(opts) {
    const file = stationPath(opts.configDir);
    const html = render(gather(opts), { plugin: opts.plugin });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, html);
    return file;
}

module.exports = { discover, gather, render, write, stationPath };
```

   If `registry.projectOf`, `notesOf` or `nextOf` take a different argument
   shape than `(data)`, read their definitions in `lib/registry.js` and call
   them as they are written; do not reimplement them. If `positionIn` returns
   `null` for a stage off the route, the `|| {}` already covers it. Run the
   tests; all four pass.

3. Commit: `feat: lib/station.js — every registry on this machine, gathered and rendered`.

## Task 6: `scripts/station.js` — write, open, serve

**Files:**
- Modify: `scripts/station.js`
- Test: `tests/station-cli.test.js`

**Interfaces:**
- Consumes: `station.gather`, `render`, `write` (Task 5); `clearEntry` (Task 4); `live.liveConfigDir`.
- Produces: the command below. Exports `serve(opts) → Promise<{ url, close() }>` so the test can drive it in-process.

```
node <plugin>/scripts/station.js [--root <dir>]... [--open]
node <plugin>/scripts/station.js serve [--port <n>] [--idle <minutes>] [--root <dir>]... [--open]
```

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

**Steps**

1. Write `tests/station-cli.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const registry = require('../lib/registry.js');
const badge = require('../lib/badge.js');

const CLI = path.join(__dirname, '..', 'scripts', 'station.js');
const LIVE = 'aaaaaaaa-1111-4111-8111-111111111111';
const STALE = 'bbbbbbbb-2222-4222-8222-222222222222';
const DAY = 24 * 3600e3;

function fixture() {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-station-cli-'));
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(r1);
    const now = Date.now();
    const at = (ms) => new Date(ms).toISOString();
    registry.writeSession(r1, LIVE, { task: 'live', stage: 'build', route: ['survey', 'build'], active: true, claims: [],
        started: at(now - 3600e3), updated: at(now - 60e3), configDir: cfg });
    registry.writeSession(r1, STALE, { task: 'stale', stage: 'design', route: ['survey', 'design'], active: true, claims: [],
        started: at(now - 40 * DAY), updated: at(now - 30 * DAY), configDir: cfg });
    badge.writeLead(cfg, STALE, { word: 'design', root: r1 });
    fs.writeFileSync(path.join(cfg, 'sessions', process.pid + '.json'), JSON.stringify({
        pid: process.pid, sessionId: LIVE, cwd: r1, startedAt: at(now), procStart: 0, version: '2.0.0',
        kind: 'interactive', entrypoint: 'cli', status: 'idle',
    }));
    return { base, cfg, r1 };
}

const request = (url, opts, body) => new Promise((resolve, reject) => {
    const req = http.request(url, opts, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
});

test('the default form writes the page and prints its path', () => {
    const f = fixture();
    const out = execFileSync(process.execPath, [CLI], { env: { ...process.env, CLAUDE_CONFIG_DIR: f.cfg }, encoding: 'utf8' });
    const file = path.join(f.cfg, 'fankeel', 'station.html');
    assert.ok(out.includes(file));
    assert.ok(fs.readFileSync(file, 'utf8').includes('stale'));
});

test('serve renders live, refuses a bad nonce, refuses a live row, clears a stale one, then exits when idle', async () => {
    const f = fixture();
    const { serve } = require('../scripts/station.js');
    const s = await serve({ configDir: f.cfg, port: 0, idleMs: 60e3, open: false });
    try {
        const page = await request(s.url, { method: 'GET' });
        assert.equal(page.status, 200);
        assert.ok(page.text.includes('action="/clear"'));
        const nonce = /name="nonce" value="([^"]+)"/.exec(page.text)[1];
        const form = (o) => new URLSearchParams(o).toString();
        const post = (body) => request(s.url + 'clear', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' } }, body);
        assert.equal((await post(form({ root: f.r1, id: STALE, nonce: 'wrong' }))).status, 403);
        assert.equal((await post(form({ root: f.r1, id: LIVE, nonce }))).status, 409);
        assert.equal(registry.readSession(f.r1, LIVE).active, true);
        const ok = await post(form({ root: f.r1, id: STALE, nonce }));
        assert.equal(ok.status, 303);
        assert.equal(ok.headers.location, '/');
        assert.equal(registry.readSession(f.r1, STALE).active, false);
        assert.equal((await request(s.url + 'nowhere', { method: 'GET' })).status, 404);
    } finally {
        s.close();
    }
});
```

   Run; the first test fails on the missing script.

2. Write `scripts/station.js`:

```js
#!/usr/bin/env node
'use strict';
// The station: every fankeel session on this machine, on one page.
//
//   node scripts/station.js [--root <dir>]... [--open]
//   node scripts/station.js serve [--port <n>] [--idle <minutes>] [--root <dir>]... [--open]
//
// The first form writes `<configDir>/fankeel/station.html` and prints the path;
// `hooks/leave.js` runs the same write at every session end, so the file is
// current whenever it is opened. The second form is for clearing: a server on
// 127.0.0.1 that renders on every request, takes a POST from the page's clear
// button, and exits after `--idle` minutes without one. Nothing here is
// started for the user by anything else, and no session holds a port.
//
// Zero dependencies, as everywhere in this repository: `node:http` and a form.
// The per-run nonce is what stops a page on some other origin from posting to
// this port; the address is loopback so nothing off this machine reaches it.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const station = require('../lib/station.js');
const registry = require('../lib/registry.js');
const live = require('../lib/live.js');
const { clearEntry } = require('../lib/clear.js');

const PLUGIN = path.resolve(__dirname, '..');

function parseArgs(argv) {
    const out = { verb: null, roots: [], open: false, port: 0, idleMs: 10 * 60e3 };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === 'serve' && out.verb === null) out.verb = 'serve';
        else if (a === '--open') out.open = true;
        else if (a === '--root' && argv[i + 1]) out.roots.push(argv[++i]);
        else if (a === '--port' && argv[i + 1]) out.port = Number(argv[++i]) || 0;
        else if (a === '--idle' && argv[i + 1]) out.idleMs = (Number(argv[++i]) || 10) * 60e3;
        else {
            process.stderr.write('station: unknown argument ' + a + '\n');
            process.exit(2);
        }
    }
    return out;
}

function openInBrowser(target) {
    const [cmd, args] = process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '', target]]
        : process.platform === 'darwin' ? ['open', [target]] : ['xdg-open', [target]];
    try {
        spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref();
    } catch (e) {
        process.stderr.write('station: could not open a browser; open ' + target + ' yourself\n');
    }
}

const readBody = (req) => new Promise((resolve) => {
    let text = '';
    req.setEncoding('utf8');
    req.on('data', (c) => { if (text.length < 65536) text += c; });
    req.on('end', () => resolve(text));
    req.on('error', () => resolve(''));
});

function serve(opts) {
    const configDir = opts.configDir || live.liveConfigDir();
    const nonce = crypto.randomBytes(16).toString('hex');
    const gatherOpts = { configDir, roots: opts.roots || [], cwd: process.cwd() };
    let timer = null;
    let server;
    const touch = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            server.close();
            if (opts.exitOnIdle !== false) process.exit(0);
        }, opts.idleMs || 10 * 60e3);
    };
    server = http.createServer(async (req, res) => {
        touch();
        const url = new URL(req.url, 'http://127.0.0.1');
        if (req.method === 'GET' && url.pathname === '/') {
            const html = station.render(station.gather(gatherOpts), { serve: true, nonce, plugin: PLUGIN });
            res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
            res.end(html);
            return;
        }
        if (req.method === 'POST' && url.pathname === '/clear') {
            const form = new URLSearchParams(await readBody(req));
            if (form.get('nonce') !== nonce) {
                res.writeHead(403, { 'content-type': 'text/plain' });
                res.end('wrong nonce: open the page this server printed and try again\n');
                return;
            }
            const root = form.get('root') || '';
            const id = form.get('id') || '';
            // The server has just measured liveness for the page; a row that is
            // live is not one the button is for, whatever the age rule says.
            const model = station.gather(gatherOpts);
            const reg = model.registries.find((r) => r.root === path.resolve(root));
            const row = reg && reg.sessions.find((s) => s.sessionId === id);
            if (!row) {
                res.writeHead(404, { 'content-type': 'text/plain' });
                res.end('no such session on this page\n');
                return;
            }
            if (row.state === 'live') {
                res.writeHead(409, { 'content-type': 'text/plain' });
                res.end('that session is running; nothing to clear\n');
                return;
            }
            const out = clearEntry(reg.root, id, { force: form.get('force') === '1' });
            if (!out.ok && out.reason !== 'inactive') {
                res.writeHead(409, { 'content-type': 'text/plain' });
                res.end('not cleared: ' + out.reason + (out.age ? ' (last seen ' + out.age + ' ago; tick force)' : '') + '\n');
                return;
            }
            res.writeHead(303, { location: '/' });
            res.end();
            return;
        }
        res.writeHead(404, { 'content-type': 'text/plain' });
        res.end('not here\n');
    });
    return new Promise((resolve, reject) => {
        server.on('error', reject);
        server.listen(opts.port || 0, '127.0.0.1', () => {
            const url = 'http://127.0.0.1:' + server.address().port + '/';
            touch();
            if (opts.open) openInBrowser(url);
            resolve({
                url,
                close() {
                    if (timer) clearTimeout(timer);
                    server.close();
                },
            });
        });
    });
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const configDir = live.liveConfigDir();
    if (args.verb === 'serve') {
        serve({ configDir, roots: args.roots, port: args.port, idleMs: args.idleMs, open: args.open }).then((s) => {
            process.stdout.write('fankeel station — ' + s.url + '  (exits after '
                + Math.round(args.idleMs / 60e3) + ' idle minutes, or Ctrl+C)\n');
        }, (e) => {
            process.stderr.write('station: could not listen: ' + (e && e.message) + '\n');
            process.exit(1);
        });
        return;
    }
    const file = station.write({ configDir, roots: args.roots, cwd: process.cwd(), plugin: PLUGIN });
    process.stdout.write('fankeel station — ' + file + '\n');
    if (args.open) openInBrowser(file);
}

if (require.main === module) main();

module.exports = { serve, parseArgs };
```

   Note for the test: `serve` is called with `exitOnIdle` unset and
   `idleMs: 60e3`, and the test closes it before that fires; nothing exits the
   test process. Run `node --test tests/station-cli.test.js`; both pass.

3. Commit: `feat: scripts/station.js writes the page, opens it, or serves it while clearing`.

## Task 7: `hooks/leave.js` on `SessionEnd`

**Files:**
- Modify: `hooks/leave.js`
- Modify: `.claude-plugin/plugin.json` — a `SessionEnd` entry
- Modify: `README.md` — `all seven hooks` → `all eight hooks`; `The other four are not load-bearing` → `The other five are not load-bearing`
- Modify: `tests/hook.test.js` — the comment at :3, `all seven hooks` → `all eight hooks`
- Test: `tests/leave.test.js`

**Interfaces:**
- Consumes: `usage.summarise` (Task 2); `station.write` (Task 5); `registry.rootFor`, `launchRoot`, `readSession`, `update`; `live.liveConfigDir`; `hook.run`, `parse`.
- Produces: on the session's own entry, `ended: { at: ISO, reason: string }`, and when the transcript could be read, `model: string` and `usage` in Task 2's shape. Nothing else on the record changes.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

**Steps**

1. Write `tests/leave.test.js`, modelled on `tests/inject.test.js`'s `run`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const registry = require('../lib/registry.js');

const HOOK = path.join(__dirname, '..', 'hooks', 'leave.js');
const SID = 'aaaaaaaa-1111-4111-8111-111111111111';

function run(payload, claudeDir) {
    return execFileSync(process.execPath, [HOOK], {
        input: JSON.stringify(payload),
        env: { ...process.env, CLAUDE_CONFIG_DIR: claudeDir },
        encoding: 'utf8',
    });
}

function fixture() {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-leave-'));
    const cfg = path.join(base, 'cfg');
    const root = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(root);
    registry.writeSession(root, SID, { task: 'the ramp', stage: 'build', route: ['survey', 'build'], active: true,
        claims: ['a.js'], started: new Date().toISOString(), updated: new Date().toISOString(), configDir: cfg });
    const transcript = path.join(base, 't.jsonl');
    const a = (requestId, model, usage) => JSON.stringify({ type: 'assistant', requestId, message: { model, usage } }) + '\n';
    fs.writeFileSync(transcript, [
        a('r1', 'claude-sonnet-5', { input_tokens: 10, output_tokens: 20 }),
        a('r1', 'claude-sonnet-5', { input_tokens: 10, output_tokens: 20 }),
        a('r2', 'claude-sonnet-5', { input_tokens: 1, output_tokens: 2 }),
    ].join(''));
    return { cfg, root, transcript };
}

test('records ended, model and usage on its own entry; active stays true; the page is regenerated; stdout is empty', () => {
    const f = fixture();
    const out = run({ session_id: SID, transcript_path: f.transcript, cwd: f.root, reason: 'clear', hook_event_name: 'SessionEnd' }, f.cfg);
    assert.equal(out, '');
    const d = registry.readSession(f.root, SID);
    assert.equal(d.active, true);
    assert.deepEqual(d.claims, ['a.js']);
    assert.equal(d.ended.reason, 'clear');
    assert.match(d.ended.at, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(d.model, 'claude-sonnet-5');
    assert.deepEqual(d.usage, { requests: 2, models: { 'claude-sonnet-5': { input: 11, output: 22, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 } } });
    assert.ok(fs.readFileSync(path.join(f.cfg, 'fankeel', 'station.html'), 'utf8').includes('the ramp'));
});

test('a session with no entry still regenerates the page, and an unreadable transcript leaves usage absent', () => {
    const f = fixture();
    const other = 'bbbbbbbb-2222-4222-8222-222222222222';
    assert.equal(run({ session_id: other, transcript_path: path.join(f.root, 'missing.jsonl'), cwd: f.root, reason: 'other' }, f.cfg), '');
    assert.equal(registry.readSession(f.root, other), null);
    assert.ok(fs.existsSync(path.join(f.cfg, 'fankeel', 'station.html')));
    assert.equal(run({ session_id: SID, transcript_path: path.join(f.root, 'missing.jsonl'), cwd: f.root, reason: 'logout' }, f.cfg), '');
    const d = registry.readSession(f.root, SID);
    assert.equal(d.ended.reason, 'logout');
    assert.equal('usage' in d, false);
});

test('garbage on stdin exits 0 and writes nothing', () => {
    const f = fixture();
    assert.equal(execFileSync(process.execPath, [HOOK], { input: 'not json', env: { ...process.env, CLAUDE_CONFIG_DIR: f.cfg }, encoding: 'utf8' }), '');
    assert.equal(fs.existsSync(path.join(f.cfg, 'fankeel')), false);
});
```

   Run; fails on the missing hook.

2. Write `hooks/leave.js`:

```js
#!/usr/bin/env node
'use strict';

// SessionEnd. It records that this session ended, what it spent, and
// regenerates the station page — and does nothing else.
//
// A session ending is not the user standing a task down. `active` is never
// written here: an entry left `active: true` with `ended` on it is exactly what
// the station shows as `stale`, and what `clear` exists to put down on the
// user's say-so. Invariant 2, and the reason a session that dies at a gate is
// still a session somebody has to decide about.
//
// The transcript is read whole, once. `lib/context.js` reads a tail because it
// runs before every prompt; this runs once, when nothing is waiting on it. What
// it costs is the one thing this plan could not measure under `node --test`:
// whether an `async` hook gets to finish a thirteen-megabyte read before the
// process is gone. `verify` measures it by ending a real session.
//
// Same two rules as every hook here: exit 0 on every path, and no stdout —
// a SessionEnd hook that speaks has nobody to speak to.

const registry = require('../lib/registry.js');
const usage = require('../lib/usage.js');
const station = require('../lib/station.js');
const live = require('../lib/live.js');
const { run, parse } = require('../lib/hook.js');

function main(raw) {
    const payload = parse(raw);
    if (!payload || typeof payload.session_id !== 'string') return;

    const sessionId = payload.session_id;
    const root = registry.rootFor(payload);
    const mine = registry.readSession(root, sessionId);
    if (mine) {
        const seen = typeof payload.transcript_path === 'string' ? usage.summarise(payload.transcript_path) : null;
        const reason = typeof payload.reason === 'string' && payload.reason ? payload.reason.slice(0, 32) : 'other';
        try {
            registry.update(root, sessionId, (d) => {
                d.ended = { at: new Date().toISOString(), reason };
                if (seen) {
                    d.model = seen.model;
                    d.usage = seen.usage;
                }
            });
        } catch (e) { /* housekeeping */ }
    }

    try {
        station.write({ configDir: live.liveConfigDir(), cwd: registry.launchRoot(payload) });
    } catch (e) { /* housekeeping */ }
}

// Deliberately silent: whatever went wrong, the session is already over.
run(main);
```

   If `registry.update` refreshes `updated` on every write, that is its
   contract and the hook keeps it; the test does not assert `updated`.

3. In `.claude-plugin/plugin.json`, add to the `hooks` object, after
   `"PreToolUse"`:

```json
"SessionEnd": [
  {
    "hooks": [
      {
        "type": "command",
        "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/leave.js\"",
        "timeout": 60,
        "async": true,
        "statusMessage": "Recording how the session ended..."
      }
    ]
  }
]
```

   Match the file's two-space indentation. Then in `README.md` change the
   sentence matching `/all seven\s+hooks/` to say `all eight hooks` and the
   one matching `/The other four are not load-bearing/` to say `The other five
   are not load-bearing`; and in `tests/hook.test.js:3` change `all seven
   hooks` to `all eight hooks`. Run
   `node --test tests/leave.test.js tests/contract.test.js tests/hook.test.js`;
   all green — the contract test now counts eight files in `hooks/` and eight
   entries in the manifest.

4. Commit: `feat: hooks/leave.js records the end of a session and regenerates the station`.

## Task 8: the skill, the page, the fields, the index

**Files:**
- Modify: `skills/fankeel-station/SKILL.md`
- Modify: `docs/station.md`
- Modify: `tests/contract.test.js` — `found.size === 10` becomes `11`
- Modify: `docs/registry.md` — three fields, one new file on disk
- Modify: `docs/statusline.md` — `root` in the lead keys
- Modify: `docs/README.md` — index rows for `station.md` and the skill
- Modify: `README.md` — a row under *Where to find things* and a short section
- Modify: `skills/fankeel/SKILL.md` — *On `/fankeel`* names the station

**Interfaces:**
- Consumes: everything above, by name.
- Produces: nothing code reads.

**Dispatch:** implementer, sonnet — the plan carries the text; transcription plus the one test edit.

**Steps**

1. In `tests/contract.test.js:260-280`, change the assertion `found.size === 10`
   (or `assert.equal(found.size, 10)`, whichever form it takes) to `11`. Run
   `node --test tests/contract.test.js`; it fails: ten skills found.

2. Write `skills/fankeel-station/SKILL.md`, with `version:` equal to the
   `"version"` in `package.json`:

```markdown
---
name: fankeel-station
description: Every fankeel session on this machine on one page — live, abandoned and stood down, with what each cost — and a button to put an abandoned one down. Use for /fankeel-station, "show all sessions", "which sessions are still open", "clean up old sessions", or "監控站".
version: 0.43.0
status: current
last_verified: 2026-09-04
source_of_truth: lib/station.js, scripts/station.js, hooks/leave.js
---

# fankeel-station

The station is a page, not a process. `hooks/leave.js` regenerates it every
time a session ends, so opening it is enough:

    node <plugin>/scripts/station.js --open

`<plugin>` is two directories up from this file. Add `--root <dir>` for a
registry the page did not find on its own — it finds them through the leads
under `~/.claude/modes/`, which are pruned after thirty days, and through the
working directory of every running session.

## Clearing from the page

Clearing needs a process, so for that the page is served:

    node <plugin>/scripts/station.js serve --open

It binds `127.0.0.1` on a free port, prints the URL, and exits after ten idle
minutes or Ctrl+C. The page it serves is the same page with a `clear` button on
every `stale` row — `active: true` with no process behind it. The button calls
exactly what `task.js clear` calls: age is the rule, `force` is the override
for a terminal you know is gone, and a `live` row has no button at all. It
writes `active: false` and nothing else, so a session cleared by mistake can be
adopted back.

## What the page shows

Per registry: its root, how many entries could not be parsed, what is under
`.fankeel/build/`, and when `map.md` was last written. Per session: when it
started, its state, its stage on its route, the task, cost in USD at the price
table's date, the stage tokens and minutes fankeel measured itself, and the
model. A row opens to the session id, project, route, when it was last touched,
when and why it ended, what it touched, its notes and its `next`.

**Cost is at a dated price table.** `lib/prices.js` names the day its figures
were read, and the page prints it in the header. A model the table does not
know shows its output tokens instead of a dollar figure.

**The end of a session is recorded, not decided.** `ended` says when and why
(`clear`, `logout`, `prompt_input_exit`, `other`); `active` is only ever
changed by `down` and `clear`.
```

3. Write `docs/station.md`:

```markdown
---
status: current
last_verified: 2026-09-04
source_of_truth: lib/station.js, scripts/station.js, hooks/leave.js, lib/usage.js, lib/prices.js, lib/clear.js
---

# The station

Every fankeel session on this machine, on one page. This is the reference for
what is on it and where it comes from; the decisions are in
[plans/2026-09-04-session-station-design.md](plans/2026-09-04-session-station-design.md).

## Where the registries come from

A registry is per workspace and every reader walks up to exactly one, so the
station has to be told, or find out. Three sources, unioned:

| source | what it finds |
|---|---|
| `~/.claude/modes/<id>/fankeel.lead`, its `root=` line | every registry a session has run under in the last thirty days — the lead is pruned after that |
| `~/.claude/sessions/<pid>.json`, its `cwd`, walked up | every registry a running session is in, whether or not it has started a task |
| `--root <dir>` | anything older |

A root whose `.fankeel/sessions/` no longer exists is listed as gone rather
than dropped.

## States

| state | meaning |
|---|---|
| `live` | `active: true` and a running process behind it |
| `stale` | `active: true` and no process — `/clear`, a closed terminal, a crash |
| `down` | `active: false` |

Liveness is `lib/live.js`'s answer, asked per config directory. A config
directory that cannot be read makes its sessions `live?`: the doubt goes to
the loud side, as it does everywhere in this plugin.

## What each row holds

From the entry: `task`, `project`, `stage` on its `route`, `started`,
`updated`, `claims`, `notes`, `next`, `guard`, and the stage sums of `burn`,
`clock` and `waited`. From `hooks/leave.js`: `ended`, `model`, `usage` — see
[registry.md](registry.md). From `lib/prices.js`: the dollar figure, and the
date the table was read.

## Two forms

`node <plugin>/scripts/station.js` writes `~/.claude/fankeel/station.html`,
which `hooks/leave.js` also rewrites at every session end. `serve` runs a
loopback server only while clearing; it renders afresh on every request, takes
a POST from the clear button on a `stale` row, answers `409` for a `live`
one and `403` without the per-run nonce, and exits after ten idle minutes.
```

4. In `docs/registry.md`, in the field table, add three rows after `waited`:

   - `ended` — written by `hooks/leave.js` at `SessionEnd`: `{ at, reason }`, `reason` one of `clear`, `logout`, `prompt_input_exit`, `other`. Present on a record that is still `active: true` when the session ended without the task being stood down.
   - `model` — the model that produced the most output tokens in the transcript, written at the same moment.
   - `usage` — `{ requests, models: { <id>: { input, output, cacheRead, cacheWrite5m, cacheWrite1h } } }`, summed once per `requestId` over the whole transcript. Absent when the transcript could not be read.

   In the section on what is written to disk, add
   `<configDir>/fankeel/station.html` — the station page, rewritten by
   `hooks/leave.js` and by `scripts/station.js`. Update `last_verified` to
   2026-09-04.

5. In `docs/statusline.md`, where the lead keys are listed, add `root` — the
   absolute registry root, written for the station's benefit and ignored by
   TokenBar. Update `last_verified`.

6. In `docs/README.md`, add index rows: one for `station.md` (question: *Every
   session on this machine, where the page finds the registries, and what
   `stale` means*) and one for `skills/fankeel-station/SKILL.md` if the index
   lists skills; keep the existing row for the design plan. In `README.md`,
   under *Where to find things*, add a row pointing at `docs/station.md`, and
   under the pipeline section add three sentences: the station exists, how to
   open it, and that `serve` is the clearing form. In `skills/fankeel/SKILL.md`,
   in *On `/fankeel`*, add one sentence after the `show --all` paragraph: for
   every registry on the machine rather than this one, `/fankeel-station`.

7. Run `node --test` in full, then
   `node <plugin>/scripts/docs-check.js` and `node <plugin>/scripts/todo-check.js`.
   All green. Commit: `docs: the station — its skill, its page, the three fields and the lead key`.

## Task 9: the session's own agents count too

Added 2026-09-04 at `verify`, on the user's decision. `summarise` reads the
parent transcript only, and a session's Background Agents and Workflow agents
each have a transcript of their own under
`<transcript path minus .jsonl>/subagents/agent-*.jsonl` and
`subagents/workflows/<run>/agent-*.jsonl`, every line of which is flagged
`isSidechain: true` — the flag `summarise` skips on purpose for the parent
file. Measured on this session before the task was written: 26 agent
transcripts, none of them counted; one implementer alone was 62 requests and
6.3 million input-and-cache tokens against the parent's 109 requests.

**Files:**
- Modify: `lib/usage.js` — `summarise` takes `{ sidechain }`; new `agentsOf` and `summariseTree`
- Modify: `hooks/leave.js` — writes `summariseTree`'s result
- Modify: `lib/station.js` — a row carries `agents` and `agentCost`; the page shows them
- Modify: `docs/registry.md` — `usage.subagents` in the shape
- Modify: `docs/station.md` — what a row holds, and that cost is own plus agents
- Test: `tests/usage.test.js`
- Test: `tests/leave.test.js`
- Test: `tests/station.test.js`

**Interfaces:**
- Consumes: `summarise(transcriptPath)` (Task 2); `prices.costOf` (Task 3); `gather`, `render` (Task 5); `hooks/leave.js` (Task 7).
- Produces: `summarise(transcriptPath, { sidechain?: boolean })` — with `sidechain: true` the `isSidechain` lines are counted; the default is unchanged. `agentsOf(transcriptPath) → { agents, requests, models, wallMs } | null` — every agent transcript under the session's own directory, counted with `sidechain: true`; `wallMs` is the sum of each agent's first-to-last timestamp; `null` when there are none. `summariseTree(transcriptPath) → { model, usage: { requests, models, subagents? } } | null` — `usage.requests` and `usage.models` are the parent's own, `usage.subagents` is `agentsOf`'s result when it is not null. The record's `usage` field is now `summariseTree`'s `usage`. A station row gains `agents` (the `subagents` object or `null`) and `agentCost` (`costOf(subagents.models)` or `null`).

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

**Steps**

1. Add to `tests/usage.test.js`, after the existing tests and using its `line`, `assistant` and `transcript` helpers:

```js
test('sidechain lines count only when asked', () => {
    const file = transcript([
        assistant('r1', 'claude-sonnet-5', { input_tokens: 1, output_tokens: 2 }, { isSidechain: true }),
    ]);
    assert.equal(usage.summarise(file), null);
    assert.deepEqual(usage.summarise(file, { sidechain: true }).usage, {
        requests: 1, models: { 'claude-sonnet-5': { input: 1, output: 2, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 } },
    });
});

// A session directory beside the transcript: `<base>/t.jsonl` and `<base>/t/subagents/...`.
function session(agentFiles) {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-usage-tree-'));
    const file = path.join(base, 't.jsonl');
    fs.writeFileSync(file, assistant('own1', 'claude-fable-5-1', { input_tokens: 5, output_tokens: 50 }));
    for (const [rel, lines] of Object.entries(agentFiles)) {
        const p = path.join(base, 't', rel);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, lines.join(''));
    }
    return file;
}
const agentLine = (requestId, out, ts) => line({ type: 'assistant', isSidechain: true, requestId, timestamp: ts,
    message: { model: 'claude-sonnet-5', usage: { input_tokens: 10, output_tokens: out } } });

test('agentsOf walks subagents/ and subagents/workflows/*/, counts sidechain lines once per request, sums wall-clock', () => {
    const file = session({
        'subagents/agent-aaaa.jsonl': [
            agentLine('a1', 100, '2026-09-04T02:00:00.000Z'),
            agentLine('a1', 100, '2026-09-04T02:00:05.000Z'),
            agentLine('a2', 1, '2026-09-04T02:00:10.000Z'),
        ],
        'subagents/agent-aaaa.meta.json': ['{"model":"sonnet"}'],
        'subagents/notes.txt': ['not a transcript\n'],
        'subagents/workflows/wf_x/agent-bbbb.jsonl': [agentLine('b1', 7, '2026-09-04T03:00:00.000Z')],
    });
    assert.deepEqual(usage.agentsOf(file), {
        agents: 2, requests: 3, wallMs: 10000,
        models: { 'claude-sonnet-5': { input: 30, output: 108, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 } },
    });
});

test('agentsOf is null with no agents, and summariseTree nests it under usage only when present', () => {
    const alone = session({});
    assert.equal(usage.agentsOf(alone), null);
    const tree = usage.summariseTree(alone);
    assert.equal(tree.model, 'claude-fable-5-1');
    assert.equal('subagents' in tree.usage, false);
    const withAgents = session({ 'subagents/agent-cccc.jsonl': [agentLine('c1', 3, '2026-09-04T02:00:00.000Z')] });
    const t2 = usage.summariseTree(withAgents);
    assert.equal(t2.usage.requests, 1);
    assert.equal(t2.usage.subagents.agents, 1);
    assert.equal(t2.usage.subagents.requests, 1);
    assert.equal(usage.summariseTree(path.join(os.tmpdir(), 'fankeel-no-such.jsonl')), null);
    assert.equal(usage.agentsOf('not-a-jsonl-path'), null);
});
```

   Run `node --test tests/usage.test.js`; the new tests fail (`sidechain` ignored; `agentsOf is not a function`).

2. In `lib/usage.js`: add `const path = require('node:path');` under the `fs` require; change `summarise`'s signature and its skip line:

```js
function summarise(transcriptPath, opts) {
    const sidechain = Boolean(opts && opts.sidechain);
```

```js
        if (!entry || entry.type !== 'assistant') continue;
        if (!sidechain && entry.isSidechain === true) continue;
```

   Then add, before `module.exports`:

```js
// The session's own agents. Claude Code keeps each Background Agent's and each
// Workflow agent's transcript beside the parent's, under a directory named for
// the session, and every line in those files is flagged `isSidechain` — the
// flag `summarise` skips for the parent, where an older Claude Code wrote
// subagent turns inline. So the same reader runs over them with the skip
// lifted, and what it finds is the part of a session's cost the parent
// transcript never sees: measured 2026-09-04, twenty-six agents on one
// session, one of them alone 6.3 million tokens of input and cache.
const AGENT_FILE = /^agent-[0-9a-f]+\.jsonl$/;

function sessionDirOf(transcriptPath) {
    return typeof transcriptPath === 'string' && transcriptPath.endsWith('.jsonl')
        ? transcriptPath.slice(0, -'.jsonl'.length)
        : null;
}

function agentFiles(sessionDir) {
    const out = [];
    const sub = path.join(sessionDir, 'subagents');
    let names;
    try {
        names = fs.readdirSync(sub);
    } catch (e) {
        return out;
    }
    for (const name of names) {
        if (AGENT_FILE.test(name)) out.push(path.join(sub, name));
    }
    let runs;
    try {
        runs = fs.readdirSync(path.join(sub, 'workflows'));
    } catch (e) {
        return out;
    }
    for (const run of runs) {
        let inner;
        try {
            inner = fs.readdirSync(path.join(sub, 'workflows', run));
        } catch (e) {
            continue;
        }
        for (const name of inner) {
            if (AGENT_FILE.test(name)) out.push(path.join(sub, 'workflows', run, name));
        }
    }
    return out;
}

// First and last timestamp in one transcript, in milliseconds; null with none.
// The agent's own wall-clock, which its `.meta.json` does not record.
function spanOf(file) {
    let text;
    try {
        text = fs.readFileSync(file, 'utf8');
    } catch (e) {
        return null;
    }
    let first = null;
    let last = null;
    for (const raw of text.split('\n')) {
        if (!raw) continue;
        let entry;
        try {
            entry = JSON.parse(raw);
        } catch (e) {
            continue;
        }
        const t = entry && typeof entry.timestamp === 'string' ? Date.parse(entry.timestamp) : NaN;
        if (!Number.isFinite(t)) continue;
        if (first === null || t < first) first = t;
        if (last === null || t > last) last = t;
    }
    return first === null ? null : { first, last };
}

function agentsOf(transcriptPath) {
    const dir = sessionDirOf(transcriptPath);
    if (!dir) return null;
    const out = { agents: 0, requests: 0, models: {}, wallMs: 0 };
    for (const file of agentFiles(dir)) {
        const seen = summarise(file, { sidechain: true });
        if (!seen) continue;
        out.agents += 1;
        out.requests += seen.usage.requests;
        for (const [id, m] of Object.entries(seen.usage.models)) {
            const t = out.models[id] || (out.models[id] = { input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 });
            for (const k of Object.keys(t)) t[k] += m[k];
        }
        const span = spanOf(file);
        if (span) out.wallMs += span.last - span.first;
    }
    return out.agents ? out : null;
}

// The parent and its agents, as one record. `usage.requests` and
// `usage.models` stay the parent's own — that is what every reader of the
// field already expects — and the agents sit beside them under `subagents`,
// present only when there were any.
function summariseTree(transcriptPath) {
    const own = summarise(transcriptPath);
    const agents = agentsOf(transcriptPath);
    if (!own && !agents) return null;
    const usage = own ? own.usage : { requests: 0, models: {} };
    if (agents) usage.subagents = agents;
    return { model: own ? own.model : null, usage };
}
```

   and `module.exports = { summarise, agentsOf, summariseTree };`. Run the tests; all green, the earlier three included.

3. In `hooks/leave.js`, the two lines that read the transcript and write the fields become:

```js
        const seen = typeof payload.transcript_path === 'string' ? usage.summariseTree(payload.transcript_path) : null;
```

```js
                if (seen) {
                    if (seen.model) d.model = seen.model;
                    d.usage = seen.usage;
                }
```

   Add to `tests/leave.test.js`'s `fixture()`, after the transcript is written: an agent transcript at `path.join(base, 't', 'subagents', 'agent-dddd.jsonl')` (make the directory) holding one line `JSON.stringify({ type: 'assistant', isSidechain: true, requestId: 'd1', timestamp: '2026-09-04T02:00:00.000Z', message: { model: 'claude-sonnet-5', usage: { input_tokens: 4, output_tokens: 8 } } }) + '\n'`. Then in the first test, after the existing `usage` assertion, replace it with:

```js
    assert.deepEqual(d.usage.models, { 'claude-sonnet-5': { input: 11, output: 22, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 } });
    assert.equal(d.usage.requests, 2);
    assert.deepEqual(d.usage.subagents, { agents: 1, requests: 1, wallMs: 0,
        models: { 'claude-sonnet-5': { input: 4, output: 8, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 } } });
```

   Run `node --test tests/leave.test.js`; green.

4. In `lib/station.js`, `gather`'s row gains two fields after `cost`:

```js
                agents: usage && usage.subagents && typeof usage.subagents === 'object' ? usage.subagents : null,
                agentCost: usage && usage.subagents && usage.subagents.models ? prices.costOf(usage.subagents.models) : null,
```

   In `row()`, the cost cell becomes own plus agents. Replace the `usd` line and the cost `<span>` with:

```js
    const usd = s.cost && s.cost.priced.length ? '$' + s.cost.usd.toFixed(2) : '';
    const agentUsd = s.agentCost && s.agentCost.priced.length ? '$' + s.agentCost.usd.toFixed(2) : '';
    const costCell = usd || outTok
        ? (usd || outTok) + (agentUsd ? ' + ' + agentUsd + ' (' + s.agents.agents + ' agents)' : '')
        : '';
```

```js
        + `<span>${esc(costCell)}${esc(unpriced)}</span>`
```

   and add to the `<dl>`, after the `guard` row:

```js
        + (s.agents ? `<dt>agents</dt><dd>${s.agents.agents} agents, ${s.agents.requests} requests, ${esc(mins(s.agents.wallMs))} of their own wall-clock</dd>` : '')
```

   In `tests/station.test.js`, give the DOWN session's `usage` a `subagents` member: `subagents: { agents: 2, requests: 5, wallMs: 60000, models: { 'claude-sonnet-5': { input: 1e6, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 } } }`, and add to the gather test `assert.equal(down.agentCost.usd, 2); assert.equal(down.agents.agents, 2);` and to the render test `assert.ok(page.includes('2 agents'));`. Run `node --test tests/station.test.js tests/station-cli.test.js`; green.

5. `docs/registry.md`: where the `usage` shape is described, add that `usage.subagents` — `{ agents, requests, models, wallMs }` — is present when the session ran agents, summed over every transcript under the session's `subagents/` directory with the sidechain flag counted, and that `requests` and `models` at the top stay the parent's own. `docs/station.md`, *What each row holds*: the dollar figure is the parent's, and beside it the agents' with their count; a row opens to their requests and wall-clock. Set both pages' `last_verified` to 2026-09-04 (already so; leave if so).

6. Run the full `node --test`, `node scripts/docs-check.js`. Commit: `feat: a session's own agents count in its usage`.

## Task 10: the live guard's test can fail

Added 2026-09-04 at `verify`. The adversary found that `tests/station-cli.test.js`'s "refuses a live row" assertion cannot distinguish the server's liveness guard from `clearEntry`'s age rule: the LIVE fixture was updated sixty seconds ago, so `clearEntry` would refuse it as `fresh` and the server maps that to `409` too. Neutering the guard left the test green.

**Files:**
- Modify: `tests/station-cli.test.js` — the LIVE row is old by the age rule, so only the guard can refuse it
- Test: `tests/station-cli.test.js`

**Interfaces:**
- Consumes: `serve` (Task 6); `clearEntry`'s age rule (Task 4).
- Produces: nothing new; the test now fails when the `if (row.state === 'live')` branch in `scripts/station.js` is removed.

**Dispatch:** implementer, sonnet — a fixture change and one assertion.

**Steps**

1. In `fixture()`, change LIVE's record to be stale by age while still running: `started: at(now - 40 * DAY), updated: at(now - 30 * DAY)` (keep `active: true`, `configDir: cfg`, and the running-session file with `pid: process.pid` and `sessionId: LIVE`). Then in the serve test, after the `409` assertion on the LIVE row, add:

```js
        const refused = await post(form({ root: f.r1, id: LIVE, nonce }));
        assert.equal(refused.status, 409);
        assert.match(refused.text, /running/);
```

   (the existing `409` line may be folded into this). Keep the `registry.readSession(f.r1, LIVE).active === true` assertion after it.

2. Prove it can fail: in a scratch copy — `git stash` is not allowed; use `git worktree add <tmp> HEAD` or copy `scripts/station.js` aside — comment out the `if (row.state === 'live') { ... }` block, run the test, watch the LIVE row get cleared and the assertion fail, restore. Write the two runs' pass/fail lines to the report.

3. Run `node --test tests/station-cli.test.js` and the full suite. Commit: `test: the station's live guard is tested on a row the age rule would clear`.

## Self-review

- **Spec coverage.** Discovery (three sources) — Task 1, Task 5. Gathering
  and states — Task 5. Rendering, the dated price, the two clear controls —
  Task 5. The command, `serve`, the nonce, `409` on live, idle exit, opening
  the browser — Task 6. `clearEntry` and an unchanged CLI — Task 4.
  `SessionEnd`, `ended`/`model`/`usage`, `active` untouched, regeneration
  on every end — Task 7. `usage` once per `requestId` — Task 2. The table
  and `verified` — Task 3. TokenBar untouched — no task edits it. Documents
  — Task 8. The unverified item (a 13 MB read under `async`) has no test and
  says so in `hooks/leave.js`; `verify` ends a real session.
- **Placeholders.** None. Every step carries its code or its text.
- **Names.** `readLeads`, `summarise`, `costOf`, `verified`, `clearEntry`,
  `discover`/`gather`/`render`/`write`/`stationPath`, `serve` — each defined
  once and used by that name after.
- **Against the spec's file table.** The spec named `hooks/hooks.json` and a
  single `cacheWrite`; both were wrong on reading the tree, and the spec is
  corrected in the same commit as this plan.
