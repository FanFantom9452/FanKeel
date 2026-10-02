---
label: survey
title: Unlisted language patterns
description: Language patterns beyond the ten [scripts/survey.js](scripts/survey.js) knows. Anything else is listed under `skipped.noPattern` for a human.
state: watch
link: scripts/survey.js
group: 需要第十一種語言
timing: if: a repository needs an eleventh language
stamp: 2026-09-29
---

來源：c860156c（2026-08-21，close the deferred list）把這行寫進 TODO.md：survey.js 目前認得十種語言，其餘退回只比對檔名，等真有專案需要再加一列；2af15939 起改述為列入 `skipped.noPattern` 交人看。

要做成：某個專案帶有第十一種語言時，在 [scripts/survey.js](scripts/survey.js) 補一列該語言的 pattern，讓它不再落進 `skipped.noPattern`。

完成條件：該專案跑 survey 後，其語言檔不再出現在 `skipped.noPattern`，且符號與引用都被讀到。
