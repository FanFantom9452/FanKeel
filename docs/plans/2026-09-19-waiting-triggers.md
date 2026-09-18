---
status: design-intent
last_verified: 2026-09-19
---

# Waiting 判斷機制 Implementation Plan

**Goal:** `## Waiting` 底下改成「時機當 `###` 標題」，程式判日期、每週把該看的時機推到 `/fankeel` 選單上。
**Architecture:** `scripts/todo-check.js` 認得 `## Waiting` 底下的 `###`，新增 `timings()`、`width()`、`mmdd()`，檢查與 `due` 都改以時機為單位；`TODO.md` 的十條同一個 task 改成十個時機，因為 `tests/todo-check.test.js:183` 拿真的 `TODO.md` 跑。`scripts/orient.js` 每次列出全部時機、有 `due` 時少給 `## Needs a decision` 一格。INIT 一個子句與 fankeel skill 的長版說明處理流程；其餘文件改成時機的寫法。
**Tech Stack:** Node 內建 `node --test`，零相依。CommonJS，`'use strict'`；`scripts/`、`lib/` 四格縮排，`tests/` 兩格縮排。
**Spec:** [2026-09-19-waiting-triggers-design.md](2026-09-19-waiting-triggers-design.md)

## Global Constraints

從專案本身生出來的，不是憑記憶：

- **不准加任何相依。** `package.json` 沒有 `dependencies` 也沒有 `devDependencies`；
  script 只有 `"test": "node --test"` 與 `"clean": "node scripts/tmp-clean.js"`。
- **根目錄沒有 `CLAUDE.md`、`AGENTS.md`。** 慣例來自 `CONTRIBUTING.md` 與程式本身。
- **`scripts/todo-check.js` 的常數沿用，不改值：** `MAX_ENTRY_CHARS = 200`（`:49`）、
  `SECTIONS = ['Ready', 'Needs a decision', 'Waiting']`（`:61`）、`REREAD_DAYS = 7`（`:103`）。
  新增的只有 `MAX_TITLE_WIDTH = 28`。
- **`scripts/orient.js` 的 `TODO_ENTRY_WIDTH = 100`（`:479`）不改。**
- **`tests/render.test.js:552`、`:564`：init 區塊（含與不含 station 行）在 59 字元的 plugin
  root 下必須 `< 1400`。** 09-19 量到 `init+st` 1311，INIT 子句淨增約 33 字，放得下；
  上限永不調高。
- **`lib/stages.js` 的行號被 19 處 skill 頁以 `path:line` 引用**（例：`skills/fankeel-plan/SKILL.md:38`
  引 `lib/stages.js:279`）。Task 3 只改 `:154` 這一行的內容，**不得增減 `lib/stages.js` 的行數**。
- **`scripts/orient.js:286` 被 `docs/documents.md:159` 引用。** Task 2 的改動都在 `:470` 之後，
  不得動到 `:286` 以前的行數。
- **`tests/todo-check.test.js:183` 拿這個 repository 自己的 `TODO.md` 跑 todo-check，每個 task
  結束時都必須綠。** 這就是 Task 1 同時改 checker 與 `TODO.md` 的原因。
- **`node --test` 的 spec reporter 印 `✔`／`✖` 與 `ℹ pass`／`ℹ fail`，沒有 TAP 的 `ok` 行。**
- **`.fankeel/map.md` 的 filing：** `docs` 是 reference、`docs/decisions` decision、`docs/plans`
  plan、`docs/reports` 與 `docs/judgements` report、`docs/archive` archive、`skills`／`agents`
  reference、`evals` fixture。design-intent 的頁：`docs/improvement-brief.md`、
  `docs/plans/2026-09-09-design-class-prompt.md`、本計畫與它的 spec。
- **`node scripts/docs-check.js` 與 `node scripts/todo-check.js` 都必須保持 exit 0。**
- **commit 標題是英文類型前綴加中文主旨**（`feat:`、`fix:`、`docs:`、`test:`），結尾兩行
  `Co-Authored-By` 與 `Claude-Session`。
- **implementer 只跑自己 task 的測試檔**，完整套件由 parent 在每組 commit 前跑。

## File structure

| 檔 | 誰負責 |
|---|---|
| `scripts/todo-check.js` | Task 1 — `###` 時機、`timings()`、`width()`、`mmdd()`、檢查與 `report()` |
| `tests/todo-check.test.js` | Task 1 — 改寫受影響的 fixture，新增時機的測試 |
| `TODO.md` | Task 1 — `## Waiting` 十條改成十個時機；Task 4 — 開頭說明 |
| `scripts/orient.js` | Task 2 — `todoBlock()` 列出時機、`due` 佔一格 |
| `tests/orient.test.js` | Task 2 |
| `lib/stages.js` | Task 3 — INIT 一個子句 |
| `skills/fankeel/SKILL.md` | Task 3 — `:618` 表格列、`:723` 起的處理流程 |
| `tests/render.test.js` | Task 3 — INIT 子句的測試 |
| `docs/development.md`、`skills/fankeel-land/SKILL.md`、`skills/fankeel-audit/rationale.md` | Task 4 |

## Task 1: todo-check 認得時機，`TODO.md` 的 Waiting 改成時機

**Files:**
- Modify: `scripts/todo-check.js` — `entries()` 帶 `timing`；新增 `width()`、`mmdd()`、`dateAt()`、`timings()`；`check()` 的 Waiting 檢查改以時機為單位；`report()` 印 `due` 的時機；兩段註解改正
- Modify: `TODO.md` — `## Waiting` 底下十條改成十個時機（開頭說明留給 Task 4）
- Test: `tests/todo-check.test.js`

**Interfaces:**
- Consumes: none
- Produces: `todoCheck.timings(text, now)` → `Array<{ line: number, title: string, event: string|null, stamp: number|null, date: number|null, days: number|null, due: boolean, items: Array<entry> }>`；`todoCheck.width(s: string) → number`；`todoCheck.mmdd(t: number) → 'MM-DD'`；`todoCheck.MAX_TITLE_WIDTH = 28`；`entries()` 的每個 entry 多一個 `timing: number|null`（所在 `###` 的行號）。

**Dispatch:** implementer, sonnet — 程式碼都在 plan 裡，轉錄加測試。

- [ ] **Step 1：先改測試，看它們失敗。**

在 `tests/todo-check.test.js`：

(a) `:178` 那個 fixture 的 Waiting 部分換成一個時機。把
`'## Waiting\n\n- d lifts when: it happens. ' + TODAY + '.\n'` 改成
`'## Waiting\n\n### d\nlifts when: it happens. ' + TODAY + '.\n\n- d\n'`。斷言不動
（`4 entries — 2 ready, 1 needs a decision, 1 waiting`）。

(b) 六個 stale citation 測試（`:211`、`:229`、`:246`、`:264`、`:285`、`:295` 開頭的
`test(`）借用 Waiting 的 bullet 測引用，跟時機無關：把各自 fixture 裡的 `'## Waiting'`
換成 `'## Ready'`，其餘一字不動。行號因此不變（`found[0].line === 5`、`[5, 6, 7]` 照舊）。

(c) `:361` 的 helper 換成下面這個，戳記從 bullet 尾巴搬到時機的 `lifts when:` 行：

In `tests/todo-check.test.js`, replace the `const waiting = (entry) => …` helper with:

```js
const waiting = (entry) => {
  const m = STAMP_TAIL.exec(entry);
  const bullet = m ? entry.slice(0, m.index) : entry;
  return fixture('# TODO\n\n## Waiting\n\n### overflow\n' + LIFTS_CLAUSE + (m ? m[0] : '')
    + '\n\n- ' + bullet + '\n');
};
```

用它的九個測試（`a Waiting entry with no stamp` 到 `the re-read list is reported`）一行都不用改。

(d) `:446` 到 `:500` 那六個逐條帶 `lifts when:` 的測試，fixture 改成時機：

In `tests/todo-check.test.js`, replace the six fixtures as follows (assertions unchanged):

```js
// 'a Waiting entry that names no event is refused'
const file = fixture('# TODO\n\n## Waiting\n\n### pool\nWhether the pool ever overflows. None observed. '
  + stampFor(2) + '.\n\n- the pool\n');
// 'a Waiting entry naming its event passes'
const file = fixture('# TODO\n\n## Waiting\n\n### pool\nlifts when: an overflow is observed. '
  + stampFor(2) + '.\n\n- Whether the pool ever overflows.\n');
// 'an empty lifts clause names no event'
const file = fixture('# TODO\n\n## Waiting\n\n### pool\nlifts when: ' + stampFor(2) + '.\n\n- a\n');
// 'the event does not stop the stamp being read'
const file = fixture('# TODO\n\n## Waiting\n\n### a\nlifts when: it happens. ' + stampFor(20) + '.\n\n- a\n');
// 'the re-read list names the event to check'
const file = fixture('# TODO\n\n## Waiting\n\n### a\nlifts when: the pool overflows. ' + stampFor(20) + '.\n\n- a\n');
// 'the re-read list does not print the rest of the entry'
const file = fixture('# TODO\n\n## Waiting\n\n### overflow\nlifts when: it overflows. '
  + stampFor(20) + '.\n\n- the pool is unbounded.\n');
```

(e) 檔尾新增：

In `tests/todo-check.test.js`, append at the end of the file:

```js
// Timings. Under `## Waiting` a `###` names what its entries wait for, and they
// lift together; the stamp and the event moved from each entry to the timing.
const timingFixture = (body) => fixture('# TODO\n\n## Waiting\n\n' + body);

test('a Waiting entry under no timing is untimed', () => {
  const file = fixture('# TODO\n\n## Waiting\n\n- a. lifts when: x. ' + stampFor(2) + '.\n');
  assert.deepEqual(kinds(file, NOW), ['untimed']);
  assert.equal(todo.main([file], NOW).ok, false);
});

// The control: the entries under a timing carry no stamp or event of their own.
test('entries under a timing need no stamp of their own', () => {
  const file = timingFixture('### t\nlifts when: x. ' + stampFor(2) + '.\n\n- a\n- b\n');
  assert.deepEqual(kinds(file, NOW), []);
  const [t] = todo.timings(fs.readFileSync(file, 'utf8'), NOW);
  assert.equal(t.title, 't');
  assert.equal(t.event, 'x');
  assert.equal(t.items.length, 2);
  assert.equal(t.items[0].timing, t.line);
});

test('a timing with no entries is empty', () => {
  const file = timingFixture('### t\nlifts when: x. ' + stampFor(2) + '.\n\n### u\nlifts when: y. '
    + stampFor(2) + '.\n\n- a\n');
  const found = todo.check(file, NOW).problems;
  assert.deepEqual(found.map((p) => p.kind), ['empty timing']);
  assert.equal(found[0].line, 5);
});

test('a timing with no lifts line is unlifted and undated', () => {
  const file = timingFixture('### t\n\n- a\n');
  assert.deepEqual(kinds(file, NOW).sort(), ['undated', 'unlifted']);
});

// The control for the grouping itself: `###` is a timing only under Waiting.
// The `- r` under Ready keeps the convention in use; without it the only entry
// sits under a heading of its own and `vocabulary` spares it.
test('a ### under Ready is still a heading of its own', () => {
  const file = fixture('# TODO\n\n## Ready\n\n- r\n\n### grouped\n\n- a\n');
  assert.deepEqual(kinds(file, NOW), ['unclassified']);
});

test('width counts a CJK or full-width character as two columns', () => {
  assert.equal(todo.width('一二三四五六七八九十一二三四'), 28);
  assert.equal(todo.width('一二三四五六七八九十一二三四五'), 30);
  assert.equal(todo.width('abcdefghijklmnopqrstuvwxyzab'), 28);
  assert.equal(todo.width('knip 認得 CJS namespace'), 23);
  assert.equal(todo.width('`suggest` 只推'), 12, 'backticks are not drawn');
});

// The pair that tells columns from characters: fifteen CJK characters are 30
// columns and fail; twenty-eight letters are 28 and pass. A count of characters
// passes the first.
test('a title is capped in columns, not characters', () => {
  const at = (title) => kinds(timingFixture('### ' + title + '\nlifts when: x. ' + stampFor(2) + '.\n\n- a\n'), NOW);
  assert.deepEqual(at('一二三四五六七八九十一二三四五'), ['long title']);
  assert.deepEqual(at('一二三四五六七八九十一二三四'), []);
  assert.deepEqual(at('abcdefghijklmnopqrstuvwxyzab'), []);
});

// NOW is 2026-09-01. The stamp is twenty days old, which alone would make it due;
// an event opening with a date says the reading waits for that day instead.
test('a date timing is due from its date and not before, however old its stamp', () => {
  const file = timingFixture('### gates\nlifts when: 09-05 onward, a week of gates. ' + stampFor(20) + '.\n\n- a\n');
  const before = todo.check(file, NOW);
  assert.deepEqual(before.problems, []);
  assert.deepEqual(before.overdue, []);
  const on = todo.check(file, new Date(2026, 8, 5, 12, 0, 0).getTime());
  assert.equal(on.overdue.length, 1);
  assert.equal(todo.mmdd(on.overdue[0].date), '09-05');
});

test('a date earlier in the year than its stamp is next year', () => {
  const file = timingFixture('### after new year\nlifts when: 01-05 onward. 12-20.\n\n- a\n');
  assert.deepEqual(todo.check(file, new Date(2026, 11, 25, 12, 0, 0).getTime()).overdue, []);
  assert.equal(todo.check(file, new Date(2027, 0, 6, 12, 0, 0).getTime()).overdue.length, 1);
});

test('the re-read list prints a due date timing by its date, with its title', () => {
  const file = timingFixture('### gates\nlifts when: 09-05 onward. ' + stampFor(2) + '.\n\n- a\n');
  const text = todo.report(todo.check(file, new Date(2026, 8, 5, 12, 0, 0).getTime()));
  assert.match(text, /09-05\s+gates \(1\) — 09-05 onward/);
});
```

Run: `node --test tests/todo-check.test.js` — 新測試因 `todo.timings`／`todo.width`／`todo.mmdd`
未定義或 kind 不同而 `✖`。

- [ ] **Step 2：實作 `scripts/todo-check.js`。**

In `scripts/todo-check.js`, after the `LIFTS` / `liftsAt()` block and before `stampAt()`'s comment, add:

```js
// A timing's title, in terminal columns rather than characters. A CJK or
// full-width character takes two, so a cap in characters would let a Chinese
// title run twice as wide as an English one. 28 is fourteen Chinese characters
// or twenty-eight letters — the arithmetic AskUserQuestion's header already
// uses, twelve characters or six in CJK.
const MAX_TITLE_WIDTH = 28;
const WIDE = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/;

function width(s) {
    let n = 0;
    for (const c of String(s).replace(/`/g, '')) n += WIDE.test(c) ? 2 : 1;
    return n;
}

function mmdd(t) {
    const d = new Date(t);
    return String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// An event that opens with `MM-DD` is a date, and its timing is due from that
// day rather than a week after its stamp — the one kind of event a script can
// judge. The day is the first one on or after the stamp: a `01-05` stamped
// `12-20` is next January.
const DATE = /^(\d{2})-(\d{2})(?!\d)/;

function dateAt(event, stamped) {
    const m = event === null ? null : DATE.exec(event);
    if (!m || stamped === null) return null;
    const month = Number(m[1]);
    const day = Number(m[2]);
    const year = new Date(stamped).getFullYear();
    for (const y of [year, year + 1]) {
        const at = new Date(y, month - 1, day);
        if (at.getMonth() !== month - 1 || at.getDate() !== day) continue;
        if (at.getTime() >= stamped) return at.getTime();
    }
    return null;
}
```

In `scripts/todo-check.js`, in `entries()`, replace the heading branch and the bullet line with:

```js
    let timing = null;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^#{1,6}\s/.test(line)) {
            close();
            // Under `## Waiting` a `###` is a timing, not a section: the entries
            // below it wait for the same thing and lift together. Anywhere else
            // it is a heading like any other, and still unclassified.
            if (/^#{3,6}\s/.test(line) && section === 'Waiting') {
                timing = i + 1;
                continue;
            }
            section = line.replace(/^#+\s*/, '').trim();
            timing = null;
            continue;
        }
        if (/^[-*]\s+\S/.test(line)) {
            close();
            current = { line: i + 1, end: i + 1, section, timing, text: line.replace(/^[-*]\s+/, '') };
            continue;
        }
```

（`let timing = null;` 放在 `const close = …` 之後、`for` 之前；`for` 迴圈其餘部分不動。）

In `scripts/todo-check.js`, after `linksIn()`, add:

```js
// Every `###` under `## Waiting`, with the line after it read as its lifts line:
// the event it waits for and the day somebody last agreed it still does. The
// first non-blank line is taken whatever it says, so a line with a stamp and no
// `lifts when:` is `unlifted` rather than `undated` too.
function timings(text, now) {
    const at = now === undefined ? Date.now() : now;
    const lines = text.split(/\r?\n/);
    const found = entries(text);
    const out = [];
    let section = '';
    for (let i = 0; i < lines.length; i++) {
        const h = /^(#{1,6})\s+(.*)$/.exec(lines[i]);
        if (!h) continue;
        if (h[1].length >= 3 && section === 'Waiting') {
            let j = i + 1;
            while (j < lines.length && !lines[j].trim()) j++;
            const next = j < lines.length && !/^#{1,6}\s|^[-*]\s/.test(lines[j]) ? lines[j] : '';
            const event = next ? liftsAt(next) : null;
            const stamp = next ? stampAt(next, at) : null;
            const date = dateAt(event, stamp);
            const days = stamp === null ? null : Math.floor((at - stamp) / 86400000);
            const due = date !== null ? at >= date : days !== null && days >= REREAD_DAYS;
            out.push({ line: i + 1, title: h[2].trim(), event, stamp, date, days, due,
                items: found.filter((e) => e.timing === i + 1) });
            continue;
        }
        section = h[2].trim();
    }
    return out;
}
```

In `scripts/todo-check.js`, in `check()`, replace the whole `if (entry.section === 'Waiting') { … }`
block inside the entries loop with:

```js
        if (entry.section === 'Waiting' && entry.timing === null) {
            problems.push({
                line: entry.line,
                kind: 'untimed',
                detail: 'under ## Waiting but under no ### timing. Put it beneath the ### naming what it'
                    + ' waits for, or open one: a title, then a "lifts when: <the event>. MM-DD." line.',
            });
        }
```

In `scripts/todo-check.js`, in `check()`, right after the entries loop closes and before the `// N26:` comment, add:

```js
    // The stamp and the event live on the timing now, one line for every entry
    // beneath it, so what used to be asked of each Waiting entry is asked here.
    for (const t of timings(text, at)) {
        if (t.stamp === null) {
            problems.push({
                line: t.line,
                kind: 'undated',
                detail: 'no MM-DD stamp on its lifts line. End that line with the date somebody last read'
                    + ' this timing and confirmed it is still waiting — without one it cannot be told from'
                    + ' one nobody has looked at since it was filed.',
            });
        }
        if (t.event === null) {
            problems.push({
                line: t.line,
                kind: 'unlifted',
                detail: 'no "lifts when:" on the line after it. Name the event that would make its entries'
                    + ' actionable — real use, upstream, or another entry landing. A timing that cannot'
                    + ' name one is not waiting for anything.',
            });
        }
        if (!t.items.length) {
            problems.push({
                line: t.line,
                kind: 'empty timing',
                detail: 'no entries under it. A timing lifts the entries beneath it; with none it is'
                    + ' waiting for nothing — remove it.',
            });
        }
        const w = width(t.title);
        if (w > MAX_TITLE_WIDTH) {
            problems.push({
                line: t.line,
                kind: 'long title',
                detail: w + ' columns, cap is ' + MAX_TITLE_WIDTH + ' — a CJK character counts two.'
                    + ' The title names the timing; the event goes on its lifts line.',
            });
        }
        if (t.due) overdue.push({ line: t.line, days: t.days, title: t.title, lifts: t.event, date: t.date, count: t.items.length });
    }
    problems.sort((a, b) => a.line - b.line);
```

In `scripts/todo-check.js`, in `report()`, replace the `if (result.overdue && result.overdue.length) { … }` block with:

```js
    if (result.overdue && result.overdue.length) {
        lines.push('', '  due for a re-read — the date has come, or nobody has checked the event in '
            + REREAD_DAYS + ' days or more:');
        for (const o of result.overdue) {
            // The event, not the entries. What a reader can act on is whether the
            // thing has happened; the entries are what they skip until it has.
            const when = o.date !== null ? mmdd(o.date) + '   ' : String(o.days).padStart(3) + ' days';
            const short = (o.title + ' (' + o.count + ') — ' + (o.lifts || '')).replace(/\s+/g, ' ').trim();
            lines.push('    ' + result.file + ':' + o.line + '  ' + when + '  '
                + (short.length > 72 ? short.slice(0, 71) + '…' : short));
        }
    }
```

In `scripts/todo-check.js`, replace the `module.exports` line with:

```js
module.exports = { MAX_ENTRY_CHARS, MAX_TITLE_WIDTH, REREAD_DAYS, SECTIONS, linksIn, entries, timings, width, mmdd, check, report, main };
```

Replace the header comment lines from the one beginning ``// A `## Waiting` entry with no date stamp is one nobody can age``
through the one ending ``// look for — on 2026-09-06 twelve of thirteen entries named no event at all.``
(`:24`–`:30`) in `scripts/todo-check.js` with:

```js
// Under `## Waiting` entries sit beneath a `###` timing — what they wait for —
// and the timing carries what each entry used to: a line naming the event with
// `lifts when:`, ending in a date stamp. A timing with no stamp is one nobody
// can age, and one with no event is one nobody is waiting for: the stamp says
// when somebody last looked, and a person can always refresh that honestly, so
// it cannot say whether there is anything left to look for — on 2026-09-06
// twelve of thirteen entries named no event at all.
```

In `scripts/todo-check.js`, in the `REREAD_DAYS` comment, replace the lines from the one beginning
``// `## Waiting` has shrunk five times in this repository's history`` through the one ending
``// interval to measure is the one between readings.`` (`:90`–`:95`) with:

```js
// `## Waiting` has shrunk five times in this repository's history — c50a5d5,
// a62863e, 811219c, 3fadc08 and 0004ad5. Four were somebody re-reading the
// section and finding an entry misfiled, and one a question Claude Code's docs
// answered first; none of the five was the thing it named actually happening.
// On 2026-09-18 two did leave that way (cdb240e), and both were found by
// somebody reading the section. It is drained by being read, so the interval
// to measure is the one between readings.
```

Run: `node --test tests/todo-check.test.js` — 除了 `this project’s own TODO.md is an index`
（真的 `TODO.md` 還是舊格式，報 `untimed`）以外全部 `✔`。

- [ ] **Step 3：`TODO.md` 的 `## Waiting` 改成十個時機。**

In `TODO.md`, replace everything from the line `## Waiting` to the end of the file with:

```md
## Waiting

### gates 滿一週
lifts when: 09-25 起，registry 的 `gates` 累積滿一週. 09-18.

- 〔profile〕`suggest` 只推 `land.*`：`class.default`、`design.mockup` 可以從 gate 答案推 — [lib/profile.js](lib/profile.js).

### 交接後 context 仍過 400k
lifts when: 交接選項（簡報 §6.2）實施後 context 仍常過 400k. 09-18.

- 〔session〕極端版：driver 逐站開 headless session、狀態走檔案、關卡問題走 station，每站從零開始；缺總輪數、花費、時間上限與回報 `status` 欄位 — [scripts/station.js](scripts/station.js).

### docs-audit 報未點名模組
lifts when: docs-audit 學會報未被點名的模組. 09-18.

- 〔docs〕兩個 `lib/*.js` 沒有 reference-role 頁面點名：`hook.js`、`report.js`；09-09 記的五個裡另外三個後來被點到了 — [docs/documents.md](docs/documents.md).

### 行內容漂移一次
lifts when: 一條沒帶引文的行內容漂移. 09-18.

- 〔docs〕todo-check 不驗 `path:line` 的行號：改成不存在的行仍然 exit 0 — [scripts/todo-check.js](scripts/todo-check.js). docs-check 補得到一部分，但卡 role、引文與讀得到目標三個前提。

### 判官歸檔造假一次
lifts when: 看到一次宣稱派了卻沒派的歸檔. 09-18.

- 〔judge〕`judge.js record` 要不要驗證這個 session 底下真的有 `fankeel-judge` 的 subagent transcript — [scripts/judge.js](scripts/judge.js).

### 旗標被忽略一次
lifts when: a run is seen ignoring a flag. 09-18.

- 〔ledger〕Whether an ignored flag should be refused — [scripts/ledger.js](scripts/ledger.js), `parseArgs`. `--range x ranges` exits 0; `complete` refuses it.

### fanoutSync 溢位一次
lifts when: a `fanoutSync` overflow is observed. 09-18.

- 〔lib〕Whether `fanoutSync`'s payload costs anything: a 64MB overflow discards every answer and re-reads all thirty serially — [lib/tracked.js](lib/tracked.js).

### 需要第十一種語言
lifts when: a repository needs an eleventh language. 09-18.

- 〔survey〕Language patterns beyond the ten [scripts/survey.js](scripts/survey.js) knows. Anything else is listed under `skipped.noPattern` for a human.

### 下一個前端任務
lifts when: 下一個前端任務出現. 09-18.

- 〔design〕design class：mockup 已落地，其餘是另一個 architectural 任務；計畫的三份必讀來源已不存在，內容多半已併進簡報 — [簡報 §4.1](docs/improvement-brief.md#41-design-階段的-mockup-步驟前端任務).

### knip 認得 CJS namespace
lifts when: knip 認得 CJS namespace property access. 09-18.

- 〔build〕knip 的 unused exports 一格關著：6.37.0 仍認不得 CJS namespace 取用，開著回 156 個假陽性（09-18 重跑） — [docs/development.md](docs/development.md).
```

Run: `node --test tests/todo-check.test.js` — 全部 `✔`。再跑 `node scripts/todo-check.js`：exit 0，
印 `11 entries — 0 ready, 1 needs a decision, 10 waiting`。

- [ ] **Step 4：commit。**

```sh
git add scripts/todo-check.js tests/todo-check.test.js TODO.md
git commit -m "feat: todo-check 認得 ## Waiting 底下的 ### 時機" -m "<body>" -m "Co-Authored-By: …" -m "Claude-Session: …"
```

## Task 2: orient 每次列出全部時機

**Files:**
- Modify: `scripts/orient.js` — `todoBlock(dir, now)` 讀 `timings()`；列出時機；`due` 佔一格；`report()` 傳 `result.now`
- Read: `scripts/todo-check.js` — `timings()`、`mmdd()`，不改
- Test: `tests/orient.test.js`

**Interfaces:**
- Consumes: `todoCheck.timings(text, now)`、`todoCheck.mmdd(t)`（Task 1）
- Produces: `todo:` 區塊的 Waiting 標題行 `  Waiting <N> timing(s), <M> entr(y|ies) — <K> due, offer one option`，或 `— none due, not offered`；其下每個時機一行 `    <due|MM-DD|空白，補到 7 欄><title> (<n>)`

**Dispatch:** implementer, sonnet — 程式碼都在 plan 裡，轉錄加測試。

- [ ] **Step 1：先改測試。**

In `tests/orient.test.js`, change the assertion at `:597` to:

```js
  assert.match(out, /Waiting 0 timings, 0 entries — none due, not offered/);
```

In `tests/orient.test.js`, after the `'a Ready entry drops the offer from 4 to 3'` test, add:

```js
// What `now` a reading of the todo: block is taken at. `scan` stamps
// `Date.now()`; these fix it so a stamp and a date land on known days.
const reportAt = (root, y, m, d) => {
  const r = orient.scan(root, []);
  r.now = new Date(y, m - 1, d, 12, 0, 0).getTime();
  return orient.report(r);
};

test('the todo: block lists every Waiting timing and marks the due ones', () => {
  const root = workspace({});
  const opts = initGit(root);
  const body = [
    '## Ready',
    '',
    '## Needs a decision',
    '',
    '## Waiting',
    '',
    '### gates a week old',
    'lifts when: 09-25 onward, a week of gates. 09-18.',
    '',
    '- a',
    '',
    '### an overflow seen',
    'lifts when: an overflow is observed. 09-01.',
    '',
    '- b',
    '- c',
  ].join('\n') + '\n';
  commitTodo(root, opts, body, '2026-09-18T00:00:00Z');

  const early = reportAt(root, 2026, 9, 20);
  assert.match(early, /Waiting 2 timings, 3 entries — 1 due, offer one option/);
  const lines = early.split(/\r?\n/);
  const head = lines.findIndex((l) => /Waiting 2 timings/.test(l));
  assert.match(lines[head + 1], /^\s+due\s+an overflow seen \(2\)$/, 'the due timing comes first');
  assert.match(lines[head + 2], /^\s+09-25\s+gates a week old \(1\)$/, 'a date not yet reached shows the date');

  const late = reportAt(root, 2026, 9, 26);
  assert.match(late, /Waiting 2 timings, 3 entries — 2 due, offer one option/);
});

// The control: a due timing takes one of AskUserQuestion's four slots, so
// Needs a decision gets one fewer — and with none due it gets them back.
test('a due timing takes one option from Needs a decision', () => {
  const root = workspace({});
  const opts = initGit(root);
  const body = [
    '## Ready',
    '',
    '## Needs a decision',
    '- Entry one',
    '- Entry two',
    '- Entry three',
    '- Entry four',
    '- Entry five',
    '',
    '## Waiting',
    '',
    '### an overflow seen',
    'lifts when: an overflow is observed. 09-01.',
    '',
    '- b',
  ].join('\n') + '\n';
  commitTodo(root, opts, body, '2026-09-01T00:00:00Z');
  assert.match(reportAt(root, 2026, 9, 20), /Needs a decision 5 — newest 3 by last edit, offer these:/);
  assert.match(reportAt(root, 2026, 9, 3), /Needs a decision 5 — newest 4 by last edit, offer these:/);
});
```

Run: `node --test tests/orient.test.js` — 三個測試 `✖`（還印 `Waiting N — not offered`）。

- [ ] **Step 2：實作。**

In `scripts/orient.js`, replace the `todoBlock` function's signature, its counting lines and its `Waiting` line — the whole function becomes:

```js
function todoBlock(dir, now) {
    const file = path.join(dir, 'TODO.md');
    let text;
    try {
        text = fs.readFileSync(file, 'utf8');
    } catch (e) {
        return null;
    }
    const all = todoCheck.entries(text);
    const needs = all.filter((e) => e.section === 'Needs a decision');
    const ordered = orderByEdit(dir, 'TODO.md', needs);
    const timings = todoCheck.timings(text, now);

    const readyCount = all.filter((e) => e.section === 'Ready').length;
    const waitingCount = all.filter((e) => e.section === 'Waiting').length;
    const dueCount = timings.filter((t) => t.due).length;
    const needsCount = needs.length;
    // AskUserQuestion takes four. Ready's section is one option when it has
    // entries, and Waiting's due timings are one more between them, so each
    // takes a slot from Needs a decision's newest few.
    const limit = 4 - (readyCount > 0 ? 1 : 0) - (dueCount > 0 ? 1 : 0);
    const shown = ordered.slice(0, limit);

    const lines = ['todo: TODO.md', '  Ready ' + readyCount];
    if (needsCount === 0) {
        lines.push('  Needs a decision 0');
    } else {
        lines.push('  Needs a decision ' + needsCount + ' — newest ' + shown.length
            + ' by last edit, offer these:');
        for (const e of shown) {
            const t = e.text.replace(/\s+/g, ' ').trim();
            lines.push('    ' + (t.length > TODO_ENTRY_WIDTH ? t.slice(0, TODO_ENTRY_WIDTH - 1) + '…' : t));
        }
        const more = needsCount - shown.length;
        if (more > 0) lines.push('    and ' + more + ' more, not listed — Other takes one by name');
    }
    // Every timing, every time: what is waiting is on screen whether or not
    // it is offered, the way a skill's description is. The due ones first.
    lines.push('  Waiting ' + timings.length + (timings.length === 1 ? ' timing, ' : ' timings, ')
        + waitingCount + (waitingCount === 1 ? ' entry' : ' entries') + ' — '
        + (dueCount ? dueCount + ' due, offer one option' : 'none due, not offered'));
    for (const t of timings.filter((x) => x.due).concat(timings.filter((x) => !x.due))) {
        const col = t.due ? 'due' : t.date !== null ? todoCheck.mmdd(t.date) : '';
        lines.push('    ' + col.padEnd(7) + t.title + ' (' + t.items.length + ')');
    }
    return lines;
}
```

In `scripts/orient.js`, in `report()`, change `const todo = todoBlock(todoDir);` to:

```js
        const todo = todoBlock(todoDir, result.now);
```

Update the comment above `todoBlock` — its first paragraph ends `…plus the count of what got left out rather than a silent drop of it.`; append one sentence:
`// Waiting is listed in full, one line per timing, and offered as one option once any is due.`

Run: `node --test tests/orient.test.js` — 全部 `✔`。

- [ ] **Step 3：在真的 `TODO.md` 上核對 N、M、K。**

N、M 用 awk 直接數 `## Waiting` 底下的 `###` 與 bullet，不經 `timings()`——拿被測的函式去核對它自己，對不上也看不出來。K 數 orient 輸出裡 Waiting 標題行底下以 `due` 開頭的行。`TODO.md` 刻意不列在 `Read:`：這一步只數 `## Waiting`，Task 4 只改檔案開頭的說明，兩個同時跑數到的也一樣，列進去只會讓 Task 2 與 Task 4 排成先後。

```sh
node scripts/orient.js > .fankeel/build/2026-09-19-waiting-triggers/orient.txt
grep -E '^  Waiting ' .fankeel/build/2026-09-19-waiting-triggers/orient.txt
awk '/^## /{w=($0=="## Waiting")} w&&/^### /{n++} w&&/^- /{m++} END{print n" timings, "m" entries"}' TODO.md
awk '/^  Waiting /{w=1;next} w&&/^    /{if($1=="due")k++;next} w{w=0} END{print k+0" due"}' .fankeel/build/2026-09-19-waiting-triggers/orient.txt
```

期望：第一行是 `  Waiting 10 timings, 10 entries — <K> due, offer one option` 或 `— none due, not offered`；第二行印 `10 timings, 10 entries`；第三行的數字等於第一行的 K（沒有 `due` 時是 `0 due`）。三者有一處對不上就停下回報，不 commit。

- [ ] **Step 4：commit。**

```sh
git add scripts/orient.js tests/orient.test.js
git commit -m "feat: orient 每次列出全部 Waiting 時機，有 due 才佔一格" -m "<body>" -m "Co-Authored-By: …" -m "Claude-Session: …"
```

## Task 3: INIT 子句與處理流程

**Files:**
- Modify: `lib/stages.js` — `:154` 的 `` `## Waiting` stays out; `` 換一個子句，行數不變
- Modify: `skills/fankeel/SKILL.md` — `:618` 表格列；`:723` 起「`## Waiting` is not offered at all」那兩句換成處理流程
- Test: `tests/render.test.js`

**Interfaces:**
- Consumes: none — 只改一行規則字串與文件，不呼叫任何程式
- Produces: INIT 規則文字 `` `## Waiting` is one option when `orient` marks any `due`; ``

**Dispatch:** implementer, sonnet — 一行程式字串、兩段文件、一個測試。

- [ ] **Step 1：先寫測試。**

In `tests/render.test.js`, after the test `'the init block carries the station line when it is given one, and stays under the cap with it'`, add:

```js
test('init offers ## Waiting as one option once orient marks a timing due', () => {
  const out = renderInit({ sessionId: MINE });
  assert.match(out, /`## Waiting` is one option when `orient` marks any `due`/);
  assert.doesNotMatch(out, /`## Waiting` stays out/);
});
```

Run: `node --test tests/render.test.js` — 新測試 `✖`。

- [ ] **Step 2：改 `lib/stages.js:154`。**

In `lib/stages.js`, on line 154, replace the substring `` `## Waiting` stays out; `` with
`` `## Waiting` is one option when `orient` marks any `due`; ``。同一行，其餘字元不動。

Run: `node --test tests/render.test.js` — 全部 `✔`，兩個 `init` 上限測試的診斷行 `init+st` 仍 `< 1400`。

- [ ] **Step 3：改 `skills/fankeel/SKILL.md`。**

In `skills/fankeel/SKILL.md`, replace the table row at `:618` with:

```md
| Work deliberately deferred | `TODO.md`, one line, linking to the detail, under the heading for what it is short of — and under `## Waiting`, beneath a `### <timing>` whose next line is `lifts when: <the event>` and then a `MM-DD` stamp |
```

In `skills/fankeel/SKILL.md`, in the paragraph beginning ``Then `What is the task?`, in the same call.``, replace the two sentences
``**Other**. `## Waiting` is not offered at all: nothing under it can move today,``
``and six unpickable rows are how a menu stops being read.`` with:

```md
**Other**. `## Waiting` is one option, and only when `orient`'s `todo:` block
marks a timing `due` — its date has come, or nobody has re-read it in seven
days. Its timings are never options one by one — six unpickable rows are how a
menu stops being read — but every one is listed in that block each time, so what
is waiting is on screen whether or not it is offered. Picking it starts a task
with `--route "survey,build,land"`. `survey` judges the due timings only: an
event whose evidence is in the repository, its registry or upstream is checked
there, and the ones only a person could have witnessed go into one
`AskUserQuestion`, `multiSelect`, one option per timing with its event as the
description — which of these has happened? `build` moves a lifted timing's
entries together to `## Ready` or `## Needs a decision` and drops its `###` and
its `lifts when:` line; a timing still waiting gets today's stamp, and one whose
date came without its event gets a new date. `land` runs `todo-check`.
```

`skills/fankeel/SKILL.md` 不在 `lib/stages.js` 的行號引用鏈上，行數可以變。

- [ ] **Step 4：commit。**

```sh
git add lib/stages.js skills/fankeel/SKILL.md tests/render.test.js
git commit -m "feat: init 在有 due 時給 Waiting 一個選項，skill 寫處理流程" -m "<body>" -m "Co-Authored-By: …" -m "Claude-Session: …"
```

## Task 4: 文件改成時機的寫法

**Files:**
- Modify: `TODO.md` — 開頭說明：表格 Waiting 列、〔前綴〕段、`lifts when:` 段、「only heading」段、todo-check 段、「It also prints」段
- Modify: `docs/development.md` — `:50` 起那一段
- Modify: `skills/fankeel-land/SKILL.md` — `:112` 表格列
- Modify: `skills/fankeel-audit/rationale.md` — `:151-154` 那兩句

**Interfaces:**
- Consumes: none — 只寫文字，描述的格式由 `TODO.md` 已落地的時機示範，不呼叫任何程式
- Produces: none

**Dispatch:** implementer, sonnet — 四份文件的段落替換，替換文字都在 plan 裡。

- [ ] **Step 1：`TODO.md` 開頭說明。**

In `TODO.md`, replace the table row starting `` | `## Waiting` | `` with:

```md
| `## Waiting` | something that is not a person: real use, upstream, or another entry landing | grouped under `### <timing>`; every timing listed, one option once any is due |
```

In `TODO.md`, at the end of the paragraph beginning ``A bullet may also open with a `〔word〕` prefix``, after
``is about, which is the question the heading is deliberately not asking.``, append:

```md
Under `## Waiting` a `###` is not a topic either: it is the timing its entries
wait for, and they lift together when it comes.
```

In `TODO.md`, replace the paragraph beginning ``An entry under `## Waiting` carries two things at its end`` (through ``because that is where the check looks for it.``) with:

```md
Under `## Waiting` entries sit beneath a `### <timing>` — a title at most 28
columns wide, a CJK character counting two — whose next line is
`lifts when: <the event>` and then a `MM-DD` stamp. The event is what would make
the entries actionable — real use, upstream, or another entry landing — and it
is the one that says whether they belong under this heading at all. On
2026-09-06 twelve of the thirteen entries here named no event anybody could
write down, and four of those twelve turned out to be waiting on nothing that
was ever going to arrive. An event that opens with an `MM-DD` is a date, and its
timing is due that day. The stamp is **the day somebody last read the timing and
agreed it is still waiting**, not the day it was filed: re-read one, decide it is
still blocked, and move the stamp forward in the same change. The stamp goes
last, because that is where the check looks for it.
```

In `TODO.md`, replace the paragraph beginning ``This is the only heading that asks for either.`` with:

```md
This is the only heading that asks for a timing. `## Ready` and
`## Needs a decision`'s newest few are read aloud every time `/fankeel` offers a
menu, so those get looked at whether anyone meant to or not. `## Waiting` is the
section nothing made you open, which is why it has to say what it is waiting for
and when you last agreed it was — and why `orient` now lists every timing each
time, and `/fankeel` offers one option to handle them once any is due.
```

In `TODO.md`, replace the paragraph beginning ``` `node scripts/todo-check.js` enforces all six``` with:

```md
`node scripts/todo-check.js` enforces all nine: a link that no longer resolves is
an entry someone forgot to close, a link that still resolves but points at a
plan, a decision record, a report or an archive is the same entry one step
earlier — those four roles record a moment rather than the present, so the detail
behind the bullet is pointing at history however fresh that history is — an entry
over the length cap is detail written here instead of where it belongs, an entry
under any other heading is one nobody said the state of, a `## Waiting` entry
under no timing is one nobody said what it waits for, a timing with no stamp is
one nobody can tell a fresh deferral from a forgotten one, a timing with no
`lifts when:` is one nobody is waiting for, a timing with no entries is waiting
for nothing, and a title over 28 columns is a sentence where a name belongs.
```

In `TODO.md`, replace the paragraph beginning ``It also prints, without failing the run,`` (through ``It shrank when somebody read it.``) with:

```md
It also prints, without failing the run, every timing that is due — its date has
come, or its stamp is seven days old — with its event, so what you are asked is
whether that event has happened, which is a question about the world rather than
about you. That list is not a defect report: a timing can sit there correctly
filed for a month. On 2026-09-18 two entries left because their events had
happened, and both were found by somebody reading the section rather than by the
event announcing itself. The section is drained by being read, so the reading is
what gets scheduled.
```

- [ ] **Step 2：`docs/development.md`。**

In `docs/development.md`, replace the paragraph beginning ``An entry under `## Waiting` also carries`` (through ``so the interval between readings is the thing to measure.``) with:

```md
Under `## Waiting`, entries are grouped by what they wait for: a `### <timing>`
heading at most 28 columns wide — a CJK character counts two — whose next line
is `lifts when: <the event>` and then a `MM-DD` stamp, followed by the entries
that lift together when it comes. todo-check fails a Waiting entry under no
timing, a timing with no entries, one missing its event or its stamp, and a
title over the width. The stamp is the day somebody last read that timing and
agreed it is still waiting — not the day it was filed — so re-reading one and
leaving it where it is means moving its stamp forward. An event that opens with
an `MM-DD` is a date, and its timing is due from that day; any other timing is
due once its stamp is seven days old. Due timings print below the verdict as
**due for a re-read**, without failing the run: sitting under `## Waiting` for a
fortnight is not a defect, and a script cannot know whether the thing a timing
waits for has happened. What it can know is a date, and how long since a person
last said it had not. On 2026-09-18 two entries left because their events had
happened, and both were found by somebody reading the section rather than by the
event announcing itself — so the reading is what gets scheduled: `orient` lists
every timing each time, and `/fankeel` offers one option once any is due.
```

- [ ] **Step 3：`skills/fankeel-land/SKILL.md:112`。**

In `skills/fankeel-land/SKILL.md`, replace the table row beginning `| work deliberately deferred |` with:

```md
| work deliberately deferred | `TODO.md`, one line, under the heading for what it is short of — under `## Waiting`, beneath a `### <timing>` whose next line is `lifts when: <the event>` then a `MM-DD` stamp, or `todo-check` fails the gate below |
```

- [ ] **Step 4：`skills/fankeel-audit/rationale.md:151-154`。**

In `skills/fankeel-audit/rationale.md`, replace the sentences
``One routed to `## Waiting` names the event with `lifts when:` and then carries a `MM-DD` stamp, or `todo-check.js` refuses it without either.`` with:

```md
One routed to `## Waiting` goes beneath the `### <timing>` it waits for — a new
one if none fits — whose next line names the event with `lifts when:` and then
carries a `MM-DD` stamp, or `todo-check.js` refuses it.
```

- [ ] **Step 5：檢查並 commit。**

Run: `node scripts/todo-check.js`（exit 0）、`node scripts/docs-check.js`（exit 0）。

```sh
git add TODO.md docs/development.md skills/fankeel-land/SKILL.md skills/fankeel-audit/rationale.md
git commit -m "docs: TODO 與三份文件改成 Waiting 時機的寫法" -m "<body>" -m "Co-Authored-By: …" -m "Claude-Session: …"
```

## Coverage

| promise | task |
|---|---|
| `## Waiting` 底下每個時機寫成： | Task 1 |
| 時機標題去掉反引號後，顯示寬度不超過 28 欄：中日韓文字與全形符號算 2 欄，其餘算 | Task 1 |
| 標題後第一個非空行是 `lifts when: <事件>. MM-DD.`，戳記的意思不變：最後一次有人 | Task 1 |
| 時機底下至少一條 bullet；bullet 不再各自帶 `lifts when:` 與戳記。 | Task 1 |
| 事件以 `MM-DD` 開頭的是日期時機；那個日子取戳記當天或之後第一次出現的那天， | Task 1 |
| `entries()` 在 `## Waiting` 底下遇到 `###` 不重設 section，改給後面的條目帶上 | Task 1 |
| 匯出 `timings(text, now)`，每個時機回 `{ line, title, event, stamp, date, due, items }`； | Task 1 |
| `due`：日期時機從那天起為真，之前不管戳記多舊都為假；其他時機在戳記滿 | Task 1 |
| 下列各是 problem、exit 1：`## Waiting` 底下不在任何 `###` 裡的 bullet；時機缺 | Task 1 |
| 匯出 `width(s)`，照第 1 節的算法回顯示寬度；repository 裡還沒有這樣的函式， | Task 1 |
| `report()` 印 `due` 的時機：標題、事件、條數；`due` 仍然不影響 exit code。 | Task 1 |
| `todoBlock()` 每次列出全部時機，一個一行：`due` 標記或日期、標題、條數。`due` | Task 2 |
| 標題行寫 `Waiting N timings, M entries — K due, offer one option`，沒有 `due` 時寫 | Task 2 |
| `lib/stages.js` 的 INIT 把 `` `## Waiting` stays out `` 換成 | Task 3 |
| `skills/fankeel/SKILL.md` 的 **Asking** 一節寫長版：選了「處理 Waiting」就用 | Task 3 |
| 同一節原本寫 `## Waiting` 完全不提供（`skills/fankeel/SKILL.md:723`），改成上面這條。 | Task 3 |
| `TODO.md` 的十條改成十個時機，各一條：gates 滿一週（09-25，〔profile〕）、交接後 | Task 1 |
| `TODO.md` 開頭的說明：表格 Waiting 那列、`lifts when:` 與戳記那段改成時機的寫法、 | Task 4 |
| 描述格式的另外四處改成時機的寫法：`docs/development.md:50`、 | Task 3（`skills/fankeel/SKILL.md:618`）、Task 4（其餘三處） |
| 驗收：`tests/orient.test.js` 的兩個時機 fixture，09-20 `1 due`、09-26 `2 due` | Task 2 |
| 驗收：`tests/todo-check.test.js` 四種格式錯誤各自 exit 1 且原因正確 | Task 1 |
| 驗收：15 個中文字與 28 個英文字母的對照 | Task 1 |
| 驗收：實際 `TODO.md` 跑 todo-check exit 0，orient 的 N、M、K 對得上 | Task 1 Step 3（todo-check）、Task 2 Step 3（orient） |
| 驗收：`tests/render.test.js` 的 init 兩個上限測試照舊通過 | Task 3 |

`TODO.md` 的時機裡沒有一條是這個任務交付的，所以沒有條目要關；本任務的來源〔todo〕
那條 09-17 已經以 N11 關掉（`docs/archive/2026-09-17-needs-decision-all-design.md:18`）。
