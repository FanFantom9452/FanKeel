'use strict';
// The /m page after the approved mockup's phone frames 2-4: a two-line header whose host chip is not cut,
// the gate question pinned above the report, the report folded to six lines, and the reading sizes.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const P = require('../assets/station/mobile.js');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'mobile.css'), 'utf8');
const NOW = new Date(2026, 9, 26, 11, 2).getTime();
const Q = [{ question: '核准這份 design？', header: 'design', multiSelect: false, options: [{ label: '核准 (Recommended)', description: 'a' }, { label: '改', description: 'b' }] }];
const row = (id, state) => ({ id, root: '/w', task: 'task ' + id, project: 'proj', stage: 'build', route: [], gate: state === 'gate', updated: NOW, state, attached: false, background: [], last: null });
const HOME = { host: 'sh-pro6000', at: NOW, gates: [], tasks: [row('aaaaaaaa-1', 'running')], done: [], notify: { app: 'ntfy://x/y', web: 'https://x/y' } };
const sess = (state, extra) => Object.assign({ id: 'aaaaaaaa-2', root: '/w', task: 't', project: 'proj', stage: 'design', route: [], state, attached: false, waiting: null, chat: [], gate: null, background: [], at: NOW }, extra);
const gate = (chat) => sess('gate', { chat, gate: { questions: Q, since: NOW - 60e3, until: NOW + 240e3 } });
const APP = { mode: 'app' };

test('home header: two lines, the title and history first, the host chip and the subscribe pair second', () => {
    const html = P.screen(HOME, P.parseRoute('#/'), NOW, APP);
    assert.match(html, /<header class="ab ab2"><div class="ab-1"><h1>/);
    assert.ok(html.indexOf('class="ha-hist"') < html.indexOf('class="ab-2"'), 'history is on the first line');
    assert.ok(html.indexOf('class="ab-2"') < html.indexOf('class="host"'), 'the host is on the second');
    assert.match(html, /<span class="subs"><a class="ha-subscribe"/);
});

test('a gate conversation pins the question between the header and the log, with a 看選項 button', () => {
    const html = P.screen(HOME, P.parseRoute('#/s/aaaaaaaa-2'), NOW, APP, gate([]));
    const pin = html.indexOf('class="gpin"');
    assert.ok(html.indexOf('</header>') < pin && pin < html.indexOf('class="cv"'));
    assert.match(html, /<p class="gpin-q" id="gpin-q">核准這份 design？<\/p>/);
    assert.match(html, /<button type="button" class="gpin-go" data-act="gate">看選項/);
});

test('the last assistant message of a gate folds, and expands from ui.rep', () => {
    const chat = [{ role: 'assistant', text: '報告第一段\n\n報告第二段', at: NOW }];
    const folded = P.screen(HOME, P.parseRoute('#/s/aaaaaaaa-2'), NOW, APP, gate(chat));
    assert.match(folded, /<div class="msg ai rep">/);
    assert.match(folded, /<button type="button" class="rep-more" data-act="more" aria-expanded="false">展開完整報告<\/button>/);
    const open = P.screen(HOME, P.parseRoute('#/s/aaaaaaaa-2'), NOW, Object.assign({ rep: true }, APP), gate(chat));
    assert.match(open, /<div class="msg ai rep open">/);
    assert.match(open, /aria-expanded="true">收起報告</);
});

test('a conversation that is not at a gate has no pin and no fold', () => {
    const html = P.screen(HOME, P.parseRoute('#/s/aaaaaaaa-2'), NOW, APP, sess('running', { chat: [{ role: 'assistant', text: 'x', at: NOW }] }));
    assert.doesNotMatch(html, /gpin|rep-more/);
});

test('both languages carry the new strings', () => {
    for (const k of ['gpin.go', 'rep.more', 'rep.less']) {
        assert.ok(P.STR.zh[k] && P.STR.en[k], k);
    }
});

test('mobile.css has the phone reading sizes, the two-line header and the pinned question', () => {
    for (const r of ['body.m .ha-t{', 'body.m .ha-prev{', 'body.m .ab.ab2{', 'body.m .ab2 .host{', 'body.m .gpin{', 'body.m .gpin-q{', 'body.m .rep .bub{', 'body.m .rep.open .bub{', 'body.m .gopts .opt{']) {
        assert.ok(CSS.includes('\n' + r), r);
    }
    assert.match(CSS, /body\.m \.ha-t\{font-size:16px;line-height:1\.55/);
    assert.match(CSS, /body\.m \.gopts \.opt\{min-height:64px/);
});
