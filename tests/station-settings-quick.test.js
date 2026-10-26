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
        if (url.startsWith('station/suggest') && opts.suggest === 'reject') return Promise.reject(new Error('offline'));
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
    return { Q, S, o, html, calls, draws: () => draws, win: p.win, doc: p.doc };
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
    assert.deepEqual([...qs.map((q) => q.id)].sort(), Object.keys(SHAPES).sort());
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

test('the machine card keeps 手機遠端 checked, says Tailscale is the default, and writes only after 確認', async () => {
    const b = boot();
    b.html();
    await tick(); await tick();
    b.Q.state().at = 'away';
    let h = b.html();
    assert.match(h, /data-mk="station.remote" checked>[\s\S]*?<span class="qk-mpend">預設走 Tailscale；Cloudflare Tunnel \+ Access 是之後的進階選項，現在還不支援。<\/span>/);
    const card = h.slice(h.indexOf('data-mk="station.remote"'), h.indexOf('</ul>', h.indexOf('data-mk="station.remote"')));
    assert.doesNotMatch(card, /待定/);
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

test('a station/suggest that fails says recommendations are unavailable instead of 作者推薦 with no record', async () => {
    const b = boot({ suggest: null });
    assert.match(b.html(), /class="qk-src is-author"[^>]*>作者推薦</, 'before the answer it is still the author default');
    await tick(); await tick();
    assert.ok(b.draws() >= 1, 'the failure redraws');
    const h = b.html();
    assert.match(h, /class="qk-src is-author"[^>]*>推薦取不到</);
    assert.match(h, /id="qks-main"><b>推薦暫時取不到，這是 fankeel 預設<\/b>/);
    assert.doesNotMatch(h, /沒有足夠的紀錄可以推/);
    const r = boot({ suggest: 'reject' });
    r.html();
    await tick(); await tick();
    assert.match(r.html(), /id="qks-main"><b>推薦暫時取不到/, 'a request that never got an answer says so too');
});

test('the project picker is disabled while a write is in flight, so a switch cannot drop the machine write', async () => {
    const b = boot({ second: true });
    b.html();
    await tick(); await tick();
    click(b.Q, [{ 'data-all': '' }]);
    assert.doesNotMatch(b.html(), /<select data-sq-proj disabled>/);
    click(b.Q, [{ 'data-write': '' }]);
    assert.equal(b.Q.state().busy, true);
    assert.match(b.html(), /<select data-sq-proj disabled>/);
    await tick(); await tick(); await tick();
    assert.doesNotMatch(b.html(), /<select data-sq-proj disabled>/, 'back on once the write finished');
});

test('a ? tag toggles its tip open and shut, opening one closes the others, a click elsewhere closes all', () => {
    const b = boot({ serve: false });
    b.html();
    const other = { 'aria-expanded': 'true' };
    b.doc.querySelectorAll = () => [{ setAttribute: (k, v) => { other[k] = v; } }];
    const qm = { 'data-qm': '', 'aria-expanded': 'false' };
    click(b.Q, [qm]);
    assert.equal(qm['aria-expanded'], 'true');
    assert.equal(other['aria-expanded'], 'false', 'the other open tip closed');
    click(b.Q, [qm]);
    assert.equal(qm['aria-expanded'], 'false');
    const open = [];
    b.doc.querySelectorAll = () => [{ setAttribute: (k, v) => open.push(k + '=' + v) }];
    b.Q.onClick({ target: el([{}]) });
    assert.deepEqual(open, ['aria-expanded=false'], 'a click outside [data-sq] closes the tips');
});

test('下一組 and 上一組 walk the five blocks to the write screen and back', () => {
    const b = boot({ serve: false });
    b.html();
    click(b.Q, [{ 'data-next': '' }]);
    assert.equal(b.Q.state().at, 'parallel');
    assert.equal(b.Q.state().seen.land, true, 'the block left reads as done');
    click(b.Q, [{ 'data-prev': '' }]);
    assert.equal(b.Q.state().at, 'land');
    click(b.Q, [{ 'data-prev': '' }]);
    assert.equal(b.Q.state().at, 'land', 'no group before the first');
    b.Q.state().at = 'away';
    click(b.Q, [{ 'data-next': '' }]);
    assert.equal(b.Q.state().at, 'final');
    assert.equal(b.draws(), 3, "the move before the first group redraws nothing");
});

test('the rail toggle opens and closes the rail on a narrow screen', () => {
    const b = boot({ serve: false });
    b.html();
    const tg = { 'data-rtog': '', 'aria-expanded': 'false' }, rail = { 'data-rail': '', 'data-open': 'false' };
    click(b.Q, [tg, rail]);
    assert.equal(rail['data-open'], 'true');
    assert.equal(tg['aria-expanded'], 'true');
    click(b.Q, [tg, rail]);
    assert.equal(rail['data-open'], 'false');
    assert.equal(tg['aria-expanded'], 'false');
});

test('arrow keys move an answer round its question, wrapping; other keys and other targets do nothing', () => {
    const b = boot({ serve: false });
    b.html();
    const key = (k, o) => {
        let stopped = 0;
        b.Q.onKey({ key: k, target: el([{ 'data-o': o }, { 'data-q': 'main' }, ROOT]), preventDefault: () => { stopped++; } });
        return stopped;
    };
    const ans = () => b.Q.state().ans.main;
    assert.equal(key('ArrowDown', 'merge'), 1, 'the arrow does not scroll the page');
    assert.equal(ans(), 'pr');
    key('ArrowRight', 'pr');
    assert.equal(ans(), 'keep');
    key('ArrowDown', 'keep');
    assert.equal(ans(), 'direct', 'past the last wraps to the first');
    key('ArrowUp', 'direct');
    assert.equal(ans(), 'keep', 'before the first wraps to the last');
    key('ArrowLeft', 'keep');
    assert.equal(ans(), 'pr');
    const before = b.draws();
    assert.equal(key('Enter', 'pr'), 0);
    b.Q.onKey({ key: 'ArrowDown', target: el([{ 'data-o': 'pr' }, ROOT]), preventDefault() {} });
    assert.equal(ans(), 'pr', 'an option outside a question is left alone');
    assert.equal(b.draws(), before);
});

test('Escape closes the open tips', () => {
    const b = boot({ serve: false });
    b.html();
    const open = [];
    b.doc.querySelectorAll = () => [{ setAttribute: (k, v) => open.push(k + '=' + v) }];
    b.Q.onKey({ key: 'Escape', target: el([{}]) });
    assert.deepEqual(open, ['aria-expanded=false']);
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

// A stand-in range input: value, the question around it, the readout box beside it.
function slider(value) {
    const readout = { textContent: '' }, effect = { textContent: '' }, attrs = {};
    const box = { querySelector: (s) => (s === 'output' ? readout : effect) };
    const input = { value, getAttribute: (k) => (k === 'data-slide' ? '' : null), setAttribute: (k, v) => { attrs[k] = v; },
        closest: (s) => (s === '[data-q]' ? { getAttribute: () => 'inflight' } : s === '[data-slider]' ? box : s === '[data-sq]' ? {} : null) };
    return { input, readout, attrs };
}

test('同時派幾個 is one range input: 21 stops 1..20 then 無上限, marks 最低 4 and 建議 8, the stop beside it', () => {
    const b = boot({ serve: false });
    b.html();
    b.Q.state().at = 'parallel';
    const h = b.html();
    assert.match(h, /<input type="range" class="v9-range" id="qkr-inflight" data-slide min="1" max="21" step="1" value="8" aria-labelledby="qkq-inflight" aria-valuetext="8">/);
    assert.match(h, /<output class="v9-sval" for="qkr-inflight">8<\/output>/);
    assert.match(h, /<span class="v9-mk m4">最低 4<\/span><span class="v9-mk m8">建議 8<\/span><span class="v9-mk mu">無上限<\/span>/);
    assert.doesNotMatch(h, /data-o="12"/, 'no radio buttons for it any more');
    const stops = b.Q.questions().find((q) => q.id === 'inflight').opts;
    assert.deepEqual([...stops.map((a) => a.o)], [...Array.from({ length: 20 }, (_, i) => String(i + 1)), 'unlimited']);
    assert.deepEqual(JSON.parse(JSON.stringify(stops[19].w)), { 'dispatch.inflight': '20' });
    assert.deepEqual(JSON.parse(JSON.stringify(stops[20].w)), { 'dispatch.inflight': 'unlimited' });
    b.Q.state().ans.inflight = 'unlimited';
    assert.match(b.html(), /id="qkr-inflight" data-slide min="1" max="21" step="1" value="21" aria-labelledby="qkq-inflight" aria-valuetext="無上限">/);
    assert.match(b.html(), /<output class="v9-sval" for="qkr-inflight">無上限<\/output>/);
});

test('moving the range sets the answer without a redraw; the last stop is unlimited, one past it is ignored', () => {
    const b = boot({ serve: false });
    b.html();
    const before = b.draws();
    const s20 = slider('20');
    b.Q.onInput({ target: s20.input });
    assert.equal(b.Q.state().ans.inflight, '20');
    assert.equal(s20.readout.textContent, '20');
    assert.equal(s20.attrs['aria-valuetext'], '20');
    const s21 = slider('21');
    b.Q.onInput({ target: s21.input });
    assert.equal(b.Q.state().ans.inflight, 'unlimited');
    assert.equal(s21.readout.textContent, '無上限');
    b.Q.onInput({ target: slider('22').input });
    b.Q.onInput({ target: slider('0').input });
    assert.equal(b.Q.state().ans.inflight, 'unlimited', 'a stop past either end is not an answer');
    assert.equal(b.draws(), before, 'a redraw would drop the drag');
    b.Q.onChange({ target: slider('3').input });
    assert.equal(b.Q.state().ans.inflight, '3');
    assert.equal(b.draws(), before + 1, 'letting go redraws the rail and the strip');
});

test('unlimited goes to the write screen as dispatch.inflight: unlimited', () => {
    const b = boot({ serve: false });
    b.html();
    b.Q.onInput({ target: slider('21').input });
    b.Q.state().at = 'final';
    assert.match(b.html(), /<code>dispatch\.inflight: unlimited<\/code>/);
});

test('已寫入 N 項 is a compact row under the summary: a 16px check, never the unsized svg', async () => {
    const b = boot();
    b.html();
    click(b.Q, [{ 'data-all': '' }]);
    click(b.Q, [{ 'data-write': '' }]);
    await tick(); await tick();
    const h = b.html();
    assert.match(h, /<p class="v9-fin-ok" role="status"><svg viewBox="0 0 16 16"[^>]*><path d="[^"]*"\/><\/svg><span>已寫入 \d+ 項。<\/span><\/p>/);
    assert.ok(h.indexOf('data-fin') < h.indexOf('v9-fin-ok') && h.indexOf('v9-fin-ok') < h.indexOf('qk-extra'), 'right under the summary, above the extras');
    const css = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'settings-detail.css'), 'utf8');
    assert.match(css, /\.v9-fin-ok svg\{[^}]*width:16px;[^}]*height:16px/, 'without it the check fills the column');
});
