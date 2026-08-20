'use strict';

// The discipline. R1's stage list, and the rules that hang off it.
//
// Five stages, because each one has to earn its own rules and a list nobody can
// hold in their head is a list nobody follows. They are named for what is being
// produced, not for how it feels: `survey` produces a statement of what already
// exists, `design` an agreed approach, `build` the change, `verify` evidence,
// `land` a clean repository.
//
// Every stage name must survive TokenBar's ReadMode — lowercase, [a-z0-9-], at
// most sixteen characters — because it is what the statusline badge carries.

// Injected at every stage. Three rules, kept to three: this text rides on every
// single prompt, and a preamble that grows is a preamble that gets skimmed.
const ALWAYS = [
    'Never stop silently mid-stage. End every step by asking what comes next, and always offer a pause.',
    'Put a question’s background inside the question itself. Give every option its trade-off, recommended first.',
    'Say what you actually did. A step you skipped, a test that failed, a thing you could not check — say so plainly.',
];

const STAGES = [
    {
        name: 'survey',
        produces: 'a statement of what already exists',
        rules: [
            'Before creating anything — a component, a helper, a document — search for one that already does it, and say what you found or that you found nothing.',
            'Read whatever claims to document this area. If it disagrees with the code, say so now; a stale document read later becomes a confident wrong answer.',
            'State the ask in one line and have it confirmed before designing anything.',
        ],
    },
    {
        name: 'design',
        produces: 'an approach someone agreed to',
        rules: [
            'Present the approach and wait for a yes. Length scales with the decision; the gate does not.',
            'Cut whatever the stated ask does not require. Reach for what is already here before adding anything new.',
            'Name the files that will change, and update the task scope if it grew.',
        ],
    },
    {
        name: 'build',
        produces: 'the change itself',
        rules: [
            'Finish what you start. Do not stop where the happy path works and the rest is "later".',
            'Follow the patterns already in this repository rather than your own defaults.',
            'Anything genuinely deferred goes in TODO.md as one line pointing at where the detail lives — never as a comment nobody will find.',
        ],
    },
    {
        name: 'verify',
        produces: 'evidence, not confidence',
        rules: [
            'Run the tests and quote what they said. "Should work" is not a result.',
            'Check that the thing you claimed to change actually changed.',
            'Anything half-built sends this back to build. Verify is not where the bar gets lowered.',
        ],
    },
    {
        name: 'land',
        produces: 'a repository no dirtier than you found it',
        rules: [
            'Commit the reason, not the diff. The diff is already in the commit.',
            'Any plan or spec whose work just landed is rewritten into a short decision record — what was decided and why — and the plan is deleted. Moving the file only changes its address.',
            'Close the TODO.md entries this work finished, and run /ponytail-audit if the change was large enough to have grown something nobody asked for.',
        ],
    },
];

const NAMES = STAGES.map((s) => s.name);
const byName = (name) => STAGES.find((s) => s.name === String(name || '').toLowerCase()) || null;

// The stage after this one, or null at the end. `land` deliberately has no
// successor: the next thing is a new task, which is a decision rather than a
// transition.
function nextStage(name) {
    const i = NAMES.indexOf(String(name || '').toLowerCase());
    if (i === -1 || i === NAMES.length - 1) return null;
    return NAMES[i + 1];
}

// A stage this file has never heard of still gets the always-on rules. The field
// is a free string on disk and an unknown value must degrade to less guidance,
// never to none.
function rulesFor(stage) {
    const found = byName(stage);
    return found ? ALWAYS.concat(found.rules) : ALWAYS.slice();
}

module.exports = { ALWAYS, STAGES, NAMES, byName, nextStage, rulesFor };
