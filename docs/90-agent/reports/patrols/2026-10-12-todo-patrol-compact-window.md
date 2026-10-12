---
status: decision
last_verified: 2026-10-12
---

# TODO 全表盤點（10-12 第二輪）與自動壓縮：做了什麼、沒做什麼

一句話：自動壓縮改靠 Claude Code 自己的壓縮視窗，fankeel 只在沒設視窗時提醒一句；盤點沒有可以直接做的條目，另外開了六筆新的。

計畫在 [2026-10-12-compact-window.md](../../../99-archive/2026-10-12-compact-window.md)。
設計在 [2026-10-12-compact-window-design.md](../../../99-archive/2026-10-12-compact-window-design.md)。
量測在 [2026-10-12-compact-window-probe.md](../2026-10-12-compact-window-probe.md)。

## 起因

使用者有一個 session 跑到 629k 都沒有自動壓縮，最後自己打了 `/compact`。
他問的是：build 站不能壓縮嗎，任何站都應該可以壓才對。

查到的是 SBIR 工作區的一個 Claude Desktop session。
它過 450k 之後 turn 結束了 16 次，一次都沒壓。
fankeel 的壓縮只有一支 mod，不分站別，但要每個 session 按一次 Enable 才會載入。
沒載入時沒有任何提示。

## 決定

- 壓縮交給主機。設了 `CLAUDE_CODE_AUTO_COMPACT_WINDOW` 之後，主機在 turn 進行中自己壓。
- fankeel 只做一件事：context 過 400k、還沒壓縮過、又沒設視窗時，`context:` 行最後多一句提醒。
- 指南寫明怎麼設，以及哪些還沒量過。
- mod 不動，留著當保險。

## 為什麼

- 使用者不想在進 build 前被打斷，也不想自己打 `/compact`。
- mod 做不到這一點：它只能在 turn 之間壓，壓完還要人說一聲繼續。
- 主機的壓縮在 headless 量過兩個視窗，都在視窗減約 3 萬的地方壓，而且是在 turn 進行中。
- 主機只在真的到線時才壓，所以 task 少的任務碰不到，不需要依任務大小判斷。

## 放棄了什麼

- 第一版設計：mod 每次 turn 結束寫心跳檔，`context:` 行說出 mod 沒載入、被拒或在等。
- 判官的建議：進 build 時不問就壓一次。
  那份判斷留在 [2026-10-12-compact-before-build.md](../../judgements/2026-10-12-compact-before-build.md)。
- 這兩個都要使用者在壓完之後說繼續，所以在 plan 的 gate 被退回。

## 沒做的

- 沒有替使用者改 `settings.json`。他希望之後由 init 的上手流程來設，已開成條目。
- Claude Desktop 真機上沒驗過：設定吃不吃得到、450000 實際在哪裡壓、hook 看不看得到那個變數。
- 「沒設視窗時主機會等到模型上限」沒有量過，文件裡沒有這樣寫。
- 提醒那一句縮到 93 個字，只講變數名。整個注入區塊有 3000 字的上限。

## 盤點的結果

- Ready 三筆都要使用者在真機做，這一輪沒做也沒關：
  子代理 brief 改走 spawn、面板真機沒看完的四件事、Pane 顯示遠端控制狀態。
- Blocked 14 筆逐條查過，條件都沒達成。Watch 11 筆都還沒到 60 天。

## 新開的六筆

| 條目 | 狀態 | 來源 |
|---|---|---|
| Desktop 真機看壓縮視窗 | Ready | 這次的量測只有 headless |
| Pane 列出沒在跑的 session | Ready | 使用者看到幾週前的 session 被算成共用檔案 |
| 上限測試沒量到壓縮過的行 | Ready | verify 發現那條測試的 fixture 讀錯 |
| 引用的 usage 被當成真的 | Ready | `context:` 行報了假數字，子代理被預算 hook 誤擋 |
| Pane 配色與右欄資訊重新規劃 | 待決定 | 使用者在 gate 上提出 |
| init 幫忙設壓縮視窗 | 待決定 | 使用者不要現在手動設 |

## 過程裡出的錯

- 我在 gate 上兩次說這個 session 已丟掉 1.1M tokens，那個數字是假的。
  它來自上面第四筆的 bug：讀過的檔案裡引用的數字被當成真的。
- verify 來回三輪，都是文字問題：指南漏一個條件，幾處把沒量過的事寫成事實。
  其中一句是我在統一數字時自己加進去的。
- build 的一個 implementer 與一個 reviewer 被預算 hook 誤擋，沒做完，由 fixer 補上。
