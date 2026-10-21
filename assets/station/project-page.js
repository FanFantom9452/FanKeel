'use strict';
// assets/station/project-page.js — the project page `#/p/<pkey>` in the
// report layout (docs/90-agent/plans/2026-10-21-station-redesign-design.md §3,
// last bullet; mockup route-projects.html, blocks project-head, project-kpis,
// project-trend, project-stages, project-lists). Head (back to 專案, the name,
// the running session), six KPI tiles for the last 30 days printed from
// FK_PROJECTS.rowsOf — the row #/projects prints, computed once — a four-week
// trend of cost (main / agents) and landings, one card a stage with the median
// 做事 and the median 等你 drawn end to end on one scale, the TODO tabs (`#/p/<pkey>/todo/<id>`
// opens that entry's tab), and the recent landings. Reads `w.FK_KIT` when it draws.
(function (w, doc) {
    var EN = {
        'pp.back': 'Projects',
        'pp.none': 'No session or TODO list belongs to this project.',
        'pp.now': 'Now',
        'pp.last': 'Last move {t}',
        'pp.kpis': 'Last 30 days',
        'pp.cost': 'Cost',
        'pp.landed': 'Landed',
        'pp.cpl': 'Per landing',
        'pp.dtl': 'Days to land',
        'pp.todo': 'Open TODO',
        'pp.overdue': 'Overdue',
        'pp.trend': 'Weekly cost and landings',
        'pp.week': 'week of {d}',
        'pp.main': 'main {v}',
        'pp.agent': 'agents {v}',
        'pp.nLanded': '{n} landed',
        'pp.costRow': 'Cost',
        'pp.landRow': 'Landed',
        'pp.stages': 'Stages',
        'pp.work': 'working {t}',
        'pp.wait': 'waiting on you {t}',
        'pp.passed': '{n} passed',
        'pp.noStages': 'No stage of this project has both ends timed yet.',
        'pp.lists': 'TODO',
        'pp.ready': 'Ready',
        'pp.decision': 'Needs a decision',
        'pp.blocked': 'Blocked',
        'pp.watch': 'Watch',
        'pp.dueOn': 'due {d}',
        'pp.noTodo': 'Nothing in this state.',
        'pp.noList': 'This project keeps no TODO entries.',
        'pp.landedList': 'Recent landings',
        'pp.noLanded': 'Nothing has landed yet.',
    };
    function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    function loc(key, zh, vars) {
        var I = w && w.FK_I18N;
        return kit().fillVars(I && I.lang === 'en' && has(EN, key) ? EN[key] : zh, vars);
    }
    function kit() { return (w && w.FK_KIT) || {}; }
    function esc(s) { return kit().esc(s); }
    function tip(label, values) { return w && w.FK_TIP ? w.FK_TIP.attr(label, values) : ''; }
    function ms(t) { return typeof t === 'number' ? t : Date.parse(t); }
    function plain(s) { return String(s == null ? '' : s).split('**').join(''); }
    function median(xs) {
        if (!xs.length) return null;
        var s = xs.slice().sort(function (a, b) { return a - b; }), h = s.length >> 1;
        return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
    }
    function since(t, now) {
        if (!t) return '—';
        var m = Math.max(0, Math.round((now - t) / 60000));
        if (m < 60) return m + 'm';
        if (m < 1440) return Math.floor(m / 60) + 'h';
        return Math.floor(m / 1440) + 'd';
    }
    var STATES = ['ready', 'decision', 'blocked', 'watch'];
    var st = { pkey: null, tab: null, seen: null }, last = null, bound = false;

    function stateName(s) {
        if (s === 'ready') return loc('pp.ready', 'Ready');
        if (s === 'decision') return loc('pp.decision', '待決定');
        if (s === 'blocked') return loc('pp.blocked', 'Blocked');
        return loc('pp.watch', 'Watch');
    }
    function headHtml(pkey, list, names, now) {
        var k = kit(), run = list.filter(function (s) { return s.state === 'live'; }).sort(function (a, b) { return ms(b.updated) - ms(a.updated); })[0];
        var lastMove = Math.max.apply(null, [0].concat(list.map(function (s) { return ms(s.updated) || 0; })));
        var root = list.length ? list[0].root : '';
        return '<section class="dcard ph" data-block="project-head">'
            + '<a class="ph-back" href="#/projects">' + loc('pp.back', '專案') + '</a>'
            + '<div class="ph-id"><h2>' + esc(k.shortLabel(names[pkey] || pkey)) + '</h2><p title="' + esc(pkey) + '">' + esc(names[pkey] || root || pkey) + '</p></div>'
            + (run ? '<a class="ph-now" href="' + esc(k.sessionHash(run.id)) + '"><span class="ph-now-l">' + loc('pp.now', '現在')
                + ' <span class="hm-stw" style="--c:var(--st-' + esc(run.stage) + ')">' + esc(run.stage) + '</span></span><span class="ph-now-t">' + esc(run.task || run.id) + '</span></a>' : '<span></span>')
            + '<ul class="ph-facts"><li>' + esc(loc('pp.last', '最後動靜 {t}', { t: since(lastMove, now) })) + '</li></ul></section>';
    }
    function kpisHtml(row) {
        var k = kit();
        var tile = function (id, label, v) { return '<div class="kp" data-kp="' + id + '"><span class="kp-l">' + label + '</span><span class="kp-v">' + v + '</span></div>'; };
        return '<section class="dcard kps" data-block="project-kpis" aria-label="' + esc(loc('pp.kpis', '近 30 天')) + '">'
            + tile('usd', loc('pp.cost', '花費'), k.usd(row.usd, true))
            + tile('landed', loc('pp.landed', '落地'), String(row.landed))
            + tile('cpl', loc('pp.cpl', '每筆落地'), row.cpl === null ? '—' : k.usd(row.cpl, true))
            + tile('dtl', loc('pp.dtl', '落地天數'), row.dtl === null ? '—' : String(Math.round(row.dtl * 10) / 10))
            + tile('todo', loc('pp.todo', '開著的 TODO'), String(row.todo))
            + tile('overdue', loc('pp.overdue', '到期'), String(row.overdue)) + '</section>';
    }
    // Four weeks ending today: cost from `days` split main / agents, landings by `updated`; each series one scale.
    // Weeks are local calendar days (lastDays), not 864e5 steps, so a daylight-saving week keeps its seven dates.
    function trendHtml(list, now) {
        var k = kit(), days = k.lastDays(now, 28), W = [];
        for (var i = 0; i < 4; i++) W.push({ fromDay: days[i * 7], toDay: days[i * 7 + 6], main: 0, agent: 0, land: 0 });
        var weekOf = function (day) { return W.filter(function (wk) { return day >= wk.fromDay && day <= wk.toDay; })[0]; };
        list.forEach(function (s) {
            (s.days || []).forEach(function (x) {
                var wk = x && typeof x.usd === 'number' ? weekOf(x.day) : null;
                if (!wk) return;
                if (x.who === 'main') wk.main += x.usd; else wk.agent += x.usd;
            });
            var up = ms(s.updated), wk = s.stage === 'land' && s.state === 'down' && isFinite(up) ? weekOf(k.localDay(up)) : null;
            if (wk) wk.land++;
        });
        var maxU = Math.max.apply(null, [0.01].concat(W.map(function (wk) { return wk.main + wk.agent; })));
        var maxL = Math.max.apply(null, [1].concat(W.map(function (wk) { return wk.land; })));
        var h = function (v, max) { return v > 0 ? Math.max(2, Math.round(v / max * 100)) : 0; };
        return '<section class="dcard trd" data-block="project-trend" aria-label="' + esc(loc('pp.trend', '每週花費與落地')) + '">'
            + '<div class="dcard-h"><b>' + loc('pp.trend', '每週花費與落地') + '</b></div>'
            + '<div class="tr-rows"><span class="tr-k">' + loc('pp.costRow', '花費') + '</span><div class="tr-plot">' + W.map(function (wk, j) {
                var label = loc('pp.week', '{d} 那週', { d: wk.fromDay.slice(5) });
                return '<span class="tr-wk" data-wk="' + j + '"><span class="tr-stack">'
                    + (wk.agent > 0 ? '<i class="seg agent" style="height:' + h(wk.agent, maxU) + '%"' + tip(label, [loc('pp.agent', '派工 {v}', { v: k.usd(wk.agent, true) })]) + '></i>' : '')
                    + (wk.main > 0 ? '<i class="seg main" style="height:' + h(wk.main, maxU) + '%"' + tip(label, [loc('pp.main', '主 {v}', { v: k.usd(wk.main, true) })]) + '></i>' : '')
                    + '</span><small>' + wk.fromDay.slice(5) + '</small></span>';
            }).join('') + '</div>'
            + '<span class="tr-k">' + loc('pp.landRow', '落地') + '</span><div class="tr-plot land">' + W.map(function (wk) {
                var label = loc('pp.week', '{d} 那週', { d: wk.fromDay.slice(5) });
                return '<span class="tr-wl"><span class="tr-stack">' + (wk.land ? '<i class="seg land" style="height:' + h(wk.land, maxL) + '%"'
                    + tip(label, [loc('pp.nLanded', '落地 {n} 筆', { n: wk.land })]) + '></i>' : '') + '</span></span>';
            }).join('') + '</div></div></section>';
    }
    // One card a stage: the median 做事 and, taken separately, the median 等你 of the project's
    // timed stays, drawn end to end on one scale — their sum is not the median stay.
    function stagesHtml(list) {
        var k = kit(), by = {};
        list.forEach(function (s) {
            (s.stages || []).forEach(function (x) {
                if (!x || typeof x.from !== 'number' || typeof x.to !== 'number' || !(x.to > x.from)) return;
                var wait = Math.min(Math.max(x.waited || 0, 0), x.to - x.from);
                (by[x.stage] = by[x.stage] || []).push({ work: x.to - x.from - wait, wait: wait });
            });
        });
        var stages = k.ROUTE.filter(function (g) { return by[g]; }).map(function (g) {
            return { g: g, n: by[g].length, work: median(by[g].map(function (x) { return x.work; })), wait: median(by[g].map(function (x) { return x.wait; })) };
        });
        var max = Math.max.apply(null, [1].concat(stages.map(function (m) { return m.work + m.wait; })));
        var pct = function (v) { return Math.max(1, Math.round(v / max * 100)); };
        return '<section class="dcard sgs" data-block="project-stages" aria-label="' + esc(loc('pp.stages', '各站')) + '">'
            + '<div class="dcard-h"><b>' + loc('pp.stages', '各站') + '</b></div>'
            + (stages.length ? '<ul class="sg-l">' + stages.map(function (m) {
                return '<li class="sg" data-stage="' + m.g + '"><span class="sg-h"><span class="hm-stw" style="--c:var(--st-' + m.g + ')">' + m.g + '</span>'
                    + '<small>' + loc('pp.passed', '{n} 筆經過', { n: m.n }) + '</small></span><span class="pj-bar">'
                    + (m.work > 0 ? '<i class="seg work" style="width:' + pct(m.work) + '%"' + tip(m.g, [loc('pp.work', '做事 {t}', { t: k.mins(m.work) })]) + '></i>' : '')
                    + (m.wait > 0 ? '<i class="seg wait" style="width:' + pct(m.wait) + '%"' + tip(m.g, [loc('pp.wait', '等你回答 {t}', { t: k.mins(m.wait) })]) + '></i>' : '')
                    + '</span></li>';
            }).join('') + '</ul>' : '<p class="an-empty">' + loc('pp.noStages', '這個專案還沒有哪一站頭尾都有計時。') + '</p>') + '</section>';
    }
    function todoHtml(open, focus) {
        var by = {};
        STATES.forEach(function (s) { by[s] = []; });
        open.forEach(function (x) { if (by[x.state]) by[x.state].push(x); });
        var hit = focus ? open.filter(function (x) { return x.id === focus; })[0] : null;
        if (hit && by[hit.state] && st.seen !== focus) st.tab = hit.state;
        st.seen = focus;
        if (!st.tab) st.tab = STATES.filter(function (s) { return by[s].length; })[0] || 'ready';
        var rows = by[st.tab];
        return '<section class="dcard pls" data-block="project-lists" aria-label="TODO"><div class="dcard-h"><b>' + loc('pp.lists', 'TODO') + '</b></div>'
            + (open.length ? '<div class="ptd-tabs" role="tablist">' + STATES.map(function (s) {
                var due = by[s].filter(function (x) { return x.due; }).length;
                return '<button type="button" role="tab" data-pp-tab="' + s + '" aria-selected="' + (s === st.tab) + '" data-st="' + s + '">'
                    + '<span class="tt-h">' + stateName(s) + ' <b>' + by[s].length + '</b></span>' + (due ? '<em class="due">' + loc('pp.overdue', '到期') + ' ' + due + '</em>' : '') + '</button>';
            }).join('') + '</div>'
                + (rows.length ? '<ul class="tl">' + rows.map(function (x) {
                    var id = x.id ? ' id="todo-' + esc(x.id) + '"' : '';
                    return '<li' + id + (hit && x === hit ? ' aria-current="true"' : '') + '><div class="tr"><span class="tr-lb">' + esc(x.label || '') + '</span>'
                        + '<span class="tr-tx"><b>' + esc(plain(x.title)) + '</b>' + (x.description ? '<span class="tr-cd">' + esc(plain(x.description)) + '</span>' : '')
                        + (x.condition ? '<span class="tr-cd">' + esc(plain(x.condition)) + '</span>' : '') + '</span>'
                        + (x.dueAt ? '<span class="tr-due' + (x.due ? ' soon' : '') + '">' + esc(loc('pp.dueOn', '{d} 到期', { d: kit().localDay(x.dueAt).slice(5) })) + '</span>' : '<span></span>')
                        + '</div></li>';
                }).join('') + '</ul>' : '<p class="an-empty">' + loc('pp.noTodo', '這個狀態沒有條目。') + '</p>')
                : '<p class="an-empty">' + loc('pp.noList', '這個專案沒有 TODO 條目。') + '</p>') + '</section>';
    }
    function landedHtml(list) {
        var k = kit(), land = list.filter(function (s) { return s.stage === 'land' && s.state === 'down'; })
            .sort(function (a, b) { return ms(b.updated) - ms(a.updated); }).slice(0, 8);
        return '<section class="dcard pld" data-block="project-landed" aria-label="' + esc(loc('pp.landedList', '最近落地')) + '">'
            + '<div class="dcard-h"><b>' + loc('pp.landedList', '最近落地') + '</b></div>'
            + (land.length ? '<ul class="pl-l">' + land.map(function (s) {
                return '<li><a href="' + esc(k.sessionHash(s.id)) + '"><span class="pl-t">' + esc(s.task || s.id) + '</span>'
                    + '<span class="pl-d">' + k.localDay(ms(s.updated)).slice(5) + '</span><span class="pl-u">' + k.usd(k.cost(s), true) + '</span></a></li>';
            }).join('') + '</ul>' : '<p class="an-empty">' + loc('pp.noLanded', '還沒有任務走到 land。') + '</p>') + '</section>';
    }

    function page(S, pkey, o) {
        o = o || {};
        last = o;
        bind();
        if (st.pkey !== pkey) st = { pkey: pkey, tab: null, seen: null };
        var now = isFinite(o.now) ? o.now : Date.now(), names = o.names || {};
        var list = ((S && S.sessions) || []).filter(function (s) { return s.pkey === pkey; });
        var open = [], kept = false;
        ((S && S.projects) || []).forEach(function (p) {
            (p.todos || []).forEach(function (t) { if (t.pkey === pkey) { kept = true; open = open.concat(t.open || []); } });
        });
        if (!list.length && !kept) {
            return '<div class="pp" data-block="project-page"><a class="ph-back" href="#/projects">' + loc('pp.back', '專案') + '</a>'
                + '<p class="pp-none">' + loc('pp.none', '這個專案沒有 session，也沒有 TODO 清單。') + '</p></div>';
        }
        var P = w && w.FK_PROJECTS;
        var row = (P ? P.rowsOf(S, 30, now) : []).filter(function (r) { return r.pkey === pkey; })[0]
            || { usd: 0, landed: 0, cpl: null, dtl: null, todo: open.length, overdue: open.filter(function (x) { return x.due; }).length };
        if (o.todo && w && typeof w.setTimeout === 'function') {
            w.setTimeout(function () { var el = doc && doc.getElementById('todo-' + o.todo); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' }); }, 0);
        }
        return '<div class="pp" data-block="project-page">' + headHtml(pkey, list, names, now) + kpisHtml(row)
            + '<div class="pp-row2">' + trendHtml(list, now) + stagesHtml(list) + '</div>'
            + '<div class="pp-row3">' + todoHtml(open, o.todo) + landedHtml(list) + '</div></div>';
    }
    function onClick(e) {
        var t = e && e.target, a = t && typeof t.closest === 'function' ? t.closest('[data-pp-tab]') : null;
        if (!a) return;
        var s = a.getAttribute('data-pp-tab');
        if (STATES.indexOf(s) < 0) return;
        st.tab = s;
        if (last && typeof last.redraw === 'function') last.redraw();
    }
    function bind() {
        if (bound || !doc || typeof doc.addEventListener !== 'function') return;
        bound = true;
        doc.addEventListener('click', onClick);
    }
    function state() { return st; }
    function reset() { st = { pkey: null, tab: null, seen: null }; }

    var api = { page: page, onClick: onClick, state: state, reset: reset, EN: EN };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_PROJECT = api;
}(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null));
