'use strict';
// station-67: the thumbnails of a phone message sit under its text, to the right like the bubble,
// a square each, so a photo never stretches the 84% message column.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'mobile.css'), 'utf8');

test('mobile.css: .shots wraps its photos to the right, .shot is a fixed square that crops', () => {
    assert.ok(css.includes('\n.shots{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px}'));
    assert.ok(css.includes('\n.shot{width:112px;height:112px;object-fit:cover;border-radius:var(--r-sm);background:var(--inset)}'));
});

test('mobile.css: the composer thumbnail rules are scoped to .ph-strip, so the phone bubble .msg.me.ph is not squashed', () => {
    assert.ok(!css.includes('\n.ph{'));
    assert.ok(!css.includes('\n.ph img{'));
    assert.ok(!css.includes('\n.ph>.ic{'));
    assert.ok(css.includes('\n.ph-strip .ph{'));
    assert.ok(css.includes('\n.ph-strip .ph img{'));
    assert.ok(css.includes('\n.ph-strip .ph>.ic{'));
});
