'use strict';
// lib/profile.js: weekly.roots, where scripts/weekly.js scan looks for
// repositories (docs/90-agent/plans/2026-10-27-weekly-skill-design.md, 檔案).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const profile = require('../lib/profile.js');
const tmp = require('./tmp.js');

test('weekly.roots takes one or more absolute directories, comma-separated, as forward-slash paths', () => {
    assert.deepEqual(profile.parseValue('weekly.roots', 'F:/ymlab, F:\\ymlab\\SBIR'), { value: ['F:/ymlab', 'F:/ymlab/SBIR'] });
    assert.deepEqual(profile.parseValue('weekly.roots', '/srv/repos'), { value: ['/srv/repos'] });
    assert.deepEqual(profile.parseValue('weekly.roots', ['F:/a', 'F:/b']), { value: ['F:/a', 'F:/b'] }, 'the stored array reads back');
});

test('weekly.roots refuses an empty value and any relative directory', () => {
    for (const raw of ['', ' , ', 'repos', 'F:/a,relative/dir']) {
        const got = profile.parseValue('weekly.roots', raw);
        assert.ok(got.error && got.error.startsWith('weekly.roots is one or more absolute directories'), JSON.stringify(raw));
    }
});

test('weekly.roots written to the project file reads back as an array', () => {
    const root = tmp('fankeel-weekly-roots-');
    const cfg = tmp('fankeel-weekly-roots-cfg-');
    const roots = path.join(root, 'a').replace(/\\/g, '/') + ',' + path.join(root, 'b').replace(/\\/g, '/');
    const res = profile.write(profile.projectFile(root), 'weekly.roots', roots);
    assert.equal(res.ok, true, res.reason);
    assert.deepEqual(profile.read(root, cfg).values['weekly.roots'], roots.split(','));
});

test('weekly.roots is free text, off the wizard, unset by default, with a row in the guide', () => {
    const spec = profile.KEYS['weekly.roots'];
    assert.ok(spec && spec.free && spec.desc && !spec.desc.includes('\n'));
    assert.equal(spec.builtin, null);
    assert.equal(Object.prototype.hasOwnProperty.call(profile.WIZARD_KEYS, 'weekly.roots'), false);
    const page = fs.readFileSync(path.join(__dirname, '..', 'docs', '01-guide', 'profile.md'), 'utf8');
    assert.ok(page.includes('| `weekly.roots` |'), 'no row on docs/01-guide/profile.md');
});
