---
label: init
title: init 幫忙設壓縮視窗
description: 使用者希望由 fankeel-init 的上手流程來設 CLAUDE_CODE_AUTO_COMPACT_WINDOW，而不是手改 settings.json；要先設計這一步
state: decision
link: skills/fankeel-init/SKILL.md
---

來源：使用者 2026-10-12 在 compact 任務的 plan gate，被問要不要現在把壓縮視窗寫進 ~/.claude/settings.json 時回答：先不設定，希望之後 INIT 功能可以設計。背景：主機自己的自動壓縮在設了 CLAUDE_CODE_AUTO_COMPACT_WINDOW 之後會在 turn 進行中自己壓（docs/90-agent/reports/2026-10-12-compact-window-probe.md），這是一次性設定，寫在 settings.json 的 env；docs/01-guide/profile.md 會寫怎麼手動設，lib/context.js 的 context 行在沒設而過 400k 時會提醒。要變成：fankeel-init（skills/fankeel-init/SKILL.md 與它的 onboarding 檢查）多一步，偵測這台機器有沒有設視窗，沒設就用一個問題問使用者要不要設、設多少（建議 450000），同意才寫進 settings.json 的 env，並說明它對每個 session 都生效、要重開才吃到。要先決定的事：寫在使用者層還是專案層的 settings；fankeel 改使用者設定檔是否符合「裝好後大部分不需要修改 Claude 設定」；站頁的精靈要不要也有這一步。完成條件：使用者核准這一步的設計，init 在沒設視窗的機器上會問這一題、答是就寫入且有測試，答否不再重問。
