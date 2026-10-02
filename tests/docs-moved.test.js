'use strict';

// build-3: build close rewrites a `moved` citation docs-check found at exactly
// one new line, with no agent, and leaves every other one as it is.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { main, target } = require('../scripts/docs-moved.js');
const tmp = require('./tmp.js');

// The fixture tests/docs-check.test.js builds: a reference bucket over docs/,
// every file added so `git ls-files` sees it.
function repoWith(files) {
  const root = tmp('fankeel-docsmoved-');
  execFileSync('git', ['init', '-q'], { cwd: root });
  fs.mkdirSync(path.join(root, '.fankeel'), { recursive: true });
  fs.writeFileSync(path.join(root, '.fankeel', 'docs.json'), JSON.stringify({
    preset: 'flat', index: 'docs/README.md', buckets: [{ path: 'docs', role: 'reference', depth: 1 }],
  }));
  for (const [name, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), text);
  }
  execFileSync('git', ['add', '-A'], { cwd: root });
  return root;
}

// Fifteen lines, the quote on :11, so `:1-5` moves to `:11-15` and stays inside the file.
const FOO = 'a\nb\nc\nd\ne\nf\ng\nh\ni\nj\nconst target = 1;\nk\nl\nm\nn\n';
const page = (root) => fs.readFileSync(path.join(root, 'docs', 'page.md'), 'utf8');

test('target reads both shapes docs-check writes, and nothing else', () => {
  assert.deepEqual(target('lib/foo.js:3 does not hold `const target` — it is at :11'), { file: 'lib/foo.js', cited: '3', to: '11' });
  assert.deepEqual(target('lib/foo.js:1-5 does not hold `const target` — it is at :11, try :11-15'), { file: 'lib/foo.js', cited: '1-5', to: '11-15' });
  assert.equal(target('lib/foo.js:3 does not hold `const target`'), null, 'no new line named');
});

test('a citation whose quote moved to one line is rewritten there, a range kept the same length', () => {
  const root = repoWith({ 'docs/README.md': '# index\n', 'lib/foo.js': FOO,
    'docs/page.md': 'See `lib/foo.js:3`, which sets `const target`.\nAnd `lib/foo.js:1-5`, which holds `const target`.\n' });
  const out = main(['--root', root]);
  assert.equal(out.code, 0);
  assert.equal(page(root), 'See `lib/foo.js:11`, which sets `const target`.\nAnd `lib/foo.js:11-15`, which holds `const target`.\n');
  assert.match(out.text, /^fixed docs\/page\.md:1 lib\/foo\.js:3 → :11$/m);
});

test('a quote found at two places is left as it is, and said', () => {
  const text = 'See `lib/foo.js:3`, which sets `const target`.\n';
  const root = repoWith({ 'docs/README.md': '# index\n', 'lib/foo.js': FOO + 'const target = 2;\n', 'docs/page.md': text });
  const out = main(['--root', root]);
  assert.equal(page(root), text);
  assert.match(out.text, /^left docs\/page\.md:1 {2}lib\/foo\.js:3 does not hold/m);
});
