'use strict';
// lib/qr.js (docs/90-agent/plans/2026-10-21-station-remote-design.md §3): the
// pairing url as a QR. Read back here by a decoder that shares no code with
// the encoder — a camera is Task 15's check, this is the arithmetic.
const test = require('node:test');
const assert = require('node:assert/strict');
const qr = require('../lib/qr.js');

// GF(256) over x^8 + x^4 + x^3 + x^2 + 1, as tables.
const EXP = new Array(512);
const LOG = new Array(256);
(() => {
    let x = 1;
    for (let i = 0; i < 255; i++) {
        EXP[i] = x;
        LOG[x] = i;
        x <<= 1;
        if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

// size → [version, total codewords, EC codewords] at level L; alignment centre per version.
const SIZES = { 21: [1, 26, 7], 25: [2, 44, 10], 29: [3, 70, 15], 33: [4, 100, 20], 37: [5, 134, 26] };
const CENTRE = { 2: 18, 3: 22, 4: 26, 5: 30 };
// The standard's eight masks, i the row and j the column.
const MASK = [
    (i, j) => (i + j) % 2 === 0,
    (i) => i % 2 === 0,
    (i, j) => j % 3 === 0,
    (i, j) => (i + j) % 3 === 0,
    (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0,
    (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0,
    (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0,
    (i, j) => (((i + j) % 2) + ((i * j) % 3)) % 2 === 0,
];

// Function modules: the three finder corners with their separators and format
// areas (9x9 top left, 8 wide by 9 tall top right, 9 wide by 8 tall bottom
// left), the timing row and column, and the one 5x5 alignment pattern
// versions 2-5 carry.
function reserved(size, version) {
    const r = Array.from({ length: size }, () => new Array(size).fill(false));
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            if ((i < 9 && j < 9) || (i < 9 && j >= size - 8) || (i >= size - 8 && j < 9) || i === 6 || j === 6) r[i][j] = true;
        }
    }
    const c = CENTRE[version];
    if (c) for (let i = c - 2; i <= c + 2; i++) for (let j = c - 2; j <= c + 2; j++) r[i][j] = true;
    return r;
}

// Format information, bit k of the 15 at cell [row, column], from both copies.
function formatOf(m) {
    const size = m.length;
    const first = [[0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [7, 8], [8, 8], [8, 7], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0]];
    const second = [];
    for (let k = 0; k < 8; k++) second.push([8, size - 1 - k]);
    for (let k = 8; k < 15; k++) second.push([size - 15 + k, 8]);
    const read = (cells) => cells.reduce((v, [i, j], k) => v | ((m[i][j] ? 1 : 0) << k), 0);
    const a = read(first);
    const unmasked = a ^ 0x5412;
    const data = unmasked >>> 10;
    // BCH(15,5): the remainder of data * x^10 divided by x^10 + x^8 + x^5 + x^4 + x^2 + x + 1.
    let rem = data << 10;
    for (let bit = 14; bit >= 10; bit--) if (rem & (1 << bit)) rem ^= 0x537 << (bit - 10);
    return { level: data >>> 3, mask: data & 7, valid: (unmasked & 0x3ff) === rem, same: a === read(second), dark: m[size - 8][8] };
}

function decode(m) {
    const size = m.length;
    const [version, total, ec] = SIZES[size];
    const f = formatOf(m);
    assert.equal(f.valid, true, 'format bits fail their BCH check');
    assert.equal(f.same, true, 'the two format copies disagree');
    assert.equal(f.level, 1, 'level L');
    assert.equal(f.dark, true, 'the dark module');
    const fn = reserved(size, version);
    const bits = [];
    let upward = true;
    for (let right = size - 1; right >= 1; right -= 2) {
        if (right === 6) right = 5;
        for (let v = 0; v < size; v++) {
            const i = upward ? size - 1 - v : v;
            for (const j of [right, right - 1]) {
                if (fn[i][j]) continue;
                bits.push((m[i][j] !== MASK[f.mask](i, j)) ? 1 : 0);
            }
        }
        upward = !upward;
    }
    const words = [];
    for (let k = 0; k < total; k++) words.push(bits.slice(k * 8, k * 8 + 8).reduce((a, b) => (a << 1) | b, 0));
    for (let r = 0; r < ec; r++) {
        let s = 0;
        for (const w of words) s = mul(s, EXP[r]) ^ w;
        assert.equal(s, 0, 'syndrome ' + r + ' is not zero');
    }
    const data = words.slice(0, total - ec).flatMap((w) => [7, 6, 5, 4, 3, 2, 1, 0].map((k) => (w >>> k) & 1));
    const take = (n) => data.splice(0, n).reduce((a, b) => (a << 1) | b, 0);
    assert.equal(take(4), 0b0100, 'byte mode');
    const len = take(8);
    const out = [];
    for (let k = 0; k < len; k++) out.push(take(8));
    return { version, mask: f.mask, bytes: Buffer.from(out) };
}

const URL = 'https://ymlab-pc.tail1234.ts.net/m#/pair/ABCD2345';

test('a short text is version 1, the pairing url version 3, 106 bytes version 5 — each read back whole', () => {
    const masks = new Set();
    for (const [text, version] of [['fk', 1], ['x'.repeat(17), 1], ['x'.repeat(18), 2], [URL, 3], ['y'.repeat(78), 4], ['z'.repeat(106), 5], ['配對 ok', 1], ['x'.repeat(32), 2], ['https://a.ts.net/m#/pair/2345ABCD', 3]]) {
        const m = qr.qrMatrix(text);
        assert.equal(m.length, 17 + 4 * version, text.slice(0, 12) + ' size');
        assert.ok(m.every((row) => row.length === m.length));
        const got = decode(m);
        masks.add(got.mask);
        assert.equal(got.version, version);
        assert.deepEqual(got.bytes, Buffer.from(text, 'utf8'), text.slice(0, 12) + ' reads back');
    }
    assert.ok(masks.size > 1, 'the penalty never picked anything but one mask');
});

test('the finder patterns and timing lines are where a camera looks for them', () => {
    const m = qr.qrMatrix(URL);
    const s = m.length;
    for (const [i0, j0] of [[0, 0], [0, s - 7], [s - 7, 0]]) {
        for (let i = 0; i < 7; i++) {
            for (let j = 0; j < 7; j++) {
                const ring = Math.max(Math.abs(i - 3), Math.abs(j - 3));
                assert.equal(m[i0 + i][j0 + j], ring !== 2, 'finder at ' + i0 + ',' + j0);
            }
        }
    }
    for (let k = 8; k < s - 8; k++) {
        assert.equal(m[6][k], k % 2 === 0, 'timing row');
        assert.equal(m[k][6], k % 2 === 0, 'timing column');
    }
});

test('more than 106 bytes is no QR, and the SVG has a quiet zone of four', () => {
    assert.equal(qr.qrMatrix('z'.repeat(107)), null);
    assert.equal(qr.qrSvg('z'.repeat(107)), null);
    const m = qr.qrMatrix(URL);
    const svg = qr.qrSvg(URL);
    const n = m.length + 8;
    assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n + ' ' + n + '"'));
    assert.ok(svg.includes('<rect width="' + n + '" height="' + n + '" fill="#fff"/>'));
    const dark = m.flat().filter(Boolean).length;
    assert.equal((svg.match(/h1v1h-1z/g) || []).length, dark);
    const cells = [...svg.matchAll(/M(\d+) (\d+)h1v1h-1z/g)].map((x) => [Number(x[1]), Number(x[2])]);
    assert.ok(cells.every(([x, y]) => x >= 4 && y >= 4 && x < n - 4 && y < n - 4), 'nothing drawn inside the quiet zone');
});
