---
status: decision
last_verified: 2026-10-15
---

# TODO 全表盤點（10-15 第四次）：做了什麼、沒做什麼

一句話：`--project` 打錯會被拒、architectural 任務派工不再省額度、driven 站能自己跑 node 與 git、升級技能確定不必補步驟，四筆結案；整套 4333 個測試通過。

計畫在 [2026-10-15-todo-patrol-four.md](../../../99-archive/2026-10-15-todo-patrol-four.md)。

## 起因

使用者在開任務時選了 TODO 全表盤點，並且把兩筆待決條目一起帶進來：「driven 站跑不了 node」和「升級技能要不要補步驟」。survey 的關卡上，使用者選了做 profile-3 與 model-6、放行 node 與 git、先列出格式變動清單。計畫排成五個任務，最後一個是使用者另開探針 session，讓 drive.js 實際帶一輪 build。

## 做了什麼

- `task.js profile` 的 set 與 preset 遇到不存在的 `--project` 會拒絕並以非 0 結束，不再把設定悄悄寫進 registry 根目錄。結案 profile-3。
- architectural 任務的派工下限自動拉到至少 opus、effort 拉到 high；plan、build、verify 的 class 行寫出這一級，brain 的 brief 也帶同一個下限給實作者、mutator 與 mover。結案 model-6。
- drive.js 跑 driven 站時多傳只允許 node 與 git 的工具規則，仍是 acceptEdits。探針 session 實際帶了一輪 build，driven 站自己跑出 25 個測試通過、0 個失敗。結案 session-4。
- 0.108.1 到 0.110.0 之間專案檔案格式只有一項變動，舊檔照讀，所以升級技能維持只管 TODO 搬遷。結案 upgrade-3。

verify 走了三輪。第一輪找到五句說明頁仍只說 `dispatch.floor`、model-6 條目說錯 lean preset 設的鍵；第二輪找到一句把下限拉高說成連 survey 與 audit 的 reader 也算。都回 build 修好、各自審過。

## 沒做什麼

- class 行在 plan、build、verify 用拉高後的一級取代原本的定義句，因為另加一行會撐破區塊上限；這是計畫階段的裁決，不是遺漏。
- survey、design、audit 的 reader 不拉高，維持 `dispatch.floor`。
- 探針 session 89e23d48 還開著，要在它自己的視窗用 `task.js down` 收掉。
