'use strict';
// A gate hooks/gate.js is holding for the station: the page shows it and
// posts the answer to /answer, which writes `<stage>-answer.md` for the hook.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const registry = require('../lib/registry.js');
const station = require('../lib/station.js');
const { pendingPath, answerPath } = require('../lib/handoff.js');
const tmp = require('./tmp.js');

global.window = { STATION: { serve: false } };
const V = require('../assets/station/station.js');

const SID = 'eeeeeeee-7777-4777-8777-777777777777';
const Q = [{ question: '進 verify 嗎？', header: 'build', multiSelect: false, options: [{ label: '進 verify', description: 'a' }, { label: '暫停', description: 'b' }] }];

function fixture(until, questions) {
    const base = tmp('fankeel-station-answer-');
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(r1);
    const data = { task: 't', stage: 'build', route: ['survey', 'build'], active: true, claims: [],
        started: '2026-09-11T10:00:00.000Z', updated: new Date().toISOString(), configDir: cfg };
    registry.writeSession(r1, SID, data);
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'), JSON.stringify({ [path.resolve(r1)]: '2026-09-11T10:00:00.000Z' }) + '\n');
    if (until) {
        const file = pendingPath(r1, data, 'build');
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify({ questions: questions || Q, at: Date.now(), until }));
    }
    return { cfg, r1, data };
}

const request = (url, body) => new Promise((resolve, reject) => {
    const req = http.request(url, { method: body ? 'POST' : 'GET', headers: body ? { 'content-type': 'application/x-www-form-urlencoded' } : {} }, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve({ status: res.statusCode, text }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
});

const served = (f) => {
    const ctx = { window: {} };
    vm.runInNewContext(station.serialize(station.gather({ configDir: f.cfg }), {}), ctx);
    return ctx.window.STATION.sessions.find((x) => x.id === SID);
};

test('serialize carries the gate a hook is holding, and drops one whose wait is over', () => {
    assert.deepEqual(JSON.parse(JSON.stringify(served(fixture(Date.now() + 60e3)).pending.questions)), Q);
    assert.equal(served(fixture(Date.now() - 1000)).pending, null);
    assert.equal(served(fixture(0)).pending, null);
});

test('the page shows the held gate: a form when served, a pointer back to the terminal on a file', () => {
    const s = { id: SID, root: '/r', pending: { questions: Q, until: Date.now() + 30e3 } };
    const onFile = V.pendingGateHtml(s, {});
    assert.match(onFile, /data-block="pending-gate"/);
    assert.match(onFile, /進 verify 嗎？/);
    assert.match(onFile, /靜態頁不能作答/);
    assert.equal(V.pendingGateHtml({ id: SID, root: '/r', pending: null }, {}), '');
    window.STATION.serve = true;
    try {
        const form = V.pendingGateHtml(s, { [SID + ':0']: ['暫停'] });
        assert.match(form, /data-answer/);
        assert.match(form, /value="暫停" checked>/);
    } finally {
        window.STATION.serve = false;
    }
});

test('POST /answer writes the answer file the hook reads, and refuses what no held gate asked', async () => {
    const f = fixture(Date.now() + 60e3);
    const { serve } = require('../scripts/station.js');
    const s = await serve({ configDir: f.cfg, roots: [f.r1], port: 0, idleMs: 60e3, open: false });
    try {
        const data = await request(s.url + 'station/station-data.js');
        const nonce = /"nonce":"([^"]+)"/.exec(data.text)[1];
        const post = (o) => request(s.url + 'answer', new URLSearchParams(Object.assign({ nonce, root: f.r1, id: SID }, o)).toString());
        const file = answerPath(f.r1, f.data, 'build');
        const good = JSON.stringify({ [Q[0].question]: '暫停' });
        assert.equal((await post({ nonce: 'wrong', answers: good })).status, 403);
        assert.equal((await post({ id: 'nobody', answers: good })).status, 404);
        assert.equal((await post({ answers: JSON.stringify({ 'not asked': 'x' }) })).status, 400);
        assert.equal((await post({ answers: 'not json' })).status, 400);
        assert.equal(fs.existsSync(file), false, 'a refused answer wrote nothing');
        const ok = await post({ answers: good });
        assert.equal(ok.status, 201);
        assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { answers: { [Q[0].question]: '暫停' } });
        fs.unlinkSync(pendingPath(f.r1, f.data, 'build'));
        assert.equal((await post({ answers: good })).status, 409, 'no gate is held any more');
    } finally {
        s.close();
    }
});

// docs/plans/2026-09-26-station-redesign.md Task 7. Two questions, one
// answered: refused, where :525 used to send the one answer on and let the
// hook take it as the whole gate.
const Q2 = [Q[0], { question: '這次一起改哪些？', header: '範圍', multiSelect: true, options: [{ label: 'gate', description: 'a' }, { label: 'tune', description: 'b' }] }];
test('POST /answer refuses an answer that leaves a question asked unanswered', async () => {
    const f = fixture(Date.now() + 60e3, Q2);
    const { serve } = require('../scripts/station.js');
    const s = await serve({ configDir: f.cfg, roots: [f.r1], port: 0, idleMs: 60e3, open: false });
    try {
        const data = await request(s.url + 'station/station-data.js');
        const nonce = /"nonce":"([^"]+)"/.exec(data.text)[1];
        const post = (answers) => request(s.url + 'answer', new URLSearchParams({ nonce, root: f.r1, id: SID, answers: JSON.stringify(answers) }).toString());
        const file = answerPath(f.r1, f.data, 'build');
        const partial = await post({ [Q2[0].question]: '暫停' });
        assert.equal(partial.status, 400, partial.text);
        assert.match(partial.text, /every question/);
        assert.equal(fs.existsSync(file), false, 'a partial answer wrote nothing');
        const whole = await post({ [Q2[0].question]: '暫停', [Q2[1].question]: 'gate, 自己打的' });
        assert.equal(whole.status, 201, whole.text);
    } finally {
        s.close();
    }
});

test('the held gate offers 其他 on every question and keeps 送出 off until each has an answer', () => {
    const s = { id: SID, root: '/r', pending: { questions: Q2, until: Date.now() + 30e3 } };
    window.STATION.serve = true;
    try {
        const none = V.pendingGateHtml(s, {});
        assert.equal((none.match(/value="__other"/g) || []).length, 2, 'one 其他 per question');
        assert.equal((none.match(/data-pg-other="\d"/g) || []).length, 2, 'each with its own text box');
        assert.match(none, /data-answer disabled/);
        assert.match(none, /已答 <b class="pgn">0 \/ 2<\/b>/);
        const half = V.pendingGateHtml(s, { [SID + ':0']: ['暫停'] });
        assert.match(half, /data-answer disabled/);
        const all = V.pendingGateHtml(s, { [SID + ':0']: ['暫停'], [SID + ':1']: ['__other'], [SID + ':1:other']: '自己打的' });
        assert.doesNotMatch(all, /data-answer disabled/);
        assert.match(all, /value="自己打的"/);
    } finally {
        window.STATION.serve = false;
    }
});

test('pgAnswers takes typed text as the answer, and counts what is missing', () => {
    assert.deepEqual(V.pgAnswers(Q2, { 0: ['__other'], 1: ['gate', '__other'] }, { 0: '  換個做法 ', 1: 'docs' }),
        { answers: { [Q2[0].question]: '換個做法', [Q2[1].question]: 'gate, docs' }, missing: 0 });
    assert.deepEqual(V.pgAnswers(Q2, { 0: ['暫停'], 1: ['__other'] }, { 1: '   ' }),
        { answers: { [Q2[0].question]: '暫停' }, missing: 1 }, 'a 其他 with nothing typed is no answer');
});
