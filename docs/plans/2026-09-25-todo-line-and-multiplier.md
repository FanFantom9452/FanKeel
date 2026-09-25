---
status: design-intent
---

# todo-check 驗行號與主控倍數實測 Implementation Plan

**Goal:** todo-check 拒收行號超出檔尾的 `path:line`；再跑一對 opus 對 sonnet 主控的實測，把投影報告裡空著的 `k` 填上。
**Architecture:** todo-check 從 docs-check 借 `PATHISH` 和新匯出的 `lineCount`，在既有的連結迴圈旁邊加一個 `past end` 檢查。量測用一支 bash harness，以 `ab7.sh` 的 `arm()` 為底：兩個 worktree 都釘在同一個 sha，每一站用一次 `claude -p --resume` 推進，最後由一段 node 用 `lib/prices.js` 的 `costOf` 算出 `k`。
**Tech Stack:** Node（`node --test`、無外部依賴）、Git Bash、Claude Code CLI 2.1.282（`--max-budget-usd` 只在 `-p` 有效）。
**Spec:** [2026-09-25-todo-line-and-multiplier-design.md](2026-09-25-todo-line-and-multiplier-design.md)

## Global Constraints

- 本 repo 沒有 `CLAUDE.md`，慣例以 `CONTRIBUTING.md` 為準。
- `CONTRIBUTING.md:15`：`lib/` 不可以 require `scripts/` 或 `hooks/`，只能反過來。`scripts/` 之間可以互相 require，`docs-check.js` 已經有 `require.main === module` 的保護。
- `CONTRIBUTING.md:19`：測試用 `node --test`；每個匯出的名字都要有人 import；新檔要先 `git add`，`tests/source.test.js` 才看得到。
- `CONTRIBUTING.md:36`：不加新依賴，`hooks/` 底下不加新檔。
- `package.json:8`：`"test": "node --test"`。
- 縮排：`scripts/*.js` 用 4 個空格，`tests/*.test.js` 用 2 個空格。註解密度跟周圍一致：每段寫它為什麼存在。
- 用 Edit／Write 改檔，不用 heredoc 或 `sed`：heredoc 會吃掉反斜線，`sed` 沒比對到東西也不會報錯。
- report 頁只寫一次：`docs/reports/2026-09-21-long-task-projection.md` 不改，新頁連回它。
- `docs/README.md` 是手寫的索引，新增的 plan、design、report 都要在裡面有一列。
- 證據要有來源：每份 log 都寫 `HEAD` 和 `git status --porcelain`，而且寫解析過的完整 sha，不寫 `HEAD~1`。

## File structure

| file | responsibility |
|---|---|
| `scripts/docs-check.js` | 多匯出一個 `lineCount`，其他不動 |
| `scripts/todo-check.js` | 新增 `citationsIn()` 和 `past end` 這一類問題 |
| `tests/todo-check.test.js` | 三個 fixture |
| `docs/reports/evidence/2026-09-25-controller-multiplier/ab.sh` | 成對 harness，含 `DRY=1` 乾跑 |
| `docs/reports/evidence/2026-09-25-controller-multiplier/summarise.js` | 讀兩個 arm 的 json 算出 `k`，寫 `summary.json` |
| `docs/reports/2026-09-25-controller-multiplier.md` | 結果頁 |
| `TODO.md` | 刪兩條、把 7d 那條退回 Waiting、敘述裡的「nine」改成「ten」 |
| `docs/README.md` | 索引加三列 |

## Task 1: todo-check 驗 `path:line` 的行號

**Files:**
- Modify: `scripts/docs-check.js` — 在 `module.exports` 加上 `lineCount`
- Modify: `scripts/todo-check.js` — 新增 `LINE_SUFFIX`、`citationsIn()`，並在 `check()` 報 `past end`
- Modify: `TODO.md` — 刪 `〔docs〕todo-check 不驗` 那條；第 55 行「nine」改成「ten」並補一句；7d 那條退回 `## Waiting`
- Modify: `docs/README.md` — 為 design 與這份 plan 各加一列
- Read: `scripts/docs-check.js` — `PATHISH`（第 94 行）、`lineCount(root, rel)`（第 155-158 行，檔案讀不到時回 `null`）
- Test: `tests/todo-check.test.js`

**Interfaces:**
- Consumes: `PATHISH`，也就是 `/^(?:\.\/)?([\w.-]+\/[\w./-]+)(?::(\d+)(?:[-–](\d+))?)?$/`；以及 `lineCount(root: string, rel: string) => number|null`，兩個都來自 `scripts/docs-check.js`
- Produces: `check()` 的 `problems` 裡多一種 `kind: 'past end'`

**Dispatch:** implementer, sonnet — 程式碼都寫在 plan 裡，照抄再補測試。

步驟：

1. 在 `tests/todo-check.test.js` 第 63 行那個 `dead link` 測試後面加：

```js
// `tests/todo-check.test.js`
test('a backticked path:line past the end of its file is past end', () => {
  const file = fixture('# TODO\n\n## Ready\n\n- see `lib/a.js:9`.\n', { 'lib/a.js': 'one\ntwo\n' });
  const { out, code } = run(file);
  assert.equal(code, 1);
  assert.match(out, /past end/);
  assert.match(out, /lib\/a\.js:9 is past the end — lib\/a\.js has 2 lines/);
});

test('a link whose target carries a line past the end is past end, not a dead link', () => {
  const file = fixture('# TODO\n\n## Ready\n\n- see [a](lib/a.js:3-9).\n', { 'lib/a.js': 'one\ntwo\n' });
  assert.deepEqual(kinds(file), ['past end']);
});

test('a line inside the file passes, in either form', () => {
  const file = fixture('# TODO\n\n## Ready\n\n- see `lib/a.js:2` and [a](lib/a.js:1-2).\n', { 'lib/a.js': 'one\ntwo\n' });
  assert.deepEqual(kinds(file), []);
});
```

2. `node --test tests/todo-check.test.js`：前兩個應該紅（第二個現在報的是 `['dead link']`），第三個也應該紅（`dead link`）。
3. 在 `scripts/docs-check.js` 的最後一行，把 `lineCount` 加進 `module.exports`：

```js
// `scripts/docs-check.js`
module.exports = { scan, report, parseArgs, resolveRef, LINK, CODE, PATHISH, external, readFile, isMarkdown, lineCount };
```

4. 在 `scripts/todo-check.js` 裡，`const { blameTimes } = require('../lib/blame.js');` 下面加：

```js
// `scripts/todo-check.js`
// A line cited past the end of its file is a citation that moved. The pattern
// and the count are docs-check's, so the two scripts agree on what `path:12-30`
// means and on how a trailing newline counts.
const { PATHISH, lineCount } = require('./docs-check.js');
```

5. 在 `scripts/todo-check.js`，`function linksIn` 的正上方加：

```js
// `scripts/todo-check.js`
// `path:N` or `path:N-M` at the end of a link target. Split off before the
// existence check, which would otherwise look for a file named `a.js:12`.
const LINE_SUFFIX = /:(\d+)(?:[-–](\d+))?$/;

// Every line citation an entry makes, from a backticked span or a link target:
// `{ target, from, to }`. `#L12` is not read — docs-check does not read it either.
function citationsIn(text) {
    const out = [];
    for (const m of text.matchAll(/`([^`]+)`/g)) {
        const c = PATHISH.exec(m[1].trim());
        if (c && c[2]) out.push({ target: c[1], from: +c[2], to: c[3] ? +c[3] : +c[2] });
    }
    for (const raw of linksIn(text)) {
        const at = LINE_SUFFIX.exec(raw);
        if (at) out.push({ target: raw.slice(0, at.index), from: +at[1], to: at[2] ? +at[2] : +at[1] });
    }
    return out;
}
```

6. 在 `scripts/todo-check.js` 的 `check()` 裡，把 `for (const target of linksIn(entry.text)) {` 和它下一行換成：

```js
// `scripts/todo-check.js`
        for (const raw of linksIn(entry.text)) {
            const at = LINE_SUFFIX.exec(raw);
            const target = at ? raw.slice(0, at.index) : raw;
            const full = path.resolve(base, target);
```

   迴圈其他部分不動。在 `scripts/todo-check.js`，緊接在那個迴圈的 `}` 後面、仍在 `for (const entry of found)` 裡面，加：

```js
// `scripts/todo-check.js`
        // A file that is missing was already reported as a dead link above, or,
        // for a backticked span, is docs-check's to report; only the line is new.
        for (const c of citationsIn(entry.text)) {
            const n = lineCount(base, c.target);
            if (n === null || c.to <= n) continue;
            const cited = c.target + ':' + c.from + (c.to !== c.from ? '-' + c.to : '');
            problems.push({
                line: entry.line,
                kind: 'past end',
                detail: cited + ' is past the end — ' + c.target + ' has ' + n + ' lines. The code moved; cite where it is now.',
            });
        }
```

7. `node --test tests/todo-check.test.js`，三個都要綠。第一個測試的斷言寫的是 `lib/a.js:9 is past the end — lib/a.js has 2 lines`，要跟第 6 步 `detail` 的前半段逐字相同。
8. `TODO.md`：
   - 刪掉 `## Ready` 底下以 `〔docs〕todo-check 不驗` 開頭的那一條。
   - 第 55 行 `enforces all nine: a link that no longer resolves is` 改成 `enforces all ten: a link that no longer resolves is`；同一段的 `an entry someone forgot to close,` 後面插入 `a `path:line` whose line is past the end of the file is a citation the code moved out from under,`。
   - 刪掉 `## Ready` 底下以 `〔quota〕7d 水位` 開頭的那一條，改放到 `TODO.md` 的 `## Waiting` 最後，變成一個新的 timing：

```md
<!-- `TODO.md` -->
### TokenBar 寫出真實序列
lifts when: `tokenbar-usage.jsonl` 有跨過一次 7d reset 的真實讀數；09-25 查到的 347 行全落在 09-22 的 15 分鐘內，是測試資料，09-23 起沒再寫. 09-25.

- 〔quota〕7d 水位兩點差 4.7 倍，是延遲還是計別的：TokenBar 每次 render 已把 5h／7d 讀數 append 到 `<CLAUDE_CONFIG_DIR>/tokenbar-usage.jsonl`（TokenBar 的 `statusline.ps1`／`.sh`），拿第三點以後的序列來分 — [scripts/spend.js](scripts/spend.js).
```

   上面的註解行只是標出檔名，不要寫進 `TODO.md`。
9. 在 `docs/README.md` 裡 2026-09-19 stage-agents design 那一列附近（用 grep 找 plans/2026-09-19），照同一格式加兩列：

```md
<!-- `docs/README.md` -->
| todo-check 為什麼借 docs-check 的 `lineCount` 驗行號，以及主控倍數那一對實測怎麼跑、預算多少 | [plans/2026-09-25-todo-line-and-multiplier-design.md](plans/2026-09-25-todo-line-and-multiplier-design.md) — *design-intent, 繁體中文* |
| 把上面那份設計拆成三個 task 的計畫 | [plans/2026-09-25-todo-line-and-multiplier.md](plans/2026-09-25-todo-line-and-multiplier.md) — *design-intent, 繁體中文* |
```

   註解行同樣不寫進去。
10. `node scripts/todo-check.js` 要 exit 0；`node --test tests/todo-check.test.js tests/source.test.js` 要全綠。
11. Commit。

## Task 2: 成對 harness

**Files:**
- Modify: `docs/reports/evidence/2026-09-25-controller-multiplier/ab.sh` — 新檔：兩個 arm、`DRY=1` 乾跑
- Modify: `docs/reports/evidence/2026-09-25-controller-multiplier/summarise.js` — 新檔：從兩個 arm 的 json 算出 `k`
- Read: `docs/reports/evidence/2026-09-20-survey-brain-ab/ab7.sh` — `arm()` 與 provenance 的寫法
- Read: `lib/prices.js` — `costOf(models)`，`models` 是 `{ [id]: { input, output, cacheRead, cacheWrite5m, cacheWrite1h } }`，回傳 `{ usd, priced, unpriced }`
- Test: `docs/reports/evidence/2026-09-25-controller-multiplier/ab.sh` — 它的 `DRY=1` 模式就是測試

**Interfaces:**
- Consumes: `costOf` 與 `rateFor`，來自 `lib/prices.js`
- Produces: 每個 arm 每一站一個 `<arm>-<stage>.json`；一份 `summary.json`，形狀是 `{ base, arms: { opus: { usd, tokens, stages }, sonnet: {...} }, oldAtSonnetRates, k, kTokens }`；一份 `provenance.txt`

**Dispatch:** implementer, sonnet — 兩個檔的內容都在 plan 裡，實作者要做的是乾跑驗證。

步驟：

1. 建立 `docs/reports/evidence/2026-09-25-controller-multiplier/ab.sh`：

```bash
#!/usr/bin/env bash
# `docs/reports/evidence/2026-09-25-controller-multiplier/ab.sh`
# Sonnet against Opus as the controller on the stages no stage agent runs — the
# `k` cell docs/reports/2026-09-21-long-task-projection.md §4 left empty.
#
#   opus:   --model opus
#   sonnet: --model sonnet
#
# Held: the task (TODO's todo-check line-number entry), the start sha, the route
# design,plan,build,verify, stage.agents false in both worktrees, the survey
# report as input, and every flag. Each arm is capped at CAP dollars through
# --max-budget-usd on every call, the cap shrinking by what the arm has spent.
# DRY=1 prints the commands and runs no claude.
set -u

REPO="F:/ymlab/fankeel"
BASE="9e54e1b70a1dd0ad943b2534d8113bacbee0b7f4"
EVID="$REPO/docs/reports/evidence/2026-09-25-controller-multiplier"
WORK="$REPO/.fankeel/build/2026-09-25-controller-multiplier"
SURVEY="$REPO/.fankeel/build/task-20260925T000100/survey.md"
PARENT="${PARENT:?set PARENT to the session id running this}"
CAP="${CAP:-62.50}"
DRY="${DRY:-}"
TASK="todo-check 不驗 path:line 的行號：改成不存在的行仍然 exit 0（scripts/todo-check.js）。survey 已做完，報告在 .fankeel/build/survey.md。"
ROUTE="design,plan,build,verify"
STAGES=(design plan build verify)

mkdir -p "$EVID" "$WORK"
cd "$REPO" || exit 1
LOG="$EVID/provenance.txt"
logcmd () { printf '$'; printf ' %q' "$@"; printf '\n'; }
spent () { node -e 'let s=0;for(const f of process.argv.slice(1)){try{s+=JSON.parse(require("fs").readFileSync(f,"utf8")).total_cost_usd||0}catch{}}console.log(s.toFixed(4))' "$@"; }

{
  echo "date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "HEAD: $(git rev-parse HEAD)"
  echo "BASE: $BASE"
  echo "porcelain:"; git status --porcelain
  echo "claude: $(claude --version)"
  echo "ab.sh md5: $(md5sum "$EVID/ab.sh" | cut -d' ' -f1)"
  echo "CAP per arm: $CAP  DRY: ${DRY:-no}"
} > "$LOG"

arm () {
  local name="$1" model="$2"
  local wt="$WORK/wt-$name"
  local U; U=$(node -e "console.log(require('crypto').randomUUID())")
  echo "--- $name model=$model worktree=$wt session $U" >> "$LOG"

  if [ -z "$DRY" ]; then
    git worktree add --detach "$wt" "$BASE" >> "$LOG" 2>&1 || { echo "worktree failed" >> "$LOG"; return 1; }
    mkdir -p "$wt/.fankeel/build" && cp "$SURVEY" "$wt/.fankeel/build/survey.md"
    (cd "$wt" && node scripts/task.js profile set stage.agents false --project >> "$LOG" 2>&1)
    (cd "$wt" && node scripts/task.js profile show | grep '^  stage.agents' >> "$LOG")
    (cd "$wt" && node scripts/task.js profile show | grep -q '^  stage.agents  *false ') \
      || { echo "stage.agents is not false in $wt — abort" >> "$LOG"; return 1; }
  fi

  local common=(--setting-sources project --plugin-dir "$wt" --permission-mode bypassPermissions --model "$model" --output-format json)
  local c1=(claude -p "Run this command and report its output, nothing else: node scripts/task.js start --session $U --task \"$TASK\" --route $ROUTE" --session-id "$U" "${common[@]}")
  logcmd "${c1[@]}" >> "$LOG"
  [ -z "$DRY" ] && (cd "$wt" && "${c1[@]}" > "$EVID/$name-start.json" 2> "$EVID/$name-start.err")

  local i next left
  for i in "${!STAGES[@]}"; do
    next="${STAGES[$((i+1))]:-}"
    local prompt="Do the ${STAGES[$i]} stage of this task. There is no user in this run: at the stage's gate do not call AskUserQuestion — take option one yourself"
    if [ -n "$next" ]; then prompt="$prompt, run node scripts/task.js stage $next --session $U, and stop."; else prompt="$prompt and stop."; fi
    left=$(node -e "console.log(Math.max(0, $CAP - $(spent "$EVID/$name"-*.json)).toFixed(2))")
    if [ -z "$DRY" ] && [ "$(node -e "console.log($left < 1 ? 1 : 0)")" = 1 ]; then
      echo "$name over budget before ${STAGES[$i]} (left $left)" >> "$LOG"; break
    fi
    local c2=(claude -p "$prompt" --resume "$U" --max-budget-usd "$left" "${common[@]}")
    logcmd "${c2[@]}" >> "$LOG"
    if [ -z "$DRY" ]; then
      (cd "$wt" && "${c2[@]}" > "$EVID/$name-${STAGES[$i]}.json" 2> "$EVID/$name-${STAGES[$i]}.err")
      echo "${STAGES[$i]} exit=$? spent so far $(spent "$EVID/$name"-*.json)" >> "$LOG"
    fi
  done

  if [ -z "$DRY" ]; then
    (cd "$wt" && git diff "$BASE" --stat && git status --porcelain) > "$EVID/$name-diff.txt" 2>&1
    (cd "$wt" && git diff "$BASE") > "$EVID/$name.patch" 2>&1
    node scripts/task.js clear "$U" --force --session "$PARENT" >> "$LOG" 2>&1
    git worktree remove --force "$wt" >> "$LOG" 2>&1
  fi
}

arm opus   opus
arm sonnet sonnet

[ -z "$DRY" ] && node "$EVID/summarise.js" "$EVID" > "$EVID/summary.json" 2>> "$LOG"
echo "porcelain after: $(git status --porcelain | wc -l) lines" >> "$LOG"
echo "done" >> "$LOG"
```

2. 建立 `docs/reports/evidence/2026-09-25-controller-multiplier/summarise.js`：

```js
// `docs/reports/evidence/2026-09-25-controller-multiplier/summarise.js`
'use strict';

// k, the way docs/reports/2026-09-21-long-task-projection.md §4 uses it: the
// non-survey stages cost `old × r × k`. `old × r` is the Opus arm's own token
// mix priced at Sonnet's rates, so k is what Sonnet actually spent over that.
// A model that is not Opus in the Opus arm (a subagent on another model) keeps
// the price the CLI charged for it.
const fs = require('node:fs');
const path = require('node:path');
const { costOf } = require('../../../../lib/prices.js');

const dir = process.argv[2];
const SONNET = 'claude-sonnet-5';

function mix(u) {
    return {
        input: u.inputTokens || 0,
        output: u.outputTokens || 0,
        cacheRead: u.cacheReadInputTokens || 0,
        cacheWrite5m: u.cacheCreationInputTokens || 0,
        cacheWrite1h: 0,
    };
}

function arm(name) {
    const out = { usd: 0, tokens: 0, stages: {}, models: {} };
    for (const f of fs.readdirSync(dir).filter((f) => f.startsWith(name + '-') && f.endsWith('.json')).sort()) {
        const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        out.usd += j.total_cost_usd || 0;
        out.stages[f.slice(name.length + 1, -5)] = j.total_cost_usd || 0;
        for (const [id, u] of Object.entries(j.modelUsage || {})) {
            const m = out.models[id] || (out.models[id] = { usd: 0, input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 });
            const t = mix(u);
            for (const k of Object.keys(t)) m[k] += t[k];
            m.usd += u.costUSD || 0;
            out.tokens += t.input + t.output + t.cacheRead + t.cacheWrite5m;
        }
    }
    return out;
}

const opus = arm('opus');
const sonnet = arm('sonnet');
let oldAtSonnetRates = 0;
for (const [id, m] of Object.entries(opus.models)) {
    oldAtSonnetRates += /opus/.test(id) ? costOf({ [SONNET]: m }).usd : m.usd;
}
const summary = {
    base: '9e54e1b70a1dd0ad943b2534d8113bacbee0b7f4',
    arms: { opus, sonnet },
    oldAtSonnetRates,
    k: oldAtSonnetRates ? sonnet.usd / oldAtSonnetRates : null,
    kTokens: opus.tokens ? sonnet.tokens / opus.tokens : null,
};
process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
```

3. `bash -n docs/reports/evidence/2026-09-25-controller-multiplier/ab.sh` 要 exit 0。
4. `PARENT=x DRY=1 bash docs/reports/evidence/2026-09-25-controller-multiplier/ab.sh` 要 exit 0。之後 `provenance.txt` 要有 `--- opus` 與 `--- sonnet` 兩段，每段 5 行 `$ claude -p`（1 行 start、4 行 stage），而且每一行 stage 都帶 `--max-budget-usd 62.50`。檢查指令：`grep -c 'max-budget-usd 62.50' .../provenance.txt` 要印 `8`。
5. 用一份假資料測 `summarise.js`：在 scratch 目錄放 `opus-design.json` = `{"total_cost_usd":10,"modelUsage":{"claude-opus-5-5":{"inputTokens":1000000,"outputTokens":0,"costUSD":10}}}`，`sonnet-design.json` = `{"total_cost_usd":4,"modelUsage":{"claude-sonnet-5":{"inputTokens":2000000,"outputTokens":0,"costUSD":4}}}`。`node summarise.js <dir>` 應印出 `oldAtSonnetRates` 2、`k` 2、`kTokens` 2。舊的 `provenance.txt` 是乾跑產物，刪掉，不要 commit。
6. `git add` 兩個檔，Commit。

## Task 3: 跑那一對，寫結果頁

**Files:**
- Modify: `docs/reports/2026-09-25-controller-multiplier.md` — 新檔：結果頁
- Modify: `docs/reports/evidence/2026-09-25-controller-multiplier/summary.json` — `ab.sh` 跑完產生，一併提交
- Modify: `docs/reports/evidence/2026-09-25-controller-multiplier/provenance.txt` — 同上；另外還有各 arm 的 `*-<stage>.json`、`*.err`、`*.patch`、`*-diff.txt`，都由 `ab.sh` 寫出
- Modify: `TODO.md` — 刪 `〔stage-agents〕量 Sonnet 主控` 那一條
- Modify: `docs/README.md` — 為結果頁加一列
- Read: `docs/reports/evidence/2026-09-25-controller-multiplier/ab.sh` — 要跑的就是它
- Read: `docs/reports/2026-09-21-long-task-projection.md` — frontmatter 的形狀，§4 的 `k` 與破平衡點 2.5052
- Test: `docs/reports/2026-09-25-controller-multiplier.md` — 頁面上的 `k` 要等於 `summary.json` 重算出來的值

**Interfaces:**
- Consumes: Task 2 產出的 `summary.json`，形狀是 `{ base, arms, oldAtSonnetRates, k, kTokens }`
- Produces: none

**Dispatch:** user — 這一條要花 $125，是使用者在本 session 核准的；跑的時間也比任何 subagent 的 Bash 撐得久。由主控在使用者面前用背景 Bash 啟動，跑完再寫頁面。

步驟：

1. 從主控 session 以背景執行：`PARENT=<本 session id> bash docs/reports/evidence/2026-09-25-controller-multiplier/ab.sh`。
2. 跑完後讀 `provenance.txt`：兩個 arm 是否都走完四站、有沒有 `over budget`、最後的 `porcelain after` 是不是 0 行。
3. 寫 `docs/reports/2026-09-25-controller-multiplier.md`。frontmatter 照投影頁的形狀：`status: current`、`last_verified: 2026-09-25`，`source_of_truth` 指向 `summary.json` 與 `ab.sh`，並註明 md5。第一段寫明只量了一個小 task，`k` 只代表這個 task。內容要有：起點 sha `9e54e1b70a1dd0ad943b2534d8113bacbee0b7f4`、`ab.sh` 的 md5、兩個 arm 各自的 `modelUsage`（逐模型的 token 數與 `costUSD`，從 `summary.json` 的 `arms.<arm>.models` 抄）、兩個 arm 各站的花費、`k`、`kTokens`、`k` 跟 2.5052 比是在上還是在下，以及連回投影頁 §4 的連結。
4. 驗證：`node -e 'const s=require("./docs/reports/evidence/2026-09-25-controller-multiplier/summary.json");console.log((s.arms.sonnet.usd/s.oldAtSonnetRates).toFixed(3))'` 印出的值，要等於頁面上寫的 `k`（取小數三位）。
5. `TODO.md`：刪掉以 `〔stage-agents〕量 Sonnet 主控` 開頭的那一條。`docs/README.md`：在投影頁那一列後面加一列，指向新頁。
6. `node scripts/todo-check.js` 要 exit 0，`node scripts/docs-check.js` 不能有新的錯。Commit，evidence 目錄底下所有產物一起提交。

## Coverage

| promise | task |
|---|---|
| `scripts/docs-check.js` 匯出 `lineCount`（`PATHISH` 已經匯出），todo-check 直接用 | Task 1 |
| `scripts/todo-check.js` 讀每條 bullet 裡的兩種位置：反引號包住、符合 `PATHISH` 的 span | Task 1 |
| 連結 target 帶 `:N` 時，先把 `:N` 拆掉再檢查檔案存不存在 | Task 1 |
| 不支援 `#L12`。docs-check 也不認這個寫法，TODO.md 現在也沒有人用；要支援是另一件事。 | Task 1（`citationsIn` 的註解寫明） |
| `past end` 不看 role，所以放在整個連結迴圈之後，自成一個迴圈；同一條 bullet 的 `dead link` 與 `stale citation` 會先印。 | Task 1 步驟 6 |
| TODO.md 開頭「enforces all nine」的敘述跟著改成十條，並補上這一條在檢查什麼。 | Task 1 |
| 要填的格子：`docs/reports/2026-09-21-long-task-projection.md` 的 `k` | Task 3 |
| harness 寫在 `docs/reports/evidence/2026-09-25-controller-multiplier/ab.sh` | Task 2 |
| 兩個 arm 唯一的差別是主控的 `--model`：opus 對 sonnet。固定不動的有：同一個 task（就是 §1 本身）、同一個起點 sha | Task 2 |
| headless 沒有辦法回答 gate，所以每一站用一次 `claude -p --resume` 推進 | Task 2 |
| 成本讀 `--output-format json` 的 `modelUsage` 與 `total_cost_usd` | Task 2 |
| 兩個 arm 合計超過 $125 就停，報告照實寫「超支中止」 | Task 2（每個 arm 上限 $62.50）與 Task 3 步驟 2 |
| 結果寫成新的 report 頁 `docs/reports/2026-09-25-controller-multiplier.md` | Task 3 |
| 只量了一個 task，`k` 只代表這一個 task。報告要把這一點寫在第一段。 | Task 3 |
| `〔docs〕todo-check 不驗行號` 與 `〔stage-agents〕量 Sonnet 主控倍數` 由交付它們的 task 刪掉 | Task 1、Task 3 |
| `〔quota〕7d 水位` 退回 `## Waiting`，新的 timing 是「TokenBar 寫出真實序列」 | Task 1 |
| `〔security〕` 不動，留在 `## Ready` | struck — 不動就是交付，不需要 task |
| `tests/todo-check.test.js` 新增：bullet 帶 `` `scripts/todo-check.js:99999` `` 時 exit 1 | Task 1（fixture 用 `lib/a.js:9`，形式相同） |
| artefact 這一格：報告頁裡的 `k`，要等於同頁兩個 arm 的 token 數相除 | Task 3 步驟 4（`k` 是花費比；token 比另列為 `kTokens`，design 的說法在這裡修正） |
