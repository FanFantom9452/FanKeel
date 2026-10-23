'use strict';
// A tuned block glows only on the page its request came from (tune-7): the
// overlay's fetch carries the page as its Referer, and `editing` is cut to it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { pageKey } = require('../lib/tune.js');
const tmp = require('./tmp.js');

const CLI = path.join(__dirname, '..', 'scripts', 'tune.js');

function startServer(t, cwd) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [CLI, 'serve', 'site', '--port', '0'], { cwd });
        t.after(() => child.kill());
        let out = '';
        child.stdout.on('data', (d) => { out += d; if (out.includes('\n')) resolve(out.trim()); });
        child.on('exit', (code) => reject(new Error('tune serve exited ' + code)));
    });
}
function getJson(url, headers) {
    return new Promise((resolve, reject) => {
        http.get(url, { agent: false, headers: headers || {} }, (res) => {
            let text = '';
            res.on('data', (d) => { text += d; });
            res.on('end', () => resolve(JSON.parse(text)));
        }).on('error', reject);
    });
}

test('pageKey: the same page from a request path and from a recorded path', () => {
    assert.equal(pageKey('/page.html'), 'page.html');
    assert.equal(pageKey('page.html'), 'page.html');
    assert.equal(pageKey('/page.html?x=1#top'), 'page.html');
    assert.equal(pageKey('/'), 'index.html');
    assert.equal(pageKey('/docs/'), 'docs/index.html');
    assert.equal(pageKey(''), 'index.html');
    assert.equal(pageKey('/a%20b.html'), 'a b.html');
});

test('/__live/queue shows the ring only for the page that asked, and every ring with no referer', async (t) => {
    const cwd = tmp('fankeel-tune-page-');
    fs.mkdirSync(path.join(cwd, 'site'));
    const base = await startServer(t, cwd);
    const at = new Date().toISOString();
    const rows = [
        { id: 'r-0001', status: 'queued', page: 'a.html', block: 'mast', at }, { id: 'r-0001', status: 'taken', at },
        { id: 'r-0002', status: 'queued', page: 'b.html', block: 'mast', at }, { id: 'r-0002', status: 'taken', at },
        { id: 'r-0003', status: 'queued', block: 'nopage', at }, { id: 'r-0003', status: 'taken', at },
    ];
    fs.writeFileSync(path.join(cwd, '.fankeel', 'build', 'tune', 'queue.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
    const ids = (q) => q.editing.map((e) => e.id).join(',');
    const onA = await getJson(base + '__live/queue', { referer: base + 'a.html' });
    assert.equal(ids(onA), 'r-0001,r-0003');
    assert.equal(onA.pending, 3, 'the queue count is the whole server, not one page');
    assert.equal(ids(await getJson(base + '__live/queue', { referer: base + 'b.html?x=1' })), 'r-0002,r-0003');
    assert.equal(ids(await getJson(base + '__live/queue')), 'r-0001,r-0002,r-0003');
});
