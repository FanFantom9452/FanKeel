'use strict';

// Two sessions collide when their declared scopes touch the same files, not when
// they happened to describe the work with the same words. One person writes
// "colour ramp" and the other writes "fix 7d"; an identity check on the name sees
// two unrelated tasks, while the file is what actually gets overwritten.
//
// Neither side knows which of the two entries is the pattern, so both directions
// are tried. `src/**` and `src/a.ts` overlap whichever of them was declared first.

// Separators are normalised because one session may be on Windows and the other
// reading the same repository through a posix shell, and `./a.ts` is nobody's
// idea of a different file from `a.ts`.
function norm(entry) {
    if (typeof entry !== 'string') return '';
    return entry.trim()
        .replace(/\\/g, '/')
        .replace(/^\.\//, '')
        .replace(/\/+$/, '');
}

const hasGlob = (p) => /[*?]/.test(p);

// `**` spans separators, `*` and `?` stop at one. Everything else is literal,
// which matters most for `.` — without escaping it, `a.ts` would match `a-ts` and
// the warning would fire on unrelated files.
function globToRegExp(pattern) {
    const p = norm(pattern);
    let out = '';
    for (let i = 0; i < p.length; i++) {
        const c = p[i];
        if (c === '*') {
            if (p[i + 1] === '*') {
                out += '.*';
                i++;
                if (p[i + 1] === '/') i++;
            } else {
                out += '[^/]*';
            }
        } else if (c === '?') {
            out += '[^/]';
        } else {
            out += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
        }
    }
    return new RegExp('^' + out + '$');
}

function entriesOverlap(a, b) {
    const A = norm(a);
    const B = norm(b);
    if (!A || !B) return false;
    if (A === B) return true;
    if (globToRegExp(A).test(B)) return true;
    if (globToRegExp(B).test(A)) return true;
    // A bare directory name covers what is under it. Applied only from the side
    // with no wildcards: reading it off a pattern would make `src/*.ts` swallow
    // `src/sub/a.ts`, which is the one thing a single star is supposed to refuse.
    if (!hasGlob(A) && B.startsWith(A + '/')) return true;
    if (!hasGlob(B) && A.startsWith(B + '/')) return true;
    return false;
}

// The owner's entries that any of the other session's entries reach, in the order
// the owner declared them, each reported once however many patterns hit it. The
// result is read out to a person, so it names their own paths rather than the
// patterns that matched them.
function overlapPaths(mineScope, theirScope) {
    if (!Array.isArray(mineScope) || !Array.isArray(theirScope)) return [];
    const out = [];
    for (const mine of mineScope) {
        const m = norm(mine);
        if (!m || out.includes(m)) continue;
        if (theirScope.some((theirs) => entriesOverlap(m, theirs))) out.push(m);
    }
    return out;
}

module.exports = { globToRegExp, entriesOverlap, overlapPaths };
