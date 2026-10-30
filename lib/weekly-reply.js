'use strict';
// A reply typed into a weekly report the station serves
// (docs/90-agent/plans/2026-10-30-weekly-facets-design.md §3): written back to
// <configDir>/fankeel/weekly/<until>.json and redrawn into that report's
// questions block, for a report and a question id that already exist. The
// archive holds no data.json, so nothing re-renders the page whole: `redraw`
// swaps the one block lib/weekly-render.js questionsSection drew, and every
// other byte of the archived file stays as render wrote it.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const store = require('./weekly-store.js');
const { questionsSection } = require('./weekly-render.js');

const REPLY_MAX = 2000;
const QID = /^[A-Za-z0-9_-]{1,40}$/;
const BLOCK = /<section class="qs" data-block="questions"[\s\S]*?\n<\/section>/;
const REPLY_JS = fs.readFileSync(path.join(__dirname, '..', 'assets', 'weekly', 'reply.js'), 'utf8');
const BASE_CSP = "default-src 'none'; style-src 'unsafe-inline'";

function redraw(html, questions) {
    const s = String(html);
    const m = BLOCK.exec(s);
    if (!m) return null;
    const n = Number((/<span class="sec-n">(\d+)<\/span>/.exec(m[0]) || [])[1]) || 1;
    return s.slice(0, m.index) + questionsSection(questions, n) + s.slice(m.index + m[0].length);
}

function setReply(configDir, until, id, text, now) {
    const none = { code: 404, error: 'no weekly report ends on ' + until };
    if (!store.UNTIL_RE.test(String(until))) return none;
    const json = store.readArchive(configDir, until);
    const file = store.htmlPath(configDir, until);
    if (!json || !file) return none;
    const list = Array.isArray(json.questions) ? json.questions : [];
    const q = QID.test(String(id)) ? list.find((x) => x && x.id === id) : null;
    if (!q) return { code: 404, error: 'no question ' + id + ' in the report ending ' + until };
    const body = String(text == null ? '' : text).replace(/\r\n?/g, '\n').trim();
    if ([...body].length > REPLY_MAX) return { code: 413, error: 'a reply is ' + REPLY_MAX + ' characters at most' };
    if (body) {
        q.reply = body;
        q.repliedAt = new Date(now).toISOString();
    } else {
        delete q.reply;
        delete q.repliedAt;
    }
    const html = redraw(fs.readFileSync(file, 'utf8'), list);
    if (html === null) return { code: 409, error: 'the report ending ' + until + ' has no questions block to redraw' };
    store.save(configDir, until, { json, html });
    return { code: 200, question: q };
}

// The editor, only in the copy the station answers with: the nonce a loopback
// POST needs (a paired phone's cookie stands in for it through the tailnet).
function injectEditor(html, o) {
    const s = String(html);
    const tag = `<div id="wk-reply" hidden data-until="${o.until}" data-nonce="${o.nonce || ''}"></div><script>${REPLY_JS}</script>`;
    const at = s.lastIndexOf('</body>');
    return at < 0 ? s + tag : s.slice(0, at) + tag + s.slice(at);
}

// The station's style-only policy, plus each inline script of this very
// answer by hash, and same-origin requests for the editor's POST.
function cspFor(html) {
    const hashes = [...String(html).matchAll(/<script>([\s\S]*?)<\/script>/g)]
        .map((m) => "'sha256-" + crypto.createHash('sha256').update(m[1], 'utf8').digest('base64') + "'");
    return { 'content-security-policy': hashes.length ? BASE_CSP + '; script-src ' + hashes.join(' ') + "; connect-src 'self'" : BASE_CSP };
}

module.exports = { REPLY_MAX, redraw, setReply, injectEditor, cspFor };
