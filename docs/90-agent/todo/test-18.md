---
label: test
title: test-audit 跳不跳 bench/
description: test-audit 把 bench/ 刻意複製的對照組報成 10 筆重複，要跳過 bench/ 還是照報未定 — [scripts/test-audit.js](scripts/test-audit.js).
state: done
link: scripts/test-audit.js
done:
  at: 2026-11-02
  sha: 0875747e
  disposition: done
  session: 30421c7e-7fcf-4361-be33-90b25dd1ebbb
---

來源：task-20261101T152419（教授 11-01 功能）audit 階段。現況：`node scripts/test-audit.js` 回報 16 筆重複，其中 10 筆在 bench/ 下，例如 bench/add-feature/controls/pass/spec/truncate.spec.js:6 對 bench/add-feature/controls/fail-one-test/spec/truncate.spec.js:6、bench/roles/mutator/items/trap-line-mismatch/src/spec/clamp.spec.js:6 對 bench/roles/mutator/items/easy-clamp-flip/src/spec/clamp.spec.js:6。這些是 tests/bench.test.js:69-78 用到的兩側對照組，刻意複製，不是該刪的重複。設計文件 docs/90-agent/plans/2026-11-01-professor-ci-tiers-design.md §4（:46-52）沒有說要跳過它們；docs/README.md:842 已經把 bench/ 歸為 fixture。另外 tests/todo-check.test.js:493 重複 :395 也是刻意的（:490-492 的註解說明它是對照組），同屬「刻意重複」一類。要決定：一、test-audit 跳過 bench/（依 README 的 fixture 分類），並決定 todo-check 那種註解標明的刻意重複要不要也能標記略過；二、照報，讓讀者自己判斷。完成條件：決定寫進 test-audit 的說明或設計文件，且 test-audit 的輸出與決定一致、tests/test-audit.test.js 覆蓋。

## 完成紀錄

使用者選跳過：test-audit 不論走 git 或走目錄都略過 bench/ 的對照組. 詳見 [任務紀錄](../records/2026-11.md#r-2026-11-02-30421c7e)

- commit 0875747e
