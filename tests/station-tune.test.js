'use strict';
// docs/plans/2026-09-26-station-redesign.md Task 8: the station carries each
// project's tune queue beside a session's pending gate, and the page says when
// a block it was waiting on has been changed.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const registry = require('../lib/registry.js');
const station = require('../lib/station.js');
const tmp = require('./tmp.js');

global.window = { STATION: {} };
const V = require('../assets/station/station.js');

const SID = 'ffffffff-8888-4888-8888-888888888888';
const row = (o) => JSON.stringify(o) + '\n';

function fixture(queue) {
    const base = tmp('fankeel-station-tune-');
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(r1);
    registry.writeSession(r1, SID, { task: 't', stage: 'build', route: ['survey', 'build'], active: true, claims: [],
        started: '2026-09-26T10:00:00.000Z', updated: new Date().toISOString(), configDir: cfg });
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'), JSON.stringify({ [path.resolve(r1)]: '2026-09-26T10:00:00.000Z' }) + '\n');
    if (queue) {
        const dir = path.join(r1, '.fankeel', 'build', 'tune');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'queue.jsonl'), queue);
        fs.writeFileSync(path.join(dir, 'serve.json'), JSON.stringify({ port: 7819, pid: 1 }) + '\n');
    }
    return { cfg, r1 };
}
const served = (f) => {
    const ctx = { window: {} };
    vm.runInNewContext(station.serialize(station.gather({ configDir: f.cfg, details: false }), {}), ctx);
    return ctx.window.STATION.sessions.find((x) => x.id === SID);
};

test('serialize carries the tune queue summary beside pending, and null with no queue', () => {
    const f = fixture(row({ id: 'r-0001', status: 'queued', block: 'wizard-step' }) + row({ id: 'r-0001', status: 'taken' })
        + row({ id: 'r-0002', status: 'queued', block: 'model-cost' }) + row({ id: 'r-0002', status: 'taken' })
        + row({ id: 'r-0002', status: 'done', touched: [] }));
    assert.deepEqual(JSON.parse(JSON.stringify(served(f).tune)), {
        open: 1, done: 1, rejected: 0, url: 'http://127.0.0.1:7819/',
        items: [{ id: 'r-0001', block: 'wizard-step', status: 'taken' }, { id: 'r-0002', block: 'model-cost', status: 'done' }],
    });
    assert.equal(served(fixture(null)).tune, null);
});

const at = (status) => [{ id: SID, tune: { open: status === 'taken' ? 1 : 0, done: status === 'done' ? 1 : 0, rejected: status === 'rejected' ? 1 : 0,
    url: 'http://127.0.0.1:7819/', items: [{ id: 'r-0001', block: 'wizard-step', status }] } }];

test('one request moving from in progress to done or rejected is one event; nothing else is', () => {
    assert.deepEqual(V.tuneEvents(at('taken'), at('done')), [{ id: 'r-0001', block: 'wizard-step', status: 'done' }]);
    assert.deepEqual(V.tuneEvents(at('queued'), at('rejected')), [{ id: 'r-0001', block: 'wizard-step', status: 'rejected' }]);
    assert.deepEqual(V.tuneEvents(at('done'), at('done')), [], 'already done last time');
    assert.deepEqual(V.tuneEvents([{ id: SID, tune: null }], at('done')), [], 'never seen open: the first read of a page is not news');
    assert.deepEqual(V.tuneEvents(at('taken').concat(at('taken')), at('done').concat(at('done'))).length, 1, 'two sessions on one project, one event');
    assert.equal(V.tuneOpen(at('taken')), true);
    assert.equal(V.tuneOpen(at('done')), false);
});

test('a settled request is a note that names the block', () => {
    assert.match(V.noteHtml({ id: 'r-0001', block: 'wizard-step', status: 'done' }), /class="nt done"[\s\S]*已修改完成：<code>wizard-step<\/code>/);
    assert.match(V.noteHtml({ id: 'r-0001', block: 'model-cost', status: 'rejected' }), /class="nt rej"[\s\S]*沒有修改：<code>model-cost<\/code>/);
    assert.equal(V.toastText({ block: 'wizard-step', status: 'done' }), '已修改完成：wizard-step');
});
