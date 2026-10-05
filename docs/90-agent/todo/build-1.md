---
label: build
title: knip unused exports 未開
description: knip 的 unused exports 一格關著：6.39.0 仍認不得 CJS namespace 取用（`clearBadge` 追不到），開著回 196 個假陽性（10-01 重跑） — [docs/development.md](docs/01-guide/development.md).
state: blocked
link: docs/01-guide/development.md
group: knip 認得 CJS namespace
timing: upstream: knip 認得 CJS namespace property access
stamp: 2026-10-05
---

來源：3dc97182（2026-09-13）寫下 knip.json 時，unused files 已解，剩 unused exports 一格因 knip 不認 CJS namespace 取用而關著；74e03177（2026-10-01）用 6.39.0 重測，`clearBadge` 仍追不到，開著回 196 個假陽性。

要做成：等 knip 認得 CJS namespace property access 的版本出來，把 `knip.json` 的 exports 一格打開。

完成條件：`knip --trace-export clearBadge` 找得到 import，`knip --include exports` 只剩真的未用 export，並更新 docs/01-guide/development.md 的 knip 一節。
