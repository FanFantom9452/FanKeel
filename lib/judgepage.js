'use strict';

// judge-5: what a filed judgement shows the user beyond its path. `plainOf`
// cuts the answer's `## 白話` section — the judge's plain summary
// (agents/fankeel-judge.md) — for `judge.js record` to print; `pageOf` turns a
// judgement file into one self-contained HTML page in the station's look, each
// ```chartroom fence drawn to SVG by lib/board.js. No new dependency.
const board = require('./board.js');
const askhuman = require('./askhuman.js');
const { tokens } = require('./weekly-render.js');

// What record prints of the plain section: past this the reader opens the file.
const PLAIN_MAX = 600;
const PLAIN = /^## 白話[ \t]*$/m;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function plainOf(answer) {
    const text = String(answer || '').replace(/\r\n/g, '\n');
    const m = PLAIN.exec(text);
    if (!m) return null;
    const rest = text.slice(m.index + m[0].length);
    const next = /^## /m.exec(rest);
    const body = (next ? rest.slice(0, next.index) : rest).trim();
    if (!body) return null;
    return body.length > PLAIN_MAX ? body.slice(0, PLAIN_MAX) + '…（全文見判決檔）' : body;
}

function withoutPlain(md) {
    const m = PLAIN.exec(md);
    const rest = md.slice(m.index + m[0].length);
    const next = /^## /m.exec(rest);
    return md.slice(0, m.index) + (next ? rest.slice(next.index) : '');
}

function wantsHtml(brief) {
    return /^html:[ \t]*yes[ \t]*$/im.test(String(brief || ''));
}

// Escaped first, so every tag below is ours; a link keeps a relative path or
// an http(s) url and leaves any other scheme as text.
function inline(s) {
    return esc(s)
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (all, t, href) => (SCHEME.test(href) && !/^https?:/i.test(href) ? all : '<a href="' + href + '">' + t + '</a>'));
}

const TABLE = /^\s*\|.*\|\s*$/;
const RULE = /^\s*\|[\s:|-]+\|\s*$/;
const ITEM = /^\s*(?:[-*]|\d+\.)\s+(.*)$/;
const BREAK = /^(```|#{1,4}\s|\s*\||\s*(?:[-*]|\d+\.)\s)/;
const cells = (l) => l.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));

// The markdown a judgement holds: headings to h4, fenced code, pipe tables,
// flat lists and paragraphs. The n-th ```chartroom fence takes svgs[n].
function mdToHtml(md, svgs) {
    const lines = String(md).replace(/\r\n/g, '\n').split('\n');
    const out = [];
    let drawn = 0;
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        const fence = /^```(\S*)\s*$/.exec(line);
        if (fence) {
            const body = [];
            for (i++; i < lines.length && !/^```\s*$/.test(lines[i]); i++) body.push(lines[i]);
            i++;
            if (fence[1] === 'chartroom') out.push('<figure class="board">' + ((svgs || [])[drawn++] || '<pre>' + esc(body.join('\n')) + '</pre>') + '</figure>');
            else out.push('<pre><code>' + esc(body.join('\n')) + '</code></pre>');
            continue;
        }
        const h = /^(#{1,4})\s+(.*)$/.exec(line);
        if (h) {
            out.push('<h' + h[1].length + '>' + inline(h[2]) + '</h' + h[1].length + '>');
            i++;
            continue;
        }
        if (TABLE.test(line) && i + 1 < lines.length && RULE.test(lines[i + 1])) {
            const head = cells(line);
            const rows = [];
            for (i += 2; i < lines.length && TABLE.test(lines[i]); i++) rows.push(cells(lines[i]));
            out.push('<table><thead><tr>' + head.map((c) => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>'
                + rows.map((r) => '<tr>' + r.map((c) => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table>');
            continue;
        }
        if (ITEM.test(line)) {
            const tag = /^\s*\d+\./.test(line) ? 'ol' : 'ul';
            const items = [];
            for (; i < lines.length && ITEM.test(lines[i]); i++) items.push(ITEM.exec(lines[i])[1]);
            out.push('<' + tag + '>' + items.map((t) => '<li>' + inline(t) + '</li>').join('') + '</' + tag + '>');
            continue;
        }
        if (!line.trim()) {
            i++;
            continue;
        }
        const para = [line];
        for (i++; i < lines.length && lines[i].trim() && !BREAK.test(lines[i]); i++) para.push(lines[i]);
        out.push('<p>' + inline(para.join('\n')).replace(/\n/g, '<br>') + '</p>');
    }
    return out.join('\n');
}

const CSS = [
    'body{margin:0;background:var(--ground,#f6f5f0);color:var(--ink,#1d1f23);font:15px/1.7 var(--f-ui,system-ui,sans-serif)}',
    'main{max-width:920px;margin:0 auto;padding:32px 24px 64px}',
    'h1{font-size:24px;line-height:1.3}h2{font-size:18px;margin-top:2em;border-bottom:1px solid var(--rule,#d8d6cf)}h3,h4{font-size:15px}',
    'code,pre{font-family:var(--f-mono,ui-monospace,monospace);font-size:13px}',
    'pre{background:var(--card,#fff);border:1px solid var(--line,#d8d6cf);border-radius:var(--r,10px);padding:12px;overflow:auto;white-space:pre-wrap}',
    'table{border-collapse:collapse;width:100%;margin:1em 0;background:var(--card,#fff)}th,td{border:1px solid var(--line,#d8d6cf);padding:6px 10px;text-align:left;vertical-align:top}',
    '.plain{background:var(--card,#fff);border:1px solid var(--line,#d8d6cf);border-radius:var(--r,10px);padding:4px 20px;margin-bottom:24px}',
    '.plain h2{margin-top:12px;border:0}',
    'figure.board{margin:1em 0;overflow:auto}figure.board svg{max-width:100%;height:auto}',
].join('\n');

// The ask-human page (judge-asks-human, the approved mockup). Shipped only with
// a record that carries questions, so every other page stays as it was.
const ASK_CSS = [
    '.vt{position:absolute;opacity:0;width:1px;height:1px;margin:0}',
    '.top{display:flex;flex-wrap:wrap;gap:12px;align-items:stretch;margin:0 0 20px}',
    '.human{flex:1 1 20em;margin:0;padding:10px 16px;background:var(--signal-tint);border-radius:var(--r-sm);line-height:1.5}',
    '.human strong{color:var(--signal-ink);margin-right:8px}.human.done{background:var(--inset)}.human.done strong{color:var(--ink)}',
    '.views{display:inline-flex;align-self:center;border:1px solid var(--rule2);border-radius:var(--r-sm);overflow:hidden;background:var(--card)}',
    '.views label{display:flex;align-items:center;min-height:44px;padding:0 18px;cursor:pointer;color:var(--ink2)}',
    '.views label+label{border-left:1px solid var(--rule2)}',
    '.vt-short:checked~.top label.l-short,.vt-long:checked~.top label.l-long{background:var(--ink);color:var(--panel)}',
    '.vt-short:focus-visible~.top label.l-short,.vt-long:focus-visible~.top label.l-long{outline:2px solid var(--keel);outline-offset:-3px}',
    '.vt-short:checked~.long{display:none}',
    '.glance h2,.charts h2,.ask h2{margin-top:0}.glance{margin-bottom:8px}',
    '.gq{margin:0 0 20px}.gq-q{margin:0 0 4px;font-weight:600;line-height:1.5}',
    '.gopts{list-style:none;margin:0;padding:0}',
    '.gopts li{display:grid;grid-template-columns:minmax(9em,15em) 1fr 1fr;gap:2px 20px;padding:8px 0;border-top:1px solid var(--rule);line-height:1.5}',
    '.gopts .name{font-weight:600}.pc{font-weight:600;margin-right:6px}.pro .pc{color:var(--pass-ink)}.con .pc{color:var(--fail-ink)}',
    '.tag{display:inline-block;margin-left:6px;padding:0 6px;font-size:12px;font-weight:400;color:var(--ink2);background:var(--inset);border-radius:var(--r-sm);white-space:nowrap}',
    '.tag.you{background:var(--keel-tint);color:var(--keel-deep)}.tag.off{background:var(--signal-tint);color:var(--signal-ink)}',
    '.decision{margin:0 0 6px;padding:10px 16px;background:var(--keel-tint);border-radius:var(--r);line-height:1.6}',
    '.decision.wait{background:var(--inset)}',
    '.decision .k{font-family:var(--f-mono);font-size:13px;color:var(--ink2);margin-right:6px}',
    '.after{margin:0 0 28px;font-size:13px;color:var(--muted)}',
    '.charts{margin-bottom:24px}.charts .note{margin:-4px 0 8px;font-size:13px;color:var(--muted)}',
    '.charts figure.board{margin:0 0 12px}',
    '.ask{margin-bottom:24px}.ask details{border-top:1px solid var(--rule)}.ask details:last-of-type{border-bottom:1px solid var(--rule)}',
    '.ask summary{display:flex;flex-wrap:wrap;gap:2px 12px;align-items:baseline;min-height:44px;padding:10px 0;cursor:pointer;list-style-position:outside}',
    '.ask summary::-webkit-details-marker{display:none}',
    '.ask summary::before{content:\'▸\';width:1em;color:var(--muted)}.ask details[open]>summary::before{content:\'▾\'}',
    '.ask summary:focus-visible{outline:2px solid var(--keel);outline-offset:2px;border-radius:2px}',
    '.ask summary .sq{font-weight:600;flex:1 1 22em}.ask summary .st{font-size:13px;color:var(--muted)}',
    '.ask .why{margin:0;font-size:13px;color:var(--muted)}',
    '.ask table{margin:8px 0 16px}.ask th{font-weight:600;white-space:nowrap}.ask td.opt{font-weight:600;min-width:9em}',
    '.ask tr.picked td{background:var(--keel-tint)}.ask tr.picked.offrow td{background:var(--signal-tint)}',
    '@media (max-width:600px){',
    '.gopts li{grid-template-columns:1fr}',
    '.ask table,.ask tbody,.ask tr,.ask td{display:block;width:auto}',
    '.ask thead{display:none}',
    '.ask tr{margin-bottom:10px;border:1px solid var(--line);border-radius:var(--r-sm);background:var(--card);overflow:hidden}',
    '.ask td{border:0;border-top:1px solid var(--rule);padding:6px 12px}.ask td:first-child{border-top:0}',
    '.ask td::before{content:attr(data-label);display:block;font-size:12px;font-weight:400;color:var(--muted)}',
    '.ask table{background:transparent}.views{align-self:flex-start}',
    '.charts figure.board{overflow-x:auto}.charts figure.board svg{max-width:none}',
    '}',
    '@container (max-width:600px){',
    '.gopts li{grid-template-columns:1fr}',
    '.ask table,.ask tbody,.ask tr,.ask td{display:block;width:auto}',
    '.ask thead{display:none}',
    '.ask tr{margin-bottom:10px;border:1px solid var(--line);border-radius:var(--r-sm);background:var(--card);overflow:hidden}',
    '.ask td{border:0;border-top:1px solid var(--rule);padding:6px 12px}.ask td:first-child{border-top:0}',
    '.ask td::before{content:attr(data-label);display:block;font-size:12px;font-weight:400;color:var(--muted)}',
    '.ask table{background:transparent}.views{align-self:flex-start}',
    '.charts figure.board{overflow-x:auto}.charts figure.board svg{max-width:none}',
    '}',
].join('\n');

const codeify = (s) => esc(s == null ? '' : s).replace(/pick:/g, '<code>pick:</code>');
const fallback = (e) => '<pre class="bad">' + esc('這張圖畫不出來：' + (e && e.message)) + '</pre>';

// One question per state: the option the answer picked (null while unanswered or
// when the answer matches no option), and the assumed option.
function askOf(questions, parsed) {
    return questions.map((q) => {
        const row = parsed ? parsed.rows.find((r) => r.q === q.q) || null : null;
        const picked = row ? q.options.find((o) => o.label === row.answer) || null : null;
        return { q, row, picked, off: !!picked && !picked.assumed, assumed: q.options.find((o) => o.assumed) };
    });
}

// The board source the mockup's gen/charts.js drew: question -> options -> branch.
// The assumed path is bold while unanswered; the answered path is bold once answered.
function chartOf(s, answered) {
    const KEEL = '#2d5bd8', TINT = '#e3eafb', SOFT = '#8d9793';
    const FILL = { fill: TINT, stroke: KEEL, strokeWidth: 2 };
    const HOT = { stroke: KEEL, strokeWidth: 2.5 };
    const OFF = { dash: true, stroke: SOFT };
    const L = [
        JSON.stringify({ chartroom: 1, title: answered ? '你的回答走的路' : '判官假設的路', root: 'main' }),
        JSON.stringify({ view: 'main', title: '各題的分支', dir: 'LR' }),
        JSON.stringify({ node: 'q', in: 'main', label: s.q.q, shape: 'round' }),
    ];
    s.q.options.forEach((o, j) => {
        const on = answered ? o === s.picked : o.assumed;
        const tags = [o.assumed ? '判官假設' : '', answered && o === s.picked ? '你選的' : ''].filter(Boolean).join('・');
        const to = o.assumed ? 'p' + j : 'b' + j;
        L.push(JSON.stringify(Object.assign({ node: 'o' + j, in: 'main', label: tags ? o.label + '（' + tags + '）' : o.label }, on ? FILL : {})));
        L.push(JSON.stringify(Object.assign({ edge: 'e' + j, in: 'main', from: 'q', to: 'o' + j, arrow: 'end' }, on ? HOT : OFF)));
        L.push(JSON.stringify(Object.assign({ node: to, in: 'main', label: o.assumed ? '照 pick:' : o.branch }, on ? FILL : {})));
        L.push(JSON.stringify(Object.assign({ edge: 'f' + j, in: 'main', from: 'o' + j, to, arrow: 'end' }, on ? HOT : OFF)));
    });
    return L.join('\n');
}

// A board that fails its check or its draw throws; the caller shows a note instead.
async function drawAsk(src) {
    const r = await board.checkBoard(src);
    if (!r.ok) throw new Error(r.problems[0].message);
    return board.renderBoard(src);
}

function badgeOf(states, parsed) {
    const n = states.length;
    if (!parsed) return '<p class="human" data-block="human-badge"><strong>判官要你回答 ' + n + ' 題</strong>先看下面的選擇和優劣；接著會用一次提問把原題問你。</p>';
    const said = states.map((s, i) => (s.off ? '第 ' + (i + 1) + ' 題走了分支：' + esc(s.picked.branch) : s.row && !s.picked ? '第 ' + (i + 1) + ' 題是分支外的回答' : null)).filter(Boolean);
    return '<p class="human done" data-block="human-badge"><strong>判官要你回答 ' + n + ' 題</strong>已回答'
        + (parsed.at ? '（' + esc(parsed.at) + '）' : '') + '。' + (said.length ? said.join('；') + '。' : '各題都照判官假設。') + '</p>';
}

function glanceOf(states, answered) {
    return '<section class="glance" data-block="glance">\n<h2>有哪些選擇</h2>\n'
        + states.map((s, i) => '<div class="gq"><p class="gq-q">' + (i + 1) + '. ' + codeify(s.q.q) + '</p><ul class="gopts">'
            + s.q.options.map((o) => {
                const tags = (o.assumed ? '<span class="tag">判官假設</span>' : '')
                    + (answered && o === s.picked ? '<span class="tag ' + (s.off ? 'off' : 'you') + '">你選的' + (s.off ? '・偏離假設' : '') + '</span>' : '');
                return '<li><span class="name">' + esc(o.label) + tags + '</span><span class="pro"><span class="pc">優</span>' + codeify(o.pro)
                    + '</span><span class="con"><span class="pc">劣</span>' + codeify(o.con) + '</span></li>';
            }).join('') + '</ul></div>').join('\n')
        + '\n</section>';
}

function decisionOf(parsed) {
    return parsed
        ? '<div data-block="ask-decision"><p class="decision"><span class="k">decision:</span>' + esc(parsed.decision || '') + '</p>'
            + '<p class="after">controller 照這一行動手，不再派判官。' + (parsed.at ? '<code>answered: ' + esc(parsed.at) + '</code>' : '') + '</p></div>'
        : '<div data-block="ask-decision"><p class="decision wait"><span class="k">decision:</span>還沒有：等你回答。回答前，判決照判官假設成立。</p></div>';
}

function chartsOf(answered, svgs) {
    return '<section class="charts" data-block="ask-chart">\n<h2>每個選擇會走到哪</h2>\n<p class="note">'
        + (answered ? '實線是你的回答走的路，虛線是沒走的選項。' : '實線是判官假設的路，虛線是你選了別的之後判決會變成的樣子。')
        + '</p>\n' + svgs.map((svg) => '<figure class="board">' + svg + '</figure>').join('\n') + '\n</section>';
}

function detailsOf(states, answered) {
    return '<section class="ask long" data-block="' + (answered ? 'ask-human' : 'ask-human-pending') + '">\n<h2>各題的比較</h2>\n'
        + states.map((s, i) => {
            const st = s.row
                ? '你的回答：' + esc(s.row.answer) + ' · ' + (s.picked ? (s.off ? '偏離假設' : '照 <code>pick:</code>') : '分支外')
                : '判官假設：' + esc(s.assumed ? s.assumed.label : '') + ' · 還沒回答';
            const rows = s.q.options.map((o) => {
                const picked = o === s.picked;
                const tags = (o.assumed ? '<span class="tag">判官假設</span>' : '') + (picked ? '<span class="tag you">你的回答</span>' : '');
                return '<tr' + (picked ? ' class="picked' + (s.off ? ' offrow' : '') + '"' : '') + '><td class="opt" data-label="選項">' + esc(o.label) + tags
                    + '</td><td data-label="判決變成">' + (o.assumed ? '照 <code>pick:</code>' : '→ ' + codeify(o.branch))
                    + '</td><td data-label="優">' + codeify(o.pro) + '</td><td data-label="劣">' + codeify(o.con) + '</td></tr>';
            }).join('');
            return '<details data-block="ask-q' + (i + 1) + '"' + (!s.picked || s.off ? ' open' : '') + '><summary><span class="sq">' + (i + 1) + '. ' + codeify(s.q.q)
                + '</span><span class="st">' + st + '</span></summary>\n<p class="why">無路徑可答：' + codeify(s.q.reason)
                + '</p>\n<table><thead><tr><th>選項</th><th>判決變成</th><th>優</th><th>劣</th></tr></thead><tbody>' + rows + '</tbody></table></details>';
        }).join('\n')
        + '\n</section>';
}

// One page that opens from disk: no script, no link, no remote src. The plain
// summary sits above the record so the first thing read is the pick in words.
async function pageOf(text, opts) {
    const o = opts || {};
    const md = String(text).replace(/\r\n/g, '\n').replace(/^---\n[\s\S]*?\n---\n/, '');
    const sources = [];
    md.replace(/^```chartroom[ \t]*\n([\s\S]*?)\n```[ \t]*$/gm, (all, body) => {
        sources.push(body);
        return all;
    });
    const svgs = await Promise.all(sources.map((s) => board.renderBoard(s).catch(fallback)));
    const title = o.title || (/^# (.+)$/m.exec(md) || [])[1] || 'judgement';
    const plain = plainOf(md);
    const questions = askhuman.parse(md).questions;
    const parsed = askhuman.parseAnswered(md);
    const head = '<!doctype html>\n<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        + '<title>' + esc(title) + '</title><style>\n' + tokens(o.stationCss) + '\n' + CSS + (questions.length ? '\n' + ASK_CSS : '') + '\n</style></head><body>';
    const aside = plain ? '<aside class="plain"><h2>白話</h2>' + mdToHtml(plain) + '</aside>\n' : '';
    const record = mdToHtml(plain ? withoutPlain(md) : md, svgs);
    if (!questions.length) return head + '<main>\n' + aside + record + '\n</main></body></html>\n';

    const states = askOf(questions, parsed);
    const answered = !!parsed;
    const charts = await Promise.all(states.map((s) => drawAsk(chartOf(s, answered)).catch(fallback)));
    return head + '<main>\n'
        + '<input class="vt vt-short" type="radio" name="view" id="view-short" checked>\n'
        + '<input class="vt vt-long" type="radio" name="view" id="view-long">\n'
        + '<div class="top">' + badgeOf(states, parsed) + '<div class="views" data-block="view-toggle"><label class="l-short" for="view-short">簡短</label><label class="l-long" for="view-long">詳細</label></div></div>\n'
        + glanceOf(states, answered) + '\n' + decisionOf(parsed) + '\n' + chartsOf(answered, charts) + '\n' + aside
        + detailsOf(states, answered) + '\n'
        + '<div class="long" data-block="record">\n' + record + '\n</div>\n</main></body></html>\n';
}

module.exports = { PLAIN_MAX, plainOf, wantsHtml, mdToHtml, pageOf };
