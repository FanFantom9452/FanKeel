---
label: build
title: knip unused exports 未開
description: knip 的 unused exports 一格關著：6.41.0 仍認不得 CJS namespace 取用（`clearBadge` 追不到，10-10 重跑），開著回 196 個假陽性（6.39.0，10-01） — [docs/development.md](docs/01-guide/development.md).
state: blocked
link: docs/01-guide/development.md
group: knip 認得 CJS namespace
timing: upstream: knip 認得 CJS namespace property access
stamp: 2026-10-16
---

來源：3dc97182（2026-09-13）寫下 knip.json 時，unused files 已解，剩 unused exports 一格因 knip 不認 CJS namespace 取用而關著；74e03177（2026-10-01）用 6.39.0 重測，`clearBadge` 仍追不到，開著回 196 個假陽性。2026-10-07 的盤點用 6.40.0 重跑 `knip --trace-export clearBadge`，仍是 (no imports found)。2026-10-10 的盤點用 6.41.0 重跑 `npx knip@6.41.0 --trace-export clearBadge`，仍是 (no imports found)。2026-10-14 的盤點查 `npm view knip version`，仍是 6.41.0，與 10-10 重跑的是同一版，沒有新版可試。

要做成：等 knip 認得 CJS namespace property access 的版本出來，把 `knip.json` 的 exports 一格打開。

完成條件：`knip --trace-export clearBadge` 找得到 import，`knip --include exports` 只剩真的未用 export，並更新 docs/01-guide/development.md 的 knip 一節。
