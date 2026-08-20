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

test('a plain function is still found now that generators are too', () => {
  const root = repo({ 'lib/a.js': 'function plainWidget() {}\nfunction* widgetStream() {}\n' });
  const out = run(root, 'widget');
  assert.match(out, /plainWidget/);
  assert.match(out, /widgetStream/);
});

test('a TypeScript interface and type alias are found', () => {
  const root = repo({ 'lib/a.ts': 'export interface WidgetProps {}\nexport type WidgetKind = string;\n' });
  const out = run(root, 'widget');
  assert.match(out, /WidgetProps/);
  assert.match(out, /WidgetKind/);
});

test('a Go func, method and type are found', () => {
  const root = repo({ 'main.go': 'func NewWidget() {}\nfunc (w *Bag) AddWidget() {}\ntype WidgetBag struct{}\n' });
  const out = run(root, 'widget');
  assert.match(out, /NewWidget/);
  assert.match(out, /AddWidget/, 'the receiver must not hide the method name');
  assert.match(out, /WidgetBag/);
});

test('a Rust fn, struct and trait are found', () => {
  const root = repo({ 'src/lib.rs': 'pub async fn build_widget() {}\npub struct WidgetBag;\ntrait WidgetLike {}\n' });
  const out = run(root, 'widget');
  assert.match(out, /build_widget/);
  assert.match(out, /WidgetBag/);
  assert.match(out, /WidgetLike/);
});

test('a C# class and method are found', () => {
  const root = repo({ 'Widgets.cs': 'public sealed class WidgetStore {\n  public static void MakeWidget(int n) {}\n}\n' });
  const out = run(root, 'widget');
  assert.match(out, /WidgetStore/);
  assert.match(out, /MakeWidget/);
});

test('a bare control-flow line is not mistaken for a method', () => {
  const root = repo({ 'A.java': 'class Thing {\n  void go() {\n    if (widgetReady) {}\n    for (int i = 0; i < 3; i++) {}\n  }\n}\n' });
  const out = run(root, 'widget');
  assert.equal(out.includes('if ('), false, 'an if without a visibility keyword was read as a declaration');
});

test('a Kotlin fun and a Swift func are found', () => {
  const root = repo({ 'A.kt': 'fun makeWidget() {}\n', 'B.swift': 'func drawWidget() {}\n' });
  const out = run(root, 'widget');
  assert.match(out, /makeWidget/);
  assert.match(out, /drawWidget/);
});

test('a Ruby def and class are found', () => {
  const root = repo({ 'widgets.rb': 'class WidgetBag\n  def self.build_widget?\n  end\nend\n' });
  const out = run(root, 'widget');
  assert.match(out, /WidgetBag/);
  assert.match(out, /build_widget\?/, 'self. must not swallow the method name');
});

test('a stylesheet class, custom property and mixin are found', () => {
  const root = repo({ 'app.css': '.widget-card { color: red }\n', 'theme.scss': '  --widget-gap: 4px;\n@mixin widget-frame {}\n' });
  const out = run(root, 'widget');
  assert.match(out, /widget-card/);
  assert.match(out, /--widget-gap/);
  assert.match(out, /widget-frame/);
});

test('a single-file component is found by its name, and its script block is read', () => {
  const root = repo({ 'src/WidgetCard.vue': '<script>\nexport function useWidget() {}\n</script>\n' });
  const out = run(root, 'widget');
  assert.match(out, /files whose name matches:/);
  assert.match(out, /WidgetCard\.vue/);
  assert.match(out, /useWidget/);
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
