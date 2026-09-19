'use strict';
// The design's two page rows (docs/plans/2026-09-19-station-live-design.md,
// 怎麼算做完), run on the page script itself against a real serve: no browser,
// but the same station.js, the same data and detail scripts the server
// answers, and the same three-second re-read — its timer captured and fired by
// hand, the one thing a browser would have done on its own.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const registry = require('../lib/registry.js');
const tmp = require('./tmp.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
const SID = 'ffffffff-8888-4888-8888-888888888888';
const line = (o) => JSON.stringify(o) + '\n';
// A minute ago, so the process below started before any of it was written.
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

// A live session — this process under its id in sessions/ — with two Agent
// dispatches: one still on a Bash call, one finished.
function fixture() {
    const base = tmp('fankeel-live-page-');
    const cfg = path.join(base, 'cfg');
    const ws = path.join(base, 'ws');
    const proj = path.join(cfg, 'projects', 'ws-slug');
    const sub = path.join(proj, SID, 'subagents');
    fs.mkdirSync(sub, { recursive: true });
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    registry.ensureLayout(ws);
    registry.writeSession(ws, SID, { task: 'live page', stage: 'build', route: ['survey', 'build'], active: true,
        claims: [], started: T(0), updated: T(1), configDir: cfg });
    fs.writeFileSync(path.join(cfg, 'sessions', process.pid + '.json'),
        JSON.stringify({ pid: process.pid, sessionId: SID, cwd: ws, startedAt: Date.now() - 120000 }));
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'), JSON.stringify({ [path.resolve(ws)]: T(0) }) + '\n');
    fs.writeFileSync(path.join(proj, SID + '.jsonl'),
        line({ type: 'user', timestamp: T(0), message: { content: 'go' } })
        + line({ type: 'assistant', requestId: 'm1', timestamp: T(1), message: { model: 'claude-opus-5', usage: { input_tokens: 100 },
            content: [{ type: 'tool_use', id: 'toolu_1', name: 'Agent', input: { description: 'Task 3', subagent_type: 'general-purpose', prompt: 'x' } },
                { type: 'tool_use', id: 'toolu_2', name: 'Agent', input: { description: 'Task 4', subagent_type: 'general-purpose', prompt: 'y' } }] } }));
    const said = (s, content, stop) => line({ type: 'assistant', isSidechain: true, requestId: 'q' + s, timestamp: T(s),
        message: { model: 'claude-sonnet-5', usage: { input_tokens: 5 }, stop_reason: stop, content } });
    const open = line({ type: 'user', isSidechain: true, timestamp: T(2), message: { content: 'Build Task 3.' } })
        + said(3, [{ type: 'tool_use', id: 'u1', name: 'Bash', input: { command: 'node --test tests/a.test.js' } }], 'tool_use');
    fs.writeFileSync(path.join(sub, 'agent-a1b2c3.jsonl'), open);
    fs.writeFileSync(path.join(sub, 'agent-a1b2c3.meta.json'), JSON.stringify({ agentType: 'general-purpose', description: 'Task 3', toolUseId: 'toolu_1' }));
    fs.writeFileSync(path.join(sub, 'agent-d4e5f6.jsonl'), open
        + line({ type: 'user', isSidechain: true, timestamp: T(4), message: { content: [{ type: 'tool_result', tool_use_id: 'u1', content: 'ok' }] } })
        + said(5, [{ type: 'text', text: 'done' }], 'end_turn'));
    fs.writeFileSync(path.join(sub, 'agent-d4e5f6.meta.json'), JSON.stringify({ agentType: 'general-purpose', description: 'Task 4', toolUseId: 'toolu_2' }));
    return { cfg, ws, agent: path.join(sub, 'agent-a1b2c3.jsonl') };
}

// The page in a context of its own, whose <head> fetches each script it is
// handed from the server and runs it in that same context.
async function openPage(url, hash) {
    let html = '';
    const els = {};
    const el = (tag) => ({ tagName: String(tag || 'div').toUpperCase(), innerHTML: '', textContent: '', className: '', title: '',
        style: {}, hidden: false, parentNode: null, setAttribute() {}, getAttribute() { return null; }, appendChild() {}, addEventListener() {} });
    const page = el();
    Object.defineProperty(page, 'innerHTML', { get() { return html; }, set(v) { html = v; } });
    els.page = page;
    const timers = {};
    const pending = [];
    // `reload()` (Task 6's re-read deadline) races a `w.setTimeout` against the
    // script's own onload/onerror; a stub that never fires lets the real load
    // always win, the same as this harness never firing `setInterval` itself.
    const win = { location: { hash, protocol: 'http:' }, addEventListener() {}, scrollTo() {},
        setInterval: (fn, ms) => { timers[ms] = fn; return 1; }, setTimeout: () => 1, clearTimeout() {} };
    const ctx = vm.createContext({ window: win, URLSearchParams, fetch: () => Promise.resolve({ ok: true }) });
    ctx.document = {
        getElementById: (id) => els[id] || (els[id] = el()), addEventListener() {}, createElement: el, querySelectorAll: () => [],
        querySelector: () => ({ parentNode: { insertBefore() {} }, nextSibling: null }),
        head: {
            appendChild(s) {
                s.parentNode = { removeChild() {} };
                pending.push(get(url + s.src).then((text) => { vm.runInContext(text, ctx); s.onload(); }, () => s.onerror()));
            },
        },
    };
    vm.runInContext(await get(url + 'station/station-data.js'), ctx);
    vm.runInContext(SRC, ctx);
    const drain = async () => { while (pending.length) { await pending.shift(); await settle(); } };
    await drain();
    return { html: () => html, refresh: async () => { timers[3000](); await settle(); await drain(); } };
}

test('on the served page a live row\'s running count equals its running rows, and a tool the agent starts shows within two re-reads', async () => {
    const f = fixture();
    const { serve } = require('../scripts/station.js');
    const s = await serve({ configDir: f.cfg, roots: [f.ws], port: 0, idleMs: 60e3, open: false });
    try {
        const home = await openPage(s.url, '#/');
        // From F:/ymlab/fankeel, `serve()`'s own `cwd: process.cwd()` (Task 1)
        // also lists the real fankeel registry, which can hold a real, live
        // session more recent than the fixture's — so the first `running N`
        // on the page is not necessarily the fixture's. The row for `SID`
        // carries it in `data-href="#/s/<id>"` (`recentHtml`); anchor on that.
        const rowAt = home.html().indexOf('data-href="#/s/' + SID + '"');
        assert.ok(rowAt >= 0, 'the fixture session has no row on the home page');
        const row = home.html().slice(rowAt, home.html().indexOf('</tr>', rowAt));
        const listed = /running (\d+)<\/span>/.exec(row);
        assert.ok(listed, 'the live row carries no running count');
        const on = await openPage(s.url, '#/s/' + SID + '/dispatch');
        const rows = (on.html().match(/<tr class="[^"]*\bis-running\b/g) || []).length;
        assert.equal(Number(listed[1]), 1, 'one of the two agents is running');
        assert.equal(rows, Number(listed[1]), 'the list and the session page disagree');
        assert.match(on.html(), /<span class="k">正在<\/span><span class="c" title="Bash: node --test tests\/a\.test\.js">/);
        // The agent moves on: its Bash answered, a Grep started. The page is not
        // reloaded — only its re-read timer fires, as a browser would fire it.
        fs.appendFileSync(f.agent, line({ type: 'user', isSidechain: true, timestamp: new Date().toISOString(),
            message: { content: [{ type: 'tool_result', tool_use_id: 'u1', content: 'ok' }] } })
            + line({ type: 'assistant', isSidechain: true, requestId: 'q9', timestamp: new Date().toISOString(),
                message: { model: 'claude-sonnet-5', usage: { input_tokens: 5 }, stop_reason: 'tool_use',
                    content: [{ type: 'tool_use', id: 'u2', name: 'Grep', input: { pattern: 'keyOf' } }] } }));
        let seen = 0;
        for (let cycle = 1; cycle <= 2 && !seen; cycle++) {
            await on.refresh();
            if (/<span class="c" title="Grep keyOf">/.test(on.html())) seen = cycle;
        }
        assert.ok(seen, 'the new tool was not on the page after two re-reads');
    } finally {
        s.close();
    }
});
