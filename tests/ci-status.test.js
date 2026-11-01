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
