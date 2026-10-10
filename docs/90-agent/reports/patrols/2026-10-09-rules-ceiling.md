---
status: decision
last_verified: 2026-10-09
---

# 六處頁面仍把 4 說成上限（10-09）：定了什麼

一句話：dispatch-1 把「一次派四個」從上限改成預設之後，survey、audit、verify、init 四張 skill 頁還有七句、pipeline.md 還有三個圖節點照舊寫成上限；這一輪全部改成「預設四個」，並各加一個測試，以後再寫回「上限」就會紅。

計畫在 [2026-10-09-rules-ceiling.md](../../../99-archive/2026-10-09-rules-ceiling.md)。

## 做了什麼

- survey 一句、audit 兩句、verify 兩句改成預設；新測試掃全部十三張 skill 頁，抓「four … ceiling」、「the ceiling names」與「four in one response at most」三種寫法。
- init 一句改成 `four at once by default`，原本釘住舊句子的測試一起改。
- pipeline.md 的 build、verify、audit 三個圖節點改成預設；新測試抓兩種舊寫法。

## 沒改的，與為什麼

- survey 頁 walk 的檔數上限、AskUserQuestion 最多四個選項、audit 頁每批最多 40 頁：那是別的上限，不是派工數。
- audit 頁「pairs past that are one reader with a list」與 verify 頁「a plan of six goes four then two」：reviewer 認為讀起來仍像上限。沒改，因為兩句分別是 fankeel 主頁「答案同形狀就合成一個 reader 給清單」與 build 頁「ready 列六個先送四個」的原話，講的是預設下怎麼分批。
- docs-check 仍報兩個 TODO 條目（inject-3、station-16）的句子太長：分支開始前就在，不屬於這次。
- 子代理 brief 改走 spawn：使用者在 survey 決定維持在 Ready，等自己的互動式 session 探測。
