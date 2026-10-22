---
judged: 2026-10-22T06:04:35.832Z
model: fable
agent: fankeel-judge
task: "station 遠端的手機實測（S24 + Tailscale）"
session: 8a1d6ae0-88cf-47ed-b122-33b0a48182ce
stage: verify
---

# 判官題：station 遠端的推播通知，該不該繼續用第三方 ntfy.sh？

## Question

# 判官題：station 遠端的推播通知，該不該繼續用第三方 ntfy.sh？

## 問題

使用者在 S24 實測 station 遠端時問：「這個通知是使用第三方取得的嗎？有更好的做法嗎？」

事實：station 的 gate／stage／end 通知是 `lib/notify.js` 以 detached child（`scripts/notify.js`）POST 到 `notify.server`（預設 `https://ntfy.sh`，第三方公開服務）的 `notify.topic`（`fankeel-` 開頭的亂數字串）。topic 就是唯一的密鑰：知道 topic 的人都能訂閱，且 ntfy.sh 上的公開 topic 不需登入即可讀。通知內容含 stage 名、gate 問題全文、任務名。station 本身只經 `tailscale serve`（tailnet only）對手機開放。

實測現況（2026-10-22）：兩則 gate 通知以 priority 4 送達 ntfy.sh（輪詢 topic 確認），但手機沒響——topic 由使用者從桌面卡片手抄，疑似抄錯；/m 頁面沒有訂閱入口（已記 TODO：手機頁訂閱通知按鈕，`ntfy://` 連結）。手機用三星瀏覽器，只能「新增至主螢幕」，沒有可安裝的 PWA（站台只有 SVG icon）。

## 要選的

1. **維持 ntfy.sh**：第三方，但免架設、Android app 成熟、背景推送可靠；問題只在訂閱入口（已有 TODO）。可加：通知內容減量（不帶 gate 問題全文）、或 ntfy access token。
2. **自架 ntfy**（例如在同一台機器跑 ntfy server，經 tailnet 提供）：資料不出 tailnet；但手機 app 收自架伺服器在 Android 上要嘛靠 FCM 中繼（ntfy.sh upstream）、要嘛常駐連線吃電。
3. **Web Push（瀏覽器 Notification + service worker + VAPID）**：不靠 ntfy，station 自己推；但推送仍經瀏覽器廠商的 push service（Google FCM / Samsung），需要可安裝/有 SW 的頁面，三星瀏覽器「新增至主螢幕」的捷徑能否收到要驗。
4. **Tailscale 本身的通道**（若有）或其他。

## 要讀的

- `lib/notify.js`（request、gateEvent、fire、remoteBase）
- `scripts/notify.js`
- `hooks/gate.js:185-205`
- `lib/profile.js:55-62`（notify.* 鍵）
- `docs/90-agent/plans/2026-10-21-station-remote-design.md` §5（當初選 ntfy 的理由與放棄的方案）
- `assets/station/mobile.js`、`assets/station/remote-card.js`、`assets/station/` 下的 manifest／service worker（若有）
- `docs/90-agent/todo/station-41.md`
- ntfy 文件（Android 收自架伺服器、access control、`ntfy://` 連結）與 Web Push 在 Samsung Internet 的支援，可用網路查證

## 什麼算答案

一個 pick（1–4 或明確的組合），附：這次實測要不要因此改清單（例如第 5、6 項繼續用 ntfy.sh 測完）；若建議改方向，是另開 TODO 還是修改 station-41 那筆；以及通知內容是否該減量。必須點名當初設計文件放棄其他方案的理由是否仍成立。

## 回傳形狀

六個欄位（依 fankeel-judge 的固定格式，含 `pick:`），之後 `## Summary`。

## Answer

pick: 1 維持 ntfy.sh——清單不改（第 5、6 項照 ntfy.sh 測完）、station-41 那筆照舊不改、通知內容不減量；只另開一筆小的文件 TODO 記「自架 ntfy 只要改 notify.server」與 topic 即密碼的注意事項。
why: 這次沒響不是 ntfy.sh 的錯：兩則 priority 4 都到了伺服器，壞在 topic 手抄（docs/90-agent/todo/station-41.md:9），訂閱按鈕那筆 TODO 就是對症的修法。
決策紀錄放棄自架／Web Push 的理由「要多一個服務或憑證管理，ntfy 一個 POST 就夠」（docs/03-decisions/2026-10-21-station-remote.md:28）在程式裡字面成立：一個 fetch、一個 content-type header（lib/notify.js:97）。
而且在 Android 上更成立：自架伺服器 ntfy app 不走 FCM，靠常駐前景服務（docs.ntfy.sh/subscribe/phone）；`upstream-base-url` 的中繼只給 iOS（docs.ntfy.sh/config）——brief 選項 2 的「FCM 中繼」前提對 Android 不成立。
內容已限在「stage＋第一題 80 字＋任務名 80 字」（lib/notify.js:51-52；設計 §5 design:71），且送第三方是 survey 時使用者接受的（decision:22）；再減就只剩「gate 在等你」，手機上看不出該不該回去答。
「加 ntfy access token」在 ntfy.sh 要付費 Pro 才能保留 topic，免費方案 topic 本身就是密碼（20 hex、80 bit，lib/notify.js:21）——所以 token 這個子選項不做；選項 4 Tailscale 沒有推播通道。
would flip if: 使用者收回「內容可送第三方」的接受——那就改 notify.server 指向 tailnet 內自架 ntfy（profile 鍵已在，lib/profile.js:58，零程式改動），代價是手機常駐前景服務。
或者 station-41 做完、topic 確認正確後 S24 仍不響——那才輪到 Web Push。
unread: docs/90-agent/plans/2026-10-21-station-remote-design.md 在該路徑不存在，已歸檔為 docs/99-archive/2026-10-21-station-remote-design.md（讀者改讀該檔 §5）；caniuse.com 被 406 擋、MDN 相容表是 JS 渲染，Samsung Internet 的 Push API 支援沒能從網路查證；我自己的 curl 被 judge 的唯讀 hook 擋下，網路結果全靠讀者。
delegated: lib/notify.js、scripts/notify.js、hooks/gate.js:185-205、lib/profile.js:55-62（sonnet）；docs/99-archive/2026-10-21-station-remote-design.md §5 與 docs/03-decisions/2026-10-21-station-remote.md（opus）；assets/station/mobile.js、remote-card.js、sw.js、lib/mobile.js、lib/remote.js、scripts/station.js 路由（sonnet）；docs/90-agent/todo/station-41.md、todo/ 的 grep、.fankeel/build/task-20261022T052218/survey.md 與 verify.md（sonnet）；docs.ntfy.sh/subscribe/phone、/config、/publish、/subscribe/web、ntfy.sh 首頁、MDN Push_API、caniuse、tailscale.com/kb/1223/funnel（sonnet，curl）。
checklist: 1 lib/notify.js——已答（body、header、內容、click、topic 產生）；2 scripts/notify.js——已答（8 秒逾時、永遠 exit 0、失敗只記 host）；3 hooks/gate.js:185-205——已答（:200 傳 questions 與 session_id）；4 lib/profile.js:55-62——已答（五個鍵，無 token 鍵）；5 設計文件 §5——已答（改讀歸檔路徑＋決策紀錄 :22、:28）；6 assets/station 的 manifest／SW——已答（manifest 與 icon 由 lib/mobile.js 執行期產生、sw.js 只快取 shell、/m 用 5 秒輪詢）；7 station-41.md 與清單第 5、6 項——已答（verify.md:40-41）；8 ntfy 文件與 Samsung Web Push——ntfy 部分已答，Samsung Internet Push 支援未答（網路查不到可引用的句子）。

## Summary

### 讀者各自找到什麼

**通知程式路徑（sonnet）。** `request()` 把 topic 放進 JSON body，URL 只有 `<server>/`（F:/ymlab/fankeel/lib/notify.js:83、:88）；`send()` 唯一的 header 是 `content-type: application/json`（lib/notify.js:97）。整個 lib/、scripts/、hooks/ 沒有 Authorization、Bearer 或 notify.token（grep 無命中）；scripts/notify.js:15-16 自己寫明「topic 是訂閱唯一的密鑰」。gate 通知的標題是 `<stage> gate 在等你`，訊息是第一題問句切 80 字加任務名切 80 字（lib/notify.js:47-54），只用 `questions[0].question`，不帶選項與其餘題目。有 tailnet 位址時 body 帶 `click` 與「打開 gate」action，指向 `<tailnet https URL>m#/gate/<session_id>`（lib/notify.js:84-87；`remoteBase` 只接受 `https://<host>/` 形式，lib/notify.js:26-30）。topic 由 `'fankeel-' + crypto.randomBytes(10).toString('hex')` 產生（lib/notify.js:21），80 bit。profile 的 notify 鍵：server 預設 `https://ntfy.sh`、topic 預設 null（限英數、`-`、`_`，64 字內）、gate／stage／end 預設 `'false'`（lib/profile.js:58-62）。呼叫點 hooks/gate.js:200 只讀機器 profile。

**設計與決策（opus）。** brief 指的 `docs/90-agent/plans/...design.md` 不在那裡，已歸檔到 F:/ymlab/fankeel/docs/99-archive/2026-10-21-station-remote-design.md，§5 在 :65-71；真正寫理由與放棄項的是 F:/ymlab/fankeel/docs/03-decisions/2026-10-21-station-remote.md。選 ntfy 的理由：「手機不必裝 fankeel 自己的 app 就能收到；內容會送到第三方，使用者在 survey 時已經接受」（decision:22）。放棄項只有一行涵蓋兩案：「自架推播或 Web Push：要多一個服務或憑證管理，ntfy 一個 POST 就夠」（decision:28）。Tailscale 不是被放棄的通知方案，它是 /m 的傳輸層。VAPID、FCM、Telegram、Pushover、email 都沒提。「topic 是唯一密鑰、公開 topic 不用登入就能讀」沒被提到（design:67 只說 topic 是亂數 20 hex）。內容範圍寫在 design:71：「stage、第一題、任務切 80 字、project 與成本，別無其他」。手機怎麼訂閱沒寫（design:49 的 QR 只給配對）。PWA 有寫：manifest、icon.svg、只快取 shell 的 sw.js（design:62），而「只有 SVG icon 的 manifest Chrome 會不會給安裝」列在「未驗證」（design:121-122）。

**手機頁資產（sonnet）。** assets/station/ 沒有靜態 manifest 與 PNG；manifest 與 icon 由 F:/ymlab/fankeel/lib/mobile.js:100-108 執行期產生，icons 只有 `{src:'/m/icon.svg', sizes:'any', type:'image/svg+xml'}`。sw.js 只快取 shell，無 push／showNotification。mobile.js 沒有任何 ntfy／Notification／subscribe 程式；新 gate 靠 5 秒輪詢 `/station/mobile.json`，且只在頁面可見時（assets/station/mobile.js:45、:495-497），所以鎖屏或背景時只有 ntfy 這一條推播路。桌面卡片把 topic 當純文字放在 `<code>` 裡，沒有複製鈕、沒有 ntfy:// 連結、沒有 QR（assets/station/remote-card.js:127-131）；唯一的複製鈕複製的是站台 URL（:148、:251）。

**TODO 與清單（sonnet）。** station-41.md：state ready，要在 /m 加「訂閱通知」按鈕，用 profile 的 notify.server 與 notify.topic 組 `ntfy://<host>/<topic>`，打不開退回 https topic 頁；來源寫明兩則 priority 4 已到 ntfy.sh、手機沒響、原因是手抄 topic（docs/90-agent/todo/station-41.md:4、:9）。另有 station-35.md:4、:10 是 S24 實測總 TODO（收三種通知、安裝 PWA、報告路徑）。清單在 verify.md:34-43（步驟 0、0b、1-8），第 5 項是 gate 通知 priority 4 從手機答（verify.md:40），第 6 項是兩則靜音通知（verify.md:41）；八項全部「未驗證」（verify.md:16），兩份檔都沒記第三方那個提問。

**網路（sonnet，curl）。** docs.ntfy.sh/subscribe/phone：「Instant delivery……以前景服務達成，你會看到一個常駐通知」；「ntfy Android app 只對 ntfy.sh 主機、且只在 Google Play 版用 Firebase；自架伺服器一律不用 Firebase，F-Droid 版完全不用」；`ntfy://<host>/<topic>` 直接開 app 的 topic 頁並訂閱，`https://<host>/<topic>/subscribe` 這種寫法「不可能」。docs.ntfy.sh/config：`upstream-base-url` 是「轉送 poll request 到上游伺服器，iOS 自架推播需要」，poll_request 只帶訊息 ID 與雜湊後的 topic，不帶內容——頁面只講 iOS，沒說 Android；auth-file／auth-default-access: deny-all／`ntfy user add`／`ntfy token add` 都在，Web Push 要 `ntfy webpush keys` 產 VAPID 加訂閱資料庫加 admin email。ntfy.sh 首頁：「不註冊用 ntfy 時 topic 本質上就是密碼……買 ntfy Pro 才能保留 topic 名稱」，價目表列 3／10／50 個 reserved topics。docs.ntfy.sh/subscribe/web：網頁 app 可開「background notifications」走 Web Push，安裝成 PWA 後不能關；支援的安裝瀏覽器列 Chrome Android、Safari、Firefox，沒提 Samsung Internet。MDN Push_API 的相容表是 JS 渲染、grep 不到 samsung；caniuse 回 406。tailscale.com/kb/1223/funnel 無 notif 字樣。

### 抽查結果

八個 path:line 全對得上：lib/notify.js:47-54 與 :83-97 跟讀者引的一字不差；decision:22、:28 原文如引；design:62、:65-71 原文如引；remote-card.js:127-131、lib/mobile.js:100-105 原文如引；station-41.md 全文、verify.md:40-41 原文如引。網路那位讀者的引文我沒能再驗——judge 的 PreToolUse hook 把我的 curl 當成會寫磁碟擋掉了（兩次，含拿掉 `2>&1` 的版本）。其中 ntfy 的三個句子（自架不走 Firebase、upstream 只給 iOS、topic 即密碼／Pro 才能保留）跟我既有的 ntfy 文件知識一致，我採信；Samsung Internet 的 Push API 我只能說「就我所知自 Samsung Internet 4.0 起支援，但這次沒有可引用的來源」，不拿它當決定依據。

### 怎麼推到 pick

1. **症狀與方案脫鉤。** 伺服器端已收到兩則 priority 4，手機沒響是訂閱端 topic 抄錯（station-41.md:9）。換掉 ntfy.sh 治不了這個病；station-41 的 `ntfy://` 按鈕才是。文件也證實這條連結是 ntfy app 唯一能用的訂閱連結格式。

2. **當初放棄理由仍成立，且在 Android 上更成立。** decision:28 說自架或 Web Push「要多一個服務或憑證管理」。自架 ntfy：ntfy 文件明說自架伺服器在 Android 不走 FCM，靠前景服務常駐，`upstream-base-url` 的中繼只針對 iOS——brief 選項 2 寫的「靠 FCM 中繼（ntfy.sh upstream）」對 Android 不成立，剩下的只有常駐連線那條。Web Push：要 VAPID 金鑰、訂閱儲存、sw.js 加 push handler、還要一個能安裝／能跑 SW 的頁面，而「只有 SVG icon 的 manifest 能不能安裝」本身就是 design:121-122 列的未驗證項，S24 這次也只看到「新增至主螢幕」。而且 Web Push 仍經 Google／Samsung 的 push service——只是把第三方換一家，不是去掉第三方。decision:22 的「手機不必裝 fankeel 自己的 app」也還成立。

3. **選項 1 的兩個附加子選項，一個不做、一個不做。** ntfy.sh 上的 access token 只對「reserved topic」有意義，而 reserved topic 是付費 Pro 功能；免費方案的防線就是 80 bit 亂數 topic，ntfy.sh 自己也說「topic 本質上就是密碼」。內容減量：現在已是第一題 80 字加任務名 80 字（lib/notify.js:51-52、design:71），再減只剩「<stage> gate 在等你」，使用者在手機上無從判斷要不要回去答；而且送第三方這件事是 survey 時的明示接受（decision:22）。要真正不出 tailnet，正解不是減字，是改 `notify.server` 指向自架 ntfy——這個鍵已經存在（lib/profile.js:58），零程式改動，只差一段 guide 說明與「手機會多一個常駐通知」的提醒。這就是我建議另開的那筆小文件 TODO，不動 station-41。

4. **選項 4。** Tailscale 沒有應用層推播通道（Funnel 頁面無相關內容，且 Funnel 本來就被 decision:26 排除）；它仍是 /m 的傳輸層，不是通知方案。

5. **對這次實測的具體影響。** 清單第 5、6 項照 verify.md:40-41 用 ntfy.sh 做完；在 station-41 落地前，第 4 項的訂閱請用「複製貼上」而不是手抄，並在 ntfy app 裡把訂閱到的 topic 跟 profile 的比對一次再進第 5 項。

### 一個值得記進 context.md 的附帶發現

通知的 `click` URL 含 tailnet 主機名（lib/notify.js:85，design:68 的既定設計）——它跟第一題一起送到 ntfy.sh。這對存取沒影響（tailnet 外連不到），但 verify.md:26 要求報告不得含 tailnet 主機名，寫報告時請注意不要把通知原文貼進去。

### 沒做到的事

- `context.js add` 我沒跑：judge 的 hook 拒絕任何寫磁碟的 Bash。請父層自行加這三條：「ntfy POST 只有 content-type 一個 header、無任何 auth — lib/notify.js:97」、「ntfy 自架伺服器在 Android 不走 FCM，upstream-base-url 只給 iOS — docs.ntfy.sh/subscribe/phone、/config」、「設計文件已歸檔於 docs/99-archive/2026-10-21-station-remote-design.md:65 §5；理由與放棄項在 docs/03-decisions/2026-10-21-station-remote.md:22、:28」。
- Samsung Internet 的 Push API 與 PWA 安裝支援沒有可引用的來源；若之後真要走 Web Push，這是第一個要查的。
