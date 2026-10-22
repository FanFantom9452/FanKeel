---
label: station
title: 指南補 ntfy topic 即密碼
description: 監控站指南補一段免費 ntfy.sh 的 topic 風險與自架取捨
state: done
group: station 遠端
done:
  at: 2026-10-22
  sha: 89a2a43a
  disposition: done
  session: 8a1d6ae0-88cf-47ed-b122-33b0a48182ce
---

來源：使用者的話：「文件說明自架 ntfy 只要改 notify.server、topic 就是密碼」，以及判斷文件 docs/90-agent/judgements/2026-10-22-notify-channel.md。docs/01-guide/station.md:54-57 與 docs/01-guide/profile.md:50 已說明用 notify.server 自架，所以這項只補缺的部分：在 station.md 約 :54 處寫明，用免費 ntfy.sh 時 topic 是唯一的祕密，知道的人都能訂閱並讀到通知（階段、第一題最多 80 字、任務名稱最多 80 字，以及帶 tailnet 主機名的點擊連結）；保留 topic 需要付費的 ntfy Pro；自架在 tailnet 上的 ntfy 能讓內容不經第三方，代價是 Android app 要維持前景連線。完成標準：這段文字已寫進指南，且 docs-check 通過。

## 完成紀錄

監控站指南已補 topic 即密碼與自架取捨。詳見 [任務紀錄](../records/2026-10.md#r-2026-10-22-8a1d6ae0)

- commit 89a2a43a
- commit 4a7af109
