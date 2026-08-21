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
const { overlapPaths } = require('../lib/overlap.js');
const { byName: stageByName, NAMES: STAGE_NAMES } = require('../lib/stages.js');

const GUARDS = ['ask', 'deny', 'off'];

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
        if (arg === '--session' || arg === '--root' || arg === '--task' || arg === '--scope') {
            if (argv[i + 1] === undefined) fail(arg + ' needs a value.');
            opts[arg.slice(2)] = argv[++i];
            continue;
        }
        if (arg === '--add') {
            opts.add = true;
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
    lines.push('stage: ' + (data.stage || '?') + (data.active === true ? '' : '  (stood down)'));
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

    const stamp = now();
    const data = {
        task: String(opts.task).replace(/\s+/g, ' ').trim(),
        scope,
        stage: 'survey',
        active: true,
        started: stamp,
        updated: stamp,
    };
    if (!registry.writeSession(root, id, data)) fail('Could not write the entry under ' + root);

    const lines = ['fankeel — started, at survey'];
    lines.push('');
    for (const line of describe(root, id, data)) lines.push('  ' + line);

    const clash = collisions(root, id, scope);
    if (clash.length) {
        lines.push('');
        lines.push('already claimed by another live session:');
        for (const c of clash) lines.push('  - ' + c.task + '  << ' + c.shared.join(', '));
        lines.push('Say so before editing those files.');
    }

    lines.push('');
    lines.push('The badge appears on the next prompt — the hook writes it, not this.');
    lines.push('Now survey: read what orient named, then run the scanner. Do not stop to ask first.');
    return lines.join('\n');
}

function cmdStage(root, opts) {
    const id = requireSession(opts);
    const name = String(opts.positional[0] || '').toLowerCase();
    if (!stageByName(name)) fail('Not a stage: ' + (name || '(none)') + '. One of: ' + STAGE_NAMES.join(', '));

    const data = registry.readSession(root, id);
    if (!data || data.active !== true) fail('No active entry for this session under ' + root);
    const from = data.stage;
    data.stage = name;
    if (!registry.writeSession(root, id, data)) fail('Could not write the entry.');
    return 'fankeel — ' + from + ' to ' + name + '\nThe badge follows on the next prompt.';
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

    const lines = ['fankeel — scope: ' + data.scope.join(', ')];
    const clash = collisions(root, id, data.scope);
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
        stage: source.stage || 'survey',
        active: true,
        started: stamp,
        updated: stamp,
    };
    if (source.notes) data.notes = source.notes;
    if (source.next) data.next = source.next;
    if (source.guard) data.guard = source.guard;
    if (!registry.writeSession(root, id, data)) fail('Could not write this session\'s entry.');

    source.active = false;
    if (!registry.writeSession(root, from, source)) {
        fail('Adopted, but could not stand the source down. Two sessions now claim these files — stand ' + from + ' down by hand.');
    }

    const lines = ['fankeel — adopted: ' + (data.task || 'untitled') + ' @ ' + data.stage];
    lines.push('  ' + from + ' is now stood down.');
    lines.push('');
    for (const line of describe(root, id, data)) lines.push('  ' + line);
    return lines.join('\n');
}

const COMMANDS = {
    show: cmdShow,
    start: cmdStart,
    stage: cmdStage,
    scope: cmdScope,
    note: cmdNote,
    next: cmdNext,
    guard: cmdGuard,
    down: cmdDown,
    adopt: cmdAdopt,
};

const USAGE = [
    'fankeel task — the registry entry for this session.',
    '',
    '  show                              what this session owns, and who else is live',
    '  start --task "..." --scope "a,b"  begin, at survey',
    '  stage <survey|design|build|verify|land>',
    '  scope "a,b" [--add]               replace, or add to, the declared paths',
    '  note "..."                        a dead end or a decision, capped at five',
    '  next "..."                        one line; empty clears it',
    '  guard <ask|deny|off>              only when the user asked for it',
    '  down                              stand the task down; never deletes',
    '  adopt <session-id>                take another entry over, standing it down',
    '',
    'Every command takes --session <id>, and --root <dir> to override where the',
    'registry is. Without --root it is found the way the hooks find it: the nearest',
    '.fankeel above the working directory, or the working directory itself.',
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
