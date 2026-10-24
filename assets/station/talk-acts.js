'use strict';
// assets/station/talk-acts.js — what Claude did between its words on the
// session page's 對話 tab, the way the CLI shows it: each run of tool calls
// (lib/conversation.js `turnsOf` { acts: true }) as one row with its time,
// each tool's name and one-line brief, and each sub-agent it dispatched with
// its description, type, model and state. A sub-agent row with a transcript
// is a button that opens it in a dialog of its own — what it was asked, its
// tool calls with their results, its final report — read from
// station/talk/<session>/agent/<agentId> and read again every 3 s while it
// runs. The dialog hangs off document.body, so the page's 3 s redraw does not
// take it away. While any row is running, `watch` asks
// station/talk/<session>/agents every 3 s and updates the held turns in
// place, so the next redraw shows the new state. Loaded before station.js;
// session-talk.js calls html() and watch().
(function (w, doc) {
    var EN = {
        'tact.tools': '{n} tool calls',
        'tact.more': '{n} more',
        'tact.running': 'running',
        'tact.finished': 'finished',
        'tact.failed': 'failed',
        'tact.bg': 'background',
        'tact.open': 'Open this sub-agent\'s transcript',
        'tact.noFile': 'No transcript for this sub-agent yet',
        'tact.title': 'Sub-agent',
        'tact.brief': 'What it was asked',
        'tact.steps': 'What it did',
        'tact.report': 'Final report',
        'tact.noReport': 'No report yet: it is still running',
        'tact.loading': 'Loading…',
        'tact.failedRead': 'Could not read this sub-agent\'s transcript',
        'tact.close': 'Close',
        'tact.cut': 'cut at {n} characters',
    };
    var STEP = 3000, SHOW = 8;
    function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    function fill(s, vars) {
        return vars ? String(s).replace(/\{(\w+)\}/g, function (m, k) { return has(vars, k) ? String(vars[k]) : m; }) : s;
    }
    function loc(key, zh, vars) {
        var I = w && w.FK_I18N;
        return fill(I && I.lang === 'en' && has(EN, key) ? EN[key] : zh, vars);
    }
    function kit() { return (w && w.FK_KIT) || {}; }
    function esc(s) { return kit().esc(s); }
    function two(n) { return (n < 10 ? '0' : '') + n; }
    // `HH:MM:SS` in the reader's own time zone.
    function clock(at) {
        var ms = typeof at === 'string' ? Date.parse(at) : NaN;
        if (!isFinite(ms)) return '';
        var d = new Date(ms);
        return two(d.getHours()) + ':' + two(d.getMinutes()) + ':' + two(d.getSeconds());
    }
    function stateWord(s) {
        if (s === 'running') return loc('tact.running', '執行中');
        if (s === 'failed') return loc('tact.failed', '失敗');
        return loc('tact.finished', '已完成');
    }
    function stateTag(s) {
        return '<span class="ta-st ta-' + esc(s || 'finished') + '">' + stateWord(s) + '</span>';
    }
    function tool(t) {
        return '<li class="ta-tl"><b>' + esc(t.name) + '</b>' + (t.brief ? '<code>' + esc(t.brief) + '</code>' : '') + '</li>';
    }
    function agent(a, sid) {
        var meta = [a.agentType, a.model].filter(Boolean).map(function (v) { return esc(v); });
        if (a.background) meta.push(loc('tact.bg', '背景'));
        var inner = stateTag(a.state) + '<b>' + esc(a.description || a.agentType || '') + '</b>'
            + (meta.length ? '<span class="ta-m">' + meta.join(' · ') + '</span>' : '');
        if (!a.agentId || !sid) return '<li class="ta-ag" title="' + loc('tact.noFile', '這個子 agent 還沒有 transcript') + '">' + inner + '</li>';
        return '<li class="ta-ag"><button type="button" class="ta-open" data-tact-sid="' + esc(sid) + '" data-tact-agent="' + esc(a.agentId)
            + '" aria-label="' + loc('tact.open', '打開這個子 agent 的 transcript') + '">' + inner + '</button></li>';
    }

    // One act turn as one row. `key` keeps the fold of the tools past SHOW
    // across a redraw (station.js restores <details> by data-key); `sid` is
    // the session the sub-agents belong to, '' where there is none to ask.
    function html(t, sid, key) {
        listen();
        var tools = t.tools || [], agents = t.agents || [];
        var more = tools.length > SHOW ? '<li class="ta-more"><details data-key="' + esc(key) + '-more"><summary>' + loc('tact.more', '另外 {n} 個', { n: tools.length - SHOW })
            + '</summary><ul class="ta-tls">' + tools.slice(SHOW).map(tool).join('') + '</ul></details></li>' : '';
        return '<div class="tx-act" data-block="talk-act"><time>' + clock(t.at) + '</time>'
            + (tools.length ? '<ul class="ta-tls" aria-label="' + loc('tact.tools', '{n} 個工具呼叫', { n: tools.length }) + '">' + tools.slice(0, SHOW).map(tool).join('') + more + '</ul>' : '')
            + (agents.length ? '<ul class="ta-ags">' + agents.map(function (a) { return agent(a, sid); }).join('') + '</ul>' : '') + '</div>';
    }

    // The dialog's steps: each tool call with its result folded under it,
    // and what the agent said between them.
    function steps(turns) {
        var res = {}, out = [];
        turns.forEach(function (t) { if (t.kind === 'result' && t.id) res[t.id] = t; });
        turns.forEach(function (t, i) {
            if (t.kind === 'tool') {
                var r = t.id ? res[t.id] : null;
                var head = '<time>' + clock(t.at) + '</time><b>' + esc(t.name) + '</b>' + (t.brief ? '<code>' + esc(t.brief) + '</code>' : '');
                out.push(r ? '<li class="ta-s"><details data-key="tad-' + i + '"><summary>' + head + '</summary><pre class="ta-r">' + esc(r.text)
                    + (r.cut ? '\n' + loc('tact.cut', '截在 {n} 字', { n: r.text.length }) : '') + '</pre></details></li>'
                    : '<li class="ta-s">' + head + '</li>');
            } else if (t.kind === 'claude') {
                out.push('<li class="ta-say"><time>' + clock(t.at) + '</time><div>' + esc(t.text) + '</div></li>');
            }
        });
        return out.join('');
    }
    function viewHtml(v, state) {
        var k = kit();
        var x = '<button type="button" class="tdlg-x" data-tact-close="1" aria-label="' + loc('tact.close', '關閉') + '">' + (k.icon ? k.icon('close') : '') + '</button>';
        if (!v) {
            return '<div class="tdlg-in"><div class="tdlg-hd"><b id="tact-agent-h">' + loc('tact.title', '子 agent') + '</b>' + x + '</div><p class="tally">'
                + (state === 'failed' ? loc('tact.failedRead', '讀不到這個子 agent 的 transcript') : loc('tact.loading', '讀取中…')) + '</p></div>';
        }
        var turns = v.turns || [];
        var ask = turns.filter(function (t) { return t.kind === 'user'; })[0];
        var said = turns.filter(function (t) { return t.kind === 'claude'; });
        var hasReport = v.report !== null && v.report !== undefined;
        var last = hasReport && said.length ? said[said.length - 1] : null;
        var meta = [v.agentType, v.model].filter(Boolean).map(function (s) { return esc(s); }).join(' · ');
        return '<div class="tdlg-in"><div class="tdlg-hd"><b id="tact-agent-h">' + (v.description ? esc(v.description) : loc('tact.title', '子 agent')) + '</b>'
            + (meta ? '<span class="tdlg-sub">' + meta + '</span>' : '') + stateTag(v.state) + x + '</div><div class="tad-sc">'
            + (ask ? '<details class="tad-ask" data-key="tad-ask"><summary>' + loc('tact.brief', '交辦內容') + '</summary><div class="tad-t">' + esc(ask.text) + '</div></details>' : '')
            + '<h3>' + loc('tact.steps', '做了什麼') + '</h3><ol class="tad-steps">' + steps(turns.filter(function (t) { return t !== last; })) + '</ol>'
            + '<h3>' + loc('tact.report', '最後回報') + '</h3>'
            + (hasReport ? '<div class="tad-rep">' + esc(v.report) + '</div>' : '<p class="tally">' + loc('tact.noReport', '還沒有回報：仍在執行') + '</p>')
            + '</div></div>';
    }

    var OPEN = { sid: null, id: null, view: null, state: '' }, heard = false;
    function dlg() {
        if (!doc || !doc.getElementById) return null;
        var d = doc.getElementById('tact-agent');
        if (d || !doc.createElement || !doc.body) return d;
        d = doc.createElement('dialog');
        d.id = 'tact-agent';
        d.className = 'tdlg tad';
        if (d.setAttribute) d.setAttribute('aria-labelledby', 'tact-agent-h');
        doc.body.appendChild(d);
        return d;
    }
    // Paints the dialog, keeping which steps were open across a re-read.
    function paint() {
        var d = dlg();
        if (!d) return;
        var was = {};
        if (d.querySelectorAll) [].forEach.call(d.querySelectorAll('details[data-key]'), function (x) { if (x.open) was[x.getAttribute('data-key')] = true; });
        d.innerHTML = viewHtml(OPEN.view, OPEN.state);
        if (d.querySelectorAll) [].forEach.call(d.querySelectorAll('details[data-key]'), function (x) { if (was[x.getAttribute('data-key')]) x.open = true; });
        if (!d.open && typeof d.showModal === 'function') d.showModal();
    }
    function load(sid, id) {
        if (typeof fetch !== 'function') return;
        var p = fetch('station/talk/' + encodeURIComponent(sid) + '/agent/' + encodeURIComponent(id));
        if (!p || typeof p.then !== 'function') return;
        p.then(function (r) {
            if (!r.ok) throw new Error(String(r.status));
            return r.json();
        }).then(function (v) {
            if (OPEN.id !== id) return;
            OPEN.view = v;
            OPEN.state = '';
            paint();
            if (v && v.state === 'running' && w && w.setTimeout) w.setTimeout(function () { if (OPEN.id === id) load(sid, id); }, STEP);
        }, function () {
            if (OPEN.id !== id) return;
            OPEN.state = 'failed';
            paint();
        });
    }
    function show(sid, id) {
        OPEN.sid = sid;
        OPEN.id = id;
        OPEN.view = null;
        OPEN.state = '';
        var d = dlg();
        if (d) d.onclose = function () { OPEN.id = null; };
        paint();
        load(sid, id);
    }
    function listen() {
        if (heard || !doc || !doc.addEventListener) return;
        heard = true;
        doc.addEventListener('click', function (e) {
            var t = e && e.target && e.target.closest ? e.target : null;
            if (!t) return;
            var b = t.closest('[data-tact-agent]');
            if (b) {
                show(b.getAttribute('data-tact-sid'), b.getAttribute('data-tact-agent'));
                return;
            }
            if (t.closest('[data-tact-close]')) {
                var d = dlg();
                if (d && typeof d.close === 'function') d.close();
            }
        });
    }

    // Keeps a running row's state current: at most one read every STEP per
    // session, and none while nothing on the page is running.
    var WATCH = {};
    function running(held) {
        return ((held && held.turns) || []).some(function (t) {
            return t.kind === 'act' && (t.agents || []).some(function (a) { return a.state === 'running'; });
        });
    }
    function watch(sid, held) {
        if (!sid || typeof fetch !== 'function' || !running(held)) return;
        var st = WATCH[sid] || (WATCH[sid] = { busy: false, at: 0 });
        var now = Date.now();
        if (st.busy || now - st.at < STEP) return;
        var p = fetch('station/talk/' + encodeURIComponent(sid) + '/agents');
        if (!p || typeof p.then !== 'function') return;
        st.busy = true;
        st.at = now;
        p.then(function (r) { return r.ok ? r.json() : null; }).then(function (got) {
            st.busy = false;
            if (!got || !got.agents) return;
            var by = {};
            got.agents.forEach(function (a) { if (a.id) by[a.id] = a; });
            held.turns.forEach(function (t) {
                if (t.kind !== 'act') return;
                (t.agents || []).forEach(function (a) {
                    var n = by[a.id];
                    if (!n) return;
                    a.state = n.state;
                    if (n.agentId) a.agentId = n.agentId;
                });
            });
        }, function () { st.busy = false; });
    }

    var api = { html: html, viewHtml: viewHtml, watch: watch, EN: EN };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_TACT = api;
}(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null));
