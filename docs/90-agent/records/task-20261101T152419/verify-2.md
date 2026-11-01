# Verify 第二輪：複查 ci-status 的 token 範圍修補

結論：本輪修補成立，可以進 audit。唯一留下的是一個「可選的加固」：`www.github.com` 這類別名主機會被當成 Gitea，在未設 `GITEA_URL` 時收到 `GITEA_TOKEN`。這與 build 已裁定的殘留風險同一條路徑，收件者也是公開平台本身，所以不擋關卡，交給使用者決定。SPIKE 去留已記成 TODO `handoff-2`，並已由控制端提交（27735538），程式碼未動。

```
$ node scripts/suite.js --session 56cbbc34-06e8-4768-a2a1-7741e5d6a847 --fast
suite: 6181 pass, 0 fail @ 3ea18f6a

$ node scripts/docs-check.js
3 references that no longer resolve: (plan D → rationale.md、todo/model-3.md:12、todo/notify-2.md:18，皆為先前 ruling 的既有項目)

$ node scripts/todo-check.js
fankeel todo-check: 34 entries — 3 ready, 2 needs a decision, 9 blocked, 20 watch. All links resolve, no stale citations, none over the cap.

$ node --test tests/ci-status.test.js   （三次突變，每次前後各一次）
ci-status.js:35 刪掉 ssh.github.com  → 17 pass 變 16 pass / 1 fail（a known non-Gitea forge…）
ci-status.js:39 拿掉結尾點處理       → 15 pass / 2 fail（含 trailing-dot github.com.）
ci-status.js:140 主機比對改成 true   → 16 pass / 1 fail（GITEA_URL naming another host…）
三次還原後 git diff --stat 皆為空。
```

- token 與憑證只在 https 送出、`GITEA_URL` 有設時 token 只送該主機、已知非 Gitea 平台不發請求 — held（17 個測試全綠，三個突變各自被不同測試抓到，檢查確實會失敗；用的是 fake fetch，未對真實 Gitea／GitLab 測過，這點無法檢查）
- 401/403 全被拒時印 `(token refused)`，其他失敗不印 — held（`tests/ci-status.test.js:163` 的測試覆蓋）
- 全套快速測試 — held：6181 通過、0 失敗（build 回報的 `station-serve` 不穩這次沒有出現）
- SPIKE 去留記成 TODO — held：reader 先確認 `docs/90-agent/todo/` 395 個檔與 `todo.js list` 皆無對應（station-6.md 的 Spike 是另一件事），再由 implementer 建立 `docs/90-agent/todo/handoff-2.md`，todo-check 通過；控制端已提交為 27735538。
- 未覆蓋：真實 Gitea／GitLab 行為、redirect 時 Authorization 的剝除（只由 reviewer 讀碼與規格得出，沒有執行）。
- docs: none（land SKILL 的 421-422 行與程式一致；docs-check 只剩 3 個既有項目）
- fixed here: none 的程式碼；唯一的檔案變動是 TODO 條目 `docs/90-agent/todo/handoff-2.md`，已提交 27735538
- adversary（opus 確認者複核後）：兩列，一列 PLAUSIBLE、一列 DROPPED。
  1. `scripts/ci-status.js:38-42` `kindOf` 只做完全比對，`www.github.com`、`www.gitlab.com`、`api.github.com` 會被歸為 gitea；未設 `GITEA_URL` 且有 `GITEA_TOKEN` 時 token 會送過去。確認者判 PLAUSIBLE、不是 CONFIRMED：它與 build-2 已裁定的殘留同一條路徑，收件者是公開平台本身，且 `www.` 來源要靠 redirect 才連得上。修法很小（`host === X || host.endsWith('.' + X)`）。另外「絕不送給已知平台」的說法只對確切主機名成立，應收窄措辭。→ 可選的 build 加固，不是阻擋項。
  2. `credential()` 不受 `GITEA_URL` 限制 — DROPPED：它只對 origin 自己的主機詢問 git 憑證，與 git push 相同，程式註解與 land SKILL 都只說 token 受限，沒有說錯。
  Security、Silent failure、Comment 三個 lens 除上列外無發現。

reads:
scripts/ci-status.js — 第 34-42 行 `kindOf` 與 OTHER_FORGES，決定是否要補 `www.`/`api.` 別名
docs/90-agent/todo/handoff-2.md — 本輪新建的 SPIKE 去留條目
skills/fankeel-land/SKILL.md — 第 421-422 行 token 範圍的措辭，audit 時與程式對照

```json gate
{"questions":[{"header":"Verify→Audit","question":"Verify -> Audit | fankeel : ci-status 修補複查通過，`www.github.com` 這類別名主機是否要補上？","options":[{"label":"Go to Audit (Recommended)","description":"suite 6181 通過、三個突變都被測試抓到、SPIKE 去留已記成 TODO「hand-off 記 HEAD 留或刪」。別名主機問題與已裁定的殘留同一路徑，留給使用者自行設定 GITEA_URL 即可封住。"},{"label":"Back to Build","description":"回 build 補一條規則：host 等於或以 `.github.com`、`.gitlab.com`、`.bitbucket.org` 結尾者歸入已知平台，並加測試；之後再 verify。"},{"label":"Stay in Verify","description":"留在 verify，再對別的檔案或頁面補查；目前沒有未決的證據缺口。"},{"label":"暫停","description":"停在這裡，之後再繼續。"}],"multiSelect":false}],"next":"Audit：整理本任務全部變更並處理 TODO，別名主機加固視使用者決定"}
```
