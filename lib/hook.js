'use strict';

// The two things all seven hooks then did identically: read stdin to the end, and turn
// what arrived into a payload or give up on it.
//
// They were copied rather than shared for a long time, and the argument for that
// was self-containment — a hook that can wedge a terminal should have as little
// between it and `process.stdin` as possible. It had already been spent: every
// one of them requires `lib/registry.js` before it does anything, so the file was
// never standing on its own. What the copies bought was seven chances for one of
// them to drift.
//
// The reason each hook stays silent is *not* shared, because it is not the same
// reason. A `PreToolUse` hook is silent so the edit reaches the user's own
// permission rules; a `SessionStart` one is silent so an error is not the first
// thing a session shows. Those sentences stay at the call site, which is where
// somebody changing one would look.

// Every hook exits 0 on every path, including every error path. A
// `UserPromptSubmit` hook that throws blocks the prompt it was called for and a
// `PreToolUse` hook that throws blocks the edit, and a plugin that can wedge a
// terminal is worse than no plugin. Nothing here calls `process.exit`: node
// leaves with 0 on its own once stdin ends and no exception escapes.
function run(main) {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { input += chunk; });
    process.stdin.on('end', () => {
        try {
            main(input);
        } catch (e) {
            // The reason is at the call site. What is here is that there is one.
        }
    });
    process.stdin.on('error', () => {});
}

// Null for anything that is not a JSON object, which every caller treats the
// same way: return. An array is not a payload either — `typeof [] === 'object'`
// is the check that would let one through.
function parse(raw) {
    let payload;
    try {
        payload = JSON.parse(raw);
    } catch (e) {
        return null;
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    return payload;
}

module.exports = { run, parse };
