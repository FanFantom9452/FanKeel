---
judged: 2026-09-10T15:04:31.103Z
model: fable
agent: fankeel-judge
task: "處理 TODO：Ready 一條與七條待決議，決議走 fankeel-ask"
session: 98873819-d200-4e3b-be77-be352547e51e
stage: design
---

# 判斷 2：四個例外 eval case 首跑正向 grader 全掉，歸因在哪

## Question

# 判斷 2：四個例外 eval case 首跑正向 grader 全掉，歸因在哪

## 問題

`TODO.md` 記著：四個例外 case 首跑（opus）的正向 grader 全部沒過——stage-skip
沒說跳過什麼、pipe 沒跑測試、Task 一次都沒被叫。是 prompt 沒逼出行為、grader
太窄、還是模型？

## 先講一件會改變這題性質的事

**那次跑的產物在這個 repository 裡不存在。** `docs/reports/`、
`docs/reports/evidence/`、`evals/` 三處 grep 四個 case 的名字，只回到各自
`case.yaml` 與 `prompt.md` 的 front matter。沒有 JSON、沒有 transcript、沒有報告。
`TODO.md` 那一行是唯一的紀錄。

所以這題的第一個問法是：**在沒有那次跑的情況下，這題答得了嗎？** 若答不了，
你的答案就是說出要跑什麼才答得了，那比一個猜出來的歸因有用。

## 可以跑，這點已經確認

`README.md` 的 Behaviour evals 一節與 `node scripts/eval.js --help` 都說本機跑得動：

    node scripts/eval.js evals/<case> --model <m> --json <path>

`TODO.md` `## Waiting` 底下那條 early access 講的是官方 `claude plugin eval`，
不是這支 runner。四次 `claude -p`，是真的花費。

## 你可以自己讀的檔

- `evals/one-call-not-agent/`、`evals/pipe-not-agent/`、`evals/stage-skip-said/`、
  `evals/subagent-no-entry/` — 各自的 `case.yaml`（1-4 行）與 `prompt.md:10`
- `evals/stage-skip-said/graders/says-which-stages-skipped.md` — regex grader
- `evals/pipe-not-agent/graders/pipe-or-grep.md` — `tool_used`，`tool: Bash`
- `evals/subagent-no-entry/graders/dispatches-a-reader.md` — `tool_used`，`tool: Task`
- `scripts/eval.js`、`lib/eval.js` — runner 與評分
- `docs/reports/2026-09-08-*`、`docs/reports/evidence/2026-09-08-route-typo/` —
  另一個 case 有存證，可以拿來對照存證長什麼樣
- `skills/fankeel/SKILL.md` 的 Dispatch 一節、`lib/stages.js` 的 `ALWAYS` —
  prompt 端到底逼不逼得出那三個行為

## 已知的事實

- 四個 `case.yaml` 都沒有 model、threshold 或 pass criteria 欄位。
- `evals/route-typo` 同一棵樹上分數會跳：09-08 兩次 2/3 與 3/3，09-09 一次 1/3。
  這是 `## Waiting` 底下另一條記著的事，跟「單次跑動能不能歸因」直接相關。
- `dispatches-a-reader.md` 要的是 `tool: Task`，而這個 harness 的派工工具現在叫
  `Agent`。這一點值得你自己去 `scripts/eval.js` 與 `lib/eval.js` 確認 `tool_used`
  比對的是哪個名字。

## 算什麼是答案

三個歸因裡挑一個，或說「資料不足，要先跑 N 次才答得了」並說出 N 與參數。
若你認為某個 grader 本身就是錯的（例如比對了一個已經改名的工具），指名是哪一個、
錯在哪一行。

## 回傳形狀

- 一行結論。
- 三到六行理由，每行一個。
- 一行「這個決定在什麼情況下是錯的」。
- 不要重述這份 brief。

## Answer

pick: 不是三選一——四顆正向 grader 有三顆是 grader 自己錯（一顆已修、兩顆待修），只有 `stage-skip-said` 是真的行為訊號而 n=1 分不出 prompt 與模型；那次跑的紀錄其實存在。先修 grader，再在同一個 commit 用 `--model claude-opus-5` 跑 `evals/stage-skip-said` 五次（錄下的單次 $0.56，約 $2.8）才答得了最後那題。
why: 紀錄在 `F:\ymlab\fankeel\.fankeel\build\2026-09-10-todo-ten\eval-*.json`（`.fankeel/.gitignore:3` 忽略，故 git 裡沒有）與 `C:\Users\Owner\.claude\projects\C--Users-Owner-AppData-Local-Temp-fankeel-eval-{VuZIqo,XnSj6a,HjFsMx,1Hfkkw,VMorsY}\`，全是 `claude-opus-5`、2.1.267；brief 的「唯一紀錄是 TODO 那行」不成立，`docs/reports/2026-09-08-*` 也不存在（只有 `evidence/2026-09-08-route-typo/`）。
`reads-the-file`：模型只做一次 `Read` `...\lib\thing.js`，舊 regex `lib/thing\.js` 吃不到反斜線——純 grader bug，3771e7e 已改成 `lib[\\/]+thing\.js`，錄下的 run 重放現在的 grader 是 2/2 pass。
`evals/pipe-not-agent/graders/pipe-or-grep.md:4`：模型跑了 `node --test 2>&1; echo "EXIT=$?"`——一個 Bash、沒派工、印出 exit code；TODO 的「pipe 沒跑測試」與 `verify-evidence.md` 的「ran nothing」都是錯的，是 grader 硬要 `| grep|tail|head|wc`。
`evals/subagent-no-entry/graders/dispatches-a-reader.md:3`（及兩個 `no-agent-dispatch.md:3`、三個 `prompt.md:8`）比對 `Task`，但同日同機兩次 headless 派工的 transcript（`...\C--Users-Owner-AppData-Local-Temp-tmp-P2HLKSRrTi\9dccef1e-*.jsonl`、`...tmp-rLAhmIXkCx\72790ce6-*.jsonl`）tool_use 名字是 `Agent`，全機 transcript 沒有任何 `Task` 區塊；15daa59 只憑 `system/init` 的工具清單改名，`replay-real.js` 的對照是自己拼進一行 `Task`——`min: 1` 永遠不過、兩顆 `max: 0` 永遠不紅。而且模型兩次都內嵌讀五個一行檔、沒嘗試派工，prompt 沒載 `/fankeel`，這個 case 量的是裸 opus 不是外掛。
`says-which-stages-skipped` 是唯一真訊號：`/fankeel` 已載入 SKILL.md:348-350，opus 走 `--route build,verify`，trace 與末句都沒點名跳過的 stage；但 `route-typo` 同一棵樹三次 2/3、3/3、1/3，n=1 分不出 prompt 與模型，`## Waiting` 自己定的門檻就是同 commit 五次。
would flip if: `claude -p --output-format stream-json` 的 assistant 行把派工工具寫成 `Task`（與磁碟 transcript 不同）——一次 haiku 強制派工的 stream-json 探測就能定；那樣 `Task` 三顆 grader 沒錯，第四行只剩「模型選擇內嵌讀」。
unread: brief 點名的都開了；`docs/reports/2026-09-08-*` 不存在無從開；`skills/fankeel/SKILL.md` Dispatch 節只讀了 grep 到的 :866-883、:952，沒整節讀。
