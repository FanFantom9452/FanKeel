# Build 第二輪：修 verify 退回的缺陷

- scripts/ci-status.js +54/-19 — token 與憑證只在 https 送出，且 `GITEA_URL` 有設時只送給該主機；gitlab.com、bitbucket.org、dev.azure.com、ssh.dev.azure.com、ssh.github.com、`*.visualstudio.com` 不發請求；401/403 全數被拒時印 `ci: unknown <url> (token refused)`；檔頭註解改成與程式一致
- tests/ci-status.test.js +78 — 每條規則一個測試與近似案例（大寫主機、結尾點、`GITEA_URL` 同主機仍可送）
- skills/fankeel-land/SKILL.md +4/-2 — 寫明只走 https 與 `(token refused)` 後綴
- scripts/suite.js +1/-1 — 第 88 行註解不再用規劃代號
- .fankeel/build/task-20261101T152419/build.md（不入版控）— 第 18 行改引用 `suite.json`

done: 13 of 13 加上本輪修補，commit 範圍 239b7b67..ea52ccfb；一位 opus 實作者、一位 reviewer 審過，找到的 ssh.github.com、結尾點、大寫主機三項已補並再測。
suite --fast：6180 通過；一個 `station-serve` 測試第一次紅、單獨重跑通過（與本輪無關的既有不穩）。中途 `ci-nightly` 測試擋下我在註解裡寫出範本檔名，已改掉。
docs-check: 剩 3 個既有項目（plan D 連到 rationale.md、model-3.md:12、notify-2.md:18），不屬本輪，維持先前 ruling。

Ruling: token 範圍用「https + GITEA_URL 比對 + 已知非 Gitea 平台清單」，因為自架 GitLab 或 GitHub Enterprise 無法與 Gitea 區分；代價是這類自架主機在未設 `GITEA_URL` 時仍會送出 `GITEA_TOKEN`，設定 `GITEA_URL` 即可封住。
Ruling: SPIKE 程式碼（`lib/registry.js:821,828`、`scripts/task.js:1191,1538`、`tests/handoff-sha.test.js`）本輪不動：它屬另一個任務、是完整功能（hand-off 記 HEAD、adopt 列出變動），刪除或保留需要使用者決定，見關卡。
未處理：`task.js:1046-1052` 空 `catch` 與共用 checkout 提交、`hooks/gate.js:357-365` 放行例外，verify 只列為「可信、未確認」，維持原樣；`docs/90-agent/plans/` 兩份計畫仍寫「其他主機一律 Gitea」（計畫紀錄，未改）。未用真實 Gitea／GitLab 測過。

reads:
scripts/ci-status.js — 第 34-60 行的平台清單與 token 範圍，verify 複查用
tests/ci-status.test.js — 新增的規則測試與近似案例
lib/registry.js — 第 821、828 行 SPIKE 去留若有結論再處理

```json gate
{"questions":[{"header":"Build→Verify","question":"Build -> Verify | fankeel : ci-status 的 token 範圍與 401 已修好，SPIKE（hand-off 記 HEAD）程式碼怎麼處理？","options":[{"label":"Go to Verify (Recommended)","description":"保留 SPIKE 程式碼不動（它是另一任務的完整功能，刪除是還原別人的工作），進 verify 複查本輪修補；SPIKE 去留記成 TODO。"},{"label":"Back to Build","description":"刪除 SPIKE 程式碼（registry.js、task.js 四處與 tests/handoff-sha.test.js）後再進 verify；若那個任務還要用，會丟掉它的成果。"},{"label":"Stay in Build","description":"先處理 task.js 的空 catch 或把自架主機也納入 token 限制，再進 verify。"},{"label":"暫停","description":"停在這裡，之後再繼續。"}],"multiSelect":false}],"next":"Verify：複查 ci-status 修補與 suite，SPIKE 去留依使用者回答"}
```
