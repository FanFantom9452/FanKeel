'use strict';
// The station's reply to a weekly report's question
// (docs/90-agent/plans/2026-10-30-weekly-facets-design.md §3): served from
// /station/weekly/<until>.html the questions take a reply, saved by POST into
// <configDir>/fankeel/weekly/<until>.json and redrawn into <until>.html. The
// archived file never carries the editor.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const registry = require('../lib/registry.js');
const ws = require('../lib/weekly-store.js');
const wr = require('../lib/weekly-render.js');
const reply = require('../lib/weekly-reply.js');
const { serve } = require('../scripts/station.js');
const tmp = require('./tmp.js');

const WITH = '2026-01-09';
const WITHOUT = '2026-01-02';
const QS = [
    { id: 'q1', repo: 'Trovara', text: 'Gitea 帳號開好了嗎？' },
    { id: 'q2', repo: 'ils-bench', text: '可以先試跑嗎？', reply: '可以。', repliedAt: '2026-01-10T06:05:00.000Z' },
];
const pageWith = (qs) => '<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"></head><body><main class="page">\n'
    + wr.questionsSection(qs, 6) + '\n\n<footer class="report-foot" data-block="footer">x</footer>\n</main>\n'
    + '<script>\ndocument.documentElement.classList.add(\'js\');\n</script>\n</body></html>';
const plain = '<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"></head><body><h1>工作週報</h1></body></html>';
const archive = (since, until, questions) => Object.assign({ since, until, generated: until, projects: [], counts: { done: 0, ongoing: 0 }, events: [], carry: [], next: [] }, questions ? { questions } : {});

function fixture() {
    const base = tmp('fankeel-weekly-reply-');
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(r1);
    ws.save(cfg, WITH, { json: archive('2026-01-03', WITH, QS), html: pageWith(QS) });
    ws.save(cfg, WITHOUT, { json: archive('2025-12-27', WITHOUT), html: plain });
    return { cfg, r1 };
}
const request = (url, body, headers) => new Promise((resolve, reject) => {
    const req = http.request(url, { method: body === undefined ? 'GET' : 'POST', headers: Object.assign(body === undefined ? {} : { 'content-type': 'application/x-www-form-urlencoded' }, headers) }, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
    });
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
});
async function served(fn) {
    const f = fixture();
    const s = await serve({ configDir: f.cfg, roots: [f.r1], port: 0, idleMs: 60e3, open: false });
    try {
        await fn(s, f);
    } finally {
        s.close();
    }
}
const nonceOf = (t) => /data-nonce="([0-9a-f]{32})"/.exec(t)[1];
const files = (cfg, until) => [fs.readFileSync(path.join(cfg, 'fankeel', 'weekly', until + '.json'), 'utf8'), fs.readFileSync(path.join(cfg, 'fankeel', 'weekly', until + '.html'), 'utf8')];

test('a served report with questions carries the editor and a CSP that lets exactly its own scripts run', () => served(async (s, f) => {
    const res = await request(s.url + 'station/weekly/' + WITH + '.html');
    assert.equal(res.status, 200);
    assert.match(res.text, /<div id="wk-reply" hidden data-until="2026-01-09" data-nonce="[0-9a-f]{32}"><\/div><script>/);
    assert.ok(res.text.indexOf('id="wk-reply"') < res.text.lastIndexOf('</body>'));
    const csp = res.headers['content-security-policy'];
    assert.match(csp, /^default-src 'none'; style-src 'unsafe-inline'; script-src /);
    assert.match(csp, /; connect-src 'self'$/);
    const scripts = [...res.text.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    assert.equal(scripts.length, 2, 'the report\'s own script and the editor');
    for (const body of scripts) assert.ok(csp.includes("'sha256-" + crypto.createHash('sha256').update(body, 'utf8').digest('base64') + "'"));
    assert.doesNotMatch(files(f.cfg, WITH)[1], /wk-reply/, 'the archived file never carries the editor');
}));

test('a report with no questions and no script is served as before: no editor, no script allowed', () => served(async (s) => {
    const res = await request(s.url + 'station/weekly/' + WITHOUT + '.html');
    assert.equal(res.status, 200);
    assert.doesNotMatch(res.text, /wk-reply/);
    assert.equal(res.headers['content-security-policy'], "default-src 'none'; style-src 'unsafe-inline'");
}));

test('POST a reply: the archived JSON and the redrawn HTML both carry it, and the rest of the page is untouched', () => served(async (s, f) => {
    const nonce = nonceOf((await request(s.url + 'station/weekly/' + WITH + '.html')).text);
    const text = '開好了，帳號另外寄。';
    const res = await request(s.url + 'station/weekly/' + WITH + '/reply', new URLSearchParams({ nonce, id: 'q1', reply: text }).toString());
    assert.equal(res.status, 200, res.text);
    const out = JSON.parse(res.text);
    assert.deepEqual([out.ok, out.id], [true, 'q1']);
    assert.match(out.repliedAt, /^\d{4}-\d{2}-\d{2}T/);
    const json = ws.readArchive(f.cfg, WITH);
    assert.deepEqual(json.questions[0], { id: 'q1', repo: 'Trovara', text: 'Gitea 帳號開好了嗎？', reply: text, repliedAt: out.repliedAt });
    assert.deepEqual(json.questions[1], QS[1]);
    const html = files(f.cfg, WITH)[1];
    assert.equal(html, pageWith(json.questions), 'only the questions block moved, its number kept');
    assert.ok(html.includes('<p class="ans">' + text + '</p>'));
    assert.doesNotMatch(html, /尚未回覆/);
    assert.ok((await request(s.url + 'station/weekly/' + WITH + '.html')).text.includes('<p class="ans">' + text + '</p>'), 'the next visit shows it');
}));

test('refused, nothing written: a wrong nonce, an unknown report or question, a report with no questions, a reply too long, a foreign Host', () => served(async (s, f) => {
    const nonce = nonceOf((await request(s.url + 'station/weekly/' + WITH + '.html')).text);
    const before = [files(f.cfg, WITH), files(f.cfg, WITHOUT)];
    const post = (until, o, headers) => request(s.url + 'station/weekly/' + until + '/reply', new URLSearchParams(Object.assign({ nonce, id: 'q1', reply: 'x' }, o)).toString(), headers);
    assert.equal((await post(WITH, { nonce: 'wrong' })).status, 403);
    assert.equal((await post('2026-01-05', {})).status, 404);
    assert.equal((await post(WITH, { id: 'q9' })).status, 404);
    assert.equal((await post(WITH, { id: '../q1' })).status, 404);
    assert.equal((await post(WITHOUT, {})).status, 404, 'an archive from before questions has none to answer');
    assert.equal((await post(WITH, { reply: '字'.repeat(reply.REPLY_MAX + 1) })).status, 413);
    assert.equal((await post(WITH, {}, { host: 'evil.example' })).status, 421);
    assert.deepEqual([files(f.cfg, WITH), files(f.cfg, WITHOUT)], before);
}));

test('setReply with an empty reply clears it; redraw is null on a page with no questions block', () => {
    const f = fixture();
    const out = reply.setReply(f.cfg, WITH, 'q2', '  ', Date.now());
    assert.equal(out.code, 200);
    assert.deepEqual(ws.readArchive(f.cfg, WITH).questions[1], { id: 'q2', repo: 'ils-bench', text: '可以先試跑嗎？' });
    assert.ok(files(f.cfg, WITH)[1].includes('<div class="q" role="listitem" data-q="q2">'));
    assert.equal(reply.redraw(plain, QS), null);
    assert.equal(reply.REPLY_MAX, 2000);
});
