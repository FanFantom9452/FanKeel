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

    // `unknown` is `serialize()`'s way of saying liveness could not be
    // measured for this session — `data.active === true` but the config
    // directory it would have to read to confirm was unreadable, so `live` is
    // what it defaulted to rather than what was confirmed. The question mark
    // and the title are the only place that distinction reaches a reader:
    // `skills/fankeel/SKILL.md` tells every session to trust this page about
    // liveness, so a state that cannot be measured must not read as certain.
    function statePill(s) {
        return '<span class="pill ' + s.state + '"'
            + (s.unknown ? ' title="這個 session 的 config directory 讀不到，'
                + '活著與否無法確認"' : '') + '><i class="dot ' + s.state
            + (s.state === 'live' ? ' pulse' : '') + '"></i>' + s.state
            + (s.unknown ? '?' : '') + '</span>';
    }

    // The shortest tail of a root's segments that no other root shares. Moved
    // here from `lib/station.js`'s `navLabels` when the nav became a facet: the
    // rule is the same and `depth[i] < segs[i].length` still bounds it. Two
    // roots that split into the same segments — `/a/b` against `\a\b`, or
    // against `/a/b/` — are the only pair that reaches that bound still
    // colliding, and they share a label. TODO.md files that case. A nested
    // root is not it: it separates once the longer one grows past the shorter
    // one's own length.
    function labels(roots) {
        // Two roots are the same registry when, after dropping a trailing
        // separator and folding case, their strings are equal — that is
        // Windows, where `F:\a` and `f:\a\` are one directory. Fold before
        // the tails are computed, so the pair collapses to one group and one
        // card rather than reaching the shortest-unique-tail loop as if they
        // were two registries that happen to share a label. A nested root —
        // `F:\a` against `F:\a\b` — keeps a different key and stays two.
        function key(r) { return String(r).replace(/[\\/]+$/, '').toLowerCase(); }
        var uniq = [];
        var seen = {};
        roots.forEach(function (r) {
            var k = key(r);
            if (!seen[k]) { seen[k] = true; uniq.push(r); }
        });
        var segs = uniq.map(function (r) {
            return String(r).split(/[\\/]+/).filter(Boolean);
        });
        var depth = uniq.map(function () { return 1; });
        var at = function (i) { return segs[i].slice(-depth[i]).join('/'); };
        for (var guard = 0; guard < 50; guard++) {
            var ls = uniq.map(function (_, i) { return at(i); });
            var counts = {};
            ls.forEach(function (l) { counts[l] = (counts[l] || 0) + 1; });
            var grew = false;
            ls.forEach(function (l, i) {
                if (counts[l] > 1 && depth[i] < segs[i].length) { depth[i] += 1; grew = true; }
            });
            if (!grew) break;
        }
        var out = {};
        uniq.forEach(function (r, i) { out[r] = at(i); });
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
            statePill: statePill, clearStaleControl: clearStaleControl,
            profileRows: profileRows, applyMachineControl: applyMachineControl,
            profileCard: profileCard,
            openSections: openSections, niceStep: niceStep, downsample: downsample, lineChart: lineChart,
            comma: comma, riseText: riseText, ctxSection: ctxSection, seqHtml: seqHtml, orderSection: orderSection,
            dur: dur, tasksHtml: tasksHtml, dispatchHtml: dispatchHtml, replayHtml: replayHtml,
            todoEntry: todoEntry, riseTodo: riseTodo, backTodo: backTodo, todoSpot: todoSpot,
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

    // The new layout has no per-registry meta line, so a selected (and not
    // gone) registry gets a small card in `goneNote()`'s place instead: how
    // many of its session files did not parse — the hooks drop a corrupt
    // entry silently and correctly, so this is the only place that count
    // surfaces — its build directories with a file count each, and when its
    // map.md last changed.
    function registryNote() {
        if (!f.project) return '';
        var hit = S.projects.filter(function (p) { return p.root === f.project; });
        if (!hit.length || hit[0].gone) return '';
        var p = hit[0];
        var own = S.sessions.filter(function (s) { return s.root === p.root; });
        var projectProfiles = (S.profiles && S.profiles.projects) || {};
        return '<div class="card" style="margin-bottom:14px"><div class="cbody">'
            + '<div style="display:flex;align-items:center;gap:10px">'
            + '<p class="mute" style="margin:0;flex:1">' + p.unreadable
            + ' 個 session 檔案讀不到</p>' + clearStaleControl(p, own) + '</div>'
            + '<p class="mute" style="margin:4px 0 0">map.md '
            + (p.mapAt ? '更新於 ' + day(p.mapAt) : '不存在') + '</p>'
            + (p.build.length
                ? '<p class="mute" style="margin:4px 0 0">build：' + p.build.map(function (b) {
                    return esc(b.name) + ' (' + b.files + ')';
                }).join('、') + '</p>'
                : '<p class="mute" style="margin:4px 0 0">沒有 build 資料夾</p>')
            + '</div></div>'
            + Object.keys(projectProfiles).filter(function (pp) {
                return pp.indexOf(p.root) === 0;
            }).map(function (pp) {
                return profileCard(LAB[pp] || pp, 'project', pp, projectProfiles[pp]);
            }).join('');
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
            + registryNote()
            + profileCard('machine profile', 'machine', null, S.profiles && S.profiles.machine)
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

    // One row per key: the value in force, where it came from, and — served —
    // a select that posts the change. The static file prints the command
    // instead, the same way the clear control does.
    function profileRows(scope, projectPath, prof) {
        var keys = Object.keys(S.profileKeys || {});
        var out = '';
        keys.forEach(function (key) {
            var spec = S.profileKeys[key];
            var v = prof.values[key];
            var src = prof.sources[key] || '';
            var shown = v === undefined ? '(ask)' : String(v);
            var ctl;
            if (S.serve) {
                ctl = '<form method="post" action="/profile" class="pf">'
                    + '<input type="hidden" name="nonce" value="' + esc(S.nonce || '') + '">'
                    + '<input type="hidden" name="scope" value="' + scope + '">'
                    + (projectPath ? '<input type="hidden" name="project" value="' + esc(projectPath) + '">' : '')
                    + '<input type="hidden" name="key" value="' + esc(key) + '">'
                    + '<select name="value">' + spec.values.map(function (o) {
                        return '<option' + (String(v) === o ? ' selected' : '') + '>' + esc(o) + '</option>';
                    }).join('') + '</select><button class="ctl" type="submit">set</button></form>';
            } else {
                ctl = '<code class="mono">node ' + esc(S.plugin || '<plugin>') + '/scripts/task.js profile set '
                    + esc(key) + ' &lt;value&gt;' + (scope === 'machine' ? ' --default' : ' --project "' + esc(projectPath) + '"') + '</code>';
            }
            out += '<tr><td class="mono">' + esc(key) + '</td><td>' + esc(shown) + '</td><td class="mute">' + esc(src) + '</td><td>' + ctl + '</td></tr>';
        });
        return out;
    }
    function applyMachineControl(projectPath) {
        var m = S.profiles && S.profiles.machine ? S.profiles.machine : null;
        if (!S.serve || !m) return '';
        var keys = Object.keys(m.values).filter(function (k) { return m.sources[k] === 'machine'; });
        if (!keys.length) return '';
        return '<form method="post" action="/profile" class="pf">'
            + '<input type="hidden" name="nonce" value="' + esc(S.nonce || '') + '">'
            + '<input type="hidden" name="scope" value="project">'
            + '<input type="hidden" name="project" value="' + esc(projectPath) + '">'
            + keys.map(function (k) {
                return '<input type="hidden" name="key" value="' + esc(k) + '"><input type="hidden" name="value" value="' + esc(String(m.values[k])) + '">';
            }).join('')
            + '<button class="ctl" type="submit">套用機器預設（' + keys.length + ' 鍵）</button></form>';
    }
    function profileCard(title, scope, projectPath, prof) {
        if (!prof) return '';
        var bad = (prof.unreadable || []).length ? '<div class="mute">unreadable: ' + esc(prof.unreadable.join(', ')) + '</div>' : '';
        return '<div class="card profile"><div class="chead"><b>' + esc(title) + '</b>'
            + (scope === 'project' ? applyMachineControl(projectPath) : '') + '</div>'
            + bad + '<table><thead><tr><th>key</th><th>value</th><th>source</th><th></th></tr></thead><tbody>'
            + profileRows(scope, projectPath, prof) + '</tbody></table></div>';
    }
    // A registry-level bulk clear, beside its card's heading rather than a
    // row: counts how many of the rows handed to it are stale and, offline,
    // prints the same kind of copyable command each per-row control prints —
    // a static page cannot post either.
    function clearStaleControl(reg, rows) {
        var n = 0, i;
        for (i = 0; i < rows.length; i++) if (rows[i].state === 'stale') n++;
        if (!n) return '';
        if (!S.serve) {
            return '<code class="mono">node ' + esc(S.plugin || '<plugin>')
                + '/scripts/task.js clear &lt;id&gt;</code>';
        }
        return '<form method="post" action="/clear-stale">'
            + '<input type="hidden" name="nonce" value="' + esc(S.nonce || '') + '">'
            + '<input type="hidden" name="root" value="' + esc(reg.root) + '">'
            + '<button type="submit">clear ' + n + ' stale</button></form>';
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
        needDetail(s);
        var open = openSections(s);
        var x = DETAIL[s.id] || null;
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
            + secOpen('s-sum', '摘要', esc(s.stage || '—') + ' · ' + mins(tot)
                + (x ? ' · ' + x.requests + ' requests' : ''), open)
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
            + (s.unpriced && s.unpriced.length ? ' (' + s.unpriced.length + ' unpriced)' : '')
            + (s.agents ? ' · ' + s.agents + ' agents' : '') + '</dd>'
            + (x ? '<dt>requests</dt><dd class="num">' + x.requests + '</dd>' : '')
            + '<dt>guard</dt><dd>' + esc(s.guard || 'ask (預設)') + '</dd></dl>'
            + '</details>'
            + secOpen('s-claims', 'claims', s.claims.length + ' 個檔', open)
            + (s.claims.length
                ? '<div class="claims">' + s.claims.map(function (p) {
                    return '<div title="' + esc(p) + '">' + esc(p) + '</div>';
                }).join('') + '</div>'
                : '<p class="mute" style="font-size:12px">沒有</p>')
            + clearControl(s) + '</details>'
            + (x ? detailSections(s, x, open) : detailNote(s))
            + '</div>';
    }
    // The scan-time clauses were the old header's `depth stopped the scan in N
    // places` and `the scan ran out of time` — both are how a reader learns
    // the registry list may be incomplete. The unreadable-count clause is
    // separate: it is the total across every registry, and only shown when no
    // one registry is selected, because a selected registry already carries
    // its own count in `registryNote()`'s card — a corrupt-entry count must
    // not require a click to find, so it lives here the rest of the time.
    function genText() {
        var totalUnreadable = S.projects.reduce(function (n, p) {
            return n + (p.unreadable || 0);
        }, 0);
        return '掃描於 ' + stamp(NOW)
            + ' · 價目表 ' + S.pricesVerified
            + (S.scanStats && S.scanStats.depthCuts
                ? ' · depth 中止掃描 ' + S.scanStats.depthCuts + ' 處' : '')
            + (S.scanStats && S.scanStats.timedOut ? ' · 掃描逾時未跑完' : '')
            + (!f.project && totalUnreadable
                ? ' · ' + totalUnreadable + ' 個 session 檔案讀不到' : '')
            + (S.serve ? ' · 每次載入都重讀 registry' : '');
    }
    // ---- the detail panel ----------------------------------------------
    // One session's detail is a script of its own, `station/detail/<id>.js`,
    // loaded the first time the session is opened: `lib/station.js` keeps it
    // out of `station-data.js`, which every `/fankeel` prompt rewrites.
    var DETAIL = w.STATION_DETAIL || (w.STATION_DETAIL = {});
    var asked = {};
    function needDetail(s) {
        if (!s.hasDetail || DETAIL[s.id] || asked[s.id]) return;
        asked[s.id] = 'loading';
        var el = doc.createElement('script');
        el.src = 'station/detail/' + encodeURIComponent(s.id) + '.js';
        el.onload = function () { asked[s.id] = 'loaded'; if (sel === s.id) drawDetail(); };
        el.onerror = function () { asked[s.id] = 'failed'; if (sel === s.id) drawDetail(); };
        doc.head.appendChild(el);
    }
    function detailNote(s) {
        return '<p class="tally">' + (!s.hasDetail
            ? '這台機器的 config dir 裡沒有這個 session 的 transcript，所以沒有 context、階段順序、派工與過程還原'
            : asked[s.id] === 'failed' ? '細節檔讀不到：station/detail/' + esc(s.id) + '.js'
                : '讀取細節…') + '</p>';
    }
    function detailSections(s, x, open) {
        return sec('s-ctx', 'context', tokens(x.peak) + ' 峰值 · ' + x.requests + ' requests', ctxSection(s, x), open)
            + sec('s-order', '階段順序', x.seq.length + ' 步 · 倒退 ' + x.backtracks, orderSection(s, x), open)
            + sec('s-tasks', '任務', taskCount(x.tasks), tasksHtml(x.tasks), open)
            + sec('s-disp', '派工', x.rows.length + ' 個 agent · ' + cents(x.agentCents), dispatchHtml(x), open)
            + sec('s-rp', '過程還原', x.events.length + ' 列', replayHtml(x), open);
    }

    // Which sections start open. A live session is watched for who is in which
    // file; an ended one is reviewed for what it cost. The replay starts closed
    // whatever the state: it is the longest section and the last one read.
    function openSections(s) {
        return s && s.state === 'live' ? ['s-sum', 's-claims'] : ['s-ctx', 's-disp'];
    }
    function secOpen(id, title, count, open) {
        return '<details class="sec" id="' + id + '"' + (open.indexOf(id) >= 0 ? ' open' : '') + '><summary>'
            + '<span class="t">' + title + '</span> <span class="cnt">' + count + '</span></summary>';
    }
    function sec(id, title, count, body, open) {
        return secOpen(id, title, count, open) + body + '</details>';
    }
    function comma(n) {
        return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    function niceStep(v) {
        var steps = [1e3, 2e3, 5e3, 1e4, 25e3, 5e4, 1e5, 2e5, 25e4, 5e5, 1e6, 2e6, 5e6];
        for (var i = 0; i < steps.length; i++) if (v / steps[i] <= 5) return steps[i];
        return 1e7;
    }
    // At most `max` points, one per bucket, each bucket keeping its highest —
    // so the peak the tally names is a point the line still passes through.
    function downsample(points, max) {
        if (points.length <= max) return points.slice();
        var out = [];
        var size = points.length / max;
        for (var b = 0; b < max; b++) {
            var lo = Math.floor(b * size);
            var hi = Math.min(points.length, Math.floor((b + 1) * size));
            var best = points[lo];
            for (var i = lo + 1; i < hi; i++) if (points[i].y > best.y) best = points[i];
            out.push(best);
        }
        return out;
    }
    // One series: x is time, y the context each request carried. Stage moves
    // are vertical lines, dispatches out and back are dots on the line, the
    // five largest rises are numbered. `t0`, `t1` and `ymax` come from the
    // caller so two charts can share one scale.
    function lineChart(points, o) {
        var W = o.W || 340, H = o.H || 170, L = 40, R = 10, TOP = 14, B = 20;
        var t0 = o.t0, t1 = o.t1 > o.t0 ? o.t1 : o.t0 + 1, ymax = o.ymax || 1;
        var X = function (t) { return (L + (Math.max(Math.min(t, t1), t0) - t0) / (t1 - t0) * (W - L - R)).toFixed(1); };
        var Y = function (v) { return (H - B - Math.min(v, ymax) / ymax * (H - TOP - B)).toFixed(1); };
        var yAt = function (t) {
            var y = points.length ? points[0].y : 0;
            for (var i = 0; i < points.length && points[i].t <= t; i++) y = points[i].y;
            return y;
        };
        var pts = downsample(points, 240);
        var step = niceStep(ymax);
        var out = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.label || 'context') + '">';
        for (var v = 0; v <= ymax; v += step) {
            out += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '"/>'
                + '<text class="axis" x="' + (L - 4) + '" y="' + (Number(Y(v)) + 3) + '" text-anchor="end">' + tokens(v) + '</text>';
        }
        (o.marks || []).forEach(function (m) {
            if (!isFinite(m.t)) return;
            out += '<line class="bd ' + esc(m.kind) + '" x1="' + X(m.t) + '" x2="' + X(m.t) + '" y1="' + TOP + '" y2="' + (H - B)
                + '" stroke="' + (STAGE_C[m.stage] || 'var(--mute)') + '"><title>' + esc((m.stage || m.kind) + ' · ' + stamp(m.t)) + '</title></line>';
        });
        if (pts.length) {
            out += '<path class="ln" d="' + pts.map(function (p, i) { return (i ? 'L' : 'M') + X(p.t) + ' ' + Y(p.y); }).join(' ') + '"/>';
        }
        (o.dots || []).forEach(function (d) {
            if (!isFinite(d.t)) return;
            out += '<circle class="' + (d.kind === 'back' ? 'dback' : 'dout') + '" r="3.5" cx="' + X(d.t) + '" cy="' + Y(yAt(d.t))
                + '"><title>' + esc(d.text || d.kind) + '</title></circle>';
        });
        (o.rises || []).forEach(function (r, i) {
            if (!isFinite(r.t)) return;
            out += '<g class="rb"><circle r="7" cx="' + X(r.t) + '" cy="' + Y(r.y1) + '"/><text x="' + X(r.t) + '" y="'
                + (Number(Y(r.y1)) + 3) + '" text-anchor="middle">' + (i + 1) + '</text></g>';
        });
        pts.forEach(function (p) {
            out += '<circle class="hit" r="4" cx="' + X(p.t) + '" cy="' + Y(p.y) + '"><title>回合 ' + p.n + ' · '
                + stamp(p.t) + ' · ' + comma(p.y) + ' tokens</title></circle>';
        });
        out += '<text class="axis" x="' + L + '" y="' + (H - 4) + '">' + (o.elapsed ? '0m' : stamp(t0).slice(11)) + '</text>'
            + '<text class="axis" x="' + (W - R) + '" y="' + (H - 4) + '" text-anchor="end">'
            + (o.elapsed ? mins(t1 - t0) : stamp(t1).slice(11)) + '</text>';
        return out + '</svg>';
    }
    function riseText(r) {
        if (r.cause === 'self') return r.self.label + '，輸出 ' + comma(r.self.tok) + ' tokens';
        var top = r.top.map(function (x) { return x.label + ' ' + comma(x.chars) + ' 字元'; });
        return (top.join('；') || '沒有記到進來的輸出')
            + (r.restN ? '；另 ' + r.restN + ' 項 ' + comma(r.restChars) + ' 字元' : '');
    }
    function risesList(s, x) {
        if (!x.rises.length) return '<p class="tally">沒有上升</p>';
        return '<ol class="rz" aria-label="最大的五次上升">' + x.rises.map(function (r, i) {
            return '<li><span class="rzn">' + (i + 1) + '</span><div><div class="rzh"><span class="d">+' + tokens(r.dy)
                + '</span><span class="w">回合 ' + r.from + '→' + r.n + (isFinite(r.t) ? ' · ' + stamp(r.t).slice(11) : '')
                + '</span><span class="w">' + (r.cause === 'self' ? '模型自己的輸出' : '進來 ' + comma(r.inChars) + ' 字元')
                + '</span></div><div class="rzm">' + esc(riseText(r)) + '</div>'
                + todoSpot(riseTodo(s.id, r), r.cause === 'self' ? 'skills/fankeel/SKILL.md' : 'docs/station.md', s)
                + '</div></li>';
        }).join('') + '</ol>';
    }
    function ctxSection(s, x) {
        var P = x.points;
        var step = niceStep(x.peak || 1);
        var dots = [];
        x.dispatches.forEach(function (d) {
            dots.push({ t: d.out, kind: 'out', text: '派出 · ' + d.text });
            if (isFinite(d.back)) dots.push({ t: d.back, kind: 'back', text: '回來 · ' + d.text });
        });
        var same = P.length + x.noTime === x.requests;
        return '<div class="srcline">summarise() 的 byRequest：每個 request 的 input ＋ cache read ＋ cache write</div>'
            + (P.length ? '<div class="cx">' + lineChart(P, {
                W: 340, H: 170, t0: P[0].t, t1: P[P.length - 1].t, ymax: Math.ceil((x.peak || 1) / step) * step,
                marks: x.marks, dots: dots, rises: x.rises,
                label: String(s.id).slice(0, 8) + ' 的 context，' + P.length + ' 點，峰值 ' + tokens(x.peak),
            }) + '</div>' : '')
            + '<div class="key" aria-hidden="true"><span><i class="kl"></i>context / request</span>'
            + '<span><i class="ko"></i>派出</span><span><i class="kb"></i>回來</span><span><i class="ks"></i>階段</span></div>'
            + '<p class="tally">折線 <b>' + P.length + ' 點</b>' + (x.noTime ? ' ＋ ' + x.noTime + ' requests with no time' : '')
            + ' ＝ 摘要的 ' + x.requests + ' requests <span class="' + (same ? 'eq' : 'ne') + '">' + (same ? '一致' : '不一致')
            + '</span>' + (P.length > 240 ? ' · 超過 240 點，降取樣並保留峰值' : '')
            + ' · 峰值 ' + tokens(x.peak) + (x.peakN ? '（回合 ' + x.peakN + '）' : '') + '</p>'
            + risesList(s, x);
    }
    function seqHtml(seq, backs, route, stage, active) {
        var bk = {};
        (backs || []).forEach(function (b) { bk[b.i] = true; });
        var out = (seq || []).map(function (m, i) {
            var b = bk[i];
            return (i ? '<span class="ar' + (b ? ' bk' : '') + '" aria-hidden="true">' + (b ? '↩' : '→') + '</span>' : '')
                + '<span class="s' + (b ? ' bk' : '') + (m.source !== 'cmd' ? ' fb' : '') + '" role="listitem" title="'
                + esc(m.stage + ' · ' + stamp(m.at) + ' · ' + (m.source === 'cmd' ? 'task.js 指令' : m.source)) + '">'
                + '<span class="i">' + (i + 1) + '</span><i class="dot" style="background:' + (STAGE_C[m.stage] || '#888')
                + '"></i>' + esc(m.stage) + '</span>';
        }).join('');
        if (active) {
            (route || []).slice((route || []).indexOf(stage) + 1).forEach(function (n) {
                out += '<span class="ar" aria-hidden="true">→</span><span class="s todo" role="listitem">' + esc(n) + '</span>';
            });
        }
        return '<div class="seq" role="list" aria-label="階段移動次序">' + out + '</div>';
    }
    function backBlock(s, b) {
        return '<div class="bkl"><div class="hd2">↩ ' + esc(b.from) + ' → ' + esc(b.to) + ' <span class="mono">'
            + stamp(b.at) + ' · ' + esc(b.from) + ' 待了 ' + mins(b.at - b.since) + '</span></div>'
            + '<a class="lk" tabindex="0" data-goto="' + b.since + '" data-until="' + b.at + '">過程還原裡它前面那幾列 ↓</a>'
            + todoSpot(backTodo(s.id, b), 'skills/fankeel-build/SKILL.md', s)
            + '</div>';
    }
    function orderSection(s, x) {
        return seqHtml(x.seq, x.backs, s.route, s.stage, s.state === 'live')
            + x.backs.map(function (b) { return backBlock(s, b); }).join('')
            + '<p class="tally">次序取 ' + (x.seqSource === 'task.js' ? 'transcript 裡真正執行的 task.js 指令'
                : x.seqSource === 'moves' ? 'moves（transcript 裡沒有 task.js 指令）'
                    : 'clock（沒有指令也沒有 moves，看不出回頭）') + '；倒退 ' + x.backtracks + ' 次</p>';
    }
    function cents(c) { return '$' + ((c || 0) / 100).toFixed(2); }
    function dur(sec) {
        if (!isFinite(sec)) return '—';
        if (sec < 60) return sec + 's';
        var m = Math.floor(sec / 60), r = sec % 60;
        if (m < 60) return m + 'm' + (r < 10 ? '0' : '') + r + 's';
        return Math.floor(m / 60) + 'h' + (m % 60 < 10 ? '0' : '') + (m % 60) + 'm';
    }
    function taskCount(list) {
        if (!list || !list.length) return '沒有 plan';
        var n = 0, g = 0;
        list.forEach(function (p) { n += p.tasks.length; g += p.groups.length; });
        return n + ' 個 · ' + g + ' 組';
    }
    // One band per group `plantasks` would dispatch together, its tasks under
    // it, and the hint where one group went out over more than one turn.
    function tasksHtml(list) {
        if (!list || !list.length) return '<p class="tally">這個 session 的 claims 裡沒有 plan 檔，沒有任務表</p>';
        return list.map(function (p) {
            var byN = {};
            p.tasks.forEach(function (t) { byN[t.n] = t; });
            var done = p.tasks.filter(function (t) { return t.status === 'complete'; }).length;
            return '<div class="srcline" title="' + esc(p.plan) + '">' + esc(p.plan) + '</div>'
                + '<table class="x"><colgroup><col style="width:30px"><col><col style="width:96px"></colgroup>'
                + '<thead><tr><th>#</th><th>任務</th><th>狀態</th></tr></thead><tbody>'
                + p.groups.map(function (g) {
                    return '<tr class="band"><td colspan="3"><div class="bandrow"><span class="gb">G' + g.g + '</span>'
                        + '<span>Task ' + g.tasks.join('、') + ' · 建議 <span class="mono">' + esc(g.surface) + '</span></span>'
                        + '<span class="rt">' + (g.turns.length ? '回合 ' + g.turns.join(' · ') : '沒有派工') + '</span></div>'
                        + (g.hint ? '<div class="hint">could have gone in one response<span class="why">同組，分 '
                            + g.turns.length + ' 個回合派出</span></div>' : '') + '</td></tr>'
                        + g.tasks.map(function (n) {
                            var t = byN[n];
                            return '<tr><td class="num mute">' + n + '</td><td><div>' + esc(t ? t.title : '') + '</div>'
                                + '<div class="l2">' + (t && t.range ? esc(t.range) : '出自 plan 的 task 清單')
                                + (t && t.turns.length ? ' · 回合 ' + t.turns.join(' · ') : '') + '</div></td>'
                                + '<td><span class="pill sm ' + (t && t.status === 'complete' ? 'ok' : 'pend') + '">'
                                + esc(t ? t.status : 'no ledger line') + '</span></td></tr>';
                        }).join('');
                }).join('') + '</tbody></table>'
                + '<p class="tally">標為完成的 <b>' + done + ' 列</b> <span class="' + (done === p.ledgerLines ? 'eq">＝' : 'ne">≠')
                + '</span> ledger 的 Task 行 ' + p.ledgerLines
                + (p.unmatched.length ? '；label 裡沒有 task N 的派工 ' + p.unmatched.length + ' 個，不猜：'
                    + p.unmatched.map(esc).join('、') : '') + '</p>';
        }).join('');
    }
    // Every column below is the sum of the rows under it: each row's cents,
    // thousands of tokens and seconds were rounded in `lib/detail.js` by the
    // largest remainder, so the page only adds.
    function sums(rows) {
        return rows.reduce(function (a, r) { a.c += r.c; a.k += r.k; a.s += r.s; return a; }, { c: 0, k: 0, s: 0 });
    }
    function numCells(t, unpriced) {
        return '<td class="r">' + dur(t.s) + '</td><td class="r">' + comma(t.k) + 'k</td><td class="r"'
            + (unpriced ? ' title="價目表不認得：' + esc(unpriced) + '"' : '') + '>'
            + (unpriced && !t.c ? 'unpriced' : cents(t.c)) + '</td>';
    }
    function agentRow(r, cls, attr) {
        return '<tr class="' + cls + '"' + (attr || '') + '><td><div class="lab" title="' + esc(r.label) + '">'
            + esc(r.label || r.id) + '</div><div class="l2">' + esc((r.agentType || '—') + ' · '
            + String(r.model || r.alias || '—').replace(/^claude-/, '')) + '</div></td>'
            + numCells(r, (r.unpriced || []).join(', ')) + '<td class="r rc"></td></tr>';
    }
    // One band per dispatch, in turn order, `surface` on the band; a workflow
    // folds into one row per phase until that phase is opened. Agents that no
    // dispatch in the transcript accounts for are a band of their own.
    function dispatchHtml(x) {
        var groups = {}, order = [];
        x.rows.forEach(function (r) {
            var k = r.disp === null ? 'none' : String(r.disp);
            if (!groups[k]) { groups[k] = []; order.push(k); }
            groups[k].push(r);
        });
        order.sort(function (a, b) {
            if (a === 'none') return 1;
            if (b === 'none') return -1;
            var da = x.dispatches[a], db = x.dispatches[b];
            return (da.turn || 0) - (db.turn || 0) || (da.out || 0) - (db.out || 0);
        });
        var body = order.map(function (k) {
            var list = groups[k], d = k === 'none' ? null : x.dispatches[k];
            var head = '<tr class="band"><td><div class="bandrow"><span class="sf ' + (d ? d.surface : 'agent') + '">'
                + (d ? d.surface : '—') + '</span><span class="ell">' + esc(d ? d.text : '沒有對上派工的 agent') + '</span>'
                + '<span class="rt">' + (d && d.turn ? '回合 ' + d.turn : '')
                + (d && isFinite(d.out) ? ' · ' + stamp(d.out).slice(11) + '→' + (isFinite(d.back) ? stamp(d.back).slice(11) : '…') : '')
                + '</span></div></td>' + numCells(sums(list), '') + '<td class="r rc">'
                + (d && d.ret !== null && d.ret !== undefined ? comma(d.ret) : '—') + '</td></tr>';
            if (!d || d.surface !== 'workflow') return head + list.map(function (r) { return agentRow(r, 'ag', ''); }).join('');
            var phases = [];
            list.forEach(function (r) { var p = r.phase || '—'; if (phases.indexOf(p) < 0) phases.push(p); });
            return head + phases.map(function (p, i) {
                var pr = list.filter(function (r) { return (r.phase || '—') === p; });
                var key = 'ph-' + k + '-' + i;
                return '<tr class="phr"><td><button type="button" class="phb" data-ph="' + key + '" aria-expanded="false">'
                    + esc(p) + '<span class="n">· ' + pr.length + ' agents</span></button></td>' + numCells(sums(pr), '')
                    + '<td class="r rc"></td></tr>'
                    + pr.map(function (r) { return agentRow(r, 'wa', ' data-in="' + key + '" hidden'); }).join('');
            }).join('');
        }).join('');
        var all = sums(x.rows);
        var ret = x.dispatches.reduce(function (n, d) { return n + (d.ret || 0); }, 0);
        var launch = x.dispatches.reduce(function (n, d) { return n + (d.launch || 0); }, 0);
        var wf = x.rows.filter(function (r) { return r.surface === 'workflow'; }).length;
        var wfRun = x.runs.reduce(function (n, r) { return n + r.agents; }, 0);
        var eq = function (a, b) { return '<span class="' + (a === b ? 'eq">＝' : 'ne">≠') + '</span>'; };
        return '<table class="x dx"><colgroup><col><col style="width:50px"><col style="width:54px"><col style="width:54px">'
            + '<col style="width:58px"></colgroup><thead><tr><th>派工</th><th class="r">耗時</th><th class="r">tokens</th>'
            + '<th class="r">USD</th><th class="r rc" title="這次派工的結果進入主 context 的字元數">回傳字元</th></tr></thead>'
            + '<tbody>' + body + '</tbody><tfoot><tr><td>' + x.rows.length + ' 個 agent</td>' + numCells(all, '')
            + '<td class="r rc">' + comma(ret) + '</td></tr></tfoot></table>'
            + '<p class="tally">各列美元相加 <b>' + cents(all.c) + '</b> ' + eq(all.c, x.agentsTotal.cents) + ' agentsOf() 的 '
            + cents(x.agentsTotal.cents) + '；workflow 派工 ' + wf + ' 列 ' + eq(wf, wfRun) + ' run 檔的 workflow_agent '
            + wfRun + ' 列</p>'
            + '<p class="tally">回傳字元是派工的結果進入主 context 的長度：背景 agent 與 workflow 取 task-notification，前景的取 Agent 的'
            + ' tool_result。背景啟動時回來的確認不算在內，這個 session 合計 ' + comma(launch) + ' 字元。美元照價目表 '
            + esc(S.pricesVerified || '—') + (x.unpriced.length ? '；價目表不認得、寫 unpriced 的：' + x.unpriced.map(esc).join('、') : '')
            + '</p>';
    }
    function stepsFor(x, d) {
        var SK = { read: '讀', edit: '改', cmd: '指令', find: '搜', other: '其他' };
        if (!d) return '';
        var ids = d.ids.filter(function (id) { return x.steps[id]; });
        if (!ids.length) return '';
        var shown = 0, total = 0;
        ids.forEach(function (id) { shown += x.steps[id].steps.length; total += x.steps[id].steps.length + x.steps[id].droppedN; });
        return '<details class="stw"><summary class="rpx">展開它自己的步驟 <span class="n">' + shown + ' / ' + total + ' 步'
            + (ids.length > 1 ? ' · ' + ids.length + ' agents' : '') + '</span></summary>' + ids.map(function (id) {
                var st = x.steps[id];
                var r = x.rows.filter(function (y) { return y.id === id; })[0];
                return (ids.length > 1 ? '<div class="stg">' + esc(r ? r.label : id) + '</div>' : '')
                    + '<ul class="stp">' + st.steps.map(function (y) {
                        return '<li><span class="sk ' + y.k + '">' + (y.k === 'edit' && y.w ? '寫' : SK[y.k]) + '</span><div>'
                            + (y.f ? '<span class="fl">' + esc(y.f) + '</span>' : '<span class="cm">' + esc(y.c) + '</span>')
                            + (y.r ? '<div class="rl">' + esc(y.r) + '</div>' : '') + '</div></li>';
                    }).join('') + '</ul>'
                    + (st.droppedN ? '<p class="stn">上限 40 步，另有 ' + st.droppedN + ' 步沒列出（'
                        + Object.keys(st.dropped).map(function (k) { return SK[k] + ' ' + st.dropped[k]; }).join('、') + '）</p>' : '');
            }).join('') + '</details>';
    }
    // One row per event in time order. Each dispatch's row opens into its
    // own steps, read from its own transcript; each kind can be hidden.
    function replayHtml(x) {
        var KINDS = [['prompt', 'prompt'], ['stage', '階段'], ['gate', 'gate'], ['out', '派出'], ['back', '回來'],
            ['edit', '改檔'], ['commit', 'commit'], ['test', '測試']];
        var tag = {};
        KINDS.forEach(function (k) { tag[k[0]] = k[1]; });
        var count = {};
        x.events.forEach(function (e) { count[e.kind] = (count[e.kind] || 0) + 1; });
        var bar = '<div class="rpf" role="group" aria-label="事件種類">' + KINDS.map(function (k) {
            return '<button type="button" data-rk="' + k[0] + '" aria-pressed="true">' + k[1] + '<span class="n">'
                + (count[k[0]] || 0) + '</span></button>';
        }).join('') + '</div>';
        var list = x.events.map(function (e) {
            var body;
            if (e.kind === 'prompt') body = esc(e.text) + (e.cmd ? '<div class="sub">' + esc(e.cmd) + '</div>' : '');
            else if (e.kind === 'stage') {
                body = esc(e.verb === 'stage' ? e.stage : e.verb + (e.stage ? ' · ' + e.stage : ''))
                    + (e.text ? '<div class="sub">' + esc(e.text) + '</div>' : '');
            } else if (e.kind === 'gate') {
                body = e.qs.map(function (q) {
                    return '<div class="qa"><div class="q">' + esc(q.q) + '</div><div class="a">'
                        + esc(q.a === null ? '（沒有答案）' : q.a) + (q.own ? '<span class="own">自己寫的</span>' : '') + '</div></div>';
                }).join('');
            } else if (e.kind === 'out') {
                body = esc(e.text) + '<div class="sub">' + esc(e.surface + (e.agentType ? ' · ' + e.agentType : '')
                    + (e.alias ? ' · ' + e.alias : '')) + '</div>' + stepsFor(x, x.dispatches[e.disp]);
            } else if (e.kind === 'back') {
                body = esc(e.text) + '<div class="sub">回傳 ' + (e.ret === null || e.ret === undefined ? '—' : comma(e.ret) + ' 字元') + '</div>';
            } else if (e.kind === 'edit') {
                body = e.files.map(function (f) { return '<span class="fl">' + esc(f.f) + (f.n > 1 ? ' ×' + f.n : '') + '</span>'; }).join('、');
            } else if (e.kind === 'commit') body = '<span class="sha">' + esc(e.sha) + '</span>' + esc(e.text);
            else body = esc(e.text);
            return '<li data-kind="' + esc(e.kind) + '" data-t="' + (isFinite(e.t) ? e.t : '') + '"><span class="tm">'
                + (isFinite(e.t) ? stamp(e.t).slice(11) : '—') + '</span><div class="tx"><span class="tg ' + esc(e.kind) + '">'
                + esc(tag[e.kind] || e.kind) + '</span>' + body + '</div></li>';
        }).join('');
        return bar + '<ol class="rp">' + list + '</ol><p class="tally">' + x.events.length + ' 列'
            + (x.dropped ? '；超過 300 列，只留 gate、階段、commit 與派工，丟掉了 ' + x.dropped + ' 列' : '') + '</p>';
    }

    // ---- 記成 TODO -------------------------------------------------------
    // One line for TODO.md's `## Needs a decision`, in the shape todo-check
    // reads: the text, then the link it points at. `scripts/station.js`
    // builds the line it writes with this same function.
    function todoEntry(text, link) {
        var l = String(link || '').trim();
        var label = l ? (l.split('#')[0].split('/').pop() || l) : '';
        return String(text || '').replace(/\s+/g, ' ').trim() + (l ? ' — [' + label + '](' + l + ')' : '');
    }
    function riseTodo(id, r) {
        return '〔station〕' + String(id).slice(0, 8) + ' 回合 ' + r.from + '→' + r.n + ' context +' + tokens(r.dy) + '：'
            + (r.cause === 'self' ? r.self.label
                : r.top[0] ? r.top[0].label + ' ' + comma(r.top[0].chars) + ' 字元' : '進來的輸出');
    }
    function backTodo(id, b) {
        return '〔station〕' + String(id).slice(0, 8) + ' ' + b.from + '→' + b.to + ' 倒退（' + stamp(b.at) + '，'
            + b.from + ' 待了 ' + mins(b.at - b.since) + '）：' + b.from + ' 抓到的，' + b.to + ' 為什麼沒抓到';
    }
    // Served, a form that posts the line to `/todo`, which checks it with
    // todo-check's own rules before writing and answers 400 with the rule that
    // failed. A file on disk cannot post, so it prints the line to copy.
    function todoSpot(text, link, s) {
        if (!S.serve) {
            return '<div class="td"><div class="tdc"><code>- ' + esc(todoEntry(text, link)) + '</code></div>'
                + '<div class="tds">靜態頁不寫檔：複製這一行，貼進 TODO.md 的 ## Needs a decision。</div></div>';
        }
        return '<details class="td"><summary class="tdb">記成 TODO <span class="m">POST /todo</span></summary>'
            + '<div class="tdf" data-todo-root="' + esc(s.root) + '" data-todo-id="' + esc(s.id) + '">'
            + '<label>條目（寫進 TODO.md 的 ## Needs a decision）</label><textarea rows="2" spellcheck="false">'
            + esc(text) + '</textarea><label>連結</label><input type="text" spellcheck="false" value="' + esc(link) + '">'
            + '<div class="help">送出前跑 todo-check 的同一套規則：≤ 200 字元、連結要存在、不指向 plan、decision、report、archive。</div>'
            + '<div class="act"><button type="button" class="go" data-todo>送出</button></div>'
            + '<div class="tdr" role="status" aria-live="polite"></div></div></details>';
    }

    function draw() {
        var p = doc.getElementById('page');
        p.className = 'scrollmain' + (page === 'list' ? ' fixed' : '');
        p.innerHTML = page === 'list' ? listPage() : overview();
        if (page === 'list') drawList();
        drawSide();
        doc.getElementById('gen').textContent = genText();
    }
    doc.addEventListener('click', function (e) {
        // 記成 TODO: the server checks the line and answers with the rule it
        // failed, or with the line it wrote.
        var todo = e.target.closest('[data-todo]');
        if (todo) {
            var box = todo.closest('.tdf');
            var said = box.querySelector('.tdr');
            var body = new URLSearchParams();
            body.set('nonce', S.nonce || '');
            body.set('root', box.getAttribute('data-todo-root'));
            body.set('id', box.getAttribute('data-todo-id'));
            body.set('text', box.querySelector('textarea').value);
            body.set('link', box.querySelector('input').value);
            fetch('todo', { method: 'POST', body: body }).then(function (r) {
                return r.text().then(function (t) {
                    said.className = 'tdr ' + (r.ok ? 'ok' : 'bad');
                    said.textContent = (r.ok ? '寫進 TODO.md：' : r.status + ' — 沒有寫進去：') + t.trim();
                });
            }, function () {
                said.className = 'tdr bad';
                said.textContent = '送不出去：serve 還在跑嗎？';
            });
            return;
        }
        // A workflow phase opens into its agents.
        var ph = e.target.closest('[data-ph]');
        if (ph) {
            var shown = ph.getAttribute('aria-expanded') !== 'true';
            ph.setAttribute('aria-expanded', String(shown));
            [].forEach.call(doc.querySelectorAll('[data-in="' + ph.getAttribute('data-ph') + '"]'), function (r) { r.hidden = !shown; });
            return;
        }
        // A replay kind is hidden or shown again.
        var rk = e.target.closest('[data-rk]');
        if (rk) {
            var on = rk.getAttribute('aria-pressed') !== 'true';
            rk.setAttribute('aria-pressed', String(on));
            [].forEach.call(doc.querySelectorAll('#det .rp > li[data-kind="' + rk.getAttribute('data-rk') + '"]'), function (li) { li.hidden = !on; });
            return;
        }
        // A backtrack opens the replay on the rows between entering the stage
        // it left and the step back — what that stage saw before it sent the
        // work back.
        var jump = e.target.closest('[data-goto]');
        if (jump) {
            var from = Number(jump.getAttribute('data-goto')), until = Number(jump.getAttribute('data-until'));
            var rp = doc.getElementById('s-rp');
            if (!rp) return;
            rp.open = true;
            var first = null;
            [].forEach.call(rp.querySelectorAll('.rp > li[data-t]'), function (li) {
                var t = Number(li.getAttribute('data-t'));
                var hit = li.getAttribute('data-t') !== '' && t >= from && t <= until;
                li.classList.toggle('hl', hit);
                if (hit && !first) first = li;
            });
            if (first) first.scrollIntoView({ block: 'center' });
            return;
        }
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

    doc.getElementById('nreg').textContent = S.projects.length + ' 個 registry · '
        + S.sessions.length + ' sessions';
    doc.getElementById('cfg').textContent = String(S.configDir || '').replace(/^.*[\\/]/, '')
        || S.configDir;
    doc.getElementById('cfg').title = S.configDir || '';
    draw();
}(typeof window === 'undefined' ? {} : window,
  typeof document === 'undefined' ? null : document));
