'use strict';
// The served page's re-read (docs/90-agent/plans/2026-10-21-station-focus-design.md §2):
// the list and the live detail on screen are asked for in the same tick, not
// the detail after the list has landed, and a tab shown again re-reads at once
// after re-reading nothing while hidden. The page runs in a vm context against
// a real serve, as in tests/station-live-page.test.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const registry = require('../lib/registry.js');
const { serve } = require('../scripts/station.js');
const tmp = require('./tmp.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
const SID = 'efefefef-5656-4565-8565-565656565656';
const line = (o) => JSON.stringify(o) + '\n';
const T = (s) => new Date(Date.now() - 60000 + s * 1000).toISOString();
const settle = () => new Promise((r) => { setImmediate(r); });
const get = (url) => new Promise((resolve, reject) => {
    http.get(url, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve(text));
    }).on('error', reject);
});

// A live session — this process under its id in sessions/ — with a transcript, so it has a detail.
function fixture() {
    const base = tmp('fankeel-poll-');
    const cfg = path.join(base, 'cfg');
    const ws = path.join(base, 'ws');
    const proj = path.join(cfg, 'projects', 'ws-slug');
    fs.mkdirSync(proj, { recursive: true });
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    registry.ensureLayout(ws);
    registry.writeSession(ws, SID, { task: 'poll', stage: 'build', route: ['survey', 'build'], active: true,
        claims: [], started: T(0), updated: T(1), configDir: cfg });
    fs.writeFileSync(path.join(cfg, 'sessions', process.pid + '.json'),
        JSON.stringify({ pid: process.pid, sessionId: SID, cwd: ws, startedAt: Date.now() - 120000 }));
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'), JSON.stringify({ [path.resolve(ws)]: T(0) }) + '\n');
    fs.writeFileSync(path.join(proj, SID + '.jsonl'),
        line({ type: 'user', timestamp: T(0), message: { content: 'go' } })
        + line({ type: 'assistant', requestId: 'm1', timestamp: T(1), message: { model: 'claude-opus-5', usage: { input_tokens: 100 }, content: [{ type: 'text', text: 'ok' }] } }));
    return { base, cfg, ws };
}

// The page in a context of its own. Every script tag it appends is recorded by
// src (the `?t=` cache-buster dropped) before it is fetched and run.
async function openPage(url, hash) {
    let html = '';
    const els = {};
    const el = (tag) => ({ tagName: String(tag || 'div').toUpperCase(), innerHTML: '', textContent: '', className: '', title: '',
        style: {}, hidden: false, parentNode: null, setAttribute() {}, getAttribute() { return null; }, appendChild() {}, addEventListener() {} });
    const page = el();
    Object.defineProperty(page, 'innerHTML', { get() { return html; }, set(v) { html = v; } });
    els.page = page;
    const timers = {};
    const listeners = {};
    const asked = [];
    const pending = [];
    const seen = { failList: false, repaints: 0 };
    // repaint() ends in scrollTo, which a bare draw() does not call.
    const win = { location: { hash, protocol: 'http:' }, addEventListener() {}, scrollTo() { seen.repaints++; },
        setInterval: (fn, ms) => { timers[ms] = fn; return 1; }, setTimeout: () => 1, clearTimeout() {} };
    const ctx = vm.createContext({ window: win, URLSearchParams, fetch: () => Promise.resolve({ ok: true }) });
    ctx.document = {
        hidden: false,
        getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
        createElement: el, querySelectorAll: () => [],
        querySelector: () => ({ parentNode: { insertBefore() {} }, nextSibling: null }),
        head: {
            appendChild(s) {
                asked.push(String(s.src).replace(/[?&]t=\d+$/, ''));
                s.parentNode = { removeChild() {} };
                if (seen.failList && /station-data.js/.test(s.src)) { pending.push(Promise.resolve().then(() => s.onerror())); return; }
                pending.push(get(url + s.src).then((text) => { vm.runInContext(text, ctx); s.onload(); }, () => s.onerror()));
            },
        },
    };
    vm.runInContext(await get(url + 'station/station-data.js'), ctx);
    vm.runInContext(SRC, ctx);
    const drain = async () => { while (pending.length) { await pending.shift(); await settle(); } };
    await drain();
    asked.length = 0;
    return {
        doc: ctx.document, asked, drain, seen,
        tick: () => timers[3000](),
        fire: (type) => (listeners[type] || []).forEach((fn) => fn()),
    };
}

async function opened(t) {
    const f = fixture();
    const was = process.cwd();
    process.chdir(f.base);
    const s = await serve({ configDir: f.cfg, roots: [f.ws], port: 0, idleMs: 60e3, open: false });
    t.after(() => { s.close(); process.chdir(was); });
    return openPage(s.url, '#/s/' + SID);
}

const BOTH = ['station/station-data.js', 'station/detail/' + SID + '.js'];

test('a re-read asks for the list and the live detail on screen in the same tick', async (t) => {
    const p = await opened(t);
    p.tick();
    assert.deepEqual(p.asked, BOTH, 'the detail waited for the list');
    await p.drain();
});

test('a hidden tab re-reads nothing, and re-reads at once when it is shown again', async (t) => {
    const p = await opened(t);
    p.doc.hidden = true;
    p.tick();
    assert.deepEqual(p.asked, []);
    p.doc.hidden = false;
    p.fire('visibilitychange');
    assert.deepEqual(p.asked, BOTH);
    await p.drain();
});

test('a detail that lands while the list failed does not repaint the page', async (t) => {
    const p = await opened(t);
    p.seen.failList = true;
    p.tick();
    assert.deepEqual(p.asked, BOTH);
    await p.drain();
    assert.equal(p.seen.repaints, 0, 'repainted against the old list');
});
