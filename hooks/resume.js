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
const { run, parse } = require('../lib/hook.js');

function main(raw) {
    const payload = parse(raw);
    if (!payload) return;

    const sessionId = payload.session_id;
    const root = registry.rootFor(payload);

    const mine = registry.readSession(root, sessionId);
    if (!mine || mine.active !== true) return;

    // No badge written and no other session read. Neither can have changed since
    // the question went out a few seconds ago, and this hook runs several times a
    // stage — what it does has to stay proportionate to that.
    const context = renderResume({ mine: { sessionId, data: mine } });
    if (!context) return;

    process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
            hookEventName: 'PostToolUse',
            additionalContext: context,
        },
    }));

    // The one side effect, and it is the same liveness signal a prompt carries.
    // Without it, a session driven entirely by its own questions looks idle to
    // every other session for exactly as long as it behaves.
    try {
        registry.touch(root, sessionId);
    } catch (e) { /* housekeeping */ }
}

// Deliberately silent. Whatever went wrong, the turn still has to finish.
run(main);
