---
status: design-intent
last_verified: 2026-09-21
---

# 全部 stage 交給 brain：讀取清單由上一站寫、圈號檔名、先量再改

這頁描述要做成的樣子，不是現在的樣子。它接在
[2026-09-21-controlled-stations.md](../decisions/2026-09-21-controlled-stations.md) 後面：那個任務讓
`stage.agents` 能名 build 與 verify，但留下「提交來回沒有實跑過，A/B 也沒有」。這頁處理兩件事：
每一站都能交給 brain 時缺的三樣東西，以及在動它們之前先量現有的那一半。

**主控用 Sonnet 是前提。** 主控只轉手路徑、問關卡；讀內容與判斷在 brain。所以這個任務量的是主控的 turn 數與
context，不是品質。

## 現況（design 站讀過的）

- session 4f52fd18 用 Sonnet 5 主控：454 個主控 request（Sonnet 5 佔 439）、context 69k → 952k、63 個 subagent
  （`node scripts/ctx.js 4f52fd18-c00c-4ec9-a0aa-f752120abd0c` 印得出這幾個數）。
- 逐站拆開現在由 `node scripts/ctx.js 4f52fd18-c00c-4ec9-a0aa-f752120abd0c --by-stage` 印出，和 registry 記的 9 次站切換
  （survey、design、plan、build、verify、build、verify、audit、land）逐站對得上：build 232＋26＝258 turn、verify 62＋11＝73、
  audit 33、land 19；主控重讀量 186.8M token 裡 build 加 verify 佔 129.5M（69%），audit 與 land 佔 45.3M。design 站當時一次性的
  內嵌腳本只配到 6 個 `task.js stage` 指令，把 plan、audit、land 的 turn 併進前一站，才算出「verify 125 turn、兩站佔 94%」；
  那組數字已被這一條取代。454 個 request 裡 398 個接在主控自己的 tool result 後面、55 個只接在 subagent 回報後面（前面沒有 tool result）、
  1 個接在人的 prompt 後面（整個 session 只有 2 個人的 prompt）：主控的 turn 主體是它自己的 tool loop，不是被叫醒。
- 那個 session 只派了一個 `fankeel-brain`（survey）。裝機的 0.74.0 沒有 `STAGE_AGENTS`、`COMMIT_RULE`，也沒有
  `scripts/commit.js`；repo 是 0.75.0，三個都有。所以 build 與 verify 在那個 session 裡不受控，profile 寫了也沒有效果。
  它是「沒拆」的基線，不是「拆了還是堆」的證據。
- `renderBrainBrief`（`lib/render.js:397`）給 brain 的是規則、skill 路徑、handoff 路徑；沒有任何一行說先讀什麼。
  主控的 prompt 只有站名（`lib/stages.js:608`）。
- handoff 檔名是 `<stage>.md`（`lib/handoff.js:18`）：verify 退回 build，第二圈寫在第一圈同一個路徑，
  `readGate`（`lib/handoff.js:39`）也沒有新鮮度檢查。
- `fankeel-brain` 只准寫 handoff 檔、被拒絕 `git add`／`commit`／`merge`（`agents/fankeel-brain.md`）。
  design 的 spec、plan 檔、audit 的改檔、land 的合併都是這兩類事。

## 1. 先量：用 0.75.0 把現有的受控 build 與 verify 跑一輪

- 用 `claude --plugin-dir F:/ymlab/fankeel` 開新終端機，或重裝；確認 `controlling('build', …)` 為真才開始。profile 用
  現有的 `stage.agents: survey,build,verify`，不動 builtin。
- 量的是一個有 plan 的真實 task，不是 fixture。跑完用 `node scripts/ctx.js` 取主控每站的 turn 數、被叫醒次數、
  每個 gate 當下的 context，加上每個 brain 自己的 context 序列。
- 結果落成一份 dated report（`docs/reports/`），至少回答三件事：主控每個 task 的提交來回實際佔幾個 turn；build brain
  跑完整份 plan 有沒有超過 400k；stage 來回跳時，回頭那一站的 brain 冷啟動讀了多少。
- 這個 task 只加量測工具、不改任何行為：`node scripts/ctx.js <session> --by-stage` 印出每站的主控 turn 數、被叫醒的 turn 數（只被 subagent 回報叫醒：自上一個 request 以來收到回報、且沒有 tool result，回報之前或之後都算）、gate 數與 context。後面四節裡依賴這份數字的，各自寫明「等量測」。

## 2. handoff 按圈編號

- 一站的第一次進場沿用現在的檔名（`build.md`、`build-answer.md`、`build-commit.md`）；第 n 次進場（n ≥ 2，數法是
  這一站在 `moves` 裡出現幾次）用 `<stage>-<n>.md`、`<stage>-<n>-answer.md`、`<stage>-<n>-commit.md`。
- `handoffPath`、`answerPath`、`commitPath` 三個函式是唯一算圈號的地方；`hooks/gate.js:47` 讀 gate、`hooks/resume.js`
  寫 answer、`renderBrainBrief` 給路徑，都經過它們，所以使用者看到的 gate、brain 讀的 answer、commit 檔屬於同一圈。
- 上一圈的 gate 不會被當成這一圈的：這一圈的檔還沒寫，`readGate` 讀不到就回 null，gate hook 照舊放行主控自己的問題。
- `task.js stage` 經 `stampEntry`（`lib/registry.js:510`）在派 brain 之前就蓋好這一次進場的戳，而且只在這一站與上一筆
  不同時才加，所以派工當下 `moves` 已含這一次，重複下同一個 `stage` 指令也不會多算一圈。
- `moves` 只留最近 60 筆（`MAX_MOVES`，`lib/registry.js:51`），同一站進場次數超過保留窗時圈號可能重複；已知的上限，不處理。

## 3. brief 的 `read first:`

- 每份 handoff 在 `json gate` 區塊之前多一個 `reads:` 區塊：每行 `<路徑> — <為什麼>`，最多 8 行。寫的是剛讀完內容的
  brain，`renderBrainBrief` 的輸出規則要求它。
- `renderBrainBrief` 印一段 `read first:`：從 `moves` 找上一次進場的那一站，取它那一圈的 handoff 路徑，加上該檔
  `reads:` 區塊的每一行。那一站沒有 handoff（沒受控，例如 survey 在主控裡做）就往前找最近一個有的；都沒有就印
  `read first: none — the map and the task line`，不留空。
- 讀 `reads:` 的是 `hooks/brief.js`（SubagentStart），不是主控；主控一份 handoff 也不打開。
- 主控派工的 prompt 除了站名可以再加一行（使用者剛給的新指示）。那一行本來就在 brain 的第一則訊息裡，brief 不轉印：
  SubagentStart 的 payload 沒有 prompt。
- `read first:` 最多印 12 行、1000 字元，超過的寫「另有 N 行未列」，不默默截掉；整份 brief 仍在 Claude Code 對單一
  `additionalContext` 的 10,000 字元之內。

## 4. `artifact:`：design 與 plan 的檔，audit 與 land 的改動

- brief 在 design（架構級）與 plan 站多一行 `artifact:`，指向 `docs/plans/`：brain 除了 handoff 只准 Write 那裡的一個檔，
  名稱依日期與主題，寫進 handoff 的 `spec:` 行。這仍是 prose 規則，跟現在「不寫 handoff 以外」一樣，沒有 hook 擋。
- design 與 plan 站的提交走 commit 檔，跟 build 今天一樣：兩站的 `controlRules` 也帶 `COMMIT_RULE`
  （`lib/stages.js:611` 現在只在 build 帶）。
- audit 與 land：brain 沒有 Edit、也不做 git 寫入；audit 要改的頁面、land 的搬檔、merge 與清理，都交給
  `dispatch.floor` 的 implementer（跟 verify 的 mutation 同一條路），land 的整合方式仍經 gate 由使用者選。
- 等量測：§1 若顯示主控的提交來回太貴，`COMMIT_RULE` 的位置要重審，這一節的提交那條跟著改。

## 5. profile 與文件

- builtin 維持 `false`。七站全拆只是 profile 的 `stage.agents: all`，`parseStageAgents` 已經接受。
- `docs/subagents.md` 的「A stage agent」一節與 skill 的「Delegate a job inside a stage; never the stage itself」把例外改寫成
  「profile 名單上的站」，並列出每個受控站的 brain 能寫什麼、不能寫什麼。
- `docs/subagents.md`「What a controlled `build` and `verify` have not been run through」裡「A stale gate」那條，§2 落地後刪掉。

## 檔案與派工

分期（plan 關卡，2026-09-22，使用者決定）：先只做第一列，其餘等 §1 的量測。計畫在
[2026-09-21-all-stages-brain.md](2026-09-21-all-stages-brain.md)，沒做的五個 task 在
[2026-09-21-all-stages-brain-held.md](2026-09-21-all-stages-brain-held.md)。

| file | change | dispatch |
|---|---|---|
| `scripts/ctx.js`、`tests/ctx.test.js` | §1 的量測工具：`--by-stage` | implementer, sonnet |
| 量測的 dated report（§1） | 要真的開新終端機跑，不是 build 的產物 | in-session — subagent 開不了新終端機，量測由使用者開、這裡讀 ctx.js |

等量測之後才做的，held 檔的 Task 2 到 6（開工前把下面這張表的表頭改回 `file`，再跑一次 `ledger.js lint`）：

| held file | change | dispatch |
|---|---|---|
| `lib/handoff.js` | 三個 path 函式加圈號；`readsOf`、`previousHandoff` | implementer, sonnet |
| `lib/render.js` | `read first:`、`reads:` 的輸出規則、`artifact:`、audit 與 land 的 implementer 規則；hook 那一側已把 root 與 record 交過來，不用動 | implementer, sonnet |
| `lib/stages.js`、`agents/fankeel-brain.md` | design、plan 也帶 `COMMIT_RULE`；audit、land 進 `STAGE_AGENTS`；brain 能寫的那一個檔 | implementer, sonnet |
| `tests/handoff.test.js`、`tests/brief.test.js`、`tests/stages.test.js` | 下面「完成的判準」的前三條 | implementer, sonnet |
| `docs/subagents.md`、`skills/fankeel/SKILL.md`、`TODO.md` | §5 | in-session — 三頁文字，一個指令查引用 |

## 不做的

- brain 以 ledger 接力：等 §1 量到 build brain 超過 400k 再做（TODO 的 Waiting「交接後 context 仍過 400k」）。
- brain 自己跑 `commit.js`：使用者上次在 build 關卡選了主控提交，要推翻它得先有 §1 量出來的兩個 turn 的實際成本。
- 主控讀報告後挑讀取清單：主控沒讀原檔，只能從摘要挑；清單由讀過內容的 brain 寫、hook 抄。
- 把 builtin 翻成 `all`：`docs/subagents.md` 寫「default 要等量測」。

## 完成的判準

- `tests/handoff.test.js`：`moves` 為 `[build, verify, build]` 時 build 的 `handoffPath` 以 `build-2.md` 結尾；`moves` 為
  `[build]` 時以 `build.md` 結尾；只有 `build.md` 存在且含 gate 時，`readGate(build-2.md)` 回 null。第 1、3 條現在紅
  （同一個路徑、回上一圈的 gate），第 2 條是不變條件，現在就綠。
- `tests/brief.test.js`：seed 一份帶 `reads:` 的 verify handoff、`moves` 以 verify、build 結尾，build brain 的 brief 在
  `read first:` 下含每個列出的路徑；`reads:` 有 30 行時印 12 行並寫「另有 18 行」；上一站沒有 handoff 時印
  `read first: none`。現在都紅（沒有這個區塊）。
- `tests/stages.test.js`：design、plan 的 `controlRules` 含 `commit <file>` 那條，audit、land 不含。
- 一條對成品：§1 之後的第二次真實受控跑，取一個 brain 的 transcript（`subagents/agent-<id>.jsonl`）的第一則訊息，
  裡面有 `read first:`，且列出的每個路徑在磁碟上都存在。檢查的是 brain 真正收到的東西，不是 `renderBrainBrief` 的回傳值。
- 量的門檻：同類的完整 route，主控 ≤ 60 turn、最後一個 gate < 200k（session 4f52fd18：454 turn、952k）。門檻是作者提的，
  隨時可改。

## 未驗證

- 受控 build 與 verify 從沒跑完一輪：決定紀錄自己寫「brain → controller → brain 的提交來回沒有實跑過，A/B 也沒有」。
  §1 就是補這個；不補，後面四節蓋在沒跑過的東西上。
- land 交給 brain：brain 被拒絕 `git merge`、`checkout`，要靠 implementer 代做，這條路沒人走過。
- `moves` 保留窗 60 筆，圈號在極端任務上可能重複（§2）。

[Back to the index](../README.md)
