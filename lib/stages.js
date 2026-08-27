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
// ask. That read as a contradiction for two releases: the first rule below said
// never end a *step* silently, and a step in `skills/fankeel-plan/SKILL.md` is
// one plan task — so `build` appeared to owe a gate every two to five minutes,
// which is the one gate it is defined not to have. The unit is the stage.
// `build` runs every task the ledger lists open and then asks once, and the
// word `step` no longer appears in any gate rule.
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
//
// The third rule's dispatch clause is here rather than in `survey`, which is
// where it started. Five stages dispatch — survey readers, plan a tier per task,
// build an implementer, verify and audit a reader per page or pair — and only
// survey said what it was sending. The asymmetry read as though survey were the
// only stage that cost anything, and a fan-out nobody announced is spend the
// user is paying for and could not see coming. One clause in the always-on block
// covers all five; `survey`'s own copy came out in the same change, and paid
// for most of this one.
//
// It says "before it goes" and "how many" because the first version said
// neither, and a review caught both. That draft read "a dispatch and its model"
// and hung off "say what you actually did" — so a fan-out of four satisfied it
// by naming one model in the wrap-up, after the bill. Every other surface says
// count and model, and prospectively; this is the copy that survives a
// compaction, so a weaker clause here is the one that outlives them.
//
// It fits because three clauses went the other way. `survey` lost "which no
// flag lifts", `build` lost "in passing", and the rule above lost a word —
// decoration on instructions complete without it, all of it spelled out at
// length in the stage skills. The whole injection is capped at 2400 characters
// by `tests/render.test.js`, and a rule added here has to be bought rather than
// granted: `build` now sits 9 characters under that cap.
const ALWAYS = [
    'Never end a stage silently or in prose. Ask with AskUserQuestion — three at least, never dropping the pause. Option one is the approval: {{NEXT}}. Option two names the open decision, never unfinished work.',
    'The background goes inside the question call — in the option descriptions, never as a paragraph in the stem. The stem is one line. Recommended option first.',
    'Say what you actually did — a skipped step, a failed test, a thing you could not check — and a dispatch before it goes: how many, which model.',
    'Write tool input in literal characters, never as \\uXXXX escapes: escaped calls corrupt mid-word and fail to parse. Name a code concept in code — `overdue`, not a translation of it.',
];

// Step 0, and deliberately not a stage. A route is the stages one task goes
// through, and at the `/fankeel` prompt there is no task yet — asking for it is
// what this step is for, so a place on a route here would be a route for a thing
// that does not exist. `hooks/inject.js` had already reached that conclusion in a
// comment and then injected nothing behind it, which left the `init` badge a
// promise with no rules to keep. These are the rules. They ride the
// additionalContext that prompt already carries, so nothing that iterates
// `STAGES`, `FULL_ROUTE` or `CLASSES` changes.
const INIT = [
    'Run `{{ORIENT}}` and show what came back. If the user named a place — an `@` path, a directory, "the frontend" — work from there rather than asking for it again.',
    'Read `TODO.md` at the root if there is one, and offer its entries clustered into tasks, never one option per bullet. No `TODO.md` means guessing from the recent commits instead.',
    'Ask with AskUserQuestion, never in prose: the project only when the root holds more than one, then the task. Never ask for a file list — claims are recorded as the edits land.',
    'Then `{{TASK}} start`, and begin the first stage on the route in the same turn — `--route` can make that something other than `survey`. "Entry written, shall I begin?" spends a turn on a question whose answer is always yes.',
];

// No stage's shape, because there is no stage. What it fills in is what was on
// screen before the question — the difference between a menu and a guess.
const INIT_TEMPLATE = [
    '<what orient returned>',
    '<the TODO.md clusters, or the recent commits>',
    '',
    'then AskUserQuestion',
].join('\n');

// Every stage's last rule is the shape of its output, and they are all the same
// shape: the thing the stage produced, then the question. What differs is the
// form the product takes and how much room it gets.
//
// A line format, not only a length. A count bounds how much gets written and
// says nothing about what has to be read to find one line, and a paragraph under
// the count is still a paragraph. Prose is what is left over for the things a
// line format cannot hold.
//
// The format itself is the template's job, not the rule's. Where the skeleton a
// few lines down already shows `- path:line — what it is`, the rule above it says
// only "one line per finding" — a shape written twice is paid for twice, and the
// copy that gets followed is the one that can be filled in.
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
            'Before creating anything, run `node {{SURVEY}} [--root <dir>] <term>...` and quote it. Nothing matched is a finding; say which terms you tried.',
            'Run `node {{MAP}}` and read what it lists as planned but not built. Those pages are intent, not drift: designing against them as if they described the code is the failure this stage prevents.',
            'Read whatever documents this area. If it disagrees with the code, say so now — a stale document read later becomes a confident wrong answer.',
            'State the ask in one line and have it confirmed before designing anything.',
            'Scope from the tree before the first term. A capped scan re-runs with `--all`; a truncated walk needs `--root`. A `skipped:` line’s paths go to one reader; its counts are only reported. Dispatch when the reading is wide, or when nothing matched at all: several in one response, one lens each. Never ask permission.',
            'Read the fankeel-survey skill on entering this stage.',
            'Output: one line per finding, then the question. Under 120 words of your own.',
        ],
        template: [
            '<the map summary, quoted>',
            '<the scanner block, quoted>',
            '',
            '- path:line — what is there',
            '- path:line — what is there',
            '',
            'planned, not built: <the pages, or "none">',
            'not found: <terms that matched nothing>',
            'class: <class> — <why>',
            'then AskUserQuestion',
        ].join('\n'),
    },
    {
        name: 'design',
        produces: 'an approach someone agreed to',
        rules: [
            'Present the approach and wait for a yes. Length scales with the decision; the gate does not.',
            'Cut whatever the stated ask does not require. Reach for what is already here before adding anything new.',
            'Name what would prove it done \u2014 the test that fails now and passes after. "Make it work" is not a criterion. And if a simpler approach exists, or the ask itself looks wrong, say so before building it.',
            'Check the approach against .fankeel/map.md before presenting it. Contradicting a page marked current is a contradiction that ships; name the page, or say you checked and found none.',
            'Read the fankeel-design skill on entering this stage.',
            'Output: the approach in one sentence, the files it touches as a table, the one thing you have not verified, then the question. Under 200 words, one approach, not a catalogue.',
        ],
        template: [
            '<the approach, one sentence>',
            '',
            '| file | change |',
            '|---|---|',
            '| path | what happens to it |',
            '',
            'proves it done: <the test that fails now and passes after>',
            'against the map: <the page it touches, or "no conflict">',
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
            'Every task carries a `**Dispatch:**` line \u2014 `implementer, <model>` or `in-session`. `sonnet` is the floor and needs no argument; anything above it names on that same line what the task needs that transcription does not. A task without the line is a plan failure.',
            'Read the fankeel-plan skill on entering this stage.',
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
            'From a plan (the fankeel-build skill has the loop): `node {{LEDGER}} --plan <f> show` first; never redo a task it lists complete. One reviewer per task, then `complete <n> "<what landed>"`. After a compaction it beats memory.',
            'Decide rather than stall, recording `Ruling: what \u2014 why \u2014 costs if wrong`. Only four things stop the loop: irreversible, security-sensitive, a side effect outside this workspace, every path forward a guess.',
            'Every changed line traces to the ask. Follow the patterns here; do not improve adjacent code, comments or formatting. Remove what your own change orphaned; dead code you did not create gets mentioned, not deleted.',
            'Anything deferred goes in TODO.md as one line pointing at the detail, never a comment nobody will find.',
            'A new document is the last resort: use an existing page, or write a generator when it derives from code. One written carries status, last_verified and source_of_truth.',
            'Output: one line per file, then the question. Under 80 words; the diff is the output, prose for what it cannot show.',
        ],
        template: [
            '- path +12/-3 — what changed',
            '- path (new) — what it is',
            '',
            'ledger: <n> of <m> complete',
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
            'Read the fankeel-verify skill on entering this stage.',
            'Output: the command and the line that decided it, in a code block, then the question. Filter the run — never paste tens of thousands of characters to report 24.',
        ],
        template: [
            '```',
            '$ <command>',
            '<the line that decided it>',
            '```',
            '',
            '- <what you claimed> — held / did not hold',
            '- docs: <page:line that is now false, or "none">',
            'then AskUserQuestion',
        ].join('\n'),
    },
    {
        name: 'audit',
        produces: 'a list of what is no longer true',
        rules: [
            'Run `node {{DOCS_CHECK}}` and quote it — dead references, never opinions. A dead path is a bug in a reference document, history in an archive.',
            'Run `node {{RESIDUE}}` and quote it. Untracked and unignored is a decision nobody made; a merged worktree is spent; an environment nothing can rebuild or run is dead weight.',
            'Every fortnight /fankeel-audit adds the deep pass: `node {{DOCS_AUDIT}}` and offers the cleanup. Alongside it: /ponytail-audit for code, knip or deptry for unused packages.',
            'A plan whose work has landed is not a plan. Offer to archive it; never move one unasked.',
            'Read the fankeel-audit skill on entering this stage.',
            'Output: one line per finding, worst first, then the question. Nothing found is a finding: say so and stop.',
        ],
        template: [
            'node <plugin>/scripts/docs-check.js',
            '<its output, quoted>',
            '',
            'node <plugin>/scripts/residue.js',
            '<its output, quoted>',
            '',
            'knip --dependencies · PYTHONUTF8=1 deptry . --ignore DEP001,DEP003,DEP004 --no-ansi',
            '<quoted, or which is not installed>',
            '',
            'node <plugin>/scripts/docs-audit.js',
            '<its output, quoted>',
            '',
            '- path:line — what is no longer true',
            '- path:line × path:line — what they disagree about, and which one the code supports',
            '',
            'clean: <what you read and found nothing wrong in>',
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
            'Read the fankeel-land skill on entering this stage.',
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
//
// What goes in is the caller's decision. `lib/render.js` substitutes
// `<plugin>/scripts/x.js` and states what `<plugin>` is once above the rules,
// because an installed plugin's root is about sixty characters and `audit` names
// three scripts — the same string three times, in the one block whose whole
// discipline is that it still gets read to the end.
// Two kinds, listed apart because a test depends on the difference. A script
// token's value is a path: the same string on every prompt, and `lib/render.js`
// has one for each. A render-time token's value is computed for the block being
// built and differs per stage, so no table can hold it.
const SCRIPT_TOKENS = {
    survey: '{{SURVEY}}',
    map: '{{MAP}}',
    ledger: '{{LEDGER}}',
    todoCheck: '{{TODO_CHECK}}',
    docsCheck: '{{DOCS_CHECK}}',
    docsAudit: '{{DOCS_AUDIT}}',
    residue: '{{RESIDUE}}',
    orient: '{{ORIENT}}',
    task: '{{TASK}}',
};
const RENDER_TOKENS = {
    next: '{{NEXT}}',
};
const TOKENS = Object.assign({}, SCRIPT_TOKENS, RENDER_TOKENS);
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

// The inverse. `task.js route` changes what a route is, and a class is the name
// of a route — so a record keeping the class it started with names a route it no
// longer has, and that sentence is injected on every prompt. Null for anything
// nobody presets, which leaves a record with no class rather than a wrong one;
// `lib/render.js` prints nothing when the field is absent.
function classForRoute(route) {
    const want = normaliseRoute(route);
    if (!want) return null;
    for (const name of Object.keys(CLASSES)) {
        const has = CLASSES[name].route;
        if (has.length === want.length && has.every((step, i) => step === want[i])) return name;
    }
    return null;
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
// One substitution, two callers: a stage's rules and `init`'s.
function substitute(rules, subs) {
    if (!subs) return rules;
    let out = rules;
    for (const key of Object.keys(TOKENS)) {
        const value = subs[key];
        if (!value) continue;
        out = out.map((r) => r.split(TOKENS[key]).join(value));
    }
    return out;
}
function rulesFor(stage, subs) {
    const found = byName(stage);
    return substitute(found ? ALWAYS.concat(found.rules) : ALWAYS.slice(), subs);
}
function initRules(subs) {
    return substitute(INIT.slice(), subs);
}

// The skeleton for a stage, or null. Null rather than a default: a template for
// the wrong stage is worse than none, because it is followed.
function templateFor(name) {
    const stage = byName(name);
    return stage && stage.template ? stage.template : null;
}

module.exports = { ALWAYS, INIT, INIT_TEMPLATE, initRules, STAGES, NAMES, TOKENS, SCRIPT_TOKENS, RENDER_TOKENS, SURVEY_TOKEN, FULL_ROUTE, CLASSES, byName, nextStage, normaliseRoute, positionIn, routeForClass, classForRoute, rulesFor, templateFor };
