'use strict';

// Whether a station is serving on this machine, and starting one when it is not.
//
// `scripts/station.js serve` writes `<configDir>/fankeel/serve.json` once it
// has bound a port — `{ pid, port, url, started }` — and deletes it when it
// closes. A record is only a claim: a hard kill leaves it behind, and a
// recycled pid or another program on the same port would pass a bare pid
// check, so `probe` is what turns the claim into an answer.
//
// `ensureServe` is what `hooks/inject.js` asks on a `/fankeel` prompt, inside
// a hook Claude Code kills at five seconds. So every wait here has a bound,
// nothing here rejects, and a wrong "not running" is the cheap direction: a
// second `serve` joins the first rather than binding a port of its own.

const fs = require('node:fs');
const path = require('node:path');
const { readObject } = require('./json.js');
const http = require('node:http');
const { spawn } = require('node:child_process');
const live = require('./live.js');

function serveRecordPath(configDir) {
    return path.join(String(configDir == null ? '' : configDir), 'fankeel', 'serve.json');
}

// Any failure — no file, a half-written temp, bytes that are not a JSON
// object — reads as no record, the same as no file at all.
function readServeRecord(configDir) {
    return readObject(serveRecordPath(configDir));
}

// What `lib/station.js` requires once at `scripts/station.js:37` and never
// reopens: an edit to it after a station has started is invisible to that
// process until it restarts. `fileStamp` turns "did this file change" into
// something a health response can carry over HTTP without shipping the
// file's own bytes: its size and its modified time together, the pair
// `fs.statSync` already gives for free. A file this cannot read — moved,
// deleted, a permissions error — reads as `'missing'` rather than throwing,
// the same "never rejects" this whole module holds to elsewhere.
function fileStamp(p) {
    try {
        const st = fs.statSync(p);
        return st.size + ':' + Math.round(st.mtimeMs);
    } catch (e) {
        return 'missing';
    }
}

// Three inputs, not the whole dependency graph. `lib/station.js` requires
// `lib/registry.js`, `lib/badge.js`, `lib/live.js`, `lib/prices.js`,
// `lib/stages.js`, `lib/profile.js` and `lib/detail.js` in turn
// (`lib/station.js:19-25`) — every one of them changes what a served page
// actually shows, so a fingerprint that wanted to catch every stale byte
// would stat all of them. It does not, on purpose: those seven files are
// touched by nearly every task in a build session, and killing a live
// station on each of those edits would drop whatever request it was
// mid-answering, for a server whose whole point is staying up through a
// session. `lib/station.js` itself and `assets/station/station.js` — the
// render entry point and the client script the browser runs — are what
// this fingerprint watches instead: the two files most likely to be the
// reason somebody is looking at a stale page. `package.json`'s `version`
// is the escape hatch — a maintainer who changed one of the seven excluded
// files and wants a clean restart anyway bumps it, rather than waiting for
// one of the two watched files to move.
function diskFingerprint(pluginDir) {
    const lib = fileStamp(path.join(String(pluginDir), 'lib', 'station.js'));
    const asset = fileStamp(path.join(String(pluginDir), 'assets', 'station', 'station.js'));
    const pkg = readObject(path.join(String(pluginDir), 'package.json'));
    const version = (pkg && pkg.version) || 'unknown';
    return lib + '|' + asset + '|' + version;
}

// The shared fetch behind `probe` and `ensureServe`'s staleness check:
// `null` for a pid the OS denies, a timeout, a connection error, a status
// other than 200, or a body that is not JSON; the parsed body otherwise,
// unchecked against what the caller expected it to say. `timeoutMs` bounds
// the whole request, as `probe` always has; `agent: false` leaves no
// kept-alive socket behind to hold a short-lived process open.
function fetchHealth(record, timeoutMs) {
    const ms = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 500;
    return new Promise((resolve) => {
        let settled = false;
        let req = null;
        let timer = null;
        const done = (body) => {
            if (settled) return;
            settled = true;
            if (timer) clearTimeout(timer);
            resolve(body);
        };
        if (!record || typeof record.url !== 'string' || !live.running(record.pid)) return done(null);
        timer = setTimeout(() => {
            if (req) req.destroy();
            done(null);
        }, ms);
        try {
            req = http.get(record.url + 'station/health', { agent: false }, (res) => {
                let text = '';
                res.setEncoding('utf8');
                res.on('data', (c) => { text += c; });
                res.on('end', () => {
                    if (res.statusCode !== 200) return done(null);
                    try {
                        done(JSON.parse(text));
                    } catch (e) {
                        done(null);
                    }
                });
                res.on('error', () => done(null));
            });
        } catch (e) {
            return done(null);
        }
        req.on('error', () => done(null));
    });
}

// Whether `record` names a station actually listening: a pid the OS
// already denies, a listener naming another pid, silence past
// `timeoutMs`, all resolve false. It does not look at a fingerprint —
// `ensureServe` runs that check itself, against `fetchHealth`'s body
// directly, rather than through `probe`.
function probe(record, timeoutMs) {
    return fetchHealth(record, timeoutMs).then((body) => !!body && body.pid === record.pid);
}

// `station.js serve` as a process of its own. Detached, with no stdio and no
// window, so it outlives what started it: the hook exits a moment later, and
// Claude Code may exit long before the station should. That it does outlive
// both is measured rather than assumed — the first test in tests/serve.test.js.
// `extra` is that test's, for a port of its own and an idle exit as a backstop.
function startServe(opts) {
    const o = opts || {};
    const args = [path.join(String(o.plugin), 'scripts', 'station.js'), 'serve']
        .concat(o.open ? ['--open'] : [], Array.isArray(o.extra) ? o.extra : []);
    const child = spawn(process.execPath, args, {
        detached: true, stdio: 'ignore', windowsHide: true, env: o.env || process.env,
    });
    child.on('error', () => { /* a spawn that failed; the caller sees no record */ });
    child.unref();
    return child.pid;
}

// The one question `/fankeel` asks. `running` when a recorded station answers
// the probe. Otherwise one is started with `--open` — so the browser opens
// exactly when this call started the station — and the answer is `started`
// once a record from another pid than the one read before appears, or
// `starting` if `until` comes first; `failed` is a start that threw, and `url`
// is null for those two and for `starting`. The probe waits `probeMs`, a
// second, and never past `until`. A live station too slow to answer inside it
// gets a second `serve`, which joins the first (`serve()` in
// scripts/station.js), so a wrong answer here costs one short-lived process and
// no port. `start` is a seam for the tests; production passes none.
function ensureServe(opts) {
    const o = opts || {};
    const until = Number.isFinite(o.until) ? o.until : Date.now() + 3000;
    const start = typeof o.start === 'function' ? o.start : startServe;
    const before = readServeRecord(o.configDir);
    const probeMs = Math.max(1, Math.min(Number.isFinite(o.probeMs) ? o.probeMs : 1000, until - Date.now()));
    return (before ? fetchHealth(before, probeMs) : Promise.resolve(null)).then((body) => {
        const alive = !!body && body.pid === before.pid;
        const stale = alive && typeof o.plugin === 'string' && o.plugin
            && diskFingerprint(o.plugin) !== body.fingerprint;
        if (alive && !stale) return { state: 'running', url: before.url };
        if (stale) {
            // A hard kill, not `close()`: nothing here waits for the old
            // station to notice, and its own `serve.json` cleanup only runs
            // on a graceful close — a killed process never reaches it — so
            // this removes the record itself. Without that, the fresh
            // `start()` below would spawn a `scripts/station.js serve` whose
            // own join check (`:297`, `probe(existing)` with no `pluginDir`)
            // would still see the pid answering for the instant before the
            // kill lands, and join the very station this was meant to
            // replace.
            try { process.kill(before.pid); } catch (e) { /* already gone */ }
            try { fs.unlinkSync(serveRecordPath(o.configDir)); } catch (e) { /* already gone */ }
        }
        try {
            start({ plugin: o.plugin, open: o.open !== false, extra: o.extra, env: o.env });
        } catch (e) {
            return { state: 'failed', url: null };
        }
        return new Promise((resolve) => {
            const look = () => {
                const now = readServeRecord(o.configDir);
                if (now && typeof now.url === 'string' && (!before || now.pid !== before.pid)) {
                    resolve({ state: 'started', url: now.url });
                    return;
                }
                if (Date.now() >= until) {
                    resolve({ state: 'starting', url: null });
                    return;
                }
                setTimeout(look, 50);
            };
            look();
        });
    }).catch(() => ({ state: 'failed', url: null }));
}

module.exports = { serveRecordPath, readServeRecord, probe, ensureServe, diskFingerprint };
