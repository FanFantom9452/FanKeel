'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn, spawnSync, execFileSync } = require('node:child_process');
const { inject, outside, diffLines, queueState, sourcesOf, changedPaths } = require('../lib/tune.js');
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
