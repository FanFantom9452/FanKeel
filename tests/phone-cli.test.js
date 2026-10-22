'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const registry = require('../lib/registry.js');
const phone = require('../lib/phone.js');
const { main } = require('../scripts/phone.js');
const tmp = require('./tmp.js');

const SID = 'dddddddd-3333-4333-8333-000000000001';

function project() {
    const root = tmp('fankeel-phone-cli-');
    registry.ensureLayout(root);
    registry.writeSession(root, SID, { task: 't', stage: 'build', active: true, claims: [], started: '2026-10-22T00:00:00.000Z', updated: new Date().toISOString() });
    return root;
}

test('attach and detach one session', () => {
    const root = project();
    const a = main(['attach', '--session', SID, '--root', root]);
    assert.equal(a.code, 0);
    assert.match(a.text, /^phone: attached/);
    assert.equal(phone.isAttached(root, SID), true);
    assert.equal(main(['detach', '--session', SID, '--root', root]).code, 0);
    assert.equal(phone.isAttached(root, SID), false);
});

test('no session, an unknown session, or an unknown verb is refused', () => {
    const root = project();
    assert.equal(main(['attach', '--root', root]).code, 2);
    assert.equal(main(['attach', '--session', 'eeeeeeee-0000-4000-8000-000000000000', '--root', root]).code, 2);
    assert.equal(main(['wave', '--session', SID, '--root', root]).code, 2);
});
