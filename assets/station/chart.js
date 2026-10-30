// 30 天圖與專案頁殘留 (FK_CHART): moved out of station.js (station-52).
// station.js calls make(K) once, on first use, handing it the helpers these
// bodies name; everything here only computes or builds strings.
(function (w) {
    'use strict';
    function make(K) {
        // One alias per name K carries, so the bodies below moved verbatim.
        var loc = K.loc, esc = K.esc, tokens = K.tokens, usd = K.usd, hours = K.hours, delta = K.delta;
        var localDay = K.localDay, dimKey = K.dimKey;
        var tokenSum = K.tokenSum, orderKeys = K.orderKeys, niceTop = K.niceTop, metricText = K.metricText;
        var colorOf = K.colorOf, keyLabel = K.keyLabel, keyHint = K.keyHint, partEst = K.partEst;
        var METRIC_LABEL = K.METRIC_LABEL, DIM_LABEL = K.DIM_LABEL, NO_TIME_TYPE = K.NO_TIME_TYPE;
        var KIND_KEYS = K.KIND_KEYS;
        // One bar per day; a bar's total is added in the same pass as its parts,
        // so it is their sum and nothing else.
        function dayBars(sessions, metric, dim, days, notes) {
            // A dim the caller says time cannot split by, in the caller's own words —
            // 依 task (spend-quota design §2a): a span records no task.
            if (metric === 'time' && notes && notes[dim]) return { days: [], keys: [], max: 0, disabled: notes[dim] };
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
        function roHtml(l, v, d, block) {
            return '<div class="ro"' + (block ? ' data-block="' + block + '"' : '') + '><div class="l">' + l + '</div><div class="v">' + v + '</div><div class="d">' + d + '</div></div>';
        }
        // No spend readout: 花費's 總覽 shows that figure by account (spend-quota
        // design §2a). `lead` is readouts that open the row: 明細's 全機花費 sits in it
        // rather than in a row of its own.
        function kpiHtml(cur, prev, lead) {
            var share = function (t) { return t.main + t.wait ? t.wait / (t.main + t.wait) : 0; };
            var out = '<div class="readouts" data-block="kpi">' + (lead || '')
                + roHtml('token', tokens(cur.tokens), delta(cur.tokens, prev.tokens))
                + roHtml(loc('shared.activeTime', 'active 時間'), hours(cur.active), delta(cur.active, prev.active))
                + roHtml('<i class="hatchsw"></i>' + loc('shared.waitShare', '等待佔比'), Math.round(share(cur) * 1000) / 10 + '<span class="u">%</span>',
                    (prev.main + prev.wait ? delta(share(cur), share(prev), 'pt') : '<span class="delta flat">' + loc('shared.noPriorData', '前期無資料') + '</span>')
                    + ' · ' + loc('shared.waitedFor', '{t} 等', { t: hours(cur.wait) }));
            var top = K.S().gates && K.S().gates.swapped && K.S().gates.swapped.length ? K.S().gates.swapped[0] : null;
            out += roHtml(loc('shared.mostSwapped', '最常被換掉'), top ? esc(top.label) : '—', top ? top.lost + ' / ' + top.total : '', 'most-swapped');
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
                + loc('shared.dailyOverDays', '近 {n} 天每日{metric}，{dim}', { n: n, metric: METRIC_LABEL[o.metric], dim: o.dimLabel || DIM_LABEL[o.dim] }) + '">';
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
            return ((o.dim === 'version' || o.dim === 'model' || o.dim === 'type' || o.dim === 'task' || o.dim === 'account') ? bars.keys : o.pkeys || []).filter(function (k) { return !off[k]; });
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
        // Rough text width for the quota bars' labels: a CJK character one em, anything
        // else 0.56 em — the mockup's measure, close enough to cut a name before it runs on.
        function textW(t, size) {
            return String(t || '').split('').reduce(function (a, ch) { return a + (/[\u2e80-\uffff]/.test(ch) ? size : size * 0.56); }, 0);
        }
        // `name` cut to `width` with an ellipsis, or '' when not even two characters fit.
        function fitText(name, width, size) {
            var s = String(name || '');
            if (textW(s, size) <= width) return s;
            var cs = s.split('');
            while (cs.length && textW(cs.join('') + '\u2026', size) > width) cs.pop();
            return cs.length >= 2 ? cs.join('') + '\u2026' : '';
        }
        // 總覽's daily spend by account (spend-quota design §2): `bars` from dayBars(…,
        // 'usd', 'account', days). Every column has a <title> with its total and each
        // account; a column part of another account than `o.only` is drawn at .16. Not
        // under `.chart`: the 明細 chart's hover reads the first `.chart svg` on the page.
        // `o.narrow` is the phone's 360-wide drawing. All text arrives in `o.L` and `o.names`.
        function ovBarsSvg(bars, o) {
            var nar = Boolean(o.narrow), W = nar ? 360 : 760, L = nar ? 42 : 50, R = nar ? 356 : 756, B = nar ? 150 : 286, top = nar ? 10 : 12, FS = 13;
            var f1 = function (v) { return (Math.round(v * 10) / 10).toString(); };
            var list = bars.days || [], n = list.length || 1, slot = (R - L) / n, bw = slot * (nar ? 0.66 : 0.62);
            var mx = niceTop(bars.max), KY = (B - top) / mx, pal = paletteOf(bars, o);
            var out = '<svg class="ovsvg ' + (nar ? 'qnar' : 'qwid') + '" viewBox="0 0 ' + W + ' ' + f1(B + FS * 2.6) + '" role="img" aria-label="' + esc(o.L.aria) + '">';
            (nar ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1]).forEach(function (f) {
                var y = f1(B - f * mx * KY);
                out += '<line class="' + (f ? 'gridl' : 'base') + '" x1="' + L + '" x2="' + R + '" y1="' + y + '" y2="' + y + '"/>'
                    + '<text class="tick" x="' + (L - 8) + '" y="' + f1(Number(y) + FS * 0.35) + '" text-anchor="end">' + metricText('usd', mx * f, true) + '</text>';
            });
            var every = Math.max(1, Math.ceil(n / (nar ? 4 : 15)));
            list.forEach(function (b, i) {
                var cx = L + slot * (i + 0.5), y = B;
                var label = loc('shared.dayTotal', '{day} 合計 {total}', { day: b.day, total: metricText('usd', b.total, false, b.estimated) })
                    + bars.keys.filter(function (k) { return b.parts[k]; })
                        .map(function (k) { return loc('shared.dayTotalSeg', '；{key} {v}', { key: keyLabel('account', k, o.names), v: metricText('usd', b.parts[k], false, partEst(b, k)) }); }).join('');
                out += '<rect class="hit" x="' + f1(cx - slot / 2) + '" y="' + top + '" width="' + f1(slot) + '" height="' + (B - top) + '"><title>' + esc(label) + '</title></rect><g class="bar">';
                bars.keys.forEach(function (k) {
                    var v = b.parts[k];
                    if (!v) return;
                    var h = v * KY;
                    y -= h;
                    out += '<rect x="' + f1(cx - bw / 2) + '" y="' + f1(y) + '" width="' + f1(bw) + '" height="' + f1(Math.max(0.5, h - (nar ? 0.6 : 1)))
                        + '" style="fill:' + colorOf('account', k, pal) + (o.only && o.only !== k ? ';opacity:.16' : '') + '"/>';
                });
                out += '</g>';
                if (i === n - 1) {
                    out += '<text class="tick ovtoday" x="' + f1(nar ? cx + slot / 2 : cx) + '" y="' + f1(B + FS * 1.3) + '" text-anchor="' + (nar ? 'end' : 'middle') + '">'
                        + esc(b.day === o.today ? o.L.today : b.day.slice(5)) + '</text>';
                } else {
                    if (i % every === 0) out += '<text class="tick" x="' + f1(cx) + '" y="' + f1(B + FS * 1.3) + '" text-anchor="middle">' + Number(b.day.slice(8)) + '</text>';
                    if (i === 0 || b.day.slice(8) === '01') {
                        out += '<text class="tick" x="' + f1(cx) + '" y="' + f1(B + FS * 2.5) + '" text-anchor="middle">'
                            + loc('shared.monthN', '{n}月', { n: Number(b.day.slice(5, 7)) }) + '</text>';
                    }
                }
            });
            return out + '</svg>';
        }
        // The quota tabs' chart (spend-quota design §3, §4): the step line over 0–100%
        // above, the task lanes below on the same time axis (ms). Only the selected bar
        // gets the overlay — its band, the line re-drawn bright inside it, its two end
        // points, its outline and the callout — since a click redraws the page. A gate is
        // hatched over the stage colours. Text arrives in q.L, q.ticks, q.resets, q.call
        // and each seg's name and title: chart.js holds no Chinese of its own.
        function quotaSvg(q, o) {
            var f1 = function (v) { return (Math.round(v * 10) / 10).toString(); };
            var FS = o.fs, nar = Boolean(o.narrow), k = (o.R - o.L) / Math.max(1, q.t1 - q.t0);
            var X = function (t) { return o.L + (Math.max(q.t0, Math.min(q.t1, t)) - q.t0) * k; };
            var Y = function (v) { return o.bot - Math.max(0, Math.min(100, v)) / 100 * (o.bot - o.top); };
            var lanesBot = o.laneTop + Math.max(1, q.lanes) * o.pitch, Hh = lanesBot + FS * (nar ? 2.4 : 1.2);
            var sel = q.segs.filter(function (s) { return s.id === q.sel; })[0] || null;
            var out = ['<svg class="qsvg ' + (nar ? 'qnar' : 'qwid') + '" data-cur="' + esc(sel ? sel.id : 'none') + '" viewBox="0 0 ' + o.W + ' ' + f1(Hh)
                + '" role="img" aria-label="' + esc(q.L.aria) + '">'];
            out.push('<defs><pattern id="hatch-' + o.id + '" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
                + '<rect width="5" height="5" style="fill:var(--hatch-bg)"/><line x1="0" y1="0" x2="0" y2="5" style="stroke:var(--hatch);stroke-width:1.6"/></pattern>'
                + (sel ? '<clipPath id="band-' + o.id + '"><rect x="' + f1(X(sel.start)) + '" y="0" width="' + f1(X(sel.end) - X(sel.start)) + '" height="' + f1(Hh) + '"/></clipPath>' : '')
                + '</defs>');
            if (sel) out.push('<rect class="qband" x="' + f1(X(sel.start)) + '" y="' + o.top + '" width="' + f1(X(sel.end) - X(sel.start)) + '" height="' + f1(lanesBot - o.top) + '"/>');
            [0, 25, 50, 75, 100].forEach(function (v) {
                out.push('<line class="' + (v ? 'gridl' : 'base') + '" x1="' + o.L + '" x2="' + o.R + '" y1="' + f1(Y(v)) + '" y2="' + f1(Y(v)) + '"/>');
                if (!nar || v % 50 === 0) out.push('<text class="tick" x="' + (o.L - 7) + '" y="' + f1(Y(v) + FS * 0.35) + '" text-anchor="end">' + v + '%</text>');
            });
            q.ticks.forEach(function (t) {
                var x = X(t.t);
                out.push('<line class="qday" x1="' + f1(x) + '" x2="' + f1(x) + '" y1="' + o.top + '" y2="' + f1(lanesBot) + '"/>'
                    + '<text class="tick' + (t.today ? ' qtoday' : '') + '" x="' + f1(x + 4) + '" y="' + f1(o.bot + FS * 1.35) + '" text-anchor="start">' + esc(t.text) + '</text>');
            });
            q.resets.forEach(function (r) {
                var x = X(r.t), end = r.t >= q.t1;
                out.push('<line class="q7r" x1="' + f1(x) + '" x2="' + f1(x) + '" y1="' + o.top + '" y2="' + o.bot + '"><title>' + esc(r.text) + '</title></line>'
                    + '<text class="q7rt" x="' + f1(end ? x - 4 : x + 4) + '" y="' + f1(o.top + FS) + '" text-anchor="' + (end ? 'end' : 'start') + '">' + esc(r.text) + '</text>');
            });
            if (q.now >= q.t0 && q.now <= q.t1) out.push('<line class="qnow" x1="' + f1(X(q.now)) + '" x2="' + f1(X(q.now)) + '" y1="' + o.top + '" y2="' + f1(lanesBot) + '"/>');
            var solid = '', faded = '';
            q.steps.forEach(function (s, i) {
                if (s.to < q.t0 || s.from > q.t1) return;
                var h = 'M' + f1(X(s.from)) + ' ' + f1(Y(s.v)) + 'H' + f1(X(s.to));
                if (s.gap) faded += h; else solid += h;
                var nx = q.steps[i + 1];
                if (nx && nx.v !== s.v && nx.from >= q.t0 && nx.from <= q.t1) solid += 'M' + f1(X(nx.from)) + ' ' + f1(Y(s.v)) + 'V' + f1(Y(nx.v));
            });
            out.push('<g class="qline qbase" id="line-' + o.id + '"><path class="qfade" d="' + faded + '"/><path class="qsolid" d="' + solid + '"/></g>');
            var last = q.steps.filter(function (s) { return s.from <= q.t1; }).pop();
            if (last) out.push('<text class="qend" x="' + f1(X(last.to) + 6) + '" y="' + f1(Y(last.v) + FS * 0.35) + '" text-anchor="start">' + last.v + '%</text>');
            var barY = function (s) { return o.laneTop + s.lane * o.pitch + o.pitch - o.barH - 4; };
            q.segs.forEach(function (s) {
                var y0 = o.laneTop + s.lane * o.pitch, by = barY(s), x0 = X(s.start), x1 = X(s.end), on = s === sel;
                var fill = function (g, paint) {
                    return '<rect x="' + f1(X(g.start)) + '" y="' + f1(by) + '" width="' + f1(Math.max(0.6, X(g.end) - X(g.start))) + '" height="' + o.barH + '" style="fill:' + paint + '"/>';
                };
                out.push('<g class="qbar' + (on ? ' sel' : '') + '" data-task="' + esc(s.id) + '" role="button" tabindex="0" aria-pressed="' + on + '"><title>' + esc(s.title) + '</title>'
                    + '<rect class="qhit" x="' + f1(x0) + '" y="' + f1(y0) + '" width="' + f1(Math.max(6, x1 - x0)) + '" height="' + o.pitch + '"/>'
                    + '<clipPath id="bar-' + o.id + '-' + s.n + '"><rect x="' + f1(x0) + '" y="' + f1(by) + '" width="' + f1(Math.max(2, x1 - x0)) + '" height="' + o.barH + '" rx="3"/></clipPath>'
                    + '<g clip-path="url(#bar-' + o.id + '-' + s.n + ')">'
                    + s.stages.map(function (g) { return fill(g, 'var(--st-' + esc(g.stage) + ')'); }).join('')
                    + s.gates.map(function (g) { return fill(g, 'url(#hatch-' + o.id + ')'); }).join('') + '</g>');
                var lbl = nar ? '' : fitText(s.name, x1 - x0, FS * 0.93);
                if (lbl) out.push('<text class="qbl" x="' + f1(x0) + '" y="' + f1(by - 4) + '" text-anchor="start">' + esc(lbl) + '</text>');
                out.push('</g>');
            });
            if (sel) {
                var by = barY(sel), x0 = X(sel.start), x1 = X(sel.end);
                out.push('<g class="qov on" data-task="' + esc(sel.id) + '"><use href="#line-' + o.id + '" class="qhi" clip-path="url(#band-' + o.id + ')"/>');
                if (q.call) out.push('<circle class="qpt" cx="' + f1(X(q.call.a0)) + '" cy="' + f1(Y(q.call.v0)) + '" r="3.5"/><circle class="qpt" cx="' + f1(X(q.call.a1)) + '" cy="' + f1(Y(q.call.v1)) + '" r="3.5"/>');
                out.push('<rect class="qselo" x="' + f1(x0 - 1.5) + '" y="' + f1(by - 1.5) + '" width="' + f1(x1 - x0 + 3) + '" height="' + (o.barH + 3) + '" rx="4"/>');
                var name = fitText(sel.name, Math.max(x1 - x0 + 160, 200), FS * 0.93);
                out.push('<text class="qbl qbls" x="' + f1(Math.min(x0, o.R - textW(name, FS * 0.93))) + '" y="' + f1(by - 4) + '" text-anchor="start">' + esc(name) + '</text>');
                if (q.call) {
                    var txt = q.call.text, one = txt.join(q.L.join);
                    var cw = nar ? Math.max(textW(txt[0], FS), textW(txt[1], FS)) + 16 : textW(one, FS) + 20, ch = nar ? FS * 2.9 : FS * 2;
                    var cx = x0 + 6;
                    if (cx + cw > o.R) cx = Math.max(o.L + 4, x1 - cw - 6);
                    var cy = o.top + FS * 1.6;
                    out.push('<g class="qcall"><rect x="' + f1(cx) + '" y="' + f1(cy) + '" width="' + f1(cw) + '" height="' + f1(ch) + '" rx="6"/>'
                        + (nar ? '<text x="' + f1(cx + 8) + '" y="' + f1(cy + FS * 1.25) + '">' + esc(txt[0]) + '</text><text x="' + f1(cx + 8) + '" y="' + f1(cy + FS * 2.45) + '">' + esc(txt[1]) + '</text>'
                            : '<text x="' + f1(cx + 10) + '" y="' + f1(cy + FS * 1.35) + '">' + esc(one) + '</text>') + '</g>');
                }
                out.push('</g>');
            }
            return out.join('') + '</svg>';
        }
        // 導覽: the tour's own page in a frame. It is served from the plugin's
        // assets (scripts/station.js STATIC); the written file has no server.
        function tourPage(serve) {
            if (serve) return '<div class="tour" data-block="tour"><iframe class="tour-frame" src="station/tour.html" title="' + loc('shared.tourTitle', 'fankeel 導覽') + '"></iframe></div>';
            return '<section class="panel" data-block="tour"><p class="note">' + loc('shared.tourNeedsServe', '導覽要從 serve 開的頁面看：輸入 <code class="mono">/fankeel-station</code>，從它印出的網址開 <span class="mono">#/tour</span>。') + '</p></section>';
        }

        return {
            dayBars: dayBars, projectRows: projectRows, roHtml: roHtml, kpiHtml: kpiHtml, spark: spark, routeDots: routeDots,
            stageNow: stageNow, runningTag: runningTag, segHtml: segHtml, histSvg: histSvg, paletteOf: paletteOf,
            legendOwn: legendOwn, legendRest: legendRest, shortLabel: shortLabel, legendHtml: legendHtml,
            filterHtml: filterHtml, visibleBars: visibleBars, segTip: segTip, ovBarsSvg: ovBarsSvg, quotaSvg: quotaSvg, tourPage: tourPage
        };
    }
    var api = { make: make };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_CHART = api;
}(typeof window !== 'undefined' ? window : null));
