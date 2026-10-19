'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// escape-1: a character a model meant to write, told apart from one an escape
// slip landed on. A tool call whose Chinese was written as `\uXXXX` and got one
// hex digit wrong decodes to a different, valid character, the call succeeds,
// and the transcript keeps only the decoded text — so the character itself is
// the only trace. Inside CJK Unified Ideographs almost every neighbour of a
// common character is one nobody writes, so "rare" there means outside the
// three national level-one sets; outside it, the blocks a slip lands in and a
// sentence almost never uses. Hangul is not judged.

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

// Big5 level 1 (0xA440-0xC67E, 5,401 常用字), GB2312 level 1 (rows 0xB0-0xD7)
// and JIS X 0208 level 1 (EUC-JP rows 0xB0-0xCF), decoded from their byte
// ranges by the TextDecoder Node ships with full ICU, built once. A Node
// without those encodings gets an empty set, and `rare` then leaves the
// ideograph test off rather than calling every ideograph rare.
let COMMON = null;
function common() {
    if (COMMON) return COMMON;
    const set = new Set();
    const add = (encoding, rows, cells) => {
        const decoder = new TextDecoder(encoding);
        for (const hi of rows) {
            for (const lo of cells) {
                const ch = decoder.decode(Uint8Array.of(hi, lo));
                if (ch.length === 1 && ch !== '�') set.add(ch);
            }
        }
    };
    try {
        add('big5', range(0xA4, 0xC5), range(0x40, 0x7E).concat(range(0xA1, 0xFE)));
        add('big5', [0xC6], range(0x40, 0x7E));
        add('gbk', range(0xB0, 0xD7), range(0xA1, 0xFE));
        add('euc-jp', range(0xB0, 0xCF), range(0xA1, 0xFE));
    } catch (e) {
        set.clear();
    }
    COMMON = set;
    return set;
}

function rare(ch) {
    const p = ch.codePointAt(0);
    if (p === 0xFFFD) return true;                    // bytes that did not decode
    if (p >= 0x3100 && p <= 0x312F) return true;      // Bopomofo
    if (p >= 0x31A0 && p <= 0x31BF) return true;      // Bopomofo Extended
    if (p >= 0x3400 && p <= 0x4DBF) return true;      // CJK Extension A
    if (p >= 0xA000 && p <= 0xA4CF) return true;      // Yi
    if (p >= 0xE000 && p <= 0xF8FF) return true;      // private use
    if (p >= 0xF900 && p <= 0xFAFF) return true;      // CJK compatibility ideographs
    if (p >= 0x20000 && p <= 0x3FFFF) return true;    // CJK Extensions B onward
    if (p >= 0x4E00 && p <= 0x9FFF) {
        const set = common();
        return set.size > 0 && !set.has(ch);
    }
    return false;
}

function rareChars(text) {
    const out = [];
    for (const ch of String(text == null ? '' : text)) {
        if (rare(ch) && !out.includes(ch)) out.push(ch);
    }
    return out;
}

const CJK = /[㄀-ㄯㆠ-ㆿ㐀-䶿一-鿿豈-﫿]/;
const hasCjk = (text) => CJK.test(String(text == null ? '' : text));

const codeOf = (ch) => 'U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');

// escape-1 step 4: what hooks/gate.js says to an AskUserQuestion whose text
// carries a rare character. Refused once per exact text: a word meant that
// way — 閾值, 回饋, a name — goes out when asked again unchanged, so a false
// positive costs one retry. Refused texts are kept by hash in
// .fankeel/build/cjk-<session>.json, the latest SEEN_MAX. A state that cannot
// be written lets the question go rather than refuse it forever. Null: let it go.
const SEEN_MAX = 50;
function askSlip(root, sessionId, input) {
    if (typeof sessionId !== 'string' || !/^[\w-]+$/.test(sessionId)) return null;
    const text = JSON.stringify(input || {});
    const found = rareChars(text);
    if (!found.length) return null;
    const hash = crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
    const file = path.join(root, '.fankeel', 'build', 'cjk-' + sessionId + '.json');
    let seen = [];
    try {
        const got = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (got && Array.isArray(got.refused)) seen = got.refused;
    } catch (e) { /* nothing refused yet */ }
    if (seen.includes(hash)) return null;
    try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify({ refused: seen.concat([hash]).slice(-SEEN_MAX) }) + '\n');
    } catch (e) {
        return null;
    }
    return 'fankeel: this question carries ' + found.map((ch) => ch + ' (' + codeOf(ch) + ')').join(', ')
        + ' — characters an escape with one wrong hex digit lands on far more often than a writer means them.'
        + ' Write each word in the characters themselves and ask again; if the text is a stage agent\'s gate, SendMessage it to rewrite those words in its gate block first.'
        + ' If a character is meant, ask again unchanged and it goes out.';
}

module.exports = { common, rareChars, hasCjk, askSlip };
