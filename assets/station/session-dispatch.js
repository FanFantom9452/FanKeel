'use strict';
// assets/station/session-dispatch.js — the session page's 派工 tab (design
// 2026-10-21-station-redesign §4; mockup route-session.html, the dispatch
// view drawn by _sess/r62-dispatch.js): one strip a stage, one chip an agent
// sized by what it cost and coloured by model with the model's letter, then
// one row a dispatch whose duration and cost bars share one scale each. An
// agent belongs to the stage its first request fell in, the same rule the
// 經過 tab splits a stage's cost by (session-page.js `agentAt`). Loaded
// before station.js; session-page.js calls html().
(function (w, doc) {
    var EN = {
        'sdisp.title': 'Dispatch',
        'sdisp.q': 'Who this session sent, and where the money went',
        'sdisp.none': 'This session dispatched nothing',
        'sdisp.other': 'Outside any stage',
        'sdisp.nSent': '{d} dispatches · {n} agents',
        'sdisp.nAgents': '{n} agents',
        'sdisp.share': '{p} of dispatch',
        'sdisp.strip': 'Agents each stage sent, width is cost',
        'sdisp.list': 'Dispatches, one row each',
        'sdisp.colName': 'Dispatch',
        'sdisp.colRole': 'Role',
        'sdisp.colModel': 'model',
        'sdisp.colTime': 'How long',
        'sdisp.colCost': 'Cost',
        'sdisp.noAgent': 'No agent came back',
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
    function tip(label, vals) {
        var v = (vals || []).filter(function (x) { return x !== null && x !== undefined && x !== ''; }).map(String).slice(0, 2);
        var T = w && w.FK_TIP;
        return T ? T.attr(String(label), v) : ' tabindex="0" title="' + esc([label].concat(v).join(' · ')) + '"';
    }
    function pct(n, d) { return d > 0 ? Math.round(n / d * 100) + '%' : '0%'; }
    function total(list, f) { return list.reduce(function (n, x) { return n + (f(x) || 0); }, 0); }
    var FAMS = ['fable', 'opus', 'sonnet', 'haiku', 'other'];

    function html(s, x) {
        var k = kit(), F = w.FK_SESSION, st = F.stagesOf(s);
        var top = '<section class="dcard dx" data-block="session-dispatch"><div class="dcard-h">' + k.icon('bot') + '<b>' + loc('sdisp.title', '派工') + '</b>'
            + '<h2 class="dx-q">' + loc('sdisp.q', '這個 session 派了誰、花在哪') + '</h2>';
        var ds = (x && x.dispatches) || [];
        if (!ds.length) return top + '</div><p class="tally">' + loc('sdisp.none', '這個 session 沒有派工') + '</p></section>';
        var byId = {};
        ((x && x.rows) || []).forEach(function (r) { byId[r.id] = r; });
        var sent = ds.map(function (d, i) {
            var rows = (d.ids || []).map(function (id) { return byId[id]; }).filter(Boolean);
            return { d: d, i: i, rows: rows, stage: F.stageOf(st, d.out) || 'none', usd: total(rows, function (r) { return r.usd; }), dur: total(rows, function (r) { return r.durMs; }) };
        });
        var agents = [];
        sent.forEach(function (e) {
            e.rows.forEach(function (r) { agents.push({ r: r, e: e, m: F.fam(r.model), stage: F.stageOf(st, F.agentAt(x, r)) || 'none' }); });
        });
        var all = total(agents, function (a) { return a.r.usd; });
        var nameOf = function (r) { return r.label || r.agentType || String(r.id).slice(0, 8); };
        var modelOf = function (r) { return k.modelLabel(k.modelKey(r.model)); };

        // ---- the key: each model present, its letter, its agents and cost ----
        var key = '<span class="gt-hr rd-key dx-key" data-block="session-dispatch-key">' + FAMS.filter(function (m) {
            return agents.some(function (a) { return a.m === m; });
        }).map(function (m) {
            var xs = agents.filter(function (a) { return a.m === m; }), u = total(xs, function (a) { return a.r.usd; });
            return '<span class="kk"' + tip(m, [loc('sdisp.nAgents', '{n} 個 agent', { n: xs.length }), k.usd(u, true) + ' · ' + loc('sdisp.share', '佔派工 {p}', { p: pct(u, all) })]) + '>'
                + '<i class="dx-b ' + m + '">' + F.LETTER[m] + '</i>' + m + '</span>';
        }).join('') + '</span>';

        // ---- the strip: a group a stage, a chip an agent, width = cost ----
        var chip = function (a) {
            var u = a.r.usd || 0;
            return '<i class="dx-c ' + a.m + '" style="flex:' + Math.max(u, 0.001) + ' 1 0" data-usd="' + u + '"'
                + tip(nameOf(a.r), [modelOf(a.r), k.usd(u, true) + ' · ' + k.mins(a.r.durMs)]) + '><b>' + F.LETTER[a.m] + '</b></i>';
        };
        var keys = st.map(function (g) { return g.stage; }).concat(['none']).filter(function (key, i, list) {
            return list.indexOf(key) === i && agents.some(function (a) { return a.stage === key; });
        });
        var group = function (key) {
            var as = agents.filter(function (a) { return a.stage === key; }), u = total(as, function (a) { return a.r.usd; });
            var n = as.map(function (a) { return a.e.i; }).filter(function (v, i, l) { return l.indexOf(v) === i; }).length;
            var name = key === 'none' ? loc('sdisp.other', '不在任何一站') : esc(key);
            return '<div class="dx-g" style="--c:var(--st-' + esc(key) + ');flex:' + Math.max(u, 0.001) + ' 1 0">'
                + '<span class="dx-gl"' + tip(name, [loc('sdisp.nSent', '派 {d} 次 · {n} 個 agent', { d: n, n: as.length }), k.usd(u, true) + ' · ' + loc('sdisp.share', '佔派工 {p}', { p: pct(u, all) })]) + '><i></i>' + name + '</span>'
                + '<span class="dx-gc">' + as.map(chip).join('') + '</span></div>';
        };

        // ---- the list: a row a dispatch; time and money each on one scale ----
        var maxD = Math.max.apply(null, sent.map(function (e) { return e.dur; })) || 1;
        var maxU = Math.max.apply(null, sent.map(function (e) { return e.usd; })) || 1;
        var row = function (e) {
            var label = e.d.text || e.d.agentType || e.d.surface || '';
            var badges = e.rows.length ? FAMS.filter(function (m) { return e.rows.some(function (r) { return F.fam(r.model) === m; }); }).map(function (m) {
                var xs = e.rows.filter(function (r) { return F.fam(r.model) === m; });
                return '<i class="dx-b ' + m + '"' + tip(m + ' · ' + label, [loc('sdisp.nAgents', '{n} 個 agent', { n: xs.length }), k.usd(total(xs, function (r) { return r.usd; }), true)]) + '>' + F.LETTER[m] + '</i>';
            }).join('') : '<i class="dx-b none"' + tip(label, [loc('sdisp.noAgent', '沒有 agent 回來')]) + '>–</i>';
            var segs = function (f, max, fmt) {
                return e.rows.map(function (r) {
                    return '<i class="' + F.fam(r.model) + '" style="width:' + ((f(r) || 0) / max * 100).toFixed(3) + '%"' + tip(nameOf(r), [modelOf(r), fmt(r)]) + '></i>';
                }).join('');
            };
            return '<li class="dx-r" style="--c:var(--st-' + esc(e.stage) + ')"><span class="dx-n"><i></i><span>' + esc(label) + '</span></span>'
                + '<span class="dx-role">' + esc(e.d.agentType || e.d.surface || '') + '</span><span class="dx-ms">' + badges + '</span>'
                + '<span class="dx-bar dx-dur">' + segs(function (r) { return r.durMs; }, maxD, function (r) { return k.mins(r.durMs); }) + '</span>'
                + '<span class="dx-bar dx-usd">' + segs(function (r) { return r.usd; }, maxU, function (r) { return k.usd(r.usd, true); }) + '</span></li>';
        };
        return top + key + '</div>'
            + '<div class="dx-strip" role="group" aria-label="' + loc('sdisp.strip', '各站派出的 agent，寬度是花費') + '">' + keys.map(group).join('') + '</div>'
            + '<div class="dx-lh" aria-hidden="true"><span>' + loc('sdisp.colName', '派工') + '</span><span>' + loc('sdisp.colRole', '角色') + '</span><span>'
            + loc('sdisp.colModel', 'model') + '</span><span>' + loc('sdisp.colTime', '做了多久') + '</span><span>' + loc('sdisp.colCost', '花多少') + '</span></div>'
            + '<ol class="dx-l" aria-label="' + loc('sdisp.list', '派工，一列一次') + '">' + sent.map(row).join('') + '</ol></section>';
    }

    var api = { html: html, EN: EN };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_SDISP = api;
}(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null));
