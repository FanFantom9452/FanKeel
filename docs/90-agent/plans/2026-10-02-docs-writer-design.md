---
status: design-intent
last_verified: 2026-10-02
---

# 寫文件的 writer 與寫程式的提煉：規則放在派出去的 agent 收得到的地方

session 15377bbe-2490-4bc7-a303-dbbdb6c1c290 的 design。survey（`.fankeel/build/task-20261002T090238/survey.md`）的 gate 使用者選「design：skill 加 writer agent」；design gate 上使用者再補兩點：docs 用 writer、coding 要提煉 ponytail 的功能與原理而不依賴它；主 session 現在什麼都派出去，規則怎麼注入要重新想。這頁描述要做成的樣子，不是現在的樣子。

問題一：人讀的頁太短，不是太長。`docs/01-guide/profile.md` 列了每個 key 的意思與可選值，卻沒寫為什麼要設、一個完整的例子；`docs/02-architecture/pipeline.md` 是好的基準。sepia 只有刪減，它的「長度與利害成比例，兩個方向都算」（`professional-pass.md` 第 18 行）是我們要的那一半。

問題二：ponytail 的 review 與 audit 已收成 reviewer 的 `## Cuts`（`agents/fankeel-reviewer.md:69-91`），那是寫完之後才看；寫的當下的原理沒收進來。

## 1. 注入：規則放在 agent 收得到的那一層

- 不做按需 skill。subagent 不繼承 skill（`docs/03-decisions/2026-09-20-survey-brain.md:26`），SubagentStart 的 brief 也不帶 skill 全文（`lib/render.js:676-701`）；主 session 把事派出去以後，只在主 session 觸發的 skill 到不了寫的人。
- writer 的規則寫進 `agents/fankeel-writer.md` 本文：agent 檔本文就是它的 system prompt，每次派都在，不必多讀一個檔，也不佔 brief 的字數。
- 寫程式的 implementer 是 `general-purpose`，沒有自己的 agent 檔；它一定收到的是 `ledger.js brief --prefix` 的 `FOOTER`（`scripts/ledger.js:139-148`，經 `agents/fankeel-brain.md:60-63` 貼在每個 implementer prompt 開頭）。提煉的規則加在那裡；同一組 prefix 位元組相同，吃得到 prompt cache。
- 不用 agent 檔的 `skills:` 預載：repo 裡只有一句話說它可以（`docs/03-decisions/2026-09-20-survey-brain.md:26`），沒有量過，plugin agent 上的行為未確認。

## 2. fankeel-writer agent（docs）

- 新檔 `agents/fankeel-writer.md`：`tools: [Read, Grep, Glob, Edit, Write]`，沒有 Bash；`model: sonnet`，`effort: medium`。本文寫下面五條，`skills/fankeel-explain/SKILL.md` 已有的（一句話先行、結論→理由→證據→範例、未知寫未知）只用一句指向，不重抄。
- 動筆前三行前置，交稿前刪掉：讀者是誰、讀完能做到什麼、事實清單——每條附 `path:line`，取自頁面 `source_of_truth` 列的檔案；清單外的事不寫。
- 每一節三件套：它做什麼、為什麼這樣（取捨或它防止的事故）、一個能照抄的例子；缺的要補，不是刪。
- 雙向刪除測試：刪掉某段讀者不會少做到任何事就刪；刪掉後讀者做不到「讀完能做到什麼」裡的一件，就不能刪。
- 先讀同目錄兩到三頁當語氣基準；繁中排版四條：引號「」『』、破折號──、刪節號……、中文旁用全形括號；路徑與識別字用 code，不翻譯。生成區塊（例如 `<!-- PROFILE_TABLE:START -->` 到 `END`）不動。
- 拒絕：目標不在 `docs/01-guide/` 也不是 `README.md`、一次超過一頁、沒給頁面路徑；拒絕時不改任何檔。回傳改了哪頁、補了哪幾節、哪些事查不到出處而沒寫，每項一行。
- `.claude-plugin/plugin.json` 的 `agents` 加上它；`tests/agents.test.js` 的 `NAMES`（:10）、`MAY_WRITE`（:32，`['Edit', 'Write']`）、effort 表（:228）各加一筆；`docs/90-agent/reference/subagents.md` 加一列，數 agent 個數的字跟著改。

## 3. 寫程式的提煉（取自 ponytail，不依賴它）

- `FOOTER` 加四條，只收寫的當下有用、fankeel 還沒有的原理（來源 `~/.claude/plugins/marketplaces/ponytail/skills/ponytail/SKILL.md`，出貨檔不提這個名字，`tests/source.test.js:220`）：
- 先讀懂再縮：讀完任務與它碰到的每個檔、走一遍實際流程，再挑最小的寫法；最小的改動放錯地方是第二個 bug（原 :44-48、:97-101）。
- 先找這個 repo 已有的 helper、型別或寫法再動手；重寫幾個檔之外就有的東西是最常見的浪費（原 :37）。
- 修 bug 先 grep 這個函式的每個呼叫者，修在共用的那一處，不是只修工單點名的那條路（原 :50-54）。
- 兩個一樣短的寫法，挑邊界情況正確的那個；信任邊界的檢查、防資料遺失的錯誤處理、安全措施不在可省之列（原 :63、:90-92）。
- `skills/fankeel-design/SKILL.md:74-78` 的階梯在第 1、2 階之間加一階「這個 repo 已經有」，對齊上面第二條。
- 不收：人設、強度模式與三個 hook、`ponytail:` 註解標記、gain 與 help——`docs/03-decisions/2026-09-24-optimise-own-first.md:33-38` 已逐條判過不收；「留一個可跑的檢查」與「回傳精簡」已由 `FOOTER` 的紅燈先行與回傳格式涵蓋（`scripts/ledger.js:146-147`）。

## 4. 試點與盲測

- writer 落地後改寫 `docs/01-guide/profile.md`，表格外的文字補上為什麼與例子。
- 盲測：派一個只拿到該頁、不准讀別的檔的 reader，答三題——「哪一層的值蓋過哪一層」「為什麼建議把 `stage.agents` 設成 `survey`」「替這個專案把 `language` 設成繁體中文要打哪條指令」。改寫前後各跑一次，改寫前至少錯一題、改寫後全對，問題與兩次回答記進 verify 的 evidence。
- 不做 warn-only lint：機械規則只能數字數或 code block，量不到讀者做不做得到。

## 測試

- 現在失敗、之後通過：`tests/agents.test.js` 的 `NAMES` 加 `fankeel-writer`；`tests/ledger-brief-prefix.test.js` 加一個測試，斷言 prefix 含「每個呼叫者」那條與「已有的 helper」那條；兩者在改動前都失敗。
- 全套 `node --test` 顯示 `ℹ fail 0`；`node scripts/docs-check.js` 不報新 agent。
- 產出物那一列：第 4 節的盲測。

## 留待決定

- writer 要不要寫進 stage agent 可派的名單（`lib/stages.js:709-711` 的 build、audit）。本設計不接：每個 stage 的 brief 有 2400 上限，先用試點證明它值得。
