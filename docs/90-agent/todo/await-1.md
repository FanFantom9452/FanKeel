---
label: await
title: kind 只在測試裡驗過
description: `kind` 讀不到時，await 改從 brain 自己的 transcript 第一行讀（commit a0187d9d769dd3eb0821a22e62ef3543739eef6d）：重裝後看一次真實 `build close` 的 await 是否盯 `build.md` — [scripts/await.js](scripts/await.js).
state: done
link: scripts/await.js
done:
  at: 2026-10-01
  sha: a0187d9d769dd3eb0821a22e62ef3543739eef6d
  disposition: done
  session: a6409b07-9136-41b8-ba6d-173a1a676500
---

09-30 實跑（本 session 的 build close）：await 印出 `build.md` 成立；`inflight` 標記沒有 `kind`，帶 `group: 6`，前一組的標記沒被清掉。見 [決策紀錄](../../03-decisions/2026-09-30-ready-eleven.md)。

## 修正 2026-10-01

09-30 那個 mark 有 `group: 6`、沒有 `kind`：`hooks/brief.js` 的 `caseOf` 在 SubagentStart 讀不到 brain 的 transcript 就回 null（推論：檔案還沒寫；`docs/90-agent/reports/2026-09-28-spawndepth-timing.md` 只量過 `.meta.json`），`markInflight` 於是照舊編號。commit a0187d9d769dd3eb0821a22e62ef3543739eef6d 讓 `scripts/await.js` 在 mark 沒有 `kind` 時讀 transcript 第一行，那時檔案已經在。前一組 mark 沒清的原因沒查到：`scripts/await.js` 只在 await 以那個 agent 的 mark 看到 handoff 或 lost 時清。

10-01 另見：`build-g1.md.await` 指向已結束的 g2 agent、其 pid 336372 仍活，導致 g3 的 await 被拒——同樣是前一組 mark 沒清，與上面「前一組 mark 沒清的原因沒查到」同源，重裝後看真實 build close 時一併查。

## 觀察 2026-10-01

安裝版 0.88.0 下，session a6409b07-9136-41b8-ba6d-173a1a676500 的 `build close`：await 印出 `handoff F:/ymlab/fankeel/.fankeel/build/task-20261001T131731/build.md — print this path and ask its gate as your rules say, unless you already asked it and the file has not changed since.`。當下的 inflight 標記：`[{"stage":"build","at":1790861681024,"group":1,"agentId":"a10a5889ab0f63d70","lap":1,"kind":"group"},{"stage":"build","at":1790861878576,"group":2,"agentId":"a82c53711e2a56b8f","lap":1}]`。

close 的標記仍沒有 `kind`、帶 `group: 2`，但 await 已從 transcript 讀出它是 close、盯的是 `build.md`。group 1 的標記（`kind: group`）到 close 時還在：「前一組 mark 沒清」再現一次，原因仍沒查到。
