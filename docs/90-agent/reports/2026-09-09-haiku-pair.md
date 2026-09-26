---
status: current
last_verified: 2026-09-09
source_of_truth: 一組成對量測（`ab-haiku.sh`，2026-09-09，`HEAD 502dcae91ee48b7b41434e0265dc6b0d7f297bb6`）的直接輸出——`ab-haiku-provenance.txt`、`arm-haiku-dispatch.json`、`arm-haiku-inline.json`；拿來對照的第一對數字是以同一支 `extract.js` 重跑 `arm-dispatch.json` 與 `arm-inline.json` 得到的，不是從既有報告抄來的；殼層秒數取自兩份 provenance 檔；本頁每一個數字都可回溯到這五個檔案之一，本頁不會重新產生
---

# 把第一對的兩臂換成 haiku — 2026-09-09

第一對是 opus 母 session 對 opus 母 session，dispatch 那一臂的四個 reader 是 sonnet。這一對只把母 session 換成 haiku，reader 仍是 sonnet。

**residue 的優勢從 9.23 倍降到 3.42 倍，錢從貴 1.85 倍變成貴 4.61 倍，wall-clock 從慢 1.75 倍變成打平。而 dispatch 那一臂的答案反而變差了：19 個錨點沒有一個帶目錄。**

## 這一對改的是哪一個變數

`ab-haiku.sh` 是第一對 `ab.sh` 的複本，`diff` 只有六處：註解、輸出目錄、provenance 檔名、兩行 note、兩處 `--model opus` 改成 `--model haiku`、四個輸出檔名。提問文字、兩個 method 句、`--disallowedTools`、`--permission-mode` 一字未動——包含 dispatch 那一句裡叫 reader 用 `model sonnet` 的部分。所以變的是母模型，reader 沒變。

## 數字

| | 第一對，兩臂 opus | 這一對，兩臂 haiku |
|---|---|---|
| dispatch 臂留在母 context | 57,652 | 39,040 |
| inline 臂留在母 context | 532,322 | 133,423 |
| **residue 優勢** | **9.23 倍** | **3.42 倍** |
| dispatch 臂花費 | $2.2350 | $0.8460 |
| inline 臂花費 | $1.2091 | $0.1833 |
| **錢** | **貴 1.85 倍** | **貴 4.61 倍** |
| 全模型 token | 2,541,508 對 543,396，4.68 倍 | 1,052,104 對 147,289，7.14 倍 |
| **殼層秒數** | **280 對 160，慢 1.75 倍** | **149 對 153，0.97 倍** |
| `num_turns` | 1 對 13 | 1 對 10 |
| `subagent_stats.spawned` | 4 對 0 | 4 對 0 |

## residue 的優勢為什麼掉一半

不是 dispatch 那一臂變差——它從 57,652 降到 39,040。是 **inline 那一臂變便宜了**：532,322 降到 133,423，回合數從 13 降到 10。haiku 的 inline 臂讀得比 opus 的 inline 臂少得多，所以 dispatch 能省下來的東西也就少了。

這一條和第二對量到的是同一件事的兩面。第二對把檔名點名，inline 臂就不必找，優勢從 9.23 倍塌到 1.5 倍。這一對沒有點名，但換了一個讀得比較少的母模型，優勢塌到 3.42 倍。**被比較的那一臂讀了多少，決定了 dispatch 的帳面優勢有多大**，而那不是 dispatch 的性質。

## 錢反而更貴，而且原因是固定的

reader 釘在 sonnet，母模型變便宜，reader 就在總額裡佔得更重：

| | reader（sonnet）花費 | 佔 dispatch 臂總額 |
|---|---|---|
| 第一對，opus 母 | $1.4056 / $2.2350 | 63% |
| 這一對，haiku 母 | $0.7559 / $0.8460 | 89% |

母模型每便宜一級，dispatch 在錢上就更難看，因為 `sonnet` 是這個 pipeline 規定的 reader 下限。這是機制而不是這一次的巧合。

## `duration_ms` 又一次低報 fan-out

| | `duration_ms` | 殼層秒數 |
|---|---|---|
| 第一對 dispatch | 45,586 ms | 280 s |
| 這一對 dispatch | 20,849 ms | 149 s |
| 這一對 inline | 144,108 ms | 153 s |

用 `duration_ms` 讀這一對，會得到「dispatch 快 6.9 倍」；用殼層秒數讀，是打平。`duration_ms` 只計母 session 自己的時間，reader 的時間不在裡面。兩對都出現同一個落差（6.1 倍與 7.1 倍），所以**這一對之後，fan-out 的 wall-clock 一律以 provenance 的 `shell_seconds` 為準**。

## 答案不對等

兩臂都照格式回答了，但錨點的可用性差很多：

| | 非空行數 | 錨點帶目錄 | 只有裸檔名 |
|---|---|---|---|
| dispatch 臂 | 10 | 0 | 19 |
| inline 臂 | 6 | 11 | 0 |

dispatch 臂寫的是 `SKILL.md:167`、`stages.js:229`。這個 repo 有八份 `SKILL.md`，所以 `SKILL.md:167` 是八選一，指不出是哪一份。inline 臂寫的是 `skills/fankeel-survey/SKILL.md:19-30`。

reader 各自只看自己那一份檔案，回傳時用了它自己看得懂的短名；haiku 母 session 把四份回傳併起來時沒有把短名補回完整路徑。這是 join 那一步掉的東西，不是 reader 掉的。

**這一段量的是錨點形式，不是findings 的對錯。** 兩臂各自宣稱的十行與六行，本頁沒有逐條去查證。

## 這一對不能拿來做什麼

- **不是第一對的嚴格重現。** 第一對釘在 `HEAD 86a104e1bc87f7e82eec45cb84b6e32459a32402` 與 `claude 2.1.259`，這一對是 `502dcae91ee48b7b41434e0265dc6b0d7f297bb6` 與 `2.1.265`。中間這棵樹改過很多。所以跨對比較的是**同日兩臂之間的比值**，不是絕對值。
- **每臂 n=1。** 沒有重複試驗，沒有變異數。
- **答案的正確性沒有比。** 上一節比的是錨點形式；哪一臂找到的問題是真的，本頁沒有查。
- **不改任何規則。** `sonnet` 是 reader 下限這條規定要不要動，是另一條 TODO 的事。
