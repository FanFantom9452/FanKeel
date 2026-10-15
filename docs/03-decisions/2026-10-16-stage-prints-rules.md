---
status: decision
last_verified: 2026-10-16
---

# 換站時就把新一站的規則印出來（10-16）

一句話：`task.js stage` 換站成功後，直接印出新一站的規則與報告骨架，最後一行要 session 在同一回合開工，不必等下一個 prompt。

## 決定

- 一般的站：印出和每輪注入同一份的「stage rules」與「output shape」，用的是同一個函式 `rulesLines`，沒有另寫一份。
- 交給站 agent 的站（profile 的 `stage.agents` 有列的）：照舊印 controller 區塊，不再另印規則，免得同一套規則出現兩次。
- 兩種都在最後加一行：「進到這一站後在同一回合開工，不要先收回合。」build 的 hands 清單與 land 的 TODO 收尾行接在規則之後、這一行之前。

## 為什麼

以前換站只印一行「survey to design … 花了多少」，新一站的規則要等使用者下一個 prompt 才注入。gate 核准、跑完 `task.js stage` 之後，畫面上沒有任何東西推 session 往下做，它就收掉回合。2026-10-16 的 TODO 盤點在 design 到 plan 時真的停過一次，使用者得打字問「怎麼停下來了」。

## 放棄了什麼

- 另寫一份精簡版的規則給換站時印：兩份會分家，注入的跟印出的說不同的話。
- 受控站也改印規則區塊：會和 controller 區塊重複，而且既有測試靠 controller 的標頭行辨認它。
- `start` 與改名（`task.js task`）開站時也印規則：這次沒做，它們仍印一行「先做什麼」。
