---
status: decision
last_verified: 2026-10-17
---

# TODO 全表盤點（10-17 第三輪）：五條要親手做的 Ready，使用者在場實測

一句話：上一輪留下的五條 Ready 都要在終端、Desktop 或站頁親手操作，這次使用者在場，一條一條實測，結果寫回條目；四條關閉，「Desktop 真機看壓縮視窗」還差一件沒證明，留在 Ready。

計畫在 [2026-10-17-todo-patrol-hands-five.md](../../../99-archive/2026-10-17-todo-patrol-hands-five.md)，裡面的 Ruling 一節記下兩條跟原步驟不一樣的地方。

## 做了什麼

- 終端啟動讀遠端狀態（結案）：從 VS Code 終端啟動的 session，開 Remote Control 時 band 尾巴是「遠端 ✓」，session 檔的 bridgeSessionId 有值，和 /remote-control 給的網址同一個；斷開後是「遠端 ✗」，值變成 null。終端和 Desktop 啟動的讀法一樣，band 不用分開處理。
- 面板真機沒看完的四件事（結案）：兩個 session 撞同一個檔，兩邊 band 都變紅色色帶，Pane 都多一區共用的檔名；⚑ 是畫在第二行，條目寫第一行是描述過時。把 gate.station 暫設 30 秒，Desktop band 第一行出現黃底「gate 在等」和倒數，Pane 不為它開。Pane 開任務自己開、關掉不再跳、任務結束自己關。淺色主題使用者判定不用測；題目被中斷，沒看到在站頁作答。
- 子代理 brief 改走 spawn（結案）：帶探測 mod 的互動式 session 派三個子代理，三個 transcript 第一行都是改寫過的 prompt；對跑到一半的子代理插一列，它下一則回應就接在那一列後面。兩條路都通，「brief.js 哪段搬到 spawn」開成一條待決定的新條目。
- 接縫「profile 中途翻轉」（結案）：把正在跑的 design 站移出 stage.agents，翻轉前後各把 Claude Code 會送的內容餵給五個 hook 一次。五個都在下一次呼叫就改讀新設定，沒有一個沿用 session 開始時的快照；翻轉也立刻影響同專案的其他 session。結果寫進 subagents.md。使用者要求自己測，所以沒經過站頁，直接寫同一個設定檔。
- Desktop 真機看壓縮視窗（未結）：settings 早就設了視窗 450000，10-16 有三個 Desktop session 自己在 417k 到 427k 壓縮，比 fankeel 自己的 450000 門檻還早，所以是主機依這個視窗壓的。

## 沒做什麼

- 「Desktop 真機看壓縮視窗」的第二件——hook 讀不讀得到那個變數——沒證明。原本拿「沒出現那一句」當證據，但 fankeel 設了 compact.at 450000 時那一句本來就不會出現，verify 的對抗審查抓到後退回 build 改寫。要看這一件，得找一個 compact.at 關掉的 Desktop session 跑過 400k。
- Blocked 十條、Watch 十二條沿用上一輪的盤點，這次沒有重查。

## 順手發現

- Desktop 的 Pane 開著、band 變窄時，第二行的 ⚑ 被裁掉看不到，色帶卻已經變紅；開成新條目「Desktop 窄 band 裁掉 ⚑」。
- 探測 mod 少了 plugin.json，`--plugin-dir` 載不起來；從上次的探測複製一份就好了。
- 把 stage.agents 設成全部七站時，本盤點自己的 build 也變成受控站，寫檔被擋；改成只開 survey 和 design 才繼續。
- docs-check 一直報 2026-10-16-build-workflow-script.md 的一句過長和一個裸 sha，這次開工前就有，沒動。
