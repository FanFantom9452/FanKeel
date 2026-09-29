#!/usr/bin/env node
'use strict';

// PostToolUse on AskUserQuestion. It exists because answering a question is not
// a prompt.
//
// `UserPromptSubmit` fires when the user types. An answer to an AskUserQuestion
// comes back as a tool result, so it does not fire, and the block does not
// return. The pipeline's own gate is an AskUserQuestion, which makes a session
// doing exactly what the pipeline asks the one session where the restatement
// never happens: one real run went 511 transcript entries and forty-four minutes
// on a single injection, and the first time another skill's output contract was
// loaded on top of it, the stage ended in prose with no question at all.
//
// Same discipline as inject.js. It exits 0 on every path — a hook that throws
// here does not block a prompt, but it does put an error in front of the user in
// the middle of somebody else's turn, which is its own kind of broken. A session
// not in the mode reads one file that is not there and leaves.

const registry = require('../lib/registry.js');
const { renderResume } = require('../lib/render.js');
const profileLib = require('../lib/profile.js');
const { controlling, nextStage, normaliseRoute, FULL_ROUTE } = require('../lib/stages.js');
const { handoffPath, answerPath, writeAnswer, readGate, answersGate } = require('../lib/handoff.js');
const { run, parse } = require('../lib/hook.js');

function main(raw) {
    const payload = parse(raw);
    if (!payload) return;

    const sessionId = payload.session_id;
    const root = registry.rootFor(payload);

    const mine = registry.readSession(root, sessionId);
    if (!mine || mine.active !== true) return;

    // The project's standing answers. A read failure costs one line, never
    // the injection: `read` returns unreadable paths rather than throwing, but
    // `projectRootsFor` stats the disk and this stays inside a try regardless.
    let profile;
    try {
        profile = profileLib.profileFor(root, mine);
    } catch (e) { /* housekeeping */ }

    // No badge written and no other session read. Neither can have changed since
    // the question went out a few seconds ago, and this hook runs several times a
    // stage — what it does has to stay proportionate to that.
    const context = renderResume({ mine: { sessionId, data: mine }, profile, transcript: payload.transcript_path, root });
    if (!context) return;

    process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
            hookEventName: 'PostToolUse',
            additionalContext: context,
        },
    }));

    // The liveness signal, and it is the same one a prompt carries. Without it,
    // a session driven entirely by its own questions looks idle to every other
    // session for exactly as long as it behaves.
    try {
        // The other end of hooks/gate.js, and it runs first: the clock `touch`
        // is about to move has to be counted against the stage before the wait
        // is taken out of it.
        registry.gateClose(root, sessionId);
        registry.touch(root, sessionId);
    } catch (e) { /* housekeeping */ }

    // `stage.agents`: the answer left where the stage agent is told to look, so
    // the controller relays a path and never retypes what the user said — written
    // when the questions answered are the handoff's own gate, read the way
    // hooks/gate.js reads it, and never for a question the controller asked
    // itself. Not on `inflight`: SubagentStart fires on every SendMessage
    // delivery and hooks/brief.js re-marks the agent each time, so the mark says
    // nothing about which question this answer is to.
    try {
        if (controlling(mine.stage, profile && profile.values)) {
            const gate = readGate(handoffPath(root, mine, mine.stage), nextStage(mine.stage, mine.route), normaliseRoute(mine.route) || FULL_ROUTE);
            const asked = payload.tool_input && payload.tool_input.questions;
            const file = answerPath(root, mine, mine.stage);
            const response = payload.tool_response;
            if (gate && file && response != null) {
                // The answer that never arrives used to be silent. Beside the answer
                // file, `<stage>-answer.miss.json` says why not and holds both question
                // lists. Diagnostic only: nothing reads it, and a controller's own
                // question asked while an older gate is still on disk lands here only when its
                // question or option counts differ from the gate.
                const miss = file.replace(/-answer\.md$/, '-answer.miss.json');
                const filed = Array.isArray(gate.questions) ? gate.questions : null;
                const note = (reason) => {
                    try {
                        writeAnswer(miss, JSON.stringify({ at: Date.now(), reason, asked: asked === undefined ? null : asked, filed }, null, 2));
                    } catch (e) { process.stderr.write('fankeel resume: cannot write ' + miss + ': ' + e.message + '\n'); }
                };
                // The answer is matched by count and order (answersGate), not by wording.
                if (!answersGate(asked, gate.questions)) {
                    note(gate.invalid
                        ? 'the handoff\'s gate is invalid at ' + gate.invalid + ': ' + gate.detail
                        : 'the questions asked do not match the handoff\'s gate in question or option count');
                } else {
                    try {
                        writeAnswer(file, typeof response === 'string' ? response : JSON.stringify(response, null, 2));
                    } catch (e) {
                        note(String((e && e.message) || e));
                    }
                }
            }
        }
    } catch (e) { /* housekeeping */ }
}

// Deliberately silent. Whatever went wrong, the turn still has to finish.
run(main);
