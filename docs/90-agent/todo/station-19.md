---
label: station
title: 文件頁全文搜尋
description: 文件頁只讀 map.js 算好的統計卡，沒有全文搜尋；要做的話得加一個 server-side 的搜尋 payload — [docs/station.md](docs/90-agent/reference/station.md).
state: done
link: docs/90-agent/reference/station.md
group: 文件全文搜尋有人要
timing: if: 有人要 文件 頁的全文搜尋
stamp: 2026-09-26
done:
  at: 2026-10-09
  sha: e77cc85c4d85b5248427a362576ba314e6327cc6
  disposition: done
---

來源：根目錄 TODO.md 第 191 行的條目（2026-09-26 記），改成逐條的 todo 檔。

要做成：文件頁只讀 map.js 算好的統計卡，沒有全文搜尋；要做的話得加一個 server-side 的搜尋 payload

完成條件：條目所述的事做完，或查證後確認不必做；結果與證據（指令輸出、commit sha 或不做的理由）寫回這個檔案的正文，再用 todo.js done 結案。

## 完成紀錄

full-text search exists. scripts/station.js:462 serves /station/search from lib/docsearch.js:121 search(), drawn under docs-search in docs/90-agent/reference/station.md:1076

- commit e77cc85c4d85b5248427a362576ba314e6327cc6
