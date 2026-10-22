---
label: await
title: 兩組循序派工實跑一次
description: markInflight 改用每個 stage 與 lap 遞增的編號後，第二組應編成 2；只有單元測試，還沒在真實 build 看過
state: done
link: lib/registry.js
group: 下次 build 有兩組
timing: if: 下次 build 的 ledger 分成兩組以上並且循序派出
stamp: 2026-10-19
done:
  at: 2026-10-22
  sha: d37caae8
  disposition: done
  session: 894981bb-1b15-4f8c-80e1-8b845632d0d3
---

來源：2026-10-19 TODO 全表盤點（第二輪）verify 找到：前一組標記清掉後，下一組又被編成 group 1，失敗交接檔變成 build-g1-failed.md，與已完成的 build-g1.md 撞名。修正在 442e4e26，lib/registry.js 的 markInflight 改記 data.groupSeq['<stage>:<lap>']，tests/await.test.js 有兩個測試，變異把計數器歸零會讓兩個測試變紅。verify 寫明「沒有在真實 session 跑兩組循序派工」，adopt 或 copy 時會不會帶著 groupSeq 也沒查。

要觀察的是：下次 build 分兩組以上時，第二組的 await 行與失敗交接檔是不是寫 group 2。

完成的樣子：看到正確編號就以 done 關閉；看到又編成 1，就把當時的 inflight 標記內容記進來，改成 ready。

## 完成紀錄

修正之後三個真實 task 的 build 交接檔編號都連續遞增、沒有撞名，不必改碼. 詳見 [任務紀錄](../records/2026-10.md#r-2026-10-22-894981bb)

- commit d37caae8
