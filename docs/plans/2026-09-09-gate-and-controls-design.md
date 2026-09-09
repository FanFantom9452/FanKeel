---
status: design-intent
last_verified: 2026-09-09
source_of_truth: docs/improvement-brief.md 第三部 items 6-8, §5.3, §4.2；survey 的盤點在本檔第 0 節
---

# 閘門、污染控制、profile 證據 — 設計

四件在一個 route 上，因為它們共用一個成立條件：**簡報寫下來的形狀要先對得上這棵樹**。
survey 發現其中三處對不上，設計就是照對得上的那個版本做。

## survey 量到的底（前提，不是承諾）

- `scripts/` 14 支，skills 與 `lib/stages.js` 點名 12 支；`eval.js`、`tmp-clean.js`
  一次都沒有。TODO 條目寫的「釘八支」不是這棵樹的數字。
- 九支用 Node `parseArgv` 且**全部** `strict: false`，每支都有註解說是刻意的；
  `survey.js:453`、`station.js:44`、`todo-check.js:370` 是手寫 parse，沒有 options 表。
  兩種形態，所以「讀得到 flag 表」不能當作前提。
- skills 點名的 flag 今天**全部**被對應的 script 接受（`version.js:166`、
  `survey.js:454-478`、`task.js:174-178` 抽樣驗過）。這條檢查今天是綠的。
- `scripts/eval.js:56,104` — `--model` 預設 `sonnet` 且一定附上；`:99` 與
  `lib/eval.js:64,75` 只取 `result.result` 與 `tool_use`，沒有一處讀 cost。
- `claude --help:123` 的旗標叫 `--max-budget-usd`；簡報 §5.3 寫的 `--budget-usd`
  是 i-have-adhd 那支 Python runner 的名字，照抄會是死旗標。
- `.fankeel/sessions/` 106 筆：`project` 0、`guard` 0、`class` 70。簡報 §4.2 說
  registry「有 task / project / route / class / guard」——`project` 與 `guard` 是
  schema 上有、資料裡從來沒有。

## 1. 閘門：`skills-check.js` 加 `lib/skills.js`

照 `docs-check.js` / `lib/docs.js` 的分離：純函式在 lib，argv、掃描與報告文字在 CLI，
exit code 由 findings 數決定（`docs-check.js:462-469`）。

- **Discovery**：掃 `skills/**/SKILL.md` 與 `lib/stages.js`，抽出每個
  `scripts/<name>.js` 與每個 `--flag`。新增一個 skill 自動被納入，不必登記。
- **Required core**：今天被點名的 12 支必須繼續被點名。一支從清單上消失，不是刪檔
  忘了改文件，就是一條規則失去了它的 script——兩種都要有人看一眼。
- **形態錯 ≠ 不存在**：沒有 `<plugin>/` 前綴的裸散文引用（`layout.js` 兩處、
  `survey.js:309`、`task.js:610`、`residue.js` 在 survey:64）算被點名，但另外報一行
  形態，不與「不存在」混為一談。
- **空結果是失敗**：掃出零個 script 引用就 exit 1。零代表掃描壞了，不代表 skills 乾淨。
- **flag 反向檢查**：skill 點名的每個 flag，對應 script 要收。這是 `strict: false`
  之下唯一能抓到規則裡打錯字的東西——runtime 不會抱怨，flag 只是靜靜沒作用。
  兩種 parse 形態都要讀：options 表的 key，和 `a === '--x'` 的比較。

失敗的四類：點名的 script 不存在、點名的 flag 不被接受、required core 掉出清單、掃描
為空。只報不失敗的兩類：形態錯的裸引用，和 `scripts/` 裡沒被任何 skill 點名的檔
（`eval.js`、`tmp-clean.js` 在 README 裡，不是缺陷）。

**放哪裡**：`skills/fankeel-land/SKILL.md` 的步驟裡點名它。`lib/stages.js` 的 land 規則
只在量過位元組還有空間時才加一句——注入區塊有上限，build 階段量，不預設有空間。

## 2. 污染控制：`eval.js` 的兩條

六條通道裡 1、2、6 已經做到（`mkdtempSync`、`--setting-sources project`、
`allowed_tools`），第 3 條在 fankeel 沒有對應物（沒有持續性的 always-on flag）——
那是答案，不是缺口，要寫下來以免下一個人再找一次。剩兩條：

- **通道 4**：拿掉 `'sonnet'` 預設，沒給 `--model` 就拒跑並說出原因。今天沒釘會靜靜
  變成 sonnet，於是一次模型 rollout 讀起來會像 plugin 回歸。README:320 與
  behaviour-eval 計畫裡的用法本來就都帶 `--model`，所以文件不用改用法，只改契約。
- **通道 5**：從 stream-json 的 result 讀出花費與 usage 一起報，並把
  `--max-budget-usd` 透傳給 `claude`。名字用 CLI 真正有的那個。

## 3. profile：先產證據，不碰格式

格式（存哪、有哪些欄）是決定，不在這捆裡。這捆交付的是讓那個決定有底的東西：一份
dated report，記下 106 筆到底有什麼、沒有什麼，以及 land 的答案實際上在哪
（`git log --merges` 十筆全是本地 `merge:`，無 PR；`skills/fankeel-land/SKILL.md:154-162`
每次仍問三選一）。並在簡報 §4.2 補一行指向它，因為那一節對 registry 的描述被資料推翻了。

> **勘誤（2026-09-09，build 之後）**：上一段括號裡的兩個數字都是錯的，而它們是 survey
> 帶進來的前提，不是設計決定。`git log --merges` 是 **49** 筆，47 筆 `merge:` 開頭、
> 2 筆 `Merge branch 'main' into <branch>`、0 筆 pull request——十筆那個數字來自
> `| head` 截斷過的輸出。行號在 build 期間位移到
> `skills/fankeel-land/SKILL.md:165-170`。結論沒有變：land 的答案在 git 而不在
> registry。正確的數字與那個方法陷阱記在
> [profile 證據](../reports/2026-09-09-profile-evidence.md)。

## 4. `sources.md` 缺的那列

補第 16 列給 `2026-09-09-design-axis-inventory.md`，Scope 欄寫它量的範圍：掃描對象是
這台機器上安裝的 skill 而不是本 repo，原文照抄未改寫，所以結果不隨本 repo 的程式碼變化。
標題的計數與導言那句一起改。profile 那份報告落地時再加一列，所以這個檔在這捆裡被碰兩次
——合成一次編輯，不是兩個可以並行的任務。

## 5. 成功準則

- `node scripts/skills-check.js` 在今天這棵樹上 exit 0；把某條規則的 flag 改成
  `--rnage` 的複本上 exit 1，且訊息指到那一行。先紅後綠，只動一個變數。
- `node scripts/eval.js evals/route-typo` 不帶 `--model` 時 exit 非零並說出缺什麼；
  帶 `--model sonnet` 時跑得起來且輸出帶一個花費數字。
- **成品自檢**：`docs/sources.md` 標題裡的數字與兩張表實際的列數相等——把數字讀出來、
  把列數數出來，兩邊要對上。單元測試不會看這個。
- `node --test tests/` 全綠（spec reporter 看 `ℹ pass|fail`，沒有 ok 行）。

## 6. 對照 map

`.fankeel/map.md` 唯一 planned-not-built 的是 `docs/plans/2026-09-09-design-class-prompt.md`，
這捆一個字都不碰它。沒有衝突。`docs/improvement-brief.md` 在 map 上是 undeclared，
它拿到的是一行 §4.2 補記，不是把一份 current 的頁面改成相反的話。

## 7. 沒驗過的那一件

flag 反向檢查今天抓不到任何東西——抽樣過的旗標全部被接受。它是回歸護欄，不是抓蟲工具，
所以它的紅臂只能靠 verify 階段造一個 mutation 生出來，不是在野外觀察到的。這件事寫在
這裡，免得驗收時把「綠的」讀成「有效的」。
