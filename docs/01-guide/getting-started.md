---
status: current
last_verified: 2026-09-27
source_of_truth: README.md, docs/02-architecture/pipeline.md, docs/90-agent/reference/station.md, skills/fankeel/SKILL.md, scripts/orient.js, scripts/task.js
---

# 開始使用

裝好插件、在一個專案裡打 `/fankeel`、選一個 task、走完它的 route，最後在監控站看它跑過的樣子。

## 安裝

```
claude plugin marketplace add FanFantom9452/FanKeel
claude plugin install fankeel@fankeel
```

裝完重開 Claude Code。沒有別的相依套件要裝。更新是 `claude plugin marketplace update fankeel`，一樣要重開。

## 第一次 `/fankeel`

在任何專案目錄打：

```
/fankeel
```

它先看再問：這個目錄底下有哪些專案、哪些是 git repo、哪個今天動過。然後最多問兩題，選項已經列在畫面上：哪個專案（只有一個就跳過），以及要做什麼 task。根目錄有 `TODO.md` 時，task 的選項從那裡來：`## Ready` 不單獨列成選項，由最後一個選項「TODO 全表盤點」盤點後一起做完；`## Needs a decision` 取最新的幾條。它不會問你要動哪些檔案，檔案是動了才記下來的。

## 選 task，就選了 route

開 task 時會決定它的類別，類別決定要走哪幾站：

| 類別 | route |
|---|---|
| `spike` | survey → build |
| `bounded` | survey → design → build → verify → land |
| `architectural` | 七站全走 |

拿不準就選重的那個。每一站產出什麼、類別是什麼意思，在 [concepts.md](concepts.md)。

## 走完一條 route

每一站做完都停在一個 gate，用選項問你下一步。選第一個就是核准，往下一站走；選第二個是留在這站；也可以暫停，下一步會寫下來，task 比這個 session 活得久。走到最後一站再選第一個，task 就收掉。

這段期間 statusline 的 badge 顯示你在哪一站，例如 `[FANKEEL:BUILD]`；badge 要裝了 TokenBar 才畫得出來。

## 看監控站

`/fankeel` 每次都會寫出監控站，在注入區塊的 `station:` 那一行給網址。分頁關掉之後要重開，打 `/fankeel-station`，或自己跑：

```
node <plugin>/scripts/station.js serve --open
```

不想打指令的話，每個專案的 `.fankeel/` 底下都有外掛產生的啟動檔：Windows 雙擊 `.fankeel/station.bat`，其他系統執行 `.fankeel/station.sh`。station 已經在跑時，它只會打開瀏覽器，不會再開一個 port。

每個 view 看什麼、數字怎麼讀，在 [station.md](station.md)。
