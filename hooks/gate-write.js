#!/usr/bin/env node
'use strict';

// PostToolUse on Write. hooks/gate.js already validates a stage agent's
// `json gate` block — but only once, on the PreToolUse for AskUserQuestion
// that follows the controller finishing the stage and typing the question
// out. By then the stage agent that wrote a malformed block is long gone: its
// own context is over, and a bad gate only surfaces once the controller has
// to bounce the handoff file back to a fresh agent. This hook is the earlier
// half: the moment a stage agent's own Write lands the handoff file, the same
// `readGate` check runs against it, and a `systemMessage` reaches that
// agent's own transcript this same turn, before it hands the path back to
// whoever dispatched it.
//
// Same two rules as every other hook here: exit 0 on every path, and cost
// nothing for a session, or a write, this is not about. Silent unless the
// file just written is THIS session's own current-stage handoff path, and
// what is in it is an invalid `json gate` block.

const registry = require('../lib/registry.js');
const { targetOf } = require('../lib/guard.js');
const { nextStage, normaliseRoute, FULL_ROUTE } = require('../lib/stages.js');
const { handoffPath, readGate } = require('../lib/handoff.js');
const { run, parse } = require('../lib/hook.js');
const path = require('node:path');

// Absolute, forward-slash, for comparing a tool call's own `file_path`
// against `handoffPath`'s. `handoffPath` already returns forward slashes; a
// tool call's `file_path` is not guaranteed to.
function normalize(file) {
    return path.resolve(String(file)).replace(/\\/g, '/');
}

// The in-flight mark this write belongs to: the one, if any, whose
// `agentId` is the subagent that just wrote the file, narrowed to marks for
// this session's own current stage — the same pair `scripts/await.js`'s
// `waitFor` reads to find one brain's file among a build's several. No
// `agentId` on the payload (a Write outside any subagent) and no matching
// mark both read the same way: nothing here is this write's business.
function ownMark(mine, agentId) {
    if (!agentId) return null;
    const running = registry.inflights(mine).filter((m) => m && m.stage === mine.stage);
    return running.find((m) => m.agentId === agentId) || null;
}

function main(raw) {
    const payload = parse(raw);
    if (!payload) return;

    const root = registry.rootFor(payload);
    const mine = registry.readSession(root, payload.session_id);
    if (!mine || mine.active !== true) return;

    const written = targetOf(payload);
    if (!written) return;

    const mark = ownMark(mine, payload.agent_id);
    if (!mark) return;

    const lap = Number.isInteger(mark.lap) && mark.lap > 0 ? mark.lap : undefined;
    const group = mine.stage === 'build' && Number.isInteger(mark.group) ? mark.group : undefined;
    const file = handoffPath(root, mine, mine.stage, lap, group);
    if (!file || normalize(written) !== normalize(file)) return;

    let result = null;
    try {
        result = readGate(file, nextStage(mine.stage, mine.route), normaliseRoute(mine.route) || FULL_ROUTE);
    } catch (e) { /* housekeeping */ }
    if (!result || !result.invalid) return;

    process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
            hookEventName: 'PostToolUse',
            systemMessage: 'fankeel: the json gate block just written to ' + file + ' is invalid at '
                + result.invalid + ': ' + result.detail + ' — rewrite the block before returning this path.',
        },
    }));
}

// Deliberately silent. Whatever went wrong, the write already landed, and
// there is nothing left to protect — only something worth saying.
run(main);
