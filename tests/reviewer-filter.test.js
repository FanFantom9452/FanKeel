'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8').replace(/\s+/g, ' ');

test('the reviewer dismisses nits, untraced assumptions and taste, and an empty review is a result', () => {
    const r = read('agents/fankeel-reviewer.md');
    assert.match(r, /every finding is a nit, the code is fine/);
    assert.match(r, /trace it to a real caller/);
    assert.match(r, /I would have done it differently/);
    assert.match(r, /An empty review is a result/);
});

test('the reviewer presumes four cuts: a file past 1000 lines, a scattered feature check, a no-op wrapper or cast, a duplicate helper', () => {
    const r = read('agents/fankeel-reviewer.md');
    const cuts = r.slice(r.indexOf('## Cuts When'), r.indexOf('## Security When'));
    assert.match(cuts, /past 1000 lines/);
    assert.match(cuts, /feature check scattered/);
    assert.match(cuts, /wrapper or a cast/);
    assert.match(cuts, /duplicates a helper/);
});

test('verify confirms the adversary on a different model', () => {
    const v = read('skills/fankeel-verify/SKILL.md');
    assert.match(v, /model other than the adversary's/);
});
