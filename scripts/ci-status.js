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
