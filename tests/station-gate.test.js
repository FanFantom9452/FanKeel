'use strict';

// `serialize().gates` is the cross-session tally of how often a gate's option
// one lost — `lib/replay.js`'s `qs[i].labels` in the order AskUserQuestion
// gave the options, so `labels[0]` is option one, the one whose wording
// carries the approval. This file pins the counting rule directly against
// `serialize()`, the only place `gateSummary()` is reachable from outside
// `lib/station.js` — it is not exported on its own.

const test = require('node:test');
const assert = require('node:assert/strict');
const station = require('../lib/station.js');

// `serialize()` returns the committed `station-data.js` text, not an object:
// `'window.STATION = ' + JSON.stringify(out) + ';\n'`. Parsing it back is the
// only way to read `.gates` off it without a browser.
function parseSerialize(model) {
    const src = station.serialize(model);
    const m = /^window\.STATION = ([\s\S]*);\n$/.exec(src);
    assert.ok(m, 'serialize() keeps its window.STATION = ...; wrapper');
    return JSON.parse(m[1]);
}

// The fields `serialize()`'s `sessions:` mapping and `flatten()` read off
// every session, kept to what will not throw while building that mapping:
// `stages` must be an array (`.map` runs on it unconditionally); everything
// else may be absent because every other read there is guarded.
function fakeSession(id, events) {
    return {
        sessionId: id, project: null, task: '', state: 'down', unknown: false,
        stage: '', route: [], step: 0, steps: 0, started: null, updated: null,
        ended: null, model: null, stages: [], clock: null, waited: null,
        claims: [], notes: [], next: '', guard: '', backtracks: 0, tasks: [],
        detail: { events, days: [], spans: [] },
    };
}

function fakeRegistry(root, sessions) {
    return { root, gone: false, unreadable: 0, build: [], mapAt: null, sessions, profiles: {} };
}

function fakeModel(registries) {
    return {
        generatedAt: new Date(2026, 8, 14).toISOString(), configDir: 'C:\\cfg',
        pricesVerified: null, scanStats: null, machineProfile: null, registries,
    };
}

function gateEvent(qs) {
    return { kind: 'gate', qs };
}

test('gateSummary counts a session that kept option one and one that swapped to option two', () => {
    // Mutation that reddens this: delete the `if (q.a !== first) lost.set(...)`
    // line in `gateSummary()` (or drop `gates: gateSummary(model),` from
    // `serialize()`'s return object) — `out.gates` is then undefined and
    // reading `.swapped` off it throws.
    const model = fakeModel([fakeRegistry('F:\\ws\\a', [
        fakeSession('s1', [gateEvent([{ q: 'ship it?', a: 'approve wording', own: false, labels: ['approve wording', 'not yet'] }])]),
        fakeSession('s2', [gateEvent([{ q: 'ship it?', a: 'not yet', own: false, labels: ['approve wording', 'not yet'] }])]),
    ])]);
    const out = parseSerialize(model);
    assert.deepEqual(out.gates.swapped, [{ label: 'approve wording', lost: 1, total: 2 }]);
});

test('a gate with no answer counts toward neither lost nor total', () => {
    // Mutation that reddens this: drop the `|| q.a === null` half of the
    // guard (`if (typeof first !== 'string' || q.a === null) continue;`) —
    // an unanswered gate would then add 1 to `total` and `swapped` would hold
    // `{ label: 'approve wording', lost: 0, total: 1 }` instead of `[]`.
    const model = fakeModel([fakeRegistry('F:\\ws\\a', [
        fakeSession('s1', [gateEvent([{ q: 'ship it?', a: null, own: false, labels: ['approve wording', 'not yet'] }])]),
    ])]);
    const out = parseSerialize(model);
    assert.deepEqual(out.gates.swapped, []);
});

test('an Other answer (own: true) still counts as option one losing, same as a listed answer that differs', () => {
    // `own` is a different measurement — whether the person typed Other at
    // all — and `gateSummary()` never reads it; this pins that an Other
    // answer is not specially excluded from (or double-counted into) the
    // option-one loss tally. Mutation that reddens this: add `if (q.own)
    // continue;` (or `if (!q.own) ...`) inside the loop in `gateSummary()` —
    // `swapped` would then come back `[]` instead of one row with `lost: 1`.
    const model = fakeModel([fakeRegistry('F:\\ws\\a', [
        fakeSession('s1', [gateEvent([{ q: 'ship it?', a: 'do something else entirely', own: true, labels: ['approve wording', 'not yet'] }])]),
    ])]);
    const out = parseSerialize(model);
    assert.deepEqual(out.gates.swapped, [{ label: 'approve wording', lost: 1, total: 1 }]);
});
