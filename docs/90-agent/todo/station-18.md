---
label: station
title: station 介面只有中文
description: `assets/station/station.js` 與 station.css 的介面文字（約 519 行 UI 字串）目前只有中文，沒有 i18n 機制 — [docs/station.md](docs/90-agent/reference/station.md).
state: done
link: docs/90-agent/reference/station.md
group: 站頁介面只有中文
timing: if: 有使用者需要非中文的 station 介面出現
stamp: 2026-09-26
done:
  at: 2026-10-09
  sha: e77cc85c4d85b5248427a362576ba314e6327cc6
  disposition: done
---

來源：根目錄 TODO.md 第 186 行的條目（2026-09-26 記），改成逐條的 todo 檔。

要做成：assets/station/station.js 與 station.css 的介面文字（約 519 行 UI 字串）目前只有中文，沒有 i18n 機制

完成條件：條目所述的事做完，或查證後確認不必做；結果與證據（指令輸出、commit sha 或不做的理由）寫回這個檔案的正文，再用 todo.js done 結案。

## 完成紀錄

assets/station/i18n.js:10 holds the English for every loc(key, zh) call in assets/station/station.js:34. The page is therefore no longer Chinese-only (docs/90-agent/reference/station.md:1168)

- commit e77cc85c4d85b5248427a362576ba314e6327cc6
