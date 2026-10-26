---
status: current
---

# station 通知面板放大、可調整大小、手機版 Implementation Plan

**Goal:** 通知面板與其他展開面板變大且看得到拖曳握把，手機上通知面板變底部抽屜、/m 讀得舒服，held gate 的單選快捷與 gate 頁都有自由填寫＋麥克風，`/fankeel` 不再開瀏覽器。
**Architecture:** 六個互不相交的 task：station.css、station.js＋i18n.js、gate-frame、mobile、inject hook、render 字樣＋文件。CSS 與 JS 之間只靠 class 名字約定（`gfree`、`gfrow`、`gmic`、`gsay`、`gfs`、`fkg`、`fkx`），各 task 用自己的測試檔證明自己那一半。麥克風沿用 `assets/station/mobile.js:575` 的 `listen()` 作法（SpeechRecognition、`zh-TW`、interim、continuous），在 station.js 與 gate-frame.js 各寫一份小的，因為兩頁都不載入 mobile.js。
**Tech Stack:** Node `>=22.5`（`package.json` engines），`node --test`，沒有 dependencies；`assets/station/*.js` 是瀏覽器端 ES5 IIFE（`var`、`function`），沒有 bundler。
**Spec:** [../../../.fankeel/build/task-20261025T191318/design.md](../../../.fankeel/build/task-20261025T191318/design.md)

## Global Constraints

由 `node scripts/map.js`（1231 份 markdown、3 份 planned 未建）、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md` 與 `AGENTS.md`，`CONTRIBUTING.md:3`）、`package.json` 與測試套件產生：

- `lib/*.js` 是純函式、直接測，`lib/` 不 require `scripts/` 或 `hooks/`；每個 hook 在每條路徑都 exit 0，包括自己出錯時（`CONTRIBUTING.md` Scope and ownership）。
- 測試用 `node --test`（`package.json` 的 `test` 是 `node --test --test-timeout=300000 --test-force-exit --require ./tests/subprocess-timeout.js`）；每個匯出的名字都要有 importer，新檔要先 `git add` 才看得到（`tests/source.test.js`）。所以本計畫不新增任何 export。實作者只跑自己 task 列出的測試檔，不跑全套。
- 沒有 dependencies，`engines.node` 是 `>=22.5`（`package.json`）。
- `READ_CAP` 1500、`FILE_CAP` 3（`lib/plantasks.js`）。`assets/station/station.js`（5568 行）、`assets/station/station.css`（2260 行）、`docs/90-agent/reference/station.md`（1624 行）超過 1500，所以它們的 `Modify:` 都帶行號範圍。
- `assets/station/*.js` 的每個 `loc('key', '中文')` 都要在 `assets/station/i18n.js` 的英文表有同名 key，英文不含 CJK，表裡每個 key 都要被用到（`tests/station-module.js` 的 `stringsLeft`、`tests/station-i18n.test.js`）；`gate-frame.js` 與 `mobile.js` 各有自己的 `EN`／`STR` 表，同一條規則。CJK 字面值只能出現在 `loc()` 的第二個參數。
- `assets/station/station.css` 沒有用到的 class 會被 `tests/station-css-dead.test.js` 這類測試盯著：新增的 class 都要在 JS 裡有畫它的地方（本計畫的 `gfree`、`gfrow`、`gmic`、`gsay`、`gfs`、`fkg`、`fkx` 都由 Task 2、3 畫出）。
- 縮排跟著檔案走：`assets/station/*.js` 與 `tests/station-*.test.js` 四格；`tests/inject.test.js`、`tests/render.test.js` 兩格；`hooks/`、`lib/` 四格。CSS 規則一條一行，沿用檔內寫法。
- 行號引用不能動：`hooks/inject.js` 第 78 行以前只能原地替換（`tests/badge.test.js:99` 引 `hooks/inject.js:76`），本計畫的改動都在 183 行以後且不增減行數。
- 行尾 LF（`.gitattributes`：`* text=auto eol=lf`）。檔案用 Edit／Write 改，不用 heredoc（heredoc 吃反斜線）。
- 版本號不在這份計畫裡動：`scripts/version.js` 是 land 階段的事（`CONTRIBUTING.md` Version numbers）。

## Risks

- `.fkp` 的 `:root[data-style=keel] .fkp{max-height:calc(100vh - 82px)}`（`station.css:1533`）specificity 比手機抽屜規則高 — Task 1 — 先確認抽屜的 `max-height` 帶 `!important`，測試斷言它。
- `tests/station-bell-header.test.js:37` 釘著舊寬度 `min(376px,calc(100vw - 64px))`、`:52` 釘著 `nesw-resize` — Task 1 — 先改這兩條斷言再改 CSS；`nesw-resize` 游標不動，所以 `:52` 不用改。
- `drawFloat()` 每次重畫都換掉 `#fkp`，使用者正在打的字與正在聆聽的 `SpeechRecognition` 會掉 — Task 2 — 草稿存 `view.pg[<id>:free]`，聆聽中或輸入框有 focus 時輪詢重畫直接略過（只有點擊路徑強制重畫）。
- held 的 gate 讓 `#fkp` 一律顯示（`open || held.length`），手機抽屜若要能關就得有「關掉」狀態 — Task 2 — 用 `view.pg['fk:shut']`，gate 一清掉就刪。
- `tests/station-gate-free.test.js` 的 `S` 沒有 `gateAt`，新的「沒有 `gateAt`／`pending` 就不畫 `.gt-side`」會讓它整個失敗 — Task 3 — 先給那個測試的 `S` 補 `gateAt`，這是預期內的改動。
- `render.js:382` 的 `serve is starting; the browser opens when it binds.` 在 `open: false` 之後也變成假話，design.md 只點名 `:380` — Task 6 — 同一個 task 把這句跟 `:380` 一起改，並在 Coverage 的備註裡寫明超出 design 點名的行。
- 手機真機、拖曳手感、淺色主題沒有在 mockup 驗證過（design.md 的 unverified）；frame 4 是從 mobile.js 畫的，不是 live /m gate 截圖 — Task 1、4 — 測試只證明規則與標記存在，build 之後的 verify 用 `fankeel:fankeel-render-reviewer` 與使用者實機看。

## Task 1: station.css 面板放大、握把、手機抽屜

**Files:**
- Modify: `assets/station/station.css:302-1533` — `.qpop`、`.claims`、`.fpanel`、`.fkp`、`.fkr`、`.fkf` 的尺寸與握把，新增 `.fkg`、`.fkx`、手機抽屜、`.gfree`／`.gfrow`／`.gmic`／`.gsay`／`.gfs`
- Modify: `tests/station-bell-header.test.js:30-40` — 舊寬度 `376px` 的斷言改成新寬度
- Test: `tests/station-resize-css.test.js`

**Interfaces:**
- Consumes: none
- Produces: class 規則 `.fkp`（寬 `min(560px,calc(100vw - 32px))`）、`.fkr`（24px 握把）、`.claims`（`resize:vertical`）、`.fkg`／`.fkx`（桌面 `display:none`，手機顯示）、`.gc .gfree`、`.gfrow`、`.gfrow .gmic`（`.on` 為聆聽中）、`.gsay`（`.on`）、`.gc .gfree .gfs`；Task 2、3 畫出對應標記

**Dispatch:** implementer, sonnet — 規則與測試都在計畫裡，照抄加跑測試。

- [ ] **Step 1: 先寫會失敗的測試**

Write `tests/station-resize-css.test.js`:

```js
'use strict';
// The station's panels as the approved mockup draws them (.fankeel/build/2026-10-26-station-resize/mockup.html):
// the notification panel is wider and its grip is a 24px tile, the other expanded panels get room,
// and under 600px the panel is a bottom sheet.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.css'), 'utf8');
const rule = (sel) => {
    const at = CSS.indexOf('\n' + sel + '{');
    assert.ok(at > -1, sel + ' has its own rule');
    return CSS.slice(at + 1, CSS.indexOf('}', at));
};
const sheet = () => {
    const at = CSS.indexOf('/* ---- gate panel: phone bottom sheet ---- */');
    assert.ok(at > -1, 'the phone sheet block is marked');
    const from = CSS.indexOf('@media (max-width:599px){', at);
    assert.ok(from > -1, 'the sheet is a max-width:599px media block');
    return CSS.slice(from, CSS.indexOf('\n}\n', from));
};

test('.fkp opens at min(560px, 100vw - 32px)', () => {
    assert.ok(rule('.fkp').includes('width:min(560px,calc(100vw - 32px))'));
});

test('.fkr is a visible 24px grip that turns keel blue on hover', () => {
    const r = rule('.fkr');
    assert.match(r, /width:24px/);
    assert.match(r, /height:24px/);
    assert.match(r, /nesw-resize/);
    assert.match(rule('.fkr:hover'), /var\(--keel\)/);
});

test('.fkf leaves room for the grip', () => {
    assert.match(rule('.fkp .fkf'), /padding-left:36px/);
});

test('.qpop is 720px wide and 80vh tall at most', () => {
    const r = rule('.qpop');
    assert.ok(r.includes('width:min(720px,calc(100vw - 48px))'));
    assert.match(r, /max-height:80vh/);
});

test('.claims is 320px tall, resizes vertically, and the cap lifts once dragged', () => {
    const r = rule('.claims');
    assert.match(r, /max-height:320px/);
    assert.match(r, /resize:vertical/);
    assert.match(rule('.claims[style*="height"]'), /max-height:none/);
});

test('.fpanel may be 60vh tall', () => {
    assert.match(rule('.fpanel'), /max-height:60vh/);
});

test('under 600px .fkp is a fixed bottom sheet that overrides the saved size, with no grip', () => {
    const s = sheet();
    assert.match(s, /\.fkp\{[^}]*position:fixed/);
    assert.match(s, /\.fkp\{[^}]*bottom:0/);
    assert.match(s, /\.fkp\{[^}]*width:auto!important/);
    assert.match(s, /\.fkp\{[^}]*height:auto!important/);
    assert.match(s, /\.fkp\{[^}]*max-height:85dvh!important/);
    assert.match(s, /\.fkp\{[^}]*border-radius:12px 12px 0 0/);
    assert.match(s, /\.fkr\{display:none\}/);
    assert.match(s, /\.fkg\{display:grid/);
    assert.match(s, /\.fkx\{display:grid/);
});

test('the drag bar and the close button are hidden above 599px', () => {
    assert.match(rule('.fkg,.fkx'), /display:none/);
});

test('the free answer and its mic have rules', () => {
    for (const sel of ['.gc .gfree', '.gfrow', '.gfrow .gmic', '.gfrow .gmic.on', '.gsay', '.gc .gfree .gfs']) assert.ok(CSS.includes('\n' + sel + '{'), sel);
});
```

- [ ] **Step 2: 跑它，看它失敗**

```sh
node --test tests/station-resize-css.test.js
```

預期：除了 `.fkr` 的 `nesw-resize` 之外每一條都失敗。

- [ ] **Step 3: 先改 `tests/station-bell-header.test.js` 的舊寬度斷言**

In `tests/station-bell-header.test.js`, in the `the panel caps match fkBoxClamp` test, replace the `376px` assertion with:

```js
    assert.ok(r.includes('width:min(560px,calc(100vw - 32px))'));
```

- [ ] **Step 4: 改 `.qpop`、`.claims`、`.fpanel`**

In `assets/station/station.css`, on the `.qpop{` rule (line 302), replace `width:min(520px,calc(100vw - 48px));max-height:70vh;` with:

```css
width:min(720px,calc(100vw - 48px));max-height:80vh;
```

In `assets/station/station.css`, replace the head of the `.claims{` rule (line 429) `max-height:170px;overflow:auto;` with `max-height:320px;min-height:80px;resize:vertical;overflow:auto;`, then add this rule on the line after the rule's closing `}` (line 430):

```css
.claims[style*="height"]{max-height:none}
```

In `assets/station/station.css`, on the `.fpanel{` rule (line 934) replace `max-height:360px;` with `max-height:60vh;`.

- [ ] **Step 5: 改 `.fkp`、`.fkr`，加 `.fkf` 的左邊距**

In `assets/station/station.css`, on the `.fkp{` rule (line 1136) replace `width:min(376px,calc(100vw - 64px));` with `width:min(560px,calc(100vw - 32px));min-width:260px;`.

In `assets/station/station.css`, replace the two-line `.fkr{...}` rule (lines 1140-1141) with:

```css
.fkr{position:sticky;bottom:0;display:block;width:24px;height:24px;margin:-24px auto 0 0;cursor:nesw-resize;touch-action:none;border-radius:0 6px 0 12px;--g:var(--muted);
  background:linear-gradient(225deg,transparent 0 36%,var(--g) 36% 43%,transparent 43% 55%,var(--g) 55% 62%,transparent 62% 74%,var(--g) 74% 81%,transparent 81%) var(--inset);
  box-shadow:inset -1px 1px 0 var(--rule2);transition:background-color .15s ease-out}
.fkr:hover{--g:var(--keel);background-color:color-mix(in srgb,var(--keel) 16%,var(--inset))}
```

In `assets/station/station.css`, immediately after the `.fkf .spacer{flex:1}` line (line 1200), insert:

```css
.fkp .fkf{padding-left:36px}
@media (prefers-reduced-motion:reduce){.fkr{transition:none}}
```

- [ ] **Step 6: 加自由填寫與麥克風的規則（桌面通知面板）**

In `assets/station/station.css`, directly after the `.fkp .fkf{padding-left:36px}` rule just added, insert:

```css
.gc .gfree{display:grid;gap:8px;padding:8px 10px 10px;border-radius:8px;background:var(--panel);box-shadow:inset 0 0 0 1px var(--rule2)}
.gc .gfree:focus-within{box-shadow:inset 0 0 0 1px var(--ink2)}
.gc .gfree label{font-size:13px;font-weight:600;color:var(--ink)}
.gc .gfree textarea{display:block;box-sizing:border-box;width:100%;min-height:52px;margin:0;padding:7px 9px;border:0;border-radius:6px;background:var(--inset);color:var(--ink);font:13px/1.55 var(--f-ui);resize:vertical}
.gc .gfree textarea::placeholder{color:var(--muted)}
.gc .gfree textarea:focus-visible{outline:2px solid var(--ink);outline-offset:1px}
.gc .gfree .gfs{all:unset;box-sizing:border-box;cursor:pointer;justify-self:end;padding:6px 14px;border-radius:8px;background:var(--ink);color:var(--panel);font-size:12.5px;font-weight:600}
.gc .gfree .gfs:disabled{opacity:.45;cursor:not-allowed}
.gc .gfree .gfs:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
.gfrow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:start}
.gfrow .gmic{position:relative;display:grid;place-items:center;width:36px;height:36px;margin:0;padding:0;border:0;border-radius:50%;background:var(--panel);box-shadow:inset 0 0 0 1px var(--rule2);color:var(--ink2);cursor:pointer;transition:background-color .18s cubic-bezier(.16,1,.3,1),color .18s cubic-bezier(.16,1,.3,1)}
.gfrow .gmic:hover{color:var(--ink);box-shadow:inset 0 0 0 1px var(--ink2)}
.gfrow .gmic svg{position:relative;z-index:1;width:18px;height:18px}
.gfrow .gmic:focus-visible{outline:2px solid var(--keel);outline-offset:2px}
.gfrow .gmic.on{background:color-mix(in srgb,var(--bad) 14%,var(--panel));color:var(--bad);box-shadow:inset 0 0 0 1.5px var(--bad)}
.gfrow .gmic.on::after{content:"";position:absolute;inset:0;border-radius:50%;background:var(--bad);opacity:0;animation:gmic-p 1.4s cubic-bezier(.16,1,.3,1) infinite}
@keyframes gmic-p{from{transform:scale(1);opacity:.28}to{transform:scale(1.6);opacity:0}}
@media (prefers-reduced-motion:reduce){.gfrow .gmic{transition:none}.gfrow .gmic.on::after{animation:none}}
.gfrow textarea.interim{color:var(--muted)}
.gsay{margin:0;font-size:12px;line-height:1.45;color:var(--muted)}
.gsay.on{color:var(--bad)}
```

- [ ] **Step 7: 加手機底部抽屜與 `.fkg`、`.fkx`**

In `assets/station/station.css`, directly after the `.gsay.on{color:var(--bad)}` rule, insert the sheet. The `@media` block closes with a `}` alone on its line, which the test finds:

```css
.fkg,.fkx{display:none}
/* ---- gate panel: phone bottom sheet ---- */
@media (max-width:599px){
  .fkp{position:fixed;top:auto;right:0;bottom:0;left:0;width:auto!important;height:auto!important;max-width:none;max-height:85dvh!important;border-radius:12px 12px 0 0;z-index:60;overscroll-behavior:contain;box-shadow:inset 0 1px 0 var(--rule2),0 -12px 40px rgba(0,0,0,.3)}
  .fkr{display:none}
  .fkg{display:grid;place-items:center;position:sticky;top:0;z-index:2;height:24px;background:var(--panel);border-radius:12px 12px 0 0;touch-action:none;cursor:grab}
  .fkg i{width:40px;height:5px;border-radius:var(--r-pill);background:var(--muted);opacity:.7}
  .fkp .fkh{position:sticky;top:24px;z-index:2;align-items:center;min-height:48px;padding:0 8px 6px 16px;background:var(--panel)}
  .fkp .fkh b{font-size:16px}
  .fkp .fkh .n{font-size:12px}
  .fkp .fkh .lk{display:inline-flex;align-items:center;min-height:44px;padding:0 10px;font-size:13.5px}
  .fkx{display:grid;place-items:center;width:44px;height:44px;flex:none;border:0;border-radius:var(--r);background:var(--inset);color:var(--ink);cursor:pointer}
  .fkx svg{width:20px;height:20px}
  .fkx:focus-visible{outline:2px solid var(--keel);outline-offset:2px}
  .fkp .fks{padding:14px 16px 8px;font-size:12.5px}
  .fkp .gc{margin:0 12px 6px;padding:14px}
  .fkp .gc .gsrc{font-size:12px}
  .fkp .gc .gq{margin:10px 0 12px;font-size:16.5px;line-height:1.55}
  .fkp .gc .gops{gap:8px}
  .fkp .gc .gop{grid-template-columns:minmax(0,1fr);min-height:56px;padding:12px 14px}
  .fkp .gc .gop b{font-size:15px;line-height:1.45}
  .fkp .gc .gop small{font-size:13px;line-height:1.6}
  .fkp .gc .gop kbd{display:none}
  .fkp .gc .gho{min-height:48px;font-size:14.5px}
  .fkp .gc .ghs{font-size:12.5px;line-height:1.65}
  .fkp .nt{grid-template-columns:24px minmax(0,1fr) 44px;align-items:start;padding:12px 4px 12px 16px}
  .fkp .nt .tt{font-size:14.5px;line-height:1.5}
  .fkp .nt .tb{font-size:13px;line-height:1.65}
  .fkp .nt .tx{grid-row:1/3;align-self:center;width:44px;height:44px;font-size:18px}
  .fkp .fkf{padding:10px 16px calc(12px + env(safe-area-inset-bottom));border-radius:0;font-size:13px}
  .fkp .gc .gfree{gap:10px;padding:12px 14px 14px}
  .fkp .gc .gfree label{font-size:15px}
  .fkp .gc .gfree textarea{min-height:76px;padding:10px 12px;font:16px/1.6 var(--f-ui)}
  .fkp .gc .gfree .gfs{justify-self:stretch;display:grid;place-items:center;min-height:44px;font-size:14.5px}
  .fkp .gc .gfree .gfrow .gmic{width:44px;height:44px}
  .fkp .gc .gfree .gfrow .gmic svg{width:20px;height:20px}
  .fkp .gc .gfree .gsay{font-size:13px}
  .fk:has(.fkp:not([hidden]))::before{content:"";position:fixed;inset:0;z-index:59;background:color-mix(in srgb,var(--ground) 72%,transparent)}
}
```

- [ ] **Step 8: 跑兩個測試，看它們通過**

```sh
node --test tests/station-resize-css.test.js tests/station-bell-header.test.js
```

- [ ] **Step 9: Commit**

```sh
git add assets/station/station.css tests/station-resize-css.test.js tests/station-bell-header.test.js
git commit -m "feat: station panels wider, a visible resize grip, a phone bottom sheet"
```

## Task 2: station.js 通知面板的自由填寫、麥克風、手機抽屜的開關

**Files:**
- Modify: `assets/station/station.js:1893-1965` — `gateCountdownHtml` 畫自由填寫框，`floatHtml` 畫 `.fkg`、`.fkx` 並認得 `fk:shut`
- Modify: `assets/station/station.js:4390-5310` — `drawFloat` 保住輸入、關閉／草稿／送出／麥克風的處理、`answerPost` 把 `[data-gfs]` 算進按鈕
- Modify: `assets/station/i18n.js:255-285` — 新字串的英文
- Test: `tests/station-float-free.test.js`

**Interfaces:**
- Consumes: none（class 規則由 Task 1 寫，這裡只約定名字）
- Produces: 單選 held gate 的標記 `.gfree[data-block="gate-free"] > textarea[data-gfree=<session id>]`、`button[data-gfs]`、`button.gmic[data-mic="gfree-<id>"]`（只有 `SpeechRecognition` 存在時）、`.fkp > .fkg[data-fkg]`、`.fkh > button.fkx[data-fkx]`；`view.pg['<id>:free']`（草稿）與 `view.pg['fk:shut']`

**Dispatch:** implementer, sonnet — 程式碼都在計畫裡；要跑的是自己的測試檔與字串表測試。

- [ ] **Step 1: 先寫會失敗的測試**

Write `tests/station-float-free.test.js`:

```js
'use strict';
// A held single-choice gate in the notification panel also takes a free answer, with a mic where the
// browser has SpeechRecognition, and the panel carries the drag bar and close button the phone sheet uses.
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = { STATION: { serve: true } };
const V = require('../assets/station/station.js');

const NOW = Date.UTC(2026, 8, 26, 1, 0, 0);
const one = [{ question: 'Q?', header: 'h', multiSelect: false, options: [{ label: 'A', description: '' }, { label: 'B', description: '' }] }];
const two = [one[0], { question: 'R?', header: 'r', multiSelect: false, options: [{ label: 'C', description: '' }] }];
const held = (questions) => ({ id: 's1', root: '/r', project: 'p', stage: 'build', task: 't', pending: { questions, at: NOW - 10000, until: NOW + 50000 } });

test('a single-choice held gate draws a free-text box and a send button under its options', () => {
    const html = V.gateCountdownHtml(held(one), NOW, {});
    assert.match(html, /<div class="gfree" data-block="gate-free">/);
    assert.match(html, /<textarea id="gfree-s1" data-gfree="s1"/);
    assert.match(html, /<button type="button" class="gfs" data-gfs disabled>/);
    assert.ok(html.indexOf('data-gop="1"') < html.indexOf('data-gfree="s1"'), 'the box sits after the options');
});

test('no mic button without SpeechRecognition; with it, a data-mic button for the box', () => {
    delete global.window.SpeechRecognition;
    assert.doesNotMatch(V.gateCountdownHtml(held(one), NOW, {}), /data-mic/);
    global.window.SpeechRecognition = function () {};
    try {
        const html = V.gateCountdownHtml(held(one), NOW, {});
        assert.match(html, /<button type="button" class="gmic" data-mic="gfree-s1" aria-pressed="false"/);
        assert.match(html, /<p class="gsay" role="status">/);
    } finally {
        delete global.window.SpeechRecognition;
    }
});

test('a draft kept in view.pg comes back in the box and enables the send button', () => {
    const html = V.gateCountdownHtml(held(one), NOW, { 's1:free': '我要的答案' });
    assert.match(html, /<textarea id="gfree-s1" data-gfree="s1"[^>]*>我要的答案<\/textarea>/);
    assert.match(html, /data-gfs>/);
});

test('a send in flight disables the send button; a two-question gate keeps the full form with no free box', () => {
    const busy = V.gateCountdownHtml(held(one), NOW, { 's1:free': 'x', 's1:send': { gate: NOW + 50000, busy: true, cls: 'wait', text: '送出中…' } });
    assert.match(busy, /data-gfs disabled>/);
    assert.doesNotMatch(V.gateCountdownHtml(held(two), NOW, {}), /data-gfree/);
});

test('the panel carries the drag bar and a close button for the phone sheet', () => {
    const html = V.floatHtml([held(one)], [], false, NOW, {}, 'granted');
    assert.match(html, /<div class="fkg" aria-hidden="true" data-fkg><i><\/i><\/div>/);
    assert.match(html, /<button type="button" class="fkx" data-fkx aria-label="關閉通知與 gate">/);
});

test('a held gate keeps the panel open unless it was shut, and a shut panel is hidden', () => {
    assert.doesNotMatch(V.floatHtml([held(one)], [], false, NOW, {}, 'granted'), /id="fkp"[^>]* hidden/);
    assert.match(V.floatHtml([held(one)], [], false, NOW, { 'fk:shut': true }, 'granted'), /id="fkp"[^>]* hidden/);
    assert.match(V.floatHtml([held(one)], [], true, NOW, { 'fk:shut': true }, 'granted'), /aria-expanded="true"/);
});
```

- [ ] **Step 2: 跑它，看它失敗**

```sh
node --test tests/station-float-free.test.js
```

- [ ] **Step 3: 在 `assets/station/station.js` 加自由填寫框與 `micOk`**

In `assets/station/station.js`, directly above `function gateCountdownHtml(s, now, picked) {` (line 1896, and above its leading comment is fine too), add:

```js
    function micOk() { return Boolean(w && (w.SpeechRecognition || w.webkitSpeechRecognition)); }
    var MIC_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'
        + '<path d="M12 19v3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><rect x="9" y="2" width="6" height="13" rx="3"/></svg>';
    // The free answer under a single-choice held gate's buttons: the text is the answer, sent through
    // the same /answer POST. `lock` is ' disabled' while a send is out or after it landed.
    function gateFreeHtml(s, picked, lock) {
        var id = 'gfree-' + s.id, draft = String((picked || {})[s.id + ':free'] || '');
        return '<div class="gfree" data-block="gate-free"><label for="' + esc(id) + '">' + loc('tune.freeLabel', '或自己寫答案') + '</label>'
            + '<div class="gfrow"><textarea id="' + esc(id) + '" data-gfree="' + esc(s.id) + '" rows="2" placeholder="' + loc('tune.freePlaceholder', '上面都不對的話，寫下你要的答案') + '">' + esc(draft) + '</textarea>'
            + (micOk() ? '<button type="button" class="gmic" data-mic="' + esc(id) + '" aria-pressed="false" aria-label="' + loc('tune.micLabel', '用講的寫答案') + '" title="' + loc('tune.micLabel', '用講的寫答案') + '">' + MIC_SVG + '</button>' : '')
            + '</div>' + (micOk() ? '<p class="gsay" role="status">' + loc('tune.micHint', '想用講的：按麥克風，講完可以改字再送出') + '</p>' : '')
            + '<button type="button" class="gfs" data-gfs' + (draft.trim() && !lock ? '' : ' disabled') + '>' + loc('tune.freeSend', '送出答案') + '</button></div>';
    }
```

In `assets/station/station.js`, in `gateCountdownHtml`, replace the single-choice branch's closing `}).join('') + '</div>'` with a version that puts the free box inside the `.gops` container:

```js
                }).join('') + gateFreeHtml(s, picked, lock) + '</div>'
```

- [ ] **Step 4: 在 `floatHtml` 畫 `.fkg`、`.fkx`，認得 `fk:shut`**

In `assets/station/station.js`, in `floatHtml`, after the `lit` line add the open flag, and use it in place of both `open || held.length` expressions (the `hidden` test on the `<section>` and the bell's `aria-expanded`):

```js
        var shown = Boolean(open || (held.length && !(picked && picked['fk:shut'])));
```

In `assets/station/station.js`, in `floatHtml`, make the section's opening `(open || held.length ? '' : ' hidden')` read `(shown ? '' : ' hidden')`, make the bell's `Boolean(open || held.length)` read `shown`, and put the drag bar first in the section and the close button last in `.fkh`:

```js
        return '<section class="fkp" id="fkp" aria-label="' + loc('tune.notificationsAndGate', '通知與 gate') + '"' + (shown ? '' : ' hidden') + fkBoxStyle(box) + '>'
            + '<div class="fkg" aria-hidden="true" data-fkg><i></i></div>'
            + '<div class="fkh"><b>' + loc('tune.notificationsAndGate', '通知與 gate') + '</b><span class="n">' + loc('tune.nItems', '{n} 件', { n: n }) + '</span><span class="spacer"></span>'
            + (all.length ? '<button class="lk" type="button" data-note-clear>' + loc('tune.clearNotifications', '清掉通知') + '</button>' : '')
            + '<button type="button" class="fkx" data-fkx aria-label="' + loc('tune.closePanel', '關閉通知與 gate') + '"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button></div>'
```

- [ ] **Step 5: `drawFloat` 保住輸入，`fk:shut` 在 gate 清掉時刪除**

In `assets/station/station.js`, replace `function drawFloat() {` through its closing brace (about line 4391) with:

```js
    // The poll repaints this every few seconds; a box being typed in or a mic that is listening would
    // lose its place, so only a click (`force`) repaints then.
    function drawFloat(force) {
        var fk = doc.getElementById('fk');
        if (!fk) return;
        var ae = doc.activeElement;
        if (!force && (fkRec || (ae && ae.getAttribute && ae.getAttribute('data-gfree') !== null))) return;
        var held = S.sessions.some(function (s) { return s.pending && s.pending.questions && s.pending.questions.length; });
        if (!held) delete view.pg['fk:shut'];
        var old = doc.getElementById('fkp'), top = old ? old.scrollTop : 0;
        fk.innerHTML = floatHtml(S.sessions, view.notes, view.fkOpen, S.serve ? Date.now() : NOW, view.pg, w.Notification ? w.Notification.permission : 'denied', view.fkBox, view.gone);
        var p = doc.getElementById('fkp'); if (p && top) p.scrollTop = top;
        fk.className = 'fk' + (held ? ' hasgate' : '');
    }
```

In `assets/station/station.js`, because `fkRec` is read in `drawFloat` and assigned later, declare it above `drawFloat`:

```js
    var fkRec = null;
```

- [ ] **Step 6: 點擊路徑強制重畫，加關閉、草稿、送出、麥克風、拖曳條**

In `assets/station/station.js`, in the click handler, change the three `drawFloat();` calls inside the `[data-fkb]`, `[data-note-x]` and `[data-note-clear]` branches to `drawFloat(true);`, and replace the `[data-fkb]` branch's `view.fkOpen = !wasOpen;` line with:

```js
            view.fkOpen = !wasOpen;
            if (view.fkOpen) delete view.pg['fk:shut'];
```

In `assets/station/station.js`, directly above the click handler's `var gop = e.target.closest('[data-gop]');` line, add the close and the free-send branches:

```js
        if (e.target.closest('[data-fkx]') || e.target.id === 'fk') {
            fkClose();
            return;
        }
        var gmic = e.target.closest('#fk [data-mic]');
        if (gmic) {
            if (fkRec) { fkRec.stop(); return; }
            var gbox = doc.getElementById(gmic.getAttribute('data-mic'));
            var gsay = gmic.closest('.gfree').querySelector('.gsay');
            fkRec = fkListen(gmic, gbox, function (text, on) { if (gsay) { gsay.textContent = text; gsay.className = 'gsay' + (on ? ' on' : ''); } });
            return;
        }
        var gfs = e.target.closest('#fk [data-gfs]');
        if (gfs) {
            var gtext = gfs.closest('.gfree').querySelector('[data-gfree]').value.trim();
            if (!gtext) return;
            gatePost(gfs.closest('.gc'), function (form, who) {
                var q = who.pending.questions[0], a = {};
                a[q.question] = gtext;
                form.set('answers', JSON.stringify(a));
            }, loc('cmp.sentColon', '已送出：'));
            return;
        }
```

In `assets/station/station.js`, right after the `window` `resize` listener that calls `fkApply()` (the block ending near line 4450), add the shared close, the voice helper, the draft listener and the drag-down-to-close bar:

```js
    // Close the panel, also when a held gate would keep it open: `fk:shut` stands until the gate is gone.
    function fkClose() {
        var heldNow = S.sessions.some(function (s) { return s.pending && s.pending.questions && s.pending.questions.length; });
        if (view.fkOpen) view.notes = readAll(view.notes);
        view.fkOpen = false;
        if (heldNow) view.pg['fk:shut'] = true;
        drawFloat(true);
    }
    // Voice fills the box and never sends. The same approach as assets/station/mobile.js `listen`.
    function fkListen(btn, box, say) {
        var SR = w.SpeechRecognition || w.webkitSpeechRecognition;
        if (!SR || !box) return null;
        var base = box.value ? box.value.replace(/\s*$/, ' ') : '', failed = false, rec = new SR();
        rec.lang = 'zh-TW';
        rec.interimResults = true;
        rec.continuous = true;
        btn.classList.add('on');
        btn.setAttribute('aria-pressed', 'true');
        say(loc('tune.micOn', '聆聽中… 再按一次停止'), true);
        rec.onresult = function (e) {
            var fin = '', mid = '';
            for (var i = 0; i < e.results.length; i++) {
                if (e.results[i].isFinal) fin += e.results[i][0].transcript; else mid += e.results[i][0].transcript;
            }
            box.value = base + fin + mid;
            box.classList.toggle('interim', Boolean(mid));
            if (w.Event) box.dispatchEvent(new w.Event('input', { bubbles: true }));
        };
        rec.onerror = function (e) {
            failed = true;
            say(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? loc('tune.micDenied', '沒有麥克風權限：到瀏覽器設定允許') : loc('tune.micMissed', '沒聽清楚：再按一次麥克風'), false);
        };
        rec.onend = function () {
            btn.classList.remove('on');
            btn.setAttribute('aria-pressed', 'false');
            box.classList.remove('interim');
            if (!failed) say(box.value.trim() ? loc('tune.micDone', '聽好了：可以改字，按送出才會送') : '', false);
            fkRec = null;
        };
        rec.start();
        return rec;
    }
    doc.addEventListener('input', function (e) {
        var t = e.target && e.target.closest ? e.target.closest('#fk [data-gfree]') : null;
        if (!t) return;
        view.pg[t.getAttribute('data-gfree') + ':free'] = t.value;
        var b = t.closest('.gc').querySelector('[data-gfs]');
        if (b) b.disabled = !t.value.trim();
    });
    var fkSheetY = null;
    doc.addEventListener('pointerdown', function (e) {
        if (e.target && e.target.closest && e.target.closest('#fk [data-fkg]')) fkSheetY = e.clientY;
    });
    w.addEventListener('pointerup', function (e) {
        var down = fkSheetY;
        fkSheetY = null;
        if (down !== null && e.clientY - down > 60) fkClose();
    });
```

- [ ] **Step 7: `answerPost` 把送出鈕算進按鈕，加字串的英文**

In `assets/station/station.js`, in `answerPost` (about line 5305), replace the `btns` selector `'[data-gop],[data-gho],[data-answer]'` with:

```js
'[data-gop],[data-gho],[data-answer],[data-gfs]'
```

In `assets/station/i18n.js`, directly after the `'tune.answer': 'Answer',` entry (line 261), add:

```js
            'tune.freeLabel': 'Or write your own answer',
            'tune.freePlaceholder': 'If none of the above fits, write the answer you want',
            'tune.freeSend': 'Send answer',
            'tune.micLabel': 'Speak your answer',
            'tune.micHint': 'To speak: tap the mic, then edit the text before sending',
            'tune.micOn': 'Listening… tap again to stop',
            'tune.micDone': 'Heard: edit it if you like; only Send sends',
            'tune.micDenied': 'No microphone permission: allow it in the browser settings',
            'tune.micMissed': 'Did not catch that: tap the mic again',
            'tune.closePanel': 'Close notifications & gate',
```

- [ ] **Step 8: 跑自己的測試與字串表測試，看它們通過**

```sh
node --test tests/station-float-free.test.js tests/station-float.test.js tests/station-gate-send-render.test.js tests/station-i18n.test.js
```

- [ ] **Step 9: Commit**

```sh
git add assets/station/station.js assets/station/i18n.js tests/station-float-free.test.js
git commit -m "feat: the notification panel takes a free answer with a mic, and closes as a phone sheet"
```

## Task 3: gate-frame 答完收右欄、自由填寫的麥克風

**Files:**
- Modify: `assets/station/gate-frame.js` — `frame()` 沒有 `gateAt`／`pending` 就不畫 `.gt-side`；`freeHtml` 加麥克風鈕、說明行；聆聽的處理
- Modify: `assets/station/gate-frame.css` — `.gt-one` 一欄、gate 頁的麥克風尺寸
- Modify: `tests/station-gate-free.test.js` — 它的 `S` 補 `gateAt`
- Test: `tests/station-gate-frame-one.test.js`

**Interfaces:**
- Consumes: none（`.gfrow`、`.gmic`、`.gsay` 的基本規則由 Task 1 寫在 `station.css`，gate 頁本來就載入它）
- Produces: `frame()` 在 session 沒有 `gateAt` 也沒有 `pending` 時 `.gt-grid` 帶 `gt-one` 且沒有 `.gt-side`；`freeHtml` 在 `SpeechRecognition` 存在時帶 `button.gmic[data-gq-mic]`

**Dispatch:** implementer, sonnet — 改動小、程式碼在計畫裡。

- [ ] **Step 1: 先寫會失敗的測試**

Write `tests/station-gate-frame-one.test.js`:

```js
'use strict';
// The gate page once the gate is answered: no side column, one column. And the free answer's mic.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { page } = require('./station-module.js');

const SID = 'dddddddd-4444-4444-8444-444444444444';
const S = { id: SID, task: 'Gate one', project: 'fankeel', state: 'live', stage: 'plan', route: ['survey', 'plan', 'build', 'land'] };
const GATE = { stage: 'plan', gate: { questions: [{ question: 'Go to build?', header: 'plan', options: [{ label: 'build', description: 'd' }] }] } };
const boot = (extra) => { const p = page(['gate-frame.js'], { sessions: [S] }); Object.assign(p.win, extra); return p.M['gate-frame.js']; };
const args = (session, answer) => ({ session, gate: GATE, tasks: [], reportHtml: '<p>R</p>', shellsHtml: '', answer });
const asked = { question: 'Go to build?', send() {} };

test('a session with neither gateAt nor pending draws one column and no side', () => {
    const html = boot().frame(args(S, null));
    assert.doesNotMatch(html, /gt-side/);
    assert.doesNotMatch(html, /data-block="gate-question"/);
    assert.match(html, /<div class="gt-grid gt-one" data-block="gate-columns">/);
});

test('gateAt, or a pending gate, keeps the side column', () => {
    const waiting = boot().frame(args(Object.assign({}, S, { gateAt: 1 }), null));
    assert.match(waiting, /<aside class="gt-side"/);
    assert.doesNotMatch(waiting, /gt-one/);
    assert.match(boot().frame(args(Object.assign({}, S, { pending: { questions: [] } }), null)), /<aside class="gt-side"/);
});

test('the free answer has a mic only where SpeechRecognition exists', () => {
    const held = Object.assign({}, S, { gateAt: 1 });
    assert.doesNotMatch(boot().frame(args(held, asked)), /data-gq-mic/);
    const html = boot({ SpeechRecognition: function () {} }).frame(args(held, asked));
    assert.match(html, /<div class="gfrow"><textarea id="gq-free"/);
    assert.match(html, /<button type="button" class="gmic" data-gq-mic aria-pressed="false"/);
    assert.match(html, /<p class="gsay" id="gq-say" role="status">/);
});

test('gate-frame.css gives the single column and the gate page mic their rules', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'gate-frame.css'), 'utf8');
    assert.match(css, /\.gt-grid\.gt-one\{grid-template-columns:minmax\(0,1fr\)\}/);
    assert.match(css, /\.gt-free \.gfrow \.gmic\{width:40px;height:40px\}/);
});
```

- [ ] **Step 2: 跑它，看它失敗**

```sh
node --test tests/station-gate-frame-one.test.js
```

- [ ] **Step 3: 先補 `tests/station-gate-free.test.js` 的 `S`**

In `tests/station-gate-free.test.js`, replace the `const S = {...}` line (line 13) with the same object plus `gateAt`:

```js
const S = { id: SID, task: 'Gate free', project: 'fankeel', state: 'live', stage: 'plan', route: ['survey', 'plan', 'build', 'land'], gateAt: 1 };
```

- [ ] **Step 4: `frame()` 沒有 `gateAt`／`pending` 就不畫右欄**

In `assets/station/gate-frame.js`, in `frame()`, replace the `return '<main class="fm gt-frame"...` expression's grid part so the side is conditional:

```js
        var held = Boolean(s.gateAt || s.pending);
        return '<main class="fm gt-frame" data-block="gate-frame">' + head(s, stage) + (o.shellsHtml || '')
            + '<div class="gt-grid' + (held ? '' : ' gt-one') + '" data-block="gate-columns"><div class="gt-main" data-block="gate-main">' + (o.reportHtml || '') + '</div>'
            + (held ? '<aside class="gt-side" data-block="gate-side"><div class="gt-pin">' + ask(g, stage, st) + '</div></aside>' : '') + '</div></main>';
```

- [ ] **Step 5: `freeHtml` 加麥克風與說明行，加聆聽的處理**

In `assets/station/gate-frame.js`, add the English strings to `EN` after `'gf.send': 'Send answer',`:

```js
        'gf.mic': 'Speak your answer',
        'gf.micStop': 'Stop listening',
        'gf.micHint': 'To speak: tap the mic, then edit the text before sending',
        'gf.micOn': 'Listening… tap again to stop',
        'gf.micDone': 'Heard: edit it if you like; only Send sends',
        'gf.micDenied': 'No microphone permission: allow it in the browser settings',
        'gf.micMissed': 'Did not catch that: tap the mic again',
```

In `assets/station/gate-frame.js`, replace `freeHtml` with a version that wraps the textarea in `.gfrow`, adds the mic and the listening line, and keeps the listening state in `state(key)`:

```js
    function micOk() { return Boolean(w && (w.SpeechRecognition || w.webkitSpeechRecognition)); }
    var MIC_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'
        + '<path d="M12 19v3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><rect x="9" y="2" width="6" height="13" rx="3"/></svg>';
    function freeHtml(st) {
        var said = st.said, wait = busy(st), on = Boolean(st.mic);
        var line = said ? sentLine(said.kind, said.text) : '';
        var label = on ? loc('gf.micStop', '停止聆聽') : loc('gf.mic', '用講的寫答案');
        return '<form class="gt-free" data-block="gate-free" onsubmit="return false"><label class="gt-free-l" for="gq-free">' + loc('gf.free', '或寫自己的答案') + '</label>'
            + '<div class="gfrow"><textarea id="gq-free" class="gt-free-t" data-gq-free rows="3" aria-describedby="gq-free-h">' + esc(st.free) + '</textarea>'
            + (micOk() ? '<button type="button" class="gmic' + (on ? ' on' : '') + '" data-gq-mic aria-pressed="' + (on ? 'true' : 'false') + '" aria-label="' + label + '" title="' + label + '">' + MIC_SVG + '</button>' : '') + '</div>'
            + '<p class="gt-free-h" id="gq-free-h">' + loc('gf.freeHint', '會當成這題的答案送出，等同選「其他」。') + '</p>'
            + (micOk() ? '<p class="gsay' + (on ? ' on' : '') + '" id="gq-say" role="status">' + esc(st.micSay || loc('gf.micHint', '想用講的：按麥克風，講完可以改字再送出')) + '</p>' : '')
            + '<div class="gt-free-a"><button type="button" class="gq-pick gt-send" data-gq-send' + (wait ? ' disabled' : '') + '>' + loc('gf.send', '送出答案') + '</button>'
            + '<p id="gq-sent" class="gt-sent' + (said ? ' ' + said.kind : '') + '" role="status" aria-live="polite">' + esc(line) + '</p></div></form>';
    }
    // Voice fills the field and never sends. The page repaints every 5 s and replaces the field, so the
    // box and the button are looked up afresh each time and the listening state lives in `state(key)`.
    var HEARD = null;
    function micPaint() {
        if (!doc || !doc.querySelector || CUR.key === null) return;
        var st = state(CUR.key), btn = doc.querySelector('[data-gq-mic]'), line = doc.getElementById ? doc.getElementById('gq-say') : null;
        if (btn) {
            btn.classList.toggle('on', Boolean(st.mic));
            btn.setAttribute('aria-pressed', st.mic ? 'true' : 'false');
        }
        if (line) {
            line.textContent = st.micSay || loc('gf.micHint', '想用講的：按麥克風，講完可以改字再送出');
            line.classList.toggle('on', Boolean(st.mic));
        }
    }
    function micToggle() {
        if (HEARD) { HEARD.stop(); return; }
        var SR = w && (w.SpeechRecognition || w.webkitSpeechRecognition), box = doc && doc.querySelector ? doc.querySelector('[data-gq-free]') : null;
        if (!SR || !box || CUR.key === null) return;
        var st = state(CUR.key), base = box.value ? box.value.replace(/\s*$/, ' ') : '', failed = false, rec = new SR();
        rec.lang = 'zh-TW';
        rec.interimResults = true;
        rec.continuous = true;
        st.mic = true;
        st.micSay = loc('gf.micOn', '聆聽中… 再按一次停止');
        micPaint();
        rec.onresult = function (e) {
            var fin = '', mid = '', f = doc.querySelector('[data-gq-free]');
            for (var i = 0; i < e.results.length; i++) {
                if (e.results[i].isFinal) fin += e.results[i][0].transcript; else mid += e.results[i][0].transcript;
            }
            if (!f) return;
            f.value = base + fin + mid;
            f.classList.toggle('interim', Boolean(mid));
            if (w.Event) f.dispatchEvent(new w.Event('input', { bubbles: true }));
        };
        rec.onerror = function (e) {
            failed = true;
            st.micSay = e.error === 'not-allowed' || e.error === 'service-not-allowed' ? loc('gf.micDenied', '沒有麥克風權限：到瀏覽器設定允許') : loc('gf.micMissed', '沒聽清楚：再按一次麥克風');
        };
        rec.onend = function () {
            st.mic = false;
            HEARD = null;
            if (!failed) st.micSay = st.free.trim() ? loc('gf.micDone', '聽好了：可以改字，按送出才會送') : '';
            micPaint();
        };
        HEARD = rec;
        rec.start();
    }
```

In `assets/station/gate-frame.js`, in `listen()`'s click handler, add the mic branch next to the others:

```js
            var m = t.closest('[data-gq-more]'), p = t.closest('[data-gq-pick]'), s = t.closest('[data-gq-send]'), mc = t.closest('[data-gq-mic]');
            if (m) more(Number(m.getAttribute('data-gq-more')));
            else if (p) pick(Number(p.getAttribute('data-gq-pick')));
            else if (s) send();
            else if (mc) micToggle();
```

In `assets/station/gate-frame.css`, directly after the `@media (max-width:1180px){.gt-grid{...}...}` line, add:

```css
.gt-grid.gt-one{grid-template-columns:minmax(0,1fr)}
```

In `assets/station/gate-frame.css`, at the end of the free-text block (after `.gt-sent.bad{color:var(--signal-ink)}`), add:

```css
.gt-free .gfrow .gmic{width:40px;height:40px}
.gt-free .gfrow .gt-free-t{min-height:64px}
```

- [ ] **Step 6: 跑兩個 gate-frame 測試與字串測試，看它們通過**

```sh
node --test tests/station-gate-frame-one.test.js tests/station-gate-free.test.js tests/station-gate-frame.test.js
```

- [ ] **Step 7: Commit**

```sh
git add assets/station/gate-frame.js assets/station/gate-frame.css tests/station-gate-free.test.js tests/station-gate-frame-one.test.js
git commit -m "feat: the gate page drops its side column once answered, and its free answer gets a mic"
```

## Task 4: /m 手機頁的閱讀字級、header、gate 與報告

**Files:**
- Modify: `assets/station/mobile.js` — 首頁 header 分兩行；gate 對話頁的置頂問題、報告折疊、「看選項」；`gateCard`（約 410 行）的 form 加 `gopts` class
- Modify: `assets/station/mobile.css` — 手機 frame 2、3、4 的規則
- Test: `tests/station-mobile-resize.test.js`

**Interfaces:**
- Consumes: none
- Produces: 首頁 `<header class="ab ab2">` 內有 `.ab-1`（標題、數量、歷史）與 `.ab-2`（`.host`、`.subs`）；gate 狀態的對話頁在 header 與 `.cv` 之間有 `.gpin`；gate 狀態最後一則 assistant 訊息帶 `rep` 並有 `button.rep-more[data-act="more"]`；`data-act="gate"` 的「看選項」按鈕；`STR` 新增 `gpin.go`、`rep.more`、`rep.less`

**Dispatch:** implementer, sonnet — 標記與 CSS 都在計畫裡，取自核准的 mockup。

- [ ] **Step 1: 先寫會失敗的測試**

Write `tests/station-mobile-resize.test.js`:

```js
'use strict';
// The /m page after the approved mockup's phone frames 2-4: a two-line header whose host chip is not cut,
// the gate question pinned above the report, the report folded to six lines, and the reading sizes.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const P = require('../assets/station/mobile.js');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'mobile.css'), 'utf8');
const NOW = new Date(2026, 9, 26, 11, 2).getTime();
const Q = [{ question: '核准這份 design？', header: 'design', multiSelect: false, options: [{ label: '核准 (Recommended)', description: 'a' }, { label: '改', description: 'b' }] }];
const row = (id, state) => ({ id, root: '/w', task: 'task ' + id, project: 'proj', stage: 'build', route: [], gate: state === 'gate', updated: NOW, state, attached: false, background: [], last: null });
const HOME = { host: 'sh-pro6000', at: NOW, gates: [], tasks: [row('aaaaaaaa-1', 'running')], done: [], notify: { app: 'ntfy://x/y', web: 'https://x/y' } };
const sess = (state, extra) => Object.assign({ id: 'aaaaaaaa-2', root: '/w', task: 't', project: 'proj', stage: 'design', route: [], state, attached: false, waiting: null, chat: [], gate: null, background: [], at: NOW }, extra);
const gate = (chat) => sess('gate', { chat, gate: { questions: Q, since: NOW - 60e3, until: NOW + 240e3 } });
const APP = { mode: 'app' };

test('home header: two lines, the title and history first, the host chip and the subscribe pair second', () => {
    const html = P.screen(HOME, P.parseRoute('#/'), NOW, APP);
    assert.match(html, /<header class="ab ab2"><div class="ab-1"><h1>/);
    assert.ok(html.indexOf('class="ha-hist"') < html.indexOf('class="ab-2"'), 'history is on the first line');
    assert.ok(html.indexOf('class="ab-2"') < html.indexOf('class="host"'), 'the host is on the second');
    assert.match(html, /<span class="subs"><a class="ha-subscribe"/);
});

test('a gate conversation pins the question between the header and the log, with a 看選項 button', () => {
    const html = P.screen(HOME, P.parseRoute('#/s/aaaaaaaa-2'), NOW, APP, gate([]));
    const pin = html.indexOf('class="gpin"');
    assert.ok(html.indexOf('</header>') < pin && pin < html.indexOf('class="cv"'));
    assert.match(html, /<p class="gpin-q" id="gpin-q">核准這份 design？<\/p>/);
    assert.match(html, /<button type="button" class="gpin-go" data-act="gate">看選項/);
});

test('the last assistant message of a gate folds, and expands from ui.rep', () => {
    const chat = [{ role: 'assistant', text: '報告第一段\n\n報告第二段', at: NOW }];
    const folded = P.screen(HOME, P.parseRoute('#/s/aaaaaaaa-2'), NOW, APP, gate(chat));
    assert.match(folded, /<div class="msg ai rep">/);
    assert.match(folded, /<button type="button" class="rep-more" data-act="more" aria-expanded="false">展開完整報告<\/button>/);
    const open = P.screen(HOME, P.parseRoute('#/s/aaaaaaaa-2'), NOW, Object.assign({ rep: true }, APP), gate(chat));
    assert.match(open, /<div class="msg ai rep open">/);
    assert.match(open, /aria-expanded="true">收起報告</);
});

test('a conversation that is not at a gate has no pin and no fold', () => {
    const html = P.screen(HOME, P.parseRoute('#/s/aaaaaaaa-2'), NOW, APP, sess('running', { chat: [{ role: 'assistant', text: 'x', at: NOW }] }));
    assert.doesNotMatch(html, /gpin|rep-more/);
});

test('both languages carry the new strings', () => {
    for (const k of ['gpin.go', 'rep.more', 'rep.less']) {
        assert.ok(P.STR.zh[k] && P.STR.en[k], k);
    }
});

test('mobile.css has the phone reading sizes, the two-line header and the pinned question', () => {
    for (const r of ['body.m .ha-t{', 'body.m .ha-prev{', 'body.m .ab.ab2{', 'body.m .ab2 .host{', 'body.m .gpin{', 'body.m .gpin-q{', 'body.m .rep .bub{', 'body.m .rep.open .bub{', 'body.m .gopts .opt{']) {
        assert.ok(CSS.includes('\n' + r), r);
    }
    assert.match(CSS, /body\.m \.ha-t\{font-size:16px;line-height:1\.55/);
    assert.match(CSS, /body\.m \.gopts \.opt\{min-height:64px/);
});
```

- [ ] **Step 2: 跑它，看它失敗**

```sh
node --test tests/station-mobile-resize.test.js
```

- [ ] **Step 3: 字串、首頁 header**

In `assets/station/mobile.js`, in the `zh` table after `'gc.head': '{stage} gate', 'gc.left': '剩 {t} · 之後轉回電腦',` (line 42), add:

```js
            'gpin.go': '看選項', 'rep.more': '展開完整報告', 'rep.less': '收起報告',
```

In `assets/station/mobile.js`, in the `en` table after `'gc.head': '{stage} gate', 'gc.left': '{t} left · then back to the desktop',` (line 77), add:

```js
            'gpin.go': 'See options', 'rep.more': 'Show the full report', 'rep.less': 'Collapse the report',
```

In `assets/station/mobile.js`, in `homeHtml`, replace the `return '<div class="pg" data-block="m-home-a"><header class="ab">...` expression (lines 347-349) with:

```js
        return '<div class="pg" data-block="m-home-a"><header class="ab ab2"><div class="ab-1"><h1>' + t('home.title') + '</h1>' + (tasks.length ? '<span class="n">' + tasks.length + '</span>' : '')
            + '<span class="sp"></span><a class="ha-hist" href="#/done" aria-label="' + t('home.hist') + '" title="' + t('home.hist') + '">' + ic('hist') + '</a></div>'
            + '<div class="ab-2">' + hostHtml(m) + (sub ? '<span class="subs">' + sub + '</span>' : '') + '</div></header>'
            + '<div class="ha-body">' + body + '</div></div>';
```

- [ ] **Step 4: 置頂問題與報告折疊**

In `assets/station/mobile.js`, replace `bubble` with a version that takes a fold flag:

```js
    function bubble(role, text, at, sent, fold) {
        var when = num(at) ? ' <time>' + hm(at) + '</time>' : '';
        if (role === 'assistant') {
            var more = fold ? '<button type="button" class="rep-more" data-act="more" aria-expanded="' + (fold.open ? 'true' : 'false') + '">' + t(fold.open ? 'rep.less' : 'rep.more') + '</button>' : '';
            return '<div class="msg ai' + (fold ? ' rep' + (fold.open ? ' open' : '') : '') + '"><span class="who">' + t('who.ai') + when + '</span><div class="bub">' + prose(text) + '</div>' + more + '</div>';
        }
        var pc = role === 'desktop';
        return '<div class="msg me ' + (pc ? 'pc' : 'ph') + '"><span class="who">' + ic(pc ? 'laptop' : 'phone') + t(pc ? 'who.pc' : 'who.ph') + when + '</span>'
            + '<p class="bub">' + esc(text) + '</p>' + (sent ? '<span class="sent">' + sent + '</span>' : '') + '</div>';
    }
```

In `assets/station/mobile.js`, in `cvInner`, after the `lastPhone` loop add the last-assistant index, and pass the fold in the message branch:

```js
        var lastAi = -1;
        turns.forEach(function (g, i) { if (g.kind === 'msg' && g.role === 'assistant') lastAi = i; });
        var fold = function (i) { return p.state === 'gate' && i === lastAi ? { open: Boolean(u.rep) } : null; };
```

In `assets/station/mobile.js`, change the line `return bubble(g.role, g.text, g.at, i === lastPhone ? ic('check') + t('chat.sent') : '');` in `cvInner` to:

```js
            return bubble(g.role, g.text, g.at, i === lastPhone ? ic('check') + t('chat.sent') : '', fold(i));
```

In `assets/station/mobile.js`, directly above `function chatHtml(`, add the pin:

```js
    // The question stays under the header while the report scrolls; 看選項 jumps to the answers.
    function gpinHtml(p, at) {
        var g = p.gate || {}, q = (g.questions || [])[0];
        if (!q) return '';
        return '<div class="gpin" role="region" aria-labelledby="gpin-q"><p class="gpin-h">' + ic('gate') + t('gc.head', { stage: esc(p.stage) }) + '<span class="sp"></span>'
            + (num(g.until) ? '<span class="left">' + t('gc.left', { t: clock(g.until - at) }) + '</span>' : '') + '</p>'
            + '<p class="gpin-q" id="gpin-q">' + esc(q.question || '') + '</p>'
            + '<button type="button" class="gpin-go" data-act="gate">' + t('gpin.go') + ic('chev') + '</button></div>';
    }
```

In `assets/station/mobile.js`, in `chatHtml`, put the pin between the header and `.cv`; replace the `+ '</header>'` + `'<div class="cv" ...` pair:

```js
            + '<div><p class="ch-t">' + esc(p.task) + '</p><p class="ch-m">' + esc(p.project) + stw(p.stage) + chip(p) + '</p></div>' + side + '</header>'
            + (p.state === 'gate' && p.gate ? gpinHtml(p, at) : '')
            + '<div class="cv" role="log" aria-label="' + t('chat.log') + '">' + cvInner(p, at, u) + '</div>'
```

In `assets/station/mobile.js`, in the click handler's `data-act` chain, after the `steps` branch add:

```js
            else if (what === 'more') {
                st.ui.rep = !st.ui.rep;
                if (st.P) patch(); else draw();
            } else if (what === 'gate') {
                var gcard = d.getElementById('gate-card');
                if (gcard && gcard.scrollIntoView) gcard.scrollIntoView({ block: 'start' });
            }
```

and in the `hashchange` listener, after `st.ui.note = '';` add `st.ui.rep = false;`.

- [ ] **Step 5: `mobile.css`**

In `assets/station/mobile.css`, directly before the line `@media (prefers-reduced-motion:reduce){` (after the `@media (min-width:601px){...}` block), add the three frames:

```css
/* ---- the approved mockup's phone frames 2-4 ---- */
body.m .ha-body{padding:0 12px 24px}
body.m .ha-sum{margin:4px 4px 0;font-size:15px}
body.m .ha-gh{margin:20px 4px 8px;font-size:13.5px}
body.m .ha-row{grid-template-columns:40px minmax(0,1fr);gap:0 12px;min-height:72px;padding:14px 16px 14px 12px}
body.m .av{width:40px;height:40px}
body.m .ha-main{gap:6px}
body.m .ha-t{font-size:16px;line-height:1.55;letter-spacing:.01em;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
body.m .ha-top time{font-size:12.5px}
body.m .ha-sub{gap:6px 10px;font-size:12.5px}
body.m .ha-prev{font-size:15px;line-height:1.7;white-space:normal;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
body.m .ha-q{gap:12px}
body.m .ha-q>span:first-child{font-size:15px;line-height:1.6}
body.m .ha-q .btn{min-height:44px}
body.m .bgl{font-size:14px;line-height:1.6}
body.m .ha-stop{font-size:14px}
body.m .ab.ab2{display:grid;gap:0;min-height:0;padding:6px 8px 8px 20px}
body.m .ab-1,body.m .ab-2{display:flex;align-items:center;min-width:0}
body.m .ab-1{gap:6px;min-height:52px}
body.m .ab-2{flex-wrap:wrap;gap:6px 8px;padding-right:4px}
body.m .ab2 .sp{flex:1}
body.m .ab2 .host{display:inline-flex;align-items:center;gap:7px;min-height:32px;padding:0 12px 0 10px;border-radius:var(--r-pill);background:var(--panel);box-shadow:inset 0 0 0 1px var(--rule);font:500 12.5px var(--f-mono);color:var(--ink2);white-space:nowrap}
body.m .ab2 .subs{display:inline-flex;margin-left:auto;border-radius:var(--r);box-shadow:inset 0 0 0 1px var(--rule)}
body.m .ab2 .ha-subscribe,body.m .ab2 .ha-subscribe-web{display:inline-flex;align-items:center;min-height:44px;min-width:44px;padding:0 12px;font:600 13px var(--f-ui);color:var(--ink);white-space:nowrap}
body.m .ab2 .ha-subscribe-web{box-shadow:inset 1px 0 0 var(--rule);color:var(--ink2)}
body.m .gpin{flex:none;display:grid;gap:4px;padding:10px 16px 6px;background:var(--signal-tint);box-shadow:0 1px 0 color-mix(in srgb,var(--stale) 45%,transparent);position:relative;z-index:1}
body.m .gpin-h{display:flex;align-items:center;gap:6px;margin:0;font-size:12.5px;font-weight:700;color:var(--signal-ink)}
body.m .gpin-h .ic{width:15px;height:15px}
body.m .gpin-h .sp{flex:1}
body.m .gpin-h .left{font:600 12.5px var(--f-mono);font-variant-numeric:tabular-nums}
body.m .gpin-q{margin:0;font-size:16.5px;font-weight:700;line-height:1.55;color:var(--ink);text-wrap:pretty}
body.m .gpin-go{justify-self:start;display:inline-flex;align-items:center;gap:4px;min-height:44px;padding:0 4px 0 0;border:0;background:none;font:600 13.5px var(--f-ui);color:var(--signal-ink);cursor:pointer}
body.m .gpin-go .ic{width:16px;height:16px;transform:rotate(90deg)}
body.m .rep{align-self:stretch;max-width:none}
body.m .rep .bub{position:relative;max-height:calc(15px * 1.75 * 6 + 24px);overflow:hidden;padding:12px 16px;border-radius:var(--r);font-size:15px;line-height:1.75;letter-spacing:.01em}
body.m .rep .bub p+p{margin-top:10px}
body.m .rep .bub::after{content:"";position:absolute;left:0;right:0;bottom:0;height:48px;background:linear-gradient(transparent,var(--panel))}
body.m .rep.open .bub{max-height:none}
body.m .rep.open .bub::after{display:none}
body.m .rep-more{justify-self:start;display:inline-flex;align-items:center;min-height:44px;padding:0 6px;border:0;background:none;font:600 13.5px var(--f-ui);color:var(--keel);cursor:pointer}
body.m .gopts{display:grid;gap:10px;scroll-margin-top:8px}
body.m .gopts .opts{gap:8px}
body.m .gopts .opt{min-height:64px;padding:14px 16px 14px 14px}
body.m .gopts .opt-l{font-size:16px}
body.m .gopts .opt-d{font-size:14px;line-height:1.6}
body.m .gopts .opt.other{min-height:56px;align-items:center}
```

`gate-card` 的 form 在 mobile.js 沒有 `.gopts`，所以 `body.m .gopts …` 這幾條要先讓 form 帶上 `gopts` class：in `assets/station/mobile.js`, in `gateCard`, change `<form class="gc" id="gate-card"` to:

```js
        return '<form class="gc gopts" id="gate-card" data-id="' + esc(p.id) + '" aria-labelledby="gc-q0">'
```

- [ ] **Step 6: 跑 /m 的測試，看它們通過**

```sh
node --test tests/station-mobile-resize.test.js tests/station-mobile-page.test.js tests/station-mobile-route.test.js
```

- [ ] **Step 7: Commit**

```sh
git add assets/station/mobile.js assets/station/mobile.css tests/station-mobile-resize.test.js
git commit -m "feat: /m reads larger, its header keeps the host whole, the gate question stays pinned"
```

## Task 5: /fankeel hook 不再開瀏覽器

**Files:**
- Modify: `hooks/inject.js:183-197` — `ensureServe` 加 `open: false`，上面的註解原地改字
- Test: `tests/inject-no-browser.test.js`

**Interfaces:**
- Consumes: `ensureServe(opts)` 讀 `o.open !== false`（`lib/serve.js:199`，已存在，不改）
- Produces: none

**Dispatch:** implementer, sonnet — 一行改動加一個測試。

- [ ] **Step 1: 先寫會失敗的測試**

Write `tests/inject-no-browser.test.js`:

```js
'use strict';
// A /fankeel prompt still starts the station, but never opens a browser: hooks/inject.js passes
// `open: false` to ensureServe (lib/serve.js reads `o.open !== false`).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'hooks', 'inject.js'), 'utf8');

test('the hook asks ensureServe for a station without a browser', () => {
    const call = /serveLib\.ensureServe\(\{([^}]*)\}\)/.exec(SRC);
    assert.ok(call, 'the hook calls serveLib.ensureServe({...})');
    assert.match(call[1], /\bopen:\s*false\b/);
    assert.match(call[1], /\bconfigDir:\s*dir\b/, 'the station is still started');
});

test('the comment above it no longer says the prompt opens the browser', () => {
    assert.doesNotMatch(SRC, /starts `station\.js serve --open` detached/);
});
```

- [ ] **Step 2: 跑它，看它失敗**

```sh
node --test tests/inject-no-browser.test.js
```

- [ ] **Step 3: 改 hook**

In `hooks/inject.js`, replace the `ensureServe` call (line 197) with:

```js
            serveLib.ensureServe({ configDir: dir, plugin: PLUGIN_ROOT, open: false, until: began + SERVE_BUDGET_MS })
```

In `hooks/inject.js`, replace the two comment lines that say `starts \`station.js serve --open\` detached ... so the browser opens only when this prompt started the station, and it` (lines 186-188) with the same number of lines:

```js
        // starts `station.js serve` detached when nothing answers, with `open: false`
        // so no browser opens; the page is one the user opens from the url, and it
```

- [ ] **Step 4: 跑測試，看它通過，並確認舊的 hook 測試不受影響**

```sh
node --test tests/inject-no-browser.test.js tests/inject.test.js tests/badge.test.js
```

- [ ] **Step 5: Commit**

```sh
git add hooks/inject.js tests/inject-no-browser.test.js
git commit -m "fix: /fankeel starts the station without opening a browser"
```

## Task 6: station 行的字樣與文件跟著改

**Files:**
- Modify: `lib/render.js:360-383` — `(serve started, browser opened)` 改成 `(serve started)`，`serve is starting` 一句不再說瀏覽器會開
- Modify: `docs/90-agent/reference/station.md:60-80` — 表格兩列跟著新字樣
- Modify: `skills/fankeel-station/SKILL.md:13-15` — 第 13 行說 hook 啟動 `serve --open`，改成不開瀏覽器
- Test: `tests/render.test.js`（既有檔，改 705-1030 的三處斷言）

**Interfaces:**
- Consumes: none
- Produces: `stationLine` 在 `state: 'started'` 時以 `(serve started).` 結尾，在 `state: 'starting'` 時是 `station: serve is starting; the page fills in when it binds.`

**Dispatch:** implementer, sonnet — 字樣替換加三個檔的同步。

- [ ] **Step 1: 先改測試（它現在就該失敗）**

In `tests/render.test.js`, at line 710, replace the `started` assertion with:

```js
  assert.match(served({ state: 'started', url }), /^station: http:\/\/127\.0\.0\.1:7817\/ \(serve started\)\.$/m);
```

In `tests/render.test.js`, at line 713, replace the `starting` assertion with:

```js
  assert.match(served({ state: 'starting', url: null }), /^station: serve is starting; the page fills in when it binds\.$/m);
```

In `tests/render.test.js`, at line 1025, replace the remote-tail `started` assertion with:

```js
  assert.match(served({ state: 'started', url, remote: on }), /\(serve started\)\. phone: https:\/\/ymlab-pc\.tail1234\.ts\.net\/m — Tailscale MagicDNS /);
```

- [ ] **Step 2: 跑它，看它失敗**

```sh
node --test tests/render.test.js
```

預期：這三條失敗，其餘通過。

- [ ] **Step 3: 改 `lib/render.js`**

In `lib/render.js`, at line 380, replace the `started` return with:

```js
    if (typeof s.url === 'string' && s.state === 'started') return 'station: ' + s.url + ' (serve started).' + remoteTail(s.remote);
```

In `lib/render.js`, at line 382, replace the `starting` return with:

```js
    if (s.state === 'starting') return 'station: serve is starting; the page fills in when it binds.';
```

In `lib/render.js`, at line 362, change `says the browser opens when it does.` to `says the page fills in when it does.`

- [ ] **Step 4: 改 `docs/90-agent/reference/station.md`**

In `docs/90-agent/reference/station.md`, replace the `started` row (line 71) with:

```md
| `station: <url> (serve started).` | none answered, so the hook started `station.js serve` detached (no `--open`: no browser opens), and its `serve.json` appeared in time |
```

In `docs/90-agent/reference/station.md`, replace the `starting` row (line 73) with:

```md
| `station: serve is starting; the page fills in when it binds.` | it was started, and had not written its record when the hook had to answer |
```

- [ ] **Step 5: 改 `skills/fankeel-station/SKILL.md`**

In `skills/fankeel-station/SKILL.md`, replace lines 13-14 (`` `/fankeel` already opens the station: its hook starts `serve --open` when no `` / `station answers and names the url on the block's `station:` line.``) with:

```md
`/fankeel` already starts the station: its hook starts `serve` (without `--open`, so no browser opens) when no
station answers and names the url on the block's `station:` line. This is for
```

and keep the following line (`reopening it by hand — ...`) as it is.

- [ ] **Step 6: 跑測試，看它們通過**

```sh
node --test tests/render.test.js tests/station-doc.test.js
```

- [ ] **Step 7: Commit**

```sh
git add lib/render.js tests/render.test.js docs/90-agent/reference/station.md skills/fankeel-station/SKILL.md
git commit -m "docs: the station line no longer says a browser was opened"
```

## Coverage

| promise | task |
|---|---|
| `.fkp` width min(560px, 100vw-32px) | Task 1 |
| `.fkr` 24px visible grip with hover | Task 1 |
| `.fkf` padding-left 36px | Task 1 |
| `.qpop` min(720px)/80vh | Task 1 |
| `.claims` max-height 320px + `resize:vertical`, cap lifted once dragged (`[style*="height"]{max-height:none}`) | Task 1 |
| `.fpanel` max-height 60vh | Task 1 |
| `@media (max-width:599px)` `.fkp` fixed bottom sheet, 85vh, top radius only, overrides inline `fkBox` size, grip hidden | Task 1 (rules), Task 2 (drag bar, close, scrim click) |
| 15px reading text, 44px min tap targets on rows, `.host` ellipsis so the hostname is not cut mid-word | Task 4 |
| `ensureServe({... open: false})` — station still starts, no browser | Task 5 |
| `(serve started, browser opened)` → `(serve started)` | Task 6 |
| tests/render.test.js:710,1025; tests/inject.test.js | Task 6 (render.test.js), Task 5 (the inject check lives in a new `tests/inject-no-browser.test.js`; `tests/inject.test.js` itself is unchanged) |
| docs/90-agent/reference/station.md:71 | Task 6 |
| CSS assertions: `.fkp` width 560, `.fkr` 24px, `.claims` resize vertical, phone `.fkp` position fixed | Task 1 |
| a new station CSS test asserting `.fkp` min(560px…), `.fkr` 24px, `.claims{resize:vertical}` and the ≤599px `.fkp{position:fixed}` fails today and passes after | Task 1 |
| inject test asserting `open:false` fails today and passes after | Task 5 |
| `assets/station/gate-frame.js` `frame()` draws `.gt-side` only while the session carries `gateAt` or `pending` | Task 3 |
| a gate-frame test that a session without `gateAt`/`pending` renders no `gt-side` — fails today | Task 3 |
| frames 2-4: /m reading size and spacing, two-line header / host chip never cut mid-word, gate options as full-width cards with the question pinned above the report | Task 4 |
| `assets/station/mobile.js` only the markup frames 3-4 need that mobile.css cannot reach | Task 4 |
| `assets/station/station.js` `gateCountdownHtml` (1896) — the single-choice shortcut draws option buttons only; add a free-text box and a send button under them, sent through the same `/answer` POST | Task 2 |
| a test that `gateCountdownHtml` for a single-choice held gate under serve contains a free-text field — fails today | Task 2 |
| free-text answer drawn in data-block gate-free-desk (fkp), gate-free-sheet (phone frame 1) and gate-free-m (phone frame 4) | Task 1 (desk and sheet rules), Task 2 (markup), Task 4 (/m: its free-text card with mic already exists in `gateCard`; it gains the `gopts` card styles) |
| On /m the free-text card has no button of its own; the form's existing 送出答案 under it sends it. | Task 4 (unchanged: `gateCard` already works this way) |
| a mic button beside every free-text answer — gate-free-desk (fkp), gate-page-free (gate page, gate-frame.js `freeHtml`), gate-free-sheet (phone frame 1), gate-free-m (phone frame 4) | Task 2 (fkp and sheet), Task 3 (gate page), Task 4 (/m: `gateCard` already draws `data-mic` when `u.mic`) |
| Build reuses /m's SpeechRecognition handling (assets/station/mobile.js:575) and `.gmic` look; station.js and gate-frame.js gain the mic, shown only where SpeechRecognition exists | Task 2, Task 3 (look in Task 1) |
| a test that the single-choice `gateCountdownHtml` and `freeHtml` contain a `data-mic` button when the mic is available — fails today | Task 2 (`gateCountdownHtml`), Task 3 (`freeHtml`, as `data-gq-mic`) |
| native `resize` on `.qpop` and `.fpanel` cut — they get bigger defaults instead | Task 1 (no `resize` on either; only the bigger sizes) |
| `.qpop` phone sheet cut — search is hidden below 999px | Task 1 (the sheet block has no `.qpop` rule) |
| `serve is starting; the browser opens when it binds.` (extra line, beyond design.md's `render.js:380`) | Task 6 (the same false claim once `open: false` lands; see Risks) |
