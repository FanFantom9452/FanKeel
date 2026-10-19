---
status: design-intent
---

# 任務完成紀錄 Implementation Plan

**Goal:** Every task that reaches land files one six-field completion record, kept on the registry entry and in a monthly file, and the station and the session's last message show it.
**Architecture:** A new `scripts/record.js write` reads five fields on stdin, works out 花費 itself from the session's transcript with the station's own pricing, refuses a record that fails `lib/plain.js`, and files it twice. Land's template and output rule name the six fields; `lib/gatereport.js` reads them; `lib/station.js` carries the registry copy to the page; `assets/station/station.js` draws it in the detail, the session page and the list.
**Tech Stack:** Node >=22.5 (`package.json` `engines`), no dependencies at all, `node:test` with `--test-timeout=300000 --test-force-exit --require ./tests/subprocess-timeout.js`.
**Spec:** [2026-10-19-task-record-design.md](2026-10-19-task-record-design.md)

## Global Constraints

- No dependency may be added: `package.json` declares none and every script uses the standard library only.
- An implementer runs only its own test file (`node --test tests/<file>.test.js`); the full suite is `node scripts/suite.js --fast`, run by the parent before a group commits — one suite per machine, `lib/suitelock.js`.
- Every injected stage block stays under 2400 characters at the reference plugin root (`tests/render.test.js:569`, `:801`); land renders at 2397 today, so land's new text must replace text rather than add it.
- Skill byte caps are asserted in `tests/skill-size.test.js:12-13` (every skill but fankeel and fankeel-build 24000); `node scripts/skills-check.js` must stay green, and its unknown-flag gate reads a script's flags off a literal `OPTIONS` table (`scripts/judge.js:16-30`).
- Every station string is written `loc(key, zh, vars)` in `assets/station/station.js` and has its English in `assets/station/i18n.js`; `tests/station-i18n.test.js:95-98` fails on a key without English and on English no call uses.
- Every `gv-` class the gate tab draws needs a rule in `assets/station/station.css` (`tests/station-gate-tab.test.js`, "every gv- class drawn").
- `assets/station/station.js` is 6746 lines: a task edits it only through a `path:a-b` range.
- Chinese a person reads follows `docs/90-agent/reference/plain-language.md`: a sentence at most `MAX_SENTENCE_WIDTH` (160) columns, no bare sha, `Task N` or TODO id (`lib/plain.js:11-60`).
- Every reference page carries frontmatter (`status`, `last_verified`, `source_of_truth`) and `node scripts/docs-check.js` must stay green; a markdown file outside every `.fankeel/docs.json` bucket is reported unfiled.
- Commit subjects are conventional (`feat:`, `fix:`, `docs:`, `chore:`), body ends with the Co-Authored-By line; a fankeel change is released at land (patch bump, suite, `chore: release`).
- `.fankeel/map.md`: 1045 markdown files, 6 planned (this design among them), 31 undeclared — the design names the three pages it makes false (plain-language.md §完成紀錄, the land skill's step 2 and Output, station.md); no other current page contradicts it.

## Risks

- The neighbour session 「TODO 全表盤點 10-19 第三輪」 is at build and has `lib/stages.js`, `skills/fankeel-land/SKILL.md`, `.fankeel/docs.json` and `docs/README.md` in its touched list — Tasks 1, 2, 5 — build starts after that task lands; each of those tasks runs `git log -3 -- <file>` first and edits against the file as it is then.
- Land's block is 3 characters under its cap — Task 2 — runs `node --test tests/render.test.js` after the edit; if it is over, shortens the template placeholders, never the rule list.
- `lib/gatereport.js`'s `KEY` regex matches only ASCII keys and 白話 — Task 2 — extends it, and its test parses a six-field report end to end.
- The money in 花費 is a snapshot when land writes it, while the station's cost cell keeps growing until the session ends — Task 1 — the test pins that `record.js` uses the station's formula (`usd + agentUsd`, `lib/station.js:775-776`) on the same transcript, not that the two figures match later.
- `assets/station/station.js` is drawn in a browser and required by tests — Task 4 — puts its new functions at the IIFE's top level with a `module.exports` line, the way `planTab` is (`:4695`), and runs `tests/station-i18n.test.js` and `tests/station-gate-tab.test.js` with its own test.

## File structure

| file | responsibility |
|---|---|
| `scripts/record.js` (new) | parse the five typed fields, add 花費, refuse what plain.js finds, write registry and monthly file |
| `docs/90-agent/records/<YYYY-MM>.md` (written at run time) | the git copy of every record, one `##` section each |
| `lib/stages.js` | land's rules and template name the six fields |
| `lib/gatereport.js` | the gate tab reads the six keys |
| `skills/fankeel-land/SKILL.md` | land runs `record.js write`, the TODO record links to it, the last message is the record |
| `lib/station.js` | `record` on each session, from the registry entry |
| `assets/station/station.js`, `station.css`, `i18n.js` | the `record`, `record-none`, `record-page`, `record-page-none` and `list-ask` blocks; land's gate tab reads the new parts |
| `.fankeel/docs.json`, `docs/README.md`, plain-language.md, station.md | the bucket and the pages that describe it |

## Task 1: `record.js write` files the record twice

**Files:**
- Modify: `scripts/record.js` — new: the `write` verb
- Modify: `.fankeel/docs.json` — a bucket `docs/90-agent/records`, `role: report`, `audience: human`
- Read: `scripts/judge.js:16-30` and `:100-125` — the `OPTIONS` table shape and how it finds the root, the project and a bucket
- Read: `lib/plain.js:30-60` — `longSentences(text)` and `bareCodes(text, ids)`, and `todoIds(root)` at `:154`
- Read: `lib/usage.js:387-394` — `summariseTree(path)` returns `{ model, usage: { requests, models, subagents? } }`
- Read: `lib/detail.js:635` — `transcriptOf(configDir, sessionId)`
- Read: `lib/prices.js:71` — `costOf(models)` returns `{ usd, priced, unpriced, estimated }`
- Read: `lib/live.js:28` — `liveConfigDir()`
- Read: `lib/registry.js` — `rootFor` (`:131`), `readSession` (`:149`), `update` (`:398`; the change function returns nothing to write)
- Read: `lib/docs.js` — `read(projectRoot)` (`:126`, `{ tree: { buckets } }`) and `projectRootsFor(root, projects)` (`:286`)
- Test: `tests/record.test.js`

**Interfaces:**
- Consumes: none
- Produces: CLI `node scripts/record.js write --session <id> [--root <dir>] [--project <dir>] [--config-dir <dir>]`, stdin the record. Prints `filed: <repo-relative file>#<anchor>` then the six lines. Registry field `record: { at: <ISO>, file: <repo-relative path>, anchor: <string>, fields: { ask: string, did: string[], why: string, checked: string, cost: string, left: string } }`. Exports `{ parse, problems, costLine, section }`.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Write the failing test, `tests/record.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const registry = require('../lib/registry.js');
const usage = require('../lib/usage.js');
const prices = require('../lib/prices.js');
const tmp = require('./tmp.js');
const { parse, problems } = require('../scripts/record.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'record.js');
const A = 'aaaaaaaa-1111-2222-3333-444444444444';
const GOOD = [
    '要求: 每個任務收尾時留一份看得懂的紀錄。',
    '做了什麼:',
    '  - 收尾時會寫一份六欄紀錄',
    '  - 監控站會顯示這份紀錄',
    '為什麼這樣做: 紀錄原本只寫在待辦底下，直接開的任務什麼都沒留下。',
    '驗過・沒驗過: 單元測試全過；沒有在真的收尾裡跑過一次。',
    '還剩什麼: 舊任務沒有紀錄。',
].join('\n');

function seed() {
    const root = tmp('fankeel-record-');
    registry.ensureLayout(root);
    registry.writeSession(root, A, { task: '六欄紀錄', stage: 'land', route: ['design', 'land'], active: true, claims: [],
        started: new Date(Date.now() - 90 * 60000).toISOString(), updated: new Date().toISOString() });
    const cfg = path.join(root, 'cfg');
    const dir = path.join(cfg, 'projects', 'p');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, A + '.jsonl'), JSON.stringify({ type: 'assistant', requestId: 'r1', timestamp: new Date().toISOString(),
        message: { role: 'assistant', model: 'claude-sonnet-5-5', usage: { input_tokens: 1000000, output_tokens: 0 }, content: [] } }) + '\n');
    return { root, cfg, transcript: path.join(dir, A + '.jsonl') };
}

function run(s, input) {
    try {
        return { out: execFileSync(process.execPath, [SCRIPT, 'write', '--session', A, '--root', s.root, '--config-dir', s.cfg], { encoding: 'utf8', input }), code: 0 };
    } catch (e) {
        return { out: String(e.stdout || '') + String(e.stderr || ''), code: e.status };
    }
}

const month = () => new Date().toISOString().slice(0, 7);
const recordsDir = (root) => path.join(root, 'docs', 'records');

test('a record missing 為什麼這樣做 exits 1, names the field, and writes nothing', () => {
    const s = seed();
    const out = run(s, GOOD.split('\n').filter((l) => !l.startsWith('為什麼這樣做')).join('\n'));
    assert.equal(out.code, 1);
    assert.match(out.out, /為什麼這樣做/);
    assert.equal(fs.existsSync(recordsDir(s.root)), false);
    assert.equal(registry.readSession(s.root, A).record, undefined);
});

test('a sha in 做了什麼 exits 1 and writes nothing', () => {
    const s = seed();
    const out = run(s, GOOD.replace('  - 監控站會顯示這份紀錄', '  - 監控站會顯示 4992cb98 的紀錄'));
    assert.equal(out.code, 1);
    assert.match(out.out, /4992cb98/);
    assert.equal(fs.existsSync(recordsDir(s.root)), false);
});

test('a complete record lands on the registry and as one section of the month file, and 花費 is the station formula', () => {
    const s = seed();
    const out = run(s, GOOD);
    assert.equal(out.code, 0, out.out);
    const rec = registry.readSession(s.root, A).record;
    assert.deepEqual(rec.fields.did, ['收尾時會寫一份六欄紀錄', '監控站會顯示這份紀錄']);
    assert.equal(rec.fields.ask, '每個任務收尾時留一份看得懂的紀錄。');
    // lib/station.js:775-776 prints usd + agentUsd; one million sonnet input tokens.
    const seen = usage.summariseTree(s.transcript);
    const usd = prices.costOf(seen.usage.models).usd;
    assert.equal(usd, 2);
    assert.match(rec.fields.cost, /^\$2\.00，/);
    assert.match(rec.fields.cost, /1 小時 30 分/);
    const file = path.join(recordsDir(s.root), month() + '.md');
    const text = fs.readFileSync(file, 'utf8');
    assert.equal((text.match(/^## /gm) || []).length, 1);
    assert.match(text, /^## \d{4}-\d{2}-\d{2} 六欄紀錄$/m);
    for (const name of ['要求', '做了什麼', '為什麼這樣做', '驗過・沒驗過', '花費', '還剩什麼']) assert.match(text, new RegExp('^- ' + name + '：', 'm'));
    assert.equal(rec.file, 'docs/records/' + month() + '.md');
    assert.match(out.out, new RegExp('^filed: docs/records/' + month() + '\\.md#' + rec.anchor + '$', 'm'));
    assert.match(text, new RegExp('<a id="' + rec.anchor + '"></a>'));
});

test('a second write replaces the registry copy and appends a 更正 section, leaving the first', () => {
    const s = seed();
    run(s, GOOD);
    const file = path.join(recordsDir(s.root), month() + '.md');
    const first = fs.readFileSync(file, 'utf8');
    const out = run(s, GOOD.replace('舊任務沒有紀錄。', '舊任務沒有紀錄，要另外補。'));
    assert.equal(out.code, 0, out.out);
    const text = fs.readFileSync(file, 'utf8');
    assert.ok(text.startsWith(first));
    assert.match(text, /^## \d{4}-\d{2}-\d{2} 六欄紀錄（更正）$/m);
    assert.equal(registry.readSession(s.root, A).record.fields.left, '舊任務沒有紀錄，要另外補。');
    assert.match(registry.readSession(s.root, A).record.anchor, /-2$/);
});

test('parse reads the five typed fields and ignores a typed 花費; problems names a long sentence', () => {
    const f = parse(GOOD + '\n花費: 很多');
    assert.equal(f.cost, undefined);
    assert.equal(f.did.length, 2);
    assert.deepEqual(problems(Object.assign({}, f, { why: '很'.repeat(81) + '。' }), []).length, 1);
});
```

2. Run it and watch it fail: `node --test tests/record.test.js` — `Cannot find module '../scripts/record.js'`.

3. Write `scripts/record.js`:

```js
#!/usr/bin/env node
'use strict';

// The completion record a task leaves at land, whether or not it closed a TODO
// entry (docs/90-agent/plans/2026-10-19-task-record-design.md). `write` reads
// five fields on stdin, works out 花費 itself, and files the record twice: on
// the registry entry, for the station, and in the month's file, for git.

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs: parseArgv } = require('node:util');
const registry = require('../lib/registry.js');
const docs = require('../lib/docs.js');
const plain = require('../lib/plain.js');
const usage = require('../lib/usage.js');
const detail = require('../lib/detail.js');
const prices = require('../lib/prices.js');
const live = require('../lib/live.js');

// The literal table `lib/skills.js` reads a script's flags from.
const OPTIONS = {
    session: { type: 'string' },
    root: { type: 'string' },
    project: { type: 'string' },
    'config-dir': { type: 'string' },
};

// Field name as the user reads it, and as the registry stores it.
const FIELDS = [['要求', 'ask'], ['做了什麼', 'did'], ['為什麼這樣做', 'why'], ['驗過・沒驗過', 'checked'], ['花費', 'cost'], ['還剩什麼', 'left']];
const TYPED = FIELDS.filter(([, k]) => k !== 'cost');
const KEY = /^(要求|做了什麼|為什麼這樣做|驗過・沒驗過|花費|還剩什麼)[:：][ \t]*(.*)$/;
const ITEM = /^\s+- (.+)$/;

function fail(msg) {
    process.stdout.write(msg + '\n');
    process.exit(1);
}

// 花費 is never taken from the model: a typed one is dropped here.
function parse(text) {
    const byName = new Map(FIELDS);
    const out = { did: [] };
    let list = false;
    for (const line of String(text || '').split(/\r?\n/)) {
        const item = list ? ITEM.exec(line) : null;
        if (item) { out.did.push(item[1].trim()); continue; }
        list = false;
        const m = KEY.exec(line);
        if (!m) continue;
        const key = byName.get(m[1]);
        if (key === 'cost') continue;
        if (key === 'did') {
            list = true;
            if (m[2].trim()) out.did.push(m[2].trim());
        } else {
            out[key] = m[2].trim();
        }
    }
    return out;
}

function problems(fields, ids) {
    const out = [];
    for (const [name, key] of TYPED) {
        const v = fields[key];
        const empty = key === 'did' ? !v || !v.length : !v;
        if (empty) out.push(name + ' is missing or empty.');
    }
    for (const [name, key] of TYPED) {
        const text = key === 'did' ? (fields.did || []).join('\n') : fields[key] || '';
        for (const s of plain.longSentences(text)) out.push(name + ': a sentence ' + s.width + ' columns wide, ' + plain.MAX_SENTENCE_WIDTH + ' at most: split it.');
        for (const b of plain.bareCodes(text, ids)) out.push(name + ': "' + b.code + '" stands where its name should be.');
    }
    return out;
}

function duration(ms) {
    const m = Math.max(Math.round(ms / 60000), 0);
    return m >= 60 ? Math.floor(m / 60) + ' 小時 ' + (m % 60) + ' 分' : m + ' 分';
}

const short = (id) => String(id).replace(/^claude-/, '');

// The station's own figure (lib/station.js:775-776, usd + agentUsd) read from
// the same transcript, plus the time since the task started.
function costLine(data, sessionId, configDir, now) {
    const time = duration(now - Date.parse(data.started));
    const file = detail.transcriptOf(configDir, sessionId);
    const seen = file ? usage.summariseTree(file) : null;
    if (!seen) return '對話紀錄找不到，金額沒算；從開始到現在 ' + time + '。';
    const own = prices.costOf(seen.usage.models);
    const sub = seen.usage.subagents || null;
    const theirs = sub && sub.models ? prices.costOf(sub.models) : null;
    const usd = (own.priced.length ? own.usd : 0) + (theirs && theirs.priced.length ? theirs.usd : 0);
    const agents = sub ? sub.agents || 0 : 0;
    const models = sub && sub.models ? Object.keys(sub.models).map(short) : [];
    const who = seen.model ? '主 session ' + short(seen.model) + (models.length ? '，agent 用 ' + models.join('、') : '') : '';
    return '$' + usd.toFixed(2) + '，' + time + '，' + agents + ' 個 agent' + (who ? '（' + who + '）' : '') + '。';
}

function section(title, day, anchor, fields, corrected) {
    const lines = ['<a id="' + anchor + '"></a>', '', '## ' + day + ' ' + title + (corrected ? '（更正）' : ''), ''];
    for (const [name, key] of FIELDS) {
        if (key === 'did') {
            lines.push('- ' + name + '：');
            for (const d of fields.did) lines.push('  - ' + d);
        } else {
            lines.push('- ' + name + '：' + fields[key]);
        }
    }
    return lines.join('\n') + '\n';
}

function write(opts) {
    if (!opts.session) fail('--session <id> is required: the record belongs to one task.');
    const root = opts.root ? path.resolve(opts.root) : registry.rootFor({ cwd: process.cwd() });
    const mine = registry.readSession(root, opts.session);
    if (!mine || mine.active !== true) fail('No active entry for ' + opts.session + ' under ' + root);
    const projectRoot = docs.projectRootsFor(root, opts.project ? [opts.project] : (mine.project ? [mine.project] : []))[0] || root;
    const fields = parse(fs.readFileSync(0, 'utf8'));
    const found = problems(fields, plain.todoIds(projectRoot).ids);
    if (found.length) fail('Nothing written. Fix these and pipe the record again:\n' + found.map((p) => '  - ' + p).join('\n'));
    const now = Date.now();
    fields.cost = costLine(mine, opts.session, opts['config-dir'] || mine.configDir || live.liveConfigDir(), now);
    const { tree } = docs.read(projectRoot);
    const bucket = tree && tree.buckets.find((b) => /(^|\/)records$/.test(b.path));
    const rel = (bucket ? bucket.path : 'docs/records') + '/' + new Date(now).toISOString().slice(0, 7) + '.md';
    const file = path.join(projectRoot, ...rel.split('/'));
    const day = new Date(now).toISOString().slice(0, 10);
    const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const base = 'r-' + day + '-' + String(opts.session).slice(0, 8);
    const taken = (before.match(new RegExp('<a id="' + base + '(-\\d+)?"></a>', 'g')) || []).length;
    const anchor = taken ? base + '-' + (taken + 1) : base;
    const corrected = Boolean(mine.record);
    const head = before ? before.replace(/\n*$/, '\n\n') : '# 任務完成紀錄 ' + rel.slice(-10, -3) + '\n\n';
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, head + section(mine.task || opts.session, day, anchor, fields, corrected));
    registry.update(root, opts.session, (d) => {
        d.record = { at: new Date(now).toISOString(), file: rel, anchor, fields };
    });
    const out = ['filed: ' + rel + '#' + anchor];
    for (const [name, key] of FIELDS) {
        if (key === 'did') out.push(name + ':', ...fields.did.map((d) => '  - ' + d));
        else out.push(name + ': ' + fields[key]);
    }
    process.stdout.write(out.join('\n') + '\n');
}

function main(argv) {
    const { values, positionals } = parseArgv({ args: argv, options: OPTIONS, allowPositionals: true });
    if (positionals[0] !== 'write') fail('record.js write --session <id> [--root <dir>] [--project <dir>] [--config-dir <dir>] < record');
    write(values);
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { parse, problems, costLine, section };
```

4. In `.fankeel/docs.json`, after the judgements bucket, add:

```json
    {
      "path": "docs/90-agent/records",
      "role": "report",
      "audience": "human"
    },
```

5. Run `node --test tests/record.test.js` and watch it pass, then `node scripts/skills-check.js` (the new flags are in `OPTIONS`).

6. Commit: `feat: record.js files a six-field task record`.

## Task 2: Land writes the record and the gate tab reads it

**Files:**
- Modify: `lib/stages.js:388-415` — land's `shipped:` rule, its `Output:` rule and its template
- Modify: `lib/gatereport.js:18-35` — `KEY` and `KEYS.land`
- Modify: `skills/fankeel-land/SKILL.md` — step 2's TODO record line and the Output section
- Test: `tests/stages.test.js`
- Test: `tests/gatereport.test.js`

**Interfaces:**
- Consumes: Task 1's CLI `record.js write --session <id>` and its `filed: <file>#<anchor>` line
- Produces: `parseReport('land', text)` parts `ask`, `why`, `checked`, `record` (strings); 做了什麼 items in `shipped`, 花費 in `cost`, 還剩什麼 in `open`. The old keys `shipped`, `cost`, `open`, `白話` still parse.

**Dispatch:** implementer, sonnet — the plan carries the code; the one judgement, staying under the cap, is measured by a test.

1. Replace the test at `tests/stages.test.js:1225-1226`:

```js
test('the land template lists the six record fields in order, then suite and the record link', () => {
  assert.match(templateFor('land'), /\n要求: [^\n]+\n做了什麼:\n  - [^\n]+\n為什麼這樣做: [^\n]+\n驗過・沒驗過: [^\n]+\n花費: [^\n]+\n還剩什麼: [^\n]+\nsuite: [^\n]+\n紀錄: [^\n]+\nthen AskUserQuestion$/);
```

Keep the rest of that test's body (the clear-rule order assertions) as it is. Below it, in `tests/stages.test.js`, add:

```js
test('the land skill pipes the record to record.js, names its anchor on option one, and ends on the record', () => {
  const skill = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'skills', 'fankeel-land', 'SKILL.md'), 'utf8');
  assert.match(skill, /scripts/record.js write --session <id>/);
  assert.match(skill, /Option one'ss+description names the month file and anchor/);
  assert.match(skill, /the session's last message is the six lines as printed,s+and nothing after them/);
});
```

2. Add to `tests/gatereport.test.js`:

```js
test('land reads the six record fields, the old keys still parse', () => {
    const p = parseReport('land', [
        '4992cb98 docs: design',
        '要求: 每個任務留一份紀錄。',
        '做了什麼:',
        '  - 收尾時寫六欄紀錄',
        '  - 監控站顯示它',
        '為什麼這樣做: 直接開的任務原本什麼都沒留下。',
        '驗過・沒驗過: 測試全過；沒有實跑。',
        '花費: $3.10，40 分，2 個 agent。',
        '還剩什麼: 舊任務沒有紀錄。',
        'suite: suite.js: 10 pass, 0 fail',
        '紀錄: docs/90-agent/records/2026-10.md#r-2026-10-19-aaaaaaaa',
    ].join('\n'));
    assert.deepEqual(p.shipped, ['收尾時寫六欄紀錄', '監控站顯示它']);
    assert.equal(p.ask, '每個任務留一份紀錄。');
    assert.equal(p.why, '直接開的任務原本什麼都沒留下。');
    assert.equal(p.checked, '測試全過；沒有實跑。');
    assert.equal(p.cost, '$3.10，40 分，2 個 agent。');
    assert.equal(p.open, '舊任務沒有紀錄。');
    assert.equal(p.record, 'docs/90-agent/records/2026-10.md#r-2026-10-19-aaaaaaaa');
    assert.deepEqual(p.rest, []);
});
```

3. Run `node --test tests/stages.test.js tests/gatereport.test.js` and watch both fail.

4. In `lib/gatereport.js`, replace line 18:

```js
const KEY = /^([A-Za-z][A-Za-z ,-]*|白話|要求|做了什麼|為什麼這樣做|驗過・沒驗過|花費|還剩什麼|紀錄)[:：][ \t]*(.*)$/;
```

In `lib/gatereport.js`, replace the `land:` entry of `KEYS`:

```js
    land: {
        shipped: 'shipped', suite: 'suite', cost: 'cost', open: 'open', '白話': 'plain',
        '要求': 'ask', '做了什麼': 'shipped', '為什麼這樣做': 'why', '驗過・沒驗過': 'checked', '花費': 'cost', '還剩什麼': 'open', '紀錄': 'record',
    },
```

5. In `lib/stages.js`, in the land entry, replace the `shipped:` rule (line 395):

```js
            '做了什麼: one line per thing someone can now do that they could not.',
```

In `lib/stages.js`, replace the `Output:` rule (line 398):

```js
            'Output: `node {{SUITE}} --session <id> --check` first; red stops; pipe the record to `record.js write`, which adds 花費.',
```

In `lib/stages.js`, replace the land template:

```js
        template: [
            '<sha> <subject>',
            "要求: <the ask, one line, in the user's language>",
            '做了什麼:',
            '  - <what someone can now do that they could not>',
            '為什麼這樣做: <the approach; what was given up>',
            '驗過・沒驗過: <checked; not checked>',
            '花費: <record.js wrote it>',
            '還剩什麼: <what is still not done>',
            'suite: <suite.js line>',
            '紀錄: <filed: line>',
            'then AskUserQuestion',
        ].join('\n'),
```

6. Run `node --test tests/stages.test.js tests/gatereport.test.js tests/render.test.js`. If `render.test.js` reports land at or over 2400, shorten the template's placeholders (`<the ask, one line, in the user's language>` → `<the ask, one line>`) until it passes; the rules stay as written.

7. In `skills/fankeel-land/SKILL.md`, step 2, replace the `todo.js done ... --record` line's text so it reads:

```md
- `node <plugin>/scripts/todo.js done <id> --record "<one or two sentences on this entry>. 詳見[任務紀錄](../records/<YYYY-MM>.md#<anchor>)"` — the anchor is the one `record.js write` printed on its `filed:` line. The record itself lives there, not here.
```

In `skills/fankeel-land/SKILL.md`, replace the Output section's body (from the line after `## Output` to the end of its fence) with:

````md
Run the suite with `--check` first; red stops the stage. Then write the five
typed fields in the user's language, to plain-language.md, and pipe them in:

```
node <plugin>/scripts/record.js write --session <id> <<'EOF'
要求: <the ask, one line>
做了什麼:
  - <what someone can now do that they could not>
為什麼這樣做: <the approach; what was given up>
驗過・沒驗過: <checked; not checked>
還剩什麼: <what is still not done>
EOF
```

It refuses a missing field, a sentence over 160 columns and a bare code, and
writes nothing; fix and pipe again. On success it adds 花費 from the session's
own transcript, files the record on the registry entry and in the month's file,
and prints `filed: <file>#<anchor>` and the six lines.

The report above the gate is that output: the commit line, the six lines as
printed, `suite:`, and `紀錄:` with the `filed:` value. Option one's
description names the month file and anchor.

After the user answers, the session's last message is the six lines as printed,
and nothing after them. A follow-up question the user asks after that is
answered, then the six lines are repeated as the last thing said.
````

8. Run `node scripts/skills-check.js` and `node --test tests/skills.test.js tests/skill-size.test.js`.

9. Commit: `feat: land writes the six-field record`.

## Task 3: The station carries each session's record

**Files:**
- Modify: `lib/station.js` — `recordOf(data)`; `record` in `gather()` beside `notes:` (`:549`) and in `serialize()` beside `notes:` (`:796`)
- Test: `tests/station-record-data.test.js`

**Interfaces:**
- Consumes: Task 1's registry field `record: { at, file, anchor, fields }`
- Produces: `window.STATION.sessions[i].record` — `{ at, file, anchor, fields: { ask, did[], why, checked, cost, left } }` or `null`

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Write the failing test, `tests/station-record-data.test.js` (its fixture is the one the station breathe test uses):

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const registry = require('../lib/registry.js');
const station = require('../lib/station.js');
const tmp = require('./tmp.js');

const SID = 'aaaaaaaa-1111-4111-8111-111111111111';
const FIELDS = { ask: '留一份紀錄。', did: ['寫六欄紀錄'], why: '原本沒有。', checked: '測試全過。', cost: '$1.00，5 分，0 個 agent。', left: '沒有。' };

function page(extra) {
    const base = tmp('fankeel-record-data-');
    const cfg = path.join(base, 'cfg');
    const r = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(r);
    const now = Date.now();
    registry.writeSession(r, SID, Object.assign({ task: 't', project: 'ws', stage: 'land', route: ['build', 'land'],
        active: true, claims: [], started: new Date(now - 3600e3).toISOString(), updated: new Date(now - 60e3).toISOString(),
        configDir: cfg }, extra));
    fs.writeFileSync(path.join(cfg, 'sessions', process.pid + '.json'), JSON.stringify({
        pid: process.pid, sessionId: SID, cwd: r, startedAt: new Date(now - 3600e3).toISOString(),
        procStart: 0, version: '2.0.0', kind: 'interactive', entrypoint: 'cli', status: 'idle' }));
    const m = station.gather({ configDir: cfg });
    return JSON.parse(station.serialize(m, {}).replace(/^window\.STATION = /, '').replace(/;\n$/, ''));
}

test('a session with a record carries it to the page whole', () => {
    const rec = { at: '2026-10-19T10:00:00.000Z', file: 'docs/90-agent/records/2026-10.md', anchor: 'r-2026-10-19-aaaaaaaa', fields: FIELDS };
    assert.deepEqual(page({ record: rec }).sessions[0].record, rec);
});

test('a session without one, or with a broken one, carries null', () => {
    assert.equal(page({}).sessions[0].record, null);
    assert.equal(page({ record: 'x' }).sessions[0].record, null);
    assert.equal(page({ record: { at: 'x' } }).sessions[0].record, null);
});
```

2. Run `node --test tests/station-record-data.test.js` and watch it fail (`undefined` where the record is).

3. In `lib/station.js`, above `function gather(opts)` (`:423`), add:

```js
// The completion record land filed (scripts/record.js), or null for a session
// that has none or one that does not have the shape the page reads.
function recordOf(data) {
    const r = data && data.record;
    if (!r || typeof r !== 'object' || !r.fields || typeof r.fields !== 'object') return null;
    return { at: r.at || null, file: r.file || null, anchor: r.anchor || null, fields: r.fields };
}
```

In `lib/station.js`, in `gather()`, after `next: registry.nextOf(data),` (`:550`), add:

```js
                record: recordOf(data),
```

In `lib/station.js`, in `serialize()`, change the line at `:796` to:

```js
            claims: s.claims, seen: s.seen || [], notes: s.notes, next: s.next, guard: s.guard, record: s.record || null,
```

4. Run `node --test tests/station-record-data.test.js` and watch it pass.

5. Commit: `feat: the station carries each session's record`.

## Task 4: The station draws the record

**Files:**
- Modify: `assets/station/station.js:3790-4880` — `recordHtml`, `recordPageHtml`, `listAskRow` above `sessionPage`; calls in `sessionPage`, the list row builder and `drawDetail`; `gateLand` reads `ask`, `why`, `checked`
- Modify: `assets/station/station.css:2490-2503` — the `rec-`, `recp-`, `ask-` rules, appended at the end
- Modify: `assets/station/i18n.js:870-890` — English for the `rec.` keys, after the last `det.` key (`:883`)
- Read: `lib/gatereport.js` — `parseReport`, `derive` (the test builds a land report with them)
- Read: `.fankeel/build/2026-10-19-task-record/probe/new.css` — the approved mockup's rules
- Test: `tests/station-record.test.js`

**Interfaces:**
- Consumes: Task 3's `s.record`; Task 2's land parts `ask`, `why`, `checked`, `shipped`, `cost`, `open`
- Produces: `module.exports.recordHtml(s)`, `module.exports.recordPageHtml(s)`, `module.exports.listAskRow(s, sel)` — each returns an HTML string

**Dispatch:** implementer, sonnet — the plan carries the code and the approved mockup carries the look.

1. Write the failing test, `tests/station-record.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const V = require('../assets/station/station.js');
const { parseReport, derive } = require('../lib/gatereport.js');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.css'), 'utf8');
const FIELDS = { ask: '留一份紀錄。', did: ['寫六欄紀錄', '監控站顯示它'], why: '原本沒有。', checked: '測試全過。', cost: '$1.00，5 分，0 個 agent。', left: '舊任務沒有。' };
const S = { id: 'a', state: 'down', record: { at: '2026-10-19T10:00:00.000Z', file: 'docs/90-agent/records/2026-10.md', anchor: 'r-x', fields: FIELDS } };
const dd = (html) => [...html.matchAll(/<dd[^>]*>([\s\S]*?)<\/dd>/g)].map((m) => m[1].replace(/<[^>]+>/g, '|'));

test('the detail and the page draw the same six fields in order, and the month file under them', () => {
    for (const html of [V.recordHtml(S), V.recordPageHtml(S)]) {
        const labels = [...html.matchAll(/<dt>([^<]*)<\/dt>/g)].map((m) => m[1]);
        assert.deepEqual(labels, ['要求', '做了什麼', '為什麼這樣做', '驗過・沒驗過', '花費', '還剩什麼']);
        const v = dd(html);
        assert.equal(v[0], FIELDS.ask);
        assert.match(v[1], /寫六欄紀錄\|.*監控站顯示它/);
        assert.equal(v[4], FIELDS.cost);
        assert.match(html, /docs\/90-agent\/records\/2026-10\.md/);
    }
    assert.match(V.recordHtml(S), /data-block="record"/);
    assert.match(V.recordPageHtml(S), /data-block="record-page"/);
});

test('no record is one muted line, never an empty block', () => {
    assert.match(V.recordHtml({ id: 'a', state: 'down', record: null }), /^<p class="rec-none" data-block="record-none">[^<]+<\/p>$/);
    assert.match(V.recordPageHtml({ id: 'a', state: 'live', record: null }), /^<p class="recp-none" data-block="record-page-none">[^<]+<\/p>$/);
});

test('a landed row gets its 要求 as a second row; a row with none gets nothing', () => {
    assert.match(V.listAskRow(S, 'a'), /^<tr class="ask" data-block="list-ask" data-id="a" aria-selected="true"><td><\/td><td colspan="7">.*留一份紀錄。/);
    assert.equal(V.listAskRow({ id: 'b', record: null }, 'a'), '');
});

test('record text is escaped', () => {
    const bad = { id: 'a', record: { file: 'f', fields: Object.assign({}, FIELDS, { ask: '<script>x</script>' }) } };
    assert.doesNotMatch(V.recordHtml(bad) + V.recordPageHtml(bad) + V.listAskRow(bad, 'a'), /<script>/);
});

test('land\'s gate tab shows 要求, 為什麼這樣做 and 驗過・沒驗過 from a six-field report', () => {
    const text = ['4992cb98 docs: x', '要求: 留一份紀錄。', '做了什麼:', '  - 寫六欄紀錄', '為什麼這樣做: 原本沒有。',
        '驗過・沒驗過: 測試全過。', '花費: $1.00。', '還剩什麼: 舊任務沒有。', 'suite: ok'].join('\n');
    const html = V.gateTabHtml({ stage: 'land' }, { stage: 'land', path: 'x', text, gate: null, parts: derive('land', parseReport('land', text)) }, []);
    for (const s of ['留一份紀錄。', '原本沒有。', '測試全過。']) assert.ok(html.includes(s), s);
    assert.match(html, /<ul class="gv-ship"><li>寫六欄紀錄<\/li><\/ul>/);
    assert.match(html, /<ul class="gv-open"><li>舊任務沒有。<\/li><\/ul>/);
});

test('every rec-, recp- and ask- class drawn has a rule in station.css', () => {
    const html = V.recordHtml(S) + V.recordPageHtml(S) + V.listAskRow(S, 'a') + V.recordHtml({ record: null }) + V.recordPageHtml({ record: null });
    const used = new Set([...html.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)).filter((c) => /^(rec|recp|ask)(-|$)/.test(c)));
    for (const c of used) assert.match(CSS, new RegExp('\\.' + c + '\\b'), c);
});
```

2. Run `node --test tests/station-record.test.js` and watch it fail (`V.recordHtml is not a function`).

3. In `assets/station/station.js`, directly above `function sessionPage(r) {` (`:3805`), add:

```js
    // The six-field record land files (scripts/record.js): first in the
    // detail, above the tabs on the session page, and its 要求 under a landed
    // row of the list. One muted line where there is none.
    var REC_FIELDS = [['ask', 'rec.ask', '要求'], ['did', 'rec.did', '做了什麼'], ['why', 'rec.why', '為什麼這樣做'],
        ['checked', 'rec.checked', '驗過・沒驗過'], ['cost', 'rec.cost', '花費'], ['left', 'rec.left', '還剩什麼']];
    function recordRows(f, cls) {
        return REC_FIELDS.map(function (k) {
            var v = f[k[0]];
            var body = k[0] === 'did'
                ? '<ul class="rec-ul">' + (Array.isArray(v) ? v : []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>'
                : esc(v || '');
            return '<div class="' + cls + '-r' + (k[0] === 'ask' ? ' ' + cls + '-ask' : '') + '"><dt>' + loc(k[1], k[2]) + '</dt>'
                + '<dd' + (k[0] === 'cost' ? ' class="rec-num"' : '') + '>' + body + '</dd></div>';
        }).join('');
    }
    function recordNone(s) {
        return s && s.state !== 'down' ? loc('rec.noneYet', '完成紀錄在 land 時寫。') : loc('rec.none', '這個任務沒有完成紀錄。');
    }
    function recordSrc(r, cls) {
        return r.file ? '<p class="' + cls + '-src">' + loc('rec.alsoIn', '也記在 {f}', { f: '<span class="mono">' + esc(r.file) + '</span>' }) + '</p>' : '';
    }
    function recordHtml(s) {
        var r = s && s.record;
        if (!r || !r.fields) return '<p class="rec-none" data-block="record-none">' + recordNone(s) + '</p>';
        return '<section class="rec" data-block="record" aria-labelledby="rec-h"><h3 class="rec-h" id="rec-h">' + loc('rec.title', '完成紀錄') + '</h3>'
            + '<dl class="rec-f">' + recordRows(r.fields, 'rec') + '</dl>' + recordSrc(r, 'rec') + '</section>';
    }
    function recordPageHtml(s) {
        var r = s && s.record;
        if (!r || !r.fields) return '<p class="recp-none" data-block="record-page-none">' + recordNone(s) + '</p>';
        return '<section class="panel recp" data-block="record-page" aria-labelledby="recp-h"><div class="h2" id="recp-h">' + loc('rec.title', '完成紀錄') + '</div>'
            + '<dl class="recp-f">' + recordRows(r.fields, 'recp') + '</dl>' + recordSrc(r, 'recp') + '</section>';
    }
    function listAskRow(s, sel) {
        var a = s && s.record && s.record.fields ? s.record.fields.ask : '';
        if (!a) return '';
        return '<tr class="ask" data-block="list-ask" data-id="' + esc(s.id) + '" aria-selected="' + (sel === s.id) + '"><td></td><td colspan="7">'
            + '<div class="ask-l" title="' + esc(a) + '"><span class="ask-k">' + loc('rec.ask', '要求') + '</span>' + esc(a) + '</div></td></tr>';
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports.recordHtml = recordHtml;
        module.exports.recordPageHtml = recordPageHtml;
        module.exports.listAskRow = listAskRow;
    }
```

In `assets/station/station.js`, in `sessionPage`, change `+ sessionHeadHtml(s, x) + '</section>'` (`:3852`) to:

```js
            + sessionHeadHtml(s, x) + '</section>' + recordPageHtml(s)
```

In `assets/station/station.js`, in the list row builder (`:4029`), change the row's opening and close so a row with a record is followed by its ask row:

```js
            var ask = listAskRow(s, sel);
            return '<tr' + (ask ? ' class="has-ask"' : '') + ' data-id="' + esc(s.id) + '" aria-selected="' + (sel === s.id) + '">'
```

and end the same `return` with `+ '<td class="num mute" style="font-size:11.5px">' + ago(s.updated) + '</td></tr>' + ask;` (the callback becomes a block body: `function (s) { var ask = ...; return ...; }`).

In `assets/station/station.js`, in `drawDetail`, after the `<h2 ...>` task line (`:4097`, the `+ esc(s.task || loc('dash.unnamed', '（未命名）')) + '</h2>'` line), add:

```js
            + recordHtml(s)
```

In `assets/station/station.js`, in `gateLand`, replace the `var body = (p.plain ? ...` opening with:

```js
        var said = [['ask', loc('rec.ask', '要求')], ['why', loc('rec.why', '為什麼這樣做')], ['checked', loc('rec.checked', '驗過・沒驗過')]]
            .filter(function (k) { return p[k[0]]; });
        var lead = said.length
            ? '<section class="gv-plain" aria-label="' + loc('rec.title', '完成紀錄') + '">' + said.map(function (k) {
                return '<h3>' + k[1] + '</h3><p>' + gateText(p[k[0]]) + '</p>';
            }).join('') + '</section>'
            : p.plain ? '<section class="gv-plain" aria-label="' + loc('det.gatePlain', '白話') + '"><h3>' + loc('det.gatePlain', '白話') + '</h3><p>' + gateText(p.plain) + '</p></section>' : '';
        var body = lead
```

keeping the rest of that expression (`+ (p.sha ? ...`) as it is.

4. In `assets/station/station.css`, append the mockup's rules from `.fankeel/build/2026-10-19-task-record/probe/new.css`, every rule except those whose selector starts `.mk-`:

```css
/* The completion record (scripts/record.js): the detail's first block,
   the session page above its tabs, and a landed row's 要求 in the list. */
#det .rec{background:var(--soft);border-radius:var(--r-sm);padding:12px 13px 10px;margin:0 0 4px}
.rec-h{margin:0 0 4px;font:600 12.5px/1.4 var(--sans);color:var(--fg)}
.rec-f{margin:0}
.rec-r{padding:8px 0;border-top:1px solid var(--line)}
.rec-h + .rec-f .rec-r:first-child{border-top:0;padding-top:4px}
.rec-r dt{font:600 11px/1.4 var(--sans);letter-spacing:.04em;color:var(--mute);margin:0 0 3px}
.rec-r dd{margin:0;font-size:12.5px;line-height:1.6;color:var(--fg);max-width:65ch}
.rec-ask dd{font-size:13px;font-weight:600}
.rec-num{font-variant-numeric:tabular-nums}
.rec-ul{margin:0;padding:0 0 0 1.1em}
.rec-ul li{padding:1px 0}
.rec-ul li::marker{color:var(--mute)}
.rec-src{margin:6px 0 0;padding-top:8px;border-top:1px solid var(--line);font-size:12px;color:var(--mute)}
.rec-src .mono{color:var(--fg-2)}
#det .rec + details.sec{border-top:1px solid var(--line);margin-top:12px}
.rec-none{margin:0 0 2px;font-size:12px;line-height:1.5;color:var(--mute)}
.listcard tbody tr.has-ask td{border-bottom:0;padding-bottom:3px}
.listcard tbody tr.ask td{padding:0 10px 10px;vertical-align:top}
.ask-l{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:1.5;color:var(--mute)}
.ask-k{font-weight:600;font-size:11px;letter-spacing:.04em;margin-right:8px;color:var(--fg-2)}
.listcard tbody tr.has-ask:not([aria-selected=true]):has(+ tr.ask:hover),
.listcard tbody tr.has-ask:not([aria-selected=true]):hover + tr.ask{background:var(--soft)}
.recp{padding-top:18px;padding-bottom:16px}
.recp .h2{margin:0 0 8px;font-weight:600}
.recp-f{margin:0}
.recp-r{display:grid;grid-template-columns:120px minmax(0,72ch);column-gap:24px;padding:10px 0;border-top:1px solid var(--line)}
.recp-r:first-child{border-top:0;padding-top:4px}
.recp-r dt{font:600 12px/1.6 var(--sans);letter-spacing:.04em;color:var(--mute);margin:0}
.recp-r dd{margin:0;font-size:13px;line-height:1.6;color:var(--fg)}
.recp-ask dd{font-size:14px;font-weight:600}
.recp-src{margin:6px 0 0;padding:10px 0 0 144px;border-top:1px solid var(--line);font-size:12px;color:var(--mute)}
.recp-src .mono{color:var(--fg-2)}
.recp-none{margin:0 0 14px;padding:0 4px;font-size:12.5px;line-height:1.5;color:var(--mute)}
@media(max-width:1100px){
  .recp-r{grid-template-columns:minmax(0,1fr);row-gap:3px}
  .recp-src{padding-left:0}
}
```

5. In `assets/station/i18n.js`, inside `STRINGS.en`, after the last `det.` key, add:

```js
            // rec — the completion record, scripts/record.js
            'rec.title': 'Completion record',
            'rec.ask': 'Asked',
            'rec.did': 'Done',
            'rec.why': 'Why this way',
            'rec.checked': 'Checked / not checked',
            'rec.cost': 'Cost',
            'rec.left': 'Left',
            'rec.alsoIn': 'Also in {f}',
            'rec.none': 'This task has no completion record.',
            'rec.noneYet': 'The completion record is written at land.',
```

6. Run `node --test tests/station-record.test.js tests/station-i18n.test.js tests/station-gate-tab.test.js` and watch them pass.

7. Commit: `feat: the station draws the task record`.

## Task 5: The pages that describe the record

**Files:**
- Modify: `docs/90-agent/reference/plain-language.md` — §完成紀錄 (`:31-33`); the page is 40 lines
- Modify: `docs/90-agent/reference/station.md:1-206` — `last_verified` and a paragraph closing §What each row holds (`:155`)
- Modify: `docs/README.md:20-60` — a question row for `docs/90-agent/records/`
- Test: `tests/record-docs.test.js`

**Interfaces:**
- Consumes: Task 1's bucket path `docs/90-agent/records` and CLI name; Task 4's block names `record`, `record-page`, `list-ask`
- Produces: none

**Dispatch:** implementer, sonnet — three short page edits held by one test.

1. Write the failing test, `tests/record-docs.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', ...rel.split('/')), 'utf8');

test('plain-language.md says every task writes the record at land, and a TODO entry links to it', () => {
    const t = read('docs/90-agent/reference/plain-language.md');
    assert.match(t, /record\.js write/);
    assert.match(t, /每個任務/);
    assert.match(t, /docs\/90-agent\/records\//);
});

test('station.md names the three record blocks', () => {
    const t = read('docs/90-agent/reference/station.md');
    for (const b of ['record', 'record-page', 'list-ask']) assert.match(t, new RegExp('`' + b + '`'));
});

test('README names the records folder', () => {
    assert.match(read('docs/README.md'), /90-agent\/records\//);
});
```

2. Run `node --test tests/record-docs.test.js` and watch it fail.

3. In `docs/90-agent/reference/plain-language.md`, replace §完成紀錄's body (`:31-33`) with:

```md
每個任務在 land 時寫一份完成紀錄，不管有沒有關 TODO。六欄：要求、做了什麼、為什麼這樣做、驗過・沒驗過、花費、還剩什麼。

- 用 `node scripts/record.js write --session <id>` 寫，從 stdin 讀前五欄。花費由程式從對話紀錄算，不由模型填。
- 少一欄、句子太長、或有裸代碼，它就拒絕，什麼都不寫。
- 寫成功後，紀錄存在任務登記裡給監控站讀，也加到 `docs/90-agent/records/<年-月>.md` 給 git 留存。
- 關掉的 TODO 底下的 `## 完成紀錄` 只寫一兩句這條做了什麼，再連到那份任務紀錄。
```

4. In `docs/90-agent/reference/station.md`, at the end of §What each row holds, before the next `##`, add:

```md
**完成紀錄.** A session that has been through land carries the six-field
record `scripts/record.js` filed. The detail opens with it (block `record`),
the session page shows it above its tabs (block `record-page`), and the list
puts its 要求 as a muted line under the row's title (block `list-ask`). A
session with no record shows one muted line instead: 「完成紀錄在 land 時寫。」
while it runs, 「這個任務沒有完成紀錄。」 once it has ended.
```

and move its `last_verified` to `2026-10-19`.

5. In `docs/README.md`, in the question table, after the row for `todo.md` (`:39`), add:

```md
| What a task did, why, what was checked and what it cost, after it landed | `docs/90-agent/records/<YYYY-MM>.md` — *one file a month, written by `record.js write` at land* |
```

6. Run `node --test tests/record-docs.test.js` and `node scripts/docs-check.js`.

7. Commit: `docs: the task record in plain-language, station and the index`.

## Coverage

| promise | task |
|---|---|
| Six fields, in this order and with these names: 要求、做了什麼、為什麼這樣做、驗過・沒驗過、花費、還剩什麼. | Task 1 |
| 做了什麼 is a list, one line per thing someone can now do that they could not; the other five are one to three sentences. | Task 1 (list), Task 2 (rule) |
| Written to plain-language.md: no sha, no TODO id, no `path:line`, no bare code name. `lib/plain.js`'s existing checks are the gate on it. | Task 1 |
| 花費 is filled by the script from the station's own figures for the session (money, wall time, agent count, models), not typed by the model. | Task 1 |
| `node scripts/record.js write --session <id>` reads the record on stdin and refuses (exit 1, nothing written) when a field is missing or empty | Task 1 |
| On success it writes the record onto the registry entry (`record: { at, fields }`) and appends it to `docs/90-agent/records/<YYYY-MM>.md` | Task 1 |
| A second write for the same session replaces the registry copy and appends a new dated section marked 更正 | Task 1 |
| `docs/90-agent/records/` is a new bucket in `.fankeel/docs.json`, `role: report`, `audience: human`, and a row in README's tree. | Task 1 (bucket), Task 5 (README: a question-table row, since README has no tree) |
| Land's output template becomes the six fields plus the `suite:` line | Task 2 |
| Land runs `record.js write` before its gate. The gate's option one description names the monthly file's anchor. | Task 2 |
| After the user answers 收工, the session's last message is the record as written, and nothing else is appended after it. | Task 2 |
| `lib/gatereport.js` reads the six land keys, so the station's 關卡 tab shows the record while land waits. | Task 2 (reader), Task 4 (tab) |
| A TODO entry closed at land gets `todo.js done ... --record "<one or two sentences>. 詳見 <monthly file>#<anchor>"`. | Task 2 |
| The session detail opens with a 完成紀錄 block holding the six fields, and under it the monthly file it is also in | Task 3 (data), Task 4 (block) |
| The session's full page (`#/s/<id>`) opens with the same block above its cost strip | Task 4 |
| A session with no record shows one muted line saying so, never an empty block. | Task 4 |
| Each landed row in the session list carries the record's 要求 as a muted second line under the title | Task 4 |
| `tests/record.test.js`: a record missing 為什麼這樣做 exits 1 and writes nothing | Task 1 |
| Land's template test: the rendered land block names the six fields and stays under the 2400 cap. | Task 2 |
| The artefact: for one session, the station's rendered 完成紀錄 block and the monthly file's section are compared field by field | Task 1 (same formula), Task 4 (same six strings); the comparison on a real landed session is verify's, since no session has a record before build |
| `docs/90-agent/reference/plain-language.md` §完成紀錄 (:31-33) says only tasks with a TODO entry write a record | Task 5 (plain-language, station.md), Task 2 (land skill) |
