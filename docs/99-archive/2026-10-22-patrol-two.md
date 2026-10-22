---
status: current
---

# 2026-10-22 第二輪盤點：station 小尾巴、source.test 進快速測試、mockup 對齊、五頁逐頁看 Implementation Plan

**Goal:** 收掉 station 文件長句與過時測試名、讓「每個 export 都被 import」的檢查在快速測試就跑並認得 vm 載入、把 session 頁 mockup 對齊已上線的實作，並讓使用者逐頁看完剩下五頁。
**Architecture:** 四個互不共用檔案的小修各一個任務，最後一個是使用者自己在瀏覽器看頁的任務。source.test 的改法是把逐 exporter 重掃整棵樹改成一次建好索引，這樣 15 秒的檢查才放得進快速測試。「兩組循序派工實跑一次」不需要改碼，在 land 以 done 結案，證據已在 survey 報告。
**Tech Stack:** Node >=22.5（`package.json:8`），`node:test`，不加依賴。
**Spec:** ../../../.fankeel/build/task-20261022T020619/survey.md

## Global Constraints

- 不加依賴、`hooks/` 下不加新檔、不加新的產生檔名（`CONTRIBUTING.md:36`）。
- Node `>=22.5`（`package.json:8`）；測試用 `node:test` 和 `node:assert/strict`；JS 檔以 `'use strict';` 開頭。
- 縮排照所改的檔：`tests/source.test.js`、`tests/pane.test.js`、`tests/station-serve.test.js` 都是四格；mockup 產生器 `_session-build.js` 兩格。
- 快速測試是 `npm run test:fast`，以 `--test-skip-pattern=@slow` 跳過名字含 `@slow` 的測試（`package.json:12`）；名字拿掉 `@slow` 就進快速測試。
- 人看的 reference 頁一句最多 160 欄（`lib/plain.js:12` 的 `MAX_SENTENCE_WIDTH`），`docs-check.js` 以 `long-sentence` 報出。
- TODO 條目只能用 `node scripts/todo.js new` 寫，`--body` 至少 200 字，說來源、要變成什麼、怎樣算完成（`scripts/todo.js:7-8`、`:52-57`）。
- 提交：`type: what changed` 60 字以內，每個改動一行 `- <what changed> — <module>`。

## Risks

- 索引版的 `imported` 漏掉舊版認得的名字，整棵樹突然冒出孤兒 — Task 3 — 改完先跑 `node --test tests/source.test.js`，孤兒清單不空就先比對舊版正規式，不改測試的期望。
- 索引版仍然太慢，快速測試多出好幾秒 — Task 3 — 單檔跑時讀 `every exported name is imported by something` 那行的毫秒數，超過 3000ms 就停下回報，不拿掉 `@slow`。
- `route-session.html` 是產生後手改過的，重跑產生器會蓋掉關卡連結 — Task 4 — 直接改 html，產生器只同步顏色那一行，不重跑。
- station-serve 那個測試這次也不失敗，查不出原因 — Task 2 — 這是預期；任務只把診斷放進斷言訊息並記 Watch，不加重試。

## Task 1: station 說明頁拆長句、改過時測試名

**Files:**
- Modify: `docs/01-guide/station.md` — 第 24、31、46 行三句超過 160 欄
- Modify: `tests/pane.test.js:1416-1416` — 測試名
- Read: `lib/plain.js` — `longSentences` 怎麼切句，不改

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — 三段原文與替換文字和一個測試名都在計畫裡，轉寫加跑檢查。

1. 確認現況：

   ```
   node scripts/docs-check.js 2>&1 | grep 'long-sentence: docs/01-guide/station.md'
   ```

   應該印出 `:24`（211 欄）、`:31`（168 欄）、`:46`（208 欄）三行。

2. 在 `docs/01-guide/station.md` 第 24 行，把這段：

   每個 session 一列，整列點了開它的頁面：一個六角形圖示（顏色是狀態，亮起的段是走過的站，只有正在跑的那站會閃）、專案標籤疊在任務上、route 寫成 n/len 加各站、花費（主 session 加 agent），以及最後一次動作離現在多久

   換成：

   每個 session 一列，整列點了開它的頁面。列的開頭是一個六角形圖示（顏色是狀態，亮起的段是走過的站，只有正在跑的那站會閃），專案標籤疊在任務上。後面依序是 route（寫成 n/len 加各站）、花費（主 session 加 agent），以及最後一次動作離現在多久

3. 在 `docs/01-guide/station.md` 第 31 行，把 `一個專案的報告頁：頁首（名稱與正在跑的 session）、近 30 天的 KPI 卡、四週的花費與落地趨勢、每站一張卡` 換成 `一個專案的報告頁。上半是頁首（名稱與正在跑的 session）、近 30 天的 KPI 卡和四週的花費與落地趨勢。下半是每站一張卡`，該行其餘不動。

4. 在 `docs/01-guide/station.md` 第 46 行，把這句：

   撤掉的方式是跑 `tailscale serve --https=443 --set-path=/ off`，這個指令只撤監控站自己掛在 `/` 的那一條，你在 443 埠其他路徑上掛的 `tailscale serve` 不會動（依 Tailscale 文件，`off` 加在建立 mapping 的旗標後面只撤那一個 mapping，https://tailscale.com/kb/1242/tailscale-serve）。

   換成：

   撤掉的方式是跑 `tailscale serve --https=443 --set-path=/ off`。這個指令只撤監控站自己掛在 `/` 的那一條，你在 443 埠其他路徑上掛的 `tailscale serve` 不會動。依 Tailscale 文件，`off` 加在建立 mapping 的旗標後面只撤那一個 mapping（https://tailscale.com/kb/1242/tailscale-serve）。

5. 在 `tests/pane.test.js` 第 1416 行，把測試名 `'the TODO head counts what lib/todo.js counts open in this repository, and the list draws from that many'` 改成 `'the TODO head counts what lib/todo.js counts open in this repository, and one count button a non-empty heading'`，測試內容不動。

6. 跑：

   ```
   node scripts/docs-check.js 2>&1 | grep -c 'long-sentence: docs/01-guide/station.md'
   node --test tests/pane.test.js 2>&1 | grep -E '^# (pass|fail)'
   ```

   第一行要印 `0`；第二行 fail 要是 0。

7. Commit：`docs: split three long station guide sentences, rename a stale pane test`。

## Task 2: station-serve 失敗時說出原因，並記成 flaky Watch

**Files:**
- Modify: `tests/station-serve.test.js` — 第 391-405 行那個測試的兩個斷言訊息
- Modify: `docs/90-agent/todo/flaky-6.md` — 新條目，由 `todo.js new` 寫出
- Read: `scripts/station.js` — 第 311-333 行 `rememberLeads` 與 join 判斷，不改
- Read: `docs/90-agent/todo/flaky-5.md` — 同一個 group 的寫法

**Interfaces:**
- Consumes: none
- Produces: TODO 條目 `flaky-6`，group `整套再紅一次`

**Dispatch:** implementer, sonnet — 兩個斷言訊息與條目全文都在計畫裡。

1. 在 `tests/station-serve.test.js` 的測試 `a joining serve() writes its own leads into roots.json` 裡，把兩個斷言：

   ```
        assert.equal(second.joined, true, 'the second call joined rather than bound');
        assert.ok(Object.keys(station.readRoots(f.cfg)).includes(path.resolve(r2)),
            'the joiner\'s own lead reached roots.json');
   ```

   在 `tests/station-serve.test.js` 換成：

   ```js
        assert.equal(second.joined, true, 'the second call joined rather than bound — it got '
            + JSON.stringify({ joined: second.joined, url: second.url, first: first.url }));
        const roots = station.readRoots(f.cfg);
        assert.ok(Object.keys(roots).includes(path.resolve(r2)),
            'the joiner\'s own lead reached roots.json — it holds ' + JSON.stringify(Object.keys(roots)));
   ```

   失敗時兩個訊息分別說出是「沒 join 上」（health 判成 dead）還是「join 了但 roots.json 沒寫到」。

2. 跑 `node --test tests/station-serve.test.js 2>&1 | grep -E '^# (pass|fail)'`，fail 要是 0。

3. 寫條目：

   ```
   node scripts/todo.js new --id flaky-6 --label flaky --title "station-serve 加入測試偶發失敗" --description "joining serve() 的 roots.json 測試在 10-22 整套跑紅一次，單檔連跑 8 次都綠，原因未明" --state watch --link tests/station-serve.test.js --group "整套再紅一次" --timing "if: 整套測試再出現一次重跑不見的失敗" --stamp 2026-10-22 --body "來源：2026-10-22 第一輪 TODO 全表盤點的 verify（.fankeel/build/task-20261022T000239/verify.md）整套測試唯一一敗是 tests/station-serve.test.js 的 a joining serve() writes its own leads into roots.json，單檔重跑三次都綠；第二輪盤點又單檔連跑五次，全綠。讀碼的兩個推測：整套負載下 scripts/station.js 第 323 行 500ms 的 health 探測拿到非逾時的錯誤，lib/serve.js 把它判成 dead，於是第二個 serve 自己綁埠，joined 為 false；或 rememberLeads 在第 315 行的 catch 吞掉了寫 roots.json 的錯。第二輪已把兩個斷言訊息改成會印出 joined、url 與 roots.json 的內容。要變成：下次整套再紅時讀斷言訊息分辨是哪一種，修掉那一種。怎樣算完成：失敗訊息指出原因並修好，或整套連跑數次都不再出現。"
   ```

   若 `todo.js` 拒絕（例如 title 超過寬度），照它的訊息縮短後重跑，不手寫檔案。

4. 跑 `node scripts/todo-check.js 2>&1 | tail -1`，要說所有連結都解析得到。

5. Commit：`test: station-serve join test says why it failed, flaky-6 watches it`。

## Task 3: 每個 export 都被 import 的檢查進快速測試，並認得 vm 載入

**Files:**
- Modify: `tests/source.test.js` — 第 32-82 行 `imported` 換成 `importIndex`，第 117-133 行的測試改用它並拿掉 `@slow`，後面加一個 vm 的對照測試
- Test: `tests/source.test.js`
- Read: `tests/station-nav.test.js` — 第 10、39 行是 vm 載入 `assets/station/station.js` 的寫法，不改

**Interfaces:**
- Consumes: none
- Produces: `importIndex(files, body)` → `Map<absolutePath, Set<name>>`，只在 `tests/source.test.js` 內使用

**Dispatch:** implementer, sonnet — 新函式與兩個測試的程式碼都在計畫裡，轉寫加量時間。

1. 先量現況：`node --test tests/source.test.js 2>&1 | grep 'every exported name'`，記下毫秒數（約 15000ms）。

2. 在 `tests/source.test.js`，把第 32-82 行（`// Which names another file actually imports from` 那段註解起，到 `function imported` 的結尾 `}`）整段換成：

   ```js
// Which names each file reaches in each file it loads, read once for the whole
// tree. The first version of this searched every file for the bare word, and that
// version could not fail: `main`, `parseArgs`, `report` and `human` are defined
// locally in most of these scripts, so every one of them matched itself somewhere
// else and read as used. Following the require edge is what makes it mean
// something. Nothing in this repository calls require() on anything but a string
// literal, checked, so resolving them statically covers all of it.
//
// The second version followed the edges again for every exporter, which kept the
// test at fifteen seconds and so out of the fast suite; the orphan it exists to
// catch then surfaced only at audit. Indexing every file once is the same answer.
//
// A test that loads a file into a vm sandbox — `vm.runInNewContext(
// fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js')))`
// — reaches its exports through whatever object it handed the sandbox, so every
// `.name` in that test counts as reaching that file. Looser than a require edge,
// and the only reading a static scan can give it.
function importIndex(files, body) {
    const index = new Map();
    const reach = (target, name) => {
        if (!index.has(target)) index.set(target, new Set());
        index.get(target).add(name);
    };

    for (const rel of files) {
        const src = body.get(rel);
        const self = path.resolve(ROOT, rel);
        const from = path.dirname(self);
        const resolve = (spec) => {
            try {
                const target = require.resolve(path.resolve(from, spec));
                return target === self ? null : target;
            } catch (e) {
                return null;
            }
        };

        const bound = /(?:const|let|var)\s+(\{[^}]*\}|[A-Za-z_$][\w$]*)\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\)/g;
        let m;
        while ((m = bound.exec(src))) {
            const target = resolve(m[2]);
            if (!target) continue;
            if (m[1].startsWith('{')) {
                // const { a, b: c } = require(...) — the exported name is the key
                for (const entry of m[1].slice(1, -1).split(',')) {
                    const key = entry.split(':')[0].trim();
                    if (key) reach(target, key);
                }
            } else {
                // const mod = require(...) — every mod.<name> that follows
                const reached = new RegExp('\\b' + m[1] + '\\.([A-Za-z_$][\\w$]*)', 'g');
                let d;
                while ((d = reached.exec(src))) reach(target, d[1]);
            }
        }

        const inline = /require\(\s*['"]([^'"]+)['"]\s*\)\.([A-Za-z_$][\w$]*)/g;
        while ((m = inline.exec(src))) {
            const target = resolve(m[1]);
            if (target) reach(target, m[2]);
        }

        if (/\bvm\.(?:runInNewContext|runInContext|runInThisContext|Script)\b/.test(src)) {
            const loaded = /readFileSync\(\s*path\.join\(\s*__dirname((?:\s*,\s*['"][^'"]+['"])+)\s*\)/g;
            while ((m = loaded.exec(src))) {
                const segments = [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map((s) => s[1]);
                const target = path.resolve(from, ...segments);
                if (target === self) continue;
                const member = /\.([A-Za-z_$][\w$]*)/g;
                let d;
                while ((d = member.exec(src))) reach(target, d[1]);
            }
        }
    }

    return index;
}
   ```

3. 在 `tests/source.test.js`，把測試 `every exported name is imported by something @slow` 整個換成：

   ```js
test('every exported name is imported by something', () => {
    const files = tracked();
    const body = new Map(files.map((rel) => [rel, fs.readFileSync(path.join(ROOT, rel), 'utf8')]));
    const index = importIndex(files, body);
    const orphans = [];

    for (const rel of files) {
        if (rel.startsWith('tests/')) continue;
        const names = exportedNames(body.get(rel));
        if (!names.length) continue;
        const used = index.get(path.resolve(ROOT, rel)) || new Set();
        for (const name of names) {
            if (!used.has(name)) orphans.push(rel + ' — ' + name);
        }
    }

    assert.deepEqual(orphans, [], 'exported, and imported by nothing');
});

// The vm reading, shown on its own: a name reached only through a sandbox's
// exports counts, a name the test never touches does not, and a vm-free file
// naming the same path reaches nothing.
test('a name reached only through a vm sandbox counts as imported', () => {
    const viaVm = "const vm = require('node:vm');\n"
        + "const box = { module: { exports: {} } };\n"
        + "vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'lib', 'only-vm.js'), 'utf8'), box);\n"
        + 'box.module.exports.onlyVm();\n';
    const noVm = "const s = fs.readFileSync(path.join(__dirname, '..', 'lib', 'plain-read.js'), 'utf8');\ns.length;\n";
    const body = new Map([['tests/x.test.js', viaVm], ['tests/y.test.js', noVm]]);
    const index = importIndex([...body.keys()], body);
    const vmTarget = index.get(path.resolve(ROOT, 'lib', 'only-vm.js'));
    assert.ok(vmTarget && vmTarget.has('onlyVm'), 'the sandbox export reached');
    assert.ok(!vmTarget.has('neverCalled'));
    assert.equal(index.get(path.resolve(ROOT, 'lib', 'plain-read.js')), undefined, 'reading a file is not loading it');
});
   ```

4. 跑 `node --test tests/source.test.js 2>&1 | grep -E 'every exported name|vm sandbox|^# (pass|fail)'`。fail 要是 0；`every exported name` 那行的毫秒數要在 3000 以下，超過就停下回報（Risks 第二條），把名字的 `@slow` 加回去。

5. 跑 `npm run test:fast 2>&1 | grep -E 'every exported name|^# (pass|fail)'`，確認它出現在快速測試且 fail 為 0。

6. Commit：`test: export-import check indexes once, reads vm loads, runs fast`。

## Task 4: session 頁 mockup 對齊已上線的關卡連結與派工小點

**Files:**
- Modify: `.fankeel/build/2026-10-21-station-redesign/route-session.html:182-405` — 第 182 行 `session-head-dispatch` 區塊的小點顏色、第 405 行關卡連結的標記
- Modify: `.fankeel/build/2026-10-21-station-redesign/_session-build.js:76-76` — 第 76 行同一個顏色變數，讓下次重產不退回灰階
- Read: `assets/station/session-page.js` — 第 153 行小點用 `--dx-<fam>`、第 174-175 行關卡連結只在 `s.gateAt` 時出現，不改
- Read: `assets/station/session-page.css` — 第 5-9 行 `--dx-*` 的值，不改

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — 三處字串替換，都在計畫裡。

`route-session.html`（02:11）比產生器（02:07）新，是產生後手改過的，關卡連結只在 html 裡；所以直接改 html，**不要重跑 `_session-build.js`**。

1. 先量現況：

   ```
   cd .fankeel/build/2026-10-21-station-redesign
   node -e "const t=require('fs').readFileSync('route-session.html','utf8');const i=t.indexOf('data-block=\"session-head-dispatch\"');const b=t.slice(i,t.indexOf('</button></div>',i));console.log((b.match(/var(--m-/g)||[]).length, (t.match(/data-block=\"session-gate-link\"/g)||[]).length)"
   ```

   應印出一個大於 0 的數與 `0`。

2. 在 `.fankeel/build/2026-10-21-station-redesign/route-session.html`，用這段腳本只改 `session-head-dispatch` 區塊裡的小點、並標記關卡連結：

   ```js
// .fankeel/build/2026-10-21-station-redesign/route-session.html, patched in place
const fs = require('fs');
const f = 'route-session.html';
let t = fs.readFileSync(f, 'utf8');
const i = t.indexOf('data-block="session-head-dispatch"');
const j = t.indexOf('</button></div>', i);
t = t.slice(0, i) + t.slice(i, j).replace(/var(--m-/g, 'var(--dx-') + t.slice(j);
t = t.replace('<a href="gate-land.html" class="out"',
  '<a href="gate-land.html" class="out" data-block="session-gate-link" title="只在有提問待答時出現；答完的提問看對話分頁"');
fs.writeFileSync(f, t);
   ```

   在 `route-session.html` 所在目錄以 `node -e` 或暫存檔跑它。

3. 在 `.fankeel/build/2026-10-21-station-redesign/_session-build.js` 第 76 行，把 `'<i style="--c:var(--m-' + a.model + ')"></i>'` 改成 `'<i style="--c:var(--dx-' + a.model + ')"></i>'`。只改這一行；第 145、147、153、154 行是派工分頁本身，維持 `--m-`。

4. 重跑步驟 1 的指令，要印 `0 1`。這個目錄不進版控，沒有 commit。

## Task 5: 使用者逐頁看剩下五頁

**Files:**
- Read: `.fankeel/build/2026-10-21-station-redesign/route-focus-plan.html` — 逐頁看
- Read: `.fankeel/build/2026-10-21-station-redesign/route-spend.html`
- Read: `.fankeel/build/2026-10-21-station-redesign/route-docs.html`
- Read: `.fankeel/build/2026-10-21-station-redesign/route-settings.html`
- Read: `.fankeel/build/2026-10-21-station-redesign/route-mobile.html`

**Interfaces:**
- Consumes: Task 4 改過的 `route-session.html`
- Produces: 每頁一個結論：定稿，或一條 `todo.js new` 的 Ready 條目寫下要改什麼

**Dispatch:** user — 定稿要使用者自己的眼睛；在瀏覽器窗格一頁一頁開給使用者看，沒有 subagent 能代替。

1. 對每一頁，在瀏覽器窗格開 `file:///F:/ymlab/fankeel/.fankeel/build/2026-10-21-station-redesign/<頁>.html`，問使用者「定稿」或「要改什麼」。
2. 定稿的頁寫一行 `task.js note`；要改的頁，照使用者原話開一條 Ready 條目（`todo.js new --label station --state ready ...`），不在這輪改實作。
3. 六頁都有結論後，`task.js note` 一行寫哪幾頁定稿、哪幾頁另開條目；land 結案「station 改版剩下的頁」時紀錄照抄這行，加上 plan 關卡上使用者對專案頁四項資料收或不收的決定。

## Closes at land

`stage land` 印出的 `todo.js done` 行加上手動的兩條，四條都先 `record.js write` 再帶 `--record` 結案：

- 「station 文件長句與過時測試名」— Task 1、Task 2 的 commit。
- 「station 改版剩下的頁」— Task 4 與 Task 5 的 note，以及專案頁四項的決定。
- 「source.test 認得 vm 載入」— Task 3 的 commit；不在 `--todo` 裡，手動跑 `todo.js done`。
- 「兩組循序派工實跑一次」— 不改碼，證據是 survey 報告 Watch 段那三個 task 的 build-g 編號；手動跑 `todo.js done`。

## Coverage

| promise | task |
|---|---|
| station-36 — 開 docs/01-guide/station.md:46（208 欄）與 :31（168 欄），`docs-check.js` 仍報兩句超過 160 欄 | Task 1（含 :24） |
| tests/pane.test.js:1416 的測試名仍寫 "list draws from that many" | Task 1 |
| 那次整套唯一一敗是 tests/station-serve.test.js 的「a joining serve() writes its own leads into roots.json」 | Task 2 |
| station-review-1 — .fankeel/build/2026-10-21-station-redesign/ 的 mockup 都還在；使用者原話要把剩下的走完 | Task 4、Task 5 |
| (1) 關卡連結只在有待答提問時出現；(2) 派工小點換成模型色 | Task 4（實作已在 `session-page.js:153`、`:174-175`） |
| (3) 五頁逐頁看 | Task 5 |
| (4) 專案頁「需新收資料」四項收或不收 | 在 plan 關卡問使用者，答案寫進 Task 5 的結案紀錄 |
| await-9 — 事件已發生，以 done 結案，證據寫進條目 | struck — 不改碼，land 以 `todo.js done` 結案，證據在 survey 報告 |
| test-15 — 把檢查移到快速測試並認 vm 載入 | Task 3 |
| station-35、stage-2 — needs the user | struck — 使用者在 survey 關卡選了維持原狀與下一輪另開任務 |
