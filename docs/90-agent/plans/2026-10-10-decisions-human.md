---
status: design-intent
last_verified: 2026-10-10
---

# 03-decisions Holds Decisions Only — Implementation Plan

**Goal:** 03-decisions 只收真正的決策，新寫或改過的決策頁由 docs-check 守成給人看的形狀，34 頁盤點日誌搬到 `docs/90-agent/reports/patrols/`。
**Architecture:** land 的注入規則與 skill 改成「選過做法才寫決策頁，其餘寫 report」；`lib/plain.js` 的 `proseFindings` 對 `last_verified` 不早於 `DECISION_RULE_FROM` 的人讀決策頁跑白話檢查與新的 `decision-shape`；日誌用 `scripts/docs-move.js` 的 `applyMoves` 搬，連結由它改寫。
**Tech Stack:** Node（無相依套件），`node --test`。
**Spec:** [2026-10-10-decisions-human-design.md](2026-10-10-decisions-human-design.md)

## Global Constraints

- 沒有 `package.json` dependencies；不新增套件。測試是 `node --test`（`package.json` `scripts.test`）。
- 每站注入上限：`tests/render.test.js` 斷言 `size < 2400`；land 現為 2397，改寫後不得超過 2399。
- `tests/stages.test.js:233` 要 `/leaves a decision record behind/` 與 `/then is archived, after asking/`；`tests/stages.test.js:718` 要 archive-on 那句含 `the profile said so`；`tests/brief.test.js:388` 要 `/archived; the profile said so, no question/`。
- 人讀頁的句長上限 `MAX_SENTENCE_WIDTH = 160`（`lib/plain.js:12`），中文字算兩欄。
- `docs.json` 的 03 bucket 是 `{ path: 'docs/03-decisions', role: 'decision', audience: 'human' }`；docs-check 在 `scripts/docs-check.js:464` 以 `(rel, text, role, audience)` 呼叫 `proseFindings`。
- commit 主旨 `type: what`，60 字元內，空行後條列；訊息結尾附 Co-Authored-By 與 Claude-Session 兩行。
- implementer 只跑自己的測試檔，不跑整套。
- 另一個 live session（TODO 全表盤點，build 中）也改 `docs/README.md`；Task 3 動它前先 `git diff --stat docs/README.md` 看有無未提交的他人改動。

## Risks

- `applyMoves` 依表推斷整個目錄搬家 — Task 3 — 表裡必須含 03 留下的 45 頁（from 等於 to），搬完後 `ls docs/03-decisions | wc -l` 應為 45。
- `applyMoves` 會把 `.fankeel/docs.json` 改寫成 preset 形狀 — Task 3 — 搬完立即 `git checkout -- .fankeel/docs.json`，並確認 `git diff --stat .fankeel/docs.json` 為空。
- `tests/sources-doc.test.js:13-18` 要求 reports 第一層每個 `.md` 在 `sources.md` 各有一列 — Task 3 — 日誌搬進 `reports/patrols/` 子目錄，不在第一層；`sources.md` 的 Cited by 路徑由 `applyMoves` 改寫，搬完跑該測試。

## Task 1: land 的紀錄分流

**Files:**
- Modify: `lib/stages.js:398-405` — land 的兩條 `when` 規則改寫
- Modify: `skills/fankeel-land/SKILL.md` — 第 95-97 行那段改寫
- Modify: `skills/fankeel/SKILL.md:598-602` — role 表 `decision` 一列補一句
- Test: `tests/stages.test.js`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — 文字改寫加一條斷言。

1. 在 `tests/stages.test.js` 末尾加：

```js
// 2026-10-10 decisions-human: a landed plan writes a decision record only when
// it chose an approach; any other land leaves a report.
test('land sends a plan that chose nothing to a report, not a decision record', () => {
  const { rulesFor } = require('../lib/stages.js');
  for (const values of [{ 'land.archivePlan': true }, {}]) {
    const land = rulesFor('land', null, values).join(' ');
    assert.match(land, /A plan that chose an approach leaves a decision record behind, others a report/);
  }
});
```

2. 跑 `node --test tests/stages.test.js`，看它失敗。
3. 在 `lib/stages.js` 把兩條 `when` 的 `text` 換成：

```js
            { when: 'land.archivePlan', text: 'A plan that chose an approach leaves a decision record behind, others a report; archived; the profile said so, no question.' },
            { when: '!land.archivePlan', text: 'A plan that chose an approach leaves a decision record behind, others a report; then is archived, after asking.' },
```

4. 在 `skills/fankeel-land/SKILL.md` 把「A landed plan leaves a decision record behind — what was decided and why — and is then archived」那段的第一句改成：

```md
A landed plan whose design chose between approaches, or overturned an earlier
decision, leaves a decision record behind — what was decided and why. Any other
land — a TODO patrol, a batch of fixes — leaves a report in the `report` bucket
instead, because a decision bucket a person reads is for decisions. Either way
the plan is then archived — with no question when the profile's
`land.archivePlan` is true, **after asking** when it is not.
```

   保留其後「An unarchived plan gets read as current.」以下原文。
5. 在 `skills/fankeel/SKILL.md` role 表的 `decision` 列末尾加：` In a human bucket it opens with one sentence and carries 決定, 為什麼 and 放棄了什麼 headings — docs-check's decision-shape.`
6. 跑 `node --test tests/stages.test.js tests/render.test.js tests/brief.test.js`，全過；`land` 的 `chars at a` 診斷值小於 2400。
7. Commit：`land: decision record only when an approach was chosen`。

## Task 2: 決策頁的白話與骨架檢查

**Files:**
- Modify: `lib/plain.js` — `proseFindings` 擴到人讀決策頁，加 `DECISION_RULE_FROM` 與 `decision-shape`
- Modify: `docs/90-agent/reference/plain-language.md` — 「哪裡會擋」加決策頁一條
- Read: `scripts/docs-check.js` — 第 464 行的呼叫方式，不改
- Test: `tests/plain.test.js`

**Interfaces:**
- Consumes: none
- Produces: `DECISION_RULE_FROM`（字串 `'2026-10-10'`）由 `lib/plain.js` 匯出；finding tag `decision-shape`

**Dispatch:** implementer, sonnet — 函式擴充與測試都寫在 plan 裡。

1. 在 `tests/plain.test.js` 的 require 加入 `DECISION_RULE_FROM`，末尾加：

```js
test('a human decision page dated on or after DECISION_RULE_FROM is read plainly and needs its shape', () => {
  assert.equal(DECISION_RULE_FROM, '2026-10-10');
  const head = (d) => '---\nstatus: decision\nlast_verified: ' + d + '\n---\n\n# 標題\n\n';
  const good = '一句話：選 A 不選 B。\n\n## 決定\n\n選 A。\n\n## 為什麼\n\n快。\n\n## 放棄了什麼\n\nB 的彈性。\n';
  const bad = '這輪做了三件事。\n\n## 做了什麼\n\n- 一件。\n';
  assert.deepEqual(proseFindings('docs/03-decisions/a.md', head('2026-10-10') + good, 'decision', 'human'), []);
  assert.deepEqual(proseFindings('docs/03-decisions/a.md', head('2026-10-10') + bad, 'decision', 'human').map((f) => f.tag), ['decision-shape', 'decision-shape']);
  assert.deepEqual(proseFindings('docs/03-decisions/a.md', head('2026-10-01') + bad, 'decision', 'human'), []);
  assert.deepEqual(proseFindings('docs/03-decisions/a.md', head('2026-10-10') + good + '\n' + '這'.repeat(81) + '\n', 'decision', 'human').map((f) => f.tag), ['long-sentence']);
  const en = '---\nlast_verified: 2026-10-11\n---\n\n# T\n\nIn one sentence: A over B.\n\n## Decision\n\nA.\n\n## Why\n\nFast.\n\n## Given up\n\nB.\n';
  assert.deepEqual(proseFindings('docs/decisions/b.md', en, 'decision', 'human'), []);
  assert.deepEqual(proseFindings('docs/90-agent/x.md', head('2026-10-10') + bad, 'decision', 'agent'), []);
});
```

2. 跑 `node --test tests/plain.test.js`，看它失敗。
3. 在 `lib/plain.js`：常數區加

```js
// Decision pages a person reads are held to the plain rules and a fixed shape
// only from the day that rule landed: an older page is checked once someone
// edits it and moves its last_verified forward.
const DECISION_RULE_FROM = '2026-10-10';
const OPENERS = /^(一句話|In one sentence)/;
const SHAPE = [['## 決定', '## 為什麼', '## 放棄了什麼'], ['## Decision', '## Why', '## Given up']];
```

   在 `lib/plain.js`，`proseFindings` 開頭改成：

```js
function proseFindings(rel, text, role, audience) {
    if (typeof text !== 'string') return [];
    const decision = role === 'decision' && audience === 'human';
    if (decision) {
        const m = /^---\r?\n[\s\S]*?^last_verified:\s*(\S+)/m.exec(text);
        if (!m || m[1] < DECISION_RULE_FROM) return [];
    }
    const human = (role === 'reference' || decision) && audience === 'human';
```

   其餘照舊；在最後 `return` 的陣列再 `.concat(decision ? shapeFindings(rel, body) : [])`。
   在 `lib/plain.js` 的 `proseFindings` 上方加：

```js
// One sentence first, then the three headings of one language.
function shapeFindings(rel, body) {
    const lines = body.split('\n');
    const first = lines.findIndex((l) => l.trim() && !l.startsWith('#'));
    const out = [];
    if (first < 0 || !OPENERS.test(lines[first].trim())) {
        out.push({ file: rel, line: first < 0 ? 1 : first + 1, tag: 'decision-shape', what: 'a decision page opens with 一句話 (or In one sentence): its one-sentence conclusion' });
    }
    const heads = new Set(lines.map((l) => l.trim()));
    if (!SHAPE.some((set) => set.every((h) => heads.has(h)))) {
        out.push({ file: rel, line: 1, tag: 'decision-shape', what: 'a decision page carries ' + SHAPE.map((s) => s.join(' / ')).join(' or ') });
    }
    return out;
}
```

   `module.exports` 加 `DECISION_RULE_FROM`。
4. 跑 `node --test tests/plain.test.js tests/docs-check.test.js`，全過。
5. 在 `docs/90-agent/reference/plain-language.md` 「哪裡會擋」的 docs-check 那條後加一條：`- docs-check：audience 是 human 的決策頁，last_verified 不早於 2026-10-10（\`DECISION_RULE_FROM\`）時，同樣查句長與代號，另查 \`decision-shape\`：開頭一句「一句話」結論，並有「決定／為什麼／放棄了什麼」三個標題。舊頁改動時把日期改到當天，就會被查。`，`last_verified` 改為 2026-10-10。
6. Commit：`plain: human decision pages read plainly, in one shape`。

## Task 3: 盤點日誌搬到 reports/patrols，加主題索引

**Files:**
- Modify: `docs/90-agent/reports/patrols/2026-09-10-todo-ten.md` — 由 `applyMoves` 連同下列清單其餘 33 頁 `git mv` 到 `docs/90-agent/reports/patrols/` 同名，不手改內容；指向它們的連結在任何 `.md` 裡都由腳本改寫
- Modify: `docs/README.md` — 連結由腳本改寫，另手加 `## Decisions by topic`
- Modify: `docs/90-agent/reference/sources.md` — 只有腳本改寫的 Cited by 路徑，不手改
- Read: `scripts/docs-move.js` — `applyMoves(root, rows, toName)` 與 `writeTable`/`readTable` 的表格式
- Test: none — 這個 task 不寫測試，步驟 6 只跑既有測試

**Interfaces:**
- Consumes: Task 2 的 finding tag `decision-shape`（步驟 4 數它）
- Produces: none

**Dispatch:** implementer, sonnet — 一次性搬檔，步驟與檢查都在 plan 裡。

搬走清單（全在 `docs/03-decisions/` 下）：

```text
2026-09-10-todo-ten.md 2026-09-11-todo-eight.md 2026-09-11-todo-split.md 2026-09-11-todo-three.md
2026-09-18-needs-decision-all.md 2026-09-18-ready-five.md 2026-09-18-skill-improvements.md 2026-09-18-todo-four.md
2026-09-18-todo-nineteen.md 2026-09-18-todo-six.md 2026-09-22-todo-cleanup.md 2026-09-23-todo-ten.md
2026-09-24-needs-a-decision-batch.md 2026-09-24-todo-four.md 2026-09-25-todo-line-and-multiplier.md 2026-09-26-ready-five.md
2026-09-26-three-ready.md 2026-09-27-five-items.md 2026-09-27-todo-clear.md 2026-09-28-todo-batch.md
2026-09-29-todo-patrol-2.md 2026-09-29-todo-patrol-3.md 2026-09-30-ready-eleven.md 2026-10-01-await-stage-station.md
2026-10-01-gate-3-handoff-1.md 2026-10-02-todo-patrol.md 2026-10-03-todo-nine.md 2026-10-04-todo-patrol-five.md
2026-10-05-cleanup-two.md 2026-10-05-todo-sweep-five.md 2026-10-06-station-line-tests.md 2026-10-07-todo-patrol-seven.md
2026-10-09-rules-ceiling.md 2026-10-09-todo-patrol-nine.md
```

1. 先 `git diff --stat docs/README.md`；有未提交的改動就停下回報，不搬。
2. 寫表：`$TEMP/moves.tsv`，03 的每一個 `.md` 一列 `<from>\t<to>`——清單上的 34 頁 `to` 為 `docs/90-agent/reports/patrols/<同名>`，其餘 45 頁 `from` 等於 `to`。`reports/patrols/` 目前不存在，不會撞名（reports 第一層的 `2026-10-09-workflow-review.md` 與 03 留下的同名頁無關，兩者都不搬）。
   搬前先記連結數：`for f in <34 個檔名>; do git grep -o -F "$f" -- '*.md' ':!docs/90-agent/reports/evidence'; done | wc -l`，寫下數字。
3. 套用：`node -e "const m=require('./scripts/docs-move.js');console.log(m.applyMoves(process.cwd(), m.readTable(process.argv[1]), 'audience'))" "$TEMP/moves.tsv"`，然後 `git checkout -- .fankeel/docs.json`。
4. 檢查：`ls docs/03-decisions | wc -l` 是 45；`ls docs/90-agent/reports/patrols | wc -l` 是 34；`git diff --stat .fankeel/docs.json` 為空；同一條連結數指令的結果與搬前相同；`node scripts/docs-check.js | grep -c decision-shape` 是 0；docs-check 的死連結數與搬前相同（搬前先跑一次記下）。
5. 在 `docs/README.md` 的 `## Judgements` 之前加 `## Decisions by topic`：把留在 03 的 45 頁依主題分到六個小標——站 agent 與派工、監控站、注入與 gate、文件與 TODO、模型選擇、其他——每頁一行 `- [標題](03-decisions/<file>)`，標題取該頁的 `# ` 行。段末加一行：`盤點與批次的收尾紀錄在 [90-agent/reports/patrols/](90-agent/reports/patrols/)。`
6. 跑 `node --test tests/sources-doc.test.js tests/source.test.js tests/docs.test.js`，全過；`node scripts/todo-check.js` 無死連結。
7. Commit：`docs: 34 patrol logs move from decisions to reports`。

## Coverage

| promise | task |
|---|---|
| land 的注入規則與 land skill 改成：任務在 design 選過做法、或推翻了先前的決定，才寫 decision record | Task 1 |
| 改動後 `lib/stages.js` 的注入長度仍在現有上限內，由既有的 stages 測試守。 | Task 1 |
| `proseFindings` 對 `role === 'decision' && audience === 'human'` 的頁跑和 01、02 相同的長句與裸代碼檢查。 | Task 2 |
| 新增 `decision-shape` finding：本文第一個非空行以 `一句話` 或 `In one sentence` 開頭 | Task 2 |
| 只對 `last_verified` 不早於規則生效日（常數 `DECISION_RULE_FROM = '2026-10-10'`）的頁生效 | Task 2 |
| plan 逐頁讀過，列出搬走清單（檔名含 todo、patrol、ready、batch、sweep 等的約 31 頁 | Task 3 — 34 頁，清單在 Task 3 |
| 用 `scripts/docs-move.js` 搬到 `docs/90-agent/reports/`，由它改寫全 repo 的連結；不手搬。 | Task 3 — 落在 `reports/patrols/` 子目錄 |
| `docs/README.md` 的決策段落改成依主題分組，只列留在 03 的頁；搬走的頁列在 reports 段。 | Task 3 — 主題段只列 03 的頁；README 沒有 reports 段，搬走的頁以主題段末一行指向 `reports/patrols/`，原表各列的連結由腳本改寫 |
| `docs/90-agent/reference/plain-language.md` 寫入決策頁的骨架與生效日；`skills/fankeel/SKILL.md` 的 role 表 | Task 2（plain-language）、Task 1（SKILL.md） |
