---
status: design-intent
last_verified: 2026-10-02
---

# 寫文件的 agent：fankeel-write skill 加 fankeel-writer agent

session 15377bbe-2490-4bc7-a303-dbbdb6c1c290 的 design。survey（`.fankeel/build/task-20261002T090238/survey.md`）的 gate 使用者選「design：skill 加 writer agent」。這頁描述要做成的樣子，不是現在的樣子。

問題：人讀的頁太短，不是太長。`docs/01-guide/profile.md` 列了每個 key 的意思與可選值，卻沒寫為什麼要設、設了會怎樣、一個完整的例子；`docs/02-architecture/pipeline.md` 是好的基準——先說用途，再說為什麼這樣設計（`/fankeel` 先掃描再問，因為空問題在多專案目錄要多兩輪），再給指令與輸出。sepia 只有刪減的 skill，沒有補寫機制；它的長度規則「長度與利害成比例，兩個方向都算」（`professional-pass.md` 第 18 行）是我們要的那一半。

## 1. fankeel-write skill

- 新檔 `skills/fankeel-write/SKILL.md`：寫或改寫一頁人讀的文件時載入；description 含 `Use for`，60 到 500 字元之間（`tests/skills.test.js:80-82`），觸發詞含 docs、guide、README、寫文件、改寫文件。
- 不重寫 `skills/fankeel-explain/SKILL.md` 已有的規則（一句話先行、結論→理由→證據→範例、未知寫未知、送出前只讀首尾行），只指向它，自己補「頁」才有的四件事，見下。
- 動筆前三行前置，寫在草稿最上方、交稿前刪掉：讀者是誰、讀完能做到什麼、事實清單——每條事實附 `path:line`，取自頁面 `source_of_truth` 列的檔案。清單外的事不寫進頁。
- 每一節三件套：它做什麼、為什麼這樣（取捨或它防止的事故）、一個能照抄的例子（指令與輸出，或一段設定）。缺「為什麼」或缺例子的節要補，不是刪。
- 刪除測試，兩個方向：逐段問「刪掉它，讀者會做不到哪件事」，答不出就刪；反過來，刪掉後讀者做不到「讀完能做到什麼」裡的任何一件，這段不能刪，再短也要補回。
- 先讀同一個目錄兩到三頁當語氣基準，`docs/02-architecture/pipeline.md` 是 fankeel 自己的標準；不照搬 sepia 的數字門檻。
- 繁中排版只收 `languages/zh.md` §0 與技術文件有關的四列：引號「」『』、破折號──、刪節號……、中文旁的括號用全形（　）；路徑、指令、識別字照原樣，用 code 寫，不翻譯。
- 範圍：`docs/01-guide/` 與 `README.md`。`docs/90-agent/`、`agents/`、`skills/` 是給 agent 讀的，維持壓縮，skill 明說不適用。
- 寫 code 的 agent 不載入它：implementer 改程式時不碰這個 skill，程式碼註解也不在範圍內——註解的讀者是下一個改程式的人或 agent，維持現有寫法（記事故與理由的短註解）。
- 生成區塊不動：`<!-- PROFILE_TABLE:START -->` 到 `END` 這類標記之間是腳本寫的，只能改標記外的文字。

## 2. fankeel-writer agent

- 新檔 `agents/fankeel-writer.md`：`tools: [Read, Grep, Glob, Edit, Write]`，沒有 Bash；`model: sonnet`，`effort: medium`；開頭第一步讀 `<plugin>/skills/fankeel-write/SKILL.md`，同 `agents/fankeel-mockup.md` 讀 design-guide 的寫法。
- 拒絕：目標頁不在 `docs/01-guide/` 或不是 `README.md`；一次超過一頁；brief 沒給頁面路徑。拒絕時不改任何檔。
- 回傳：改了哪一頁、加了哪幾節的為什麼與例子、事實清單裡查不到出處而沒寫的事——每項一行。
- `.claude-plugin/plugin.json` 的 `agents` 陣列加上它。
- `tests/agents.test.js`：`NAMES`（:10）、`MAY_WRITE`（:32，`['Edit', 'Write']`）、effort 表（:228，`medium`）各加一筆。
- `docs/90-agent/reference/subagents.md` 加一列；README 與 docs 裡數 agent 個數的字（`ten`）跟著改。

## 3. 連動的名單與計數

- `tests/inventory.test.js` 的 `SKILLS` 加 `fankeel-write`，排序後 `skills/` 與它一致。
- 帶版本號的檔多一個：`tests/contract.test.js` 的計數、`tests/version.test.js`、`scripts/version.js` 註解、`CONTRIBUTING.md`、`docs/01-guide/development.md`、`skills/fankeel-land/SKILL.md` 的字數一起動（前例 `docs/99-archive/2026-09-13-explain-skill.md` Task 3 第 5 步）。
- `node scripts/stage-registry.js` 重生 `skills/registry.json`。

## 4. 試點與盲測

- writer 落地後改寫 `docs/01-guide/profile.md` 一頁，表格外的文字補上為什麼與例子。
- 盲測：派一個只拿到該頁、不准讀別的檔的 reader，回答三題——「哪一層的值會蓋過哪一層」「為什麼要把 `stage.agents` 設成 `survey`」「替這個專案把 `language` 設成繁體中文，要打哪條指令」。改寫前後各跑一次，改寫前至少一題答不出或答錯，改寫後三題全對；問題與兩次回答記進 verify 的 evidence。
- 不做 warn-only lint：要 lint 的是「有沒有為什麼、有沒有例子」，機械規則只能數字數或數 code block，等於照搬 sepia 的數字；盲測才量得到讀者做不做得到。

## 測試

- 現在失敗、之後通過：`tests/agents.test.js` 與 `tests/inventory.test.js` 加上新名字後，`node --test tests/agents.test.js tests/inventory.test.js` 在兩個檔不存在時失敗。
- 全套 `node --test` 顯示 `ℹ fail 0`；`node scripts/docs-check.js` 不報新 skill 與新 agent。
- 產出物那一列：第 4 節的盲測。

## 留待決定

- writer 要不要寫進 stage agent 可派的名單（`lib/stages.js:709-711` 的 build、audit），讓 plan 的 docs task 與 audit 的頁面修正走它。本設計不接：每個 stage 的 brief 有 2400 上限，先用試點證明它值得，再加。
