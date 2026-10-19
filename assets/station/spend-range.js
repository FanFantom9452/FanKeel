'use strict';
// assets/station/spend-range.js — the 花費 page's range (station-32): 本週
// the seven days to today, 上週 the seven before them, 近 30 天, or 自訂
// from..to, each with `prev`, the same number of days ending the day before
// it starts — the comparison lib/compare.js makes. The registry chart is
// drawn over the range; the machine-wide total comes from serve's range
// report (lib/spendrange.js), asked once per range for the life of the page.
// Loaded before station.js; reads `window.FK_KIT` only when it draws.
(function (w) {
    var EN = {
        'range.label': 'Range',
        'range.week': 'this week',
        'range.lastWeek': 'last week',
        'range.last30': 'last 30 days',
        'range.custom': 'custom',
        'range.from': 'from',
        'range.to': 'to',
        'range.cost': 'range cost',
        'range.all': 'machine-wide cost (usage-compare rule)',
        'range.needsServe': 'only a page opened from serve can count it',
        'range.failed': 'could not read the range cost; reload to try again',
        'range.loading': 'counting…',
        'range.prev': 'range before {v}',
        'range.prevSessions': 'range before {n}',
    };
    function kit() { return (w && w.FK_KIT) || {}; }
    function loc(key, zh, vars) {
        var I = w && w.FK_I18N;
        var s = I && I.lang === 'en' && Object.prototype.hasOwnProperty.call(EN, key) ? EN[key] : zh;
        return kit().fillVars ? kit().fillVars(s, vars) : s;
    }
    // Whole local days, the last included, counted on the calendar at noon so
    // a daylight-saving day neither repeats nor drops. A 自訂 with a missing
    // or backwards end is 近 30 天.
    function rangeOf(kind, nowMs, from, to) {
        var K = kit();
        var at = function (day, k) {
            return new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)) + k, 12).getTime();
        };
        var run = function (first, n) {
            var out = [];
            for (var i = 0; i < n; i++) out.push(K.localDay(at(first, i)));
            return out;
        };
        var ok = /^\d{4}-\d{2}-\d{2}$/;
        var today = K.localDay(nowMs), days;
        if (kind === 'week') days = run(K.localDay(at(today, -6)), 7);
        else if (kind === 'lastweek') days = run(K.localDay(at(today, -13)), 7);
        else if (kind === 'custom' && ok.test(from || '') && ok.test(to || '') && from <= to) days = run(from, Math.round((at(to, 0) - at(from, 0)) / 864e5) + 1);
        else { kind = '30d'; days = K.lastDays(nowMs, 30); }
        return { kind: kind, days: days, prev: run(K.localDay(at(days[0], -days.length)), days.length), from: days[0], to: days[days.length - 1] };
    }
    function costLabel() { return loc('range.cost', '區間花費'); }
    // The range seg (station.js's seg handler sets `view.range`), and for
    // 自訂 two date boxes, which `listen` hears.
    function controlsHtml(current, rng, from, to) {
        var K = kit();
        return '<div class="ctlgrp"><label>' + loc('range.label', '區間') + '</label>'
            + K.segHtml('range', [['week', loc('range.week', '本週')], ['lastweek', loc('range.lastWeek', '上週')], ['30d', loc('range.last30', '近 30 天')], ['custom', loc('range.custom', '自訂')]], current)
            + (current === 'custom' ? '<input type="date" data-range="from" value="' + K.esc(from || rng.from) + '" aria-label="' + loc('range.from', '起') + '">'
                + '<input type="date" data-range="to" value="' + K.esc(to || rng.to) + '" aria-label="' + loc('range.to', '訖') + '">' : '') + '</div>';
    }
    // The range's machine-wide total and the total of the range before it,
    // which the registry's `days` cannot answer. A written copy has no
    // server, and says so.
    function kpiHtml(held, serve) {
        var K = kit(), label = loc('range.all', '全機花費（usage-compare 規則）');
        if (!serve) return '<div class="readouts">' + K.roHtml(label, '—', loc('range.needsServe', '要從 serve 開的頁面才算得到')) + '</div>';
        if (!held || !held.rep) {
            return '<div class="readouts">' + K.roHtml(label, '—', held && held.state === 'failed'
                ? loc('range.failed', '讀不到區間花費，重新整理再試') : loc('range.loading', '計算中…')) + '</div>';
        }
        var rep = held.rep;
        return '<div class="readouts" data-block="range-kpi">'
            + K.roHtml(label, K.usd2(rep.usd), K.delta(rep.usd, rep.prev.usd) + ' · ' + loc('range.prev', '前一段 {v}', { v: K.usd2(rep.prev.usd) }))
            + K.roHtml('session', K.comma(rep.sessions), loc('range.prevSessions', '前一段 {n} 個', { n: K.comma(rep.prev.sessions) })) + '</div>';
    }
    var SPEND = {};
    function held(rng) { return SPEND[rng.from + '..' + rng.to] || null; }
    function load(rng, redraw) {
        var key = rng.from + '..' + rng.to;
        if (SPEND[key]) return SPEND[key];
        var h = SPEND[key] = { state: 'loading', rep: null };
        fetch('station/spend?from=' + rng.from + '&to=' + rng.to + '&top=10').then(function (r) {
            if (!r.ok) throw new Error(String(r.status));
            return r.json();
        }).then(function (rep) {
            h.rep = rep;
            h.state = '';
            redraw();
        }, function () {
            h.state = 'failed';
            redraw();
        });
        return h;
    }
    // The date boxes' listener, added on the first 花費 page draw rather than
    // at load: tests/station-hdl-*.test.js pick the page's document listeners
    // by the order they were added at load.
    var heard = false;
    function listen(doc, pick) {
        if (heard || !doc) return;
        heard = true;
        doc.addEventListener('change', function (e) {
            var box = e && e.target && e.target.getAttribute ? e.target.getAttribute('data-range') : null;
            if (!box) return;
            var group = e.target.parentNode;
            var a = group.querySelector('[data-range="from"]'), b = group.querySelector('[data-range="to"]');
            pick(a ? a.value : '', b ? b.value : '');
        });
    }
    var api = { rangeOf: rangeOf, costLabel: costLabel, controlsHtml: controlsHtml, kpiHtml: kpiHtml, held: held, load: load, listen: listen, EN: EN };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_RANGE = api;
}(typeof window !== 'undefined' ? window : null));
