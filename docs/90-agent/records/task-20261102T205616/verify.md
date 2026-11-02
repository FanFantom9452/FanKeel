# Verify：TODO 全表盤點

結論：測試與變異都過，但對抗審查找出兩條經確認的缺口，都出在「預先回答」的 guard 上（`lib/guard.js`、`hooks/guard.js`）。兩條都會讓使用者不在場時，本應停下來問的指令直接放行，所以依規則送回 build，不在 verify 修。

```
$ node scripts/suite.js --session f86aee7a-16c4-4112-b257-261ff65fe0ec --fast
suite: 6230 pass, 1 fail @ 1d651c8c — retried tests/station-mobile-data.test.js alone, passed
```

```
$ 變異 hooks/gate.js:187 去掉 `questions.length !== 1`；變異 hooks/gate.js:212 去掉 `!pre &&`（各一次，fankeel-mutator，sonnet）
before: pass 6 fail 0 → mutated: pass 5 fail 1（兩次皆然），git diff --stat 還原後為空
```

```
$ node scripts/docs-check.js
moved 3、bare-code 2（皆為舊 reference／todo 頁的行號漂移，非本次範圍）
```

- 預先回答的 gate 規則（一題、option 一或暫停、帶答案送出並標記 `preanswered`）— held，gate-preanswer 6 條測試過，兩條新測試經變異各自殺死（變異前未驗證的 red-when 現已驗證）。
- B／C 組功能（`task.js preanswer`、retro facet、record intake）— held，快測 6230 過；唯一一敗 `tests/station-mobile-data.test.js` 單獨重跑通過，與本範圍無關，視為不穩定測試，沒有進一步查。
- 推送／合併／啟動的硬停 — held（raw 比對）。
- 刪除的硬停 — did not hold：`lib/guard.js:406` 先把引號內文字換成 `''` 再比對，所以 `bash -c "rm -rf x"`、`powershell -Command "Remove-Item -Recurse x"`、`cmd /c "del f"` 不會被攔，違反 docs/03-decisions/2026-11-03-preanswered-gate.md:17。此範圍新增，`tests/guard-preanswer.test.js:57-68` 只測沒包引號的刪除。
- 預先回答的 `ask` 提早返回 — did not hold：`hooks/guard.js:119-125` 在受控階段 shell 寫入拒絕與 `emitCommit` 敏感資料掃描之前就返回，原本的 `deny` 會被降成 `ask`，`git commit … && git push` 在使用者核准 push 時會跳過掃描。（對抗者說 collision guard 也被跳過，確認者查出那條原本就不對 shell 指令生效，已剔除。）
- A 組 Task 3（改 marketplace 設定）— 待使用者在發版後自己做，proves-it-done 標為 pending；README 的開發機說明（Task 1）held，已在 README.md 看到新增段落；memory 部分未另行查證。
- docs: none 為本次新造成；docs-check 殘留（skills/fankeel-plan/rationale.md:31 gone 等）在 BASE 就已存在。
- fixed here: 無（缺口在程式碼，不屬 verify 可修）。
- adversary: 兩條 → build，經 opus 確認者標 CONFIRMED（刪除硬停遇引號、預先回答 ask 提早返回）。對抗者未能查證的項目（suite 結果、docs-check 殘留）由本階段自跑補上。

未能查證：station-mobile-data 的不穩定是否與範圍有關；memory 部分的 A 組成果；沒有跑 render（此變更無畫面）。

reads:
- lib/guard.js — 406 行 `preanswerStop` 的引號遮蔽讓刪除硬停漏掉
- hooks/guard.js — 119-125 行預先回答 `ask` 提早返回，應移到 131-143 行的檢查之後
- tests/guard-preanswer.test.js — 57-68 行缺引號包裹刪除的測試
- docs/03-decisions/2026-11-03-preanswered-gate.md — 第 17 行刪除仍會詢問的承諾

```json gate
{"questions":[{"header":"Verify→Land","question":"Verify -> Land | fankeel : TODO 全表盤點　有兩條已確認缺口，要進 land 還是回 build？","multiSelect":false,"options":[{"label":"Go to Land","description":"忽略兩條缺口直接收工：使用者不在場且有預先回答時，包在 bash -c／powershell -Command 裡的刪除不會停，被預先回答的 push 之前也不會做敏感資料掃描。不建議。"},{"label":"Back to Build (Recommended)","description":"修 lib/guard.js 讓引號內的刪除也被攔，並把 hooks/guard.js 的預先回答 ask 移到受控階段拒絕與 commit 掃描之後，各補一條測試，再回 verify。"},{"label":"Stay in Verify","description":"留在 verify，先看對抗者與確認者的細節再決定。"},{"label":"暫停","description":"先停在這裡，之後再決定要修還是收工。"}]}],"next":"回 build 修兩條預先回答 guard 的缺口，補測試後再 verify；發版後與使用者一起改 marketplace 設定。"}
```
