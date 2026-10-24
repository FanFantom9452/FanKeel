'use strict';
// station-39: the step table of 詳細設定 (assets/station/settings-steps.js)
// against the approved mockup route-settings-v9.html — ten chapters, 33
// steps in the mockup's order, every write a value lib/profile.js accepts,
// prompt.* marked advanced, remote marked pending, and every Chinese string
// with its English.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const profile = require('../lib/profile.js');
const { page, stringsLeft } = require('./station-module.js');

const QUICK = ['main', 'push', 'sessions', 'gates', 'floor', 'ctx', 'where', 'screen', 'inflight', 'lang'];
const OWN = ['style', 'archive', 'commitfmt', 'wt', 'sreview', 'seclocal', 'skill', 'prompt', 'judge', 'agents', 'quota',
    'compact', 'link', 'notify', 'ntfy', 'remote', 'hold', 'prose', 'uilang', 'smode', 'hide', 'chart', 'initskip'];
// The table is built in the page's vm; JSON brings it into this realm for deepEqual.
const plain = (x) => JSON.parse(JSON.stringify(x));
function boot() {
    const p = page(['settings-steps.js']);
    return { T: p.M['settings-steps.js'], win: p.win };
}

test('ten chapters in the mockup\'s order, and only 離開電腦時 writes the machine', () => {
    const { T } = boot();
    const ch = plain(T.chapters());
    assert.deepEqual(ch.map((c) => c.id), ['quick', 'integ', 'parallel', 'verify', 'cost', 'context', 'away', 'text', 'safety', 'other']);
    assert.deepEqual(ch.map((c) => c.n), ['快速設定', '整合收尾', '平行與隔離', '驗證與流程', '成本與模型', 'Context 與自主', '離開電腦時', '報告與文字', '安全', '其他']);
    assert.deepEqual(ch.filter((c) => c.machine).map((c) => c.id), ['away']);
});

test('order() is the 33 steps: the ten quick questions and the 23 the table carries, each under its chapter', () => {
    const { T } = boot();
    const ord = plain(T.order());
    assert.equal(ord.length, 33);
    assert.deepEqual(ord.map((e) => e[0]).filter((id) => QUICK.includes(id)), QUICK.slice(0, 8).concat(['inflight', 'lang']));
    assert.deepEqual(plain(T.steps().map((s) => s.id)), OWN);
    const ch = Object.fromEntries(ord.map((e) => [e[0], e[1]]));
    assert.equal(ch.inflight, 'parallel');
    assert.equal(ch.lang, 'text');
    for (const s of T.steps()) {
        assert.equal(s.ch, ch[s.id], s.id);
        assert.ok(s.r && s.title && s.why, s.id + ' has a rail name, a question and a why');
    }
});

test('every option has a label and an effect, and every literal write is a value lib/profile.js accepts', () => {
    const { T } = boot();
    for (const s of T.steps()) {
        if (s.kind === 'table') { assert.equal(s.opts.length, 0); continue; }
        assert.ok(s.opts.length >= 2, s.id);
        for (const o of s.opts) {
            assert.ok(o.label && o.effect && o.s, s.id + ' ' + o.o);
            for (const [k, v] of Object.entries(o.w)) {
                if (k.includes('*') || k.includes('$') || v === '' || v.startsWith('$')) continue;
                assert.ok(Object.prototype.hasOwnProperty.call(profile.KEYS, k), k);
                assert.equal(profile.parseValue(k, v).error, undefined, k + '=' + v);
            }
            if (o.input) assert.ok(s.field && s.field.label, s.id + ' has a field for ' + o.o);
        }
    }
});

test('prompt.* is tagged 進階・不建議 with its warning, remote\'s yes names Tailscale and is not 待定, the rest as the mockup tags them', () => {
    const { T } = boot();
    const by = Object.fromEntries(plain(T.steps()).map((s) => [s.id, s]));
    assert.equal(by.prompt.adv, '進階・不建議');
    assert.equal(by.prompt.warn, '每輪都注入，會蓋過站的規則、難除錯；建議先別用。');
    assert.deepEqual(by.prompt.opts.map((o) => [o.o, o.rec, o.risk]), [['none', '推薦', ''], ['add', '', '不建議']]);
    assert.ok(by.prompt.field.each);
    const yes = by.remote.opts.find((o) => o.o === 'true');
    assert.equal(yes.pend, '');
    assert.equal(yes.effect, '經 Tailscale 連進來（預設）');
    assert.match(by.remote.why, /Cloudflare Tunnel \+ Access 是之後的進階選項/);
    assert.equal(yes.risk, '對外開放');
    assert.equal(by.commitfmt.opts.find((o) => o.o === 'git').w['commit.format'], '$git');
    assert.deepEqual(by.notify.key, 'notify.*');
    assert.deepEqual(by.skill.cond, 'skill');
    assert.match(by.agents.table.def, /\{v\}/);
});

test('the three styles cover the compared keys and land.archivePlan; ties go balanced, free, steady', () => {
    const { T } = boot();
    assert.deepEqual(plain(T.SKEYS), ['class.default', 'dispatch.floor', 'stage.agents', 'guard', 'gate.away', 'design.mockup', 'sensitive.review']);
    assert.deepEqual(plain(T.TIE), ['balanced', 'free', 'steady']);
    for (const id of T.TIE) assert.deepEqual(Object.keys(T.STY[id]).sort(), plain(T.SKEYS).concat('land.archivePlan').sort(), id);
    assert.equal(T.STY.free['stage.agents'], 'survey,design,plan,build,verify,audit,land');
});

test('in English the table has no Chinese, and every Chinese literal has its English', () => {
    const { T, win } = boot();
    win.FK_I18N = { lang: 'en' };
    const text = JSON.stringify([T.chapters(), T.order(), T.steps()]);
    assert.doesNotMatch(text, /[\u3400-\u9fff]/);
    assert.deepEqual(stringsLeft('settings-steps.js', plain(T.EN)), []);
});

test('the agents table\'s selects may shrink at 390px', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'settings-steps.css'), 'utf8');
    assert.ok(css.includes('.v9-at select{min-width:0;width:100%}'));
});
