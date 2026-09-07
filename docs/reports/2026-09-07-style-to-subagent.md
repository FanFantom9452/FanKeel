---
status: current
last_verified: 2026-09-07
source_of_truth: 四次 `claude -p --output-format json` 的直接輸出（`control-1.json`、`control-2.json`、`styled-1.json`、`styled-2.json`）、一次操作檢定（`bogus.json`）、`probe.sh` 與 `provenance.txt`；全部在 `docs/reports/evidence/2026-09-07-style-to-subagent/`。本頁沒有量到答案，本頁量到的是量不到，這一點寫在標題下第一句
---

# 輸出樣式到不到 subagent — 2026-09-07

**沒有答案，而且知道為什麼沒有。** 四次跑裡帶樣式的那兩次，連 parent 自己都回報看不到樣式文字——所以 subagent 回報的 `NO` 不能拿來說 subagent 收不到樣式，它只說明這個操作沒有生效。這是控制組唯一的用途，而它做到了。

## 1. 問的是什麼

`TODO.md` 的 `## Ready` 只有一則：在 `/config` 設一個輸出樣式，派一個 agent，讀它實際拿到什麼——`lib/render.js`。

先前的 survey 已經確定了一半：`lib/render.js` 與 `hooks/brief.js` 全檔 `grep` `style` 都是零匹配，`renderBrief` 組的六段內容裡沒有任何一段跟樣式有關（`lib/render.js:338-359`）。**fankeel 自己不轉發樣式，這件事是確定的。** 沒確定的是另一半：Claude Code 本身會不會把樣式放進 subagent 的 system prompt。

## 2. 方法

| 項目 | 內容 |
|---|---|
| 變因 | 交給 `claude -p` 的 settings 檔裡有沒有 `outputStyle` |
| 固定 | prompt、model（`sonnet`）、旗標、工作目錄，四次完全相同 |
| n | 每個 arm 跑兩次，共四次 |
| 針 | `output-styles/fankeel-terse.md` 裡的一句字面字串：`cost the reader a decode` |

針是**逐字交給**受測者的，不是描述給它的。一個被問「你的 context 裡有沒有提到輸出樣式」的 probe，兩次會給出不一樣的答案；一個被問「這個字串在不在」的 probe 不會。

每一次跑都問**兩個**問題，而第一個是控制組：

1. 這個字串在不在**你自己**的 context 裡？
2. 派 `brief-probe`，問它同一個問題，逐字回報它的答案。

**沒有第一問，第二問是讀不懂的。** 一個 `NO` 可能是「樣式沒有到 subagent」，也可能是「樣式根本沒有到這個 process」，而這兩件事要說的話完全相反。

## 3. 結果

| arm | run | 問題 1（parent 自己） | 問題 2（`brief-probe`） | 派出的 subagent |
|---|---|---|---|---|
| control | 1 | NO | NO | 1 |
| control | 2 | NO | NO | 1 |
| styled | 1 | **NO** | NO | 1 |
| styled | 2 | **NO** | NO | 1 |

粗體的兩格就是結論。**帶樣式的那兩次，parent 自己也看不到樣式文字**——操作沒有生效，所以第二欄的 `NO` 對「subagent 收不收得到」這個問題一句話也沒說。

四次都確實派出了 subagent（`subagent_stats.spawned` 都是 1），四次 `stderr` 都是 0 bytes，四次 `exit=0`。失敗的不是跑，是操作。

## 4. 為什麼操作沒有生效

再跑一次，只換一件事：把 `outputStyle` 設成一個**不存在**的名字。

```
{ "outputStyle": "definitely-not-a-real-style-zzz" }
```

`exit=0`，`stderr` 0 bytes，回答正常（`bogus.json` 的 `result` 是 `"OK"`）。

**一個不存在的樣式名字被靜靜吃掉了。** 所以在 `claude -p` 底下，`--settings` 檔裡的 `outputStyle` 不是「解析失敗」，是根本沒有被讀進來——否則一個查無此樣式的名字應該要抱怨。這一次跑同時解釋了前四次，也讓「樣式沒到 parent」從觀察變成有機制的解釋。

## 5. 所以確定了什麼、沒確定什麼

**確定：**

- fankeel 不轉發輸出樣式。`lib/render.js` 與 `hooks/brief.js` 對 `style` 零匹配，`renderBrief` 的六段內容裡沒有樣式（`lib/render.js:338-359`）。
- `claude -p --settings <檔>` 裡的 `outputStyle` 不生效，連無效名字都不會報錯。**headless 不是量這件事的管道。**

**沒確定：**

- 一個在 `/config` 裡真的設好樣式的**互動** session，派出去的 subagent 拿不拿得到那段樣式文字。這一頁沒有回答，也不假裝回答。

## 6. 這一頁的洞

- **n 是每個 arm 2 次**，但因為操作根本沒生效，重複次數在這裡不代表任何事——它只是排除了「其中一次剛好答錯」。
- **只試了一個管道。** `--settings` 檔失敗，不代表環境變數、`~/.claude/settings.json`、或互動 `/config` 也失敗；後者正是還沒試的那一個。
- **只試了一個樣式。** `fankeel-terse` 是外掛帶的樣式，不是 Claude Code 內建的。內建樣式會不會有不同結果，沒有量。
- 針只有一根。一句話沒出現，嚴格說只證明那一句沒出現。

## 7. 要回答它，需要什麼

一個新的互動終端機，在 `/config` 裡選一個輸出樣式，然後在同一個 session 裡派一個 `brief-probe`，問它同一根針。這個 process 做不到，因為這個 process 的 `outputStyle` 沒有設，而 headless 這條路上面已經證明是不通的。

這一則因此回到 `## Waiting`，帶著它的 `lifts when:`——不是回到 `## Ready`，因為今天沒有任何東西能讓它動。
