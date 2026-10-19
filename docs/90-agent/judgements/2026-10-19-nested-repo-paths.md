---
judged: 2026-10-19T17:57:03.313Z
model: fable
agent: fankeel-judge
task: "TODO 全表盤點"
session: 45487ab9-c8fc-44c7-a0db-d46d41bb4796
stage: build
---

# 巢狀 repo 的路徑、commit.js 的 cwd、spike 的 build 關卡：規則該放在哪裡、怎麼改

## Question

# 巢狀 repo 的路徑、commit.js 的 cwd、spike 的 build 關卡：規則該放在哪裡、怎麼改

## 問題

這份 brief 來自一次 retro：2026-10-20 的 VoiceLedger 任務，session d5e86a6b。
工作區 `F:/production` 是 registry 根；`VoiceLedger/` 是放在它裡面的另一個 git repo。
retro 列出三項說明文字要修。每一項請判斷三件事：
- 規則實際在哪些地方被讀到：skill、agent 檔，或 `lib/stages.js` 注入的文字。
- 每個地方各該改成什麼。
- 字數上限會不會擋下這次修改。
最後請判斷選做的 commit.js 程式修改值不值得做。

### 第 1 項：commit 檔裡的路徑以哪個根為準

- 位置：`agents/fankeel-brain.md:146` 寫的是「Paths are relative to the repository root.」
  - 使用者還提到 `agents/fankeel-brain-high.md:140` 和 `-xhigh.md:140`。不過 `agents/` 目錄裡只有 `fankeel-brain.md`；`lib/agentfile.js:111` 有一段註解說 effort 變體是產生出來的。請確認這兩份從哪裡產生、怎麼重新產生，以及重新產生之後是否還有需要 commit 的檔案。
- 發生的事：stage agent 寫出 `VoiceLedger/tests/test_parser.py`，這是從 registry 根算的路徑；commit.js 卻從 VoiceLedger 的 repo 根解讀，`git add` 因此回報 pathspec did not match。
- 想要的改法：路徑以擁有該檔的 git repo 根為準。在上面的例子要寫 `tests/x.py`，不寫 `VoiceLedger/tests/x.py`。
- 另一件要找的事：commit 檔格式的其他說明裡，有沒有同一句規則。可以查 `scripts/commit.js` 的 usage、`skills/fankeel-build/SKILL.md`、`lib/stages.js`、`docs/90-agent/reference/*`。

### 第 2 項：commit.js 要在哪個 cwd 執行

- 位置：`skills/fankeel/SKILL.md:633` 寫的是「Run `node <plugin>/scripts/commit.js <file>` yourself:」
- 發生的事：主 session 在 `F:/production` 執行，得到「commit.js: not inside a git repository」；cd 到 VoiceLedger 之後才成功。
- 想要的改法：寫明 shell 要在擁有那些路徑的 repo 裡執行。
- 注入給 controller 的規則也要一起改。其中一條是「If it returns `commit <file>`, run `node <plugin>/scripts/commit.js "<file>"` and SendMessage it what that printed, exactly.」。也請一併查 `scripts/await.js` 印出的提示文字（例如 `group 5, agent …: commit <file> — run …`）。

### 第 3 項：spike 的 build 關卡

- 位置：`skills/fankeel-build/SKILL.md:18`，就是「`spike` has neither, ...」那一行。
- 發生的事：spike 的 build 關卡把「在 parser.py 加 Gemini 後端」放在選項一。使用者一選，拋棄式的試驗就變成改正式程式，路線到中途才升級成 bounded。
- 要加的規則：spike 的 build 關卡只交出答案，不提供「動手做 X」。需要寫正式程式時，先說明要升級成 bounded，再發問。
- 請判斷這條規則最好放在哪裡，並說明理由。候選有三個：
  - `skills/fankeel-build/SKILL.md`
  - brain 寫關卡的規則（`agents/fankeel-brain.md`）
  - `lib/stages.js` 的 build 規則或 spike 專用規則
- 判斷時要考慮兩件事：有 `stage.agents` 時，關卡由 brain 寫；沒有時，由 session 自己寫。另外請說明，現有的「one-way ratchet」規則是否已經涵蓋這個情況，或者還差在哪裡。

### 限制

- 每一項都改在規則真正被讀到的每一個地方。
- 改完要跑 `npm test`。`skills/registry.json` 有每個 stage 的字數上限；超過時精簡句子，不刪其他規則。請算出每個受影響的檔案目前用了多少、上限多少、還剩多少。
- 每項一個 commit，訊息用 `type: what changed` 格式。

### 選做（改程式，做之前要先問使用者）

內容：當 cwd 不在 git repo 裡時，讓 `scripts/commit.js` 從 commit 檔的第一個路徑找出它所屬的 repo，並去掉多出來的巢狀 repo 前綴。

請判斷：
- 這樣做會不會蓋過第 1、2 項，讓那兩項的說明文字變成多餘。
- 風險是什麼，例如路徑跨兩個 repo、registry 根本身就是 repo（本 repo `F:/ymlab/fankeel` 就是這種情況）。
- 是否建議做，以及最小的做法。

## 要讀的路徑（`F:/ymlab/fankeel` 底下）

- `agents/fankeel-brain.md`（約第 146 行，加上它寫關卡的段落）
- `lib/agentfile.js`（產生變體的部分）
- `scripts/commit.js`
- `scripts/await.js`（commit 的提示文字）
- `skills/fankeel/SKILL.md`（約第 633 行）
- `skills/fankeel-build/SKILL.md`（約第 18 行）
- `lib/stages.js`（build、controller、spike 的規則）
- `skills/registry.json`（字數上限）
- `tests/skill-size.test.js`，以及其他斷言這些句子的測試（用 grep 找原句）

## 怎樣算是答案

- 每一項各給一組結果：
  - 要改的檔案，寫到 `path:line`
  - 新的英文措辭，可以直接貼上
  - 字數上限的剩餘空間
  - 會受影響的測試
- 第 3 項要說明選了哪個位置，以及為什麼。
- 選做部分給出建議做或不做，附上理由；如果建議做，給出最小的設計。

## 回答的形式

依照 fankeel-judge 的六個欄位作答，包含 `pick:` 行，後面接 `## Summary`。Summary 裡分三項和選做四段，每段列出要改的地方和措辭。

## Answer

```text
pick: 第 1、2 項改 agents/fankeel-brain.md:146、skills/fankeel/SKILL.md:633、lib/stages.js:650、scripts/await.js:178（四處皆放得下）；第 3 項放 skills/fankeel-build/SKILL.md:18，同段精簡換空間；選做的 commit.js 自動找 repo 不建議做，最小只改 :215 的錯誤訊息。
why: brain 讀 agents/fankeel-brain.md + fankeel-build/SKILL.md（brain.md:26-27「Read the skill first」），不讀 lib/stages.js 的 build 規則（rulesFor 只在 lib/render.js:195 注入給 session）；無 stage.agents 時 session 讀 stages.js:314 + 同一份 skill。fankeel-build/SKILL.md 是兩條路都讀的唯一檔案。
  字數上限在 tests/skill-size.test.js:12（UTF-8 bytes），不在 skills/registry.json：fankeel 65485/65600 剩 115、fankeel-build 40006/40100 剩 94；brain.md、stages.js 無 byte cap，但 controlled build 區塊 2243/2400（tests/render.test.js:781）。
  effort 變體已於 2026-10-15 退役（lib/agentfile.js:111-114），agents/ 只有 15 個基底檔，無東西要重新產生。
  commit.js:214-215 以 cwd 的 toplevel 為根，:16-18 註解已說「paths are relative to that」；registry 根本身是 repo 時「cwd 不在 repo」的觸發永遠不成立，所以程式改了說明文字仍不多餘。
  Reader E 說 tests/ 沒有「relative to the repository root」—錯，tests/brief.test.js:522 正好釘住那句，改 brain.md 必須同步改它。
would flip if: hooks/brief.js 或 lib/render.js 其實把 lib/stages.js 的 build 規則也送進 brain 的 brief（那 stages.js 就是兩條路共用、較便宜的位置）；或 fankeel-build/SKILL.md 精簡後仍超過 40100 且使用者不願調 cap。
unread: nothing（skills/registry.json 只 grep 過 cap 關鍵字、無命中；docs/90-agent/reference/* 只 grep 未整頁讀）
delegated: agents/fankeel-brain.md + lib/agentfile.js (opus)；scripts/commit.js + scripts/await.js + lib/ hooks/ grep (opus)；skills/fankeel/SKILL.md + skills/fankeel-build/SKILL.md (sonnet)；lib/stages.js (opus)；skills/registry.json + tests/skill-size.test.js + tests/ grep + 字數計算 (sonnet)；docs/ README.md skills/*/SKILL.md scripts/ lib/ grep (sonnet)
checklist: 1 brain.md:146 與關卡段落 — answered；2 agentfile.js 變體產生 — answered（已退役，無檔案）；3 commit.js 根的判定 — answered；4 await.js 提示文字 — answered；5 fankeel/SKILL.md:633 — answered；6 fankeel-build/SKILL.md:18 — answered；7 stages.js build/controller/spike/ratchet — answered；8 字數上限與目前用量 — answered（cap 在 test 不在 registry.json）；9 釘住原句的測試 — answered（修正 reader 漏報）；10 reference 文件同句 — answered
```

## Summary

### 誰讀到什麼（三項共用的前提）

- controlled build（`stage.agents` 含 build）：session 只收 controller 區塊（`F:/ymlab/fankeel/lib/stages.js:689-710`，經 `F:/ymlab/fankeel/lib/render.js:145`、`:195` 的 `control ? control.rules : rulesFor(...)`）；brain 收 `F:/ymlab/fankeel/agents/fankeel-brain.md`、brief（`lib/render.js:630-631`）與 stage skill（`agents/fankeel-brain.md:26-27`：「the path of the stage's skill … Read the skill first」）。`rulesFor(` 在 lib/ hooks/ scripts/ 只被 `lib/render.js:195` 呼叫，`hooks/brief.js` 無 `rulesFor`/`byName`/`.rules`，所以 brain 完全不會看到 `lib/stages.js` 的 build 規則。
- 非 controlled build：session 收 `lib/stages.js` build 規則（`:314`「Read the fankeel-build skill on entry…」）加 `ALWAYS`（`:125` 關卡規則），並由 `lib/render.js:601` 被叫去先讀 `skills/fankeel-build/SKILL.md`。
- 結論：`F:/ymlab/fankeel/skills/fankeel-build/SKILL.md` 是兩條路徑都讀的唯一檔案；`agents/fankeel-brain.md` 只到 controlled；`lib/stages.js` 的 stage 規則只到非 controlled；`COMMIT_RULE`（`:650`，`:704` 只在 build/design/plan 且 controlled 時注入）只到 controller。

### 字數上限（實測）

- cap 不在 `skills/registry.json`（grep chars/max/limit/size/cap 無命中），在 `F:/ymlab/fankeel/tests/skill-size.test.js:12` `CAPS = { fankeel: 65600, 'fankeel-build': 40100 }`、`:13` 其他 24000，單位是 UTF-8 bytes（`scripts/input-check.js:185-194`，`Buffer.byteLength`），只量 `skills/*/SKILL.md`（`:24-29`）。`:8-11` 註明「growing past it is a decision, made by raising it here」。
- 現況（我以同法重算）：`skills/fankeel/SKILL.md` 65485/65600，剩 115；`skills/fankeel-build/SKILL.md` 40006/40100，剩 94；`agents/fankeel-brain.md` 15099 bytes，無 cap（`tests/agents.test.js` 無 byteLength/length 斷言）。
- 注入區塊：`tests/render.test.js:569` 每 stage 全文 < 2400（build 目前 2282，spike class 2271）；`:781` controlled build 區塊 < 2400，實測 render 2055、resume 2243（resume 是綁死的那個）；`tests/stages.test.js:102` 各 stage 規則本身 < 2000 chars（build 957）。

### 第 1 項：commit 檔路徑以哪個根為準

要改的地方：
- `F:/ymlab/fankeel/agents/fankeel-brain.md:146`「Paths are relative to the repository root.」—brain 在 controlled build/design/plan 寫 commit 檔時讀的唯一規則。
- `F:/ymlab/fankeel/tests/brief.test.js:522` 的 regex 以 `Paths are relative to the repository root\. The reply is those lines…` 開頭，必須同步改（reader E 回報 tests/ 無此句，是漏報；我 grep 確認只有這一處）。
- 其他說明裡沒有同一句：`skills/fankeel/SKILL.md:632` 只寫「the entry's path, a blank line, the message」；`skills/fankeel-build/SKILL.md` 無 commit 檔格式段（只有 `:177`、`:305-306` 說 parent 暫存 `**Files:**` 的路徑）；`lib/stages.js` 無 repository root/relative to；`lib/render.js:630-631` brain brief 只給 commit 檔的路徑；`F:/ymlab/fankeel/scripts/commit.js:16-18` 標頭註解寫「runs git from the top of the repository the current directory is in, so the paths are relative to that」—描述正確，可選擇補一句「that is, the repository that owns them」，非必要。
- reference 文件（非 agent 讀）：`F:/ymlab/fankeel/docs/90-agent/reference/subagents.md:762`「in the repository the controller is standing in」、`:957-958`「commits in the repository at the controller's working directory, and does not consult the task's `project`」—敘述仍為真，可各加一句「with a nested repository the controller runs it from inside that one」保持 docs-check 一致，非本項必改。

新措辭（brain.md:146，取代原句）：
`Paths are relative to the root of the git repository that owns them, never to a directory above it: `tests/x.py`, not `<repo>/tests/x.py`.`
手算 42 → 138 bytes（+96），brain.md 無 cap。`tests/brief.test.js:522` 的開頭改成 `/Paths are relative to the root of the git repository that owns them, never to a directory above it: `tests\/x\.py`, not `<repo>\/tests\/x\.py`\. The reply is those lines…/`。

effort 變體：`F:/ymlab/fankeel/lib/agentfile.js:111-114` 註明 `fankeel-brain-xhigh` 等變體 2026-10-15 退役，effort 改掛在 dispatch 上；`:115-117` `baseAgent()` 只把舊 transcript 的變體名讀回基底名。`git ls-files agents/` 15 個基底檔、無變體，`check-ignore` 也沒有。使用者提到的 `fankeel-brain-high.md:140`、`-xhigh.md:140` 不存在，沒有東西要重新產生。`agentfile.js:95-108` 的 `refresh`/`syncAgent` 是把 plugin 的 `agents/<name>.md` 複製成 profile 層的覆寫檔（在使用者 agents 目錄、帶 generated_by 標記，版本不同時重寫）—這些在 repo 外，不需 commit；只要照慣例 bump 版本，下一次 start 會自行重寫（誰呼叫 refresh 我沒追，reader A 也未查）。

受影響測試：`tests/brief.test.js:522`；`:545-550` 只查 section 存在 `Do not run scripts/commit.js`，不受影響。

### 第 2 項：commit.js 在哪個 cwd 執行

實際行為：`scripts/commit.js:199` `main(argv, cwd)`，`:323` 不傳 cwd，`:214` `repoRoot(cwd)` → `lib/tracked.js:57-63` `git rev-parse --show-toplevel` 於 `process.cwd()`；`:215` 不在 repo 印「commit.js: not inside a git repository」；`:301` `git add -- <paths>` 以 `topDir` 為 cwd，路徑原樣送 git。無 `--repo`/`-C`，一個檔只能進一個 repo（`:200`）。另注意 `:216-217`：profile 與 `.fankeel/sensitive.txt` 從 cwd 所在的 checkout 讀——cd 進巢狀 repo 後，讀到的是那個 repo 的 profile（`commit.format` 等），不是 registry 的；這是 cd 作法的副作用，說明文字可不提但要知道。

要改的地方與新措辭：
1. `F:/ymlab/fankeel/skills/fankeel/SKILL.md:633`（session 中途開 TODO 時讀）：
   `` `commit <file>`. Run `node <plugin>/scripts/commit.js <file>` yourself, from a shell inside the repository that owns that path: ``
   +56 bytes → 剩 59。無測試釘「yourself:」。
2. `F:/ymlab/fankeel/lib/stages.js:650` `COMMIT_RULE`（controller 規則，`:704` build/design/plan）：
   `If it returns `commit <file>`, run `node {{COMMIT}} "<file>"` from inside the repository its paths belong to, and SendMessage it what that printed, exactly. No gate; wait.`
   +48 chars → controlled build resume 2243 → 2291（cap 2400，剩 109）。要改 `F:/ymlab/fankeel/tests/render.test.js:779` 的精確 regex；`tests/stages.test.js:990` 只查 `includes('commit <file>')`，不受影響；`tests/cjk-control.test.js:25` 只呼叫 controlFor，不受影響。
3. `F:/ymlab/fankeel/scripts/await.js:178`（commit 檔出現時印給 controller 的提示）：
   `' — run `node ' + COMMIT_SCRIPT + ' "' + commitFile + '"` from inside the repository its paths belong to and SendMessage the agent what it printed, exactly. After a `commit.js:` line, run await again with `--since "' + commitFile + '"` added.'`
   無 cap。`tests/await.test.js:100` 只釘到 `commit.js "`、`:101` 只釘尾段 `run await again with --since … added.$`、`:211/:238/:244` 只 `startsWith('commit … — run')`，中段可改。
   未查：`commitFile`（`:69-70` `commitPath(root, …)`）是否絕對路徑；若是相對 registry 根，cd 進巢狀 repo 後 `:203` `readFileSync(argv[0])` 會找不到檔，提示應改印絕對路徑。請在改之前確認。
4. `agents/fankeel-brain.md` 不用改（brain 不執行 commit.js，`:150-152` 已說 no repository 會 block）。

受影響測試：`tests/render.test.js:779`（必改）；其餘不動。

### 第 3 項：spike 的 build 關卡

選 `F:/ymlab/fankeel/skills/fankeel-build/SKILL.md:18`。理由：
- 這是 brain（controlled）與 session（非 controlled）都讀的唯一檔案（見前提段）。放 `agents/fankeel-brain.md` 只蓋 controlled 一路；放 `lib/stages.js:314` 旁的 build 規則只蓋非 controlled 一路，且 build 注入已 2282/2400，再加會先擠掉別的；spike 在 stages.js 沒有專用規則區（`:495-498` 只有 `means` 一句）。
- `:18` 本來就是 build skill 裡唯一提到 spike 的句子，又在「Done when」段——關卡就是 done 的那一刻，規則放在讀者已被告知「spike 對著問題計數」的地方。
- ratchet 現況：`skills/fankeel/SKILL.md:285-286`、`skills/fankeel-survey/SKILL.md:323-326`（「stop, say so, and re-route with task.js route」）、`lib/stages.js:230`（只注入 survey）、`:490-493`（程式註解，不注入）、`docs/02-architecture/pipeline.md:462`。它規定「發現複雜就升級、要說出來、不降級」，但 (a) build 階段看不到這條（只注入 survey；brain 更看不到 stages.js），(b) 它講的是「發現複雜度」，沒講關卡選項不得把正式修改當成一個可選動作。`ALWAYS :125`「Option one is the approval: {{NEXT}}」和 `agents/fankeel-brain.md:216`「option one naming the next stage」在 spike 的 build 其實沒有 next stage，所以「加 Gemini 後端」當選項一本就不合規，但沒有任何一句說「答案是交付物、升級在發問之前」。缺的就是這句。

新措辭（取代 `:15-18`，同段精簡 `, the same way the decomposition is `plan`'s` 這句類比與「no plan」→「none」，不刪規則）：
`**The denominator is the ledger where there is a plan** — and `design`'s file table where there is none, which is every `bounded` task. A `spike` has neither, and what it counts against is the question it was asked: its gate gives the answer, never an offer to do the work; lasting code first upgrades the route to `bounded` — say so, then ask.`
手算淨增約 +83 bytes → 約 40089/40100，剩約 11；提交前以 `node scripts/input-check.js --skills` 實算。若仍超過，`tests/skill-size.test.js:12` 把 `'fankeel-build'` 調高到實測值是該測試註解允許的決定。tests/ 無任何測試釘 `has neither`、`denominator is the ledger` 或 `same way the decomposition`。

可選鏡像：若要讓非 controlled session 在不讀 skill 時也看到，`lib/stages.js` build 規則加一句短的（如 `spike: the gate hands over the answer; lasting code upgrades the route first.`，約 80 chars，build 注入 2282 → 約 2362 < 2400），但我不建議——兩條路都已被叫去先讀 skill，重複只花 cap。

### 選做：commit.js 自動找 repo、去巢狀前綴

- 不會讓第 1、2 項多餘：(a) registry 根本身是 repo 時（本 repo `F:/ymlab/fankeel`），`:214` `repoRoot(cwd)` 非空，「cwd 不在 repo」永遠不觸發，`Nested/tests/x.py` 照樣送進外層 repo 的 `git add` 被拒；要蓋這情況得在 repo 內逐路徑判歸屬並改寫 brain 寫的東西，那就不是「cwd 不在 repo 時」的小改。(b) 路徑是 brain 在任何腳本跑之前寫的，哪個根的規則只能靠文字。(c) 自動改寫會把 brain 的錯誤吞掉，與 `agents/fankeel-brain.md:150-151`「fix it and ask again」的回圈相反。
- 風險：一個 block 跨兩個 repo（一個 commit 不能跨 repo，必須拒絕）；以第一個路徑猜 repo，第一個是 registry 層檔案（例如 TODO 條目在 registry 的 docs bucket）、其餘在巢狀 repo 時會猜錯；`:216-217` profile 與 sensitive 從 `home` 讀，cwd 無 repo 時 `home` 為 null，得另定從哪個 repo 讀；`:227-229` `into` 的 `commonDir` 比對以 `home` 為準，`home` 變了接受的 worktree 集合也變。
- 建議：不做自動解析。最小而值得的程式改動是 `scripts/commit.js:215` 的訊息改成 `commit.js: not inside a git repository — run from the repository that owns the listed paths, with paths relative to its root`（一行、無行為變更、`tests/commit.test.js` 若有釘此句需同改——我沒查該測試是否釘住 :215 的字串）。第二步才考慮：`git add` 被拒時檢查 `path.resolve(topDir, p)` 是否落在另一個 repo（`repoRoot(dirname) !== topDir`），印 `commit.js: <p> belongs to <root>: write it relative to that root and run from there`，約十行，仍不改寫路徑。

### 抽查結果

每位 reader 各一處以上開檔核對：brain.md:137-154、agentfile.js:93-118、commit.js:1-30 與 196-235、await.js:174-181、fankeel/SKILL.md:628-637、fankeel-build/SKILL.md:12-19、stages.js:123-127、486-507、644-650、689-724、skill-size.test.js:6-31、render.test.js:772-787、subagents.md:760-763 與 955-963、pipeline.md:459-464，內容與 reader 所述一致。唯一出入：reader E 回報 tests/ 無「relative to the repository root」，實際 `tests/brief.test.js:522` 釘住整句，已納入第 1 項。字數部分 reader E 的 bytes 數字我重算相同；controller 區塊與各 stage 注入大小是我自己跑 `tests/render.test.js` 的 diagnostic 與 `lib/render.js` 得到。未能跑的：提議措辭的 byte 差是手算（hook 擋掉含 `>/` 的 node -e），誤差可能幾個 byte，提交前請以 `node scripts/input-check.js --skills` 實算。
