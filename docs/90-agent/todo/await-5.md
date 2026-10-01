---
label: await
title: 前一組 inflight mark 沒清
description: 10-01 再現兩次：close 時 group 1 的 mark 還在；已停的 brain 留下 mark，新 await 一直回 already awaiting
state: done
link: scripts/await.js
done:
  at: 2026-10-01
  sha: d2038a3027324382615a49706c4144111460b047
  disposition: done
---

Session a6409b07-9136-41b8-ba6d-173a1a676500（TODO 全表盤點，安裝版 0.88.0）看到兩次：

1. `build close` 回報時，inflight 還有 group 1 的標記：`{"stage":"build","group":1,"agentId":"a10a5889ab0f63d70","lap":1,"kind":"group"}`。group 1 早已交回 `build-g1.md` 並提交（31395ab8）。close 自己的標記沒有 `kind`、帶 `group: 2`。原文記在 [await-1](await-1.md) 的「觀察 2026-10-01」。
2. build 重訪時，一個 brain 沒寫檔就停了，await 也印了 `lost`，但它的標記沒有清掉。之後新派的 brain 要等時，`scripts/await.js` 一直回 `already awaiting <舊 agent>`，連 `--since` 都一樣。最後是舊的 await 先拿到 `build-2.md` 的 handoff 才解開。

`scripts/await.js` 只在看到「那個 agent 的標記」對應的 handoff 或 lost 時才清。所以要查的是：哪條路徑留下了標記沒清（group 交回、lost、續用同一個 agent），以及 `already awaiting` 判斷存活時看的是不是已停的 pid。
