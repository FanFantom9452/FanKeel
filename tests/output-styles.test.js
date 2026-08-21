'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'output-styles');

// A style is appended to the system prompt on every single request, which is the
// whole reason it does not decay. It is also the cheapest instruction there is:
// one copy per request, read by the model and never by the user, where anything
// injected per turn stacks a fresh copy into the transcript each time. A cap here
// is about whether it still gets read to the end, not about what it costs.
//
// One cap per style rather than one shared cap. `fankeel-pipeline` is the
// largest because it carries three disciplines the other two do not — the gate,
// the shape of a question, and what goes wrong writing a language that is not
// English — and a shared cap sized for it would let the small two triple without
// anyone noticing.
const MAX_BYTES = {
  'fankeel-terse.md': 3072,
  'fankeel-review.md': 3072,
  'fankeel-pipeline.md': 5632,
};
const DEFAULT_MAX = 4096;

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.md'));

// Enough of a YAML reader for `key: value` frontmatter, which is all these have.
// A real parser would be a dependency, and this plugin has none.
function frontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (kv) out[kv[1]] = kv[2].trim();
  }
  return out;
}

const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');

test('there are output styles to load at all', () => {
  assert.ok(files.length >= 1, 'output-styles/ is empty');
});

test('plugin.json points at the directory, and the marketplace manifest does not', () => {
  const plugin = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));
  assert.equal(plugin.outputStyles, './output-styles/');

  // Declaring the same thing in both manifests is a conflict Claude Code
  // refuses to load, so the second declaration must stay absent.
  const market = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin', 'marketplace.json'), 'utf8'));
  for (const entry of market.plugins) {
    assert.equal(entry.outputStyles, undefined, 'the marketplace manifest also declares outputStyles');
  }
});

for (const file of files) {
  const label = file.replace(/\.md$/, '');

  test(label + ': has frontmatter with a name and a description', () => {
    const fm = frontmatter(read(file));
    assert.ok(fm, 'no frontmatter block');
    assert.ok(fm.name, 'no name');
    assert.ok(fm.description, 'no description');
  });

  test(label + ': the name matches the filename', () => {
    // The name is what appears in the /config picker and what settings.json
    // records. A name that disagrees with the file is a style the user cannot
    // find again after they pick it.
    assert.equal(frontmatter(read(file)).name, label);
  });

  test(label + ': the description says what the style does, in one line', () => {
    const d = frontmatter(read(file)).description;
    assert.ok(d.length > 20, 'too short to tell two styles apart in the picker');
    assert.ok(d.length < 140, 'the picker shows one line: ' + d.length + ' chars');
    assert.equal(/TODO|TBD|placeholder/i.test(d), false, 'the scaffold text survived');
  });

  test(label + ': keeps the coding instructions', () => {
    // Without this the style replaces Claude Code's own tool and safety
    // instructions rather than being appended to them.
    assert.equal(frontmatter(read(file))['keep-coding-instructions'], 'true');
  });

  test(label + ': does not force itself on the user', () => {
    // force-for-plugin applies the style automatically and overrides whatever
    // the user picked in /config. fankeel is opt-in per session; it does not get
    // to seize the voice of every session on the machine.
    assert.notEqual(frontmatter(read(file))['force-for-plugin'], 'true');
  });

  test(label + ': tells the model to answer in the user’s language', () => {
    // The one rule whose absence fails silently and badly: a style written in
    // English reads as an instruction to answer in English, and a bilingual
    // user's replies quietly switch language.
    assert.match(read(file), /language the user writes in/);
  });

  test(label + ': stays small enough to ride on every request', () => {
    const cap = MAX_BYTES[file] || DEFAULT_MAX;
    const bytes = Buffer.byteLength(read(file));
    assert.ok(bytes <= cap, file + ' is ' + bytes + ' bytes, cap is ' + cap);
  });

  test(label + ': has a body under the frontmatter', () => {
    const body = read(file).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim();
    assert.ok(body.length > 200, 'the prompt body is empty or near-empty');
  });
}

test('the three styles are distinct, not one file copied twice', () => {
  const bodies = files.map((f) => read(f).replace(/\s+/g, ' ').trim());
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      assert.notEqual(bodies[i], bodies[j], files[i] + ' and ' + files[j] + ' are identical');
    }
  }
});
