---
label: brief
title: brain 寫進別 session 的目錄
description: group 3 的 brain 把 build-g3 檔寫進另一個活 session 的 task 目錄，不是自己的；查 handoff 的目錄是照 session 還是照最新 task 目錄選的 — [lib/handoff.js](lib/handoff.js).
state: done
link: lib/handoff.js
done:
  at: 2026-09-29
  sha: 625e6f90b6188e0cf05ebd794f4d48571c86820f
  disposition: done
  session: d5e18e3d-b6d1-483a-b38a-be7911f5eadd
---

Session 02faee9b (task-20260929T122234) ran group 3 while another live session (task-20260929T125829) existed; the group 3 brain wrote `build-g3.md`, `build-g3-commit.md` and `g3-prefix.txt` into the other session's `.fankeel/build/task-20260929T125829/`. Moved back by hand at build close. Find where the brief's paths pick the task dir: by the parent session's record, or by the newest `task-*` directory.
