'use strict';

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

module.exports = { common, rareChars, hasCjk };
