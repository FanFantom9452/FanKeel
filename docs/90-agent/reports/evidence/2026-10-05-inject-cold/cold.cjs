'use strict';
// inject-3: what hooks/inject.js costs on a `/fankeel` prompt when no station is
// running (cold), when one is (warm), and when every synchronous fs call waits
// 2 or 5 ms first (slow-2, slow-5: slow.cjs, a stand-in for a slow disk, not a
// measurement of one). Each run is a fresh node with the payload on stdin,
// slow.cjs and the 2026-10-05 timing probe's shim.cjs preloaded.
//
// The cold arm stops this machine's station before each run, and the station
// the hook then starts opens a browser tab: five cold runs open five tabs. At
// the end every station this script saw is stopped; the next `/fankeel` starts
// one again.
//
// usage: node cold.cjs <plugin root> <out dir> [runs]
const cp = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const [pluginArg, outArg, runsArg] = process.argv.slice(2);
if (!pluginArg || !outArg) {
    console.error('usage: node cold.cjs <plugin root> <out dir> [runs]');
    process.exit(2);
}
const plugin = path.resolve(pluginArg);
const out = path.resolve(outArg);
const runs = Number(runsArg || 5);
const shim = path.join(__dirname, '..', '2026-10-05-inject-timing', 'shim.cjs');
const slow = path.join(__dirname, 'slow.cjs');
const hook = path.join(plugin, 'hooks', 'inject.js');
const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const recordFile = path.join(configDir, 'fankeel', 'serve.json');
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(path.join(plugin, '.fankeel', 'sessions'), { recursive: true });

const cell = new Int32Array(new SharedArrayBuffer(4));
const sleep = (ms) => Atomics.wait(cell, 0, 0, ms);

function record() {
    try {
        return JSON.parse(fs.readFileSync(recordFile, 'utf8'));
    } catch (e) {
        return null;
    }
}

function alive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch (e) {
        return false;
    }
}

function serving() {
    const r = record();
    return Boolean(r && alive(r.pid));
}

function stopStation() {
    const r = record();
    if (r && alive(r.pid)) {
        try { process.kill(r.pid); } catch (e) { /* already gone */ }
        for (let i = 0; i < 100 && alive(r.pid); i++) sleep(50);
    }
    try { fs.unlinkSync(recordFile); } catch (e) { /* none */ }
    return true;
}

// A station from this plugin root and without --open, so the warm arms find
// one whose fingerprint matches and the hook starts none.
function startStation() {
    if (serving()) return true;
    const child = cp.spawn(process.execPath, [path.join(plugin, 'scripts', 'station.js'), 'serve'],
        { detached: true, stdio: 'ignore', windowsHide: true });
    child.unref();
    for (let i = 0; i < 200; i++) {
        if (serving()) return true;
        sleep(50);
    }
    return false;
}

const arms = [
    { name: 'cold', before: stopStation, slowMs: 0 },
    { name: 'warm', before: startStation, slowMs: 0 },
    { name: 'slow-2', before: startStation, slowMs: 2 },
    { name: 'slow-5', before: startStation, slowMs: 5 },
];

function once(arm, round) {
    if (!arm.before()) {
        fs.appendFileSync(path.join(out, 'wall.tsv'), [arm.name, round, 'skipped: no station came up'].join('\t') + '\n');
        return;
    }
    const payload = JSON.stringify({ session_id: crypto.randomUUID(), prompt: '/fankeel', cwd: plugin, hook_event_name: 'UserPromptSubmit', transcript_path: '' });
    const env = Object.assign({}, process.env, {
        INJECT_TIMING_LOG: path.join(out, arm.name + '.log'),
        INJECT_TIMING_PLUGIN: plugin,
        SLOW_FS_MS: String(arm.slowMs),
        SLOW_FS_COUNT_LOG: path.join(out, arm.name + '.fscalls'),
    });
    delete env.FANKEEL_SERVE;
    const t0 = Date.now();
    const res = cp.spawnSync(process.execPath, ['--require', slow, '--require', shim, hook], { input: payload, env, encoding: 'utf8', timeout: 20000 });
    const wall = Date.now() - t0;
    // When the station this run started bound, from its own record's `started`.
    let bound = '';
    if (arm.name === 'cold') {
        for (let i = 0; i < 200; i++) {
            const r = record();
            if (r && alive(r.pid) && r.started) {
                bound = String(Date.parse(r.started) - t0);
                break;
            }
            sleep(50);
        }
    }
    let line = 'no block';
    try {
        line = (/^station: .*$/m.exec(JSON.parse(res.stdout).hookSpecificOutput.additionalContext) || ['no station line'])[0];
    } catch (e) { /* no block */ }
    fs.appendFileSync(path.join(out, 'wall.tsv'), [arm.name, round, wall, res.status, res.signal || '', bound, line].join('\t') + '\n');
}

fs.writeFileSync(path.join(out, 'provenance.txt'), [
    'date: ' + new Date().toISOString(),
    'plugin: ' + plugin,
    'HEAD: ' + cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: plugin, encoding: 'utf8' }).trim(),
    'porcelain:',
    cp.execFileSync('git', ['status', '--porcelain'], { cwd: plugin, encoding: 'utf8' }),
    'node: ' + process.version + '  runs: ' + runs,
].join('\n') + '\n');

stopStation();
for (let r = 0; r < runs; r++) {
    const order = r % 2 ? arms.slice().reverse() : arms;
    for (const arm of order) once(arm, r + 1);
}
stopStation();

const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const rows = fs.readFileSync(path.join(out, 'wall.tsv'), 'utf8').split('\n').filter(Boolean).map((l) => l.split('\t'));
for (const arm of arms) {
    const mine = rows.filter((r) => r[0] === arm.name && r.length === 7);
    const walls = mine.map((r) => Number(r[2]));
    console.log('== ' + arm.name + '  runs ' + mine.length + '  skipped ' + rows.filter((r) => r[0] === arm.name && r.length !== 7).length);
    if (walls.length) console.log('wall\tmedian ' + median(walls) + '\tmax ' + Math.max(...walls) + '\texits ' + [...new Set(mine.map((r) => r[3]))].join(','));
    const bounds = mine.map((r) => r[5]).filter(Boolean).map(Number);
    if (bounds.length) console.log('bound\tmedian ' + median(bounds) + '\tmax ' + Math.max(...bounds));
    for (const l of [...new Set(mine.map((r) => r[6].replace(/http:\/\/127\.0\.0\.1:\d+\//, '<url>').replace(/\d+ stale, \d+ live/, 'N stale, N live')))]) console.log('line\t' + l);
    const fsFile = path.join(out, arm.name + '.fscalls');
    if (fs.existsSync(fsFile)) {
        const calls = fs.readFileSync(fsFile, 'utf8').split('\n').filter(Boolean).map(Number);
        console.log('fs calls\tmedian ' + median(calls) + '\tmax ' + Math.max(...calls));
    }
    const logFile = path.join(out, arm.name + '.log');
    if (!fs.existsSync(logFile)) continue;
    const by = new Map();
    for (const block of fs.readFileSync(logFile, 'utf8').split('---\n')) {
        for (const l of block.split('\n').filter(Boolean)) {
            const parts = l.split(' ');
            const ms = Number(parts.pop());
            const key = parts.join(' ');
            if (!by.has(key)) by.set(key, []);
            by.get(key).push(ms);
        }
    }
    for (const [key, xs] of by) console.log(key + '\tmedian ' + median(xs).toFixed(1) + '\tmax ' + Math.max(...xs).toFixed(1) + '\tn ' + xs.length);
}
