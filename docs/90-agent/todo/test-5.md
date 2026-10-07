---
label: test
title: 全套測試不能並行
description: 同時開多份 node --test 會偶發失敗，疑為共用 registry、station、git 狀態
state: ready
---

2026-10-07 verify 時同時跑三份全套測試（外加 docs-check），各有 2 到 4 項 not ok，每份不同，例如 'a project under the registry root is claimed with its prefix'、'a commit under git -C resolves its -- paths'、'git is asked about the worktree, and answers in logical paths'、'the first run scans once and records that it did'、'a /fankeel prompt finding the station busy'。單獨連跑四次皆 3663 通過 0 失敗。原因推測是這些測試共用機器上的 registry、station 與 git 狀態；沒有逐項查明。要做的：找出共用的狀態，讓測試用各自的 fixture，或在文件說明全套測試不可並行。完成條件：同時開三份全套測試都是 0 失敗。

2026-10-07 TODO 全表盤點的 build：讀過五個點名的測試，只有 tests/sensitive.test.js 有固定的共用路徑（兩個測試在系統暫存目錄寫同名的 outside-acme.md 與 outside-acme-dir，一份刪掉時另一份還在用），已改成依各自暫存目錄命名。其餘四個都用各自的暫存目錄，紅的時候撞的是牆鐘時間上限：git status 的 2.5 秒逾時、station 首次掃描的時間上限、/fankeel 探測忙碌 station 的等待。修前三份同時跑：fail 3、1、1，其中 not ok 有 "a commit under git -C resolves its -- paths against that directory, and a path outside the repository, file or directory, is not added" 與 "git is asked about the worktree, and answers in logical paths"；修後：fail 2、3、1，not ok 有 "the first run scans once and records that it did"、"the whole injection stays a readable size with everything populated"，sensitive 的兩個測試不再出現（另有 brief.test.js 的 "a brain is told what to read first" 在這個 worktree 單獨跑也紅，與並行無關）。那些上限是 hook 與掃描自己的預算，不放寬；README 的 Development 寫明一次只跑一份全套。
