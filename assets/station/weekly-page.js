'use strict';
// assets/station/weekly-page.js — the 週報 page `#/weekly` as approved
// (docs/90-agent/plans/2026-10-27-weekly-skill-design.md, 監控站整合; mockup
// .fankeel/build/2026-10-27-weekly-skill/station-weekly.html, blocks
// weekly-copy and weekly-list). The station writes no report — it has no
// model — so the page is a copy button for `/fankeel-weekly` and the list of
// reports archived under `<configDir>/fankeel/weekly/`, read once a visit
// from GET station/weekly. A row opens `station/weekly/<until>.html` in this
// tab; the server injects the bar that leads back here.
// Reads `w.FK_KIT` (esc, fillVars) when it draws; adds its one listener on
// the first draw, never at load.
(function (w, doc) {
    var EN = {
        'wk.copyHead': 'Write a new weekly report',
        'wk.copyHint': 'Copy the command and run it in any Claude Code session.',
        'wk.from': ' By default its range starts on <span class="mono">{d}</span> (the latest report ends on <span class="mono">{u}</span>) and runs to the day you run it.',
        'wk.fromNone': ' There is no report yet, so the range defaults to last Friday through today.',
        'wk.copy': 'Copy command',
        'wk.copied': 'Copied',
        'wk.saidOk': 'Paste it into a session',
        'wk.saidSel': 'Selected; press Ctrl+C to copy',
        'wk.listHead': 'Weekly reports',
        'wk.listSub': 'Newest end date first; click a row to open it here',
        'wk.where': 'Files live in the config dir\'s <span class="mono">fankeel/weekly/</span>, in no repository',
        'wk.range': 'Range',
        'wk.done': 'Done',
        'wk.ongoing': 'Ongoing',
        'wk.projects': 'Projects',
        'wk.open': 'Open',
        'wk.days': '{n} days',
        'wk.newest': 'Latest',
        'wk.to': '{a} to {b}',
        'wk.emptyHead': 'No weekly report yet',
        'wk.emptyText': 'Copy <span class="mono">/fankeel-weekly</span> with the button above and run it in Claude Code; the report it writes is listed here.',
        'wk.unserved': 'This list needs serve: a station written to disk cannot read the archive.',
        'wk.loading': 'Reading the archive…',
        'wk.loadFail': 'Could not read the archive: {e}'
    };
    function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    function kit() { return (w && w.FK_KIT) || {}; }
    function loc(key, zh, vars) {
        var I = w && w.FK_I18N, s = I && I.lang === 'en' && has(EN, key) ? EN[key] : zh;
        return kit().fillVars ? kit().fillVars(s, vars) : s;
    }
    function esc(s) { return kit().esc(s); }

    var CMD = '/fankeel-weekly';
    var DAY = 86400000;
    var ICO_COPY = '<svg class="ico" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
        + '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
    var ICO_GO = '<svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'
        + '<path d="M3 8h10M9 4l4 4-4 4"/></svg>';
    // Dates are calendar days, so they are counted in UTC and never shift with the zone.
    function utc(d) { return Date.parse(d + 'T00:00:00Z'); }
    function dayAfter(d) { return new Date(utc(d) + DAY).toISOString().slice(0, 10); }
    function span(a, b) { return Math.round((utc(b) - utc(a)) / DAY) + 1; }
    function rangeText(a, b) { return loc('wk.to', '{a} 至 {b}', { a: a, b: a.slice(0, 4) === b.slice(0, 4) ? b.slice(5) : b }); }

    // A visit is a run of draws less than VISIT_MS apart (the redraw is every 3 s); a new visit reads the archive again.
    var VISIT_MS = 10000;
    function blank() { return { data: null, err: null, loading: false, drawnAt: 0, said: '', ok: false, timer: null }; }
    var st = blank(), last = null, bound = false;
    function redraw() { if (last && typeof last.redraw === 'function') last.redraw(); }
    function load() {
        if (typeof fetch !== 'function') return;
        st.loading = true;
        fetch('station/weekly', { cache: 'no-store' }).then(function (r) {
            if (!r.ok) throw new Error(String(r.status));
            return r.json();
        }).then(function (d) {
            st.data = d;
            st.err = null;
        }, function (e) {
            st.err = String((e && e.message) || e);
        }).then(function () {
            st.loading = false;
            redraw();
        });
    }
    function reports() { return (st.data && st.data.reports) || []; }

    // ---- weekly-copy: the one action, and where its range will start ----
    function copyHtml() {
        var R = reports(), from = !st.data ? ''
            : R.length ? loc('wk.from', '預設區間從 <span class="mono">{d}</span> 起（最新一份迄於 <span class="mono">{u}</span>），到執行當天。', { d: dayAfter(R[0].until), u: R[0].until.slice(5) })
                : loc('wk.fromNone', '還沒有上一份，預設區間是上週五到今天。');
        return '<section class="dcard wk-copy" data-block="weekly-copy" aria-labelledby="wk-copy-h"><div class="what">'
            + '<b id="wk-copy-h">' + loc('wk.copyHead', '產生新一份週報') + '</b>'
            + '<span id="wk-range">' + loc('wk.copyHint', '複製指令，貼到任一個 Claude Code session 執行。') + from + '</span></div>'
            + '<div class="cmd"><code id="wk-cmd">' + CMD + '</code>'
            + '<button type="button" class="btn go' + (st.ok ? ' done' : '') + '" data-wk-copy="1" aria-describedby="wk-range">' + ICO_COPY
            + '<span>' + (st.ok ? loc('wk.copied', '已複製') : loc('wk.copy', '複製指令')) + '</span></button>'
            + '<span class="said" role="status" aria-live="polite">' + esc(st.said) + '</span></div></section>';
    }

    // ---- weekly-list: one row a report, newest end date first ----
    function num(v) { return '<td class="r' + (v ? '' : ' z') + '">' + Number(v || 0) + '</td>'; }
    function rowHtml(r, i) {
        var since = String(r.since || r.until), until = String(r.until);
        var chips = (r.projects || []).map(function (p) { return '<span class="chip">' + esc(p) + '</span>'; }).join('');
        return '<tr><td><a class="wk-rng" href="station/weekly/' + encodeURIComponent(until) + '.html"><span>' + rangeText(since, until) + '</span></a>'
            + ' <span class="wk-days">' + loc('wk.days', '{n} 天', { n: span(since, until) }) + '</span>'
            + (i === 0 ? ' <span class="wk-new">' + loc('wk.newest', '最新') + '</span>' : '') + '</td>'
            + num(r.done) + num(r.ongoing)
            + '<td><span class="wk-proj">' + chips + '</span></td>'
            + '<td><span class="wk-open">' + loc('wk.open', '開啟') + ICO_GO + '</span></td></tr>';
    }
    function tableHtml(rows) {
        return '<table class="wk-t"><colgroup><col class="rng"><col class="n"><col class="n"><col><col class="go"></colgroup>'
            + '<thead><tr><th scope="col">' + loc('wk.range', '區間') + '</th>'
            + '<th scope="col" class="r">' + loc('wk.done', '完成') + '</th>'
            + '<th scope="col" class="r">' + loc('wk.ongoing', '進行中') + '</th>'
            + '<th scope="col">' + loc('wk.projects', '涉及專案') + '</th>'
            + '<th scope="col"><span class="hm-sr">' + loc('wk.open', '開啟') + '</span></th></tr></thead>'
            + '<tbody>' + rows.map(rowHtml).join('') + '</tbody></table>';
    }
    function listHtml(o) {
        var rows = reports().filter(function (r) { return r && r.html && r.until; }), body;
        if (!o.serve) body = '<div class="wk-empty">' + loc('wk.unserved', '這張表要 serve 才讀得到：寫到磁碟的監控站讀不了週報歸檔。') + '</div>';
        else if (st.err) body = '<div class="wk-empty">' + loc('wk.loadFail', '讀不到週報歸檔：{e}', { e: esc(st.err) }) + '</div>';
        else if (!st.data) body = '<div class="wk-empty">' + loc('wk.loading', '讀取週報歸檔…') + '</div>';
        else if (!rows.length) body = '<div class="wk-empty"><b>' + loc('wk.emptyHead', '還沒有週報') + '</b>'
            + loc('wk.emptyText', '用上面的按鈕複製 <span class="mono">/fankeel-weekly</span>，在 Claude Code 執行；寫好的那份會列在這裡。') + '</div>';
        else body = tableHtml(rows);
        return '<section class="dcard wk-list" data-block="weekly-list" aria-labelledby="wk-cap"><div class="wk-lh">'
            + '<h2 class="wk-cap" id="wk-cap"><span>' + loc('wk.listHead', '歷次週報') + '</span><small>' + loc('wk.listSub', '依迄日，新的在前；點一列在站內開') + '</small></h2>'
            + '<p class="wk-where">' + loc('wk.where', '檔案在 config dir 的 <span class="mono">fankeel/weekly/</span>，不進任何 repo') + '</p></div>'
            + body + '</section>';
    }

    // ---- the page and its listener ----
    function page(S, o) {
        o = o || {};
        last = o;
        bind();
        var t = Date.now();
        if (o.serve && !st.loading && ((!st.data && !st.err) || t - st.drawnAt > VISIT_MS)) load();
        st.drawnAt = t;
        return '<div class="wk" data-block="weekly-page">' + copyHtml() + listHtml(o) + '</div>';
    }
    // The note under the button stays 1.8 s, as in the mockup, then the label returns.
    function said(text, ok) {
        st.said = text;
        st.ok = ok;
        if (st.timer && w && typeof w.clearTimeout === 'function') w.clearTimeout(st.timer);
        if (w && typeof w.setTimeout === 'function') st.timer = w.setTimeout(function () { st.said = ''; st.ok = false; redraw(); }, 1800);
        redraw();
    }
    function copy() {
        var nav = w && w.navigator, clip = nav && nav.clipboard;
        var p = clip && typeof clip.writeText === 'function' ? clip.writeText(CMD) : Promise.reject(new Error('no clipboard'));
        return p.then(function () { said(loc('wk.saidOk', '貼到 session 執行'), true); }, function () {
            // No clipboard (a page opened over plain http from a phone): select the command instead.
            // The redraw comes first, so the selection lands on the code element that stays.
            said(loc('wk.saidSel', '已選取，按 Ctrl+C 複製'), false);
            var c = doc && doc.getElementById ? doc.getElementById('wk-cmd') : null, sel = w && typeof w.getSelection === 'function' ? w.getSelection() : null;
            if (c && sel && doc.createRange) {
                var r = doc.createRange();
                r.selectNodeContents(c);
                sel.removeAllRanges();
                sel.addRange(r);
            }
        });
    }
    function onClick(e) {
        var t = e && e.target;
        if (t && t.closest && t.closest('[data-wk-copy]')) copy();
    }
    function bind() {
        if (bound || !doc || typeof doc.addEventListener !== 'function') return;
        bound = true;
        doc.addEventListener('click', onClick);
    }
    function state() { return st; }
    function reset() { st = blank(); last = null; }

    var api = { page: page, onClick: onClick, copy: copy, state: state, reset: reset, EN: EN };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_WEEKLY = api;
}(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null));
