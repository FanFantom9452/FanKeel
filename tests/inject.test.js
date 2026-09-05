'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const HOOK = path.join(__dirname, '..', 'hooks', 'inject.js');

const MINE = 'aaaaaaaa-0000-4000-8000-000000000001';
const THEIRS = 'bbbbbbbb-0000-4000-8000-000000000002';

// A pid no operating system hands out: Linux caps pid_max at 2^22 and Windows
// never comes near it, so signalling it is ESRCH on both.
const GONE_PID = 2147483646;

const ago = (ms) => new Date(Date.now() - ms).toISOString();

function tmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function seed(root, sessionId, over) {
  const dir = path.join(root, '.fankeel', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  const data = Object.assign({
    task: 'rework the colour ramp',
    scope: ['statusline.ps1'],
    stage: 'implement',
    active: true,
    started: ago(2 * 3600e3),
    updated: ago(3600e3),
  }, over);
  fs.writeFileSync(path.join(dir, sessionId + '.json'), JSON.stringify(data, null, 2) + '\n');
  return data;
}

// Claude Code's own session registry, which is not fankeel's: one file per
// running session, named for the pid that owns it. This session goes into it
// every time, because a directory `readLive` cannot find itself in is the wrong
// directory and everything in it counts live.
function seedLive(cfg, entries) {
  const dir = path.join(cfg, 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  for (const [sessionId, pid] of entries) {
    fs.writeFileSync(path.join(dir, pid + '.json'), JSON.stringify({ pid, sessionId }) + '\n');
  }
}

// Runs the real hook the way Claude Code does: payload on stdin, everything else
// from the environment.
function run(payload, claudeDir) {
  const out = execFileSync(process.execPath, [HOOK], {
    input: typeof payload === 'string' ? payload : JSON.stringify(payload),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: claudeDir || tmp('fankeel-cfg-') }),
  });
  return out;
}

const context = (out) => JSON.parse(out).hookSpecificOutput.additionalContext;
const readEntry = (root, sid) =>
  JSON.parse(fs.readFileSync(path.join(root, '.fankeel', 'sessions', sid + '.json'), 'utf8'));
const leadOf = (cfg, sid) =>
  fs.readFileSync(path.join(cfg, 'modes', sid, 'fankeel.lead'), 'utf8');

test('a project with no .fankeel says nothing', () => {
  const root = tmp('fankeel-hook-');
  assert.equal(run({ session_id: MINE, cwd: root }), '');
});

test('a session with no entry of its own says nothing', () => {
  const root = tmp('fankeel-hook-');
  seed(root, THEIRS);
  assert.equal(run({ session_id: MINE, cwd: root }), '');
});

test('a stood-down entry says nothing', () => {
  const root = tmp('fankeel-hook-');
  seed(root, MINE, { active: false });
  assert.equal(run({ session_id: MINE, cwd: root }), '');
});

test('an active entry injects its task', () => {
  const root = tmp('fankeel-hook-');
  seed(root, MINE);
  const ctx = context(run({ session_id: MINE, cwd: root }));
  assert.match(ctx, /FANKEEL ACTIVE — rework the colour ramp @ implement/);
  assert.match(ctx, /stage rules:/);
});

// The whole round trip through the real hook: a transcript on disk, the figure
// read out of it, and the entry carrying it afterwards. The unit tests below
// `touch` prove the arithmetic; only this proves the number ever arrives.
test('the hook records what the transcript says the session is holding', () => {
  const root = tmp('fankeel-hook-');
  seed(root, MINE, { stage: 'survey' });
  const jsonl = path.join(tmp('fankeel-transcript-'), 'session.jsonl');
  const usage = (read) => JSON.stringify({
    type: 'assistant',
    message: { usage: { input_tokens: 12, cache_creation_input_tokens: 0, cache_read_input_tokens: read } },
  }) + '\n';

  fs.writeFileSync(jsonl, usage(119988));
  run({ session_id: MINE, cwd: root, transcript_path: jsonl });
  fs.appendFileSync(jsonl, usage(341988));
  run({ session_id: MINE, cwd: root, transcript_path: jsonl });

  assert.deepEqual(readEntry(root, MINE).burn, { survey: [120000, 342000] });
});

// A hook that cannot read the transcript still has a block to deliver, and the
// entry it leaves behind must not carry a guess.
test('a missing or absent transcript leaves the entry without a burn', () => {
  const root = tmp('fankeel-hook-');
  seed(root, MINE, { stage: 'survey' });
  run({ session_id: MINE, cwd: root });
  run({ session_id: MINE, cwd: root, transcript_path: path.join(root, 'nope.jsonl') });
  assert.equal(readEntry(root, MINE).burn, undefined);
});

test('the payload shape is what Claude Code expects', () => {
  const root = tmp('fankeel-hook-');
  seed(root, MINE);
  const parsed = JSON.parse(run({ session_id: MINE, cwd: root }));
  assert.equal(parsed.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  assert.equal(typeof parsed.hookSpecificOutput.additionalContext, 'string');
});

test('another live session in the same file is reported as an overlap', () => {
  const root = tmp('fankeel-hook-');
  seed(root, MINE);
  seed(root, THEIRS, { task: 'retune the 5h ramp', scope: ['statusline.ps1'] });
  const ctx = context(run({ session_id: MINE, cwd: root }));
  assert.match(ctx, /also in progress:/);
  assert.match(ctx, /<< overlaps: statusline\.ps1/);
});

test('another live session elsewhere is listed without a marker', () => {
  const root = tmp('fankeel-hook-');
  seed(root, MINE);
  seed(root, THEIRS, { task: 'rewrite the installer', scope: ['install.ps1'] });
  const ctx = context(run({ session_id: MINE, cwd: root }));
  assert.match(ctx, /rewrite the installer/);
  assert.equal(ctx.includes('overlaps'), false);
});

test('this session never appears in its own also-in-progress block', () => {
  const root = tmp('fankeel-hook-');
  seed(root, MINE);
  const ctx = context(run({ session_id: MINE, cwd: root }));
  assert.equal(ctx.includes('also in progress'), false);
});

test('CLAUDE_PROJECT_DIR wins over cwd', () => {
  const root = tmp('fankeel-hook-');
  const elsewhere = tmp('fankeel-else-');
  seed(root, MINE);
  const out = execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify({ session_id: MINE, cwd: elsewhere }),
    encoding: 'utf8',
    env: Object.assign({}, process.env, {
      CLAUDE_CONFIG_DIR: tmp('fankeel-cfg-'),
      CLAUDE_PROJECT_DIR: root,
    }),
  });
  assert.match(context(out), /rework the colour ramp/);
});

test('a payload that is not JSON says nothing and exits 0', () => {
  assert.equal(run('{ not json'), '');
});

test('an empty payload says nothing and exits 0', () => {
  assert.equal(run(''), '');
});

test('a payload with no session_id says nothing', () => {
  const root = tmp('fankeel-hook-');
  seed(root, MINE);
  assert.equal(run({ cwd: root }), '');
});

test('a malformed session_id says nothing', () => {
  const root = tmp('fankeel-hook-');
  seed(root, MINE);
  assert.equal(run({ session_id: '../../etc/passwd', cwd: root }), '');
});

test('a broken sibling entry is skipped and the rest still renders', () => {
  const root = tmp('fankeel-hook-');
  seed(root, MINE);
  fs.writeFileSync(
    path.join(root, '.fankeel', 'sessions', 'cccccccc-0000-4000-8000-000000000003.json'),
    '{ truncated',
  );
  seed(root, THEIRS, { task: 'still here', scope: ['install.ps1'] });
  const ctx = context(run({ session_id: MINE, cwd: root }));
  assert.match(ctx, /still here/);
});

test('running advances this entry updated and nothing else', () => {
  const root = tmp('fankeel-hook-');
  const before = seed(root, MINE);
  run({ session_id: MINE, cwd: root });
  const after = readEntry(root, MINE);
  assert.ok(Date.parse(after.updated) > Date.parse(before.updated));
  for (const k of Object.keys(before)) {
    if (k === 'updated') continue;
    assert.deepEqual(after[k], before[k], 'field ' + k + ' changed');
  }
});

test('another session entry is byte-identical after a run', () => {
  const root = tmp('fankeel-hook-');
  seed(root, MINE);
  seed(root, THEIRS, { task: 'untouched', scope: ['install.ps1'] });
  const file = path.join(root, '.fankeel', 'sessions', THEIRS + '.json');
  const before = fs.readFileSync(file);
  run({ session_id: MINE, cwd: root });
  assert.deepEqual(fs.readFileSync(file), before);
});

test('with the mode off nothing at all is written', () => {
  const root = tmp('fankeel-hook-');
  const cfg = tmp('fankeel-cfg-');
  run({ session_id: MINE, cwd: root }, cfg);
  assert.equal(fs.existsSync(path.join(root, '.fankeel')), false);
  assert.equal(fs.existsSync(path.join(cfg, 'modes')), false);
});

test('the badge carries the stage', () => {
  const root = tmp('fankeel-hook-');
  const cfg = tmp('fankeel-cfg-');
  seed(root, MINE, { stage: 'design' });
  run({ session_id: MINE, cwd: root }, cfg);
  assert.equal(fs.readFileSync(path.join(cfg, 'modes', MINE, 'fankeel'), 'utf8'), 'design\n');
});

test('the badge carries clash when another live session overlaps', () => {
  const root = tmp('fankeel-hook-');
  const cfg = tmp('fankeel-cfg-');
  seed(root, MINE);
  seed(root, THEIRS, { scope: ['statusline.ps1'] });
  run({ session_id: MINE, cwd: root }, cfg);
  assert.equal(fs.readFileSync(path.join(cfg, 'modes', MINE, 'fankeel'), 'utf8'), 'clash\n');
});

test('a clash takes the badge slot, and leaves the lead line its stage', () => {
  const root = tmp('fankeel-hook-');
  const cfg = tmp('fankeel-cfg-');
  seed(root, MINE, { stage: 'build' });
  seed(root, THEIRS, { scope: ['statusline.ps1'] });
  run({ session_id: MINE, cwd: root }, cfg);

  // One word is all the shared line has, so there the collision outranks the
  // stage.
  assert.equal(fs.readFileSync(path.join(cfg, 'modes', MINE, 'fankeel'), 'utf8'), 'clash\n');

  // The lead line has a field of its own for the collision, and it is already
  // filled. Spending the word on it as well would state one fact twice while
  // destroying the only copy of another — the stage has nowhere else to live.
  const lead = leadOf(cfg, MINE);
  assert.match(lead, /^word=build$/m);
  assert.match(lead, /^others=1$/m);
});

test('the lead names the registry root', () => {
  // Reuse the fixture the `/^word=build$/m` test builds; `root` is that
  // fixture's registry directory and `cfg` its config directory.
  const root = tmp('fankeel-hook-');
  const cfg = tmp('fankeel-cfg-');
  seed(root, MINE, { stage: 'build' });
  seed(root, THEIRS, { scope: ['statusline.ps1'] });
  run({ session_id: MINE, cwd: root }, cfg);
  const lead = leadOf(cfg, MINE);
  assert.match(lead, new RegExp('^root=' + root.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&') + '$', 'm'));
});

// The lead line carries the guard so a statusline can show it, and what it has
// to carry is the mode rather than the field. Since the default became `ask` the
// field is empty on exactly the sessions the guard is loudest on, so a raw read
// would report off while the prompts were landing.
test('the lead line reports the guard that is running, not the field', () => {
  const root = tmp('fankeel-hook-');

  const on = tmp('fankeel-cfg-');
  seed(root, MINE, { stage: 'build' });
  run({ session_id: MINE, cwd: root }, on);
  assert.match(leadOf(on, MINE), /^guard=ask$/m, 'no field means the default, which is ask');

  const off = tmp('fankeel-cfg-');
  seed(root, MINE, { stage: 'build', guard: 'off' });
  run({ session_id: MINE, cwd: root }, off);
  assert.doesNotMatch(leadOf(off, MINE), /^guard=/m, 'off is the one that paints nothing');
});

test('an overlapping session whose process has exited paints nothing', () => {
  const root = tmp('fankeel-hook-');
  const cfg = tmp('fankeel-cfg-');
  seed(root, MINE, { stage: 'build' });
  seed(root, THEIRS, { scope: ['statusline.ps1'] });
  seedLive(cfg, [[MINE, process.pid], [THEIRS, GONE_PID]]);
  const ctx = context(run({ session_id: MINE, cwd: root }, cfg));

  // The badge, the lead count and the injected text come off one filter now, so
  // no two of them can disagree about whether anybody is in this file.
  assert.equal(fs.readFileSync(path.join(cfg, 'modes', MINE, 'fankeel'), 'utf8'), 'build\n');
  assert.doesNotMatch(leadOf(cfg, MINE), /^others=/m);
  assert.equal(ctx.includes('<< overlaps:'), false);
  assert.equal(ctx.includes('also in progress'), false);
});

test('an overlapping session whose process is running paints all three', () => {
  const root = tmp('fankeel-hook-');
  const cfg = tmp('fankeel-cfg-');
  seed(root, MINE, { stage: 'build' });
  seed(root, THEIRS, { scope: ['statusline.ps1'] });
  // Two live pids, because one file per pid means the neighbour cannot share
  // this one. The parent is running by definition: it is waiting on this test.
  seedLive(cfg, [[MINE, process.pid], [THEIRS, process.ppid]]);
  const ctx = context(run({ session_id: MINE, cwd: root }, cfg));
  assert.equal(fs.readFileSync(path.join(cfg, 'modes', MINE, 'fankeel'), 'utf8'), 'clash\n');
  assert.match(leadOf(cfg, MINE), /^others=1$/m);
  assert.match(ctx, /<< overlaps: statusline\.ps1/);
});

test('an unreadable sessions directory costs nothing but the extras', () => {
  const root = tmp('fankeel-hook-');
  seed(root, MINE);
  fs.rmSync(path.join(root, '.fankeel', 'sessions', MINE + '.json'));
  assert.equal(run({ session_id: MINE, cwd: root }), '');
});

const badgeOf = (cfg, sid) => path.join(cfg, 'modes', sid, 'fankeel');

test('a /fankeel prompt with no entry raises the init badge', () => {
  const root = tmp('fankeel-hook-');
  const cfg = tmp('fankeel-cfg-');
  const out = run({ session_id: MINE, cwd: root, prompt: '/fankeel @Waypoint' }, cfg);
  assert.match(context(out), new RegExp(MINE));
  assert.equal(fs.readFileSync(badgeOf(cfg, MINE), 'utf8').trim(), 'init');
  const lead = leadOf(cfg, MINE);
  assert.match(lead, /^word=init$/m);
  assert.match(lead, /^step=0$/m);
  assert.doesNotMatch(lead, /^steps=/m, 'a denominator before a route is a count the next command contradicts');
});

test('the plugin-qualified form raises it too, and fankeel-audit does not', () => {
  const root = tmp('fankeel-hook-');
  const yes = tmp('fankeel-cfg-');
  run({ session_id: MINE, cwd: root, prompt: '/fankeel:fankeel look at this' }, yes);
  assert.equal(fs.readFileSync(badgeOf(yes, MINE), 'utf8').trim(), 'init');

  const no = tmp('fankeel-cfg-');
  run({ session_id: MINE, cwd: root, prompt: '/fankeel-audit' }, no);
  assert.equal(fs.existsSync(path.join(no, 'modes', MINE)), false, 'audit starts no task');
});

test('an ordinary prompt with no entry writes nothing at all', () => {
  const root = tmp('fankeel-hook-');
  const cfg = tmp('fankeel-cfg-');
  run({ session_id: MINE, cwd: root, prompt: 'what does this repository do' }, cfg);
  assert.equal(fs.existsSync(path.join(cfg, 'modes', MINE)), false);
});

test('an init badge is taken down by the next ordinary prompt', () => {
  const root = tmp('fankeel-hook-');
  const cfg = tmp('fankeel-cfg-');
  run({ session_id: MINE, cwd: root, prompt: '/fankeel' }, cfg);
  assert.equal(fs.existsSync(badgeOf(cfg, MINE)), true);
  run({ session_id: MINE, cwd: root, prompt: 'never mind' }, cfg);
  assert.equal(fs.existsSync(badgeOf(cfg, MINE)), false);
  assert.equal(fs.existsSync(badgeOf(cfg, MINE) + '.lead'), false);
});

test('a badge another plugin owns is not cleared by this one', () => {
  const root = tmp('fankeel-hook-');
  const cfg = tmp('fankeel-cfg-');
  const dir = path.join(cfg, 'modes', MINE);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'fankeel'), 'survey');
  run({ session_id: MINE, cwd: root, prompt: 'unrelated' }, cfg);
  assert.equal(fs.readFileSync(path.join(dir, 'fankeel'), 'utf8').trim(), 'survey',
    'no entry and no init word means leave it alone');
});

// The id typed into `task.js --session` has to be the id the hooks read, and
// nothing on screen distinguishes it: a background task's output directory and
// a scratch directory both carry one in the same shape. So the hook holding the
// real one says it, on the single prompt where it is about to be needed.
test('a /fankeel prompt is answered with the id the hooks use', () => {
  const dir = tmp('fankeel-hook-');
  const cfg = tmp('fankeel-cfg-');
  const text = context(run({ session_id: MINE, cwd: dir, prompt: '/fankeel' }, cfg));
  assert.match(text, new RegExp(MINE));
  assert.match(text, /--session/, 'it has to say what the id is for');
  assert.match(text, /^station: \d+ stale, \d+ live — /m, 'the block names the page');
  assert.ok(fs.existsSync(path.join(cfg, 'fankeel', 'station.html')), 'the page was written at the prompt');
});

test('a /fankeel prompt inside a registry leaves a copy of the page beside it', () => {
  const root = tmp('fankeel-hook-');
  const cfg = tmp('fankeel-cfg-');
  seed(root, THEIRS, { active: false });
  run({ session_id: MINE, cwd: root, prompt: '/fankeel' }, cfg);
  assert.ok(fs.existsSync(path.join(root, '.fankeel', 'station.html')));
  assert.match(fs.readFileSync(path.join(root, '.fankeel', '.gitignore'), 'utf8'), /^station\.html$/m);
});

// The cost stays on that one prompt. Every other prompt in every session on the
// machine that is not in the mode still writes nothing at all.
test('an ordinary prompt with no entry is answered with nothing', () => {
  const dir = tmp('fankeel-hook-');
  assert.equal(run({ session_id: MINE, cwd: dir, prompt: 'what does this repository do' }), '');
  assert.equal(run({ session_id: MINE, cwd: dir, prompt: '/fankeel-audit' }), '');
});

// The id goes back into the conversation, so it is read back only when it is
// actually a session id. A payload field is Claude Code's to send, not this
// hook's to vouch for.
test('a malformed session_id is not read back even on a /fankeel prompt', () => {
  const dir = tmp('fankeel-hook-');
  assert.equal(run({ session_id: '../../etc/passwd', cwd: dir, prompt: '/fankeel' }), '');
});

test('the /fankeel prompt carries rules, not only the session id', () => {
  const root = tmp('fankeel-hook-');
  const cfg = tmp('fankeel-cfg-');
  const text = context(run({ session_id: MINE, cwd: root, prompt: '/fankeel' }, cfg));
  assert.match(text, new RegExp(MINE), 'the id it already said');
  assert.match(text, /init rules:/, 'the badge is raised with nothing behind it');
  assert.match(text, /TODO\.md/, 'nothing tells it to read TODO.md before asking');
  assert.match(text, /orient\.js/);
  assert.match(text, /then AskUserQuestion/, 'no shape for what it puts on screen');
});

// The other half of how a claim gets onto the record. `hooks/touch.js` sees
// Edit, Write and NotebookEdit; everything else — a `sed`, a `node -e`, a build
// script, an MCP write tool — reaches the disk without any hook firing, and this
// hook is where git is asked what happened.
function gitRepo() {
  const dir = tmp('fankeel-hook-');
  const g = (args) => execFileSync('git', args, { cwd: dir, stdio: ['ignore', 'ignore', 'ignore'] });
  g(['init', '-q']);
  g(['config', 'user.email', 'test@example.invalid']);
  g(['config', 'user.name', 'test']);
  g(['config', 'commit.gpgsign', 'false']);
  fs.writeFileSync(path.join(dir, 'kept.js'), 'one\n');
  fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.fankeel', '.gitignore'), 'sessions/\n');
  g(['add', '-A']);
  g(['commit', '-qm', 'base']);
  return dir;
}

test('a write no hook saw is claimed on the next prompt', () => {
  const root = gitRepo();
  seed(root, MINE, { claims: [] });
  fs.mkdirSync(path.join(root, 'api'), { recursive: true });
  fs.writeFileSync(path.join(root, 'api', 'routes.js'), 'sed did this\n');
  run({ session_id: MINE, cwd: root, prompt: 'carry on' });
  assert.deepEqual(readEntry(root, MINE).claims, ['api/routes.js']);
});

test('a file dirty before the task started is not claimed', () => {
  const root = gitRepo();
  seed(root, MINE, { claims: [] });
  fs.appendFileSync(path.join(root, 'kept.js'), 'two\n');
  const then = Date.now() - 48 * 3600e3;
  fs.utimesSync(path.join(root, 'kept.js'), then / 1000, then / 1000);
  run({ session_id: MINE, cwd: root, prompt: 'carry on' });
  assert.deepEqual(readEntry(root, MINE).claims, []);
});

test('a session not in the mode never asks git anything', () => {
  const root = gitRepo();
  seed(root, MINE, { active: false });
  fs.writeFileSync(path.join(root, 'kept.js'), 'changed\n');
  const before = fs.readFileSync(path.join(root, '.fankeel', 'sessions', MINE + '.json'), 'utf8');
  run({ session_id: MINE, cwd: root, prompt: 'carry on' });
  assert.equal(fs.readFileSync(path.join(root, '.fankeel', 'sessions', MINE + '.json'), 'utf8'), before);
});

// A refusal nobody is told about is the hole this whole path was closing. The
// list above it would read as complete while the half git was going to supply
// had been thrown away.
test('a pass too big to record says so in the block', () => {
  const root = gitRepo();
  seed(root, MINE, { claims: ['kept.js'] });
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  for (let i = 0; i <= 60; i++) fs.writeFileSync(path.join(root, 'dist', 'part' + i + '.js'), 'chunk\n');
  const text = context(run({ session_id: MINE, cwd: root, prompt: 'carry on' }));
  assert.match(text, /unclaimed: 61 files written outside the hooks/);
  assert.deepEqual(readEntry(root, MINE).claims, ['kept.js'], 'nothing evicted to make room');
});

// The claim and the line describing it come from one moment. Rendering the list
// before the pass that fills it would show this prompt's writes a prompt late.
test('a write outside the hooks is in the block on the same prompt it is claimed', () => {
  const root = gitRepo();
  seed(root, MINE, { claims: [] });
  fs.mkdirSync(path.join(root, 'api'), { recursive: true });
  fs.writeFileSync(path.join(root, 'api', 'routes.js'), 'sed did this\n');
  const text = context(run({ session_id: MINE, cwd: root, prompt: 'carry on' }));
  assert.match(text, /touched: api\/routes\.js/);
});
