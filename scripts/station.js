#!/usr/bin/env node
'use strict';
// The station: every fankeel session on this machine, on one page.
//
//   node scripts/station.js [--root <dir>]... [--scan <dir>]... [--open]
//   node scripts/station.js serve [--port <n>] [--idle <minutes>] [--root <dir>]... [--open]
//
// The first form writes `<configDir>/fankeel/station.html` and prints the path;
// `hooks/leave.js` runs the same write at every session end, so the file is
// current whenever it is opened. The second form is for clearing: a server on
// 127.0.0.1 that renders on every request, takes a POST from the page's clear
// button, and exits after `--idle` minutes without one. Nothing here is
// started for the user by anything else, and no session holds a port.
// `--scan` walks a directory for registries once; what it finds is remembered
// in `<configDir>/fankeel/roots.json`, so it is run once per drive. With no
// roots.json at all — this config dir's first-ever run — every drive is
// scanned that way automatically, under a wall-clock budget rather than
// waiting for `--scan` to be typed; `--forget <dir>` is the other direction,
// dropping one remembered root now that a gone one is kept for good.
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
const ASSETS = path.join(PLUGIN, 'assets', 'station');

function parseArgs(argv) {
    const out = { verb: null, roots: [], scan: [], open: false, port: 0, idleMs: 10 * 60e3, forget: null, json: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === 'serve' && out.verb === null) out.verb = 'serve';
        else if (a === '--open') out.open = true;
        else if (a === '--root' && argv[i + 1]) out.roots.push(argv[++i]);
        else if (a === '--scan' && argv[i + 1]) out.scan.push(argv[++i]);
        else if (a === '--forget' && argv[i + 1]) out.forget = argv[++i];
        else if (a === '--port' && argv[i + 1]) out.port = Number(argv[++i]) || 0;
        else if (a === '--idle' && argv[i + 1]) out.idleMs = (Number(argv[++i]) || 10) * 60e3;
        else if (a === '--json') out.json = true;
        else {
            process.stderr.write('station: unknown argument ' + a + '\n');
            process.exit(2);
        }
    }
    return out;
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
    let before;
    try {
        before = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        before = {};
    }
    if (!before || typeof before !== 'object' || Array.isArray(before)) before = {};
    const known = Object.prototype.hasOwnProperty.call(before, target);
    const after = Object.assign({}, before);
    delete after[target];
    const temp = file + '.' + process.pid + '.tmp';
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(temp, JSON.stringify(after, null, 2) + '\n');
    registry.renameRetrying(temp, file);
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
    const deadline = Date.now() + AUTO_BUDGET_MS;
    const roots = [];
    let depthCuts = 0;
    let timedOut = false;
    for (const drive of driveRoots()) {
        const found = station.scanRoots(drive, undefined, { deadline });
        roots.push(...found.roots);
        depthCuts += found.depthCuts;
        if (found.timedOut) timedOut = true;
    }
    return { roots, depthCuts, timedOut };
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
    let data;
    try {
        data = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        data = {};
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};
    data.scannedAt = record;
    const temp = file + '.' + process.pid + '.tmp';
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(temp, JSON.stringify(data, null, 2) + '\n');
    registry.renameRetrying(temp, file);
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
    const gatherOpts = { configDir, roots: opts.roots || [], scan: opts.scan || [], cwd: process.cwd() };
    // A deadline is an absolute moment, so it is taken per request rather than
    // once at listen: a `--scan` here is re-walked on every render, and one
    // timestamp fixed at startup would leave every later request walking with a
    // deadline already spent.
    const modelNow = () => station.gather(Object.assign({}, gatherOpts,
        { deadline: scanDeadline(gatherOpts.scan) }));
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
            let html;
            try {
                html = station.render();
            } catch (e) {
                // Unlike a missing `station.css` or `station.js` below — one
                // asset gone — a shell that will not read means the plugin's
                // whole `assets/station/` directory is missing or unreadable,
                // and the reason says that rather than naming a single file.
                res.writeHead(404, { 'content-type': 'text/plain' });
                res.end('no such asset: this plugin\'s assets directory is missing or unreadable\n');
                return;
            }
            res.writeHead(200, {
                'content-type': 'text/html; charset=utf-8',
                'cache-control': 'no-store',
            });
            res.end(html);
            return;
        }
        if (req.method === 'GET' && url.pathname === '/station-data.js') {
            // Per request, which is what keeps the header's promise that a
            // served page re-reads the registries on every load. `?cleared=N`
            // is what `/clear-stale` redirects with, and the only thing this
            // server takes from a query string: digits only, because anything
            // else is somebody's typing and the page says nothing rather than
            // echoing it into a script.
            const said = url.searchParams.get('cleared');
            const cleared = said !== null && /^\d+$/.test(said) ? Number(said) : undefined;
            res.writeHead(200, {
                'content-type': 'text/javascript; charset=utf-8',
                'cache-control': 'no-store',
            });
            res.end(station.serialize(modelNow(), { serve: true, nonce, plugin: PLUGIN, cleared }));
            return;
        }
        if (req.method === 'GET' && (url.pathname === '/station.css' || url.pathname === '/station.js')) {
            const name = url.pathname.slice(1);
            let body;
            try {
                body = fs.readFileSync(path.join(ASSETS, name), 'utf8');
            } catch (e) {
                res.writeHead(404, { 'content-type': 'text/plain' });
                res.end('no such asset\n');
                return;
            }
            res.writeHead(200, {
                'content-type': name.endsWith('.css')
                    ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8',
            });
            res.end(body);
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
            const model = modelNow();
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
        if (req.method === 'POST' && url.pathname === '/clear-stale') {
            const form = new URLSearchParams(await readBody(req));
            if (form.get('nonce') !== nonce) {
                res.writeHead(403, { 'content-type': 'text/plain' });
                res.end('wrong nonce: open the page this server printed and try again\n');
                return;
            }
            const model = modelNow();
            const reg = model.registries.find((r) => r.root === path.resolve(form.get('root') || ''));
            if (!reg) {
                res.writeHead(404, { 'content-type': 'text/plain' });
                res.end('no such registry on this page\n');
                return;
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
                res.writeHead(409, { 'content-type': 'text/plain' });
                res.end('cleared ' + cleared + '; refused ' + refused.length + '\n' + refused.join('\n') + '\n');
                return;
            }
            // Redirect-after-POST, so a refresh does not clear twice — and the
            // count travels in the query rather than in a body this response
            // does not have. `render` prints it above the control bar.
            res.writeHead(303, { location: '/?cleared=' + cleared });
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
        });
        process.stdout.write(JSON.stringify(model) + '\n');
        return;
    }
    if (args.forget) {
        forget(configDir, args.forget);
        return;
    }
    if (args.verb === 'serve') {
        serve({ configDir, roots: args.roots, scan: args.scan, port: args.port, idleMs: args.idleMs, open: args.open }).then((s) => {
            process.stdout.write('fankeel station — ' + s.url + '  (exits after '
                + Math.round(args.idleMs / 60e3) + ' idle minutes, or Ctrl+C)\n');
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
    });
    if (scan) {
        writeScanRecord(configDir, {
            at: new Date().toISOString(),
            roots: scan.roots.length,
            depthCuts: scan.depthCuts,
            timedOut: scan.timedOut,
        });
        process.stdout.write('station: first run — scanned this machine\'s drives, found '
            + scan.roots.length + ' registr' + (scan.roots.length === 1 ? 'y' : 'ies')
            + (scan.timedOut ? ' (ran out of time)' : scan.depthCuts ? ' (depth cut it ' + scan.depthCuts + ' places)' : '')
            + '\n');
    }
    process.stdout.write('fankeel station — ' + out.file + '\n'
        + '  ' + out.registries + ' registries · ' + out.live + ' live, ' + out.stale + ' stale, ' + out.down + ' down'
        + (out.copy ? '  ·  copy at ' + out.copy : '') + '\n');
    if (args.open) openInBrowser(out.file);
}

if (require.main === module) main();

module.exports = { serve, scanDeadline };
