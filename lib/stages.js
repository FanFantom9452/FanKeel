'use strict';

// The discipline. R1's stage list, and the rules that hang off it.
//
// Seven stages, because each one has to earn its own rules and a list nobody can
// hold in their head is a list nobody follows. They are named for what is being
// produced, not for how it feels: `survey` produces a statement of what already
// exists, `design` an agreed approach, `plan` a decomposition someone with no
// context could execute, `build` the change, `verify` evidence, `audit` a list
// of what is no longer true, `land` a clean repository.
//
// `plan` is its own stage rather than the head of `build` because approving a
// plan is a human gate, and `build`'s discipline is that it does not stop to
// ask. A gate inside a stage that must not stop is a contradiction, and it
// resolves itself by being ignored.
//
// Every stage name must survive TokenBar's ReadMode — lowercase, [a-z0-9-], at
// most sixteen characters — because it is what the statusline badge carries.

// Injected at every stage. Four rules, and four is roughly the ceiling — but the
// reason is attention, not price. Input is cheap and output is not, so buying a
// shorter, better-shaped answer with a longer preamble is nearly always the right
// trade; what it cannot buy is a preamble so long it gets skimmed. Size these by
// whether they will still be followed.
//
// These three are about how to talk rather than what to do, so they overlap the
// `fankeel-pipeline` output style on purpose. A style is chosen by the user in
// /config and a hook cannot tell whether one is active, so moving them out would
// mean losing them entirely whenever the user picked something else. Three lines
// is a cheaper price than that.
//
// The first rule names the tool, and that is the whole point of it. Earlier it
// said `end every step by asking what comes next`, and a real design stage ended
// with three numbered options in a paragraph — which is asking, and is also the
// failure: the options were on screen and the user still had to type one out.
// SKILL.md named `AskUserQuestion` for the Start flow, but SKILL.md is read once
// at session start and this rides every prompt, so this is where it has to be
// said.
//
// The fourth rule is here rather than in the output style because what it
// prevents is a failed tool call, not a badly written one. Measured over one real
// session: seventeen `AskUserQuestion` calls, of which two serialised their
// Chinese as unicode escapes rather than writing the characters. Both of those
// corrupted mid-word — \u9privately\u9375 where a word should have been, a stray
// `masks` in another — and neither parsed. The fifteen written in literal
// characters all went through.
//
// Its second half closes the same class of failure one level up. A code concept
// written out in prose drifts to a homophone the second time it is typed, and the
// two spellings then read as two concepts. Same session: `逾期` written 35 times
// and `逆期` 8, for one identifier.
const ALWAYS = [
    'Never end a step silently or in prose. Ask with AskUserQuestion — next stage, stay, or pause, never dropping the pause. Option one is the approval: say what it approves.',
    'The background goes inside the question call — in the option descriptions, beside the option each belongs to, never as a paragraph in the stem. The stem is one line. Recommended option first.',
    'Say what you actually did. A step you skipped, a test that failed, a thing you could not check — say so plainly.',
    'Write tool input in literal characters, never as \\uXXXX escapes: escaped calls corrupt mid-word and fail to parse. Name a code concept in code — `overdue`, not a translation of it.',
];

// Every stage's last rule is the shape of its output, and they are all the same
// shape: the thing the stage produced, then the question. What differs is the
// form the product takes and how much room it gets.
//
// Each one names a line format, not only a length. A count bounds how much gets
// written and says nothing about what has to be read to find one line, and a
// paragraph under the count is still a paragraph. Prose is what is left over for
// the things a line format cannot hold.
//
// Alongside the rule, each stage carries a `template`: the skeleton itself rather
// than a description of it. The rule survived a design stage writing nine hundred
// words, and the reason is that describing a shape and showing one are not the
// same instruction. The template is the more expensive of the two and the cheaper
// place to spend — it is read once per turn by the model and never by the user,
// where every word it saves is a word the user does not have to read.
//
// They are replacements for the rules that used to sit there, not additions. The
// old ones pointed in the right direction without bounding anything — `in the
// fewest words that let someone say yes or no` is unfalsifiable, and a design
// stage produced nine hundred words under it. A number can be missed; a
// direction cannot be.
const STAGES = [
    {
        name: 'survey',
        produces: 'a statement of what already exists',
        rules: [
            'Before creating anything, run `node {{SURVEY}} [--root <dir>] <term>...` and quote it. `--root` picks one project of several. Nothing matched is a finding; say which terms you tried.',
            'Run `node {{MAP}}` and read what it lists as planned but not built. Those pages are intent, not drift: designing against them as if they described the code is the failure this stage prevents.',
            'Read whatever documents this area. If it disagrees with the code, say so now — a stale document read later becomes a confident wrong answer.',
            'State the ask in one line and have it confirmed before designing anything.',
            'Output: the scanner block quoted, then one line per finding as `path:line — what it is`, then the question. Under 120 words of your own.',
        ],
        template: [
            '<the scanner block, quoted verbatim>',
            '',
            '- path:line — what is there',
            '- path:line — what is there',
            '',
            'not found: <terms that matched nothing>',
            'then AskUserQuestion',
        ].join('\n'),
    },
    {
        name: 'design',
        produces: 'an approach someone agreed to',
        rules: [
            'Present the approach and wait for a yes. Length scales with the decision; the gate does not.',
            'Cut whatever the stated ask does not require. Reach for what is already here before adding anything new.',
            'Name the files that will change, and update the task scope if it grew.',
            'Name what would prove it done \u2014 the test that fails now and passes after. "Make it work" is not a criterion. And if a simpler approach exists, or the ask itself looks wrong, say so before building it.',
            'Check the approach against .fankeel/map.md before presenting it. Contradicting a page marked current is a contradiction that ships; name the page, or say you checked and found none.',
            'Output: the approach in one sentence, the files it touches as a table, the one thing you have not verified, then the question. Under 200 words, one approach, not a catalogue.',
        ],
        template: [
            '<the approach, one sentence>',
            '',
            '| file | change |',
            '|---|---|',
            '| path | what happens to it |',
            '',
            'unverified: <the one thing you have not checked>',
            'then AskUserQuestion',
        ].join('\n'),
    },
    {
        name: 'plan',
        produces: 'a decomposition someone with no context could execute',
        rules: [
            'Write it to docs/plans/<date>-<topic>.md, headed by the goal, the spec path, and Global Constraints taken from `node {{MAP}}` rather than remembered.',
            'A task is the smallest unit carrying its own test cycle. Fold setup and docs into the task that needs them; split only where a reviewer could reject one and pass its neighbour.',
            'Every step holds the actual code, not a description of it. "TBD", "add appropriate error handling", "write tests for the above" and "similar to Task N" are failures, not shorthand.',
            'Before the gate, check it yourself: every spec requirement has a task, nothing was left unwritten, and a name a later task uses is the name an earlier task defined.',
            'Output: one line per task as `N. name \u2014 the files it touches`, then the question. Under 100 words of your own; the file is the output.',
        ],
        template: [
            'docs/plans/<date>-<topic>.md \u2014 <n> tasks',
            '',
            '1. <name> \u2014 path, path',
            '2. <name> \u2014 path',
            '',
            'constraints: <n> lines, from map.md',
            'then AskUserQuestion',
        ].join('\n'),
    },
    {
        name: 'build',
        produces: 'the change itself',
        rules: [
            'Finish what you start. Do not stop where the happy path works and the rest is "later".',
            'Every changed line traces to the ask: follow the patterns already here rather than your own defaults, and do not improve adjacent code, comments or formatting on the way past. Remove what your own change orphaned; dead code you did not create gets mentioned, not deleted.',
            'Anything deferred goes in TODO.md as one line pointing at the detail — never as a comment nobody will find.',
            'A new document is the last resort: put it in an existing page, or write a generator when the content is derivable from code. One that is written carries status, last_verified and source_of_truth — and a plan is not filed as reference.',
            'Output: one line per file as `path +n/-m — what changed`, then the question. Under 80 words. The diff is the output; prose is for what it cannot show.',
        ],
        template: [
            '- path +12/-3 — what changed',
            '- path (new) — what it is',
            '',
            'deferred: <TODO.md line, or omit this line>',
            'then AskUserQuestion',
        ].join('\n'),
    },
    {
        name: 'verify',
        produces: 'evidence, not confidence',
        rules: [
            'Run the tests and quote what they said. "Should work" is not a result.',
            'Check that the thing you claimed to change actually changed.',
            'Anything half-built sends this back to build. Verify is not where the bar gets lowered.',
            'Run `node {{DOCS_CHECK}}` and name any page this change just made no longer true. A change that is correct and leaves three pages describing the old behaviour is half verified.',
            'Output: the command and the line that decided it, in a code block, then the question. Filter the run — never paste 34,000 characters to report 24.',
        ],
        template: [
            '```',
            '$ <command>',
            '<the line that decided it>',
            '```',
            '',
            '- <what you claimed> — held / did not hold',
            'then AskUserQuestion',
        ].join('\n'),
    },
    {
        name: 'audit',
        produces: 'a list of what is no longer true',
        rules: [
            'Run `node {{DOCS_CHECK}}` and quote it — dead references only, never opinions. A dead path is a bug in a reference document, history in an archive.',
            'Every fortnight add the deep pass. /fankeel-audit runs `node {{DOCS_AUDIT}}`, reads the shortlist and offers the cleanup; /ponytail-audit is the code half — say if it is not installed.',
            'A plan whose work has landed is not a plan. Offer to archive it; never move one unasked.',
            'Output: one line per finding, worst first, as `path:line — what is no longer true`, then the question. Nothing found is a finding — say so and stop.',
        ],
        template: [
            '- path:line — what is no longer true',
            '- path:line — what is no longer true',
            '',
            'clean: <what you checked and found nothing in>',
            'then AskUserQuestion',
        ].join('\n'),
    },
    {
        name: 'land',
        produces: 'a repository no dirtier than you found it',
        rules: [
            'Commit the reason, not the diff. The diff is already in the commit.',
            'A landed plan leaves a decision record behind — what was decided and why — then is archived, after asking. An unarchived plan gets read as current.',
            'Close the TODO.md entries this work finished, then run `node {{TODO_CHECK}}`. A plan that just moved is a link that just changed address.',
            'Update last_verified on every page you re-read and found true, then re-run `node {{MAP}}`: the project looks different now and the next task starts from that map.',
            'Output: three lines — what landed, what it cost, what is still open — then the question. Not a tour of the diff.',
        ],
        template: [
            '<sha> <subject>',
            'cost: <what it took>',
            'open: <what is still not done>',
            'then AskUserQuestion',
        ].join('\n'),
    },
];

// Several rules name a script, and a script's path is only knowable at run time.
// Rules carry a token the caller substitutes rather than a path baked in here,
// so this module stays a plain data file with no idea where it is installed.
const TOKENS = {
    survey: '{{SURVEY}}',
    map: '{{MAP}}',
    todoCheck: '{{TODO_CHECK}}',
    docsCheck: '{{DOCS_CHECK}}',
    docsAudit: '{{DOCS_AUDIT}}',
};
const SURVEY_TOKEN = TOKENS.survey;

const NAMES = STAGES.map((s) => s.name);
// Trimmed as well as lowercased. A route arrives from a JSON file or a comma
// separated argument, and ` verify ` failing to be `verify` would be a route
// silently refused over a space nobody can see.
const byName = (name) => STAGES.find((s) => s.name === String(name || '').trim().toLowerCase()) || null;

// A route is the stages this particular task will go through, in order. Not
// every task is six stages: a typo fix is `build, verify` and a documentation
// sweep is `survey, audit, land`, and pretending otherwise makes the progress
// indicator lie in both directions — a two-stage task looks permanently unfinished
// at 2/6, and a long one gets no credit for the stages it invented.
//
// The route is chosen per task rather than picked from a fixed menu, so the only
// thing enforced here is that every step is a stage this file knows, that no step
// repeats, and that `land` is last if it appears at all. Everything else is the
// caller's judgement, which is where it belongs.
const FULL_ROUTE = ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'];

// Three classes, because the route was already choosable and nobody was
// choosing it. A route typed by hand is a decision made silently; a class is
// the same decision made out loud, which is what lets the user disagree with
// it before six stages of work hang off it.
//
// Two rules travel with them and are enforced by nothing here, because neither
// is checkable: when in doubt take the heavier one, and the ratchet is one-way
// — complexity found mid-task upgrades the route and says so, and nothing
// downgrades mid-task.
const CLASSES = {
    spike: {
        route: ['survey', 'build'],
        means: 'a feasibility question whose output is an answer. Anything built is labelled throwaway.',
    },
    bounded: {
        route: ['survey', 'design', 'build', 'verify', 'land'],
        means: 'a scoped change to a flow already in this repository. Design happens in chat: no spec file, no plan file.',
    },
    architectural: {
        route: FULL_ROUTE.slice(),
        means: 'a new subsystem, or a change to an interface something else depends on.',
    },
};

// Null for anything unrecognised. Defaulting to the long route would turn a typo
// into four extra stages, and defaulting to the short one would skip the gates.
function routeForClass(name) {
    const found = CLASSES[String(name || '').trim().toLowerCase()];
    return found ? found.route.slice() : null;
}

function normaliseRoute(route) {
    if (!Array.isArray(route)) return null;
    const out = [];
    for (const step of route) {
        const found = byName(step);
        if (!found) return null;
        if (out.includes(found.name)) return null;
        out.push(found.name);
    }
    if (!out.length) return null;
    const land = out.indexOf('land');
    if (land !== -1 && land !== out.length - 1) return null;
    return out;
}

// Where this task is along its own route, one-based, or null when the stage is
// not on it. Null rather than a guess: a position invented for a stage the route
// does not contain would draw a progress bar out of nothing.
function positionIn(route, stage) {
    const steps = normaliseRoute(route) || FULL_ROUTE;
    const i = steps.indexOf(String(stage || '').toLowerCase());
    return i === -1 ? null : { step: i + 1, steps: steps.length };
}

// The stage after this one along the route, or null at the end. `land` has no
// successor by construction: what follows it is a new task, which is a decision
// rather than a transition.
function nextStage(name, route) {
    const steps = normaliseRoute(route) || FULL_ROUTE;
    const i = steps.indexOf(String(name || '').toLowerCase());
    if (i === -1 || i === steps.length - 1) return null;
    return steps[i + 1];
}

// A stage this file has never heard of still gets the always-on rules. The field
// is a free string on disk and an unknown value must degrade to less guidance,
// never to none.
//
// A substitution nobody supplied leaves its token in place rather than quietly
// dropping it. A rule reading `node {{SURVEY}}` is visibly broken; one reading
// `node ` is a command that fails somewhere else with no clue why.
function rulesFor(stage, subs) {
    const found = byName(stage);
    let rules = found ? ALWAYS.concat(found.rules) : ALWAYS.slice();
    if (!subs) return rules;
    for (const key of Object.keys(TOKENS)) {
        const value = subs[key];
        if (!value) continue;
        rules = rules.map((r) => r.split(TOKENS[key]).join(value));
    }
    return rules;
}

// The skeleton for a stage, or null. Null rather than a default: a template for
// the wrong stage is worse than none, because it is followed.
function templateFor(name) {
    const stage = byName(name);
    return stage && stage.template ? stage.template : null;
}

module.exports = { ALWAYS, STAGES, NAMES, TOKENS, SURVEY_TOKEN, FULL_ROUTE, CLASSES, byName, nextStage, normaliseRoute, positionIn, routeForClass, rulesFor, templateFor };
