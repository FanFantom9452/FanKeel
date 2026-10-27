'use strict';
// The station fills the new /m fields: phone.json's context (transcript usage against compact.at)
// and limits (the newest row of .fankeel/build/limits/<id>.jsonl), holdUntil from holding.json,
// and mobile.json's device for a paired phone.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const registry = require('../lib/registry.js');
const profile = require('../lib/profile.js');
const remote = require('../lib/remote.js');
const phone = require('../lib/phone.js');
const { serve } = require('../scripts/station.js');
const tmp = require('./tmp.js');

const NAME = 'ymlab-pc.tail1234.ts.net';
const ONE = 'ffffffff-8888-4888-8888-88888888889a';

function fixture(on) {
    const base = tmp('fankeel-station-mobile-data-');
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(r1);
    registry.writeSession(r1, ONE, { task: '手機資料', stage: 'design', route: ['survey', 'design'], active: true, claims: [], started: '2026-10-27T08:00:00.000Z', updated: new Date().toISOString(), configDir: cfg });
    fs.writeFileSync(path.join(cfg, 'sessions', ONE + '.json'), JSON.stringify({ pid: process.pid, sessionId: ONE, cwd: r1, startedAt: Date.now() }));
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'), JSON.stringify({ [path.resolve(r1)]: '2026-10-27T08:00:00.000Z' }) + '\n');
    if (on) assert.equal(profile.write(profile.machineFile(cfg), 'station.remote', 'true').ok, true);
    const limits = path.join(r1, '.fankeel', 'build', 'limits');
    fs.mkdirSync(limits, { recursive: true });
    fs.writeFileSync(path.join(limits, ONE + '.jsonl'), [
        { at: '2026-10-27T13:00:00.000Z', task: 't', stage: 'design', five: 2, fiveResets: '2026-10-27T18:00:00.000Z', seven: 45, sevenResets: '2026-10-30T03:00:00.000Z' },
        { at: '2026-10-27T13:30:00.000Z', task: 't', stage: 'design', five: 4, fiveResets: '2026-10-27T18:00:00.000Z', seven: 46, sevenResets: '2026-10-30T03:00:00.000Z' },
    ].map((r) => JSON.stringify(r)).join('\n') + '\n');
    fs.mkdirSync(phone.dirOf(r1, ONE), { recursive: true });
    fs.writeFileSync(path.join(phone.dirOf(r1, ONE), 'holding.json'), JSON.stringify({ since: Date.now(), until: Date.now() + 600e3 }));
    const proj = path.join(cfg, 'projects', 'ws');
    fs.mkdirSync(proj, { recursive: true });
    fs.writeFileSync(path.join(proj, ONE + '.jsonl'), JSON.stringify({ type: 'assistant', timestamp: '2026-10-27T13:30:00.000Z', message: { role: 'assistant', model: 'claude-opus-5-5', usage: { input_tokens: 1000, cache_creation_input_tokens: 0, cache_read_input_tokens: 379000, output_tokens: 10 }, content: [] } }) + '\n');
    return { cfg, r1 };
}
function fakeTailscale() {
    let proxy = null;
    return (args) => {
        const a = args.join(' ');
        if (a === 'status --json') return { status: 0, stdout: JSON.stringify({ BackendState: 'Running', Self: { DNSName: NAME + '.' } }), stderr: '' };
        if (a === 'serve status --json') return { status: 0, stdout: proxy ? JSON.stringify({ Web: { [NAME + ':443']: { Handlers: { '/': { Proxy: proxy } } } } }) : '{}', stderr: '' };
        const bg = /^serve --bg (\d+)$/.exec(a);
        if (bg) { proxy = 'http://127.0.0.1:' + bg[1]; return { status: 0, stdout: '', stderr: '' }; }
        return { status: 1, stdout: '', stderr: 'unexpected: ' + a };
    };
}
const get = (port, pathname, headers) => new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: pathname, method: 'GET', headers: headers || {} }, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve({ status: res.statusCode, text }));
    });
    req.on('error', reject);
    req.end();
});
async function served(on, f) {
    const fx = fixture(on);
    const s = await serve({ configDir: fx.cfg, port: 0, idleMs: 60e3, open: false, tailscaleRun: fakeTailscale() });
    try {
        await f(Object.assign({ port: Number(new URL(s.url).port) }, fx));
    } finally {
        s.close();
    }
}

test('phone.json carries the transcript\'s context against compact.at, the newest limits row, and holdUntil', () => served(false, async (s) => {
    const res = await get(s.port, '/station/phone.json?id=' + ONE);
    assert.equal(res.status, 200);
    const p = JSON.parse(res.text);
    assert.deepEqual(p.context, { tokens: 380000, at: 350000, window: null });
    assert.deepEqual(p.limits, { at: Date.parse('2026-10-27T13:30:00.000Z'), five: 4, fiveResets: Date.parse('2026-10-27T18:00:00.000Z'), seven: 46, sevenResets: Date.parse('2026-10-30T03:00:00.000Z') });
    assert.ok(p.holdUntil > Date.now(), 'holding.json is ahead');
}));

test('mobile.json: device is null from this machine, the paired phone through the tailnet; rows carry holdUntil', () => served(true, async (s) => {
    const local = JSON.parse((await get(s.port, '/station/mobile.json')).text);
    assert.equal(local.device, null);
    assert.ok(local.tasks[0].holdUntil > Date.now());
    const now = Date.now();
    const got = remote.pair(s.cfg, remote.newCode(s.cfg, now).value, 'S24', now);
    const away = JSON.parse((await get(s.port, '/station/mobile.json', { host: NAME, cookie: 'fk_device=' + got.token })).text);
    assert.equal(away.device.name, 'S24');
    assert.equal(typeof away.device.paired, 'number');
}));
