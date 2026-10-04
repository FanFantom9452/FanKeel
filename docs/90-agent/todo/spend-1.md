---
label: spend
title: 花費換算成 Max 20x 週額度
description: 把 registry 的 spend 換算成約當幾個 Max 20x 週用量；官方沒公布週額度的美元數，要用自己的讀數校準
state: done
done:
  at: 2026-10-05
  sha: c8b98a95
  disposition: done
  session: 106c6f2b-ec35-4261-9bfe-0a40eba1459d
---

來源：2026-10-02 使用者在 station 啟動檔與 docs agent 那個 task 的 survey 中途提出。想要的功能：看到一筆花費（leave.js 寫進 registry 的 spend，或 station 上的金額），就能快速知道它約等於 Max 20x 方案幾個週用量、或一週額度的幾成。卡住的地方：Anthropic 沒有公布週額度等於多少美元，所以沒有固定的換算率，只能校準。方向：在同一段時間裡拿 /usage 或 statusline 的週用量百分比讀數，對上 registry 記到的花費變化，算出每 1% 週額度約多少美元，存進 profile，station 和 task.js show 就用這個比率顯示換算。先例：finopsllm 約 $1.86k／週（2026-08~09）、botfarm 約 $1,100（2026-02）；額度是帳號層級共用，校準時要對照所有 transcript，不能只看這個 repo。待決定：校準要手動輸入還是自動讀（先查 statusline 的輸入 JSON 有沒有週額度欄位），以及比率多久重新校準一次。完成條件：station 的每筆花費旁邊顯示約當的週額度比例，並註明用的是哪一天的校準。

2026-10-03 使用者裁定（TODO 全表盤點的 survey）：手動填週額度已由 commit 5110ae15 落地，station 在金額後接 (x%)；本條續做自動讀取，留著當建置項。剩下兩件：先查 statusline 的輸入 JSON 有沒有週額度欄位，有就由它校準 profile 的週額度；並在 station 註明這個比例用的是哪一天的校準。
