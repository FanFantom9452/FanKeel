'use strict';
// station-39: 詳細設定 `#/settings/detail[/<step>]` (assets/station/settings-detail.js)
// against the approved mockup route-settings-v9.html — the rail of ten
// chapters, one question a screen, 到這裡就好 / 繼續 at a chapter's end, the
// machine card that holds 常離開, the style that fills only what was not
// answered, prompt.* marked advanced, the agents table, the remote card on
// the remote step, and 寫入 posting the changed keys split project / machine.
const test = require('node:test');
const assert = require('node:assert/strict');
const { page, stringsLeft } = require('./station-module.js');

const DIR = 'F:\\proj';
// The page's values live in its vm; JSON brings them into this realm for deepEqual.
const plain = (x) => JSON.parse(JSON.stringify(x));
const SPEC = {
    keys: {}, efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
    agents: [{ name: 'fankeel-reader', model: 'sonnet', effort: 'medium' }, { name: 'fankeel-judge', model: 'fable', effort: 'xhigh' }],
    set: { machine: {}, projects: { [DIR]: { 'agent.fankeel-reader.model': 'haiku' } } },
};
const VALUES = { 'land.integration': 'merge', worktree: 'false', 'land.push': false, guard: 'ask', 'class.default': '', 'dispatch.floor': 'sonnet',
    'judge.model': 'fable', 'stage.agents': false, 'gate.station': 'off', 'gate.away': 'hint', 'design.mockup': false, 'sensitive.review': false };
// opt: machine / values replace the two boxes, fetch is the page's fetch, redraw its redraw.
function boot(hash, remote, opt) {
    const x = opt || {};
    const p = page(['settings-page.js', 'settings-steps.js', 'settings-detail.js'], {
        profiles: { machine: { values: x.machine || { 'station.remote': false }, sources: {}, unreadable: [] }, projects: { [DIR]: { values: x.values || VALUES, sources: {}, unreadable: [] } } },
        profileSpec: SPEC, nonce: 'n1' }, x.fetch ? { fetch: x.fetch } : undefined);
    if (remote) p.win.FK_REMOTE = { html: (serve) => '<div class="rm-card" data-serve="' + serve + '"></div>' };
    else delete p.win.FK_REMOTE;
    const D = p.M['settings-detail.js'];
    const posted = [];
    // Task 5's contract: one scope a call, o = { scope, project }, rows [{ k, to }], done(ok).
    p.win.FK_SETTINGS.post = (S, o, rows, done) => {
        assert.ok(o.scope === 'project' || o.scope === 'machine', 'o.scope');
        if (o.scope === 'project') assert.equal(o.project, DIR);
        for (const r of rows) assert.deepEqual(Object.keys(r).sort(), ['k', 'to']);
        posted.push(plain({ scope: o.scope, project: o.scope === 'project' ? o.project : null, rows }));
        done(true);
    };
    D.reset();
    const o = { hash: hash || '#/settings/detail', serve: true, configDir: 'C:\\cfg', redraw: x.redraw || (() => {}) };
    return { D, posted, html: () => D.page(p.win.STATION, o) };
}
// A click (or input) whose target answers closest() for `sel`, the page root
// and, given `data-field`, the field around it.
function ev(sel, attrs, type) {
    const a = attrs || {};
    const el = { disabled: false, value: a.value, checked: a.checked, getAttribute: (n) => (n in a ? a[n] : null),
        closest: (s) => (s === sel || s === '[data-block="v9-page"]' || (s === '[data-field]' && a['data-field']) ? el : null) };
    return { type: type || 'click', target: el, key: a.key, preventDefault() {} };
}
const pick = (D, o) => D.onClick(ev('.v9-opt', { 'data-o': o }));
const goTo = (D, id) => D.onClick(ev('[data-go]', { 'data-go': id }));
const act = (D, a) => D.onClick(ev('[data-act]', { 'data-act': a }));

test('the rail has the ten chapters and every step, and the page opens on the first quick question', () => {
    const { html } = boot();
    const h = html();
    assert.match(h, /data-block="v9-page"/);
    assert.equal((h.match(/<li class="v9-c[ "]/g) || []).length, 10);
    assert.equal((h.match(/class="v9-sb" data-go="/g) || []).length, 33);
    assert.match(h, /class="v9-endb" data-go="final"/);
    assert.match(h, /data-block="v9-q-main" data-step="main"/);
    assert.match(h, /快速設定 · 1 \/ 9/);
    assert.match(h, /<li class="v9-cut" role="presentation">細項：走到哪停都可以<\/li>/);
    assert.match(h, /<span class="v9-mtag"[^>]*>這台機器<\/span>/);
});

test('#/settings/detail/<step> opens that step, and the remote step carries the remote card when there is one', () => {
    let b = boot('#/settings/detail/remote', true);
    const h = b.html();
    assert.match(h, /data-block="v9-away-remote" data-step="remote"[\s\S]*<div class="rm-card" data-serve="true"><\/div><\/div><div class="v9-foot"/);
    assert.doesNotMatch(h, /v9-tag pend/);
    assert.match(h, /<span class="v9-oe">經 Tailscale 連進來（預設）/);
    b = boot('#/settings/detail/remote', false);
    assert.doesNotMatch(b.html(), /rm-card/);
});

test('發 PR makes 推不推遠端 not apply, and 下一步 passes over it', () => {
    const { D, html } = boot();
    html();
    pick(D, 'pr');
    assert.match(html(), /<li class="v9-s is-na" data-sid="push">/);
    act(D, 'next');
    assert.equal(D.state().at, 'sessions');
});

test('常離開 holds 下一步 until the machine card is answered, and the card writes the machine', () => {
    const { D, html } = boot();
    html();
    goTo(D, 'where');
    pick(D, 'away');
    let h = html();
    assert.match(h, /data-block="v9-machine-card"/);
    assert.match(h, /data-act="next" disabled/);
    D.onClick(ev('[data-mc]', { 'data-mc': 'yes' }));
    h = html();
    assert.doesNotMatch(h, /data-act="next" disabled/);
    const machine = plain(D.rows()).filter((r) => r.scope === 'machine').map((r) => [r.key, r.value]);
    assert.deepEqual(machine, [['notify.gate', 'true'], ['station.remote', 'true']]);
});

test('a style fills only what was not answered, and a chapter ends on 到這裡就好 / 繼續', () => {
    const { D, html } = boot();
    html();
    goTo(D, 'floor');
    pick(D, 'opus');
    goTo(D, 'style');
    pick(D, 'balanced');
    const by = Object.fromEntries(plain(D.changes()).map((c) => [c.k, [c.to, c.by]]));
    assert.deepEqual(by['dispatch.floor'], ['opus', 'floor']);
    assert.deepEqual(by['stage.agents'], ['survey,build,verify', 'style']);
    const h = html();
    assert.match(h, /data-act="stop"[^>]*>到這裡就好</);
    assert.match(h, /data-act="cont"[^>]*>繼續：<b>整合收尾<\/b>/);
    assert.doesNotMatch(h, /data-act="next"/);
    act(D, 'stop');
    assert.equal(D.state().at, 'final');
});

test('prompt.* is tagged 進階・不建議 with its warning, and what is typed per stage is written', () => {
    const { D, html } = boot();
    html();
    goTo(D, 'prompt');
    const h = html();
    assert.match(h, /<span class="v9-adv">進階・不建議<\/span>/);
    assert.match(h, /class="v9-warnline" role="note"/);
    pick(D, 'add');
    D.onInput(ev('[data-in]', { 'data-in': 'all', 'data-field': 'add', value: 'run npm test' }, 'input'));
    assert.deepEqual(plain(D.rows()).map((r) => [r.scope, r.key, r.value]), [['project', 'prompt.all', 'run npm test']]);
});

test('the agents table has a model and an effort select a subagent, 預設 first, and a change writes agent.<name>.model', () => {
    const { D, html } = boot();
    html();
    goTo(D, 'agents');
    const h = html();
    assert.equal((h.match(/<table class="v9-at">/g) || []).length, 2);
    assert.match(h, /<select data-in="m:fankeel-reader"[^>]*><option value="">預設 · sonnet<\/option><option value="haiku" selected>/);
    assert.match(h, /<select data-in="e:fankeel-judge"[^>]*><option value="" selected>預設 · xhigh<\/option>/);
    D.onInput(ev('[data-in]', { 'data-in': 'm:fankeel-judge', 'data-field': 'table', value: 'opus' }, 'change'));
    assert.deepEqual(plain(D.rows()).map((r) => [r.scope, r.key, r.value]), [['project', 'agent.fankeel-judge.model', 'opus']]);
});

test('寫入 posts the changed keys through FK_SETTINGS.post, then says 已寫入', () => {
    const { D, html, posted } = boot();
    html();
    pick(D, 'pr');
    goTo(D, 'final');
    let h = html();
    assert.match(h, /data-block="v9-final"/);
    assert.match(h, /data-act="write">寫入 3 項</);
    act(D, 'write');
    assert.equal(posted.length, 1, 'one scope, one post');
    assert.equal(posted[0].scope, 'project');
    assert.equal(posted[0].project, DIR);
    assert.deepEqual(posted[0].rows.map((r) => [r.k, r.to]).sort(),
        [['land.integration', 'pr'], ['land.push', 'true'], ['worktree', 'bounded']]);
    h = html();
    assert.match(h, /已寫入 3 項。/);
    assert.match(h, /data-act="write" disabled>已寫入</);
});

const tick = () => new Promise((r) => setImmediate(r));
const SCREEN_NA = /<li class="v9-s is-na" data-sid="screen">/;

test('a station/suggest that answers 404 or rejects says so on the page and keeps the front-end step out', async () => {
    for (const f of [() => Promise.resolve({ ok: false, status: 404 }), () => Promise.reject(new Error('down'))]) {
        let redraws = 0;
        const { D, html } = boot('#/settings/detail', false, { fetch: f, redraw: () => { redraws++; } });
        html();
        await tick();
        assert.equal(redraws, 1, 'the failure asks for a repaint');
        const h = html();
        assert.match(h, /推薦取不到，前端相關的步驟先不問/);
        assert.match(h, SCREEN_NA);
        assert.equal(D.state().sugErr, true);
        html();
        await tick();
        assert.equal(redraws, 1, 'a failed answer is not asked again on every repaint');
    }
});

test('a station/suggest that answers front shows the front-end step and no failure message', async () => {
    const { html } = boot('#/settings/detail', false, { fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ front: true }) }) });
    html();
    await tick();
    const h = html();
    assert.doesNotMatch(h, SCREEN_NA);
    assert.doesNotMatch(h, /推薦取不到/);
});

test('a machine key is read from the machine box, so the project box neither changes nor hides it', () => {
    const machine = { 'station.remote': true, 'notify.gate': true };
    const { D, html } = boot('#/settings/detail', false, { machine, values: Object.assign({}, VALUES, { 'station.remote': false, 'notify.gate': false }) });
    html();
    goTo(D, 'where');
    pick(D, 'away');
    D.onClick(ev('[data-mc]', { 'data-mc': 'yes' }));
    assert.deepEqual(plain(D.rows()).filter((r) => r.scope === 'machine'), [], 'the machine already holds both');
    assert.deepEqual(plain(D.changes()).filter((c) => c.k === 'station.remote' || c.k === 'notify.*'), []);
});

test('[data-qm] opens a tip and a second click closes it', () => {
    const { D, html } = boot();
    html();
    const qm = () => D.onClick(ev('[data-qm]', { 'data-qm': 'main' }));
    qm();
    assert.equal(D.state().tip, 'main');
    assert.match(html(), /data-qm="main"[^>]*aria-expanded="true"/);
    qm();
    assert.equal(D.state().tip, '');
    assert.match(html(), /data-qm="main"[^>]*aria-expanded="false"/);
});

test('[data-rtog] opens the rail on a narrow screen and a second click closes it', () => {
    const { D, html } = boot();
    html();
    const rtog = () => D.onClick(ev('[data-rtog]', {}));
    rtog();
    assert.equal(D.state().rail, true);
    assert.match(html(), /class="dcard v9-rail"[^>]*data-open="true"/);
    rtog();
    assert.equal(D.state().rail, false);
    assert.match(html(), /class="dcard v9-rail"[^>]*data-open="false"/);
});

test('[data-gochap] jumps to the first unanswered step of the chapter, not its first', () => {
    const { D, html } = boot();
    html();
    pick(D, 'merge');
    act(D, 'next');
    assert.equal(D.state().at, 'push');
    goTo(D, 'where');
    D.onClick(ev('[data-gochap]', { 'data-gochap': 'quick' }));
    assert.equal(D.state().at, 'push', 'main is answered, push is the first one left');
});

test('arrow keys move the radio choice with wrap-around, and Escape closes an open tip', () => {
    const { D, html } = boot();
    html();
    const ids = ['direct', 'merge', 'pr', 'keep'];
    let prevented = 0;
    const key = (k, o) => {
        const e = ev('.v9-opt[role=radio]', { 'data-o': o, key: k });
        e.preventDefault = () => { prevented++; };
        D.onKey(e);
    };
    pick(D, 'direct');
    key('ArrowDown', 'direct');
    assert.equal(D.state().ans.main, 'merge');
    key('ArrowUp', 'direct');
    assert.equal(D.state().ans.main, ids[3], 'up from the first wraps to the last');
    key('ArrowRight', 'keep');
    assert.equal(D.state().ans.main, ids[0], 'down from the last wraps to the first');
    key('ArrowLeft', 'direct');
    assert.equal(D.state().ans.main, ids[3]);
    assert.equal(prevented, 4);
    key('Enter', 'keep');
    assert.equal(prevented, 4, 'other keys are left alone');
    D.onClick(ev('[data-qm]', { 'data-qm': 'main' }));
    assert.equal(D.state().tip, 'main');
    D.onKey({ key: 'Escape', target: null, preventDefault() {} });
    assert.equal(D.state().tip, '');
});

test('一次派幾個 is the same slider here: 21 stops, input moves the answer, change redraws, past either end is ignored', () => {
    let draws = 0;
    const { D, html } = boot('#/settings/detail/inflight', false, { redraw: () => { draws++; } });
    const h = html();
    assert.match(h, /<input type="range" class="v9-range" id="v9r-inflight" data-slide min="1" max="21" step="1" value="8" aria-labelledby="v9q-inflight" aria-valuetext="8">/);
    assert.doesNotMatch(h, /role="radio"/);
    const move = (value, type) => {
        const readout = { textContent: '' };
        const box = { querySelector: (s) => (s === 'output' ? readout : { textContent: '' }) };
        const el = { value, getAttribute: (k) => (k === 'data-slide' ? '' : null), setAttribute() {},
            closest: (s) => (s === '[data-block="v9-page"]' ? {} : s === '[data-slider]' ? box : null) };
        D.onInput({ type, target: el });
        return readout.textContent;
    };
    assert.equal(move('21', 'input'), '無上限');
    assert.equal(D.state().ans.inflight, 'unlimited');
    assert.equal(draws, 0, 'dragging does not redraw');
    move('22', 'input');
    move('0', 'input');
    assert.equal(D.state().ans.inflight, 'unlimited');
    assert.equal(move('20', 'change'), '20');
    assert.equal(D.state().ans.inflight, '20');
    assert.equal(draws, 1);
    assert.match(html(), /id="v9r-inflight" data-slide min="1" max="21" step="1" value="20"/);
});

test('every Chinese literal has its English', () => {
    const { D } = boot();
    assert.deepEqual(stringsLeft('settings-detail.js', plain(D.EN)), []);
});
