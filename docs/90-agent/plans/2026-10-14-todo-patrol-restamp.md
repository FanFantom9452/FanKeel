---
status: design-intent
---

# TODO 全表盤點（10-14）：兩條上游戳記重蓋、逐塊調整浮層結案、pane-band 收尾 Implementation Plan

**Goal:** 把 10-14 盤點查過仍成立的兩條 Blocked 上游條目（build-1、model-4）重蓋今天的戳記並寫下查到的事實，為本計畫補索引列；tune-4 的結案與 pane-band 併回 main 留給 verify 與 land。
**Architecture:** 只有一個 task，改三個文件檔，不動任何程式。tune-4 的三個改法已在 commit 311450c9、fa2133a8、a12bf0be 落地，使用者 10-13 已在真機用過一次，所以它沒有 build 的工作：verify 跑 `tests/tune-overlay.test.js`，land 用 `todo.js done` 關。pane-band 的合併與殘留 worktree 的清理是 land 的工作。六條要真機的 Ready 條目（brief-3、compact-4、compact-6、pane-1、pane-2、pane-6）照使用者在 survey gate 的裁定留在 Ready，不動。
**Tech Stack:** Node v24.21.0（CommonJS、`'use strict'`、只用內建模組），`node --test`，git 2.56.0.windows.2，fankeel 0.105.0。
**Spec:** [survey.md](../../../.fankeel/build/task-20261013T204705/survey.md)

## Global Constraints

由 `node scripts/map.js`（exit 0；863 份 markdown、19 份 planned 未建、260 份 retired、17 份 undeclared）、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`）、`package.json` 與 `docs/90-agent/reference/todo.md` 產生：

- TODO 條目在 `docs/90-agent/todo/`，沒有 `TODO.md`（`CONTRIBUTING.md` 的 TODO entries 一列）；改完跑 `node scripts/todo-check.js`，exit 0。
- `stamp` 只在 `blocked` 與 `watch` 條目上，格式 `YYYY-MM-DD`，意思是有人在那一天讀過 timing 並同意它仍成立（`docs/90-agent/reference/todo.md:35`）。
- 開放中的條目受 `node scripts/docs-check.js` 檢查：新寫的內文不寫 `path:line`，不把不存在的名字放進反引號。
- 新頁要在同一個變更裡補 `docs/README.md` 的索引列（`CONTRIBUTING.md` 的 Documentation 一列）。
- `READ_CAP` 1500、`FILE_CAP` 3（`lib/plantasks.js`）。
- 行尾 LF（`.gitattributes`）。檔案用 Edit 改，不用 heredoc。
- 實作者只跑自己 task 列出的檢查，不跑全套；不 commit、不 `git add`、不 `git stash`，改完回報要提交的路徑與訊息。commit 訊息最後一行是 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。
- `.fankeel/profile.json` 的本機修改與未追蹤的 `tsconfig.json` 不提交（使用者 10-14 在 survey gate 的裁定）；任何 commit 都只帶自己點名的路徑。

## Risks

- land 會照 registry 的 `todo` 欄印出七行 `todo.js done`，其中六條（brief-3、compact-4、compact-6、pane-1、pane-2、pane-6）不該關 — land — land 只執行 tune-4 那一行。
- tune-4 的 hover 分色只讀過 commit 訊息，沒有逐行開程式（survey 自己說的） — verify — verify 跑 `node --test tests/tune-overlay.test.js`，並開 `assets/tune/overlay.js` 對條目的三個改法各找到一處；有一個找不到，tune-4 就不關。
- 六個殘留 worktree 裡，`worktree-agent-a3829b328dc7841a9`（commit 59a9a8b0）與 `worktree-agent-abf98796600cccd6f`（commit 4daa5765）各有一個沒併進 pane-band 的 commit — land — land 清 worktree 之前先問使用者這兩個 commit 要併、要留還是丟；其餘四個已併入，可直接移除。
- `docs/README.md` 加一列會讓其後行號下移一行 — Task 1 — 改完跑 `node scripts/docs-check.js`，exit 0 才算完成；若它點名別頁引用的行號，實作者停手回報。

## Task 1: 兩條上游戳記重蓋，並為本計畫補索引列

**Files:**
- Modify: `docs/90-agent/todo/build-1.md` — `stamp` 改 2026-10-14，內文補 10-14 查到的 knip 版本
- Modify: `docs/90-agent/todo/model-4.md` — `stamp` 改 2026-10-14，內文補 10-14 重讀官方說明的結果
- Modify: `docs/README.md` — 在 10-05 盤點計畫那列之後補本計畫一列

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet

1. 在 `docs/90-agent/todo/build-1.md` 的 frontmatter 裡，把整行 `stamp: 2026-10-13` 換成：

```md
stamp: 2026-10-14
```

2. 在 `docs/90-agent/todo/build-1.md` 內文第一段（以「來源：3dc97182」開頭、以「仍是 (no imports found)。」結尾的那一段）的最後，接在同一段後面加一句：

```md
2026-10-14 的盤點查 `npm view knip version`，仍是 6.41.0，與 10-10 重跑的是同一版，沒有新版可試。
```

3. 在 `docs/90-agent/todo/model-4.md` 的 frontmatter 裡，把整行 `stamp: 2026-10-12` 換成：

```md
stamp: 2026-10-14
```

4. 在 `docs/90-agent/todo/model-4.md` 內文最後一段（以「查證結果（2026-10-05」開頭）之後空一行，加入：

```md
2026-10-14 的盤點重讀官方 fast mode 說明：仍只支援 Opus 5.5、Opus 5 與 Opus 4.8，寫明 Sonnet 與 Haiku 不能用；仍是 `/fast` 或 `fastMode` 設定的整個 session 開關，頁面沒有任何依 agent 個別設定的欄位。上游沒有變，繼續等。
```

5. 在 `docs/README.md` 裡，「TODO 全表盤點（10-05）的 plan」那一列之後加一列：

```md
| TODO 全表盤點（10-14）的 plan：knip 與 fast mode 兩條上游戳記重蓋、逐塊調整浮層在 land 結案、六條真機條目留在 Ready、pane-band 併回 main | [plans/2026-10-14-todo-patrol-restamp.md](90-agent/plans/2026-10-14-todo-patrol-restamp.md) — *design-intent, 繁體中文* |
```

6. 跑 `node scripts/todo-check.js`，exit 0；跑 `node scripts/docs-check.js`，exit 0；跑 `node scripts/todo.js list`，末行仍是 `32 open`。

7. 不 commit。回報三個路徑：`docs/90-agent/todo/build-1.md`、`docs/90-agent/todo/model-4.md`、`docs/README.md`，與計畫檔 `docs/90-agent/plans/2026-10-14-todo-patrol-restamp.md` 一起提交；訊息：

```text
docs: the 10-14 patrol restamps two upstream timings and indexes its plan

- knip is still 6.41.0, the version the 10-10 patrol already tried — docs/90-agent/todo/build-1.md
- fast mode is still Opus-only and one switch per session — docs/90-agent/todo/model-4.md
- index row for the plan — docs/README.md
```

## Coverage

| promise | task |
|---|---|
| build-1 — upstream：`npm view knip version` 仍是 6.41.0，與條目上次試的相同。waiting on knip 新版；restamp 今天。 | Task 1 |
| model-4 — upstream: Sonnet 支援 fast；我沒有重查官方說明。waiting on 上游，restamp。 | Task 1（plan 站已重讀官方說明，結果寫進步驟 4） |
| tune-4 — do now：核對後用 `todo.js done` 結案。 | struck — 沒有要改的檔案；verify 核對、land 關，見 Risks |
| brief-3、compact-4、compact-6、pane-1、pane-2、pane-6 — needs the user。 | struck — 使用者在 survey gate 選留在 Ready |
| `.fankeel/profile.json` 的修改與 `tsconfig.json` | struck — 使用者在 survey gate 選不提交，留在本機 |
| `git worktree list` 還有 6 個 `.claude/worktrees/agent-*` 殘留，land 前該清。 | struck — land 的工作，見 Risks |
| pane-band 分支領先 main 126 個 commit、main 沒有新的，可以直接合併 | struck — land 的工作：profile 的 `land.integration` 是 merge、不 push |
| 其餘 Blocked 與 Watch 條目 — waiting on／keep | struck — 條件未變、戳記未過期，不動 |
