'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = () => import(pathToFileURL(path.join(__dirname, '..', 'hooks', 'pane-lang.ts')).href);
const CJK = /[\u3400-\u9fff\u3000-\u303f\uff00-\uffef]/;
const io = (files) => {
    const logs = [];
    return { logs, exists: async (p) => p in files, read: async (p) => files[p], log: (t) => logs.push(t) };
};
const FILE = 'C:/cfg/fankeel/profile.json';

test('every word has both languages, the English carries no CJK, and both carry the same {vars}', async () => {
    const { STRINGS } = await load();
    assert.deepEqual(Object.keys(STRINGS.en).sort(), Object.keys(STRINGS.zh).sort());
    const vars = (s) => (s.match(/\{\w+\}/g) || []).sort();
    for (const k of Object.keys(STRINGS.zh)) {
        assert.doesNotMatch(STRINGS.en[k], CJK, k);
        assert.deepEqual(vars(STRINGS.en[k]), vars(STRINGS.zh[k]), k);
    }
});

test('say is Chinese unless the language is en, with {vars} filled', async () => {
    const { say } = await load();
    assert.equal(say(undefined, 'band.here'), '本站');
    assert.equal(say(null, 'band.here'), '本站');
    assert.equal(say('zh', 'band.youFor', { n: 2 }), '等你 2 分');
    assert.equal(say('en', 'band.youFor', { n: 2 }), 'on you 2 min');
    assert.equal(say('en', 'band.here'), 'stage');
    assert.equal(say('en', 'status.agents', { r: 1, d: 3 }), '  1 running · 3 done');
    assert.equal(say('en', 'status.close', { id: 'abcdef12' }), 'abcdef12 · /fankeel-panel to close');
});

test('langAt reads ui.lang from <configDir>/fankeel/profile.json, and is zh for anything else', async () => {
    const { langAt } = await load();
    assert.equal(await langAt(io({ [FILE]: JSON.stringify({ 'ui.lang': 'en' }) }), 'C:/cfg'), 'en');
    assert.equal(await langAt(io({ [FILE]: '\uFEFF' + JSON.stringify({ 'ui.lang': 'EN' }) }), 'C:/cfg/'), 'en');
    assert.equal(await langAt(io({ [FILE]: JSON.stringify({ 'ui.lang': 'zh' }) }), 'C:/cfg'), 'zh');
    assert.equal(await langAt(io({ [FILE]: JSON.stringify({ 'ui.lang': 'fr' }) }), 'C:/cfg'), 'zh');
    assert.equal(await langAt(io({ [FILE]: JSON.stringify({ 'model.lang': 'English' }) }), 'C:/cfg'), 'zh');
    assert.equal(await langAt(io({}), 'C:/cfg'), 'zh');
    assert.equal(await langAt(io({}), ''), 'zh');
    const bad = io({ [FILE]: '{' });
    assert.equal(await langAt(bad, 'C:/cfg'), 'zh');
    assert.equal(bad.logs.length, 1);
    assert.match(bad.logs[0], /unreadable profile/);
});
