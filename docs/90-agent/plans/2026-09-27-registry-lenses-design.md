---
status: design-intent
last_verified: 2026-09-27
---

# Ready 四條 ＋ 兩個 lens：hook 逾時、claims 弱證據、per-session worktree、intends、diff lens、prompt lens

session 6ee7bdc5-cf85-4b6d-8053-88aeeae3e786 的 design 站，2026-09-27。
描述的是要做成的樣子，不是現在的樣子。沒有畫面改動，不畫 mockup：station 的
分組鍵在 worktree 放進 `.fankeel/worktrees/` 之後不變。

使用者 2026-09-27 定案的兩件：worktree 開在 `.fankeel/worktrees/<session 前 8 碼>/`，
profile `worktree: true` 時 `task.js start` 自動開；prompt lens 用
`docs/90-agent/reference/improvement-brief.md:417-425` 的刪除／還原測試。

六塊彼此大多不共檔，plan 依 `**Files:**` 分組。

## 1. hook 逾時

- `lib/dirty.js:82` 的 `execFileSync('git', ['status', …])` 加 `timeout: 2500`。
  逾時由既有的 catch 轉成 `null`，這一輪不寫 claim；不加新分支。
- 測試：一個睡 5 秒的假 `git` 放在 PATH 前面，`dirtyPaths` 在 3 秒內回 `null`。

## 2. claims 弱證據

- 新欄位 `seen`：`lib/dirty.js` 的 git 掃描寫進 `seen`，不再寫 `claims`；
  `claims` 只剩 `hooks/touch.js` 寫。上限同 `MAX_CLAIMS`（60，舊的先丟），
  `registry.seenOf(data)` 對舊紀錄回 `[]`，不遷移。
- 衝突只算「有效路徑」：`claims ∪ (seen − 任何 live session 的 claims)`。
  也就是 git 看到、但有 live session 用 touch 直接碰過的檔，不算這一方的衝突；
  沒人碰過的 shell 寫入仍算。一個函式 `effectiveClaims(data, liveOthers)`，
  放 `lib/guard.js`，`blockers()`（`lib/guard.js:123-135`）、
  `scripts/task.js:357` 的 `collisions()` 與 `hooks/inject.js:197-199` 的
  CLASH 計數都改用它。
- 顯示：注入區塊的 `touched:` 與 station 列出 `seen`，標成弱（`seen:` 一行），
  不進 CLASH／guard。
- 測試：兩個 live session 都只在 `seen` 有 `f` → `blockers` 空、無 CLASH；
  其中一方 `claims` 有 `f` → 另一方 `claims` 也有 `f` 才算衝突；
  沒有任何 live session `claims` 有 `f`、一方 `seen` 有 → 算。

## 3. per-session worktree

- profile 新鍵 `worktree`（`true`／`false`，內建 `false`）。為 `true` 時
  `task.js start` 在 `.fankeel/worktrees/<id8>/` 開 `git worktree add -b fk/<id8>`，
  記進紀錄 `worktree: { path, branch }`；`adopt` 連同它一起帶過去。
- `.fankeel/.gitignore` 加 `worktrees/`，主樹的 `git status` 與 Grep 看不到它。
- 路徑一律記「邏輯路徑」：`hooks/touch.js` 與 `lib/dirty.js` 碰到
  `.fankeel/worktrees/<id8>/` 底下的檔，去掉這段前綴再記；`lib/dirty.js` 對有
  `worktree` 的紀錄在 `worktree.path` 跑 `git status`。
- guard／CLASH：雙方 `worktree` 不同（含一方沒有）時，同一邏輯路徑不擋、不亮
  CLASH，只在注入區塊列 `merge:` 一行，說 land 時會在這幾個檔碰頭。
- 注入區塊與 stage agent 的 brief 多一行 `worktree: <path>（branch）`，
  說工作在那裡做、`commit.js` 從那裡跑。
- land：`skills/fankeel-land/SKILL.md` 的 merge 步驟改讀 `worktree` 欄位：
  主樹 merge `fk/<id8>`、整套測試綠了才 `git worktree remove` 與 `git branch -d`；
  `scripts/residue.js` 的 `worktreesOf` 把 live 紀錄指著的 worktree 標為使用中。
- 測試：profile 開啟時 `start` 產出目錄與分支、紀錄有 `worktree`；
  worktree 裡的一次 touch 記成 `lib/x.js`；兩個不同 worktree 碰同一檔 →
  `blockers` 空、`merge:` 有該檔。

## 4. intends

- 新欄位 `intends`（上限 60 條路徑，寫法照 `addClaim`）。新指令
  `task.js intends <file> --session <id>`：plan 檔用 `parsePlan` 攤平各 task 的
  modify／test，design 檔用 `filedPaths`（`lib/plantasks.js:355`），
  整份取代舊的 `intends`。
- 同一指令印出與鄰居的比對：我的 `intends` 對鄰居的 `effectiveClaims ∪ intends`，
  依鄰居 stage 分級——`build`／`verify`／`audit`／`land` 為 `warn`，其他為 `note`。
  只印，不擋。
- 呼叫點：plan 站 gate 前、build 站開始時各跑一次，寫進 `lib/stages.js` 兩站的
  rules 各一行，也寫進 fankeel-plan、fankeel-build 兩個 skill。
- 測試：鄰居在 build 且 `claims` 含 plan 列的檔 → 印 `warn`；
  鄰居在 design 且 `intends` 含 → 印 `note`；沒有交集 → 印 `none`。

## 5. diff 加派 lens

- `agents/fankeel-reviewer.md` 在 `## Security` 之後加 `## Silent failure`
  （每個 catch／fallback／`?.`：吞錯、沒記錄、過寬的 catch）與 `## Comment`
  （每句註解對程式碼逐句核對），形狀照 `## Security`，結尾同樣一行計數。
- 新 `scripts/lenses.js <range>`：讀 `git diff <range>` 的新增行，
  碰到 `catch`／`except`／`.catch(`／`|| fallback` 類印 `silent-failure`，
  碰到註解行印 `comment`；邏輯在 `lib/lenses.js` 的 `lensesFor(diffText)`。
- `skills/fankeel-build/SKILL.md` 與 `skills/fankeel-verify/SKILL.md` 派 reviewer 前
  跑它，把印出的 lens 名寫進 brief。
- 測試：`lensesFor` 對含 `catch (` 新增行的 diff 回 `silent-failure`，
  只改註解的回 `comment`，都沒有回 `[]`；`tests/agents.test.js` 釘兩個新段落。

## 6. prompt lens

- `skills/fankeel-audit/SKILL.md` 在 `input-check.js` 段後加一節：讀
  `lib/stages.js` 的 `ALWAYS`、各站 rules、`controlRules`，以及 skills／agents 裡
  注入的規則，每條配上方註解寫的原因；原因指的事件或測試已不存在的列為候選。
- 候選才跑刪除測試（`improvement-brief.md:417-425`）：刪掉該條、跑釘它的測試；
  沒紅又沒有現存原因的，在 audit gate 列為「移出注入」，不自行刪。
- 測試：本任務自己的 audit 站跑一次，產出的每個候選都附規則與原因的 `path:line`；
  候選為零時用一條人為加入、原因指向不存在檔案的規則當對照，必須被列出。

## 不做

- 不改 `claimsOf()` 的回傳形狀；不做 per-entry 來源標記。
- worktree 不自動解 merge 衝突；衝突照 land skill 交給使用者。
- intends 不擋任何編輯。
