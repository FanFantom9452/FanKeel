---
judged: 2026-10-22T08:00:10.205Z
model: fable
agent: fankeel-judge
task: "手機頁 /m 直接接上 Claude Code session（送訊息看回覆），取代 Claude mobile，並重畫手機 UI"
session: 6e2bf71c-c287-4dc1-b109-0c84d08b47f3
stage: plan
---

# Brief: how should a phone reach the station, besides Tailscale?

## Question

# Brief: how should a phone reach the station, besides Tailscale?

## Question

The station (`scripts/station.js`) is about to become the user's replacement
for the Claude mobile app: from a phone, see every live session, answer gates,
attach a session and send it messages that the Stop hook turns into the next
instruction (spec `docs/90-agent/plans/2026-10-22-mobile-session-design.md`,
committed 36a1b5d1). Today the only remote path is Tailscale (`station.remote`,
`tailscale serve`, `lib/tailscale.js`, guide `docs/01-guide/tailscale-setup.md`).

The user asks, in their words: besides Tailscale, what other ways should be
supported? Should there be a quick setup — a station settings page or a skill
that guides installation? Their own ranking: Tailscale is hardest to set up and
most secure; next would be binding `0.0.0.0` on the LAN. What do you recommend?

## Options to weigh (not exhaustive — say if one is missing)

A. Tailscale only (status quo), plus a guided setup: station settings card
   and/or a skill that checks install, login, MagicDNS/HTTPS, `tailscale serve`,
   and walks the user through what is missing.
B. Add a LAN mode: bind `0.0.0.0` (or the LAN interface) with the existing
   device pairing (`lib/remote.js`: QR pairing code → `fk_device` cookie,
   `sameOrigin` on POST). Plain http on the LAN, or a self-signed cert.
C. Add a tunnel mode: Cloudflare Tunnel / ngrok / similar public URL in front of
   the existing pairing.
D. Other (e.g. Tailscale Funnel, WireGuard by hand, SSH port-forward from
   Termux) — only if it beats the above for this user.

## What matters

- Security: once attached, the phone channel sends arbitrary instructions to a
  Claude Code session that can run shell commands on this machine. A remote
  attacker reaching the channel is code execution. Weigh each mode's exposure
  (who can reach the port, whether traffic is encrypted, whether a pairing
  cookie over plain http on shared Wi-Fi is enough).
- Web Speech API (the mic button in the approved design) and service workers
  need a secure context (https or localhost) in Chrome/Samsung Internet — check
  what that means for plain-http LAN mode.
- The user is on Windows 11, phone is a Samsung S24 (Samsung Internet).
  Tailscale already works for them (report
  `docs/90-agent/reports/2026-10-21-station-remote-live.md`).
- Setup effort for other users of this plugin (it is distributed).
- Cut what the ask does not require; fankeel prefers reusing what exists.

## Paths to read

- `lib/remote.js` — hostKind, policy, OPEN_GET, pairing, sameOrigin
- `scripts/station.js` — handler ~459-560, remote routes ~713-760, how it binds/listens
- `lib/tailscale.js`, `docs/01-guide/tailscale-setup.md`, `docs/01-guide/station.md`
- `lib/profile.js` — `station.remote` key and its `--confirm` gate
- `docs/90-agent/reports/2026-10-21-station-remote-live.md`
- `docs/90-agent/judgements/` — any earlier station-remote judgement (grep remote, tailscale)
- the spec above

## What counts as an answer

A pick among A–D (or a combination with an order), whether a LAN mode should
exist at all and under what conditions (https? opt-in? warning?), and where the
setup guidance lives (station settings card, skill, guide page, or the
`/fankeel` prompt). State whether this belongs in the current task's plan or in
a separate TODO.

## Shape

The six fields (`pick:` first) and a `## Summary`, in 繁體中文.

## Answer

pick: A —— 只留 Tailscale，不做 LAN 模式也不做 tunnel 模式；設定引導沿用現有的 `#/settings` 手機遠端卡片＋`tailscale-setup.md`，另開一筆 TODO 做三處一行修補，不進本任務計畫。
why: 程式碼本身就否定 LAN 明文：cookie 是 `Secure`（lib/remote.js:155）、POST 的 Origin 硬寫 `https://`+dnsName（lib/remote.js:53）、hostKind 只認 loopback/tailnet（lib/remote.js:42-47），LAN IP 直接 421。LAN 要能用得做新的 hostKind、拿掉 Secure 或裝自簽憑證到手機，等於重寫配對，不是「沿用既有配對」。
瀏覽器也否定明文：/m 已註冊 sw.js（mobile.js:498）、QR 掃描用 getUserMedia（mobile.js:346,374）、規格的麥克風鈕用 Web Speech（spec:107），三者都要 secure context；自簽憑證則要在手機裝 CA，比 Tailscale 後台兩個開關更難，且決策已明寫「不必自己管 https 憑證」（03-decisions/2026-10-21-station-remote.md:22）。
安全面：手機通道一接上就是對這台機器的任意指令；LAN 讓同一個 Wi-Fi 的任何人打得到 open 的 pair POST 與 /m，明文時還能嗅到一年效期的 device token；公開 URL（C）決策已否決（station-remote.md:26），新通道只讓理由更強。
設定引導已有八成：卡片會顯示 tailscale.js 每個檢查的警告（:27,:30,:32,:57,:62），指南寫「約十分鐘，卡點是後台兩個開關與 PATH」（tailscale-setup.md:9），PATH 問題規格 §6 已修（spec:112-114）。剩下的是把警告字串接上指南錨點與 admin DNS 網址，不值得一個新 skill。
would flip if: 另一位使用者實測 Tailscale 裝不起來（公司網路擋 DERP/WireGuard）且願意在手機裝自簽 CA —— 那時才值得做 https-only、`--confirm` 的 LAN 模式。
unread: nothing
delegated: lib/remote.js (opus); scripts/station.js (sonnet); lib/tailscale.js + lib/profile.js + scripts/task.js:1244-1249 (sonnet); docs/01-guide/tailscale-setup.md + docs/01-guide/station.md (sonnet); docs/90-agent/reports/2026-10-21-station-remote-live.md (sonnet); docs/90-agent/judgements/ + docs/03-decisions/ + repo grep + todo list (sonnet); docs/90-agent/plans/2026-10-22-mobile-session-design.md + .fankeel/build/task-20261022T065333/survey.md (sonnet)
checklist: 1 lib/remote.js hostKind/policy/pairing/sameOrigin — answered; 2 scripts/station.js bind + handler + routes — answered; 3 lib/tailscale.js checks — answered; 4 lib/profile.js station.remote + --confirm — answered（gate 其實在 scripts/task.js:1247）; 5 tailscale-setup.md 步驟數與卡點 — answered; 6 station.md remote/security/settings — answered; 7 live report — answered; 8 judgements/decisions 先前立場 — answered; 9 spec + survey 對傳輸/麥克風/SW/設定頁的假設 — answered; 10 repo grep 0.0.0.0/secure context/SpeechRecognition/serviceWorker — answered

## Summary

### 問題與結論

使用者問：除了 Tailscale，手機還該用什麼方式連監控站？要不要做快速設定（設定頁卡片或 skill）？他自己的排序是 Tailscale 最難裝也最安全，其次是綁 `0.0.0.0` 走區網。

結論是 **A**：維持 Tailscale 為唯一通道，不加 LAN、不加 tunnel；設定引導不另寫 skill，沿用既有的設定頁卡片與指南，開一筆獨立 TODO 做三處小修。LAN 模式「現在不該存在」；要存在的條件寫在 would flip if。本任務的計畫（手機 session 通道）維持原規格，不擴 scope。

### 各讀者的發現（含 path:line）與抽查

**lib/remote.js（opus）** —— 決定性的檔案。
- `hostKind` 只有三種結果：`'loopback'`、`'tailnet'`、`null`（lib/remote.js:42-47）。LAN IP 或 `0.0.0.0` 綁定後的 Host 都落到 `null`，station.js:478 回 421「this station answers on 127.0.0.1 only」。
- `sameOrigin` 只比 `Origin` 標頭是否等於 `'https://' + dnsName`（lib/remote.js:53），scheme 硬寫 https。
- cookie：`fk_device=<token>; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Strict`（lib/remote.js:155）。
- 配對碼：31 字元字母表、8 碼（約 39.6 bits）、10 分鐘、5 次猜錯作廢、成功後單次失效（lib/remote.js:19-22, :110-118）；token 32 bytes，只存 sha。
- 抽查：我親讀 lib/remote.js:40-60 與 :152-156，讀者引述逐字相符。

推論：**明文 LAN 走不通既有配對** —— `Secure` cookie 在 http 上瀏覽器不會存，所以配對後下一個請求就 401；就算存了，每個 POST 的 Origin 是 `http://192.168.x.x:port`，對不上 `https://<dnsName>`，403。選項 B 寫的「沿用既有 device pairing」在程式碼上不成立；要做就得新增 hostKind 分支、放寬 cookie 或帶自簽憑證、再給 LAN host 一條 Origin 規則。

**scripts/station.js（sonnet）**
- `server.listen(opts.port || 0, '127.0.0.1', …)`（scripts/station.js:1030），另兩處 listen 也是 127.0.0.1（:1026, :1054）。沒有 `--host`、沒有 env、沒有 profile key 能改綁定。
- 遠端判斷流程在 :477-490：hostKind → 421；tailnet 時 policy local/chartroom → 403；POST 不 sameOrigin → 403；device 路由沒 cookie → 401。
- 遠端路由 :713-761：`/station/remote`、`qr.svg`、`code`、`revoke` 只限本機；`POST /station/remote/pair` 只收 tailnet（:757）。
- 檔內沒有 `0.0.0.0`、`serviceWorker`、`SpeechRecognition` 任何提及。
- 抽查：親讀 :476-490 與 :1028-1031，相符。

**lib/tailscale.js ＋ lib/profile.js ＋ scripts/task.js（sonnet）**
- tailscale.js 跑 `tailscale status --json` 判斷裝了沒／Running 沒（:26-30）、`Self.DNSName` 空就警告「turn on MagicDNS and HTTPS certificates in the tailnet's admin console」（:31-32）、`serve status --json` 判斷 Funnel 開著就拒開（:56-57）、`/` 已被佔就不覆蓋（:61-62）、否則自己跑 `serve --bg <port>`（:63）。HTTPS 憑證沒有直接檢查，只靠 DNSName 當代理指標（讀者標 INFERRED，我同意）。
- 所有檢查都以 warning 回傳給卡片，不會 throw（:5-8）——也就是設定頁卡片**已經是**一個檢查清單。
- profile.js:55 `station.remote`：只讀機器層、內建 false、desc 寫明「進階功能，CLI 設 true 要帶 --confirm」。沒有 `station.host`/`bind`/`port` key。
- `--confirm` 閘在 scripts/task.js:1247-1248，fail 字串要 session 先用 AskUserQuestion 問使用者；站內設定頁走自己的 modal 繞過這閘（:1244-1246 註解）。
- 抽查：親讀 lib/tailscale.js:54-63 與 scripts/task.js:1244-1249，相符。

**docs/01-guide/tailscale-setup.md ＋ station.md（sonnet）**
- 指南 :9：「照著做大約十分鐘；卡住的地方多半在 Tailscale 後台的兩個開關，或 Windows 的 PATH」。
- 手動步驟讀者數出 8 步（其中 2 步可選）：裝＋登入（:13）、後台開 MagicDNS 與 HTTPS Certificates（:15）、驗證 status（:20-23）、開 `station.remote`（:27 卡片 / :32 CLI）、手機配對（:57）、可選 gate.station（:63-66）、可選主畫面＋ntfy（:73, :77）。手機側只有裝 Tailscale 與掃 QR。
- :15 坦承「沒有後台的截圖，也沒有核對過頁面上的確切位置」——這是指南自知的弱點。
- 安全敘述：:13「遠端只在你的 tailnet 裡開放」、:27「遠端預設關，因為監控站看得到每個 session 的整段對話」、:35 專案層 profile 無效以防 clone 來的 repo 替你開遠端、:53 Funnel 永遠關。LAN/ngrok/Cloudflare 兩頁都沒提。
- station.md:34 `#/settings` 是「profile 精靈＋手機遠端卡片」，:44 卡片內容：tailnet 網址、配對 QR、已配對手機、推播開關；配對碼一次性 10 分鐘。
- 抽查：親讀 tailscale-setup.md:9-16，相符。

**docs/90-agent/reports/2026-10-21-station-remote-live.md（sonnet）**
- 實測：Galaxy S24、三星瀏覽器、MagicDNS ts.net、serve 標 tailnet only、無 funnel、配對成功、兩個 gate 從手機答成（:15-16, :24-29）。
- 卡點：`spawnSync tailscale ENOENT`（PATH，:24, :38）、卡片不自動更新（:25, :39）、三星只給「新增至主螢幕」（:27）、ntfy topic 手抄錯（:28, :40）。**沒有**憑證等待、cookie、sameOrigin 的問題。
- :47：使用者要的方向是手機直接接 session，「要另開任務設計」——即本任務。
- 抽查：親讀 :44-47，相符。

**judgements／decisions／repo grep／TODO（sonnet）**
- 決策 docs/03-decisions/2026-10-21-station-remote.md:14 監控站只聽 127.0.0.1 由 serve 包成 https；:22「沿用 VoiceLedger 已經在用的 Tailscale 做法，不必開任何對外的 port，也不必自己管 https 憑證」；:26「`tailscale funnel` 或其他公開網址：會讓整個網路都連得到監控站，所以完全不用」；:27 棄用 nonce 改配對 cookie。
- 判官 2026-10-22-phone-voice-input.md:30：「HTTPS 成立（Tailscale 憑證），所以麥克風權限 getUserMedia／Web Speech API 的 secure context 條件成立」——前一位判官已把麥克風鈕的前提綁在 https 上。
- repo 內 `0.0.0.0` 只出現在不相干的 regex 與第三方專案；沒有 `isSecureContext` 呼叫；mobile.js:346/:374 用 `getUserMedia` 掃 QR，:498 註冊 `/sw.js`。
- 39 筆 open TODO 裡沒有 LAN 或 Tailscale 相關；station-40/41/42 是手機版調整、訂閱通知、麥克風鈕。
- 從未有判決考慮過 LAN／0.0.0.0——這題是第一次。
- 抽查：親讀 03-decisions:20-28 與 phone-voice-input.md:29-30，相符。

**規格 2026-10-22-mobile-session-design.md ＋ survey.md（sonnet）**
- 規格沒寫傳輸設定，但處處預設 Tailscale https：`/phone/attach|detach|say` 走「同 /answer 的 device policy：配對 cookie＋sameOrigin」（:97）、§6「Tailscale on Windows」加 `%ProgramFiles%\Tailscale\tailscale.exe` 的 ENOENT 後援（:112-114）、live check「from the S24 in Samsung Internet over Tailscale」（:121）。
- 麥克風鈕用 Web Speech API，沒有 Speech API 就不畫鈕、退回鍵盤語音鍵（:107-109）；未驗證項 :126 問的是三星瀏覽器在 tailnet https 上有沒有 Speech API。
- 沒有設定頁、沒有 setup skill 的規劃；新 skill `/fankeel-phone` 只做 attach（:82）。Notifications 明寫 out of scope（:17）。
- survey.md 沒有任何題目碰傳輸。
- 抽查：親讀 spec:105-110 與 :123-127，相符。

### 推理：為什麼不是 B（LAN）

1. **程式碼層**：如上，Secure cookie ＋ https Origin ＋ hostKind 三道都擋明文 LAN，B 的「沿用既有配對」不成立，要改的是配對本身。
2. **瀏覽器層**：明文 `http://192.168.x.x` 不是 secure context。service worker（mobile.js:498）不會註冊、QR 相機（mobile.js:374）拿不到 getUserMedia、規格的麥克風鈕（spec:107）在 Chrome/三星瀏覽器會拿到 not-allowed 或根本不出現。這部分是瀏覽器平台知識，我沒有在這台機器上實測三星瀏覽器對 http LAN 的行為——但 service worker 與 getUserMedia 的 secure-context 要求是規格明文，前一位判官（phone-voice-input.md:30）也以此為前提。
3. **自簽憑證**：能補回 secure context，但要在 S24 裝使用者 CA、要在 PC 產憑證（repo 沒有 mkcert 一類工具）、憑證要管到期；這正是決策 :22 刻意避開的「自己管 https 憑證」，對分發給其他使用者尤其糟——裝 CA 比在 Tailscale 後台撥兩個開關難解釋得多。使用者「LAN 比較好裝」的直覺只在明文時成立，而明文已被 1、2 否決。
4. **安全層**：手機通道一旦 attach，`/phone/say` 就是下一條指令，等於 shell。LAN 等於「同一個 Wi-Fi 的所有人」——咖啡店、公司、訪客網路都算；`POST /station/remote/pair` 是 open 政策（lib/remote.js:57），5 次猜錯作廢擋得住暴力，但擋不住明文嗅探一年效期的 token。Tailscale 的邊界是「我的裝置」而非「我的 Wi-Fi」。
5. **效能／同網段**：Tailscale 在同一個 Wi-Fi 時本來就是點對點直連，不需要 LAN 模式來換速度。

### 為什麼不是 C（tunnel）或 D

- C：決策 :26 已否決「其他公開網址」，理由「整個網路都連得到」；加上新通道是程式碼執行，Cloudflare/ngrok 還會在中間終止 TLS 看到全部內容。沒有新事實推翻它。
- D：Funnel 同 C，且 tailscale.js:57 主動拒開。Termux SSH port-forward 技術上可行且手機看到的是 `http://localhost:<port>`（secure context 成立），但手機會被 hostKind 當成 `'loopback'`——跳過整套 device policy、直接拿桌面版權限（含 /chartroom 與 /station/remote），而且要在 Windows 裝 OpenSSH Server、配鑰匙，沒有比 Tailscale 簡單。不值得寫進指南。手寫 WireGuard 就是沒有 MagicDNS 與憑證的 Tailscale，純粹更難。

### 設定引導放哪裡、做什麼

既有的已經涵蓋大半：
- 卡片（station.md:34, :44）會顯示 tailscale.js 每個檢查的 warning 字串，使用者打開 `#/settings` 就看得到現在卡在哪一步。
- 指南（tailscale-setup.md）十分鐘流程，卡點自述清楚。
- `--confirm` 閘的 fail 字串（task.js:1248）已逼 session 先問使用者並點名 MagicDNS／HTTPS 憑證。
- 規格 §6 已把實測唯一的真卡點（Windows PATH ENOENT）修掉（spec:112-114）。

缺的只有「警告字串沒有指向解法」。建議一筆獨立 TODO，三處一行修：
1. lib/tailscale.js:32 的 MagicDNS/HTTPS 警告帶上 `https://login.tailscale.com/admin/dns` 與指南路徑；卡片原樣顯示即可。
2. scripts/task.js:1248 的 `--confirm` 字串加指南路徑，session 問使用者時就能一併貼出。
3. 規格的 `/fankeel-phone` skill（spec:82）在 `station.remote` 關著或卡片有 warning 時，印同一條 warning 與指南路徑再退出，而不是靜默失敗。

不做新 skill：它能做的（跑 status、看 serve）tailscale.js 已經做了，剩下「幫你裝 Tailscale、幫你登入、幫你在後台撥開關」都是 skill 做不到的使用者動作，寫成 skill 只是把指南換個殼。也不做新設定頁：卡片已在設定頁。

### 進本任務還是另開 TODO

另開 TODO。理由：本任務的 ask 是「手機接上 session 取代 Claude mobile」，規格 scope 明確（session 通道、Stop hook 掛住、composer、麥克風鈕），傳輸廣度不在其中；brief 自己也說「cut what the ask does not require」。規格 §6 已經收了實測發現的設定卡點，再多就是 scope creep。上面三處修補互相獨立、各一行，適合一筆 TODO 在本任務 land 之後做。

### 沒能查的

- 三星瀏覽器在明文 LAN IP 上對 Web Speech／service worker／getUserMedia 的實際行為：沒有實測，依據是 secure-context 規格與前一位判官的前提（phone-voice-input.md:30）。
- Android 使用者 CA 在三星瀏覽器是否被信任：沒查，只影響「自簽憑證 LAN」這條已因設定成本被否決的路。
- 其他使用者的網路環境（例如公司擋 WireGuard）：無資料，列在 would flip if。

### 寫進 context.md 的事實（session 6e2bf71c-c287-4dc1-b109-0c84d08b47f3，第 6-9 條）

- scripts/station.js:1030 只聽 127.0.0.1，沒有 host 旗標或 env。
- lib/remote.js:53 sameOrigin 硬寫 https，:155 cookie Secure，明文 LAN 無法沿用配對。
- docs/03-decisions/2026-10-21-station-remote.md:26 否決 Funnel 與任何公開 URL。
- assets/station/mobile.js:498 sw.js、:346/:374 getUserMedia、spec:107 Web Speech，三者都要 secure context。
