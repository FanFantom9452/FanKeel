---
status: current
---

# Explain Skill Implementation Plan

**Goal:** fankeel ships no output style; its voice comes from the injected rules and a new on-demand `fankeel-explain` skill, survey's shape names what is not known, and `caveman.zip` is gone.
**Architecture:** Five tasks, ordered so the suite stays green after each: the zip and the survey line stand alone; the skill lands before the pages that name it; the pages stop describing the styles before the styles are deleted. Nothing in the injected layer grows except survey's one template line.
**Tech Stack:** Node, no dependencies; `node --test` with the spec reporter.
**Spec:** 2026-09-13-explain-skill-design.md

## Global Constraints

- The spec reporter prints `✔`/`✖` and `ℹ pass N` / `ℹ fail N`; filter with `grep -E '^(ℹ (pass|fail)|✖)'`, never for `ok` — a grep for ok is always empty.
- A stage's rendered block is `< 2400` and init's `< 1400`, measured by `sizeAtReference()` from `tests/reference-size.js` — `tests/render.test.js:530`, `:555`, `:567`. survey measured 2339 on 2026-09-13.
- A skill's `name` equals its directory and matches `/^[a-z0-9-]+$/` — `tests/skills.test.js:72-73`.
- A skill's description is `> 60` and `< 500` characters and matches `/Use for|Use when/` — `tests/skills.test.js:80-82`.
- A stage's `template` in `lib/stages.js` and the fence under its skill's `## Output` are deep-equal — `tests/skills.test.js:461-467`.
- `skills/` holds exactly the `SKILLS` array, sorted, plus `registry.json` — `tests/inventory.test.js:13-40`.
- `ALWAYS.length <= 4` — `tests/stages.test.js:60`.
- `skills/registry.json` is written by `node scripts/stage-registry.js` and must equal a fresh regeneration — `tests/stage-registry.test.js:21`; each stage's `prompt_bytes <= prompt_byte_budget` of 2400 — `:28`. This measure includes the profile line, so it runs above the render test's: survey is 2377 here against 2339 there, and this is the binding one.
- `tests/contract.test.js:262` counts the files that carry the version — two manifests and one `version:` line per skill — and six files say that count in words; `:354` counts the top-level pages of `docs/` against the word at `docs/README.md:9`.
- Each stage's anchor in `tests/pipeline-doc.test.js:18-26` must be a contiguous substring of that stage's rules and of its `### <stage>` section in `docs/pipeline.md`, both flattened.
- A page in `docs/archive/` carries `status: archived` (33 of the archive's pages do).
- A decision record's frontmatter is `status`, `last_verified`, `source_of_truth` — `docs/decisions/2026-09-11-todo-split.md:1-5`.
- A line added to or removed from `lib/stages.js` moves every `lib/stages.js:N` citation below it: 18 of them across `skills/fankeel-{build,design,land,plan,survey,verify}/SKILL.md`. `node scripts/docs-check.js` prints each corrected number. A comment rewrite keeps its line count.
- `scripts/todo-check.js:84` flags a bullet linking to a page whose role is in `STALE_ROLES = ['decision', 'plan', 'report', 'archive']`, and `:47` caps a bullet at `MAX_ENTRY_CHARS = 200`.
- The test command is exactly `node --test` — `package.json:8`. There is no `dependencies` key, and none is added — `package.json:1-11`. There is no `CLAUDE.md`.
- Every bucket `.fankeel/docs.json` declares has a row in the `## Roles` table of `docs/README.md` — `tests/docs.test.js:492-503` — so a bucket and its row leave in the same task.
- A reference page linking into `docs/archive/` is a `docs-check` finding tagged `into-archive` — `tests/docs.test.js:278-285`. A dead link inside an archived page is not a finding — `tests/docs.test.js:159-166`.
- An implementer runs only the test files its task names. The parent runs the whole suite — `node --test 2>&1 | grep -E '^(ℹ (pass|fail)|✖)'` showing `ℹ fail 0` — before committing each group: a shared tree hides cross-file red until then.
- Edit files with the Edit and Write tools: a heredoc eats backslashes, and a Python write on this machine turns a file CRLF.
- Every commit subject is `type: what changed` under 60 characters, and every message ends with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
- Dated records are not edited: `docs/plans/`, `docs/decisions/` (other than the new record), `docs/judgements/`, `docs/reports/`, `docs/archive/` (other than the moved page).

## File structure

| file | responsibility | task |
|---|---|---|
| `.gitignore`, `tests/docs.test.js` | lose the two lines naming the zip | 1 |
| `lib/stages.js` (survey template), `skills/fankeel-survey/SKILL.md` | the `unknown:` slot | 2 |
| `skills/fankeel-{design,plan,build,verify,land}/SKILL.md` | citations below the new line, moved by one | 2 |
| `skills/fankeel-explain/SKILL.md` | the ten principles, on demand | 3 |
| `docs/decisions/2026-09-13-no-output-styles.md` | why no style ships | 4 |
| `docs/archive/2026-09-13-output-styles.md` | the retired reference page | 4 |
| `README.md`, `docs/README.md`, `skills/fankeel/SKILL.md`, `TODO.md` | stop describing styles | 4 |
| `output-styles/`, `.claude-plugin/plugin.json`, `.fankeel/docs.json` | the styles stop shipping | 5 |
| `lib/stages.js` (two comments), `tests/stages.test.js`, `tests/brief.test.js` | comments stop reasoning from a style | 5 |

## Task 1: caveman.zip goes

**Files:**
- Modify: `caveman.zip` — deleted from disk; it is untracked and gitignored
- Modify: `.gitignore` — the comment and entry at :6-8, and the blank line above them, removed
- Modify: `tests/docs.test.js` — the comment at :509 names `.impeccable/` instead of `caveman.zip`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** in-session — deleting an untracked file needs a shell, and the other two changes are one line each.

1. Red: `test ! -e caveman.zip && ! git grep -q "caveman.zip" -- .gitignore tests/ && echo gone` prints nothing.
2. `rm caveman.zip`
3. In `.gitignore`, remove these lines and the blank line above them:

   ```text
   # The user's own material, dropped here rather than committed: four documents
   # behind the improvement brief. Nothing in this repository points at it.
   caveman.zip
   ```

4. In `tests/docs.test.js`, replace line 509 with:

   ```js
   // it. Other tools' ignored paths — `.superpowers/`, `.impeccable/` — are not
   ```

5. Green: the command in step 1 prints `gone`.
6. `node --test tests/docs.test.js 2>&1 | grep -E '^(ℹ (pass|fail)|✖)'` shows `ℹ fail 0`.
7. Commit `.gitignore` and `tests/docs.test.js`: `chore: caveman.zip goes, and the lines naming it`.

## Task 2: survey says what it does not know

**Files:**
- Modify: `lib/stages.js` — survey's first rule gives up `Nothing matched is a finding.`; its `template` gains `unknown:` after `not found:`
- Modify: `skills/fankeel-survey/SKILL.md` — the `## Output` fence gains the same line
- Modify: `skills/registry.json` — regenerated; survey's `prompt_bytes` moves from 2377 to 2388
- Modify: `skills/fankeel-design/SKILL.md` — `lib/stages.js:N` citations below the new line move by one
- Modify: `skills/fankeel-plan/SKILL.md` — same
- Modify: `skills/fankeel-build/SKILL.md` — same
- Modify: `skills/fankeel-verify/SKILL.md` — same
- Modify: `skills/fankeel-land/SKILL.md` — same
- Test: `tests/stages.test.js`
- Test: `tests/pipeline-doc.test.js` — survey's anchor moves to a phrase the rule still carries
- Read: `tests/reference-size.js` — how the render test measures a block
- Read: `lib/stage-registry.js` — `buildRegistry()`, which measures `prompt_bytes`
- Read: `docs/pipeline.md` — the survey diagram already carries the new anchor, and does not change

**Interfaces:**
- Consumes: `templateFor(name)` from `lib/stages.js`, exported at :580
- Produces: the survey template line `unknown: <needs confirming, or "none">`

**Dispatch:** implementer, sonnet — the plan carries every line; transcription, two test runs and a citation sweep.

**Ruling:** the design's section 4 estimated the room with the render test's measure (2339 of 2400). `skills/registry.json` measures with the profile line and is the binding budget: survey is 2377 of 2400, and the new line alone makes it 2418. So survey's first rule gives up `Nothing matched is a finding.` — the template's `not found:` slot asks for that same report, and `skills/fankeel-survey/SKILL.md` states it in bold under its step 4. Measured in memory with `buildRegistry()` on 2026-09-13: both changes together come to 2388. The anchor `tests/pipeline-doc.test.js` used for survey was that sentence, so it moves to `every path:line checked before it returns`, which the rule and the survey diagram in `docs/pipeline.md` both carry already.

1. In `tests/stages.test.js`, directly after the test `the always-on block stays short enough to ride every prompt`, add:

   ```js
   // survey reports what it found and what matched nothing. What it could not find
   // out is a third thing, and without a slot of its own the gap gets filled in
   // rather than said.
   test('the survey shape has a slot for what is not known', () => {
     assert.match(templateFor('survey'), /^unknown: <needs confirming, or "none">$/m);
   });
   ```

2. `node --test tests/stages.test.js 2>&1 | grep -E '^(ℹ (pass|fail)|✖)'` shows `ℹ fail 1`, and the failure is the new test's assertion, not a TypeError.
3. In `lib/stages.js`, in the survey entry's `template:` array, directly after `'not found: <terms that matched nothing>',`, add:

   ```js
               'unknown: <needs confirming, or "none">',
   ```

   In `lib/stages.js`, survey's first rule (:218) loses its last sentence and becomes:

   ```js
               'Before creating anything, run `node {{SURVEY}} [--root <dir>] <term>...` and quote it.',
   ```

   In `tests/pipeline-doc.test.js`, the survey entry of `ANCHOR` (:19) becomes:

   ```js
     survey: 'every path:line checked before it returns',
   ```

4. In `skills/fankeel-survey/SKILL.md`, inside the fence under `## Output`, directly after `not found: <terms that matched nothing>`, add the line:

   ```text
   unknown: <needs confirming, or "none">
   ```

5. `node --test tests/stages.test.js tests/skills.test.js tests/render.test.js 2>&1 | grep -E '^(ℹ (pass|fail)|✖)'` shows `ℹ fail 0`. Quote the survey size line from `node --test --test-reporter=spec tests/render.test.js` unpiped; it must be under 2400.
6. `node scripts/docs-check.js`, unpiped. For every `lib/stages.js:N` citation it reports in the five skills above, apply the corrected number it prints. Re-run until it reports every reference resolving. Then `node scripts/stage-registry.js`, and `node --test tests/stage-registry.test.js tests/pipeline-doc.test.js tests/stages.test.js 2>&1 | grep -E '^(ℹ (pass|fail)|✖)'` shows `ℹ fail 0`; survey's entry in `skills/registry.json` reads `"prompt_bytes": 2388`.
7. Commit: `feat: survey's shape names what is not known`.

## Task 3: the fankeel-explain skill

**Files:**
- Modify: `skills/fankeel-explain/SKILL.md` — new, the approved text below, byte for byte
- Test: `tests/inventory.test.js`
- Test: `tests/contract.test.js` — the version-carrying count moves from 11 to 12, and its comment's nine skills to ten
- Test: `tests/version.test.js` — the same count, in a test name, its assertion and three comments
- Modify: `scripts/version.js` — the count in its header comments
- Modify: `CONTRIBUTING.md` — `eleven files` at :23
- Modify: `docs/development.md` — `eleven files` at :64 and :66, `nine skills` at :67
- Modify: `skills/fankeel-land/SKILL.md` — `the eleven places` at :78, and the eleven files and nine skills at :83-84

**Interfaces:**
- Consumes: none
- Produces: the skill `fankeel-explain` at `skills/fankeel-explain/SKILL.md`

**Dispatch:** implementer, sonnet — one approved file transcribed and one list entry.

1. In `tests/inventory.test.js`, in `SKILLS`, directly after `'fankeel-design',`, add:

   ```js
       'fankeel-explain',
   ```

2. `node --test tests/inventory.test.js 2>&1 | grep -E '^(ℹ (pass|fail)|✖)'` shows `ℹ fail 1`: `skills/ holds exactly the known directories, sorted`, missing `fankeel-explain`.
3. Create `skills/fankeel-explain/SKILL.md` with exactly this content:

   ```md
   ---
   name: fankeel-explain
   description: Say it so it is understood on first reading — the one sentence first, unknowns left unknown, contrast only where evidence has one, a report as a path, a status sync in six fields, and a check before sending. Use for a presentation, a report, a project status sync or init, sorting out a line of thought, 簡報, 報告, 進度同步, 整理思路, or when a session has drifted, repeated itself, or may have misread the project.
   version: 0.64.0
   status: current
   last_verified: 2026-09-13
   source_of_truth: this file is the prompt, no upstream
   ---

   # fankeel-explain

   Produces a reply the reader understands on first reading, believes because it
   shows its evidence, and can act on.

   ## The one sentence

   Before writing, know the one sentence the reader must leave with. Everything
   else earns its place by making that sentence understood or believed.

   When a task is new, drifting or disputed, state it in one line: the goal, where
   it stands, what is known, what is not. An unknown is written as *not known* or
   *needs confirming* and never filled in. An empty slot is a legal answer — a rule
   that demands a cause gets one invented.

   ## Order

   Conclusion, then reason, then evidence, then an example. One message per
   sentence; if one sentence carries it, do not use three.

   Evidence is something the reader could check: a number, a quoted line, a
   `path:line`, a run. An unfamiliar idea gets its example before its definition,
   and the example serves the claim rather than padding it.

   Say what changes for this reader in the first lines, not at the end. Where the
   next question is visible, answer it in one line.

   ## Contrast only where the evidence has one

   "Expected A, found B, so C matters" is the strongest order there is — when a
   measurement or a file overturned something someone believed. A reversal written
   for rhythm is an invented finding; where nothing was overturned, state the
   finding plainly. Each paragraph adds something the last one did not.

   ## A report or a presentation

   A path the reader walks, not an essay: problem → why it matters → evidence →
   finding → fix → why this fix → result → next step. Every section, slide or
   paragraph answers one question — what would the reader fail to understand
   without it? If nothing, delete it.

   ## A status sync or a project init

   The shared picture comes before any detail:

   - **Goal** — what is true when this is finished
   - **Current state** — what exists now
   - **Decisions** — what is settled
   - **Problems** — where it is stuck
   - **Evidence** — what is confirmed, and separately what is inferred
   - **Next step** — the concrete next action

   An inference is not a fact and a plan is not done. Label which is which.

   ## When you may have it wrong

   Stop where you notice — do not finish the paragraph to look complete. Say that
   your understanding may be off, then sort what you have into confirmed, inferred,
   and needs confirming. Continue from the confirmed.

   ## Before sending

   Delete a first sentence that announces what follows, a last sentence that
   recaps or offers more, and a hedge that adds nothing. Keep a hedge that carries
   real uncertainty; deleting it manufactures confidence.

   Then read only the first line and the last. If the reader cannot tell what
   happened and what to do next, rewrite those two.

   ## Voice

   Lead with the result. Drop filler — *just*, *really*, *basically*, *simply* —
   and openers — *sure*, *of course*. Prefer the short word; never invent
   abbreviations.

   Never compress negations, numbers and units, identifiers, paths, flags, error
   strings or code blocks. Reply in the language the user writes in, whatever
   language this file is in, and name a code concept in code rather than
   translating it.
   ```

   The file content is the fence's lines with the three-space list indent removed.
4. `node --test tests/inventory.test.js tests/skills.test.js 2>&1 | grep -E '^(ℹ (pass|fail)|✖)'` shows `ℹ fail 0`.
5. `node scripts/skills-check.js` and `node scripts/docs-check.js`, unpiped: no finding names `skills/fankeel-explain`.

   A new skill directory is one more file carrying the version, so every count of them moves — added by a build ruling on 2026-09-13, after the full suite failed on it. `eleven` becomes `twelve` and `nine skills` becomes `ten skills` at the lines the Files block names, and `found.size, 11` in `tests/contract.test.js` becomes `12`. `scripts/version.js:103` and `tests/version.test.js:105` describe a past incident and keep their number. Then `node --test tests/contract.test.js tests/version.test.js tests/inventory.test.js tests/skills.test.js tests/stage-registry.test.js 2>&1 | grep -E '^(ℹ (pass|fail)|✖)'` shows `ℹ fail 0`.
6. Commit: `feat: fankeel-explain, the understanding prompt as a skill`.

## Task 4: the reasoning recorded, the style page retired

**Files:**
- Modify: `docs/output-styles.md` — moved to `docs/archive/2026-09-13-output-styles.md`
- Modify: `docs/archive/2026-09-13-output-styles.md` — the moved page; `status: current` becomes `status: archived`
- Modify: `docs/decisions/2026-09-13-no-output-styles.md` — new decision record, text below
- Modify: `README.md` — the row at :179 points at the decision record
- Modify: `docs/README.md` — the row at :41 points at the decision record, and `Twelve pages` at :9 becomes `Eleven pages`; the Roles row stays until Task 5 removes its bucket
- Read: `tests/contract.test.js` — :354 counts the top-level pages of `docs/`
- Modify: `skills/fankeel/SKILL.md` — `## Output styles` becomes `## Voice`
- Modify: `TODO.md` — the `## Waiting` bullet at :88 and the blank line after it removed
- Test: `tests/render.test.js`

**Interfaces:**
- Consumes: `fankeel-explain` at `skills/fankeel-explain/SKILL.md`, from Task 3
- Produces: `docs/decisions/2026-09-13-no-output-styles.md`; no current page describes a shipped style, which Task 5 relies on

**Dispatch:** implementer, sonnet — every page's text is below; transcription plus docs-check and one control.

1. In `tests/render.test.js`, replace the comment and test that begin `// The page above quotes the rules` (:336-352) with:

   ```js
   // The page above quotes the rules, so it cannot be wrong about how many there
   // are. The fankeel skill counts them instead, and a count like that has rotted
   // once already: two pages said "three" for six days after ALWAYS grew a fourth
   // rule, and nothing went red. The word comes from ALWAYS.length rather than being
   // written here, so the next rule added fails this until the prose catches up —
   // the shape tests/docs-audit.test.js:267 settled on for the same kind of claim.
   test('the page that counts the always-on rules counts as many as there are', () => {
     const page = require('node:fs').readFileSync(
       require('node:path').join(__dirname, '..', 'skills', 'fankeel', 'SKILL.md'), 'utf8');
     const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'];
     const word = WORDS[ALWAYS.length];

     assert.match(page, new RegExp('The ' + word + ' always-on rules'));
   });
   ```

2. `git mv docs/output-styles.md docs/archive/2026-09-13-output-styles.md`, then in that file's frontmatter change `status: current` to `status: archived`.
3. Create `docs/decisions/2026-09-13-no-output-styles.md` with exactly:

   ```md
   ---
   status: current
   last_verified: 2026-09-13
   source_of_truth: .claude-plugin/plugin.json, lib/stages.js, skills/fankeel-explain/SKILL.md
   ---

   # fankeel 不再出貨 output style — 決策

   **決定**：2026-09-13 起，fankeel 不出貨任何 output style。Claude Code 留在 Default；fankeel 的語氣只從提示詞來——每個 prompt 注入的 stage 規則與 `output shape:`，以及按需載入的 `fankeel-explain` skill。

   ## 當初為什麼選 style

   0.20.0 的理由寫在 [archive/2026-09-13-output-styles.md](../archive/2026-09-13-output-styles.md)：style 接在 system prompt 後面，每個 request 原文送出，compaction 改寫對話但不改 system prompt，所以稀釋不到；SessionStart 注入的規則在對話裡，長 session 會淡掉。

   ## 為什麼推翻

   - **每個使用者都看得到。** plugin 出貨的 style 出現在每個人的 `/config` 清單裡（`fankeel:fankeel-review`、`fankeel:fankeel-pipeline`、`fankeel:fankeel-terse`），而維護者要所有人留在 Default；文件沒有把 plugin style 藏起來的辦法。
   - **到不了 subagent。** subagent 跑自己的 system prompt，只有 fork 繼承（https://code.claude.com/docs/en/sub-agents.md）。所以 style 不是給 background agent 用的，也改變不了派出去的工作。
   - **稀釋的問題，注入已經解了。** fankeel 的注入不是 SessionStart 一次，而是每個 prompt（`hooks/inject.js`）與每個答完的問題（`hooks/resume.js`）重送；隨 stage 變的 `output shape:` 本來就只能在這裡。

   ## 放棄了什麼

   style 在 mode 外也生效；skill 要描述命中才載入，不保證觸發。mode 開著時注入每輪重送，差距只在 mode 外。

   ## `fankeel-explain` 從哪來，偏離了哪兩處

   使用者 2026-09-13 貼了一份「讓人最快理解、記住，並願意繼續聽下去」的 prompt，十條原則。對照當時的 fankeel：已有 1 條（證據與分母），做到一半 6 條，沒有 3 條（反轉節奏、報告的理解路徑、送出前自檢）。skill 收下全部十條，兩處刻意偏離原文：

   - **反轉只在證據推翻了某個假設時用。** i-have-adhd 的評測量到，規則一要求成因，模型在證據不足時就編一個（`docs/plans/2026-09-09-design-class-prompt.md:221`）。「製造反差」是同一種壓力。
   - **七個自問換成一個可以失敗的檢查**：只讀第一行與最後一行，讀者知不知道發生了什麼、下一步做什麼。形狀取自 i-have-adhd 的 Pre-send check（`docs/improvement-brief.md:776`）。

   survey 的 `output shape:` 同時多了一行 `unknown:`——十條裡唯一放得進注入層、又只屬於某個 stage 的一條。
   ```

   The file content is the fence's lines with the three-space list indent removed.
4. In `README.md`, replace the row at :179 with:

   ```md
   | Why fankeel ships no output style, and where its voice lives instead | [docs/decisions/2026-09-13-no-output-styles.md](docs/decisions/2026-09-13-no-output-styles.md) |
   ```

5. In `docs/README.md`, replace the row at :41 with a row in the same shape as the other `decisions/` rows in that table, whose text is `Why fankeel ships no output style, and where its voice lives instead` and whose link points at `docs/decisions/2026-09-13-no-output-styles.md`, written relative to `docs/README.md` the way its neighbours' links are. Then at :9, `Twelve pages, one question each.` becomes `Eleven pages, one question each.` — the move leaves eleven top-level pages, and `tests/contract.test.js:354` counts them.
6. `git grep -n -i "output.style" -- README.md docs/README.md` — two hits are left: `docs/README.md:117`, the dated report row, which stays, and the Roles row `output-styles/` at :179, which Task 5 removes with its bucket.
7. In `skills/fankeel/SKILL.md`, replace everything from the heading `## Output styles` down to, and not including, the heading `## Calibration` with:

   ```md
   ## Voice

   fankeel ships no output style. Claude Code stays on its default, and the voice
   comes from prompts: the injected block — whose `output shape:` is the part that
   changes with the stage — and the **fankeel-explain** skill, for a presentation,
   a report, a status sync, or a line of thought that needs sorting out.

   If the user asks for shorter answers or a fixed format, point at one of those
   two rather than promising to remember. Why the three styles that used to ship
   here went is in
   [docs/decisions/2026-09-13-no-output-styles.md](../../docs/decisions/2026-09-13-no-output-styles.md).

   ```

8. In `TODO.md`, delete the bullet beginning `- Whether an output style reaches a subagent` and the blank line after it.
9. `node --test tests/render.test.js tests/docs.test.js tests/skills.test.js tests/contract.test.js 2>&1 | grep -E '^(ℹ (pass|fail)|✖)'` shows `ℹ fail 0`.
10. Control for step 1: in `skills/fankeel/SKILL.md` change `The four always-on rules` to `The five always-on rules`; `node --test tests/render.test.js 2>&1 | grep -E '^(ℹ (pass|fail)|✖)'` names `the page that counts the always-on rules counts as many as there are`; revert, and it passes again.
11. `node scripts/docs-check.js` and `node scripts/todo-check.js`, unpiped: both exit 0.
12. Commit: `docs: why no output style ships, and the style page archived`.

## Task 5: the three styles stop shipping

**Files:**
- Modify: `output-styles/fankeel-terse.md` — deleted
- Modify: `output-styles/fankeel-pipeline.md` — deleted
- Modify: `output-styles/fankeel-review.md` — deleted
- Modify: `tests/output-styles.test.js` — deleted
- Modify: `.claude-plugin/plugin.json` — the `outputStyles` line removed
- Modify: `.fankeel/docs.json` — the `output-styles` bucket removed
- Modify: `docs/README.md` — the Roles row for `output-styles/` at :179 removed, with its bucket
- Modify: `lib/stages.js` — the comments at :46-50 and :73-74 stop reasoning from a style, same line count
- Modify: `tests/stages.test.js` — the comment at :53-54, same line count
- Modify: `tests/brief.test.js` — the comment at :164-165, same line count
- Test: `tests/source.test.js`

**Interfaces:**
- Consumes: Task 4's archived page and decision record — no current page still describes a shipped style
- Produces: no `outputStyles` in `.claude-plugin/plugin.json`, and no `output-styles/`

**Dispatch:** implementer, sonnet — deletions plus exact comment replacements that keep their line counts.

1. In `tests/source.test.js`, at the end of the file, add:

   ```js
   // fankeel shipped three output styles until 2026-09-13. Every user saw them in
   // the /config picker and none of them reached a subagent, so the voice moved to
   // the injected rules and the fankeel-explain skill instead.
   test('no output style ships', () => {
       const plugin = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));
       assert.equal(plugin.outputStyles, undefined, 'plugin.json still declares outputStyles');
       assert.equal(fs.existsSync(path.join(ROOT, 'output-styles')), false, 'output-styles/ is still on disk');
   });
   ```

2. `node --test tests/source.test.js 2>&1 | grep -E '^(ℹ (pass|fail)|✖)'` shows `ℹ fail 1`, `plugin.json still declares outputStyles`.
3. `git rm -q output-styles/fankeel-terse.md output-styles/fankeel-pipeline.md output-styles/fankeel-review.md tests/output-styles.test.js`
4. In `.claude-plugin/plugin.json`, delete the line:

   ```text
     "outputStyles": "./output-styles/",
   ```

5. In `.fankeel/docs.json`, delete this object and its trailing comma, leaving valid JSON:

   ```text
       {
         "path": "output-styles",
         "role": "reference"
       },
   ```

   Then, in `docs/README.md`, delete the Roles row `` | `output-styles/` | reference | no | `` at :179.
6. In `tests/source.test.js`, in the test `no shipped file names ponytail`, the `shipped` line becomes:

   ```js
       const shipped = ['lib', 'scripts', 'hooks', 'agents', 'skills', 'assets', '.claude-plugin']
   ```

7. In `lib/stages.js`, replace the five lines :46-50, from `// These three are about how to talk` to `// is a cheaper price than that.`, with exactly these five:

   ```js
   // These are about how to talk rather than what to do, and this block is the only
   // place they live. fankeel ships no output style, so a rule about the voice that
   // is not injected here reaches nobody: the user stays on Claude Code's default,
   // and a subagent never saw a style anyway. That is why they cost a line each on
   // every prompt rather than sitting somewhere cheaper.
   ```

8. In `lib/stages.js`, replace the two lines :73-74, from `// The fourth rule is here rather than in the output style` to `not a badly written one. Measured over one real`, with exactly these two:

   ```js
   // The fourth rule is here because what it prevents is a failed tool call, not a
   // badly written one, and only this block rides every prompt. Measured over one real
   ```

9. In `tests/stages.test.js`, replace the two lines :53-54, from `// prevents a failed tool call cannot live in an output style` to `// a setting the user might not have chosen.`, with exactly these two:

   ```js
   // prevents a failed tool call has to ride every prompt, and the injected block is
   // the only thing fankeel has that does.
   ```

10. In `tests/brief.test.js`, replace the two lines :164-165, from `// style being in force, and the skill is gone` to `// arrives in the system prompt, where nothing here has to restate it.`, with exactly these two:

    ```js
    // style being in force. The skill went in 0.20.0 and the styles themselves on
    // 2026-09-13; this keeps the digest from growing back.
    ```

11. `node -e "JSON.parse(require('fs').readFileSync('.fankeel/docs.json','utf8'));JSON.parse(require('fs').readFileSync('.claude-plugin/plugin.json','utf8'));console.log('both parse')"` prints `both parse`.
12. `node --test tests/source.test.js tests/stages.test.js tests/brief.test.js tests/docs.test.js tests/render.test.js 2>&1 | grep -E '^(ℹ (pass|fail)|✖)'` shows `ℹ fail 0`. Then the whole suite, `node --test 2>&1 | grep -E '^(ℹ (pass|fail)|✖)'`, shows `ℹ fail 0` — the design's 全套綠, checked once every task has landed.
13. `node scripts/docs-check.js`, unpiped: exit 0. A finding inside a dated record — `docs/plans/`, `docs/decisions/`, `docs/judgements/`, `docs/reports/`, `docs/archive/` — is reported back, not edited.
14. Commit: `refactor: the three output styles stop shipping`.

## Coverage

| promise | task |
|---|---|
| `output-styles/` 刪除，`.claude-plugin/plugin.json` 拿掉 `outputStyles`。 | Task 5 |
| `.fankeel/docs.json:35` 的 `output-styles` bucket 拿掉。 | Task 5 |
| `tests/output-styles.test.js` 刪除；`tests/source.test.js:173` 的 shipped 清單拿掉 `output-styles`。 | Task 5 |
| `tests/render.test.js:343-351` 改讀 `skills/fankeel/SKILL.md`：留下 `The <n> always-on rules` 那條斷言 | Task 4 |
| `lib/stages.js:47`、`:73`，`tests/stages.test.js:53`，`tests/brief.test.js:162` 的註解改成只講注入 | Task 5 |
| `docs/output-styles.md` 移到 `docs/archive/`；`README.md:179` 與 `docs/README.md` 指向它的列改寫或移除。 | Task 4 |
| 新增 `docs/decisions/2026-09-13-no-output-styles.md`：寫下「為什麼」四點 | Task 4 |
| `skills/fankeel/SKILL.md` 的 `## Output styles` 節改成一段 | Task 4 |
| `TODO.md:88`（style 到不到 subagent）刪除——文件已經回答：到不了。 | Task 4 |
| `skills/fankeel-explain/SKILL.md` 照 `.fankeel/build/2026-09-13-explain-skill/SKILL.md` 草稿全文建立。 | Task 3 |
| description 帶觸發詞：presentation、report、status sync、project init、簡報、報告、進度同步、整理思路 | Task 3 |
| `tests/inventory.test.js:13` 的名單加上 `fankeel-explain`。 | Task 3 |
| 兩處刻意偏離原 prompt：反轉只在證據推翻了某個假設時用；七個自問換成「只讀第一行和最後一行」的可驗證檢查。依據（`docs/plans/2026-09-09-design-class-prompt.md:221`、`docs/improvement-brief.md:776-789`）寫在 decision record，不寫進 skill。 | Task 3 (the skill's text), Task 4 (the reasons, in the decision record) |
| `lib/stages.js:236` 的 survey template 加一行 `unknown: <needs confirming, or "none">` | Task 2 |
| survey 注入區塊在 reference size 下仍小於 2400（`tests/render.test.js`）：現在 2339，估計加 41。 | Task 2 |
| 條件 | struck — the header row of the design's table, not a promise |
| `caveman.zip` 刪除，`.gitignore:6-8` 移除。 | Task 1 |
| `tests/docs.test.js:509` 註解裡的例子從 `caveman.zip` 改成 `.impeccable/`。 | Task 1 |
| 新 skill 有被測到 | Task 3 |
| style 真的沒了 | Task 5 |
| survey 的形狀 | Task 2 |
| 文件 | Task 4 |
| skill 真的會被叫到 | verify — a headless `claude -p --plugin-dir` probe run twice, not a build task |
