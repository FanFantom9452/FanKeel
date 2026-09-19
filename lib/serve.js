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
const http = require('node:http');
const { spawn } = require('node:child_process');
const live = require('./live.js');

function serveRecordPath(configDir) {
    return path.join(String(configDir == null ? '' : configDir), 'fankeel', 'serve.json');
}

// Any failure — no file, a half-written temp, bytes that are not a JSON
// object — reads as no record, the same as no file at all.
function readServeRecord(configDir) {
    try {
        const data = JSON.parse(fs.readFileSync(serveRecordPath(configDir), 'utf8'));
        return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
    } catch (e) {
        return null;
    }
}

// Whether `record` names a station actually listening. A pid the OS already
// denies cannot be the one answering, so that is ruled out before the round
// trip; a live pid still has to be named by the record's own health route,
// which a recycled pid or a foreign listener on the port cannot do.
// `timeoutMs` bounds the whole request rather than the silence between two
// packets, because what it spends is a hook's wall clock; `agent: false`
// leaves no kept-alive socket behind to hold a short-lived process open.
// Never rejects: an error, the timeout, a status other than 200, a body that
// is not JSON or a pid that differs all resolve false.
function probe(record, timeoutMs) {
    const ms = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 500;
    return new Promise((resolve) => {
        let settled = false;
        let req = null;
        let timer = null;
        const done = (ok) => {
            if (settled) return;
            settled = true;
            if (timer) clearTimeout(timer);
            resolve(ok);
        };
        if (!record || typeof record.url !== 'string' || !live.running(record.pid)) return done(false);
        timer = setTimeout(() => {
            if (req) req.destroy();
            done(false);
        }, ms);
        try {
            req = http.get(record.url + 'station/health', { agent: false }, (res) => {
                let text = '';
                res.setEncoding('utf8');
                res.on('data', (c) => { text += c; });
                res.on('end', () => {
                    if (res.statusCode !== 200) return done(false);
                    let body;
                    try {
                        body = JSON.parse(text);
                    } catch (e) {
                        return done(false);
                    }
                    done(!!body && body.pid === record.pid);
                });
                res.on('error', () => done(false));
            });
        } catch (e) {
            return done(false);
        }
        req.on('error', () => done(false));
    });
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
    return (before ? probe(before, probeMs) : Promise.resolve(false)).then((alive) => {
        if (alive) return { state: 'running', url: before.url };
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

module.exports = { serveRecordPath, readServeRecord, probe, ensureServe };
