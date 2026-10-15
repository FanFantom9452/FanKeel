---
label: model
title: 大規模重設計不省額度
description: class 為 architectural（專案大規模重建、重設計）的任務，各 stage 的派遣不走省額度的設定：dispatch.floor、effort、reviewer 與 reader 都往上拉，不套 lean preset — [lib/profile.js](lib/profile.js).
state: ready
link: lib/profile.js
---

來源：使用者 2026-10-15 在 TODO 全表盤點（session 349c5d13）的 build 階段說：「如果今天有任務是專案大規模重建、重設計的，我們 skill 就不要省額度。」

要做成：任務的 class 是 architectural（或 survey 判定為整個專案的重建、重設計）時，fankeel 的各個 skill 不為了省額度降規格。目前會省額度的地方包括：profile 的 dispatch.floor（內建 sonnet）、plan 的 Dispatch 行預設停在 floor、reader 與 reviewer 釘 sonnet、lean preset 的 stage.agents、build 對機械性 finding 略過 confirm reviewer 的裁決、verify 的抽樣。要先盤點這些點，決定 architectural 時各自拉到哪一級（例如 floor 改 opus、reviewer 用 -high、不略過 confirm reviewer），寫成 class 讀得到的規則，而不是要使用者每次手動改 profile。

完成條件：一個 class 為 architectural 的任務，在不改 profile 的情況下，plan 的 Dispatch 行、build 與 verify 派出的 reader、reviewer、implementer 都是拉高後的那一級；bounded 與 spike 不受影響。有測試鎖住 architectural 與 bounded 各自讀到的 floor 與 effort。結果與證據寫回本檔正文，再用 todo.js done 結案。

盤點（2026-10-15 第三輪）：「build 對機械性 finding 略過 confirm reviewer」與「verify 的抽樣」在 skills、agents、lib 都找不到對應文字——build 每次都派 confirm reviewer，verify 要求整套跑——沒有東西可取消；lean preset 只設 `stage.agents`，不動模型。實作只拉 floor 與 effort：`lib/profile.js` 的 `dispatchFor` 與 `dispatchClause`，`lib/render.js` 在 plan、build、verify 讓 architectural 的 `class:` 行以拉高後的一級取代 means 句（另加一行會撐破區塊上限），brain brief 也帶這一句。reader、mutator、mover 沒有 `-high` 變體，只跟著 floor 換模型。mutator 與 mover 跟著 brief 寫的 floor。
