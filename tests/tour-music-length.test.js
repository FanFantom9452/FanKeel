'use strict';
// The score's length follows the timeline it scores. Red when: render()
// ignores its second argument, or resolveBar / the default length changes.
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../assets/station/tour-music.js');

test('a 1800-frame timeline gets a 30-second score', () => {
    assert.equal(M.render({ cuts: [0], blocks: [] }, 1800).length, 30 * 44100);
});

test('without a length the score is reel\'s 60 seconds, sample for sample', () => {
    const cues = { cuts: [0, 240, 480], blocks: [60, 300] };
    const a = M.render(cues), b = M.render(cues, 3600);
    assert.equal(a.length, 60 * 44100);
    assert.deepEqual(Array.from(a.subarray(0, 44100 * 2)), Array.from(b.subarray(0, 44100 * 2)));
    assert.equal(M.resolveBar(3600), 28);
});

test('the 30-second score resolves on bar 13', () => {
    assert.equal(M.resolveBar(1800), 13);
});
