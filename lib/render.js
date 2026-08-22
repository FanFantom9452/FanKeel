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
const { rulesFor, templateFor, normaliseRoute, positionIn, FULL_ROUTE } = require('./stages.js');
const { inspect: inspectContext, contextLine } = require('./context.js');
const path = require('node:path');

// Resolved from this file rather than passed in, so the rules name paths that
// work from whatever directory the session happens to be in.
const SURVEY_SCRIPT = path.join(__dirname, '..', 'scripts', 'survey.js');
const TODO_CHECK_SCRIPT = path.join(__dirname, '..', 'scripts', 'todo-check.js');
const DOCS_CHECK_SCRIPT = path.join(__dirname, '..', 'scripts', 'docs-check.js');
const DOCS_AUDIT_SCRIPT = path.join(__dirname, '..', 'scripts', 'docs-audit.js');
const MAP_SCRIPT = path.join(__dirname, '..', 'scripts', 'map.js');
const SCRIPTS = { survey: SURVEY_SCRIPT, map: MAP_SCRIPT, todoCheck: TODO_CHECK_SCRIPT, docsCheck: DOCS_CHECK_SCRIPT, docsAudit: DOCS_AUDIT_SCRIPT };

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

// The two lines that say where the task is. Both blocks open with them, because
// the rules underneath are right for one stage only — sending them without naming
// the stage they belong to is how rules for the stage you left survive.
//
// The route, not just the stage. Which stages this task will and will not go
// through is a decision somebody made at the start, and a stage name alone gives
// no way to tell `verify` is next from `land` is next.
function whereLines(data) {
    const route = normaliseRoute(data && data.route) || FULL_ROUTE;
    const at = positionIn(route, stageOf(data));
    return [
        'FANKEEL ACTIVE — ' + taskOf(data) + ' @ ' + stageOf(data) + (at ? '  (' + at.step + ' of ' + at.steps + ')' : ''),
        'route: ' + route.map((r) => (r === stageOf(data) ? '[' + r + ']' : r)).join(' → '),
    ];
}

// The rules for the stage, then the shape its report takes. The shape is indented
// so it reads as a quoted skeleton rather than as more instructions.
function rulesLines(data) {
    const lines = ['', 'stage rules:'];
    for (const rule of rulesFor(data && data.stage, SCRIPTS)) lines.push('  - ' + rule);

    const template = templateFor(data && data.stage);
    if (template) {
        lines.push('', 'output shape:');
        for (const line of template.split('\n')) lines.push(line ? '  ' + line : '');
    }
    return lines;
}

function render({ mine, others, now, root, launch, transcript }) {
    const data = mine && mine.data;
    const mineScope = scopeOf(data);
    const lines = whereLines(data);

    // Only when the registry is not where this session was opened. Finding one
    // in an ancestor is what lets a single registry cover several projects, but
    // a registry the user cannot see from what they typed is a registry they
    // will misread, so it is named the moment it stops being obvious. Scope
    // paths are relative to it, not to the launch directory.
    if (root && launch && path.resolve(root) !== path.resolve(launch)) {
        lines.push('registry: ' + root + '  (this session opened in ' + launch + ')');
    }

    if (mineScope.length) lines.push('scope: ' + mineScope.join(', '));

    // Capped at the source, so this is a handful of short lines rather than a
    // growing preamble competing with the work.
    const next = nextOf(data);
    if (next) lines.push('next: ' + next);

    // What compaction has already cost, when it has cost anything. It sits here
    // rather than at the top because it is not what the turn is about — but it is
    // the one thing the statusline cannot say. A percentage is available there;
    // that the task survives a move to a new session is not.
    const ctx = contextLine(inspectContext(transcript));
    if (ctx) lines.push(ctx);

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

    for (const line of rulesLines(data)) lines.push(line);

    return lines.join('\n');
}

// The short form, sent back after an AskUserQuestion has been answered.
//
// Answering a question is not a prompt. The answer arrives as a tool result, so
// `UserPromptSubmit` does not fire and the block above does not return — and
// since the pipeline's own gate *is* an AskUserQuestion, a session doing exactly
// what the pipeline asks is the one session where the restatement never happens.
// One real run went 511 transcript entries and forty-four minutes on a single
// injection, and the first time another skill's output contract was loaded on top
// of it the step ended in prose with no question at all.
//
// It is not the full block. Everything the full block carries that does not move
// between a question and its answer — the scope, the notes, the other sessions —
// is already in the context a few thousand tokens up, and repeating it a dozen
// times leaves a dozen copies disagreeing about which stage this is. What comes
// back is only what has to win at the moment of generation: which stage this is,
// and the rules and the shape belonging to it.
function renderResume({ mine }) {
    const data = mine && mine.data;
    if (!data) return null;
    return whereLines(data).concat(rulesLines(data)).join('\n');
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

    // Recorded rather than acted on. Which agent types deserve a different brief
    // is a question real use answers, and the hook can match on the type when
    // there is an answer.
    if (agentType) lines.push('', '(agent type: ' + agentType + ')');

    return lines.join('\n');
}

module.exports = { render, renderResume, renderBrief, RETURN_RULES, SCRIPTS, SURVEY_SCRIPT, TODO_CHECK_SCRIPT, DOCS_CHECK_SCRIPT, DOCS_AUDIT_SCRIPT };
