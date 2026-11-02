---
status: design-intent
last_verified: 2026-11-03
---

# worktree 不放在 repo 裡 Implementation Plan

**Goal:** plugin update 複製進 cache 的只有 git 追蹤的檔，worktree 在 repo 裡建或刪都不會讓 update 失敗。
**Architecture:** 本機 `fankeel` marketplace 改指向乾淨 clone `F:/ymlab/fankeel-dist`；發版時先在那份 clone `git pull --ff-only` 再 update。程式不動，改的是 README 的開發機說明、發版記憶與使用者自己的設定。
**Tech Stack:** Claude Code plugin marketplace（`directory` 來源）、git。
**Spec:** [../records/task-20261102T205616/design.md](../records/task-20261102T205616/design.md)

## Global Constraints

- 使用者設定（`claude plugin marketplace remove/add`）只由使用者自己跑（fankeel SKILL.md「Never set or clear」精神；系統規則：改設定要使用者本人做）。
- profile：land merge、no push（`task.js profile show`）——本做法不需要 push。
- README 是人讀的頁，繁體中文、短（docs.json 的 `audience: human`）。

## Risks

- `claude plugin marketplace remove fankeel` 可能一併解除安裝 fankeel 並清掉設定 — Task 3 — marketplace 名稱取自 `.claude-plugin/marketplace.json` 的 `name`（`fankeel`），不能用新名字並存，所以先備份 `installed_plugins.json` 與 `known_marketplaces.json`，切換後對照，少了東西就還原備份。

## Task 1: README 的開發機更新說明

**Files:**
- Modify: `README.md` — 「更新」段後加開發機說明

**Interfaces:**
- Consumes: none
- Produces: 發版步驟 `git -C F:/ymlab/fankeel-dist pull --ff-only`

**Dispatch:** in-session — 一次編輯，派出去比做完還貴。

1. In `README.md`, after the 「更新」 code block that ends with `claude plugin update fankeel@fankeel`, add:

```md
**開發機**——marketplace 不要指向正在開發的工作目錄：本機目錄來源會把整個資料夾連同 `.claude/worktrees/`、`.fankeel/build/` 一起複製進快取，複製到一半有 worktree 被刪掉就失敗。改指向一份只拿來發版的 clone，發版前先 pull：

    git clone F:/ymlab/fankeel F:/ymlab/fankeel-dist
    git -C F:/ymlab/fankeel-dist pull --ff-only
```

2. Run `node scripts/docs-check.js` and confirm no new finding on `README.md`.
3. Commit `docs: dev-machine marketplace points at a clean clone`.

## Task 2: 發版記憶加 pull

**Files:**
- Modify: `C:/Users/user/.claude/projects/F--ymlab-fankeel/memory/fankeel-release-every-change.md` — 發版步驟加一行

**Interfaces:**
- Consumes: Task 1 的指令
- Produces: none

**Dispatch:** in-session — repo 外的記憶檔，一次編輯。

1. In `C:/Users/user/.claude/projects/F--ymlab-fankeel/memory/fankeel-release-every-change.md`, replace `then \`claude plugin marketplace update fankeel\`` with:

```md
then `git -C F:/ymlab/fankeel-dist pull --ff-only` (the marketplace reads that clean clone, not the working tree — set 2026-11-03), then `claude plugin marketplace update fankeel`
```

2. No commit: the memory directory is not in the repo.

## Task 3: 使用者切換 marketplace，並驗證 update

**Files:**
- Modify: `C:/Users/user/.claude/plugins/known_marketplaces.json` — 由使用者的 CLI 指令改，不手寫
- Modify: `C:/Users/user/.claude/plugins/installed_plugins.json` — `claude plugin install` 改寫
- Modify: `F:/ymlab/fankeel-dist` — `git clone` 新建的發版 clone

**Interfaces:**
- Consumes: Task 1 的指令
- Produces: `fankeel` marketplace 的 source 是 `F:/ymlab/fankeel-dist`

**Dispatch:** user — 改 Claude Code 設定只由使用者本人跑。

1. 使用者先備份兩個設定檔，再切換：

```
copy %USERPROFILE%\.claude\plugins\installed_plugins.json %USERPROFILE%\.claude\plugins\installed_plugins.json.bak-1103
copy %USERPROFILE%\.claude\plugins\known_marketplaces.json %USERPROFILE%\.claude\plugins\known_marketplaces.json.bak-1103
git clone F:/ymlab/fankeel F:/ymlab/fankeel-dist
claude plugin marketplace remove fankeel
claude plugin marketplace add F:/ymlab/fankeel-dist
claude plugin install fankeel@fankeel
```

2. 確認 `claude plugin list` 仍列 `fankeel@fankeel`，`known_marketplaces.json` 的 fankeel path 是 `F:\ymlab\fankeel-dist`；與 `.bak-1103` 對照，少了的條目就把備份複製回去。
3. 驗證（設計的 proves it done）：在工作目錄建一個 worktree，再照新的發版步驟 pull、update，然後看新版 cache：

```
git -C F:/ymlab/fankeel worktree add .claude/worktrees/probe-1103 --detach
git -C F:/ymlab/fankeel-dist pull --ff-only
claude plugin marketplace update fankeel
claude plugin update fankeel@fankeel
ls ~/.claude/plugins/cache/fankeel/fankeel/<新版本>/.claude/worktrees
git -C F:/ymlab/fankeel worktree remove .claude/worktrees/probe-1103
```

update 成功，且 `ls` 回報找不到 `.claude/worktrees` 才算過；這一步要在本次發版（版本號變了）之後跑，update 才會重新複製。

## Coverage

| promise | task |
|---|---|
| 本機 `fankeel` marketplace 改指向乾淨 clone `F:/ymlab/fankeel-dist` | Task 3 |
| `README.md` 的更新段加三行：開發機的 marketplace 指向乾淨 clone，不指向工作目錄。 | Task 1 |
| 記憶 `fankeel-release-every-change.md` 的發版步驟加那一行 pull。 | Task 2 |
| 設定變更（clone、marketplace remove／add）由使用者自己跑。 | Task 3 |
| `.claude/worktrees/` 下有 worktree 時發版後 `claude plugin update fankeel@fankeel` 成功，新版 cache 目錄沒有 `.claude/worktrees` | Task 3 |
