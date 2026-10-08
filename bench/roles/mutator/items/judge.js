#!/usr/bin/env node
'use strict';
// The mutator items' shared judge:
//
//   node judge.js <item dir> <project> <target> <kill|survive|refuse>
//
// The target must be back, byte for byte, as the item's src/ holds it, and
// the worktree clean. The reply, <project>/.bench/result.txt, gives the fail
// count of a run under `before:` and of a run under `after:` (or the agent
// file's `mutated:`). kill: the specs see the mutant, so after shows a
// failure; survive: they cannot, so after shows none; refuse: the line does
// not hold the text, so no second run may be reported at all. The last line
// printed is `pass` or `fail <class>: <why>`.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// The first fail count under each heading, null where there is none.
function counts(text) {
    const out = { before: null, after: null };
    let at = null;
    for (const line of String(text).split(/\r?\n/)) {
        const h = /^\s*(before|after|mutated|restored)\s*:(.*)$/i.exec(line);
        if (h) {
            const name = h[1].toLowerCase();
            at = name === 'before' ? 'before' : name === 'restored' ? null : 'after';
        }
        const m = /\bfail\D{0,3}(\d+)/i.exec(h ? h[2] : line);
        if (at && m && out[at] === null) out[at] = Number(m[1]);
    }
    return out;
}

function judge(itemDir, proj, target, want) {
    const file = path.join(proj, target);
    const now = fs.existsSync(file) ? fs.readFileSync(file) : null;
    if (!now || !now.equals(fs.readFileSync(path.join(itemDir, 'src', target)))) return 'fail unrestored: ' + target + ' was not restored';
    const dirty = String(spawnSync('git', ['status', '--porcelain'], { cwd: proj, encoding: 'utf8' }).stdout || '').trim();
    if (dirty) return 'fail extra: the worktree is not clean — ' + dirty.split('\n')[0];
    const reply = path.join(proj, '.bench', 'result.txt');
    if (!fs.existsSync(reply)) return 'fail format: no .bench/result.txt';
    const c = counts(fs.readFileSync(reply, 'utf8'));
    if (want === 'refuse') return c.after === null ? 'pass' : 'fail extra: the line does not hold the text, and the mutation was run anyway';
    if (c.before === null) return 'fail format: no fail count under before:';
    if (c.after === null) return 'fail format: no fail count under after:';
    if (c.before !== 0) return 'fail wrong: the run before the mutation shows fail ' + c.before;
    if (want === 'kill' && c.after === 0) return 'fail wrong: the reply says the mutant survived, and the specs kill it';
    if (want === 'survive' && c.after !== 0) return 'fail wrong: the reply says the specs killed a mutant they cannot see';
    return 'pass';
}

const verdict = judge(...process.argv.slice(2));
console.log(verdict);
process.exit(verdict === 'pass' ? 0 : 1);
