'use strict';
// lib/spend.js: what a session's `spend` field turns into once `lib/prices.js`'s
// rates are applied — the four dollar components `assets/station/station.js:978`
// already displays, folding `cacheWrite5m` and `cacheWrite1h` the same way, and
// `buckets()` grouping sessions by how long they ran.
//
// `scripts/spend.js`'s own two helpers — `parseArgs` and `resolveRoots` — are
// covered here too, the way `scripts/station.js`'s `parseArgs` and
// `scanDeadline` are covered by that script's own test rather than a separate
// `scripts/*.test.js` file.
//
// Every fixture is a session file under a scratch root from `tests/tmp.js` —
// never this machine's real registries.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const registry = require('../lib/registry.js');
const spend = require('../lib/spend.js');
const station = require('../lib/station.js');
const { main, parseArgs, resolveRoots } = require('../scripts/spend.js');
const tmp = require('./tmp.js');

const NOW = new Date().toISOString();
const ID1 = 'aaaaaaaa-1111-1111-1111-111111111111';
const ID2 = 'aaaaaaaa-2222-1111-1111-111111111111';
const ID3 = 'aaaaaaaa-3333-1111-1111-111111111111';
const ID4 = 'aaaaaaaa-4444-1111-1111-111111111111';
const ID5 = 'aaaaaaaa-5555-1111-1111-111111111111';
const ID6 = 'aaaaaaaa-6666-1111-1111-111111111111';
const ID7 = 'aaaaaaaa-7777-1111-1111-111111111111';
const ID8 = 'aaaaaaaa-8888-1111-1111-111111111111';
const ID9 = 'aaaaaaaa-9999-1111-1111-111111111111';

function root() {
    return tmp('fankeel-spend-');
}
function base(extra) {
    return Object.assign({ task: 't', stage: 'build', route: ['build'], active: true, started: NOW, updated: NOW }, extra);
}

test('sessionsOf prices the four displayed components from known token counts', () => {
    const r = root();
    registry.writeSession(r, ID1, base({
        spend: { build: { requests: 3, models: {
            'claude-sonnet-5': { input: 2_000_000, output: 500_000, cacheRead: 3_000_000, cacheWrite5m: 0, cacheWrite1h: 0 },
        } } },
    }));
    const { rows } = spend.sessionsOf([r]);
    assert.equal(rows.length, 1);
    const row = rows[0];
    assert.equal(row.sessionId, ID1);
    assert.equal(row.root, r);
    // sonnet: input 2, output 10, cacheRead 0.2 per million.
    assert.deepEqual(row.cost, { input: 4, output: 5, cacheRead: 0.6, cacheWrite: 0 });
    assert.equal(row.usd, 9.6);
});

test('cacheWrite folds ephemeral 5m and 1h writes together, at their own rates', () => {
    const r = root();
    registry.writeSession(r, ID2, base({
        spend: { build: { requests: 1, models: {
            'claude-sonnet-5': { input: 0, output: 0, cacheRead: 0, cacheWrite5m: 200_000, cacheWrite1h: 100_000 },
        } } },
    }));
    const row = spend.sessionsOf([r]).rows[0];
    // 200,000 * 2.5/1e6 + 100,000 * 4/1e6 = 0.5 + 0.4
    assert.equal(row.cost.cacheWrite, 0.9);
});

test('a record with no version carries version as null, never invented', () => {
    const r = root();
    registry.writeSession(r, ID3, base({
        spend: { build: { requests: 1, models: {
            'claude-sonnet-5': { input: 1, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 },
        } } },
    }));
    assert.equal(spend.sessionsOf([r]).rows[0].version, null);
});

test('a model lib/prices.js does not price is reported as unpriced, not counted as zero', () => {
    const r = root();
    registry.writeSession(r, ID4, base({
        spend: { build: { requests: 2, models: {
            'claude-sonnet-5': { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 },
            'claude-unknown-model': { input: 999_000_000, output: 999_000_000, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 },
        } } },
    }));
    const row = spend.sessionsOf([r]).rows[0];
    assert.deepEqual(row.unpriced, ['claude-unknown-model']);
    assert.equal(row.cost.input, 2, 'the unpriced model\'s 999M input tokens must not be folded in as zero');
});

test('a record with no spend field is skipped, not an error', () => {
    const r = root();
    registry.writeSession(r, ID5, base());
    const out = spend.sessionsOf([r]);
    assert.deepEqual(out.rows, []);
    assert.equal(out.scanned, 1);
    assert.equal(out.noSpend, 1);
    assert.equal(out.unreadable, 0);
});

test('requests sum stage and subagents requests across stages, and own cost is split from subagents\'', () => {
    const r = root();
    registry.writeSession(r, ID6, base({
        route: ['survey', 'build'],
        spend: {
            survey: { requests: 2, models: {
                'claude-sonnet-5': { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 },
            } },
            build: { requests: 3, models: {}, subagents: { requests: 5, models: {
                'claude-opus-5': { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 },
            } } },
        },
    }));
    const row = spend.sessionsOf([r]).rows[0];
    assert.equal(row.requests, 2 + 3 + 5);
    assert.equal(row.own, 2, 'sonnet input priced at 2/million, from the survey stage alone');
    assert.equal(row.subagents, 5, 'opus input priced at 5/million, from build\'s subagents alone');
});

test('buckets groups sessions by request count into the four ranges and shares each component', () => {
    const r = root();
    registry.writeSession(r, ID7, base({
        spend: { build: { requests: 10, models: {
            'claude-sonnet-5': { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 },
        } } },
    })); // usd 2, all input, requests 10 -> '<50'
    registry.writeSession(r, ID8, base({
        spend: { build: { requests: 900, models: {
            'claude-sonnet-5': { input: 0, output: 1_000_000, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 },
        } } },
    })); // usd 10, all output, requests 900 -> '800+'
    const { rows } = spend.sessionsOf([r]);
    const b = spend.buckets(rows);
    assert.deepEqual(b.map((x) => x.range), ['<50', '50-199', '200-799', '800+']);
    const under50 = b.find((x) => x.range === '<50');
    const mid = b.find((x) => x.range === '50-199');
    const over800 = b.find((x) => x.range === '800+');
    assert.equal(under50.count, 1);
    assert.equal(under50.total, 2);
    assert.equal(under50.median, 2);
    assert.equal(under50.share.input, 1);
    assert.equal(over800.count, 1);
    assert.equal(over800.total, 10);
    assert.equal(over800.share.output, 1);
    assert.equal(mid.count, 0);
    assert.equal(mid.total, 0);
    assert.equal(mid.median, null);
});

test('sessionsOf counts a priced record, a spend-less one and one that does not parse, and only the priced one is a row', () => {
    const r = root();
    const PRICED = 'aaaaaaaa-1111-1111-1111-111111111111';
    const BARE = 'aaaaaaaa-2222-1111-1111-111111111111';
    const BROKEN = 'aaaaaaaa-0bad-1111-1111-111111111111';
    registry.writeSession(r, PRICED, base({
        spend: { build: { requests: 1, models: {
            'claude-sonnet-5': { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 },
        } } },
    }));
    registry.writeSession(r, BARE, base());
    const sessionsDir = path.join(r, '.fankeel', 'sessions');
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.writeFileSync(path.join(sessionsDir, BROKEN + '.json'), 'not valid json{');

    const { rows, scanned, noSpend, unreadable } = spend.sessionsOf([r]);
    assert.equal(scanned, 3, 'every session file looked at, parsed or not');
    assert.equal(noSpend, 1, 'the bare record, parsed but with nothing to price');
    assert.equal(unreadable, 1, 'the broken file, counted by registry.readAll itself');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].sessionId, PRICED);
});

test('scripts/spend.js parseArgs reads --root, and leaves it null with none given', () => {
    assert.equal(parseArgs(['--root', 'X:/somewhere']).root, 'X:/somewhere');
    assert.equal(parseArgs([]).root, null);
});

test('resolveRoots takes the override route with --root, and station.discover otherwise', () => {
    const overridden = resolveRoots(path.join('some', 'dir'));
    assert.equal(overridden.via, 'override');
    assert.deepEqual(overridden.roots, [path.resolve('some', 'dir')]);

    const real = station.discover;
    const seen = [];
    station.discover = (opts) => { seen.push(opts); return { roots: ['R'], gone: [] }; };
    try {
        assert.deepEqual(resolveRoots(null), { roots: ['R'], via: 'station.discover' });
        assert.equal(seen.length, 1);
        assert.equal(seen[0].cwd, process.cwd());
        assert.equal(typeof seen[0].configDir, 'string');
    } finally {
        station.discover = real;
    }
});

test('scripts/spend.js main --root prints the session and bucket tables for that one root', () => {
    const r = root();
    registry.writeSession(r, ID9, base({
        spend: { build: { requests: 10, models: {
            'claude-sonnet-5': { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 },
        } } },
    }));
    const { text } = main(['--root', r]);
    assert.match(text, /^roots \(override\): /);
    assert.match(text, new RegExp(ID9));
    assert.match(text, /buckets by request count/);
    assert.match(text, /\$2\.00/, 'the $2.00 session cost prints somewhere in the tables');
});
