---
status: design-intent
last_verified: 2026-09-26
---

# 六個待決定、mockup 專屬 agent、effort 建議、station 改版、docs tree 規則

session 8188d73a-68c2-4e79-a480-aedef022c391 的 design。它描述的是要做成的樣子，不是
現在的樣子。前端的部分由 `.fankeel/build/2026-09-26-station-redesign/mockup.html` 定方向，
gate 核准的是那一頁。

spec: `.fankeel/build/2026-09-26-station-redesign/mockup.html` — 逐塊（2026-09-26 design gate）

範圍外、另開任務：`/fankeel-audit` 擴充成定期清理機制（docs tree 合規、搬遷對照表、大
repo 分批、排程提醒），先搬 fankeel 自己的 docs 驗證，再跑 Trovara。這頁只在第 10 節
把它寫進 TODO。

## 1. render 注入上限

- `lib/stages.js:258` 的 mockup 規則開頭 `Frontend work gets a mockup first: ` 改成
  `Mockup first: `，省 21 字元；`when: 'design.mockup'` 已經表示只在有前端時出現，前綴
  是在重述觸發條件。
- `tests/render.test.js` 加一條：bounded route、`stage: 'design'`、`design.mockup` 開、
  沒有 `stage.agents`，`sizeAtReference(out) < BLOCK_CAP`。2026-09-26 重量是 2420。
- 規則原文被引用的地方（`docs/`、`skills/`、`tests/`）一起改，靠 grep 找，不靠記憶。

## 2. fankeel-mockup 專屬 agent

- 新增 `agents/fankeel-mockup.md`：`model: opus`、`effort: high`、工具 Read, Grep, Glob,
  Bash, Write, Edit；本文收下 fankeel-design skill 第 3 步裡跟實作者有關的部分——用專案
  自己的 CSS 和 render 出來的 DOM 起頭、每個改到的區塊掛 `data-block`、prompt 指名的
  design skill 先用 Skill 工具載入、只改被點名的那一塊。
- `.claude-plugin/plugin.json` 的 `agents` 和 `tests/agents.test.js` 的 `NAMES` 各加一筆。
- fankeel-design skill 第 3 步兩處派工（畫 mockup、tune 的逐塊改）改成
  `subagent_type: fankeel:fankeel-mockup`，不傳 model——檔案釘住的 model 就是下限。
  `design.mockup` 設成 opus 以外的值時才傳 model 覆蓋。
- verify 的 mutation agent 不在這輪：TODO 那條縮成只講它，移到 `## Waiting` 的
  「受控 build/verify 實跑」底下，等 k 重跑。
- `docs/subagents.md` 的 agent 數和清單、`.fankeel/map.md` 的 agents 那一行跟著改。

## 3. effort 依角色、依站建議

- 每個 agent 檔的 frontmatter 寫 `effort:`：reader、reviewer、verifier、render-reviewer
  `medium`，fixer `low`，judge `xhigh`，mockup `high`，brain 維持 `medium`。沒有一個用
  `max`——使用者 2026-09-26 的觀察是 max 會過度推理。
- `task.js start` 和 `task.js stage` 的輸出多一行建議主 session 的 effort：
  architectural 的 design、plan 是 `xhigh`，其餘站 `medium`；spike、bounded 全程
  `medium`。只印在指令輸出，不進注入區塊，不吃 2400 的上限。plugin 改不了主 session 的
  effort，這一行只是建議。
- station 開始記錄 effort：transcript 裡有就讀出來放進 session 的資料，沒有就不顯示。

## 4. station 上看問題、答問題

- 這個專案的 profile 設 `gate.station: 300`（使用者 2026-09-26 同意開；300 是精靈允許
  的最大值）。
- `pendingGateHtml` 每題加一個 Other 自由輸入框；打了字就以輸入的文字當答案。
- 送出鈕在每題都有答案之前是停用的；`POST /answer` 也改成少答一題就回 400，不再默默
  送出部分答案（`scripts/station.js:525`）。

## 5. tune 改完的通知

- `lib/station.js` 的 model 帶上 tune 佇列的摘要：用 `lib/tune.js` 的 `queueState` 讀
  `.fankeel/build/tune/queue.jsonl`，放在 `pending` 旁邊。
- `assets/station/station.js` 的 `refresh()` 比對前後兩次佇列：有一筆從進行中變成
  done 或 rejected，就跳 toast（「已修改完成：<block>」），分頁在背景時再發一個瀏覽器
  `Notification`（使用者允許過才發）。
- 佇列不是空的時候頁首顯示 tune 狀態（進行中幾筆、完成幾筆）和 tune 的網址。
- 被改的頁面本身照舊由 tune 的 overlay 自己 reload；station 這邊沿用 3 秒一次的
  refresh，不另開連線。

## 6. 模型花費按版本分

- `family()`（`assets/station/station.js:220`）保留給配色；`model` 維度改用新的
  `modelKey()`，帶版本（`opus-5-5`、`opus-5`、`sonnet-5`…），圖例寫成 Opus 5.5。
- 同一家族的不同版本同色相、不同明度；顏色由 `--m-<family>` 推出來，不為每個版本
  寫死一個色。
- 計價不動，`lib/prices.js` 本來就按版本。

## 7. 設定精靈改版

- 照 mockup 的方向：每個選項一張卡、一行字；開發習慣改成會動的小圖——
  `land.integration`（merge、pr、keep 三種分支動畫）、`land.push`、`land.archivePlan`、
  `stage.agents`、`guard`。
- 新動畫全部在 `prefers-reduced-motion: reduce` 底下停在最後一格。
- `data-block` 的 `wizard`、`wizard-steps`、`wizard-step`、`wizard-summary` 四個名字
  不變，`tests/station-wizard.test.js` 靠它們；`POST /profile` 不變。
- 細節在 build 寫出真頁面之後用 tune 的 live mode 逐塊調（使用者選的「逐塊」路徑）。

## 8. 四個小決定

- `scripts/ledger.js` 的 `parseArgs` 改成每個 verb 有自己允許的旗標清單，清單外的旗標
  直接拒絕、exit 非 0；`ranges --range x` 從 exit 0 變成被拒。
- `judge.js record` 不驗證 subagent transcript：背景派出去的 judge 寫檔可能還沒 flush、
  一個 session 裡可能有好幾個 judge，驗證會誤拒真的判決；而且 record 只拿得到 session
  id，拿不到 transcript 路徑。
- `fanoutSync` 不改：溢出 64MB 時已經降級成逐個 repo 重讀，不會壞；沒有任何量測顯示
  碰過這個上限。
- 後兩項的理由寫進一份 `docs/decisions/2026-09-26-*.md`，land 時寫。

## 9. docs tree 規則與 ADR

- `docs.json` 的每個 bucket 除了 `role` 再加 `audience: human | agent`。給人看的：使用者
  的語言、短、有圖、land 時要人讀過；給 agent 看的：密、附 `path:line`、docs-check 機械
  檢查。
- `lib/docs.js` 在 `flat`、`phased` 之外加第三種建議樹，給人看的資料夾用數字前綴排在
  最前面，agent 的全部收在一個資料夾：

  ```
  docs/
  ├── 01-guide/          human   怎麼用、上手         reference
  ├── 02-architecture/   human   系統全貌、圖         reference
  ├── 03-decisions/      human   ADR                  decision
  ├── 90-agent/          agent
  │   ├── plans/                                      plan
  │   ├── reference/                                  reference
  │   └── reports/                                    report
  ├── 99-archive/                                     archive
  └── README.md          human   入口
  ```

- 只有沒有 `docs.json` 的專案，在 survey 問一次要不要套用，這棵樹是第一個選項；已經有
  `docs.json` 的專案不追問，由 `/fankeel-audit` 的後續任務處理。
- ADR 就是 decision 這一類，不另開：frontmatter `binding: true` 只給「會改變以後寫程式
  該怎麼做」的決策，「解釋過去為什麼」的不算。
- docs-check 限制一個 repo 最多 7 份 binding；被取代的那份必須有 `superseded_by`，有了
  就不再算 binding。
- binding 決策列進 `.fankeel/map.md`，design 第 5 步對照 map 時讀到；不進任何注入區塊。
  寫 binding 的時機在 fankeel-land skill 的決策紀錄那一步。

## 10. TODO

- `## Needs a decision` 的六條全部移除，或照第 2 節縮寫後移到 `## Waiting`。
- `## Ready` 加一條：`/fankeel-audit` 擴充成定期清理機制，先搬 fankeel 自己的 docs，
  再跑 Trovara；連結到這頁不行（plan 會被 todo-check 擋），連結到 land 時寫的決策紀錄
  以外的現行頁面——build 時決定落在哪一頁。

## 成功條件

| 節 | 現在會失敗、做完會過的檢查 |
|---|---|
| 1 | render.test.js 新的 bounded＋mockup 案例（現在 2420） |
| 2 | agents.test.js：`NAMES` 與 plugin.json 都含 `fankeel-mockup`，frontmatter `model: opus` |
| 3 | agents.test.js：每個 agent 檔都有 `effort:` 且不是 `max`；task.js 測試：architectural 進 design 印 `xhigh` |
| 4 | station-post.test.js：少答一題的 `POST /answer` 回 400；station 測試：pending 卡片有 Other 輸入框 |
| 5 | station 測試：serialize 出來的 model 帶 tune 佇列摘要；前後兩次佇列一筆轉 done 時產生一則通知 |
| 6 | station 測試：`modelKey('claude-opus-5-5')` 和 `modelKey('claude-opus-5')` 不同；畫出來的頁面裡 Opus 5.5 那格的金額等於該版本各列加總 |
| 7 | station-wizard.test.js 照舊綠；reduced-motion 下沒有 `animation` 在跑（渲染後檢查） |
| 8 | ledger 測試：`ranges --range x` exit 非 0 |
| 9 | docs 測試：`binding` 第 8 份時 docs-check 報錯；有 `superseded_by` 的不計 |
| 10 | `node scripts/todo-check.js` 綠 |

## 對照 map

- `.fankeel/map.md:36` 寫 agents 有六個，實際是七個，這次變八個——map 本來就落後一個，
  這次一起改。
- 沒有找到跟這個方向衝突的現行頁面。

## 沒有驗證的

- 主 session 的 effort 有沒有寫進 transcript（第 3 節最後一條靠它）。
