'use strict';

// Two sessions collide when the files they have touched are the same files, not
// when they happened to describe the work with the same words. One person writes
// "colour ramp" and the other writes "fix 7d"; an identity check on the name sees
// two unrelated tasks, while the file is what actually gets overwritten.
//
// Nothing here assumes a claim is a plain path. Claims are observed paths now, but
// a record written before that carried hand-written patterns and still reads
// through the same function, and neither side knows which of the two entries is
// the pattern — so both directions are tried, and `src/**` and `src/a.ts` overlap
// whichever way round they arrive.

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

// Two entries meet when they are the same path, or when one is a directory the
// other sits under. That is the whole rule.
//
// It used to be more. Glob matching lived here for records written before
// 2026-08-24, when a claim was a pattern somebody declared rather than a path
// somebody edited — `**` spanning separators, `*` and `?` stopping at one, every
// other character escaped. Nothing produces a pattern any more: `hooks/touch.js`
// passes what `relPath` made of a tool payload, `lib/dirty.js` passes what git
// porcelain reported, and `scripts/task.js` deletes the old `scope` field on its
// first write to any record that still has one.
//
// Removed rather than kept for the records it served, because it had stopped
// being free. POSIX allows a star in a filename, so one real file called `a*.ts`
// was read as a wildcard and collided with every `.ts` beside it — a warning
// between two sessions that share nothing, which is the one thing a collision
// warning must never be.
function entriesOverlap(a, b) {
    const A = norm(a);
    const B = norm(b);
    if (!A || !B) return false;
    if (A === B) return true;
    if (B.startsWith(A + '/')) return true;
    if (A.startsWith(B + '/')) return true;
    return false;
}

// The owner's entries that any of the other session's entries reach, in the order
// the owner touched them, each reported once however many patterns hit it. The
// result is read out to a person, so it names their own paths rather than the
// patterns that matched them.
function overlapPaths(mineClaims, theirClaims) {
    if (!Array.isArray(mineClaims) || !Array.isArray(theirClaims)) return [];
    const out = [];
    for (const mine of mineClaims) {
        const m = norm(mine);
        if (!m || out.includes(m)) continue;
        if (theirClaims.some((theirs) => entriesOverlap(m, theirs))) out.push(m);
    }
    return out;
}

module.exports = { entriesOverlap, overlapPaths };
