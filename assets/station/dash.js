// 儀表板卡片與完成紀錄 (FK_DASH): moved out of station.js (station-52).
// station.js calls make(K) once, on first use, handing it the helpers these
// bodies name; everything here only computes or builds strings.
(function (w) {
    'use strict';
    function make(K) {
        // One alias per name K carries, so the bodies below moved verbatim; the
        // station.js vars that are assigned later (S, NAMES, DAYS, NOW) are read as K.<name>().
        var loc = K.loc, esc = K.esc, icon = K.icon, sessionHash = K.sessionHash, ROUTE = K.ROUTE, shortLabel = K.shortLabel,
            dayBars = K.dayBars, usd = K.usd, estMark = K.estMark, w = K.w, tokens = K.tokens, KIND_KEYS = K.KIND_KEYS,
            KIND_LABEL = K.KIND_LABEL, modelLabel = K.modelLabel, view = K.view, DASH_SHOWN = K.DASH_SHOWN;
        function msOf(t) { return typeof t === 'number' ? t : Date.parse(t); }
        // Each card writes its own `data-block` literally, so the tune proxy and
        // tests/station-dispatch-view.test.js can find it in this file.
        function dashHead(ico, title, href, n, cls) {
            return '<div class="dcard-h">' + icon(ico) + '<b>' + title + '</b>'
                + (n === undefined ? '' : '<span class="kn' + (cls ? ' ' + cls : '') + '">' + n + '</span>')
                + '<span class="spacer"></span>'
                + '<a class="dmore" href="' + href + '">' + loc('dash.seeAll', '查看全部 →') + '</a></div>';
        }
        // The promo film's v5 glyph (assets/station/tour-ring.js promo30v5 `glyph`,
        // its small branch; ported from .fankeel/build/2026-10-01-station-redesign/
        // gen.js) as an SVG string: six segments survey..audit, the edge land, the
        // core the task. `o.seg(i)` and `o.edge` give each part's state — 'done',
        // 'now', 'todo' — or null to leave it out (`o.edge` undefined is 'done');
        // `o.c` is the colour of the stage now, `o.cls` more classes.
        function keelGlyph(o) {
            o = o || {};
            var segState = o.seg || function () { return 'done'; }, edgeState = o.edge === undefined ? 'done' : o.edge;
            var RAD = Math.PI / 180, POINTY = [-90, -30, 30, 90, 150, 210], ANG = [120, 180, 240, 300, 0, 60];
            var Ro = 50, Ri = 31, cut = 7, ew = 8, tr = 21, d = (cut / 2) / Math.sin(Math.PI / 3);
            var at = function (r, a) { return [60 + r * Math.cos(a * RAD), 60 + r * Math.sin(a * RAD)]; };
            var mv = function (p, q) { var L = Math.hypot(q[0] - p[0], q[1] - p[1]); return [p[0] + (q[0] - p[0]) / L * d, p[1] + (q[1] - p[1]) / L * d]; };
            var P = function (pts) { return 'M' + pts.map(function (p) { return p.map(function (v) { return v.toFixed(2); }).join(' '); }).join('L') + 'Z'; };
            var segs = ANG.map(function (a, i) {
                var st = segState(i);
                if (!st) return '';
                var o0 = at(Ro, a - 30), o1 = at(Ro, a + 30), i0 = at(Ri, a - 30), i1 = at(Ri, a + 30);
                return '<path class="gseg ' + st + '" style="--i:' + i + ';--dx:' + (14 * Math.cos(a * RAD)).toFixed(1) + 'px;--dy:' + (14 * Math.sin(a * RAD)).toFixed(1)
                    + 'px" d="' + P([mv(o0, o1), mv(o1, o0), mv(i1, i0), mv(i0, i1)]) + '"/>';
            }).join('');
            return '<svg class="glyph k-only' + (o.cls ? ' ' + o.cls : '') + '" viewBox="0 0 120 120" aria-hidden="true"' + (o.c ? ' style="--c:' + o.c + '"' : '') + '>' + segs
                + (edgeState ? '<path class="gedge ' + edgeState + '" d="' + P(POINTY.map(function (a) { return at(Ro, a); })) + '" stroke-width="' + ew + '"/>' : '')
                + '<path class="gcore" d="' + P(POINTY.map(function (a) { return at(tr, a); })) + '"/></svg>';
        }
        // A session's progress on the glyph: a stage the route has passed is done,
        // the stage it is at is now, one still to come is todo, one the route skips
        // is left out; land is the edge. Then the film's header count, `04 / 07 build`.
        function keelProgress(s) {
            var route = s.route || [], at = route.indexOf(s.stage);
            var state = function (k) { var i = route.indexOf(k); return i < 0 ? null : i < at ? 'done' : i === at ? 'now' : 'todo'; };
            var live = s.state === 'live' && !s.gateAt && s.busy === true;
            return keelGlyph({ cls: 'prog' + (live ? ' live' : ''), seg: function (i) { return state(ROUTE[i]); }, edge: state('land'), c: at >= 0 ? 'var(--st-' + esc(s.stage) + ')' : '' });
        }
        function keelStage(s) {
            var route = s.route || [], at = route.indexOf(s.stage);
            if (at < 0) return '';
            var two = function (n) { return ('0' + n).slice(-2); };
            return '<span class="kst k-only" style="--c:var(--st-' + esc(s.stage) + ')"><b>' + two(at + 1) + '</b><i>&nbsp;/&nbsp;' + two(route.length) + '</i><u>' + esc(s.stage) + '</u></span>';
        }
        // A focus page link (`/f/<id>/<stage>`, scripts/station.js) where serve
        // answers one; a page opened from file:// has no server, so it keeps the hash.
        function focusHref(id, stage, serve) {
            return serve ? '/f/' + encodeURIComponent(id) + '/' + encodeURIComponent(stage || 'timeline') : sessionHash(id);
        }
        function tdShow(dlg, st, focus) {
            [].forEach.call(dlg.querySelectorAll('[role=tab]'), function (b) {
                var on = b.getAttribute('data-st') === st;
                b.setAttribute('aria-selected', String(on));
                b.setAttribute('tabindex', on ? '0' : '-1');
                if (on && focus) b.focus();
            });
            [].forEach.call(dlg.querySelectorAll('[role=tabpanel]'), function (p) { p.hidden = p.getAttribute('data-st') !== st; });
        }
        function dashTodoName(pkey) { return esc(shortLabel(K.NAMES()[pkey] || pkey)); }
        // Sums of `dayBars` parts across the window, one per key, largest first.
        function dashParts(bars) {
            var sum = {}, est = {};
            bars.days.forEach(function (b) {
                Object.keys(b.parts).forEach(function (k) { sum[k] = (sum[k] || 0) + b.parts[k]; if (b.est[k]) est[k] = true; });
            });
            return Object.keys(sum).map(function (k) { return { k: k, v: sum[k], estimated: !!est[k] }; }).sort(function (a, b) { return b.v - a.v; });
        }
        function dashByProj(R) {
            var rows = dashParts(dayBars(R, 'usd', 'project', K.DAYS())), mx = rows.length ? rows[0].v : 1;
            return '<section class="dcard" data-block="dash-byproj">' + dashHead('barh', loc('dash.cardByProj', '依專案花費'), '#/projects')
                + (rows.length ? '<div class="xc-bars">' + rows.slice(0, DASH_SHOWN).map(function (r, i) {
                    return '<span class="k" title="' + esc(K.NAMES()[r.k] || r.k) + '">' + dashTodoName(r.k) + '</span><span class="bar' + (i ? '' : ' top') + '"><i style="--w:'
                        + (r.v / mx * 100).toFixed(1) + '%"></i></span><span class="v">' + usd(r.v, true) + estMark(r) + '</span>';
                }).join('') + '</div>' : '<p class="dnone">' + loc('dash.noSpend30d', '近 30 天沒有花費') + '</p>') + '</section>';
        }
        // The last seven days' tokens, the five kinds `dayBars` reads off `days[].tokens`.
        function dashTokens7(R) {
            var bars = dayBars(R, 'tokens', 'kind', K.DAYS().slice(-7)), list = bars.days, mx = bars.max || 1;
            var kind = {};
            var notes = w.FK_KINDS ? w.FK_KINDS.notes(K.S().prices) : {};
            dashParts(bars).forEach(function (r) { kind[r.k] = r.v; });
            var tot = list.reduce(function (n, b) { return n + b.total; }, 0);
            return '<section class="dcard" data-block="dash-tokens7">' + dashHead('barv', loc('dash.cardTokens7', '近 7 天 token'), '#/days/detail')
                + '<div class="dbig">' + tokens(tot) + '</div>'
                + '<div class="xc-cols" role="img" aria-label="' + esc(loc('dash.cardTokens7', '近 7 天 token')) + '">' + list.map(function (b) {
                    return '<i title="' + esc(b.day + ' ' + tokens(b.total)) + '" style="--h:' + (b.total / mx * 100).toFixed(1) + '%"></i>';
                }).join('') + '</div>' + (list.length ? '<div class="xc-days"><span>' + list[0].day.slice(5) + '</span><span>' + list[list.length - 1].day.slice(5) + '</span></div>' : '')
                + '<div class="dkv">' + KIND_KEYS.map(function (k) {
                    return '<span' + (notes[k] ? ' title="' + esc(notes[k]) + '"' : '') + '>' + esc(KIND_LABEL[k]) + ' <b>' + tokens(kind[k] || 0) + '</b></span>';
                }).join('') + '</div></section>';
        }
        function dashModels(R) {
            var rows = dashParts(dayBars(R, 'usd', 'model', K.DAYS())), tot = rows.reduce(function (n, r) { return n + r.v; }, 0);
            var pct = function (r) { return Math.round(r.v / tot * 100) + '%'; };
            var c = function (r) { return 'var(--m-' + (r.k === 'other' ? 'other' : r.k.split('-')[0]) + ')'; };
            return '<section class="dcard" data-block="dash-models">' + dashHead('pie', loc('dash.cardModels', '模型用量分布'), '#/days/detail')
                + (rows.length ? '<div class="xc-stack">' + rows.map(function (r) {
                    return '<i title="' + esc(modelLabel(r.k)) + '" style="--w:' + (r.v / tot * 100).toFixed(1) + '%;--c:' + c(r) + '"></i>';
                }).join('') + '</div><ul class="xc-key">' + rows.map(function (r) {
                    return '<li style="--c:' + c(r) + '">' + esc(modelLabel(r.k)) + ' <b>' + pct(r) + '</b></li>';
                }).join('') + '</ul><p class="xc-note">' + loc('dash.modelsBySpend', '按近 30 天的花費算') + '</p>' : '<p class="dnone">' + loc('dash.noSpend30d', '近 30 天沒有花費') + '</p>') + '</section>';
        }
        function dispatchUi(s) {
            return { open: view.open, prm: view.prm, ph: view.ph, filter: view.dfilter, view: view.dxv, metric: view.dxm,
                now: K.S().serve ? Date.now() : K.NOW(), live: Boolean(K.S().serve) && Boolean(s) && s.state === 'live' };
        }
        // A stage column's dollars, from the data file's per-stage `usd`. A stage
        // the session went through twice has one figure for both visits, so
        // neither column claims it.
        function stageCost(m, s) {
            var by = {}, est = {}, n = {};
            (s.stages || []).forEach(function (w) { by[w.stage] = w.usd; est[w.stage] = w.estimated === true; });
            m.segs.forEach(function (g) { n[g.stage] = (n[g.stage] || 0) + 1; });
            m.segs.forEach(function (g) { if (n[g.stage] === 1 && isFinite(by[g.stage])) { g.usd = by[g.stage]; g.estimated = est[g.stage]; } });
            return m;
        }
        // ---- the completion record: the six fields land files -------------------
        // The six-field record land files (scripts/record.js): first in the
        // detail, above the tabs on the session page, and its 要求 under a landed
        // row of the list. One muted line where there is none.
        function recLabel(k) {
            switch (k) {
            case 'ask': return loc('rec.ask', '要求');
            case 'did': return loc('rec.did', '做了什麼');
            case 'why': return loc('rec.why', '為什麼這樣做');
            case 'checked': return loc('rec.checked', '驗過・沒驗過');
            case 'cost': return loc('rec.cost', '花費');
            default: return loc('rec.left', '還剩什麼');
            }
        }
        function recTitle() { return loc('rec.title', '完成紀錄'); }
        function recordRows(f, cls) {
            return ['ask', 'did', 'why', 'checked', 'cost', 'left'].map(function (k) {
                var v = f[k];
                var body = k === 'did'
                    ? '<ul class="rec-ul">' + (Array.isArray(v) ? v : []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>'
                    : esc(v || '');
                return '<div class="' + cls + '-r' + (k === 'ask' ? ' ' + cls + '-ask' : '') + '"><dt>' + recLabel(k) + '</dt>'
                    + '<dd' + (k === 'cost' ? ' class="rec-num"' : '') + '>' + body + '</dd></div>';
            }).join('');
        }
        function recordNone(s) {
            return s && s.state !== 'down' ? loc('rec.noneYet', '完成紀錄在 land 時寫。') : loc('rec.none', '這個任務沒有完成紀錄。');
        }
        function recordSrc(r, cls) {
            return r.file ? '<p class="' + cls + '-src">' + loc('rec.alsoIn', '也記在 {f}', { f: '<span class="mono">' + esc(r.file) + '</span>' }) + '</p>' : '';
        }
        function recordHtml(s) {
            var r = s && s.record;
            if (!r || !r.fields) return '<p class="rec-none" data-block="record-none">' + recordNone(s) + '</p>';
            return '<section class="rec" data-block="record" aria-labelledby="rec-h"><h3 class="rec-h" id="rec-h">' + recTitle() + '</h3>'
                + '<dl class="rec-f">' + recordRows(r.fields, 'rec') + '</dl>' + recordSrc(r, 'rec') + '</section>';
        }
        function recordPageHtml(s) {
            var r = s && s.record;
            if (!r || !r.fields) return '<p class="recp-none" data-block="record-page-none">' + recordNone(s) + '</p>';
            return '<section class="panel recp" data-block="record-page" aria-labelledby="recp-h"><div class="h2" id="recp-h">' + recTitle() + '</div>'
                + '<dl class="recp-f">' + recordRows(r.fields, 'recp') + '</dl>' + recordSrc(r, 'recp') + '</section>';
        }
        // A task's Chartroom boards (lib/board.js), drawn by the served station at
        // GET /station/board/<id>/<name>.svg — the mockup's data-block="boards".
        // An <img>, never inline SVG: the labels are an agent's, and an SVG in an
        // <img> runs no script. A static copy has no route to draw them, so it
        // shows no block; `?v=` is the file's mtime, so a redrawn board reloads.
        function boardsHtml(s, served) {
            var list = s && Array.isArray(s.boards) ? s.boards : [];
            if (!served || !list.length) return '';
            var id = encodeURIComponent(String(s.id));
            var at = String(s.started || '').replace(/[-:]/g, '').slice(0, 15);
            var icon = '<svg class="ico" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
                + '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>';
            return '<section class="panel boards" data-block="boards" aria-labelledby="boards-h"><div class="h2" id="boards-h">' + icon
                + loc('rec.boards', 'AI 畫的圖') + '<small>' + loc('rec.boardsHint', '{n} 張・點一下在新分頁開完整的圖', { n: list.length }) + '</small></div>'
                + '<ul class="bd-grid">' + list.map(function (b) {
                    var src = 'station/board/' + id + '/' + encodeURIComponent(String(b.name)) + '.svg?v=' + encodeURIComponent(String(b.updated));
                    return '<li><a class="bd" href="' + esc(src) + '" target="_blank" rel="noopener" title="' + esc(loc('rec.boardOpen', '{f}，在新分頁開完整的圖', { f: b.name + '.board' })) + '">'
                        + '<span class="bd-th"><img src="' + esc(src) + '" alt="' + esc(loc('rec.boardAlt', '{f} 的縮圖', { f: b.name })) + '" loading="lazy" decoding="async"></span>'
                        + '<span class="bd-ft"><span class="bd-nm"><b>' + esc(b.name) + '</b>.board</span><span class="bd-go">' + loc('rec.boardGo', '開新分頁') + '</span></span></a></li>';
                }).join('') + '</ul>'
                + (/^\d{8}T\d{6}$/.test(at) ? '<p class="bd-src">' + loc('rec.boardsIn', '檔案在 {d}', { d: '<span class="mono">' + esc('.fankeel/build/task-' + at + '/') + '</span>' }) + '</p>' : '')
                + '</section>';
        }
        function listAskRow(s, sel) {
            var a = s && s.record && s.record.fields ? s.record.fields.ask : '';
            if (!a) return '';
            return '<tr class="ask" data-block="list-ask" data-id="' + esc(s.id) + '" aria-selected="' + (sel === s.id) + '"><td></td><td colspan="7">'
                + '<div class="ask-l" title="' + esc(a) + '"><span class="ask-k">' + loc('rec.ask', '要求') + '</span>' + esc(a) + '</div></td></tr>';
        }
        return { msOf: msOf, dashHead: dashHead, keelGlyph: keelGlyph, keelProgress: keelProgress, keelStage: keelStage,
            focusHref: focusHref, tdShow: tdShow, dashTodoName: dashTodoName, dashParts: dashParts, dashByProj: dashByProj,
            dashTokens7: dashTokens7, dashModels: dashModels, stageCost: stageCost, recLabel: recLabel, recTitle: recTitle,
            recordRows: recordRows, recordNone: recordNone, recordSrc: recordSrc, recordHtml: recordHtml,
            recordPageHtml: recordPageHtml, boardsHtml: boardsHtml, listAskRow: listAskRow, dispatchUi: dispatchUi };
    }
    var api = { make: make };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_DASH = api;
}(typeof window !== 'undefined' ? window : null));
