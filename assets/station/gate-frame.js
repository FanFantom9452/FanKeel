'use strict';
// assets/station/gate-frame.js — the gate page, /f/<id>/gate (design
// 2026-10-21-station-redesign §5; mockup gate-plan-a.html): a head with no
// tabs whose title opens the session in the full station, the stage report
// station.js drew (`focusReportHtml`) in the main column, and the question in
// a side column that stays in view. An option shows its label; its
// description starts open and closes on click; 1 … n pick, unless a dialog is open or a field
// has focus. A pick only marks the option and says to answer in Claude
// Desktop: the station cannot answer a gate, so nothing here is sent.
// Loaded by the focus page before station.js, whose focusPageHtml calls frame().
(function (w, doc) {
    var EN = {
        'gf.open': 'Open this session in the full station',
        'gf.unnamed': '(unnamed)',
        'gf.ask': 'Your call',
        'gf.noQ': 'No gate question could be read from the report',
        'gf.rec': 'Recommended',
        'gf.pick': 'Pick this',
        'gf.next': 'Next step the report names',
        'gf.where': 'Answer in Claude Desktop; this page only shows what you are approving and sends nothing.',
        'gf.picked': 'You picked "{l}". Answer it in Claude Desktop; this page sends nothing.',
        'gf.free': 'Or write your own answer',
        'gf.freeHint': 'Sent as the answer to this question, the same as choosing "Other".',
        'gf.send': 'Send answer',
        'gf.sending': 'Sending…',
        'gf.sentOk': 'Sent: {t}',
        'gf.sentBad': 'Could not send: {t}',
    };
    var REC = /\s*\(Recommended\)\s*$/;
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

    // Per gate: the option picked (0 for none) and the options the reader closed. The
    // focus page repaints every 5 s; this survives it. A gate is the session,
    // its stage and its question, so a new gate in the same session starts
    // with no pick. CUR is the gate the last frame drew, with its option
    // labels, for the keys and clicks.
    var STATE = {}, CUR = { key: null, labels: [] }, heard = false;
    function state(key) { return STATE[key] || (STATE[key] = { pick: 0, more: {}, free: '', said: null }); }
    // The page's answer for the gate the last frame drew: { question, send }.
    var ANSWER = null;
    function lineText(st) {
        var l = st.pick ? CUR.labels[st.pick - 1] : null;
        return l !== null && l !== undefined
            ? loc('gf.picked', '你選了「{l}」，到 Claude Desktop 回答；這頁不送答案', { l: l })
            : loc('gf.where', '回答在 Claude Desktop 那邊給；這頁只讓你看清楚要核准什麼，不收答案');
    }

    function glyph(s) {
        var k = kit(), route = s.route || [], at = route.indexOf(s.stage);
        var st = function (name) { var i = route.indexOf(name); return i < 0 ? null : i < at ? 'done' : i === at ? 'now' : 'todo'; };
        return k.keelGlyph({ cls: 'prog', seg: function (i) { return st(k.ROUTE[i]); }, edge: st('land'), c: at >= 0 ? 'var(--st-' + esc(s.stage) + ')' : '' });
    }
    function head(s, stage) {
        var route = s.route || [], at = route.indexOf(stage);
        var sep = '<span class="sep" aria-hidden="true">·</span>';
        return '<section class="dcard gt-head" data-block="gate-head">' + glyph(s) + '<div class="gt-id">'
            + '<h1 class="gt-task"><a class="gh-link" href="/#/s/' + encodeURIComponent(s.id) + '" title="' + loc('gf.open', '在完整 station 開這個 session') + '">'
            + esc(s.task || loc('gf.unnamed', '（未命名）')) + '</a></h1>'
            + '<p class="gt-meta"><span class="gt-st" style="--c:var(--st-' + esc(stage) + ')">' + esc(stage) + '</span>'
            + (at >= 0 ? '<span class="of">' + (at + 1) + '/' + route.length + '</span>' : '')
            + sep + '<span>' + esc(s.project || s.pkey || '') + '</span>' + sep + '<span title="session ' + esc(s.id) + '">' + esc(String(s.id).slice(0, 8)) + '</span></p>'
            + '</div></section>';
    }
    function option(o, i, st) {
        var k = kit(), n = i + 1, raw = String((o && o.label) || ''), rec = REC.test(raw), d = o && o.description, open = st.more[n] !== false;
        var cls = [rec ? 'is-rec' : '', st.pick === n ? 'on' : '', open ? 'is-open' : ''].filter(Boolean).join(' ');
        return '<li data-gq="' + n + '"' + (cls ? ' class="' + cls + '"' : '') + '><span class="gt-n">' + n + '</span><div class="gq-b">'
            + '<button type="button" class="gt-more" data-gq-more="' + n + '" aria-expanded="' + (open ? 'true' : 'false') + '"' + (d ? ' aria-controls="gq-d-' + n + '"' : '') + '>'
            + '<span class="gt-l">' + esc(raw.replace(REC, '')) + (rec ? '<span class="gt-rec">' + loc('gf.rec', '建議') + '</span>' : '') + '</span>' + (d ? k.icon('chev') : '') + '</button>'
            + (d ? '<p class="gt-d" id="gq-d-' + n + '"' + (open ? '' : ' hidden') + '>' + esc(d) + '</p>' : '') + '</div>'
            + '<button type="button" class="gq-pick" data-gq-pick="' + n + '" aria-pressed="' + (st.pick === n ? 'true' : 'false') + '">' + loc('gf.pick', '選這個') + '<kbd>' + n + '</kbd></button></li>';
    }
    function sentLine(kind, text) {
        return kind === 'wait' ? loc('gf.sending', '送出中…')
            : kind === 'ok' ? loc('gf.sentOk', '已送出：{t}', { t: text }) : loc('gf.sentBad', '送不出去：{t}', { t: text });
    }
    function freeHtml(st) {
        var said = st.said, busy = said && (said.kind === 'wait' || said.kind === 'ok');
        var line = said ? sentLine(said.kind, said.text) : '';
        return '<form class="gt-free" data-block="gate-free" onsubmit="return false"><label class="gt-free-l" for="gq-free">' + loc('gf.free', '或寫自己的答案') + '</label>'
            + '<textarea id="gq-free" class="gt-free-t" data-gq-free rows="3" aria-describedby="gq-free-h">' + esc(st.free) + '</textarea>'
            + '<p class="gt-free-h" id="gq-free-h">' + loc('gf.freeHint', '會當成這題的答案送出，等同選「其他」。') + '</p>'
            + '<div class="gt-free-a"><button type="button" class="gq-pick gt-send" data-gq-send' + (busy ? ' disabled' : '') + '>' + loc('gf.send', '送出答案') + '</button>'
            + '<p id="gq-sent" class="gt-sent' + (said ? ' ' + said.kind : '') + '" role="status" aria-live="polite">' + esc(line) + '</p></div></form>';
    }
    function ask(g, stage, st) {
        var k = kit(), q = g && g.gate && g.gate.questions && g.gate.questions[0] ? g.gate.questions[0] : null;
        var opts = q && Array.isArray(q.options) ? q.options : [], next = g && g.gate && g.gate.next;
        return '<section class="dcard gt-ask" data-block="gate-question"><div class="dcard-h">' + k.icon('gate') + '<b>' + loc('gf.ask', '等你決定') + '</b>'
            + '<span class="kn wait">' + esc(stage) + ' gate</span>' + (q && q.header ? '<span class="gt-hr chip">' + esc(q.header) + '</span>' : '') + '</div>'
            + '<p class="gq-cd" role="status" aria-live="polite"><i class="hatchsw" aria-hidden="true"></i><span id="gq-line">' + esc(lineText(st)) + '</span></p>'
            + '<h2 class="gt-q">' + (q ? esc(q.question) : loc('gf.noQ', '報告裡沒有讀得出的 gate 問題')) + '</h2>'
            + (opts.length ? '<ol class="gt-opts">' + opts.slice(0, 9).map(function (o, i) { return option(o, i, st); }).join('') + '</ol>' : '')
            + (ANSWER ? freeHtml(st) : '')
            + (next ? '<p class="gt-next"><span>' + loc('gf.next', '報告寫的下一步') + '</span>' + esc(next) + '</p>' : '') + '</section>';
    }

    // A repaint in place after a click or a key, without waiting for the
    // focus page's next 5 s draw, which draws the same from STATE.
    function paint() {
        if (!doc || !doc.querySelectorAll || CUR.key === null) return;
        var st = state(CUR.key);
        [].forEach.call(doc.querySelectorAll('[data-gq]'), function (li) {
            var n = Number(li.getAttribute('data-gq')), open = st.more[n] !== false;
            li.classList.toggle('on', st.pick === n);
            li.classList.toggle('is-open', open);
            var b = li.querySelector('[data-gq-more]'), d = li.querySelector('.gt-d'), p = li.querySelector('[data-gq-pick]');
            if (b) b.setAttribute('aria-expanded', open ? 'true' : 'false');
            if (d) d.hidden = !open;
            if (p) p.setAttribute('aria-pressed', st.pick === n ? 'true' : 'false');
        });
        var line = doc.getElementById ? doc.getElementById('gq-line') : null;
        if (line) line.textContent = lineText(st);
    }
    function pick(n) {
        if (CUR.key === null || !(n >= 1 && n <= CUR.labels.length)) return false;
        state(CUR.key).pick = n;
        paint();
        return true;
    }
    function more(n) {
        if (CUR.key === null) return;
        var st = state(CUR.key);
        st.more[n] = st.more[n] === false;
        paint();
    }
    // The page tells the frame how the POST went; the line survives a repaint.
    function say(kind, text) {
        if (CUR.key === null) return;
        state(CUR.key).said = { kind: kind, text: String(text || '') };
        if (!doc || !doc.getElementById) return;
        var line = doc.getElementById('gq-sent'), btn = doc.querySelector ? doc.querySelector('[data-gq-send]') : null;
        if (line) {
            line.className = 'gt-sent ' + kind;
            line.textContent = sentLine(kind, text);
        }
        if (btn) btn.disabled = kind === 'wait' || kind === 'ok';
    }
    function send() {
        if (CUR.key === null || !ANSWER || typeof ANSWER.send !== 'function' || !doc || !doc.querySelector) return false;
        var box = doc.querySelector('[data-gq-free]'), text = box ? String(box.value || '').trim() : '';
        if (!text) return false;
        say('wait', '');
        ANSWER.send(text);
        return true;
    }
    function pickable(e, d) {
        if (!e || e.ctrlKey || e.metaKey || e.altKey) return false;
        if (d && d.querySelector && d.querySelector('dialog[open]')) return false;
        var t = e.target;
        return !(t && t.closest && t.closest('input,textarea,select,[contenteditable]'));
    }
    function onKey(e, d) {
        var n = e && /^[1-9]$/.test(String(e.key)) ? Number(e.key) : 0;
        if (!n || n > CUR.labels.length || !pickable(e, d)) return false;
        if (e.preventDefault) e.preventDefault();
        return pick(n);
    }
    // `d` is the document to listen on, the page's own when none is given;
    // paint() repaints in the one listened on.
    function listen(d) {
        d = d || doc;
        if (heard || !d || !d.addEventListener) return;
        heard = true;
        doc = d;
        doc.addEventListener('click', function (e) {
            var t = e && e.target && e.target.closest ? e.target : null;
            if (!t) return;
            var m = t.closest('[data-gq-more]'), p = t.closest('[data-gq-pick]'), s = t.closest('[data-gq-send]');
            if (m) more(Number(m.getAttribute('data-gq-more')));
            else if (p) pick(Number(p.getAttribute('data-gq-pick')));
            else if (s) send();
        });
        doc.addEventListener('input', function (e) {
            var f = e && e.target && e.target.closest ? e.target.closest('[data-gq-free]') : null;
            if (f && CUR.key !== null) state(CUR.key).free = String(f.value || '');
        });
        doc.addEventListener('keydown', function (e) { onKey(e, doc); });
    }

    function frame(o) {
        o = o || {};
        listen();
        var s = o.session || {}, g = o.gate || null, stage = g && g.stage ? g.stage : s.stage || '';
        var q = g && g.gate && g.gate.questions && g.gate.questions[0] ? g.gate.questions[0] : null;
        CUR = { key: [s.id, stage, q ? q.question : ''].join('\n'),
            labels: (q && Array.isArray(q.options) ? q.options : []).slice(0, 9).map(function (x) { return String((x && x.label) || '').replace(REC, ''); }) };
        ANSWER = o.answer && o.answer.question === (q ? q.question : null) ? o.answer : null;
        var st = state(CUR.key);
        return '<main class="fm gt-frame" data-block="gate-frame">' + head(s, stage) + (o.shellsHtml || '')
            + '<div class="gt-grid" data-block="gate-columns"><div class="gt-main" data-block="gate-main">' + (o.reportHtml || '') + '</div>'
            + '<aside class="gt-side" data-block="gate-side"><div class="gt-pin">' + ask(g, stage, st) + '</div></aside></div></main>';
    }

    var api = { frame: frame, listen: listen, pickable: pickable, onKey: onKey, pick: pick, more: more, say: say, send: send, EN: EN };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_GATE = api;
}(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null));
