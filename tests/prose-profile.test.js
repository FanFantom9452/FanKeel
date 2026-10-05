'use strict';

// `prose.style`: a choice like `guard`, set with `task.js profile set`, which
// prints what the chosen rules cost a brief.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');
const profile = require('../lib/profile.js');
const prose = require('../lib/prose.js');

const TASK = path.join(__dirname, '..', 'scripts', 'task.js');

function cli(d, ...args) {
    const cfg = path.join(d, 'cfg');
    return execFileSync(process.execPath, [TASK, ...args, '--root', d, '--claude-dir', cfg],
        { encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }) });
}

test('prose.style is writer by default and takes the four names', () => {
    const d = tmp('fankeel-prose-profile-');
    assert.equal(profile.read(d, null).values['prose.style'], 'writer');
    assert.deepEqual(profile.KEYS['prose.style'].values, prose.NAMES);
    assert.equal(profile.parseValue('prose.style', ' Sepia ').value, 'sepia');
    assert.equal(profile.parseValue('prose.style', 'fancy').error, 'prose.style is one of: writer, plain, sepia, custom');
});

test('prose.style is set at the command line, not in the station wizard', () => {
    assert.equal(Object.prototype.hasOwnProperty.call(profile.WIZARD_KEYS, 'prose.style'), false);
    assert.ok(profile.profileTable().find((r) => r[0] === '`prose.style`'), 'no table row');
});

test('profile set prose.style prints the size of the rules it picked', () => {
    const d = tmp('fankeel-prose-profile-');
    const sepia = cli(d, 'profile', 'set', 'prose.style', 'sepia');
    assert.match(sepia, new RegExp('^' + prose.length(prose.STYLES.sepia) + ' characters, ~\\d+ tok', 'm'));
    assert.doesNotMatch(sepia, /warning/);
    const missing = cli(d, 'profile', 'set', 'prose.style', 'custom');
    assert.match(missing, /missing or empty — using writer/);
    fs.writeFileSync(path.join(d, '.fankeel', 'prose.md'), 'y'.repeat(prose.SUGGESTED + 50));
    const over = cli(d, 'profile', 'set', 'prose.style', 'custom');
    assert.match(over, new RegExp('^' + (prose.SUGGESTED + 50) + ' characters', 'm'));
    assert.match(over, /this is a warning, not a refusal/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(d, '.fankeel', 'profile.json'), 'utf8'))['prose.style'], 'custom');
});
