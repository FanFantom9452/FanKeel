---
label: build
title: tune.js done 誤還原
description: tune.js 的 live 模式 `done` 在 --src 出現 untracked 檔（例如 .playwright-mcp）時會連它一起還原；09-24 這樣悄悄清掉過一次 r-0017 — [scripts/tune.js](scripts/tune.js).
state: done
link: scripts/tune.js
group: tune 還原誤刪一次
timing: if: tune.js done 在 live 模式又因為 untracked 檔誤還原一次改動
stamp: 2026-09-26
done:
  at: 2026-10-09
  sha: e77cc85c4d85b5248427a362576ba314e6327cc6
  disposition: done
---

來源：根目錄 TODO.md 第 206 行的條目（2026-09-26 記），改成逐條的 todo 檔，讓它被 todo-check 與 station 讀到，而不是只躺在根目錄一份沒人讀的清單裡。

要做成：tune.js 的 live 模式 `done` 在 --src 出現 untracked 檔（例如 .playwright-mcp）時會連它一起還原；09-24 這樣悄悄清掉過一次 r-0017

完成條件：條目所述的事做完，或查證後確認不必做；結果與證據，也就是（指令輸出、commit sha 或不做的理由）寫回這個檔案的正文，再用 todo.js done 結案。

## 完成紀錄

scripts/tune.js:370 doneLive moves new untracked files outside --src aside (stray.every(isNew)) and keeps the --src edit, tests/tune.test.js:274 covers the .playwright-mcp case

- commit e77cc85c4d85b5248427a362576ba314e6327cc6
