'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { execFileSync, spawnSync } = require('node:child_process');
const registry = require('../lib/registry.js');
const badge = require('../lib/badge.js');
const station = require('../lib/station.js');
const profile = require('../lib/profile.js');
const tmp = require('./tmp.js');

const CLI = path.join(__dirname, '..', 'scripts', 'station.js');
const LIVE = 'aaaaaaaa-1111-4111-8111-111111111111';
const STALE = 'bbbbbbbb-2222-4222-8222-222222222222';
const DAY = 24 * 3600e3;
// A pid no operating system hands out, the same constant `tests/carry.test.js`
// uses for one that is gone.
const GONE_PID = 2147483646;

function fixture() {
    const base = tmp('fankeel-station-cli-');
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(r1);
    const now = Date.now();
    const at = (ms) => new Date(ms).toISOString();
    registry.writeSession(r1, LIVE, { task: 'live', stage: 'build', route: ['survey', 'build'], active: true, claims: [],
        started: at(now - 40 * DAY), updated: at(now - 30 * DAY), configDir: cfg });
    registry.writeSession(r1, STALE, { task: 'stale', stage: 'design', route: ['survey', 'design'], active: true, claims: [],
        started: at(now - 40 * DAY), updated: at(now - 30 * DAY), configDir: cfg });
    badge.writeLead(cfg, STALE, { word: 'design', root: r1 });
    fs.writeFileSync(path.join(cfg, 'sessions', process.pid + '.json'), JSON.stringify({
        pid: process.pid, sessionId: LIVE, cwd: r1, startedAt: at(now), procStart: 0, version: '2.0.0',
        kind: 'interactive', entrypoint: 'cli', status: 'idle',
    }));
    // Seeded so the CLI never sees "no roots.json at all" here: these three
    // tests exercise the ordinary write path, not the once-only auto-scan,
    // and an unseeded config dir would make every one of them spend the
    // auto-scan's own budget walking this machine's real drives.
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'),
        JSON.stringify({ [path.resolve(r1)]: at(now) }, null, 2) + '\n');
    return { base, cfg, r1 };
}

const request = (url, opts, body) => new Promise((resolve, reject) => {
    const req = http.request(url, opts, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
});

test('the default form writes the page, prints its path and the counts', () => {
    const f = fixture();
    const out = execFileSync(process.execPath, [CLI], { cwd: f.base, env: { ...process.env, CLAUDE_CONFIG_DIR: f.cfg }, encoding: 'utf8' });
    const file = path.join(f.cfg, 'fankeel', 'index.html');
    assert.ok(out.includes(file));
    assert.match(out, /1 registries · 1 live, 1 stale, 0 down/);
    const dataFile = path.join(f.cfg, 'fankeel', 'station', 'station-data.js');
    assert.ok(fs.readFileSync(dataFile, 'utf8').includes('"state":"stale"'));
});

test('--json prints the rows as one JSON document and writes nothing', () => {
    const f = fixture();
    const env = { ...process.env, CLAUDE_CONFIG_DIR: f.cfg };
    const out = execFileSync(process.execPath, [CLI, '--json'], { cwd: f.base, env, encoding: 'utf8' });
    const model = JSON.parse(out);
    const states = model.registries.flatMap((r) => r.sessions.map((s) => s.state)).sort();
    assert.deepEqual(states, ['live', 'stale']);
    assert.equal(fs.existsSync(path.join(f.cfg, 'fankeel', 'index.html')), false, '--json wrote the page');
    assert.equal(fs.existsSync(path.join(f.r1, '.fankeel', 'index.html')), false, '--json wrote the copy');
});

test('--json refuses a verb, the way an unknown argument is refused', () => {
    const f = fixture();
    const env = { ...process.env, CLAUDE_CONFIG_DIR: f.cfg };
    for (const argv of [['--json', 'serve'], ['--json', '--forget', f.r1]]) {
        const r = spawnSync(process.execPath, [CLI, ...argv], { cwd: f.base, env, encoding: 'utf8' });
        assert.equal(r.status, 2, argv.join(' '));
        assert.match(r.stderr, /--json/);
    }
});

test('--scan walks a directory for registries, and the next run remembers what it found', () => {
    const f = fixture();
    const far = path.join(f.base, 'elsewhere', 'deep', 'ws2');
    registry.ensureLayout(far);
    registry.writeSession(far, 'cccccccc-3333-4333-8333-333333333333', { task: 'scanned', stage: 'land', route: ['survey', 'land'],
        active: false, claims: [], started: new Date().toISOString(), updated: new Date().toISOString(), configDir: f.cfg });
    const env = { ...process.env, CLAUDE_CONFIG_DIR: f.cfg };
    const out = execFileSync(process.execPath, [CLI, '--scan', path.join(f.base, 'elsewhere')], { cwd: f.base, env, encoding: 'utf8' });
    assert.match(out, /2 registries · 1 live, 1 stale, 1 down/);
    assert.ok(fs.readFileSync(path.join(f.cfg, 'fankeel', 'station', 'station-data.js'), 'utf8').includes('scanned'));
    const again = execFileSync(process.execPath, [CLI], { cwd: f.base, env, encoding: 'utf8' });
    assert.match(again, /2 registries/, 'roots.json remembered the scanned registry');
    const inside = execFileSync(process.execPath, [CLI], { cwd: far, env, encoding: 'utf8' });
    assert.match(inside, /copy at /);
    assert.ok(fs.existsSync(path.join(far, '.fankeel', 'index.html')), 'run from inside a registry, the copy lands there');
});

// A dozen tests in this file call `serve()` in-process with `idleMs: 60e3`
// on the assumption that a minute is long enough never to fire during a
// test. Measured wrong: one full-suite run under real load left this whole
// file missing from the output — no failure, no file name, just gone — and
// idleMs: 500 with no `exitOnIdle` proved why in isolation: `touch()`'s idle
// timer called `process.exit(0)` inside the very process running the test,
// silently ending it with a clean exit code before it could finish. Each
// half below runs as its own child process, so a regression here costs that
// throwaway child rather than this file's own run.
// The probe waits for the idle timer to close the port — a bare TCP connect, never a request, because a request resets the timer — rather than sleeping a fixed 900ms.
test('a bare idleMs never ends the calling process, but main()\'s own --idle flag still does', () => {
    const cfg = tmp('fankeel-idle-');
    // `net.connect` and never `http.get`: `serve()` resets its idle timer on
    // every request (`touch()`), so polling over HTTP would keep it from ever
    // idling. A refused connect is the moment the timer fired and closed the
    // port; printing after it proves the process outlived it.
    const probe = "const net = require('node:net');"
        + "const { serve } = require(" + JSON.stringify(CLI) + ");"
        + "(async () => { const s = await serve({ configDir: " + JSON.stringify(cfg)
        + ", port: 0, idleMs: 300, open: false });"
        + " const port = Number(new URL(s.url).port);"
        + " const listening = () => new Promise((r) => { const c = net.connect(port, '127.0.0.1', () => { c.destroy(); r(true); }); c.on('error', () => r(false)); });"
        + " const t0 = Date.now();"
        + " while (await listening()) { if (Date.now() - t0 > 4000) { console.log('NEVER IDLED'); s.close(); return; } await new Promise((r) => setTimeout(r, 25)); }"
        + " console.log('SURVIVED'); })();";
    const inProcess = spawnSync(process.execPath, ['-e', probe], { encoding: 'utf8', timeout: 5000 });
    assert.equal(inProcess.status, 0, 'the probe child did not exit cleanly: ' + inProcess.stderr);
    assert.match(inProcess.stdout, /SURVIVED/,
        'a bare idleMs ended its own process before it could finish: ' + inProcess.stdout + inProcess.stderr);

    // main()'s own `serve` verb is the one caller that should still opt in —
    // `--idle` has always meant "exit the process" for the real CLI. Run it
    // for real rather than in-process, and watch the process end on its own;
    // `timeout` below kills it if it does not, so a regression reads as a red
    // assertion here rather than a hung test or an orphaned process. `--idle`
    // is minutes: 0.005 is 300ms, well inside the 10-second deadline.
    const cfg2 = tmp('fankeel-idle-');
    const began = Date.now();
    const cli = spawnSync(process.execPath, [CLI, 'serve', '--port', '0', '--idle', '0.005'],
        { encoding: 'utf8', env: { ...process.env, CLAUDE_CONFIG_DIR: cfg2 }, timeout: 10000 });
    const took = Date.now() - began;
    assert.ok(cli.status !== null,
        'the CLI --idle path did not exit on its own within 10s and was killed: ' + JSON.stringify({ signal: cli.signal, took }));
    assert.equal(cli.status, 0, 'the CLI --idle path exited nonzero: ' + cli.stderr);
});

test('--detach is parsed, and portWasExplicit only when --port was given', () => {
    const { parseArgs } = require('../scripts/station.js');
    const a = parseArgs(['serve', '--detach']);
    assert.equal(a.detach, true, '--detach is parsed');
    assert.ok(!a.portWasExplicit, 'no --port: portWasExplicit is falsy');
    const b = parseArgs(['serve', '--port', '1234']);
    assert.equal(b.detach, false);
    assert.equal(b.portWasExplicit, true, '--port given: portWasExplicit is true');
});

test('--root and --scan repeat, and an unknown flag exits 2 with the old message shape', () => {
    const { parseArgs } = require('../scripts/station.js');
    const a = parseArgs(['--root', 'one', '--root', 'two', '--scan', 'x', '--scan', 'y']);
    assert.deepEqual(a.roots, ['one', 'two']);
    assert.deepEqual(a.scan, ['x', 'y']);
    const r = spawnSync(process.execPath, [CLI, '--bogus'], { encoding: 'utf8' });
    assert.equal(r.status, 2, 'an unknown flag exits 2');
    assert.match(r.stderr, /^station: unknown argument --bogus$/m, 'the message names the flag, same shape as before');
});

// The sixty-second `--scan` budget was exercised by nothing: every `--scan`
// test walks a temp tree that finishes in milliseconds, so a build that dropped
// the deadline — leaving the walk bounded only by depth, which is what it was
// before this change — passed all of them unchanged. Timing a real walk long
// enough to hit sixty seconds is not a test anyone would keep, so what is
// checked here is that the budget is computed and handed to the walk, which is
// the part that was missing. The walk's own obedience to a deadline is proved
// by `scanRoots stops mid-walk when its deadline is spent` in station.test.js.
test('a --scan run is given the sixty-second budget and a run with nothing to scan is given none', () => {
    const { scanDeadline } = require('../scripts/station.js');
    assert.equal(scanDeadline([]), undefined, 'nothing to scan, no clock');
    assert.equal(scanDeadline(undefined), undefined);
    const before = Date.now();
    const deadline = scanDeadline(['anywhere']);
    assert.ok(deadline >= before + 60000 && deadline <= Date.now() + 60000,
        'a minute out — not a second, and not Infinity: ' + (deadline - before) + 'ms');
});

test('--forget drops one root and keeps the rest', () => {
    const base = tmp('fankeel-forget-');
    const cfg = path.join(base, 'cfg');
    const rootsFile = path.join(cfg, 'fankeel', 'roots.json');
    fs.mkdirSync(path.dirname(rootsFile), { recursive: true });
    const keep = path.resolve(path.join(base, 'keep'));
    const drop = path.resolve(path.join(base, 'drop'));
    const now = new Date().toISOString();
    fs.writeFileSync(rootsFile, JSON.stringify({ [keep]: now, [drop]: now }, null, 2) + '\n');
    const env = { ...process.env, CLAUDE_CONFIG_DIR: cfg };
    const out = execFileSync(process.execPath, [CLI, '--forget', drop], { cwd: base, env, encoding: 'utf8' });
    assert.match(out, /forgot/);
    const after = JSON.parse(fs.readFileSync(rootsFile, 'utf8'));
    assert.ok(!Object.prototype.hasOwnProperty.call(after, drop), 'the forgotten root is gone');
    assert.ok(Object.prototype.hasOwnProperty.call(after, keep), 'the other root is kept');
});

test('--forget drops only the named root and keeps the scannedAt record', () => {
    const base = tmp('fankeel-forget-scanrec-');
    const cfg = path.join(base, 'cfg');
    const rootsFile = path.join(cfg, 'fankeel', 'roots.json');
    fs.mkdirSync(path.dirname(rootsFile), { recursive: true });
    const keep = path.resolve(path.join(base, 'keep'));
    const drop = path.resolve(path.join(base, 'drop'));
    const now = new Date().toISOString();
    const scannedAt = { at: now, roots: 2, depthCuts: 0, timedOut: false };
    fs.writeFileSync(rootsFile, JSON.stringify({ [keep]: now, [drop]: now, scannedAt }, null, 2) + '\n');
    const env = { ...process.env, CLAUDE_CONFIG_DIR: cfg };
    const out = execFileSync(process.execPath, [CLI, '--forget', drop], { cwd: base, env, encoding: 'utf8' });
    assert.match(out, /forgot/);
    const after = JSON.parse(fs.readFileSync(rootsFile, 'utf8'));
    assert.ok(!Object.prototype.hasOwnProperty.call(after, drop), 'the forgotten root is gone');
    assert.ok(Object.prototype.hasOwnProperty.call(after, keep), 'the other root is kept');
    assert.deepEqual(after.scannedAt, scannedAt, 'the first-run scan record survives forgetting an unrelated root');
});

test('--forget on a root nobody remembers says so and changes nothing', () => {
    const base = tmp('fankeel-forget-');
    const cfg = path.join(base, 'cfg');
    const rootsFile = path.join(cfg, 'fankeel', 'roots.json');
    fs.mkdirSync(path.dirname(rootsFile), { recursive: true });
    const keep = path.resolve(path.join(base, 'keep'));
    const now = new Date().toISOString();
    fs.writeFileSync(rootsFile, JSON.stringify({ [keep]: now }, null, 2) + '\n');
    const env = { ...process.env, CLAUDE_CONFIG_DIR: cfg };
    const out = execFileSync(process.execPath, [CLI, '--forget', path.join(base, 'never-seen')], { cwd: base, env, encoding: 'utf8' });
    assert.match(out, /not remembered/);
    const after = JSON.parse(fs.readFileSync(rootsFile, 'utf8'));
    assert.ok(Object.prototype.hasOwnProperty.call(after, keep), 'the only known root survives an unknown --forget');
});

test('the first run scans once and records that it did', () => {
    const base = tmp('fankeel-autoscan-');
    const cfg = path.join(base, 'cfg');
    fs.mkdirSync(cfg, { recursive: true });
    const env = { ...process.env, CLAUDE_CONFIG_DIR: cfg };
    const rootsFile = path.join(cfg, 'fankeel', 'roots.json');
    assert.ok(!fs.existsSync(rootsFile), 'nothing has written roots.json for this config dir yet');

    const t0 = Date.now();
    const out1 = execFileSync(process.execPath, [CLI], { cwd: base, env, encoding: 'utf8', timeout: 20000 });
    const elapsed1 = Date.now() - t0;
    assert.match(out1, /first run/);

    const after1 = JSON.parse(fs.readFileSync(rootsFile, 'utf8'));
    assert.ok(after1.scannedAt && typeof after1.scannedAt.at === 'string', 'roots.json records that the scan ran');
    const stamp1 = after1.scannedAt.at;

    // Whatever that walk had to give up on has to reach the page, not only
    // stdout: `discover` never saw this walk, so the header's two scan-cut
    // lines are silent unless `main()` hands `autoScan`'s counts into
    // `write()`. Guarded on the record rather than asserted flat, because a
    // machine small enough to finish every drive inside five seconds cuts
    // nothing and should say nothing. The rendering of that count into words
    // is `station.js`'s, in the browser; what the server writes is the data
    // those words come from.
    const data1 = fs.readFileSync(path.join(cfg, 'fankeel', 'station', 'station-data.js'), 'utf8');
    if (after1.scannedAt.timedOut) {
        assert.match(data1, /"timedOut":true/, 'a walk that ran out of time says so in the data');
    }
    if (after1.scannedAt.depthCuts > 0) {
        assert.ok(data1.includes('"depthCuts":' + after1.scannedAt.depthCuts),
            'the data carries the same count of depth cuts the record does');
    }

    const t1 = Date.now();
    const out2 = execFileSync(process.execPath, [CLI], { cwd: base, env, encoding: 'utf8', timeout: 20000 });
    const elapsed2 = Date.now() - t1;
    assert.ok(!/first run/.test(out2), 'a second run does not announce a scan');

    const after2 = JSON.parse(fs.readFileSync(rootsFile, 'utf8'));
    assert.equal(after2.scannedAt.at, stamp1, 'scannedAt is not rewritten by a run that did not scan');

    // Not the CLI: `station.write()` is what `hooks/inject.js` runs on every
    // `/fankeel` prompt, and it is the writer that used to rebuild roots.json
    // without this key. The record only counts as durable if it survives that.
    station.write({ configDir: cfg, cwd: base });
    const after3 = JSON.parse(fs.readFileSync(rootsFile, 'utf8'));
    assert.deepEqual(after3.scannedAt, after2.scannedAt,
        'a write of the page from outside this CLI leaves the scan record alone');

    // The budget is 5 seconds; a run that actually walked the machine's drives
    // again would sit near it, the way the first run just did. Three seconds
    // is comfortably below that and comfortably above what an ordinary run —
    // read a small registry, render a page — costs.
    assert.ok(elapsed2 < 3000, 'a run with roots.json already present does not re-walk the drives (took ' + elapsed2 + 'ms)');
    // The first run is the one AUTO_BUDGET_MS exists to bound, and until this
    // line the suite measured it and threw the number away — a budget raised to
    // anything under this test's own 20-second `timeout` shipped green. Measured
    // here on 2026-09-06: 6.0 seconds for a 5-second budget, so a second of
    // node start-up, the readdir in flight when the deadline landed, and the
    // write of the page. Nine seconds leaves that margin doubled and still
    // catches a budget moved to ten seconds or beyond. It is deliberately a
    // literal rather than `AUTO_BUDGET_MS + slack`: a bound that moves with the
    // budget is a bound the budget cannot break.
    assert.ok(elapsed1 < 9000, 'the first run stays inside its scan budget (took ' + elapsed1 + 'ms)');
});
