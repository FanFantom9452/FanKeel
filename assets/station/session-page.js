'use strict';
// assets/station/session-page.js — the session page, #/s/<id> (design
// 2026-10-21-station-redesign §4; mockup route-session.html, blocks
// session-head, session-tabs, session-run, session-landed): the head's task,
// project chip and three bars, the tabs 經過 / 派工 / 對話 with 關卡 only
// while a gate waits, 經過 as one row a stage on two shared scales, and the
// landed card when the session's plan has tasks. 派工 is session-dispatch.js
// and 對話 session-talk.js. Every figure sits in a tooltip (tip.js) on the
// one segment it belongs to. Loaded before station.js, whose router calls page().
(function (w, doc) {
    var EN = {
        'spage.work': 'Working',
        'spage.wait': 'Waiting on you',
        'spage.share': '{p} of it',
        'spage.time': 'Time',
        'spage.cost': 'Cost',
        'spage.disp': 'Dispatch',
        'spage.main': 'Main session',
        'spage.agents': 'Agents',
        'spage.nAgents': '{n} agents',
        'spage.noAgent': 'No agent came back',
        'spage.unnamed': '(unnamed)',
        'spage.live': 'Running',
        'spage.stale': 'May have stopped',
        'spage.down': 'Done',
        'spage.tabs': 'Tabs',
        'spage.tabRun': 'Timeline',
        'spage.tabDisp': 'Dispatch',
        'spage.tabTalk': 'Talk',
        'spage.gate': 'Gate',
        'spage.run': 'Timeline',
        'spage.axis': 'Each stage on one scale',
        'spage.stageCost': 'Cost',
        'spage.rest': 'Other',
        'spage.restWhy': 'Spent outside any timed stage',
        'spage.evOut': 'Dispatched',
        'spage.evGate': 'Question',
        'spage.evCommit': 'commit {sha}',
        'spage.evPass': 'Tests passed',
        'spage.evFail': 'Tests failed',
        'spage.evYou': 'You said',
        'spage.noEvents': 'No events recorded in this stage',
        'spage.loading': 'Reading the detail…',
        'spage.noDetail': 'This machine has no transcript for this session',
        'spage.noStages': 'No stage was timed',
        'spage.landed': 'Landed',
        'spage.allTasks': 'All tasks',
        'spage.done': 'Done',
        'spage.notDone': 'Not done',
        'spage.close': 'Close',
    };
    function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    function fill(s, vars) {
        return vars ? String(s).replace(/\{(\w+)\}/g, function (m, k) { return has(vars, k) ? String(vars[k]) : m; }) : s;
    }
    function loc(key, zh, vars) {
        var I = w && w.FK_I18N;
        return fill(I && I.lang === 'en' && has(EN, key) ? EN[key] : zh, vars);
    }
    function kit() { return (w && w.FK_KIT) || {}; }
    function esc(s) { return kit().esc(s); }
    function num(v) { return typeof v === 'number' && isFinite(v); }
    // A segment's tooltip: one label, at most two values (tip.js). Without
    // tip.js the segment still takes focus and says the same in its title.
    function tip(label, vals) {
        var v = (vals || []).filter(function (x) { return x !== null && x !== undefined && x !== ''; }).map(String).slice(0, 2);
        var T = w && w.FK_TIP;
        return T ? T.attr(String(label), v) : ' tabindex="0" title="' + esc([label].concat(v).join(' · ')) + '"';
    }
    function pct(n, d) { return d > 0 ? Math.round(n / d * 100) + '%' : '0%'; }
    function hm(ms) {
        var d = new Date(ms);
        return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }
    function clip(t, n) { var s = String(t || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

    var LETTER = { fable: 'F', opus: 'O', sonnet: 'S', haiku: 'H', other: '?' };
    function fam(model) { var f = kit().family(model); return has(LETTER, f) ? f : 'other'; }

    // The stages the registry timed, in the order entered: the window, the
    // gate waits inside it (`waited`, never more than the window), the rest of
    // it as 做事, and what the stage cost (main and agents together).
    function stagesOf(s) {
        return ((s && s.stages) || []).filter(function (g) { return num(g.from) && num(g.to) && g.to >= g.from; }).map(function (g) {
            var span = g.to - g.from, wait = Math.min(span, num(g.waited) && g.waited > 0 ? g.waited : 0);
            return { stage: g.stage, from: g.from, to: g.to, span: span, wait: wait, work: span - wait, usd: num(g.usd) && g.usd > 0 ? g.usd : 0 };
        });
    }
    function stageOf(stages, t) {
        if (!num(t)) return null;
        for (var i = 0; i < stages.length; i++) if (t >= stages[i].from && t <= stages[i].to) return stages[i].stage;
        return null;
    }
    // When an agent began: its first request, else when its dispatch went out.
    function agentAt(x, r) {
        if (num(r.from)) return r.from;
        var d = x && x.dispatches && num(r.disp) ? x.dispatches[r.disp] : null;
        return d && num(d.out) ? d.out : NaN;
    }
    function detailNote(s) {
        return s.hasDetail ? loc('spage.loading', '讀取細節…') : loc('spage.noDetail', '這台機器上沒有這個 session 的 transcript');
    }

    // ---- the head ----
    function glyph(s) {
        var k = kit(), route = s.route || [], at = route.indexOf(s.stage);
        var state = function (st) { var i = route.indexOf(st); return i < 0 ? null : i < at ? 'done' : i === at ? 'now' : 'todo'; };
        return k.keelGlyph({ cls: 'prog' + (s.state === 'live' && !s.gateAt ? ' live' : ''), seg: function (i) { return state(k.ROUTE[i]); },
            edge: state('land'), c: at >= 0 ? 'var(--st-' + esc(s.stage) + ')' : '' });
    }
    function timeBar(st) {
        var k = kit(), work = 0, wait = 0;
        st.forEach(function (g) { work += g.work; wait += g.wait; });
        var all = work + wait;
        if (!all) return '<span class="sv-bar sv-time none"></span>';
        return '<span class="sv-bar sv-time">'
            + (work ? '<i class="wk" style="flex:' + work + '" data-ms="' + work + '"' + tip(loc('spage.work', '做事'), [k.mins(work), loc('spage.share', '佔 {p}', { p: pct(work, all) })]) + '></i>' : '')
            + (wait ? '<i class="wt" style="flex:' + wait + '" data-ms="' + wait + '"' + tip(loc('spage.wait', '等你回答'), [k.mins(wait), loc('spage.share', '佔 {p}', { p: pct(wait, all) })]) + '></i>' : '')
            + '</span>';
    }
    function costBar(s) {
        var k = kit(), main = s.usd || 0, ag = s.agentUsd || 0, all = main + ag;
        if (!(all > 0)) return '<span class="sv-bar sv-cost none"></span>';
        return '<span class="sv-bar sv-cost">'
            + (main ? '<i class="m" style="flex:' + main + '" data-usd="' + main + '"' + tip(loc('spage.main', '主 session'), [k.usd(main, true), loc('spage.share', '佔 {p}', { p: pct(main, all) })]) + '></i>' : '')
            + (ag ? '<i class="a" style="flex:' + ag + '" data-usd="' + ag + '"' + tip(loc('spage.agents', '派工'), [k.usd(ag, true), loc('spage.share', '佔 {p}', { p: pct(ag, all) })]) + '></i>' : '')
            + '</span>';
    }
    // One pip an agent, grouped by the dispatch that sent it and coloured by
    // model; the group's tooltip spells the models out as letters, so the
    // colour is never alone.
    function pips(x) {
        if (!x || !(x.dispatches || []).length) return '<span class="sv-pips none"></span>';
        var byId = {};
        (x.rows || []).forEach(function (r) { byId[r.id] = r; });
        return '<span class="sv-pips">' + x.dispatches.map(function (d) {
            var rows = (d.ids || []).map(function (id) { return byId[id]; }).filter(Boolean);
            var letters = rows.map(function (r) { return LETTER[fam(r.model)]; }).join('');
            return '<span class="g"' + tip(d.text || d.agentType || d.surface, [rows.length ? loc('spage.nAgents', '{n} 個 agent', { n: rows.length }) : loc('spage.noAgent', '沒有 agent 回來'), letters]) + '>'
                + (rows.length ? rows.map(function (r) { return '<i style="--c:var(--dx-' + fam(r.model) + ')"></i>'; }).join('') : '<i class="none"></i>') + '</span>';
        }).join('') + '</span>';
    }
    function stateChip(s) {
        var t = s.state === 'live' ? loc('spage.live', '執行中') : s.state === 'stale' ? loc('spage.stale', '可能停了') : loc('spage.down', '收工');
        return '<span class="ss-st ' + esc(s.state || 'down') + '">' + t + '</span>';
    }
    function head(s, x, o) {
        var k = kit(), names = o.names || {};
        return '<section class="dcard gt-head" data-block="session-head">' + glyph(s)
            + '<div class="gt-id"><div class="sh-tl"><h1 class="gt-task">' + esc(s.task || loc('spage.unnamed', '（未命名）')) + '</h1>'
            + '<a class="sh-proj" href="' + k.projectHash(s.pkey) + '">' + esc(names[s.pkey] || s.project || s.pkey) + '</a>' + stateChip(s) + '</div></div>'
            + '<div class="sh-viz">'
            + '<div class="sv" data-block="session-head-time"><span class="sv-l">' + loc('spage.time', '時間') + '</span>' + timeBar(stagesOf(s)) + '</div>'
            + '<div class="sv" data-block="session-head-cost"><span class="sv-l">' + loc('spage.cost', '花費') + '</span>' + costBar(s) + '</div>'
            + '<div class="sv" data-block="session-head-dispatch"><a class="sv-l" href="' + k.sessionHash(s.id, 'dispatch') + '">' + loc('spage.disp', '派工') + '</a>' + pips(x) + '</div>'
            + '</div></section>';
    }
    function tabs(s, tab, serve) {
        var k = kit();
        var list = [['timeline', loc('spage.tabRun', '經過')], ['dispatch', loc('spage.tabDisp', '派工')], ['talk', loc('spage.tabTalk', '對話')]];
        var gate = s.gateAt ? '<a class="out" data-block="session-gate-link" href="' + (serve ? '/f/' + encodeURIComponent(s.id) + '/gate' : k.sessionHash(s.id, 'gate')) + '">'
            + k.icon('gate') + loc('spage.gate', '關卡') + '</a>' : '';
        return '<nav class="ss-tabs" data-block="session-tabs" aria-label="' + loc('spage.tabs', '分頁') + '"><div class="subtabs" role="tablist">'
            + list.map(function (t) {
                return '<a href="' + k.sessionHash(s.id, t[0]) + '" role="tab" aria-selected="' + (t[0] === tab ? 'true' : 'false') + '">' + t[1] + '</a>';
            }).join('') + gate + '</div></nav>';
    }

    // ---- 經過 ----
    // What happened inside one stage's window, in order, one mark a thing.
    function chain(g, x) {
        var k = kit();
        var items = (x.events || []).filter(function (e) { return num(e.t) && e.t >= g.from && e.t <= g.to; }).map(function (e) {
            if (e.kind === 'out') return '<li class="ch bot"' + tip(loc('spage.evOut', '派工') + ' · ' + hm(e.t), [e.text, e.agentType || e.alias]) + '>' + k.icon('bot') + '</li>';
            if (e.kind === 'gate') {
                var q = (e.qs || [])[0] || {};
                return '<li class="ch ask"' + tip(loc('spage.evGate', '提問') + ' · ' + hm(e.t), [q.q, q.a]) + '>' + k.icon('gate') + '</li>';
            }
            if (e.kind === 'commit') return '<li class="ch cm"' + tip(loc('spage.evCommit', 'commit {sha}', { sha: e.sha }) + ' · ' + hm(e.t), [e.text]) + '>' + k.icon('commit') + '</li>';
            if (e.kind === 'test') {
                var bad = /fail ([1-9]\d*)/.test(e.text || '');
                return '<li class="ch ' + (bad ? 'bad' : 'ok') + '"' + tip((bad ? loc('spage.evFail', '測試紅') : loc('spage.evPass', '測試綠')) + ' · ' + hm(e.t), [e.text]) + '>' + k.icon(bad ? 'close' : 'check') + '</li>';
            }
            if (e.kind === 'prompt') return '<li class="ch you"' + tip(loc('spage.evYou', '你說') + ' · ' + hm(e.t), [clip(e.text, 120)]) + '><i class="you-dot" aria-hidden="true"></i></li>';
            return '';
        }).join('');
        return items ? '<ol class="rd-ch">' + items + '</ol>' : '<p class="rd-none">' + loc('spage.noEvents', '這站沒有記下的事件') + '</p>';
    }
    // One row a stage: its time on a scale every stage shares, split 做事 /
    // 等你回答, and its cost on a scale every stage shares, split main /
    // agents by where each agent began. What no stage holds is one more row,
    // 其他, so the cost segments add up to the head's total.
    function runCard(s, x) {
        var k = kit(), st = stagesOf(s);
        var top = '<section class="dcard ss-run" data-block="session-run"><div class="dcard-h">' + k.icon('timer') + '<b>' + loc('spage.run', '經過') + '</b>';
        if (!st.length) return top + '</div><p class="tally">' + loc('spage.noStages', '沒有一站有計時') + '</p></section>';
        var by = {};
        if (x) (x.rows || []).forEach(function (r) {
            var at = stageOf(st, agentAt(x, r));
            if (at) by[at] = (by[at] || 0) + (r.usd || 0);
        });
        var staged = st.reduce(function (n, g) { return n + g.usd; }, 0);
        var rest = k.cost(s) - staged;
        var maxT = Math.max.apply(null, st.map(function (g) { return g.span; })) || 1;
        var maxU = Math.max.apply(null, st.map(function (g) { return g.usd; }).concat(rest > 0.005 ? [rest] : [])) || 1;
        var row = function (g) {
            var ag = Math.min(g.usd, by[g.stage] || 0), main = g.usd - ag, name = esc(g.stage);
            var seg = '<span class="rd-bar"><span class="rd-seg" style="--w:' + (g.span / maxT * 100).toFixed(3) + '%">'
                + (g.work ? '<i class="wk" style="flex:' + g.work + '" data-ms="' + g.work + '"' + tip(g.stage + ' · ' + loc('spage.work', '做事'), [k.mins(g.work), loc('spage.share', '佔 {p}', { p: pct(g.work, g.span) })]) + '></i>' : '')
                + (g.wait ? '<i class="wt" style="flex:' + g.wait + '" data-ms="' + g.wait + '"' + tip(g.stage + ' · ' + loc('spage.wait', '等你回答'), [k.mins(g.wait), loc('spage.share', '佔 {p}', { p: pct(g.wait, g.span) })]) + '></i>' : '')
                + '</span></span>';
            var cost = g.usd ? '<span class="rd-cost"><span style="--w:' + (g.usd / maxU * 100).toFixed(3) + '%">'
                + (main ? '<i class="m" style="flex:' + main + '" data-usd="' + main + '"' + tip(g.stage + ' · ' + loc('spage.main', '主 session'), [k.usd(main, true), loc('spage.share', '佔 {p}', { p: pct(main, g.usd) })]) + '></i>' : '')
                + (ag ? '<i class="a" style="flex:' + ag + '" data-usd="' + ag + '"' + tip(g.stage + ' · ' + loc('spage.agents', '派工'), [k.usd(ag, true), loc('spage.share', '佔 {p}', { p: pct(ag, g.usd) })]) + '></i>' : '')
                + '</span></span>' : '<span class="rd-cost none"></span>';
            return '<li><details class="rd-stop" data-key="rd-' + name + '" style="--c:var(--st-' + name + ')"><summary class="rd-h"><span class="rd-dot" aria-hidden="true"></span>'
                + '<b class="rd-nm">' + name + '</b>' + seg + cost + k.icon('chev') + '</summary>'
                + '<div class="rd-b">' + (x ? chain(g, x) : '<p class="rd-none">' + detailNote(s) + '</p>') + '</div></details></li>';
        };
        var other = rest > 0.005 ? '<li class="rd-mark"><span class="rd-dot" aria-hidden="true"></span><span class="rd-nm">' + loc('spage.rest', '其他') + '</span><span class="rd-bar"></span>'
            + '<span class="rd-cost"><span style="--w:' + (rest / maxU * 100).toFixed(3) + '%"><i class="o" style="flex:1" data-usd="' + rest + '"'
            + tip(loc('spage.rest', '其他'), [k.usd(rest, true), loc('spage.restWhy', '花在沒計時的時段')]) + '></i></span></span><span></span></li>' : '';
        return top + '<span class="gt-hr rd-key"><span><i class="wksw" aria-hidden="true"></i>' + loc('spage.work', '做事') + '</span>'
            + '<span><i class="hatchsw" aria-hidden="true"></i>' + loc('spage.wait', '等你回答') + '</span>'
            + '<span><i class="ksw m" aria-hidden="true"></i>' + loc('spage.main', '主 session') + '</span>'
            + '<span><i class="ksw a" aria-hidden="true"></i>' + loc('spage.agents', '派工') + '</span></span></div>'
            + '<div class="rd-axis" aria-hidden="true"><span class="ax">' + loc('spage.axis', '每站時間 · 同一把尺') + '</span><span class="cx">' + loc('spage.stageCost', '花費') + '</span></div>'
            + '<ol class="rd">' + st.map(row).join('') + other + '</ol></section>';
    }

    // ---- what landed ----
    // The newest plan the session claimed that has tasks (`detail.tasksOf`).
    function planOf(x) {
        var ps = ((x && x.tasks) || []).filter(function (p) { return p && !p.error && p.tasks && p.tasks.length; });
        return ps.length ? ps[ps.length - 1] : null;
    }
    function landed(x) {
        var p = planOf(x);
        if (!p) return '';
        var k = kit();
        var done = p.tasks.filter(function (t) { return t.status === 'complete'; });
        var left = p.tasks.filter(function (t) { return t.status !== 'complete'; });
        var chip = function (cls) { return function (t) { return '<span class="sl-t' + cls + '"' + tip('T' + t.n, [t.title]) + '>T' + t.n + '</span>'; }; };
        var list = function (ts) { return '<ol class="sl-l">' + ts.map(function (t) { return '<li><b>T' + t.n + '</b><span>' + esc(t.title) + '</span></li>'; }).join('') + '</ol>'; };
        return '<section class="dcard ss-landed" data-block="session-landed"><div class="dcard-h">' + k.icon('files') + '<b>' + loc('spage.landed', '落地') + '</b>'
            + '<button type="button" class="gt-hr sl-open" data-sl-open="1" aria-haspopup="dialog">' + loc('spage.allTasks', '看全部任務') + '</button></div>'
            + '<div class="sl-chips">' + done.map(chip('')).join('') + left.map(chip(' no')).join('') + '</div>'
            + '<dialog class="tdlg sl-dlg" id="sl-dlg" data-block="session-landed-detail" aria-labelledby="sl-dlg-h"><div class="tdlg-in">'
            + '<div class="tdlg-hd">' + k.icon('files') + '<b id="sl-dlg-h">' + loc('spage.landed', '落地') + '</b><span class="tdlg-sub">' + esc(p.plan) + '</span>'
            + '<button type="button" class="tdlg-x" data-sl-close="1" aria-label="' + loc('spage.close', '關閉') + '">' + k.icon('close') + '</button></div>'
            + '<div class="tdlg-p sl-p"><h3 class="sl-sh ok">' + loc('spage.done', '已完成') + '<span>' + done.length + '</span></h3>' + list(done)
            + '<h3 class="sl-sh no">' + loc('spage.notDone', '未完成') + '<span>' + left.length + '</span></h3>' + list(left) + '</div></div></dialog></section>';
    }
    // The dialog the reader opened stays open through the 3 s redraw, which
    // replaces it: `OPEN` says so and the redraw shows the new one.
    var OPEN = false, heard = false;
    function show() {
        var d = doc && doc.getElementById ? doc.getElementById('sl-dlg') : null;
        if (!d || d.open || typeof d.showModal !== 'function') return;
        d.onclose = function () { OPEN = false; };
        d.showModal();
    }
    function listen() {
        if (heard || !doc || !doc.addEventListener) return;
        heard = true;
        doc.addEventListener('click', function (e) {
            var t = e && e.target && e.target.closest ? e.target : null;
            if (!t) return;
            if (t.closest('[data-sl-open]')) { OPEN = true; show(); return; }
            if (t.closest('[data-sl-close]')) {
                var d = doc.getElementById('sl-dlg');
                if (d && typeof d.close === 'function') d.close();
            }
        });
    }

    function page(s, x, o) {
        o = o || {};
        listen();
        var tab = o.tab === 'dispatch' || o.tab === 'talk' ? o.tab : 'timeline';
        var body;
        if (tab === 'dispatch') body = x && w.FK_SDISP ? w.FK_SDISP.html(s, x) : '<p class="tally">' + detailNote(s) + '</p>';
        else if (tab === 'talk') body = w.FK_STALK ? w.FK_STALK.html(s.id, o.talk, { stages: s.stages, task: s.task }) : '';
        else body = '<div class="ss-grid' + (planOf(x) ? ' with-landed' : '') + '">' + runCard(s, x) + landed(x) + '</div>';
        if (OPEN && tab === 'timeline' && w.setTimeout) w.setTimeout(show, 0);
        return '<div class="ssp" data-block="session-page">' + head(s, x, o) + tabs(s, tab, o.serve) + body + '</div>';
    }

    var api = { page: page, stagesOf: stagesOf, stageOf: stageOf, agentAt: agentAt, fam: fam, LETTER: LETTER, EN: EN };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_SESSION = api;
}(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null));
