---
status: design-intent
---

# TODO 全表盤點（10-15 第三輪）：--project 拒絕、architectural 不省額度、driven 站放行 node、升級清單 — Design

這次盤點做兩條 Ready 與兩條使用者在 survey 關卡做了決定的 Needs a decision。其餘條目不是等外部條件，就是要使用者在真機上看，survey 報告（`.fankeel/build/task-20261015T084414/survey.md`）逐條列了。「路線圓點在執行中呼吸」另有 session 在做，不碰。

- 「--project 指錯目錄要拒絕」（profile-3）：`scripts/task.js:1094-1097` 的 `projectRootFor` 找不到就回 `root`，`profile set` 與 `profile preset` 因此把設定寫進 registry 根目錄。
- 「大規模重設計不省額度」（model-6）：`dispatch.floor` 內建 `sonnet`，沒有任何地方依 class 調整。
- 「driven 站跑不了 node」（session-4）：使用者選了放行 node 與 git。
- 「升級技能要不要補步驟」（upgrade-3）：使用者選了先列格式變動清單；0.80.0 到 0.108.1 已有 `docs/90-agent/reports/2026-10-15-upgrade-080-inventory.md`，plan 站補查了 0.108.1 到 0.110.0。

class 為 bounded：四條都改既有流程，沒有前端。

## 1. --project 指錯目錄

- `cmdProfile` 算出 `projectRoot` 之後檢查：有 `--project` 而 `projectRootFor` 退回了 `root`（目錄不存在、是檔案、絕對路徑或含 `..`）時，印 `--project <值>: no such project under <root>`，exit 1，不寫任何檔。`set`、`unset`、`suggest`、`preset`、`show` 共用這一處。
- `profile preset` 不帶名稱時 exit 1、印 `preset is one of: manual, balanced, lean`、不寫檔；今天的程式已經如此，補一條測試鎖住。
- 存在的 `--project` 照舊寫進那個專案的 `.fankeel/profile.json`。

## 2. architectural 不省額度

- `lib/profile.js` 新增純函式 `dispatchFor(values, cls)`，回傳 `{ floor, effort }`：class 為 `architectural` 時 floor 至少是 `opus`（profile 設的 floor 已高於 `opus`，例如 `fable`，就保留），effort 為 `high`；其他 class 與空 class 回傳 profile 的 floor 原值、effort 為 `null`。
- `dispatchClause(values, cls)` 把上面的結果寫成一行規則：``class architectural: floor `opus`, effort `high` — no economising; reviewers as `-high`.``；不是 architectural 回 `null`。
- `lib/render.js` 在 plan、build、verify 三站的注入規則尾端加上這一行，其他站不加。Ruling（build，2026-10-15）：另加一行讓 plan 到 2410/2400、verify 加 security.local 到 2450、壓縮過的 build 到 3011/3000，所以改成這三站的 `class:` 行以這句取代 architectural 的 means 句，不另加一行。
- stage agent 的 brief（`renderBrainBrief`）裡三處 `profile.values['dispatch.floor']` 改讀 `dispatchFor` 的 floor，plan、build、verify 的 brief 經 `rulesLines` 帶那一行規則，只一次。controller 的區塊不帶：controller 只派 brain，不派 implementer、reviewer 或 reader。
- 條目寫的「build 對機械性 finding 略過 confirm reviewer」與「verify 的抽樣」在 skills、agents、lib 都找不到對應文字，沒有東西可取消；lean preset 只設 `stage.agents`。這兩點寫回條目正文，不另做程式。
- reader、mutator、mover 沒有 `-high` 變體，只跟著 floor 換模型。

## 3. driven 站放行 node 與 git

- `scripts/drive.js` 的 `argsFor` 多傳 `--allowedTools` 與一個值 `Bash(node:*),Bash(git:*)`，仍是 `--permission-mode acceptEdits`，仍然沒有 `bypassPermissions`。
- `docs/90-agent/reference/drive.md` 的 One stage 第 2 項把指令改成帶這個旗標，並寫明這是 2026-10-15 使用者的決定。
- 使用者重跑一次 driven build，看 handoff 裡真的出現 `ℹ pass` 行。

## 4. 升級清單

- 0.108.1（7f76224c）到 0.110.0（2d6f772f）之間，專案檔案格式只有一項變動：profile 的 `compact.at` 多接受 `1000000`（`lib/profile.js:42`），舊值都還在，舊檔照讀。`profile preset` 只寫既有的鍵。
- 結論寫進「升級技能要不要補步驟」條目正文：沒有變動需要升級步驟，`fankeel-upgrade` 維持只管 TODO 搬遷。盤點報告是 report，不改。

## What proves it done

| test | how |
|---|---|
| 不存在的 --project 被拒且不寫檔 | `tests/profile-project.test.js`，set 與 preset 各一條 |
| preset 無名稱 exit 1 | `tests/profile-project.test.js` |
| architectural 與 bounded 讀到的 floor、effort | `tests/profile-dispatch.test.js` |
| plan、build 的注入規則與 build brain brief 帶拉高後的一級 | `tests/render-dispatch.test.js` |
| argsFor 帶 node 與 git 的放行規則、沒有 bypassPermissions | `tests/drive.test.js` |
| driven build 真的跑出 `ℹ pass` | 使用者重跑 drive.js（Task 5） |
