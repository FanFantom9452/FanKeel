---
status: current
---

# 導覽影片：文件區塊動畫＋合成配樂＋中英雙語 Implementation Plan

**Goal:** 把 3600 格的宣傳片換成十一格文件區塊動畫（沒有任何終端機畫面），配上用純 JS 合成、瀏覽器和 Node 共用的 60 秒配樂，並依 station 語言出中英兩版，`scripts/tour-record.js` 各錄一支有音軌的 mp4。
**Architecture:** `tour.js` 多出依語言切換的字體和 `fit()` 一族量字工具；新檔 `tour-doc.js` 放 `{ zh, en }` 字串表和「文件頁」畫法（頁框、分頁、表頭、浮入的方塊、上捲、字幕）；十一格拆成 `tour-opening.js`（hook … build）和 `tour-closing.js`（verify … outro）兩個檔，可平行做；`tour-stages.js` 縮成把兩邊接起來、註冊時間軸、交出配樂 cue 的 50 行。`tour-music.js` 把 cue 合成成 PCM，播放器用 Web Audio 播、錄影腳本寫成 WAV 交給 ffmpeg。
**Tech Stack:** Node v24.9.0（`node --test`，沒有任何依賴）；瀏覽器端 ES5 plain script、Canvas 2D `measureText`（`actualBoundingBoxAscent`）、Web Audio `AudioBuffer`；錄影用本機 Edge headless 與 ffmpeg 7.1.1（WinGet Gyan build，ffprobe 在同一個目錄）。
**Spec:** [2026-09-28-tour-blocks-design.md](2026-09-28-tour-blocks-design.md)

分鏡圖：`.fankeel/build/2026-09-28-tour-blocks/mockup.html`（gitignored，只在主工作樹；`?lang=en` 看英文）。每格的格數、字串、動作都以它為準，程式註解裡的 f 值就是它的。這份計畫裡的程式碼在 2026-09-28 於一份 repo 副本裡跑過：本計畫列的 tour 測試 89 個全綠，`?check` 在 Edge 裡中英兩版量字都是 `[]`，ffmpeg 7.1.1 合出的 60 秒測試檔 ffprobe 讀到 `[ 60 ]` 一條音軌、3600 格。

## Global Constraints

來源：`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`，這份就是慣例頁）、`.fankeel/map.md`（2026-09-28 以 `node scripts/map.js` 重生：338 markdown files）、`package.json`、測試。

- `package.json`：`"test": "node --test"`，沒有 `dependencies`；不得新增依賴，repo 不放音檔、不放字體檔。版本 `0.80.0` 只由 `scripts/version.js` 動（`CONTRIBUTING.md` Version numbers 列）。
- `scripts/station.js:55`：`const STATIC = /^\/station\/((?:station|i18n)\.js|station\.css|tour(?:-[a-z]+)?\.(?:js|css|html))$/;`——新資產檔名只能是 `tour-` 加小寫字母，serve 才送得出去：`tour-doc.js`、`tour-opening.js`、`tour-closing.js`、`tour-music.js`。
- `tests/source.test.js:117`（every exported name is imported by something）：每個 `module.exports` 名字都要有另一個檔以 `const X = require(...)` 再寫 `X.name`，或以解構 `const { name } = require(...)` 匯入；`root.tourEngine || require('./tour.js')` 這種寫法它讀不到，所以每個新匯出都由測試 require。`CONTRIBUTING.md` Tests 列：新檔要先 `git add`，`tests/source.test.js` 才看得到。
- `assets/station/*.js` 的寫法照 `assets/station/tour.js`：UMD 外殼 `(function (root, module) { ... })(typeof window !== 'undefined' ? window : globalThis, typeof module !== 'undefined' ? module : {});`、`'use strict'`、ES5（`var`、`function`，不用箭頭與 `const`）、4 格縮排；瀏覽器端用全域（`window.tourEngine`、`window.tourDoc`、`window.tourOpening`、`window.tourClosing`、`window.tourMusic`）。`tests/*.test.js` 用 `node:test`、`const`、4 格縮排。
- `assets/station/tour.js:10`：`W = 640, H = 360, FPS = 60, SUBFRAMES = 10`，`tests/tour.test.js:22-28` 逐值斷言，不動。`check()`（`tour.js` 同檔）要求 beats 的 `at` 嚴格遞增、落在 `0..length-1`、有 `label`，`register()` 不合格就丟錯。
- 時間基準（design）：60 fps、120 BPM、4/4；一拍 30 格、一小節 120 格；44100 Hz 下一格正好 735 個樣本，全片 3600 格＝2646000 個樣本。
- `assets/station/station.css:54` 暗色 token 值：`--live:#5cc27a`、`--live-bg:rgba(92,194,122,.14)`、`--stale:#e0a53a`、`--stale-ink:#e0a53a`、`--stale-bg:rgba(224,165,58,.16)`、`--up-bg:rgba(92,194,122,.14)`、`--dn-bg:rgba(239,138,106,.14)`；`--f-mono:"Cascadia Mono","Cascadia Code",Consolas,"SF Mono",ui-monospace,monospace`。
- `assets/station/i18n.js:861,875`：頁面上是 `window.FK_I18N`，`.lang` 只會是 `'zh'` 或 `'en'`。
- `tests/tour-ctx.js` 的 fake context 只記錄呼叫、不出像素；像素只在瀏覽器驗：`tests/tour-page.test.js` 用 `scripts/render.js` 的 `findBrowser()`，找不到瀏覽器就 skip。
- `lib/plantasks.js:346-347`：`READ_CAP` 1500、`FILE_CAP` 3；本計畫每個 task 的 `Modify:` 都在兩條之下，超過 1500 行的 `docs/90-agent/reference/station.md`（1146 行）以範圍寫。
- 錄影：ffmpeg 從 `FANKEEL_FFMPEG` 或 PATH 找，ffprobe 在它旁邊（`scripts/tour-record.js` 的 `ffmpegPath`／`ffprobeOf`）；`.fankeel/build/` 由 `.fankeel/.gitignore:3` 忽略，錄出的 mp4／wav 不進 git。
- 文件：`docs/90-agent/reference/` 與程式註解用英文，`docs/01-guide/` 用繁體中文。docs-check 會解析反引號裡的路徑，還不存在或 gitignored 的路徑不要放進反引號。
- 提交：`type(scope): subject`；受控 build 由 brain 寫 commit file、controller 跑 `scripts/commit.js`，implementer 不提交；只在本機提交，不 push。

## File structure

| file | 責任 | task |
|---|---|---|
| `assets/station/tour.js` | 引擎：語言決定 UI 字體順序、palette 多帶 `lang` 與幾個 token、文件方塊用的字級、`fit`／`fitText`／`fitRuns`／`midY`／`fitLog` | 1 |
| `tests/tour-ctx.js` | fake context 依字級與字元量寬、回 `actualBoundingBoxAscent`；`sweep()` 一次掃多格 | 1 |
| `assets/station/tour-music.js`（新） | 譜（和弦、bass、kick、hat、pluck 旋律、pad）與合成器、WAV 編碼 | 2 |
| `assets/station/tour-doc.js`（新） | `{ zh, en }` 字串表 `S`、`t()`、文件頁 `page()` 與它的零件 | 3 |
| `assets/station/tour-opening.js`（新） | hook、route、survey、design、plan、build 六格 | 4 |
| `assets/station/tour-closing.js`（新） | verify、audit、land、clash、outro 五格 | 5 |
| `assets/station/tour-stages.js` | 十一格頭尾相接、註冊 `stages`、`beats`／`stills`／`cues` | 6 |
| `assets/station/tour.html` | 載入順序；靜音鈕；說明文字 | 6、7 |
| `assets/station/tour-player.js`、`assets/station/tour.css` | 語言、Web Audio 播放與同步、靜音鈕、`?check` | 7 |
| `scripts/tour-record.js` | `--lang`、WAV、ffmpeg 合音軌、ffprobe 查音軌 | 8 |
| `docs/01-guide/station.md`、`docs/90-agent/reference/station.md` | 導覽的描述改成現在的樣子 | 8 |

## Task 1: 引擎的語言字體與量字工具

`tour.js` 的 palette 依語言排 UI 字體、多讀六個 station token；文件方塊的字級進 `FONTS`；新增 `fit()`（量寬→最多縮三級→才換行，「。，、」不落行首）、`fitText()`、`fitRuns()`（一行裡混等寬與介面字體）、`midY()`（用量到的 `actualBoundingBoxAscent` 垂直置中）、`fitLog()`（記下每一次量字，給測試與 `?check` 讀）。`tests/tour-ctx.js` 的 fake context 改成依字級量寬，並加 `sweep()`。不加任何字體檔：錄影固定在 Windows 上跑，網頁版用系統字體。

**Files:**
- Modify: `assets/station/tour.js` — `UI_FONTS`、`DARK`（多 token、`lang`、`fUi` 改 zh 順序）、`palette(read, lang)`、`FONTS` 多文件方塊字級、`font()`、`fit()`、`fitText()`、`fitRuns()`、`fitLog()`、`midY()`，匯出
- Modify: `tests/tour-ctx.js` — `measureText` 依字級與字元量寬並回 ink box；新增 `sweep()`
- Test: `tests/tour.test.js`

**Interfaces:**
- Consumes: nothing from an earlier task.
- Produces: `E.UI_FONTS`（`{ zh, en }` 字體字串）、`E.palette(read, lang)`（回傳的 P 多 `lang`、`live`、`stale`、`staleInk`、`liveBg`、`upBg`、`dnBg`、`staleBg`）、`E.font(P, cls, o)` → CSS font 字串、`E.fit(ctx, P, cls, s, maxW, o)` → `{ size, lines, over }`、`E.fitText(ctx, P, cls, s, x, y, maxW, o)` → 同 `fit`（`o.middle`、`o.lines`、`o.leading`、`o.align`、`o.fill`、`o.size`、`o.weight`）、`E.fitRuns(ctx, P, runs, x, y, maxW, o)` → 用了幾行（runs 是 `[cls, text, fill]`）、`E.fitLog(arr)` → 前一個 log、`E.midY(ctx, s, cy)` → baseline y；`FONTS` 新字級 `h1 h2 h3 ph pd p li ui note code cm tab pill cap tag nm`；`sweep(T, frames, draw)` → `{ log, monoWide, nonFinite }`（`tests/tour-ctx.js`）

**Dispatch:** implementer, sonnet — 程式碼全在計畫裡；照抄加跑測試。

- [ ] **Step 1: 寫失敗的測試。** 把 `tests/tour-ctx.js` 整檔換成：

```js
'use strict';
// A 2D context that draws nothing. Every method call and property write is
// recorded in `calls`, in order, so a frame can be compared with itself and
// the text it printed read back with `texts()`. Properties written are kept,
// so `ctx.globalAlpha` reads back; save() and restore() stack them.
//
// measureText reads the size off the font last set and answers the way the
// faces the frames name are built: a CJK or full-width character is one em
// (JhengHei's are), an ASCII one is 0.6 em in a mono face (Cascadia Mono is
// 0.586) and 0.56 em otherwise. The ink box is 0.72 em above the baseline and
// 0.2 em below. Close enough to find a string that does not fit; the page's
// ?check measures with the real faces.
const WIDE = /[⺀-鿿豈-﫿＀-￯　-〿]/;

function fakeCtx(width, height) {
    const calls = [];
    const stack = [];
    let state = { globalAlpha: 1, font: '10px sans-serif', fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1 };
    const own = {
        canvas: { width: width || 1280, height: height || 720 },
        calls,
        texts: () => calls.filter((c) => c[0] === 'fillText').map((c) => c[1]),
        measureText: (s) => {
            const m = /(\d+(?:\.\d+)?)px\s+(.*)$/.exec(state.font);
            const size = m ? Number(m[1]) : 10;
            const ascii = m && /^"?Cascadia Mono/.test(m[2]) ? 0.6 : 0.56;
            let w = 0;
            for (const ch of String(s)) w += WIDE.test(ch) ? size : size * ascii;
            return { width: w, actualBoundingBoxAscent: 0.72 * size, actualBoundingBoxDescent: 0.2 * size };
        },
        save: () => { calls.push(['save']); stack.push(Object.assign({}, state)); },
        restore: () => { calls.push(['restore']); if (stack.length) state = stack.pop(); },
    };
    return new Proxy(own, {
        get(t, k) {
            if (Object.prototype.hasOwnProperty.call(t, k)) return t[k];
            if (Object.prototype.hasOwnProperty.call(state, k)) return state[k];
            return (...args) => { calls.push([String(k), ...args]); };
        },
        set(t, k, v) {
            state[k] = v;
            calls.push(['=' + String(k), v]);
            return true;
        },
    });
}

function fakeCanvas() {
    const ctx = fakeCtx();
    return { width: 0, height: 0, getContext: () => ctx };
}

// Draws `draw(ctx, f)` on a fresh fake context at every frame in `frames`
// with tour.js's fit log on (T is tour.js). Returns what the frames' tests
// ask of all of them at once: every fit entry, every fillText set in the
// mono face that holds a character outside printable ASCII, and every frame
// that drew with a number that is not finite.
function sweep(T, frames, draw) {
    const log = [], monoWide = [], nonFinite = [];
    const was = T.fitLog(log);
    try {
        for (const f of frames) {
            const ctx = fakeCtx();
            draw(ctx, f);
            let font = '';
            for (const c of ctx.calls) {
                if (c[0] === '=font') font = c[1];
                if (c[0] === 'fillText' && /px "Cascadia Mono"/.test(font) && /[^\x20-\x7e]/.test(c[1])) monoWide.push(f + ': ' + c[1]);
                if (c.some((x) => typeof x === 'number' && !Number.isFinite(x))) nonFinite.push(f);
            }
        }
    } finally {
        T.fitLog(was);
    }
    return { log, monoWide, nonFinite };
}

module.exports = { fakeCtx, fakeCanvas, sweep };
```

在 `tests/tour.test.js` 檔尾加上：

```js
// Criterion: the UI face leads with the language's own. Red when: palette
// ignores `lang`, or reads the page's --f-ui (Bahnschrift first) for zh.
test('palette picks the UI face by language: JhengHei first for zh, Bahnschrift first for en', () => {
    const read = (k) => (k === 'f-ui' ? '"Bahnschrift",sans-serif' : '');
    const zh = T.palette(read, 'zh');
    const en = T.palette(read, 'en');
    assert.equal(zh.lang, 'zh');
    assert.equal(en.lang, 'en');
    assert.equal(T.palette(read).lang, 'zh');
    assert.equal(zh.fUi, T.UI_FONTS.zh);
    assert.equal(en.fUi, T.UI_FONTS.en);
    assert.ok(zh.fUi.indexOf('"Microsoft JhengHei UI"') < zh.fUi.indexOf('"Bahnschrift"'));
    assert.ok(en.fUi.indexOf('"Bahnschrift"') < en.fUi.indexOf('"Microsoft JhengHei UI"'));
    for (const face of ['"Microsoft JhengHei UI"', '"Microsoft JhengHei"', '"PingFang TC"', '"Noto Sans TC"']) {
        assert.ok(zh.fUi.indexOf(face) < zh.fUi.indexOf('"Bahnschrift"'), face);
    }
    assert.equal(T.DARK.fUi, T.UI_FONTS.zh);
    assert.equal(T.palette((k) => (k === 'stale-bg' ? '#010203' : ''), 'zh').staleBg, '#010203');
    assert.equal(zh.live, T.DARK.live);
});

// Criterion: past its width a string shrinks one step at a time, three at
// most, before it wraps. Red when: fit wraps at the first size, or shrinks
// without limit.
test('fit keeps the class size when it fits, then shrinks by three steps at most, then wraps', () => {
    const ctx = fakeCtx();
    const P = T.DARK;
    // 'cap' is 21px: ten CJK characters are 210 wide in the fake context.
    assert.deepEqual(T.fit(ctx, P, 'cap', '一二三四五六七八九十', 210), { size: 21, lines: ['一二三四五六七八九十'], over: false });
    const one = T.fit(ctx, P, 'cap', '一二三四五六七八九十', 200);
    assert.equal(one.size, 21 * 0.92);
    assert.deepEqual(one.lines, ['一二三四五六七八九十']);
    const three = T.fit(ctx, P, 'cap', '一二三四五六七八九十', 21 * 0.78 * 10);
    assert.equal(three.size, 21 * 0.78);
    assert.equal(three.lines.length, 1);
    const wrapped = T.fit(ctx, P, 'cap', '一二三四五六七八九十', 120);
    assert.equal(wrapped.lines.length, 2);
    assert.equal(wrapped.lines.join(''), '一二三四五六七八九十');
    assert.equal(wrapped.over, false);
    assert.equal(T.fit(ctx, P, 'cap', '一二三四五六七八九十', 30).over, true);
});

// Criterion: a wrap never starts a line with 。，、. Red when: the break
// falls wherever the width runs out.
test('a wrapped line never begins with 。，、 — the character before it goes down too', () => {
    const ctx = fakeCtx();
    const P = T.DARK;
    for (const mark of ['。', '，', '、']) {
        // 21px CJK: six characters fill 126, so the seventh — the mark — would open line two.
        const s = '一二三四五六' + mark + '七八九';
        const r = T.fit(ctx, P, 'cap', s, 126 * 0.78, { lines: 3 });
        assert.ok(r.lines.length > 1, mark + ': ' + r.lines.join(' | '));
        for (const l of r.lines) assert.ok(!'。，、'.includes(l[0]), mark + ': ' + r.lines.join(' | '));
        assert.equal(r.lines.join(''), s);
    }
});

test('English wraps at spaces, never inside a word', () => {
    const ctx = fakeCtx();
    const r = T.fit(ctx, T.DARK, 'tag', 'Build with AI as long as you like — without piling up stale references and dead code.', 500);
    assert.equal(r.lines.length, 2);
    for (const l of r.lines) assert.ok(!/^\s|\s$/.test(l), JSON.stringify(l));
    assert.equal(r.lines.join(' '), 'Build with AI as long as you like — without piling up stale references and dead code.');
});

// Criterion: vertical centring comes from the measured ink box. Red when:
// midY returns a hand-set offset.
test('midY centres the measured ink box on the point, and fitText with middle uses it', () => {
    const ctx = fakeCtx();
    ctx.font = '400 20px sans-serif';
    assert.equal(T.midY(ctx, 'x', 100), 100 + (0.72 * 20 - 0.2 * 20) / 2);
    const log = [];
    T.fitLog(log);
    T.fitText(ctx, T.DARK, 'li', 'abc', 10, 50, 300, { middle: true });
    assert.equal(T.fitLog(null), log);
    const fill = ctx.calls.filter((c) => c[0] === 'fillText').at(-1);
    assert.ok(Math.abs(fill[3] - (50 + (0.72 - 0.2) * 14.5 / 2)) < 1e-9, String(fill[3]));
    assert.deepEqual(log, [{ s: 'abc', maxW: 300, size: 14.5, lines: ['abc'], over: false }]);
});

test('fitRuns shrinks mixed runs together, and stacks them when the smallest step does not fit', () => {
    const P = T.DARK;
    let ctx = fakeCtx();
    assert.equal(T.fitRuns(ctx, P, [['code', 'a.ts'], ['li', ' 通過']], 0, 20, 400), 1);
    assert.deepEqual(ctx.texts(), ['a.ts', ' 通過']);
    ctx = fakeCtx();
    const log = [];
    T.fitLog(log);
    assert.equal(T.fitRuns(ctx, P, [['code', 'warehouse.test.ts'], ['li', ' old case fails: no default warehouse']], 0, 20, 240), 2);
    T.fitLog(null);
    assert.deepEqual(ctx.texts(), ['warehouse.test.ts', 'old case fails: no default warehouse']);
    assert.ok(log.every((e) => !e.over), JSON.stringify(log));
    const mono = ctx.calls.filter((c) => c[0] === '=font').map((c) => c[1]);
    assert.ok(mono.some((f) => f.includes('Cascadia Mono')) && mono.some((f) => f.includes('JhengHei')));
});

test('font builds the class\'s CSS font from the palette\'s faces', () => {
    assert.equal(T.font(T.DARK, 'h1'), '600 25px ' + T.DARK.fUi);
    assert.equal(T.font(T.DARK, 'code', { size: 10 }), '400 10px ' + T.DARK.fMono);
});
```

- [ ] **Step 2: 跑，看它失敗。** `node --test tests/tour.test.js`：新測試因 `T.UI_FONTS`、`T.fit`、`T.midY`、`T.fitRuns`、`T.font` 不存在而失敗，舊的照舊通過。

- [ ] **Step 3: 最小實作。** 在 `assets/station/tour.js`，把 `// assets/station/station.css :root[data-theme=dark], value for value.` 那段註解連同整個 `var DARK = {...};` 換成：

```js
    // The UI face leads with the language's own: JhengHei for zh, Bahnschrift
    // for en (the storyboard's html[data-lang] rules). The mono face only ever
    // holds ASCII.
    var UI_FONTS = {
        zh: '"Microsoft JhengHei UI","Microsoft JhengHei","PingFang TC","Noto Sans TC","Bahnschrift","DIN Alternate",system-ui,sans-serif',
        en: '"Bahnschrift","Microsoft JhengHei UI","Microsoft JhengHei","PingFang TC","Noto Sans TC","DIN Alternate",system-ui,sans-serif',
    };
    // assets/station/station.css :root[data-theme=dark], value for value.
    // palette() reads the live tokens in a page; this is what Node and a
    // missing token fall back to. The frames are always dark.
    var DARK = {
        ground: '#0e1311', panel: '#161c1a', inset: '#1e2522',
        ink: '#e8ece6', ink2: '#a9b3ae', muted: '#8a9590', faint: '#65706b',
        rule: '#29312e', rule2: '#36403c', good: '#5cc27a', bad: '#ef8a6a',
        live: '#5cc27a', stale: '#e0a53a', staleInk: '#e0a53a',
        liveBg: 'rgba(92,194,122,.14)', upBg: 'rgba(92,194,122,.14)', dnBg: 'rgba(239,138,106,.14)', staleBg: 'rgba(224,165,58,.16)',
        st: { survey: '#488acb', design: '#bf860c', plan: '#c35c9b', build: '#5e9f50', verify: '#8071c8', audit: '#d15d51', land: '#209993' },
        lang: 'zh',
        fUi: UI_FONTS.zh,
        fMono: '"Cascadia Mono","Cascadia Code",Consolas,"SF Mono",ui-monospace,monospace',
    };
```

  在 `assets/station/tour.js`，把整個 `function palette(read) {...}` 換成：

```js
    // Station tokens by the name the frames use. `lang` picks the UI face and
    // rides on the palette, so every draw function sees it as P.lang. The
    // page's own --f-ui is not read: the language decides which face leads.
    var TOKENS = {
        ground: 'ground', panel: 'panel', inset: 'inset', ink: 'ink', ink2: 'ink2', muted: 'muted', faint: 'faint',
        rule: 'rule', rule2: 'rule2', good: 'good', bad: 'bad', live: 'live', stale: 'stale', staleInk: 'stale-ink',
        liveBg: 'live-bg', upBg: 'up-bg', dnBg: 'dn-bg', staleBg: 'stale-bg',
    };
    function palette(read, lang) {
        var P = { st: {} };
        Object.keys(TOKENS).forEach(function (k) { P[k] = read(TOKENS[k]) || DARK[k]; });
        ROUTE.forEach(function (s) { P.st[s] = read('st-' + s) || DARK.st[s]; });
        P.lang = lang === 'en' ? 'en' : 'zh';
        P.fUi = UI_FONTS[P.lang];
        P.fMono = read('f-mono') || DARK.fMono;
        return P;
    }
```

  在 `assets/station/tour.js`，把 `// The storyboard's svg text classes (.v-h … .v-big)` 那行註解、整個 `var FONTS = {...};` 和整個 `function text(...) {...}` 換成：

```js
    // Text classes: weight, size, family, colour. The first three rows are the
    // old svg set (.v-h … .v-big); the rest are the document blocks of
    // .fankeel/build/2026-09-28-tour-blocks/mockup.html (.bk-h1 … .cap).
    var FONTS = {
        h: ['600', 28, 'fUi', 'ink'], hc: ['600', 24, 'fUi', 'ink'], t: ['600', 15, 'fUi', 'ink'],
        b: ['400', 13, 'fUi', 'ink'], sub: ['400', 14, 'fUi', 'ink2'], s: ['400', 12, 'fUi', 'muted'],
        m: ['400', 12.5, 'fMono', 'ink2'], mi: ['600', 13, 'fMono', 'ink'], j: ['400', 11, 'fMono', 'ink2'],
        jn: ['400', 11, 'fMono', 'ink'], big: ['600', 22, 'fMono', 'ink'],
        h1: ['600', 25, 'fUi', 'ink'], h2: ['600', 18, 'fUi', 'ink'], h3: ['600', 16, 'fUi', 'ink'],
        ph: ['600', 23, 'fUi', 'ink'], pd: ['400', 15, 'fUi', 'ink2'], p: ['400', 17, 'fUi', 'ink'],
        li: ['400', 14.5, 'fUi', 'ink2'], ui: ['600', 15.5, 'fUi', 'ink'], note: ['400', 13, 'fUi', 'muted'],
        code: ['400', 14.5, 'fMono', 'ink'], cm: ['400', 13, 'fMono', 'muted'], tab: ['400', 13, 'fMono', 'ink'],
        pill: ['600', 12.5, 'fUi', 'ink'], cap: ['600', 21, 'fUi', 'ink'], tag: ['600', 22, 'fUi', 'ink'],
        nm: ['500', 12, 'fMono', 'ink2'],
    };
    function font(P, cls, o) {
        var f = FONTS[cls];
        o = o || {};
        return (o.weight || f[0]) + ' ' + (o.size || f[1]) + 'px ' + P[f[2]];
    }
    function text(ctx, P, cls, s, x, y, o) {
        o = o || {};
        ctx.font = font(P, cls, o);
        ctx.fillStyle = o.fill || P[FONTS[cls][3]];
        ctx.textAlign = o.align || 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(s, x, y);
    }

    // fit: a string to a width. The class size first; past the width, one
    // step smaller at a time — 92%, 85%, 78% of it, three steps at most — and
    // only when the smallest still does not fit, broken into lines: at spaces
    // for English, between any two characters for Chinese, at the largest of
    // the four sizes that needs no more than `lines` of them (2 unless given).
    // No line begins with a mark in NO_START (。，、 and the other closing
    // marks): the character before it goes down with it. Pure; the answer is
    // the size, the lines, and `over` when even the wrap does not fit.
    var STEPS = [1, 0.92, 0.85, 0.78];
    var NO_START = '。，、．！？；：」』）';
    var CJK = /[⺀-鿿豈-﫿＀-￯　-〿]/;
    var TOKEN = /[⺀-鿿豈-﫿＀-￯　-〿]|[^\s⺀-鿿豈-﫿＀-￯　-〿]+|\s+/g;
    function wrap(ctx, s, maxW) {
        var lines = [], cur = '';
        (String(s).match(TOKEN) || []).forEach(function (t) {
            var blank = /^\s+$/.test(t);
            if (!cur && blank) return;
            if (!cur || ctx.measureText((cur + t).replace(/\s+$/, '')).width <= maxW) { cur += t; return; }
            var carry = '';
            if (NO_START.indexOf(t) >= 0 && cur.length > 1 && CJK.test(cur.slice(-1))) {
                carry = cur.slice(-1);
                cur = cur.slice(0, -1);
            }
            lines.push(cur.replace(/\s+$/, ''));
            cur = blank ? carry : carry + t;
        });
        cur = cur.replace(/\s+$/, '');
        if (cur) lines.push(cur);
        return lines;
    }
    function fit(ctx, P, cls, s, maxW, o) {
        o = o || {};
        var base = o.size || FONTS[cls][1], max = o.lines || 2, k, size, lines;
        for (k = 0; k < STEPS.length; k++) {
            size = base * STEPS[k];
            ctx.font = font(P, cls, { size: size, weight: o.weight });
            if (ctx.measureText(s).width <= maxW) return { size: size, lines: [String(s)], over: false };
        }
        for (k = 0; k < STEPS.length; k++) {
            size = base * STEPS[k];
            ctx.font = font(P, cls, { size: size, weight: o.weight });
            lines = wrap(ctx, s, maxW);
            if (lines.length <= max) break;
        }
        var over = lines.length > max || lines.some(function (l) { return ctx.measureText(l).width > maxW; });
        return { size: size, lines: lines, over: over };
    }
    // While a log is set, every fitText and fitRuns records what it drew, the
    // width it had to keep to, and whether it did. The page's ?check and the
    // tests read it; no picture depends on it.
    var LOG = null;
    function fitLog(arr) {
        var was = LOG;
        LOG = arr || null;
        return was;
    }
    // The baseline that centres a string's measured ink on `cy`, from the
    // font already set: actualBoundingBoxAscent, never a hand-set offset.
    function midY(ctx, s, cy) {
        var m = ctx.measureText(s);
        return cy + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
    }
    // fit, then draw the lines one under another at `leading` × size (1.25
    // unless given), from baseline `y` — or, with o.middle, as one block
    // centred on `y`. Returns fit's answer.
    function fitText(ctx, P, cls, s, x, y, maxW, o) {
        o = o || {};
        var r = fit(ctx, P, cls, s, maxW, o), lh = r.size * (o.leading || 1.25);
        ctx.font = font(P, cls, { size: r.size, weight: o.weight });
        var y0 = o.middle ? midY(ctx, r.lines[0], y) - (r.lines.length - 1) * lh / 2 : y;
        r.lines.forEach(function (l, i) {
            text(ctx, P, cls, l, x, y0 + i * lh, { size: r.size, weight: o.weight, fill: o.fill, align: o.align });
        });
        if (LOG) LOG.push({ s: String(s), maxW: maxW, size: r.size, lines: r.lines, over: r.over });
        return r;
    }
    // Runs of different classes on one line, [cls, text, fill] each — a file
    // name in mono, then its note in the UI face — shrunk together by fit's
    // steps and centred on `y`. When the smallest step still does not fit,
    // the first run keeps a line of its own and the rest go under it as one
    // fitted string in the last run's class. Returns the lines used.
    function fitRuns(ctx, P, runs, x, y, maxW, o) {
        o = o || {};
        var joined = runs.map(function (r) { return r[1]; }).join('');
        for (var k = 0; k < STEPS.length; k++) {
            var ws = runs.map(function (r) {
                ctx.font = font(P, r[0], { size: FONTS[r[0]][1] * STEPS[k] });
                return ctx.measureText(r[1]).width;
            });
            var total = ws.reduce(function (a, b) { return a + b; }, 0);
            if (total > maxW) continue;
            var cx = o.align === 'center' ? x - total / 2 : x;
            ctx.font = font(P, runs[0][0], { size: FONTS[runs[0][0]][1] * STEPS[k] });
            var by = midY(ctx, joined, y);
            runs.forEach(function (r, i) {
                text(ctx, P, r[0], r[1], cx, by, { size: FONTS[r[0]][1] * STEPS[k], fill: r[2] });
                cx += ws[i];
            });
            if (LOG) LOG.push({ s: joined, maxW: maxW, size: FONTS[runs[0][0]][1] * STEPS[k], lines: [joined], over: false });
            return 1;
        }
        var last = runs[runs.length - 1], lh = FONTS[last[0]][1] * 1.1;
        var rest = runs.slice(1).map(function (r) { return r[1]; }).join('').replace(/^\s+/, '');
        fitText(ctx, P, runs[0][0], runs[0][1], x, y - lh / 2, maxW, { middle: true, lines: 1, fill: runs[0][2], align: o.align });
        fitText(ctx, P, last[0], rest, x, y + lh / 2, maxW, { middle: true, lines: 1, fill: last[2], align: o.align });
        return 2;
    }
```

  在 `assets/station/tour.js` 的 `module.exports`，`fmtClock: fmtClock, fmtSpan: fmtSpan, fmtMin: fmtMin, fmtUsd: fmtUsd,` 那一行之後加一行：

```js
        UI_FONTS: UI_FONTS, font: font, fit: fit, fitText: fitText, fitRuns: fitRuns, fitLog: fitLog, midY: midY,
```

- [ ] **Step 4: 跑，看它通過。** `node --test tests/tour.test.js tests/tour-stages.test.js`——`tests/tour-ctx.js` 是兩者共用的 helper，所以舊的 `tour-stages` 測試也要照樣全綠（它不量寬，量寬改了不影響它）。

- [ ] **Step 5: Commit** — 路徑 `assets/station/tour.js`、`tests/tour-ctx.js`、`tests/tour.test.js`；訊息 `feat(tour): language-led UI face and fit() — shrink three steps, then wrap`。

## Task 2: 合成配樂 tour-music.js

新檔：譜寫成資料（和弦 C–G–Am–F 從第 3 小節進、kick 每拍、hat 反拍、bass 八分音、pluck 主旋律、pad），用純 JS 合成 mono Float32 PCM、44100 Hz；讀時間軸給的 cue：每個 cut 起點前 12 格一聲 whoosh、起點一聲 hit，每個方塊浮入一聲 pluck（同一格越後面越高）。第 29 小節（f3360）回到主和弦、鼓收掉，最後半小節（1 秒）淡出；峰值超過 0.9 就整段縮到 0.9。同一檔在 Node 與瀏覽器都能跑，另附 16-bit WAV 編碼給錄影腳本。

**Files:**
- Modify: `assets/station/tour-music.js` — 新檔
- Test: `tests/tour-music.test.js`

**Interfaces:**
- Consumes: nothing from an earlier task（cue 的形狀在這裡定：`{ cuts: [frame], blocks: [frame] }`）。
- Produces: `tourMusic.render(cues)` → `Float32Array`（長度 2646000、峰值 ≤ 0.9）、`tourMusic.wav(pcm)` → `Uint8Array`（16-bit mono 44100 Hz WAV）、`tourMusic.RATE`（44100）；瀏覽器全域 `window.tourMusic`

**Dispatch:** implementer, sonnet — 程式碼全在計畫裡；照抄加跑測試。

- [ ] **Step 1: 寫失敗的測試。** 建立 `tests/tour-music.test.js`：

```js
'use strict';
// assets/station/tour-music.js — the promo's score rendered to PCM: 60 s at
// 44100 Hz, a hit on every cut, never over 0.9, faded over the last half bar,
// the same samples every time, and the WAV header scripts/tour-record.js
// hands to ffmpeg.
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../assets/station/tour-music.js');

// The design's eleven cut starts, and a block on most beats inside them.
const CUTS = [0, 240, 480, 840, 1200, 1560, 1920, 2280, 2640, 3000, 3240];
const BLOCKS = [];
CUTS.forEach((c, i) => {
    const end = i + 1 < CUTS.length ? CUTS[i + 1] : 3600;
    for (let f = c; f < end; f += 30) if ((f - c) % 90 !== 60) BLOCKS.push(f);
});
const CUES = { cuts: CUTS, blocks: BLOCKS };
const pcm = M.render(CUES);
const MS50 = Math.round(0.05 * M.RATE);

function peak(x, from, n) {
    let p = 0;
    for (let i = Math.max(0, from); i < Math.min(x.length, from + n); i++) p = Math.max(p, Math.abs(x[i]));
    return p;
}
function rms(x, from, n) {
    let s = 0;
    for (let i = from; i < from + n; i++) s += x[i] * x[i];
    return Math.sqrt(s / n);
}
// The loudest 50 ms at the cut's own start, over the loudest 50 ms at any
// other beat of the same cut.
function accent(x, i) {
    const c = CUTS[i], end = i + 1 < CUTS.length ? CUTS[i + 1] : 3600;
    let other = 0;
    for (let f = c + 30; f < end; f += 30) other = Math.max(other, peak(x, f * 735, MS50));
    return peak(x, c * 735, MS50) / other;
}

test('the render is sixty seconds of mono samples at 44100 Hz', () => {
    assert.equal(M.RATE, 44100);
    assert.ok(pcm instanceof Float32Array);
    assert.equal(pcm.length, 60 * 44100);
});

// Criterion: a hit within 50 ms of every cut start. Red when: the cuts are
// not voiced (the control below renders the same blocks with no cuts).
test('every cut start carries the loudest 50 ms of its cut', () => {
    CUTS.forEach((c, i) => assert.ok(accent(pcm, i) > 1.25, 'cut at f' + c + ': ' + accent(pcm, i).toFixed(2)));
});

test('control: with no cuts voiced, the same check fails on every one of them', () => {
    const flat = M.render({ cuts: [], blocks: BLOCKS });
    const held = CUTS.filter((c, i) => accent(flat, i) > 1.25);
    assert.deepEqual(held, [], 'still accented without hits');
});

test('the peak is at most 0.9 and the sound is not silent', () => {
    let p = 0;
    for (let i = 0; i < pcm.length; i++) p = Math.max(p, Math.abs(pcm[i]));
    assert.ok(p <= 0.9 + 1e-6, 'peak ' + p);
    assert.ok(p > 0.5, 'peak ' + p);
});

test('the last half bar fades out to silence', () => {
    const halfBar = 44100;
    assert.ok(Math.abs(pcm[pcm.length - 1]) < 1e-3);
    assert.ok(rms(pcm, pcm.length - halfBar / 4, halfBar / 4) < rms(pcm, pcm.length - halfBar - halfBar / 4, halfBar / 4) / 2);
});

test('two renders of one score are the same samples', () => {
    const again = M.render(CUES);
    for (let i = 0; i < pcm.length; i += 997) assert.equal(again[i], pcm[i], 'sample ' + i);
});

test('wav writes a 16-bit mono 44100 Hz header over the samples', () => {
    const b = Buffer.from(M.wav(new Float32Array([0, 1, -1, 0.5])));
    assert.equal(b.toString('latin1', 0, 4), 'RIFF');
    assert.equal(b.toString('latin1', 8, 16), 'WAVEfmt ');
    assert.equal(b.readUInt16LE(22), 1);
    assert.equal(b.readUInt32LE(24), 44100);
    assert.equal(b.readUInt16LE(34), 16);
    assert.equal(b.toString('latin1', 36, 40), 'data');
    assert.equal(b.readUInt32LE(40), 8);
    assert.deepEqual([0, 1, 2, 3].map((i) => b.readInt16LE(44 + 2 * i)), [0, 32767, -32767, 16384]);
});
```

- [ ] **Step 2: 跑，看它失敗。** `node --test tests/tour-music.test.js`：`Cannot find module '../assets/station/tour-music.js'`。

- [ ] **Step 3: 最小實作。** 建立 `assets/station/tour-music.js`：

```js
// assets/station/tour-music.js — the promo's score, as data, and the
// synthesiser that turns it into sound: mono Float32 PCM at 44100 Hz, the
// same samples in the browser (tour-player.js hands them to Web Audio) and in
// Node (scripts/tour-record.js writes them to a WAV). No audio file is kept in
// the repository and nothing is imported: every voice is a formula of time.
//
// 120 BPM in 4/4 at 60 fps: a beat is 30 frames = 22050 samples, a bar 120
// frames = 88200. Frame f starts at sample f × 735. The score reads the
// timeline's cues — `cuts`, the frame each cut starts on, and `blocks`, the
// frame each document block rises on — so the sound lands where the picture
// moves. Bright plucks: a whoosh into every cut and a hit on it, a pluck per
// block, the lead from the route cut (bar 3) on, and the last bar resolved on
// the tonic, faded out over its second half.
(function (root, module) {
    'use strict';

    var RATE = 44100, FPS = 60, BPM = 120, SECONDS = 60;
    var PER_FRAME = RATE / FPS; // 735
    var BEAT = RATE * 60 / BPM; // 22050
    var BAR = BEAT * 4; // 88200
    var LENGTH = RATE * SECONDS; // 2646000

    // The score. Bars count from 0; bar 2 (frame 240) is the drop, bar 28
    // (frame 3360) the resolve.
    var CHORDS = {
        C: { root: 36, tones: [60, 64, 67] },
        G: { root: 43, tones: [59, 62, 67] },
        Am: { root: 45, tones: [57, 60, 64] },
        F: { root: 41, tones: [57, 60, 65] },
    };
    var CYCLE = ['C', 'G', 'Am', 'F'];
    var DROP = 2, RESOLVE = 28;
    function chordAt(bar) {
        if (bar < DROP) return CHORDS[['C', 'Am'][bar]];
        if (bar < RESOLVE) return CHORDS[CYCLE[(bar - DROP) % 4]];
        return CHORDS.C;
    }
    // The lead: eight eighth-notes a bar, as indexes into the chord's tones
    // an octave up (3 is the root two octaves up).
    var LEAD = [0, 2, 1, 3, 2, 1, 0, 2];

    function hz(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

    // A fixed-seed noise source, so two renders are the same samples.
    function noise(seed) {
        var a = seed >>> 0;
        return function () {
            a = (a + 0x6d2b79f5) >>> 0;
            var t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
        };
    }

    function add(out, at, n, fn) {
        var end = Math.min(out.length, at + n);
        for (var i = Math.max(0, at); i < end; i++) out[i] += fn((i - at) / RATE);
    }

    // The voices. Each adds itself into `out` from sample `at`.
    function pluck(out, at, f, gain) {
        add(out, at, Math.round(0.6 * RATE), function (t) {
            var s = 0;
            for (var h = 1; h <= 4; h++) s += Math.sin(2 * Math.PI * f * h * t) * Math.exp(-t * (6 + 5 * h)) / h;
            return gain * s * Math.min(1, t * 400);
        });
    }
    function kick(out, at, gain) {
        add(out, at, Math.round(0.25 * RATE), function (t) {
            var ph = 2 * Math.PI * (50 * t + (100 / 30) * (1 - Math.exp(-30 * t)));
            return gain * Math.sin(ph) * Math.exp(-9 * t);
        });
    }
    function hat(out, at, gain, rnd) {
        add(out, at, Math.round(0.06 * RATE), function (t) { return gain * rnd() * Math.exp(-60 * t); });
    }
    function bass(out, at, f, gain, len) {
        add(out, at, len, function (t) {
            var tri = 2 / Math.PI * Math.asin(Math.sin(2 * Math.PI * f * t));
            return gain * tri * Math.exp(-4 * t) * Math.min(1, t * 200);
        });
    }
    function pad(out, at, tones, gain, len) {
        add(out, at, len, function (t) {
            var env = Math.min(1, t / 0.3) * Math.min(1, (len / RATE - t) / 0.1);
            var s = 0;
            tones.forEach(function (m) {
                var f = hz(m);
                s += Math.sin(2 * Math.PI * f * t) + 0.5 * Math.sin(2 * Math.PI * f * 1.003 * t);
            });
            return gain * env * s / tones.length;
        });
    }
    // The whoosh: filtered noise rising over the 12 frames before a cut and
    // stopping on it.
    function whoosh(out, cut, gain, rnd) {
        var n = 12 * PER_FRAME, at = cut - n, lp = 0;
        for (var i = 0; i < n; i++) {
            if (at + i < 0) { rnd(); continue; }
            var p = i / n, a = 0.02 + 0.3 * p * p;
            lp += a * (rnd() - lp);
            out[at + i] += gain * p * p * lp;
        }
    }
    // The hit on a cut: a low boom and a noise burst, both short.
    function hit(out, at, gain, rnd) {
        add(out, at, Math.round(0.3 * RATE), function (t) {
            return gain * (0.8 * Math.sin(2 * Math.PI * 55 * t) * Math.exp(-10 * t) + 0.5 * rnd() * Math.exp(-25 * t));
        });
    }

    // cues = { cuts: [frame], blocks: [frame] }. Returns LENGTH samples,
    // peak at most 0.9.
    function render(cues) {
        var out = new Float32Array(LENGTH), rnd = noise(9452);
        var frame = function (f) { return Math.round(f * PER_FRAME); };
        var bars = LENGTH / BAR;
        for (var b = 0; b < bars; b++) {
            var at = b * BAR, ch = chordAt(b);
            if (b >= DROP) pad(out, at, ch.tones, 0.05, b >= RESOLVE ? LENGTH - at : BAR);
            if (b >= DROP && b < RESOLVE) {
                for (var k = 0; k < 4; k++) kick(out, at + k * BEAT, 0.45);
                for (k = 0; k < 4; k++) hat(out, at + k * BEAT + BEAT / 2, 0.05, rnd);
                for (k = 0; k < 8; k++) bass(out, at + k * BEAT / 2, hz(ch.root), 0.18, BEAT / 2);
                for (k = 0; k < 8; k++) {
                    var i = LEAD[k], m = i === 3 ? ch.tones[0] + 24 : ch.tones[i] + 12;
                    pluck(out, at + k * BEAT / 2, hz(m), 0.06);
                }
            }
            if (b === RESOLVE) {
                bass(out, at, hz(ch.root), 0.22, LENGTH - at);
                ch.tones.forEach(function (m) { pluck(out, at, hz(m + 12), 0.12); });
            }
        }
        var cuts = (cues && cues.cuts) || [];
        var blocks = (cues && cues.blocks) || [];
        cuts.forEach(function (c) {
            whoosh(out, frame(c), 0.25, rnd);
            hit(out, frame(c), 0.9, rnd);
        });
        // A pluck per block, a step up the chord for each block of the same
        // cut, so a page that fills climbs.
        blocks.forEach(function (f) {
            var cut = 0;
            cuts.forEach(function (c) { if (c <= f) cut = c; });
            var n = blocks.filter(function (g) { return g >= cut && g < f; }).length;
            var tones = chordAt(Math.floor(f / 120)).tones;
            pluck(out, frame(f), hz(tones[n % 3] + 12 * (1 + Math.floor(n / 3) % 2)), 0.2);
        });
        var peak = 0;
        for (var j = 0; j < LENGTH; j++) peak = Math.max(peak, Math.abs(out[j]));
        var g = peak > 0.9 ? 0.9 / peak : 1;
        var fade = BAR / 2;
        for (j = 0; j < LENGTH; j++) {
            var r = j >= LENGTH - fade ? (LENGTH - j) / fade : 1;
            out[j] *= g * r;
        }
        return out;
    }

    // 16-bit PCM WAV, mono, RATE Hz: the bytes scripts/tour-record.js hands
    // to ffmpeg. A Uint8Array, so the same function runs in a page.
    function wav(pcm) {
        var n = pcm.length, bytes = new Uint8Array(44 + n * 2), v = new DataView(bytes.buffer);
        var str = function (o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
        str(0, 'RIFF');
        v.setUint32(4, 36 + n * 2, true);
        str(8, 'WAVE');
        str(12, 'fmt ');
        v.setUint32(16, 16, true);
        v.setUint16(20, 1, true);
        v.setUint16(22, 1, true);
        v.setUint32(24, RATE, true);
        v.setUint32(28, RATE * 2, true);
        v.setUint16(32, 2, true);
        v.setUint16(34, 16, true);
        str(36, 'data');
        v.setUint32(40, n * 2, true);
        for (var i = 0; i < n; i++) {
            var s = Math.max(-1, Math.min(1, pcm[i]));
            v.setInt16(44 + i * 2, Math.round(s * 32767), true);
        }
        return bytes;
    }

    module.exports = { RATE: RATE, render: render, wav: wav };
    if (typeof window !== 'undefined') root.tourMusic = module.exports;
})(typeof window !== 'undefined' ? window : globalThis, typeof module !== 'undefined' ? module : {});
```

- [ ] **Step 4: 跑，看它通過。** `node --test tests/tour-music.test.js`，7 個全綠（副本上約 4 秒：兩次完整合成各約 1.4 秒）。對照組那條要綠：沒有 cut 的同一份譜，十一個 cut 起點的「重音比」都掉到 1.25 以下（副本量到 0.89–1.04；有 cut 時是 1.98–4.30）。

- [ ] **Step 5: Commit** — 路徑 `assets/station/tour-music.js`、`tests/tour-music.test.js`；訊息 `feat(tour): synthesised 60-second score, one module for page and recorder`。

## Task 3: 字串表與文件頁 tour-doc.js

新檔：影片裡每個會翻譯的字串放進 `S`，一個 key 一組 `{ zh, en }`，英文取自分鏡圖 `?lang=en`（任務名 "Multi-warehouse transfers" 等）；`t(P, key)` 依 `P.lang` 取。路徑、指令、stage 名兩種語言一樣，不進表。其餘是每格共用的「文件頁」：`page()` 畫頁框與檔名分頁、可選的 stage 表頭（stage 名、產出、路線點）、依拍浮入的方塊（expo-out 18 格、上移 10），新方塊的底超過視窗底時整頁上捲（expo-out 20 格），字幕在視窗下；零件 `pill`、`dots`、`rail`、`li`、`heading`、`callout`、`cap`、`rise`、`risen`、`runsWidth`。所有字都經 `E.fitText`／`E.fitRuns`，所以都量過寬。中英共用同一組座標。

**Files:**
- Modify: `assets/station/tour-doc.js` — 新檔
- Read: `assets/station/tour.js` — `E.font`、`E.fitText`、`E.fitRuns`、`E.fade`、`E.box`、`E.circle`、`E.line`、`E.expoOut`、`E.prog`、`E.ROUTE`
- Read: `tests/tour-ctx.js` — `fakeCtx`
- Test: `tests/tour-doc.test.js`

**Interfaces:**
- Consumes: `E.font`, `E.fitText`, `E.fitRuns`, `E.palette(read, lang)`（Task 1）
- Produces: `tourDoc.S`（key → `{ zh, en }`）、`tourDoc.t(P, key)` → 字串（沒有的 key 丟 `tour: no string <key>`）、`tourDoc.page(ctx, P, l, spec)`（spec：`tab` runs、`head` stage 序號、`top`（預設 14）、`bottom`（預設 360；有字幕時 294 或 302）、`tall`、`blocks: [{ at, h, draw(ctx, P, x, y, w, l) }]`、`cap` 字串 key）、`tourDoc.rise(l, at)`、`tourDoc.risen(ctx, k, fn)`、`tourDoc.runsWidth(ctx, P, runs)`、`tourDoc.pill(ctx, P, s, x, cy, kind, o)` → 寬（kind：`stale` `gate` `ok` `live`）、`tourDoc.dots(ctx, P, x, cy, at, n, d)`、`tourDoc.rail(ctx, P, x, y, w, lit, now)`、`tourDoc.li(ctx, P, x, y, w, runs)`、`tourDoc.heading(ctx, P, cls, marks, s, x, cy, w)`、`tourDoc.callout(ctx, P, x, y, w, h, bar, runs, p)`、`tourDoc.cap(ctx, P, key, l, at)`、`tourDoc.CX`（70）、`tourDoc.CW`（500）；瀏覽器全域 `window.tourDoc`

**Dispatch:** implementer, sonnet — 程式碼全在計畫裡；照抄加跑測試。

- [ ] **Step 1: 寫失敗的測試。** 建立 `tests/tour-doc.test.js`：

```js
'use strict';
// assets/station/tour-doc.js — the promo's string table and the document
// page every cut is drawn as, read back through tests/tour-ctx.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../assets/station/tour.js');
const D = require('../assets/station/tour-doc.js');
const { fakeCtx } = require('./tour-ctx.js');

const ZH = T.palette(() => '', 'zh');
const EN = T.palette(() => '', 'en');
const CJK = /[⺀-鿿豈-﫿＀-￯　-〿]/;

// Criterion: every string has both languages, and the English carries no
// Chinese. Red when: a pair is left half-filled, or the en side was copied
// from the zh one.
test('every string in the table has a zh and an en, and the en holds no CJK', () => {
    const keys = Object.keys(D.S);
    assert.ok(keys.length >= 75, 'only ' + keys.length + ' strings');
    for (const k of keys) {
        assert.ok(D.S[k].zh && D.S[k].en, k);
        assert.notEqual(D.S[k].zh, D.S[k].en, k);
        assert.ok(!CJK.test(D.S[k].en), k + ': ' + D.S[k].en);
    }
    assert.equal(D.S.task.en, 'Multi-warehouse transfers');
});

test('t reads the palette\'s language and refuses a key that is not there', () => {
    assert.equal(D.t(ZH, 'task'), '多倉庫庫存與調撥');
    assert.equal(D.t(EN, 'task'), 'Multi-warehouse transfers');
    assert.throws(() => D.t(ZH, 'nope'), /tour: no string nope/);
});

function spec(extra) {
    return Object.assign({
        tab: [['cm', 'docs/'], ['tab', 'x.md']], head: 2,
        blocks: [
            { at: 30, h: 33, draw: (ctx, P, x, y, w) => D.li(ctx, P, x, y, w, [['li', 'first']]) },
            { at: 60, h: 400, draw: (ctx, P, x, y, w) => D.li(ctx, P, x, y, w, [['li', 'tall']]) },
        ],
    }, extra);
}

test('page: the tab and the header rise from 0, each block only from its own beat', () => {
    const at = (l, P) => { const ctx = fakeCtx(); D.page(ctx, P || ZH, l, spec()); return ctx.texts(); };
    assert.deepEqual(at(0), []);
    assert.deepEqual(at(18), ['docs/', 'x.md', 'plan', D.S['pr.plan'].zh]);
    assert.ok(at(29).every((s) => s !== 'first'));
    assert.ok(at(31).includes('first'));
    assert.ok(!at(59).includes('tall') && at(61).includes('tall'));
    assert.ok(at(18, EN).includes(D.S['pr.plan'].en));
});

// Criterion: a block that would fall below the window scrolls the page up.
// Red when: the page never moves, so a late block is drawn off the frame.
test('page scrolls up once a block would pass the window\'s foot, and not before', () => {
    const shift = (l) => {
        const ctx = fakeCtx();
        D.page(ctx, ZH, l, spec());
        return ctx.calls.filter((c) => c[0] === 'translate' && c[1] === 0).map((c) => c[2])[0];
    };
    assert.equal(shift(40), -0);
    assert.ok(shift(62) < 0);
    assert.ok(shift(100) < shift(62));
    const clip = fakeCtx();
    D.page(clip, ZH, 0, spec({ top: 46, bottom: 294 }));
    assert.deepEqual(clip.calls.find((c) => c[0] === 'rect'), ['rect', 0, 46, 640, 248]);
});

test('page draws its caption under the window from frame 0', () => {
    const ctx = fakeCtx();
    D.page(ctx, EN, 10, spec({ cap: 'cap.plan', bottom: 302 }));
    assert.ok(ctx.texts().includes(D.S['cap.plan'].en));
});

test('rise is 0 before its beat and 1 once settled; risen draws nothing at 0', () => {
    assert.equal(D.rise(29, 30), 0);
    assert.equal(D.rise(48, 30), 1);
    let ran = false;
    D.risen(fakeCtx(), 0, () => { ran = true; });
    assert.equal(ran, false);
});

test('the pieces: pill, dots, rail, heading, callout and cap', () => {
    let ctx = fakeCtx();
    const w = D.pill(ctx, ZH, '過時', 100, 50, 'stale');
    assert.equal(w, 2 * 12.5 + 18);
    assert.ok(ctx.calls.some((c) => c[0] === '=fillStyle' && c[1] === T.DARK.staleBg));
    ctx = fakeCtx();
    D.pill(ctx, ZH, '執行中', 300, 50, 'live', { right: true });
    assert.equal(ctx.calls.filter((c) => c[0] === 'arc').length, 1);
    ctx = fakeCtx();
    D.dots(ctx, ZH, 0, 10, 2, 7, 10);
    assert.equal(ctx.calls.filter((c) => c[0] === 'arc').length, 8);
    ctx = fakeCtx();
    D.rail(ctx, ZH, 70, 100, 500, 3, 2);
    assert.deepEqual(ctx.texts(), T.ROUTE);
    ctx = fakeCtx();
    D.heading(ctx, ZH, 'h2', '##', 'Ready', 70, 100, 500);
    assert.deepEqual(ctx.texts(), ['## ', 'Ready']);
    ctx = fakeCtx();
    D.callout(ctx, ZH, 70, 100, 500, 40, T.DARK.good, [['li', 'a']], 0.4);
    assert.deepEqual(ctx.texts(), []);
    ctx = fakeCtx();
    D.cap(ctx, ZH, 'cap.hook', 20, 0);
    assert.deepEqual(ctx.texts(), [D.S['cap.hook'].zh]);
    assert.equal(D.runsWidth(fakeCtx(), ZH, [['li', 'ab'], ['code', 'cd']]), 2 * 14.5 * 0.56 + 2 * 14.5 * 0.6);
    assert.equal(D.CX + D.CW, 570);
});
```

- [ ] **Step 2: 跑，看它失敗。** `node --test tests/tour-doc.test.js`：`Cannot find module '../assets/station/tour-doc.js'`。

- [ ] **Step 3: 最小實作。** 建立 `assets/station/tour-doc.js`：

```js
// assets/station/tour-doc.js — what every cut of the promo is made of: the
// string table, one `{ zh, en }` pair per string the frames print, and the
// document page the storyboard draws each cut as
// (.fankeel/build/2026-09-28-tour-blocks/mockup.html): a panel with a file-name
// tab, an optional stage header, and blocks that rise into it one beat at a
// time, the page scrolling up when a new block would fall below the window.
// Every size and colour is the storyboard's, which are station.css's. The
// language is P.lang (tour.js palette); a string is `t(P, key)`.
(function (root, module) {
    'use strict';
    var E = root.tourEngine || require('./tour.js');

    // Every string the video prints, in both languages. Paths, commands and
    // stage names are the same in both and are not here; the English is the
    // storyboard's `?lang=en`.
    var S = {
        'cap.hook': { zh: '功能一層疊一層，文件一份接一份。', en: 'Features pile up. So do the docs.' },
        'cap.route': { zh: 'fankeel 替每個任務排一條工作流。', en: 'fankeel gives every task its own workflow.' },
        'cap.plan': { zh: '自動拆成任務，看出誰能一起做。', en: 'Split into tasks, and see which can run together.' },
        'cap.build': { zh: '能平行的一起跑，該排隊的排隊。', en: 'Parallel where it can, queued where it must.' },
        'cap.clash': { zh: '兩個 session 動到同一個檔，當下就標出來。', en: 'Two sessions touch one file, and it is flagged on the spot.' },
        'pr.survey': { zh: '產出：已經有什麼', en: 'Produces: a statement of what already exists' },
        'pr.design': { zh: '產出：一個有人同意的做法', en: 'Produces: an approach someone agreed to' },
        'pr.plan': { zh: '產出：沒上下文也能照做的拆解', en: 'Produces: steps a newcomer could execute' },
        'pr.build': { zh: '產出：改動本身', en: 'Produces: the change itself' },
        'pr.verify': { zh: '產出：證據，不是信心', en: 'Produces: evidence, not confidence' },
        'pr.audit': { zh: '產出：哪些已經不成立', en: 'Produces: a list of what is no longer true' },
        'pr.land': { zh: '產出：倉庫不比接手時亂', en: 'Produces: a repository no dirtier than you found it' },
        'task': { zh: '多倉庫庫存與調撥', en: 'Multi-warehouse transfers' },
        'task2': { zh: '庫存報表加 CSV 匯出', en: 'Stock report CSV export' },
        'tab.station': { zh: '監控站 · ', en: 'Station · ' },
        'stale': { zh: '已過時', en: 'Stale' },
        'hook.title': { zh: '庫存模組', en: 'Inventory' },
        'hook.getStock': { zh: '單倉庫存，回傳目前數量', en: 'Current quantity, single warehouse' },
        'hook.csv': { zh: '庫存報表可以匯出 CSV', en: 'Stock report exports to CSV' },
        'hook.sched': { zh: '匯出排程：見 ', en: 'Export schedule: see ' },
        'hook.retry': { zh: '匯出失敗時自動重試三次', en: 'Failed exports retry three times' },
        'hook.field': { zh: '報表欄位', en: 'Report field' },
        'hook.source': { zh: '從哪裡來', en: 'Source' },
        'hook.product': { zh: '商品', en: 'Product' },
        'hook.qty': { zh: '數量', en: 'Quantity' },
        'route.n': { zh: ' · 7 站', en: ' · 7 stages' },
        'survey.h': { zh: '已經有什麼', en: 'What already exists' },
        'survey.wh': { zh: '倉庫資料表，目前只有一個預設倉', en: 'Warehouse table, only the default one so far' },
        'survey.tr': { zh: '調撥的空殼，還沒接上路由', en: 'Transfer stub, not routed yet' },
        'survey.doc': { zh: '庫存說明，寫的是單倉', en: 'Inventory docs, still single-warehouse' },
        'survey.class': { zh: '　動庫存和調撥兩塊，訂單流程不動', en: ' Touches stock and transfers, not orders' },
        'design.p': { zh: '庫存改用（商品, 倉庫）當鍵；一張調撥單寫成兩筆方向相反的異動。', en: 'Key stock by (product, warehouse); a transfer writes two opposite movements.' },
        'design.file': { zh: '檔案', en: 'File' },
        'design.change': { zh: '改動', en: 'Change' },
        'design.wh': { zh: '加 warehouseId，舊呼叫帶預設倉', en: 'Add warehouseId; old calls get the default' },
        'design.tr': { zh: '新增：建立、確認調撥', en: 'New: create and confirm transfers' },
        'design.doc': { zh: '改寫成多倉', en: 'Rewrite for multi-warehouse' },
        'design.gate': { zh: '等你核准', en: 'Awaiting approval' },
        'design.q': { zh: '照這個做法做？', en: 'Go with this approach?' },
        'design.yes': { zh: '✓ 核准', en: '✓ Approve' },
        'design.no': { zh: '改做法', en: 'Revise' },
        'design.ok': { zh: '已核准', en: 'Approved' },
        'par': { zh: '同時', en: 'In parallel' },
        'par.why': { zh: 'Files 不重疊', en: 'Files don\'t overlap' },
        'plan.a': { zh: '倉庫維度', en: 'Warehouse key' },
        'plan.b': { zh: '調撥 API', en: 'Transfer API' },
        'plan.c': { zh: '調撥畫面', en: 'Transfer screen' },
        'waits': { zh: '等 A', en: 'waits on A' },
        'build.run': { zh: 'implementer 執行中', en: 'implementer running' },
        'build.review': { zh: 'reviewer 審查中', en: 'reviewer reviewing' },
        'build.done': { zh: 'implementer、reviewer 完成', en: 'implementer, reviewer done' },
        'build.queued': { zh: '排隊中', en: 'queued' },
        'verify.must': { zh: '要成立的', en: 'Must hold' },
        'verify.ev': { zh: '證據', en: 'Evidence' },
        'verify.r1': { zh: '調撥後兩倉加總不變', en: 'Transfers keep the total' },
        'verify.pass': { zh: ' 通過', en: ' passes' },
        'verify.r2': { zh: '單倉的舊呼叫照常', en: 'Old calls still work' },
        'verify.fail': { zh: ' 舊案例失敗：沒帶預設倉', en: ' old case fails: no default warehouse' },
        'verify.fixed': { zh: ' 補上預設倉後通過', en: ' passes with the default added' },
        'verify.r3': { zh: ' 寫的是多倉', en: ' describes multi-warehouse' },
        'verify.clean': { zh: ' 沒有錯', en: ' finds no errors' },
        'audit.rewritten': { zh: 'build 剛改寫', en: 'just rewritten by build' },
        'audit.stale': { zh: '過時', en: 'Stale' },
        'audit.stock': { zh: '還在寫 getStock(sku)', en: 'still says getStock(sku)' },
        'audit.stockTodo': { zh: '還在寫 getStock(sku)，進 TODO', en: 'still says getStock(sku), added to TODO' },
        'audit.landed': { zh: '計畫已經落地', en: 'plan has landed' },
        'audit.archived': { zh: '已歸檔', en: 'archived' },
        'land.stock': { zh: '改寫成多倉', en: 'needs a multi-warehouse rewrite' },
        'land.print': { zh: '列印格式', en: 'Print format' },
        'land.on': { zh: '倉庫給調撥單的列印格式.', en: 'the warehouse\'s print format for transfer slips.' },
        'land.slip': { zh: '調撥單列印', en: 'Print transfer slips' },
        'land.clean': { zh: '工作樹乾淨', en: 'Working tree clean' },
        'clash.running': { zh: '執行中', en: 'Running' },
        'clash.editing': { zh: '正在改', en: 'Editing' },
        'clash.same': { zh: '同一個檔', en: 'same file' },
        'outro.install': { zh: '安裝', en: 'Install' },
        'outro.two': { zh: '兩行指令，裝進 Claude Code。', en: 'Two commands, and it is in Claude Code.' },
        'outro.tag': { zh: '跟 AI 開發得再久，也不堆過時的引用和死程式。', en: 'Build with AI as long as you like — without piling up stale references and dead code.' },
    };
    function t(P, key) {
        if (!Object.prototype.hasOwnProperty.call(S, key)) throw new Error('tour: no string ' + key);
        return S[key][P.lang === 'en' ? 'en' : 'zh'];
    }

    // The storyboard's .win: 48 in from each side; the page's padding puts
    // the content at x 70, 500 wide.
    var X = 48, W = 544, CX = 70, CW = 500;
    var RISE = 18, SCROLL = 20;
    // A block rising in: 0 before `at`, 1 once it has settled (expo-out 18).
    function rise(l, at) { return E.expoOut(E.prog(l, at, RISE)); }
    // Draw `fn` risen by k: faded in and moved up the last 10 units.
    function risen(ctx, k, fn) {
        E.fade(ctx, k, function () {
            ctx.save();
            ctx.translate(0, 10 * (1 - k));
            fn();
            ctx.restore();
        });
    }

    function runsWidth(ctx, P, runs) {
        return runs.reduce(function (w, r) {
            ctx.font = E.font(P, r[0]);
            return w + ctx.measureText(r[1]).width;
        }, 0);
    }

    // A station pill (.pill, .pill.stale / .gate / .ok / .live): 20 high,
    // rounded, 9 either side of its text. `x` is its left edge, or its right
    // edge with o.right. Returns its width.
    var PILL = {
        stale: ['staleBg', 'stale'], gate: ['staleBg', 'staleInk'], ok: ['upBg', 'good'], live: ['liveBg', 'live'],
    };
    function pill(ctx, P, s, x, cy, kind, o) {
        o = o || {};
        var c = PILL[kind], dot = kind === 'live' ? 12 : 0;
        ctx.font = E.font(P, 'pill');
        var w = Math.min(o.maxW || 220, ctx.measureText(s).width) + 18 + dot;
        var x0 = o.right ? x - w : x;
        E.box(ctx, x0, cy - 10, w, 20, 10, P[c[0]]);
        if (dot) E.circle(ctx, x0 + 12, cy, 3.5, P[c[1]]);
        E.fitText(ctx, P, 'pill', s, x0 + 9 + dot, cy, (o.maxW || 220), { middle: true, lines: 1, fill: P[c[1]] });
        return w;
    }

    // The route as dots (.route): filled up to `at`, `at` itself filled and
    // ringed, hollow after. `n` stops (seven unless given), `d` across each.
    function dots(ctx, P, x, cy, at, n, d) {
        n = n || E.ROUTE.length;
        d = d || 8;
        var r = d / 2, cx = x + r;
        for (var j = 0; j < n; j++) {
            var c = P.st[E.ROUTE[j]];
            if (j === at) {
                cx += 3;
                E.circle(ctx, cx, cy, r, c);
                E.circle(ctx, cx, cy, r + 3, null, c, 1.5);
                cx += 3;
            } else if (j < at) E.circle(ctx, cx, cy, r, c);
            else E.circle(ctx, cx, cy, r - 0.75, null, P.rule2, 1.5);
            cx += d + 3;
        }
    }
    function dotsWidth(n, d, ringed) { return n * d + (n - 1) * 3 + (ringed ? 6 : 0); }

    // The session page's rail (.rail): seven columns across `w`, a 14-unit
    // dot over each stage's name, a solid link behind a lit stop and a dashed
    // one after. `lit` stops are lit; with `now`, that one is ringed.
    function rail(ctx, P, x, y, w, lit, now) {
        var col = w / E.ROUTE.length;
        E.ROUTE.forEach(function (s, j) {
            var cx = x + col * (j + 0.5), cy = y + 11, c = P.st[s];
            if (j < E.ROUTE.length - 1) {
                var solid = j < lit - 1 || (j < lit && now !== j);
                E.line(ctx, [[cx + 12, cy], [cx + col - 12, cy]], solid ? P.ink2 : P.rule2, 2, solid ? null : [5, 5]);
            }
            if (j === now) {
                E.circle(ctx, cx, cy, 11, c);
                E.circle(ctx, cx, cy, 7, P.panel);
                E.circle(ctx, cx, cy, 5.5, c);
            } else if (j < lit) E.circle(ctx, cx, cy, 7, c);
            else E.circle(ctx, cx, cy, 6.25, null, P.rule2, 1.5);
            E.text(ctx, P, 'nm', s, cx, cy + 27, { align: 'center', fill: j < lit ? P.ink2 : P.muted, weight: j === now ? '700' : null });
        });
    }

    // One list row (.bk-li): a rule on top, 33 high, runs centred in it.
    function li(ctx, P, x, y, w, runs) {
        E.line(ctx, [[x, y + 0.5], [x + w, y + 0.5]], P.rule, 1);
        E.fitRuns(ctx, P, runs, x, y + 17, w);
    }
    // A heading with its markdown marks (.bk-h2 / .bk-h3): `##` in mono,
    // muted, then the text.
    function heading(ctx, P, cls, marks, s, x, cy, w) {
        E.fitRuns(ctx, P, [['cm', marks + ' '], [cls, s]], x, cy, w);
    }
    // A callout (.bk-co): the inset panel with a 3-unit bar on its left in
    // `bar`'s colour, drawn to `p` of its height (the survey cut draws the bar
    // first), runs centred in it.
    function callout(ctx, P, x, y, w, h, bar, runs, p) {
        var k = p === undefined ? 1 : p;
        E.box(ctx, x, y, w, h, 6, P.inset);
        E.box(ctx, x, y, 3, h * Math.min(1, k * 2), 1.5, bar);
        if (k > 0.5) E.fade(ctx, (k - 0.5) * 2, function () { E.fitRuns(ctx, P, runs, x + 12, y + h / 2, w - 24); });
    }
    // The caption under a page (.cap): 21 semibold, centred, faded in from `at`.
    function cap(ctx, P, key, l, at) {
        E.fade(ctx, E.expoOut(E.prog(l, at || 0, 12)), function () {
            E.fitText(ctx, P, 'cap', t(P, key), 320, 333, 560, { align: 'center', lines: 1 });
        });
    }

    // The stage header (.pg-h): the stage name in its colour, what it
    // produces (two lines at most, when the longest English one needs them),
    // and the route dots with this stage ringed; a rule under it. 50 high.
    function head(ctx, P, i, y) {
        var s = E.ROUTE[i], cy = y + 14;
        ctx.font = E.font(P, 'ph');
        var nw = ctx.measureText(s).width;
        E.fitText(ctx, P, 'ph', s, CX, cy, 200, { middle: true, lines: 1, fill: P.st[s] });
        var dw = dotsWidth(7, 10, true);
        E.fitText(ctx, P, 'pd', t(P, 'pr.' + s), CX + nw + 12, cy, CW - nw - 12 - dw - 12, { middle: true, lines: 2, leading: 1.1 });
        dots(ctx, P, CX + CW - dw, cy, i, 7, 10);
        E.line(ctx, [[CX, y + 38.5], [CX + CW, y + 38.5]], P.rule, 1);
    }

    // The page. spec: tab — runs for the tab label; head — a stage index, or
    // none; top, bottom — the window (14 and 360 unless given; 294 with a
    // caption under it); tall — the panel runs to the frame's foot even when
    // the blocks do not; blocks — [{ at, h, draw(ctx, P, x, y, w, l) }] top to
    // bottom from under the header; cap — a caption key, in from frame 0.
    // The whole page rises at 0; each block at its own `at`; once a settled
    // block's foot would pass the window's, the page scrolls up by the
    // difference (expo-out 20 from that block's `at`).
    function page(ctx, P, l, spec) {
        var top = spec.top === undefined ? 14 : spec.top, bottom = spec.bottom || 360;
        var y0 = top + 26, y = y0 + 14 + (spec.head === undefined ? 0 : 50), ys = [], scroll = 0;
        spec.blocks.forEach(function (b) {
            ys.push(y);
            y += b.h;
            var need = y + 16 - bottom;
            if (need > 0) scroll = Math.max(scroll, need * E.expoOut(E.prog(l, b.at, SCROLL)));
        });
        var foot = Math.max(y + 16, spec.tall ? 360 + scroll : 0);
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, top, 640, bottom - top);
        ctx.clip();
        ctx.translate(0, -scroll);
        risen(ctx, rise(l, 0), function () {
            var tw = Math.min(W, runsWidth(ctx, P, spec.tab) + 24);
            E.box(ctx, X, y0 - 24, tw, 30, 6, P.panel);
            E.fitRuns(ctx, P, spec.tab, X + 12, y0 - 12, W - 24);
            E.box(ctx, X, y0, W, foot - y0, 10, P.panel);
            if (spec.head !== undefined) head(ctx, P, spec.head, y0 + 14);
        });
        spec.blocks.forEach(function (b, i) {
            var k = rise(l, b.at);
            if (k > 0) risen(ctx, k, function () { b.draw(ctx, P, CX, ys[i], CW, l); });
        });
        ctx.restore();
        if (spec.cap) cap(ctx, P, spec.cap, l, 0);
    }

    module.exports = {
        S: S, t: t, CX: CX, CW: CW, rise: rise, risen: risen, runsWidth: runsWidth,
        pill: pill, dots: dots, rail: rail, li: li, heading: heading, callout: callout, cap: cap, page: page,
    };
    if (typeof window !== 'undefined') root.tourDoc = module.exports;
})(typeof window !== 'undefined' ? window : globalThis, typeof module !== 'undefined' ? module : {});
```

- [ ] **Step 4: 跑，看它通過。** `node --test tests/tour-doc.test.js`，7 個全綠。

- [ ] **Step 5: Commit** — 路徑 `assets/station/tour-doc.js`、`tests/tour-doc.test.js`；訊息 `feat(tour): the zh/en string table and the document page every cut draws`。

## Task 4: 前六格 tour-opening.js（hook … build）

新檔：hook（`docs/inventory.md` 一拍長一塊、整頁上捲、f180 三塊轉灰劃線、f210/214/218「已過時」彈入）、route（任務卡＋字幕，f30 起一拍亮一站，剛亮的帶外圈）、survey（表頭、`## 已經有什麼`、三列找到的檔、第 6 拍留空、f180 `class: bounded` 提示框先畫色條）、design（一句做法、檔案表、f210 選項卡「等你核准」、f270 按下「✓ 核准」、f300「已核准」）、plan（A、B、C 三張卡各一拍；f150「同時」框沿 A、B 畫出、兩張滑進框；f180 C 落到下一排；f210 A→C 箭頭與「等 A」、C 的 `Consumes: A` 轉 plan 色——對應 `lib/plantasks.js` 依 `Files:` 不重疊分組、`Consumes` 排後面）、build（帳本；A、B 同一框；C 虛框排隊；f90 A、B 同一拍亮綠「implementer 執行中」、f180 各一顆 reviewer、f210 同一拍 ○→✓；C 到 f240 才亮綠、f300 reviewer、f330 ✓）。每格是自己區域格數 `l` 的純函數；`beats` 是方塊浮入的格（全是 30 的倍數，第一個是 0），給配樂下 pluck。

**Files:**
- Modify: `assets/station/tour-opening.js` — 新檔
- Read: `assets/station/tour-doc.js` — `D.page`、`D.t`、`D.li`、`D.heading`、`D.callout`、`D.pill`、`D.rail`、`D.rise`、`D.risen`、`D.runsWidth`、`D.CW`、`D.S`
- Read: `assets/station/tour.js` — `E.fitText`、`E.fitRuns`、`E.font`、`E.prog`、`E.expoOut`、`E.backOut`、`E.lerp`、`E.line`、`E.box`、`E.circle`、`E.rr`、`E.fade`、`E.palette`、`E.ROUTE`
- Read: `tests/tour-ctx.js` — `fakeCtx`、`sweep`
- Test: `tests/tour-opening.test.js`

**Interfaces:**
- Consumes: `tourDoc.page(ctx, P, l, spec)`, `tourDoc.t(P, key)`, `tourDoc.S`（Task 3）；`E.fitText`, `E.fitRuns`（Task 1）；`sweep(T, frames, draw)`（Task 1）
- Produces: `tourOpening.CUTS` — `[{ name, len, beats, draw(ctx, P, l) }]`，依序 `hook` 240、`route` 240、`survey` 360、`design` 360、`plan` 360、`build` 360；瀏覽器全域 `window.tourOpening`

**Dispatch:** implementer, sonnet — 程式碼全在計畫裡；照抄加跑測試。

- [ ] **Step 1: 寫失敗的測試。** 建立 `tests/tour-opening.test.js`：

```js
'use strict';
// assets/station/tour-opening.js — the first six cuts (hook … build), each
// drawn alone at its own local frames, in both languages: what each still of
// the storyboard shows, that every string keeps to its box, that the mono
// face holds only ASCII, and that no terminal is drawn anywhere.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const T = require('../assets/station/tour.js');
const D = require('../assets/station/tour-doc.js');
const { CUTS } = require('../assets/station/tour-opening.js');
const { fakeCtx, sweep } = require('./tour-ctx.js');

const LANGS = { zh: T.palette(() => '', 'zh'), en: T.palette(() => '', 'en') };
const cut = (name) => CUTS.find((c) => c.name === name);
function shot(name, l, lang) {
    const ctx = fakeCtx();
    cut(name).draw(ctx, LANGS[lang || 'zh'], l);
    return ctx.texts();
}
const s = (key, lang) => D.S[key][lang || 'zh'];

test('six cuts, 240 or 360 frames, their blocks on the beat', () => {
    assert.deepEqual(CUTS.map((c) => [c.name, c.len]), [['hook', 240], ['route', 240], ['survey', 360], ['design', 360], ['plan', 360], ['build', 360]]);
    for (const c of CUTS) {
        assert.equal(c.beats[0], 0, c.name);
        for (const b of c.beats) assert.ok(b % 30 === 0 && b < c.len, c.name + ' ' + b);
    }
});

// Criterion: each still of cut-hook … cut-build draws what the storyboard's
// still shows. Red when: a cut draws an empty page, or the wrong block list.
test('hook: the doc grows, then three blocks are marked stale', () => {
    for (const lang of ['zh', 'en']) {
        const early = shot('hook', 66, lang);
        assert.ok(early.includes(s('hook.title', lang)) && early.includes(s('cap.hook', lang)), early.join(' | '));
        assert.ok(!early.includes(s('stale', lang)));
        const late = shot('hook', 225, lang);
        assert.equal(late.filter((x) => x === s('stale', lang)).length, 3, late.join(' | '));
        assert.ok(late.includes('getStock(sku)') && late.includes('export-plan-v2.md'));
    }
});

test('route: the task card, and one stage lit a beat', () => {
    const t = shot('route', 225, 'en');
    assert.ok(t.includes('Multi-warehouse transfers') && t.includes(s('cap.route', 'en')));
    assert.deepEqual(T.ROUTE.filter((x) => t.includes(x)), T.ROUTE);
    const arcs = (l) => { const ctx = fakeCtx(); cut('route').draw(ctx, LANGS.zh, l); return ctx.calls.filter((c) => c[0] === 'arc').length; };
    assert.ok(arcs(105) > arcs(15), 'lit stops draw a centre and a ring');
});

test('survey: three files found, then the class callout', () => {
    const mid = shot('survey', 135);
    for (const f of ['src/stock/warehouse.ts', 'src/transfer/', 'docs/inventory.md']) assert.ok(mid.includes(f), f);
    assert.ok(!mid.includes('class: bounded'));
    const end = shot('survey', 330, 'en');
    assert.ok(end.includes('class: bounded') && end.includes(s('pr.survey', 'en')), end.join(' | '));
});

test('design: the approach, the file table, the gate, then 已核准', () => {
    const gate = shot('design', 225);
    assert.ok(gate.includes(s('design.gate')) && gate.includes(s('design.yes')) && gate.includes('src/transfer/transfer.ts'));
    assert.ok(!gate.includes(s('design.ok')));
    const ok = shot('design', 315, 'en');
    assert.ok(ok.includes('Approved') && !ok.includes('Awaiting approval'), ok.join(' | '));
});

// Criterion: plan shows A and B side by side under 同時 and C after A.
// Red when: the frame, the arrow or `Consumes: A` never appear.
test('plan: A and B in one 同時 frame, C under it waiting on A', () => {
    const before = shot('plan', 105);
    assert.ok(before.includes('src/stock/warehouse.ts') && before.includes('src/transfer/api.ts') && before.includes('src/transfer/ui.vue'));
    assert.ok(!before.includes(s('par')) && !before.includes(s('waits')));
    const after = shot('plan', 330, 'en');
    assert.ok(after.includes('In parallel') && after.includes('waits on A') && after.includes('Consumes: '), after.join(' | '));
});

test('build: A and B run together, C only after them', () => {
    const run = shot('build', 105, 'en');
    assert.equal(run.filter((x) => x === 'implementer running').length, 2, run.join(' | '));
    assert.ok(run.includes('queued'));
    const ab = shot('build', 255, 'en');
    assert.ok(ab.includes('Task A: complete') && ab.includes('Task B: complete') && ab.includes('implementer running'));
    const all = shot('build', 345, 'en');
    assert.ok(all.includes('Task C: complete'), all.join(' | '));
});

// Criterion: every string these cuts print is measured and keeps to its
// box, in both languages. Red when: a box is narrower than its English.
test('every string of these cuts fits its box in zh and en, and the mono face holds only ASCII', () => {
    const keys = new Set();
    for (const lang of ['zh', 'en']) {
        const frames = [];
        for (const c of CUTS) for (let l = 0; l < c.len; l += 5) frames.push([c, l]);
        const r = sweep(T, frames, (ctx, [c, l]) => c.draw(ctx, LANGS[lang], l));
        assert.deepEqual(r.log.filter((e) => e.over).map((e) => e.s), [], lang);
        assert.deepEqual(r.monoWide, [], lang);
        assert.deepEqual(r.nonFinite, [], lang);
        const drawn = r.log.map((e) => e.s).join('\n');
        Object.keys(D.S).forEach((k) => { if (drawn.includes(D.S[k][lang].trim())) keys.add(lang + ' ' + k); });
    }
    for (const k of ['task', 'cap.hook', 'cap.route', 'cap.plan', 'cap.build', 'pr.survey', 'pr.design', 'pr.plan', 'pr.build', 'design.ok', 'build.done']) {
        assert.ok(keys.has('zh ' + k) && keys.has('en ' + k), k);
    }
});

test('no terminal: nothing here draws a statusline or a terminal chrome', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'tour-opening.js'), 'utf8');
    assert.doesNotMatch(src, /termCut|landCloseup|vsCode|FANKEEL|TERMINAL/);
});
```

- [ ] **Step 2: 跑，看它失敗。** `node --test tests/tour-opening.test.js`：`Cannot find module '../assets/station/tour-opening.js'`。

- [ ] **Step 3: 最小實作。** 建立 `assets/station/tour-opening.js`：

```js
// assets/station/tour-opening.js — the promo's first six cuts, frames 0–1919:
// hook, route, survey, design, plan and build, each a document page from
// tour-doc.js. Every cut is a pure function of its own local frame `l`; a
// block rises on a beat (30 frames), and `beats` lists those frames for the
// score's plucks. The storyboard is
// .fankeel/build/2026-09-28-tour-blocks/mockup.html, blocks cut-hook …
// cut-build; the frame numbers in the comments are its.
(function (root, module) {
    'use strict';
    var E = root.tourEngine || require('./tour.js');
    var D = root.tourDoc || require('./tour-doc.js');
    var t = D.t;
    var PROJECT = 'inventory-admin';

    // hook (f 0–239): docs/inventory.md grows a block a beat, the page
    // scrolls, then three blocks go grey and struck at 180 and are marked
    // 已過時 at 210, 214 and 218.
    function struck(ctx, P, runs, x, y, w, l) {
        var k = E.prog(l, 180, 8), end = x + Math.min(w, D.runsWidth(ctx, P, runs));
        if (k > 0) E.line(ctx, [[x, y], [E.lerp(x, end, k), y]], P.faint, 1.2);
    }
    function staleAt(ctx, P, x, cy, l, at) {
        var k = E.backOut(E.prog(l, at, 10));
        if (k <= 0) return;
        E.fade(ctx, Math.min(1, k), function () {
            ctx.save();
            ctx.translate(x, cy);
            ctx.scale(k, k);
            ctx.translate(-x, -cy);
            D.pill(ctx, P, t(P, 'stale'), x, cy, 'stale', { right: true, maxW: 90 });
            ctx.restore();
        });
    }
    function greyed(P, l, base) { return E.prog(l, 180, 8) >= 1 ? P.faint : base; }
    function hook(ctx, P, l) {
        D.page(ctx, P, l, {
            tab: [['cm', 'docs/'], ['tab', 'inventory.md']], bottom: 294, cap: 'cap.hook',
            blocks: [
                { at: 0, h: 42, draw: function (ctx, P, x, y, w) { E.fitText(ctx, P, 'h1', t(P, 'hook.title'), x, y + 16, w, { middle: true, lines: 1 }); } },
                { at: 30, h: 33, draw: function (ctx, P, x, y, w, l) {
                    var runs = [['code', 'getStock(sku)', greyed(P, l, P.ink)], ['li', '  ' + t(P, 'hook.getStock'), greyed(P, l, P.ink2)]];
                    D.li(ctx, P, x, y, w - 100, runs);
                    struck(ctx, P, runs, x, y + 17, w - 100, l);
                    staleAt(ctx, P, x + w, y + 17, l, 210);
                } },
                { at: 60, h: 33, draw: function (ctx, P, x, y, w) { D.li(ctx, P, x, y, w, [['li', t(P, 'hook.csv')]]); } },
                { at: 90, h: 48, draw: function (ctx, P, x, y, w, l) {
                    var runs = [['li', t(P, 'hook.sched'), greyed(P, l, P.ink)], ['code', 'export-plan-v2.md', greyed(P, l, P.ink)]];
                    D.callout(ctx, P, x, y, w - 100, 40, P.rule2, runs);
                    struck(ctx, P, runs, x + 12, y + 20, w - 124, l);
                    staleAt(ctx, P, x + w, y + 20, l, 214);
                } },
                { at: 120, h: 33, draw: function (ctx, P, x, y, w, l) {
                    var runs = [['li', t(P, 'hook.retry'), greyed(P, l, P.ink2)]];
                    D.li(ctx, P, x, y, w - 100, runs);
                    struck(ctx, P, runs, x, y + 17, w - 100, l);
                    staleAt(ctx, P, x + w, y + 17, l, 218);
                } },
                { at: 150, h: 96, draw: function (ctx, P, x, y, w) {
                    var c2 = x + 180;
                    E.fitText(ctx, P, 'note', t(P, 'hook.field'), x, y + 10, 170, { middle: true, lines: 1 });
                    E.fitText(ctx, P, 'note', t(P, 'hook.source'), c2, y + 10, w - 180, { middle: true, lines: 1 });
                    [[t(P, 'hook.product'), 'products'], [t(P, 'hook.qty'), 'getStock(sku)']].forEach(function (r, i) {
                        var ry = y + 22 + 33 * i;
                        E.line(ctx, [[x, ry + 0.5], [x + w, ry + 0.5]], P.rule, 1);
                        E.fitText(ctx, P, 'li', r[0], x, ry + 17, 170, { middle: true, lines: 1, fill: P.ink });
                        E.fitText(ctx, P, 'code', r[1], c2, ry + 17, w - 180, { middle: true, lines: 1 });
                    });
                } },
            ],
        });
    }

    // route (f 240–479): the task card rises with the caption; from local 30
    // one stage lights a beat, the newest ringed.
    function route(ctx, P, l) {
        var lit = Math.max(0, Math.min(7, Math.floor(l / 30)));
        D.page(ctx, P, l, {
            tab: [['note', t(P, 'tab.station'), P.muted], ['tab', PROJECT]], top: 46, bottom: 294, cap: 'cap.route',
            blocks: [
                { at: 0, h: 34, draw: function (ctx, P, x, y, w) { E.fitText(ctx, P, 'h1', t(P, 'task'), x, y + 15, w, { middle: true, lines: 1 }); } },
                { at: 0, h: 24, draw: function (ctx, P, x, y, w) { E.fitRuns(ctx, P, [['cm', PROJECT], ['note', t(P, 'route.n')]], x, y + 10, w); } },
                { at: 0, h: 48, draw: function (ctx, P, x, y, w) { D.rail(ctx, P, x, y + 4, w, lit, lit > 0 && lit < 7 ? lit - 1 : -1); } },
            ],
        });
    }

    // survey (f 480–839): the header, `## 已經有什麼`, three files a beat
    // each, the sixth beat left empty, and the class callout at 180 — its
    // bar drawn first over 6 frames.
    var FOUND = [['src/stock/warehouse.ts', 'survey.wh'], ['src/transfer/', 'survey.tr'], ['docs/inventory.md', 'survey.doc']];
    function survey(ctx, P, l) {
        var blocks = [{ at: 30, h: 34, draw: function (ctx, P, x, y, w) { D.heading(ctx, P, 'h2', '##', t(P, 'survey.h'), x, y + 12, w); } }];
        FOUND.forEach(function (r, i) {
            blocks.push({ at: 60 + 30 * i, h: 33, draw: function (ctx, P, x, y, w) { D.li(ctx, P, x, y, w, [['code', r[0]], ['li', '  ' + t(P, r[1])]]); } });
        });
        blocks.push({ at: 180, h: 50, draw: function (ctx, P, x, y, w, l) {
            D.callout(ctx, P, x, y + 10, w, 38, P.st.survey, [['code', 'class: bounded'], ['li', t(P, 'survey.class'), P.ink]], E.prog(l, 180, 12));
        } });
        D.page(ctx, P, l, { tab: [['cm', '.fankeel/build/multi-warehouse/'], ['tab', 'survey.md']], head: 0, tall: true, blocks: blocks });
    }

    // design (f 840–1199): the approach in one sentence; the file table, its
    // head then a row a beat; the gate card at 210; ✓ 核准 pressed at 270
    // (to 0.95, green, a halo; 改做法 fades to 40%); 已核准 at 300.
    var CHANGES = [['src/stock/warehouse.ts', 'design.wh'], ['src/transfer/transfer.ts', 'design.tr'], ['docs/inventory.md', 'design.doc']];
    function design(ctx, P, l) {
        var blocks = [
            { at: 30, h: 58, draw: function (ctx, P, x, y, w) { E.fitText(ctx, P, 'p', t(P, 'design.p'), x, y + 21, w, { lines: 2, leading: 1.5 }); } },
            { at: 60, h: 24, draw: function (ctx, P, x, y, w) {
                E.fitText(ctx, P, 'note', t(P, 'design.file'), x, y + 10, 200, { middle: true, lines: 1 });
                E.fitText(ctx, P, 'note', t(P, 'design.change'), x + 210, y + 10, w - 210, { middle: true, lines: 1 });
            } },
        ];
        CHANGES.forEach(function (r, i) {
            blocks.push({ at: 90 + 30 * i, h: 33, draw: function (ctx, P, x, y, w) {
                E.line(ctx, [[x, y + 0.5], [x + w, y + 0.5]], P.rule, 1);
                E.fitText(ctx, P, 'code', r[0], x, y + 17, 200, { middle: true, lines: 1 });
                E.fitText(ctx, P, 'li', t(P, r[1]), x + 210, y + 17, w - 210, { middle: true, lines: 1, fill: P.ink });
            } });
        });
        blocks.push({ at: 210, h: 104, draw: function (ctx, P, x, y, w, l) {
            var press = E.backOut(E.prog(l, 270, 10)), ok = l >= 300;
            E.box(ctx, x, y + 12, w, 90, 10, null, P.rule2, 1);
            var pw = D.pill(ctx, P, t(P, ok ? 'design.ok' : 'design.gate'), x + 14, y + 36, ok ? 'ok' : 'gate', { maxW: 150 });
            E.fitText(ctx, P, 'ui', t(P, 'design.q'), x + 24 + pw, y + 36, w - 38 - pw, { middle: true, lines: 1, weight: '600' });
            var bx = x + 14, by = y + 56, s = 1 - 0.05 * Math.min(1, press);
            ctx.font = E.font(P, 'p', { size: 16, weight: '600' });
            var yw = Math.min(200, ctx.measureText(t(P, 'design.yes')).width) + 36;
            if (press > 0) E.fade(ctx, Math.min(1, press), function () { E.box(ctx, bx - 4, by - 4, yw + 8, 44, 10, P.upBg); });
            ctx.save();
            ctx.translate(bx + yw / 2, by + 18);
            ctx.scale(s, s);
            ctx.translate(-(bx + yw / 2), -(by + 18));
            E.box(ctx, bx, by, yw, 36, 6, press > 0 ? P.good : P.ink);
            E.fitText(ctx, P, 'p', t(P, 'design.yes'), bx + 18, by + 18, 200, { middle: true, lines: 1, size: 16, weight: '600', fill: P.panel });
            ctx.restore();
            E.fade(ctx, press > 0 ? 1 - 0.6 * Math.min(1, press) : 1, function () {
                ctx.font = E.font(P, 'p', { size: 16 });
                var nw = Math.min(160, ctx.measureText(t(P, 'design.no')).width) + 36;
                E.box(ctx, bx + yw + 10, by, nw, 36, 6, null, P.rule2, 1);
                E.fitText(ctx, P, 'p', t(P, 'design.no'), bx + yw + 28, by + 18, 160, { middle: true, lines: 1, size: 16, fill: P.ink2 });
            });
        } });
        D.page(ctx, P, l, { tab: [['cm', '.fankeel/build/multi-warehouse/'], ['tab', 'design.md']], head: 1, tall: true, blocks: blocks });
    }

    // A task card (.tk): `Task A` in mono and its name, then its Files line
    // and, for C, its Consumes line.
    function card(ctx, P, x, y, w, h, id, key, files, consumes, hot) {
        E.box(ctx, x, y, w, h, 6, P.inset);
        E.fitRuns(ctx, P, [['mi', 'Task ' + id + '  ', P.muted], ['ui', t(P, key)]], x + 12, y + 17, w - 24);
        E.fitRuns(ctx, P, [['cm', 'Files: '], ['m', files]], x + 12, y + 38, w - 24);
        if (consumes) E.fitRuns(ctx, P, [['cm', 'Consumes: '], ['m', 'A', hot ? P.st.plan : P.ink2]], x + 12, y + 57, w - 24);
    }
    // The dashed-free arrow (.pd-a / .bl-ar): a 2-unit stem down from y0
    // to y1 at x, drawn to `p` of its length, a head once it is there, and
    // its label to the right.
    function arrow(ctx, P, x, y0, y1, p, label, c) {
        if (p <= 0) return;
        var y = E.lerp(y0, y1, p);
        E.line(ctx, [[x, y0], [x, y]], c, 2);
        if (p >= 1) {
            ctx.beginPath();
            ctx.moveTo(x - 6, y1 - 7);
            ctx.lineTo(x + 6, y1 - 7);
            ctx.lineTo(x, y1);
            ctx.closePath();
            ctx.fillStyle = c;
            ctx.fill();
        }
        E.fade(ctx, p, function () { E.fitText(ctx, P, 'ui', label, x + 12, (y0 + y1) / 2, 200, { middle: true, lines: 1, size: 14, weight: '600', fill: c }); });
    }
    // A frame round a pair of cards (.pd-par / .bl-par) in colour `c`, drawn
    // to `p` along its edge, its label sitting on the top edge.
    function parFrame(ctx, P, x, y, w, h, p, c, why) {
        if (p <= 0) return;
        ctx.save();
        ctx.setLineDash([2 * (w + h) * p, 4 * (w + h)]);
        E.rr(ctx, x, y, w, h, 10);
        ctx.strokeStyle = c;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        E.fade(ctx, p, function () {
            var runs = [['ui', t(P, 'par'), c]];
            if (why) runs.push(['note', '  ' + why]);
            E.box(ctx, x + 6, y - 10, Math.min(w - 12, D.runsWidth(ctx, P, runs) + 12), 20, 0, P.panel);
            E.fitRuns(ctx, P, runs, x + 12, y, w - 24);
        });
    }

    // plan (f 1200–1559): three cards a beat each (A and B side by side, C
    // under A); at 150 the 同時 frame draws round A and B as they slide into
    // it; at 180 C drops a row; at 210 the arrow from A to C, 等 A, and C's
    // `Consumes: A` turns the plan colour.
    var HALF = (D.CW - 24) / 2; // two cards or lanes inside a frame, 6 in and 12 apart
    function plan(ctx, P, l) {
        D.page(ctx, P, l, {
            tab: [['cm', 'docs/plans/'], ['tab', '2026-09-28-multi-warehouse.md']], head: 2, bottom: 302, cap: 'cap.plan',
            blocks: [{ at: 30, h: 180, draw: function (ctx, P, x, y, w, l) {
                var slide = E.expoOut(E.prog(l, 150, 18)), drop = E.expoOut(E.prog(l, 180, 18));
                parFrame(ctx, P, x, y + 8, w, 70, E.prog(l, 150, 12), P.st.plan, t(P, 'par.why'));
                var ay = E.lerp(y + 2, y + 15, slide);
                D.risen(ctx, D.rise(l, 30), function () { card(ctx, P, x + 6, ay, HALF, 56, 'A', 'plan.a', 'src/stock/warehouse.ts'); });
                D.risen(ctx, D.rise(l, 60), function () { card(ctx, P, x + 18 + HALF, ay, HALF, 56, 'B', 'plan.b', 'src/transfer/api.ts'); });
                var cy = E.lerp(y + 68, y + 108, drop);
                D.risen(ctx, D.rise(l, 90), function () { card(ctx, P, x + 6, cy, HALF, 70, 'C', 'plan.c', 'src/transfer/ui.vue', true, l >= 210); });
                arrow(ctx, P, x + 6 + HALF / 2, y + 80, y + 106, E.prog(l, 210, 10), t(P, 'waits'), P.st.plan);
            } }],
        });
    }

    // build (f 1560–1919): the ledger. A and B in one 同時 frame at 30, C
    // queued under them at 60 with its arrow; at 90 A and B go green
    // together; at 180 a reviewer each; at 210 both turn ○ to ✓ (squeezed to
    // nothing across 4 frames, opened across 4); C goes green only at 240,
    // its reviewer at 300, its ✓ at 330. Every dot has its words beside it.
    function lane(ctx, P, x, y, w, id, key, l, go, review, done) {
        var st = l >= done ? 'done' : l >= review ? 'review' : l >= go ? 'run' : 'queued';
        var wait = st === 'queued', busy = st === 'run' || st === 'review';
        if (wait) E.box(ctx, x, y, w, 50, 6, null, P.rule2, 1);
        else E.box(ctx, x, y, w, 50, 6, P.inset);
        var flip = l < done ? 1 - E.prog(l, done - 4, 4) : E.prog(l, done, 4);
        ctx.save();
        ctx.translate(x + 17, y + 17);
        ctx.scale(Math.max(0.001, flip), 1);
        ctx.translate(-(x + 17), -(y + 17));
        E.fitText(ctx, P, 'ui', st === 'done' ? '✓' : '○', x + 17, y + 17, 20, { middle: true, lines: 1, align: 'center', fill: st === 'done' ? P.good : P.muted });
        ctx.restore();
        if (st === 'done') E.fitText(ctx, P, 'code', 'Task ' + id + ': complete', x + 32, y + 17, w - 42, { middle: true, lines: 1, weight: '600', size: 14 });
        else E.fitRuns(ctx, P, [['ui', 'Task ' + id + ' · ', wait ? P.muted : P.ink], ['ui', t(P, key), wait ? P.muted : P.ink]], x + 32, y + 17, w - 42);
        var ax = x + 32, ay = y + 37;
        if (!wait) {
            E.circle(ctx, ax + 4.5, ay, 4.5, st === 'run' ? P.live : P.muted);
            ax += 15;
        }
        if (st === 'review' || st === 'done') {
            E.circle(ctx, ax + 3, ay, 3, st === 'review' ? P.live : P.muted);
            ax += 12;
        }
        var words = { queued: 'build.queued', run: 'build.run', review: 'build.review', done: 'build.done' }[st];
        E.fitText(ctx, P, 'note', t(P, words), ax, ay, x + w - ax - 8, { middle: true, lines: 1, fill: busy ? P.live : P.muted, weight: busy ? '600' : null });
    }
    function build(ctx, P, l) {
        D.page(ctx, P, l, {
            tab: [['cm', '.fankeel/build/2026-09-28-multi-warehouse/'], ['tab', 'progress.md']], head: 3, bottom: 302, cap: 'cap.build',
            blocks: [
                { at: 0, h: 22, draw: function (ctx, P, x, y, w) { E.fitRuns(ctx, P, [['cm', '# fankeel build ledger '], ['note', '—'], ['cm', ' plan: docs/plans/2026-09-28-multi-warehouse.md']], x, y + 8, w); } },
                { at: 30, h: 76, draw: function (ctx, P, x, y, w, l) {
                    parFrame(ctx, P, x, y + 10, w, 64, 1, P.st.build);
                    lane(ctx, P, x + 6, y + 17, HALF, 'A', 'plan.a', l, 90, 180, 210);
                    lane(ctx, P, x + 18 + HALF, y + 17, HALF, 'B', 'plan.b', l, 90, 180, 210);
                } },
                { at: 60, h: 82, draw: function (ctx, P, x, y, w, l) {
                    arrow(ctx, P, x + 6 + HALF / 2, y, y + 26, 1, t(P, 'waits'), P.st.build);
                    lane(ctx, P, x + 6, y + 30, HALF, 'C', 'plan.c', l, 240, 300, 330);
                } },
            ],
        });
    }

    var CUTS = [
        { name: 'hook', len: 240, beats: [0, 30, 60, 90, 120, 150], draw: hook },
        { name: 'route', len: 240, beats: [0, 30, 60, 90, 120, 150, 180, 210], draw: route },
        { name: 'survey', len: 360, beats: [0, 30, 60, 90, 120, 180], draw: survey },
        { name: 'design', len: 360, beats: [0, 30, 60, 90, 120, 150, 210], draw: design },
        { name: 'plan', len: 360, beats: [0, 30, 60, 90], draw: plan },
        { name: 'build', len: 360, beats: [0, 30, 60], draw: build },
    ];

    module.exports = { CUTS: CUTS };
    if (typeof window !== 'undefined') root.tourOpening = module.exports;
})(typeof window !== 'undefined' ? window : globalThis, typeof module !== 'undefined' ? module : {});
```

- [ ] **Step 4: 跑，看它通過。** `node --test tests/tour-opening.test.js`，9 個全綠。量字那條在 fake context 下中英兩版都沒有 `over`，等寬字體裡沒有非 ASCII（帳本標頭的「—」刻意用介面字體畫）。

- [ ] **Step 5: Commit** — 路徑 `assets/station/tour-opening.js`、`tests/tour-opening.test.js`；訊息 `feat(tour): hook, route, survey, design, plan and build as document blocks`。

## Task 5: 後五格 tour-closing.js（verify … outro）

新檔：verify（證據表，表頭與三列各一拍；f180 第二列整列轉紅、✓→✕、證據換成失敗原因、左右抖 ±3；f270 換成「補上預設倉後通過」轉回）、audit（`inventory-admin/docs` 文件樹一拍一列；f180 兩頁標「過時」加理由；f270 `export-plan-v2.md` 滑進 `archive/` 底下再縮一階（expo-out 24），膠囊淡掉換「已歸檔」）、land（`TODO.md`：`## Ready`、兩筆、`## Blocked`、列印格式；f210 自己那一筆由左劃到右；f270「工作樹乾淨 ✓」提示框）、clash（兩張 session 卡各一拍、f60 各長出「正在改 src/stock/warehouse.ts」、f120 正在小節線上兩個檔名轉琥珀、`CLASH · 同一個檔` 彈出、f150 字幕）、outro（「fankeel」、兩行安裝指令一拍一行每格打兩字、f90 小字、f120 tagline、f180 七站一次亮、停到片尾）。規則同 Task 4。

**Files:**
- Modify: `assets/station/tour-closing.js` — 新檔
- Read: `assets/station/tour-doc.js` — `D.page`、`D.t`、`D.heading`、`D.callout`、`D.pill`、`D.dots`、`D.rail`、`D.rise`、`D.risen`、`D.runsWidth`、`D.cap`、`D.CW`、`D.S`
- Read: `assets/station/tour.js` — `E.fitText`、`E.fitRuns`、`E.font`、`E.prog`、`E.expoOut`、`E.backOut`、`E.lerp`、`E.line`、`E.box`、`E.fade`、`E.palette`、`E.ROUTE`
- Read: `tests/tour-ctx.js` — `fakeCtx`、`sweep`
- Test: `tests/tour-closing.test.js`

**Interfaces:**
- Consumes: `tourDoc.page(ctx, P, l, spec)`, `tourDoc.t(P, key)`, `tourDoc.S`（Task 3）；`E.fitText`, `E.fitRuns`（Task 1）；`sweep(T, frames, draw)`（Task 1）
- Produces: `tourClosing.CUTS` — `[{ name, len, beats, draw(ctx, P, l) }]`，依序 `verify` 360、`audit` 360、`land` 360、`clash` 240、`outro` 360；瀏覽器全域 `window.tourClosing`

**Dispatch:** implementer, sonnet — 程式碼全在計畫裡；照抄加跑測試。

- [ ] **Step 1: 寫失敗的測試。** 建立 `tests/tour-closing.test.js`：

```js
'use strict';
// assets/station/tour-closing.js — the last five cuts (verify … outro), each
// drawn alone at its own local frames, in both languages: what each still of
// the storyboard shows, that every string keeps to its box, that the mono
// face holds only ASCII, and that no terminal is drawn anywhere.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const T = require('../assets/station/tour.js');
const D = require('../assets/station/tour-doc.js');
const { CUTS } = require('../assets/station/tour-closing.js');
const { fakeCtx, sweep } = require('./tour-ctx.js');

const LANGS = { zh: T.palette(() => '', 'zh'), en: T.palette(() => '', 'en') };
const cut = (name) => CUTS.find((c) => c.name === name);
function shot(name, l, lang) {
    const ctx = fakeCtx();
    cut(name).draw(ctx, LANGS[lang || 'zh'], l);
    return ctx.texts();
}
const s = (key, lang) => D.S[key][lang || 'zh'];

test('five cuts, 240 or 360 frames, their blocks on the beat', () => {
    assert.deepEqual(CUTS.map((c) => [c.name, c.len]), [['verify', 360], ['audit', 360], ['land', 360], ['clash', 240], ['outro', 360]]);
    for (const c of CUTS) {
        assert.equal(c.beats[0], 0, c.name);
        for (const b of c.beats) assert.ok(b % 30 === 0 && b < c.len, c.name + ' ' + b);
    }
});

// Criterion: each still of cut-verify … cut-outro draws what the
// storyboard's still shows. Red when: a cut draws an empty page, or skips
// its change of state.
test('verify: three rows of evidence; row two fails at 180 and is fixed at 270', () => {
    const one = shot('verify', 75);
    assert.ok(one.includes('transfer.test.ts') && one.includes('✓'));
    const red = shot('verify', 195, 'en');
    assert.ok(red.includes('✕') && red.some((x) => x.includes('old case fails')), red.join(' | '));
    const fixed = shot('verify', 330, 'en');
    assert.ok(!fixed.includes('✕') && fixed.some((x) => x.includes('passes with the default added')), fixed.join(' | '));
});

test('audit: the docs tree, two pages marked stale, one moved into archive/', () => {
    const mid = shot('audit', 195);
    assert.equal(mid.filter((x) => x === s('audit.stale')).length, 2, mid.join(' | '));
    const end = shot('audit', 330, 'en');
    assert.equal(end.filter((x) => x === 'Stale').length, 1, end.join(' | '));
    assert.ok(end.includes('archived') && end.includes('still says getStock(sku), added to TODO'));
});

test('land: TODO.md, the task\'s own entry struck, then a clean working tree', () => {
    const mid = shot('land', 225);
    assert.ok(mid.includes('Ready') && mid.includes('Blocked') && mid.includes(s('land.slip')));
    assert.ok(!mid.includes(s('land.clean') + ' '));
    const end = shot('land', 330, 'en');
    assert.ok(end.includes('Working tree clean ') && end.includes('  nothing to commit, working tree clean'), end.join(' | '));
});

test('clash: two session cards on one file, CLASH on the bar line, then the caption', () => {
    const before = shot('clash', 105);
    assert.ok(before.includes('session 1') && before.includes('session 2') && !before.some((x) => x.startsWith('CLASH')));
    const hit = shot('clash', 135, 'en');
    assert.ok(hit.includes('CLASH · same file'), hit.join(' | '));
    assert.equal(hit.filter((x) => x === 'src/stock/warehouse.ts').length, 2);
    assert.ok(shot('clash', 225, 'en').includes(s('cap.clash', 'en')));
});

test('outro: the install lines typed, the tagline, then the whole route', () => {
    const typed = shot('outro', 45);
    assert.ok(typed.some((x) => x.startsWith('claude plugin') && x.length < 51), typed.join(' | '));
    const end = shot('outro', 300, 'en');
    assert.ok(end.includes('claude plugin marketplace add FanFantom9452/FanKeel') && end.includes('claude plugin install fankeel@fankeel'));
    assert.ok(end.join(' ').includes('Build with AI as long as you like'), end.join(' | '));
    assert.deepEqual(T.ROUTE.filter((x) => end.includes(x)), T.ROUTE);
    assert.ok(shot('outro', 300).includes('跟 AI 開發得再久，也不堆過時的引用和死程式。'));
});

// Criterion: every string these cuts print is measured and keeps to its
// box, in both languages. Red when: a box is narrower than its English.
test('every string of these cuts fits its box in zh and en, and the mono face holds only ASCII', () => {
    const keys = new Set();
    for (const lang of ['zh', 'en']) {
        const frames = [];
        for (const c of CUTS) for (let l = 0; l < c.len; l += 5) frames.push([c, l]);
        const r = sweep(T, frames, (ctx, [c, l]) => c.draw(ctx, LANGS[lang], l));
        assert.deepEqual(r.log.filter((e) => e.over).map((e) => e.s), [], lang);
        assert.deepEqual(r.monoWide, [], lang);
        assert.deepEqual(r.nonFinite, [], lang);
        const drawn = r.log.map((e) => e.s).join('\n');
        Object.keys(D.S).forEach((k) => { if (drawn.includes(D.S[k][lang].trim())) keys.add(lang + ' ' + k); });
    }
    for (const k of ['pr.verify', 'pr.audit', 'pr.land', 'verify.fail', 'audit.archived', 'land.clean', 'cap.clash', 'outro.tag']) {
        assert.ok(keys.has('zh ' + k) && keys.has('en ' + k), k);
    }
});

test('no terminal: nothing here draws a statusline or a terminal chrome', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'tour-closing.js'), 'utf8');
    assert.doesNotMatch(src, /termCut|landCloseup|vsCode|FANKEEL|TERMINAL/);
});
```

- [ ] **Step 2: 跑，看它失敗。** `node --test tests/tour-closing.test.js`：`Cannot find module '../assets/station/tour-closing.js'`。

- [ ] **Step 3: 最小實作。** 建立 `assets/station/tour-closing.js`：

```js
// assets/station/tour-closing.js — the promo's last five cuts, frames
// 1920–3599: verify, audit, land, clash and the outro, each a document page
// from tour-doc.js. Every cut is a pure function of its own local frame `l`;
// a block rises on a beat (30 frames), and `beats` lists those frames for the
// score's plucks. The storyboard is
// .fankeel/build/2026-09-28-tour-blocks/mockup.html, blocks cut-verify …
// cut-outro; the frame numbers in the comments are its.
(function (root, module) {
    'use strict';
    var E = root.tourEngine || require('./tour.js');
    var D = root.tourDoc || require('./tour-doc.js');
    var t = D.t;
    var PROJECT = 'inventory-admin';

    // verify (f 1920–2279): the evidence table, its head then a row a beat.
    // At 180 row two turns red, ✓ becomes ✕, its evidence becomes the
    // failure and the row shakes (±3, 6 frames); at 270 it is fixed and
    // turns back.
    var ROW_H = 44;
    function verify(ctx, P, l) {
        var bad = l >= 180 && l < 270;
        var rows = [
            [[['li', t(P, 'verify.r1'), P.ink]], [['code', 'transfer.test.ts'], ['li', t(P, 'verify.pass')]], false],
            [[['li', t(P, 'verify.r2'), P.ink]], [['code', 'warehouse.test.ts'], ['li', t(P, l >= 270 ? 'verify.fixed' : l >= 180 ? 'verify.fail' : 'verify.pass')]], bad],
            [[['code', 'docs/inventory.md'], ['li', t(P, 'verify.r3'), P.ink]], [['code', 'docs-check'], ['li', t(P, 'verify.clean')]], false],
        ];
        var blocks = [{ at: 30, h: 24, draw: function (ctx, P, x, y) {
            E.fitText(ctx, P, 'note', t(P, 'verify.must'), x, y + 10, 220, { middle: true, lines: 1 });
            E.fitText(ctx, P, 'note', t(P, 'verify.ev'), x + 230, y + 10, 240, { middle: true, lines: 1 });
        } }];
        rows.forEach(function (r, i) {
            blocks.push({ at: 60 + 30 * i, h: ROW_H, draw: function (ctx, P, x, y, w) {
                var dx = r[2] ? 3 * Math.sin(E.prog(l, 180, 6) * Math.PI * 3) : 0;
                ctx.save();
                ctx.translate(dx, 0);
                if (r[2]) E.fade(ctx, E.prog(l, 180, 8), function () { E.box(ctx, x, y, w, ROW_H, 0, P.dnBg); });
                E.line(ctx, [[x, y + 0.5], [x + w, y + 0.5]], P.rule, 1);
                var tint = function (runs) { return r[2] ? runs.map(function (u) { return [u[0], u[1], P.bad]; }) : runs; };
                E.fitRuns(ctx, P, tint(r[0]), x, y + ROW_H / 2, 220);
                E.fitRuns(ctx, P, tint(r[1]), x + 230, y + ROW_H / 2, 240);
                E.fitText(ctx, P, 'ui', r[2] ? '✕' : '✓', x + w - 13, y + ROW_H / 2, 20, { middle: true, lines: 1, align: 'center', weight: '700', fill: r[2] ? P.bad : P.good });
                ctx.restore();
            } });
        });
        D.page(ctx, P, l, { tab: [['cm', '.fankeel/build/multi-warehouse/'], ['tab', 'verify.md']], head: 4, tall: true, blocks: blocks });
    }

    // audit (f 2280–2639): the docs tree a row a beat, children one step in.
    // At 180 stock.md and export-plan-v2.md are marked 過時 with why; at 270
    // export-plan-v2.md slides under archive/ and one step further in
    // (expo-out 24), its pill fading into 已歸檔, and archive/ moves up.
    var DROW = 38;
    function audit(ctx, P, l) {
        var mv = E.expoOut(E.prog(l, 270, 24)), marked = l >= 180;
        var rows = [
            { at: 30, code: 'docs/', slot: 0, ind: 0 },
            { at: 60, code: 'inventory.md', slot: 1, ind: 1, note: 'audit.rewritten' },
            { at: 90, code: 'stock.md', slot: 2, ind: 1, stale: true, note: mv >= 1 ? 'audit.stockTodo' : 'audit.stock' },
            { at: 120, code: 'export-plan-v2.md', slot: E.lerp(3, 4, mv), ind: E.lerp(1, 2, mv), stale: mv < 1, note: mv >= 1 ? 'audit.archived' : 'audit.landed', fade: 1 - mv },
            { at: 150, code: 'archive/', slot: E.lerp(4, 3, mv), ind: 1 },
        ];
        D.page(ctx, P, l, {
            tab: [['cm', PROJECT + '/'], ['tab', 'docs']], head: 5, tall: true,
            blocks: [{ at: 30, h: DROW * 5, draw: function (ctx, P, x, y, w, l) {
                rows.forEach(function (r) {
                    D.risen(ctx, D.rise(l, r.at), function () {
                        var ry = y + DROW * r.slot, rx = x + 6 + 22 * r.ind, cy = ry + DROW / 2;
                        ctx.font = E.font(P, 'code', { size: 15 });
                        var nx = rx + Math.min(200, ctx.measureText(r.code).width) + 10;
                        E.fitText(ctx, P, 'code', r.code, rx, cy, 200, { middle: true, lines: 1, size: 15 });
                        var pk = r.stale && marked ? (r.fade === undefined ? 1 : r.fade) : 0;
                        if (pk > 0) E.fade(ctx, pk, function () { nx += pk * (D.pill(ctx, P, t(P, 'audit.stale'), nx, cy, 'stale', { maxW: 80 }) + 8); });
                        if (r.note && (!r.stale || marked)) E.fitText(ctx, P, 'note', t(P, r.note), nx, cy, x + w - nx, { middle: true, lines: 1, size: 13.5 });
                    });
                });
            } }],
        });
    }

    // land (f 2640–2999): TODO.md. `## Ready` and its entries a beat each,
    // `## Blocked` and its print-format entry; at 210 the task's own entry is
    // struck left to right (10 frames); at 270 the working-tree callout, its
    // ✓ popping in last (back-out 8).
    function todo(ctx, P, x, y, w, stage, runs, strike) {
        var k = strike || 0;
        var all = [['cm', '- '], ['li', '〔' + stage + '〕', P.muted]].concat(runs.map(function (r) { return k >= 1 ? [r[0], r[1], P.faint] : r; }));
        E.fitRuns(ctx, P, all, x + 4, y + 15, w - 4);
        if (k > 0) {
            var end = x + 4 + Math.min(w - 4, D.runsWidth(ctx, P, all));
            E.line(ctx, [[x + 4, y + 15], [E.lerp(x + 4, end, k), y + 15]], P.faint, 1.2);
        }
    }
    function land(ctx, P, l) {
        D.page(ctx, P, l, {
            tab: [['tab', 'TODO.md']], head: 6, tall: true,
            blocks: [
                { at: 30, h: 32, draw: function (ctx, P, x, y, w) { D.heading(ctx, P, 'h2', '##', 'Ready', x, y + 12, w); } },
                { at: 60, h: 30, draw: function (ctx, P, x, y, w, l) { todo(ctx, P, x, y, w, 'build', [['li', t(P, 'task'), P.ink]], E.prog(l, 210, 10)); } },
                { at: 90, h: 30, draw: function (ctx, P, x, y, w) { todo(ctx, P, x, y, w, 'audit', [['code', 'docs/stock.md '], ['li', t(P, 'land.stock'), P.ink]]); } },
                { at: 120, h: 42, draw: function (ctx, P, x, y, w) { D.heading(ctx, P, 'h2', '##', 'Blocked', x, y + 22, w); } },
                { at: 150, h: 76, draw: function (ctx, P, x, y, w) {
                    D.heading(ctx, P, 'h3', '###', t(P, 'land.print'), x, y + 10, w);
                    E.fitRuns(ctx, P, [['cm', 'on: '], ['note', t(P, 'land.on')]], x, y + 32, w);
                    todo(ctx, P, x, y + 44, w, 'plan', [['li', t(P, 'land.slip'), P.ink]]);
                } },
                { at: 270, h: 56, draw: function (ctx, P, x, y, w, l) {
                    var ok = E.backOut(E.prog(l, 282, 8));
                    D.callout(ctx, P, x, y + 10, w, 40, P.good, [['ui', t(P, 'land.clean') + ' '], ['ui', ok > 0 ? '✓' : ' ', P.good], ['cm', '  nothing to commit, working tree clean']]);
                } },
            ],
        });
    }

    // clash (f 3000–3239): two session cards a beat apart; at 60 both grow
    // their 正在改 line; at 120 — on the bar line — both file names turn
    // amber and CLASH pops under them (back-out 10); at 150 the caption.
    function session(ctx, P, x, y, w, n, key, step, of, l) {
        E.box(ctx, x, y, w, 120, 10, P.inset);
        E.fitText(ctx, P, 'cm', 'session ' + n, x + 14, y + 18, 100, { middle: true, lines: 1 });
        D.pill(ctx, P, t(P, 'clash.running'), x + w - 14, y + 18, 'live', { right: true, maxW: 90 });
        E.fitText(ctx, P, 'ui', t(P, key), x + 14, y + 42, w - 28, { middle: true, lines: 1, size: 17 });
        D.dots(ctx, P, x + 14, y + 64, step, of, 8);
        E.fitRuns(ctx, P, [['m', 'build ', P.ink], ['cm', (step + 1) + '/' + of]], x + 14 + of * 11 + 14, y + 64, w - 40 - of * 11);
        var e = D.rise(l, 60);
        if (e <= 0) return;
        E.fade(ctx, e, function () {
            E.line(ctx, [[x + 14, y + 78.5], [x + w - 14, y + 78.5]], P.rule, 1);
            E.fitText(ctx, P, 'note', t(P, 'clash.editing'), x + 14, y + 90, w - 28, { middle: true, lines: 1 });
            var hot = l >= 120;
            if (hot) E.box(ctx, x + 12, y + 99, 196, 18, 3, P.staleBg);
            E.fitText(ctx, P, 'code', 'src/stock/warehouse.ts', x + 16, y + 108, 190, { middle: true, lines: 1, size: 14, fill: hot ? P.staleInk : P.ink });
        });
    }
    function clash(ctx, P, l) {
        var half = (D.CW - 14) / 2;
        D.page(ctx, P, l, {
            tab: [['note', t(P, 'tab.station'), P.muted], ['tab', PROJECT]], bottom: 294,
            blocks: [{ at: 0, h: 176, draw: function (ctx, P, x, y, w, l) {
                session(ctx, P, x, y, half, 1, 'task', 3, 7, l);
                D.risen(ctx, D.rise(l, 30), function () { session(ctx, P, x + half + 14, y, half, 2, 'task2', 2, 5, l); });
                var k = E.backOut(E.prog(l, 120, 10));
                if (k > 0) E.fade(ctx, Math.min(1, k), function () {
                    ctx.save();
                    ctx.translate(320, y + 148);
                    ctx.scale(k, k);
                    ctx.translate(-320, -(y + 148));
                    ctx.font = E.font(P, 'pill', { size: 14 });
                    var s = 'CLASH · ' + t(P, 'clash.same'), pw = ctx.measureText(s).width + 28;
                    E.box(ctx, 320 - pw / 2, y + 136, pw, 26, 13, P.staleBg);
                    E.fitText(ctx, P, 'pill', s, 320, y + 149, 240, { middle: true, lines: 1, size: 14, align: 'center', fill: P.stale });
                    ctx.restore();
                });
            } }],
        });
        if (l >= 150) D.cap(ctx, P, 'cap.clash', l, 150);
    }

    // outro (f 3240–3599): fankeel and an empty command box; each install
    // line typed at two characters a frame from its beat, the cursor resting
    // at its end; 兩行指令 at 90; the tagline at 120, on bar 29; the whole
    // route lit at once at 180, held to the last frame.
    var CMDS = ['claude plugin marketplace add FanFantom9452/FanKeel', 'claude plugin install fankeel@fankeel'];
    function outro(ctx, P, l) {
        D.page(ctx, P, l, {
            tab: [['note', t(P, 'outro.install'), P.ink]], top: 26,
            blocks: [
                { at: 0, h: 46, draw: function (ctx, P, x, y, w) { E.fitText(ctx, P, 'h1', 'fankeel', 320, y + 18, w, { middle: true, lines: 1, size: 30, align: 'center' }); } },
                { at: 0, h: 70, draw: function (ctx, P, x, y, w, l) {
                    E.box(ctx, x, y, w, 62, 6, P.inset);
                    CMDS.forEach(function (c, i) {
                        var n = Math.min(c.length, Math.floor(Math.max(0, l - 30 * (i + 1)) * 2));
                        if (n <= 0) return;
                        var s = c.slice(0, n), cy = y + 18 + 27 * i;
                        E.fitText(ctx, P, 'cm', '$', x + 16, cy, 12, { middle: true, lines: 1 });
                        var r = E.fitText(ctx, P, 'code', s, x + 32, cy, w - 48, { middle: true, lines: 1 });
                        if (n < c.length || i === 1) {
                            ctx.font = E.font(P, 'code', { size: r.size });
                            E.box(ctx, x + 34 + ctx.measureText(s).width, cy - 8, 7, 16, 0, P.ink2);
                        }
                    });
                } },
                { at: 90, h: 24, draw: function (ctx, P, x, y, w) { E.fitText(ctx, P, 'note', t(P, 'outro.two'), 320, y + 10, w, { middle: true, lines: 1, align: 'center' }); } },
                { at: 120, h: 58, draw: function (ctx, P, x, y, w) { E.fitText(ctx, P, 'tag', t(P, 'outro.tag'), 320, y + 22, w, { lines: 2, leading: 1.1, align: 'center' }); } },
                { at: 180, h: 52, draw: function (ctx, P, x, y, w) { D.rail(ctx, P, x, y + 4, w, 7, -1); } },
            ],
        });
    }

    var CUTS = [
        { name: 'verify', len: 360, beats: [0, 30, 60, 90, 120], draw: verify },
        { name: 'audit', len: 360, beats: [0, 30, 60, 90, 120, 150], draw: audit },
        { name: 'land', len: 360, beats: [0, 30, 60, 90, 120, 150, 270], draw: land },
        { name: 'clash', len: 240, beats: [0, 30, 60], draw: clash },
        { name: 'outro', len: 360, beats: [0, 30, 60, 90, 120, 180], draw: outro },
    ];

    module.exports = { CUTS: CUTS };
    if (typeof window !== 'undefined') root.tourClosing = module.exports;
})(typeof window !== 'undefined' ? window : globalThis, typeof module !== 'undefined' ? module : {});
```

- [ ] **Step 4: 跑，看它通過。** `node --test tests/tour-closing.test.js`，8 個全綠。

- [ ] **Step 5: Commit** — 路徑 `assets/station/tour-closing.js`、`tests/tour-closing.test.js`；訊息 `feat(tour): verify, audit, land, clash and the outro as document blocks`。

## Task 6: tour-stages.js 接成十一格，拿掉終端機

`tour-stages.js` 整檔換掉：`termCut()`、`landCloseup()`、`vsCode()`、`lead()`、`TERM` 以及所有插畫場景一律刪除，不留任何終端機畫面。新檔只把 `tourOpening.CUTS` 與 `tourClosing.CUTS` 頭尾相接（起點 0、240、480、840、1200、1560、1920、2280、2640、3000、3240，全是 120 的倍數；總長仍是 3600，不等就丟錯），`beats` 一格一個（label 是格名，七個 stage 帶 `stage`），`stills` 用分鏡圖自己的 33 個定格，`cues` 交出 cut 起點與每個方塊浮入的絕對格數。`PRODUCES` 匯出與它的測試一起拿掉——表頭的產出字串現在是 `tour-doc.js` 的 `pr.*`。`tour.html` 在 `tour-stages.js` 前面載入三個新檔。

**Files:**
- Modify: `assets/station/tour-stages.js` — 整檔換成新版（約 50 行）
- Modify: `assets/station/tour.html` — 腳本載入順序
- Read: `assets/station/tour-opening.js` — `CUTS`
- Read: `assets/station/tour-closing.js` — `CUTS`
- Read: `assets/station/tour-doc.js` — `S`（測試用）
- Read: `tests/tour-ctx.js` — `fakeCtx`、`sweep`
- Test: `tests/tour-stages.test.js`
- Test: `tests/tour-page.test.js`

**Interfaces:**
- Consumes: `tourOpening.CUTS`（Task 4）、`tourClosing.CUTS`（Task 5）、`tourDoc.S`（Task 3）、`sweep(T, frames, draw)`（Task 1）
- Produces: `TOUR_STAGES.cues` — `{ cuts: [0, 240, 480, 840, 1200, 1560, 1920, 2280, 2640, 3000, 3240], blocks: [絕對格數，遞增，全是 30 的倍數] }`；`TOUR_STAGES.beats` 的 label 依序 `hook route survey design plan build verify audit land clash outro`

**Dispatch:** implementer, sonnet — 程式碼全在計畫裡；照抄加跑測試。

- [ ] **Step 1: 寫失敗的測試。** 把 `tests/tour-stages.test.js` 整檔換成：

```js
'use strict';
// Video: assets/station/tour-stages.js — the 3600-frame promo, 30 bars at
// 120 BPM. Eleven cuts of document blocks end to end, every one starting on
// a bar line; no terminal cut is left in the source. Every frame a pure
// function of its number, in either language, every string inside its box.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const T = require('../assets/station/tour.js');
const D = require('../assets/station/tour-doc.js');
const { TOUR_STAGES } = require('../assets/station/tour-stages.js');
const { fakeCtx, sweep } = require('./tour-ctx.js');

const STARTS = [0, 240, 480, 840, 1200, 1560, 1920, 2280, 2640, 3000, 3240];
const NAMES = ['hook', 'route', 'survey', 'design', 'plan', 'build', 'verify', 'audit', 'land', 'clash', 'outro'];

function shot(f, P) {
    const ctx = fakeCtx();
    T.render(ctx, 'stages', f, P ? { palette: P } : undefined);
    return ctx;
}

// Criterion: eleven cuts, each starting on a multiple of 120, and no
// termCut in the source. Red when: the old 240 + 408i blocks or any of the
// terminal code are still there.
test('stages is registered: 3600 frames, eleven cuts each starting on a bar line', () => {
    assert.equal(T.get('stages'), TOUR_STAGES);
    assert.equal(T.length('stages'), 3600);
    assert.deepEqual(T.check(TOUR_STAGES), []);
    assert.deepEqual(TOUR_STAGES.beats.map((b) => b.at), STARTS);
    assert.deepEqual(TOUR_STAGES.beats.map((b) => b.label), NAMES);
    TOUR_STAGES.beats.forEach((b) => assert.equal(b.at % 120, 0, b.label));
    TOUR_STAGES.beats.filter((b) => T.ROUTE.includes(b.label)).forEach((b) => assert.equal(b.stage, b.label));
    assert.equal(TOUR_STAGES.beats.filter((b) => b.stage).length, 7);
});

test('the source keeps no terminal cut', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'tour-stages.js'), 'utf8');
    assert.doesNotMatch(src, /termCut/);
    assert.doesNotMatch(src, /landCloseup|vsCode|TERM\b|lead\(/);
});

// The score's cues: a hit on every cut, a pluck on every block, each block
// on a beat.
test('the cues are the cut starts and every block\'s beat, in order', () => {
    assert.deepEqual(TOUR_STAGES.cues.cuts, STARTS);
    const b = TOUR_STAGES.cues.blocks;
    assert.ok(b.length >= 50, b.length + ' blocks');
    b.forEach((f, i) => {
        assert.equal(f % 30, 0, 'block at ' + f);
        assert.ok(f >= 0 && f < 3600 && (i === 0 || f > b[i - 1]), 'block at ' + f);
    });
    STARTS.forEach((s) => assert.ok(b.includes(s), 'no block at the cut ' + s));
});

test('each cut draws its own page: the stage header in each stage\'s cut', () => {
    const P = T.palette(() => '', 'zh');
    T.ROUTE.forEach((s, i) => {
        const t = shot(STARTS[i + 2] + 100, P).texts();
        assert.ok(t.includes(s), s + ': ' + t.join(' | '));
        assert.ok(t.includes(D.S['pr.' + s].zh), s);
    });
});

test('a frame draws the same calls whichever frames were drawn before it', () => {
    for (const f of TOUR_STAGES.stills) {
        const cold = JSON.stringify(shot(f).calls);
        shot(3599);
        shot(0);
        shot(f + 233);
        assert.equal(JSON.stringify(shot(f).calls), cold, 'frame ' + f);
    }
});

test('no frame or half frame draws with a number that is not finite', () => {
    for (let f = 0; f < 3600; f += 7) {
        for (const g of [f, f + 0.5]) {
            const bad = shot(g).calls.flat().filter((x) => typeof x === 'number' && !Number.isFinite(x));
            assert.deepEqual(bad, [], 'frame ' + g);
        }
    }
});

// Criterion (design, What proves it done): every string of the table, in
// zh and in en, is measured with measureText and no wider than its box.
// Red when: a string is never drawn through fit, or one overflows.
test('every string, in both languages, is drawn through fit and keeps to its box', () => {
    for (const lang of ['zh', 'en']) {
        const P = T.palette(() => '', lang);
        const frames = [];
        for (let f = 0; f < 3600; f += 5) frames.push(f);
        const r = sweep(T, frames, (ctx, f) => T.render(ctx, 'stages', f, { palette: P }));
        const over = [...new Set(r.log.filter((e) => e.over).map((e) => e.s))];
        assert.deepEqual(over, [], lang + ' overflows');
        assert.deepEqual(r.monoWide, [], lang + ' mono face');
        const drawn = r.log.map((e) => e.s).join('\n');
        const missing = Object.keys(D.S).filter((k) => !drawn.includes(D.S[k][lang].trim()));
        assert.deepEqual(missing, [], lang + ' never drawn through fit');
    }
});

test('the outro ends on the install lines and the tagline, in either language', () => {
    const zh = shot(3590).texts();
    assert.ok(zh.includes('claude plugin install fankeel@fankeel'), zh.join(' | '));
    assert.ok(zh.includes('跟 AI 開發得再久，也不堆過時的引用和死程式。'), zh.join(' | '));
    const en = shot(3590, T.palette(() => '', 'en')).texts();
    assert.ok(en.join(' ').includes('without piling up stale references and dead code.'), en.join(' | '));
});
```

  在 `tests/tour-page.test.js`，`a hash opens the promo at a frame` 那條裡的 `/aria-valuetext="0:25\.00，build"/` 改成 plan（f1500 現在落在 plan 格 1200–1559）：

```js
    assert.match(html, /aria-valuetext="0:25\.00，plan"/);
```

  在 `tests/tour-page.test.js`，`the scrub bar carries one marker per beat` 那條的前兩行（數量 8 與八個 label）換成：

```js
    assert.equal(count(html, /class="tr-mk"/g), 11);
    for (const label of ['hook', 'route', 'survey', 'design', 'plan', 'build', 'verify', 'audit', 'land', 'clash', 'outro']) {
```

- [ ] **Step 2: 跑，看它失敗。** `node --test tests/tour-stages.test.js tests/tour-page.test.js`：beats 還是 `[240, 648, …]`、來源裡還有 `termCut`、`cues` 不存在、marker 是 8 個。

- [ ] **Step 3: 最小實作。** 把 `assets/station/tour-stages.js` 整檔換成：

```js
// assets/station/tour-stages.js — the promo (1:00, 3600 frames = 30 bars at
// 120 BPM): eleven cuts, each a document page whose blocks rise on the beat,
// no terminal anywhere. hook 0–239, route 240–479, the seven stages 360
// frames each from 480, clash 3000–3239, outro 3240–3599 — every cut starts
// on a bar line (a multiple of 120). The cuts themselves are
// tour-opening.js (hook … build) and tour-closing.js (verify … outro); this
// file puts them end to end, registers the timeline, and hands the score its
// cues: the frame each cut starts on and the frame each block rises on. The
// storyboard is .fankeel/build/2026-09-28-tour-blocks/mockup.html.
(function (root, module) {
    'use strict';
    var E = root.tourEngine || require('./tour.js');
    var A = root.tourOpening || require('./tour-opening.js');
    var B = root.tourClosing || require('./tour-closing.js');

    var CUTS = A.CUTS.concat(B.CUTS);
    var LENGTH = 3600;
    var STARTS = [];
    var end = CUTS.reduce(function (at, c) { STARTS.push(at); return at + c.len; }, 0);
    if (end !== LENGTH) throw new Error('tour: the cuts run to ' + end + ' frames, not ' + LENGTH);

    function draw(ctx, f, P) {
        var i = CUTS.length - 1;
        while (i > 0 && STARTS[i] > f) i--;
        CUTS[i].draw(ctx, P, f - STARTS[i]);
    }

    // The storyboard's own stills, three a cut.
    var STILLS = [66, 156, 225, 255, 345, 465, 525, 615, 810, 885, 1065, 1155, 1305, 1386, 1530, 1665, 1815, 1905,
        1995, 2115, 2250, 2355, 2475, 2610, 2715, 2865, 2970, 3045, 3135, 3225, 3285, 3375, 3540];

    var TOUR_STAGES = {
        length: LENGTH,
        beats: CUTS.map(function (c, i) {
            var b = { at: STARTS[i], label: c.name };
            if (E.ROUTE.indexOf(c.name) >= 0) b.stage = c.name;
            return b;
        }),
        stills: STILLS,
        cues: {
            cuts: STARTS.slice(),
            blocks: CUTS.reduce(function (out, c, i) { return out.concat(c.beats.map(function (b) { return STARTS[i] + b; })); }, []),
        },
        draw: draw,
    };
    E.register('stages', TOUR_STAGES);

    module.exports = { TOUR_STAGES: TOUR_STAGES };
})(typeof window !== 'undefined' ? window : globalThis, typeof module !== 'undefined' ? module : {});
```

  在 `assets/station/tour.html`，把 `<script src="tour.js"></script>` 與 `<script src="tour-stages.js"></script>` 兩行換成：

```html
<script src="tour.js"></script>
<script src="tour-doc.js"></script>
<script src="tour-opening.js"></script>
<script src="tour-closing.js"></script>
<script src="tour-stages.js"></script>
```

- [ ] **Step 4: 跑，看它通過。** `node --test tests/tour-stages.test.js tests/tour-page.test.js`，全綠（`tour-page` 在沒有瀏覽器的機器上 skip，這台有 Edge）。`every string, in both languages, is drawn through fit` 那條就是 design「中英每一個字串用 measureText 量過」在 Node 這一側的證據。

- [ ] **Step 5: Commit** — 路徑 `assets/station/tour-stages.js`、`assets/station/tour.html`、`tests/tour-stages.test.js`、`tests/tour-page.test.js`；訊息 `feat(tour): eleven document cuts on the bar lines; the terminal cuts are gone`。

## Task 7: 播放器——語言、Web Audio 配樂、靜音鈕、真字體量字

`tour-player.js` 整檔換成新版：語言取 `?lang=zh|en`，沒有就取 station 的 `FK_I18N.lang`（`tour.html` 先載 `i18n.js`），再沒有就 zh，寫到 canvas 的 `data-lang`；第一次按播放才建 `AudioContext`、合成 PCM 放進 `AudioBuffer`（瀏覽器擋自動播放時，這一下點擊就是它要的手勢），從目前格數的秒數開始播；播放中畫面跟著音訊時鐘走，暫停、點時間軸、方向鍵都先停聲，再按播放從新位置出聲；一個靜音鈕切 gain 0/1；`?record` 不出聲；`?check` 在字體載好後把每第 5 格用真字體畫一遍，沒放下的字串寫進 `data-overflow`、表裡沒經過 `fit` 的 key 寫進 `data-missing`。`tour.html` 加靜音鈕、`i18n.js`、`tour-music.js`，說明文字從「無聲」改成現在的樣子；`tour.css` 加靜音鈕樣式與第四欄。

**Files:**
- Modify: `assets/station/tour-player.js` — 整檔換成新版
- Modify: `assets/station/tour.html` — 靜音鈕、`i18n.js`、`tour-music.js`、說明文字
- Modify: `assets/station/tour.css` — `.tr-bar` 第四欄、`.tr-mute`
- Read: `assets/station/tour-music.js` — `render`、`RATE`
- Read: `assets/station/tour-doc.js` — `S`
- Read: `assets/station/i18n.js` — `FK_I18N.lang`
- Test: `tests/tour-page.test.js`

**Interfaces:**
- Consumes: `tourMusic.render(cues)`, `tourMusic.RATE`（Task 2）；`TOUR_STAGES.cues`（Task 6）；`tourDoc.S`（Task 3）；`E.fitLog(arr)`, `E.palette(read, lang)`（Task 1）
- Produces: `tour.html?record&lang=<zh|en>` — 錄影頁依 url 的語言畫；canvas 上的 `data-lang`、`data-overflow`、`data-missing`；`#trMute`

**Dispatch:** implementer, sonnet — 程式碼全在計畫裡；照抄加跑測試。

- [ ] **Step 1: 寫失敗的測試。** 在 `tests/tour-page.test.js` 檔尾加上：

```js
// Criterion: the video speaks the language asked for, and the page has a
// mute button that starts unpressed. Red when: ?lang is ignored or the
// button is missing.
test('?lang picks the video\'s language, and the bar carries a mute button', (t) => {
    if (!findBrowser()) { t.skip(NO_BROWSER); return; }
    assert.match(dom(PAGE + '?lang=en#stages@300'), /data-lang="en"/);
    assert.match(dom(PAGE + '?lang=zh#stages@300'), /data-lang="zh"/);
    const html = dom(PAGE);
    assert.match(html, /id="trMute"[^>]*aria-pressed="false"|aria-pressed="false"[^>]*id="trMute"/);
    assert.match(html, /<script src="i18n\.js"><\/script>/);
    assert.match(html, /<script src="tour-music\.js"><\/script>/);
});

// Criterion (design, What proves it done): every string, zh and en, measured
// with the real fonts' measureText, fits its box. Red when: a box is
// narrower than its string in either language.
test('?check: with the real fonts, no string of either language overflows its box', (t) => {
    if (!findBrowser()) { t.skip(NO_BROWSER); return; }
    for (const lang of ['zh', 'en']) {
        const html = dom(PAGE + '?check&lang=' + lang);
        assert.match(html, /data-overflow="\[\]"/, lang + ': ' + (/data-overflow="([^"]*)"/.exec(html) || [])[1]);
        assert.match(html, /data-missing="\[\]"/, lang + ': ' + (/data-missing="([^"]*)"/.exec(html) || [])[1]);
    }
});
```

- [ ] **Step 2: 跑，看它失敗。** `node --test tests/tour-page.test.js`：沒有 `data-lang`、沒有 `#trMute`、`?check` 沒有 `data-overflow`。

- [ ] **Step 3: 最小實作。** 把 `assets/station/tour-player.js` 整檔換成：

```js
// assets/station/tour-player.js — the tour page's controller: the scrub bar
// with a marker per beat, keys, playback with its score, the mute button,
// and window.tour for scripts/tour-record.js. Every picture comes from
// tourEngine.render; this file only decides which frame, and in which
// language: `?lang=zh|en` when the url says, else the station's own
// (FK_I18N.lang, from i18n.js), else zh. Nothing plays by itself: the page
// opens paused, and the sound is made on the first press of play — the
// click a browser's autoplay rule asks for. While the sound runs, the frame
// follows the audio clock, so picture and sound cannot drift apart; a pause
// or a seek stops the sound, and play starts it again at the frame shown.
// `?record` strips the page to the canvas with no sound; `?check` measures
// every string of every fifth frame with the real fonts and writes what did
// not fit onto the canvas as data-overflow.
(function () {
    'use strict';
    var E = window.tourEngine, M = window.tourMusic, D = window.tourDoc;
    var PLAY_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.8v10.4L13 8z" fill="currentColor"></path></svg>';
    var PAUSE_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3h3v10H4zM9 3h3v10H9z" fill="currentColor"></path></svg>';
    var SOUND_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6h3l4-3v10l-4-3H2z" fill="currentColor"></path><path d="M11 5.5a3.5 3.5 0 0 1 0 5M12.5 3.5a6 6 0 0 1 0 9" stroke="currentColor" stroke-width="1.4" fill="none"></path></svg>';
    var MUTED_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6h3l4-3v10l-4-3H2z" fill="currentColor"></path><path d="M11 6l4 4M15 6l-4 4" stroke="currentColor" stroke-width="1.4"></path></svg>';
    function q(id) { return document.getElementById(id); }
    var cv = q('trCanvas'), ctx = cv.getContext('2d'), scrub = q('trScrub'), play = q('trPlay'), mute = q('trMute');
    var search = location.search.slice(1);
    var rec = /(?:^|&)record(?:[=&]|$)/.test(search);
    var checking = /(?:^|&)check(?:[=&]|$)/.test(search);
    var said = /(?:^|&)lang=(zh|en)(?:&|$)/.exec(search);
    var lang = said ? said[1] : window.FK_I18N ? window.FK_I18N.lang : 'zh';
    if (rec) document.body.classList.add('rec');
    var css = getComputedStyle(document.documentElement);
    var P = E.palette(function (k) { return css.getPropertyValue('--' + k).trim(); }, lang);
    cv.dataset.lang = P.lang;
    var name = 'stages', frame = 0, playing = false, t0 = 0, f0 = 0;

    // The score, made once on the first play: the PCM from tour-music.js in
    // an AudioBuffer, through one gain node the mute button sets.
    var audio = null, muted = false;
    function sound() {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (rec || !M || !AC) return null;
        if (!audio) {
            var ac = new AC(), pcm = M.render(E.get(name).cues);
            var buf = ac.createBuffer(1, pcm.length, M.RATE);
            buf.getChannelData(0).set(pcm);
            var gain = ac.createGain();
            gain.gain.value = muted ? 0 : 1;
            gain.connect(ac.destination);
            audio = { ac: ac, buf: buf, gain: gain, src: null, t0: 0, f0: 0 };
        }
        return audio;
    }
    function soundStop() {
        if (!audio || !audio.src) return;
        try { audio.src.stop(); } catch (e) { /* already ended */ }
        audio.src.disconnect();
        audio.src = null;
    }
    function soundFrom(f) {
        var a = sound();
        if (!a) return;
        soundStop();
        if (a.ac.state === 'suspended') a.ac.resume();
        var src = a.ac.createBufferSource();
        src.buffer = a.buf;
        src.connect(a.gain);
        src.start(0, f / E.FPS);
        a.src = src;
        a.t0 = a.ac.currentTime;
        a.f0 = f;
    }
    function setMute(on) {
        muted = on;
        if (audio) audio.gain.gain.value = on ? 0 : 1;
        mute.setAttribute('aria-pressed', String(on));
        mute.setAttribute('aria-label', on ? '取消靜音' : '靜音');
        mute.innerHTML = on ? MUTED_SVG : SOUND_SVG;
    }

    function paint() {
        var tl = E.get(name), n = tl.length, b = E.beatAt(tl, frame);
        E.render(ctx, name, frame, { palette: P, blur: rec });
        scrub.style.setProperty('--p', (frame / (n - 1)).toFixed(4));
        scrub.setAttribute('aria-valuemax', String(n - 1));
        scrub.setAttribute('aria-valuenow', String(frame));
        scrub.setAttribute('aria-valuetext', E.clock(frame) + (b >= 0 ? '，' + tl.beats[b].label : ''));
        q('trTime').innerHTML = '<b>' + E.clock(frame) + '</b> / ' + E.clock(n);
        q('trFno').textContent = 'f ' + frame + ' / ' + n + ' · ' + E.FPS + ' fps';
    }
    function seek(f) {
        frame = Math.max(0, Math.min(E.length(name) - 1, Math.round(f)));
        paint();
    }
    function marks() {
        var old = scrub.querySelectorAll('.tr-mk');
        for (var i = 0; i < old.length; i++) old[i].remove();
        var tl = E.get(name), thumb = scrub.querySelector('.tr-thumb');
        tl.beats.forEach(function (b) {
            var m = document.createElement('button');
            m.type = 'button';
            m.className = 'tr-mk';
            m.style.setProperty('--at', (b.at / (tl.length - 1)).toFixed(4));
            if (b.stage) m.style.setProperty('--c', 'var(--st-' + b.stage + ')');
            m.dataset.f = String(b.at);
            m.innerHTML = '<span>' + b.label + '</span>';
            scrub.insertBefore(m, thumb);
        });
    }
    function stop() {
        playing = false;
        soundStop();
        play.setAttribute('aria-pressed', 'false');
        play.setAttribute('aria-label', '播放');
        play.innerHTML = PLAY_SVG;
    }
    // The audio clock while the sound runs, the wall clock otherwise.
    function now() {
        if (audio && audio.src && audio.ac.state === 'running') return audio.f0 + Math.floor((audio.ac.currentTime - audio.t0) * E.FPS);
        return f0 + Math.floor((performance.now() - t0) * E.FPS / 1000);
    }
    function step() {
        if (!playing) return;
        var last = E.length(name) - 1, f = now();
        if (f >= last) { seek(last); stop(); return; }
        seek(f);
        requestAnimationFrame(step);
    }
    function start() {
        if (frame >= E.length(name) - 1) seek(0);
        playing = true;
        t0 = performance.now();
        f0 = frame;
        soundFrom(frame);
        play.setAttribute('aria-pressed', 'true');
        play.setAttribute('aria-label', '暫停');
        play.innerHTML = PAUSE_SVG;
        requestAnimationFrame(step);
    }
    function toggle() { if (playing) stop(); else start(); }

    play.addEventListener('click', toggle);
    mute.addEventListener('click', function () { setMute(!muted); });
    scrub.addEventListener('click', function (e) {
        stop();
        var mk = e.target.closest('.tr-mk');
        if (mk) { seek(Number(mk.dataset.f)); return; }
        var r = scrub.getBoundingClientRect();
        seek((e.clientX - r.left) / r.width * (E.length(name) - 1));
    });
    // Space toggles wherever focus is; keyup's default is cancelled so a
    // focused button is not clicked a second time by the same key.
    document.addEventListener('keydown', function (e) {
        if (e.key === ' ') { e.preventDefault(); toggle(); return; }
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        stop();
        var dir = e.key === 'ArrowRight' ? 1 : -1;
        seek(e.shiftKey ? E.stepBeat(E.get(name), frame, dir) : frame + dir);
    });
    document.addEventListener('keyup', function (e) { if (e.key === ' ') e.preventDefault(); });

    // ?check: every fifth frame drawn with the fit log on; the strings that
    // did not fit, and the table's strings never drawn through fit, go on
    // the canvas for tests/tour-page.test.js to read.
    function check() {
        var log = [];
        E.fitLog(log);
        for (var f = 0; f < E.length(name); f += 5) E.render(ctx, name, f, { palette: P });
        E.fitLog(null);
        var over = {}, drawn = log.map(function (e) { if (e.over) over[e.s] = 1; return e.s; }).join('\n');
        cv.dataset.overflow = JSON.stringify(Object.keys(over));
        cv.dataset.missing = JSON.stringify(Object.keys(D.S).filter(function (k) { return drawn.indexOf(D.S[k][P.lang].trim()) < 0; }));
    }

    marks();
    setMute(false);
    var m = /^#stages@(\d+)$/.exec(location.hash);
    seek(m ? Number(m[1]) : 0);

    window.tour = { seek: seek, length: function (n) { return E.length(n); }, ready: false };
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(function () {
        if (checking) check();
        paint();
        window.tour.ready = true;
        cv.dataset.ready = 'true';
    });
})();
```

  把 `assets/station/tour.html` 整檔換成：

```html
<!DOCTYPE html>
<html lang="zh-Hant" data-theme="dark"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>fankeel · 導覽</title>
<!-- Standalone: opens from file:// with no server. The station's own
     stylesheet first, then only what the tour adds. The frames are always
     dark (an MP4 cannot follow a theme), so the page pins data-theme=dark. -->
<link rel="stylesheet" href="../station/station.css">
<link rel="stylesheet" href="tour.css">
</head><body>
<main class="tr-main">
  <h1 class="tr-h">導覽</h1>
  <p class="tr-lede">一分鐘的宣傳短片，配純音樂，中英兩版，跟著監控站的語言（網址加 <code>?lang=en</code> 也行）；第一次用 fankeel 的人從這裡看起。畫面由 canvas 逐格畫出，可以拖、可以停；同一份逐格程式也輸出成 MP4。</p>
  <section class="tr-player" aria-label="播放器">
    <div class="tr-top">
      <span class="tr-fno" id="trFno"></span>
    </div>
    <div class="tr-stage"><canvas id="trCanvas" width="1280" height="720" role="img" aria-label="目前的畫面"></canvas></div>
    <div class="tr-bar">
      <button type="button" class="tr-play" id="trPlay" aria-label="播放" aria-pressed="false"></button>
      <span class="tr-time" id="trTime"></span>
      <div class="tr-scrub" id="trScrub" role="slider" tabindex="0" aria-label="時間軸" aria-valuemin="0">
        <div class="tr-fill"></div>
        <div class="tr-thumb"></div>
      </div>
      <button type="button" class="tr-mute" id="trMute" aria-label="靜音" aria-pressed="false"></button>
    </div>
    <p class="tr-keys"><kbd>Space</kbd> 播放／暫停 · <kbd>←</kbd> <kbd>→</kbd> 前後一格 · <kbd>Shift</kbd>+<kbd>←</kbd> <kbd>→</kbd> 跳到上一拍／下一拍 · 刻度是每一段的起點，顏色是那一站的顏色。開啟時停在第一格，不自動播放；按下播放才出聲，右邊的喇叭是靜音。</p>
  </section>
</main>
<script src="i18n.js"></script>
<script src="tour.js"></script>
<script src="tour-doc.js"></script>
<script src="tour-opening.js"></script>
<script src="tour-closing.js"></script>
<script src="tour-stages.js"></script>
<script src="tour-music.js"></script>
<script src="tour-player.js"></script>
</body></html>
```

  在 `assets/station/tour.css`，`.tr-bar{...}` 那一行的 `grid-template-columns:44px auto minmax(0,1fr)` 改成 `grid-template-columns:44px auto minmax(0,1fr) 44px`，並在 `.tr-play:hover{background:var(--ink2)}` 之後加：

```css
.tr-mute{width:44px;height:44px;border-radius:50%;border:0;background:none;color:var(--ink2);display:grid;place-items:center;cursor:pointer;box-shadow:inset 0 0 0 1px var(--rule2)}
.tr-mute svg{width:16px;height:16px}
.tr-mute:hover,.tr-mute[aria-pressed=true]{color:var(--ink)}
.tr-mute:focus-visible,.tr-play:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
```

  （`body.rec .tr-bar{display:none}` 已經在，錄影時靜音鈕跟著藏起來。）

- [ ] **Step 4: 跑，看它通過。** `node --test tests/tour-page.test.js`，6 個全綠；`?check` 那條就是 design「中英每一個字串用 measureText 量過，不超過它的方塊寬度」用真字體的證據。對照：副本上把 `cap.hook` 的英文改成重複三次，這條就紅，訊息列出那一句。再在瀏覽器裡開 `assets/station/tour.html`，按播放聽得到配樂、拖時間軸再播聲音從新位置起、按靜音變無聲——這三件只有人耳能驗，寫進回報。

- [ ] **Step 5: Commit** — 路徑 `assets/station/tour-player.js`、`assets/station/tour.html`、`assets/station/tour.css`、`tests/tour-page.test.js`；訊息 `feat(tour): the player speaks the station's language, plays the score, and mutes`。

## Task 8: 錄影腳本的 --lang 與音軌，文件，錄兩支

`scripts/tour-record.js`：加 `--lang zh|en`（預設 zh；其他值 exit 2），預設輸出 `.fankeel/build/tour/stages-<lang>.mp4`；錄影頁開 `tour.html?record&lang=<lang>`；在 Node 裡用 `tour-music.js` 對 `TOUR_STAGES.cues` 合成、寫 WAV 到 mp4 旁邊，ffmpeg 以第二個輸入合進去（`-map 0:v -map 1:a -c:a aac -shortest`）；寫完 ffprobe 數畫格、讀音軌，畫格數不等於 `tour.length` 或音軌不是恰好一條、長度不在 60 ± 0.1 秒就 exit 1。兩頁文件的「無聲」「一支影片」改成現在的樣子。最後在這台機器上中英各錄一支。

**Files:**
- Modify: `scripts/tour-record.js` — 整檔換成新版：`--lang`、`scoreWav()`、`ffmpegArgs(out, wav)`、`audioStreams()`、`main()` 查音軌
- Modify: `docs/01-guide/station.md` — 導覽那一列
- Modify: `docs/90-agent/reference/station.md:952-990` — `## Search, the tour and the served files` 一節多一段講影片本身
- Read: `assets/station/tour-music.js` — `render`、`wav`
- Read: `assets/station/tour-stages.js` — `TOUR_STAGES.cues`
- Test: `tests/tour-record.test.js`

**Interfaces:**
- Consumes: `tourMusic.render(cues)`, `tourMusic.wav(pcm)`（Task 2）；`TOUR_STAGES.cues`（Task 6）；`tour.html?record&lang=<zh|en>`（Task 7）
- Produces: `parseArgs(argv)` → `{ name, lang, out }`、`ffmpegArgs(out, wav)`、`scoreWav(name)` → `Buffer`、`audioStreams(ffprobe, file)` → 秒數陣列或 `null`

**Dispatch:** implementer, sonnet — 程式碼全在計畫裡；兩支錄影各要數分鐘，用背景執行等它跑完。

- [ ] **Step 1: 寫失敗的測試。** 在 `tests/tour-record.test.js`，把第 12 行的 require 到 `a wrong name, no name or a stray flag exits 2` 那條的 usage 斷言為止（第 12–25 行）換成：

```js
const { parseArgs, ffmpegPath, ffprobeOf, ffmpegArgs, scoreWav, devtoolsPort, countFrames, audioStreams } = require('../scripts/tour-record.js');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'tour-record.js');

// Criterion: --lang zh|en picks the language, zh by default, one file per
// language. Red when: --lang is refused as unknown, or both languages write
// the same file.
test('parseArgs takes one timeline name, --lang zh|en (zh unless given) and an optional --out', () => {
    assert.deepEqual(parseArgs(['stages', '--out', 'x.mp4']), { name: 'stages', lang: 'zh', out: path.resolve('x.mp4') });
    assert.deepEqual(parseArgs(['stages']), { name: 'stages', lang: 'zh', out: path.resolve('.fankeel', 'build', 'tour', 'stages-zh.mp4') });
    assert.deepEqual(parseArgs(['stages', '--lang', 'en']), { name: 'stages', lang: 'en', out: path.resolve('.fankeel', 'build', 'tour', 'stages-en.mp4') });
});

test('a wrong name, a wrong language, no name or a stray flag exits 2', () => {
    const bad = spawnSync(process.execPath, [SCRIPT, 'intro'], { encoding: 'utf8' });
    assert.equal(bad.status, 2);
    assert.match(bad.stderr, /usage: tour-record\.js <stages> \[--lang zh\|en\] \[--out f\.mp4\]/);
    const lang = spawnSync(process.execPath, [SCRIPT, 'stages', '--lang', 'fr'], { encoding: 'utf8' });
    assert.equal(lang.status, 2);
    assert.match(lang.stderr, /usage: tour-record\.js/);
```

  在 `tests/tour-record.test.js`，`ffprobe sits beside ffmpeg` 那條裡的 `ffmpegArgs('out.mp4')` 改成 `ffmpegArgs('out.mp4', 'out.wav')`，並在那條之後加：

```js
// Criterion: the MP4 carries the score as AAC, cut to the picture. Red when:
// the WAV is never handed to ffmpeg, or no audio codec is named.
test('the score goes in as a second input, encoded AAC, and the shorter stream ends the file', () => {
    const a = ffmpegArgs('out.mp4', 'out.wav');
    assert.deepEqual(a.map((x, i) => (x === '-i' ? a[i + 1] : null)).filter(Boolean), ['-', 'out.wav']);
    assert.equal(a[a.indexOf('-c:a') + 1], 'aac');
    assert.ok(a.includes('-shortest'));
    assert.deepEqual(a.filter((x, i) => a[i - 1] === '-map'), ['0:v', '1:a']);
});

test('scoreWav is the promo\'s score as a 60-second mono WAV', () => {
    const b = scoreWav('stages');
    assert.equal(b.toString('latin1', 0, 4), 'RIFF');
    assert.equal(b.readUInt32LE(24), 44100);
    assert.equal(b.readUInt32LE(40), 60 * 44100 * 2);
});

test('audioStreams is null when ffprobe cannot run', () => {
    assert.equal(audioStreams(path.join(tmp('fankeel-tour-probe-a-'), 'ffprobe-missing'), 'x.mp4'), null);
});
```

- [ ] **Step 2: 跑，看它失敗。** `node --test tests/tour-record.test.js`：`parseArgs` 沒有 `lang`、`--lang` 被當成未知參數、`scoreWav`／`audioStreams` 不存在。

- [ ] **Step 3: 最小實作。** 把 `scripts/tour-record.js` 整檔換成：

```js
#!/usr/bin/env node
'use strict';
// scripts/tour-record.js: the one tour timeline (the promo, `stages`) to an
// MP4 with its score, frame by frame, in one language.
//
//   node scripts/tour-record.js stages [--lang zh|en] [--out f.mp4]
//
// --lang is zh unless given, and the file is .fankeel/build/tour/
// stages-<lang>.mp4 unless --out says. Opens
// assets/station/tour.html?record&lang=<lang>#<name>@0 in the Chromium-family
// browser scripts/render.js finds, headless, with a DevTools port, and drives
// it over Node's global WebSocket: for every frame, `tour.seek(n)` (record mode
// draws ten averaged sub-frames), then Page.captureScreenshot, and the PNG goes
// down a pipe to `ffmpeg -f image2pipe`. ffmpeg comes from FANKEEL_FFMPEG or
// PATH; ffprobe from beside it. The sound is assets/station/tour-music.js run
// here in Node over the timeline's own cues, written as a WAV beside the MP4
// and muxed in as AAC, the shorter of the two ending the file. After writing,
// the MP4's frames are counted and its audio streams read, and the run exits
// 1 unless the count is `tour.length(name)` and there is exactly one audio
// stream within 0.1 s of that many frames at 60 fps. No dependency.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { parseArgsOrExit } = require('../lib/cli.js');
const { findBrowser } = require('./render.js');

const NAMES = ['stages'];
const LANGS = ['zh', 'en'];
const SIZE = { width: 1280, height: 720 };
const PAGE = path.join(__dirname, '..', 'assets', 'station', 'tour.html');

function parseArgs(argv) {
    const { values, positionals } = parseArgsOrExit('tour-record', argv, { out: { type: 'string' }, lang: { type: 'string' } });
    const name = positionals[0];
    const lang = values.lang === undefined ? 'zh' : values.lang;
    if (positionals.length !== 1 || !NAMES.includes(name) || !LANGS.includes(lang)) {
        process.stderr.write('usage: tour-record.js <' + NAMES.join('|') + '> [--lang ' + LANGS.join('|') + '] [--out f.mp4]\n');
        process.exit(2);
    }
    return { name, lang, out: path.resolve(values.out || path.join('.fankeel', 'build', 'tour', name + '-' + lang + '.mp4')) };
}

// FANKEEL_FFMPEG when set (and then only it), else the first PATH entry that
// holds one; null when neither does.
function ffmpegPath(env) {
    const e = env || process.env;
    if (e.FANKEEL_FFMPEG) return fs.existsSync(e.FANKEEL_FFMPEG) ? e.FANKEEL_FFMPEG : null;
    const exe = process.platform === 'win32' ? ['ffmpeg.exe', 'ffmpeg'] : ['ffmpeg'];
    for (const dir of String(e.PATH || e.Path || '').split(path.delimiter).filter(Boolean)) {
        for (const n of exe) {
            const p = path.join(dir, n);
            if (fs.existsSync(p)) return p;
        }
    }
    return null;
}

function ffprobeOf(ffmpeg) {
    return path.join(path.dirname(ffmpeg), path.basename(ffmpeg).replace(/^ffmpeg/i, 'ffprobe'));
}

// PNG frames from stdin, the score from `wav`; the shorter ends the MP4.
function ffmpegArgs(out, wav) {
    return ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '60', '-c:v', 'png', '-i', '-',
        '-i', wav, '-map', '0:v', '-map', '1:a',
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '60', '-c:a', 'aac', '-shortest', out];
}

// The score of timeline `name` as WAV bytes: tour-music.js over the cues the
// timeline registered — the same samples the page plays.
function scoreWav(name) {
    const E = require('../assets/station/tour.js');
    require('../assets/station/tour-stages.js');
    const M = require('../assets/station/tour-music.js');
    return Buffer.from(M.wav(M.render(E.get(name).cues)));
}

// "DevTools listening on ws://127.0.0.1:<port>/devtools/browser/<id>"
function devtoolsPort(stderr) {
    const m = /DevTools listening on ws:\/\/[^:\s]+:(\d+)\//.exec(String(stderr));
    return m ? Number(m[1]) : null;
}

function countFrames(ffprobe, file) {
    const r = spawnSync(ffprobe, ['-v', 'error', '-select_streams', 'v:0', '-count_frames',
        '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', file], { encoding: 'utf8' });
    if (r.status !== 0) return null;
    const n = Number(String(r.stdout).trim());
    return Number.isInteger(n) ? n : null;
}

// Each audio stream's duration in seconds, in stream order; null when
// ffprobe cannot run or exits nonzero.
function audioStreams(ffprobe, file) {
    const r = spawnSync(ffprobe, ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=duration',
        '-of', 'csv=p=0', file], { encoding: 'utf8' });
    if (r.status !== 0) return null;
    return String(r.stdout).split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map(Number);
}

function launch(browser, url, profileDir) {
    const child = spawn(browser, ['--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars',
        '--remote-debugging-port=0', '--user-data-dir=' + profileDir, '--force-device-scale-factor=1',
        '--window-size=' + SIZE.width + ',' + SIZE.height, url], { stdio: ['ignore', 'ignore', 'pipe'] });
    return new Promise((resolve, reject) => {
        let err = '';
        const timer = setTimeout(() => reject(new Error('tour-record: the browser never printed its DevTools port')), 30000);
        child.stderr.on('data', (d) => {
            if (err.length < 65536) err += d;
            const port = devtoolsPort(err);
            if (port) { clearTimeout(timer); resolve({ child, port }); }
        });
        child.on('exit', (code) => {
            clearTimeout(timer);
            reject(new Error('tour-record: the browser exited (' + code + ') before DevTools opened: ' + err.slice(0, 300)));
        });
    });
}

function cdp(url) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(url);
        const wait = new Map();
        let id = 0;
        ws.onmessage = (ev) => {
            const msg = JSON.parse(ev.data);
            const w = msg.id && wait.get(msg.id);
            if (!w) return;
            wait.delete(msg.id);
            if (msg.error) w.reject(new Error('tour-record: ' + msg.error.message));
            else w.resolve(msg.result);
        };
        ws.onerror = () => reject(new Error('tour-record: the DevTools socket failed: ' + url));
        ws.onopen = () => resolve({
            send(method, params) {
                return new Promise((res, rej) => {
                    id += 1;
                    wait.set(id, { resolve: res, reject: rej });
                    ws.send(JSON.stringify({ id, method, params: params || {} }));
                });
            },
            close() { ws.close(); },
        });
    });
}

async function record(args, ffmpeg, browser) {
    const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-tour-'));
    const url = pathToFileURL(PAGE).href + '?record&lang=' + args.lang + '#' + args.name + '@0';
    const { child, port } = await launch(browser, url, profileDir);
    try {
        const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
        const page = list.find((t) => t.type === 'page');
        if (!page) throw new Error('tour-record: no page target on port ' + port);
        const c = await cdp(page.webSocketDebuggerUrl);
        await c.send('Emulation.setDeviceMetricsOverride', { width: SIZE.width, height: SIZE.height, deviceScaleFactor: 1, mobile: false });
        const evaluate = async (expression) => {
            const r = await c.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
            if (r.exceptionDetails) throw new Error('tour-record: the page threw: ' + r.exceptionDetails.text);
            return r.result.value;
        };
        let ready = false;
        for (let i = 0; i < 300 && !ready; i++) {
            ready = await evaluate('!!(window.tour && window.tour.ready)');
            if (!ready) await new Promise((r) => setTimeout(r, 100));
        }
        if (!ready) throw new Error('tour-record: the page never set tour.ready');
        const total = await evaluate('tour.length(' + JSON.stringify(args.name) + ')');
        fs.mkdirSync(path.dirname(args.out), { recursive: true });
        const wav = args.out.replace(/\.mp4$/i, '') + '.wav';
        fs.writeFileSync(wav, scoreWav(args.name));
        const ff = spawn(ffmpeg, ffmpegArgs(args.out, wav), { stdio: ['pipe', 'ignore', 'inherit'] });
        const done = new Promise((res) => ff.on('exit', (code) => res(code)));
        for (let f = 0; f < total; f++) {
            await evaluate('tour.seek(' + f + '); new Promise(function (r) { requestAnimationFrame(function () { r(true); }); })');
            const shot = await c.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: SIZE.width, height: SIZE.height, scale: 1 } });
            if (!ff.stdin.write(Buffer.from(shot.data, 'base64'))) await new Promise((r) => ff.stdin.once('drain', r));
            if (f % 600 === 0) process.stderr.write('tour-record: ' + args.name + '-' + args.lang + ' frame ' + f + ' / ' + total + '\n');
        }
        ff.stdin.end();
        const code = await done;
        c.close();
        if (code !== 0) throw new Error('tour-record: ffmpeg exited ' + code);
        return total;
    } finally {
        child.kill();
        try {
            fs.rmSync(profileDir, { recursive: true, force: true });
        } catch (e) {
            // The browser may still hold it; `npm run clean` gets it later.
        }
    }
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const ffmpeg = ffmpegPath(process.env);
    if (!ffmpeg) {
        process.stderr.write('tour-record: ffmpeg not found — put it on PATH or set FANKEEL_FFMPEG to its full path\n');
        process.exit(2);
    }
    const browser = findBrowser();
    if (!browser) {
        process.stderr.write('tour-record: no Chromium-family browser found (FANKEEL_BROWSER, Edge, Chrome, or an ms-playwright cache)\n');
        process.exit(2);
    }
    const total = await record(args, ffmpeg, browser);
    const got = countFrames(ffprobeOf(ffmpeg), args.out);
    const audio = audioStreams(ffprobeOf(ffmpeg), args.out);
    const seconds = total / 60;
    const heard = !!audio && audio.length === 1 && Math.abs(audio[0] - seconds) <= 0.1;
    process.stdout.write(args.out + '\n' + 'frames ' + got + ' / ' + total + '\n'
        + 'audio ' + (audio ? audio.map((d) => d.toFixed(2) + ' s').join(', ') || 'none' : 'unreadable') + ' / one stream of ' + seconds.toFixed(2) + ' s\n');
    if (got !== total || !heard) process.exit(1);
}

if (require.main === module) {
    main().catch((e) => {
        process.stderr.write(String((e && e.message) || e) + '\n');
        process.exit(1);
    });
}
module.exports = { parseArgs, ffmpegPath, ffprobeOf, ffmpegArgs, scoreWav, devtoolsPort, countFrames, audioStreams };
```

  在 `docs/01-guide/station.md`，導覽那一列換成：

```md
| 導覽 | `#/tour` | 一支 60 秒的文件區塊動畫，配純音樂，中英兩版跟著監控站的語言，講 fankeel 怎麼跑一個任務；要從 serve 開的頁面才看得到 |
```

  下一段英文只把已經存在的路徑放進反引號；錄出來的檔名在 gitignored 的目錄裡，
  所以不加反引號，docs-check 才不會把它當成斷掉的引用。

  在 `docs/90-agent/reference/station.md` 的 Search, the tour and the served files 一節，以「導覽 (#/tour) frames」開頭、以「a redraw would restart the film.」結尾的那一段之後，以「serve answers a fixed list」開頭的那一段之前，加一段：

```md
The film is `assets/station/tour-stages.js`: sixty seconds at 60 fps, eleven
cuts of document blocks — `assets/station/tour-opening.js` and
`assets/station/tour-closing.js`, drawn with `assets/station/tour-doc.js` —
each starting on a bar line of a 120 BPM score. The score is
`assets/station/tour-music.js`, synthesised in the page on the first press of
play and never stored as a file; the button at the end of the player's bar
mutes it. The film speaks the station's language, `FK_I18N.lang`, unless the
page's url says `?lang=zh` or `?lang=en`. `node scripts/tour-record.js stages
--lang zh|en` records one language to stages-zh.mp4 or stages-en.mp4 under
.fankeel/build/tour with the score muxed in as AAC, and exits 1 unless
ffprobe reads 3600 frames and exactly one audio stream of 60 seconds.
```

- [ ] **Step 4: 跑，看它通過。** `node --test tests/tour-record.test.js`，全綠；`node scripts/docs-check.js` exit 0（新段落裡反引號的路徑都存在）。

- [ ] **Step 5: 錄兩支。** 各用背景執行，等它結束再讀輸出：

```
node scripts/tour-record.js stages --lang zh
node scripts/tour-record.js stages --lang en
```

  兩次都要 exit 0，stdout 各三行：mp4 路徑、`frames 3600 / 3600`、`audio 60.00 s / one stream of 60.00 s`（AAC 的長度可能是 60.02 之類，只要在 ±0.1 內就過）。把兩段 stdout 原文貼進回報，這就是 design「錄出的 `stages-zh.mp4`、`stages-en.mp4` 用 ffprobe 看各有一條 60 秒音軌、3600 格畫面」那一列的證據。mp4 與 wav 在 `.fankeel/build/` 底下，gitignored，不提交。

- [ ] **Step 6: Commit** — 路徑 `scripts/tour-record.js`、`tests/tour-record.test.js`、`docs/01-guide/station.md`、`docs/90-agent/reference/station.md`；訊息 `feat(tour-record): --lang zh|en, the score muxed in, one audio stream checked`。

## Coverage

| promise | task |
|---|---|
| `assets/station/tour-stages.js` 的 `termCut()`、`landCloseup()` 和所有終端機 chrome 刪除，不留任何終端機畫面。 | Task 6（整檔換掉；`the source keeps no terminal cut`）、Task 4、Task 5（`no terminal` 測試） |
| 每一格是一頁文件：頁框、檔名標籤，裡面的區塊（標題、清單列、表格、提示框、選項卡）在拍點上一塊一塊由下往上浮入。內容用示範任務「多倉庫庫存與調撥」、專案 `inventory-admin`。 | Task 3（`page()`、`rise`）、Task 4、Task 5 |
| 十一格與格數，每格起點都是 120 的倍數：hook 0–239、route 240–479、survey 480–839、design 840–1199、plan 1200–1559、build 1560–1919、verify 1920–2279、audit 2280–2639、land 2640–2999、clash 3000–3239、outro 3240–3599。 | Task 4、Task 5（各格 `len`）、Task 6（起點斷言） |
| 每格的畫面內容照分鏡圖對應的 `data-block`（`cut-hook` … `cut-outro`）：hook 文件越疊越高、三塊變灰加刪除線「已過時」；route 任務卡加 7 顆 stage 色點依序亮；survey 三列找到的檔案加 `class: bounded` 提示框；design 方案一句、檔案表、「✓ 核准」選項卡；audit 文件樹兩頁標「過時」、一頁移進 `archive/`；land `TODO.md` 劃掉一條、「工作樹乾淨 ✓」；clash 兩張 session 卡碰同一檔案、琥珀色 `CLASH`；outro 兩行安裝指令加 tagline。 | Task 4（hook、route、survey、design）、Task 5（audit、land、clash、outro） |
| plan 格講「自動拆解、看出誰能一起做」：A（`Files: src/stock/warehouse.ts`）、B（`Files: src/transfer/api.ts`）併進「同時」框，C（`Consumes: A`）排到下一排，箭頭標「等 A」。這對應 `lib/plantasks.js` 依 `Files:` 不重疊分組、`Consumes` 排在後面。 | Task 4（plan） |
| build 格講「能平行的一起跑，該排隊的排隊」：兩條跑道，A、B 同一拍亮綠、各自一顆 reviewer 點、同時 ○→✓，之後 C 才亮綠、reviewer、✓。 | Task 4（build） |
| `beats` 和 `stills` 跟著新格數重算；`length` 仍是 3600。 | Task 6 |
| 新檔 `assets/station/tour-music.js`：譜寫成資料（和弦、bass、kick、pluck 琶音、pad），用純 JS 合成出單聲道 PCM（Float32，44100 Hz），瀏覽器和 Node 共用同一份，不加任何依賴，repo 不放音檔。 | Task 2 |
| 風格：明亮科技 pluck，120 BPM；每次換場（每個 cut 起點）一聲 whoosh/重音，每個區塊浮入一聲 pluck，route 格進主旋律，outro 在最後一小節收在主和弦。 | Task 2（whoosh、hit、pluck、主旋律從第 3 小節、第 29 小節起主和弦）、Task 6（`cues`） |
| 長度剛好 3600 / 60 = 60 秒，峰值不超過 0.9（不破音），最後半小節淡出。 | Task 2 |
| `assets/station/tour-player.js` 播放時用 Web Audio 播這段 PCM，play / pause / seek 時聲音跟畫面同步；加一個靜音鈕；瀏覽器擋自動播放時，第一次點播放才出聲。 | Task 7 |
| `scripts/tour-record.js` 在 Node 裡用同一個模組寫出 WAV，ffmpeg 把它和畫面合成一支 mp4（`-c:a aac -shortest`），之後用 ffprobe 確認有一條音軌。 | Task 8 |
| 影片裡每一個字串都放進一張 `{ zh, en }` 對照表，語言跟著 station 的 `I18N.lang`；英文用分鏡圖 `?lang=en` 的寫法（例如任務名 "Multi-warehouse transfers"）。中英共用同一組座標和同一條配樂。 | Task 3（`S`、`t()`、同一份座標）、Task 7（`FK_I18N.lang`、同一條配樂） |
| `assets/station/tour.js` 的字體順序依語言切換：zh 把 "Microsoft JhengHei UI","Microsoft JhengHei","PingFang TC","Noto Sans TC" 排在 "Bahnschrift" 前面；en 讓 "Bahnschrift" 在前。 | Task 1 |
| 新增 `fit()`：畫字前用 `measureText` 量寬，超過給定寬度就一級一級縮小字級（最多縮三級），仍放不下才換行；換行時「。，、」不落在行首。 | Task 1 |
| 等寬字體（Cascadia Mono）只放 ASCII；中文標籤一律用介面字體。垂直置中用量到的 `actualBoundingBoxAscent`，不用寫死的偏移。 | Task 1（`midY`、`fitRuns`、`sweep` 的 `monoWide`）、Task 4、Task 5、Task 6（測試） |
| `scripts/tour-record.js` 加 `--lang zh\|en`，預設 `zh`，中英各錄一支（`stages-zh.mp4`、`stages-en.mp4`）。 | Task 8 |
| 不打包字體檔：錄影固定在 Windows 上跑，網頁版用系統字體。 | Task 1（`UI_FONTS` 只列系統字體，不加任何字體檔） |
| `docs/01-guide/station.md` 和 `docs/90-agent/reference/station.md` 裡「無聲」「一支影片」等描述改成現在的樣子：一支 60 秒、有配樂、中英兩版的文件區塊動畫。 | Task 8（兩頁）、Task 7（`tour.html` 的說明文字） |
| `tests/tour-stages.test.js`：十一格起點都是 120 的倍數，來源裡沒有 `termCut` | Task 6 |
| 中英每一個字串用 `measureText` 量過，不超過它的方塊寬度 | Task 6（Node，fake 量寬）、Task 7（`?check`，瀏覽器真字體） |
| `tests/tour-music.test.js`：PCM 長度 = 60 × 44100，每個 cut 起點附近 50 ms 內有重音，峰值 ≤ 0.9 | Task 2 |
| 錄出的 `stages-zh.mp4`、`stages-en.mp4` 用 ffprobe 看各有一條 60 秒音軌、3600 格畫面 | Task 8 Step 5 |
