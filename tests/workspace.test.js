'use strict';

// The three hooks, run as processes, against the shape this plugin was extended
// for: one registry at a directory that holds several projects.
//
// Every other test file takes one piece at a time and gives it a root that is
// also the project. That is the easy configuration and it was never the one at
// risk. The one at risk is a session opened inside `workspace/Waypoint` while
// the registry lives at `workspace`, where a path is relative to one directory
// and read from another — and where getting it wrong means the collision warning
// silently never fires, which is indistinguishable from there being no collision.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const HOOKS = path.join(__dirname, '..', 'hooks');
const INJECT = path.join(HOOKS, 'inject.js');
const GUARD = path.join(HOOKS, 'guard.js');
const BRIEF = path.join(HOOKS, 'brief.js');

const A = 'aaaaaaaa-1111-2222-3333-444444444444';
const B = 'bbbbbbbb-1111-2222-3333-444444444444';

// Two projects under one root, the root itself being no kind of project. This is
// what a working directory of related repositories actually looks like, and it is
// the case `git ls-files` alone could not see.
function workspace() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-ws-'));
    for (const rel of [
        'Waypoint/web/src/App.jsx',
        'Waypoint/web/src/Card.jsx',
        'Waypoint/api/app/routes.py',
        'TypeDesk/web/src/App.jsx',
    ]) {
        const full = path.join(root, rel);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, 'x\n');
    }
    fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
    fs.mkdirSync(path.join(root, 'cfg'), { recursive: true });
    return root;
}

function entry(root, sessionId, data) {
    const now = new Date().toISOString();
    fs.writeFileSync(
        path.join(root, '.fankeel', 'sessions', sessionId + '.json'),
        JSON.stringify(Object.assign({ active: true, stage: 'build', started: now, updated: now }, data), null, 2),
    );
}

// `launch` is where Claude Code was opened, which is deliberately not always the
// root. CLAUDE_PROJECT_DIR is set because that is what a real session has, and it
// is the value the walk-up starts from.
function hook(script, root, payload, launch) {
    const from = launch || root;
    const out = execFileSync(process.execPath, [script], {
        input: JSON.stringify(Object.assign({ cwd: from }, payload)),
        encoding: 'utf8',
        env: Object.assign({}, process.env, {
            CLAUDE_PROJECT_DIR: from,
            CLAUDE_CONFIG_DIR: path.join(root, 'cfg'),
        }),
    });
    return out.trim() ? JSON.parse(out) : null;
}

const context = (res) => (res && res.hookSpecificOutput && res.hookSpecificOutput.additionalContext) || '';
const badge = (root, sessionId) => {
    try {
        return fs.readFileSync(path.join(root, "cfg", "modes", sessionId, "fankeel"), "utf8").trim();
    } catch (e) {
        return null;
    }
};

test('a session opened inside a project finds the registry above it', () => {
    const root = workspace();
    entry(root, A, { task: 'tidy the project cards', scope: ['Waypoint/web'] });

    const res = hook(INJECT, root, { session_id: A }, path.join(root, 'Waypoint'));
    const text = context(res);

    assert.match(text, /FANKEEL ACTIVE — tidy the project cards @ build/);
    assert.match(text, /scope: Waypoint\/web/);
    // The one line that stops a scope path being read against the wrong
    // directory. Without it `Waypoint/web` looks wrong from inside Waypoint.
    assert.match(text, /registry: /);
    assert.match(text, /this session opened in /);
});

test('opened at the root itself, the registry line is not printed', () => {
    const root = workspace();
    entry(root, A, { task: 'tidy the project cards', scope: ['Waypoint/web'] });
    assert.doesNotMatch(context(hook(INJECT, root, { session_id: A })), /registry: /);
});

test('the badge carries the stage, and turns to clash when scopes touch', () => {
    const root = workspace();
    entry(root, A, { task: 'tidy the project cards', scope: ['Waypoint/web'], stage: 'survey' });

    hook(INJECT, root, { session_id: A });
    assert.equal(badge(root, A), 'survey');

    // A directory claim and a file claim under it are the same collision. This is
    // the case a naive string compare misses entirely.
    entry(root, B, { task: 'fix the card link', scope: ['Waypoint/web/src/Card.jsx'] });
    const text = context(hook(INJECT, root, { session_id: A }));

    assert.match(text, /also in progress:/);
    assert.match(text, /fix the card link/);
    assert.match(text, /<< overlaps: Waypoint\/web/);
    assert.equal(badge(root, A), 'clash');
});

test('a claim in the other project is not a collision', () => {
    const root = workspace();
    entry(root, A, { task: 'tidy the project cards', scope: ['Waypoint/web'], stage: 'build' });
    entry(root, B, { task: 'unrelated', scope: ['TypeDesk/web'] });

    const text = context(hook(INJECT, root, { session_id: A }));
    assert.match(text, /unrelated/);
    assert.doesNotMatch(text, /<< overlaps/);
    assert.equal(badge(root, A), 'build');
});

test('the guard blocks an edit inside another project under the same root', () => {
    const root = workspace();
    // A claimed first, so A holds it and B is the one that yields.
    entry(root, A, { task: 'tidy the project cards', scope: ['Waypoint/web'], started: '2026-01-01T00:00:00.000Z' });
    entry(root, B, { task: 'fix the card link', scope: ['Waypoint/web'], guard: 'deny', started: '2026-06-01T00:00:00.000Z' });

    const res = hook(GUARD, root, {
        session_id: B,
        tool_name: 'Edit',
        tool_input: { file_path: path.join(root, 'Waypoint', 'web', 'src', 'Card.jsx') },
    }, path.join(root, 'Waypoint'));

    assert.equal(res.hookSpecificOutput.permissionDecision, 'deny');
    assert.match(res.hookSpecificOutput.permissionDecisionReason, /tidy the project cards/);
});

test('the guard leaves a file nobody else claimed alone', () => {
    const root = workspace();
    entry(root, A, { task: 'tidy the project cards', scope: ['Waypoint/web'] });
    entry(root, B, { task: 'fix the api', scope: ['Waypoint/api'], guard: 'deny' });

    const res = hook(GUARD, root, {
        session_id: B,
        tool_name: 'Edit',
        tool_input: { file_path: path.join(root, 'Waypoint', 'api', 'app', 'routes.py') },
    });
    assert.equal(res, null);
});

test('the guard leaves a file outside the root alone', () => {
    const root = workspace();
    entry(root, A, { task: 'tidy the project cards', scope: ['Waypoint/web'] });
    entry(root, B, { task: 'fix the card link', scope: ['Waypoint/web'], guard: 'deny' });

    const res = hook(GUARD, root, {
        session_id: B,
        tool_name: 'Edit',
        tool_input: { file_path: path.join(os.tmpdir(), 'somewhere-else.txt') },
    });
    assert.equal(res, null);
});

test('a subagent brief carries the parent task and the scope, from inside the project', () => {
    const root = workspace();
    entry(root, A, { task: 'tidy the project cards', scope: ['Waypoint/web'] });

    const text = context(hook(BRIEF, root, {
        session_id: A,
        agent_id: 'sub-1',
        agent_type: 'Explore',
    }, path.join(root, 'Waypoint')));

    assert.match(text, /you are a subagent of: tidy the project cards/);
    assert.match(text, /scope: Waypoint\/web/);
    assert.match(text, /final message is the return value/);
    assert.match(text, /agent type: Explore/);
});

test('a subagent never gets a registry entry of its own', () => {
    const root = workspace();
    entry(root, A, { task: 'tidy the project cards', scope: ['Waypoint/web'] });
    const before = fs.readdirSync(path.join(root, '.fankeel', 'sessions')).sort();

    hook(BRIEF, root, { session_id: A, agent_id: 'sub-1', agent_type: 'Explore' });

    // A second claimant on the parent's own files would make every edit a
    // collision with itself.
    assert.deepEqual(fs.readdirSync(path.join(root, '.fankeel', 'sessions')).sort(), before);
});

test('a session with no entry stays silent and writes nothing', () => {
    const root = workspace();
    assert.equal(hook(INJECT, root, { session_id: A }), null);
    assert.equal(badge(root, A), null);
    assert.equal(fs.existsSync(path.join(root, 'cfg', 'modes')), false);
});

test('a stood-down entry is not in the mode', () => {
    const root = workspace();
    entry(root, A, { task: 'tidy the project cards', scope: ['Waypoint/web'], active: false });
    assert.equal(hook(INJECT, root, { session_id: A }), null);
});

test('the scanner reads one project of the workspace when told which', () => {
    const root = workspace();
    const SURVEY = path.join(__dirname, '..', 'scripts', 'survey.js');

    const all = execFileSync(process.execPath, [SURVEY, 'app'], { cwd: root, encoding: 'utf8' });
    assert.match(all, /TypeDesk\//);

    const one = execFileSync(process.execPath, [SURVEY, '--root', 'Waypoint', 'app'], { cwd: root, encoding: 'utf8' });
    assert.doesNotMatch(one, /TypeDesk/);
    assert.match(one, /web\/src\/App\.jsx/);
});
