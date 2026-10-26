---
status: decision
last_verified: 2026-10-27
---

# mockup 照使用者留下的設計目錄畫，design-lint 擋排除的樣式（10-27）

一句話：taste-skill、impeccable、designer-skills 排除與收錄的 162 塊樣式，使用者全部留下，存成 `skills/fankeel-design/catalog/` 兩個 JSON；17 列互相矛盾的地方逐列選邊，寫進 `design-guide.md`；`scripts/design-lint.js` 在 mockup 用了排除樣式時失敗。

計畫在 [99-archive/2026-10-27-design-catalog.md](../99-archive/2026-10-27-design-catalog.md)。

## 決定

- `exclude.json` 69 塊、`include.json` 93 塊，每塊帶來源；只有 mockup agent 畫圖時讀，不進每回合的規則。
- 排除塊中，樣式表或標記看得出的接上 `design-lint.js` 的規則，其餘標 `review`，給 mockup agent 自己審。
- lint 規則：漸層字、紫藍漸層、光暈、硬陰影、側邊條、大寫標籤、玻璃、過小字、純黑白、`transition: all`。
- 另有字體太多、強調色過用、emoji、假名字四條。
- 17 列選邊：內文一般 16px、密集畫面 13px、不低於 12px；行寬 45–75ch；1px 列線只用在操作畫面；兩種字體加一個等寬；預設平面，只有浮層有陰影；一套圓角比例；大區塊滿寬，只限內文寬；不用全大寫標籤；內容可淡入、清單不錯開；照片上的字用色層或漸層，不用模糊；巢狀最多兩層；色盤用 primary、secondary、accent 各 50–950 分工，accent 每畫面一處。
- station 自己的 eyebrow 與 3px 邊條違反選邊，記成另一個 TODO，這次不改。

## 為什麼

使用者要先看過它們排除與收錄的樣式，再決定留什麼；看完兩次都說全部留，所以目錄收全部，矛盾處以使用者的選擇為準。檢查做成自己的零依賴腳本，因為 taste-skill 與 designer-skills 是 MIT，可以借用並保留版權聲明，impeccable 的授權標示不一致，只借概念、改寫。

## 放棄了什麼

- 直接 vendor 外部腳本（draw、lint、inspect）：授權與依賴都要另外處理。
- 讀外部樣式表的 lint：只讀頁面自己的 `<style>` 與 `style=""`，所以連結進來的樣式表看不到。
- 屬性選擇器內的逗號與 `:not(:is(...))` 巢狀括號仍會讓 accent-overuse 多報，極少見，裁定不修。
