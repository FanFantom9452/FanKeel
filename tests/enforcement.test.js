'use strict';

// docs/90-agent/reference/enforcement.md: one row per rule lib/stages.js
// injects, keyed so this file can compute the key. A rule added, removed or
// reordered without its row fails here, and so does a row naming an enforcer
// that is no longer on disk.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ALWAYS, ALWAYS_WHEN, STAGES } = require('../lib/stages.js');

const ROOT = path.join(__dirname, '..');
const PAGE = path.join(ROOT, 'docs', '90-agent', 'reference', 'enforcement.md');
const KEY = /^[a-z]+\.(\d+|when\.\S+)$/;
const PATHS = /^`[^`]+`(, `[^`]+`)*$/;

// The rule's first five words, with what markdown would read as markup taken out.
const opens = (text) => String(text).replace(/[`*|]/g, '').split(/\s+/).filter(Boolean).slice(0, 5).join(' ');

function expected() {
    const out = [];
    ALWAYS.forEach((t, i) => out.push(['always.' + i, opens(t)]));
    for (const w of ALWAYS_WHEN) out.push(['always.when.' + w.when, opens(w.text)]);
    for (const s of STAGES) {
        s.rules.forEach((t, i) => out.push([s.name + '.' + i, opens(t)]));
        for (const w of s.when || []) out.push([s.name + '.when.' + w.when, opens(w.text)]);
    }
    return out;
}

function rows() {
    const out = new Map();
    for (const line of fs.readFileSync(PAGE, 'utf8').split(/\r?\n/)) {
        if (!line.startsWith('| ')) continue;
        const cells = line.split('|').slice(1, -1).map((c) => c.trim());
        if (KEY.test(cells[0])) out.set(cells[0], cells);
    }
    return out;
}

test('every injected rule has a row, keyed and opening as lib/stages.js has it', () => {
    const have = rows();
    for (const [key, words] of expected()) {
        const row = have.get(key);
        assert.ok(row, key + ' has no row in enforcement.md');
        assert.equal(row[1], words, key + ': the row opens with another rule — reordered, rewritten or moved');
    }
});

test('no row names a rule lib/stages.js no longer has', () => {
    const keys = new Set(expected().map(([key]) => key));
    for (const key of rows().keys()) assert.ok(keys.has(key), key + ' is not a rule any more');
});

test('every row names its enforcer and its check, or says none, and every path it names exists', () => {
    for (const [key, cells] of rows()) {
        assert.equal(cells.length, 5, key + ' has ' + cells.length + ' cells, 5 expected');
        const [, , enforced, checked] = cells;
        assert.ok(enforced === 'none — prose only' || PATHS.test(enforced), key + ' enforced by: ' + enforced);
        assert.ok(checked === 'none' || PATHS.test(checked), key + ' checked by: ' + checked);
        for (const cell of [enforced, checked]) {
            for (const m of cell.matchAll(/`([^`]+)`/g)) {
                assert.ok(fs.existsSync(path.join(ROOT, m[1])), key + ' names ' + m[1] + ', which is not on disk');
            }
        }
    }
});
