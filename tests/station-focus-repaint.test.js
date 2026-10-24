'use strict';
// The focus page's 5 s repaint (station-37): it replaces the page only when
// the markup changed and the reader is not typing in a field of it.
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = { STATION: { serve: false, pricesVerified: '2026-09-04' } };
const F = require('../assets/station/focus-page.js');

test('the same markup is not painted again', () => {
    assert.equal(F.repaint('<main>a</main>', '<main>a</main>', null), false);
});

test('changed markup is painted, and the first paint always is', () => {
    assert.equal(F.repaint('<main>a</main>', '<main>b</main>', null), true);
    assert.equal(F.repaint(null, '<main>a</main>', null), true);
});

test('changed markup waits while a text field has focus', () => {
    assert.equal(F.repaint('a', 'b', { tagName: 'TEXTAREA' }), false);
    assert.equal(F.repaint('a', 'b', { tagName: 'input' }), false);
    assert.equal(F.repaint('a', 'b', { tagName: 'BUTTON' }), true);
    assert.equal(F.repaint('a', 'b', { tagName: 'BODY' }), true);
});
