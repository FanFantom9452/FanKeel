'use strict';

// docs/90-agent/plans/2026-09-30-init-design.md §2: `start` checks the task's
// own project — `--project` under the registry root, or the root when there is
// none — and never a workspace root that is not the project.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const docs = require('../lib/docs.js');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'task.js');
const A = 'aaaaaaaa-1111-2222-3333-444444444444';
const B = 'bbbbbbbb-1111-2222-3333-444444444444';
const C = 'cccccccc-1111-2222-3333-444444444444';
const TICKS = '`'.repeat(3);
const fwd = (p) => p.split(path.sep).join('/');

function run(dir, args) {
  const cfg = path.join(dir, 'cfg');
  try {
    return execFileSync(process.execPath, [SCRIPT, ...args, '--root', dir, '--claude-dir', cfg],
      { encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }) });
  } catch (e) {
    return String(e.stdout || '') + String(e.stderr || '');
  }
}

const put = (root, rel, body) => {
  const full = path.join(root, rel.split('/').join(path.sep));
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, body);
};

// A workspace with no docs.json of its own: Alpha never organised, Beta filed.
function workspace() {
  const root = tmp('fankeel-task-onboard-');
  put(root, 'Alpha/notes.md', '# notes\n');
  put(root, 'Beta/README.md', ['# Beta', '', TICKS + 'text',
    '├── docs/     the pages a person reads',
    '├── lib/      the logic, tested directly',
    '└── tests/    one file per module', TICKS, ''].join('\n'));
  put(root, 'Beta/docs/guide.md', '# guide\n');
  docs.write(path.join(root, 'Beta'), { buckets: [{ path: 'docs', role: 'reference' }] });
  return root;
}

test('start --project Alpha names Alpha and the skill to run; start --project Beta says nothing', () => {
  const root = workspace();
  const alpha = run(root, ['start', '--session', A, '--task', 'tidy alpha', '--project', 'Alpha']);
  const where = fwd(path.join(root, 'Alpha'));
  assert.match(alpha, new RegExp('^onboard: ' + where.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' — docs\\.json — ', 'm'));
  assert.ok(alpha.includes('Skill fankeel-init --root ' + where + ' before survey'), alpha);
  const beta = run(root, ['start', '--session', B, '--task', 'tidy beta', '--project', 'Beta']);
  assert.doesNotMatch(beta, /^onboard:/m);
  for (const out of [alpha, beta]) assert.ok(!out.includes('--root ' + fwd(root) + ' before'), 'the workspace root is never named');
});

test('init.skip on the project: no onboard line', () => {
  const root = workspace();
  put(root, 'Alpha/.fankeel/profile.json', JSON.stringify({ 'init.skip': true }));
  assert.doesNotMatch(run(root, ['start', '--session', C, '--task', 'tidy alpha', '--project', 'Alpha']), /^onboard:/m);
});
