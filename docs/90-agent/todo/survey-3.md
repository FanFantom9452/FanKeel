---
label: survey
title: history lens
description: survey 對 architectural 任務加一個 git 歷史 lens（blame、log -S、PR 說明），回傳附證據分層與「不知道什麼」
state: ready
link: skills/fankeel-survey/SKILL.md
---

來源：2026-10-19 判官比較 cursor/plugins 的 pstack 與 fankeel（docs/90-agent/judgements/2026-10-18-cursor-plugins-pstack.md，比較表 #17，判官評為 B、第六順位）。pstack 的 why skill 同時查七類來源（版控、issue、聊天、文件、錯誤追蹤等），把結論分成 Direct／Supported／Inferred／Speculative／Unknown 五層，並強制一節「我們不知道什麼」。fankeel survey 的 reader lens 沒有專門看 git 歷史的，讀者雖已自發用 EXTRACTED／INFERRED 標記，但沒寫進 fankeel-reader 的回傳形狀。

要變成：skills/fankeel-survey 在 architectural class 的 lens 表加一個 history lens（git blame、git log -S、commit 與 PR 說明），並考慮把證據分層與「不知道什麼」節寫進 agents/fankeel-reader.md 的回傳形狀。

完成的樣子：一個 architectural 任務的 survey 報告含 history lens 的結果與它的不知道清單；skills-check 綠。
