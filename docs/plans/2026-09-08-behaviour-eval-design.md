---
status: design-intent
last_verified: 2026-09-08
source_of_truth: lib/stages.js, hooks/inject.js, scripts/task.js, docs/improvement-brief.md
---

# 行為 eval：一個 case、兩種跑法

**Ask**：fankeel 有 51 個 `node --test` 檔測 script 與 hook，沒有任何測試問「模型在
fankeel mode 下會不會照規則做」。簡報 §2.5 說行為層是「無」。這份設計補第一個
case，並讓它今天就跑得動。

**One approach**：`evals/` 照 `claude plugin eval` 的官方格式寫（case.yaml +
prompt.md + graders/*.md），另加 `scripts/eval.js` 用 `claude -p` 跑同一組檔案。
兩個 runner 讀同一份 case，所以 early access 開了之後不用改 case，只是多一個
runner 能跑它。

**Cut**：不寫 CI workflow——`claude plugin eval` 在這台機器回 early access exit 1，
一條永遠紅的 workflow 是噪音；進 `TODO.md ## Waiting`，lifts when: 本機
`claude plugin eval` 不再回 early access。不做 `llm` grader 的 fallback：judge
兩票制是官方 runner 的事，fallback 把它報成 `skipped`。不做第二個 case：一個
能跑的 case 是契約，第二個是複製。

## 1. The case — `evals/route-typo/`

- `case.yaml`：`schema_version: "1.1"`、`name: route-typo`、
  `context.scaffold_script` 建一個一檔的 git repo：`README.md` 第一行含 `teh`，
  `git init`、一個 commit。fallback runner 用同一段 script 建 temp dir。
- `prompt.md` frontmatter：`name`、`tags: [route, init]`、`runs: 1`、
  `max_turns: 12`、`timeout_seconds: 300`、
  `allowed_tools: [Read, Edit, Bash, Glob, Grep, Skill]`——**沒有
  AskUserQuestion**，headless 沒有人能答；INIT 規則第三條要問的兩題（project、
  task）prompt 都已答：單一專案、任務在句子裡。
- `prompt.md` body：`/fankeel 修 README.md 第一行的 typo：teh → the`。
  `hooks/inject.js:38` 的 `^[/@$]fankeel(:fankeel)?(\s|$)` 會把它當 init prompt。
- `graders/starts-with-short-route.md`：`type: tool_used`、`tool: Bash`、
  `input_match: task\.js start\b.*--route\s+"?build,verify"?`、`min: 1`。這是
  簡報 :513 的斷言：typo 走 `build,verify`，不走七階段。
- `graders/no-other-route.md`：`type: tool_used`、`tool: Bash`、
  `input_match: task\.js start\b(?!.*--route\s+"?build,verify"?)`、`max: 0`。
  第一個 grader 抓「有沒有」，這個抓「有沒有先用錯的再改」。
- `graders/says-it-out-loud.md`：`type: regex`、`target: last_message`、
  `pattern: build[,\s→]+verify`、`flags: i`、`match: contains`——survey skill
  說 class 要說出口讓人能反對。

## 2. The fallback runner — `scripts/eval.js` and `lib/eval.js`

- `lib/eval.js` 是純函式，照 `lib/docs.js` / `scripts/docs-check.js` 的分法：
  `parseCase(dir)` 讀三種檔的 frontmatter 與 body；`toolCalls(streamJsonLines)`
  從 `--output-format stream-json` 抓每個 `tool_use` 的 `name` 與 `input`；
  `lastMessage(lines)` 抓最後一段 assistant 文字；`grade(grader, run)` 回
  `{ name, type, pass, detail }`，支援 `tool_used`（`tool`、`input_match`、
  `min`、`max`）與 `regex`（`target: last_message`、`pattern`、`flags`、
  `match: contains|not_contains`），`llm` 回 `{ pass: null, detail: 'skipped:
  llm grader needs claude plugin eval' }`。
- `scripts/eval.js <case dir> [--model <m>] [--runs <n>] [--plugin-dir <dir>]
  [--json <path>]`：每個 run 建 temp dir、跑 scaffold_script、以
  `claude -p <body> --output-format stream-json --verbose --plugin-dir <repo root>
  --allowedTools <list> --max-turns <n> --model <m> < /dev/null` 跑，
  `timeout_seconds` 到就 kill。`--plugin-dir` 預設 repo root，所以測的是 tree，
  不是 cache——安裝的 cache 是上一次 update 的版本，會落後 tree。
- 輸出一行一個 grader：`<case> run <i> <grader> pass|fail|skipped — <detail>`，
  最後一行 `score <passed>/<graded>`；任何 `fail` 就 exit 1，只有 skipped 不算。
  `--json` 寫 `{ case, runs: [{ graders: [...], toolCalls: n, lastMessage }] }`，
  鍵名沿用官方 `aggregate-result.json` 的 camelCase，形狀不保證相同。
- temp dir 用 `tests/tmp.js` 的 helper（ready-fourteen 留下的），跑完刪。

## 3. Tests — `tests/eval.test.js`

- `parseCase` 對 `evals/route-typo/` 真檔：三個 grader 的 type 與鍵讀得出來，
  prompt body 以 `/fankeel` 開頭，`allowed_tools` 不含 `AskUserQuestion`。
- `grade` 對 fixture transcript（手寫的 stream-json 幾行）：
  紅綠各一——含 `--route "build,verify"` 的 Bash call 讓 grader 1 pass、
  grader 2 pass；改成 `--class bounded` 讓 grader 1 fail、grader 2 fail；
  `last_message` 有無 `build,verify` 讓 grader 3 翻面。
- `scripts/eval.js --help` 印用法 exit 0；沒有 case dir 時 exit 1 並說原因。
  不在測試裡跑 `claude -p`：那是錢，屬 verify 手動跑一次並存證。

## 4. Documents

- `README.md ## Development` 加一小節：兩種跑法各一行命令，early access 的
  自檢法（空目錄下跑 `claude plugin eval`，看回哪句）。
- `docs/README.md` 索引加一列指到那一節。
- `docs/improvement-brief.md:306` 那格「行為層：無」不改正文——它是 dated
  簡報；audit 階段決定要不要加註記。
- `TODO.md`：關掉 Needs a decision 的 eval 條目；`## Waiting` 加 CI workflow
  一條，lifts when 如上，stamp 09-08。

## Proves it done

- `npm test` 綠，含 `tests/eval.test.js` 的紅綠對（grader 1 對 `--class bounded`
  fixture 必須 fail）。
- `node scripts/eval.js evals/route-typo --model claude-sonnet-5` 在 verify 跑
  一次，三個 grader 至少前兩個 pass，stream-json 與 provenance（HEAD、
  porcelain、claude 版本）存到 `docs/reports/evidence/2026-09-08-route-typo/`。
  跑不過就是發現：要嘛規則沒讓模型走短 route，要嘛 `/fankeel` 在 `-p` 下
  沒進 hook——兩者都回 build。

## Against the map

- `docs/pipeline.md` 講三個 class 與 route，設計沒有改它。
- `docs/subagents.md` 與 `docs/reports/2026-09-03-*` 已用 `claude -p` 量測，
  fallback runner 是同一件工具的第二個用途，不衝突。
- 本頁是 `design-intent`：`evals/`、`scripts/eval.js`、`lib/eval.js` 今天都不存在。

## Unverified

`claude -p` 加 `--plugin-dir` 時，`/fankeel …` 這個 prompt 會不會經過
`UserPromptSubmit` hook 並展開 skill——文件沒寫。plan 的 Task 1 是一次 haiku
探測，先於一切。
