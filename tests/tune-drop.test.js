'use strict';
// A request `wait` handed out and nobody settled expires after 24 hours, and
// `tune.js drop <id>` settles one by hand (station-50, tune-7).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn, spawnSync } = require('node:child_process');
const { statusOf, TAKEN_TTL_MS } = require('../lib/tune.js');
const tmp = require('./tmp.js');

const CLI = path.join(__dirname, '..', 'scripts', 'tune.js');
const H = 60 * 60 * 1000;
const NOW = Date.parse('2026-10-23T12:00:00.000Z');
const line = (id, status, ms, extra) => Object.assign({ id, status, at: new Date(ms).toISOString() }, extra || {});

function project() {
    const cwd = tmp('fankeel-tune-drop-');
    fs.mkdirSync(path.join(cwd, 'site'));
    fs.writeFileSync(path.join(cwd, 'site', 'page.html'), '<main data-block="a"></main>');
    return cwd;
}
function writeQueue(cwd, rows) {
    const dir = path.join(cwd, '.fankeel', 'build', 'tune');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'queue.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
}
function readQueue(cwd) {
    return fs.readFileSync(path.join(cwd, '.fankeel', 'build', 'tune', 'queue.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
}
function startServer(t, cwd) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [CLI, 'serve', 'site', '--port', '0'], { cwd });
        t.after(() => child.kill());
        let out = '';
        child.stdout.on('data', (d) => { out += d; if (out.includes('\n')) resolve(out.trim()); });
        child.on('exit', (code) => reject(new Error('tune serve exited ' + code)));
    });
}
function getJson(url) {
    return new Promise((resolve, reject) => {
        http.get(url, { agent: false }, (res) => {
            let text = '';
            res.on('data', (d) => { text += d; });
            res.on('end', () => resolve(JSON.parse(text)));
        }).on('error', reject);
    });
}

test('statusOf: a taken row expires after 24 hours exactly, nothing else does', () => {
    assert.equal(TAKEN_TTL_MS, 86400000);
    assert.equal(statusOf({ status: 'taken', at: new Date(NOW - TAKEN_TTL_MS).toISOString() }, NOW), 'taken');
    assert.equal(statusOf({ status: 'taken', at: new Date(NOW - TAKEN_TTL_MS - 1).toISOString() }, NOW), 'expired');
    assert.equal(statusOf({ status: 'taken' }, NOW), 'taken');
    assert.equal(statusOf({ status: 'taken', at: 'not a date' }, NOW), 'taken');
    assert.equal(statusOf({ status: 'queued', at: new Date(NOW - 99 * H).toISOString() }, NOW), 'queued');
    assert.equal(statusOf({ status: 'done', at: new Date(NOW - 99 * H).toISOString() }, NOW), 'done');
});

test('drop settles a queued or taken request as dropped and nothing else', () => {
    const cwd = project();
    writeQueue(cwd, [
        line('r-0001', 'queued', NOW - 3 * H, { block: 'a', page: 'page.html' }),
        line('r-0002', 'queued', NOW - 3 * H, { block: 'a', page: 'page.html' }), line('r-0002', 'taken', NOW - 2 * H),
        line('r-0003', 'queued', NOW - 3 * H, { block: 'a', page: 'page.html' }), line('r-0003', 'done', NOW - 1 * H),
    ]);
    const run = (...args) => spawnSync(process.execPath, [CLI].concat(args), { cwd, encoding: 'utf8' });
    const taken = run('drop', 'r-0002');
    assert.equal(taken.status, 0, taken.stderr);
    assert.match(taken.stdout, /r-0002 dropped/);
    assert.equal(readQueue(cwd).pop().status, 'dropped');
    assert.equal(run('drop', 'r-0001').status, 0);
    const done = run('drop', 'r-0003');
    assert.equal(done.status, 2);
    assert.match(done.stderr, /r-0003 is done, nothing to drop/);
    const missing = run('drop', 'r-9999');
    assert.equal(missing.status, 2);
    assert.match(missing.stderr, /no request r-9999/);
    assert.match(run('drop').stderr, /usage:.*drop <id>/);
    assert.equal(fs.readFileSync(path.join(cwd, 'site', 'page.html'), 'utf8'), '<main data-block="a"></main>');
});

test('/__live/queue leaves an expired taken request out of pending and editing, and a drop out of both', async (t) => {
    const cwd = project();
    const base = await startServer(t, cwd);
    const now = Date.now();
    writeQueue(cwd, [
        line('r-0001', 'queued', now - 30 * H, { block: 'old', page: 'page.html' }), line('r-0001', 'taken', now - 25 * H),
        line('r-0002', 'queued', now - 2 * H, { block: 'fresh', page: 'page.html' }), line('r-0002', 'taken', now - 1 * H),
        line('r-0003', 'queued', now - 1 * H, { block: 'next', page: 'page.html' }),
    ]);
    const first = await getJson(base + '__live/queue');
    assert.equal(first.pending, 2);
    assert.deepEqual(first.editing.map((e) => [e.id, e.block, e.round]), [['r-0002', 'fresh', 1]]);
    assert.equal(spawnSync(process.execPath, [CLI, 'drop', 'r-0003'], { cwd }).status, 0);
    assert.equal((await getJson(base + '__live/queue')).pending, 1);
    assert.equal(spawnSync(process.execPath, [CLI, 'drop', 'r-0001'], { cwd }).status, 0, 'an expired taken row can still be dropped');
    assert.equal(spawnSync(process.execPath, [CLI, 'drop', 'r-0002'], { cwd }).status, 0);
    assert.deepEqual(await getJson(base + '__live/queue'), { pending: 0, editing: [] });
});
