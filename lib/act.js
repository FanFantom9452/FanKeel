'use strict';
// scripts/render.js `--act <file>` (entry-4): the steps a page is driven
// through before it is shot — click, drag, type, wait, shot — read from a
// JSON array and checked here, so a bad file is refused before a browser is
// looked for. One key names each step's kind; the error names the step.
const KINDS = ['click', 'drag', 'type', 'wait', 'shot'];
const SHOT = /^[0-9A-Za-z._-]+$/;
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

function parseSteps(text) {
    let list;
    try {
        list = JSON.parse(String(text));
    } catch (e) {
        throw new Error('is not JSON: ' + e.message);
    }
    if (!Array.isArray(list) || !list.length) throw new Error('is a non-empty JSON array of steps');
    return list.map((s, i) => {
        const at = 'step ' + (i + 1) + ': ';
        if (!s || typeof s !== 'object' || Array.isArray(s)) throw new Error(at + 'is not an object');
        const kind = KINDS.find((k) => has(s, k));
        if (!kind) throw new Error(at + 'names none of ' + KINDS.join(', '));
        const v = s[kind];
        if (kind === 'wait') {
            if (!Number.isInteger(v) || v < 0 || v > 30000) throw new Error(at + 'wait is 0 to 30000 milliseconds');
            return { kind, ms: v };
        }
        if (kind === 'shot') {
            if (typeof v !== 'string' || !SHOT.test(v) || v === 'render') throw new Error(at + 'shot is a file name of letters, digits, . _ -, not render');
            return { kind, name: v };
        }
        if (typeof v !== 'string' || !v.trim()) throw new Error(at + kind + ' is a CSS selector');
        if (kind === 'drag') {
            if (!Array.isArray(s.by) || s.by.length !== 2 || !s.by.every(Number.isFinite)) throw new Error(at + 'drag needs by: [dx, dy] in pixels');
            return { kind, sel: v, dx: s.by[0], dy: s.by[1] };
        }
        if (kind === 'type') {
            if (typeof s.text !== 'string') throw new Error(at + 'type needs text');
            return { kind, sel: v, text: s.text };
        }
        return { kind, sel: v };
    });
}

module.exports = { parseSteps };
