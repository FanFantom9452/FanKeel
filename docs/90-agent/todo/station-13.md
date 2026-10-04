---
label: station
title: 拆掉 shots-v3 兩個 junction
description: cfg/projects 與 cfgB/projects 是本機 junction，由使用者自行 rmdir（不加 /s）
state: ready
---

來源：修 /fankeel hook 逾時那個任務的 verify，Coverage 第 4 列未交付。路徑 .fankeel/build/task-20261003T114747/shots-v3/cfg/projects 與 cfgB/projects。buildDirs 已不穿過它們，所以只是本機清理，不在 repo 內。做法：使用者在 cmd 用 rmdir 不加 /s，避免刪到 junction 指向的目標。完成條件：兩個路徑不再被 cmd dir 列為 junction。
