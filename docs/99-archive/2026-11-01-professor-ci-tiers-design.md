---
status: current
last_verified: 2026-11-01
source_of_truth: lib/suite.js, scripts/suite.js, skills/fankeel-land/SKILL.md, skills/fankeel-plan/SKILL.md, agents/fankeel-init-scout.md
---

# 教授 11-01 三項：Gitea/CI、測試兩層、plan 拆組

一句話：專案用一份 `.fankeel/suite.json` 宣告「哪個目錄跑哪條指令、屬於日常層還是 nightly 層」，land 跑日常層並在推送後讀 CI，nightly 交給 CI 排程；plan 太大時拆成一份索引加每組一份 plan。

TODO 依 stage 分組不在此：那段逐字稿是使用者描述已完成的 session 清單分 stage，條目已以 abandoned 關閉（c93b07c0）。

## 1. `.fankeel/suite.json` — 多目錄與兩層

沿用 `.fankeel/render.json` 的先例：專案自己宣告、進版控，不塞進 profile 的單值 key。

```json
{
  "daily":   [{ "dir": "apps/api", "run": "poetry run pytest -m \"not nightly\"" },
              { "dir": "apps/web", "run": "npm test" }],
  "nightly": [{ "dir": "apps/api", "run": "poetry run pytest -m nightly" },
              { "dir": "apps/web", "run": "npm run e2e" }]
}
```

- `lib/suite.js` 新增 `declared(tree)`：讀檔、驗形狀，壞檔回 `{ error }`，與 `testCommand` 同一慣例。
- `scripts/suite.js`：有 suite.json 時跑 `daily` 的每一條（各自 cwd，依序，任一條紅即紅，第一條紅就停）；`--nightly` 改跑 `nightly`；`--command` 仍最優先。沒有 suite.json 時行為完全不變（package.json 的 `test` / `test:fast`）。
- `--fast` 在有 suite.json 時等同 `daily`，紀錄照舊寫 `fast`，land 的檢查不必改。
- 不做平行、不做逾時設定、不做第三層。

## 2. `scripts/ci-status.js <sha>` — 推送後讀 CI

唯讀，印一行，不等、不擋 land。

- 依 `git remote get-url origin` 判主機：`github.com` → `gh api repos/{o}/{r}/commits/{sha}/status`；其他主機視為 Gitea → `GET /api/v1/repos/{o}/{r}/commits/{sha}/status`。
- Gitea 認證三層退回：`GITEA_TOKEN` → `git credential fill`（host 為 origin 的主機，執行時才取，不寫檔、不印）→ 都失敗印 `ci: unknown <Actions 頁網址>`。
- 輸出 `ci: success|failure|pending|none|unknown`，unknown 附網址。
- land skill 步驟 7：開 PR 依主機分 `gh pr create` / `tea pulls create` / 印 compare 網址；推送後把 `ci:` 行放在報告 `suite:` 旁。

## 3. init 認得 workflow，nightly 只給範本

- `agents/fankeel-init-scout.md` 加一項：列出 `.gitea/workflows/*.yml`、`.github/workflows/*.yml` 中 `run:` 含 test/pytest/e2e 的行與其 `working-directory`，草擬一份 suite.json 給使用者確認，不自動寫入。
- init 偵測 origin 是 Gitea 或 GitHub 時問一次是否推送並開 PR，寫 `land.integration pr`、`land.push true`。
- `assets/ci/nightly.yml`：`on: schedule` 的範本，跑 suite.json 的 nightly 層；fankeel 不寫進任何專案，只在 init 報告裡指給使用者。

## 4. 測試盤點 — `scripts/test-audit.js`

只列不刪。

- 疑似失效：測試檔 `require`/`import`（JS）或 `from x import`（Python）指向不存在的本地模組。
- 疑似重複：去掉空白後內容完全相同的測試主體（JS `test(`/`it(`、Python `def test_`），列出每組路徑:行。
- 輸出 `path:line — reason`，結尾一行計數；exit 0。接到 audit 技能的程式碼半邊當一個可選掃描器。

## 5. plan 拆組 — skills/fankeel-plan/SKILL.md

- 觸發：design 的檔案表分成兩組以上互不共用檔案的工作，且任一組預估超過 8 個 task，或 plan 階段已出現 `context:` 行。
- 形狀：`<stem>-index.md` 寫每組的名字、它對外提供的介面（函式簽名、檔案格式、指令）、它依賴哪幾組；每組一份 `<stem>-<group>.md`，就是一般 plan，`ledger.js --plan` 原樣可用。
- 接手：每組由一個 plan stage agent 單獨寫，只帶索引與該組的設計段落；前組的結論只經由索引的「介面」欄帶過去。build 依索引的相依順序逐組跑。
- 先讀已完成的「brain 模式照相依圖派組」「stage brain 撞上限沒規則」，不重做。

## 6. 每關都有關卡頁，附電腦與手機網址

使用者 11-01 在 design 關卡提出：主 session 自己跑的階段沒有 handoff 檔，station 關卡頁空白，手機看不到 spec；問題框跳出時也看不到上方訊息裡的網址。

- `lib/stages.js`：不在 `stage.agents` 的階段，規則要求問關卡前把報告（含 `json gate` 區塊）寫到 `handoffPath`，與 stage agent 同一格式。
- `hooks/gate.js`：受控與否都一樣，沒有 handoff 檔的關卡拒絕。
- 注入區塊給出兩個網址：電腦 `http://127.0.0.1:<port>/f/<id>/gate`、手機 `https://<tailnet>/m#/s/<id>/gate`（`lib/tailscale.js` 已知 dnsName）；選項一的說明照抄，因為那是問題框裡唯一看得到的地方。

## 7. 每關結論提早進版控

依判官 [2026-11-01-shared-session-state](../judgements/2026-11-01-shared-session-state.md)（選 A）：進行中狀態留本機，但結論不等 land。`task.js stage` 換站時，把上一站的 handoff 報告遮罩 sensitive.txt 後複製進 records bucket 的 `<task>/<stage>.md`，單獨 commit；別人在 GitHub 上看得到每關結論並可留言。集中歸檔另記為 TODO「session 與 build 集中歸檔」（c8c6656a），不在此。

## 證明完成

- `tests/suite.test.js` 新案例：一個暫存專案只有 `.fankeel/suite.json`（兩個目錄各一條 `node -e` 指令，一條 exit 1）— 現在報 `no test command`，之後報 red 並指出是哪一條。
- `tests/ci-status.test.js`：假 origin 為 Gitea、無 token、credential 失敗 → 印 `ci: unknown https://…/actions`。
- `tests/test-audit.test.js`：fixture 裡一個 import 不存在模組的測試、兩個主體相同的測試 → 兩行都被列出。
- plan 拆組：拿本設計自己的 plan 走一遍索引 + 分組檔。

## 未驗證

RH 的 CI 是否真的在 Gitea runner 上跑過：沒有 token，私有 repo 的 API 回 404，看不到。
