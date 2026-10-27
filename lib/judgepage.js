'use strict';

// judge-5: what a filed judgement shows the user beyond its path. `plainOf`
// cuts the answer's `## 白話` section — the judge's plain summary
// (agents/fankeel-judge.md) — for `judge.js record` to print; `pageOf` turns a
// judgement file into one self-contained HTML page in the station's look, each
// ```chartroom fence drawn to SVG by lib/board.js. No new dependency.
const board = require('./board.js');
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
    const svgs = await Promise.all(sources.map((s) => board.renderBoard(s).catch((e) => '<pre class="bad">' + esc('這張圖畫不出來：' + (e && e.message)) + '</pre>')));
    const title = o.title || (/^# (.+)$/m.exec(md) || [])[1] || 'judgement';
    const plain = plainOf(md);
    return '<!doctype html>\n<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        + '<title>' + esc(title) + '</title><style>\n' + tokens(o.stationCss) + '\n' + CSS + '\n</style></head><body><main>\n'
        + (plain ? '<aside class="plain"><h2>白話</h2>' + mdToHtml(plain) + '</aside>\n' : '')
        + mdToHtml(md, svgs) + '\n</main></body></html>\n';
}

module.exports = { PLAIN_MAX, plainOf, wantsHtml, mdToHtml, pageOf };
