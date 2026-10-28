// The session page's bodies (FK_SBODY): moved out of station.js (station-52).
// station.js calls make(K) once, on first use, handing it the helpers these
// bodies name; everything here only builds strings.
(function (w) {
    'use strict';
    function make(K) {
        // One alias per name K carries, so the bodies below moved verbatim.
        var w = K.w,
            loc = K.loc,
            esc = K.esc,
            tokens = K.tokens,
            cents = K.cents,
            family = K.family,
            niceTop = K.niceTop,
            niceStep = K.niceStep,
            downsample = K.downsample,
            mins = K.mins,
            hours = K.hours,
            usd = K.usd,
            estMark = K.estMark,
            stamp = K.stamp,
            comma = K.comma,
            colorOf = K.colorOf,
            icon = K.icon,
            sessionHash = K.sessionHash,
            sessionTotals = K.sessionTotals,
            roHtml = K.roHtml,
            quotaPct = K.quotaPct,
            agentCounts = K.agentCounts,
            agentState = K.agentState,
            gateAt = K.gateAt,
            clockSec = K.clockSec,
            agoText = K.agoText,
            tk = K.tk,
            ROUTE = K.ROUTE,
            KIND_KEYS = K.KIND_KEYS,
            KIND_COLOR = K.KIND_COLOR,
            KIND_LABEL = K.KIND_LABEL;
        function clock(ms) { var d = new Date(ms); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
        // One real time axis, from the first stage step to the last request: a
        // stage is as wide as it lasted, a wait is the gap between a gate's question
        // and its answer, an agent runs from launch to return.
        function timelineModel(x) {
            var pts = (x.points || []).filter(function (p) { return isFinite(p.t); });
            var seq = x.seq || [], rows = x.rows || [], bars = [];
            var t0 = seq.length ? seq[0].at : pts.length ? pts[0].t : NaN;
            var t1 = pts.length ? pts[pts.length - 1].t : t0;
            var agent = function (r, kind, key, ret) {
                return { kind: kind, key: key, label: r.label || r.id, model: r.model, from: r.from, to: r.to,
                    tokens: (r.k || 0) * 1000, cents: r.c || 0, ret: ret, estimated: (r.estimated || []).length > 0 };
            };
            (x.dispatches || []).forEach(function (d, i) {
                var kids = rows.filter(function (r) { return r.disp === i; });
                if (d.surface !== 'workflow') {
                    kids.forEach(function (r) { bars.push(agent(r, 'agent', r.id, d.ret)); });
                    return;
                }
                bars.push({ kind: 'wf', key: 'wf-' + i, label: d.text, model: null, from: d.out, to: d.back, ret: d.ret, n: kids.length,
                    tokens: kids.reduce(function (n, r) { return n + (r.k || 0); }, 0) * 1000,
                    cents: kids.reduce(function (n, r) { return n + (r.c || 0); }, 0),
                    estimated: kids.some(function (r) { return (r.estimated || []).length > 0; }) });
                kids.forEach(function (r) { bars.push(agent(r, 'kid', 'wf-' + i, null)); });
            });
            rows.filter(function (r) { return r.disp === null; }).forEach(function (r) { bars.push(agent(r, 'agent', r.id, null)); });
            return {
                t0: t0, t1: t1, points: pts, bars: bars,
                segs: seq.map(function (m, i) { return { stage: m.stage, from: m.at, to: i + 1 < seq.length ? seq[i + 1].at : t1 }; })
                    .filter(function (g) { return g.to > g.from; }),
                waits: (x.waits || []).map(function (w) {
                    return { stage: w.stage, from: w.askedAt, to: w.answeredAt, ms: w.answeredAt - w.askedAt };
                }),
                ticks: pts.map(function (p) { return { t: p.t, family: family(p.model) }; }),
                rets: (x.dispatches || []).filter(function (d) { return isFinite(d.back) && d.ret !== null && d.ret !== undefined; })
                    .map(function (d) { return { t: d.back, chars: d.ret }; }),
                rises: x.rises || [],
            };
        }
        // Roughly how wide a label is: a CJK glyph is about the font size, the rest
        // about half of it. Close enough to keep two labels apart, which is all it
        // is for — nothing here measures text, and a browser is the only thing that
        // could.
        function textW(s, size) {
            var n = 0;
            for (var i = 0; i < s.length; i++) n += s.charCodeAt(i) > 0x2e7f ? size : size * 0.55;
            return n;
        }
        // Labels along one axis, asked in the order they are drawn: a label is kept
        // only where it clears the last one kept. A dense session put a dozen of
        // them on the same pixels and none of the dozen could be read.
        function labelRoom() {
            var last = -1e9;
            return function (left, right) {
                if (left < last + 4) return false;
                last = right;
                return true;
            };
        }
        function timelineSvg(m, closed, hi) {
            if (!(m.t1 > m.t0)) return '<p class="note">' + loc('ses.noTimedRequests', '這個 session 沒有帶時間的 request，畫不出時間線') + '</p>';
            var shown = m.bars.filter(function (b) { return b.kind !== 'kid' || !closed[b.key]; });
            // One picture on one time axis, top to bottom: the stage names over
            // their columns, the context curve drawn across those columns on its
            // own token axis, the waits' lengths, a tick per request, then a row
            // per agent. A stage is a tinted column as wide as it lasted; a wait is
            // hatched through everything below the clock.
            var W = 1200, G = 160, R = 18, RH = 26, sl = 30, ctx0 = 56, ctxH = 160, ctxB = ctx0 + ctxH;
            var wl = ctxB + 15, rq0 = wl + 8, rqH = 14, d0 = rq0 + rqH + 26;
            var H = d0 + Math.max(1, shown.length) * RH + 34, bottom = H - 26;
            var X = function (t) { return G + (Math.min(Math.max(t, m.t0), m.t1) - m.t0) / (m.t1 - m.t0) * (W - G - R); };
            var ctop = niceTop(Math.max.apply(null, m.points.map(function (p) { return p.y; }).concat([1])));
            var Yc = function (v) { return ctxB - v / ctop * ctxH; };
            var yAt = function (t) { var y = 0; m.points.forEach(function (p) { if (p.t <= t) y = p.y; }); return y; };
            var segAt = function (t) { var g = null; m.segs.forEach(function (x) { if (x.from <= t) g = x; }); return g; };
            var f1 = function (n) { return n.toFixed(1); };
            // A bar's label sits to its right, and at the end of a session there is
            // no right left: one that would run past the edge takes the space on the
            // left instead, and stays on the right when the left is narrower still.
            var barLabel = function (x0, x1, y, text) {
                var w = textW(text, 11.5), left = x1 + 8 + w > W - R && x0 - 8 - w >= 0;
                return '<text x="' + f1(left ? x0 - 8 : x1 + 8) + '" y="' + y + '"' + (left ? ' text-anchor="end"' : '')
                    + ' style="font-size:11.5px;fill:var(--ink2)">' + esc(text) + '</text>';
            };
            var out = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + loc('ses.timelineLabel', 'session 時間線') + '"' + (hi ? ' data-hi' : '') + '><defs>'
                + '<pattern id="hw" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)">'
                + '<rect width="5" height="5" style="fill:var(--hatch-bg)"/><rect width="1.4" height="5" style="fill:var(--hatch)"/></pattern></defs>'
                + '<text x="' + G + '" y="16" style="fill:var(--ink);font-weight:600">' + clock(m.t0) + '</text>'
                + '<text x="' + (W - R) + '" y="16" text-anchor="end" style="fill:var(--ink);font-weight:600">' + clock(m.t1) + '</text>'
                + '<text class="tick" x="' + (W - R) + '" y="' + (H - 8) + '" text-anchor="end">' + loc('ses.totalMins', '共 {t}', { t: mins(m.t1 - m.t0) }) + '</text>';
            // The gutter's lane names stay clear of the token ticks, which end
            // 8px left of G and are at most five characters wide.
            out += '<text class="lane-l" x="0" y="' + (sl + 13) + '">stage</text>'
                + '<text class="lane-l" x="0" y="' + (ctx0 + 10) + '">' + loc('ses.mainSessionContext', '主 session context') + '</text>'
                + '<text class="lane-s" x="0" y="' + (ctx0 + 26) + '">' + loc('ses.tokenAgentReturn', 'token；◆ 是 agent 回傳') + '</text>';
            // The stage columns first, so everything else draws over them.
            var stRoom = labelRoom();
            m.segs.forEach(function (g) {
                var x0 = X(g.from), w = Math.max(X(g.to) - x0, 0.5), c = colorOf('stage', g.stage);
                var text = g.stage + ' ' + mins(g.to - g.from) + (isFinite(g.usd) && g.usd ? ' · ' + usd(g.usd) + estMark(g) : ''), lw = textW(g.stage, 11.5) + 12;
                out += '<rect class="seg" x="' + f1(x0) + '" y="' + sl + '" width="' + f1(w) + '" height="' + (ctxB - sl) + '"'
                    + (hi === g.stage ? ' data-on' : '') + ' style="fill:' + c + '"><title>' + esc(text) + '</title></rect>'
                    + '<rect class="segcap" x="' + f1(x0) + '" y="' + sl + '" width="' + f1(w) + '" height="3" style="fill:' + c + '"/>'
                    + '<line class="segl" x1="' + f1(x0) + '" x2="' + f1(x0) + '" y1="' + sl + '" y2="' + ctxB + '" style="stroke:' + c + '"/>'
                    + (w > lw && stRoom(x0 + 6, x0 + 6 + lw)
                        ? '<text class="segn" x="' + f1(x0 + 6) + '" y="' + (sl + 16) + '" style="fill:' + c + '">' + esc(g.stage)
                            + (w > lw + textW(mins(g.to - g.from), 10.5) + 8 ? '<tspan class="segd"> ' + mins(g.to - g.from) + '</tspan>' : '') + '</text>'
                        : '');
            });
            m.waits.forEach(function (w) {
                out += '<rect class="wait" x="' + f1(X(w.from)) + '" y="' + (sl - 6) + '" width="' + f1(Math.max(X(w.to) - X(w.from), 1))
                    + '" height="' + (bottom - sl + 6) + '" style="fill:url(#hw);opacity:.38"/>';
            });
            var step = niceStep(ctop);
            for (var gv = 0; gv <= ctop; gv += step) {
                out += '<line class="' + (gv ? 'gridl' : 'base') + '" x1="' + G + '" x2="' + (W - R) + '" y1="' + f1(Yc(gv)) + '" y2="' + f1(Yc(gv)) + '"/>'
                    + '<text class="tick" x="' + (G - 8) + '" y="' + f1(Yc(gv) + 4) + '" text-anchor="end">' + tokens(gv) + '</text>';
            }
            if (m.points.length) {
                out += '<path d="' + m.points.map(function (p, i) { return (i ? 'L' : 'M') + f1(X(p.t)) + ',' + f1(Yc(p.y)); }).join('')
                    + '" style="fill:none;stroke:var(--ctx);stroke-width:2;stroke-linejoin:round"/>';
            }
            // The five largest rises, numbered as the list under the chart numbers them.
            (m.rises || []).forEach(function (r, i) {
                if (!isFinite(r.t)) return;
                out += '<g class="rb"><circle r="7" cx="' + f1(X(r.t)) + '" cy="' + f1(Yc(r.y1)) + '"/><text x="' + f1(X(r.t)) + '" y="'
                    + f1(Yc(r.y1) + 3) + '" text-anchor="middle">' + (i + 1) + '</text></g>';
            });
            // A wait's length, under the curve where no stage name competes with it.
            var waitRoom = labelRoom();
            m.waits.forEach(function (w) {
                var x0 = X(w.from), wd = Math.max(X(w.to) - x0, 1);
                var lab = loc('ses.waitedMins', '等 {t}', { t: mins(w.ms) }), lw = textW(lab, 11);
                // Centred on the band, except where that would hang off an edge: the
                // last wait of a session sits against the right margin.
                var cx = Math.min(x0 + wd / 2, W - R - lw / 2);
                out += '<rect class="waitst" x="' + f1(x0) + '" y="' + ctx0 + '" width="' + f1(wd) + '" height="' + ctxH
                    + '" style="fill:url(#hw)"><title>' + esc(lab) + '</title></rect>'
                    + (waitRoom(cx - lw / 2, cx + lw / 2)
                        ? '<text x="' + f1(cx) + '" y="' + wl + '" text-anchor="middle" style="font-size:11px;fill:var(--ink);font-weight:500">'
                            + lab + '</text>'
                        : '');
            });
            out += '<text class="lane-l" x="0" y="' + (rq0 + 11) + '">' + loc('ses.mainSessionRequests', '主 session 請求') + '</text><text class="lane-s" x="0" y="' + (rq0 + 25) + '">'
                + loc('ses.nTimesColorModel', '{n} 次，顏色 = model', { n: m.ticks.length }) + '</text>';
            m.ticks.forEach(function (q) {
                out += '<rect class="rq" x="' + f1(X(q.t) - 0.75) + '" y="' + rq0 + '" width="1.5" height="' + rqH + '" style="fill:var(--m-' + q.family + ')"/>';
            });
            // The reading under the pointer: a column per point (at most 240, the
            // peak kept), from halfway to the one before to halfway to the next.
            var hp = downsample(m.points, 240);
            hp.forEach(function (p, i) {
                var x = X(p.t), a = i ? (X(hp[i - 1].t) + x) / 2 : G, b = i + 1 < hp.length ? (x + X(hp[i + 1].t)) / 2 : W - R;
                var g = segAt(p.t);
                out += '<rect class="hitc" x="' + f1(a) + '" y="' + sl + '" width="' + f1(Math.max(b - a, 1)) + '" height="' + (rq0 + rqH - sl) + '"'
                    + (g ? ' data-hist="' + esc(g.stage) + '"' : '') + '><title>'
                    + esc((g ? g.stage : '—') + ' · ' + stamp(p.t) + ' · context ' + comma(p.y) + ' tokens'
                        + (p.model ? ' · ' + String(p.model).replace(/^claude-/, '') : '')
                        + (g && isFinite(g.usd) && g.usd ? ' · ' + loc('ses.thisStageCost', '這段 stage {v}', { v: usd(g.usd) + estMark(g) }) : '')) + '</title></rect>';
            });
            // The returns go over the reading columns, so each keeps its own title.
            var retRoom = labelRoom();
            m.rets.forEach(function (q) {
                var x = X(q.t), y = Yc(yAt(q.t));
                var lab = loc('ses.plusChars', '+{c} 字元', { c: q.chars >= 1000 ? (q.chars / 1000).toFixed(1) + 'k' : q.chars }), lw = textW(lab, 10.5);
                // It ends 9px left of its mark, unless that would run into the
                // token ticks left of G: then it starts 9px right of it instead.
                var right = x - 9 - lw < G + 2, lx = right ? x + 9 : x - 9;
                out += '<path d="M' + f1(x) + ' ' + f1(y - 6) + ' ' + f1(x + 6) + ' ' + f1(y) + ' ' + f1(x) + ' ' + f1(y + 6) + ' ' + f1(x - 6) + ' ' + f1(y)
                    + 'Z" style="fill:var(--ink);stroke:var(--panel);stroke-width:2"><title>' + esc(lab) + '</title></path>'
                    + (retRoom(right ? lx : lx - lw, right ? lx + lw : lx)
                        ? '<text x="' + f1(lx) + '" y="' + f1(y - 9) + '"' + (right ? '' : ' text-anchor="end"')
                            + ' style="font-size:10.5px;fill:var(--ink2)">' + lab + '</text>'
                        : '');
            });
            out += '<line class="base" x1="0" x2="' + (W - R) + '" y1="' + (d0 - 10) + '" y2="' + (d0 - 10) + '"/>';
            if (!shown.length) out += '<text class="lane-s" x="' + G + '" y="' + (d0 + 16) + '">' + loc('ses.noAgentsDispatched', '這個 session 沒有派出 agent 或 workflow') + '</text>';
            shown.forEach(function (b, i) {
                var y = d0 + i * RH, ok = isFinite(b.from) && isFinite(b.to);
                var x0 = ok ? X(b.from) : G, x1 = ok ? Math.max(X(b.to), x0 + 2) : G + 2;
                var name = (b.kind === 'wf' ? (closed[b.key] ? '▸ ' : '▾ ') : '') + b.label;
                out += '<text class="mono" x="' + (b.kind === 'kid' ? 14 : 0) + '" y="' + (y + 17) + '" style="font-size:11.5px;fill:var(--'
                    + (b.kind === 'kid' ? 'ink2' : 'ink') + ')' + (b.kind === 'wf' ? ';font-weight:600' : '') + '">'
                    + esc(name.length > 21 ? name.slice(0, 20) + '…' : name) + '</text>'
                    + (b.kind === 'wf'
                        ? '<rect x="' + f1(x0) + '" y="' + (y + 4) + '" width="' + f1(x1 - x0) + '" height="18" rx="3" style="fill:var(--s-workflow);opacity:.2"/>'
                        : '<rect x="' + f1(x0) + '" y="' + (y + 7) + '" width="' + f1(x1 - x0) + '" height="12" rx="3" style="fill:var(--s-'
                        + (b.kind === 'kid' ? 'workflow' : 'agent') + ')"/>')
                    + barLabel(x0, x1, y + 17,
                        (b.kind === 'wf' ? 'workflow · ' + loc('ses.nAgents', '{n} 個 agent', { n: b.n }) + ' · ' : String(b.model || '—').replace(/^claude-/, '') + ' · ')
                        + tokens(b.tokens) + ' tok · ' + cents(b.cents) + estMark(b)
                        + (b.ret !== null && b.ret !== undefined ? ' · ' + loc('ses.returnedChars', '回傳 {n} 字元', { n: comma(b.ret) }) : ''))
                    + '<line class="gridl" x1="0" x2="' + (W - R) + '" y1="' + (y + RH) + '" y2="' + (y + RH) + '"/>'
                    + (b.kind === 'wf' ? '<rect class="wf-toggle" data-wf="' + esc(b.key) + '" x="0" y="' + y + '" width="' + (W - R)
                        + '" height="' + RH + '"><title>' + loc('ses.clickToggle', '點一下收合或展開') + '</title></rect>' : '');
            });
            return out + '</svg>';
        }
        // Stage by model, each of the five token kinds with its own dollars, from
        // the session's `days` — the same rows the home page's bars add up.
        function costModel(days) {
            var cell = function () {
                var zero = function () { var o = {}; KIND_KEYS.forEach(function (k) { o[k] = 0; }); return o; };
                return { tokens: zero(), cost: zero(), usd: 0, estimated: false };
            };
            var add = function (a, r) {
                var t = r.tokens || {}, c = r.cost || {};
                KIND_KEYS.forEach(function (k) { a.tokens[k] += t[k] || 0; a.cost[k] += c[k] || 0; });
                a.usd += r.usd || 0;
                if (r.estimated && r.usd) a.estimated = true;
            };
            var by = {}, order = [], out = { stages: [], main: cell(), agent: cell(), total: cell() };
            (days || []).forEach(function (r) {
                var sk = r.stage || 'none', mk = r.model || '—';
                if (!by[sk]) { by[sk] = { sub: cell(), models: {} }; order.push(sk); }
                if (!by[sk].models[mk]) by[sk].models[mk] = cell();
                add(by[sk].sub, r);
                add(by[sk].models[mk], r);
                add(r.who === 'main' ? out.main : out.agent, r);
                add(out.total, r);
            });
            var rank = function (k) { var i = ROUTE.indexOf(k); return i < 0 ? ROUTE.length : i; };
            out.stages = order.sort(function (a, b) { return rank(a) - rank(b); }).map(function (k) {
                return { stage: k, sub: by[k].sub, models: Object.keys(by[k].models).sort().map(function (mk) {
                    return { model: mk, cell: by[k].models[mk] };
                }) };
            });
            return out;
        }
        // One 主迴圈 row's arithmetic: how many of the session's own requests a
        // stage held, how many already carried `BUSY` tokens or more, what those
        // turns cost, and their share of the stage's own total (main and agents
        // alike — the same total the sub row's own last cell already prints).
        // `lp` is one row of `x.loops`, or `null` for a stage no main request
        // landed in; `usd()` already prints a dash for a zero dollar figure.
        // `foot` is the tfoot row: its label takes the first cell, as 主 session,
        // agent and 合計 do, and its share is of the whole session.
        function loopRow(lp, stageUsd, foot) {
            lp = lp || { turns: 0, over: 0, overUsd: 0, estimated: false };
            var pct = stageUsd ? lp.overUsd / stageUsd * 100 : 0;
            var z = lp.over === 0;
            return '<tr class="loop">' + (foot ? '<td><span class="lp">' + loc('ses.mainLoop', '主迴圈') + '</span></td><td></td>' : '<td></td><td><span class="lp">' + loc('ses.mainLoop', '主迴圈') + '</span></td>')
                + '<td colspan="' + KIND_KEYS.length * 2 + '"><div class="lf">'
                + '<span><b>' + lp.turns + '</b>' + loc('ses.turns', '回合') + '</span>'
                + '<span' + (z ? ' class="zero"' : '') + '><b>' + lp.over + '</b>' + loc('ses.turnsOver400k', '回合 ≥ 400k') + '</span>'
                + '<span' + (z ? ' class="zero"' : '') + '><b>' + usd(lp.overUsd) + (lp.overUsd ? estMark(lp) : '') + '</b>' + loc('ses.thoseTurns', '那些回合') + '</span>'
                + '<span' + (z ? ' class="zero"' : '') + '><i class="mini" style="display:inline-flex;width:72px;vertical-align:middle;margin-right:8px">'
                + '<span style="width:' + Math.round(pct) + '%"></span></i><b>' + Math.round(pct) + '%</b>' + (foot ? loc('ses.ofSession', '佔 session') : loc('ses.ofThisStage', '佔這一站')) + '</span>'
                + '</div></td><td class="r"></td></tr>';
        }
        function sumLoops(loops) {
            return (loops || []).reduce(function (a, r) {
                return { turns: a.turns + r.turns, over: a.over + r.over, overUsd: a.overUsd + r.overUsd, estimated: a.estimated || (r.estimated === true && r.overUsd > 0) };
            }, { turns: 0, over: 0, overUsd: 0, estimated: false });
        }
        // `x` is the session's detail (as everywhere else on this page — see
        // `sessionHeadHtml(s, x)`, `ctxSection(s, x)`) — optional, since the cost
        // tab answers before the detail script has loaded. With none, no 主迴圈
        // row is drawn: `x.loops` is what `lib/detail.js`'s `loopsOf` computed,
        // and there is nothing to show before it arrives.
        // 概覽's money, stage by stage: dollars from the session's `days` (main
        // and agent apart, the split costModel makes), time from the data file's
        // `stages`, requests from the detail's points placed by `seq`. `req` is
        // null until the detail is here.
        function stageShare(s, x) {
            var by = {}, order = [], total = 0;
            var row = function (k) {
                if (!by[k]) { by[k] = { stage: k, ms: null, usd: 0, main: 0, agent: 0, req: x ? 0 : null, estimated: false }; order.push(k); }
                return by[k];
            };
            (s.days || []).forEach(function (r) {
                var g = row(r.stage || 'none'), v = r.usd || 0;
                g.usd += v;
                total += v;
                if (r.who === 'main') g.main += v; else g.agent += v;
            });
            (s.stages || []).forEach(function (w) { var g = row(w.stage); if (w.estimated === true) g.estimated = true; g.ms = (g.ms || 0) + Math.max(w.to - w.from, 0); });
            if (x) {
                (x.points || []).forEach(function (pt) {
                    var k = 'none';
                    (x.seq || []).forEach(function (m) { if (m.at <= pt.t) k = m.stage; });
                    row(k).req++;
                });
            }
            var rank = function (k) { var i = ROUTE.indexOf(k); return i < 0 ? ROUTE.length : i; };
            var rows = order.sort(function (a, b) { return rank(a) - rank(b); }).map(function (k) { return by[k]; })
                .filter(function (g) { return g.usd || g.ms || g.req; });
            return { total: total, estimated: rows.some(function (g) { return g.estimated && g.usd; }), rows: rows };
        }
        // One bar split by stage in the timeline's stage tints, and the table under
        // it. A segment or a row is a toggle: `hi` is the stage the timeline marks.
        function costShareHtml(L, hi) {
            var pct = function (v) { return L.total ? Math.round(v / L.total * 1000) / 10 : 0; };
            var name = function (k) { return k === 'none' ? loc('ses.beforeStepOne', '第一步之前') : k; };
            var paid = L.rows.filter(function (g) { return g.usd > 0; });
            return '<div class="cshare" data-block="cost-share"><div class="h2">' + icon('spend') + loc('ses.costShareByStage', '各 stage 花費占比')
                + '<small>' + loc('ses.costShareHint', '合計 {t}；點一段或一列，時間線標出那個 stage', { t: usd(L.total) + estMark(L) }) + '</small></div>'
                + (paid.length ? '<div class="csbar" role="group" aria-label="' + loc('ses.costShareByStage', '各 stage 花費占比') + '">' + paid.map(function (g) {
                    var p = pct(g.usd), on = hi === g.stage;
                    return '<button type="button" class="csseg' + (on ? ' on' : '') + '" data-hist="' + esc(g.stage) + '" aria-pressed="' + on + '"'
                        + ' title="' + esc(name(g.stage) + ' ' + usd(g.usd, true) + estMark(g) + ' · ' + p + '%') + '" style="flex:' + g.usd + ' 1 0;background:'
                        + colorOf('stage', g.stage) + '">' + (p >= 9 ? '<span>' + esc(name(g.stage)) + '</span><b>' + usd(g.usd, true) + estMark(g) + ' · ' + p + '%</b>' : '')
                        + '</button>';
                }).join('') + '</div>' : '<p class="tally">' + loc('ses.noDailyCost', '這個 session 沒有按日的花費') + '</p>')
                + '<div class="tbl-wrap"><table class="t cstbl"><thead><tr><th>stage</th><th class="r">' + loc('ses.thTime', '時間') + '</th><th class="r">' + loc('ses.thCost', '花費') + '</th><th class="r">' + loc('ses.thShare', '占比') + '</th>'
                + '<th>' + loc('ses.thMainVsAgent', '主 session / agent') + '</th><th class="r">' + loc('ses.thRequests', '請求') + '</th></tr></thead><tbody>' + L.rows.map(function (g) {
                    var on = hi === g.stage;
                    return '<tr class="csrow' + (on ? ' on' : '') + '" data-hist="' + esc(g.stage) + '" tabindex="0" aria-pressed="' + on + '">'
                        + '<td><span class="pchip"><i class="sw" style="background:' + colorOf('stage', g.stage) + '"></i>' + esc(name(g.stage)) + '</span></td>'
                        + '<td class="r muted">' + (g.ms === null ? '—' : mins(g.ms)) + '</td><td class="r">' + usd(g.usd) + estMark(g) + '</td>'
                        + '<td class="r muted">' + (g.usd ? pct(g.usd) + '%' : '—') + '</td>'
                        + '<td><span class="csplit"' + (g.usd ? '' : ' hidden') + '><i style="flex:' + g.main + ' 1 0;background:var(--s-main)"></i>'
                        + '<i style="flex:' + g.agent + ' 1 0;background:var(--s-agent)"></i></span>'
                        + '<span class="muted">' + usd(g.main) + ' / ' + usd(g.agent) + estMark(g) + '</span></td>'
                        + '<td class="r muted">' + (g.req === null ? '—' : g.req) + '</td></tr>';
                }).join('') + '</tbody></table></div></div>';
        }
        // 派工's tie to that bar: each stage's agent dollars, a link back to 概覽
        // with that stage marked.
        // One bar per stage, its length the stage's agent dollars against the
        // largest; a bar is the same toggle as 概覽's, `hi` the stage it marks.
        function dispatchStagesHtml(L, id, hi) {
            var paid = L.rows.filter(function (g) { return g.agent > 0; });
            if (!paid.length) return '';
            var max = Math.max.apply(null, paid.map(function (g) { return g.agent; }));
            var sum = paid.reduce(function (a, g) { return a + g.agent; }, 0);
            return '<div class="dstg" data-block="dispatch-stages"><div class="dxh">' + loc('ses.dispatchCostByStage', '派工花費，依 stage') + ' <small>' + loc('ses.totalV', '合計 {v}', { v: usd(sum) + estMark({ estimated: paid.some(function (g) { return g.estimated; }) }) }) + '</small></div>'
                + paid.map(function (g) {
                    var nm = g.stage === 'none' ? loc('ses.beforeStepOne', '第一步之前') : g.stage, on = hi === g.stage;
                    return '<a class="dsrow' + (on ? ' on' : '') + '" href="' + sessionHash(id) + '" data-hist="' + esc(g.stage) + '" aria-pressed="' + on + '"'
                        + ' title="' + esc(loc('ses.dispatchOfShare', '{nm} 派工 {v} · 占派工 {p}%', { nm: nm, v: usd(g.agent) + estMark(g), p: Math.round(g.agent / sum * 1000) / 10 })) + '">'
                        + '<span class="dsl">' + esc(nm) + '</span><span class="dst"><i style="width:' + (g.agent / max * 88).toFixed(1)
                        + '%;background:' + colorOf('stage', g.stage) + '"></i><b>' + usd(g.agent, true) + estMark(g) + '</b></span></a>';
                }).join('') + '</div>';
        }
        function costHtml(m, x) {
            var notes = w.FK_KINDS ? w.FK_KINDS.notes(K.S().prices) : {};
            var cells = function (a, cls) {
                return KIND_KEYS.map(function (k) {
                    return '<td class="r muted">' + tokens(a.tokens[k]) + '</td><td class="r">' + usd(a.cost[k]) + (a.cost[k] ? estMark(a) : '') + '</td>';
                }).join('') + '<td class="r' + (cls ? ' ' + cls : '') + '">' + usd(a.usd) + estMark(a) + '</td>';
            };
            var share = function (v) { return m.total.usd ? Math.round(v / m.total.usd * 1000) / 10 + '%' : '—'; };
            var allTok = KIND_KEYS.reduce(function (n, k) { return n + m.total.tokens[k]; }, 0);
            var loops = x && Array.isArray(x.loops) ? x.loops : null;
            var loopBy = {};
            (loops || []).forEach(function (r) { loopBy[r.stage === null ? 'none' : r.stage] = r; });
            return '<div class="sumline"><div>' + loc('ses.totalCost', '合計花費') + '<b>' + usd(m.total.usd) + estMark(m.total) + '</b></div><div>' + loc('ses.mainSession', '主 session') + '<b>' + usd(m.main.usd) + estMark(m.main) + '</b></div>'
                + '<div>' + loc('ses.dispatchAgentWorkflow', '派工（agent + workflow）') + '<b>' + usd(m.agent.usd) + estMark(m.agent) + '</b></div><div>' + loc('ses.outputShareOfCost', 'output 佔花費') + '<b>' + share(m.total.cost.output) + '</b></div>'
                + '<div>' + loc('ses.cacheReadShareOfTokens', 'cache read 佔 token') + '<b>' + (allTok ? Math.round(m.total.tokens.cacheRead / allTok * 1000) / 10 + '%' : '—') + '</b></div></div>'
                + '<div class="h2">stage × model <small>' + loc('ses.stageModelHint', 'token 與各自的 USD；stage 列是小計') + '</small></div>'
                + '<div class="tbl-wrap"><table class="t"><thead><tr><th rowspan="2">stage</th><th rowspan="2">' + loc('ses.modelOfSession', 'model · 佔 session') + '</th>'
                + KIND_KEYS.map(function (k) { return '<th colspan="2"' + (notes[k] ? ' title="' + esc(notes[k]) + '"' : '') + '><i class="sw" style="background:var(' + KIND_COLOR[k] + ')"></i> ' + esc(KIND_LABEL[k]) + '</th>'; }).join('')
                + '<th rowspan="2" class="r">USD</th></tr><tr>'
                + KIND_KEYS.map(function () { return '<th class="r">token</th><th class="r">USD</th>'; }).join('') + '</tr></thead><tbody>'
                + m.stages.map(function (g) {
                    return '<tr class="sub"><td><span class="pchip"><i class="sw" style="background:' + colorOf('stage', g.stage) + '"></i>'
                        + esc(g.stage === 'none' ? loc('ses.beforeStepOne', '第一步之前') : g.stage) + '</span></td><td class="muted">' + share(g.sub.usd) + '</td>'
                        + cells(g.sub, '') + '</tr>' + g.models.map(function (mm) {
                            return '<tr class="child"><td></td><td><span class="pchip"><i class="sw" style="background:var(--m-' + family(mm.model)
                                + ')"></i>' + esc(String(mm.model).replace(/^claude-/, '')) + '</span></td>' + cells(mm.cell, '') + '</tr>';
                        }).join('') + (loops ? loopRow(loopBy[g.stage], g.sub.usd) : '');
                }).join('') + '</tbody><tfoot>'
                + '<tr><td>' + loc('ses.mainSession', '主 session') + '</td><td></td>' + cells(m.main, 'total') + '</tr>'
                + '<tr><td>agent</td><td></td>' + cells(m.agent, 'total') + '</tr>'
                + '<tr><td>' + loc('ses.total', '合計') + '</td><td></td>' + cells(m.total, 'total') + '</tr>'
                + (loops ? loopRow(sumLoops(loops), m.total.usd, true) : '') + '</tfoot></table></div>';
        }
        function sessionHeadHtml(s, x) {
            var t = sessionTotals(s), m = x ? timelineModel(x) : null, agentUsd = costModel(s.days).agent.usd;
            var waited = m ? m.waits.reduce(function (n, w) { return n + w.ms; }, 0) : t.wait;
            var wakes = x && typeof x.wakes === 'number' ? x.wakes : null;
            return '<div class="readouts">'
                + roHtml(loc('ses.elapsed', '歷時'), m && m.t1 > m.t0 ? mins(m.t1 - m.t0) : '—', 'active ' + hours(t.active))
                + roHtml('<i class="hatchsw"></i>' + loc('ses.waitingForYou', '等你回答'), mins(waited), m ? loc('ses.nGates', '{n} 次 gate', { n: m.waits.length }) : loc('ses.loadingDetail', '讀取細節…'))
                + roHtml(loc('ses.cost', '花費'), usd(t.usd, true) + estMark(t), t.usd ? (quotaPct(t.usd) ? quotaPct(t.usd) + ' · ' : '') + loc('ses.dispatchShare', '派工佔 {p}%', { p: Math.round(agentUsd / t.usd * 100) }) : loc('ses.noDailyCost', '這個 session 沒有按日的花費'))
                + roHtml('token', tokens(t.tokens), x ? loc('ses.nMainSessionRequests', '{n} 次主 session 請求', { n: x.requests }) : '')
                + roHtml(loc('ses.dispatch', '派工'), x ? x.rows.length + '<span class="u">agent</span>' : '—', x ? agentCounts(x, s) + loc('ses.nWorkflows', '{n} 個 workflow', { n: x.runs.length }) : '')
                + roHtml(loc('ses.wakes', '叫醒'), wakes === null ? '—' : wakes + '<span class="u">' + loc('ses.times', '次') + '</span>', wakes === null ? '' : loc('ses.dispatchWokeMain', '派工回報叫醒主 session'))
                + roHtml(loc('ses.contextPeak', 'context 峰值'), x ? tokens(x.peak) : '—', '')
                + '</div>';
        }
        // Six tabs by what a reader comes for: 概覽 is the session's story —
        // time, context and money stage by stage — 派工 and 事件 are its two
        // long lists, 對話 is what was said, 計畫 the plan the session claimed and
        // 關卡 the report its stage waits at a gate with. `cost` is still in TABS so an old `/cost` link parses; it
        // opens 概覽, which now holds everything that tab showed. `talk` is the
        // 對話 tab's turn count, and nothing until its first page is in.
        var TAB_SHOWN = ['timeline', 'dispatch', 'events', 'talk', 'plan', 'gate'];
        function tabsHtml(s, tab, x, talk) {
            var label = { timeline: loc('ses.tabOverview', '概覽'), dispatch: loc('ses.tabDispatch', '派工'), events: loc('ses.tabEvents', '事件'), talk: loc('ses.tabTalk', '對話'), plan: loc('ses.tabPlan', '計畫'), gate: loc('ses.tabGate', '關卡') };
            // plan counts the newest claimed plan's tasks; plan wears the gate's hatch
            // at the plan stage with tasks to show, gate while `gateAt` says it waits.
            var plan = x && x.tasks && x.tasks.length ? x.tasks[x.tasks.length - 1] : null;
            var n = { dispatch: x ? x.rows.length : null, events: x ? x.events.length : null, talk: talk, plan: plan && plan.tasks.length ? plan.tasks.length : null };
            var run = x ? x.rows.filter(function (r) { return agentState(x, r, s) === 'running'; }).length : 0;
            if (tab === 'cost') tab = 'timeline';
            return '<nav class="tabs" data-block="session-tabs" aria-label="' + loc('ses.sessionView', 'session 檢視') + '">' + TAB_SHOWN.map(function (k) {
                return '<a href="' + sessionHash(s.id, k) + '"' + (k === tab ? ' class="on" aria-current="page"' : '') + '>' + label[k]
                    + (n[k] !== null && n[k] !== undefined ? '<small>' + n[k] + '</small>' : '')
                    + (k === 'dispatch' && run ? '<i class="dot live" title="' + loc('ses.nAgentsRunning', '{n} 個 agent running', { n: run }) + '"></i>' : '')
                    + ((k === 'plan' && s.stage === 'plan' && n.plan) || (k === 'gate' && gateAt(s, x && x.gate)) ? '<i class="hatchsw pv-tabgate" aria-label="' + loc('ses.tabPlanGate', '等你回答') + '"></i>' : '') + '</a>';
            }).join('') + '</nav>';
        }

        // The 對話 tab. The turns come from `station/talk/<id>` (lib/conversation.js
        // behind scripts/station.js), 100 at a time, and the caller keeps them as
        // `{ turns, total, counts, skipped, state }`; everything here is a function
        // of that, so a redraw fetches nothing. `state` is '' when there is nothing
        // to say, `loading`, `failed`, `missing` (the transcript is not on this
        // machine) or `static` (a written copy has no server to ask).
        var TALK_PAGE = 100;
        // `MM-DD HH:MM` in the reader's own time zone.
        function talkStamp(at) {
            var ms = typeof at === 'string' ? Date.parse(at) : NaN;
            if (!isFinite(ms)) return '<time class="tm">—</time>';
            var d = new Date(ms), two = function (n) { return String(n).padStart(2, '0'); };
            return '<time class="tm" datetime="' + esc(at) + '">' + two(d.getMonth() + 1) + '-' + two(d.getDate()) + ' ' + two(d.getHours()) + ':' + two(d.getMinutes()) + '</time>';
        }
        // A turn's text as typed: line breaks kept (`.t` is pre-wrap) and no markdown
        // converted. The one exception is a run between two ``` lines, which is a
        // monospace block with the fence lines dropped; a fence never closed runs to
        // the end of the text.
        function talkBody(text) {
            var out = [], run = [], code = null;
            var flush = function () {
                if (code !== null) {
                    out.push('<pre class="code"' + (code ? ' aria-label="' + loc('ses.talkCode', '程式碼區塊') + ' ' + esc(code) + '"' : '') + '>' + esc(run.join('\n')) + '</pre>');
                } else {
                    var s = run.join('\n').replace(/^\n+|\n+$/g, '');
                    if (s) out.push('<div class="t">' + esc(s) + '</div>');
                }
                run = [];
            };
            String(text === null || text === undefined ? '' : text).split(/\r?\n/).forEach(function (line) {
                if (code === null && /^\s*```/.test(line)) {
                    flush();
                    code = line.replace(/^\s*```/, '').trim().split(/\s+/)[0];
                } else if (code !== null && /^\s*```\s*$/.test(line)) {
                    flush();
                    code = null;
                } else {
                    run.push(line);
                }
            });
            flush();
            return out.join('');
        }
        // The line over the turns: the whole conversation's counts, then the lines
        // the read left out, biggest first, a kind with none left unlisted.
        function talkCounts(h) {
            var b = function (n) { return '<b>' + comma(n) + '</b>'; };
            var left = Object.keys(h.skipped || {}).map(function (k, i) { return { k: k, n: h.skipped[k], i: i }; })
                .filter(function (e) { return e.n > 0; })
                .sort(function (a, c) { return c.n - a.n || a.i - c.i; });
            var parts = [
                loc('ses.talkUsers', '使用者 {n} 輪', { n: b(h.counts.user) }),
                loc('ses.talkClaudes', 'Claude {n} 輪', { n: b(h.counts.claude) }),
                loc('ses.talkCompacts', '{k} {n} 次', { k: '<code>compact</code>', n: b(h.counts.compact) }),
            ];
            if (left.length) {
                parts.push('<span class="out" title="' + loc('ses.talkSkipHint', 'transcript 裡沒有列進對話的行，依種類計數；0 筆的種類不列出') + '">'
                    + loc('ses.talkSkipped', '略過 {list}', { list: left.map(function (e) { return '<code>' + esc(e.k) + '</code> ' + b(e.n); }).join(loc('ses.talkListSep', '、')) }) + '</span>');
            }
            return '<p class="tkc" data-block="talk-counts">' + parts.join('<i class="sep">·</i>') + '</p>';
        }
        // One user turn, one Claude turn, or the interruption line.
        function talkRow(t) {
            if (t.kind === 'act') return w.FK_TACT ? '<li class="tk-act">' + w.FK_TACT.html(t, '', 'talk-act-' + String(t.at)) + '</li>' : '';
            if (t.kind === 'interrupt') {
                return '<li class="tk-int" data-block="talk-turn-interrupt">' + talkStamp(t.at) + '<span class="who">' + loc('ses.talkWhoInt', '中斷') + '</span>'
                    + '<div class="tx"><div class="t">' + loc('ses.talkIntText', '使用者中斷了 Claude 這一輪') + '<code>' + esc(t.text) + '</code></div></div></li>';
            }
            var user = t.kind === 'user';
            return '<li class="' + (user ? 'tk-user' : 'tk-claude') + '" data-block="talk-turn-' + (user ? 'user' : 'claude') + '">' + talkStamp(t.at)
                + '<span class="who">' + (user ? loc('ses.talkWhoUser', '使用者') : 'Claude') + '</span><div class="tx">' + talkBody(t.text) + '</div></li>';
        }
        // A compaction and the summary right after it are one block: the break
        // with its time, trigger and the context it compacted, the summary shut
        // until opened. `c` is the compact turn, `sum` the summary turn, either
        // may be missing — a summary not loaded yet draws the break alone — and
        // `i` is where the block starts, which a redraw finds an opened one by.
        function talkCut(c, sum, i, extra) {
            var meta = [];
            if (c && c.trigger) meta.push('<code>' + esc(c.trigger) + '</code>');
            if (c && c.preTokens !== null && c.preTokens !== undefined) meta.push(loc('ses.talkPreTokens', '壓縮前 context {n}', { n: '<b>' + tokens(c.preTokens) + '</b>' }));
            var head = '<code class="ck">compact</code><span class="cm">' + meta.join('<i class="sep">·</i>') + '</span>' + (extra || '') + '<i class="ln" aria-hidden="true"></i>';
            var at = talkStamp((c || sum).at);
            if (!sum) return '<li class="tk-cut" data-block="talk-compact">' + at + '<div class="cut"><div class="cutbar">' + head + '</div></div></li>';
            return '<li class="tk-cut" data-block="talk-compact">' + at + '<details class="cut" data-key="talk-cut-' + i + '"><summary>' + head
                + '<span class="ct"><span class="o">' + loc('ses.talkSumOpen', '看摘要') + '</span><span class="c">' + loc('ses.talkSumShut', '收起摘要') + '</span></span></summary>'
                + '<div class="sum"><div class="sl">' + loc('ses.talkSumNote', 'Claude Code 在壓縮時寫的摘要，之後的對話從這段接下去') + '</div>'
                + '<div class="t">' + esc(sum.text) + '</div></div></details></li>';
        }
        function talkRows(turns, spend, all) {
            // Break records from the server (lib/conversation.js `spendOf`) are
            // drawn by assets/station/spend-talk.js, with this file's own blocks.
            if (w.FK_TALK && spend && spend.marks && spend.marks.length) {
                return w.FK_TALK.rows(turns, spend, all, { cut: talkCut, row: talkRow, stamp: talkStamp });
            }
            var out = [];
            for (var i = 0; i < turns.length; i++) {
                var t = turns[i];
                if (t.kind === 'compact') {
                    var next = turns[i + 1];
                    if (next && next.kind === 'summary') {
                        out.push(talkCut(t, next, i));
                        i += 1;
                    } else {
                        out.push(talkCut(t, null, i));
                    }
                } else if (t.kind === 'summary') {
                    out.push(talkCut(null, t, i));
                } else {
                    out.push(talkRow(t));
                }
            }
            return out.join('');
        }
        function talkNote(title, why) {
            return '<div class="emptyd tkmiss" data-block="talk-missing"><p class="et">' + title + '</p><p class="es">' + why + '</p></div>';
        }
        // `held` is what the caller kept for this session, or nothing yet.
        function talkHtml(id, held) {
            var h = held || { turns: [], total: null, state: '' };
            var loading = loc('ses.talkLoading', '讀取中…'), failed = loc('ses.talkFailed', '讀不到對話'), retry = loc('ses.talkRetry', '重試');
            var btn = function (text) { return '<button type="button" class="ctl" data-talk="' + esc(id) + '">' + text + '</button>'; };
            if (h.state === 'missing') {
                return talkNote(loc('ses.talkMissing', '這台機器上已經沒有這個 session 的 transcript'),
                    loc('ses.talkMissingWhy', '對話是直接從 transcript 讀出來的，檔案不在就沒有內容可以列。之後的 session 想留久一點，把 {file} 的 {key} 調大。',
                        { file: '<code>~/.claude/settings.json</code>', key: '<code>cleanupPeriodDays</code>' }));
            }
            if (h.state === 'static') {
                return talkNote(loc('ses.talkStatic', '要從 serve 開的頁面才讀得到對話'),
                    loc('ses.talkStaticWhy', '對話不寫進這份檔案，全文只留在這台機器上，由 serve 讀 transcript 回答。用 {cmd} 開站，再回到這個分頁。',
                        { cmd: '<code>node scripts/station.js serve --open</code>' }));
            }
            if (h.total === null) {
                return h.state === 'failed'
                    ? '<div class="tkmore" data-block="talk-more"><span>' + failed + '</span>' + btn(retry) + '</div>'
                    : '<p class="tally">' + loading + '</p>';
            }
            var n = h.turns.length;
            var tail = h.state === 'loading' ? '<span>' + loading + '</span>'
                : h.state === 'failed' ? '<span>' + failed + '</span>' + btn(retry)
                    : n < h.total ? btn(loc('ses.talkMore', '再載入 {n} 輪', { n: TALK_PAGE })) : '';
            if (h.total === 0) return talkCounts(h) + '<p class="tally">' + loc('ses.talkEmpty', 'transcript 裡沒有可列的對話') + '</p>';
            return talkCounts(h) + (w.FK_TALK ? w.FK_TALK.line(h.spend) : '') + '<ol class="tk" aria-label="' + loc('ses.talkList', '對話，依時間順序') + '">' + talkRows(h.turns, h.spend, n >= h.total) + '</ol>'
                + '<div class="tkmore" data-block="talk-more"><span>' + loc('ses.talkShown', '已顯示 {n} / {m} 輪', { n: '<b>' + comma(n) + '</b>', m: '<b>' + comma(h.total) + '</b>' })
                + '</span>' + tail + '</div>';
        }
        // Beside the session's state on its page, served: `即時` and how long ago the
        // page last re-read while the session is live, the moment it stopped once
        // it is not.
        function liveTag(live, polledMs, nowMs) {
            return live
                ? '<span class="livetag" title="' + esc(loc('live.lastUpdatedHint', '最後一次更新 {t}；session 還活著，這頁每 3 秒重拉一次，結束就停', { t: clockSec(polledMs) })) + '"><b>' + loc('live.live', '即時') + '</b>・<span data-ago>'
                    + agoText(Math.round((nowMs - polledMs) / 1000)) + '</span></span>'
                : '<span class="livetag off" title="' + esc(loc('live.stoppedHint', 'session 結束後不再重拉')) + '"><b>' + loc('live.stoppedUpdating', '已停止更新') + '</b>・' + loc('live.lastAt', '最後一次 {t}', { t: clockSec(polledMs) }) + '</span>';
        }
        // The route as a rail: a stop per stage, each one behind the current stage
        // timed by the registry's clock for it (`stages[].from` and `to`), the
        // current one ringed and — while `live` — counting up from when it was
        // entered. Not live, it keeps the time the stage had when the session stopped.
        function railHtml(s, live, nowMs) {
            var route = s.route || [], at = route.indexOf(s.stage), win = {};
            (s.stages || []).forEach(function (w) { win[w.stage] = w; });
            return '<ol class="rail" style="--n:' + route.length + '" aria-label="route ' + esc(route.join(' → '))
                + (at >= 0 ? esc(loc('live.nowAtStopOf', '；現在在 {stage}，第 {n} 站，共 {total} 站', { stage: s.stage, n: at + 1, total: route.length })) : '') + '">'
                + route.map(function (k, i) {
                    var w = win[k], cls = at < 0 || i > at ? 'todo' : i < at ? 'done' : 'now' + (live ? ' live' : ''), tm = '';
                    if (i < at && w) tm = '<span class="tm">' + mins(w.to - w.from) + '</span>';
                    else if (i === at && w) {
                        tm = '<span class="tm">' + (live ? tk(-w.from / 1000, 1, true, nowMs / 1000) : mins(w.to - w.from)) + '</span>'
                            + '<span class="since">' + clock(w.from) + (live ? loc('live.enteredStop', ' 進站') : loc('live.enteredStopStopped', ' 進站，停在這站')) + '</span>';
                    }
                    return '<li class="' + cls + '" style="--c:var(--st-' + esc(k) + ')"' + (i === at ? ' aria-current="step"' : '') + '>'
                        + '<span class="pt"></span><span class="nm">' + esc(k) + '</span>' + tm + '</li>';
                }).join('') + '</ol>';
        }
        return { clock: clock, timelineModel: timelineModel, textW: textW, labelRoom: labelRoom, timelineSvg: timelineSvg, costModel: costModel, loopRow: loopRow, sumLoops: sumLoops, stageShare: stageShare, costShareHtml: costShareHtml, dispatchStagesHtml: dispatchStagesHtml, costHtml: costHtml, sessionHeadHtml: sessionHeadHtml, tabsHtml: tabsHtml, talkStamp: talkStamp, talkBody: talkBody, talkCounts: talkCounts, talkRow: talkRow, talkCut: talkCut, talkRows: talkRows, talkNote: talkNote, talkHtml: talkHtml, liveTag: liveTag, railHtml: railHtml };
    }
    var api = { make: make };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_SBODY = api;
}(typeof window !== 'undefined' ? window : null));
