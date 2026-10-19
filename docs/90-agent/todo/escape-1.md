---
label: escape
title: 工具參數中文寫成轉義
description: 模型在工具參數裡把中文寫成 \uXXXX 轉義，寫錯一位就變成別的字而且不報錯；ALWAYS 規則每輪都在仍擋不住，受控站與 brief 根本沒帶這條
state: ready
link: lib/stages.js
group: 工具參數的中文
timing: now
stamp: 2026-10-19
---

來源：2026-10-19 使用者在 SBIR 的 session 看到模型自己認錯「選單又寫成 \uXXXX，第四次」，問是不是 prompt 不夠細、網路上有沒有人遇過。使用者在畫面上沒有看到轉義字。

已確認的事實：
- 存進 transcript 的 AskUserQuestion 參數都是解碼後的中文。SBIR session 74ccfae9 的 7 次選單裡，沒有一次留下 \uXXXX。所以畫面正常不代表沒寫轉義，transcript 也查不出來。
- 那個 session 每一輪的注入區塊都帶著 ALWAYS[3]（lib/stages.js:122），共 20 輪以上，還是寫錯了四次。所以 prompt 寫得更細，大概也擋不住。
- 受控站的控制區塊（lib/stages.js controlFor）不帶 ALWAYS。2026-10-19 本 repo 的 session 8e505921 在受控的 survey 站，wrap_up 的兩個按鈕標籤就寫成了轉義字。hooks/brief.js 給站 agent 的 brief 也沒有這一條。
- hook 收到的 tool_input 已經解碼，PreToolUse 看不到原始的轉義寫法。

網路上的回報（anthropics/claude-code）：
- #83033（open，2026-08）：韓文。用 Bedrock 直接抓原始串流做對照實驗。只要寫了轉義，45 次全部出錯，約 3–5% 的字變成別的字；改寫原字後 60 次只錯 1 次。作者結論是有沒有寫轉義才是關鍵，不是規則本身。Anthropic 的 bcherny 回覆已轉給模型團隊，正考慮由 harness 引導模型寫原字；重現時請附 --include-partial-messages 的 stream-json。
- #79339（stale 關閉）：轉義寫到一半漏成原字，例如 \로，整筆 JSON 解析失敗。另一支是十六進位寫錯，解出另一個合法的字，工具照樣成功，錯字安靜地存下來。
- #69522（stale 關閉）：長的轉義參數解析失敗，回報裡有繁中，換短一點或改寫原字重試就過。
- garrytan/gstack#1203：繁中「管理工具」被寫成「㄃3用箱」。修法是在選單模板加一條規則：中日韓文字直接寫 UTF-8，只允許 JSON 必要的跳脫。已合併，沒有前後數字。
- Giskard 對 OpenAI structured output 的分析：提示裡有 \uXXXX 的範例，模型會模仿。我們的規則文字本身就寫著 \uXXXX，這一點有沒有影響還沒驗證。

要做成：
1. 先量。掃這台機器上所有 transcript 的 AskUserQuestion、TodoWrite、Write 參數，找罕用字、注音符號、U+FFFD，估計安靜錯字的比例。也找 __unparsedToolInput，算解析失敗的次數。
2. 補上沒帶規則的地方：受控站的控制區塊、hooks/brief.js 的 brief。注入區塊上限 2400 字，要先找出能讓的字。
3. 規則改寫：只說「中文直接寫字」，拿掉「fail to parse」這種只講到一半的後果。測一次拿掉 \uXXXX 字樣會不會比較好。
4. 寫一個 PreToolUse 檢查：AskUserQuestion 的文字裡出現罕用字或注音，就退回重寫。
5. 寫進 fankeel-explain：轉義解碼正常時不用對使用者認錯，因為使用者看不到，認錯只是雜訊。

完成條件：第 1 步有數字。第 2–4 步做完後，同樣的量法再跑一週，安靜錯字和解析失敗都要比第 1 步少。
