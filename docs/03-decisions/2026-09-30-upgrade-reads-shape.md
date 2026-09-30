---
status: decision
last_verified: 2026-09-30
---

# fankeel-upgrade 看現況、版本記在報告（09-30）：決策紀錄

一句話：`scripts/upgrade.js` 不讀任何記錄下來的版本號來判斷要跑哪些遷移，而是直接看專案現在的樣子；`--apply` 之後在 report bucket 寫一份 `YYYY-MM-DD-fankeel-upgrade.md`，frontmatter 的 `fankeel:` 就是下次 `version.js --changes --since` 的起點。

## 定了什麼

- TODO 原本的寫法是「讀紀錄的 version」，但 survey 查到專案端根本沒有這個紀錄：`version.js --changes` 讀的是 plugin 自己的 git log，scope→claims 也只是讀取時的相容處理，沒有可跑的步驟。所以改成看現況判斷，重跑不會出事，也沒有會過時的欄位。
- 版本要記下來，是使用者在 design 閘門問的：「會不會用文件比較知道？」放在 docs.json 只多一個數字，看不出做過什麼；一份有日期的報告，人看得懂這次跑了什麼、還剩什麼，程式也能從 frontmatter 讀到版本。
- 只有 `todo-check --migrate` 會自動跑，因為它重跑不會出事。`todo.js migrate` 跑第二次會出錯，`docs-move.js` 要人先選 preset、看過搬移表，這兩個只印出指令。
- skill 設成 `disable-model-invocation: true`，只由使用者叫用。

## 在哪裡回頭

- design 閘門第一次的答案是「留在 design」，因為版本記在哪還沒定；第二次才核准。
- plan review 找到 Task 6 依賴 Task 5 的數字卻被排在同一組，改成在 Consumes 寫出 `fankeel-upgrade`，讓分組把兩者排成先後。
- build 收尾的全套測試裡，`tests/source.test.js` 因為 `upgrade.js` 對外 export 了沒人用的 `main` 而失敗，改成不 export。
- verify 確認一個缺陷沒有修：`readTodo`（`scripts/upgrade.js:34-39`）對讀不了的 TODO.md 也回 null。使用者選先 land，另外登記成「readTodo 只吞 ENOENT」（upgrade-2）。`tests/serve.test.js` 的 detached serve 在全套下兩次都失敗，單獨跑全過，原因未證，登記成「serve.test 全套下失敗」（test-3）。
