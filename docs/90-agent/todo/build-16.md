---
label: build
title: 板子編輯缺連線文字與類別
description: 設計寫了改連線文字與新增節點選類別，工具列沒做
state: ready
---

board upgrade 的整支 branch review 發現設計 §3 工具列有兩項沒實作：「改文字（節點與連線）」只有節點雙擊（assets/station/board-edit.js 的 dblclick 只開 [data-type="node"]），沒有連線文字；「新增節點（可選類別）」寫死 cat: 'service'，沒有類別選單。要補成：雙擊連線標籤可改文字（送 set label 到 edge）；新增節點時能從 CATEGORIES 選類別。完成標準：兩項各有測試按對應事件、移除分支就變紅。
