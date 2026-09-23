'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn, spawnSync } = require('node:child_process');
const { inject, outside, diffLines, queueState } = require('../lib/tune.js');
const tmp = require('./tmp.js');

const CLI = path.join(__dirname, '..', 'scripts', 'tune.js');
const PAGE = [
    '<!DOCTYPE html><html><body>',
    '<main data-block="page">',
    '<div data-block="now"><div><b>3 個 session</b></div></div>',
    '<section data-block="sessions"><p>design</p></section>',
    '<footer>v1</footer>',
    '</main>',
    '</body></html>',
    '',
].join('\n');

test('inject puts the overlay tag before </body>, or at the end when there is none', () => {
    assert.match(inject('<body>x</body>'), /x<script src="\/__live\/overlay\.js"><\/script><\/body>/);
    assert.equal(inject('x'), 'x<script src="/__live/overlay.js"></script>');
});

test('an edit inside the block is ok, even when the block nests its own tag', () => {
    const after = PAGE.replace('<div><b>3 個 session</b></div>', '<div><b>3 / 5 session</b></div><div>new</div>');
    assert.deepEqual(outside(PAGE, after, 'now'), { ok: true, touched: [] });
});

test('an edit to a sibling block names that block', () => {
    const after = PAGE.replace('<p>design</p>', '<p>build</p>');
    const got = outside(PAGE, after, 'now');
    assert.equal(got.ok, false);
    assert.ok(got.touched.includes('sessions'), JSON.stringify(got));
});

test('an edit in markup no inner block owns names the block around it', () => {
    const after = PAGE.replace('v1', 'v2');
    assert.deepEqual(outside(PAGE, after, 'now'), { ok: false, touched: ['page'] });
});

test('an edit outside every block says so', () => {
    const after = PAGE.replace('<!DOCTYPE html>', '<!DOCTYPE html><!-- x -->');
    assert.deepEqual(outside(PAGE, after, 'now'), { ok: false, touched: ['(區塊外)'] });
});

test('diffLines shows only the changed middle', () => {
    assert.equal(diffLines('a\nb\nc\n', 'a\nB\nc\n'), '- b\n+ B\n');
});

test('queueState: the last line of an id wins, and keeps the fields of the first', () => {
    const rows = queueState('{"id":"r-0001","status":"queued","block":"now"}\nnot json\n{"id":"r-0001","status":"taken"}\n');
    assert.deepEqual(rows.map((r) => [r.id, r.status, r.block]), [['r-0001', 'taken', 'now']]);
});

// A running server in a scratch cwd, its url read off its first stdout line.
function startServer(t, cwd) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [CLI, 'serve', 'site', '--port', '0'], { cwd });
        t.after(() => child.kill());
        let out = '';
        child.stdout.on('data', (d) => {
            out += d;
            if (out.includes('\n')) resolve(out.trim());
        });
        child.on('exit', (code) => reject(new Error('tune serve exited ' + code)));
    });
}

function request(url, method, body) {
    return new Promise((resolve, reject) => {
        const req = http.request(url, { method, headers: { 'content-type': 'application/json' } }, (res) => {
            let text = '';
            res.on('data', (d) => { text += d; });
            res.on('end', () => resolve({ status: res.statusCode, text }));
        });
        req.on('error', reject);
        req.end(body ? JSON.stringify(body) : undefined);
    });
}

test('serve injects without touching the file; request, wait and done round-trip; a stray edit is put back', async (t) => {
    const cwd = tmp('fankeel-tune-');
    fs.mkdirSync(path.join(cwd, 'site'));
    const file = path.join(cwd, 'site', 'page.html');
    fs.writeFileSync(file, PAGE);
    const base = await startServer(t, cwd);

    const served = await request(base + 'page.html', 'GET');
    assert.equal(served.status, 200);
    assert.match(served.text, /<script src="\/__live\/overlay\.js"><\/script><\/body>/);
    assert.equal(fs.readFileSync(file, 'utf8'), PAGE, 'serving changed the file on disk');
    assert.equal((await request(base + '../package.json', 'GET')).status, 404);

    const events = [];
    const sse = http.get(base + '__live/events', (res) => res.on('data', (d) => events.push(String(d))));
    t.after(() => sse.destroy());

    const made = JSON.parse((await request(base + '__live/request', 'POST', { page: '/page.html', block: 'now', note: '改成 3 / 5' })).text);
    assert.equal(made.id, 'r-0001');
    assert.equal(JSON.parse((await request(base + '__live/queue', 'GET')).text).pending, 1);

    const waited = spawnSync(process.execPath, [CLI, 'wait', '--timeout', '5'], { cwd, encoding: 'utf8' });
    assert.equal(waited.status, 0, waited.stderr);
    const job = JSON.parse(waited.stdout);
    assert.deepEqual([job.id, job.block, job.note, path.resolve(job.file)], ['r-0001', 'now', '改成 3 / 5', file]);

    fs.writeFileSync(file, PAGE.replace('<p>design</p>', '<p>build</p>'));
    const rejected = spawnSync(process.execPath, [CLI, 'done', 'r-0001'], { cwd, encoding: 'utf8' });
    assert.equal(rejected.status, 1);
    assert.match(rejected.stderr, /sessions/);
    assert.equal(fs.readFileSync(file, 'utf8'), PAGE, 'a rejected edit was not put back');
    assert.match((await request(base + '__live/diff/r-0001', 'GET')).text, /\+ .*build/);

    await request(base + '__live/request', 'POST', { page: '/page.html', block: 'now', note: 'again' });
    spawnSync(process.execPath, [CLI, 'wait', '--timeout', '5'], { cwd, encoding: 'utf8' });
    fs.writeFileSync(file, PAGE.replace('3 個 session', '3 / 5 session'));
    const ok = spawnSync(process.execPath, [CLI, 'done', 'r-0002'], { cwd, encoding: 'utf8' });
    assert.equal(ok.status, 0, ok.stderr);
    assert.match(fs.readFileSync(file, 'utf8'), /3 \/ 5 session/);

    await new Promise((r) => setTimeout(r, 200));
    const seen = events.join('');
    assert.match(seen, /"type":"rejected","id":"r-0001","block":"now","touched":\["sessions"\]/);
    assert.match(seen, /"type":"done","id":"r-0002"/);
});

test('wait with nothing queued gives up with exit 3', () => {
    const cwd = tmp('fankeel-tune-');
    const r = spawnSync(process.execPath, [CLI, 'wait', '--timeout', '1'], { cwd, encoding: 'utf8' });
    assert.equal(r.status, 3);
    assert.match(r.stderr, /no request in 1s/);
});
