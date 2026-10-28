// 30 天圖與專案頁殘留 (FK_CHART): moved out of station.js (station-52).
// station.js calls make(K) once, on first use, handing it the helpers these
// bodies name; everything here only computes or builds strings.
(function (w) {
    'use strict';
    function make(K) {
        // One alias per name K carries, so the bodies below moved verbatim.
        var loc = K.loc, esc = K.esc, tokens = K.tokens, usd = K.usd, hours = K.hours, estMark = K.estMark, delta = K.delta;
        var quotaDay = K.quotaDay, icon = K.icon, ago = K.ago, stamp = K.stamp, mins = K.mins, statePill = K.statePill;
        var keelStage = K.keelStage, keelProgress = K.keelProgress, localDay = K.localDay, dimKey = K.dimKey;
        var tokenSum = K.tokenSum, orderKeys = K.orderKeys, niceTop = K.niceTop, metricText = K.metricText;
        var colorOf = K.colorOf, keyLabel = K.keyLabel, keyHint = K.keyHint, partEst = K.partEst;
        var projectHash = K.projectHash, sessionHash = K.sessionHash, sessionTotals = K.sessionTotals, windowTotals = K.windowTotals;
        var METRIC_LABEL = K.METRIC_LABEL, DIM_LABEL = K.DIM_LABEL, NO_TIME_TYPE = K.NO_TIME_TYPE;
        var KIND_KEYS = K.KIND_KEYS, MODEL_KEYS = K.MODEL_KEYS;
        // One bar per day; a bar's total is added in the same pass as its parts,
        // so it is their sum and nothing else.
        function dayBars(sessions, metric, dim, days) {
            if (metric === 'time' && dim === 'model') {
                return { days: [], keys: [], max: 0, disabled: loc('shared.noTimeByModel', '時間沒有 model 可分：spans 只記 stage 與誰在跑，不記 model') };
            }
            // Same reason as `model`, just above: with `時間` the bars come from
            // `s.spans`, and a span records only stage and who, so it carries no
            // tokens and no cost to split into kinds. `version` needs no such
            // guard — it is a property of the session, so it applies to spans too.
            if (metric === 'time' && dim === 'kind') {
                return { days: [], keys: [], max: 0, disabled: loc('shared.noTimeByKind', '時間沒有成分可分：spans 只記 stage 與誰在跑，不記 token 或花費') };
            }
            if (metric === 'time' && dim === 'type') {
                return { days: [], keys: [], max: 0, disabled: NO_TIME_TYPE };
            }
            var at = {}, seen = {};
            days.forEach(function (d) { at[d] = { day: d, total: 0, parts: {}, est: {}, estimated: false }; });
            var add = function (d, key, v, e) {
                if (!at[d] || !v) return;
                if (e) { at[d].est[key] = true; at[d].estimated = true; }
                at[d].parts[key] = (at[d].parts[key] || 0) + v;
                at[d].total += v;
                seen[key] = (seen[key] || 0) + v;
            };
            sessions.forEach(function (s) {
                if (metric === 'time') {
                    (s.spans || []).forEach(function (r) { if (r.who !== 'wait') add(r.day, dimKey(dim, s, r), r.ms); });
                    return;
                }
                (s.days || []).forEach(function (r) {
                    // `kind` is five segments of the same row, not one key per
                    // row, so it calls `add` five times instead of once — the
                    // comment above this function still holds: the total is
                    // added in the same pass as the parts, so it stays their sum.
                    // `r.cost`/`r.tokens` is null for a model `lib/prices.js` has
                    // no rate for (or a kept v1 row with no detail); skip it, the
                    // same as `r.usd || 0` already does for every other dim.
                    if (dim === 'kind') {
                        var src = metric === 'usd' ? r.cost : r.tokens;
                        if (!src) return;
                        KIND_KEYS.forEach(function (k) { add(r.day, k, src[k], r.estimated); });
                        return;
                    }
                    add(r.day, dimKey(dim, s, r), metric === 'usd' ? r.usd || 0 : tokenSum(r.tokens), metric === 'usd' && r.estimated);
                });
            });
            var list = days.map(function (d) { return at[d]; });
            return {
                days: list, keys: orderKeys(dim, seen), disabled: null,
                max: Math.max.apply(null, list.map(function (b) { return b.total; }).concat([0])),
            };
        }
        // A session counts toward a project's `n` when it spent inside the window
        // or started inside it; one with no transcript has only its start.
        function projectRows(sessions, days) {
            var inside = {}, by = {}, list = [];
            days.forEach(function (d, i) { inside[d] = i + 1; });
            sessions.forEach(function (s) {
                var r = by[s.pkey];
                if (!r) {
                    r = by[s.pkey] = { pkey: s.pkey, root: s.root, project: s.project || null, usd: 0, n: 0, last: 0, estimated: false,
                        daily: days.map(function () { return 0; }) };
                    list.push(r);
                }
                var touched = false;
                (s.days || []).forEach(function (x) {
                    if (!inside[x.day]) return;
                    if (x.estimated && x.usd) r.estimated = true;
                    r.usd += x.usd || 0;
                    r.daily[inside[x.day] - 1] += x.usd || 0;
                    touched = true;
                });
                if (touched || inside[localDay(Date.parse(s.started))]) r.n++;
                r.last = Math.max(r.last, s.updated || 0);
            });
            return list.sort(function (a, b) { return b.usd - a.usd || b.last - a.last; });
        }
        // One readout: its label, its value and the line under it.
        function roHtml(l, v, d) {
            return '<div class="ro"><div class="l">' + l + '</div><div class="v">' + v + '</div><div class="d">' + d + '</div></div>';
        }
        function kpiHtml(cur, prev, label) {
            var share = function (t) { return t.main + t.wait ? t.wait / (t.main + t.wait) : 0; };
            var out = '<div class="readouts">'
                + roHtml(label || loc('shared.cost30d', '30 天花費'), usd(cur.usd) + estMark(cur), delta(cur.usd, prev.usd) + (quotaDay() ? ' · ' + loc('shared.quotaCalibrated', '週額度 {d} 校準', { d: quotaDay() }) : ''))
                + roHtml('token', tokens(cur.tokens), delta(cur.tokens, prev.tokens))
                + roHtml(loc('shared.activeTime', 'active 時間'), hours(cur.active), delta(cur.active, prev.active))
                + roHtml('<i class="hatchsw"></i>' + loc('shared.waitShare', '等待佔比'), Math.round(share(cur) * 1000) / 10 + '<span class="u">%</span>',
                    (prev.main + prev.wait ? delta(share(cur), share(prev), 'pt') : '<span class="delta flat">' + loc('shared.noPriorData', '前期無資料') + '</span>')
                    + ' · ' + loc('shared.waitedFor', '{t} 等', { t: hours(cur.wait) }));
            var top = K.S().gates && K.S().gates.swapped && K.S().gates.swapped.length ? K.S().gates.swapped[0] : null;
            out += roHtml(loc('shared.mostSwapped', '最常被換掉'), top ? esc(top.label) : '—', top ? top.lost + ' / ' + top.total : '');
            return out + '</div>';
        }
        function spark(values, colour) {
            var W = 120, H = 30, mx = Math.max.apply(null, values.concat([0])) || 1, n = Math.max(values.length - 1, 1);
            return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" aria-hidden="true"><polyline points="'
                + values.map(function (v, i) {
                    return (i / n * (W - 4) + 2).toFixed(1) + ',' + (H - 3 - v / mx * (H - 7)).toFixed(1);
                }).join(' ') + '" style="fill:none;stroke:' + colour + ';stroke-width:1.5;stroke-linejoin:round"/></svg>';
        }
        // `ring` circles the stage a live session is in, so a row that is still
        // running reads apart from one that stopped there.
        function routeDots(s, ring) {
            var route = s.route || [], at = route.indexOf(s.stage);
            return '<span class="route" aria-label="route ' + esc(route.join(' → ')) + '">' + route.map(function (k, i) {
                if (i === at && ring) {
                    return '<i title="' + esc(loc('shared.stageNow', '{k}（現在）', { k: k })) + '" class="now" style="--c:var(--st-' + esc(k) + ');background:var(--c)"></i>';
                }
                return '<i title="' + esc(k) + '"' + (i <= at ? ' style="background:var(--st-' + esc(k) + ')"' : ' class="todo"') + '></i>';
            }).join('') + '</span>';
        }
        // The stage a row is at, by name and number beside its dots; the dots ring
        // it only while the session is live.
        function stageNow(s) {
            return routeDots(s, s.state === 'live') + '<span class="stname">' + esc(s.stage || '—')
                + (s.steps ? '<span class="of">' + s.step + '/' + s.steps + '</span>' : '') + '</span>';
        }
        // How many of a live row's agents are running this moment — `running` on the
        // list data, counted by lib/station.js from each agent's state. A row that is
        // not live, or has no detail to count from, says nothing rather than a zero
        // nobody measured.
        function runningTag(s) {
            if (s.state !== 'live' || typeof s.running !== 'number') return '';
            return s.running
                ? '<span class="runn" title="' + esc(loc('shared.nRunningNow', '此刻有 {n} 個 agent 是 running', { n: s.running })) + '"><i class="dot live"></i>running ' + s.running + '</span>'
                : '<span class="runn zero" title="' + esc(loc('shared.noneRunningNow', '此刻沒有 agent 是 running')) + '">running 0</span>';
        }
        // `off` maps an option to the reason it cannot be chosen right now.
        function segHtml(key, opts, current, off) {
            return '<div class="seg" role="group" data-seg="' + key + '">' + opts.map(function (o) {
                var why = off && off[o[0]];
                return '<button type="button" data-v="' + esc(o[0]) + '" aria-pressed="' + (current === o[0]) + '"'
                    + (why ? ' disabled title="' + esc(why) + '"' : '') + '>' + esc(o[1]) + '</button>';
            }).join('') + '</div>';
        }
        function histSvg(bars, o) {
            if (bars.disabled) return '<p class="note">' + esc(bars.disabled) + '</p>';
            var W = 1200, H = 318, L = 52, R = 4, T = 26, AX = 48, plotH = H - T - AX, base = T + plotH;
            var n = bars.days.length || 1, slot = (W - L - R) / n, bw = Math.min(24, slot * 0.6);
            var top = niceTop(bars.max), y = function (v) { return v / top * plotH; }, pal = paletteOf(bars, o);
            var out = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="'
                + loc('shared.dailyOverDays', '近 {n} 天每日{metric}，{dim}', { n: n, metric: METRIC_LABEL[o.metric], dim: DIM_LABEL[o.dim] }) + '">';
            [0, 0.25, 0.5, 0.75, 1].forEach(function (f) {
                var yy = (base - f * plotH).toFixed(1);
                out += '<line class="' + (f ? 'gridl' : 'base') + '" x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '"/>'
                    + '<text class="tick" x="' + (L - 10) + '" y="' + (Number(yy) + 4) + '" text-anchor="end">'
                    + metricText(o.metric, top * f, true) + '</text>';
            });
            bars.days.forEach(function (b, i) {
                var cx = (L + i * slot + slot / 2).toFixed(1), x0 = (L + i * slot + slot / 2 - bw / 2).toFixed(1);
                var c = 0, open = b.day === o.sel, mark = open || b.day === o.today;
                var href = open ? '#/' : '#/d/' + b.day;
                var label = loc('shared.dayTotal', '{day} 合計 {total}', { day: b.day, total: metricText(o.metric, b.total, false, b.estimated) })
                    + bars.keys.filter(function (k) { return b.parts[k]; })
                        .map(function (k) { return loc('shared.dayTotalSeg', '；{key} {v}', { key: keyLabel(o.dim, k, o.names), v: metricText(o.metric, b.parts[k], false, partEst(b, k)) }); }).join('');
                // The column's hit area goes first, so every segment drawn after it
                // sits on top and takes the hover itself.
                out += '<rect class="hit" data-href="' + href + '" data-day="' + b.day + '" data-cx="' + cx + '" x="' + (L + i * slot).toFixed(1)
                    + '" y="' + (T - 10) + '" width="' + slot.toFixed(1) + '" height="' + (plotH + AX) + '" aria-label="' + esc(label) + '"/>';
                out += '<g class="bar"' + (o.sel && !open ? ' style="opacity:.36"' : '') + '>';
                bars.keys.forEach(function (k) {
                    if (!b.parts[k]) return;
                    var h = y(b.parts[k]);
                    out += '<rect class="hseg" data-day="' + b.day + '" data-key="' + esc(k) + '" data-cx="' + cx + '" data-href="' + href
                        + '" x="' + x0 + '" y="' + (base - c - h).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="'
                        + Math.max(h - 1, 0.5).toFixed(1) + '" style="fill:' + colorOf(o.dim, k, pal) + '"/>';
                    c += h;
                });
                out += '</g>'
                    + (b.total ? '<text class="tick" x="' + cx + '" y="' + (base - c - 7).toFixed(1) + '" text-anchor="middle">'
                        + metricText(o.metric, b.total, true, b.estimated) + '</text>' : '')
                    + '<text class="tick" x="' + cx + '" y="' + (base + 17) + '" text-anchor="middle"'
                    + (mark ? ' style="fill:var(--ink);font-weight:600"' : '') + '>' + Number(b.day.slice(8)) + '</text>'
                    + (b.day === o.today || b.day.slice(8) === '01' || i === 0
                        ? '<text x="' + cx + '" y="' + (base + 33) + '" text-anchor="middle">'
                        + (b.day === o.today ? loc('shared.today', '今天') : loc('shared.monthN', '{n}月', { n: Number(b.day.slice(5, 7)) })) + '</text>' : '');
            });
            return out + '<line class="hguide" x1="0" x2="0" y1="' + T + '" y2="' + base + '"/></svg>';
        }
        // The order `colorOf` ranks a palette dim by, with the keys in `o.off`
        // taken out first — so what the filter leaves is ranked, and coloured,
        // afresh. With nothing off it is the list the chart always used.
        function paletteOf(bars, o) {
            var off = o.off || {};
            return ((o.dim === 'version' || o.dim === 'model' || o.dim === 'type') ? bars.keys : o.pkeys || []).filter(function (k) { return !off[k]; });
        }
        // The shown keys that get a legend entry of their own; the rest share
        // 其他 N 個. Pass an `o` without `off` for the unfiltered grouping.
        function legendOwn(bars, o) {
            var off = o.off || {}, rank = paletteOf(bars, o);
            var keys = bars.keys.filter(function (k) { return !off[k]; });
            return (o.dim !== 'project' && o.dim !== 'version') ? keys : keys.filter(function (k) {
                if (o.dim === 'version' && k === 'none') return true;
                var i = rank.indexOf(k);
                return i >= 0 && i < 5;
            });
        }
        // The shown keys folded into 其他 N 個.
        function legendRest(bars, o) {
            var off = o.off || {}, own = legendOwn(bars, o);
            return bars.keys.filter(function (k) { return !off[k] && own.indexOf(k) < 0; });
        }
        // A project's label is `<root tail> / <project>`, and a root tail can be a
        // long path: the legend shows the part after the last ` / `, or else the
        // last path segment, and leaves the whole label to the entry's title.
        function shortLabel(full) {
            var s = String(full), i = s.lastIndexOf(' / ');
            if (i >= 0) return s.slice(i + 3);
            var parts = s.split(/[\\/]/).filter(Boolean);
            return parts.length > 1 ? parts[parts.length - 1] : s;
        }
        // The order hint's tooltip is the SVG's own <title>, so the legend's only
        // span with a title stays an entry that needs one.
        var ICON_ORDER = '<svg viewBox="0 0 12 12" width="12" height="12" role="img" aria-label="' + loc('shared.bottomUp', '由下而上')
            + '"><title>' + loc('shared.bottomUpHint', '由下而上：列在前面的疊在最底下') + '</title>'
            + '<path d="M6 10.5V2M3 4.8 6 1.8l3 3"'
            + ' fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        var ICON_FUNNEL = '<svg viewBox="0 0 14 14" width="13" height="13" aria-hidden="true"><path d="M1.8 2.5h10.4L8.3 7.2v3.9l-2.6 1.3V7.2z"'
            + ' fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>';
        // `o.off` is the set of keys clicked out of the chart. The legend is the
        // chart after the filter — its own entries and 其他 re-ranked from what is
        // shown — plus, dimmed and `data-off`, each hidden key that had an entry
        // unfiltered, so a click can put it back. 其他 whose members are all hidden
        // stays as one dimmed entry that puts them back.
        function legendHtml(bars, o) {
            if (bars.disabled) return '';
            var off = o.off || {}, base = { dim: o.dim, pkeys: o.pkeys };
            var vis = legendOwn(bars, o), rest = legendRest(bars, o), own0 = legendOwn(bars, base);
            var gone0 = legendRest(bars, base).filter(function (k) { return off[k]; });
            var own = bars.keys.filter(function (k) { return vis.indexOf(k) >= 0 || (off[k] && own0.indexOf(k) >= 0); });
            var pal = paletteOf(bars, o), pal0 = paletteOf(bars, base);
            var full = own.map(function (k) { return keyLabel(o.dim, k, o.names); });
            var short = full.map(shortLabel);
            return '<span class="lord">' + ICON_ORDER + '</span>' + own.map(function (k, i) {
                var hint = keyHint(o.dim, k);
                // A short form only where it names one series alone; a label that
                // is shortened, or long anyway, is clipped and carries its whole self.
                var s = short.filter(function (x) { return x === short[i]; }).length > 1 ? full[i] : short[i];
                var cut = s !== full[i] || s.length > 20;
                var title = [cut ? full[i] : '', hint].filter(Boolean).join('\n');
                return '<span data-key="' + esc(k) + '"' + (title ? ' title="' + esc(title) + '"' : '') + (off[k] ? ' data-off' : '')
                    + '><i class="sw" style="background:'
                    + colorOf(o.dim, k, off[k] ? pal0 : pal) + '"></i>'
                    + (cut ? '<span class="lt">' + esc(s) + '</span>' : esc(s)) + '</span>';
            }).join('') + (rest.length
                ? '<span data-rest><i class="sw" style="background:var(--p-5)"></i>' + loc('shared.othersN', '其他 {n} 個', { n: rest.length }) + '</span>'
                : gone0.length ? '<span data-rest data-off><i class="sw" style="background:var(--p-5)"></i>' + loc('shared.othersN', '其他 {n} 個', { n: gone0.length }) + '</span>' : '');
        }
        // The 篩選 panel: every series one checkbox, grouped the unfiltered way so
        // the list holds still while boxes are ticked; a swatch is the colour the
        // chart draws that series in now, or its unfiltered one while it is off.
        function filterHtml(bars, o) {
            if (bars.disabled || !bars.keys.length) return '';
            var off = o.off || {}, base = { dim: o.dim, pkeys: o.pkeys }, own = legendOwn(bars, base), rest = legendRest(bars, base);
            var pal = paletteOf(bars, o), pal0 = paletteOf(bars, base), n = bars.keys.filter(function (k) { return off[k]; }).length;
            var row = function (k) {
                return '<label><input type="checkbox" data-fk="' + esc(k) + '"' + (off[k] ? '' : ' checked') + '><i class="sw" style="background:'
                    + colorOf(o.dim, k, off[k] ? pal0 : pal) + '"></i><span title="' + esc(keyLabel(o.dim, k, o.names)) + '">'
                    + esc(keyLabel(o.dim, k, o.names)) + '</span></label>';
            };
            return '<div class="fwrap"><button type="button" class="fbtn" data-fbtn aria-haspopup="true" aria-expanded="' + !!o.panel + '"'
                + ' aria-label="' + loc('shared.filter', '篩選') + (n ? loc('shared.filterShownOf', '：顯示 {shown} / {total}', { shown: bars.keys.length - n, total: bars.keys.length }) : '')
                + '" title="' + loc('shared.filterSeriesHint', '篩選圖表的系列') + '">' + ICON_FUNNEL
                + (n ? '<b>' + (bars.keys.length - n) + '/' + bars.keys.length + '</b>' : '') + '</button>'
                + (o.panel ? '<div class="fpanel" role="group" aria-label="' + loc('shared.whichShown', '圖表顯示哪些') + '">'
                    + '<div class="fall"><button type="button" data-fall="on">' + loc('shared.selectAll', '全選') + '</button><button type="button" data-fall="off">' + loc('shared.selectNone', '全不選') + '</button></div>'
                    + own.map(row).join('')
                    + (rest.length ? '<div class="fsub">' + loc('shared.othersN', '其他 {n} 個', { n: rest.length }) + '</div>' + rest.map(row).join('') : '')
                    + '</div>' : '') + '</div>';
        }
        // The bars with the clicked-out series taken away: each day's total and
        // the max are summed again from what is left, so the axis fits the rest.
        // `keys` stays whole — the stacking order — and the colours come from
        // `paletteOf`, which ranks what is left.
        function visibleBars(bars, o) {
            var off = o.off || {};
            var gone = function (k) { return off[k]; };
            if (bars.disabled || !bars.keys.some(gone)) return bars;
            var list = bars.days.map(function (b) {
                var parts = {}, total = 0;
                Object.keys(b.parts).forEach(function (k) { if (!gone(k)) { parts[k] = b.parts[k]; total += b.parts[k]; } });
                return { day: b.day, total: total, parts: parts };
            });
            return { days: list, keys: bars.keys, disabled: null,
                max: Math.max.apply(null, list.map(function (b) { return b.total; }).concat([0])) };
        }
        // The hover card for one column of the 30-day chart: the day, the segment
        // under the pointer (none when the pointer is on the column's empty part),
        // every segment of that day top-down as stacked, and the day's total.
        function segTip(bars, o, day, key) {
            var b = null;
            bars.days.forEach(function (d) { if (d.day === day) b = d; });
            if (!b) return '';
            var pk = paletteOf(bars, o);
            var sw = function (k) { return '<i class="sw" style="background:' + colorOf(o.dim, k, pk) + '"></i>'; };
            var pct = function (v) { return b.total ? Math.round(v / b.total * 100) + '%' : '—'; };
            var keys = bars.keys.filter(function (k) { return b.parts[k]; });
            return '<div class="tt-day">' + esc(day) + (day === o.today ? ' · ' + loc('shared.today', '今天') : '') + '</div>'
                + (key && b.parts[key]
                    ? '<div class="tt-main">' + sw(key) + '<b>' + esc(keyLabel(o.dim, key, o.names)) + '</b></div>'
                        + '<div class="tt-val"><b>' + metricText(o.metric, b.parts[key], false, partEst(b, key)) + '</b><span>' + loc('shared.dayShare', '當天的 {p}', { p: pct(b.parts[key]) }) + '</span></div>'
                    : '')
                + '<ul class="tt-list">' + keys.reverse().map(function (k) {
                    return '<li' + (k === key ? ' data-hot' : '') + '>' + sw(k) + '<span>' + esc(keyLabel(o.dim, k, o.names))
                        + '</span><span class="tt-n">' + metricText(o.metric, b.parts[k], false, partEst(b, k)) + '</span></li>';
                }).join('') + '</ul>'
                + '<div class="tt-sum">' + loc('shared.dayTotalLabel', '當天合計') + ' <b>' + metricText(o.metric, b.total, false, b.estimated) + '</b></div>';
        }
        function projectsHtml(rows, o) {
            return '<div class="h2">' + icon('projects') + loc('shared.projectsHeading', '專案 <small>近 30 天</small>') + '</div>'
                + '<div class="projrow head"><span>' + loc('shared.thProject', '專案') + '</span><span>' + loc('shared.thDailyCost', '每日花費') + '</span><span class="r">' + loc('shared.cost', '花費') + '</span><span class="r">session</span>'
                + '<span class="r">' + loc('shared.thLastActivity', '最後活動') + '</span></div>'
                + (rows.length ? rows.map(function (r) {
                    var c = colorOf('project', r.pkey, o.pkeys);
                    return '<a class="projrow" href="' + projectHash(r.pkey) + '"><span style="min-width:0"><span class="nm"><i class="sw" style="background:'
                        + c + '"></i>' + esc(o.names[r.pkey] || r.pkey) + '</span><span class="pth mono">' + esc(r.pkey) + '</span></span>'
                        + '<span>' + spark(r.daily, c) + '</span><span class="r">' + usd(r.usd, true) + estMark(r) + '</span><span class="r">' + r.n + '</span>'
                        + '<span class="r muted">' + ago(r.last) + '</span></a>';
                }).join('') : '<p class="note">' + loc('shared.machineNoSessions', '這台機器上沒有 session') + '</p>');
        }
        // 最近 sessions (`#/sessions`): the film's header lockup — the title, a
        // rule, the counts, `tabs` (the Sessions tab strip) and 看全部 on the
        // right — over one line a row. A stage on the row's route is the film's
        // glyph and `0N / 0M stage`; one the route does not name keeps its dots
        // and its name (`stageNow`).
        function recentHtml(list, o, tabs) {
            var live = list.filter(function (s) { return s.state === 'live'; }).length;
            return '<div class="phead khead" data-block="sessions-head"><h1>' + icon('sessions') + loc('shared.recentSessions', '最近 sessions') + '</h1>'
                + '<p class="kcap"><span>' + loc('shared.capSessions', '<b>{n}</b>個 session', { n: list.length }) + '</span>'
                + '<span>' + loc('shared.capLive', '<b>{n}</b>個 live', { n: live }) + '</span>'
                + '<span>' + loc('shared.capByLast', '依最後動作，最新在上') + '</span></p>'
                + '<span class="spacer"></span>' + (tabs || '') + '<a class="btn" href="#/list">' + loc('shared.seeAll', '看全部 →') + '</a></div>'
                + '<section class="panel ksess" data-block="sessions"><div class="tbl-wrap"><table class="t">'
                + '<colgroup><col><col style="width:150px"><col style="width:200px"><col style="width:84px"><col style="width:72px"><col style="width:168px"></colgroup>'
                + '<thead><tr><th>' + loc('shared.thTask', '任務') + '</th><th>' + loc('shared.thProject', '專案') + '</th><th>stage</th><th class="r">' + loc('shared.cost', '花費') + '</th>'
                + '<th class="r">token</th><th>' + loc('shared.thState', '狀態') + '</th></tr></thead><tbody>'
                + list.map(function (s) {
                    var t = sessionTotals(s);
                    return '<tr class="link" data-href="' + sessionHash(s.id) + '"><td class="task"><a href="' + sessionHash(s.id) + '" title="' + esc(s.task || '') + '">'
                        + esc(s.task || loc('shared.unnamed', '（未命名）')) + '</a></td><td><span class="pchip"><i class="sw" style="background:'
                        + colorOf('project', s.pkey, o.pkeys) + '"></i>' + esc(o.names[s.pkey] || s.pkey) + '</span></td>'
                        + '<td class="c-stage">' + (keelStage(s) ? '<span class="kstage">' + keelProgress(s) + keelStage(s) + '</span>' : stageNow(s)) + '</td>'
                        + '<td class="r">' + usd(t.usd) + estMark(t) + '</td><td class="r muted">' + tokens(t.tokens) + '</td>'
                        + '<td class="c-state">' + statePill(s) + runningTag(s) + '</td></tr>';
                }).join('') + '</tbody></table></div></section>';
        }
        // 導覽: the tour's own page in a frame. It is served from the plugin's
        // assets (scripts/station.js STATIC); the written file has no server.
        function tourPage(serve) {
            if (serve) return '<div class="tour" data-block="tour"><iframe class="tour-frame" src="station/tour.html" title="' + loc('shared.tourTitle', 'fankeel 導覽') + '"></iframe></div>';
            return '<section class="panel" data-block="tour"><p class="note">' + loc('shared.tourNeedsServe', '導覽要從 serve 開的頁面看：輸入 <code class="mono">/fankeel-station</code>，從它印出的網址開 <span class="mono">#/tour</span>。') + '</p></section>';
        }

        function dayStart(day) {
            return new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))).getTime();
        }
        function projectHead(sessions, pkey, days) {
            var mine = sessions.filter(function (s) { return s.pkey === pkey; });
            var t = windowTotals(mine, days), row = projectRows(mine, days)[0];
            return { pkey: pkey, usd: t.usd, estimated: t.estimated, tokens: t.tokens, active: t.active, n: row ? row.n : 0 };
        }
        // A session's whole spend, at the moment it started.
        function sessionPoints(sessions, metric, t0, t1) {
            return sessions.map(function (s) {
                var t = sessionTotals(s);
                return { id: s.id, task: s.task, t: Date.parse(s.started), v: metric === 'usd' ? t.usd : t.tokens, estimated: metric === 'usd' && t.estimated };
            }).filter(function (p) { return p.t >= t0 && p.t < t1; }).sort(function (a, b) { return a.t - b.t; });
        }
        // The 對照專案 line is a second series on the same axes, not a second chart.
        function projectChart(series, o) {
            var W = 1200, H = 340, L = 60, R = 24, T = 16, AX = 40, plotH = H - T - AX, base = T + plotH;
            var X = function (t) { return (L + (t - o.t0) / ((o.t1 - o.t0) || 1) * (W - L - R)).toFixed(1); };
            var all = [0];
            series.forEach(function (s) { s.points.forEach(function (p) { all.push(p.v); }); });
            var top = niceTop(Math.max.apply(null, all));
            var Y = function (v) { return (base - v / top * plotH).toFixed(1); };
            var out = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + loc('proj.perSessionByStart', '每個 session 的{metric}，依開始時間', { metric: METRIC_LABEL[o.metric] }) + '">';
            [0, 0.25, 0.5, 0.75, 1].forEach(function (f) {
                out += '<line class="' + (f ? 'gridl' : 'base') + '" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(top * f) + '" y2="' + Y(top * f) + '"/>'
                    + '<text class="tick" x="' + (L - 10) + '" y="' + (Number(Y(top * f)) + 4) + '" text-anchor="end">' + metricText(o.metric, top * f, true) + '</text>';
            });
            o.days.forEach(function (d, i) {
                var x = X(dayStart(d) + 432e5);
                if (i % 2 === 0 || d === o.today) out += '<text class="tick" x="' + x + '" y="' + (base + 17) + '" text-anchor="middle">' + Number(d.slice(8)) + '</text>';
                if (d === o.today || d.slice(8) === '01' || i === 0) {
                    out += '<text x="' + x + '" y="' + (base + 33) + '" text-anchor="middle">' + (d === o.today ? loc('proj.today', '今天') : loc('proj.monthN', '{n}月', { n: Number(d.slice(5, 7)) })) + '</text>';
                }
            });
            series.forEach(function (s) {
                if (!s.points.length) return;
                out += '<polyline points="' + s.points.map(function (p) { return X(p.t) + ',' + Y(p.v); }).join(' ')
                    + '" style="fill:none;stroke:' + s.colour + ';stroke-width:2;stroke-linejoin:round"/>';
                s.points.forEach(function (p) {
                    out += '<circle class="hit" data-href="' + sessionHash(p.id) + '" cx="' + X(p.t) + '" cy="' + Y(p.v) + '" r="5" style="fill:'
                        + s.colour + ';stroke:var(--panel);stroke-width:2"><title>' + esc(s.name + ' · ' + (p.task || p.id) + ' · ' + stamp(p.t)
                        + ' · ' + metricText(o.metric, p.v, false, p.estimated)) + '</title></circle>';
                });
            });
            return out + '</svg>';
        }
        function miniMix(models, est) {
            var keys = MODEL_KEYS.filter(function (k) { return models[k] > 0; });
            var tot = keys.reduce(function (n, k) { return n + models[k]; }, 0);
            if (!tot) return '<span class="muted">—</span>';
            return '<span class="mini-mix" title="' + keys.map(function (k) { return k + ' ' + usd(models[k]) + estMark({ estimated: est && est[k] }); }).join(loc('proj.listSep', '、')) + '">'
                + keys.map(function (k) {
                    return '<i style="width:' + (models[k] / tot * 100).toFixed(2) + '%;background:var(--m-' + k + ')"></i>';
                }).join('') + '</span>';
        }
        function projectSessionsHtml(list, picked) {
            if (!list.length) return '<p class="note">' + loc('proj.noSessions30d', '這個專案近 30 天沒有 session') + '</p>';
            return '<div class="tbl-wrap"><table class="t"><thead><tr><th aria-label="' + loc('proj.pickToCompare', '選來比較') + '"></th><th>' + loc('proj.thTask', '任務') + '</th><th>' + loc('proj.thStart', '開始') + '</th>'
                + '<th class="r">' + loc('proj.thDuration', '時長') + '</th><th>' + loc('proj.thStageProgress', 'stage 進度') + '</th><th class="r">' + loc('proj.thCost', '花費') + '</th><th class="r">token</th><th>' + loc('proj.thModelMix', 'model 組成') + '</th></tr></thead><tbody>'
                + list.map(function (s) {
                    var t = sessionTotals(s), started = Date.parse(s.started);
                    return '<tr class="link" data-href="' + sessionHash(s.id) + '"><td><input type="checkbox" data-cmp="' + esc(s.id)
                        + '" aria-label="' + loc('proj.pickToCompare', '選來比較') + '"' + (picked.indexOf(s.id) >= 0 ? ' checked' : '')
                        + (s.hasDetail ? '' : ' disabled title="' + loc('proj.noTranscriptToCompare', '沒有 transcript，沒有細節可比') + '"') + '></td>'
                        + '<td class="task"><a href="' + sessionHash(s.id) + '">' + esc(s.task || loc('proj.unnamed', '（未命名）')) + '</a></td>'
                        + '<td class="muted">' + stamp(started) + '</td><td class="r">' + mins((s.updated || started) - started) + '</td>'
                        + '<td>' + routeDots(s) + ' <span class="muted">' + esc(s.stage || '—') + '</span></td>'
                        + '<td class="r">' + usd(t.usd) + estMark(t) + '</td><td class="r muted">' + tokens(t.tokens) + '</td><td>' + miniMix(t.models, t.estModels) + '</td></tr>';
                }).join('') + '</tbody></table></div>';
        }
        return {
            dayBars: dayBars, projectRows: projectRows, roHtml: roHtml, kpiHtml: kpiHtml, spark: spark, routeDots: routeDots,
            stageNow: stageNow, runningTag: runningTag, segHtml: segHtml, histSvg: histSvg, paletteOf: paletteOf,
            legendOwn: legendOwn, legendRest: legendRest, shortLabel: shortLabel, legendHtml: legendHtml,
            filterHtml: filterHtml, visibleBars: visibleBars, segTip: segTip, projectsHtml: projectsHtml,
            recentHtml: recentHtml, tourPage: tourPage, dayStart: dayStart, projectHead: projectHead,
            sessionPoints: sessionPoints, projectChart: projectChart, miniMix: miniMix,
            projectSessionsHtml: projectSessionsHtml
        };
    }
    var api = { make: make };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_CHART = api;
}(typeof window !== 'undefined' ? window : null));
