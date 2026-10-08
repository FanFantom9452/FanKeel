---
status: current
last_verified: 2026-10-09
---

# 工作流評審，2026-10-09

外部評審原文，使用者於 2026-10-09 以 `/fankeel` 交入，逐字存檔。數字是評審方從 repo（main 含 31440af9）與專案自己的報告算出來的；評審方沒有自己跑 A/B。這份是任務「落實 10-09 工作流評審」的輸入，不是專案的量測。

---

**結論先講。** 這套工作流的骨架是對的，而且真的跑得完：50 天 298 個任務，248 個走到 land。它最少見也最值錢的特質是每個決定都量過，量錯了就改。真正的風險在最上面那一層：把整站交給 stage agent 的機制是整個系統最脆弱、補丁最多、也是唯一沒量到收益的部分，而這個 repo 的 profile 把它開在全部七站。第二個風險是規則與文件的表面積已經超過它自己訂的原則能撐的範圍。

所有數字都是從 repo 算出來的，或是專案自己的報告。我沒有自己跑 A/B。

| 任務最後停在 | 數量 |
|---|---|
| land | 248 |
| survey | 34 |
| build | 14 |
| plan、verify | 各 1 |

## 做對的地方

- **每輪重送當站規則，答題後再送一次。** 這解決的是注意力衰減，不是省 token。專案發現「AskUserQuestion 的回答不是 prompt，所以注入不會回來」這個洞，一次 session 511 條記錄只注入了一次，然後用 PostToolUse 補上。每輪注入 2,400 字元的上限由測試守住，耗時中位數 183ms。
- **Gate 的形狀固定。** 選項一永遠是核准，必有暫停，答案寫進 registry，任務比 session 長壽，被 /clear 丟掉的任務會被接回。這是 298 個任務能走完的原因。
- **腳本取代紀律文字。** 「去找有沒有現成的」變成掃描腳本，「TODO 要保持是索引」變成檢查腳本，build 的派工順序由帳本算而不是記。規則放哪一層有明確順位：腳本能查的放腳本，跳過會無聲的放注入錨點，其餘才放 skill。
- **量測文化。** 50 多份有日期的報告，多數有對照臂。guard 預設、output style、brain 用哪個模型、Haiku 能接什麼，都是被量測推翻過的決定。決策頁甚至記下自己同一段寫錯兩次。
- **文件被測試釘在程式上。** 23 條測試專門檢查文件的說法是否仍然為真。同類專案幾乎沒看過這種做法。
- **觀測而不宣告。** 碰到的檔案由 hook 與 git dirty 記錄，碰撞以路徑為鍵，不要人填 scope。
- **build 的帳本撐過 compaction，verify 不 commit，fix round 五輪封頂並記 ruling。** 這三條讓 build 能不停問而不失控。

## 問題，由重到輕

**1. Stage agent 層。** 最脆弱、補丁最多、唯一沒量到收益，卻開在全部七站。

專案自己的證據已經說了這件事。唯一有對照臂的 A/B 只量了 survey，最後一輪是成本 0.97 到 1.05 倍、時間 1.44 到 1.57 倍、主控 context 反而多了約 8k tokens。survey 只占長任務花費的 7%，build 加 verify 占 63.9%，這兩站從來沒量過。subagents.md 第 717 行寫著「預設應該等那個量測」，但 profile 已經設成 all。10-04 全站 controlled 的報告沒有對照臂，自己的結論是「能不能省 context 無法判斷」，主控峰值 153k 到 343k tokens，每次 build commit 讓主控多 14k 到 28k。

這一層累積的事故，每一件都長出了一塊補丁：

| 事故 | 日期 | 長出來的補丁 |
|---|---|---|
| SendMessage 丟失兩次，commit 回報沒到 | 09-23 | 主控改讀檔案，fs.watch 加 3 分鐘 idle 與 11 分鐘 busy |
| commit 檔寫錯目錄四次 | 09-23 | 兩個候選路徑都監看 |
| brain 用 261 次 Bash 輪詢，共 295 次 | 09-23 | agent 檔加 waiting 規則 |
| brief 超過 10KB 被存成檔，三個 brain 兩個沒開 | 10-01 | agent 檔第一段改成先開溢出檔，未驗證 |
| gate 格式錯三次，各多一輪 | 10-02 | 寫檔時與回傳前各驗一次 |
| 主控改寫 gate 問法 | 09-24 | 字元重疊閾值 0.5 與 0.8 |
| 活著的 agent 被判 lost，約八次加三次 | 09-30、10-02 | 讀 transcript 尾端判斷是否欠回覆 |
| mark 錯群，晚醒 32 分鐘搶走 audit 的 mark | 10-02 | 讀 prompt 第一個字判站 |
| brain 在 implementer 還在跑時結束，Task 8 做兩次 | stage-agents-11 | 規則文字 |
| auto mode 給 no verdict 六次以上 | 09-22 | allow rule，十次探測無法證明有效 |

結果是 gate hook 331 行、handoff 模組 669 行、brain agent 檔 10.6KB 且大半是禁令。現在這個 live session 的 plan brief 我實際渲染出來是 10,692 字元，超過 tests/brief.test.js 第 129 行守的 10,000。測試只對較小的 fixture 通過。brief-2 就是這個失敗模式，仍在 Blocked。

設計文件自己寫著「委派一站裡的工作，永遠不要委派整站」，然後加了一個例外，再把例外開到全部。這不算矛盾，但它說明這一層是在原則之外長出來的。

**2. verify 與 build 的來回。** 退回太頻繁，review 契約靠事故在長。

| 指標 | 數字 |
|---|---|
| verify 退回 build 的次數 | 119 次，298 個任務 |
| 單一任務最多被退 | 11 次，10-01 |
| build skill 的 reviewer 模板 | 約 150 行，內嵌那 11 次的逐次記錄 |
| reviewer agent 檔 | 15KB |

模板第二部分的 selector 覆蓋表是機械規則，照專案自己的順位應該是腳本，現在是 prompt。09-07 那份 reviewer 成本報告 n=1：reviewer 找到 5 個測試抓不到的問題，但漏了 3 個測試抓到的。

**3. 規則與文件的表面積。** 已經超過原則能撐的範圍。

| 東西 | 大小 |
|---|---|
| 主 SKILL.md，每次 /fankeel 載入 | 76KB，約 19k tokens |
| 七站 skill 合計 | 271KB |
| 20 個 agent 檔 | 120KB |
| 每輪注入 | 2.4 到 2.6KB |
| 追蹤檔 | 2,577，約 1,400 是 evidence |
| commit | 3,215，其中 docs 1,279 |
| TODO 條目 | 158，43 條開著 |

2,400 字元的注入上限守得很嚴，擠出去的規則全落到 skill 層。但 09-15 的探測說「注入的到得了，連結後的到不了」，rationale.md 四次裡零次被讀；09-04 的探測 21 次有 20 次只放在 skill 的程序輸給後來的內容。順位制把規則搬到量到最弱的那一層。決策頁 835 行，同一節內自我取代三次。43 條開著的 TODO 裡，17 條是從舊 TODO.md 複製過來、沒寫理由的。

**4. 紀律的硬指標。** 最近一次 land 鬆了。

- HEAD 有一條紅燈。source.test.js 釘到三個 TODO 條目的 description 帶裸路徑，三個檔都是 10-08 那次 land commit 搬進來的。land 的第一條規則是全套綠燈否則停。
- hooks-1 記錄 /doctor 看了 50 個 session，UserPromptSubmit 四次全逾時，中位數 7.9 秒；10-05 的量測暖機最大 5,460ms，仍超過 5 秒限制。
- 三條 flaky test 在 Watch。README 要求一次只跑一個 npm test。測試 53k 行，程式 28k 行。

**5. 人在 gate 前的等待。** 這才是真正的瓶頸。

| 站 | 累計等待 |
|---|---|
| build | 133 小時 |
| verify | 84 小時 |
| plan | 30 小時 |
| land | 25 小時 |
| survey | 22 小時 |
| design | 22 小時 |
| audit | 16 小時 |

這是設計使然，gate 就是產品。但它表示吞吐量受人的出席限制，於是長出 gate.station、手機作答、gate-7 的 mod pane，每一個都是新表面。

**6. 證據的來源。** 幾乎全是這一個 repo、一台 Windows 機器、一位使用者。94 個計價 session 有 78 個是 fankeel 自己。多數報告 n 是 1 到 5。controller multiplier 報告自己的表重複加總，k 從 2.29 修到 1.71，結論段沒改。Haiku 的 reader 判「not haiku」被推翻；fix-bug 整段 run 的 Haiku 臂反而貴 13%，sub 臂三次零次有效。override 檔只在新 process 生效，10-08 讓 land 派不出 reader 與 mover。

## 我會怎麼做

1. **先量 build 與 verify 的 controlled 對照臂，量之前把 stage.agents 縮回 survey。** 這是專案自己的頁面已經寫下的順序。沒量到之前，每一塊補丁都是在替一個未證明的機制付利息。
2. **把 reviewer 模板裡的機械檢查寫成腳本。** selector 表、mutation 紅綠、引用行號都能跑，prompt 只留判斷。
3. **brief 上限用真實 session 記錄測。** 超過就裁 context facts，不要靠 brain 記得去開溢出檔。
4. **修 HEAD 的紅燈，並讓 land 的全套綠燈變成腳本拒絕而不是規則。**
5. **決策頁改成改寫不追加，17 條沒理由的 TODO 補理由或關掉。**
6. **拿到一個不是 fankeel 的專案跑一週，數崩壞次數。** 這是唯一能回答「設計是不是只適合這個 repo」的方法。

沒驗證的：10,000 字元是不是 Claude Code 的真上限我無法確認；這個 session 的 brief 有沒有真的溢出要看 transcript 才知道；所有 A/B 都沒比過輸出品質，這點專案自己也承認。audit 與 land 兩站的 skill 我只讀了標題。

---

## 使用者的指示，2026-10-09

六條建議全做；design 站再看有沒有更好的整體設計。要兼顧：專案背景的理解、專案樹保持乾淨、完整的開發流程（SDLC、TDD 等）。

## 開任務前已驗證（controller，2026-10-09）

- `node --test tests/source.test.js` 在 HEAD 確實紅：build-8、station-18、station-20 三條 description 帶裸路徑。
- `.fankeel/profile.json` 的 `stage.agents` 列了全部七站；`guard` 為 `deny`。
- Blocked 群「受控 build/verify 實跑」有 9 條（stage-agents-1 到 9），全等同一次量測；stage-agents-15 的 ab.sh 重跑約 $30 要核准。
- 建議 3 對上 brief-2（Blocked）與 brief-3（Ready）；建議 2、5、6 沒有對應的 TODO 條目。
