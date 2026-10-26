'use strict';
// scripts/design-lint.js: fails a mockup on the excluded styles a stylesheet
// or markup shows; each rule is proved on the catalogue's own sample.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const tmp = require('./tmp.js');
const { lint, RULES } = require('../scripts/design-lint.js');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'design-lint.js');
const EXCLUDE = JSON.parse(fs.readFileSync(path.join(ROOT, 'skills', 'fankeel-design', 'catalog', 'exclude.json'), 'utf8'));
const page = (e) => '<style>' + e.css.replace(/%%/g, '.s') + '</style><div class="s">' + e.html + '</div>';
const CLEAN = `<style>
:root{--bg:#f7f7f5;--ink:#1c1c1a;--muted:#5c5c58;--primary:#2b4c7e;--accent:#c2410c}
body{margin:0;background:var(--bg);color:var(--ink);font-family:"Segoe UI",system-ui,sans-serif;font-size:16px;line-height:1.5}
h1{font-size:40px;font-weight:650;margin:0 0 12px}
p{max-width:65ch}
.btn{background:var(--primary);color:var(--bg);border-radius:6px;padding:10px 16px;transition:transform .2s ease-out}
.badge{color:var(--accent)}
code{font-family:Consolas,monospace;font-size:14px}
.menu{position:fixed;box-shadow:0 8px 24px rgba(28,28,26,.18)}
td{border-bottom:1px solid #dcdcd6}
</style>
<h1>Release notes</h1><p>Three fixes landed this week.</p><a class="btn" href="#">Read the changes</a><span class="badge">New</span><code>scripts/task.js</code>`;

test('every exclusion with a rule fails on its own sample, with that rule', () => {
    const ruled = EXCLUDE.items.filter((e) => e.check !== 'review');
    assert.equal(ruled.length, 12);
    for (const e of ruled) {
        const hits = lint(page(e), EXCLUDE).map((h) => h.rule);
        assert.ok(hits.includes(e.check), e.id + ' expected ' + e.check + ', got ' + hits.join(' '));
    }
});

test('every check names a rule that exists, or review', () => {
    for (const e of EXCLUDE.items) assert.ok(e.check === 'review' || RULES[e.check], e.id + ': ' + e.check);
});

test('a page drawn to the guide is clean', () => {
    assert.deepEqual(lint(CLEAN, EXCLUDE), []);
});

const rulesOf = (css, body) => lint('<style>' + css + '</style>' + (body || ''), EXCLUDE).map((h) => h.rule);

test('small-text fails under 12px and passes at 12px', () => {
    assert.ok(rulesOf('p{font-size:11px}').includes('small-text'));
    assert.ok(!rulesOf('p{font-size:12px}').includes('small-text'));
});

test('pure-bw fails on #fff and #000 and passes on #fafafa', () => {
    assert.ok(rulesOf('p{color:#000}').includes('pure-bw'));
    assert.ok(rulesOf('p{background:#fff}').includes('pure-bw'));
    assert.ok(!rulesOf('p{color:#fafafa;background:#111}').includes('pure-bw'));
});

test('transition-all fails on transition:all and passes on a named property', () => {
    assert.ok(rulesOf('a{transition:all .2s}').includes('transition-all'));
    assert.ok(!rulesOf('a{transition:transform .2s}').includes('transition-all'));
});

test('filler fails on visible placeholder copy and passes when the word is only in a class or style', () => {
    assert.ok(rulesOf('', '<p>Welcome to Acme</p>').includes('filler'));
    assert.ok(rulesOf('', '<p>Lorem ipsum dolor</p>').includes('filler'));
    assert.ok(!rulesOf('.acme{color:red}', '<p class="acme" title="acme">Release notes</p>').includes('filler'));
});

test('one element with a hover or pseudo-element on the accent is clean; two elements still fail', () => {
    const one = '<style>:root{--accent:#c2410c}.btn{color:var(--accent)}.btn:hover{color:var(--accent-600)}.btn::before{border-color:var(--accent)}</style>';
    assert.deepEqual(lint(one, EXCLUDE).map((h) => h.rule), []);
    const two = '<style>:root{--accent:#c2410c}.a{color:var(--accent)}.b:hover{color:var(--accent-600)}</style>';
    assert.deepEqual(lint(two, EXCLUDE).map((h) => h.rule), ['accent-overuse', 'accent-overuse']);
});

test('a comma inside :not() does not split the element', () => {
    const html = '<style>:root{--accent:#c2410c}.btn:not(.a, .b){color:var(--accent)}</style>';
    assert.deepEqual(lint(html, EXCLUDE).map((h) => h.rule), []);
});

test('a selector list of two accent users counts the two bases', () => {
    const html = '<style>:root{--accent:#c2410c}.a:hover, .b{color:var(--accent)}</style>';
    assert.deepEqual(lint(html, EXCLUDE).map((h) => h.rule), ['accent-overuse', 'accent-overuse']);
});

test('the accent token on two elements fails, on one it passes', () => {
    const one = '<style>:root{--accent:#c2410c}.a{color:var(--accent)}</style>';
    const two = '<style>:root{--accent:#c2410c}.a{color:var(--accent)}.b{border-color:var(--accent-600)}</style>';
    assert.deepEqual(lint(one, EXCLUDE), []);
    assert.deepEqual(lint(two, EXCLUDE).map((h) => h.rule), ['accent-overuse', 'accent-overuse']);
});

test('a purple gradient in rgb() or hsl() hits purple-gradient, a blue-green one does not', () => {
    const g = (c) => '<style>.a{background:linear-gradient(90deg,' + c + ')}</style>';
    const rules = (c) => lint(g(c), EXCLUDE).map((h) => h.rule);
    assert.deepEqual(rules('rgb(124,58,237),rgb(255,255,255)'), ['purple-gradient']);
    assert.deepEqual(rules('rgba(124,58,237,.8),#eee'), ['purple-gradient']);
    assert.deepEqual(rules('hsl(270,70%,50%),#eee'), ['purple-gradient']);
    assert.deepEqual(rules('hsla(270,70%,50%,.5),#eee'), ['purple-gradient']);
    assert.deepEqual(rules('rgb(20,120,160),#eee'), []);
});

test('the command exits 1 naming the rule and catalogue id, 0 on a clean page', () => {
    const dir = tmp('design-lint-');
    const bad = path.join(dir, 'bad.html');
    const good = path.join(dir, 'good.html');
    fs.writeFileSync(bad, '<style>b{background-clip:text}</style><b>x</b>');
    fs.writeFileSync(good, CLEAN);
    const r = spawnSync(process.execPath, [SCRIPT, bad], { encoding: 'utf8' });
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, /^gradient-text {2}ex-colour-gradient-text {2}b$/m);
    const g = spawnSync(process.execPath, [SCRIPT, good], { encoding: 'utf8' });
    assert.equal(g.status, 0, g.stdout);
    assert.match(g.stdout, /design-lint: clean/);
});
