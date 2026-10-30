'use strict';
// lib/profile.js: weekly.facets, the facet vocabulary the weekly report files
// its cards under (docs/90-agent/plans/2026-10-30-weekly-facets-design.md §2).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const profile = require('../lib/profile.js');
const tmp = require('./tmp.js');

test('weekly.facets takes 名稱:受眾 pairs, comma-separated, and reads its stored list back', () => {
    assert.deepEqual(profile.parseValue('weekly.facets', '商業／產品:general, 後端／資料:TECH,使用者介面:both'),
        { value: ['商業／產品:general', '後端／資料:tech', '使用者介面:both'] });
    assert.deepEqual(profile.parseValue('weekly.facets', ['甲:general', '乙:tech']), { value: ['甲:general', '乙:tech'] });
});

test('weekly.facets refuses an empty list, a missing or unknown audience, a repeated or over-long name, more than 12', () => {
    const many = Array.from({ length: 13 }, (_, i) => 'f' + i + ':tech').join(',');
    for (const raw of ['', ' , ', '甲', '甲:', ':tech', '甲:everyone', '甲:tech,甲:general', '一二三四五六七八九十一二三:tech', '有 空白:tech', many]) {
        const got = profile.parseValue('weekly.facets', raw);
        assert.ok(got.error && got.error.startsWith('weekly.facets is 1 to 12 名稱:受眾 pairs'), JSON.stringify(raw));
    }
});

test('weekly.facets written to the project file reads back as the list', () => {
    const root = tmp('fankeel-weekly-facets-');
    const cfg = tmp('fankeel-weekly-facets-cfg-');
    const res = profile.write(profile.projectFile(root), 'weekly.facets', '甲:general,乙:tech');
    assert.equal(res.ok, true, res.reason);
    assert.deepEqual(profile.read(root, cfg).values['weekly.facets'], ['甲:general', '乙:tech']);
});

test('weekly.facets is free text, off the wizard, unset by default, with a row in the guide', () => {
    const spec = profile.KEYS['weekly.facets'];
    assert.ok(spec && spec.free && spec.desc && !spec.desc.includes('\n'));
    assert.equal(spec.builtin, null);
    assert.equal(Object.prototype.hasOwnProperty.call(profile.WIZARD_KEYS, 'weekly.facets'), false);
    const page = fs.readFileSync(path.join(__dirname, '..', 'docs', '01-guide', 'profile.md'), 'utf8');
    assert.ok(page.includes('| `weekly.facets` |'), 'no row on docs/01-guide/profile.md');
    assert.ok(page.includes('`weekly.facets` 是週報卡片的面向詞表'), 'the free-text paragraph does not name it');
});
