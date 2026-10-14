---
status: current
last_verified: 2026-10-15
source_of_truth: 本頁是一次盤點的紀錄，不隨程式碼更新；由 tests/upgrade-080.test.js 鎖住結論
---

# 0.80.0 到 0.108.1：專案自己的檔案格式變了什麼（2026-10-15）

## 結論

0.80.0（90bd950b，2026-09-28）到 0.108.1 之間，專案自己提交的 fankeel 檔案沒有一項舊格式會被拒絕或讀錯，所以 `scripts/upgrade.js` 不加步驟。新欄位缺席時讀成內建值或不存在；TODO 從 `TODO.md` 搬到逐條檔案已有 `upgrade.js` 的兩個步驟。`tests/upgrade-080.test.js` 用 fankeel 自己 repo 在 0.80.0 時的 profile.json 與 docs.json 鎖住這個結論。

## 逐項

| 檔案 | 變動 | 舊格式今天讀不讀得進來 | 證據 |
|---|---|---|---|
| `.fankeel/profile.json` | 新增 `quota.week`、`station.chartroom`、`compact.at`、`language`、`init.skip`、`sensitive.mode`、`sensitive.review`、`commit.format`、`quota.calibrated`、`prose.style`、`agent.<name>.model\|effort` | 讀得進來：缺的鍵讀成內建值或不存在 | `lib/profile.js:326-336` |
| `.fankeel/profile.json` | `worktree` 從 `true\|false` 放寬到也接受 `bounded\|architectural` | 讀得進來：舊值仍在允許值裡 | `lib/profile.js` 的 `KEYS.worktree` |
| `.fankeel/profile.json` | `stage.agents` 只改了 lean preset 的設定值 | 讀得進來：解析不變 | `lib/profile.js` 的 `PRESETS` |
| `.fankeel/profile.json` | 沒有鍵被刪或改名 | — | `git diff 90bd950b..HEAD -- lib/profile.js` |
| `.fankeel/docs.json` | 角色從 6 個變 8 個（新增 `todo`、`data`） | 讀得進來：`normalise` 保留舊角色，只丟未知角色 | `lib/docs.js:149-161` |
| `.fankeel/docs.json` | `depth`、`audience`、`index` 不變 | 讀得進來 | `lib/docs.js:149-168` |
| TODO | `TODO.md`（有或沒有 `## Waiting`）→ `docs/.../todo/` 逐條檔案 | 由 `upgrade.js` 的 `waiting` 與 `todo-folder` 兩步處理 | `scripts/upgrade.js:81-103` |
| 登記檔 | `scope` → `claims` | 讀得進來 | `lib/registry.js:744-751` |
| `.fankeel/render.json` | 沒有：`lib/render.js` 與 `lib/shots.js` 的 diff 裡 `pages`、`roles` 鍵沒有增刪改，只有註解範例的埠號從 7817 改成 28888 | 讀得進來 | `git diff 90bd950b..HEAD -- lib/render.js lib/shots.js` |

## 沒查的

- 沒有拿真的 0.80.0 專案跑過 `upgrade.js`；測試用的是 fankeel 自己 repo 在 0.80.0 時的兩個檔。
- 登記檔（`.fankeel/sessions/*.json`）不提交，不在盤點範圍。
