---
status: design-intent
last_verified: 2026-09-09
---

# 不要廣告更強的模型：把判官改成使用者叫的 `/fankeel-ask`

**目標：** 注入區塊裡不再有任何一行提到 `fankeel-judge`。要不要花 Fable 的錢，
是使用者在當下打一個指令決定的，不是模型在階段中途自己判斷的。

**一句話：** 刪掉四個 stage 上的 `JUDGE_RULE` 與 profile 的 `judge.enabled`，
新增第九個 skill `skills/fankeel-ask/SKILL.md` —— 使用者主動呼叫，強制中斷當下
的 stage，派一次 `fankeel-judge`，把答案逐字歸檔，然後回到原本的 stage 繼續。

**為什麼不是「換成一行指路的句子」：** 指路的句子仍然是廣告。現行規則的措辭是
`An in-stage question **goes to** fankeel-judge once` —— 用的是 goes，不是 may
go，讀起來像預設路徑。一條每個 prompt 都出現、宣告「有個更強的模型可以叫」的
規則，會讓主 agent 把判斷外包出去；Opus 5 不需要那個台階。

**不做：** transcript 驗證（`judge.js record` 檢查這個 session 底下真的有
`fankeel-judge` 的 subagent transcript）。它擋的是反方向的失敗 —— 模型宣稱派了
其實自己回答；使用者主動打指令時人在現場，風險小。進 `TODO.md` 的 `## Waiting`。
也不動 `scripts/judge.js` 與 `agents/fankeel-judge.md`：agent 與歸檔器本身沒有問題，
有問題的只有觸發方式。

## 1. 刪除條件規則

- `lib/stages.js:140` 的 `JUDGE_RULE` 常數與 `:132-139` 的註解整段刪除。
- `lib/stages.js` 的 `:234 :262 :289 :314` 四個 `when: [JUDGE_RULE]` 條目刪除；
  四個 stage 的其他 `when` 條目不動。
- `lib/stages.js:436` 的 `judge: '{{JUDGE}}'` token 與 `lib/render.js:46`
  `SCRIPTS` 的 `judge` 項一併刪除 —— 沒有規則再展開它。新 skill 用
  `<plugin>/scripts/judge.js` 的散文寫法自己解析路徑，跟其他八個 skill 一樣。

## 2. 刪除 `judge.enabled`

- `lib/profile.js:22` 的 `judge.enabled` 從 `KEYS` 刪除。
- `lib/profile.js:146` 的 summary 清單去掉這個鍵；`judge.model` 留著，新 skill
  讀它決定派哪個 model。
- 不提供替代開關。觸發權在使用者手上，不想派就不要打那個指令；一個只會讓使用者
  自己打的指令失敗的開關，是下一個人一定會誤讀的東西。

## 3. 新 skill：`/fankeel-ask`

- 新檔 `skills/fankeel-ask/SKILL.md`，frontmatter 帶 `name`、`description`、
  `version`（`scripts/version.js` 是用找的，第九個 skill 自動納入十一處版本檢查）、
  `status: current`、`last_verified`、`source_of_truth: scripts/judge.js`。
- 語意是**強制中斷**：在 stage 進行到一半被叫，它打斷當下的工作，派出去，把回來
  的判斷當作這個 stage 的輸入接受，然後回到原本的 stage。它不是背景幫手，也不
  開閘門 —— 閘門仍然在 stage 結束時由使用者開。
- 四個步驟，順序不可換：寫 brief → 派 `subagent_type: fankeel-judge`、model 讀
  profile 的 `judge.model`（永不繼承）→ `node <plugin>/scripts/judge.js record`
  用 stdin 餵答案 → 用一句話說接受了什麼判斷，回到 stage。
- brief 寫在 `.fankeel/build/ask/<n>-<slug>-brief.md`。`build/` 已經在
  `.fankeel/.gitignore` 裡，所以不新增任何被忽略的名字。
- 沒有 active 任務時不需要自己擋：`judge.js record` 本來就會拒絕
  （`scripts/judge.js:78`，`No active entry`）。skill 只要說會這樣即可。

## 4. 判準寫給使用者，不寫給模型

- 「什麼時候值得叫 Fable」的判準寫進 `README.md`，不進任何模型每次都讀得到的
  地方。理由：判準若進注入區塊就變回廣告；若只寫在 skill 內文，使用者已經決定
  要叫了才讀得到，來不及發揮作用。
- `README.md` 同時新增 `/fankeel-ask` 一行，放在既有的腳本／指令表旁邊。
- `skills/fankeel/SKILL.md:1010-1036` 的 `### The judge` 整節刪除，換成一句指向
  新 skill 的話。`:35` 的目錄樹（`judgements/`）與 `:393-395` 的閘門點名判斷檔
  那段留著 —— 那兩處講的是歸檔與閘門，不是觸發。
- `docs/pipeline.md:325-334` 的 `when` 條款範例改用 `land.archivePlan` 那一組，
  judge 的例子刪掉。
- `docs/subagents.md:44-71` 的 judge 段改寫觸發方式，其餘（brief 的那一行、
  record 的用法、歸檔格式）不動。
- `docs/documents.md:128` 的 `build/<plan>/` 那一列補上 `build/ask/`，因為 brief
  不再只出現在有 plan 的任務裡；`docs/README.md` 補這份設計與它的 plan 兩列索引
  （新頁面在同一次改動裡拿到索引列，`CONTRIBUTING.md` 的文件那一列這樣要求）。
  `docs/README.md:54-55,83,108-111` 不動 —— 那些是 archive 與 decision 頁的索引
  摘要，記錄的是當時的做法，以及 `## Judgements` 本身，改動後仍然為真。

## 5. 測試與成功準則

- `tests/stages.test.js` 的 `:188 :693-695 :702-703 :712` 五處 `judge.enabled`
  斷言刪除，改成一條新的：builtin 層（不傳第三個參數）的 `survey`、`design`、
  `plan`、`build` 四個 stage，規則裡都不含 `fankeel-judge`。**今天紅，改完綠。**
- `tests/render.test.js` 的 `:206 :539-545` fixture 去掉 `judge.enabled`；
  `{{JUDGE}}` 展開的斷言一併移除。
- `tests/profile.test.js` 新增一條：`KEYS` 不含 `judge.enabled`。**今天紅。**
- artefact 那一列：`render()` 對 `build` 算出的注入區塊，`fankeel-judge` 字串
  不存在，且字元數比改前少 —— 兩個數字同源（`rulesFor()` 的條數與 render 出來
  的行數）必須一致。
- `node scripts/skills-check.js` exit 0。它的 control 是可失敗的：把新 skill 裡
  的 `judge.js` 引用拿掉，它必須 exit 1（`judge.js` 變成沒有任何 skill 找得到的
  腳本）。

## 檔案表

| 檔案 | 改動 | dispatch |
|---|---|---|
| `lib/stages.js` | §1 三項刪除 | implementer, sonnet |
| `lib/profile.js` | §2 兩處刪除 | implementer, sonnet |
| `lib/render.js` | `SCRIPTS` 的 `judge` 項刪除 | implementer, sonnet |
| `skills/fankeel-ask/SKILL.md` | 新檔，§3 全部 | in-session —— 產物本身，語氣要與其他八個 skill 一致 |
| `skills/fankeel/SKILL.md` | 刪 §The judge，換一句指路 | implementer, sonnet |
| `docs/pipeline.md` | `:325-334` 換範例 | implementer, sonnet |
| `docs/subagents.md` | `:44-71` 改觸發方式 | implementer, sonnet |
| `docs/documents.md` | `:128` 補 `build/ask/` | implementer, sonnet |
| `docs/README.md` | 這份設計與它的 plan 兩列索引 | implementer, sonnet |
| `README.md` | Fable 判準 + `/fankeel-ask` 一行 | in-session —— 判準是這次對話談出來的，沒有第二個人能重寫 |
| `TODO.md` | `## Waiting` 一條：transcript 驗證 | implementer, sonnet |
| `tests/stages.test.js` | §5 第一項 | implementer, sonnet |
| `tests/render.test.js` | §5 第二項 | implementer, sonnet |
| `tests/profile.test.js` | §5 第三項 | implementer, sonnet |

**不動，明說：** `scripts/judge.js`、`agents/fankeel-judge.md`、
`.claude-plugin/plugin.json` 的 `agents` 陣列、`.fankeel/docs.json` 的
`docs/judgements` bucket、`docs/decisions/2026-09-09-profile-judge-reader.md`
（decision 記錄一個時點，本來就可以點名已經不在的東西）、
`docs/improvement-brief.md`（report，是 0.53.0 的掃描快照）。

## 對照 map

`.fankeel/map.md` 列為 current 的頁面裡，`docs/pipeline.md` 與 `docs/subagents.md`
兩頁直接敘述這條規則，兩頁都在檔案表裡。沒有任何 current 頁面與這個做法衝突。
map 列為 `planned, not built` 的三頁中，兩頁是 judge 的設計與計畫，role 是
archive —— 它們描述的是舊的觸發方式，只需檢查沒有 current 頁面指著它們。

## 未驗證

- 移除 `{{JUDGE}}` token 與 `lib/render.js` 的 `SCRIPTS.judge` 之後，是否有測試
  在斷言 token map 的完整性（例如「每個 `SCRIPT_TOKEN` 都有對應的腳本」）。沒查。
  build 的第一個 task 跑完整套件就會知道。
