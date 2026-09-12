---
status: current
last_verified: 2026-09-12
source_of_truth: 本頁是 2026-09-12 那次量測的記錄，不隨程式碼更新；`docs-audit.js` 的實際行為以程式碼本身為準
---

# 該不該回報「做完但 `status` 還停在 `design-intent`」的計畫 — 2026-09-12 的量測

這一頁記錄一次量測和一個決定，不是一次程式碼改動——`scripts/docs-audit.js`
沒有被動過一行。

## 缺口是真的

`scripts/docs-audit.js:584` 的 `if (contracts.get(rel).kind === 'intent') continue;`
把 `kind` 為 `intent` 的頁面整條排除在 landed 判斷之外，settled、deliverables、
deleted-paths 這幾個 predicate 都碰不到它。`lib/docs.js:352-363` 的 `STATUS_KINDS`
/ `statusKind` 把 `design-intent`、`draft`、`草稿`、`planned`、`proposed`、`wip`
都映射成 `kind: intent`。

drift 這條路也进不去：`scripts/docs-audit.js:443` 的
`const current = (rel) => roleOf(rel) === 'reference' && claims(rel);` 要求
`reference` 角色，`:462` 的 drift 迴圈又是拿 `current(rel)` 當閘門
（配上 `:466-471` 逐個 target 比對日期），而一份 plan 角色的頁面永遠進不了
`current`。

所以問題裡問的缺口確實存在：一份「工作已經落地，但 `status:` 從沒被翻回來」的
`design-intent` 計畫，目前沒有任何檢查在盯著它。

## 訊號一：「命名的檔案是否都存在」——沒有區分力

用 `docs-audit.js` 自己的 `pointsAt`（跟 `sweep()` 呼叫的方式一樣，
`scripts/docs-audit.js:427,436`）而不是重新推導「一份計畫命名了什麼」，量測
主體加兩個對照組——sweep 今天實際回報為 landed 的兩份計畫：

| 檔案 | status | kind | role | 命名的 code | unbuilt | landed predicate 可滿足？ |
|---|---|---|---|---|---|---|
| `docs/plans/2026-09-09-design-class-prompt.md` | design-intent | intent | plan | 3 | 0 | YES |
| `docs/plans/2026-09-09-gate-and-controls.md` [CONTROL] | current | current | plan | 16 | 0 | YES |
| `docs/plans/2026-09-09-gate-and-controls-design.md` [CONTROL] | current | current | plan | 3 | 0 | YES |

三列一模一樣：命名數 > 0、unbuilt = 0。這個訊號分不出「一份還在設計階段的
intent 計畫」跟「一份工作已經落地的 current 計畫」——兩者對 `pointsAt` 來說看
起來完全相同。如果把 `:584` 拿掉，效果會是每一輪都把這份還活著的 intent 計畫
（`design-class-prompt.md`）回報成 landed，而這正是 commit `43a7c12`
（"fix: a design-intent plan is not judged landed"，併入 `f3e7a87`）修掉的那個
回歸。

## 訊號二：「命名的檔案是否在計畫送出之後被改動過」——同樣沒有區分力，這是這頁值得留下的發現

用 `git log --follow` 找每個被命名檔案的「最後一次改動」，跟計畫的「送出日」比
（送出日用 `--diff-filter=A --follow` 抓，取歸檔前那一次，理由見
`docs/reports/2026-09-07-audit-constants.md:31-35` 記過的那個陷阱：對已歸檔路徑
直接 `git log -1` 抓到的是歸檔那次 commit）。

| 計畫 | 送出日 | 命名數 | AFTER | before | same |
|---|---|---|---|---|---|
| `docs/plans/2026-09-09-design-class-prompt.md` | 2026-09-09 | 3 | 2 | 1 | 0 |
| `docs/plans/2026-09-09-gate-and-controls.md` [CONTROL] | 2026-09-09 | 16 | 6 | 2 | 8 |
| `docs/plans/2026-09-09-gate-and-controls-design.md` [CONTROL] | 2026-09-09 | 3 | 2 | 0 | 1 |

主體 `design-class-prompt.md` 的比分是 after=2、of 3；落地的對照組
`gate-and-controls-design.md` 的比分是 after=2、of 3——兩者相同。逐列看就知道
原因：`lib/stages.js` 和 `scripts/task.js` 是核心檔案，天天因為跟這份計畫無關
的理由被改動，任何一份命名了它們的計畫，不管自己的工作有沒有落地，都會被記成
AFTER。這條訊號量到的是「這個檔案本來就常換」，不是「這份計畫的工作落地了」。

## 結論：不加檢查，`:584` 維持原狀

沒有一個檔案層級的訊號能分開「一份只是列出待讀檔案的 prompt」跟「一份工作已
經落地但 `status` 沒翻回來的計畫」。

在這個專案裡真正生效的補救機制是**歸檔**。`docs/reports/2026-09-07-audit-constants.md`
量過的六份計畫落在 0–4 天，`LANDED_QUIET = 3` 就是那次量測定的。這次額外核對
四份用 `git log --follow --diff-filter=AR` 抓到的頁面：

| 頁面 | 送出 | 歸檔 | 落差 |
|---|---|---|---|
| `docs/archive/2026-09-09-fankeel-ask.md` | 2026-09-09（`81a2c12`） | 2026-09-10（`a051f91`） | 1 天 |
| `docs/archive/2026-09-09-fankeel-ask-design.md` | 同一對 commit | 同一對 commit | 1 天 |
| `docs/archive/2026-09-09-profile-judge-reader.md` | 2026-09-09（`b2748b6`） | 2026-09-09（`3a030af`） | 0 天 |
| `docs/archive/2026-09-09-profile-judge-reader-design.md` | 同一對 commit | 同一對 commit | 0 天 |

這四份今天仍然是 `status: design-intent`——被歸檔了，但從沒被翻過來。歸檔一旦
發生，頁面的 role 就離開 `plan`，於是也離開了這個問題原本擔心的檢查範圍。

拿 `docs.contractOf`（不是重新拼的 regex）對 `docs/` 底下所有檔案跑一次普查：
136 份檔案，87 份 `current`、33 份 `archived`、9 份沒有 `status`、5 份
`design-intent`、2 份 `superseded-by`。5 份 `design-intent` 裡，4 份就是上表列
出的 `docs/archive` 頁面，剩下 1 份是 `docs/plans/2026-09-09-design-class-prompt.md`
——也就是本次的量測主體，一份目前仍在設計階段、尚未落地的計畫。

換句話說，「做完但 `status` 沒翻」這個失敗模式，今天的實際發生次數是零。加一
條檢查，等於為一個目前不存在、而且量出來的兩個候選訊號都證明分不開真計畫的
情境預先蓋一條規則。決定是不加：`docs-audit` 對這種情況不回報，
`scripts/docs-audit.js:584` 維持原狀。

## 量測方式

證據目錄：`docs/reports/evidence/2026-09-12-intent-plan-signal/`，內含
`points.js`（訊號一）與 `ages.js`（訊號二）兩支腳本。兩支都用
`path.resolve(__dirname, '../../../..')` 算出 repo 根目錄，從 repo 根目錄
（`F:\ymlab\fankeel`）用 `node docs/reports/evidence/2026-09-12-intent-plan-signal/points.js`
（`ages.js` 同理）重新執行即可重現本頁列出的每一個數字。
