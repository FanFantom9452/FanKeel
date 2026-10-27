'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// station-59：.eyebrow 不再是大寫加字距的小標，.dead 不再有左側 3px 邊條。
const css = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.css'), 'utf8');

test('.eyebrow is not uppercase tracked text', () => {
    const rule = /(^|\n)\.eyebrow\{([^}]*)\}/.exec(css);
    assert.ok(rule, '.eyebrow rule missing');
    assert.doesNotMatch(rule[2], /text-transform:\s*uppercase|letter-spacing/);
});

test('.dead has no left accent bar', () => {
    const rule = /(^|\n)\.dead\{([^}]*)\}/.exec(css);
    assert.ok(rule, '.dead rule missing');
    assert.doesNotMatch(rule[2], /border-left/);
});
