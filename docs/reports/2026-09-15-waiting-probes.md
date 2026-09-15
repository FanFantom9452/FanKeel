---
status: current
last_verified: 2026-09-15
source_of_truth: 五次探測的直接輸出，全部在 `docs/reports/evidence/2026-09-15-waiting-probes/`
  ——`provenance.txt` 帶 HEAD sha 與 `claude --version`，四份 `out-*.jsonl`、五份
  `dispatch-out-*.jsonl`、六份 `link-*.jsonl` 是三支探測的 stream-json 逐格記錄，
  `eval-route-typo.json` 與 `eval-stage-skip-said.json` 是兩支 eval 各五次的成績；
  本頁每一個數字都回溯得到這些檔案之一，本頁不會重新產生
---

# 2026-09-15 — 五條 Waiting 的探測

`TODO.md` 的 `## Waiting` 有五條，寫的 `lifts when:` 都不是世界要發生什麼，是我們自己要去跑一次。這份是那五次的結果。

每支探測都有一個控制臂，而且**三支裡有兩支的控制臂真的擋下了錯誤結論**——一支抓到探測放在測不到東西的模式裡，一支抓到 grader 會假通過。沒有控制臂的「沒發現」等於沉默，這次是有憑據的。

證據、腳本與 grader 在 `docs/reports/evidence/2026-09-15-waiting-probes/`，`provenance.txt` 帶 HEAD sha 與 `claude --version`。

## 1. `permissions.deny` 在 auto 與 bypassPermissions 底下還算不算數

`docs/collisions.md:210` 自己寫著沒人驗過，並說那是「a background subagent is most likely running under」的兩種條件。

2x2：deny 有／無 × `--permission-mode auto`／`bypassPermissions`。針是唯讀的 `git stash list`（操作者名單上的原句）與 `echo probe-needle-7391`，跑在一個拋棄式 git repo 裡，工具只開那兩條。

| 格 | 結果 |
|---|---|
| auto / 無 deny | 兩根針都跑掉（控制臂） |
| auto / 有 deny | 1 of 1 denied |
| bypassPermissions / 無 deny | 兩根針都跑掉（控制臂） |
| bypassPermissions / 有 deny | 2 of 2 denied |

**答案：兩種模式下都擋得住。** 拒絕訊息是 `Permission to use Bash with command git stash list has been denied`，讀自 `tool_result` 的 `is_error`，不是讀模型的自述——一個說「我被擋了」的模型和一個真的被擋的模型，在文字上長得一樣。

## 2. `--allowedTools` 吃 `Task` 還是 `Agent`

問錯旗標了。

| 臂 | 結果 |
|---|---|
| `--allowedTools ...,Agent` | 派工了 |
| `--allowedTools ...,Task` | 派工了 |
| `--allowedTools ...`（兩種都不帶） | **派工了** |
| `--disallowedTools Agent` | 沒派工，回 `NO DISPATCH TOOL`（控制臂） |
| `--disallowedTools Task` | 沒派工 |

**答案：`--allowedTools` 不管這個工具，任何拼法都一樣；`--disallowedTools` 管，而且兩種拼法都認得。**

控制臂在這支救了兩次。第一輪跑在 `--permission-mode bypassPermissions` 底下——那個模式繞過所有權限檢查，`--allowedTools` 在那裡本來就是空操作，三臂都派工什麼都不證明。第二輪改成 `manual` + `--permission-prompts none`，旗標真的在管事了，派工還是發生——這才是結論，不是失敗。

副作用一條：`evals/subagent-no-entry/prompt.md:8` 的 `allowed_tools: [Read, Grep, Glob, Bash, Agent]` 其實沒有限制住任何東西。那個 case 的兩次歷史跑動都沒派工，原因不在旗標。

## 3. 模型會不會跟著 `SKILL.md` 的相對連結去讀 `rationale.md`

`docs/decisions/2026-09-05-skill-split-design.md:158` 把方法寫下來了，沒人跑：叫 `fankeel-build`，問一個只存在 `rationale.md` 的事實。

兩根針，各是自己檔案裡唯一的字（在 `skills/`、`docs/`、`lib/` 範圍內）：`predating` 只在 `SKILL.md`，`triples` 只在 `rationale.md`。每格跑兩次。

| 格 | 開過 `rationale.md` | 引出那句話 |
|---|---|---|
| 控制（`predating`，haiku ×2） | — | 1 of 2 |
| `triples`，haiku ×2 | 0 of 2 | 0 of 2 |
| `triples`，sonnet ×2 | 0 of 2 | 0 of 2 |

四次問 `triples` 全部回 `NEEDLE NOT FOUND`，兩個模型，沒有一次去開那個檔。

**答案：連結不會被跟。**

控制臂在這支也抓到一個東西，而且是會讓結論作廢的那種。`grade-link.js` 第一版把所有 `text` 區塊都收進來比對，而被注入的 `SKILL.md` 本體是一個 26,105 位元組的 `user` text 區塊，控制針本來就在裡面——所以 `control/1` 是配到注入的內容，不是模型的回答。改成只收 `assistant` 的文字之後，`control/1` 從命中翻成沒命中。控制臂仍然成立，靠的是 `control/2`：那次模型自己引了那句話。

控制格兩次都沒有開任何檔，其中一次仍引出了 `SKILL.md` 的句子——技能本體是被注入進 context 的，不是被讀出來的。這正好說明另一半：注入的東西到得了，連結後面的東西到不了。

範圍比 TODO 那條寫的大。三個技能用的是同一行連結形式：

- `skills/fankeel-build/SKILL.md:41`
- `skills/fankeel-plan/SKILL.md:42`
- `skills/fankeel-audit/SKILL.md:51`

`skills/fankeel-verify/SKILL.md` 根本沒拆，零個 markdown 連結、零次 `rationale`——所以 TODO 那條寫的「verify 與 build 的 rationale 沒拆完」，verify 那半是還沒開始，不是做到一半。

`tests/skills.test.js` 驗的是連結存在，不是連結會被跟。它一路綠著，而它要保護的東西沒在運作。

## 4. `route-typo` 同一個 commit 連跑五次

TODO 那條寫：09-08 兩次 2/3 與 3/3、09-09 一次 1/3，「CI threshold 0.7 會擋掉三次裡的兩次」。

`node scripts/eval.js evals/route-typo --model sonnet --runs 5`，在 `1ab583061fa651e63df9df097818c61091547292` 上。

| 次 | 分數 | 成本 |
|---|---|---|
| 1 | 3/3 | $0.3370 |
| 2 | 3/3 | $0.3101 |
| 3 | 3/3 | $0.3581 |
| 4 | 3/3 | $0.3443 |
| 5 | 3/3 | $0.2709 |

合計 15/15，約 $1.62。**跳動沒有重現**，threshold 0.7 五次都過。

兩件不能略過的事。

第一，那條 TODO 的前提本來就不成立。09-08 的兩次跑動記在 `docs/reports/evidence/2026-09-08-route-typo/provenance.txt`，HEAD 分別是 `4db33a1b…` 與 `aabf9b2e…`——**兩個不同的 commit**，不是同一棵樹。09-09 那次 1/3 完全沒有 JSON，只有 `.fankeel/build/2026-09-09-gate-and-controls/verify-evidence.md:86` 的一行散文，而那個目錄是 gitignored 的。所以「同一棵樹上分數會跳」這個說法，從來沒有一次是在同一棵樹上量的。

第二，五次全綠不等於那個 case 不會跳，只等於**在這個 commit、這個模型、今天，它沒有跳**。`route-typo` 的 prompt 與 fankeel 的 skill 從 09-08 以來改過很多次；這五次量的是現在的東西。

## 5. `stage-skip-said` 用 opus 連跑五次

TODO 那條寫：「四個例外 case 裡唯一的真訊號，但 n=1 分不出 prompt 與模型」。

`node scripts/eval.js evals/stage-skip-said --model claude-opus-5 --runs 5`，同一個 commit。

| 次 | `no-stage-off-route` | `says-which-stages-skipped` | 成本 |
|---|---|---|---|
| 1 | pass | fail | $0.5828 |
| 2 | pass | fail | $0.5095 |
| 3 | pass | fail | $0.5435 |
| 4 | pass | fail | $0.6218 |
| 5 | pass | fail | $0.6173 |

5/10，$2.87。

**答案：那是真訊號，而且是穩定的。** 五次同一個方向，沒有一次跳動；加上 09-10 那次 n=1 的 1/2（`docs/reports/evidence/2026-09-10-exception-cases/eval-stage-skip-said.json`，$0.5558），六次全同。

所以 TODO 那條想分的「prompt 還是模型」，答案是兩者都不是變因：opus 在這個 prompt 底下**一貫地不說自己跳過哪個階段**，而它同時一貫地沒有走到路線外的階段。前半是 pipeline 沒把那句話要出來，不是模型時好時壞。

## 花費

| | |
|---|---|
| `route-typo` ×5，sonnet | $1.62 |
| `stage-skip-said` ×5，opus | $2.87 |
| 第一次掛在 `rmSync` EPERM 的兩次跑動 | 各付了一次，約 $0.9 |
| 三支探測（haiku 為主，兩次 sonnet） | 約 $0.3 |
| **合計** | **約 $5.7** |

design 的 gate 上說的是約 $4。超出的部分幾乎全是 `scripts/eval.js:133` 那次白跑——`fs.rmSync` 在 Windows 上吃 `EPERM`，`finally` 區塊讓它在評分完成之後才炸掉，所以錢付了、分數沒留下。`--keep-temp` 跳過那行。

## 這些結果讓什麼變成假的

| 頁面 | 現在不成立的句子 |
|---|---|
| `docs/collisions.md:210-212` | 「Nobody has verified whether `permissions.deny` still applies under `defaultMode: "auto"`, or against a command run with `bypassPermissions`」——驗了，兩種都擋得住 |
| `docs/decisions/2026-09-05-skill-split-design.md:156-162` | `## Unverified` 那段的問句——驗了，答案是不會被跟 |
| `skills/fankeel-build/SKILL.md:41`、`fankeel-plan:42`、`fankeel-audit:51` | 「Why each rule is what it is, under the same headings: [rationale.md](rationale.md)」——這行指向的東西模型到不了 |
| `tests/skills.test.js` | 驗連結存在，不驗連結會被跟。綠著，但保護不到它要保護的東西 |
| `evals/subagent-no-entry/prompt.md:8` | `allowed_tools` 清單沒有限制住任何工具 |

前兩列是那兩頁自己寫著「沒人驗過」，補上是它們在做自己的事，不是漂移。後三列是新的，`## Needs a decision` 各有一條。
