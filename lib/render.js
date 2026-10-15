'use strict';

// The text handed to every prompt while the mode is on.
//
// The rules are restated in full each turn rather than pointed at. caveman ships
// its ruleset once at SessionStart and thereafter sends only "CAVEMAN MODE ACTIVE
// (ultra) — session ruleset applies", a pointer whose strength is the salience of
// a target receding by thousands of tokens a turn. The ILS workspace re-injects
// the real rules for the current stage on every prompt, and that is the version
// that holds.
//
// Only the current stage's rules are sent, never all seven stages'. That is what
// keeps a per-turn restatement affordable, and it is also why the stage has to be
// accurate — rules for the stage you left are worse than none.

const { sharedWith, worktreeOf } = require('./guard.js');
const { isStale, ageText, notesOf, nextOf, claimsOf, projectOf, seenOf, takesOf } = require('./registry.js');
const { PLUGIN_ROOT } = require('./map.js');
const { rulesFor, templateFor, initRules, INIT_TEMPLATE, normaliseRoute, positionIn, nextStage, FULL_ROUTE, CLASSES, controlFor, controlling, agentsFor } = require('./stages.js');
const { inspect: inspectContext, contextLine } = require('./context.js');
const { handoffPath, commitPath, answerPath, contextPath, readsOf, previousHandoff, answeredOf, liveMarks } = require('./handoff.js');
const profileLib = require('./profile.js');
const path = require('node:path');
const fs = require('node:fs');
const docs = require('./docs.js');
const prose = require('./prose.js');
const { sessionDirOf } = require('./usage.js');
const { baseAgent } = require('./agentfile.js');

// The root is stated once per injection and the rules name `<plugin>`, which is
// the notation every SKILL.md already uses. It used to be substituted whole into
// every rule that named a script, and a plugin does not live in a short path: it
// lives under ~/.claude/plugins/cache/<marketplace>/<plugin>/<version>, about
// sixty characters. `audit` names three scripts, so it was paying that root three
// times — a hundred and eighty characters of the same string, in the one block
// whose whole discipline is that it still gets read to the end.
//
// The path stays pasteable because the root line resolves the notation right
// above the rules using it, not in a document somebody would have to go and read.
const PLUGIN_MARK = '<plugin>';
const named = (file) => PLUGIN_MARK + '/scripts/' + file;
const SCRIPTS = { survey: named('survey.js'), map: named('map.js'), ledger: named('ledger.js'), todoCheck: named('todo-check.js'), docsCheck: named('docs-check.js'), docsAudit: named('docs-audit.js'), residue: named('residue.js'), orient: named('orient.js'), task: named('task.js'), commit: named('commit.js'), await: named('await.js'), securityLocal: named('security-local.js'), suite: named('suite.js') };

const taskOf = (data) => ((data && typeof data.task === 'string' && data.task.trim()) || 'untitled');
const stageOf = (data) => ((data && typeof data.stage === 'string' && data.stage.trim()) || '?');

// One line per other session. The order is the caller's, which comes from the
// registry sorted by session id, so two runs over one directory read the same.
function otherLine(mine, other, now, alive, mineId) {
    let line = '  - ' + taskOf(other.data) + ' @ ' + stageOf(other.data);

    const theirClaims = claimsOf(other.data);
    if (theirClaims.length) line += '  (touched: ' + theirClaims.join(', ') + ')';

    const age = isStale(other.data, now) ? ageText(other.data, now) : null;
    if (age) line += '  (last seen ' + age + ' ago)';

    // Only the overlapping line is called out, and it names the specific paths.
    // Marking every line would make the block atmospheric, and a warning nobody
    // can act on is a warning everybody skips.
    const shared = sharedWith(mine, other, alive).clash;
    if (shared.length) line += '  << overlaps: ' + shared.join(', ');

    // Plain data from another session's record, shown and never acted on.
    for (const t of takesOf(other.data)) {
        if (mineId && t.from === mineId) line += '  (took over from you: ' + t.part + ')';
    }

    return line;
}

// model-6: the stages that dispatch implementers, reviewers and readers show
// the raised floor of an architectural task on the class line.
const ECONOMY_STAGES = ['plan', 'build', 'verify'];

// The two lines that say where the task is. Both blocks open with them, because
// the rules underneath are right for one stage only — sending them without naming
// the stage they belong to is how rules for the stage you left survive.
//
// The route, not just the stage. Which stages this task will and will not go
// through is a decision somebody made at the start, and a stage name alone gives
// no way to tell `verify` is next from `land` is next.
function whereLines(data, values) {
    const route = normaliseRoute(data && data.route) || FULL_ROUTE;
    const at = positionIn(route, stageOf(data));
    const out = [
        'FANKEEL ACTIVE — ' + taskOf(data) + ' @ ' + stageOf(data) + (at ? '  (' + at.step + ' of ' + at.steps + ')' : ''),
        'route: ' + route.map((r) => (r === stageOf(data) ? '[' + r + ']' : r)).join(' → '),
    ];
    // Said once by `task.js start` and never again, which is the decay this
    // block exists to defeat. `spike` is the one that cannot afford it: its
    // route reaches neither the rule about cutting what the ask does not
    // require nor the stage that delegates over-engineering, so the sentence
    // here is the only thing bounding what a spike may build.
    const cls = data && typeof data.class === 'string' ? data.class : '';
    const means = CLASSES[cls] && CLASSES[cls].means;
    const clause = ECONOMY_STAGES.includes(data && data.stage) ? profileLib.dispatchClause(values || {}, cls) : null;
    if (means) out.push('class: ' + cls + ' — ' + (clause ? clause.replace(/^class architectural: /, '') : means));
    return out;
}

// The profile's compact.at where a file set it. The built-in tier is left out:
// it says nothing about whether anyone enabled the mod that compacts there.
function tierOf(profile) {
    if (!profile || !profile.values || !profile.sources) return undefined;
    return profile.sources['compact.at'] === 'builtin' ? undefined : profile.values['compact.at'];
}

// One line, only when somebody set something. Builtins are not news. A file
// that does not parse is said once here, because nothing else will say it.
function profileLine(profile) {
    if (!profile) return null;
    const bad = Array.isArray(profile.unreadable) ? profile.unreadable : [];
    if (bad.length) return 'profile: unreadable ' + bad.join(', ');
    const text = profileLib.summary(profile.values || {}, profile.sources || {});
    return text ? 'profile: ' + text : null;
}

// `stage.agents`: a stage handed to a stage agent. This session gets the
// controller's block in place of the stage's rules and shape, with a handoff
// path to point at; short of that it is the block it always was. Not gated on
// a next stage existing any more: the ordinary gate's own option one already
// stands the task down where the route ends, and the controller's has to make
// the same choice rather than refuse the block entirely at the last stage.
// `prompt.all`, then `prompt.<stage>`: the user's own sentences, one rule each,
// last in the block. `renderBrief` never reaches this — a reader's return is
// read by the controller, not by the person who wrote the sentence.
function promptRules(values, stage) {
    const v = values || {};
    const name = String(stage || '').trim().toLowerCase();
    return ['prompt.all', 'prompt.' + name].map((k) => v[k]).filter((s) => typeof s === 'string' && s.trim());
}

function controlBlock(data, values, subs, ctx) {
    const stage = data && data.stage;
    if (!ctx || !ctx.root || !controlling(stage, values)) return null;
    const handoff = handoffPath(ctx.root, data, stage);
    if (!handoff) return null;
    // No `next`/`advance` computed here any more: `controlRules`' option-one
    // rule now sends the controller to the label it just read off the file's
    // own gate, not to a route-computed forward-next baked in before the stage
    // agent has even run. lib/stages.js's `CONTROL_TOKENS` carries no `advance`
    // entry for the same reason.
    const control = controlFor(stage, values, Object.assign({ handoff, answer: answerPath(ctx.root, data, stage), session: ctx.sessionId }, subs), liveMarks(ctx.root, data));
    return control && Object.assign({}, control, { rules: control.rules.concat(promptRules(values, stage)) });
}

// The substitutions a stage's rules and the controller's block both draw from:
// the route's own next stage — falling back to "standing the task down" for
// the ordinary rule's prose, since `substitute` skips a falsy value and would
// otherwise ship the raw token — the profile's land clause, and every script
// path. One builder, so `rulesLines` and `controlRulesFor` cannot drift into
// building two different subs objects for what is one call either way.
function subsFor(data, profile, root) {
    const next = nextStage(data && data.stage, data && data.route) || 'standing the task down';
    const values = profile && profile.values ? profile.values : undefined;
    const subs = Object.assign({ next, profileLand: profileLib.landClause(values || {}), designMockupClause: profileLib.mockupClause(values || {}) }, SCRIPTS);
    // design's handoff file for a controlled build, relative to the registry
    // root the block already names: an absolute path cost the design block the
    // room it had left under the cap. Absent without a root, and `rulesFor`
    // then leaves the rule out rather than ship its token.
    const file = root && data && data.stage === 'design' ? handoffPath(root, data, 'design') : null;
    if (file) subs.designHandoff = path.relative(root, file).split(path.sep).join('/');
    subs.planDir = root ? planDir(projectRootOf(root, data)) : 'docs/plans';
    return { values, subs };
}

// The controller's block alone, for a caller that has no stage rules of its
// own to fall back to — `task.js start` and `task` print it in place of their
// first-step line, on the one turn that carries no injection at all.
function controlRulesFor(data, profile, ctx) {
    const { values, subs } = subsFor(data, profile, ctx && ctx.root);
    return controlBlock(data, values, subs, ctx);
}

// `facts: <path> (<n>)` for a task whose context.md holds at least one fact —
// a line beginning `- `, the shape scripts/context.js writes. The path only,
// relative to the registry root: a subagent's brief inlines the content
// (`pushContext`), and the session that dispatches it only has to know the
// facts exist. Not the `context:` line, which is lib/context.js's token warning.
function factsLine(root, data) {
    const file = root ? contextPath(root, data) : null;
    const text = contextText(file);
    if (!text) return null;
    const n = text.split(/\r?\n/).filter((l) => l.startsWith('- ')).length;
    return n ? 'facts: ' + relativeTo(root, file) + ' (' + n + ')' : null;
}

// The rules for the stage, then the shape its report takes. The shape is indented
// so it reads as a quoted skeleton rather than as more instructions.
function rulesLines(data, profile, ctx) {
    const { values, subs } = subsFor(data, profile, ctx && ctx.root);
    const control = controlBlock(data, values, subs, ctx);
    const rules = control ? control.rules : rulesFor(data && data.stage, subs, values).concat(promptRules(values, data && data.stage));
    const lines = [''];
    const facts = factsLine(ctx && ctx.root, data);
    if (facts) lines.push(facts);

    // Only when a rule actually names a script. The line costs about seventy
    // characters, which a stage naming two or three scripts wins back several
    // times over and a stage naming none — `design` — would be paying to define
    // a word it never uses.
    if (rules.some((rule) => rule.includes(PLUGIN_MARK))) lines.push(PLUGIN_MARK + ' = ' + PLUGIN_ROOT);

    lines.push('stage rules:');
    for (const rule of rules) lines.push('  - ' + rule);

    const template = control ? control.template : templateFor(data && data.stage);
    if (template) {
        lines.push('', 'output shape:');
        for (const line of template.split('\n')) lines.push(line ? '  ' + line : '');
    }
    return lines;
}

// `p` relative to `root` with forward slashes when it is under it, else as it
// came; null and '' pass through.
function relativeTo(root, p) {
    if (!p) return p;
    const r = path.relative(root, p).split(path.sep).join('/');
    return r && r !== '..' && !r.startsWith('../') && !path.isAbsolute(r) ? r : p;
}

// Where this task's files are: the worktree `task.js start` opened, absolute
// so it can be used as printed, with the branch land merges. A commit file
// names it on an `into` line, because the controller runs commit.js from the
// main checkout (docs/99-archive/2026-10-02-worktree-habit-design.md §1).
function worktreeLine(root, wt) {
    const where = (root ? path.join(root, wt.path) : wt.path).replace(/\\/g, '/');
    return 'worktree: ' + where + ' (' + wt.branch + ') — edit there; a commit file opens with the line `into ' + where + '`';
}

function render({ mine, others, now, root, launch, transcript, unclaimed, profile }) {
    const data = mine && mine.data;
    const mineClaims = claimsOf(data);
    const lines = whereLines(data, profile && profile.values);

    // Only when the registry is not where this session was opened. Finding one
    // in an ancestor is what lets a single registry cover several projects, but
    // a registry the user cannot see from what they typed is a registry they
    // will misread, so it is named the moment it stops being obvious. Claimed
    // paths are relative to it, not to the launch directory.
    if (root && launch && path.resolve(root) !== path.resolve(launch)) {
        lines.push('registry: ' + root + '  (this session opened in ' + launch + ')');
    }

    // Which repository, then which files in it. The first is coarse and was
    // answered once by a person; the second is nobody's answer at all — it is what
    // the hooks watched happen. Only a declared project reaches this line: a
    // project guessed from the first claim would put a directory name on screen
    // with nothing to check it against, and the one place that guess is checked is
    // `projectRootsFor`, where a statSync already answers it.
    const project = projectOf(data);
    if (project) lines.push('project: ' + project);
    const wt = worktreeOf(data);
    if (wt) lines.push(worktreeLine(root, wt));

    if (mineClaims.length) lines.push('touched: ' + mineClaims.join(', '));

    // What git saw, marked weak: it names no writer, so it lights CLASH and
    // reaches the guard only where no live neighbour saw or touched it too.
    const seen = seenOf(data);
    if (seen.length) lines.push('seen: ' + seen.join(', ') + '  (weak: from git, no writer)');

    // The line above is `hooks/touch.js` plus whatever `lib/dirty.js` found in
    // git, and this is what the second of those refused. It refuses a pass
    // holding more paths than `claims` keeps, because taking the newest sixty
    // would evict every path an edit earned — and staying quiet about it would
    // leave a `touched:` list that reads as complete while half its source was
    // thrown away. Almost always build output nobody has gitignored.
    if (unclaimed > 0) {
        lines.push('unclaimed: ' + unclaimed + ' files written outside the hooks, more than the record holds — none of them recorded');
    }

    // Capped at the source, so this is a handful of short lines rather than a
    // growing preamble competing with the work.
    const next = nextOf(data);
    if (next) lines.push('next: ' + next);

    // No `profile:` line here. The rule block sits 3–34 characters under its cap
    // with no profile at all, and a seven-key profile is a 146-character line,
    // so the line and the cap could not both hold — decided at the build gate
    // on 2026-09-09. The profile still shapes this block through `rulesLines`
    // (`when` rules and `{{PROFILE_LAND}}`); the values themselves are on the
    // resume block below, and `task.js profile show` prints them on demand.

    // What compaction has already cost, when it has cost anything. It sits here
    // rather than at the top because it is not what the turn is about — but it is
    // the one thing the statusline cannot say. A percentage is available there;
    // that the task survives a move to a new session is not.
    const ctx = contextLine(inspectContext(transcript), mine && mine.sessionId, process.env, tierOf(profile));
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
        for (const other of rest) lines.push(otherLine(data, other, now, rest, mine && mine.sessionId));
        // Paths a neighbour in another checkout holds too. Neither blocks the
        // other; land's merge is where the two meet.
        const merge = [];
        for (const other of rest) {
            for (const p of sharedWith(data, other, rest).merge) if (!merge.includes(p)) merge.push(p);
        }
        if (merge.length) lines.push('merge: ' + merge.join(', ') + ' — also edited in another worktree; they meet at land');
    }

    for (const line of rulesLines(data, profile, { root, sessionId: mine && mine.sessionId })) lines.push(line);

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
// of it the stage ended in prose with no question at all.
//
// It is not the full block. Everything the full block carries that does not move
// between a question and its answer — the paths touched, the notes, the other
// sessions — is already in the context a few thousand tokens up, and repeating it
// a dozen times leaves a dozen copies disagreeing about which stage this is. What
// comes back is only what has to win at the moment of generation: which stage this
// is, and the rules and the shape belonging to it — and, below, the one thing no
// other block is placed to see.
// The one block that goes out before there is an entry. `hooks/inject.js` raises
// the `init` badge on this prompt and injected nothing behind it — a step with a
// name, a number and no rules to keep. It rides the additionalContext that prompt
// already carries to say what the session id is, rather than opening a second
// output path, and that is the whole reason `init` needs no place on a route.
// The `station:` line. With a station serving, the hook wrote no page, so the
// line has no counts and names the url: one that answered, one this prompt
// started and saw bind, or one busy mid-render (`busy` in lib/serve.js); one
// started and not bound yet says the browser opens when it does. With a page —
// `FANKEEL_SERVE=off`, or a start that threw — it is that write's counts, the
// file and the command that serves it. A page the hook could not write
// (`{ error }`) says so instead of the counts, and names a serving station's
// url, which still shows the last page it had. Only `running` and `started`
// count as serving there: a station still starting has shown no page yet, and
// `tests/render.test.js` fails when either of the other states is named (render-1).
function stationLine(station, serve) {
    const s = serve && typeof serve === 'object' ? serve : {};
    const page = station && typeof station === 'object' ? station : {};
    if (typeof page.error === 'string') {
        const shown = typeof s.url === 'string' && (s.state === 'running' || s.state === 'started') ? s.url : null;
        return 'station: the page was not written (' + page.error + ')' + (shown ? '; ' + shown + ' still shows the last one written.' : '.');
    }
    if (typeof page.file === 'string') {
        return 'station: ' + page.stale + ' stale, ' + page.live + ' live — ' + page.file + '. Edit the profile with station.js serve --open.';
    }
    if (typeof s.url === 'string' && s.state === 'running') return 'station: ' + s.url + ' (serve was running).';
    if (typeof s.url === 'string' && s.state === 'started') return 'station: ' + s.url + ' (serve started, browser opened).';
    if (typeof s.url === 'string' && s.state === 'busy') return 'station: ' + s.url + ' (serve is busy loading; the page fills in when it finishes).';
    if (s.state === 'starting') return 'station: serve is starting; the browser opens when it binds.';
    return 'station: no page was written and no serve started. Run station.js serve --open.';
}

// The most CLAUDE.md and MEMORY.md may cost every turn before the block says so.
// The total is computed by `hooks/inject.js` (lib/ never requires scripts/) and
// passed in as `input.tokens`; one line, and the block stays under the 2400 injection cap with it.
const INPUT_WARN_TOKENS = 4000;

function renderInit({ sessionId, station, serve, input }) {
    if (!sessionId) return null;
    const lines = [
        'fankeel: this session is ' + sessionId,
        'That is the id every hook here reads. Pass it to --session; an id read',
        'off a path on screen may be a different one.',
    ];
    // Where to look. `hooks/inject.js` passes `station` only when it wrote the
    // page this prompt — no station serving it — and `serve` is what it found
    // asking whether one serves, null when it did not ask.
    if ((station && (typeof station.file === 'string' || typeof station.error === 'string'))
        || (serve && typeof serve.state === 'string')) lines.push(stationLine(station, serve));
    if (input && input.tokens > INPUT_WARN_TOKENS) {
        lines.push('input: ' + input.tokens + ' tok/turn from CLAUDE.md+MEMORY.md — offer to slim it at a gate (fankeel-slimmer proposes, fankeel-fixer applies)');
    }
    lines.push('', PLUGIN_MARK + ' = ' + PLUGIN_ROOT, 'init rules:');
    for (const rule of initRules(SCRIPTS)) lines.push('  - ' + rule);
    lines.push('', 'output shape:');
    for (const line of INIT_TEMPLATE.split('\n')) lines.push(line ? '  ' + line : '');
    return lines.join('\n');
}

// The one thing only this block can see. `hooks/gate.js` stamps `gateAt` before
// the question goes out and this is built after it is answered, so a record with
// no stamp here is a `PreToolUse` that did not run. Claude Code reads its hook
// list once per process: a process started before the manifest carried
// `gate.js` runs `resume.js` at every answer and `gate.js` at none, in every
// session it opens from then on — `/clear` included — and `waited` stays empty
// for as long as it lives. Nothing downstream can tell, because the field it
// leaves empty reads exactly like a stage that opened no gate. Stateless like
// `context:` — said at every answer, and the skill says to pass it on once.
const GATE_UNSTAMPED = 'gate: no gateAt on this record — hooks/gate.js did not run before this question, so waited stays empty in this process. A hook registered after Claude Code started is not live until it restarts. Say so once, not at every gate.';

function renderResume({ mine, profile, transcript, root }) {
    const data = mine && mine.data;
    if (!data) return null;
    const lines = whereLines(data, profile && profile.values);
    if (!Number.isFinite(data.gateAt)) lines.push(GATE_UNSTAMPED);
    const prof = profileLine(profile);
    if (prof) lines.push(prof);
    const ctx = contextLine(inspectContext(transcript), mine && mine.sessionId, process.env, tierOf(profile));
    if (ctx) lines.push(ctx);
    return lines.concat(rulesLines(data, profile, { root, sessionId: mine && mine.sessionId })).join('\n');
}

// The one block that goes out when a session was replaced rather than continued.
//
// A resumed or compacted session is the same session and its entry keeps being
// read. `/clear` keeps the process and takes a new id, so `<config>/sessions/
// <pid>.json` is rewritten and the old id leaves the running set: the entry is
// judged dead by every reader at once while staying `active: true`, because
// nothing but the user closes a task. Nothing is corrupted and no collision
// appears. The task simply stops being read, and until this block existed
// nothing said so.
//
// It offers and does not act. Adopting is a decision, and the notes are in it
// because this is the last place they can be seen — they die with the task, and
// a shorter block costs a whole turn of `/fankeel` to recover what it dropped.
function renderCarry({ orphans, sessionId, now }) {
    if (!Array.isArray(orphans) || !orphans.length || !sessionId) return null;

    const lines = ['FANKEEL — /clear left a task behind, and nothing is reading it now.'];

    for (const orphan of orphans) {
        const data = orphan.data;
        const route = normaliseRoute(data && data.route) || FULL_ROUTE;
        const at = positionIn(route, stageOf(data));
        const claims = claimsOf(data);
        const age = ageText(data, now);

        let where = '  stage: ' + stageOf(data) + (at ? ' (' + at.step + ' of ' + at.steps + ')' : '');
        if (claims.length) where += '  ·  touched ' + claims.length + ' file' + (claims.length === 1 ? '' : 's');
        if (age) where += '  ·  last ' + age + ' ago';

        lines.push('', '  task:  ' + taskOf(data), where);

        const notes = notesOf(data);
        if (notes.length) {
            lines.push('  notes:');
            for (const note of notes) lines.push('    - ' + note);
        }
        const next = nextOf(data);
        if (next) lines.push('  next:  ' + next);

        // The resolved path, not `SCRIPTS.task`. Every other block defines
        // `<plugin>` on a line of its own above the rules that use it; this one
        // carries a single command whose whole point is that it can be run as
        // it stands, and a placeholder with no definition beside it is a command
        // nobody can copy.
        lines.push('', 'Adopt carries all of it — task, route, claims, notes, next:',
            '  node ' + PLUGIN_ROOT + '/scripts/task.js adopt ' + orphan.sessionId + ' --session ' + sessionId);
    }

    lines.push('', 'Leaving it is fine too; /fankeel → Clear out puts it down without taking it.');
    return lines.join('\n');
}

// The block a new window gets when another session handed its task off on
// purpose (`task.js next --handoff`, lib/registry.js handoffOf). Like
// renderCarry it offers and does not act: adopting stays the user's answer to
// a question, and the command is filled in so it can be run as it stands.
function renderHandoff({ entries, sessionId, now }) {
    if (!Array.isArray(entries) || !entries.length || !sessionId) return null;
    const lines = ['FANKEEL — a task was handed off to a new session. Ask the user before adopting it.'];
    for (const entry of entries) {
        const data = entry.data;
        const route = normaliseRoute(data && data.route) || FULL_ROUTE;
        const at = positionIn(route, stageOf(data));
        const age = ageText({ updated: data && data.handoff }, now);
        lines.push('', '  task:  ' + taskOf(data),
            '  stage: ' + stageOf(data) + (at ? ' (' + at.step + ' of ' + at.steps + ')' : '')
                + (age ? '  ·  handed off ' + age + ' ago' : ''),
            '  next:  ' + nextOf(data),
            '  adopt: node ' + PLUGIN_ROOT + '/scripts/task.js adopt ' + entry.sessionId + ' --session ' + sessionId);
    }
    lines.push('', 'On /fankeel, offer Adopt first with the task named; the user still confirms.');
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
    'You do not dispatch subagents of your own — not a helper, and above all not a reviewer. Every review seat this work gets is dispatched by the session that dispatched you.',
    'You do not change the working tree outside the job you were sent to do. No `git stash`, `git checkout`, `git reset`, `git clean`, no deleting or moving files you were not asked to change. A parallel reader is working in this same tree, and no hook stops a shell command.',
];

// What the brain opens first: the newest earlier report and the lines it left under
// `reads:`, copied here so the controller opens neither. A budget, not a silent cut —
// what is left out is counted.
const READ_LINES = 12;
const READ_CHARS = 1000;
// The project's plan bucket: the `role: plan` path its docs.json declares, and
// `docs/plans` where it declares none — the flat and phased presets' spelling.
function planDir(projectRoot) {
    const { tree } = docs.read(projectRoot);
    const bucket = tree && tree.buckets.find((b) => b.role === 'plan');
    return bucket ? bucket.path : 'docs/plans';
}
const projectRootOf = (root, data) => docs.projectRootsFor(root, data && data.project ? [data.project] : [])[0] || root;

// A route whose earlier stages ran in the session wrote no handoff, but a plan
// stage there still wrote its plan. The newest plan in the plan bucket touched
// since the task started is that plan — a design file only when it is all there is.
function newestPlan(projectRoot, started) {
    const since = Date.parse(started || '');
    if (!Number.isFinite(since)) return null;
    const dir = path.join(projectRoot, ...planDir(projectRoot).split('/'));
    let names;
    try { names = fs.readdirSync(dir).filter((n) => n.endsWith('.md')); } catch (e) { return null; }
    const found = [];
    for (const n of names) {
        let at;
        try { at = fs.statSync(path.join(dir, n)).mtimeMs; } catch (e) { continue; }
        if (at >= since) found.push({ file: path.join(dir, n), design: n.endsWith('-design.md'), at });
    }
    found.sort((a, b) => (a.design - b.design) || (b.at - a.at));
    return found.length ? found[0].file : null;
}

function readFirst(before, reads, plan) {
    if (!before && plan) return ['  - read first: ' + plan + ' — the plan this task is building from; no earlier stage left a report.'];
    if (!before) return ['  - read first: none — the map (.fankeel/map.md) and the task line.'];
    const out = ['  - read first: ' + before + ' — the last stage\'s report' + (reads.length ? ', then:' : '.')];
    let used = 0;
    let shown = 0;
    for (const r of reads) {
        if (shown === READ_LINES || used + r.length > READ_CHARS) break;
        out.push('      ' + r);
        used += r.length;
        shown++;
    }
    if (shown < reads.length) out.push('      … ' + (reads.length - shown) + ' more not listed');
    return out;
}

// A stage agent's brief. It runs a whole stage in a clean context, so it gets
// what `hooks/inject.js` gives a session: the stage's rules and shape. The
// SubagentStart payload carries no prompt, so the stage is the registry's — the
// controller moves it before dispatching. Two of those rules cannot hold in a
// subagent, which has neither AskUserQuestion nor Workflow, and the lines below
// say which replaces which. Claude Code caps one additionalContext at 10,000
// characters; past that it arrives as a path nobody is told to read.
function renderBrainBrief(mine, root, profile, transcriptPath, group) {
    const data = mine.data;
    const stage = stageOf(data);
    const { floor } = profileLib.dispatchFor(profile.values, data && data.class);
    // The brain's working directory is `root`, so a path under it is written
    // relative to it, as the registry's claims are: the brief's length must not
    // depend on where the checkout sits, and `fit` cannot cut fixed text. The
    // worktree line stays absolute: commit.js resolves `into` against the repo
    // top, so it must be usable as printed.
    const rel = (p) => relativeTo(root, p);
    const handoff = rel(handoffPath(root, data, stage));
    if (!handoff) return null;
    const lines = ['FANKEEL — you are the stage agent for: ' + taskOf(data) + ' @ ' + stage];
    const claims = claimsOf(data);
    const touchedAt = claims.length ? lines.push('touched: ' + claims.join(', ')) - 1 : -1;
    if (worktreeOf(data)) lines.push(worktreeLine(root, worktreeOf(data)));
    lines.push('session: ' + mine.sessionId + ' — pass it to task.js as --session');
    const ctx = pushContext(lines, root, data, '', '    ');
    if (ctx) ctx.file = rel(ctx.file);
    const pushed = pushAnswered(lines, root, data);
    const answeredDir = pushed && rel(pushed);
    lines.push('');
    // RETURN_RULES[2] forbids dispatching, and dispatching readers is this agent's job.
    for (const rule of [RETURN_RULES[0], RETURN_RULES[1], RETURN_RULES[3]]) lines.push('  - ' + rule);
    lines.push('  - Before anything else, Read ' + PLUGIN_ROOT + '/skills/fankeel-' + stage + '/SKILL.md: the stage\'s procedure. Where it and a line here disagree, the line here wins.');
    const beforeFile = previousHandoff(root, data);
    const plan = beforeFile ? null : rel(newestPlan(projectRootOf(root, data), data.started));
    for (const l of readFirst(rel(beforeFile), beforeFile ? readsOf(beforeFile) : [], plan)) lines.push(l);
    lines.push('  - Write your report to ' + handoff + ': the output shape below, filled in, then one fenced block whose info string is `json gate`, holding {"questions": [<AskUserQuestion input>], "next": "<one line, 120 characters at most, for a pause>"}. Return that path and nothing else.');
    const next = nextStage(stage, data.route);
    lines.push('  - Each question in that block carries `header` (12 columns at most, a CJK character counting two), `question`, and 2 to 4 `options` (3 at least on the first question), each with `label` and `description`; option one\'s label names ' + (next ? '`' + next + '`' : 'standing down') + '; one option\'s label says `暫停` (or `pause`), no option names a class lighter than the task\'s floor, and `next` is never empty. A block that breaks this is refused at the gate and comes back to you.');
    lines.push('  - End the report, above the gate block, with a line `reads:`, under it at most 8 lines `<path> — <why>`, then a blank line: what the next stage\'s agent should open first, and why. The next brief copies them for it.');
    lines.push('  - You cannot call AskUserQuestion. The gate in that block is what the user is asked, word for word: this replaces the rule below that says to ask. ' + (stage === 'survey' ? 'The controller prints your report above its gate block, but the question is asked on its own card' : 'The user sees only the path to your report, not its text') + ', so the question and every description must read on their own — never "above".');
    // The brief is English and the stage agent follows it, so without this its
    // report and gate came back English to a user writing Traditional Chinese
    // (TODO 〔stage〕). The profile's `language` says which; unset, nothing.
    const language = profile && profile.values && typeof profile.values.language === 'string' ? profile.values.language : '';
    if (language) lines.push('  - Write your report\'s prose and every gate string — `question`, each label and description, `next` — in ' + language + ' (profile `language`), not this brief\'s English; code, paths, commands, stage names, `暫停` and `(Recommended)` stay as written.');
    // The prose style the user picked (profile `prose.style`). Not on build:
    // build's brief is the closest to SubagentStart's 10,000-character cap
    // (see tests/brief.test.js), and the pages it has written go through a
    // writer, which gets the style below.
    if (stage !== 'build') for (const l of prose.briefLines(profile && profile.values, projectRootOf(root, data), 'your report and every gate string')) lines.push(l);
    const dispatchable = agentsFor(stage).map((a) => (a.startsWith('fankeel:') ? '`' + a + '`' : a));
    const dispatchText = dispatchable.slice(0, -1).join(', ') + ' or ' + dispatchable[dispatchable.length - 1];
    lines.push('  - You cannot run Workflow. Dispatch ' + dispatchText + ' with the Agent tool, four by default in one response, and open every path:line one cites before you keep it: this replaces "one workflow" below.');
    lines.push('  - Write each dispatch\'s `description` as its title only: hooks/title.js adds the model, version and effort.');
    const clause = ECONOMY_STAGES.includes(stage) ? profileLib.dispatchClause(profile.values, data && data.class) : null;
    if (clause) lines.push('  - ' + clause);
    if (stage === 'build') {
        // The rules are agents/fankeel-brain.md's `## Return` (a group) and `## On a build stage`; only what varies is here.
        const groupHandoff = rel(handoffPath(root, data, stage, undefined, group));
        const commit = rel(commitPath(root, data, stage, undefined, group));
        lines.push('  - group report: ' + groupHandoff + ' instead of ' + handoff + ' — a group\'s rules are in your agent file\'s `## Return`; the commit file and the floor model, in its `## On a build stage`.');
        lines.push('  - commit file: ' + commit + ' — return `commit ' + commit + '` once it is written.');
        lines.push('  - floor model: `' + floor + '` — an in-session task\'s implementer goes out on it.');
        lines.push('  - workflow script: a `groups` row of three or more that holds your tasks goes as one Workflow; your agent file\'s `## On a build stage` says how.');
    }
    if (stage === 'design' || stage === 'plan') {
        const commit = rel(commitPath(root, data, stage));
        const dir = planDir(projectRootOf(root, data));
        const file = stage === 'plan' ? dir + '/<date>-<topic>.md' : dir + '/<date>-<topic>-design.md, and only where the design skill calls for a spec (the architectural class)';
        lines.push('  - artifact: besides your report you may Write one file, ' + file + '. ' + (stage === 'plan' ? 'Its path is the first line of your report.' : 'Put its path on the report\'s `spec:` line.') + ' Nothing else outside the report is yours to write.');
        lines.push('  - You cannot commit: `git commit` and `git add` are refused to you. When that file is written, write ' + commit + ' — its path, a blank line, then the commit message — and return `commit ' + commit + '` and nothing else. The controller commits and messages you `<base>..<sha>` or one line `commit.js: <why>`. A further line `profile: <file> does not parse — its values were skipped` may follow: a warning, not a failure, so name it in your report and do not treat it as a refusal. If <why> is about your file or the path you listed: fix it and ask again, and the same error twice means the stage is blocked. Anything else: the stage is blocked, so say so in the report. Return the report path when the stage is done or blocked.');
    }
    if (stage === 'verify') lines.push('  - You cannot edit or restore a file. To apply a mutation, run the test and restore the file, send `fankeel:fankeel-mutator` on model `' + floor + '`: it does all three, and you read what it returns.');
    // The adversary's "was it run?" has an answer on disk: one transcript per
    // subagent this session dispatched. 2026-09-23: without the path, it ruled
    // two re-reviews that did run as a report's own say-so.
    const sessionDir = stage === 'verify' && transcriptPath ? sessionDirOf(transcriptPath) : null;
    if (sessionDir) lines.push('  - subagents: ' + path.join(sessionDir, 'subagents') + ' — one `agent-<id>.jsonl` per subagent this session dispatched. Give the adversary this path: "was it run?" is answered there, not by a report saying so.');
    if (stage === 'audit' || stage === 'land') {
        const fixer = stage === 'audit' ? '`fankeel:fankeel-fixer` (a page correction) or ' : '';
        lines.push('  - You cannot edit a page or run a git write. Send one change at a time to ' + fixer + '`fankeel:fankeel-mover` on model `' + floor + '` (a move, a merge, a cleanup), and read what it returns before you send the next.');
    }
    // One command per call took a survey 34 and 48 tool calls where a main session took 5 and 6.
    lines.push('  - Run independent commands in one Bash call, joined with `;`: the skill\'s opening scripts are one call, not one each. Every call re-sends your whole context.');
    // Batched, it still opened each cited place with a Read of its own: 18 and 17 of them.
    lines.push('  - Read the lines you cite with `sed -n \'<from>,<to>p\' <file>`, the places joined in one Bash call rather than one Read each.');
    // The shape's word cap says nothing about a file, and the handoffs ran 6–9 KB.
    lines.push('  - The output rule\'s word count is this file\'s: outside the blocks you quote and the gate, your own prose stays under it.');
    lines.push('  - A message saying the user\'s answer is in a file: Read it, rewrite the report and its gate, taking out the options that answer settled — a gate asked again unchanged is refused — and return the path again.');
    // The profile's values, as the controller's own block gets them: without them the land
    // clause reads "open the menu" and the mockup rule never shows, over a profile that answered.
    for (const line of rulesLines(data, profile, null)) lines.push(line);
    lines.push('', '(agent type: fankeel-brain)');
    return fit(lines, { ctx, answeredDir, touchedAt, claims, sessionId: mine.sessionId }).join('\n');
}

// An installed plugin does not live where this checkout does. It lives under
// ~/.claude/plugins/cache/<marketplace>/<plugin>/<version> — 59 characters once
// expanded, as in C:\Users\Owner\.claude\plugins\cache\fankeel\fankeel\0.24.0 —
// against the 16 this repository happens to sit at, so a block is sized as if
// the root were that long. One copy, shared by tests/reference-size.js,
// lib/stage-registry.js and `task.js profile set`, so the cap a test holds and
// the room a command prints are measured the same way.
const REFERENCE_ROOT = 59;
const BLOCK_CAP = 2400;
function sizeAtReference(out) {
    const roots = out.split(PLUGIN_ROOT).length - 1;
    return out.length + roots * (REFERENCE_ROOT - PLUGIN_ROOT.length);
}

// What each stage's per-prompt block costs under `profile`, on the sample entry
// tests/render.test.js sizes its cap with: an architectural task on the full
// route, two claims. `root` gives a controlled stage its handoff path.
const SAMPLE_SESSION = 'aaaaaaaa-0000-4000-8000-000000000001';
function blockSizes(profile, root, now) {
    const t = Number.isFinite(now) ? now : Date.now();
    const out = {};
    for (const stage of FULL_ROUTE) {
        const data = { task: 'rework the colour ramp', claims: ['statusline.ps1', 'statusline.sh'], stage, class: 'architectural', route: FULL_ROUTE.slice(), active: true, started: new Date(t - 2 * 3600e3).toISOString(), updated: new Date(t - 60e3).toISOString() };
        out[stage] = sizeAtReference(render({ mine: { sessionId: SAMPLE_SESSION, data }, others: [], now: t, root: root || '/r', profile }));
    }
    return out;
}

// The file's own text, or null for one that does not exist or holds only
// whitespace — "pays nothing when there is nothing," now applied to the
// content a subagent reads instead of the path it used to have to Read
// itself.
function contextText(file) {
    if (!file) return null;
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch (e) { return null; }
    const trimmed = text.trim();
    return trimmed ? trimmed : null;
}

// Both briefs' context.md block, differing only in the header's leading
// marker and the indent given to each line — `pushContext` keeps that one
// difference explicit and the rest shared.
function pushContext(lines, root, data, header, indent) {
    const file = contextPath(root, data);
    const ctx = contextText(file);
    if (!ctx) return null;
    lines.push(header + 'context, verified in this task (add more with `node ' + PLUGIN_ROOT + '/scripts/context.js add`):');
    const from = lines.length;
    for (const l of ctx.split(/\r?\n/)) lines.push(indent + l);
    return { from, to: lines.length, file, indent };
}

// The most already-answered lines one brief carries, the latest kept. Six
// lines of at most ~340 characters each add about 2,000 to a brief; `fit`
// drops the oldest of them when the brief is still over BRIEF_MAX with its
// context facts gone.
const ANSWERED_MAX = 6;
// Claude Code hands a SubagentStart additionalContext over its cap to the
// agent as a file path with a 2KB preview, which two of three brains never
// opened (docs/90-agent/todo/brief-2.md). Measured on this machine on
// 2026-10-09 with two haiku readers: a 9,950-character brief arrived inline,
// a 10,050-character one as a saved file, so the cap is 10,000 characters of
// the string. A brief over BRIEF_MAX loses, in order, its oldest context
// facts (the file still holds them, and is named), then its oldest
// already-answered lines (their directory is named), then its earliest
// touched paths; nothing else. Measured at the 59-character reference root
// (sizeAtReference), so a worktree's longer plugin root does not move it
// (brief-5); the build brain's fixed rules live in agents/fankeel-brain.md
// (brief-4), which put its bare brief under 7,000 and the cap back at 9,500.
const BRIEF_MAX = 9500;
const size = (lines) => sizeAtReference(lines.join('\n'));
const ALREADY = '  - already answered (';

// Hands back `out` while it is under the cap, else `build(keep)` for the
// largest keep below count that is, down to build(floor). Each step of `fit`
// is one call, so a brief under the cap passes through every step untouched.
function shrink(out, count, floor, build) {
    let keep = count, candidate = out;
    while (keep > floor && size(candidate) > BRIEF_MAX) candidate = build(--keep);
    return candidate;
}

// `ctx` is what pushContext returned, `answeredDir` what pushAnswered did;
// `touchedAt` is the index of the touched line, -1 for none. Returns a new
// array — never the one handed in.
function fit(lines, { ctx, answeredDir, touchedAt, claims, sessionId }) {
    let out = lines.slice();
    if (ctx) {
        const facts = out.slice(ctx.from, ctx.to);
        const head = out.slice(0, ctx.from);
        const tail = out.slice(ctx.to);
        const note = (n) => ctx.indent + '… and ' + n + ' older ' + (n === 1 ? 'fact' : 'facts') + ', in ' + ctx.file;
        out = shrink(out, facts.length, 0, (keep) => head.concat([note(facts.length - keep)], facts.slice(facts.length - keep), tail));
    }
    // The answered lines sit after the facts, so their place is found by
    // prefix rather than by an index the trim above would have moved.
    const first = out.findIndex((l) => l.startsWith(ALREADY));
    if (first >= 0 && answeredDir) {
        let last = first;
        while (last < out.length && out[last].startsWith(ALREADY)) last++;
        const rows = out.slice(first, last);
        const head = out.slice(0, first);
        const tail = out.slice(last);
        const note = (n) => '  - … and ' + n + ' earlier ' + (n === 1 ? 'answer' : 'answers') + ', in ' + answeredDir;
        out = shrink(out, rows.length, 0, (keep) => head.concat([note(rows.length - keep)], rows.slice(rows.length - keep), tail));
    }
    if (touchedAt >= 0 && claims.length > 1) {
        const line = (keep) => 'touched: … ' + (claims.length - keep) + ' earlier (node ' + PLUGIN_ROOT + '/scripts/task.js show --session ' + sessionId + ' lists them), ' + claims.slice(claims.length - keep).join(', ');
        out = shrink(out, claims.length, 1, (keep) => out.slice(0, touchedAt).concat([line(keep)], out.slice(touchedAt + 1)));
    }
    return out;
}
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

// What the user already answered at an earlier stage's gate, one line per
// question, so a later agent does not put it to them again. Stale answers
// (lib/handoff.js answeredOf) are left out; the latest ANSWERED_MAX are kept.
// Returns the directory the answer files live in — what `fit` names when it
// drops some of these lines — or null when there are none.
function pushAnswered(lines, root, data) {
    let answered;
    try { answered = answeredOf(root, data).filter((a) => !a.stale); } catch (e) { return null; }
    for (const a of answered.slice(-ANSWERED_MAX)) {
        lines.push(ALREADY + a.stage + '): ' + clip(a.question, 120) + ' -> ' + clip(a.answer, 160) + '. Do not re-ask.');
    }
    return answered.length ? path.dirname(contextPath(root, data)) : null;
}

function renderBrief({ mine, agentType, root, profile, transcriptPath, group }) {
    const data = mine && mine.data;
    if (!data) return null;

    const type = baseAgent(agentType);
    // Gated the same way every other piece of `stage.agents` is: `controlling`
    // has to be true for this stage and this profile, or a `fankeel-brain` gets
    // the ordinary brief below like any other agent type. Without this check a
    // brain dispatched with the switch off, or at a stage with no controller,
    // was still told to write a handoff and not to ask — one nothing reads.
    if (type === 'fankeel-brain' && controlling(stageOf(data), profile && profile.values)) {
        const brain = renderBrainBrief(mine, root, profile, transcriptPath, group);
        if (brain) return brain;
    }

    const lines = ['FANKEEL — you are a subagent of: ' + taskOf(data) + ' @ ' + stageOf(data)];

    const claims = claimsOf(data);
    const touchedAt = claims.length ? lines.push('touched: ' + claims.join(', ')) - 1 : -1;
    if (worktreeOf(data)) lines.push(worktreeLine(root, worktreeOf(data)));

    lines.push('');
    for (const rule of RETURN_RULES) lines.push('  - ' + rule);
    lines.push('  - The project map is at .fankeel/map.md if it has been generated. Read it rather than asking what the project is: an answer pasted back stays in the parent context for the rest of the session.');

    // The task's verified facts, by path only: a subagent that needs one reads
    // the file, and one that does not pays nothing for it.
    const ctx = pushContext(lines, root, data, '  - ', '      ');
    const answeredDir = pushAnswered(lines, root, data);

    // One type gets its own line: a judge answers once, and the parent will not
    // come back for more — so the brief says the return is the whole judgement.
    // The payload carries the type as it was dispatched, and a plugin agent is
    // dispatched `fankeel:<name>` — `readOnlyAgentType` in lib/guard.js strips
    // the same prefix for the same reason.
    if (type === 'fankeel-judge') lines.push('  - Answer once. The parent will not message you again; what you return is the whole judgement, and it is filed verbatim under docs/judgements/.');
    // A writer writes a page a person reads, in the style the profile picked.
    if (type === 'fankeel-writer') for (const l of prose.briefLines(profile && profile.values, projectRootOf(root, data), 'the page you write')) lines.push(l);
    if (agentType) lines.push('', '(agent type: ' + agentType + ')');

    return fit(lines, { ctx, answeredDir, touchedAt, claims, sessionId: mine.sessionId }).join('\n');
}

module.exports = { INPUT_WARN_TOKENS, render, renderInit, renderResume, renderCarry, renderHandoff, renderBrief, rulesLines, controlRulesFor, RETURN_RULES, SCRIPTS, PLUGIN_ROOT, PLUGIN_MARK, newestPlan, planDir, REFERENCE_ROOT, BLOCK_CAP, ANSWERED_MAX, BRIEF_MAX, sizeAtReference, blockSizes };
