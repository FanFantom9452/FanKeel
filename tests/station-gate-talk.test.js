// tests/station-gate-talk.test.js
'use strict';
// The gate page's way back to the session's talk page: a link in the head to
// /#/s/<id>/talk, beside the title link to the session page.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { page, stringsLeft } = require('./station-module.js');

const SID = 'dddddddd-4444-4444-8444-444444444444';
const S = { id: SID, task: 'Gate talk', project: 'fankeel', state: 'live', stage: 'plan', route: ['survey', 'plan', 'build', 'land'] };
const boot = () => page(['gate-frame.js'], { sessions: [S] }).M['gate-frame.js'];

test('the head links to the talk page of this session', () => {
    const html = boot().frame({ session: S, gate: null, tasks: [], reportHtml: '', shellsHtml: '' });
    assert.match(html, /<a class="gt-talk" data-block="gate-talk" href="\/#\/s\/dddddddd-4444-4444-8444-444444444444\/talk"[^>]*>[\s\S]*?對話<\/span><\/a>/);
    const head = html.slice(html.indexOf('data-block="gate-head"'), html.indexOf('</section>'));
    assert.ok(head.includes('class="gt-talk"'), 'the link is inside the head card');
    assert.ok(head.includes('<a class="gh-link" href="/#/s/' + SID + '"'), 'the title link to the session page stays');
});

test('the talk link has English and a rule in the stylesheet', () => {
    assert.deepEqual(stringsLeft('gate-frame.js', boot().EN), []);
    assert.ok(fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'gate-frame.css'), 'utf8').includes('.gt-talk'));
});
