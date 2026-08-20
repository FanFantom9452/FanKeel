'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const survey = require('../scripts/survey.js');
const SCRIPT = path.join(__dirname, '..', 'scripts', 'survey.js');

// A throwaway repository, because the scanner reads `git ls-files` and there is
// no point testing it against something that is not one.
function repo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-survey-'));
  execFileSync('git', ['init', '-q'], { cwd: root });
  for (const [name, body] of Object.entries(files)) {
    const full = path.join(root, name);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
  }
  execFileSync('git', ['add', '-A'], { cwd: root });
  return root;
}

const run = (root, ...args) =>
  execFileSync(process.execPath, [SCRIPT, '--root', root, ...args], { encoding: 'utf8' });

test('a JavaScript function is found', () => {
  const root = repo({ 'lib/a.js': 'function widgetFactory() {}\n' });
  assert.match(run(root, 'widget'), /lib\/a\.js:1 {2}function widgetFactory/);
});

test('an exported const arrow function is found', () => {
  const root = repo({ 'lib/a.js': 'export const makeWidget = (x) => x;\n' });
  assert.match(run(root, 'widget'), /makeWidget/);
});

test('a class is found', () => {
  const root = repo({ 'lib/a.ts': 'export class WidgetStore {}\n' });
  assert.match(run(root, 'widget'), /WidgetStore/);
});

test('a PowerShell function is found', () => {
  const root = repo({ 'statusline.ps1': 'function CtxRamp($t) {\n}\n' });
  assert.match(run(root, 'ramp'), /statusline\.ps1:1 {2}function CtxRamp/);
});

test('a Python def and class are found', () => {
  const root = repo({ 'tool.py': 'def build_widget():\n    pass\n\nclass WidgetBag:\n    pass\n' });
  const out = run(root, 'widget');
  assert.match(out, /build_widget/);
  assert.match(out, /WidgetBag/);
});

test('a shell function is found', () => {
  const root = repo({ 'go.sh': 'render_widget() {\n  echo hi\n}\n' });
  assert.match(run(root, 'widget'), /render_widget/);
});

test('a markdown heading is reported as documentation, not a declaration', () => {
  const root = repo({ 'README.md': '# Widgets\n\ntext\n' });
  const out = run(root, 'widget');
  assert.match(out, /documentation:/);
  assert.match(out, /README\.md:1 {2}# Widgets/);
  assert.equal(out.includes('declarations:'), false);
});

test('a file whose name matches is listed even with nothing declared in it', () => {
  const root = repo({ 'widget.css': '.a { color: red }\n' });
  const out = run(root, 'widget');
  assert.match(out, /files whose name matches:/);
  assert.match(out, /widget\.css/);
});

test('an unrelated declaration is not reported', () => {
  const root = repo({ 'lib/a.js': 'function unrelatedThing() {}\n' });
  assert.match(run(root, 'widget'), /Nothing matched/);
});

test('a miss says which terms were tried and suggests a synonym', () => {
  const root = repo({ 'lib/a.js': 'function x() {}\n' });
  const out = run(root, 'widget', 'gadget');
  assert.match(out, /matching: widget, gadget/);
  assert.match(out, /try a synonym/);
});

test('with no terms everything declared is listed', () => {
  const root = repo({ 'lib/a.js': 'function one() {}\nfunction two() {}\n' });
  const out = run(root);
  assert.match(out, /everything declared/);
  assert.match(out, /one/);
  assert.match(out, /two/);
});

test('an untracked file is invisible', () => {
  const root = repo({ 'lib/a.js': 'function tracked() {}\n' });
  fs.writeFileSync(path.join(root, 'untracked.js'), 'function widgetGhost() {}\n');
  assert.equal(run(root, 'widget').includes('widgetGhost'), false);
});

test('--root takes its value with it rather than leaving it as a term', () => {
  const parsed = survey.parseArgs(['--root', 'F:/somewhere', 'widget']);
  assert.equal(parsed.root, 'F:/somewhere');
  assert.deepEqual(parsed.terms, ['widget']);
});

test('terms are lowercased and de-duplicated', () => {
  assert.deepEqual(survey.parseArgs(['Widget', 'widget', ' WIDGET ']).terms, ['widget']);
});

test('an unknown flag is ignored rather than searched for', () => {
  assert.deepEqual(survey.parseArgs(['--verbose', 'widget']).terms, ['widget']);
});

test('matching is case-insensitive', () => {
  const root = repo({ 'lib/a.js': 'function WidgetFactory() {}\n' });
  assert.match(run(root, 'WIDGET'), /WidgetFactory/);
});

test('outside a git repository it says so instead of pretending to have looked', () => {
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-nogit-'));
  const out = run(bare, 'widget');
  assert.match(out, /not a git repository/);
  assert.match(out, /Search by hand/);
});

test('report says nothing matched rather than throwing on a null scan', () => {
  assert.match(survey.report(null, ['x']), /not a git repository/);
});

test('the scanner has no dependencies to install', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  assert.equal(pkg.dependencies, undefined);
  const src = fs.readFileSync(SCRIPT, 'utf8');
  const requires = [...src.matchAll(/require\('([^']+)'\)/g)].map((m) => m[1]);
  for (const r of requires) assert.ok(r.startsWith('node:'), 'non-core require: ' + r);
});
