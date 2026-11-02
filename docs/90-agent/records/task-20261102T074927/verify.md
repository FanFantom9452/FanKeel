結論：驗證沒有通過。fast suite 有 2 個失敗，兩個都來自 build 收尾時縮短的 `skills/fankeel-land/SKILL.md`「Agent branches」段，而 build 報告寫「全套 fast 綠」是在縮短之前跑的；縮短之後只跑了兩個測試檔，沒有重跑整套。程式碼本身（commit.js、residue.js、test-audit.js）的六個變異都被測試抓到，所以回 build 只需要修那一段文字。

```
$ node F:/ymlab/fankeel/scripts/suite.js --session 30421c7e-7fcf-4361-be33-90b25dd1ebbb --fast
suite: 6203 pass, 2 fail @ fbe8d2b8
not ok 3105 - this repository's own tree passes its own gate   (unknown-flag: skills/fankeel-land/SKILL.md:404  land.js does not accept --sweep)
not ok 6195 - land merges with land.js, cleans after a green suite, ...  (tests/worktree-docs.test.js:21 找不到 `git branch -D <name>`)
```

```
$ node F:/ymlab/fankeel/scripts/docs-check.js
4 references that no longer resolve:  (skills/fankeel-plan/rationale.md:29,31 gone; todo/model-3.md:12 moved; todo/notify-2.md:18 bare-code)
```

- 五個 task 的程式碼變更（worktree 清理、orphan sweep、hand-off 記 HEAD、test-audit 跳過 bench/）在 ledger 範圍 9b6fa182..1feaa297 加兩筆修正，範圍互不重疊 — held
- 變異補驗（build 只有文字描述，這裡實際跑了 6 個，各由 mutator 套用、跑該測試檔、還原，`git diff --stat` 還原後為空）：6 套用 / 6 殺死 / 0 存活。
  - scripts/commit.js:196 刪掉 `clean` 呼叫 → 「untracked scratch is cleaned and removed」紅（45 pass → 44 pass 1 fail）
  - scripts/commit.js:196 拿掉 `!tracked.stdout.trim()` → 「tracked edit outside its block is kept and said」紅
  - scripts/residue.js:504 拿掉 `registered.has` 的跳過 → 「sweep deletes an agent directory no worktree points at...」紅（8 → 7 pass 1 fail）
  - scripts/residue.js:507 `if (quiet)` 改 `if (false)` → 一個測試紅（mutator 沒抓到名字，只確認 pass 7 fail 1）
  - scripts/test-audit.js:83 拿掉 `SKIP_TOP` 條件 → 「bench/ holds deliberate control copies」紅
  - scripts/test-audit.js:72 拿掉 walk 的 `SKIP_TOP` 條件 → 一個測試紅（同樣沒抓到名字）
  - 這六個變異只涵蓋我挑的分支；Windows 重試與 rmSync 殘留分支沒有測試能在非 win32 觸發，維持 build 的未檢查說法。 — held（上述範圍內）
- `scripts/residue.js:496` 的 `'registered' is declared but its value is never read` — did not hold：現行程式 `registered` 在 :504 被讀（`registered.has(norm(where))`），而且變異 C 拿掉它就有測試紅，所以已註冊的 agent-* worktree 不會被當孤兒刪；那個編輯器警告與目前檔案不符。
- 「全套 fast 綠」— did not hold：見上，2 個失敗。原因是 SKILL.md:403-407 新段落(1)把 `git branch -D <name>` 改成沒有 `<name>` 的 `git branch -D`，`tests/worktree-docs.test.js:21` 要求那段字面文字；(2)寫成 `land.js clean` 後面括號 `(residue.js --sweep)`，skills-cli 掃描把 `--sweep` 算成 land.js 的旗標。→ build
- docs: `skills/fankeel-land/SKILL.md:403-407` 是上述失敗的來源（屬 skills/，不能在這裡修）；其他頁面沒有新的 false。docs-check 剩下 4 項在本次範圍之前就存在。
- fixed here: none（沒有 docs/ 單頁可修，所以沒有 verify-commit.md）
- adversary: 沒有派。suite 的兩個失敗已經是會送回 build 的 defeated row，再派 adversary 不會改變去向；這是少做的一步，請知悉。另外沒派 per-task verifier 與 render reviewer（沒有畫面）。
- 修正建議（給 build）：把該段改成 `node <plugin>/scripts/land.js clean` 與 `node <plugin>/scripts/residue.js --sweep` 分開寫，並保留字面 `` `git branch -D <name>` ``；改完要重跑整套 fast，不是只跑兩個檔，且要守 SKILL 位元組上限。
- 與本次無關但已見：suite 中另有一組 bare-reference/unnamed-script 訊息出現在 3105 的錯誤輸出裡，大多在本次範圍之前就存在，我只確認 `:404 unknown-flag` 是這次新增的，其餘沒有逐條對基準比對。

reads:
- skills/fankeel-land/SKILL.md:399 — 要修的「Agent branches」段
- tests/worktree-docs.test.js:13 — 要求的字面文字
- .fankeel/build/task-20261102T074927/suite.tap — 兩個失敗的完整輸出

```json gate
{"questions":[{"header":"Verify→Land","question":"Verify -> Land | fankeel : TODO 全表盤點","options":[{"label":"Go to Land","description":"不建議：fast suite 紅著（2 個失敗），land 的 suite.js --check 也會拒絕。只有你確認這兩個失敗與本次無關時才選。"},{"label":"Back to Build","description":"建議這個：失敗來自 skills/fankeel-land/SKILL.md 的 Agent branches 段（少了 `git branch -D <name>` 字面文字，括號 `--sweep` 被當成 land.js 旗標）。skills/ 不能在 verify 修，改完要重跑整套 fast。程式碼的 6 個變異都已殺死。"},{"label":"暫停","description":"先不動；next 設為「回 build 修 fankeel-land SKILL 的 Agent branches 段並重跑整套 fast」。"}],"multiSelect":false}],"next":"回 build 修 fankeel-land SKILL 的 Agent branches 段並重跑整套 fast"}
```
