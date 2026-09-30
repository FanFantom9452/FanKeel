---
status: design-intent
---

# TODO 盤點四件與盤點全表 Implementation Plan

**Goal:** 做完 10-01 盤點的四件 do-now（commit-3 改 warn、關 data、試 knip 6.39.0、重量 station-8），並把「盤點列出 `TODO.md` 全部條目、主控在 gate 前印出全表」寫進 fankeel 本身。
**Architecture:** Task 1–5 的檔案互不重疊，同一組平行派出；Task 6 消費 Task 1、2 落地後的 sha 來關 commit-3 與 data 兩個條目，所以排在後面。Task 3、4 的結果是量測，量完依結果改自己的條目（knip 不論結果都不關條目；station-8 過了才關）。Task 5 讓受控 survey 的主控在問 gate 前印出報告本文（每次 survey 都印，不只盤點：主控分不出哪次是盤點，而 survey 報告本來就短）。
**Tech Stack:** Node v24.9.0（CommonJS、`'use strict'`、只用內建模組——`package.json` 沒有 dependencies），`node --test`，git 2.44.0.windows.1，fankeel 0.85.0；knip 全域版 6.32.2，這次用 `npx --yes knip@6.39.0`。
**Spec:** [survey.md](../../../.fankeel/build/task-20260930T181052/survey.md)

Spec 是本 task survey 站的報告（gitignored，只在主 checkout）；這條路線沒有 design 站。使用者在 survey 的 gate 選了「plan，另開 all 實跑」，並在 plan 站加了一條指示：盤點的 survey 要列出全部條目、主控要在 gate 前給使用者看全表，改在 fankeel 本身。

## Global Constraints

由 `node scripts/map.js`（exit 0；466 份 markdown、3 份 planned 未建）、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`）、`package.json` 與測試套件產生：

- `lib/*.js` 是純函式、直接測；`lib/` 不 require `scripts/` 或 `hooks/`（`CONTRIBUTING.md` 的 Core logic 列）。`scripts/*.js` 是 `lib/` 的薄包裝。
- 測試：`node --test`；每個 export 都要有 importer；新檔要先 `git add`，`tests/source.test.js` 才看得到。本計畫不新增測試檔，全部加在既有檔。
- 實作者只跑自己 task 列出的測試檔，不跑全套；全套由 build 收尾跑。
- `TODO.md` 不手改：由 `docs/90-agent/todo/` 的條目檔以 `node scripts/todo.js index` 產生；關條目用 `node scripts/todo.js done <id> --sha <sha> [--disposition done|measured-no-change|abandoned]`（`lib/todo.js:271` 的 `DISPOSITIONS`）；改完跑 `node scripts/todo-check.js`，exit 0。`TODO.md` 不列在各 task 的 `**Files:**`（`ledger.js ready` 本來就不把它當共用檔），但凡是跑過 `todo.js` 的 task，提交路徑要帶上 `TODO.md`。
- `READ_CAP` 1500、`FILE_CAP` 3（`lib/plantasks.js:346-347`）。
- 受控 stage 的注入區塊每個都要低於 2400 字元（`tests/render.test.js:716-729`）；這個上限不調高。
- 縮排跟著檔案走：`lib/`、`scripts/` 四格；`tests/commit-format.test.js` 四格；`tests/stages.test.js`、`tests/skills.test.js`、`tests/brief.test.js` 兩格。
- 行尾 LF（`.gitattributes`：`* text=auto eol=lf`）。檔案用 Edit／Write 改，不用 heredoc（heredoc 吃反斜線）。
- 這次 build 由 stage agent 跑（`stage.agents` 是 all）：實作者在自己的 worktree 裡工作，開工前先 `git reset --hard <build agent 給的 sha>`；實作者不 commit、不 `git add`、不 `git stash`，改完就回報，由 build agent 寫 commit 檔、主控跑 `scripts/commit.js`。
- `.fankeel/profile.json` 在主 checkout 有未提交的改動（`stage.agents` 改成 all），不屬於任何 task，永遠不提交、不還原。
- 文件裡的 session id 寫成 `session <id>`，不寫裸的 8 位 hex；commit 寫成 `commit <sha>`。
- 量測的原始輸出放 `F:/ymlab/fankeel/.fankeel/build/task-20260930T181052/`（gitignored）；每份 log 第一行寫 HEAD 與 `git status --porcelain` 行數。

## Risks

- `.fankeel/sessions/` 與 `station8.js` 都只在主 checkout，worktree 裡沒有 — Task 4 — 腳本一律用 `F:/ymlab/fankeel/...` 的絕對路徑跑，先 `ls` 確認舊腳本在。
- station-8 已在 09-30 量過一次、判定 fail（survey 報告寫「未量」是漏看）；再量同一段（8806240d 之後）一定還包含那三個 fail 的 session，結果不會變 — Task 4 — 改量 09-30 那次量測之後（commit 4c5470489bd440b7eff963548ee2d9dd0ffd239f，2026-09-30 20:19:47 +0800）才開始的 session。
- `npx --yes knip@6.39.0` 要連網；失敗就沒有結果可記 — Task 3 — 第一步先 `--version`，不是 6.39.0 就停手回報那行錯誤，任何檔都不改。
- 受控 survey 的注入區塊多了約 50 字元 — Task 5 — 跑 `tests/render.test.js`，2400 上限那兩個測試要過；超過就縮 Task 5 新加的那句，不動上限。
- `docs/90-agent/reference/subagents.md` 裡描述主控「relay a path」的句子，在 Task 5 之後對 survey 不完整 — Task 5 — 不在本計畫改，留給 verify 的文件檢查；Task 5 已同步改 `lib/render.js` 對 stage agent 說的那句。
- 一個 profile 檔讀不了時 `commit.js` 多印一行，讀 `commit.js` 輸出的地方可能只預期 range 行 — Task 1 — 新行放在所有 range 之後，跟既有的 `sensitive:` 行同一個位置；`tests/commit.test.js` 的 fixture 沒有 profile，不受影響。
- Task 6 要找的是 Task 1、2 在 main 上的 commit — Task 6 — 它消費 Task 1、2 的 Interfaces，`ledger.js ready` 等兩者完成才派；sha 用 `git log -1 --format=%H -- <path>` 讀，讀到的 commit 訊息要對得上。

## Task 1: commit-3 — profile 讀不了時 commit.js 照提交、另起一行說

**Files:**
- Modify: `scripts/commit.js` — `main()` 讀 profile 時收下 `unreadable`，每個讀不了的檔在輸出最後多一行
- Modify: `docs/90-agent/reference/subagents.md:552` — commit 列補上這一行
- Test: `tests/commit-format.test.js`

**Interfaces:**
- Consumes: none
- Produces: `commit-3` — `commit.main(argv, cwd)` 的 `text` 在 range 行之後，每個讀不了的 profile 檔一行 `profile: <file> does not parse — its values were skipped`；提交照做，`code` 不變。

**Dispatch:** implementer, sonnet

1. 在 `tests/commit-format.test.js` 檔尾加入：

```js
test('a profile.json that does not parse still commits, and says so on a line after the range', () => {
    const dir = repo();
    fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.fankeel', 'profile.json'), '{ "commit.format": ');
    const res = commit.main([request('a.txt\n\nchange a\n')], dir);
    assert.ok(!res.code, res.text);
    assert.equal(git(dir, 'log', '-1', '--format=%s'), 'change a');
    const lines = res.text.split('\n');
    assert.equal(lines.length, 2, res.text);
    assert.match(lines[0], /^[0-9a-f]{40}\.\.[0-9a-f]{40}$/);
    assert.match(lines[1], /^profile: .*profile\.json does not parse — its values were skipped$/);
});
```

   對照組：讀得了的 profile 不該有這行。在 `tests/commit-format.test.js` 的 `test('a subject matching commit.format commits', ...)` 裡，`assert.ok(!res.code, res.text);` 的下一行加入：

```js
    assert.doesNotMatch(res.text, /^profile: /m);
```

2. 跑它，看新測試紅（`lines.length` 是 1）：

```sh
node --test tests/commit-format.test.js; echo exit=$?
```

3. 在 `scripts/commit.js` 的 `main()`，把

```text
    let values = {};
    try { values = profile.read(topDir, profile.configDirOf()).values; } catch (e) { /* the builtins */ }
```

   在 `scripts/commit.js` 換成：

```js
    let values = {};
    // commit-3: a profile layer that does not parse is skipped, as every other
    // reader of the profile skips it, but said on its own line after the
    // ranges, so a malformed profile.json cannot switch commit.format and
    // sensitive.mode off without a trace. A warning, not a refusal: the paths
    // are the agent's work, and the profile is the user's to fix.
    let notice = [];
    try {
        const read = profile.read(topDir, profile.configDirOf());
        values = read.values;
        notice = read.unreadable.map((file) => 'profile: ' + file + ' does not parse — its values were skipped');
    } catch (e) { /* the builtins */ }
```

4. 同一個 `scripts/commit.js`，其餘四個回傳點都把 `notice` 接在最後。`commit.format` 不符的那個 `return` 的 `text:` 改成：

```js
                    text: ['commit.js: ' + (parsed.blocks.length > 1 ? 'block ' + (i + 1) + ': ' : '')
                        + 'the subject "' + subject + '" does not match commit.format ' + values['commit.format']].concat(notice).join('\n'),
```

   `scripts/commit.js` 裡 `const fail = ...` 那行改成：

```js
        const fail = (why) => ({ text: out.concat('commit.js: ' + (many ? 'block ' + (i + 1) + ': ' : '') + why, notice).join('\n'), code: 1 });
```

   `scripts/commit.js` 裡 `if (r.conflict) return ...` 那行改成：

```js
            if (r.conflict) return { text: out.concat(label + 'conflict ' + r.conflict.join(' '), notice).join('\n'), code: 1 };
```

   `scripts/commit.js` 函式最後的 `return { text: out.join('\n') };` 改成：

```js
    return { text: out.concat(notice).join('\n') };
```

5. 在 `docs/90-agent/reference/subagents.md` 第 552 行，把 `or `<base>..<sha>` for a one-block file;` 換成：

```md
or `<base>..<sha>` for a one-block file; after them, one `profile: <file> does not parse — its values were skipped` line per profile layer that does not parse, the commit made regardless (commit-3);
```

6. 跑它，全綠，再跑 commit 的另兩個測試檔確認沒被多出的行弄紅：

```sh
node --test tests/commit-format.test.js tests/commit.test.js tests/profile-commit-format.test.js; echo exit=$?
```

7. 控制組：把第 4 步最後那行暫時改回 `return { text: out.join('\n') };`，再跑 `node --test tests/commit-format.test.js`，新測試要紅；改回來再跑一次要綠。兩次的 exit 都寫進回報。

8. 不 commit。回報要提交的路徑：`scripts/commit.js`、`tests/commit-format.test.js`、`docs/90-agent/reference/subagents.md`；訊息：

```text
fix: commit.js says when a profile file does not parse

- a malformed profile layer is skipped as before, and now named on a line after the ranges — scripts/commit.js
- the commit row names that line — docs/90-agent/reference/subagents.md
```

## Task 2: data — 把 data 位置的決定寫進 documents.md

**Files:**
- Modify: `docs/90-agent/reference/documents.md:25` — 最後一句改寫，決定留在文件裡、不再由 TODO 條目帶著

**Interfaces:**
- Consumes: none
- Produces: `data-1` — documents.md 第 25 行記下 data 位置的決定；Task 6 用這個 commit 的 sha 關 data-1。

**Dispatch:** implementer, sonnet

1. 確認要換的句子只有一處：

```sh
grep -c "Owner and retention for a data location are decided but not built either; the TODO entry carries them." docs/90-agent/reference/documents.md
```

   要印 `1`；不是 1 就停手回報。

2. 在 `docs/90-agent/reference/documents.md` 第 25 行，把 `Owner and retention for a data location are decided but not built either; the TODO entry carries them.` 換成：

```md
Owner and retention for a data location are decided but not built either: a `data` bucket will declare its path, an owner and a retention date, survey will read them, and audit will check that the path exists. The TODO entry that carried this, data-1, was closed on 2026-10-01 with nothing built; a project that needs it opens a new entry.
```

3. 檢查連結與行號沒壞：

```sh
node scripts/docs-check.js; echo exit=$?
```

   exit 0。若 exit 非 0，只看有沒有指到 `documents.md` 的行；有就修，別的行照抄進回報、不修。

4. 不 commit。回報要提交的路徑：`docs/90-agent/reference/documents.md`；訊息：

```text
docs: record the data-location decision in documents.md

- owner, retention, survey reads, audit checks the path; decided, not built — docs/90-agent/reference/documents.md
```

## Task 3: knip 6.39.0 — 量 CJS namespace 取用認不認得

**Files:**
- Modify: `docs/90-agent/todo/build-1.md` — 依量測改描述與日期
- Modify: `docs/01-guide/development.md:218-221` — 補一句 10-01 的結果
- Read: `knip.json` — `exclude: ["exports"]` 那一格，本 task 不改

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet

1. 確認拿得到 6.39.0，並把 log 開頭寫好：

```sh
LOG=F:/ymlab/fankeel/.fankeel/build/task-20260930T181052/knip-6.39.0.log
{ echo "HEAD $(git rev-parse HEAD) porcelain $(git status --porcelain | wc -l)"; npx --yes knip@6.39.0 --version; } > "$LOG" 2>&1; echo exit=$?; cat "$LOG"
```

   第二行不是 `6.39.0` 就停手，回報那幾行，不改任何檔。

2. 用 `docs/01-guide/development.md` 那段的同一個對照：`badgeWord` 是解構取用，`clearBadge` 是 `badge.clearBadge` 的 namespace 取用（`scripts/task.js:170`、`hooks/inject.js:74`）：

```sh
{ npx --yes knip@6.39.0 --trace-export badgeWord; npx --yes knip@6.39.0 --trace-export clearBadge; } >> "$LOG" 2>&1; echo exit=$?
```

3. 數 unused exports：

```sh
npx --yes knip@6.39.0 --include exports >> "$LOG" 2>&1; echo exit=$?; grep -n "Unused exports" "$LOG"
```

4. 判定只看第 2 步 `clearBadge` 那段：印出 `(no imports found)` 就是「仍認不得」，否則是「認得了」。

5. 「仍認不得」：在 `docs/90-agent/todo/build-1.md`，把 `description:` 那行換成下面這行（`<N>` 是第 3 步 `Unused exports (<N>)` 的數字），並把 `stamp: 2026-09-30` 改成 `stamp: 2026-10-01`：

```md
description: knip 的 unused exports 一格關著：6.39.0 仍認不得 CJS namespace 取用（`clearBadge` 追不到），開著回 <N> 個假陽性（10-01 重跑） — [docs/development.md](docs/01-guide/development.md).
```

   「認得了」：在 `docs/90-agent/todo/build-1.md`，同一行換成下面這行，`state: blocked` 改成 `state: ready`，並刪掉 `group:`、`timing:`、`stamp:` 三行：

```md
description: knip 6.39.0 認得 CJS namespace 取用了（10-01，`clearBadge` 追得到）；開著 unused exports 回 <N> 個，逐一判定真死或假陽性後再拿掉 knip.json 的 `exclude` — [docs/development.md](docs/01-guide/development.md).
```

6. 「仍認不得」：在 `docs/01-guide/development.md` 第 221 行，`tool did not change.` 之後、`One barrel shows` 之前接這一句（那句從第 220 行行尾的 `the tree grew, the` 折行過來，所以只找 `tool did not change.`），`<N>` 同上：

```md
On 2026-10-01 knip 6.39.0 still does not: `knip --trace-export clearBadge` still finds no imports, and `knip --include exports` gives <N>.
```

   「認得了」：在 `docs/01-guide/development.md` 同一個位置改接這一句：

```md
On 2026-10-01 knip 6.39.0 does: `knip --trace-export clearBadge` finds its imports, and `knip --include exports` gives <N>, not yet sorted into dead exports and false positives, so the exclusion stays until they are.
```

7. 重產 `TODO.md` 並檢查：

```sh
node scripts/todo.js index; node scripts/todo-check.js; echo todo-check=$?; node scripts/docs-check.js; echo docs-check=$?
```

   兩個都 exit 0。

8. 不 commit。回報判定、`<N>`、log 路徑，以及要提交的路徑：`docs/90-agent/todo/build-1.md`、`docs/01-guide/development.md`、`TODO.md`；訊息：

```text
docs: knip 6.39.0 measured against CJS namespace access

- build-1 restamped with the 6.39.0 result — docs/90-agent/todo/build-1.md
- the knip section records the 10-01 run — docs/01-guide/development.md
```

## Task 4: station-8 — 量 09-30 量測之後的 session

**Files:**
- Modify: `docs/90-agent/todo/station-8.md` — 加一節「量測 2026-10-01」，過了就關
- Read: `F:/ymlab/fankeel/.fankeel/build/2026-09-30-ready-eleven/station8.js` — 上次的量測腳本，只換截止時間

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet

1. 做一份只換截止時間的腳本。它必須放在主 checkout 的 `.fankeel/build/<目錄>/` 下，`REPO` 才會解析到主 checkout（`.fankeel/sessions/` 只在那裡）：

```sh
OLD=F:/ymlab/fankeel/.fankeel/build/2026-09-30-ready-eleven/station8.js
NEW=F:/ymlab/fankeel/.fankeel/build/task-20260930T181052/station8-after-0930.js
ls "$OLD" && sed "s/2026-09-30T05:10:45+08:00/2026-09-30T20:19:47+08:00/" "$OLD" > "$NEW" && grep -n "const CUT" "$NEW"
```

   `grep` 要印 `const CUT = Date.parse('2026-09-30T20:19:47+08:00');`；沒印就停手回報。20:19:47 是 09-30 那次量測的 commit 4c5470489bd440b7eff963548ee2d9dd0ffd239f 的時間。

2. 在主 checkout 跑，log 開頭寫 HEAD 與 porcelain：

```sh
LOG=F:/ymlab/fankeel/.fankeel/build/task-20260930T181052/station8-2026-10-01.log
{ echo "HEAD $(git -C F:/ymlab/fankeel rev-parse HEAD) porcelain $(git -C F:/ymlab/fankeel status --porcelain | wc -l)"; node "$NEW"; } > "$LOG" 2>&1; echo exit=$?; cat "$LOG"
```

3. 判定：最後一行 `sessions <s>; (1) peak over 300k: <a>; (2) sessions with 10 or more agents: <b>, of them share 15% or more: <c>`。`<s>` 是 0 → 「沒有 session 可量」；`<a>` 是 0 且 `<c>` 是 0 → pass；其他 → fail。

4. 在 `docs/90-agent/todo/station-8.md` 檔尾加一節（表格每列取自 log 的一行 `session ...`，session id 前面保留 `session `）：

```md

## 量測 2026-10-01

範圍：commit 4c5470489bd440b7eff963548ee2d9dd0ffd239f（2026-09-30 20:19:47 +0800，上一次量測）之後開始、transcript 找得到、至少一個 subagent 的 session；在主 checkout 的 commit <HEAD sha> 跑。

<log 最後一行，原樣>

| session | subagent 數 | 最高峰值（agent） | 最貴 agent 佔比（agent） | subagent 總花費 |
|---|---|---|---|---|
| session <id> | <agents> | <peak>（<agent>） | <share>（<agent>） | $<total> |

判定：<pass | fail | 沒有 session 可量>。
```

5. 只有 pass 時關條目：

```sh
node scripts/todo.js done station-8 --sha "$(git -C F:/ymlab/fankeel rev-parse HEAD)" --disposition done
```

   fail 或沒有 session 可量時不關，改跑 `node scripts/todo.js index`。兩種都接著跑：

```sh
node scripts/todo-check.js; echo todo-check=$?
```

6. 不 commit。回報判定、三個數字、log 路徑，以及要提交的路徑：`docs/90-agent/todo/station-8.md`、`TODO.md`；訊息：

```text
docs: station-8 re-measured on sessions after the 09-30 run

- a 2026-10-01 measurement section, and its verdict — docs/90-agent/todo/station-8.md
```

## Task 5: 盤點列出全部條目，受控 survey 在 gate 前印出報告

**Files:**
- Modify: `skills/fankeel-survey/SKILL.md` — `## The patrol` 加「每條一行、數目對得上」；`## Output` 說清楚這份清單不算字數
- Modify: `lib/stages.js:670-685` — `controlRules` 的回傳路徑那句：survey 另外印報告本文
- Modify: `lib/render.js:515-525` — 對 stage agent 說「使用者只看到路徑」那句，survey 改成實話
- Read: `hooks/gate.js` — 被改的那句提到它，本 task 不改
- Test: `tests/stages.test.js`
- Test: `tests/skills.test.js`
- Test: `tests/brief.test.js`

**Interfaces:**
- Consumes: none
- Produces: `controlRules` — survey 的那條以 `When it returns a path, print it and the report's text above its gate block, as written, then read ` 開頭，其他 stage 仍是 `When it returns a path, print it, then read `。

**Dispatch:** implementer, sonnet

1. 在 `tests/stages.test.js`，`test('the controller waits out a return that is not a path, ...` 那個測試之前加入：

```js
// 2026-10-01: a patrol survey that relayed only its path showed the user
// nothing of the 25 entries it had checked. The controller prints a survey's
// report before the gate; every other stage still prints the path alone.
test('a controlled survey prints its report above the gate before asking; other stages print the path alone', () => {
  const { controlFor } = require('../lib/stages.js');
  const all = ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'];
  for (const stage of all) {
    const rules = controlFor(stage, { 'stage.agents': all }, { handoff: '/r/h.md' }).rules;
    const rule = rules.find((r) => r.startsWith('When it returns a path'));
    assert.ok(rule, stage + ': no return rule');
    if (stage === 'survey') assert.ok(rule.startsWith('When it returns a path, print it and the report\'s text above its gate block, as written, then read /r/h.md'), rule);
    else assert.ok(rule.startsWith('When it returns a path, print it, then read /r/h.md'), stage + ': ' + rule);
  }
});
```

2. 在 `tests/skills.test.js`，`test('survey and build each carry their own half of the patrol; ...` 那個測試之後加入：

```js
// 2026-10-01: a patrol that re-checked only Ready and part of Blocked, and
// relayed only its path, was sent back by the user — every entry, with a count.
test('the patrol lists every TODO.md entry with a count, and says the controller prints it', () => {
  const survey = read('fankeel-survey');
  const section = /\n## The patrol\n[\s\S]*?\n## /.exec(survey)[0];
  assert.match(section, /`## Ready`, `## Needs a decision`, `## Blocked` and `## Watch`, none skipped/);
  assert.match(section, /`entries: <n> listed, <m> in TODO\.md`/);
  assert.match(section, /`keep`/);
  assert.match(section, /prints the report above its gate block/);
  assert.match(survey, /a patrol's entry list is findings and does not count toward them/);
});
```

3. 在 `tests/brief.test.js`，把

```text
  // The controller prints the path and never the report, so a gate that says
  // "the answer is above" points at a line holding nothing but a path.
  assert.ok(text.includes('The user sees only the path to your report'), 'the gate must stand on its own');
```

   在 `tests/brief.test.js` 換成：

```js
  // The controller prints a survey's report above the gate, but the question
  // goes out on its own card, so a gate that says "the answer is above" still
  // points at nothing the card holds.
  assert.ok(text.includes('The controller prints your report above its gate block, but the question is asked on its own card'), 'the gate must stand on its own');
  assert.ok(!text.includes('The user sees only the path to your report'), 'a survey report is printed, so this would be false');
```

4. 跑三個檔，看新斷言紅：

```sh
node --test tests/stages.test.js tests/skills.test.js tests/brief.test.js; echo exit=$?
```

5. 在 `lib/stages.js` 的 `controlRules`，把以 `'When it returns a path, print it, then read {{HANDOFF}}` 開頭的那個陣列元素換成：

```js
    'When it returns a path, print it' + (stage === 'survey' ? ' and the report\'s text above its gate block, as written' : '') + ', then read {{HANDOFF}}\'s last `json gate` block and call AskUserQuestion with `questions` copied verbatim; `hooks/gate.js` validates the match. A return that is not a path or `commit <path>` is not its report: relay nothing and wait.',
```

6. 在 `lib/render.js` 第 521 行，把整行換成：

```js
    lines.push('  - You cannot call AskUserQuestion. The gate in that block is what the user is asked, word for word: this replaces the rule below that says to ask. ' + (stage === 'survey' ? 'The controller prints your report above its gate block, but the question is asked on its own card' : 'The user sees only the path to your report, not its text') + ', so the question and every description must read on their own — never "above".');
```

7. 在 `skills/fankeel-survey/SKILL.md` 的 `## The patrol`，`not only the timings.` 那段之後、`**Ready and Needs a decision.**` 之前，插入一段：

```md
**Every entry, one line each.** The report lists every bullet in `TODO.md` —
`## Ready`, `## Needs a decision`, `## Blocked` and `## Watch`, none skipped —
one line per entry under its heading: its label, what was checked (the
`path:line` opened, the registry or `git log` read, the upstream looked at),
and its disposition — `do now`, `needs the user`, `waiting on <what>`, or
`keep` for a Watch entry whose event has not come. Above the list goes a count
line, `entries: <n> listed, <m> in TODO.md`, where `<m>` is what
`grep -c '^- ' TODO.md` prints; the two are equal, or the missing entries are
named under it. A controlled survey's controller prints the report above its
gate block as written (`controlRules` in `lib/stages.js`), so this list is
what the user reads before the gate. 2026-10-01: a patrol that re-checked only
`## Ready` and part of `## Blocked`, and was relayed as a path alone, was sent
back by the user.
```

8. 在 `skills/fankeel-survey/SKILL.md` 的 `## Output` 那節，把 `Under 120 words of your own.` 換成：

```md
Under 120 words of your own; a patrol's entry list is findings and does not count toward them.
```

9. 跑三個檔與注入上限的測試，全綠：

```sh
node --test tests/stages.test.js tests/skills.test.js tests/brief.test.js tests/render.test.js; echo exit=$?
```

   `tests/render.test.js` 的 2400 上限若紅，只縮第 5 步新加的 `' and the report\'s text above its gate block, as written'`，同時改第 1 步的期望字串，不動上限。

10. 控制組：把第 5 步的 `stage === 'survey'` 暫時改成 `stage === 'nobody'`，再跑 `node --test tests/stages.test.js`，新測試要紅；改回來要綠。兩次 exit 寫進回報。

11. 不 commit。回報要提交的路徑：`skills/fankeel-survey/SKILL.md`、`lib/stages.js`、`lib/render.js`、`tests/stages.test.js`、`tests/skills.test.js`、`tests/brief.test.js`；訊息：

```text
feat: a patrol lists every TODO entry, and survey's report is printed

- the patrol lists every entry with a count line, Watch included — skills/fankeel-survey/SKILL.md
- a controlled survey's controller prints the report above its gate — lib/stages.js
- the survey brain is told the report is printed — lib/render.js
```

## Task 6: 關 commit-3 與 data

**Files:**
- Modify: `docs/90-agent/todo/commit-3-1.md` — `todo.js done`
- Modify: `docs/90-agent/todo/data-1.md` — `todo.js done`

**Interfaces:**
- Consumes: `commit-3` from Task 1; `data-1` from Task 2
- Produces: none

**Dispatch:** implementer, sonnet

1. 找出 Task 1、2 在 HEAD 上的 commit，確認訊息對得上：

```sh
C3=$(git log -1 --format=%H -- scripts/commit.js); git log -1 --format='%H %s' "$C3"
D1=$(git log -1 --format=%H -- docs/90-agent/reference/documents.md); git log -1 --format='%H %s' "$D1"
```

   第一行要是 `fix: commit.js says when a profile file does not parse`，第二行要是 `docs: record the data-location decision in documents.md`；任一不是就停手回報兩行。

2. 關兩個條目。data-1 用 `abandoned`：決定記在 documents.md，但沒有建：

```sh
node scripts/todo.js done commit-3-1 --sha "$C3" --disposition done
node scripts/todo.js done data-1 --sha "$D1" --disposition abandoned
node scripts/todo-check.js; echo todo-check=$?
```

   todo-check exit 0；`grep -c "commit-3\|〔data〕" TODO.md` 印 `0`。

3. 不 commit。回報要提交的路徑：`docs/90-agent/todo/commit-3-1.md`、`docs/90-agent/todo/data-1.md`、`TODO.md`；訊息：

```text
docs: close commit-3 and data-1

- commit-3 done by the profile notice in commit.js — docs/90-agent/todo/commit-3-1.md
- data-1 closed: the decision is recorded in documents.md, nothing built — docs/90-agent/todo/data-1.md
```

## Stage-agents 接縫：這次 build／verify 看得到哪些

`stage.agents` 這次是 all（`.fankeel/profile.json`，未提交），本 task 的 plan、build、verify、land 都由 stage agent 跑。九條 stage-agents 條目各自能不能在這次看到：

| 條目 | 這次看得到？ | 在哪看 |
|---|---|---|
| 實跑（`ctx.js --by-stage`、`modelUsage`） | 看得到 | land 之後對本 session 跑 `node scripts/ctx.js <session> --by-stage` |
| design 站跨輪對話（`controlFor`） | 看不到 | 路線沒有 design 站 |
| 站 agent 做不到的事 | 看得到 | build 開跑時：brain 有沒有先問同意、實作者是否都開 worktree、有沒有加 TODO 行、有沒有續用同一個 implementer |
| 第二個 agent（`inflight`） | 只有 gate 答 option one 以外、主控 SendMessage 同一個 agent 時 | 本 plan 的 gate 若答別的就會碰到 |
| profile 中途翻轉 | 看不到，除非使用者在受控站中途從站頁套 preset | 本計畫不安排 |
| 記帳 | 看得到 | build 後查：每次派工一則 notification、續用不重發 brief、transcript 標題不是佔位題 |
| claims | 只有同時有另一個 live session 時 | verify 對 Task 1、5 做 mutation 時 |
| 在哪提交 | 部分：project 就是 cwd，但實作者在 worktree | 每個 worktree block 經 `scripts/commit.js` cherry-pick 回主 checkout |
| verify mutation 要不要專屬 agent | 看得到 | verify 對 Task 1 第 7 步、Task 5 第 10 步那種 mutation 派的是誰、什麼模型 |

## Coverage

| promise | task |
|---|---|
| commit-3：scripts/commit.js:144 try 內 `profile.read`，`.unreadable` 不讀；你已選 warn → do now | Task 1、Task 6 |
| data：documents.md:25 `access` 保留、沒人讀；決定已下 → do now（關條目） | Task 2、Task 6 |
| build（knip）：本機 6.32.2、npm 最新 6.39.0，條目寫 6.38.0 仍失敗；knip.json:4 `exclude: ["exports"]` 仍關 → do now（試 6.39.0） | Task 3 |
| station（300k／15%）：8806240d 存在、之後 109 commit，`scripts/ctx.js --by-stage` 在 → do now（重量） | Task 4 |
| 使用者 plan 站指示：盤點的 survey 列出全部條目、數目對得上，主控在 gate 前給使用者看全表，改在 fankeel 本身 | Task 5 |
| stage-agents 八條：本機名單含 survey/build/verify，下次 build/verify 可順便看各接縫 | 上面「Stage-agents 接縫」一節（不是 task：是觀察，不改碼） |
