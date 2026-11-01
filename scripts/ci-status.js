#!/usr/bin/env node
'use strict';
// scripts/ci-status.js: what CI said about one pushed commit, read once.
//
//   node scripts/ci-status.js <sha> [--root <dir>]
//
// Prints one line — `ci: success|failure|pending|none`, `ci: unknown <url>`
// naming the Actions page to look at by hand (` (token refused)` appended when
// every credential tried got a 401/403), or a bare `ci: unknown` with no
// origin — and exits 0 whatever CI said: land reads it after a push and never
// waits on it (docs/90-agent/plans/2026-11-01-professor-ci-tiers-design.md §2).
// github.com is read through `gh api`. GitLab, Bitbucket and Azure DevOps are
// not read at all. Any other host is taken to be Gitea, read at /api/v1 over
// https only — an http origin gets no request, so no credential crosses in
// plaintext. Gitea's credential is GITEA_TOKEN — sent only to GITEA_URL's
// host:port when that is set — else `git credential fill` for that host,
// never written or printed. `deps` is the seam the tests fake — git, gh,
// fetch, env; without one the real ones run, five seconds a call at most.
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

// ssh.github.com is GitHub's ssh-over-443 host: never Gitea, so never sent a credential.
const OTHER_FORGES = new Set(['gitlab.com', 'bitbucket.org', 'dev.azure.com', 'ssh.dev.azure.com', 'ssh.github.com']);

// A fully-qualified `github.com.` is the same host; without the strip it would read as Gitea and get a request.
function kindOf(host) {
    host = host.toLowerCase().replace(/\.$/, '');
    if (host === 'github.com') return 'github';
    if (OTHER_FORGES.has(host) || host.endsWith('.visualstudio.com')) return 'other';
    return 'gitea';
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
        kind: kindOf(host),
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

// Asked only when the token is missing, refused, or its answer was unusable. Prompts are off so a
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

const REFUSED = Symbol('refused');

async function getJson(ctx, url, auth) {
    try {
        const res = await ctx.fetch(url, { headers: { Accept: 'application/json', Authorization: auth }, signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (res.status === 401 || res.status === 403) return REFUSED;
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        return null;
    }
}

// GITEA_TOKEN goes to GITEA_URL's host:port only, when that is set; an
// unparseable GITEA_URL matches nothing.
function tokenFor(o, env) {
    if (!env.GITEA_TOKEN) return null;
    if (!env.GITEA_URL) return 'token ' + env.GITEA_TOKEN;
    try {
        return new URL(env.GITEA_URL).host === new URL(o.base).host ? 'token ' + env.GITEA_TOKEN : null;
    } catch (e) {
        return null;
    }
}

// A state word, 'refused' when every credential tried got a 401/403, or null.
async function gitea(o, sha, ctx) {
    const url = o.base + '/api/v1/repos/' + encodeURIComponent(o.owner) + '/' + encodeURIComponent(o.repo) + '/commits/' + encodeURIComponent(sha) + '/status';
    const tries = [() => tokenFor(o, ctx.env), () => credential(o, ctx)];
    let asked = 0;
    let refused = 0;
    for (const next of tries) {
        const auth = next();
        if (!auth) continue;
        asked++;
        const body = await getJson(ctx, url, auth);
        if (body === REFUSED) {
            refused++;
            continue;
        }
        const state = stateOf(body);
        if (state) return state;
    }
    return asked > 0 && refused === asked ? 'refused' : null;
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
    let state = null;
    if (o.kind === 'github') state = github(o, sha, ctx);
    else if (o.kind === 'gitea' && o.scheme === 'https') state = await gitea(o, sha, ctx);
    if (state === 'refused') return { text: 'ci: unknown ' + o.actions + ' (token refused)', code: 0 };
    return { text: state ? 'ci: ' + state : 'ci: unknown ' + o.actions, code: 0 };
}

if (require.main === module) {
    main(process.argv.slice(2)).then((out) => {
        process.stdout.write(out.text + '\n');
        process.exitCode = out.code;
    });
}

module.exports = { main, parseOrigin };
