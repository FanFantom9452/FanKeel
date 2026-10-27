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
        'q.clickToRemoveFirst': 'Click to take it off the chart first'
    };
    function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    function loc(key, zh) {
        var I = w && w.FK_I18N;
        return I && I.lang === 'en' && has(EN, key) ? EN[key] : zh;
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
        onMove: function (e, ctx) { C = ctx; move(e); }
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_DAYS = api;
}(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null));
