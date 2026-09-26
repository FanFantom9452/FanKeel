---
judged: 2026-09-10T15:04:30.972Z
model: fable
agent: fankeel-judge
task: "處理 TODO：Ready 一條與七條待決議，決議走 fankeel-ask"
session: 98873819-d200-4e3b-be77-be352547e51e
stage: design
---

# 判斷 1：`renderResume` 要不要長度斷言，cap 定多少

## Question

# 判斷 1：`renderResume` 要不要長度斷言，cap 定多少

## 問題

`lib/render.js` 的 `renderResume()` 沒有任何量它輸出大小的測試。要不要加一條
長度斷言？要的話 cap 取多少、用什麼單位、以什麼為基準量？

## 你可以自己讀的檔（請讀，不要只信這份 brief）

- `lib/render.js:278` — `function renderResume({ mine, profile })`
- `tests/resume.test.js:11,244,245,249` — `renderResume` 在 `tests/` 底下僅有的
  四處，全部是內容 regex（`/^profile: guard deny$/m` 之類），沒有長度或位元組斷言
- `tests/render.test.js:9` — import 清單裡沒有 `renderResume`
- `tests/render.test.js:441,546` — 這個檔量的是 `render()`：七個 stage 在 59 字元的
  `REFERENCE_ROOT` 下都在 2400 字元內，跨 profile 排列組合
- `tests/stage-registry.test.js:28-35` — 逐 stage `prompt_bytes <= prompt_byte_budget`
- `tests/stage-registry.test.js:42-52` — 那個測試的控制組：把 `build.budget` 壓到 1，
  斷言溢位確實被抓到，`finally` 還原
- `tests/brief.test.js:122-126` — 另一種寫法：`assert.ok(text.length < 1400, ...)`，
  用 JS `.length`（UTF-16 code unit），不是位元組
- `lib/stage-registry.js:104` — `prompt_byte_budget: stage.budget`
- `docs/pipeline.md:226,227,228,229,232,233,239` — 七個人手量的 resume 數字

## 已知的事實

- 2026-09-10 這七個人手量的數字裡有三個同時是錯的，被發現的方式是有人去量。
- 這個 repo 對「大小」有三種既有寫法：`render()` 的 2400 字元、`brief` 的 1400
  `.length`、registry 的 `prompt_byte_budget` 位元組。三種單位並存。
- `render()` 的 2400 是照實測 2377 加餘裕定的（`skills/registry.json:8-9`）。
- 使用者今天的指示是七條 TODO 全部送判官，所以這題送到你這裡是指示，不是這個
  session 答不出來。

## 算什麼是答案

一個可以直接寫進測試的決定：加或不加；加的話 cap 的數字、單位（字元或位元組）、
量的基準（哪一組 profile 與 mine 的排列、以及要不要像 `render()` 那樣固定一個
59 字元的參考 root），以及要不要照 `tests/stage-registry.test.js:42-52` 配一個
控制組。若你認為不該加，說出七個人手量的數字之後靠什麼不再出錯。

## 回傳形狀

- 一行結論。
- 三到六行理由，每行一個。
- 一行「這個決定在什麼情況下是錯的」。
- 不要重述這份 brief，不要條列你讀過哪些檔。

## Answer

pick: 加。在 `tests/resume.test.js` 直接呼叫 `renderResume`，cap `< 2600` 字元（`.length` 換算到 59 字元參考 root，即 `tests/render.test.js` 的 `sizeAtReference`），量法：三個 class 各走自己的 route，每個 stage 取「無 profile + 四組 `PROFILES` 交叉」的最大值，`gateAt` 有戳，task 行用 pipeline.md 那句 35 字元；每格 `t.diagnostic` 印出大小；控制組不照 registry 那套壓 budget，改一條非空保護 `assert.match(out, /^stage rules:$/m)`。
why: 今天在 HEAD aca11d5 實測：有戳無 profile 2204–2366、有 profile 2359–2531（`bounded@design`、`design.mockup` 開最重），pipeline.md:226-233 七個數字目前全對，但只對到下一條 rule 或下一個 profile key 落地；沒有測試印出來就還是人手量。
單位選字元：resume 是 `render()` 去掉 touched/notes/others 再加一行 `profile:`，兩個 cap 要能並排比；pipeline.md 也用字元。registry 的位元組是給 `skills/registry.json` 的消費者，不是這裡。
2600 而非 2400：09-09 build gate 已決定 `profile:` 行只上 resume 塊（`lib/render.js:193-198`），七個 key 那行 146 字元，resume 本來就被允許超過 2400；2531 對 2600 餘 69，約三個新 key，與 design 的 registry 餘裕 66 同量級。無戳 `gate:` 行（+226 → 2758）不入 cap，是 hook 未註冊的退化況，`tests/gate.test.js:118` 已斷言其存在。
控制組：registry 那條存在是因為 `prompt_bytes <= prompt_byte_budget` 兩邊都是被測碼產的；這裡 cap 是字面量，唯一空過法是 `renderResume` 回 `null` 讓 `(null||'').length` 為 0，非空 match 就擋這條。
brief 一處有誤：`render()` 的 2400 字元 cap 是 `tests/render.test.js:505-507` 以 `audit` 2397 綁定定的；`skills/registry.json:8-9` 的 2377/2400 是 survey 的位元組預算，兩個 2400 不同源。
would flip if: 若這條要進 `skills/registry.json` 當一欄（TODO 第三條的總預算方向），單位改位元組、放 `lib/stage-registry.js` 而非測試字面量，控制組照 42-52。若 09-09「profile 行上 resume」被翻掉，cap 回 2400 並擠短 profile 行。
unread: nothing
