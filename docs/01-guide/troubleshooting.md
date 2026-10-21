---
status: current
last_verified: 2026-10-21
source_of_truth: lib/badge.js, hooks/guard.js, lib/guard.js, scripts/suite.js, docs/01-guide/development.md
---

# 疑難排解

## 打 `/fankeel` 沒反應

裝完或更新完要重開 Claude Code：它只在啟動時讀插件清單。還是沒有，跑 `claude plugin list` 確認 `fankeel@fankeel` 已啟用。

## 更新了卻還是舊版

先更新 marketplace，再更新插件，然後重開：

```
claude plugin marketplace update fankeel
claude plugin update fankeel@fankeel
```

只跑第二行時，它比對的是磁碟上舊的清單，找不到新版。Claude Desktop 跑的是安裝時的快照，一樣要跑過 `claude plugin update`。

## statusline 沒有 badge

badge 由 [TokenBar](https://github.com/FanFantom9452/ClaudeCodeCLI-TokenBar) 畫。fankeel 只把一個字寫到 `~/.claude/modes/<session_id>/fankeel`，沒裝 TokenBar 就沒人畫它。有 task 時 band 與 Pane 仍會顯示站名。

## 編輯被擋下或跳出確認

另一個 live session 動過同一個檔時，scope guard 預設先問你，badge 變成 `[FANKEEL:CLASH]`。不要換工具繞過去：決定誰先改，或請另一邊用 `/fankeel` → Stand down 收掉。prompt 一直落在你已經決定好的衝突上時，可以 `node <plugin>/scripts/task.js guard off --session <id>` 改成只警告。

## 一個 session 已經不在了，卻還列在其他 session 裡

`/fankeel` → **Clear out** 列出過期的記錄與年齡，你挑哪些要收。fankeel 不會自己收任何記錄。

## 移除後留下的東西

專案裡的 `.fankeel/` 屬於專案，要自己刪。`~/.claude/modes/<session_id>/fankeel` 的旗標裝著插件時 30 天後自動清，移除後自己刪。

## 測試套件莫名失敗

一次只跑一個 `npm test`：兩套同時跑會互搶 CPU，把計時的測試弄紅；在記憶體不夠的 Windows 上會出現 `VirtualAlloc failed` 或 `0xC000012D`，那是系統配置不到記憶體，不是測試錯。見 [development.md](development.md)。
