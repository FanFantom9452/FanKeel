'use strict';
// lib/quota.js and scripts/quota.js: quota.week calibrated from two 7-day
// readings in one window and what every transcript spent between them.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mkTmp = require('./tmp.js');
const quota = require('../lib/quota.js');
const prices = require('../lib/prices.js');
const profile = require('../lib/profile.js');
const { main } = require('../scripts/quota.js');

const line = (at, pct, resetsAt) => JSON.stringify({ at, seven_day_pct: pct, seven_day_resets_at: resetsAt, five_hour_pct: null, cost_usd: null });

function transcript(file, rows) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, rows.map(([id, ms, out]) => JSON.stringify({
        type: 'assistant', isSidechain: file.includes('subagents'), requestId: id, timestamp: new Date(ms).toISOString(),
        message: { model: 'claude-opus-5', usage: { input_tokens: 0, output_tokens: out } },
    })).join('\n') + '\n');
}

// One main transcript and one agent's: 3M output tokens inside [100s, 400s),
// 5M outside it on both sides.
function account() {
    const dir = mkTmp('fankeel-quota-');
    transcript(path.join(dir, 'projects', 'p', 's1.jsonl'), [['r1', 50e3, 2e6], ['r2', 150e3, 1e6], ['r3', 500e3, 2e6]]);
    transcript(path.join(dir, 'projects', 'p', 's1', 'subagents', 'agent-a1.jsonl'), [['r4', 300e3, 2e6], ['r5', 450e3, 1e6]]);
    return dir;
}

test('readings keep only lines carrying a 7-day percent and reset, oldest first', () => {
    const text = [line(200, 12, 9000), '{"at":150,"seven_day_pct":null,"seven_day_resets_at":null}', 'torn{', line(100, 10, 9000)].join('\n');
    assert.deepEqual(quota.readings(text), [{ at: 100, pct: 10, resetsAt: 9000 }, { at: 200, pct: 12, resetsAt: 9000 }]);
});

test('span takes the newest window that moved MIN_POINTS or more, first reading to last', () => {
    const list = quota.readings([line(100, 5, 9000), line(400, 40, 9030), line(10000, 1, 700000), line(10100, 3, 700000)].join('\n'));
    assert.deepEqual(quota.span(list), { from: 100000, to: 400000, points: 35 }, 'a reset seconds apart is the same window; the newer one moved too little');
    assert.equal(quota.span(quota.readings(line(100, 5, 9000) + '\n' + line(200, 5 + quota.MIN_POINTS - 1, 9000))), null);
});

test('perWeek is dollars per point times a hundred, and null for nothing spent', () => {
    assert.equal(quota.perWeek(300, 10), 3000);
    assert.equal(quota.perWeek(0, 10), null);
});

test('spentBetween prices main and agent transcripts inside the window only', () => {
    const cost = quota.spentBetween(account(), 100e3, 400e3);
    assert.ok(Math.abs(cost.usd - 3e6 * prices.rateFor('claude-opus-5').output / 1e6) < 1e-9, String(cost.usd));
    assert.equal(quota.spentBetween(mkTmp('fankeel-quota-none-'), 100e3, 400e3), null);
});

test('quota.js writes quota.week and quota.calibrated to the machine profile; --dry-run writes nothing', () => {
    const dir = account();
    const log = path.join(dir, 'tokenbar-usage.jsonl');
    fs.writeFileSync(log, [line(100, 10, 9000), line(400, 40, 9000)].join('\n') + '\n');
    const week = Math.round(3e6 * prices.rateFor('claude-opus-5').output / 1e6 / 30 * 100);
    const dry = main(['--claude-dir', dir, '--dry-run']);
    assert.equal(dry.code, 0, dry.text);
    assert.match(dry.text, new RegExp('^quota\\.week ' + week + ' \\(calibrated 1970-01-01'));
    assert.equal(fs.existsSync(profile.machineFile(dir)), false);
    const out = main(['--claude-dir', dir]);
    assert.equal(out.code, 0, out.text);
    const saved = JSON.parse(fs.readFileSync(profile.machineFile(dir), 'utf8'));
    assert.deepEqual([saved['quota.week'], saved['quota.calibrated']], [week, '1970-01-01']);
});

test('quota.js with no log, or no window that moved enough, writes nothing and exits 1', () => {
    const dir = account();
    assert.equal(main(['--claude-dir', dir]).code, 1);
    fs.writeFileSync(path.join(dir, 'tokenbar-usage.jsonl'), line(100, 10, 9000) + '\n');
    assert.equal(main(['--claude-dir', dir]).code, 1);
    assert.equal(fs.existsSync(profile.machineFile(dir)), false);
    assert.equal(main(['--bogus']).code, 2);
});
