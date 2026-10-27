---
label: tune
title: tune 浮層像 Desktop 選元素
description: tune 浮層自己的選取要能像 Claude Desktop 的選取工具那樣點選元素，而不是去接 Desktop 的工具
state: done
link: assets/tune/overlay.js
stamp: 2026-10-27
done:
  at: 2026-10-28
  sha: 39a7b070
  disposition: done
---

來源：2026-10-27，使用者說：「你幫我開個網頁在 CLAUDE DESKTOP 裡面 我有看到 CLAUDE 自己有一個工具 可以 SELECT 元素 這些 我們現在逐塊調整功能也需要這個」。當時在 Claude Desktop 的內建瀏覽器打開了 http://127.0.0.1:7819/.fankeel/build/2026-10-26-station-resize/mockup.html（tune serve 帶 overlay）。

現況：逐塊調整靠 assets/tune/overlay.js 自己的圈選浮層，只能選有 data-block 的元素，選好後經 tune.js 的佇列送回 session（scripts/tune.js wait／done）。Claude Desktop 內建瀏覽器有自己的「選取元素」工具，使用者在頁面上點元素就會附到對話裡。

使用者同日附截圖（同一個 mockup 頁）指給我們看：內建瀏覽器網址列右端有一個游標圖示，按下後頁面底部出現一排標註工具列：選取（游標）、畫筆、形狀下拉（Line、Arrow、Rectangle、Ellipse、Step 編號圈）、文字 T、關閉 X。也就是說 Desktop 不只能選元素，還能直接在頁面上畫線、箭頭、框、橢圓、編號步驟與文字。截圖中這排工具列與我們 overlay 的「修改項」托盤和右下角 fankeel 標誌同時出現、位置重疊在頁面下半部。我們的 overlay 目前只有圈選加文字備註，沒有畫筆、形狀或編號步驟。

要查清楚（未驗證）：Desktop 的選取工具送進對話的是什麼（selector、outerHTML、截圖、座標？畫的標註是一張截圖還是帶座標的圖形？），能不能從頁面或 plugin 端讀到；它與 overlay 同時開會不會互相干擾；mockup 打開時是否預設進內建瀏覽器。

要變成：在 Claude Desktop 裡做逐塊調整時，使用者可以用 Desktop 的選取工具點元素，fankeel 把它對回 data-block（找最近的有 data-block 的祖先）並排進同一個佇列。overlay 留給 terminal／一般瀏覽器使用。怎麼接還沒決定。

完成條件：在 Desktop 內建瀏覽器用它的選取工具點一個 mockup 區塊，session 收到的請求帶著正確的 data-block，並由使用者在真機上確認一次。

2026-10-27 使用者澄清：不是要接 Claude Desktop 的選取元素工具，是要逐塊調整的浮層（assets/tune/overlay.js）自己就能像它那樣點選元素。實測時從 Chrome 送進對話的只有整頁截圖，沒有 selector 或 data-block。下一步要決定的是：浮層的選取要比現在多做什麼（任意元素、不限 data-block，或其他），再拆成 Ready。

## 完成紀錄

tune 浮層改成底部工具列，可選任意元素、畫筆、形狀和文字標註，標註隨那一則送出並有總量上限。詳見 [任務紀錄](../records/2026-10.md#r-2026-10-27-24cb0bb1)

- commit 9fb39d11
- commit d53dbc8b
- commit b834471b
- commit 2e4b40ae
- commit 215c9b94
- commit 39a7b070
