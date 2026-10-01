#!/usr/bin/env node
'use strict';

// PreToolUse on AskUserQuestion. It marks the moment a gate opened, so the time
// the user spent at it can be told apart from the time the session spent
// working. `hooks/resume.js` is already the other end of the pair, because an
// answer arrives as a tool result rather than as a prompt.
//
// Stop was the obvious hook for this and is the wrong one. It fires when Claude
// finishes responding, and a session pausing on a tool call has not finished
// responding — this pipeline's gate is a tool call, so Stop never fires at one.
//
// Same two rules as guard.js: exit 0 on every path, and cost nothing for a
// session that is not in the mode. It writes a permission decision in two
// cases only: a stage agent's gate that AskUserQuestion would reject is
// denied, naming the field; and a question that looks like an attempted copy
// of that gate (headed with the stage's name) but does not match it word for
// word is denied too, pointing the controller back at the file. Otherwise
// `updatedInput` alone is not a decision — the probe behind this found that a
// PreToolUse hook returning only `updatedInput` still lets the user pick — and
// this file no longer writes one at all: on a controlled stage, the controller
// itself reads the handoff file's own gate and types the real AskUserQuestion
// call, word for word, so there is nothing left to substitute. This file's
// job is validation, not substitution.
//
// With `stage.agents` naming the task's own stage, a valid gate on disk is
// compared against what the controller actually asked (`gateMatches` in
// lib/handoff.js). A match reaching the user is the real gate, correctly
// typed: the in-flight mark clears and nothing more is written. A mismatch
// whose first question is headed with the stage's name is a candidate for a
// botched copy attempt — a paraphrase, a typo, a stale draft — but the header
// alone is not enough to convict it: every question the controller asks
// during a controlled stage carries that same header by convention, gate or
// not, so a genuinely different question sharing only the header would be
// denied by mistake. It is denied only when its content — the question text
// and its option labels — is also substantially similar to the gate's own
// first question; a header match with low content overlap is the
// controller's own question and goes out as written, with a message saying
// so when there is something worth saying; every other session gets none of
// this, and only the time is noted.
//
// With `gate.station` set to a number of seconds, every question this hook
// lets through first waits that long for the station's answer
// (`stationAnswers` below); one that arrives goes out already answered, and
// one that does not leaves the question to the terminal.

const fs = require('node:fs');
const crypto = require('node:crypto');
const registry = require('../lib/registry.js');
const profileLib = require('../lib/profile.js');
const { controlling, nextStage, normaliseRoute, FULL_ROUTE } = require('../lib/stages.js');
const { handoffPath, answerPath, pendingPath, answersSince, answeredOf, handedOffSince, writeAnswer, readGate, skipReason, gateMatches } = require('../lib/handoff.js');
const { run, parse } = require('../lib/hook.js');

// `stage.agents` as the profile holds it, for a sentence.
const agentsText = (values) => {
    const raw = values ? values['stage.agents'] : undefined;
    if (Array.isArray(raw)) return raw.length ? raw.join(',') : 'none';
    return raw === undefined ? 'unset' : String(raw);
};

// Normalized character-overlap ratio, for telling a botched copy of the gate
// (typo, paraphrase, stale draft — high overlap) from a different question
// that only happens to share the stage-name header (low overlap). Character
// overlap rather than word overlap because whitespace-splitting into words is
// unreliable for mixed Chinese/English text.
function charOverlap(a, b) {
    const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, '');
    a = norm(a); b = norm(b);
    const counts = new Map();
    for (const ch of a) counts.set(ch, (counts.get(ch) || 0) + 1);
    let shared = 0;
    for (const ch of b) {
        const n = counts.get(ch) || 0;
        if (n > 0) { shared++; counts.set(ch, n - 1); }
    }
    return shared / Math.max(a.length, b.length, 1);
}
// A paraphrase of the same gate question, keeping the same options, still
// overlaps heavily; a genuinely different question sharing only the header
// does not. Picked against tests/gate.test.js's own cases.
const ATTEMPT_THRESHOLD = 0.5;

// How close a question has to be to one already answered to count as asking
// it again. Higher than ATTEMPT_THRESHOLD: a re-ask is a copy of a settled
// question, while two gates written in one house style share most of their
// characters. Measured 2026-10-01 over the 278 gates in .fankeel/build: past
// 0.5, 65 first questions read as repeats of an earlier answer; with each
// gate's own opening question left out (`lead`) and 0.8, none did.
const REPEAT_THRESHOLD = 0.8;

// The answered question (lib/handoff.js answeredOf) that a question in `asked`
// repeats, judged by charOverlap past REPEAT_THRESHOLD, or null. Question text only: option labels are what a re-ask changes.
function repeatOf(asked, answered) {
    for (const q of Array.isArray(asked) ? asked : []) {
        const text = q && q.question;
        if (typeof text !== 'string') continue;
        const hit = answered.find((a) => charOverlap(text, a.question) > REPEAT_THRESHOLD);
        if (hit) return hit;
    }
    return null;
}

// The single mark `skipReason` reads: whatever `mine.inflight` holds — none,
// one mark, or (a build's groups, docs/90-agent/plans/2026-09-28-agent-lifetime-design.md
// §1) several — narrowed to the one matching `stage`, since that is the
// only field `skipReason`'s message ever names. Every mark for one stage
// carries the same `stage`, so which one is picked among several does not
// change what it says. A local equivalent of `lib/registry.js`'s
// `inflights`, not a call to it: this file reaches into `lib/handoff.js`
// and `lib/stages.js` already, and the array-vs-bare-object shape is
// `lib/registry.js`'s to read, not a second copy's.
function runningMark(mine, stage) {
    const raw = mine && mine.inflight;
    const marks = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? [raw] : [];
    return marks.find((m) => m && m.stage === stage) || null;
}

// How often the wait reads the answer file.
const POLL_MS = 200;

// The station's answers to `questions`, or null. Holds the question for
// `gate.station` seconds: writes the pending file the station shows, reads the
// answer file every POLL_MS, and removes the pending file however it ends.
// Synchronous on purpose — `run(main)` calls main once and does not await it.
function stationAnswers(root, mine, values, questions) {
    const wait = values ? values['gate.station'] : 'off';
    if (!Number.isInteger(wait) || wait <= 0 || !Array.isArray(questions) || !questions.length) return null;
    const pending = pendingPath(root, mine, mine.stage);
    const answer = answerPath(root, mine, mine.stage);
    if (!pending || !answer) return null;
    const since = Date.now();
    const nap = new Int32Array(new SharedArrayBuffer(4));
    try {
        writeAnswer(pending, JSON.stringify({ questions, at: since, until: since + wait * 1000 }) + '\n');
        for (;;) {
            const got = answersSince(answer, since);
            if (got) return got;
            if (handedOffSince(answer, since)) return null;
            if (Date.now() - since >= wait * 1000) return null;
            Atomics.wait(nap, 0, 0, POLL_MS);
        }
    } finally {
        try { fs.unlinkSync(pending); } catch (e) { /* already gone */ }
    }
}

// What this hook has to say, once the station has had its chance: an answer
// that arrived in time goes out as an allowed call carrying `answers`.
function emit(out, payload, root, mine, values) {
    let answers = null;
    try {
        answers = stationAnswers(root, mine, values, payload.tool_input && payload.tool_input.questions);
    } catch (e) { /* housekeeping: the question goes to the terminal */ }
    if (answers) {
        out.hookSpecificOutput = {
            hookEventName: 'PreToolUse',
            permissionDecision: 'allow',
            permissionDecisionReason: 'fankeel: answered on the station',
            updatedInput: Object.assign({}, payload.tool_input, { answers }),
        };
    }
    if (Object.keys(out).length) process.stdout.write(JSON.stringify(out));
}

// The questions as a user sees them, as a short hash: stored on the record
// when the gate opens and compared with the next ask. docs/90-agent/plans/
// 2026-09-30-init-design.md §6.
function hashOf(questions) {
    const seen = (Array.isArray(questions) ? questions : []).map((q) => [
        q && q.header, q && q.question, Boolean(q && q.multiSelect === true),
        (q && Array.isArray(q.options) ? q.options : []).map((o) => [o && o.label, o && o.description]),
    ]);
    return crypto.createHash('sha1').update(JSON.stringify(seen)).digest('hex').slice(0, 16);
}

function main(raw) {
    const payload = parse(raw);
    if (!payload) return;

    const root = registry.rootFor(payload);
    const mine = registry.readSession(root, payload.session_id);
    if (!mine || mine.active !== true) return;

    const hash = hashOf(payload.tool_input && payload.tool_input.questions);
    const before = mine.gateAsked && typeof mine.gateAsked === 'object' ? mine.gateAsked : null;
    try {
        registry.gateOpen(root, payload.session_id, { stage: mine.stage, hash });
    } catch (e) { /* housekeeping */ }

    // `stage.agents`: validate rather than substitute. The controller is the
    // one that typed the AskUserQuestion call now, so what reaches this hook
    // either copies the handoff's gate word for word or it does not.
    // docs/archive/2026-09-19-survey-brain-design.md §6.
    let gate = null;
    let skip = null;
    let file = null;
    let controlled = false;
    let agents = 'unset';
    let values = null;
    try {
        values = profileLib.profileFor(root, mine).values;
        controlled = controlling(mine.stage, values);
        agents = agentsText(values);
        file = handoffPath(root, mine, mine.stage);
        if (controlled) gate = readGate(file, nextStage(mine.stage, mine.route), normaliseRoute(mine.route) || FULL_ROUTE, { pause: true, floor: mine.floor });
        if (!gate) skip = skipReason({ stage: mine.stage, controlled, agents, inflight: runningMark(mine, mine.stage), handoff: file });
    } catch (e) { /* housekeeping */ }

    // No file gate to check against at all — missing file, unreadable, or the
    // stage is not controlled. Silent before 2026-09-24, so a question that was
    // never checked left no trace of which condition failed. A message, not a
    // decision: the question still goes out.
    if (!gate) return emit(skip ? { systemMessage: 'fankeel: gate not confirmed — ' + skip + '.' } : {}, payload, root, mine, values);

    // A gate AskUserQuestion would reject: the file's own gate must be
    // well-formed even though the controller is the one typing it now. Deny
    // instead, naming the field, so the controller can send it back.
    if (gate.invalid) {
        process.stdout.write(JSON.stringify({
            hookSpecificOutput: {
                hookEventName: 'PreToolUse',
                permissionDecision: 'deny',
                permissionDecisionReason: 'fankeel: the gate in ' + handoffPath(root, mine, mine.stage)
                    + ' cannot be asked — `' + gate.invalid + '`: ' + gate.detail + '. SendMessage the stage agent to'
                    + ' rewrite the gate block at the end of that file so `' + gate.invalid + '` holds (option one names'
                    + ' the next stage, or a stage on this route to send the work back to), then ask again when it returns the path. Do not write the question yourself.',
            },
        }));
        return;
    }

    const asked = (payload.tool_input && payload.tool_input.questions) || null;
    const matches = gateMatches(asked, gate.questions);

    if (!matches) {
        // Does the question in hand look like an attempt at this gate at all?
        // Header equality alone used to decide this, and every question the
        // controller asks during a controlled stage carries the stage's own
        // header by convention — so a legitimate, different question sharing
        // only the header was denied as if it were a botched copy. Header
        // match is now necessary but not sufficient: the asked question's
        // content — its `question` text plus its option labels — must also
        // be substantially similar to the gate's own first question, using a
        // normalized character-overlap ratio (works across mixed
        // Chinese/English text, where splitting into words is unreliable).
        const first = Array.isArray(asked) && asked[0];
        const gateFirst = Array.isArray(gate.questions) && gate.questions[0];
        const headerMatches = !!first && typeof first.header === 'string'
            && first.header.toLowerCase() === String(mine.stage || '').toLowerCase();
        const textOf = (q) => (q && q.question || '') + '|' + (Array.isArray(q && q.options) ? q.options.map((o) => o && o.label).join('|') : '');
        const looksLikeAttempt = headerMatches
            && charOverlap(textOf(first), textOf(gateFirst)) > ATTEMPT_THRESHOLD;
        if (looksLikeAttempt) {
            process.stdout.write(JSON.stringify({
                hookSpecificOutput: {
                    hookEventName: 'PreToolUse',
                    permissionDecision: 'deny',
                    permissionDecisionReason: 'fankeel: this question does not match ' + file
                        + '\'s `json gate` block word for word. Re-read the file and copy its `questions` array exactly'
                        + ' — do not retype or summarize it — then ask again.',
                },
            }));
            return;
        }
        // A question the user already answered at an earlier stage's gate is
        // the user's to settle once. Answers whose stage report was rewritten
        // after them (`stale`) are exempt: the gate may be a new question. So
        // are the earlier laps of the stage being worked (gate-3): a stage
        // entered again asks its gate about new work, and its last visit's
        // question reads like this one — verify-5 overlapped verify-4's
        // answer 0.70 on 2026-10-01. `answeredOf` still returns them, for the
        // brief.
        let answered = [];
        // Nor is a multi-question gate's opening routing question (`lead`): it
        // was about that gate's moment. A single-question gate has none.
        try { answered = answeredOf(root, mine).filter((a) => !a.stale && !a.lead && a.stage !== mine.stage); } catch (e) { /* housekeeping */ }
        const again = repeatOf(asked, answered);
        if (again) {
            process.stdout.write(JSON.stringify({
                hookSpecificOutput: {
                    hookEventName: 'PreToolUse',
                    permissionDecision: 'deny',
                    permissionDecisionReason: 'fankeel: already answered (' + again.stage + '): ' + again.question + ' -> ' + again.answer
                        + '. The user settled this at the ' + again.stage + ' gate; act on that answer instead of asking again.',
                },
            }));
            return;
        }
        skip = skipReason({ stage: mine.stage, controlled, matches: false, agents, inflight: runningMark(mine, mine.stage), handoff: file });
        return emit(skip ? { systemMessage: 'fankeel: gate not confirmed — ' + skip + '.' } : {}, payload, root, mine, values);
    }

    // gate-2: the same stage, the same questions, and an answer written since
    // they were first asked — the stage agent rewrote its report and not its
    // gate. Refused, so it takes out what the answer settled rather than the
    // user answering it twice.
    const answer = answerPath(root, mine, mine.stage);
    let answeredAt = null;
    try { answeredAt = fs.statSync(answer).mtimeMs; } catch (e) { /* no answer yet */ }
    if (before && before.stage === mine.stage && before.hash === hash && Number.isFinite(before.at)
        && answeredAt !== null && answeredAt > before.at) {
        process.stdout.write(JSON.stringify({
            hookSpecificOutput: {
                hookEventName: 'PreToolUse',
                permissionDecision: 'deny',
                permissionDecisionReason: 'fankeel: this gate is unchanged since the user answered it (' + answer + '). SendMessage the stage agent to'
                    + ' rewrite the gate in ' + file + ', taking out the options that answer settled, then ask again when it returns the path.',
            },
        }));
        return;
    }

    // The controller's own AskUserQuestion call already copies the file's gate
    // word for word, so there is nothing to substitute. The stage agent has
    // handed its gate back, so it is no longer in flight. There is no
    // SubagentStop hook in .claude-plugin/plugin.json; this is the one place
    // the mark is cleared. No `agentId`: every mark on this record clears,
    // not only the one that reported. Correct specifically because a real,
    // matched gate only ever comes from this stage's closing brain (design
    // §1, bullet 6) — by the time it is asked, every group this stage ran
    // has already returned, so nothing is left standing to spare.
    try {
        registry.clearInflight(root, payload.session_id);
    } catch (e) { /* housekeeping */ }
    return emit({}, payload, root, mine, values);
}

// Deliberately silent. Whatever went wrong, the question still has to reach
// the user.
run(main);
