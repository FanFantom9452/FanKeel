---
status: current
last_verified: 2026-09-10
source_of_truth: skills/fankeel-ask/SKILL.md, lib/stages.js, lib/profile.js, scripts/judge.js
---

# 廣告與工具的差別：判官改成使用者自己叫

`fankeel-judge` 上線一天就被指出一個問題，而且不是花費的問題。四個 stage 的注入
區塊裡各有一條規則寫著「階段內的問題會交給 `fankeel-judge` 一次」——**用的是
「會」，不是「可以」**——所以它讀起來是預設路徑。一條每次 prompt 都在說「有更強的
模型可以幫你想」的句子，是在邀請跑這個 session 的模型讓位。使用者的話：跑這個
session 的模型沒有差到需要這根拐杖，只有某些特定任務才需要 Fable。

落地在 2026-09-10 的 `judge-to-ask` 分支，spec 與七個 task 的 plan 在
`docs/archive/`。它取代了
[profile、judge、reader 的決定](2026-09-09-profile-judge-reader.md)裡關於判官
觸發方式的那一段；那份記錄的其他部分沒有動。

## 決定了什麼

- **規則整條刪，不是改短。** `lib/stages.js` 的 `JUDGE_RULE`、掛著它的四個
  `when` 條目、`SCRIPT_TOKENS` 的 `{{JUDGE}}`、`lib/render.js` 的
  `SCRIPTS.judge` 全部移除。改成一句指路也不行：一條每次 prompt 都出現的指路句
  仍然是廣告，只是短了一點。今天七個 stage 加 `ALWAYS` 加 `INIT` 渲染出來，
  沒有一條規則提到判官。
- **`judge.enabled` 刪掉，不是留成開關。** 一個「我都要主動呼叫了還要開關」的鍵
  本身就尷尬；留著它還會讓人以為關掉了就叫不動。手寫進 `.fankeel/profile.json`
  會被 `profile.read` 靜靜丟掉，`KEYS` 現在是六個鍵。`judge.model` 留著，因為
  「叫的時候用哪個模型」是真的要答的問題。
- **`/fankeel-ask` 是強制中斷。** 不是背景幫手、不是一邊做一邊拿第二意見：它停住
  這個 stage 正在做的事，花一次 dispatch，然後 stage 拿著答案繼續。它**永遠不開
  閘門**——閘門還是在 stage 結尾用 `AskUserQuestion` 問人。
- **skill 不自己擋。** 沒有任務時它照跑，由 `scripts/judge.js` 拒絕並說出 session
  與 registry root。兩層各自擋一次會讓錯誤訊息變成兩種說法。
- **判準寫給人讀。** `README.md` 有一節說什麼時候值得花這筆錢——Fable 每 token 約
  是 Opus 級距的兩倍，所以只有「一次有界的問題」這個形狀划算。這節**不進注入
  區塊**：進去就變回廣告。它指向 `lib/prices.js` 而不是抄一份價目。
- **`scripts/judge.js` 一行沒改。** 歸檔行為、`docs/judgements/`、索引列都照舊。
  換掉的只有誰按下按鈕。

## 途中改掉的兩件事

- **`lib/skills.js` 的空旗標表。** 新 skill 在一行裡寫出 `judge.js record` 的
  完整指令時，`skills-check` 報了三個 `unknown-flag`。量出來的原因不是猜的：
  `acceptedFlags()` 對 `judge.js` 回傳空集合，因為那支從 `FLAGS` 陣列動態組
  options 而不是字面量。空集合是「讀不到」，不是「什麼旗標都不收」——`classify()`
  加了 `.size`。舊的主 skill 只是靠折行躲過去。那支腳本的旗標從此不被檢查這件事
  進了 `TODO.md`。
- **版本號從十處變十一處。** 第九個 skill 讓 `scripts/version.js` 的分母動了。
  一次掃改不乾淨：reviewer 在五處、verify 在七處、fix round 在第八處各抓到一批，
  最後一處是一句從自己總數推算出來的話。過去式的軼事（「一個 release 曾經是十次
  編輯」）刻意留在十。

## 驗過什麼

- 七個 stage 加 `ALWAYS` 加 `INIT` 的規則，連把 `judge.enabled` 硬塞進 profile
  也渲染過，沒有一條提到判官；同一個探針植入字串會變紅，所以它有失敗的路。
- `judge.js record` 對沒有 active entry 的 session 拒絕、exit 1、一個檔都沒寫。
- 九條 ledger 範圍各一個 verifier 再接一個 adversary，四個 reader 讀 29 個
  reference 頁的漂移。文件那邊找到七行假句，全部是這次改動自己造成的，分兩輪
  修完，各有自己的 review 範圍。
- `npm test` 1285 全過；`docs-check`、`skills-check`、`todo-check`、`version.js`
  四支 exit 0。

## 留下的

- `/fankeel-ask` 本身沒有端到端叫過：安裝副本落後工作樹一個版本，指令要升版重裝
  之後才存在。
- `docs/collisions.md` 用「Two rules」領三條，第三條其實是另一個機制——進了
  `TODO.md` 的 `## Ready`，不是這次改動造成的。
- `docs.json` 把 `evals/` 標成 `reference`，所以四個 eval 素材被算成沒有契約的
  reference 頁——進了 `## Needs a decision`。
