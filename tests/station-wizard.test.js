'use strict';

// The settings wizard is pure string rendering over `S.profiles` and
// `S.profileKeys`; these tests drive it with a hand-built pair of layers the
// way `lib/profile.js` `read()` shapes them — `values` plus which layer each
// value came from — and the real KEYS.

const test = require('node:test');
const assert = require('node:assert/strict');
const profile = require('../lib/profile.js');

global.window = { STATION: {} };
const V = require('../assets/station/station.js');
const KEYS = profile.WIZARD_KEYS;
const APP = '/w/app';
const PROFILES = {
    machine: {
        values: { guard: 'deny', 'land.archivePlan': true },
        sources: { guard: 'machine', 'land.archivePlan': 'machine' },
        unreadable: [],
    },
    projects: {
        [APP]: {
            values: { 'land.integration': 'merge', 'land.push': true, 'class.default': 'bounded', 'design.mockup': 'opus',
                'stage.agents': ['survey', 'build', 'verify'], guard: 'deny', 'land.archivePlan': true },
            sources: { 'land.integration': 'project', 'land.push': 'project', 'class.default': 'project', 'design.mockup': 'project',
                'stage.agents': 'project', guard: 'machine', 'land.archivePlan': 'machine' },
            unreadable: [],
        },
    },
};
const CTX = { serve: true, nonce: 'n0', plugin: '/p', configDir: '/cfg' };
const load = () => V.wizLoad(PROFILES, KEYS, APP);
const summary = (W) => { W.step = V.WIZ_STEPS.length; return V.wizHtml(KEYS, W, PROFILES, CTX); };

test('wizLoad reads each key from the scope, the machine layer under it, or the builtin', () => {
    const W = load();
    assert.equal(W.val['land.push'], 'true');
    assert.equal(W.val.guard, 'deny', 'from the machine layer');
    assert.equal(W.val['judge.model'], 'fable', 'the builtin');
    assert.equal(W.val['design.skill'], null, 'no builtin: ask');
    assert.equal(W.val['stage.agents'], 'survey,build,verify');
    assert.equal(W.pick[3], 2, 'the 省 context card matches what is on disk');
    assert.equal(W.pick[2], 2, 'the opus card matches');
    assert.equal(W.pick[0], undefined, 'no 收尾 card matches merge + push');
});

test('the summary lists every profile key, design.skill included, with no dropdown', () => {
    const out = summary(load());
    const rows = out.match(/<div class="sr[^"]*" data-key="/g) || [];
    assert.equal(rows.length, Object.keys(KEYS).length);
    assert.equal(rows.length, 12);
    assert.match(out, /data-key="design\.skill"/);
    assert.match(out, /data-block="wizard-summary"/);
    assert.ok(!out.includes('<select'));
});

test('寫入 N 鍵 is the number of rows the summary marks as moving, and the form carries exactly those', () => {
    let W = load();
    W = V.wizApply(W, KEYS, PROFILES, { k: 'land.push', o: 'false' });
    W = V.wizApply(W, KEYS, PROFILES, { k: 'class.default', o: 'spike' });
    W = V.wizApply(W, KEYS, PROFILES, { ask: 'design.mockup' });
    W = V.wizApply(W, KEYS, PROFILES, { k: 'guard', o: 'ask' });
    W = V.wizApply(W, KEYS, PROFILES, { k: 'judge.model', o: 'fable' });
    const ch = V.wizChanges(KEYS, W, PROFILES);
    assert.deepEqual(ch, [
        { key: 'land.push', value: 'false' },
        { key: 'class.default', value: 'spike' },
        { key: 'guard', value: 'ask' },
        { key: 'design.mockup', value: '' },
    ].sort((a, b) => Object.keys(KEYS).indexOf(a.key) - Object.keys(KEYS).indexOf(b.key)));
    const out = summary(W);
    const moved = (out.match(/<div class="sr[^"]*\bmoved\b/g) || []).length;
    assert.equal(moved, ch.length);
    assert.ok(out.includes('寫入 ' + ch.length + ' 鍵'));
    assert.equal((out.match(/name="key"/g) || []).length, ch.length);
    assert.match(out, /<input type="hidden" name="back" value="#\/settings">/);
    assert.match(out, /name="scope" value="project"/);
    assert.match(out, /name="project" value="\/w\/app"/);
    assert.match(out, /name="key" value="design\.mockup"><input type="hidden" name="value" value="">/);
});

test('picking the value the layer below already supplies writes nothing', () => {
    let W = load();
    W = V.wizApply(W, KEYS, PROFILES, { k: 'dispatch.floor', o: 'sonnet' });
    assert.deepEqual(V.wizChanges(KEYS, W, PROFILES), []);
    assert.ok(summary(W).includes('寫入 0 鍵'));
});

test('step 3 offers design.skill only while design.mockup is on', () => {
    let W = load();
    W = V.wizApply(W, KEYS, PROFILES, { go: '2' });
    assert.equal(W.step, 2);
    assert.match(V.wizHtml(KEYS, W, PROFILES, CTX), /data-k="design\.skill" data-m="impeccable:impeccable"/);
    W = V.wizApply(W, KEYS, PROFILES, { k: 'design.mockup', o: 'false' });
    assert.ok(!V.wizHtml(KEYS, W, PROFILES, CTX).includes('data-k="design.skill"'));
});

test('a habit card sets its keys and becomes the recommendation; a station chip toggles one stage', () => {
    let W = load();
    W = V.wizApply(W, KEYS, PROFILES, { go: '0' });
    W = V.wizApply(W, KEYS, PROFILES, { h: '1' });
    assert.equal(W.val['land.integration'], 'pr');
    assert.equal(W.rec['land.push'], 'true');
    W = V.wizApply(W, KEYS, PROFILES, { k: 'stage.agents', st: 'design' });
    assert.equal(W.val['stage.agents'], 'survey,design,build,verify');
});

test('switching scope reloads the values and keeps the step', () => {
    let W = load();
    W = V.wizApply(W, KEYS, PROFILES, { go: '4' });
    W = V.wizApply(W, KEYS, PROFILES, { scope: 'machine' });
    assert.equal(W.scope, 'machine');
    assert.equal(W.step, 4);
    assert.equal(W.val['land.push'], null);
    assert.equal(W.val.guard, 'deny');
});

test('a static page prints the commands instead of a form', () => {
    let W = load();
    W = V.wizApply(W, KEYS, PROFILES, { k: 'land.push', o: 'false' });
    W = V.wizApply(W, KEYS, PROFILES, { ask: 'design.mockup' });
    W.step = V.WIZ_STEPS.length;
    const out = V.wizHtml(KEYS, W, PROFILES, { serve: false, plugin: '/p', configDir: '/cfg' });
    assert.ok(!out.includes('<form'));
    assert.ok(out.includes('node /p/scripts/task.js profile set land.push false --project "/w/app"'));
    assert.ok(out.includes('刪掉 design.mockup'));
});

test('every step renders, with no dropdown', () => {
    const W = load();
    for (let i = 0; i < V.WIZ_STEPS.length; i++) {
        W.step = i;
        const out = V.wizHtml(KEYS, W, PROFILES, CTX);
        const block = V.WIZ_STEPS[i].id === 'front' ? 'wizard-design' : V.WIZ_STEPS[i].id === 'answer' ? 'wizard-gate-station' : 'wizard-step';
        assert.match(out, new RegExp('data-block="' + block + '"'));
        assert.match(out, /data-block="wizard-steps"/);
        assert.ok(!out.includes('<select'), 'step ' + i);
    }
    assert.equal(V.WIZ_STEPS.length, 8);
});

test('the 答 gate step sets gate.station, off by default', () => {
    const W = load();
    assert.equal(W.val['gate.station'], 'off', 'the builtin');
    const i = V.WIZ_STEPS.findIndex((s) => s.id === 'answer');
    assert.equal(i, V.WIZ_STEPS.length - 1, 'the last question, so no earlier step index moves');
    let W2 = V.wizApply(W, KEYS, PROFILES, { go: String(i) });
    W2 = V.wizApply(W2, KEYS, PROFILES, { h: '1' });
    assert.equal(W2.val['gate.station'], '60');
    assert.deepEqual(V.wizChanges(KEYS, W2, PROFILES).filter((c) => c.key === 'gate.station'), [{ key: 'gate.station', value: '60' }]);
});

// docs/plans/2026-09-26-station-redesign.md Task 11: one card per option, and
// a moving picture for the five habits the mockup animates.
test('each option is a card carrying data-k and data-o, with a scene on the six animated keys', () => {
    const W = load();
    W.step = 0;
    const land = V.wizHtml(KEYS, W, PROFILES, CTX);
    for (const o of ['merge', 'pr', 'keep']) assert.match(land, new RegExp('class="ch[^"]*" data-k="land\\.integration" data-o="' + o + '"[^>]*>[\\s\\S]*?<svg class="vg'));
    assert.match(land, /class="ch ask" data-k="land\.integration" data-o=""/);
    assert.match(land, /data-k="land\.push" data-o="true"[^>]*>[\s\S]*?<svg class="vg/);
    assert.match(land, /data-k="land\.archivePlan" data-o="true"[^>]*>[\s\S]*?<svg class="vg/);
    W.step = V.WIZ_STEPS.findIndex((s) => s.id === 'guard');
    assert.match(V.wizHtml(KEYS, W, PROFILES, CTX), /data-k="guard" data-o="deny"[^>]*>[\s\S]*?<svg class="vg/);
    W.step = V.WIZ_STEPS.findIndex((s) => s.id === 'agents');
    assert.match(V.wizHtml(KEYS, W, PROFILES, CTX), /data-k="stage\.agents" data-o="survey,build,verify"[^>]*>[\s\S]*?<svg class="vg/);
    W.step = V.WIZ_STEPS.findIndex((s) => s.id === 'answer');
    assert.match(V.wizHtml(KEYS, W, PROFILES, CTX), /data-k="gate\.station" data-o="60"[^>]*>[\s\S]*?<svg class="vg/);
    W.step = V.WIZ_STEPS.findIndex((s) => s.id === 'model');
    assert.doesNotMatch(V.wizHtml(KEYS, W, PROFILES, CTX), /<svg class="vg/, 'a key with no habit to show gets no scene');
    const again = V.wizApply(load(), KEYS, PROFILES, { k: 'land.integration', o: 'pr' });
    assert.equal(again.val['land.integration'], 'pr', 'a card click is the click wizApply already reads');
});

// docs/plans/2026-09-26-ready-five-design.md §3-§4, mockup blocks
// wizard-design and wizard-gate-station.
test('step 3 lays out false, three models and auto, and design.skill is several chips with the guide always in', () => {
    let W = load();
    W = V.wizApply(W, KEYS, PROFILES, { go: '2' });
    const html = V.wizHtml(KEYS, W, PROFILES, CTX);
    assert.match(html, /data-block="wizard-design"/);
    for (const o of ['false', 'sonnet', 'opus', 'fable', 'auto']) {
        assert.match(html, new RegExp('class="fsg[^"]*" role="radio" aria-checked="(true|false)" tabindex="-?\\d" data-h="\\d"><b>' + o));
    }
    assert.match(html, /class="fsk lock" aria-pressed="true" aria-disabled="true"/);
    W = V.wizApply(W, KEYS, PROFILES, { h: '4' });
    assert.equal(W.val['design.mockup'], 'auto');
    W = V.wizApply(W, KEYS, PROFILES, { k: 'design.skill', m: 'impeccable:impeccable' });
    W = V.wizApply(W, KEYS, PROFILES, { k: 'design.skill', m: 'frontend-design:frontend-design' });
    assert.equal(W.val['design.skill'], 'frontend-design:frontend-design,impeccable:impeccable');
    assert.deepEqual(V.wizChanges(KEYS, W, PROFILES).filter((c) => c.key === 'design.skill'),
        [{ key: 'design.skill', value: 'frontend-design:frontend-design,impeccable:impeccable' }]);
    W = V.wizApply(W, KEYS, PROFILES, { k: 'design.skill', m: 'impeccable:impeccable' });
    assert.equal(W.val['design.skill'], 'frontend-design:frontend-design');
    W = V.wizApply(W, KEYS, PROFILES, { k: 'design.skill', m: 'frontend-design:frontend-design' });
    assert.equal(W.val['design.skill'], null);
});

test('a design.skill list the profile already holds loads as the chips it names', () => {
    const P = JSON.parse(JSON.stringify(PROFILES));
    P.projects[APP].values['design.skill'] = ['frontend-design:frontend-design', 'impeccable:impeccable'];
    P.projects[APP].sources['design.skill'] = 'project';
    const W = V.wizLoad(P, KEYS, APP);
    assert.equal(W.val['design.skill'], 'frontend-design:frontend-design,impeccable:impeccable');
    W.step = 2;
    assert.match(V.wizHtml(KEYS, W, P, CTX), /data-m="impeccable:impeccable" aria-pressed="true"/);
});

test('the 答 gate step is two cards, 60 s suggested and off still the default', () => {
    const W = load();
    W.step = V.WIZ_STEPS.findIndex((s) => s.id === 'answer');
    const html = V.wizHtml(KEYS, W, PROFILES, CTX);
    assert.match(html, /data-block="wizard-gate-station"/);
    assert.match(html, /class="ch" data-k="gate\.station" data-o="60" aria-pressed="false"><span class="rec">建議<\/span>/);
    assert.match(html, /class="ch" data-k="gate\.station" data-o="off" aria-pressed="true">/);
    assert.equal(W.val['gate.station'], 'off');
});
