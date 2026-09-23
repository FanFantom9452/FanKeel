#!/usr/bin/env node
'use strict';
// scripts/tune.js: tune a static page one `data-block` at a time.
//
//   node scripts/tune.js serve <dir> [--port 7819]   serve <dir> with the overlay injected
//   node scripts/tune.js wait [--timeout 600]          block until the next request; print it as JSON
//   node scripts/tune.js done <id>                     check the edit stayed in its block; tell the page
//
// State lives in `.fankeel/build/tune/` under the cwd: `queue.jsonl`, a
// `<id>.before.html` snapshot taken when a request is waited for, a
// `<id>.diff.txt` when one is rejected, and `serve.json` naming the port a
// running server listens on. `serve` never writes into <dir>; `done` writes
// there only to put a rejected edit back.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { parseArgs } = require('node:util');
const { inject, outside, diffLines, queueState } = require('../lib/tune.js');

const STATE = path.resolve('.fankeel', 'build', 'tune');
const QUEUE = path.join(STATE, 'queue.jsonl');
const SERVE = path.join(STATE, 'serve.json');
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

function send(res, status, type, body) {
    res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
    res.end(body);
}

function serve(dir, port) {
    const root = path.resolve(dir);
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) die('not a directory: ' + root);
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
            const pending = requests().filter((r) => r.status === 'queued' || r.status === 'taken').length;
            return send(res, 200, TYPES['.json'], JSON.stringify({ pending }));
        }
        const diff = /^\/__live\/diff\/(r-\d+)$/.exec(pathname);
        if (diff) {
            const f = path.join(STATE, diff[1] + '.diff.txt');
            return fs.existsSync(f) ? send(res, 200, TYPES['.txt'], fs.readFileSync(f)) : send(res, 404, TYPES['.txt'], 'no diff');
        }
        if (req.method === 'POST' && (pathname === '/__live/request' || pathname === '/__live/result')) {
            let body = '';
            req.on('data', (c) => {
                body += c;
                if (body.length > 65536) req.destroy();
            });
            req.on('end', () => {
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
                const file = resolveInside(root, String(data.page || ''));
                const block = typeof data.block === 'string' ? data.block : '';
                const note = typeof data.note === 'string' ? data.note.trim() : '';
                if (!file || !/\.html?$/i.test(file) || !fs.existsSync(file) || !block || !note) {
                    return send(res, 400, TYPES['.txt'], 'page, block and note are required');
                }
                const id = 'r-' + String(requests().length + 1).padStart(4, '0');
                append({ id, status: 'queued', page: path.relative(root, file).replace(/\\/g, '/'), file, block, note });
                send(res, 200, TYPES['.json'], JSON.stringify({ id }));
                return broadcast({ type: 'queued', id, block });
            });
            return undefined;
        }
        const file = resolveInside(root, pathname);
        if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, TYPES['.txt'], 'not found');
        const ext = path.extname(file).toLowerCase();
        const bytes = fs.readFileSync(file);
        return send(res, 200, TYPES[ext] || 'application/octet-stream', ext === '.html' || ext === '.htm' ? inject(bytes.toString('utf8')) : bytes);
    });
    server.listen(port, '127.0.0.1', () => {
        const actual = server.address().port;
        fs.mkdirSync(STATE, { recursive: true });
        fs.writeFileSync(SERVE, JSON.stringify({ port: actual, dir: root, pid: process.pid }) + '\n');
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
            fs.copyFileSync(next.file, path.join(STATE, next.id + '.before.html'));
            append({ id: next.id, status: 'taken' });
            process.stdout.write(JSON.stringify({ id: next.id, page: next.page, file: next.file, block: next.block, note: next.note }) + '\n');
            return;
        }
        if (Date.now() >= until) die('no request in ' + timeoutSec + 's', 3);
        setTimeout(tick, 500);
    };
    tick();
}

function notify(event, then) {
    let port;
    try {
        port = JSON.parse(fs.readFileSync(SERVE, 'utf8')).port;
    } catch (e) {
        return then();
    }
    const req = http.request({ host: '127.0.0.1', port, path: '/__live/result', method: 'POST', headers: { 'content-type': 'application/json' } }, (res) => {
        res.resume();
        res.on('end', then);
    });
    req.on('error', () => then());
    return req.end(JSON.stringify(event));
}

function done(id) {
    const r = requests().find((x) => x.id === id);
    if (!r) die('no request ' + id);
    if (r.status !== 'taken') die(id + ' is ' + r.status + ', not taken — run `tune.js wait` first');
    const before = fs.readFileSync(path.join(STATE, id + '.before.html'), 'utf8');
    const after = fs.readFileSync(r.file, 'utf8');
    const verdict = outside(before, after, r.block);
    if (!verdict.ok) {
        fs.writeFileSync(path.join(STATE, id + '.diff.txt'), diffLines(before, after));
        fs.writeFileSync(r.file, before);
    }
    const type = verdict.ok ? 'done' : 'rejected';
    append({ id, status: type, touched: verdict.touched });
    const event = verdict.ok ? { type, id, block: r.block } : { type, id, block: r.block, touched: verdict.touched };
    notify(event, () => {
        if (verdict.ok) {
            process.stdout.write('tune: ' + id + ' done — only ' + r.block + ' changed\n');
            return;
        }
        process.stderr.write('tune: ' + id + ' rejected — the edit changed ' + verdict.touched.join(', ') + '; ' + r.file + ' is back as it was\n');
        process.exit(1);
    });
}

function main() {
    let parsed;
    try {
        parsed = parseArgs({ args: process.argv.slice(2), options: { port: { type: 'string' }, timeout: { type: 'string' } }, allowPositionals: true, strict: true });
    } catch (e) {
        die(e.message);
    }
    const { values, positionals } = parsed;
    const [cmd, arg] = positionals;
    if (cmd === 'serve' && arg) return serve(arg, values.port === undefined ? 7819 : Number(values.port));
    if (cmd === 'wait') return wait(values.timeout === undefined ? 600 : Number(values.timeout));
    if (cmd === 'done' && arg) return done(arg);
    return die('usage: tune.js serve <dir> [--port N] | wait [--timeout S] | done <id>');
}

if (require.main === module) main();
