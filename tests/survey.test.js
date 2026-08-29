'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const survey = require('../scripts/survey.js');
// The two gates that key on `trackedFiles` returning null and nothing else.
const docsCheck = require('../scripts/docs-check.js');
const docsAudit = require('../scripts/docs-audit.js');
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

// The behaviour this replaces, and why it changed. `git ls-files` alone is
// tracked files only, which made the scanner blind to exactly the work in
// progress it is most often asked about. It caught itself: docs-check reported a
// function as declared nowhere while the file declaring it sat uncommitted in
// the working tree. A scanner that cannot see the file you just wrote gives the
// confident wrong answer this plugin exists to prevent.
test('a file written but not yet committed is visible', () => {
  const root = repo({ 'lib/a.js': 'function tracked() {}\n' });
  fs.writeFileSync(path.join(root, 'untracked.js'), 'function widgetGhost() {}\n');
  assert.match(run(root, 'widget'), /widgetGhost/);
});

test('an ignored file stays invisible — the repository already said so', () => {
  const root = repo({ 'lib/a.js': 'function tracked() {}\n', '.gitignore': 'secret.js\n' });
  fs.writeFileSync(path.join(root, 'secret.js'), 'function widgetSecret() {}\n');
  assert.equal(run(root, 'widget').includes('widgetSecret'), false);
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

test('a root with nothing readable under it says so', () => {
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-nogit-'));
  fs.mkdirSync(path.join(bare, 'empty'));
  const out = run(bare, 'widget');
  assert.match(out, /nothing readable under that root/);
  assert.match(out, /Search by hand/);
});

// Six of seven projects in a real working directory had no `.git` at all. The
// answer there used to be "not a git repository, search by hand", which took the
// scanner away from the environment that needed it most.
test('a directory that is not a repository is walked rather than given up on', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-walk-'));
  fs.mkdirSync(path.join(root, 'Trovara', 'backend'), { recursive: true });
  fs.writeFileSync(path.join(root, 'Trovara', 'backend', 'validators.py'), 'def check_widget():\n    pass\n');
  const out = run(root, 'widget');
  assert.match(out, /source: .*directory walk/);
  assert.match(out, /Trovara\/backend\/validators\.py:1 {2}def check_widget/);
});

test('dependencies and build output are skipped by the walk', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-walk-'));
  for (const d of ['node_modules', 'dist', '__pycache__', '.venv']) {
    fs.mkdirSync(path.join(root, d), { recursive: true });
    fs.writeFileSync(path.join(root, d, 'a.js'), 'function widgetGhost() {}\n');
  }
  fs.writeFileSync(path.join(root, 'real.js'), 'function widgetReal() {}\n');
  const out = run(root, 'widget');
  assert.match(out, /widgetReal/);
  assert.equal(out.includes('widgetGhost'), false, 'a skipped directory was walked');
});

test('spreadsheets are skipped by the walk, but not inside a repository', () => {
  // A repository's own ignore rules already say what belongs to it, so a file
  // tracked there is tracked on purpose. A working directory has no such rules,
  // and the first real run returned eleven thousand files whose visible portion
  // was entirely spreadsheets.
  const walked = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-walk-'));
  fs.writeFileSync(path.join(walked, 'widget-data.xlsx'), 'x');
  fs.writeFileSync(path.join(walked, 'widget.js'), 'function widgetReal() {}\n');
  const out = run(walked, 'widget');
  assert.equal(out.includes('widget-data.xlsx'), false);
  assert.match(out, /widget\.js/);

  const tracked = repo({ 'widget-data.xlsx': 'x', 'widget.js': 'function widgetReal() {}\n' });
  assert.match(run(tracked, 'widget'), /widget-data\.xlsx/);
});

test('a repository inside a walked tree is read with git, and the report says so', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-mixed-'));
  fs.writeFileSync(path.join(root, 'loose.js'), 'function widgetLoose() {}\n');
  fs.mkdirSync(path.join(root, 'plain'));
  fs.writeFileSync(path.join(root, 'plain', 'p.js'), 'function widgetPlain() {}\n');
  const inner = path.join(root, 'tracked');
  fs.mkdirSync(inner);
  execFileSync('git', ['init', '-q'], { cwd: inner });
  fs.writeFileSync(path.join(inner, 't.js'), 'function widgetTracked() {}\n');
  execFileSync('git', ['add', '-A'], { cwd: inner });
  const out = run(root, 'widget');
  assert.match(out, /source: git in tracked; a directory walk elsewhere/);
  for (const name of ['widgetLoose', 'widgetPlain', 'widgetTracked']) {
    assert.ok(out.includes(name), name + ' was missed');
  }
});

// A directory holding several repositories is how related projects get kept
// together, and it is exactly the root a cross-project session opens at — the
// collision warnings and the scope guard only reach across two repositories
// from their common parent.
test('a parent of several repositories is read through to its children', () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-multi-'));
  for (const [name, files] of Object.entries({
    alpha: { 'lib/a.js': 'function widgetOne() {}\n' },
    beta: { 'lib/b.js': 'function widgetTwo() {}\n' },
  })) {
    const root = path.join(parent, name);
    fs.mkdirSync(root);
    execFileSync('git', ['init', '-q'], { cwd: root });
    for (const [f, body] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
      fs.writeFileSync(path.join(root, f), body);
    }
    execFileSync('git', ['add', '-A'], { cwd: root });
  }
  const out = run(parent, 'widget');
  assert.match(out, /source: git in alpha, beta/);
  assert.match(out, /alpha\/lib\/a\.js:1 {2}function widgetOne/);
  assert.match(out, /beta\/lib\/b\.js:1 {2}function widgetTwo/);
});

test('a repository of its own reports git as its source and nothing else', () => {
  const root = repo({ 'lib/a.js': 'function widgetOne() {}\n' });
  const out = run(root, 'widget');
  assert.match(out, /^source: git$/m);
  assert.match(out, /lib\/a\.js:1 {2}function widgetOne/);
});

test('git’s complaint about a non-repository never reaches the report', () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-multi-'));
  const root = path.join(parent, 'alpha');
  fs.mkdirSync(root);
  execFileSync('git', ['init', '-q'], { cwd: root });
  fs.writeFileSync(path.join(root, 'a.js'), 'function widgetOne() {}\n');
  execFileSync('git', ['add', '-A'], { cwd: root });
  // stderr is captured here on purpose: inheriting it put `fatal: not a git
  // repository` at the top of a report that then worked perfectly, and it got
  // read as though it meant something.
  const out = execFileSync(process.execPath, [SCRIPT, '--root', parent, 'widget'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  assert.equal(out.includes('fatal:'), false, 'git wrote to the report');
  assert.match(out, /alpha\/a\.js/);
});

test('a declaration whose name matches ranks above one that only shares a path', () => {
  const root = repo({
    'zzz.js': 'function widgetMaker() {}\n',
    'widget/helpers.js': 'function unrelated() {}\n',
  });
  const out = run(root, 'widget');
  const decls = out.split('\n').filter((l) => /^ {2}\S+\.js:\d+/.test(l));
  assert.ok(decls[0].includes('widgetMaker'),
    'the path-only match came first: ' + JSON.stringify(decls));
  assert.ok(decls.some((l) => l.includes('unrelated')), 'the path match was dropped, not demoted');
});

test('the two kinds of match are counted out loud, not left to be inferred', () => {
  const root = repo({
    'zzz.js': 'function widgetMaker() {}\n',
    'widget/helpers.js': 'function unrelated() {}\n',
  });
  assert.match(run(root, 'widget'), /declarations: {2}\(1 by name, then 1 more in files that match\)/);
});

test('with every match named, the split is not mentioned at all', () => {
  const root = repo({ 'zzz.js': 'function widgetMaker() {}\n' });
  const out = run(root, 'widget');
  assert.match(out, /^declarations:$/m);
});

// A file the scan never opened used to leave no trace at all, so a report that
// covered a third of the tree and one that covered all of it read identically —
// and the stage rule that decides whether to read wider keys on the report.
test('files the scan never opened are counted in the note block', () => {
  const root = repo({
    'lib/a.js': 'function widgetFactory() {}\n',
    'data.json': '{ "widget": 1 }\n',
    'lib/big.js': 'function widgetHuge() {}\n' + 'x'.repeat(600 * 1024),
  });
  const out = run(root, 'widget');
  assert.match(out, /skipped: 1 over the size cap, 1 with no pattern for their extension/);
  assert.equal(/widgetHuge/.test(out), false, 'the file over the cap was read after all');
});

test('a scan that skipped nothing says nothing', () => {
  const root = repo({ 'lib/a.js': 'function widgetFactory() {}\n' });
  assert.equal(/skipped:/.test(run(root, 'widget')), false);
});

// An earlier ruling on this branch said the unreadable counter could not be
// produced portably and left it untested. It can, in three lines: stage a file,
// delete it from disk, and `git ls-files --cached` still lists it while
// `statSync` throws ENOENT straight into that counter. No permissions involved,
// so it reads the same on Windows as anywhere else.
test('a staged file that is no longer on disk is counted as unreadable', () => {
  const root = repo({
    'lib/a.js': 'function widgetFactory() {}\n',
    'lib/gone.js': 'function widgetVanished() {}\n',
  });
  fs.rmSync(path.join(root, 'lib', 'gone.js'));
  const out = run(root, 'widget');
  assert.match(out, /skipped: 1 unreadable/);
  assert.equal(/widgetVanished/.test(out), false, 'a file that is not on disk was read anyway');
});

// git reports a nested repository as one entry with a trailing slash and never
// descends into it. It used to land in the no-pattern counter, where an entire
// unread project reported as "1 with no pattern for their extension" — a count
// of one standing for any amount.
test('a nested repository is counted as a subtree, not as one unknown file', () => {
  const root = repo({ 'lib/a.js': 'function widgetFactory() {}\n' });
  const inner = path.join(root, 'inner');
  fs.mkdirSync(inner);
  execFileSync('git', ['init', '-q'], { cwd: inner });
  fs.writeFileSync(path.join(inner, 'deep.js'), 'function widgetBuried() {}\n');

  const out = run(root, 'widget');
  assert.match(out, /skipped: 1 nested repository not descended into/);
  assert.equal(/no pattern for their extension/.test(out), false, 'the subtree was counted as a file');
  assert.equal(/widgetBuried/.test(out), false, 'the nested repository was descended into');
  // The header counts files. A subtree already has its own line on the
  // `skipped:` line, and counting it twice makes the two disagree.
  assert.match(out, /survey — 1 files/, 'the subtree was counted in the header as well');
});

// The other form, and the one the trailing-slash test could never reach: a
// submodule is listed by `git ls-files --cached` as a bare `sub`. No slash, no
// extension, so it fell straight through to the no-pattern counter and an
// entire unread repository reported as one file of an unknown type — the exact
// understatement the counter above exists to remove.
test('a submodule listed without a trailing slash is a subtree too', () => {
  const root = repo({ 'lib/a.js': 'function widgetFactory() {}\n' });
  const inner = path.join(root, 'sub');
  fs.mkdirSync(inner);
  execFileSync('git', ['init', '-q'], { cwd: inner });
  fs.writeFileSync(path.join(inner, 'deep.js'), 'function widgetBuried() {}\n');
  execFileSync('git', ['add', '-A'], { cwd: inner });
  // An identity on the call, not in the environment: a gitlink needs a commit
  // to point at, and a machine running the suite need not have one configured.
  execFileSync('git', ['-c', 'user.email=t@example.invalid', '-c', 'user.name=t', 'commit', '-qm', 'x'], { cwd: inner });
  execFileSync('git', ['add', 'sub'], { cwd: root, stdio: ['ignore', 'ignore', 'ignore'] });

  // The gitlink is what this test is about; if git declined to record one there
  // is nothing here to check and a green assertion would be a lie.
  const listed = execFileSync('git', ['ls-files', '--cached'], { cwd: root, encoding: 'utf8' });
  assert.match(listed, /^sub$/m, 'git did not record the submodule as a bare entry');

  const out = run(root, 'widget');
  assert.match(out, /skipped: 1 nested repository not descended into/);
  assert.equal(/no pattern for their extension/.test(out), false, 'the submodule was counted as a file');
  assert.equal(/widgetBuried/.test(out), false, 'the submodule was descended into');
  assert.match(out, /survey — 1 files/, 'the submodule was counted in the header as well');

  // And it is not a file in the name matches either. `sub` matching a term put
  // a directory under "files whose name matches:".
  const bySub = run(root, 'sub');
  assert.equal(/^ {2}sub$/m.test(bySub), false, 'the submodule was listed as a file whose name matches');
});

// Two copies of "is this entry a subtree" had drifted: the scan skipped the stat
// when the entry carried a declaration extension, the tree never did. So a
// submodule named `vendor.js` came out a file in the header — opened, failed
// with EISDIR, counted unreadable — and a repository in the tree below it, in
// the one report.
test('a submodule with a code extension is a subtree in the header and in the tree', () => {
  const root = repo({ 'lib/a.js': 'function widgetFactory() {}\n' });
  const inner = path.join(root, 'vendor.js');
  fs.mkdirSync(inner);
  execFileSync('git', ['init', '-q'], { cwd: inner });
  fs.writeFileSync(path.join(inner, 'deep.js'), 'function widgetBuried() {}\n');
  execFileSync('git', ['add', '-A'], { cwd: inner });
  execFileSync('git', ['-c', 'user.email=t@example.invalid', '-c', 'user.name=t', 'commit', '-qm', 'x'], { cwd: inner });
  execFileSync('git', ['add', 'vendor.js'], { cwd: root, stdio: ['ignore', 'ignore', 'ignore'] });

  const listed = execFileSync('git', ['ls-files', '--cached'], { cwd: root, encoding: 'utf8' });
  assert.match(listed, /^vendor\.js$/m, 'git did not record the submodule as a bare entry');

  const out = run(root, '--tree');
  assert.match(out, /survey — 1 files/, 'the header counted the submodule as a file');
  assert.match(out, /tree — 1 file,/, 'the tree and the header disagree about the file count');
  assert.equal(/unreadable/.test(out), false, 'the submodule was opened as a file');
  assert.match(out, /vendor\.js {3}a repository of its own/);
});

// The `skipped:` line is counts, and the stage rule sends one reader at the half
// of it that can be opened by hand — with the list, which a count is not. A file
// with no pattern can be read by hand and a nested repository can be surveyed on
// its own root; nothing opens an unreadable file, so naming it buys the reader
// nothing and it stays a count.
test('the skips a reader can act on name their paths, and the rest stay counts', () => {
  const root = repo({
    'lib/a.js': 'function widgetFactory() {}\n',
    'data.json': '{ "widget": 1 }\n',
    'lib/gone.js': 'function widgetVanished() {}\n',
  });
  fs.rmSync(path.join(root, 'lib', 'gone.js'));
  const inner = path.join(root, 'inner');
  fs.mkdirSync(inner);
  execFileSync('git', ['init', '-q'], { cwd: inner });
  fs.writeFileSync(path.join(inner, 'deep.js'), 'function widgetBuried() {}\n');

  const out = run(root, 'widget');
  assert.match(out, /^skipped: 1 unreadable, 1 with no pattern for their extension, 1 nested repository/m);
  assert.match(out, /^skipped, and openable by hand:$/m);
  assert.match(out, /^ {2}data\.json$/m, 'the file with no pattern was not named');
  assert.match(out, /^ {2}inner\/ {2}\(a repository of its own\)$/m, 'the nested repository was not named');
  assert.equal(/gone\.js/.test(out), false, 'an unreadable file was named, and nothing can open it');
});

// The same split, one line further. Inside a repository nothing drops a tracked
// binary — a `.png` in the tree is there on purpose — so `assets/logo.png`
// reached `noPattern` and was handed to a reader under a title that promises it
// can be opened. It stays in the count; it is only not an instruction.
test('a binary is counted with the skips but not offered as something to open', () => {
  const out = run(repo({
    'a.js': 'function widgetOne() {}\n',
    'assets/logo.png': '\x89PNG\r\n',
    'pkg.json': '{}\n',
  }), 'widget');
  assert.match(out, /^skipped: 2 with no pattern for their extension$/m);
  assert.match(out, /^ {2}pkg\.json$/m);
  assert.equal(/logo\.png/.test(out), false, 'a binary was offered as openable by hand');
});

// Capped like every other section, and saying so in the same words. An
// over-cap skip list that stopped silently would be the same loss one directory
// down from the one this line exists to report.
test('an over-cap skip list says how many it did not name', () => {
  const files = { 'lib/a.js': 'function widgetFactory() {}\n' };
  for (let i = 0; i < 30; i++) files['d' + i + '.json'] = '{}\n';
  const out = run(repo(files), 'widget');
  assert.match(out, /^skipped, and openable by hand:$/m);
  assert.match(out, /^ {2}\.\.\. and 5 more, not listed$/m);
});

// The last silently incomplete path: `readdirSync` failing dropped a whole
// subtree with no counter and no line, and walk mode — the multi-project root
// the scanner exists for — is exactly where that happens. Forced rather than
// waited for, because an unlistable directory is the one skip a test cannot
// arrange the same way on every platform.
test('a directory the walk cannot list is counted, not dropped in silence', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-walk-'));
  fs.writeFileSync(path.join(root, 'top.js'), 'function widgetFactory() {}\n');
  fs.mkdirSync(path.join(root, 'locked'));
  fs.writeFileSync(path.join(root, 'locked', 'deep.js'), 'function widgetSealed() {}\n');

  const real = fs.readdirSync;
  t.mock.method(fs, 'readdirSync', (dir, opts) => {
    if (String(dir).endsWith('locked')) throw Object.assign(new Error('EACCES'), { code: 'EACCES' });
    return real.call(fs, dir, opts);
  });

  const result = survey.scan(root, ['widget']);
  assert.equal(result.skipped.unlistable, 1);
  const out = survey.report(result, ['widget']);
  assert.match(out, /skipped: 1 directory that could not be listed/);
  assert.equal(/widgetSealed/.test(out), false, 'the unlistable subtree was read after all');
});

// The count was collected and then thrown away one line later: with no files at
// all, `trackedFiles` returned null and the report said "nothing readable under
// that root — no repository, and no files". A root whose only subtree could not
// be listed is not that, and the difference is the whole point of the counter.
test('a root whose only subtree cannot be listed says so, not that there is nothing there', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-walk-'));
  fs.mkdirSync(path.join(root, 'locked'));
  fs.writeFileSync(path.join(root, 'locked', 'deep.js'), 'function widgetSealed() {}\n');

  const real = fs.readdirSync;
  t.mock.method(fs, 'readdirSync', (dir, opts) => {
    if (String(dir).endsWith('locked')) throw Object.assign(new Error('EACCES'), { code: 'EACCES' });
    return real.call(fs, dir, opts);
  });

  const result = survey.scan(root, ['widget']);
  assert.notEqual(result, null, 'a countable failure was reported as an empty root');
  const out = survey.report(result, ['widget']);
  assert.equal(/nothing readable under that root/.test(out), false);
  assert.match(out, /skipped: 1 directory that could not be listed/);
});

// And it says so without moving the contract underneath the three callers that
// did not ask. `trackedFiles` returning a result for an unlistable-only root —
// so that survey could count it — left `docs-check` and `docs-audit`, which gate
// on `if (!result)` and nothing else, reporting "0 markdown files … Every
// reference resolves.", exit 0, over a directory neither of them could read.
// Two of this project's own gates passing a tree they never opened is the exact
// failure it exists to prevent, and five code reviews read past it.
test('a caller that asks for no count still gets null for a root it cannot read', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-walk-'));
  fs.mkdirSync(path.join(root, 'locked'));
  fs.writeFileSync(path.join(root, 'locked', 'deep.js'), 'function widgetSealed() {}\n');

  const real = fs.readdirSync;
  t.mock.method(fs, 'readdirSync', (dir, opts) => {
    if (String(dir).endsWith('locked')) throw Object.assign(new Error('EACCES'), { code: 'EACCES' });
    return real.call(fs, dir, opts);
  });

  assert.equal(survey.trackedFiles(root), null, 'a caller that passed no stats got a result');
  assert.equal(docsCheck.scan(root), null, 'docs-check would report a clean pass here');
  assert.equal(docsAudit.sweep(root, 14, Date.now()), null, 'docs-audit would report nothing drifted here');

  // The count still reaches the one caller that says why out loud.
  const stats = {};
  assert.equal(survey.trackedFiles(root, { stats }), null);
  assert.equal(stats.unlistable, 1);
});

// The other half of the same contract, and it was left out. `unlistable` reaches
// the caller that says why; the extension drops did not, so a root holding
// nothing but archives and images returned null with an empty `stats` — the
// caller could not tell it apart from a root with nothing in it at all.
test('a root of nothing but skipped extensions says how many it skipped', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-skipext-'));
  fs.writeFileSync(path.join(root, 'photo.png'), 'x');
  fs.writeFileSync(path.join(root, 'sheet.xlsx'), 'x');
  fs.writeFileSync(path.join(root, 'notes.pdf'), 'x');

  const stats = {};
  assert.equal(survey.trackedFiles(root, { stats }), null, 'nothing readable is still nothing readable');
  assert.equal(stats.skippedExt, 3, 'the caller cannot tell this from an empty root');
  assert.equal(stats.unlistable, 0, 'nothing here failed to open');
});

// A path that is not there is not a subtree that would not open. Counting
// `ENOENT` alongside `EACCES` turned `--root <typo>` into "a directory walk
// elsewhere / skipped: 1 directory that could not be listed / ... try a synonym
// before concluding it is new" — a walk that never ran, and advice premised on
// the term being wrong rather than the path.
test('a root that does not exist reads as nothing readable, not as one that could not be listed', () => {
  const gone = path.join(os.tmpdir(), 'fankeel-no-such-root-at-all');
  const out = survey.report(survey.scan(gone, ['widget']), ['widget']);
  assert.match(out, /nothing readable under that root/);
  assert.equal(/could not be listed/.test(out), false, 'a missing path was counted as a blocked one');
});

// The walk drops spreadsheets, archives, media and binaries by extension, and
// dropped them with no counter and no line: the `source:` note disclosed only
// dot-directories, dependencies and build output, so the largest silent gap in
// the mode these counters exist for was the one nothing named. The comment on
// SKIP_EXT cites eleven thousand in one real run.
test('files dropped by extension in walk mode are counted', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-walk-'));
  fs.writeFileSync(path.join(root, 'real.js'), 'function widgetReal() {}\n');
  fs.writeFileSync(path.join(root, 'a.xlsx'), 'x');
  fs.writeFileSync(path.join(root, 'b.pdf'), 'x');
  const out = run(root, 'widget');
  assert.match(out, /skipped: 2 documents and binaries dropped by extension/);

  // One reads as one, and inside a repository the drop never happens at all —
  // a tracked `.png` is tracked on purpose.
  const single = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-walk-'));
  fs.writeFileSync(path.join(single, 'real.js'), 'function widgetReal() {}\n');
  fs.writeFileSync(path.join(single, 'a.pdf'), 'x');
  assert.match(run(single, 'widget'), /skipped: 1 document or binary dropped by extension/);
  assert.equal(/dropped by extension/.test(run(repo({ 'a.pdf': 'x', 'r.js': 'function widgetReal() {}\n' }), 'widget')), false);
});

test('report says nothing matched rather than throwing on a null scan', () => {
  assert.match(survey.report(null, ['x']), /nothing readable under that root/);
});

test('the scanner has no dependencies to install', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  assert.equal(pkg.dependencies, undefined);
  const src = fs.readFileSync(SCRIPT, 'utf8');
  // Core modules and paths inside this repository. What this rules out is a bare
  // specifier — the only kind that has to be installed before the scanner runs.
  const requires = [...src.matchAll(/require\('([^']+)'\)/g)].map((m) => m[1]);
  for (const r of requires) {
    assert.ok(r.startsWith('node:') || r.startsWith('./') || r.startsWith('../'),
      'a require that would have to be installed: ' + r);
  }
});

test('--max sets the per-section cap and --all lifts it', () => {
  assert.equal(survey.parseArgs(['--max', '2', 'badge']).max, 2);
  assert.deepEqual(survey.parseArgs(['--max', '2', 'badge']).terms, ['badge']);
  assert.equal(survey.parseArgs(['--all']).max, Infinity);
  assert.equal(survey.parseArgs(['badge']).max, 25, 'the default is unchanged');
  assert.equal(survey.parseArgs(['--max', 'nonsense']).max, 25, 'a bad value keeps the default');
  assert.deepEqual(survey.parseArgs(['--max', 'nonsense']).terms, [], 'and does not become a term');
});

test('the cap actually caps, and the report says which one it used', () => {
  const root = path.join(__dirname, '..');
  // No terms: every declaration this repository has, which is comfortably more
  // than two. A term would have to keep matching for the test to keep meaning
  // what it says.
  const result = survey.scan(root, []);
  const capped = survey.report(result, [], { max: 2 });
  assert.match(capped, /\.\.\. and \d+ more, not listed/);
  assert.match(capped, /cap: 2 per section/);

  const all = survey.report(result, [], { max: Infinity });
  assert.equal(/more, not listed/.test(all), false, 'nothing is dropped');
  assert.match(all, /cap: none/);

  const plain = survey.report(result, []);
  assert.equal(/cap:/.test(plain), false, 'the default is not announced');
});

test('--tree lists every directory with its files and their sizes', () => {
  assert.equal(survey.parseArgs(['--tree']).tree, true);
  assert.equal(survey.parseArgs([]).tree, false);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-tree-'));
  fs.mkdirSync(path.join(root, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(root, 'lib', 'a.js'), 'x'.repeat(2048));
  fs.writeFileSync(path.join(root, 'lib', 'b.js'), 'y'.repeat(10));
  fs.writeFileSync(path.join(root, 'top.md'), 'z');

  const files = ['lib/a.js', 'lib/b.js', 'top.md'];
  const out = survey.treeLines(root, files, 25).join('\n');
  assert.match(out, /^tree — 3 files/m);
  assert.match(out, /lib\/\s+2 files/);
  assert.match(out, /a\.js\s+2\.0K/);
  assert.match(out, /top\.md\s+1B/);

  const capped = survey.treeLines(root, files, 1).join('\n');
  assert.match(capped, /\.\.\. and 1 more, not listed/);
});

test('a nested repository is one line, not a file with no name', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-tree2-'));
  fs.writeFileSync(path.join(root, 'only.md'), 'z');
  const out = survey.treeLines(root, ['only.md', '.claude/worktrees/old/'], 25).join('\n');
  assert.match(out, /^tree — 1 file,/m, 'the opaque entry is not counted as a file');
  assert.match(out, /\.claude\/worktrees\/old\/\s+a repository of its own, not descended into/);
  assert.equal(/^ {4} {2}/m.test(out), false, 'no file row with an empty name');

  // The submodule form, which carries no slash to key on. This section stats
  // every entry anyway, so the directory is free to notice.
  fs.mkdirSync(path.join(root, 'sub'));
  const withSub = survey.treeLines(root, ['only.md', 'sub'], 25).join('\n');
  assert.match(withSub, /^tree — 1 file,/m, 'the submodule was counted as a file');
  assert.match(withSub, /sub\s+a repository of its own, not descended into/);
});

test('the tree only appears when it is asked for', () => {
  const root = path.join(__dirname, '..');
  const result = survey.scan(root, ['badge']);
  assert.equal(/^tree — /m.test(survey.report(result, ['badge'])), false);
  assert.match(survey.report(result, ['badge'], { tree: true, root }), /^tree — \d+ files/m);
});

// A directory with no `.git` was still handed to `git ls-files`, once per
// project, so that git could say what a single `existsSync` already knew. On a
// workspace of fifteen where eleven are not repositories, that is eleven whole
// processes spawned to be told no.
//
// The first half of this test is not decoration: `lib/tracked.js` used to
// destructure `execFileSync` at load, and a mock on the module property could
// not see the call at all. Without a spawn the mock is known to observe, an
// empty list in the second half proves nothing.
test('a directory that is not a repository is walked without spawning git', (t) => {
  const cp = require('node:child_process');
  const real = cp.execFileSync;
  const calls = [];
  t.mock.method(cp, 'execFileSync', (file, args, opts) => {
    if (file === 'git') calls.push(args[0]);
    return real.call(cp, file, args, opts);
  });

  survey.trackedFiles(repo({ 'a.js': 'x\n' }), {});
  assert.ok(calls.includes('ls-files'), 'the mock never saw the repository being read');

  calls.length = 0;
  const plain = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-plain-'));
  fs.writeFileSync(path.join(plain, 'a.js'), 'x\n');
  const result = survey.trackedFiles(plain, {});
  assert.equal(result.walked, true);
  assert.deepEqual(calls, [], 'git was spawned for a directory with no .git in it');
});

// A regression guard, and it is worth saying so: this one passed before
// `isInsideRepo` existed. It had to — nothing guarded the spawn then, and `git
// ls-files` walks up by itself, so the subdirectory came back read-by-git for
// free.
//
// What changed is who provides that. The property now rests on code rather than
// on git's own behaviour, and the cheap-looking simplification of it —
// `isRepo(root)`, one look for `dir/.git` — fails here, because a subdirectory
// of a repository holds none of its own and would drop to the walk, changing
// its source, its count and its skipped-extension line together.
test('a subdirectory of a repository is still read with git, not walked', () => {
  const root = repo({ 'top.js': 'x\n', 'sub/a.js': 'x\n' });
  const result = survey.trackedFiles(path.join(root, 'sub'), {});
  assert.equal(result.walked, false, 'a bare .git check would have walked it');
  assert.deepEqual(result.files, ['a.js']);
});

// A walk that meets a repository splices `git ls-files` into its own list, and
// those entries used to arrive with nothing known about them. `--stage` puts the
// mode in front of each cached one, so the splice can say which are files.
//
// The prefix is the part that fails quietly. `known` holds paths from the nested
// repository and `files` holds them under `sub/`; mismatched, every lookup misses
// and the result is indistinguishable from git having said nothing at all.
test('the entries spliced in from a nested repository say which of them are files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-splice-'));
  const alpha = path.join(root, 'alpha');
  fs.mkdirSync(alpha);
  fs.writeFileSync(path.join(alpha, 'a.js'), 'x\n');
  fs.writeFileSync(path.join(alpha, 'README'), 'x\n');
  execFileSync('git', ['init', '-q'], { cwd: alpha });

  const sub = path.join(alpha, 'sub');
  fs.mkdirSync(sub);
  fs.writeFileSync(path.join(sub, 'deep.js'), 'x\n');
  execFileSync('git', ['init', '-q'], { cwd: sub });
  execFileSync('git', ['add', '-A'], { cwd: sub });
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'x'], { cwd: sub });
  execFileSync('git', ['add', '-A'], { cwd: alpha, stdio: ['ignore', 'ignore', 'ignore'] });

  const result = survey.trackedFiles(root, {});
  assert.equal(result.walked, true, 'the root is not a repository and should have been walked');
  assert.ok(result.files.includes('alpha/sub'), 'the gitlink left the list git put it in');
  assert.ok(result.known.has('alpha/a.js'), 'a file git named is still unknown, so it will be stat-ed');
  assert.equal(result.known.has('alpha/sub'), false, 'a whole repository was recorded as one file');
});

// The branch no git here has taken. `--stage` beside `--others` is verified on
// 2.44 and nowhere older, and a git that refuses the combination refuses the
// whole call rather than the flag — so without the retry this repository would
// read as unreadable and fall through to the walk, changing its source, its
// count and its skipped-extension line together. That is the failure the guard
// in front of the spawn was written to prevent, arriving by another door.
test('a git that refuses --stage still returns the list, with nothing known', (t) => {
  const root = repo({ 'a.js': 'x\n' });
  const cp = require('node:child_process');
  const real = cp.execFileSync;
  t.mock.method(cp, 'execFileSync', (file, args, opts) => {
    if (file === 'git' && args.includes('--stage')) throw new Error('fatal: unknown option `stage`');
    return real.call(cp, file, args, opts);
  });

  const result = survey.trackedFiles(root, {});
  assert.equal(result.walked, false, 'it fell through to the walk instead of asking git again');
  assert.deepEqual(result.files, ['a.js']);
  assert.equal(result.known.size, 0, 'something was called known from a list that carried no modes');
});

// `human` moved to `lib/report.js` with the two copies it had grown, and is
// tested in `tests/report.test.js`. It is named here because the tree line is
// the report that motivated it: a directory of three gigabytes read `3071.0M`.

// The note a truncated walk prints. It had no test in either wording, which is
// how it came to say "files" after the walk started counting parts — the number
// is a ceiling on parts now, and the emitted list can be shorter than it.
test('a truncated walk says so in terms of its ceiling, not its files', () => {
  const root = repo({ 'lib/a.js': 'function widgetFactory() {}\n' });
  const result = survey.scan(root, ['widget']);
  result.truncated = true;
  assert.match(survey.report(result, ['widget']), /the walk stopped at its 20000 ceiling/);
});
