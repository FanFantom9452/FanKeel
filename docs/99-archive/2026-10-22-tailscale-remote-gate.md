---
status: current
---

# Tailscale 遠端：station: 行印網址或原因，開啟前要過 gate Implementation Plan

**Goal:** 開著 `station.remote` 時，`station:` 行印出這台的 MagicDNS 手機網址（失敗時印原因），並讓「開啟」在 station 頁要先過 modal、在 CLI 要先問使用者。
**Architecture:** （mockup 在 .fankeel/build/task-20261022T021538/mockup-remote-modal.html。）三組互不共用檔案，各一個任務。A 讓 `serve.json` 的 `remote` 一路從 `scripts/station.js` 經 `lib/serve.js` 走到 `lib/render.js` 的 `stationLine`；B 在 `assets/station/remote-card.js` 的開關前加 modal，並把失敗原因另起一行；C 讓 `task.js profile set station.remote true` 沒帶 `--confirm` 就拒寫。
**Tech Stack:** Node >=22.5（`package.json:8`），`node:test`，不加依賴；頁面端是不經建置的原生 JS 與 `station.css`。
**Spec:** ../../../.fankeel/build/task-20261022T021538/design.md

## Global Constraints

從 `node scripts/map.js` 寫出的 `.fankeel/map.md`、`package.json` 與現有測試取得；repo 沒有 `CLAUDE.md`。

- `package.json:8`：`"node": ">=22.5"`；`package.json` 沒有 `dependencies`，不加依賴。
- 測試是 `node --test`（`npm run test:fast` 跳過 `@slow`）；一個任務的實作者只跑自己的測試檔。
- `lib/` 不 require `scripts/` 或 `hooks/`（map 的 tree：「nothing here reaches into scripts/ or hooks/」）。
- `lib/notify.js` 不動：`remoteBase` 只認 `^https:\/\/[^/\s]+\/$`（`lib/notify.js:29`）。
- `serve.json` 的 `url` 永遠是 loopback（`hooks/pane.ts` 只收那個）；tailnet 位址只在 `remote`。
- `stationLine` 的六種結尾與其測試在 `tests/render.test.js:700-720`；`starting`、`failed` 不可帶網址（render-1）；沒有 `remote` 時現行字串一字不變。
- `tests/serve.test.js` 對 `ensureServe` 用 `deepEqual({ state, url })`：沒有 `remote` 時回傳不可多出 `remote` 這個 key。
- 注入區塊的上限 2400（`lib/render.js:372` 一帶的註解）；新增尾巴要讓 init 區塊仍在上限內。
- `assets/station/remote-card.js` 的字串：`loc('key', '中文')` 要寫在同一行，每個 key 在 `EN` 有純英文值，`EN` 每筆都被用到（`tests/station-module.js` 的 `stringsLeft`）；EN 值不用單引號。
- 卡片畫出的每個 `rm*` class 在 `assets/station/station.css` 都要有規則（`tests/station-remote-card.test.js:187`）。
- 檔案長度上限 `READ_CAP` 1500、每任務最多 3 個 `Modify:`（`FILE_CAP`）；`scripts/station.js`（1230 行）、`scripts/task.js`（1846 行）、`assets/station/station.css`（2604 行）、`lib/render.js` 照範圍寫。
- JS 縮排 4 個空格、單引號、分號；commit 訊息 `feat:` / `fix:` / `docs:` / `chore:` 開頭。

## Risks

- 非 https 的 `remote.url` 或非字串的 `remote.warning` 進了 `serve.json`，印到每個 prompt 的 `station:` 行 — Task 2 — 先寫「只收 https url 或字串 warning」的測試再寫 `remoteOf`。
- modal 放在 `#rm-card` 裡，station 頁的 5 秒重畫會把整張卡換掉 — Task 3 — modal 由模組變數 `confirming` 決定要不要畫、並用 `open` 屬性而不是 `showModal()`，重畫後仍在。
- `tests/station-remote.test.js` 的「tailscale 沒在跑」測試現在斷言 `remote === undefined` — Task 2 — 該斷言要改成 `{ warning }`，其餘測試仍斷言沒有 `remote`。
- `--confirm` 若被 `task.js` 當成註解文字吃掉 — Task 4 — 跟 `--default` 一樣從整個 argv 讀 `whole.includes('--confirm')`。
- station 頁的 `POST /profile`（`scripts/station.js:912`）直接呼叫 `profile.write`，不經 `task.js` — Task 4 — 測試用 `profile.write` 證明這條路徑不受 `--confirm` 影響。

## Task 1: `station:` 行印出遠端網址或原因

**Files:**
- Modify: `lib/render.js:353-368` — `stationLine` 在 serving 三種結尾後接 phone 或 remote off 尾巴
- Modify: `docs/90-agent/reference/station.md:58-63` — 「the line ends」表補 phone 與 remote off 兩行
- Test: `tests/render.test.js`

**Interfaces:**
- Consumes: `ensureServe` 的回傳可帶 `remote: { url: string } | { warning: string }`（Task 2 產出；本任務的測試直接餵這個形狀，不依賴 Task 2）
- Produces: `stationLine(station, serve)` 讀 `serve.remote`

**Dispatch:** implementer, sonnet — 程式碼都在計畫裡；轉寫加測試。

- [ ] **Step 1: 寫 render 的失敗測試**

在 `tests/render.test.js` 檔尾加：

```js
test('the station line carries the tailnet phone url, or why remote is off, after a serving ending', () => {
  const url = 'http://127.0.0.1:7817/';
  const dns = 'ymlab-pc.tail1234.ts.net';
  const served = (serve) => renderInit({ sessionId: MINE, station: null, serve });
  const on = { url: 'https://' + dns + '/' };
  assert.match(served({ state: 'running', url, remote: on }),
    /^station: http:\/\/127\.0\.0\.1:7817\/ \(serve was running\)\. phone: https:\/\/ymlab-pc\.tail1234\.ts\.net\/m — Tailscale MagicDNS ymlab-pc\.tail1234\.ts\.net\.$/m);
  assert.match(served({ state: 'started', url, remote: on }), /\(serve started, browser opened\)\. phone: https:\/\/ymlab-pc\.tail1234\.ts\.net\/m — Tailscale MagicDNS /);
  assert.match(served({ state: 'busy', url, remote: on }), /\(serve is busy loading; the page fills in when it finishes\)\. phone: https:\/\//);
  assert.match(served({ state: 'running', url, remote: { warning: 'tailscale is Stopped, not Running' } }),
    /^station: http:\/\/127\.0\.0\.1:7817\/ \(serve was running\)\. remote off: tailscale is Stopped, not Running\.$/m);
  const long = served({ state: 'running', url, remote: { warning: 'first line ' + 'x'.repeat(200) + '\nsecond line' } });
  const said = /remote off: (.*)\.$/m.exec(long)[1];
  assert.ok(said.length <= 100, 'the reason is cut to 100 characters, got ' + said.length);
  assert.ok(!long.includes('second line'), 'only the first line of the reason');
  assert.doesNotMatch(served({ state: 'running', url, remote: { url: 'http://evil.example/' } }), /phone:|remote off/, 'only an https url');
  assert.doesNotMatch(served({ state: 'running', url, remote: { warning: 42 } }), /phone:|remote off/, 'only a string warning');
  assert.doesNotMatch(served({ state: 'running', url }), /phone:|remote off/, 'no remote, the line is as it was');
  assert.doesNotMatch(served({ state: 'starting', url: null, remote: on }), /phone:/, 'a station still starting names nothing');
  assert.doesNotMatch(served({ state: 'failed', url: null, remote: on }), /phone:/);
});
```

- [ ] **Step 2: 跑，看它失敗**

```sh
node --test tests/render.test.js
```

預期：新測試失敗，其餘通過。

- [ ] **Step 3: 寫 `stationLine` 的尾巴**

在 `lib/render.js`，`function stationLine(station, serve)` 之前加：

```js
// What serve.json's `remote` adds after a serving ending: the phone url when
// Tailscale answered, the reason's first line (at most 100 characters) when it
// did not, nothing for anything else. Only an https url and a string warning
// count, the same rule `remoteBase` in lib/notify.js applies to the url.
function remoteTail(remote) {
    const r = remote && typeof remote === 'object' ? remote : {};
    if (typeof r.url === 'string' && /^https:\/\/[^/\s]+\/$/.test(r.url)) {
        return ' phone: ' + r.url + 'm — Tailscale MagicDNS ' + r.url.slice('https://'.length, -1) + '.';
    }
    if (typeof r.warning === 'string' && r.warning.trim()) {
        const first = r.warning.trim().split(/\r?\n/)[0].trim().replace(/[.\s]+$/, '');
        return ' remote off: ' + (first.length > 99 ? first.slice(0, 98) + '…' : first) + '.';
    }
    return '';
}
```

並把 `stationLine` 的三個 serving 結尾改成：

`lib/render.js`：
```js
    if (typeof s.url === 'string' && s.state === 'running') return 'station: ' + s.url + ' (serve was running).' + remoteTail(s.remote);
    if (typeof s.url === 'string' && s.state === 'started') return 'station: ' + s.url + ' (serve started, browser opened).' + remoteTail(s.remote);
    if (typeof s.url === 'string' && s.state === 'busy') return 'station: ' + s.url + ' (serve is busy loading; the page fills in when it finishes).' + remoteTail(s.remote);
```

- [ ] **Step 4: 跑，看它通過**

```sh
node --test tests/render.test.js
```

預期：全部通過，含原本六種結尾的斷言。

- [ ] **Step 5: 補 `station.md` 的表**

在 `docs/90-agent/reference/station.md`，「The line ends one of six ways」那張表的最後一列 `(<error>).` 之後加兩列：

```md
| `… phone: https://<dns>/m — Tailscale MagicDNS <dns>.` | appended after any of the first three endings when `station.remote` is on and Tailscale answered: `<dns>` is this machine's MagicDNS name, read from `remote.url` in `serve.json` |
| `… remote off: <reason>.` | appended after any of the first three endings when `station.remote` is on and Tailscale did not answer: the first line of `remote.warning` in `serve.json`, at most 100 characters |
```

並在表後第一段（`The probe and the wait…` 之前）不加字；只要這兩列。

```sh
node scripts/docs-check.js
```

預期：沒有新的壞參考。

- [ ] **Step 6: 跑，然後 commit**

```sh
node --test tests/render.test.js
git add lib/render.js docs/90-agent/reference/station.md tests/render.test.js
git commit -m "feat: the station: line prints the Tailscale phone url, or why remote is off"
```

## Task 2: `serve.json` 與 `ensureServe` 帶 `remote`

**Files:**
- Modify: `scripts/station.js:972-978` — `writeRecord` 在 `tailnet.on` 寫 `remote: { url }`，失敗且有 `tailnet.warning` 寫 `remote: { warning }`
- Modify: `lib/serve.js:150-198` — `ensureServe` 的 `running` / `busy` / `started` 回傳多帶 `remote`
- Test: `tests/serve.test.js`
- Test: `tests/station-remote.test.js`
- Read: `lib/tailscale.js` — `enable` 回傳的 `url` 是 `https://<dns>/`、`warning` 是一行字串，不改

**Interfaces:**
- Consumes: `scripts/station.js` 的 `tailnet` 物件
- Produces: `serve.json` 的 `remote`；`ensureServe` 的回傳可帶 `remote: { url: string } | { warning: string }`

**Dispatch:** implementer, sonnet — 程式碼都在計畫裡；轉寫加測試。

- [ ] **Step 1: 寫 `ensureServe` 的失敗測試**

在 `tests/serve.test.js` 檔尾加（`listener`、`writeRecord`、`tmp`、`PLUGIN` 都已在檔頭定義）：

```js
test('ensureServe carries serve.json\'s remote: an https url or a string warning, nothing else', async () => {
    const cfg = tmp('fankeel-serve-');
    const st = await listener({ pid: process.pid, fingerprint: serve.diskFingerprint(PLUGIN) });
    const record = (remote) => writeRecord(cfg, Object.assign({ pid: process.pid, port: 0, url: st.url, started: new Date().toISOString() }, remote === undefined ? {} : { remote }));
    const ask = () => serve.ensureServe({ configDir: cfg, plugin: PLUGIN, start: () => {} });
    try {
        record({ url: 'https://ymlab-pc.tail1234.ts.net/' });
        assert.deepEqual(await ask(), { state: 'running', url: st.url, remote: { url: 'https://ymlab-pc.tail1234.ts.net/' } });
        record({ warning: 'tailscale is Stopped, not Running' });
        assert.deepEqual(await ask(), { state: 'running', url: st.url, remote: { warning: 'tailscale is Stopped, not Running' } });
        for (const bad of [{ url: 'http://evil.example/' }, { url: 'https://a.b/path' }, { warning: 42 }, { warning: '  ' }, 'x', null, {}]) {
            record(bad);
            assert.deepEqual(await ask(), { state: 'running', url: st.url }, JSON.stringify(bad));
        }
        record();
        assert.deepEqual(await ask(), { state: 'running', url: st.url });
    } finally {
        await st.close();
    }
});

test('a station started by this call brings its remote back with the url', async () => {
    const cfg = tmp('fankeel-serve-');
    const start = () => {
        setTimeout(() => writeRecord(cfg, { pid: 4244, port: 7817, url: 'http://127.0.0.1:7817/', started: 'now', remote: { warning: 'tailscale is Stopped, not Running' } }), 50);
    };
    const got = await serve.ensureServe({ configDir: cfg, plugin: PLUGIN, start, until: Date.now() + 3000 });
    assert.deepEqual(got, { state: 'started', url: 'http://127.0.0.1:7817/', remote: { warning: 'tailscale is Stopped, not Running' } });
});
```

- [ ] **Step 2: 跑，看它失敗；然後寫 `ensureServe`**

```sh
node --test tests/serve.test.js
```

預期：這兩個新測試失敗。

在 `lib/serve.js`，`const PROBE_FLOOR_MS = 250;` 之後、`function ensureServe(opts) {` 之前加：

```js
// serve.json's `remote`, kept only when it is something `stationLine` may
// print: an https url shaped as lib/notify.js `remoteBase` takes it, or a
// non-empty string warning. Anything else is dropped rather than repaired.
function remoteOf(record) {
    const r = record && record.remote;
    if (!r || typeof r !== 'object') return null;
    if (typeof r.url === 'string' && /^https:\/\/[^/\s]+\/$/.test(r.url)) return { url: r.url };
    if (typeof r.warning === 'string' && r.warning.trim()) return { warning: r.warning };
    return null;
}
// The answer as it was, plus `remote` only when there is one.
function withRemote(answer, record) {
    const remote = remoteOf(record);
    return remote ? Object.assign(answer, { remote }) : answer;
}
```

並在 `ensureServe` 內改三處：

`lib/serve.js`：
```js
        if (seen.state === 'busy') return withRemote({ state: 'busy', url: before.url }, before);
```

`lib/serve.js`：
```js
        if (alive && !stale) return withRemote({ state: 'running', url: before.url }, before);
```

`lib/serve.js`：
```js
                    resolve(withRemote({ state: 'started', url: now.url }, now));
```

- [ ] **Step 3: 跑 serve 測試，然後寫 `writeRecord` 與它的測試**

```sh
node --test tests/serve.test.js
```

預期：通過。

在 `scripts/station.js`，`writeRecord` 內把寫檔那一行改成：

```js
        const remote = tailnet.on ? { remote: { url: tailnet.url } } : (tailnet.warning ? { remote: { warning: tailnet.warning } } : {});
        fs.writeFileSync(record, JSON.stringify(Object.assign({}, data, remote), null, 2) + '\n');
```

在 `tests/station-remote.test.js` 的「a tailscale that is not running leaves remote off…」測試裡，把最後一行斷言

```js
        assert.equal(readServeRecord(f.cfg).remote, undefined);
```

改成（這是該測試 `finally` 之前的那一行，不是檔內其他兩處）：

`tests/station-remote.test.js`：
```js
        assert.deepEqual(readServeRecord(f.cfg).remote, { warning: card.warning }, 'the reason rides serve.json so the station: line can print it');
```

其餘兩處 `remote, undefined` 斷言（遠端關著的測試）不動。

```sh
node --test tests/station-remote.test.js
```

預期：通過。

- [ ] **Step 4: 跑，然後 commit**

```sh
node --test tests/serve.test.js tests/station-remote.test.js
git add scripts/station.js lib/serve.js tests/serve.test.js tests/station-remote.test.js
git commit -m "feat: serve.json and ensureServe carry the tailnet url or why remote is off"
```

## Task 3: 開關撥到開先跳 modal，失敗原因另起一行

**Files:**
- Modify: `assets/station/remote-card.js` — `confirming` 狀態、`askDialog()`、`view` 第三參數、change / click / keydown 的處理、`rm.notLinked` 去掉 `: {why}` 並多一行 `rm-why`
- Modify: `assets/station/station.css:2569-2604` — `.rm-ask`、`.rm-need`、`.rm-after`、`.rm-why` 的規則（遠端卡區塊尾端）
- Test: `tests/station-remote-card.test.js`
- Read: `.fankeel/build/task-20261022T021538/mockup-remote-modal.html` — `modal` 與 `card-on-failed` 兩個 block 的 DOM 與 CSS，照抄
- Read: `tests/station-module.js` — `stringsLeft` 的規則

**Interfaces:**
- Consumes: `POST /profile`（`scope=machine&key=station.remote&value=true|false`，已存在，不改）
- Produces: `view(state, now, ask)`，第三個參數選填，真值時卡片尾端多一個 `<dialog open class="tdlg rm-ask" id="rm-ask" data-block="modal">`；`EN` 多了 `rm.askTitle`、`rm.askWhy`、`rm.askBefore`、`rm.askInstall`、`rm.askDns`、`rm.askAfter`、`rm.askOpen`、`rm.askPair`、`rm.cancel`、`rm.confirm`；兩個新 `data-rm` 值 `ask-cancel`、`ask-on`

**Dispatch:** implementer, sonnet — DOM 與 CSS 取自 mockup、字串照 `loc` 慣例；轉寫加測試。

- [ ] **Step 1: 寫失敗測試**

在 `tests/station-remote-card.test.js` 裡：

把「on while Tailscale is not serving the station」測試中的這一行

```js
    assert.ok(h.includes('<i class="dot stale"></i>Tailscale 沒有替測站開門：tailscale is Stopped, not Running'));
```

改成：

`tests/station-remote-card.test.js`：
```js
    assert.ok(h.includes('<i class="dot stale"></i>Tailscale 沒有替測站開門</div><p class="rm-why">tailscale is Stopped, not Running</p>'));
```

在檔尾加：

`tests/station-remote-card.test.js`：
```js
test('the ask dialog is drawn only when asked for, with both buttons and the two prerequisites', () => {
    assert.ok(!R.view(OFF, NOW).includes('rm-ask'));
    assert.ok(!R.view(OFF, NOW, false).includes('rm-ask'));
    const h = R.view(OFF, NOW, true);
    assert.match(h, /<dialog open class="tdlg rm-ask" id="rm-ask" data-block="modal" aria-labelledby="rm-ask-t">/);
    assert.ok(h.includes('Tailscale 遠端是進階功能'));
    assert.equal((h.match(/class="rm-need"/g) || []).length, 1);
    assert.equal((h.match(/<li>/g) || []).length, 2);
    assert.match(h, /data-rm="ask-cancel"[^>]*>取消<\/button>/);
    assert.match(h, /class="btn go" data-rm="ask-on">我了解，開啟<\/button>/);
    assert.match(h, /<\/dialog><\/section>$/, 'the dialog is inside #rm-card, so a repaint of the card keeps it');
});

test('switching on opens the ask and posts nothing; cancel turns the switch back off; the confirm posts true', async () => {
    const b = boot({ state: OFF });
    b.R.html(true);
    await settle();
    b.fire('change', ctl({ 'data-rm': 'switch' }, true));
    await settle();
    assert.deepEqual(b.calls.filter((c) => c.method === 'POST'), [], 'no POST before the user says yes');
    assert.ok(b.card.outerHTML.includes('id="rm-ask"'), 'the ask is on the card');
    assert.ok(!/data-rm="switch" checked/.test(b.card.outerHTML), 'the switch is still off behind the ask');
    b.fire('click', ctl({ 'data-rm': 'ask-cancel' }));
    await settle();
    assert.ok(!b.card.outerHTML.includes('rm-ask'), 'cancel closes it');
    assert.deepEqual(b.calls.filter((c) => c.method === 'POST'), [], 'cancel posts nothing');
    b.fire('change', ctl({ 'data-rm': 'switch' }, true));
    b.fire('click', ctl({ 'data-rm': 'ask-on' }));
    await settle();
    const posts = b.calls.filter((c) => c.method === 'POST').map((c) => [c.url, Object.fromEntries(c.body)]);
    assert.deepEqual(posts, [['/profile', { nonce: 'N0NCE', scope: 'machine', key: 'station.remote', value: 'true' }]]);
    assert.ok(!b.card.outerHTML.includes('rm-ask'), 'the ask is closed once confirmed');
});

test('the ask survives a repaint through html(), and Escape cancels it', async () => {
    const b = boot({ state: OFF });
    b.R.html(true);
    await settle();
    b.fire('change', ctl({ 'data-rm': 'switch' }, true));
    assert.ok(b.R.html(true).includes('id="rm-ask"'), 'the page\'s redraw draws the ask again');
    const keys = [];
    b.fire('keydown', null);
    b.fire('keydown', { key: 'Escape' });
    assert.ok(!b.R.html(true).includes('id="rm-ask"'));
    assert.deepEqual(b.calls.filter((c) => c.method === 'POST'), []);
    assert.deepEqual(keys, []);
});
```

`boot` 的 `fire` 目前把事件物件固定成 `{ target: { closest } }`；為了 keydown 把 `boot` 裡的 `fire` 改成：

`tests/station-remote-card.test.js`：
```js
    const fire = (type, ctl) => (listeners[type] || []).forEach((fn) => fn(ctl && ctl.key ? ctl : { target: { closest: (sel) => (sel === '#rm-card [data-rm]' ? ctl : null) } }));
```

並把 `every class the card draws has a rule in station.css` 測試裡的 `R.view(s, NOW)` 改成 `R.view(s, NOW, true)`，把類別清單加上 `'rm-ask', 'rm-need', 'rm-after', 'rm-why'`（在 `'m-switch'` 之後）。英文測試的迴圈同樣把 `b.R.view(s, NOW)` 改成 `b.R.view(s, NOW, true)`。

注意第三個測試裡 `keys` 是多餘的變數，刪掉 `const keys = [];` 與最後一行 `assert.deepEqual(keys, [])`。

- [ ] **Step 2: 跑，看它失敗**

```sh
node --test tests/station-remote-card.test.js
```

預期：新增與改過的測試失敗。

- [ ] **Step 3: 寫字串**

在 `assets/station/remote-card.js` 的 `EN` 表裡，把 `'rm.notLinked'` 那行換成下面這行，並在 `'rm.unsent'` 之後加其餘各行：

```js
        'rm.notLinked': 'Tailscale is not serving the station',
```

`assets/station/remote-card.js`：
```js
        'rm.askTitle': 'Tailscale remote is an advanced feature',
        'rm.askWhy': 'If you do not know Tailscale, leave this off. While it is off, only 127.0.0.1 on this computer can see the station.',
        'rm.askBefore': 'Before you turn it on',
        'rm.askInstall': 'Tailscale is installed on this computer and on the phone, both signed in to the same account.',
        'rm.askDns': 'MagicDNS and HTTPS certificates are on in the admin console of the tailnet.',
        'rm.askAfter': 'Once it is on',
        'rm.askOpen': 'On the phone, <code>https://&lt;MagicDNS name of this computer&gt;/</code> opens the phone page <code>/m</code>, for example <code>https://desk.tail1234.ts.net/</code>.',
        'rm.askPair': 'The first time, scan the pairing QR on this card with the phone.',
        'rm.cancel': 'Cancel',
        'rm.confirm': 'I understand, turn it on',
```

- [ ] **Step 4: 寫 `askDialog`、`view` 與狀態**

在 `remote-card.js`，`var REFRESH = …` 之後加警告圖示：

`assets/station/remote-card.js`：
```js
    var WARN = '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path>';
    var BOX = '<rect width="18" height="18" x="3" y="3" rx="2"></rect>';
```

在 `function waiting()` 之前加 `askDialog`，並把原來的 `function view(state, now) {` 改名為 `function draw(state, now) {`，然後在它後面加新的 `view`：

`assets/station/remote-card.js`：
```js
    // The ask before the switch goes on (mockup block `modal`). It sits inside
    // #rm-card with `open` rather than through showModal(), so the page's
    // repaint of the card draws it again instead of dropping it.
    function askDialog() {
        return '<dialog open class="tdlg rm-ask" id="rm-ask" data-block="modal" aria-labelledby="rm-ask-t"><div class="tdlg-in">'
            + '<div class="tdlg-hd">' + ico(WARN, 16) + '<b id="rm-ask-t">' + loc('rm.askTitle', 'Tailscale 遠端是進階功能') + '</b></div>'
            + '<div class="tdlg-p">'
            + '<p class="lead">' + loc('rm.askWhy', '不熟 Tailscale 的話，建議不要開。關著的時候，只有這台電腦的 127.0.0.1 看得到測站。') + '</p>'
            + '<h3>' + loc('rm.askBefore', '開之前要先完成') + '</h3>'
            + '<ul class="rm-need">'
            + '<li>' + ico(BOX, 16) + '<span>' + loc('rm.askInstall', '這台電腦與手機都裝好 Tailscale，並登入同一個帳號。') + '</span></li>'
            + '<li>' + ico(BOX, 16) + '<span>' + loc('rm.askDns', '在 tailnet 的 admin console 打開 MagicDNS 與 HTTPS 憑證。') + '</span></li>'
            + '</ul>'
            + '<h3>' + loc('rm.askAfter', '開了之後') + '</h3>'
            + '<p class="rm-after">' + loc('rm.askOpen', '手機打開 <code>https://&lt;這台電腦的 MagicDNS 名稱&gt;/</code> 會到手機頁 <code>/m</code>，例如 <code>https://desk.tail1234.ts.net/</code>。') + '</p>'
            + '<p class="rm-after">' + loc('rm.askPair', '第一次要用手機掃這張卡上的配對 QR。') + '</p>'
            + '</div>'
            + '<div class="tdlg-ft">'
            + '<button type="button" class="btn" data-rm="ask-cancel" autofocus>' + loc('rm.cancel', '取消') + '</button>'
            + '<button type="button" class="btn go" data-rm="ask-on">' + loc('rm.confirm', '我了解，開啟') + '</button>'
            + '</div></div></dialog>';
    }
    // The card, and the ask inside it as its last child while `ask` is true.
    function view(state, now, ask) {
        var h = draw(state, now);
        return ask ? h.replace(/<\/section>$/, askDialog() + '</section>') : h;
    }
```

把 `draw` 裡 `rm.notLinked` 那一行（`body += status('stale', …)`）換成：

`assets/station/remote-card.js`：
```js
            body += status('stale', loc('rm.notLinked', 'Tailscale 沒有替測站開門'));
            if (S.warning) body += '<p class="rm-why">' + esc(S.warning) + '</p>';
```

把 `paint` 與 `html` 裡的 `view(held, Date.now())` 都改成 `view(held, Date.now(), confirming)`，並在 `var asking = false;` 之後加：

`assets/station/remote-card.js`：
```js
    var confirming = false;
```

- [ ] **Step 5: 寫事件處理**

在 `remote-card.js` 的 `doc.addEventListener('change', …)` 裡，把 `if (kind === 'switch') post(…)` 那行換成：

`assets/station/remote-card.js`：
```js
            if (kind === 'switch' && c.checked) { confirming = true; paint(); }
            else if (kind === 'switch') post('/profile', { scope: 'machine', key: 'station.remote', value: value });
```

在 `doc.addEventListener('click', …)` 裡，`if (kind === 'code')` 之前加：

`assets/station/remote-card.js`：
```js
            if (kind === 'ask-cancel') { confirming = false; paint(); return; }
            if (kind === 'ask-on') { confirming = false; post('/profile', { scope: 'machine', key: 'station.remote', value: 'true' }); return; }
```

並在 click 的 `addEventListener` 之後加：

`assets/station/remote-card.js`：
```js
        doc.addEventListener('keydown', function (e) {
            if (confirming && e && e.key === 'Escape') { confirming = false; paint(); }
        });
```

`api` 不變（`view` 已在其中）。

- [ ] **Step 6: 寫 CSS**

在 `assets/station/station.css` 的 `.rm-off .rm-st{margin-bottom:0;color:var(--ink2)}`（卡片區塊最後一行）之後加。`.tdlg` 本身在 1820 行起已有規則；這裡只加 modal 內的版面，並把 mockup 的框內絕對定位換成整個視窗的固定定位（遮罩用 box-shadow，因為 `open` 的非 modal dialog 沒有 `::backdrop`）：

```css
.tdlg.rm-ask{position:fixed;inset:0;z-index:60;margin:auto;width:min(520px,calc(100vw - 32px));height:fit-content;max-height:calc(100vh - 48px);overflow:auto;box-shadow:0 0 0 100vmax rgba(10,14,20,.5),inset 0 0 0 1px var(--rule)}
.rm-ask .tdlg-in{height:auto}
.rm-ask .tdlg-hd b{font:700 15px var(--f-ui)}
.rm-ask .tdlg-hd .ico{flex:none;color:var(--signal-ink)}
.rm-ask .tdlg-p{padding:16px 20px 18px;font-size:13.5px;line-height:1.55}
.rm-ask p{margin:0;max-width:62ch}
.rm-ask .lead{color:var(--ink2)}
.rm-ask h3{margin:18px 0 8px;font-size:12.5px;font-weight:700;color:var(--ink)}
.rm-need{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.rm-need li{display:grid;grid-template-columns:18px minmax(0,1fr);gap:10px;align-items:start}
.rm-need .ico{margin-top:2px;color:var(--muted)}
.rm-after{color:var(--ink2)}
.rm-after code,.rm-ask .lead code{font:12.5px var(--f-mono);color:var(--ink);overflow-wrap:anywhere}
.rm-after + .rm-after{margin-top:6px}
.rm-ask .tdlg-ft{justify-content:flex-end;flex-wrap:wrap;gap:8px}
.rm-ask .tdlg-ft .btn{min-height:36px;padding:0 14px;font-size:13px}
.rm-ask .tdlg-ft .btn:focus-visible{outline:2px solid var(--keel);outline-offset:2px}
.rm-why{margin:-4px 0 12px;padding:8px 12px;border-radius:var(--r-sm);background:var(--inset);font:12.5px/1.5 var(--f-mono);color:var(--ink2);overflow-wrap:anywhere}
```

- [ ] **Step 7: 跑，看它通過，然後 commit**

```sh
node --test tests/station-remote-card.test.js tests/station-modules.test.js tests/station-remote-mount.test.js
git add assets/station/remote-card.js assets/station/station.css tests/station-remote-card.test.js
git commit -m "feat: ask before the phone remote switch goes on, and put the failure reason on its own line"
```

預期：全部通過（`stringsLeft` 空、每個 class 有規則、英文沒有 CJK）。

## Task 4: `profile set station.remote true` 要帶 `--confirm`

**Files:**
- Modify: `scripts/task.js:235-240` — `parseArgs` 讀 `--confirm`
- Modify: `scripts/task.js:1239-1244` — `profile set` 對 `station.remote true` 沒帶 `--confirm` 時拒寫
- Test: `tests/profile-confirm.test.js`
- Read: `lib/profile.js` — `parseValue(key, raw)` 回 `{ value }` 或 `{ error }`、`write(file, key, value)`，不改
- Read: `tests/agentfile.test.js` — `cli(d, ...args)` 呼叫 `task.js profile` 的寫法，照抄

**Interfaces:**
- Consumes: `profile.parseValue('station.remote', value).value === true`
- Produces: `opts.confirm`（boolean，`parseArgs` 設）；`task.js profile set station.remote true` 沒有 `--confirm` 時輸出警告、exit 1、檔案不變

**Dispatch:** implementer, sonnet — 一個旗標與一個判斷，程式碼都在計畫裡。

- [ ] **Step 1: 寫失敗測試**

建 `tests/profile-confirm.test.js`：

```js
'use strict';
// `task.js profile set station.remote true` is the advanced Tailscale feature:
// without --confirm it refuses, prints the warning and exits 1; off needs no
// confirmation; the station page's own POST /profile path (profile.write) has
// its own modal and is not gated here.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const profile = require('../lib/profile.js');
const tmp = require('./tmp.js');

const TASK = path.join(__dirname, '..', 'scripts', 'task.js');

function cli(d, ...args) {
    const cfg = path.join(d, 'cfg');
    const r = spawnSync(process.execPath, [TASK, 'profile', ...args, '--root', d, '--claude-dir', cfg],
        { encoding: 'utf8', cwd: d, env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }) });
    return { code: r.status, out: r.stdout + r.stderr, cfg };
}
const machineValue = (cfg) => profile.read(null, cfg).values['station.remote'];

test('station.remote true without --confirm is refused: exit 1, the warning, nothing written', () => {
    const d = tmp('fankeel-confirm-');
    const got = cli(d, 'set', 'station.remote', 'true', '--default');
    assert.equal(got.code, 1);
    assert.match(got.out, /Tailscale 遠端是進階功能/);
    assert.match(got.out, /AskUserQuestion/);
    assert.match(got.out, /--confirm/);
    assert.notEqual(machineValue(got.cfg), true, 'the profile is unchanged');
    const project = cli(d, 'set', 'station.remote', 'TRUE');
    assert.equal(project.code, 1, 'a project-level write is gated too, and the value is read the way the profile reads it');
    assert.equal(fs.existsSync(profile.projectFile(d)), false);
});

test('station.remote true with --confirm is written', () => {
    const d = tmp('fankeel-confirm-');
    const got = cli(d, 'set', 'station.remote', 'true', '--default', '--confirm');
    assert.equal(got.code, 0, got.out);
    assert.equal(machineValue(got.cfg), true);
});

test('false needs no confirmation, and neither does any other key', () => {
    const d = tmp('fankeel-confirm-');
    assert.equal(cli(d, 'set', 'station.remote', 'false', '--default').code, 0);
    assert.equal(machineValue(path.join(d, 'cfg')), false);
    assert.equal(cli(d, 'set', 'notify.gate', 'true', '--default').code, 0, 'only station.remote is gated');
});

test('the station page\'s path, profile.write, is not gated: the page has its own modal', () => {
    const d = tmp('fankeel-confirm-');
    const file = profile.machineFile(path.join(d, 'cfg'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const out = profile.write(file, 'station.remote', 'true');
    assert.equal(out.ok, true);
    assert.equal(out.value, true);
});
```

- [ ] **Step 2: 跑，看它失敗**

```sh
node --test tests/profile-confirm.test.js
```

預期：第一個測試失敗（現在 exit 0）。

- [ ] **Step 3: 寫 `--confirm` 與拒寫**

在 `scripts/task.js` 的 `parseArgs`，`if (whole.includes('--default')) opts.default = true;` 之後加：

```js
    if (whole.includes('--confirm')) opts.confirm = true;
```

在 `profile set` 分支，`if (!key || value === undefined) fail('profile set <key> <value>');` 之後加：

`scripts/task.js`：
```js
        // station.remote true opens the station to the tailnet. It is an advanced
        // feature, so the session must ask the user before it writes it; the
        // station page asks in its own modal, and writes through profile.write.
        if (key === 'station.remote' && !opts.confirm && profile.parseValue(key, value).value === true) {
            fail('Tailscale 遠端是進階功能：不熟 Tailscale 的人不該開，開之前要先在這台電腦與手機裝好 Tailscale，並在 admin console 打開 MagicDNS 與 HTTPS 憑證。請先用 AskUserQuestion 問使用者，同意後加 --confirm 再執行一次。');
        }
```

- [ ] **Step 4: 跑，看它通過，然後 commit**

```sh
node --test tests/profile-confirm.test.js tests/agentfile.test.js tests/profile-remote.test.js
git add scripts/task.js tests/profile-confirm.test.js
git commit -m "feat: profile set station.remote true needs --confirm"
```

預期：全部通過。

## Coverage

| promise | task |
|---|---|
| `scripts/station.js` 的 `writeRecord`（:976）：`tailnet.on` 寫 `remote: { url }`；失敗有 `tailnet.warning` 寫 `remote: { warning }` | Task 2 |
| `lib/serve.js` 的 `ensureServe` 的 `running` / `busy` / `started` 回傳多帶 `remote`（只收 https url 或字串 warning） | Task 2 |
| `lib/render.js` 的 `stationLine` 在 serving 結尾後接 ` phone: https://<dns>/m — Tailscale MagicDNS <dns>.` 或 ` remote off: <warning 第一行，至多 100 字>.` | Task 1 |
| tests/render.test.js、tests/serve.test.js、station.js serve.json 測試；docs/90-agent/reference/station.md 的 station: 行表 | Task 1, Task 2 |
| 三種情況：url、warning、皆無（現行字串不變） | Task 1, Task 2 |
| `assets/station/remote-card.js`、`assets/station/station.css`：開關從關撥到開時先開 modal（mockup 的 `modal` block），取消則開關回關，「我了解，開啟」才 POST /profile | Task 3 |
| 失敗狀態原因另起一行（`card-on-failed`，`rm.notLinked` 拿掉 `: {why}`） | Task 3 |
| `lib/profile.js` 或 `scripts/task.js profile set`；對應測試：`station.remote true` 沒帶 `--confirm` 時拒寫、exit 非 0，印出進階功能警告與「先用 AskUserQuestion 問使用者」；帶 `--confirm` 才寫 | Task 4 |
| 三組不共用檔案 → 路線已加 plan。`lib/notify.js` 不動（`remoteBase` 只認 https url） | struck — 沒有要寫的內容；Global Constraints 已記下 `lib/notify.js` 不動，三個任務的 Files 互不重疊 |
| proves it done: A —— render.test.js 新增 url / warning 兩個 case，現在失敗 | Task 1 |
| proves it done: B —— 撥開關不帶確認不送 POST 的測試 | Task 3 |
| proves it done: C —— `profile set station.remote true` 無 `--confirm` 時 exit 非 0、profile 未變 | Task 4 |
| unverified: Tailscale 真正開成功的路徑 —— 這台 PATH 上沒有 `tailscale`；mockup 未在 500px 以下寬度檢查 | struck — 是未驗證的註記，不是承諾；Task 2 用 `fakeTailscale` 的既有測試，Task 3 的 CSS 用 `min(520px,calc(100vw - 32px))` 容納窄螢幕 |
