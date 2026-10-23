---
status: current
---

# TODO Patrol 2026-10-23 Implementation Plan

**Goal:** build the entries survey marked `do now` that fit one plan — the wrap-up guard, the notification panel, the tune glow, the stopped-session clear, the gate expand-all and `survey.js --affected`.
**Architecture:** four independent strands, each in the module its entry already names, each task with its own test. No new dependency. The skeletons, the FK_TOUR split and the docs and settings pages (station-51, station-52, station-38, station-39) are not in this plan: with them, `assets/station/station.js` had six writers, `index.html` and `lib/station.js` three each, past the shared-file cap of two (`SHARED_CAP`, `lib/plantasks.js`); their drafts are kept for their own plan.
**Tech Stack:** Node built-ins only (`node:test`, `node:assert/strict`, `node:vm`, `node:child_process`); browser scripts in `assets/station/` are ES5.
**Spec:** [survey.md](../../../.fankeel/build/task-20261023T122952/survey.md)

The user's survey-gate answers, which this plan argues from alongside the spec:

- station-48: block the next-step box's decision with a hook, with tests. The hook refuses (`deny`) rather than `permissionDecision: "ask"` — see Task 1.
- station-50: read notifications turn grey and stay; a taken tune request gets `tune.js drop` and expires after 24 hours.
- station-49: Tailscale plus at least two others; researched in [2026-10-23-station-remote-options.md](../reports/2026-10-23-station-remote-options.md) (Cloudflare Tunnel + Access, NetBird). Which two to build is asked at this plan's gate; no task builds it yet.
- gate page: every option's description starts expanded (全部展開).
- the "May have stopped" capsule gets a quick view and a clear, reusing #/live's clear path.

## Global Constraints

- From `.fankeel/map.md` (`node scripts/map.js`): 1192 markdown files, 3 planned-not-built, 358 retired, 57 undeclared. Plans live in `docs/90-agent/plans/` (role `plan`), references in `docs/90-agent/reference/` (role `reference`, must match the code), reports in `docs/90-agent/reports/` (role `report`).
- 4-space indentation in `lib/`, `scripts/`, `hooks/`, `assets/` and most tests — match the file being edited. `'use strict';` heads every Node file.
- Browser scripts in `assets/station/` are ES5: `var`, `function`, no arrow functions, no `let`/`const`, no template literals.
- A file over `READ_CAP` lines (1500, `lib/plantasks.js:353`) is edited as `path:a-b`; at most three `Modify:` entries a task (`FILE_CAP`, 3).
- Node built-ins only; no dependency may be added. An implementer runs only its own test file; the parent runs `node scripts/suite.js --fast` before committing a group.
- Commit messages are `type(scope): subject` with the types `chore|docs|feat|fix|merge|test`.
- Each strand's own exact values follow under its letter, copied from the planner that read that code.

### wrap-up guard

- `tests/inventory.test.js:72-100` — every `hooks/*.js` file must be referenced from `.claude-plugin/plugin.json` and vice versa; `hooks/hooks.json` holds `modules` only.
- `tests/contract.test.js:303-304` and `:322-340` — `WORDS` ends at `'fifteen'`; the test asserts `docs/01-guide/development.md` says `all <total> hooks` and `The other <others> are not load-bearing`, and `tests/hook.test.js` says `all <total> hooks`. `BLOCKING` = `UserPromptSubmit`, `PreToolUse`, so a new PreToolUse hook raises only the total (15 -> 16, others stay `eight`).
- `docs/01-guide/development.md:149` says `all fifteen` (then a line break before `hooks`); `:155` says `The other eight are not load-bearing`; `tests/hook.test.js:3` says `all fifteen hooks`.
- `tests/away-docs.test.js:22` — `docs/02-architecture/layout.md` must still match `/Seven are not rowed below/` (this plan moves it to `Eight`) and `/relay-cap\.js \(PreToolUse on SendMessage/` (must stay).
- `lib/hook.js:55-61` — `refuse(reason)` prints `{ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason } }`; every hook exits 0 (`run` swallows throws).
- `hooks/relay-cap.js:36-42` and `tests/relay-cap.test.js:17-48` — the shape to copy: `registry.rootFor(payload)`, `registry.readSession(root, payload.session_id)`, `mine.active !== true` returns silently; tests spawn the hook with `CLAUDE_PROJECT_DIR` and `CLAUDE_CONFIG_DIR` set; 2-space indentation in that test file, 4-space in `hooks/`.
- `.claude-plugin/plugin.json:190-201` — the `relay-cap.js` PreToolUse group (matcher, `timeout: 5`, `statusMessage`) is the shape of a new group.

### notifications and tune glow

- Browser scripts in `assets/station/` and `assets/tune/` are ES5: `var`, `function`, no arrows, no `let`/`const`, no template literals (CLAUDE.md; `assets/station/station.js` throughout). `Object.assign` is already used there (`assets/station/station.js:2440`).
- 4-space indentation in `lib/`, `scripts/`, `assets/` and the tests; `'use strict';` heads every Node file; no dependency may be added.
- `TAKEN_TTL_MS` = 24 * 60 * 60 * 1000 = 86400000 — the user's decision for station-50 (taken requests auto-expire after 24 hours). Expired means strictly older: `now - at > TAKEN_TTL_MS`.
- A `taken` row with no parseable `at` never expires (`Date.parse` NaN).
- `tune.js drop <id>` accepts `queued` or `taken` only; any other status, or an unknown id, goes through `die(msg)` (exit code 2, `scripts/tune.js:43-46`). It appends `{ id, status: 'dropped' }` through `append` (`scripts/tune.js:48-51`) and touches no page, no `before.html`, no snapshot. `done` stays the only settle path that checks an edit (`scripts/tune.js:365-380`).
- `/__live/queue` keeps its shape `{ pending, editing }` (`scripts/tune.js:129-137`); `pending` = queued + live taken, `editing` = live taken with `round` (`tests/tune.test.js:123,389,510,534` read it). `WAIT_TIMEOUT_SEC` = 3600 (`scripts/tune.js:31`), overlay poll = 2000 ms (`assets/tune/overlay.js:757`).
- `TUNE_ITEMS` = 50 (`lib/station.js:350`); a station item's `status` may now also be `expired` or `dropped` — `floatNotes` lists only `taken` (`assets/station/station.js:2482`), `tuneEvents` fires only queued/taken to done/rejected (`:2465`).
- `view.notes` keeps at most 20 settled notes (`assets/station/station.js:6758`, `.slice(0, 20)`); the dismissed-editing-id set keeps `GONE_KEEP` = 100 ids, under `localStorage` key `station.fkGone`.
- Existing assertions that must stay green: bell badge `<span class="fkn">2</span>` for one editing row plus one unread done note (`tests/station-float.test.js:47`), `<span class="fkn"><\/span>` with nothing (`:50`), aria-label `通知與 gate：1 件，1 個 gate 在等` (`:27`), `floatNotes` result order (`:57-58`), `CLICK_PAGE = 8` and the draw counts in `tests/station-hdl-g.test.js:15,269-382`.
- Plan-size caps: `READ_CAP` 1500 lines per `Modify:` range, `FILE_CAP` 3 `Modify:` entries per task (`lib/plantasks.js`).

### stopped sessions and gate page

- Browser scripts in `assets/station/` are ES5: `var`, `function`, no arrows, `let`, `const` (CLAUDE.md).
- 4-space indentation in `assets/` and the station tests; `'use strict';` heads every Node file.
- Every user-facing string in `station.js` goes through `loc(key, zh, vars)` with an English entry in `assets/station/i18n.js` (`tests/station-i18n.test.js`); this plan adds no new string (reuses `nav.capMaybe` at `i18n.js:289`, `nav.mayHaveStopped`, and the literal `clear` already in `clearControl`). Every string in `gate-frame.js` goes through its own `EN` table (`assets/station/gate-frame.js:12-22`); Task 9 adds none.
- `READ_CAP` 1500 lines per Modify file, `FILE_CAP` 3 Modify entries per task (`skills/fankeel-plan/SKILL.md`); `station.js` is named by range.
- `clearControl(s)` (`assets/station/station.js:4160`) posts `/clear` with hidden `root`, `id`, `nonce` and a `force` checkbox when `S.serve`, else prints a `task.js clear <id>` command; `clearStaleControl` (`:4142`) posts `/clear-stale`. Both are function declarations in the same IIFE as `liveMaybe`, so `liveMaybe` may call them.
- An implementer runs only its own test file(s); the parent runs `node scripts/suite.js --fast`.

### survey --affected

- Node built-ins only, no dependency may be added (`CONTRIBUTING.md`; `lib/requires.js:9-11`). `'use strict';` heads every Node file.
- 4-space indentation in `lib/` and `scripts/`; the test files named here use 2 spaces (`tests/requires.test.js`, `tests/map.test.js`, `tests/survey.test.js`) — match them.
- `READ_CAP = 1500` and `FILE_CAP = 3` (`lib/plantasks.js:353-354`): no `Modify:` file here is near 1500 lines (`scripts/survey.js` 558, `lib/map.js` 491, `lib/requires.js` 77).
- `MAX_PER_SECTION = 25` (`lib/report.js:17`); `section(title, rows, max)` returns `[]` for no rows (`lib/report.js:51-52`) and `plural(n, one, many)` returns `n + ' ' + word` (`lib/report.js:38`).
- `DEFAULT_MAX = 25` (`scripts/survey.js:35`), `MAX_OUTPUT_CHARS = 8000` (`scripts/survey.js:47`), `capOutput` applies unless `--all` (`scripts/survey.js:551`).
- `REQUIRE` and `IMPORT` at `lib/requires.js:22-23`; only a relative specifier is an edge; `requireGraph(root, files)` returns `{from, to, line}[]` with `line` 1-based.
- `MAX_PAGES = 30` (`lib/map.js:29`); `orientation(root)` is `lib/map.js:316-342` and returns `[]` when there are no edges; its caller pushes the `orientation:` heading at `lib/map.js:419-424`.
- `tests/skill-size.test.js:19`: `'fankeel-survey': 23700`; the skill is 23643 bytes.
- `docs/90-agent/reference/documents.md` is `status: current`, `source_of_truth` includes `lib/map.js` and `lib/requires.js` (`:4`); its orientation paragraph is `:103-111` and must match the code (456 lines).
- An implementer runs only its own test file; the parent runs `node scripts/suite.js --fast` before committing a group. Version bump and release are the caller's, after the group lands.

## Risks

- The `ask` field may not be the only carrier of a decision — Task 1 — `actions` (the buttons) without `ask` would slip past; the hook treats a non-empty `ask` string or a non-empty `actions` array as a decision, and the test pins both.
- `deny` vs `ask`: a `permissionDecision: "ask"` raises the host's tool-permission prompt, not the station gate or AskUserQuestion, so it would not reach the station at all — Task 1 — the hook uses `refuse()` (deny) with a reason naming AskUserQuestion, as `hooks/relay-cap.js` does; the test pins `deny`.
- A new hook file moves the hook count 15 -> 16 and three counters read it — Task 2 — `tests/contract.test.js` WORDS stops at `fifteen` (index 15), so `WORDS[16]` is `undefined` and the regexes silently become `all undefined hooks`; run `node --test tests/contract.test.js tests/hook.test.js tests/inventory.test.js` first and read which assertion fails.
- Between Task 1 and 2 `tests/contract.test.js` is red by design (the count test) — Tasks 1, 2 — the implementer of Task 1 runs only `tests/wrap-up.test.js`; the parent runs the fast suite after Task 2, not after A1.
- A new PreToolUse hook is load-bearing: a throw blocks the call — Task 1 — `run()` from `lib/hook.js` swallows every exception and the hook returns silently for no session / no active task, as `hooks/relay-cap.js:36-42` does.
- `docs/01-guide/what-runs.md` and `docs/02-architecture/layout.md` list each hook — Task 3 — no test pins what-runs.md, and `tests/away-docs.test.js:22` pins `Seven are not rowed below` plus the exact `relay-cap.js (PreToolUse on SendMessage` text, so the layout row must keep the second and the pin must move with the first: run `node --test tests/away-docs.test.js` first.
- The existing bell tests assert the bell redraws exactly once (`tests/station-hdl-g.test.js:269-274`) and stub `.nt` with only `getAttribute` (`:78`) — Task 6 — marking notes read must not redraw, and the × handler must decide "editing row or stored note" by looking the id up in `view.notes`, never by `classList`; run `node --test tests/station-hdl-g.test.js` first, unchanged, before editing.
- `tuneOf` is not exported today (`lib/station.js:1180`) — Task 5 — the test needs `tuneOf`, so the export is part of the task; check `grep -n "tuneOf" tests/` shows no test already stubbing a different shape.
- The `taken` line's `at` is the take time only because `queueState` lets a later line's fields override the first's (`lib/tune.js:114`) and `append` stamps every line with `at` (`scripts/tune.js:50`) — Tasks 4, 5 — a taken row whose `at` does not parse stays `taken` (never expires); the test pins that.
- The page filter of Task 7 reads the browser's own `Referer` on `/__live/queue`; a page that sets `<meta name="referrer" content="no-referrer">` sends none — Task 7 — with no referer the filter is off and the old behaviour stands, so the worst case is today's glow, not a lost ring.
- The × on an Editing row hides it in the station panel only (id kept in `localStorage` `station.fkGone`); the request itself stays `taken` in `queue.jsonl` until `tune.js drop <id>` or the 24-hour expiry — Task 6 — this is the "panel dismiss, queue untouched" reading of the user's "add an ×"; the block's page glow is ended by Task 4, not by the ×.
- The new test in Task 6 copies the vm harness of `tests/station-hdl-g.test.js:21-65` — Task 6 — if the copy boots but `listeners.click` has no handler containing `data-note-x`, stop and re-read that harness rather than changing the product code.
- The "home page" capsule is on `#/live` (the 進行中 view, `nowHtml`, `assets/station/station.js:1888-1891`), not on `#/` (the four-card home, which has no "may have stopped" capsule) — Task 8 — the task first re-reads `station.js:1856-1866` and `:1888-1891` and edits only `nowHtml`/`liveMaybe`; if the user meant `#/`, that is a new card and a new task.
- `tests/station-live-head.test.js:30` matches `<span>可能已經停了<b>2</b></span>` exactly; wrapping the capsule in a link changes that markup — Task 8 — the task edits that one regex (the file is in its Test list) and runs both files.
- `liveLane` returns an `<a>`; a `<form>` inside an `<a>` is invalid and clicks navigate — Task 8 — the clear control goes in a sibling `div.lv-row-clear` next to the lane, never inside it.
- The existing server route `POST /clear` (`scripts/station.js`, tested in `tests/station-post.test.js`) is what `clearControl` posts to; no server change is made — Task 8 — it greps `scripts/station.js` for `'/clear'` before writing.
- `clearControl` returns `''` for a row whose `state` is not `stale` (a `live` row with `unknown` has no process proof and is not clearable) — Task 8 — those rows show an empty `lv-row-clear` (hidden by CSS), by design.
- Existing gate tests assume descriptions start hidden (`tests/station-gate-frame.test.js:41-62`, `:124-135`) — Task 9 — the task rewrites those assertions in the same file, and runs `station-gate-route`, `station-gate-send`, `station-gate-send-render` and `station-gate-tab` too, since they draw the frame.
- The fold state lives in memory only (`STATE` in `gate-frame.js`), so nothing saved as `true` survives a reload — Task 9 — the toggle treats absent and `true` alike as open.
- `docs/90-agent/reference/station.md:867` and `:1241` describe the 可能已經停了 block; Task 8 does not edit them (file cap) — unresolved, left for verify's doc check.
- The TODO's counts (15 non-test files, 18 direct tests) are from 2026-10-22 and have drifted — measured 2026-10-23 over `requireGraph`: 17 non-test edges and 64 test edges into `lib/stages.js` — Task 11 — its real-repo test asserts `lib/profile.js:209` is listed and tests >= 18 distinct files, never the old totals.
- A section capped at 25 rows (`lib/report.js:17`) would cut `lib/stages.js`'s test list, which is the done condition — Task 11 — the affected report passes `Infinity` unless `--max` is given, and groups one row per file (`lib/profile.js:209,234,334`); the 8000-char ceiling (`scripts/survey.js:47`) still bounds it.
- `parseArgs` skips every unknown `--` flag (`scripts/survey.js:541`), so `--affected <file>` would leave `<file>` as a search term — Task 11 — the flag consumes its value like `--root` (`:512`), and a test pins that the value is not a term.
- `skills/fankeel-survey/SKILL.md` is 23643 bytes against a cap of 23700 (`tests/skill-size.test.js:19`), 57 bytes of room — Task 11 — the flag line is about 100 bytes, so the cap rises to 23800 in the same task (the file's own comment, `:8-12`, says raising it is a decision made there).
- The new `import()` pattern could match prose in a comment — Task 10 — `lib/board.js:5` says "dynamic import()" with nothing quoted inside, and the pattern needs a quoted relative specifier, so it does not match; the test pins board.js's four real edges.
- A cycle section on a repository with no cycles must still answer — Task 12 — it prints `import cycles: none` rather than leaving the heading out, and `tests/map.test.js:402-416` (pinning `most required:` and `directories:`) must stay green because both sections are appended after them.
- Task 11 and 12 read `lib/requires.js`, which Task 10 modifies — they run after Task 10 (Consumes), and Task 11 and Task 12 touch disjoint files so they can go out together.

## Task 1: A wrap-up box that asks a decision is refused during a task (station-48)

**Files:**
- Modify: `hooks/wrap-up.js` — new PreToolUse hook on `mcp__ccd_turn__wrap_up`: with an active task, a call that carries an `ask` or `actions` is refused with a reason naming AskUserQuestion
- Modify: `.claude-plugin/plugin.json:190-201` — register it as a PreToolUse group after the `relay-cap.js` group
- Test: `tests/wrap-up.test.js`
- Read: `hooks/relay-cap.js` — the hook this one copies in shape
- Read: `lib/hook.js` — `run`, `parse`, `refuse`

**Interfaces:**
- Consumes: `run`, `parse`, `refuse` from `lib/hook.js`; `registry.rootFor(payload)`, `registry.readSession(root, sessionId)` from `lib/registry.js`
- Produces: the hook file `hooks/wrap-up.js` (no exports); a PreToolUse deny whose reason opens `fankeel: the next-step box`

**Dispatch:** implementer, sonnet — the code is below; transcription plus tests.

Decision recorded for the entry: the call is refused (`deny`), not turned into `permissionDecision: "ask"`, because `"ask"` raises the host's tool-permission prompt, which neither the station gate nor the sidebar treats as a question to the user; a refusal sends the session to AskUserQuestion, which the gate hook sees. A recap-only call (no `ask`, no `actions`) passes, so the box keeps its closing job.

Steps:

1. Write the failing test, `tests/wrap-up.test.js`:

```js
'use strict';

// station-48: the desktop app's next-step box (mcp__ccd_turn__wrap_up with
// ask/actions) puts a decision to the user that the station gate never sees.
// hooks/wrap-up.js refuses such a call while a fankeel task is active and
// points at AskUserQuestion; a recap alone passes.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');

const ROOT = path.join(__dirname, '..');
const HOOK = path.join(ROOT, 'hooks', 'wrap-up.js');
const SESSION = 'aaaaaaaa-0000-4000-8000-0000000000e5';
const TOOL = 'mcp__ccd_turn__wrap_up';

function project(active) {
  const root = tmp('fankeel-wrap-up-');
  fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
  fs.writeFileSync(path.join(root, '.fankeel', 'sessions', SESSION + '.json'), JSON.stringify({
    task: 't', claims: [], stage: 'design', active, started: '2026-10-23T00:00:00.000Z', updated: new Date().toISOString(),
  }));
  return root;
}

function call(root, input) {
  return execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify({ session_id: SESSION, cwd: root, hook_event_name: 'PreToolUse', tool_name: TOOL, tool_input: input }),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root, CLAUDE_CONFIG_DIR: tmp('fankeel-cfg-') }),
  });
}

test('a wrap_up carrying an ask is denied, and the reason names AskUserQuestion', () => {
  const out = JSON.parse(call(project(true), { recap: 'done', ask: 'Which fix first?', actions: [{ label: 'Fix 1' }] }));
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /^fankeel: the next-step box/);
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /AskUserQuestion/);
});

test('buttons without an ask are a decision too', () => {
  const out = JSON.parse(call(project(true), { recap: 'done', actions: [{ action: 'commit' }] }));
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
});

test('a recap alone, an empty ask, and an empty actions list pass', () => {
  assert.equal(call(project(true), { recap: 'done, nothing pending' }), '');
  assert.equal(call(project(true), { recap: 'done', ask: '   ', actions: [] }), '');
});

test('a session with no active task is left alone', () => {
  assert.equal(call(project(false), { recap: 'done', ask: 'Which fix first?', actions: [{ label: 'Fix 1' }] }), '');
});

test('the manifest runs wrap-up.js on PreToolUse for mcp__ccd_turn__wrap_up', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));
  const group = manifest.hooks.PreToolUse.find((g) => g.hooks.some((h) => h.command.includes('hooks/wrap-up.js')));
  assert.ok(group, 'wrap-up.js is not registered on PreToolUse');
  assert.equal(group.matcher, 'mcp__ccd_turn__wrap_up');
});
```

2. Run `node --test tests/wrap-up.test.js` and watch it fail (no hook file).
3. Create `hooks/wrap-up.js`:

```js
#!/usr/bin/env node
'use strict';

// PreToolUse on the desktop app's next-step box, mcp__ccd_turn__wrap_up.
// Its `ask` and `actions` put a decision to the user inside the app's own
// card, which the station gate never sees and which does not mark the session
// as waiting (docs/90-agent/todo/station-48.md). While a fankeel task is
// active a call that carries either is refused, and AskUserQuestion — the tool
// hooks/gate.js watches — is asked for instead. A recap alone passes: the box
// keeps its job of closing a turn.
//
// "ask" as a permissionDecision would raise the host's tool-permission prompt,
// which is neither the station gate nor a question; a refusal is what sends
// the session to the right tool.
//
// Same rules as every hook here: exit 0 on every path, and nothing at all for
// a session that owns no active task.

const registry = require('../lib/registry.js');
const { run, parse, refuse } = require('../lib/hook.js');

function asksDecision(input) {
    if (!input || typeof input !== 'object') return false;
    if (typeof input.ask === 'string' && input.ask.trim() !== '') return true;
    return Array.isArray(input.actions) && input.actions.length > 0;
}

function main(raw) {
    const payload = parse(raw);
    if (!payload) return;
    const root = registry.rootFor(payload);
    const mine = registry.readSession(root, payload.session_id);
    if (!mine || mine.active !== true) return;
    if (!asksDecision(payload.tool_input)) return;
    refuse('fankeel: the next-step box is for a recap, not a decision — its ask and buttons never reach the station gate, and the sidebar does not show the session as waiting. '
        + 'Put the question to the user with AskUserQuestion, and call wrap_up again with the recap alone.');
}

run(main);
```

4. In `.claude-plugin/plugin.json`, directly after the group that ends with `"statusMessage": "Measuring the message..."` (the `relay-cap.js` group, closing `},` at about line 201), add:

```json
      {
        "matcher": "mcp__ccd_turn__wrap_up",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/wrap-up.js\"",
            "timeout": 5,
            "statusMessage": "Checking the next-step box for a decision..."
          }
        ]
      },
```

5. Run `node --test tests/wrap-up.test.js tests/inventory.test.js tests/relay-cap.test.js` and watch them pass. (The `tests/contract.test.js` and `tests/hook.test.js` counts are Task 2's; do not run them here.)
6. Commit: `feat: the next-step box may not carry a decision during a task (station-48)`.

## Task 2: The hook count says sixteen (station-48)

**Files:**
- Modify: `tests/contract.test.js:303-304` — `WORDS` gains `'sixteen'`
- Modify: `tests/hook.test.js:3` — `all fifteen hooks` becomes `all sixteen hooks`
- Modify: `docs/01-guide/development.md:149-155` — `all fifteen` becomes `all sixteen`

**Interfaces:**
- Consumes: Task 1's `hooks/wrap-up.js` and its registration (the count the three files recount)
- Produces: none

**Dispatch:** implementer, sonnet — three count edits; the failing test is the existing contract test.

Steps:

1. Run `node --test tests/contract.test.js` and watch the hook-count test fail (16 hooks, `fifteen` written).
2. In `tests/contract.test.js`, in the first `WORDS` array (line 303), extend the list through sixteen:

```js
  const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven',
    'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen'];
```

   (the second `WORDS` at line 361 is the page count and stays as it is).
3. In `tests/hook.test.js`, change line 3 from `// What all fifteen hooks do before they do anything of their own. The hooks` to `// What all sixteen hooks do before they do anything of their own. The hooks`.
4. In `docs/01-guide/development.md`, at line 149, change `and all fifteen` to `and all sixteen`. Leave `The other eight` at line 155: the new hook is on PreToolUse, which is load-bearing.
5. Run `node --test tests/contract.test.js tests/hook.test.js tests/inventory.test.js` and watch them pass.
6. Commit: `docs: sixteen hooks, counted where it is written (station-48)`.

## Task 3: The hook pages row the new hook (station-48)

**Files:**
- Modify: `docs/02-architecture/layout.md:29` — the `hooks/` row names wrap-up.js among the unrowed hooks and the count word becomes `Eight`
- Modify: `docs/01-guide/what-runs.md:22-32` — a `wrap-up.js` row in the 編輯與派工 table
- Modify: `tests/away-docs.test.js:22` — the `Seven are not rowed below` pin follows the new word

**Interfaces:**
- Consumes: Task 1's `hooks/wrap-up.js`
- Produces: none

**Dispatch:** implementer, sonnet — two prose rows and one pin; no logic.

Steps:

1. Run `node --test tests/away-docs.test.js` and note it passes (the pin to move).
2. In `tests/away-docs.test.js`, replace the line `assert.match(readme, /Seven are not rowed below/);` with:

```js
  assert.match(readme, /Eight are not rowed below/);
  assert.match(readme, /wrap-up\.js \(PreToolUse on mcp__ccd_turn__wrap_up/);
```

3. Run `node --test tests/away-docs.test.js` and watch it fail.
4. In `docs/02-architecture/layout.md`, in the `hooks/` row (line 29), change `Seven are not rowed below:` to `Eight are not rowed below:`. The row's list ends `... stop.js (...) and relay-cap.js (...)`: change the ` and ` before `relay-cap.js` to `, `, and after the closing parenthesis of the `relay-cap.js` entry append:

```md
 and wrap-up.js (PreToolUse on mcp__ccd_turn__wrap_up: while a task is active, a call carrying an ask or buttons is refused and AskUserQuestion asked for instead)
```

   Leave the `relay-cap.js (PreToolUse on SendMessage` text untouched.
5. In `docs/01-guide/what-runs.md`, after the `relay-cap.js` row of the 編輯與派工 table (the last row before `## session 開始與結束`), add:

```md
| `wrap-up.js` | 桌面 app 的下一步框（`mcp__ccd_turn__wrap_up`）呼叫前 | 只在這個 session 有進行中的 task 時作用：帶 `ask` 或 `actions` 的呼叫被擋下，改要求用 AskUserQuestion 問，因為下一步框的決定 station gate 看不到；只有回顧的呼叫照常放行 |
```

6. Run `node --test tests/away-docs.test.js` and watch it pass.
7. Commit: `docs: layout and what-runs row the wrap-up hook (station-48)`.

## Task 4: A taken tune request expires after 24 hours, and `tune.js drop` settles one (station-50, tune-7)

**Files:**
- Modify: `lib/tune.js` — `TAKEN_TTL_MS` and `statusOf(row, now)`
- Modify: `scripts/tune.js:1-470` — the require line, `/__live/queue`, a `drop` command, usage and header comment
- Test: `tests/tune-drop.test.js`

**Interfaces:**
- Consumes: `queueState(text)` from `lib/tune.js`
- Produces: `TAKEN_TTL_MS` (number) and `statusOf(row, now)` → the row's status, or `'expired'` for a `taken` row whose `at` is more than `TAKEN_TTL_MS` before `now`; `node scripts/tune.js drop <id>`

**Dispatch:** implementer, sonnet — the code is below; transcription plus tests.

Steps:

1. Write the failing tests. Create `tests/tune-drop.test.js`:

```js
'use strict';
// A request `wait` handed out and nobody settled expires after 24 hours, and
// `tune.js drop <id>` settles one by hand (station-50, tune-7).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn, spawnSync } = require('node:child_process');
const { statusOf, TAKEN_TTL_MS } = require('../lib/tune.js');
const tmp = require('./tmp.js');

const CLI = path.join(__dirname, '..', 'scripts', 'tune.js');
const H = 60 * 60 * 1000;
const NOW = Date.parse('2026-10-23T12:00:00.000Z');
const line = (id, status, ms, extra) => Object.assign({ id, status, at: new Date(ms).toISOString() }, extra || {});

function project() {
    const cwd = tmp('fankeel-tune-drop-');
    fs.mkdirSync(path.join(cwd, 'site'));
    fs.writeFileSync(path.join(cwd, 'site', 'page.html'), '<main data-block="a"></main>');
    return cwd;
}
function writeQueue(cwd, rows) {
    const dir = path.join(cwd, '.fankeel', 'build', 'tune');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'queue.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
}
function readQueue(cwd) {
    return fs.readFileSync(path.join(cwd, '.fankeel', 'build', 'tune', 'queue.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
}
function startServer(t, cwd) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [CLI, 'serve', 'site', '--port', '0'], { cwd });
        t.after(() => child.kill());
        let out = '';
        child.stdout.on('data', (d) => { out += d; if (out.includes('\n')) resolve(out.trim()); });
        child.on('exit', (code) => reject(new Error('tune serve exited ' + code)));
    });
}
function getJson(url) {
    return new Promise((resolve, reject) => {
        http.get(url, { agent: false }, (res) => {
            let text = '';
            res.on('data', (d) => { text += d; });
            res.on('end', () => resolve(JSON.parse(text)));
        }).on('error', reject);
    });
}

test('statusOf: a taken row expires after 24 hours exactly, nothing else does', () => {
    assert.equal(TAKEN_TTL_MS, 86400000);
    assert.equal(statusOf({ status: 'taken', at: new Date(NOW - TAKEN_TTL_MS).toISOString() }, NOW), 'taken');
    assert.equal(statusOf({ status: 'taken', at: new Date(NOW - TAKEN_TTL_MS - 1).toISOString() }, NOW), 'expired');
    assert.equal(statusOf({ status: 'taken' }, NOW), 'taken');
    assert.equal(statusOf({ status: 'taken', at: 'not a date' }, NOW), 'taken');
    assert.equal(statusOf({ status: 'queued', at: new Date(NOW - 99 * H).toISOString() }, NOW), 'queued');
    assert.equal(statusOf({ status: 'done', at: new Date(NOW - 99 * H).toISOString() }, NOW), 'done');
});

test('drop settles a queued or taken request as dropped and nothing else', () => {
    const cwd = project();
    writeQueue(cwd, [
        line('r-0001', 'queued', NOW - 3 * H, { block: 'a', page: 'page.html' }),
        line('r-0002', 'queued', NOW - 3 * H, { block: 'a', page: 'page.html' }), line('r-0002', 'taken', NOW - 2 * H),
        line('r-0003', 'queued', NOW - 3 * H, { block: 'a', page: 'page.html' }), line('r-0003', 'done', NOW - 1 * H),
    ]);
    const run = (...args) => spawnSync(process.execPath, [CLI].concat(args), { cwd, encoding: 'utf8' });
    const taken = run('drop', 'r-0002');
    assert.equal(taken.status, 0, taken.stderr);
    assert.match(taken.stdout, /r-0002 dropped/);
    assert.equal(readQueue(cwd).pop().status, 'dropped');
    assert.equal(run('drop', 'r-0001').status, 0);
    const done = run('drop', 'r-0003');
    assert.equal(done.status, 2);
    assert.match(done.stderr, /r-0003 is done, nothing to drop/);
    const missing = run('drop', 'r-9999');
    assert.equal(missing.status, 2);
    assert.match(missing.stderr, /no request r-9999/);
    assert.match(run('drop').stderr, /usage:.*drop <id>/);
    assert.equal(fs.readFileSync(path.join(cwd, 'site', 'page.html'), 'utf8'), '<main data-block="a"></main>');
});

test('/__live/queue leaves an expired taken request out of pending and editing, and a drop out of both', async (t) => {
    const cwd = project();
    const base = await startServer(t, cwd);
    const now = Date.now();
    writeQueue(cwd, [
        line('r-0001', 'queued', now - 30 * H, { block: 'old', page: 'page.html' }), line('r-0001', 'taken', now - 25 * H),
        line('r-0002', 'queued', now - 2 * H, { block: 'fresh', page: 'page.html' }), line('r-0002', 'taken', now - 1 * H),
        line('r-0003', 'queued', now - 1 * H, { block: 'next', page: 'page.html' }),
    ]);
    const first = await getJson(base + '__live/queue');
    assert.equal(first.pending, 2);
    assert.deepEqual(first.editing.map((e) => [e.id, e.block, e.round]), [['r-0002', 'fresh', 1]]);
    assert.equal(spawnSync(process.execPath, [CLI, 'drop', 'r-0003'], { cwd }).status, 0);
    assert.equal((await getJson(base + '__live/queue')).pending, 1);
    assert.equal(spawnSync(process.execPath, [CLI, 'drop', 'r-0001'], { cwd }).status, 0, 'an expired taken row can still be dropped');
    assert.equal(spawnSync(process.execPath, [CLI, 'drop', 'r-0002'], { cwd }).status, 0);
    assert.deepEqual(await getJson(base + '__live/queue'), { pending: 0, editing: [] });
});
```

2. Run `node --test tests/tune-drop.test.js` and watch all three fail (`statusOf` is not a function; unknown command).
3. In `lib/tune.js`, directly under `queueState`'s closing brace (line 117), add:

```js
// A request `wait` hands out stays `taken` until `done` or `drop` settles it;
// one nobody settled for a day is stale — the session that took it is gone —
// and stops counting as in progress (station-50, tune-7). The taken line's own
// `at` is the take time, because a later line's fields win in `queueState`. A
// row whose `at` does not parse is kept, never expired.
const TAKEN_TTL_MS = 24 * 60 * 60 * 1000;
function statusOf(row, now) {
    if (!row || row.status !== 'taken') return row ? row.status : undefined;
    const at = Date.parse(row.at);
    return Number.isFinite(at) && now - at > TAKEN_TTL_MS ? 'expired' : 'taken';
}
```

and change the export (line 175) to `module.exports = { inject, outside, diffLines, queueState, sourcesOf, changedPaths, rankSources, TAKEN_TTL_MS, statusOf };`.
4. In `scripts/tune.js`, change line 25 to:

```js
const { inject, outside, diffLines, queueState, changedPaths, rankSources, statusOf } = require('../lib/tune.js');
```

5. In `scripts/tune.js`, replace lines 130-136 (from `const rows = requests();` through the `editing` mapping, ending before `return send(res, 200, TYPES['.json'], JSON.stringify({ pending, editing }));`) with:

```js
            // A taken request nobody settled for 24 hours is `expired` here
            // and counts as neither pending nor editing (lib/tune.js statusOf).
            const now = Date.now();
            const rows = requests().map((r) => Object.assign({}, r, { status: statusOf(r, now) }));
            const pending = rows.filter((r) => r.status === 'queued' || r.status === 'taken').length;
            // What `wait` has handed out and `done` has not settled, with how
            // many times that block has been asked for so far — the round.
            const editing = rows.filter((r) => r.status === 'taken')
                .map((r) => Object.assign({ id: r.id, block: r.block, round: rows.filter((x) => x.block === r.block && x.id <= r.id).length }, r.blocks ? { blocks: r.blocks } : {}));
```

6. In `scripts/tune.js`, directly under the closing brace of `done(id)` (the function ending `return settle(r, true, [], 'only ' + ...);\n}`), add:

```js
// Settles a request nobody will finish — a `taken` one whose session ended, a
// `queued` one the user no longer wants — without reading its snapshot or
// touching the page. `done` stays the only path that checks an edit.
function drop(id) {
    const r = requests().find((x) => x.id === id);
    if (!r) die('no request ' + id);
    if (r.status !== 'queued' && r.status !== 'taken') die(id + ' is ' + r.status + ', nothing to drop');
    append({ id: r.id, status: 'dropped' });
    process.stdout.write('tune: ' + r.id + ' dropped\n');
}
```

7. In `scripts/tune.js`, in `main()`, directly under `if (cmd === 'done' && arg) return done(arg);` add `if (cmd === 'drop' && arg) return drop(arg);`, and in the `die('usage: ...')` string change `| done <id>` to `| done <id> | drop <id>`. In the header comment, under the `done <id>` line (line 9), add:

```js
//   node scripts/tune.js drop <id>                     settle a request nobody will finish; the page is not touched
```

8. Run `node --test tests/tune-drop.test.js tests/tune.test.js` and watch both pass.
9. Commit: `feat: a taken tune request expires after 24 hours; tune.js drop settles one (station-50, tune-7)`.

## Task 5: The station stops listing an expired or dropped taken request (station-50)

**Files:**
- Modify: `lib/station.js:32-1180` — the `require('./tune.js')` line, and `tuneOf` reads each row through `statusOf`; `tuneOf` is exported
- Test: `tests/station-tune-expiry.test.js`

**Interfaces:**
- Consumes: `statusOf(row, now)` from Task 4
- Produces: `tuneOf(dir, now)` — `now` optional, defaults to `Date.now()`; each item's `status` may be `expired` or `dropped`; `open` counts queued and live taken only

**Dispatch:** implementer, sonnet — the code is below; transcription plus tests.

Steps:

1. Write the failing test. Create `tests/station-tune-expiry.test.js`:

```js
'use strict';
// The station's view of a project's tune queue (station-50): a taken request
// older than 24 hours is `expired`, a dropped one is `dropped`, and neither
// counts as in progress, so the 編輯中 row for it no longer renders.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { tuneOf } = require('../lib/station.js');
const tmp = require('./tmp.js');

const H = 60 * 60 * 1000;
const NOW = Date.parse('2026-10-23T12:00:00.000Z');
const line = (id, status, ms, extra) => Object.assign({ id, status, at: new Date(ms).toISOString() }, extra || {});

function queue(rows) {
    const dir = tmp('fankeel-station-tune-');
    const state = path.join(dir, '.fankeel', 'build', 'tune');
    fs.mkdirSync(state, { recursive: true });
    fs.writeFileSync(path.join(state, 'queue.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
    return dir;
}

test('tuneOf: an expired taken request and a dropped one are not in progress', () => {
    const dir = queue([
        line('r-0001', 'queued', NOW - 30 * H, { block: 'old' }), line('r-0001', 'taken', NOW - 25 * H),
        line('r-0002', 'queued', NOW - 2 * H, { block: 'fresh' }), line('r-0002', 'taken', NOW - 1 * H),
        line('r-0003', 'queued', NOW - 3 * H, { block: 'gone' }), line('r-0003', 'taken', NOW - 2 * H), line('r-0003', 'dropped', NOW - 1 * H),
        line('r-0004', 'queued', NOW - 1 * H, { block: 'next' }),
        line('r-0005', 'queued', NOW - 5 * H, { block: 'fin' }), line('r-0005', 'done', NOW - 4 * H),
    ]);
    const t = tuneOf(dir, NOW);
    assert.deepEqual(t.items.map((x) => [x.id, x.status]), [['r-0001', 'expired'], ['r-0002', 'taken'], ['r-0003', 'dropped'], ['r-0004', 'queued'], ['r-0005', 'done']]);
    assert.equal(t.open, 2);
    assert.equal(t.done, 1);
});

test('tuneOf: a taken request with no readable time stays taken, and no queue is null', () => {
    const dir = queue([{ id: 'r-0001', status: 'queued', block: 'a' }, { id: 'r-0001', status: 'taken' }]);
    assert.equal(tuneOf(dir, NOW).items[0].status, 'taken');
    assert.equal(tuneOf(tmp('fankeel-station-tune-none-'), NOW), null);
});
```

2. Run `node --test tests/station-tune-expiry.test.js` and watch it fail (`tuneOf` is not a function).
3. In `lib/station.js`, change line 32 to:

```js
const { queueState, statusOf } = require('./tune.js');
```

4. In `lib/station.js`, change `function tuneOf(dir) {` (line 351) to `function tuneOf(dir, now) {`, and replace its line `const rows = queueState(text);` (line 359) with:

```js
    // A taken request nobody settled for 24 hours is `expired` (lib/tune.js
    // statusOf): listed, but not in progress, so no 編輯中 row is drawn for it.
    const clock = typeof now === 'number' ? now : Date.now();
    const rows = queueState(text).map((r) => Object.assign({}, r, { status: statusOf(r, clock) }));
```

5. In `lib/station.js`, add `tuneOf` to the `module.exports` object on line 1180 (beside `todoOf`).
6. Run `node --test tests/station-tune-expiry.test.js tests/station-tune.test.js tests/station-float.test.js` and watch them pass.
7. Commit: `fix: the station stops listing an expired or dropped tune request as editing (station-50)`.

## Task 6: Read notes stay grey, an Editing row has an ×, the bell counts unread only, and the page wires them (station-50)

**Files:**
- Modify: `assets/station/station.js:2478-2993` — `floatNotes`, `noteHtml`, `floatHtml`, five pure helpers, the export line
- Modify: `assets/station/station.js:5768-6113` — `drawFloat` passes `view.gone`; `view.gone` is loaded and saved; the bell, × and 清掉通知 branches use the helpers above
- Modify: `assets/station/station.css:1531-1543` — the grey look of a read note
- Test: `tests/station-float-read.test.js`
- Test: `tests/station-float-gone.test.js`

**Interfaces:**
- Consumes: none
- Produces: `floatNotes(sessions, notes, gone)` — `gone` optional `{ [id]: true }`, hides those editing rows; `noteHtml(n)` — `n.read` adds class `read`, an `edit` row now has its `data-note-x`; `floatHtml(sessions, notes, open, now, picked, permission, box, gone)`; `readAll(notes)` → copies with `read: true`; `dismissNote(notes, gone, id)` → `{ notes, gone }`; `clearNotes(sessions, notes, gone)` → `{ notes: [], gone }` with every editing id added; `goneParse(raw)` → `{ [id]: true }` (at most `GONE_KEEP` = 100, latest kept); `goneKeys(gone)` → array of at most 100 ids. All exported. `view.gone` (`{ [id]: true }`), `localStorage` key `station.fkGone` (JSON array of ids).

**Dispatch:** implementer, sonnet — the code is below; transcription plus tests, and the second test copies its harness from an existing test.

Steps:

1. Run `node --test tests/station-hdl-g.test.js` unchanged and note that it is green.

2. Write the failing tests. Create `tests/station-float-read.test.js`:

```js
'use strict';
// The bell panel (station-50): a read note turns grey and stays, only unread
// ones count on the bell, an Editing row can be dismissed, and the panel's
// bookkeeping is pure so it can be driven without a page.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

global.window = { STATION: { serve: true } };
const V = require('../assets/station/station.js');

const NOW = Date.UTC(2026, 9, 23, 1, 0, 0);
const editing = (id) => ({ id: 's-' + id, root: '/r', tune: { open: 1, done: 0, items: [{ id, block: 'b-' + id, status: 'taken' }] } });

test('an Editing row has a close button, and a read note carries the read class', () => {
    assert.match(V.noteHtml({ id: 'r-1', block: 'b', status: 'edit' }), /class="nt edit"[\s\S]*data-note-x/);
    assert.match(V.noteHtml({ id: 'r-2', block: 'b', status: 'done', read: true }), /class="nt done read"/);
    assert.doesNotMatch(V.noteHtml({ id: 'r-2', block: 'b', status: 'done' }), / read"/);
});

test('floatNotes leaves out an editing row the reader dismissed, and only that one', () => {
    const s = { tune: { items: [{ id: 'r-1', block: 'b1', status: 'taken' }, { id: 'r-2', block: 'b2', status: 'taken' }] } };
    assert.deepEqual(V.floatNotes([s], [], { 'r-1': true }), [{ id: 'r-2', block: 'b2', status: 'edit' }]);
    assert.equal(V.floatNotes([s], []).length, 2);
});

test('the bell counts unread notes and editing rows; a read note is still listed', () => {
    const notes = [{ id: 'a', block: 'x', status: 'done', read: true }, { id: 'b', block: 'y', status: 'rejected' }];
    const some = V.floatHtml([], notes, true, NOW, {}, 'denied');
    assert.match(some, /<span class="fkn">1<\/span>/);
    assert.match(some, /data-note="a"/);
    assert.match(some, /通知 <b>2<\/b>/);
    const all = V.floatHtml([], [notes[0]], true, NOW, {}, 'denied');
    assert.match(all, /<span class="fkn"><\/span>/);
    assert.match(all, /class="nt done read"/);
});

test('清掉通知 shows whenever there is any row, and a dismissed editing row is not drawn', () => {
    const s = editing('r-9');
    assert.match(V.floatHtml([s], [], true, NOW, {}, 'denied'), /data-note-clear/);
    const hidden = V.floatHtml([s], [], true, NOW, {}, 'denied', null, { 'r-9': true });
    assert.doesNotMatch(hidden, /data-note="r-9"/);
    assert.match(hidden, /沒有新通知/);
    assert.doesNotMatch(hidden, /data-note-clear/);
});

test('readAll, dismissNote, clearNotes and the stored id set', () => {
    const notes = [{ id: 'a', block: 'x', status: 'done' }, { id: 'b', block: 'y', status: 'rejected', read: true }];
    const read = V.readAll(notes);
    assert.deepEqual(read.map((n) => n.read), [true, true]);
    assert.equal(notes[0].read, undefined, 'readAll copied');
    assert.deepEqual(V.dismissNote(notes, {}, 'a'), { notes: [notes[1]], gone: {} });
    assert.deepEqual(V.dismissNote(notes, {}, 'r-7'), { notes, gone: { 'r-7': true } });
    const s = editing('r-8');
    assert.deepEqual(V.clearNotes([s], notes, { 'r-1': true }), { notes: [], gone: { 'r-1': true, 'r-8': true } });
    assert.deepEqual(V.goneParse('not json'), {});
    assert.deepEqual(V.goneParse(null), {});
    const ids = []; for (let i = 0; i < 105; i++) ids.push('id' + i);
    const parsed = V.goneParse(JSON.stringify(ids));
    assert.equal(Object.keys(parsed).length, 100);
    assert.ok(parsed.id104 && !parsed.id4);
    assert.deepEqual(V.goneKeys({ a: true, b: true }), ['a', 'b']);
});

test('station.css greys a read note', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.css'), 'utf8');
    assert.match(css, /\.nt\.read\{[^}]*opacity:/);
});
```

3. Run `node --test tests/station-float-read.test.js` and watch every test fail.
4. In `assets/station/station.js`, replace `floatNotes` (lines 2478-2486) with the version below, and add the helpers directly after it:

```js
    function floatNotes(sessions, notes, gone) {
        var editing = [];
        (sessions || []).forEach(function (s) {
            ((s.tune && s.tune.items) || []).forEach(function (it) {
                if (it.status === 'taken' && !(gone && gone[it.id])) editing.push({ id: it.id, block: it.block, status: 'edit' });
            });
        });
        return editing.concat(notes || []);
    }
    // The panel's bookkeeping, pure so a test can drive it (station-50). A note
    // is read once the reader has had the panel open; a read note stays,
    // greyed, and stops counting on the bell. `gone` holds the ids of editing
    // rows the reader dismissed with ×: those rows come off the sessions'
    // queues, not off `notes`, so they are remembered by id.
    var GONE_KEEP = 100;
    function readAll(notes) {
        return (notes || []).map(function (x) { return x.read ? x : Object.assign({}, x, { read: true }); });
    }
    function dismissNote(notes, gone, id) {
        var all = notes || [], kept = all.filter(function (x) { return x.id !== id; }), g = Object.assign({}, gone);
        if (kept.length === all.length) g[id] = true;
        return { notes: kept, gone: g };
    }
    function clearNotes(sessions, notes, gone) {
        var g = Object.assign({}, gone);
        floatNotes(sessions, [], gone).forEach(function (x) { g[x.id] = true; });
        return { notes: [], gone: g };
    }
    function goneKeys(gone) { return Object.keys(gone || {}).slice(-GONE_KEEP); }
    function goneParse(raw) {
        var a, out = {};
        try { a = JSON.parse(raw); } catch (e) { return out; }
        if (Array.isArray(a)) a.slice(-GONE_KEEP).forEach(function (id) { if (typeof id === 'string') out[id] = true; });
        return out;
    }
```

5. In `assets/station/station.js`, in `noteHtml`, replace the line that starts `return '<div class="nt ' + t[0] + '" data-note="'` with:

```js
        return '<div class="nt ' + t[0] + (n.read ? ' read' : '') + '" data-note="' + esc(n.id) + '"><span class="ti" aria-hidden="true">' + t[1] + '</span>'
```

and, in `assets/station/station.js`, the line `+ (n.status === 'edit' ? '' : '<button class="tx" ...>×</button>')` with:

```js
            + '<button class="tx" type="button" data-note-x aria-label="' + loc('tune.close', '關閉') + '">×</button>'
```

6. In `assets/station/station.js`, in `floatHtml`: change the signature to `function floatHtml(sessions, notes, open, now, picked, permission, box, gone) {`; change `var all = floatNotes(sessions, notes), n = held.length + all.length, tune = null, done = 0;` to:

```js
        var all = floatNotes(sessions, notes, gone), n = held.length + all.length, tune = null, done = 0;
        var lit = held.length + all.filter(function (x) { return !x.read; }).length;
```

replace the `(all.some(function (x) { return x.status !== 'edit'; }) ? '<button class="lk" ...` line's condition so it reads `+ (all.length ? '<button class="lk" type="button" data-note-clear>' + loc('tune.clearNotifications', '清掉通知') + '</button>' : '') + '</div>'`; and in the bell button replace `{ n: n })` after `'通知與 gate：{n} 件'` with `{ n: lit })`, and `(n ? n : '')` with `(lit ? lit : '')`.
7. In `assets/station/station.js`, in the `module.exports` block at line 2993, append to the `tuneOpen: ..., floatNotes: floatNotes, clock: gateClock,` line:

```js
            readAll: readAll, dismissNote: dismissNote, clearNotes: clearNotes, goneParse: goneParse, goneKeys: goneKeys,
```

8. In `assets/station/station.css`, directly under line 1543 (`.nt .tx:focus-visible{...}`), add:

```css
.nt.read{opacity:.55}
.nt.read .ti{background:var(--inset);color:var(--muted)}
.nt.read .tt{color:var(--muted)}
```

9. Run `node --test tests/station-float-read.test.js tests/station-float.test.js tests/station-tune.test.js tests/station-float-box.test.js` and watch them pass.
10. Write the failing tests. Create `tests/station-float-gone.test.js`:

```js
'use strict';
// The bell panel as the page drives it (station-50): the × on an Editing row,
// 清掉通知 over editing rows, what is kept in localStorage, and notes turning
// grey once the panel has been open. The harness is that of
// tests/station-hdl-g.test.js, pressed through the page's own click listener.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
const NOW = Date.parse('2026-10-01T12:00:00.000Z');
const KEY = 'station.fkGone';

function boot(kept) {
    const listeners = {}, els = {}, intervals = [], scripts = [], saved = Object.assign({}, kept);
    const el = (tag) => ({ tagName: String(tag || 'div').toUpperCase(), innerHTML: '', textContent: '', className: '', title: '',
        placeholder: '', attrs: {}, style: {}, hidden: false, parentNode: null,
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {}, focus() {} });
    const counted = (id) => {
        const o = el('div');
        let html = '';
        o.draws = 0;
        Object.defineProperty(o, 'innerHTML', { get: () => html, set: (v) => { html = v; o.draws++; } });
        els[id] = o;
        return o;
    };
    const fk = counted('fk');
    counted('page');
    const day = '2026-10-01';
    const sessions = (items) => [{ id: 'sid0', pkey: 'F:\\ws\\alpha', task: 'alpha one', state: 'live', updated: NOW - 1000, started: NOW - 60000, stage: 'build',
        tune: { done: 0, items },
        days: [{ day, model: 'claude-opus-4-1', usd: 3, tokens: { input: 10 } }, { day, model: 'claude-sonnet-4-5', usd: 2, tokens: { input: 5 } }] }];
    const station = (items) => ({ generatedAt: new Date(NOW).toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-24', serve: true,
        projects: [{ root: 'F:\\ws\\alpha', gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
        profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: sessions(items) });
    const win = { location: { hash: '#/days', protocol: 'http:' }, addEventListener() {}, scrollTo() {},
        setInterval: (fn) => { intervals.push(fn); return 1; }, setTimeout: () => 1, clearTimeout() {},
        navigator: { language: 'zh-TW' },
        localStorage: { getItem: (k) => (k in saved ? saved[k] : null), setItem: (k, v) => { saved[k] = String(v); }, removeItem: (k) => { delete saved[k]; } },
        Notification: { permission: 'denied', requestPermission() { return { then() {} }; } },
        STATION: station([{ id: 'n1', block: 'blk-one', status: 'taken' }, { id: 'n2', block: 'blk-two', status: 'taken' }]) };
    const doc = { hidden: false, documentElement: el('html'), body: el('body'), title: '', getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
        createElement: (t) => { const o = el(t); if (t === 'script') scripts.push(o); return o; }, querySelectorAll: () => [],
        querySelector: () => null, head: { appendChild() {} } };
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: () => new Promise(() => {}), module: { exports: {} } });
    const fn = (listeners.click || []).filter((f) => String(f).includes('data-note-x'))[0];
    assert.equal(typeof fn, 'function', 'a click listener holds the note close branch');
    const settle = () => {
        intervals[0]();
        win.STATION = station([{ id: 'n1', block: 'blk-one', status: 'done' }, { id: 'n2', block: 'blk-two', status: 'rejected' }]);
        scripts[scripts.length - 1].onload();
    };
    return { fn, saved, settle, fkHtml: () => fk.innerHTML };
}

const tgt = (answers) => ({ tagName: 'DIV', closest: (sel) => (sel in answers ? answers[sel] : null) });
const noteX = (id) => ({ closest: (s) => (s === '.nt' ? { getAttribute: (k) => (k === 'data-note' ? id : null) } : null) });
const press = (p, answers) => p.fn({ target: tgt(answers), preventDefault() {} });
const bell = (p) => press(p, { '[data-fkb]': {} });
const noteIds = (p) => (p.fkHtml().match(/data-note="[^"]*"/g) || []).map((x) => x.slice(11, -1)).join(',');

test('× on an Editing row takes it off the panel, keeps the other, and remembers the id', () => {
    const p = boot();
    bell(p);
    assert.equal(noteIds(p), 'n1,n2');
    press(p, { '[data-note-x]': noteX('n1') });
    assert.equal(noteIds(p), 'n2');
    assert.deepEqual(JSON.parse(p.saved[KEY]), ['n1']);
});

test('a dismissed Editing row stays dismissed after a reload', () => {
    const p = boot({ [KEY]: '["n1"]' });
    bell(p);
    assert.equal(noteIds(p), 'n2');
});

test('清掉通知 clears Editing rows as well and remembers every id', () => {
    const p = boot();
    bell(p);
    press(p, { '[data-note-clear]': {} });
    assert.equal(noteIds(p), '');
    assert.deepEqual(JSON.parse(p.saved[KEY]).sort(), ['n1', 'n2']);
});

test('notes turn grey once the panel has been open, and stop counting on the bell', () => {
    const p = boot();
    p.settle();
    bell(p);
    assert.match(p.fkHtml(), /<span class="fkn">2<\/span>/);
    assert.doesNotMatch(p.fkHtml(), /class="nt (done|rej) read"/);
    bell(p);
    assert.match(p.fkHtml(), /<span class="fkn"><\/span>/);
    assert.match(p.fkHtml(), /class="nt done read"/);
    assert.equal(noteIds(p), 'n1,n2');
});
```

11. Run `node --test tests/station-float-gone.test.js` and watch all four fail.
12. In `assets/station/station.js`, in `drawFloat` (line ~5773), change the `floatHtml(...)` call so it ends `..., view.fkBox, view.gone);`.
13. In `assets/station/station.js`, directly under `view.fkBox = fkFit(fkBoxParse(stored(FK_BOX_KEY)));` (line 5788), add:

```js
    // Editing rows the reader dismissed with × (station-50), kept across
    // reloads; the request itself is settled by `tune.js drop` or its 24-hour
    // expiry (lib/tune.js statusOf), not by this.
    var FK_GONE_KEY = 'station.fkGone';
    view.gone = goneParse(stored(FK_GONE_KEY));
    function goneSave() { store(FK_GONE_KEY, JSON.stringify(goneKeys(view.gone))); }
```

14. In `assets/station/station.js`, replace the bell, close-button and clear branches (lines 6105-6113, from `if (e.target.closest('[data-fkb]'))` through the `[data-note-clear]` line) with:

```js
        if (e.target.closest('[data-fkb]')) {
            // Opening the panel counts as reading what it shows: the draw lights
            // the unread, the marking after it greys them for the next draw; a
            // close marks what arrived while it was open. Neither redraws.
            var wasOpen = view.fkOpen;
            view.fkOpen = !wasOpen;
            if (wasOpen) view.notes = readAll(view.notes);
            drawFloat();
            if (!wasOpen) view.notes = readAll(view.notes);
            return;
        }
        var nx = e.target.closest('[data-note-x]');
        if (nx) {
            var gone = dismissNote(view.notes, view.gone, nx.closest('.nt').getAttribute('data-note'));
            view.notes = gone.notes;
            view.gone = gone.gone;
            goneSave();
            drawFloat();
            return;
        }
        if (e.target.closest('[data-note-clear]')) {
            var cleared = clearNotes(S.sessions, view.notes, view.gone);
            view.notes = cleared.notes;
            view.gone = cleared.gone;
            goneSave();
            drawFloat();
            return;
        }
```

15. Run `node --test tests/station-float-gone.test.js tests/station-hdl-g.test.js tests/station-float-read.test.js` and watch them pass
16. Commit: `feat: read bell notes turn grey and stay, an Editing row gets an ×, the bell panel marks notes read and drops Editing rows (station-50)`.


## Task 7: A block's glow shows only on the page its request was made on (tune-7)

**Files:**
- Modify: `lib/tune.js` — `pageKey(p)`
- Modify: `scripts/tune.js:25-137` — the require line and the `editing` filter in `/__live/queue`, as Task 4 left them
- Modify: `docs/90-agent/reference/station.md:1590-1605` — the "When a tuned block is done" section
- Test: `tests/tune-queue-page.test.js`

**Interfaces:**
- Consumes: `statusOf` and the `/__live/queue` handler of Task 4
- Produces: `pageKey(p)` → the page path with query and hash cut, leading `/` removed, and `index.html` appended to `''` or a trailing `/`; `/__live/queue` leaves out of `editing` a request whose `page` is a different page than the request's `Referer` (no referer or no `page`: kept)

**Dispatch:** implementer, sonnet — the code is below; transcription plus tests.

Steps:

1. Write the failing tests. Create `tests/tune-queue-page.test.js`:

```js
'use strict';
// A tuned block glows only on the page its request came from (tune-7): the
// overlay's fetch carries the page as its Referer, and `editing` is cut to it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { pageKey } = require('../lib/tune.js');
const tmp = require('./tmp.js');

const CLI = path.join(__dirname, '..', 'scripts', 'tune.js');

function startServer(t, cwd) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [CLI, 'serve', 'site', '--port', '0'], { cwd });
        t.after(() => child.kill());
        let out = '';
        child.stdout.on('data', (d) => { out += d; if (out.includes('\n')) resolve(out.trim()); });
        child.on('exit', (code) => reject(new Error('tune serve exited ' + code)));
    });
}
function getJson(url, headers) {
    return new Promise((resolve, reject) => {
        http.get(url, { agent: false, headers: headers || {} }, (res) => {
            let text = '';
            res.on('data', (d) => { text += d; });
            res.on('end', () => resolve(JSON.parse(text)));
        }).on('error', reject);
    });
}

test('pageKey: the same page from a request path and from a recorded path', () => {
    assert.equal(pageKey('/page.html'), 'page.html');
    assert.equal(pageKey('page.html'), 'page.html');
    assert.equal(pageKey('/page.html?x=1#top'), 'page.html');
    assert.equal(pageKey('/'), 'index.html');
    assert.equal(pageKey('/docs/'), 'docs/index.html');
    assert.equal(pageKey(''), 'index.html');
    assert.equal(pageKey('/a%20b.html'), 'a b.html');
});

test('/__live/queue shows the ring only for the page that asked, and every ring with no referer', async (t) => {
    const cwd = tmp('fankeel-tune-page-');
    fs.mkdirSync(path.join(cwd, 'site'));
    const base = await startServer(t, cwd);
    const at = new Date().toISOString();
    const rows = [
        { id: 'r-0001', status: 'queued', page: 'a.html', block: 'mast', at }, { id: 'r-0001', status: 'taken', at },
        { id: 'r-0002', status: 'queued', page: 'b.html', block: 'mast', at }, { id: 'r-0002', status: 'taken', at },
        { id: 'r-0003', status: 'queued', block: 'nopage', at }, { id: 'r-0003', status: 'taken', at },
    ];
    fs.writeFileSync(path.join(cwd, '.fankeel', 'build', 'tune', 'queue.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
    const ids = (q) => q.editing.map((e) => e.id).join(',');
    const onA = await getJson(base + '__live/queue', { referer: base + 'a.html' });
    assert.equal(ids(onA), 'r-0001,r-0003');
    assert.equal(onA.pending, 3, 'the queue count is the whole server, not one page');
    assert.equal(ids(await getJson(base + '__live/queue', { referer: base + 'b.html?x=1' })), 'r-0002,r-0003');
    assert.equal(ids(await getJson(base + '__live/queue')), 'r-0001,r-0002,r-0003');
});
```

2. Run `node --test tests/tune-queue-page.test.js` and watch it fail (`pageKey` is not a function).
3. In `lib/tune.js`, directly under `statusOf`, add:

```js
// A page as one comparable string: what the static server records for a
// request (`page.html`) and what the browser sends (`/page.html?x=1`) name the
// same page. `/` and a trailing `/` mean that directory's index.html, as
// `resolveInside` in scripts/tune.js has it.
function pageKey(p) {
    let s = String(p === undefined || p === null ? '' : p).split(/[?#]/)[0].replace(/\\/g, '/');
    try {
        s = decodeURIComponent(s);
    } catch (e) {
        // keep it as written
    }
    s = s.replace(/^\/+/, '');
    return s === '' || s.endsWith('/') ? s + 'index.html' : s;
}
```

and add `pageKey` to the `module.exports` of `lib/tune.js`.
4. In `scripts/tune.js`, add `pageKey` to the destructured require on line 25 (after `statusOf`).
5. In `scripts/tune.js`, in the `/__live/queue` branch, replace the line `const editing = rows.filter((r) => r.status === 'taken')` with:

```js
            // The overlay's fetch carries its page as the Referer: a ring is
            // drawn for a request made on that page only. No referer, or a
            // request recorded without a page, keeps the ring (tune-7).
            let here = null;
            try {
                here = pageKey(new URL(req.headers.referer).pathname);
            } catch (e) {
                here = null;
            }
            const editing = rows.filter((r) => r.status === 'taken' && (!here || !r.page || pageKey(r.page) === here))
```

   leaving the `.map(...)` line after it unchanged.
6. Run `node --test tests/tune-queue-page.test.js tests/tune-drop.test.js tests/tune.test.js tests/tune-overlay.test.js` and watch them pass.
7. In `docs/90-agent/reference/station.md`, in the section `## When a tuned block is done`, replace the sentence beginning `A block `tune.js wait`` through `links the tune page.` with:

```md
A block `tune.js wait` handed out and not yet settled is a 編輯中 note in the
same panel, with an × like any other: the × hides the row on this browser
(`station.fkGone` in `localStorage`) and does not touch the queue. A request
`wait` took more than 24 hours ago and nobody settled reads as `expired`
(`statusOf`, `lib/tune.js`) and gets no 編輯中 row; `tune.js drop <id>` settles
a `queued` or `taken` request by hand, as `dropped`. Opening the panel counts
as reading it: a note read stays in the list, greyed, and the bell counts only
the unread notes and the editing rows. The panel's foot counts the done
requests and links the tune page.
```

8. Run `node scripts/doc-check.js` if that script exists for the reference page (skip when `ls scripts/doc-check.js` finds nothing).
9. Commit: `fix: a tuned block glows only on the page its request came from (tune-7)`.

## Task 8: May-have-stopped capsule jumps to the list, and each stopped row clears itself

**Files:**
- Modify: `assets/station/station.js:1853-1895` — capsule becomes a jump link; each maybe row gets its own clear control beside it
- Modify: `assets/station/station.js:5921-5930` — a click handler for `[data-jump]`
- Modify: `assets/station/station.css:905-914` — rules for `.kcap-go`, `.lv-row`, `.lv-row-clear`
- Read: `assets/station/station.js:4142-4173` — `clearStaleControl`, `clearControl` (called, not changed)
- Read: `tests/station-home.test.js` — the `el()` and `doc` stubs to copy if the vm boot throws
- Test: `tests/station-live-maybe.test.js`
- Test: `tests/station-live-head.test.js` — one regex at line 30 follows the new capsule markup

**Interfaces:**
- Consumes: `clearControl(s)` returning `''` for a non-stale row, a `POST /clear` form under `S.serve`, a copyable command otherwise; `liveLane(s, name, now)` returning an `<a class="lane ...">`
- Produces: `liveMaybe` rows as `<div class="lv-row">` + lane + `<div class="lv-row-clear">`; the capsule `<a class="kcap-go" href="#/live" data-jump="h-maybe">`; a document click handler that scrolls the element whose id is the `data-jump` value into view

**Dispatch:** implementer, sonnet — the code is below; transcription plus tests.

Steps:

1. Write the failing test. Create `tests/station-live-maybe.test.js`:

```js
'use strict';
// #/live, the "may have stopped" capsule and its list: the capsule jumps to
// the list (data-jump), and every row in the list carries its own clear
// control, outside the lane's <a>. Reuses clearControl, which posts /clear.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
const T = Date.now();
const lane = (id, state, unknown) => ({ id, root: 'F:\\ws\\alpha', project: null, state, unknown, task: 'task ' + id, stage: 'build',
    route: ['survey', 'design', 'plan', 'build'], started: new Date(T - 600000).toISOString(), updated: T - 60000, stages: [], pending: null });
const P = [{ root: 'F:\\ws\\alpha', gone: false }];
const ROWS = [lane('r1', 'live', false), lane('m1', 'live', true), lane('m2', 'stale', false)];

function boot(serve) {
    const clicks = [];
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', style: {}, attrs: {}, setAttribute() {}, getAttribute() { return null; },
        hasAttribute() { return false; }, removeAttribute() {}, appendChild() {}, addEventListener() {} });
    const els = {};
    const doc = { hidden: false, documentElement: el(), body: el(), title: '', head: { appendChild() {} },
        getElementById: (id) => els[id] || (els[id] = el()), addEventListener: (t, f) => { if (t === 'click') clicks.push(f); },
        createElement: el, querySelectorAll: () => [], querySelector: () => null };
    const win = { location: { hash: '#/live', protocol: 'file:' }, addEventListener() {}, scrollTo() {}, setInterval: () => 1, setTimeout: () => 1,
        clearTimeout() {}, navigator: { language: 'zh-TW' }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date(T).toISOString(), configDir: 'cfg', pricesVerified: '2026-09-24', serve: serve, nonce: 'N1',
            projects: P, profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: ROWS } };
    const box = { window: win, document: doc, URLSearchParams, fetch: () => Promise.resolve({ ok: true }), module: { exports: {} } };
    vm.runInNewContext(SRC, box);
    return { V: box.module.exports, clicks, els };
}

test('the capsule count is a jump link to the list, and plain when no row may have stopped', () => {
    const { V } = boot(true);
    const html = V.nowHtml(P, ROWS, '');
    assert.match(html, /<span><a class="kcap-go" href="#\/live" data-jump="h-maybe">可能已經停了<b>2<\/b><\/a><\/span>/);
    assert.ok(html.includes('id="h-maybe"'), 'the jump lands on the list heading');
    const none = V.nowHtml(P, [lane('r1', 'live', false)], '');
    assert.match(none, /<span>可能已經停了<b>0<\/b><\/span>/);
    assert.ok(!none.includes('kcap-go'));
});

test('served: a stale row has its own /clear form beside its lane; a live-but-unconfirmed row has none', () => {
    const { V } = boot(true);
    const html = V.nowHtml(P, ROWS, '');
    const card = html.slice(html.indexOf('<div class="lv-card">'));
    assert.equal((card.match(/<div class="lv-row">/g) || []).length, 2);
    assert.equal((card.match(/<div class="lv-row-clear">/g) || []).length, 2);
    assert.equal((card.match(/action="\/clear"/g) || []).length, 1, 'only the stale row can be cleared');
    assert.match(card, /name="id" value="m2"/);
    assert.ok(!/name="id" value="m1"/.test(card));
    assert.match(card, /name="nonce" value="N1"/);
    const lanes = card.match(/<a class="lane unsure"[\s\S]*?<\/a>/g) || [];
    assert.equal(lanes.length, 2);
    assert.ok(lanes.every((l) => !l.includes('<form')), 'no form inside a lane link');
});

test('written file: the stale row prints the clear command instead of a form', () => {
    const { V } = boot(false);
    const card = V.nowHtml(P, ROWS, '').split('<div class="lv-card">')[1];
    assert.ok(!card.includes('<form'));
    assert.match(card, /task\.js clear m2 --root/);
});

test('a click on the capsule scrolls the list into view and keeps the hash', () => {
    const { V, clicks, els } = boot(true);
    V.nowHtml(P, ROWS, '');
    let scrolled = 0, prevented = 0;
    els['h-maybe'] = { scrollIntoView() { scrolled += 1; } };
    const link = { getAttribute: (a) => (a === 'data-jump' ? 'h-maybe' : null) };
    const e = { target: { closest: (sel) => (sel === '[data-jump]' ? link : null) }, preventDefault() { prevented += 1; } };
    clicks.forEach((f) => f(e));
    assert.equal(scrolled, 1);
    assert.equal(prevented, 1);
});
```

2. Run `node --test tests/station-live-maybe.test.js` and watch all four fail. If the vm boot throws on a stub the page needs (compare `tests/station-home.test.js:17-34`), copy that file's `el()` and `doc` stubs; the assertions stay.

3. In `assets/station/station.js`, replace the whole of `liveMaybe` (`:1856-1866`) with the version below. The group heading keeps `clears` (the bulk clear); each row gains its own control in a sibling of the lane.

```js
    function liveMaybe(maybe, open, name, now) {
        if (!maybe.length) return '';
        var clears = open.map(function (p) {
            var c = clearStaleControl(p, maybe.filter(function (s) { return s.root === p.root; }));
            return c ? '<span class="lv-clear" title="' + esc(p.root) + '">' + c + '</span>' : '';
        }).join('');
        return '<section class="lv-grp" data-block="live-maybe" aria-labelledby="h-maybe"><div class="lv-h"><h2 id="h-maybe">' + loc('nav.mayHaveStopped', '可能已經停了') + '</h2>'
            + '<span class="lv-n mono">' + maybe.length + '</span><span class="lv-note">' + loc('nav.registryUnconfirmedProcess', 'registry 還標著進行中，但確認不了 process 還在') + '</span>'
            + (clears ? '<span class="spacer"></span>' + clears : '') + '</div>'
            + '<div class="lv-card">' + maybe.map(function (s) {
                return '<div class="lv-row">' + liveLane(s, name, now) + '<div class="lv-row-clear">' + clearControl(s) + '</div></div>';
            }).join('') + '</div></section>';
    }
```

4. In `assets/station/station.js`, in `nowHtml` (`:1890`), replace the line `+ '<span>' + loc('nav.capMaybe', '可能已經停了<b>{n}</b>', { n: maybe.length }) + '</span>'` with:

```js
            + '<span>' + (maybe.length ? '<a class="kcap-go" href="#/live" data-jump="h-maybe">' + loc('nav.capMaybe', '可能已經停了<b>{n}</b>', { n: maybe.length }) + '</a>'
                : loc('nav.capMaybe', '可能已經停了<b>{n}</b>', { n: maybe.length })) + '</span>'
```

5. In `assets/station/station.js`, directly before the `doc.addEventListener('click', function (e) {` that reads `[data-themecycle]` (`:5921`), add:

```js
    doc.addEventListener('click', function (e) {
        var n = e.target && e.target.closest ? e.target.closest('[data-jump]') : null;
        var to = n ? doc.getElementById(n.getAttribute('data-jump')) : null;
        if (!to) return;
        if (e.preventDefault) e.preventDefault();
        if (to.scrollIntoView) to.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
```

6. In `assets/station/station.css`, after the `.lv-clear code{...}` rule (`:913`), add:

```css
.lv-row{display:flex;align-items:center;gap:8px}
.lv-row>.lane{flex:1;min-width:0}
.lv-row-clear{flex:none;padding-right:10px}
.lv-row-clear:empty{display:none}
.lv-row-clear .clearform{margin-top:0}
.lv-row-clear .claims{margin-top:0!important;font-size:11px}
.kcap-go{color:inherit;text-decoration:none;border-bottom:1px dotted var(--faint);cursor:pointer}
.kcap-go:hover{color:var(--ink)}
.kcap-go:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
```

7. In `tests/station-live-head.test.js:30`, change the regex fragment `<span>可能已經停了<b>2<\/b><\/span>` to `<span><a class="kcap-go" href="#\/live" data-jump="h-maybe">可能已經停了<b>2<\/b><\/a><\/span>`.

8. Run `node --test tests/station-live-maybe.test.js tests/station-live-head.test.js tests/station-live-page.test.js tests/station-live-redesign.test.js tests/station-i18n.test.js` — all pass. (The middle three are named because they draw `nowHtml` too; if one fails on `.lv-card` children, do not edit it: report BLOCKED with the failing assertion, since those files are not this task's.)

9. Commit: `feat: the may-have-stopped capsule jumps to its list and each stopped row clears itself`.

## Task 9: Gate page options start expanded

**Files:**
- Modify: `assets/station/gate-frame.js:1-110` — header comment and the `STATE` comment say descriptions start open; `option()`, `paint()` and `more()` treat an option as open unless the reader closed it
- Modify: `docs/90-agent/reference/station.md:668-672` — the sentence on the gate frame
- Test: `tests/station-gate-frame.test.js`

**Interfaces:**
- Consumes: `STATE[key].more` — a map option number to boolean, kept across the focus page's 5-second repaint
- Produces: `more[n] === false` means closed; anything else (absent, `true`) means open. `FK_GATE.more(n)` still toggles; the frame's exports are unchanged.

**Dispatch:** implementer, sonnet — a three-line semantic flip plus test updates; the code is below.

Steps:

1. Update the tests first, in `tests/station-gate-frame.test.js`. Replace the second test (`an option shows its label, ...`, `:41-62`) with:

```js
test('an option shows its label, the recommended one marked; every description starts open and a click closes it', () => {
    const G = boot();
    const html = G.frame(args());
    assert.match(html, /<li data-gq="1" class="is-rec is-open">[\s\S]*?<span class="gt-l">build<span class="gt-rec">建議<\/span><\/span>/);
    assert.ok(!html.includes('(Recommended)'));
    assert.ok(html.includes('<p class="gt-d" id="gq-d-1">Approve the plan and start build.</p>'));
    assert.ok(html.includes('<p class="gt-d" id="gq-d-2">Send the plan back.</p>'));
    assert.ok(html.includes('data-gq-more="1" aria-expanded="true"'));
    assert.ok(html.includes('data-gq-pick="3" aria-pressed="false">選這個<kbd>3</kbd>'));
    assert.ok(html.includes('<h2 class="gt-q">Go to build?</h2>'));
    assert.ok(html.includes('build the twelve tasks'));
    assert.ok(!html.includes('gq-opts') && !html.includes('class="gq-l"'), 'no station.css boxed-card classes');
    G.more(1);
    const shut = G.frame(args());
    assert.ok(shut.includes('<li data-gq="1" class="is-rec">'));
    assert.ok(shut.includes('id="gq-d-1" hidden'));
    assert.ok(shut.includes('id="gq-d-2">'), 'the others stay open');
    G.more(1);
    assert.ok(G.frame(args()).includes('<p class="gt-d" id="gq-d-1">Approve'));
});
```

Replace the click test (`a click on an option label opens its description in place, and a second click closes it`, `:124-135`) in `tests/station-gate-frame.test.js` with:

```js
test('a click on an option label closes its open description in place, and a second click opens it again', () => {
    const { D } = listening();
    D.on.click({ target: inside('[data-gq-more]', 1) });
    const li = D.lis[0];
    assert.ok(!li.cls.has('is-open'));
    assert.equal(li.parts['[data-gq-more]'].attrs['aria-expanded'], 'false');
    assert.equal(li.parts['.gt-d'].hidden, true);
    D.on.click({ target: inside('[data-gq-more]', 1) });
    assert.ok(li.cls.has('is-open'));
    assert.equal(li.parts['.gt-d'].hidden, false);
    assert.equal(li.parts['[data-gq-more]'].attrs['aria-expanded'], 'true');
});
```

2. Run `node --test tests/station-gate-frame.test.js` and watch those two fail.

3. In `assets/station/gate-frame.js`, in `option()` (`:66`), replace the first `var` line with:

```js
        var k = kit(), n = i + 1, raw = String((o && o.label) || ''), rec = REC.test(raw), d = o && o.description, open = st.more[n] !== false;
```

4. In `assets/station/gate-frame.js`, in `paint()` (`:91`), replace the `var n = ...` line with:

```js
            var n = Number(li.getAttribute('data-gq')), open = st.more[n] !== false;
```

5. In `assets/station/gate-frame.js`, in `more()` (`:107`), replace the toggle line `st.more[n] = st.more[n] !== true;` with:

```js
        st.more[n] = st.more[n] === false;
```

6. In the same file, in the header comment (`:6-7`), change "its\n// description opens on click" to "its\n// description starts open and closes on click", and in the `STATE` comment (`:34`) change "the options opened" to "the options the reader closed".

7. In `docs/90-agent/reference/station.md`, replace the phrase `each option showing its label and opening its description on click` (`:671`) with `each option showing its label with its description open, a click on the label closing it`.

8. Run `node --test tests/station-gate-frame.test.js tests/station-gate-route.test.js tests/station-gate-send.test.js tests/station-gate-send-render.test.js tests/station-gate-tab.test.js` — all pass.

9. Commit: `feat: gate page options start expanded`.

## Task 10: requireGraph reads `import()`, and answers who-requires-it and cycles

**Files:**
- Modify: `lib/requires.js` — add the dynamic `import('./x.js')` pattern; export `affected(edges, file)` and `cycles(edges)`
- Read: `lib/board.js:55-62` — the four `import()` calls the test must now see as edges
- Test: `tests/requires-affected.test.js`

**Interfaces:**
- Consumes: none
- Produces: `requireGraph(root, files)` unchanged in shape, now also yielding dynamic `import()` edges; `affected(edges, file)` returns `{ files: edge[], tests: edge[] }` — the edges whose `to === file`, split by whether `from` starts with `tests/`; `cycles(edges)` returns `string[][]` — every strongly connected group of two or more files, each group sorted, the list sorted by first path

**Dispatch:** implementer, sonnet — the code is below; transcription plus tests.

Steps:

1. Write the failing tests. Create `tests/requires-affected.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { requireGraph, affected, cycles } = require('../lib/requires.js');
const { trackedFiles } = require('../lib/tracked.js');
const tmp = require('./tmp.js');

const write = (dir, rel, text) => {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text);
};

test('a dynamic import() of a relative specifier is an edge, with its line', () => {
  const dir = tmp('fankeel-requires-dyn-');
  write(dir, 'lib/a.js', "'use strict';\nPromise.all([\n  import('./b.js'),\n  import(\"./c.js\"),\n]);\n");
  write(dir, 'lib/b.js', 'module.exports = {};\n');
  write(dir, 'lib/c.js', 'module.exports = {};\n');
  const edges = requireGraph(dir, ['lib/a.js', 'lib/b.js', 'lib/c.js']);
  assert.deepEqual(edges, [
    { from: 'lib/a.js', to: 'lib/b.js', line: 3 },
    { from: 'lib/a.js', to: 'lib/c.js', line: 4 },
  ]);
});

test('a mention of import() with nothing quoted inside is not an edge', () => {
  const dir = tmp('fankeel-requires-prose-');
  write(dir, 'lib/a.js', "// loaded once with dynamic import(), which needs no build\nconst x = 1;\n");
  write(dir, 'lib/b.js', 'module.exports = {};\n');
  assert.deepEqual(requireGraph(dir, ['lib/a.js', 'lib/b.js']), []);
});

test('lib/board.js reaches the four chartroom modules it import()s', () => {
  const root = path.join(__dirname, '..');
  const edges = requireGraph(root, trackedFiles(root).files);
  const into = edges.filter((e) => e.from === 'lib/board.js' && e.to.startsWith('lib/chartroom/')).map((e) => e.to).sort();
  assert.deepEqual(into, [
    'lib/chartroom/core/format.js',
    'lib/chartroom/geometry/measure.js',
    'lib/chartroom/geometry/scene.js',
    'lib/chartroom/geometry/svg.js',
  ]);
});

test('affected splits the direct requirers into files and tests', () => {
  const edges = [
    { from: 'lib/a.js', to: 'lib/c.js', line: 3 },
    { from: 'scripts/s.js', to: 'lib/c.js', line: 9 },
    { from: 'tests/c.test.js', to: 'lib/c.js', line: 2 },
    { from: 'lib/a.js', to: 'lib/d.js', line: 4 },
  ];
  const hit = affected(edges, 'lib/c.js');
  assert.deepEqual(hit.files.map((e) => e.from), ['lib/a.js', 'scripts/s.js']);
  assert.deepEqual(hit.tests.map((e) => e.from), ['tests/c.test.js']);
  assert.deepEqual(affected(edges, 'lib/none.js'), { files: [], tests: [] });
});

test('cycles lists each loop of two or more files and ignores a chain', () => {
  const e = (from, to) => ({ from, to, line: 1 });
  const edges = [
    e('lib/profile.js', 'lib/stages.js'), e('lib/stages.js', 'lib/profile.js'),
    e('lib/handoff.js', 'lib/todo.js'), e('lib/todo.js', 'lib/plain.js'), e('lib/plain.js', 'lib/handoff.js'),
    e('lib/x.js', 'lib/y.js'), e('lib/y.js', 'lib/z.js'),
  ];
  assert.deepEqual(cycles(edges), [
    ['lib/handoff.js', 'lib/plain.js', 'lib/todo.js'],
    ['lib/profile.js', 'lib/stages.js'],
  ]);
  assert.deepEqual(cycles([]), []);
});
```

2. Run `node --test tests/requires-affected.test.js` and watch every test fail (`affected` and `cycles` are not exported; the first and third fail on the missing edges).
3. In `lib/requires.js`, under `const IMPORT = ...` (line 23), add the third pattern:

```js
// `import('./x.js')` — a dynamic import, the form `lib/board.js` loads
// `lib/chartroom/` with. The quoted relative specifier is what keeps prose such
// as "loaded with dynamic import()" from matching.
const IMPORT_CALL = /\bimport\(\s*(['"])(\.\.?\/[^'"]+)\1\s*\)/g;
```

4. In `lib/requires.js`, change the loop `for (const re of [REQUIRE, IMPORT]) {` (line 65) to:

```js
        for (const re of [REQUIRE, IMPORT, IMPORT_CALL]) {
```

5. In `lib/requires.js`, above `module.exports`, add the two helpers:

```js
// Who points straight at `file`, split by whether the pointer lives under
// `tests/`. Direct only — a caller wanting the reach of a change reads the
// edges of the files it gets back.
function affected(edges, file) {
    const direct = edges.filter((e) => e.to === file);
    const isTest = (e) => e.from.startsWith('tests/');
    return { files: direct.filter((e) => !isTest(e)), tests: direct.filter(isTest) };
}

// Every strongly connected group of two or more files (Tarjan). A lazy
// `require()` inside a function counts, because it is still an edge: the cycle
// is real even when load order hides it.
function cycles(edges) {
    const next = new Map();
    for (const e of edges) {
        if (!next.has(e.from)) next.set(e.from, new Set());
        next.get(e.from).add(e.to);
    }
    let counter = 0;
    const index = new Map();
    const low = new Map();
    const stack = [];
    const open = new Set();
    const found = [];
    function visit(v) {
        index.set(v, counter);
        low.set(v, counter);
        counter++;
        stack.push(v);
        open.add(v);
        for (const w of next.get(v) || []) {
            if (!index.has(w)) {
                visit(w);
                low.set(v, Math.min(low.get(v), low.get(w)));
            } else if (open.has(w)) {
                low.set(v, Math.min(low.get(v), index.get(w)));
            }
        }
        if (low.get(v) === index.get(v)) {
            const group = [];
            let w;
            do {
                w = stack.pop();
                open.delete(w);
                group.push(w);
            } while (w !== v);
            if (group.length > 1) found.push(group.sort());
        }
    }
    for (const v of [...next.keys()].sort()) if (!index.has(v)) visit(v);
    return found.sort((a, b) => a[0].localeCompare(b[0]));
}
```

and, in `lib/requires.js`, change the export to:

```js
module.exports = { requireGraph, affected, cycles };
```

6. In `lib/requires.js`, update the header comment's first sentence (line 3) to read `// Every relative `require()` edge, and every relative `import` edge — static or dynamic — among a`.
7. Run `node --test tests/requires-affected.test.js tests/requires.test.js` and watch both pass.
8. Commit: `feat: requireGraph reads import(), and answers who requires a file and which files loop`.

## Task 11: `survey.js --affected <file>`

**Files:**
- Modify: `scripts/survey.js` — `--affected <file>` flag, `affectedReport()`, the branch in `main()`
- Modify: `skills/fankeel-survey/SKILL.md:175-177` — one line for the flag in the re-run fence
- Modify: `tests/skill-size.test.js:19` — the survey cap, raised with the line
- Read: `lib/requires.js` — `requireGraph` and `affected` (Task 10)
- Test: `tests/survey-affected.test.js`

**Interfaces:**
- Consumes: `requireGraph(root, files)` and `affected(edges, file)` from `lib/requires.js` (Task 10)
- Produces: `parseArgs(argv)` gains `affected` — `null` when the flag is absent, the value string otherwise (`''` when the flag has none); `main(argv)` prints the report below for it; no other export changes

**Dispatch:** implementer, sonnet — the code is below; transcription plus tests.

The report, for `--affected lib/stages.js`:

```
fankeel survey --affected lib/stages.js — 17 files and 33 tests require it directly

files:
  lib/profile.js:209,234,334
  ...

tests:
  tests/a.test.js:3
  ...
```

Steps:

1. Write the failing tests. Create `tests/survey-affected.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const survey = require('../scripts/survey.js');
const tmp = require('./tmp.js');
const SCRIPT = path.join(__dirname, '..', 'scripts', 'survey.js');

function repo(files) {
  const root = tmp('fankeel-survey-affected-');
  execFileSync('git', ['init', '-q'], { cwd: root });
  for (const [name, body] of Object.entries(files)) {
    const full = path.join(root, name);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
  }
  execFileSync('git', ['add', '-A'], { cwd: root });
  return root;
}

const run = (root, ...args) =>
  execFileSync(process.execPath, [SCRIPT, '--root', root, ...args], { encoding: 'utf8' });

const fixture = () => repo({
  'lib/c.js': "'use strict';\nmodule.exports = {};\n",
  'lib/a.js': "'use strict';\nfunction later() {\n  return require('./c.js');\n}\nconst again = require('./c.js');\n",
  'scripts/b.js': "const c = require('../lib/c.js');\n",
  'lib/lonely.js': "'use strict';\n",
  'tests/c.test.js': "'use strict';\nconst c = require('../lib/c.js');\n",
});

test('--affected lists the files and the tests that require it, one row each with every line', () => {
  const out = run(fixture(), '--affected', 'lib/c.js');
  assert.match(out, /^fankeel survey --affected lib\/c\.js — 2 files and 1 test require it directly/);
  assert.match(out, /\nfiles:\n {2}lib\/a\.js:3,5\n {2}scripts\/b\.js:1\n/);
  assert.match(out, /\ntests:\n {2}tests\/c\.test\.js:2\n/);
});

test('--affected takes an absolute path to the same answer', () => {
  const root = fixture();
  const out = run(root, '--affected', path.join(root, 'lib', 'c.js'));
  assert.match(out, /^fankeel survey --affected lib\/c\.js — 2 files/);
});

test('--affected on a file nothing requires says so rather than printing empty sections', () => {
  const out = run(fixture(), '--affected', 'lib/lonely.js');
  assert.match(out, /0 files and 0 tests require it directly/);
  assert.match(out, /Nothing requires it by a relative path/);
});

test('--affected on a file that is not a tracked .js file names the path it looked for', () => {
  const out = run(fixture(), '--affected', 'lib/missing.js');
  assert.match(out, /lib\/missing\.js is not a tracked \.js file under this root/);
});

test('--affected with no value asks for a file', () => {
  assert.match(run(fixture(), '--affected'), /--affected needs a file/);
});

test('--affected takes its value with it rather than leaving it as a term', () => {
  const parsed = survey.parseArgs(['--affected', 'lib/x.js', 'widget']);
  assert.equal(parsed.affected, 'lib/x.js');
  assert.deepEqual(parsed.terms, ['widget']);
  assert.equal(survey.parseArgs(['widget']).affected, null);
});

test('lib/stages.js in this repository: lib/profile.js with its lazy require, and every direct test', () => {
  const root = path.join(__dirname, '..');
  const out = run(root, '--affected', 'lib/stages.js');
  assert.match(out, /\n {2}lib\/profile\.js:[\d,]*209\b/);
  const tests = out.split('\ntests:\n')[1].split('\n').filter((l) => /^ {2}tests\//.test(l));
  assert.ok(tests.length >= 18, 'listed ' + tests.length + ' test files');
  assert.doesNotMatch(out, /more, not listed/);
});
```

2. Run `node --test tests/survey-affected.test.js` and watch every test fail.
3. In `scripts/survey.js`, under `const docsTree = require('../lib/docs.js');` (line 30), add:

```js
const { requireGraph, affected: affectedBy } = require('../lib/requires.js');
```

4. In `scripts/survey.js`, in `parseArgs`, beside `let archive = false;` (line 508), add `let affected = null;`, and before the `if (argv[i].startsWith('--')) continue;` line (541) add:

```js
        // Takes its value with it, as `--root` does: left alone the path would
        // be read as a search term. A flag with no value stays `''`, so the
        // report can say what is missing rather than quietly running a scan.
        if (argv[i] === '--affected') {
            affected = argv[i + 1] !== undefined ? String(argv[++i]) : '';
            continue;
        }
```

and, in `scripts/survey.js`, change the return to:

```js
    return { root, terms, max, tree, archive, include, affected };
```

5. In `scripts/survey.js`, above `function main` (line 548), add:

```js
// Who requires one file, straight away: the non-test files and the tests, each
// with the lines that do it. The sections ignore the per-section cap unless
// `--max` was given, because a half list of who a change breaks answers a
// different question; the output ceiling still bounds the whole.
function affectedReport(root, target, max) {
    if (!target) return 'fankeel survey: --affected needs a file, repository-relative or absolute.';
    const found = trackedFiles(root);
    if (!found) return 'fankeel survey: nothing readable under that root — no repository, and no files.';
    const files = found.files.map((f) => String(f).replace(/\\/g, '/'));
    const rel = path.relative(root, path.resolve(root, target)).split(path.sep).join('/');
    if (!/\.js$/i.test(rel) || !files.includes(rel)) {
        return 'fankeel survey: ' + rel + ' is not a tracked .js file under this root. This reads `git ls-files`; check the path.';
    }
    const hit = affectedBy(requireGraph(root, files), rel);
    const rows = (list) => {
        const byFile = new Map();
        for (const e of list) byFile.set(e.from, [...(byFile.get(e.from) || []), e.line]);
        return [...byFile.entries()].map(([from, lines]) => from + ':' + lines.join(','));
    };
    const fileRows = rows(hit.files);
    const testRows = rows(hit.tests);
    const cap = max === DEFAULT_MAX ? Infinity : max;
    const out = ['fankeel survey --affected ' + rel + ' — ' + plural(fileRows.length, 'file', 'files')
        + ' and ' + plural(testRows.length, 'test', 'tests') + ' require it directly'];
    out.push(...section('files:', fileRows, cap));
    out.push(...section('tests:', testRows, cap));
    if (!fileRows.length && !testRows.length) {
        out.push('', 'Nothing requires it by a relative path. A caller through a package name or a string built at run time is not seen here.');
    } else {
        out.push('', 'Direct requirers only; open one of them and run this again to follow a change further.');
    }
    return out.join('\n');
}

```

6. In `scripts/survey.js`, replace the first two lines of `main` (lines 549-550, `const { root, ... } = parseArgs(argv);` and `const text = report(...)`) with:

```js
    const { root, terms, max, tree, archive, include, affected } = parseArgs(argv);
    const text = affected !== null
        ? affectedReport(root, affected, max)
        : report(scan(root, terms, { archive, include }), terms, { max, tree, root });
```

7. Run `node --test tests/survey-affected.test.js` and watch it pass; run `node --test tests/survey.test.js` to confirm the existing parser tests are green.
8. In `skills/fankeel-survey/SKILL.md`, in the fence at lines 175-177, after the `--include-role` line, add:

```sh
node <plugin>/scripts/survey.js --affected <file>     # who requires it: files and tests, with lines
```

9. In `tests/skill-size.test.js`, change `'fankeel-survey': 23700,` (line 19) to:

```js
    'fankeel-survey': 23800,
```

10. Run `node --test tests/skill-size.test.js` and watch it pass (the skill is now about 23740 bytes).
11. Commit: `feat: survey.js --affected lists who requires a file, files and tests, with lines`.

## Task 12: map.md gains a reading order and an import-cycles section

**Files:**
- Modify: `lib/map.js:316-342` — `orientation()` appends the two sections
- Modify: `docs/90-agent/reference/documents.md:103-111` — the orientation paragraph names them
- Read: `lib/requires.js` — `cycles(edges)` (Task 10)
- Read: `tests/map.test.js` — the orientation regexes at `:402-416`, run unchanged
- Test: `tests/map-reading-order.test.js`

**Interfaces:**
- Consumes: `requires.cycles(edges)` from `lib/requires.js` (Task 10); `requires.requireGraph` already used there
- Produces: two more sections inside `orientation:` in `.fankeel/map.md`: `reading order — most required first:` (numbered rows `N. file  (required by K)`, non-test files only, capped by `section()`'s 25) and `import cycles:` (one row per group joined by ` <-> `, or the single line `import cycles: none`)

**Dispatch:** implementer, sonnet — the code is below; transcription plus tests.

Steps:

1. Write the failing tests. Create `tests/map-reading-order.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const map = require('../lib/map.js');
const tmp = require('./tmp.js');

const withFiles = (files) => {
  const dir = tmp('fankeel-map-order-');
  for (const [rel, text] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, text);
  }
  return dir;
};

test('the reading order lists non-test files, most required first, numbered', () => {
  const dir = withFiles({
    'lib/a.js': "const b = require('./b.js');\n",
    'lib/b.js': "'use strict';\n",
    'scripts/run.js': "require('../lib/a.js');\nrequire('../lib/b.js');\n",
    'tests/b.test.js': "require('../lib/b.js');\n",
  });
  const text = map.buildMap(dir);
  assert.match(text, /\nreading order — most required first:\n {2}1\. lib\/b\.js {2}\(required by 3\)\n {2}2\. lib\/a\.js {2}\(required by 1\)\n/);
  assert.doesNotMatch(text, /\d\. tests\//);
});

test('import cycles names each loop, and says none when there is none', () => {
  const looped = withFiles({
    'lib/a.js': "require('./b.js');\n",
    'lib/b.js': "function later() { return require('./a.js'); }\n",
    'lib/c.js': "require('./a.js');\n",
  });
  assert.match(map.buildMap(looped), /\nimport cycles:\n {2}lib\/a\.js <-> lib\/b\.js\n/);

  const flat = withFiles({
    'lib/a.js': "require('./b.js');\n",
    'lib/b.js': "'use strict';\n",
  });
  assert.match(map.buildMap(flat), /\nimport cycles: none\n/);
});

test('this repository: the two loops the graph tools found are on the map', () => {
  const text = map.buildMap(path.join(__dirname, '..'));
  assert.match(text, /\nreading order — most required first:\n {2}1\. /);
  assert.match(text, /\n {2}lib\/profile\.js <-> lib\/stages\.js\n/);
  assert.match(text, /\n {2}lib\/handoff\.js <-> lib\/plain\.js <-> lib\/todo\.js\n/);
});
```

2. Run `node --test tests/map-reading-order.test.js` and watch every test fail.
3. In `lib/map.js`, in `orientation()`, replace the last line (`return [...report.section('most required:', top), ...report.section('directories:', crossing)];`, line 341) with:

```js
    // Leaves first: a file many others require is read before the ones that
    // build on it. Tests are never required, so leaving them out changes only
    // what the numbers are counted against, not the order.
    const order = [...counts.entries()]
        .filter(([file]) => !file.startsWith('tests/'))
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([file, n], i) => (i + 1) + '. ' + file + '  (required by ' + n + ')');

    const loops = requires.cycles(edges).map((group) => group.join(' <-> '));
    const cyclesBlock = loops.length ? report.section('import cycles:', loops) : ['', 'import cycles: none'];

    return [
        ...report.section('most required:', top),
        ...report.section('directories:', crossing),
        ...report.section('reading order — most required first:', order),
        ...cyclesBlock,
    ];
```

4. Run `node --test tests/map-reading-order.test.js tests/map.test.js` and watch both pass (the existing orientation regexes at `tests/map.test.js:402-416` do not anchor on what follows `directories:`).
5. In `docs/90-agent/reference/documents.md`, replace the sentence at lines 109-111 `file lives, but who already reaches into it. Left out entirely when no `.js`` + newline + `file requires another by a relative path.` with:

```md
file lives, but who already reaches into it. Two sections follow `directories:`:
`reading order — most required first:` numbers the non-test files by how many
files require them (leaves first), and `import cycles:` names each group of
files that require each other, with a lazy `require()` or `import()` inside a
function counted, or says `import cycles: none`. `requireGraph()` reads
`require('./x')`, static `import ... from './x'` and dynamic `import('./x')`.
Left out entirely when no `.js` file requires another by a relative path.
```

6. Regenerate and look: `node scripts/map.js` then `grep -n "reading order\|import cycles" .fankeel/map.md` shows both headings.
7. Commit: `feat: the map orders files for reading and names the import cycles`.

## Coverage

| promise | task |
|---|---|
| station-50: read notifications turn grey and stay; badge excludes read | Task 6 (render, count; opening marks read) |
| station-50: an × for Editing rows (assets/station/station.js:2488, 2493) | Task 6 (button, handler, remembered id) |
| station-50: clear shown for non-editing rows only (:2555) | Task 6 |
| station-50: a `tune.js drop` command (scripts/tune.js has none) | Task 4 |
| station-50: taken requests auto-expire after 24 hours; a dropped or expired one is not rendered | Task 4 (queue endpoint), Task 5 (station items) |
| tune-7: the `fk-live-edp` ring (assets/tune/overlay.js:746-750) never disappears until `done` | Task 4 (expiry and drop end the ring through `/__live/queue`; `overlay.js` unchanged), Task 7 (ring only on its own page) |
| tune-7: 0 待送 versus 佇列 2 unexplained | Task 4 (stale taken rows leave `pending`), Task 7 (kept: `pending` is the whole server) |
| survey.js 加 --affected <file>：用 lib/requires.js 的 requireGraph 列出直接 require 它的檔案與對應測試，含行號 | Task 11 |
| map.md 加一節閱讀順序，依被 require 次數由葉到根排 | Task 12 |
| 順手補 import cycles 一節 | Task 12 (with `cycles()` in Task 10) |
| 讓 requireGraph 認動態 import()（lib/board.js:57 目前漏掉） | Task 10 |
| survey.js --affected lib/stages.js 一次呼叫就列出 … 非測試檔與 … 直接測試 | Task 11 (counts today are 17 and more, not the 2026-10-22 15 and 18) |
| map.md 出現閱讀順序與循環兩節；suite 綠 | Task 12 step 6, parent's `suite.js --fast` |
| docs that describe survey.js need a line for the flag (skill cap checked) | Task 11 steps 8-10 |
