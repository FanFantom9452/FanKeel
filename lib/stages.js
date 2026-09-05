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
// `build` runs every task the ledger or the file table lists open and then asks
// once, and the word `step` no longer appears in any gate rule.
//
// That settled two senses and left a third unnamed, which is how a settled word
// comes unsettled. All three, and where each is allowed:
//
//   plan task     `skills/fankeel-plan/SKILL.md` — two to five minutes, no gate
//   route entry   here and `skills/fankeel/SKILL.md`'s route rules, and what
//                 `positionIn` returns as `{ step, steps }` for `(3 of 7)`
//   gate unit     gone. It was the stage all along, and saying "step" for it is
//                 what produced the contradiction above
//
// The first two are safe because they live in different files about different
// subjects and neither is injected. What must not come back is the third: a rule
// in this file saying `step` reads as the plan sense to the one stage that must
// not stop, so a gate rule says *stage* or it says nothing.
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
// It also carries the recommendation, and that is a collision being settled
// rather than a phrasing. The tool's own description says to put the recommended
// option first and label it; the rule here says option one is the approval. Those
// agree until a finding argues against advancing — and then they cannot both be
// obeyed, so one of them silently loses and the reader cannot tell which.
//
// Position and recommendation are separated instead. Option one is the approval
// always, so the user knows where the approval lives without reading; the
// `(Recommended)` label says which one is backed, and it can sit on any of them.
// The old second rule's "Recommended option first" is gone, which is what pays
// for this: the pair is seventeen characters shorter than what it replaced, in a
// block where `build` had six to spare.
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
// granted: which stage binds, and by how much, is in the run's own diagnostics
// rather than here.
//
// A figure did stand here, and it said 6 while the test's own diagnostic said
// 23, because it was written from the arithmetic of one change and never
// re-read against a run. Ten of the 23 bought `or none` in the rule below —
// which is the amount the stale number would have refused. That is why no
// number stands here now: take the diagnostic.
const ALWAYS = [
    'Never end a stage silently or in prose. Ask with AskUserQuestion — three at least, never dropping the pause. Option one is the approval: {{NEXT}} — mark your pick `(Recommended)` rather than moving it. Option two names the open decision, or none — never unfinished work.',
    'Background belongs in the option descriptions, never in the stem, which is one line.',
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
    'Read `TODO.md` at the root if there is one. Its headings are the clustering: `## Ready` is one task for the whole section, and more than one bullet needs `plan` on the route; `## Needs a decision` is one task each; `## Waiting` stays out — nothing there can move today. Any other heading, or none, means clustering by hand — never one option per bullet. No `TODO.md` means guessing from the commits instead.',
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
//
// A file-and-description line leads with the path. `build`'s rule says one line
// per file and `design`'s asks for a table of files, so the file is what each
// line is keyed by, and the diffstat the report is read beside is path-led too.
// The description is the part whose length varies; leading with it would land
// the path and the `+n/-m` in a different column on every line. Asked on
// 2026-09-02 and kept as it is.
// `land` carries this and `build` does not, and the reason is arithmetic rather
// than intent: build's injection sits seven characters under the cap in
// `tests/render.test.js`, and that cap is displaced into rather than raised, so
// build's copy rides step 4 of its skill instead, read once on entering the
// stage. The next session's init and survey read `git log` before they read
// any code, which is what the bullets are for: a subject that fits on one line,
// one bullet per change with the module it landed in, and prose only for what a
// bullet cannot hold. Asking for the reason alone came back as five paragraphs
// under a 107-character subject.
const COMMIT = 'Commit: `type: what changed` under 60 characters; one bullet per change, `- <what changed> — <module>`; one paragraph only for what a bullet cannot hold.';

const STAGES = [
    {
        name: 'survey',
        produces: 'a statement of what already exists',
        rules: [
            'Before creating anything, run `node {{SURVEY}} [--root <dir>] <term>...` and quote it. Nothing matched is a finding; say which terms you tried.',
            'Run `node {{MAP}}` and read what it lists as planned but not built.',
            'Read whatever documents this area. If it disagrees with the code, say so now — a stale document read later becomes a confident wrong answer.',
            'State the ask in one line and have it confirmed before designing anything.',
            'Scope from the tree before the first term. A capped scan re-runs with `--all`; a truncated walk needs `--root`. A `skipped:` line’s paths go to one reader; its counts are only reported. Wide reading or no match: one lens each, one workflow, every path:line checked before it returns. Never ask permission.',
            'Read the fankeel-survey skill on entry: ratchet the class with task.js route.',
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
            'skipped: <what, and why — not N>',
            'class: <class> — <why>',
            'route: <unchanged, or the task.js route line>',
            'then AskUserQuestion',
        ].join('\n'),
    },
    {
        name: 'design',
        produces: 'an approach someone agreed to',
        rules: [
            'Present the approach and wait for a yes.',
            'Cut whatever the stated ask does not require. Reach for what is already here before adding anything new.',
            'Name what would prove it done \u2014 the test that fails now and passes after. "Make it work" is not a criterion. And if a simpler approach exists, or the ask itself looks wrong, say so before building it.',
            'Check the approach against .fankeel/map.md before presenting it. Name the page, or say you checked and found none.',
            'Two or more rows sharing no file and feeding nothing to each other are independent work: put `plan` on the route with `task.js route`, the only place N tasks are written down durably and what `ledger.js groups` reads.',
            'Read the fankeel-design skill on entry: spec file, self-review.',
            'Output: the approach in one sentence, the files it touches as a table, the one thing you have not verified, then the question. Under 200 words, one approach, not a catalogue.',
        ],
        template: [
            '<the approach, one sentence>',
            '',
            '| file | change | dispatch |',
            '|---|---|---|',
            '| path | what happens to it | implementer, sonnet — or in-session, with why |',
            '',
            'proves it done: <the test that fails now and passes after>',
            'against the map: <the page it touches, or "no conflict">',
            'unverified: <the one thing you have not checked>',
            'spec: <the docs/plans path — architectural — or "in chat">',
            'then AskUserQuestion',
        ].join('\n'),
    },
    {
        name: 'plan',
        produces: 'a decomposition someone with no context could execute',
        rules: [
            'Write it to docs/plans/<date>-<topic>.md, headed by the goal, the spec path, and Global Constraints taken from `node {{MAP}}`.',
            'A task is the smallest unit carrying its own test cycle. Fold setup and docs into the task that needs them; split only where a reviewer could reject one and pass its neighbour.',
            'Every step holds the actual code, not a description of it. "TBD", "add appropriate error handling", "write tests for the above" and "similar to Task N" are failures, not shorthand.',
            'Before the gate, check it yourself: every spec requirement has a task, nothing was left unwritten, and a name a later task uses is the name an earlier task defined.',
            'Every `## Task N:` carries `**Files:**`, `**Interfaces:**` and a `**Dispatch:**` line \u2014 `implementer, <model>` or `in-session`. `sonnet` is the floor; anything above it names on that same line what the task needs that transcription does not. A task without one is a plan failure.',
            'Read the fankeel-plan skill on entry: Test: what it writes, no-dispatch on every task.',
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
            'Do not stop where the happy path works and the rest is "later". That, and a new ask that neither blocks nor belongs, is one TODO.md line at the detail. Say which; ambiguous, ask that turn.',
            'From a plan: `node {{LEDGER}} --plan <f> show` first; never redo a task it lists complete. One reviewer per task, then `complete <n> "<what landed>"`.',
            'Decide rather than stall, recording `Ruling: what \u2014 why \u2014 costs if wrong`. Only four things stop the loop: irreversible, security-sensitive, a side effect outside this workspace, every path forward a guess.',
            'Every changed line traces to the ask. Follow the patterns here; do not improve adjacent code, comments or formatting. Remove what your own change orphaned; dead code you did not create gets mentioned, not deleted.',
            'A new document is the last resort: use an existing page, or write a generator when it derives from code. One written carries status, last_verified and source_of_truth.',
            'Read the fankeel-build skill on entry: worktree consent, four-item brief, five rounds, resume the fixer, commit shape.',
            'Output: one line per file, then the question. Under 80 words.',
        ],
        template: [
            '- path +12/-3 — what changed',
            '- path (new) — what it is',
            '',
            'done: <n> of <m> — ledger or file table',
            'deferred: <heading> — <TODO.md line, or omit this line>',
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
            'A coverage claim states its denominator — nine of twenty-one pages, not "the pages".',
            'Before the question, one read-only adversary over the evidence: was each command run after the last edit, on the thing claimed, by a check that could have failed. Give it paths, never a paste, and ask only for the rows it defeats — every line it returns stays in this session for good. Where the host opens it, the chain is one workflow.',
            'Read the fankeel-verify skill on entry: ledger ranges, red-green, line by line.',
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
            '- adversary: <the claim it defeated → build, or "nothing">',
            'then AskUserQuestion',
        ].join('\n'),
    },
    {
        name: 'audit',
        produces: 'a list of what is no longer true',
        rules: [
            'Run `node {{DOCS_CHECK}}` and quote it — dead references, never opinions.',
            'Run `node {{RESIDUE}}` and quote it, non-git too.',
            'Every fortnight /fankeel-audit adds the deep pass: `node {{DOCS_AUDIT}}`, one reader per pair, and offers the cleanup. {{PONYTAIL}}',
            'Before the question, one read-only adversary over the findings: was it run, on what, and could it have failed. Where the host opens it, the chain is one workflow.',
            'Read the fankeel-audit skill on entry: todo-check after a move.',
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
            'adversary: <what it defeated, or none>',
            'pairs disagree: <where, or omit this line>',
            'routed: <heading — the entry, or omit this line>',
            'clean: <what you read and found nothing wrong in>',
            'then AskUserQuestion',
        ].join('\n'),
    },
    {
        name: 'land',
        produces: 'a repository no dirtier than you found it',
        rules: [
            COMMIT,
            'A landed plan leaves a decision record behind — what was decided and why — then is archived, after asking. An unarchived plan gets read as current.',
            'Close the TODO.md entries this work finished, then run `node {{TODO_CHECK}}`. A plan that just moved is a link that just changed address.',
            'Update last_verified on every page you re-read and found true, then re-run `node {{MAP}}`: the project looks different now and the next task starts from that map.',
            'shipped: is one line per thing someone can now do that they could not, from the ledger\'s completed entries where there is one.',
            'Option one stands the task down; route the notes first. `/clear` after, never before: a cleared session gets a new id and the entry is left active, unread.',
            'Read the fankeel-land skill on entry: worktree, base, release.',
            'Output: the suite\'s green line, then what landed, what it cost, what is still open — then the question. Not a tour of the diff.',
        ],
        template: [
            '<sha> <subject>',
            'shipped:',
            '  - <what someone can now do that they could not>',
            'suite: <green>',
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
// Filled by `lib/render.js` rather than by a path, because both depend on
// something only the running machine knows: which stage comes next on this
// task's route, and which of the plugins `audit` can call on is installed.
const RENDER_TOKENS = {
    next: '{{NEXT}}',
    ponytail: '{{PONYTAIL}}',
};
const TOKENS = Object.assign({}, SCRIPT_TOKENS, RENDER_TOKENS);
const SURVEY_TOKEN = TOKENS.survey;

const NAMES = STAGES.map((s) => s.name);
// Trimmed as well as lowercased. A route arrives from a JSON file or a comma
// separated argument, and ` verify ` failing to be `verify` would be a route
// silently refused over a space nobody can see.
const byName = (name) => STAGES.find((s) => s.name === String(name || '').trim().toLowerCase()) || null;

// A route is the stages this particular task will go through, in order. Not
// every task is seven stages: a typo fix is `build, verify` and a documentation
// sweep is `survey, audit, land`, and pretending otherwise makes the progress
// indicator lie in both directions — a two-stage task looks permanently unfinished
// at 2/7, and a long one gets no credit for the stages it invented.
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
