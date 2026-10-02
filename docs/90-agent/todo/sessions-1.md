---
label: sessions
title: sessions.js 是否刪除
description: 10-01 audit：全檔 183 行加 `tests/sessions.test.js`，唯一 code 呼叫者是自己的測試，但它是帶 shebang 的 CLI，人可以手動跑；09-11 todo-split 記為 promote it 仍未定案。刪之前先確認使用者是否手動使用。
state: done
link: scripts/sessions.js
done:
  at: 2026-10-02
  sha: ab954cc52e964f1e0563aec901dffe9b38ad4b4d
  disposition: abandoned
---

## 決定 2026-10-02

TODO 巡檢的 gate，使用者選「保留，移出 TODO」：scripts 下的 sessions.js 是帶 shebang 的 CLI，可能有人手動跑；保留成本只是 183 行，不刪。
