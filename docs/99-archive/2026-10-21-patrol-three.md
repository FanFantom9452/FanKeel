---
status: current
---

# 2026-10-21 盤點的三件：await 不默默略過 questions、提問時也查 gate 選項數、land 的 gate 改白話四選項 Implementation Plan

**Goal:** 主控等到的交接一定知道有沒有可照抄的 questions，少抄選項的 gate 不論 header 寫什麼都被擋，land 的 gate 固定四個白話選項、回顧在匯出後一律跑。
**Architecture:** 三件互不相關的小修。await 與 gate hook 各一個任務；land 的改動跨規則、skill、兩個 agent 檔和兩份參考文件，超過每任務三個 `Modify:` 的上限，拆成「規則與 skill」和「agent 檔與架構文件」兩個任務。`docs/90-agent/reference/subagents.md` 只由 Task 1、Task 2 改，兩者因此先後執行。
**Tech Stack:** Node >=22.5（`package.json:8`），`node:test`，不加依賴。
**Spec:** ../../../.fankeel/build/task-20261021T060926/design.md

## Global Constraints

- 不加依賴、`hooks/` 下不加新檔、不加新的產生檔名（`CONTRIBUTING.md:36`）。
- 每個 hook 在每條路徑都以 0 結束，包括自己出錯時（`CONTRIBUTING.md:17`）；`hooks/gate.js` 的改動不得新增會丟出的路徑。
- 每個匯出的名字都要有匯入者（`CONTRIBUTING.md:19`）：`scripts/await.js` 新匯出的 `questionsLine` 由 `tests/await.test.js` 匯入。
- Node `>=22.5`（`package.json:8`）；測試用 `node:test` 和 `node:assert/strict`；單檔跑 `node --test tests/<file>`，整套 `npm test`（`package.json:11`），一次只跑一套（`README.md:263`）。
- JS 檔以 `'use strict';` 開頭，縮排照所改的檔：`scripts/`、`hooks/`、`lib/` 四格；`tests/await.test.js`、`tests/agents.test.js` 四格；`tests/gate.test.js`、`tests/stages.test.js` 兩格。
- land 規則合計不超過 2500 位元組（`lib/stages.js:407` 的 `budget: 2500`，`tests/stages.test.js:1219-1225` 同時查 `rules` 與 `prompt_bytes`）；現在 `prompt_bytes` 是 2493，新規則最多比舊規則長 7 位元組。Output 規則必須留在 land 規則最後一條（`tests/stages.test.js:1216`）。
- 每條注入規則在 `docs/90-agent/reference/enforcement.md` 有一列，第二格是規則去掉反引號後的前五個字（`tests/enforcement.test.js:20` 的 `opens`、`:43`）。
- gate 的上限：最多 4 題（`lib/handoff.js:245` `MAX_QUESTIONS`），header 最多 12 欄、CJK 一字算兩欄（`lib/handoff.js:237` `MAX_HEADER_WIDTH`），每題 2 到 4 個選項（`lib/handoff.js:391`），最後一站的選項一 label 必須含 `down` 或 `收工`（`lib/handoff.js:414`）。
- `looksLikeAttempt` 的門檻 `ATTEMPT_THRESHOLD = 0.5`（`hooks/gate.js:86`）不改。
- 計畫的每個任務 `Modify:` 不超過 3 個（`lib/plantasks.js:354` `FILE_CAP`），讀的檔不超過 1500 行（`lib/plantasks.js:353` `READ_CAP`）。
- 提交：`type: what changed` 60 字以內，每個改動一行 `- <what changed> — <module>`（`lib/stages.js` land 的 COMMIT 規則）。

## Risks

- `tests/await.test.js` 的頁面測試斷言行數（`lines.length` 為 1 或 2），交接檔沒有 gate 時會多一行 `no questions:` — Task 1 — 步驟 5 把那四處一併改掉，改完先跑 `node --test tests/await.test.js tests/await-main-stale.test.js tests/await-stale.test.js tests/await-timeout.test.js`。
- land 規則已經 2493/2500 位元組 — Task 3 — 改規則前先跑步驟 1 的位元組量測，新字串 59 位元組（舊 54），量出超過 2500 就停下回報，不縮別條規則。
- 選項一不含 `收工` 的 land gate 會被 `readGate` 拒絕 — Task 3 — skill 寫死 `收工 (Recommended)`，測試斷言這個 label。
- 用 gate 自己的 header 判斷照抄，可能把同 header 下主控自己的別題誤擋 — Task 2 — 第二個新測試就是這個情況，必須放行。
- 平行 session 移動 `lib/stages.js` 的行號 — Task 3 — 以 `grep -n "Gate asks" lib/stages.js` 與 `grep -n "only when your brief carries" lib/stages.js` 印的行為準。

## Task 1: await 不默默略過 questions

**Files:**
- Modify: `scripts/await.js` — `questionsLine` 改成非同步、重讀一次、讀不到時回 `no questions:` 行；`main` 的 handoff 分支接上；匯出 `questionsLine`
- Modify: `docs/90-agent/reference/subagents.md` — 第 628 行描述 await 輸出的那段
- Read: `lib/handoff.js` — `readGate(file)` 回 gate、`{ invalid, detail, next }` 或 null；`gateProblem` 對只有一個選項的題目回 `questions[0].options` / `options must be 2 to 4, found 1`
- Test: `tests/await.test.js`

**Interfaces:**
- Consumes: `readGate(file, next, route, rules) -> gate | { invalid, detail, next } | null`、`workflowOf(file) -> string | null`（`lib/handoff.js`）
- Produces: `questionsLine(o: { handoff: string, group?: number }, settleMs = 300) -> Promise<string>`，從 `scripts/await.js` 匯出；回 `''`（group 或 workflow）、`'\nquestions: <JSON>'`，或 `'\nno questions: <why> — read the last \`json gate\` block in that file yourself and ask its questions exactly as written.'`

**Dispatch:** implementer, sonnet — 一個函式改寫和幾處測試斷言，程式碼都在計畫裡。

1. In `tests/await.test.js`, replace the whole test `a handoff whose gate would be refused prints no questions line` (the last test in the file) with these two, in `tests/await.test.js`:

```js
// await-13: a gate that fails readGate's own checks is said, never skipped in silence.
test('a handoff whose gate would be refused says why on a no questions: line, and never a questions: line', async () => {
    const f = fixture({ stage: 'survey', moves: [['survey', 1]] });
    const bad = { questions: [{ header: '下一站', question: 'plan?', options: [{ label: 'plan', description: 'a' }] }], next: 'plan' };
    at(path.join(f.task, 'survey.md'), Date.now(), GATE_TICKS + 'json gate\n' + JSON.stringify(bad) + '\n' + GATE_TICKS + '\n');
    const out = await awaitCli.main(['--session', SID, '--root', f.root], f.env);
    assert.match(out.text, /\nno questions: its gate fails `questions\[0\]\.options`: options must be 2 to 4, found 1 — read the last `json gate` block in that file yourself/);
    assert.doesNotMatch(out.text, /^questions: /m);
    assert.doesNotMatch(out.text, /Its `questions:` line/);
});

// await-13: on 2026-10-21 build close's first handoff was caught by fs.watch
// before its gate was written, and await printed no questions line at all.
test('questionsLine reads once more when the gate lands after the report, and says so when it never does', async () => {
    const dir = tmp('fankeel-await-');
    const late = at(path.join(dir, 'task', 'survey.md'), Date.now(), 'report\n');
    setTimeout(() => fs.appendFileSync(late, '\n' + GATE_TICKS + 'json gate\n' + JSON.stringify(CRLF_GATE) + '\n' + GATE_TICKS + '\n'), 50);
    const got = await awaitCli.questionsLine({ handoff: late }, 300);
    assert.ok(got.startsWith('\nquestions: '), got);
    assert.deepEqual(JSON.parse(got.slice('\nquestions: '.length)), CRLF_GATE.questions.map((x) => Object.assign({}, x, { multiSelect: false })));
    const never = at(path.join(dir, 'task2', 'survey.md'), Date.now(), 'report\n');
    const none = await awaitCli.questionsLine({ handoff: never }, 50);
    assert.equal(none, '\nno questions: it holds no `json gate` block that parses yet — read the last `json gate` block in that file yourself and ask its questions exactly as written.');
    assert.equal(await awaitCli.questionsLine({ handoff: never, group: 2 }, 50), '');
});
```

2. Run `node --test tests/await.test.js` — the two new tests fail (`questionsLine` is not exported; the refused gate prints nothing).
3. In `scripts/await.js`, replace the comment block above `const QUESTIONS_SAID` and the whole `function questionsLine(o) { ... }` with this, in `scripts/await.js`:

```js
// 2026-10-21 await-gate-crlf judgement: the controller copies a gate's
// `questions` and nothing else — hooks/gate.js compares only those — so they
// are printed here, parsed by the readGate the hook uses: one line, CRLF
// gone. A group brain's report or a workflow hand-over: nothing.
// await-13: fs.watch can fire while the handoff is still being written, so a
// gate that is missing or fails readGate is read once more after
// GATE_SETTLE_MS; still not, and the line says so instead of saying nothing.
// It never opens with `questions: `, so nobody parses it as the gate.
const QUESTIONS_SAID = ' Its `questions:` line below is that gate\'s questions, as AskUserQuestion takes them.';
const GATE_SETTLE_MS = 300;
function questionsSaid(gate) {
    if (gate && !gate.invalid) return '\nquestions: ' + JSON.stringify(gate.questions);
    const why = gate ? 'its gate fails `' + gate.invalid + '`: ' + gate.detail : 'it holds no `json gate` block that parses yet';
    return '\nno questions: ' + why + ' — read the last `json gate` block in that file yourself and ask its questions exactly as written.';
}
function questionsLine(o, settleMs = GATE_SETTLE_MS) {
    if (Number.isInteger(o.group) || workflowOf(o.handoff)) return Promise.resolve('');
    const first = readGate(o.handoff);
    if (first && !first.invalid) return Promise.resolve(questionsSaid(first));
    return new Promise((resolve) => setTimeout(() => resolve(questionsSaid(readGate(o.handoff))), settleMs));
}
```

4. In `scripts/await.js`, in `main`, replace the two lines `const questions = questionsLine(o);` and `return pageLine(o).then((page) => ({ text: line + (questions ? QUESTIONS_SAID : '') + (page ? PAGE_OPEN : '') + page + questions }));` with this, and change the last line of the file to `module.exports = { main, already, questionsLine };`, in `scripts/await.js`:

```js
        return Promise.all([questionsLine(o), pageLine(o)]).then(([questions, page]) => ({
            text: line + (questions.startsWith('\nquestions: ') ? QUESTIONS_SAID : '') + (page ? PAGE_OPEN : '') + page + questions,
        }));
```

5. In `tests/await.test.js`, the handoffs in these tests hold no gate, so each now ends in a `no questions:` line; change them, in `tests/await.test.js`:
   - in `a non-build brain carrying a group waits on the plain handoff, the path its brief names`, replace `assert.ok(out.text.endsWith(plain + ' — print this path` with `assert.ok(out.text.split('\n')[0].endsWith(plain + ' — print this path` (the rest of the line unchanged);
   - in `plan page: an answering station puts the session's plan tab on a second line`, replace `assert.equal(lines.length, 2);` with the two lines below;
   - in `gate page: a land-stage handoff from an answering station prints the session's gate tab`, the same replacement;
   - in `gate page: survey, design and build print the gate tab; verify and audit print the handoff line alone`, replace `assert.equal(lines.length, 1, stage + ': ' + lines.join(' | '));` with `assert.equal(lines.length, 2, stage + ': ' + lines.join(' | '));`.

   The two lines that replace `assert.equal(lines.length, 2);` in the plan-page and land-page tests, in `tests/await.test.js`:

```js
        assert.match(lines[2], /^no questions: /);
        assert.equal(lines.length, 3);
```

6. Run `node --test tests/await.test.js tests/await-main-stale.test.js tests/await-stale.test.js tests/await-timeout.test.js` — all pass.
7. In `docs/90-agent/reference/subagents.md`, line 628, replace `; a gate that fails \`readGate\`'s own checks, a group brain's report and a workflow hand-over get none.` with this, in `docs/90-agent/reference/subagents.md`:

```md
; a group brain's report and a workflow hand-over get none. A gate that is missing or fails `readGate`'s own checks is read once more after `GATE_SETTLE_MS` (300 ms), since `fs.watch` can fire while the file is still being written; still not, and the last line is `no questions: <why> — read the last \`json gate\` block in that file yourself and ask its questions exactly as written.` instead, never nothing (await-13).
```

8. Run `node scripts/docs-check.js` — nothing new about `scripts/await.js` or `docs/90-agent/reference/subagents.md`.
9. Commit: `fix: await says when a handoff has no questions to copy`.

## Task 2: 提問時也查 gate 選項數

**Files:**
- Modify: `hooks/gate.js` — `looksLikeAttempt` 的 header 條件也認交接檔 gate 第一題自己的 header
- Modify: `docs/90-agent/reference/subagents.md` — 第 607 行描述 `looksLikeAttempt` 的那句；第 137 行 `fankeel-retro` 何時送出的那句（land-8，同檔放同一任務，免得第三個任務也寫這個檔）
- Test: `tests/gate.test.js`

**Interfaces:**
- Consumes: `controlling`、`nextStage`、`normaliseRoute`、`FULL_ROUTE`（`lib/stages.js`，`hooks/gate.js:53` 匯入）— 這四個不變，land 規則字串與 `STAGE_AGENTS.land` 的改動碰不到它們
- Produces: none

**Dispatch:** implementer, sonnet — 一個條件式和兩個照現有寫法的測試，都在計畫裡。

1. In `tests/gate.test.js`, after the test `stage.agents at survey: a genuinely different question headed with the stage still goes out as written`, add, in `tests/gate.test.js`:

```js
// gate-17: on 2026-10-21 a controlled build gate headed `build 完成` went out
// with two of its file's three options. The header was not the stage's name,
// so the mismatch was never read as a copy attempt and the hook only noted it.
const OWN_HEAD = QUESTIONS.map((q) => Object.assign({}, q, { header: 'survey 完成' }));

test('a copy under the gate\'s own header that drops an option is denied, though the header is not the stage', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { stage: 'survey', started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-cfg-') });
  agentsOn(root);
  handoff(root, { questions: OWN_HEAD, next: 'n' });
  const thin = JSON.parse(JSON.stringify(OWN_HEAD));
  thin[0].options.pop();
  const out = JSON.parse(run(GATE, root, { tool_input: { questions: thin } }));
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /word for word/);
});

test('a different question under the gate\'s own header still goes out as written', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { stage: 'survey', started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-cfg-') });
  agentsOn(root);
  handoff(root, { questions: OWN_HEAD, next: 'n' });
  const different = { questions: [{ header: 'survey 完成', question: '要不要先開一個新任務？', options: [{ label: '要', description: 'a' }, { label: '不要', description: 'b' }] }] };
  const out = JSON.parse(run(GATE, root, { tool_input: different }));
  assert.equal(out.hookSpecificOutput, undefined, 'a low-overlap question under the gate\'s header is not an attempted copy');
});
```

2. Run `node --test tests/gate.test.js` — the first new test fails (`out.hookSpecificOutput` is undefined); the second passes.
3. In `hooks/gate.js`, inside `if (!matches) {`, replace the two lines that define `headerMatches` (from `const headerMatches = !!first && typeof first.header === 'string'` through `&& first.header.toLowerCase() === String(mine.stage || '').toLowerCase();`) with this, in `hooks/gate.js`:

```js
        // gate-17: the file gate's own first header counts too. A controller
        // copying a gate headed `build 完成` and dropping an option was let
        // through on 2026-10-21 because only the stage's name counted. Not
        // the header alone: two gates in one house style overlap past 0.5
        // (REPEAT_THRESHOLD's note), so the overlap test below still decides.
        const headerOf = (q) => (q && typeof q.header === 'string' ? q.header.toLowerCase() : null);
        const askedHeader = headerOf(first);
        const headerMatches = askedHeader !== null
            && (askedHeader === String(mine.stage || '').toLowerCase() || askedHeader === headerOf(gateFirst));
```

4. Run `node --test tests/gate.test.js` — all pass, the earlier header tests included.
5. In `docs/90-agent/reference/subagents.md`, line 607, replace `a mismatch whose first question is headed with the stage's name (any case) is not enough by itself to convict it` with this, in `docs/90-agent/reference/subagents.md`:

```md
a mismatch whose first question is headed with the stage's name or with the file gate's own first header (either in any case — gate-17: a gate headed `build 完成` went out on 2026-10-21 with an option dropped) is not enough by itself to convict it
```

6. In `docs/90-agent/reference/subagents.md`, line 137, replace `` `fankeel-retro` is sent at `land`, only on the user's yes and only after an export, `` with this, in `docs/90-agent/reference/subagents.md`:

```md
`fankeel-retro` is sent at `land` after every export, the user picking `匯出並回顧` being the one yes it needs (land-8),
```

7. Run `node scripts/docs-check.js` — nothing new about `docs/90-agent/reference/subagents.md`.
8. Commit: `fix: gate hook refuses a short copy under the gate's own header`.

## Task 3: land 的 gate 四個白話選項（規則與 skill）

**Files:**
- Modify: `lib/stages.js` — land 規則 `Gate asks \`record.js session\` first; retro only after.`；`STAGE_AGENTS.land` 的 retro 項
- Modify: `skills/fankeel-land/SKILL.md` — 第 252-276 行，`**An export, asked every time; a retro, offered after it.**` 那一段
- Modify: `docs/90-agent/reference/enforcement.md` — `land.7` 那一列
- Read: `lib/stage-registry.js` — step 1 量 land 規則位元組用的 `buildRegistry`
- Read: `tests/skill-size.test.js` — `fankeel-land` 上限 23700，現 23663；新段落 1808 位元組取代 1979，不動上限（另一個 session 正改這檔）
- Read: `lib/handoff.js` — 第 414 行，最後一站的選項一 label 要含 `down` 或 `收工`
- Test: `tests/stages.test.js`

**Interfaces:**
- Consumes: none
- Produces: land 規則字串 `Gate: 收工, open, \`record.js session\` then retro, 暫停.`；`agentsFor('land')` 的 retro 項 `a retro (\`fankeel:fankeel-retro\`, only when your brief says the user picked 匯出)`；land skill 的四個選項 label `收工 (Recommended)`、（選項二照慣例）、`匯出並回顧`、`暫停`

**Dispatch:** implementer, sonnet — 兩個字串、一段 skill 文字和一個測試，原文都在計畫裡。

1. Measure first: run `node -e "const s=require('./lib/stages.js');const {buildRegistry}=require('./lib/stage-registry.js');console.log(buildRegistry('.').stages.find(x=>x.name==='land').prompt_bytes)"` — it prints 2493 (the new rule adds 5 bytes). Over 2495 means a neighbour changed land: stop and report it.
2. In `tests/stages.test.js`, replace the comment above and the whole test `land may dispatch the retro reviewer, and its skill sends it only on a yes` with this, in `tests/stages.test.js`:

```js
// docs/90-agent/plans/2026-10-19-patrol-3-design.md §7: the retro is land's.
// land-8 (2026-10-21): the land gate is 收工, what is still open, 匯出並回顧
// and 暫停, in that order; the retro is no option of its own but runs after
// every export, and the user reads 「回顧這次哪裡可以改進」, never the word retro.
test('land may dispatch the retro reviewer, and its skill runs it after every export, never as a gate option', () => {
  const { agentsFor } = require('../lib/stages.js');
  assert.ok(agentsFor('land').some((a) => a.includes('`fankeel:fankeel-retro`')), 'land does not list the retro');
  assert.ok(agentsFor('land').some((a) => a.includes('only when your brief says the user picked 匯出')), 'the retro still waits on a yes of its own');
  for (const stage of ['survey', 'design', 'plan', 'build', 'verify', 'audit']) {
    assert.ok(!agentsFor(stage).some((a) => a.includes('fankeel-retro')), stage + ' lists the retro');
  }
  assert.ok(agentsFor('land')[agentsFor('land').length - 1].startsWith('a mover'), 'the mover is no longer last');
  const fs = require('node:fs');
  const path = require('node:path');
  const land = fs.readFileSync(path.join(__dirname, '..', 'skills', 'fankeel-land', 'SKILL.md'), 'utf8').replace(/\s+/g, ' ');
  assert.match(land, /subagent_type: fankeel:fankeel-retro/);
  assert.match(land, /scripts\/record\.js session --session <id>/);
  assert.match(land, /scripts\/record\.js retro --session <id> --transcript/);
  assert.match(land, /scripts\/conversation\.js --bundle <path> --tools/);
  const rules = byName('land').rules;
  assert.ok(rules.includes('Gate: 收工, open, `record.js session` then retro, 暫停.'), 'the land rule does not give the four options in order');
  assert.ok(!rules.some((r) => /retro only after/.test(r)), 'the land rule still offers the retro after the export');
  assert.match(land, /1\. `收工 \(Recommended\)`.*2\. .*3\. `匯出並回顧`.*4\. `暫停`/);
  assert.doesNotMatch(land, /retro, offered after it|its gate carries the offer|the retro is offered/);
  assert.match(land, /回顧這次哪裡可以改進/);
  assert.match(land, /nothing runs until the user picks `匯出並回顧`/);
  assert.match(land, /tens of thousands of tokens/);
  assert.match(land, /holds everything said here/);
});
```

3. Run `node --test tests/stages.test.js` — that test fails.
4. In `lib/stages.js`, replace the land rule line `'Gate asks \`record.js session\` first; retro only after.',` with this, in `lib/stages.js`:

```js
            'Gate: 收工, open, `record.js session` then retro, 暫停.',
```

5. In `lib/stages.js`, in `STAGE_AGENTS.land`, replace `'a retro (\`fankeel:fankeel-retro\`, only when your brief carries the user\'s yes to it)'` with this, in `lib/stages.js`:

```js
'a retro (`fankeel:fankeel-retro`, only when your brief says the user picked 匯出)'
```

6. In `skills/fankeel-land/SKILL.md`, replace the paragraph from `**An export, asked every time; a retro, offered after it.**` through `carries that yes; otherwise its gate carries the offer.` with this, in `skills/fankeel-land/SKILL.md`:

```md
**The gate: four options, in this order; the review runs after every export.**
After `record.js write`, the gate carries exactly these (land-8):

1. `收工 (Recommended)` — stands the task down; its description names the
   month file and anchor. The label must say `收工` or `down`
   (`lib/handoff.js:414`).
2. option two as every gate has it.
3. `匯出並回顧` — its description says
   「匯出這次的對話，接著回顧這次哪裡可以改進，把建議列給你核准」, that the
   whole session passes through one opus context, tens of thousands of
   tokens on a long one, and that the bundle holds everything said here.
4. `暫停`.

The word `retro` is nowhere the user reads, and nothing runs until the user
picks `匯出並回顧`. Then `node <plugin>/scripts/record.js session --session <id>`
packs this session's transcripts and those it was adopted from, masks
`.fankeel/sensitive.txt` and key shapes as `[REDACTED:<kind>]`, writes
`.fankeel/bundles/<day>-<id8>.jsonl.gz` and adds a `對話紀錄` line to the
record; `--commit` files a bundle of 2 MB or less in the records bucket.
The review follows with no second question: say one
`subagent_type: fankeel:fankeel-retro`, opus, in the background, prompt
naming `session <id>`, `bundle <path>` and `<plugin>`. It reads
`scripts/conversation.js --bundle <path> --tools`, returns a unified diff
for `skills/` or `CLAUDE.md`, one `evidence:` line per hunk, and writes
nothing. Ask it as its own question headed `改進建議`; an approved hunk
goes to one `fankeel:fankeel-fixer` per file. Then
`node <plugin>/scripts/record.js retro --session <id> --transcript <session>/subagents/agent-<id>.jsonl`,
the disposition on stdin, and stand down. A land brain sends it only when
its brief says the user picked `匯出並回顧`.
```

7. In `docs/90-agent/reference/enforcement.md`, replace the row `| land.7 | Gate asks record.js session first; | none — prose only | none | — |` with this, in `docs/90-agent/reference/enforcement.md`:

```md
| land.7 | Gate: 收工, open, record.js session | none — prose only | none | — |
```

8. Run `node --test tests/stages.test.js tests/enforcement.test.js tests/skills.test.js tests/skill-size.test.js` — all pass, `verify runs the suite through suite.js, land asks --check first, and both stay inside their budgets` included.
9. Commit: `feat: land gate offers 收工, open, 匯出並回顧, 暫停; review always follows export`.

## Task 4: land 的回顧跟著匯出（agent 檔與架構文件）

**Files:**
- Modify: `agents/fankeel-brain.md` — 第 3 行 description 的 `on the user's yes, a retro`；第 101 行 `land only when your brief carries the user's yes to it`
- Modify: `agents/fankeel-retro.md` — 第 3 行 description；第 12-13 行開頭一段
- Modify: `docs/02-architecture/pipeline.md` — 第 818-822 行，`After it the` 到 `(\`skills/fankeel-land/SKILL.md:253\`).`
- Test: `tests/agents.test.js`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — 四處句子替換和一個測試，原文都在計畫裡。

1. In `tests/agents.test.js`, after the test `the retro reads one session through conversation.js and returns a diff with evidence`, add, in `tests/agents.test.js`:

```js
// land-8 (2026-10-21): the retro follows every 匯出並回顧 at land; there is no
// yes of its own to wait for, and nothing calls it optional any more.
test('the brain and the retro say the retro follows the export, not a yes of its own', () => {
    const brain = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-brain.md'), 'utf8').replace(/\s+/g, ' ');
    const retro = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-retro.md'), 'utf8').replace(/\s+/g, ' ');
    for (const [name, text] of [['fankeel-brain', brain], ['fankeel-retro', retro]]) {
        assert.doesNotMatch(text, /the user's yes/, name);
        assert.match(text, /匯出並回顧/, name);
    }
    assert.doesNotMatch(retro, /optional retro/);
});
```

2. Run `node --test tests/agents.test.js` — the new test fails.
3. In `agents/fankeel-brain.md`, line 3, replace `on land a mover and, on the user's yes, a retro,` with `on land a mover and, after the user picks 匯出並回顧, a retro,`; and line 101, replace `land only when your brief carries the user's yes to it, and an implementer` with this, in `agents/fankeel-brain.md`:

```md
land only when your brief says the user picked `匯出並回顧`, and an implementer
```

4. In `agents/fankeel-retro.md`, line 3, replace `Land's optional retro —` with `Land's retro —` and `Sent only on the user's yes.` with `Sent after every 匯出並回顧 the user picks at land.`; and replace lines 12-13 (`You are a retro. The session that sent you is at \`land\`, and its user said` / `yes to one read of this session's transcript.`) with these, in `agents/fankeel-retro.md`:

```md
You are a retro. The session that sent you is at `land`, and its user picked
`匯出並回顧`, which agrees to one read of this session's transcript.
```

5. In `docs/02-architecture/pipeline.md`, replace lines 818-822, from `gate asks one question it never skips, whether to export the session` through `(\`skills/fankeel-land/SKILL.md:253\`).`, with these, in `docs/02-architecture/pipeline.md`:

```md
gate carries four options in this order — `收工`, what is still open,
`匯出並回顧` and `暫停` (`skills/fankeel-land/SKILL.md`, land-8). `匯出並回顧`
exports the session (`record.js session` writes a masked bundle, under
`.fankeel/bundles/` only when the bundle is not committed,
`scripts/record.js:208`) and then always sends the retro on that bundle, with
no second question; the user reads it as 「回顧這次哪裡可以改進」.
```

6. Run `node --test tests/agents.test.js tests/skills.test.js` — all pass; then `node scripts/docs-check.js` — nothing new about `docs/02-architecture/pipeline.md`.
7. Commit: `docs: brain, retro and pipeline say the review follows every export`.

## Coverage

| promise | task |
|---|---|
| `scripts/await.js` 的 `questionsLine` 讀不到 gate（`readGate` 回 null）或 gate 不合格（`invalid`）時，等 `GATE_SETTLE_MS`（300 ms）再讀一次，涵蓋交接檔剛建立、gate 區塊還沒寫完的那一刻。 | Task 1 |
| 第二次仍讀不到或不合格，最後一行印 `no questions: <為什麼> — read the last \`json gate\` block in that file yourself and ask its questions exactly as written.`，不再什麼都不印；開頭不是 `questions: `，主控不會把它當 JSON 去解析。 | Task 1 |
| group brain 的報告、workflow 交接照舊什麼都不印；合格時照舊印 `questions:` 行並在 handoff 行說明。 | Task 1 |
| `docs/90-agent/reference/subagents.md` 第 628 行描述 await 輸出的那段跟著改。 | Task 1 |
| `hooks/gate.js` 的 `looksLikeAttempt`：問題的第一個 header 等於 stage 名（不分大小寫）**或等於交接檔 gate 第一題自己的 header** 時，就算一次照抄嘗試 | Task 2 |
| 不採「完全不看 header」：`hooks/gate.js:89-92` 的量測寫明同一個文風的兩個 gate 字元重疊常過 0.5 | Task 2 — 第二個新測試守這一點 |
| header 跟 stage 和 gate 都不同、內容也不像的問題照舊放行（`tests/gate.test.js` 既有的「開新任務」案例不變）。 | Task 2 |
| `docs/90-agent/reference/subagents.md` 第 607 行描述 `looksLikeAttempt` 的那句跟著改。 | Task 2 |
| land 的 gate 一律四個選項、照這個順序：`收工 (Recommended)`（預設，結案）；第二個照每個 gate 的慣例 | Task 3 |
| 選 `匯出並回顧` 就是同意：`record.js session` 匯出後，回顧（`fankeel:fankeel-retro`）一律在背景跑 | Task 3 |
| 使用者看得到的地方（選項 label、description、問題、gate 上方的報告、核准建議那一題）一律不出現 `retro` | Task 3 |
| 注入規則（`lib/stages.js` land 那條）改成 `Gate: 收工, open, \`record.js session\` then retro, 暫停.` | Task 3 |
| 選項一的 label 必須含 `收工` 或 `down`（`lib/handoff.js:414`），所以預設選項寫 `收工` 而不是「收尾」 | Task 3 |
| 與第 2 件不衝突：第 2 件比的是「問出去的」與「檔案裡的」是否一致，不數選項 | Task 2 與 Task 3 — 不需改動，Task 2 的第一個新測試即是少抄選項被擋 |
| `agents/fankeel-brain.md`、`agents/fankeel-retro.md` 寫「使用者說 yes 才送 retro」的地方改成「使用者選了 `匯出並回顧`」 | Task 4（brain、retro、pipeline）、Task 2（subagents.md:137）、Task 3（enforcement.md） |
| 不改：`record.js` 寫進月檔的 `<summary>retro <id8>` 標記是 `record.js sessions --list` 判斷 `retro: filed` 的機器標記 | struck — 刻意不改，機器標記與指令名留著 |
| await 晚到的 gate 讀得到，讀不到時說明 | Task 1 |
| 不合格的 gate 說出原因 | Task 1 |
| gate 自己的 header 下少抄選項被擋 | Task 2 |
| land 規則與 land skill 不再把 retro 當選項 | Task 3 |
| brain 與 retro agent 不再寫 user's yes | Task 4 |
