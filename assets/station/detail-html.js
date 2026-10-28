// 詳情面板的純函式 (FK_DETAIL): moved out of station.js (station-52).
// station.js calls make(K) once, on first use, handing it the helpers these
// bodies name; everything here only computes or builds strings.
(function (w) {
    'use strict';
    function make(K) {
        // One alias per name K carries, so the bodies below moved verbatim.
        var loc = K.loc,
            esc = K.esc,
            tokens = K.tokens,
            stamp = K.stamp,
            mins = K.mins,
            family = K.family,
            sumLoops = K.sumLoops,
            todoSpot = K.todoSpot,
            riseTodo = K.riseTodo,
            backTodo = K.backTodo,
            STAGE_C = K.STAGE_C;
        // ' 估' after a dollar figure whose `g.estimated` is truthy: a stage, a day, a dispatch group or an aggregate
        // that carries a request priced from a family fallback. A session's own total counts ids with `totalSuffix`.
        function estMark(g) { return g && g.estimated ? ' ' + loc('det.estShort', '估') : ''; }
        function totalSuffix(s) {
            return (s.unpriced && s.unpriced.length ? ' (' + s.unpriced.length + ' unpriced)' : '')
                + (s.estimated && s.estimated.length ? ' (' + s.estimated.length + ' ' + loc('det.estShort', '估') + ')' : '');
        }
        function secOpen(id, title, count, open) {
            return '<details class="sec" id="' + id + '"' + (open.indexOf(id) >= 0 ? ' open' : '') + '><summary>'
                + '<span class="t">' + title + '</span> <span class="cnt">' + count + '</span></summary>';
        }
        // What git saw this session write, under its claims and marked weak: git
        // names no writer, so none of it lights a clash. Nothing for none.
        function seenHtml(seen) {
            if (!seen || !seen.length) return '';
            return '<p class="mute" style="font-size:12px">' + loc('det.seenWeak', 'seen（弱：git 看到，沒有經過 hook）') + '</p>'
                + '<div class="claims">' + seen.map(function (p) {
                    return '<div title="' + esc(p) + '">' + esc(p) + '</div>';
                }).join('') + '</div>';
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
                out += '<circle class="hit" r="4" cx="' + X(p.t) + '" cy="' + Y(p.y) + '"><title>' + loc('det.turnN', '回合 {n}', { n: p.n }) + ' · '
                    + stamp(p.t) + ' · ' + comma(p.y) + ' tokens</title></circle>';
            });
            out += '<text class="axis" x="' + L + '" y="' + (H - 4) + '">' + (o.elapsed ? '0m' : stamp(t0).slice(11)) + '</text>'
                + '<text class="axis" x="' + (W - R) + '" y="' + (H - 4) + '" text-anchor="end">'
                + (o.elapsed ? mins(t1 - t0) : stamp(t1).slice(11)) + '</text>';
            return out + '</svg>';
        }
        function riseText(r) {
            if (r.cause === 'self') return loc('det.selfOutputTokens', '{l}，輸出 {t} tokens', { l: r.self.label, t: comma(r.self.tok) });
            var top = r.top.map(function (x) { return loc('det.labelNChars', '{l} {n} 字元', { l: x.label, n: comma(x.chars) }); });
            return (top.join(loc('det.semicolon', '；')) || loc('det.noIncomingOutput', '沒有記到進來的輸出'))
                + (r.restN ? loc('det.andNMoreChars', '；另 {n} 項 {c} 字元', { n: r.restN, c: comma(r.restChars) }) : '');
        }
        function risesList(s, x) {
            if (!x.rises.length) return '<p class="tally">' + loc('det.noRises', '沒有上升') + '</p>';
            return '<ol class="rz" aria-label="' + loc('det.top5Rises', '最大的五次上升') + '">' + x.rises.map(function (r, i) {
                return '<li><span class="rzn">' + (i + 1) + '</span><div><div class="rzh"><span class="d">+' + tokens(r.dy)
                    + '</span><span class="w">' + loc('det.turnFromTo', '回合 {from}→{to}', { from: r.from, to: r.n }) + (isFinite(r.t) ? ' · ' + stamp(r.t).slice(11) : '')
                    + '</span><span class="w">' + (r.cause === 'self' ? loc('det.modelsOwnOutput', '模型自己的輸出') : loc('det.incomingNChars', '進來 {n} 字元', { n: comma(r.inChars) }))
                    + '</span></div><div class="rzm">' + esc(riseText(r)) + '</div>'
                    + todoSpot(riseTodo(s.id, r), r.cause === 'self' ? 'skills/fankeel/SKILL.md' : 'docs/90-agent/reference/station.md', s)
                    + '</div></li>';
            }).join('') + '</ol>';
        }
        // `bare` leaves the small chart and its key out: the 時間線 tab draws the
        // same curve in its timeline, and the rises listed here are numbered there.
        function ctxSection(s, x, bare) {
            var P = x.points;
            var step = niceStep(x.peak || 1);
            var dots = [];
            x.dispatches.forEach(function (d) {
                dots.push({ t: d.out, kind: 'out', text: loc('det.dispatchedColon', '派出 · {t}', { t: d.text }) });
                if (isFinite(d.back)) dots.push({ t: d.back, kind: 'back', text: loc('det.returnedColon', '回來 · {t}', { t: d.text }) });
            });
            var same = P.length + x.noTime === x.requests;
            return '<div class="srcline">' + loc('det.summariseByRequest', 'summarise() 的 byRequest：每個 request 的 input ＋ cache read ＋ cache write') + '</div>'
                + (P.length && !bare ? '<div class="cx">' + lineChart(P, {
                    W: 340, H: 170, t0: P[0].t, t1: P[P.length - 1].t, ymax: Math.ceil((x.peak || 1) / step) * step,
                    marks: x.marks, dots: dots, rises: x.rises,
                    label: loc('det.idContextNPointsPeak', '{id} 的 context，{n} 點，峰值 {peak}', { id: String(s.id).slice(0, 8), n: P.length, peak: tokens(x.peak) }),
                }) + '</div>' : '')
                + (bare ? '' : '<div class="key" aria-hidden="true"><span><i class="kl"></i>context / request</span>'
                    + '<span><i class="ko"></i>' + loc('det.dispatched', '派出') + '</span><span><i class="kb"></i>' + loc('det.returned', '回來') + '</span><span><i class="ks"></i>' + loc('det.stage', '階段') + '</span></div>')
                + '<p class="tally">' + loc('det.lineBPoints', '折線 <b>{n} 點</b>', { n: P.length }) + (x.noTime ? loc('det.plusNRequestsNoTime', ' ＋ {n} requests with no time', { n: x.noTime }) : '')
                + loc('det.equalsSummaryRequests', ' ＝ 摘要的 {n} requests', { n: x.requests }) + ' <span class="' + (same ? 'eq' : 'ne') + '">' + (same ? loc('det.consistent', '一致') : loc('det.inconsistent', '不一致'))
                + '</span>' + (P.length > 240 ? loc('det.downsampledOver240', ' · 超過 240 點，降取樣並保留峰值') : '')
                + loc('det.peakColon', ' · 峰值 {v}', { v: tokens(x.peak) }) + (x.peakN ? loc('det.turnParen', '（回合 {n}）', { n: x.peakN }) : '') + '</p>'
                + risesList(s, x);
        }
        function seqHtml(seq, backs, route, stage, active) {
            var bk = {};
            (backs || []).forEach(function (b) { bk[b.i] = true; });
            var out = (seq || []).map(function (m, i) {
                var b = bk[i];
                return (i ? '<span class="ar' + (b ? ' bk' : '') + '" aria-hidden="true">' + (b ? '↩' : '→') + '</span>' : '')
                    + '<span class="s' + (b ? ' bk' : '') + (m.source !== 'cmd' ? ' fb' : '') + '" role="listitem" title="'
                    + esc(m.stage + ' · ' + stamp(m.at) + ' · ' + (m.source === 'cmd' ? loc('det.taskJsCommand', 'task.js 指令') : m.source)) + '">'
                    + '<span class="i">' + (i + 1) + '</span><i class="dot" style="background:' + (STAGE_C[m.stage] || '#888')
                    + '"></i>' + esc(m.stage) + '</span>';
            }).join('');
            if (active) {
                (route || []).slice((route || []).indexOf(stage) + 1).forEach(function (n) {
                    out += '<span class="ar" aria-hidden="true">→</span><span class="s todo" role="listitem">' + esc(n) + '</span>';
                });
            }
            return '<div class="seq" role="list" aria-label="' + loc('det.stageOrderLabel', '階段移動次序') + '">' + out + '</div>';
        }
        function backBlock(s, b) {
            return '<div class="bkl"><div class="hd2"><span class="ar">↩</span> ' + esc(b.from) + ' → ' + esc(b.to) + ' <span class="mono">'
                + stamp(b.at) + ' · ' + loc('det.stayedFor', '{stage} 待了 {t}', { stage: esc(b.from), t: mins(b.at - b.since) }) + '</span></div>'
                + '<a class="lk" tabindex="0" data-goto="' + b.since + '" data-until="' + b.at + '">' + loc('det.rowsAboveInReplay', '過程還原裡它前面那幾列 ↓') + '</a>'
                + todoSpot(backTodo(s.id, b), 'skills/fankeel-build/SKILL.md', s)
                + '</div>';
        }
        function orderSection(s, x) {
            return seqHtml(x.seq, x.backs, s.route, s.stage, s.state === 'live')
                + x.backs.map(function (b) { return backBlock(s, b); }).join('')
                + '<p class="tally">' + loc('det.orderTakenFrom', '次序取 {src}；倒退 {n} 次', { src: x.seqSource === 'task.js' ? loc('det.realTaskJsCommands', 'transcript 裡真正執行的 task.js 指令')
                    : x.seqSource === 'moves' ? loc('det.movesNoCommands', 'moves（transcript 裡沒有 task.js 指令）')
                        : loc('det.clockNoMoves', 'clock（沒有指令也沒有 moves，看不出回頭）'), n: x.backtracks }) + '</p>';
        }
        // 分工: a short prose account of how the main loop divided dispatch, one
        // line per stage in the order `seq` first entered it. A dispatch's stage
        // is its `out` time run through the same rule as `lib/detail.js:390`'s
        // `stageWhen` — the last `seq` entry at or before it, or `task 開始前`
        // when there is none.
        function splitStage(seq, t) {
            var st = null;
            (seq || []).forEach(function (m) { if (m.at <= t) st = m.stage; });
            return st;
        }
        function splitCount(x) {
            var turns = sumLoops(x.loops).turns;
            return (x.loops && x.loops.length ? loc('det.mainLoopNTurns', '主迴圈 {n} 回合 · ', { n: turns }) : '') + loc('det.dispatchNTimes', '派工 {n} 次', { n: (x.dispatches || []).length });
        }
        function splitHtml(x) {
            var order = [], by = {};
            var row = function (st) {
                var k = st || loc('det.beforeTaskStart', 'task 開始前');
                if (!by[k]) { by[k] = { stage: k, turns: 0, single: 0, early: 0, multi: {}, wf: 0, wfN: 0, models: {} }; order.push(k); }
                return by[k];
            };
            var hasLoops = !!(x.loops && x.loops.length);
            (x.seq || []).forEach(function (s) { row(s.stage); });
            (x.loops || []).forEach(function (l) { row(l.stage).turns += l.turns; });
            (x.dispatches || []).forEach(function (d, i) {
                var r = row(splitStage(x.seq, d.out));
                var kids = (x.rows || []).filter(function (k) { return k.disp === i; });
                if (d.surface === 'workflow') { r.wf++; r.wfN += kids.length; }
                else if (d.surface === 'agents') r.multi[d.turn] = (r.multi[d.turn] || 0) + Math.max(1, kids.length);
                else r.single++;
                kids.forEach(function (k) { var f = family(k.model || k.alias); r.models[f] = (r.models[f] || 0) + 1; });
            });
            var singles = (x.dispatches || []).filter(function (d) { return d.surface === 'agent' && isFinite(d.out); })
                .sort(function (a, b) { return a.out - b.out; });
            for (var si = 1; si < singles.length; si++) {
                var p = singles[si - 1], q = singles[si];
                if (isFinite(p.back) && q.out < p.back && q.turn !== p.turn) row(splitStage(x.seq, q.out)).early++;
            }
            var lines = order.map(function (k) { return by[k]; })
                .filter(function (r) { return r.turns || r.single || Object.keys(r.multi).length || r.wf; })
                .map(function (r) {
                    var parts = [];
                    if (r.wf) parts.push(loc('det.workflowNTimesNAgents', 'Workflow {n} 次（{k} 個 agent）', { n: r.wf, k: r.wfN }));
                    var multiKeys = Object.keys(r.multi);
                    if (multiKeys.length) {
                        var multiTotal = multiKeys.reduce(function (a, t) { return a + r.multi[t]; }, 0);
                        parts.push(loc('det.concurrentInOneResponse', '同一回應並發 {n} 回（共 {t} 個）', { n: multiKeys.length, t: multiTotal }));
                    }
                    if (r.single) {
                        parts.push(loc('det.singleNTimes', '單發 {n} 次', { n: r.single }) + (r.single > 1 ? loc('det.eachOneTurn', '，各佔一個回合') : '')
                            + (r.early ? loc('det.nCouldHaveBeenOneCall', '，其中 {n} 次在前一次回來前就派出，本可一次發出', { n: r.early }) : ''));
                    }
                    var models = Object.keys(r.models).map(function (m) { return m + ' ×' + r.models[m]; }).join(loc('det.listSep', '、'));
                    return esc(r.stage) + ' — ' + (hasLoops ? loc('det.mainLoopNTurnsSemi', '主迴圈 {n} 回合；', { n: r.turns }) : '')
                        + (parts.length ? loc('det.dispatchColon', '派工：{p}', { p: parts.join(loc('det.listSep', '、')) }) + (models ? loc('det.semicolon', '；') + models : '') : loc('det.noDispatch', '沒有派工'));
                });
            if (!hasLoops) lines.push(loc('det.cacheHasNoPerStageTurns', '這份快取沒有逐站回合數（寫於 loops 欄位出現之前）'));
            var plans = (x.tasks || []).filter(function (p) { return !p.error; });
            plans.forEach(function (p) {
                var hinted = p.groups.filter(function (g) { return g.hint; });
                var none = p.groups.filter(function (g) { return !g.turns.length; });
                var one = p.groups.length - hinted.length - none.length;
                var bits = [];
                if (one) bits.push(loc('det.nGroupsOneTurn', '{n} 組各在一個回合內派出', { n: one }));
                if (none.length) bits.push(loc('det.nGroupsNoDispatch', '{n} 組沒有派工紀錄', { n: none.length }));
                if (hinted.length) {
                    bits.push(loc('det.nGroupsCouldBeOne', '{n} 組本可一次發出：', { n: hinted.length }) + hinted.map(function (g) {
                        return loc('det.gTaskTurns', 'G{g}（task {tasks}，分 {n} 個回合）', { g: g.g, tasks: g.tasks.join(loc('det.listSep', '、')), n: g.turns.length });
                    }).join(loc('det.listSep', '、')));
                }
                lines.push(loc('det.planTasksGroups', 'plan {p}：{n} 個 task 分 {g} 組；{bits}', { p: esc(String(p.plan).split('/').pop()), n: p.tasks.length, g: p.groups.length, bits: bits.join(loc('det.listSep', '、')) }));
            });
            if (!plans.length && (x.dispatches || []).length > 1) lines.push(loc('det.noTaskTableCannotTell', '這頁沒有任務表：其餘派工是否互不相依，無從判斷'));
            return lines.map(function (l) { return '<p class="tally">' + l + '</p>'; }).join('');
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
            list = (list || []).filter(function (p) { return !p.error; });
            if (!list.length) return loc('det.noPlan', '沒有 plan');
            var n = 0, g = 0;
            list.forEach(function (p) { n += p.tasks.length; g += p.groups.length; });
            return loc('det.nTasksGGroups', '{n} 個 · {g} 組', { n: n, g: g });
        }
        // One band per group `plantasks` would dispatch together, its tasks under
        // it, and the hint where one group went out over more than one turn.
        function tasksHtml(list) {
            if (!list || !list.length) return '<p class="tally">' + loc('det.noPlanFileNoTaskTable', '這個 session 的 claims 裡沒有 plan 檔，沒有任務表') + '</p>';
            return list.map(function (p) {
                if (p.error) return '<div class="srcline" title="' + esc(p.plan) + '">' + esc(p.plan) + '</div><p class="tally">'
                    + (p.error === 'unreadable' ? loc('det.planUnreadableShort', '讀不到這份 plan') : loc('det.planNoTasksShort', '這份 plan 裡沒有 task')) + '</p>';
                var byN = {};
                p.tasks.forEach(function (t) { byN[t.n] = t; });
                var done = p.tasks.filter(function (t) { return t.status === 'complete'; }).length;
                return '<div class="srcline" title="' + esc(p.plan) + '">' + esc(p.plan) + '</div>'
                    + '<table class="x"><colgroup><col style="width:30px"><col><col style="width:96px"></colgroup>'
                    + '<thead><tr><th>#</th><th>' + loc('det.task', '任務') + '</th><th>' + loc('det.state', '狀態') + '</th></tr></thead><tbody>'
                    + p.groups.map(function (g) {
                        return '<tr class="band"><td colspan="3"><div class="bandrow"><span class="gb">G' + g.g + '</span>'
                            + '<span>Task ' + g.tasks.join(loc('det.listSep', '、')) + ' · ' + loc('det.suggested', '建議') + ' <span class="mono">' + esc(g.surface) + '</span></span>'
                            + '<span class="rt">' + (g.turns.length ? loc('det.turnColon', '回合 {t}', { t: g.turns.join(' · ') }) : loc('det.noDispatch', '沒有派工')) + '</span></div>'
                            + (g.hint ? '<div class="hint">could have gone in one response<span class="why">' + loc('det.sameGroupSplitTurns', '同組，分 {n} 個回合派出', { n: g.turns.length }) + '</span></div>' : '') + '</td></tr>'
                            + g.tasks.map(function (n) {
                                var t = byN[n];
                                return '<tr><td class="num mute">' + n + '</td><td><div>' + esc(t ? t.title : '') + '</div>'
                                    + '<div class="l2">' + (t && t.range ? esc(t.range) : loc('det.fromPlanTaskList', '出自 plan 的 task 清單'))
                                    + (t && t.turns.length ? loc('det.dotTurnColon', ' · 回合 {t}', { t: t.turns.join(' · ') }) : '') + '</div></td>'
                                    + '<td><span class="pill sm ' + (t && t.status === 'complete' ? 'ok' : 'pend') + '">'
                                    + esc(t ? t.status : 'no ledger line') + '</span></td></tr>';
                            }).join('');
                    }).join('') + '</tbody></table>'
                    + '<p class="tally">' + loc('det.markedDoneRows', '標為完成的 <b>{n} 列</b>', { n: done }) + ' <span class="' + (done === p.ledgerLines ? 'eq">' + loc('det.equalsSign', '＝') : 'ne">' + loc('det.notEqualsSign', '≠'))
                    + '</span> ' + loc('det.ledgerTaskLines', 'ledger 的 Task 行 {n}', { n: p.ledgerLines })
                    + (p.unmatched.length ? loc('det.unmatchedDispatches', '；label 裡沒有 task N 的派工 {n} 個，不猜：', { n: p.unmatched.length })
                        + p.unmatched.map(esc).join(loc('det.listSep', '、')) : '') + '</p>';
            }).join('');
        }
        // The plan tab (docs/90-agent/plans/2026-10-18-plan-gate-page-design.md
        // §2), drawn from the newest plan this session claimed: its dispatch
        // groups as columns of task cards. Each card names every earlier task
        // `plantasks.conflict` refused it beside — one 等 line per pair, so the
        // lines on the page and the pairs refused are one count. No edge is drawn
        // as a line: `focus` is the task hovered or focused, whose neighbours light
        // (`planRel`). While the session sits at `plan` a banner puts the gate's
        // question; the answer is given in Claude Desktop, never here. Classes are
        // `pv-`: `.pg` is the pending gate's.
        // The newest plan claimed: claims are kept newest last.
        function planNewest(list) { return list && list.length ? list[list.length - 1] : null; }
        // A path escaped first, then given a break after every `/`: Chrome breaks
        // a path at no `/` of its own, so a long one split mid-name in a card.
        function planPath(x) { return esc(x).replace(/\//g, '/<wbr>'); }
        // What one 等 line says about earlier task `w.n`, as waiting task `t` says it.
        function planReason(t, w) {
            var f = w.file ? '<code>' + planPath(w.file) + '</code>' : '';
            if (w.kind === 'files') return loc('det.planWaitFiles', '同改 {f}', { f: f });
            if (w.kind === 'interface') {
                return (t.consumes || []).indexOf(w.file) >= 0 ? loc('det.planWaitIface', '用它產出的 {f}', { f: f })
                    : loc('det.planWaitIfaceRev', '它要用這裡產出的 {f}', { f: f });
            }
            if (w.kind === 'read') {
                var mine = (t.read || []).some(function (r) { return String(r).replace(/:\d+(-\d+)?$/, '') === w.file; });
                return mine ? loc('det.planWaitRead', '讀 {f}', { f: f }) : loc('det.planWaitItReads', '它讀 {f}', { f: f });
            }
            return loc('det.planWaitUndeclared', '有一方沒宣告檔案，保守地等');
        }
        // What lighting Task `f` lights: each task it waits for (`is-pre`) and each
        // task waiting on it (`is-post`), with the kind and the tag that card wears,
        // and the focused card's own tag. Every other card dims.
        function planRel(p, f) {
            var out = { pre: 0, post: 0, rel: {}, focus: '' };
            var me = ((p && p.tasks) || []).filter(function (t) { return t.n === f; })[0];
            if (!me) return out;
            (me.waits || []).forEach(function (w) {
                out.pre++;
                out.rel[w.n] = { cls: 'is-pre ' + w.kind, text: loc('det.planTagPre', 'Task {f} 等這張 · {r}', { f: f, r: planReason(me, w) }) };
            });
            p.tasks.forEach(function (t) {
                (t.waits || []).forEach(function (w) {
                    if (w.n !== f) return;
                    out.post++;
                    out.rel[t.n] = { cls: 'is-post ' + w.kind, text: loc('det.planTagPost', '這張等 Task {f} · {r}', { f: f, r: planReason(t, w) }) };
                });
            });
            out.focus = (out.pre ? loc('det.planFocusPre', '等 {n} 張', { n: out.pre }) : loc('det.planFocusNoPre', '不等誰'))
                + ' · ' + (out.post ? loc('det.planFocusPost', '{n} 張等它', { n: out.post }) : loc('det.planFocusNoPost', '沒有卡等它'));
            return out;
        }
        // The class and tag card `n` wears while Task `f` is lit; null when nothing is.
        function planLit(r, n, f) {
            if (!r) return null;
            if (n === f) return { cls: 'is-focus', tag: esc(r.focus), hit: false };
            var x = r.rel[n];
            return x ? { cls: x.cls, tag: '<i class="pv-ln" aria-hidden="true"></i>' + x.text, hit: x.cls.indexOf('is-post') === 0 }
                : { cls: 'is-dim', tag: null, hit: false };
        }
        function planCard(t, lit, f) {
            var file = function (x) {
                var m = /^(.*?)(:\d+-\d+)?$/.exec(String(x));
                return '<code>' + planPath(m[1]) + (m[2] ? '<small>' + esc(m[2]) + '</small>' : '') + '</code>';
            };
            var disp = t.dispatch === 'implementer'
                ? 'implementer · <span class="pv-m"><i class="sw" style="background:var(--m-' + family('claude-' + t.model) + ')"></i>' + esc(t.model || '?')
                    + '</span> · <span>effort ' + esc(t.effort || loc('det.planEffortDefault', '預設')) + '</span>'
                : t.dispatch === 'user' ? loc('det.planByUser', '交給你')
                    : t.dispatch === 'in-session' ? loc('det.planInSession', '主 session 自己做')
                        : loc('det.planNoDispatch', '沒有 Dispatch 行');
            var waits = t.waits || [];
            var wait = waits.length
                ? '<div class="pv-wait"><span class="pv-wl">' + loc('det.planWaitLabel', '等') + '</span><ul>' + waits.map(function (w) {
                    return '<li class="pv-dep ' + esc(w.kind) + (lit && lit.hit && w.n === f ? ' is-hit' : '') + '" data-from="' + w.n + '"><i class="pv-ln" aria-hidden="true"></i>'
                        + '<b>Task ' + w.n + '</b><span>' + planReason(t, w) + '</span></li>';
                }).join('') + '</ul></div>'
                : '<p class="pv-wait none">' + loc('det.planWaitsNone', '不等誰：這組一開就能跑') + '</p>';
            return '<article class="pv-card' + (lit ? ' ' + lit.cls : '') + '" data-block="task-card-' + t.n + '" data-n="' + t.n + '" tabindex="0" aria-label="Task ' + t.n + '">'
                + (lit && lit.tag !== null ? '<p class="pv-tag">' + lit.tag + '</p>' : '')
                + '<h3><span class="pv-num">' + t.n + '</span><span class="pv-tt">' + esc(t.title).replace(/`([^`]+)`/g, '<code>$1</code>') + '</span></h3>'
                + '<dl class="pv-files"><div><dt>' + loc('det.planModify', '改') + '</dt><dd>' + (t.modify || []).map(file).join('') + '</dd></div>'
                + ((t.test || []).length ? '<div><dt>' + loc('det.planTest', '測') + '</dt><dd>' + t.test.map(file).join('') + '</dd></div>' : '') + '</dl>'
                + '<p class="pv-disp">' + disp + '</p>' + wait + '</article>';
        }
        function planTabHtml(s, list, focus) {
            var PV_KINDS = ['files', 'read', 'interface'];
            var PV_THEN = '<svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 6.2 8 9.8l3.5-3.6"/></svg>';
            var PV_GATE = '<svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1.8 13.5 4v4c0 3-2.4 5.3-5.5 6.2C4.9 13.3 2.5 11 2.5 8V4z"/><path d="M8 5.2v3.3M8 10.8v.01"/></svg>';
            var p = planNewest(list);
            var code = function (x) { return '<code>' + esc(x) + '</code>'; };
            if (!p) return '<p class="pv-empty">' + loc('det.planNone', '這個 session 的 claims 裡還沒有 plan 檔。plan stage 寫出 plan 後，這裡列出它的 task 和分組。') + '</p>';
            if (p.error === 'unreadable') return '<p class="pv-empty err">' + loc('det.planUnreadable', '讀不到 {p}：檔案在，但打不開。', { p: code(p.plan) }) + '</p>';
            if (!p.tasks.length) return '<p class="pv-empty err">' + loc('det.planNoTasks', '{p} 裡找不到 <code>## Task N:</code> 標題，沒有 task 可畫。', { p: code(p.plan) }) + '</p>';
            var byN = {}, kinds = { files: 0, read: 0, interface: 0, undeclared: 0 }, edges = 0, models = {};
            p.tasks.forEach(function (t) {
                byN[t.n] = t;
                (t.waits || []).forEach(function (w) { edges++; kinds[w.kind] = (kinds[w.kind] || 0) + 1; });
                if (t.dispatch === 'implementer' && t.model) models[t.model] = (models[t.model] || 0) + 1;
            });
            var f = focus === null || focus === undefined ? null : Number(focus);
            var r = f !== null && byN[f] ? planRel(p, f) : null;
            var banner = s && s.stage === 'plan'
                ? '<div class="pv-banner" data-block="gate-banner"><div class="pv-q"><span class="pill gate">' + PV_GATE + 'gate</span>'
                    + '<h2>' + loc('det.planGateQ', 'plan gate：要用這 {n} 個 task 進 build 嗎？', { n: p.tasks.length }) + '</h2></div>'
                    + '<ul class="pv-counts"><li><b>' + p.tasks.length + '</b>task</li>'
                    + '<li>' + loc('det.planGroupsRun', '<b>{n}</b>組，依序跑', { n: p.groups.length }) + '</li>'
                    + '<li>' + loc('det.planEdges', '<b>{n}</b>條相依', { n: edges }) + '</li>'
                    + (Object.keys(models).length ? '<li class="pv-mods"><span class="pv-ml">implementer</span>' + Object.keys(models).map(function (m) {
                        return '<span class="chip"><i class="sw" style="background:var(--m-' + family('claude-' + m) + ')"></i>' + esc(m) + ' × ' + models[m] + '</span>';
                    }).join('') + '</li>' : '') + '</ul>'
                    + '<div class="srcline pv-src" title="' + esc(p.plan) + '">' + esc(p.plan) + '</div>'
                    + '<p class="pv-where"><i class="hatchsw" aria-hidden="true"></i><span>' + loc('det.planWhere', '回答在 Claude Desktop 那邊給；這頁只讓你看清楚要核准什麼，不收答案。') + '</span></p></div>'
                : '<div class="pv-hd" data-block="plan-head"><div class="srcline pv-src" title="' + esc(p.plan) + '">' + esc(p.plan) + '</div>'
                    + '<ul class="pv-counts"><li><b>' + p.tasks.length + '</b>task</li><li>' + loc('det.planGroupsRun', '<b>{n}</b>組，依序跑', { n: p.groups.length }) + '</li></ul></div>';
            var label = { files: loc('det.planKindFiles', '同改一個檔'), read: loc('det.planKindRead', '一個讀、一個改'), interface: loc('det.planKindIface', '用到對方產出的介面'),
                undeclared: loc('det.planKindUndeclared', '有一方沒宣告檔案') };
            var legend = '<div class="pv-legend" data-block="legend"><span class="pv-lh">' + loc('det.planLegend', '相依') + '</span>'
                + PV_KINDS.concat(kinds.undeclared ? ['undeclared'] : []).map(function (k) {
                    return '<span class="pv-li ' + k + (kinds[k] ? '' : ' zero') + '"><i class="pv-ln" aria-hidden="true"></i><b>' + k + '</b>' + label[k]
                        + '<small>' + (kinds[k] ? loc('det.planKindN', '{n} 條', { n: kinds[k] }) : loc('det.planKindZero', '這份 plan 沒有')) + '</small></span>';
                }).join('')
                + '<span class="pv-lnote">' + loc('det.planLegendNote', '一欄跑完才換下一欄，欄內並行；停在或 tab 到一張卡，亮出它等的和等它的卡，Esc 清掉。') + '</span></div>';
            var groups = p.groups.map(function (g, i) {
                var par = g.tasks.length === 1 ? loc('det.planAlone', '單獨 1 個') : loc('det.planParallel', '可並行 {n} 個', { n: g.tasks.length });
                return '<section class="pv-g" data-block="group-g' + g.g + '" aria-label="G' + g.g + ' · ' + par + '">'
                    + '<header class="pv-gh"><span class="gb">G' + g.g + '</span><span class="pv-surf mono">' + esc(g.surface) + '</span><span class="pv-par">' + par + '</span></header>'
                    + '<div class="pv-cards">' + g.tasks.map(function (n) { return byN[n] ? planCard(byN[n], planLit(r, n, f), f) : ''; }).join('') + '</div></section>'
                    + (i < p.groups.length - 1 ? '<div class="pv-then">' + PV_THEN + '<span>' + loc('det.planThen', 'G{a} 全部回來，才派 G{b}', { a: g.g, b: g.g + 1 }) + '</span></div>' : '');
            }).join('');
            return banner + legend + '<div class="pv-groups" data-block="group-columns">' + groups + '</div>';
        }
        return {
            estMark: estMark, totalSuffix: totalSuffix, secOpen: secOpen, seenHtml: seenHtml,
            sec: sec, comma: comma, niceStep: niceStep, downsample: downsample,
            lineChart: lineChart, riseText: riseText, risesList: risesList, ctxSection: ctxSection,
            seqHtml: seqHtml, backBlock: backBlock, orderSection: orderSection, splitStage: splitStage,
            splitCount: splitCount, splitHtml: splitHtml, cents: cents, dur: dur,
            taskCount: taskCount, tasksHtml: tasksHtml, planNewest: planNewest, planPath: planPath,
            planReason: planReason, planRel: planRel, planLit: planLit, planCard: planCard,
            planTabHtml: planTabHtml
        };
    }
    var api = { make: make };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_DETAIL = api;
}(typeof window !== 'undefined' ? window : null));
