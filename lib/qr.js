'use strict';
// A QR code for the station's pairing url (docs/90-agent/plans/2026-10-21-station-remote-design.md
// §3): byte mode, error-correction level L, versions 1-5 — one Reed-Solomon
// block each at L, so nothing is interleaved — after Project Nayuki's QR Code
// generator (MIT), cut to what a url of at most 106 bytes needs. The matrix is
// `[y][x]`, true for a dark module.

// [total codewords, EC codewords] per version at level L; each version's
// alignment centre (version 1 has none; at 2-5 only the one at (c, c) is clear
// of the finders).
const BLOCKS = [null, [26, 7], [44, 10], [70, 15], [100, 20], [134, 26]];
const ALIGN = [null, 0, 18, 22, 26, 30];
const LEVEL_L = 1;

function gfMul(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
        z = (z << 1) ^ ((z >>> 7) * 0x11d);
        z ^= ((y >>> i) & 1) * x;
    }
    return z;
}

// The generator polynomial's coefficients, highest first, the leading 1 left
// off: the product of (x - 2^i) for i below `degree`.
function divisor(degree) {
    const out = new Array(degree).fill(0);
    out[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i++) {
        for (let j = 0; j < degree; j++) {
            out[j] = gfMul(out[j], root);
            if (j + 1 < degree) out[j] ^= out[j + 1];
        }
        root = gfMul(root, 0x02);
    }
    return out;
}

function remainder(data, div) {
    const out = div.map(() => 0);
    for (const b of data) {
        const factor = b ^ out.shift();
        out.push(0);
        div.forEach((coef, i) => { out[i] ^= gfMul(coef, factor); });
    }
    return out;
}

// Mode 0100, an 8-bit length, the bytes, a terminator, the 0xEC/0x11 pad,
// then the EC codewords.
function codewords(bytes, version) {
    const [total, ec] = BLOCKS[version];
    const cap = (total - ec) * 8;
    const bits = [];
    const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    put(0b0100, 4);
    put(bytes.length, 8);
    for (const b of bytes) put(b, 8);
    put(0, Math.min(4, cap - bits.length));
    put(0, (8 - (bits.length % 8)) % 8);
    for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) put(pad, 8);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
    return data.concat(remainder(data, divisor(ec)));
}

const MASKS = [
    (x, y) => (x + y) % 2 === 0,
    (x, y) => y % 2 === 0,
    (x) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

// Both copies of the 15 format bits — level L and the mask, BCH-coded and
// xored with 0x5412 — and the dark module. `set(x, y, on)`.
function format(set, size, mask) {
    const data = (LEVEL_L << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const bit = (i) => ((bits >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6));
    set(8, 8, bit(7));
    set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);
}

// The codewords' bits in the standard's zigzag, two columns at a time from
// the right, skipping the timing column; the remainder bits stay light.
function place(dark, fixed, size, data) {
    let i = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
        if (right === 6) right = 5;
        for (let vert = 0; vert < size; vert++) {
            for (let j = 0; j < 2; j++) {
                const x = right - j;
                const y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
                if (!fixed[y][x] && i < data.length * 8) {
                    dark[y][x] = ((data[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
                    i++;
                }
            }
        }
    }
}

function applyMask(dark, fixed, size, m) {
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) if (!fixed[y][x] && MASKS[m](x, y)) dark[y][x] = !dark[y][x];
    }
}

// The standard's four penalties: runs of five or more, 2x2 blocks, finder-like
// 1:1:3:1:1 runs with four light modules beside them, and the dark share.
function penalty(dark, size) {
    let score = 0;
    const lines = [];
    for (let i = 0; i < size; i++) {
        lines.push(dark[i].map(Number).join(''));
        lines.push(dark.map((row) => Number(row[i])).join(''));
    }
    for (const line of lines) {
        for (const run of line.match(/0{5,}|1{5,}/g) || []) score += run.length - 2;
        const padded = '0000' + line + '0000';
        for (const pat of ['10111010000', '00001011101']) {
            for (let at = padded.indexOf(pat); at >= 0; at = padded.indexOf(pat, at + 1)) score += 40;
        }
    }
    let blacks = 0;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if (dark[y][x]) blacks++;
            if (x < size - 1 && y < size - 1 && dark[y][x] === dark[y][x + 1] && dark[y][x] === dark[y + 1][x] && dark[y][x] === dark[y + 1][x + 1]) score += 3;
        }
    }
    const total = size * size;
    score += (Math.ceil(Math.abs(blacks * 20 - total * 10) / total) - 1) * 10;
    return score;
}

function qrMatrix(text) {
    const bytes = Buffer.from(String(text), 'utf8');
    let version = 1;
    while (version <= 5 && 12 + 8 * bytes.length > (BLOCKS[version][0] - BLOCKS[version][1]) * 8) version++;
    if (version > 5) return null;
    const size = 17 + 4 * version;
    const dark = Array.from({ length: size }, () => new Array(size).fill(false));
    const fixed = Array.from({ length: size }, () => new Array(size).fill(false));
    const set = (x, y, on) => { dark[y][x] = on; fixed[y][x] = true; };
    for (let i = 0; i < size; i++) {
        set(6, i, i % 2 === 0);
        set(i, 6, i % 2 === 0);
    }
    for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
        for (let dy = -4; dy <= 4; dy++) {
            for (let dx = -4; dx <= 4; dx++) {
                const x = cx + dx;
                const y = cy + dy;
                const d = Math.max(Math.abs(dx), Math.abs(dy));
                if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
            }
        }
    }
    const c = ALIGN[version];
    if (c) {
        for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) set(c + dx, c + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
    }
    format(set, size, 0);
    place(dark, fixed, size, codewords(bytes, version));
    let best = 0;
    let least = Infinity;
    for (let m = 0; m < 8; m++) {
        applyMask(dark, fixed, size, m);
        format(set, size, m);
        const p = penalty(dark, size);
        if (p < least) { least = p; best = m; }
        applyMask(dark, fixed, size, m);
    }
    applyMask(dark, fixed, size, best);
    format(set, size, best);
    return dark;
}

function qrSvg(text) {
    const m = qrMatrix(text);
    if (!m) return null;
    const n = m.length + 8;
    let d = '';
    m.forEach((row, y) => row.forEach((on, x) => { if (on) d += 'M' + (x + 4) + ' ' + (y + 4) + 'h1v1h-1z'; }));
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n + ' ' + n + '" shape-rendering="crispEdges">'
        + '<rect width="' + n + '" height="' + n + '" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
}

module.exports = { qrMatrix, qrSvg };
