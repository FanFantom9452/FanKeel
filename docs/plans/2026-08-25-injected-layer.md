---
status: design-intent
last_verified: 2026-08-25
source_of_truth: lib/stages.js, lib/render.js, scripts/orient.js
---

# Injected layer — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use the `fankeel-build` skill to
> implement this plan task by task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** the injected copy of every stage's output shape stops being thinner
than the skill's, and a test makes the two unable to drift apart again.

**Spec:** [2026-08-25-injected-layer-design.md](2026-08-25-injected-layer-design.md)

## Global Constraints

- **No dependencies.** `package.json` has none and gains none; tests run under
  `node --test`.
- **Every hook exits 0 on every path** — `docs/decisions/fankeel-shell.md:231`.
- **`rulesFor(name).join('\n').length < 2000` for all seven stages** —
  `tests/stages.test.js:82-85`. Headroom today: survey 563, design 535,
  plan 485, **build 82**, verify 747, audit 774, land 663.
- **Nothing caps a template.** Growth there is paid in prompt length, not in a
  failing test.
- Files are LF. Comments explain why, not what.

---

### Task 1: Pin the two copies, and bring the five up

**Files:**
- Modify: `lib/stages.js` (the `template` on survey, design, build, verify, audit)
- Modify: `tests/skills.test.js` (new test, and the comment at :85-88)

**Interfaces:**
- Consumes: `templateFor(name)` from `lib/stages.js`, unchanged signature.
- Produces: nothing new. `plan` and `land` templates are already identical to
  their skills and are not touched.

- [ ] **Step 1: Write the failing test**

In `tests/skills.test.js`, after the existing `each stage skill ends at the gate`
test:

```js
// Two copies of every stage's output shape: `template` in lib/stages.js,
// restated on every prompt, and the `## Output` block in the skill, read once
// on entering the stage. Both have to exist — a skill is also read with no task
// open, `/fankeel-audit` being the shipped case, and then nothing is being
// injected at all — so the duplication is deliberate and this is what stops it
// drifting.
//
// Five of seven had drifted, and every one the same way: the injected copy was
// the short one. The fuller version sat in the copy that recedes by thousands
// of tokens a turn, and the thin one in the copy that never does.
const outputBlock = (text) => {
  const m = /\n## Output\r?\n([\s\S]*?)(?:\r?\n## |$)/.exec(text);
  return m ? m[1] : '';
};

// Fences and blank lines are layout, not content, and `verify` splits its
// Output across two fences. Where the lines sit is not the claim.
const shape = (s) => String(s).split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && l !== '```');

test('each stage template is exactly the shape its skill shows', () => {
  const { FULL_ROUTE, templateFor } = require('../lib/stages.js');
  for (const stage of FULL_ROUTE) {
    const want = stage === 'audit' ? 'fankeel-audit' : 'fankeel-' + stage;
    const block = outputBlock(read(want));
    assert.ok(block, want + ' has no ## Output section');
    assert.deepEqual(shape(templateFor(stage)), shape(block), stage);
  }
});
```

- [ ] **Step 2: Run it and watch five stages fail**

```bash
node --test tests/skills.test.js
```

Expected: FAIL, and the assertion message names `survey`, `design`, `build`,
`verify` or `audit` — whichever is reached first. `plan` and `land` pass.

- [ ] **Step 3: Bring the five templates up**

In `lib/stages.js`, replace each `template:` array with the skill's shape.

`survey`:

```js
        template: [
            '<the map summary, quoted>',
            '<the scanner block, quoted>',
            '',
            '- path:line — what is there',
            '- path:line — what is there',
            '',
            'planned, not built: <the pages, or "none">',
            'not found: <terms that matched nothing>',
            'class: <class> — <why>',
            'then AskUserQuestion',
        ].join('\n'),
```

`design`:

```js
        template: [
            '<the approach, one sentence>',
            '',
            '| file | change |',
            '|---|---|',
            '| path | what happens to it |',
            '',
            'proves it done: <the test that fails now and passes after>',
            'against the map: <the page it touches, or "no conflict">',
            'unverified: <the one thing you have not checked>',
            'then AskUserQuestion',
        ].join('\n'),
```

`build`:

```js
        template: [
            '- path +12/-3 — what changed',
            '- path (new) — what it is',
            '',
            'ledger: <n> of <m> complete',
            'deferred: <TODO.md line, or omit this line>',
            'then AskUserQuestion',
        ].join('\n'),
```

`verify`:

```js
        template: [
            '```',
            '$ <command>',
            '<the line that decided it>',
            '```',
            '',
            '- <what you claimed> — held / did not hold',
            '- docs: <page:line that is now false, or "none">',
            'then AskUserQuestion',
        ].join('\n'),
```

`audit`:

```js
        template: [
            'node <plugin>/scripts/docs-check.js',
            '<its output, quoted>',
            '',
            'node <plugin>/scripts/docs-audit.js',
            '<its output, quoted>',
            '',
            '- path:line — what is no longer true',
            '- path:line × path:line — what they disagree about, and which one the code supports',
            '',
            'clean: <what you read and found nothing wrong in>',
            'then AskUserQuestion',
        ].join('\n'),
```

`audit` keeps `<plugin>/scripts/...` rather than a substituted path: the rules
two lines above already name the real ones, and every other line in a template
is a placeholder too.

- [ ] **Step 4: Correct the comment this change falsifies**

`tests/skills.test.js:85-88` still says the injected layer *cannot* carry
formats. It has carried them since `3dfad64`. Replace that paragraph:

```js
// Seven stages, and both layers carry the format. The skill is read once on
// entering a stage; the template rides every prompt, which is the copy that
// still exists three hundred entries later. The test below keeps them equal.
```

- [ ] **Step 5: Run the whole suite**

```bash
npm test
```

Expected: PASS, 571 tests, 0 failures. The 2000-character rules cap is
untouched — nothing in this task edits a `rules` array.

- [ ] **Step 6: Commit**

```bash
git add lib/stages.js tests/skills.test.js
git commit -m "feat: the injected output shape is the one the skill shows"
```

---

### Task 2: `audit` gains the instruction, not just the name

**Files:**
- Modify: `lib/stages.js` (audit `rules`)
- Modify: `tests/stages.test.js:359-364`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: nothing later tasks read.

- [ ] **Step 1: Tighten the test so it asserts the instruction**

`tests/stages.test.js:359-364` passes today because `audit`'s rules contain the
string `/fankeel-audit` — the slash command, in a rule about a fortnightly deep
pass. Matching the name is not matching the instruction. Replace the test body:

```js
test('every stage points at the skill holding the part that does not compress', () => {
  for (const name of NAMES) {
    const want = name === 'audit' ? 'fankeel-audit' : 'fankeel-' + name;
    // The instruction, not the mention. `audit` named its slash command in a
    // rule about a fortnightly pass and passed this test while never loading
    // the skill on the stage it belongs to.
    const re = new RegExp('(Read the ' + want + ' skill|the ' + want + ' skill has)');
    assert.match(byName(name).rules.join(' '), re, name + ' points at no skill');
  }
});
```

`build` is the `has` case: its rule reads `From a plan (the fankeel-build skill
has the loop)`.

- [ ] **Step 2: Run it and watch audit fail**

```bash
node --test tests/stages.test.js
```

Expected: FAIL — `audit points at no skill`.

- [ ] **Step 3: Add the rule**

In `lib/stages.js`, in `audit`'s `rules`, before the `Output:` rule:

```js
            'Read the fankeel-audit skill on entering this stage.',
```

- [ ] **Step 4: Run the test**

```bash
node --test tests/stages.test.js
```

Expected: PASS. `audit` rules go from 1226 to about 1278, well under 2000.

- [ ] **Step 5: Commit**

```bash
git add lib/stages.js tests/stages.test.js
git commit -m "feat: audit reads its own skill, and the test asks for the instruction"
```

---

### Task 3: The class's `means` reaches the prompt

**Files:**
- Modify: `lib/render.js` (`whereLines`)
- Modify: `tests/render.test.js`

**Interfaces:**
- Consumes: `CLASSES` from `lib/stages.js` — already exported.
- Produces: one more line in the injected block, after the `route:` line.

- [ ] **Step 1: Write the failing test**

In `tests/render.test.js`:

```js
// `means` is printed once, by `task.js start`, and never again. For `spike` it
// carries the only sentence that bounds what a spike may build — and `spike`'s
// route is survey,build, so it reaches neither `design`, which holds the rule
// about cutting what the ask does not require, nor `audit`, which delegates
// over-engineering to ponytail.
test('a spike is told on every prompt that what it builds is throwaway', () => {
  const text = render({
    mine: entry('aaaaaaaa', { class: 'spike', route: ['survey', 'build'], stage: 'build' }),
    others: [], now: NOW, root: 'F:\\ws', launch: 'F:\\ws',
  });
  assert.match(text, /Anything built is labelled throwaway/);
});

test('a class the registry does not recognise adds no line', () => {
  const text = render({
    mine: entry('aaaaaaaa', { class: 'nonesuch', stage: 'build' }),
    others: [], now: NOW, root: 'F:\\ws', launch: 'F:\\ws',
  });
  assert.doesNotMatch(text, /^class: /m);
});
```

`entry()` in that file returns `{ sessionId, data }`, which is the shape
`render` takes for `mine`.

- [ ] **Step 2: Run it and watch it fail**

```bash
node --test tests/render.test.js
```

Expected: FAIL on the first test — no match for `throwaway`.

- [ ] **Step 3: Add the line**

In `lib/render.js`, add `CLASSES` to the `require` from `./stages.js`.
`whereLines` returns an array literal with nothing to push to, so bind it first:

```js
function whereLines(data) {
    const route = normaliseRoute(data && data.route) || FULL_ROUTE;
    const at = positionIn(route, stageOf(data));
    const out = [
        'FANKEEL ACTIVE — ' + taskOf(data) + ' @ ' + stageOf(data) + (at ? '  (' + at.step + ' of ' + at.steps + ')' : ''),
        'route: ' + route.map((r) => (r === stageOf(data) ? '[' + r + ']' : r)).join(' → '),
    ];
    // The class is stated once at `task.js start` and never again, which is the
    // decay this whole block exists to defeat. `spike` is the one that cannot
    // afford it: its route reaches neither the rule about cutting scope nor the
    // stage that delegates over-engineering.
    const cls = data && typeof data.class === 'string' ? data.class : '';
    const means = CLASSES[cls] && CLASSES[cls].means;
    if (means) out.push('class: ' + cls + ' — ' + means);
    return out;
}
```

`whereLines` opens both the injected block and the shorter resume block, so the
line appears in both. That is the point: the resume block is what a stage gets
back after an `AskUserQuestion`, which is where a long `build` loop lives.

- [ ] **Step 4: Run the suite**

```bash
npm test
```

Expected: PASS. Existing `render` tests assert on lines they name rather than on
the block's total length, so an added line does not break them. If one does, it
is asserting the shape of the whole block, and that assertion — not this line —
is what needs revisiting. Say so rather than deleting the line.

- [ ] **Step 5: Commit**

```bash
git add lib/render.js tests/render.test.js
git commit -m "feat: the class says what it means on every prompt, not only at start"
```

---

### Task 4: `orient` says which question its count answered

**Files:**
- Modify: `scripts/orient.js:245,299,312,314`
- Modify: `tests/orient.test.js`

**Interfaces:**
- Consumes: `readLive` and `isLive` from `lib/live.js` — already used by four
  other callers.
- Produces: nothing.

- [ ] **Step 1: Write the failing test**

In `tests/orient.test.js`:

```js
// `readActive` reports intent; `lib/live.js` reports fact. Both readings are
// right, and orient was the only one of five callers printing a number without
// saying which it was — so `orient: 1 active` beside `task.js show: none` read
// as a contradiction rather than as the two answers it is.
test('the registry line says how many entries are live, not only how many are active', () => {
  const root = workspace({ 'a/.git/HEAD': 'ref: refs/heads/main\n' });
  fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.fankeel', 'sessions', 'deadbeef-0000-0000-0000-000000000000.json'),
    JSON.stringify({ task: 'gone', stage: 'land', active: true }),
  );
  const out = execFileSync(process.execPath, [SCRIPT, '--root', root], { encoding: 'utf8' });
  assert.match(out, /1 active, 0 live/);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
node --test tests/orient.test.js
```

Expected: FAIL — the output says `1 active`.

- [ ] **Step 3: Count the live ones**

In `scripts/orient.js`, require `lib/live.js` beside `lib/registry.js`, then at
line 245:

```js
    const active = stateRoot ? registry.readActive(stateRoot) : [];
    // No session id to self-check against here — orient is a CLI, not a hook —
    // so `readLive` reports unknown and `isLive` turns unknown into live. That
    // is the right direction for a listing: the doubt shows the entry rather
    // than hiding it.
    const liveState = live.readLive(live.liveConfigDir(), null);
    const alive = active.filter((e) => live.isLive(liveState, e.sessionId)).length;
```

Add `alive` to the object returned at line 299, then at 312 and 314:

```js
        lines.push('registry: here, ' + result.active.length + ' active, ' + result.alive + ' live');
```

```js
        lines.push('registry: ' + result.stateRoot + ', ' + result.active.length + ' active, ' + result.alive + ' live');
```

- [ ] **Step 4: Run the suite**

```bash
npm test
```

Expected: PASS. `docs/pipeline.md:29-41` shows the `registry: none at or above
here` branch, which this does not touch — confirm by reading it rather than by
assuming.

- [ ] **Step 5: Commit**

```bash
git add scripts/orient.js tests/orient.test.js
git commit -m "feat: orient names which of the two questions its count answers"
```
