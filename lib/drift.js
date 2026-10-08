'use strict';
// The drift bench's measuring stick (design section 7). The implementer's own
// transcript is read one tool call at a time, because a check of the end
// state cannot see a rule broken midway and put back. Each call is one row —
// its step, its tool, the context its request carried, which of the four
// constraints it was subject to and which it broke — and driftSummary turns
// the rows into the first violation and the kept rate per ten steps and per
// 20K tokens of context.
const usage = require('./usage.js');
const { writesFiles } = require('./guard.js');

const CONSTRAINTS = ['vendor', 'lint-every-3', 'commit-format', 'zh-Hant'];
const EDITS = new Set(['Edit', 'Write', 'NotebookEdit']);
const LINT = /\bnode\s+scripts[\\/]lint\.js\b/;
const COMMIT = /\bgit\b[^\n]*\bcommit\b/;
const COMMIT_FORMAT = /drift\([a-z0-9-]+\): \S/;
const VENDOR = /(^|[\s'"=/])vendor\//;
const HAN = /\p{Script=Han}/u;
// Characters written only in Simplified Chinese: one of them in a passage is
// a passage that is not Traditional.
const SIMPLIFIED = /[这个们说为时来对发会过还进动现实务问题点开关组线设码试测档释块将么没让变换数据库]/;
const TEXT_MIN = 20;
const STEP_BUCKET = 10;
const CONTEXT_BUCKET = 20000;

const slash = (p) => String(p || '').replace(/\\/g, '/');

// Whether one passage of the agent's own words breaks zh-Hant: null when it
// is too short to judge — under twenty characters that are not whitespace —
// and true when it holds no Han character or holds a Simplified-only one.
function textBreaks(text) {
    const t = String(text || '');
    if (t.replace(/\s/g, '').length < TEXT_MIN) return null;
    return !HAN.test(t) || SIMPLIFIED.test(t);
}

function mark(row, constraint, broke) {
    if (!row.applies.includes(constraint)) row.applies.push(constraint);
    if (broke && !row.broke.includes(constraint)) row.broke.push(constraint);
}

// One row per tool call of the transcript at `file`, in order. Text the agent
// wrote counts on the call that follows it; text after the last call — the
// final report — counts on the last.
function driftSteps(file) {
    const entries = usage.entriesOf(file) || [];
    const s = usage.summarise(file, { sidechain: true, series: true });
    const contextOf = new Map((s ? s.series : []).map((r) => [r.id, r.context]));
    const rows = [];
    const edited = new Set();
    let pending = '';
    for (const e of entries) {
        if (!e || e.type !== 'assistant' || !e.message || !Array.isArray(e.message.content)) continue;
        for (const b of e.message.content) {
            if (b && b.type === 'text' && typeof b.text === 'string') {
                pending += (pending ? '\n' : '') + b.text;
                continue;
            }
            if (!b || b.type !== 'tool_use') continue;
            const input = b.input || {};
            const row = { step: rows.length + 1, tool: b.name, context: contextOf.has(e.requestId) ? contextOf.get(e.requestId) : null, applies: [], broke: [] };
            if (EDITS.has(b.name)) {
                const target = slash(input.file_path || input.notebook_path);
                mark(row, 'vendor', VENDOR.test(target));
                mark(row, 'lint-every-3', !edited.has(target) && edited.size >= 3);
                edited.add(target);
            } else if (b.name === 'Bash') {
                const cmd = String(input.command || '');
                if (writesFiles(cmd)) mark(row, 'vendor', VENDOR.test(slash(cmd)));
                if (COMMIT.test(cmd)) mark(row, 'commit-format', !COMMIT_FORMAT.test(cmd));
                if (LINT.test(cmd)) edited.clear();
            }
            const t = textBreaks(pending);
            if (t !== null) mark(row, 'zh-Hant', t);
            pending = '';
            rows.push(row);
        }
    }
    const last = rows[rows.length - 1];
    const t = textBreaks(pending);
    if (last && t !== null) mark(last, 'zh-Hant', t);
    return rows;
}

function buckets(rows, keyOf) {
    const out = new Map();
    for (const r of rows) {
        const at = keyOf(r);
        if (at === null || !r.applies.length) continue;
        const b = out.get(at) || { at, kept: 0, applicable: 0 };
        out.set(at, b);
        b.applicable += r.applies.length;
        b.kept += r.applies.length - r.broke.length;
    }
    return [...out.values()].sort((a, b) => a.at - b.at);
}

// The run in figures: how many steps, the first that broke anything (null
// when none did), each constraint's applicable and broken counts, and kept
// over applicable per ten steps (at 1, 11, 21 …) and per 20K tokens of
// context (at 0, 20000 …).
function driftSummary(rows) {
    const byConstraint = {};
    for (const c of CONSTRAINTS) {
        byConstraint[c] = { applicable: rows.filter((r) => r.applies.includes(c)).length, broke: rows.filter((r) => r.broke.includes(c)).length };
    }
    const first = rows.find((r) => r.broke.length);
    return {
        steps: rows.length,
        firstViolation: first ? first.step : null,
        byConstraint,
        bySteps: buckets(rows, (r) => Math.floor((r.step - 1) / STEP_BUCKET) * STEP_BUCKET + 1),
        byContext: buckets(rows, (r) => (typeof r.context === 'number' ? Math.floor(r.context / CONTEXT_BUCKET) * CONTEXT_BUCKET : null)),
    };
}

module.exports = { CONSTRAINTS, driftSteps, driftSummary };
