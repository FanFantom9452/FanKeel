'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn, spawnSync, execFileSync } = require('node:child_process');
const { inject, outside, diffLines, queueState, sourcesOf, changedPaths, rankSources } = require('../lib/tune.js');
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
    assert.deepEqual(got, { ok: false, touched: ['sessions'] });
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
function startServer(t, cwd, extra) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [CLI, 'serve', 'site', '--port', '0'].concat(extra || []), { cwd });
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
        const req = http.request(url, { method, agent: false, headers: { 'content-type': 'application/json' } }, (res) => {
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
    const secret = 'top secret, outside site/';
    fs.writeFileSync(path.join(cwd, 'secret.txt'), secret);
    const base = await startServer(t, cwd);

    const served = await request(base + 'page.html', 'GET');
    assert.equal(served.status, 200);
    assert.match(served.text, /<script src="\/__live\/overlay\.js"><\/script><\/body>/);
    assert.equal(fs.readFileSync(file, 'utf8'), PAGE, 'serving changed the file on disk');
    assert.equal((await request(base + '../package.json', 'GET')).status, 404);

    // The plain `../secret.txt` above is normalised away by the URL parser
    // before it ever reaches the server. An encoded slash survives that
    // parse — url.pathname keeps the literal "%2F" — and is only turned
    // into a real `/` by the server's own decodeURIComponent, so this is
    // the request that actually exercises resolveInside's root check.
    const escaped = await request(base + '..%2Fsecret.txt', 'GET');
    assert.equal(escaped.status, 404, 'an encoded ../ climbed out of site/: ' + escaped.text);
    assert.ok(!escaped.text.includes(secret), 'the response leaked secret.txt: ' + escaped.text);

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

test('sourcesOf names every line that writes the block literally, and none that builds its name', () => {
    const text = "a\nh += '<div data-block=\"now\">';\nh += '<div data-block=\"' + name + '\">';\n";
    assert.deepEqual(sourcesOf([{ file: 'src/view.js', text }, { file: 'src/b.css', text: 'x' }], 'now'), ['src/view.js:2']);
});

test('changedPaths lists every path whose hash moved, including one in a single map', () => {
    assert.deepEqual(changedPaths({ a: '1', b: '2' }, { a: '1', b: '3', c: '4' }), ['b', 'c']);
    assert.deepEqual(changedPaths({ a: '1' }, { a: '1' }), []);
});

function git(cwd, args) {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

const VIEW = [
    'module.exports = function view(n) {',
    "    return '<div data-block=\"now\"><b>' + n + ' 個 session</b></div>';",
    '};',
    '',
].join('\n');
const BUILD = [
    "const fs = require('node:fs');",
    "const view = fs.readFileSync('src/view.js', 'utf8');",
    "if (view.includes('BREAK')) { process.stderr.write('build: BREAK in view.js\\n'); process.exit(1); }",
    "fs.mkdirSync('site', { recursive: true });",
    "fs.writeFileSync('site/page.html', '<!DOCTYPE html><html><body><main data-block=\"page\">' + require('./src/view.js')(3) + '</main></body></html>\\n');",
    '',
].join('\n');

function liveRepo() {
    const cwd = tmp('fankeel-tune-live-');
    fs.mkdirSync(path.join(cwd, 'src'));
    fs.writeFileSync(path.join(cwd, 'src', 'view.js'), VIEW);
    fs.writeFileSync(path.join(cwd, 'build.js'), BUILD);
    fs.writeFileSync(path.join(cwd, 'other.txt'), 'untouched\n');
    fs.writeFileSync(path.join(cwd, '.gitignore'), 'site/\n.fankeel/\n');
    git(cwd, ['init', '-q']);
    git(cwd, ['config', 'user.email', 'test@example.invalid']);
    git(cwd, ['config', 'user.name', 'test']);
    git(cwd, ['config', 'commit.gpgsign', 'false']);
    git(cwd, ['config', 'core.autocrlf', 'false']);
    git(cwd, ['add', '-A']);
    git(cwd, ['commit', '-qm', 'base']);
    execFileSync(process.execPath, ['build.js'], { cwd });
    return cwd;
}

test('live mode: wait names the source line; an edit outside --src is put back; a failed rebuild is refused; a clean one rebuilds', async (t) => {
    const cwd = liveRepo();
    const view = path.join(cwd, 'src', 'view.js');
    const other = path.join(cwd, 'other.txt');
    const stray = path.join(cwd, 'stray.txt');
    const page = path.join(cwd, 'site', 'page.html');
    const base = await startServer(t, cwd, ['--src', 'src/view.js', '--rebuild', 'node build.js']);
    const events = [];
    const sse = http.get(base + '__live/events', (res) => res.on('data', (d) => events.push(String(d))));
    t.after(() => sse.destroy());
    const ask = (note) => request(base + '__live/request', 'POST', { page: '/page.html', block: 'now', note });
    const wait = () => spawnSync(process.execPath, [CLI, 'wait', '--timeout', '5'], { cwd, encoding: 'utf8' });
    const done = (id) => spawnSync(process.execPath, [CLI, 'done', id], { cwd, encoding: 'utf8' });

    await ask('改成 3 / 5');
    const job = JSON.parse(wait().stdout);
    assert.deepEqual(job.sources, ['src/view.js:2']);
    fs.writeFileSync(view, VIEW.replace(' 個 session', ' / 5 session'));
    fs.writeFileSync(other, 'changed\n');
    fs.writeFileSync(stray, 'new\n');
    const refused = done('r-0001');
    assert.equal(refused.status, 1);
    assert.match(refused.stderr, /other\.txt, stray\.txt outside --src/);
    assert.equal(fs.readFileSync(other, 'utf8'), 'untouched\n', 'the tracked file outside --src was not put back');
    assert.equal(fs.existsSync(stray), false, 'the new file outside --src was not moved aside');
    assert.equal(fs.readFileSync(view, 'utf8'), VIEW, 'the --src edit of a refused request was not put back');

    await ask('break it');
    wait();
    fs.writeFileSync(view, VIEW.replace(' 個 session', ' 個 session BREAK'));
    const broken = done('r-0002');
    assert.equal(broken.status, 1);
    assert.match(broken.stderr, /--rebuild `node build\.js` exited 1/);
    assert.equal(fs.readFileSync(view, 'utf8'), VIEW);
    assert.match(fs.readFileSync(page, 'utf8'), /3 個 session/, 'the page was not rebuilt from the restored source');

    await ask('改成 3 / 5');
    wait();
    fs.writeFileSync(view, VIEW.replace(' 個 session', ' / 5 session'));
    const ok = done('r-0003');
    assert.equal(ok.status, 0, ok.stderr);
    assert.match(fs.readFileSync(page, 'utf8'), /3 \/ 5 session/);

    await new Promise((r) => setTimeout(r, 200));
    const seen = events.join('');
    assert.match(seen, /"type":"rejected","id":"r-0001","block":"now","touched":\["other\.txt","stray\.txt"\]/);
    assert.match(seen, /"type":"rejected","id":"r-0002","block":"now","touched":\["\(rebuild\)"\]/);
    assert.match(seen, /"type":"done","id":"r-0003"/);
});

test('--src without --rebuild is refused before anything is served', () => {
    const cwd = liveRepo();
    const r = spawnSync(process.execPath, [CLI, 'serve', 'site', '--port', '0', '--src', 'src/view.js'], { cwd, encoding: 'utf8', timeout: 5000 });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /--src and --rebuild go together/);
});

test('rankSources puts the block\'s own lines first, then lines by how many of the element\'s classes they name, ten at most', () => {
    const js = [
        "h += '<div class=\"rpcs\" data-block=\"cost-strip\">';",
        "h += '<button type=\"button\" class=\"rs\" data-rs=\"x\">';",
        "h += '<button class=\"rs big\">';",
        "var k = 'big';",
        "h += '<i class=\"fk-live-box\">';",
    ].join('\n');
    const css = '.rs{border:0}\n.rsx{color:red}\n.big .rs{flex:1}\n';
    const src = [{ file: 'a.js', text: js }, { file: 'a.css', text: css }];
    assert.deepEqual(rankSources(src, { block: 'cost-strip', classes: ['rs', 'big'] }),
        ['a.js:1', 'a.js:3', 'a.css:3', 'a.js:2', 'a.js:4', 'a.css:1']);
    assert.deepEqual(rankSources(src, { block: '', classes: ['fk-live-box'] }), [], 'the overlay\'s own classes are never a source');
    const many = Array.from({ length: 30 }, () => "h += '<b class=\"rs\">';").join('\n');
    assert.equal(rankSources([{ file: 'm.js', text: many }], { block: '', classes: ['rs'] }).length, 10);
});

// An upstream the proxy sits in front of: an HTML page, a script whose bytes
// must pass untouched, and a POST that echoes its body back.
function upstreamServer(t) {
    const js = Buffer.from([0x2f, 0x2f, 0x20, 0xe4, 0xb8, 0xad, 0x0a, 0x00, 0xff]);
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            if (req.url === '/') {
                res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'x-up': 'yes' });
                return res.end('<!DOCTYPE html><html><body><div data-block="now"><b class="rs">3 個 session</b></div></body></html>');
            }
            if (req.url === '/app.js') {
                res.writeHead(200, { 'content-type': 'text/javascript' });
                return res.end(js);
            }
            if (req.method === 'POST' && req.url === '/echo') {
                const chunks = [];
                req.on('data', (c) => chunks.push(c));
                return req.on('end', () => { res.writeHead(201, { 'content-type': 'text/plain' }); res.end(Buffer.concat(chunks)); });
            }
            res.writeHead(404, { 'content-type': 'text/plain' });
            return res.end('nope');
        });
        t.after(() => server.close());
        server.listen(0, '127.0.0.1', () => resolve({ url: 'http://127.0.0.1:' + server.address().port, js }));
    });
}

function startProxy(t, cwd, args) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [CLI, 'serve', '--port', '0'].concat(args), { cwd });
        t.after(() => child.kill());
        let out = '';
        child.stdout.on('data', (d) => {
            out += d;
            if (out.includes('\n')) resolve(out.trim());
        });
        child.on('exit', (code) => reject(new Error('tune serve exited ' + code)));
    });
}

function getBytes(url) {
    return new Promise((resolve, reject) => {
        http.get(url, { agent: false }, (res) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
        }).on('error', reject);
    });
}

test('--proxy: HTML gets the overlay, everything else passes byte for byte, a POST reaches the server, /__live stays local', async (t) => {
    const cwd = liveRepo();
    const up = await upstreamServer(t);
    const base = await startProxy(t, cwd, ['--proxy', up.url, '--src', 'src/view.js']);
    const page = await getBytes(base);
    assert.equal(page.status, 200);
    assert.equal(page.headers['x-up'], 'yes', 'the upstream headers were dropped');
    assert.match(page.body.toString('utf8'), /<script src="\/__live\/overlay\.js"><\/script><\/body>/);
    assert.equal(Number(page.headers['content-length']), page.body.length);
    const js = await getBytes(base + 'app.js');
    assert.ok(js.body.equals(up.js), 'a non-HTML body changed on the way through');
    const echo = await request(base + 'echo', 'POST', { a: 1 });
    assert.deepEqual([echo.status, echo.text], [201, '{"a":1}']);
    assert.equal((await getBytes(base + 'missing')).status, 404);
    assert.equal(JSON.parse((await request(base + '__live/queue', 'GET')).text).pending, 0);
});

test('--proxy: a request with classes and no block gets the class lines as sources, and done needs no --rebuild', async (t) => {
    const cwd = liveRepo();
    fs.writeFileSync(path.join(cwd, 'src', 'view.js'), VIEW.replace('<b>', '<b class="rs">'));
    git(cwd, ['commit', '-qam', 'class']);
    const up = await upstreamServer(t);
    const base = await startProxy(t, cwd, ['--proxy', up.url, '--src', 'src/view.js']);
    const made = JSON.parse((await request(base + '__live/request', 'POST', { page: '/', block: '', selector: 'body > div:nth-of-type(1) > b:nth-of-type(1)', classes: ['rs'], text: '3 個 session', note: '粗一點' })).text);
    assert.equal(made.id, 'r-0001');
    const waited = spawnSync(process.execPath, [CLI, 'wait', '--timeout', '5'], { cwd, encoding: 'utf8' });
    const job = JSON.parse(waited.stdout);
    assert.deepEqual([job.sources, job.selector, job.classes, job.text], [['src/view.js:2'], 'body > div:nth-of-type(1) > b:nth-of-type(1)', ['rs'], '3 個 session']);
    fs.writeFileSync(path.join(cwd, 'src', 'view.js'), VIEW.replace('<b>', '<b class="rs big">'));
    const ok = spawnSync(process.execPath, [CLI, 'done', 'r-0001'], { cwd, encoding: 'utf8' });
    assert.equal(ok.status, 0, ok.stderr);
    assert.match(ok.stdout, /no --rebuild/);
    assert.equal((await request(base + '__live/request', 'POST', { page: '/', note: 'x' })).status, 400, 'neither a block nor a selector');
});

// docs/plans/2026-09-26-ready-five-design.md §3, editing-pulse: the overlay
// rings the block tune is working on, so the queue has to say which it is.
test('the queue names the block being edited and which round of it this is', async (t) => {
    const cwd = tmp('fankeel-tune-');
    fs.mkdirSync(path.join(cwd, 'site'));
    fs.writeFileSync(path.join(cwd, 'site', 'page.html'), PAGE);
    const base = await startServer(t, cwd);
    const queue = async () => JSON.parse((await request(base + '__live/queue', 'GET')).text);
    await request(base + '__live/request', 'POST', { page: '/page.html', block: 'now', note: 'one' });
    assert.deepEqual((await queue()).editing, [], 'queued is not being edited yet');
    spawnSync(process.execPath, [CLI, 'wait', '--timeout', '5'], { cwd, encoding: 'utf8' });
    assert.deepEqual((await queue()).editing, [{ id: 'r-0001', block: 'now', round: 1 }]);
    spawnSync(process.execPath, [CLI, 'done', 'r-0001'], { cwd, encoding: 'utf8' });
    await request(base + '__live/request', 'POST', { page: '/page.html', block: 'now', note: 'two' });
    spawnSync(process.execPath, [CLI, 'wait', '--timeout', '5'], { cwd, encoding: 'utf8' });
    assert.deepEqual((await queue()).editing, [{ id: 'r-0002', block: 'now', round: 2 }]);
});

test('--proxy and <dir> are one or the other, and --proxy needs --src', () => {
    const cwd = liveRepo();
    const both = spawnSync(process.execPath, [CLI, 'serve', 'site', '--port', '0', '--proxy', 'http://127.0.0.1:1', '--src', 'src/view.js'], { cwd, encoding: 'utf8', timeout: 5000 });
    assert.equal(both.status, 2);
    assert.match(both.stderr, /--proxy or a directory, not both/);
    const bare = spawnSync(process.execPath, [CLI, 'serve', '--port', '0', '--proxy', 'http://127.0.0.1:1'], { cwd, encoding: 'utf8', timeout: 5000 });
    assert.equal(bare.status, 2);
    assert.match(bare.stderr, /--proxy needs --src/);
});
