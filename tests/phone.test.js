'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const phone = require('../lib/phone.js');
const tmp = require('./tmp.js');

const SID = 'bbbbbbbb-1111-4111-8111-000000000001';
const file = (root, name) => path.join(phone.dirOf(root, SID), name);

test('dirOf sits under the registry and refuses a bad session id', () => {
    const root = tmp('fankeel-phone-');
    assert.equal(phone.dirOf(root, SID), path.join(root, '.fankeel', 'station', 'phone', SID));
    assert.equal(phone.dirOf(root, '../x'), null);
});

test('attach, isAttached, detach', () => {
    const root = tmp('fankeel-phone-');
    assert.equal(phone.isAttached(root, SID), false);
    assert.equal(phone.attach(root, SID, 'my-pc', 5), true);
    assert.deepEqual(JSON.parse(fs.readFileSync(file(root, 'attach.json'), 'utf8')), { at: 5, device: 'my-pc' });
    assert.equal(phone.isAttached(root, SID), true);
    assert.equal(phone.detach(root, SID), true);
    assert.equal(phone.detach(root, SID), false);
    assert.equal(phone.isAttached(root, SID), false);
});

test('say refuses empty, too long, unattached and a second message; take empties the inbox', () => {
    const root = tmp('fankeel-phone-');
    assert.equal(phone.say(root, SID, 'hi', 1).code, 409);
    phone.attach(root, SID, 'my-pc', 1);
    assert.equal(phone.say(root, SID, '   ', 1).code, 400);
    assert.equal(phone.say(root, SID, 'x'.repeat(phone.SAY_MAX + 1), 1).code, 400);
    assert.deepEqual(phone.say(root, SID, '  跑吧 ', 2), { ok: true });
    const again = phone.say(root, SID, 'more', 3);
    assert.equal(again.code, 409);
    assert.match(again.reason, /already waiting/);
    assert.deepEqual(phone.take(root, SID), { text: '跑吧', at: 2 });
    assert.equal(fs.existsSync(file(root, 'inbox.json')), false);
    assert.equal(phone.take(root, SID), null);
});

test('append keeps known roles, caps text, trims to the last 200 lines; chat reads n', () => {
    const root = tmp('fankeel-phone-');
    assert.equal(phone.append(root, SID, { role: 'stranger', text: 'x', at: 1 }), false);
    phone.append(root, SID, { role: 'assistant', text: 'y'.repeat(9000), at: 1 });
    assert.equal(phone.chat(root, SID, 1)[0].text.length, 8001);
    for (let i = 0; i < 205; i++) phone.append(root, SID, { role: 'desktop', text: String(i), at: i });
    const all = phone.chat(root, SID, 0);
    assert.equal(all.length, 200);
    assert.equal(all[199].text, '204');
    assert.deepEqual(phone.chat(root, SID, 2).map((x) => x.text), ['203', '204']);
});

test('writeBackground carries since by id, and an empty list clears it', () => {
    const root = tmp('fankeel-phone-');
    const item = { id: 'b1', type: 'shell', status: 'running', description: 'tests', command: 'npm test' };
    phone.writeBackground(root, SID, [item], 100);
    phone.writeBackground(root, SID, [item, Object.assign({}, item, { id: 'b2' })], 200);
    assert.deepEqual(phone.background(root, SID).map((x) => [x.id, x.since]), [['b1', 100], ['b2', 200]]);
    phone.writeBackground(root, SID, null, 300);
    assert.deepEqual(phone.background(root, SID), []);
});

test('hold returns a waiting message, a detach, or a timeout that detaches', () => {
    const root = tmp('fankeel-phone-');
    phone.attach(root, SID, 'my-pc', 1);
    phone.say(root, SID, 'go', 1);
    assert.deepEqual(phone.hold(root, SID, 1000), { text: 'go' });
    assert.equal(fs.existsSync(file(root, 'holding.json')), false);
    assert.deepEqual(phone.hold(root, SID, 300), { gone: 'timeout' });
    assert.equal(phone.isAttached(root, SID), false);
    assert.deepEqual(phone.hold(root, SID, 300), { gone: 'detached' });
    assert.deepEqual(phone.hold(root, '../x', 300), { gone: 'no session' });
});

test('stepOf labels each tool kind; stepOk reads failures', () => {
    const cwd = path.resolve('/work/proj');
    assert.deepEqual(phone.stepOf('Bash', { command: 'npm test\nmore', description: 'Run the tests' }, cwd), { label: 'Run the tests' });
    assert.deepEqual(phone.stepOf('PowerShell', { command: 'Get-ChildItem\nx' }, cwd), { label: 'Get-ChildItem' });
    assert.deepEqual(phone.stepOf('Read', { file_path: path.join(cwd, 'lib', 'a.js') }, cwd), { label: 'lib/a.js' });
    assert.equal(phone.stepOf('Edit', { file_path: path.resolve('/elsewhere/b.js') }, cwd).label, path.resolve('/elsewhere/b.js').replace(/\\/g, '/'));
    assert.deepEqual(phone.stepOf('Grep', { pattern: 'foo.*bar' }, cwd), { label: 'foo.*bar' });
    assert.deepEqual(phone.stepOf('Agent', { description: 'Plan it', run_in_background: true }, cwd), { label: 'Plan it', background: true });
    assert.deepEqual(phone.stepOf('mcp__Claude_Browser__navigate', {}, cwd), { label: 'Claude_Browser · navigate' });
    assert.deepEqual(phone.stepOf('TodoWrite', {}, cwd), { label: 'TodoWrite' });
    const long = phone.stepOf('Bash', { description: 'a  b ' + 'c'.repeat(100) }, cwd).label;
    assert.equal(long.length, 80);
    assert.match(long, /^a b c+…$/);
    assert.equal(phone.stepOk({ is_error: true }), false);
    assert.equal(phone.stepOk({ success: false }), false);
    assert.equal(phone.stepOk({ interrupted: true }), false);
    assert.equal(phone.stepOk({ stdout: 'ok' }), true);
    assert.equal(phone.stepOk('text'), true);
});
