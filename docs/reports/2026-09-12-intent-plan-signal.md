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

drift 這條路也進不去：`scripts/docs-audit.js:443` 的
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

| 檔案 | status | kind | role | 命名的 code | unbuilt | 命名數 > 0 且 unbuilt = 0？ |
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

上面這張表只量到 landed predicate 的前兩個條件。第三個條件——settled，也就是
`scripts/docs-audit.js:586` 的 `daysBetween(now, at) >= settled`（`LANDED_QUIET
= 3`，定義在 `scripts/docs-audit.js:46`）——證據目錄裡沒有任何一支腳本算它，這
裡是手動核對：`git log` 顯示 `design-class-prompt.md` 唯一一次 commit 是
2026-09-09，這次量測的日期是 2026-09-12，差距剛好三天，正好卡在
`LANDED_QUIET` 的邊界上——早一天量測就不會通過，所以這個結論跟量測當天的日期
綁死，換一天重跑可能翻盤。同一個結論在歷史上確實發生過，而且點名的就是同一
個主體，不是同一類計畫裡隨便一份：commit `43a7c12` 的訊息記下拿掉這條 skip
之前，`docs/plans/2026-09-09-design-class-prompt.md`——跟這次量測同一份
檔案——被 sweep 回報成 landed，讓整條 run 每次執行都 exit 1。

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

在這個專案裡真正生效的補救機制是**歸檔**。`LANDED_QUIET = 3` 最初是從另一批
八份計畫的樣本定下來的；`docs/reports/2026-09-07-audit-constants.md` 用六份計
畫重新量測，同樣落在 0–4 天、眾數同樣是 3——那是一次重新量測並確認，不是定值
的那一次。這次額外核對四份用 `git log --follow --diff-filter=AR` 抓到的頁面：

| 頁面 | 送出 | 歸檔 | 落差 |
|---|---|---|---|
| `docs/archive/2026-09-09-fankeel-ask.md` | 2026-09-09（`81a2c12`） | 2026-09-10（`a051f91`） | 1 天 |
| `docs/archive/2026-09-09-fankeel-ask-design.md` | 同一對 commit | 同一對 commit | 1 天 |
| `docs/archive/2026-09-09-profile-judge-reader.md` | 2026-09-09（`b2748b6`） | 2026-09-09（`3a030af`） | 0 天 |
| `docs/archive/2026-09-09-profile-judge-reader-design.md` | 同一對 commit | 同一對 commit | 0 天 |

這四份今天仍然是 `status: design-intent`——被歸檔了，但從沒被翻過來。歸檔一旦
發生，頁面的 role 就離開 `plan`，於是也離開了這個問題原本擔心的檢查範圍。

拿 `docs.contractOf`（不是重新拼的 regex）對整個 repo 的 git-tracked `.md`
跑一次普查，母體換成 `git ls-files` 篩出的全部 markdown，不再限定
`docs/`——這才是 `scripts/docs-audit.js:412`（`markdown =
files.filter(isMarkdown)`，篩的對象是 `trackedFiles()` 回傳的完整追蹤清單）
和 `lib/map.js:224-237` 的 `markdownUnder()` 實際讀的母體；對著 `docs/` 這個
較窄的子集普查，答不了這兩支消費者真正面對的問題。這個數字包含本頁自己：
178 份檔案，109 份 `current`、33 份 `archived`、29 份沒有 `status`、5 份
`design-intent`、2 份 `superseded-by`。population 從 137 擴大到 178，多出的
41 份落在 `skills/`、`agents/`、`output-styles/`、`.claude/agents/` 底下，多
數進了 `current` 或無 `status` 兩個桶，`archived` 和 `superseded-by` 沒有
變。5 份 `design-intent` 裡，4 份仍是上表列出的 `docs/archive` 頁面，剩下 1
份仍是 `docs/plans/2026-09-09-design-class-prompt.md`——也就是本次的量測主
體，一份目前仍在設計階段、尚未落地的計畫。母體擴大 41 份，`design-intent`
的計數一份沒多——零實例的結論不是靠一個窄母體撐出來的，換成兩支消費者實
際讀的母體，結論反而更站得住腳。

換句話說，「做完但 `status` 沒翻」這個失敗模式，在整個 repo 追蹤的 markdown
裡，今天的實際發生次數仍是零。加一條檢查，等於為一個目前不存在、而且量出來
的兩個候選訊號都證明分不開真計畫的情境預先蓋一條規則。決定是不加：
`docs-audit` 對這種情況不回報，`scripts/docs-audit.js:584` 維持原狀。

## `lib/map.js` 那一半：同一個判斷，同一次量測

TODO 原文點名的盲點是兩個，不是一個：上面幾節量的是 `docs-audit` 的 landed
判斷這一半；`lib/map.js` 的「未建清單」分不出「計畫工作真的做完但 `status`
沒翻」的頁面，是另一半，到這裡都還沒被提到。

`lib/map.js:288` 的
`else if (contract.kind === 'intent') out.intent.push(rel);`，用的是跟
`scripts/docs-audit.js:584` 完全相同的 `kind === 'intent'` 判斷。這個判斷餵
進兩個地方：`lib/map.js:413-416` 印出來的「planned, not built — N:」清單，
以及 `:381` 那行把 `by.intent` 算進 `documents:` 摘要的 `planned` 計數——一
份誤判的頁面因此既上榜，也讓一個統計數字虛報。`:410-412` 的註解把這份清單稱
作「這個外掛裡唯一產生的東西，也是地圖存在的理由：一頁描述系統打算變成什麼
樣子的文字，要讀成 intent，而不是一段已經 drift 掉的描述」。

兩個消費者都站在一個前置過濾器後面。`docs-audit` 要求
`roleOf(tree, rel) === 'plan'`（`scripts/docs-audit.js:579`）；
`lib/map.js:270-272` 則是先問 `docs.roleOf(tree, rel) === 'archive'`，是就
整批收進 `retired`，不管 frontmatter 寫什麼——而且這一步排在 `kind` 判斷之
前。`:265-269` 的註解記著 2026-09-11 那次修正：`docs/archive/` 底下當時有
24 份頁面仍寫著 `current` 或 `design-intent`，其中 4 份第二種曾經被錯列進
planned-not-built。前面普查那段數字（`census.js`）量到的五份 `design-intent`
頁面裡，四份正是這批 archive 頁面，兩個前置過濾器都會把它們擋下來；能同時通
過兩邊過濾器的只剩 `docs/plans/2026-09-09-design-class-prompt.md` 一份。
`lib/map.js` 這一半的曝險範圍因此跟 `docs-audit` 那一半一樣大——不是更大的
問題，是同一份頁面。

訊號一、訊號二失敗，失敗在 `kind === 'intent'` 這個判斷本身在檔案層級分不出
「還在等」跟「做完沒翻」——這是判斷的性質，跟哪一個消費者讀它無關。所以前
面兩節的量測已經同時回答了兩半：這裡沒有，也不需要，為 `lib/map.js` 另外跑
一次探針或量測。上面這段結構論證——兩個前置過濾器把曝險收斂到同一份頁面、
訊號失敗是判斷本身而非消費者的性質——就是全部的依據，沒有第三張表可以再產
生。

後果不一樣，值得寫清楚。`docs-audit` 那一半丟失的是「提示去歸檔一份已完成的
計畫」。`lib/map.js` 那一半更重：`skills/fankeel-survey/SKILL.md:95` 把
「planned, not built」訂為 survey 該最先讀的段落，所以一份工作已經做完的計
畫，會持續被之後每一個 session 讀成「還沒建」——這正是地圖存在要防止的那種
誤讀。

決定不變：`lib/map.js:288` 也維持原狀，理由跟 `scripts/docs-audit.js:584`
相同，不是另一個獨立判斷的結果。

## 量測方式

證據目錄：`docs/reports/evidence/2026-09-12-intent-plan-signal/`。本頁四張表，
每一張對應一個明確的來源，沒有一張是靠讀本頁自己重現的：

- 訊號一那張表（`命名數 > 0 且 unbuilt = 0？`）由 `points.js` 產生。
- 訊號二那張表（`AFTER` / `before` / `same`）由 `ages.js` 產生。
- 普查那段數字（178/109/33/29/5/2）由 `census.js` 產生。
- 歸檔落差那張表沒有腳本產生，是逐一對四份 `docs/archive` 頁面手動跑下面這行
  指令、照輸出抄的：
  `git log --follow --diff-filter=AR --format='%ad %h %s' --date=short -- <path>`

`points.js`、`ages.js`、`census.js` 三支都用
`path.resolve(__dirname, '../../../..')` 從自己的路徑算出 repo 根目錄，從 repo
根目錄（`F:\ymlab\fankeel`）分別用
`node docs/reports/evidence/2026-09-12-intent-plan-signal/points.js`、
`.../ages.js`、`.../census.js` 重新執行即可重現對應那張表的數字；歸檔落差那張
表要重現，得對上面列出的四個路徑各跑一次那行 `git log` 指令。
