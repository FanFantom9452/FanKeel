'use strict';

// The text handed to every prompt while the mode is on.
//
// The rules are restated in full each turn rather than pointed at. caveman ships
// its ruleset once at SessionStart and thereafter sends only "CAVEMAN MODE ACTIVE
// (ultra) — session ruleset applies", a pointer whose strength is the salience of
// a target receding by thousands of tokens a turn. The ILS workspace re-injects
// the real rules for the current step on every prompt, and that is the version
// that holds.
//
// Only the current stage's rules are sent, never all five stages'. That is what
// keeps a per-turn restatement affordable, and it is also why the stage has to be
// accurate — rules for the stage you left are worse than none.

const { overlapPaths } = require('./overlap.js');
const { isStale, ageText, notesOf, nextOf } = require('./registry.js');
const { rulesFor } = require('./stages.js');
const { byName: styleByName } = require('./styles.js');
const path = require('node:path');

// Resolved from this file rather than passed in, so the rules name paths that
// work from whatever directory the session happens to be in.
const SURVEY_SCRIPT = path.join(__dirname, '..', 'scripts', 'survey.js');
const TODO_CHECK_SCRIPT = path.join(__dirname, '..', 'scripts', 'todo-check.js');
const SCRIPTS = { survey: SURVEY_SCRIPT, todoCheck: TODO_CHECK_SCRIPT };

const scopeOf = (data) => (Array.isArray(data && data.scope) ? data.scope.filter((s) => typeof s === 'string' && s.trim()) : []);
const taskOf = (data) => ((data && typeof data.task === 'string' && data.task.trim()) || 'untitled');
const stageOf = (data) => ((data && typeof data.stage === 'string' && data.stage.trim()) || '?');

// One line per other session. The order is the caller's, which comes from the
// registry sorted by session id, so two runs over one directory read the same.
function otherLine(mineScope, other, now) {
    let line = '  - ' + taskOf(other.data) + ' @ ' + stageOf(other.data);

    const theirScope = scopeOf(other.data);
    if (theirScope.length) line += '  (scope: ' + theirScope.join(', ') + ')';

    const age = isStale(other.data, now) ? ageText(other.data, now) : null;
    if (age) line += '  (last seen ' + age + ' ago)';

    // Only the overlapping line is called out, and it names the specific paths.
    // Marking every line would make the block atmospheric, and a warning nobody
    // can act on is a warning everybody skips.
    const shared = overlapPaths(mineScope, theirScope);
    if (shared.length) line += '  << overlaps: ' + shared.join(', ');

    return line;
}

function render({ mine, others, now }) {
    const data = mine && mine.data;
    const mineScope = scopeOf(data);
    const lines = ['FANKEEL ACTIVE — ' + taskOf(data) + ' @ ' + stageOf(data)];

    if (mineScope.length) lines.push('scope: ' + mineScope.join(', '));

    // Capped at the source, so this is a handful of short lines rather than a
    // growing preamble competing with the work.
    const next = nextOf(data);
    if (next) lines.push('next: ' + next);

    const notes = notesOf(data);
    if (notes.length) {
        lines.push('');
        lines.push('so far:');
        for (const note of notes) lines.push('  - ' + note);
    }

    const rest = Array.isArray(others) ? others : [];
    if (rest.length) {
        lines.push('');
        lines.push('also in progress:');
        for (const other of rest) lines.push(otherLine(mineScope, other, now));
    }

    lines.push('');
    lines.push('stage rules:');
    for (const rule of rulesFor(data && data.stage, SCRIPTS)) lines.push('  - ' + rule);

    // Last, because it is the block closest to what gets generated next. Present
    // only while a style has been set but is not yet in force — the full style
    // lives in the system prompt, and once that is carrying it this is waste.
    const style = styleByName(data && data.style);
    if (style) {
        lines.push('');
        lines.push('voice (' + style.name + '):');
        for (const rule of style.digest) lines.push('  - ' + rule);
    }

    return lines.join('\n');
}

// What a subagent is told when it starts, including a background one.
//
// This is the highest-leverage text in the plugin, and the arithmetic is what
// makes it so. Everything a subagent reads costs input tokens in a context that
// is thrown away when it finishes. What it *returns* costs output tokens and
// then sits in the parent's context for the rest of the session. Spending a
// hundred tokens here to take a thousand off the return value is a trade worth
// making every single time.
//
// So this is deliberately not the stage rules. A subagent is not running the
// pipeline; it is doing one bounded job inside somebody else's stage. It gets
// what it cannot work out for itself — which task it belongs to, which files are
// spoken for — and what its own output is for.
const RETURN_RULES = [
    'Your final message is the return value. It is the only thing that reaches the parent, and it stays in that context for the rest of the session — findings and conclusions, not a narration of what you read.',
    'Say plainly what you could not check. A gap the parent cannot see becomes a confident wrong answer there.',
];

function renderBrief({ mine, agentType }) {
    const data = mine && mine.data;
    if (!data) return null;

    const lines = ['FANKEEL — you are a subagent of: ' + taskOf(data) + ' @ ' + stageOf(data)];

    const scope = scopeOf(data);
    if (scope.length) {
        lines.push('scope: ' + scope.join(', '));
    }

    lines.push('');
    for (const rule of RETURN_RULES) lines.push('  - ' + rule);
    if (scope.length) {
        lines.push('  - If you write to a file outside that scope, name the file and say why in the return value. The parent is tracking those paths against other live sessions.');
    }

    // Only when the user picked one. A subagent inherits the parent's voice for
    // the same reason the parent has it, and the digest is already the short
    // form — the full style is not something a subagent's system prompt carries.
    const style = styleByName(data.style);
    if (style) {
        lines.push('');
        lines.push('voice (' + style.name + '):');
        for (const rule of style.digest) lines.push('  - ' + rule);
    }

    // Recorded rather than acted on. Which agent types deserve a different brief
    // is a question real use answers, and the hook can match on the type when
    // there is an answer.
    if (agentType) lines.push('', '(agent type: ' + agentType + ')');

    return lines.join('\n');
}

module.exports = { render, renderBrief, RETURN_RULES, SCRIPTS, SURVEY_SCRIPT, TODO_CHECK_SCRIPT };
