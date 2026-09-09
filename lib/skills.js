'use strict';

// A fail-closed gate over this repository's own skill files: what script and
// flag each skill names, whether that script and flag actually exist, and
// whether every script the pipeline depends on is named by at least one
// skill. Pure functions only — `scripts/` is the thin shell that reads the
// filesystem and calls these; see `lib/docs.js` for the same split.

// 一行裡的 `scripts/<name>.js`。前面有 `<plugin>/` 的是完整形態，沒有的是裸引用——
// 它仍然是一次點名，所以算進 discovery，只是另外報一行形態。兩者不混為一談，因為
// 「形態錯」和「不存在」是兩種不同的事，而只有後者是缺陷。
const SCRIPT = /(<plugin>\/)?scripts\/([a-z0-9-]+\.js)/g;

// flag 只在與 script 同一行時才歸給那支 script。同行以外的歸屬要猜，而猜錯會產生
// 假失敗——一個會誤殺的閘門會被關掉，關掉的閘門比沒有更糟。
const FLAG = /--[a-z][a-z0-9-]+/g;

function references(text, file) {
    const scripts = [];
    const flags = [];
    text.split(/\r?\n/).forEach((line, i) => {
        const n = i + 1;
        const here = [];
        for (const m of line.matchAll(SCRIPT)) {
            here.push(m[2]);
            scripts.push({ name: m[2], file, line: n, bare: !m[1] });
        }
        for (const m of line.matchAll(FLAG)) {
            flags.push({ flag: m[0], file, line: n, script: here.length === 1 ? here[0] : null });
        }
    });
    return { scripts, flags };
}

// 三種形態，因為這棵樹上就是三種：字面比較（survey.js、station.js、todo-check.js、
// version.js）、parseArgs 的 options 表（九支）、STRING_FLAGS 物件（ledger.js、task.js）。
// 讀不到就當作沒宣告，而沒宣告的 script 不會產生 unknown-flag——閘門只在讀得到旗標表
// 的時候才敢說一個 flag 不被接受。
const LITERAL = /['"](--[a-z][a-z0-9-]+)['"]/g;
// Anchored on the character before the key rather than on line start: most of
// this tree's parseArgs option tables write every key on one line
// (`options: { root: { type: 'string' }, role: { type: 'string' } }`), and a
// `^\s*` anchor only ever matches the first key of a table written that way.
// `docs-check.js` is exactly this shape, and its `--role` is what this rule
// exists to find — a `^`-anchored version reads the whole file and comes back
// with nothing.
const OPTION = /[{,]\s*'?([a-z][a-z0-9-]+)'?\s*:\s*\{\s*type:\s*'(?:string|boolean)'/g;
const STRING_FLAGS = /const STRING_FLAGS = \{([\s\S]*?)\}/;

function acceptedFlags(source) {
    const out = new Set();
    for (const m of source.matchAll(LITERAL)) out.add(m[1]);
    for (const m of source.matchAll(OPTION)) out.add('--' + m[1]);
    const block = source.match(STRING_FLAGS);
    if (block) for (const m of block[1].matchAll(/([a-z][a-z0-9-]+)\s*:/g)) out.add('--' + m[1]);
    return out;
}

// 2026-09-09 被 skills/ 或 lib/stages.js 點名的 12 支。scripts/ 裡另外兩支
// （eval.js、tmp-clean.js）只在 README 出現，所以不在這裡——它們是 unnamed-script，
// 只報不失敗。一支從這張清單上掉下來，不是刪檔忘了改文件，就是一條規則失去了它的
// script；兩種都要有人看一眼，所以是 fail。
const REQUIRED_CORE = [
    'docs-audit.js', 'docs-check.js', 'layout.js', 'ledger.js', 'map.js', 'orient.js',
    'residue.js', 'station.js', 'survey.js', 'task.js', 'todo-check.js', 'version.js',
];

// 讀不到旗標表的 script 不產生 unknown-flag：`accepted` 沒有它那一格就跳過。閘門只在
// 讀得到的時候才敢說一個 flag 不被接受，因為誤殺一次就會被關掉。
function classify({ refs, present, accepted, core }) {
    const out = [];
    const named = new Set(refs.scripts.map((s) => s.name));

    // A scan that named zero scripts anywhere is not "nothing to report" — every
    // skill this repository ships names at least one script, so this is the
    // extractor itself having broken (a regex gone wrong, a directory that
    // failed to read) rather than a quiet tree. Silence here would let a gate
    // that stopped extracting anything keep reporting green forever, which is
    // the one failure mode fail-closed exists to rule out.
    if (refs.scripts.length === 0) {
        out.push({ tag: 'empty-scan', file: '-', line: 0, fail: true,
            what: 'no script reference was found anywhere in the scan' });
    }

    for (const s of refs.scripts) {
        if (!present.has(s.name)) {
            out.push({ tag: 'missing-script', file: s.file, line: s.line, fail: true,
                what: s.name + ' is named here and is not in scripts/' });
        } else if (s.bare) {
            out.push({ tag: 'bare-reference', file: s.file, line: s.line, fail: false,
                what: s.name + ' is named without the <plugin>/ prefix' });
        }
    }
    for (const f of refs.flags) {
        // An empty set is a table that could not be read, not one that accepts
        // nothing: `acceptedFlags` returns `{}` for a script that builds its
        // options from a name array rather than a literal, which `judge.js`
        // does. Without `.size` the paragraph above is not what the code does —
        // every flag on such a script reads as unknown, and the first skill to
        // name one on a single line fails a gate nothing is wrong with.
        const flags = f.script && accepted.get(f.script);
        if (flags && flags.size && !flags.has(f.flag)) {
            out.push({ tag: 'unknown-flag', file: f.file, line: f.line, fail: true,
                what: f.script + ' does not accept ' + f.flag });
        }
    }
    for (const name of core) {
        if (!named.has(name)) {
            out.push({ tag: 'core-dropped', file: '-', line: 0, fail: true,
                what: name + ' is required core and is named by no skill' });
        }
    }
    for (const name of present) {
        if (!named.has(name)) {
            out.push({ tag: 'unnamed-script', file: '-', line: 0, fail: false,
                what: name + ' is in scripts/ and named by no skill' });
        }
    }
    return out;
}

module.exports = { REQUIRED_CORE, references, acceptedFlags, classify };
