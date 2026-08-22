'use strict';

// Routes: the stages a particular task will go through, in the order it will go
// through them. A fixed route made the progress indicator lie in both directions,
// so what matters here is that a route is either valid and honest about where it
// is, or refused.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { normaliseRoute, positionIn, nextStage, FULL_ROUTE, NAMES } = require('../lib/stages.js');
const registry = require('../lib/registry.js');
const plugins = require('../lib/plugins.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'task.js');
const A = 'aaaaaaaa-1111-2222-3333-444444444444';

const root = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-route-'));

function run(dir, args) {
  const cfg = path.join(dir, 'cfg');
  try {
    return {
      out: execFileSync(process.execPath, [SCRIPT, ...args, '--root', dir, '--claude-dir', cfg], { encoding: 'utf8' }),
      code: 0,
    };
  } catch (e) {
    return { out: String(e.stdout || ''), code: e.status };
  }
}

const leadOf = (dir, id) => {
  try {
    const text = fs.readFileSync(path.join(dir, 'cfg', 'modes', id, 'fankeel.lead'), 'utf8');
    const out = {};
    for (const line of text.split('\n')) {
      const i = line.indexOf('=');
      if (i > 0) out[line.slice(0, i)] = line.slice(i + 1);
    }
    return out;
  } catch (e) {
    return null;
  }
};

test('audit is a stage, and land is still last in the full route', () => {
  assert.ok(NAMES.includes('audit'));
  assert.equal(FULL_ROUTE[FULL_ROUTE.length - 1], 'land');
  assert.equal(nextStage('land'), null);
});

test('a route is normalised, and anything that is not a route is refused', () => {
  assert.deepEqual(normaliseRoute(['build', 'verify']), ['build', 'verify']);
  assert.deepEqual(normaliseRoute(['BUILD', ' verify ']), ['build', 'verify']);

  assert.equal(normaliseRoute(['build', 'build']), null, 'no repeats');
  assert.equal(normaliseRoute(['land', 'build']), null, 'land last if at all');
  assert.equal(normaliseRoute(['refactor']), null, 'only stages this file knows');
  assert.equal(normaliseRoute([]), null);
  assert.equal(normaliseRoute('build,verify'), null, 'an array, not a string');
});

test('a route without land is fine — not every task ends by landing', () => {
  assert.deepEqual(normaliseRoute(['survey', 'audit']), ['survey', 'audit']);
});

test('position is along the route, not along the full seven', () => {
  assert.deepEqual(positionIn(['build', 'verify'], 'verify'), { step: 2, steps: 2 });
  assert.deepEqual(positionIn(['survey', 'audit', 'land'], 'audit'), { step: 2, steps: 3 });
  // The failure this replaces: two-stage work sitting at 2 of 6 forever.
  assert.deepEqual(positionIn(null, 'verify'), { step: 5, steps: 7 });
});

test('a stage off the route has no position rather than an invented one', () => {
  assert.equal(positionIn(['build', 'verify'], 'design'), null);
});

test('nextStage walks the route it was given', () => {
  assert.equal(nextStage('build', ['build', 'verify']), 'verify');
  assert.equal(nextStage('verify', ['build', 'verify']), null);
  assert.equal(nextStage('survey', ['survey', 'audit', 'land']), 'audit');
});

test('start takes a route and begins at its first stage, not at survey', () => {
  const dir = root();
  const { out, code } = run(dir, ['start', '--session', A, '--task', 'fix a typo', '--scope', 'a.js', '--route', 'build,verify']);
  assert.equal(code, 0);
  assert.match(out, /started, at build/);
  assert.match(out, /route: build → verify/);

  const data = registry.readSession(dir, A);
  assert.deepEqual(data.route, ['build', 'verify']);
  assert.equal(data.stage, 'build');
});

test('start without a route gets all seven', () => {
  const dir = root();
  run(dir, ['start', '--session', A, '--task', 'a feature', '--scope', 'a.js']);
  assert.deepEqual(registry.readSession(dir, A).route, FULL_ROUTE);
  assert.equal(registry.readSession(dir, A).stage, 'survey');
});

test('start refuses a route that is not one', () => {
  const dir = root();
  const { out, code } = run(dir, ['start', '--session', A, '--task', 'x', '--scope', 'a.js', '--route', 'build,refactor']);
  assert.equal(code, 1);
  assert.match(out, /--route must be stages from/);
  assert.equal(registry.readSession(dir, A), null);
});

test('a stage off the route is refused, and the entry does not move', () => {
  const dir = root();
  run(dir, ['start', '--session', A, '--task', 'x', '--scope', 'a.js', '--route', 'build,verify']);
  const { out, code } = run(dir, ['stage', 'design', '--session', A]);
  assert.equal(code, 1);
  assert.match(out, /not on the route for this task: build → verify/);
  assert.equal(registry.readSession(dir, A).stage, 'build');
});

test('route re-routes, and refuses to strand the stage the task is in', () => {
  const dir = root();
  run(dir, ['start', '--session', A, '--task', 'x', '--scope', 'a.js', '--route', 'build,verify']);
  run(dir, ['stage', 'verify', '--session', A]);

  const bad = run(dir, ['route', 'survey,design', '--session', A]);
  assert.equal(bad.code, 1);
  assert.match(bad.out, /which that route does not contain/);
  assert.deepEqual(registry.readSession(dir, A).route, ['build', 'verify']);

  const ok = run(dir, ['route', 'survey,build,verify,land', '--session', A]);
  assert.equal(ok.code, 0);
  assert.deepEqual(registry.readSession(dir, A).route, ['survey', 'build', 'verify', 'land']);
});

test('the lead file counts along the route, not along the full seven', () => {
  const dir = root();
  run(dir, ['start', '--session', A, '--task', 'fix a typo', '--scope', 'a.js', '--route', 'build,verify']);

  const lead = leadOf(dir, A);
  assert.equal(lead.word, 'build');
  assert.equal(lead.step, '1');
  assert.equal(lead.steps, '2');
  assert.equal(lead.title, 'fix a typo');
  assert.equal(lead.where, 'a.js');
  // Nothing to say is said by saying nothing: an `others=0` would render as a
  // flag with a zero next to it, which is worse than no flag.
  assert.equal(lead.others, undefined);
});

test('standing down takes the lead file with the badge', () => {
  const dir = root();
  run(dir, ['start', '--session', A, '--task', 'x', '--scope', 'a.js']);
  assert.ok(leadOf(dir, A));
  run(dir, ['down', '--session', A]);
  assert.equal(leadOf(dir, A), null);
});

test('adopt carries the route over', () => {
  const dir = root();
  const B = 'bbbbbbbb-1111-2222-3333-444444444444';
  run(dir, ['start', '--session', A, '--task', 'x', '--scope', 'a.js', '--route', 'build,verify']);
  run(dir, ['adopt', A, '--session', B]);
  assert.deepEqual(registry.readSession(dir, B).route, ['build', 'verify']);
});

// --- plugin detection ------------------------------------------------------

test('a missing manifest means nothing detected, not an exception', () => {
  const dir = root();
  assert.doesNotThrow(() => plugins.installed({ CLAUDE_CONFIG_DIR: dir }));
  assert.equal(plugins.installed({ CLAUDE_CONFIG_DIR: dir }).size, 0);
  assert.equal(plugins.has('ponytail', { CLAUDE_CONFIG_DIR: dir }), false);
});

test('a manifest that does not parse means nothing detected', () => {
  const dir = root();
  fs.mkdirSync(path.join(dir, 'plugins'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'plugins', 'installed_plugins.json'), '{ not json');
  assert.equal(plugins.installed({ CLAUDE_CONFIG_DIR: dir }).size, 0);
});

test('names come back without the marketplace suffix', () => {
  const dir = root();
  fs.mkdirSync(path.join(dir, 'plugins'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'plugins', 'installed_plugins.json'), JSON.stringify({
    version: 2,
    plugins: {
      'ponytail@ponytail-per-session': [{ version: '4.9.0' }],
      'superpowers@superpowers-dev': [{ version: '6.3.0' }],
      'never-installed@somewhere': [],
    },
  }));
  const env = { CLAUDE_CONFIG_DIR: dir };
  assert.ok(plugins.has('ponytail', env));
  assert.ok(plugins.has('superpowers', env));
  assert.equal(plugins.has('never-installed', env), false, 'an empty install list is not installed');
  assert.deepEqual(plugins.available(env).map((k) => k.name), ['ponytail']);
});

// The classification superpowers makes before its first question, with the
// stations named. It is not new machinery — a route was already a field — it is
// the decision that picks one, which was being made silently or not at all.
test('the three classes are routes, not a separate mechanism', () => {
  const { CLASSES, routeForClass } = require('../lib/stages.js');
  assert.deepEqual(Object.keys(CLASSES), ['spike', 'bounded', 'architectural']);
  assert.deepEqual(routeForClass('spike'), ['survey', 'build']);
  assert.deepEqual(routeForClass('bounded'), ['survey', 'design', 'build', 'verify', 'land']);
  assert.deepEqual(routeForClass('architectural'), FULL_ROUTE);
  // Every preset must survive the same validation a typed route does.
  for (const name of Object.keys(CLASSES)) {
    assert.deepEqual(normaliseRoute(routeForClass(name)), routeForClass(name), name);
  }
});

test('an unknown class is refused rather than defaulting to the long route', () => {
  const { routeForClass } = require('../lib/stages.js');
  assert.equal(routeForClass('medium'), null);
  assert.equal(routeForClass(''), null);
  assert.equal(routeForClass(undefined), null);
});

test('every class says what it means, because the word alone does not', () => {
  const { CLASSES } = require('../lib/stages.js');
  for (const name of Object.keys(CLASSES)) {
    assert.ok(CLASSES[name].means.length > 30, name + ' has no explanation');
  }
});
