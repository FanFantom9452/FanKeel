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

const fs = require('node:fs');
const registry = require('../lib/registry.js');
const { renderResume } = require('../lib/render.js');
const profileLib = require('../lib/profile.js');
const { controlling, nextStage, normaliseRoute, FULL_ROUTE } = require('../lib/stages.js');
const { handoffPath, answerPath, writeAnswer, readGate, answersGate, withCheckout, dirFor } = require('../lib/handoff.js');
const boardEdit = require('../lib/board-edit.js');
const { run, parse } = require('../lib/hook.js');
const { AWAY_QUESTION } = require('../lib/context.js');

function main(raw) {
    const payload = parse(raw);
    if (!payload) return;

    const sessionId = payload.session_id;
    const root = registry.rootFor(payload);

    // In a worktree, the handoffs and the answer beside them are in it.
    const mine = withCheckout(root, registry.readSession(root, sessionId), registry.launchRoot(payload));
    if (!mine || mine.active !== true) return;

    // Unverified in a real session: that PostToolUse tool_input carries the
    // injected question (the tests feed it in by hand).
    // The `離開` question hooks/gate.js added (gate.away = ask) is not the
    // gate's: it leaves before the gate is compared, and a "leaving" answer
    // marks the session leavingAt. The work goes on; hooks/gate.js holds the
    // next question that needs the user, and the session compacts there.
    let asked = payload.tool_input && payload.tool_input.questions;
    let response = payload.tool_response;
    let leaving = false;
    try {
        const extra = Array.isArray(asked) ? asked.find((q) => q && q.header === AWAY_QUESTION.header) : null;
        if (extra) {
            const answers = response && response.answers;
            const said = answers && typeof answers === 'object' ? String(answers[extra.question] || '') : '';
            leaving = said.startsWith('要離開');
            asked = asked.filter((q) => q !== extra);
            if (answers && typeof answers === 'object') {
                const rest = Object.assign({}, answers);
                delete rest[extra.question];
                response = Object.assign({}, response, { answers: rest });
            }
            if (leaving) leaving = registry.setLeaving(root, sessionId);
        }
    } catch (e) { /* housekeeping */ }

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
    let context = renderResume({ mine: { sessionId, data: mine }, profile, transcript: payload.transcript_path, root });
    // The board changes the user made on the station's gate page during this
    // gate (docs/90-agent/plans/2026-10-27-board-upgrade-design.md §3). They
    // ride this hook rather than the page, so an answer given in Claude Desktop
    // carries them too; each is sent once.
    let boardNote = '';
    const boardFail = (e, what) => process.stderr.write('fankeel resume: board changes not ' + (what || 'read') + ': ' + ((e && e.message) || e) + '\n');
    let dir = null;
    try {
        dir = dirFor(root, mine);
        const pending = dir ? boardEdit.pendingChanges(dir) : [];
        if (pending.length) {
            boardNote = 'fankeel: board changes made on the station during this gate (edits are already in the .board files; marks are notes only):\n'
                + pending.map((p) => '- ' + p.board + ': ' + p.change.text).join('\n');
            context = context ? context + '\n' + boardNote : boardNote;
        }
    } catch (e) { boardFail(e); }
    // After the notes are in the context: a markSent that fails partway has
    // still delivered them; if the failure persists the notes repeat at every
    // later gate until the file is fixed.
    if (boardNote) {
        try { boardEdit.markSent(dir); } catch (e) { boardFail(e, 'marked sent'); }
    }
    if (leaving) {
        const go = 'fankeel: the user is leaving and wants the work to go on. Do not stop or wait here: carry on to the next question that needs them. hooks/gate.js holds that question back, and the session compacts when that turn ends.';
        context = context ? context + '\n' + go : go;
    }
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
            const handoff = handoffPath(root, mine, mine.stage);
            const gate = readGate(handoff, nextStage(mine.stage, mine.route), normaliseRoute(mine.route) || FULL_ROUTE);
            const file = answerPath(root, mine, mine.stage);
            // A gate that cannot be compared — a handoff with no block that
            // parses (2026-10-20: a gate written through a shell lost a `\\`),
            // or one that fails gateProblem — still gets its answer filed. The
            // agent is told to read this file next, and the controller may not
            // write it; a miss file beside it says the match was never checked.
            const unchecked = handoff && response != null && (gate ? Boolean(gate.invalid) : fs.existsSync(handoff));
            if (file && unchecked) {
                const why = gate ? 'the handoff\'s gate is invalid at ' + gate.invalid + ': ' + gate.detail
                    : 'the handoff holds no readable `json gate` block, so the questions were not compared; the answer is filed anyway';
                try {
                    writeAnswer(file, (typeof response === 'string' ? response : JSON.stringify(response, null, 2)) + (boardNote ? '\n\n' + boardNote + '\n' : ''));
                    writeAnswer(file.replace(/-answer\.md$/, '-answer.miss.json'), JSON.stringify({ at: Date.now(), reason: why, asked: asked === undefined ? null : asked, filed: null }, null, 2));
                } catch (e) { process.stderr.write('fankeel resume: cannot write ' + file + ': ' + e.message + '\n'); }
            } else if (gate && file && response != null) {
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
                    note('the questions asked do not match the handoff\'s gate in question or option count');
                } else {
                    try {
                        writeAnswer(file, (typeof response === 'string' ? response : JSON.stringify(response, null, 2)) + (boardNote ? '\n\n' + boardNote + '\n' : ''));
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
