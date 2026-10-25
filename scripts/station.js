#!/usr/bin/env node
'use strict';
// The station: every fankeel session on this machine, on one page.
//
//   node scripts/station.js [--root <dir>]... [--scan <dir>]... [--open]
//   node scripts/station.js serve [--port <n>] [--idle <minutes>] [--detach] [--root <dir>]... [--open]
//
// The first form writes `<configDir>/fankeel/index.html` and prints the path;
// `hooks/leave.js` runs the same write at every session end, so the file is
// current whenever it is opened. The second form is a server on 127.0.0.1 that
// renders on every request and takes a POST from the page's clear buttons.
// `--port` defaults to the fixed `28888` and falls back to an ephemeral one only
// when that is taken; `--idle` defaults to never exiting — give it a number of
// minutes to bring back the old idle-exit behaviour. A second `serve` against
// the same config directory joins the first, printing its URL, rather than
// binding a second port: `<configDir>/fankeel/serve.json` is what it reads to
// know. `--detach` runs the server as a background process and returns once
// that file appears, so closing the terminal does not take the station with
// it. `hooks/inject.js` starts one the same way on a `/fankeel` prompt when
// none answers (`ensureServe` in lib/serve.js); no session holds a port of its own.
// `--scan` walks a directory for registries once; what it finds is remembered
// in `<configDir>/fankeel/roots.json`, so it is run once per drive. With no
// roots.json at all — this config dir's first-ever run — every drive is
// scanned that way automatically, under a wall-clock budget rather than
// waiting for `--scan` to be typed; `--forget <dir>` is the other direction,
// dropping one remembered root now that a gone one is kept for good.
//
// Zero dependencies, as everywhere in this repository: `node:http` and a form.
// The per-run nonce is what stops a page on some other origin from posting to
// this port. The address is loopback, and with `station.remote` off every Host
// but loopback's is refused with 421; on, `tailscale serve` is the one way in
// from off this machine, and what it may reach is `policy` in lib/remote.js.
const fs = require('node:fs');
const path = require('node:path');
const { readObject } = require('../lib/json.js');
const http = require('node:http');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { parseArgsOrExit } = require('../lib/cli.js');
const station = require('../lib/station.js');
const registry = require('../lib/registry.js');
const live = require('../lib/live.js');
const { serveRecordPath, readServeRecord, probe, health, diskFingerprint } = require('../lib/serve.js');
const { readBody } = require('../lib/body.js');
const { clearEntry } = require('../lib/clear.js');
const profile = require('../lib/profile.js');
const handoff = require('../lib/handoff.js');
const board = require('../lib/board.js');
const docsearch = require('../lib/docsearch.js');
const detail = require('../lib/detail.js');
const compare = require('../lib/compare.js');
const spendrange = require('../lib/spendrange.js');
const conversation = require('../lib/conversation.js');
const { entriesOf, summarise } = require('../lib/usage.js');
const todoCheck = require('./todo-check.js');
const todoFiles = require('../lib/todo.js');
const remote = require('../lib/remote.js');
const tailscale = require('../lib/tailscale.js');
const qr = require('../lib/qr.js');
const notify = require('../lib/notify.js');
const os = require('node:os');
const mobile = require('../lib/mobile.js');
const phone = require('../lib/phone.js');
const view = require('../assets/station/station.js');

const PLUGIN = path.resolve(__dirname, '..');
const ASSETS = path.join(PLUGIN, 'assets', 'station');

// The files `serve` answers from ASSETS, by name: the page's own two, the
// language table, the phone page's two, every module lib/station.js reads
// off index.html (`station.MODULES`), and the tour (`tour.html` and what it
// loads). A list, so nothing else under the plugin directory is reachable
// by url.
const SERVED = ['station.js', 'i18n.js', 'station.css', 'mobile.js', 'mobile.css', ...station.MODULES];
const STATIC = new RegExp('^/station/(' + SERVED.map((n) => n.replace(/\./g, '\\.')).join('|') + '|tour(?:-[a-z]+)*\\.(?:js|css|html))$');
const TYPES = { '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8' };
const CHARTROOM = /^\/chartroom\/([^/?#]+)(.*)$/;
const SVG_CSP = { 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'" };

// `--root`/`--scan` are `multiple: true`: `values.root`/`values.scan` come
// back as an array of every occurrence, in order, rather than a hand-rolled
// `.push()` per token. `strict: true` is what refuses an unrecognised flag;
// the shapes it throws for — an unknown option, or a declared flag given no
// value — are caught in lib/cli.js and turned into the same
// `station: unknown argument <flag>` message and exit code this file has
// always used, so a script piping this CLI's stderr sees no difference.
// `serve` is the one positional this file reads; any other bare word is the
// same unknown-argument refusal.
const OPTIONS = {
    open: { type: 'boolean' },
    root: { type: 'string', multiple: true },
    scan: { type: 'string', multiple: true },
    forget: { type: 'string' },
    port: { type: 'string' },
    idle: { type: 'string' },
    detach: { type: 'boolean' },
    json: { type: 'boolean' },
};

function parseArgs(argv) {
    const { values, positionals } = parseArgsOrExit('station', argv, OPTIONS);
    const extra = positionals.filter((p) => p !== 'serve');
    if (extra.length) {
        process.stderr.write('station: unknown argument ' + extra[0] + '\n');
        process.exit(2);
    }
    return {
        verb: positionals.includes('serve') ? 'serve' : null,
        roots: values.root || [],
        scan: values.scan || [],
        open: Boolean(values.open),
        port: values.port !== undefined ? (Number(values.port) || 0) : 28888,
        portWasExplicit: values.port !== undefined,
        idleMs: values.idle !== undefined ? (Number(values.idle) || 10) * 60e3 : 0,
        forget: values.forget !== undefined ? values.forget : null,
        json: Boolean(values.json),
        detach: Boolean(values.detach),
    };
}

// Undoes what Task 6 made permanent: a root that has gone stays remembered
// forever, on purpose, so putting one down needs a name rather than a wait.
// Writes the same way `rememberRoots` does — a sibling, then a rename — since
// `hooks/leave.js` can rewrite this same file at any moment. Reads the file
// itself rather than through `station.readRoots` — that reader drops any
// value that is not an ISO-date string, which is exactly the shape of the
// `scannedAt` record, so building "before" from it would erase that record
// on every `--forget` call regardless of which root was named.
function forget(configDir, dir) {
    const target = path.resolve(dir);
    const file = station.rootsPath(configDir);
    const before = readObject(file) || {};
    const known = Object.prototype.hasOwnProperty.call(before, target);
    const after = Object.assign({}, before);
    delete after[target];
    fs.mkdirSync(path.dirname(file), { recursive: true });
    registry.writeAtomic(file, JSON.stringify(after, null, 2) + '\n');
    // Reported count is roots only, the same predicate `readRoots` filters
    // by — `scannedAt` is kept in the file above but is not one to list here.
    const left = Object.keys(after)
        .filter((k) => typeof after[k] === 'string' && Number.isFinite(Date.parse(after[k])))
        .sort();
    process.stdout.write((known ? 'forgot ' + target : target + ' was not remembered') + '\n'
        + (left.length ? left.length + ' remembered: ' + left.join(', ') : '0 remembered') + '\n');
}

// Five seconds is what a person will wait for a command they typed; anything
// the budget cuts short is still reachable by naming it with `--scan`. This
// runs only from `main()` below, never from `station.write()` — `hooks/inject.js`
// calls `write()` on every `/fankeel` prompt, and a walk measured at 10.7
// seconds for one drive would stall the prompt that triggered it.
const AUTO_BUDGET_MS = 5000;

// A directory the user named is not a directory nobody asked about, so `--scan`
// gets its own, longer budget: it is the escape hatch for whatever the
// automatic walk above could not reach, and a minute is what someone who typed
// a path will sit through. It is still a bound — before this, `--scan` ran with
// `deadline: Infinity`, so the walk had nothing but depth stopping it and the
// page's `the scan ran out of time` line could not be reached from here.
const SCAN_BUDGET_MS = 60000;

// One place the budget is turned into a deadline, because it is applied at two
// call sites — `main()` for a `--scan` typed on the command line, `serve()` once
// per request for a `--scan` it was started with — and two copies of
// `Date.now() + SCAN_BUDGET_MS` is how one of them quietly loses its bound. A
// run with nothing to scan gets no deadline: the walk it is not doing needs no
// clock, and `discover` reads an absent one as `Infinity` for the rest.
function scanDeadline(scan) {
    return scan && scan.length ? Date.now() + SCAN_BUDGET_MS : undefined;
}

// Every drive this machine has, each checked for existence rather than listed
// by any OS call — Node carries no dependency-free API for that, and an
// existence check on a drive letter is instant where walking one is not.
function driveRoots() {
    if (process.platform !== 'win32') return ['/'];
    const out = [];
    for (let c = 65; c <= 90; c++) {
        const root = String.fromCharCode(c) + ':' + path.sep;
        try {
            if (fs.existsSync(root)) out.push(root);
        } catch (e) { /* not a drive */ }
    }
    return out.length ? out : ['/'];
}

// One shared deadline across every drive, so a slow first drive leaves nothing
// for the rest rather than each getting its own five seconds.
function autoScan() {
    const started = Date.now();
    const deadline = started + AUTO_BUDGET_MS;
    const roots = [];
    let depthCuts = 0;
    let timedOut = false;
    for (const drive of driveRoots()) {
        const found = station.scanRoots(drive, undefined, { deadline });
        roots.push(...found.roots);
        depthCuts += found.depthCuts;
        if (found.timedOut) timedOut = true;
    }
    return { roots, depthCuts, timedOut, ms: Date.now() - started };
}

// The record of the first-run walk, written beside the roots so a reader can
// see when the machine was last swept and what stopped the sweep.
//
// It is not what stops a second walk. `main()` decides that on whether
// `roots.json` exists at all, and every `station.write()` — the `/fankeel`
// prompt's included — creates it. So the guard is the file, and this key is
// the record of what the file's creation replaced. `lib/station.js`'s
// `rememberRoots` carries every non-root key across, which is what keeps this
// one alive past the next hook; before it did, this record survived exactly
// until the first prompt after the scan.
function writeScanRecord(configDir, record) {
    const file = station.rootsPath(configDir);
    const data = readObject(file) || {};
    data.scannedAt = record;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    registry.writeAtomic(file, JSON.stringify(data, null, 2) + '\n');
}

// station-55: what a page load gets from a station whose code changed on disk
// after it started. The station is closing behind it; this polls the health
// route on the same origin until another pid answers, then reloads, so the
// tab lands on the fresh station without anyone pressing anything.
function restartPage(pid) {
    return '<!doctype html>\n<html lang="zh-Hant" data-fankeel-restart><head><meta charset="utf-8"><title>fankeel station</title></head><body>\n'
        + '<p>監控站的程式在磁碟上改了，正在重新啟動… / The station\'s code changed on disk; restarting…</p>\n'
        + '<script>(function poll(){fetch("/station/health",{cache:"no-store"}).then(function(r){return r.json();})'
        + '.then(function(b){if(b.pid!==' + Number(pid) + ')location.reload();else setTimeout(poll,300);},function(){setTimeout(poll,300);});})();</script>\n'
        + '</body></html>\n';
}

// station-55: the arguments a station hands its successor — its own, less
// `serve`, `--detach`, `--open` and any `--port`, plus the port it held, so
// the tab that asked reloads onto the same address and no second browser opens.
function successorArgs(argv, port) {
    const out = [];
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === 'serve' || a === '--detach' || a === '--open' || a.startsWith('--port=')) continue;
        if (a === '--port') { i++; continue; }
        out.push(a);
    }
    return out.concat(['--port', String(port)]);
}

function openInBrowser(target) {
    const [cmd, args] = process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '', target]]
        : process.platform === 'darwin' ? ['open', [target]] : ['xdg-open', [target]];
    try {
        spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    } catch (e) {
        process.stderr.write('station: could not open a browser; open ' + target + ' yourself\n');
    }
}

// The one write behind 記成 TODO. The entry goes under `## Needs a decision` in
// the project's TODO.md, and only once `scripts/todo-check.js`'s own `check()`
// has passed it: the line is put into a copy of the file, written beside the
// file so its link resolves from the same directory against the same
// `docs.json`, and any problem the copy has that the file had not is the
// refusal, named. todo-check exports only the whole-file check, and that is
// the point: the rules stay in one place.
function addTodo(file, entry) {
    if (!entry.trim()) return { status: 400, text: 'empty entry — nothing to write' };
    let text;
    try {
        text = fs.readFileSync(file, 'utf8');
    } catch (e) {
        return { status: 404, text: 'no TODO.md at ' + file };
    }
    const lines = text.split('\n');
    const at = lines.findIndex((l) => /^##\s+Needs a decision\s*$/.test(l));
    if (at < 0) return { status: 409, text: 'no "## Needs a decision" heading in ' + file };
    let put = at + 1;
    while (put < lines.length && !/^#{1,6}\s/.test(lines[put])) put++;
    while (put > at + 1 && !lines[put - 1].trim()) put--;
    const next = lines.slice(0, put).concat(['- ' + entry], lines.slice(put)).join('\n');
    const copy = path.join(path.dirname(file), '.TODO.station-' + process.pid + '.md');
    const key = (p) => p.kind + '\n' + p.detail;
    try {
        fs.writeFileSync(copy, next);
        const had = new Map();
        for (const p of todoCheck.check(file).problems) had.set(key(p), (had.get(key(p)) || 0) + 1);
        const seen = new Map();
        for (const p of todoCheck.check(copy).problems) {
            seen.set(key(p), (seen.get(key(p)) || 0) + 1);
            if (seen.get(key(p)) > (had.get(key(p)) || 0)) return { status: 400, text: p.kind + ' — ' + p.detail };
        }
    } finally {
        try { fs.unlinkSync(copy); } catch (e) { /* already gone */ }
    }
    registry.writeAtomic(file, next);
    return { status: 201, text: '- ' + entry };
}

// 記成 TODO where the project keeps entry files: the entry is written through
// `lib/todo.js`'s `add`, the one writer, with the body the form sent, and the
// same before-and-after `check()` on the project directory decides — a
// problem the folder has now that it did not have before (a `thin body`, a
// dead link) is the refusal, and the file comes out again.
function addTodoFile(dir, text, link, body) {
    if (!String(text || '').trim()) return { status: 400, text: 'empty entry — nothing to write' };
    const key = (p) => p.kind + '\n' + p.detail;
    const had = new Map();
    for (const p of todoCheck.check(dir).problems) had.set(key(p), (had.get(key(p)) || 0) + 1);
    let made;
    try {
        made = todoFiles.add(dir, Object.assign(todoFiles.fromLine(text, link, 'decision'), { body: String(body || '').trim() }));
    } catch (e) {
        return { status: 400, text: e.message };
    }
    const seen = new Map();
    for (const p of todoCheck.check(dir).problems) {
        seen.set(key(p), (seen.get(key(p)) || 0) + 1);
        if (seen.get(key(p)) > (had.get(key(p)) || 0)) {
            fs.unlinkSync(made.path);
            return { status: 400, text: p.kind + ' — ' + p.detail };
        }
    }
    return { status: 201, text: made.id };
}

async function serve(opts) {
    const configDir = opts.configDir || live.liveConfigDir();
    const gatherOpts = { configDir, roots: opts.roots || [], scan: opts.scan || [], cwd: process.cwd() };
    // The leads this call was given — its own `cwd`, `--root`, `--scan` —
    // written to `roots.json` however this call ends, joining an existing
    // station or binding a fresh one. `discover` re-reads that file on every
    // render, so on a join this is the whole point: the running server's next
    // render sees what only this call was told. `gather` is read-only;
    // `rememberRoots` is the one write, and its own failure is only
    // housekeeping — the join or the bind above it already succeeded.
    const rememberLeads = () => {
        try {
            const model = station.gather(Object.assign({}, gatherOpts, { deadline: scanDeadline(gatherOpts.scan) }));
            station.rememberRoots(configDir, model.registries, Date.now());
        } catch (e) { /* housekeeping; the join or bind above already succeeded */ }
    };
    // A second `serve` against the same configDir joins the first rather than
    // binding a second port, and a busy one counts as there: `health` answers
    // `answered` for a station naming the recorded pid, `busy` for that pid
    // running while its health route times out mid-`gather()`, and `dead`
    // otherwise — a recycled pid, or a port some other process now holds.
    const existing = readServeRecord(configDir);
    if (existing && (await health(existing, 500)).state !== 'dead') {
        if (opts.open) openInBrowser(existing.url);
        rememberLeads();
        return { url: existing.url, close() {}, joined: true };
    }
    if (existing) {
        // A record naming a dead pid, or a live pid whose port answers as
        // something other than this station, must not outlive this check — a
        // second call reading it before this one rebinds would see the same
        // stale answer.
        try { fs.unlinkSync(serveRecordPath(configDir)); } catch (e) { /* already gone */ }
    }
    const nonce = crypto.randomBytes(16).toString('hex');
    // docs/90-agent/plans/2026-10-21-station-remote-design.md §1-§2: the
    // tailnet address `tailscale serve` gives this port while the machine
    // profile's `station.remote` is on and Tailscale agreed. `dnsName` null is
    // remote off, and then every Host but loopback's is refused. `boundPort` is
    // the first port bound — the fixed-port retry leaves the proxy where it
    // is — and `recordData` the last record written, rewritten when this moves.
    let tailnet = { on: false, dnsName: null, url: null, warning: null };
    let boundPort = null;
    // Whether this run's `ensureServe` made the proxy (`already: false`). Only
    // then does the station take it down: one found already there was put up
    // by someone else, or by a run that will not come back for it.
    let madeServe = false;
    let recordData = null;
    // One timestamp for this run, reused by `/station/health` and every write
    // of `serve.json` below — a record rewritten once the fixed-port retry
    // succeeds names the same start time as its first write, not the moment
    // the retry happened to land.
    const started = new Date().toISOString();
    // Computed once, not per request — the same reasoning as `started`
    // above. A `lib/station.js` or `assets/station/station.js` edited after
    // this process started serving is invisible to it either way: the
    // require cache holds what was on disk at `:37` and `:44`. Recomputing
    // this on every `/station/health` request would answer a question the
    // files on disk can no longer help this process answer honestly.
    const fingerprint = diskFingerprint(PLUGIN);
    // station-55: `/fankeel` is not the only one who asks whether this process
    // is running old code — a page load from this machine asks too, below in
    // the handler, when `opts.onStale` is given (only `main()` gives it; the
    // tests that call `serve()` in-process do not). `restart` answers nothing
    // itself: the request that found the change has its page already, and
    // this closes every listener and `serve.json`, waits for the port to be
    // free, and hands it to `onStale`, which starts the successor on it.
    let closeAll = null;
    let restarting = false;
    const stale = () => diskFingerprint(PLUGIN) !== fingerprint;
    const restart = () => {
        if (restarting || !closeAll) return;
        restarting = true;
        const port = recordData ? recordData.port : boundPort;
        const open = [server, fixedServer].filter((s) => s && s.listening);
        const closed = open.map((s) => new Promise((r) => { s.once('close', r); }));
        closeAll();
        // Node 22 closes idle keep-alive sockets on close(); one still busy
        // gets two seconds to finish before it is cut.
        const force = setTimeout(() => { for (const s of open) s.closeAllConnections(); }, 2000);
        force.unref();
        Promise.all(closed).then(() => {
            clearTimeout(force);
            opts.onStale(port);
        });
    };
    // What this server remembers between requests: every session's detail,
    // held while `keyOf` says nothing under it moved (`detailOf` in
    // lib/detail.js). The page re-reads the list every three seconds and the
    // detail it shows while its session is live; without this each re-read
    // parsed every cached detail on the machine again.
    const memo = new Map();
    // The focus page's payloads (lib/station.js `focusOf`), held per session
    // while the files they were read from keep their mtimes, and the registry
    // root each session id was last found under. Neither runs gather().
    const focusMemo = new Map();
    const focusRoots = new Map();
    const focusRoot = (id) => {
        const known = focusRoots.get(id);
        const there = (r) => { const f = registry.sessionPath(r, id); return Boolean(f) && fs.existsSync(f); };
        if (known && there(known)) return known;
        // `--scan` walks are left out: a root they found is in roots.json already.
        const root = station.discover(Object.assign({}, gatherOpts, { scan: [] })).roots.find(there) || null;
        if (root) focusRoots.set(id, root);
        return root;
    };
    // The one conversation last asked for, read once and held while `keyOf`
    // says its transcript has not moved: turning a page must not parse a
    // 20 MB transcript again.
    let talked = null;
    // Every session row the 花費 page's range report has read, by transcript,
    // held while `keyOf` says its files have not moved (lib/spendrange.js).
    const spendMemo = new Map();
    // Every Chartroom handler this run has built, one per registry root,
    // each on that root's first `/chartroom/<name>/` request; `close()`
    // below closes them all.
    const boards = new Map();
    // Held across gathers by lib/station.js: each inactive session's row while
    // its entry file and transcript stat the same, and each build directory's
    // file count for a minute (`rowMemo`, `buildMemo` in `gather()`).
    const rowMemo = new Map();
    const buildMemo = new Map();
    // A deadline is an absolute moment, so it is taken per request rather than
    // once at listen: a `--scan` here is re-walked on every render, and one
    // timestamp fixed at startup would leave every later request walking with a
    // deadline already spent. The transcript budget is `write()`'s: past it a
    // request answers from what is cached and the next one carries on, so a
    // cache from an older VERSION is read again a few sessions at a time rather
    // than all in one request the page gives up on.
    const modelNow = (extra) => station.gather(Object.assign({}, gatherOpts,
        { deadline: scanDeadline(gatherOpts.scan), memo, rowMemo, buildMemo, detailBudgetMs: station.DETAIL_BUDGET_MS }, extra));
    // What `/station/station-data.js`, `/station/search` and an ended
    // session's `/station/detail/<id>.js` answer from: one gather() for every
    // request inside `memoMs`, dropped sooner when any registry's sessions/
    // directory moves — every entry write renames a file into it. The window
    // stays: a live session's transcript and agents move without the registry
    // moving. gather() is synchronous, so requests arriving together are served
    // one after another and all but the first read this. A POST drops it.
    const memoMs = Number.isFinite(opts.memoMs) ? opts.memoMs : 2000;
    let shared = null;
    // The roots the last gather found: the stamp is taken before the next
    // gather runs, when only these are known.
    let known = [];
    const stampOf = (roots) => roots.map((root) => {
        try {
            return fs.statSync(path.join(registry.stateDir(root), 'sessions')).mtimeMs;
        } catch (e) {
            return 0;
        }
    }).join(',');
    const sharedModel = () => {
        if (shared && Date.now() - shared.at < memoMs && stampOf(known) === shared.stamp) return shared.model;
        // Stamped before the gather, so an entry written while it runs reads
        // as moved on the next request instead of as already seen. A first
        // gather, or one that found other roots, can only be stamped after.
        const before = stampOf(known);
        const model = modelNow();
        const roots = model.registries.map((r) => r.root);
        const same = roots.length === known.length && roots.every((r, i) => r === known[i]);
        known = roots;
        shared = { at: Date.now(), model, stamp: same ? before : stampOf(roots) };
        return model;
    };
    let timer = null;
    let server;
    let fixedServer = null;
    const touch = () => {
        if (timer) { clearTimeout(timer); timer = null; }
        if (!(opts.idleMs > 0)) return;
        timer = setTimeout(() => {
            teardownRemote();
            server.close();
            // Off by default: `serve()` is also called in-process by tests
            // (station-cli, station-detail, station-todo), and an idle exit
            // there would end that whole test file's own process rather than
            // a station's — silently, with exit code 0, so `node --test`
            // reports no failure and the file's remaining tests simply never
            // ran. Only `main()`'s own `serve` verb — the real `--idle`
            // flag — opts in.
            if (opts.exitOnIdle === true) process.exit(0);
        }, opts.idleMs);
    };
    // Named rather than inline, so a second `http.createServer` — the
    // fixed-port retry below — answers with the same routes rather than a
    // stub that only occupies the port.
    const handler = async (req, res) => {
        touch();
        const url = new URL(req.url, 'http://127.0.0.1');
        // One way to answer: status, an optional content type, the body, and
        // any further headers. A 303 passes `null` for the type and no body.
        const send = (code, type, body, headers) => {
            res.writeHead(code, Object.assign(type ? { 'content-type': type } : {}, headers));
            res.end(body);
        };
        const fail = (code, msg) => send(code, 'text/plain', msg + '\n');
        const noStore = { 'cache-control': 'no-store' };
        const redirect = (to) => send(303, null, undefined, { location: to });
        // docs/90-agent/plans/2026-10-21-station-remote-design.md §1, §3: who
        // is asking. Off, only loopback is answered — a DNS-rebinding page's
        // Host is refused here too. Through the tailnet, `remote.policy`
        // decides: the phone page and pairing are open, the card's own routes
        // are this machine's, and the rest needs a paired device's cookie; every
        // POST from there also needs the tailnet Origin.
        const kind = remote.hostKind(req.headers, tailnet.on ? tailnet.dnsName : null);
        if (!kind) return fail(421, 'this station answers on 127.0.0.1 only');
        let device = null;
        if (kind === 'tailnet') {
            const rule = remote.policy(req.method, url.pathname);
            // The policy reads the normalised pathname, the Chartroom hand-off
            // below the raw url: `/chartroom/p/../../station/x` is `device` to
            // one and Chartroom's to the other, so either refuses it here.
            if (rule === 'local' || CHARTROOM.test(req.url) || CHARTROOM.test(url.pathname)) return fail(403, 'this route answers on this machine only');
            if (req.method === 'POST' && !remote.sameOrigin(req.headers, tailnet.dnsName)) return fail(403, 'wrong origin');
            if (rule === 'device') {
                device = remote.deviceFor(configDir, remote.tokenOf(req.headers.cookie), Date.now());
                if (!device) return fail(401, 'pair this phone first: scan the QR on the station\'s 手機遠端 card');
            }
        }
        if (req.method === 'POST') shared = null;
        // `/chartroom/<name>/…` is a registry root's architecture board,
        // handed to Chartroom before the nonce check below, on purpose:
        // only loopback gets here — any other Host, the tailnet's included,
        // was refused above — and Chartroom guards its own routes besides: a
        // POST whose Origin does not match its Host or whose body is not
        // application/json is refused, which a page on another origin cannot
        // get past, while the AI posting ops from a shell has no nonce to
        // send. `<name>` is the root's folder name. With `station.chartroom`
        // unset this is the ordinary 404 at the end.
        const chartroomHit = CHARTROOM.exec(req.url);
        const chartroomRoot = chartroomHit && profile.read(null, configDir).values['station.chartroom'];
        if (chartroomRoot) {
            let name;
            try { name = decodeURIComponent(chartroomHit[1]); } catch (e) { name = chartroomHit[1]; }
            const roots = sharedModel().registries.filter((r) => !r.gone && path.basename(r.root) === name).map((r) => r.root);
            if (roots.length === 0) return fail(404, 'no registered project is named ' + name);
            if (roots.length > 1) return fail(409, 'two registered projects are named ' + name + ': ' + roots.join(', '));
            let board = boards.get(roots[0]);
            if (!board) {
                const file = station.boardPath(roots[0]);
                if (!fs.existsSync(file)) return fail(404, 'no architecture board here: put one at ' + file);
                const entry = path.join(chartroomRoot, 'src', 'server', 'handler.js');
                try {
                    board = require(entry).createHandler(file, { staticDir: 'dist/app' });
                } catch (e) {
                    return fail(500, 'Chartroom did not load from ' + entry + ': ' + e.message);
                }
                boards.set(roots[0], board);
            }
            const rest = chartroomHit[2];
            req.url = rest.startsWith('/') ? rest : '/' + rest;
            return board(req, res);
        }
        // Every POST carries the nonce this server printed, or — through the
        // tailnet, where the nonce is no key — a paired device's cookie, checked
        // above. One with neither is refused before its form is read further;
        // null tells the route to stop.
        const formOf = async () => {
            const form = new URLSearchParams(await readBody(req));
            if (device || form.get('nonce') === nonce) return form;
            fail(403, 'wrong nonce: open the page this server printed and try again');
            return null;
        };
        // The routes that act on one registry of the page read the form and find
        // that registry the same way. Null when the nonce refused it, which has
        // already answered; `reg` is undefined when no registry matched, and
        // each route says that in its own 404.
        const formAndRegistry = async () => {
            const form = await formOf();
            if (!form) return null;
            const reg = modelNow().registries.find((r) => r.root === path.resolve(form.get('root') || ''));
            return { form, reg };
        };
        // Through the tailnet `/` is the phone's page (design §4); this
        // machine's own browser keeps the desktop page there.
        if (kind === 'tailnet' && req.method === 'GET' && url.pathname === '/') return redirect('/m');
        // station-55: a page load from this machine is where a station finds
        // out its code moved under it. Through the tailnet `/` is the phone's
        // and the health route is closed, so only loopback asks.
        if (req.method === 'GET' && kind === 'loopback' && typeof opts.onStale === 'function' && closeAll
            && (url.pathname === '/' || url.pathname.startsWith('/f/')) && (restarting || stale())) {
            res.on('finish', restart);
            return send(200, 'text/html; charset=utf-8', restartPage(process.pid), noStore);
        }
        if (req.method === 'GET' && url.pathname === '/') {
            let html;
            try {
                html = station.render();
            } catch (e) {
                // Unlike a missing `station.css` or `station.js` below — one
                // asset gone — a shell that will not read means the plugin's
                // whole `assets/station/` directory is missing or unreadable,
                // and the reason says that rather than naming a single file.
                return fail(404, 'no such asset: this plugin\'s assets directory is missing or unreadable');
            }
            return send(200, 'text/html; charset=utf-8', html, noStore);
        }
        if (req.method === 'GET' && url.pathname === '/station/station-data.js') {
            // Per request, which is what keeps the header's promise that a
            // served page re-reads the registries on every load. `?cleared=N`
            // is what `/clear-stale` redirects with, and the only thing this
            // server takes from a query string: digits only, because anything
            // else is somebody's typing and the page says nothing rather than
            // echoing it into a script.
            const said = url.searchParams.get('cleared');
            const cleared = said !== null && /^\d+$/.test(said) ? Number(said) : undefined;
            return send(200, 'text/javascript; charset=utf-8', station.serialize(sharedModel(), { serve: true, nonce, plugin: PLUGIN, cleared }), noStore);
        }
        if (req.method === 'GET' && url.pathname === '/station/search') {
            // The 文件 page's full-text box. The page bodies stay on disk; the
            // answer is at most 20 hits with a snippet each (lib/docsearch.js).
            const out = docsearch.search(docsearch.searchDirs(sharedModel()), url.searchParams.get('q') || '');
            return send(200, 'application/json; charset=utf-8', JSON.stringify(out), noStore);
        }
        if (req.method === 'GET' && url.pathname === '/station/docs-health') {
            // station-38: the 文件 page's health matrix. A sweep per project is
            // seconds, so scripts/docs-health.js keeps the answer ten minutes;
            // the page's 重新檢查 asks with ?fresh=1.
            const out = require('./docs-health.js').cached(docsearch.searchDirs(sharedModel()), Date.now(), url.searchParams.get('fresh') === '1');
            return send(200, 'application/json; charset=utf-8', JSON.stringify(out), noStore);
        }
        if (req.method === 'GET' && url.pathname === '/station/doc') {
            // The reader's text: a tracked .md of a project on this page, or 404.
            const text = require('./docs-health.js').readDoc(docsearch.searchDirs(sharedModel()), url.searchParams.get('pkey') || '', url.searchParams.get('path') || '');
            if (text === null) return fail(404, 'no such document on this page');
            return send(200, 'text/markdown; charset=utf-8', text, noStore);
        }
        if (req.method === 'GET' && url.pathname === '/station/suggest') {
            // station-39: the quick setup's preselected answers, for a project
            // this page already lists — the same known-directory check POST /profile makes.
            const want = path.resolve(url.searchParams.get('project') || '');
            const reg = modelNow().registries.find((r) => Object.keys(r.profiles || {}).some((p) => path.resolve(p) === want));
            if (!reg) return fail(404, 'no such project on this page');
            const out = require('../lib/settingsuggest.js').suggestFor(want, reg.root, configDir, Date.now());
            return send(200, 'application/json; charset=utf-8', JSON.stringify(out), noStore);
        }
        if (req.method === 'GET' && url.pathname === '/station/spend') {
            // The 花費 page's range report (lib/spendrange.js): every
            // transcript under this server's config dir, chosen by
            // lib/compare.js's rule, so its total is the one
            // scripts/usage-compare.js prints for the same range. The first
            // request reads every transcript; `spendMemo` makes the next ones
            // read only what moved.
            let range;
            try {
                range = compare.parseRange(String(url.searchParams.get('from')) + '..' + String(url.searchParams.get('to')));
            } catch (e) {
                return fail(400, e.message);
            }
            const n = Number(url.searchParams.get('top'));
            let out;
            try {
                out = spendrange.report(gatherOpts.configDir, range, { memo: spendMemo, top: Number.isInteger(n) && n > 0 && n <= 50 ? n : 10 });
            } catch (e) {
                return fail(500, e.message);
            }
            return send(200, 'application/json; charset=utf-8', JSON.stringify(out), noStore);
        }
        const talk = /^\/station\/talk\/([0-9A-Za-z-]+)(?:\/(agents)|\/agent\/([0-9a-f]+))?$/.exec(url.pathname);
        if (req.method === 'GET' && talk) {
            // The 對話 tab: one page of a session's turns (lib/conversation.js)
            // and the counts of the whole conversation, read from the config
            // dir that session recorded. Not part of any written copy: the
            // full text stays on this machine and is read per request.
            // `/agents` is every dispatch's live state, `/agent/<agentId>`
            // one sub-agent's own transcript (lib/talkacts.js).
            const talkacts = require('../lib/talkacts.js');
            const { runningAgents, sessionDirOf, agentFiles } = require('../lib/usage.js');
            const row = sharedModel().registries.flatMap((r) => r.sessions).find((s) => s.sessionId === talk[1]);
            const file = detail.transcriptOf(row && row.configDir ? row.configDir : gatherOpts.configDir, talk[1]);
            if (!file) {
                return fail(404, 'no transcript for that session');
            }
            const dir = sessionDirOf(file);
            if (talk[3]) {
                const own = agentFiles(dir).find((f) => path.basename(f) === 'agent-' + talk[3] + '.jsonl');
                if (!own) return fail(404, 'no transcript for that agent');
                const lines = entriesOf(own);
                if (!lines) return fail(500, 'cannot read that agent transcript');
                const meta = readObject(path.join(path.dirname(own), 'agent-' + talk[3] + '.meta.json')) || {};
                const view = talkacts.agentView(conversation.turnsOf(lines, { tools: true, sidechain: true }), {
                    id: talk[3], agentType: meta.agentType, description: meta.description, model: meta.model,
                    running: runningAgents(dir, Date.now()).some((a) => a.id === talk[3]),
                });
                return send(200, 'application/json; charset=utf-8', JSON.stringify(view), noStore);
            }
            const key = detail.keyOf(file);
            if (!talked || talked.id !== talk[1] || talked.key !== key) {
                const stats = { unparsed: 0 };
                const entries = entriesOf(file, stats);
                if (!entries) {
                    return fail(500, 'cannot read that transcript');
                }
                const read = conversation.turnsOf(entries, { acts: true });
                read.skipped.unparsed = stats.unparsed;
                // What each compaction and each cache rewrite after an hour
                // away cost (lib/conversation.js `spendOf`), read once with
                // the turns and held with them.
                read.spend = conversation.spendOf(entries, summarise(file, { series: true }));
                talked = { id: talk[1], key, read };
            }
            const running = runningAgents(dir, Date.now());
            if (talk[2]) {
                // Linked on a copy: linkAgents only moves running to finished,
                // so linking the cached turns would keep a woken agent finished.
                const acts = structuredClone(talked.read.turns.filter((t) => t.kind === 'act'));
                talkacts.linkAgents(acts, dir, running);
                const agents = acts.flatMap((t) => t.agents)
                    .map((a) => ({ id: a.id, agentId: a.agentId, state: a.state }));
                return send(200, 'application/json; charset=utf-8', JSON.stringify({ agents }), noStore);
            }
            const from = Number(url.searchParams.get('from'));
            const page = conversation.pageOf(talked.read, from, conversation.PAGE);
            page.turns = structuredClone(page.turns);
            talkacts.linkAgents(page.turns, dir, running);
            return send(200, 'application/json; charset=utf-8', JSON.stringify(page), noStore);
        }
        // docs/90-agent/plans/2026-10-21-station-focus-design.md §1: one
        // session's plan or gate alone, drawn from a script that holds that
        // session and nothing else. A tab the focus page does not draw opens
        // the full station on it.
        const focusPage = /^\/f\/([0-9A-Za-z-]+)\/([a-z]+)\/?$/.exec(url.pathname);
        if (req.method === 'GET' && focusPage) {
            const html = station.focusShell(focusPage[1], focusPage[2]);
            if (!html) return redirect('/#/s/' + focusPage[1] + '/' + focusPage[2]);
            return send(200, 'text/html; charset=utf-8', html, noStore);
        }
        const focusData = /^\/station\/focus\/([0-9A-Za-z-]+)\.js$/.exec(url.pathname);
        if (req.method === 'GET' && focusData) {
            const root = focusRoot(focusData[1]);
            const got = root ? station.focusOf(root, focusData[1], { memo: focusMemo }) : null;
            if (!got) return fail(404, 'no session ' + focusData[1]);
            return send(200, 'text/javascript; charset=utf-8', station.serializeFocus(root, got, { serve: true, nonce, plugin: PLUGIN, configDir }), noStore);
        }
        const wanted = /^\/station\/detail\/([0-9A-Za-z-]+)\.js$/.exec(url.pathname);
        if (req.method === 'GET' && wanted) {
            // One session's detail, the script `write()` leaves beside the
            // data file, rendered from a model rather than read off disk. An
            // ended session's comes from the shared model — nothing under it
            // moves. An active one's is gathered for this request, because its
            // transcript and agents move inside the shared window; `rowMemo`
            // holds every inactive row, so that gather costs the live ones.
            const find = (model) => model.registries.flatMap((r) => r.sessions).find((s) => s.sessionId === wanted[1]);
            let hit = find(sharedModel());
            if (!hit || hit.state !== 'down' || !hit.detail) hit = find(modelNow({ details: wanted[1] }));
            if (!hit || !hit.detail) {
                return fail(404, 'no detail for that session');
            }
            return send(200, 'text/javascript; charset=utf-8', station.serializeDetail(hit), noStore);
        }
        const shotOf = /^\/station\/shot\/([0-9A-Za-z-]+)\.png$/.exec(url.pathname);
        if (req.method === 'GET' && shotOf) {
            // The design gate's mockup screenshot for the 關卡 tab: a file://
            // image does not load in a page served over http. The path is the
            // one lib/gatereport.js put on the gate, never the request's, and it
            // has to resolve to a .png under that root's .fankeel/build/.
            const reg = modelNow({ details: shotOf[1] }).registries.find((r) => r.sessions.some((x) => x.sessionId === shotOf[1]));
            const hit = reg ? reg.sessions.find((x) => x.sessionId === shotOf[1]) : null;
            const mockup = hit && hit.gate && hit.gate.parts ? hit.gate.parts.mockup : null;
            const rel = mockup && mockup.shot ? mockup.shot.path : null;
            const build = reg ? path.resolve(reg.root, '.fankeel', 'build') + path.sep : '';
            const file = rel ? path.resolve(reg.root, rel) : '';
            if (!file || !file.startsWith(build) || path.extname(file) !== '.png') return fail(404, 'no mockup shot for that session');
            let body;
            try {
                body = fs.readFileSync(file);
            } catch (e) {
                return fail(404, 'no mockup shot for that session');
            }
            return send(200, 'image/png', body, noStore);
        }
        const boardOf = /^\/station\/board\/([0-9A-Za-z-]+)\/([^/]+)\.svg$/.exec(url.pathname);
        if (req.method === 'GET' && boardOf) {
            // A task's .board drawn to SVG for its session card (lib/board.js).
            // No nonce, like the shot above: a GET that writes nothing. The
            // name has to pass board.NAME and resolve directly inside that
            // session's own build directory; a board that does not parse is
            // 422 with the parser's message. The CSP is for the full SVG opened
            // in its own tab, where an SVG could otherwise run script.
            const hit = modelNow({ details: false }).registries.flatMap((r) => r.sessions).find((x) => x.sessionId === boardOf[1]);
            const file = hit ? board.boardFile(hit.boardDir, boardOf[2]) : null;
            if (!file) return fail(404, 'no such board for that session');
            let text;
            try {
                text = fs.readFileSync(file, 'utf8');
            } catch (e) {
                return fail(404, 'no such board for that session');
            }
            let svg;
            try {
                svg = await board.renderBoard(text);
            } catch (e) {
                return e && e.name === 'ParseError' ? send(422, 'text/plain; charset=utf-8', e.message + '\n') : fail(500, 'cannot draw that board: ' + (e && e.message));
            }
            return send(200, 'image/svg+xml', svg, Object.assign({}, SVG_CSP, noStore));
        }
        // The 手機遠端 card on #/settings (docs/90-agent/plans/2026-10-21-station-remote-design.md
        // §3). These four answer loopback only — `remote.policy` refuses them
        // through the tailnet above. The code shown is the live one, minted
        // when none is; the QR is the pairing url that code makes.
        if (req.method === 'GET' && url.pathname === '/station/remote') {
            const v = profile.read(null, configDir).values;
            const code = tailnet.on ? remote.liveCode(configDir, Date.now()) : null;
            return send(200, 'application/json; charset=utf-8', JSON.stringify({
                on: v['station.remote'] === true,
                active: tailnet.on,
                url: tailnet.url,
                dnsName: tailnet.dnsName,
                warning: tailnet.warning,
                code: code ? code.value : null,
                until: code ? code.until : null,
                pairUrl: code ? tailnet.url + 'm#/pair/' + code.value : null,
                devices: remote.devicesOf(configDir),
                notify: {
                    server: v['notify.server'] || null,
                    topic: v['notify.topic'] || null,
                    gate: v['notify.gate'] === true,
                    stage: v['notify.stage'] === true,
                    end: v['notify.end'] === true,
                },
            }), noStore);
        }
        if (req.method === 'GET' && url.pathname === '/station/remote/qr.svg') {
            if (!tailnet.on) return fail(409, 'remote is off: nothing to pair with');
            const code = remote.liveCode(configDir, Date.now());
            const svg = qr.qrSvg(tailnet.url + 'm#/pair/' + code.value);
            if (!svg) return fail(500, 'the pairing url is too long for a QR');
            return send(200, 'image/svg+xml', svg, Object.assign({}, SVG_CSP, noStore));
        }
        if (req.method === 'POST' && url.pathname === '/station/remote/code') {
            if (!await formOf()) return;
            if (!tailnet.on) return fail(409, 'remote is off: nothing to pair with');
            const code = remote.newCode(configDir, Date.now());
            return send(201, 'application/json; charset=utf-8', JSON.stringify({ code: code.value, until: code.until }), noStore);
        }
        if (req.method === 'POST' && url.pathname === '/station/remote/revoke') {
            const form = await formOf();
            if (!form) return;
            return remote.revoke(configDir, form.get('id') || '') ? send(200, 'text/plain; charset=utf-8', 'revoked\n') : fail(404, 'no such device');
        }
        // The phone's side: a live code for a device token, set as a cookie for
        // a year. Only through the tailnet (its Origin was checked above); it
        // reads its own form, since it has neither a nonce nor a cookie yet.
        if (req.method === 'POST' && url.pathname === '/station/remote/pair') {
            if (kind !== 'tailnet') return fail(403, 'pair from the phone, through the tailnet address');
            const form = new URLSearchParams(await readBody(req));
            const got = remote.pair(configDir, form.get('code') || '', form.get('name') || '', Date.now());
            if (!got.ok) return fail(403, got.reason);
            return send(201, 'application/json; charset=utf-8', JSON.stringify({ device: got.device }), Object.assign({ 'set-cookie': remote.cookieFor(got.token) }, noStore));
        }
        if (req.method === 'GET' && url.pathname === '/station/health') {
            // Read-only and identifies the process, nothing else — no nonce,
            // so `probe` above (and a `--detach` poll) can tell a live station
            // from a recycled pid or a foreign listener without fetching one.
            // `fingerprint` is what lets `ensureServe` tell a live station
            // from a live station running old code — the same pid, a
            // different answer to "what is on disk right now."
            return send(200, 'application/json', JSON.stringify({ station: true, pid: process.pid, started, fingerprint }));
        }
        // The phone station (lib/mobile.js; assets/station/mobile.js). The
        // shell, the manifest and the icon are built, not files; the service
        // worker is assets/station/sw.js served from the root, so its scope
        // can be the whole origin.
        if (req.method === 'GET' && url.pathname === '/m') {
            return send(200, 'text/html; charset=utf-8', mobile.shell(), noStore);
        }
        if (req.method === 'GET' && url.pathname === '/m/manifest.webmanifest') {
            return send(200, 'application/manifest+json', mobile.manifest(), noStore);
        }
        if (req.method === 'GET' && url.pathname === '/m/icon.svg') {
            return send(200, 'image/svg+xml', mobile.icon(), noStore);
        }
        if (req.method === 'GET' && url.pathname === '/sw.js') {
            let body;
            try {
                body = fs.readFileSync(path.join(ASSETS, 'sw.js'), 'utf8');
            } catch (e) {
                return fail(404, 'no such asset');
            }
            return send(200, 'text/javascript; charset=utf-8', body, Object.assign({ 'service-worker-allowed': '/' }, noStore));
        }
        if (req.method === 'GET' && url.pathname === '/station/mobile.json') {
            // A few kilobytes the phone reads every 5 s — never station-data.js.
            // The machine is named by its tailnet name's first label while the
            // tailnet is on, by its hostname otherwise.
            const model = sharedModel();
            const host = (tailnet.on && tailnet.dnsName ? tailnet.dnsName.split('.')[0] : '') || os.hostname();
            const body = mobile.mobileModel(model, Date.now(), host, station.hiddenPkeys(model), phone.snapshot);
            body.notify = mobile.subscribeOf(profile.read(null, configDir).values);
            return send(200, 'application/json', JSON.stringify(body), noStore);
        }
        if (req.method === 'GET' && url.pathname === '/station/phone.json') {
            // One session's conversation, read every 2 s while its screen is open.
            const model = sharedModel();
            const got = mobile.phoneModel(model, url.searchParams.get('id') || '', Date.now(), station.hiddenPkeys(model), phone.snapshot);
            if (!got) return fail(404, 'no such session on this station');
            return send(200, 'application/json', JSON.stringify(got), noStore);
        }
        // The phone's three actions on a session (2026-10-22-mobile-session-design.md §4),
        // under the same device policy as /answer.
        const PHONE_ACT = /^\/phone\/(attach|detach|say)$/.exec(url.pathname);
        if (req.method === 'POST' && PHONE_ACT) {
            const got = await formAndRegistry();
            if (!got) return;
            const { form, reg } = got;
            const id = form.get('id') || '';
            const row = reg && reg.sessions.find((s) => s.sessionId === id);
            if (!row) return fail(404, 'no such session on this station');
            if (PHONE_ACT[1] === 'attach') {
                if (row.state !== 'live') return fail(409, 'that session is not running');
                phone.attach(reg.root, id, device ? device.name : 'this machine', Date.now());
                return send(201, 'text/plain; charset=utf-8', 'attached\n');
            }
            if (PHONE_ACT[1] === 'detach') {
                phone.detach(reg.root, id);
                return send(200, 'text/plain; charset=utf-8', 'detached\n');
            }
            const said = phone.say(reg.root, id, form.get('text'), Date.now());
            if (!said.ok) return fail(said.code, said.reason);
            return send(201, 'text/plain; charset=utf-8', 'waiting for the turn to end\n');
        }
        const file = req.method === 'GET' ? STATIC.exec(url.pathname) : null;
        if (file) {
            let body;
            try {
                body = fs.readFileSync(path.join(ASSETS, file[1]), 'utf8');
            } catch (e) {
                return fail(404, 'no such asset');
            }
            return send(200, TYPES[path.extname(file[1])], body, noStore);
        }
        if (req.method === 'POST' && url.pathname === '/clear') {
            const got = await formAndRegistry();
            if (!got) return;
            const { form, reg } = got;
            const id = form.get('id') || '';
            // The server has just measured liveness for the page; a row that is
            // live is not one the button is for, whatever the age rule says.
            const row = reg && reg.sessions.find((s) => s.sessionId === id);
            if (!row) {
                return fail(404, 'no such session on this page');
            }
            if (row.state === 'live') {
                return fail(409, 'that session is running; nothing to clear');
            }
            const out = clearEntry(reg.root, id, { force: form.get('force') === '1' });
            if (!out.ok && out.reason !== 'inactive') {
                return fail(409, 'not cleared: ' + out.reason + (out.age ? ' (last seen ' + out.age + ' ago; tick force)' : ''));
            }
            return redirect('/');
        }
        if (req.method === 'POST' && url.pathname === '/clear-stale') {
            const got = await formAndRegistry();
            if (!got) return;
            const { form, reg } = got;
            if (!reg) {
                return fail(404, 'no such registry on this page');
            }
            const force = form.get('force') === '1';
            let cleared = 0;
            const refused = [];
            for (const s of reg.sessions) {
                if (s.state !== 'stale') continue;
                const out = clearEntry(reg.root, s.sessionId, { force });
                if (out.ok) cleared += 1;
                else if (out.reason !== 'inactive') refused.push(s.sessionId + ': ' + out.reason);
            }
            if (refused.length) {
                return fail(409, 'cleared ' + cleared + '; refused ' + refused.length + '\n' + refused.join('\n'));
            }
            // Redirect-after-POST, so a refresh does not clear twice — and the
            // count travels in the query rather than in a body this response
            // does not have. `render` prints it above the control bar.
            return redirect('/?cleared=' + cleared);
        }
        if (req.method === 'POST' && url.pathname === '/todo') {
            const got = await formAndRegistry();
            if (!got) return;
            const { form, reg } = got;
            const row = reg && reg.sessions.find((s) => s.sessionId === form.get('id'));
            if (!row) {
                return fail(404, 'no such session on this page');
            }
            // The session's own project when it keeps a todo folder or a
            // TODO.md, and the registry's root otherwise.
            const own = path.join(reg.root, row.project || '');
            const dir = todoFiles.folderOf(own) || fs.existsSync(path.join(own, 'TODO.md')) ? own : reg.root;
            const out = todoFiles.folderOf(dir)
                ? addTodoFile(dir, form.get('text') || '', form.get('link') || '', form.get('body') || '')
                : addTodo(path.join(dir, 'TODO.md'), view.todoEntry(form.get('text') || '', form.get('link') || ''));
            return send(out.status, 'text/plain; charset=utf-8', out.text + '\n');
        }
        // A gate hooks/gate.js is holding (`gate.station`): the answer goes to
        // the file the hook is reading, in the shape hooks/resume.js writes.
        if (req.method === 'POST' && url.pathname === '/answer') {
            const got = await formAndRegistry();
            if (!got) return;
            const { form, reg } = got;
            const mine = reg ? registry.readSession(reg.root, form.get('id') || '') : null;
            if (!mine) {
                return fail(404, 'no such session on this page');
            }
            const pending = handoff.readPending(reg.root, mine);
            if (!pending) {
                return fail(409, 'no gate is waiting on the station for this session');
            }
            // 「交給終端／手機」: not an answer. The hook stops waiting and the
            // question goes to the terminal, where Remote Control carries it.
            const hand = form.get('handoff');
            if (hand !== null) {
                if (hand !== 'terminal') {
                    return fail(400, 'handoff is terminal');
                }
                handoff.writeAnswer(handoff.answerPath(reg.root, mine, mine.stage), JSON.stringify({ handoff: 'terminal' }) + '\n');
                return send(201, 'text/plain; charset=utf-8', 'handed to the terminal\n');
            }
            let answers = null;
            try { answers = JSON.parse(form.get('answers') || ''); } catch (e) { answers = null; }
            const asked = new Set(pending.questions.map((q) => q && q.question));
            const keys = answers && typeof answers === 'object' && !Array.isArray(answers) ? Object.keys(answers) : [];
            if (!keys.length || keys.some((k) => !asked.has(k) || typeof answers[k] !== 'string' || !answers[k].trim())) {
                return fail(400, 'answers maps each question asked to a non-empty answer');
            }
            // Every question asked, not some: a partial answer used to reach the
            // file, and the hook sent the gate out answered with the rest blank.
            if (keys.length !== asked.size) {
                return fail(400, 'answers every question asked — ' + asked.size + ' asked, ' + keys.length + ' answered');
            }
            handoff.writeAnswer(handoff.answerPath(reg.root, mine, mine.stage), JSON.stringify({ answers }, null, 2) + '\n');
            return send(201, 'text/plain; charset=utf-8', 'answered ' + keys.length + ' question' + (keys.length === 1 ? '' : 's') + '\n');
        }
        if (req.method === 'POST' && url.pathname === '/profile') {
            const form = await formOf();
            if (!form) return;
            const agentfile = require('../lib/agentfile.js');
            const scope = form.get('scope');
            let file;
            let want = null;
            if (scope === 'machine') file = profile.machineFile(configDir);
            else if (scope === 'project') {
                want = path.resolve(form.get('project') || '');
                const model = modelNow();
                const known = model.registries.some((r) => Object.keys(r.profiles || {}).some((p) => path.resolve(p) === want));
                if (!known) {
                    return fail(404, 'no such project on this page');
                }
                file = profile.projectFile(want);
            } else {
                return fail(400, 'scope is project or machine');
            }
            const keys = form.getAll('key');
            const values = form.getAll('value');
            if (!keys.length || keys.length !== values.length) {
                return fail(400, 'key and value come in pairs');
            }
            // Validate every pair before writing any, so a bad second key
            // does not leave the first one applied. An empty value clears the key.
            for (let i = 0; i < keys.length; i++) {
                const named = Object.prototype.hasOwnProperty.call(profile.KEYS, keys[i]) || Boolean(agentfile.agentKey(keys[i]));
                if (!named || (values[i] !== '' && profile.parseValue(keys[i], values[i]).error)) {
                    return fail(400, 'not a profile key/value: ' + keys[i] + '=' + values[i]);
                }
            }
            for (let i = 0; i < keys.length; i++) {
                const out = values[i] === '' ? profile.unset(file, keys[i]) : profile.write(file, keys[i], values[i]);
                if (!out.ok) {
                    return fail(409, out.reason);
                }
            }
            // station-39: the detailed page's agents table writes
            // agent.<name>.model|effort; the override file follows at once,
            // the way `task.js profile set` does it (scripts/task.js), once per agent.
            const synced = new Set();
            const unsynced = [];
            for (const k of keys) {
                const agent = agentfile.agentKey(k);
                if (!agent || synced.has(agent.name)) continue;
                synced.add(agent.name);
                const result = agentfile.syncAgent({
                    pluginRoot: PLUGIN, profileFile: file, name: agent.name, version: require('../package.json').version,
                    agentsDir: scope === 'machine' ? path.join(configDir, 'agents') : path.join(want, '.claude', 'agents'),
                });
                if (result.state === 'unmarked' || result.state === 'no-source') unsynced.push(agentfile.syncLine(result));
            }
            if (unsynced.length) return fail(409, 'profile saved, but ' + unsynced.join('\n'));
            // §5: the first trigger turned on gets a topic, so the card has
            // something to say to subscribe to. §2: a `station.remote` write
            // asks Tailscale again now, and its answer is in force from the
            // next request — off included, which takes down a proxy this run made.
            if (scope === 'machine') {
                const after = profile.read(null, configDir).values;
                const trigger = keys.some((k, i) => /^notify\.(gate|stage|end)$/.test(k) && String(values[i]).trim().toLowerCase() === 'true');
                if (keys.includes('station.remote')) refreshRemote();
                if (trigger && !after['notify.topic']) {
                    const out = profile.write(file, 'notify.topic', notify.newTopic());
                    if (!out.ok) return fail(409, out.reason);
                }
            }
            // The wizard posts from #/settings and wants to land there again;
            // anything but a bare page hash is ignored rather than followed.
            const back = String(form.get('back') || '');
            return redirect('/' + (/^#\/[a-z]*$/.test(back) ? back : ''));
        }
        fail(404, 'not here');
    };
    server = http.createServer(handler);
    // Factored so the first bind and the fixed-port retry below write the
    // exact same shape, rather than one drifting from the other. `url` is the
    // loopback address in every state — hooks/pane.ts accepts nothing else —
    // and the tailnet address, while there is one, sits beside it as `remote.url`,
    // or `remote.warning` when enabling it failed.
    const writeRecord = (data) => {
        recordData = data;
        const record = serveRecordPath(configDir);
        fs.mkdirSync(path.dirname(record), { recursive: true });
        const remote = tailnet.on ? { remote: { url: tailnet.url } } : (tailnet.warning ? { remote: { warning: tailnet.warning } } : {});
        fs.writeFileSync(record, JSON.stringify(Object.assign({}, data, remote), null, 2) + '\n');
        return record;
    };
    // The proxy this station made comes down with it (station-remote-1): when
    // `station.remote` is written off, when `close()` runs, and on the idle
    // exit. Never fatal — a failure is one stderr line and shutdown goes on.
    const teardownRemote = () => {
        if (!madeServe) return;
        madeServe = false;
        const off = tailscale.disable(opts.tailscaleRun);
        if (!off.ok) process.stderr.write('station: tailscale serve left on — ' + off.warning + '\n');
    };
    // Asks Tailscale again: at listen, and whenever `station.remote` is
    // written from the page. Never fatal — a warning on stderr and on the
    // card, and loopback keeps serving. Off takes down a proxy this run made.
    const refreshRemote = () => {
        const want = profile.read(null, configDir).values['station.remote'] === true;
        if (want && boundPort) {
            const got = tailscale.enable(boundPort, opts.tailscaleRun);
            tailnet = got.ok
                ? { on: true, dnsName: got.dnsName, url: got.url, warning: null }
                : { on: false, dnsName: null, url: null, warning: got.warning };
            if (got.ok && got.already === false) madeServe = true;
            if (!got.ok) {
                process.stderr.write('station: remote stays off — ' + got.warning + '\n');
                // station-remote-3 (b): a proxy this run made earlier must not
                // outlive the enable that just failed; a no-op when none was made.
                teardownRemote();
            }
        } else {
            tailnet = { on: false, dnsName: null, url: null, warning: null };
            teardownRemote();
        }
        if (recordData) writeRecord(recordData);
    };
    const result = await new Promise((resolve, reject) => {
        let usedFallback = false;
        server.on('error', (err) => {
            // The fixed default port can be held by another process — an
            // ordinary port conflict, not a station-related one. `serve.json`
            // joining above is what catches an actual second station; this is
            // only reached when no live one is recorded, so failing outright
            // would turn "something else is on 28888" into "the station cannot
            // start" rather than a station on a different port. A caller who
            // named the port with `--port` gets the real error instead: they
            // asked for that port specifically.
            if (err && err.code === 'EADDRINUSE' && !opts.portWasExplicit) {
                usedFallback = true;
                return server.listen(0, '127.0.0.1');
            }
            reject(err);
        });
        server.listen(opts.port || 0, '127.0.0.1', () => {
            const url = 'http://127.0.0.1:' + server.address().port + '/';
            // The proxy goes to the port bound first, and the fixed-port retry
            // below leaves it there: that listener stays open. Asked before
            // serve.json is first written — five seconds a call at most — so
            // the record `ensureServe` reads as `started` already carries
            // `remote`; refreshRemote writes nothing while recordData is unset.
            boundPort = server.address().port;
            refreshRemote();
            const record = writeRecord({ pid: process.pid, port: server.address().port, url, started });
            touch();
            if (opts.open) openInBrowser(url);
            let retryTimer = null;
            if (usedFallback) {
                // The fixed port was somebody else's a moment ago; it may free
                // up before this run ends. A timer is what turns "busy at
                // startup" into "rebinds once it frees" instead of a station
                // stuck on the ephemeral port for its whole run — `.unref()`
                // is what keeps `--idle` still exiting on time, since a bare
                // interval would hold the process open by itself.
                const tryFixed = () => {
                    const attempt = http.createServer(handler);
                    attempt.on('error', () => { attempt.close(); });
                    attempt.listen(opts.port, '127.0.0.1', () => {
                        clearInterval(retryTimer);
                        retryTimer = null;
                        fixedServer = attempt;
                        const fixedUrl = 'http://127.0.0.1:' + attempt.address().port + '/';
                        // The ephemeral listener above is left open on purpose:
                        // a browser tab already on its url must keep working
                        // even once the fixed port is the one `serve.json`
                        // names.
                        writeRecord({ pid: process.pid, port: attempt.address().port, url: fixedUrl, started });
                    });
                };
                retryTimer = setInterval(tryFixed, opts.retryMs || 30e3);
                retryTimer.unref();
            }
            resolve({
                url,
                close() {
                    if (timer) clearTimeout(timer);
                    if (retryTimer) clearInterval(retryTimer);
                    teardownRemote();
                    // Before the server: a board's open event streams would
                    // otherwise hold server.close() until they end.
                    for (const board of boards.values()) {
                        try { board.close(); } catch (e) { /* closing anyway */ }
                    }
                    boards.clear();
                    server.close();
                    if (fixedServer) fixedServer.close();
                    try { fs.unlinkSync(record); } catch (e) { /* already gone */ }
                },
            });
        });
    });
    closeAll = result.close;
    rememberLeads();
    return result;
}

// Ctrl+C runs close(), so the proxy this station made and serve.json go with
// it. A hard kill runs nothing; the reference page says how to take the proxy
// down by hand then. `proc` and `exit` are the seam tests/station-signal.test.js
// drives: on Windows a child cannot be sent a real SIGINT.
function closeOnSignals(s, proc = process, exit = (code) => process.exit(code)) {
    for (const sig of ['SIGINT', 'SIGTERM']) {
        proc.once(sig, () => { s.close(); exit(0); });
    }
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const configDir = live.liveConfigDir();
    // The rows, for a session that wants to read them rather than a page. It
    // walks nothing and writes nothing: `gather` builds the same model
    // `write` renders, from the same sources, and the first-run scan below
    // is the default form's — a five-second walk behind a flag a script
    // calls would be a surprise, not a service.
    if (args.json) {
        if (args.verb || args.forget) {
            process.stderr.write('station: --json prints the rows and takes no verb\n');
            process.exit(2);
        }
        const model = station.gather({
            configDir, roots: args.roots, scan: args.scan, cwd: process.cwd(),
            deadline: scanDeadline(args.scan),
            root: registry.findStateRoot(process.cwd()),
            // The rows, not the panel: a session's detail is a file of its own.
            details: false,
        });
        const hidden = station.hiddenPkeys(model);
        for (const r of model.registries) {
            r.sessions = r.sessions.filter((s) => !hidden.has(s.project ? r.root + '/' + s.project : r.root));
            const keep = {};
            for (const dir of Object.keys(r.profiles || {})) {
                const values = r.profiles[dir] && r.profiles[dir].values;
                if (!values || values['station.hide'] !== true) keep[dir] = r.profiles[dir];
            }
            r.profiles = keep;
        }
        process.stdout.write(JSON.stringify(model) + '\n');
        return;
    }
    if (args.forget) {
        forget(configDir, args.forget);
        return;
    }
    if (args.verb === 'serve' && args.detach) {
        // A station killed rather than closed leaves `serve.json` behind — a
        // hard kill never runs `close()` — so the poll below would read that
        // stale record on its very first tick, before a freshly spawned child
        // has replaced it. Probing first turns that into "nothing running,
        // spawn one" rather than a false positive the poll would otherwise
        // hand back before it ever ran.
        const record = readServeRecord(configDir);
        (record ? health(record, 500).then((h) => h.state !== 'dead') : Promise.resolve(false)).then((alive) => {
            if (alive) {
                process.stdout.write('fankeel station — ' + record.url + '\n');
                if (args.open) openInBrowser(record.url);
                return;
            }
            if (record) { try { fs.unlinkSync(serveRecordPath(configDir)); } catch (e) { /* already gone */ } }
            // Re-run this same script as a background process, with `--detach`
            // stripped so the child does not try to detach again. `serve` was
            // renamed off `verb` down to just what follows it, so the child sees
            // the same `serve` token this process did.
            let sawVerb = false;
            const rest = process.argv.slice(2).filter((a) => {
                if (a === '--detach') return false;
                if (a === 'serve' && !sawVerb) { sawVerb = true; return false; }
                return true;
            });
            spawn(process.execPath, [__filename, 'serve'].concat(rest), { windowsHide: true, detached: true, stdio: 'ignore' }).unref();
            const deadline = Date.now() + 5000;
            const poll = () => {
                const data = readServeRecord(configDir);
                if (data && data.url) {
                    process.stdout.write('fankeel station — ' + data.url + '\n');
                    if (args.open) openInBrowser(data.url);
                    return;
                }
                if (Date.now() >= deadline) {
                    process.stderr.write('station: did not start\n');
                    process.exit(1);
                }
                setTimeout(poll, 50);
            };
            poll();
        });
        return;
    }
    if (args.verb === 'serve') {
        serve({ configDir, roots: args.roots, scan: args.scan, port: args.port, idleMs: args.idleMs, open: args.open, portWasExplicit: args.portWasExplicit, exitOnIdle: true,
            onStale: (port) => {
                spawn(process.execPath, [__filename, 'serve'].concat(successorArgs(process.argv.slice(2), port)),
                    { detached: true, stdio: 'ignore', windowsHide: true }).unref();
                process.exit(0);
            } }).then((s) => {
            process.stdout.write('fankeel station — ' + s.url
                + (args.idleMs > 0 ? '  (exits after ' + Math.round(args.idleMs / 60e3) + ' idle minutes, or Ctrl+C)' : '  (Ctrl+C to exit)') + '\n');
            closeOnSignals(s);
        }, (e) => {
            process.stderr.write('station: could not listen: ' + (e && e.message) + '\n');
            process.exit(1);
        });
        return;
    }
    // "No roots.json at all" is what marks this configDir's first-ever run —
    // `rememberRoots` writes the file on every `write()`, hook-triggered ones
    // included, so once anything has run even once this stays false for good.
    const firstRun = !fs.existsSync(station.rootsPath(configDir));
    const scan = firstRun ? autoScan() : null;
    const out = station.write({
        configDir, roots: args.roots.concat(scan ? scan.roots : []), scan: args.scan, cwd: process.cwd(),
        // What `autoScan` just measured, handed to the page rather than only
        // printed below: `discover` never saw that walk, so without this the
        // header's two scan-cut lines are unreachable on a first run. A
        // `--scan` walk is `discover`'s own, and it is bounded here.
        scanStats: scan ? { depthCuts: scan.depthCuts, timedOut: scan.timedOut } : undefined,
        deadline: scanDeadline(args.scan),
        root: registry.findStateRoot(process.cwd()), plugin: PLUGIN,
        // Typed by a person, so every changed session is read, however long.
        detailBudgetMs: Infinity,
    });
    if (scan) {
        writeScanRecord(configDir, {
            at: new Date().toISOString(),
            roots: scan.roots.length,
            depthCuts: scan.depthCuts,
            timedOut: scan.timedOut,
            ms: scan.ms,
        });
        process.stdout.write('station: first run — scanned this machine\'s drives, found '
            + scan.roots.length + ' registr' + (scan.roots.length === 1 ? 'y' : 'ies')
            + (scan.timedOut ? ' (ran out of time)' : scan.depthCuts ? ' (depth cut it ' + scan.depthCuts + ' places)' : '')
            + '\n');
    }
    process.stdout.write('fankeel station — ' + out.file + '\n'
        + '  ' + out.registries + ' registries · ' + out.live + ' live, ' + out.stale + ' stale, ' + out.down + ' down'
        + (out.copy ? '  ·  copy at ' + out.copy : '') + '\n'
        + (out.hidden ? '  ' + out.hidden + ' project' + (out.hidden === 1 ? '' : 's') + ' hidden by station.hide\n' : ''));
    if (args.open) openInBrowser(out.file);
}

if (require.main === module) main();

module.exports = { serve, scanDeadline, parseArgs, probe, closeOnSignals, STATIC };
