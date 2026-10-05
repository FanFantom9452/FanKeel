'use strict';
// Runs hooks/inject.js the way Claude Code runs it — a fresh node, the payload
// on stdin — once with shim.cjs preloaded and once bare, per case per run, and
// prints the median and max of every line the shim logged.
// usage: node probe.cjs <plugin root> <main tree root> <out dir> <session> [runs]
const cp = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const [plugin, mainRoot, out, session, runsArg] = process.argv.slice(2);
const runs = Number(runsArg || 5);
const shim = path.join(__dirname, 'shim.cjs');
const hook = path.join(plugin, 'hooks', 'inject.js');
const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(path.join(plugin, '.fankeel', 'sessions'), { recursive: true });

function serving() {
    try {
        const rec = JSON.parse(fs.readFileSync(path.join(configDir, 'fankeel', 'serve.json'), 'utf8'));
        process.kill(rec.pid, 0);
        return true;
    } catch (e) {
        return false;
    }
}

// The active case borrows a mid-task session's record from the main tree,
// copied under a fresh id so the real one is never touched.
function activeId() {
    const id = crypto.randomUUID();
    fs.copyFileSync(path.join(mainRoot, '.fankeel', 'sessions', session + '.json'),
        path.join(plugin, '.fankeel', 'sessions', id + '.json'));
    return id;
}

const cases = [
    { name: 'plain', prompt: 'hello', id: () => crypto.randomUUID(), env: {} },
    { name: 'fankeel-serve-off', prompt: '/fankeel', id: () => crypto.randomUUID(), env: { FANKEEL_SERVE: 'off' } },
    { name: 'fankeel', prompt: '/fankeel', id: () => crypto.randomUUID(), env: {}, needsServe: true },
    { name: 'active', prompt: 'hello', id: activeId, env: {} },
];

function once(c, withShim) {
    const log = path.join(out, c.name + '.log');
    const payload = JSON.stringify({ session_id: c.id(), prompt: c.prompt, cwd: plugin, hook_event_name: 'UserPromptSubmit', transcript_path: '' });
    const args = withShim ? ['--require', shim, hook] : [hook];
    const env = Object.assign({}, process.env, c.env, { INJECT_TIMING_LOG: log, INJECT_TIMING_PLUGIN: plugin });
    const t0 = process.hrtime.bigint();
    const res = cp.spawnSync(process.execPath, args, { input: payload, env, encoding: 'utf8', timeout: 20000 });
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    fs.appendFileSync(path.join(out, 'wall.tsv'),
        [c.name, withShim ? 'shim' : 'bare', ms.toFixed(1), res.status, (res.stdout || '').length].join('\t') + '\n');
}

for (let r = 0; r < runs; r++) {
    const order = r % 2 ? cases.slice().reverse() : cases;
    for (const c of order) {
        if (c.needsServe && !serving()) {
            fs.appendFileSync(path.join(out, 'wall.tsv'), [c.name, 'skipped: no station serving'].join('\t') + '\n');
            continue;
        }
        once(c, true);
        once(c, false);
    }
}

const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];
for (const c of cases) {
    const file = path.join(out, c.name + '.log');
    if (!fs.existsSync(file)) continue;
    const by = new Map();
    for (const block of fs.readFileSync(file, 'utf8').split('---\n')) {
        for (const line of block.split('\n').filter(Boolean)) {
            const parts = line.split(' ');
            const ms = Number(parts.pop());
            const key = parts.join(' ');
            if (!by.has(key)) by.set(key, []);
            by.get(key).push(ms);
        }
    }
    console.log('== ' + c.name);
    for (const [key, xs] of by) console.log(key + '\tmedian ' + median(xs).toFixed(1) + '\tmax ' + Math.max(...xs).toFixed(1) + '\tn ' + xs.length);
}
