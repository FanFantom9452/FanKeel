---
label: station
title: gate 等待起點沒留 at
description: dashboard 的『等你回答』卡片算等待時間，但 `lib/handoff.js` 沒留下 gate 的 `at`，量出來不是真的等待起點 — [lib/handoff.js](lib/handoff.js).
state: done
link: lib/handoff.js
group: gate 等待時間量不準
timing: if: dashboard 的等你回答量到不準的等待時間一次
stamp: 2026-09-26
done:
  at: 2026-10-09
  sha: e77cc85c4d85b5248427a362576ba314e6327cc6
  disposition: done
---

來源：根目錄 TODO.md 第 201 行的條目（2026-09-26 記），改成逐條的 todo 檔。

要做成：dashboard 的『等你回答』卡片算等待時間，但 lib/handoff.js 沒留下 gate 的 `at`，量出來不是真的等待起點

完成條件：條目所述的事做完，或查證後確認不必做；結果與證據（指令輸出、commit sha 或不做的理由）寫回這個檔案的正文，再用 todo.js done 結案。

## 完成紀錄

hooks/gate.js:135 writes at into the pending file and lib/handoff.js:109 reads it back. assets/station/station.js:1614 counts the wait from gateAt then pending.at

- commit e77cc85c4d85b5248427a362576ba314e6327cc6
