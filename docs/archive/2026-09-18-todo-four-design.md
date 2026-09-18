---
status: current
last_verified: 2026-09-18
---

# TODO 四條一起做 — 設計

使用者在 `/fankeel` 的選單上答了「DO IT ALL」：`## Ready` 的〔caveman〕解除安裝，加上
`## Needs a decision` 三條〔cuts〕。三條 cuts 都出自 09-18 那次 audit，細節只在
`TODO.md` 那三行裡。

survey 派了三個 reader，引用的 `path:line` 都抽查過。改寫了三條的前提，這份設計照改過的寫：

- `HOME || USERPROFILE` 不是兩處而是三處。`lib/profile.js:41` 的 `configDirOf(env)` 吃可注入的 `env`，`os.homedir()` 讀不到它，所以不換。
- `lib/ledger.js` 四段迴圈裡，`planRange` 遇到第一筆就回傳，另外三段收集全部；helper 要保留這個差別。
- `scripts/task.js` 七處 `registry.update` 只有 `cmdGuard`、`cmdLand` 兩處是同一個外殼。兩個呼叫點撐不起一個 helper，見 §4 的 Struck。

## 1. caveman 解除安裝

- `claude plugin uninstall caveman@caveman-per-session` 與 `claude plugin marketplace remove caveman-per-session` 在主 session 跑，不派工：動的是使用者的設定，不是 repo。
- 跑完查 `installed_plugins.json`、`known_marketplaces.json`、`settings.json` 的 `enabledPlugins` 與 `extraKnownMarketplaces`、`plugins/cache/caveman-per-session/`；殘留逐項列出，`settings.json` 的殘留鍵用 Edit 刪，cache 目錄有殘留就先問。
- `tests/badge.test.js:134` 與 `:148` 兩個反向測試不動：它們把 `caveman` 當任意字串用，不依賴真的裝著。

## 2. 沒人用的

- 刪 `lib/docs.js` 的 `bucketFor`（`:194-203`，連同上方三行註解）。它不在 `module.exports`，全 repo 零呼叫。
- `scripts/stage-registry.js` 拿掉 `parseArgs` 與 `--root`、`--print`，`main()` 固定寫 `DEFAULT_ROOT` 下的 `skills/registry.json`；`:10-13` 那段說 `--root` 是給測試 fixture 用的註解，改成不再提它。

## 3. 換內建

- `lib/registry.js:85` 與 `scripts/sessions.js:24` 改用 `os.homedir()`；`lib/profile.js:41` 不換。
- `scripts/skills-check.js` 的 `walkSkillMd` 改成 `fs.readdirSync(dir, { recursive: true })` 加檔名過濾；讀不到目錄仍回空陣列。
- `assets/station/station.js` 刪 `pad2`，四個呼叫點改 `String(n).padStart(2, '0')`。

## 4. 可以更短

- `lib/ledger.js`：`completed`、`completions`、`fixes`、`planRange` 共用一個逐行比對的 helper；`planRange` 仍回第一筆，沒有就 `null`。
- `scripts/station.js`：四個 POST 開頭逐字相同的 nonce 檢查，抽成與 `fail` 同 scope 的 helper；各 route 之後的內容不動。
- 位移的 `path:line` 引用照 `node scripts/docs-check.js` 印出的修正；`docs/reports/`、`docs/decisions/`、`docs/judgements/`、`docs/archive/` 的不動。

Struck: `scripts/task.js` 的 `cmdGuard`（`:821-829`）與 `cmdLand`（`:1093-1103`）外殼。抽成 `updateActive` 省 14 行、helper 本身約 15 行，淨增一行；另外四處 `registry.update`（`:632`、`:696`、`:854`、`:1062`）的外殼都不同，接不上。

## 5. TODO

- 四條各自在對應工作落地後從 `TODO.md` 移除；`node scripts/todo-check.js` exit 0。

## Files

| file | change |
|---|---|
| `TODO.md` | 移除四條 |
| `lib/docs.js` | 刪 `bucketFor` |
| `scripts/stage-registry.js` | 拿掉兩個 flag 與 `parseArgs`，改註解 |
| `lib/registry.js` | `os.homedir()` |
| `scripts/sessions.js` | `os.homedir()` |
| `scripts/skills-check.js` | `walkSkillMd` 用 `recursive` |
| `lib/ledger.js` | 逐行比對 helper |
| `scripts/station.js` | nonce helper |
| `assets/station/station.js` | 刪 `pad2` |
| `docs/station.md` | 位移的行號 |
| `docs/registry.md` | 位移的行號 |

## What proves it done

| test | 條目 | 現在 | 之後 |
|---|---|---|---|
| `claude plugin list` 列出 `caveman@caveman-per-session` | §1 | 列出 | 不列 |
| `git grep -n bucketFor -- lib` | §2 | 1 行 | 無輸出 |
| `git grep -n parseArgs scripts/stage-registry.js` | §2 | 3 行 | 無輸出 |
| `git grep -n "HOME || process.env.USERPROFILE" -- lib scripts` | §3 | 2 行 | 無輸出 |
| `node scripts/skills-check.js` 的輸出 | §3 | 存成基準 | 與基準逐字相同 |
| `git grep -n pad2 -- assets` | §3 | 3 行 | 無輸出 |
| `git grep -c "form.get('nonce') !== nonce" scripts/station.js` | §4 | 4 | 無輸出 |
| `npm test` | §4 | 綠 | 綠 |
| `git diff --shortstat` 對 plan 的 BASE：刪除行多於新增行，`TODO.md` 與 plan 檔不計 | 全部 | — | 是 |
| `node scripts/docs-check.js` | 全部 | exit 0 | exit 0 |
| `node scripts/todo-check.js` | §5 | exit 0 | exit 0 |
