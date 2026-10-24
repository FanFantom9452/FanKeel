'use strict';
// assets/station/focus-page.js — the focus page, /f/<id>/plan and
// /f/<id>/gate (docs/90-agent/plans/2026-10-21-station-focus-design.md §1):
// one session's plan as build will send it, or its gate question over the
// report. Moved out of station.js (station-52). lib/station.js `focusShell`
// loads it after gate-frame.js and before station.js, whose `focusBoot`
// paints `page()` into #focus every five seconds. What only station.js
// draws — the glyph, the stage, the gate tab's report, the shells — comes
// through window.FK_KIT, read when a page is drawn and never at load.
(function (w, doc) {
    var EN = {
        'focus.unnamed': '(unnamed)',
        'focus.open': 'Open the full station',
        'focus.effortDefault': 'default',
        'focus.inSession': 'main session',
        'focus.user': 'yours',
        'focus.noDispatch': 'no Dispatch line',
        'focus.noLedger': 'no ledger line',
        'focus.complete': 'done',
        'focus.fixN': 'fixed {n}×',
        'focus.noRange': 'no commit range',
        'focus.kindFiles': 'both change one file',
        'focus.kindRead': 'one reads what the other changes',
        'focus.kindIface': 'uses an interface the other produces',
        'focus.kindUndeclared': 'one side declares no files',
        'focus.waitTip': 'Task {n}: {k}',
        'focus.planNone': 'No plan file in this session\'s claims yet.',
        'focus.planUnreadable': 'Cannot read {p}: the file is there but will not open.',
        'focus.planNoTasks': 'No <code>## Task N:</code> heading in {p}.',
        'focus.jump': 'Jump to group',
        'focus.groups': '<b>{n}</b> groups, in order',
        'focus.edges': '<b>{n}</b> dependencies',
        'focus.done': '<b>{n}</b> done',
        'focus.fixes': '<b>{n}</b> fixes',
        'focus.alone': '1 alone',
        'focus.parallel': '{n} in parallel',
        'focus.after': 'Sent once G{n} is all back',
        'focus.first': 'Sent first',
        'focus.next': 'Next',
        'focus.groupDone': '<b>{d}</b>/{n} done',
        'focus.colFiles': 'Files changed',
        'focus.colTest': 'Tests',
        'focus.colWait': 'Waits',
        'focus.colDispatch': 'Dispatch',
        'focus.rec': 'Recommended',
        'focus.gateQ': '{st} gate: {q}',
        'focus.noQ': 'The report has no gate question to read',
        'focus.serveDown': 'is serve running?',
        'focus.reportNext': 'Next step in the report',
        'focus.where': 'The answer is given in Claude Desktop; this page only shows what you are approving and takes no answer.',
        'focus.report': '{s} report',
        'focus.noSession': 'No session {id} on this page',
    };
    function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    function loc(key, zh, vars) {
        var I = w && w.FK_I18N;
        return kit().fillVars(I && I.lang === 'en' && has(EN, key) ? EN[key] : zh, vars);
    }
    function kit() { return (w && w.FK_KIT) || {}; }
    function esc(s) { return kit().esc(s); }
    function family(model) { return kit().family(model); }
    function icon(name) { return kit().icon(name); }
    function keelProgress(s) { return kit().keelProgress(s); }
    function stageNow(s) { return kit().stageNow(s); }
    function planNewest(list) { return kit().planNewest(list); }
    function gateTabHtml(s, g, tasks) { return kit().gateTabHtml(s, g, tasks); }
    function shellsHtml(shells, now) { return kit().shellsHtml(shells, now); }

    var FOCUS_ARROW = '<svg class="ico" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5h6.5V10M12.5 3.5 4 12"/></svg>';
    function focusHeader(s, tab) {
        return '<header class="fh" data-block="focus-header">'
            + '<span class="fh-mark">' + keelProgress(s) + '</span>'
            + '<span class="fh-stage" style="--c:var(--st-' + esc(s.stage) + ')">' + stageNow(s) + '</span>'
            + '<h1 class="fh-task">' + esc(s.task || loc('focus.unnamed', '（未命名）')) + '</h1>'
            + '<span class="fh-sid mono" title="session ' + esc(s.id) + '">' + esc(String(s.id).slice(0, 8)) + '</span>'
            + '<a class="fh-open" href="/#/s/' + esc(encodeURIComponent(s.id)) + '/' + esc(tab) + '">' + loc('focus.open', '開完整 station') + FOCUS_ARROW + '</a></header>';
    }
    // A Files path as the reviewer scans it: the directory muted, the name
    // bold, a `:a-b` range small.
    function fpFile(x) {
        var m = /^(.*\/)?([^/]*?)(:\d+-\d+)?$/.exec(String(x)) || [null, '', String(x), ''];
        return '<li title="' + esc(x) + '"><span class="dir">' + esc(m[1] || '') + '</span><b>' + esc(m[2]) + '</b>' + (m[3] ? '<small>' + esc(m[3]) + '</small>' : '') + '</li>';
    }
    function fpDispatch(t) {
        if (t.dispatch === 'implementer') {
            return '<span class="fp-m"><i class="sw" style="background:var(--m-' + family('claude-' + (t.model || '')) + ')"></i>' + esc(t.model || '') + '</span>'
                + '<span class="fp-e">' + esc(t.effort || loc('focus.effortDefault', '預設')) + '</span>';
        }
        if (t.dispatch === 'in-session') return '<span class="fp-who">' + loc('focus.inSession', '主 session') + '</span>';
        if (t.dispatch === 'user') return '<span class="fp-who">' + loc('focus.user', '交給你') + '</span>';
        return '<span class="fp-who">' + loc('focus.noDispatch', '沒有 Dispatch 行') + '</span>';
    }
    function fpStatus(t) {
        if (t.status !== 'complete') return '<span class="pill sm pend">' + loc('focus.noLedger', 'ledger 沒這行') + '</span>';
        var range = t.range ? String(t.range).split('..').map(function (x) { return x.slice(0, 8); }).join('..') : '';
        return '<span class="pill sm ok">' + loc('focus.complete', '完成') + '</span>'
            + (t.fixes ? '<span class="fp-fix">' + loc('focus.fixN', '修 {n} 次', { n: t.fixes }) + '</span>' : '')
            + '<code class="fp-range">' + (range ? esc(range) : loc('focus.noRange', '沒有 commit 範圍')) + '</code>';
    }
    function fpRow(t) {
        var kind = { files: loc('focus.kindFiles', '同改一個檔'), read: loc('focus.kindRead', '一個讀、一個改'),
            interface: loc('focus.kindIface', '用到對方產出的介面'), undeclared: loc('focus.kindUndeclared', '有一方沒宣告檔案') };
        var waits = t.waits || [], tests = t.test || [];
        return '<li class="fp-row' + (t.status === 'complete' ? ' is-done' : '') + '" data-n="' + t.n + '">'
            + '<span class="fp-n num">' + t.n + '</span>'
            + '<span class="fp-t">' + esc(t.title).replace(/`([^`]+)`/g, '<code>$1</code>') + '</span>'
            + '<ul class="fp-files">' + (t.modify || []).map(fpFile).join('') + '</ul>'
            + '<span class="fp-test num" title="' + esc(tests.join('\n')) + '">' + (tests.length || '<i>—</i>') + '</span>'
            + '<span class="fp-wait num">' + (waits.length ? waits.map(function (w) {
                return '<span title="' + esc(loc('focus.waitTip', 'Task {n}：{k}', { n: w.n, k: kind[w.kind] || w.kind }) + (w.file ? ' ' + w.file : '')) + '">' + w.n + '</span>';
            }).join('') : '<i>—</i>') + '</span>'
            + '<span class="fp-d">' + fpDispatch(t) + '</span>'
            + '<span class="fp-s">' + fpStatus(t) + '</span></li>';
    }
    // The plan for review: the counts and a chip per group, then every task
    // as a row under its group, in the order build sends them.
    function focusPlanHtml(list) {
        var p = planNewest(list);
        var code = function (x) { return '<code>' + esc(x) + '</code>'; };
        var empty = function (cls, text) { return '<section class="panel pv"><p class="pv-empty' + cls + '">' + text + '</p></section>'; };
        if (!p) return empty('', loc('focus.planNone', '這個 session 的 claims 裡還沒有 plan 檔。'));
        if (p.error === 'unreadable') return empty(' err', loc('focus.planUnreadable', '讀不到 {p}：檔案在，但打不開。', { p: code(p.plan) }));
        if (!p.tasks.length) return empty(' err', loc('focus.planNoTasks', '{p} 裡找不到 <code>## Task N:</code> 標題。', { p: code(p.plan) }));
        var byN = {}, done = 0, edges = 0, models = {};
        p.tasks.forEach(function (t) {
            byN[t.n] = t;
            if (t.status === 'complete') done++;
            edges += (t.waits || []).length;
            if (t.dispatch === 'implementer' && t.model) models[t.model] = (models[t.model] || 0) + 1;
        });
        var doneIn = function (g) { return g.tasks.filter(function (n) { return byN[n] && byN[n].status === 'complete'; }).length; };
        var next = null;
        p.groups.forEach(function (g) { if (next === null && doneIn(g) < g.tasks.length) next = g.g; });
        var jump = '<nav class="fp-jump" aria-label="' + esc(loc('focus.jump', '跳到組')) + '">' + p.groups.map(function (g) {
            var d = doneIn(g);
            return '<a href="#g' + g.g + '" class="' + (d === g.tasks.length ? 'is-done' : g.g === next ? 'is-next' : '') + '" style="--w:' + g.tasks.length + '">'
                + '<b>G' + g.g + '</b><span class="num">' + d + '/' + g.tasks.length + '</span><i style="--p:' + (d / g.tasks.length) + '"></i></a>';
        }).join('') + '</nav>';
        var sum = '<section class="panel pv fp-sum" data-block="plan-summary"><div class="srcline pv-src" title="' + esc(p.plan) + '">' + esc(p.plan) + '</div>'
            + '<ul class="pv-counts"><li><b>' + p.tasks.length + '</b>task</li>'
            + '<li>' + loc('focus.groups', '<b>{n}</b>組，依序跑', { n: p.groups.length }) + '</li>'
            + '<li>' + loc('focus.edges', '<b>{n}</b>條相依', { n: edges }) + '</li>'
            + '<li>' + loc('focus.done', '<b>{n}</b>完成', { n: done }) + '</li>'
            + '<li>' + loc('focus.fixes', '<b>{n}</b>次修正', { n: p.fixes || 0 }) + '</li>'
            + (Object.keys(models).length ? '<li class="pv-mods"><span class="pv-ml">implementer</span>' + Object.keys(models).map(function (m) {
                return '<span class="chip"><i class="sw" style="background:var(--m-' + family('claude-' + m) + ')"></i>' + esc(m) + ' × ' + models[m] + '</span>';
            }).join('') + '</li>' : '') + '</ul>' + jump + '</section>';
        var groups = p.groups.map(function (g, i) {
            var d = doneIn(g);
            var par = g.tasks.length === 1 ? loc('focus.alone', '單獨 1 個') : loc('focus.parallel', '可並行 {n} 個', { n: g.tasks.length });
            return '<section class="fg' + (d === g.tasks.length ? ' is-done' : '') + '" id="g' + g.g + '" data-block="plan-g' + g.g + '" aria-label="G' + g.g + ' · ' + esc(par) + '">'
                + '<header class="fg-h"><span class="gb">G' + g.g + '</span><span class="mono fg-surf">' + esc(g.surface) + '</span><span class="fg-par">' + par + '</span>'
                + '<span class="fg-after">' + (i ? loc('focus.after', 'G{n} 全部回來才派', { n: g.g - 1 }) : loc('focus.first', '先派')) + '</span>'
                + (g.g === next ? '<span class="fg-next">' + loc('focus.next', '接下來') + '</span>' : '')
                + '<span class="fg-done num">' + loc('focus.groupDone', '<b>{d}</b>/{n} 完成', { d: d, n: g.tasks.length }) + '</span></header>'
                + '<ol class="fp-rows">' + g.tasks.map(function (n) { return byN[n] ? fpRow(byN[n]) : ''; }).join('') + '</ol></section>';
        }).join('');
        return sum + '<section class="panel pv fp-list" data-block="plan-list"><div class="fp-cols" aria-hidden="true"><span>#</span><span>task</span>'
            + '<span>' + loc('focus.colFiles', '改的檔') + '</span><span>' + loc('focus.colTest', '測') + '</span><span>' + loc('focus.colWait', '等') + '</span>'
            + '<span>' + loc('focus.colDispatch', '派工') + '</span><span>ledger</span></div>' + groups + '</section>';
    }
    // The 關卡 tab's report under its own head, without the tab's banner: the
    // question is drawn elsewhere — above it here, beside it in gate-frame.js.
    function focusReportHtml(s, g, tasks) {
        var stage = g && g.stage ? g.stage : s.stage || '';
        // gateTabHtml with no wait on the row draws its head, not its banner.
        var calm = Object.assign({}, s, { gateAt: null, pending: null });
        return '<section class="panel pv gv gr" data-block="gate-report"><div class="gr-hd"><h2>' + loc('focus.report', '{s} 報告', { s: esc(stage) }) + '</h2></div>'
            + gateTabHtml(calm, g, tasks) + '</section>';
    }
    // The gate first: its question and options as the session will ask them,
    // then the report under it.
    function focusGateHtml(s, g, tasks) {
        var REC = /\s*\(Recommended\)\s*$/;
        var q = g && g.gate && g.gate.questions && g.gate.questions[0] ? g.gate.questions[0] : null;
        var stage = g && g.stage ? g.stage : s.stage || '';
        var st = '<span class="gv-st" style="--c:var(--st-' + esc(stage) + ')">' + esc(stage) + '</span>';
        var opts = q && Array.isArray(q.options) ? '<ol class="gq-opts">' + q.options.map(function (o, i) {
            var label = String(o && o.label || ''), rec = REC.test(label);
            return '<li class="' + (rec ? 'is-rec' : '') + '"><span class="gq-n num">' + (i + 1) + '</span><div><p class="gq-l">' + esc(label.replace(REC, ''))
                + (rec ? '<span class="gq-rec">' + loc('focus.rec', '建議') + '</span>' : '') + '</p>'
                + (o && o.description ? '<p class="gq-d">' + esc(o.description) + '</p>' : '') + '</div></li>';
        }).join('') + '</ol>' : '';
        var ask = '<section class="panel pv gq" data-block="gate-question"><div class="pv-banner"><div class="pv-q"><span class="pill gate">' + icon('gate') + 'gate</span>'
            + (q && q.header ? '<span class="chip">' + esc(q.header) + '</span>' : '') + '</div>'
            + '<h2 class="gq-h">' + loc('focus.gateQ', '{st} gate：{q}', { st: st, q: q ? esc(q.question) : loc('focus.noQ', '報告裡沒有讀得出的 gate 問題') }) + '</h2>'
            + opts
            + (g && g.gate && g.gate.next ? '<p class="gq-next"><span>' + loc('focus.reportNext', '報告寫的下一步') + '</span>' + esc(g.gate.next) + '</p>' : '')
            + '<p class="pv-where"><i class="hatchsw" aria-hidden="true"></i><span>' + loc('focus.where', '回答在 Claude Desktop 那邊給；這頁只讓你看清楚要核准什麼，不收答案。') + '</span></p></div></section>';
        return ask + focusReportHtml(s, g, tasks);
    }
    // The gate page's free-text answer: offered when the station is served and
    // the hook holds exactly one question (POST /answer maps every question
    // asked to an answer, so a second question could not be answered by one
    // string). The POST is the one the floating gate makes, to /answer.
    function focusAnswerOf(st, s) {
        var qs = s && s.pending && s.pending.questions;
        if (!st.serve || !s.root || !qs || qs.length !== 1) return null;
        var question = qs[0].question;
        return { question: question, send: function (text) {
            var answers = {};
            answers[question] = text;
            var form = new URLSearchParams();
            form.set('nonce', st.nonce || '');
            form.set('root', s.root);
            form.set('id', s.id);
            form.set('answers', JSON.stringify(answers));
            fetch('/answer', { method: 'POST', body: form }).then(function (r) {
                return r.text().then(function (t) { w.FK_GATE.say(r.ok ? 'ok' : 'bad', (r.ok ? '' : r.status + ' - ') + t.trim()); });
            }).catch(function () { w.FK_GATE.say('bad', loc('focus.serveDown', 'serve 還在跑嗎？')); });
        } };
    }
    function focusPageHtml(st, details, focus) {
        var s = ((st && st.sessions) || []).filter(function (x) { return x.id === focus.id; })[0];
        if (!s) return '<main class="fm"><section class="panel"><p class="note">' + loc('focus.noSession', '這頁上沒有 session {id}', { id: esc(focus.id) }) + '</p></section></main>';
        var x = (details || {})[s.id] || { tasks: [], gate: null };
        var gate = focus.tab === 'gate';
        // Background shells sit under the header (design §5), drawn by Task 5's shellsHtml.
        var shells = x.shells && x.shells.length ? shellsHtml(x.shells, Date.now()) : '';
        // The redesigned gate page (station redesign §5) is assets/station/gate-frame.js:
        // loaded, it draws the whole tab — its own head with no tabs, the report
        // in the main column, the question in the side column — around the
        // report drawn here, which only station.js can draw.
        if (gate && w.FK_GATE && typeof w.FK_GATE.frame === 'function') {
            return w.FK_GATE.frame({ session: s, gate: x.gate, tasks: x.tasks || [], reportHtml: focusReportHtml(s, x.gate, x.tasks || []), shellsHtml: shells,
                answer: focusAnswerOf(st, s) });
        }
        return focusHeader(s, focus.tab) + shells + '<main class="fm" data-block="focus-' + (gate ? 'gate' : 'plan') + '">'
            + (gate ? focusGateHtml(s, x.gate, x.tasks || []) : focusPlanHtml(x.tasks)) + '</main>';
    }
    // A <details> on the focus page the reader opened stays open through the
    // 5 s repaint, which rewrites the whole page (station-37). Only the
    // report's folds carry a data-gv key; the rest are short.
    function keepOpen(html, open) {
        return String(html).replace(/<details class="gv-more" data-gv="([a-z]+)"/g, function (m, k) { return open[k] ? m + ' open' : m; });
    }
    // Whether the 5 s repaint may replace the page: not when the markup is the
    // one already drawn (a click in flight keeps its target node), and not
    // while the reader has a text field focused (the repaint would drop what
    // they typed). `active` is document.activeElement.
    function focusRepaint(last, html, active) {
        if (last === html) return false;
        var tag = active && active.tagName ? String(active.tagName).toUpperCase() : '';
        return !(tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT');
    }

    var api = { page: focusPageHtml, keepOpen: keepOpen, repaint: focusRepaint, EN: EN };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_FOCUS = api;
}(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null));
