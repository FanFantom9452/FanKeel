'use strict';
// assets/station/projects-page.js — 專案, the page `#/projects` and
// `#/projects/analysis/<angle>` draw (docs/90-agent/plans/2026-10-21-station-redesign-design.md
// §3; mockup route-projects.html, blocks period, projects-tabs, projects-table,
// analysis, analysis-nav, angle-*). One head with 總覽 | 分析 and the period
// control (7 / 30 / 90 days, default 30), which drives every figure on both
// tabs. 總覽 is one row a project, grouped 需要注意 (a gate waiting, a session
// running, a Blocked entry due) and 其他: cost for the period, landed, cost per
// landing, median days to land, Blocked oldest, overdue and open TODO, last
// move; the total under it is the sum of the rows. 分析 is five angles, each
// drawn only from fields the station has; an angle with nothing to draw says
// so in one line. Cost comes from the sessions' `days`, which the station
// keeps about 30 days, so 90 days says that too. Reads `w.FK_KIT` when it draws.
(function (w, doc) {
    var EN = {
        'pj.overview': 'Overview',
        'pj.analysis': 'Analysis',
        'pj.period': 'Period',
        'pj.periodAria': 'Period: cost, landings and stages all use these days',
        'pj.days': '{n} days',
        'pj.range': 'Period {a} – {b}',
        'pj.spend30': 'Cost is kept about 30 days: older days count nothing',
        'pj.table': 'Projects',
        'pj.att': 'Needs attention',
        'pj.other': 'Others',
        'pj.name': 'Project',
        'pj.cost': 'Cost',
        'pj.landed': 'Landed',
        'pj.cpl': 'Per landing',
        'pj.dtl': 'Days to land',
        'pj.blocked': 'Blocked oldest',
        'pj.overdue': 'Overdue',
        'pj.todo': 'Open TODO',
        'pj.last': 'Last move',
        'pj.waiting': 'Waiting on you',
        'pj.running': 'Running',
        'pj.dueN': '{n} Blocked overdue',
        'pj.noLand': 'none landed',
        'pj.dayUnit': '{n} d',
        'pj.total': 'Total',
        'pj.none': 'No project has a session or a TODO yet.',
        'pj.angles': 'Angles',
        'pj.stall': 'Stalls',
        'pj.stallQ': 'Which stage do tasks sit in?',
        'pj.costA': 'Cost',
        'pj.costQ': 'Where does the money go?',
        'pj.pace': 'Pace',
        'pj.paceQ': 'How fast do tasks land?',
        'pj.todoA': 'TODO',
        'pj.todoQ': 'How much is open, and in what state?',
        'pj.compare': 'Compare',
        'pj.compareQ': 'Which project lands for less?',
        'pj.work': 'working',
        'pj.wait': 'waiting on you',
        'pj.passed': '{n} passed',
        'pj.main': 'main',
        'pj.agent': 'agents',
        'pj.week': 'week of {d}',
        'pj.nLanded': '{n} landed',
        'pj.ready': 'Ready',
        'pj.decision': 'Needs a decision',
        'pj.blockedS': 'Blocked',
        'pj.watch': 'Watch',
        'pj.noStall': 'No session in this period has a stage with both ends timed.',
        'pj.noCost': 'No cost recorded in this period.',
        'pj.noPace': 'Nothing landed in this period.',
        'pj.noTodo': 'No project keeps TODO entries.',
        'pj.noCompare': 'No project both spent and landed in this period.',
        'pj.medianLand': 'Median {t} days from start to land',
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
    function dayStart(now) { var m = new Date(now); m.setHours(0, 0, 0, 0); return m.getTime(); }
    function median(xs) {
        if (!xs.length) return null;
        var s = xs.slice().sort(function (a, b) { return a - b; }), h = s.length >> 1;
        return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
    }
    function r2(n) { return Math.round(n * 100) / 100; }
    function days1(n) { return n === null ? '—' : (Math.round(n * 10) / 10).toString(); }
    function since(t, now) {
        if (!t) return '—';
        var m = Math.max(0, Math.round((now - t) / 60000));
        if (m < 60) return m + 'm';
        if (m < 1440) return Math.floor(m / 60) + 'h';
        return Math.floor(m / 1440) + 'd';
    }

    var PERIODS = [7, 30, 90], ANGLES = ['stall', 'cost', 'pace', 'todo', 'compare'];
    var st = { p: 30 }, last = null, bound = false;

    // One row a project: every session's pkey and every TODO list's.
    function rowsOf(S, days, now) {
        var k = kit(), fromDay = k.lastDays(now, days)[0], from = dayStart(now) - (days - 1) * 864e5;
        var by = {}, order = [];
        function at(pkey) {
            if (!by[pkey]) {
                by[pkey] = { pkey: pkey, usd: 0, main: 0, agent: 0, landed: 0, toLand: [], blockedOldest: null, overdue: 0, todo: 0,
                    todoBy: { ready: 0, decision: 0, blocked: 0, watch: 0 }, gate: null, live: false, run: null, last: 0, hasTodo: false };
                order.push(pkey);
            }
            return by[pkey];
        }
        ((S && S.sessions) || []).forEach(function (s) {
            var r = at(s.pkey);
            (s.days || []).forEach(function (x) {
                if (!x || typeof x.usd !== 'number' || !(x.day >= fromDay)) return;
                r.usd += x.usd;
                if (x.who === 'main') r.main += x.usd; else r.agent += x.usd;
            });
            var up = ms(s.updated), st0 = ms(s.started);
            if (s.stage === 'land' && s.state === 'down' && up >= from && up <= now) {
                r.landed++;
                if (isFinite(st0) && up >= st0) r.toLand.push((up - st0) / 864e5);
            }
            if (s.gateAt && s.state !== 'down' && !r.gate) r.gate = s;
            if (s.state === 'live') { r.live = true; if (!r.run || lastOf(s) > lastOf(r.run)) r.run = s; }
            r.last = Math.max(r.last, lastOf(s));
        });
        ((S && S.projects) || []).forEach(function (p) {
            (p.todos || []).forEach(function (t) {
                var r = at(t.pkey);
                r.hasTodo = true;
                (t.open || []).forEach(function (x) {
                    r.todo++;
                    if (has(r.todoBy, x.state)) r.todoBy[x.state]++;
                    if (x.due) r.overdue++;
                    var ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(x.stamp || '')), stamped = ymd ? new Date(+ymd[1], +ymd[2] - 1, +ymd[3]).getTime() : NaN;
                    if (x.state === 'blocked' && isFinite(stamped)) {
                        var age = Math.round((dayStart(now) - stamped) / 864e5);
                        if (r.blockedOldest === null || age > r.blockedOldest) r.blockedOldest = age;
                    }
                });
            });
        });
        return order.map(function (pkey) {
            var r = by[pkey];
            r.usd = r2(r.usd); r.main = r2(r.main); r.agent = r2(r.agent);
            r.cpl = r.landed ? r2(r.usd / r.landed) : null;
            r.dtl = median(r.toLand);
            r.attention = Boolean(r.gate || r.live || r.overdue > 0);
            return r;
        });
    }
    function angleOf(hash) {
        var m = /^#\/projects\/analysis(?:\/([a-z]+))?/.exec(String(hash || ''));
        if (!m) return null;
        return ANGLES.indexOf(m[1]) >= 0 ? m[1] : 'stall';
    }
    function nameOf(pkey, names) { return kit().shortLabel(names[pkey] || pkey); }
    function byUsd(a, b) { return b.usd - a.usd || b.last - a.last; }
    // A bar of segments on a scale shared by every bar it is drawn with; each segment carries its own tip.
    function bar(segs, max) {
        return '<span class="pj-bar">' + segs.filter(function (g) { return g.v > 0; }).map(function (g) {
            return '<i class="seg ' + g.cls + '" style="width:' + Math.max(1, Math.round(g.v / max * 100)) + '%"' + tip(g.label, g.vals) + '></i>';
        }).join('') + '</span>';
    }

    function head(tab, now) {
        var k = kit(), from = k.lastDays(now, st.p)[0];
        return '<div class="phead khead pjh" data-block="projects-tabs" data-on="' + tab + '">'
            + '<nav class="subtabs" aria-label="' + esc(loc('pj.table', '專案')) + '">'
            + '<a href="#/projects"' + (tab === 'list' ? ' aria-current="page"' : '') + '>' + loc('pj.overview', '總覽') + '</a>'
            + '<a href="#/projects/analysis/stall"' + (tab === 'analysis' ? ' aria-current="page"' : '') + '>' + loc('pj.analysis', '分析') + '</a></nav>'
            + '<span class="pjh-cap">' + esc(loc('pj.range', '區間 {a} – {b}', { a: from.slice(5), b: k.lastDays(now, 1)[0].slice(5) })) + '</span>'
            + '<div class="perseg" role="group" aria-label="' + esc(loc('pj.periodAria', '區間：花費、落地與各站都用這段天數')) + '" data-block="period">'
            + '<span>' + loc('pj.period', '區間') + '</span><span class="perseg-b">' + PERIODS.map(function (n) {
                return '<button type="button" data-pj-p="' + n + '" aria-pressed="' + (st.p === n) + '">' + loc('pj.days', '{n} 天', { n: n }) + '</button>';
            }).join('') + '</span></div></div>'
            + (st.p > 30 ? '<p class="pj-note">' + loc('pj.spend30', '花費只記得近 30 天左右，更早的日子算不到') + '</p>' : '');
    }
    function line2(r, names) {
        var k = kit();
        if (r.gate) return '<a class="pt-l2 wait" href="' + esc(k.sessionHash(r.gate.id)) + '"><span class="waitchip">' + loc('pj.waiting', '等你回答') + '</span><span class="pt-rt">' + esc(r.gate.task || '') + '</span></a>';
        if (r.run) return '<a class="pt-l2" href="' + esc(k.sessionHash(r.run.id)) + '"><span class="hm-stw" style="--c:var(--st-' + esc(r.run.stage) + ')">' + esc(r.run.stage) + '</span><span class="pt-rt">' + esc(r.run.task || loc('pj.running', '在跑')) + '</span></a>';
        if (r.overdue) return '<span class="pt-l2 due">' + loc('pj.dueN', '{n} 筆 Blocked 到期', { n: r.overdue }) + '</span>';
        return '';
    }
    function rowHtml(r, names, max, now) {
        var k = kit();
        return '<div class="pt-row' + (r.gate ? ' wait' : '') + '" role="row" data-pkey="' + esc(r.pkey) + '" data-usd="' + r.usd + '" data-landed="' + r.landed + '">'
            + '<span class="pt-c pt-nm" role="cell"><a href="' + esc(k.projectHash(r.pkey)) + '" title="' + esc(names[r.pkey] || r.pkey) + '"><b><span class="pt-nmt">' + esc(nameOf(r.pkey, names)) + '</span></b></a>' + line2(r, names) + '</span>'
            + '<span class="pt-c pt-usd" role="cell">' + bar([{ v: r.main, cls: 'main', label: loc('pj.main', '主 session'), vals: [k.usd(r.main, true)] },
                { v: r.agent, cls: 'agent', label: loc('pj.agent', '派工'), vals: [k.usd(r.agent, true)] }], max)
            + '<span class="pt-v' + (r.usd ? '' : ' zero') + '">' + k.usd(r.usd, true) + '</span></span>'
            + '<span class="pt-c r" role="cell"><span class="pt-v' + (r.landed ? '' : ' zero') + '">' + r.landed + '</span></span>'
            + '<span class="pt-c r" role="cell">' + (r.cpl === null ? '<span class="pt-mu">' + loc('pj.noLand', '沒有落地') + '</span>' : '<span class="pt-v">' + k.usd(r.cpl, true) + '</span>') + '</span>'
            + '<span class="pt-c r" role="cell"><span class="pt-v' + (r.dtl === null ? ' zero' : '') + '">' + days1(r.dtl) + '</span></span>'
            + '<span class="pt-c r" role="cell">' + (r.blockedOldest === null ? '<span class="pt-mu">—</span>' : '<span class="pt-v">' + esc(loc('pj.dayUnit', '{n} 天', { n: r.blockedOldest })) + '</span>') + '</span>'
            + '<span class="pt-c r" role="cell"><span class="pt-v' + (r.overdue ? ' bad' : ' zero') + '">' + r.overdue + '</span></span>'
            + '<span class="pt-c r" role="cell"><span class="pt-v' + (r.todo ? '' : ' zero') + '">' + r.todo + '</span></span>'
            + '<span class="pt-c pt-last r" role="cell">' + since(r.last, now) + '</span></div>';
    }
    function overview(rows, names, now) {
        var k = kit(), att = rows.filter(function (r) { return r.attention; }).sort(byUsd), other = rows.filter(function (r) { return !r.attention; }).sort(byUsd);
        var max = Math.max.apply(null, [0.01].concat(rows.map(function (r) { return r.usd; })));
        var usd = r2(rows.reduce(function (n, r) { return n + r.usd; }, 0)), landed = rows.reduce(function (n, r) { return n + r.landed; }, 0);
        var grp = function (cls, label, list) {
            return list.length ? '<div class="pt-grp ' + cls + '"><b>' + label + '</b><span class="kn">' + list.length + '</span></div>'
                + list.map(function (r) { return rowHtml(r, names, max, now); }).join('') : '';
        };
        var h = function (label, cls) { return '<span class="pt-h' + (cls ? ' ' + cls : '') + '" role="columnheader">' + label + '</span>'; };
        return '<div class="pj" data-block="projects-page" data-view="projects"><section class="dcard pt" data-block="projects-table" aria-label="' + esc(loc('pj.table', '專案')) + '">'
            + '<div class="pt-tbl" role="table"><div class="pt-colh" role="row">' + h(loc('pj.name', '專案')) + h(loc('pj.cost', '花費')) + h(loc('pj.landed', '落地'), 'r')
            + h(loc('pj.cpl', '每筆落地'), 'r') + h(loc('pj.dtl', '落地天數'), 'r') + h(loc('pj.blocked', '最久 Blocked'), 'r') + h(loc('pj.overdue', '到期'), 'r')
            + h(loc('pj.todo', '開著的 TODO'), 'r') + h(loc('pj.last', '最後動靜'), 'r') + '</div>'
            + (rows.length ? '<div class="pt-body">' + grp('att', loc('pj.att', '需要注意'), att) + grp('quiet', loc('pj.other', '其他'), other) + '</div>'
                : '<p class="an-empty">' + loc('pj.none', '還沒有專案有 session 或 TODO。') + '</p>')
            + '</div><div class="pt-more"><div class="pt-sum" data-usd="' + usd + '" data-landed="' + landed + '">' + loc('pj.total', '合計')
            + ' <b>' + k.usd(usd, true) + '</b> · ' + loc('pj.nLanded', '落地 {n} 筆', { n: '<b>' + landed + '</b>' }) + '</div></div></section></div>';
    }

    function angleName(a) {
        if (a === 'stall') return loc('pj.stall', '卡站');
        if (a === 'cost') return loc('pj.costA', '成本');
        if (a === 'pace') return loc('pj.pace', '產出速度');
        if (a === 'todo') return loc('pj.todoA', 'TODO 健康');
        return loc('pj.compare', '專案比較');
    }
    function angleQ(a) {
        if (a === 'stall') return loc('pj.stallQ', '任務卡在哪一站？');
        if (a === 'cost') return loc('pj.costQ', '錢花在哪裡？');
        if (a === 'pace') return loc('pj.paceQ', '做得多快？');
        if (a === 'todo') return loc('pj.todoQ', '積了多少、卡在哪個狀態？');
        return loc('pj.compareQ', '哪個專案每筆落地花得少？');
    }
    function empty(text) { return '<p class="an-empty">' + text + '</p>'; }
    function barRow(label, href, inner) {
        return '<li class="an-row"><span class="an-l">' + (href ? '<a href="' + esc(href) + '">' + esc(label) + '</a>' : esc(label)) + '</span>' + inner + '</li>';
    }
    // 卡站: per stage, the median stay of the period's sessions split 做事 / 等你, one scale.
    function stall(S, now) {
        var k = kit(), from = dayStart(now) - (st.p - 1) * 864e5, by = {};
        ((S && S.sessions) || []).forEach(function (s) {
            if (!(lastOf(s) >= from)) return;
            (s.stages || []).forEach(function (x) {
                var a = x ? ms(x.from) : NaN, b = x ? ms(x.to) : NaN;
                if (!isFinite(a) || !isFinite(b) || b <= a) return;
                var wait = Math.min(Math.max(x.waited || 0, 0), b - a);
                (by[x.stage] = by[x.stage] || []).push({ work: b - a - wait, wait: wait });
            });
        });
        var stages = k.ROUTE.filter(function (g) { return by[g]; });
        if (!stages.length) return empty(loc('pj.noStall', '這段期間沒有 session 的哪一站頭尾都有計時。'));
        var med = stages.map(function (g) {
            return { g: g, n: by[g].length, work: median(by[g].map(function (x) { return x.work; })), wait: median(by[g].map(function (x) { return x.wait; })) };
        });
        var max = Math.max.apply(null, med.map(function (m) { return m.work + m.wait; }));
        return '<ul class="an-bars">' + med.map(function (m) {
            return barRow(m.g, null, bar([{ v: m.work, cls: 'work', label: m.g, vals: [loc('pj.work', '做事') + ' ' + k.mins(m.work), loc('pj.passed', '{n} 筆經過', { n: m.n })] },
                { v: m.wait, cls: 'wait', label: m.g, vals: [loc('pj.wait', '等你回答') + ' ' + k.mins(m.wait)] }], max));
        }).join('') + '</ul>';
    }
    // 成本: per project, the period's cost split main / agents, one scale.
    function cost(rows, names) {
        var k = kit(), list = rows.filter(function (r) { return r.usd > 0; }).sort(byUsd);
        if (!list.length) return empty(loc('pj.noCost', '這段期間沒有記到花費。'));
        var max = list[0].usd;
        return '<ul class="an-bars">' + list.map(function (r) {
            var nm = nameOf(r.pkey, names);
            return barRow(nm, k.projectHash(r.pkey), bar([{ v: r.main, cls: 'main', label: nm, vals: [loc('pj.main', '主 session') + ' ' + k.usd(r.main, true)] },
                { v: r.agent, cls: 'agent', label: nm, vals: [loc('pj.agent', '派工') + ' ' + k.usd(r.agent, true)] }], max));
        }).join('') + '</ul>';
    }
    // 產出速度: landings per week over the period, one scale, and the median days to land.
    function pace(S, rows, now) {
        var k = kit(), weeks = Math.ceil(st.p / 7), end = dayStart(now) + 864e5, from = dayStart(now) - (st.p - 1) * 864e5, counts = [];
        for (var i = 0; i < weeks; i++) counts.push(0);
        ((S && S.sessions) || []).forEach(function (s) {
            var up = ms(s.updated);
            if (s.stage !== 'land' || s.state !== 'down' || !(up >= from && up <= now)) return;
            var wk = Math.floor((end - up) / (7 * 864e5));
            if (wk < weeks) counts[weeks - 1 - wk]++;
        });
        var total = counts.reduce(function (a, b) { return a + b; }, 0);
        if (!total) return empty(loc('pj.noPace', '這段期間沒有任務走到 land。'));
        var max = Math.max.apply(null, counts), all = [];
        rows.forEach(function (r) { all = all.concat(r.toLand); });
        return '<p class="an-take">' + esc(loc('pj.medianLand', '從開始到 land 中位 {t} 天', { t: days1(median(all)) })) + '</p>'
            + '<div class="an-cols">' + counts.map(function (c, j) {
                var wkFrom = k.lastDays(end - (weeks - j) * 7 * 864e5 + 864e5, 1)[0].slice(5);
                return '<span class="an-col"><i class="seg land" style="height:' + (c ? Math.max(2, Math.round(c / max * 100)) : 0) + '%"'
                    + tip(loc('pj.week', '{d} 那週', { d: wkFrom }), [loc('pj.nLanded', '落地 {n} 筆', { n: c })]) + '></i><small>' + wkFrom + '</small></span>';
            }).join('') + '</div>';
    }
    // TODO 健康: per project, open entries by state, one scale; overdue marked.
    function todo(rows, names) {
        var k = kit(), list = rows.filter(function (r) { return r.todo > 0; }).sort(function (a, b) { return b.todo - a.todo; });
        if (!list.length) return empty(loc('pj.noTodo', '沒有專案記 TODO 條目。'));
        var max = list[0].todo, label = { ready: loc('pj.ready', 'Ready'), decision: loc('pj.decision', '待決定'), blocked: loc('pj.blockedS', 'Blocked'), watch: loc('pj.watch', 'Watch') };
        return '<ul class="an-bars">' + list.map(function (r) {
            return barRow(nameOf(r.pkey, names), k.projectHash(r.pkey) + '/todo', bar(['ready', 'decision', 'blocked', 'watch'].map(function (s) {
                return { v: r.todoBy[s], cls: 'td-' + s, label: label[s], vals: [r.todoBy[s]] };
            }), max) + (r.overdue ? '<span class="pt-v bad">' + loc('pj.dueN', '{n} 筆 Blocked 到期', { n: r.overdue }) + '</span>' : ''));
        }).join('') + '</ul>';
    }
    // 專案比較: per project, cost per landing and landings, each on its own scale.
    function compare(rows, names) {
        var k = kit(), list = rows.filter(function (r) { return r.landed > 0 && r.usd > 0; }).sort(function (a, b) { return a.cpl - b.cpl; });
        if (!list.length) return empty(loc('pj.noCompare', '這段期間沒有專案既有花費又有落地。'));
        var maxC = Math.max.apply(null, list.map(function (r) { return r.cpl; })), maxL = Math.max.apply(null, list.map(function (r) { return r.landed; }));
        return '<ul class="an-bars two">' + list.map(function (r) {
            var nm = nameOf(r.pkey, names);
            return barRow(nm, k.projectHash(r.pkey), bar([{ v: r.cpl, cls: 'main', label: nm, vals: [loc('pj.cpl', '每筆落地') + ' ' + k.usd(r.cpl, true)] }], maxC)
                + bar([{ v: r.landed, cls: 'land', label: nm, vals: [loc('pj.nLanded', '落地 {n} 筆', { n: r.landed })] }], maxL));
        }).join('') + '</ul>';
    }
    function analysis(S, rows, names, now, angle) {
        var body = angle === 'stall' ? stall(S, now) : angle === 'cost' ? cost(rows, names) : angle === 'pace' ? pace(S, rows, now)
            : angle === 'todo' ? todo(rows, names) : compare(rows, names);
        return '<div class="pa" data-block="analysis" data-view="analysis"><nav class="dcard an-nav" data-block="analysis-nav" aria-label="' + esc(loc('pj.angles', '分析角度')) + '"><ul>'
            + ANGLES.map(function (a) {
                return '<li><a href="#/projects/analysis/' + a + '"' + (a === angle ? ' aria-current="page"' : '') + '><span class="an-nm">' + angleName(a) + '</span>'
                    + '<span class="an-q">' + angleQ(a) + '</span></a></li>';
            }).join('') + '</ul></nav>'
            + '<section class="dcard an" data-block="angle-' + angle + '" data-angle="' + angle + '" aria-labelledby="an-q"><div class="dcard-h"><h2 id="an-q">' + angleQ(angle) + '</h2></div>'
            + body + '</section></div>';
    }

    function page(S, o) {
        o = o || {};
        last = o;
        bind();
        var now = isFinite(o.now) ? o.now : Date.now(), names = o.names || {}, angle = angleOf(o.hash);
        var rows = rowsOf(S, st.p, now);
        return head(angle ? 'analysis' : 'list', now) + (angle ? analysis(S, rows, names, now, angle) : overview(rows, names, now));
    }
    function onClick(e) {
        var t = e && e.target, a = t && typeof t.closest === 'function' ? t.closest('[data-pj-p]') : null;
        if (!a) return;
        var n = +a.getAttribute('data-pj-p');
        if (PERIODS.indexOf(n) < 0) return;
        st.p = n;
        if (last && typeof last.redraw === 'function') last.redraw();
    }
    function bind() {
        if (bound || !doc || typeof doc.addEventListener !== 'function') return;
        bound = true;
        doc.addEventListener('click', onClick);
    }
    function state() { return st; }
    function reset() { st = { p: 30 }; }

    var api = { page: page, rowsOf: rowsOf, angleOf: angleOf, onClick: onClick, state: state, reset: reset, EN: EN };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_PROJECTS = api;
}(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null));
