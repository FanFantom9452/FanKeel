'use strict';
// The focus page as served (docs/90-agent/plans/2026-10-21-station-focus-design.md §1):
// `/f/<id>/<tab>` is a shell that loads `/station/focus/<id>.js` and never
// station-data.js, both answered inside 200 ms with no gather() behind them.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const registry = require('../lib/registry.js');
const plantasks = require('../lib/plantasks.js');
const { serve } = require('../scripts/station.js');
const tmp = require('./tmp.js');

const SID = 'abababab-7777-4777-8777-777777777777';
const REAL = path.join(__dirname, '..', 'docs', '99-archive', '2026-10-18-deny-posix-helpers.md');

function fixture() {
    const base = tmp('fankeel-focus-route-');
    const cfg = path.join(base, 'cfg');
    const root = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    registry.ensureLayout(root);
    fs.mkdirSync(path.join(root, 'docs', 'plans'), { recursive: true });
    fs.copyFileSync(REAL, path.join(root, 'docs', 'plans', 'x.md'));
    registry.writeSession(root, SID, { active: false, task: 'route fixture', stage: 'plan', route: ['survey', 'plan', 'build', 'verify', 'land'],
        started: '2026-10-21T10:00:00.000Z', claims: ['docs/plans/x.md'], configDir: cfg });
    return { cfg, root };
}

const get = (url) => new Promise((resolve, reject) => {
    http.get(url, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], location: res.headers.location, text }));
    }).on('error', reject);
});

test('/f/<id>/plan and its focus script answer inside 200 ms, with no station-data.js', async () => {
    const f = fixture();
    const s = await serve({ configDir: f.cfg, roots: [f.root], port: 0, idleMs: 60e3, open: false });
    try {
        const t0 = performance.now();
        const page = await get(s.url + 'f/' + SID + '/plan');
        const data = await get(s.url + 'station/focus/' + SID + '.js');
        const ms = performance.now() - t0;
        assert.equal(page.status, 200);
        assert.match(page.type, /^text\/html/);
        assert.ok(page.text.includes('/station/focus/' + SID + '.js'));
        assert.doesNotMatch(page.text, /station-data\.js/);
        assert.equal(data.status, 200);
        assert.match(data.type, /^text\/javascript/);
        assert.ok(ms < 200, 'took ' + Math.round(ms) + ' ms');
        const box = { window: {} };
        vm.runInNewContext(data.text, box);
        assert.equal(box.window.STATION.sessions[0].id, SID);
        assert.equal(box.window.STATION_DETAIL[SID].tasks[0].tasks.length, plantasks.parseTasks(fs.readFileSync(REAL, 'utf8')).length);
    } finally {
        s.close();
    }
});

test('a session with no entry is 404; a tab the focus page does not draw opens the full station on it', async () => {
    const f = fixture();
    const s = await serve({ configDir: f.cfg, roots: [f.root], port: 0, idleMs: 60e3, open: false });
    try {
        assert.equal((await get(s.url + 'station/focus/cdcdcdcd-8888-4888-8888-888888888888.js')).status, 404);
        const other = await get(s.url + 'f/' + SID + '/dispatch');
        assert.equal(other.status, 303);
        assert.equal(other.location, '/#/s/' + SID + '/dispatch');
        assert.equal((await get(s.url + 'f/' + SID + '/gate')).status, 200);
    } finally {
        s.close();
    }
});
