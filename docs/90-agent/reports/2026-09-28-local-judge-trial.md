# 本地判斷模型試跑

一次性報告，2026-09-28。原始證據見
[`evidence/2026-09-28-local-judge-trial/`](evidence/2026-09-28-local-judge-trial/)：
`judge.sh`、`shots/`（十張截圖）、五份破壞過的 `index-*.html` 複本、
`station/`（讓破壞複本能載入原本的 CSS/JS）、`results.tsv`。

## 模型版本

- `ollama version is 0.34.2`
- `moondream`：`ollama pull moondream` 成功（manifest `e554c6b9de01` 828 MB、
  `4cc1cb3660d8` 909 MB，`verifying sha256 digest` 通過）。
- `git rev-parse HEAD`：`45e53abe3b4ea9dbcc161c7f01e5100dbc11df9a`（`results.tsv`
  的註解行同一個值）。

## 十張圖與 moondream 的逐張判斷

截圖來源：`.fankeel/index.html`（fankeel 測站首頁）。正常五張用
`node scripts/render.js .fankeel/index.html --out <dir> --size <W,H>` 分別截
1600×1000、1280×800、1024×768、800×1000、390×844。壞的五張各把
`index.html` 複製一份、注入一種破壞、再用同一支腳本截 1600×1000。

| 檔案 | 破壞方式 | 期望 | moondream 答案 | 耗時(秒) |
| --- | --- | --- | --- | --- |
| `shots/normal-1600x1000.png` | 無（正常） | NORMAL | NORMAL | 0.4 |
| `shots/normal-1280x800.png` | 無（正常） | NORMAL | NORMAL | 0.2 |
| `shots/normal-1024x768.png` | 無（正常） | NORMAL | NORMAL | 0.2 |
| `shots/normal-800x1000.png` | 無（正常） | NORMAL | NORMAL | 0.2 |
| `shots/normal-390x844.png` | 無（正常） | NORMAL | NORMAL | 0.3 |
| `shots/broken-a.png` | 拿掉 `<link rel="stylesheet">` | BROKEN | NORMAL（誤判） | 0.2 |
| `shots/broken-b.png` | 插入 `<style>body{display:none}</style>` | BROKEN | NORMAL（誤判，即使畫面全黑） | 0.2 |
| `shots/broken-c.png` | 插入 `<style>*{position:absolute!important;top:0;left:0}</style>` | BROKEN | NORMAL（誤判） | 0.2 |
| `shots/broken-d.png` | 插入 `<style>*{color:transparent!important}</style>` | BROKEN | BROKEN（答對） | 0.2 |
| `shots/broken-e.png` | 插入 `<style>body{font-size:80px!important}</style>` | BROKEN | NORMAL（誤判） | 0.3 |

moondream 只答 `NORMAL`／`BROKEN` 兩個詞，沒有照提示詞附上理由句；
`judge.sh` 對 `ollama run` 的原始輸出做了 ANSI escape 過濾（spinner 字元）
才拿到乾淨字串，`results.tsv` 留的就是過濾後的這行。

## 兩個命中率

- 正常圖判對：5 / 5（0 張誤判成 BROKEN）。
- 壞圖判對（答 BROKEN）：1 / 5（只有 `broken-d`，全透明文字那張）。
- 十張平均耗時：0.24 秒（`results.tsv` 十行 seconds 欄位平均）。

## UI-TARS

`ollama pull hf.co/mradermacher/UI-TARS-1.5-7B-GGUF` 失敗，原始錯誤：

```
Error: Head "https://us.aws.cdn.hf.co/xet-bridge-us/.../UI-TARS-1.5-7B.IQ4_XS.gguf...": blocked redirect to a different host
```

manifest 下載本身可以連上，卡在下載真正的 gguf 檔案時被導向另一個主機、
本機的 ollama 拒絕跨主機的 redirect。依步驟 5 的規則，第一步失敗就照原文
記錄，不再往下試「問座標」那一題。

**Not run:** UI-TARS 的座標問答（`Where would you click to open the first
session row?`）——因為模型沒能 pull 下來，沒有模型可以問。

## 結論

結論：不夠當篩子——五張壞圖只抓到 1 張（`broken-d`，全透明文字），沒有達到「4 張以上」的門檻；五張正常圖 0 張誤判，符合「1 張以下」但另一個條件不成立，兩條都要同時滿足才算通過。平均耗時 0.24 秒。
