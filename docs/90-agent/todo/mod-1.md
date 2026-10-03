---
label: mod
title: mod 路線要不要繼續
description: 三輪探測：子代理拿不到 prompt.compose 的結果；hooks module 受伺服器端 rollout 旗標控制；啟用要 enabledPlugins 為 true，跟裝好後不用改設定的目標衝突；決定 fankeel 要不要把功能放到 mod 上
state: done
done:
  at: 2026-10-03
  sha: 34afafa11040027fe01c5278a75ca3c40ae7855d
  disposition: done
---

來源：2026-10-03 的三份報告 docs/90-agent/reports/2026-10-03-mod-probe.md、2026-10-03-mod-probe-2.md、2026-10-03-mod-probe-3.md。量到的：(a) prompt.compose 的結果只進主 session 的請求，子代理（general-purpose 與 fankeel-reader）在 headless、啟動時啟用、熱重載三種情況下都拿不到；(b) agent.spawn 改寫的 prompt 會成為子代理的第一行，SendMessage 再送達時只有 SubagentStart 再觸發；(c) turn.step 改的 effort 真的送進請求。限制：hooks module 由 tengu_plugin_hooks_modules 這個 rollout 旗標決定載不載，旗標值來自 GrowthBook 的磁碟快取，同一天內關過又開，使用者改不了；mod 要載入還得在設定裡把 enabledPlugins 設為 true，或啟動時帶 --settings，跟使用者 10-03 說的裝好後大部分不需要修改 Claude 設定衝突。沒測到的：mod 載入時 fankeel 的 command hooks（inject.js、brief.js）是否照常，見 sessions-2。待決定：是否繼續把 brief、effort 等功能做成 mod；若要做，只用 (b)(c) 這類主 session 可用的事件，並接受旗標關閉時要退回 command hooks。完成條件：寫成一份決策紀錄（繼續或擱置、理由），本條隨之關閉。
