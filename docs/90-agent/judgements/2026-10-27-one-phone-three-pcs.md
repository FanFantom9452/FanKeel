---
judged: 2026-10-27T19:24:02.244Z
model: fable
agent: fankeel-judge
task: "一支手機配對 3 台電腦的監控站（同一 Tailscale）"
session: a98eaa86-47f3-48e6-bb91-2249e1696dc8
stage: survey
---

# Brief — one phone, three PCs, one tailnet

## Question

# Brief — one phone, three PCs, one tailnet

## Question

With fankeel's current remote method (station.remote: the station is exposed
through this machine's Tailscale via `tailscale serve`, plus the phone-session
flow), can a single phone connect to and pair with **three different PCs**,
all on the same Tailscale tailnet? If yes, what does the user do; if partly,
what breaks or collides; if no, what is the smallest change that would make it
work?

## Options

A. Works today as-is — each PC runs its own station, phone opens each PC's
   tailnet URL (or switches between them) with no conflict.
B. Works with caveats — e.g. per-machine setup steps, pairing tokens, port or
   hostname collisions, phone.hold / Stop-hook handing a session back to the
   wrong PC, notification channel ambiguity — named concretely.
C. Does not work today — one-phone-one-machine is baked into the pairing or
   the serve config; name the line that bakes it in and the smallest change.

## Background

- Profile keys: `station.remote` (machine-level, `tailscale serve`, default off,
  needs `--confirm`), `phone.hold` (Stop hook waits for the phone's next line,
  then hands the session back to the PC), `ui.lang` machine-level.
- Each PC would be a separate machine with its own machine-level profile and
  its own registry; same tailnet, same Tailscale account, one phone.

## Paths to read

- scripts/phone.js, scripts/station.js (the serve / pairing / remote parts),
  scripts/task.js (station.remote handling)
- docs/01-guide/tailscale-setup.md, docs/01-guide/station.md, docs/01-guide/profile.md
- docs/03-decisions/2026-10-21-station-remote.md,
  docs/03-decisions/2026-10-22-phone-session.md,
  docs/03-decisions/2026-10-22-tailscale-remote-gate.md
- docs/90-agent/judgements/2026-10-22-phone-reach.md,
  docs/90-agent/judgements/2026-10-22-notify-channel.md

## What counts as an answer

A pick of A, B or C, backed by path:line for every claim about pairing,
serve hostname/port, tokens or cookies, and the phone-session hand-back.
Where it is B, list each caveat with the one-line fix or user step.

## Answer shape

The six fields (pick:, ...) then `## Summary`, written in 繁體中文.

## Answer

pick: B — 現在就能用，但要在三台電腦各自開 station.remote、各自配對一次，手機端是三個獨立網址，沒有切換器；沒有任何東西會互撞。
why: 每台電腦的手機網址是自己的 MagicDNS 名 `https://<dnsName>/`（lib/tailscale.js:91），監控站只聽 127.0.0.1（scripts/station.js:1289），serve 掛在各自主機的 443 `/`（lib/tailscale.js:80、:102）。
配對 cookie `fk_device` 沒有 `Domain`，是 host-only（lib/remote.js:25、:155），token 存在各機的 `<configDir>/fankeel/remote.json`（lib/remote.js:63），所以手機要在三台各配一次（scripts/station.js:931-936、:541-543）。
phone.hold 的交還只走該台電腦自己 registry 底下的 `<registry>/.fankeel/station/phone/<sid>/`（lib/phone.js:3-6、:29-31；scripts/phone.js:27-28、:36-38），不可能交到別台。
`station.remote` 只讀機器層、要 `--confirm`（docs/01-guide/profile.md:49；scripts/task.js:1235-1236），三台各做一次。
推播已於 2026-10-26 拔掉（docs/03-decisions/2026-10-21-station-remote.md:10；docs/01-guide/station.md:71；lib/notify.js 已不存在），通知頻道歧義今天不存在。
would flip if: 三台共用同一個 `CLAUDE_CONFIG_DIR`/`~/.claude`（lib/profile.js:158-162）或同一份同步過的專案 checkout —— serve.json、remote.json、phone inbox 會互相覆寫，變成 C。
若使用者不把「三次配對、三個捷徑」當成 caveat，則為 A。
unread: nothing
delegated: scripts/phone.js（opus，另 grep lib/phone.js）；scripts/station.js（opus，另讀 lib/tailscale.js、lib/remote.js、lib/serve.js）；scripts/task.js（sonnet，另讀 lib/profile.js）；docs/01-guide/tailscale-setup.md + docs/01-guide/station.md（sonnet）；docs/01-guide/profile.md（sonnet）；docs/03-decisions/2026-10-21-station-remote.md + 2026-10-22-tailscale-remote-gate.md（sonnet）；docs/03-decisions/2026-10-22-phone-session.md（sonnet）；docs/90-agent/judgements/2026-10-22-phone-reach.md + 2026-10-22-notify-channel.md（sonnet）
checklist: 1 scripts/phone.js 手機與機器的綁定 — answered；2 scripts/station.js serve/配對/port — answered；3 scripts/task.js station.remote — answered；4 tailscale-setup.md + station.md 使用步驟與網址 — answered；5 profile.md 三個鍵的層級 — answered；6 兩份 station-remote 決策 — answered；7 phone-session 決策 — answered；8 phone-reach + notify-channel 判決 — answered（notify 部分已過時，見下）

## Summary

### 問題
一支手機、三台電腦、同一個 tailnet：fankeel 現行的 `station.remote`（`tailscale serve`）加手機 session 流程，能不能讓手機分別連上並配對三台？

### 各 reader 的發現與抽查

**1. scripts/phone.js（opus）** — 這個檔只是 50 行的 CLI。綁定輸入只有 `--session <id>`（scripts/phone.js:25-26）；root 來自 `--root` 或 `registry.findStateRoot(process.cwd())`（:27），session 必須存在於這台電腦的 registry（:28）；`station.remote` 必須在 `live.liveConfigDir()` 讀出的機器 profile 裡是 true 才准 attach（:36-38）；attach 的裝置字串是固定的 `'desktop'`（:40）。沒有 hostname、沒有 token、沒有 tailscale 呼叫。狀態全在 lib/phone.js：五個檔案放在 `<registry>/.fankeel/station/phone/<session_id>/`（lib/phone.js:3-6，`dirOf` 在 :29-31 組路徑）。抽查 scripts/phone.js:24-42 與 lib/phone.js:1-32，與 reader 所述一致。

**2. scripts/station.js（opus）** — 監控站只綁 `127.0.0.1`（scripts/station.js:1289），預設 port 28888、可用 `--port` 改（:114，未抽查），沒指定 port 又 EADDRINUSE 時退到臨時 port（:1283-1285，已抽查）。遠端開啟時呼叫 `tailscale.enable(boundPort)`（:1255）；lib/tailscale.js 先查 `serve status --json`（:69），Funnel 開著就拒絕（:73-74），443 `/` 已被別的 proxy 佔著就拒絕取代（:78-79），否則跑 `tailscale serve --bg <port>`（:80），網址為 `https://<dnsName>/`（:91）；撤除用 `serve --https=443 --set-path=/ off`（:102）。全部抽查屬實。驗證：cookie 名固定 `fk_device`（lib/remote.js:25），屬性 `Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Strict`、沒有 `Domain`（:155，已抽查）→ 瀏覽器視為 host-only cookie，三個 MagicDNS 主機各自一份。token 的 sha 存在 `<configDir>/fankeel/remote.json`（lib/remote.js:63，已抽查）。每個 tailnet 請求用 `remote.deviceFor(configDir, …)` 查這台的 remote.json（scripts/station.js:541-543，已抽查），POST 還要 `sameOrigin` 對這台的 dnsName（:540）。配對只能從 tailnet 端 POST `/station/remote/pair`，成功後 set-cookie（:931-936，已抽查）。`/station/mobile.json` 用 dnsName 第一段標示機器名、遠端關著時用 `os.hostname()`（:974，已抽查）——手機頁上看得出是哪一台。單例狀態：`<configDir>/fankeel/serve.json` 當 pid/port 鎖（lib/serve.js:23、scripts/station.js:345-356，reader 引用、未抽查）。

**3. scripts/task.js（sonnet）** — task.js 本身只做 gate：`profile set station.remote true` 沒帶 `--confirm` 就 `fail(...)` 要求先用 AskUserQuestion 問使用者（scripts/task.js:1235-1236，已抽查）；設 false 不用確認。機器 profile 在 `<configDir>/fankeel/profile.json`（lib/profile.js:152-153），configDir 取 `CLAUDE_CONFIG_DIR`，否則 `$HOME`/`$USERPROFILE` + `.claude`（lib/profile.js:158-162，已抽查）—— 預設每台各自一份。registry 在專案樹裡（scripts/task.js:249-250）。兩位 reader 對預設 port 說法略有出入（28888 vs OS 配發）；:1289 是 `opts.port || 0`，取決於 opts 預設，但三台各在自己的 loopback 上，這點不影響結論。

**4. tailscale-setup.md + station.md（sonnet）** — 卡片給 `https://<機器名>.<tailnet 名>.ts.net/`、QR、8 字元一次性配對碼（10 分鐘有效）、已配對手機清單（tailscale-setup.md:49、:61，已抽查）。MagicDNS 與 HTTPS 憑證是 admin console 的 tailnet 層開關（:15、:23，reader 引用）。station.md:59 寫「經這台機器的 Tailscale」、「只讀機器層 profile」；:61 手機從 tailnet 開 `/` 自動轉 `/m`；:63 撤除只拆監控站自己掛的那條（已抽查）。文件沒有一句談多台電腦，也沒有一句排除。已知問題：配對後桌面卡片不會自動刷新（tailscale-setup.md:63）。

**5. profile.md（sonnet）** — `station.remote`：機器層、內建 false、CLI 設 true 要 `--confirm`（profile.md:49，已抽查）。`phone.hold`：1–1800 秒、內建 1800，列上沒寫「只讀機器層」，依 :19 的通則可在專案層覆寫（:47，已抽查）。`ui.lang` 只讀機器層（:56）。沒有 `station.port` 這類 profile 鍵。

**6. 兩份 station-remote 決策（sonnet）** — 監控站只聽 127.0.0.1、`tailscale serve --bg` 包成 tailnet 內 https（2026-10-21-station-remote.md:16，已抽查）；一次性 8 碼換裝置 cookie、每台裝置可個別解除（:18，已抽查）；funnel/公開網址被否決（:28）；per-launch nonce 不當遠端憑證（:29）。重要：:10 註記「2026-10-26：ntfy 推播已拔掉」（已抽查）。2026-10-22-tailscale-remote-gate.md:14-17（已抽查）：serve.json 帶 `remote.url`/`remote.warning`，`station:` 行接 `phone: https://<dns>/m`，卡片開關先開 modal，CLI 要 `--confirm`。

**7. phone-session 決策（sonnet）** — `lib/phone.js` 管每個 session 的手機頻道檔（2026-10-22-phone-session.md:14，已抽查）；Stop hook 等 `phone.hold` 秒，收到就以 `（手機）<訊息>` block 成下一輪（:15，已抽查）；電腦打字就拿回 session（:16）。沒有任何多機敘述。

**8. phone-reach + notify-channel 判決（sonnet）** — phone-reach `pick: A`：Tailscale 是唯一通路，cookie `Secure`、Origin 鎖 `https://`+dnsName、hostKind 只收 loopback 或 tailnet（phone-reach.md:83-87）。notify-channel 當時 `pick: 1` 留 ntfy.sh、topic 每台機器 profile 各自隨機（notify-channel.md:68，已抽查，內容引用 lib/notify.js）。**抽查結果：lib/notify.js 已不存在（Read 回 File does not exist），lib/、scripts/、hooks/ 全 grep `ntfy|notify.topic|notify.server` 無命中，docs/01-guide/station.md:71 明寫「監控站目前不推播通知：2026-10-26 拔掉了第三方推播服務」。** 所以 reader 8 說「notify 部分有歧義」是歷史狀態，今天不成立；brief 列的「notification channel ambiguity」這一項今天沒有東西可歧義。

### 推論到 pick

逐項對 brief 要求的四類主張：
- **配對**：每台各有自己的配對碼、remote.json 與 host-only cookie（lib/remote.js:25、:63、:155；scripts/station.js:931-936）。手機在三台各配對一次，三份 cookie 互不相干，互不覆寫。
- **serve 主機名/port**：三台各自的 MagicDNS 名（lib/tailscale.js:91），各掛自己主機的 443 `/`（lib/tailscale.js:80）；監控站只在 loopback（scripts/station.js:1289）。沒有跨機衝突。:78-79 的「不取代既有 proxy」是單機內的檢查。
- **token/cookie**：見上，無 `Domain`，無跨主機共享。
- **phone-session 交還**：inbox/holding 都在該台電腦的專案 registry 底下（lib/phone.js:3-6、:29-31），Stop hook 只讀自己那份；手機頁 `/m` 在主機 X 上只跟 X 的監控站講話。不可能「交還到錯的電腦」。

所以技術上沒有東西互撞——這是 A 的敘述。但使用者確實要做 brief 在 B 裡點名的「per-machine setup steps、pairing tokens」：三台各開 `station.remote --confirm`、各配對一次、手機上存三個網址（PWA 捷徑依 origin 各一個），而且 `/m` 沒有跨機切換器。因此選 **B**，並明列 caveat。

### Caveat 清單（每條附一行解法或使用者步驟）
1. **三台各自開遠端** — 每台跑一次 `task.js profile set station.remote true --confirm`，或在該台 `#/settings` 卡片按「我了解，開啟」（scripts/task.js:1235-1236；2026-10-22-tailscale-remote-gate.md:16-17）。MagicDNS 與 HTTPS 憑證是 tailnet 層，只要在 admin console 開一次（tailscale-setup.md:15）。
2. **三台各配對一次** — 手機分別掃三張 QR 或各輸一次 8 碼（tailscale-setup.md:61）；cookie 是 host-only（lib/remote.js:155），這是瀏覽器行為，不是 bug；配對後桌面卡片要手動刷新（tailscale-setup.md:63）。
3. **手機端沒有切換器** — 三個 `https://<機器名>.<tailnet>.ts.net/m` 各自存成捷徑；`/m` 頂端顯示機器名第一段（scripts/station.js:974），足以分辨。若要一頁看三台，是新功能，不在現行範圍。
4. **不要共用設定目錄或同步專案目錄** — `CLAUDE_CONFIG_DIR`/`~/.claude`（lib/profile.js:158-162）若三台同步，`fankeel/serve.json`（pid/port 鎖）、`remote.json`（配對 token）、`profile.json` 會互相覆寫；專案 checkout 若經 OneDrive 等同步，`<registry>/.fankeel/station/phone/<sid>/` 的 inbox 會被三台的 Stop hook 同時讀。使用者步驟：三台各自本機目錄、各自 clone。
5. **通知** — 今天沒有推播（station.md:71），`/m` 要手動開才看得到 gate。若之後把通知做回來，訊息必須帶機器名，否則三台的通知在手機上分不出來（2026-10-22 當時的 ntfy 設計只靠 click URL 帶主機名，notify-channel.md:68）。
6. **phone.hold** — 可在專案層覆寫（profile.md:19、:47），同一 repo 在三台上會一致，沒有衝突。

### 沒能檢查的
- `scripts/station.js:114` 的預設 port、`lib/serve.js:23`、`scripts/station.js:345-356` 的 pid/port 鎖，以及 tailscale-setup.md:15、:23，是 reader 引用、我沒抽查到的行；結論不靠它們。
- `phone.snapshot` 是否區分裝置（scripts/station.js:975）——同一台電腦多支手機的情況，與本題（一支手機三台電腦）無關。
- Tailscale 對同名主機自動加 `-1` 後綴以保證 MagicDNS 名唯一，是 Tailscale 的行為，repo 裡沒有行可引。
- 沒有實機跑三台驗證；以上全是靜態讀碼。
- context.md：`scripts/context.js add` 需要 `--session <id>`，brief 與 dispatch 都沒給 session id，故沒有寫入。值得記的事實：(a) `fk_device` cookie 無 `Domain`，host-only（lib/remote.js:155）；(b) 手機頻道檔在 `<registry>/.fankeel/station/phone/<sid>/`（lib/phone.js:3-6）；(c) ntfy 推播已於 2026-10-26 拔掉（docs/01-guide/station.md:71）。
