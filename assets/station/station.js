'use strict';

// The station page, rendered in the browser from `window.STATION`. Loaded by
// `station.html` after `station-data.js`, so the model is already there.
//
// Everything above the `module.exports` guard is a pure function and is unit
// tested; everything below it touches the document and is checked against the
// served page instead. The split is not a preference — this repository carries
// no dependencies, so there is no DOM in `node --test` to render into.

(function (w, doc) {
    // The reader's theme goes on <html> before anything is drawn, so a page
    // set to 深色 does not flash light first. No attribute is 跟隨系統: the
    // stylesheet's media query decides. localStorage can throw (file://,
    // private mode) or be missing (node), and then there is no preference.
    function stored(k) { try { return w.localStorage.getItem(k); } catch (e) { return null; } }
    function store(k, v) { try { if (v === null) w.localStorage.removeItem(k); else w.localStorage.setItem(k, v); } catch (e) { /* not kept */ } }
    function themeSet(t) {
        if (!doc || !doc.documentElement) return;
        if (t === 'light' || t === 'dark') doc.documentElement.setAttribute('data-theme', t);
        else doc.documentElement.removeAttribute('data-theme');
    }
    themeSet(stored('station.theme'));
    var S = w.STATION || { sessions: [], projects: [] };
    // The language the page draws in (assets/station/i18n.js). `loc(key, zh,
    // vars)` is every string's one door: the Chinese is written at the call,
    // and English replaces it only when i18n.js is loaded and set to English.
    // Without i18n.js — node's tests, an old copy — the page is Chinese.
    var I18N = w.FK_I18N || null;
    function fillVars(s, vars) {
        if (!vars) return s;
        return String(s).replace(/\{(\w+)\}/g, function (m, k) { return Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m; });
    }
    function loc(key, zh, vars) { return I18N ? I18N.t(key, zh, vars) : fillVars(zh, vars); }
    var ROUTE = ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'];
    var STAGE_C = {
        survey: '#94a3b8', design: '#8b5cf6', plan: '#f472b6', build: '#4c3fd7',
        verify: '#14b8a6', audit: '#3b82f6', land: '#64748b',
    };

    function tokens(n) {
        if (n === null || n === undefined) return '—';
        if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M';
        if (n >= 1e3) return Math.round(n / 1e3) + 'k';
        return String(n);
    }
    function mins(ms) {
        if (ms === null || ms === undefined || !isFinite(ms)) return '—';
        var m = Math.round(ms / 60000);
        if (m < 60) return m + 'm';
        var h = Math.floor(m / 60);
        if (h < 24) return h + 'h' + (m % 60 ? (m % 60) + 'm' : '');
        return Math.floor(h / 24) + 'd' + (h % 24 ? (h % 24) + 'h' : '');
    }
    function hours(ms) { return (ms / 3.6e6).toFixed(ms >= 3.6e7 ? 0 : 1) + 'h'; }
    function quotaWeek() {
        var P = S.profiles || {}, ps = P.projects || {}, ks = Object.keys(ps);
        for (var i = 0; i < ks.length; i++) {
            var e = ps[ks[i]] || {}, v = e.values && e.values['quota.week'];
            if (e.sources && e.sources['quota.week'] === 'project' && typeof v === 'number' && v > 0) return v;
        }
        var m = P.machine && P.machine.values;
        return m && m['quota.week'];
    }
    // The share of the weekly quota, as '(N%)', or '' when no quota is set.
    function quotaPct(n) {
        var q = quotaWeek();
        if (!n || typeof q !== 'number' || !(q > 0)) return '';
        var p = n / q * 100;
        return '(' + (p >= 10 ? Math.round(p) : +p.toFixed(2)) + '%)';
    }
    // `plain` drops the share: axis ticks, per-bar labels and text drawn inside
    // a fixed-width box have no room for it.
    function usd(n, plain) {
        if (!n) return '—';
        var s = '$' + (n >= 100 ? n.toFixed(0) : n.toFixed(2));
        var q = plain ? '' : quotaPct(n);
        return q ? s + ' ' + q : s;
    }
    function ago(ms) {
        if (!ms) return '—';
        var d = Date.now() - ms;
        if (d < 60000) return 'just now';
        if (d < 3.6e6) return Math.round(d / 6e4) + 'm ago';
        if (d < 8.64e7) return Math.round(d / 3.6e6) + 'h ago';
        return Math.round(d / 8.64e7) + 'd ago';
    }
    function day(iso) { return typeof iso === 'string' ? iso.slice(0, 10) : '—'; }
    function stamp(ms) {
        return isFinite(ms) ? new Date(ms).toISOString().replace('T', ' ').slice(0, 16) : '—';
    }
    function esc(s) {
        return String(s === null || s === undefined ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function cost(s) { return (s.usd || 0) + (s.agentUsd || 0); }

    // `unknown` is `serialize()`'s way of saying liveness could not be
    // measured for this session — `data.active === true` but the config
    // directory it would have to read to confirm was unreadable, so `live` is
    // what it defaulted to rather than what was confirmed. The question mark
    // and the title are the only place that distinction reaches a reader:
    // `skills/fankeel/SKILL.md` tells every session to trust this page about
    // liveness, so a state that cannot be measured must not read as certain.
    function statePill(s) {
        return '<span class="pill ' + s.state + '"'
            + (s.unknown ? ' title="' + loc('fmt.unknownLiveness', '這個 session 的 config directory 讀不到，活著與否無法確認') + '"' : '') + '><i class="dot ' + s.state
            + (s.state === 'live' ? ' pulse' : '') + '"></i>' + s.state
            + (s.unknown ? '?' : '') + '</span>';
    }

    // The shortest tail of a root's segments that no other root shares. Moved
    // here from `lib/station.js`'s `navLabels` when the nav became a facet: the
    // rule is the same and `depth[i] < segs[i].length` still bounds it. Two
    // roots that split into the same segments — `/a/b` against `\a\b`, or
    // against `/a/b/` — are the only pair that reaches that bound still
    // colliding, and they share a label. TODO.md files that case. A nested
    // root is not it: it separates once the longer one grows past the shorter
    // one's own length.
    function labels(roots) {
        // Two roots are the same registry when, after dropping a trailing
        // separator and folding case, their strings are equal — that is
        // Windows, where `F:\a` and `f:\a\` are one directory. Fold before
        // the tails are computed, so the pair collapses to one group and one
        // card rather than reaching the shortest-unique-tail loop as if they
        // were two registries that happen to share a label. A nested root —
        // `F:\a` against `F:\a\b` — keeps a different key and stays two.
        function key(r) { return String(r).replace(/[\\/]+$/, '').toLowerCase(); }
        var uniq = [];
        var seen = {};
        roots.forEach(function (r) {
            var k = key(r);
            if (!seen[k]) { seen[k] = true; uniq.push(r); }
        });
        var segs = uniq.map(function (r) {
            return String(r).split(/[\\/]+/).filter(Boolean);
        });
        var depth = uniq.map(function () { return 1; });
        var at = function (i) { return segs[i].slice(-depth[i]).join('/'); };
        for (var guard = 0; guard < 50; guard++) {
            var ls = uniq.map(function (_, i) { return at(i); });
            var counts = {};
            ls.forEach(function (l) { counts[l] = (counts[l] || 0) + 1; });
            var grew = false;
            ls.forEach(function (l, i) {
                if (counts[l] > 1 && depth[i] < segs[i].length) { depth[i] += 1; grew = true; }
            });
            if (!grew) break;
        }
        var out = {};
        uniq.forEach(function (r, i) { out[r] = at(i); });
        return out;
    }

    // Two windows of very different completeness sit beside each other here:
    // this repository's usage records begin on 2026-09-04 and its burn records
    // on 08-28, so a previous window holding nothing would otherwise print
    // +13000%. An empty comparison says it is empty. A ratio moves in
    // percentage points, and a rise in waiting is the bad direction.
    function delta(cur, prev, unit) {
        if (unit === 'pt') {
            var pp = (cur - prev) * 100;
            if (!prev && !cur) return '<span class="delta flat">' + loc('fmt.noCompare', '無可比') + '</span>';
            var c2 = Math.abs(pp) < 0.5 ? 'flat' : pp > 0 ? 'dn' : 'up';
            return '<span class="delta ' + c2 + '">' + (pp > 0 ? '+' : '') + pp.toFixed(1)
                + ' pt ' + (c2 === 'up' ? '↘' : c2 === 'dn' ? '↗' : '') + '</span>';
        }
        if (!prev) return '<span class="delta flat">' + loc('fmt.noPriorData', '前期無資料') + '</span>';
        var d = (cur - prev) / prev * 100;
        var cls = Math.abs(d) < 0.5 ? 'flat' : d > 0 ? 'up' : 'dn';
        var n = Math.abs(d) >= 100 ? Math.round(d) : Number(d.toFixed(1));
        return '<span class="delta ' + cls + '">' + (d > 0 ? '+' : '') + n + '% '
            + (cls === 'up' ? '↗' : cls === 'dn' ? '↘' : '') + '</span>';
    }

    // One predicate for every view. A facet and the search box are AND-ed, so
    // the KPI cards, the charts and the table all narrow together — which is
    // the thing the old page could not do, because its rows were markup by the
    // time they reached the browser.
    function match(s, f) {
        if (f.state && s.state !== f.state) return false;
        if (f.project && s.root !== f.project) return false;
        if (f.stage && s.stage !== f.stage) return false;
        if (f.q) {
            // The model is in here because it was a filter term on the old page
            // and dropping it would be a silent loss: nothing tells a reader
            // that `opus` stopped matching.
            // Guarded, every one of them: an absent `model` joined raw puts the
            // string `undefined` in the haystack, and a search for it matches
            // every session that has no model.
            var t = [s.task, s.project, s.id, s.label, s.model || '', s.state,
                (s.claims || []).join(' '), (s.notes || []).join(' '), s.next || '']
                .join(' ').toLowerCase();
            if (t.indexOf(f.q.toLowerCase()) === -1) return false;
        }
        return true;
    }

    // ---- the three levels: shared -----------------------------------------
    // A module moved out of this file (station-52): on the page it is the
    // window global its <script> set; under `require` (node's tests) it is
    // the file beside this one.
    function mod(name, file) {
        if (w[name]) return w[name];
        if (typeof require === 'function') return require('./' + file);
        throw new Error('station: ' + file + ' is not loaded');
    }
    // 2026-09-14. Every figure on the home, project and session pages is summed
    // from a session's `days` (dollars, tokens) and `spans` (milliseconds), split
    // by the local day each request happened on — never from the registry's
    // `usd`, which SessionEnd writes once and which is filed under the start day.
    var TABS = ['timeline', 'cost', 'dispatch', 'events', 'talk', 'plan', 'gate'];
    var MODEL_KEYS = ['fable', 'opus', 'sonnet', 'haiku', 'other'];
    var TOKEN_KEYS = ['input', 'output', 'cacheRead', 'cacheWrite5m', 'cacheWrite1h'];
    // `kind` splits a day's cost or tokens by where they went: the five token
    // kinds, the two cache-write rates kept apart, because they are two
    // caches — 1h is what the main session writes each turn, 5m what each
    // agent writes from its first turn on (station-30). The cost tab's
    // `costHtml`, the kind split on 花費 and the 7-day card share this order.
    var KIND_KEYS = ['input', 'output', 'cacheRead', 'cacheWrite1h', 'cacheWrite5m'];
    var KIND_LABEL = { input: 'input', output: 'output', cacheRead: 'cache read',
        cacheWrite1h: loc('shared.kindCw1h', 'cache write 1h · 主對話'), cacheWrite5m: loc('shared.kindCw5m', 'cache write 5m · agent') };
    var KIND_COLOR = { input: '--t-in', output: '--t-out', cacheRead: '--t-cr', cacheWrite1h: '--t-cw1h', cacheWrite5m: '--t-cw' };
    var WHO_LABEL = { main: loc('shared.main', '主 session'), agent: loc('shared.agent', '背景 agent'), workflow: 'workflow' };
    var DIM_LABEL = { model: loc('shared.byModel', '依 model'), project: loc('shared.byProject', '依專案'), stage: loc('shared.byStage', '依 stage'),
        who: loc('shared.mainVsAgent', '主 session 對 agent'), version: loc('shared.byVersion', '依版本'), kind: loc('shared.byKind', '依成分'),
        type: loc('shared.byAgentType', '依 agent 類型') };
    // An agent type is on a `days` row (lib/detail.js stamps it); a span
    // records only stage and who, so 時間 has none to split by.
    var NO_TIME_TYPE = loc('shared.noTimeByType', '時間沒有 agent 類型可分：spans 只記 stage 與誰在跑');
    // Dollars to the cent, whatever the size: a break's cost and the range
    // report's tables are compared against figures printed that way.
    function usd2(n) { return '$' + (n || 0).toFixed(2); }
    // What the page's own modules (assets/station/spend-*.js) draw with. They
    // load before this file and read `w.FK_KIT` only when they draw, so a
    // helper is written once, here.
    w.FK_KIT = { esc: esc, tokens: tokens, usd2: usd2, comma: comma, delta: delta, roHtml: roHtml, segHtml: segHtml,
        sessionHash: sessionHash, localDay: localDay, lastDays: lastDays, fillVars: fillVars,
        KIND_KEYS: KIND_KEYS, KIND_LABEL: KIND_LABEL, KIND_COLOR: KIND_COLOR };
    var METRIC_LABEL = { usd: loc('shared.cost', '花費'), tokens: 'token', time: loc('shared.time', '時間') };
    // ---- the shared formatters — assets/station/fmt.js (FK_FMT) ------------
    var PAGES = ['live', 'sessions', 'projects', 'docs', 'weekly', 'settings', 'tour'];
    var FMT_;
    function FMT() {
        return FMT_ || (FMT_ = mod('FK_FMT', 'fmt.js').make({
            w: w, loc: loc, tokens: tokens, hours: hours, usd: usd, estMark: estMark, labels: labels,
            ROUTE: ROUTE, TABS: TABS, PAGES: PAGES, MODEL_KEYS: MODEL_KEYS, TOKEN_KEYS: TOKEN_KEYS,
            KIND_KEYS: KIND_KEYS, KIND_LABEL: KIND_LABEL, KIND_COLOR: KIND_COLOR, WHO_LABEL: WHO_LABEL,
            S: function () { return S; }
        }));
    }
    function localDay() { return FMT().localDay.apply(null, arguments); }
    function lastDays() { return FMT().lastDays.apply(null, arguments); }
    function parseHash() { return FMT().parseHash.apply(null, arguments); }
    function projectHash() { return FMT().projectHash.apply(null, arguments); }
    function knownPkey() { return FMT().knownPkey.apply(null, arguments); }
    function sessionHash() { return FMT().sessionHash.apply(null, arguments); }
    function family() { return FMT().family.apply(null, arguments); }
    function modelKey() { return FMT().modelKey.apply(null, arguments); }
    function modelLabel() { return FMT().modelLabel.apply(null, arguments); }
    function tokenSum() { return FMT().tokenSum.apply(null, arguments); }
    function dimKey() { return FMT().dimKey.apply(null, arguments); }
    function orderKeys() { return FMT().orderKeys.apply(null, arguments); }
    function colorOf() { return FMT().colorOf.apply(null, arguments); }
    function keyLabel() { return FMT().keyLabel.apply(null, arguments); }
    function keyHint() { return FMT().keyHint.apply(null, arguments); }
    function projectNames() { return FMT().projectNames.apply(null, arguments); }
    function niceTop() { return FMT().niceTop.apply(null, arguments); }
    function partEst() { return FMT().partEst.apply(null, arguments); }
    function metricText() { return FMT().metricText.apply(null, arguments); }
    function sessionTotals() { return FMT().sessionTotals.apply(null, arguments); }
    function windowTotals() { return FMT().windowTotals.apply(null, arguments); }
    // ---- the 30-day chart and the old project page helpers — assets/station/chart.js (FK_CHART) --
    var CHART_;
    function CHART() {
        return CHART_ || (CHART_ = mod('FK_CHART', 'chart.js').make({
            loc: loc, esc: esc, tokens: tokens, usd: usd, hours: hours, estMark: estMark, delta: delta,
            quotaDay: quotaDay, icon: icon, ago: ago, stamp: stamp, mins: mins, statePill: statePill,
            keelStage: keelStage, keelProgress: keelProgress, localDay: localDay, dimKey: dimKey,
            tokenSum: tokenSum, orderKeys: orderKeys, niceTop: niceTop, metricText: metricText,
            colorOf: colorOf, keyLabel: keyLabel, keyHint: keyHint, partEst: partEst,
            projectHash: projectHash, sessionHash: sessionHash, sessionTotals: sessionTotals, windowTotals: windowTotals,
            METRIC_LABEL: METRIC_LABEL, DIM_LABEL: DIM_LABEL, NO_TIME_TYPE: NO_TIME_TYPE,
            KIND_KEYS: KIND_KEYS, MODEL_KEYS: MODEL_KEYS, S: function () { return S; }
        }));
    }
    function dayBars() { return CHART().dayBars.apply(null, arguments); }
    function kpiHtml() { return CHART().kpiHtml.apply(null, arguments); }
    function roHtml() { return CHART().roHtml.apply(null, arguments); }
    function segHtml() { return CHART().segHtml.apply(null, arguments); }
    function histSvg() { return CHART().histSvg.apply(null, arguments); }
    function visibleBars() { return CHART().visibleBars.apply(null, arguments); }
    function legendHtml() { return CHART().legendHtml.apply(null, arguments); }
    function filterHtml() { return CHART().filterHtml.apply(null, arguments); }
    function segTip() { return CHART().segTip.apply(null, arguments); }
    function legendRest() { return CHART().legendRest.apply(null, arguments); }
    function tourPage() { return CHART().tourPage.apply(null, arguments); }
    function projectRows() { return CHART().projectRows.apply(null, arguments); }
    function shortLabel() { return CHART().shortLabel.apply(null, arguments); }
    function stageNow() { return CHART().stageNow.apply(null, arguments); }
    function runningTag() { return CHART().runningTag.apply(null, arguments); }

    // ---- the session page — assets/station/session-body.js (FK_SBODY) -------
    var SBODY_;
    function SBODY() {
        return SBODY_ || (SBODY_ = mod('FK_SBODY', 'session-body.js').make({
            w: w, loc: loc, esc: esc, tokens: tokens, cents: cents, family: family, niceTop: niceTop, niceStep: niceStep,
            downsample: downsample, mins: mins, hours: hours, usd: usd, estMark: estMark, stamp: stamp, comma: comma,
            colorOf: colorOf, icon: icon, sessionHash: sessionHash, sessionTotals: sessionTotals, roHtml: roHtml,
            quotaPct: quotaPct, agentCounts: agentCounts, agentState: agentState, gateAt: gateAt, clockSec: clockSec,
            agoText: agoText, tk: tk, ROUTE: ROUTE, KIND_KEYS: KIND_KEYS, KIND_COLOR: KIND_COLOR, KIND_LABEL: KIND_LABEL,
            S: function () { return S; }
        }));
    }
    function clock() { return SBODY().clock.apply(null, arguments); }
    function timelineModel() { return SBODY().timelineModel.apply(null, arguments); }
    function timelineSvg() { return SBODY().timelineSvg.apply(null, arguments); }
    function costModel() { return SBODY().costModel.apply(null, arguments); }
    function sumLoops() { return SBODY().sumLoops.apply(null, arguments); }
    function stageShare() { return SBODY().stageShare.apply(null, arguments); }
    function costShareHtml() { return SBODY().costShareHtml.apply(null, arguments); }
    function dispatchStagesHtml() { return SBODY().dispatchStagesHtml.apply(null, arguments); }
    function costHtml() { return SBODY().costHtml.apply(null, arguments); }
    function sessionHeadHtml() { return SBODY().sessionHeadHtml.apply(null, arguments); }
    function tabsHtml() { return SBODY().tabsHtml.apply(null, arguments); }
    function talkBody() { return SBODY().talkBody.apply(null, arguments); }
    function talkHtml() { return SBODY().talkHtml.apply(null, arguments); }
    function liveTag() { return SBODY().liveTag.apply(null, arguments); }
    function railHtml() { return SBODY().railHtml.apply(null, arguments); }

    // ---- the live page --------------------------------------------------------
    // A time to the second, for when the page last re-read and when a step began.
    function clockSec(ms) {
        var d = new Date(ms);
        return [d.getHours(), d.getMinutes(), d.getSeconds()].map(function (n) { return String(n).padStart(2, '0'); }).join(':');
    }
    function agoText(sec) { return sec <= 0 ? loc('live.justUpdated', '剛更新') : loc('live.updatedSecAgo', '{s} 秒前更新', { s: sec }); }
    // A figure that keeps moving between re-reads, in seconds, `b + m × now`:
    // an elapsed time is `-start, 1`. Printed once from `nowSec`, and — only
    // while `live` — marked for the once-a-second tick below the guard to move.
    // `tkr`, because 比較 already gives `tk` to a task name.
    function tk(b, m, live, nowSec) {
        var v = dur(Math.max(0, Math.round(b + m * nowSec)));
        return live && m ? '<span class="tkr" data-b="' + b + '" data-m="' + m + '">' + v + '</span>' : v;
    }

    // Whether the served page has lost its server, and what to say. Pure, so
    // it is unit tested; the fetch that feeds it and the banner it fills are
    // the document half below the guard. The sentence starts at 底下 rather
    // than at 伺服器已離線 because the bar's own heading now says
    // `serve 沒有回應` above it — mockup screen 3 splits it that way, and one
    // bar saying it twice reads as a stutter.
    function serveLost(lastOkMs, nowMs, genAbs, genRel) {
        if (lastOkMs === null || lastOkMs === undefined) return null;
        if (nowMs - lastOkMs < 15000) return null;
        return loc('live.frozenBelow', '底下所有數字與狀態都凍結在 {abs}（{rel}），不會再更新。每 5 秒重試一次。', { abs: genAbs, rel: genRel });
    }

    // ---- the left bar and old live — assets/station/nav.js (FK_NAV) ----------
    var NAV_;
    function NAV() {
        return NAV_ || (NAV_ = mod('FK_NAV', 'nav.js').make({
            loc: loc, esc: esc, w: w, NAV_TREE: NAV_TREE, focusHref: focusHref, family: family, mins: mins, clock: clock,
            modelKey: modelKey, modelLabel: modelLabel, keelProgress: keelProgress, keelStage: keelStage, sessionHash: sessionHash,
            projectHash: projectHash, ago: ago, statePill: statePill, msOf: msOf, clearStaleControl: clearStaleControl,
            clearControl: clearControl, labels: labels, S: function () { return S; }, NOW: function () { return NOW; }
        }));
    }
    // Seven pages, one level, no folds (mockup 2026-10-21-station-home): 現在,
    // Sessions, 花費, 文件 and 週報 (2026-10-27), then 設定 and 導覽 pinned under them (`pin`).
    // `kids` are a page's filters — the strip on each of its pages
    // (`subtabsHtml`) — so the strip, the title and the lit entry agree.
    var NAV_TREE = [
        { ico: 'now', label: loc('nav.now', '現在'), v: 'now', href: '#/' },
        { ico: 'sessions', label: 'Sessions', v: 'sessions', href: '#/sessions', kids: [['live', '#/live', loc('nav.inProgress', '進行中')], ['sessions', '#/sessions', loc('nav.recent', '最近')],
            ['list', '#/list', loc('nav.fullList', '全部清單')], ['cmp', '#/cmp', loc('nav.compare', '比較')]] },
        { ico: 'spend', label: loc('nav.spend', '花費'), v: 'days', href: '#/days', kids: [['days', '#/days', loc('nav.last30d', '近 30 天')], ['projects', '#/projects', loc('nav.byProject', '依專案')]] },
        { ico: 'docs', label: loc('nav.docs', '文件'), v: 'docs', href: '#/docs' },
        { ico: 'calendar', label: loc('nav.weekly', '週報'), v: 'weekly', href: '#/weekly' },
        { ico: 'settings', label: loc('nav.settings', '設定'), v: 'settings', href: '#/settings', pin: true, kids: [['settings', '#/settings', loc('nav.wizard', '精靈')]] },
        { ico: 'tour', label: loc('nav.tour', '導覽'), v: 'tour', href: '#/tour', pin: true, block: 'tour-nav', title: loc('nav.tourTitle', 'fankeel 怎麼跑一個任務，一段動畫看完') },
    ];
    function recentRows() { return NAV().recentRows.apply(null, arguments); }
    function navCounts() { return NAV().navCounts.apply(null, arguments); }
    function icon() { return NAV().icon.apply(null, arguments); }
    function navOn() { return NAV().navOn.apply(null, arguments); }
    function themeBtnHtml() { return NAV().themeBtnHtml.apply(null, arguments); }
    function navHtml() { return NAV().navHtml.apply(null, arguments); }
    function navLinksHtml() { return NAV().navLinksHtml.apply(null, arguments); }
    function jumpHits() { return NAV().jumpHits.apply(null, arguments); }
    function jumpListHtml() { return NAV().jumpListHtml.apply(null, arguments); }
    function subtabsHtml() { return NAV().subtabsHtml.apply(null, arguments); }
    function shellsHtml() { return NAV().shellsHtml.apply(null, arguments); }
    function liveSubsHtml() { return NAV().liveSubsHtml.apply(null, arguments); }
    function nowHtml() { return NAV().nowHtml.apply(null, arguments); }
    // ---- 設定: the seven-step wizard ----------------------------------------

    // ---- tune: a block changed ----------------------------------------------
    // One project's queue can sit on several sessions' rows; an id is one
    // request per project and id (queue ids repeat across projects). `tuneEvents` is every request that was in
    // progress on the last read and has settled on this one — a request first
    // seen settled is not news.
    function tuneItems(sessions) {
        var out = {};
        (sessions || []).forEach(function (s) {
            ((s.tune && s.tune.items) || []).forEach(function (it) { out[s.pkey + '|' + it.id] = it; });
        });
        return out;
    }
    function tuneOpen(sessions) {
        return (sessions || []).some(function (s) { return s.tune && s.tune.open > 0; });
    }
    function tuneEvents(prev, next) {
        var was = tuneItems(prev), now = tuneItems(next), out = [];
        Object.keys(now).forEach(function (key) {
            var a = was[key], b = now[key];
            if (a && (a.status === 'queued' || a.status === 'taken') && (b.status === 'done' || b.status === 'rejected')) {
                out.push({ id: key, block: b.block, status: b.status });
            }
        });
        return out;
    }
    function toastText(ev) {
        return (ev.status === 'done' ? loc('tune.doneColon', '已修改完成：') : loc('tune.notChangedColon', '沒有修改：')) + ev.block;
    }
    // The one place notifications and held gates appear (2026-09-26 design
    // §3): a button in the corner with the count, a panel with the gates
    // first. `notes` are the page's own — settled tune requests, newest first
    // — and what tune is editing right now is read off each session's queue.
    function floatNotes(sessions, notes, gone) {
        var editing = [];
        (sessions || []).forEach(function (s) {
            ((s.tune && s.tune.items) || []).forEach(function (it) {
                var key = s.pkey + '|' + it.id;
                if (it.status === 'taken' && !(gone && gone[key])) editing.push({ id: key, block: it.block, status: 'edit' });
            });
        });
        return editing.concat(notes || []);
    }
    // The panel's bookkeeping, pure so a test can drive it (station-50). A note
    // is read once the reader has had the panel open; a read note stays,
    // greyed, and stops counting on the bell. `gone` holds the ids of editing
    // rows the reader dismissed with ×: those rows come off the sessions'
    // queues, not off `notes`, so they are remembered by project and id (queue ids repeat across projects).
    var GONE_KEEP = 100;
    function readAll(notes) {
        return (notes || []).map(function (x) { return x.read ? x : Object.assign({}, x, { read: true }); });
    }
    function dismissNote(notes, gone, id) {
        var all = notes || [], kept = all.filter(function (x) { return x.id !== id; }), g = Object.assign({}, gone);
        if (kept.length === all.length) g[id] = true;
        return { notes: kept, gone: g };
    }
    function clearNotes(sessions, notes, gone) {
        var g = Object.assign({}, gone);
        floatNotes(sessions, [], gone).forEach(function (x) { g[x.id] = true; });
        return { notes: [], gone: g };
    }
    function goneKeys(gone) { return Object.keys(gone || {}).slice(-GONE_KEEP); }
    function goneParse(raw) {
        var a, out = {};
        try { a = JSON.parse(raw); } catch (e) { return out; }
        if (Array.isArray(a)) a.slice(-GONE_KEEP).forEach(function (id) { if (typeof id === 'string') out[id] = true; });
        return out;
    }
    function noteHtml(n) {
        var t = n.status === 'edit' ? ['edit', '<i></i>', loc('tune.editingColon', '編輯中：'), loc('tune.editingHint', 'tune 正在改這個 block，頁面上有外框標出它。')]
            : n.status === 'done' ? ['done', '✓', loc('tune.doneColon', '已修改完成：'), loc('tune.doneHint', '改過的頁面由 tune 自己重新載入。')]
                : ['rej', '✕', loc('tune.notChangedColon', '沒有修改：'), loc('tune.rejectedHint', '要求超出這個 block，已退回。')];
        return '<div class="nt ' + t[0] + (n.read ? ' read' : '') + '" data-note="' + esc(n.id) + '"><span class="ti" aria-hidden="true">' + t[1] + '</span>'
            + '<span class="tt">' + t[2] + '<code>' + esc(n.block) + '</code></span>'
            + '<button class="tx" type="button" data-note-x aria-label="' + loc('tune.close', '關閉') + '">×</button>'
            + '<span class="tb">' + t[3] + '</span></div>';
    }
    // Exported as `clock`; the page's own `clock(ms)` is the hh:mm one.
    function gateClock(sec) { return Math.floor(sec / 60) + ':' + (sec % 60 < 10 ? '0' : '') + (sec % 60); }
    function micOk() { return Boolean(w && (w.SpeechRecognition || w.webkitSpeechRecognition)); }
    var MIC_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'
        + '<path d="M12 19v3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><rect x="9" y="2" width="6" height="13" rx="3"/></svg>';
    // The free answer under a single-choice held gate's buttons: the text is the answer, sent through
    // the same /answer POST. `lock` is ' disabled' while a send is out or after it landed.
    function gateFreeHtml(s, picked, lock) {
        var id = 'gfree-' + s.id, draft = String((picked || {})[s.id + ':free'] || '');
        return '<div class="gfree" data-block="gate-free"><label for="' + esc(id) + '">' + loc('tune.freeLabel', '或自己寫答案') + '</label>'
            + '<div class="gfrow"><textarea id="' + esc(id) + '" data-gfree="' + esc(s.id) + '" rows="2" placeholder="' + loc('tune.freePlaceholder', '上面都不對的話，寫下你要的答案') + '">' + esc(draft) + '</textarea>'
            + (micOk() ? '<button type="button" class="gmic" data-mic="' + esc(id) + '" aria-pressed="false" aria-label="' + loc('tune.micLabel', '用講的寫答案') + '" title="' + loc('tune.micLabel', '用講的寫答案') + '">' + MIC_SVG + '</button>' : '')
            + '</div>' + (micOk() ? '<p class="gsay" role="status">' + loc('tune.micHint', '想用講的：按麥克風，講完可以改字再送出') + '</p>' : '')
            + '<button type="button" class="gfs" data-gfs' + (draft.trim() && !lock ? '' : ' disabled') + '>' + loc('tune.freeSend', '送出答案') + '</button></div>';
    }
    // A held gate of one single-choice question is answered by its options as
    // buttons; any other shape keeps the full form, `pendingGateHtml`. The
    // countdown runs from the hook's own `at` to `until`.
    function gateCountdownHtml(s, now, picked) {
        var p = s.pending, q = p.questions[0];
        var total = Math.max(1, Math.round((p.until - (typeof p.at === 'number' && isFinite(p.at) ? p.at : p.until - 60000)) / 1000));
        var left = Math.max(0, Math.min(total, Math.round((p.until - now) / 1000)));
        var sent = (picked || {})[s.id + ':send'];
        if (sent && sent.gate !== p.until) sent = null;
        var lock = sent && (sent.busy || sent.cls === 'ok') ? ' disabled' : '';
        var body = p.questions.length === 1 && !q.multiSelect && S.serve
            ? '<p class="gq"><small>' + esc(q.header || '') + '</small>' + esc(q.question) + '</p><div class="gops" role="group" aria-label="' + loc('tune.answer', '回答') + '">'
                + (q.options || []).map(function (o, i) {
                    return '<button type="button" class="gop" data-gop="' + i + '"' + lock + '><b>' + esc(o.label) + '</b><small>' + esc(o.description || '')
                        + '</small><kbd>' + (i + 1) + '</kbd></button>';
                }).join('') + gateFreeHtml(s, picked, lock) + '</div>'
            : pendingGateHtml(s, picked);
        return '<div class="gc" data-block="gate-countdown" data-pg-root="' + esc(s.root) + '" data-pg-id="' + esc(s.id) + '" data-until="' + p.until
            + '" data-total="' + total + '"><div class="gsrc"><span class="mono">' + esc(s.project || '') + '</span><i aria-hidden="true"></i><span class="mono">'
            + esc(s.stage || '') + '</span><span class="t">' + esc(s.task || '') + '</span></div>' + body
            + '<div class="gtm"><div class="gbar" aria-hidden="true"><i style="width:' + (left / total * 100).toFixed(1) + '%"></i></div>'
            + '<span class="gsec">' + gateClock(left) + '</span><small>' + loc('tune.timeUpAsksTerminal', '時間到，問題回到 terminal 問') + '</small></div>'
            + (S.serve ? '<button type="button" class="gho" data-gho' + lock + '>' + loc('tune.handToTerminalPhone', '交給終端／手機') + '</button>'
                + '<p class="ghs">' + loc('tune.handOffHint', '網頁不再等，問題馬上在 terminal 問；Remote Control 在手機上也看得到。') + '</p>' : '')
            + '<p class="gend' + (sent && sent.cls ? ' ' + sent.cls : '') + '" role="status" aria-live="polite">' + (sent ? esc(sent.text) : '') + '</p></div>';
    }
    var FK_BELL = '<svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'
        + '<path d="M5 8a5 5 0 0 1 10 0v4l1.5 2.5h-13L5 12z"/><path d="M8.2 16.5a2 2 0 0 0 3.6 0"/></svg>';
    // The gate panel's own size once resized: {w, h} in px, kept in localStorage
    // as `station.fkBox`. Its place is the bell's, so a saved {x, y, w, h} from
    // before the bell moved into the masthead reads as its w and h alone.
    // Never smaller than 260 by 160, never taller than the window less the 82px
    // the keel .fkp max-height leaves (station.css), or the kept size renders capped.
    var FK_MIN_W = 260, FK_MIN_H = 160;
    function fkBoxParse(raw) {
        var b;
        try { b = JSON.parse(raw); } catch (e) { return null; }
        if (!b || ['w', 'h'].some(function (k) { return typeof b[k] !== 'number' || !isFinite(b[k]); })) return null;
        return { w: b.w, h: b.h };
    }
    function fkBoxClamp(b, vw, vh) {
        if (!b) return null;
        return { w: Math.max(FK_MIN_W, Math.min(b.w, vw - 64)), h: Math.max(FK_MIN_H, Math.min(b.h, vh - 82)) };
    }
    function fkBoxStyle(b) {
        return b ? ' style="width:' + Math.round(b.w) + 'px;height:' + Math.round(b.h) + 'px"' : '';
    }
    function floatHtml(sessions, notes, open, now, picked, permission, box, gone) {
        var held = (sessions || []).filter(function (s) { return s.pending && s.pending.questions && s.pending.questions.length; });
        var all = floatNotes(sessions, notes, gone), n = held.length + all.length, tune = null, done = 0;
        var lit = held.length + all.filter(function (x) { return !x.read; }).length;
        (sessions || []).forEach(function (s) {
            if (!s.tune) return;
            done += s.tune.done;
            if (!tune && s.tune.url) tune = s.tune;
        });
        var shown = Boolean(open || (held.length && !(picked && picked['fk:shut'])));
        return '<section class="fkp" id="fkp" aria-label="' + loc('tune.notificationsAndGate', '通知與 gate') + '"' + (shown ? '' : ' hidden') + fkBoxStyle(box) + '>'
            + '<div class="fkg" aria-hidden="true" data-fkg><i></i></div>'
            + '<div class="fkh"><b>' + loc('tune.notificationsAndGate', '通知與 gate') + '</b><span class="n">' + loc('tune.nItems', '{n} 件', { n: n }) + '</span><span class="spacer"></span>'
            + (all.length ? '<button class="lk" type="button" data-note-clear>' + loc('tune.clearNotifications', '清掉通知') + '</button>' : '')
            + '<button type="button" class="fkx" data-fkx aria-label="' + loc('tune.closePanel', '關閉通知與 gate') + '"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button></div>'
            + (held.length ? '<div class="fks">' + loc('tune.waitingOnYou', '等你回答') + ' <b>' + held.length + '</b></div>'
                + held.map(function (s) { return gateCountdownHtml(s, now, picked); }).join('') : '')
            + '<div class="fks">' + loc('tune.notifications', '通知') + ' <b>' + all.length + '</b></div>' + all.map(noteHtml).join('')
            + (all.length ? '' : '<p class="fkempty">' + loc('tune.noNewNotifications', '沒有新通知。') + '</p>')
            + '<div class="fkf"><span>' + loc('tune.tuneDone', 'tune 完成') + ' <b>' + done + '</b></span>'
            + (tune ? '<a href="' + esc(tune.url) + '" target="_blank" rel="noopener">' + esc(tune.url.replace(/^https?:\/\//, '').replace(/\/$/, '')) + '</a>' : '')
            + '<span class="spacer"></span>'
            + (permission === 'default' ? '<button type="button" class="btn" data-tune-notify>' + loc('tune.notifyInBackground', '背景時通知我') + '</button>' : '') + '</div><span class="fkr" data-fk-resize aria-hidden="true"></span></section>'
            + '<button type="button" class="fkb" data-fkb aria-expanded="' + shown + '" aria-controls="fkp" aria-label="' + loc('tune.notificationsAndGateNItems', '通知與 gate：{n} 件', { n: lit })
            + (held.length ? loc('tune.nGatesWaiting', '，{n} 個 gate 在等', { n: held.length }) : '') + '">' + FK_BELL + '<span class="fkn">' + (lit ? lit : '') + '</span></button>';
    }

    // What 送出答案 sends, and how many questions have no answer yet. Typed
    // 其他 text is the answer on a single-choice question and one more pick on a
    // multi-select one; the `__other` box itself is never an answer.
    function pgAnswers(questions, picks, others) {
        var answers = {}, missing = 0;
        (questions || []).forEach(function (q, i) {
            var labels = ((picks || {})[i] || []).filter(function (l) { return l !== '__other'; });
            var text = String((others || {})[i] || '').trim();
            var a = q.multiSelect ? labels.concat(text ? [text] : []).join(', ') : (text || labels[0] || '');
            if (a) answers[q.question] = a;
            else missing++;
        });
        return { answers: answers, missing: missing };
    }

    // A gate hooks/gate.js is holding for this page (`gate.station`): the
    // questions, and under `serve` a form whose answer goes to `/answer`.
    // `picked` is what was ticked before the last re-read, keyed `<id>:<n>`,
    // so the three-second poll does not clear a half-answered form.
    function pendingGateHtml(s, picked) {
        var p = s && s.pending;
        if (!p || !p.questions || !p.questions.length) return '';
        var on = picked || {};
        var left = Math.max(0, Math.round((p.until - (S.serve ? Date.now() : NOW)) / 1000));
        var picks = {}, others = {};
        p.questions.forEach(function (q, i) { picks[i] = on[s.id + ':' + i] || []; others[i] = on[s.id + ':' + i + ':other'] || ''; });
        var got = pgAnswers(p.questions, picks, others), n = p.questions.length;
        var dis = S.serve ? '' : ' disabled';
        var sent = on[s.id + ':send'];
        if (sent && sent.gate !== p.until) sent = null;
        var lock = sent && (sent.busy || sent.cls === 'ok');
        var qs = p.questions.map(function (q, i) {
            var type = q.multiSelect ? 'checkbox' : 'radio', had = picks[i];
            return '<fieldset class="pgq"><legend>' + esc(q.header || '') + ' · ' + esc(q.question)
                + (q.multiSelect ? '<span class="multi">' + loc('tune.multiSelect', '可多選') + '</span>' : '') + '</legend><div class="opts2">'
                + (q.options || []).map(function (o) {
                    return '<label class="pgo o"><input type="' + type + '" name="pg-' + i + '" value="' + esc(o.label) + '"'
                        + (had.indexOf(o.label) >= 0 ? ' checked' : '') + dis + '> <b>' + esc(o.label) + '</b> <small>'
                        + esc(o.description || '') + '</small></label>';
                }).join('')
                + '<label class="pgo o other"><input type="' + type + '" name="pg-' + i + '" value="__other"'
                + (had.indexOf('__other') >= 0 ? ' checked' : '') + dis + '> <b>' + loc('tune.other', '其他') + '</b><input type="text" class="pgt" data-pg-other="' + i
                + '" value="' + esc(others[i]) + '" placeholder="' + loc('tune.writeYourOwn', '自己寫…') + '" aria-label="' + esc(q.header || q.question) + loc('tune.colonOther', '：其他') + '"' + dis + '></label>'
                + '</div></fieldset>';
        }).join('');
        return '<div class="pg gp" data-block="pending-gate" data-pg-root="' + esc(s.root) + '" data-pg-id="' + esc(s.id) + '">'
            + '<div class="h2">' + loc('tune.pendingGate', '懸著的 gate') + ' <small>' + loc('tune.terminalWaiting', 'terminal 還等 {t}，逾時就回 terminal 問', { t: dur(left) }) + '</small></div>' + qs
            + (S.serve ? '<div class="act gpf"><span class="cnt">' + loc('tune.answeredNOfM', '已答 <b class="pgn">{a} / {n}</b>', { a: n - got.missing, n: n }) + '</span>'
                + '<span class="why">' + loc('tune.everyQuestionNeedsAnswer', '每題都要有答案') + '</span><span class="spacer"></span>'
                + '<button type="button" class="go" data-answer' + (got.missing || lock ? ' disabled' : '') + '>' + loc('tune.submitAnswer', '送出答案') + '</button></div>'
                + '<div class="pgr' + (sent && sent.cls ? ' ' + sent.cls : '') + '" role="status" aria-live="polite">' + (sent ? esc(sent.text) : '') + '</div>'
                : '<p class="tally">' + loc('tune.staticCannotAnswer', '靜態頁不能作答：開 serve 的頁面，或回 terminal 答。') + '</p>') + '</div>';
    }

    // Which of the page's top-level blocks a redraw has to replace: the
    // indices whose markup changed, or null when the list changed shape and
    // the page is drawn whole. `was` is what the last draw wrote, not what the
    // DOM holds now — a <details> the reader opened is the reader's.
    function changedParts(was, now) {
        if (!was || !now || was.length !== now.length) return null;
        var out = [];
        for (var i = 0; i < now.length; i++) if (was[i] !== now[i]) out.push(i);
        return out;
    }

    // The main session's effort, when its transcript said; nothing otherwise.
    function effortChip(effort) {
        return effort ? '<span class="chip" title="' + loc('tune.effortHint', '主 session 最後一次請求的 effort') + '">effort <span class="mono">' + esc(effort) + '</span></span>' : '';
    }

    // The hero's eyebrow carries the frozen moment too, so a reader who has
    // scrolled past the bar is not reading numbers they take for live. The
    // hh:mm is the caller's, off the same `stamp()` the bar's absolute time
    // comes from: two places on the page, one clock read.
    function heroEyebrow(frozenAt) {
        return frozenAt ? loc('tune.last30dFrozenAt', '近 30 天 · 凍結於 {t}', { t: frozenAt }) : loc('tune.last30d', '近 30 天');
    }

    // ---- the project page, again: its board link ------------------------------
    // The project card's line to its architecture board. Only a served page
    // has the `/chartroom/` route (a file:// copy has none), and only a registry
    // with `.fankeel/architecture.board` has a board (`board`, lib/station.js);
    // the station draws it itself (lib/board.js `boardPage`). The url segment
    // is the root's folder name, the one scripts/station.js matches; the
    // trailing slash keeps the page's `board.svg` under its own prefix.
    function boardLinkHtml(p, serve) {
        if (!serve || !p || !p.board) return '';
        var name = String(p.root).split(/[\\/]/).filter(Boolean).pop() || '';
        var href = '/chartroom/' + encodeURIComponent(name) + '/';
        return '<p class="mute" style="margin:4px 0 0">' + loc('proj.boardColon', '架構白板：')
            + '<a href="' + esc(href) + '" target="_blank" rel="noopener">' + loc('proj.boardOpen', '開啟') + '</a></p>';
    }
    // ---- the focus page: /f/<id>/<tab>, one session's plan or gate alone ----
    // docs/90-agent/plans/2026-10-21-station-focus-design.md §1. lib/station.js
    // `focusShell` sets `window.STATION_FOCUS`, loads one session's row and
    // detail (`serializeFocus`) in place of station-data.js, and loads
    // assets/station/focus-page.js (FK_FOCUS), which draws the page; `focusBoot`,
    // below the guard, paints it and returns before the full page's boot runs.
    // Below the guard's `if (!doc) return;`: draws once, then re-reads the one
    // session's script through `reload` every five seconds while the browser
    // tab is visible — the ledger moves while a build runs. Only `w.*` and
    // hoisted functions here: the full page's `var`s further down are never
    // assigned, which is why `reload` holds its timeout as a literal.

    function focusBoot() {
        var F = w.STATION_FOCUS, FO = w.FK_FOCUS;
        var el = doc.getElementById('focus');
        var open = {};
        if (el.addEventListener) el.addEventListener('click', function (e) {
            var t = e.target, sm = t && typeof t.closest === 'function' ? t.closest('details[data-gv] > summary') : null;
            if (sm && sm.parentNode) open[sm.parentNode.getAttribute('data-gv')] = !sm.parentNode.open;
        });
        var last = null;
        var paint = function (board) {
            var html = FO.keepOpen(FO.page(S, w.STATION_DETAIL, F), open);
            if (!FO.repaint(last, html, doc.activeElement, board)) return;
            last = html;
            el.innerHTML = html;
            if (w.FK_GATE && w.FK_GATE.diagrams) w.FK_GATE.diagrams(el);
        };
        // The board pane asks for a redraw after it read or wrote the board
        // (assets/station/board-edit.js), with the focus often still on its toolbar.
        w.FK_FOCUS_REDRAW = function () { paint(true); };
        if (w.FK_BOARD && w.FK_BOARD.listen) w.FK_BOARD.listen(el, S.nonce);
        paint();
        if (!S.serve || !w.setInterval) return;
        w.setInterval(function () {
            if (doc.hidden) return;
            // A stopped server, a 404 or a hang must not leave the last ledger looking current.
            reload('/station/focus/' + encodeURIComponent(F.id) + '.js', function (ok) {
                if (ok) { S = w.STATION || S; paint(); }
                el.classList.toggle('fm-stale', !ok);
            });
        }, 5000);
    }
    // What the redesigned pages' modules (assets/station/*-page.js, tip.js,
    // gate-frame.js) draw with, beside the spend modules' helpers above: a
    // session's cost is `usd + agentUsd` on every page (station redesign §6), and
    // the glyph, chips, ages and links are the ones the old pages drew. All
    // hoisted declarations, so this one assign sees them even though some are
    // written further down; it sits above `if (!doc) return;` so a module test
    // under `require` has them too.
    Object.assign(w.FK_KIT, { cost: cost, usd: usd, mins: mins, ago: ago, stamp: stamp, keelGlyph: keelGlyph, shortLabel: shortLabel,
        projectHash: projectHash, family: family, modelKey: modelKey, modelLabel: modelLabel, icon: icon, loc: loc, ROUTE: ROUTE,
        // The focus page (assets/station/focus-page.js) draws with these too.
        keelProgress: keelProgress, stageNow: stageNow, planNewest: planNewest, gateTabHtml: gateTabHtml, shellsHtml: shellsHtml });
    // ---- tune: a block changed, continued: what the tests import -----------

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            knownPkey: knownPkey,
            boardLinkHtml: boardLinkHtml,
            tokens: tokens, mins: mins, hours: hours, usd: usd, ago: ago, day: day,
            stamp: stamp, esc: esc, cost: cost, labels: labels, delta: delta, match: match,
            statePill: statePill, clearStaleControl: clearStaleControl,
            openSections: openSections, downsample: downsample, lineChart: lineChart,
            riseText: riseText, ctxSection: ctxSection, seqHtml: seqHtml, orderSection: orderSection,
            dur: dur, tasksHtml: tasksHtml, dispatchHtml: dispatchHtml, replayHtml: replayHtml, dispatchStagesHtml: dispatchStagesHtml, segmentsOf: segmentsOf, stageCost: stageCost, totalSuffix: totalSuffix, splitHtml: splitHtml, planTabHtml: planTabHtml, planRel: planRel, gateTabHtml: gateTabHtml,
            splitCount: splitCount, taskCount: taskCount,
            pendingGateHtml: pendingGateHtml, pgAnswers: pgAnswers, todoEntry: todoEntry, riseTodo: riseTodo, backTodo: backTodo, todoSpot: todoSpot,
            localDay: localDay, lastDays: lastDays, parseHash: parseHash, family: family, modelKey: modelKey, modelLabel: modelLabel, sessionTotals: sessionTotals,
            windowTotals: windowTotals, dayBars: dayBars, projectRows: projectRows, kpiHtml: kpiHtml,
            histSvg: histSvg, legendHtml: legendHtml,
            keelProgress: keelProgress, keelStage: keelStage, stageNow: stageNow, runningTag: runningTag,
            timelineModel: timelineModel, timelineSvg: timelineSvg, costModel: costModel, costHtml: costHtml,
            sessionHeadHtml: sessionHeadHtml, tabsHtml: tabsHtml, serveLost: serveLost, talkHtml: talkHtml, talkBody: talkBody,
            heroEyebrow: heroEyebrow, effortChip: effortChip, tourPage: tourPage,
            railHtml: railHtml, liveTag: liveTag,
            navHtml: navHtml, navCounts: navCounts, recentRows: recentRows, nowHtml: nowHtml,
            segTip: segTip,
            tk: tk,
            stageShare: stageShare, costShareHtml: costShareHtml, subtabsHtml: subtabsHtml,
            liveSubsHtml: liveSubsHtml, shellsHtml: shellsHtml,
            NAV_TREE: NAV_TREE,
            tuneOpen: tuneOpen, tuneEvents: tuneEvents, toastText: toastText, floatHtml: floatHtml, fkBoxParse: fkBoxParse, fkBoxClamp: fkBoxClamp, gateCountdownHtml: gateCountdownHtml, noteHtml: noteHtml, floatNotes: floatNotes, clock: gateClock,
            readAll: readAll, dismissNote: dismissNote, clearNotes: clearNotes, goneParse: goneParse, goneKeys: goneKeys,
            changedParts: changedParts, seenHtml: seenHtml, drawList: drawList, sessionPage: sessionPage,
            recordHtml: recordHtml, recordPageHtml: recordPageHtml, boardsHtml: boardsHtml, listAskRow: listAskRow,
        };
    }
    if (!doc) return;
    // The focus page (lib/station.js `focusShell`) has no nav, no dashboard
    // and no hash routes: it draws one session's tab and stops here.
    if (w.STATION_FOCUS) return focusBoot();
    var f = { q: '', state: '', project: '', stage: '' };
    var route = parseHash(w.location && w.location.hash);
    // 清單's selected row, sort, 比較 ticks and detail scripts are FK_LIST (assets/station/list-state.js).
    var LS = w.FK_LIST;
    // The home page's two segmented controls; Tasks 7 and 8 add their own keys.
    var view = { metric: 'usd', dim: 'model', notes: [], fkOpen: false };
    // `hh:mm` while the server is gone, `null` while it answers. The poll at
    // the bottom of this file owns it; the hero's eyebrow reads it, which is
    // why it is declared out here rather than beside the poll.
    var frozenAt = null;
    // When the data on screen was last read: at load, then at every re-read
    // below. The session page's live tag and the footer both say it.
    var polledAt = Date.now();
    // `NOW`, `LAB`, `DAYS`, `PREV`, `TODAY`, `NAMES` and `PKEYS` are derived
    // from `S` by `freshen()`, below the live-refresh guard — called here for
    // the first draw and again on every re-read, so there is one derivation
    // rather than two that could drift apart.
    var NOW, LAB, DAYS, PREV, TODAY, NAMES, PKEYS;
    freshen();
    var VIEWS = {};
    var rows = function () {
        return S.sessions.filter(function (s) { return match(s, f); });
    };

    function taskCell(s) {
        return '<div class="ell" title="' + esc(s.task) + '" style="font-weight:500">'
            + esc(s.task || loc('tune.unnamed', '（未命名）')) + '</div>'
            + '<div class="mute ell" style="font-size:11px;margin-top:2px">'
            + esc(LAB[s.root]) + ' · ' + ago(s.updated) + '</div>';
    }
    function stageCell(s) {
        var pct = s.steps ? Math.round(s.step / s.steps * 100) : 0;
        return '<div style="display:flex;align-items:center;gap:8px">'
            + '<div class="mini" style="flex:1"><span style="width:' + pct + '%;background:'
            + (STAGE_C[s.stage] || 'var(--ind)') + '"></span></div>'
            + '<span class="mono mute" style="font-size:11px">' + s.step + '/' + s.steps
            + '</span></div><div class="mute" style="font-size:11px;margin-top:3px">'
            + esc(s.stage || '—') + '</div>';
    }
    // A gone registry keeps its facet, so selecting it has to say why the pane
    // went empty. Without this the page answers a click with a blank screen and
    // the reader cannot tell a gone registry from a filter that matched nothing.
    function goneNote(root) {
        if (!root) return '';
        var hit = S.projects.filter(function (p) { return p.root === root; });
        if (!hit.length || !hit[0].gone) return '';
        return '<div class="card" style="margin-bottom:14px"><div class="cbody">'
            + '<p style="margin:0"><b>' + esc(hit[0].root) + '</b></p>'
            + '<p class="mute" style="margin:4px 0 0">gone — no sessions/ here any more. '
            + 'The registry keeps its place until it is forgotten by name: '
            + '<code>station.js --forget</code>.</p></div></div>';
    }

    // The new layout has no per-registry meta line, so a selected (and not
    // gone) registry gets a small card in `goneNote()`'s place instead: how
    // many of its session files did not parse — the hooks drop a corrupt
    // entry silently and correctly, so this is the only place that count
    // surfaces — its build directories with a file count each, and when its
    // map.md last changed.
    function registryNote(root) {
        if (!root) return '';
        var hit = S.projects.filter(function (p) { return p.root === root; });
        if (!hit.length || hit[0].gone) return '';
        var p = hit[0];
        var own = S.sessions.filter(function (s) { return s.root === p.root; });
        return '<div class="card" style="margin-bottom:14px"><div class="cbody">'
            + '<div style="display:flex;align-items:center;gap:10px">'
            + '<p class="mute" style="margin:0;flex:1">' + loc('tune.nSessionFilesUnreadable', '{n} 個 session 檔案讀不到', { n: p.unreadable })
            + '</p>' + clearStaleControl(p, own) + '</div>'
            + '<p class="mute" style="margin:4px 0 0">map.md '
            + (p.mapAt ? loc('tune.updatedAt', '更新於 {t}', { t: day(p.mapAt) }) : loc('tune.doesNotExist', '不存在')) + '</p>'
            + (p.build.length
                ? '<p class="mute" style="margin:4px 0 0">' + loc('tune.buildColon', 'build：') + p.build.map(function (b) {
                    return esc(b.name) + ' (' + b.files + ')';
                }).join(loc('tune.listSep', '、')) + '</p>'
                : '<p class="mute" style="margin:4px 0 0">' + loc('tune.noBuildFolder', '沒有 build 資料夾') + '</p>')
            + boardLinkHtml(p, S.serve)
            + '</div></div>';
    }

    // The home page answers the search box and nothing else: the list page's
    // facets narrow the list page, and a facet left set there that quietly
    // shrank these totals would read as a quieter month.
    function homeRows() {
        return S.sessions.filter(function (s) { return match(s, { q: f.q, state: '', project: '', stage: '' }); });
    }
    function homeOpts(sel) {
        return { metric: view.metric, dim: view.dim, sel: sel, today: TODAY, days: DAYS, names: NAMES, pkeys: PKEYS };
    }
    // ---- 儀表板 (`#/`) cards and the completion record — assets/station/dash.js (FK_DASH) --
    // Four cards, each read off the rows its full page reads — `homeRows()`
    // through the same filters — so a card's number is the number that page shows.
    var DASH_;
    function DASH() {
        return DASH_ || (DASH_ = mod('FK_DASH', 'dash.js').make({
            loc: loc, esc: esc, icon: icon, sessionHash: sessionHash, ROUTE: ROUTE, shortLabel: shortLabel, dayBars: dayBars,
            usd: usd, estMark: estMark, w: w, tokens: tokens, KIND_KEYS: KIND_KEYS, KIND_LABEL: KIND_LABEL, modelLabel: modelLabel,
            view: view, DASH_SHOWN: DASH_SHOWN, S: function () { return S; }, NAMES: function () { return NAMES; },
            DAYS: function () { return DAYS; }, NOW: function () { return NOW; }
        }));
    }
    function msOf() { return DASH().msOf.apply(null, arguments); }
    function keelGlyph() { return DASH().keelGlyph.apply(null, arguments); }
    function keelProgress() { return DASH().keelProgress.apply(null, arguments); }
    function keelStage() { return DASH().keelStage.apply(null, arguments); }
    function focusHref() { return DASH().focusHref.apply(null, arguments); }
    function tdShow() { return DASH().tdShow.apply(null, arguments); }
    function dashByProj() { return DASH().dashByProj.apply(null, arguments); }
    function dashTokens7() { return DASH().dashTokens7.apply(null, arguments); }
    function dashModels() { return DASH().dashModels.apply(null, arguments); }
    function stageCost() { return DASH().stageCost.apply(null, arguments); }
    function recLabel() { return DASH().recLabel.apply(null, arguments); }
    function recTitle() { return DASH().recTitle.apply(null, arguments); }
    function recordHtml() { return DASH().recordHtml.apply(null, arguments); }
    function recordPageHtml() { return DASH().recordPageHtml.apply(null, arguments); }
    function boardsHtml() { return DASH().boardsHtml.apply(null, arguments); }
    function listAskRow() { return DASH().listAskRow.apply(null, arguments); }
    function dispatchUi() { return DASH().dispatchUi.apply(null, arguments); }
    if (typeof module !== 'undefined' && module.exports) module.exports.focusHref = focusHref;
    doc.addEventListener('click', function (e) {
        var t = e.target;
        if (!t || !t.closest) return;
        var dlg = t.closest('.tdlg');
        if (!dlg) return;
        var tab = t.closest('[role=tab]');
        if (tab) tdShow(dlg, tab.getAttribute('data-st'), true);
        else if (t.closest('[data-tdlg-close]') || t === dlg) dlg.close();
    });
    doc.addEventListener('keydown', function (e) {
        var b = e.target && e.target.closest ? e.target.closest('.tdlg [role=tab]') : null;
        if (!b) return;
        var tabs = [].slice.call(b.parentNode.querySelectorAll('[role=tab]')), i = tabs.indexOf(b), n = tabs.length;
        var j = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i + n - 1) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
        if (j < 0) return;
        e.preventDefault();
        tdShow(b.closest('.tdlg'), tabs[j].getAttribute('data-st'), true);
    });
    // The eight cards the library adds (2026-10-16 mockup, dash-library), each
    // off by default and read off fields `window.STATION` already carries.
    // A list card's rows are `[k, t, v]`, already escaped.
    var DASH_SHOWN = 6;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports.dashByProj = dashByProj; module.exports.dashTokens7 = dashTokens7; module.exports.dashModels = dashModels;
    }
    view.closed = {};
    // What 派工 and 事件 are showing, kept across every redraw: the agents and
    // prompts opened, the phases opened, the state filter, the replay's hidden
    // kinds — and, from `dispatchUi`, the clock its tickers start from.
    view.open = {};
    view.prm = {};
    view.ph = {};
    view.kinds = {};
    view.pg = {};
    view.dfilter = 'all';
    view.dxv = 'chart';
    view.dxm = 'c';
    // ---- 儀表板 (`#/`), again: the pages that draw it ---------
    function sessionPage(r) {
        var s = S.sessions.filter(function (x) { return x.id === r.id; })[0];
        // A session from the 花費 page's top list need not be in any
        // registry; its 對話 tab still has a transcript to read, which the
        // server's talk route finds under its own config dir.
        if (!s && r.tab === 'talk' && w.FK_PANEL) {
            if (S.serve && !TALK[r.id]) talkLoad(r.id, true);
            return w.FK_PANEL.talkOnly(r.id, talkHtml(r.id, S.serve ? TALK[r.id] : { turns: [], total: null, state: 'static' }));
        }
        if (!s) return '<section class="panel"><p class="note">' + loc('dash.noSessionOnPage', '這頁上沒有 session {id}', { id: esc(r.id) }) + '</p></section>';
        needDetail(s);
        var x = DETAIL[s.id] || null;
        // 概覽 draws its money from `days` on the data file, so that half answers
        // before the detail script has loaded; the timeline and the two lists
        // need the detail. The old 花費 tab's stage × model table is the
        // 明細 under the bar.
        var L = stageShare(s, x), hi = view.hiId === s.id ? view.hi : null;
        var legend = '<div class="lane-legend"><span><i class="sw" style="background:var(--st-build);opacity:.35"></i>' + loc('dash.stageTint', 'stage 底色') + '</span>'
            + '<span><i class="hatchsw"></i>' + loc('dash.waitingOnYouGate', '等你回答（gate）') + '</span>'
            + '<span><i class="sw ln" style="background:var(--ctx)"></i>' + loc('dash.mainSessionContext', '主 session context') + '</span>'
            + MODEL_KEYS.map(function (k) {
                return '<span><i class="sw" style="background:var(--m-' + k + ')"></i>' + k + '</span>';
            }).join('')
            + '<span><i class="sw" style="background:var(--s-agent)"></i>' + loc('dash.backgroundAgent', '背景 agent') + '</span>'
            + '<span><i class="sw" style="background:var(--s-workflow)"></i>workflow</span></div>';
        // The bar leads: it is short, and the timeline under it can run to
        // dozens of agent rows.
        var overview = costShareHtml(L, hi) + (x ? legend + '<div class="chart tl">' + timelineSvg(stageCost(timelineModel(x), s), view.closed, hi) + '</div>'
                + '<div class="note">' + loc('dash.timelineAxisHint', '橫軸是真實時間：stage 的底色寬度等於實際經過的時間，context 曲線畫在上面；游標停在圖上看那一刻的 stage、時間與 context；點一下標出那個 stage；點 workflow 那列收合或展開。') + '</div>'
            : detailNote(s))
            + '<details class="csmore"><summary>' + loc('dash.stageModelDetail', 'stage × model 明細') + ' <small>' + loc('dash.tokenUsdMainLoop', 'token 與各自的 USD，主迴圈') + '</small></summary>'
            + costHtml(costModel(s.days), x) + '</details>'
            + (x ? '<div class="det">' + ctxSection(s, x, true) + tasksHtml(x.tasks) + '</div>' : '');
        // 對話 is not in the detail script: its first visit asks the server for
        // the first page (`talkLoad`), and what came back stays in TALK. A page
        // written to a file has no server to ask.
        if (r.tab === 'talk' && S.serve && !TALK[s.id]) talkLoad(s.id, true);
        var talk = S.serve ? TALK[s.id] : { turns: [], total: null, state: 'static' };
        var body = r.tab === 'dispatch' ? (x ? dispatchStagesHtml(L, s.id, hi) + '<div class="det">' + dispatchHtml(x, s, dispatchUi(s)) + '</div>' : detailNote(s))
            : r.tab === 'events' ? (x ? '<div class="det">' + replayHtml(x, view.kinds, s) + '</div>' : detailNote(s))
                : r.tab === 'talk' ? talkHtml(s.id, talk)
                    : r.tab === 'plan' ? (x ? planTab(s, x) : detailNote(s))
                    : r.tab === 'gate' ? (x ? gateTab(s, x) : detailNote(s))
                        : overview;
        // The film's header (2026-10-01 layout): the glyph filled as the route
        // is, `0N / 0M stage` over the title, the meta chips beside them.
        return '<section class="panel kshead" data-block="session-head"><div class="eyebrow">session <span class="mono">' + esc(String(s.id).slice(0, 8)) + '</span> · '
            + '<a href="' + projectHash(s.pkey) + '">' + esc(NAMES[s.pkey] || s.pkey) + '</a> · ' + stamp(Date.parse(s.started)) + '</div>'
            + '<div class="ks-top">' + keelProgress(s) + '<div class="ks-t">' + keelStage(s)
            + '<h1 class="s-title">' + esc(s.task || loc('dash.unnamed', '（未命名）')) + '</h1></div>'
            + '<div class="s-meta">' + statePill(s) + (S.serve ? liveTag(s.state === 'live', polledAt, Date.now()) : '')
            + (s.model ? '<span class="chip"><i class="sw" style="background:var(--m-' + family(s.model) + ')"></i>' + loc('dash.mainSession', '主 session') + ' <span class="mono">'
                + esc(s.model) + '</span></span>' : '') + effortChip(s.effort) + '</div></div>'
            + railHtml(s, Boolean(S.serve) && s.state === 'live', S.serve ? Date.now() : NOW)
            + sessionHeadHtml(s, x) + '</section>' + recordPageHtml(s) + boardsHtml(s, Boolean(S.serve))
            + tabsHtml(s, r.tab, x, talk && talk.total !== null ? talk.total : null) + '<section class="panel' + (r.tab === 'plan' ? ' pv" data-block="plan-tab"' : r.tab === 'gate' ? ' pv gv" data-block="gate-tab"' : '"' + (r.tab === 'dispatch' ? ' data-block="dispatch"' : '')) + '>' + body + '</section>';
    }
    // 對話's turns, per session id, for as long as the page lives: a redraw
    // rewrites the panel, and what was fetched must not go with it. `talkLoad`
    // asks for the 100 turns after the ones held; `quiet` is for a call made
    // while a draw is under way, which must not start another. Its button is
    // heard by a click listener added on the first call: a button exists only
    // after one, and tests/station-hdl-c.test.js picks the page's document
    // listeners by their place in the order they were added at load.
    var TALK = {};
    var talkHeard = false;
    function talkLoad(id, quiet) {
        if (!talkHeard) {
            talkHeard = true;
            doc.addEventListener('click', function (e) {
                var t = e && e.target && e.target.closest ? e.target.closest('[data-talk]') : null;
                if (t) talkLoad(t.getAttribute('data-talk'));
            });
        }
        var held = TALK[id] || (TALK[id] = { turns: [], total: null, counts: null, skipped: null, state: '' });
        if (held.state === 'loading') return;
        held.state = 'loading';
        var redraw = function () { if (route.view === 'session' && route.id === id) draw(); };
        if (!quiet) redraw();
        fetch('station/talk/' + encodeURIComponent(id) + '?from=' + held.turns.length).then(function (r) {
            if (r.status === 404) return null;
            if (!r.ok) throw new Error(String(r.status));
            return r.json();
        }).then(function (page) {
            if (page) {
                held.turns = held.turns.concat(page.turns);
                held.total = page.total;
                held.counts = page.counts;
                held.skipped = page.skipped;
                held.spend = page.spend || null;
                held.state = '';
            } else {
                held.state = 'missing';
            }
            redraw();
        }, function () {
            held.state = 'failed';
            redraw();
        });
    }
    VIEWS.session = sessionPage;
    // `started` has a column of its own because the page this replaces sorted
    // by it, and a sort key with no header is a sort nobody can reach.
    var COLS = [['task', loc('dash.colTask', '任務')], ['stage', loc('dash.colStage', '階段')], ['burn', 'context'],
        ['cost', loc('dash.colCost', '花費')], ['state', loc('dash.colState', '狀態')], ['started', loc('dash.colStarted', '開始')], ['updated', loc('dash.colLastAction', '最後動作')]];
    function val(s, k) {
        if (k === 'cost') return cost(s);
        if (k === 'state') return { live: 0, stale: 1, down: 2 }[s.state];
        if (k === 'started') return Date.parse(s.started) || 0;
        return s[k];
    }
    // The 清單 facets' group icons, drawn the way `icon()` draws a page's.
    var FICON = {
        state: '<svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">'
            + '<circle cx="8" cy="8" r="5.8"/><path d="M8 2.2a5.8 5.8 0 0 1 0 11.6z" fill="currentColor" stroke="none"/></svg>',
        stage: '<svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"'
            + ' stroke-linecap="round"><circle cx="3" cy="8" r="1.6"/><circle cx="8" cy="8" r="1.6"/><circle cx="13" cy="8" r="1.6"/>'
            + '<path d="M4.6 8h1.8M9.6 8h1.8"/></svg>',
    };
    // Every 清單 facet is one pick, and in a row their options no longer fit,
    // so each is a trigger — its icon, the current pick with its count, a
    // caret — and its options live in a popover under it. The options are
    // still `[data-facet] button`s with `data-v` and `aria-pressed`, so the facet
    // click handler picks from here unchanged. A pick other than 全部 marks
    // the trigger and gets a × that puts it back. `pickOpen` (which one is
    // open) and `pickQ` (Registry's search box) are in memory, so the 3 s
    // redraw keeps the popover open and filtered.
    var pickOpen = null, pickQ = '', pickLast = null;
    var CARET = '<svg class="caret" viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><path d="M2 3.8 5 6.8l3-3" fill="none"'
        + ' stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    // `items` are `{ v, main, sub, n, lead, bar }`: `sub` a muted second line (and the
    // title), `lead` markup before the label, `bar` a 0–1 share drawn under it;
    // `search` puts a box over the rows.
    function pickHtml(key, ico, name, items, search) {
        var open = pickOpen === key, q = open ? pickQ.toLowerCase() : '', cur = items[0];
        items.forEach(function (it) { if (it.v === f[key]) cur = it; });
        // A pick whose option has gone (its last session moved on) still filters, so it still shows.
        if (f[key] && cur.v !== f[key]) cur = { v: f[key], main: f[key], n: 0 };
        var opt = function (it) {
            var on = f[key] === it.v, hide = q && (it.main + ' ' + (it.sub || '')).toLowerCase().indexOf(q) < 0;
            return '<button type="button" role="option" data-v="' + esc(it.v) + '" aria-pressed="' + on + '" aria-selected="' + on + '"'
                + (hide ? ' hidden' : '') + (it.sub ? ' title="' + esc(it.sub) + '"' : '') + '>' + (it.lead || '')
                + '<span class="ro-m"><span class="fl">' + esc(it.main) + '</span>'
                + (it.sub ? '<small>' + esc(it.sub) + '</small>' : '')
                + (it.bar !== undefined ? '<i class="rbar"><i style="width:' + Math.round(it.bar * 100) + '%"></i></i>' : '') + '</span>'
                + '<b class="fc">' + it.n + '</b></button>';
        };
        return '<div class="ctlgrp fg-' + key + '"><div class="rwrap"' + (cur.v ? ' data-set' : '') + '>'
            + '<button type="button" class="rbtn" data-pick="' + key + '" aria-haspopup="listbox" aria-expanded="' + open + '"'
            + ' aria-label="' + loc('dash.nameColonSub', '{name}：{sub}', { name: name, sub: esc(cur.sub || cur.main) }) + '" title="' + name + (cur.sub ? loc('dash.colonSub', '：{sub}', { sub: esc(cur.sub) }) : '') + '">'
            + ico + (cur.lead || '') + '<span class="fl">' + esc(cur.main) + '</span><b class="fc">' + cur.n + '</b>' + CARET + '</button>'
            + (cur.v ? '<button type="button" class="rclr" data-pickclr="' + key + '" aria-label="' + loc('dash.nameBackToAll', '{name}回到全部', { name: name }) + '" title="' + loc('dash.backToAll', '回到全部') + '">×</button>' : '')
            + (open ? '<div class="rpop">'
                + (search ? '<input type="search" data-pickq placeholder="' + loc('dash.findName', '找 {name}', { name: name }) + '" aria-label="' + loc('dash.findName', '找 {name}', { name: name }) + '" value="' + esc(pickQ) + '">' : '')
                + '<div class="seg" role="listbox" aria-label="' + name + '" data-facet="' + key + '">' + items.map(opt).join('') + '</div></div>' : '')
            + '</div></div>';
    }
    // The side bar's three facets, moved onto the page they narrow.
    function facetsHtml() {
        var n = { live: 0, stale: 0, down: 0 }, byStage = {}, byRoot = {}, all = S.sessions.length;
        S.sessions.forEach(function (s) {
            n[s.state]++;
            byStage[s.stage] = (byStage[s.stage] || 0) + 1;
            byRoot[s.root] = (byRoot[s.root] || 0) + 1;
        });
        var tail = S.projects.map(function (p) { return shortLabel(LAB[p.root] || p.root); });
        var stages = ROUTE.filter(function (k) { return byStage[k]; });
        var top = Math.max.apply(null, stages.map(function (k) { return byStage[k]; }).concat([1]));
        return '<div class="controls lctl">'
            + pickHtml('state', FICON.state, loc('dash.state', '狀態'), [{ v: '', main: loc('dash.all', '全部'), n: all }].concat(['live', 'stale', 'down'].map(function (k) {
                return { v: k, main: k, n: n[k], lead: '<i class="dot ' + k + '"></i>' };
            })))
            + pickHtml('project', icon('projects'), 'Registry', [{ v: '', main: loc('dash.all', '全部'), n: all }].concat(S.projects.map(function (p, i) {
                // The path's last segment, unless another registry ends the same way.
                var t = tail.filter(function (x) { return x === tail[i]; }).length > 1 ? LAB[p.root] || p.root : tail[i];
                return { v: p.root, main: t + (p.gone ? ' — gone' : ''), sub: p.root, n: byRoot[p.root] || 0 };
            })), S.projects.length > 6)
            // A stage's bar is its count against the busiest stage's.
            + pickHtml('stage', FICON.stage, loc('dash.whichStageStuck', '停在哪一階段'), [{ v: '', main: loc('dash.all', '全部'), n: all }].concat(stages.map(function (k) {
                return { v: k, main: k, n: byStage[k], lead: '<i class="dot" style="background:var(--st-' + esc(k) + ')"></i>', bar: byStage[k] / top };
            })))
            + '</div>';
    }
    // Ticking rows to compare: nothing in the header until one is ticked, then
    // a bar slides up from the bottom — how many, 比較 (live from two, since
    // 比較 lays two sessions side by side; a third tick drops the oldest), and
    // 清除. `#ncmp` is the count, rewritten in place on every tick.
    function selbarInner() {
        var n = LS.picked.length;
        return icon('cmp') + '<span>' + loc('dash.pickedN', '已選 <b id="ncmp">{n}</b> 個', { n: n }) + '</span>'
            + (n >= 2 ? '<a class="sbtn pri" href="#/cmp">' + loc('dash.compare', '比較') + '</a>'
                : '<span title="' + loc('dash.pickAtLeastTwo', '至少選 2 個') + '"><button type="button" class="sbtn pri" disabled>' + loc('dash.compare', '比較') + '</button></span>')
            + '<button type="button" class="sbtn" data-cmpclear' + (n ? '' : ' tabindex="-1"') + '>' + loc('dash.clear', '清除') + '</button>';
    }
    function selbarHtml() {
        return '<div class="selbar" id="selbar" role="region" aria-label="' + loc('dash.checkedSessionsToCompare', '比較勾選的 session') + '"' + (LS.picked.length ? ' data-on' : ' aria-hidden="true"') + '>'
            + selbarInner() + '</div>';
    }
    function listPage() {
        // A gone registry has no rows to lay out, so the note replaces the table
        // rather than sitting above it and pushing the list off the bottom.
        var head = '<div class="phead"><h1>' + icon('list') + loc('dash.listHeading', '清單') + '</h1><span class="chip" id="cnt"></span><span class="spacer"></span>';
        var gone = goneNote(f.project);
        var now = '<a class="ctl" href="#/live">' + icon('now') + loc('dash.now', '現在') + '</a></div>' + subtabsHtml('list');
        if (gone) return head + now + facetsHtml() + gone;
        return head + now + selbarHtml() + facetsHtml() + registryNote(f.project)
            + '<div class="listwrap">'
            + '<div class="card listcard"><div class="scroll"><table>'
            + '<colgroup><col style="width:34px"><col><col style="width:130px"><col style="width:80px">'
            + '<col style="width:78px"><col style="width:170px"><col style="width:86px">'
            + '<col style="width:92px"></colgroup>'
            + '<thead id="lh"></thead><tbody id="lb"></tbody></table></div></div>'
            + '<div class="card det" id="det"></div></div>';
    }
    function drawList() {
        // The gone-registry branch of listPage() renders no table.
        if (!doc.getElementById('lb')) return;
        var R = rows().sort(function (a, b) {
            var x = val(a, LS.sortKey), y = val(b, LS.sortKey);
            if (typeof x === 'string' || typeof y === 'string') {
                return LS.sortDir * String(x).localeCompare(String(y));
            }
            return LS.sortDir * ((x || 0) - (y || 0));
        });
        doc.getElementById('cnt').textContent = R.length + ' / ' + S.sessions.length;
        doc.getElementById('lh').innerHTML = '<tr><th class="cmpth" aria-label="' + loc('dash.pickToCompare', '選來比較') + '" title="' + loc('dash.checkTwoToCompare', '勾兩個 session 來比較') + '">' + icon('cmp') + '</th>' + COLS.map(function (c) {
            return '<th data-k="' + c[0] + '"'
                + (['burn', 'cost'].indexOf(c[0]) >= 0 ? ' class="r"' : '')
                + (LS.sortKey === c[0] ? ' data-dir="' + (LS.sortDir > 0 ? 'asc' : 'desc') + '"' : '')
                + '>' + c[1] + '</th>';
        }).join('') + '</tr>';
        doc.getElementById('lb').innerHTML = R.map(function (s) {
            var ask = listAskRow(s, LS.sel);
            return '<tr' + (ask ? ' class="has-ask"' : '') + ' data-id="' + esc(s.id) + '" aria-selected="' + (LS.sel === s.id) + '">'
                + '<td><input type="checkbox" data-cmp="' + esc(s.id) + '" aria-label="' + loc('dash.pickToCompare', '選來比較') + '"'
                + (LS.picked.indexOf(s.id) >= 0 ? ' checked' : '')
                + (s.hasDetail ? '' : ' disabled title="' + loc('dash.noTranscriptToCompare', '沒有 transcript，沒有細節可比') + '"') + '></td>'
                + '<td>' + taskCell(s) + '</td><td>' + stageCell(s) + '</td>'
                + '<td class="r num mute">' + tokens(s.burn) + '</td>'
                + '<td class="r num">' + usd(cost(s), true) + estMark({ estimated: s.estimated && s.estimated.length }) + '</td>'
                + '<td class="c-state">' + statePill(s) + runningTag(s) + '</td>'
                + '<td class="num mute" style="font-size:11.5px">' + day(s.started) + '</td>'
                + '<td class="num mute" style="font-size:11.5px">' + ago(s.updated) + '</td></tr>' + ask;
        }).join('') || '<tr><td colspan="8"><div class="empty">' + loc('dash.noMatchingSessions', '沒有符合的 session') + '</div></td></tr>';
        if (R.length && !R.some(function (s) { return s.id === LS.sel; })) LS.sel = R[0].id;
        drawDetail();
    }

    // A registry-level bulk clear, beside its card's heading rather than a
    // row: counts how many of the rows handed to it are stale and, offline,
    // prints the same kind of copyable command each per-row control prints —
    // a static page cannot post either.
    function clearStaleControl(reg, rows) {
        var n = 0, i;
        for (i = 0; i < rows.length; i++) if (rows[i].state === 'stale') n++;
        if (!n) return '';
        if (!S.serve) {
            return '<code class="mono">node ' + esc(S.plugin || '<plugin>')
                + '/scripts/task.js clear &lt;id&gt;</code>';
        }
        return '<form method="post" action="/clear-stale">'
            + '<input type="hidden" name="nonce" value="' + esc(S.nonce || '') + '">'
            + '<input type="hidden" name="root" value="' + esc(reg.root) + '">'
            + '<button type="submit">clear ' + n + ' stale</button></form>';
    }
    // The clear control is the one place the served page and the written file
    // differ, and both forms come out of the data rather than out of two
    // renderers: `serve` is true only when a server produced this data file, and
    // `nonce` is the token that server will check. A file on disk has neither,
    // so it prints the command instead.
    function clearControl(s) {
        if (s.state !== 'stale') return '';
        if (S.serve) {
            return '<form class="clearform" method="post" action="/clear">'
                + '<input type="hidden" name="root" value="' + esc(s.root) + '">'
                + '<input type="hidden" name="id" value="' + esc(s.id) + '">'
                + '<input type="hidden" name="nonce" value="' + esc(S.nonce || '') + '">'
                + '<label><input type="checkbox" name="force" value="1"> force</label>'
                + '<button class="ctl" type="submit">clear</button></form>';
        }
        return '<div class="claims" style="margin-top:14px">node '
            + esc(S.plugin || '<plugin>') + '/scripts/task.js clear ' + esc(s.id)
            + ' --root "' + esc(s.root) + '" --session &lt;your session id&gt;</div>';
    }
    function drawDetail() {
        var d = doc.getElementById('det');
        if (!d) return;
        var hit = S.sessions.filter(function (x) { return x.id === LS.sel; });
        if (!hit.length) {
            claimsKeep(d); view.claimsFor = null;
            d.innerHTML = '<div class="empty">' + loc('dash.pickARow', '選一列') + '</div>';
            return;
        }
        var s = hit[0];
        needDetail(s);
        var open = openSections(s);
        var x = DETAIL[s.id] || null;
        var tot = s.stages.reduce(function (n, w) {
            return n + Math.max(w.to - w.from, 0);
        }, 0) || 1;
        claimsKeep(d);
        d.innerHTML = '<div class="cbody" style="padding-top:16px">'
            + '<div style="display:flex;gap:7px;align-items:center;margin-bottom:10px;'
            + 'flex-wrap:wrap">' + statePill(s)
            + '<span class="chip" title="' + esc(s.root) + '">' + esc(LAB[s.root])
            + '</span>'
            + (s.model ? '<span class="chip mono">'
                + esc(s.model.replace(/^claude-/, '')) + '</span>' : '') + '</div>'
            + '<h2 style="font-size:15px;line-height:1.45;margin-bottom:12px">'
            + esc(s.task || loc('dash.unnamed', '（未命名）')) + '</h2>'
            + recordHtml(s)
            + secOpen('s-sum', loc('dash.summary', '摘要'), esc(s.stage || '—') + ' · ' + mins(tot)
                + (x ? ' · ' + x.requests + ' requests' : ''), open)
            + (s.stages.length
                ? '<div class="strip">' + s.stages.map(function (w) {
                    var p = Math.max(w.to - w.from, 0) / tot * 100;
                    return '<div style="width:' + p + '%;background:'
                        + (STAGE_C[w.stage] || '#888') + '" title="' + esc(w.stage) + ' · '
                        + mins(w.to - w.from) + '">'
                        + (p > 11 ? esc(w.stage.slice(0, 5)) : '') + '</div>';
                }).join('') + '</div>'
                + '<table style="margin-top:10px"><colgroup><col><col style="width:56px">'
                + '<col style="width:58px"><col style="width:56px"></colgroup>'
                + '<thead><tr><th>' + loc('dash.thStage', '階段') + '</th><th class="r">' + loc('dash.thTime', '時間') + '</th><th class="r">ctx</th>'
                + '<th class="r">' + loc('dash.thWaitedOnYou', '等你') + '</th></tr></thead><tbody>'
                + s.stages.map(function (w) {
                    return '<tr><td><i class="dot" style="background:'
                        + (STAGE_C[w.stage] || '#888') + '"></i> ' + esc(w.stage) + '</td>'
                        + '<td class="r num">' + mins(w.to - w.from) + '</td>'
                        + '<td class="r num mute">' + tokens(w.burn) + '</td>'
                        + '<td class="r num mute">' + mins(w.waited) + '</td></tr>';
                }).join('') + '</tbody></table>'
                : '<p class="mute" style="font-size:12px">' + loc('dash.noStageRecord', '沒有分階段紀錄') + '</p>')
            + (s.next ? '<div class="note"><b>' + loc('dash.nextStep', '下一步') + '</b><br>' + esc(s.next) + '</div>' : '')
            + (s.notes.length
                ? '<div class="note" style="background:var(--soft)">'
                + s.notes.map(esc).join('<br>') + '</div>' : '')
            + '<dl class="dl"><dt>session</dt><dd class="mono" style="font-size:10.5px">'
            + esc(s.id) + '</dd>'
            + '<dt>route</dt><dd class="mono" style="font-size:11px">'
            + esc(s.route.join(' → ')) + '</dd>'
            + '<dt>' + loc('dash.started', '開始') + '</dt><dd class="num">' + stamp(Date.parse(s.started)) + '</dd>'
            + '<dt>' + loc('dash.last', '最後') + '</dt><dd class="num">' + stamp(s.updated) + '</dd>'
            + (s.ended ? '<dt>' + loc('dash.ended', '結束') + '</dt><dd>' + esc(s.ended.reason) + '</dd>' : '')
            + '<dt>' + loc('dash.total', '總計') + '</dt><dd class="num">' + tokens(s.burn) + ' · ' + usd(cost(s))
            + totalSuffix(s)
            + (s.agents ? ' · ' + s.agents + ' agents' : '') + '</dd>'
            + (x ? '<dt>requests</dt><dd class="num">' + x.requests + '</dd>' : '')
            + '<dt>guard</dt><dd>' + esc(s.guard || loc('dash.askDefault', 'ask (預設)')) + '</dd></dl>'
            + '</details>'
            + secOpen('s-claims', 'claims', loc('dash.nFiles', '{n} 個檔', { n: s.claims.length }), open)
            + (s.claims.length
                ? '<div class="claims">' + s.claims.map(function (p) {
                    return '<div title="' + esc(p) + '">' + esc(p) + '</div>';
                }).join('') + '</div>'
                : '<p class="mute" style="font-size:12px">' + loc('dash.none2', '沒有') + '</p>')
            + seenHtml(s.seen) + clearControl(s) + '</details>'
            + (x ? detailSections(s, x, open) : detailNote(s))
            + '</div>';
        claimsPut(d, s.id);
    }
    // A dragged .claims height lives on the element's inline style, which the
    // repaint above replaces; view.claimsH maps session id -> heights by
    // position, so each session keeps its own. view.claimsFor is the session
    // the DOM in #det was drawn for: only that DOM is read back, and it is
    // saved under that session, so A's drag survives a switch to B and back.
    function claimsKeep(d) {
        var f = view.claimsFor;
        if (!f) return;
        var h = [], any = false;
        var els = d.querySelectorAll ? d.querySelectorAll('.claims') : [];
        // no element in the DOM means no height was reset: keep what is saved
        if (!els.length) return;
        Array.prototype.forEach.call(els, function (el) {
            h.push(el.style.height || ''); if (el.style.height) any = true;
        });
        view.claimsH = view.claimsH || {};
        if (any) view.claimsH[f] = h; else delete view.claimsH[f];
    }
    function claimsPut(d, id) {
        view.claimsFor = id;
        var k = view.claimsH && view.claimsH[id];
        if (!k || !d.querySelectorAll) return;
        Array.prototype.forEach.call(d.querySelectorAll('.claims'), function (el, i) { if (k[i]) el.style.height = k[i]; });
    }
    // The scan-time clauses were the old header's `depth stopped the scan in N
    // places` and `the scan ran out of time` — both are how a reader learns
    // the registry list may be incomplete. The unreadable-count clause is
    // separate: it is the total across every registry, and is hidden only on
    // 清單 once a registry there is selected, because `registryNote()`
    // already puts that registry's own count on the card in front of the
    // list — a corrupt-entry count must not require a click to find, so it
    // stays here everywhere else: home, session and the project page, whose
    // own card never hides it either.
    function genText() {
        var totalUnreadable = S.projects.reduce(function (n, p) {
            return n + (p.unreadable || 0);
        }, 0);
        return loc('dash.scannedAt', '掃描於 {t}', { t: stamp(NOW) })
            + loc('dash.pricesVerified', ' · 價目表 {t}', { t: S.pricesVerified })
            + (S.scanStats && S.scanStats.depthCuts
                ? loc('dash.depthCutScanAt', ' · depth 中止掃描 {n} 處', { n: S.scanStats.depthCuts }) : '')
            + (S.scanStats && S.scanStats.timedOut ? loc('dash.scanTimedOut', ' · 掃描逾時未跑完') : '')
            + (!(route.view === 'list' && f.project) && totalUnreadable
                ? loc('dash.nSessionFilesUnreadable', ' · {n} 個 session 檔案讀不到', { n: totalUnreadable }) : '')
            + (S.serve ? loc('dash.rereadEvery3s', ' · 每 3 秒重讀一次，最後一次 {t}', { t: clockSec(polledAt) }) : '');
    }
    // ---- the detail panel — pure bodies in assets/station/detail-html.js (FK_DETAIL) --
    var DETAILH_;
    function DETAILH() {
        return DETAILH_ || (DETAILH_ = mod('FK_DETAIL', 'detail-html.js').make({
            loc: loc, esc: esc, tokens: tokens, stamp: stamp, mins: mins, family: family, sumLoops: sumLoops,
            todoSpot: todoSpot, riseTodo: riseTodo, backTodo: backTodo, STAGE_C: STAGE_C
        }));
    }
    function estMark() { return DETAILH().estMark.apply(null, arguments); }
    function totalSuffix() { return DETAILH().totalSuffix.apply(null, arguments); }
    function secOpen() { return DETAILH().secOpen.apply(null, arguments); }
    function seenHtml() { return DETAILH().seenHtml.apply(null, arguments); }
    function sec() { return DETAILH().sec.apply(null, arguments); }
    function comma() { return DETAILH().comma.apply(null, arguments); }
    function niceStep() { return DETAILH().niceStep.apply(null, arguments); }
    function downsample() { return DETAILH().downsample.apply(null, arguments); }
    function lineChart() { return DETAILH().lineChart.apply(null, arguments); }
    function riseText() { return DETAILH().riseText.apply(null, arguments); }
    function ctxSection() { return DETAILH().ctxSection.apply(null, arguments); }
    function seqHtml() { return DETAILH().seqHtml.apply(null, arguments); }
    function orderSection() { return DETAILH().orderSection.apply(null, arguments); }
    function splitCount() { return DETAILH().splitCount.apply(null, arguments); }
    function splitHtml() { return DETAILH().splitHtml.apply(null, arguments); }
    function cents() { return DETAILH().cents.apply(null, arguments); }
    function dur() { return DETAILH().dur.apply(null, arguments); }
    function taskCount() { return DETAILH().taskCount.apply(null, arguments); }
    function tasksHtml() { return DETAILH().tasksHtml.apply(null, arguments); }
    function planNewest() { return DETAILH().planNewest.apply(null, arguments); }
    function planRel() { return DETAILH().planRel.apply(null, arguments); }
    function planLit() { return DETAILH().planLit.apply(null, arguments); }
    function planTabHtml() { return DETAILH().planTabHtml.apply(null, arguments); }
    // One session's detail is a script of its own, `station/detail/<id>.js`,
    // loaded the first time the session is opened: `lib/station.js` keeps it
    // out of `station-data.js`, which every `/fankeel` prompt rewrites.
    var DETAIL = LS.details;
    function needDetail(s) {
        LS.need(s, function () {
            if (route.view === 'cmp' || (route.view === 'session' && route.id === s.id)) draw();
            else if (LS.sel === s.id) drawDetail();
        });
    }
    function detailNote(s) {
        return '<p class="tally">' + (!s.hasDetail
            ? loc('det.noTranscriptOnMachine', '這台機器的 config dir 裡沒有這個 session 的 transcript，所以沒有 context、階段順序、派工與過程還原')
            : LS.status(s.id) === 'failed' ? loc('det.detailFileUnreadable', '細節檔讀不到：station/detail/{id}.js', { id: esc(s.id) })
                : loc('det.loadingDetail', '讀取細節…')) + '</p>';
    }
    function detailSections(s, x, open) {
        return sec('s-ctx', 'context', loc('det.peakNRequests', '{peak} 峰值 · {n} requests', { peak: tokens(x.peak), n: x.requests }), ctxSection(s, x), open)
            + sec('s-order', loc('det.stageOrder', '階段順序'), loc('det.stepsBacktracks', '{n} 步 · 倒退 {b}', { n: x.seq.length, b: x.backtracks }), orderSection(s, x), open)
            + sec('s-split', loc('det.split', '分工'), splitCount(x), splitHtml(x), open)
            + sec('s-tasks', loc('det.tasks', '任務'), taskCount(x.tasks), tasksHtml(x.tasks), open)
            + sec('s-disp', loc('det.dispatch', '派工'), loc('det.nAgentsCents', '{n} 個 agent · {c}', { n: x.rows.length, c: cents(x.agentCents) + estMark({ estimated: estOf(x.rows) }) }), dispatchHtml(x, s, dispatchUi(s)), open)
            + sec('s-rp', loc('det.replay', '過程還原'), loc('det.nRows', '{n} 列', { n: x.events.length }), replayHtml(x, view.kinds, s), open);
    }

    // Which sections start open. A live session is watched for who is in which
    // file; an ended one is reviewed for what it cost. The replay starts closed
    // whatever the state: it is the longest section and the last one read.
    function openSections(s) {
        return s && s.state === 'live' ? ['s-sum', 's-claims', 's-split'] : ['s-ctx', 's-disp', 's-split'];
    }
    // The tab as the session page draws it: the lit task carried across a
    // redraw (`planAt`), and the hover, focus and Esc listeners added on the
    // first draw rather than at load — tests/station-hdl-c.test.js presses the
    // page's load-time listeners by their place in the order they were added.
    var planAt = null;
    var planHeard = false;
    function planTab(s, x) {
        planListen();
        return planTabHtml(s, x.tasks, planAt);
    }
    // Lights Task `f`'s neighbours on the drawn tab, or clears them for null,
    // without a redraw: a redraw would take the keyboard focus with it.
    function planFocus(f) {
        planAt = f === null || f === undefined ? null : Number(f);
        var grid = doc && doc.querySelector ? doc.querySelector('.pv-groups') : null;
        if (!grid) return;
        var x = route.view === 'session' ? DETAIL[route.id] : null;
        var p = x ? planNewest(x.tasks) : null;
        var r = p && planAt !== null ? planRel(p, planAt) : null;
        [].forEach.call(grid.querySelectorAll('.pv-card'), function (c) {
            c.classList.remove('is-focus', 'is-pre', 'is-post', 'is-dim', 'files', 'read', 'interface', 'undeclared');
            var old = c.querySelector('.pv-tag');
            if (old) old.parentNode.removeChild(old);
            [].forEach.call(c.querySelectorAll('.pv-dep.is-hit'), function (d) { d.classList.remove('is-hit'); });
            var lit = planLit(r, Number(c.getAttribute('data-n')), planAt);
            if (!lit) return;
            lit.cls.split(' ').forEach(function (k) { c.classList.add(k); });
            if (lit.hit) [].forEach.call(c.querySelectorAll('.pv-dep[data-from="' + planAt + '"]'), function (d) { d.classList.add('is-hit'); });
            if (lit.tag === null) return;
            var tag = doc.createElement('p');
            tag.className = 'pv-tag';
            tag.innerHTML = lit.tag;
            c.insertBefore(tag, c.firstChild);
        });
    }
    function planListen() {
        if (planHeard || !doc || !doc.addEventListener) return;
        planHeard = true;
        var near = function (e, sel) { return e && e.target && e.target.closest ? e.target.closest(sel) : null; };
        var on = function (e) {
            var c = near(e, '.pv-card');
            if (c && Number(c.getAttribute('data-n')) !== planAt) planFocus(c.getAttribute('data-n'));
        };
        doc.addEventListener('mouseover', on);
        doc.addEventListener('focusin', on);
        // Leaving the columns clears, unless a card in them holds the keyboard focus.
        doc.addEventListener('mouseout', function (e) {
            var g = near(e, '.pv-groups');
            if (!g || (e.relatedTarget && g.contains(e.relatedTarget)) || g.contains(doc.activeElement)) return;
            planFocus(null);
        });
        doc.addEventListener('focusout', function (e) {
            var g = near(e, '.pv-groups');
            if (g && !(e.relatedTarget && g.contains(e.relatedTarget))) planFocus(null);
        });
        doc.addEventListener('keydown', function (e) {
            if (!e || e.key !== 'Escape' || planAt === null) return;
            var a = doc.activeElement;
            planFocus(null);
            if (a && a.closest && a.closest('.pv-card') && a.blur) a.blur();
        });
    }
    if (typeof module !== 'undefined' && module.exports) module.exports.planTab = planTab;
    // ---- 關卡: the gate tab — assets/station/gate-tab.js (FK_GATEVIEW) --------
    var GATEV_;
    function GATEV() {
        return GATEV_ || (GATEV_ = mod('FK_GATEVIEW', 'gate-tab.js').make({
            loc: loc, esc: esc, family: family, mins: mins, icon: icon, recLabel: recLabel, recTitle: recTitle,
            planNewest: planNewest, w: w, S: function () { return S; }
        }));
    }
    function gateAt() { return GATEV().gateAt.apply(null, arguments); }
    function gateTabHtml() { return GATEV().gateTabHtml.apply(null, arguments); }
    function gateTab() { return GATEV().gateTab.apply(null, arguments); }
    // ---- 派工, replay and 記成 TODO — assets/station/dispatch-table.js (FK_DISPATCH) --
    var DISP_;
    function DISP() {
        return DISP_ || (DISP_ = mod('FK_DISPATCH', 'dispatch-table.js').make({
            loc: loc, esc: esc, dur: dur, comma: comma, cents: cents, tokens: tokens, tk: tk, clockSec: clockSec,
            clock: clock, stamp: stamp, segHtml: segHtml, estMark: estMark, family: family, MODEL_KEYS: MODEL_KEYS,
            STAGE_C: STAGE_C, usd: usd, mins: mins, S: function () { return S; }
        }));
    }
    function estOf() { return DISP().estOf.apply(null, arguments); }
    function agentState() { return DISP().agentState.apply(null, arguments); }
    function agentCounts() { return DISP().agentCounts.apply(null, arguments); }
    function dispatchHtml() { return DISP().dispatchHtml.apply(null, arguments); }
    function segmentsOf() { return DISP().segmentsOf.apply(null, arguments); }
    function took() { return DISP().took.apply(null, arguments); }
    function replayHtml() { return DISP().replayHtml.apply(null, arguments); }
    function todoEntry() { return DISP().todoEntry.apply(null, arguments); }
    function riseTodo() { return DISP().riseTodo.apply(null, arguments); }
    function backTodo() { return DISP().backTodo.apply(null, arguments); }
    function todoSpot() { return DISP().todoSpot.apply(null, arguments); }

    // ---- 比較 ----------------------------------------------------------------

    function pageTitle(r) {
        var v = navOn(r && r.view), hit = '';
        NAV_TREE.forEach(function (g) {
            if (g.v === v) hit = hit || g.label;
            // A group with one page is that page: 設定, not its only kid 精靈.
            (g.kids || []).forEach(function (k) { if (k[0] === v) hit = hit || (g.kids.length === 1 ? g.label : k[2]); });
        });
        return hit || NAV_TREE[0].label;
    }
    if (typeof module !== 'undefined' && module.exports) module.exports.pageTitle = pageTitle;
    function drawSide() {
        doc.getElementById('side').innerHTML = '<h1 class="ptitle">' + esc(pageTitle(route)) + '</h1>';
    }
    // 近 30 天 is FK_DAYS (assets/station/days-page.js): it keeps the chart's
    // hover, legend and 篩選 state; this file hands it the helpers each call.
    function daysCtx() {
        // route is reassigned by draw(); a getter keeps a late callback reading the live one.
        return { S: S, view: view, get route() { return route; }, NOW: NOW, DAYS: DAYS, PREV: PREV, TODAY: TODAY, frozenAt: frozenAt, draw: draw,
            H: { homeRows: homeRows, homeOpts: homeOpts, dayBars: dayBars, visibleBars: visibleBars, histSvg: histSvg, legendHtml: legendHtml,
                filterHtml: filterHtml, windowTotals: windowTotals, kpiHtml: kpiHtml, segHtml: segHtml, subtabsHtml: subtabsHtml, icon: icon,
                heroEyebrow: heroEyebrow, loc: loc, DIM_LABEL: DIM_LABEL, NO_TIME_TYPE: NO_TIME_TYPE, dashByProj: dashByProj,
                dashTokens7: dashTokens7, dashModels: dashModels, segTip: segTip, legendRest: legendRest } };
    }
    if (typeof module !== 'undefined' && module.exports) module.exports.daysCtx = daysCtx;
    VIEWS.days = function (r) { return w.FK_DAYS.page(r, daysCtx()); };
    doc.addEventListener('mousemove', function (e) { if (route.view === 'days' && w.FK_DAYS) w.FK_DAYS.onMove(e, daysCtx()); });
    // 文件 is FK_DOCS (assets/station/docs-page.js): the docs-health matrix,
    // its findings, the reader and the project dialog (station-38).
    VIEWS.docs = function (r) { return w.FK_DOCS.page(S, modOpts({ pkeys: PKEYS })); };
    // 週報 is FK_WEEKLY (assets/station/weekly-page.js): the copy button for
    // /fankeel-weekly and the archive under <configDir>/fankeel/weekly/.
    VIEWS.weekly = function (r) { return w.FK_WEEKLY.page(S, modOpts()); };
    VIEWS.tour = function () { return tourPage(Boolean(S.serve)); };
    VIEWS.list = listPage;
    // 設定 is FK_SETTINGS (assets/station/settings-page.js, 快速設定), which
    // hands #/settings/detail[/<step>] to FK_SETDETAIL itself; parseHash sends
    // every #/settings/… hash here (station-39).
    VIEWS.settings = function (r) { return w.FK_SETTINGS.page(S, modOpts({ hash: String(w.location.hash || ''), nonce: S.nonce, plugin: S.plugin, configDir: S.configDir })); };
    // The redesigned pages (station redesign §1–§4) are modules the shell
    // loads before this file; each is handed the station and what this file
    // derives from it. 計畫, 事件 and 關卡 stay on the session page this file
    // still draws (sessionPage), as does a session only the 花費 page knows.
    function modOpts(extra) {
        return Object.assign({ names: NAMES, now: S.serve ? Date.now() : NOW, serve: Boolean(S.serve), redraw: draw, clear: clearControl }, extra);
    }
    VIEWS.now = function (r) { return w.FK_LIVE.page(S, modOpts()); };
    VIEWS.live = function (r) { return w.FK_LIVE.page(S, modOpts()); };
    VIEWS.sessions = function (r) { return w.FK_SESSIONS.page(S, modOpts({ tray: false })); };
    // 比較 lands on the list with its compare tray, so it is never an empty page.
    VIEWS.cmp = function (r) { return w.FK_SESSIONS.page(S, modOpts({ tray: true })); };
    VIEWS.projects = function (r) { return w.FK_PROJECTS.page(S, modOpts({ hash: String(w.location.hash || '') })); };
    VIEWS.project = function (r) { return w.FK_PROJECT.page(S, r.pkey, modOpts({ todo: r.todo })); };
    var SESSION_TABS = ['timeline', 'cost', 'dispatch', 'talk'];
    VIEWS.session = function (r) {
        var s = S.sessions.filter(function (x) { return x.id === r.id; })[0];
        if (!s || SESSION_TABS.indexOf(r.tab) < 0) return sessionPage(r);
        needDetail(s);
        var tab = r.tab === 'cost' ? 'timeline' : r.tab, talk;
        if (tab === 'talk') {
            if (S.serve && !TALK[s.id]) talkLoad(s.id, true);
            talk = S.serve ? TALK[s.id] : { turns: [], total: null, state: 'static' };
        }
        return w.FK_SESSION.page(s, DETAIL[s.id] || null, modOpts({ tab: tab, talk: talk }));
    };
    var drawnHash = null;
    var drawnParts = null;
    // The page's top-level elements as markup, or null where this document
    // cannot parse a fragment (the test harness's fake DOM) or the view put
    // bare text at the top level — both mean draw it whole.
    function partsOf(html) {
        var t = doc.createElement('template');
        if (!t || !t.content || !t.content.children) return null;
        t.innerHTML = html;
        var loose = [].some.call(t.content.childNodes, function (n) { return n.nodeType === 3 && n.textContent.trim(); });
        return loose ? null : [].map.call(t.content.children, function (c) { return c.outerHTML; });
    }
    var fkRec = null;
    // The poll repaints this every few seconds; a box being typed in or a mic that is listening would
    // lose its place, so only a click (`force`) repaints then.
    function drawFloat(force) {
        var fk = doc.getElementById('fk');
        if (!fk) return;
        var ae = doc.activeElement;
        if (!force && (fkRec || (ae && ae.getAttribute && ae.getAttribute('data-gfree') !== null))) return;
        var held = S.sessions.some(function (s) { return s.pending && s.pending.questions && s.pending.questions.length; });
        if (!held) delete view.pg['fk:shut'];
        var old = doc.getElementById('fkp'), top = old ? old.scrollTop : 0;
        fk.innerHTML = floatHtml(S.sessions, view.notes, view.fkOpen, S.serve ? Date.now() : NOW, view.pg, w.Notification ? w.Notification.permission : 'denied', view.fkBox, view.gone);
        var p = doc.getElementById('fkp'); if (p && top) p.scrollTop = top;
        fk.className = 'fk' + (held ? ' hasgate' : '');
    }
    // Resizing the gate panel by its corner grip. The move/up/cancel listeners sit
    // on the window and pointerdown on the document, not on #fkp, because drawFloat
    // rebuilds #fkp every repaint; the size lives in view.fkBox, which pointermove
    // and the window resize write, fkDrop stores, and drawFloat passes to floatHtml
    // (which only reads it), so a repaint mid-drag draws it where it is.
    var FK_BOX_KEY = 'station.fkBox';
    var fkDrag = null;
    function fkFit(b) {
        var vw = w.innerWidth, vh = w.innerHeight;
        return vw && vh ? fkBoxClamp(b, vw, vh) : b;
    }
    view.fkBox = fkFit(fkBoxParse(stored(FK_BOX_KEY)));
    // Editing rows the reader dismissed with × (station-50), kept across
    // reloads; the request itself is settled by `tune.js drop` or its 24-hour
    // expiry (lib/tune.js statusOf), not by this.
    var FK_GONE_KEY = 'station.fkGone';
    view.gone = goneParse(stored(FK_GONE_KEY));
    function goneSave() { store(FK_GONE_KEY, JSON.stringify(goneKeys(view.gone))); }
    function fkApply() {
        var p = doc.getElementById('fkp'), b = view.fkBox;
        if (!p || !b) return;
        p.style.width = Math.round(b.w) + 'px';
        p.style.height = Math.round(b.h) + 'px';
    }
    doc.addEventListener('pointerdown', function (e) {
        var t = e.target;
        if (e.button || !t || !t.closest || !t.closest('#fk [data-fk-resize]')) return;
        var p = doc.getElementById('fkp');
        if (!p) return;
        var r = p.getBoundingClientRect();
        fkDrag = { sx: e.clientX, sy: e.clientY, box: { w: r.width, h: r.height } };
        e.preventDefault();
    });
    w.addEventListener('pointermove', function (e) {
        if (!fkDrag) return;
        var b = fkDrag.box;
        view.fkBox = fkFit({ w: b.w - (e.clientX - fkDrag.sx), h: b.h + e.clientY - fkDrag.sy });
        fkApply();
    });
    function fkDrop() {
        if (!fkDrag) return;
        fkDrag = null;
        if (view.fkBox) store(FK_BOX_KEY, JSON.stringify(view.fkBox));
    }
    w.addEventListener('pointerup', fkDrop);
    w.addEventListener('pointercancel', fkDrop);
    w.addEventListener('resize', function () {
        if (!view.fkBox) return;
        view.fkBox = fkFit(view.fkBox);
        fkApply();
    });
    // Close the panel, also when a held gate would keep it open: `fk:shut` stands until the gate is gone.
    function fkClose() {
        var heldNow = S.sessions.some(function (s) { return s.pending && s.pending.questions && s.pending.questions.length; });
        if (view.fkOpen) view.notes = readAll(view.notes);
        view.fkOpen = false;
        if (heldNow) view.pg['fk:shut'] = true;
        drawFloat(true);
    }
    // Voice fills the box and never sends. The same approach as assets/station/mobile.js `listen`.
    function fkListen(btn, box, say) {
        var SR = w.SpeechRecognition || w.webkitSpeechRecognition;
        if (!SR || !box) return null;
        var base = box.value ? box.value.replace(/\s*$/, ' ') : '', failed = false, rec = new SR();
        rec.lang = 'zh-TW';
        rec.interimResults = true;
        rec.continuous = true;
        btn.classList.add('on');
        btn.setAttribute('aria-pressed', 'true');
        say(loc('cmp.micOn', '聆聽中… 再按一次停止'), true);
        rec.onresult = function (e) {
            var fin = '', mid = '';
            for (var i = 0; i < e.results.length; i++) {
                if (e.results[i].isFinal) fin += e.results[i][0].transcript; else mid += e.results[i][0].transcript;
            }
            box.value = base + fin + mid;
            box.classList.toggle('interim', Boolean(mid));
            if (w.Event) box.dispatchEvent(new w.Event('input', { bubbles: true }));
        };
        rec.onerror = function (e) {
            failed = true;
            say(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? loc('cmp.micDenied', '沒有麥克風權限：到瀏覽器設定允許') : loc('cmp.micMissed', '沒聽清楚：再按一次麥克風'), false);
        };
        rec.onend = function () {
            btn.classList.remove('on');
            btn.setAttribute('aria-pressed', 'false');
            box.classList.remove('interim');
            if (!failed) say(box.value.trim() ? loc('cmp.micDone', '聽好了：可以改字，按送出才會送') : '', false);
            fkRec = null;
        };
        rec.start();
        return rec;
    }
    doc.addEventListener('input', function (e) {
        var t = e.target && e.target.closest ? e.target.closest('#fk [data-gfree]') : null;
        if (!t) return;
        view.pg[t.getAttribute('data-gfree') + ':free'] = t.value;
        var b = t.closest('.gc').querySelector('[data-gfs]');
        if (b) b.disabled = !t.value.trim();
    });
    var fkSheetY = null;
    doc.addEventListener('pointerdown', function (e) {
        if (e.target && e.target.closest && e.target.closest('#fk [data-fkg]')) fkSheetY = e.clientY;
    });
    w.addEventListener('pointerup', function (e) {
        var down = fkSheetY;
        fkSheetY = null;
        if (down !== null && e.clientY - down > 60) fkClose();
    });
    // The hash a `#/p/<pkey>/todo[/<id>]` arrived with, until its TODO panel or
    // entry is scrolled into view; null once it is. Tried after every draw, since
    // the panel can come with a later data read; a hash the reader has left is
    // not chased.
    var focusFor = w.location.hash;
    function focusTodo() {
        if (focusFor !== w.location.hash || route.view !== 'project' || route.todo === undefined) return;
        var to = (route.todo && doc.getElementById('todo-' + route.todo)) || doc.getElementById('todo');
        if (!to) return;
        focusFor = null;
        to.scrollIntoView({ block: 'start' });
    }
    function draw() {
        route = parseHash(w.location.hash);
        if (route.view === 'project') route.pkey = knownPkey(route.pkey, S.sessions);
        var p = doc.getElementById('page');
        p.className = 'page' + (route.view === 'list' ? ' fixed' : '');
        // A 篩選 checkbox with focus keeps it through the 3 s redraw.
        var fkAt = doc.activeElement && doc.activeElement.getAttribute ? doc.activeElement.getAttribute('data-fk') : null;
        // So does how far the days legend strip was scrolled.
        var STRIPS = '.lstrip .legend', stripKey = function () { return 'legend'; };
        var scrolled = {};
        if (doc.querySelectorAll && route.view === 'days') {
            [].forEach.call(doc.querySelectorAll(STRIPS), function (el) { if (el.scrollLeft) scrolled[stripKey(el)] = el.scrollLeft; });
        }
        // And an open facet popover keeps its focused row or search caret
        // and how far its list was scrolled.
        var rAct = pickOpen && doc.activeElement && doc.activeElement.closest ? doc.activeElement.closest('.rpop [data-v], .rpop [data-pickq]') : null;
        var rAt = rAct ? (rAct.hasAttribute('data-pickq') ? { q: rAct.selectionStart } : { v: rAct.getAttribute('data-v') }) : null;
        var rPop = pickOpen && doc.querySelector ? doc.querySelector('.rpop .seg') : null, rTop = rPop ? rPop.scrollTop : 0;
        // A <details> the reader opened or shut stays that way through a
        // redraw of the same page, found again by its id, data-key or data-block.
        var DETS = 'details[id],details[data-key],details[data-block]';
        var detKey = function (d) { return d.id || d.getAttribute('data-key') || d.getAttribute('data-block'); };
        var dets = {}, samePage = w.location.hash === drawnHash;
        if (samePage && doc.querySelectorAll) [].forEach.call(doc.querySelectorAll(DETS), function (d) { dets[detKey(d)] = d.open; });
        drawnHash = w.location.hash;
        var html = (VIEWS[route.view] || VIEWS.now)(route);
        var parts = partsOf(html);
        var changed = samePage && parts ? changedParts(drawnParts, parts) : null;
        if (changed && p.children && p.children.length === parts.length) {
            changed.forEach(function (i) {
                var t = doc.createElement('template');
                t.innerHTML = parts[i];
                p.replaceChild(t.content.firstElementChild, p.children[i]);
            });
        } else {
            p.innerHTML = html;
        }
        drawnParts = parts;
        if (samePage && doc.querySelectorAll) {
            [].forEach.call(doc.querySelectorAll(DETS), function (d) {
                var k = detKey(d);
                if (Object.prototype.hasOwnProperty.call(dets, k)) d.open = dets[k];
            });
        }
        if (rTop && (rPop = doc.querySelector('.rpop .seg'))) rPop.scrollTop = rTop;
        if (rAt && rAt.v !== undefined) pickFocus(rAt.v);
        if (rAt && rAt.q !== undefined) {
            var rq = doc.querySelector('.rpop [data-pickq]');
            if (rq) { rq.focus(); try { rq.setSelectionRange(rAt.q, rAt.q); } catch (err) { /* not a text box */ } }
        }
        if (Object.keys(scrolled).length) {
            [].forEach.call(doc.querySelectorAll(STRIPS), function (el) { if (scrolled[stripKey(el)]) el.scrollLeft = scrolled[stripKey(el)]; });
        }
        if (fkAt !== null) { var fkEl = doc.querySelector('.fpanel [data-fk="' + cssKey(fkAt) + '"]'); if (fkEl) fkEl.focus(); }
        if (route.view === 'list') drawList();
        // A redraw (the 3 s re-read too) replaces the chart under a live hover:
        // on 近 30 天 the hover is put back from the new bars, anywhere else it goes.
        var D = w.FK_DAYS;
        if (D && D.hovering() && route.view === 'days') D.restore();
        else if (D && D.hovering()) D.hide();
        else if (D && route.view === 'days') D.focusPin();
        if (D && route.view === 'days') D.arm();
        drawFloat();
        drawNav();
        drawSide();
        doc.getElementById('gen').textContent = genText();
        focusTodo();
    }
    // The bar: whole on the first draw, then only `#navlinks`, so the jump
    // box keeps its text and caret through the 3 s redraw.
    var navDrawn = false;
    function drawNav() {
        var c = navCounts(homeRows());
        if (navDrawn) doc.getElementById('navlinks').innerHTML = navLinksHtml(route.view, c);
        else { doc.getElementById('nav').innerHTML = navHtml(route.view, c); navDrawn = true; }
        drawTheme();
    }
    // The masthead's theme button: drawn with the bar, and again on its own
    // press. A redraw under the focused button keeps the focus.
    function drawTheme() {
        var box = doc.getElementById('appear');
        if (!box) return;
        var a = doc.activeElement && doc.activeElement.getAttribute ? doc.activeElement : null;
        var had = Boolean(a && a.hasAttribute('data-themecycle'));
        box.innerHTML = themeBtnHtml(stored('station.theme'));
        var back = had && box.querySelector ? box.querySelector('[data-themecycle]') : null;
        if (back) back.focus();
    }
    doc.addEventListener('click', function (e) {
        var n = e.target && e.target.closest ? e.target.closest('[data-jump]') : null;
        var to = n ? doc.getElementById(n.getAttribute('data-jump')) : null;
        if (!to) return;
        if (e.preventDefault) e.preventDefault();
        if (to.scrollIntoView) to.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
    doc.addEventListener('click', function (e) {
        var n = e.target.closest ? e.target.closest('[data-themecycle]') : null;
        if (!n) return;
        var t = n.getAttribute('data-themecycle');
        store('station.theme', t === 'system' ? null : t);
        themeSet(t);
        drawTheme();
    });
    // The jump box: typing lists matches, ↑ ↓ move the mark, Enter opens the
    // marked one, Esc clears; Ctrl K (⌘ K) from anywhere puts the caret in it.
    var jumpOn = 0, jumpList = [];
    function jumpName(s) { return s.project || shortLabel(NAMES[s.pkey] || s.pkey); }
    function jumpDraw() {
        var q = doc.getElementById('jq'), pop = doc.getElementById('jpop');
        if (!q || !pop) return;
        jumpList = jumpHits(S.sessions, q.value, jumpName, 8);
        jumpOn = Math.min(jumpOn, Math.max(jumpList.length - 1, 0));
        var open = Boolean(String(q.value || '').trim());
        pop.innerHTML = open ? jumpListHtml(jumpList, q.value, jumpOn, Boolean(S.serve), jumpName) : '';
        pop.hidden = !open;
        q.setAttribute('aria-expanded', String(open));
    }
    doc.addEventListener('input', function (e) {
        if (!e.target || e.target.id !== 'jq') return;
        jumpOn = 0;
        jumpDraw();
    });
    doc.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'k') {
            var q = doc.getElementById('jq');
            if (!q || !q.focus) return;
            e.preventDefault();
            q.focus();
            if (q.select) q.select();
            return;
        }
        if (!e.target || e.target.id !== 'jq') return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            var n = Math.max(jumpList.length, 1);
            jumpOn = (jumpOn + (e.key === 'ArrowDown' ? 1 : n - 1)) % n;
            jumpDraw();
        } else if (e.key === 'Enter' && jumpList[jumpOn]) {
            e.preventDefault();
            w.location.href = focusHref(jumpList[jumpOn].id, jumpList[jumpOn].stage, Boolean(S.serve));
        } else if (e.key === 'Escape') {
            e.target.value = '';
            jumpDraw();
        }
    });
    doc.addEventListener('click', function (e) {
        var pop = e.target && e.target.closest && !e.target.closest('.jump') ? doc.getElementById('jpop') : null;
        if (pop) pop.hidden = true;
    });
    if (typeof module !== 'undefined' && module.exports) {
        module.exports.jumpHits = jumpHits; module.exports.jumpListHtml = jumpListHtml; module.exports.navLinksHtml = navLinksHtml;
    }
    // 概覽's stage mark. Set from the bar, the table, the timeline or 派工's
    // chips; a second press on the same stage clears it. Keyed to the session
    // so another session's page opens unmarked.
    view.hi = null;
    view.hiId = null;
    function hiToggle(el) {
        var k = el.getAttribute('data-hist'), id = route.id, again = view.hiId === id && view.hi === k;
        view.hi = again ? null : k;
        view.hiId = id;
        var keep = doc.activeElement === el && el.tagName !== 'rect' ? '.' + el.getAttribute('class').split(' ')[0] : null;
        draw();
        var back = keep ? doc.querySelector(keep + '[data-hist="' + cssKey(k) + '"]') : null;
        if (back) back.focus();
    }
    doc.addEventListener('click', function (e) {
        var h = route.view === 'session' && e.target.closest ? e.target.closest('[data-hist]') : null;
        if (h) hiToggle(h);
    });
    doc.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        var h = route.view === 'session' && e.target.closest ? e.target.closest('tr[data-hist]') : null;
        if (!h) return;
        e.preventDefault();
        hiToggle(h);
    });
    // Back, forward and every link on the page arrive here.
    w.addEventListener('hashchange', function () {
        LS.sel = null;
        focusFor = w.location.hash;
        draw();
        if (focusFor !== null) w.scrollTo(0, 0);
    });
    // The 繁中 / EN switch: registered ahead of the click handler below so a
    // harness that keeps only one listener per event type (this file's own
    // node tests among them) still runs the handler those tests exercise.
    doc.addEventListener('click', function (e) {
        var b = e.target && e.target.closest ? e.target.closest('[data-lang]') : null;
        if (!b || !I18N) return;
        var lang = b.getAttribute('data-lang');
        if (!I18N.set(lang)) return;
        // Served, the pick is also the machine profile's ui.lang, which the
        // Pane and the band read and which pick() puts ahead of this browser's
        // choice; the reload waits for the write. A page not served has no
        // server to write to.
        if (!S.serve || typeof fetch !== 'function') { w.location.reload(); return; }
        var form = new URLSearchParams();
        form.set('nonce', S.nonce || '');
        form.set('scope', 'machine');
        form.set('key', 'ui.lang');
        form.set('value', lang);
        // A failed write is not followed by a reload: pick() would read the
        // old machine ui.lang back and the page would show it with no word.
        var failed = function () {
            var n = doc.getElementById('langnote');
            if (!n) {
                n = doc.createElement('div');
                n.id = 'langnote';
                n.setAttribute('role', 'status');
                n.setAttribute('aria-live', 'polite');
                n.className = 'dead';
                (doc.body || doc.documentElement).appendChild(n);
            }
            n.textContent = loc('cmp.langWriteFailed', '語言沒有存成功，沒有切換。');
        };
        fetch('profile', { method: 'POST', body: form }).then(function (res) {
            if (res && res.ok) w.location.reload(); else failed();
        }, failed);
    });
    // The language menu (r-0036): the globe button opens and shuts #langpop;
    // a click anywhere else, or Escape, shuts it. Picking a language is the
    // [data-lang] listener above.
    function langMenu(open) {
        var b = doc.getElementById('langbtn'), pop = doc.getElementById('langpop');
        if (!b || !pop || !b.setAttribute) return;
        b.setAttribute('aria-expanded', String(open));
        pop.hidden = !open;
    }
    doc.addEventListener('click', function (e) {
        var t = e && e.target && e.target.closest ? e.target : null;
        if (t && t.closest('[data-langmenu]')) {
            var b = doc.getElementById('langbtn');
            langMenu(!(b && b.getAttribute && b.getAttribute('aria-expanded') === 'true'));
        } else if (!(t && t.closest('#langpop'))) langMenu(false);
    });
    doc.addEventListener('keydown', function (e) {
        if (e && e.key === 'Escape') langMenu(false);
    });
    doc.addEventListener('click', function (e) {
        // 篩選: the button opens and shuts the panel, a checkbox is one key,
        // 全選/全不選 are every key; a click anywhere else shuts it.
        if (route.view === 'days' && e.target.closest) {
            if (e.target.closest('[data-fbtn]')) { w.FK_DAYS.setPanel(!w.FK_DAYS.panelOpen()); draw(); var fb = doc.querySelector('[data-fbtn]'); if (fb) fb.focus(); return; }
            var fk = e.target.closest('.fpanel [data-fk]');
            if (fk) { w.FK_DAYS.set([fk.getAttribute('data-fk')], fk.checked, '.fpanel [data-fk="' + cssKey(fk.getAttribute('data-fk')) + '"]'); return; }
            var fa = e.target.closest('.fpanel [data-fall]');
            if (fa) { w.FK_DAYS.setAll(fa.getAttribute('data-fall') === 'on', '.fpanel [data-fall="' + fa.getAttribute('data-fall') + '"]'); return; }
            if (w.FK_DAYS.panelOpen() && !e.target.closest('.fwrap')) { w.FK_DAYS.setPanel(false); draw(); }
        }
        var lg = route.view === 'days' && e.target.closest ? e.target.closest('.legend [data-key], .legend [data-rest]') : null;
        if (lg) { w.FK_DAYS.toggle(lg); return; }
        if (e.target.closest('[data-fkb]')) {
            // Opening the panel counts as reading what it shows: the draw lights
            // the unread, the marking after it greys them for the next draw; a
            // close marks what arrived while it was open. Neither redraws.
            var wasOpen = view.fkOpen;
            view.fkOpen = !wasOpen;
            if (view.fkOpen) delete view.pg['fk:shut'];
            if (wasOpen) view.notes = readAll(view.notes);
            drawFloat(true);
            if (!wasOpen) view.notes = readAll(view.notes);
            return;
        }
        var nx = e.target.closest('[data-note-x]');
        if (nx) {
            var gone = dismissNote(view.notes, view.gone, nx.closest('.nt').getAttribute('data-note'));
            view.notes = gone.notes;
            view.gone = gone.gone;
            goneSave();
            drawFloat(true);
            return;
        }
        if (e.target.closest('[data-note-clear]')) {
            var cleared = clearNotes(S.sessions, view.notes, view.gone);
            view.notes = cleared.notes;
            view.gone = cleared.gone;
            goneSave();
            drawFloat(true);
            return;
        }
        if (e.target.closest('[data-fkx]') || e.target.id === 'fk') {
            fkClose();
            return;
        }
        var gmic = e.target.closest('#fk [data-mic]');
        if (gmic) {
            if (fkRec) { fkRec.stop(); return; }
            var gbox = doc.getElementById(gmic.getAttribute('data-mic'));
            var gsay = gmic.closest('.gfree').querySelector('.gsay');
            fkRec = fkListen(gmic, gbox, function (text, on) { if (gsay) { gsay.textContent = text; gsay.className = 'gsay' + (on ? ' on' : ''); } });
            return;
        }
        var gfs = e.target.closest('#fk [data-gfs]');
        if (gfs) {
            var gtext = gfs.closest('.gfree').querySelector('[data-gfree]').value.trim();
            if (!gtext) return;
            gatePost(gfs.closest('.gc'), function (form, who) {
                var q = who.pending.questions[0], a = {};
                a[q.question] = gtext;
                form.set('answers', JSON.stringify(a));
            }, loc('cmp.sentColon', '已送出：'));
            return;
        }
        var gop = e.target.closest('[data-gop]');
        if (gop) {
            gatePost(gop.closest('.gc'), function (form, who) {
                var q = who.pending.questions[0], o = q.options[Number(gop.getAttribute('data-gop'))], a = {};
                a[q.question] = o.label;
                form.set('answers', JSON.stringify(a));
            }, loc('cmp.sentColon', '已送出：'));
            return;
        }
        if (e.target.closest('[data-gho]')) {
            gatePost(e.target.closest('.gc'), function (form) { form.set('handoff', 'terminal'); }, loc('cmp.handedToTerminalColon', '已交給終端：'));
            return;
        }
        if (e.target.closest('[data-tune-notify]') && w.Notification) {
            w.Notification.requestPermission().then(function () { draw(); });
            return;
        }
        // 懸著的 gate: a tick is remembered across the poll's re-read, the
        // count and the button follow it, and 送出答案 posts every answer.
        var pgi = e.target.closest('.pg input[name^="pg-"]');
        if (pgi) {
            var pgb = pgi.closest('.pg');
            pgSync(pgb);
            return;
        }
        var ans = e.target.closest('[data-answer]');
        if (ans) {
            var pg = ans.closest('.pg'), pgr = pg.querySelector('.pgr');
            var who = S.sessions.filter(function (x) { return x.id === pg.getAttribute('data-pg-id'); })[0];
            var read = pgRead(pg, (who && who.pending && who.pending.questions) || []);
            if (read.missing) { pgr.className = 'pgr bad'; pgr.textContent = loc('cmp.stillNQuestionsUnanswered', '還有 {n} 題沒答', { n: read.missing }); return; }
            var answers = read.answers;
            var form = new URLSearchParams();
            form.set('nonce', S.nonce || '');
            form.set('root', pg.getAttribute('data-pg-root'));
            form.set('id', pg.getAttribute('data-pg-id'));
            form.set('answers', JSON.stringify(answers));
            answerPost(pg.getAttribute('data-pg-id'), pg, pgr, 'pgr', form, loc('cmp.sentColon', '已送出：'), loc('cmp.couldNotSendServeRunning', '送不出去：serve 還在跑嗎？'));
            return;
        }
        // 記成 TODO: the server checks the line and answers with the rule it
        // failed, or with the line it wrote.
        var todo = e.target.closest('[data-todo]');
        if (todo) {
            var box = todo.closest('.tdf');
            var said = box.querySelector('.tdr');
            var body = new URLSearchParams();
            body.set('nonce', S.nonce || '');
            body.set('root', box.getAttribute('data-todo-root'));
            body.set('id', box.getAttribute('data-todo-id'));
            body.set('text', box.querySelector('textarea').value);
            body.set('link', box.querySelector('input').value);
            body.set('body', box.querySelector('textarea.tdbd').value);
            fetch('todo', { method: 'POST', body: body }).then(function (r) {
                return r.text().then(function (t) {
                    said.className = 'tdr ' + (r.ok ? 'ok' : 'bad');
                    said.textContent = (r.ok ? loc('cmp.writtenToTodoColon', '記下了：') : r.status + loc('cmp.dashNotWrittenColon', ' — 沒有寫進去：')) + t.trim();
                });
            }, function () {
                said.className = 'tdr bad';
                said.textContent = loc('cmp.couldNotSendServeRunning', '送不出去：serve 還在跑嗎？');
            });
            return;
        }
        // A workflow phase opens into its agents, an agent into its prompt and
        // steps, a prompt in full. Each is remembered, so a re-read keeps it.
        var ph = e.target.closest('[data-ph]');
        if (ph) { view.ph[ph.getAttribute('data-ph')] = ph.getAttribute('aria-expanded') !== 'true'; repaint(); return; }
        var ag = e.target.closest('[data-ag]');
        if (ag) { view.open[ag.getAttribute('data-ag')] = ag.getAttribute('aria-expanded') !== 'true'; repaint(); return; }
        var pm = e.target.closest('[data-prm]');
        if (pm) { view.prm[pm.getAttribute('data-prm')] = pm.getAttribute('aria-expanded') !== 'true'; repaint(); return; }
        // The replay's strip and contents jump to a segment or a row, opening
        // the segment it sits in; 全部展開 opens every folded step, or shuts
        // them all when none is shut.
        var rs = e.target.closest('[data-rs]');
        if (rs) {
            var to = doc.getElementById(rs.getAttribute('data-rs'));
            if (!to) return;
            var seg = to.closest('details.rpseg');
            if (seg) seg.open = true;
            to.scrollIntoView({ block: 'start' });
            return;
        }
        if (e.target.closest('[data-xall]')) {
            var folds = doc.querySelectorAll('.rpw details.tc, .rpw details.stw');
            var shut = [].some.call(folds, function (d) { return !d.open; });
            [].forEach.call(folds, function (d) { d.open = shut; });
            return;
        }
        // A replay kind is hidden or shown again.
        var rk = e.target.closest('[data-rk]');
        if (rk) {
            var on = rk.getAttribute('aria-pressed') !== 'true';
            rk.setAttribute('aria-pressed', String(on));
            view.kinds[rk.getAttribute('data-rk')] = !on;
            [].forEach.call(doc.querySelectorAll('.rp > li[data-kind="' + rk.getAttribute('data-rk') + '"]'), function (li) { li.hidden = !on; });
            return;
        }
        // A backtrack opens the replay on the rows between entering the stage
        // it left and the step back — what that stage saw before it sent the
        // work back.
        var jump = e.target.closest('[data-goto]');
        if (jump) {
            var from = Number(jump.getAttribute('data-goto')), until = Number(jump.getAttribute('data-until'));
            var rp = doc.getElementById('s-rp');
            if (!rp) return;
            rp.open = true;
            var first = null;
            [].forEach.call(rp.querySelectorAll('.rp > li[data-t]'), function (li) {
                var t = Number(li.getAttribute('data-t'));
                var hit = li.getAttribute('data-t') !== '' && t >= from && t <= until;
                li.classList.toggle('hl', hit);
                if (hit && !first) first = li;
            });
            if (first) { var inSeg = first.closest('details.rpseg'); if (inSeg) inSeg.open = true; first.scrollIntoView({ block: 'center' }); }
            return;
        }
        if (e.target.closest('[data-cmpclear]')) {
            LS.picked = [];
            if (route.view === 'project') { draw(); return; }
            selbarDraw();
            drawList();
            drawSide();
            return;
        }
        var cb = e.target.closest('input[data-cmp]');
        if (cb) {
            var id = cb.getAttribute('data-cmp');
            LS.tick(id, cb.checked);
            if (route.view === 'project') { draw(); return; }
            selbarDraw();
            drawList();
            drawSide();
            return;
        }
        var sg = e.target.closest('[data-seg] button');
        if (sg) { view[sg.parentNode.getAttribute('data-seg')] = sg.getAttribute('data-v'); draw(); return; }
        // 清單's facet triggers: one opens its popover (and shuts any other),
        // its × puts the facet back to 全部, and a click outside the open one
        // shuts it and still does whatever it was aimed at.
        if (route.view === 'list') {
            var pk = e.target.closest('[data-pick]');
            if (pk) {
                var pkKey = pk.getAttribute('data-pick');
                pickOpen = pickOpen === pkKey ? null : pkKey;
                pickLast = pkKey;
                pickQ = '';
                draw();
                pickFocus(pickOpen ? 'first' : 'btn');
                return;
            }
            var pc = e.target.closest('[data-pickclr]');
            if (pc) { pickLast = pc.getAttribute('data-pickclr'); f[pickLast] = ''; pickOpen = null; draw(); pickFocus('btn'); return; }
            if (pickOpen && !e.target.closest('.rpop')) { pickOpen = null; draw(); }
        }
        var fc = e.target.closest('[data-facet] button');
        if (fc) {
            var fcKey = fc.parentNode.getAttribute('data-facet');
            f[fcKey] = fc.getAttribute('data-v');
            // A pick in a popover shuts it and hands focus back to its trigger.
            if (pickOpen) { pickOpen = null; draw(); pickFocus('btn'); return; }
            draw();
            return;
        }
        var wfRow = e.target.closest('[data-wf]');
        if (wfRow) { view.closed[wfRow.getAttribute('data-wf')] = !view.closed[wfRow.getAttribute('data-wf')]; draw(); return; }
        var go = e.target.closest('[data-href]');
        if (go && !e.target.closest('a,button,input')) { w.location.hash = go.getAttribute('data-href'); return; }
        var th = e.target.closest('th[data-k]');
        if (th) {
            var k = th.getAttribute('data-k');
            LS.sortBy(k);
            drawList();
            return;
        }
        var tr = e.target.closest('tr[data-id]');
        if (tr && route.view === 'list') {
            LS.sel = tr.getAttribute('data-id');
            [].forEach.call(doc.querySelectorAll('#lb tr'), function (x) {
                x.setAttribute('aria-selected', x.getAttribute('data-id') === LS.sel);
            });
            drawDetail();
        }
    });
    // The selection bar redrawn in place — the same element, so it slides
    // rather than reappears, and the table under it keeps its scroll.
    function selbarDraw() {
        var sb = doc.getElementById('selbar');
        if (!sb) return;
        sb.innerHTML = selbarInner();
        if (LS.picked.length) { sb.setAttribute('data-on', ''); sb.removeAttribute('aria-hidden'); }
        else { sb.removeAttribute('data-on'); sb.setAttribute('aria-hidden', 'true'); }
    }
    // Put focus on the last-opened facet trigger (`btn`), the popover's first way in
    // (`first`: the search box, or else the picked row), or a row by value.
    function pickFocus(what) {
        var el = what === 'btn' ? doc.querySelector('[data-pick="' + pickLast + '"]')
            : what === 'first' ? doc.querySelector('.rpop [data-pickq]') || doc.querySelector('.rpop [aria-pressed="true"]') || doc.querySelector('.rpop [data-v]')
            : [].filter.call(doc.querySelectorAll('.rpop [data-v]'), function (x) { return x.getAttribute('data-v') === what; })[0];
        if (el) el.focus();
    }
    // Typing in the popover's search box hides the rows that do not match,
    // in place, so the box keeps its caret; `pickQ` carries it into a redraw.
    doc.addEventListener('input', function (e) {
        if (!e.target.hasAttribute || !e.target.hasAttribute('data-pickq')) return;
        pickQ = e.target.value;
        var q = pickQ.toLowerCase();
        [].forEach.call(doc.querySelectorAll('.rpop [data-v]'), function (el) {
            el.hidden = !!q && el.textContent.concat(' ', el.title || '').toLowerCase().indexOf(q) < 0;
        });
    });
    doc.getElementById('q').addEventListener('input', function (e) {
        f.q = e.target.value;
        draw();
    });
    // ---- the header search: results grouped under the box ------------------
    // The box still filters every page through `f.q`, as it always has; 200 ms
    // after the typing stops it also opens a popover grouping what matches:
    // sessions by `match()` itself (so its count is the 清單 page's count),
    // projects by name or path, and the doc paths the map cards carry. A map
    // card holds no titles and no page text, only the paths it lists (還沒建,
    // 沒宣告狀態) and the filing buckets, so those are all 文件 can match.
    var qBox = doc.getElementById('q'), qPop = null, qTimer = null, qAt = -1;
    function qMark(text, q) {
        var s = String(text === null || text === undefined ? '' : text), i = q ? s.toLowerCase().indexOf(q.toLowerCase()) : -1;
        return i < 0 ? esc(s) : esc(s.slice(0, i)) + '<mark>' + esc(s.slice(i, i + q.length)) + '</mark>' + esc(s.slice(i + q.length));
    }
    function qHas(v, q) { return v !== null && v !== undefined && String(v).toLowerCase().indexOf(q.toLowerCase()) >= 0; }
    function qGroups(q) {
        var sess = S.sessions.filter(function (s) { return match(s, { q: q, state: '', project: '', stage: '' }); })
            .sort(function (a, b) { return (b.state === 'live') - (a.state === 'live') || (b.updated || 0) - (a.updated || 0); });
        var seen = {}, proj = [], docs = [];
        S.sessions.forEach(function (s) {
            if (seen[s.pkey]) return;
            seen[s.pkey] = true;
            if (qHas(NAMES[s.pkey], q) || qHas(s.pkey, q)) proj.push(s.pkey);
        });
        S.projects.forEach(function (p) {
            (p.docs || []).forEach(function (d) {
                var add = function (path, kind) { if (qHas(path, q)) docs.push({ pkey: d.pkey, path: path, kind: kind }); };
                (d.plannedNotBuilt || []).forEach(function (x) { add(x, loc('q.notBuiltYet', '還沒建')); });
                ((d.undeclared && d.undeclared.paths) || []).forEach(function (x) { add(x, loc('q.noStatusDeclared', '沒宣告狀態')); });
                ((d.filing && d.filing.rows) || []).forEach(function (r) { add(r.bucket, r.role); });
            });
        });
        var pname = function (pkey) { return shortLabel(NAMES[pkey] || pkey); };
        return [
            { t: 'Sessions', ico: 'sessions', n: sess.length, all: '#/list', rows: sess.slice(0, 5).map(function (s) {
                return { href: sessionHash(s.id), html: '<span class="qt">' + qMark(s.task || loc('q.unnamed', '（未命名）'), q) + '</span>'
                    + (qHas(s.id, q) && !qHas(s.task, q) ? '<span class="qid mono">' + qMark(s.id, q) + '</span>' : '')
                    + '<span class="qp">' + qMark(pname(s.pkey), q) + '</span><span class="qs mono">' + esc(s.stage || '—') + '</span>'
                    + '<span class="qa">' + ago(s.updated) + '</span>' };
            }) },
            { t: loc('q.projects', '專案'), ico: 'projects', n: proj.length, all: '#/projects', rows: proj.slice(0, 5).map(function (k) {
                return { href: projectHash(k), html: '<span class="qt">' + qMark(pname(k), q) + '</span><span class="qp mono">' + qMark(k, q) + '</span>' };
            }) },
            { t: loc('q.docs', '文件'), ico: 'docs', n: docs.length, all: '#/docs', rows: docs.slice(0, 5).map(function (d) {
                return { href: '#/docs', html: '<span class="qt mono">' + qMark(d.path, q) + '</span><span class="qp">' + esc(pname(d.pkey))
                    + '</span><span class="qs">' + esc(d.kind) + '</span>' };
            }) },
        ].filter(function (g) { return g.n; });
    }
    function qClose() {
        if (qTimer) { w.clearTimeout(qTimer); qTimer = null; }
        if (qPop) qPop.hidden = true;
        qAt = -1;
        qBox.setAttribute('aria-expanded', 'false');
        qBox.removeAttribute('aria-activedescendant');
    }
    function qDraw() {
        var q = qBox.value.trim(), i = 0;
        if (!q) { qClose(); return; }
        if (!qPop) {
            qPop = doc.createElement('div');
            qPop.id = 'qpop';
            qPop.className = 'qpop';
            // A press inside keeps the caret in the box; the click still lands.
            qPop.addEventListener('mousedown', function (e) { e.preventDefault(); });
            qPop.addEventListener('click', function (e) { if (e.target.closest('[data-qi]')) qClose(); });
            qBox.parentNode.appendChild(qPop);
        }
        var gs = qGroups(q), row = function (href, html, cls) {
            var n = i++;
            return '<a class="' + cls + '" id="qr-' + n + '" data-qi="' + n + '" role="option" aria-selected="false" href="' + href + '">' + html + '</a>';
        };
        qPop.innerHTML = '<div class="qin" data-block="search" role="listbox" aria-label="' + loc('q.searchResults', '搜尋結果') + '">' + (gs.length ? gs.map(function (g) {
            return '<div class="qg"><div class="qh">' + icon(g.ico) + '<b>' + g.t + '</b><span class="qn">' + g.n + '</span></div>'
                + g.rows.map(function (r) { return row(r.href, r.html, 'qrow'); }).join('')
                + (g.n > g.rows.length ? row(g.all, loc('q.seeAllNRows', '看全部 {n} 筆 →', { n: g.n }), 'qall') : '') + '</div>';
        }).join('') : '<p class="qnone">' + loc('q.noResultsFor', '沒有符合 “{q}” 的結果', { q: esc(q) }) + '</p>') + '</div>';
        qPop.hidden = false;
        qAt = -1;
        qBox.setAttribute('aria-expanded', 'true');
        qBox.removeAttribute('aria-activedescendant');
    }
    function qMove(to) {
        var all = qPop ? qPop.querySelectorAll('[data-qi]') : [];
        if (!all.length) return;
        qAt = (to + all.length) % all.length;
        [].forEach.call(all, function (el, k) { el.setAttribute('aria-selected', String(k === qAt)); });
        all[qAt].scrollIntoView({ block: 'nearest' });
        qBox.setAttribute('aria-activedescendant', all[qAt].id);
    }
    // Guarded: tests/station-view.test.js hands in a stub box with no attributes.
    if (qBox.setAttribute) {
        qBox.setAttribute('role', 'combobox');
        qBox.setAttribute('aria-autocomplete', 'list');
        qBox.setAttribute('aria-controls', 'qpop');
        qBox.setAttribute('aria-expanded', 'false');
    }
    qBox.addEventListener('input', function () {
        if (qTimer) w.clearTimeout(qTimer);
        qTimer = w.setTimeout(function () { qTimer = null; qDraw(); }, 200);
    });
    qBox.addEventListener('focus', function () { if (qBox.value.trim()) qDraw(); });
    qBox.addEventListener('blur', qClose);
    qBox.addEventListener('keydown', function (e) {
        var open = qPop && !qPop.hidden;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            if (!open) qDraw();
            e.preventDefault();
            qMove(e.key === 'ArrowDown' ? qAt + 1 : qAt < 0 ? -1 : qAt - 1);
            return;
        }
        // Enter on nothing picked keeps what the box did before: the filter
        // stays on the page underneath, the popover gets out of its way.
        if (e.key === 'Enter' && open) {
            e.preventDefault();
            var pick = qAt >= 0 ? qPop.querySelectorAll('[data-qi]')[qAt] : null;
            qClose();
            if (pick) w.location.hash = pick.getAttribute('href');
            return;
        }
        if (e.key === 'Escape' && open) qClose();
    });
    w.addEventListener('hashchange', qClose);
    function cssKey(k) { return String(k).replace(/["\\]/g, '\\$&'); }
    doc.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && route.view === 'days' && w.FK_DAYS.panelOpen()) { e.preventDefault(); w.FK_DAYS.panelShut(true); return; }
        // An open facet popover: Esc shuts it, the arrows walk the rows shown
        // (from the search box too), Enter in the search box takes the first.
        if (pickOpen && route.view === 'list' && e.target.closest && e.target.closest('.rpop, .rwrap')) {
            var ropts = [].filter.call(doc.querySelectorAll('.rpop [data-v]'), function (el) { return !el.hidden; });
            var ri = ropts.indexOf(e.target);
            if (e.key === 'Escape') { e.preventDefault(); pickOpen = null; draw(); pickFocus('btn'); return; }
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                var rn = e.key === 'ArrowDown' ? Math.min(ri + 1, ropts.length - 1) : ri <= 0 ? -1 : ri - 1;
                var rto = rn < 0 ? doc.querySelector('.rpop [data-pickq]') || ropts[0] : ropts[rn];
                if (rto) rto.focus();
                return;
            }
            if (e.key === 'Enter' && e.target.hasAttribute('data-pickq') && ropts[0]) { e.preventDefault(); ropts[0].click(); return; }
        }
        var lgk = route.view === 'days' && e.target.closest ? e.target.closest('.legend [data-key], .legend [data-rest]') : null;
        if (lgk && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); w.FK_DAYS.toggle(lgk); return; }
        if (e.target.tagName === 'INPUT') { if (e.key === 'Escape') e.target.blur(); return; }
        if (e.key === '/') { e.preventDefault(); doc.getElementById('q').focus(); }
    });

    doc.getElementById('fkver').textContent = S.fankeel ? 'fankeel ' + S.fankeel : '';
    doc.getElementById('nreg').textContent = loc('q.nRegistryDot', '{n} 個 registry · ', { n: S.projects.length })
        + S.sessions.length + ' sessions';
    doc.getElementById('cfg').textContent = String(S.configDir || '').replace(/^.*[\\/]/, '')
        || S.configDir;
    doc.getElementById('cfg').title = S.configDir || '';

    // ---- language: the masthead and the switch -----------------------------
    // The shell's own words are Chinese on disk (assets/station/index.html);
    // they are set once here, before the first draw. The switch stores the
    // choice and reloads, so the left bar's labels and every other table built
    // at load are built again in the new language.
    // The serve state in the masthead is this plug and a dot; the words are
    // only in `title` and `aria-label`.
    var SERVE_ICON = '<svg class="ico" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor"'
        + ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/>'
        + '<path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/></svg>';
    function serveIconHtml(up) {
        var words = up ? loc('mast.serveUp', 'serve 連線中') : loc('mast.serveDown', 'serve 已停');
        return '<span class="pill ' + (up ? 'live srv up" id="serveup"' : 'down srv" id="servedown"') + ' role="status" aria-label="' + esc(words)
            + '" title="' + esc(words) + '">' + SERVE_ICON + '<i class="dot ' + (up ? 'live' : 'down') + '" aria-hidden="true"></i></span>';
    }
    if (typeof module !== 'undefined' && module.exports) module.exports.serveIconHtml = serveIconHtml;
    function applyChrome() {
        if (!I18N) return;
        var en = I18N.lang === 'en';
        var set = function (id, fn) { var el = doc.getElementById(id); if (el) fn(el); };
        if (doc.documentElement && doc.documentElement.setAttribute) doc.documentElement.setAttribute('lang', en ? 'en' : 'zh-Hant');
        doc.title = loc('mast.title', 'fankeel 測站');
        set('brand', function (el) { el.setAttribute('aria-label', loc('mast.home', 'fankeel 測站 首頁')); });
        set('brandw', function (el) { el.textContent = ''; });
        set('side', function (el) { el.setAttribute('aria-label', loc('mast.crumbs', '位置')); });
        set('q', function (el) {
            el.placeholder = loc('mast.searchHint', '搜尋任務、session、碰過的檔案…');
            el.setAttribute('aria-label', loc('mast.search', '搜尋'));
        });
        set('servedown', function (el) {
            el.className = 'pill down srv';
            el.setAttribute('role', 'status');
            el.setAttribute('aria-label', loc('mast.serveDown', 'serve 已停'));
            el.title = loc('mast.serveDown', 'serve 已停');
            el.innerHTML = SERVE_ICON + '<i class="dot down" aria-hidden="true"></i>';
        });
        set('langzh', function (el) {
            el.setAttribute('aria-pressed', String(!en));
            el.setAttribute('aria-checked', String(!en));
            el.setAttribute('title', en ? '介面改用繁體中文' : '介面用繁體中文');
        });
        set('langen', function (el) {
            el.setAttribute('aria-pressed', String(en));
            el.setAttribute('aria-checked', String(en));
            el.setAttribute('title', en ? 'Interface is in English' : 'Switch the interface to English');
        });
        set('langcur', function (el) { el.textContent = en ? 'EN' : '繁中'; });
        set('appear', function (el) { el.setAttribute('aria-label', loc('mast.appearance', '外觀')); });
    }
    applyChrome();
    // The film's click ring: a keel ring opens out from a pressed action button.
    doc.addEventListener('pointerdown', function (e) {
        var b = e.target && e.target.closest ? e.target.closest('.btn.go, .td-mb') : null;
        if (!b || !b.classList) return;
        b.classList.remove('rip');
        void b.offsetWidth;
        b.classList.add('rip');
    });
    doc.addEventListener('animationend', function (e) {
        if (e.animationName === 'kring' && e.target && e.target.classList) e.target.classList.remove('rip');
    });

    // ---- live refresh --------------------------------------------------------
    // Served, the page keeps itself current: every three seconds it re-reads the
    // list and — while the session whose detail is on screen is live — that
    // session's detail, both asked for in the same tick, each through a script
    // tag the way it loaded them the first time, with a query string that only
    // keeps the browser from answering out of its cache. A session no longer
    // live has its detail re-read no more: nothing under it can move. A hidden
    // tab re-reads nothing, unless a tune request is open, and re-reads at once
    // when it is shown again. The file
    // `/fankeel` writes has no server to ask and keeps the moment it was written,
    // so `S.serve` gates all of this as well as the protocol. Armed before the
    // health poll, which stays the last interval this file sets.
    var POLL_MS = 3000;
    var busy = false;
    // Everything worked out from `S`: at load, above, and again on every
    // re-read below — one derivation rather than two that could drift apart.
    // `serialize()` never emits a `label` field — the shortest-unique-tail
    // rule lives only here, in `labels()`, since `navLabels` was deleted from
    // `lib/station.js` on purpose so the rule would not exist in two places —
    // and `match()`'s haystack still reads `s.label`, so it is reattached on
    // every call rather than once.
    function freshen() {
        NOW = Date.parse(S.generatedAt);
        LAB = labels(S.projects.map(function (p) { return p.root; }));
        S.sessions.forEach(function (s) { s.label = LAB[s.root]; });
        DAYS = lastDays(NOW, 30);
        PREV = lastDays(NOW - 30 * 864e5, 30);
        TODAY = DAYS[DAYS.length - 1];
        NAMES = projectNames(S.sessions);
        PKEYS = projectRows(S.sessions, DAYS).map(function (r) { return r.pkey; });
    }
    // A few seconds — well under anything a healthy local server needs — past
    // which a script that neither loaded nor errored (a hung server, a stuck
    // connection) is given up on: the tag is dropped and `done(false)` runs,
    // so `busy` always clears and the next tick tries again rather than going
    // silent forever. `settled` keeps a late `onload` after that point from
    // running `done` a second time. 4000 is a literal, not a `var`: the focus
    // page calls this before any `var` down here is assigned.
    function reload(src, done) {
        var el = doc.createElement('script');
        var settled = false;
        var timer = w.setTimeout(function () {
            if (settled) return;
            settled = true;
            if (el.parentNode) el.parentNode.removeChild(el);
            done(false);
        }, 4000);
        var finish = function (ok) {
            if (settled) return;
            settled = true;
            w.clearTimeout(timer);
            if (el.parentNode) el.parentNode.removeChild(el);
            done(ok);
        };
        el.onload = function () { finish(true); };
        el.onerror = function () { finish(false); };
        el.src = src + (src.indexOf('?') < 0 ? '?' : '&') + 't=' + Date.now();
        doc.head.appendChild(el);
    }
    // The answers the form holds right now, read off the DOM with `pgAnswers`,
    // and the same read written back into `view.pg` so a redraw keeps them.
    function pgRead(pgb, questions) {
        var id = pgb.getAttribute('data-pg-id'), picks = {}, others = {};
        questions.forEach(function (q, i) {
            picks[i] = [].map.call(pgb.querySelectorAll('input[name="pg-' + i + '"]:checked'), function (el) { return el.value; });
            var t = pgb.querySelector('[data-pg-other="' + i + '"]');
            others[i] = t ? t.value : '';
            view.pg[id + ':' + i] = picks[i];
            view.pg[id + ':' + i + ':other'] = others[i];
        });
        return pgAnswers(questions, picks, others);
    }
    function pgSync(pgb) {
        var who = S.sessions.filter(function (x) { return x.id === pgb.getAttribute('data-pg-id'); })[0];
        var qs = (who && who.pending && who.pending.questions) || [];
        var got = pgRead(pgb, qs), btn = pgb.querySelector('[data-answer]'), cnt = pgb.querySelector('.pgn');
        var sent = view.pg[pgb.getAttribute('data-pg-id') + ':send'];
        var sending = sent && who && who.pending && sent.gate === who.pending.until && (sent.busy || sent.cls === 'ok');
        if (btn) btn.disabled = got.missing > 0 || !!sending;
        if (cnt) cnt.textContent = (qs.length - got.missing) + ' / ' + qs.length;
    }
    // One POST /answer that says it is on its way. Every button in `box` is
    // disabled and `line` reads 送出中… until the reply. A reply ok leaves
    // them disabled; a refusal, a network error or no reply in SEND_MS gives
    // them back — the server's own gate waits 60 seconds (`gate.station`),
    // so 10 leaves room to press again. The state is kept in `view.pg` under
    // `<id>:send` first, because the poll's redraw replaces `box` and draws
    // from there (`gateCountdownHtml`, `pendingGateHtml`).
    var SEND_MS = 10000;
    function answerPost(id, box, line, cls, form, said, failed) {
        var btns = box.querySelectorAll ? [].slice.call(box.querySelectorAll('[data-gop],[data-gho],[data-answer],[data-gfs]')) : [];
        var who = S.sessions.filter(function (x) { return x.id === id; })[0], gate = who && who.pending ? who.pending.until : null;
        var ac = typeof AbortController === 'function' ? new AbortController() : null, over = false, timer;
        function show(busy, c, t) {
            view.pg[id + ':send'] = { busy: busy, cls: c, text: t, gate: gate };
            btns.forEach(function (b) { b.disabled = busy || c === 'ok'; });
            if (!line) return;
            line.className = cls + (c ? ' ' + c : '');
            line.textContent = t;
        }
        function give(c, t) {
            if (over) return;
            over = true;
            w.clearTimeout(timer);
            show(false, c, t);
        }
        show(true, 'wait', loc('poll.sending', '送出中…'));
        timer = w.setTimeout(function () {
            give('bad', loc('poll.notConfirmedRetry', '還沒確認送到：可以再按一次'));
            if (ac) ac.abort();
        }, SEND_MS);
        var init = { method: 'POST', body: form };
        if (ac) init.signal = ac.signal;
        fetch('answer', init).then(function (r) {
            return r.text().then(function (t) {
                give(r.ok ? 'ok' : 'bad', (r.ok ? said : r.status + ' — ') + t.trim());
            });
        }, function () { give('bad', failed + loc('poll.pressAgain', '可以再按一次')); });
    }
    // One POST /answer from the floating icon: an option, or the hand-off.
    function gatePost(gc, fill, said) {
        var id = gc.getAttribute('data-pg-id');
        var who = S.sessions.filter(function (x) { return x.id === id; })[0];
        if (!who || !who.pending) return;
        var form = new URLSearchParams();
        form.set('nonce', S.nonce || '');
        form.set('root', gc.getAttribute('data-pg-root'));
        form.set('id', id);
        fill(form, who);
        answerPost(id, gc, gc.querySelector('.gend'), 'gend', form, said, loc('poll.couldNotSendServeRunning', '送不出去：serve 還在跑嗎？'));
    }
    // The countdown moves every second between re-reads, on `tickNow`'s tick.
    function tickGates(now) {
        [].forEach.call(doc.querySelectorAll('#fk .gc[data-until]'), function (g) {
            var total = Number(g.getAttribute('data-total')) || 60;
            var left = Math.max(0, Math.min(total, Math.round((Number(g.getAttribute('data-until')) - now) / 1000)));
            var sec = g.querySelector('.gsec'), bar = g.querySelector('.gbar i');
            if (sec) sec.textContent = gateClock(left);
            if (bar) bar.style.width = (left / total * 100).toFixed(1) + '%';
        });
    }
    // 1–4 pick an option of the first held gate, the <kbd> on each button.
    doc.addEventListener('keydown', function (e) {
        if (!/^[1-4]$/.test(e.key) || e.altKey || e.ctrlKey || e.metaKey) return;
        var t = e.target;
        // A modal (the TODO quick look, the card library) owns the keys: the gate behind it is inert.
        if (doc.querySelector && doc.querySelector('dialog[open]')) return;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
        var b = doc.querySelector && doc.querySelector('#fk .gc [data-gop="' + (Number(e.key) - 1) + '"]');
        if (b) { e.preventDefault(); b.click(); }
    });
    // Typing in 其他 ticks its box, the way the mockup does, and re-counts.
    doc.addEventListener('input', function (e) {
        var t = e.target && e.target.closest ? e.target.closest('.pg [data-pg-other]') : null;
        if (!t) return;
        var box = t.closest('.o').querySelector('input[value="__other"]');
        if (box) box.checked = t.value.trim() !== '';
        pgSync(t.closest('.pg'));
    });
    // The session whose detail is on screen: the session page's, or the row
    // selected on 清單.
    function watched() {
        var id = route.view === 'session' ? route.id : route.view === 'list' ? LS.sel : null;
        return id ? S.sessions.filter(function (x) { return x.id === id; })[0] || null : null;
    }
    // A settled tune request, kept as a note in the floating icon's panel
    // and — with the tab in the background and permission given — said as a
    // browser notification. The changed page reloads itself through tune's
    // own overlay.
    function tuneNotify(prev, next) {
        var evs = tuneEvents(prev, next);
        if (!evs.length) return;
        view.notes = evs.concat(view.notes).slice(0, 20);
        evs.forEach(function (ev) {
            if (doc.hidden && w.Notification && w.Notification.permission === 'granted') {
                try { new w.Notification(toastText(ev)); } catch (err) { /* the browser refused it */ }
            }
        });
        drawFloat();
    }
    function refresh() {
        if (busy || (doc.hidden && !tuneOpen(S.sessions))) return;
        busy = true;
        var before = S.sessions;
        // The detail on screen is asked for beside the list, not after it has
        // landed: two round trips in a row were most of a re-read's wait. Which
        // detail is read off the list as it stood; a session that went down in
        // between costs one read more, and the next tick asks for none.
        var on = doc.hidden || route.view === 'settings' || route.view === 'tour' ? null : watched();
        var left = on && on.state === 'live' && on.hasDetail ? 2 : 1;
        var fresh = false;
        var landed = function () {
            if (--left > 0) return;
            busy = false;
            if (!fresh || doc.hidden) return;
            // The settings wizard reads nothing live; a redraw there would only
            // throw away what the reader has open. The masthead still moves.
            if (route.view === 'settings' || route.view === 'tour') { drawFloat(); doc.getElementById('gen').textContent = genText(); return; }
            repaint();
        };
        reload('station/station-data.js', function (ok) {
            if (ok && w.STATION && w.STATION !== S) {
                // `cleared` rides on the one load `/clear-stale` redirected to, and
                // stays on the page rather than vanishing three seconds later.
                if (isFinite(S.cleared) && w.STATION.cleared === undefined) w.STATION.cleared = S.cleared;
                S = w.STATION;
                freshen();
                polledAt = Date.now();
                tuneNotify(before, S.sessions);
                fresh = true;
            }
            landed();
        });
        if (left === 2) reload('station/detail/' + encodeURIComponent(on.id) + '.js', landed);
    }
    // A redraw that keeps what the reader had: which sections were open, where
    // the list and the page were scrolled, and which control had focus, found
    // again by its `data-key`. A reader typing into a field on the page holds
    // the redraw back — it would throw the typing away — until the next re-read.
    function repaint() {
        var ae = doc.activeElement;
        var typing = ae && (ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT'
            || (ae.tagName === 'INPUT' && ae.id !== 'q' && !/^(checkbox|radio|button|submit)$/.test(ae.type || '')));
        if (typing) return;
        var key = ae && ae.getAttribute ? ae.getAttribute('data-key') : null;
        var box = doc.querySelectorAll('.listcard .scroll')[0];
        var boxTop = box ? box.scrollTop : 0;
        var y = w.scrollY || 0;
        draw();
        var again = doc.querySelectorAll('.listcard .scroll')[0];
        if (again) again.scrollTop = boxTop;
        if (typeof w.scrollTo === 'function') w.scrollTo(0, y);
        if (key) {
            var el = doc.querySelectorAll('[data-key="' + key + '"]')[0];
            if (el && el.focus) el.focus();
        }
    }
    // Once a second: every figure `tk()` marked, read through `tk()` itself
    // (`live: false` so it hands back the bare text rather than a span to
    // nest inside the one already on the page) rather than a second copy of
    // its arithmetic, and the `N 秒前更新` beside the live tag.
    function tickNow() {
        var now = Date.now();
        [].forEach.call(doc.querySelectorAll('.tkr'), function (el) {
            el.textContent = tk(Number(el.getAttribute('data-b')), Number(el.getAttribute('data-m')), false, now / 1000);
        });
        [].forEach.call(doc.querySelectorAll('[data-ago]'), function (el) {
            el.textContent = agoText(Math.round((now - polledAt) / 1000));
        });
        tickGates(now);
    }
    if (S.serve && w.location && w.location.protocol !== 'file:' && typeof w.setInterval === 'function') {
        w.setInterval(refresh, POLL_MS);
        w.setInterval(tickNow, 1000);
        // Back from hidden: every tick while away re-read nothing (unless a tune
        // request was open), so the page
        // re-reads now rather than up to three seconds from now.
        doc.addEventListener('visibilitychange', function () { if (!doc.hidden) refresh(); });
    }

    // ---- serve health polling ----------------------------------------------
    // Only `serve` (not `--open`, which writes a file) puts a server behind
    // this fetch, so a page opened straight from disk must never start the
    // poll — it would show a permanent death banner for a state that is
    // simply normal there. `w.setInterval` is also checked so a stripped-down
    // test harness that stubs `document` but not timers skips this quietly
    // instead of throwing.
    if (w.location && w.location.protocol !== 'file:' && typeof w.setInterval === 'function') {
        var lastOkMs = Date.now();
        var deadBar = null;
        var deadMsg = null;
        var setFrozen = function (on) {
            var page = doc.getElementById('page');
            if (page) page.style.cssText = on ? 'opacity:.72;filter:saturate(.3)' : '';
        };
        // The shell ships only #servedown; the "connected" twin is built the
        // first time the state is set, and the two swap by `hidden`.
        var servePill = function (on) {
            var pill = doc.getElementById('servedown');
            if (!pill) return;
            var upEl = doc.getElementById('serveup');
            if (!upEl && pill.insertAdjacentHTML) {
                pill.insertAdjacentHTML('beforebegin', serveIconHtml(true));
                upEl = doc.getElementById('serveup');
            }
            if (upEl) upEl.hidden = on;
            pill.hidden = !on;
        };
        servePill(false);
        var showDead = function (msg) {
            if (!deadBar) {
                deadBar = doc.createElement('div');
                deadBar.setAttribute('role', 'status');
                deadBar.setAttribute('aria-live', 'polite');
                deadBar.className = 'dead';
                var head = doc.createElement('b');
                head.innerHTML = '<i class="dot down"></i>' + esc(loc('health.serveNotResponding', 'serve 沒有回應'));
                deadBar.appendChild(head);
                deadMsg = doc.createElement('span');
                deadBar.appendChild(deadMsg);
                // What brings it back, as text to select rather than a
                // control: nothing on this page can start a server.
                var cmd = doc.createElement('code');
                cmd.textContent = 'node fankeel serve --open';
                deadBar.appendChild(cmd);
                var retry = doc.createElement('button');
                retry.type = 'button';
                retry.className = 'btn';
                retry.textContent = loc('health.retry', '重試');
                retry.style.cssText = 'border-color:var(--stale);color:var(--stale-ink)';
                retry.addEventListener('click', function () { poll(); });
                deadBar.appendChild(retry);
                var mast = doc.querySelector('.mast');
                mast.parentNode.insertBefore(deadBar, mast.nextSibling);
            }
            deadMsg.textContent = msg;
            deadBar.hidden = false;
            servePill(true);
            setFrozen(true);
            // The eyebrow is rendered, not patched, so the page has to be
            // drawn again — but only as the state flips. A redraw every five
            // seconds would throw away a scroll position and an opened row
            // for a page whose numbers cannot change any more.
            if (frozenAt === null) { frozenAt = stamp(NOW).slice(11); draw(); }
        };
        var hideDead = function () {
            if (deadBar) deadBar.hidden = true;
            servePill(false);
            setFrozen(false);
            if (frozenAt !== null) { frozenAt = null; draw(); }
        };
        var poll = function () {
            fetch('station/health').then(function (r) {
                // A 403 is the tailnet's answer (lib/remote.js `LOCAL`: the health route is this
                // machine's only): the server answered, which is all this poll asks. A paired phone
                // opened here through /?full=1 would otherwise freeze 15 s after load.
                if (r && (r.ok || r.status === 403)) lastOkMs = Date.now();
            }).catch(function () {}).then(function () {
                var msg = serveLost(lastOkMs, Date.now(), stamp(NOW), ago(NOW));
                if (msg) showDead(msg); else hideDead();
            });
        };
        w.setInterval(poll, 5000);
    }

    // spend-1: the day scripts/quota.js calibrated the quota in force, or null
    // for a quota set by hand or a project's own, which carry no day.
    function quotaDay() {
        var m = S.profiles && S.profiles.machine && S.profiles.machine.values;
        var d = m && m['quota.calibrated'];
        var q = quotaWeek();
        return typeof d === 'string' && q && q === m['quota.week'] ? d : null;
    }

    draw();
}(typeof window === 'undefined' ? {} : window,
  typeof document === 'undefined' ? null : document));
