'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const limits = require('../scripts/limits.js');
const tmp = require('./tmp.js');

function fixture(rows) {
    const root = tmp('fankeel-limits-');
    const dir = path.join(root, '.fankeel', 'build', 'limits');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 's1.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\nnot json\n');
    return root;
}
const R = (at, stage, five, seven, task) => ({ at, task: task || 'T', stage, five, seven });

test('the table lists every reading in order, an unparsable line skipped', () => {
    const root = fixture([R('2026-10-27T01:00:00.000Z', 'survey', 10, 40), R('2026-10-27T02:00:00.000Z', 'build', 25.4, 41)]);
    const out = limits.main(['--session', 's1', '--root', root]).split('\n');
    assert.equal(out.length, 3);
    assert.match(out[1], /^2026-10-27T01:00:00\.000Z\s+survey\s+10%\s+40%$/);
    assert.match(out[2], /build\s+25%\s+41%$/);
});

test('--task keeps one task\'s readings; none is said, not an empty table', () => {
    const root = fixture([R('2026-10-27T01:00:00.000Z', 'survey', 10, 40, 'A'), R('2026-10-27T02:00:00.000Z', 'build', 20, 41, 'B')]);
    assert.equal(limits.main(['--session', 's1', '--root', root, '--task', 'B']).split('\n').length, 2);
    assert.match(limits.main(['--session', 's1', '--root', root, '--task', 'C']), /^no readings in /);
});

test('--svg writes one polyline per window over a 0-100% axis', () => {
    const root = fixture([R('2026-10-27T01:00:00.000Z', 'survey', 0, 50), R('2026-10-27T03:00:00.000Z', 'build', 100, null)]);
    const file = path.join(root, 'chart.svg');
    assert.match(limits.main(['--session', 's1', '--root', root, '--svg', file]), /2 readings$/);
    const svg = fs.readFileSync(file, 'utf8');
    assert.equal((svg.match(/<polyline/g) || []).length, 2);
    assert.match(svg, /points="32\.0,208\.0 688\.0,32\.0"/);
});

test('no --session is a usage error', () => {
    assert.throws(() => limits.main([]), /usage: node scripts\/limits\.js/);
});
