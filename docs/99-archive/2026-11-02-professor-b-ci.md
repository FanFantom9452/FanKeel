---
status: current
last_verified: 2026-11-02
---

# 教授 11-01 組 B — CI 狀態與 init Implementation Plan

**Goal:** after a push, land prints one `ci:` line read from the origin's own CI without waiting, opens a PR by the origin's host, and init drafts a `.fankeel/suite.json` from the project's CI workflows and points at a nightly template it never installs.
**Architecture:** one new read-only script, `scripts/ci-status.js`, picks GitHub (`gh api`) or Gitea (HTTPS `/api/v1`) from `git remote get-url origin`, with git, gh, fetch and env behind a `deps` seam so its tests never touch a network or a credential helper. The land skill's step 7 calls it and splits PR creation by host; the init scout reads `.gitea/workflows/*.yml` and `.github/workflows/*.yml` and drafts, the init skill asks; `assets/ci/nightly.yml` is a copy-it-yourself Gitea Actions schedule.
**Tech Stack:** Node `>=22.5` (`package.json` `engines`), its global `fetch` and `AbortSignal.timeout`, `node:child_process` `spawnSync`, `node:util` `parseArgs`, `node --test`; no dependencies.
**Spec:** [2026-11-01-professor-ci-tiers-design.md](2026-11-01-professor-ci-tiers-design.md) — §2, §3 and the `tests/ci-status.test.js` proof bullet only. Index: [2026-11-02-professor-index.md](2026-11-02-professor-index.md), row B.

## Global Constraints

Generated from `node scripts/map.js` (`.fankeel/map.md`), `CONTRIBUTING.md` (this repository has no `CLAUDE.md` — `CONTRIBUTING.md:3`), `package.json` and the tests named.

- Engines: `"node": ">=22.5"`. No `dependencies` block exists and none is added — `CONTRIBUTING.md` "Issue first": "no new dependency".
- Suite commands, exactly: `test` = `node --test --test-timeout=300000 --test-force-exit --require ./tests/subprocess-timeout.js`; `test:fast` adds `--test-skip-pattern=@slow`. An implementer runs only its own test file: `node --test tests/<its file>`.
- `tests/subprocess-timeout.js` gives every `execFileSync`/`spawnSync` that names no timeout `FANKEEL_TEST_SUBPROCESS_TIMEOUT` or `120000` ms. `scripts/ci-status.js` names its own: `5000` ms per call.
- Layering (`CONTRIBUTING.md`, Scope table): `lib/*.js` never reaches into `scripts/` or `hooks/`. Index row B fixes this group's file set as `scripts/ci-status.js` with no lib module, so the script keeps its two pure helpers itself and exports them.
- `tests/source.test.js`: every exported name needs an importer, and a new file must be staged (`git add`) before that test can see it (`CONTRIBUTING.md`, Tests row). `scripts/ci-status.js` exports exactly `main` and `parseOrigin`, both imported by `tests/ci-status.test.js`.
- Script shape, as `scripts/phone.js`: `#!/usr/bin/env node`, `'use strict'`, a header comment with the usage line, `main(argv, deps)` returning `{ text, code }`, `if (require.main === module)` printing `text + '\n'` and setting `process.exitCode`, `module.exports` last. Four-space indent in scripts and tests. External calls go through a seam the tests fake, as `lib/tailscale.js` (`run`, `TIMEOUT_MS = 5000`, `windowsHide: true`).
- `scripts/skills-check.js` (land step 1a) fails on a `node <plugin>/scripts/<x>.js` a skill names that is not in `scripts/`, and on a flag the script's `parseArgs` options table does not declare (`lib/skills.js` `acceptedFlags`, `OPTION` regex). `ci-status.js` declares `root` only.
- `tests/skill-size.test.js` caps, "the smallest multiple of 100 above the size measured": `'fankeel-land': 24200` (file is 24194 bytes), `'fankeel-init': 13100` (13096 bytes). Both skills grow here, so each task raises its own key to the smallest multiple of 100 above `node scripts/input-check.js --skills`'s new byte count, in the same change.
- `tests/agents.test.js:439-449`: the init scout keeps `tools: [Read, Grep, Glob, Bash]`, `model: sonnet`, the line `scripts/onboard.js --full --root <root>`, a `## Return` heading and the words `` `status:` ``, `` `drafts:` ``, `` `scope:` ``, `` `contradiction:` ``, `` `duplicate:` ``. `tests/worktree-docs.test.js:36-42`: it keeps `node <plugin>/scripts/residue.js --root <root>`, `` `.claude/worktrees/` ``, the regex `profile, visibility,\s+docs\.json, TODO, tree, CLAUDE\.md, memory, worktrees` and the words `the five above`. `lib/guard.js` `READ_ONLY_AGENTS` holds `fankeel-init-scout`: it writes nothing, so a suite.json draft stays a draft.
- Profile keys (`lib/profile.js:20-21`): `land.integration` takes `merge`, `pr`, `keep`; `land.push` takes `true`, `false`. Set with `node <plugin>/scripts/task.js profile set <key> <value> --project <name>`.
- `.fankeel/suite.json` format, from index row A and read only as a format: `{ "daily": [{ "dir": string, "run": string }], "nightly": [same shape] }`; A's runner goes in order and stops at the first red entry.
- Plan caps (`lib/plantasks.js`): `READ_CAP` 1500 lines per `Modify:` file, `FILE_CAP` 3 `Modify:` entries per task.
- Commit subject `type: what changed`, under 60 characters, then `- <what changed> — <path>` bullets (`skills/fankeel-land/SKILL.md`, step 4). Current version `0.146.1`; the release bump belongs to land, not to these tasks.
- Reference project `F:/ymlab/RH/.gitea/workflows/ci.yml` is read only, never modified: steps carry `working-directory: apps/api` / `apps/web` and `run:` lines `poetry run pytest --collect-only`, `poetry run pytest`, `npm test`, `npm run e2e`.

## Risks

- GitHub Actions report results as check runs, not commit statuses, so `gh api repos/{o}/{r}/commits/{sha}/status` for an Actions-only GitHub repo answers `total_count: 0` and prints `ci: none` — Task 1 — the spec chose `/status`; Task 1 keeps it and its test pins the `none` mapping; not checked against a real repository.
- Gitea's combined-status body with no statuses is assumed to carry `total_count: 0`; RH is private and its API answered 404 without a token (spec, 未驗證) — Task 1 — `stateOf` also counts `statuses.length` when `total_count` is absent.
- `git credential fill` under Git Credential Manager on Windows can open a dialog and block — Task 1 — the call sets `GIT_TERMINAL_PROMPT=0` and `GCM_INTERACTIVE=never` and a `5000` ms timeout; the test asserts both variables reach the call. Not exercised against a real GCM.
- `tests/skill-size.test.js` is shared beyond this group: groups C (`fankeel-audit` 20770 of 20800) and D (`fankeel-plan` 19363 of 19400) will likely raise their own caps there, and the index lists the file for no group — Tasks 2 and 4 — each edits only its own key's line; whichever group lands second rebases one line. Inside this group the file serialises Task 4 after Task 2.
- A new script is invisible to `tests/source.test.js` until staged — Task 1 — step 6 runs `git add scripts/ci-status.js tests/ci-status.test.js` before the commit.

## File structure

| File | Responsibility | Task |
|---|---|---|
| `scripts/ci-status.js` | new — origin → API, auth fallback, one `ci:` line, exit 0 | 1 |
| `tests/ci-status.test.js` | new — faked git/gh/fetch/env, includes the spec's proof case | 1 |
| `skills/fankeel-land/SKILL.md` | step 7 PR by host, `ci-status.js` after a push, `ci:` in the report | 2 |
| `tests/land-ci.test.js` | new — pins step 7's text | 2 |
| `assets/ci/nightly.yml` | new — Gitea Actions `on: schedule` template for the nightly tier | 3 |
| `docs/02-architecture/layout.md` | the `assets/` tree row names `ci/nightly.yml` | 3 |
| `tests/ci-nightly.test.js` | new — pins the schedule and the `suite.js --nightly` call | 3 |
| `agents/fankeel-init-scout.md` | reads workflows and origin, `ci` status row, `suite` and `land pr` drafts | 4 |
| `skills/fankeel-init/SKILL.md` | asks the PR question once, writes suite.json only on approval, names the template | 4 |
| `tests/skill-size.test.js` | the `fankeel-land` and `fankeel-init` caps | 2, 4 |
| `tests/init-ci.test.js` | new — pins the scout's and init's new text | 4 |

## Task 1: `scripts/ci-status.js` — one CI line for a pushed commit

**Files:**
- Modify: `scripts/ci-status.js` — new file: `parseOrigin`, `stateOf`, the GitHub and Gitea readers, `main`
- Read: `scripts/phone.js` — the `main(argv) → { text, code }` and `require.main` shape copied here
- Read: `lib/tailscale.js` — the `spawnSync` seam shape (`TIMEOUT_MS`, `windowsHide`, `{ status, stdout, stderr }`) copied here
- Test: `tests/ci-status.test.js`

**Interfaces:**
- Consumes: none
- Produces: `ci-status.js` — CLI `node <plugin>/scripts/ci-status.js <sha> [--root <dir>]` printing exactly one line, `ci: success`, `ci: failure`, `ci: pending`, `ci: none`, `ci: unknown <actions url>` or bare `ci: unknown` (no parseable origin), exit 0; exit 2 with `usage: ci-status.js <sha> [--root <dir>]` only for a missing or extra positional. Exports `main(argv: string[], deps?: { git, gh, fetch, env }) → Promise<{ text: string, code: number }>` where `git(args, { cwd, input, env }) → { status, stdout, stderr }`, `gh(args, { cwd }) → same`, `fetch(url, init) → Promise<{ ok, status, json() }>`; and `parseOrigin(url: string) → { host, hostport, scheme, owner, repo, kind: 'github'|'gitea', base, actions } | null`.

**Dispatch:** implementer, opus — the floor for this architectural task.

1. Write the failing test, the whole of `tests/ci-status.test.js`:

   In `tests/ci-status.test.js`:

```js
'use strict';
// scripts/ci-status.js (docs/90-agent/plans/2026-11-01-professor-ci-tiers-design.md §2):
// one line about CI for a pushed commit, exit 0, never waiting. git, gh, fetch
// and env are faked throughout: no test reaches a network or a real
// credential helper.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { main, parseOrigin } = require('../scripts/ci-status.js');

const SHA = 'a'.repeat(40);
const GITEA = 'https://git.example.org/lab/rh.git';
const STATUS_URL = 'https://git.example.org/api/v1/repos/lab/rh/commits/' + SHA + '/status';

// A fake git: `remote get-url origin` answers `origin` (null: no such remote),
// `rev-parse` answers SHA, `credential fill` answers `cred` (null: exit 128,
// as with no helper and prompts off). Every call is recorded with its stdin
// and env.
function fakeGit(origin, cred) {
    const calls = [];
    const git = (args, opts) => {
        const o = opts || {};
        calls.push({ args: args.join(' '), input: o.input, env: o.env });
        if (args[0] === 'remote') {
            return origin === null
                ? { status: 2, stdout: '', stderr: 'error: No such remote \'origin\'' }
                : { status: 0, stdout: origin + '\n', stderr: '' };
        }
        if (args[0] === 'rev-parse') return { status: 0, stdout: SHA + '\n', stderr: '' };
        if (args[0] === 'credential') {
            return cred
                ? { status: 0, stdout: 'protocol=https\nhost=git.example.org\nusername=' + cred.username + '\npassword=' + cred.password + '\n', stderr: '' }
                : { status: 128, stdout: '', stderr: 'fatal: could not read Username: terminal prompts disabled' };
        }
        return { status: 1, stdout: '', stderr: 'unexpected git ' + args.join(' ') };
    };
    return { git, calls };
}

// A fake fetch: `answer(auth)` returns a JSON body, or a number for an HTTP
// error status. Records url and Authorization of every request.
function fakeFetch(answer) {
    const calls = [];
    const fetch = async (url, init) => {
        const auth = init && init.headers ? init.headers.Authorization : undefined;
        calls.push({ url, auth });
        const a = answer(auth);
        if (typeof a === 'number') return { ok: false, status: a, json: async () => ({ message: 'error' }) };
        return { ok: true, status: 200, json: async () => a };
    };
    return { fetch, calls };
}

const noGh = () => { throw new Error('gh must not run for a Gitea origin'); };
const noFetch = async () => { throw new Error('fetch must not run here'); };
const combined = (state, n) => ({ state, total_count: n, statuses: Array.from({ length: n }, () => ({ status: state })) });

// The spec's proof bullet: Gitea origin, no token, credential fill fails.
test('a Gitea origin with no token and no credential prints ci: unknown with the Actions page', async () => {
    const g = fakeGit(GITEA, null);
    const out = await main([SHA], { git: g.git, gh: noGh, fetch: noFetch, env: {} });
    assert.equal(out.text, 'ci: unknown https://git.example.org/lab/rh/actions');
    assert.equal(out.code, 0);
    const fill = g.calls.find((c) => c.args === 'credential fill');
    assert.ok(fill, 'credential fill was not asked');
    assert.equal(fill.input, 'protocol=https\nhost=git.example.org\n\n');
    assert.equal(fill.env.GIT_TERMINAL_PROMPT, '0');
    assert.equal(fill.env.GCM_INTERACTIVE, 'never');
});

test('GITEA_TOKEN is tried first and credential fill is never asked', async () => {
    const g = fakeGit(GITEA, { username: 'u', password: 'never-used' });
    const f = fakeFetch(() => combined('success', 2));
    const out = await main([SHA], { git: g.git, gh: noGh, fetch: f.fetch, env: { GITEA_TOKEN: 't0k' } });
    assert.equal(out.text, 'ci: success');
    assert.deepEqual(f.calls, [{ url: STATUS_URL, auth: 'token t0k' }]);
    assert.ok(!g.calls.some((c) => c.args === 'credential fill'));
});

test('credential fill answers with Basic auth, and the password is never printed', async () => {
    const g = fakeGit(GITEA, { username: 'fan', password: 's3cret-pw' });
    const f = fakeFetch(() => combined('failure', 1));
    const out = await main([SHA], { git: g.git, gh: noGh, fetch: f.fetch, env: {} });
    assert.equal(out.text, 'ci: failure');
    assert.equal(f.calls[0].auth, 'Basic ' + Buffer.from('fan:s3cret-pw').toString('base64'));
    assert.ok(!out.text.includes('s3cret-pw'));
});

test('a rejected token falls back to credential fill', async () => {
    const g = fakeGit(GITEA, { username: 'fan', password: 'pw' });
    const f = fakeFetch((auth) => (auth === 'token bad' ? 401 : combined('pending', 1)));
    const out = await main([SHA], { git: g.git, gh: noGh, fetch: f.fetch, env: { GITEA_TOKEN: 'bad' } });
    assert.equal(out.text, 'ci: pending');
    assert.equal(f.calls.length, 2);
});

test('error reads as failure, no statuses as none, an unknown state as unknown', async () => {
    const run = async (body) => (await main([SHA], { git: fakeGit(GITEA, null).git, gh: noGh, fetch: fakeFetch(() => body).fetch, env: { GITEA_TOKEN: 't' } })).text;
    assert.equal(await run(combined('error', 1)), 'ci: failure');
    assert.equal(await run({ state: '', total_count: 0, statuses: [] }), 'ci: none');
    assert.equal(await run({ state: 'pending', statuses: [] }), 'ci: none');
    assert.equal(await run(combined('warning', 1)), 'ci: unknown https://git.example.org/lab/rh/actions');
});

test('a fetch that throws reads as unknown, never as an error', async () => {
    const fetch = async () => { throw new Error('ECONNREFUSED'); };
    const out = await main([SHA], { git: fakeGit(GITEA, null).git, gh: noGh, fetch, env: { GITEA_TOKEN: 't' } });
    assert.equal(out.text, 'ci: unknown https://git.example.org/lab/rh/actions');
    assert.equal(out.code, 0);
});

test('a github.com origin is read through gh api and never through fetch', async () => {
    const calls = [];
    const gh = (args) => {
        calls.push(args.join(' '));
        return { status: 0, stdout: JSON.stringify(combined('success', 3)), stderr: '' };
    };
    const out = await main([SHA], { git: fakeGit('git@github.com:FanFantom9452/FanKeel.git', null).git, gh, fetch: noFetch, env: {} });
    assert.equal(out.text, 'ci: success');
    assert.deepEqual(calls, ['api repos/FanFantom9452/FanKeel/commits/' + SHA + '/status']);
});

test('gh failing prints unknown with the GitHub Actions page', async () => {
    const gh = () => ({ status: null, stdout: '', stderr: 'spawnSync gh ENOENT' });
    const out = await main([SHA], { git: fakeGit('https://github.com/o/r', null).git, gh, fetch: noFetch, env: {} });
    assert.equal(out.text, 'ci: unknown https://github.com/o/r/actions');
});

test('no origin prints a bare ci: unknown, exit 0', async () => {
    const out = await main([SHA], { git: fakeGit(null, null).git, gh: noGh, fetch: noFetch, env: {} });
    assert.deepEqual(out, { text: 'ci: unknown', code: 0 });
});

test('a missing sha is a usage error, exit 2', async () => {
    const out = await main([], { git: fakeGit(GITEA, null).git, gh: noGh, fetch: noFetch, env: {} });
    assert.deepEqual(out, { text: 'usage: ci-status.js <sha> [--root <dir>]', code: 2 });
    const cli = spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'ci-status.js')], { encoding: 'utf8' });
    assert.equal(cli.status, 2);
    assert.equal(cli.stdout, 'usage: ci-status.js <sha> [--root <dir>]\n');
});

test('parseOrigin reads https, ssh, scp-style, ports and sub-paths', () => {
    assert.deepEqual(parseOrigin('https://git.example.org/lab/rh.git'), {
        host: 'git.example.org', hostport: 'git.example.org', scheme: 'https', owner: 'lab', repo: 'rh',
        kind: 'gitea', base: 'https://git.example.org', actions: 'https://git.example.org/lab/rh/actions',
    });
    const port = parseOrigin('http://me@10.0.0.5:3000/lab/rh');
    assert.equal(port.base, 'http://10.0.0.5:3000');
    assert.equal(port.hostport, '10.0.0.5:3000');
    assert.equal(parseOrigin('ssh://git@git.example.org:2222/lab/rh.git').base, 'https://git.example.org');
    assert.equal(parseOrigin('git@git.example.org:lab/rh.git').actions, 'https://git.example.org/lab/rh/actions');
    assert.equal(parseOrigin('https://example.org/gitea/lab/rh.git').actions, 'https://example.org/gitea/lab/rh/actions');
    assert.equal(parseOrigin('https://GitHub.com/o/r.git').kind, 'github');
    assert.equal(parseOrigin('C:/repos/rh'), null);
    assert.equal(parseOrigin(''), null);
});
```

2. Run it and watch it fail — `Cannot find module '../scripts/ci-status.js'`:

```
node --test tests/ci-status.test.js
```

3. Write the implementation, the whole of `scripts/ci-status.js`:

   In `scripts/ci-status.js`:

```js
#!/usr/bin/env node
'use strict';
// scripts/ci-status.js: what CI said about one pushed commit, read once.
//
//   node scripts/ci-status.js <sha> [--root <dir>]
//
// Prints one line — `ci: success|failure|pending|none`, or `ci: unknown <url>`
// naming the Actions page to look at by hand — and exits 0 whatever CI said:
// land reads it after a push and never waits on it
// (docs/90-agent/plans/2026-11-01-professor-ci-tiers-design.md §2).
// The origin's host decides the API: github.com is read through `gh api`, any
// other host is taken to be Gitea and read over HTTPS at /api/v1. Gitea's
// credential is GITEA_TOKEN, else `git credential fill` for that host, asked
// at run time and never written or printed. `deps` is the seam the tests
// fake — git, gh, fetch, env; without one the real ones run, five seconds a
// call at most.
const { spawnSync } = require('node:child_process');
const { parseArgs } = require('node:util');

const TIMEOUT_MS = 5000;
const USAGE = 'usage: ci-status.js <sha> [--root <dir>]';

function spawnRun(bin) {
    return (args, opts) => {
        const o = opts || {};
        const r = spawnSync(bin, args, { cwd: o.cwd, input: o.input, env: o.env, encoding: 'utf8', timeout: TIMEOUT_MS, windowsHide: true });
        if (r.error) return { status: null, stdout: '', stderr: String(r.error.message || r.error) };
        return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
    };
}

// `https://[user@]host[:port]/[prefix/]owner/repo[.git]`, `ssh://git@host[:port]/owner/repo`
// or scp-style `git@host:owner/repo`. An ssh port is the ssh daemon's, not the
// web server's, so only an http(s) port is kept. A drive letter (`C:/x`) is a
// local path, not a host.
function parseOrigin(url) {
    const raw = String(url || '').trim();
    let host;
    let port = '';
    let scheme = 'https';
    let rest;
    const full = raw.match(/^(https?|ssh|git):\/\/(?:[^@/]+@)?([^/:]+)(?::(\d+))?\/(.+)$/);
    if (full) {
        host = full[2];
        if (full[1] === 'http' || full[1] === 'https') {
            scheme = full[1];
            port = full[3] ? ':' + full[3] : '';
        }
        rest = full[4];
    } else {
        const scp = raw.match(/^(?:[^@/]+@)?([^:/\\]{2,}):(?!\/\/)(.+)$/);
        if (!scp) return null;
        host = scp[1];
        rest = scp[2];
    }
    const parts = rest.replace(/\/+$/, '').replace(/\.git$/, '').split('/').filter(Boolean);
    if (parts.length < 2) return null;
    const repo = parts.pop();
    const owner = parts.pop();
    const prefix = parts.length ? '/' + parts.join('/') : '';
    const base = scheme + '://' + host + port + prefix;
    return {
        host, hostport: host + port, scheme, owner, repo,
        kind: host.toLowerCase() === 'github.com' ? 'github' : 'gitea',
        base, actions: base + '/' + owner + '/' + repo + '/actions',
    };
}

// A combined-status body, GitHub's or Gitea's — the same shape — as one word,
// or null for a body or state this cannot name.
function stateOf(body) {
    if (!body || typeof body !== 'object') return null;
    const statuses = Array.isArray(body.statuses) ? body.statuses : [];
    const total = Number.isFinite(body.total_count) ? body.total_count : statuses.length;
    if (total === 0) return 'none';
    if (body.state === 'success') return 'success';
    if (body.state === 'failure' || body.state === 'error') return 'failure';
    if (body.state === 'pending') return 'pending';
    return null;
}

function github(o, sha, ctx) {
    const r = ctx.gh(['api', 'repos/' + o.owner + '/' + o.repo + '/commits/' + sha + '/status'], { cwd: ctx.cwd });
    if (r.status !== 0) return null;
    try {
        return stateOf(JSON.parse(r.stdout));
    } catch (e) {
        return null;
    }
}

// Asked only when the token is missing or refused. Prompts are off so a
// missing helper fails in milliseconds instead of waiting on a terminal or a
// Credential Manager dialog nobody is looking at.
function credential(o, ctx) {
    const r = ctx.git(['credential', 'fill'], {
        cwd: ctx.cwd,
        input: 'protocol=' + o.scheme + '\nhost=' + o.hostport + '\n\n',
        env: { ...ctx.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' },
    });
    if (r.status !== 0) return null;
    const field = (k) => (r.stdout.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1];
    const password = field('password');
    if (!password) return null;
    return 'Basic ' + Buffer.from((field('username') || '') + ':' + password).toString('base64');
}

async function getJson(ctx, url, auth) {
    try {
        const res = await ctx.fetch(url, { headers: { Accept: 'application/json', Authorization: auth }, signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        return null;
    }
}

async function gitea(o, sha, ctx) {
    const url = o.base + '/api/v1/repos/' + encodeURIComponent(o.owner) + '/' + encodeURIComponent(o.repo) + '/commits/' + encodeURIComponent(sha) + '/status';
    const tries = [
        () => (ctx.env.GITEA_TOKEN ? 'token ' + ctx.env.GITEA_TOKEN : null),
        () => credential(o, ctx),
    ];
    for (const next of tries) {
        const auth = next();
        if (!auth) continue;
        const state = stateOf(await getJson(ctx, url, auth));
        if (state) return state;
    }
    return null;
}

async function main(argv, deps) {
    let parsed;
    try {
        parsed = parseArgs({ args: argv, allowPositionals: true, options: { root: { type: 'string' } } });
    } catch (e) {
        return { text: USAGE, code: 2 };
    }
    if (parsed.positionals.length !== 1) return { text: USAGE, code: 2 };
    const d = deps || {};
    const cwd = parsed.values.root || process.cwd();
    const ctx = { git: d.git || spawnRun('git'), gh: d.gh || spawnRun('gh'), fetch: d.fetch || globalThis.fetch, env: d.env || process.env, cwd };
    const remote = ctx.git(['remote', 'get-url', 'origin'], { cwd });
    const o = remote.status === 0 ? parseOrigin(remote.stdout) : null;
    if (!o) return { text: 'ci: unknown', code: 0 };
    const rev = ctx.git(['rev-parse', '--verify', parsed.positionals[0] + '^{commit}'], { cwd });
    const sha = rev.status === 0 ? rev.stdout.trim() : parsed.positionals[0];
    const state = o.kind === 'github' ? github(o, sha, ctx) : await gitea(o, sha, ctx);
    return { text: state ? 'ci: ' + state : 'ci: unknown ' + o.actions, code: 0 };
}

if (require.main === module) {
    main(process.argv.slice(2)).then((out) => {
        process.stdout.write(out.text + '\n');
        process.exitCode = out.code;
    });
}

module.exports = { main, parseOrigin };
```

4. Run it and watch it pass:

```
node --test tests/ci-status.test.js
```

5. Smoke it against this repository's own origin (github.com); any of the five words is a pass, a stack trace or a non-zero exit is not:

```
node scripts/ci-status.js HEAD
```

6. Stage and commit:

```
git add scripts/ci-status.js tests/ci-status.test.js
git commit -m "feat: ci-status.js reads CI for a pushed commit" -m "- one ci: line from gh api or Gitea /api/v1, exit 0 — scripts/ci-status.js
- GITEA_TOKEN then git credential fill, never printed — scripts/ci-status.js"
```

## Task 2: land step 7 — PR by host, `ci:` beside `suite:`

**Files:**
- Modify: `skills/fankeel-land/SKILL.md` — step 7's `**PR:**` paragraph, a new after-push paragraph, the `## Output` block and its explanation
- Modify: `tests/skill-size.test.js` — the `'fankeel-land'` cap line only
- Test: `tests/land-ci.test.js`

**Interfaces:**
- Consumes: `ci-status.js` from Task 1 — `node <plugin>/scripts/ci-status.js <sha>` — one line `ci: success|failure|pending|none|unknown[ <url>]`, exit 0
- Produces: the land report's `ci:` line, after `suite:`, present only when this land pushed

**Dispatch:** implementer, opus — the floor for this architectural task.

1. Write the failing test, the whole of `tests/land-ci.test.js`:

   In `tests/land-ci.test.js`:

```js
'use strict';
// skills/fankeel-land/SKILL.md step 7 (docs/90-agent/plans/2026-11-01-professor-ci-tiers-design.md §2):
// a PR opens by the origin's host, and after any push ci-status.js's one line
// goes on the report beside `suite:`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const flat = fs.readFileSync(path.join(__dirname, '..', 'skills', 'fankeel-land', 'SKILL.md'), 'utf8').replace(/\s+/g, ' ');
const seven = flat.slice(flat.indexOf('## 7. Execute'), flat.indexOf('## Output'));

test('fankeel-land step 7 opens the PR by the origin host', () => {
    assert.match(seven, /`github\.com` → `gh pr create --base <base> --head <branch> --fill`/);
    assert.match(seven, /`tea pulls create --base <base> --head <branch> --title "<subject>"` when `tea` is on PATH/);
    assert.match(seven, /`https:\/\/<host>\/<owner>\/<repo>\/compare\/<base>\.\.\.<branch>`/);
});

test('fankeel-land reads CI once after a push and never waits on it', () => {
    assert.match(seven, /`node <plugin>\/scripts\/ci-status\.js <sha>`/);
    assert.match(seven, /never waits, and land never stops on it/);
    assert.match(seven, /neither is written or printed/);
});

test('the land report carries the ci line beside suite', () => {
    const out = flat.slice(flat.indexOf('## Output'));
    assert.match(out, /suite: <suite\.js line> ci: <ci-status\.js line, after a push>/);
    assert.match(out, /`ci:` from step 7 when this land pushed; no push, no line/);
});
```

2. Run it and watch it fail:

```
node --test tests/land-ci.test.js
```

3. In `skills/fankeel-land/SKILL.md`, step 7, replace the two lines that read

   In `skills/fankeel-land/SKILL.md`, old text:

```md
**PR:** push, open it against the base, report the URL. **Keep the worktree** —
PR feedback gets fixed there.
```

   with, in `skills/fankeel-land/SKILL.md`:

```md
**PR:** push, then open it against the base by the origin's host
(`git remote get-url origin`): `github.com` → `gh pr create --base <base> --head <branch> --fill`;
any other host is Gitea → `tea pulls create --base <base> --head <branch> --title "<subject>"`
when `tea` is on PATH, else print
`https://<host>/<owner>/<repo>/compare/<base>...<branch>` for the user to open.
Report the URL. **Keep the worktree** — PR feedback gets fixed there.

**After any push** — a PR, or a merge the profile pushes — run
`node <plugin>/scripts/ci-status.js <sha>` once, `<sha>` the commit pushed. It
prints one line, `ci: success`, `failure`, `pending`, `none` or
`unknown <Actions URL>`, and exits 0: it never waits, and land never stops on it.
A Gitea origin reads `GITEA_TOKEN`, else `git credential fill` for that host;
neither is written or printed.
```

4. In `skills/fankeel-land/SKILL.md`, `## Output`: in the fenced report, on the line after `suite: <suite.js line>`, add `ci: <ci-status.js line, after a push>`; in the paragraph under it, replace `` `suite:` from step 1, and `紀錄:` with the `filed:` `` with `` `suite:` from step 1, `ci:` from step 7 when this land pushed; no push, no line, and `紀錄:` with the `filed:` ``. The block then reads, in `skills/fankeel-land/SKILL.md`:

```md
suite: <suite.js line>
ci: <ci-status.js line, after a push>
紀錄: <filed: line>
```

5. Measure and raise the cap. Run `node scripts/input-check.js --skills`, read `skills/fankeel-land/SKILL.md`'s byte count, and in `tests/skill-size.test.js` change only the line `'fankeel-land': 24200,` to the smallest multiple of 100 above that count (for 25 130 bytes, `'fankeel-land': 25200,`). No other line of that file changes.

6. Run it and watch it pass, with the two gates the skill text touches:

```
node --test tests/land-ci.test.js tests/skill-size.test.js tests/skills.test.js
node scripts/skills-check.js
```

7. Commit:

```
git add tests/land-ci.test.js
git commit -am "feat: land opens PRs by host and reads CI after push" -m "- gh pr create, tea pulls create or a compare URL — skills/fankeel-land/SKILL.md
- ci-status.js line beside suite: after a push — skills/fankeel-land/SKILL.md"
```

## Task 3: `assets/ci/nightly.yml` — the nightly tier as a template

**Files:**
- Modify: `assets/ci/nightly.yml` — new file: Gitea Actions `on: schedule` workflow that fetches fankeel and runs `suite.js --nightly`
- Modify: `docs/02-architecture/layout.md` — the `assets/` tree row names `ci/nightly.yml`
- Test: `tests/ci-nightly.test.js`

**Interfaces:**
- Consumes: `scripts/suite.js --nightly` from group A (index row A; A's plan Task 2 makes it run with no `--session` and write no record, exit 0 green, 1 red); the `.fankeel/suite.json` format from index row A; no code of group A is read here
- Produces: the path `<plugin>/assets/ci/nightly.yml`, which Task 4's init text names

**Dispatch:** implementer, opus — the floor for this architectural task.

1. Write the failing test, the whole of `tests/ci-nightly.test.js`:

   In `tests/ci-nightly.test.js`:

```js
'use strict';
// assets/ci/nightly.yml (docs/90-agent/plans/2026-11-01-professor-ci-tiers-design.md §3):
// a Gitea Actions schedule that runs suite.json's nightly tier through
// `node <plugin>/scripts/suite.js --nightly` — no session, no record (group A)
// — and that fankeel itself never writes into a project.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const text = fs.readFileSync(path.join(ROOT, 'assets', 'ci', 'nightly.yml'), 'utf8');

test('the template is a schedule with a manual trigger and no secrets', () => {
    assert.match(text, /^on:\r?\n {2}schedule:\r?\n {4}- cron: "0 18 \* \* \*"/m);
    assert.match(text, /^ {2}workflow_dispatch:/m);
    assert.doesNotMatch(text, /secrets\./);
    assert.match(text, /fankeel never writes this file into a project/);
});

test('the template fetches fankeel and runs suite.js --nightly with no session', () => {
    assert.match(text, /git clone --depth 1 https:\/\/github\.com\/FanFantom9452\/FanKeel\.git "\$RUNNER_TEMP\/fankeel"/);
    assert.match(text, /^ {8}run: node "\$RUNNER_TEMP\/fankeel\/scripts\/suite\.js" --nightly$/m);
    assert.doesNotMatch(text, /--session/);
});

test('no code in lib, scripts or hooks names the template, so nothing copies it', () => {
    for (const sub of ['lib', 'scripts', 'hooks']) {
        for (const f of fs.readdirSync(path.join(ROOT, sub))) {
            const p = path.join(ROOT, sub, f);
            if (fs.statSync(p).isFile()) assert.ok(!fs.readFileSync(p, 'utf8').includes('nightly.yml'), sub + '/' + f);
        }
    }
});
```

2. Run it and watch it fail — `ENOENT` on `assets/ci/nightly.yml`:

```
node --test tests/ci-nightly.test.js
```

3. Write the template, the whole of `assets/ci/nightly.yml`:

   In `assets/ci/nightly.yml`:

```yaml
# fankeel's nightly tier as a Gitea Actions workflow — a template.
#
# fankeel never writes this file into a project. Copy it to
# .gitea/workflows/nightly.yml yourself, then add the install steps your daily
# workflow already has (setup-python, poetry install, npm ci, browsers) where
# the comment below says. `suite.js --nightly` runs every `nightly` entry of
# .fankeel/suite.json in order, each in its own `dir`, stops at the first red
# one, needs no fankeel session and writes no record.
name: Nightly

on:
  schedule:
    - cron: "0 18 * * *"   # 18:00 UTC = 02:00 Asia/Taipei
  workflow_dispatch:

jobs:
  nightly:
    name: Nightly tier
    runs-on: ubuntu-latest
    timeout-minutes: 90
    steps:
      - name: Check out repository
        uses: actions/checkout@v4
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "22"
      - name: Fetch fankeel
        run: git clone --depth 1 https://github.com/FanFantom9452/FanKeel.git "$RUNNER_TEMP/fankeel"
      # Add this project's install steps here, copied from its daily workflow.
      - name: Run the nightly tier
        run: node "$RUNNER_TEMP/fankeel/scripts/suite.js" --nightly
```

4. In `docs/02-architecture/layout.md`, line 106 (the `assets/` tree row), replace its ending `into a report the station serves` with `into a report the station serves; ci/nightly.yml, a Gitea Actions schedule that runs suite.js --nightly, which init points at and fankeel never copies into a project`. Only that row changes.

5. Run it and watch it pass:

```
node --test tests/ci-nightly.test.js
```

6. Commit:

```
git add assets/ci/nightly.yml tests/ci-nightly.test.js
git commit -am "feat: nightly tier template for Gitea Actions" -m "- on: schedule runs suite.js --nightly — assets/ci/nightly.yml
- tree row names it — docs/02-architecture/layout.md"
```

## Task 4: init reads CI workflows, drafts suite.json, asks about PRs once

**Files:**
- Modify: `agents/fankeel-init-scout.md` — Job reads workflows and origin; Return gains a `ci` status row and `suite` / `land pr` drafts
- Modify: `skills/fankeel-init/SKILL.md` — step 1 asks the PR question once and offers the suite.json draft; names the template
- Modify: `tests/skill-size.test.js` — the `'fankeel-init'` cap line only
- Read: `F:/ymlab/RH/.gitea/workflows/ci.yml` — the real workflow the scout's rule is checked against by eye in step 5; never modified
- Test: `tests/init-ci.test.js`

**Interfaces:**
- Consumes: `<plugin>/assets/ci/nightly.yml` from Task 3; the `.fankeel/suite.json` format from index row A
- Produces: scout return lines `ci` (status row: `github <host>`, `gitea <host>` or `local`, plus the workflow-file count), `suite daily|nightly <dir> — <run> — <path:line>`, a `.fankeel/suite.json` draft, and `land pr — origin <host> is <github|gitea>`

**Dispatch:** implementer, opus — the floor for this architectural task.

1. Write the failing test, the whole of `tests/init-ci.test.js`:

   In `tests/init-ci.test.js`:

```js
'use strict';
// agents/fankeel-init-scout.md and skills/fankeel-init/SKILL.md
// (docs/90-agent/plans/2026-11-01-professor-ci-tiers-design.md §3): the scout
// reads the CI workflows and drafts a suite.json it never writes; init asks
// once whether to push and open PRs, writes suite.json only after approval,
// and points at the nightly template without copying it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const flat = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\s+/g, ' ');
const scout = flat('agents/fankeel-init-scout.md');
const init = flat('skills/fankeel-init/SKILL.md');

test('the init scout reads CI workflows and the origin, read-only', () => {
    assert.match(scout, /`\.gitea\/workflows\/\*\.yml` and `\.github\/workflows\/\*\.yml`/);
    assert.match(scout, /`test`, `pytest` or `e2e`/);
    assert.match(scout, /`working-directory:` of its step/);
    assert.match(scout, /`git -C <root> remote get-url origin`/);
    assert.match(scout, /memory, worktrees, ci —/);
    assert.match(scout, /the five above/);
});

test('the init scout drafts suite lines and a suite.json it never writes', () => {
    assert.match(scout, /`suite daily\|nightly <dir> — <run> — <path:line>`/);
    assert.match(scout, /`--collect-only` line left out/);
    assert.match(scout, /which this scout never writes/);
    assert.match(scout, /`land pr — origin <host> is <github\|gitea>`/);
});

test('init asks once about PRs and writes suite.json only after approval', () => {
    assert.match(init, /`node <plugin>\/scripts\/task\.js profile set land\.integration pr --project <name>`/);
    assert.match(init, /`node <plugin>\/scripts\/task\.js profile set land\.push true --project <name>`/);
    assert.match(init, /only after the user approves it/);
    assert.match(init, /`<plugin>\/assets\/ci\/nightly\.yml`/);
    assert.match(init, /fankeel never writes it into a project/);
});
```

2. Run it and watch it fail:

```
node --test tests/init-ci.test.js
```

3. Edit `agents/fankeel-init-scout.md`.

   a. Under `## Job`, at the end of the bullet list that begins `Then read what they name:` (after the `every CLAUDE.md` bullet), add, in `agents/fankeel-init-scout.md`:

```md
- every `.gitea/workflows/*.yml` and `.github/workflows/*.yml` under `<root>`
  (Glob, then Read): each `run:` line naming `test`, `pytest` or `e2e`, with the
  `working-directory:` of its step — `.` where the step has none — and the
  origin, `git -C <root> remote get-url origin`.
```

   b. Under `## Return`, in the `status:` paragraph, change `docs.json, TODO, tree, CLAUDE.md, memory, worktrees — each` to `docs.json, TODO, tree, CLAUDE.md, memory, worktrees, ci — each`, and at the end of that paragraph add, in `agents/fankeel-init-scout.md`:

```md
The `ci` row names the origin — `github <host>` for `github.com`, `gitea <host>`
for any other host, `local` with no origin — and how many workflow files it read.
```

   c. Under `drafts:`, after the `<kind>: <path:line> ↔ <path:line>` bullet, add, in `agents/fankeel-init-scout.md`:

```md
- `suite daily|nightly <dir> — <run> — <path:line>` for each `run:` line the
  workflows hold, `nightly` where it names `e2e` or `nightly`, `daily` otherwise,
  a `--collect-only` line left out; then the same lines as one `.fankeel/suite.json`
  draft, `{ "daily": [{ "dir", "run" }], "nightly": [...] }`, which this scout never writes;
- `land pr — origin <host> is <github|gitea>` when the `ci` row is not `local`.
```

4. Edit `skills/fankeel-init/SKILL.md`, step 1: after the bullet list that begins `Then, whichever answer, two keys that carry this repository's own evidence:` (after its `commit.format` bullet, before `One more question belongs to the machine`), add, in `skills/fankeel-init/SKILL.md`:

```md
Where the scout drafted `land pr`, and `task.js profile show` does not already
read `land.integration` `pr` with `land.push` `true`, one `AskUserQuestion`:
**推送並開 PR** (recommended) or **照現在的設定**. The first runs
`node <plugin>/scripts/task.js profile set land.integration pr --project <name>`
and `node <plugin>/scripts/task.js profile set land.push true --project <name>`;
the second writes nothing. A rerun that finds both set does not ask again.

Where the scout drafted `suite` lines, show its `.fankeel/suite.json` draft and
write `<project>/.fankeel/suite.json` only after the user approves it, as
approved. Where the draft has a `nightly` tier, name
`<plugin>/assets/ci/nightly.yml`: a Gitea Actions schedule for that tier, which
the user copies into `.gitea/workflows/` if they want one — fankeel never writes
it into a project.
```

5. Check the scout's rule by eye against the real workflow (read only): applied to `F:/ymlab/RH/.gitea/workflows/ci.yml`, the drafts must come out as `suite daily apps/api — poetry run pytest — …`, `suite daily apps/web — npm test — …` and `suite nightly apps/web — npm run e2e — …`, with `poetry run pytest --collect-only` left out. If the text of step 3 would draft anything else, fix the text, not the file.

6. Measure and raise the cap. Run `node scripts/input-check.js --skills`, read `skills/fankeel-init/SKILL.md`'s byte count, and in `tests/skill-size.test.js` change only the line `'fankeel-init': 13100,` to the smallest multiple of 100 above that count (for 14 020 bytes, `'fankeel-init': 14100,`). No other line of that file changes.

7. Run it and watch it pass, with the tests that pin the scout's existing text:

```
node --test tests/init-ci.test.js tests/skill-size.test.js tests/agents.test.js tests/worktree-docs.test.js tests/init-docs.test.js
node scripts/skills-check.js
```

8. Commit:

```
git add tests/init-ci.test.js
git commit -am "feat: init drafts suite.json from CI workflows" -m "- workflow run: lines and origin, suite and land pr drafts — agents/fankeel-init-scout.md
- PR question once, suite.json on approval, nightly template named — skills/fankeel-init/SKILL.md"
```

## Coverage

| promise | task |
|---|---|
| 依 `git remote get-url origin` 判主機：`github.com` → `gh api repos/{o}/{r}/commits/{sha}/status`；其他主機視為 Gitea → `GET /api/v1/repos/{o}/{r}/commits/{sha}/status`。 | Task 1 |
| Gitea 認證三層退回：`GITEA_TOKEN` → `git credential fill`（host 為 origin 的主機，執行時才取，不寫檔、不印）→ 都失敗印 `ci: unknown <Actions 頁網址>`。 | Task 1 |
| 輸出 `ci: success\|failure\|pending\|none\|unknown`，unknown 附網址。 | Task 1 |
| land skill 步驟 7：開 PR 依主機分 `gh pr create` / `tea pulls create` / 印 compare 網址；推送後把 `ci:` 行放在報告 `suite:` 旁。 | Task 2 |
| `agents/fankeel-init-scout.md` 加一項：列出 `.gitea/workflows/*.yml`、`.github/workflows/*.yml` 中 `run:` 含 test/pytest/e2e 的行與其 `working-directory`，草擬一份 suite.json 給使用者確認，不自動寫入。 | Task 4 |
| init 偵測 origin 是 Gitea 或 GitHub 時問一次是否推送並開 PR，寫 `land.integration pr`、`land.push true`。 | Task 4 |
| `assets/ci/nightly.yml`：`on: schedule` 的範本，跑 suite.json 的 nightly 層；fankeel 不寫進任何專案，只在 init 報告裡指給使用者。 | Task 3 (the template), Task 4 (init names it) |
| `tests/ci-status.test.js`：假 origin 為 Gitea、無 token、credential 失敗 → 印 `ci: unknown https://…/actions`。 | Task 1 |
