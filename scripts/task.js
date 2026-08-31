#!/usr/bin/env node
'use strict';

// Writing the entry, which is the one operation that was never a script.
//
// Everything else in this plugin is: orient, survey, todo-check, style. Start
// was the model hand-writing JSON at a path it computed, under a session id it
// read out of a transcript path, with two timestamps it formatted itself — the
// most failure-prone step in the whole thing and the only one with no support.
// It failed the way unsupported steps fail: quietly, leaving no registry at all,
// and the first anybody knew was that the badge never appeared.
//
// It also took `.fankeel/.gitignore` with it. The comment on `ensureLayout` says
// that file must not depend on being remembered — and then nothing on the path a
// user actually takes called it, so `sessions/` was one `git add -A` away from
// being committed.
//
// The invariants from the skill are enforced here rather than described. A rule
// that lives only in prose is a rule that holds until the context is long.

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs: parseArgv } = require('node:util');

const registry = require('../lib/registry.js');
const live = require('../lib/live.js');
const badge = require('../lib/badge.js');
const { tokens } = require('../lib/context.js');
const { overlapPaths } = require('../lib/overlap.js');
const { guardMode } = require('../lib/guard.js');
const { splitAroundVerb } = require('../lib/argv.js');
const { byName: stageByName, NAMES: STAGE_NAMES, FULL_ROUTE, CLASSES, normaliseRoute, positionIn, routeForClass, classForRoute } = require('../lib/stages.js');

// Minutes, rounded, with hours above sixty of them. Seconds are not offered: a
// stage that took forty seconds is one nobody is asking the cost of, and a
// second-precision figure invites reading noise as signal.
const mins = (ms) => {
    const m = Math.round(ms / 60000);
    if (m < 60) return m + 'm';
    const h = Math.floor(m / 60);
    return h + 'h' + (m % 60 ? (m % 60) + 'm' : '');
};

const GUARDS = ['ask', 'deny', 'off'];

// A refusal is often two sentences: what was wrong, and what to do instead.
// Named because it is built into message strings all through this file.
const NL = String.fromCharCode(10);

// What to do first, named for the stage the route actually begins at. A route
// that starts at `build` was told to survey, which is both wrong and the kind
// of wrong that teaches people to skim the output.
const FIRST_STEP = {
    survey: 'Now survey: read what orient named, then run the scanner. Do not stop to ask first.',
    design: 'Now design: one approach and what it costs, then wait for a yes.',
    plan:   'Now plan: decompose it into tasks a stranger could execute, then stop at the gate.',
    build:  'Now build. The change is the output; say little until there is something to show.',
    verify: 'Now verify: run it and quote the line that decided it.',
    audit:  'Now audit: run the documents check and quote it before judging anything.',
    land:   'Now land: commit the reason, close the TODO entries, leave nothing dangling.',
};

// The badge is written here as well as by the hook, and the reason is a full
// prompt of latency otherwise.
//
// The hook runs on UserPromptSubmit, which is *before* the turn that creates the
// entry. So starting a task wrote nothing to the statusline: the flag only
// appeared when the user submitted their next prompt, and until then turning the
// mode on looked exactly like failing to turn it on. Someone watching for the
// badge concludes it is broken, and they are not being unreasonable.
//
// The hook still owns the badge from then on, because only the hook knows about
// a collision that appeared after this ran. This is the first value, not the
// authority.
function claudeDir(opts) {
    if (opts && opts.claudeDir) return opts.claudeDir;
    if (process.env.CLAUDE_CONFIG_DIR) return process.env.CLAUDE_CONFIG_DIR;
    const home = process.env.HOME || process.env.USERPROFILE;
    return home ? path.join(home, '.claude') : null;
}

function showBadge(opts, sessionId, word, data) {
    const dir = claudeDir(opts);
    if (!dir) return;
    try {
        badge.writeBadge(dir, sessionId, word);
    } catch (e) { /* housekeeping; never worth failing a write that succeeded */ }
    if (!data) return;
    // The lead line carries what a one-word badge cannot: which task, how far
    // along its own route, and who else is in the way. Written from the same
    // place so the two can never disagree about the stage.
    try {
        const at = positionIn(data.route, data.stage) || {};
        badge.writeLead(dir, sessionId, {
            word,
            step: at.step,
            steps: at.steps,
            title: data.task,
            where: registry.claimsOf(data).join(' '),
            // The mode rather than the field, for the reason `hooks/inject.js`
            // writes the same thing: since the default became `ask` the field is
            // empty on exactly the sessions the guard is loudest on.
            guard: guardMode(data) || '',
            others: data.others > 0 ? data.others : '',
        });
    } catch (e) { /* housekeeping */ }
}

function hideBadge(opts, sessionId) {
    const dir = claudeDir(opts);
    if (!dir) return;
    try {
        badge.clearBadge(dir, sessionId);
        badge.clearLead(dir, sessionId);
    } catch (e) { /* housekeeping */ }
}

function fail(message) {
    process.stdout.write(message + '\n');
    process.exit(1);
}

// Comma or newline separated, whichever the caller found easier to pass through
// a shell. Empty pieces are dropped rather than stored as blank entries that
// would match nothing and read as a declared path.
function splitScope(raw) {
    return String(raw || '')
        .split(/[,\n]/)
        .map((s) => s.trim().replace(/\\/g, '/').replace(/\/+$/, ''))
        .filter(Boolean);
}

// Every string flag, and the key it lands on. Only `--claude-dir` differs from
// its own name, which is why this is a table rather than `arg.slice(2)`.
const STRING_FLAGS = {
    session: 'session',
    root: 'root',
    task: 'task',
    project: 'project',
    class: 'class',
    route: 'route',
    'claude-dir': 'claudeDir',
};

// `strict: false` keeps an unknown flag silent. A declared flag given no value
// comes back `true` rather than a string, and that is the refusal below: a flag
// typed with nothing after it is a mistake worth naming, not a default worth
// guessing at.
//
// It is given the flags alone, never the whole argv — which is what stops a note
// from being read as one. `--force` and `--all` are the exceptions and stay on
// the whole argv: both are boolean, so neither spends a token nor can swallow
// the word this split exists to keep, and the peel may have left one among the
// user's words on purpose. `note --force` records `--force`; `clear <id>
// --force` still forces, and `show --all` still lists the whole registry.
function parseArgs(head, whole) {
    const options = {};
    for (const flag of Object.keys(STRING_FLAGS)) options[flag] = { type: 'string' };

    const { values } = parseArgv({ args: head, strict: false, allowPositionals: true, options });
    const opts = {};
    for (const [flag, key] of Object.entries(STRING_FLAGS)) {
        if (values[flag] === undefined) continue;
        if (typeof values[flag] !== 'string') fail('--' + flag + ' needs a value.');
        opts[key] = values[flag];
    }
    if (whole.includes('--force')) opts.force = true;
    if (whole.includes('--all')) opts.all = true;
    return opts;
}

// The root the hooks would resolve, resolved the same way. Two answers here
// would be two registries, and the one the user is shown would not be the one
// the badge reads.
function rootOf(opts) {
    if (opts.root) return path.resolve(opts.root);
    return registry.rootFor({ cwd: process.cwd() });
}

// The one chokepoint every subcommand passes through, and the only way a wrong id
// ever reaches the registry: somebody typed it here.
//
// An entry written under an id no hook reads is invisible in the direction that
// costs most. Every hook goes quiet on a miss, correctly — a miss is what a
// session that never used the plugin looks like, which is nearly always what it
// is. One real session spent two hours that way, its id taken off a background
// task's output directory, which carries a session id in exactly this shape and
// not always this session's.
//
// `runningSessions` returning null is the directory being unreadable, and that
// allows: a refusal must never come from a failed measurement, which is the rule
// `isLive` already keeps.
//
// An empty list allows too, and that took a second reading to see. The id being
// checked is this session's own, so a scan that found nobody found nobody
// *including the caller* — and this session is demonstrably running, because it
// is the one asking. `lib/live.js:124` states the same rule for the same
// directory: `readLive` returns `known: false` when the scan cannot see the
// session doing the scanning, and draws no conclusion from it. This drew one,
// and it gates every command, so the cost of being wrong was the whole plugin
// refusing to run with a message saying the id does not exist.
//
// What is fatal is a scan that found somebody else and not this id. That is the
// failure it was built for — an id off a background task's output directory,
// while real sessions were listed beside it.
//
// `clear <id>` and `adopt <id>` take the other session's id positionally rather
// than through `--session`, so a dead neighbour is still reachable — which is the
// whole point of those two commands.
function requireSession(opts) {
    const id = opts.session;
    if (!id) fail('--session <id> is required. The /fankeel prompt makes the hook say it; use that one.');
    if (!registry.sessionPath(process.cwd(), id)) fail('Not a session id: ' + id);
    const rows = live.runningSessions(live.liveConfigDir());
    if (rows && rows.length && !rows.some((row) => row.sessionId === id)) {
        const lines = ['No running Claude Code session has the id ' + id + '.', ''];
        lines.push('  running now:');
        for (const row of rows) lines.push('    ' + row.sessionId + (row.cwd ? '   ' + row.cwd : ''));
        lines.push('');
        lines.push('An entry written under that id is one no hook would ever read, and every');
        lines.push('hook is silent about a miss — so the mode would look on and do nothing.');
        lines.push('A path on screen carries a session id in the same shape and it is not');
        lines.push('always this one. The /fankeel prompt makes the hook say which it is.');
        fail(lines.join('\n'));
    }
    return id;
}

const now = () => new Date().toISOString();

function describe(root, sessionId, data) {
    const lines = [];
    lines.push('task:  ' + (data.task || 'untitled'));
    const route = normaliseRoute(data.route) || FULL_ROUTE;
    const at = positionIn(route, data.stage);
    lines.push('stage: ' + (data.stage || '?') + (at ? '  (' + at.step + ' of ' + at.steps + ')' : '')
        + (data.active === true ? '' : '  (stood down)'));
    lines.push('route: ' + route.map((r) => (r === data.stage ? '[' + r + ']' : r)).join(' → '));
    const project = registry.projectOf(data);
    if (project) lines.push('project: ' + project);
    const claims = registry.claimsOf(data);
    if (claims.length) lines.push('touched: ' + claims.join(', '));
    // Only the stages this route holds, in the order it runs them, and only the
    // ones sampled more than once. A stage with one sighting has no distance to
    // report and is left out rather than shown as zero.
    const burn = route.map((r) => [r, registry.burnOf(data, r)]).filter((pair) => pair[1]);
    if (burn.length) lines.push('burn:  ' + burn.map((pair) => pair[0] + ' ' + tokens(pair[1])).join(', '));
    // Same rule as the burn line above: only the stages this route holds, in the
    // order it runs them, and only the ones with a distance to report. The wait
    // is shown inside the total rather than beside it, because it is part of that
    // number and not another one.
    const clock = route.map((r) => [r, registry.clockOf(data, r), registry.waitedOf(data, r)])
        .filter((row) => row[1]);
    if (clock.length) {
        lines.push('time:  ' + clock.map((row) => row[0] + ' ' + mins(row[1])
            + (row[2] ? ' (' + mins(row[2]) + ' waiting)' : '')).join(', '));
    }
    // Always, not only when the field is set. It was a line that appeared when
    // somebody opted in; the same test now hides it on every session running the
    // default, which is the one state worth confirming out loud.
    lines.push('guard: ' + (guardMode(data) || 'off'));
    if (data.next) lines.push('next:  ' + data.next);
    const notes = registry.notesOf(data);
    if (notes.length) {
        lines.push('notes:');
        for (const n of notes) lines.push('  - ' + n);
    }
    lines.push('file:  ' + registry.sessionPath(root, sessionId));
    return lines;
}

// Other live sessions holding a file this one has touched. Said as the badge is
// written rather than waiting for the next prompt, because the statusline is
// where anybody looks for it and the hook only runs on the next one.
//
// Liveness is measured here for the same reason the hook measures it. This is
// the second badge writer, and an unfiltered count paints `clash` off a session
// whose process has already exited — which the next prompt then silently takes
// back. Two writers disagreeing about one neighbour is the contradiction this
// design exists to end, not to relocate.
function collisions(root, sessionId, claims) {
    const out = [];
    const liveState = live.readLive(live.liveConfigDir(), sessionId);
    for (const other of registry.readActive(root)) {
        if (other.sessionId === sessionId) continue;
        if (!live.isLive(liveState, other.sessionId, other.data && other.data.configDir)) continue;
        const shared = overlapPaths(claims, registry.claimsOf(other.data));
        if (shared.length) out.push({ task: other.data.task || 'untitled', shared });
    }
    return out;
}

// The cap on `show --all`. The registry only grows — nothing deletes an entry —
// so an uncapped listing is one that gets longer every week and read less each
// time. Twenty-five is what `scripts/survey.js` caps a section at, and the line
// saying what was cut is copied from it word for word: two listings in one
// project that trail off differently are two things to learn.
const SHOWN = 25;

// `updated` rather than `started`, because it is written on every prompt and so
// says when the task was last worked on, which is what a person scanning a month
// of them is looking for. An absent or unparseable one sorts to the bottom
// instead of throwing: an entry with no timestamp is one nothing ever touched.
const stampOf = (data) => Date.parse(data && data.updated) || 0;

// One line, because there are fifty of these. Date, the stage it reached, what
// it cost, then the task — the task last so the columns before it stay aligned
// however long it runs.
//
// The two figures are sums over the route rather than the per-stage breakdown
// `describe` prints. A breakdown is what you want for the one entry a session
// owns; a listing wants the number you can compare between two rows. Both are
// null for a stage sampled once, so a task too short to be sampled twice shows a
// dash — which is the honest answer where a zero would not be.
function entryLine(data) {
    const route = normaliseRoute(data.route) || FULL_ROUTE;
    const sum = (of) => route.reduce((total, r) => total + (of(data, r) || 0), 0);
    const burned = sum(registry.burnOf);
    const spent = sum(registry.clockOf);
    return [
        String(data.updated || '').slice(0, 10).padEnd(10),
        String(data.stage || '?').padEnd(7),
        (burned ? tokens(burned) : '—').padStart(6),
        (spent ? mins(spent) : '—').padStart(5),
        data.task || 'untitled',
    ].join('  ');
}

function cmdShow(root, opts) {
    const lines = ['fankeel — registry at ' + root];
    const active = registry.readActive(root);
    // `--session` is optional here: without one this is a listing of the whole
    // registry, and there is nothing to be wrong about. With one it is a claim to
    // *be* that session, and a claim no running process backs is exactly what
    // `requireSession` refuses. It is checked here rather than left out because
    // `show` was the first command carrying the wrong id in the session this was
    // built for — a whole command before the entry was written under it.
    const id = opts.session ? requireSession(opts) : null;

    if (!fs.existsSync(registry.stateDir(root))) {
        lines.push('');
        lines.push('No registry here yet. `start` creates one.');
        return lines.join('\n');
    }

    const mine = id ? registry.readSession(root, id) : null;
    lines.push('');
    if (mine && mine.active === true) {
        lines.push('this session:');
        for (const line of describe(root, id, mine)) lines.push('  ' + line);
    } else if (mine) {
        lines.push('this session: an entry that was stood down.');
    } else {
        lines.push('this session: no entry — not in the mode.');
    }

    // The header says live, so the list has to mean it. With no --session there
    // is no id to self-check against, `readLive` reports unknown, and unknown is
    // every entry — the same loud side every other reader of this falls back to.
    //
    // Except for an entry recording a config dir of its own: that one is measured
    // against its own directory, where the self-check here has nothing to say
    // either way. A session in another config dir is the case this list was
    // silently wrong about, so a real answer beats the fallback.
    const liveState = live.readLive(live.liveConfigDir(), id);
    const others = active.filter((e) => e.sessionId !== id
        && live.isLive(liveState, e.sessionId, e.data && e.data.configDir));
    if (others.length) {
        lines.push('');
        lines.push('other live sessions:');
        for (const other of others) {
            const claims = registry.claimsOf(other.data).join(', ');
            const stale = registry.isStale(other.data, Date.now())
                ? '  (last seen ' + registry.ageText(other.data, Date.now()) + ' ago)'
                : '';
            lines.push('  - ' + (other.data.task || 'untitled') + ' @ ' + (other.data.stage || '?')
                + (claims ? '  (touched: ' + claims + ')' : '') + stale);
            lines.push('    ' + other.sessionId);
        }
    }
    // Everything above filters on `active === true`, and nothing in this file
    // ever deletes an entry — `down` and `clear` both deactivate. So a task
    // stood down last month sits in this directory with its route, the stage it
    // reached and what it cost, and until this flag it had no reader anywhere:
    // not `show`, not `/fankeel`, not the injected block.
    //
    // Newest first, which is deliberately not the read order. `readAll` sorts by
    // session id so two runs render the same lines; a person scanning a month of
    // finished tasks wants the recent end, and the id says nothing about when.
    if (opts.all === true) {
        const { entries, unreadable } = registry.readAll(root);
        // Not named `live`: that is the module holding `isLive`, and shadowing it
        // inside a function that measures liveness twenty lines above is a trap
        // for whoever edits this next. These are active entries, which is a
        // different claim — `--all` never asks the operating system anything.
        const open = entries.filter((e) => e.data.active === true).length;
        lines.push('');
        lines.push('every entry:  ' + (entries.length + unreadable) + ' total — '
            + open + ' active, ' + (entries.length - open) + ' stood down, '
            + unreadable + ' unreadable');
        const rows = entries.slice().sort((a, b) => stampOf(b.data) - stampOf(a.data));
        for (const row of rows.slice(0, SHOWN)) lines.push('  ' + entryLine(row.data));
        if (rows.length > SHOWN) {
            lines.push('  ... and ' + (rows.length - SHOWN) + ' more, not listed');
        }
    }
    return lines.join('\n');
}

function cmdStart(root, opts) {
    const id = requireSession(opts);
    const existing = registry.readSession(root, id);
    if (existing && existing.active === true) {
        fail('This session already owns an active task: ' + (existing.task || 'untitled')
            + '\nCarry on, or stand it down first. Starting again would overwrite it.');
    }
    if (!opts.task || !String(opts.task).trim()) fail('--task "<one line>" is required.');

    // Optional, and coarse: it names the repository, which is all `lib/docs.js`
    // ever read out of the field it replaces. The registry root is a legitimate
    // answer and a session opened inside a project already implies one, so an
    // absent project is not a refusal.
    const project = splitScope(opts.project)[0];

    // The route this task will take. Not every task is six stages: a typo fix is
    // `build,verify` and a documentation sweep is `survey,audit,land`. A fixed
    // six makes the progress indicator lie in both directions, so it is chosen
    // per task and only checked for being a route at all.
    // A class is the route said out loud. Both at once is refused rather than
    // ranked: whichever one lost would be a decision the user made and cannot
    // see, and this is the field the progress indicator is drawn from.
    if (opts.class && opts.route) {
        fail('--class or --route, not both. A class already names a route.');
    }
    let route;
    if (opts.class) {
        route = routeForClass(opts.class);
        if (!route) {
            fail('Not a class: ' + opts.class + NL
                + Object.keys(CLASSES).map((c) => '  ' + c + '  ' + CLASSES[c].means).join(NL));
        }
    } else {
        route = opts.route ? normaliseRoute(splitScope(opts.route)) : FULL_ROUTE.slice();
    }
    if (!route) {
        fail('--route must be stages from: ' + STAGE_NAMES.join(', ')
            + NL + 'No repeats, and land last if it is there at all.');
    }

    const stamp = now();
    const data = {
        task: String(opts.task).replace(/\s+/g, ' ').trim(),
        // Dropped from the JSON when undefined, the same way `class` is. No
        // `claims` key at all: nothing has been edited yet, and an empty list
        // written here would be the declaration this replaced under a new name.
        project,
        route,
        class: opts.class ? String(opts.class).trim().toLowerCase() : undefined,
        // Which registry answers "is that session still running". Only this
        // session knows, and a reader under a different CLAUDE_CONFIG_DIR has no
        // way to guess it — without this it judged a running neighbour dead.
        //
        // `liveConfigDir`, not `claudeDir`: this names where the liveness file
        // is, and liveness is read from CLAUDE_CONFIG_DIR. `--claude-dir` moves
        // the badge and nothing else.
        configDir: live.liveConfigDir() || undefined,
        stage: route[0],
        active: true,
        started: stamp,
        updated: stamp,
    };
    // `replace` rather than `update`: this record was built from scratch a few
    // lines up, so there is nothing of anyone else's in the file to preserve.
    // What the lock buys is that a hook firing on the prompt that ran this
    // command waits rather than being overwritten.
    //
    // The already-active check above still sits outside it, so two `start`s for
    // one session id could both pass it. That is a different race and a rarer
    // one — a session cannot run two commands at once — and closing it would
    // mean refusing from inside the lock, where `fail` exits without releasing.
    if (!registry.replace(root, id, data)) fail('Could not write the entry under ' + root);

    // No collision check here, because there is nothing yet to collide. A task
    // holding no file overlaps no file, and the first edit is where the question
    // gets asked — by the guard, before the write, over a path both sides hold.
    showBadge(opts, id, badge.badgeWord(data.stage, false), data);

    const lines = ['fankeel — started, at ' + data.stage
        + (data.class ? '   class: ' + data.class : '')
        + '   route: ' + route.join(' → ')];
    lines.push('');
    for (const line of describe(root, id, data)) lines.push('  ' + line);

    lines.push('');
    lines.push(FIRST_STEP[data.stage] || 'Begin at ' + data.stage + '. Do not stop to ask whether to start.');
    return lines.join('\n');
}

function cmdStage(root, opts) {
    const id = requireSession(opts);
    const name = String(opts.positional[0] || '').toLowerCase();
    if (!stageByName(name)) fail('Not a stage: ' + (name || '(none)') + '. One of: ' + STAGE_NAMES.join(', '));

    // Read, checked and written inside the lock, because a claim landing between
    // the read and the write used to be put back the way it was. `refuse` rather
    // than `fail` in there: `fail` exits the process, `process.exit` does not run
    // a `finally`, and the lock directory would outlive the command by the five
    // seconds it takes the next writer to judge it abandoned.
    let refuse = null;
    let data = null;
    let from = null;
    let route = null;
    const wrote = registry.update(root, id, (d) => {
        if (d.active !== true) { refuse = 'No active entry for this session under ' + root; return false; }

        // A stage off the route is refused rather than silently added. The route
        // was agreed at Start, and a task that quietly grew two stages is a task
        // whose progress nobody can read.
        route = normaliseRoute(d.route) || FULL_ROUTE;
        if (!route.includes(name)) {
            refuse = '`' + name + '` is not on the route for this task: ' + route.join(' → ')
                + NL + 'Re-route with `route` if the task really changed shape.';
            return false;
        }

        from = d.stage;
        d.stage = name;
        data = d;
        return true;
    });
    if (refuse) fail(refuse);
    if (!data) fail('No active entry for this session under ' + root);
    if (!wrote) fail('Could not write the entry.');
    const clash = collisions(root, id, registry.claimsOf(data));
    showBadge(opts, id, badge.badgeWord(name, clash.length > 0), Object.assign({ others: clash.length }, data));

    // What the stage just left cost, said at the one moment it is a finished
    // number. It goes here rather than into the injected block because `build`
    // already renders at 2394 characters against a cap of 2400, and a figure
    // nobody can read is worse than one printed where the move is announced.
    const at = positionIn(route, name);
    const spent = registry.burnOf(data, from);
    const took = registry.clockOf(data, from);
    const held = registry.waitedOf(data, from);
    return 'fankeel — ' + from + ' to ' + name + (at ? '   ' + at.step + ' of ' + at.steps : '')
        + (spent ? '   ' + from + ' burned ' + tokens(spent) : '')
        + (took ? '   ' + from + ' took ' + mins(took)
            + (held ? ', ' + mins(held) + ' of it at the gate' : '') : '');
}

// A new task on a session that already has one. `down` then `start` was the only
// reset and it worked by accident of `start` building a fresh object — so a task
// renamed in place kept notes about work that finished, a `next` nobody would
// take, and claims on files the new task never opens.
//
// `started` is kept. It is the collision tie-break, and the question it answers —
// which of two sessions reached this repository first — is not re-opened by
// renaming what that session is doing there.
function cmdTask(root, opts) {
    const id = requireSession(opts);
    const text = opts.positional.join(' ').replace(/\s+/g, ' ').trim();
    if (!text) fail('Give the new task, in one line.');

    // Under the lock, and this is the command with the most to lose to a claim
    // arriving mid-write: it is clearing the claim list on purpose, so an
    // unlocked read-modify-write here could keep exactly the one path the clear
    // was meant to drop.
    let data = null;
    let active = false;
    const wrote = registry.update(root, id, (d) => {
        if (d.active !== true) return false;
        active = true;

        d.task = text;
        delete d.claims;
        // `claims` falls back to `scope` on a record written before the split, so
        // a clear that dropped only the new key would leave the old list holding.
        delete d.scope;
        delete d.notes;
        delete d.next;
        // The stage names come round again, so a burn left here would give the
        // new task the old one's first sighting and report the difference
        // between two tasks as the cost of one stage.
        delete d.burn;
        // The same argument, and the same failure if they are left: a clock here
        // dates the new task's stage from the old one's, and a `gateAt` left open
        // bills the rename to whatever stage the next answer lands in.
        delete d.clock;
        delete d.waited;
        delete d.gateAt;
        const route = normaliseRoute(d.route) || FULL_ROUTE.slice();
        d.route = route;
        d.stage = route[0];
        data = d;
        return true;
    });
    if (!active) {
        fail('No active entry for this session under ' + root
            + NL + '`start --task "<one line>"` begins one.');
    }
    if (!wrote) fail('Could not write the entry.');

    // Holding nothing, so overlapping nothing.
    showBadge(opts, id, badge.badgeWord(data.stage, false), data);

    return 'fankeel — task: ' + text
        + NL + '           at ' + data.stage + ', holding nothing.'
        + NL + (FIRST_STEP[data.stage] || 'Begin at ' + data.stage + '.');
}

function cmdNote(root, opts) {
    const id = requireSession(opts);
    const text = opts.positional.join(' ');
    if (!text.trim()) fail('Give the note.');
    if (!registry.addNote(root, id, text)) fail('No active entry for this session under ' + root);
    const data = registry.readSession(root, id);
    return 'fankeel — noted. ' + registry.notesOf(data).length + ' of ' + registry.MAX_NOTES + ' kept.';
}

function cmdNext(root, opts) {
    const id = requireSession(opts);
    const text = opts.positional.join(' ');
    if (!registry.setNext(root, id, text)) fail('No entry for this session under ' + root);
    return text.trim() ? 'fankeel — next: ' + registry.nextOf(registry.readSession(root, id)) : 'fankeel — next cleared.';
}

// Invariant 7: never on this script's own initiative, so the value is always
// something the caller passed.
//
// `off` used to delete the field rather than store a third value the guard would
// have to interpret. That was right while the field's absence meant off and
// deleting it said the same thing twice. Since 2026-08-30 absence means `ask`,
// so off is the one mode that has nothing else to be written as, and the write
// is what carries it.
function cmdGuard(root, opts) {
    const id = requireSession(opts);
    const mode = String(opts.positional[0] || '').toLowerCase();
    if (!GUARDS.includes(mode)) fail('Guard is one of: ' + GUARDS.join(', '));

    let data = null;
    const wrote = registry.update(root, id, (d) => {
        if (d.active !== true) return false;
        d.guard = mode;
        data = d;
        return true;
    });
    if (!data) fail('No active entry for this session under ' + root);
    if (!wrote) fail('Could not write the entry.');

    // The mode is a field on the lead line, so this is the one command whose own
    // change the statusline shows — and it was the one command that did not
    // write it. The refresh rode the next `stage` or the next prompt, and until
    // one came the line named the mode that had just been replaced.
    //
    // The collision count is asked for rather than passed as `false`: `start`
    // and `task` may hardcode it because a task holding nothing overlaps
    // nothing, but this runs mid-task over files already claimed. Skipping it
    // would take a live `clash` off the statusline as a side effect of setting
    // the mode that exists to make collisions louder.
    const clash = collisions(root, id, registry.claimsOf(data));
    showBadge(opts, id, badge.badgeWord(data.stage, clash.length > 0), Object.assign({ others: clash.length }, data));

    return 'fankeel — guard: ' + (data.guard === 'off' ? 'off (warning only)' : data.guard);
}

// Invariant 5: standing down sets a flag, it never deletes. The entry is the
// only record that this task existed, and a task nobody can look back at is how
// the same dead end gets walked into twice.
function cmdDown(root, opts) {
    const id = requireSession(opts);
    let data = null;
    let already = false;
    const wrote = registry.update(root, id, (d) => {
        data = d;
        if (d.active !== true) { already = true; return false; }
        d.active = false;
        return true;
    });
    if (!data) fail('No entry for this session under ' + root);
    if (already) return 'fankeel — already stood down.';
    if (!wrote) fail('Could not write the entry.');
    hideBadge(opts, id);

    const lines = ['fankeel — stood down: ' + (data.task || 'untitled')];
    const notes = registry.notesOf(data);
    if (notes.length) {
        lines.push('');
        lines.push('These die with the task. Anything still true belongs in CLAUDE.md, a commit message or TODO.md:');
        for (const n of notes) lines.push('  - ' + n);
    }
    return lines.join('\n');
}

// The one place another session's file is written, and it is deactivated in the
// same run rather than left for a second step that might not happen.
function cmdAdopt(root, opts) {
    const id = requireSession(opts);
    const from = opts.positional[0];
    if (!from) fail('Give the session id to adopt from.');
    if (from === id) fail('That is this session.');

    const source = registry.readSession(root, from);
    if (!source) fail('No entry for ' + from + ' under ' + root);

    const mine = registry.readSession(root, id);
    if (mine && mine.active === true) fail('This session already owns an active task. Stand it down first.');

    const stamp = now();
    const claims = registry.claimsOf(source);
    const adoptedRoute = normaliseRoute(source.route) || FULL_ROUTE.slice();
    const data = {
        task: source.task,
        project: registry.projectOf(source) || undefined,
        claims: claims.length ? claims : undefined,
        route: adoptedRoute,
        // Derived rather than copied from `source.class`: a class copied across
        // can name a route the record does not have, which is this defect one
        // session sideways.
        class: classForRoute(adoptedRoute) || undefined,
        stage: source.stage || 'survey',
        // This session's, not the source's. The task moves between sessions and
        // the directory belongs to the session — the one giving it up may
        // already have exited.
        configDir: live.liveConfigDir() || undefined,
        active: true,
        // The source's, not this stamp. `started` is the tie-break, and adopting
        // transfers the work rather than re-answering which session reached these
        // files first: re-stamping it lost that answer permanently, so a session
        // inheriting three days of work yielded to a task opened a minute ago.
        started: source.started || stamp,
        updated: stamp,
    };
    if (source.notes) data.notes = source.notes;
    if (source.next) data.next = source.next;
    if (source.guard) data.guard = source.guard;
    // Two records, two locks, and no way to make the pair atomic — which is why
    // the failure below names the state it can leave behind rather than
    // pretending it cannot happen. Each side is atomic on its own, which is the
    // part that was missing.
    if (!registry.replace(root, id, data)) fail('Could not write this session\'s entry.');

    // The source's badge goes too. Reaching into another session's state is
    // already what adopt is, and a badge still reading `build` for a task this
    // session took over is the statusline telling that window a lie it has no
    // way to notice.
    hideBadge(opts, from);
    if (!registry.update(root, from, (d) => { d.active = false; })) {
        fail('Adopted, but could not stand the source down. Two sessions now claim these files — stand ' + from + ' down by hand.');
    }

    const adoptClash = collisions(root, id, claims);
    showBadge(opts, id, badge.badgeWord(data.stage, adoptClash.length > 0), Object.assign({ others: adoptClash.length }, data));

    const lines = ['fankeel — adopted: ' + (data.task || 'untitled') + ' @ ' + data.stage];
    lines.push('  ' + from + ' is now stood down.');
    lines.push('');
    for (const line of describe(root, id, data)) lines.push('  ' + line);
    return lines.join('\n');
}

// The second place another session's file is written, and the smaller one.
// `adopt` takes a task over; this only puts a claim down. Wanting a stale badge
// gone is not wanting somebody else's work.
//
// It never deletes. `cmdAdopt` reads a source entry without requiring it to be
// active, so a claim cleared by mistake can still be adopted back with its notes
// and its `next` intact.
function cmdClear(root, opts) {
    const id = requireSession(opts);
    const target = opts.positional[0];
    if (!target) fail('Give the session id to clear.');
    if (target === id) fail('That is this session. Use `down`, which prints the notes that are about to die.');
    if (!registry.sessionPath(root, target)) fail('Not a session id: ' + target);

    const data = registry.readSession(root, target);
    if (!data) fail('No entry for ' + target + ' under ' + root);
    if (data.active !== true) return 'fankeel — already stood down.';

    // Age, not liveness, and the difference is deliberate — `docs/collisions.md`
    // keeps this gate on the clock. A recent timestamp is the one sign that the
    // owner may simply have stepped away, which is the case the refusal protects,
    // and --force is there for the one the reader can see and the registry cannot:
    // a terminal that died four minutes ago. `lib/live.js` is the evidence about
    // whether anybody is behind a claim, and it is deliberately not read here, so
    // a live session quiet all day is cleared without --force. Ask before deny,
    // the same as `guard`.
    const at = Date.now();
    if (!registry.isStale(data, at) && opts.force !== true) {
        const age = registry.ageText(data, at);
        fail('That entry was last seen ' + (age ? age + ' ago' : 'recently') + ': '
            + (data.task || 'untitled') + ' @ ' + (data.stage || '?')
            + NL + 'Pass --force if you know the terminal is gone.');
    }

    // The staleness gate above ran on the read a moment ago; the write itself
    // goes under the target's lock, so a hook of theirs that is still firing has
    // its claim kept rather than rolled back by this deactivation.
    if (!registry.update(root, target, (d) => { d.active = false; })) fail('Could not write the entry.');
    hideBadge(opts, target);

    // Prose rather than a command, because the command would not run for the
    // caller who typically types this one: `adopt` refuses a session that already
    // owns an active task, and a session tidying up other claims usually does.
    return 'fankeel — cleared: ' + (data.task || 'untitled') + ' @ ' + (data.stage || '?')
        + NL + 'That badge is down. This one is not: the clash clears on the next prompt.'
        + NL + 'The entry is still there, notes and all, and `adopt` takes the task back —'
        + NL + 'from a session owning no active task of its own, which is the only caller'
        + NL + 'it accepts.';
}

// Re-routing is a separate command from `stage` on purpose. Moving along a route
// is routine; changing what the route *is* is a decision about the shape of the
// task, and the two should not be one keystroke apart.
function cmdRoute(root, opts) {
    const id = requireSession(opts);
    // Read once for the two refusals below, which have to print before anything
    // is written, then re-read under the lock for the write itself. `data` is
    // reassigned there so the badge and the return line describe what landed.
    let data = registry.readSession(root, id);
    if (!data || data.active !== true) fail('No active entry for this session under ' + root);

    const given = normaliseRoute(splitScope(opts.positional[0] || opts.route));
    if (!given) {
        fail('A route is stages from: ' + STAGE_NAMES.join(', ')
            + NL + 'No repeats, and land last if it is there at all.');
    }
    // The stage this task is actually in has to survive the change, or the badge
    // would show a stage the route does not contain and no progress could be
    // read from either.
    if (!given.includes(data.stage)) {
        fail('This task is at `' + data.stage + '`, which that route does not contain.'
            + NL + 'Move to a stage on the new route first, or include it.');
    }

    const before = normaliseRoute(data.route) || FULL_ROUTE;
    const wrote = registry.update(root, id, (d) => {
        d.route = given;
        // The class is the route said out loud, and it is injected on every
        // prompt. Left behind, it describes stages the new route does not
        // contain.
        const cls = classForRoute(given);
        if (cls) d.class = cls;
        else delete d.class;
        data = d;
    });
    if (!wrote) fail('Could not write the entry.');
    const clash = collisions(root, id, registry.claimsOf(data));
    showBadge(opts, id, badge.badgeWord(data.stage, clash.length > 0), Object.assign({ others: clash.length }, data));

    const at = positionIn(given, data.stage);
    const shown = 'fankeel — route: ' + before.join(' → ') + NL + '           now: ' + given.join(' → ');
    if (!at) return shown;
    return shown + NL + '           at ' + data.stage + ', ' + at.step + ' of ' + at.steps;
}

const COMMANDS = {
    show: cmdShow,
    route: cmdRoute,
    start: cmdStart,
    stage: cmdStage,
    task: cmdTask,
    note: cmdNote,
    next: cmdNext,
    guard: cmdGuard,
    down: cmdDown,
    adopt: cmdAdopt,
    clear: cmdClear,
};

const USAGE = [
    'fankeel task — the registry entry for this session.',
    '',
    '  show [--all]                      what this session owns, and who else is live;',
    '                                    --all adds every entry the registry holds,',
    '                                    stood down included, newest first',
    '  start --task "..." [--project <dir>] [--route "survey,build,verify"]',
    '                                    begin, at the first stage of the route',
    '  task "..."                        a new task here: clears claims, notes and next',
    '  stage <name>                      move along the route',
    '  route "a,b,c"                     re-route a task that changed shape',
    '  note "..."                        a dead end or a decision, capped at five',
    '  next "..."                        one line; empty clears it',
    '  guard <ask|deny|off>              only when the user asked for it',
    '  down                              stand the task down; never deletes',
    '  adopt <session-id>                take another entry over, standing it down',
    '  clear <session-id> [--force]      put down a claim nobody is behind; never deletes',
    '',
    'Every command takes --session <id>, and --root <dir> to override where the',
    'registry is. Without --root it is found the way the hooks find it: the nearest',
    '.fankeel above the working directory, or the working directory itself.',
    '',
    'start, task, stage, adopt and down set the badge for this session, so it is',
    'there on this turn rather than on the next prompt. The hook keeps it current',
    'from then on.',
    '',
    'clear is the exception. It takes the badge down on the session being cleared',
    'and never touches this one, so a clash it resolves goes on showing until the',
    'next prompt.',
].join('\n');

// The commands, as the split reads them. `COMMANDS` is already the list, so
// taking the keys is what keeps a second copy from existing — the same reason
// `scripts/ledger.js` keeps one set for its four verbs.
const VERBS = new Set(Object.keys(COMMANDS));

function main(argv) {
    // Flags at either end, the user's words in between. `task.js` puts its flags
    // *after* the verb, so `--session` is never the note and a note beginning
    // `--root=` is never the registry: the parser is handed the flags alone and
    // the words are never offered to it.
    const { head, verb: name, text } = splitAroundVerb(argv, STRING_FLAGS, VERBS);
    const opts = parseArgs(head, argv);
    opts.positional = text;
    if (!name || name === 'help') return USAGE;

    const command = COMMANDS[name];
    if (!command) fail('No such command: ' + name + '\n\n' + USAGE);

    return command(rootOf(opts), opts);
}

if (require.main === module) {
    process.stdout.write(main(process.argv.slice(2)) + '\n');
}
