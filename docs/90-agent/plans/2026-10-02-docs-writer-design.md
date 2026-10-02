---
status: design-intent
last_verified: 2026-10-02
---

# 按角色拆專屬 agent，並讓每一棒接得上前一棒

session 15377bbe-2490-4bc7-a303-dbbdb6c1c290 的 design。survey（`.fankeel/build/task-20261002T090238/survey.md`）的 gate 使用者選「design：skill 加 writer agent」；design gate 上使用者再定了方向：每種工作有自己的專屬 agent、分工明確、拆細；跟人傳達事情的 agent 不能寫得太精簡；寫程式要精簡、少註解，原理取自 ponytail 但不依賴它；多一點注入 token 可以接受。最後一輪選「design：拆得更細」，並要求寫清楚每個專屬 agent 怎麼接前一棒，且 survey 與 design 要把讀過的事實記進 `context.md`，拆細後新的 agent 不必每個都重讀專案。這頁描述要做成的樣子，不是現在的樣子。

## 1. 規則放在 agent 一定收得到的地方

- 不做按需 skill。subagent 不繼承 skill（`docs/03-decisions/2026-09-20-survey-brain.md:26`），SubagentStart 的 brief 也不帶 skill 全文（`lib/render.js:676-701`）；主 session 把事派出去以後，只在主 session 觸發的 skill 到不了做事的人。
- 每個角色的規則寫在它自己的 agent 檔本文：本文就是它的 system prompt，每次派都在。
- 不用 agent 檔的 `skills:` 預載：repo 只有一句話說它可以（同上 :26），沒量過。

## 2. 接棒：事實記一次，後面每一棒都讀得到

- 現況：`scripts/context.js` 是 `context.md` 唯一的寫入者，一行一個事實加 `path:line` 與 sha，最多 40 行（`scripts/context.js:23`）；每個 subagent 的 brief 都附上它（`lib/render.js:637-642`），implementer 的 `ledger.js --prefix` 也以它開頭。只有 reader 被要求寫（`agents/fankeel-reader.md:69-73`）；自己讀檔的 survey 與 design brain 沒有，所以這個 task 的 `context.md` 不存在，design 重讀了 survey 已讀過的七個檔。
- survey 與 design 的 brain 交出 handoff 前，把自己讀過、後面幾站還會用到的事實逐條 `node <plugin>/scripts/context.js add "<fact>" --at <path:line> --session <id>`；寫進 `agents/fankeel-brain.md`，以及 `skills/fankeel-survey/SKILL.md`、`skills/fankeel-design/SKILL.md`（主 session 自己跑這兩站時用）。
- 每一棒拿到的東西，寫進各自的 agent 檔「你從哪裡接手」一節：
- writer：brief 裡的 `context.md`、要改的頁面路徑、頁面 `source_of_truth`；事實清單從 `context.md` 起算，缺的才自己讀。
- implementer：`ledger.js --prefix`（`context.md`、該組的 Files 與 Interfaces，含 `path:line`）加自己的 task 全文；Files 沒列的檔回 `blocked:`，不自己找（`scripts/ledger.js:139-148`）。
- mutator：verify brain 給的一列 evidence——要改的 `path:line`、改成什麼、要跑的測試指令。
- mover：audit 或 land brain 給的路徑清單與要做的動作，不讀檔案內容。
- 每個專屬 agent 讀到、且後面還用得到的新事實，同樣用 `context.js add` 記下，再回傳。

## 3. 兩種口吻：對人說、對 agent 說

- 對人說的 agent——`fankeel-writer`（docs 頁）與 `fankeel-brain`（報告與 gate）——寫完整句子：先講結論，再講為什麼，詞第一次出現要說它是什麼，不省連接詞，不用只有寫的人懂的代號。`agents/fankeel-brain.md` 加一節「報告是給人讀的」。
- 回給 agent 的——reader、reviewer、verifier、implementer、mutator、mover、fixer——維持現有的精簡回傳格式，不改。

## 4. fankeel-writer（docs，對人）

- 新檔 `agents/fankeel-writer.md`：`tools: [Read, Grep, Glob, Edit, Write, Bash]`（Bash 只為 `context.js add`），`model: sonnet`，`effort: medium`。
- 動筆前三行前置，交稿前刪掉：讀者是誰、讀完能做到什麼、事實清單——每條附 `path:line`；清單外的事不寫。
- 每一節三件套：它做什麼、為什麼這樣（取捨或它防止的事故）、一個能照抄的例子；缺的要補，不是刪。長度跟利害成比例，兩個方向都算（sepia `professional-pass.md` 第 18 行）。
- 雙向刪除測試：刪掉某段讀者不會少做到任何事就刪；刪掉後讀者做不到「讀完能做到什麼」裡的一件，就不能刪。
- 先讀同目錄兩到三頁當語氣基準；繁中排版四條：引號「」『』、破折號──、刪節號……、中文旁用全形括號；路徑與識別字用 code。生成區塊（例如 `<!-- PROFILE_TABLE:START -->` 到 `END`）不動。
- 拒絕：目標不在 `docs/01-guide/` 也不是 `README.md`、一次超過一頁、沒給頁面路徑；拒絕時不改任何檔。

## 5. fankeel-implementer（build 寫程式，精簡）

- 新檔 `agents/fankeel-implementer.md`，取代 build 派的 `general-purpose`：`tools: [Read, Grep, Glob, Edit, Write, Bash]`，`model: sonnet`（Dispatch 行指名別的模型時照 Agent 的 `model` 參數），`effort: medium`。
- 本文收 ponytail 寫的當下的原理（來源 `~/.claude/plugins/marketplaces/ponytail/skills/ponytail/SKILL.md`；出貨檔不提這個名字，`tests/source.test.js:220`）：先讀懂任務與它碰到的流程再挑最小寫法（原 :44-48）；先找 repo 已有的 helper、型別、寫法（原 :37）；修 bug 先 grep 每個呼叫者、修在共用處（原 :50-54）；兩個一樣短的寫法挑邊界正確的，信任邊界檢查、防資料遺失、安全措施不省（原 :63、:90-92）；不加沒人要的抽象、設定、鷹架（原 :58-59）。
- 少註解：只在程式碼說不出的地方寫——為什麼這樣、防的是哪次事故或哪個限制；不寫重述程式在做什麼的註解，不替沒改的程式補註解或 docstring。
- 回傳格式沿用 `scripts/ledger.js:139-148` 的 `FOOTER`。

## 6. fankeel-mutator（verify 跑 mutation）

- 新檔 `agents/fankeel-mutator.md`，取代 verify 派的 `general-purpose`（`lib/stages.js:710`）：`tools: [Read, Edit, Bash]`，`model: sonnet`，`effort: low`。
- 只做三件事：照給的 `path:line` 套上 mutation、跑給的測試指令、把檔案還原；回傳 mutation 前後測試的 `ℹ pass`／`ℹ fail` 行，以及還原後 `git diff --stat` 為空的證明。
- 拒絕：給的 mutation 超過一處、測試指令不是 `node --test` 開頭；不改其他檔。

## 7. fankeel-mover（audit、land 搬檔與 git 寫入）

- 新檔 `agents/fankeel-mover.md`，取代 audit 與 land 派的 `general-purpose`（`lib/stages.js:711-712`）：`tools: [Read, Bash]`，沒有 Edit 與 Write，`model: sonnet`，`effort: low`。
- 只做給的動作：`git mv`、merge、刪掉指名的檔；不改任何檔案內容。回傳每個動作的指令與結果一行。

## 8. 換線與名單

- `lib/stages.js:709-712` 的四個 implementer 字串改成 `fankeel:fankeel-implementer`、`fankeel:fankeel-mutator`、`fankeel:fankeel-mover`；writer 加進 build 與 audit 的名單；`agents/fankeel-brain.md:57` 起那段與 build skill 派 implementer 的句子同步。
- `.claude-plugin/plugin.json` 的 `agents` 加四個；`tests/agents.test.js` 的 `NAMES`（:10）、`MAY_WRITE`（:32）、effort 表（:228）各加四筆；`docs/90-agent/reference/subagents.md` 加四列、改掉「implementer 是 general-purpose」，數 agent 個數的字跟著改。
- `skills/fankeel-design/SKILL.md:74-78` 的階梯在第 1、2 階之間加一階「這個 repo 已經有」。
- 不收：人設、強度模式與三個 hook、`ponytail:` 註解、gain、help——`docs/03-decisions/2026-09-24-optimise-own-first.md:33-38` 已判過。

## 9. 試點與盲測

- writer 落地後改寫 `docs/01-guide/profile.md`，表格外的文字補上為什麼與例子。
- 盲測：派一個只拿到該頁、不准讀別的檔的 reader，答三題——「哪一層的值蓋過哪一層」「為什麼建議把 `stage.agents` 設成 `survey`」「替這個專案把 `language` 設成繁體中文要打哪條指令」。改寫前後各跑一次，改寫前至少錯一題、改寫後全對，問題與兩次回答記進 verify 的 evidence。

## 測試

- 現在失敗、之後通過：`tests/agents.test.js` 的 `NAMES` 加四個新名字；`tests/brief.test.js` 斷言 build、verify、audit、land 的可派名單不含 `general-purpose`，且各含對應的專屬 agent；`tests/agents.test.js` 斷言 `agents/fankeel-brain.md` 的 survey、design 段含 `context.js add`。
- 全套 `node --test` 顯示 `ℹ fail 0`；`node scripts/docs-check.js` 不報新 agent。
- 產出物那一列：第 9 節的盲測；另跑一次 survey，結束時 `context.md` 至少有一行來自 survey brain。

## 另一件：依任務決定 effort（不在本設計內）

- Agent 工具設不了 effort，只有 agent 檔的 `effort:` 可以（`docs/90-agent/reference/model-choice.md:40`）。現有的路是 `task.js profile set agent.<name>.effort` 寫覆寫檔，`hooks/title.js:28-29` 把 `fankeel:<name>` 改送到它（`lib/agentfile.js:50-64`）——按角色，不是按任務。
- 按任務的做法：每個 agent 預先生成幾個 effort 版本的覆寫檔，plan 的 Dispatch 行多寫一個 effort，`hooks/title.js` 照它改寫 `subagent_type`。動到 `lib/agentfile.js`、`lib/plantasks.js`、`hooks/title.js`，與本設計不共用檔案，另開一輪 design。
