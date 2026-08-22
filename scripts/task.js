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

const registry = require('../lib/registry.js');
const badge = require('../lib/badge.js');
const { overlapPaths } = require('../lib/overlap.js');
const { byName: stageByName, NAMES: STAGE_NAMES, FULL_ROUTE, CLASSES, normaliseRoute, positionIn, routeForClass } = require('../lib/stages.js');

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
            where: Array.isArray(data.scope) ? data.scope.join(' ') : '',
            guard: data.guard,
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

function parseArgs(argv) {
    const opts = { positional: [] };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--session' || arg === '--root' || arg === '--task' || arg === '--scope' || arg === '--class') {
            if (argv[i + 1] === undefined) fail(arg + ' needs a value.');
            opts[arg.slice(2)] = argv[++i];
            continue;
        }
        if (arg === '--route') {
            if (argv[i + 1] === undefined) fail('--route needs a value.');
            opts.route = argv[++i];
            continue;
        }
        if (arg === '--claude-dir') {
            if (argv[i + 1] === undefined) fail('--claude-dir needs a value.');
            opts.claudeDir = argv[++i];
            continue;
        }
        if (arg === '--add') {
            opts.add = true;
            continue;
        }
        if (arg === '--force') {
            opts.force = true;
            continue;
        }
        if (arg.startsWith('--')) continue;
        opts.positional.push(arg);
    }
    return opts;
}

// The root the hooks would resolve, resolved the same way. Two answers here
// would be two registries, and the one the user is shown would not be the one
// the badge reads.
function rootOf(opts) {
    if (opts.root) return path.resolve(opts.root);
    return registry.rootFor({ cwd: process.cwd() });
}

function requireSession(opts) {
    const id = opts.session;
    if (!id) fail('--session <id> is required. Read it from the transcript path; never guess it.');
    if (!registry.sessionPath(process.cwd(), id)) fail('Not a session id: ' + id);
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
    if (Array.isArray(data.scope) && data.scope.length) lines.push('scope: ' + data.scope.join(', '));
    if (data.guard) lines.push('guard: ' + data.guard);
    if (data.next) lines.push('next:  ' + data.next);
    const notes = registry.notesOf(data);
    if (notes.length) {
        lines.push('notes:');
        for (const n of notes) lines.push('  - ' + n);
    }
    lines.push('file:  ' + registry.sessionPath(root, sessionId));
    return lines;
}

// Other live sessions whose scope this one's would touch. Said at the moment the
// scope is written rather than waiting for the next prompt, because that is the
// moment the user can still choose a different one.
function collisions(root, sessionId, scope) {
    const out = [];
    for (const other of registry.readActive(root)) {
        if (other.sessionId === sessionId) continue;
        const shared = overlapPaths(scope, (other.data && other.data.scope) || []);
        if (shared.length) out.push({ task: other.data.task || 'untitled', shared });
    }
    return out;
}

function cmdShow(root, opts) {
    const lines = ['fankeel — registry at ' + root];
    const active = registry.readActive(root);
    const id = opts.session;

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

    const others = active.filter((e) => e.sessionId !== id);
    if (others.length) {
        lines.push('');
        lines.push('other live sessions:');
        for (const other of others) {
            const scope = Array.isArray(other.data.scope) ? other.data.scope.join(', ') : '';
            const stale = registry.isStale(other.data, Date.now())
                ? '  (last seen ' + registry.ageText(other.data, Date.now()) + ' ago)'
                : '';
            lines.push('  - ' + (other.data.task || 'untitled') + ' @ ' + (other.data.stage || '?')
                + (scope ? '  (scope: ' + scope + ')' : '') + stale);
            lines.push('    ' + other.sessionId);
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

    const scope = splitScope(opts.scope);
    // Invariant 3, enforced rather than asked for. A guessed scope produces false
    // collision warnings, and two of those are enough for the real one to be
    // ignored.
    if (!scope.length) fail('--scope is required. Ask for it; a directory is a complete answer. Never invent it.');

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
        scope,
        route,
        class: opts.class ? String(opts.class).trim().toLowerCase() : undefined,
        stage: route[0],
        active: true,
        started: stamp,
        updated: stamp,
    };
    if (!registry.writeSession(root, id, data)) fail('Could not write the entry under ' + root);

    const clash = collisions(root, id, scope);
    showBadge(opts, id, badge.badgeWord(data.stage, clash.length > 0), Object.assign({ others: clash.length }, data));

    const lines = ['fankeel — started, at ' + data.stage
        + (data.class ? '   class: ' + data.class : '')
        + '   route: ' + route.join(' → ')];
    lines.push('');
    for (const line of describe(root, id, data)) lines.push('  ' + line);
    if (clash.length) {
        lines.push('');
        lines.push('already claimed by another live session:');
        for (const c of clash) lines.push('  - ' + c.task + '  << ' + c.shared.join(', '));
        lines.push('Say so before editing those files.');
    }

    lines.push('');
    lines.push(FIRST_STEP[data.stage] || 'Begin at ' + data.stage + '. Do not stop to ask whether to start.');
    return lines.join('\n');
}

function cmdStage(root, opts) {
    const id = requireSession(opts);
    const name = String(opts.positional[0] || '').toLowerCase();
    if (!stageByName(name)) fail('Not a stage: ' + (name || '(none)') + '. One of: ' + STAGE_NAMES.join(', '));

    const data = registry.readSession(root, id);
    if (!data || data.active !== true) fail('No active entry for this session under ' + root);

    // A stage off the route is refused rather than silently added. The route was
    // agreed at Start, and a task that quietly grew two stages is a task whose
    // progress nobody can read.
    const route = normaliseRoute(data.route) || FULL_ROUTE;
    if (!route.includes(name)) {
        fail('`' + name + '` is not on the route for this task: ' + route.join(' → ')
            + NL + 'Re-route with `route` if the task really changed shape.');
    }

    const from = data.stage;
    data.stage = name;
    if (!registry.writeSession(root, id, data)) fail('Could not write the entry.');
    const clash = collisions(root, id, data.scope || []);
    showBadge(opts, id, badge.badgeWord(name, clash.length > 0), Object.assign({ others: clash.length }, data));

    const at = positionIn(route, name);
    return 'fankeel — ' + from + ' to ' + name + (at ? '   ' + at.step + ' of ' + at.steps : '');
}

function cmdScope(root, opts) {
    const id = requireSession(opts);
    const data = registry.readSession(root, id);
    if (!data || data.active !== true) fail('No active entry for this session under ' + root);

    const given = splitScope(opts.positional[0] || opts.scope);
    if (!given.length) fail('Give the paths, comma separated.');

    const before = Array.isArray(data.scope) ? data.scope : [];
    data.scope = opts.add ? before.concat(given.filter((s) => !before.includes(s))) : given;
    if (!registry.writeSession(root, id, data)) fail('Could not write the entry.');

    const clash = collisions(root, id, data.scope);
    showBadge(opts, id, badge.badgeWord(data.stage, clash.length > 0), Object.assign({ others: clash.length }, data));

    const lines = ['fankeel — scope: ' + data.scope.join(', ')];
    if (clash.length) {
        lines.push('');
        lines.push('now overlapping:');
        for (const c of clash) lines.push('  - ' + c.task + '  << ' + c.shared.join(', '));
    }
    return lines.join('\n');
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
// something the caller passed. `off` removes the field rather than storing a
// third value the guard would have to interpret.
function cmdGuard(root, opts) {
    const id = requireSession(opts);
    const mode = String(opts.positional[0] || '').toLowerCase();
    if (!GUARDS.includes(mode)) fail('Guard is one of: ' + GUARDS.join(', '));

    const data = registry.readSession(root, id);
    if (!data || data.active !== true) fail('No active entry for this session under ' + root);
    if (mode === 'off') delete data.guard;
    else data.guard = mode;
    if (!registry.writeSession(root, id, data)) fail('Could not write the entry.');
    return 'fankeel — guard: ' + (data.guard || 'off (warning only)');
}

// Invariant 5: standing down sets a flag, it never deletes. The entry is the
// only record that this task existed, and a task nobody can look back at is how
// the same dead end gets walked into twice.
function cmdDown(root, opts) {
    const id = requireSession(opts);
    const data = registry.readSession(root, id);
    if (!data) fail('No entry for this session under ' + root);
    if (data.active !== true) return 'fankeel — already stood down.';
    data.active = false;
    if (!registry.writeSession(root, id, data)) fail('Could not write the entry.');
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
    const data = {
        task: source.task,
        scope: Array.isArray(source.scope) ? source.scope : [],
        route: normaliseRoute(source.route) || FULL_ROUTE.slice(),
        stage: source.stage || 'survey',
        active: true,
        started: stamp,
        updated: stamp,
    };
    if (source.notes) data.notes = source.notes;
    if (source.next) data.next = source.next;
    if (source.guard) data.guard = source.guard;
    if (source.drift) data.drift = source.drift;
    if (!registry.writeSession(root, id, data)) fail('Could not write this session\'s entry.');

    source.active = false;
    // The source's badge goes too. Reaching into another session's state is
    // already what adopt is, and a badge still reading `build` for a task this
    // session took over is the statusline telling that window a lie it has no
    // way to notice.
    hideBadge(opts, from);
    if (!registry.writeSession(root, from, source)) {
        fail('Adopted, but could not stand the source down. Two sessions now claim these files — stand ' + from + ' down by hand.');
    }

    const adoptClash = collisions(root, id, data.scope);
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

    // Twelve hours of silence is the only evidence the registry has that nobody
    // is behind a claim, and below that the entry may belong to somebody who
    // stepped away. So the refusal names what it is protecting, and --force is
    // there for the case the reader can see and the registry cannot: a terminal
    // that died four minutes ago. Ask before deny, the same as `guard`.
    const at = Date.now();
    if (!registry.isStale(data, at) && opts.force !== true) {
        const age = registry.ageText(data, at);
        fail('That entry was last seen ' + (age ? age + ' ago' : 'recently') + ': '
            + (data.task || 'untitled') + ' @ ' + (data.stage || '?')
            + NL + 'Pass --force if you know the terminal is gone.');
    }

    data.active = false;
    if (!registry.writeSession(root, target, data)) fail('Could not write the entry.');
    hideBadge(opts, target);

    return 'fankeel — cleared: ' + (data.task || 'untitled') + ' @ ' + (data.stage || '?')
        + NL + 'The entry is still there. `adopt ' + target + '` takes the task back, notes and all.';
}

// Re-routing is a separate command from `stage` on purpose. Moving along a route
// is routine; changing what the route *is* is a decision about the shape of the
// task, and the two should not be one keystroke apart.
function cmdRoute(root, opts) {
    const id = requireSession(opts);
    const data = registry.readSession(root, id);
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
    data.route = given;
    if (!registry.writeSession(root, id, data)) fail('Could not write the entry.');
    const clash = collisions(root, id, data.scope || []);
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
    scope: cmdScope,
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
    '  show                              what this session owns, and who else is live',
    '  start --task "..." --scope "a,b" [--route "survey,build,verify"]',
    '                                    begin, at the first stage of the route',
    '  stage <name>                      move along the route',
    '  route "a,b,c"                     re-route a task that changed shape',
    '  scope "a,b" [--add]               replace, or add to, the declared paths',
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
    'start, stage, scope, adopt, down and clear also set the statusline badge, so it is',
    'there on this turn rather than on the next prompt. The hook keeps it current',
    'from then on.',
].join('\n');

function main(argv) {
    const opts = parseArgs(argv);
    const name = opts.positional.shift();
    if (!name || name === 'help') return USAGE;

    const command = COMMANDS[name];
    if (!command) fail('No such command: ' + name + '\n\n' + USAGE);
    return command(rootOf(opts), opts);
}

if (require.main === module) {
    process.stdout.write(main(process.argv.slice(2)) + '\n');
}

module.exports = { main, parseArgs, splitScope, COMMANDS, USAGE };
