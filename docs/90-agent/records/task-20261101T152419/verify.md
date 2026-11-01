# Verify 報告：教授 11-01 功能（A、C、E、B、D 五組）

結論：13 個任務的證據都成立，fast suite 全綠；但對抗審查加上確認者（opus）留下 6 項成立、3 項可信的缺陷，其中最要緊的是 `ci-status.js` 會把 `GITEA_TOKEN` 送給任何非 github.com 的 origin（包含 `http://` 明文），建議退回 build 修，再進 audit。

```
$ node scripts/suite.js --session 56cbbc34-06e8-4768-a2a1-7741e5d6a847 --fast
suite: 6175 pass, 0 fail @ 839f2a4d

$ node scripts/docs-check.js
3 references that no longer resolve:  (gone: plan D 檔連到 rationale.md；moved: todo/model-3.md:12；bare-code: todo/notify-2.md:18)

$ node scripts/ledger.js --plan <各組> ranges
五組共 13 列，範圍互不重疊；13 個 verifier（sonnet 以下由 agent 檔決定）各寫 ev-*.md
```

- 13 個任務的測試新鮮重跑 — held（A 12/12、C 6/6、E 的 gate-report 7/7、gate-links 5/5、stage-record 4/4、B 的 ci-status 11/11 等，各檔 `fail 0`）。
- 多數 verifier 沒有做突變，只有 C2、B2、D2 在暫存副本上確認測試會紅；其餘「測試能否失敗」只靠讀碼，這是缺口，不是反證。
- `suite.js --fast` 排除 `@slow` 測試（56 個檔），所以這不是 land 要的全套紀錄；build 說有一個 `station-chartroom` 測試需單獨重跑才過。
- nightly.yml 沒被 YAML 解析器讀過，只做字串比對；真實 Gitea／GitHub 上的 `ci-status.js` 沒測過。
- docs: 本次新增沒有使頁面變假；既有的 3 個 docs-check 項目不屬本次（build 已記為 ruling）。
- fixed here: 無（沒有派 fixer，沒有 commit 檔）。
- adversary: 對抗審查 13 條、確認者 opus 逐條開檔，6 成立、3 可信、1 駁回，全部 → build：
  1. 成立 `scripts/ci-status.js:121`（host 判斷 `:62`）：除 github.com 外的 origin 一律當 Gitea，沒有 allowlist 或 `GITEA_URL` 檢查，token 會送給 gitlab／bitbucket；`http://` 會明文送出，與檔頭 `:11` 說的「over HTTPS」矛盾。
  2. 成立 `lib/registry.js:821,828`、`scripts/task.js:1191,1538`、`tests/handoff-sha.test.js:3`：commit 4dcc0884 的 `SPIKE (throwaway)` 程式碼（來自另一個 survey 任務）仍在 main 上，沒有任何 review 或 verify。我自己 `git grep SPIKE` 確認五處都在。
  3. 成立 build.md 引用的 `suite.tap` 不存在（目錄只有 `suite-out.txt`、`suite.json`）。
  4. 成立 `scripts/ci-status.js:108-115`：401、404、逾時、壞 JSON 都變成同一行 `ci: unknown <url>`，壞 token 與服務掛掉無法區分。
  5. 成立 `scripts/ci-status.js:7` 檔頭承諾 `ci: unknown <url>`，但無 origin 時 `:146` 印的是不帶網址的 `ci: unknown`（即 build 延後項 5，註解本身也要改）。
  6. 成立 `scripts/suite.js:88` 註解仍寫「group B's nightly CI template」這個規劃用標籤。
  7. 可信 `scripts/record.js:336` 與 `scripts/task.js:1046`：`fileStageReport` 提交到共用 checkout 當下的分支，未列入 `sensitive.txt` 的祕密不會被遮蔽；是否算缺陷取決於共用 checkout 政策。
  8. 可信 `scripts/task.js:1052` 空 `catch` 讓提交失敗時無任何提示（確認者找不到會丟的輸入）。
  9. 可信 `hooks/gate.js:357-365` 的 `catch {}` 遇例外放行關卡（與該檔「每條路徑 exit 0」規則一致）。
  駁回：test-audit 掃 bench/ 重複——bench/ 內沒有符合測試檔名的檔案。

reads:
scripts/ci-status.js — 修 token 只送給 Gitea host、拒絕 http、區分 401 與無 CI、改檔頭註解
lib/registry.js — 第 821、828 行 SPIKE 程式碼要不要留
scripts/task.js — 第 1046-1052、1191、1538 行：stage 提交的吞錯與 SPIKE
scripts/suite.js — 第 88 行註解
.fankeel/build/task-20261101T152419/build.md — 第 18 行的 suite.tap 引用

```json gate
{"questions":[{"header":"Verify→Audit","question":"Verify -> Audit | fankeel : 教授 11-01 功能 13 項任務證據成立，但對抗審查留下 6 項成立缺陷，要進 Audit 還是退回 Build？","options":[{"label":"Go to Audit","description":"接受目前狀態進 audit：fast suite 6175 通過，13 個任務的測試都重跑過；成立的缺陷（token 會送給非 Gitea 主機、SPIKE 程式碼留在 main、兩處註解過時、suite.tap 引用不存在）改記成 TODO 或 audit 處理。"},{"label":"Back to Build (Recommended)","description":"退回 build 先修最要緊的：ci-status.js 只對 Gitea 主機送 token 並拒絕 http、區分 401 與無 CI；決定 SPIKE 程式碼去留；改兩處註解與 build.md 的 suite.tap 引用，修完再 verify。"},{"label":"Stay in Verify","description":"對「共用 checkout 提交」與「catch 吞錯」兩項可信但未確認的缺陷再做一輪審查或突變，再決定去向。"},{"label":"暫停","description":"停在這裡，之後再繼續。"}],"multiSelect":false}],"next":"Build：修 ci-status.js 的 token 送出範圍與 SPIKE 去留，再回 Verify"}
```
