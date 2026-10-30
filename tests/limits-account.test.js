'use strict';
// Task 1 of docs/90-agent/plans/2026-10-30-spend-quota.md: each limits row names the
// account it was read under — the accountUuid of the session's .claude.json, never the
// email or the name.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const NOW = Date.parse('2026-10-30T01:00:00.000Z');
const L = [
    { kind: 'five_hour', percentUsed: 12, resetsAt: '2026-10-30T05:00:00.000Z' },
    { kind: 'seven_day', percentUsed: 40, resetsAt: '2026-11-05T19:00:00.000Z' },
];
const claude = (id) => JSON.stringify({ oauthAccount: { accountUuid: id, emailAddress: 'someone@example.com', displayName: 'Some One' } });
const live = { task: 'T', stage: 'build', active: true };

async function pane() {
    globalThis.h = globalThis.h || ((tag, props, ...children) => ({ tag, props: props || {}, children: children.flat() }));
    return import(pathToFileURL(path.join(__dirname, '..', 'hooks', 'pane.ts')).href);
}
function engine(store, env) {
    return {
        env: { get: async (k) => (env && k in env ? env[k] : '') },
        clock: { now: async () => NOW },
        fs: { exists: async (p) => p in store, read: async (p) => store[p], write: async (p, t) => { store[p] = t; } },
        ui: { log() {} },
    };
}
const rowOf = (store, id) => JSON.parse(store['R/.fankeel/build/limits/' + id + '.jsonl'].trim());

test('accountOf takes the accountUuid out of a .claude.json and nothing else', async () => {
    const { accountOf } = await import(pathToFileURL(path.join(__dirname, '..', 'hooks', 'pane-limits.ts')).href);
    assert.equal(accountOf(claude('acc-1111')), 'acc-1111');
    assert.equal(accountOf('{}'), null);
    assert.equal(accountOf('{"oauthAccount":{"accountUuid":""}}'), null);
    assert.equal(accountOf('not json'), null);
});

test('recordLimits stamps the accountUuid from <home>/.claude.json, and no email or name', async () => {
    const { recordLimits } = await pane();
    const store = { 'H/.claude.json': claude('acc-1111') };
    await recordLimits(engine(store, { HOME: 'H' }), 'R', 'acct-a', live, L, {});
    const row = rowOf(store, 'acct-a');
    assert.equal(row.account, 'acc-1111');
    assert.doesNotMatch(JSON.stringify(row), /someone@example\.com|Some One/);
});

test('the .claude.json in the session\'s own config dir wins over the home one', async () => {
    const { recordLimits } = await pane();
    const store = { 'C/.claude.json': claude('acc-2222'), 'H/.claude.json': claude('acc-1111') };
    await recordLimits(engine(store, { HOME: 'H' }), 'R', 'acct-b', Object.assign({ configDir: 'C' }, live), L, {});
    assert.equal(rowOf(store, 'acct-b').account, 'acc-2222');
});

test('with no env and no .claude.json the row is still written, without an account', async () => {
    const { recordLimits } = await pane();
    const store = {};
    const $ = engine(store, null);
    delete $.env;
    await recordLimits($, 'R', 'acct-c', live, L, {});
    assert.equal('account' in rowOf(store, 'acct-c'), false);
});
