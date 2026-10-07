---
label: test
title: 全套測試不能並行
description: 同時開多份 node --test 會偶發失敗，疑為共用 registry、station、git 狀態
state: ready
---

2026-10-07 verify 時同時跑三份全套測試（外加 docs-check），各有 2 到 4 項 not ok，每份不同，例如 'a project under the registry root is claimed with its prefix'、'a commit under git -C resolves its -- paths'、'git is asked about the worktree, and answers in logical paths'、'the first run scans once and records that it did'、'a /fankeel prompt finding the station busy'。單獨連跑四次皆 3663 通過 0 失敗。原因推測是這些測試共用機器上的 registry、station 與 git 狀態；沒有逐項查明。要做的：找出共用的狀態，讓測試用各自的 fixture，或在文件說明全套測試不可並行。完成條件：同時開三份全套測試都是 0 失敗。

2026-10-07 TODO 全表盤點的 build：讀過五個點名的測試，有兩個用了固定的共用檔名。tests/sensitive.test.js 在系統暫存目錄寫同名的 outside-acme.md 與 outside-acme-dir，一份刪掉時另一份還在用；tests/render.test.js 的 'the whole injection stays a readable size with everything populated' 也共用系統暫存目錄裡的 fankeel-render-cap.jsonl（not ok 即此項）。兩者都已改成每次執行各自的暫存目錄。其餘仍紅的（git status 的 2.5 秒逾時、station 首次掃描 'the first run scans once and records that it did'、/fankeel 探測忙碌 station 的等待）仍歸因於時間上限，這些上限是 hook 與掃描自己的預算，不放寬；README 的 Development 寫明一次只跑一份全套。
