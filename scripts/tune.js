#!/usr/bin/env node
'use strict';
// scripts/tune.js: tune a static page one `data-block` at a time.
//
//   node scripts/tune.js serve <dir> [--port 7819]   serve <dir> with the overlay injected
//   node scripts/tune.js serve <dir> --src <file,...> --rebuild "<cmd>"   live mode: the page is built from --src
//   node scripts/tune.js serve --proxy <url> --src <file,...> [--rebuild "<cmd>"]   the real server's pages, overlay spliced into its HTML
//   node scripts/tune.js wait [--timeout 600]          block until the next request; print it as JSON
//   node scripts/tune.js done <id>                     check the edit stayed in its block; tell the page
//
// State lives in `.fankeel/build/tune/` under the cwd: `queue.jsonl`, a
// `<id>.before.html` snapshot taken when a request is waited for, a
// `<id>.diff.txt` when one is rejected, and `serve.json` naming the port a
// running server listens on. `serve` never writes into <dir>; `done` writes
// there only to put a rejected edit back. In live mode `wait` snapshots every
// file that differs from git HEAD instead of the page, and `done` puts them
// all back and refuses when anything outside --src changed, then runs --rebuild.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');
const { parseArgs } = require('node:util');
const { inject, outside, diffLines, queueState, sourcesOf, changedPaths, rankSources } = require('../lib/tune.js');
const { readBody } = require('../lib/body.js');
const { relPath } = require('../lib/guard.js');

const STATE = path.resolve('.fankeel', 'build', 'tune');
const QUEUE = path.join(STATE, 'queue.jsonl');
const SERVE = path.join(STATE, 'serve.json');
const STATE_REL = path.relative(process.cwd(), STATE).replace(/\\/g, '/');
const OVERLAY = path.join(__dirname, '..', 'assets', 'tune', 'overlay.js');
const TYPES = {
    '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8',
};

function die(msg, code) {
    process.stderr.write('tune: ' + msg + '\n');
    process.exit(code || 2);
}

function append(row) {
    fs.mkdirSync(STATE, { recursive: true });
    fs.appendFileSync(QUEUE, JSON.stringify(Object.assign({ at: new Date().toISOString() }, row)) + '\n');
}

function requests() {
    try {
        return queueState(fs.readFileSync(QUEUE, 'utf8'));
    } catch (e) {
        return [];
    }
}

// <root>/<rel>, with `/` and a trailing `/` meaning index.html; null when
// rel climbs out of root.
function resolveInside(root, rel) {
    let r = String(rel).replace(/^\/+/, '');
    if (r === '' || r.endsWith('/')) r += 'index.html';
    const file = path.resolve(root, r);
    return file.startsWith(root + path.sep) ? file : null;
}

// Proxy mode: the request goes to the real server as it came. An HTML answer
// comes back with the overlay spliced in; anything else is streamed through
// byte for byte, so a script, a poll or an event stream arrives as it would
// have. `accept-encoding` is dropped so an HTML body arrives uncompressed.
function forward(req, res, upstream) {
    const target = new URL(req.url, upstream);
    const headers = Object.assign({}, req.headers, { host: target.host });
    delete headers['accept-encoding'];
    const out = http.request(target, { method: req.method, headers }, (up) => {
        if (!/^text\/html/i.test(String(up.headers['content-type'] || ''))) {
            res.writeHead(up.statusCode, up.headers);
            up.pipe(res);
            return;
        }
        const chunks = [];
        up.on('data', (c) => chunks.push(c));
        up.on('end', () => {
            const body = Buffer.from(inject(Buffer.concat(chunks).toString('utf8')), 'utf8');
            const h = Object.assign({}, up.headers, { 'content-length': String(body.length) });
            delete h['transfer-encoding'];
            res.writeHead(up.statusCode, h);
            res.end(body);
        });
    });
    out.on('error', (e) => send(res, 502, TYPES['.txt'], 'tune: the proxied server did not answer: ' + e.message));
    req.pipe(out);
}

function send(res, status, type, body) {
    res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
    res.end(body);
}

function serve(dir, port, live, upstream) {
    const root = upstream ? null : path.resolve(dir);
    if (!upstream && (!fs.existsSync(root) || !fs.statSync(root).isDirectory())) die('not a directory: ' + root);
    const clients = new Set();
    const broadcast = (event) => {
        for (const c of clients) c.write('data: ' + JSON.stringify(event) + '\n\n');
    };
    const server = http.createServer((req, res) => {
        const url = new URL(req.url, 'http://127.0.0.1');
        let pathname;
        try {
            pathname = decodeURIComponent(url.pathname);
        } catch (e) {
            return send(res, 400, TYPES['.txt'], 'bad path');
        }
        if (pathname === '/__live/overlay.js') {
            if (!fs.existsSync(OVERLAY)) return send(res, 404, TYPES['.txt'], 'no overlay');
            return send(res, 200, TYPES['.js'], fs.readFileSync(OVERLAY));
        }
        if (pathname === '/__live/events') {
            res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
            res.write(': live\n\n');
            clients.add(res);
            req.on('close', () => clients.delete(res));
            return undefined;
        }
        if (pathname === '/__live/queue') {
            const rows = requests();
            const pending = rows.filter((r) => r.status === 'queued' || r.status === 'taken').length;
            // What `wait` has handed out and `done` has not settled, with how
            // many times that block has been asked for so far — the round.
            const editing = rows.filter((r) => r.status === 'taken')
                .map((r) => ({ id: r.id, block: r.block, round: rows.filter((x) => x.block === r.block && x.id <= r.id).length }));
            return send(res, 200, TYPES['.json'], JSON.stringify({ pending, editing }));
        }
        const diff = /^\/__live\/diff\/(r-\d+)$/.exec(pathname);
        if (diff) {
            const f = path.join(STATE, diff[1] + '.diff.txt');
            return fs.existsSync(f) ? send(res, 200, TYPES['.txt'], fs.readFileSync(f)) : send(res, 404, TYPES['.txt'], 'no diff');
        }
        if (req.method === 'POST' && (pathname === '/__live/request' || pathname === '/__live/result')) {
            readBody(req, { destroyOnOverflow: true }).then((body) => {
                let data;
                try {
                    data = JSON.parse(body);
                } catch (e) {
                    return send(res, 400, TYPES['.txt'], 'not JSON');
                }
                if (pathname === '/__live/result') {
                    broadcast(data);
                    return send(res, 204, TYPES['.txt'], '');
                }
                const page = String(data.page || '');
                const file = upstream ? null : resolveInside(root, page);
                const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
                const block = str(data.block, 200);
                const note = str(data.note, 4000);
                const selector = str(data.selector, 500);
                const text = str(data.text, 80);
                const classes = Array.isArray(data.classes) ? data.classes.filter((c) => typeof c === 'string').slice(0, 20) : [];
                if (!note || (!block && !selector)) return send(res, 400, TYPES['.txt'], 'a note, and a block or a selector, are required');
                if (!upstream && (!file || !/\.html?$/i.test(file) || !fs.existsSync(file) || !block)) {
                    return send(res, 400, TYPES['.txt'], 'a static page takes a data-block element on an html file under the served directory');
                }
                const id = 'r-' + String(requests().length + 1).padStart(4, '0');
                append({ id, status: 'queued', page: upstream ? page : relPath(root, file), file, block, selector, classes, text, note });
                send(res, 200, TYPES['.json'], JSON.stringify({ id }));
                return broadcast({ type: 'queued', id, block, selector });
            });
            return undefined;
        }
        if (upstream) return forward(req, res, upstream);
        const file = resolveInside(root, pathname);
        if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, TYPES['.txt'], 'not found');
        const ext = path.extname(file).toLowerCase();
        const bytes = fs.readFileSync(file);
        return send(res, 200, TYPES[ext] || 'application/octet-stream', ext === '.html' || ext === '.htm' ? inject(bytes.toString('utf8')) : bytes);
    });
    server.listen(port, '127.0.0.1', () => {
        const actual = server.address().port;
        fs.mkdirSync(STATE, { recursive: true });
        fs.writeFileSync(SERVE, JSON.stringify(Object.assign({ port: actual, dir: root, proxy: upstream ? upstream.href : null, pid: process.pid }, live || {})) + '\n');
        process.stdout.write('http://127.0.0.1:' + actual + '/\n');
    });
}

// The before-snapshot is taken here, when the request is picked up, not when
// it was queued: an earlier request on the same file may have landed since.
function wait(timeoutSec) {
    const until = Date.now() + timeoutSec * 1000;
    const tick = () => {
        const next = requests().find((r) => r.status === 'queued');
        if (next) {
            const live = liveOf();
            if (live) takeSnapshot(next.id, live.src);
            else fs.copyFileSync(next.file, path.join(STATE, next.id + '.before.html'));
            append({ id: next.id, status: 'taken' });
            const job = { id: next.id, page: next.page, file: next.file, block: next.block, selector: next.selector || '', classes: next.classes || [], text: next.text || '', note: next.note };
            if (live) job.sources = rankSources(live.src.map((f) => ({ file: f, text: fs.readFileSync(f, 'utf8') })), { block: next.block, classes: next.classes || [] });
            process.stdout.write(JSON.stringify(job) + '\n');
            return;
        }
        if (Date.now() >= until) die('no request in ' + timeoutSec + 's', 3);
        setTimeout(tick, 500);
    };
    tick();
}

// Live mode's settings, off the record `serve` wrote: the --src files as
// paths relative to the cwd, and the --rebuild command. Null for a static
// serve, whose record carries neither — so a static serve started later
// turns live mode off again.
function liveOf() {
    try {
        const rec = JSON.parse(fs.readFileSync(SERVE, 'utf8'));
        return Array.isArray(rec.src) && rec.src.length ? { src: rec.src, rebuild: typeof rec.rebuild === 'string' ? rec.rebuild : null } : null;
    } catch (e) {
        return null;
    }
}

function rel(p) {
    return path.relative(process.cwd(), path.resolve(p)).replace(/\\/g, '/');
}

function bytesOf(p) {
    try {
        return fs.readFileSync(p);
    } catch (e) {
        return null;
    }
}

function hashOf(bytes) {
    return bytes === null ? 'gone' : crypto.createHash('sha1').update(bytes).digest('hex');
}

// What HEAD holds at `p`, or null when HEAD has no such path.
function headBytes(p) {
    try {
        return execFileSync('git', ['show', 'HEAD:./' + p], { stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 256 * 1024 * 1024 });
    } catch (e) {
        return null;
    }
}

// Every path git says differs from HEAD — modified, deleted, or untracked and
// not ignored — plus the --src files, minus this script's own state.
function dirtyPaths(src) {
    const out = execFileSync('git', ['ls-files', '-m', '-o', '--exclude-standard', '-z'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
    const all = new Set(out.split('\0').filter(Boolean).map((p) => p.replace(/\\/g, '/')));
    for (const f of src) all.add(f);
    return [...all].filter((p) => p !== STATE_REL && !p.startsWith(STATE_REL + '/')).sort();
}

// At `wait`: the hash of every path that differs from HEAD, and a copy of each
// one that exists, so `done` can put any of them back.
function takeSnapshot(id, src) {
    const dir = path.join(STATE, id + '.snap');
    fs.mkdirSync(dir, { recursive: true });
    const hashes = {};
    const copies = {};
    dirtyPaths(src).forEach((p, i) => {
        const bytes = bytesOf(p);
        hashes[p] = hashOf(bytes);
        if (bytes !== null) {
            copies[p] = String(i);
            fs.writeFileSync(path.join(dir, String(i)), bytes);
        }
    });
    fs.writeFileSync(path.join(STATE, id + '.snap.json'), JSON.stringify({ hashes, copies }) + '\n');
}

// The paths that moved since the snapshot. One the snapshot does not name was
// equal to HEAD at `wait`, so its before-hash is HEAD's — which also keeps a
// file git lists only because its stat changed from counting as an edit.
function compare(snap, src) {
    const paths = new Set([...Object.keys(snap.hashes), ...dirtyPaths(src)]);
    const before = {};
    const after = {};
    for (const p of paths) {
        before[p] = Object.prototype.hasOwnProperty.call(snap.hashes, p) ? snap.hashes[p] : hashOf(headBytes(p));
        after[p] = hashOf(bytesOf(p));
    }
    return changedPaths(before, after);
}

// Puts every path in `paths` back to what it held at `wait`: the snapshot's
// copy, HEAD's bytes for one that was clean then, and for one that did not
// exist then, moved aside into `<id>.stray/` rather than deleted.
function restore(id, snap, paths) {
    for (const p of paths) {
        if (Object.prototype.hasOwnProperty.call(snap.copies, p)) {
            fs.mkdirSync(path.dirname(path.resolve(p)), { recursive: true });
            fs.writeFileSync(p, fs.readFileSync(path.join(STATE, id + '.snap', snap.copies[p])));
            continue;
        }
        const head = Object.prototype.hasOwnProperty.call(snap.hashes, p) ? null : headBytes(p);
        if (head !== null) {
            fs.mkdirSync(path.dirname(path.resolve(p)), { recursive: true });
            fs.writeFileSync(p, head);
        } else if (fs.existsSync(p)) {
            const aside = path.join(STATE, id + '.stray', p.replace(/[\\/]/g, '__'));
            fs.mkdirSync(path.dirname(aside), { recursive: true });
            fs.renameSync(p, aside);
        }
    }
}

function notify(event, then) {
    let port;
    try {
        port = JSON.parse(fs.readFileSync(SERVE, 'utf8')).port;
    } catch (e) {
        return then();
    }
    fetch('http://127.0.0.1:' + port + '/__live/result', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(event) }).then(() => then(), () => then());
}

// The one ending both modes share: the queue line, the page's event, and the
// line on stdout or stderr with its exit code.
function settle(r, ok, touched, message) {
    const type = ok ? 'done' : 'rejected';
    append({ id: r.id, status: type, touched });
    const event = ok ? { type, id: r.id, block: r.block, selector: r.selector || '' } : { type, id: r.id, block: r.block, touched, selector: r.selector || '' };
    notify(event, () => {
        if (ok) {
            process.stdout.write('tune: ' + r.id + ' done — ' + message + '\n');
            return;
        }
        process.stderr.write('tune: ' + r.id + ' rejected — ' + message + '\n');
        process.exit(1);
    });
}

function done(id) {
    const r = requests().find((x) => x.id === id);
    if (!r) die('no request ' + id);
    if (r.status !== 'taken') die(id + ' is ' + r.status + ', not taken — run `tune.js wait` first');
    const live = liveOf();
    if (live) return doneLive(r, live);
    const before = fs.readFileSync(path.join(STATE, id + '.before.html'), 'utf8');
    const after = fs.readFileSync(r.file, 'utf8');
    const verdict = outside(before, after, r.block);
    if (!verdict.ok) {
        fs.writeFileSync(path.join(STATE, id + '.diff.txt'), diffLines(before, after));
        fs.writeFileSync(r.file, before);
        return settle(r, false, verdict.touched, 'the edit changed ' + verdict.touched.join(', ') + '; ' + r.file + ' is back as it was');
    }
    return settle(r, true, [], 'only ' + r.block + ' changed');
}

// Live mode: nothing outside --src may have moved since `wait`, and the page
// has to rebuild from what did. A tracked file changed outside --src puts
// every changed file back; a stray new file outside --src is moved aside
// instead, and the --src edit stands.
function doneLive(r, live) {
    const snapFile = path.join(STATE, r.id + '.snap.json');
    if (!fs.existsSync(snapFile)) die(r.id + ' has no snapshot: a static `wait` took it; run `tune.js wait` again');
    const snap = JSON.parse(fs.readFileSync(snapFile, 'utf8'));
    const changed = compare(snap, live.src);
    const stray = changed.filter((p) => !live.src.includes(p));
    // A stray path with no snapshot entry and no HEAD content is something the
    // edit's own tooling created outside --src — a screenshot the page drops
    // beside itself, say — rather than a file the edit touched. Every one of
    // them has to be new, or one tracked file among them is still evidence the
    // edit reached outside --src, and the old all-or-nothing restore applies.
    const isNew = (p) => !Object.prototype.hasOwnProperty.call(snap.hashes, p) && headBytes(p) === null;
    if (stray.length && stray.every(isNew)) {
        for (const p of stray) {
            const aside = path.join(STATE, r.id + '.stray', p.replace(/[\\/]/g, '__'));
            fs.mkdirSync(path.dirname(aside), { recursive: true });
            fs.renameSync(p, aside);
        }
        return settle(r, true, [], stray.length + ' new file' + (stray.length === 1 ? '' : 's')
            + ' outside --src moved to ' + path.join(STATE, r.id + '.stray') + '; the --src edit stands');
    }
    if (stray.length) {
        restore(r.id, snap, changed);
        fs.writeFileSync(path.join(STATE, r.id + '.diff.txt'), stray.map((p) => '! ' + p + '\n').join(''));
        return settle(r, false, stray, 'the edit changed ' + stray.join(', ') + ' outside --src; every file it touched is back as it was');
    }
    if (!live.rebuild) return settle(r, true, [], 'nothing outside --src changed; no --rebuild, the proxied server reads --src as it is');
    const built = spawnSync(live.rebuild, { shell: true, encoding: 'utf8' });
    if (built.status !== 0) {
        restore(r.id, snap, changed);
        spawnSync(live.rebuild, { shell: true, encoding: 'utf8' });
        fs.writeFileSync(path.join(STATE, r.id + '.diff.txt'), String(built.stdout || '') + String(built.stderr || ''));
        return settle(r, false, ['(rebuild)'], '--rebuild `' + live.rebuild + '` exited ' + built.status + '; --src is back as it was and rebuilt');
    }
    return settle(r, true, [], 'rebuilt with `' + live.rebuild + '`');
}

// `--src` names the files an edit may touch. With a directory it comes with
// `--rebuild`, which regenerates the page from them; with `--proxy` it is
// required and `--rebuild` is optional, because a server that reads --src on
// every request needs nothing rebuilt.
function liveArgs(values, proxied) {
    if (values.src === undefined && values.rebuild === undefined && !proxied) return null;
    if (proxied && !values.src) die('--proxy needs --src: the files an edit may touch');
    if (!proxied && (!values.src || !values.rebuild)) die('--src and --rebuild go together: the files an edit may touch, and the command that rebuilds the page from them');
    const src = values.src.split(',').map((s) => s.trim()).filter(Boolean).map(rel);
    for (const f of src) if (!fs.existsSync(f)) die('no such --src file: ' + f);
    try {
        execFileSync('git', ['rev-parse', '--verify', 'HEAD'], { stdio: 'ignore' });
    } catch (e) {
        die('live mode compares the tree against git HEAD, and there is no HEAD here');
    }
    return { src, rebuild: values.rebuild || null };
}

function serveArgs(dir, values) {
    const port = values.port === undefined ? 7819 : Number(values.port);
    if (values.proxy === undefined) return serve(dir, port, liveArgs(values, false), null);
    if (dir) die('--proxy or a directory, not both: a proxied page comes from the server, a directory from disk');
    let upstream;
    try {
        upstream = new URL(values.proxy);
    } catch (e) {
        die('--proxy is not a url: ' + values.proxy);
    }
    if (upstream.protocol !== 'http:') die('--proxy takes an http:// url');
    return serve(null, port, liveArgs(values, true), upstream);
}

function main() {
    let parsed;
    try {
        parsed = parseArgs({ args: process.argv.slice(2), options: { port: { type: 'string' }, timeout: { type: 'string' }, src: { type: 'string' }, rebuild: { type: 'string' }, proxy: { type: 'string' } }, allowPositionals: true, strict: true });
    } catch (e) {
        die(e.message);
    }
    const { values, positionals } = parsed;
    const [cmd, arg] = positionals;
    if (cmd === 'serve' && (arg || values.proxy !== undefined)) return serveArgs(arg, values);
    if (cmd === 'wait') return wait(values.timeout === undefined ? 600 : Number(values.timeout));
    if (cmd === 'done' && arg) return done(arg);
    return die('usage: tune.js serve <dir> [--port N] [--src <file,...> --rebuild "<cmd>"] | serve --proxy <url> --src <file,...> [--rebuild "<cmd>"] [--port N] | wait [--timeout S] | done <id>');
}

if (require.main === module) main();
