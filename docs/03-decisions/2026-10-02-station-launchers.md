---
status: decision
last_verified: 2026-10-02
---

# station 啟動檔移入 .fankeel/（10-02）：決策紀錄

一句話：每個專案的 `.fankeel/` 由外掛產生 `station.bat` 與 `station.sh`，不再是本 repo 根目錄手寫的兩個檔。

計畫見 [../99-archive/2026-10-02-station-launchers.md](../99-archive/2026-10-02-station-launchers.md)。

## 為什麼

任何人裝了外掛，都要能從自己專案的 `.fankeel/` 開 station，而不是去找本 repo 根目錄的檔。重複開 port 也不能發生：`scripts/station.js` 的 `serve --detach` 會先 probe `serve.json`，已經有人在跑就不再開。

## 定了什麼

- `lib/launchers.js` 產生兩個檔，內容與磁碟上不同才重寫（190bbcd2）。
- `registry.ensureLayout` 每個 process、每個 root 只呼叫一次，包在 try/catch 裡，兩個檔名加進 `.fankeel/.gitignore`（cb854cc8、24212112）。
- 修正：launchers 不匯出 `contents`，write 改成逐檔嘗試（e5edcce8、f681dd02）。
- README、`fankeel-station` SKILL、getting-started 補上啟動檔的位置（eed5f68f）。
- `lib/registry.js` 的行號引文重指（4118c4b2）。

## 沒做的

- 只在 `/fankeel` 時才產生啟動檔的另一方案沒有採用。
- port 去重沒有新寫，沿用 `serve --detach` 的 probe。
- 寫文件的 agent 另開 task。
