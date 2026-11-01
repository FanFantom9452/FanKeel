---
status: design-intent
last_verified: 2026-11-02
source_of_truth: scripts/record.js, lib/bundle.js, lib/sensitive.js, skills/fankeel-retro-all/SKILL.md
---

# retro-all 匯出 ZIP 回傳

一句話：跑 `/fankeel-retro-all` 的人（教授）不 push，改在 gate 選「匯出 ZIP 回傳」，`record.js export` 把報告、這批 session 包與一份環境 manifest 打成一個 ZIP；收到的人用 `record.js import` 把包放回 `.fankeel/bundles/`，自己的 retro-all 就讀得到。

依據：survey 報告 `.fankeel/build/task-20261101T195021/survey.md`；使用者 11-02 在對話中決定：不讓其他人 push、ZIP 要含 session 原始檔、manifest 要帶系統與 fankeel、Node 版本與套件，以及隱私選項在匯出時由 gate 問匯出者。

## 1. ZIP 的內容

- 一個 ZIP 有三種項目：`manifest.json`、`report.md`、`bundles/<YYYY-MM-DD>-<id8>.jsonl.gz`，檔名沿用 `record.js session` 的格式（scripts/record.js:201），因為 `listBundles` 用 `n.slice(11,19)` 取 id8（scripts/record.js:241）。
- `report.md` 是月檔裡這次 `跨 session 回顧` 那一節，加上每個納入的包在月檔裡的 `retro <id8>` 那一節，原文照抄。
- 檔名是 `retro-<YYYY-MM-DD>-<報告 sha256 前 8 碼>.zip`，不含使用者名或主機名，放在 `.fankeel/exports/`，由 `registry.ensureIgnored` 加進 `.fankeel/.gitignore`，不進 git。

## 2. 環境 manifest

- 欄位走白名單：`export: 1`、`created`、`fankeel.working`（registry 根的 `package.json` 版本，若它是 fankeel）、`fankeel.installed`（執行中的 plugin 的 `package.json` 版本）、`node`（`process.version`）、`engines`、`platform`、`arch`、`osRelease`（`os.release()`）、`claudeCode`（從包內每行的 `version` 欄位收集的不重複值）、`gitHead`（短碼）、`packages`（`package.json` 的 dependencies 與 devDependencies，目前是空的）、`homeMasked`、`bundles`（每個包的檔名、bytes、sha256）。
- 不放 hostname、使用者名、家目錄、專案絕對路徑、環境變數；整份 manifest 寫出前再過一次 `redact`（lib/sensitive.js:64）。
- `globalPackages` 只在匯出者勾選時才有：`npm ls -g --depth=0 --json` 的套件名與版本；指令失敗時寫 `globalPackages: "unavailable: <原因>"`，不中止匯出。

## 3. 家目錄遮蔽

- 預設把每個包裡所有字串值中的家目錄換成 `[HOME]`：`os.homedir()`、它的正斜線寫法、Git Bash 的 `/c/Users/<name>` 寫法；Windows 上不分大小寫。
- 遮蔽是解開包、逐行改字串、再 gzip 回去，產生新的包放進 ZIP；`.fankeel/bundles/` 裡原本的包不動。
- 匯出者勾選「保留原路徑」時不換，manifest 的 `homeMasked` 記 `false`。

## 4. 匯出：`record.js export`

- `record.js export --cross <錨點> --bundles <id8,...> [--global-packages] [--keep-home]`：`--cross` 是 `retro --cross` 印出的 `#x-<日期>` 錨點，`--bundles` 是 retro-all 第 1 步選中的包。
- 錨點在月檔找不到、或任何一個 id8 找不到包，就拒絕並列出缺的，什麼都不寫。
- 成功時印 `export: <路徑>`、大小、包數、`homeMasked`，以及一行「把這個檔案用私下管道傳回去，不要上傳到 Gitea」。

## 5. 匯入：`record.js import <zip>`

- 讀中央目錄，每個項目用 `zlib.crc32` 檢查；manifest 裡每個包的 sha256 也要對得上。任何一項不符就拒絕，什麼都不寫。
- 包寫進 `.fankeel/bundles/`；同名已存在就略過並列在 `skipped:`，不覆蓋。
- `manifest.json` 與 `report.md` 寫進 `.fankeel/imports/<zip 檔名去副檔名>/`（gitignored），並印出 manifest 摘要：fankeel、node、platform、osRelease、claudeCode、包數。
- 之後 `record.js sessions --list` 就列得到這些包，接收者的 retro-all 照常讀。

## 6. ZIP 容器：`lib/zip.js`

- 專案沒有相依套件（package.json），所以自己寫：`write(entries) -> Buffer` 只用 STORED（包已經 gzip 過），`read(buf) -> [{name, data}]` 支援 STORED 與 DEFLATE（`zlib.inflateRawSync`），讓使用者用作業系統重新壓過的 ZIP 也讀得進來。
- CRC 用 Node 內建 `zlib.crc32`（engines `>=22.5` 已涵蓋）；不支援 ZIP64、加密、分卷，碰到就拒絕並說明。
- 項目名稱拒絕絕對路徑與 `..`，避免解壓到目錄外。

## 7. retro-all 技能

- 第 4 步的 gate 多一個選項「匯出 ZIP 回傳」；選它後再問一題 multiSelect：「記錄全域 Node 套件」「保留原路徑（不換 [HOME]）」，兩者預設都不勾，再跑 `record.js export`。
- 新增一節「收到 ZIP」：`record.js import <zip>`，接著回到第 1 步。
- description 拿掉「after pulling bundles another user committed」，改成收到 ZIP 之後。

## 8. 證明完成

- `tests/zip.test.js`：寫出再讀回內容相同；改壞一個 byte 會被 CRC 擋下；`../x` 名稱被拒絕；作業系統用 DEFLATE 重壓的檔案讀得進來（測試用 `zlib.deflateRawSync` 自己造一個）。
- `tests/record-export.test.js`：在 seed 專案放兩個包和一份 cross 報告，匯出後匯入另一個空專案，`sessions --list` 列出兩個包；每個包裡找不到家目錄字串，除非加了 `--keep-home`；manifest 裡的 sha256 與解出的檔案相符；錨點不存在時拒絕、什麼都沒寫。
