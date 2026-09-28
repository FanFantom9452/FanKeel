---
status: current
last_verified: 2026-09-29
source_of_truth: TODO.md, scripts/todo-check.js
---

# TODO completions

What happened to a `TODO.md` entry once it was closed. Whoever removes a bullet
from `TODO.md` adds one record here in the same change: the entry's original
text verbatim, its disposition, and the commit that closed it. `todo-check`
reads this page against the previous commit's `TODO.md` and refuses a deletion
it cannot find a matching record for here.

Newest first. One record per closed entry:

```
- original: <the entry's text, verbatim, as it read in TODO.md>
  disposition: done | measured-no-change | abandoned
  sha: <the commit that closed it>
```

`done` — the work described happened. `measured-no-change` — it was measured
and the answer was to leave things as they are. `abandoned` — nobody is doing
it and nobody decided to.

- original: 〔todo〕刪掉的條目沒留下結果：加一頁完成紀錄（原文、做了／量過不改／放棄、sha），`todo-check` 擋沒記的刪除；land 時讓使用者確認新條目的 heading — [scripts/todo-check.js](scripts/todo-check.js).
  disposition: done
  sha: 6240a6cd265a4a795101192e5e9266e80e2488e0

- original: 〔commit〕重送已提交的改動到 `ready --worktree` 報 conflict——唯一還沒查的洞；group 共用 `build-commit.md` 已在 88c9cb8d 修掉，09-29 主樹誤 reset 一事查過非文字漏洞 — [lib/render.js](lib/render.js).
  disposition: done
  sha: 9c2e21f7ad1dd819cbed4907233194a5bf46a348
