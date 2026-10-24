# FanKeel

> **English.** fankeel is a Claude Code plugin for long-running projects. Each session holds one task and walks it through a route of up to seven stages — survey, design, plan, build, verify, audit, land — stopping at a gate after every stage to ask you before it moves on. It remembers what was tried, and warns when two live sessions edit the same file. Install with the two commands below, restart Claude Code, then type `/fankeel` in any project. The user guides are in Traditional Chinese under [docs/01-guide](docs/01-guide/); the design reference, [docs/02-architecture](docs/02-architecture/), is in English.

fankeel 是 Claude Code 插件。每個 session 扛一件 task，照 route 一站一站走，每站做完停下來問你；它記得試過什麼，並在兩個 session 動到同一個檔時提醒你。

它要擋的是長期專案裡看不見的腐爛：已經有的東西又被重做一次、工作做完了計畫文件還堆著、約定守了一個月就悄悄失效、兩個終端機改同一個檔卻互不知道。

## 安裝

```
claude plugin marketplace add FanFantom9452/FanKeel
claude plugin install fankeel@fankeel
```

裝完重開 Claude Code。不用裝別的套件，Node 22.5 以上即可。repo 叫 `FanKeel`，但你打的一律是小寫 `fankeel`——插件 id 必須是 kebab-case。

想一次裝好整台機器，用 [claude-kit](https://github.com/FanFantom9452/claude-kit)：它會順便設定 [TokenBar](https://github.com/FanFantom9452/ClaudeCodeCLI-TokenBar)，statusline 上的 badge 靠它畫。

**更新**——先更新 marketplace，再更新插件，然後重開：

```
claude plugin marketplace update fankeel
claude plugin update fankeel@fankeel
```

**移除**——先跑 `uninstall.js`：它刪掉 fankeel 寫在專案外的東西（`~/.claude/fankeel/` 底下的監控站頁、`station/`、`serve.json` 等，以及 statusline 的 badge 檔），留下機器層的 `profile.json`，並列出留著的各專案 `.fankeel/`；加 `--dry-run` 只列不刪。`<plugin>` 是插件安裝的目錄，在 `~/.claude/plugins/cache/fankeel/fankeel/<版本>/`。專案裡的 `.fankeel/` 屬於專案，會留著，不要就自己刪：

```
node <plugin>/scripts/uninstall.js
claude plugin uninstall fankeel@fankeel
claude plugin marketplace remove fankeel
```

## 五分鐘上手

1. 在專案目錄打 `/fankeel`。它先看目錄、git 狀態與 TODO，再最多問兩題：哪個專案、做什麼 task。它不會問你要動哪些檔——動了才記。
2. 它替 task 選一個類別，類別決定 route，並說出來讓你可以不同意：

   | 類別 | route |
   |---|---|
   | `spike` | survey → build |
   | `bounded` | survey → design → build → verify → land |
   | `architectural` | survey → design → plan → build → verify → audit → land |

3. 每站做完停在 gate：選項一核准並往下一站，選項二留在這站，選項三暫停——下一步寫進 registry，下次 `/fankeel` 接著做。
4. statusline 的 badge 顯示目前在哪站，例如 `[FANKEEL:BUILD]`；別的 session 動到你的檔時變成 `[FANKEEL:CLASH]`。
5. 監控站把這台機器的所有 session 畫成一頁。網址在 `/fankeel` 注入的 `station:` 那行；分頁關了，Windows 雙擊 `.fankeel/station.bat`，其他系統執行 `.fankeel/station.sh`。

```mermaid
flowchart LR
    S["survey<br/>已經有什麼"] --> D["design<br/>一個做法"] --> P["plan<br/>拆成 task"] --> B["build<br/>寫、測、提交"] --> V["verify<br/>證據"] --> A["audit<br/>哪些文件不再是真的"] --> L["land<br/>收尾、merge 或 PR"]
```

## 指令

| 指令 | 做什麼 |
|---|---|
| `/fankeel` | 開始、接續、接手或收掉 task |
| `/fankeel-station` | 重開監控站 |
| `/fankeel-phone` | 把這個 session 交給手機 |
| `/fankeel-audit` | 文件與程式碼的整套稽核 |
| `/fankeel-ask` | 把卡住的一題交給更強的模型判 |
| `/fankeel-init` | 第一次在一個專案使用時的導入 |
| `/fankeel-explain` | 簡報、報告、進度同步 |
| `/fankeel-upgrade` | 舊專案升級到新版的設定 |
| `/fankeel-retro-all` | 回顧所有匯出的 session |
| `/fankeel-panel` | 開關側邊的 Pane |

## 深入閱讀

| 想知道 | 頁面 |
|---|---|
| 從安裝到走完第一條 route | [開始使用](docs/01-guide/getting-started.md) |
| 七站、三種類別、gate 怎麼答、registry | [概念](docs/01-guide/concepts.md) |
| 把常答的 gate 先寫好、調整派工與壓縮 | [Profile](docs/01-guide/profile.md) |
| 監控站每個 view 看什麼 | [監控站](docs/01-guide/station.md) |
| fankeel 在背景做了什麼 | [背景在做什麼](docs/01-guide/what-runs.md) |
| 五支掃描器怎麼用 | [掃描器](docs/01-guide/scanners.md) |
| 裝了沒反應、badge 不見、編輯被擋 | [疑難排解](docs/01-guide/troubleshooting.md) |
| 每一站裡面的步驟、route 怎麼選（英文） | [pipeline.md](docs/02-architecture/pipeline.md) |
| 每個目錄與檔案負責什麼（英文） | [layout.md](docs/02-architecture/layout.md) |
| 為什麼這樣設計 | [決策紀錄](docs/03-decisions/fankeel-shell.md)，全部決策見 [docs/README.md](docs/README.md) |
| 開發與發版、測試怎麼跑（英文） | [development.md](docs/01-guide/development.md)、[CONTRIBUTING.md](CONTRIBUTING.md) |

## 開發

```
npm test
claude plugin validate .
```

一次只跑一個 `npm test`。其餘見 [development.md](docs/01-guide/development.md)。
