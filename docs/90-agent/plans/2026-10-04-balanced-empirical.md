---
status: design-intent
---

# balanced 三站明說是經驗選擇 Implementation Plan

**Goal:** 讓盲測第 2b 題「為什麼 balanced 交出 survey、build、verify」能直接由 `docs/01-guide/profile.md` 回答：這三站是經驗選擇，repo 裡沒有記下理由，並在 `lib/profile.js` 的 `PRESETS.balanced` 同一處寫明。
**Architecture:** 一個 task：`lib/profile.js` 在 `PRESETS.balanced` 的 `set:` 那一行行尾加註解（不增減行數，所以 `docs/01-guide/profile.md:57` 引用的 `lib/profile.js:442`、`:447` 不必改），`docs/01-guide/profile.md` 第 57 行那段在「它沒有解釋為什麼……這三站。」之後補一句，`docs/README.md` 補本計畫的索引列。待辦 profile-2 已記在本 task registry 的 `todo` 欄，由 land 用交付的 sha 執行 `todo.js done` 關閉，build 不動它。
**Tech Stack:** Node v24.9.0（CommonJS、`'use strict'`、只用內建模組），`node --test`，git 2.44.0.windows.1，fankeel 0.95.0。
**Spec:** [design.md](../../../.fankeel/build/task-20261004T080357/design.md)

## Global Constraints

由 `node scripts/map.js`（exit 0；539 份 markdown、11 份 planned 未建）、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`）、`package.json` 與測試套件產生：

- `lib/*.js` 是純函式、直接測；`lib/` 不 require `scripts/` 或 `hooks/`（`CONTRIBUTING.md:15`）。
- 測試：`node --test`（`package.json:8`），沒有任何 dependency，不得新增。實作者只跑自己 task 列出的測試檔，不跑全套；全套由 `build close` 跑。
- `docs/01-guide/profile.md` 兩個 `PROFILE_TABLE` 標記之間的表由 `node scripts/profile-table.js` 產生，`tests/profile-table.test.js:13-17` 比對它與 `KEYS`、`PRESETS.balanced`；只動標記之外的段落，不改任何值。
- 縮排跟著檔案走：`lib/profile.js` 四格。行尾 LF（`.gitattributes`：`* text=auto eol=lf`）。檔案用 Edit 改，不用 heredoc（heredoc 吃反斜線）。
- 歸檔（`.fankeel/map.md` 的 filing）：`docs/01-guide` 是 reference，`docs/90-agent/plans` 是 plan，索引是 `docs/README.md`；新頁在同一個變更裡補索引列（`CONTRIBUTING.md:20`）。
- TODO 條目在 `docs/90-agent/todo/`，沒有 `TODO.md`；關條目是 land 的事：`task.js stage land` 印出 `todo.js done <id> --sha <sha> --session <id>`，條目變 `state: done`、檔案留著（`docs/90-agent/reference/todo.md:95-97`）。
- 這次 build 由 stage agent 跑：實作者在自己的 worktree 裡工作，開工前先 `git reset --hard <build agent 給的 sha>`；實作者不 commit、不 `git add`、不 `git stash`，改完回報要提交的路徑與訊息。
- profile 的 `guard` 是 `deny`（`task.js profile show`）：寫入被 scope guard 擋下時停手回報，不繞路。

## Risks

- 舊計畫 `docs/90-agent/plans/2026-10-03-todo-patrol-three.md` 的 Task 4 做的是同一件事（行尾註解、關 profile-2）但從未執行，仍是 design-intent — Task 1 — 本計畫不改那份計畫；它與本計畫同一行加註解，build 前先 `grep -n "經驗選擇\|no reason was recorded" lib/profile.js`，已有註解就停手回報。
- 在 `balanced:` 上方另起一行註解會讓 `lib/profile.js:442`、`:447` 往下移，`docs/01-guide/profile.md:57` 的引用失效 — Task 1 — 改成行尾註解、不增減行數；第 5 步用 `git diff --stat lib/profile.js` 確認是 1 insertion、1 deletion。

## Task 1: balanced 三站在註解與頁面都寫明是經驗選擇

**Files:**
- Modify: `lib/profile.js` — `PRESETS.balanced` 的 `set:` 行尾加註解，不增減行數
- Modify: `docs/01-guide/profile.md` — 第 57 行那段補一句
- Modify: `docs/README.md` — 在 todo-patrol-three 那列之後加本計畫的索引列
- Read: `assets/station/station.js` — 第 1837 行精靈「省 context」按鈕寫 `survey,build,verify`，說明只寫「三站交出去」，不改

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet

1. 先確認失敗端：

```sh
grep -n "經驗選擇" docs/01-guide/profile.md lib/profile.js; echo grep=$?
```

   要印 `grep=1`（零筆）。不是就停手回報。

2. 在 `lib/profile.js` 的 `PRESETS` 裡 `balanced:` 之下，把這一行：

```js
        set: { 'land.integration': 'merge', 'land.push': 'false', 'land.archivePlan': 'true', guard: 'ask', 'stage.agents': 'survey,build,verify' },
```

   原地換成（`lib/profile.js` 同一行，行尾加註解）：

```js
        set: { 'land.integration': 'merge', 'land.push': 'false', 'land.archivePlan': 'true', guard: 'ask', 'stage.agents': 'survey,build,verify' }, // survey,build,verify is an empirical choice (經驗選擇): no reason for these three was recorded, and the user ruled on 2026-10-02/03 not to invent one; the reason above PRESETS explains only lean's handing every stage off
```

3. 在 `docs/01-guide/profile.md` 第 57 行，找到這一句（原文）：

```text
它沒有解釋為什麼「建議」欄只挑 survey、build、verify 這三站。
```

   在 `docs/01-guide/profile.md` 的這一句之後、「精靈 agents 那一步有三顆會交出站的按鈕」之前，插入這一句（同一行、同一段，不換行）：

```md
這三站是經驗選擇：repo 裡沒有任何一處記下為什麼挑這三站，使用者 2026-10-02/03 裁定維持原樣、不補編理由；`PRESETS.balanced` 那一行的註解也這樣寫，精靈「省 context」按鈕的說明同樣只寫「三站交出去」，沒有理由。
```

4. 在 `docs/README.md`，找到以 `| TODO 全表盤點（10-03）的 plan：` 開頭的那一列，在它之後加一列：

```md
| balanced 三站明說是經驗選擇（10-04）的 plan：`PRESETS.balanced` 行尾註解、profile.md 補一句，profile-2 由 land 關 | [plans/2026-10-04-balanced-empirical.md](90-agent/plans/2026-10-04-balanced-empirical.md) — *design-intent, 繁體中文* |
```

5. 驗證，每一行都看：

```sh
grep -c "經驗選擇" docs/01-guide/profile.md lib/profile.js
git diff --stat lib/profile.js
node --test tests/profile.test.js tests/profile-table.test.js
node scripts/docs-check.js; echo docs-check=$?
```

   兩檔各 `1`；`lib/profile.js` 是 `1 insertion(+), 1 deletion(-)`；測試全過；`docs-check=0`。

6. 不 commit。回報三個路徑：`lib/profile.js`、`docs/01-guide/profile.md`、`docs/README.md`；訊息：

```text
docs: say balanced's three stations are an empirical choice with no recorded reason

- a line-end comment on PRESETS.balanced, no lines moved — lib/profile.js
- the guide answers blind question 2b in the paragraph that already says no reason is given — docs/01-guide/profile.md
- index row for the plan — docs/README.md
```

## Coverage

| promise | task |
|---|---|
| lib/profile.js — 在 `balanced:` 上方（約 439 行）加註解：三站是經驗選擇，沒有留下理由；`lean` 的理由只解釋「全部交出去」 | Task 1 第 2 步（改為同一行行尾，見 Risks：不移動被引用的行號；註解兩半都寫） |
| docs/01-guide/profile.md — 第 57 行「它沒有解釋為什麼……這三站」之後補一句 | Task 1 |
| docs/90-agent/todo/profile-2.md — 刪除：完成條件達成後，由交付的那一項一起刪 | struck — 條目不刪，`docs/90-agent/reference/todo.md:95-97` 規定由 land 以交付 sha 執行 `todo.js done`，本 task registry 的 `todo` 欄已是 `profile-2` |
| proves it done：`grep -n "經驗選擇" docs/01-guide/profile.md lib/profile.js` 現在零筆 | Task 1（第 1、5 步） |
| unverified：docs-check 會不會因為 profile.md 的引用行號移動而報錯 | Task 1（行尾註解不移行，第 5 步跑 docs-check） |
