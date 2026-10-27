'use strict';
// lib/weekly-collect.js: everything one weekly report is written from
// (docs/90-agent/plans/2026-10-27-weekly-skill-design.md, 收).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const wc = require('../lib/weekly-collect.js');
const store = require('../lib/weekly-store.js');
const { makeRepo, lines } = require('./weekly-fixture.js');
const tmp = require('./tmp.js');

const DEC = [
    '# 2025-12',
    '',
    '## 2025-12-20 太早的一則',
    '',
    '- 要求：不在區間',
    '',
    '<a id="r-2025-12-30-abcdef01"></a>',
    '',
    '## 2025-12-30 TODO 全表盤點',
    '',
    '- 要求：盤點第一次',
    '- 做了什麼：',
    '  - 清掉三條',
    '  - 改了兩條日期',
    '- 為什麼這樣做：每週固定',
    '- 花費：$3.20，20 分鐘',
    '- 還剩什麼：一條',
    '',
].join('\n');
const JAN = [
    '# 2026-01',
    '',
    '## 2026-01-02 TODO 全表盤點',
    '',
    '- 要求：盤點第二次',
    '- 還剩什麼：沒有',
    '',
    '## 2026-01-02 查詢頁上線',
    '',
    '- 要求：做查詢頁',
    '',
    '## 2026-01-05 太晚的一則',
    '',
    '- 要求：不在區間',
].join('\n');

function alpha(root) {
    return makeRepo(path.join(root, 'alpha'), [
        { date: '2025-12-30', subj: 'feat: 盤點', files: { 'src/a/x.js': lines(3), 'src/b/y.js': lines(1), 'docs/90-agent/records/2025-12.md': DEC } },
        { date: '2026-01-02', subj: 'feat: 查詢頁', files: { 'src/b/y.js': lines(4), 'docs/90-agent/records/2026-01.md': JAN } },
    ]);
}
function beta(root) {
    return makeRepo(path.join(root, 'beta'), [
        { date: '2025-12-31', subj: 'feat(api): search', files: { 'api/v1/a.js': lines(2), 'api/v2/b.js': lines(1) } },
        { date: '2026-01-01', subj: 'feat(api): paging', files: { 'api/v1/a.js': lines(6) } },
        { date: '2026-01-02', subj: 'fix(ui): colour', files: { 'ui/c.css': lines(1) } },
    ]);
}
const session = (dir, name, o) => {
    fs.mkdirSync(path.join(dir, '.fankeel', 'sessions'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.fankeel', 'sessions', name + '.json'), JSON.stringify(o));
};

test('defaultRange: the day after the last report, else the last Friday before today', () => {
    assert.equal(wc.addDays('2025-12-31', 1), '2026-01-01');
    assert.equal(wc.addDays('2026-03-01', -1), '2026-02-28');
    assert.deepEqual(wc.defaultRange('2026-10-27', null), { since: '2026-10-23', until: '2026-10-27' });
    assert.deepEqual(wc.defaultRange('2026-10-23', null), { since: '2026-10-16', until: '2026-10-23' });
    assert.deepEqual(wc.defaultRange('2026-10-27', '2026-10-20'), { since: '2026-10-21', until: '2026-10-27' });
    assert.deepEqual(wc.defaultRange('2026-10-27', '2026-10-27'), { since: '2026-10-23', until: '2026-10-27' });
});

test('readRecords reads every month the range touches, keeps the five fields and drops the spend', () => {
    const recs = wc.readRecords(alpha(tmp('fankeel-weekly-col-')), '2025-12-30', '2026-01-02');
    assert.deepEqual(recs.map((r) => r.date + ' ' + r.title), ['2025-12-30 TODO 全表盤點', '2026-01-02 TODO 全表盤點', '2026-01-02 查詢頁上線']);
    assert.equal(recs[0].fields['做了什麼'], '清掉三條\n改了兩條日期');
    assert.equal(recs[0].fields['為什麼這樣做'], '每週固定');
    assert.equal(Object.prototype.hasOwnProperty.call(recs[0].fields, '花費'), false);
    assert.deepEqual(recs.map((r) => r.session), ['abcdef01', null, null], 'the anchor above the heading names the session');
    assert.deepEqual(wc.readRecords(tmp('fankeel-weekly-col-none-'), '2025-12-30', '2026-01-02'), []);
});

test('mergeSame folds records with one title into one, with every date and a count', () => {
    const merged = wc.mergeSame(wc.readRecords(alpha(tmp('fankeel-weekly-col-')), '2025-12-30', '2026-01-02'));
    assert.deepEqual(merged.map((m) => [m.title, m.count, m.dates]), [['TODO 全表盤點', 2, ['2025-12-30', '2026-01-02']], ['查詢頁上線', 1, ['2026-01-02']]]);
    assert.equal(merged[0].fields['要求'], '盤點第二次', 'the latest record\'s fields win');
    assert.deepEqual(merged[0].from, [{ date: '2025-12-30', session: 'abcdef01' }, { date: '2026-01-02', session: null }]);
});

test('readSessions keeps what was updated in range, is not at land and has not ended', () => {
    const dir = alpha(tmp('fankeel-weekly-col-'));
    session(dir, 'a', { task: '做匯出', stage: 'build', updated: '2026-01-01T10:00:00.000Z', claims: ['src/b/y.js', { path: 'src/a/x.js' }] });
    session(dir, 'b', { task: '收尾', stage: 'land', updated: '2026-01-01T10:00:00.000Z', claims: [] });
    session(dir, 'c', { task: '停了', stage: 'build', updated: '2026-01-01T10:00:00.000Z', ended: { at: 'x' } });
    session(dir, 'd', { task: '太早', stage: 'build', updated: '2025-12-01T10:00:00.000Z' });
    fs.writeFileSync(path.join(dir, '.fankeel', 'sessions', 'e.json'), '{broken');
    assert.deepEqual(wc.readSessions(dir, '2025-12-30', '2026-01-02'), [{ task: '做匯出', stage: 'build', updated: '2026-01-01T10:00:00.000Z', claims: ['src/b/y.js', 'src/a/x.js'] }]);
});

test('a done record takes its modules from its own session\'s claims, at any stage, not from the day\'s commits', () => {
    const FEB = [
        '# 2026-02',
        '',
        '<a id="r-2026-02-03-aaaaaaaa"></a>',
        '',
        '## 2026-02-03 做匯出',
        '',
        '- 要求：匯出',
        '',
        '<a id="r-2026-02-03-bbbbbbbb"></a>',
        '',
        '## 2026-02-03 修顏色',
        '',
        '- 要求：顏色',
        '',
    ].join('\n');
    const dir = makeRepo(path.join(tmp('fankeel-weekly-col-'), 'gamma'), [
        { date: '2026-02-03', subj: 'feat: 兩件', files: { 'src/a/x.js': lines(2), 'src/b/y.js': lines(2), 'docs/90-agent/records/2026-02.md': FEB } },
    ]);
    session(dir, 'aaaaaaaa-1111-2222-3333-444444444444', { task: '做匯出', stage: 'land', updated: '2026-02-03T10:00:00.000Z', claims: ['src/a/x.js'] });
    session(dir, 'bbbbbbbb-1111-2222-3333-444444444444', { task: '修顏色', stage: 'land', updated: '2026-02-03T11:00:00.000Z', ended: { at: 'x' }, claims: [{ path: 'src/b/y.js' }] });
    const [r] = wc.collect({ repos: [dir], since: '2026-02-03', until: '2026-02-03' }).repos;
    assert.deepEqual(r.records.map((x) => [x.title, x.modules]), [['做匯出', ['n-src-a']], ['修顏色', ['n-src-b']]]);
    assert.deepEqual(r.sessions, [], 'landed and ended sessions are records, not work under way');
    assert.deepEqual(wc.sessionClaims(dir)('aaaaaaaa'), ['src/a/x.js']);
    assert.equal(wc.sessionClaims(dir)('cccccccc'), null);
});

test('collect: records for a repo that has them, scope groups for one that has only git, the previous report', () => {
    const root = tmp('fankeel-weekly-col-');
    const a = alpha(root);
    const b = beta(root);
    session(a, 'a', { task: '做匯出', stage: 'build', updated: '2026-01-01T10:00:00.000Z', claims: ['src/b/y.js'] });
    const cfg = tmp('fankeel-weekly-col-cfg-');
    store.save(cfg, '2025-12-29', { json: { since: '2025-12-23', until: '2025-12-29', next: [{ repo: 'beta', text: '做搜尋' }] }, html: '<p></p>' });
    const data = wc.collect({ repos: [a, b], since: '2025-12-30', until: '2026-01-02', configDir: cfg });
    assert.deepEqual(data.days, ['2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02']);
    assert.deepEqual(data.previous, { since: '2025-12-23', until: '2025-12-29', next: [{ repo: 'beta', text: '做搜尋' }] });
    const [ra, rb] = data.repos;
    assert.equal(ra.name, 'alpha');
    assert.equal(ra.path, a.replace(/\\/g, '/'));
    assert.deepEqual(ra.records.map((r) => r.title), ['TODO 全表盤點', '查詢頁上線']);
    assert.deepEqual(ra.records[1].modules, ['n-docs', 'n-src-b'], 'no session file: every file that day\'s commits touched, the records file too');
    assert.deepEqual(ra.scopes, []);
    assert.deepEqual(ra.sessions[0].modules, ['n-src-b']);
    assert.deepEqual(rb.records, []);
    assert.deepEqual(rb.scopes.map((s) => [s.scope, s.commits.length, s.modules]), [['api', 2, ['n-api-v1', 'n-api-v2']], ['ui', 1, ['n-ui']]]);
    assert.deepEqual(rb.daily, { '2025-12-30': 0, '2025-12-31': 1, '2026-01-01': 1, '2026-01-02': 1 });
    assert.equal(rb.commits, 3);
    assert.equal(rb.modules.A, 8, '2 + 1 + 4 + 1 code lines');
    assert.match(rb.board, /^\{"chartroom":1/);
    assert.equal(wc.collect({ repos: [b], since: '2025-12-29', until: '2026-01-02', configDir: cfg }).previous, null, 'a report ending inside the range is not the previous one');
});
