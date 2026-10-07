---
label: test
title: 全套測試不能並行
description: 同時開多份 node --test 會偶發失敗，疑為共用 registry、station、git 狀態
state: ready
---

2026-10-07 verify 時同時跑三份全套測試（外加 docs-check），各有 2 到 4 項 not ok，每份不同，例如 'a project under the registry root is claimed with its prefix'、'a commit under git -C resolves its -- paths'、'git is asked about the worktree, and answers in logical paths'、'the first run scans once and records that it did'、'a /fankeel prompt finding the station busy'。單獨連跑四次皆 3663 通過 0 失敗。原因推測是這些測試共用機器上的 registry、station 與 git 狀態；沒有逐項查明。要做的：找出共用的狀態，讓測試用各自的 fixture，或在文件說明全套測試不可並行。完成條件：同時開三份全套測試都是 0 失敗。
