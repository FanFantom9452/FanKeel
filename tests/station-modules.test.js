'use strict';
// The redesigned pages' modules wired in (station redesign §1–§5): the shell
// loads tip.js and the page modules between i18n.js and the spend modules,
// with a stylesheet each; the focus shell loads tip and gate-frame; a written
// station carries them all; serve answers each by name and nothing else.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const registry = require('../lib/registry.js');
const station = require('../lib/station.js');
const { serve } = require('../scripts/station.js');
const tmp = require('./tmp.js');

const ASSETS = path.join(__dirname, '..', 'assets', 'station');
const PAGES = ['tip', 'live-page', 'sessions-page', 'projects-page', 'project-page', 'session-page', 'session-dispatch', 'session-talk'];
const ALL = PAGES.concat(['gate-frame']);
const SPEND = ['spend-talk.js', 'spend-kinds.js', 'spend-range.js', 'spend-panel.js'];
const GLOBAL = { tip: 'FK_TIP', 'live-page': 'FK_LIVE', 'sessions-page': 'FK_SESSIONS', 'projects-page': 'FK_PROJECTS', 'project-page': 'FK_PROJECT',
    'session-page': 'FK_SESSION', 'session-dispatch': 'FK_SDISP', 'session-talk': 'FK_STALK', 'gate-frame': 'FK_GATE' };
const SID = 'abababab-1212-4121-8121-121212121212';

function fixture() {
    const base = tmp('fankeel-modules-');
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(r1);
    return { cfg, r1 };
}
const get = (url) => new Promise((resolve, reject) => {
    http.get(url, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
    }).on('error', reject);
});

test('every module has its script and its stylesheet, and sets its global when loaded', () => {
    for (const n of ALL) {
        for (const ext of ['.js', '.css']) assert.ok(fs.existsSync(path.join(ASSETS, n + ext)), n + ext);
        const win = {};
        const doc = { addEventListener() {}, removeEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
            createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, classList: { add() {}, remove() {}, toggle() {} } }), body: { appendChild() {} } };
        vm.runInNewContext(fs.readFileSync(path.join(ASSETS, n + '.js'), 'utf8'), { window: win, document: doc, module: { exports: {} } });
        assert.equal(typeof win[GLOBAL[n]], 'object', n + ' sets ' + GLOBAL[n]);
    }
});

test('the shell loads tip.js and the page modules after i18n.js and before the spend modules, each with its stylesheet', () => {
    for (const html of [fs.readFileSync(path.join(ASSETS, 'index.html'), 'utf8'), station.render()]) {
        const scripts = [...html.matchAll(/<script src="station\/([^"]+)"><\/script>/g)].map((m) => m[1]);
        assert.deepEqual(scripts, ['i18n.js'].concat(PAGES.map((n) => n + '.js'), SPEND, ['remote-card.js', 'station.js']));
        const sheets = [...html.matchAll(/<link rel="stylesheet" href="station\/([^"]+)">/g)].map((m) => m[1]);
        assert.deepEqual(sheets, ['station.css'].concat(PAGES.map((n) => n + '.css')));
    }
});

test('the focus page loads tip and gate-frame between i18n.js and station.js', () => {
    const html = station.focusShell(SID, 'gate');
    const scripts = [...html.matchAll(/<script src="\/station\/([^"]+)"><\/script>/g)].map((m) => m[1]);
    assert.deepEqual(scripts, ['focus/' + SID + '.js', 'i18n.js', 'tip.js', 'gate-frame.js', 'station.js']);
    const sheets = [...html.matchAll(/<link rel="stylesheet" href="\/station\/([^"]+)">/g)].map((m) => m[1]);
    assert.deepEqual(sheets, ['station.css', 'tip.css', 'gate-frame.css']);
});

test('a written station carries every module byte for byte', () => {
    const f = fixture();
    for (const n of ALL) for (const ext of ['.js', '.css']) assert.ok(station.EMITTED.includes('station/' + n + ext), n + ext);
    station.write({ configDir: f.cfg, root: f.r1 });
    for (const n of ALL) {
        for (const ext of ['.js', '.css']) {
            const at = path.join(f.cfg, 'fankeel', 'station', n + ext);
            assert.equal(fs.readFileSync(at, 'utf8'), fs.readFileSync(path.join(ASSETS, n + ext), 'utf8'), n + ext);
        }
    }
});

test('serve answers every module with its type, and still nothing it does not list', async () => {
    const f = fixture();
    const s = await serve({ configDir: f.cfg, roots: [f.r1], port: 0, idleMs: 60e3, open: false });
    try {
        for (const n of ALL) {
            for (const [ext, type] of [['.js', /text\/javascript/], ['.css', /text\/css/]]) {
                const res = await get(s.url + 'station/' + n + ext);
                assert.equal(res.status, 200, n + ext);
                assert.match(res.headers['content-type'], type, n + ext);
                assert.equal(res.text, fs.readFileSync(path.join(ASSETS, n + ext), 'utf8'), n + ext);
            }
        }
        for (const name of ['not-a-page.js', 'session-page.json', 'gate-frame.html', 'tip-x.css']) {
            assert.equal((await get(s.url + 'station/' + name)).status, 404, name);
        }
    } finally {
        s.close();
    }
});
