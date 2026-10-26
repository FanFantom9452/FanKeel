---
label: tune
title: tune 接 Desktop 選取元素
description: Claude Desktop 內建瀏覽器有選取元素的工具；逐塊調整要能用它點區塊，對回 data-block 送進 tune 佇列
state: decision
link: assets/tune/overlay.js
stamp: 2026-10-27
---

來源：2026-10-27，使用者說：「你幫我開個網頁在 CLAUDE DESKTOP 裡面 我有看到 CLAUDE 自己有一個工具 可以 SELECT 元素 這些 我們現在逐塊調整功能也需要這個」。當時在 Claude Desktop 的內建瀏覽器打開了 http://127.0.0.1:7819/.fankeel/build/2026-10-26-station-resize/mockup.html（tune serve 帶 overlay）。

現況：逐塊調整靠 assets/tune/overlay.js 自己的圈選浮層，只能選有 data-block 的元素，選好後經 tune.js 的佇列送回 session（scripts/tune.js wait／done）。Claude Desktop 內建瀏覽器有自己的「選取元素」工具，使用者在頁面上點元素就會附到對話裡。

要查清楚（未驗證）：Desktop 的選取工具送進對話的是什麼（selector、outerHTML、截圖、座標？），能不能從頁面或 plugin 端讀到；它與 overlay 同時開會不會互相干擾；mockup 打開時是否預設進內建瀏覽器。

要變成：在 Claude Desktop 裡做逐塊調整時，使用者可以用 Desktop 的選取工具點元素，fankeel 把它對回 data-block（找最近的有 data-block 的祖先）並排進同一個佇列。overlay 留給 terminal／一般瀏覽器使用。怎麼接還沒決定。

完成條件：在 Desktop 內建瀏覽器用它的選取工具點一個 mockup 區塊，session 收到的請求帶著正確的 data-block，並由使用者在真機上確認一次。
