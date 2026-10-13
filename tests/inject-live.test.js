'use strict';

// The live list hooks/inject.js leaves for the mod: hooks/pane.ts has no pid to
// signal, so it reads who is still running from the file this hook writes.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const tmp = require('./tmp.js');

const HOOK = path.join(__dirname, '..', 'hooks', 'inject.js');
const MINE = 'aaaaaaaa-0000-4000-8000-000000000001';
const THEIRS = 'bbbbbbbb-0000-4000-8000-000000000002';
const GONE = 'cccccccc-0000-4000-8000-000000000003';
// A pid no operating system hands out: signalling it is ESRCH.
const GONE_PID = 2147483646;

const ago = (ms) => new Date(Date.now() - ms).toISOString();

function seed(root, sessionId, over) {
    const dir = path.join(root, '.fankeel', 'sessions');
    fs.mkdirSync(dir, { recursive: true });
    const data = Object.assign({
        task: 'rework the colour ramp',
        scope: ['statusline.ps1'],
        stage: 'implement',
        active: true,
        started: ago(2 * 3600e3),
        updated: ago(3600e3),
    }, over);
    fs.writeFileSync(path.join(dir, sessionId + '.json'), JSON.stringify(data, null, 2) + '\n');
    return data;
}

// Claude Code's own registry of running sessions: one file a pid. This session
// is the test process, a live neighbour is its parent.
function seedLive(cfg, entries) {
    const dir = path.join(cfg, 'sessions');
    fs.mkdirSync(dir, { recursive: true });
    for (const [sessionId, pid] of entries) {
        fs.writeFileSync(path.join(dir, pid + '.json'), JSON.stringify({ pid, sessionId }) + '\n');
    }
}

function run(payload, claudeDir) {
    return execFileSync(process.execPath, [HOOK], {
        input: JSON.stringify(payload),
        encoding: 'utf8',
        env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: claudeDir || tmp('fankeel-cfg-'), FANKEEL_SERVE: 'off' }),
    });
}

const liveFile = (root) => path.join(root, '.fankeel', 'build', 'live.json');
const readLive = (root) => JSON.parse(fs.readFileSync(liveFile(root), 'utf8'));

test('a prompt writes the neighbours whose process is running to .fankeel/build/live.json', () => {
    const root = tmp('fankeel-live-');
    const cfg = tmp('fankeel-cfg-');
    seed(root, MINE);
    seed(root, THEIRS);
    seed(root, GONE);
    seedLive(cfg, [[MINE, process.pid], [THEIRS, process.ppid], [GONE, GONE_PID]]);
    const before = Date.now();
    assert.match(run({ session_id: MINE, cwd: root }, cfg), /FANKEEL ACTIVE/);
    const got = readLive(root);
    assert.deepEqual(Object.keys(got).sort(), ['at', 'ids']);
    assert.deepEqual(got.ids, [THEIRS]);
    assert.ok(Number.isFinite(got.at) && got.at >= before && got.at <= Date.now(), String(got.at));
});

test('a neighbour that stood down is not in the list, and this session never is', () => {
    const root = tmp('fankeel-live-');
    const cfg = tmp('fankeel-cfg-');
    seed(root, MINE);
    seed(root, THEIRS, { active: false });
    seedLive(cfg, [[MINE, process.pid], [THEIRS, process.ppid]]);
    run({ session_id: MINE, cwd: root }, cfg);
    assert.deepEqual(readLive(root).ids, []);
});

test('where liveness cannot be judged the list is null, which is not the same as empty', () => {
    const root = tmp('fankeel-live-');
    seed(root, MINE);
    seed(root, THEIRS);
    // A config directory this session is not in: lib/live.js readLive says known is false.
    run({ session_id: MINE, cwd: root }, tmp('fankeel-cfg-'));
    assert.equal(readLive(root).ids, null);
});

test('every prompt writes the list again, and leaves no temporary file beside it', () => {
    const root = tmp('fankeel-live-');
    const cfg = tmp('fankeel-cfg-');
    seed(root, MINE);
    seed(root, THEIRS);
    seedLive(cfg, [[MINE, process.pid], [THEIRS, process.ppid]]);
    run({ session_id: MINE, cwd: root }, cfg);
    const first = readLive(root);
    assert.deepEqual(first.ids, [THEIRS]);
    fs.unlinkSync(path.join(cfg, 'sessions', process.ppid + '.json'));
    run({ session_id: MINE, cwd: root }, cfg);
    const second = readLive(root);
    assert.deepEqual(second.ids, []);
    assert.ok(second.at >= first.at);
    assert.deepEqual(fs.readdirSync(path.dirname(liveFile(root))).filter((name) => name !== 'live.json' && name.startsWith('live.json')), []);
});

test('a session with no task of its own writes no list', () => {
    const root = tmp('fankeel-live-');
    seed(root, THEIRS);
    assert.equal(run({ session_id: MINE, cwd: root }), '');
    assert.equal(fs.existsSync(liveFile(root)), false);
});

test('a list that cannot be written does not cost the injection', () => {
    const root = tmp('fankeel-live-');
    const cfg = tmp('fankeel-cfg-');
    seed(root, MINE);
    seedLive(cfg, [[MINE, process.pid]]);
    // A directory where the file should be: the rename onto it fails.
    fs.mkdirSync(liveFile(root), { recursive: true });
    assert.match(run({ session_id: MINE, cwd: root }, cfg), /FANKEEL ACTIVE/);
    assert.equal(fs.statSync(liveFile(root)).isDirectory(), true);
    assert.deepEqual(fs.readdirSync(path.dirname(liveFile(root))).filter((name) => name !== 'live.json' && name.startsWith('live.json')), []);
});
