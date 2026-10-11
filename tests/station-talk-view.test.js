'use strict';
// The session page's 對話 tab as markup: every turn whole, a text tag and a
// time on each, a fenced block as a monospace block and nothing else turned
// into markup, a compaction and the summary after it as one block, and the
// 已顯示 N / M 輪 line with a button while turns are left. Only functions of
// what the caller kept (`held`) are tested here; the fetching is the page's.
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = { STATION: {} };
const V = require('../assets/station/station.js');

// Local times, so the `MM-DD HH:MM` the page prints is the same in any zone.
const iso = (mo, d, h, mi) => new Date(2026, mo - 1, d, h, mi).toISOString();
const LONG = 'y'.repeat(5000);
const TURNS = [
    { kind: 'user', at: iso(10, 8, 17, 46), text: '問 <b>\n第二行' },
    { kind: 'claude', at: iso(10, 8, 17, 49), text: '改法是：\n```js\nconst a = 1 < 2;\n```\n就這樣。' },
    { kind: 'interrupt', at: iso(10, 8, 18, 21), text: '[Request interrupted by user for tool use]' },
    { kind: 'compact', at: iso(10, 8, 23, 51), text: '', trigger: 'auto', preTokens: 412000 },
    { kind: 'summary', at: iso(10, 8, 23, 51), text: 'This session is being continued\n1. 主要請求' },
    { kind: 'claude', at: iso(10, 8, 23, 53), text: LONG },
];
const held = (over) => Object.assign({
    state: '', total: 9, counts: { compact: 1, user: 1, claude: 2 },
    skipped: { meta: 310, tool: 2140, agent: 0, notification: 12, unparsed: 0 }, turns: TURNS,
}, over);

test('the counts line names the whole conversation, the left-out kinds biggest first and none that is 0', () => {
    const html = V.talkHtml('abc', held());
    const line = html.match(/<p class="tkc" data-block="talk-counts">[\s\S]*?<\/p>/)[0];
    assert.match(line, /^<p class="tkc" data-block="talk-counts">使用者 <b>1<\/b> 輪<i class="sep">·<\/i>Claude <b>2<\/b> 輪<i class="sep">·<\/i><code>compact<\/code> <b>1<\/b> 次<i class="sep">·<\/i>/);
    assert.match(line, /略過 <code>tool<\/code> <b>2,140<\/b>、<code>meta<\/code> <b>310<\/b>、<code>notification<\/code> <b>12<\/b><\/span><\/p>$/);
    assert.doesNotMatch(line, /agent|unparsed/);
    const none = V.talkHtml('abc', held({ skipped: { meta: 0, tool: 0, unparsed: 0 } }));
    assert.doesNotMatch(none.match(/<p class="tkc"[\s\S]*?<\/p>/)[0], /略過|class="out"/, 'nothing left out, no clause');
});

test('a user turn and a Claude turn each carry a text tag and MM-DD HH:MM, and the text is escaped with its line breaks kept', () => {
    const html = V.talkHtml('abc', held());
    assert.ok(html.includes('<li class="tk-user" data-block="talk-turn-user"><time class="tm" datetime="' + TURNS[0].at + '">10-08 17:46</time>'
        + '<span class="who">使用者</span><div class="tx"><div class="t">問 &lt;b&gt;\n第二行</div></div></li>'));
    assert.match(html, /<li class="tk-claude" data-block="talk-turn-claude"><time class="tm" datetime="[^"]+">10-08 17:49<\/time><span class="who">Claude<\/span>/);
    assert.ok(html.includes(LONG), 'a reply is not cut');
});

test('only a ``` fence becomes a monospace block, and the fence lines are not drawn', () => {
    const html = V.talkHtml('abc', held());
    assert.ok(html.includes('<div class="t">改法是：</div><pre class="code" aria-label="程式碼區塊 js">const a = 1 &lt; 2;</pre><div class="t">就這樣。</div>'));
    assert.ok(!html.includes('```'));
    assert.equal(V.talkBody('```\na\nb\n```'), '<pre class="code">a\nb</pre>', 'no language, no label');
    assert.equal(V.talkBody('前\r\n```sh\r\nls\r\n'), '<div class="t">前</div><pre class="code" aria-label="程式碼區塊 sh">ls\n</pre>', 'a fence never closed runs to the end');
    assert.equal(V.talkBody('# 標題\n- **粗** `行內`'), '<div class="t"># 標題\n- **粗** `行內`</div>', 'markdown is left as typed');
    assert.equal(V.talkBody(''), '');
});

test('an interruption is one line', () => {
    const html = V.talkHtml('abc', held());
    assert.ok(html.includes('<li class="tk-int" data-block="talk-turn-interrupt"><time class="tm" datetime="' + TURNS[2].at + '">10-08 18:21</time>'
        + '<span class="who">中斷</span><div class="tx"><div class="t">使用者中斷了 Claude 這一輪<code>[Request interrupted by user for tool use]</code></div></div></li>'));
});

test('a compaction and the summary after it are one block: time, trigger, context before, the summary shut until opened', () => {
    const html = V.talkHtml('abc', held());
    assert.equal(html.split('class="tk-cut"').length - 1, 1);
    assert.equal(html.split('<li ').length - 1, 5, 'six turns, the pair drawn once');
    const cut = html.match(/<li class="tk-cut"[\s\S]*?<\/li>/)[0];
    assert.match(cut, /^<li class="tk-cut" data-block="talk-compact"><time class="tm" datetime="[^"]+">10-08 23:51<\/time><details class="cut" data-key="talk-cut-3"><summary>/);
    assert.match(cut, /<code class="ck">compact<\/code><span class="cm"><code>auto<\/code><i class="sep">·<\/i>壓縮前 context <b>412k<\/b><\/span>/);
    assert.match(cut, /<span class="o">看摘要<\/span><span class="c">收起摘要<\/span>/);
    assert.match(cut, /<div class="t">This session is being continued\n1\. 主要請求<\/div><\/div><\/details><\/li>$/);
    assert.doesNotMatch(cut, /<details class="cut"[^>]* open/);
});

test('a compaction whose summary is not loaded yet is the bare break, and a trigger or size not recorded is left out', () => {
    const cut = (t) => V.talkHtml('abc', held({ turns: [t], total: 5 })).match(/<li class="tk-cut"[\s\S]*?<\/li>/)[0];
    const bare = cut({ kind: 'compact', at: iso(10, 8, 9, 5), text: '', trigger: 'manual', preTokens: 349064 });
    assert.match(bare, /<div class="cut"><div class="cutbar"><code class="ck">compact<\/code><span class="cm"><code>manual<\/code><i class="sep">·<\/i>壓縮前 context <b>349k<\/b><\/span>/);
    assert.doesNotMatch(bare, /<details|看摘要/);
    assert.match(bare, /09:05/);
    assert.match(cut({ kind: 'compact', at: iso(10, 8, 9, 5), text: '', trigger: null, preTokens: null }), /<span class="cm"><\/span>/);
});

test('the foot says 已顯示 N / M 輪 and offers 100 more while turns are left, and no button once all are loaded', () => {
    const more = V.talkHtml('abc', held());
    assert.ok(more.includes('<div class="tkmore" data-block="talk-more"><span>已顯示 <b>6</b> / <b>9</b> 輪</span>'
        + '<button type="button" class="ctl" data-talk="abc">再載入 100 輪</button></div>'));
    const all = V.talkHtml('abc', held({ total: 6 }));
    assert.match(all, /已顯示 <b>6<\/b> \/ <b>6<\/b> 輪/);
    assert.doesNotMatch(all, /<button/);
    const loading = V.talkHtml('abc', held({ state: 'loading' }));
    assert.match(loading, /讀取中…/);
    assert.doesNotMatch(loading, /<button/);
    assert.match(V.talkHtml('abc', held({ state: 'failed' })), /讀不到對話<\/span><button type="button" class="ctl" data-talk="abc">重試<\/button>/);
});

test('before the first page, while it fails, and for a conversation with no turns', () => {
    assert.equal(V.talkHtml('abc', undefined), '<p class="tally">讀取中…</p>');
    assert.equal(V.talkHtml('abc', { turns: [], total: null, state: 'loading' }), '<p class="tally">讀取中…</p>');
    assert.match(V.talkHtml('abc', { turns: [], total: null, state: 'failed' }), /<button type="button" class="ctl" data-talk="abc">重試<\/button>/);
    const empty = V.talkHtml('abc', held({ turns: [], total: 0, counts: { compact: 0, user: 0, claude: 0 }, skipped: { tool: 3 } }));
    assert.doesNotMatch(empty, /<ol|<button/);
    assert.match(empty, /使用者 <b>0<\/b> 輪/);
});

test('a transcript that is not on this machine, and a written copy with no server, each say so instead of showing nothing', () => {
    const gone = V.talkHtml('abc', { turns: [], total: null, state: 'missing' });
    assert.ok(gone.startsWith('<div class="emptyd tkmiss" data-block="talk-missing"><p class="et">這台機器上已經沒有這個 session 的 transcript</p>'));
    assert.match(gone, /<code>~\/\.claude\/settings\.json<\/code> 的 <code>cleanupPeriodDays<\/code> 調大/);
    assert.doesNotMatch(gone, /tkc|<button/);
    const copy = V.talkHtml('abc', { turns: [], total: null, state: 'static' });
    assert.match(copy, /class="et">要從 serve 開的頁面才讀得到對話/);
    assert.match(copy, /<code>node scripts\/station\.js serve --open<\/code>/);
});
