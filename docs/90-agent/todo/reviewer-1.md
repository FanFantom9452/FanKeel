---
label: reviewer
title: 審查者過濾紀律
description: fankeel-reviewer 加三條駁回規則、空審查合法、四條推定阻擋項；verify 確認 reviewer 換用不同模型
state: ready
link: agents/fankeel-reviewer.md
---

來源：2026-10-19 判官比較 cursor/plugins 的 pstack 與 fankeel（docs/90-agent/judgements/2026-10-18-cursor-plugins-pstack.md，比較表 #9、#33，判官評為 B、前五名第四）。pstack interrogate 的 lead-judgment.md 列出假陽性規則：全是 nit 就說程式沒問題、null 之類的假設要追到真實呼叫點、「我會用不同做法」一律駁回；reviewer-prompt.md 明說「no findings」是合法結果。thermos 的 code-quality rubric 有推定阻擋項：檔案跨過 1000 行、散落的 feature check、不必要的 wrapper 或 cast、重複 helper。

要變成：agents/fankeel-reviewer.md 補上這三條駁回規則、空審查合法、四條推定阻擋項（放進 cuts lens）；fankeel-verify 第二輪確認 reviewer 用與首輪不同的模型。

完成的樣子：reviewer agent 檔與 verify skill 多約 30 行，tests/agents.test.js 等現有測試通過，skills-check 綠。
