---
label: docs
title: station.md 三處引用指錯行
description: station.md:235、755、757 引用的 station.js 行號落在無關程式上
state: done
done:
  at: 2026-10-17
  sha: 8a05b2e2
  disposition: done
  session: ae8f8efd-1af2-4e36-bbba-2b8908d4b992
---

來源：2026-10-17 TODO 全表盤點（Pane 收合與 TODO 跳轉）的 verify 站，task 4 的 verifier 與對抗審查都發現 docs/90-agent/reference/station.md 有三處沒加引號的 assets/station/station.js 引用指錯行：235 行說是 NAV_TREE 的 settings 項，755 行說是 navHtml，757 行說是 <details class="csmore">，但那三個行號落在 talkCut 的 meta.push、compact 分支與一行註解上。這三處在 eae94c85（這次改動之前）就已經錯了，task 4 只是跟著其他引用一起平移；docs-check 看不到，因為它們沒有引號可比對。應變成：三處各指到它描述的程式，並補上引號，讓 docs-check 以後能抓到漂移。完成條件：node scripts/docs-check.js 對這三行不再報 carries no quote，且打開每個行號都落在它說的符號上。

## 完成紀錄

station.md 那三處引用改指到它們描述的程式：stage 與模型明細的 details 元素、設定項的 NAV_TREE 那一列、navHtml 函式，三處都補上引號。docs-check 對這三行不再回報，以後行號漂移它抓得到。

- commit 8a05b2e2
