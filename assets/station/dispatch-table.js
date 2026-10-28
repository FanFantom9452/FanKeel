// 派工表、replay、記成 TODO (FK_DISPATCH): moved out of station.js (station-52).
// station.js calls make(K) once, on first use, handing it the helpers these
// bodies name; everything here only builds strings.
(function (w) {
    'use strict';
    function make(K) {
        // One alias per name K carries, so the bodies below moved verbatim.
        var loc = K.loc, esc = K.esc, dur = K.dur, comma = K.comma, cents = K.cents, tokens = K.tokens, tk = K.tk,
            clockSec = K.clockSec, clock = K.clock, stamp = K.stamp, segHtml = K.segHtml, estMark = K.estMark,
            family = K.family, MODEL_KEYS = K.MODEL_KEYS, STAGE_C = K.STAGE_C, usd = K.usd, mins = K.mins;
        // Every column below is the sum of the rows under it: each row's cents,
        // thousands of tokens and seconds were rounded in `lib/detail.js` by the
        // largest remainder, so the page only adds.
        function sums(rows) {
            return rows.reduce(function (a, r) {
                a.c += r.c; a.k += r.k; a.s += r.s;
                a.ti += r.split ? r.split.input || 0 : 0;
                a.to += r.split ? r.split.output || 0 : 0;
                a.ci += r.cost ? r.cost.input || 0 : 0;
                a.co += r.cost ? r.cost.output || 0 : 0;
                a.requests += r.requests || 0;
                if ((r.peak || 0) > a.peak) a.peak = r.peak || 0;
                return a;
            }, { c: 0, k: 0, s: 0, ti: 0, to: 0, ci: 0, co: 0, requests: 0, peak: 0 });
        }
        // The estimated ids of these dispatch rows, unique, as `numCells` prints them; '' when none.
        function estOf(rows) {
            var ids = [];
            rows.forEach(function (r) { (r.estimated || []).forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); }); });
            return ids.join(', ');
        }
        function numCells(t, unpriced, time, estimated) {
            var tip = [], mark = estimated ? ' ' + loc('det.estShort', '估') : '';
            if (unpriced) tip.push(loc('det.priceListDoesNotKnow', '價目表不認得：{u}', { u: esc(unpriced) }));
            if (estimated) tip.push(loc('det.priceEstimated', '價目表沒有，照同家族最新一列估價：{u}', { u: esc(estimated) }));
            return '<td class="r">' + (time || dur(t.s)) + '</td><td class="r">' + comma(t.k) + 'k</td><td class="r"'
                + (tip.length ? ' title="' + tip.join('; ') + '"' : '') + '>'
                + (unpriced && !t.c ? 'unpriced' : cents(t.c)) + mark + '</td>'
                + '<td class="r">' + tokens(t.ti || 0) + '</td><td class="r">$' + (t.ci || 0).toFixed(2) + mark + '</td>'
                + '<td class="r">' + tokens(t.to || 0) + '</td><td class="r">$' + (t.co || 0).toFixed(2) + mark + '</td>'
                + '<td class="r">' + tokens(t.peak || 0) + '</td><td class="r">' + comma(t.requests || 0) + '</td>';
        }
        // `isFinite(null)` is true, and a dispatch that has not come back carries a
        // null `back`; every time below is asked this instead.
        function isNum(v) { return typeof v === 'number' && isFinite(v); }
        // ---- 派工: each agent's state, what it is on, and what it holds -------
        // `x.states` is the server's reading (`statesOf` in lib/detail.js) when the
        // detail was written. The list is re-read more often than the detail, and a
        // session that stops being live stops having its detail re-read, so an agent
        // still `running` there in a session the list now says is not live is
        // `lost`. A detail from before states existed reads `done`.
        function agentState(x, r, s) {
            var st = (x && x.states && x.states[r.id]) || 'done';
            return st === 'running' && s && s.state !== 'live' ? 'lost' : st;
        }
        // The tool a step names, the way the transcript named it.
        function toolText(c) {
            if (!c) return '';
            if (c.k === 'read' || c.k === 'edit') return (c.n || (c.k === 'read' ? 'Read' : c.w ? 'Write' : 'Edit')) + ' ' + c.f;
            if (c.k === 'cmd') return (c.n || 'Bash') + ': ' + c.c;
            return c.c || c.n || '';
        }
        function stepLabel(k, w) {
            if (k === 'edit' && w) return loc('disp.write', '寫');
            return { read: loc('disp.read', '讀'), edit: loc('disp.editShort', '改'), cmd: loc('disp.command', '指令'), find: loc('disp.find', '搜'), other: loc('disp.other', '其他') }[k] || k;
        }
        // One step; `mode` is `cur` for the step in progress and `stop` for the one a
        // lost agent never finished, and `tail` goes after it.
        function stepLi(y, mode, tail) {
            return '<li' + (mode ? ' class="' + mode + '"' : '') + '><span class="sk ' + esc(y.k) + '">' + stepLabel(y.k, y.w) + '</span><div>'
                + (y.f ? '<span class="fl">' + esc(y.f) + '</span>' : '<span class="cm">' + esc(y.c) + '</span>')
                + (!mode && y.r ? '<div class="rl">' + esc(y.r) + '</div>' : '') + '</div>' + (tail || '') + '</li>';
        }
        function agentPill(st) {
            var title = st === 'running' ? loc('disp.runningHint', 'running：還沒回來，它的 transcript 還在長')
                : st === 'done' ? loc('disp.doneHint', 'done：已經結束') : loc('disp.lostHint', 'lost：它還沒結束，跑它的 session 就停了');
            return '<span class="pill sm ' + st + '" title="' + title + '"><i class="dot '
                + (st === 'running' ? 'live' : st === 'done' ? 'down' : 'lost') + '"></i>' + st + '</span>';
        }
        function agdots(x, list, s) {
            return '<span class="agdots" aria-hidden="true">' + list.map(function (r) {
                return '<i class="' + agentState(x, r, s) + '"></i>';
            }).join('') + '</span>';
        }
        function stateTally(x, list, s) {
            var c = { running: 0, done: 0, lost: 0 };
            list.forEach(function (r) { c[agentState(x, r, s)] += 1; });
            return ['running', 'done', 'lost'].filter(function (k) { return c[k]; }).map(function (k) { return c[k] + ' ' + k; }).join(' · ');
        }
        function modelOf(r) { return (r.agentType || '—') + ' · ' + String(r.model || r.alias || '—').replace(/^claude-/, ''); }
        // Under a row's label: the tool a running agent is on and how long it has
        // been on it, or where a lost one stopped and how long it had been at it by
        // its transcript's last line.
        function nowLine(st, steps, u) {
            var cur = steps && steps.cur;
            if (!cur || (st !== 'running' && st !== 'lost')) return '';
            var what = esc(toolText(cur));
            if (st === 'running') {
                return '<div class="nowl"><span class="k">' + loc('disp.doingNow', '正在') + '</span><span class="c" title="' + what + '">' + what + '</span>'
                    + (isNum(cur.t) ? '<span class="e">' + tk(-cur.t / 1000, 1, u.live, u.now / 1000) + '</span>' : '') + '</div>';
            }
            return '<div class="nowl lost"><span class="k">' + loc('disp.stoppedAt', '停在') + '</span><span class="c" title="' + what + '">' + what + '</span>'
                + (isNum(cur.t) && isNum(steps.lastAt) ? '<span class="e">' + loc('disp.ranFor', '跑了 {t}', { t: dur(Math.round((steps.lastAt - cur.t) / 1000)) }) + '</span>' : '') + '</div>';
        }
        // The running and lost counts, for the session header's 派工 readout.
        function agentCounts(x, s) {
            var run = 0, lost = 0;
            x.rows.forEach(function (r) {
                var st = agentState(x, r, s);
                if (st === 'running') run += 1;
                else if (st === 'lost') lost += 1;
            });
            return (run ? '<span class="runn"><i class="dot live"></i>' + run + ' running</span> · ' : '') + (lost ? loc('disp.nLost', '{n} lost · ', { n: lost }) : '');
        }
        function agentRow(r, cls, attr, x, s, u) {
            var st = agentState(x, r, s), steps = x && x.steps ? x.steps[r.id] : null, open = !!u.open[r.id];
            var time = st === 'running' && isNum(r.from) ? tk(-r.from / 1000, 1, u.live, u.now / 1000) : null;
            return '<tr class="' + cls + ' is-' + st + '"' + (attr || '') + '><td><div class="stc">' + agentPill(st) + '<div class="bd">'
                + '<button type="button" class="axt" data-ag="' + esc(r.id) + '" data-key="ag-' + esc(r.id) + '" aria-expanded="' + open + '"'
                + ' title="' + loc('disp.openPromptSteps', '{v} prompt 與步驟', { v: open ? loc('disp.collapse', '收起') : loc('disp.expand', '展開') }) + '"><span class="lab">' + esc(r.label || r.id) + '</span></button>'
                + '<div class="l2">' + esc(modelOf(r)) + '</div>' + nowLine(st, steps, u) + '</div></div></td>'
                + numCells(sums([r]), (r.unpriced || []).join(', '), time, (r.estimated || []).join(', ')) + '<td class="r rc"></td></tr>'
                + (open ? agentBody(r, cls, x, st, steps, u) : '');
        }
        // One agent opened: when it started and how long it ran, what it was sent
        // (three lines until opened in full), its steps in order with any not yet
        // answered marked in progress at their own position — `stepsOf` keeps
        // every one of those out of the forty the cap counts — and what it
        // returned. A `tool_use` still without a `tool_result` can only be the
        // last thing in the transcript (nothing answered runs before it gets its
        // result), so it and any other unanswered one from the same message are
        // always the list's trailing entries; only the last of them is the one
        // `cur` names and carries a start time — an earlier parallel call has
        // none, so it gets the same marker with no ticking clock.
        function agentBody(r, cls, x, st, steps, u) {
            var d = r.disp === null || r.disp === undefined ? null : x.dispatches[r.disp];
            var list = steps ? steps.steps || [] : [], cur = steps ? steps.cur : null, popen = !!u.prm[r.id];
            var lastP = -1;
            list.forEach(function (y, i) { if (y.p) lastP = i; });
            var n = list.length + (steps ? steps.droppedN || 0 : 0);
            var note = steps && steps.droppedN ? '<p class="stn">' + loc('disp.capNStepsNotListed', '上限 40 步，另有 {n} 步沒列出（', { n: steps.droppedN })
                + Object.keys(steps.dropped || {}).map(function (k) { return stepLabel(k) + ' ' + steps.dropped[k]; }).join(loc('disp.listSep', '、')) + loc('disp.closeParen', '）')
                + (cur && st === 'running' ? loc('disp.inProgressNotCounted', '；進行中的步驟不算在上限裡，永遠留在最後') : '') + '</p>' : '';
            var end = st === 'lost' && steps && isNum(steps.lastAt) ? steps.lastAt : r.to;
            var ran = st === 'running' ? loc('disp.ranSoFarB', '已跑 <b>{t}</b>', { t: tk(-r.from / 1000, 1, u.live, u.now / 1000) })
                : loc('disp.ranForB', '跑了 <b>{t}</b>', { t: isNum(end) ? dur(Math.round((end - r.from) / 1000)) : '—' });
            var prompt = steps && typeof steps.prompt === 'string'
                ? '<div class="prm' + (popen ? ' open' : '') + '"><div class="axl">prompt <span class="n">' + loc('disp.nChars', '{n} 字元', { n: comma(steps.promptLen || steps.prompt.length) })
                    + (steps.promptLen > steps.prompt.length ? loc('disp.savedFirstN', '，存了前 {n}', { n: comma(steps.prompt.length) }) : '') + '</span>'
                    + '<button type="button" class="lkb" data-prm="' + esc(r.id) + '" data-key="prm-' + esc(r.id) + '" aria-expanded="' + popen + '">'
                    + (popen ? loc('disp.collapse', '收起') : loc('disp.expandAll', '展開全部')) + '</button></div><pre>' + esc(steps.prompt) + '</pre></div>'
                : '<div class="prm"><div class="axl">prompt <span class="n">' + loc('disp.notInTranscript', 'transcript 裡沒有') + '</span></div></div>';
            var foot;
            if (st === 'running') foot = '<div class="retl">' + loc('disp.notBackYet', '還沒回來。回來後，這裡寫它回傳了多少字元。') + '</div>';
            else if (st === 'lost') foot = '<div class="retl lost">' + loc('disp.noReturnLost', '沒有回傳：它還沒結束，跑它的 session 就停了，結果沒有進主 context。') + '</div>';
            else if (!d) foot = '<div class="retl">' + loc('disp.noMatchingDispatch', '沒有對上派工，不知道它回傳了多少。') + '</div>';
            else if (d.surface === 'workflow') {
                foot = '<div class="retl">' + (steps && isNum(steps.lastAt) ? clockSec(steps.lastAt) + ' ' : '') + loc('disp.endedMergedIntoWorkflow', '結束。它的結果併在 workflow 的回報裡')
                    + (isNum(d.back) && d.ret !== null && d.ret !== undefined ? loc('disp.workflowReturnedChars', '；workflow 回傳 <b>{n}</b> 字元進主 context。', { n: comma(d.ret) })
                        : loc('disp.workflowNotBackYet', '；workflow 還沒回來，還沒有回傳字元。')) + '</div>';
            } else if (isNum(d.back) && d.ret !== null && d.ret !== undefined) {
                foot = '<div class="retl">' + loc('disp.backAtReturnedChars', '{t} 回來，回傳 <b>{n}</b> 字元進主 context', { t: clockSec(d.back), n: comma(d.ret) }) + '</div>';
            } else foot = '<div class="retl">' + loc('disp.endedReportNotIn', '已經結束，回報還沒進主 context。') + '</div>';
            return '<tr class="ax ' + cls + ' is-' + st + '"><td colspan="9"><div class="axw">'
                + '<div class="axh">' + (isNum(r.from) ? '<span>' + loc('disp.dispatchedAt', '派出 <b>{t}</b>', { t: clockSec(r.from) }) + '</span><span>' + ran + '</span>' : '')
                + '<span><b>' + n + '</b> ' + loc('disp.steps', '步') + '</span><span>' + esc(modelOf(r)) + '</span></div>'
                + prompt
                + '<div><div class="axl">' + loc('disp.stepsLabel', '步驟') + ' <span class="n">' + loc('disp.inOrderNewestBelow', '照順序，最新在下') + '</span></div><ul class="stp">'
                + list.map(function (y, i) {
                    if (!y.p) return stepLi(y);
                    var mode = st === 'lost' ? 'stop' : 'cur';
                    var tail = st === 'running'
                        ? '<span class="pg"><i class="dot live"></i>' + loc('disp.inProgress', '進行中') + (i === lastP && isNum(cur && cur.t)
                            ? ' ' + tk(-cur.t / 1000, 1, u.live, u.now / 1000) : '') + '</span>'
                        : st === 'lost'
                            ? '<span class="pg lost">' + loc('disp.didNotFinish', '沒跑完') + (i === lastP && isNum(cur && cur.t) && isNum(steps.lastAt)
                                ? loc('disp.dotRanFor', '・跑了 {t}', { t: dur(Math.round((steps.lastAt - cur.t) / 1000)) }) : '') + '</span>'
                            : '';
                    return stepLi(y, mode, tail);
                }).join('') + '</ul>' + note + '</div>'
                + foot + '</div></td></tr>';
        }
        // One band per dispatch in turn order, `surface` on the band, and a row per
        // agent carrying its state; a workflow folds into one row per phase until
        // the phase is opened, and agents no dispatch accounts for are a band of
        // their own. `s` is the session's list row — its liveness decides `lost` —
        // and `ui` what the reader has open: `open` and `prm` by agent id, `ph` by
        // phase key, `filter` one state or `all`, `now` the clock tickers start
        // from and `live` whether they tick. Both may be left out.
        function dispatchHtml(x, s, ui) {
            var u = {
                open: (ui && ui.open) || {}, prm: (ui && ui.prm) || {}, ph: (ui && ui.ph) || {},
                filter: (ui && ui.filter) || 'all', now: ui && isNum(ui.now) ? ui.now : Date.now(), live: !!(ui && ui.live),
            };
            if (!x.rows.length) {
                return '<div class="h2">' + loc('disp.dispatch', '派工') + ' <small>' + loc('disp.noAgentsYet', '這個 session 還沒派出 agent') + '</small></div><div class="emptyd"><p class="et">' + loc('disp.noAgentsYet2', '還沒派出 agent') + '</p><p class="es">'
                    + (u.live && s && s.state === 'live' ? loc('disp.willAppearOnNextUpdate', '一派出，它會在下一次更新（3 秒內）出現在這裡，連同它正在跑的工具。這頁不必重新整理。')
                        : loc('disp.noAgentsDispatchedAtAll', '這個 session 沒有派出任何 agent。')) + '</p></div>';
            }
            var n = { all: x.rows.length, running: 0, done: 0, lost: 0 };
            x.rows.forEach(function (r) { n[agentState(x, r, s)] += 1; });
            var filter = u.filter !== 'all' && n[u.filter] ? u.filter : 'all';
            var pass = function (r) { return filter === 'all' || agentState(x, r, s) === filter; };
            // A stage agent's own agents: `parent` is the `parentAgentId` their
            // `.meta.json` names (`dispatchesOf` in lib/usage.js). One level: a row
            // whose parent is in the list and is itself at the top sits under it, in
            // its band; any other row is grouped as before.
            var byId = {};
            x.rows.forEach(function (r) { byId[r.id] = r; });
            var under = function (r) {
                var p = r.parent ? byId[r.parent] : null;
                return !!p && p !== r && !(p.parent && byId[p.parent]);
            };
            var kids = {};
            x.rows.forEach(function (r) { if (under(r)) (kids[r.parent] = kids[r.parent] || []).push(r); });
            var fam = function (list) { return list.reduce(function (m, r) { return m.concat([r], kids[r.id] || []); }, []); };
            var shows = function (r) { return pass(r) || (kids[r.id] || []).some(pass); };
            var withKids = function (r, cls, attr) {
                return agentRow(r, cls, attr, x, s, u) + (kids[r.id] || []).filter(pass).map(function (k) {
                    return agentRow(k, cls + ' kid', attr, x, s, u);
                }).join('');
            };
            var groups = {}, order = [];
            x.rows.forEach(function (r) {
                if (under(r)) return;
                var k = r.disp === null || r.disp === undefined ? 'none' : String(r.disp);
                if (!groups[k]) { groups[k] = []; order.push(k); }
                groups[k].push(r);
            });
            order.sort(function (a, b) {
                if (a === 'none') return 1;
                if (b === 'none') return -1;
                var da = x.dispatches[a], db = x.dispatches[b];
                return (da.turn || 0) - (db.turn || 0) || (da.out || 0) - (db.out || 0);
            });
            // A session resumed under the same id: the process running it now
            // started after some of these went out, and any of those not back is
            // lost. One row says where the process changed.
            var since = isNum(x.since) ? x.since : null, gapDone = false;
            var early = since !== null && order.some(function (k) {
                return k !== 'none' && isNum(x.dispatches[k].out) && x.dispatches[k].out < since;
            });
            var gap = function () {
                var end = null;
                (x.points || []).forEach(function (p) { if (isNum(p.t) && p.t < since && (end === null || p.t > end)) end = p.t; });
                return '<tr class="gaprow"><td colspan="11">session ' + (end !== null ? loc('disp.endedAtB', '<b>{t}</b> 結束，', { t: clock(end) }) : '')
                    + loc('disp.resumedSameIdLost', '<b>{t}</b> 以同一個 session id 接回來；結束前派出、還沒回來的 agent 標成 lost', { t: clock(since) }) + '</td></tr>';
            };
            var body = order.map(function (k) {
                var list = groups[k], d = k === 'none' ? null : x.dispatches[k], lead = '';
                if (early && !gapDone && d && isNum(d.out) && d.out >= since) {
                    gapDone = true;
                    if (filter === 'all' || filter === 'lost') lead = gap();
                }
                var vis = list.filter(shows);
                if (!vis.length) return lead;
                var wf = !!d && d.surface === 'workflow';
                var gone = !!d && !isNum(d.back) && list.every(function (r) { return agentState(x, r, s) !== 'running'; })
                    && list.some(function (r) { return agentState(x, r, s) === 'lost'; });
                var head = '<tr class="band"><td><div class="bandrow"><span class="sf ' + (d ? d.surface : 'agent') + '">'
                    + (d ? d.surface : '—') + '</span><span class="ell">' + esc(d ? d.text : loc('disp.noMatchingDispatchAgent', '沒有對上派工的 agent')) + '</span>'
                    + (wf ? agdots(x, list, s) + '<span class="phs">' + list.filter(function (r) { return agentState(x, r, s) === 'done'; }).length
                        + ' / ' + list.length + ' done</span>' : '')
                    + '<span class="rt">' + (d && d.turn ? loc('disp.turnN2', '回合 {n}', { n: d.turn }) : '')
                    + (d && isNum(d.out) ? ' · ' + stamp(d.out).slice(11) + '→' + (isNum(d.back) ? stamp(d.back).slice(11) : gone ? loc('disp.notBack', '沒回來') : '…') : '')
                    + '</span></div></td>' + numCells(sums(fam(list)), '', null, estOf(fam(list))) + '<td class="r rc">'
                    + (d && d.ret !== null && d.ret !== undefined ? comma(d.ret) : d && !gone && !isNum(d.back) ? '…' : '—') + '</td></tr>';
                if (!wf) return lead + head + vis.map(function (r) { return withKids(r, 'ag', ''); }).join('');
                var phases = [];
                list.forEach(function (r) { var p = r.phase || '—'; if (phases.indexOf(p) < 0) phases.push(p); });
                return lead + head + phases.map(function (p, i) {
                    var pr = list.filter(function (r) { return (r.phase || '—') === p; });
                    var shown = pr.filter(shows);
                    if (!shown.length) return '';
                    var key = 'ph-' + k + '-' + i, open = !!u.ph[key] || filter !== 'all';
                    return '<tr class="phr"><td><div class="phl"><button type="button" class="phb" data-ph="' + key + '" data-key="' + key
                        + '" aria-expanded="' + open + '">' + esc(p) + '<span class="n">· ' + pr.length + ' agents</span></button>'
                        + agdots(x, pr, s) + '<span class="phs">' + stateTally(x, pr, s) + '</span></div></td>' + numCells(sums(fam(pr)), '', null, estOf(fam(pr)))
                        + '<td class="r rc"></td></tr>'
                        + shown.map(function (r) { return withKids(r, 'wa', ' data-in="' + key + '"' + (open ? '' : ' hidden')); }).join('');
                }).join('');
            }).join('');
            if (early && !gapDone && (filter === 'all' || filter === 'lost')) body += gap();
            var off = {};
            ['running', 'done', 'lost'].forEach(function (k) { if (!n[k]) off[k] = loc('disp.noAgentsWithState', '沒有這個狀態的 agent'); });
            var dhead = '<div class="dhead"><div class="h2">' + loc('disp.dispatch', '派工') + ' <small>' + loc('disp.nAgentsNDispatches', '<b>{n}</b> 個 agent · {d} 次派工', { n: x.rows.length, d: x.dispatches.length }) + '</small></div><span class="spacer"></span>'
                + (ui && ui.view ? segHtml('dxv', [['chart', loc('disp.chart', '圖')], ['rows', loc('disp.perAgent', '逐個 agent')]], ui.view) : '')
                + segHtml('dfilter', [['all', loc('disp.allN', '全部 {n}', { n: n.all })], ['running', 'running ' + n.running], ['done', 'done ' + n.done], ['lost', 'lost ' + n.lost]], filter, off)
                + '</div>';
            var all = sums(x.rows);
            var ret = x.dispatches.reduce(function (m, d) { return m + (d.ret || 0); }, 0);
            var launch = x.dispatches.reduce(function (m, d) { return m + (d.launch || 0); }, 0);
            var wfRows = x.rows.filter(function (r) { return r.surface === 'workflow'; }).length;
            var wfRun = x.runs.reduce(function (m, r) { return m + r.agents; }, 0);
            var eq = function (a, b) { return '<span class="' + (a === b ? 'eq">' + loc('disp.equalsSign', '＝') : 'ne">' + loc('disp.notEqualsSign', '≠')) + '</span>'; };
            var vw = ui && ui.view ? ui.view : 'all';
            // The chart goes after the table in the markup: with no `ui.view`
            // both render, and the table's own order is what a reader of the
            // string walks first.
            var chart = vw === 'rows' ? '' : dxChartHtml(x, s, order, groups, fam, pass, all, ret, (ui && ui.metric) || 'c');
            var rows = vw === 'chart' ? '' : '<table class="x dx"><colgroup><col><col style="width:50px"><col style="width:54px"><col style="width:54px">'
                + '<col style="width:48px"><col style="width:54px"><col style="width:48px"><col style="width:54px">'
                + '<col style="width:54px"><col style="width:48px"><col style="width:58px"></colgroup><thead><tr><th>' + loc('disp.dispatch', '派工') + '</th><th class="r">' + loc('disp.timeSpent', '耗時') + '</th><th class="r">tokens</th>'
                + '<th class="r">USD</th><th class="r">input</th><th class="r">input USD</th><th class="r">output</th><th class="r">output USD</th>'
                + '<th class="r">' + loc('disp.contextPeak', 'context 峰值') + '</th><th class="r">' + loc('disp.requests', '請求數') + '</th>'
                + '<th class="r rc" title="' + loc('disp.charsReturnedHint', '這次派工的結果進入主 context 的字元數') + '">' + loc('disp.charsReturned', '回傳字元') + '</th></tr></thead>'
                + '<tbody>' + body + '</tbody><tfoot><tr><td>' + loc('disp.nAgents2', '{n} 個 agent', { n: x.rows.length }) + '</td>' + numCells(all, '', null, estOf(x.rows))
                + '<td class="r rc">' + comma(ret) + '</td></tr></tfoot></table>';
            // The chart has no row a running agent could stand in, so above it the
            // running ones keep their rows: the tool each is on, and the count the
            // session list gives.
            var live = x.rows.filter(function (r) { return agentState(x, r, s) === 'running' && pass(r); });
            if (vw === 'chart' && live.length) {
                rows = '<table class="x dx dxlive"><colgroup><col><col style="width:50px"><col style="width:54px"><col style="width:54px">'
                    + '<col style="width:48px"><col style="width:54px"><col style="width:48px"><col style="width:54px">'
                    + '<col style="width:54px"><col style="width:48px"><col style="width:58px"></colgroup><thead><tr><th>' + loc('disp.runningNow', '正在跑 {n}', { n: live.length }) + '</th><th class="r">' + loc('disp.timeSpent', '耗時') + '</th><th class="r">tokens</th>'
                    + '<th class="r">USD</th><th class="r">input</th><th class="r">input USD</th><th class="r">output</th><th class="r">output USD</th>'
                    + '<th class="r">' + loc('disp.contextPeak', 'context 峰值') + '</th><th class="r">' + loc('disp.requests', '請求數') + '</th>'
                    + '<th class="r rc"></th></tr></thead><tbody>'
                    + live.map(function (r) { return agentRow(r, 'ag', '', x, s, u); }).join('') + '</tbody></table>';
            }
            return dhead + rows + chart
                + '<details class="dxnote" data-key="dx-note"><summary>' + loc('disp.reconciliationAndNotes', '對帳與說明') + ' ' + eq(all.c, x.agentsTotal.cents) + eq(wfRows, wfRun) + '</summary>'
                + '<p class="tally">' + loc('disp.rowsUsdSum', '各列美元相加 <b>{a}</b>', { a: cents(all.c) + estMark({ estimated: estOf(x.rows) }) }) + ' ' + eq(all.c, x.agentsTotal.cents) + ' ' + loc('disp.agentsOfSum', 'agentsOf() 的 {a}', { a: cents(x.agentsTotal.cents) + estMark({ estimated: estOf(x.rows) }) })
                + loc('disp.workflowRowsVs', '；workflow 派工 {a} 列', { a: wfRows }) + ' ' + eq(wfRows, wfRun) + ' ' + loc('disp.runFileWorkflowAgentRows', 'run 檔的 workflow_agent {a} 列', { a: wfRun })
                + '</p>'
                + '<p class="tally">' + loc('disp.returnedCharsExplain', '回傳字元是派工的結果進入主 context 的長度：背景 agent 與 workflow 取 task-notification，前景的取 Agent 的 tool_result。背景啟動時回來的確認不算在內，這個 session 合計 {n} 字元。', { n: comma(launch) }) + loc('disp.usdByPriceList', '美元照價目表 {v}', { v: esc(K.S().pricesVerified || '—') }) + (x.unpriced.length ? loc('disp.unpricedList', '；價目表不認得、寫 unpriced 的：{list}', { list: x.unpriced.map(esc).join(loc('disp.listSep', '、')) }) : '')
                    + ((x.estimated || []).length ? loc('disp.estimatedList', '；價目表沒有、照同家族最新一列估價的：{list}', { list: x.estimated.map(esc).join(loc('disp.listSep', '、')) }) : '')
                + '</p>'
                + (n.running ? '<p class="tally">' + loc('disp.runningRowsAsOf', 'running 的 {n} 列是到 {t} 為止的 tokens 與美元，下一次重拉會再變；耗時照秒走。', { n: n.running, t: clockSec(isNum(x.at) ? x.at : u.now) }) + '</p>' : '')
                + (n.lost ? '<p class="tally">' + loc('disp.lostRowsNoChars', 'lost 的列沒有回傳字元：它的結果沒有進主 context。耗時算到它 transcript 的最後一行。') + '</p>' : '')
                + '</details>';
        }
        // 派工 as bars: one row per dispatch in turn order, its length the metric
        // `m` picks (c cents, k thousand tokens, s seconds, r return chars), split
        // into its agents — a stage agent's own agents included — in the model
        // family's --m-* colour. Every figure the table has is on a title: the
        // row's label carries the band, each segment its agent. An agent the
        // state filter leaves out is dimmed, not dropped.
        function dxChartHtml(x, s, order, groups, fam, pass, all, ret, m) {
            var FMT = { c: cents, k: function (v) { return comma(v) + 'k'; }, s: dur, r: function (v) { return loc('disp.nChars2', '{v} 字', { v: comma(v) }); },
                peak: tokens, requests: comma };
            var f = FMT[m] ? FMT[m] : (m = 'c', FMT.c);
            var nums = function (t, est) {
                var mark = estMark({ estimated: est });
                return cents(t.c) + mark + ' · ' + comma(t.k) + 'k token · ' + dur(t.s) + ' · input ' + tokens(t.ti || 0) + ' $' + (t.ci || 0).toFixed(2) + mark
                    + ' · output ' + tokens(t.to || 0) + ' $' + (t.co || 0).toFixed(2) + mark;
            };
            var fams = {};
            var rows = order.map(function (k) {
                var d = k === 'none' ? null : x.dispatches[k], list = fam(groups[k]), t = sums(list);
                var r = d && d.ret !== null && d.ret !== undefined ? d.ret : null;
                return { k: k, d: d, list: list, t: t, r: r, v: m === 'r' ? r || 0 : t[m] };
            });
            var max = Math.max.apply(null, rows.map(function (r) { return r.v; }).concat([0]));
            var total = m === 'r' ? ret : all[m];
            var body = rows.map(function (row) {
                var d = row.d, sf = d ? d.surface : 'agent';
                var tip = (d ? d.text : loc('disp.noMatchingDispatch2', '未對上派工')) + '\n' + (d && d.turn ? loc('disp.turnNDot', '回合 {n} · ', { n: d.turn }) : '')
                    + (d && isNum(d.out) ? stamp(d.out).slice(11) + '→' + (isNum(d.back) ? stamp(d.back).slice(11) : '…') + ' · ' : '')
                    + loc('disp.nAgentsNewline', '{n} 個 agent\n', { n: row.list.length }) + nums(row.t, estOf(row.list)) + loc('disp.newlineReturned', '\n回傳 {v}', { v: row.r === null ? '—' : loc('disp.nCharsSuffix', '{n} 字元', { n: comma(row.r) }) });
                var segs = m === 'r'
                    ? (row.v ? '<i style="flex:1 1 0;background:var(--s-' + (sf === 'workflow' ? 'workflow' : 'agent') + ')"></i>' : '')
                    : row.list.map(function (a) {
                        if (!a[m]) return '';
                        var fk = family(a.model || a.alias);
                        fams[fk] = true;
                        return '<i class="' + agentState(x, a, s) + (pass(a) ? '' : ' off') + '" style="flex:' + a[m] + ' 1 0;background:var(--m-' + fk + ')"'
                            + ' title="' + esc((a.label || a.id) + '\n' + modelOf(a) + ' · ' + agentState(x, a, s) + '\n' + nums(sums([a]), estOf([a]))) + '"></i>';
                    }).join('');
                return '<div class="dxr" role="listitem" title="' + esc(tip) + '"><span class="dxl"><span class="sf ' + esc(sf) + '">' + esc(d ? sf : '—') + '</span>'
                    + '<span class="dxn">' + esc(d ? d.text : loc('disp.noMatchingDispatch2', '未對上派工')) + '</span></span>'
                    + '<span class="dxt"><span class="dxb" style="width:' + (max ? row.v / max * 88 : 0).toFixed(1) + '%">' + segs + '</span>'
                    + '<b>' + (m === 'r' && row.r === null ? '—' : f(row.v)) + (m === 'c' ? estMark({ estimated: estOf(row.list) }) : '') + '</b></span></div>';
            }).join('');
            var legend = m === 'r'
                ? '<span><i class="sw" style="background:var(--s-agent)"></i>agent</span><span><i class="sw" style="background:var(--s-workflow)"></i>workflow</span>'
                : MODEL_KEYS.filter(function (k) { return fams[k]; }).map(function (k) {
                    return '<span><i class="sw" style="background:var(--m-' + k + ')"></i>' + k + '</span>';
                }).join('');
            var DXM = { c: loc('disp.cost2', '花費'), k: 'token', s: loc('disp.timeSpent2', '耗時'), r: loc('disp.charsReturned2', '回傳字元'),
                peak: loc('disp.contextPeak', 'context 峰值'), requests: loc('disp.requests', '請求數') };
            return '<div class="dxc"><div class="dxch">'
                + segHtml('dxm', [['c', DXM.c], ['k', DXM.k], ['s', DXM.s], ['r', DXM.r], ['peak', DXM.peak], ['requests', DXM.requests]], m)
                + '<span class="dxsum" title="' + esc(loc('disp.nAgentsTotal', '{n} 個 agent 合計\n', { n: x.rows.length }) + nums(all, estOf(x.rows)) + loc('disp.newlineReturned', '\n回傳 {v}', { v: loc('disp.nCharsSuffix', '{n} 字元', { n: comma(ret) }) })) + '">' + loc('disp.totalB', '合計 <b>{v}</b>', { v: f(total) + (m === 'c' ? estMark({ estimated: estOf(x.rows) }) : '') }) + '</span>'
                + '<span class="spacer"></span><span class="lane-legend">' + legend + '</span></div>'
                + '<div class="dxg" role="list" aria-label="' + loc('disp.perDispatchMetric', '每次派工的{m}', { m: DXM[m] }) + '">' + body + '</div>'
                + '<div class="note">' + loc('disp.oneRowOneDispatch', '一列一次派工，照回合先後；一段一個 agent。游標停在列或段上看全部數字。') + '</div></div>';
        }
        function stepsFor(x, d) {
            if (!d) return '';
            var ids = d.ids.filter(function (id) { return x.steps[id]; });
            if (!ids.length) return '';
            var shown = 0, total = 0;
            ids.forEach(function (id) { shown += x.steps[id].steps.length; total += x.steps[id].steps.length + x.steps[id].droppedN; });
            return '<details class="stw" data-block="tool-collapsed" data-key="stw-' + esc(d.key) + '"><summary class="rpx">' + loc('disp.expandOwnSteps', '展開它自己的步驟') + ' <span class="n">' + loc('disp.shownOfTotalSteps', '{shown} / {total} 步', { shown: shown, total: total })
                + (ids.length > 1 ? ' · ' + ids.length + ' agents' : '') + '</span></summary>' + '<div class="to" data-block="tool-output">' + ids.map(function (id) {
                    var st = x.steps[id];
                    var r = x.rows.filter(function (y) { return y.id === id; })[0];
                    return (ids.length > 1 ? '<div class="stg">' + esc(r ? r.label : id) + '</div>' : '')
                        + '<ul class="stp">' + st.steps.map(function (y) {
                            return '<li' + (y.p ? ' class="cur"' : '') + '><span class="sk ' + y.k + '">' + stepLabel(y.k, y.w) + '</span><div>'
                                + (y.f ? '<span class="fl">' + esc(y.f) + '</span>' : '<span class="cm">' + esc(y.c) + '</span>')
                                + (y.r ? '<div class="rl">' + esc(y.r) + '</div>' : '')
                                + (y.p ? '<span class="pg"><i class="dot live"></i>' + loc('disp.inProgress', '進行中') + '</span>' : '') + '</div></li>';
                        }).join('') + '</ul>'
                        + (st.droppedN ? '<p class="stn">' + loc('disp.capNStepsNotListed', '上限 40 步，另有 {n} 步沒列出（', { n: st.droppedN })
                            + Object.keys(st.dropped).map(function (k) { return stepLabel(k) + ' ' + st.dropped[k]; }).join(loc('disp.listSep', '、')) + loc('disp.closeParen', '）') + '</p>' : '');
                }).join('') + '</div></details>';
        }
        // The replay in segments, the direction the 2026-09-24 mockup approved:
        // a strip of what each stage took, a table of contents by segment, the
        // kind filter, then one folding section per stage. `s` is the session's
        // row: its `stages` carry each segment's window, `burn` and `usd` — the
        // same figures the summary table prints, and the only ones that add up to
        // the session's `burn`. Without it the rows are one segment.
        // A function, not a var: the module export above returns before a var
        // this far down is assigned, and a declaration is hoisted.
        function rpKinds() {
            return [['prompt', 'prompt'], ['stage', loc('disp.stage2', '階段')], ['gate', 'gate'], ['out', loc('disp.dispatchedOut', '派出')], ['back', loc('disp.returnedBack', '回來')],
                ['edit', loc('disp.editedFiles', '改檔')], ['commit', 'commit'], ['test', loc('disp.tests', '測試')]];
        }
        // Each event goes to the last stage entered at or before it, the way
        // `windowsFrom` in lib/registry.js buckets; one before every stage, or
        // with no time, goes to a segment of its own.
        function segmentsOf(events, stages) {
            var st = (stages || []).filter(function (w) { return w && isNum(w.from); })
                .slice().sort(function (a, b) { return a.from - b.from; });
            var segs = st.map(function (w) {
                return { stage: w.stage, from: w.from, to: isNum(w.to) ? w.to : null, burn: isNum(w.burn) ? w.burn : null,
                    usd: isNum(w.usd) ? w.usd : null, estimated: w.estimated === true, waited: isNum(w.waited) ? w.waited : null, rows: [] };
            });
            var loose = { stage: null, from: null, to: null, burn: null, usd: null, waited: null, rows: [] };
            (events || []).forEach(function (e, i) {
                var k = -1;
                if (isNum(e.t)) for (var j = 0; j < segs.length; j++) if (segs[j].from <= e.t) k = j;
                (k < 0 ? loose : segs[k]).rows.push({ e: e, i: i });
            });
            return (loose.rows.length || !segs.length ? [loose] : []).concat(segs);
        }
        function rpTag(kind, extra) {
            var name = kind;
            rpKinds().forEach(function (k) { if (k[0] === kind) name = k[1]; });
            return '<span class="tg ' + esc(kind) + (extra ? ' ' + extra : '') + '">' + esc(name) + '</span>';
        }
        // A span of milliseconds to the second, the way the mockup reads a
        // segment's time; `mins` rounds too hard for a stage of a few minutes.
        function took(ms) { return isNum(ms) ? dur(Math.round(Math.max(ms, 0) / 1000)) : '—'; }
        function replayRow(x, e, i, off) {
            var tx;
            if (e.kind === 'gate') {
                // The question, the options offered with the one taken marked,
                // and the answer: a gate reads as the pair it was.
                tx = '<div class="gp" data-block="gate-pair">' + rpTag('gate')
                    + (isFinite(e.askedAt) ? loc('disp.waitedT', '等了 {t}', { t: dur(Math.round((e.t - e.askedAt) / 1000)) }) + '<span class="w">' + loc('disp.askedArrowAnswered', '{a} 問 → {b} 答', { a: stamp(e.askedAt).slice(11), b: isFinite(e.t) ? stamp(e.t).slice(11) : '—' }) + '</span>' : '')
                    + e.qs.map(function (q) {
                        var labels = Array.isArray(q.labels) ? q.labels : [];
                        return '<div class="qa"><span class="k">' + loc('disp.question', '問') + '</span><div class="q">' + esc(q.q)
                            + (labels.length ? '<div class="opts">' + labels.map(function (l) {
                                return '<span' + (l === q.a ? ' class="on"' : '') + '>' + esc(l) + '</span>';
                            }).join('') + '</div>' : '')
                            + '</div><span class="k">' + loc('disp.answer2', '答') + '</span><div class="a">'
                            + esc(q.a === null ? loc('disp.noAnswer', '（沒有答案）') : q.a) + (q.own ? '<span class="own">' + loc('disp.wroteOwn', '自己寫的') + '</span>' : '') + '</div></div>';
                    }).join('') + '</div>';
            } else if (e.kind === 'out') {
                // A dispatch is one card from out to back: who went, how long it
                // was away, what it returned, and its own steps folded.
                var d = x.dispatches[e.disp];
                var back = d && isNum(d.back) ? d.back : null;
                tx = '<div class="ad" data-block="agent-dispatch">' + rpTag('out') + esc(e.text) + '<div class="sub">'
                    + esc(e.surface + (e.agentType ? ' · ' + e.agentType : '') + (e.alias ? ' · ' + e.alias : '')) + '</div>'
                    + (d && isNum(d.out) ? '<div class="span"><span class="tt">' + stamp(d.out).slice(11) + '</span><span class="ln' + (back === null ? ' open' : '') + '"></span>'
                        + '<span class="tt">' + (back === null ? loc('disp.notBackYet2', '還沒回來') : stamp(back).slice(11) + ' · ' + took(back - d.out)
                            + (isNum(d.ret) ? loc('disp.dotReturnedNChars', ' · 回傳 {n} 字元', { n: comma(d.ret) }) : '')) + '</span></div>' : '')
                    + stepsFor(x, d) + '</div>';
            } else if (e.kind === 'edit') {
                tx = '<details class="tc" data-block="tool-collapsed" data-key="tc-' + i + '"><summary>' + rpTag('edit') + loc('disp.editedNFiles', '改了 {n} 個檔', { n: e.files.length }) + '</summary>'
                    + '<div class="to" data-block="tool-output">' + e.files.map(function (f) {
                        return '<span class="fl">' + esc(f.f) + (f.n > 1 ? ' ×' + f.n : '') + '</span>';
                    }).join(loc('disp.listSep', '、')) + '</div></details>';
            } else {
                var body;
                if (e.kind === 'prompt') body = '<span class="q">' + esc(e.text) + '</span>' + (e.cmd ? '<div class="sub">' + esc(e.cmd) + '</div>' : '');
                else if (e.kind === 'stage') {
                    body = esc(e.verb === 'stage' ? e.stage : e.verb + (e.stage ? ' · ' + e.stage : ''))
                        + (e.text ? '<div class="sub">' + esc(e.text) + '</div>' : '');
                } else if (e.kind === 'back') {
                    body = esc(e.text) + '<div class="sub">' + loc('disp.returnedColon2', '回傳 {v}', { v: e.ret === null || e.ret === undefined ? '—' : loc('disp.nCharsSuffix', '{n} 字元', { n: comma(e.ret) }) }) + '</div>';
                } else if (e.kind === 'commit') body = '<span class="sha">' + esc(e.sha) + '</span>' + esc(e.text);
                else body = esc(e.text);
                tx = rpTag(e.kind, e.kind === 'test' && /ℹ fail 0(?!\d)/.test(e.text || '') ? 'ok' : '') + body;
            }
            return '<li data-kind="' + esc(e.kind) + '" id="rv-' + i + '"' + (off[e.kind] ? ' hidden' : '') + ' data-t="' + (isFinite(e.t) ? e.t : '') + '"><span class="tm">'
                + (isFinite(e.t) ? stamp(e.t).slice(11) : '—') + '</span><div class="tx">' + tx + '</div></li>';
        }
        function replayHtml(x, hidden, s) {
            var off = hidden || {};
            var count = {};
            x.events.forEach(function (e) { count[e.kind] = (count[e.kind] || 0) + 1; });
            var segs = segmentsOf(x.events, s && s.stages);
            var span = function (g) { return isNum(g.from) && isNum(g.to) ? Math.max(g.to - g.from, 0) : null; };
            var total = segs.reduce(function (n, g) { return n + (span(g) || 0); }, 0);
            var usdAll = segs.reduce(function (n, g) { return n + (g.usd || 0); }, 0);
            var waitAll = segs.reduce(function (n, g) { return n + (g.waited || 0); }, 0);
            var name = function (g) { return g.stage || loc('disp.unsegmented', '未分段'); };
            var color = function (g) { return STAGE_C[g.stage] || '#888'; };
            var burnSum = segs.reduce(function (n, g) { return n + (g.burn || 0); }, 0);
            var pct = function (v) { return Math.min(Math.max(v, 0), 100).toFixed(1) + '%'; };
            // Where the session sat waiting on a gate, hatched over the stage it
            // was asked in: each gate row's askedAt to its answer, placed inside
            // its own segment's share of the track.
            var waits = function (g) {
                var sp = span(g);
                if (!sp) return '';
                return g.rows.filter(function (r) { return r.e.kind === 'gate' && isNum(r.e.askedAt) && isNum(r.e.t); }).map(function (r) {
                    var a = Math.max(r.e.askedAt, g.from), b = Math.min(r.e.t, g.to);
                    if (b <= a) return '';
                    return '<i class="wait" style="left:' + pct((a - g.from) / sp * 100) + ';width:' + pct((b - a) / sp * 100) + '"></i>';
                }).join('');
            };
            var track = function (label, value, share, text) {
                return '<span class="lab">' + label + '</span><div class="trk">' + segs.map(function (g, k) {
                    var w = share(g);
                    if (!w) return '';
                    return '<button type="button" class="rs" data-rs="rs-' + k + '" style="flex:0 0 ' + w.toFixed(1) + '%;background:' + color(g) + '" title="'
                        + esc(name(g)) + ' · ' + took(span(g)) + ' · context ' + tokens(g.burn) + (g.usd === null ? '' : ' · ' + usd(g.usd) + estMark(g)) + '">'
                        + (w > 9 ? text(g) : '') + (label === loc('disp.time2', '時間') ? waits(g) : '') + '</button>';
                }).join('') + '</div><span class="val">' + value + '</span>';
            };
            var strip = '<div class="rpcs" data-block="cost-strip">' + (total ? '<div class="cs">'
                + track(loc('disp.time2', '時間'), took(total), function (g) { return span(g) === null ? 0 : span(g) / total * 100; }, function (g) {
                    return esc(name(g)) + '<span class="v">' + took(span(g)) + '</span>';
                })
                + (usdAll ? track(loc('disp.cost3', '花費'), usd(usdAll, true) + estMark({ estimated: segs.some(function (g) { return g.estimated; }) }), function (g) { return (g.usd || 0) / usdAll * 100; }, function (g) { return usd(g.usd, true) + estMark(g); }) : '')
                + '<div class="key">' + (waitAll ? '<span><i class="sw hatch"></i>' + loc('disp.waitingOnYouGatePct', '等你回答 gate（{t}，佔 {p}%）', { t: took(waitAll), p: Math.round(waitAll / total * 100) }) + '</span>' : '') + '<span>' + loc('disp.clickJumpToStage', '點一段就跳到那個階段') + '</span></div></div>' : '')
                + (s ? '<p class="tally">' + loc('disp.segmentsSumB', '各段 context 相加 <b>{n}</b>', { n: comma(burnSum) }) + ' <span class="' + (burnSum === (s.burn || 0) ? 'eq">' + loc('disp.equalsSign', '＝') : 'ne">' + loc('disp.notEqualsSign', '≠'))
                    + '</span> ' + loc('disp.sessionsBurnN', '這個 session 的 burn {n}', { n: comma(s.burn || 0) }) + '</p>' : '') + '</div>';
            var KEY = { gate: 1, out: 1, commit: 1 };
            var keyText = function (e) {
                var t = e.kind === 'gate' ? (e.qs[0] ? (e.qs[0].a === null ? loc('disp.noAnswer', '（沒有答案）') : e.qs[0].a) : '')
                    : e.kind === 'commit' ? e.sha + ' ' + e.text : e.text;
                return String(t || '').slice(0, 40);
            };
            var last = null;
            x.events.forEach(function (e) { if (isNum(e.t) && (last === null || e.t > last)) last = e.t; });
            var toc = '<nav class="rptoc" data-block="toc" aria-label="' + loc('disp.tableOfContents', '段落目錄') + '"><div class="h">' + loc('disp.contents', '目錄') + '</div><ol>' + segs.map(function (g, k) {
                var keys = g.rows.filter(function (r) { return KEY[r.e.kind]; });
                return '<li><button type="button" class="rs sg" data-rs="rs-' + k + '"><i class="bar" style="background:' + color(g) + '"></i><b>' + esc(name(g)) + '</b>'
                    + '<span class="d">' + took(span(g)) + '</span><span class="m">' + (isNum(g.from) ? stamp(g.from).slice(11, 16) + ' · ' : '')
                    + 'context ' + tokens(g.burn) + (g.usd === null ? '' : ' · ' + usd(g.usd, true) + estMark(g)) + ' · ' + loc('disp.nRows2', '{n} 列', { n: g.rows.length }) + '</span></button>'
                    + (keys.length ? '<ol>' + keys.map(function (r) {
                        return '<li><button type="button" class="rs" data-rs="rv-' + r.i + '"><span class="tm">' + (isFinite(r.e.t) ? stamp(r.e.t).slice(11, 16) : '—')
                            + '</span>' + rpTag(r.e.kind) + '<span class="kt">' + esc(keyText(r.e)) + '</span></button></li>';
                    }).join('') + '</ol>' : '') + '</li>';
            }).join('') + '</ol><div class="tf">' + loc('disp.nRows2', '{n} 列', { n: x.events.length }) + (last === null ? '' : loc('disp.lastRowAt', '<br>最後一列 {t}', { t: stamp(last).slice(11) })) + '</div></nav>';
            var bar = '<div class="rpf" data-block="filter-bar" role="group" aria-label="' + loc('disp.eventKinds', '事件種類') + '">' + rpKinds().map(function (k) {
                return '<button type="button" data-rk="' + k[0] + '" data-key="rk-' + k[0] + '" aria-pressed="' + !off[k[0]] + '">' + k[1] + '<span class="n">'
                    + (count[k[0]] || 0) + '</span></button>';
            }).join('') + '<span class="spacer"></span><button type="button" class="rpx-all" data-xall>' + loc('disp.expandAll2', '全部展開') + '</button></div>';
            var body = segs.map(function (g, k) {
                var n = function (kind) { return g.rows.filter(function (r) { return r.e.kind === kind; }).length; };
                var prev = k > 0 && segs[k - 1].stage ? segs[k - 1].stage + ' → ' + name(g) : 'start';
                return '<details class="rpseg" id="rs-' + k + '" open><summary class="sh" data-block="segment-header" data-burn="' + (g.burn === null ? '' : g.burn) + '">'
                    + '<i class="band" style="background:' + color(g) + '"></i><div><div class="t"><b>' + esc(name(g)) + '</b>'
                    + (isNum(g.from) ? '<span class="from">' + esc(prev) + ' · ' + stamp(g.from).slice(11) + '</span>' : '')
                    + '<span class="caret" aria-hidden="true">▶</span></div>'
                    + '<div class="ct"><span><b>' + n('gate') + '</b> gate</span><span><b>' + n('out') + '</b> ' + loc('disp.dispatchedOut', '派出') + '</span><span><b>' + n('commit') + '</b> commit</span>'
                    + '<span>' + loc('disp.nRows2', '{n} 列', { n: g.rows.length }) + '</span></div></div>'
                    + '<dl class="m"><dt>' + loc('disp.timeSpent2', '耗時') + '</dt><dd class="big">' + took(span(g)) + '</dd><dt>context</dt><dd>' + tokens(g.burn) + '</dd>'
                    + (g.usd === null ? '' : '<dt>' + loc('disp.cost3', '花費') + '</dt><dd>' + usd(g.usd) + estMark(g) + '</dd>')
                    + (g.waited ? '<dt>' + loc('disp.waitedGate', '等 gate') + '</dt><dd>' + took(g.waited) + '</dd>' : '') + '</dl></summary>'
                    + '<ol class="rp">' + g.rows.map(function (r) { return replayRow(x, r.e, r.i, off); }).join('') + '</ol></details>';
            }).join('');
            return '<div class="rpw">' + strip + '<div class="rpb">' + toc + '<div class="rpm">' + bar + body + '<p class="tally">' + loc('disp.nRows2', '{n} 列', { n: x.events.length })
                + (x.dropped ? loc('disp.over300RowsDropped', '；超過 300 列，只留 gate、階段、commit 與派工，丟掉了 {n} 列', { n: x.dropped }) : '') + '</p></div></div></div>';
        }

        // ---- 記成 TODO -------------------------------------------------------
        // One TODO line — an entry's description, or a TODO.md bullet — in the shape todo-check
        // reads: the text, then the link it points at. `scripts/station.js`
        // builds the line it writes with this same function.
        function todoEntry(text, link) {
            var l = String(link || '').trim();
            var label = l ? (l.split('#')[0].split('/').pop() || l) : '';
            return String(text || '').replace(/\s+/g, ' ').trim() + (l ? ' — [' + label + '](' + l + ')' : '');
        }
        function riseTodo(id, r) {
            return loc('todo.stationTag', '〔station〕') + String(id).slice(0, 8) + loc('todo.turnFromTo', ' 回合 {from}→{to}', { from: r.from, to: r.n }) + ' context +' + tokens(r.dy) + loc('todo.colon', '：')
                + (r.cause === 'self' ? r.self.label
                    : r.top[0] ? loc('todo.labelNChars', '{l} {n} 字元', { l: r.top[0].label, n: comma(r.top[0].chars) }) : loc('todo.incomingOutput', '進來的輸出'));
        }
        function backTodo(id, b) {
            return loc('todo.stationTag', '〔station〕') + String(id).slice(0, 8) + ' ' + b.from + '→' + b.to + loc('todo.backtrackAtStayed', ' 倒退（{at}，{from} 待了 {t}）：', { at: stamp(b.at), from: b.from, t: mins(b.at - b.since) }) + loc('todo.caughtWhyNot', '{from} 抓到的，{to} 為什麼沒抓到', { from: b.from, to: b.to });
        }
        // Served, a form that posts the line to `/todo`, which checks it with
        // todo-check's own rules before writing and answers 400 with the rule that
        // failed. A file on disk cannot post, so it prints the line to copy.
        function todoSpot(text, link, s) {
            if (!K.S().serve) {
                return '<div class="td"><div class="tdc"><code>- ' + esc(todoEntry(text, link)) + '</code></div>'
                    + '<div class="tds">' + loc('todo.staticPageCopyLine', '靜態頁不寫檔：有 todo 資料夾就用 todo.js new 記下這一行，否則貼進 TODO.md 的 ## Needs a decision。') + '</div></div>';
            }
            return '<details class="td"><summary class="tdb">' + loc('todo.recordAsTodo', '記成 TODO') + ' <span class="m">POST /todo</span></summary>'
                + '<div class="tdf" data-todo-root="' + esc(s.root) + '" data-todo-id="' + esc(s.id) + '">'
                + '<label>' + loc('todo.entryLabel', '條目（一行：todo 資料夾的 description，或 TODO.md 的 ## Needs a decision）') + '</label><textarea rows="2" spellcheck="false">'
                + esc(text) + '</textarea><label>' + loc('todo.link', '連結') + '</label><input type="text" spellcheck="false" value="' + esc(link) + '">'
                + '<label>' + loc('todo.bodyLabel', 'body（有 todo 資料夾時必填，至少 200 字元：從哪來、要做成什麼樣、怎樣算完成）') + '</label><textarea class="tdbd" rows="5" spellcheck="false"></textarea>'
                + '<div class="help">' + loc('todo.checkedBeforeSubmit', '送出前跑 todo-check 的同一套規則：條目 ≤ 200 字元、連結要存在、不指向 plan、decision、report、archive；有 todo 資料夾時 body 至少 200 字元。') + '</div>'
                + '<div class="act"><button type="button" class="go" data-todo>' + loc('todo.submit', '送出') + '</button></div>'
                + '<div class="tdr" role="status" aria-live="polite"></div></div></details>';
        }
        return {
            sums: sums,
            estOf: estOf,
            numCells: numCells,
            isNum: isNum,
            agentState: agentState,
            toolText: toolText,
            stepLabel: stepLabel,
            stepLi: stepLi,
            agentPill: agentPill,
            agdots: agdots,
            stateTally: stateTally,
            modelOf: modelOf,
            nowLine: nowLine,
            agentCounts: agentCounts,
            agentRow: agentRow,
            agentBody: agentBody,
            dispatchHtml: dispatchHtml,
            dxChartHtml: dxChartHtml,
            stepsFor: stepsFor,
            rpKinds: rpKinds,
            segmentsOf: segmentsOf,
            rpTag: rpTag,
            took: took,
            replayRow: replayRow,
            replayHtml: replayHtml,
            todoEntry: todoEntry,
            riseTodo: riseTodo,
            backTodo: backTodo,
            todoSpot: todoSpot
        };
    }
    var api = { make: make };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_DISPATCH = api;
}(typeof window !== 'undefined' ? window : null));
