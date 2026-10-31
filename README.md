# FanKeel

> **English.** fankeel is a Claude Code plugin for long-running projects. Each session holds one task and walks it through up to seven stages — survey, design, plan, build, verify, audit, land — stopping at a gate after each to ask you. It remembers what was tried and warns when two live sessions edit the same file. The guides are in Traditional Chinese under [docs/01-guide](docs/01-guide/); the design reference, [docs/02-architecture](docs/02-architecture/), is in English.

fankeel 是 Claude Code 插件。每個 session 扛一件任務，照路線一段一段走，每段做完停下來問你。
它記得試過什麼，兩個 session 動到同一個檔時會提醒你。

## 安裝

```
claude plugin marketplace add FanFantom9452/FanKeel
claude plugin install fankeel@fankeel
```

裝完重開 Claude Code。不用裝別的套件，Node 22.5 以上即可。

**更新**——先更新 marketplace，再更新插件，然後重開：

```
claude plugin marketplace update fankeel
claude plugin update fankeel@fankeel
```

**移除**——先跑 `uninstall.js` 清掉專案外的檔（加 `--dry-run` 只列不刪），再移除插件。
`<plugin>` 在 `~/.claude/plugins/cache/fankeel/fankeel/<版本>/`；專案裡的 `.fankeel/` 會留著。

```
node <plugin>/scripts/uninstall.js
claude plugin uninstall fankeel@fankeel
claude plugin marketplace remove fankeel
```

## 怎麼用

1. 在專案目錄打 `/fankeel`，說要做什麼。
2. 每段做完停在 gate：選項一往下一段，選項二留下，選項三暫停。
3. 監控站把所有 session 畫成一頁；分頁關了，Windows 雙擊 `.fankeel/station.bat`，其他系統執行 `.fankeel/station.sh`。

## 想看更多

| 想知道 | 頁面 |
|---|---|
| 一件真實任務逐段怎麼走（詳細設計） | [design.md](docs/01-guide/design.md) |
| 同一件任務畫成一頁 | [seven-stages.html](docs/01-guide/seven-stages.html) |
| 從安裝到走完第一條路線 | [開始使用](docs/01-guide/getting-started.md) |
| 七段、三種類別、指令 | [概念](docs/01-guide/concepts.md) |
| 全部文件 | [docs/README.md](docs/README.md) |
| 開發與測試 | [development.md](docs/01-guide/development.md)、[CONTRIBUTING.md](CONTRIBUTING.md) |

## 開發

```
npm test
claude plugin validate .
```

一次只跑一個 `npm test`。
