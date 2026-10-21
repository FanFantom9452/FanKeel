'use strict';
// assets/station/sessions-page.js — 全部, the page `#/sessions` and `#/cmp`
// draw (docs/90-agent/plans/2026-10-21-station-redesign-design.md §2; mockups
// route-sessions.html and route-list-cmp.html). Top to bottom: a now-strip
// counting what runs and linking to 進行中, four period tiles (今天 / 近 7 天 /
// 近 30 天 / 全部) that are both the summary and the date filter, then one card:
// filters in its head (project, stage reached, cost floor, 重設篩選), ten rows
// a page sorted on last move, cost or elapsed, and the pager with the compare
// tray in its foot. Ticking two or three rows opens the compare dialog in
// place; `#/cmp` is this list with the dialog open, so it is never empty. The
// dialog shows the fields lib/compare.js returns, the larger of each row
// marked and equal figures read 一樣. State lives here across the poll's
// redraw, which redraws through `o.redraw`; an open dialog is reopened after
// it. Reads `w.FK_KIT` when it draws.
(function (w, doc) {
    var EN = {
        'ss.now': 'Now',
        'ss.nRun': '{n} running',
        'ss.noRun': 'Nothing running',
        'ss.nGate': '{n} gates waiting on you',
        'ss.noGate': 'No gate waiting on you',
        'ss.nStale': '{n} may have stopped',
        'ss.goLive': 'See Live',
        'ss.today': 'Today',
        'ss.d7': 'Last 7 days',
        'ss.d30': 'Last 30 days',
        'ss.dAll': 'All time',
        'ss.periods': 'Period, by last move',
        'ss.spend': 'Cost {v}',
        'ss.spend30': 'Cost is kept 30 days',
        'ss.nSessions': 'sessions',
        'ss.landed': 'Landed {n}',
        'ss.mid': 'Not finished {n}',
        'ss.byLast': 'By last move',
        'ss.byCost': 'By cost',
        'ss.byTime': 'By elapsed',
        'ss.newFirst': 'newest first',
        'ss.oldFirst': 'oldest first',
        'ss.highFirst': 'highest first',
        'ss.lowFirst': 'lowest first',
        'ss.longFirst': 'longest first',
        'ss.shortFirst': 'shortest first',
        'ss.perPage': '{how}, {n} a page',
        'ss.pick': 'Tick to compare',
        'ss.task': 'Task · project',
        'ss.result': 'Result',
        'ss.cost': 'Cost',
        'ss.last': 'Last move',
        'ss.elapsed': 'Elapsed',
        'ss.unnamed': '(unnamed)',
        'ss.init': 'Starting up, no route',
        'ss.unfinished': 'Not finished',
        'ss.noDetail': 'No transcript: nothing to compare',
        'ss.filters': 'Filter sessions',
        'ss.project': 'Project',
        'ss.allProjects': 'All projects',
        'ss.stage': 'Stage reached',
        'ss.anyStage': 'Any stage',
        'ss.toLand': 'Reached land',
        'ss.midAny': 'Not finished (any stage)',
        'ss.initStage': 'Starting up',
        'ss.costFloor': 'Cost',
        'ss.anyCost': 'Any cost',
        'ss.reset': 'Reset filters',
        'ss.empty': 'No session matches these filters.',
        'ss.trayRegion': 'Compare the ticked sessions',
        'ss.trayHint': 'Tick two or three rows to compare; ticks survive paging',
        'ss.picked': '{n} ticked',
        'ss.oneMore': ', tick one more',
        'ss.compare': 'Compare',
        'ss.untick': 'Clear ticks',
        'ss.pager': 'Pages',
        'ss.rows': 'Rows {a}–{b}',
        'ss.prev': 'Previous page',
        'ss.next': 'Next page',
        'ss.pageN': 'Page {n}',
        'ss.cmpTitle': 'Compare {n} sessions',
        'ss.cmpSub': 'Click a title to open that session',
        'ss.close': 'Close',
        'ss.cmpFoot': 'The larger figure of each row is marked',
        'ss.same': 'same',
        'ss.main': 'Main session',
        'ss.agentUsd': 'Agents',
        'ss.agentRequests': 'Agent API requests',
        'ss.agents': 'Agents sent',
        'ss.tokens': 'Tokens',
        'ss.started': 'Started',
        'ss.stages': 'Cost by stage',
    };
    function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    function fill(s, vars) {
        if (!vars) return s;
        return String(s).replace(/\{(\w+)\}/g, function (m, k) { return has(vars, k) ? String(vars[k]) : m; });
    }
    function loc(key, zh, vars) {
        var I = w && w.FK_I18N;
        return fill(I && I.lang === 'en' && has(EN, key) ? EN[key] : zh, vars);
    }
    function kit() { return (w && w.FK_KIT) || {}; }
    function esc(s) { return kit().esc(s); }
    function tip(label, values) { return w && w.FK_TIP ? w.FK_TIP.attr(label, values) : ''; }
    function ms(t) { return typeof t === 'number' ? t : Date.parse(t); }
    function lastOf(s) {
        var a = ms(s.updated), b = ms(s.started);
        return Math.max(isFinite(a) ? a : 0, isFinite(b) ? b : 0);
    }
    function two(n) { return ('0' + n).slice(-2); }
    function when(t) {
        if (!t || !isFinite(t)) return '—';
        var d = new Date(t);
        return two(d.getMonth() + 1) + '-' + two(d.getDate()) + ' ' + two(d.getHours()) + ':' + two(d.getMinutes());
    }
    function ico(d, size) {
        return '<svg class="ico" viewBox="0 0 16 16" width="' + (size || 16) + '" height="' + (size || 16) + '" aria-hidden="true" fill="none" stroke="currentColor"'
            + ' stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
    }
    var CARET = '<svg class="caret" viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var I_PROJ = ico('<path d="M2 4.5h4.5l1.5 1.5h6v6.5H2z"/>');
    var I_STAGE = ico('<circle cx="3" cy="8" r="1.6"/><circle cx="8" cy="8" r="1.6"/><circle cx="13" cy="8" r="1.6"/><path d="M4.6 8h1.8M9.6 8h1.8"/>');
    var I_COST = ico('<circle cx="8" cy="8" r="6"/><path d="M10 5.8H7.2a1.2 1.2 0 0 0 0 2.4h1.6a1.2 1.2 0 0 1 0 2.4H6M8 4.4v1.4M8 10.6V12"/>');
    var I_RESET = ico('<path d="M3 8a5 5 0 1 0 1.5-3.5"/><path d="M3 2.5V5h2.5"/>');
    var I_TICK = ico('<rect x="2.5" y="2.5" width="11" height="11" rx="2.5"/><path d="m5.5 8 1.8 1.8L10.8 6"/>');
    var I_GO = ico('<path d="M3 8h10M9 4l4 4-4 4"/>');
    var I_ARROW = '<svg class="ico ar" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 6.5 8 10l3.5-3.5"/></svg>';
    var I_X = '<svg class="ico" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

    var PER = 10, PERIODS = ['1', '7', '30', ''];
    function fresh() { return { d: '30', p: '', g: '', c: '', sort: 'last', dir: -1, pg: 0, picked: [], pop: '', cmp: false }; }
    var st = fresh(), last = null, bound = false, trayLanded = false;

    function stageOf(s) { var r = s.route || []; return !r.length ? 'init' : s.stage === 'land' ? 'land' : s.stage; }
    function landed(s) { return (s.route || []).length > 0 && s.stage === 'land'; }
    function dayStart(now) { var m = new Date(now); m.setHours(0, 0, 0, 0); return m.getTime(); }
    function inPeriod(s, d, now) { return !d || lastOf(s) >= dayStart(now) - (+d - 1) * 864e5; }
    // What the session spent on the period's local days, from `days` (kept ~30 days).
    function spendIn(s, d, now) {
        var from = kit().lastDays(now, +d)[0];
        return (s.days || []).reduce(function (n, x) { return n + (x && x.day >= from && typeof x.usd === 'number' ? x.usd : 0); }, 0);
    }
    function match(s, q, skip, now) {
        if (skip !== 'p' && q.p && s.pkey !== q.p) return false;
        if (skip !== 'g' && q.g) {
            var g = stageOf(s);
            if (q.g === 'mid' ? (g === 'land' || g === 'init') : g !== q.g) return false;
        }
        if (skip !== 'd' && !inPeriod(s, q.d, now)) return false;
        if (skip !== 'c' && q.c && kit().cost(s) < +q.c) return false;
        return true;
    }
    function keyOf(sort) {
        if (sort === 'usd') return function (s) { return kit().cost(s); };
        if (sort === 'ck') return function (s) { return s.clock || 0; };
        return lastOf;
    }
    function view(sessions, q, now) {
        var all = sessions || [], key = keyOf(q.sort), dir = q.dir || -1;
        var list = all.filter(function (s) { return match(s, q, '', now); })
            .sort(function (a, b) { return dir * (key(a) - key(b)) || lastOf(b) - lastOf(a); });
        var base = all.filter(function (s) { return match(s, q, 'd', now); });
        var periods = PERIODS.map(function (d) {
            var L = base.filter(function (s) { return inPeriod(s, d, now); });
            return {
                d: d, n: L.length, landed: L.filter(landed).length,
                mid: L.filter(function (s) { return (s.route || []).length > 0 && !landed(s); }).length,
                usd: d ? Math.round(L.reduce(function (n, s) { return n + spendIn(s, d, now); }, 0) * 100) / 100 : null,
            };
        });
        return { list: list, periods: periods };
    }

    function periodLabel(d) {
        if (d === '1') return loc('ss.today', '今天');
        if (d === '7') return loc('ss.d7', '近 7 天');
        if (d === '30') return loc('ss.d30', '近 30 天');
        return loc('ss.dAll', '全部時間');
    }
    function nowStrip(all) {
        var run = all.filter(function (s) { return s.state === 'live' && !s.gateAt; }).length;
        var gate = all.filter(function (s) { return s.gateAt && s.state !== 'down'; }).length;
        var stale = all.filter(function (s) { return s.state === 'stale' && !s.gateAt; }).length;
        return '<a class="ss-now" data-block="sessions-now" href="#/live"><span class="k">' + loc('ss.now', '現在') + '</span>'
            + '<span>' + (run ? '<i class="dot live" aria-hidden="true"></i>' + loc('ss.nRun', '{n} 個在跑', { n: '<b>' + run + '</b>' }) : loc('ss.noRun', '沒有 session 在跑')) + '</span>'
            + '<span' + (gate ? ' class="warn"' : '') + '>' + (gate ? loc('ss.nGate', '{n} 個 gate 等你回答', { n: '<b>' + gate + '</b>' }) : loc('ss.noGate', '沒有 gate 等你回答')) + '</span>'
            + (stale ? '<span><i class="dot stale" aria-hidden="true"></i>' + loc('ss.nStale', '{n} 個可能已停', { n: '<b>' + stale + '</b>' }) + '</span>' : '')
            + '<span class="go">' + loc('ss.goLive', '到「進行中」看') + I_GO + '</span></a>';
    }
    function periodsHtml(periods) {
        var k = kit();
        return '<div class="ss-per" data-block="sessions-periods" role="group" aria-label="' + esc(loc('ss.periods', '期間：以最後動靜算')) + '"><div class="ss-pts">'
            + periods.map(function (p) {
                return '<button type="button" class="ss-pt" data-ss-d="' + p.d + '" aria-pressed="' + (p.d === st.d) + '">'
                    + '<span class="l">' + periodLabel(p.d) + '</span>'
                    + (p.usd === null ? '<span class="usd na">' + loc('ss.spend30', '花費只記 30 天') + '</span>'
                        : '<span class="usd">' + loc('ss.spend', '花費 {v}', { v: k.usd(p.usd, true) }) + '</span>')
                    + '<span class="n"><b>' + p.n + '</b>' + loc('ss.nSessions', '個 session') + '</span>'
                    + '<span class="f">' + loc('ss.landed', '走到 land {n}', { n: '<b>' + p.landed + '</b>' })
                    + ' · <span class="mid">' + loc('ss.mid', '還沒走完 {n}', { n: '<b>' + p.mid + '</b>' }) + '</span></span></button>';
            }).join('') + '</div></div>';
    }
    // The popover's items, counted over the rows the other filters leave.
    function itemsOf(key, all, names, now) {
        var k = kit(), base = all.filter(function (s) { return match(s, st, key, now); }), items;
        if (key === 'p') {
            var n = {}, order = [];
            base.forEach(function (s) { if (!n[s.pkey]) { n[s.pkey] = 0; order.push(s.pkey); } n[s.pkey]++; });
            if (st.p && !n[st.p]) { n[st.p] = 0; order.push(st.p); }
            items = [{ v: '', main: loc('ss.allProjects', '全部專案'), n: base.length }].concat(order.sort().map(function (p) {
                return { v: p, main: k.shortLabel(names[p] || p), n: n[p] };
            }));
        } else if (key === 'c') {
            items = [{ v: '', main: loc('ss.anyCost', '不限花費'), n: base.length }].concat([10, 50, 100].map(function (v) {
                return { v: String(v), main: '≥ $' + v, n: base.filter(function (s) { return k.cost(s) >= v; }).length };
            }));
        } else {
            var c = {};
            base.forEach(function (s) { var g = stageOf(s); c[g] = (c[g] || 0) + 1; if (g !== 'land' && g !== 'init') c.mid = (c.mid || 0) + 1; });
            items = [{ v: '', main: loc('ss.anyStage', '任何一站'), n: base.length },
                { v: 'land', main: loc('ss.toLand', '走到 land'), n: c.land || 0, lead: '<i class="dot" style="background:var(--st-land)"></i>' },
                { v: 'mid', main: loc('ss.midAny', '還沒走完（任何一站）'), n: c.mid || 0 }]
                .concat(k.ROUTE.slice(0, 6).map(function (g) { return { v: g, main: g, n: c[g] || 0, lead: '<i class="dot" style="background:var(--st-' + g + ')"></i>' }; }))
                .concat([{ v: 'init', main: loc('ss.initStage', '初始化中'), n: c.init || 0 }])
                .filter(function (it) { return it.n || !it.v || it.v === st.g; });
        }
        return items;
    }
    function pickHtml(key, label, icon, items) {
        var cur = items[0], open = st.pop === key;
        items.forEach(function (it) { if (it.v === st[key]) cur = it; });
        return '<div class="ss-f ctlgrp"><div class="rwrap"' + (st[key] ? ' data-set' : '') + '>'
            + '<button type="button" class="rbtn" data-ss-pop="' + key + '" aria-haspopup="listbox" aria-expanded="' + open + '" aria-label="' + esc(label + ': ' + cur.main) + '">'
            + icon + '<span class="fl">' + esc(cur.main) + '</span><b class="fc">' + cur.n + '</b>' + CARET + '</button>'
            + (open ? '<div class="rpop" role="listbox" aria-label="' + esc(label) + '">' + items.map(function (it) {
                return '<button type="button" role="option" data-ss-f="' + key + '" data-v="' + esc(it.v) + '" aria-selected="' + (it.v === st[key]) + '">' + (it.lead || '')
                    + '<span class="ro-m"><span class="fl">' + esc(it.main) + '</span></span><b class="fc">' + it.n + '</b></button>';
            }).join('') + '</div>' : '') + '</div></div>';
    }
    function result(s) {
        var k = kit(), route = s.route || [], at = route.indexOf(s.stage), out;
        if (!route.length || at < 0) out = '<span class="init">' + loc('ss.init', '初始化中，沒有路線') + '</span>';
        else {
            var place = function (name) { var i = route.indexOf(name); return i < 0 ? null : i < at ? 'done' : i === at ? 'now' : 'todo'; };
            out = k.keelGlyph({ cls: 'prog', seg: function (i) { return place(k.ROUTE[i]); }, edge: place('land') || 'todo', c: 'var(--st-' + esc(s.stage) + ')' })
                + '<span class="kst k-only' + (landed(s) && s.state === 'down' ? ' ok' : '') + '" style="--c:var(--st-' + esc(s.stage) + ')"><b>' + two(at + 1)
                + '</b><i>&nbsp;/&nbsp;' + two(route.length) + '</i><u>' + esc(s.stage) + '</u></span>';
            if (s.state === 'down' && !landed(s)) out += '<span class="stop">' + loc('ss.unfinished', '沒走完') + '</span>';
        }
        if (s.state === 'live') out += '<span class="pill live"><i class="dot live pulse"></i>live</span>';
        if (s.state === 'stale') out += '<span class="pill stale"><i class="dot stale"></i>stale</span>';
        return '<span class="ss-res">' + out + '</span>';
    }
    function sub(s, names, colours) {
        return '<span class="ss-sub">' + (colours ? '<i class="sw" style="background:' + colours(s.pkey) + '" aria-hidden="true"></i>' : '')
            + '<span>' + esc(kit().shortLabel(names[s.pkey] || s.pkey || '')) + '</span><span class="id">' + esc(String(s.id).slice(0, 8)) + '</span></span>';
    }
    function titleOf(s) { return s.task ? esc(s.task) : loc('ss.unnamed', '（未命名）'); }
    function rowHtml(s, names, colours) {
        var k = kit(), on = st.picked.indexOf(s.id) >= 0, c = k.cost(s);
        var dis = !s.hasDetail ? ' disabled title="' + esc(loc('ss.noDetail', '沒有 transcript，沒有可比的')) + '"' : !on && st.picked.length >= 3 ? ' disabled' : '';
        return '<tr data-ss-row="' + esc(s.id) + '"' + (on ? ' class="on"' : '') + '>'
            + '<td><label class="ss-ck"><span class="hm-sr">' + loc('ss.pick', '勾選來比較') + '</span><input type="checkbox" data-ss-tick="' + esc(s.id) + '"' + (on ? ' checked' : '') + dis + '></label></td>'
            + '<td><a class="ss-task' + (s.task ? '' : ' un') + '" href="' + esc(k.sessionHash(s.id)) + '">' + titleOf(s) + '</a>' + sub(s, names, colours) + '</td>'
            + '<td>' + result(s) + '</td>'
            + '<td class="r' + (c ? '' : ' z') + '">' + k.usd(c, true) + '</td>'
            + '<td class="m c-at">' + when(lastOf(s)) + '</td>'
            + '<td class="r c-ck' + (s.clock ? '' : ' z') + '">' + k.mins(s.clock || null) + '</td></tr>';
    }
    var SORTS = { last: ['ss.byLast', 'ss.newFirst', 'ss.oldFirst'], usd: ['ss.byCost', 'ss.highFirst', 'ss.lowFirst'], ck: ['ss.byTime', 'ss.longFirst', 'ss.shortFirst'] };
    function sortText(key) {
        if (key === 'ss.byLast') return loc('ss.byLast', '依最後動靜排');
        if (key === 'ss.byCost') return loc('ss.byCost', '依花費排');
        if (key === 'ss.byTime') return loc('ss.byTime', '依用時排');
        if (key === 'ss.newFirst') return loc('ss.newFirst', '新的在前');
        if (key === 'ss.oldFirst') return loc('ss.oldFirst', '舊的在前');
        if (key === 'ss.highFirst') return loc('ss.highFirst', '高的在前');
        if (key === 'ss.lowFirst') return loc('ss.lowFirst', '低的在前');
        if (key === 'ss.longFirst') return loc('ss.longFirst', '長的在前');
        return loc('ss.shortFirst', '短的在前');
    }
    function th(key, label, cls) {
        var on = st.sort === key;
        return '<th scope="col" class="' + cls + '"' + (on ? ' aria-sort="' + (st.dir < 0 ? 'descending' : 'ascending') + '"' : '') + '>'
            + '<button type="button" data-ss-sort="' + key + '">' + label + I_ARROW + '</button></th>';
    }
    function pagerHtml(n) {
        var pages = Math.max(1, Math.ceil(n / PER)), pg = st.pg, show = [], out = [];
        if (!n) return '<nav class="ss-pg" aria-label="' + esc(loc('ss.pager', '翻頁')) + '"></nav>';
        for (var i = 0; i < pages; i++) if (i === 0 || i === pages - 1 || Math.abs(i - pg) <= 1 || (pg < 3 && i < 4) || (pg > pages - 4 && i > pages - 5)) show.push(i);
        show.forEach(function (i, j) {
            if (j && i - show[j - 1] > 1) out.push('<span class="gap" aria-hidden="true">…</span>');
            out.push('<button type="button" data-ss-pg="' + i + '"' + (i === pg ? ' aria-current="page"' : '') + ' aria-label="' + esc(loc('ss.pageN', '第 {n} 頁', { n: i + 1 })) + '">' + (i + 1) + '</button>');
        });
        return '<nav class="ss-pg" aria-label="' + esc(loc('ss.pager', '翻頁')) + '"><span class="at">' + loc('ss.rows', '第 {a}–{b} 筆', { a: pg * PER + 1, b: Math.min(n, pg * PER + PER) }) + '</span>'
            + '<button type="button" data-ss-pg="' + (pg - 1) + '"' + (pg ? '' : ' disabled') + ' aria-label="' + esc(loc('ss.prev', '上一頁')) + '">' + ico('<path d="M10 3.5 5.5 8l4.5 4.5"/>') + '</button>'
            + out.join('')
            + '<button type="button" data-ss-pg="' + (pg + 1) + '"' + (pg < pages - 1 ? '' : ' disabled') + ' aria-label="' + esc(loc('ss.next', '下一頁')) + '">' + ico('<path d="M6 3.5 10.5 8 6 12.5"/>') + '</button></nav>';
    }
    function trayHtml() {
        var n = st.picked.length;
        if (!n) return '<span class="hint">' + I_TICK + loc('ss.trayHint', '勾兩到三列來比較，翻頁也記得') + '</span>';
        return '<span>' + loc('ss.picked', '已勾 {n} 個', { n: '<b class="ss-n">' + n + '</b>' }) + (n < 2 ? loc('ss.oneMore', '，再勾一個') : '') + '</span>'
            + '<button type="button" class="pri" data-ss-cmp' + (n < 2 ? ' disabled' : '') + ' aria-haspopup="dialog">' + loc('ss.compare', '比較') + '</button>'
            + '<button type="button" class="sec" data-ss-clear>' + loc('ss.untick', '取消勾選') + '</button>';
    }

    // The dialog's rows: one figure a session; the larger marked, equal ones once with 一樣.
    function line(label, vals, fmt) {
        var head = '<div class="k">' + label + '</div>';
        if (vals.every(function (v) { return v === null || v === undefined; })) return head + '<div class="same">—</div>';
        if (vals.every(function (v) { return v === vals[0]; })) return head + '<div class="same">' + esc(fmt(vals[0])) + '<small class="eq">' + loc('ss.same', '一樣') + '</small></div>';
        var max = Math.max.apply(null, vals.map(function (v) { return v || 0; }));
        return head + vals.map(function (v) { return '<div class="v' + (max > 0 && v === max ? ' top' : '') + '">' + esc(v === null ? '—' : fmt(v)) + '</div>'; }).join('');
    }
    function tokensOf(s) {
        var t = null;
        (s.days || []).forEach(function (x) { if (x && typeof x.tokens === 'number') t = (t || 0) + x.tokens; });
        return t;
    }
    function stageUsd(s, g) {
        return (s.stages || []).reduce(function (n, x) { return n + (x && x.stage === g && typeof x.usd === 'number' ? x.usd : 0); }, 0);
    }
    function compareHtml(list, names) {
        var k = kit(), nm = names || {}, usdF = function (v) { return k.usd(v, true); };
        var out = '<div class="ss-cg" style="--n:' + list.length + '"><div class="h"></div>'
            + list.map(function (s) { return '<div class="h"><a href="' + esc(k.sessionHash(s.id)) + '">' + titleOf(s) + '</a>' + sub(s, nm, null) + '</div>'; }).join('')
            + '<div class="k">' + loc('ss.result', '結果') + '</div>' + list.map(function (s) { return '<div>' + result(s) + '</div>'; }).join('')
            + line(loc('ss.cost', '花費'), list.map(function (s) { return k.cost(s); }), usdF)
            + line(loc('ss.main', '主 session'), list.map(function (s) { return s.usd || 0; }), usdF)
            + line(loc('ss.agentUsd', '派工'), list.map(function (s) { return s.agentUsd || 0; }), usdF)
            // station.js fills `requests` from the agents alone (lib/station.js:867); the main session's count is not there.
            + line(loc('ss.agentRequests', '派工 API 請求'), list.map(function (s) { return s.requests || 0; }), String)
            + line(loc('ss.agents', '派出 agent'), list.map(function (s) { return s.agents || 0; }), String)
            + line(loc('ss.tokens', 'token'), list.map(tokensOf), k.tokens)
            + '<div class="k">' + loc('ss.started', '開始') + '</div>' + list.map(function (s) { return '<div class="v">' + when(ms(s.started)) + '</div>'; }).join('');
        var stages = k.ROUTE.filter(function (g) { return list.some(function (s) { return stageUsd(s, g) > 0; }); });
        var max = Math.max.apply(null, [0].concat(list.map(function (s) { return Math.max.apply(null, [0].concat(stages.map(function (g) { return stageUsd(s, g); }))); })));
        if (stages.length) {
            out += '<div class="sec">' + loc('ss.stages', '各站花費') + '</div>' + stages.map(function (g) {
                return '<div class="k"><i class="dot" style="background:var(--st-' + g + ')"></i>' + g + '</div>' + list.map(function (s) {
                    var v = stageUsd(s, g);
                    return v > 0 ? '<div class="ss-bar" style="--c:var(--st-' + g + ')"><i style="width:' + Math.max(1, Math.round(v / max * 100)) + '%"' + tip(g, [usdF(v)]) + '></i></div>'
                        : '<div class="none">—</div>';
                }).join('');
            }).join('');
        }
        return out + '</div>';
    }
    function dialogHtml(all, names, land) {
        var list = st.picked.map(function (id) { return all.filter(function (s) { return s.id === id; })[0]; }).filter(Boolean);
        return '<dialog class="tdlg ss-dlg" id="ss-cmp" data-block="sessions-compare" aria-labelledby="ss-cmp-h"' + (land ? ' data-land' : '') + '><div class="tdlg-in">'
            + '<div class="tdlg-hd"><b id="ss-cmp-h">' + loc('ss.cmpTitle', '比較 {n} 個 session', { n: list.length }) + '</b>'
            + '<span class="tdlg-sub">' + loc('ss.cmpSub', '點標題開那個 session') + '</span>'
            + '<button type="button" class="tdlg-x" data-ss-close aria-label="' + esc(loc('ss.close', '關閉')) + '" title="' + esc(loc('ss.close', '關閉')) + '">' + I_X + '</button></div>'
            + '<div class="tdlg-p">' + (list.length >= 2 ? compareHtml(list, names) : '') + '</div>'
            + '<div class="tdlg-ft"><span>' + loc('ss.cmpFoot', '每一列較大的值標出來') + '</span></div></div></dialog>';
    }

    function page(S, o) {
        o = o || {};
        last = o;
        bind();
        var now = isFinite(o.now) ? o.now : Date.now(), names = o.names || {}, all = (S && S.sessions) || [];
        st.picked = st.picked.filter(function (id) { return all.some(function (s) { return s.id === id; }); });
        if (o.tray && !trayLanded) { trayLanded = true; if (st.picked.length >= 2) st.cmp = true; }
        if (!o.tray) trayLanded = false;
        if (st.picked.length < 2) st.cmp = false;
        var v = view(all, st, now), n = v.list.length;
        if (st.pg > Math.max(0, Math.ceil(n / PER) - 1)) st.pg = Math.max(0, Math.ceil(n / PER) - 1);
        var pk = [];
        all.forEach(function (s) { if (pk.indexOf(s.pkey) < 0) pk.push(s.pkey); });
        pk.sort();
        var colours = function (p) { return 'var(--p-' + Math.min(Math.max(pk.indexOf(p), 0), 5) + ')'; };
        var srt = SORTS[st.sort] || SORTS.last;
        var rows = n ? v.list.slice(st.pg * PER, st.pg * PER + PER).map(function (s) { return rowHtml(s, names, colours); }).join('')
            : '<tr><td colspan="6"><div class="ss-empty">' + loc('ss.empty', '沒有符合這些篩選的 session。') + '<br><button type="button" data-ss-reset>' + loc('ss.reset', '重設篩選') + '</button></div></td></tr>';
        var html = '<div class="ss" data-block="sessions-page">' + nowStrip(all) + periodsHtml(v.periods)
            + '<section class="dcard ss-list" data-block="sessions-list" aria-labelledby="ss-cap"><div class="ss-lh">'
            + '<h2 class="ss-cap" id="ss-cap"><span>' + sortText(srt[0]) + '</span><small>' + loc('ss.perPage', '{how}，一頁 {n} 筆', { how: sortText(st.dir < 0 ? srt[1] : srt[2]), n: PER }) + '</small></h2>'
            + '<div class="ss-filter controls lctl" data-block="sessions-filter" role="group" aria-label="' + esc(loc('ss.filters', '篩選 session')) + '">'
            + pickHtml('p', loc('ss.project', '專案'), I_PROJ, itemsOf('p', all, names, now))
            + pickHtml('g', loc('ss.stage', '停在哪一站'), I_STAGE, itemsOf('g', all, names, now))
            + pickHtml('c', loc('ss.costFloor', '花費'), I_COST, itemsOf('c', all, names, now))
            + (st.p || st.g || st.c ? '<button type="button" class="ss-reset" data-ss-reset>' + I_RESET + loc('ss.reset', '重設篩選') + '</button>' : '')
            + '</div></div>'
            + '<div class="ss-scroll"><table class="ss-t"><colgroup><col class="ck"><col><col class="res"><col class="usd"><col class="at"><col class="ck2"></colgroup><thead><tr>'
            + '<th scope="col"><span class="hm-sr">' + loc('ss.pick', '勾選來比較') + '</span></th>'
            + '<th scope="col">' + loc('ss.task', '任務 · 專案') + '</th><th scope="col">' + loc('ss.result', '結果') + '</th>'
            + th('usd', loc('ss.cost', '花費'), 'r') + th('last', loc('ss.last', '最後動靜'), 'c-at') + th('ck', loc('ss.elapsed', '用時'), 'r c-ck')
            + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
            + '<div class="ss-lf' + (o.tray ? ' tray' : '') + '" data-block="sessions-pager"><div class="ss-tray" role="region" aria-label="' + esc(loc('ss.trayRegion', '比較勾選的 session')) + '">' + trayHtml() + '</div>'
            + pagerHtml(n) + '</div></section></div>'
            + dialogHtml(all, names, Boolean(o.tray));
        if (st.cmp && w && typeof w.setTimeout === 'function') w.setTimeout(reopen, 0);
        return html;
    }
    // The poll's redraw replaced the dialog: open the new one again.
    function reopen() {
        var d = doc && doc.getElementById('ss-cmp');
        if (st.cmp && d && !d.open && typeof d.showModal === 'function') d.showModal();
    }
    function redraw() { if (last && typeof last.redraw === 'function') last.redraw(); }
    function toggle(id) {
        var i = st.picked.indexOf(id);
        if (i >= 0) st.picked.splice(i, 1);
        else if (st.picked.length < 3) st.picked.push(id);
    }
    function onClick(e) {
        var t = e && e.target, a;
        if (!t || typeof t.closest !== 'function' || !t.closest('[data-block="sessions-page"],[data-block="sessions-compare"]')) return;
        if ((a = t.closest('[data-ss-pop]'))) { var key = a.getAttribute('data-ss-pop'); st.pop = st.pop === key ? '' : key; return redraw(); }
        if ((a = t.closest('[data-ss-f]'))) { st[a.getAttribute('data-ss-f')] = a.getAttribute('data-v'); st.pop = ''; st.pg = 0; return redraw(); }
        var hadPop = st.pop;
        st.pop = '';
        if ((a = t.closest('[data-ss-d]'))) { st.d = a.getAttribute('data-ss-d'); st.pg = 0; return redraw(); }
        if ((a = t.closest('[data-ss-reset]'))) { st.p = st.g = st.c = ''; st.pg = 0; return redraw(); }
        if ((a = t.closest('[data-ss-sort]'))) {
            var sk = a.getAttribute('data-ss-sort');
            if (sk === st.sort) st.dir = -st.dir; else { st.sort = sk; st.dir = -1; }
            st.pg = 0;
            return redraw();
        }
        if ((a = t.closest('[data-ss-pg]'))) { if (!a.disabled) { st.pg = +a.getAttribute('data-ss-pg'); return redraw(); } return; }
        if ((a = t.closest('[data-ss-tick]'))) { toggle(a.getAttribute('data-ss-tick')); return redraw(); }
        if ((a = t.closest('[data-ss-cmp]'))) { if (st.picked.length >= 2) { st.cmp = true; return redraw(); } return; }
        if ((a = t.closest('[data-ss-clear]'))) { st.picked = []; st.cmp = false; return redraw(); }
        if ((a = t.closest('[data-ss-close]'))) {
            st.cmp = false;
            var d = doc && doc.getElementById('ss-cmp');
            if (d && d.open && typeof d.close === 'function') d.close();
            return;
        }
        if (t.closest('[data-block="sessions-compare"]') && t.closest('[href]')) { st.cmp = false; return; }
        if (hadPop) redraw();
    }
    function bind() {
        if (bound || !doc || typeof doc.addEventListener !== 'function') return;
        bound = true;
        doc.addEventListener('click', onClick);
        doc.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            if (st.cmp) st.cmp = false;
            else if (st.pop) { st.pop = ''; redraw(); }
        });
    }
    function state() { return st; }
    function reset() { st = fresh(); trayLanded = false; }

    var api = { page: page, view: view, compareHtml: compareHtml, onClick: onClick, state: state, reset: reset, EN: EN };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_SESSIONS = api;
}(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null));
