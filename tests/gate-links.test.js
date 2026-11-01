'use strict';

// docs/90-agent/plans/2026-11-01-professor-ci-tiers-design.md §6: the block a
// stage run in the session gets names its gate page on this machine and on
// the phone, and says to print them in the reply before AskUserQuestion,
// never inside an option (the user's correction, 2026-11-02).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');
const { render, gateLinks } = require('../lib/render.js');

const ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const SERVE = { pid: 1, port: 28888, url: 'http://127.0.0.1:28888/', started: '2026-11-02T00:00:00.000Z', remote: { url: 'https://box.tail1.ts.net/' } };
const entry = (stage) => ({ sessionId: ID, data: { task: 't', stage, route: ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'], active: true,
    started: '2026-11-02T00:00:00.000Z', updated: '2026-11-02T00:00:00.000Z' } });
const profileWith = (agents) => ({ values: { 'stage.agents': agents }, sources: {}, unreadable: [] });

test('gateLinks names the desktop and phone gate pages, then the rule', () => {
    assert.deepEqual(gateLinks(SERVE, ID), [
        'gate page: http://127.0.0.1:28888/f/' + ID + '/gate',
        'phone: https://box.tail1.ts.net/m#/s/' + ID + '/gate',
        'Print the gate page: and phone: lines in your reply just before AskUserQuestion; never put them inside an option.',
    ]);
    assert.doesNotMatch(gateLinks(SERVE, ID)[2], /description copies/);
});

test('no tailnet url: the desktop line alone, with the rule', () => {
    const lines = gateLinks(Object.assign({}, SERVE, { remote: { warning: 'tailscale is not running' } }), ID);
    assert.equal(lines.length, 2);
    assert.match(lines[0], /^gate page: http:\/\/127\.0\.0\.1:28888\/f\//);
    assert.doesNotMatch(lines.join('\n'), /^phone:/m);
});

test('no station record, or one with no url: no lines at all', () => {
    assert.deepEqual(gateLinks(null, ID), []);
    assert.deepEqual(gateLinks({ pid: 1 }, ID), []);
    assert.deepEqual(gateLinks(SERVE, null), []);
});

test('an in-session stage carries the lines; a controlled one, or a render with no serve, does not', () => {
    const own = render({ mine: entry('design'), others: [], now: Date.now(), profile: profileWith(['survey']), serve: SERVE });
    assert.match(own, /^gate page: http:\/\/127\.0\.0\.1:28888\/f\/aaaaaaaa-0000-4000-8000-000000000001\/gate$/m);
    assert.match(own, /^phone: https:\/\/box\.tail1\.ts\.net\/m#\/s\/aaaaaaaa-0000-4000-8000-000000000001\/gate$/m);
    const controlled = render({ mine: entry('survey'), others: [], now: Date.now(), profile: profileWith(['survey']), serve: SERVE });
    assert.doesNotMatch(controlled, /^gate page:/m);
    const none = render({ mine: entry('design'), others: [], now: Date.now(), profile: profileWith(['survey']) });
    assert.doesNotMatch(none, /^gate page:/m, 'blockSizes renders this way, so the capped block does not move');
});

test('inject.js reads serve.json from the config dir and puts the lines in the block', () => {
    const root = tmp('fankeel-gate-links-');
    const cfg = tmp('fankeel-gate-links-cfg-');
    fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
    fs.writeFileSync(path.join(root, '.fankeel', 'sessions', ID + '.json'), JSON.stringify(entry('design').data));
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.writeFileSync(path.join(cfg, 'fankeel', 'serve.json'), JSON.stringify(SERVE));
    const out = execFileSync(process.execPath, [path.join(__dirname, '..', 'hooks', 'inject.js')], {
        input: JSON.stringify({ session_id: ID, cwd: root, prompt: 'go on', hook_event_name: 'UserPromptSubmit' }),
        encoding: 'utf8',
        env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg, CLAUDE_PROJECT_DIR: root, FANKEEL_SERVE: '' }),
    });
    const block = JSON.parse(out).hookSpecificOutput.additionalContext;
    assert.match(block, /^gate page: http:\/\/127\.0\.0\.1:28888\/f\/aaaaaaaa-0000-4000-8000-000000000001\/gate$/m);
    assert.match(block, /^phone: https:\/\/box\.tail1\.ts\.net\/m#\/s\/aaaaaaaa-0000-4000-8000-000000000001\/gate$/m);
});
