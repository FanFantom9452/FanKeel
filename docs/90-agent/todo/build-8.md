---
label: build
title: commit.js 加不了 git mv 刪除
description: `scripts/commit.js` 加不了 git mv 的刪除那一半 — [scripts/commit.js](scripts/commit.js).
state: done
link: scripts/commit.js
group: git mv 漏一半提交
timing: if: 出現一次 git mv 需要連刪除一起提交
stamp: 2026-09-26
done:
  at: 2026-10-09
  sha: e77cc85c4d85b5248427a362576ba314e6327cc6
  disposition: done
---

來源：根目錄 TODO.md 第 216 行的條目（2026-09-26 記），改成逐條的 todo 檔，讓它被 todo-check 與 station 讀到，而不是只躺在根目錄一份沒人讀的清單裡。

要做成：scripts/commit.js 加不了 git mv 的刪除那一半

完成條件：條目所述的事做完，或查證後確認不必做；結果與證據，也就是（指令輸出、commit sha 或不做的理由）寫回這個檔案的正文，再用 todo.js done 結案。

## 完成紀錄

scripts/commit.js:61 foldRenames carries a staged rename's deleted old path into the same commit, tests/commit.test.js:224 commits a git mv whole

- commit 3827f1cee4d41c89e4b88f5638d3688bfb5782dd
