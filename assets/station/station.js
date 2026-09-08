'use strict';

// The station page, rendered in the browser from `window.STATION`. Loaded by
// `station.html` after `station-data.js`, so the model is already there.
//
// Everything above the `module.exports` guard is a pure function and is unit
// tested; everything below it touches the document and is checked against the
// served page instead. The split is not a preference — this repository carries
// no dependencies, so there is no DOM in `node --test` to render into.

(function (w, doc) {
    var S = w.STATION || { sessions: [], projects: [] };
    var ROUTE = ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'];
    var STAGE_C = {
        survey: '#94a3b8', design: '#8b5cf6', plan: '#f472b6', build: '#4c3fd7',
        verify: '#14b8a6', audit: '#3b82f6', land: '#64748b',
    };
    var PAL = ['#4c3fd7', '#7c6cf0', '#3b82f6', '#14b8a6', '#7fe7d4', '#c7ccd9'];
    var WD = ['日', '一', '二', '三', '四', '五', '六'];

    function tokens(n) {
        if (n === null || n === undefined) return '—';
        if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M';
        if (n >= 1e3) return Math.round(n / 1e3) + 'k';
        return String(n);
    }
    function mins(ms) {
        if (ms === null || ms === undefined || !isFinite(ms)) return '—';
        var m = Math.round(ms / 60000);
        if (m < 60) return m + 'm';
        var h = Math.floor(m / 60);
        if (h < 24) return h + 'h' + (m % 60 ? (m % 60) + 'm' : '');
        return Math.floor(h / 24) + 'd' + (h % 24 ? (h % 24) + 'h' : '');
    }
    function hours(ms) { return (ms / 3.6e6).toFixed(ms >= 3.6e7 ? 0 : 1) + 'h'; }
    function usd(n) { return n ? '$' + (n >= 100 ? n.toFixed(0) : n.toFixed(2)) : '—'; }
    function ago(ms) {
        if (!ms) return '—';
        var d = Date.now() - ms;
        if (d < 60000) return 'just now';
        if (d < 3.6e6) return Math.round(d / 6e4) + 'm ago';
        if (d < 8.64e7) return Math.round(d / 3.6e6) + 'h ago';
        return Math.round(d / 8.64e7) + 'd ago';
    }
    function day(iso) { return typeof iso === 'string' ? iso.slice(0, 10) : '—'; }
    function stamp(ms) {
        return isFinite(ms) ? new Date(ms).toISOString().replace('T', ' ').slice(0, 16) : '—';
    }
    function esc(s) {
        return String(s === null || s === undefined ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function cost(s) { return (s.usd || 0) + (s.agentUsd || 0); }

    // The shortest tail of a root's segments that no other root shares. Moved
    // here from `lib/station.js`'s `navLabels` when the nav became a facet: the
    // rule is the same and the guard is still what bounds it, because two roots
    // where one nests inside the other cannot be separated by growing — the
    // inner one runs out of segments first. TODO.md files that case.
    function labels(roots) {
        var segs = roots.map(function (r) {
            return String(r).split(/[\\/]+/).filter(Boolean);
        });
        var depth = roots.map(function () { return 1; });
        var at = function (i) { return segs[i].slice(-depth[i]).join('/'); };
        for (var guard = 0; guard < 50; guard++) {
            var ls = roots.map(function (_, i) { return at(i); });
            var counts = {};
            ls.forEach(function (l) { counts[l] = (counts[l] || 0) + 1; });
            var grew = false;
            ls.forEach(function (l, i) {
                if (counts[l] > 1 && depth[i] < segs[i].length) { depth[i] += 1; grew = true; }
            });
            if (!grew) break;
        }
        var out = {};
        roots.forEach(function (r, i) { out[r] = at(i); });
        return out;
    }

    // Two windows of very different completeness sit beside each other here:
    // this repository's usage records begin on 2026-09-04 and its burn records
    // on 08-28, so a previous window holding nothing would otherwise print
    // +13000%. An empty comparison says it is empty. A ratio moves in
    // percentage points, and a rise in waiting is the bad direction.
    function delta(cur, prev, unit) {
        if (unit === 'pt') {
            var pp = (cur - prev) * 100;
            if (!prev && !cur) return '<span class="delta flat">無可比</span>';
            var c2 = Math.abs(pp) < 0.5 ? 'flat' : pp > 0 ? 'dn' : 'up';
            return '<span class="delta ' + c2 + '">' + (pp > 0 ? '+' : '') + pp.toFixed(1)
                + ' pt ' + (c2 === 'up' ? '↘' : c2 === 'dn' ? '↗' : '') + '</span>';
        }
        if (!prev) return '<span class="delta flat">前期無資料</span>';
        var d = (cur - prev) / prev * 100;
        var cls = Math.abs(d) < 0.5 ? 'flat' : d > 0 ? 'up' : 'dn';
        var n = Math.abs(d) >= 100 ? Math.round(d) : Number(d.toFixed(1));
        return '<span class="delta ' + cls + '">' + (d > 0 ? '+' : '') + n + '% '
            + (cls === 'up' ? '↗' : cls === 'dn' ? '↘' : '') + '</span>';
    }

    // One predicate for every view. A facet and the search box are AND-ed, so
    // the KPI cards, the charts and the table all narrow together — which is
    // the thing the old page could not do, because its rows were markup by the
    // time they reached the browser.
    function match(s, f) {
        if (f.state && s.state !== f.state) return false;
        if (f.project && s.root !== f.project) return false;
        if (f.stage && s.stage !== f.stage) return false;
        if (f.q) {
            // The model is in here because it was a filter term on the old page
            // and dropping it would be a silent loss: nothing tells a reader
            // that `opus` stopped matching.
            // Guarded, every one of them: an absent `model` joined raw puts the
            // string `undefined` in the haystack, and a search for it matches
            // every session that has no model.
            var t = [s.task, s.project, s.id, s.label, s.model || '', s.state,
                (s.claims || []).join(' '), (s.notes || []).join(' '), s.next || '']
                .join(' ').toLowerCase();
            if (t.indexOf(f.q.toLowerCase()) === -1) return false;
        }
        return true;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            tokens: tokens, mins: mins, hours: hours, usd: usd, ago: ago, day: day,
            stamp: stamp, esc: esc, cost: cost, labels: labels, delta: delta, match: match,
        };
    }
    if (!doc) return;
    var f = { q: '', state: '', project: '', stage: '' };
    var page = 'overview', sel = null, sortKey = 'updated', sortDir = -1;
    var NOW = Date.parse(S.generatedAt);
    var LAB = labels(S.projects.map(function (p) { return p.root; }));
    // `serialize()` never emits a `label` field — the shortest-unique-tail
    // rule lives only here, in `labels()`, since `navLabels` was deleted from
    // `lib/station.js` on purpose so the rule would not exist in two places.
    // `match()`'s haystack still reads `s.label`, so it is attached here,
    // once, before anything renders.
    S.sessions.forEach(function (s) { s.label = LAB[s.root]; });
    var sum = function (a, fn) {
        return a.reduce(function (n, x) { return n + (fn(x) || 0); }, 0);
    };
    var rows = function () {
        return S.sessions.filter(function (s) { return match(s, f); });
    };
    var windowed = function (list, from, to) {
        return list.filter(function (s) {
            var t = Date.parse(s.started) || 0;
            return t >= from && t < to;
        });
    };

    function navGroup(title, key, items) {
        return '<div class="grp"><h3>' + title + '</h3><div class="nav">'
            + items.map(function (it) {
                return '<a data-k="' + key + '" data-v="' + esc(it.v) + '" aria-pressed="'
                    + (f[key] === it.v) + '"><span class="ic">' + (it.icon || '') + '</span>'
                    + '<span class="lb" title="' + esc(it.title || it.label) + '">'
                    + esc(it.label) + '</span>'
                    + (it.n === undefined ? '' : '<span class="n">' + it.n + '</span>') + '</a>';
            }).join('') + '</div></div>';
    }
    function drawSide() {
        var n = { live: 0, stale: 0, down: 0 };
        S.sessions.forEach(function (s) { n[s.state]++; });
        var byStage = {};
        S.sessions.forEach(function (s) { byStage[s.stage] = (byStage[s.stage] || 0) + 1; });
        doc.getElementById('side').innerHTML =
            '<div class="grp"><h3>檢視</h3><div class="nav">'
            + '<a data-page="overview" aria-current="' + (page === 'overview') + '">'
            + '<span class="ic">▦</span><span class="lb">總覽</span></a>'
            + '<a data-page="list" aria-current="' + (page === 'list') + '">'
            + '<span class="ic">☰</span><span class="lb">清單</span>'
            + '<span class="n">' + S.sessions.length + '</span></a></div></div>'
            + navGroup('狀態', 'state', [
                { v: '', label: '全部', n: S.sessions.length, icon: '○' },
                { v: 'live', label: 'live', n: n.live, icon: '<i class="dot live"></i>' },
                { v: 'stale', label: 'stale', n: n.stale, icon: '<i class="dot stale"></i>' },
                { v: 'down', label: 'down', n: n.down, icon: '<i class="dot down"></i>' }])
            + navGroup('Registry', 'project',
                [{ v: '', label: '全部專案', n: S.sessions.length, icon: '⌂' }].concat(
                    S.projects.map(function (p) {
                        return {
                            v: p.root, label: LAB[p.root] + (p.gone ? ' — gone' : ''),
                            title: p.root, icon: '▸',
                            n: S.sessions.filter(function (s) { return s.root === p.root; }).length,
                        };
                    }).sort(function (a, b) { return b.n - a.n; })))
            + navGroup('停在哪一階段', 'stage',
                [{ v: '', label: '全部', n: S.sessions.length, icon: '◇' }].concat(
                    ROUTE.filter(function (k) { return byStage[k]; }).map(function (k) {
                        return {
                            v: k, label: k, n: byStage[k],
                            icon: '<i class="dot" style="background:' + STAGE_C[k] + '"></i>',
                        };
                    })));
    }
    function kpis(R) {
        var a = windowed(R, NOW - 7 * 864e5, NOW + 864e5);
        var b = windowed(R, NOW - 14 * 864e5, NOW - 7 * 864e5);
        var clock = sum(R, function (s) { return s.clock; });
        var wait = sum(R, function (s) { return s.waited; });
        var ca = sum(a, function (s) { return s.clock; });
        var wa = sum(a, function (s) { return s.waited; });
        var cb = sum(b, function (s) { return s.clock; });
        var wb = sum(b, function (s) { return s.waited; });
        var card = function (icon, label, v, unit, d, sub) {
            return '<div class="kpi"><div class="top"><span class="ci">' + icon + '</span>'
                + '<span class="lb">' + label + '</span>'
                + '<span class="i" title="近 7 天與前 7 天相比">ⓘ</span></div>'
                + '<div class="row"><span class="v">' + v
                + (unit ? '<span class="u">' + unit + '</span>' : '') + '</span>' + d + '</div>'
                + '<div class="sub">' + sub + '</div></div>';
        };
        return '<div class="kpis">'
            + card('◷', 'session', R.length, '', delta(a.length, b.length),
                '近 7 天 ' + a.length + ' 個，前 7 天 ' + b.length + ' 個')
            + card('▤', 'context', tokens(sum(R, function (s) { return s.burn; })), '',
                delta(sum(a, function (s) { return s.burn; }),
                    sum(b, function (s) { return s.burn; })),
                '近 7 天 ' + tokens(sum(a, function (s) { return s.burn; })))
            + card('$', '花費', usd(sum(R, cost)), '', delta(sum(a, cost), sum(b, cost)),
                R.filter(function (s) { return cost(s); }).length + ' / ' + R.length + ' 個有計價')
            + card('◔', '等你的時間', clock ? Math.round(wait / clock * 100) : 0, '%',
                delta(ca ? wa / ca : 0, cb ? wb / cb : 0, 'pt'),
                hours(wait) + ' 等 · ' + hours(clock) + ' 總時')
            + '</div>';
    }

    // Stacked pills, one column per day, with a ribbon joining each registry's
    // segment to its own segment in the next column. The ribbons are what make
    // it a flow rather than six unrelated stacks: a registry that grew from one
    // day to the next widens between them.
    function flow(R) {
        var byDay = {};
        R.forEach(function (s) {
            var d = day(s.started);
            if (d === '—' || !s.burn) return;
            if (!byDay[d]) byDay[d] = {};
            byDay[d][s.root] = (byDay[d][s.root] || 0) + s.burn;
        });
        var days = Object.keys(byDay).sort().slice(-6);
        if (!days.length) return '<div class="empty">這個篩選下沒有 context 紀錄</div>';
        var tot = {};
        days.forEach(function (d) {
            for (var k in byDay[d]) tot[k] = (tot[k] || 0) + byDay[d][k];
        });
        var top = Object.keys(tot).sort(function (x, y) { return tot[y] - tot[x]; }).slice(0, 5);
        var keys = top.concat(['__other']);
        var colour = {}, label = {};
        keys.forEach(function (k, i) { colour[k] = PAL[i]; });
        top.forEach(function (k) { label[k] = LAB[k] || k; });
        label.__other = '其他';
        var cols = days.map(function (d) {
            var v = {}, other = 0;
            for (var k in byDay[d]) {
                if (top.indexOf(k) >= 0) v[k] = byDay[d][k]; else other += byDay[d][k];
            }
            if (other) v.__other = other;
            return {
                day: d, v: v,
                total: Object.keys(v).reduce(function (n, k) { return n + v[k]; }, 0),
            };
        });
        var W = 760, H = 300, padX = 26, padTop = 48, padBot = 32;
        var plotH = H - padTop - padBot, base = H - padBot;
        var max = Math.max.apply(null, cols.map(function (c) { return c.total; })) || 1;
        var span = (W - 2 * padX) / cols.length, cw = Math.min(78, span * 0.56);
        cols.forEach(function (c, i) {
            c.cx = padX + span * (i + 0.5);
            c.seg = {};
            var y = base;
            keys.forEach(function (k) {
                if (!c.v[k]) return;
                var h = c.v[k] / max * plotH;
                c.seg[k] = { top: y - h, bot: y, h: h };
                y -= h;
            });
            c.topY = y;
        });
        var rib = '', bar = '', txt = '';
        for (var i = 0; i < cols.length - 1; i++) {
            (function (A, B) {
                keys.forEach(function (k) {
                    var a = A.seg[k], b = B.seg[k];
                    if (!a || !b) return;
                    var x1 = A.cx + cw / 2, x2 = B.cx - cw / 2;
                    rib += '<path d="M' + x1 + ',' + a.top + ' L' + x2 + ',' + b.top
                        + ' L' + x2 + ',' + b.bot + ' L' + x1 + ',' + a.bot + ' Z" fill="'
                        + colour[k] + '" opacity=".12"/>';
                });
            }(cols[i], cols[i + 1]));
        }
        cols.forEach(function (c) {
            keys.forEach(function (k) {
                var g = c.seg[k];
                if (!g) return;
                var h = Math.max(g.h - 5, 3);
                bar += '<rect x="' + (c.cx - cw / 2) + '" y="' + (g.top + (g.h - h) / 2)
                    + '" width="' + cw + '" height="' + h + '" rx="' + Math.min(7, h / 2)
                    + '" fill="' + colour[k] + '"><title>' + esc(label[k]) + ' ' + c.day + ' '
                    + tokens(c.v[k]) + '</title></rect>';
            });
            txt += '<text class="val" x="' + c.cx + '" y="' + (c.topY - 11)
                + '" text-anchor="middle">' + tokens(c.total) + '</text>'
                + '<text class="lbl" x="' + c.cx + '" y="' + (base + 19)
                + '" text-anchor="middle">' + c.day.slice(5) + '</text>';
        });
        return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img"'
            + ' aria-label="每天 context，依 registry"' + '>' + rib + bar + txt + '</svg>'
            + '<div class="legend">' + keys.filter(function (k) {
                return cols.some(function (c) { return c.v[k]; });
            }).map(function (k) {
                return '<span><i style="background:' + colour[k] + '"></i>'
                    + esc(label[k]) + '</span>';
            }).join('') + '</div>';
    }
    function weekBars(R) {
        var days = [];
        for (var i = 6; i >= 0; i--) {
            var t = NOW - i * 864e5, d = new Date(t).toISOString().slice(0, 10);
            days.push({
                d: d, wd: WD[new Date(t).getUTCDay()],
                n: R.filter(function (s) { return day(s.started) === d; }).length,
            });
        }
        var max = Math.max.apply(null, days.map(function (x) { return x.n; })) || 1;
        var W = 300, H = 270, padBot = 26, plotH = H - padBot - 30, bw = 26;
        var span = W / days.length, out = '';
        days.forEach(function (x, i) {
            var h = Math.max(x.n / max * plotH, 4), cx = span * (i + 0.5), y = H - padBot - h;
            var hot = x.n === max && x.n > 0;
            out += '<rect x="' + (cx - bw / 2) + '" y="' + y + '" width="' + bw + '" height="'
                + h + '" rx="' + Math.min(12, h / 2) + '" fill="'
                + (hot ? 'url(#g1)' : 'var(--line)') + '"><title>' + x.d + ' · ' + x.n
                + ' 個</title></rect>'
                + (hot ? '<text class="val" x="' + cx + '" y="' + (y - 8)
                    + '" text-anchor="middle">' + x.n + '</text>' : '')
                + '<text class="lbl" x="' + cx + '" y="' + (H - 8) + '" text-anchor="middle">'
                + x.wd + '</text>';
        });
        return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img"'
            + ' aria-label="近七天每天開了幾個"><defs>'
            + '<linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">'
            + '<stop offset="0" stop-color="#7c6cf0"/><stop offset="1" stop-color="#4c3fd7"/>'
            + '</linearGradient></defs>' + out + '</svg>';
    }

    function gauge(pct) {
        var W = 240, H = 140, cx = 120, cy = 118, r = 88, t = 18;
        var pt = function (a, rad) {
            var x = Math.PI * (180 - a) / 180;
            return [cx + Math.cos(x) * rad, cy - Math.sin(x) * rad];
        };
        var arc = function (a0, a1, rad, col, wid) {
            var p0 = pt(a0, rad), p1 = pt(a1, rad);
            return '<path d="M' + p0[0].toFixed(1) + ',' + p0[1].toFixed(1) + ' A' + rad + ','
                + rad + ' 0 ' + (a1 - a0 > 180 ? 1 : 0) + ' 1 ' + p1[0].toFixed(1) + ','
                + p1[1].toFixed(1) + '" fill="none" stroke="' + col + '" stroke-width="' + wid
                + '" stroke-linecap="round"/>';
        };
        var ticks = '';
        for (var a = 8; a <= 172; a += 8) {
            var p0 = pt(a, r + 13), p1 = pt(a, r + 19);
            ticks += '<line x1="' + p0[0].toFixed(1) + '" y1="' + p0[1].toFixed(1) + '" x2="'
                + p1[0].toFixed(1) + '" y2="' + p1[1].toFixed(1)
                + '" stroke="var(--line-2)" stroke-width="1.5"/>';
        }
        return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="等待佔比 '
            + pct + '%"><defs><linearGradient id="g2" x1="0" y1="0" x2="1" y2="0">'
            + '<stop offset="0" stop-color="#14b8a6"/><stop offset="1" stop-color="#4c3fd7"/>'
            + '</linearGradient></defs>' + ticks
            + arc(0, 180, r, 'var(--line)', t)
            + arc(0, Math.max(pct / 100 * 180, 2), r, 'url(#g2)', t)
            + '<text x="' + cx + '" y="' + (cy - 16) + '" text-anchor="middle"'
            + ' style="font:600 32px var(--sans);fill:var(--fg);letter-spacing:-.03em">'
            + pct + '%</text>'
            + '<text x="' + cx + '" y="' + (cy + 4) + '" text-anchor="middle" class="lbl">'
            + '在等你回話</text></svg>';
    }

    function stageLedger(R) {
        var st = {};
        R.forEach(function (s) {
            s.stages.forEach(function (w) {
                if (!st[w.stage]) st[w.stage] = { n: 0, ms: 0, wait: 0, burn: 0, usd: 0 };
                var x = st[w.stage];
                x.n++;
                x.ms += Math.max(w.to - w.from, 0);
                x.wait += w.waited || 0;
                x.burn += w.burn || 0;
                x.usd += w.usd || 0;
            });
        });
        var max = Math.max.apply(null, ROUTE.map(function (k) {
            return st[k] ? st[k].ms + st[k].wait : 0;
        })) || 1;
        return '<table><colgroup><col style="width:86px"><col><col style="width:70px">'
            + '<col style="width:70px"><col style="width:56px"></colgroup>'
            + '<thead><tr><th>階段</th><th>做事 / 等你</th><th class="r">context</th>'
            + '<th class="r">花費</th><th class="r">等待</th></tr></thead><tbody>'
            + ROUTE.map(function (k) {
                var x = st[k];
                if (!x) return '';
                return '<tr><td><span class="chip" style="background:' + STAGE_C[k]
                    + '1f;border-color:transparent;color:' + STAGE_C[k] + ';font-weight:600">'
                    + k + '</span></td>'
                    + '<td><div class="mini"><span style="width:' + (x.ms / max * 100)
                    + '%;background:' + STAGE_C[k] + '"></span><span style="width:'
                    + (x.wait / max * 100) + '%;background:' + STAGE_C[k] + '38"></span></div>'
                    + '<div class="mute" style="font-size:10.5px;margin-top:4px">'
                    + hours(x.ms) + ' 做事 · ' + hours(x.wait) + ' 等你</div></td>'
                    + '<td class="r num mute">' + tokens(x.burn) + '</td>'
                    + '<td class="r num">' + usd(x.usd) + '</td>'
                    + '<td class="r num" style="color:'
                    + (x.wait > x.ms ? 'var(--dn)' : 'var(--mute)') + '">'
                    + Math.round(x.wait / (x.ms + x.wait || 1) * 100) + '%</td></tr>';
            }).join('') + '</tbody></table>';
    }
    function taskCell(s) {
        return '<div class="ell" title="' + esc(s.task) + '" style="font-weight:500">'
            + esc(s.task || '（未命名）') + '</div>'
            + '<div class="mute ell" style="font-size:11px;margin-top:2px">'
            + esc(LAB[s.root]) + ' · ' + ago(s.updated) + '</div>';
    }
    function stageCell(s) {
        var pct = s.steps ? Math.round(s.step / s.steps * 100) : 0;
        return '<div style="display:flex;align-items:center;gap:8px">'
            + '<div class="mini" style="flex:1"><span style="width:' + pct + '%;background:'
            + (STAGE_C[s.stage] || 'var(--ind)') + '"></span></div>'
            + '<span class="mono mute" style="font-size:11px">' + s.step + '/' + s.steps
            + '</span></div><div class="mute" style="font-size:11px;margin-top:3px">'
            + esc(s.stage || '—') + '</div>';
    }
    function statePill(s) {
        return '<span class="pill ' + s.state + '"><i class="dot ' + s.state
            + (s.state === 'live' ? ' pulse' : '') + '"></i>' + s.state + '</span>';
    }

    // A gone registry keeps its facet, so selecting it has to say why the pane
    // went empty. Without this the page answers a click with a blank screen and
    // the reader cannot tell a gone registry from a filter that matched nothing.
    function goneNote() {
        if (!f.project) return '';
        var hit = S.projects.filter(function (p) { return p.root === f.project; });
        if (!hit.length || !hit[0].gone) return '';
        return '<div class="card" style="margin-bottom:14px"><div class="cbody">'
            + '<p style="margin:0"><b>' + esc(hit[0].root) + '</b></p>'
            + '<p class="mute" style="margin:4px 0 0">gone — no sessions/ here any more. '
            + 'The registry keeps its place until it is forgotten by name: '
            + '<code>station.js --forget</code>.</p></div></div>';
    }

    function overview() {
        var R = rows();
        var recent = R.slice().sort(function (a, b) {
            return (b.updated || 0) - (a.updated || 0);
        }).slice(0, 7);
        var clock = sum(R, function (s) { return s.clock; });
        var wait = sum(R, function (s) { return s.waited; });
        var burn = sum(R, function (s) { return s.burn; });
        var a = windowed(R, NOW - 7 * 864e5, NOW + 864e5);
        var b = windowed(R, NOW - 14 * 864e5, NOW - 7 * 864e5);
        return '<div class="phead"><h1>總覽</h1><span class="chip">'
            + (f.project ? esc(LAB[f.project]) : '全部 ' + S.projects.length + ' 個 registry')
            + '</span><span class="spacer"></span>'
            + '<span class="ctl" data-page="list">☰ 清單</span></div>'
            + (isFinite(S.cleared)
                ? '<p class="cleared">cleared ' + S.cleared + ' stale rows</p>' : '')
            + goneNote()
            + kpis(R)
            + '<div class="grid2">'
            + '<div class="card"><div class="chd"><span class="ci">◧</span>'
            + '<h2>context 流向</h2></div><div class="cbody">'
            + '<div class="headline"><span class="big">' + tokens(burn) + '</span>'
            + delta(sum(a, function (s) { return s.burn; }),
                sum(b, function (s) { return s.burn; }))
            + '<span class="hint">近 6 天，每一疊是一天，色塊是一個 registry</span></div>'
            + flow(R) + '</div></div>'
            + '<div class="card"><div class="chd"><span class="ci">▥</span>'
            + '<h2>近七天</h2></div><div class="cbody">'
            + '<div class="headline"><span class="big">' + a.length + '</span>'
            + delta(a.length, b.length) + '</div>'
            + '<div class="mute" style="font-size:11.5px;margin:-2px 0 8px">開始的 session</div>'
            + weekBars(R) + '</div></div></div>'
            + '<div class="grid3">'
            + '<div class="card"><div class="chd"><span class="ci">◕</span>'
            + '<h2>時間去哪了</h2></div><div class="cbody"><div class="gstats">'
            + '<div style="border-color:var(--ind)"><div class="k">做事</div>'
            + '<div class="v">' + hours(clock - wait) + '</div></div>'
            + '<div style="border-color:var(--teal)"><div class="k">等你</div>'
            + '<div class="v">' + hours(wait) + '</div></div>'
            + '<div><div class="k">總時</div><div class="v">' + hours(clock) + '</div></div>'
            + '</div>' + gauge(clock ? Math.round(wait / clock * 100) : 0) + '</div></div>'
            + '<div class="card"><div class="chd"><span class="ci">◫</span><h2>七個階段</h2>'
            + '<span class="spacer"></span><a class="seeall" data-page="list">全部 '
            + R.length + ' 個 →</a></div>'
            + '<div class="cbody" style="padding-top:8px">' + stageLedger(R) + '</div></div>'
            + '</div>'
            + '<div class="card" style="margin-top:14px"><div class="chd"><span class="ci">☰</span>'
            + '<h2>最近動過的</h2><span class="spacer"></span>'
            + '<a class="seeall" data-page="list">看全部 →</a></div>'
            + '<div class="cbody" style="padding-top:8px"><table>'
            + '<colgroup><col><col style="width:150px"><col style="width:78px">'
            + '<col style="width:78px"><col style="width:86px"></colgroup>'
            + '<thead><tr><th>任務</th><th>階段</th><th class="r">context</th>'
            + '<th class="r">花費</th><th>狀態</th></tr></thead><tbody>'
            + recent.map(function (s) {
                return '<tr data-id="' + esc(s.id) + '"><td>' + taskCell(s) + '</td><td>'
                    + stageCell(s) + '</td><td class="r num mute">' + tokens(s.burn) + '</td>'
                    + '<td class="r num">' + usd(cost(s)) + '</td><td>' + statePill(s)
                    + '</td></tr>';
            }).join('') + '</tbody></table></div></div>';
    }
    // `started` has a column of its own because the page this replaces sorted
    // by it, and a sort key with no header is a sort nobody can reach.
    var COLS = [['task', '任務'], ['stage', '階段'], ['burn', 'context'],
        ['cost', '花費'], ['state', '狀態'], ['started', '開始'], ['updated', '最後動作']];
    function val(s, k) {
        if (k === 'cost') return cost(s);
        if (k === 'state') return { live: 0, stale: 1, down: 2 }[s.state];
        if (k === 'started') return Date.parse(s.started) || 0;
        return s[k];
    }
    function listPage() {
        // A gone registry has no rows to lay out, and the grid below is sized
        // against the page head alone — so the note replaces the table rather
        // than sitting above it and pushing the list off the bottom.
        var gone = goneNote();
        if (gone) {
            return '<div class="phead"><h1>清單</h1><span class="chip" id="cnt"></span>'
                + '<span class="spacer"></span>'
                + '<span class="ctl" data-page="overview">▦ 總覽</span></div>' + gone;
        }
        return '<div class="phead"><h1>清單</h1><span class="chip" id="cnt"></span>'
            + '<span class="spacer"></span>'
            + '<span class="ctl" data-page="overview">▦ 總覽</span></div>'
            + '<div class="listwrap" style="height:calc(100% - 54px)">'
            + '<div class="card listcard"><div class="scroll"><table>'
            + '<colgroup><col><col style="width:130px"><col style="width:80px">'
            + '<col style="width:78px"><col style="width:86px"><col style="width:86px">'
            + '<col style="width:92px"></colgroup>'
            + '<thead id="lh"></thead><tbody id="lb"></tbody></table></div></div>'
            + '<div class="card det" id="det"></div></div>';
    }
    function drawList() {
        // The gone-registry branch of listPage() renders no table.
        if (!doc.getElementById('lb')) return;
        var R = rows().sort(function (a, b) {
            var x = val(a, sortKey), y = val(b, sortKey);
            if (typeof x === 'string' || typeof y === 'string') {
                return sortDir * String(x).localeCompare(String(y));
            }
            return sortDir * ((x || 0) - (y || 0));
        });
        doc.getElementById('cnt').textContent = R.length + ' / ' + S.sessions.length;
        doc.getElementById('lh').innerHTML = '<tr>' + COLS.map(function (c) {
            return '<th data-k="' + c[0] + '"'
                + (['burn', 'cost'].indexOf(c[0]) >= 0 ? ' class="r"' : '')
                + (sortKey === c[0] ? ' data-dir="' + (sortDir > 0 ? 'asc' : 'desc') + '"' : '')
                + '>' + c[1] + '</th>';
        }).join('') + '</tr>';
        doc.getElementById('lb').innerHTML = R.map(function (s) {
            return '<tr data-id="' + esc(s.id) + '" aria-selected="' + (sel === s.id) + '">'
                + '<td>' + taskCell(s) + '</td><td>' + stageCell(s) + '</td>'
                + '<td class="r num mute">' + tokens(s.burn) + '</td>'
                + '<td class="r num">' + usd(cost(s)) + '</td>'
                + '<td>' + statePill(s) + '</td>'
                + '<td class="num mute" style="font-size:11.5px">' + day(s.started) + '</td>'
                + '<td class="num mute" style="font-size:11.5px">' + ago(s.updated) + '</td></tr>';
        }).join('') || '<tr><td colspan="7"><div class="empty">沒有符合的 session</div></td></tr>';
        if (R.length && !R.some(function (s) { return s.id === sel; })) sel = R[0].id;
        drawDetail();
    }

    // The clear control is the one place the served page and the written file
    // differ, and both forms come out of the data rather than out of two
    // renderers: `serve` is true only when a server produced this data file, and
    // `nonce` is the token that server will check. A file on disk has neither,
    // so it prints the command instead.
    function clearControl(s) {
        if (s.state !== 'stale') return '';
        if (S.serve) {
            return '<form class="clearform" method="post" action="/clear">'
                + '<input type="hidden" name="root" value="' + esc(s.root) + '">'
                + '<input type="hidden" name="id" value="' + esc(s.id) + '">'
                + '<input type="hidden" name="nonce" value="' + esc(S.nonce || '') + '">'
                + '<label><input type="checkbox" name="force" value="1"> force</label>'
                + '<button class="ctl" type="submit">clear</button></form>';
        }
        return '<div class="claims" style="margin-top:14px">node '
            + esc(S.plugin || '<plugin>') + '/scripts/task.js clear ' + esc(s.id)
            + ' --root "' + esc(s.root) + '" --session &lt;your session id&gt;</div>';
    }
    function drawDetail() {
        var d = doc.getElementById('det');
        if (!d) return;
        var hit = S.sessions.filter(function (x) { return x.id === sel; });
        if (!hit.length) { d.innerHTML = '<div class="empty">選一列</div>'; return; }
        var s = hit[0];
        var tot = s.stages.reduce(function (n, w) {
            return n + Math.max(w.to - w.from, 0);
        }, 0) || 1;
        d.innerHTML = '<div class="cbody" style="padding-top:16px">'
            + '<div style="display:flex;gap:7px;align-items:center;margin-bottom:10px;'
            + 'flex-wrap:wrap">' + statePill(s)
            + '<span class="chip" title="' + esc(s.root) + '">' + esc(LAB[s.root])
            + '</span>'
            + (s.model ? '<span class="chip mono">'
                + esc(s.model.replace(/^claude-/, '')) + '</span>' : '') + '</div>'
            + '<h2 style="font-size:15px;line-height:1.45;margin-bottom:12px">'
            + esc(s.task || '（未命名）') + '</h2>'
            + (s.stages.length
                ? '<div class="strip">' + s.stages.map(function (w) {
                    var p = Math.max(w.to - w.from, 0) / tot * 100;
                    return '<div style="width:' + p + '%;background:'
                        + (STAGE_C[w.stage] || '#888') + '" title="' + esc(w.stage) + ' · '
                        + mins(w.to - w.from) + '">'
                        + (p > 11 ? esc(w.stage.slice(0, 5)) : '') + '</div>';
                }).join('') + '</div>'
                + '<table style="margin-top:10px"><colgroup><col><col style="width:56px">'
                + '<col style="width:58px"><col style="width:56px"></colgroup>'
                + '<thead><tr><th>階段</th><th class="r">時間</th><th class="r">ctx</th>'
                + '<th class="r">等你</th></tr></thead><tbody>'
                + s.stages.map(function (w) {
                    return '<tr><td><i class="dot" style="background:'
                        + (STAGE_C[w.stage] || '#888') + '"></i> ' + esc(w.stage) + '</td>'
                        + '<td class="r num">' + mins(w.to - w.from) + '</td>'
                        + '<td class="r num mute">' + tokens(w.burn) + '</td>'
                        + '<td class="r num mute">' + mins(w.waited) + '</td></tr>';
                }).join('') + '</tbody></table>'
                : '<p class="mute" style="font-size:12px">沒有分階段紀錄</p>')
            + (s.next ? '<div class="note"><b>下一步</b><br>' + esc(s.next) + '</div>' : '')
            + (s.notes.length
                ? '<div class="note" style="background:var(--soft);border-color:var(--line-2)">'
                + s.notes.map(esc).join('<br>') + '</div>' : '')
            + '<dl class="dl"><dt>session</dt><dd class="mono" style="font-size:10.5px">'
            + esc(s.id) + '</dd>'
            + '<dt>route</dt><dd class="mono" style="font-size:11px">'
            + esc(s.route.join(' → ')) + '</dd>'
            + '<dt>開始</dt><dd class="num">' + stamp(Date.parse(s.started)) + '</dd>'
            + '<dt>最後</dt><dd class="num">' + stamp(s.updated) + '</dd>'
            + (s.ended ? '<dt>結束</dt><dd>' + esc(s.ended.reason) + '</dd>' : '')
            + '<dt>總計</dt><dd class="num">' + tokens(s.burn) + ' · ' + usd(cost(s))
            + (s.agents ? ' · ' + s.agents + ' agents' : '') + '</dd>'
            + '<dt>guard</dt><dd>' + esc(s.guard || 'ask (預設)') + '</dd></dl>'
            + '<h3 style="font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;'
            + 'color:var(--mute);margin:14px 0 6px">碰過的檔案 ' + s.claims.length + '</h3>'
            + (s.claims.length
                ? '<div class="claims">' + s.claims.map(function (p) {
                    return '<div title="' + esc(p) + '">' + esc(p) + '</div>';
                }).join('') + '</div>'
                : '<p class="mute" style="font-size:12px">沒有</p>')
            + clearControl(s) + '</div>';
    }
    function draw() {
        var p = doc.getElementById('page');
        p.className = 'scrollmain' + (page === 'list' ? ' fixed' : '');
        p.innerHTML = page === 'list' ? listPage() : overview();
        if (page === 'list') drawList();
        drawSide();
    }
    doc.addEventListener('click', function (e) {
        var pg = e.target.closest('[data-page]');
        if (pg) { page = pg.getAttribute('data-page'); sel = null; draw(); return; }
        var a = e.target.closest('a[data-k]');
        if (a) { f[a.getAttribute('data-k')] = a.getAttribute('data-v'); draw(); return; }
        var th = e.target.closest('th[data-k]');
        if (th) {
            var k = th.getAttribute('data-k');
            if (k === sortKey) sortDir = -sortDir;
            else { sortKey = k; sortDir = k === 'task' ? 1 : -1; }
            drawList();
            return;
        }
        var tr = e.target.closest('tr[data-id]');
        if (tr && page === 'list') {
            sel = tr.getAttribute('data-id');
            [].forEach.call(doc.querySelectorAll('#lb tr'), function (x) {
                x.setAttribute('aria-selected', x.getAttribute('data-id') === sel);
            });
            drawDetail();
        }
    });
    doc.getElementById('q').addEventListener('input', function (e) {
        f.q = e.target.value;
        draw();
    });
    doc.addEventListener('keydown', function (e) {
        if (e.target.tagName === 'INPUT') { if (e.key === 'Escape') e.target.blur(); return; }
        if (e.key === '/') { e.preventDefault(); doc.getElementById('q').focus(); }
    });

    doc.getElementById('gen').textContent = '掃描於 ' + stamp(NOW)
        + ' · 價目表 ' + S.pricesVerified
        + (S.serve ? ' · 每次載入都重讀 registry' : '');
    doc.getElementById('nreg').textContent = S.projects.length + ' 個 registry · '
        + S.sessions.length + ' sessions';
    doc.getElementById('cfg').textContent = String(S.configDir || '').replace(/^.*[\\/]/, '')
        || S.configDir;
    doc.getElementById('cfg').title = S.configDir || '';
    draw();
}(typeof window === 'undefined' ? {} : window,
  typeof document === 'undefined' ? null : document));
