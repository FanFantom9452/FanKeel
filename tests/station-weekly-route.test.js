'use strict';
// serve's weekly routes (docs/90-agent/plans/2026-10-27-weekly-skill-design.md,
// 監控站整合): GET /station/weekly lists the archive under
// <configDir>/fankeel/weekly/, newest end date first; GET
// /station/weekly/<until>.html answers one archived report with the
// weekly-nav bar injected at the top of <body>. The file on disk never
// carries the bar, so the copy that is mailed has no link into the station.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const registry = require('../lib/registry.js');
const ws = require('../lib/weekly-store.js');
const { serve } = require('../scripts/station.js');
const tmp = require('./tmp.js');

const RANGES = [['2025-12-20', '2025-12-26'], ['2025-12-27', '2026-01-02'], ['2026-01-03', '2026-01-09']];
const page = (until) => '<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><style>body{margin:0}</style></head>'
    + '<body class="wk-report"><h1>工作週報 ' + until + '</h1></body></html>';

function fixture(empty) {
    const base = tmp('fankeel-weekly-route-');
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(r1);
    if (!empty) {
        for (const [since, until] of RANGES) {
            ws.save(cfg, until, {
                json: { since, until, generated: until + 'T18:00:00.000Z', projects: ['fankeel'], counts: { done: 2, ongoing: 1 }, events: [], carry: [], next: [] },
                html: page(until),
            });
        }
    }
    return { cfg, r1 };
}
const get = (url) => new Promise((resolve, reject) => {
    http.get(url, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
    }).on('error', reject);
});
async function served(fn, empty) {
    const f = fixture(empty);
    const s = await serve({ configDir: f.cfg, roots: [f.r1], port: 0, idleMs: 60e3, open: false });
    try {
        await fn(s, f);
    } finally {
        s.close();
    }
}
// The injected bar, cut out of a served page: from its `<nav` to its `</nav>`.
const navOf = (t) => {
    const at = t.indexOf('data-block="weekly-nav"');
    return at < 0 ? '' : t.slice(t.lastIndexOf('<nav', at), t.indexOf('</nav>', at) + 6);
};
const hrefs = (html) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);

test('the list route answers the archive, newest end date first', () => served(async (s, f) => {
    const res = await get(s.url + 'station/weekly');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /application\/json/);
    assert.equal(res.headers['cache-control'], 'no-store');
    const body = JSON.parse(res.text);
    assert.deepEqual(body.reports.map((r) => r.until), ['2026-01-09', '2026-01-02', '2025-12-26']);
    assert.deepEqual(body.reports, JSON.parse(JSON.stringify(ws.list(f.cfg))));
}));

test('with nothing archived the list is empty, not an error', () => served(async (s) => {
    const res = await get(s.url + 'station/weekly');
    assert.equal(res.status, 200);
    assert.deepEqual(JSON.parse(res.text), { reports: [] });
}, true));

test('a report is served with weekly-nav at the top of its body: back to the list, and both neighbours', () => served(async (s, f) => {
    const res = await get(s.url + 'station/weekly/2026-01-02.html');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /text\/html/);
    assert.match(res.headers['content-security-policy'], /default-src 'none'/);
    const t = res.text;
    assert.ok(t.indexOf('<body class="wk-report">') < t.indexOf('data-block="weekly-nav"'));
    assert.ok(t.indexOf('data-block="weekly-nav"') < t.indexOf('<h1>工作週報 2026-01-02</h1>'));
    const nav = navOf(t);
    assert.ok(nav.includes('回週報列表'));
    assert.deepEqual(hrefs(nav), ['/#/weekly', '/station/weekly/2025-12-26.html', '/station/weekly/2026-01-09.html']);
    // The archived file is untouched: the bar exists only in the answer.
    const disk = fs.readFileSync(ws.htmlPath(f.cfg, '2026-01-02'), 'utf8');
    assert.equal(disk, page('2026-01-02'));
    assert.doesNotMatch(disk, /weekly-nav/);
}));

test('the newest report has no next link and the oldest no previous one', () => served(async (s) => {
    const newest = navOf((await get(s.url + 'station/weekly/2026-01-09.html')).text);
    assert.deepEqual(hrefs(newest), ['/#/weekly', '/station/weekly/2026-01-02.html']);
    assert.ok(newest.includes('下一份'), 'the missing neighbour is still named, as a disabled span');
    const oldest = navOf((await get(s.url + 'station/weekly/2025-12-26.html')).text);
    assert.deepEqual(hrefs(oldest), ['/#/weekly', '/station/weekly/2026-01-02.html']);
    assert.ok(oldest.includes('上一份'));
}));

test('an end date with no report, or a name that is not a date, is a 404', () => served(async (s) => {
    for (const p of ['station/weekly/2026-01-05.html', 'station/weekly/latest.html', 'station/weekly/..%2F..%2Froots.json', 'station/weekly/2026-1-2.html']) {
        assert.equal((await get(s.url + p)).status, 404, p);
    }
}));
