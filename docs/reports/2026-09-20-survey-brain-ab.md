---
status: current
last_verified: 2026-09-20
source_of_truth: 兩次互動實跑（session 5121ea58、942566e9）的 transcript，與一組四臂 headless 量測（`ab.sh`，2026-09-19T18:59Z 起，`HEAD 315f58bb7fb5945e9df9c7f4783a03e356f3829e`）與一組四臂對照（`ab2.sh`，2026-09-19T19:45Z 起，`HEAD f34f846f9dfe04607a82d014b73d606dcdc1533f`）的直接輸出；全部複製在 [evidence/2026-09-20-survey-brain-ab/](evidence/2026-09-20-survey-brain-ab/)。本頁每一個數字都從那裡的檔案來，本頁不會重新產生
---

# survey 交給 Opus 大腦：新舊模式的量測 — 2026-09-20

**新模式跑得通：Sonnet 主控派 Opus 大腦、大腦派 Sonnet reader、使用者看到的關卡題目就是交接檔裡的原文。但在這個 survey 題目上它比舊模式慢、也比較貴，主控的 context 也沒省下多少。大腦派了四個 reader 的那組慢 9–10 倍、貴 4.0–5.6 倍；把大腦的 `Agent` 拿掉的對照組仍然慢 6.5–9.0 倍、貴 2.5–2.8 倍。主控自己只花 $0.23–0.25，差距在大腦：它把步驟拆開做，用了 34 與 48 次工具，舊模式的主 session 整站 5 與 6 次。**

這是 [docs/plans/2026-09-19-survey-brain.md](../plans/2026-09-19-survey-brain.md) 的 Task 7，回答設計頁 [§8 量測](../plans/2026-09-19-survey-brain-design.md) 的問題。報告以實際跑的日期命名。

## 1. 互動實跑：第一次沒走到新模式

session 5121ea58，`stage.agents` 設為 `true`，Sonnet 主控，`/fankeel:fankeel survey only: which code reads the registry's started field, and what each reader does with it`。

主控自己把 survey 做完，沒有派 `fankeel-brain`，沒有交接檔。transcript 看得出兩個原因，都是已經 land 的程式的缺口：

- task 開始的那一輪沒有任何注入。主控唯一的指示是 `task.js start` 印的最後一行 `FIRST_STEP.survey`（「run the scanner」），主控規則要到下一個 prompt 或關卡答完才到。
- 它選了 `--route survey`。`controlBlock` 要求有下一站，最後一站因此拿到普通的 survey 規則。

修正是 `6809aef`（`start`／`task` 在這一站印主控規則；最後一站的選項一是 `task.js down`）與 `08ff2c9`（印出 `<plugin>` 指向哪裡）。

## 2. 互動實跑：第二次

session 942566e9，同一個題目，修正之後。

- `task.js start` 印出主控規則；主控派了一個 `fankeel:fankeel-brain`，prompt 是 `survey`，沒帶 model。
- 大腦（`claude-opus-5`）派了五個 `fankeel:fankeel-reader`（`claude-sonnet-5`），約 6 分鐘後回傳交接檔路徑。
- 主控印出那一行路徑，送出 placeholder 題目；`hooks/gate.js` 換成交接檔的 `json gate` 區塊；使用者點了選項一；`hooks/resume.js` 寫出 `survey-answer.md`。

**產出物檢查**（`artefact-check.js`，輸出全文在 `artefact-check-942566e9.txt`）：

```
sent by the controller (tool_use.input.questions):
  [{"question":"placeholder","header":"survey","options":[{"label":"placeholder A",...
  equals gate block: false
shown to the user (toolUseResult.questions):
  [{"question":"survey 的答案在上面。要收下、升路線，還是再查一輪？",...
  equals gate block: false
```

`equals gate block: false` 是 key 的順序：交接檔寫 `question, header, multiSelect, options`，Claude Code 回傳時排成 `question, header, options, multiSelect`。逐欄比對（`question`、`header`、`multiSelect`、每個選項的 `label` 與 `description`）完全相同。主控送出的 placeholder 沒有到使用者眼前。

**`<session>/subagents/`**：六個檔案在同一個目錄——大腦的 `.meta.json` 是 `spawnDepth: 1`，五個 reader 都是 `spawnDepth: 2`、`parentAgentId` 指向大腦。所以 `agentFiles()` 會把第二層算進去，新模式的花費沒有少算。

這一次也露出一個問題：大腦的題目寫「survey 的答案在上面」，但主控只印了路徑，上面沒有報告。`315f58b` 在大腦的 brief 裡寫明使用者只看得到路徑，題目要能獨立讀。

答完之後的 `[Request interrupted by user]` 是使用者按的中斷，選項一的 `task.js down` 因此沒跑；這不是缺陷。

## 3. headless 對照

`ab.sh` 在同一個迴圈裡交替跑舊、新、舊、新。舊模式是 `--model opus` 加 `stage.agents false`，新模式是 `--model sonnet` 加 `stage.agents true`，兩種都加 `--setting-sources project --plugin-dir F:/ymlab/fankeel --permission-mode bypassPermissions`。每一臂先用 `claude -p --session-id` 跑 `task.js start --route survey,design`，再用 `claude -p --resume` 跑「Do the survey stage for this task, up to its gate.」，後者用 `date +%s` 夾住計時。

跑的時候：`HEAD 315f58bb7fb5945e9df9c7f4783a03e356f3829e`，`git status --porcelain` 只有未追蹤檔，claude `2.1.278`。每一臂跑完的 porcelain 也只有未追蹤檔。每一臂實際執行的指令逐字記在 `ab/provenance.txt`，例如 `new1` 的第二個呼叫：

```
$ claude -p Do\ the\ survey\ stage\ for\ this\ task\,\ up\ to\ its\ gate. --resume 3b86035f-a9e0-4729-b392-184c1d4c1889 --model sonnet --output-format json --setting-sources project --plugin-dir F:/ymlab/fankeel --permission-mode bypassPermissions
survey exit=0 shell_seconds=388
```

| arm | 時間（秒） | 花費（`modelUsage`） | output tokens | cache read | subagents | 主 session 在最後一輪的 context |
|---|---|---|---|---|---|---|
| old1 | 37 | $0.79 | 3,364 | 367,330 | 無 | 66,902 |
| new1 | 388 | $4.42 | 75,888 | 5,192,363 | 1 brain、4 reader | 69,840 |
| old2 | 31 | $0.58 | 2,557 | 205,437 | 無 | 58,420 |
| new2 | 278 | $2.33 | 36,856 | 2,291,900 | 1 brain、4 reader | 81,675 |

花費從 `modelUsage` 各模型的 `costUSD` 加總，它有算進 subagent；`total_cost_usd` 四臂都與它相同。新模式按模型拆開：`new1` 是 Sonnet $1.47、Opus $2.94，`new2` 是 Sonnet $0.77、Opus $1.56（`ab-table.txt`）。context 是主 transcript 最後一則 assistant 訊息的 input、cache read、cache write 相加（`ab-context.txt`）。

組內比較（新／舊）：

| 組 | 時間 | 花費 | output tokens |
|---|---|---|---|
| 1 | 10.5× | 5.6× | 22.6× |
| 2 | 9.0× | 4.0× | 14.4× |

## 4. 怎麼讀這組數字

- **這不是主控的價錢。** 舊模式在 `-p` 裡由 Opus 自己掃、自己讀，四臂裡沒有一次派 reader；新模式的大腦兩次都派了四個。多出來的 output tokens 大多是 reader 與大腦的，主控自己的 output 在 5,017 與 6,038 之間，跟舊模式的主 session（4,958 與 6,925）同一個量級。
- **主控的 context 沒有變小。** 設計的前提是每站一個乾淨 context、主控只留路徑與關卡。在 survey 這麼小的一站，舊模式的主 session 也只有 5.8–6.7 萬；新模式的主控 7.0–8.2 萬，互動那次 8.7 萬。survey 本身占掉的 context 比 skill、注入與大腦回傳的訊息還少，主控省不到東西。
- **`-p` 沒有 `AskUserQuestion`。** 四臂都用文字列出關卡；新模式的主控因此把關卡原文打了一遍，這在互動模式不會發生。題目逐字相同這件事是第 2 節的互動實跑證明的，不是這一節。
- **n=2。** 兩組方向一致，大小差了將近一倍（組 1 的新模式比組 2 多花 $2.09）；兩組都不足以說出穩定的倍數。

## 5. 對照：大腦不派 reader

`ab2.sh` 在同一個迴圈裡交替跑 old3、nor1、old4、nor2。old 與第 3 節的舊模式相同。nor 是新模式，但 `--plugin-dir` 指向 scratchpad 裡的一份 HEAD 副本，`noreader-patch.js` 在副本裡改了三處：`fankeel-brain` 的 `tools` 拿掉 `Agent`、agent 檔的 Tools 段改成自己讀、`lib/render.js` 給大腦的 brief 把派 reader 那一行換成自己讀。其餘追蹤檔 0 個不同。副本放在 repo 外，大腦自己的 Grep 與 Glob 才不會掃到第二份程式碼。兩個檔案的 diff 全文、HEAD、claude `2.1.278` 都在 `ab2/provenance.txt`；porcelain 前後都只有未追蹤檔，`stage.agents` 最後設回 `false`。

| arm | 時間（秒） | 花費（`modelUsage`） | output tokens | cache read | subagents | 主 session 在最後一輪的 context |
|---|---|---|---|---|---|---|
| old3 | 37 | $0.64 | 3,069 | 210,335 | 無 | 62,928 |
| nor1 | 334 | $1.82 | 22,568 | 1,728,533 | 1 brain | 54,399 |
| old4 | 48 | $0.68 | 3,884 | 315,048 | 無 | 59,062 |
| nor2 | 313 | $1.70 | 24,034 | 1,578,998 | 1 brain | 57,969 |

數字來自 `ab2-table.txt`、`ab2-context.txt` 與 `ab2-tools.txt`，產生它們的是同目錄的 `ab-table.js ab2 old3 nor1 old4 nor2`、`ab-context.js ab2` 與 `ab2-tools.js`。

組內比較（nor／old）：

| 組 | 時間 | 花費 | output tokens |
|---|---|---|---|
| 3 | 9.0× | 2.8× | 7.4× |
| 4 | 6.5× | 2.5× | 6.2× |

- **兩個 nor 臂都沒有 reader。** `<session>/subagents/` 裡只有一個 `fankeel-brain`。
- **主控很便宜。** nor 臂裡只有主控是 Sonnet，花 $0.23 與 $0.25；大腦（Opus）花 $1.59 與 $1.46。主控在關卡時的 context 是 54,399 與 57,969，比同組舊模式少 8,529 與 1,093。
- **時間與花費都在大腦。** 大腦的 transcript 從頭到尾 283 與 259 秒，用了 34 與 48 次工具。舊模式的主 session 整站 5 與 6 次（含 `task.js start` 那一次），第一個 survey 指令就把 `orient.js`、`map.js`、`survey.js --tree` 與掃描串在同一個 Bash 裡。大腦把步驟拆開做：nor1 是 31 次 Bash，nor2 是 20 次 Bash 加 27 次 Read 與 Grep。
- **reader 花的是錢，不是時間。** 跨批只能粗看（兩批的舊模式都落在 $0.58–0.79、31–48 秒）：派 reader 的 new 臂花 $2.33–4.42、278–388 秒，不派的 nor 臂花 $1.70–1.82、313–334 秒。
- **n=2**，理由同第 4 節。

## 6. 還沒量到的

- 兩邊寫出來的 survey 誰比較完整、比較對。這兩組只量時間、花費與 context；大腦多用的工具次數換到了什麼，沒有人比過。
- 一站大到會把 context 撐開的情形（build），也就是設計頁想省的那一種；survey 撐不開。
