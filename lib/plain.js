'use strict';

// The two checks of docs/90-agent/reference/plain-language.md, the rules for
// Chinese a person reads: a sentence wider than MAX_SENTENCE_WIDTH columns,
// and a bare code — a commit or session hex with no word saying which, `Task
// N`, or a TODO id — standing where a name should be. `proseProblem` is the
// gate's half (lib/handoff.js `ruleProblem`), `proseFindings` docs-check's.
// Pure but for `todoIds`, which reads the TODO folder.

const { width } = require('./handoff.js');

const MAX_SENTENCE_WIDTH = 160;
const DONE_HEADING = '## 完成紀錄';
const SPLIT = /[。！？；|]|[.!?;](?=\s|$)/;
const HEX = /[0-9a-f]{7,40}/g;
const TASK = /\b[Tt]ask\s+\d+\b/g;
const NAMED = /(session|commit)\s*$/i;

// A code span is a reference, not prose, and a link's target is not read.
function prose(line) {
    return String(line || '').replace(/`[^`]*`/g, ' ').replace(/\]\([^)]*\)/g, ']');
}

function longSentences(text, max) {
    const cap = Number.isFinite(max) ? max : MAX_SENTENCE_WIDTH;
    const out = [];
    String(text || '').split(/\r?\n/).forEach((line, i) => {
        for (const s of prose(line).split(SPLIT)) {
            const w = width(s.trim());
            if (w > cap) out.push({ line: i + 1, width: w, text: s.trim() });
        }
    });
    return out;
}

function bareCodes(text, ids) {
    const out = [];
    const known = (Array.isArray(ids) ? ids : []).filter((id) => /^[a-z0-9]+(?:-[a-z0-9]+)*-\d+$/.test(id));
    String(text || '').split(/\r?\n/).forEach((line, i) => {
        const p = prose(line);
        for (const m of p.matchAll(HEX)) {
            const before = p.slice(0, m.index);
            const after = p.slice(m.index + m[0].length);
            if (/[0-9A-Za-z_]$/.test(before) || /^[0-9A-Za-z_]/.test(after)) continue;
            if (!/\d/.test(m[0]) || !/[a-f]/.test(m[0]) || NAMED.test(before)) continue;
            out.push({ line: i + 1, code: m[0] });
        }
        for (const m of p.matchAll(TASK)) out.push({ line: i + 1, code: m[0] });
        for (const id of known) {
            if (new RegExp('(^|[^a-z0-9-])' + id + '(?![a-z0-9-])').test(p)) out.push({ line: i + 1, code: id });
        }
    });
    return out;
}

function proseProblem(gate, ids) {
    const fields = [];
    (gate && Array.isArray(gate.questions) ? gate.questions : []).forEach((q, i) => {
        fields.push(['questions[' + i + '].question', q && q.question]);
        (q && Array.isArray(q.options) ? q.options : []).forEach((o, j) => {
            fields.push(['questions[' + i + '].options[' + j + '].label', o && o.label]);
            fields.push(['questions[' + i + '].options[' + j + '].description', o && o.description]);
        });
    });
    fields.push(['next', gate && gate.next]);
    for (const [at, text] of fields) {
        const long = longSentences(text)[0];
        if (long) {
            return { at, detail: 'a sentence is ' + long.width + ' columns wide, ' + MAX_SENTENCE_WIDTH + ' at most (a CJK character counts two): split it — "' + long.text.slice(0, 40) + '"' };
        }
        const bare = bareCodes(text, ids)[0];
        if (bare) {
            return { at, detail: '"' + bare.code + '" stands where its name should be: say what it is — the TODO entry\'s title, the task\'s name, or session/commit before a hex id' };
        }
    }
    return null;
}

// A human-audience reference page whole, and a todo entry from its record
// heading down; frontmatter and fenced blocks are blanked, keeping line numbers.
function proseFindings(rel, text, role, audience) {
    if (typeof text !== 'string') return [];
    const human = role === 'reference' && audience === 'human';
    if (!human && role !== 'todo') return [];
    const lines = text.split(/\r?\n/);
    let front = lines[0] === '---';
    let fence = false;
    let open = human;
    const kept = lines.map((l, i) => {
        if (front) {
            if (i > 0 && l === '---') front = false;
            return '';
        }
        if (!open) {
            if (l.trim() === DONE_HEADING) open = true;
            return '';
        }
        if (/^\s*(```|~~~)/.test(l)) {
            fence = !fence;
            return '';
        }
        return fence ? '' : l;
    });
    if (!open) return [];
    const body = kept.join('\n');
    return longSentences(body).map((s) => ({
        file: rel, line: s.line, tag: 'long-sentence',
        what: 'a sentence ' + s.width + ' columns wide, ' + MAX_SENTENCE_WIDTH + ' at most: split it',
    })).concat(bareCodes(body, []).map((b) => ({
        file: rel, line: b.line, tag: 'bare-code',
        what: '"' + b.code + '" stands where its name should be',
    })));
}

// The TODO ids a gate checks for, and why there are none when reading the
// entries failed: a gate that silently stopped catching bare ids read the
// same as one with nothing to catch (plain-1). A project with no TODO at all
// is no ids and no warning.
function todoIds(root) {
    try {
        const loaded = require('./todo.js').load(root);
        return { ids: loaded && Array.isArray(loaded.all) ? loaded.all.map((e) => e.id).filter(Boolean) : [], warning: null };
    } catch (e) {
        return { ids: [], warning: 'the TODO entries could not be read (' + (e && e.message ? e.message : String(e)) + '), so a bare TODO id is not checked' };
    }
}

module.exports = { MAX_SENTENCE_WIDTH, DONE_HEADING, longSentences, bareCodes, proseProblem, proseFindings, todoIds };
