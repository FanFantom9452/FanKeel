'use strict';
// The /m page after the approved mockup's phone frames 2-4: a two-line header whose host chip is not cut,
// the gate question pinned above the report, the report folded to six lines, and the reading sizes.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const P = require('../assets/station/mobile.js');
const { boot, target, settle } = require('./mobile-dom.js');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'mobile.css'), 'utf8');
const NOW = new Date(2026, 9, 26, 11, 2).getTime();
const Q = [{ question: '核准這份 design？', header: 'design', multiSelect: false, options: [{ label: '核准 (Recommended)', description: 'a' }, { label: '改', description: 'b' }] }];
const row = (id, state) => ({ id, root: '/w', task: 'task ' + id, project: 'proj', stage: 'build', route: [], gate: state === 'gate', updated: NOW, state, attached: false, background: [], last: null });
const HOME = { host: 'sh-pro6000', at: NOW, gates: [], tasks: [row('aaaaaaaa-1', 'running')], done: [] };
const sess = (state, extra) => Object.assign({ id: 'aaaaaaaa-2', root: '/w', task: 't', project: 'proj', stage: 'design', route: [], state, attached: false, waiting: null, chat: [], gate: null, background: [], at: NOW }, extra);
const gate = (chat) => sess('gate', { chat, gate: { questions: Q, since: NOW - 60e3, until: NOW + 240e3 } });
const APP = { mode: 'app' };

test('home header: two lines, the title and history first, the host chip second', () => {
    const html = P.screen(HOME, P.parseRoute('#/'), NOW, APP);
    assert.match(html, /<header class="ab ab2"><div class="ab-1"><h1>/);
    assert.ok(html.indexOf('class="ha-hist"') < html.indexOf('class="ab-2"'), 'history is on the first line');
    assert.ok(html.indexOf('class="ab-2"') < html.indexOf('class="host"'), 'the host is on the second');
});

test('a gate conversation pins the question between the header and the log, with a 看選項 button', () => {
    const html = P.screen(HOME, P.parseRoute('#/s/aaaaaaaa-2'), NOW, APP, gate([]));
    const pin = html.indexOf('class="gpin"');
    assert.ok(html.indexOf('</header>') < pin && pin < html.indexOf('class="cv"'));
    assert.match(html, /<p class="gpin-q" id="gpin-q" data-act="gpin" tabindex="0" role="button" aria-expanded="false">核准這份 design？<\/p>/);
    assert.match(html, /<button type="button" class="gpin-go" data-act="gate">看選項/);
    assert.ok(html.indexOf('class="gpin-go"') < html.indexOf('class="gpin-q"'), '看選項 sits in the header row, above the question');
    assert.ok(html.indexOf('class="gpin-go"') < html.indexOf('</p>', html.indexOf('class="gpin-h"')));
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

test('the question and the header are drawn once: in the pin, not again in the gate card', () => {
    const html = P.screen(HOME, P.parseRoute('#/s/aaaaaaaa-2'), NOW, APP, gate([]));
    assert.equal(html.split('核准這份 design？').length - 1, 1);
    assert.equal(html.split('design gate').length - 1, 1);
    assert.match(html, /<form class="gc gopts" id="gate-card"[^>]*aria-labelledby="gpin-q">/);
});

test('the pinned question is clamped to two lines and opens from ui.pin', () => {
    assert.match(CSS, /body\.m \.gpin-q\{[^}]*-webkit-line-clamp:2/);
    assert.match(CSS, /body\.m \.gpin\.open \.gpin-q\{[^}]*-webkit-line-clamp:unset/);
    const url = '#/s/aaaaaaaa-2';
    assert.match(P.screen(HOME, P.parseRoute(url), NOW, APP, gate([])), /<div class="gpin" /);
    assert.match(P.screen(HOME, P.parseRoute(url), NOW, Object.assign({ pin: true }, APP), gate([])), /<div class="gpin open" /);
});

// ---- the pin in the booted page ----------------------------------------------
const ID = 'aaaaaaaa-2';
const homeOf = () => Object.assign({}, HOME, { tasks: [row(ID, 'gate')] });
const gateAt = (until, q) => sess('gate', { gate: { questions: [Object.assign({}, Q[0], { question: q || Q[0].question })], since: NOW - 60e3, until } });
const pinEl = () => ({ open: false, classList: { toggle(c, on) { this.owner.open = on; } } });
const pinTarget = (pin) => { pin.classList.owner = pin; return target({ 'data-act': 'gpin', role: 'button', 'aria-expanded': 'false' }, pin); };
const closed = (page) => /<div class="gpin" [^>]*>.*aria-expanded="false"/.test(page.app.innerHTML);

test('a tap on the pinned question opens it and says so in aria-expanded', async () => {
    const page = boot('#/s/' + ID, { home: homeOf(), one: gateAt(Date.now() + 1e5) });
    await settle();
    assert.ok(closed(page));
    const pin = pinEl(), el = pinTarget(pin);
    page.fire('click', { target: el });
    assert.equal(pin.open, true);
    assert.equal(el.attrs['aria-expanded'], 'true');
    page.fire('click', { target: el });
    assert.equal(pin.open, false);
    assert.equal(el.attrs['aria-expanded'], 'false');
});
// red when: the click branch stops toggling ui.pin or stops writing aria-expanded.

test('Enter and Space on the pinned question toggle it; other keys and other elements do not', async () => {
    const page = boot('#/s/' + ID, { home: homeOf(), one: gateAt(Date.now() + 1e5) });
    await settle();
    const pin = pinEl(), el = pinTarget(pin);
    const key = (k, t) => { const e = { target: t || el, key: k, prevented: false, preventDefault() { this.prevented = true; } }; page.fire('keydown', e); return e; };
    assert.equal(key('Enter').prevented, true);
    assert.equal(pin.open, true);
    assert.equal(el.attrs['aria-expanded'], 'true');
    key(' ');
    assert.equal(pin.open, false);
    assert.equal(key('a').prevented, false);
    assert.equal(pin.open, false);
    key('Enter', target({ 'data-act': 'more' }));
    assert.equal(pin.open, false);
});
// red when: the keydown handler is removed, or answers to any key, or to an element that is not [data-act=gpin].

test('a pin opened on one gate is closed on the next gate of the same session, and after the gate was answered', async () => {
    const state = { home: homeOf(), one: gateAt(Date.now() + 1e5) };
    const page = boot('#/s/' + ID, state);
    await settle();
    page.fire('click', { target: pinTarget(pinEl()) });
    state.one = gateAt(Date.now() + 2e5, 'next question?');
    await page.poll();
    assert.ok(closed(page), 'a new question comes up closed');
    assert.ok(page.app.innerHTML.includes('next question?'));
    page.fire('click', { target: pinTarget(pinEl()) });
    state.one = sess('running');
    await page.poll();
    assert.doesNotMatch(page.app.innerHTML, /gpin/);
    state.one = gateAt(Date.now() + 2e5, 'next question?');
    await page.poll();
    assert.ok(closed(page), 'the same question asked again after an answer is closed too');
});
// red when: draw() stops clearing ui.pin on a changed gate key, or refresh() patches instead of drawing when the gate changes.

test('leaving the conversation closes the pin', async () => {
    const page = boot('#/s/' + ID, { home: homeOf(), one: gateAt(Date.now() + 1e5) });
    await settle();
    page.fire('click', { target: pinTarget(pinEl()) });
    page.goto('#/s/' + ID);
    assert.ok(closed(page));
});
// red when: the hashchange listener stops resetting ui.pin (the gate key is the same here, so only that line closes it).
