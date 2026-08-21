'use strict';

// The discipline. R1's stage list, and the rules that hang off it.
//
// Six stages, because each one has to earn its own rules and a list nobody can
// hold in their head is a list nobody follows. They are named for what is being
// produced, not for how it feels: `survey` produces a statement of what already
// exists, `design` an agreed approach, `build` the change, `verify` evidence,
// `audit` a list of what is no longer true, `land` a clean repository.
//
// Every stage name must survive TokenBar's ReadMode — lowercase, [a-z0-9-], at
// most sixteen characters — because it is what the statusline badge carries.

// Injected at every stage. Three rules, kept to three: this text rides on every
// single prompt, and a preamble that grows is a preamble that gets skimmed.
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
const ALWAYS = [
    'Never end a step silently or in prose. Ask with AskUserQuestion: the next stage on the route, staying in this one, or pausing — never leave the pause out.',
    'The background goes inside the question, not above it. Every option states its trade-off in its description, and the recommended one comes first.',
    'Say what you actually did. A step you skipped, a test that failed, a thing you could not check — say so plainly.',
];

const STAGES = [
    {
        name: 'survey',
        produces: 'a statement of what already exists',
        rules: [
            'Before creating anything — a component, a helper, a document — run `node {{SURVEY}} [--root <dir>] <term> [term...]` and quote what came back. `--root` narrows a multi-project registry to one. Nothing matched is a finding; say which terms you tried.',
            'Read whatever claims to document this area. If it disagrees with the code, say so now; a stale document read later becomes a confident wrong answer.',
            'State the ask in one line and have it confirmed before designing anything.',
            'Report what the scanner returned, quoted. A description of what you found is not what you found.',
        ],
    },
    {
        name: 'design',
        produces: 'an approach someone agreed to',
        rules: [
            'Present the approach and wait for a yes. Length scales with the decision; the gate does not.',
            'Cut whatever the stated ask does not require. Reach for what is already here before adding anything new.',
            'Name the files that will change, and update the task scope if it grew.',
            'One approach, under 200 words, then the question. Not a catalogue of options, and not a tour of a diff you have not written.',
        ],
    },
    {
        name: 'build',
        produces: 'the change itself',
        rules: [
            'Finish what you start. Do not stop where the happy path works and the rest is "later".',
            'Follow the patterns already in this repository rather than your own defaults.',
            'Anything genuinely deferred goes in TODO.md as one line pointing at where the detail lives — never as a comment nobody will find.',
            'Say almost nothing while building. The change is the output; prose is for what the diff cannot show.',
        ],
    },
    {
        name: 'verify',
        produces: 'evidence, not confidence',
        rules: [
            'Run the tests and quote what they said. "Should work" is not a result.',
            'Check that the thing you claimed to change actually changed.',
            'Anything half-built sends this back to build. Verify is not where the bar gets lowered.',
            'Quote the command and the line that decided it. A summary of a test result is not a test result.',
        ],
    },
    {
        name: 'audit',
        produces: 'a list of what is no longer true',
        rules: [
            'Run `node {{DOCS_CHECK}}` and quote it — dead references only, never opinions. A dead path is a bug in a reference document, history in an archive.',
            'Every fortnight, add the deep pass: `node {{DOCS_AUDIT}}` for drift and contradiction candidates, and /ponytail-audit for the code — say so if it is not installed.',
            'A plan whose work has landed is not a plan. Offer to archive it; never move one unasked.',
            'One line per finding, worst first, with the path. Nothing found is a finding — say so and stop.',
        ],
    },
    {
        name: 'land',
        produces: 'a repository no dirtier than you found it',
        rules: [
            'Commit the reason, not the diff. The diff is already in the commit.',
            'A plan whose work just landed leaves a decision record behind — what was decided and why — and is then archived, after asking. An unarchived plan gets read as current.',
            'Close the TODO.md entries this work finished, then run `node {{TODO_CHECK}}`. A plan that just moved is a link that just changed address.',
            'Run /ponytail-audit if the change was large enough to have grown something nobody asked for.',
            'Close with what changed, what it cost, and what is still open. One paragraph, not a tour of the diff.',
        ],
    },
];

// Several rules name a script, and a script's path is only knowable at run time.
// Rules carry a token the caller substitutes rather than a path baked in here,
// so this module stays a plain data file with no idea where it is installed.
const TOKENS = {
    survey: '{{SURVEY}}',
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
const FULL_ROUTE = ['survey', 'design', 'build', 'verify', 'audit', 'land'];

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

module.exports = { ALWAYS, STAGES, NAMES, TOKENS, SURVEY_TOKEN, FULL_ROUTE, byName, nextStage, normaliseRoute, positionIn, rulesFor };
