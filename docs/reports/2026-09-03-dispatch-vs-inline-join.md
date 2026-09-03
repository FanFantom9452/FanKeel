---
status: current
last_verified: 2026-09-03
source_of_truth: 一組成對量測（`ab3.sh`，2026-09-03，`HEAD 86a104e1bc87f7e82eec45cb84b6e32459a32402`）的直接輸出——`ab3-provenance.txt`、`arm3-dispatch.json`、`arm3-inline.json`，以及跑之前就寫在磁碟上的 `ab3-prediction.txt`；抽數字用的 `extract.js` 先重現前兩對已發表的八個數字才拿來跑這一對；`--disallowedTools Agent` 移除的是工具本身這一點沿用第一對的前導測試（`pilot-dispatch.json`、`pilot-inline.json`），這一對沒有重跑那一步；本頁每一個數字都可回溯到這些檔案之一，本頁不會重新產生
---

# 第三對：命名了，但仍要跨檔對照

前兩對留下兩個點，中間沒有量過。這一對量的就是中間，而且**推翻了寫報告的人自己事前押的那一邊**。

## 這一對改的是哪一個變數

對**第一對**（`ab.sh`）只動一處：把八個檔案的路徑寫進問題裡，兩臂都不必再去找它們。join 本身、答案形狀、10 行上限、每個 subagent 6 行的上限、四個 `sonnet` 讀者、旗標、model、`86a104e` 的樹，全部與 `ab.sh` 相同——`M_DISPATCH` 與 `M_INLINE` 兩行與 `ab.sh` **逐字元相同**，這是用 `grep` 抽出整行做字串相等比對確認的，不是讀過去覺得一樣。

三對的座標因此是：

| | 檔案是否命名 | 工作形狀 |
|---|---|---|
| 第一對 | 否（只給 `skills/fankeel-<stage>/SKILL.md` 這個 glob 與 `lib/stages.js`） | 跨檔對照規則 |
| **第三對** | **是（八個路徑逐一列出）** | **跨檔對照規則，與第一對同一句問題** |
| 第二對 | 是（七個路徑逐一列出） | 每檔分類，不跨檔 |

`ab3.sh` 相對 `ab2.sh` 有七處差異，`diff` 逐行核對過：檔頭註解、`SP`、`QUESTION`、`M_DISPATCH`、`LOG` 檔名，以及兩個 `claude` 呼叫各自的輸出檔名。相對 `ab.sh` 則只有插入的那個命名子句（外加 `answer` 因為位置改變而變成 `Answer`）——把子句用 `sed` 拿掉之後，整行與 `ab.sh` 的 `QUESTION` 字串相等，而同一個檢查套到 `ab2.sh` 的問題上不會通過，所以這個檢查有辨識力，不是恆真。`ab3.sh` 多出來的兩行 `git checkout` 是 `ab2.sh` 加的，作用是把樹切回 `ab.sh` 當時的那一棵，屬於保住條件而不是改變條件。

## 事前預測，以及它錯了

`ab3-prediction.txt` 在跑之前就寫在磁碟上（mtime 23:12，`ab3.sh` 23:13，量測起跑 23:14），內容包含一個**事前訂好的判準**：主執行緒 residue 比值 `inline / dispatch` 若 **≥ 3.0×** 則採解釋 (b)「決定的是 join 的深度」，若 **< 3.0×** 則採解釋 (a)「決定的是要不要找東西」，也就是 [subagents.md](../subagents.md) 原本的說法。3.0 取自 1.5 與 9.2 的對數中點（`sqrt(1.5*9.2)=3.7`）往下取整，訂在看到數字之前。

寫預測的人押 (b)，理由是第一對的路徑本來就是 glob 給的，所以「命名」從來不是兩對之間的大變數。

**結果是 2.55×，低於 3.0，所以 (a) 成立、(b) 被推翻。** 原本那句話站得住，而且現在有第三個點支撐它。這一段留在這裡是因為預測寫在跑之前才有意義：押錯了就記錄押錯了。

## 控制項

| 控制 | 結果 |
|---|---|
| 兩臂真的走上不同方法 | `subagent_stats.spawned`：Arm A 是 4，Arm B 是 0。這是 `claude -p` 自己記的執行統計，不是自我宣稱 |
| 抽數字的定義沒有換過 | `extract.js` 先跑前兩對的四份 JSON，逐一重現了兩份已發表報告印出來的 57,652、532,322、2,541,508、543,396、2,140,264、401,244、74,603、113,518，然後才拿來跑第三對 |
| 兩臂都沒有出錯 | `arm3-dispatch.err`、`arm3-inline.err` 都是 0 bytes，`exit=0`；`porcelain` 在起跑時是空的 |
| 跑完的樹回到原處 | `restored: main`，事後 `git status --porcelain` 為空，`HEAD` 回到 `ed227af` |

## 三個點

主執行緒 residue 的定義與前兩份報告相同：`usage` 的 `input_tokens + cache_read_input_tokens + cache_creation_input_tokens`。

| | dispatch | inline | inline / dispatch |
|---|---|---|---|
| 第一對（未命名＋join） | 57,652 | 532,322 | **9.23×** |
| **第三對（命名＋join）** | **62,937** | **160,728** | **2.55×** |
| 第二對（命名，無 join） | 74,603 | 113,518 | **1.52×** |

中間確實落在中間。而三個點可以把兩個變數各自拆出來，因為每一次都只有一個變數在動：

| 動的是 | held constant | 效果 |
|---|---|---|
| **命名**（第一對 → 第三對） | join 在、同一句問題 | 9.23× → 2.55×，**降 3.62×** |
| **join**（第二對 → 第三對） | 兩邊都命名 | 1.52× → 2.55×，**升 1.68×** |

所以兩個變數都是真的，命名是大的那個。原頁把它寫成二分——「決定的是要不要找東西，不是要讀多少」——方向對，但**不是階梯函數**：命名之後 join 仍然買到 2.55×，這不是「幾乎沒買到」。

## 機制：turn 數

`num_turns` 兩份已發表的報告都沒有用到，而它就是上面那張表的機制。

| arm | turns | 主執行緒 residue |
|---|---|---|
| 第二對 inline | 8 | 113,518 |
| 第三對 inline | 9 | 160,728 |
| 第一對 inline | 13 | 532,322 |

turn 數從 8 到 13 是 1.63 倍，residue 從 113,518 到 532,322 是 4.69 倍。residue 比 turn 數漲得快，因為每一 turn 都把累積的 context 再讀一遍，所以累計量大致隨 turn 數的平方走而不是線性。要去找東西會多花 turn，多花的 turn 以超線性的方式變成 residue——這一句同時解釋了 (a) 為什麼對，以及 (b) 為什麼不是全錯：join 也會多花 turn（9 對 8），只是遠不如「要找東西」多（13）。

dispatch 那一側的 turn 數是 1、1、5：第一對與第三對的 dispatch 臂都只用一個 turn 就把四個讀者送出去並收回答案。

## 錢與時間

| | dispatch | inline | 比值 |
|---|---|---|---|
| `total_cost_usd` | US$2.1240 | US$1.0025 | 2.12× |
| all-model tokens（`modelUsage` 加總） | 1,035,972 | 169,629 | 6.11× |
| wall-clock（`shell_seconds`） | 324 秒 | 120 秒 | 2.70× |

第三對的 1,035,972 由兩個 model 組成：`claude-sonnet-5` 636,264 tokens／US$0.9917（四個讀者），`claude-opus-5` 399,708 tokens／US$1.1323（parent）。token 加總是精確值；金額 US$1.1323 加 US$0.9917 等於 US$2.1240，與 `total_cost_usd` 的 2.1239828 差在顯示前先捨入到四位小數，與第一份報告記錄的同一現象一致。

三對的方向完全一致，沒有例外：**dispatch 每一次都更貴、每一次都更慢。**

| | 錢（dispatch／inline） | wall-clock |
|---|---|---|
| 第一對 | 1.85× | 1.75×（280／160 秒） |
| 第二對 | 1.59× | 2.77×（86／31 秒） |
| 第三對 | 2.12× | 2.70×（324／120 秒） |

順帶第三次確認一件事：`duration_ms` 會嚴重低報 fan-out。第三對 dispatch 臂的 `duration_ms` 是 50,328（50 秒），`shell_seconds` 是 324 秒，低報 6.44 倍；inline 臂是 114,230 對 120 秒，只差 1.05 倍。要看 fan-out 的牆鐘時間就得看外面計的秒數。

## 這一頁改了 [subagents.md](../subagents.md) 什麼

- 「Two points, and nothing between them has been measured」不再成立，換成第三個點。
- 第 37 行 dispatch 表格裡「one whose files were already named bought almost none of it」需要修：命名之後仍有 2.55×，因為 join 還在。買到的少是相對於 9.23×，不是「幾乎沒有」。
- 「決定的是要不要找東西，不是要讀多少」保留，因為它就是這一對事前判準判給它的那一邊，但補上它不是階梯函數。

## 沒做的事

- 前導測試（`--disallowedTools Agent` 移除的是工具本身而不是擋呼叫）沒有重跑，沿用第一對的 `pilot-dispatch.json`／`pilot-inline.json`。
- 每一對都只跑一次，沒有重複量測，所以三個比值各自的變異數是未知的。三個點的方向一致（錢與時間三次同向），但 2.55 與 3.0 的距離不能當成有統計意義的差距——判準訂在事前是為了不讓解讀隨數字漂，不是為了宣稱這個差距超出噪音。
- 第四個角（未命名＋無 join）沒有量。三個點只夠拆出上面兩個單變數效果，不足以談交互作用。
- 證據檔（`ab3.sh`、`arm3-*.json`、`ab3-provenance.txt`、`ab3-prediction.txt`、`extract.js`）與前兩對一樣放在 session 的暫存目錄裡，不在版本控制內。三份報告現在都有這個問題，`TODO.md` 的那一則決定因此從兩份變成三份。

[Back to the index](../README.md) · [Back to the front page](../../README.md)
