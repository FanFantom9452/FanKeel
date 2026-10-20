'use strict';

// docs/90-agent/todo/test-13.md, item one: main() returns `stale` for a
// handoff whose gate went out after its last change, end to end — the test
// that goes red when that one line of scripts/await.js is deleted.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const awaitCli = require('../scripts/await.js');
const tmp = require('./tmp.js');

const SID = 'aaaaaaaa-0000-4000-8000-000000000017';

function fixture(askedAt) {
    const root = tmp('fankeel-await-main-stale-');
    fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
    fs.writeFileSync(path.join(root, '.fankeel', 'sessions', SID + '.json'), JSON.stringify({
        active: true, stage: 'build', started: '2026-09-23T10:00:00.000Z', moves: [['build', 1]],
        gateAsked: { stage: 'build', hash: 'h', at: askedAt },
    }));
    const task = path.join(root, '.fankeel', 'build', 'task-20260923T100000').replace(/\\/g, '/');
    fs.mkdirSync(task, { recursive: true });
    fs.writeFileSync(task + '/build.md', 'report\n');
    return { root, handoff: task + '/build.md', env: { CLAUDE_CONFIG_DIR: tmp('fankeel-await-main-stale-config-') } };
}

test('main() says stale for a handoff already asked, and handoff for one rewritten after the ask', async () => {
    const asked = fixture(Date.now() + 60000);
    const out = await awaitCli.main(['--session', SID, '--root', asked.root, '--timeout', '5'], asked.env);
    assert.equal(out.text, 'stale ' + asked.handoff + ' — already asked; nothing to do, end the turn without a reply.');

    const fresh = fixture(Date.now() - 60000);
    const news = await awaitCli.main(['--session', SID, '--root', fresh.root, '--timeout', '5'], fresh.env);
    assert.ok(news.text.startsWith('handoff ' + fresh.handoff + ' — '), news.text);
});
