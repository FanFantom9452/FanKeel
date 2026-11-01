---
label: land
title: 支援 Gitea 與 CI 專案
description: 教授的專案放在 Gitea 並跑 CI：land 開 PR 不分 gh/tea、推送後不讀 CI、init 不看 workflow、非 Node 專案沒有測試指令 — [skills/fankeel-land/SKILL.md](skills/fankeel-land/SKILL.md).
state: blocked
link: skills/fankeel-land/SKILL.md
group: 教授確認 Gitea 環境
timing: after: 和教授確認 Gitea 環境（tea 或 API token、CI runner 有無 Chrome、測試指令）
stamp: 2026-11-01
---

來源：2026-10-29 的判官判定（選 A，不加）假設只有使用者一人在用；使用者說之後要把 fankeel 交給教授，教授習慣在 Gitea 上走 CI/CD，判定的「would flip if」成立。同日的 survey 盤點了四個缺口，那份報告在 .fankeel/build 下沒進版控，清單抄在這裡。

要做成（最小套組，bounded）：
1. land 開 PR 選工具：skills/fankeel-land/SKILL.md 步驟 7 加一句，依 `git remote get-url origin` 判斷，github.com 用 `gh pr create`，其他主機有 `tea` 用 `tea pulls create`，都沒有就印出推送後的 compare 網址交給使用者。只改 skill，不寫程式。
2. 推送後讀 CI：新增唯讀的 `scripts/ci-status.js <sha>`，Gitea 打 `GET /api/v1/repos/{o}/{r}/commits/{sha}/status`、GitHub 用 `gh api`，印一行 `ci: success|failure|pending|none`，token 取自環境變數，缺則印 `ci: unknown`；land 報告放在 `suite:` 旁。不等 CI、不擋 land。
3. init 認得 workflow：agents/fankeel-init-scout.md 加一項檢查，列出 `.gitea/workflows/*.yml`、`.github/workflows/*.yml` 裡 `run:` 含 test 的行，當作建議的測試指令顯示，先不自動採用。
4. init 問推送：偵測到 origin 是 Gitea 或 GitHub 時，問一次「是否推送並開 PR」，寫入 `land.integration pr`、`land.push true`；不改 preset。
5. 前提：新增 `suite.command` profile key，lib/suite.js:78 優先讀它，非 Node 專案（pytest、Makefile）才有測試指令可跑；和第 3 點配合。

6. nightly build：不是 fankeel 去排程，而是 CI 那邊用排程觸發的 workflow（Gitea Actions 的 `on: schedule`）每晚跑整套；fankeel 只用第 2 點的 `ci-status.js` 讀那次的狀態，不自己開跑、不等結果。

完成條件：在一個 Gitea remote 的測試專案上，init 會建議測試指令並問推送，land 能開出 PR，報告多一行 `ci:`。

2026-11-01 教授談話（語音 261101_151532.txt L670–L686、L970–L981）確認：教授要的是 land 推送之後自動觸發 CI/CD，另外每晚跑一次 nightly build。談話沒有定下 tea 或 token、runner 有沒有 Chrome、測試指令，所以條目維持 blocked。

## 為什麼還開著

等使用者和教授確認實際的 Gitea 環境：有沒有 `tea` CLI 或 API token、CI runner 有沒有 Chrome、專案用什麼測試指令。這些決定第 1、2、5 點怎麼做，沒有 Gitea 可測時做出來的只是猜測。
