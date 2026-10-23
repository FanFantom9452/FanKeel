---
status: decision
last_verified: 2026-10-24
---

# TODO 全表盤點（10-24）：做了什麼、沒做什麼

一句話：監控站的路由只走模組，舊儀表板與舊 TODO 面板刪了，三份模組清單由同一份來源讀出；首次載入的骨架依版型分成清單、詳情、表單三種；tune 可以先點開 modal 或下拉，再圈選裡面的元素。

計畫在 [2026-10-24-station-modules-skeleton-tune.md](../../99-archive/2026-10-24-station-modules-skeleton-tune.md)，判斷依據在 [2026-10-23-station-skeleton-stack.md](../judgements/2026-10-23-station-skeleton-stack.md)，決策紀錄在 [2026-10-24-station-vanilla-modules.md](../../03-decisions/2026-10-24-station-vanilla-modules.md)。

## 做了什麼

- `VIEWS` 不再有 `OLD.*` 後備，每條路由都交給 `FK_*` 模組；vm 測試改由 `tests/station-src.js` 依 index.html 的順序載入全部腳本（d7f8bab2）。
- index.html、`scripts/station.js` 的 STATIC 與 `lib/station.js` 的 MODULES 讀同一份模組清單，有測試斷言三者一致（64088358）。
- 舊儀表板與舊 TODO 面板刪掉，連同只測它們的測試與 i18n key；station.js 從 7003 行降到 6393 行（155cf163、799b91ef）。
- 決策紀錄：監控站維持 vanilla classic scripts、零依賴、無 build，ESM 與框架因 vm 測試與 file:// 形式而不採用（6b4631d8）。
- 首次載入時 index.html 的內嵌腳本依 hash 在 `#page` 設 `data-skel`，station.css 畫 list、detail、form 三種骨架，儀表板仍是預設（f2c4acb7）。
- tune 可以先操作頁面讓 modal 或下拉出現，再選取其中的元素並送出調整需求；送出時借用開啟它的元素的 block（48aeeb36、b1822166）。
- station.md 拿掉已刪的儀表板與後備的描述，station-doc 測試跟著改（5ab3f382、76a120bb）。

## 沒做什麼

- 「station 留 vanilla、拆完模組」只做了第一段：一份計畫最多能動 station.js 約 3000 行，station.js 還有 6393 行，要降到 1500 行以內、把文件、設定、天數等頁搬成模組，還要再開兩到三份計畫。條目維持 Ready。
- 文件頁、設定頁兩條等拆模組做完再移植。
- 遠端方案：使用者說 Cloudflare 也可以，但定位為進階選項，Tailscale 仍是預設；條目還沒改寫。
- 「gate 頁重畫，摺疊點不開」等使用者自己在瀏覽器點過才結案。
- 沒在真實瀏覽器驗：tune 在 `showModal` 開著的 `<dialog>` 裡圈選，以及延遲載入資料時骨架的實際畫面（此 repo 沒有 render.json）。
- group 1 審查留下五個測試缺口沒補：live 頁端到端、`hist:` 切換、plan／events／gate 分頁的 boards 圖卡、talk 頁兩個斷言、專案頁空 TODO 清單。
