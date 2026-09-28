'use strict';
// assets/station/tour-music.js — the promo's score rendered to PCM: 60 s at
// 44100 Hz, a hit on every cut, never over 0.9, faded over the last half bar,
// the same samples every time, and the WAV header scripts/tour-record.js
// hands to ffmpeg.
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../assets/station/tour-music.js');

// The design's eleven cut starts, and a block on most beats inside them.
const CUTS = [0, 240, 480, 840, 1200, 1560, 1920, 2280, 2640, 3000, 3240];
const BLOCKS = [];
CUTS.forEach((c, i) => {
    const end = i + 1 < CUTS.length ? CUTS[i + 1] : 3600;
    for (let f = c; f < end; f += 30) if ((f - c) % 90 !== 60) BLOCKS.push(f);
});
const CUES = { cuts: CUTS, blocks: BLOCKS };
const pcm = M.render(CUES);
const MS50 = Math.round(0.05 * M.RATE);

function peak(x, from, n) {
    let p = 0;
    for (let i = Math.max(0, from); i < Math.min(x.length, from + n); i++) p = Math.max(p, Math.abs(x[i]));
    return p;
}
function rms(x, from, n) {
    let s = 0;
    for (let i = from; i < from + n; i++) s += x[i] * x[i];
    return Math.sqrt(s / n);
}
// The loudest 50 ms at the cut's own start, over the loudest 50 ms at any
// other beat of the same cut.
function accent(x, i) {
    const c = CUTS[i], end = i + 1 < CUTS.length ? CUTS[i + 1] : 3600;
    let other = 0;
    for (let f = c + 30; f < end; f += 30) other = Math.max(other, peak(x, f * 735, MS50));
    return peak(x, c * 735, MS50) / other;
}

test('the render is sixty seconds of mono samples at 44100 Hz', () => {
    assert.equal(M.RATE, 44100);
    assert.ok(pcm instanceof Float32Array);
    assert.equal(pcm.length, 60 * 44100);
});

// Criterion: a hit within 50 ms of every cut start. Red when: the cuts are
// not voiced (the control below renders the same blocks with no cuts).
test('every cut start carries the loudest 50 ms of its cut', () => {
    CUTS.forEach((c, i) => assert.ok(accent(pcm, i) > 1.25, 'cut at f' + c + ': ' + accent(pcm, i).toFixed(2)));
});

test('control: with no cuts voiced, the same check fails on every one of them', () => {
    const flat = M.render({ cuts: [], blocks: BLOCKS });
    const held = CUTS.filter((c, i) => accent(flat, i) > 1.25);
    assert.deepEqual(held, [], 'still accented without hits');
});

test('the peak is at most 0.9 and the sound is not silent', () => {
    let p = 0;
    for (let i = 0; i < pcm.length; i++) p = Math.max(p, Math.abs(pcm[i]));
    assert.ok(p <= 0.9 + 1e-6, 'peak ' + p);
    assert.ok(p > 0.5, 'peak ' + p);
});

test('the last half bar fades out to silence', () => {
    const halfBar = 44100;
    assert.ok(Math.abs(pcm[pcm.length - 1]) < 1e-3);
    assert.ok(rms(pcm, pcm.length - halfBar / 4, halfBar / 4) < rms(pcm, pcm.length - halfBar - halfBar / 4, halfBar / 4) / 2);
});

test('two renders of one score are the same samples', () => {
    const again = M.render(CUES);
    for (let i = 0; i < pcm.length; i += 997) assert.equal(again[i], pcm[i], 'sample ' + i);
});

test('wav writes a 16-bit mono 44100 Hz header over the samples', () => {
    const b = Buffer.from(M.wav(new Float32Array([0, 1, -1, 0.5])));
    assert.equal(b.toString('latin1', 0, 4), 'RIFF');
    assert.equal(b.toString('latin1', 8, 16), 'WAVEfmt ');
    assert.equal(b.readUInt16LE(22), 1);
    assert.equal(b.readUInt32LE(24), 44100);
    assert.equal(b.readUInt16LE(34), 16);
    assert.equal(b.toString('latin1', 36, 40), 'data');
    assert.equal(b.readUInt32LE(40), 8);
    assert.deepEqual([0, 1, 2, 3].map((i) => b.readInt16LE(44 + 2 * i)), [0, 32767, -32767, 16384]);
});
