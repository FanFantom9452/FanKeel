---
status: current
---

# Station docs and settings pages as modules Implementation Plan

**Goal:** the station's 文件 page (`#/docs`) and 設定 page (`#/settings`, `#/settings/detail[/<step>]`) become what the approved mockups draw — a docs-health matrix with a findings card, a markdown reader and a project dialog; a five-block 快速設定 with every answer pre-picked from the project's record and a ten-chapter 詳細設定 with an agents table — each a classic-script `FK_*` module, and the old docs card and seven-step wizard leave `assets/station/station.js`.
**Architecture:** three server tasks first: `scripts/docs-health.js` runs `docs-audit.js`'s `sweep` and `docs-check.js`'s `scan` per project (Task 1), `lib/settingsuggest.js` infers the quick-setup answers from `profile.suggest`, the registry and the tree (Task 2), and `scripts/station.js` serves both plus one tracked page, accepts `agent.<name>.*` keys on `POST /profile`, while `lib/station.js` hands the page a `profileSpec` (Task 3). Four new browser modules port the mockups — `FK_DOCS` (Task 4), `FK_SETTINGS` (Task 5), `FK_SETSTEPS` (Task 6), `FK_SETDETAIL` (Task 7). Then the shell loads them and the station reference describes them (Task 8), the two routes go to the modules and the old listeners come out (Task 9), and the old docs card, the wizard and their strings are deleted (Task 10). No dependency is added.
**Tech Stack:** Node `>=22.5` (`package.json` `engines.node`), CommonJS, Node built-ins only (`node:test`, `node:assert/strict`, `node:http`, `node:fs`, `node:vm`); browser scripts in `assets/station/` are hand-written ES5 classic scripts with CSS, no build.
**Spec:** [survey.md](../../.fankeel/build/task-20261024T005748/survey.md)

At the plan gate on 2026-10-24 the user chose to add these two pages to this patrol, as a plan built after the gate/talk plan (`docs/90-agent/plans/2026-10-24-station-gate-talk.md`), rather than leave them for a later one. The promises are three Ready entries:

- 文件頁待調整 (`docs/90-agent/todo/station-38.md`) — the live docs page matches the approved `route-docs.html`.
- 設定頁待調整 (`docs/90-agent/todo/station-39.md`) — the live settings page matches the approved `route-settings-quick.html` and `route-settings-v9.html`.
- station 留 vanilla、拆完模組 (`docs/90-agent/todo/station-52.md`) — closes only if its done condition holds, (b) `station.js` at about 1,500 lines among it. It does not hold after this plan: days, list and focus stay in `station.js`, which ends near 5,700 lines. station-52 stays Ready, and land rewrites its progress line to name that remainder.

Remote access stays 待定: the `station.remote` option is drawn and tagged 待定 (Tasks 5, 6), and no task builds a connection method (station-49, `## Needs a decision`).

## Global Constraints

- From `.fankeel/map.md` (`node scripts/map.js`): 1199 markdown files, 3 planned, not built, 360 retired, 57 undeclared. Plans live in `docs/90-agent/plans/` (role `plan`); references in `docs/90-agent/reference/` (role `reference`, must match the code).
- **The gate/talk plan builds first, and every line number here is from f406d539, before it.** It edits `assets/station/station.js` ≈`:1432-1800`, `:2815-2913` and `:5972-5976`, `assets/station/index.html` `:25` and `:35-36` (adds `<script src="station/talk-acts.js"></script>` after `session-talk.js`, no stylesheet), `lib/station.js:820-1027`, `scripts/station.js:600-627` and `docs/90-agent/reference/station.md:1275-1295`. Each task's first step greps its `    // ---- ` marker or function name to find the real span; where marker and number disagree, the marker wins.
- Browser scripts in `assets/station/` are ES5: `var` and `function`, no arrow functions, no `let`/`const`, no template literals (`assets/station/session-talk.js` has no `=>`). `lib/*.js`, `scripts/*.js` and `tests/*.js` are Node and may use `const` and arrows.
- 4-space indentation in `lib/`, `scripts/`, `assets/station/` and the `tests/station-*.test.js` files (`tests/init-skill.test.js` is 2-space); `'use strict';` is the first line of every `.js` file.
- Node built-ins only: `package.json` is `"private": true` with no `dependencies` key; no dependency, no new file under `hooks/` (`CONTRIBUTING.md:36`). `lib/` never requires `scripts/` (`CONTRIBUTING.md:15`), so the docs-health reader that calls `scripts/docs-audit.js` and `scripts/docs-check.js` is `scripts/docs-health.js` (`scripts/docs-audit.js` already requires `./docs-check.js`).
- A module is one IIFE over `(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null)` ending `var api = { … }; if (typeof module !== 'undefined' && module.exports) module.exports = api; if (w) w.FK_<NAME> = api;` (`assets/station/project-page.js:236-239`, `assets/station/sessions-page.js:446-448`). Nothing at load touches the DOM or adds a listener: a module binds its document listeners on its first `page()` call (`assets/station/project-page.js:230-231`, `bound = true; doc.addEventListener('click', onClick);`).
- Module i18n: each module keeps its own `EN` table and `loc(key, zh, vars)` = `kit().fillVars(I && I.lang === 'en' && has(EN, key) ? EN[key] : zh, vars)` (`assets/station/project-page.js:47-52`); `w.FK_KIT` carries `esc` and `fillVars`. `stringsLeft(name, EN)` (`tests/station-module.js:37-61`) must return `[]`: every CJK literal is the second argument of a `loc('<key>', '…'` on the same line, the key matches `[a-z]+\.[A-Za-z0-9]+` (no underscore), every key has English with no CJK, every EN key is used. `page(names, station, extra)` (`tests/station-module.js:19-35`) boots every `<script>` of `assets/station/index.html` in one vm, then any extra name.
- `station.js` itself: every CJK literal is a `loc('<prefix>.<key>', '<zh>'` whose prefix comes from the nearest `    // ---- <marker>` line above (`tests/station-i18n.test.js:23-27` `SECTIONS`, among them `'設定: the seven-step wizard'`), and every key in `assets/station/i18n.js` must be used — `tests/station-i18n.test.js:110` lists `<key> is in i18n.js and used nowhere`. So every `    // ---- ` marker line stays where it is, and a key is deleted in the same task as its last caller.
- The page: `draw()` (`assets/station/station.js:5262-5316`) replaces `#page` every 3 s through a `partsOf`/`changedParts` diff; `<details>` with an id, `data-key` or `data-block` keep their open state. `modOpts(extra)` (`:5156-5158`) is `{ names: NAMES, now, serve, redraw: draw, clear: clearControl }` plus `extra`; `PKEYS` is set at `:6069`; a project's colour is `'var(--p-' + min(index in PKEYS, 5) + ')'` (`:371-372`). `parseHash` (`:255-269`) sends `#/settings/<anything>` to `{ view: 'settings' }`, so a module reads `w.location.hash` itself. The poll skips the repaint on `settings` (`:6228-6237`).
- Pinned module lists: `tests/station-modules.test.js:18` `PAGES`, `:21-22` `GLOBAL`, `:56-58` `deepEqual` of `index.html`'s scripts and stylesheets; `tests/station-module-lists.test.js` holds `index.html`, `lib/station.js` `MODULES` and serve's `STATIC` equal, so a new module needs only its `<script>` and `<link>` lines.
- Server: `send`/`fail`/`noStore` at `scripts/station.js:463-468`; `/station/search` at `:572-577`; `POST /profile` at `:943-995`; `tests/station-doc.test.js:30-36` fails for any `url.pathname === '<route>'` in `scripts/station.js` that `docs/90-agent/reference/station.md` does not name.
- Plan size, from `lib/plantasks.js`: `READ_CAP` = 1500 lines across a task's `Modify:` ranges (`:353`); `FILE_CAP` = 3 `Modify:` entries a task (`:354`); `SHARED_CAP` = 3 (`:600`) — a file written (`Modify:` or `Test:`) by three or more tasks is a lint line. Over 1500 lines here, named by range: `assets/station/station.js` (6393), `docs/90-agent/reference/station.md` (1672). Writers in this plan: `assets/station/station.js` and `assets/station/i18n.js` Tasks 9 and 10; `assets/station/index.html` and `docs/90-agent/reference/station.md` Task 8 only.
- Tests: one file is `node --test --require ./tests/subprocess-timeout.js tests/<file>`; an implementer runs only its own test files; the parent runs `node scripts/suite.js --fast` before committing a group. A new test file is staged (`git add`) before `tests/source.test.js` can see it, and every exported name needs an importer (`tests/source.test.js:144`), so an export goes in the same task as the last test that imports it.
- Commits are `type(scope): subject`, types `chore|docs|feat|fix|merge|test`, ending `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `dispatch.floor` is `sonnet` (builtin; `.fankeel/profile.json` does not set it). The plan does not bump the version.
- The approved mockups are in `.fankeel/build/2026-10-21-station-redesign/` (`route-docs.html`, `route-settings-quick.html`, `route-settings-v9.html`), gitignored — on this machine only.

## Risks

- Line numbers move under the sibling plan — Tasks 3, 8, 9, 10 — the gate/talk plan inserts and deletes lines in `assets/station/station.js`, `assets/station/index.html`, `lib/station.js`, `scripts/station.js` and `docs/90-agent/reference/station.md` before this plan builds. Every task's first step greps its anchor (`grep -n "^    // ---- <marker>\|^    function <name>(" <file>`) and works from what it finds; a range that no longer holds what the task quotes is BLOCKED with the grep output, not guessed.
- Document listeners are found by marker strings — Tasks 4-7, 9 — `tests/station-hdl-b.test.js`, `-c`, `-g` and `-k` pick listeners by a literal they hold (`'.wz [data-go]'`, `'.wz .fbar .fsg'`, `'dsxTimer'`); after Task 8 every `tests/station-src.js` boot loads the four new modules first. A module that adds a listener at load would land in those lists — so Tasks 4-7 bind lazily on the first `page()`, and Task 9 moves the click marker to `'[data-fbtn]'` (held by exactly one click listener) and deletes the tests of the removed listeners.
- `tests/station-i18n.test.js:110` (`used nowhere`) fails the task that leaves a key without a caller — Tasks 9, 10 — Task 9 deletes `dash.docs` and `dash.noProjectDocsYet` with `docsPage`; Task 10 deletes the docs-card `shared.*` keys and every `wiz.*` key with the code that used them, by running the test and deleting exactly what it lists inside its range.
- Tests are deleted, not moved — Tasks 9, 10 — `tests/station-wizard.test.js` (246 lines), `tests/station-wizard-motion.test.js` (71), the `#dq` section of `tests/station-hdl-b.test.js`, the wizard and front-bar sections of `tests/station-hdl-c.test.js` and `tests/station-hdl-k.test.js`, the `docsSearchHtml` tests of `tests/station-docs-tour.test.js` and the `docsCardHtml` tests of `tests/station-view.test.js` assert behaviour this plan removes. What replaces them is each module's own test (Tasks 4-7) and the dead-code tests of Tasks 9 and 10; a deleted test that asserts something the new pages still promise is a gap the task's reviewer names.
- Tests read the old code from outside the deleted ranges — Task 10 — `tests/station-shell.test.js:166` requires `station.js` to emit `split`, `split-h`, `split-bar` and `split-leg`, which only `docSplitHtml` does; `tests/init-skill.test.js:51` reads `V.WIZ_STEPS`; `tests/source.test.js:144` fails an export with no importer. Task 10 edits all three in the same commit.
- A route nobody documented reddens the suite — Tasks 3, 8 — `tests/station-doc.test.js:30-36` fails from the moment Task 3 adds `/station/docs-health`, `/station/doc` and `/station/suggest` until Task 8 names them in `docs/90-agent/reference/station.md`. Decided: Task 3 adds one paragraph naming the three paths after the gather-memo paragraph (`station.md:1398-1412`, its step 8) and runs `tests/station-doc.test.js` at its own commit; Task 8's rewritten paragraphs name them again and leave Task 3's paragraph as it is.
- Modules load in every vm boot — Task 8 — once `index.html` lists them, `page()` and `tests/station-src.js` run the four modules in a context whose `document` has no `body`, no `querySelector` and no `fetch`; a module touching any of them at load throws in some fifty test files. Task 8's test loads each with the minimal stub of `tests/station-modules.test.js:46-47` first.
- The remote card moves — Tasks 7, 9 — `tests/station-remote-mount.test.js` is rewritten to find the card inside the detail page's remote step, `data-block="v9-away-remote"` (the mockup names non-quick steps `v9-<chapter>-<id>`), so Task 7 must emit exactly that block name and call `w.FK_REMOTE.html(serve)` there.
- The mockups and the extracted text are not in git — Tasks 4-7 — `.fankeel/build/` is gitignored and the v9 step dump lives under `C:\Users\user\AppData\Local\Temp`; an implementer on another machine has neither. The tasks that port them carry the texts they need or read them from these paths on this machine.
- station-52 (b) is not reached — Coverage — `station.js` loses about 710 lines (Tasks 9, 10) and ends near 5,700; days, list and focus stay. station-52 stays open with that remainder named.
- The pages are checked in vm, not in a browser — Tasks 4-9 — redraw-safe dialogs, the caret in the search box through a 3 s repaint and the 390 px agents table are left to verify's render reviewer against the approved mockups.
- 行號是姊妹計畫之前的 — Task 3 — docs/90-agent/plans/2026-10-24-station-gate-talk.md 先改 `scripts/station.js:600-627` 與 `lib/station.js:820-1027`，Task 3 第 1 步先 grep `'/station/search'`、`'/profile'`、`^function serialize(`、`profilePresets:` 找到真正位置；`Modify:` 的範圍若因此不再涵蓋錨點，以錨點為準並在回報裡寫出實際範圍。
- 第一次開文件頁會慢 — Task 1、3 — `health` 對每個專案跑一次 docs-audit `sweep` 加 docs-check `scan`，專案多時第一次 GET `/station/docs-health` 可能要數秒到十幾秒（沒有量過）；10 分鐘 memo 只省之後的請求。若 verify 量到超過伺服器的請求逾時，改成背景計算、先回上一份，屬於後續計畫。
- 作者預設那條測試假設暫存目錄不在任何 git repo 裡 — Task 2 — `profile.suggest` 在非 repo 直接回空的 `values`；暫存目錄若落在某個 repo 底下，git log 會讀到那個 repo 的歷史，`main`／`push` 會變成 `rec`。已在 f406d539 實跑確認：docs-check 對 README 死連結給 `tag: 'gone'`、`notify.gate` 解析成布林 `true`、`syncAgent` 寫出 `effort: high`；全部測試本身沒有跑過。
- The mockup is gitignored — Task 4 — `.fankeel/build/2026-10-21-station-redesign/route-docs.html` is on disk only in the main checkout (`F:/ymlab/fankeel`), not in a worktree; step 3's `sed` reads it by absolute path, and the module's strings, icons and tooltips are carried in this plan, so nothing else needs the file.
- Caret, popover and dialogs through the 3 s redraw are argued, not tested — Task 4 — the stub DOM in `tests/station-module.js` has no part diff and no top layer. The argument: `headHtml()` is a constant of the language, so `draw()` (`assets/station/station.js:5262-5316`) never replaces `docs-head` and the `#dq` caret and `#dq-pop` contents stay; the dialogs sit under `<body>`, outside `#page`. Verify's render reviewer types into the box across a redraw and opens both dialogs on the served page after Task 9 routes `#/docs` here.
- Two listeners hear the same keys and clicks until Task 9 — Task 4, Task 9 — the old docs page's `#dq` input listener (`assets/station/station.js:5121-5138`) also hears this module's `#dq` and would fetch a second time; nothing routes to FK_DOCS before Task 9 deletes that listener, so it never happens in a build. The shell's `/` key (`:5969`) focuses the mast's `#q` first and this module's listener, bound later, moves focus to `#dq`; backdrop clicks close the dialogs through the shell's `.tdlg` listener (`:3074-3082`), the close buttons through this module's `data-dk-close`.
- The data shape is Task 1's — Task 1, Task 4 — the fixture in `tests/station-docs-page.test.js` is written from Task 1's item fields (`docAge`, `declared`, `target`, `sub`; `age`, `named`; `target` on a dead index row; `dir`, `total`, `named`, `missing` as one string; `tag`, `note`); `noteOf()` reads exactly those. If Task 1's implementer renames a field, both tests stay green and the page prints `undefined`: the Task 4 reviewer checks `noteOf()` against the docs-health script as landed.
- `/station/suggest` 的 `v` 變數名以 Task 2 `suggestFor` 為準 — Task 2、Task 5 — main `local`/`pr`、push `unpushed`、sessions `n`/`share`/`peak`、inflight `now`、ctx `from`（加 `n`）、lang `lang` 或 `from`、gates `cls`、floor `floor`、screen `mockup`、where `from` 或 `wait`；Task 5 的 tip 只用這些名字，`tests/station-settings-quick.test.js` 的 `SHAPES` 照 Task 2 的形狀逐題比對，名字不合就紅。一題有兩種形狀時 tip 填其中一種，另一種由 `srcHtml()` 退成「紀錄：k v · …」原樣列出。
- 這頁的版面靠 mockup 第 23-264 行的 v9 共用規則，它們在 Task 7 的 `settings-detail.css`；Task 7 或 Task 8 沒落地前，`#/settings` 會是沒有樣式的 HTML。測試只驗字串，真瀏覽器的樣子留給 verify 的 render reviewer 對 `route-settings-quick.html` 拍。
- 焦點與游標：`onInput` 不重繪（重繪會把游標拿走），所以打字時側欄摘要與「寫入 N 項」要到下一次點擊才更新；`go()` 之後用 `setTimeout` 聚焦 `#qkb-<組>`。這兩點 vm 測試測不到，只有真瀏覽器看得出來。
- `NAME` 同時是函式和物件（載入時把各鍵的名字複製到函式上），依賴 i18n.js 在這個模組之前載入、且切語言會重載頁面（`assets/station/i18n.js` 的 `set()` 之後 `location.reload()`）；Task 8 若把 settings-page.js 排到 i18n.js 前面，`NAME[k]` 會是中文。
- 寫入後的值靠模組內 `over` 疊在 S 上，直到 S 的下一次讀數相同才拿掉；`commit.format` 被 `profile.parseValue` 去掉尾端空白，S 永遠不會等於寫入值，疊加會一直留著（顯示的仍是剛寫的格式，無害）。
- Task 5 的共用匯出形狀是約定不是事實 — Task 7 — `questions()` 的欄位（選項 `t`/`e`/`s`）、`cur()` 怎麼把布林與陣列變字串、`post(S, o, rows, done)` 的 `o = { scope, project }`、`rows = [{ k, to }]`、`done(ok)` 都照 Task 5 的 Produces 行；`write()` 把 `rows()` 依 scope 分組、每組呼叫一次 `post`，測試的替身照同一個契約檢查 `o` 與 `rows`；其餘不同時 Task 7 第 5 步改 `settings-detail.js` 配合。測試的 fixture 假設 `cur()` 讀 `S.profiles.projects[dir].values`（`lib/station.js:841-852` 的形狀）。
- mockup 不在 worktree 裡 — Task 6、7 — `.fankeel/build/` 被 gitignore；Task 7 第 4 步用主 checkout 的絕對路徑，Task 6 的資料已寫在計畫裡不需要讀檔。
- 390px 的修正只在 stub DOM 裡驗過字串 — Task 6 — `settings-steps.css` 比 `settings-detail.css` 先載入，`.v9-at select{width:calc(100% - 12px)}` 同權重會蓋回寬度，但 `table.v9-at select{width:100%}` 更具體所以寬度仍是 100%，`min-width:0` 沒有別的規則蓋；select 文字在 390px 是否真的不再截斷要 verify 的 render reviewer 在 `#/settings/detail/agents` 拍 390px 才知道。
- mockup 有兩種證據行沒畫 — Task 7 — `git：本機 merge 41 次 · PR 0 個` 這類計數與 `.fankeel/sensitive.txt 還沒建立` 的提示，`/station/suggest` 的形狀（Task 2）不帶計數、`S` 也沒有 sensitive.txt 旗標；不畫而不是編造。前端偵測在 `/station/suggest` 回答前當成有前端（`screen` 與 `skill` 會問）。
- agents 表的列來自 `profileSpec.agents`（Task 3）— Task 7 — 在 Task 3 之前或 serve 沒跑時表是空的；`agent.*` 的寫入要 Task 3 讓 POST `/profile` 接受並跑 `agentfile.syncAgent`。
- `notify.*` 展開成 `notify.gate`／`notify.stage`／`notify.end` 的 `true`/`false`，只送和現值不同的鍵（現值空視同 `false`）；打開任一個時 `scripts/station.js:985-989` 會自動產生 topic，這是想要的。

## Task 1: 文件健康資料與頁面閱讀器

**Files:**
- Modify: `scripts/docs-health.js` — 新檔：`health`、`readDoc`、`cached`
- Test: `tests/station-docs-health.test.js`
- Read: `scripts/docs-audit.js` — `sweep(root, since, now)` 在 `:467`，回傳 `:829-834`；index 的 `dead`／`missing` 在 `:683-705`；`DEFAULT_SINCE` 與 `sweep` 由 `:1047` export
- Read: `scripts/docs-check.js` — `scan(root, roles)` 在 `:434`，回傳 `{findings[{role,file,line,tag,what}], unfiled, markdown}` 在 `:514-519`；死連結是 `tag: 'gone'`（`:299`）
- Read: `lib/tracked.js` — `trackedFiles(root)` 在 `:375`，回傳 `{ files }` 或 null
- Read: `lib/docs.js` — `PRESETS.flat`（index `docs/README.md`）與 `write(root, tree)`
- Read: `tests/docs-audit.test.js` — `:30-49` 依 mtime 造樹的 fixture、`:89-99` drift 的例子（gap 57）
- Read: `tests/tmp.js` — 暫存目錄

**Interfaces:**
- Consumes: none
- Produces: `health(dirs, now)` → `{ at, projects: [{ pkey, name, dir, files, index, noTree, last, cells: { drift, landed, index, diagram, broken, unfiled } }] }`，每格是 `{ n, items }`（items 最多 50）或 null；`readDoc(dirs, pkey, rel)` → string 或 null；`cached(dirs, now, fresh)` → 同 `health` 的物件，10 分鐘內同一組 `dirs` 回同一份；`dirs` 是 lib/docsearch.js `searchDirs` 的 `[{ dir, pkey, name }]`

**Dispatch:** implementer, sonnet — 程式碼與測試都在計畫裡；轉寫加測試。

1. 先確認兩支被讀的腳本的形狀沒變：`grep -n "^function sweep\|^module.exports\|const index = {" scripts/docs-audit.js` 與 `grep -n "^function scan\|tag: 'gone'\|^module.exports" scripts/docs-check.js`。export 少了 `sweep`、`DEFAULT_SINCE` 或 `scan`，回 BLOCKED 附那幾行。

2. 寫失敗的測試。在 `tests/station-docs-health.test.js`：

```js
'use strict';
// station-38: the 文件 page's health matrix and its reader, read off
// scripts/docs-audit.js's sweep and scripts/docs-check.js's scan. Dates come
// from mtime (no git here), as tests/docs-audit.test.js does.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const docs = require('../lib/docs.js');
const health = require('../scripts/docs-health.js');
const tmp = require('./tmp.js');

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 7, 21, 12, 0, 0);

function tree(files) {
    const root = tmp('fankeel-docs-health-');
    for (const [rel, spec] of Object.entries(files)) {
        const full = path.join(root, ...rel.split('/'));
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, spec.body);
        const at = (NOW - spec.age * DAY) / 1000;
        fs.utimesSync(full, at, at);
    }
    docs.write(root, docs.PRESETS.flat);
    return root;
}

const ROOT = tree({
    'docs/README.md': { body: '# docs\n\n- [architecture](01-architecture.md)\n- [old](gone.md)\n', age: 60 },
    'docs/01-architecture.md': { body: 'the badge is written by `lib/badge.js`\n', age: 60 },
    'docs/02-other.md': { body: '# other\n', age: 60 },
    'lib/badge.js': { body: 'x\n', age: 3 },
});
const DIRS = [{ pkey: 'p', name: 'proj', dir: ROOT }];

test('a project reads as six cells: drift, index and broken here, the rest null', () => {
    const out = health.health(DIRS, NOW);
    assert.equal(out.at, new Date(NOW).toISOString());
    assert.equal(out.projects.length, 1);
    const p = out.projects[0];
    assert.equal(p.pkey, 'p');
    assert.equal(p.name, 'proj');
    assert.equal(p.index, 'docs/README.md');
    assert.equal(p.noTree, false, 'docs.json declares the flat tree');
    assert.ok(p.files >= 3, 'markdown count from the sweep');
    assert.equal(typeof p.last, 'string');
    assert.deepEqual(Object.keys(p.cells).sort(), ['broken', 'diagram', 'drift', 'index', 'landed', 'unfiled']);
    assert.equal(p.cells.drift.n, 1);
    const d = p.cells.drift.items[0];
    assert.deepEqual({ path: d.path, target: d.target, gap: d.gap }, { path: 'docs/01-architecture.md', target: 'lib/badge.js', gap: 57 });
    assert.ok(p.cells.index.items.some((i) => i.path === 'docs/02-other.md' && i.target === undefined), 'a page the index never links');
    assert.ok(p.cells.index.items.some((i) => i.path === 'docs/README.md' && /gone\.md/.test(i.target)), 'a dead link in the index');
    assert.ok(p.cells.broken.items.some((i) => i.tag === 'gone' && i.path.startsWith('docs/README.md:')), 'docs-check findings carry file:line');
    assert.equal(p.cells.landed, null);
    assert.equal(p.cells.diagram, null);
});

test('a cell lists at most 50 items and still counts them all', () => {
    let body = '# many\n\n';
    for (let i = 0; i < 60; i++) body += '- [x' + i + '](n' + i + '.md)\n';
    const root = tree({ 'docs/README.md': { body: '# docs\n\n- [many](many.md)\n', age: 5 }, 'docs/many.md': { body, age: 5 } });
    const p = health.health([{ pkey: 'm', name: 'many', dir: root }], NOW).projects[0];
    assert.ok(p.cells.broken.n >= 60);
    assert.equal(p.cells.broken.items.length, 50);
});

test('readDoc answers a tracked markdown page and nothing else', () => {
    assert.equal(health.readDoc(DIRS, 'p', 'docs/02-other.md'), '# other\n');
    for (const bad of ['../x.md', 'docs/../docs/02-other.md', 'lib/badge.js', 'docs/none.md', 'docs\\02-other.md', '/docs/02-other.md', '']) {
        assert.equal(health.readDoc(DIRS, 'p', bad), null, bad);
    }
    assert.equal(health.readDoc(DIRS, 'nobody', 'docs/02-other.md'), null, 'an unknown pkey');
});

test('cached answers the same object inside ten minutes, and fresh reads again', () => {
    const a = health.cached(DIRS, NOW, false);
    assert.equal(health.cached(DIRS, NOW + 60e3, false), a);
    const b = health.cached(DIRS, NOW + 120e3, true);
    assert.notEqual(b, a);
    assert.equal(b.at, new Date(NOW + 120e3).toISOString());
    assert.notEqual(health.cached(DIRS, NOW + 120e3 + 600001, false), b, 'past ten minutes it reads again');
});
```

3. 跑 `node --test --require ./tests/subprocess-timeout.js tests/station-docs-health.test.js`，看它因 `Cannot find module '../scripts/docs-health.js'` 失敗。

4. 寫實作。在 `scripts/docs-health.js`：

```js
'use strict';
// scripts/docs-health.js — the 文件 page's health matrix and its reader
// (station-38). One row per project the station knows (lib/docsearch.js
// searchDirs), six cells read off scripts/docs-audit.js's sweep and
// scripts/docs-check.js's scan; scripts/station.js serves both. Here rather
// than in lib/ because lib/ never requires scripts/ (CONTRIBUTING.md).
const fs = require('node:fs');
const path = require('node:path');
const audit = require('./docs-audit.js');
const check = require('./docs-check.js');
const { trackedFiles } = require('../lib/tracked.js');

const TTL_MS = 600000;          // a sweep per project is seconds; the page asks every visit
const MAX_ITEMS = 50;           // the findings card lists this many and says how many more
const MAX_BYTES = 512 * 1024;   // the reader shows a page, not a dump

function cell(items, n) {
    const count = n === undefined ? items.length : n;
    return count ? { n: count, items: items.slice(0, MAX_ITEMS) } : null;
}

// The newest markdown page's mtime, for the row's `N 份 · last`.
function newest(dir, files) {
    let at = 0;
    for (const rel of files) {
        if (!/\.md$/i.test(rel)) continue;
        try {
            at = Math.max(at, fs.statSync(path.join(dir, ...rel.split('/'))).mtimeMs);
        } catch (e) {
            // listed a moment ago, gone now
        }
    }
    return at ? new Date(at).toISOString() : null;
}

function one(d, now) {
    const a = audit.sweep(d.dir, audit.DEFAULT_SINCE, now);
    const c = check.scan(d.dir);
    if (!a || !c) return null;
    const listed = trackedFiles(d.dir);
    const index = a.index || { path: null, dead: [], missing: [], navigation: false };
    // An index that is navigation rather than a manifest is not expected to
    // list every page (docs-audit's own rule), so its missing pages are not counted.
    const indexItems = index.dead.map((target) => ({ path: index.path, target }))
        .concat(index.navigation ? [] : index.missing.map((rel) => ({ path: rel })));
    return {
        pkey: d.pkey, name: d.name, dir: d.dir,
        files: a.markdown,
        index: index.path || null,
        noTree: !a.tree || Boolean(a.implied),
        last: newest(d.dir, listed ? listed.files : []),
        cells: {
            drift: cell(a.drift.map((x) => ({ path: x.file, target: x.target, gap: x.gap, docAge: x.docAge, declared: x.declared, sub: (x.subjects || [])[0] || null }))),
            landed: cell(a.landed.map((x) => ({ path: x.file, age: x.age, named: x.named }))),
            index: cell(indexItems),
            diagram: cell(a.diagrams.map((x) => ({ path: x.file + ':' + x.line, dir: x.dir, named: x.named, total: x.total, missing: x.missing.join(', ') }))),
            broken: cell(c.findings.map((f) => ({ path: f.file + ':' + f.line, tag: f.tag, note: f.what }))),
            unfiled: cell((c.unfiled || []).map((rel) => ({ path: rel })), a.unfiled),
        },
    };
}

function health(dirs, now) {
    const projects = [];
    for (const d of dirs) {
        let row = null;
        try {
            row = one(d, now);
        } catch (e) {
            row = null;   // one unreadable project does not blank the page
        }
        if (row) projects.push(row);
    }
    return { at: new Date(now).toISOString(), projects };
}

// The reader's text: a tracked markdown page of a project on this page, by a
// posix path relative to it — never `..`, never a path the tracked list lacks.
function readDoc(dirs, pkey, rel) {
    const d = dirs.find((x) => x.pkey === pkey);
    rel = String(rel || '');
    if (!d || !/\.md$/i.test(rel) || rel.includes('\\') || rel.startsWith('/') || rel.split('/').includes('..')) return null;
    const listed = trackedFiles(d.dir);
    if (!listed || !listed.files.includes(rel)) return null;
    const full = path.join(d.dir, ...rel.split('/'));
    try {
        if (fs.statSync(full).size > MAX_BYTES) return null;
        return fs.readFileSync(full, 'utf8');
    } catch (e) {
        return null;
    }
}

let memo = null;
function cached(dirs, now, fresh) {
    const key = JSON.stringify(dirs.map((d) => d.pkey + '\0' + d.dir));
    if (!fresh && memo && memo.key === key && now - memo.at < TTL_MS) return memo.value;
    memo = { key, at: now, value: health(dirs, now) };
    return memo.value;
}

module.exports = { health, readDoc, cached };
```

5. 跑 `node --test --require ./tests/subprocess-timeout.js tests/station-docs-health.test.js`，四個測試全過。`docs/README.md:` 的 `gone` 那條若沒過，先 `node scripts/docs-check.js --root <暫存目錄>` 看 docs-check 對那個連結給的 tag，把斷言改成它給的 tag（不改 docs-check）。

6. Commit：`git add scripts/docs-health.js tests/station-docs-health.test.js` 然後 `git commit -m "feat(station): docs health matrix and page reader for the 文件 page"`。

## Task 2: 快速設定的推薦

**Files:**
- Modify: `lib/settingsuggest.js` — 新檔：`suggestFor`
- Test: `tests/settings-suggest.test.js`
- Read: `lib/profile.js` — `suggest(projectRoot, registryRoot)` 在 `:494-571`（`values` 與 `evidence` 行的字樣）、`read(dir, configDir)` 在 `:436-466`（`sources` 為 `project`／`machine`／`builtin`）、`write`、`projectFile`、`machineFile`、`KEYS`
- Read: `lib/registry.js` — `readAll(root)` 在 `:169`（`entries[].data` 的 `started`、`updated`、`ended.at`、`profile` 快照）、`projectOf` 在 `:788`、`writeSession` 在 `:292`
- Read: `lib/tracked.js` — `trackedFiles`、`posix`
- Read: `lib/stages.js` — `FULL_ROUTE`（`stage.agents` 解析成站名陣列，`all` 等於它全長）
- Read: `tests/profile-worktree.test.js` — `:36-42` 造 git log 的寫法
- Read: `tests/tmp.js`

**Interfaces:**
- Consumes: none
- Produces: `suggestFor(projectDir, registryRoot, configDir, now)` → `{ front: boolean, recs: { main, push, sessions, inflight, ctx, lang, gates, floor, screen, where }, commitFormat: string|null }`，每個 rec 是 `{ o: string, src: 'rec'|'author', v: object }`；`o` 是快速設定那題選項的 value（main: direct|merge|pr|keep；push: true|false|ask；sessions: one|some|many；inflight: 4|6|8|12；ctx: none|rw|all；lang: zh|en|other；gates: survey|bounded|arch；floor: haiku|sonnet|opus；screen: false|opus|auto；where: term|station|away）

**Dispatch:** implementer, sonnet — 程式碼與測試都在計畫裡；轉寫加測試。

1. 先確認推薦依賴的字樣沒變：`grep -n "^function suggest\|evidence.push\|values\['" lib/profile.js` 與 `grep -n "^function readAll\|^function projectOf\|^function writeSession" lib/registry.js`。`evidence.push('merges: '` 或 `values['commit.format']` 不在了，回 BLOCKED 附那幾行。

2. 寫失敗的測試。在 `tests/settings-suggest.test.js`：

```js
'use strict';
// station-39: the 快速設定 page's preselected answers. Each question carries
// `rec` when this project's git log, registry or profile says something and
// `author` when nothing does; these pin both sides of every inference the
// TODO entry named (sessions overlap, stage.agents, notify, front end, model.lang).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const registry = require('../lib/registry.js');
const profile = require('../lib/profile.js');
const { suggestFor } = require('../lib/settingsuggest.js');
const tmp = require('./tmp.js');

const NOW = Date.now();
const HOUR = 3600e3;
const id = (i) => 'cccccccc-0000-4000-8000-00000000000' + i;
const at = (ms) => new Date(ms).toISOString();

function place() {
    const base = tmp('fankeel-suggest-');
    const dir = path.join(base, 'proj');
    const cfg = path.join(base, 'cfg');
    fs.mkdirSync(dir, { recursive: true });
    fs.mkdirSync(cfg, { recursive: true });
    return { dir, cfg };
}
const flat = (recs) => Object.fromEntries(Object.entries(recs).map(([k, r]) => [k, r.o + '/' + r.src]));

test('with no record every question carries the author default', () => {
    const { dir, cfg } = place();
    const out = suggestFor(dir, dir, cfg, NOW);
    assert.equal(out.front, false);
    assert.equal(out.commitFormat, null);
    assert.deepEqual(flat(out.recs), {
        main: 'merge/author', push: 'false/author', sessions: 'some/author', inflight: '8/author', ctx: 'rw/author',
        lang: 'en/author', gates: 'survey/author', floor: 'sonnet/author', screen: 'false/author', where: 'term/author',
    });
});

test('five sessions open at once read as many, five in a row as one', () => {
    const { dir, cfg } = place();
    for (let i = 0; i < 5; i++) {
        registry.writeSession(dir, id(i), { task: 't' + i, stage: 'build', active: false, claims: [],
            started: at(NOW - 10 * HOUR + i * 60e3), updated: at(NOW - 8 * HOUR) });
    }
    const many = suggestFor(dir, dir, cfg, NOW).recs.sessions;
    assert.deepEqual({ o: many.o, src: many.src, peak: many.v.peak, n: many.v.n }, { o: 'many', src: 'rec', peak: 5, n: 5 });

    const other = place();
    for (let i = 0; i < 5; i++) {
        registry.writeSession(other.dir, id(i), { task: 't' + i, stage: 'build', active: false, claims: [],
            started: at(NOW - (20 - 2 * i) * HOUR), updated: at(NOW - (19 - 2 * i) * HOUR) });
    }
    const one = suggestFor(other.dir, other.dir, other.cfg, NOW).recs.sessions;
    assert.deepEqual({ o: one.o, src: one.src, peak: one.v.peak }, { o: 'one', src: 'rec', peak: 1 });
});

test('a front end, the project profile and the machine file move their answers to the record', () => {
    const { dir, cfg } = place();
    fs.writeFileSync(path.join(dir, 'index.html'), '<p>x</p>\n');
    const pf = profile.projectFile(dir);
    for (const [k, v] of [['dispatch.floor', 'haiku'], ['model.lang', '繁體中文'], ['stage.agents', 'all'], ['design.mockup', 'auto'], ['dispatch.inflight', '6']]) {
        assert.ok(profile.write(pf, k, v).ok, k);
    }
    assert.ok(profile.write(profile.machineFile(cfg), 'notify.gate', 'true').ok);
    const out = suggestFor(dir, dir, cfg, NOW);
    assert.equal(out.front, true);
    const got = flat(out.recs);
    for (const [k, want] of Object.entries({ floor: 'haiku/rec', lang: 'zh/rec', ctx: 'all/rec', screen: 'auto/rec', inflight: '6/rec', where: 'away/rec' })) {
        assert.equal(got[k], want, k);
    }
});

test('a front end with no mockup setting preselects 有，每次先問我 from the author', () => {
    const { dir, cfg } = place();
    fs.writeFileSync(path.join(dir, 'app.css'), 'p{}\n');
    const out = suggestFor(dir, dir, cfg, NOW);
    assert.equal(out.front, true);
    assert.equal(flat(out.recs).screen, 'opus/author');
});

test('the commit format offered adds merge to the types the log used; no remote means no push', () => {
    const { dir, cfg } = place();
    const g = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'ignore' });
    g('init', '-q');
    for (const s of ['feat(a): one', 'fix(b): two', 'feat(c): three', 'docs: four', 'fix: five']) {
        g('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', s);
    }
    const out = suggestFor(dir, dir, cfg, NOW);
    assert.equal(out.commitFormat, '^(docs|feat|fix|merge)(\\([^)]+\\))?: ');
    assert.equal(flat(out.recs).push, 'false/rec');
    assert.equal(out.recs.push.v.unpushed, 5);
});
```

3. 跑 `node --test --require ./tests/subprocess-timeout.js tests/settings-suggest.test.js`，看它因 `Cannot find module '../lib/settingsuggest.js'` 失敗。

4. 寫實作。在 `lib/settingsuggest.js`：

```js
'use strict';
// lib/settingsuggest.js — the 快速設定 page's preselected answers (station-39).
// Every one of the ten questions gets an option value `o` and where it came
// from: `rec` (依你的紀錄) when this project's git log, its registry or a
// profile file already says something, `author` (作者推薦) when nothing does.
// `v` carries the figures the page may quote. Reads only; writes nothing.
const fs = require('node:fs');
const path = require('node:path');
const profile = require('./profile.js');
const registry = require('./registry.js');
const { trackedFiles, posix } = require('./tracked.js');
const { FULL_ROUTE } = require('./stages.js');

const DAY = 24 * 3600e3;
const WINDOW_MS = 90 * DAY;            // sessions older than this say little about today's habit
const FRONT = /\.(html|css|vue|svelte|jsx|tsx)$/i;
const AUTHOR = { main: 'merge', push: 'false', sessions: 'some', inflight: '8', ctx: 'rw', lang: 'en', gates: 'survey', floor: 'sonnet', screen: 'opus', where: 'term' };
const GATES = { bounded: 'bounded', architectural: 'arch' };

const rec = (o, v) => ({ o: String(o), src: 'rec', v: v || {} });
const author = (q) => ({ o: AUTHOR[q], src: 'author', v: {} });
const isSet = (prof, key) => Boolean(prof.sources[key]) && prof.sources[key] !== 'builtin';

// Peak number of sessions open at once, and the share of the time any was
// open that two or more were. A session that ends as another starts does not overlap it.
function overlap(spans) {
    const ev = [];
    for (const [a, b] of spans) ev.push([a, 1], [b, -1]);
    ev.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    let open = 0;
    let peak = 0;
    let busy = 0;
    let crowded = 0;
    let last = null;
    for (const [t, d] of ev) {
        if (last !== null && open >= 1) busy += t - last;
        if (last !== null && open >= 2) crowded += t - last;
        open += d;
        last = t;
        peak = Math.max(peak, open);
    }
    return { peak, share: busy ? crowded / busy : 0 };
}

function spansOf(entries, now) {
    const out = [];
    for (const e of entries) {
        const a = Date.parse(e.data.started);
        const b = Date.parse((e.data.ended && e.data.ended.at) || e.data.updated);
        if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a || b < now - WINDOW_MS) continue;
        out.push([a, b]);
    }
    return out;
}

// stage.agents as parsed: an array of stage names.
function ctxOf(list) {
    if (!Array.isArray(list) || !list.length) return 'none';
    return list.length >= FULL_ROUTE.length ? 'all' : 'rw';
}

function mostOf(words) {
    const tally = {};
    for (const w of words) tally[w] = (tally[w] || 0) + 1;
    return Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0];
}

// profile.suggest offers only the types the log used (the 2026-10-02 plan
// gate); the page offers them with `merge` added, or scripts/land.js's own
// merge subject would fail the pattern.
function withMerge(candidate) {
    const m = /^\^\(([^)]*)\)/.exec(String(candidate || ''));
    if (!m) return null;
    const types = [...new Set(m[1].split('|').concat('merge'))].sort();
    return '^(' + types.join('|') + ')' + candidate.slice(m[0].length);
}

function suggestFor(projectDir, registryRoot, configDir, now) {
    const s = profile.suggest(projectDir, registryRoot);
    const merged = profile.read(projectDir, configDir);
    const machine = profile.read(null, configDir).values;
    const ev = s.evidence.join('\n');
    const num = (re) => {
        const m = re.exec(ev);
        return m ? Number(m[1]) : null;
    };
    const rel = registryRoot ? posix(path.relative(registryRoot, projectDir)) : '';
    const entries = registryRoot ? registry.readAll(registryRoot).entries.filter((e) => registry.projectOf(e.data) === rel) : [];
    const listed = trackedFiles(projectDir);
    const front = fs.existsSync(path.join(projectDir, '.fankeel', 'render.json')) || Boolean(listed && listed.files.some((f) => FRONT.test(f)));
    const recs = {};

    const integ = s.values['land.integration'];
    recs.main = integ ? rec(integ, { local: num(/merges: (\d+) local/), pr: num(/, (\d+) pull request/) }) : author('main');

    const push = s.values['land.push'];
    recs.push = push === undefined ? author('push') : rec(push, { unpushed: num(/; (\d+) commits on no remote/) });

    const spans = spansOf(entries, now);
    if (spans.length >= 5) {
        const o = overlap(spans);
        const word = o.share >= 0.5 || o.peak >= 4 ? 'many' : o.peak >= 2 ? 'some' : 'one';
        recs.sessions = rec(word, { peak: o.peak, share: Math.round(o.share * 100), n: spans.length });
    } else {
        recs.sessions = author('sessions');
    }

    if (isSet(merged, 'dispatch.inflight')) {
        const n = Number(merged.values['dispatch.inflight']);
        const near = [4, 6, 8, 12].reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a));
        recs.inflight = rec(near, { now: n });
    } else {
        recs.inflight = author('inflight');
    }

    // The profile snapshot task.js writes on each record holds stage.agents
    // only when somebody set it, so three snapshots are three choices.
    const snaps = entries.map((e) => e.data.profile && e.data.profile['stage.agents']).filter(Array.isArray);
    if (isSet(merged, 'stage.agents')) recs.ctx = rec(ctxOf(merged.values['stage.agents']), { from: 'profile' });
    else if (snaps.length >= 3) recs.ctx = rec(mostOf(snaps.map(ctxOf)), { from: 'tasks', n: snaps.length });
    else recs.ctx = author('ctx');

    const lang = merged.values['model.lang'];
    if (lang) recs.lang = rec(/中|zh|chinese/i.test(lang) ? 'zh' : /^(en|english)$/i.test(lang) ? 'en' : 'other', { lang });
    else if (machine['ui.lang'] === 'zh') recs.lang = rec('zh', { from: 'ui.lang' });
    else recs.lang = author('lang');

    const cls = s.values['class.default'] || (isSet(merged, 'class.default') ? merged.values['class.default'] : null);
    recs.gates = GATES[cls] ? rec(GATES[cls], { cls }) : author('gates');

    const floor = merged.values['dispatch.floor'];
    recs.floor = isSet(merged, 'dispatch.floor') ? rec(floor === 'haiku' || floor === 'sonnet' ? floor : 'opus', { floor }) : author('floor');

    const mock = merged.values['design.mockup'];
    if (isSet(merged, 'design.mockup')) recs.screen = rec(mock === false || mock === 'false' ? 'false' : mock === 'auto' ? 'auto' : 'opus', { mockup: String(mock) });
    else recs.screen = front ? author('screen') : { o: 'false', src: 'author', v: {} };

    const wait = String(merged.values['gate.station']);
    if (machine['notify.gate'] === true) recs.where = rec('away', { from: 'notify.gate' });
    else if (isSet(merged, 'gate.station') && !/^(off|false|0)$/.test(wait)) recs.where = rec('station', { wait });
    else if (isSet(merged, 'gate.away') && merged.values['gate.away'] === 'hint') recs.where = rec('term', { from: 'gate.away' });
    else recs.where = author('where');

    return { front, recs, commitFormat: withMerge(s.values['commit.format']) };
}

module.exports = { suggestFor };
```

5. 跑 `node --test --require ./tests/subprocess-timeout.js tests/settings-suggest.test.js`，五個測試全過。`notify.gate` 那條若因 `machine['notify.gate']` 不是布林 `true` 而失敗，先 `node -e "console.log(require('./lib/profile.js').parseValue('notify.gate','true'))"` 看解析值，把比較改成它的值。

6. Commit：`git add lib/settingsuggest.js tests/settings-suggest.test.js` 然後 `git commit -m "feat(profile): quick-setup recommendations from the project's record"`。

## Task 3: 供應兩頁的資料

**Files:**
- Modify: `scripts/station.js:560-1000` — 新增 GET `/station/docs-health`、`/station/doc`、`/station/suggest`；POST `/profile` 接受 `agent.<name>.model|effort` 並同步 agent 檔
- Modify: `lib/station.js:815-860` — `serialize` 前新增 `profileSpec(model)`，`profilePresets:` 之後帶出 `profileSpec`
- Modify: `docs/90-agent/reference/station.md:1398-1412` — `node bench/station-gather.js` 那段之後加一段，點名三條新 GET，`tests/station-doc.test.js:30-36` 才不會紅
- Test: `tests/station-serve-docs-settings.test.js`
- Read: `tests/station-post.test.js` — `:22-62` fixture 與 `request`、`:227-245` 抓 nonce 與 POST 表單的寫法
- Read: `lib/agentfile.js` — `agentKey`、`agentNames`、`syncAgent`、`EFFORTS`、`PLUGIN_ROOT`（`:15-82`、export 在 `:119`）
- Read: `scripts/task.js` — `:1253-1260` `profile set` 對 agent key 跑 `syncAgent` 的寫法
- Read: `lib/docsearch.js` — `searchDirs(model)` 在 `:22-45`
- Read: `lib/profile.js` — `KEYS`、`PRESETS`、`projectFile`、`machineFile`、`parseValue`（agent key 的值由 `:372` 驗）
- Read: `lib/json.js` — `readObject`
- Read: `agents/fankeel-reader.md` — frontmatter `model: sonnet`、`effort: medium`，測試用它
- Read: `tests/station.test.js` — `:155-168` 釘住 `profileKeys`，第 7 步跟著跑

**Interfaces:**
- Consumes: `cached(dirs, now, fresh)` 與 `readDoc(dirs, pkey, rel)`（Task 1）；`suggestFor(projectDir, registryRoot, configDir, now)`（Task 2）
- Produces: GET `/station/docs-health` 回 `health` 的 JSON（`?fresh=1` 重算）；GET `/station/doc` 以 `?pkey=&path=` 回 `text/markdown` 或 404；GET `/station/suggest` 以 `?project=<dir>` 回 `suggestFor` 的 JSON 或 404；POST `/profile` 多接受 `agent.<name>.model|effort` 並寫 agent 檔；`window.STATION.profileSpec` = `{ keys, agents: [{ name, model, effort }], efforts, set: { machine, projects } }`（`profileSpec`）

**Dispatch:** implementer, sonnet — 程式碼與測試都在計畫裡；轉寫加測試。

1. 找真正的行號（姊妹計畫 docs/90-agent/plans/2026-10-24-station-gate-talk.md 先動 `scripts/station.js:600-627` 與 `lib/station.js:820-1027`，這裡寫的是它之前的行號）：`grep -n "url.pathname === '/station/search'\|url.pathname === '/profile'\|const back = String(form.get('back')" scripts/station.js` 與 `grep -n "^function serialize(\|profilePresets: profile.PRESETS" lib/station.js`。以 grep 到的行為準。

2. 寫失敗的測試。在 `tests/station-serve-docs-settings.test.js`：

```js
'use strict';
// station-38/39: the routes the 文件 and 設定 modules read — the docs health
// matrix, one page's text, the quick setup's recommendations — the spec the
// detailed page's agents table draws from, and POST /profile taking the
// agent.<name>.model|effort keys that table writes. Fixture and request copied
// from tests/station-post.test.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const registry = require('../lib/registry.js');
const tmp = require('./tmp.js');

const LIVE = 'aaaaaaaa-3333-4333-8333-333333333333';
const DAY = 24 * 3600e3;

function fixture() {
    const base = tmp('fankeel-station-docset-');
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(r1);
    const now = Date.now();
    const at = (ms) => new Date(ms).toISOString();
    registry.writeSession(r1, LIVE, { task: 'docs', stage: 'build', route: ['survey', 'build'], active: true, claims: [],
        started: at(now - 2 * DAY), updated: at(now - DAY), configDir: cfg });
    fs.mkdirSync(path.join(r1, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(r1, 'docs', 'a.md'), '# a\n\nsee [gone](gone.md)\n');
    fs.writeFileSync(path.join(r1, 'notes.js'), 'x\n');
    // Seeded so the server never runs its once-only auto-scan of this machine's drives.
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'), JSON.stringify({ [path.resolve(r1)]: at(now) }, null, 2) + '\n');
    return { cfg, r1 };
}

const request = (url, opts, body) => new Promise((resolve, reject) => {
    const req = http.request(url, opts, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
});

async function served(fn) {
    const f = fixture();
    const { serve } = require('../scripts/station.js');
    const s = await serve({ configDir: f.cfg, port: 0, idleMs: 60e3, open: false });
    try {
        await fn(f, (p) => request(s.url + p, { method: 'GET' }), (body) => request(s.url + 'profile', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' } }, body));
    } finally {
        s.close();
    }
}
const mine = (f, projects) => projects.find((x) => path.resolve(x.dir) === path.resolve(f.r1));
const form = (o) => new URLSearchParams(o).toString();

test('GET /station/docs-health lists the project with six cells; the memo holds until ?fresh=1', () => served(async (f, get) => {
    const r = await get('station/docs-health');
    assert.equal(r.status, 200);
    assert.match(r.headers['content-type'], /application\/json/);
    const body = JSON.parse(r.text);
    const p = mine(f, body.projects);
    assert.ok(p, 'the registry root is a row');
    assert.deepEqual(Object.keys(p.cells).sort(), ['broken', 'diagram', 'drift', 'index', 'landed', 'unfiled']);
    assert.ok(p.cells.broken && p.cells.broken.items.some((i) => i.tag === 'gone'));
    fs.writeFileSync(path.join(f.r1, 'docs', 'b.md'), '# b\n');
    assert.equal(mine(f, JSON.parse((await get('station/docs-health')).text).projects).files, p.files, 'inside ten minutes the memo answers');
    assert.equal(mine(f, JSON.parse((await get('station/docs-health?fresh=1')).text).projects).files, p.files + 1, '?fresh=1 reads again');
}));

test('GET /station/doc answers a tracked markdown page and 404 for anything else', () => served(async (f, get) => {
    const p = mine(f, JSON.parse((await get('station/docs-health')).text).projects);
    const doc = (pkey, rel) => get('station/doc?pkey=' + encodeURIComponent(pkey) + '&path=' + encodeURIComponent(rel));
    const ok = await doc(p.pkey, 'docs/a.md');
    assert.equal(ok.status, 200);
    assert.match(ok.headers['content-type'], /text\/markdown/);
    assert.equal(ok.text, '# a\n\nsee [gone](gone.md)\n');
    for (const bad of ['../x.md', 'notes.js', 'docs/none.md']) assert.equal((await doc(p.pkey, bad)).status, 404, bad);
    assert.equal((await doc('nobody', 'docs/a.md')).status, 404, 'an unknown pkey');
}));

test('GET /station/suggest answers a project on this page and 404 for any other directory', () => served(async (f, get) => {
    const r = await get('station/suggest?project=' + encodeURIComponent(f.r1));
    assert.equal(r.status, 200);
    const body = JSON.parse(r.text);
    assert.deepEqual(Object.keys(body.recs).sort(), ['ctx', 'floor', 'gates', 'inflight', 'lang', 'main', 'push', 'screen', 'sessions', 'where']);
    assert.equal(body.recs.main.o, 'merge');
    assert.equal((await get('station/suggest?project=' + encodeURIComponent(path.join(f.r1, 'elsewhere')))).status, 404);
}));

test('station-data.js carries profileSpec, and POST /profile writes an agent key and its agent file', () => served(async (f, get, post) => {
    const read = async () => {
        const data = await get('station/station-data.js');
        const ctx = { window: {} };
        vm.runInNewContext(data.text, ctx);
        return { nonce: /"nonce":"([^"]+)"/.exec(data.text)[1], spec: JSON.parse(JSON.stringify(ctx.window.STATION.profileSpec)) };
    };
    const { nonce, spec } = await read();
    assert.deepEqual(spec.agents.find((a) => a.name === 'fankeel-reader'), { name: 'fankeel-reader', model: 'sonnet', effort: 'medium' });
    assert.deepEqual(spec.efforts, ['low', 'medium', 'high', 'xhigh', 'max']);
    assert.ok(spec.keys['dispatch.floor']);
    assert.deepEqual(spec.set.machine, {});

    const r = await post(form({ scope: 'project', project: f.r1, key: 'agent.fankeel-reader.effort', value: 'high', nonce }));
    assert.equal(r.status, 303);
    const file = path.join(f.r1, '.claude', 'agents', 'fankeel-reader.md');
    assert.match(fs.readFileSync(file, 'utf8'), /^effort: high$/m);
    assert.equal((await post(form({ scope: 'project', project: f.r1, key: 'agent.fankeel-reader.effort', value: 'zz', nonce }))).status, 400);
    assert.equal((await post(form({ scope: 'project', project: f.r1, key: 'agent.Nope.effort', value: 'high', nonce }))).status, 400);

    const after = (await read()).spec.set.projects;
    const dir = Object.keys(after).find((k) => path.resolve(k) === path.resolve(f.r1));
    assert.deepEqual(after[dir], { 'agent.fankeel-reader.effort': 'high' });
}));
```

3. 跑 `node --test --require ./tests/subprocess-timeout.js tests/station-serve-docs-settings.test.js`，看四個測試都失敗（三條 GET 回 404 `not here`，`profileSpec` 是 undefined）。

4. 在 `scripts/station.js`，緊接在 `/station/search` 那一支（`if (req.method === 'GET' && url.pathname === '/station/search') {` 到它的 `}`）之後，加：

```js
        if (req.method === 'GET' && url.pathname === '/station/docs-health') {
            // station-38: the 文件 page's health matrix. A sweep per project is
            // seconds, so scripts/docs-health.js keeps the answer ten minutes;
            // the page's 重新檢查 asks with ?fresh=1.
            const out = require('./docs-health.js').cached(docsearch.searchDirs(sharedModel()), Date.now(), url.searchParams.get('fresh') === '1');
            return send(200, 'application/json; charset=utf-8', JSON.stringify(out), noStore);
        }
        if (req.method === 'GET' && url.pathname === '/station/doc') {
            // The reader's text: a tracked .md of a project on this page, or 404.
            const text = require('./docs-health.js').readDoc(docsearch.searchDirs(sharedModel()), url.searchParams.get('pkey') || '', url.searchParams.get('path') || '');
            if (text === null) return fail(404, 'no such document on this page');
            return send(200, 'text/markdown; charset=utf-8', text, noStore);
        }
        if (req.method === 'GET' && url.pathname === '/station/suggest') {
            // station-39: the quick setup's preselected answers, for a project
            // this page already lists — the same known-directory check POST /profile makes.
            const want = path.resolve(url.searchParams.get('project') || '');
            const reg = modelNow().registries.find((r) => Object.keys(r.profiles || {}).some((p) => path.resolve(p) === want));
            if (!reg) return fail(404, 'no such project on this page');
            const out = require('../lib/settingsuggest.js').suggestFor(want, reg.root, configDir, Date.now());
            return send(200, 'application/json; charset=utf-8', JSON.stringify(out), noStore);
        }
```

5. 在 `scripts/station.js` 的 POST `/profile` 那一支改三處。第一處：`const form = await formOf();` 與 `if (!form) return;` 之後、`const scope = form.get('scope');` 之前加一行 `const agentfile = require('../lib/agentfile.js');`；`let file;` 之後加 `let want = null;`；把 `const want = path.resolve(form.get('project') || '');` 改成 `want = path.resolve(form.get('project') || '');`。第二處：驗證迴圈裡的 `if` 換成：

```js
                const named = Object.prototype.hasOwnProperty.call(profile.KEYS, keys[i]) || Boolean(agentfile.agentKey(keys[i]));
                if (!named || (values[i] !== '' && profile.parseValue(keys[i], values[i]).error)) {
                    return fail(400, 'not a profile key/value: ' + keys[i] + '=' + values[i]);
                }
```

   第三處：寫入迴圈（`const out = values[i] === '' ? profile.unset(...) : profile.write(...)` 那個 `for`）結束之後、`if (scope === 'machine') {` 之前，在 `scripts/station.js` 加：

```js
            // station-39: the detailed page's agents table writes
            // agent.<name>.model|effort; the override file follows at once,
            // the way `task.js profile set` does it (scripts/task.js), once per agent.
            const synced = new Set();
            for (const k of keys) {
                const agent = agentfile.agentKey(k);
                if (!agent || synced.has(agent.name)) continue;
                synced.add(agent.name);
                agentfile.syncAgent({
                    pluginRoot: PLUGIN, profileFile: file, name: agent.name, version: require('../package.json').version,
                    agentsDir: scope === 'machine' ? path.join(configDir, 'agents') : path.join(want, '.claude', 'agents'),
                });
            }
```

6. 在 `lib/station.js`，緊接在 `function serialize(model, opts) {` 那一行的上一個註解區塊之前（`serialize` 的說明註解之上），加：

```js
// station-39: what the detailed settings page's agents table and free keys
// draw from — every key's spec, every plugin agent with the model and effort
// its own frontmatter pins, and the agent.* values each profile file holds.
// profile.read drops agent.* keys, so those are read raw from the files.
function profileSpec(model) {
    const agentfile = require('./agentfile.js');
    const FRONT = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;
    const agents = agentfile.agentNames(agentfile.PLUGIN_ROOT).map((name) => {
        let head = '';
        try {
            const m = FRONT.exec(fs.readFileSync(path.join(agentfile.PLUGIN_ROOT, 'agents', name + '.md'), 'utf8'));
            head = m ? m[1] : '';
        } catch (e) {
            // listed a moment ago, gone now: it pins nothing
        }
        const field = (k) => {
            const m = new RegExp('^' + k + ':[ \\t]*(\\S+)', 'm').exec(head);
            return m ? m[1] : null;
        };
        return { name, model: field('model'), effort: field('effort') };
    });
    const raw = (file) => {
        const out = {};
        const o = (file && readObject(file)) || {};
        for (const k of Object.keys(o)) if (agentfile.agentKey(k)) out[k] = String(o[k]);
        return out;
    };
    const projects = {};
    for (const r of model.registries) for (const dir of Object.keys(r.profiles || {})) projects[dir] = raw(profile.projectFile(dir));
    return { keys: profile.KEYS, agents, efforts: agentfile.EFFORTS, set: { machine: raw(profile.machineFile(model.configDir)), projects } };
}
```

   再在 `lib/station.js` 的 `serialize` 裡，`profilePresets: profile.PRESETS,` 那一行之後加一行 `profileSpec: profileSpec(model),`。`profileKeys: profile.WIZARD_KEYS` 不動（`tests/station.test.js:155-168` 釘住它）。

7. 跑 `node --test --require ./tests/subprocess-timeout.js tests/station-serve-docs-settings.test.js`，四個測試全過；再跑 `node --test --require ./tests/subprocess-timeout.js tests/station-post.test.js tests/station.test.js`，原有的 POST 與 serialize 測試仍全過。`effort: high` 那條若失敗，讀 `lib/agentfile.js` 的 `render` 看它寫出的那一行長什麼樣，把斷言改成它寫出的行（不改 agentfile）。

8. 在 `docs/90-agent/reference/station.md`，以 `` `node bench/station-gather.js` times warm gathers. `` 結尾的那段（≈`:1400-1410`）之後空一行，加下面這段。`tests/station-doc.test.js:30-36` 要每條 `url.pathname === '…'` 都出現在 station.md，第 4 步一加三條路由它就紅，這段讓它在本任務的 commit 就綠。寫進 `docs/90-agent/reference/station.md` 的段落：

```md
The 文件 and 設定 pages read three more paths: `GET /station/docs-health`
(the health matrix, kept ten minutes; `?fresh=1` reads again),
`GET /station/doc?pkey=&path=` (one tracked `.md` page's text, `404`
otherwise) and `GET /station/suggest?project=<dir>` (the quick setup's
recommendations, `404` for a directory the page does not list).
```

9. 跑 `node --test --require ./tests/subprocess-timeout.js tests/station-doc.test.js tests/station-serve-docs-settings.test.js`，全過。

10. Commit：`git add tests/station-serve-docs-settings.test.js` 然後 `git commit -am "feat(station): serve docs health, doc text, setting suggestions and agent keys"`。

## Task 4: FK_DOCS — the 文件 page as approved

**Files:**
- Modify: `assets/station/docs-page.js` — new; the module, ES5, `w.FK_DOCS`
- Modify: `assets/station/docs-page.css` — new; a mechanical copy of six line ranges of the mockup's style blocks
- Test: `tests/station-docs-page.test.js`
- Read: `.fankeel/build/2026-10-21-station-redesign/route-docs.html` — the approved mockup (gitignored, on disk in the main checkout only): KINDS `:285-304`, TAG `:305-306`, ICO `:307-311`, header tips `:129-136`, matrix/pane/caps `:318-409`, `render()` `:438-476`, `proj()` `:526-544`, search `:548-562`, key line `:161`, run button `:162`, reader shell `:236-243`, project shell `:266-271`
- Read: `assets/station/project-page.js` — module shape (`loc`/`EN`/`kit()`, lazy `bind()`, CJS guard `:236-239`)
- Read: `tests/station-module.js` — `page(names, station, extra)` boots every index.html script plus the named ones in one vm; `stringsLeft(name, EN)`
- Read: `assets/station/station.js:3074-3082` — the shell's `.tdlg` click listener already closes a `.tdlg` dialog on a backdrop click (`t === dlg`)
- Read: `assets/station/station.js:5262-5316` — `draw()` replaces only the parts of `#page` whose HTML changed, so an unchanged `docs-head` section keeps the input and its caret
- Read: `assets/station/station.js:5964-5969` — the shell's keydown sends `/` to the mast's `#q`; this module's listener, bound later, moves it on to `#dq` when the docs page is up
- Read: `lib/station.js:296-343` — `parseMapCard`: the `S.projects[].docs[]` card (`pkey`, `generatedAt`, `total`, `buckets[{label,count}]`, `plannedNotBuilt[]`, `filing{index, rows[{bucket,role}]}`)
- Read: `lib/docsearch.js:121-147` — a search hit: `{project, pkey, path, title, role, count, before, hit, after}`; answer `{q, n, hits}`

**Interfaces:**
- Consumes: `FK_KIT` (`esc`, `fillVars`, `shortLabel`), `/station/docs-health` (Task 1 `health()` served by Task 3: `{at, projects:[{pkey, name, dir, files, index, noTree, last, cells:{drift|landed|index|diagram|broken|unfiled: {n, items[]} | null}}]}`), `/station/doc` (`?pkey=&path=` → markdown text, 404 otherwise), `/station/search` (`?q=` → `{q, n, hits}`)
- Produces: `FK_DOCS`, `FK_DOCS.page(S, opts)` — opts `{names, now, serve, redraw, pkeys}` (Task 9 passes `modOpts({ pkeys: PKEYS })`); returns the page HTML string. Also `FK_DOCS.render(text, line) → {html, meta}`, `FK_DOCS.onClick(e)`, `FK_DOCS.onInput(e)`, `FK_DOCS.onKey(e)`, `FK_DOCS.state()`, `FK_DOCS.reset()`, `FK_DOCS.EN`

**Dispatch:** implementer, sonnet

1. Write the failing test. In `tests/station-docs-page.test.js`:

```js
'use strict';
// The 文件 page (assets/station/docs-page.js; station-38, mockup
// .fankeel/build/2026-10-21-station-redesign/route-docs.html): find box with
// a hits popover, the docs-health matrix (a row a project, a column a check,
// zero a tick), the picked cell's list, the reader dialog with the cited line
// marked, a project's map dialog, and its own English table.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { page, stringsLeft } = require('./station-module.js');

const A = 'F:/w/alpha';
const B = 'F:/w/beta';
const HEALTH = { at: '2026-10-24T08:00:00.000Z', projects: [
    { pkey: B, name: 'beta', dir: B, files: 3, index: null, noTree: true, last: '2026-10-23T10:00:00.000Z',
        cells: { drift: null, landed: null, index: null, diagram: null, broken: null, unfiled: null } },
    { pkey: A, name: 'alpha', dir: A, files: 1200, index: 'docs/README.md', noTree: false, last: '2026-10-24T07:00:00.000Z', cells: {
        drift: { n: 2, items: [{ path: 'docs/ref/a.md', target: 'lib/a.js', gap: 9, docAge: 14, declared: true, sub: 'fix(a): move the cache' }] },
        landed: null,
        index: { n: 1, items: [{ path: 'docs/ref/b.md' }] },
        diagram: null,
        broken: { n: 1, items: [{ path: 'docs/ref/a.md:12', tag: 'gone', note: 'links to lib/old.js' }] },
        unfiled: { n: 4, items: [{ path: 'notes/x.md' }] } } },
] };
const SEARCH = { q: 'remote', n: 1, hits: [{ project: 'alpha', pkey: A, path: 'docs/guide/r.md', title: 'Remote', role: 'guide', count: 3,
    before: 'the ', hit: 'remote', after: ' card' }] };
const DOC = ['---', 'status: current', 'last_verified: 2026-10-01', '---', '# Alpha', '', '| k | v |', '|---|---|', '| a | `b` |', '',
    '- one', 'See [old](lib/old.js) here.', ''].join('\n');
const S = { projects: [{ root: 'F:/w', docs: [{ pkey: A, generatedAt: '2026-10-22T09:00:00.000Z', total: 10,
    buckets: [{ label: 'current', count: 6 }, { label: 'planned', count: 4 }], plannedNotBuilt: ['lib/new.js'],
    filing: { index: 'docs/README.md', rows: [{ bucket: 'docs/ref', role: 'reference' }] } }] }] };
const flush = () => new Promise((r) => setImmediate(r));

function mod(lang) {
    const calls = [];
    const fetch = (url) => {
        calls.push(url);
        if (url.startsWith('station/docs-health')) return Promise.resolve({ ok: true, json: () => Promise.resolve(HEALTH) });
        if (url.startsWith('station/search')) return Promise.resolve({ ok: true, json: () => Promise.resolve(SEARCH) });
        if (url.startsWith('station/doc?')) return Promise.resolve({ ok: true, text: () => Promise.resolve(DOC) });
        return Promise.resolve({ ok: false, status: 404 });
    };
    const { win, doc } = page(['docs-page.js'], {}, { fetch });
    if (lang) win.FK_I18N = { lang };
    const D = win.FK_DOCS;
    D.reset();
    let redraws = 0;
    const o = { names: {}, now: Date.now(), serve: true, pkeys: [A, B], redraw() { redraws++; } };
    return { D, doc, calls, o, draw: (extra) => D.page(S, Object.assign({}, o, extra)), redraws: () => redraws };
}
const hit = (attr, val) => ({ closest: (sel) => (sel === '[' + attr + ']' ? { getAttribute: () => val, disabled: false, closest: () => null } : null) });
const section = (html, block) => {
    const at = html.indexOf('data-block="' + block + '"');
    return html.slice(html.lastIndexOf('<section', at), html.indexOf('</section>', at));
};

test('every Chinese string is keyed and has English', () => {
    const { D } = mod();
    assert.deepEqual(stringsLeft('docs-page.js', D.EN), []);
});

test('unserved, the page says the table needs serve and asks nothing', () => {
    const { draw, calls } = mod();
    const html = draw({ serve: false });
    assert.ok(html.includes('data-block="docs-page"'));
    assert.ok(html.includes('<input id="dq" type="search"'));
    assert.ok(html.includes('這張表要 serve 才讀得到'));
    assert.deepEqual(calls, []);
});

test('served, it reads docs-health once and redraws when it answers', async () => {
    const { draw, calls, redraws } = mod();
    assert.ok(draw().includes('第一次要幾秒'));
    draw();
    assert.deepEqual(calls, ['station/docs-health']);
    await flush();
    assert.equal(redraws(), 1);
    draw();
    assert.deepEqual(calls, ['station/docs-health']);
});

test('the matrix: a row a project in session order, a tick for nothing, a dash for no tree, a number to click', async () => {
    const { draw } = mod();
    draw();
    await flush();
    const html = draw();
    const health = section(html, 'docs-health');
    assert.ok(health.indexOf('>alpha<') < health.indexOf('>beta<'));
    assert.ok(health.includes('<b>2</b> 個專案'));
    assert.ok(health.includes('<b>1,203</b> 份 markdown'));
    assert.ok(health.includes('<b>1</b> 個有缺陷'));
    assert.ok(health.includes('class="dh-n on" data-dk-cell="0 drift" aria-pressed="true"'));
    assert.ok(health.includes('class="dh-n ctx" data-dk-cell="0 unfiled"'));
    assert.ok(health.includes('<td class="dh-na">'));
    assert.ok(health.includes('<td class="dh-ok">'));
    assert.ok(health.includes('id="dh-tip-drift">頁面上次確認之後'));
    assert.ok(health.includes('data-dk-proj="1"'));
    assert.ok(health.includes('重新檢查'));
    assert.ok(!/<circle|<line|class="[^"]*graph/.test(health), 'no relation graph in docs-health (station-38)');
});

test('the side card lists the picked cell, and a click on another cell picks it', async () => {
    const m = mod();
    m.draw();
    await flush();
    let side = section(m.draw(), 'docs-findings');
    assert.ok(side.includes('alpha · 要重讀的頁'));
    assert.ok(side.includes('14 天前確認過；之後 <code>lib/a.js</code> 又改了'));
    assert.ok(side.includes('之後的提交：fix(a): move the cache'));
    assert.ok(side.includes('列出前 <b>1</b> 條，共 <b>2</b> 條'));
    assert.ok(side.includes('<code>node scripts/docs-audit.js --root F:/w/alpha</code>'));
    m.D.onClick({ target: hit('data-dk-cell', '0 broken') });
    assert.equal(m.redraws(), 2);
    side = section(m.draw(), 'docs-findings');
    assert.ok(side.includes('<span class="df-path">docs/ref/a.md<em>:12</em></span>'));
    assert.ok(side.includes('<span class="df-tag">指向的東西不在了</span>'));
    assert.ok(side.includes('連到 <code>lib/old.js</code>'));
    assert.ok(side.includes('共 <b>1</b> 條'));
});

test('the find box is the same HTML on every draw, so the redraw keeps its caret', async () => {
    const { draw } = mod();
    draw();
    await flush();
    assert.equal(section(draw(), 'docs-head'), section(draw(), 'docs-head'));
});

test('重新檢查 asks again with ?fresh=1 and says it is checking', async () => {
    const m = mod();
    m.draw();
    await flush();
    m.D.onClick({ target: hit('data-dk-run', '1') });
    assert.equal(m.calls[1], 'station/docs-health?fresh=1');
    assert.ok(m.draw().includes('檢查中…'));
    await flush();
    assert.ok(m.draw().includes('重新檢查'));
});

test('typing asks station/search and paints the hits into #dq-pop; a hit opens the reader', async () => {
    const m = mod();
    m.draw();
    await flush();
    m.D.onInput({ target: { id: 'dq', value: ' remote ' } });
    assert.equal(m.calls[1], 'station/search?q=remote');
    await flush();
    const pop = m.doc.getElementById('dq-pop');
    assert.equal(pop.hidden, false);
    assert.ok(pop.innerHTML.includes('<b>1</b> 頁含「remote」'));
    assert.ok(pop.innerHTML.includes('data-dk-hit="0"'));
    assert.ok(pop.innerHTML.includes('<mark>remote</mark>'));
    m.D.onClick({ target: hit('data-dk-hit', '0') });
    assert.equal(m.calls[2], 'station/doc?pkey=' + encodeURIComponent(A) + '&path=docs%2Fguide%2Fr.md');
    assert.ok(m.doc.getElementById('rd-why').innerHTML.includes('含「remote」3 處'));
    assert.equal(m.doc.getElementById('rd-pos').textContent, '1 / 1');
    await flush();
    assert.ok(m.doc.getElementById('rd-body').innerHTML.includes('<h2 data-l="5">Alpha</h2>'));
});

test('a row of the list opens the reader at its cited line', async () => {
    const m = mod();
    m.draw();
    await flush();
    m.D.onClick({ target: hit('data-dk-cell', '0 broken') });
    m.D.onClick({ target: hit('data-dk-item', '0') });
    assert.equal(m.calls[1], 'station/doc?pkey=' + encodeURIComponent(A) + '&path=docs%2Fref%2Fa.md');
    assert.equal(m.doc.getElementById('rd-path').textContent, 'docs/ref/a.md:12');
    await flush();
    const body = m.doc.getElementById('rd-body').innerHTML;
    assert.match(body, /<p data-l="12" class="[^"]*hl">See <span class="rd-a" title="lib\/old.js">old<\/span> here.<\/p>/);
    assert.ok(m.doc.getElementById('rd-meta').innerHTML.includes('<i>last_verified</i>2026-10-01'));
});

test('render: frontmatter, heading, table, list, code', () => {
    const { D } = mod();
    const r = D.render(DOC + '\n```\nx < y\n```\n', 0);
    assert.deepEqual({ ...r.meta }, { status: 'current', last_verified: '2026-10-01' });
    assert.ok(r.html.includes('class="rd-tw"><table><thead><tr><th>k</th><th>v</th></tr></thead><tbody><tr><td>a</td><td><code>b</code></td></tr></tbody></table>'));
    assert.ok(r.html.includes('<ul><li data-l="11">one</li></ul>'));
    assert.ok(r.html.includes('<pre data-l="14"><code>x &lt; y</code></pre>'));
    assert.ok(!r.html.includes(' hl'));
});

test('a project name opens its map: split, not built, filing; no map says how to write one', async () => {
    const m = mod();
    m.draw();
    await flush();
    m.D.onClick({ target: hit('data-dk-proj', '0') });
    const dlg = m.doc.getElementById('dlg-proj').innerHTML;
    assert.ok(dlg.includes('map 數到 10 份'));
    assert.ok(dlg.includes('class="split-bar"'));
    assert.ok(dlg.includes('<li title="lib/new.js">lib/new.js</li>'));
    assert.ok(dlg.includes('<td>docs/ref</td><td><span class="chip">reference</span></td>'));
    assert.ok(dlg.includes('index · docs/README.md'));
    m.D.onClick({ target: hit('data-dk-proj', '1') });
    assert.ok(m.doc.getElementById('dlg-proj').innerHTML.includes('node scripts/map.js'));
});

test('/ focuses the find box when nothing is typed into and no dialog is open', () => {
    const m = mod();
    m.draw({ serve: false });
    let focused = false;
    m.doc.getElementById('dq').focus = () => { focused = true; };
    m.D.onKey({ key: '/', target: { closest: () => null }, preventDefault() {} });
    assert.ok(focused);
});

test('English reads the English table', async () => {
    const m = mod('en');
    m.draw();
    await flush();
    const html = m.draw();
    assert.ok(html.includes('Pages to re-read'));
    assert.ok(html.includes('Check again'));
});

test('the stylesheet is the mockup\'s rules without style tags', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'docs-page.css'), 'utf8');
    for (const rule of ['.dk{', '.dq-pop{', '.dh-t{', '.dh-tip{', '.df-row{', '.rd-body .hl{', '.tdlg.pd{', '.pd-cols{']) assert.ok(css.includes(rule), rule);
    assert.ok(!/<\/?style/.test(css));
});
```

2. Run `node --test --require ./tests/subprocess-timeout.js tests/station-docs-page.test.js` and watch it fail (`ENOENT … assets/station/docs-page.js`).

3. Write `assets/station/docs-page.css` from the approved mockup — a mechanical copy, nothing retyped: the `.dk` page rules (mockup `:12-15`), the docs-head find box (`:36-59`), the docs-health matrix (`:75-123`), the docs-findings card (`:170-189`), the docs-reader dialog (`:200-234`) and the docs-project dialog (`:249-264`), in that order, without the `<style>` tags around them. The path is absolute because `.fankeel/build` is gitignored and exists only in the main checkout; for `assets/station/docs-page.css`, run:

```sh
f=F:/ymlab/fankeel/.fankeel/build/2026-10-21-station-redesign/route-docs.html
{ printf '%s\n' "/* assets/station/docs-page.css — the 文件 page (assets/station/docs-page.js), copied from the approved mockup" \
    "   .fankeel/build/2026-10-21-station-redesign/route-docs.html lines 12-15, 36-59, 75-123, 170-189, 200-234, 249-264 (station-38). */"
  sed -n '12,15p;36,59p;75,123p;170,189p;200,234p;249,264p' "$f"; } > assets/station/docs-page.css
grep -c '' assets/station/docs-page.css
```

   The count is 150 (2 comment lines + 4 + 24 + 49 + 20 + 35 + 16; the rules the mockup splits over two or three lines, `:46-47`, `:86-88`, `:118-119`, are inside the ranges and copied whole). If `$f` does not exist, return BLOCKED: the mockup is not in git, nothing replaces it.

4. Write the module. In `assets/station/docs-page.js`:

```js
'use strict';
// assets/station/docs-page.js — the 文件 page `#/docs` as approved (station-38;
// mockup .fankeel/build/2026-10-21-station-redesign/route-docs.html, blocks
// docs-head, docs-health, docs-findings, docs-reader, docs-project). A find box
// whose hits drop into a popover (GET station/search); the docs-health matrix,
// a row a project and a column a check, zero a tick, read once a visit from
// GET station/docs-health (`?fresh=1` when asked to check again); the picked
// cell listed beside it; a reader dialog rendering one page's markdown from
// GET station/doc with the cited line marked, arrow keys walking the list it
// came from; a project's map from S.projects[].docs. No relation graph.
// The two dialogs live under <body>, outside #page, so the 3 s redraw never
// replaces them; the find box's HTML never changes, so the redraw's part diff
// leaves it and its caret alone, and hits are painted into #dq-pop directly.
// Reads `w.FK_KIT` (esc, fillVars, shortLabel) when it draws.
(function (w, doc) {
    var EN = {
        'dk.find': 'Find a page',
        'dk.findHint': 'Type a word, e.g. remote',
        'dk.hitsLabel': 'Matching pages',
        'dk.scope': 'Searches reference, guide and decision pages in every project<br>archive, plan and report are left out',
        'dk.healthLabel': 'Documents to handle',
        'dk.unserved': 'This table needs serve: a station written to disk does not run docs-check or docs-audit.',
        'dk.loadFail': 'Could not read the document checks: {e}',
        'dk.loading': 'Running docs-check and docs-audit on every project; the first time takes a few seconds…',
        'dk.keyFix': 'To fix: the number is how many, click for the list',
        'dk.keyCtx': 'Outside the checks, for reference only',
        'dk.keyOk': 'Nothing wrong',
        'dk.keyOrder': 'Projects in order of their latest session',
        'dk.runTip': 'Re-run docs-check and docs-audit on every project in the background; the table updates when they finish',
        'dk.running': 'Checking…',
        'dk.run': 'Check again',
        'dk.lastRun': 'last {t}',
        'dk.noTree': '{p} declares no document tree, so nothing is filed',
        'dk.none': '{p}: no {k}',
        'dk.noneSr': 'None',
        'dk.cellTip': '{p}: {k} {n}, click for the list',
        'dk.caption': 'How many findings each project has in each check',
        'dk.project': 'Project',
        'dk.projTip': '{root}: see its map (status, not built, filing)',
        'dk.files': '{n} files · {t}',
        'dk.capsProjects': '<b>{n}</b> projects',
        'dk.capsFiles': '<b>{n}</b> markdown files',
        'dk.capsBad': '<b>{n}</b> with defects',
        'dk.paneLabel': 'The picked cell, listed',
        'dk.allClear': 'Every check is clean in every project.',
        'dk.paneWait': 'Once the table is read, the cell you pick is listed here.',
        'dk.noItems': 'docs-audit gives only a count for this check, no file names.',
        'dk.readAt': 'Read this page at line {n}',
        'dk.read': 'Read this page',
        'dk.shown': 'First <b>{s}</b> of <b>{n}</b>',
        'dk.all': '<b>{n}</b> in all',
        'dk.unfiledCount': 'docs-audit counts <b>{n}</b>; above are the <b>{s}</b> docs-check lists under the doc root',
        'dk.full': 'Full list: ',
        'dk.verifiedAgo': 'verified {d} days ago',
        'dk.touchedAgo': 'last edited {d} days ago',
        'dk.changedAfter': '; since then <code>{t}</code> changed',
        'dk.landedNote': 'all {n} named files exist; untouched {d} days',
        'dk.indexDead': 'the index lists <code>{t}</code>, which is gone',
        'dk.indexMissing': 'not listed in the index',
        'dk.diagramNote': '<code>{dir}</code> has {total} files, the diagram names {named}; missing <code>{m}</code>',
        'dk.names': 'names ',
        'dk.links': 'links to ',
        'dk.after': 'Later commit: ',
        'dk.tagGone': 'target is gone',
        'dk.tagMoved': 'line moved',
        'dk.tagPastEnd': 'past the end of the file',
        'dk.tagOrphan': 'declaration not found',
        'dk.tagOpenFence': 'code fence left open',
        'dk.tagLong': 'sentence too long',
        'dk.tagArchive': 'points into archive',
        'dk.tagBinding': 'more than seven bindings',
        'dk.tagBare': 'code with no language',
        'dk.drift': 'Pages to re-read',
        'dk.driftTip': 'The code a page describes changed after the page was last confirmed, so the page may be wrong. Re-read it: if it still holds, update last_verified; if not, fix it.',
        'dk.driftWhat': 'The code this page describes changed after it was last confirmed.',
        'dk.driftFix': 'Re-read it: still right, update <code>last_verified</code>; not, fix the text.',
        'dk.landed': 'Plans to archive',
        'dk.landedTip': 'Every file the plan names is built or deleted, and it has not moved for 3 days or more: the work is done but it still sits in plans like a to-do. Once confirmed, move it into archive.',
        'dk.landedWhat': 'Every file the plan names exists, or git saw it deleted; the work looks done.',
        'dk.landedFix': 'Confirm it is done, then move the plan into archive.',
        'dk.index': 'README rows to fix',
        'dk.indexTip': 'The index docs/README.md lists a page that does not exist, or misses one that does. Add a row for the missing, delete the dead.',
        'dk.indexWhat': 'These pages are not listed in the index <code>{index}</code>, so it does not lead to them.',
        'dk.indexFix': 'Add a row to the index.',
        'dk.diagram': 'Diagrams missing files',
        'dk.diagramTip': 'A mermaid diagram draws most of a directory, but files added to it later are not in the drawing. Add the missing names to the diagram.',
        'dk.diagramWhat': 'The diagram lists a directory\'s files, and the directory has gained files since.',
        'dk.diagramFix': 'Add the missing file names to the diagram.',
        'dk.broken': 'Broken links',
        'dk.brokenTip': 'A link, file:line or program name in a document no longer finds what it points at. Change it to the current path or line.',
        'dk.brokenWhat': 'A link or <code>path:line</code> reference no longer matches.',
        'dk.brokenFix': 'Change it to the current path or line; quote the line too, so a shift is caught.',
        'dk.unfiled': 'Files nobody checks',
        'dk.unfiledTip': 'These markdown files are in no category of .fankeel/docs.json, so none of the five columns to the left checks them. If they are documents, give them a category in docs.json; this column is for reference and is not a defect.',
        'dk.unfiledWhat': 'In no bucket of <code>.fankeel/docs.json</code>, so none of the five checks to the left reads them.',
        'dk.unfiledFix': 'If they are documents, give them a bucket in <code>docs.json</code>.',
        'dk.prev': 'Previous',
        'dk.prevTip': 'Previous (←)',
        'dk.next': 'Next',
        'dk.nextTip': 'Next (→)',
        'dk.close': 'Close',
        'dk.walk': 'switch page',
        'dk.reading': 'Reading…',
        'dk.unreadable': 'Could not read this page.',
        'dk.empty': 'This page is empty.',
        'dk.searchOff': 'Search needs serve running.',
        'dk.searchFail': 'serve did not answer this search.',
        'dk.noHits': 'No page contains “{q}”.',
        'dk.hitsN': '<b>{n}</b> pages contain “{q}”, most mentions first',
        'dk.hitWhy': 'contains “{q}” {n} times',
        'dk.mapAt': '<span class="mono">.fankeel/map.md</span> written <span class="mono">{t}</span>',
        'dk.status': 'Status',
        'dk.mapCount': 'map counts {n}',
        'dk.oldMap': 'This map is in the old format, with no status counts; re-run <code>node scripts/map.js</code> to add them.',
        'dk.noMap': 'This project has no .fankeel/map.md; run <code>node scripts/map.js</code> to write one.',
        'dk.planned': 'Not built',
        'dk.nothing': 'None.',
        'dk.filing': 'Filing',
        'dk.noTreeShort': 'no document tree declared',
        'dk.allRef': 'Every markdown file is checked as reference.',
    };
    function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    function kit() { return (w && w.FK_KIT) || {}; }
    function loc(key, zh, vars) {
        var I = w && w.FK_I18N, s = I && I.lang === 'en' && has(EN, key) ? EN[key] : zh;
        return kit().fillVars ? kit().fillVars(s, vars) : s;
    }
    function esc(s) { return kit().esc(s); }
    var ICO = {
        ok: '<svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5 6.5 11.5 12.5 5"/></svg>',
        doc: '<svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 1.8h5l3.2 3.2v9.2H4z"/><path d="M8.8 1.8v3.4h3.4M6 8.3h4.2M6 11h4.2"/></svg>',
        find: '<svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3"/></svg>',
        run: '<svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 8a5 5 0 1 1-1.5-3.6"/><path d="M13 2.5v3h-3"/></svg>',
        prev: '<svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3.5 5.5 8l4.5 4.5"/></svg>',
        next: '<svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m6 3.5 4.5 4.5L6 12.5"/></svg>',
        x: '<svg class="ico" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'
    };
    // The six checks, in column order; built per draw so the language switch reaches them.
    function kinds() {
        return [
            { k: 'drift', src: 'docs-audit', l: loc('dk.drift', '要重讀的頁'),
                tip: loc('dk.driftTip', '頁面上次確認之後，它描述的程式碼又改了，內容可能已經不對。重讀一遍：還對就更新 last_verified，不對就改內容。'),
                what: loc('dk.driftWhat', '頁面上次確認之後，它描述的程式碼又改了。'),
                fix: loc('dk.driftFix', '重讀頁面：內容還對就更新 <code>last_verified</code>，不對就改內容。') },
            { k: 'landed', src: 'docs-audit', l: loc('dk.landed', '可歸檔的計畫'),
                tip: loc('dk.landedTip', '計畫點名的檔案都已建好或刪掉，而且 3 天以上沒動：工作做完了，卻還放在 plans 裡像待辦。確認做完就移進 archive。'),
                what: loc('dk.landedWhat', '計畫點名的檔案都已存在，或 git 看過它被刪；工作看來做完了。'),
                fix: loc('dk.landedFix', '確認做完，就把計畫移進 archive。') },
            { k: 'index', src: 'docs-audit', l: loc('dk.index', 'README 要改的列'),
                tip: loc('dk.indexTip', '索引 docs/README.md 列了不存在的頁，或漏了現有的頁。漏的補一列，指空的刪掉。'),
                what: loc('dk.indexWhat', '這些文件沒列在索引 <code>{index}</code> 裡，從索引走不到。'),
                fix: loc('dk.indexFix', '在索引加一列。') },
            { k: 'diagram', src: 'docs-audit', l: loc('dk.diagram', '要補檔的圖'),
                tip: loc('dk.diagramTip', '一張 mermaid 圖畫了某個目錄的大部分檔案，目錄後來新增的檔卻沒畫進去。把缺的檔名補進圖。'),
                what: loc('dk.diagramWhat', '圖列出某個目錄的檔案，目錄後來多了檔。'),
                fix: loc('dk.diagramFix', '把缺的檔名補進圖。') },
            { k: 'broken', src: 'docs-check', l: loc('dk.broken', '壞掉的連結'),
                tip: loc('dk.brokenTip', '文件裡的連結、檔案:行號或程式名稱，已經找不到對應的東西。改成現在的路徑或行號。'),
                what: loc('dk.brokenWhat', '連結或 <code>path:line</code> 引用已經對不上。'),
                fix: loc('dk.brokenFix', '改成現在的路徑或行號；引用附上引文，行號移位時就會被抓到。') },
            { k: 'unfiled', src: 'docs-audit', ctx: true, l: loc('dk.unfiled', '沒人檢查的檔'),
                tip: loc('dk.unfiledTip', '這些 markdown 不在 .fankeel/docs.json 的任何分類裡，左邊五欄都不檢查它們。是文件就在 docs.json 給它分類；這欄只供參考，不算缺陷。'),
                what: loc('dk.unfiledWhat', '不在 <code>.fankeel/docs.json</code> 任何 bucket 裡，左邊五項都沒檢查到它們。'),
                fix: loc('dk.unfiledFix', '是文件，就在 <code>docs.json</code> 給它們一個 bucket。') }
        ];
    }
    function kindOf(k) { var K = kinds(); for (var i = 0; i < K.length; i++) if (K[i].k === k) return K[i]; return null; }
    function tagOf(t) {
        var T = { gone: loc('dk.tagGone', '指向的東西不在了'), moved: loc('dk.tagMoved', '行號移位'), 'past-end': loc('dk.tagPastEnd', '超過檔尾'),
            orphan: loc('dk.tagOrphan', '找不到宣告'), 'open-fence': loc('dk.tagOpenFence', 'code fence 沒關'), 'long-sentence': loc('dk.tagLong', '句子太長'),
            'into-archive': loc('dk.tagArchive', '指進 archive'), binding: loc('dk.tagBinding', 'binding 超過七條'), 'bare-code': loc('dk.tagBare', '沒標語言的 code') };
        return has(T, t) ? T[t] : t;
    }
    function num(n) { return Number(n || 0).toLocaleString('en-US'); }
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function when(iso) {
        var d = new Date(iso);
        return iso && isFinite(d.getTime()) ? pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) : '—';
    }
    function splitPath(p) { var m = /^(.*?)(?::(\d+))?$/.exec(String(p || '')); return { file: m[1], line: m[2] ? Number(m[2]) : 0 }; }

    // A visit is a run of draws less than VISIT_MS apart (the redraw is every 3 s); a new visit reads the table again.
    var VISIT_MS = 10000;
    function blank() { return { S: null, data: null, err: null, loading: false, drawnAt: 0, sel: null, q: '', res: null, hits: [], seq: 0, timer: null, list: [], at: 0, readSeq: 0 }; }
    var st = blank(), last = null, bound = false;
    function redraw() { if (last && typeof last.redraw === 'function') last.redraw(); }
    function swOf(pkey) {
        var keys = (last && last.pkeys) || [], i = keys.indexOf(pkey);
        return 'var(--p-' + (i < 0 ? 5 : Math.min(i, 5)) + ')';
    }
    // The table's projects in the shell's order (latest session first), each with its row index, label and colour.
    function projects() {
        var P = (st.data && st.data.projects) || [], keys = (last && last.pkeys) || [], names = (last && last.names) || {};
        var rank = function (p) { var i = keys.indexOf(p.pkey); return i < 0 ? keys.length : i; };
        return P.slice().sort(function (a, b) { return rank(a) - rank(b); }).map(function (p, i) {
            return { i: i, p: p, sw: swOf(p.pkey), name: names[p.pkey] && kit().shortLabel ? kit().shortLabel(names[p.pkey]) : p.name };
        });
    }
    function defects(p) {
        return kinds().reduce(function (a, K) { var c = p.cells && p.cells[K.k]; return a + (K.ctx || !c ? 0 : c.n); }, 0);
    }
    // The picked cell, kept while it still holds findings; else the first defect, reading row by row.
    function selected() {
        var R = projects(), K = kinds(), i, j, c;
        if (st.sel) {
            for (i = 0; i < R.length; i++) {
                c = R[i].p.cells && R[i].p.cells[st.sel.k];
                if (R[i].p.pkey === st.sel.pkey && c && c.n) return { r: R[i], K: kindOf(st.sel.k) };
            }
        }
        for (i = 0; i < R.length; i++) {
            for (j = 0; j < K.length; j++) {
                c = R[i].p.cells && R[i].p.cells[K[j].k];
                if (!K[j].ctx && c && c.n) { st.sel = { pkey: R[i].p.pkey, k: K[j].k }; return { r: R[i], K: K[j] }; }
            }
        }
        st.sel = null;
        return null;
    }
    function load(fresh) {
        if (typeof fetch !== 'function') return;
        st.loading = true;
        fetch('station/docs-health' + (fresh ? '?fresh=1' : ''), { cache: 'no-store' }).then(function (r) {
            if (!r.ok) throw new Error(String(r.status));
            return r.json();
        }).then(function (d) {
            st.data = d;
            st.err = null;
        }, function (e) {
            st.err = String((e && e.message) || e);
        }).then(function () {
            st.loading = false;
            redraw();
        });
    }

    // ---- the find box: its HTML is a constant of the language, so the redraw leaves it alone ----
    function headHtml() {
        return '<section class="dcard dk-head" data-block="docs-head" aria-label="' + loc('dk.find', '找文件') + '"><div class="dq">'
            + '<label for="dq">' + loc('dk.find', '找文件') + '</label>'
            + '<div class="dq-box">' + ICO.find + '<input id="dq" type="search" autocomplete="off" placeholder="' + loc('dk.findHint', '輸入字詞，例如 remote')
            + '" role="combobox" aria-autocomplete="list" aria-controls="dq-pop" aria-expanded="false"><kbd>/</kbd></div>'
            + '<div class="dq-pop" id="dq-pop" role="listbox" aria-label="' + loc('dk.hitsLabel', '符合的文件') + '" hidden></div></div>'
            + '<p class="dk-scope">' + loc('dk.scope', '搜全部專案 reference、guide、decision 的內文<br>archive、plan、report 不搜') + '</p></section>';
    }
    function paintHits(res) {
        var pop = doc && doc.getElementById('dq-pop'), q = doc && doc.getElementById('dq');
        if (!pop) return;
        var open = function (on) { pop.hidden = !on; if (q && q.setAttribute) q.setAttribute('aria-expanded', on ? 'true' : 'false'); };
        if (!res) { open(false); return; }
        var h;
        if (res.off) h = '<p class="dq-none">' + loc('dk.searchOff', '搜尋要 serve 開著才能用。') + '</p>';
        else if (res.err) h = '<p class="dq-none">' + loc('dk.searchFail', 'serve 沒有回答這次搜尋。') + '</p>';
        else if (!st.hits.length) h = '<p class="dq-none">' + esc(loc('dk.noHits', '沒有頁含「{q}」。', { q: res.q })) + '</p>';
        else {
            h = '<p class="dq-n">' + loc('dk.hitsN', '<b>{n}</b> 頁含「{q}」，次數多的在上', { n: res.n, q: esc(res.q) }) + '</p><ol class="dq-list">'
                + st.hits.map(function (x, i) {
                    return '<li><button type="button" class="dq-row" data-dk-hit="' + i + '"><span class="dq-t">' + esc(x.title || x.path) + '</span><span class="chip">' + esc(x.role) + '</span>'
                        + '<span class="dq-snip">' + esc(x.before) + '<mark>' + esc(x.hit) + '</mark>' + esc(x.after) + '</span>'
                        + '<span class="dq-path">' + esc(x.project) + ' · ' + esc(x.path) + '</span></button></li>';
                }).join('') + '</ol>';
        }
        pop.innerHTML = h;
        open(true);
    }
    function ask(q, n) {
        if (!last || !last.serve || typeof fetch !== 'function') { paintHits({ off: true }); return; }
        fetch('station/search?q=' + encodeURIComponent(q), { cache: 'no-store' }).then(function (r) {
            if (!r.ok) throw new Error(String(r.status));
            return r.json();
        }).then(function (res) {
            if (st.seq !== n) return;
            st.res = res;
            st.hits = res.hits || [];
            paintHits(res);
        }, function () {
            if (st.seq === n) paintHits({ err: true });
        });
    }

    // ---- the matrix: a row a project, a column a check ----
    function cellHtml(r, K) {
        var p = r.p, c = p.cells && p.cells[K.k];
        if (!c || !c.n) {
            if (K.k === 'unfiled' && p.noTree) return '<td class="dh-na"><span title="' + esc(loc('dk.noTree', '{p} 沒宣告文件樹，不分歸檔', { p: r.name })) + '">—</span></td>';
            return '<td class="dh-ok"><span title="' + esc(loc('dk.none', '{p}：{k} 沒有', { p: r.name, k: K.l })) + '">' + ICO.ok + '<span class="hm-sr">' + loc('dk.noneSr', '沒有') + '</span></span></td>';
        }
        var on = Boolean(st.sel && st.sel.pkey === p.pkey && st.sel.k === K.k);
        return '<td><button type="button" class="dh-n' + (K.ctx ? ' ctx' : '') + (on ? ' on' : '') + '" data-dk-cell="' + r.i + ' ' + K.k + '" aria-pressed="' + on + '" title="'
            + esc(loc('dk.cellTip', '{p}：{k} {n} 條，點開看清單', { p: r.name, k: K.l, n: c.n })) + '">' + num(c.n) + '</button></td>';
    }
    function matrixHtml() {
        var K = kinds();
        var h = '<table class="dh-t"><caption class="hm-sr">' + loc('dk.caption', '每個專案在每一項檢查的條數') + '</caption><colgroup><col>'
            + K.map(function (x) { return '<col class="c' + (x.ctx ? ' ctx' : '') + '">'; }).join('') + '</colgroup><thead><tr><th scope="col">' + loc('dk.project', '專案') + '</th>'
            + K.map(function (x) {
                return '<th scope="col" class="' + (x.ctx ? 'ctx' : '') + '"><span class="dh-h" tabindex="0" aria-describedby="dh-tip-' + x.k + '">' + x.l + '</span>'
                    + '<span class="dh-tip" role="tooltip" id="dh-tip-' + x.k + '">' + x.tip + '</span></th>';
            }).join('') + '</tr></thead><tbody>';
        projects().forEach(function (r) {
            h += '<tr' + (st.sel && st.sel.pkey === r.p.pkey ? ' class="on"' : '') + '><th scope="row"><button type="button" class="dh-p" data-dk-proj="' + r.i + '" aria-haspopup="dialog" title="'
                + esc(loc('dk.projTip', '{root}：看它的 map（狀態、還沒建、歸檔位置）', { root: r.p.dir })) + '"><i class="sw" style="background:' + r.sw + '" aria-hidden="true"></i><span class="dh-pn">' + esc(r.name) + '</span></button>'
                + '<span class="dh-pm">' + esc(loc('dk.files', '{n} 份 · {t}', { n: num(r.p.files), t: when(r.p.last) })) + '</span></th>'
                + K.map(function (x) { return cellHtml(r, x); }).join('') + '</tr>';
        });
        return h + '</tbody></table>';
    }
    function capsHtml() {
        var P = st.data.projects || [], bad = P.filter(function (p) { return defects(p) > 0; }).length;
        var files = P.reduce(function (a, p) { return a + (p.files || 0); }, 0);
        return '<span class="dh-caps"><span>' + loc('dk.capsProjects', '<b>{n}</b> 個專案', { n: P.length }) + '</span><span>' + loc('dk.capsFiles', '<b>{n}</b> 份 markdown', { n: num(files) }) + '</span>'
            + '<span class="warn">' + loc('dk.capsBad', '<b>{n}</b> 個有缺陷', { n: bad }) + '</span></span>';
    }
    function keyHtml() {
        return '<p class="dh-key"><span><i style="background:var(--signal-tint);box-shadow:inset 0 0 0 1px var(--signal-ink)"></i>' + loc('dk.keyFix', '要修：數字是條數，點開看清單') + '</span>'
            + '<span><i style="background:var(--inset);box-shadow:inset 0 0 0 1px var(--rule2)"></i>' + loc('dk.keyCtx', '不在檢查範圍，只供參考') + '</span>'
            + '<span>' + ICO.ok + loc('dk.keyOk', '沒問題') + '</span><span>' + loc('dk.keyOrder', '專案依最近的 session 排序') + '</span>'
            + '<button type="button" class="dh-run" data-dk-run="1"' + (st.loading ? ' disabled' : '') + ' title="' + loc('dk.runTip', '背景重跑每個專案的 docs-check 與 docs-audit；跑完這張表自己更新') + '">'
            + ICO.run + (st.loading ? loc('dk.running', '檢查中…') : loc('dk.run', '重新檢查'))
            + ' <span class="mono" style="color:var(--muted)">· ' + esc(loc('dk.lastRun', '上次 {t}', { t: when(st.data.at) })) + '</span></button></p>';
    }
    function healthHtml(o) {
        var h = '<section class="dcard dh" data-block="docs-health" aria-label="' + loc('dk.healthLabel', '要處理的文件') + '"><div class="dcard-h dh-hd">'
            + ICO.doc + '<b>' + loc('dk.healthLabel', '要處理的文件') + '</b>' + (st.data ? capsHtml() : '') + '</div>';
        if (!o.serve) return h + '<p class="df-none">' + loc('dk.unserved', '這張表要 serve 才讀得到：寫在磁碟上的 station 不跑 docs-check 與 docs-audit。') + '</p></section>';
        if (!st.data) {
            return h + '<p class="df-none">' + (st.err ? esc(loc('dk.loadFail', '讀不到文件檢查：{e}', { e: st.err }))
                : loc('dk.loading', '每個專案跑一次 docs-check 與 docs-audit，第一次要幾秒…')) + '</p></section>';
        }
        return h + '<div id="dh-body">' + matrixHtml() + '</div>' + keyHtml() + '</section>';
    }

    // ---- the list beside it: what one cell holds ----
    function noteOf(k, it) {
        var m;
        if (k === 'drift') {
            return (it.declared ? loc('dk.verifiedAgo', '{d} 天前確認過', { d: it.docAge }) : loc('dk.touchedAgo', '{d} 天前最後修改', { d: it.docAge }))
                + loc('dk.changedAfter', '；之後 <code>{t}</code> 又改了', { t: esc(it.target) });
        }
        if (k === 'landed') return loc('dk.landedNote', '點名的 {n} 個檔都在；{d} 天沒動', { n: it.named, d: it.age });
        if (k === 'index') return it.target ? loc('dk.indexDead', '索引列了 <code>{t}</code>，它不在了', { t: esc(it.target) }) : loc('dk.indexMissing', '索引沒列這份');
        if (k === 'diagram') {
            return loc('dk.diagramNote', '<code>{dir}</code> 有 {total} 個檔，圖只列 {named} 個；缺 <code>{m}</code>', { dir: esc(it.dir), total: it.total, named: it.named, m: esc(it.missing) });
        }
        if (k === 'broken') {
            m = /^(names|links to) (.*)$/.exec(it.note || '');
            if (m) return (m[1] === 'names' ? loc('dk.names', '點名 ') : loc('dk.links', '連到 ')) + '<code>' + esc(m[2]) + '</code>';
            return esc(it.note || '').replace(/`([^`]+)`/g, '<code>$1</code>');
        }
        return '';
    }
    function subOf(it) {
        if (!it.sub || /no commit subject/.test(it.sub)) return '';
        return '<span class="df-sub">' + loc('dk.after', '之後的提交：') + esc(it.sub) + '</span>';
    }
    function findingsHtml(pick) {
        var h = '<section class="dcard df" data-block="docs-findings" aria-label="' + loc('dk.paneLabel', '選中那一格的清單') + '"><div id="df-body">';
        if (!pick) {
            return h + '<div class="dcard-h df-h">' + ICO.doc + '<b>' + loc('dk.paneLabel', '選中那一格的清單') + '</b></div><p class="df-none">'
                + (st.data ? loc('dk.allClear', '每個專案每一項都沒問題。') : loc('dk.paneWait', '表讀到之後，這裡列出你點的那一格。')) + '</p></div></section>';
        }
        var r = pick.r, K = pick.K, p = r.p, c = p.cells[K.k], items = c.items || [];
        h += '<div class="dcard-h df-h">' + ICO.doc + '<b><i class="sw" style="background:' + r.sw + '" aria-hidden="true"></i>' + esc(r.name) + ' · ' + K.l + '</b>'
            + '<span class="kn' + (K.ctx ? '' : ' wait') + '">' + num(c.n) + '</span><span class="df-src">' + K.src + '</span></div>'
            + '<p class="df-what">' + K.what.replace('{index}', esc(p.index || '')) + ' ' + K.fix + '</p>';
        if (!items.length) h += '<p class="df-none">' + loc('dk.noItems', 'docs-audit 只給這一項的數字，不列檔名。') + '</p>';
        else {
            h += '<ol class="df-list" aria-label="' + esc(r.name + ' ' + K.l) + '">' + items.map(function (it, i) {
                var pl = splitPath(it.path), n = noteOf(K.k, it);
                return '<li><button type="button" class="df-row" data-dk-item="' + i + '" aria-haspopup="dialog" title="'
                    + esc(pl.line ? loc('dk.readAt', '讀這份文件，停在第 {n} 行', { n: pl.line }) : loc('dk.read', '讀這份文件')) + '">'
                    + '<span class="df-path">' + esc(pl.file) + (pl.line ? '<em>:' + pl.line + '</em>' : '') + '</span>'
                    + (it.tag ? '<span class="df-tag">' + esc(tagOf(it.tag)) + '</span>' : '')
                    + (n ? '<span class="df-note">' + n + '</span>' : '') + subOf(it) + '</button></li>';
            }).join('') + '</ol>';
        }
        var shown = items.length, cmd = 'node scripts/' + (K.k === 'unfiled' ? 'docs-check' : K.src) + '.js --root ' + p.dir;
        var count = K.k === 'unfiled' ? loc('dk.unfiledCount', 'docs-audit 數到 <b>{n}</b> 份；上面是 docs-check 列出的 doc root 底下 <b>{s}</b> 份', { n: num(c.n), s: shown })
            : shown < c.n ? loc('dk.shown', '列出前 <b>{s}</b> 條，共 <b>{n}</b> 條', { s: shown, n: num(c.n) }) : loc('dk.all', '共 <b>{n}</b> 條', { n: num(c.n) });
        return h + '<p class="df-ft"><span>' + count + '</span><span>' + loc('dk.full', '完整清單：') + '<code>' + esc(cmd) + '</code></span></p></div></section>';
    }

    // ---- dialogs: made once under <body>, outside #page, so a redraw never replaces them ----
    function dialogEl(id, cls, block, label, inner) {
        if (!doc) return null;
        var d = doc.getElementById(id);
        if (!d) {
            d = doc.createElement('dialog');
            d.id = id;
            if (doc.body) doc.body.appendChild(d);
        }
        if (!d.open) {
            d.className = cls;
            if (d.setAttribute) { d.setAttribute('data-block', block); d.setAttribute('aria-labelledby', label); }
            d.innerHTML = inner;
        }
        return d;
    }
    function showModal(d) { if (d && !d.open && typeof d.showModal === 'function') d.showModal(); }
    function closeBtn(extra) {
        return '<button type="button" class="tdlg-x" data-dk-close="1" aria-label="' + loc('dk.close', '關閉') + '" title="' + loc('dk.close', '關閉') + '"' + (extra || '') + '>' + ICO.x + '</button>';
    }

    // ---- the reader: one document in focus, the cited line marked; arrow keys walk the list ----
    function inline(s) {
        return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<span class="rd-a" title="$2">$1</span>');
    }
    // Markdown to blocks; every block remembers its first line, and the block holding `mark` is marked.
    function render(text, mark) {
        var L = String(text == null ? '' : text).split(/\r?\n/), i = 0, out = [], fm = null, j, l, a, m, e, n, rows, body, items, ol, q, p;
        var cells = function (r) { return r.trim().replace(/^\||\|$/g, '').split('|').map(function (c) { return c.trim(); }); };
        if (L[0] === '---') { j = 1; while (j < L.length && L[j] !== '---') j++; fm = L.slice(1, j); i = j + 1; }
        function blk(tag, from, to, html, cls) {
            var hit = mark && mark >= from && mark <= to;
            out.push('<' + tag + ' data-l="' + from + '"' + (hit || cls ? ' class="' + (cls || '') + (hit ? ' hl' : '') + '"' : '') + '>' + html + '</' + tag + '>');
        }
        while (i < L.length) {
            l = L[i];
            a = i + 1;
            if (!l.trim()) { i++; continue; }
            if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
            if (/^\s*```/.test(l)) {
                e = i + 1;
                while (e < L.length && !/^\s*```/.test(L[e])) e++;
                blk('pre', a, e + 1, '<code>' + esc(L.slice(i + 1, e).join('\n')) + '</code>');
                i = e + 1;
                continue;
            }
            if ((m = /^(#{1,6})\s+(.*)$/.exec(l))) { n = Math.min(m[1].length + 1, 5); blk('h' + n, a, a, inline(m[2])); i++; continue; }
            if (/^\s*\|/.test(l)) {
                rows = [];
                while (i < L.length && /^\s*\|/.test(L[i])) { rows.push(L[i]); i++; }
                body = rows.filter(function (r) { return !/^\s*\|[\s:|-]+\|\s*$/.test(r); });
                blk('div', a, i, '<table><thead><tr>' + cells(body[0]).map(function (c) { return '<th>' + inline(c) + '</th>'; }).join('') + '</tr></thead><tbody>'
                    + body.slice(1).map(function (r) { return '<tr>' + cells(r).map(function (c) { return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>'; }).join('')
                    + '</tbody></table>', 'rd-tw');
                continue;
            }
            if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
                items = [];
                ol = /^\s*\d+\./.test(l);
                while (i < L.length && L[i].trim() && (/^\s*([-*]|\d+\.)\s+/.test(L[i]) || /^\s{2,}\S/.test(L[i]))) {
                    if (/^\s*([-*]|\d+\.)\s+/.test(L[i])) items.push({ a: i + 1, t: L[i].replace(/^\s*([-*]|\d+\.)\s+/, '') });
                    else items[items.length - 1].t += ' ' + L[i].trim();
                    i++;
                }
                out.push('<' + (ol ? 'ol' : 'ul') + '>' + items.map(function (it) {
                    return '<li data-l="' + it.a + '"' + (mark === it.a ? ' class="hl"' : '') + '>' + inline(it.t) + '</li>';
                }).join('') + '</' + (ol ? 'ol' : 'ul') + '>');
                continue;
            }
            if (/^>/.test(l)) {
                q = [];
                while (i < L.length && /^>/.test(L[i])) { q.push(L[i].replace(/^>\s?/, '')); i++; }
                blk('blockquote', a, i, inline(q.join(' ')));
                continue;
            }
            p = [];
            while (i < L.length && L[i].trim() && !/^\s*(```|#{1,6}\s|\||([-*]|\d+\.)\s|>)/.test(L[i])) { p.push(L[i]); i++; }
            blk('p', a, i, inline(p.join(' ')));
        }
        var meta = {};
        (fm || []).forEach(function (f) { var mm = /^(\w+):\s*(.*)$/.exec(f); if (mm) meta[mm[1]] = mm[2]; });
        return { html: out.join(''), meta: meta };
    }
    function readerShell() {
        return '<div class="tdlg-in"><div class="tdlg-hd"><span class="rd-proj" id="rd-proj"></span><span class="rd-t" id="rd-t"></span><span class="rd-nav">'
            + '<button type="button" class="tdlg-x" id="rd-prev" data-dk-step="-1" aria-label="' + loc('dk.prev', '上一份') + '" title="' + loc('dk.prevTip', '上一份（←）') + '">' + ICO.prev + '</button>'
            + '<span class="rd-pos" id="rd-pos"></span>'
            + '<button type="button" class="tdlg-x" id="rd-next" data-dk-step="1" aria-label="' + loc('dk.next', '下一份') + '" title="' + loc('dk.nextTip', '下一份（→）') + '">' + ICO.next + '</button>'
            + closeBtn(' style="margin-left:6px"') + '</span></div>'
            + '<div class="rd-why" id="rd-why"></div><div class="tdlg-p"><div class="rd-meta" id="rd-meta"></div><div class="rd-body" id="rd-body"></div></div>'
            + '<div class="tdlg-ft"><span><kbd>←</kbd> <kbd>→</kbd> ' + loc('dk.walk', '換一份') + '</span><span class="rd-path" id="rd-path"></span></div></div>';
    }
    function show(text, line) {
        var r = render(text, line), body = doc.getElementById('rd-body');
        doc.getElementById('rd-meta').innerHTML = ['status', 'last_verified'].filter(function (k) { return r.meta[k]; }).map(function (k) {
            return '<span class="rd-fm"><i>' + k + '</i>' + esc(r.meta[k]) + '</span>';
        }).join('');
        body.innerHTML = r.html || '<p class="rd-load">' + loc('dk.empty', '這份文件是空的。') + '</p>';
        var hl = body.querySelector ? body.querySelector('.hl') : null;
        if (hl && hl.scrollIntoView) hl.scrollIntoView({ block: 'center' });
    }
    function openAt(i) {
        var it = st.list[i];
        if (!it || !doc) return;
        st.at = i;
        var d = dialogEl('dlg-read', 'tdlg rd', 'docs-reader', 'rd-t', readerShell());
        var g = function (id) { return doc.getElementById(id); }, pl = splitPath(it.path), n = ++st.readSeq;
        g('rd-proj').innerHTML = '<i class="sw" style="background:' + it.sw + '" aria-hidden="true"></i>' + esc(it.proj);
        g('rd-t').textContent = pl.file.split('/').pop();
        g('rd-pos').textContent = (i + 1) + ' / ' + st.list.length;
        g('rd-prev').disabled = i === 0;
        g('rd-next').disabled = i === st.list.length - 1;
        g('rd-why').innerHTML = it.why;
        g('rd-path').textContent = pl.file + (pl.line ? ':' + pl.line : '');
        g('rd-meta').innerHTML = '';
        g('rd-body').innerHTML = '<p class="rd-load">' + loc('dk.reading', '讀取中…') + '</p>';
        if (typeof fetch === 'function') {
            fetch('station/doc?pkey=' + encodeURIComponent(it.pkey) + '&path=' + encodeURIComponent(pl.file), { cache: 'no-store' }).then(function (r) {
                if (!r.ok) throw new Error(String(r.status));
                return r.text();
            }).then(function (text) {
                if (st.readSeq === n) show(text, pl.line);
            }, function () {
                if (st.readSeq === n) g('rd-body').innerHTML = '<p class="rd-load">' + loc('dk.unreadable', '讀不到這份文件。') + '</p>';
            });
        }
        showModal(d);
    }
    function fromCell(i) {
        var pick = selected();
        if (!pick) return;
        var r = pick.r, K = pick.K;
        st.list = (r.p.cells[K.k].items || []).map(function (it) {
            var n = noteOf(K.k, it);
            return { pkey: r.p.pkey, proj: r.name, sw: r.sw, path: it.path,
                why: '<b>' + K.l + '</b>' + (it.tag ? '<span>' + esc(tagOf(it.tag)) + '</span>' : '') + (n ? '<span>' + n + '</span>' : '') };
        });
        openAt(i);
    }
    function fromHits(i) {
        var q = st.res ? st.res.q : st.q;
        st.list = st.hits.map(function (x) {
            return { pkey: x.pkey, proj: x.project, sw: swOf(x.pkey), path: x.path,
                why: '<b>' + esc(loc('dk.hitWhy', '含「{q}」{n} 處', { q: q, n: x.count })) + '</b><span>' + esc(x.title || '') + '</span>' };
        });
        paintHits(null);
        openAt(i);
    }

    // ---- a project's map: the status split, what was planned and not built, where each kind is filed ----
    var STATUS = { current: 'var(--good)', planned: 'var(--p-0)', generated: 'var(--m-haiku)', undeclared: 'var(--stale)' };
    var HATCH = 'var(--hatch-bg) repeating-linear-gradient(45deg,var(--hatch) 0 1.3px,transparent 1.3px 4.5px)';
    function cardOf(pkey) {
        var out = null;
        ((st.S && st.S.projects) || []).forEach(function (r) { (r.docs || []).forEach(function (d) { if (d.pkey === pkey) out = d; }); });
        return out;
    }
    function projHtml(m) {
        if (!m) return '<p class="pd-none">' + loc('dk.noMap', '這個專案沒有 .fankeel/map.md；跑 <code>node scripts/map.js</code> 寫一份。') + '</p>';
        var b = m.buckets || [], planned = m.plannedNotBuilt || [], f = m.filing, tot = b.reduce(function (a, x) { return a + x.count; }, 0);
        var sw = function (l) { return 'background:' + (l === 'retired' ? HATCH : STATUS[l] || 'var(--muted)'); };
        var h = tot ? '<div class="split"><div class="split-h"><span>' + loc('dk.status', '狀態') + '</span><span class="num mono">' + loc('dk.mapCount', 'map 數到 {n} 份', { n: tot }) + '</span></div>'
            + '<div class="split-bar" role="img" aria-label="' + esc(b.map(function (x) { return x.label + ' ' + x.count; }).join(', ')) + '">'
            + b.map(function (x) { return '<i title="' + esc(x.label + ' ' + x.count) + '" style="flex:' + x.count + ' 1 0;' + sw(x.label) + '"></i>'; }).join('') + '</div>'
            + '<div class="split-leg">' + b.map(function (x) {
                return '<span><i class="sw" style="' + sw(x.label) + '"></i>' + esc(x.label) + ' <b>' + x.count + '</b><em>' + Math.round(x.count / tot * 100) + '%</em></span>';
            }).join('') + '</div></div>'
            : '<p class="pd-none">' + loc('dk.oldMap', '這份 map 是舊格式，沒有狀態統計；重跑 <code>node scripts/map.js</code> 會補上。') + '</p>';
        h += '<div class="pd-cols"><div><h3>' + loc('dk.planned', '還沒建') + ' <span>planned, not built · ' + planned.length + '</span></h3>'
            + (planned.length ? '<ul class="pd-list">' + planned.map(function (x) { return '<li title="' + esc(x) + '">' + esc(x) + '</li>'; }).join('') + '</ul>'
                : '<p class="pd-none">' + loc('dk.nothing', '沒有。') + '</p>') + '</div>'
            + '<div><h3>' + loc('dk.filing', '歸檔位置') + ' <span>' + (f ? 'index · ' + esc(f.index) : loc('dk.noTreeShort', '沒宣告文件樹')) + '</span></h3>'
            + (f && f.rows.length ? '<table class="pd-t"><tbody>' + f.rows.map(function (r) {
                return '<tr><td>' + esc(r.bucket) + '</td><td><span class="chip">' + esc(r.role) + '</span></td></tr>';
            }).join('') + '</tbody></table>' : '<p class="pd-none">' + loc('dk.allRef', '每份 markdown 都當 reference 檢查。') + '</p>') + '</div></div>';
        return h;
    }
    function openProject(i) {
        var r = projects()[i];
        if (!r || !doc) return;
        var m = cardOf(r.p.pkey);
        var inner = '<div class="tdlg-in"><div class="tdlg-hd"><span class="pd-name" id="pd-name"><i class="sw" style="background:' + r.sw + '" aria-hidden="true"></i>' + esc(r.name) + '</span>'
            + '<span class="pd-root">' + esc(r.p.dir) + '</span>' + closeBtn('') + '</div><div class="tdlg-p">' + projHtml(m) + '</div>'
            + '<div class="tdlg-ft"><span>' + loc('dk.mapAt', '<span class="mono">.fankeel/map.md</span> 生成於 <span class="mono">{t}</span>', { t: m ? when(m.generatedAt) : '—' }) + '</span></div></div>';
        showModal(dialogEl('dlg-proj', 'tdlg pd', 'docs-project', 'pd-name', inner));
    }

    // ---- the page and its listeners ----
    function page(S, o) {
        o = o || {};
        last = o;
        st.S = S;
        bind();
        var t = Date.now();
        if (o.serve && !st.loading && ((!st.data && !st.err) || t - st.drawnAt > VISIT_MS)) load(false);
        st.drawnAt = t;
        var pick = st.data ? selected() : null;
        return '<div class="dk" data-block="docs-page">' + headHtml()
            + '<div class="dash kdash dk-grid" data-block="docs-columns">'
            + '<div class="dcol" data-col="main" data-block="docs-main">' + healthHtml(o) + '</div>'
            + '<div class="dcol" data-col="side" data-block="docs-side">' + findingsHtml(pick) + '</div></div></div>';
    }
    function attr(t, sel, name) { var a = t.closest(sel); return a ? a.getAttribute(name) : null; }
    function onClick(e) {
        var t = e && e.target, v, a;
        if (!t || typeof t.closest !== 'function') return;
        if ((v = attr(t, '[data-dk-cell]', 'data-dk-cell')) !== null) {
            var s = v.split(' '), r = projects()[Number(s[0])];
            if (r) {
                st.sel = { pkey: r.p.pkey, k: s[1] };
                redraw();
                a = doc && doc.querySelector ? doc.querySelector('.dh-n.on') : null;
                if (a && a.focus) a.focus({ preventScroll: true });
            }
            return;
        }
        if ((v = attr(t, '[data-dk-item]', 'data-dk-item')) !== null) { fromCell(Number(v)); return; }
        if ((v = attr(t, '[data-dk-hit]', 'data-dk-hit')) !== null) { fromHits(Number(v)); return; }
        if ((v = attr(t, '[data-dk-proj]', 'data-dk-proj')) !== null) { openProject(Number(v)); return; }
        if ((a = t.closest('[data-dk-step]'))) { if (!a.disabled) openAt(st.at + Number(a.getAttribute('data-dk-step'))); return; }
        if ((a = t.closest('[data-dk-close]'))) { a = a.closest('dialog'); if (a && a.close) a.close(); return; }
        if (t.closest('[data-dk-run]')) { if (!st.loading) { load(true); redraw(); } return; }
        if (!t.closest('.dq')) paintHits(null);
    }
    function onInput(e) {
        var t = e && e.target;
        if (!t || t.id !== 'dq') return;
        var q = String(t.value || '').trim(), n = ++st.seq;
        st.q = q;
        if (st.timer && w && typeof w.clearTimeout === 'function') w.clearTimeout(st.timer);
        if (!q) { st.hits = []; st.res = null; paintHits(null); return; }
        var go = function () { ask(q, n); };
        if (w && typeof w.setTimeout === 'function') st.timer = w.setTimeout(go, 200);
        else go();
    }
    function onFocus(e) {
        var t = e && e.target;
        if (t && t.id === 'dq' && st.q && st.res) paintHits(st.res);
    }
    function onKey(e) {
        var t = e && e.target, rd = doc && doc.getElementById('dlg-read'), q;
        if (rd && rd.open && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
            var j = st.at + (e.key === 'ArrowLeft' ? -1 : 1);
            if (j >= 0 && j < st.list.length) { e.preventDefault(); openAt(j); }
            return;
        }
        q = doc && doc.getElementById('dq');
        if (!q) return;
        if (e.key === 'Escape') { paintHits(null); return; }
        if (e.key !== '/') return;
        if (t && t.closest && t.closest('input,textarea,select')) return;
        if (doc.querySelector && doc.querySelector('dialog[open]')) return;
        e.preventDefault();
        if (q.focus) q.focus();
    }
    function bind() {
        if (bound || !doc || typeof doc.addEventListener !== 'function') return;
        bound = true;
        doc.addEventListener('click', onClick);
        doc.addEventListener('input', onInput);
        doc.addEventListener('keydown', onKey);
        doc.addEventListener('focusin', onFocus);
    }
    function state() { return st; }
    function reset() { st = blank(); last = null; }

    var api = { page: page, render: render, onClick: onClick, onInput: onInput, onKey: onKey, state: state, reset: reset, EN: EN };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_DOCS = api;
}(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null));
```

5. Run `node --test --require ./tests/subprocess-timeout.js tests/station-docs-page.test.js tests/station-modules.test.js` and watch them pass. `station-modules` is only run here: the module is not in `assets/station/index.html` until Task 8, so it must not have changed. If `stringsLeft` names a line, the CJK literal on it is not the second argument of a `loc('dk.…', ` on that same line — key it; do not loosen the test.

6. Commit: `git add assets/station/docs-page.js assets/station/docs-page.css tests/station-docs-page.test.js` then `git commit -m "feat(station): FK_DOCS, the 文件 page as approved — health matrix, findings, reader, search popover, project map"`.

## Task 5: FK_SETTINGS 快速設定與共用題表

**Files:**
- Modify: `assets/station/settings-page.js` — 新檔：`#/settings` 的快速設定（5 組、預選推薦、來源標籤、全部套用推薦、舊→新寫入畫面、POST /profile），並輸出 settings-detail.js 要用的題表與工具
- Modify: `assets/station/settings-page.css` — 新檔：核可 mockup 第 265-400 行的 `qk-*` 規則原樣複製，加一條專案選單 `.qk-proj`
- Read: `tests/station-module.js` — `page(names, station, extra)` 在 vm 裡依 index.html 載入全部腳本再加上點名的模組；`stringsLeft(name, EN)`
- Read: `assets/station/project-page.js` — 模組形狀：IIFE、`EN` 表、`loc()`、`bind()` 第一次 `page()` 才掛監聽、`last.redraw()`、CJS 守衛
- Read: `.fankeel/build/2026-10-21-station-redesign/route-settings-quick.html` — 核可 mockup（gitignored；worktree 裡沒有，用 `F:/ymlab/fankeel/` 開頭的絕對路徑讀）
- Test: `tests/station-settings-quick.test.js`

**Interfaces:**
- Consumes: `FK_KIT`（`esc`、`fillVars`）；`/station/suggest`（Task 3，GET `station/suggest?project=<dir>`，回 Task 2 `suggestFor` 的結果 `{ front, recs: { <題 id>: { o, src: 'rec'|'author', v } }, commitFormat }`）；`profileSpec`（Task 3 加進 S；這頁不讀，詳細頁讀，同批送出才不會只有一半）；`/profile`（POST，form-urlencoded：`nonce`、`scope`、`project`、成對的 `key`/`value`；成功轉址 200）
- Produces: `FK_SETTINGS`；`FK_SETTINGS.page(S, opts)` → HTML 字串（`opts.hash` 以 `#/settings/detail` 開頭時轉給 `w.FK_SETDETAIL.page(S, opts)`）；`questions()` 即 `FK_SETTINGS.questions()` → 10 題 `[{ id, b, cond?, r, title, why, tip, from, skip?, opts: [{ o, t, e, s, w: {key: value}, risk?, cost?, note?, input? }] }]`（`w` 的值 `''` = 不設、`'$in'` = 使用者填的）；`NAME`（`NAME(k)` 與 `NAME[k]` 都可用）；`MACHINE`（只讀機器設定的 9 個鍵）；`cur(S, dir, k)` → 字串（dir 為假 = 這台機器）；`lab(k,v)` → 值的標籤；`optHtml(q, sel, recO, inp, pre)` → radiogroup HTML；`post(S, o, rows, done)`（`o = { scope, project }`、`rows = [{ k, to }]`、`done(ok)`）

**Dispatch:** implementer, sonnet, high — 程式碼都在計畫裡，但重繪後的焦點與游標（輸入框不重繪、radiogroup 方向鍵、`#qkb-*` 聚焦）與 suggest 非同步回來時只動沒被改過的題，stub DOM 測不到，要對著 mockup 的 runtime（第 553-773 行）推理。

這頁取代 station.js 裡的七步精靈要等 Task 9 接路由；這個任務只新增模組，什麼都不刪。CJK 字串一律是 `loc('sq.<key>', '…')`，`stringsLeft` 不收在 loc 外的中文字面值（所以 model.lang 寫入的「繁體中文」用 `String.fromCharCode` 拼）。

1. 寫失敗的測試。在 `tests/station-settings-quick.test.js`：

```js
'use strict';
// station-39: 設定 is the quick setup approved in route-settings-quick.html —
// five blocks, every question preselected from station/suggest with its
// source tag, 全部套用推薦, a final screen of old -> new split project and
// machine with commit.format behind a checkbox, POST /profile, a link to
// #/settings/detail — and FK_SETTINGS shares its question table.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { page, stringsLeft } = require('./station-module.js');

const DIR = 'F:\\ws\\app';
const SUG = {
    front: true, commitFormat: '^(chore|docs|feat|fix|merge)(\\([^)]+\\))?: ',
    recs: {
        main: { o: 'merge', src: 'rec', v: { local: 103, pr: 0 } }, push: { o: 'false', src: 'rec', v: { unpushed: 304 } },
        sessions: { o: 'many', src: 'rec', v: { n: 429, share: 28, peak: 6 } }, inflight: { o: '8', src: 'author', v: {} },
        ctx: { o: 'rw', src: 'rec', v: { from: 'tasks', n: 195 } }, lang: { o: 'zh', src: 'rec', v: { from: 'ui.lang' } },
        gates: { o: 'survey', src: 'author', v: {} }, floor: { o: 'sonnet', src: 'author', v: {} },
        screen: { o: 'opus', src: 'rec', v: { mockup: 'opus' } }, where: { o: 'away', src: 'rec', v: { from: 'notify.gate' } },
    },
};
const VALUES = { 'land.integration': 'merge', worktree: false, guard: 'ask', 'dispatch.inflight': 8, 'stage.agents': [], 'dispatch.floor': 'sonnet',
    'judge.model': 'fable', 'design.mockup': false, 'gate.station': 'off', 'gate.away': 'hint' };
const tick = () => new Promise((r) => setImmediate(r));

function boot(opts) {
    opts = opts || {};
    const calls = [];
    const fetch = (url, init) => {
        calls.push({ url, body: init && init.body ? String(init.body) : null });
        if (url.startsWith('station/suggest')) return Promise.resolve(opts.suggest === null ? { ok: false } : { ok: true, json: () => Promise.resolve(opts.suggest || SUG) });
        return Promise.resolve({ ok: opts.postOk !== false });
    };
    const projects = {};
    projects[DIR] = { values: Object.assign({}, VALUES), sources: {}, unreadable: [] };
    if (opts.second) projects['F:\\ws\\two'] = { values: {}, sources: {}, unreadable: [] };
    const S = { serve: opts.serve !== false, nonce: 'n1', profiles: { machine: { values: { 'notify.gate': false, 'station.remote': false }, sources: {}, unreadable: [] }, projects } };
    const p = page(['settings-page.js'], {}, { fetch });
    const Q = p.M['settings-page.js'];
    Q.reset();
    let draws = 0;
    const o = { hash: opts.hash || '#/settings', configDir: 'C:\\cfg', redraw: () => { draws++; } };
    const html = () => Q.page(S, o);
    return { Q, S, o, html, calls, draws: () => draws, win: p.win };
}
// A stand-in for an event target: chain[0] the element, then its ancestors, each a map of attributes.
function el(chain, extra) {
    const node = (i) => Object.assign({
        getAttribute: (k) => (Object.prototype.hasOwnProperty.call(chain[i], k) ? String(chain[i][k]) : null),
        setAttribute: (k, v) => { chain[i][k] = v; },
        closest(sel) { const k = sel.slice(1, -1); for (let j = i; j < chain.length; j++) if (Object.prototype.hasOwnProperty.call(chain[j], k)) return node(j); return null; },
    }, i === 0 ? extra : {});
    return node(0);
}
const ROOT = { 'data-sq': '' };
const click = (Q, chain) => Q.onClick({ target: el(chain.concat([ROOT])) });

test('every Chinese string is a loc() call with English, and every English entry is used', () => {
    const { Q } = boot();
    assert.deepEqual(stringsLeft('settings-page.js', Q.EN), []);
});

test('before station/suggest answers every question sits on the author default, tagged 作者推薦', () => {
    const { html } = boot({ serve: false });
    const h = html();
    assert.match(h, /data-block="quick-page"/);
    assert.equal((h.match(/class="qk-c(?: [a-z- ]+)?" data-b="/g) || []).length, 6, 'five blocks and the write screen in the rail');
    assert.match(h, /data-block="quick-q-main"[\s\S]*class="qk-src is-author"[^>]*>作者推薦</);
    assert.match(h, /class="v9-opt is-rec" role="radio" aria-checked="true" tabindex="0" data-o="merge"/);
    assert.match(h, /<a class="qk-dl" href="#\/settings\/detail">/);
});

test('station/suggest moves every untouched answer to its recommendation and tags it 依你的紀錄 with the evidence', async () => {
    const b = boot();
    b.html();
    assert.equal(b.calls[0].url, 'station/suggest?project=' + encodeURIComponent(DIR));
    await tick(); await tick();
    assert.ok(b.draws() >= 1, 'the answer redraws');
    const h = b.html();
    assert.match(h, /class="qk-src is-rec"[^>]*>依你的紀錄<\/button><span class="v9-tip qk-stip" role="tooltip" id="qks-main"><b>git 本機 merge 103 次、PR 0 個<\/b>/);
    assert.match(h, /id="qks-push"><b>git 有 304 個 commit 不在任何遠端<\/b>/);
    assert.match(h, /<b>每題都先選好推薦了<\/b><span>7 題依你的紀錄，3 題作者推薦；滑過標籤看根據<\/span>/);
    b.Q.state().at = 'parallel';
    const p2 = b.html();
    assert.match(p2, /aria-checked="true" tabindex="0" data-o="many"/);
    assert.match(p2, /id="qks-inflight"><b>fankeel 預設；沒有足夠的紀錄可以推<\/b>/);
    b.Q.state().at = 'ctx';
    const h3 = b.html();
    assert.match(h3, /id="qks-ctx"><b>最近 195 個記下設定的任務多半這樣跑<\/b>/);
    assert.match(h3, /id="qks-lang"><b>紀錄：from ui\.lang<\/b>/, 'a tip whose var this shape lacks shows the raw record');
});

// Every v shape lib/settingsuggest.js suggestFor (Task 2) returns, per question.
const SHAPES = {
    main: [{ local: 1, pr: 0 }], push: [{ unpushed: 1 }], sessions: [{ peak: 2, share: 30, n: 5 }], inflight: [{ now: 8 }],
    ctx: [{ from: 'profile' }, { from: 'tasks', n: 3 }], lang: [{ lang: 'en' }, { from: 'ui.lang' }], gates: [{ cls: 'bounded' }],
    floor: [{ floor: 'sonnet' }], screen: [{ mockup: 'opus' }], where: [{ from: 'notify.gate' }, { wait: '120' }, { from: 'gate.away' }],
};

test('every tip names only variables station/suggest returns for its question', () => {
    const { Q } = boot();
    const qs = Q.questions();
    assert.deepEqual(qs.map((q) => q.id).sort(), Object.keys(SHAPES).sort());
    for (const q of qs) {
        const vars = (q.tip.match(/\{\w+\}/g) || []).map((x) => x.slice(1, -1));
        assert.ok(SHAPES[q.id].some((v) => vars.every((x) => Object.prototype.hasOwnProperty.call(v, x))), q.id + ': ' + q.tip);
    }
});

test('a question the user moved keeps its answer when the recommendation lands; push hides under a PR', async () => {
    const b = boot();
    b.html();
    click(b.Q, [{ 'data-o': 'pr' }, { 'data-q': 'main' }]);
    await tick(); await tick();
    const h = b.html();
    assert.match(h, /aria-checked="true" tabindex="0" data-o="pr"/);
    assert.doesNotMatch(h, /data-q="push"/);
    assert.match(h, /發 PR 一律會推、分支留著一律不推，所以不問推不推。/);
    assert.match(h, /<b>你改了 1 題推薦<\/b>/);
});

test('the screen question shows only when a frontend was found', async () => {
    const b = boot({ suggest: Object.assign({}, SUG, { front: false }) });
    b.html();
    await tick(); await tick();
    b.Q.state().at = 'verify';
    assert.doesNotMatch(b.html(), /data-q="screen"/);
    const c = boot();
    c.html();
    await tick(); await tick();
    c.Q.state().at = 'verify';
    assert.match(c.html(), /data-q="screen"/);
});

test('全部套用推薦 opens the write screen: old -> new for the project, the machine card, commit.format behind its box', async () => {
    const b = boot();
    b.html();
    await tick(); await tick();
    click(b.Q, [{ 'data-all': '' }]);
    assert.equal(b.Q.state().at, 'final');
    let h = b.html();
    assert.match(h, /data-block="quick-final"/);
    const proj = h.slice(h.indexOf('<div data-fin>'), h.indexOf('這台機器 · '));
    assert.match(proj, /<b>專案 · 8 項<\/b><code title="F:\\ws\\app\\.fankeel\\profile.json">/);
    assert.match(proj, /<span class="v9-fk"[^>]*>開 worktree<\/span>[\s\S]*?<s title="不開">不開<\/s>[\s\S]*?<b title="一律">一律<\/b>/);
    assert.match(proj, /<code>stage.agents: survey,build,verify<\/code>/);
    assert.doesNotMatch(proj, /land\.integration/, 'a value already set is not listed');
    assert.match(h, /<b>這台機器 · 0 項<\/b><code title="C:\\cfg\\fankeel\\profile.json">[\s\S]*還沒確認。<button type="button" data-go="away">/);
    assert.doesNotMatch(proj, /commit\.format/);
    b.Q.onChange({ target: el([{ 'data-cf': '', }, ROOT], { checked: true }) });
    h = b.html();
    assert.match(h, /<code>commit\.format: \^\(chore\|docs\|feat\|fix\|merge\)/);
    assert.match(h, /<p class="qk-more">要逐項調整？<a href="#\/settings\/detail">進入詳細設定<\/a><\/p>/);
});

test('the machine card keeps 手機遠端 checked and tagged 待定, and writes only after 確認', async () => {
    const b = boot();
    b.html();
    await tick(); await tick();
    b.Q.state().at = 'away';
    let h = b.html();
    assert.match(h, /data-mk="station.remote" checked>[\s\S]*?<span class="v9-tag pend"[^>]*>待定<\/span>/);
    assert.match(h, /寫進 C:\\cfg\\fankeel\\profile.json。/);
    click(b.Q, [{ 'data-mc': 'yes' }]);
    b.Q.state().at = 'final';
    h = b.html();
    assert.match(h, /<b>這台機器 · 2 項<\/b>/);
    assert.match(h, /<s title="關">關<\/s>[\s\S]*?<b title="開">開<\/b>/);
});

test('寫入 posts the project, then the machine, and the screen says what was written', async () => {
    const b = boot();
    b.html();
    await tick(); await tick();
    click(b.Q, [{ 'data-all': '' }]);
    click(b.Q, [{ 'data-mc': 'yes' }]);
    b.Q.state().at = 'final';
    assert.match(b.html(), /data-write>寫入 10 項</);
    click(b.Q, [{ 'data-write': '' }]);
    await tick(); await tick(); await tick();
    const posts = b.calls.filter((c) => c.url === 'profile').map((c) => new URLSearchParams(c.body));
    assert.equal(posts.length, 2);
    assert.equal(posts[0].get('scope'), 'project');
    assert.equal(posts[0].get('project'), DIR);
    assert.equal(posts[0].get('nonce'), 'n1');
    assert.equal(posts[0].getAll('value')[posts[0].getAll('key').indexOf('stage.agents')], 'survey,build,verify');
    assert.equal(posts[0].getAll('value')[posts[0].getAll('key').indexOf('model.lang')], '繁體中文');
    assert.equal(posts[1].get('scope'), 'machine');
    assert.deepEqual(posts[1].getAll('key'), ['notify.gate', 'station.remote']);
    const h = b.html();
    assert.match(h, /已寫入 10 項。/);
    assert.match(h, /<b>專案 · 0 項<\/b>[\s\S]*跟現在一樣，沒有要改的。/, 'what was written reads as set');
    assert.equal(b.Q.cur(b.S, DIR, 'stage.agents'), 'survey,build,verify');
});

test('a failed write says so and the page stays put; unserved, 寫入 is off', async () => {
    const b = boot({ postOk: false });
    b.html();
    await tick(); await tick();
    click(b.Q, [{ 'data-all': '' }]);
    click(b.Q, [{ 'data-write': '' }]);
    await tick(); await tick();
    assert.match(b.html(), /寫入專案的設定失敗，那邊沒有存。/);
    const u = boot({ serve: false });
    u.html();
    click(u.Q, [{ 'data-all': '' }]);
    const h = u.html();
    assert.match(h, /data-write disabled>/);
    assert.match(h, /這頁不是經由監控站伺服器開的，不能寫入。/);
    assert.equal(u.calls.length, 0, 'an unserved page asks nothing');
});

test('typing another language changes the plan without a redraw', () => {
    const b = boot({ serve: false });
    b.html();
    b.Q.state().at = 'ctx';
    const before = b.draws();
    b.Q.onInput({ target: el([{ 'data-in': '' }, { 'data-field': 'other' }, { 'data-q': 'lang' }, ROOT], { value: '日本語' }) });
    assert.equal(b.draws(), before);
    assert.equal(b.Q.state().ans.lang, 'other');
    click(b.Q, [{ 'data-go': 'final' }]);
    assert.match(b.html(), /<code>model\.lang: 日本語<\/code>/);
});

test('more than one project gets a picker; picking one starts that project over', () => {
    const b = boot({ serve: false, second: true });
    assert.match(b.html(), /<select data-sq-proj><option value="F:\\ws\\app" selected>/);
    b.Q.onChange({ target: el([{ 'data-sq-proj': '' }, ROOT], { value: 'F:\\ws\\two' }) });
    assert.equal(b.Q.state().dir, 'F:\\ws\\two');
    assert.equal(b.Q.state().at, 'land');
});

test('#/settings/detail goes to FK_SETDETAIL', () => {
    const b = boot({ hash: '#/settings/detail/push' });
    b.win.FK_SETDETAIL = { page: (S, o) => 'detail ' + o.hash };
    assert.equal(b.html(), 'detail #/settings/detail/push');
});

test('the shared table: ten questions in screen order, key names, labels, the merged value as a string', () => {
    const { Q, S } = boot();
    assert.deepEqual([...Q.questions().map((q) => q.id)], ['main', 'push', 'sessions', 'inflight', 'ctx', 'lang', 'gates', 'floor', 'screen', 'where']);
    assert.deepEqual([...Q.MACHINE], ['station.remote', 'notify.gate', 'notify.stage', 'notify.end', 'notify.server', 'phone.hold', 'ui.lang', 'station.chartroom', 'quota.week']);
    assert.equal(Q.NAME('land.push'), '推不推遠端');
    assert.equal(Q.NAME['land.push'], '推不推遠端');
    assert.equal(Q.NAME('notify.topic'), 'notify.topic');
    assert.equal(Q.lab('land.push', ''), '每次問');
    assert.equal(Q.lab('guard', 'deny'), '擋下');
    assert.equal(Q.lab('commit.format', ''), '未設');
    assert.equal(Q.cur(S, DIR, 'stage.agents'), '');
    assert.equal(Q.cur(S, DIR, 'worktree'), 'false');
    assert.equal(Q.cur(S, null, 'notify.gate'), 'false');
    assert.match(Q.optHtml(Q.questions()[0], 'pr', 'merge', {}, 'v9'), /aria-labelledby="v9q-main"[\s\S]*class="v9-risk">[\s\S]*推到遠端/);
});

test('settings-page.css is the quick mockup\'s own rules, no <style> tags', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'settings-page.css'), 'utf8');
    assert.doesNotMatch(css, /<\/?style/);
    for (const rule of ['.qk-src.is-rec{', '.qk-recs{', '.qk-mc{', '.qk-extra{', '.qk-proj{']) assert.ok(css.includes(rule), rule);
});
```

2. 跑 `node --test tests/station-settings-quick.test.js`，看 14 個全部失敗（`settings-page.js` 還不存在，`page()` 讀檔丟 ENOENT）。
3. 寫 `assets/station/settings-page.css`：用核可 mockup 的樣式原樣複製，不加 `<style>`。mockup 第 23-264 行的 v9 共用規則（`.v9-opt`、`.v9-tip`、`.v9-mc`、`.v9-fin-*`⋯）不在這裡，由 Task 7 放進 `settings-detail.css`（兩份 mockup 的這段逐字相同）；兩張表都由 Task 8 載入。

```sh
sed -n '265,400p' F:/ymlab/fankeel/.fankeel/build/2026-10-21-station-redesign/route-settings-quick.html > assets/station/settings-page.css
```

   接著在 `assets/station/settings-page.css` 檔尾加上專案選單（mockup 只有一個專案，沒畫這個）：

```css

/* the project picker when more than one project has a profile */
.qk-proj{display:flex;align-items:center;gap:8px;margin:0 0 12px;font-size:13px;color:var(--ink2)}
.qk-proj select{min-width:0;max-width:100%;height:36px;border:0;border-radius:7px;background:var(--inset);box-shadow:inset 0 0 0 1px var(--rule);color:var(--ink);font:13px var(--f-mono)}
```

   檢查：`head -1 assets/station/settings-page.css` 是 `/* ==== quick ==== */`，`grep -c '</style>' assets/station/settings-page.css` 是 0。
4. 寫 `assets/station/settings-page.js`。mockup runtime 的對照：`plan()`/`changes()`/`machine()`/`srcText()` → 同名函式；`paintQ`、`paintCard`、`paintFinal`、`paintRail`、`paintStrip`、`paintFoot` → 回 HTML 字串的 `qHtml`、`cardHtml`、`finalHtml`、`railHtml`、`stripHtml`、`footHtml`，由 `page()` 一次畫完；mockup 的 `qk-data` JSON 拆成 `questions()`（題目與寫入）、`NAME`（`name`）、`lab()`（`vl`）、`cur()`（`cur`/`mcur`，改讀 `S.profiles`）。

   在 `assets/station/settings-page.js`：

```js
'use strict';
// assets/station/settings-page.js — 設定 `#/settings`: the quick setup approved
// in .fankeel/build/2026-10-21-station-redesign/route-settings-quick.html
// (station-39). Five blocks, one a screen; every question starts on the
// recommendation GET station/suggest?project= answers (the author's defaults
// until it does, or when the page is not served), tagged 依你的紀錄 or 作者推薦
// with the evidence in a tip; 全部套用推薦; a final screen of old -> new, the
// project's file and this machine's apart, commit.format behind a checkbox;
// 寫入 posts /profile once a scope. `#/settings/detail…` goes to
// w.FK_SETDETAIL. The question table, the key names, cur/lab/optHtml and the
// post are shared with settings-detail.js through FK_SETTINGS. The poll does
// not repaint #/settings (station.js), so the page redraws only on a click.
(function (w, doc) {
    var EN = {
        'sq.bLand': 'How changes land', 'sq.bParallel': 'How much runs at once', 'sq.bCtx': 'Main thread and reports',
        'sq.bVerify': 'Verification and cost', 'sq.bAway': 'Away from the computer',
        'sq.riskPush': 'pushes to the remote', 'sq.riskLoad': 'API usage, file clashes', 'sq.cost': 'costs more',
        'sq.mainR': 'How changes reach main', 'sq.mainT': 'How do your changes reach main?',
        'sq.mainY': 'Nothing warns you when this is wrong, so it comes first. The three branch answers open a worktree for each task.',
        'sq.mainSkip': 'A PR always pushes and a kept branch never does, so push is not asked.',
        'sq.mainTip': 'git: {local} local merges, {pr} pull requests',
        'sq.mainFrom': 'Source: task.js profile suggest (git log --merges, the registered land records)',
        'sq.mainDirect': 'Commit straight on the current branch', 'sq.mainDirectE': 'No branch; land merges nothing', 'sq.mainDirectS': 'commit directly',
        'sq.mainMerge': 'Branch, merge back locally', 'sq.mainMergeE': 'A worktree per task, merged at land', 'sq.mainMergeS': 'local merge',
        'sq.mainPr': 'Branch and open a PR, merged after review', 'sq.mainPrE': 'Pushed and a PR opened at land', 'sq.mainPrS': 'open a PR',
        'sq.mainKeep': 'Keep the branch, I integrate', 'sq.mainKeepE': 'Land leaves the branch alone', 'sq.mainKeepS': 'keep the branch',
        'sq.pushR': 'Push or not', 'sq.pushT': 'Once merged back, push to the remote?',
        'sq.pushY': 'A push cannot be taken back. Not asked when the answer above is a PR or a kept branch.',
        'sq.pushTip': 'git: {unpushed} commits are on no remote',
        'sq.pushFrom': 'Source: task.js profile suggest (git log --not --remotes, the registered land records)',
        'sq.pushTrue': 'Push', 'sq.pushTrueE': 'Pushed after land, never asked', 'sq.pushTrueS': 'push',
        'sq.pushFalse': 'No, I push myself', 'sq.pushFalseE': 'Commits stay on this machine', 'sq.pushFalseS': 'no push',
        'sq.pushAsk': 'Ask me each time', 'sq.pushAskE': 'Asked at land', 'sq.pushAskS': 'ask each time',
        'sq.sessR': 'Sessions at once', 'sq.sessT': 'How many sessions do you open on one repo at once?',
        'sq.sessY': 'Two sessions overwriting each other is silent; different worktrees do not clash. The value is fixed when a task starts.',
        'sq.sessTip': '{n} sessions: two or more at once {share}% of the time, at most {peak} at once',
        'sq.sessFrom': 'Source: how the started and ended of each session in .fankeel/sessions overlap',
        'sq.sessWt': 'The branch answers already open a worktree per task; clashes happen almost only in one checkout.',
        'sq.sessOne': 'Usually one', 'sq.sessOneE': 'Rarely clashes; asks you when one file is shared', 'sq.sessOneS': 'one',
        'sq.sessSome': 'Two or three now and then', 'sq.sessSomeE': 'Stops and asks you when one file is shared', 'sq.sessSomeS': 'two or three',
        'sq.sessMany': 'Several, routinely', 'sq.sessManyE': 'Every task gets its own worktree; a clash is blocked', 'sq.sessManyS': 'several',
        'sq.inflR': 'Agents at once', 'sq.inflT': 'How many agents may one reply dispatch at once?',
        'sq.inflY': 'More agents than this from one reply and it stops to ask. It guards API usage, the main context and file clashes in a shared checkout, not the CPU.',
        'sq.inflTip': 'dispatch.inflight is {now} in .fankeel/profile.json',
        'sq.inflFrom': 'Source: dispatch.inflight in .fankeel/profile.json (8 when unset)',
        'sq.infl4': '4', 'sq.infl4E': 'When the API often throttles or a shared checkout often clashes',
        'sq.infl6': '6', 'sq.infl6E': 'A little more careful than the default',
        'sq.infl8': '8', 'sq.infl8E': 'Enough for most work',
        'sq.infl12': '12', 'sq.infl12E': 'Large parallel work; asks only past 12',
        'sq.ctxR': 'Stages handed off', 'sq.ctxT': 'On a long task, should the main thread keep the detail?',
        'sq.ctxY': 'A handed-off stage runs in a clean context; the main thread receives only paths and gates.',
        'sq.ctxTip': 'Most of the {n} recent tasks that recorded their settings ran this way',
        'sq.ctxFrom': 'Source: stage.agents in .fankeel/profile.json, the profile in .fankeel/sessions',
        'sq.ctxNone': 'Keep it, every stage in the main thread', 'sq.ctxNoneE': 'Clearest to follow; the context keeps growing', 'sq.ctxNoneS': 'keep the detail',
        'sq.ctxRw': 'Hand off reading and doing', 'sq.ctxRwE': 'survey, build and verify open a clean context',
        'sq.ctxAll': 'Hand off everything', 'sq.ctxAllE': 'The main thread only passes paths; good from a phone',
        'sq.langR': 'Report language', 'sq.langT': 'What language do handed-off stages write reports and gates in?',
        'sq.langY': 'Stage agents use it for reports and gates; with no stage handed off almost nothing reads it. Unset is English.',
        'sq.langTip': 'model.lang is already {lang}',
        'sq.langFrom': 'Source: model.lang in .fankeel/profile.json, ui.lang on this machine',
        'sq.langZh': 'Traditional Chinese', 'sq.langZhE': 'The same as this conversation', 'sq.langEnE': 'What unset means',
        'sq.langOther': 'Another language', 'sq.langOtherE': 'Type the language name', 'sq.langOtherS': 'other',
        'sq.langName': 'Language name', 'sq.langPh': 'Japanese',
        'sq.gatesR': 'Stages to pass', 'sq.gatesT': 'How many stages must a change pass to be done?',
        'sq.gatesY': 'This is the route a task takes when started without a class. No spike: it runs no verify and no land; start one with --class spike.',
        'sq.gatesTip': 'Tasks here default to class {cls}',
        'sq.gatesFrom': 'Source: task.js profile suggest, class.default in .fankeel/profile.json',
        'sq.gatesSurvey': 'Let survey decide from the task', 'sq.gatesSurveyE': 'Starts from 7 stages, trimmed to the task', 'sq.gatesSurveyS': 'survey decides',
        'sq.gatesBounded': 'Design, build, verify, land', 'sq.gatesBoundedE': 'Every task runs verify; no plan', 'sq.gatesBoundedS': '5 stages',
        'sq.gatesArch': 'All 7 stages', 'sq.gatesArchE': 'A plan and an audit every time; agents at least opus', 'sq.gatesArchS': '7 stages',
        'sq.floorR': 'Agents: cheap or steady', 'sq.floorT': 'Should dispatched agents save money or play safe?',
        'sq.floorY': 'Agents means implementers, readers and reviewers; the mockup model is not this. A wrong pick costs money, which you can see and change any time.',
        'sq.floorTip': 'dispatch.floor is already {floor}',
        'sq.floorFrom': 'Source: dispatch.floor in .fankeel/profile.json',
        'sq.floorHaiku': 'Save: haiku for small work', 'sq.floorHaikuE': 'Cheapest; complex work may suffer', 'sq.floorHaikuS': 'save',
        'sq.floorSonnet': 'Balanced', 'sq.floorSonnetE': 'At least sonnet; architectural raises to opus',
        'sq.floorOpus': 'Steady: opus and above', 'sq.floorOpusE': 'About twice the cost', 'sq.floorOpusS': 'steady',
        'sq.screenR': 'Mockups or not', 'sq.screenT': 'Does this repo have screens?',
        'sq.screenY': 'Asked only when a frontend is found. Mockups are always drawn by opus or above.',
        'sq.screenTip': 'design.mockup is already {mockup}',
        'sq.screenFrom': 'Source: git ls-files, design.mockup in .fankeel/profile.json',
        'sq.screenNo': 'No, nothing to draw', 'sq.screenNoE': 'The design stage draws no page', 'sq.screenNoS': 'no mockup',
        'sq.screenAsk': 'Yes, ask me each time', 'sq.screenAskE': 'Frontend work asks before drawing a mockup', 'sq.screenAskS': 'ask, then draw',
        'sq.screenAuto': 'Yes, just draw', 'sq.screenAutoE': 'Draws without asking and opens the page', 'sq.screenAutoS': 'draw',
        'sq.whereR': 'Where you are at a gate', 'sq.whereT': 'Where are you, mostly, when a gate waits for you?',
        'sq.whereY': 'Mostly friction. Away also writes this machine\'s settings, shown first and confirmed apart.',
        'sq.whereTip': '{from} is already set this way',
        'sq.whereFrom': 'Source: this machine\'s profile.json (notify.gate), gate.station and gate.away in .fankeel/profile.json',
        'sq.whereTerm': 'At the terminal', 'sq.whereTermE': 'Asked right in the terminal', 'sq.whereTermS': 'at the terminal',
        'sq.whereStation': 'The station open beside me', 'sq.whereStationE': 'A gate waits on the station for 2 minutes first', 'sq.whereStationS': 'station open',
        'sq.whereAway': 'Often away, on my phone', 'sq.whereAwayE': 'Works to the next decision of yours, compacts and stops', 'sq.whereAwayS': 'often away',
        'sq.whereAwayN': 'You will also be asked whether to write this machine\'s push and phone remote.',
        'sq.tipRaw': 'Record: {facts}', 'sq.tipAuthor': 'fankeel default; not enough record to go on',
        'sq.srcRec': 'From your record', 'sq.srcAuthor': 'Author\'s pick', 'sq.srcMine': 'Your pick', 'sq.rec': 'Recommended',
        'sq.whyAsk': 'Why this is asked', 'sq.typed': '(what you type)', 'sq.notSet': '(unset)', 'sq.unset': 'unset',
        'sq.nInteg': 'Into main', 'sq.nPush': 'Push to remote', 'sq.nArchive': 'Archive the plan', 'sq.nCommit': 'Commit format',
        'sq.nWorktree': 'Open a worktree', 'sq.nGuard': 'On a clash', 'sq.nInflight': 'Agents at once', 'sq.nClass': 'Stages to pass',
        'sq.nFloor': 'Agent model', 'sq.nJudge': 'Judge model', 'sq.nAgents': 'Stages handed off', 'sq.nLang': 'Report language',
        'sq.nGateStation': 'Gate waits on the station', 'sq.nGateAway': 'Before leaving', 'sq.nMockup': 'Draw mockups',
        'sq.nNotifyGate': 'Gate push', 'sq.nRemote': 'Phone remote',
        'sq.vMerge': 'local merge', 'sq.vPr': 'open a PR', 'sq.vKeep': 'keep the branch', 'sq.vWtNo': 'none', 'sq.vWtBounded': 'bounded and up',
        'sq.vWtAll': 'always', 'sq.vAsk': 'ask you', 'sq.vDeny': 'block', 'sq.vWarn': 'warn only', 'sq.vNoWait': 'no wait', 'sq.v2m': '2 min',
        'sq.v5m': '5 min', 'sq.vHint': 'hint', 'sq.vAskOne': 'one more question', 'sq.vArchive': 'archive', 'sq.vKeepPlan': 'keep', 'sq.vOn': 'on', 'sq.vOff': 'off',
        'sq.mNow': 'This machine now: {v}', 'sq.mcH': 'Also write to this machine', 'sq.thisMachine': 'This machine',
        'sq.mcWhy': 'Written to {file}. Only the machine settings are read for these two; the project file has no effect. Written only after you confirm.',
        'sq.mcAsk': 'What this card writes', 'sq.mcGate': 'Push to my phone when a gate waits', 'sq.mcRemote': 'Reach the station from my phone',
        'sq.pend': 'Pending', 'sq.pendTip': 'Remote options other than Tailscale are still being evaluated',
        'sq.pendNote': 'How it connects is pending: options other than Tailscale are still being evaluated',
        'sq.mcOk': 'Confirm, write to this machine', 'sq.mcNot': 'Not now',
        'sq.mcYes': 'Written to this machine along with the rest.', 'sq.mcSame': 'This machine is already set so; nothing is rewritten.',
        'sq.mcNo': 'This machine keeps its settings.', 'sq.mcBoth': 'Both are already on on this machine.',
        'sq.finG': '{g} · {n} items', 'sq.gProject': 'Project',
        'sq.finMNot': 'Not written: where you are at a gate is not away.', 'sq.finMPend': 'Not confirmed yet.',
        'sq.finMBack': 'Confirm under Away from the computer', 'sq.finMNo': 'Not written: you chose not now under Away from the computer.',
        'sq.finMSame': 'Nothing to write: push and the phone remote are already on here.', 'sq.finSame': 'The same as now; nothing to change.',
        'sq.cfFrom': 'the commit format in git', 'sq.from': 'From: {r}', 'sq.to': 'becomes',
        'sq.finT': 'Write these changes?', 'sq.finY': 'Only Write touches profile.json. The project and this machine are written apart; a value already set is not rewritten.',
        'sq.finAsk': 'What is written', 'sq.cfL': 'Also check the first line of each commit',
        'sq.cfTip': 'Recent first lines in git mostly follow this format', 'sq.cfSrc': 'Source: task.js profile suggest (git log --no-merges -n 50)',
        'sq.cfN': 'Unticked, nothing is written. The format from git had no merge; it is added here, or it would block land.js merge.',
        'sq.finN': 'Settings not asked here (sensitive-data review, agents at once, push server...) keep their values.',
        'sq.more': 'Adjust one by one? ', 'sq.detail': 'Open the detailed settings', 'sq.detailS': 'One screen a setting, adjusted one at a time',
        'sq.wrote': 'Wrote {n} items.', 'sq.failP': 'Writing the project settings failed; nothing there was saved.',
        'sq.failM': 'Writing this machine\'s settings failed; nothing there was saved.',
        'sq.unserved': 'This page was not opened through the station server, so it cannot write.',
        'sq.stripMine': 'You changed {n} recommendations', 'sq.stripAll': 'Every question starts on a recommendation',
        'sq.stripSub': '{r} from your record, {a} the author\'s pick; {tail}', 'sq.stripBack': 'the button on the right puts them all back',
        'sq.stripFinal': 'below is what the recommendations change', 'sq.stripHover': 'hover a tag for the evidence',
        'sq.all': 'Apply every recommendation', 'sq.allDone': 'Recommendations applied',
        'sq.toFinal': 'Check and write', 'sq.next': 'Next: {n}', 'sq.prev': 'Previous', 'sq.writing': 'Writing...', 'sq.wroteAll': 'Written',
        'sq.writeN': 'Write {n} items', 'sq.nothing': 'Nothing to write', 'sq.posFinal': 'Check before writing', 'sq.pos': 'Group {i} of {n}',
        'sq.railH': 'Quick setup', 'sq.railS': '5 groups · about 1 minute', 'sq.railIx': 'Groups of the quick setup',
        'sq.nChg': '{n} changes', 'sq.noChg': 'No changes', 'sq.proj': 'Project',
        'sq.noProject': 'No project to set up yet: start a fankeel task in a project first.', 'sq.noDetail': 'The detailed settings are not loaded.',
    };
    function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    function kit() { return (w && w.FK_KIT) || {}; }
    function loc(key, zh, vars) {
        var I = w && w.FK_I18N, s = I && I.lang === 'en' && has(EN, key) ? EN[key] : zh;
        return kit().fillVars ? kit().fillVars(s, vars) : s;
    }
    function esc(s) { return kit().esc(s); }

    var MACHINE = ['station.remote', 'notify.gate', 'notify.stage', 'notify.end', 'notify.server', 'phone.hold', 'ui.lang', 'station.chartroom', 'quota.week'];
    var AUTHOR = { main: 'merge', push: 'false', sessions: 'some', inflight: '8', ctx: 'rw', lang: 'en', gates: 'survey', floor: 'sonnet', screen: 'opus', where: 'term' };
    // model.lang's value is the language's own name, written untranslated; spelt in code points
    // because a Chinese literal outside loc() fails stringsLeft (tests/station-module.js).
    var ZH = String.fromCharCode(0x7e41, 0x9ad4, 0x4e2d, 0x6587);
    var ORDER = ['land', 'parallel', 'ctx', 'verify', 'away', 'final'];
    var CHECK = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5 6.5 11.5 12.5 5"/></svg>';
    var WARN = '<svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.2 14.2 13H1.8z"/><path d="M8 6.5v3M8 11.3v.01"/></svg>';
    var SAVE = '<svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2.5h7.5L13 5v8.5H3z"/><path d="M5.5 2.5v3h4v-3M5.5 13.5V9.5h5v4"/></svg>';
    var ARROW = '<svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h9.5M9 4.5 12.5 8 9 11.5"/></svg>';
    var CHEVRON = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 6.2 8 9.8l3.5-3.6"/></svg>';

    // One answer: o its id, t label, e effect, s the short form (rail, lab), w the keys it writes
    // ('$in' = what is typed, '' = unset); x adds risk (text), cost, note, input.
    function O(o, t, e, s, wr, x) {
        var r = { o: o, t: t, e: e, s: s || t, w: wr };
        if (x) for (var k in x) if (has(x, k)) r[k] = x[k];
        return r;
    }
    // The ten quick questions in screen order: id, b (block), cond ('push' | 'front'), r (short
    // name), title, why, tip (evidence with {vars} from the recommendation's v), from, skip, opts.
    function questions() {
        var push = loc('sq.riskPush', '推到遠端'), wt = loc('sq.sessWt', '開分支的答案已經替任務開 worktree，撞檔幾乎只發生在同一個 checkout。');
        return [
            { id: 'main', b: 'land', r: loc('sq.mainR', '怎麼進 main'), title: loc('sq.mainT', '你的改動怎麼進 main？'),
                why: loc('sq.mainY', '錯了不會有任何提示，所以排第一。開分支的三個答案會替任務開 worktree。'),
                skip: loc('sq.mainSkip', '發 PR 一律會推、分支留著一律不推，所以不問推不推。'),
                tip: loc('sq.mainTip', 'git 本機 merge {local} 次、PR {pr} 個'),
                from: loc('sq.mainFrom', '來源：task.js profile suggest（git log --merges、登錄的 land 紀錄）'), opts: [
                    O('direct', loc('sq.mainDirect', '直接 commit 在目前分支'), loc('sq.mainDirectE', '不開分支，收尾不用 merge'), loc('sq.mainDirectS', '直接 commit'), { worktree: 'false', 'land.integration': 'merge' }),
                    O('merge', loc('sq.mainMerge', '開分支，本機 merge 回來'), loc('sq.mainMergeE', '每個任務一個 worktree，收尾自動 merge'), loc('sq.mainMergeS', '本機 merge'), { worktree: 'bounded', 'land.integration': 'merge' }),
                    O('pr', loc('sq.mainPr', '開分支發 PR，review 過才合'), loc('sq.mainPrE', '收尾時推上去開 PR'), loc('sq.mainPrS', '發 PR'), { worktree: 'bounded', 'land.integration': 'pr', 'land.push': 'true' }, { risk: push }),
                    O('keep', loc('sq.mainKeep', '分支留著，我自己整合'), loc('sq.mainKeepE', '收尾時分支不動'), loc('sq.mainKeepS', '分支留著'), { worktree: 'bounded', 'land.integration': 'keep', 'land.push': 'false' })] },
            { id: 'push', b: 'land', cond: 'push', r: loc('sq.pushR', '推不推遠端'), title: loc('sq.pushT', '合回去之後，要推到遠端嗎？'),
                why: loc('sq.pushY', 'push 出去就收不回來。上一題選發 PR 或分支留著時不問。'),
                tip: loc('sq.pushTip', 'git 有 {unpushed} 個 commit 不在任何遠端'),
                from: loc('sq.pushFrom', '來源：task.js profile suggest（git log --not --remotes、登錄的 land 紀錄）'), opts: [
                    O('true', loc('sq.pushTrue', '推'), loc('sq.pushTrueE', '收尾完就 push，不再問'), loc('sq.pushTrueS', '推'), { 'land.push': 'true' }, { risk: push }),
                    O('false', loc('sq.pushFalse', '不推，我自己推'), loc('sq.pushFalseE', 'commit 留在本機'), loc('sq.pushFalseS', '不推'), { 'land.push': 'false' }),
                    O('ask', loc('sq.pushAsk', '每次問我'), loc('sq.pushAskE', '收尾時再問'), loc('sq.pushAskS', '每次問'), { 'land.push': '' })] },
            { id: 'sessions', b: 'parallel', r: loc('sq.sessR', '同時幾個 session'), title: loc('sq.sessT', '同一個 repo，你會同時開幾個 session？'),
                why: loc('sq.sessY', '兩個 session 互相蓋掉檔案是靜默的；不同 worktree 之間不算撞檔。這個值在任務開始時就固定。'),
                tip: loc('sq.sessTip', '{n} 個 session：{share}% 的時間同時開兩個以上，最多同時 {peak} 個'),
                from: loc('sq.sessFrom', '來源：.fankeel/sessions 每個 session 的 started 與 ended 重疊'), opts: [
                    O('one', loc('sq.sessOne', '通常一個'), loc('sq.sessOneE', '幾乎不會撞；撞到同一個檔時問你'), loc('sq.sessOneS', '一個'), { guard: 'ask' }, { note: wt }),
                    O('some', loc('sq.sessSome', '偶爾兩三個'), loc('sq.sessSomeE', '撞到同一個檔時停下來問你'), loc('sq.sessSomeS', '兩三個'), { guard: 'ask' }, { note: wt }),
                    O('many', loc('sq.sessMany', '常態好幾個'), loc('sq.sessManyE', '每個任務開自己的 worktree，撞檔直接擋'), loc('sq.sessManyS', '好幾個'), { worktree: 'true', guard: 'deny' })] },
            { id: 'inflight', b: 'parallel', r: loc('sq.inflR', '一次派幾個'), title: loc('sq.inflT', '一次最多同時派幾個 agent？'),
                why: loc('sq.inflY', '同一個回應派出的 Agent 超過這個數就先停下來問你。擋的是 API 用量、主對話 context 和共用 checkout 的檔案衝突，不是 CPU。'),
                tip: loc('sq.inflTip', '.fankeel/profile.json 的 dispatch.inflight 是 {now}'),
                from: loc('sq.inflFrom', '來源：.fankeel/profile.json 的 dispatch.inflight（不設時是 8）'), opts: [
                    O('4', loc('sq.infl4', '4 個'), loc('sq.infl4E', 'API 常限流，或共用 checkout 常撞檔時'), null, { 'dispatch.inflight': '4' }),
                    O('6', loc('sq.infl6', '6 個'), loc('sq.infl6E', '比預設保守一點'), null, { 'dispatch.inflight': '6' }),
                    O('8', loc('sq.infl8', '8 個'), loc('sq.infl8E', '一般情況夠用'), null, { 'dispatch.inflight': '8' }),
                    O('12', loc('sq.infl12', '12 個'), loc('sq.infl12E', '大型平行任務，超過 12 個才問'), null, { 'dispatch.inflight': '12' }, { risk: loc('sq.riskLoad', 'API 用量、檔案衝突') })] },
            { id: 'ctx', b: 'ctx', r: loc('sq.ctxR', '交出去幾站'), title: loc('sq.ctxT', '長任務時，主對話要留著細節嗎？'),
                why: loc('sq.ctxY', '交出去的站在乾淨的 context 裡跑，主對話只收路徑和 gate。'),
                tip: loc('sq.ctxTip', '最近 {n} 個記下設定的任務多半這樣跑'),
                from: loc('sq.ctxFrom', '來源：.fankeel/profile.json 的 stage.agents、.fankeel/sessions 的 profile'), opts: [
                    O('none', loc('sq.ctxNone', '留著，每站都在主對話跑'), loc('sq.ctxNoneE', '看得最清楚；context 一路堆高'), loc('sq.ctxNoneS', '留細節'), { 'stage.agents': '' }),
                    O('rw', loc('sq.ctxRw', '讀和做交出去'), loc('sq.ctxRwE', 'survey、build、verify 另開乾淨 context'), null, { 'stage.agents': 'survey,build,verify' }),
                    O('all', loc('sq.ctxAll', '全部交出去'), loc('sq.ctxAllE', '主控只轉路徑；適合用手機遠端'), null, { 'stage.agents': 'survey,design,plan,build,verify,audit,land' })] },
            { id: 'lang', b: 'ctx', r: loc('sq.langR', '報告語言'), title: loc('sq.langT', '交出去的站，報告和 gate 用什麼語言？'),
                why: loc('sq.langY', '站 agent 寫報告和 gate 時用；沒有交出去的站時，幾乎沒有東西讀它。不設是英文。'),
                tip: loc('sq.langTip', 'model.lang 已經是 {lang}'),
                from: loc('sq.langFrom', '來源：.fankeel/profile.json 的 model.lang、這台機器的 ui.lang'), opts: [
                    O('zh', loc('sq.langZh', '繁體中文'), loc('sq.langZhE', '跟這段對話一樣'), null, { 'model.lang': ZH }),
                    O('en', 'English', loc('sq.langEnE', '不設時就是英文'), null, { 'model.lang': '' }),
                    O('other', loc('sq.langOther', '其他語言'), loc('sq.langOtherE', '填語言名稱'), loc('sq.langOtherS', '其他'), { 'model.lang': '$in' }, { input: true })] },
            { id: 'gates', b: 'verify', r: loc('sq.gatesR', '過幾關'), title: loc('sq.gatesT', '一個改動要過幾關才算完成？'),
                why: loc('sq.gatesY', '定的是起任務沒說類別時走哪條路線。沒有 spike：它不跑 verify 也不 land，要時起任務加 --class spike。'),
                tip: loc('sq.gatesTip', '這裡的任務預設類別是 {cls}'),
                from: loc('sq.gatesFrom', '來源：task.js profile suggest、.fankeel/profile.json 的 class.default'), opts: [
                    O('survey', loc('sq.gatesSurvey', '讓 survey 看任務決定'), loc('sq.gatesSurveyE', '從 7 站開始，依任務縮減'), loc('sq.gatesSurveyS', 'survey 決定'), { 'class.default': '' }),
                    O('bounded', loc('sq.gatesBounded', '設計 → 實作 → 驗證 → 收尾'), loc('sq.gatesBoundedE', '每個任務都跑 verify，不寫 plan'), loc('sq.gatesBoundedS', '5 站'), { 'class.default': 'bounded' }),
                    O('arch', loc('sq.gatesArch', '全部 7 站'), loc('sq.gatesArchE', '每個都有 plan 和 audit，子代理至少 opus'), loc('sq.gatesArchS', '7 站'), { 'class.default': 'architectural', 'land.archivePlan': 'true' }, { cost: true })] },
            { id: 'floor', b: 'verify', r: loc('sq.floorR', '子代理省或穩'), title: loc('sq.floorT', '派出去的子代理，寧可省還是穩？'),
                why: loc('sq.floorY', '子代理指實作、閱讀、review；mockup 的模型不歸這題管。錯了的代價是錢，看得到，也隨時能改。'),
                tip: loc('sq.floorTip', 'dispatch.floor 已經是 {floor}'),
                from: loc('sq.floorFrom', '來源：.fankeel/profile.json 的 dispatch.floor'), opts: [
                    O('haiku', loc('sq.floorHaiku', '省：小事用 haiku'), loc('sq.floorHaikuE', '最便宜；複雜任務品質可能下降'), loc('sq.floorHaikuS', '省'), { 'dispatch.floor': 'haiku', 'judge.model': 'opus' }),
                    O('sonnet', loc('sq.floorSonnet', '平衡'), loc('sq.floorSonnetE', '至少 sonnet，架構級自動提到 opus'), null, { 'dispatch.floor': 'sonnet', 'judge.model': 'fable' }),
                    O('opus', loc('sq.floorOpus', '穩：一律 opus 以上'), loc('sq.floorOpusE', '花費約翻倍'), loc('sq.floorOpusS', '穩'), { 'dispatch.floor': 'opus', 'judge.model': 'fable' }, { cost: true })] },
            { id: 'screen', b: 'verify', cond: 'front', r: loc('sq.screenR', '畫不畫 mockup'), title: loc('sq.screenT', '這個 repo 有畫面嗎？'),
                why: loc('sq.screenY', '偵測到前端才問。mockup 固定用 opus 以上畫。'),
                tip: loc('sq.screenTip', 'design.mockup 已經是 {mockup}'),
                from: loc('sq.screenFrom', '來源：git ls-files、.fankeel/profile.json 的 design.mockup'), opts: [
                    O('false', loc('sq.screenNo', '沒有／不用畫'), loc('sq.screenNoE', 'design 站不畫頁面'), loc('sq.screenNoS', '不畫'), { 'design.mockup': 'false' }),
                    O('opus', loc('sq.screenAsk', '有，每次先問我'), loc('sq.screenAskE', '前端工作先問要不要畫 mockup'), loc('sq.screenAskS', '先問再畫'), { 'design.mockup': 'opus' }, { cost: true }),
                    O('auto', loc('sq.screenAuto', '有，直接畫'), loc('sq.screenAutoE', '不問就畫，畫完打開頁面'), loc('sq.screenAutoS', '直接畫'), { 'design.mockup': 'auto' }, { cost: true })] },
            { id: 'where', b: 'away', r: loc('sq.whereR', 'gate 等你時你在哪'), title: loc('sq.whereT', 'gate 等你的時候，你多半在哪？'),
                why: loc('sq.whereY', '大多只是摩擦。選「常離開」還要寫這台機器的設定，會先給你看，再另外確認。'),
                tip: loc('sq.whereTip', '{from} 已經這樣設'),
                from: loc('sq.whereFrom', '來源：這台機器的 profile.json（notify.gate）、.fankeel/profile.json 的 gate.station 與 gate.away'), opts: [
                    O('term', loc('sq.whereTerm', '就在 terminal 前'), loc('sq.whereTermE', '直接在 terminal 問'), loc('sq.whereTermS', 'terminal 前'), { 'gate.station': 'off', 'gate.away': 'hint' }),
                    O('station', loc('sq.whereStation', '旁邊開著監控站'), loc('sq.whereStationE', 'gate 先在監控站等你 2 分鐘'), loc('sq.whereStationS', '開著監控站'), { 'gate.station': '120', 'gate.away': 'hint' }),
                    O('away', loc('sq.whereAway', '常離開，用手機看'), loc('sq.whereAwayE', '做到下一個要你決定的地方，壓縮後停'), loc('sq.whereAwayS', '常離開'), { 'gate.station': '300', 'gate.away': 'ask' },
                        { note: loc('sq.whereAwayN', '另外會問要不要寫這台機器的推播與手機遠端。') })] },
        ];
    }
    function blocks() {
        return [{ id: 'land', n: loc('sq.bLand', '改動怎麼收') }, { id: 'parallel', n: loc('sq.bParallel', '同時跑多少') }, { id: 'ctx', n: loc('sq.bCtx', '主對話與報告') },
            { id: 'verify', n: loc('sq.bVerify', '驗證與成本') }, { id: 'away', n: loc('sq.bAway', '離開電腦時') }];
    }
    // A key's short name on the write screen: NAME(k), a key not listed showing as itself, or
    // NAME[k] for the listed ones (copied on at load; i18n.js has picked the language by then).
    function names() {
        return { 'land.integration': loc('sq.nInteg', '怎麼進 main'), 'land.push': loc('sq.nPush', '推不推遠端'), 'land.archivePlan': loc('sq.nArchive', '計畫封存'),
            'commit.format': loc('sq.nCommit', 'commit 格式'), worktree: loc('sq.nWorktree', '開 worktree'), guard: loc('sq.nGuard', '撞檔時'),
            'dispatch.inflight': loc('sq.nInflight', '一次派幾個'), 'class.default': loc('sq.nClass', '過幾關'), 'dispatch.floor': loc('sq.nFloor', '子代理模型'),
            'judge.model': loc('sq.nJudge', '判官模型'), 'stage.agents': loc('sq.nAgents', '交出去的站'), 'model.lang': loc('sq.nLang', '報告語言'),
            'gate.station': loc('sq.nGateStation', 'gate 頁等你'), 'gate.away': loc('sq.nGateAway', '離開前'), 'design.mockup': loc('sq.nMockup', '畫 mockup'),
            'notify.gate': loc('sq.nNotifyGate', 'gate 推播'), 'station.remote': loc('sq.nRemote', '手機遠端') };
    }
    function NAME(k) { var N = names(); return has(N, k) ? N[k] : k; }
    (function () { var N = names(); for (var k in N) if (has(N, k)) NAME[k] = N[k]; }());
    // A value's label: the name of a value the answers share (guard, worktree, gate.*), else
    // the short form of the first answer writing only k=v, else '' as 未設 and anything else raw.
    function lab(k, v) {
        v = v == null ? '' : String(v);
        var onOff = { 'true': loc('sq.vOn', '開'), 'false': loc('sq.vOff', '關') };
        var X = { 'land.integration': { merge: loc('sq.vMerge', '本機 merge'), pr: loc('sq.vPr', '發 PR'), keep: loc('sq.vKeep', '分支留著') },
            worktree: { 'false': loc('sq.vWtNo', '不開'), bounded: loc('sq.vWtBounded', 'bounded 以上'), 'true': loc('sq.vWtAll', '一律') },
            guard: { ask: loc('sq.vAsk', '問你'), deny: loc('sq.vDeny', '擋下'), off: loc('sq.vWarn', '只警告') },
            'gate.station': { off: loc('sq.vNoWait', '不等'), '120': loc('sq.v2m', '2 分'), '300': loc('sq.v5m', '5 分') },
            'gate.away': { hint: loc('sq.vHint', '提示'), ask: loc('sq.vAskOne', '多問一題') },
            'land.archivePlan': { 'true': loc('sq.vArchive', '封存'), 'false': loc('sq.vKeepPlan', '留著') },
            'notify.gate': onOff, 'station.remote': onOff };
        if (has(X, k) && has(X[k], v)) return X[k][v];
        var qs = questions();
        for (var i = 0; i < qs.length; i++) {
            for (var j = 0; j < qs[i].opts.length; j++) {
                var wr = qs[i].opts[j].w, ks = Object.keys(wr);
                if (ks.length === 1 && ks[0] === k && wr[k] === v) return qs[i].opts[j].s;
            }
        }
        return v === '' ? loc('sq.unset', '未設') : v;
    }

    // ---- what is set: S's profile values plus what this page wrote since ----
    var over = {};
    function str(v) {
        if (v == null) return '';
        if (Object.prototype.toString.call(v) === '[object Array]') return v.join(',');
        return String(v);
    }
    // The value of k as a string, the project's merged values for dir or the machine's for a
    // falsy dir; a value this page wrote wins until S's next read shows the same.
    function cur(S, dir, k) {
        var P = (S && S.profiles) || {}, box = dir ? (P.projects && P.projects[dir]) : P.machine;
        var have = str(box && box.values ? box.values[k] : null), o = over[dir || ''];
        if (o && has(o, k)) {
            if (o[k] !== have) return o[k];
            delete o[k];
        }
        return have;
    }
    // POST /profile for one scope: o = { scope: 'project' | 'machine', project: dir }, rows
    // [{ k, to }]; done(ok). Unserved, it answers false without asking.
    function post(S, o, rows, done) {
        if (!S || !S.serve || typeof fetch !== 'function' || !rows.length) { done(false); return; }
        var form = new URLSearchParams();
        form.set('nonce', S.nonce || '');
        form.set('scope', o.scope);
        if (o.scope === 'project') form.set('project', o.project);
        rows.forEach(function (r) { form.append('key', r.k); form.append('value', String(r.to)); });
        fetch('profile', { method: 'POST', body: form }).then(function (res) {
            var ok = Boolean(res && res.ok), key = o.scope === 'machine' ? '' : o.project;
            if (ok) rows.forEach(function (r) { (over[key] = over[key] || {})[r.k] = String(r.to); });
            done(ok);
        }, function () { done(false); });
    }

    // ---- the quick page's state, one project at a time ----
    function fresh(dir) {
        var ans = {};
        for (var k in AUTHOR) if (has(AUTHOR, k)) ans[k] = AUTHOR[k];
        return { dir: dir, at: 'land', ans: ans, inp: {}, seen: {}, mk: { 'notify.gate': true, 'station.remote': true },
            mc: '', cf: false, wrote: 0, busy: false, err: '', sug: null, asked: false };
    }
    var st = fresh(null), last = null, lastS = null, bound = false;
    function optOf(q, o) { for (var i = 0; i < q.opts.length; i++) if (q.opts[i].o === o) return q.opts[i]; return null; }
    // The recommendation for q: station/suggest's when it named an answer q has, else the author's.
    function rec(q) {
        var r = st.sug && st.sug.recs && st.sug.recs[q.id];
        if (r && optOf(q, String(r.o))) return { o: String(r.o), src: r.src === 'rec' ? 'rec' : 'author', v: r.v || {} };
        return { o: AUTHOR[q.id], src: 'author', v: {} };
    }
    function applies(q) {
        if (q.cond === 'push') return st.ans.main === 'direct' || st.ans.main === 'merge';
        if (q.cond === 'front') return Boolean(st.sug && st.sug.front);
        return true;
    }
    function cfv() { return st.sug && typeof st.sug.commitFormat === 'string' ? st.sug.commitFormat : ''; }
    function plan(qs) {
        var P = {};
        qs.forEach(function (q) {
            var a = applies(q) ? optOf(q, st.ans[q.id]) : null;
            if (!a) return;
            Object.keys(a.w).forEach(function (k) {
                var v = a.w[k];
                if (v === '$in') { v = String(st.inp[q.id] || '').trim(); if (!v) return; }
                P[k] = { v: v, by: q.id };
            });
        });
        return P;
    }
    function changes(S, qs) {
        var P = plan(qs), out = [];
        Object.keys(P).forEach(function (k) {
            var from = cur(S, st.dir, k);
            if (P[k].v !== from) out.push({ k: k, from: from, to: P[k].v, by: P[k].by });
        });
        var cf = cfv();
        if (st.cf && cf && cur(S, st.dir, 'commit.format') !== cf) out.push({ k: 'commit.format', from: cur(S, st.dir, 'commit.format'), to: cf, by: 'cf' });
        return out;
    }
    function machine(S) {
        if (st.ans.where !== 'away') return { want: false, rows: [], would: [] };
        var would = [];
        ['notify.gate', 'station.remote'].forEach(function (k) {
            if (st.mk[k] && cur(S, null, k) !== 'true') would.push({ k: k, from: cur(S, null, k) || 'false', to: 'true', by: 'where' });
        });
        return { want: true, rows: st.mc === 'yes' ? would : [], would: would };
    }
    function total(S, qs) { return changes(S, qs).length + machine(S).rows.length; }
    function nChanged(qs) { return qs.filter(function (q) { return applies(q) && st.ans[q.id] !== rec(q).o; }).length; }
    function summary(qs, bid) {
        return qs.filter(function (q) { return q.b === bid && applies(q); }).map(function (q) {
            var a = optOf(q, st.ans[q.id]), typed = String(st.inp[q.id] || '').trim();
            return a && a.input && typed ? typed : a ? a.s : '';
        }).join(' · ');
    }
    function sepOf(p) { return String(p).indexOf('\\') >= 0 ? '\\' : '/'; }
    function projectFile(dir) { var s = sepOf(dir); return String(dir).replace(/[\\/]+$/, '') + s + '.fankeel' + s + 'profile.json'; }
    function machineFile(o) {
        var c = String((o && o.configDir) || ''), s = sepOf(c);
        return c ? c.replace(/[\\/]+$/, '') + s + 'fankeel' + s + 'profile.json' : 'profile.json';
    }
    // Ask station/suggest once a project; an answer moves only the questions still on the old recommendation.
    function ask(S) {
        if (st.asked || !st.dir || !S || !S.serve || typeof fetch !== 'function') return;
        st.asked = true;
        var dir = st.dir;
        fetch('station/suggest?project=' + encodeURIComponent(dir)).then(function (res) {
            return res && res.ok ? res.json() : null;
        }).then(function (j) {
            if (!j || st.dir !== dir) return;
            var qs = questions(), keep = {};
            qs.forEach(function (q) { keep[q.id] = st.ans[q.id] !== rec(q).o; });
            st.sug = j;
            qs.forEach(function (q) { if (!keep[q.id]) st.ans[q.id] = rec(q).o; });
            redraw();
        }, function () { st.asked = true; });
    }

    // ---- drawing ----
    function helpHtml(id, inner, label) {
        return '<span class="v9-help"><button type="button" class="v9-qm" data-qm aria-label="' + esc(label) + '" aria-describedby="' + id + '" aria-expanded="false">?</button>'
            + '<span class="v9-tip" role="tooltip" id="' + id + '">' + inner + '</span></span>';
    }
    // A question's answers as the radiogroup the mockup draws; sel is the answer on, recO the
    // recommended one (null: none marked), inp the typed values by question, pre the id prefix.
    function optHtml(q, sel, recO, inp, pre) {
        pre = pre || 'qk';
        return '<div class="v9-opts qk-opts" role="radiogroup" aria-labelledby="' + pre + 'q-' + q.id + '">' + q.opts.map(function (a, i) {
            var on = a.o === sel, tid = pre + 'w-' + q.id + '-' + i;
            var codes = Object.keys(a.w).map(function (k) {
                var v = a.w[k] === '$in' ? loc('sq.typed', '（你填的值）') : a.w[k] === '' ? loc('sq.notSet', '（不設）') : a.w[k];
                return '<code>' + esc(k + ': ' + v) + '</code>';
            }).join('');
            return '<div class="v9-o' + (a.input ? ' has-in' : '') + '"><button type="button" class="v9-opt' + (a.o === recO ? ' is-rec' : '') + '" role="radio" aria-checked="' + on
                + '" tabindex="' + (on ? 0 : -1) + '" data-o="' + esc(a.o) + '" aria-describedby="' + tid + '"><span class="v9-radio" aria-hidden="true"></span><span class="v9-ot">' + esc(a.t)
                + (a.o === recO ? '<span class="v9-tag rec">' + CHECK + loc('sq.rec', '推薦') + '</span>' : '')
                + (a.risk ? '<span class="v9-risk">' + WARN + esc(a.risk) + '</span>' : '')
                + (a.cost ? '<span class="qk-cost">' + loc('sq.cost', '花費較高') + '</span>' : '')
                + '</span><span class="v9-oe">' + esc(a.e) + '</span></button>'
                + '<span class="v9-tip v9-wtip" role="tooltip" id="' + tid + '">' + codes + (a.note ? '<small>' + esc(a.note) + '</small>' : '') + '</span>'
                + (a.input ? '<span class="qk-in" data-field="' + esc(a.o) + '"' + (on ? '' : ' hidden') + '><span class="v9-in"><input id="' + pre + 'i-' + q.id + '" data-in value="'
                    + esc((inp && inp[q.id]) || '') + '" aria-label="' + esc(loc('sq.langName', '語言名稱')) + '" placeholder="' + esc(loc('sq.langPh', '日本語'))
                    + '" autocomplete="off" spellcheck="false"></span></span>' : '')
                + '</div>';
        }).join('') + '</div>';
    }
    function srcHtml(q, r) {
        var isRec = r.src === 'rec', id = 'qks-' + q.id, b;
        if (!isRec) b = loc('sq.tipAuthor', 'fankeel 預設；沒有足夠的紀錄可以推');
        else {
            b = kit().fillVars(q.tip, r.v);
            if (/\{\w+\}/.test(b)) b = loc('sq.tipRaw', '紀錄：{facts}', { facts: Object.keys(r.v).map(function (x) { return x + ' ' + r.v[x]; }).join(' · ') });
        }
        return '<button type="button" class="qk-src ' + (isRec ? 'is-rec' : 'is-author') + '" data-qm aria-describedby="' + id + '" aria-expanded="false">'
            + (isRec ? loc('sq.srcRec', '依你的紀錄') : loc('sq.srcAuthor', '作者推薦')) + '</button>'
            + '<span class="v9-tip qk-stip" role="tooltip" id="' + id + '"><b>' + esc(b) + '</b><small>' + esc(q.from) + '</small></span>';
    }
    function qHtml(q) {
        if (!applies(q)) return '';
        var r = rec(q), skip = q.skip && st.ans.main !== 'direct' && st.ans.main !== 'merge';
        return '<div class="qk-q" data-block="quick-q-' + q.id + '" data-q="' + q.id + '"><div class="qk-qh"><h3 class="qk-qt" id="qkq-' + q.id + '">' + esc(q.title) + '</h3>'
            + srcHtml(q, r) + helpHtml('qkh-' + q.id, esc(q.why), loc('sq.whyAsk', '為什麼問這題')) + '</div>'
            + optHtml(q, st.ans[q.id], r.o, st.inp, 'qk') + (skip ? '<p class="qk-skip">' + esc(q.skip) + '</p>' : '') + '</div>';
    }
    function cardHtml(S, o) {
        if (st.ans.where !== 'away') return '';
        var m = machine(S), here = loc('sq.thisMachine', '這台機器');
        var now = function (k) {
            return '<span class="qk-mnow">' + esc(loc('sq.mNow', '這台機器現在：{v}', { v: cur(S, null, k) === 'true' ? loc('sq.vOn', '開') : loc('sq.vOff', '關') })) + '</span>';
        };
        var box = function (k, id, label) { return '<input type="checkbox" id="' + id + '" data-mk="' + k + '"' + (st.mk[k] ? ' checked' : '') + '><label for="' + id + '">' + esc(label) + '</label>'; };
        var say = st.mc === 'yes' ? (m.rows.length ? loc('sq.mcYes', '會在寫入時一起寫進這台機器。') : loc('sq.mcSame', '這台機器已經是這樣，寫入時不會重寫。'))
            : st.mc === 'no' ? loc('sq.mcNo', '這台機器維持現在的設定。') : m.would.length ? '' : loc('sq.mcBoth', '這台機器兩項都已經開著。');
        return '<div class="v9-mc qk-mc" data-block="quick-machine-card" data-state="' + st.mc + '" role="group" aria-labelledby="qkmc-h">'
            + '<div class="v9-mc-h"><b id="qkmc-h">' + loc('sq.mcH', '還要寫進這台機器') + '</b>'
            + helpHtml('qkh-mc', '<code>notify.gate: true<i> · ' + esc(here) + '</i></code><code>station.remote: true<i> · ' + esc(here) + '</i></code><small>'
                + esc(loc('sq.mcWhy', '寫進 {file}。這兩項只讀機器設定，寫在專案檔不會生效。要另外按確認才寫。', { file: machineFile(o) })) + '</small>', loc('sq.mcAsk', '這張卡寫什麼')) + '</div>'
            + '<ul class="v9-mc-l"><li>' + box('notify.gate', 'qkmc-n', loc('sq.mcGate', 'gate 等你時推播到手機')) + now('notify.gate') + '</li>'
            + '<li>' + box('station.remote', 'qkmc-r', loc('sq.mcRemote', '手機遠端連進監控站'))
            + '<span class="v9-tag pend" title="' + esc(loc('sq.pendTip', 'Tailscale 以外的遠端方案還在評估')) + '">' + loc('sq.pend', '待定') + '</span>' + now('station.remote')
            + '<span class="qk-mpend">' + loc('sq.pendNote', '連線方式待定：Tailscale 以外的方案還在評估') + '</span></li></ul>'
            + '<div class="v9-mc-f"><button type="button" class="v9-btn pri" data-mc="yes">' + loc('sq.mcOk', '確認，寫進這台機器') + '</button>'
            + '<button type="button" class="v9-btn" data-mc="no">' + loc('sq.mcNot', '先不要') + '</button><span class="v9-mc-say" role="status">' + esc(say) + '</span></div></div>';
    }
    function screenHtml(S, o, qs, b) {
        return '<div class="qk-screen" data-block="quick-b-' + b.id + '" data-screen="' + b.id + '"><h2 class="qk-bh" id="qkb-' + b.id + '" tabindex="-1">' + esc(b.n) + '</h2>'
            + qs.filter(function (q) { return q.b === b.id; }).map(qHtml).join('') + (b.id === 'away' ? cardHtml(S, o) : '') + '</div>';
    }
    function finalHtml(S, o, qs) {
        var ch = changes(S, qs), m = machine(S), by = {}, cf = cfv();
        qs.forEach(function (q) { by[q.id] = q; });
        var src = function (c) {
            if (c.by === 'cf') return loc('sq.srcRec', '依你的紀錄');
            var q = by[c.by], r = rec(q);
            if (st.ans[q.id] !== r.o) return loc('sq.srcMine', '你選的');
            return r.src === 'rec' ? loc('sq.srcRec', '依你的紀錄') : loc('sq.srcAuthor', '作者推薦');
        };
        var group = function (g, title, file, rows) {
            var h = '<div class="v9-fin-g"><p class="v9-fin-h"><b>' + esc(loc('sq.finG', '{g} · {n} 項', { g: title, n: rows.length })) + '</b><code title="' + esc(file) + '">' + esc(file) + '</code></p>';
            if (g === 'm' && !rows.length) {
                var t = !m.want ? loc('sq.finMNot', '不寫：gate 等你時的答案不是「常離開」。')
                    : st.mc === '' && m.would.length ? loc('sq.finMPend', '還沒確認。') + '<button type="button" data-go="away">' + loc('sq.finMBack', '回「離開電腦時」確認') + '</button>'
                        : st.mc === 'no' ? loc('sq.finMNo', '不寫：你在「離開電腦時」選了先不要。')
                            : loc('sq.finMSame', '不用寫：推播和手機遠端這台機器都已經開著。');
                return h + '<p class="qk-fin-m">' + t + '</p></div>';
            }
            if (!rows.length) return h + '<p class="qk-fin-m">' + loc('sq.finSame', '跟現在一樣，沒有要改的。') + '</p></div>';
            return h + '<ul class="v9-fin-l">' + rows.map(function (c, n) {
                var id = 'qkf-' + g + n, a = lab(c.k, c.from), z = lab(c.k, c.to);
                var whence = c.by === 'cf' ? loc('sq.cfFrom', 'git 紀錄的 commit 格式') : by[c.by].r;
                return '<li><span class="v9-fk" tabindex="0" aria-describedby="' + id + '">' + esc(NAME(c.k)) + '</span><span class="v9-tip" role="tooltip" id="' + id + '"><code>'
                    + esc(c.k + ': ' + (c.to === '' ? loc('sq.notSet', '（不設）') : c.to)) + '</code><small>' + esc(loc('sq.from', '來自：{r}', { r: whence })) + '</small></span>'
                    + '<span class="v9-chg"><s title="' + esc(a) + '">' + esc(a) + '</s><span aria-hidden="true">→</span><span class="hm-sr">' + loc('sq.to', '改成') + '</span>'
                    + '<b title="' + esc(z) + '">' + esc(z) + '</b></span><span class="qk-fin-src">' + esc(src(c)) + '</span></li>';
            }).join('') + '</ul></div>';
        };
        return '<div class="qk-screen" data-block="quick-final" data-screen="final"><div class="qk-fh"><h2 class="qk-bh" id="qkb-final" tabindex="-1">' + loc('sq.finT', '要寫入這些改動嗎？') + '</h2>'
            + helpHtml('qkh-final', loc('sq.finY', '按寫入才會動 profile.json。專案和這台機器分開寫；跟現在一樣的值不重寫。'), loc('sq.finAsk', '寫入什麼')) + '</div>'
            + '<div data-fin>' + group('p', loc('sq.gProject', '專案'), projectFile(st.dir), ch) + group('m', loc('sq.thisMachine', '這台機器'), machineFile(o), m.rows) + '</div>'
            + (cf ? '<div class="qk-extra"><input type="checkbox" id="qk-cf" data-cf' + (st.cf ? ' checked' : '') + '><label for="qk-cf">' + loc('sq.cfL', '另外檢查 commit 第一行的格式') + '</label>'
                + '<button type="button" class="qk-src is-rec" data-qm aria-describedby="qks-cf" aria-expanded="false">' + loc('sq.srcRec', '依你的紀錄') + '</button>'
                + '<span class="v9-tip qk-stip" role="tooltip" id="qks-cf"><b>' + loc('sq.cfTip', 'git 近期的 commit 第一行大多照這個格式寫') + '</b><small>'
                + loc('sq.cfSrc', '來源：task.js profile suggest（git log --no-merges -n 50）') + '</small></span><code class="qk-cfv">' + esc(cf) + '</code>'
                + '<p class="qk-cfn">' + loc('sq.cfN', '不勾就不寫。git 推出的格式沒有 merge，這裡已經補上，不然會擋住 land.js merge。') + '</p></div>' : '')
            + '<p class="v9-fin-n">' + loc('sq.finN', '沒問到的設定（敏感資料審查、一次派幾個、推播伺服器⋯）維持現在的值。') + '</p>'
            + '<p class="qk-more">' + loc('sq.more', '要逐項調整？') + '<a href="#/settings/detail">' + loc('sq.detail', '進入詳細設定') + '</a></p>'
            + (S && S.serve ? '' : '<p class="qk-fin-m">' + loc('sq.unserved', '這頁不是經由監控站伺服器開的，不能寫入。') + '</p>')
            + (st.err ? '<p class="qk-fin-m" role="status">' + esc(st.err) + '</p>' : '')
            + (st.wrote ? '<p class="v9-fin-ok" role="status">' + CHECK + '<span>' + esc(loc('sq.wrote', '已寫入 {n} 項。', { n: st.wrote })) + '</span></p>' : '') + '</div>';
    }
    function railHtml(S, qs, B) {
        var n = total(S, qs), i = ORDER.indexOf(st.at), fin = st.at === 'final';
        var item = function (b, k) {
            var now = b.id === st.at, done = !now && Boolean(st.seen[b.id]);
            return '<li class="qk-c' + (now ? ' is-now' : '') + (done ? ' is-done' : '') + '" data-b="' + b.id + '"><button type="button" class="qk-cb" data-go="' + b.id + '"' + (now ? ' aria-current="step"' : '') + '>'
                + '<span class="v9-cm"><span>' + (k + 1) + '</span>' + CHECK + '</span><span class="qk-cn"><b>' + esc(b.n) + '</b><small>' + esc(summary(qs, b.id)) + '</small></span></button></li>';
        };
        var nchg = n ? loc('sq.nChg', '{n} 項改動', { n: n }) : loc('sq.noChg', '沒有改動');
        return '<aside class="dcard v9-rail qk-rail" data-block="quick-rail" data-rail aria-label="' + esc(loc('sq.railH', '快速設定')) + '" data-open="false">'
            + '<button type="button" class="v9-rtog" data-rtog aria-expanded="false"><b>' + esc(fin ? loc('sq.toFinal', '檢查並寫入') : B[i].n) + '</b><span>'
            + esc(fin ? nchg : loc('sq.pos', '第 {i} 組，共 {n} 組', { i: i + 1, n: B.length })) + '</span>' + CHEVRON + '</button>'
            + '<div class="v9-rh"><b>' + loc('sq.railH', '快速設定') + '</b><span>' + loc('sq.railS', '5 組 · 約 1 分鐘') + '</span></div>'
            + '<nav class="qk-ix" data-block="quick-index" aria-label="' + esc(loc('sq.railIx', '快速設定的組')) + '"><ol>' + B.map(item).join('')
            + '<li class="qk-c qk-cf' + (fin ? ' is-now' : '') + '" data-b="final"><button type="button" class="qk-cb" data-go="final"' + (fin ? ' aria-current="step"' : '') + '><span class="qk-wi">' + SAVE + '</span>'
            + '<span class="qk-cn"><b>' + loc('sq.toFinal', '檢查並寫入') + '</b><small>' + esc(nchg) + '</small></span></button></li></ol></nav>'
            + '<div class="qk-detail" data-block="quick-detail-link"><a class="qk-dl" href="#/settings/detail"><span><b>' + loc('sq.detail', '進入詳細設定') + '</b><small>'
            + loc('sq.detailS', '每個設定一個畫面，逐項調整') + '</small></span>' + ARROW + '</a></div></aside>';
    }
    function stripHtml(qs) {
        var c = nChanged(qs), nr = 0, na = 0, off = st.at === 'final' && !c;
        qs.forEach(function (q) { if (applies(q)) { if (rec(q).src === 'rec') nr++; else na++; } });
        var tail = c ? loc('sq.stripBack', '按右邊的按鈕全部改回推薦') : st.at === 'final' ? loc('sq.stripFinal', '下面是照推薦會改的') : loc('sq.stripHover', '滑過標籤看根據');
        return '<div class="qk-recs" data-block="quick-recs"><p class="qk-rt"><b>' + esc(c ? loc('sq.stripMine', '你改了 {n} 題推薦', { n: c }) : loc('sq.stripAll', '每題都先選好推薦了')) + '</b>'
            + '<span>' + esc(loc('sq.stripSub', '{r} 題依你的紀錄，{a} 題作者推薦；{tail}', { r: nr, a: na, tail: tail })) + '</span></p>'
            + '<button type="button" class="v9-btn pri qk-all" data-all' + (off ? ' disabled aria-pressed="true"' : '') + '>' + (off ? loc('sq.allDone', '已套用推薦') : loc('sq.all', '全部套用推薦')) + '</button></div>';
    }
    function footHtml(S, qs, B) {
        var i = ORDER.indexOf(st.at), n = total(S, qs), fin = st.at === 'final';
        var write = st.busy ? loc('sq.writing', '寫入中⋯') : st.wrote && !n ? loc('sq.wroteAll', '已寫入') : n ? loc('sq.writeN', '寫入 {n} 項', { n: n }) : loc('sq.nothing', '沒有要寫的');
        var next = st.at === 'away' ? loc('sq.toFinal', '檢查並寫入') : loc('sq.next', '下一組：{n}', { n: B[i + 1] ? B[i + 1].n : '' });
        return '<div class="v9-foot" data-block="quick-foot">' + (i > 0 ? '<button type="button" class="v9-btn" data-prev>' + loc('sq.prev', '上一組') + '</button>' : '')
            + '<span class="v9-pos" aria-live="polite">' + esc(fin ? loc('sq.posFinal', '寫入前檢查') : loc('sq.pos', '第 {i} 組，共 {n} 組', { i: i + 1, n: B.length })) + '</span>'
            + (fin ? '<button type="button" class="v9-btn pri" data-write' + (!n || st.busy || !(S && S.serve) ? ' disabled' : '') + '>' + esc(write) + '</button>'
                : '<button type="button" class="v9-btn pri" data-next>' + esc(next) + '</button>') + '</div>';
    }

    function page(S, o) {
        o = o || {};
        var hash = String(o.hash || (w && w.location && w.location.hash) || '');
        if (/^#\/?settings\/detail(\/|$)/.test(hash)) {
            return w && w.FK_SETDETAIL ? w.FK_SETDETAIL.page(S, o) : '<p class="an-empty">' + loc('sq.noDetail', '詳細設定還沒有載入。') + '</p>';
        }
        last = o;
        lastS = S;
        bind();
        var dirs = Object.keys((S && S.profiles && S.profiles.projects) || {});
        if (!dirs.length) return '<div class="st v9 qk" data-block="quick-page" data-sq><p class="an-empty">' + loc('sq.noProject', '還沒有專案可以設定：先在一個專案裡起一個 fankeel 任務。') + '</p></div>';
        if (dirs.indexOf(st.dir) < 0) st = fresh(dirs[0]);
        ask(S);
        var qs = questions(), B = blocks(), b = null;
        for (var i = 0; i < B.length; i++) if (B[i].id === st.at) b = B[i];
        var pick = dirs.length > 1 ? '<label class="qk-proj">' + loc('sq.proj', '專案') + ' <select data-sq-proj>' + dirs.map(function (d) {
            return '<option value="' + esc(d) + '"' + (d === st.dir ? ' selected' : '') + '>' + esc(d) + '</option>';
        }).join('') + '</select></label>' : '';
        return '<div class="st v9 qk" data-block="quick-page" data-sq>' + railHtml(S, qs, B)
            + '<section class="dcard v9-wiz qk-wiz" data-block="quick-wizard" aria-label="' + esc(loc('sq.railH', '快速設定')) + '">' + pick + stripHtml(qs)
            + (b ? screenHtml(S, o, qs, b) : finalHtml(S, o, qs)) + footHtml(S, qs, B) + '</section></div>';
    }

    // ---- events: bound on document once, acting only inside [data-sq] ----
    function redraw() { if (last && typeof last.redraw === 'function') last.redraw(); }
    function later(fn) { if (w && typeof w.setTimeout === 'function') w.setTimeout(fn, 0); }
    function focusId(id) { later(function () { var el = doc && doc.getElementById(id); if (el && typeof el.focus === 'function') el.focus({ preventScroll: true }); }); }
    function go(to) {
        if (ORDER.indexOf(to) < 0) return;
        if (st.at !== 'final') st.seen[st.at] = true;
        st.at = to;
        redraw();
        focusId('qkb-' + to);
        if (w && typeof w.scrollTo === 'function') w.scrollTo(0, 0);
    }
    function closeTips(keep) {
        if (!doc || typeof doc.querySelectorAll !== 'function') return;
        [].forEach.call(doc.querySelectorAll('[data-sq] [data-qm][aria-expanded="true"]'), function (x) { if (x !== keep) x.setAttribute('aria-expanded', 'false'); });
    }
    function inside(t) { return t && typeof t.closest === 'function' && t.closest('[data-sq]') ? t : null; }
    function write() {
        var S = lastS, qs = questions();
        if (!S || !S.serve || st.busy) return;
        var ch = changes(S, qs), m = machine(S), jobs = [], dir = st.dir, n = 0;
        if (ch.length) jobs.push({ scope: 'project', project: dir, rows: ch });
        if (m.rows.length) jobs.push({ scope: 'machine', rows: m.rows });
        if (!jobs.length) return;
        st.busy = true;
        st.err = '';
        redraw();
        var next = function (i) {
            if (st.dir !== dir) return;
            if (i >= jobs.length) { st.busy = false; st.wrote = n; redraw(); return; }
            post(S, jobs[i], jobs[i].rows, function (ok) {
                if (!ok) {
                    st.busy = false;
                    st.wrote = n;
                    st.err = jobs[i].scope === 'machine' ? loc('sq.failM', '寫入這台機器的設定失敗，那邊沒有存。') : loc('sq.failP', '寫入專案的設定失敗，那邊沒有存。');
                    redraw();
                    return;
                }
                n += jobs[i].rows.length;
                next(i + 1);
            });
        };
        next(0);
    }
    function onClick(e) {
        var t = inside(e && e.target);
        if (!t) { closeTips(null); return; }
        var qm = t.closest('[data-qm]');
        if (qm) {
            var open = qm.getAttribute('aria-expanded') !== 'true';
            closeTips(qm);
            qm.setAttribute('aria-expanded', String(open));
            return;
        }
        closeTips(null);
        var b = t.closest('[data-o]'), q = b && b.closest('[data-q]');
        if (q) {
            var id = q.getAttribute('data-q'), qq = null;
            questions().forEach(function (x) { if (x.id === id) qq = x; });
            var a = qq && optOf(qq, b.getAttribute('data-o'));
            if (!a) return;
            st.ans[id] = a.o;
            st.wrote = 0;
            st.err = '';
            redraw();
            if (a.input) focusId('qki-' + id);
            return;
        }
        var g = t.closest('[data-go]');
        if (g) { go(g.getAttribute('data-go')); return; }
        if (t.closest('[data-all]')) {
            questions().forEach(function (x) { st.ans[x.id] = rec(x).o; });
            blocks().forEach(function (x) { st.seen[x.id] = true; });
            st.wrote = 0;
            go('final');
            return;
        }
        if (t.closest('[data-next]')) { go(ORDER[ORDER.indexOf(st.at) + 1]); return; }
        if (t.closest('[data-prev]')) { go(ORDER[ORDER.indexOf(st.at) - 1]); return; }
        var mc = t.closest('[data-mc]');
        if (mc) { st.mc = mc.getAttribute('data-mc') === 'yes' ? 'yes' : 'no'; st.wrote = 0; redraw(); return; }
        if (t.closest('[data-write]')) { write(); return; }
        var tg = t.closest('[data-rtog]'), rail = tg && tg.closest('[data-rail]');
        if (rail) {
            var op = rail.getAttribute('data-open') !== 'true';
            rail.setAttribute('data-open', String(op));
            tg.setAttribute('aria-expanded', String(op));
        }
    }
    // Typing changes the state only: a redraw would take the caret out of the box.
    function onInput(e) {
        var t = inside(e && e.target), q = t && t.getAttribute('data-in') !== null ? t.closest('[data-q]') : null;
        if (!q) return;
        var id = q.getAttribute('data-q'), f = t.closest('[data-field]');
        st.inp[id] = String(t.value || '');
        if (f) st.ans[id] = f.getAttribute('data-field');
        st.wrote = 0;
    }
    function onChange(e) {
        var t = inside(e && e.target);
        if (!t) return;
        var k = t.getAttribute('data-mk');
        if (k) { st.mk[k] = Boolean(t.checked); if (st.mc === 'yes') st.mc = ''; redraw(); return; }
        if (t.getAttribute('data-cf') !== null) { st.cf = Boolean(t.checked); st.wrote = 0; redraw(); return; }
        if (t.getAttribute('data-sq-proj') !== null) { st = fresh(String(t.value)); redraw(); }
    }
    function onKey(e) {
        if (e && e.key === 'Escape') { closeTips(null); return; }
        var t = inside(e && e.target), q = t && t.getAttribute('data-o') !== null ? t.closest('[data-q]') : null;
        var step = e && (e.key === 'ArrowDown' || e.key === 'ArrowRight') ? 1 : e && (e.key === 'ArrowUp' || e.key === 'ArrowLeft') ? -1 : 0;
        if (!q || !step) return;
        var id = q.getAttribute('data-q'), qq = null;
        questions().forEach(function (x) { if (x.id === id) qq = x; });
        if (!qq) return;
        var os = qq.opts.map(function (a) { return a.o; }), i = os.indexOf(t.getAttribute('data-o')) + step;
        st.ans[id] = os[(i + os.length) % os.length];
        st.wrote = 0;
        if (typeof e.preventDefault === 'function') e.preventDefault();
        redraw();
        later(function () {
            var el = doc && typeof doc.querySelector === 'function' ? doc.querySelector('[data-q="' + id + '"] [data-o="' + st.ans[id] + '"]') : null;
            if (el && typeof el.focus === 'function') el.focus();
        });
    }
    function bind() {
        if (bound || !doc || typeof doc.addEventListener !== 'function') return;
        bound = true;
        doc.addEventListener('click', onClick);
        doc.addEventListener('input', onInput);
        doc.addEventListener('change', onChange);
        doc.addEventListener('keydown', onKey);
    }
    function state() { return st; }
    function reset() { st = fresh(null); over = {}; last = null; lastS = null; }

    var api = { page: page, questions: questions, blocks: blocks, NAME: NAME, MACHINE: MACHINE, AUTHOR: AUTHOR, cur: cur, lab: lab, optHtml: optHtml, post: post,
        onClick: onClick, onInput: onInput, onChange: onChange, onKey: onKey, state: state, reset: reset, EN: EN };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_SETTINGS = api;
}(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null));
```

5. 跑 `node --test tests/station-settings-quick.test.js`，看 14 個通過；再跑 `node --test tests/station-modules.test.js tests/station-i18n.test.js`，看它們照舊通過（這個任務沒動 index.html，模組清單不變）。
6. Commit：`git add assets/station/settings-page.js assets/station/settings-page.css tests/station-settings-quick.test.js` 然後 `git commit -m "feat(station): quick setup page as FK_SETTINGS, with the shared question table"`。

## Task 6: 詳細設定的步驟表

**Files:**
- Modify: `assets/station/settings-steps.js` — 新檔：`FK_SETSTEPS`，10 章、33 步的順序，與快速設定以外 23 步的題目、為什麼、選項（標籤、效果、rail 上的短答、寫入、推薦、風險、待定）和輸入欄
- Modify: `assets/station/settings-steps.css` — 新檔：agents 表在 390px 的 select 截斷修正 `.v9-at select{min-width:0;width:100%}`
- Read: `.fankeel/build/2026-10-21-station-redesign/route-settings-v9.html:594-594` — v9-data JSON：每個選項的 `w`、`sty`、`skeys`、`tie`
- Read: `.fankeel/build/2026-10-21-station-redesign/route-settings-v9.html:376-593` — 每一步的題目、`?` 說明、選項標籤與效果、輸入欄的 label 與 placeholder
- Read: `assets/station/project-page.js:47-52` — 模組的 `loc()` 與自己的 `EN` 表
- Read: `tests/station-module.js:19-61` — `page()` 與 `stringsLeft()`
- Test: `tests/station-settings-steps.test.js`

**Interfaces:**
- Consumes: `FK_KIT` 的 fillVars(s, vars)（station.js:230-232，畫的時候才讀）；`FK_I18N` 的 lang
- Produces: `FK_SETSTEPS` = { chapters(), order(), steps(), STY, SKEYS, TIE, EN }；chapters() → [{id, n, machine?}] 10 筆；order() → [[id, ch, r]] 33 筆；steps() → 23 筆 {id, ch, r, kind: one|multi|style|table, key?, cond?, title, why, adv?, warn?, note?, field?, table?, opts:[{o, label, effect, s, w, rec, risk, pend, pendWhy, input}]}

**Dispatch:** implementer, sonnet

1. 寫失敗的測試。在 `tests/station-settings-steps.test.js`：

```js
'use strict';
// station-39: the step table of 詳細設定 (assets/station/settings-steps.js)
// against the approved mockup route-settings-v9.html — ten chapters, 33
// steps in the mockup's order, every write a value lib/profile.js accepts,
// prompt.* marked advanced, remote marked pending, and every Chinese string
// with its English.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const profile = require('../lib/profile.js');
const { page, stringsLeft } = require('./station-module.js');

const QUICK = ['main', 'push', 'sessions', 'gates', 'floor', 'ctx', 'where', 'screen', 'inflight', 'lang'];
const OWN = ['style', 'archive', 'commitfmt', 'wt', 'sreview', 'seclocal', 'skill', 'prompt', 'judge', 'agents', 'quota',
    'compact', 'link', 'notify', 'ntfy', 'remote', 'hold', 'prose', 'uilang', 'smode', 'hide', 'chart', 'initskip'];
// The table is built in the page's vm; JSON brings it into this realm for deepEqual.
const plain = (x) => JSON.parse(JSON.stringify(x));
function boot() {
    const p = page(['settings-steps.js']);
    return { T: p.M['settings-steps.js'], win: p.win };
}

test('ten chapters in the mockup\'s order, and only 離開電腦時 writes the machine', () => {
    const { T } = boot();
    const ch = plain(T.chapters());
    assert.deepEqual(ch.map((c) => c.id), ['quick', 'integ', 'parallel', 'verify', 'cost', 'context', 'away', 'text', 'safety', 'other']);
    assert.deepEqual(ch.map((c) => c.n), ['快速設定', '整合收尾', '平行與隔離', '驗證與流程', '成本與模型', 'Context 與自主', '離開電腦時', '報告與文字', '安全', '其他']);
    assert.deepEqual(ch.filter((c) => c.machine).map((c) => c.id), ['away']);
});

test('order() is the 33 steps: the ten quick questions and the 23 the table carries, each under its chapter', () => {
    const { T } = boot();
    const ord = plain(T.order());
    assert.equal(ord.length, 33);
    assert.deepEqual(ord.map((e) => e[0]).filter((id) => QUICK.includes(id)), QUICK.slice(0, 8).concat(['inflight', 'lang']));
    assert.deepEqual(plain(T.steps().map((s) => s.id)), OWN);
    const ch = Object.fromEntries(ord.map((e) => [e[0], e[1]]));
    assert.equal(ch.inflight, 'parallel');
    assert.equal(ch.lang, 'text');
    for (const s of T.steps()) {
        assert.equal(s.ch, ch[s.id], s.id);
        assert.ok(s.r && s.title && s.why, s.id + ' has a rail name, a question and a why');
    }
});

test('every option has a label and an effect, and every literal write is a value lib/profile.js accepts', () => {
    const { T } = boot();
    for (const s of T.steps()) {
        if (s.kind === 'table') { assert.equal(s.opts.length, 0); continue; }
        assert.ok(s.opts.length >= 2, s.id);
        for (const o of s.opts) {
            assert.ok(o.label && o.effect && o.s, s.id + ' ' + o.o);
            for (const [k, v] of Object.entries(o.w)) {
                if (k.includes('*') || k.includes('$') || v === '' || v.startsWith('$')) continue;
                assert.ok(Object.prototype.hasOwnProperty.call(profile.KEYS, k), k);
                assert.equal(profile.parseValue(k, v).error, undefined, k + '=' + v);
            }
            if (o.input) assert.ok(s.field && s.field.label, s.id + ' has a field for ' + o.o);
        }
    }
});

test('prompt.* is tagged 進階・不建議 with its warning, remote\'s yes is 待定, the rest as the mockup tags them', () => {
    const { T } = boot();
    const by = Object.fromEntries(plain(T.steps()).map((s) => [s.id, s]));
    assert.equal(by.prompt.adv, '進階・不建議');
    assert.equal(by.prompt.warn, '每輪都注入，會蓋過站的規則、難除錯；建議先別用。');
    assert.deepEqual(by.prompt.opts.map((o) => [o.o, o.rec, o.risk]), [['none', '推薦', ''], ['add', '', '不建議']]);
    assert.ok(by.prompt.field.each);
    const yes = by.remote.opts.find((o) => o.o === 'true');
    assert.equal(yes.pend, '待定');
    assert.equal(yes.risk, '對外開放');
    assert.equal(by.commitfmt.opts.find((o) => o.o === 'git').w['commit.format'], '$git');
    assert.deepEqual(by.notify.key, 'notify.*');
    assert.deepEqual(by.skill.cond, 'skill');
    assert.match(by.agents.table.def, /\{v\}/);
});

test('the three styles cover the compared keys and land.archivePlan; ties go balanced, free, steady', () => {
    const { T } = boot();
    assert.deepEqual(plain(T.SKEYS), ['class.default', 'dispatch.floor', 'stage.agents', 'guard', 'gate.away', 'design.mockup', 'sensitive.review']);
    assert.deepEqual(plain(T.TIE), ['balanced', 'free', 'steady']);
    for (const id of T.TIE) assert.deepEqual(Object.keys(T.STY[id]).sort(), plain(T.SKEYS).concat('land.archivePlan').sort(), id);
    assert.equal(T.STY.free['stage.agents'], 'survey,design,plan,build,verify,audit,land');
});

test('in English the table has no Chinese, and every Chinese literal has its English', () => {
    const { T, win } = boot();
    win.FK_I18N = { lang: 'en' };
    const text = JSON.stringify([T.chapters(), T.order(), T.steps()]);
    assert.doesNotMatch(text, /[\u3400-\u9fff]/);
    assert.deepEqual(stringsLeft('settings-steps.js', plain(T.EN)), []);
});

test('the agents table\'s selects may shrink at 390px', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'settings-steps.css'), 'utf8');
    assert.ok(css.includes('.v9-at select{min-width:0;width:100%}'));
});
```

2. 跑 `node --test --require ./tests/subprocess-timeout.js tests/station-settings-steps.test.js`，看它失敗（`page()` 讀 `assets/station/settings-steps.js` 時 ENOENT）。
3. 寫 `assets/station/settings-steps.js`。字串一律經 `loc('ss.<key>', '…')` 並在 `EN` 有英文（`stringsLeft` 逐行檢查，一個 `loc(` 呼叫不可跨行）；寫入值照 v9-data JSON，`$git` 是新的（Task 7 換成 `/station/suggest` 的 `commitFormat`）：

```js
'use strict';
// assets/station/settings-steps.js — the step table of 詳細設定 (station-39;
// mockup .fankeel/build/2026-10-21-station-redesign/route-settings-v9.html,
// its v9-data JSON and step markup). chapters() is the ten chapters, order()
// every step as [id, chapter, rail name] — the ten quick questions
// FK_SETTINGS.questions() owns and the 23 steps() carries here with their
// question, why, options (label, effect, short answer for the rail, writes,
// rec, risk, pending tag) and input field. A write value `$in` is the text
// typed into the field, `$each` the prompt.<stage> fields, `$git` the commit
// format GET /station/suggest inferred; `prompt.*` and `notify.*` are keys
// settings-detail.js expands. STY / SKEYS / TIE are the style step's three
// styles, the keys a style is compared on, and the order ties go in.
// Strings are built on each call, so the language switch reaches them.
(function (w) {
    var EN = {
        'ss.chQuick': 'Quick setup',
        'ss.chInteg': 'Integrating and landing',
        'ss.chParallel': 'Parallel work and isolation',
        'ss.chVerify': 'Verification and flow',
        'ss.chCost': 'Cost and models',
        'ss.chContext': 'Context and autonomy',
        'ss.chAway': 'Away from the computer',
        'ss.chText': 'Reports and text',
        'ss.chSafety': 'Safety',
        'ss.chOther': 'Other',
        'ss.rMain': 'Into main',
        'ss.rPush': 'Push to remote',
        'ss.rSessions': 'Sessions at once',
        'ss.rGates': 'Stages to pass',
        'ss.rFloor': 'Subagent models',
        'ss.rCtx': 'Main conversation',
        'ss.rWhere': 'Where you are at a gate',
        'ss.rScreen': 'Draw mockups',
        'ss.rStyle': 'Closest style',
        'ss.rArchive': 'Archive plans',
        'ss.rCommitfmt': 'Commit format',
        'ss.rWt': 'Worktrees for',
        'ss.rInflight': 'Agents at once',
        'ss.rSreview': 'Sensitive review',
        'ss.rSeclocal': 'Local security screen',
        'ss.rSkill': 'Mockup skills',
        'ss.rPrompt': 'Extra prompts',
        'ss.rJudge': 'Judge model',
        'ss.rAgents': 'Single subagents',
        'ss.rQuota': 'Weekly budget',
        'ss.rCompact': 'Auto compact',
        'ss.rLink': 'Links in chat',
        'ss.rNotify': 'Notifications',
        'ss.rNtfy': 'Push server',
        'ss.rRemote': 'Phone remote',
        'ss.rHold': 'Phone wait',
        'ss.rLang': 'Report language',
        'ss.rProse': 'Prose style',
        'ss.rUilang': 'Interface language',
        'ss.rSmode': 'Sensitive words',
        'ss.rHide': 'Hide from station',
        'ss.rChart': 'Chartroom',
        'ss.rInitskip': 'Onboarding hint',
        'ss.rec': 'Recommended',
        'ss.recGit': 'From git',
        'ss.riskCost': 'Cost',
        'ss.riskNo': 'Not recommended',
        'ss.riskOpen': 'Opens it up',
        'ss.riskHide': 'Needs a command to undo',
        'ss.pend': 'Pending',
        'ss.pendWhy': 'The remote connection is not settled',
        'ss.styleT': 'What should fill the questions you did not answer?',
        'ss.styleY': 'A style compares only 7 settings: stages, subagent model, handed-off stages, file clashes, before you leave, mockups and the sensitive review. How work reaches main, pushing and worktrees are facts of the repo and are not compared. A style only fills what you did not answer; your answers stay.',
        'ss.styleSteady': 'Steady',
        'ss.styleSteadyE': 'Every step in view, generous models',
        'ss.styleBalanced': 'Balanced',
        'ss.styleBalancedE': 'Reading and doing handed off, decisions left to you',
        'ss.styleFree': 'Hands-off',
        'ss.styleFreeE': 'The main session only relays paths and goes on without you',
        'ss.styleNone': 'Only my answers',
        'ss.styleNoneE': 'Unasked settings keep their current values',
        'ss.styleNoneS': 'Answers only',
        'ss.archiveT': 'After land, move the plan into the archive?',
        'ss.archiveY': 'Only tasks that ran the plan stage (architectural) have a plan to archive.',
        'ss.archiveTrue': 'Archive',
        'ss.archiveTrueE': 'Moved into the archive when done',
        'ss.archiveFalse': 'Keep',
        'ss.archiveFalseE': 'The plan stays in plans/',
        'ss.archiveAsk': 'Ask me each time',
        'ss.archiveAskE': 'Asked at land',
        'ss.archiveAskS': 'Ask',
        'ss.fmtT': 'Check the format of a commit\'s first line?',
        'ss.fmtY': 'Only commits sent by commit.js and land.js merge are checked, not a git commit you type yourself. A pattern without merge blocks land.js merge, so the format read from git already includes merge.',
        'ss.fmtNone': 'Don\'t check',
        'ss.fmtNoneE': 'The format is not looked at',
        'ss.fmtGit': 'The format git history uses',
        'ss.fmtGitE': 'Starts with type:, merge included',
        'ss.fmtGitS': 'type: format',
        'ss.fmtOwn': 'My own pattern',
        'ss.fmtOwnE': 'The first line must match yours',
        'ss.fmtOwnS': 'Custom',
        'ss.fmtField': 'Pattern the first line must match',
        'ss.wtT': 'Which tasks get their own worktree?',
        'ss.wtY': 'Starting a task opens .fankeel/worktrees/<id> and a fk/<id> branch, decided once at the start. A task with no class runs all 7 stages and counts as architectural.',
        'ss.wtFalse': 'None',
        'ss.wtFalseE': 'Everything in the current checkout',
        'ss.wtBounded': 'bounded and up',
        'ss.wtBoundedE': 'Every task with a clear scope or larger',
        'ss.wtArch': 'architectural only',
        'ss.wtArchE': 'Tasks with no class count too',
        'ss.wtTrue': 'Always',
        'ss.wtTrueE': 'Even a spike gets its own worktree',
        'ss.sreviewT': 'Add a sensitive-data pass to reviews?',
        'ss.sreviewY': 'Reviewers at plan, build and verify run one more Sensitive lens. It finds something only when .fankeel/sensitive.txt exists.',
        'ss.yes': 'Yes',
        'ss.no': 'No',
        'ss.sreviewTrueE': 'One more pass every review',
        'ss.sreviewFalseE': 'A normal review',
        'ss.secT': 'Screen security with a local model first?',
        'ss.secY': 'Verify first screens security candidates with a local ollama model, then hands them to the reviewer. Unset keeps the usual flow.',
        'ss.secNoneE': 'The usual verify flow',
        'ss.secOllama': 'An ollama model',
        'ss.secOllamaE': 'Screened once, then handed to the reviewer',
        'ss.secField': 'ollama model name',
        'ss.skillT': 'Which skills load when a mockup is drawn?',
        'ss.skillY': 'Pick several or none. fankeel\'s own design guide always loads. Not asked when question 8 says no mockups.',
        'ss.skillImpE': 'Review, polish and simplify an interface',
        'ss.skillTasteE': 'Layout and style direction that avoids the template look',
        'ss.skillFrontE': 'Set a direction first, one bold move',
        'ss.skillUiE': 'Colour, type and accessibility checklists',
        'ss.promptT': 'Add your own rule to a stage?',
        'ss.promptY': 'Written as prompt.all or prompt.<stage>: one sentence appended to that stage\'s injected rules, injected and paid for on every turn.',
        'ss.promptAdv': 'Advanced, not recommended',
        'ss.promptWarn': 'Injected every turn, it overrides the stage\'s rules and is hard to debug; better left alone for now.',
        'ss.promptNone': 'None',
        'ss.promptNoneE': 'Each stage keeps its own rules',
        'ss.promptAdd': 'I\'ll write my own',
        'ss.promptAddE': 'Opens a field per stage; only what you fill in is written',
        'ss.promptAddS': 'Custom',
        'ss.promptAll': 'Every stage gets',
        'ss.promptAllPh': 'One sentence, e.g. run npm test before a change',
        'ss.promptOne': 'Only one stage gets',
        'ss.promptOnePh': 'Only {stage}',
        'ss.judgeT': 'Which model judges /fankeel-ask?',
        'ss.judgeY': 'It costs only when you ask the judge yourself. The judge answers once; the answer is filed verbatim and followed.',
        'ss.judgeFableE': 'Strongest; spends only when you ask',
        'ss.judgeOpusE': 'A little cheaper',
        'ss.judgeSonnetE': 'Cheapest',
        'ss.agentsT': 'Which model and effort for each subagent?',
        'ss.agentsY': 'A change is written as agent.<name>.model / effort, and a copy in .claude/agents/ overrides the plugin\'s agent file; it takes effect in a new session. Default means unset, as the agent file says.',
        'ss.agentsCol': 'Subagent',
        'ss.agentsModel': 'Model',
        'ss.agentsDef': 'Default · {v}',
        'ss.agentsAriaM': '{a} model',
        'ss.agentsAriaE': '{a} effort',
        'ss.agentsNote': 'Bold means changed; Default means unset, as the plugin\'s agent file says.',
        'ss.quotaT': 'What is your weekly budget?',
        'ss.quotaY': 'Reports only: spend shows its share of the week. quota.js writes it to this machine.',
        'ss.quotaNone': 'None',
        'ss.quotaNoneE': 'The spend page shows no share',
        'ss.quotaUsd': 'In dollars',
        'ss.quotaUsdE': 'Spend shows its % of the week',
        'ss.quotaUsdS': 'Dollars',
        'ss.quotaField': 'Weekly budget (USD)',
        'ss.compactT': 'At what size does the main conversation compact?',
        'ss.compactY': 'Only for sessions running a fankeel task. Earlier keeps context small; later keeps more of the original text.',
        'ss.c350': '350k tokens',
        'ss.c350E': 'Compacts early, context stays small',
        'ss.c350S': '350k',
        'ss.c450': '450k tokens',
        'ss.c450E': 'Built-in',
        'ss.c450S': '450k',
        'ss.c1m': '1M tokens',
        'ss.c1mE': 'Keeps as much original text as it can',
        'ss.c1mS': '1M',
        'ss.cOff': 'Never',
        'ss.cOffE': 'Context keeps growing',
        'ss.cOffS': 'Off',
        'ss.linkT': 'For handed-off stages, print only links in chat?',
        'ss.linkY': 'Only for stages handed to a stage agent: chat prints the path and a station link instead of the full report. With the station closed it prints in full.',
        'ss.linkLink': 'Links only',
        'ss.linkLinkE': 'Read reports on the station',
        'ss.linkFull': 'Full text',
        'ss.linkFullE': 'The full report prints in chat too',
        'ss.linkNote': 'Question 6 keeps every stage in the main conversation, so nothing is handed off and this has no effect.',
        'ss.notifyT': 'What gets pushed to your phone?',
        'ss.notifyY': 'Pushed with ntfy; the topic is made when you turn a push on. Read from this machine only, so a cloned repo sends nothing to another one.',
        'ss.nGate': 'A gate is waiting',
        'ss.nGateE': 'Rings, with an open-gate button',
        'ss.nStage': 'Next stage',
        'ss.nStageE': 'Silent',
        'ss.nStageS': 'Stage',
        'ss.nEnd': 'Task ended',
        'ss.nEndE': 'Silent, with the cost',
        'ss.nEndS': 'End',
        'ss.ntfyT': 'Which ntfy server gets the pushes?',
        'ss.ntfyY': 'On the public server the topic is the password. Fill in the address if you host your own.',
        'ss.ntfyPubE': 'Public server, nothing to host',
        'ss.ntfyOwn': 'Self-hosted',
        'ss.ntfyOwnE': 'Pushes skip the public service',
        'ss.ntfyOwnS': 'Own',
        'ss.ntfyField': 'Server address',
        'ss.remoteT': 'Should your phone reach the station?',
        'ss.remoteY': 'The phone sees the station once paired. How it connects remotely is not settled yet: Tailscale, or a VPN that also covers the LAN; this question is marked until then.',
        'ss.remoteFalse': 'No',
        'ss.remoteFalseE': 'The station opens on this machine only',
        'ss.remoteTrueE': 'Remote connection pending: Tailscale or a VPN that covers the LAN',
        'ss.holdT': 'With the phone attached, how long to wait for you?',
        'ss.holdY': 'With a phone attached, each turn waits this long for the phone\'s next message, then hands the session back to the computer.',
        'ss.h300': '5 minutes',
        'ss.h300E': 'Hands back early when you don\'t answer',
        'ss.h300S': '5 min',
        'ss.h600': '10 minutes',
        'ss.h600E': 'Time to step away briefly',
        'ss.h600S': '10 min',
        'ss.h1800': '30 minutes',
        'ss.h1800E': 'Built-in, and the maximum',
        'ss.h1800S': '30 min',
        'ss.proseT': 'How should text for people be written?',
        'ss.proseY': 'Stage agents and the writer use this style for text people read; the build stage does not.',
        'ss.pWriterE': 'Conclusion first, then an example',
        'ss.pPlainE': 'Plain short sentences',
        'ss.pSepiaE': 'Long and short sentences mixed',
        'ss.pCustomE': 'As .fankeel/prose.md says',
        'ss.uiT': 'Which language does the station use?',
        'ss.uiY': 'The language of station pages, the panel and the band; read from this machine only. The globe at the top right switches it too.',
        'ss.uiAuto': 'Follow the browser',
        'ss.uiAutoE': 'The panel stays Chinese',
        'ss.uiZh': 'Chinese',
        'ss.uiZhE': 'Chinese whatever the browser',
        'ss.uiEnE': 'English whatever the browser',
        'ss.smodeT': 'What happens when a commit carries a sensitive word?',
        'ss.smodeY': 'Sensitive words are listed in .fankeel/sensitive.txt, made by fankeel-init\'s sensitive-words step. With a warning only, the word still goes into the commit.',
        'ss.smWarn': 'Warn only',
        'ss.smWarnE': 'The commit still goes in',
        'ss.smWarnS': 'Warn',
        'ss.smBlock': 'Block',
        'ss.smBlockE': 'The commit is not sent',
        'ss.hideT': 'Hide this project from the station?',
        'ss.hideY': 'Hidden, its sessions and settings leave the station and only a command brings them back.',
        'ss.hideFalse': 'Show',
        'ss.hideFalseE': 'Shown as usual',
        'ss.hideFalseS': 'Shown',
        'ss.hideTrue': 'Hide',
        'ss.hideTrueE': 'Only a command brings it back',
        'ss.chartT': 'Where is Chartroom installed?',
        'ss.chartY': 'The station shows the board only with a path set. Read from this machine only.',
        'ss.chartNone': 'Not installed',
        'ss.chartNoneE': 'The station shows no board',
        'ss.chartPath': 'Install path',
        'ss.chartPathE': 'The station gains a board',
        'ss.chartPathS': 'Set',
        'ss.chartField': 'Chartroom install path',
        'ss.initT': 'Still hint at onboarding when a task starts?',
        'ss.initY': 'For a project not yet onboarded, task.js start prints an onboard: line reminding you to run fankeel-init.',
        'ss.initFalse': 'Hint me',
        'ss.initFalseS': 'Hint',
        'ss.initFalseE': 'Projects not yet onboarded get a reminder',
        'ss.initTrueE': 'No more fankeel-init reminders',
        'ss.initTrueS': 'No hint',
    };
    function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    function kit() { return (w && w.FK_KIT) || {}; }
    function loc(key, zh, vars) {
        var I = w && w.FK_I18N;
        var s = I && I.lang === 'en' && has(EN, key) ? EN[key] : zh;
        return kit().fillVars ? kit().fillVars(s, vars) : s;
    }
    // One option: its value, label, effect, writes, then anything else
    // (s: the short answer the rail prints, rec, risk, pend, input).
    function O(o, label, effect, writes, x) {
        var r = { o: o, label: label, effect: effect, s: label, w: writes || {}, rec: '', risk: '', pend: '', pendWhy: '', input: false };
        Object.keys(x || {}).forEach(function (k) { r[k] = x[k]; });
        return r;
    }
    // The style step compares a style with the answers on these keys only
    // (v9-data `skeys`); a style also fills land.archivePlan.
    var SKEYS = ['class.default', 'dispatch.floor', 'stage.agents', 'guard', 'gate.away', 'design.mockup', 'sensitive.review'];
    var STY = {
        steady: { 'class.default': '', 'dispatch.floor': 'opus', 'stage.agents': '', 'guard': 'ask', 'gate.away': 'hint', 'design.mockup': 'opus', 'sensitive.review': 'true', 'land.archivePlan': '' },
        balanced: { 'class.default': '', 'dispatch.floor': 'sonnet', 'stage.agents': 'survey,build,verify', 'guard': 'ask', 'gate.away': 'hint', 'design.mockup': 'auto', 'sensitive.review': 'false', 'land.archivePlan': 'true' },
        free: { 'class.default': 'bounded', 'dispatch.floor': 'sonnet', 'stage.agents': 'survey,design,plan,build,verify,audit,land', 'guard': 'deny', 'gate.away': 'ask', 'design.mockup': 'auto', 'sensitive.review': 'false', 'land.archivePlan': 'true' },
    };
    // A tie between two styles goes to the first in this order.
    var TIE = ['balanced', 'free', 'steady'];
    var LINK_ALL = 'survey,design,plan,build,verify,land';

    function chapters() {
        return [
            { id: 'quick', n: loc('ss.chQuick', '快速設定') },
            { id: 'integ', n: loc('ss.chInteg', '整合收尾') },
            { id: 'parallel', n: loc('ss.chParallel', '平行與隔離') },
            { id: 'verify', n: loc('ss.chVerify', '驗證與流程') },
            { id: 'cost', n: loc('ss.chCost', '成本與模型') },
            { id: 'context', n: loc('ss.chContext', 'Context 與自主') },
            { id: 'away', n: loc('ss.chAway', '離開電腦時'), machine: true },
            { id: 'text', n: loc('ss.chText', '報告與文字') },
            { id: 'safety', n: loc('ss.chSafety', '安全') },
            { id: 'other', n: loc('ss.chOther', '其他') },
        ];
    }
    function order() {
        return [
            ['main', 'quick', loc('ss.rMain', '怎麼進 main')],
            ['push', 'quick', loc('ss.rPush', '推不推遠端')],
            ['sessions', 'quick', loc('ss.rSessions', '同時幾個 session')],
            ['gates', 'quick', loc('ss.rGates', '過幾關')],
            ['floor', 'quick', loc('ss.rFloor', '子代理省或穩')],
            ['ctx', 'quick', loc('ss.rCtx', '主對話留多少')],
            ['where', 'quick', loc('ss.rWhere', 'gate 等你時你在哪')],
            ['screen', 'quick', loc('ss.rScreen', '畫不畫 mockup')],
            ['style', 'quick', loc('ss.rStyle', '最接近的風格')],
            ['archive', 'integ', loc('ss.rArchive', '計畫封存')],
            ['commitfmt', 'integ', loc('ss.rCommitfmt', 'commit 格式')],
            ['wt', 'parallel', loc('ss.rWt', '哪些任務開 worktree')],
            ['inflight', 'parallel', loc('ss.rInflight', '一次派幾個')],
            ['sreview', 'verify', loc('ss.rSreview', '查敏感資料')],
            ['seclocal', 'verify', loc('ss.rSeclocal', '本機安全初篩')],
            ['skill', 'verify', loc('ss.rSkill', 'mockup 另載 skill')],
            ['prompt', 'verify', loc('ss.rPrompt', '附加 prompt')],
            ['judge', 'cost', loc('ss.rJudge', '判官模型')],
            ['agents', 'cost', loc('ss.rAgents', '個別子代理')],
            ['quota', 'cost', loc('ss.rQuota', '一週額度')],
            ['compact', 'context', loc('ss.rCompact', '自動壓縮')],
            ['link', 'context', loc('ss.rLink', 'chat 只印連結')],
            ['notify', 'away', loc('ss.rNotify', '推播哪些事')],
            ['ntfy', 'away', loc('ss.rNtfy', '推播伺服器')],
            ['remote', 'away', loc('ss.rRemote', '手機遠端')],
            ['hold', 'away', loc('ss.rHold', '手機等你多久')],
            ['lang', 'text', loc('ss.rLang', '報告語言')],
            ['prose', 'text', loc('ss.rProse', '文字風格')],
            ['uilang', 'text', loc('ss.rUilang', '介面語言')],
            ['smode', 'safety', loc('ss.rSmode', '敏感詞 commit')],
            ['hide', 'other', loc('ss.rHide', '監控站隱藏')],
            ['chart', 'other', loc('ss.rChart', '架構白板')],
            ['initskip', 'other', loc('ss.rInitskip', '首次整理提示')],
        ];
    }
    function steps() {
        var rec = loc('ss.rec', '推薦'), cost = loc('ss.riskCost', '花費');
        var list = [
            { id: 'style', kind: 'style', title: loc('ss.styleT', '沒問到的，照哪種風格補？'), why: loc('ss.styleY', '風格只比 7 項：走幾站、子代理模型、交出去的站、撞檔、離開前、mockup、敏感資料審查。怎麼進 main、推不推、worktree 是 repo 的事實，不拿來比。採用只補沒答到的，你答的不變。'), opts: [
                O('steady', loc('ss.styleSteady', '穩健'), loc('ss.styleSteadyE', '每一步看得到，模型給足')),
                O('balanced', loc('ss.styleBalanced', '平衡'), loc('ss.styleBalancedE', '讀和做交出去，決策留給你')),
                O('free', loc('ss.styleFree', '放手'), loc('ss.styleFreeE', '主控只轉路徑，你不在也繼續')),
                O('none', loc('ss.styleNone', '只用我的答案'), loc('ss.styleNoneE', '沒問到的維持現在的值'), {}, { s: loc('ss.styleNoneS', '只用答案') })] },
            { id: 'archive', kind: 'one', title: loc('ss.archiveT', 'land 完，計畫要移進 archive 嗎？'), why: loc('ss.archiveY', '只有走了 plan 站的任務（architectural）才有計畫可封存。'), opts: [
                O('true', loc('ss.archiveTrue', '封存'), loc('ss.archiveTrueE', '做完就移進 archive'), { 'land.archivePlan': 'true' }),
                O('false', loc('ss.archiveFalse', '留著'), loc('ss.archiveFalseE', '計畫留在 plans/ 裡'), { 'land.archivePlan': 'false' }),
                O('ask', loc('ss.archiveAsk', '每次問我'), loc('ss.archiveAskE', '收尾時再問'), { 'land.archivePlan': '' }, { s: loc('ss.archiveAskS', '每次問') })] },
            { id: 'commitfmt', kind: 'one', title: loc('ss.fmtT', 'commit 第一行要檢查格式嗎？'), why: loc('ss.fmtY', '只檢查 commit.js 與 land.js merge 送出的 commit，你自己打的 git commit 不檢查。正規式沒包含 merge 會擋住 land.js merge，所以從 git 推出的格式已經加上 merge。'),
                field: { label: loc('ss.fmtField', '第一行要符合的正規式'), ph: '^(feat|fix): ', mono: true }, opts: [
                O('none', loc('ss.fmtNone', '不檢查'), loc('ss.fmtNoneE', '送出時不看格式'), { 'commit.format': '' }),
                O('git', loc('ss.fmtGit', '照 git 紀錄的格式'), loc('ss.fmtGitE', 'type: 開頭，含 merge'), { 'commit.format': '$git' }, { s: loc('ss.fmtGitS', 'type: 格式'), rec: loc('ss.recGit', 'git 推薦') }),
                O('own', loc('ss.fmtOwn', '自己寫正規式'), loc('ss.fmtOwnE', '第一行要符合你寫的'), { 'commit.format': '$in' }, { s: loc('ss.fmtOwnS', '自訂'), input: true })] },
            { id: 'wt', kind: 'one', title: loc('ss.wtT', '哪些任務要另開 worktree？'), why: loc('ss.wtY', '起任務時開 .fankeel/worktrees/<id> 與 fk/<id> 分支，只在開始時判斷一次。沒指定類別的任務走全部 7 站，會被當成 architectural。'), opts: [
                O('false', loc('ss.wtFalse', '不開'), loc('ss.wtFalseE', '都在目前的 checkout 裡做'), { worktree: 'false' }),
                O('bounded', loc('ss.wtBounded', 'bounded 以上'), loc('ss.wtBoundedE', '範圍清楚以上的任務都開'), { worktree: 'bounded' }),
                O('architectural', loc('ss.wtArch', '只有 architectural'), loc('ss.wtArchE', '沒指定類別的任務也算在內'), { worktree: 'architectural' }, { s: 'architectural' }),
                O('true', loc('ss.wtTrue', '一律開'), loc('ss.wtTrueE', '連 spike 也開自己的 worktree'), { worktree: 'true' })] },
            { id: 'sreview', kind: 'one', title: loc('ss.sreviewT', 'review 時要多查一輪敏感資料嗎？'), why: loc('ss.sreviewY', 'plan、build、verify 的 reviewer 多跑一輪 Sensitive lens。要有 .fankeel/sensitive.txt 才查得到東西。'), opts: [
                O('true', loc('ss.yes', '要'), loc('ss.sreviewTrueE', '每次 review 多一輪'), { 'sensitive.review': 'true' }, { risk: cost }),
                O('false', loc('ss.no', '不用'), loc('ss.sreviewFalseE', '照一般 review'), { 'sensitive.review': 'false' })] },
            { id: 'seclocal', kind: 'one', title: loc('ss.secT', '安全審查要先用本機模型篩嗎？'), why: loc('ss.secY', 'verify 先用本機的 ollama 模型篩一輪 security 候選，再交給 reviewer。不設就照原本流程。'),
                field: { label: loc('ss.secField', 'ollama 模型名稱'), ph: 'qwen2.5-coder:14b', mono: true }, opts: [
                O('none', loc('ss.no', '不用'), loc('ss.secNoneE', '照原本的 verify 流程'), { 'security.local': '' }),
                O('ollama', loc('ss.secOllama', '用 ollama 模型'), loc('ss.secOllamaE', '先篩一輪，再交給 reviewer'), { 'security.local': '$in' }, { s: 'ollama', input: true })] },
            { id: 'skill', kind: 'multi', key: 'design.skill', cond: 'skill', title: loc('ss.skillT', '畫 mockup 時，另外載哪些 skill？'), why: loc('ss.skillY', '可以多選，也可以都不載。fankeel 自己的設計指南一律會載。第 8 題選「不畫」時不問這題。'), opts: [
                O('impeccable:impeccable', 'impeccable', loc('ss.skillImpE', '審查、修整、精簡介面')),
                O('taste-skill:taste-skill', 'taste-skill', loc('ss.skillTasteE', '版面與風格方向，避開範本感')),
                O('frontend-design:frontend-design', 'frontend-design', loc('ss.skillFrontE', '先定方向，一處大膽')),
                O('ui-ux-pro-max:ui-ux-pro-max', 'ui-ux-pro-max', loc('ss.skillUiE', '配色、字體與無障礙清單'))] },
            { id: 'prompt', kind: 'one', title: loc('ss.promptT', '要替某一站加自訂規則嗎？'), why: loc('ss.promptY', '寫成 prompt.all 或 prompt.<站>：一句話附在那一站注入規則的最後，每一輪都注入，每輪都付 token。'),
                adv: loc('ss.promptAdv', '進階・不建議'), warn: loc('ss.promptWarn', '每輪都注入，會蓋過站的規則、難除錯；建議先別用。'),
                field: { each: true, label: loc('ss.promptAll', '每一站都附加'), ph: loc('ss.promptAllPh', '一句話，例如：改動前先跑 npm test'), one: loc('ss.promptOne', '只附加在某一站'), onePh: loc('ss.promptOnePh', '只附加在 {stage}') }, opts: [
                O('none', loc('ss.promptNone', '不加'), loc('ss.promptNoneE', '照各站原本的規則'), { 'prompt.*': '' }, { rec: rec }),
                O('add', loc('ss.promptAdd', '我要自訂'), loc('ss.promptAddE', '展開每一站的欄位，只寫你填了的'), { 'prompt.$each': '$each' }, { s: loc('ss.promptAddS', '自訂'), risk: loc('ss.riskNo', '不建議'), input: true })] },
            { id: 'judge', kind: 'one', title: loc('ss.judgeT', '/fankeel-ask 交給哪個模型判？'), why: loc('ss.judgeY', '只有你手動問判官時才會花。判官只答一次，答案原文存檔後照著做。'), opts: [
                O('fable', 'fable', loc('ss.judgeFableE', '最強；只在你問時才花'), { 'judge.model': 'fable' }),
                O('opus', 'opus', loc('ss.judgeOpusE', '便宜一些'), { 'judge.model': 'opus' }),
                O('sonnet', 'sonnet', loc('ss.judgeSonnetE', '最省'), { 'judge.model': 'sonnet' })] },
            { id: 'agents', kind: 'table', title: loc('ss.agentsT', '個別子代理要用哪個模型、多少 effort？'), why: loc('ss.agentsY', '改了的寫成 agent.<名字>.model／effort，在 .claude/agents/ 放一份副本蓋過 plugin 的 agent 檔；要開新的 session 才生效。選「預設」就是不設，照 agent 檔。'), opts: [],
                table: { agent: loc('ss.agentsCol', '子代理'), model: loc('ss.agentsModel', '模型'), effort: 'effort', def: loc('ss.agentsDef', '預設 · {v}'),
                    ariaM: loc('ss.agentsAriaM', '{a} 的模型'), ariaE: loc('ss.agentsAriaE', '{a} 的 effort'), note: loc('ss.agentsNote', '粗體是改過的；選「預設」就是不設，照 plugin 的 agent 檔。') } },
            { id: 'quota', kind: 'one', title: loc('ss.quotaT', '你一週的額度是多少？'), why: loc('ss.quotaY', '只影響報表：花費旁顯示佔一週的比例。由 quota.js 寫進這台機器。'),
                field: { label: loc('ss.quotaField', '一週額度（美元）'), ph: '200', pre: '$', mode: 'decimal' }, opts: [
                O('none', loc('ss.quotaNone', '不設'), loc('ss.quotaNoneE', '花費頁不顯示比例'), { 'quota.week': '' }),
                O('usd', loc('ss.quotaUsd', '填美元'), loc('ss.quotaUsdE', '花費旁顯示佔一週幾 %'), { 'quota.week': '$in' }, { s: loc('ss.quotaUsdS', '美元'), input: true })] },
            { id: 'compact', kind: 'one', title: loc('ss.compactT', '主對話多大時自動壓縮？'), why: loc('ss.compactY', '只對正在跑 fankeel 任務的 session。壓得早，context 小；壓得晚，保留的原文多。'), opts: [
                O('350000', loc('ss.c350', '35 萬 token'), loc('ss.c350E', '早一點壓，context 保持小'), { 'compact.at': '350000' }, { s: loc('ss.c350S', '35 萬') }),
                O('450000', loc('ss.c450', '45 萬 token'), loc('ss.c450E', '內建值'), { 'compact.at': '450000' }, { s: loc('ss.c450S', '45 萬') }),
                O('1000000', loc('ss.c1m', '100 萬 token'), loc('ss.c1mE', '盡量保留原文'), { 'compact.at': '1000000' }, { s: loc('ss.c1mS', '100 萬') }),
                O('off', loc('ss.cOff', '不自動壓縮'), loc('ss.cOffE', 'context 一路長'), { 'compact.at': 'off' }, { s: loc('ss.cOffS', '不壓') })] },
            { id: 'link', kind: 'one', title: loc('ss.linkT', '交出去的站，chat 只印連結嗎？'), why: loc('ss.linkY', '只對交給站 agent 的站有效：chat 只印路徑和監控站連結，不印報告全文。監控站沒開時照印。'),
                note: loc('ss.linkNote', '第 6 題選了「留在主對話」，沒有交出去的站，這題不作用。'), opts: [
                O('link', loc('ss.linkLink', '只印連結'), loc('ss.linkLinkE', '報告到監控站看'), { 'station.link': LINK_ALL }),
                O('full', loc('ss.linkFull', '印全文'), loc('ss.linkFullE', '報告全文也印在 chat'), { 'station.link': '' })] },
            { id: 'notify', kind: 'multi', key: 'notify.*', title: loc('ss.notifyT', '哪些事要推播到手機？'), why: loc('ss.notifyY', '用 ntfy 推播；topic 在開推播時自動產生。只讀這台機器的設定，clone 下來的 repo 不會把問題送到別台。'), opts: [
                O('gate', loc('ss.nGate', 'gate 在等你'), loc('ss.nGateE', '會響，附「打開 gate」'), {}, { s: 'gate' }),
                O('stage', loc('ss.nStage', '換到下一站'), loc('ss.nStageE', '靜音'), {}, { s: loc('ss.nStageS', '換站') }),
                O('end', loc('ss.nEnd', '任務結束'), loc('ss.nEndE', '靜音，附花費'), {}, { s: loc('ss.nEndS', '結束') })] },
            { id: 'ntfy', kind: 'one', title: loc('ss.ntfyT', '推播送到哪個 ntfy？'), why: loc('ss.ntfyY', '公開伺服器上，topic 就是密碼。自架的話填網址。'),
                field: { label: loc('ss.ntfyField', '伺服器網址'), ph: 'https://ntfy.example.lan', mono: true }, opts: [
                O('pub', 'ntfy.sh', loc('ss.ntfyPubE', '公開伺服器，不用架'), { 'notify.server': 'https://ntfy.sh' }),
                O('own', loc('ss.ntfyOwn', '自架伺服器'), loc('ss.ntfyOwnE', '推播不經過公開服務'), { 'notify.server': '$in' }, { s: loc('ss.ntfyOwnS', '自架'), input: true })] },
            { id: 'remote', kind: 'one', title: loc('ss.remoteT', '手機要能連進監控站嗎？'), why: loc('ss.remoteY', '手機配對後才看得到監控站。遠端連線方式還沒定：Tailscale，或同時支援區網的 VPN；這一題先標記。'), opts: [
                O('false', loc('ss.remoteFalse', '不要'), loc('ss.remoteFalseE', '監控站只在這台機器開'), { 'station.remote': 'false' }),
                O('true', loc('ss.yes', '要'), loc('ss.remoteTrueE', '遠端連線方式待定：Tailscale 或支援區網的 VPN'), { 'station.remote': 'true' },
                    { pend: loc('ss.pend', '待定'), pendWhy: loc('ss.pendWhy', '遠端連線方式還沒定'), risk: loc('ss.riskOpen', '對外開放') })] },
            { id: 'hold', kind: 'one', title: loc('ss.holdT', '手機接上時，要等你多久？'), why: loc('ss.holdY', '手機接上 session 時，每回合結束後最多等手機的下一句這麼久；逾時就把 session 交還電腦。'), opts: [
                O('300', loc('ss.h300', '5 分鐘'), loc('ss.h300E', '沒回就早點交還電腦'), { 'phone.hold': '300' }, { s: loc('ss.h300S', '5 分') }),
                O('600', loc('ss.h600', '10 分鐘'), loc('ss.h600E', '走開一下還來得及'), { 'phone.hold': '600' }, { s: loc('ss.h600S', '10 分') }),
                O('1800', loc('ss.h1800', '30 分鐘'), loc('ss.h1800E', '內建值，也是上限'), { 'phone.hold': '1800' }, { s: loc('ss.h1800S', '30 分') })] },
            { id: 'prose', kind: 'one', title: loc('ss.proseT', '寫給人看的文字要怎麼寫？'), why: loc('ss.proseY', '站 agent 與 writer 寫給人看的文字照這個風格；build 站不套用。'), opts: [
                O('writer', 'writer', loc('ss.pWriterE', '先結論，再附例子'), { 'prose.style': 'writer' }),
                O('plain', 'plain', loc('ss.pPlainE', '白話短句'), { 'prose.style': 'plain' }),
                O('sepia', 'sepia', loc('ss.pSepiaE', '長短句交錯'), { 'prose.style': 'sepia' }),
                O('custom', 'custom', loc('ss.pCustomE', '照 .fankeel/prose.md 寫'), { 'prose.style': 'custom' })] },
            { id: 'uilang', kind: 'one', title: loc('ss.uiT', '監控站介面用什麼語言？'), why: loc('ss.uiY', '監控站頁、面板與 band 的語言；只讀這台機器。右上角的地球也能切換。'), opts: [
                O('auto', loc('ss.uiAuto', '跟著瀏覽器'), loc('ss.uiAutoE', '面板照中文'), { 'ui.lang': '' }),
                O('zh', loc('ss.uiZh', '中文'), loc('ss.uiZhE', '不管瀏覽器，一律中文'), { 'ui.lang': 'zh' }),
                O('en', 'English', loc('ss.uiEnE', '不管瀏覽器，一律英文'), { 'ui.lang': 'en' })] },
            { id: 'smode', kind: 'one', title: loc('ss.smodeT', 'commit 帶到敏感詞時怎麼辦？'), why: loc('ss.smodeY', '敏感詞列在 .fankeel/sensitive.txt，由 fankeel-init 的敏感詞步驟建立。只提醒的話，敏感詞照樣進 commit。'), opts: [
                O('warn', loc('ss.smWarn', '只提醒'), loc('ss.smWarnE', 'commit 照樣進去'), { 'sensitive.mode': 'warn' }, { s: loc('ss.smWarnS', '提醒') }),
                O('block', loc('ss.smBlock', '擋下'), loc('ss.smBlockE', '這個 commit 不送出'), { 'sensitive.mode': 'block' })] },
            { id: 'hide', kind: 'one', title: loc('ss.hideT', '要從監控站隱藏這個專案嗎？'), why: loc('ss.hideY', '隱藏後，這個專案的 session 與設定都不出現在監控站，要用指令才叫得回來。'), opts: [
                O('false', loc('ss.hideFalse', '不隱藏'), loc('ss.hideFalseE', '照常顯示'), { 'station.hide': 'false' }, { s: loc('ss.hideFalseS', '顯示') }),
                O('true', loc('ss.hideTrue', '隱藏'), loc('ss.hideTrueE', '要用指令才叫得回來'), { 'station.hide': 'true' }, { risk: loc('ss.riskHide', '要用指令叫回') })] },
            { id: 'chart', kind: 'one', title: loc('ss.chartT', '架構白板（Chartroom）裝在哪？'), why: loc('ss.chartY', '設了路徑，監控站才有白板。只讀這台機器。'),
                field: { label: loc('ss.chartField', 'Chartroom 安裝路徑'), ph: 'C:\\tools\\chartroom', mono: true }, opts: [
                O('none', loc('ss.chartNone', '沒裝'), loc('ss.chartNoneE', '監控站不顯示白板'), { 'station.chartroom': '' }),
                O('path', loc('ss.chartPath', '填安裝路徑'), loc('ss.chartPathE', '監控站多一個白板'), { 'station.chartroom': '$in' }, { s: loc('ss.chartPathS', '已填'), input: true })] },
            { id: 'initskip', kind: 'one', title: loc('ss.initT', '起任務時還要提示整理專案嗎？'), why: loc('ss.initY', '沒整理過的專案，task.js start 會印一行 onboard: 提醒你跑 fankeel-init。'), opts: [
                O('false', loc('ss.initFalse', '要提示'), loc('ss.initFalseE', '還沒整理的專案會提醒'), { 'init.skip': 'false' }, { s: loc('ss.initFalseS', '提示') }),
                O('true', loc('ss.no', '不用'), loc('ss.initTrueE', '不再提醒 fankeel-init'), { 'init.skip': 'true' }, { s: loc('ss.initTrueS', '不提示') })] },
        ];
        var at = {};
        order().forEach(function (e) { at[e[0]] = e; });
        list.forEach(function (s) { s.ch = at[s.id][1]; s.r = at[s.id][2]; });
        return list;
    }

    var api = { chapters: chapters, order: order, steps: steps, STY: STY, SKEYS: SKEYS, TIE: TIE, EN: EN };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_SETSTEPS = api;
}(typeof window !== 'undefined' ? window : null));
```

4. 寫 `assets/station/settings-steps.css`（Task 8 讓它在 `settings-detail.css` 之前載入；`settings-detail.css` 的 `table.v9-at select{width:100%}` 選擇器更具體，寬度不受影響，`min-width:0` 別處沒設）：

```css
/* assets/station/settings-steps.css — station-39: at 390px the agents
   table's selects (settings-detail.css `.v9-at select`) cut their text;
   they may now shrink with the column instead of holding it open. */
.v9-at select{min-width:0;width:100%}
```

5. 跑 `node --test --require ./tests/subprocess-timeout.js tests/station-settings-steps.test.js`，看 7 個測試通過。
6. Commit：`git add assets/station/settings-steps.js assets/station/settings-steps.css tests/station-settings-steps.test.js` 然後 `git commit -m "feat(station): the detailed settings step table, ten chapters and 33 steps"`。

## Task 7: 詳細設定頁 FK_SETDETAIL

**Files:**
- Modify: `assets/station/settings-detail.js` — 新檔：`FK_SETDETAIL.page(S, o)`，一屏一題、rail（章 → 步，done / current）、到這裡就好 / 繼續、機器卡、風格步、prompt.* 標「進階・不建議」、agents 表、remote 步掛 `FK_REMOTE.html(serve)`、寫入前檢查、經 `FK_SETTINGS.post` 寫 POST `/profile`
- Modify: `assets/station/settings-detail.css` — 新檔：mockup 的 v9 樣式 `route-settings-v9.html:23-263` 原樣
- Read: `.fankeel/build/2026-10-21-station-redesign/route-settings-v9.html:595-999` — 要移植的 mockup script（plan / writes / applies / matches / nowOf / derived / near / pre / sel / changes 與 paint）
- Read: `.fankeel/build/2026-10-21-station-redesign/route-settings-v9.html:265-375` — rail 與機器卡的 markup
- Read: `assets/station/settings-page.js` — Task 5 的共用匯出 `questions()`、`cur()`、`post()`、`MACHINE`、`NAME`
- Read: `assets/station/remote-card.js:210-225` — `FK_REMOTE.html(serve)`
- Read: `assets/station/station.js:6225-6237` — 在 `#/settings` 時輪詢不重畫
- Test: `tests/station-settings-detail.test.js`

**Interfaces:**
- Consumes: `FK_SETSTEPS` 的 chapters()、order()、steps()、STY、SKEYS、TIE（Task 6）；`FK_SETTINGS` 的 `questions()` → [{id, title, why, opts:[{o, t, e, s, w, risk?}]}]、`cur(S, dir, k)` → 字串（布林寫成 true/false、陣列以逗號接）、`post(S, o, rows, done)` 其中 o = {scope: project|machine, project}、rows = [{k, to}]、done(ok)（一次一個 scope）、`MACHINE`、`NAME`（Task 5）；`profileSpec` = {agents:[{name, model, effort}], efforts, set:{machine, projects:{[dir]:{}}}} 與 `/station/suggest` 回的 {front, commitFormat} 與 `/profile`（Task 3）；`FK_KIT` 的 esc、fillVars；`FK_REMOTE` 的 html(serve)
- Produces: `FK_SETDETAIL` = { page(S, o), onClick, onInput, onKey, changes(), rows(), state(), reset(), EN }；page(S, o) 讀 o.hash（無則 location.hash）、o.serve、o.configDir、o.redraw、o.project（無則第一個 S.profiles.projects）

**Dispatch:** implementer, sonnet, high — 程式碼在計畫裡，但要對上 Task 5 實際寫出的 `questions()`／`cur()`／`post()` 形狀（Consumes 那行是約定，Task 5 若不同就改這裡的 `fromQuick()` 與呼叫處），並推理 3 秒重畫與輸入時不重畫的互動。

1. 寫失敗的測試。在 `tests/station-settings-detail.test.js`：

```js
'use strict';
// station-39: 詳細設定 `#/settings/detail[/<step>]` (assets/station/settings-detail.js)
// against the approved mockup route-settings-v9.html — the rail of ten
// chapters, one question a screen, 到這裡就好 / 繼續 at a chapter's end, the
// machine card that holds 常離開, the style that fills only what was not
// answered, prompt.* marked advanced, the agents table, the remote card on
// the remote step, and 寫入 posting the changed keys split project / machine.
const test = require('node:test');
const assert = require('node:assert/strict');
const { page, stringsLeft } = require('./station-module.js');

const DIR = 'F:\\proj';
// The page's values live in its vm; JSON brings them into this realm for deepEqual.
const plain = (x) => JSON.parse(JSON.stringify(x));
const SPEC = {
    keys: {}, efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
    agents: [{ name: 'fankeel-reader', model: 'sonnet', effort: 'medium' }, { name: 'fankeel-judge', model: 'fable', effort: 'xhigh' }],
    set: { machine: {}, projects: { [DIR]: { 'agent.fankeel-reader.model': 'haiku' } } },
};
const VALUES = { 'land.integration': 'merge', worktree: 'false', 'land.push': false, guard: 'ask', 'class.default': '', 'dispatch.floor': 'sonnet',
    'judge.model': 'fable', 'stage.agents': false, 'gate.station': 'off', 'gate.away': 'hint', 'design.mockup': false, 'sensitive.review': false };
function boot(hash, remote) {
    const p = page(['settings-page.js', 'settings-steps.js', 'settings-detail.js'], {
        profiles: { machine: { values: { 'station.remote': false }, sources: {}, unreadable: [] }, projects: { [DIR]: { values: VALUES, sources: {}, unreadable: [] } } },
        profileSpec: SPEC, nonce: 'n1' });
    if (remote) p.win.FK_REMOTE = { html: (serve) => '<div class="rm-card" data-serve="' + serve + '"></div>' };
    else delete p.win.FK_REMOTE;
    const D = p.M['settings-detail.js'];
    const posted = [];
    // Task 5's contract: one scope a call, o = { scope, project }, rows [{ k, to }], done(ok).
    p.win.FK_SETTINGS.post = (S, o, rows, done) => {
        assert.ok(o.scope === 'project' || o.scope === 'machine', 'o.scope');
        if (o.scope === 'project') assert.equal(o.project, DIR);
        for (const r of rows) assert.deepEqual(Object.keys(r).sort(), ['k', 'to']);
        posted.push(plain({ scope: o.scope, project: o.scope === 'project' ? o.project : null, rows }));
        done(true);
    };
    D.reset();
    const o = { hash: hash || '#/settings/detail', serve: true, configDir: 'C:\\cfg', redraw() {} };
    return { D, posted, html: () => D.page(p.win.STATION, o) };
}
// A click (or input) whose target answers closest() for `sel`, the page root
// and, given `data-field`, the field around it.
function ev(sel, attrs, type) {
    const a = attrs || {};
    const el = { disabled: false, value: a.value, checked: a.checked, getAttribute: (n) => (n in a ? a[n] : null),
        closest: (s) => (s === sel || s === '[data-block="v9-page"]' || (s === '[data-field]' && a['data-field']) ? el : null) };
    return { type: type || 'click', target: el, key: a.key, preventDefault() {} };
}
const pick = (D, o) => D.onClick(ev('.v9-opt', { 'data-o': o }));
const goTo = (D, id) => D.onClick(ev('[data-go]', { 'data-go': id }));
const act = (D, a) => D.onClick(ev('[data-act]', { 'data-act': a }));

test('the rail has the ten chapters and every step, and the page opens on the first quick question', () => {
    const { html } = boot();
    const h = html();
    assert.match(h, /data-block="v9-page"/);
    assert.equal((h.match(/<li class="v9-c[ "]/g) || []).length, 10);
    assert.equal((h.match(/class="v9-sb" data-go="/g) || []).length, 33);
    assert.match(h, /class="v9-endb" data-go="final"/);
    assert.match(h, /data-block="v9-q-main" data-step="main"/);
    assert.match(h, /快速設定 · 1 \/ 9/);
    assert.match(h, /<li class="v9-cut" role="presentation">細項：走到哪停都可以<\/li>/);
    assert.match(h, /<span class="v9-mtag"[^>]*>這台機器<\/span>/);
});

test('#/settings/detail/<step> opens that step, and the remote step carries the remote card when there is one', () => {
    let b = boot('#/settings/detail/remote', true);
    const h = b.html();
    assert.match(h, /data-block="v9-away-remote" data-step="remote"[\s\S]*<div class="rm-card" data-serve="true"><\/div><\/div><div class="v9-foot"/);
    assert.match(h, /<span class="v9-tag pend"[^>]*>待定<\/span>/);
    b = boot('#/settings/detail/remote', false);
    assert.doesNotMatch(b.html(), /rm-card/);
});

test('發 PR makes 推不推遠端 not apply, and 下一步 passes over it', () => {
    const { D, html } = boot();
    html();
    pick(D, 'pr');
    assert.match(html(), /<li class="v9-s is-na" data-sid="push">/);
    act(D, 'next');
    assert.equal(D.state().at, 'sessions');
});

test('常離開 holds 下一步 until the machine card is answered, and the card writes the machine', () => {
    const { D, html } = boot();
    html();
    goTo(D, 'where');
    pick(D, 'away');
    let h = html();
    assert.match(h, /data-block="v9-machine-card"/);
    assert.match(h, /data-act="next" disabled/);
    D.onClick(ev('[data-mc]', { 'data-mc': 'yes' }));
    h = html();
    assert.doesNotMatch(h, /data-act="next" disabled/);
    const machine = plain(D.rows()).filter((r) => r.scope === 'machine').map((r) => [r.key, r.value]);
    assert.deepEqual(machine, [['notify.gate', 'true'], ['station.remote', 'true']]);
});

test('a style fills only what was not answered, and a chapter ends on 到這裡就好 / 繼續', () => {
    const { D, html } = boot();
    html();
    goTo(D, 'floor');
    pick(D, 'opus');
    goTo(D, 'style');
    pick(D, 'balanced');
    const by = Object.fromEntries(plain(D.changes()).map((c) => [c.k, [c.to, c.by]]));
    assert.deepEqual(by['dispatch.floor'], ['opus', 'floor']);
    assert.deepEqual(by['stage.agents'], ['survey,build,verify', 'style']);
    const h = html();
    assert.match(h, /data-act="stop"[^>]*>到這裡就好</);
    assert.match(h, /data-act="cont"[^>]*>繼續：<b>整合收尾<\/b>/);
    assert.doesNotMatch(h, /data-act="next"/);
    act(D, 'stop');
    assert.equal(D.state().at, 'final');
});

test('prompt.* is tagged 進階・不建議 with its warning, and what is typed per stage is written', () => {
    const { D, html } = boot();
    html();
    goTo(D, 'prompt');
    const h = html();
    assert.match(h, /<span class="v9-adv">進階・不建議<\/span>/);
    assert.match(h, /class="v9-warnline" role="note"/);
    pick(D, 'add');
    D.onInput(ev('[data-in]', { 'data-in': 'all', 'data-field': 'add', value: 'run npm test' }, 'input'));
    assert.deepEqual(plain(D.rows()).map((r) => [r.scope, r.key, r.value]), [['project', 'prompt.all', 'run npm test']]);
});

test('the agents table has a model and an effort select a subagent, 預設 first, and a change writes agent.<name>.model', () => {
    const { D, html } = boot();
    html();
    goTo(D, 'agents');
    const h = html();
    assert.equal((h.match(/<table class="v9-at">/g) || []).length, 2);
    assert.match(h, /<select data-in="m:fankeel-reader"[^>]*><option value="">預設 · sonnet<\/option><option value="haiku" selected>/);
    assert.match(h, /<select data-in="e:fankeel-judge"[^>]*><option value="" selected>預設 · xhigh<\/option>/);
    D.onInput(ev('[data-in]', { 'data-in': 'm:fankeel-judge', 'data-field': 'table', value: 'opus' }, 'change'));
    assert.deepEqual(plain(D.rows()).map((r) => [r.scope, r.key, r.value]), [['project', 'agent.fankeel-judge.model', 'opus']]);
});

test('寫入 posts the changed keys through FK_SETTINGS.post, then says 已寫入', () => {
    const { D, html, posted } = boot();
    html();
    pick(D, 'pr');
    goTo(D, 'final');
    let h = html();
    assert.match(h, /data-block="v9-final"/);
    assert.match(h, /data-act="write">寫入 3 項</);
    act(D, 'write');
    assert.equal(posted.length, 1, 'one scope, one post');
    assert.equal(posted[0].scope, 'project');
    assert.equal(posted[0].project, DIR);
    assert.deepEqual(posted[0].rows.map((r) => [r.k, r.to]).sort(),
        [['land.integration', 'pr'], ['land.push', 'true'], ['worktree', 'bounded']]);
    h = html();
    assert.match(h, /已寫入 3 項。/);
    assert.match(h, /data-act="write" disabled>已寫入</);
});

test('every Chinese literal has its English', () => {
    const { D } = boot();
    assert.deepEqual(stringsLeft('settings-detail.js', plain(D.EN)), []);
});
```

2. 跑 `node --test --require ./tests/subprocess-timeout.js tests/station-settings-detail.test.js`，看它失敗（`page()` 讀 `assets/station/settings-detail.js` 時 ENOENT）。
3. 寫 `assets/station/settings-detail.js`。移植 `route-settings-v9.html:600-998`：DOM 操作換成 HTML 字串，答案留在模組的 `st`；監聽器在第一次 `page()` 綁在 document（`click`、`input`、`change`、`keydown`）；`input` 只改狀態不重畫（游標），`change` 才重畫；`prompt.*`、`notify.*` 在 `rows()` 展開成真的鍵；不是快速設定的步驟 block 名照 mockup 是 `v9-<章>-<id>`：

```js
'use strict';
// assets/station/settings-detail.js — 詳細設定 `#/settings/detail[/<step>]`
// (station-39; mockup .fankeel/build/2026-10-21-station-redesign/
// route-settings-v9.html, its script :600-998 ported to HTML strings). One
// question a screen; the rail lists the ten chapters with their steps,
// done / current / remaining; a chapter ends on 到這裡就好 / 繼續. The ten
// quick questions come from FK_SETTINGS.questions(), the other 23 from
// FK_SETSTEPS.steps(), in FK_SETSTEPS.order(). Answers stay in memory; the
// final screen shows each changed key old → new, split project / this
// machine, and 寫入 posts them through FK_SETTINGS.post (POST /profile).
// station.js skips the poll's repaint on #/settings, so the page redraws only
// when the reader acts; typing updates state without a redraw (caret).
(function (w, doc) {
    var EN = {
        'sd.rail': 'Settings chapters',
        'sd.steps': 'Step by step',
        'sd.index': 'Chapters and steps',
        'sd.answered': '{d} / {t} answered',
        'sd.cut': 'Details: stop wherever you like',
        'sd.machine': 'This machine',
        'sd.machineTip': 'This chapter writes the whole machine\'s settings',
        'sd.na': 'Not asked',
        'sd.skipped': 'Skipped',
        'sd.check': 'Check and write',
        'sd.nChanges': '{n} changes',
        'sd.wrote': 'Written',
        'sd.wizard': 'Settings wizard',
        'sd.why': 'Why this question',
        'sd.now': 'Current',
        'sd.from': 'Carried',
        'sd.fromTip': 'Carried in by {by}',
        'sd.near': 'Closest',
        'sd.multi': 'Pick several, comma separated',
        'sd.noKeys': 'Fills no key',
        'sd.fills': 'Fills:',
        'sd.differs': '{n} away from your answers',
        'sd.typed': 'The value is what you type below',
        'sd.noChange': 'Changes no setting',
        'sd.unset': 'not written (unset)',
        'sd.onMachine': ' · this machine',
        'sd.notifyOff': 'notify.*: all off',
        'sd.and': ', ',
        'sd.mcHead': 'Also written to this machine',
        'sd.mcQ': 'What this card writes',
        'sd.mcWhy': 'Written to {f}. Only the machine settings are read for these two, so the project file would not take effect, and a cloned repo sends nothing to another machine. How the phone connects remotely is not settled.',
        'sd.mcGate': 'Push to the phone when a gate waits',
        'sd.mcRemote': 'Phone reaches the station remotely',
        'sd.pend': 'Pending',
        'sd.mcPend': 'Remote connection pending: Tailscale or a VPN that covers the LAN',
        'sd.mcOk': 'Confirm, write to this machine',
        'sd.mcNot': 'Not now',
        'sd.mcYes': 'It will be written to this machine.',
        'sd.mcNo': 'This machine stays as it is; you can turn these on under Away from the computer later.',
        'sd.mcWait': 'Confirm or say not now to go on.',
        'sd.byCard': 'Quick setup · question 7\'s machine card',
        'sd.byStyle': 'filled by {n}',
        'sd.langField': 'Language',
        'sd.langPh': 'Deutsch',
        'sd.prev': 'Back',
        'sd.skip': 'Skip this one',
        'sd.stop': 'Stop here',
        'sd.cont': 'Continue: ',
        'sd.next': 'Next',
        'sd.write': 'Write {n}',
        'sd.pos': '{c} · {k} / {n}',
        'sd.posFinal': 'Check before writing',
        'sd.finT': 'Write these changes?',
        'sd.finY': 'Nothing touches profile.json until you press write. The project and this machine are written apart; questions you did not reach keep their current values.',
        'sd.finQ': 'What gets written',
        'sd.finNone': 'Nothing to change: your answers match the current values.',
        'sd.project': 'Project',
        'sd.items': '{g} · {n}',
        'sd.byLine': 'From: {by}',
        'sd.to': 'changed to',
        'sd.left': 'The {n} questions you did not reach keep their current values; pick up from the left any time.',
        'sd.allDone': 'Every question has been through.',
        'sd.okN': '{n} written.',
        'sd.err': 'Not written: {e}',
        'sd.noTable': 'The settings table has not loaded.',
        'sd.unsetV': 'unset',
        'sd.def': 'Default',
        'sd.promptName': 'Extra prompt ({st})',
        'sd.everyStage': 'every stage',
        'sd.agentModel': '{a} model',
        'sd.agentEffort': '{a} effort',
        'sd.none': 'None',
        'sd.changedN': '{n} changed',
        'sd.kept': 'Kept',
        'sd.stageCode': 'prompt.<stage>',
    };
    var STG = ['all', 'survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'];
    var MODELS = ['haiku', 'sonnet', 'opus', 'fable'];
    var EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
    // commit.format when /station/suggest has not answered (v9-data's value).
    var GIT_FMT = '^(chore|docs|feat|fix|merge|test)(\\([^)]+\\))?: ';
    // Keys whose builtin is `false` but whose "off" answer writes '' (unset).
    var BLANK = { 'stage.agents': 1, 'station.link': 1 };
    // Quick questions the detail page asks only sometimes.
    var COND = { push: 'push', screen: 'front' };
    var CHECK = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5 6.5 11.5 12.5 5"/></svg>';
    var WARN = '<svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.2 14.2 13H1.8z"/><path d="M8 6.5v3M8 11.3v.01"/></svg>';
    var CHEV = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 6.2 8 9.8l3.5-3.6"/></svg>';
    var SAVE = '<svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2.5h7.5L13 5v8.5H3z"/><path d="M5.5 2.5v3h4v-3M5.5 13.5V9.5h5v4"/></svg>';

    function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    function kit() { return (w && w.FK_KIT) || {}; }
    function fill(s, vars) { return kit().fillVars ? kit().fillVars(s, vars) : s; }
    function loc(key, zh, vars) {
        var I = w && w.FK_I18N;
        return fill(I && I.lang === 'en' && has(EN, key) ? EN[key] : zh, vars);
    }
    function esc(s) { return kit().esc(s); }
    function setp() { return (w && w.FK_SETTINGS) || {}; }

    var st, cx = null, last = null, bound = false;
    function reset() {
        st = { at: null, ans: {}, inp: {}, mc: '', mck: { 'notify.gate': true, 'station.remote': true }, hist: [],
            wrote: 0, err: '', busy: false, over: {}, sug: null, sugFor: '', hash: '', tip: '', rail: false, moving: false };
        cx = null;
    }
    reset();

    // ---- the table: quick questions and the step table, in order ----
    function fromQuick(q) {
        return { id: q.id, kind: 'one', title: q.title || q.r || q.id, why: q.why || '', cond: COND[q.id] || '',
            field: q.id === 'lang' ? { label: loc('sd.langField', '語言'), ph: loc('sd.langPh', '日本語') } : null,
            opts: (q.opts || []).map(function (a) {
                var wr = a.w || {};
                return { o: a.o, label: a.t || a.s || a.o, effect: a.e || '', s: a.s || a.t || a.o, w: wr,
                    rec: a.rec || '', risk: a.risk || '', pend: a.pend || '', pendWhy: '',
                    input: Object.keys(wr).some(function (k) { return wr[k] === '$in'; }) };
            }) };
    }
    function project(S, o) {
        if (o && o.project) return o.project;
        return Object.keys((S && S.profiles && S.profiles.projects) || {})[0] || '';
    }
    function build(S, o) {
        var T = w && w.FK_SETSTEPS, qs = {}, own = {}, list = [], byId = {}, CHN = {};
        (setp().questions ? setp().questions() : []).forEach(function (q) { qs[q.id] = fromQuick(q); });
        (T ? T.steps() : []).forEach(function (s) { own[s.id] = s; });
        (T ? T.order() : []).forEach(function (e) {
            var s = own[e[0]] || qs[e[0]];
            if (!s) return;
            s.ch = e[1]; s.r = e[2]; s.i = list.length;
            list.push(s); byId[s.id] = s;
        });
        var chs = T ? T.chapters() : [];
        chs.forEach(function (c) { CHN[c.id] = c; });
        return { S: S || {}, o: o || {}, T: T, dir: project(S, o), steps: list, byId: byId, ch: chs, CHN: CHN };
    }

    // ---- values: what the files hold now, and what the answers write ----
    function isMachine(k) { return (setp().MACHINE || []).indexOf(k) >= 0 || k.indexOf('notify.') === 0; }
    function scopeOf(k) { return isMachine(k) ? 'machine' : 'project'; }
    function rawAgent(k) {
        var set = (cx.S.profileSpec && cx.S.profileSpec.set) || {};
        var p = (set.projects || {})[cx.dir] || {}, m = set.machine || {};
        return has(p, k) ? String(p[k]) : has(m, k) ? String(m[k]) : '';
    }
    function cur(k) {
        if (has(st.over, scopeOf(k) + ' ' + k)) return st.over[scopeOf(k) + ' ' + k];
        if (k === 'notify.*') return ['gate', 'stage', 'end'].filter(function (x) { return cur('notify.' + x) === 'true'; }).join(',');
        if (k === 'prompt.*') return STG.some(function (x) { return cur('prompt.' + x) !== ''; }) ? 'set' : '';
        if (k.indexOf('agent.') === 0) return rawAgent(k);
        var v = setp().cur ? setp().cur(cx.S, cx.dir, k) : '';
        v = v == null ? '' : String(v);
        return BLANK[k] && v === 'false' ? '' : v;
    }
    function gitFmt() { return (st.sug && st.sug.commitFormat) || GIT_FMT; }
    function front() { return !st.sug || st.sug.front !== false; }
    function val(P, k) { return has(P, k) ? P[k].v : cur(k); }
    function optOf(s, o) { for (var i = 0; i < s.opts.length; i++) if (s.opts[i].o === o) return s.opts[i]; return null; }
    function applies(s, P) {
        if (s.cond === 'push') {
            var m = st.ans.main !== undefined ? st.ans.main : nowOf(cx.byId.main);
            return m !== 'pr' && m !== 'keep';
        }
        if (s.cond === 'front') return front();
        if (s.cond === 'skill') return front() && val(P, 'design.mockup') !== 'false';
        return true;
    }
    function writes(s, o, P) {
        var out = {};
        if (o === undefined || o === null) return out;
        if (s.kind === 'multi') {
            out[s.key] = s.opts.filter(function (x) { return o.indexOf(x.o) >= 0; }).map(function (x) { return x.o; }).join(',');
            return out;
        }
        if (s.kind === 'style') {
            if (o === 'none' || !cx.T.STY[o]) return out;
            Object.keys(cx.T.STY[o]).forEach(function (k) { if (!has(P, k)) out[k] = cx.T.STY[o][k]; });
            return out;
        }
        var t = st.inp[s.id] || {};
        if (s.kind === 'table') { // 'm:<agent>' / 'e:<agent>' -> agent.<agent>.model|effort; '' = 預設 (unset)
            Object.keys(t).forEach(function (k) { var p = k.split(':'); out['agent.' + p[1] + '.' + (p[0] === 'm' ? 'model' : 'effort')] = t[k]; });
            return out;
        }
        var a = optOf(s, o);
        if (!a) return out;
        Object.keys(a.w).forEach(function (k) {
            var v = a.w[k];
            if (v === '$each') { STG.forEach(function (x) { var y = String(t[x] || '').trim(); if (y) out['prompt.' + x] = y; }); return; }
            if (v === '$git') v = gitFmt();
            if (v === '$in') { v = String(t.text || '').trim(); if (!v) return; }
            out[k] = v;
        });
        return out;
    }
    function plan(upto) {
        var P = {}, n = upto == null ? cx.steps.length : upto;
        for (var i = 0; i < n; i++) {
            var s = cx.steps[i];
            if (!applies(s, P)) continue;
            var wr = writes(s, st.ans[s.id], P);
            Object.keys(wr).forEach(function (k) { P[k] = { v: wr[k], by: s.id }; });
            if (s.id === 'where' && st.ans.where === 'away' && st.mc === 'yes') {
                if (st.mck['notify.gate']) P['notify.*'] = { v: 'gate', by: 'card' };
                if (st.mck['station.remote']) P['station.remote'] = { v: 'true', by: 'card' };
            }
        }
        return P;
    }
    // does answer a describe the values get(k) returns?
    function matches(s, a, get) {
        var ks = Object.keys(a.w || {});
        if (!ks.length) return true;
        return ks.every(function (k) {
            if (k.indexOf('$') >= 0) return false;
            var v = a.w[k], g = get(k) || '';
            if (v === '$git') v = gitFmt();
            if (v === '$in') return !!g && !s.opts.some(function (x) { return x !== a && x.w && x.w[k] === g; });
            return g === v;
        });
    }
    function nowOf(s) {
        if (!s) return null;
        if (s.kind === 'multi') return cur(s.key).split(',').filter(Boolean);
        if (s.kind === 'style' || s.kind === 'table') return null;
        var hit = s.opts.filter(function (a) { return matches(s, a, cur); });
        return hit.length ? hit[0].o : null;
    }
    function derived(s, P) {
        if (s.kind === 'style' || s.kind === 'table') return null;
        if (s.kind === 'multi') return has(P, s.key) ? { o: P[s.key].v.split(',').filter(Boolean), by: P[s.key].by } : null;
        for (var i = 0; i < s.opts.length; i++) {
            var a = s.opts[i], by = null;
            Object.keys(a.w || {}).forEach(function (k) { if (has(P, k)) by = by || P[k].by; });
            if (by && matches(s, a, function (k) { return val(P, k); })) return { o: a.o, by: by };
        }
        return null;
    }
    function diffN(id, P) { return cx.T.SKEYS.filter(function (k) { return has(P, k) && cx.T.STY[id][k] !== P[k].v; }).length; }
    function near(P) {
        var best = cx.T.TIE[0];
        cx.T.TIE.forEach(function (id) { if (diffN(id, P) < diffN(best, P)) best = id; });
        return { id: best, d: diffN(best, P) };
    }
    function pre(s, P) {
        if (s.kind === 'style') return near(P).id;
        if (s.kind === 'table') return null;
        var d = derived(s, P);
        return d ? d.o : nowOf(s);
    }
    function sel(s, P) {
        if (st.ans[s.id] === null) return s.kind === 'multi' ? [] : null;
        return st.ans[s.id] !== undefined ? st.ans[s.id] : pre(s, P);
    }
    function chSteps(ch) { return cx.steps.filter(function (s) { return s.ch === ch && applies(s, plan(s.i)); }); }
    function nextFrom(i) { for (var j = i + 1; j < cx.steps.length; j++) if (applies(cx.steps[j], plan(j))) return cx.steps[j].id; return 'final'; }
    function prevFrom(i) { for (var j = i - 1; j >= 0; j--) if (applies(cx.steps[j], plan(j))) return cx.steps[j].id; return null; }
    function changes() {
        if (!cx) return [];
        var P = plan(), out = [];
        Object.keys(P).forEach(function (k) { if ((P[k].v || '') !== cur(k)) out.push({ k: k, from: cur(k), to: P[k].v, by: P[k].by }); });
        return out;
    }
    // prompt.* and notify.* are not keys: each becomes the keys it stands for.
    function expand(k, v) {
        if (k === 'notify.*') {
            var on = v ? v.split(',') : [];
            return ['gate', 'stage', 'end'].map(function (x) { return ['notify.' + x, on.indexOf(x) >= 0 ? 'true' : 'false']; });
        }
        if (k === 'prompt.*') return STG.map(function (x) { return ['prompt.' + x, '']; });
        return [[k, v]];
    }
    function rows() {
        var out = [];
        changes().forEach(function (c) {
            expand(c.k, c.to).forEach(function (kv) {
                var now = cur(kv[0]);
                if (kv[1] === now || (kv[1] === 'false' && now === '')) return;
                out.push({ scope: scopeOf(kv[0]), project: cx.dir, key: kv[0], value: kv[1] });
            });
        });
        return out;
    }

    // ---- labels ----
    function nameOf(k) {
        var N = setp().NAME || {};
        if (has(N, k)) return N[k];
        if (k.indexOf('prompt.') === 0) return loc('sd.promptName', '附加 prompt（{st}）', { st: k.slice(7) === 'all' ? loc('sd.everyStage', '每一站') : k.slice(7) });
        if (k.indexOf('agent.') === 0) {
            var a = k.split('.')[1].replace(/^fankeel-/, '');
            return /\.effort$/.test(k) ? loc('sd.agentEffort', '{a} 的 effort', { a: a }) : loc('sd.agentModel', '{a} 的模型', { a: a });
        }
        return k;
    }
    // A value's label: the short answer of the one option that writes only k=v.
    function labOf(k, v) {
        for (var i = 0; i < cx.steps.length; i++) {
            var s = cx.steps[i];
            for (var j = 0; j < s.opts.length; j++) {
                var a = s.opts[j], ks = Object.keys(a.w || {});
                if (ks.length === 1 && ks[0] === k && a.w[k] === v) return a.s;
            }
        }
        if (k === 'notify.*' || k === 'design.skill') {
            var ms = cx.byId[k === 'notify.*' ? 'notify' : 'skill'];
            return v ? v.split(',').map(function (x) { var a = ms && optOf(ms, x); return a ? a.s : x; }).join(loc('sd.and', '、')) : loc('sd.none', '都不');
        }
        if (k.indexOf('agent.') === 0) return v === '' ? loc('sd.def', '預設') : v;
        return v === '' ? loc('sd.unsetV', '未設') : v;
    }
    function byText(by) {
        if (by === 'card') return loc('sd.byCard', '快速設定 · 第 7 題的機器卡');
        var s = cx.byId[by];
        if (!s) return '';
        if (s.kind === 'style') { var a = optOf(s, st.ans.style); return loc('sd.byStyle', '「{n}」補上', { n: a ? a.label : '' }); }
        return (cx.CHN[s.ch] ? cx.CHN[s.ch].n : '') + ' · ' + s.r;
    }
    function shortOf(s, a) {
        if (s.kind === 'multi') return a.length ? a.map(function (o) { var x = optOf(s, o); return x ? x.s : o; }).join(loc('sd.and', '、')) : loc('sd.none', '都不');
        if (s.kind === 'table') {
            var tw = writes(s, a, {}), n = Object.keys(tw).filter(function (k) { return tw[k] !== cur(k); }).length;
            return n ? loc('sd.changedN', '改 {n} 項', { n: n }) : loc('sd.kept', '維持');
        }
        var x = optOf(s, a), t = st.inp[s.id] && st.inp[s.id].text;
        return !x ? '' : x.input && t ? t : x.s;
    }
    function code(k, v) {
        var real = k === 'notify.*' ? (v ? v.split(',').map(function (x) { return 'notify.' + x + ': true'; }).join(loc('sd.and', '、')) : loc('sd.notifyOff', 'notify.*: 全關')) : k + ': ' + v;
        return '<code>' + esc(real) + (v === '' && k !== 'notify.*' ? '<i>' + esc(loc('sd.unset', '不寫（未設）')) + '</i>' : '')
            + (isMachine(k) ? '<i>' + esc(loc('sd.onMachine', ' · 這台機器')) + '</i>' : '') + '</code>';
    }
    function codes(wr) {
        var ks = Object.keys(wr);
        return ks.length ? ks.map(function (k) { return code(k, wr[k]); }).join('') : '<small>' + esc(loc('sd.noChange', '不改任何設定')) + '</small>';
    }
    function sep() { return String(cx.o.configDir || cx.S.configDir || '').indexOf('\\') >= 0 ? '\\' : '/'; }
    function machineFile() { return String(cx.o.configDir || cx.S.configDir || '') + sep() + 'fankeel' + sep() + 'profile.json'; }
    function projectFile() { return cx.dir + sep() + '.fankeel' + sep() + 'profile.json'; }

    // ---- paint ----
    function help(id, aria, tipHtml) {
        return '<span class="v9-help"><button type="button" class="v9-qm" data-qm="' + esc(id) + '" aria-label="' + esc(aria) + '" aria-describedby="v9h-' + esc(id)
            + '" aria-expanded="' + (st.tip === id) + '">?</button><span class="v9-tip" role="tooltip" id="v9h-' + esc(id) + '">' + tipHtml + '</span></span>';
    }
    function wtip(s, a, P) {
        if (s.kind === 'multi') return s.key === 'notify.*' ? code('notify.' + a.o, 'true') : '<code>design.skill: ' + esc(a.o) + '</code><small>' + esc(loc('sd.multi', '可多選，逗號分隔')) + '</small>';
        if (s.kind === 'style') {
            if (a.o === 'none') return '<small>' + esc(loc('sd.noKeys', '不補任何鍵')) + '</small>';
            return '<small>' + esc(loc('sd.fills', '會補上：')) + '</small>' + codes(writes(s, a.o, P)) + '<small>' + esc(loc('sd.differs', '和你的答案差 {n} 項', { n: diffN(a.o, P) })) + '</small>';
        }
        var typed = st.inp[s.id] && st.inp[s.id].text;
        return codes(writes(s, a.o, P)) + (a.input && !typed ? '<small>' + esc(loc('sd.typed', '值是你在下面填的')) + '</small>' : '');
    }
    function optHtml(s, a, n, cv, nv, dv, nr, P) {
        var multi = s.kind === 'multi', on = multi ? (cv || []).indexOf(a.o) >= 0 : cv === a.o;
        var from = !!dv && (multi ? dv.o.indexOf(a.o) >= 0 : dv.o === a.o) && dv.by !== s.id;
        var now = !from && (multi ? !!(nv && nv.indexOf(a.o) >= 0) : nv === a.o);
        var id = 'v9w-' + s.id + '-' + n;
        var tags = (a.rec ? '<span class="v9-tag rec">' + esc(a.rec) + '</span>' : '')
            + (a.pend ? '<span class="v9-tag pend" title="' + esc(a.pendWhy) + '">' + esc(a.pend) + '</span>' : '')
            + (a.risk ? '<span class="v9-risk">' + WARN + esc(a.risk) + '</span>' : '')
            + (now ? '<span class="v9-tag now">' + esc(loc('sd.now', '目前')) + '</span>' : '')
            + (from ? '<span class="v9-tag from" title="' + esc(loc('sd.fromTip', '由「{by}」帶入', { by: byText(dv.by) })) + '">' + esc(loc('sd.from', '帶入')) + '</span>' : '')
            + (nr && nr.id === a.o ? '<span class="v9-tag near">' + esc(loc('sd.near', '最接近')) + '</span>' : '');
        return '<div class="v9-o"><button type="button" class="v9-opt" role="' + (multi ? 'checkbox' : 'radio') + '" aria-checked="' + on + '" tabindex="'
            + (multi || on || (cv == null && n === 0) ? 0 : -1) + '" data-o="' + esc(a.o) + '" aria-describedby="' + id + '"><span class="' + (multi ? 'v9-box' : 'v9-radio')
            + '" aria-hidden="true">' + (multi ? CHECK : '') + '</span><span class="v9-ot">' + esc(a.label) + tags + '</span><span class="v9-oe">' + esc(a.effect)
            + '</span></button><span class="v9-tip v9-wtip" role="tooltip" id="' + id + '">' + wtip(s, a, P) + '</span></div>';
    }
    function inputHtml(id, k, v, ph, mono, pre, mode) {
        return '<span class="v9-in wide' + (mono ? ' mono' : '') + '">' + (pre ? '<i>' + esc(pre) + '</i>' : '') + '<input id="' + id + '" data-in="' + k + '" value="' + esc(v)
            + '" placeholder="' + esc(ph || '') + '" autocomplete="off" spellcheck="false"' + (mode ? ' inputmode="' + mode + '"' : '') + '></span>';
    }
    function fieldsHtml(s, cv, nv) {
        var f = s.field, t = st.inp[s.id] || {};
        if (!f) return '';
        var a = s.opts.filter(function (x) { return x.input; })[0];
        if (!a) return '';
        if (f.each) {
            var g = STG.slice(1).map(function (x) {
                var v = has(t, x) ? t[x] : cur('prompt.' + x);
                return '<label class="v9-each-r" for="v9i-prompt-' + x + '"><code>' + x + '</code></label>' + inputHtml('v9i-prompt-' + x, x, v, fill(f.onePh, { stage: x })).replace('v9-in wide', 'v9-in');
            }).join('');
            return '<div class="v9-field v9-each" data-field="' + esc(a.o) + '"' + (cv === a.o ? '' : ' hidden') + '><label for="v9i-prompt-all">' + esc(f.label) + ' <code>prompt.all</code></label>'
                + inputHtml('v9i-prompt-all', 'all', has(t, 'all') ? t.all : cur('prompt.all'), f.ph) + '<p class="v9-each-h">' + esc(f.one) + ' <code>' + esc(loc('sd.stageCode', 'prompt.<站>')) + '</code></p><div class="v9-each-g">' + g + '</div></div>';
        }
        var key = Object.keys(a.w)[0], v = has(t, 'text') ? t.text : (cv === a.o && nv === cv ? cur(key) : '');
        return '<div class="v9-field" data-field="' + esc(a.o) + '"' + (cv === a.o ? '' : ' hidden') + '><label for="v9i-' + esc(s.id) + '">' + esc(f.label) + '</label>'
            + inputHtml('v9i-' + esc(s.id), 'text', v, f.ph, f.mono, f.pre, f.mode) + '</div>';
    }
    function agentsHtml(s) {
        var spec = cx.S.profileSpec || {}, ags = spec.agents || [], effs = spec.efforts || EFFORTS, tb = s.table, t = st.inp[s.id] || {};
        function pick(kind, a, list, def) {
            var k = kind + ':' + a.name, key = 'agent.' + a.name + '.' + (kind === 'm' ? 'model' : 'effort'), v = has(t, k) ? t[k] : cur(key);
            var short = a.name.replace(/^fankeel-/, '');
            return '<select data-in="' + esc(k) + '" aria-label="' + esc(fill(kind === 'm' ? tb.ariaM : tb.ariaE, { a: short })) + '"><option value=""' + (v === '' ? ' selected' : '') + '>'
                + esc(fill(tb.def, { v: def || '' })) + '</option>' + list.map(function (x) { return '<option value="' + esc(x) + '"' + (v === x ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select>';
        }
        function table(part) {
            return '<table class="v9-at"><thead><tr><th scope="col">' + esc(tb.agent) + '</th><th scope="col">' + esc(tb.model) + '</th><th scope="col">' + esc(tb.effort) + '</th></tr></thead><tbody>'
                + part.map(function (a) {
                    return '<tr><th scope="row"><code>' + esc(a.name.replace(/^fankeel-/, '')) + '</code></th><td>' + pick('m', a, MODELS, a.model) + '</td><td>' + pick('e', a, effs, a.effort) + '</td></tr>';
                }).join('') + '</tbody></table>';
        }
        var half = Math.ceil(ags.length / 2);
        return '<div class="v9-field v9-atab" data-field="table"><div class="v9-at2">' + table(ags.slice(0, half)) + table(ags.slice(half)) + '</div><p class="v9-at-n">' + esc(tb.note) + '</p></div>';
    }
    function cardHtml(cv) {
        if (cv !== 'away') return '';
        var say = st.mc === 'yes' ? loc('sd.mcYes', '會寫進這台機器。') : st.mc === 'no' ? loc('sd.mcNo', '這台機器的設定不動；之後可以在「離開電腦時」再開。') : loc('sd.mcWait', '按確認或先不要，才能到下一步。');
        function box(k, id, label) { return '<input type="checkbox" id="' + id + '" data-mk="' + k + '"' + (st.mck[k] ? ' checked' : '') + '><label for="' + id + '">' + esc(label) + '</label>'; }
        return '<div class="v9-mc" data-block="v9-machine-card" data-state="' + st.mc + '" role="group" aria-labelledby="v9mc-h"><div class="v9-mc-h"><b id="v9mc-h">' + esc(loc('sd.mcHead', '還要寫進這台機器')) + '</b>'
            + help('mc', loc('sd.mcQ', '這張卡寫什麼'), code('notify.gate', 'true') + code('station.remote', 'true') + '<small>' + esc(loc('sd.mcWhy', '寫進 {f}。這兩項只讀機器設定，寫在專案檔不會生效；clone 下來的 repo 也不會把問題送到別台。手機遠端怎麼連還沒定。', { f: machineFile() })) + '</small>')
            + '</div><ul class="v9-mc-l"><li>' + box('notify.gate', 'v9mc-n', loc('sd.mcGate', 'gate 等你時推播到手機')) + '</li><li>' + box('station.remote', 'v9mc-r', loc('sd.mcRemote', '手機遠端連進監控站'))
            + '<span class="v9-tag pend">' + esc(loc('sd.pend', '待定')) + '</span><span class="v9-mc-pend">' + esc(loc('sd.mcPend', '遠端連線方式待定：Tailscale 或支援區網的 VPN')) + '</span></li></ul>'
            + '<div class="v9-mc-f"><button type="button" class="v9-btn pri" data-mc="yes">' + esc(loc('sd.mcOk', '確認，寫進這台機器')) + '</button><button type="button" class="v9-btn" data-mc="no">'
            + esc(loc('sd.mcNot', '先不要')) + '</button><span class="v9-mc-say" role="status">' + esc(say) + '</span></div></div>';
    }
    function stepHtml(s) {
        var P = plan(s.i), cv = sel(s, P), nv = nowOf(s), dv = derived(s, P), nr = s.kind === 'style' ? near(P) : null;
        var h = '<div class="v9-step" data-block="' + (s.ch === 'quick' ? 'v9-q-' : 'v9-' + s.ch + '-') + esc(s.id) + '" data-step="' + esc(s.id) + '"><div class="v9-qh"><h2 class="v9-q" id="v9q-' + esc(s.id) + '" tabindex="-1">' + esc(s.title) + '</h2>'
            + (s.adv ? '<span class="v9-adv">' + esc(s.adv) + '</span>' : '') + help(s.id, loc('sd.why', '為什麼問這題'), esc(s.why)) + '</div>'
            + (s.warn ? '<p class="v9-warnline" role="note">' + WARN + '<span>' + esc(s.warn) + '</span></p>' : '');
        if (s.kind === 'table') h += agentsHtml(s);
        else {
            h += '<div class="v9-opts" role="' + (s.kind === 'multi' ? 'group' : 'radiogroup') + '" aria-labelledby="v9q-' + esc(s.id) + '">'
                + s.opts.map(function (a, n) { return optHtml(s, a, n, cv, nv, dv, nr, P); }).join('') + '</div>' + fieldsHtml(s, cv, nv);
        }
        if (s.id === 'where') h += cardHtml(cv);
        if (s.note && val(P, 'stage.agents') === '') h += '<p class="v9-ev is-warn">' + esc(s.note) + '</p>';
        if (s.id === 'remote' && w && w.FK_REMOTE && typeof w.FK_REMOTE.html === 'function') h += w.FK_REMOTE.html(cx.o.serve);
        return h + '</div>';
    }
    function finalHtml() {
        var ch = changes(), groups = { p: [], m: [] }, html = '';
        ch.forEach(function (c) { groups[isMachine(c.k) ? 'm' : 'p'].push(c); });
        if (!ch.length) html = '<p class="v9-fin-e">' + esc(loc('sd.finNone', '沒有要改的：你的答案和現在的值一樣。')) + '</p>';
        [['p', loc('sd.project', '專案'), projectFile()], ['m', loc('sd.machine', '這台機器'), machineFile()]].forEach(function (g) {
            if (!groups[g[0]].length) return;
            html += '<div class="v9-fin-g"><p class="v9-fin-h"><b>' + esc(loc('sd.items', '{g} · {n} 項', { g: g[1], n: groups[g[0]].length })) + '</b><code title="' + esc(g[2]) + '">' + esc(g[2]) + '</code></p><ul class="v9-fin-l">'
                + groups[g[0]].map(function (c, n) {
                    var id = 'v9f-' + g[0] + n, a = labOf(c.k, c.from), b = labOf(c.k, c.to);
                    return '<li><span class="v9-fk" tabindex="0" aria-describedby="' + id + '">' + esc(nameOf(c.k)) + '</span><span class="v9-tip" role="tooltip" id="' + id + '">' + code(c.k, c.to)
                        + '<small>' + esc(loc('sd.byLine', '來自：{by}', { by: byText(c.by) })) + '</small></span><span class="v9-chg"><s title="' + esc(a) + '">' + esc(a) + '</s><span aria-hidden="true">→</span><span class="hm-sr">'
                        + esc(loc('sd.to', '改成')) + '</span><b title="' + esc(b) + '">' + esc(b) + '</b></span></li>';
                }).join('') + '</ul></div>';
        });
        var left = cx.steps.filter(function (s) { return applies(s, plan(s.i)) && st.ans[s.id] === undefined; }).length;
        return '<div class="v9-step" data-block="v9-final" data-step="final"><div class="v9-qh"><h2 class="v9-q" id="v9q-final" tabindex="-1">' + esc(loc('sd.finT', '要寫入這些改動嗎？')) + '</h2>'
            + help('final', loc('sd.finQ', '寫入什麼'), esc(loc('sd.finY', '按寫入才會動 profile.json。專案和這台機器分開寫；沒走到的題目維持現在的值。'))) + '</div><div>' + html + '</div>'
            + '<p class="v9-fin-n">' + esc(left ? loc('sd.left', '沒走到的 {n} 題維持現在的值，之後隨時可以從左邊接著設定。', { n: left }) : loc('sd.allDone', '每一題都走過了。')) + '</p>'
            + (st.wrote ? '<p class="v9-fin-ok" role="status">' + CHECK + '<span>' + esc(loc('sd.okN', '已寫入 {n} 項。', { n: st.wrote })) + '</span></p>' : '')
            + (st.err ? '<p class="v9-ev is-warn" role="status">' + esc(loc('sd.err', '沒寫進去：{e}', { e: st.err })) + '</p>' : '') + '</div>';
    }
    function footHtml() {
        var fin = st.at === 'final', s = fin ? null : cx.byId[st.at];
        var prevOff = !st.hist.length && (fin ? false : !prevFrom(s.i));
        var h = '<div class="v9-foot" data-block="v9-wiz-foot"><button type="button" class="v9-btn" data-act="prev"' + (prevOff ? ' disabled' : '') + '>' + esc(loc('sd.prev', '上一步')) + '</button>';
        if (fin) {
            var n = rows().length;
            return h + '<span class="v9-pos" aria-live="polite">' + esc(loc('sd.posFinal', '寫入前檢查')) + '</span><button type="button" class="v9-btn pri" data-act="write"' + (!n || st.busy ? ' disabled' : '') + '>'
                + esc(st.wrote && !n ? loc('sd.wrote', '已寫入') : loc('sd.write', '寫入 {n} 項', { n: n })) + '</button></div>';
        }
        var list = chSteps(s.ch), nx = nextFrom(s.i), end = nx !== 'final' && cx.byId[nx].ch !== s.ch;
        var off = s.id === 'where' && sel(s, plan(s.i)) === 'away' && !st.mc ? ' disabled' : '';
        h += '<span class="v9-pos" aria-live="polite">' + esc(loc('sd.pos', '{c} · {k} / {n}', { c: cx.CHN[s.ch].n, k: list.indexOf(s) + 1, n: list.length })) + '</span>'
            + '<button type="button" class="v9-link" data-act="skip">' + esc(loc('sd.skip', '這題跳過')) + '</button>';
        if (end) {
            return h + '<button type="button" class="v9-btn" data-act="stop"' + off + '>' + esc(loc('sd.stop', '到這裡就好')) + '</button><button type="button" class="v9-btn pri" data-act="cont"' + off + '>'
                + esc(loc('sd.cont', '繼續：')) + '<b>' + esc(cx.CHN[cx.byId[nx].ch].n) + '</b></button></div>';
        }
        return h + '<button type="button" class="v9-btn pri" data-act="next"' + off + '>' + esc(nx === 'final' ? loc('sd.check', '檢查並寫入') : loc('sd.next', '下一步')) + '</button></div>';
    }
    function railHtml() {
        var total = 0, done = 0, curCh = st.at === 'final' ? null : cx.byId[st.at].ch, items = '';
        cx.ch.forEach(function (c, ci) {
            var app = 0, rec = 0, sl = '';
            cx.steps.forEach(function (s) {
                if (s.ch !== c.id) return;
                var ok = applies(s, plan(s.i)), a = st.ans[s.id];
                var sa = !ok ? loc('sd.na', '不適用') : a === null ? loc('sd.skipped', '跳過') : a !== undefined ? shortOf(s, a) : '';
                sl += '<li class="v9-s' + (!ok ? ' is-na' : s.id === st.at ? ' is-now' : a === null ? ' is-skip' : a !== undefined ? ' is-done' : '') + '" data-sid="' + esc(s.id) + '"><button type="button" class="v9-sb" data-go="' + esc(s.id) + '"'
                    + (ok ? '' : ' disabled') + (s.id === st.at ? ' aria-current="step"' : '') + '><span class="v9-sm">' + CHECK + '</span><span class="v9-st">' + esc(s.r) + '</span><span class="v9-sa">' + esc(sa) + '</span></button></li>';
                if (ok) { app++; if (a !== undefined) rec++; }
            });
            total += app; done += rec;
            var now = c.id === curCh;
            items += '<li class="v9-c' + (now ? ' is-now is-open' : app > 0 && rec === app ? ' is-done' : rec > 0 ? ' is-part' : '') + '" data-ch="' + esc(c.id) + '"><button type="button" class="v9-cb" data-gochap="' + esc(c.id) + '" aria-expanded="' + now + '">'
                + '<span class="v9-cm"><span>' + (ci + 1) + '</span>' + CHECK + '</span><span class="v9-cn">' + esc(c.n)
                + (c.machine ? '<span class="v9-mtag" title="' + esc(loc('sd.machineTip', '這一章寫進整台機器的設定')) + '">' + esc(loc('sd.machine', '這台機器')) + '</span>' : '')
                + '</span><span class="v9-cc">' + rec + '/' + app + '</span></button><ol class="v9-sl">' + sl + '</ol></li>';
            if (c.id === 'quick') items += '<li class="v9-cut" role="presentation">' + esc(loc('sd.cut', '細項：走到哪停都可以')) + '</li>';
        });
        var said = loc('sd.answered', '已答 {d} / {t}', { d: done, t: total });
        return '<aside class="dcard v9-rail" data-block="v9-rail" aria-label="' + esc(loc('sd.rail', '設定章節')) + '" data-open="' + st.rail + '"><button type="button" class="v9-rtog" data-rtog aria-expanded="' + st.rail + '"><b>'
            + esc(curCh ? cx.CHN[curCh].n : loc('sd.check', '檢查並寫入')) + '</b><span>' + esc(said) + '</span>' + CHEV + '</button><div class="v9-rh"><b>' + esc(loc('sd.steps', '逐步設定')) + '</b><span>' + esc(said) + '</span></div>'
            + '<nav class="v9-ix" data-block="v9-index" aria-label="' + esc(loc('sd.index', '章節與步驟')) + '"><ol>' + items + '</ol></nav><div class="v9-rail-end" data-block="v9-rail-end"><button type="button" class="v9-endb" data-go="final"'
            + (st.at === 'final' ? ' aria-current="step"' : '') + '>' + SAVE + '<span>' + esc(loc('sd.check', '檢查並寫入')) + '</span><b>' + esc(st.wrote && !changes().length ? loc('sd.wrote', '已寫入') : loc('sd.nChanges', '{n} 項改動', { n: changes().length })) + '</b></button></div></aside>';
    }

    // ---- moves ----
    function redraw() { if (last && typeof last.redraw === 'function') last.redraw(); }
    function later(fn) { if (w && typeof w.setTimeout === 'function') w.setTimeout(fn, 0); }
    function focus(sel) { later(function () { var x = doc && doc.querySelector ? doc.querySelector(sel) : null; if (x && x.focus) x.focus({ preventScroll: true }); }); }
    function reduced() { return !!(w && w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    function go(id, nohist) {
        if (id === st.at) return;
        if (!nohist) st.hist.push(st.at);
        st.at = id; st.rail = false; st.tip = ''; st.moving = !reduced();
        redraw();
        focus('[data-block="v9-wizard"] .v9-q');
    }
    function record() {
        if (st.at === 'final') return;
        var s = cx.byId[st.at];
        if (st.ans[s.id] === undefined) { var p = pre(s, plan(s.i)); st.ans[s.id] = p == null ? null : p; }
    }
    function choose(o) {
        var s = cx.byId[st.at];
        if (s.kind === 'multi') {
            var c = (sel(s, plan(s.i)) || []).slice(), i = c.indexOf(o);
            if (i >= 0) c.splice(i, 1); else c.push(o);
            st.ans[s.id] = c;
        } else st.ans[s.id] = o;
        if (s.id === 'main') st.hist = st.hist.filter(function (h) { return h === 'final' || applies(cx.byId[h], plan(cx.byId[h].i)); });
        st.wrote = 0; st.err = '';
        redraw();
        var a = optOf(s, o);
        if (a && a.input) focus('[data-field="' + o + '"] input');
    }
    function act(name) {
        var s = st.at === 'final' ? null : cx.byId[st.at];
        if (name === 'prev') {
            var h = null;
            while (st.hist.length) { h = st.hist.pop(); if (h === 'final' || (cx.byId[h] && applies(cx.byId[h], plan(cx.byId[h].i)))) break; h = null; }
            if (!h && s) h = prevFrom(s.i);
            if (h) go(h, true);
        } else if (name === 'skip' && s) { st.ans[s.id] = null; go(nextFrom(s.i)); }
        else if ((name === 'next' || name === 'cont') && s) { record(); go(nextFrom(s.i)); }
        else if (name === 'stop' && s) { record(); go('final'); }
        else if (name === 'write') write();
    }
    // FK_SETTINGS.post writes one scope a call — o = { scope, project }, rows [{ k, to }],
    // done(ok) — so the project rows go first, then the machine's; a failure stops there.
    function write() {
        var rs = rows();
        if (!rs.length || st.busy || typeof setp().post !== 'function') return;
        st.busy = true; st.err = '';
        var groups = ['project', 'machine'].map(function (sc) {
            return { scope: sc, rows: rs.filter(function (r) { return r.scope === sc; }) };
        }).filter(function (g) { return g.rows.length; });
        (function next(i) {
            if (i >= groups.length) { st.busy = false; st.wrote = rs.length; redraw(); return; }
            var g = groups[i];
            setp().post(cx.S, { scope: g.scope, project: cx.dir }, g.rows.map(function (r) { return { k: r.key, to: r.value }; }), function (ok) {
                if (!ok) {
                    st.busy = false;
                    st.err = g.scope === 'machine' ? machineFile() : cx.dir + sep() + '.fankeel' + sep() + 'profile.json';
                    redraw();
                    return;
                }
                g.rows.forEach(function (r) { st.over[r.scope + ' ' + r.key] = r.value; });
                next(i + 1);
            });
        })(0);
        redraw();
    }
    function suggest() {
        if (!cx.o.serve || !cx.dir || st.sugFor === cx.dir || typeof fetch !== 'function') return;
        st.sugFor = cx.dir;
        var p = fetch('station/suggest?project=' + encodeURIComponent(cx.dir));
        if (!p || typeof p.then !== 'function') return;
        p.then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j) { st.sug = j; redraw(); } }, function () {});
    }

    // ---- events (bound on the first page(), on the document) ----
    function inPage(t) { return !!(t && typeof t.closest === 'function' && t.closest('[data-block="v9-page"]')); }
    function onClick(e) {
        var t = e && e.target;
        if (!cx || !t || typeof t.closest !== 'function') return;
        var qm = t.closest('[data-qm]');
        if (!qm && st.tip) { st.tip = ''; if (!inPage(t)) { redraw(); return; } }
        if (!inPage(t)) return;
        var b = t.closest('.v9-opt');
        if (b && st.at !== 'final') { choose(b.getAttribute('data-o')); return; }
        var m = t.closest('[data-mc]');
        if (m) { st.mc = m.getAttribute('data-mc'); redraw(); return; }
        if (qm) { var id = qm.getAttribute('data-qm'); st.tip = st.tip === id ? '' : id; redraw(); return; }
        var a = t.closest('[data-act]');
        if (a) { if (!a.disabled) act(a.getAttribute('data-act')); return; }
        if (t.closest('[data-rtog]')) { st.rail = !st.rail; redraw(); return; }
        var g = t.closest('[data-go]');
        if (g) { if (!g.disabled) go(g.getAttribute('data-go')); return; }
        var c = t.closest('[data-gochap]');
        if (c) {
            var list = chSteps(c.getAttribute('data-gochap'));
            var first = list.filter(function (s) { return st.ans[s.id] === undefined; })[0] || list[0];
            if (first) go(first.id);
        }
    }
    function onInput(e) {
        var x = e && e.target;
        if (!cx || st.at === 'final' || !inPage(x)) return;
        var mk = x.getAttribute('data-mk');
        if (mk) { if (e.type === 'change') { st.mck[mk] = !!x.checked; redraw(); } return; }
        var k = x.getAttribute('data-in');
        if (!k) return;
        var s = cx.byId[st.at], f = x.closest('[data-field]');
        st.inp[s.id] = st.inp[s.id] || {};
        st.inp[s.id][k] = x.value;
        if (f) st.ans[s.id] = f.getAttribute('data-field');
        st.wrote = 0;
        if (e.type === 'change') redraw();
    }
    function onKey(e) {
        if (!cx) return;
        if (e.key === 'Escape' && st.tip) { st.tip = ''; redraw(); return; }
        var b = e.target && typeof e.target.closest === 'function' ? e.target.closest('.v9-opt[role=radio]') : null;
        var d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
        if (!b || !d || st.at === 'final') return;
        e.preventDefault();
        var s = cx.byId[st.at], i = s.opts.indexOf(optOf(s, b.getAttribute('data-o')));
        var o = s.opts[(i + d + s.opts.length) % s.opts.length].o;
        choose(o);
        focus('.v9-opt[data-o="' + o + '"]');
    }
    function bind() {
        if (bound || !doc || typeof doc.addEventListener !== 'function') return;
        bound = true;
        doc.addEventListener('click', onClick);
        doc.addEventListener('input', onInput);
        doc.addEventListener('change', onInput);
        doc.addEventListener('keydown', onKey);
    }

    function page(S, o) {
        last = o || {};
        bind();
        cx = build(S, last);
        if (!cx.steps.length) return '<div class="st v9" data-block="v9-page"><p class="v9-ev">' + esc(loc('sd.noTable', '設定表還沒載入。')) + '</p></div>';
        suggest();
        // `#/settings/detail/<step>` opens that step once; moving on keeps the hash.
        var hash = String(last.hash || (w && w.location && w.location.hash) || '');
        if (hash !== st.hash) {
            st.hash = hash;
            var m = /^#\/settings\/detail\/([a-z]+)/.exec(hash);
            if (m && (cx.byId[m[1]] || m[1] === 'final')) st.at = m[1];
        }
        if (!st.at || (st.at !== 'final' && !cx.byId[st.at])) st.at = cx.steps[0].id;
        var moving = st.moving;
        st.moving = false;
        return '<div class="st v9' + (moving ? ' is-moving' : '') + '" data-block="v9-page">' + railHtml() + '<section class="dcard v9-wiz" data-block="v9-wizard" aria-label="' + esc(loc('sd.wizard', '設定精靈')) + '">'
            + (st.at === 'final' ? finalHtml() : stepHtml(cx.byId[st.at])) + footHtml() + '</section></div>';
    }
    function state() { return st; }

    var api = { page: page, onClick: onClick, onInput: onInput, onKey: onKey, changes: changes, rows: rows, state: state, reset: reset, EN: EN };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_SETDETAIL = api;
}(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null));
```

4. 把 mockup 的 v9 樣式原樣抄成 `assets/station/settings-detail.css`（`.fankeel/build` 被 gitignore，worktree 裡沒有，所以用主 checkout 的絕對路徑；檔案不在就回 BLOCKED）：

```sh
sed -n '23,263p' F:/ymlab/fankeel/.fankeel/build/2026-10-21-station-redesign/route-settings-v9.html > assets/station/settings-detail.css
head -1 assets/station/settings-detail.css   # /* ==== v9 (mockup 2026-10-21-station-redesign/settings, variant 9) ====
grep -c '<style\|</style' assets/station/settings-detail.css   # 0
```

5. 跑 `node --test --require ./tests/subprocess-timeout.js tests/station-settings-detail.test.js tests/station-settings-steps.test.js`，看 16 個測試通過。失敗在 `FK_SETTINGS` 的形狀（例如 `cur()` 不讀 `S.profiles.projects[dir].values`，或 `post` 的 `rows` 欄位不同）時，改 `assets/station/settings-detail.js` 去配合 Task 5，不改 `assets/station/settings-page.js`，回報 DONE_WITH_CONCERNS 附差異。
6. Commit：`git add assets/station/settings-detail.js assets/station/settings-detail.css tests/station-settings-detail.test.js` 然後 `git commit -m "feat(station): the detailed settings page, one question a screen"`。

## Task 8: The shell loads the docs and settings modules, and the station reference describes both pages

**Files:**
- Modify: `assets/station/index.html` — four `<script>` lines after `talk-acts.js`, four `<link>` lines after `session-talk.css`
- Modify: `docs/90-agent/reference/station.md:949-1672` — the 文件 paragraph (≈`:949-959`), the full-text search paragraph (≈`:1257-1274`), the modules sentence (≈`:1295`) and `## Setting a profile from the page` up to the colour paragraph (≈`:1580-1658`), rewritten for the pages as they will be
- Test: `tests/station-modules.test.js`
- Read: `docs/90-agent/plans/2026-10-24-station-gate-talk.md` — its Task 6 step 5 (where `talk-acts.js` goes in `index.html`) and its Task 5 step 5 (the modules sentence it writes into `station.md`)

**Interfaces:**
- Consumes: `FK_DOCS`, `FK_SETTINGS`, `FK_SETSTEPS`, `FK_SETDETAIL` — Tasks 4-7, each set by its module on load with no DOM touched and no listener added
- Consumes: `/station/docs-health`, `/station/doc`, `/station/suggest` and `profileSpec` — Task 3; `suggestFor` — Task 2; `cached` — Task 1 (named in `station.md`, not called)
- Produces: `docs-page.js`, `settings-page.js`, `settings-steps.js`, `settings-detail.js` loaded by `assets/station/index.html` after `talk-acts.js`, so `tests/station-src.js` `SRC` and `tests/station-module.js` `page()` run them

**Dispatch:** implementer, sonnet — the plan carries the test, the eight lines and every paragraph; transcription.

1. Find the anchors (the gate/talk plan has already moved them):

```sh
grep -n "session-talk\|talk-acts\|remote-card" assets/station/index.html
grep -n "^\*\*文件\*\* is its own page\|^Full-text search sits on 文件\|The redesigned pages' modules\|^## Setting a profile from the page\|^Second: a project's colour" docs/90-agent/reference/station.md
```

   `talk-acts.js` must already follow `session-talk.js` in `index.html`; if it does not, the gate/talk plan has not built — stop BLOCKED with the grep output.

2. Write the failing test. In `tests/station-modules.test.js`, replace lines 18-22 (`const PAGES = …` through the end of `const GLOBAL = { … };`) with:

```js
const BEFORE = ['tip', 'live-page', 'sessions-page', 'projects-page', 'project-page', 'session-page', 'session-dispatch', 'session-talk'];
// 文件 and 設定 (station-38, station-39) load after talk-acts.js, a script with no sheet of its own.
const AFTER = ['docs-page', 'settings-page', 'settings-steps', 'settings-detail'];
const PAGES = BEFORE.concat(AFTER);
const ALL = PAGES.concat(['gate-frame']);
const SPEND = ['spend-talk.js', 'spend-kinds.js', 'spend-range.js', 'spend-panel.js'];
const GLOBAL = { tip: 'FK_TIP', 'live-page': 'FK_LIVE', 'sessions-page': 'FK_SESSIONS', 'projects-page': 'FK_PROJECTS', 'project-page': 'FK_PROJECT',
    'session-page': 'FK_SESSION', 'session-dispatch': 'FK_SDISP', 'session-talk': 'FK_STALK', 'gate-frame': 'FK_GATE',
    'docs-page': 'FK_DOCS', 'settings-page': 'FK_SETTINGS', 'settings-steps': 'FK_SETSTEPS', 'settings-detail': 'FK_SETDETAIL' };
```

   In the same file `tests/station-modules.test.js`, replace the scripts `deepEqual` line inside `the shell loads tip.js and the page modules …` (`:56`) with:

```js
        assert.deepEqual(scripts, ['i18n.js'].concat(BEFORE.map((n) => n + '.js'), ['talk-acts.js'], AFTER.map((n) => n + '.js'), SPEND, ['remote-card.js', 'station.js']));
```

   Leave the sheets line (`['station.css'].concat(PAGES.map((n) => n + '.css'))`) as it is. After that test, add to `tests/station-modules.test.js`:

```js
// Every vm boot of the page (tests/station-src.js, tests/station-module.js page())
// runs these four before station.js, with a document that has no body and no
// querySelector; the station-hdl-* tests find document listeners by what they
// hold. So none of them may touch an element or add a listener at load.
test('the docs and settings modules touch no element and add no listener at load', () => {
    for (const n of AFTER) {
        const added = [];
        const win = {};
        vm.runInNewContext(fs.readFileSync(path.join(ASSETS, n + '.js'), 'utf8'),
            { window: win, document: { addEventListener(type) { added.push(type); } }, module: { exports: {} } });
        assert.deepEqual(added, [], n + ' added a listener at load');
        const api = win[GLOBAL[n]];
        if (n === 'settings-steps') {
            assert.equal(typeof api.steps, 'function', n);
            assert.equal(typeof api.chapters, 'function', n);
        } else {
            assert.equal(typeof api.page, 'function', n);
        }
    }
});
```

3. Run it and watch the scripts `deepEqual` fail (the four scripts are not in `index.html` yet):

```sh
node --test --require ./tests/subprocess-timeout.js tests/station-modules.test.js
```

   If the new test fails instead — a module throws on load or adds a listener — that module's task is not done: stop BLOCKED with the message.

4. In `assets/station/index.html`, after the line `<script src="station/talk-acts.js"></script>`, add:

```html
<script src="station/docs-page.js"></script>
<script src="station/settings-page.js"></script>
<script src="station/settings-steps.js"></script>
<script src="station/settings-detail.js"></script>
```

   In `assets/station/index.html`, after the line `<link rel="stylesheet" href="station/session-talk.css">`, add:

```html
<link rel="stylesheet" href="station/docs-page.css">
<link rel="stylesheet" href="station/settings-page.css">
<link rel="stylesheet" href="station/settings-steps.css">
<link rel="stylesheet" href="station/settings-detail.css">
```

5. In `docs/90-agent/reference/station.md`, replace the paragraph that begins `**文件** is its own page, \`#/docs\`, one section per project` and ends `the page prints "還沒有專案生成` … `instead of a list.` (≈`:949-959`) with these two paragraphs (in `docs/90-agent/reference/station.md`):

```md
**文件**, `#/docs`, is `FK_DOCS` (`assets/station/docs-page.js`). A head card holds the 找文件 box (see [Search, the tour and the served files](#search-the-tour-and-the-served-files)). Under it, `docs-health` is a matrix with one row per project — its name opens the project dialog, with the number of markdown files and the newest one's date beside it — and six columns: drift (a page older than the code it cites), landed (a plan whose work has landed), index (an index row that is dead or missing), diagram (a diagram that leaves out part of its directory), broken (every `scripts/docs-check.js` finding) and unfiled (pages no declared bucket holds; grey, and `—` where the project declares no tree). A zero is a tick; a number is a button, `data-cell="<pkey> <kind>"`, that fills the `docs-findings` card beside the matrix with what that kind means and how to fix it, one row per item (at most 50: path, line, tag, note), and the command that lists them all. The figures come once per visit from `GET /station/docs-health`, which `scripts/docs-health.js` answers by running `scripts/docs-audit.js`'s `sweep` and `scripts/docs-check.js`'s `scan` over every project `lib/docsearch.js`'s `searchDirs` names, keeping the answer ten minutes; 重新檢查 asks again with `?fresh=1`. A row of the findings card opens the `docs-reader` dialog: one page from `GET /station/doc?pkey=<pkey>&path=<rel>`, rendered from its markdown with the frontmatter's `status` and `last_verified` as chips and the cited line marked, ← and → walking the cell's items. The `docs-project` dialog draws what `parseMapCard` (`lib/station.js`) read off the project's `.fankeel/map.md` — the split by status, `planned, not built` and the filing table — from `projects[].docs`. Both dialogs hang off `document.body`, outside `#page`, so the 3 s redraw leaves them open. The matrix draws no relation graph. The file `/fankeel` writes has no server to ask, so there the page says to open it from `serve`.

`GET /station/doc` answers `text/markdown`, and `404` for a `pkey` no project has or a `path` that is not posix, holds `..`, does not end `.md`, is not tracked in that project (`lib/tracked.js` `trackedFiles`) or is over 512 KB.
```

The paragraph above lands as written.

The step below edits the same page.

6. In `docs/90-agent/reference/station.md`, replace the paragraph under `## Search, the tour and the served files` that begins `Full-text search sits on 文件 (\`#/docs\`) under its heading,` and ends `is a note saying to open the page from \`serve\`.` (≈`:1257-1274`) with (in `docs/90-agent/reference/station.md`):

```md
Full-text search is 文件's 找文件 box (`#/docs`, in the head card above `docs-health`). Typing asks `GET /station/search?q=<text>` (`scripts/station.js`, `url.pathname === '/station/search'`) and paints the hits straight into the `#dq-pop` popover under the box, not into `#page`, so the box keeps its caret through the 3 s redraw; a hit opens its page in the reader. `lib/docsearch.js` answers it: `searchDirs(model)` takes every registry root that is not `gone` and every project under it that a session names, minus the projects `station.hide` removes (`hiddenPkeys`); `search(dirs, q)` reads each project's `.fankeel/docs.json` — or the preset `docs.detect` recognises when there is none — and opens only the markdown pages whose role is `reference` or `decision`. `plan`, `report`, `archive` and `fixture` pages are not searched: they record a moment, and a hit in one reads as current when it is not. A `reference` page in a bucket whose `audience` is `human` is labelled `guide`. The match is a case-insensitive substring of the page body with its frontmatter removed; pages sort by how often it occurs, and the answer carries the total `n` and the first 20, each with 60 characters either side of the first hit. The file `/fankeel` writes has no server to ask, so there the box is a note saying to open the page from `serve`.
```

The paragraph above lands as written.

The step below edits the same page.

7. In `docs/90-agent/reference/station.md`, at the end of the line holding `The redesigned pages' modules (` (≈`:1295`, as the gate/talk plan left it), after its last sentence `… are served and written the same way.`, append one sentence on the same line:

```md
 So are 文件's and 設定's: `docs-page`, `settings-page`, `settings-steps` and `settings-detail`, each a script and a stylesheet.
```

The paragraph above lands as written.

The step below edits the same page.

8. In `docs/90-agent/reference/station.md`, replace everything under `## Setting a profile from the page` from its first line (`No session view carries a **profile** card any more,`) up to, not including, the paragraph that begins `Second: a project's colour` (≈`:1582-1658`) with (in `docs/90-agent/reference/station.md`):

```md
No session view carries a **profile** card, and neither does 首頁: a profile is set at one page, `#/settings`, which is `FK_SETTINGS` (`assets/station/settings-page.js`). `parseHash` sends every `#/settings/…` hash there, and `FK_SETTINGS` hands `#/settings/detail[/<step>]` to `FK_SETDETAIL` (`assets/station/settings-detail.js`). Both work on one project at a time — the first `profiles.projects` directory, with a `<select data-sq-proj>` when the page knows more than one — and on the machine profile beside it.

**快速設定** is ten questions in five blocks: 改動怎麼收 (`main`, how a change reaches main, which sets `worktree`, `land.integration` and `land.push`; then `push`, asked only when `main` is direct or merge), 同時跑多少 (`sessions`, which sets `guard`, and `worktree` for many sessions; `inflight`, `dispatch.inflight`), 主對話與報告 (`ctx`, `stage.agents`; `lang`, `model.lang`), 驗證與成本 (`gates`, `class.default`; `floor`, `dispatch.floor` and `judge.model`; `screen`, `design.mockup`, asked only when the project has a front end) and 離開電腦時 (`where`, `gate.station` and `gate.away`). Every question is answered before anyone touches it and tagged 依你的紀錄 or 作者推薦: `GET /station/suggest?project=<dir>` (`lib/settingsuggest.js` `suggestFor`) reads the project's git history through `profile.suggest`, how its registry's sessions overlapped, whether it has a front end (`.fankeel/render.json`, or tracked html, css, vue, svelte, jsx or tsx files) and the machine's notify settings; until it answers, or with no server, every answer is the author's. 全部套用推薦 takes every recommendation back. 常離開 adds a machine card — `notify.gate` and `station.remote`, the second tagged 待定 — that writes the machine file only after its own 確認. The last screen lists old → new for every key that changes, split into 專案 and 這台機器, and offers `commit.format` as an unticked box: the format `profile suggest` read off the git log, with `merge` added so `land.js merge` is not refused. A key whose value would not change is not written.

**詳細設定** is one question a screen in ten chapters — 快速設定, 整合收尾, 平行與隔離, 驗證與流程, 成本與模型, Context 與自主, 離開電腦時 (the machine's), 報告與文字, 安全, 其他 — with a rail of chapters and their steps, each marked done or current; 到這裡就好 stops and 繼續 goes on, and `#/settings/detail/<step>` opens that step. Its steps are 快速設定's ten questions followed by the 23 of `FK_SETSTEPS` (`assets/station/settings-steps.js`). The `prompt.*` step is tagged 進階・不建議. The agents step is a table, one row per plugin agent, with a model select and an effort select, each opening on `預設 · <the agent file's own value>`; it writes `agent.<name>.model` and `agent.<name>.effort`, and reads its rows from the page model's `profileSpec` (`lib/station.js` `serialize`: the profile keys, every agent with its frontmatter `model` and `effort`, the efforts, and what each layer holds now). The remote step carries the 手機遠端 card (`assets/station/remote-card.js`, `FK_REMOTE.html(serve)`), which draws nothing on a page with no server.

Both pages write with `fetch` to `POST /profile` (`scripts/station.js`), sending `scope` (`project` or `machine`), `project`, the nonce and a repeated `key`/`value` pair per row changed. A wrong nonce is `403`. Every pair is checked — an unknown key, or a value `profile.parseValue` refuses (a `stage.agents` stage list is one it accepts) — before any of them is written; `agent.<name>.model` and `agent.<name>.effort` are known keys (`lib/agentfile.js` `agentKey`), and after one is written `agentfile.syncAgent` rewrites that agent's file under the scope's agents directory (`<config dir>/agents` for the machine, `<project>/.claude/agents` for a project), as `task.js profile set` does. A bad `scope`, no pair or an unequal count fail the same way, `400`; an empty value is not refused but clears that key from the scope's file (`profile.unset`); an unknown project `404`, a refused write `409`. A form post that lands redirects `303`: to `/` + `back` when `back` matches `^#/[a-z]*$`, and to bare `/` otherwise.

Hiding a project (`station.hide: 'true'`) costs two things, both accepted rather than treated as defects. First: the project drops out of the settings page's project picker, the same way its sessions disappear from 清單 — `serialize()`'s `profiles.projects` drops it exactly where `flatten()` drops its sessions (see What each row holds) — so there is no control left on the served page to reach it again. This is not because the `POST` above would refuse it: `known` there builds its own fresh, unfiltered model rather than reading the page's filtered one (`scripts/station.js`, `const known = model.registries.some(`), so a hidden project's directory is still in it, and a request naming one that somehow still reached the server would succeed, not `404`. The picker simply never offers it, so unhiding is `node <plugin>/scripts/task.js profile set station.hide false --project <path>`, run by hand.
```

The paragraph above lands as written.

The step below edits the same page.

9. Run the module test with the tests that read `index.html` and `station.md`, and watch them pass:

```sh
node --test --require ./tests/subprocess-timeout.js tests/station-modules.test.js tests/station-module-lists.test.js tests/station-doc.test.js tests/station-skel.test.js tests/record-docs.test.js tests/station-remote-mount.test.js
```

   `tests/station-doc.test.js` checks that every `url.pathname === '…'` route in `scripts/station.js` is on `station.md`; Task 3's own paragraph has named the three routes since Task 3, and the paragraphs above name them again — leave Task 3's paragraph in place.

10. Commit:

```text
feat(station): the shell loads the docs and settings modules; the reference describes both pages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

    `git add assets/station/index.html docs/90-agent/reference/station.md tests/station-modules.test.js` before `git commit`.

## Task 9: 文件 and 設定 route to their modules, and the old listeners come out

**Files:**
- Modify: `assets/station/station.js:3270-3290` — delete `view.dsx` and `docsPage`
- Modify: `assets/station/station.js:5100-5530` — `VIEWS.docs` and `VIEWS.settings` call the modules; delete the `#dq` input listener with `dsxTimer`/`dsxPaint`, the `wiz` state with `settingsPage`, `fePick` with its keydown listener, and the wizard branch at the head of the page's click listener
- Modify: `assets/station/i18n.js:525-535` — delete `dash.docs` and `dash.noProjectDocsYet`
- Test: `tests/station-routes-docs-settings.test.js`
- Test: `tests/station-hdl-b.test.js`
- Test: `tests/station-hdl-c.test.js`
- Test: `tests/station-hdl-g.test.js`
- Test: `tests/station-hdl-k.test.js`
- Test: `tests/station-remote-mount.test.js`
- Test: `tests/station-docs-tour.test.js` — loses `settle`, `bootSearch` and its test, which drive the `#dq` listener this task deletes
- Read: `assets/station/remote-card.js` — `html(serve)` returns `''` with no server (`:218-219`)
- Read: `tests/station-src.js` — `SRC`, every `index.html` script in order

**Interfaces:**
- Consumes: `FK_DOCS.page(S, opts)` — Task 4; `opts` is `modOpts({ pkeys: PKEYS })`
- Consumes: `FK_SETTINGS.page(S, opts)` — Task 5; `opts` is `modOpts({ hash, nonce, plugin, configDir })`, and it hands `#/settings/detail…` to `FK_SETDETAIL`
- Consumes: `FK_SETDETAIL` — Task 7; its remote step is `data-block="v9-away-remote"` and holds `w.FK_REMOTE.html(serve)`
- Consumes: `docs-page.js`, `settings-page.js`, `settings-steps.js`, `settings-detail.js` loaded by `assets/station/index.html` — Task 8
- Produces: no caller left of `docsCardHtml`, `docsSearchHtml`, `wizHtml`, `wizLoad`, `wizApply` outside their own definitions and the export block; the page's click listener is found by `'[data-fbtn]'`

**Dispatch:** implementer, opus, high — four `station-hdl-*` files pick listeners by marker and share helpers across sections; deciding which assertion pins a listener this task removes and which pins one that stays is a judgement, and a wrong call deletes a test that guards live behaviour.

1. Find the anchors:

```sh
grep -n "^    view.dsx = \|^    function docsPage(\|^    VIEWS.docs = \|Typing in 文件's box asks\|^    var dsxTimer\|^    VIEWS.list = listPage\|The wizard's state lives\|^    function settingsPage(\|^    VIEWS.settings = \|^    function modOpts(\|The 前端 step's model bar\|^    function fePick(\|The 繁中 / EN switch\|var wzt = route.view === 'settings'" assets/station/station.js
grep -n "'dash.docs'\|'dash.noProjectDocsYet'" assets/station/i18n.js
```

2. Write the failing test. In `tests/station-routes-docs-settings.test.js`:

```js
'use strict';
// station-38, station-39, station-52: #/docs and #/settings draw through
// FK_DOCS and FK_SETTINGS, handed the station and modOpts; the 文件 box's
// input listener, the wizard's settingsPage, its 前端 keydown and its click
// branch are gone from assets/station/station.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { SRC } = require('./station-src.js');

const JS = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
const NOW = Date.parse('2026-10-24T09:00:00.000Z');

// The page booted on `hash` with every document listener kept; `mods` are
// stand-ins whose own `w.FK_X = api` in SRC is ignored (a getter, a no-op setter).
function boot(hash, mods) {
    const els = {};
    const listeners = {};
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', attrs: {}, style: {}, children: [],
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {} });
    const doc = { hidden: false, documentElement: el(), body: el(), title: '', getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); }, createElement: el,
        querySelectorAll: () => [], querySelector: () => null, head: { appendChild() {} } };
    const win = { location: { hash, protocol: 'http:' }, addEventListener() {}, scrollTo() {},
        setInterval: () => 1, setTimeout: () => 1, clearTimeout() {}, navigator: { language: 'zh-TW' },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'cfg', pricesVerified: '2026-09-24', serve: true, nonce: 'N0NCE', plugin: 'PLUG',
            projects: [{ root: 'F:\\ws', gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: [] } };
    for (const [g, api] of Object.entries(mods || {})) Object.defineProperty(win, g, { get: () => api, set() {}, enumerable: true });
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: () => new Promise(() => {}), module: { exports: {} } });
    return { win, listeners, html: () => els.page.innerHTML };
}
// A stand-in module: records what page() was handed and draws one block.
function stub(block) {
    const told = [];
    return { told, page: (S, o) => { told.push({ S, o }); return '<div data-block="' + block + '">' + block + '</div>'; } };
}

test('#/docs is FK_DOCS.page, handed the station and modOpts with the project keys', () => {
    const d = stub('docs-stub');
    const b = boot('#/docs', { FK_DOCS: d });
    assert.ok(b.html().includes('data-block="docs-stub"'), b.html());
    assert.equal(d.told.length >= 1, true);
    const { S, o } = d.told[0];
    assert.equal(S, b.win.STATION);
    assert.ok(Array.isArray(o.pkeys), 'pkeys');
    assert.equal(typeof o.redraw, 'function');
    assert.equal(o.serve, true);
    assert.equal(typeof o.names, 'object');
});

test('#/settings and #/settings/detail/<step> are FK_SETTINGS.page, handed the hash, nonce, plugin and config dir', () => {
    for (const hash of ['#/settings', '#/settings/detail/remote']) {
        const s = stub('settings-stub');
        const b = boot(hash, { FK_SETTINGS: s });
        assert.ok(b.html().includes('data-block="settings-stub"'), hash);
        const { S, o } = s.told[0];
        assert.equal(S, b.win.STATION, hash);
        assert.equal(o.hash, hash);
        assert.equal(o.nonce, 'N0NCE');
        assert.equal(o.plugin, 'PLUG');
        assert.equal(o.configDir, 'cfg');
        assert.equal(typeof o.redraw, 'function');
    }
});

test('the old docs page, its search listener and the wizard\'s page, keydown and click branch are gone', () => {
    assert.match(JS, /VIEWS\.docs = function \(r\) \{ return w\.FK_DOCS\.page\(S, modOpts\(\{ pkeys: PKEYS \}\)\); \};/);
    assert.match(JS, /VIEWS\.settings = function \(r\) \{ return w\.FK_SETTINGS\.page\(S, modOpts\(\{ hash: String\(w\.location\.hash \|\| ''\), nonce: S\.nonce, plugin: S\.plugin, configDir: S\.configDir \}\)\); \};/);
    for (const gone of [/view\.dsx/, /function docsPage\(/, /dsxTimer/, /function dsxPaint\(/, /var wiz = null/, /function settingsPage\(/,
        /function fePick\(/, /\.wz \.fbar \.fsg/, /\.wz \[data-go\]/, /wiz = wizApply\(/]) {
        assert.doesNotMatch(JS, gone, String(gone));
    }
});

test('no document listener holds the docs box or the wizard, and one click listener holds [data-fbtn]', () => {
    const b = boot('#/');
    const all = Object.values(b.listeners).flat().map(String);
    assert.equal(all.filter((s) => s.includes('dsxTimer') || s.includes("'dq'") || s.includes('.wz ')).length, 0);
    assert.equal((b.listeners.click || []).filter((fn) => String(fn).includes('[data-fbtn]')).length, 1);
});
```

3. Run it and watch the first three fail:

```sh
node --test --require ./tests/subprocess-timeout.js tests/station-routes-docs-settings.test.js
```

4. In `assets/station/station.js` (≈`:3276-3283`), delete the eight lines from `    view.dsx = { q: '', res: null };` through the `    }` that closes `function docsPage()`. Keep `    view.closed = {};` and everything after it.

5. In `assets/station/station.js` (≈`:5110`), replace `    VIEWS.docs = docsPage;` with:

```js
    // 文件 is FK_DOCS (assets/station/docs-page.js): the docs-health matrix,
    // its findings, the reader and the project dialog (station-38).
    VIEWS.docs = function (r) { return w.FK_DOCS.page(S, modOpts({ pkeys: PKEYS })); };
```

   In `assets/station/station.js`, delete the lines from `    // Typing in 文件's box asks the server 250 ms after the last key,` through the `    });` that closes the `doc.addEventListener('input', …)` holding `dsxTimer` (≈`:5112-5138`). Keep `    VIEWS.tour = …` above and `    VIEWS.list = listPage;` below.

   In `assets/station/station.js`, replace the lines from `    // The wizard's state lives as long as the page:` through `    VIEWS.settings = settingsPage;` (≈`:5140-5151`) with:

```js
    // 設定 is FK_SETTINGS (assets/station/settings-page.js, 快速設定), which
    // hands #/settings/detail[/<step>] to FK_SETDETAIL itself; parseHash sends
    // every #/settings/… hash here (station-39).
    VIEWS.settings = function (r) { return w.FK_SETTINGS.page(S, modOpts({ hash: String(w.location.hash || ''), nonce: S.nonce, plugin: S.plugin, configDir: S.configDir })); };
```

   `modOpts` is a function declaration a few lines further down, so both views can call it.

   In `assets/station/station.js`, delete the lines from `    // The 前端 step's model bar: arrow keys, Home and End walk the three` through the `    });` that closes the `doc.addEventListener('keydown', …)` holding `'.wz .fbar .fsg'` (≈`:5445-5465`). Keep `    // The 繁中 / EN switch:` and what follows.

   In `assets/station/station.js`, in the page's click listener (≈`:5520`), delete its first seven lines — from `        var wzt = route.view === 'settings' && e.target.closest` through the `        }` that closes `if (wzt) { … }` — so the listener opens on its `// 篩選:` comment. Keep `    doc.addEventListener('click', function (e) {` itself.

6. In `assets/station/i18n.js` (≈`:529-530`), delete the two lines `'dash.docs': 'Docs',` and `'dash.noProjectDocsYet': …`. Then run `node --test --require ./tests/subprocess-timeout.js tests/station-i18n.test.js`: it must pass; any other `used nowhere` it lists is BLOCKED with the key.

7. Update the listener tests.

   `tests/station-hdl-b.test.js`: replace the header comment (`:2-7`) with the lines below; in `boot`'s return delete `dq: by(docInput, ["'dq'", 'dsxTimer']), ` so the line opens `        pickq: by(`; delete from `const dqTarget = (v) =>` (`:62`) through the blank line before `// ---- 2. [data-pickq]` (`:238`) — `dqTarget`, `hit`, `ok` and the whole `// ---- 1. #dq` section. In `tests/station-hdl-b.test.js` the header becomes:

```js
// Three `input` listeners of assets/station/station.js, each pinned so that a
// one-branch mutation of one of them reddens a set of tests no other mutation
// of the same listener reddens: the facet popover's filter ([data-pickq]), the
// header box (#q) and the gate form's 其他 box ([data-pg-other]). The listeners
// are anonymous, so each test picks its own by a phrase of its source.
```

   `tests/station-hdl-c.test.js`: delete from `// ---- 2 first: the wizard's click, which the front bar's tests also press` (`:87`) through the blank line before `// ---- 3. the big keydown listener` (`:308`) — `dataTgt`, `wzClick`, `WZ_SCOPES`, `front` and both sections; nothing after `:308` uses them. Then run `sed -i 's/CLICK_WZ/CLICK_PAGE/g' tests/station-hdl-c.test.js`. Replace the header comment (`:2-8`) and the two constant lines (`:21` `const KEY_FBAR = …` and `:23` `const MARKERS = …`) in `tests/station-hdl-c.test.js` with:

```js
// Two document listeners of assets/station/station.js, each pressed through
// the page's own listener list with fake targets: the page's big keydown
// listener (Esc on the 篩選 panel, the facet popover, legend keys, inputs, `/`)
// and the 1-4 keys that answer a held gate; the page's click listener opens the
// panel they close. Each test is red under a different set of single-branch
// mutations of the handler it presses: no two mutations of one handler redden
// the same tests.
```

   and lines `:21-23` of `tests/station-hdl-c.test.js` (the two constants and the comment between them) with:

```js
const KEY_BIG = 6, KEY_GATE = 7, CLICK_PAGE = 9;
// A literal unique to each pressed document listener, so the one holding it is found wherever it sits.
const MARKERS = { 'keydown:6': '.rpop, .rwrap', 'keydown:7': 'data-gop', 'click:9': '[data-fbtn]' };
```

   `tests/station-hdl-g.test.js`: on `:3` replace `` (the one holding `.wz [data-go]`) `` with `` (the one holding `[data-fbtn]`) ``, and replace `:15` with:

```js
const MARK = '[data-fbtn]';
```

   `tests/station-hdl-k.test.js`: delete from `// ---- the wizard's [data-h], [data-st], [data-ask]` (`:849`) to the end of the file, and the blank line before it. In the header, `:13` becomes `// pick and facet assert the branch's effect before the page count; the fbtn`, and `:19-20` become the one line below (in `tests/station-hdl-k.test.js`):

```js
//   click, `[data-facet] button`, `input[data-cmp]` and `tr[data-id]`.
```

   `tests/station-docs-tour.test.js`: delete from the blank line before `// The debounced `input` listener itself` (`:68`) to the end of the file (`:126`) — the comment, `settle`, `bootSearch` and its test `a rejected search fetch sets the error state and repaints, through the real input listener`, which types into the `#dq` listener this task deletes. The file then ends with the `});` of `a failed search shows a message instead of leaving stale or empty results`; the `docsSearchHtml` tests and the unused requires stay for Task 10.

   `tests/station-remote-mount.test.js`: replace the header (`:2-5`) with the first block below and the two tests `#/settings draws the card after the wizard, …` and `without remote-card.js the settings page is the wizard alone` (`:48-64`) with the second (in `tests/station-remote-mount.test.js`):

```js
// The 手機遠端 card mounted (docs/90-agent/plans/2026-10-21-station-remote-design.md
// §3): 詳細設定's remote step (#/settings/detail/remote, FK_SETDETAIL) draws it
// when assets/station/remote-card.js is loaded, the shell loads that module
// before station.js, and a written station carries it. What the card draws is
// tests/station-remote-card.test.js's.
```

   and the two tests in `tests/station-remote-mount.test.js` become:

```js
test('#/settings/detail/remote draws the card inside the remote step, told whether the page is served', () => {
    const off = stub();
    const page = draw('#/settings/detail/remote', { remote: off });
    assert.ok(page.includes('data-block="v9-away-remote"'), 'the remote step is on screen');
    assert.ok(page.includes(CARD));
    assert.ok(page.indexOf('data-block="v9-away-remote"') < page.indexOf('id="rm-card"'), 'the card sits in the remote step');
    assert.equal(off.told[0], false);
    const on = stub();
    draw('#/settings/detail/remote', { remote: on, serve: true });
    assert.equal(on.told[0], true);
});

test('with the real remote-card.js and no server, the remote step draws no card', () => {
    const page = draw('#/settings/detail/remote');
    assert.ok(page.includes('data-block="v9-away-remote"'));
    assert.ok(!page.includes('rm-card'));
});
```

8. Run them and watch them pass:

```sh
node --test --require ./tests/subprocess-timeout.js tests/station-routes-docs-settings.test.js tests/station-hdl-b.test.js tests/station-hdl-c.test.js tests/station-hdl-g.test.js tests/station-hdl-k.test.js tests/station-remote-mount.test.js tests/station-docs-tour.test.js tests/station-i18n.test.js tests/station-routes-only.test.js
```

   A failure in another `station-*` test that boots `#/docs` or `#/settings` and asserts the old card or wizard markup is decided case by case: delete the assertion if it pins only what this task removed, and stop BLOCKED if it pins something the new pages still owe.

9. Commit:

```text
feat(station): 文件 and 設定 draw through FK_DOCS and FK_SETTINGS; the old listeners go

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

   `git add tests/station-routes-docs-settings.test.js` first, then `git commit -a` with that message.

## Task 10: Delete the old docs card, the seven-step wizard and their strings

**Files:**
- Modify: `assets/station/station.js:797-883` — delete `DOC_STATUS_COLOUR` through `docsSearchHtml`
- Modify: `assets/station/station.js:1899-2902` — delete the wizard between its marker and `// ---- tune: a block changed`, keeping both marker lines; drop `docsCardHtml`, `docsSearchHtml`, `WIZ_STEPS`, `wizLoad`, `wizApply`, `wizChanges`, `wizHtml` from `module.exports` (`:2899`, `:2902`)
- Modify: `assets/station/i18n.js:76-466` — delete the docs-card `shared.*` keys and every `wiz.*` key
- Test: `tests/station-dead-wizard.test.js`
- Test: `tests/station-wizard.test.js` — deleted
- Test: `tests/station-wizard-motion.test.js` — deleted
- Test: `tests/station-docs-tour.test.js` — keeps the two tour tests
- Test: `tests/station-view.test.js` — loses `DOC_A` and the two `docsCardHtml` tests
- Test: `tests/init-skill.test.js` — the wizard's card order as a literal
- Test: `tests/station-shell.test.js` — `split`, `split-h`, `split-bar`, `split-leg` leave the emitted-class list
- Read: `tests/station-i18n.test.js` — `:110` lists the keys used nowhere
- Read: `tests/source.test.js` — `:144`, every exported name needs an importer

**Interfaces:**
- Consumes: no caller left of `docsCardHtml`, `docsSearchHtml`, `wizHtml`, `wizLoad`, `wizApply` outside their own definitions and the export block — Task 9
- Produces: none — `station.js` no longer exports `docsCardHtml`, `docsSearchHtml`, `WIZ_STEPS`, `wizLoad`, `wizApply`, `wizChanges`, `wizHtml`

**Dispatch:** implementer, sonnet, high — about 1,480 lines go in three cuts, and every name in them is grepped across `assets/` and `tests/` before it goes; the higher effort is what keeps a helper something outside the ranges still calls from going with them.

1. Find the anchors and the export lines:

```sh
grep -n "^    // The 文件 card: one section per project\|^    function docsSearchHtml(\|^    // 導覽: the tour's own page\|^    // ---- 設定: the seven-step wizard\|^    // ---- tune: a block changed -\|docsCardHtml: docsCardHtml\|WIZ_STEPS: WIZ_STEPS" assets/station/station.js
```

2. List every name the two cuts declare and where else it appears:

```sh
names=$( (sed -n '/^    \/\/ The 文件 card: one section per project/,/^    \/\/ 導覽: the tour/p' assets/station/station.js; sed -n '/^    \/\/ ---- 設定: the seven-step wizard/,/^    \/\/ ---- tune: a block changed -/p' assets/station/station.js) | grep -oE "^    (function|var) [A-Za-z0-9_]+" | awk '{print $2}' | sort -u)
for n in $names; do echo "$n: $(grep -lw "$n" assets/station/*.js tests/*.js | tr '\n' ' ')"; done
```

   Each name may appear only in `assets/station/station.js` and in `tests/station-wizard.test.js`, `tests/station-wizard-motion.test.js`, `tests/station-docs-tour.test.js`, `tests/station-view.test.js`, `tests/init-skill.test.js`. A name found in any other file is BLOCKED with this output. Inside `station.js`, `grep -n "\b<name>\b" assets/station/station.js` for each must show only lines inside the two cuts and the two export lines.

3. Write the failing test. In `tests/station-dead-wizard.test.js`:

```js
'use strict';
// station-52: the old 文件 card and the seven-step wizard are gone from
// assets/station/station.js, with their strings from i18n.js; the section
// marker tests/station-i18n.test.js keys the `wiz` prefix by stays.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ASSETS = path.join(__dirname, '..', 'assets', 'station');
const JS = fs.readFileSync(path.join(ASSETS, 'station.js'), 'utf8');
const I18N = fs.readFileSync(path.join(ASSETS, 'i18n.js'), 'utf8');

test('no docs-card or wizard function or table is declared in station.js', () => {
    for (const n of ['docSplitHtml', 'docPathList', 'docFilingHtml', 'docProjectHtml', 'docsCardHtml', 'dsxCount', 'dsxResultsHtml', 'docsSearchHtml',
        'wizLoad', 'wizApply', 'wizChanges', 'wizHtml', 'wizCards', 'wizScopes', 'wizStepHtml', 'wizSummaryHtml', 'wizFrontHtml', 'wizSkillHtml']) {
        assert.doesNotMatch(JS, new RegExp('function ' + n + '\\('), n);
    }
    for (const v of ['DOC_STATUS_COLOUR', 'DOC_HATCH', 'WIZ_STEPS', 'WIZ_SCENES', 'WIZ_CARD_TEXT', 'WIZ_FE_MODELS', 'WIZ_STAGES']) {
        assert.doesNotMatch(JS, new RegExp('var ' + v + '\\b'), v);
    }
    assert.match(JS, /^    \/\/ ---- 設定: the seven-step wizard/m);
    assert.match(JS, /^    \/\/ ---- tune: a block changed -/m);
});

test('station.js still loads under require and exports none of them', () => {
    global.window = { STATION: {} };
    const V = require('../assets/station/station.js');
    for (const n of ['docsCardHtml', 'docsSearchHtml', 'WIZ_STEPS', 'wizLoad', 'wizApply', 'wizChanges', 'wizHtml']) assert.equal(n in V, false, n);
    assert.equal(typeof V.tourPage, 'function');
    assert.equal(typeof V.parseHash, 'function');
});

test('i18n.js holds no wizard key and none of the docs card keys', () => {
    assert.doesNotMatch(I18N, /'wiz\./);
    for (const k of ['shared.docsHeading', 'shared.fullTextSearch', 'shared.noHitsFor', 'shared.notBuiltYet', 'shared.filingLocation', 'dash.docs', 'dash.noProjectDocsYet']) {
        assert.equal(I18N.includes("'" + k + "'"), false, k);
    }
});
```

4. Run it and watch all three fail:

```sh
node --test --require ./tests/subprocess-timeout.js tests/station-dead-wizard.test.js
```

5. In `assets/station/station.js` (≈`:797-883`), delete from `    // The 文件 card: one section per project whose \`.fankeel/map.md\` was` through the `    }` that closes `function docsSearchHtml(st, serve)` — the line before `    // 導覽: the tour's own page in a frame.`. `tourPage` and its comment stay.

6. In `assets/station/station.js` (≈`:1900-2448`), delete every line strictly between `    // ---- 設定: the seven-step wizard ----…` and `    // ---- tune: a block changed ----…`; both marker lines stay, with one blank line between them.

7. In `assets/station/station.js`, in the `module.exports = {` block (≈`:2899`), replace the line `heroEyebrow: heroEyebrow, effortChip: effortChip, docsCardHtml: docsCardHtml, docsSearchHtml: docsSearchHtml, tourPage: tourPage,` with the line below, and delete the line `WIZ_STEPS: WIZ_STEPS, wizLoad: wizLoad, wizApply: wizApply, wizChanges: wizChanges, wizHtml: wizHtml,` (≈`:2902`). In `assets/station/station.js`:

```js
            heroEyebrow: heroEyebrow, effortChip: effortChip, tourPage: tourPage,
```

8. Run `node --test --require ./tests/subprocess-timeout.js tests/station-i18n.test.js`. In `assets/station/i18n.js:76-466`, delete every key it lists as `is in i18n.js and used nowhere` (the docs-card `shared.*` keys at `:76-91` and every `wiz.*` key at `:270-466`) and the comment line `// wiz — the settings wizard`; run it again until it passes. A listed key outside `:76-466` is BLOCKED with the key.

9. Update the tests that read what went.

   ```sh
   git rm tests/station-wizard.test.js tests/station-wizard-motion.test.js
   ```

   `tests/station-docs-tour.test.js`: delete the `HIT` constant (`:14-15`) and its blank line, and everything from `test('the written page shows the search block as a note, with no box to type into'` (`:35`) to the end of the file (≈`:67`, Task 9 already cut `bootSearch` and its test) — the four `docsSearchHtml` tests. Delete the requires nothing uses any more (`fs`, `path`, `vm`, and `const { SRC } = require('./station-src.js');`), and replace the header comment (`:2-3`) in `tests/station-docs-tour.test.js` with:

```js
// The 導覽 page and its entry in the left bar (design §5; mockup block
// tour-nav). The tour needs a server: the written page says so instead.
```

   `tests/station-view.test.js`: delete from `const DOC_A = {` (`:1091`) through the blank line after the `docsCardHtml is empty with no project map` test (`:1129`); `DOC_A` is used nowhere else.

   `tests/init-skill.test.js`: in the test `the habits step offers three presets and 逐項設定, …` (`:45-53`), delete the two lines `global.window = { STATION: {} };` and `const V = require('../assets/station/station.js');`, and replace the `V.WIZ_STEPS` assertion (`:51`) with (2-space indent, as `tests/init-skill.test.js` is):

```js
  assert.ok(step.includes('收尾, 任務大小, 前端, context, 撞檔, 模型, 監控站, 答 gate'), 'the cards in the old wizard\'s order');
```

   `tests/station-shell.test.js`: `docSplitHtml` was the only emitter of the split classes, so `:166` becomes (in `tests/station-shell.test.js`):

```js
        's-title', 's-meta', 'tabs',
```

10. Run them, the export check and the earlier tasks' route test, and watch them pass:

```sh
node --test --require ./tests/subprocess-timeout.js tests/station-dead-wizard.test.js tests/station-i18n.test.js tests/station-docs-tour.test.js tests/station-view.test.js tests/init-skill.test.js tests/station-shell.test.js tests/source.test.js tests/station-routes-docs-settings.test.js tests/station-routes-only.test.js
```

11. Commit:

```text
chore(station): delete the old docs card, the seven-step wizard and their strings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

    `git add tests/station-dead-wizard.test.js` first, then `git commit -a` with that message.

## Coverage

| promise | task |
|---|---|
| 完成標準改為：線上的文件頁（assets/station/）與該 mockup 一致。（資料面：健康矩陣、發現清單、閱讀器的文字） | Task 1, Task 3 |
| sessions 重疊、stage.agents、notify/remote、前端偵測、model.lang 的推論都還需要寫程式。 | Task 2 |
| 目前只有 Q1/Q2 的推薦由程式算出（task.js profile suggest）。 | Task 2 |
| 快速設定 route-settings-quick.html：5 塊，每個問題都預選，並標來源「依你的紀錄」或「作者推薦」（資料面：每題的 o 與 src） | Task 2, Task 3 |
| 詳細設定 route-settings-v9.html：10 章，一屏一題，prompt.* 標「進階・不建議」，含 agents 表。（資料面：profileSpec 與 agent key 寫入） | Task 3 |
| station-38 完成標準改為：線上的文件頁（assets/station/）與該 mockup 一致 | Task 4 draws every block (docs-head, docs-health, docs-findings, docs-reader, docs-project) with the mockup's CSS copied verbatim; Task 9 routes `#/docs` to it; verify's render reviewer compares the two |
| station-38 核可的 mockup 是 `.fankeel/build/2026-10-21-station-redesign/route-docs.html`（每一塊都定稿；docs-health 內不放關聯圖） | Task 4 — test `the matrix: …` asserts the docs-health section draws no graph |
| station-38 使用者宣告 route-docs.html 為定稿，且線上的文件頁與它一致 | declared 10-23 (entry's status line); the match is Task 4 + Task 9, checked at verify |
| route-docs.html 的 `rd-cut`「mockup 只帶前 80 行」與「這個 mockup 只帶了…」說明 | struck — mockup-only notes about its bundled data; the station reads every page whole from `/station/doc` |
| station-39「快速設定 `route-settings-quick.html`：5 塊，每個問題都預選，並標來源「依你的紀錄」或「作者推薦」」 | Task 5（`blocks()`、`rec()`、`srcHtml()`；測試「station/suggest moves every untouched answer…」） |
| station-39「有「全部套用推薦」；寫入畫面顯示舊→新；附連結到詳細設定」 | Task 5（`[data-all]`、`finalHtml()` 專案／這台機器分開、`#/settings/detail` 兩處連結；測試「全部套用推薦 opens the write screen…」「寫入 posts the project, then the machine…」） |
| station-39「目前只有 Q1/Q2 的推薦由程式算出（`task.js profile suggest`）」 | Task 5 讀 `/station/suggest` 的十題推薦（算法在 Task 2、送出在 Task 3），沒回答前用作者推薦並標「作者推薦」 |
| station-39「遠端存取要等「Tailscale 以外的遠端方案」」 | struck — 不在這份計畫做；機器卡的「手機遠端」照核可保留勾選並標「待定」（`cardHtml()`；測試「the machine card keeps 手機遠端 checked and tagged 待定…」） |
| station-39「完成標準改為：線上的設定頁與上述兩份 mockup 一致」 | 快速設定這一半：Task 5（模組）＋ Task 8（載入）＋ Task 9（路由）；與 mockup 的視覺一致由 verify 的 render reviewer 拍圖比對 |
| station-39「詳細設定 `route-settings-v9.html`：10 章，一屏一題，prompt.* 標「進階・不建議」，含 agents 表。」 | Task 6（10 章、33 步的表，prompt 的 `adv` 與警告行）、Task 7（一屏一題、rail 章 → 步、到這裡就好 / 繼續、agents 表） |
| station-39「v9 的 agents 表在 390px 寬度下，select 文字會被截斷。」 | Task 6 `settings-steps.css`；實際寬度留給 verify 的 render reviewer（Risks 第 4 條） |
| station-39「遠端存取要等 TODO「Tailscale 以外的遠端方案」。」 | Task 6、7 只把 remote 選項與機器卡標「待定」，連線方式不做 |
| station-39「完成標準改為：線上的設定頁與上述兩份 mockup 一致。」 | 詳細設定這一半：Task 7（證據計數行與 sensitive.txt 提示不畫，見 Risks 第 5 條）；快速設定在 Task 5 |
| station-39「sessions 重疊、stage.agents、notify/remote、前端偵測、model.lang 的推論都還需要寫程式。」 | Task 2 推論；Task 7 只讀 `/station/suggest` 的 `front` 與 `commitFormat` |
| station-38 「完成標準改為：線上的文件頁（assets/station/）與該 mockup 一致」 | Task 8 loads `FK_DOCS` (built in Task 4 on Tasks 1 and 3), Task 9 routes `#/docs` to it, Task 10 removes the old card; the look against `route-docs.html` is verify's render reviewer |
| station-38 「docs-health 內不放關聯圖」 | Task 8 — the reference says the matrix draws no relation graph; the module that keeps it out is Task 4 |
| station-39 「完成標準改為：線上的設定頁與上述兩份 mockup 一致」 | Task 8 loads `FK_SETTINGS`, `FK_SETSTEPS`, `FK_SETDETAIL` (Tasks 5-7), Task 9 routes `#/settings` and `#/settings/detail…` to them, Task 10 removes the wizard |
| station-39 快速設定「5 塊，每個問題都預選，並標來源「依你的紀錄」或「作者推薦」；有「全部套用推薦」；寫入畫面顯示舊→新；附連結到詳細設定」 | Task 8 documents it; built in Task 5 |
| station-39 詳細設定「10 章，一屏一題，prompt.* 標「進階・不建議」，含 agents 表」 | Task 8 documents it; built in Tasks 6, 7; the remote step keeps the 手機遠端 card (Task 9's `tests/station-remote-mount.test.js`) |
| station-39 「sessions 重疊、stage.agents、notify/remote、前端偵測、model.lang 的推論都還需要寫程式」 | Task 8 documents `GET /station/suggest`; built in Tasks 2, 3 |
| station-39 「遠端存取要等 TODO『Tailscale 以外的遠端方案』」 | struck — remote access stays 待定 (station-49); the `station.remote` option is drawn tagged 待定 and documented so in Task 8 |
| station-39 「v9 的 agents 表在 390px 寬度下，select 文字會被截斷」 | struck from 8-10 — Task 6's `settings-steps.css`; the 390 px look is verify's render reviewer |
| station-52 「每個剩下的畫面各自成為一個 classic-script 的 FK_* 模組」 — docs and settings | Tasks 9, 10 (the modules are Tasks 4-7) |
| station-52 「每個剩下的畫面各自成為一個 classic-script 的 FK_* 模組」 — days, list, focus | struck — later plans; `station.js` takes two writing tasks a plan (`SHARED_CAP`, `lib/plantasks.js:600`) |
| station-52 (b) 「station.js 不超過約 1,500 行，只剩外殼」 | struck — Tasks 9 and 10 remove about 710 lines and `station.js` ends near 5,700; station-52 stays Ready with days, list and focus named as the remainder |
| station-52 (d) 「npm test 全綠，沒有測試換成新技術」 | Tasks 8-10, each task's run step and the parent's `node scripts/suite.js --fast`; every new test is `node:test` with `vm.runInNewContext` |
