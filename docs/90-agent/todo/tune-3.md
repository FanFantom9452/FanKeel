---
label: tune
title: 逐塊調整點錯就整批被拒
description: 圈選時不驗證元素有沒有 data-block，點到沒名字的元素整批被伺服器拒絕，備註也跟著送不出去
state: done
link: assets/tune/overlay.js
done:
  at: 2026-10-13
  sha: 75e96919
  disposition: done
  session: 646aa571-88e3-4247-9431-3da839373b68
---

來源：使用者 2026-10-12 在 Pane 配色任務的 design 站用逐塊調整工具，點了三則（外框 `div.term.band`、`div.term.pane` 與單列 `div.r`），寫好備註按全部送出，整批被拒，只有一行英文 `a static page takes a data-block element on an html file under the served directory`，備註送不出去。原話：「這樣我的逐塊調整不就很尷尬嗎? 這個要記錄到 TODO 吧 不然每次都這樣 就失去逐塊調整工具的意義了 然後逐塊調整工具還不夠直覺」。判官的答案在 docs/90-agent/judgements/2026-10-12-tune-intuitive.md。要變成：圈選時就把每個 pick 解析成 block——在 block 內取該 block；自身包著 block 的外框取裡面全部 `[data-block]`，chip 寫「外框·N 塊」；兩者皆無則框轉琥珀、標籤寫「沒有 data-block，往外或往內一層」，點了不加入（現在 `pickable` 在 assets/tune/overlay.js:194 只擋 body）。伺服器 scripts/tune.js:170 改成逐則檢查並點名是第幾則、哪個元素，取 `block||blocks[0]`；失敗時那一則標紅、草稿留著、訊息用中文說下一步。mockup 的粒度一併寫進 agents/fankeel-mockup.md：外框與空列也掛 `data-block`。完成條件：tests/tune-overlay.test.js 新增「點外框得到內層全部 blocks、無名元素不加入」由紅轉綠；tests/tune.test.js:494 的斷言改成訊息含 `item 2` 與元素名。

## 完成紀錄

逐塊調整原本只要一批裡有一則點錯，伺服器就整批退回，只回一行英文，寫好的備註也送不出去。現在分三層擋：在頁面上點的時候就先判斷，點在區塊裡取那一塊，點到外框取裡面全部的區塊，兩者都不是的元素框會變琥珀色、不會被加入；伺服器改成一則一則檢查，退回時用中文說是第幾則、哪個元素；頁面收到退回會把被點名的那一則標出來，草稿都留著。畫 mockup 的 agent 的說明也補上外框和空白列要有自己的區塊名字，這樣點到它們才對得上。

- commit 311450c9
- commit 470ebdfc
- commit a12bf0be
- commit 75e96919
