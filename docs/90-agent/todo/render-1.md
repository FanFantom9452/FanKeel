---
label: render
title: stationLine 新分支沒做過變異
description: lib/render.js 的 stationLine 只有 error 時、running 與 started 才帶網址、starting 不帶，這些分支只有 regex 斷言，沒證據它們能變紅
state: ready
link: lib/render.js
---

來源：2026-10-05 TODO 盤點 task 的 verify 對手審查。lib/render.js 裡 stationLine 的新分支沒有被變異過，現有的只是 regex 斷言，沒有證據這些斷言在分支被改壞時真的會紅。要做：對 error、running、started、starting 各分支做一次 mutation，跑 node --test tests/render.test.js，看每個都會紅，不紅的補斷言。完成條件：四個分支的 mutation 都讓測試變紅。
