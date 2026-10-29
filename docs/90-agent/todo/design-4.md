---
label: design
title: design 依專案決定手機版
description: 不是每個專案都要手機畫面，design 該依專案性質決定要不要畫手機版
state: ready
link: skills/fankeel-design/SKILL.md
---

來源：2026-10-29 使用者問 design 的 skill 是不是包含手機設計，指出不是每個專案都需要手機畫面，要依專案性質決定。已知：design 的 SKILL.md 沒規定一定要畫手機版，拍哪些寬度由各專案的 .fankeel/render.json 決定（fankeel 自己列了 412 寬，因為測站有手機頁）；但 skills/fankeel-design/catalog/include.json 有「手機 4 欄……每個斷點都要測」這類條目，可能讓 mockup 代理預設也畫手機版，還沒查。要做成：先查 agents/fankeel-mockup.md 與參考目錄會不會預設畫手機版；再決定由 profile 或 render.json 宣告專案要不要手機版，design 只在宣告時畫。完成標準：沒宣告手機版的專案，design 不再出手機 mockup，有測試或一次真實 design 證明。
