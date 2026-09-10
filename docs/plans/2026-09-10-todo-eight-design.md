---
status: design-intent
last_verified: 2026-09-10
source_of_truth: TODO.md
---

# 處理 TODO 的八條：一條照做，七條逐條問判官

`TODO.md` 現有 1 條 `## Ready` 與 7 條 `## Needs a decision`。使用者的指示是
「處理 TODO，如果有要 FABLE 處理的請用 fankeel-ask」。

設計階段先提了一個分路：只有四條真的需要判官，併成兩題，另外三條分別缺的是
一次跑動、一個量測、一雙手。**閘門推翻了它**——使用者選的是「七條全部送判官」。
這份 spec 記的是實際採用的那一個。

survey 的證據在 `.fankeel/build/todo-eight/` 四份檔案裡，HEAD `aca11d5`，工作樹乾淨。

## 兩條規則對撞，以及哪一條贏

`skills/fankeel-ask/SKILL.md` 說一個 stage 一題：「Asking the judge a second
question in the same stage is not more diligence — it is the thing the one-shot
shape exists to stop.」而這裡要在 design 這一個 stage 裡問七題。

使用者指示優先於 skill。而且那條規則擋的是**同一題被反覆追問**，這裡是七個不同
的問題各問一次——一次性形狀在每一題內部完整保留：一份 brief、一次派工、逐字
歸檔、不追問。七題各自獨立成一筆 `docs/judgements/` 紀錄。

## 分路

| 條目 | 問題 | brief |
|---|---|---|
| Ready | `RETURN_RULES` 少一條工作樹規則 | 不問，照做 |
| 決議 1 | `renderResume` 的長度斷言與 cap | `1-resume-assertion-brief.md` |
| 決議 2 | 四個例外 eval case 首跑全掉的歸因 | `2-exception-cases-brief.md` |
| 決議 3 | 整個外掛的總 prompt 預算欄位 | `3-total-budget-brief.md` |
| 決議 4 | 條件載入到「節」的粒度 | `4-section-loading-brief.md` |
| 決議 5 | 16 行 pattern skill 的極簡形式 | `5-pattern-skill-brief.md` |
| 決議 6 | subagent 的 Bash 與 PowerShell 白名單 | `6-shell-whitelist-brief.md` |
| 決議 7 | verify 的 `subagent_type` 與 Workflow 寫檔 | `7-verifier-agent-brief.md` |

七份 brief 都在 `.fankeel/build/ask/`，共 19,785 字元。派工 4 + 3 兩回合，
`subagent_type: fankeel-judge`，model `fable`（`judge.model` 的值）；分兩回合是
因為單輪上限四個，不是因為要等前一批。

## 1. Ready：brief 的第四條規則

- `lib/render.js:353-357` 的 `RETURN_RULES` 加第四條，說 subagent 不得改動被派
  的工作以外的工作樹。三條現有規則講的是回傳值成本、說出沒查到的、不得自己派
  subagent，沒有一條講工作樹。
- `tests/brief.test.js` 加一條斷言：算好的 brief 文字含這條新規則。
- `tests/brief.test.js:126` 的 `assert.ok(text.length < 1400)` 必須仍然綠。今日
  實測 823（shipped fixture）與 830（35 字元 task 行、一個 claim），加約 150 字元
  後仍在 1000 以內。
- `TODO.md:63` 的 `777` 是錯的——`lib/render.js` 與 `tests/brief.test.js` 都 grep
  不到這個數字，兩次獨立實測是 823 與 830。這條在關掉時順手更正，不留一個沒人
  對得上的數字在 git 歷史裡。
- 這是提醒層不是防線，`TODO.md:63` 自己就這麼寫。§3 的判斷才決定防線在哪。

## 2. 七題判斷

每一題的 brief 都帶三樣東西：問題本身、判官可以自己去讀的 `path:line` 清單、
以及「算什麼是答案」與回傳形狀。brief 一律寫明「不要只信這份 brief，去讀它列的
檔」——因為一份 brief 就是一次轉述，而轉述會錯。

三題彼此牽動，brief 裡各自寫了出來：

- 決議 3（總預算）與決議 4（切節）：一個到節的載入器會改變「每 stage 一欄位元組
  預算」在量什麼。
- 決議 4（切節）與決議 5（16 行 skill）：若 SKILL.md 縮到 16 行，就沒什麼可切；
  若切節做了，SKILL.md 就不必為最重的情況寫。
- 決議 6（hook matcher）與決議 7（`subagent_type`）：matcher 是防線，
  `subagent_type` 決定那個 subagent 手上有沒有 Edit 與 Write，是同一件事的兩層；
  Ready 那條 brief 規則是第三層。

兩題的 brief 帶了這個 session 自己查出來、而 `TODO.md` 沒寫的事實：

- 決議 2：那次跑的產物在整個 repository 裡不存在（`docs/reports/`、
  `docs/reports/evidence/`、`evals/` 三處 grep 四個 case 名字，只回到各自的
  front matter）。brief 因此把「這題在沒有那次跑的情況下答不答得了」明白交給
  判官裁，並且告訴它**不要**自己去跑——四次 `claude -p` 是還沒被授權的花費。
  brief 同時附上本機跑得動的指令與參數，讓它可以要求那次跑。
- 決議 7：`skills/fankeel-plan/SKILL.md` 有和 verify 一模一樣的 `subagent_type`
  缺口，而 `TODO.md` 只點名 verify。brief 請判官的答案若適用於 plan 就一併說。

答案由 `node scripts/judge.js record --session <id> --brief <path> --answer -
--slug <slug> --model fable` 逐字歸檔，答案走 stdin 而不是重打——重打是判斷
悄悄變成轉述的地方。

## 3. 七份判斷的結果，與它們決定的 build 範圍

七題全部回來，逐字歸檔在 `docs/judgements/2026-09-10-*.md`，索引列在
`docs/README.md` 的 `## Judgements`。四題判「不要蓋」，兩題判「要蓋」，一題判
「問題本身問錯了」。

| 判斷 | 記錄 | 結論 |
|---|---|---|
| 1 `renderResume` 斷言 | `2026-09-10-resume-assertion.md` | 加，cap `< 2600` 字元 |
| 2 四個例外 case | `2026-09-10-exception-cases.md` | 四顆正向 grader 三顆是 grader 自己壞的 |
| 3 總預算欄位 | `2026-09-10-total-budget.md` | 不加，缺的是一處文件引用 |
| 4 條件載入到節 | `2026-09-10-section-loading.md` | 不做，改用一條測試守 no-plan 讀者 |
| 5 16 行 pattern skill | `2026-09-10-pattern-skill.md` | 不採用，改為把 rationale 拆分做完 |
| 6 shell 白名單 | `2026-09-10-shell-whitelist.md` | 不擋，沉默升格為明說的設計 |
| 7 verifier | `2026-09-10-verifier-agent.md` | 寫檔留、理由句改寫、新增 `fankeel-verifier` |

### 三處判官更正了這份設計自己的說法

- **第 2 題最重**：那次跑的產物一直都在，`.fankeel/build/2026-09-10-todo-ten/eval-*.json`
  五份，昨晚 20:10–20:43。survey 沒找到是因為 `.fankeel/.gitignore` 有 `build/`，
  而掃描只走 git 追蹤的檔。這份設計先前寫的「產物在 repo 裡完全不存在」是錯的。
  更重的是結論：`evals/one-call-not-agent/graders/no-agent-dispatch.md:3`、
  `evals/pipe-not-agent/graders/no-agent-dispatch.md:3`、
  `evals/subagent-no-entry/graders/dispatches-a-reader.md:3` 都比對 `tool: Task`，
  而這個 harness 的派工工具叫 `Agent`——`min: 1` 那顆永遠不過、兩顆 `max: 0`
  永遠不紅。`pipe-or-grep` 也錯：模型確實跑了 `node --test`，只是沒接管線。
- **第 1 題**：兩個 2400 不同源。`render()` 的 2400 是 `tests/render.test.js:505-507`
  以 `audit` 2397 **字元**綁的；`skills/registry.json:8-9` 的 2377/2400 是 survey 的
  **位元組**預算。這份設計先前把它們寫成同一個。
- **第 7 題**：`skills/fankeel-plan/SKILL.md:290` 有釘 `subagent_type: fankeel-reviewer`，
  grep 是一命中不是零。plan 沒有跟 verify 一樣的缺口，`TODO.md` 只點名 verify 是對的。
- 另外第 3 題指出 `tests/render.test.js:498` 有整塊注入 `< 3000` 的斷言，第 4 與
  第 5 題各自獨立指出 `lib/stages.js:56` 講的是入口 skill、stage skill 常駐每輪
  重付——後面這一條是兩份互相獨立的答案抓到同一個錯，交叉比對過。

### 還要回到閘門問的兩件事

- 第 2 題說 `stage-skip-said` 是唯一真訊號，而 n=1 分不出 prompt 與模型；要定案
  得在同一個 commit 用 `--model claude-opus-5` 跑五次，錄下的單次 $0.56，約 $2.8。
  這筆花費不在這份設計裡預先授權。
- 第 5 題的翻案條件：`docs/decisions/2026-09-05-skill-split-design.md:158` 那條
  「模型會不會從 plugin cache 跟著相對連結去讀 `rationale.md`」至今沒有驗證紀錄。
  沒驗就繼續往 `rationale.md` 搬，等於把理由丟掉。要先驗。

## 4. 收尾

- `TODO.md` 八條各自關掉或改寫。判斷帶出的新工作以新條目進 `## Ready` 或
  `## Waiting`，`## Waiting` 的照規矩帶 `lifts when:` 與 `MM-DD`。
- `docs/README.md` 的 `## Judgements` 表格與 `docs/judgements/` 目錄，在這個
  task 之前都是空的與不存在的；七份判斷已經由 `scripts/judge.js record` 建立並
  補上七列。這是這個 repo 第一次真的用 `/fankeel-ask`。
- `node scripts/todo-check.js` 與 `node scripts/docs-check.js` 都要綠。

## 檔案表

每一列都有一份判斷背書，除了 Ready 那一列——它本來就不需要問。

| file | change | dispatch |
|---|---|---|
| `lib/render.js`、`tests/brief.test.js` | `RETURN_RULES` 加第四條工作樹規則並斷言它在 brief 裡，`< 1400` 維持綠 | in-session — 兩次 Edit |
| `tests/resume.test.js` | `renderResume` 長度斷言 cap `< 2600` 字元，控制組用 `assert.match(out, /^stage rules:$/m)` 而非壓 cap | implementer, sonnet |
| `docs/pipeline.md` | 七個人手量的數字改由 `t.diagnostic` 印出；並補一處指向 `tests/render.test.js:498` 的引用 | implementer, sonnet |
| `evals/subagent-no-entry/graders/dispatches-a-reader.md` | 三顆比對 `tool: Task` 的 grader 改成 `Agent`；`pipe-or-grep` 放寬到「跑了測試」而非「接了管線」 | implementer, sonnet |
| `docs/reports/evidence/2026-09-10-exception-cases/provenance.txt` | 把 `.fankeel/build/2026-09-10-todo-ten/eval-*.json` 五份搬成可提交的存證，附 provenance | in-session — 複製與一行 provenance |
| `tests/skills.test.js` | 一條測試：`ledger.js`／`groups`／`brief` 只能出現在 loop 頭那條規則之後或被 no-plan 句括住 | implementer, sonnet |
| `skills/fankeel-verify/SKILL.md`、`skills/fankeel-verify/rationale.md` | 把 `:109-135` 整段 2026-08-26 的量測搬進 rationale；`build` 殘留 7 行帶日期的量測句再搬一次 | implementer, sonnet |
| `agents/fankeel-verifier.md` | 新增：`tools: [Read, Grep, Glob, Bash, Write]`、`model: sonnet`，散文寫明不改樹 | implementer, sonnet |
| `skills/fankeel-verify/SKILL.md` | `:155-157` 補 `subagent_type: fankeel-verifier`；`:181-183` 改理由句並把路徑釘到 `.fankeel/build/<plan>/` | implementer, sonnet |
| `tests/guard.test.js`、`docs/collisions.md` | `:233` 的測試名改成明說的設計；`docs/collisions.md` 記操作者的 `permissions.deny` 一步 | implementer, sonnet |
| `TODO.md` | 八條關掉或改寫，`777` 更正；判斷帶出的新工作進 `## Ready` 或 `## Waiting` | in-session |

兩件不在表裡，因為要先問：`stage-skip-said` 的五連跑（約 $2.8），以及
`rationale.md` 相對連結那條未驗證的前提。

## proves it done

- `tests/brief.test.js` 多一條斷言：現在紅（規則不存在），加了之後綠；同檔
  `< 1400` 兩次都綠。
- `tests/resume.test.js` 多一條長度斷言與一個控制組：控制組把 cap 壓到 1 時
  確實紅，還原後綠。
- 產物那一列：`docs/reports/evidence/2026-09-10-exception-cases/` 的四份 JSON 裡
  的 grader 判定，與寫進 `TODO.md` 或報告的計數一致——兩個數字同源必須相符。
- `node scripts/todo-check.js`、`node scripts/docs-check.js`、`node --test tests/`
  全綠。

## against the map

- `docs/pipeline.md` 是 map 列為 current 的 reference 頁，帶著那七個 resume 數字。
  §2 會改動它，不是矛盾而是把它接上斷言。
- `docs/subagents.md` 描述 subagent brief，§1 改 `RETURN_RULES` 之後它會變舊，
  由 `audit` 階段處理。
- map 的 `planned, not built` 五頁：四份 archive 的 fankeel-ask 與
  profile-judge-reader，以及 `docs/plans/2026-09-09-design-class-prompt.md`。
  沒有一頁被這份設計當成已經存在的東西來引用。
- 沒有找到與任何 current 頁面的矛盾。

## unverified

`node scripts/eval.js evals/<case> --model opus` 在這台機器上實際跑得完，我沒有
跑過任何一次。它每次跑起一個 `claude -p`，四次是真的花費；README 說得動，但
說得動與跑得完不是同一件事。
