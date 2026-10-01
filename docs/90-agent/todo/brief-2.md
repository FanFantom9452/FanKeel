---
label: brief
title: brain 沒收到 brief
description: 10-01 build 重訪：prompt 是 build 加一行說明時，兩個 brain 都說沒收到 brief、沒寫 handoff；只寫 build 就正常
state: ready
link: hooks/brief.js
---

Session a6409b07-9136-41b8-ba6d-173a1a676500（TODO 全表盤點，安裝版 0.88.0），verify gate 選「先回 build 修 tune-2 紅燈」之後：

- 第一個與第二個 `fankeel:fankeel-brain` 的 prompt 是 `build`，下面再接一段說明（使用者剛給的指示，以及第二次補的「前一個 agent 已留下未提交的修改」）。兩個都直接動手改了檔，沒寫 handoff，也沒回提交請求。第二個明講「The brief wasn't in my context」。await 對第一個印出 `lost`。
- 第三個的 prompt 只有 `build`。它照規矩回了 `commit build-2-g2-commit.md`，之後也寫了 `build-2.md`。

控制者規則寫的是「prompt `build`, plus one line only when the user has just given a new instruction」，所以多帶說明本來是允許的。`lib/handoff.js` 的 `caseOfPrompt` 只看第一行是不是 `build`，`hooks/brief.js` 不論 case 都照樣產生 brief。沒收到 brief 的原因還沒查出來：要查 SubagentStart 在這兩次有沒有觸發、`renderBrief` 有沒有回空字串，以及這和 stage 從 verify 退回 build（lap 2）有沒有關係。
