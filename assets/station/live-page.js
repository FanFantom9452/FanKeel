'use strict';
// assets/station/live-page.js — 進行中, the page `#/` and `#/live` draw
// (docs/90-agent/plans/2026-10-21-station-redesign-design.md §1; mockup
// route-live-a.html, blocks live-head, live-wait, live-run, live-stop; the
// row is _lp/r56-row.js). One head with the 進行中 | 全部 switch, then three
// cards: 等你回答 (a gate open, the session not ended), 正在跑 (live) and
// 可能停了 (stale). A row is one link to the session: the glyph (colour the
// state, lit segments the route walked, only the running stage pulses), the
// project chip over the task, the route as n/len and its stations, cost
// (main + agents) and the last move as an age; hover or focus shows the peek,
// which holds only fields the row already has. Two or more unnamed sessions
// in one card fold into one row. Reads `w.FK_KIT` (station.js) when it draws.
(function (w, doc) {
    var EN = {
        'lv.live': 'Live',
        'lv.all': 'All',
        'lv.wait': 'Waiting on you',
        'lv.run': 'Running',
        'lv.stop': 'May have stopped',
        'lv.noGate': 'No gate is waiting on you',
        'lv.noRun': 'No session is running',
        'lv.noStop': 'Nothing looks stopped',
        'lv.unnamed': '{n} unnamed',
        'lv.untitled': 'Unnamed · started {t}',
        'lv.init': 'Starting up, no route yet',
        'lv.glyph': '{state}, {stage}, stop {n} of {len}',
        'lv.route': 'Route, {len} stops: {r}',
        'lv.stage': 'Stage',
        'lv.model': 'Model',
        'lv.cost': 'Cost',
        'lv.costSplit': 'main {m} · agents {a}',
        'lv.started': 'Started',
        'lv.last': 'Last move',
        'lv.justNow': 'just now',
        'lv.min': '{n}m ago',
        'lv.hour': '{n}h ago',
        'lv.day': '{n}d ago',
    };
    function loc(key, zh, vars) {
        var I = w && w.FK_I18N;
        return kit().fillVars(I && I.lang === 'en' && Object.prototype.hasOwnProperty.call(EN, key) ? EN[key] : zh, vars);
    }
    function kit() { return (w && w.FK_KIT) || {}; }
    function esc(s) { return kit().esc(s); }
    function ms(t) { return typeof t === 'number' ? t : Date.parse(t); }
    function lastOf(s) {
        var a = ms(s.updated), b = ms(s.started);
        return Math.max(isFinite(a) ? a : 0, isFinite(b) ? b : 0);
    }
    function byLast(a, b) { return lastOf(b) - lastOf(a); }
    function two(n) { return ('0' + n).slice(-2); }
    function when(t) {
        if (!t || !isFinite(t)) return '—';
        var d = new Date(t);
        return two(d.getMonth() + 1) + '-' + two(d.getDate()) + ' ' + two(d.getHours()) + ':' + two(d.getMinutes());
    }
    function since(t, now) {
        if (!t) return '—';
        var m = Math.max(0, Math.round((now - t) / 60000));
        if (m < 2) return loc('lv.justNow', '剛剛');
        if (m < 60) return loc('lv.min', '{n}m 前', { n: m });
        if (m < 1440) return loc('lv.hour', '{n}h 前', { n: Math.floor(m / 60) });
        return loc('lv.day', '{n}d 前', { n: Math.floor(m / 1440) });
    }
    var CHEV = '<svg class="ico chev" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor"'
        + ' stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 6.2 8 9.8l3.5-3.6"/></svg>';

    // A session is in one group: an open gate first, then live, then stale.
    function groups(sessions) {
        var g = { wait: [], run: [], stop: [] };
        (sessions || []).forEach(function (s) {
            if (s.gateAt && s.state !== 'down') g.wait.push(s);
            else if (s.state === 'live') g.run.push(s);
            else if (s.state === 'stale') g.stop.push(s);
        });
        return g;
    }
    function title(kind) {
        if (kind === 'wait') return loc('lv.wait', '等你回答');
        if (kind === 'run') return loc('lv.run', '正在跑');
        return loc('lv.stop', '可能停了');
    }
    function placeOf(route, stage) {
        var at = route.indexOf(stage);
        return function (name) { var i = route.indexOf(name); return i < 0 ? null : i < at ? 'done' : i === at ? 'now' : 'todo'; };
    }
    function glyph(s, kind) {
        var k = kit(), route = s.route || [], at = route.indexOf(s.stage), place = placeOf(route, s.stage);
        var label = route.length && at >= 0
            ? loc('lv.glyph', '{state}，{stage}，第 {n} 站，共 {len} 站', { state: title(kind), stage: s.stage, n: at + 1, len: route.length })
            : title(kind) + ' · ' + loc('lv.init', '初始化中，還沒有路線');
        return k.keelGlyph({ cls: 'sx-g ' + kind + (route.length ? '' : ' bare'), seg: function (i) { return place(k.ROUTE[i]); },
            edge: route.length ? place('land') || 'todo' : 'todo' }) + '<span class="hm-sr">' + esc(label) + '</span>';
    }
    // n/len, then every station the task's route has: walked solid, here lit, ahead faint.
    function roadmap(s) {
        var route = s.route || [], at = route.indexOf(s.stage);
        if (!route.length || at < 0) {
            return '<span class="sx-rm"><span class="sx-n" aria-hidden="true">–</span><span class="sx-init">' + loc('lv.init', '初始化中，還沒有路線') + '</span></span>';
        }
        var li = route.map(function (name, i) {
            var c = i < at ? 'done' : i === at ? 'now' : 'todo';
            return '<li class="' + c + '" style="--c:var(--st-' + esc(name) + ')"' + (c === 'now' ? ' aria-current="step"' : '') + '><i aria-hidden="true"></i>'
                + (c === 'now' ? '<span class="hm-stw">' + esc(name) + '</span>' : esc(name)) + '</li>';
        }).join('');
        return '<span class="sx-rm"><span class="sx-n"><b>' + (at + 1) + '</b>/' + route.length + '</span>'
            + '<ol class="sx-rt" aria-label="' + esc(loc('lv.route', '路線 {len} 站：{r}', { len: route.length, r: route.join(' → ') })) + '">' + li + '</ol></span>';
    }
    function chip(s, o) {
        return '<span class="chip">' + esc(kit().shortLabel(o.names[s.pkey] || s.pkey || '')) + '</span>';
    }
    function taskText(s, now) {
        if (s.task) return esc(s.task);
        var t = ms(s.started);
        return esc(loc('lv.untitled', '未命名 · {t} 開始', { t: now - t < 864e5 ? when(t).slice(6) : when(t) }));
    }
    function peek(s) {
        var k = kit(), L = [];
        if (s.stage) L.push([loc('lv.stage', '這站'), esc(s.stage)]);
        if (s.model) L.push([loc('lv.model', '模型'), esc(k.modelLabel(k.modelKey(s.model)))]);
        L.push([loc('lv.cost', '花費'), esc(loc('lv.costSplit', '主 {m} · 派工 {a}', { m: k.usd(s.usd || 0, true), a: k.usd(s.agentUsd || 0, true) }))]);
        L.push([loc('lv.started', '開始'), when(ms(s.started))]);
        L.push([loc('lv.last', '最後動靜'), when(lastOf(s))]);
        L.push(['session', esc(String(s.id).slice(0, 8))]);
        return '<dl>' + L.map(function (l) { return '<dt>' + l[0] + '</dt><dd>' + l[1] + '</dd>'; }).join('') + '</dl>';
    }
    function row(s, kind, o) {
        var k = kit(), id8 = esc(String(s.id).slice(0, 8)), c = k.cost(s);
        return '<a class="hm-lv sxr' + (kind === 'stop' ? ' gone' : '') + '" href="' + esc(k.sessionHash(s.id)) + '" aria-describedby="pk-' + id8 + '">'
            + glyph(s, kind)
            + '<span class="hm-lv-p">' + chip(s, o) + '</span>'
            + '<span class="hm-lv-t' + (s.task ? '' : ' un') + '">' + taskText(s, o.now) + '</span>'
            + roadmap(s)
            + '<span class="sx-usd' + (c ? '' : ' z') + '">' + k.usd(c, true) + '</span>'
            + '<span class="hm-lv-r">' + since(lastOf(s), o.now) + '</span>'
            + '<div class="sx-pk" id="pk-' + id8 + '" role="tooltip">' + peek(s) + '</div></a>';
    }
    // Which fold is open, by group, so the poll's redraw keeps it open.
    var openUn = {}, bound = false;
    function bind() {
        if (bound || !doc || typeof doc.addEventListener !== 'function') return;
        bound = true;
        doc.addEventListener('click', function (e) {
            var t = e.target, sm = t && typeof t.closest === 'function' ? t.closest('summary[data-lv-sum]') : null;
            if (sm && sm.parentNode) openUn[sm.getAttribute('data-lv-sum')] = !sm.parentNode.open;
        });
        // Keyboard focus shows the peek (live-page.css); Esc hides it by giving the focus up.
        doc.addEventListener('keydown', function (e) {
            var a = doc.activeElement;
            if (e.key === 'Escape' && a && typeof a.matches === 'function' && a.matches('a.sxr')) a.blur();
        });
    }
    // Named rows by last move, then the unnamed: one is a row, more fold into "N 個未命名".
    function rowsOf(list, kind, o) {
        var k = kit();
        var named = list.filter(function (s) { return s.task; }).sort(byLast);
        var un = list.filter(function (s) { return !s.task; }).sort(byLast);
        var out = named.map(function (s) { return row(s, kind, o); }).join('');
        if (un.length === 1) return out + row(un[0], kind, o);
        if (!un.length) return out;
        var head = un[0], sum = un.reduce(function (n, s) { return n + k.cost(s); }, 0);
        var one = un.every(function (s) { return s.pkey === head.pkey; });
        return out + '<details class="sx-un" data-lv-un="' + kind + '"' + (openUn[kind] ? ' open' : '') + '>'
            + '<summary class="hm-lv sxr' + (kind === 'stop' ? ' gone' : '') + '" data-lv-sum="' + kind + '">' + glyph(head, kind)
            + '<span class="hm-lv-p">' + (one ? chip(head, o) : '') + '</span>'
            + '<span class="hm-lv-t un">' + loc('lv.unnamed', '{n} 個未命名', { n: un.length }) + CHEV + '</span>'
            + '<span class="sx-rm"><span class="sx-n" aria-hidden="true">–</span></span>'
            + '<span class="sx-usd' + (sum ? '' : ' z') + '">' + k.usd(sum, true) + '</span>'
            + '<span class="hm-lv-r">' + since(lastOf(head), o.now) + '</span></summary>'
            + '<div class="sx-sub">' + un.map(function (s) { return row(s, kind, o); }).join('') + '</div></details>';
    }
    function card(kind, list, o) {
        var k = kit(), n = list.length;
        var ico = kind === 'wait' ? 'gate' : kind === 'run' ? 'bot' : 'timer';
        var none = kind === 'wait' ? loc('lv.noGate', '沒有 gate 在等你') : kind === 'run' ? loc('lv.noRun', '沒有 session 在跑') : loc('lv.noStop', '沒有看起來停了的');
        return '<section class="dcard sx-' + kind + (n ? '' : ' sx-none') + '" data-block="live-' + kind + '" aria-label="' + esc(title(kind)) + '">'
            + '<div class="dcard-h">' + k.icon(ico) + '<b>' + title(kind) + '</b>'
            + '<span class="kn' + (!n ? ' z' : kind === 'wait' ? ' wait' : '') + '">' + n + '</span>'
            + (n ? '' : '<span class="sp"></span><span class="sx-hnote' + (kind === 'wait' ? ' ok' : '') + '" role="status">' + (kind === 'wait' ? k.icon('check') : '') + none + '</span>')
            + '</div>' + (n ? '<div class="dlist">' + rowsOf(list, kind, o) + '</div>' : '') + '</section>';
    }
    function page(S, o) {
        o = o || {};
        bind();
        var opt = { names: o.names || {}, now: isFinite(o.now) ? o.now : Date.now() };
        var all = (S && S.sessions) || [], g = groups(all), n = g.wait.length + g.run.length + g.stop.length;
        return '<div class="sxp" data-block="live-page">'
            + '<div class="phead khead sxh" data-block="live-head"><nav class="subtabs" aria-label="Sessions">'
            + '<a href="#/live" aria-current="page">' + loc('lv.live', '進行中') + '<b class="kn">' + n + '</b></a>'
            + '<a href="#/sessions">' + loc('lv.all', '全部') + '<b class="kn">' + all.length + '</b></a></nav></div>'
            + card('wait', g.wait, opt) + card('run', g.run, opt) + card('stop', g.stop, opt) + '</div>';
    }

    var api = { page: page, groups: groups, EN: EN };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_LIVE = api;
}(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null));
