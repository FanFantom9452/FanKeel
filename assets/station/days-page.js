// 近 30 天 (FK_DAYS): the days chart page and the hover, legend and 篩選
// state that outlives one draw. station.js routes to it, runs the listeners
// and hands it ctx — its helpers in ctx.H — on every call.
(function (w, doc) {
    'use strict';
    var EN = {
        'dash.barHeight': 'Bar height',
        'dash.cost': 'Cost',
        'dash.time': 'Time',
        'dash.splitBy': 'Split by',
        'dash.byModel': 'by model',
        'dash.byProject': 'by project',
        'dash.byStage': 'by stage',
        'dash.mainVsAgent': 'main session vs agent',
        'dash.byVersion': 'by version',
        'dash.byKind': 'by kind',
        'dash.noTimeByModel': 'time has no model to split by',
        'dash.noTimeByKind': 'time has no kind to split by',
        'q.clickToPutBack': 'Click to put it back on the chart',
        'q.clickToRemoveFirst': 'Click to take it off the chart first',
        'q.weekdays': 'Sun,Mon,Tue,Wed,Thu,Fri,Sat',
        'q.accReset': '{wd} {hm} reset',
        'q.accShort': '{hm} account',
        'q.account': 'Account',
        'q.noReading': 'No 5h/7d reading yet: the pane writes them while a session runs.',
        'q.noData': 'Not enough data',
        'q.rise': 'This stretch +{n}%',
        'q.share': 'this task about {n}%',
        'q.use7': '7d usage',
        'q.use5': '5h usage',
        'q.readAt': 'Read at {at}',
        'q.outAt': 'Out at {at} at the last 24 hours\' pace',
        'q.notOut': 'Will not run out before the reset',
        'q.resetIn': 'Resets {hm}, {h} h {m} min left',
        'q.resetDone': 'Reset at {hm}',
        'q.perPoint': 'Per 1% of quota',
        'q.perPointOf': 'from the {from}–{to} window',
        'q.prevWin': 'Previous 5h window',
        'q.nextWin': 'Next 5h window',
        'q.aria': '{acc} {mode} usage, {from} to {to}; {n} task bars below, click one for its share',
        'q.join': ', ',
        'q.reset7': '7d reset {at}',
        'q.reset5': '{hm} reset',
        'q.keyRead': 'Reading',
        'q.keyHeld': 'No reading, the last one held',
        'q.keyGate': 'Waiting on a gate',
        'q.note5': 'The axis is one 5h window, the newest with readings by default; ‹ › moves between them, and only this window counts.',
        'q.note7': 'Range {from} to {to}; this account\'s first reading in it is at {at}, where the axis starts — nothing is drawn before it.',
        'q.noteClick': 'Click a task bar for its share of that stretch; click it again or the blank to clear.',
        'q.unknown': 'Sessions with no account are not drawn: {n} bars.'
    };
    function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    // `vars` fill `{name}` in either language, as i18n.js's loc does.
    function loc(key, zh, vars) {
        var I = w && w.FK_I18N;
        var s = I && I.lang === 'en' && has(EN, key) ? EN[key] : zh;
        return vars ? String(s).replace(/\{(\w+)\}/g, function (m, k) { return has(vars, k) ? String(vars[k]) : m; }) : s;
    }
    // What daysPage last drew, so the hover card reads the same bars the chart
    // did. `chartOff` holds, per dim, the legend entries clicked out of the
    // chart — in memory only, so the 3 s redraw keeps them and a reload clears
    // them. `chartPin` is never set now that a click hides instead of pins;
    // `chartPanel` is whether the 篩選 panel is open, kept across redraws too.
    var chartBars = null, chartOpts = null, chartPin = null, chartHover = false, chartOff = {}, chartPanel = false;
    // What the pointer is on — a column `{day, key, cx}` or a legend entry
    // `{legend}` — so a redraw under a still pointer can put the hover back.
    var chartAt = null;
    var C = null;
    function chartTipEl() {
        var t = doc.getElementById('charttip');
        if (!t) {
            t = doc.createElement('div');
            t.id = 'charttip';
            t.setAttribute('role', 'tooltip');
            doc.body.appendChild(t);
        }
        return t;
    }
    // Light one series everywhere — its segments and its legend entry. null clears.
    function chartFocus(key) {
        var svg = doc.querySelector('.chart svg');
        if (!svg) return;
        if (key) svg.setAttribute('data-focus', key); else svg.removeAttribute('data-focus');
        [].forEach.call(doc.querySelectorAll('.chart .hseg, .legend [data-key]'), function (el) {
            if (key && el.getAttribute('data-key') === key) el.setAttribute('data-hot', ''); else el.removeAttribute('data-hot');
        });
    }
    function chartGuide(cx) {
        var g = doc.querySelector('.chart .hguide');
        if (!g) return;
        if (cx === null) { g.removeAttribute('data-on'); return; }
        g.setAttribute('x1', cx);
        g.setAttribute('x2', cx);
        g.setAttribute('data-on', '');
    }
    function chartHide() {
        chartTipEl().removeAttribute('data-on');
        chartGuide(null);
        chartFocus(chartPin);
        chartHover = false;
        chartAt = null;
    }
    // Beside the pointer, flipped to its other side at the window's right or
    // bottom edge — measured against the card as it is now.
    function chartPlace(px, py) {
        var t = chartTipEl(), pad = 14, r = t.getBoundingClientRect(), x = px + pad, y = py + pad;
        if (x + r.width > w.innerWidth - 8) x = px - pad - r.width;
        if (y + r.height > w.innerHeight - 8) y = py - pad - r.height;
        t.style.left = Math.max(8, x) + 'px';
        t.style.top = Math.max(8, y) + 'px';
    }
    // The 3 s re-read redraws the chart under a pointer that has not moved:
    // redraw the card from the new bars and light the same things again.
    function chartRestore() {
        if (!chartAt) { chartHide(); return; }
        if (chartAt.legend) { chartFocus(chartAt.legend); return; }
        var html = C.H.segTip(chartBars, chartOpts, chartAt.day, chartAt.key);
        if (!html) { chartHide(); return; }
        chartTipEl().innerHTML = html;
        chartPlace(chartAt.px, chartAt.py);
        chartGuide(chartAt.cx);
        chartFocus(chartAt.key || chartPin);
    }
    function move(e) {
        if (C.route.view !== 'days' || !chartBars || !e.target.closest) return;
        var lk = e.target.closest('.legend [data-key]:not([data-off])');
        if (lk) {
            chartHide();
            chartFocus(lk.getAttribute('data-key'));
            chartHover = true;
            chartAt = { legend: lk.getAttribute('data-key') };
            return;
        }
        var seg = e.target.closest('.chart .hseg'), cell = seg || e.target.closest('.chart .hit');
        if (!cell) { if (chartHover) chartHide(); return; }
        var t = chartTipEl();
        t.innerHTML = C.H.segTip(chartBars, chartOpts, cell.getAttribute('data-day'), seg ? seg.getAttribute('data-key') : null);
        t.setAttribute('data-on', '');
        chartPlace(e.clientX, e.clientY);
        chartGuide(cell.getAttribute('data-cx'));
        chartFocus(seg ? seg.getAttribute('data-key') : chartPin);
        chartHover = true;
        chartAt = { day: cell.getAttribute('data-day'), key: seg ? seg.getAttribute('data-key') : null, cx: cell.getAttribute('data-cx'),
            px: e.clientX, py: e.clientY };
    }
    // ---- 7d / 5h 額度 (spend-quota design §3, §4) ----
    // One account at a time (`view.qacc`, the 帳號 seg both tabs share): its step line
    // over 0-100%, one bar per task segment under it on the same time axis, and the share
    // of the rise a clicked bar earns (`view.qsel`). The 5h tab walks `view.qwin`, an
    // index into the account's windows, null for the newest. Times are epoch ms, local.
    var STAGES = ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'];
    // The mockup's measures (G7W, G7N, G5W, G5N): the wide drawing, then the phone's,
    // which days-page.css swaps in under 720px.
    var GEO = {
        '7d': [{ W: 1200, L: 52, R: 1150, top: 12, bot: 150, laneTop: 174, pitch: 32, barH: 13, fs: 14 },
            { W: 360, L: 36, R: 330, top: 10, bot: 130, laneTop: 152, pitch: 26, barH: 13, fs: 13, narrow: true }],
        '5h': [{ W: 1200, L: 52, R: 1150, top: 12, bot: 150, laneTop: 174, pitch: 32, barH: 14, fs: 14 },
            { W: 360, L: 36, R: 330, top: 10, bot: 120, laneTop: 146, pitch: 28, barH: 14, fs: 13, narrow: true }]
    };
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function hm(t) { var d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
    function md(t) { var d = new Date(t); return pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
    function dayKey(t) { return new Date(t).getFullYear() + '-' + md(t); }
    // The range on screen (FK_RANGE, spend-range.js): 近 30 天 unless the reader picked
    // another; without the module, the page's own 30 days.
    function rangeNow() {
        var RG = w.FK_RANGE || null, view = C.view;
        return RG ? RG.rangeOf(view.range, C.NOW, view.rangeFrom, view.rangeTo) : { kind: '30d', days: C.DAYS, prev: C.PREV, from: C.DAYS[0], to: C.TODAY };
    }
    // The range as times: local midnight of its first day to the end of its last, never past now.
    function rangeMs(rng) {
        var at = function (day, k) { return new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)) + k).getTime(); };
        return { a: at(rng.from, 0), b: Math.min(C.NOW, at(rng.to, 1)) };
    }
    // An account is named by its 7d reset (design §0), never by its uuid: the key is
    // lib/quota.js resetKey's '<weekday> HH:MM'.
    function accName(a) {
        var wd = loc('q.weekdays', '日,一,二,三,四,五,六').split(',');
        return loc('q.accReset', '週{wd} {hm} 重置', { wd: wd[a.wd] || a.wd, hm: a.hm });
    }
    function accShort(key) { return loc('q.accShort', '{hm} 帳號', { hm: String(key).split(' ')[1] || key }); }
    // Every task segment the page carries, as a quota bar: the id is the session's and
    // the segment's index, the bins its session's. `key` left out is every account;
    // null is the sessions no account was found for.
    function allSegs(S, key) {
        var out = [];
        (S.sessions || []).forEach(function (s) {
            if (key !== undefined && (s.account || null) !== key) return;
            (s.segments || []).forEach(function (g, i) {
                out.push({ id: s.id + ':' + i, name: g.task || s.task || s.id, project: s.project || '', account: s.account || null,
                    start: g.start, end: g.end, stages: g.stages || [], gates: g.gates || [], bins: s.bins || [] });
            });
        });
        return out;
    }
    // The step line's value at `t`: the last step begun by then, 0 before the first.
    function valueAt(steps, t) {
        var v = 0;
        steps.forEach(function (s) { if (s.from <= t) v = s.v; });
        return v;
    }
    // The time axis' marks: each local midnight for 7d, each hour for 5h, thinned to
    // at most `max`; today's date is the one drawn bold.
    function ticksOf(t0, t1, mode, max) {
        var list = [], d = new Date(t0);
        if (mode === '5h') d.setMinutes(0, 0, 0); else d.setHours(0, 0, 0, 0);
        while (d.getTime() <= t1) {
            if (d.getTime() >= t0) list.push(d.getTime());
            if (mode === '5h') d.setHours(d.getHours() + 1); else d.setDate(d.getDate() + 1);
        }
        var every = Math.max(1, Math.ceil(list.length / max));
        return list.filter(function (t, i) { return i % every === 0; }).map(function (t) {
            return { t: t, text: mode === '5h' ? hm(t) : md(t), today: mode !== '5h' && dayKey(t) === dayKey(C.NOW) };
        });
    }
    // Where the line falls back to 0 (a 7d reset inside the axis), or the 5h window's end.
    function resetsOf(steps, t0, t1, mode) {
        if (mode === '5h') return [{ t: t1, text: loc('q.reset5', '{hm} 重置', { hm: hm(t1) }) }];
        var out = [];
        steps.forEach(function (s, i) {
            if (i && s.v === 0 && steps[i - 1].v > 0 && s.from >= t0 && s.from <= t1) {
                out.push({ t: s.from, text: loc('q.reset7', '7d 重置 {at}', { at: md(s.from) + ' ' + hm(s.from) }) });
            }
        });
        return out;
    }
    // One quota tab, '7d' or '5h' (design §3): the 帳號 seg, the readouts (7d and its
    // forecast, 5h and its reset, the price of 1%), ‹ › on 5h, the chart wide and
    // narrow, its key and its notes. The chart is `.qplot`, never `.chart`: the 明細
    // hover reads the first `.chart svg` on the page.
    function quotaPanel(mode, rng) {
        var H = C.H, S = C.S, view = C.view, Q = w.FK_QSHARE;
        var accounts = (S.quota && S.quota.accounts) || [];
        if (!accounts.length || !Q) return '<p class="qnote">' + loc('q.noReading', '還沒有 5h／7d 讀數：session 跑的時候 pane 才會寫。') + '</p>';
        var acc = accounts.filter(function (a) { return a.key === view.qacc; })[0] || accounts[0];
        var R = rangeMs(rng), noData = loc('q.noData', '資料不足');
        var wins = acc.windows || [], wi = -1, win = null, steps, t0, t1;
        if (mode === '5h') {
            wi = typeof view.qwin === 'number' ? Math.max(0, Math.min(wins.length - 1, view.qwin)) : wins.length - 1;
            win = wins[wi] || null;
            steps = win ? win.steps : [];
            t0 = win ? win.start : R.a;
            t1 = win ? win.end : R.b;
        } else {
            // From the account's first reading inside the range to the range's end.
            steps = acc.steps7 || [];
            var first = steps.filter(function (s) { return s.from >= R.a && s.from < R.b; })[0];
            t0 = first ? first.from : R.a;
            t1 = R.b;
        }
        var inAxis = function (g) { return g.end > t0 && g.start < t1; };
        var segs = allSegs(S, acc.key).filter(inAxis);
        var unknown = allSegs(S, null).filter(inAxis).length;
        var ln = Q.lanesOf(segs);
        segs.forEach(function (g, i) {
            g.n = i;
            g.lane = ln.lane[i];
            g.title = g.name + ' · ' + g.project + ' · ' + md(g.start) + ' ' + hm(g.start) + ' – ' + md(g.end) + ' ' + hm(g.end);
        });
        var sel = segs.filter(function (g) { return g.id === view.qsel; })[0] || null;
        var call = null;
        if (sel) {
            // The 5h tab counts only the part inside its window (design §4); 7d, inside the axis.
            var a = Math.max(sel.start, t0), b = Math.min(sel.end, t1), got = Q.shareOf(steps, segs, sel, a, b);
            var f1 = function (v) { return String(Math.round(v * 10) / 10); };
            call = { a0: a, a1: b, v0: valueAt(steps, a), v1: valueAt(steps, b),
                text: [loc('q.rise', '這段額度 +{n}%', { n: f1(got.rise) }), loc('q.share', '這個 task 約佔 {n}%', { n: f1(got.share) })] };
        }
        var ro = function (l, v, d, warn) {
            return '<div class="ro"><div class="l">' + l + '</div><div class="v">' + v + '</div><div class="d' + (warn ? ' qwarn' : '') + '">' + d + '</div></div>';
        };
        var pct = function (v) { return v === null || v === undefined ? '—' : v + '<span class="u">%</span>'; };
        var f = acc.forecast, last5 = wins[wins.length - 1] || null;
        var stale = Boolean(f) && C.NOW - f.at > 6 * 3600e3;
        var d7 = !f ? noData : stale ? loc('q.readAt', '讀數時間 {at}', { at: md(f.at) + ' ' + hm(f.at) })
            : f.out ? loc('q.outAt', '照近 24 小時速度 {at} 用完', { at: md(f.out) + ' ' + hm(f.out) }) : loc('q.notOut', '重置前用不完');
        var v5 = last5 && last5.steps.length ? last5.steps[last5.steps.length - 1].v : null, left = last5 ? last5.end - C.NOW : 0;
        var d5 = !last5 ? noData : left > 0
            ? loc('q.resetIn', '{hm} 重置，還有 {h} 小時 {m} 分', { hm: hm(last5.end), h: Math.floor(left / 3600e3), m: Math.floor(left % 3600e3 / 60e3) })
            : loc('q.resetDone', '{hm} 已重置', { hm: hm(last5.end) });
        var pp = Q.perPoint(acc.span, (S.sessions || []).filter(function (s) { return s.account === acc.key; }).map(function (s) { return s.bins || []; }));
        var r7 = ro(loc('q.use7', '7d 用量'), pct(f && f.pct), d7, f && f.out && !stale);
        var r5 = ro(loc('q.use5', '5h 用量'), pct(v5), d5);
        var r1 = ro(loc('q.perPoint', '每 1% 額度'), pp === null ? noData : '≈ ' + H.usd(pp, true),
            pp === null ? '' : loc('q.perPointOf', '依 {from}–{to} 窗口', { from: md(acc.span.from), to: md(acc.span.to) }));
        var nav = mode !== '5h' ? '' : '<div class="qwin">'
            + '<button type="button" class="qnav" data-qwin="' + (wi - 1) + '" aria-label="' + loc('q.prevWin', '上一個 5h 窗口') + '"' + (wi > 0 ? '' : ' disabled') + '>‹</button>'
            + '<span>' + (win ? md(t0) + ' ' + hm(t0) + '–' + hm(t1) : '—') + '</span>'
            + '<button type="button" class="qnav" data-qwin="' + (wi + 1) + '" aria-label="' + loc('q.nextWin', '下一個 5h 窗口') + '"' + (wi < wins.length - 1 ? '' : ' disabled') + '>›</button></div>';
        var q = { steps: steps, t0: t0, t1: t1, now: C.NOW, segs: segs, lanes: ln.count, sel: sel ? sel.id : null, call: call,
            resets: resetsOf(steps, t0, t1, mode),
            L: { aria: loc('q.aria', '{acc} {mode} 用量，{from} 到 {to}；下方 {n} 個 task 條，點一條看它佔多少',
                { acc: accShort(acc.key), mode: mode, from: md(t0) + ' ' + hm(t0), to: md(t1) + ' ' + hm(t1), n: segs.length }),
                join: loc('q.join', '，') } };
        var plot = GEO[mode].map(function (g) {
            return H.quotaSvg(Object.assign({}, q, { ticks: ticksOf(t0, t1, mode, g.narrow ? 4 : 15) }), Object.assign({ id: 'q' + mode + (g.narrow ? 'n' : 'w') }, g));
        }).join('');
        var key = '<ul class="qkey"><li><i class="qsw" aria-hidden="true"></i>' + loc('q.keyRead', '有讀數') + '</li>'
            + '<li><i class="qsw faded" aria-hidden="true"></i>' + loc('q.keyHeld', '沒有讀數，沿用上一筆') + '</li>'
            + STAGES.map(function (st) { return '<li><i class="sw" style="background:var(--st-' + st + ')"></i>' + st + '</li>'; }).join('')
            + '<li><i class="hatchsw"></i>' + loc('q.keyGate', '等關卡') + '</li></ul>';
        var notes = [
            mode === '5h' ? loc('q.note5', '時間軸是一個 5h 窗口，預設最近一個有讀數的；‹ › 換窗口，只算這個窗口內的部分。')
                : t0 > R.a ? loc('q.note7', '區間 {from} 到 {to}；這個帳號第一筆讀數在 {at}，時間軸從那裡開始，之前沒有讀數不畫。', { from: rng.from.slice(5), to: rng.to.slice(5), at: md(t0) + ' ' + hm(t0) }) : '',
            loc('q.noteClick', '點一條 task 看它佔了這段額度多少；再點一次或點空白處取消。'),
            unknown ? loc('q.unknown', '未知帳號的 session 不畫：{n} 條。', { n: unknown }) : ''
        ].filter(Boolean);
        return '<div class="qv" data-mode="' + mode + '"><div class="qtools controls"><div class="ctlgrp"><label>' + loc('q.account', '帳號') + '</label>'
            + H.segHtml('qacc', accounts.map(function (a) { return [a.key, accName(a)]; }), acc.key) + '</div></div>'
            + '<div class="qacc" data-acc="' + H.esc(acc.key) + '"><div class="qrow"><div class="readouts qfc">' + (mode === '5h' ? r5 + r7 : r7 + r5) + r1 + '</div>' + nav + '</div>'
            + '<div class="qplot">' + plot + '</div>' + key + '<p class="qnote">' + notes.join(' ') + '</p></div></div>';
    }
    // The account and task a 最貴的 5 個 task row opens (fmt.js parseHash `acc`, `task`):
    // applied once each time the hash changes, so the 3 s redraw does not undo a click.
    var hashSeen = '';
    function applyHash(r) {
        var k = (r.acc || '') + '|' + (r.task || '');
        if (k === hashSeen) return;
        hashSeen = k;
        if (r.acc) C.view.qacc = r.acc;
        if (r.task) C.view.qsel = r.task;
    }
    // A click station.js's document listener hands over from `.qplot` or `.qnav`: ‹ ›
    // moves the 5h window, a bar is selected or, clicked again, cleared, and the blank
    // clears. true when the click was this page's.
    function pick(target) {
        var view = C.view, nav = target.closest('.qnav');
        if (nav) {
            if (!nav.disabled) {
                view.qwin = Number(nav.getAttribute('data-qwin'));
                view.qsel = null;
                C.draw();
            }
            return true;
        }
        var bar = target.closest('.qbar');
        if (bar) {
            var id = bar.getAttribute('data-task');
            view.qsel = view.qsel === id ? null : id;
            C.draw();
            return true;
        }
        if (!target.closest('.qplot')) return false;
        if (view.qsel) {
            view.qsel = null;
            C.draw();
        }
        return true;
    }
    // 近 30 天: the hero that used to open the home page. A day in the hash is
    // marked on the chart; there is no day panel any more.
    function daysPage(r) {
        var H = C.H, view = C.view, S = C.S;
        var R = H.homeRows();
        var RG = w.FK_RANGE || null;
        // The range (assets/station/spend-range.js): 近 30 天 unless the
        // reader picked another; without the module the page is as it was.
        var rng = RG ? RG.rangeOf(view.range, C.NOW, view.rangeFrom, view.rangeTo) : { kind: '30d', days: C.DAYS, prev: C.PREV, from: C.DAYS[0], to: C.TODAY };
        var picked = RG && view.range === 'custom' ? 'custom' : rng.kind;
        var sel = r.day && rng.days.indexOf(r.day) >= 0 ? r.day : null;
        var o = H.homeOpts(sel);
        o.days = rng.days;
        o.today = rng.to;
        o.off = chartOff[view.dim] || {};
        o.panel = chartPanel;
        var all = H.dayBars(R, view.metric, view.dim, rng.days), bars = H.visibleBars(all, o);
        chartBars = bars;
        chartOpts = o;
        var held = null;
        if (RG) {
            RG.listen(doc, function (a, b) { view.range = 'custom'; view.rangeFrom = a; view.rangeTo = b; C.draw(); });
            held = S.serve ? RG.load(rng, function () { if (C.route.view === 'days') C.draw(); }) : RG.held(rng);
        }
        return H.subtabsHtml('days') + '<section class="panel hero" data-block="days"><div class="hero-top"><div class="hero-title"><div class="eyebrow">' + H.icon('days')
            + H.heroEyebrow(C.frozenAt) + '</div>'
            + '<h1><b>' + rng.from.slice(5) + '</b> — <b>' + rng.to.slice(5) + '</b></h1></div>'
            + H.kpiHtml(H.windowTotals(R, rng.days), H.windowTotals(R, rng.prev), picked === '30d' ? null : RG.costLabel()) + '</div>'
            + (RG ? RG.kpiHtml(held, Boolean(S.serve)) : '')
            + '<div class="controls">'
            + (RG ? RG.controlsHtml(picked, rng, view.rangeFrom, view.rangeTo) : '')
            + '<div class="ctlgrp"><label>' + loc('dash.barHeight', '長條高度') + '</label>'
            + H.segHtml('metric', [['tokens', 'token'], ['usd', loc('dash.cost', '花費')], ['time', loc('dash.time', '時間')]], view.metric) + '</div>'
            + '<div class="ctlgrp"><label>' + loc('dash.splitBy', '分段') + '</label>'
            + H.segHtml('dim', [['model', loc('dash.byModel', '依 model')], ['project', loc('dash.byProject', '依專案')], ['stage', loc('dash.byStage', '依 stage')], ['who', loc('dash.mainVsAgent', '主 session 對 agent')],
                ['type', H.DIM_LABEL.type], ['version', loc('dash.byVersion', '依版本')], ['kind', loc('dash.byKind', '依成分')]],
                view.dim, view.metric === 'time' ? { model: loc('dash.noTimeByModel', '時間沒有 model 可分'), kind: loc('dash.noTimeByKind', '時間沒有成分可分'), type: H.NO_TIME_TYPE } : null) + '</div></div>'
            // The legend has a strip of its own, one line high: however many
            // series a dim has, the switches above and the chart below stay
            // where they are. What does not fit scrolls; 篩選 lists everything.
            + '<div class="lstrip"><div class="legend">' + H.legendHtml(all, o) + '</div>' + H.filterHtml(all, o) + '</div>'
            + '<div class="chart">' + H.histSvg(bars, o) + '</div></section>'
            + (w.FK_PANEL ? w.FK_PANEL.html(held, S.prices, Boolean(S.serve)) : '')
            + '<div class="dash kdash pcards" data-block="spend-cards"><div class="dcol" data-col="main">' + H.dashByProj(R) + H.dashTokens7(R)
            + '</div><div class="dcol" data-col="side">' + H.dashModels(R) + '</div></div>'
            + (w.FK_KINDS ? w.FK_KINDS.table(S.prices, S.pricesVerified) : '');
    }
    // Every legend entry is a toggle: armed here rather than in legendHtml so
    // the entry markup the tests read stays what it was.
    function legendArm() {
        [].forEach.call(doc.querySelectorAll('.legend [data-key], .legend [data-rest]'), function (el) {
            var off = el.hasAttribute('data-off');
            el.setAttribute('role', 'button');
            el.setAttribute('tabindex', '0');
            el.setAttribute('aria-pressed', off ? 'false' : 'true');
            if (!el.title) el.title = off ? loc('q.clickToPutBack', '按一下放回圖表') : loc('q.clickToRemoveFirst', '按一下先從圖表拿掉');
        });
    }
    // Set some keys off (`on` false) or back on, redraw, and put focus back on
    // whatever `sel` finds in the new DOM — the redraw lost the old element.
    function chartSet(keys, on, sel) {
        var off = chartOff[C.view.dim] || (chartOff[C.view.dim] = {});
        keys.forEach(function (k) { if (on) delete off[k]; else off[k] = true; });
        chartHover = false;
        chartAt = null;
        chartTipEl().removeAttribute('data-on');
        C.draw();
        var back = sel && doc.querySelector(sel);
        if (back) back.focus();
    }
    function cssKey(k) { return String(k).replace(/["\\]/g, '\\$&'); }
    // A legend entry takes its key out or puts it back; 其他 N 個 does all its
    // members at once — the shown ones out, or, dimmed, its hidden ones back.
    function legendToggle(el) {
        if (el.hasAttribute('data-rest')) {
            var back = el.hasAttribute('data-off'), off = chartOpts.off || {};
            chartSet(back ? C.H.legendRest(chartBars, { dim: chartOpts.dim, pkeys: chartOpts.pkeys }).filter(function (k) { return off[k]; })
                : C.H.legendRest(chartBars, chartOpts), back, '.legend [data-rest]');
            return;
        }
        var k = el.getAttribute('data-key');
        chartSet([k], el.hasAttribute('data-off'), '.legend [data-key="' + cssKey(k) + '"]');
    }
    function panelShut(focusBtn) {
        chartPanel = false;
        C.draw();
        if (focusBtn) { var b = doc.querySelector('[data-fbtn]'); if (b) b.focus(); }
    }
    var api = {
        page: function (r, ctx) { C = ctx; return daysPage(r); },
        restore: function () { chartRestore(); },
        hide: function () { chartHide(); },
        focusPin: function () { chartFocus(chartPin); },
        arm: function () { legendArm(); },
        toggle: function (el) { legendToggle(el); },
        panelShut: function (focusBtn) { panelShut(focusBtn); },
        set: function (keys, on, sel) { chartSet(keys, on, sel); },
        setAll: function (on, sel) { chartSet(chartBars ? chartBars.keys : [], on, sel); },
        setPanel: function (open) { chartPanel = Boolean(open); },
        panelOpen: function () { return chartPanel; },
        hovering: function () { return chartHover; },
        onMove: function (e, ctx) { C = ctx; move(e); },
        // One quota tab on its own, and the click station.js hands over for `.qplot`
        // and `.qnav` (true when it was this page's).
        quota: function (mode, r, ctx) { C = ctx; applyHash(r || {}); return quotaPanel(mode, rangeNow()); },
        pick: function (target, ctx) { C = ctx; return pick(target); },
        EN: EN
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_DAYS = api;
}(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null));
