'use strict';
// docs/plans/2026-09-26-station-redesign.md Task 10: the main session's
// effort, read from the transcript where Claude Code writes it on every
// assistant line (checked 2026-09-26: `"effort":"medium"` at the top level),
// carried to the page, and shown only when it is there.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const usage = require('../lib/usage.js');
const registry = require('../lib/registry.js');
const station = require('../lib/station.js');
const tmp = require('./tmp.js');

global.window = { STATION: {} };
const V = require('../assets/station/station.js');

const SID = '99999999-1111-4111-8111-111111111111';
const line = (o) => JSON.stringify(o) + '\n';
const said = (rid, s, effort) => line(Object.assign({ type: 'assistant', requestId: rid, timestamp: '2026-09-26T10:00:0' + s + '.000Z',
    message: { model: 'claude-opus-5-5', usage: { input_tokens: 10, output_tokens: 5 } } }, effort ? { effort } : {}));

function transcriptIn(cfg, text) {
    const dir = path.join(cfg, 'projects', 'F--ws');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, SID + '.jsonl'), text);
}

test('summarise reads the last effort the transcript carries, and adds no key when there is none', () => {
    const cfg = tmp('fankeel-effort-usage-');
    transcriptIn(cfg, said('r1', 1, 'medium') + said('r2', 2, 'xhigh'));
    assert.equal(usage.summarise(path.join(cfg, 'projects', 'F--ws', SID + '.jsonl')).effort, 'xhigh');
    const bare = tmp('fankeel-effort-bare-');
    transcriptIn(bare, said('r1', 1, null));
    assert.equal('effort' in usage.summarise(path.join(bare, 'projects', 'F--ws', SID + '.jsonl')), false);
});

test('serialize carries the effort to the page, and the chip shows only when it is known', () => {
    const base = tmp('fankeel-effort-station-');
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    transcriptIn(cfg, said('r1', 1, 'xhigh'));
    registry.ensureLayout(r1);
    registry.writeSession(r1, SID, { task: 't', stage: 'design', route: ['survey', 'design'], active: true, claims: [],
        started: '2026-09-26T10:00:00.000Z', updated: new Date().toISOString(), configDir: cfg });
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'), JSON.stringify({ [path.resolve(r1)]: '2026-09-26T10:00:00.000Z' }) + '\n');
    const ctx = { window: {} };
    vm.runInNewContext(station.serialize(station.gather({ configDir: cfg }), {}), ctx);
    assert.equal(ctx.window.STATION.sessions.find((x) => x.id === SID).effort, 'xhigh');
    assert.match(V.effortChip('xhigh'), /effort <span class="mono">xhigh<\/span>/);
    assert.equal(V.effortChip(null), '');
});
