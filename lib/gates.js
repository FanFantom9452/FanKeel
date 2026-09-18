'use strict';
// The gates a session put to the person, as `hooks/leave.js` writes them at
// SessionEnd: one row per question inside every `AskUserQuestion` call the
// main transcript carries, with the stage that was open when it was asked,
// every option label offered and what was picked. `lib/replay.js` also has
// `labels`, but it recomputes them from the transcript every time it reads
// one — gone once the transcript is. Stored here, they outlive it.
//
// `lib/detail.js`'s own `stageWhen` answers the same question — the last
// step whose own timestamp is not later than the moment asked, null before
// the first — but it walks a `seq` built from commands, moves and the clock
// together, and it is not exported. A SessionEnd hook has none of those
// merged views, only the entry's own `moves`, so the same rule is repeated
// here over that alone.

const MAX_GATES = 60;
const PICK_LEN = 120;

function stageWhen(moves, at) {
    let stage = null;
    for (const m of Array.isArray(moves) ? moves : []) {
        if (Array.isArray(m) && typeof m[0] === 'string' && Number.isFinite(m[1]) && m[1] <= at) stage = m[0];
    }
    return stage;
}

const clip = (s, max) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max);

// Every `{ at, stage, header, labels, picked }` a main-transcript `AskUserQuestion`
// and its answer make, oldest first, capped at `MAX_GATES`. `answerOf` is
// `lib/replay.js`'s own: a multi-select answer arrives as an array there and
// is joined with `, `, and Other's typed text arrives as the plain string it
// was typed as — both are exactly `picked`, clipped rather than reinterpreted.
function gatesFrom(entries, moves, answerOf) {
    const asks = new Map();
    const out = [];
    for (const e of Array.isArray(entries) ? entries : []) {
        if (!e || e.isSidechain === true || !e.message || typeof e.message !== 'object') continue;
        const at = Date.parse(e.timestamp);
        if (e.type === 'assistant') {
            for (const b of Array.isArray(e.message.content) ? e.message.content : []) {
                if (b && b.type === 'tool_use' && b.name === 'AskUserQuestion') {
                    const input = b.input && typeof b.input === 'object' ? b.input : {};
                    asks.set(b.id, { at, questions: Array.isArray(input.questions) ? input.questions : [] });
                }
            }
            continue;
        }
        if (e.type !== 'user') continue;
        for (const b of Array.isArray(e.message.content) ? e.message.content : []) {
            if (!b || b.type !== 'tool_result' || !asks.has(b.tool_use_id)) continue;
            const ask = asks.get(b.tool_use_id);
            asks.delete(b.tool_use_id);
            const answers = e.toolUseResult && e.toolUseResult.answers && typeof e.toolUseResult.answers === 'object'
                ? e.toolUseResult.answers : {};
            for (const q of ask.questions) {
                if (!q || typeof q !== 'object') continue;
                out.push({
                    at: ask.at,
                    stage: stageWhen(moves, ask.at),
                    header: typeof q.header === 'string' ? q.header : '',
                    labels: (Array.isArray(q.options) ? q.options : [])
                        .map((o) => clip(o && o.label, PICK_LEN)),
                    picked: clip(answerOf(answers[q.question]), PICK_LEN),
                });
            }
        }
    }
    return out.slice(-MAX_GATES);
}

module.exports = { MAX_GATES, stageWhen, gatesFrom };
