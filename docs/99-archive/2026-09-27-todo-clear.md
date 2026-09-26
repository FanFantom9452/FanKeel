---
status: current
---

# TODO clear Implementation Plan

**Goal:** the plan and design stages name the project's own plan bucket, and the settings wizard's `auto` option shows the open icon its mockup drew.
**Architecture:** `lib/render.js` gains `planDir(projectRoot)`, which reads the `role: plan` bucket out of `docs.json`; a render token `{{PLAN_DIR}}` carries it into the stage rules. The wizard fix is one icon string emitted by `seg()` plus two CSS rules copied from the approved mockup.
**Tech Stack:** Node, CommonJS, no dependencies; tests run with `node --test`.
**Spec:** [2026-09-27-todo-clear-design.md](2026-09-27-todo-clear-design.md)

## Global Constraints

- No dependencies may be added: `package.json` has no `dependencies` block; `"test": "node --test"`.
- `lib/` indents 4 spaces; `tests/render.test.js` indents 2; `tests/station-wizard.test.js` indents 4. Match the file being edited.
- `lib/stages.js` rule strings write an em dash as `—`; keep that spelling in any rule you touch.
- Each stage's `budget` in `lib/stages.js` (2400 for `plan`, 2500 for `design`) and `BLOCK_CAP` in `lib/render.js` are asserted by tests. Shorten a rule that no longer fits; never raise a budget or the cap.
- A render token whose value is falsy is left raw by `substitute` (`lib/stages.js:562`). `{{PLAN_DIR}}` must therefore always have a value: `docs/plans` when there is no root.
- Filing (`.fankeel/map.md`): plans go in `docs/90-agent/plans`; reference pages in `docs/90-agent/reference`; the index is `docs/README.md`.
- Commits: `feat:` / `fix:` / `docs:` subject, then the `Co-Authored-By:` trailer.
- Close the `TODO.md` entry the task delivers in the same change.

## Task 1: `{{PLAN_DIR}}` — the stage rules name the plan bucket from docs.json

**Files:**
- Modify: `lib/render.js` — add `planDir` and `projectRootOf`; `newestPlan`, `subsFor`, the `read first` call and the brain's artifact line use them; export `planDir`
- Modify: `lib/stages.js` — `RENDER_TOKENS.planDir`; the plan rule and two template lines stop spelling `docs/plans`
- Modify: `skills/fankeel-build/SKILL.md` — `docs/plans/<file>.md` becomes `<plan bucket>/<file>.md` on lines 58, 59, 118, 130, 186, 217, 247
- Modify: `skills/fankeel-design/SKILL.md` — line 217's path and line 253's `spec:` slot
- Modify: `skills/fankeel-plan/SKILL.md` — line 49's path, line 300's lint command, line 323's template
- Modify: `skills/fankeel-land/SKILL.md` — line 87's archive command
- Modify: `docs/90-agent/reference/station.md` — line 350's `docs/plans/<stem>.md`
- Modify: `TODO.md` — remove the `## Needs a decision` `〔docs〕lib/stages.js …` entry
- Read: `lib/docs.js` — `read(root)` returns `{ tree }` whose `tree.buckets` are `{ path, role }`; `projectRootsFor(root, names)`
- Test: `tests/render.test.js`
- Test: `tests/stages.test.js` — lines 670 and 686 assert the old design `spec:` template line

**Interfaces:**
- Consumes: none
- Produces: `planDir(projectRoot) -> string` (a `/`-separated path relative to the project root, exported from `lib/render.js`); render token `{{PLAN_DIR}}` / subs key `planDir`

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

- [ ] **Step 1: the failing test.** In `tests/render.test.js`, change the `sub` helper so comparisons substitute the new token, then add the test at the end of the file:

In `tests/render.test.js`, replace the `sub` helper with:

```js
const sub = (stage, route) => rulesFor(stage, Object.assign(
  { next: nextStage(stage, route) || 'standing the task down', planDir: 'docs/plans' }, SCRIPTS));
```

In `tests/render.test.js`, at the end, add:

```js
test('the plan rule names the plan bucket the project\'s docs.json declares', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'plandir-'));
  fs.mkdirSync(path.join(root, '.fankeel'));
  fs.writeFileSync(path.join(root, '.fankeel', 'docs.json'),
    JSON.stringify({ buckets: [{ path: 'docs/90-agent/plans', role: 'plan' }] }));
  const out = render({ mine: entry(MINE, { stage: 'plan', project: undefined }), others: [], now: NOW, root });
  assert.match(out, /Write docs\/90-agent\/plans\/<date>-<topic>\.md/);
  assert.doesNotMatch(out, /docs\/plans\//);
});

test('without a docs.json the plan rule falls back to docs/plans, never a raw token', () => {
  const out = render({ mine: entry(MINE, { stage: 'plan' }), others: [], now: NOW, root: '/r' });
  assert.match(out, /Write docs\/plans\/<date>-<topic>\.md/);
  assert.doesNotMatch(out, /\{\{PLAN_DIR\}\}/);
});
```

- [ ] **Step 2: run it and watch the first test fail.** `node --test tests/render.test.js` — expect `the plan rule names the plan bucket …` to fail on the `assert.match` (the rule still says docs/plans). If `docs.read` rejects the fixture for a missing field, add that field to the fixture rather than changing `lib/docs.js`.

- [ ] **Step 3: `lib/render.js`.** Directly above `function newestPlan`, add:

In `lib/render.js`, above `newestPlan`, add:

```js
// The project's plan bucket: the `role: plan` path its docs.json declares, and
// `docs/plans` where it declares none — the flat and phased presets' spelling.
function planDir(projectRoot) {
    const { tree } = docs.read(projectRoot);
    const bucket = tree && tree.buckets.find((b) => b.role === 'plan');
    return bucket ? bucket.path : 'docs/plans';
}
const projectRootOf = (root, data) => docs.projectRootsFor(root, data && data.project ? [data.project] : [])[0] || root;
```

In `lib/render.js`, in `newestPlan`, replace the three lines from `const { tree } = require('./docs.js').read(projectRoot);` through `const dir = …` with:

```js
    const dir = path.join(projectRoot, ...planDir(projectRoot).split('/'));
```

In `lib/render.js`, in `subsFor`, directly after the `if (file) subs.designHandoff = …` line, add:

```js
    subs.planDir = root ? planDir(projectRootOf(root, data)) : 'docs/plans';
```

In `lib/render.js`, in the `read first` call (`const plan = before ? null : newestPlan(…)`), replace the `docs.projectRootsFor(…)[0] || root` argument with `projectRootOf(root, data)`.

In `lib/render.js`, in the `if (stage === 'design' || stage === 'plan')` branch, replace the `const file = …` line with:

```js
        const dir = planDir(projectRootOf(root, data));
        const file = stage === 'plan' ? dir + '/<date>-<topic>.md' : dir + '/<date>-<topic>-design.md, and only where the design skill calls for a spec (the architectural class)';
```

In `lib/render.js`, add `planDir` to `module.exports` after `newestPlan`. Update the comment above `newestPlan` from "The newest docs/plans/*.md" to "The newest plan in the plan bucket".

- [ ] **Step 4: `lib/stages.js`.** In `RENDER_TOKENS`, after `designHandoff`, add `planDir: '{{PLAN_DIR}}',`. Then in `lib/stages.js`:

In `lib/stages.js`, the plan rule becomes:

```js
            'Write {{PLAN_DIR}}/<date>-<topic>.md, headed by the goal, the spec path, and Global Constraints taken from `node {{MAP}}`.',
```

In `lib/stages.js`, the design template's `spec:` line becomes:

```js
            'spec: <plan-bucket path, build handoff path, or "in chat">',
```

In `lib/stages.js`, the plan template's first line becomes (templates are not substituted, `lib/render.js:182`):

```js
            '<plan path> — <n> tasks',
```

In `tests/stages.test.js`, lines 670 and 686 both become:

```js
  assert.match(templateFor('design'), /^spec: <plan-bucket path, build handoff path, or "in chat">$/m);
```

- [ ] **Step 5: the skills and the reference page.** Replace, and change nothing else on each line:
  - `skills/fankeel-build/SKILL.md` lines 58, 59, 118, 130, 186, 217, 247: `docs/plans/<file>.md` → `<plan bucket>/<file>.md`.
  - `skills/fankeel-design/SKILL.md` line 217: `` `docs/plans/YYYY-MM-DD-<topic>-design.md` `` → `` `<plan bucket>/YYYY-MM-DD-<topic>-design.md` — the `role: plan` bucket in `docs.json`, `docs/plans` where none is declared — ``; line 253: `spec: <docs/plans path,` → `spec: <plan-bucket path,`.
  - `skills/fankeel-plan/SKILL.md` line 49: the same replacement as design's line 217 without `-design`; line 300: `docs/plans/<file>.md` → `<plan bucket>/<file>.md`; line 323: `docs/plans/<date>-<topic>.md — <n> tasks` → `<plan path> — <n> tasks`.
  - `skills/fankeel-land/SKILL.md` line 87: both `docs/plans/` → `<plan bucket>/`.
  - `docs/90-agent/reference/station.md` line 350: `` a `docs/plans/<stem>.md` `` → `` a `<stem>.md` in the plan bucket ``.
  - `TODO.md`: delete the `## Needs a decision` bullet opening `〔docs〕lib/stages.js 的 design/plan artifact`.

- [ ] **Step 6: run and watch it pass.** `node --test tests/render.test.js tests/stages.test.js` — both green. Then `node scripts/docs-check.js` and `node scripts/todo-check.js` exit 0.

- [ ] **Step 7: commit.** `fix: the plan and design rules name the plan bucket docs.json declares`.

## Task 2: the wizard's `auto` option shows the open icon

**Files:**
- Modify: `assets/station/station.js` — `WIZ_FE_OPEN`, `WIZ_FE_AUTO.open`, `seg()` emits the icon
- Modify: `assets/station/station.css` — the two `.fopen` rules
- Modify: `TODO.md` — remove the `## Ready` `〔wizard〕auto 選項缺 mockup 有畫的外開圖示` entry
- Read: `.fankeel/build/2026-09-26-ready-five/parts/cards.html` — line 18, the approved markup
- Test: `tests/station-wizard.test.js`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

- [ ] **Step 1: the failing test.** In `tests/station-wizard.test.js`, at the end, add:

```js
test('only the auto option carries the open icon', () => {
    let W = load();
    W = V.wizApply(W, KEYS, PROFILES, { go: '2' });
    const buttons = V.wizHtml(KEYS, W, PROFILES, CTX).match(/<button type="button" class="fsg[\s\S]*?<\/button>/g);
    const withIcon = buttons.filter((b) => b.includes('class="fopen"'));
    assert.equal(withIcon.length, 1);
    assert.match(withIcon[0], /<b>auto/);
});
```

- [ ] **Step 2: run it and watch it fail.** `node --test tests/station-wizard.test.js` — expect `withIcon.length` 0.

- [ ] **Step 3: `assets/station/station.js`.** Directly after the `var WIZ_FE_WARN = …;` line, add the mockup's glyph verbatim, and mark `auto`:

In `assets/station/station.js`, after `WIZ_FE_WARN`, add, and replace the `WIZ_FE_AUTO` line with the second line:

```js
    var WIZ_FE_OPEN = '<svg class="fopen" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2.5h4v4M13.5 2.5 8 8M11.5 9.5v3.5h-9v-9H6"/></svg>';
    var WIZ_FE_AUTO = { o: 'auto', h: 4, d: '直接畫，畫完開頁面', open: true };
```

In `assets/station/station.js`, in `seg()`, replace the last line of the returned string (`+ (m.cost ? '<span class="fcost" …' + bars + '</span>' : '') + '</button>';`) with:

```js
                + (m.cost ? '<span class="fcost" aria-hidden="true">' + bars + '</span>' : '') + (m.open ? WIZ_FE_OPEN : '') + '</button>';
```

- [ ] **Step 4: `assets/station/station.css`.** Directly after the `.wz .fsg+.fsg{…}` rule, add the mockup's two rules (lines 113-114 of the mockup's style part):

In `assets/station/station.css`, after `.wz .fsg+.fsg`, add:

```css
.wz .fsg .fopen{grid-column:2;grid-row:1 / span 2;width:18px;height:18px;color:var(--ink2)}
.wz .fsg[aria-checked="true"] .fopen{color:var(--panel)}
```

In `TODO.md`, delete the `## Ready` bullet opening `〔wizard〕auto 選項缺`.

- [ ] **Step 5: run and watch it pass.** `node --test tests/station-wizard.test.js` green; `node scripts/todo-check.js` exits 0.

- [ ] **Step 6: commit.** `fix: the wizard's auto option draws the open icon its mockup has`.

## Coverage

| promise | task |
|---|---|
| `lib/render.js` gets `planDir(projectRoot)`: the path of the `role: plan` bucket | Task 1 |
| `subsFor` adds a render token `{{PLAN_DIR}}` (`lib/stages.js` `RENDER_TOKENS`) | Task 1 |
| The design rule's `spec:` line, the plan rule's "Write …" line and the brain's artifact line | Task 1 |
| The plan template's first line becomes `<plan path> — <n> tasks`: templates are | Task 1 |
| `skills/fankeel-{design,plan,build,land}/SKILL.md` and the two reference pages | Task 1 — `station.md`; `improvement-brief.md:620` is a question the brief asked, not a claim about the system, and stays |
| Stage byte budgets still hold; a rule that no longer fits is shortened | Task 1 |
| `WIZ_FE_AUTO` carries `open: true`; `seg()` appends the mockup's | Task 2 |
| `station.css` gets the mockup's two rules (`parts/style.html:113-114`): | Task 2 |
| The `audit` stage runs `/fankeel-audit` in full — pairs, the page reads in | struck — this task's `audit` stage, not a build task |
| Its findings are fixed or filed at the audit gate, not in build. | struck — this task's `audit` stage |
| At `land`, every `## Waiting` timing's stamp moves to the land date | struck — this task's `land` stage |
| The `## Needs a decision` entry and the `〔wizard〕` and `〔audit〕` `## Ready` entries | Task 1, Task 2; the `〔audit〕` entry at the `audit` stage |
| A test renders the plan stage's rules for a project whose `docs.json` files | Task 1 |
| A test renders `wizFrontHtml` with `design.mockup` unset and finds | Task 2 |
