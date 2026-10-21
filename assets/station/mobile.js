'use strict';
// assets/station/mobile.js — the phone station, /m
// (docs/90-agent/plans/2026-10-21-station-remote-design.md §4; the approved
// mockup's blocks tabbar, tab-gates, gate-sheet, tab-tasks, tab-done,
// pair-scan, pair-error, gates-empty). Reads /station/mobile.json
// (lib/mobile.js) every five seconds, and again when the page comes back into
// view, while no gate sheet is open, so a reload never redraws what is being
// picked or typed. Pairs through POST /station/remote/pair, whose 201 sets the
// device cookie, and answers a held gate through POST /answer on that cookie,
// which the browser sends itself. Carries its own strings — station.js's loc() table is not on
// this page. The drawing functions are pure and exported for the tests;
// `boot` runs only on a page with #app.
(function (w) {
    var STR = {
        zh: {
            'tab.gates': '待答', 'tab.tasks': '任務', 'tab.done': '完成', 'tab.nav': '分頁',
            'gates.waiting': '{n} 個在等', 'gates.empty': '沒有在等你的 gate', 'gates.emptyHint': '有新的會推播通知你。',
            'gate.word': 'gate', 'gate.waited': '等了 {t}', 'gate.report': '看 {stage} 報告', 'gate.pick': '選一個答案', 'gate.pickMany': '可以選幾個',
            'gate.own': '自己寫答案…', 'gate.rec': '建議', 'gate.send': '送出答案', 'gate.sending': '送出中…', 'gate.needAll': '每一題都要有答案',
            'gate.failed': '沒送到：可以再按一次', 'gate.gone': '這個 gate 已經不在等了', 'gate.refused': '測站沒收下（{code}）：{why}', 'gate.more': '還有 {n} 題',
            'tasks.empty': '沒有在跑的任務', 'tasks.route': 'route {route}，現在 {stage}', 'tasks.gate': '待答',
            'done.empty': '48 小時內沒有完成的', 'done.end': '任務結束', 'done.stage': '完成 ·', 'done.today': '今天', 'done.yesterday': '昨天', 'done.upTo': '到 {t}',
            'ago.now': '剛剛', 'ago.min': '{n} 分', 'ago.hour': '{n} 小時', 'ago.day': '{n} 天',
            'host.on': '已連上 {host}', 'host.station': '測站',
            'pair.title': '掃桌機測站上的 QR', 'pair.where': '在 <b>設定</b> › <b>手機遠端</b>', 'pair.frame': '相機取景框', 'pair.type': '輸入配對碼',
            'pair.code': '8 位配對碼', 'pair.go': '配對', 'pair.busy': '配對中…', 'pair.failed': '連不到測站：再試一次', 'pair.bad': '配對碼是 8 個英文字母或數字', 'pair.refused': '配對沒成功（{code}）：{why}',
            'off.title': '連不到 {host}', 'off.hint': '打開手機的 Tailscale 再試。', 'off.badge': 'Tailscale 未連線', 'off.retry': '重試', 'off.repair': '重新配對',
        },
        en: {
            'tab.gates': 'Gates', 'tab.tasks': 'Tasks', 'tab.done': 'Done', 'tab.nav': 'Tabs',
            'gates.waiting': '{n} waiting', 'gates.empty': 'No gate is waiting on you', 'gates.emptyHint': 'A new one will notify you.',
            'gate.word': 'gate', 'gate.waited': 'waiting {t}', 'gate.report': 'Read the {stage} report', 'gate.pick': 'Pick one answer', 'gate.pickMany': 'Pick any number',
            'gate.own': 'Write your own answer…', 'gate.rec': 'Recommended', 'gate.send': 'Send answer', 'gate.sending': 'Sending…', 'gate.needAll': 'Every question needs an answer',
            'gate.failed': 'Not sent: press again', 'gate.gone': 'This gate is no longer waiting', 'gate.refused': 'The station refused it ({code}): {why}', 'gate.more': '{n} more',
            'tasks.empty': 'No task is running', 'tasks.route': 'route {route}, now {stage}', 'tasks.gate': 'Gate',
            'done.empty': 'Nothing finished in the last 48 hours', 'done.end': 'Task ended', 'done.stage': 'done ·', 'done.today': 'Today', 'done.yesterday': 'Yesterday', 'done.upTo': 'up to {t}',
            'ago.now': 'now', 'ago.min': '{n} min', 'ago.hour': '{n} h', 'ago.day': '{n} d',
            'host.on': 'Connected to {host}', 'host.station': 'the station',
            'pair.title': 'Scan the QR on the desktop station', 'pair.where': 'Under <b>Settings</b> › <b>Phone remote</b>', 'pair.frame': 'Camera viewfinder', 'pair.type': 'Type the pairing code',
            'pair.code': '8-character code', 'pair.go': 'Pair', 'pair.busy': 'Pairing…', 'pair.failed': 'Could not reach the station: try again', 'pair.bad': 'A pairing code is 8 letters or digits', 'pair.refused': 'Pairing refused ({code}): {why}',
            'off.title': 'Cannot reach {host}', 'off.hint': 'Turn on Tailscale on this phone and try again.', 'off.badge': 'Tailscale not connected', 'off.retry': 'Retry', 'off.repair': 'Pair again',
        },
    };
    var lang = 'zh';
    var POLL_MS = 5000;
    var WAIT_MS = 3 * 60e3;
    var STAGES = ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'];
    // A label ending in (Recommended) or (建議) is picked before anything is touched.
    var REC = /\s*\((?:Recommended|建議)\)\s*$/;
    // The mockup's icons: Lucide (ISC) on 24, the station's own set on 16.
    var SPRITE = '<svg width="0" height="0" style="position:absolute" aria-hidden="true">'
        + '<symbol id="i-gate" viewBox="0 0 16 16"><path d="M8 1.8 13.5 4v4c0 3-2.4 5.3-5.5 6.2C4.9 13.3 2.5 11 2.5 8V4z"/><path d="M8 5.2v3.3M8 10.8v.01"/></symbol>'
        + '<symbol id="i-now" viewBox="0 0 16 16"><circle cx="8" cy="8" r="1.5"/><path d="M5.2 5.2a4 4 0 0 0 0 5.6M10.8 5.2a4 4 0 0 1 0 5.6M3 3a7 7 0 0 0 0 10M13 3a7 7 0 0 1 0 10"/></symbol>'
        + '<symbol id="i-check" viewBox="0 0 16 16"><path d="M3.5 8.5 6.5 11.5 12.5 5"/></symbol>'
        + '<symbol id="i-chev" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></symbol>'
        + '<symbol id="i-cc" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></symbol>'
        + '<symbol id="i-wifioff" viewBox="0 0 24 24"><path d="M12 20h.01"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/><path d="M5 12.859a10 10 0 0 1 5.17-2.69"/><path d="M19 12.859a10 10 0 0 0-2.007-1.523"/><path d="M2 8.82a15 15 0 0 1 4.177-2.643"/><path d="M22 8.82a15 15 0 0 0-11.288-3.764"/><path d="m2 2 20 20"/></symbol>'
        + '<symbol id="i-refresh" viewBox="0 0 24 24"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></symbol>'
        + '<symbol id="i-kbd" viewBox="0 0 24 24"><path d="M10 8h.01"/><path d="M12 12h.01"/><path d="M14 8h.01"/><path d="M16 12h.01"/><path d="M18 8h.01"/><path d="M6 8h.01"/><path d="M7 16h10"/><path d="M8 12h.01"/><rect width="20" height="16" x="2" y="4" rx="2"/></symbol>'
        + '<symbol id="i-pencil" viewBox="0 0 24 24"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></symbol>'
        + '<symbol id="i-doc" viewBox="0 0 24 24"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></symbol>'
        + '</svg>';
    // The masthead's glyph, as pair-scan's lock-up draws it.
    var GLYPH = '<svg class="glyph" viewBox="0 0 120 120" aria-hidden="true">'
        + '<path class="gseg done" d="M56.50 107.98L20.20 87.02L36.65 77.52L56.50 88.98Z"/><path class="gseg done" d="M16.70 80.96L16.70 39.04L33.15 48.54L33.15 71.46Z"/>'
        + '<path class="gseg done" d="M20.20 32.98L56.50 12.02L56.50 31.02L36.65 42.48Z"/><path class="gseg done" d="M63.50 12.02L99.80 32.98L83.35 42.48L63.50 31.02Z"/>'
        + '<path class="gseg done" d="M103.30 39.04L103.30 80.96L86.85 71.46L86.85 48.54Z"/><path class="gseg done" d="M99.80 87.02L63.50 107.98L63.50 88.98L83.35 77.52Z"/>'
        + '<path class="gedge done" d="M60.00 10.00L103.30 35.00L103.30 85.00L60.00 110.00L16.70 85.00L16.70 35.00Z" stroke-width="8"/>'
        + '<path class="gcore" d="M60.00 39.00L78.19 49.50L78.19 70.50L60.00 81.00L41.81 70.50L41.81 49.50Z"/></svg>';

    function setLang(l) { lang = l === 'en' ? 'en' : 'zh'; return lang; }
    // A string of this page's own; `vars` are put in as given, so a caller
    // escapes any it took from the registry.
    function t(key, vars) {
        var s = STR[lang][key];
        if (s === undefined) s = STR.zh[key];
        return String(s).replace(/\{(\w+)\}/g, function (m, k) { return vars && vars[k] !== undefined ? String(vars[k]) : m; });
    }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function num(v) { return typeof v === 'number' && isFinite(v); }
    function stVar(stage) { return STAGES.indexOf(stage) >= 0 ? 'var(--st-' + stage + ')' : 'var(--st-none)'; }
    function stw(stage) { return '<span class="hm-stw" style="--c:' + stVar(stage) + '">' + esc(stage) + '</span>'; }
    function ic(name, cls) { return '<svg class="ic' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>'; }
    function ago(ms) {
        var m = Math.max(0, Math.floor(ms / 60e3));
        if (m < 1) return t('ago.now');
        if (m < 60) return t('ago.min', { n: m });
        if (m < 1440) return t('ago.hour', { n: Math.floor(m / 60) });
        return t('ago.day', { n: Math.floor(m / 1440) });
    }
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function hm(at) { var d = new Date(at); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
    function dayOf(at) { var d = new Date(at); return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); }
    function usd(v) { return num(v) ? '$' + v.toFixed(2) : '—'; }

    // #/gates (the default), #/tasks, #/done; #/gate/<id> opens that gate's
    // sheet, #/task/<id> finds that task — the two a notification's tap opens —
    // and #/pair/<code> is the pairing url the desktop's QR carries.
    function parseRoute(hash) {
        var h = String(hash || '').replace(/^#/, '');
        var none = { tab: 'gates', open: null, focus: null, pair: null };
        var m = /^\/pair\/([A-Za-z0-9]{8})$/.exec(h);
        if (m) return { tab: 'gates', open: null, focus: null, pair: m[1].toUpperCase() };
        m = /^\/gate\/([0-9A-Za-z-]+)$/.exec(h);
        if (m) return { tab: 'gates', open: m[1], focus: null, pair: null };
        m = /^\/task\/([0-9A-Za-z-]+)$/.exec(h);
        if (m) return { tab: 'tasks', open: null, focus: m[1], pair: null };
        if (h === '/tasks' || h === '/done') return { tab: h.slice(1), open: null, focus: null, pair: null };
        return none;
    }

    // A code off the pairing url a QR carries, or eight characters typed.
    function codeIn(text) {
        var s = String(text == null ? '' : text);
        var m = /#\/pair\/([A-Za-z0-9]{8})(?![A-Za-z0-9])/.exec(s) || /^\s*([A-Za-z0-9]{8})\s*$/.exec(s);
        return m ? m[1].toUpperCase() : null;
    }

    // pgAnswers' rule (assets/station/station.js): a single choice is the
    // typed text, else the label picked; a multi-select is the labels and the
    // text, joined ', '. Null while any question has no answer.
    function answersOf(questions, picks, others) {
        var qs = questions || [];
        var answers = {};
        var missing = 0;
        qs.forEach(function (q, i) {
            var labels = ((picks || {})[i] || []).filter(function (l) { return l !== '__other'; });
            var text = String((others || {})[i] || '').trim();
            var a = q.multiSelect ? labels.concat(text ? [text] : []).join(', ') : (text || labels[0] || '');
            if (a) answers[q.question] = a;
            else missing++;
        });
        return missing || !qs.length ? null : answers;
    }

    // The sheet's inputs: every ticked value per question (`q<n>`), and a
    // 自己寫 box's text only where that question's __other is ticked.
    function collect(inputs, count) {
        var picks = {};
        var others = {};
        var ticked = {};
        var i;
        for (i = 0; i < count; i++) picks[i] = [];
        Array.prototype.forEach.call(inputs || [], function (el) {
            var q = /^q(\d+)$/.exec(el.name || '');
            if (!q || !el.checked) return;
            (picks[q[1]] = picks[q[1]] || []).push(el.value);
            if (el.value === '__other') ticked[q[1]] = true;
        });
        Array.prototype.forEach.call(inputs || [], function (el) {
            var own = el.getAttribute ? el.getAttribute('data-own') : null;
            if (own !== null && own !== undefined && ticked[own]) others[own] = el.value;
        });
        return { picks: picks, others: others };
    }

    function appBar(tab, M) {
        var n = tab === 'gates' ? (M.gates || []).length : tab === 'tasks' ? (M.tasks || []).length : 0;
        return '<div class="ab"><h1>' + t('tab.' + tab) + '</h1>' + (n ? '<span class="n">' + n + '</span>' : '')
            + '<span class="sp"></span><span class="host" aria-label="' + esc(t('host.on', { host: M.host || '' })) + '"><i class="dot live"></i>'
            + esc(M.host || t('host.station')) + '</span></div>';
    }

    function tabbar(tab, n) {
        function one(key, icon) {
            return '<a class="tb" href="#/' + key + '"' + (tab === key ? ' aria-current="page"' : '') + '><span class="ind">' + ic(icon) + '</span>' + t('tab.' + key)
                + (key === 'gates' && n > 0 ? '<span class="bdg" aria-label="' + esc(t('gates.waiting', { n: n })) + '">' + n + '</span>' : '') + '</a>';
        }
        return '<nav class="tabbar" data-block="tabbar" aria-label="' + t('tab.nav') + '">' + one('gates', 'gate') + one('tasks', 'now') + one('done', 'check') + '</nav>';
    }

    function gateRow(g, now) {
        var qs = g.questions || [];
        var waited = now - (num(g.since) ? g.since : now);
        return '<a class="row" href="#/gate/' + esc(g.id) + '" data-gate="' + esc(g.id) + '">'
            + '<div class="r-l"><div class="r-meta">' + stw(g.stage) + '<span>' + t('gate.word') + '</span><span>·</span><span class="pj">' + esc(g.project) + '</span></div>'
            + '<p class="r-t">' + esc(g.task) + '</p>'
            + '<p class="r-q">' + esc((qs[0] && qs[0].question) || '') + (qs.length > 1 ? ' · ' + t('gate.more', { n: qs.length - 1 }) : '') + '</p></div>'
            + '<div class="r-side"><span class="ago' + (waited >= WAIT_MS ? ' wait' : '') + '">' + esc(ago(waited)) + '</span>' + ic('chev', 'g24') + '</div></a>';
    }

    function gatesHtml(M, now) {
        var gates = M.gates || [];
        if (!gates.length) {
            return '<div class="body" data-block="gates-empty"><div class="empty"><span class="off">' + ic('check') + '</span>'
                + '<h2>' + t('gates.empty') + '</h2><p>' + t('gates.emptyHint') + '</p></div></div>';
        }
        return '<div class="body" data-block="tab-gates"><div class="grp">' + gates.map(function (g) { return gateRow(g, now); }).join('') + '</div></div>';
    }

    function optionHtml(q, qi, o, on) {
        var label = String((o && o.label) || '');
        var shown = label.replace(REC, '');
        return '<label class="opt"><input type="' + (q.multiSelect ? 'checkbox' : 'radio') + '" name="q' + qi + '" value="' + esc(label) + '"' + (on ? ' checked' : '') + '>'
            + '<span class="rd" aria-hidden="true"></span><span class="opt-l">' + esc(shown) + (shown !== label ? '<span class="gq-rec">' + t('gate.rec') + '</span>' : '') + '</span>'
            + (o && o.description ? '<span class="opt-d">' + esc(o.description) + '</span>' : '') + '</label>';
    }

    // The gate as a bottom sheet: every question, the recommended option
    // picked unless `ui.picks` says otherwise, a 自己寫答案 box per question,
    // and the report the gate is about.
    function sheetHtml(g, now, ui) {
        var picks = (ui && ui.picks) || {};
        var others = (ui && ui.others) || {};
        var body = (g.questions || []).map(function (q, qi) {
            var opts = Array.isArray(q.options) ? q.options : [];
            var held = picks[qi];
            return '<h2 class="sh-q" id="shq' + qi + '">' + esc(q.question || '') + '</h2>'
                + (qi === 0 ? '<a class="sh-rep" href="/f/' + esc(g.id) + '/gate">' + ic('doc', 'g24') + t('gate.report', { stage: esc(g.stage) }) + '<span class="sp"></span>' + ic('chev', 'g24') + '</a>' : '')
                + '<fieldset class="opts"><legend hidden>' + t(q.multiSelect ? 'gate.pickMany' : 'gate.pick') + '</legend>'
                + opts.map(function (o) {
                    var l = String((o && o.label) || '');
                    return optionHtml(q, qi, o, held ? held.indexOf(l) >= 0 : REC.test(l));
                }).join('')
                + '<label class="opt other"><input type="' + (q.multiSelect ? 'checkbox' : 'radio') + '" name="q' + qi + '" value="__other"' + (held && held.indexOf('__other') >= 0 ? ' checked' : '') + '>'
                + ic('pencil', 'g24') + '<input class="own" type="text" data-own="' + qi + '" value="' + esc(others[qi] || '') + '" placeholder="' + t('gate.own') + '" aria-label="' + t('gate.own') + '"></label>'
                + '</fieldset>';
        }).join('');
        return '<div class="dim" data-close="1" aria-hidden="true"></div>'
            + '<form class="sheet" id="gate-sheet" data-block="gate-sheet" data-id="' + esc(g.id) + '" role="dialog" aria-modal="true" aria-labelledby="shq0">'
            + '<span class="grab" data-close="1" aria-hidden="true"></span><div class="sh-b">'
            + '<div class="sh-m">' + stw(g.stage) + '<span>' + t('gate.word') + ' · <span class="pj">' + esc(g.project) + '</span> · '
            + t('gate.waited', { t: esc(ago(now - (num(g.since) ? g.since : now))) }) + '</span></div>'
            + '<p class="sh-task">' + esc(g.task) + '</p>' + body + '</div>'
            + '<div class="sh-f"><p class="sh-say" role="status"></p><button type="submit" class="cta">' + t('gate.send') + '</button></div></form>';
    }

    function routeHtml(route, stage) {
        var at = route.indexOf(stage);
        var dots = route.map(function (s, i) {
            if (i === at) return '<i class="now" style="--c:' + stVar(s) + ';background:var(--c)"></i>';
            if (at >= 0 && i < at) return '<i style="background:' + stVar(s) + '"></i>';
            return '<i class="todo"></i>';
        }).join('');
        return '<span class="route" aria-label="' + esc(t('tasks.route', { route: route.join(' → '), stage: stage })) + '">' + dots + '</span>';
    }

    function tasksHtml(M, now, focus) {
        var tasks = M.tasks || [];
        if (!tasks.length) return '<div class="body" data-block="tab-tasks"><div class="empty"><h2>' + t('tasks.empty') + '</h2></div></div>';
        return '<div class="body" data-block="tab-tasks"><div class="grp">' + tasks.map(function (s) {
            return '<a class="row" href="/f/' + esc(s.id) + '/' + esc(s.stage || 'gate') + '"' + (focus === s.id ? ' data-focus="1"' : '') + '>'
                + '<div class="r-l"><div class="r-meta"><span class="pj">' + esc(s.project) + '</span></div><p class="r-t">' + esc(s.task) + '</p>'
                + '<div class="r-st">' + routeHtml(s.route || [], s.stage) + stw(s.stage)
                + (s.gate ? '<span class="pill gate">' + ic('gate') + t('tasks.gate') + '</span>' : '') + '</div></div>'
                + '<div class="r-side"><span class="ago">' + esc(ago(now - (num(s.updated) ? s.updated : now))) + '</span>' + ic('chev', 'g24') + '</div></a>';
        }).join('') + '</div></div>';
    }

    function doneRow(x) {
        var meta = x.kind === 'end'
            ? '<span class="end">' + ic('cc', 'g24') + t('done.end') + '</span><span>·</span>'
            : stw(x.stage) + '<span>' + t('done.stage') + '</span>';
        return '<a class="row' + (x.kind === 'end' ? ' fin' : '') + '" href="/f/' + esc(x.id) + '/' + esc(x.stage || 'gate') + '">'
            + '<div class="r-l"><div class="r-meta">' + meta + '<span class="pj">' + esc(x.project) + '</span></div><p class="r-t">' + esc(x.task) + '</p></div>'
            + '<div class="r-side"><span class="usd">' + usd(x.usd) + '</span><span class="ago">' + hm(x.at) + '</span></div></a>';
    }

    // Newest first as mobile.json sends it, under one heading per day.
    function doneHtml(M, now) {
        var done = M.done || [];
        if (!done.length) return '<div class="body" data-block="tab-done"><div class="empty"><h2>' + t('done.empty') + '</h2></div></div>';
        var today = dayOf(now);
        var yday = dayOf(now - 864e5);
        var out = '';
        var open = null;
        done.forEach(function (x) {
            var day = dayOf(x.at);
            if (day !== open) {
                var d = new Date(x.at);
                var head = day === today ? t('done.today') + '<span>' + t('done.upTo', { t: hm(now) }) + '</span>'
                    : day === yday ? t('done.yesterday') : (d.getMonth() + 1) + '/' + d.getDate();
                out += (open === null ? '' : '</div>') + '<div class="grp-h">' + head + '</div><div class="grp">';
                open = day;
            }
            out += doneRow(x);
        });
        return '<div class="body" data-block="tab-done">' + out + '</div></div>';
    }

    function pairHtml(ui) {
        var u = ui || {};
        var typed = u.manual || !u.camera;
        return '<div class="solo" data-block="pair-scan"><span class="lock">' + GLYPH + 'fankeel</span>'
            + (typed ? '' : '<div class="vf" role="img" aria-label="' + t('pair.frame') + '"><i></i><i></i><i></i><i></i><span class="scan"></span></div>')
            + '<h2>' + t('pair.title') + '</h2><p class="one path">' + t('pair.where') + '</p>'
            + (u.say ? '<p class="say" role="status">' + esc(u.say) + '</p>' : '')
            + '<span class="sp"></span>'
            + (typed
                ? '<form class="acts" data-pair-form="1"><input class="code" name="code" autocapitalize="characters" autocomplete="one-time-code" maxlength="8" placeholder="'
                    + t('pair.code') + '" aria-label="' + t('pair.code') + '"><button type="submit" class="cta">' + t('pair.go') + '</button></form>'
                : '<div class="acts"><button type="button" class="ghost" data-act="manual">' + ic('kbd', 'g24') + t('pair.type') + '</button></div>')
            + '</div>';
    }

    function offHtml(host) {
        return '<div class="solo" data-block="pair-error"><span class="off">' + ic('wifioff', 'g24') + '</span>'
            + '<h2>' + t('off.title', { host: esc(host || t('host.station')) }) + '</h2><p class="one">' + t('off.hint') + '</p>'
            + '<span class="tsx"><i class="dot"></i>' + t('off.badge') + '</span><span class="sp"></span>'
            + '<div class="acts"><button type="button" class="cta" data-act="retry">' + ic('refresh', 'g24') + t('off.retry') + '</button>'
            + '<button type="button" class="ghost" data-act="repair">' + t('off.repair') + '</button></div></div>';
    }

    // What #app holds: pair-scan, pair-error, or the app bar, the tab's body,
    // the tab bar and — when the hash opens a gate still held — its sheet.
    function screen(M, R, now, ui) {
        var u = ui || {};
        if (u.mode === 'pair') return pairHtml(u);
        if (u.mode === 'off') return offHtml(u.host);
        var m = M || {};
        var r = R || parseRoute('');
        var at = num(now) ? now : Date.now();
        var gates = m.gates || [];
        var body = r.tab === 'tasks' ? tasksHtml(m, at, r.focus) : r.tab === 'done' ? doneHtml(m, at) : gatesHtml(m, at);
        var open = r.open ? gates.filter(function (g) { return g.id === r.open; })[0] : null;
        return appBar(r.tab, m) + body + tabbar(r.tab, gates.length) + (open ? sheetHtml(open, at, u) : '');
    }

    function pickLang(win) {
        var saved = null;
        try { saved = win.localStorage.getItem('station.lang'); } catch (e) { saved = null; }
        if (saved === 'zh' || saved === 'en') return saved;
        return /^zh/i.test(String((win.navigator && win.navigator.language) || '')) ? 'zh' : 'en';
    }

    // What the desktop card lists the phone as: the model Android names, or
    // the platform when Chrome's reduced user agent says only `K`.
    function deviceName(ua) {
        var s = String(ua || '');
        var m = /Android[^;)]*;\s*([^;)]+)/.exec(s);
        if (m && m[1].trim() !== 'K' && m[1].trim() !== 'wv') return m[1].trim().slice(0, 40);
        m = /iPhone|iPad|Android/.exec(s);
        return m ? m[0] : 'phone';
    }

    function boot(win) {
        var d = win.document;
        var app = d.getElementById('app');
        setLang(pickLang(win));
        if (d.documentElement) d.documentElement.lang = lang === 'en' ? 'en' : 'zh-Hant';
        if (d.body && d.body.insertAdjacentHTML) d.body.insertAdjacentHTML('afterbegin', SPRITE);
        var camera = Boolean(win.BarcodeDetector && win.navigator && win.navigator.mediaDevices && win.navigator.mediaDevices.getUserMedia);
        var st = { M: null, ui: { mode: 'app' }, loading: false, tried: null, stream: null };
        function store(k, v) {
            try {
                if (v === undefined) return win.localStorage.getItem(k);
                win.localStorage.setItem(k, v);
            } catch (e) { /* private mode: nothing kept */ }
            return null;
        }
        function route() { return parseRoute(win.location.hash); }
        function post(url, fields) {
            return win.fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new win.URLSearchParams(fields).toString() });
        }
        function pairUi(extra) {
            var u = { mode: 'pair', camera: camera, manual: !camera, say: '' };
            for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) u[k] = extra[k];
            return u;
        }
        function stopScan() {
            if (!st.stream) return;
            st.stream.getTracks().forEach(function (k) { k.stop(); });
            st.stream = null;
        }
        // The camera in .vf, read by BarcodeDetector every 300 ms until a
        // pairing url turns up; refused or absent, the typed code instead.
        function scan() {
            var vf = d.querySelector ? d.querySelector('.vf') : null;
            if (!vf || st.stream || !st.ui.camera || st.ui.manual) return;
            win.navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }).then(function (stream) {
                st.stream = stream;
                var v = d.createElement('video');
                v.setAttribute('playsinline', '');
                v.muted = true;
                v.srcObject = stream;
                vf.insertBefore(v, vf.firstChild);
                v.play();
                var det = new win.BarcodeDetector({ formats: ['qr_code'] });
                (function tick() {
                    if (!st.stream) return;
                    det.detect(v).then(function (codes) {
                        var hit = null;
                        (codes || []).forEach(function (c) { hit = hit || codeIn(c.rawValue); });
                        if (hit) { stopScan(); pairWith(hit); } else win.setTimeout(tick, 300);
                    }, function () { win.setTimeout(tick, 300); });
                }());
            }, function () { st.ui = pairUi({ camera: false, manual: true }); draw(); });
        }
        function draw() {
            stopScan();
            app.innerHTML = screen(st.M, route(), Date.now(), st.ui);
            if (st.ui.mode === 'pair') scan();
            var hot = d.querySelector ? d.querySelector('[data-focus]') : null;
            if (hot && hot.scrollIntoView) hot.scrollIntoView({ block: 'center' });
        }
        function pairWith(code) {
            st.ui = pairUi({ manual: true, say: t('pair.busy') });
            draw();
            post('/station/remote/pair', { code: code, name: deviceName(win.navigator && win.navigator.userAgent) }).then(function (r) {
                if (r.status === 201) {
                    st.ui = { mode: 'app' };
                    win.location.hash = '#/gates';
                    return load();
                }
                return r.text().then(function (text) { st.ui = pairUi({ manual: true, say: t('pair.refused', { code: r.status, why: String(text || '').trim() }) }); draw(); });
            }, function () { st.ui = pairUi({ manual: true, say: t('pair.failed') }); draw(); });
        }
        // 401 is an unpaired phone; anything else that is not a 2xx, or no
        // whole reply at all, is a station this phone cannot reach. Only the
        // request is judged so: a drawing error is a bug, thrown where the
        // console shows it, never a pair-error screen.
        function load() {
            var UNPAIRED = {};
            st.loading = true;
            return win.fetch('/station/mobile.json', { credentials: 'same-origin', cache: 'no-store' }).then(function (r) {
                if (r.status === 401) return UNPAIRED;
                if (!r.ok) throw new Error(String(r.status));
                return r.json();
            }).then(function (M) {
                st.loading = false;
                if (M === UNPAIRED) {
                    var R = route();
                    if (R.pair && st.tried !== R.pair) { st.tried = R.pair; return pairWith(R.pair); }
                    st.ui = pairUi({});
                    return draw();
                }
                st.M = M;
                st.ui = { mode: 'app' };
                if (M && M.host) store('station.m.host', String(M.host));
                draw();
            }, function () {
                st.loading = false;
                st.ui = { mode: 'off', host: store('station.m.host') };
                draw();
            }).then(null, function (e) { win.setTimeout(function () { throw e; }); });
        }
        function gateOf(id) {
            return ((st.M && st.M.gates) || []).filter(function (g) { return g.id === id; })[0] || null;
        }
        // 送出答案: a refusal or a network error changes the sheet's one line
        // and nothing else, so what was picked stays picked.
        function answer(f) {
            var say = f.querySelector('.sh-say');
            var g = gateOf(f.getAttribute('data-id'));
            if (!g) { say.textContent = t('gate.gone'); return; }
            var got = collect(f.querySelectorAll('input'), (g.questions || []).length);
            var answers = answersOf(g.questions, got.picks, got.others);
            if (!answers) { say.textContent = t('gate.needAll'); return; }
            var btn = f.querySelector('.cta');
            btn.disabled = true;
            say.textContent = t('gate.sending');
            post('/answer', { root: g.root, id: g.id, answers: JSON.stringify(answers) }).then(function (r) {
                if (r.status === 201) { win.location.hash = '#/gates'; return load(); }
                return r.text().then(function (text) { btn.disabled = false; say.textContent = t('gate.refused', { code: r.status, why: String(text || '').trim() }); });
            }, function () { btn.disabled = false; say.textContent = t('gate.failed'); });
        }
        d.addEventListener('submit', function (e) {
            var f = e.target;
            if (!f || !f.getAttribute) return;
            if (f.id === 'gate-sheet') { e.preventDefault(); answer(f); return; }
            if (f.getAttribute('data-pair-form') !== null) {
                e.preventDefault();
                var input = f.querySelector('input');
                var code = codeIn(input ? input.value : '');
                if (code) pairWith(code);
                else { st.ui = pairUi({ manual: true, say: t('pair.bad') }); draw(); }
            }
        });
        d.addEventListener('click', function (e) {
            var el = e.target && e.target.closest ? e.target.closest('[data-act],[data-close]') : null;
            if (!el) return;
            if (el.getAttribute('data-close') !== null) { win.location.hash = '#/gates'; return; }
            var act = el.getAttribute('data-act');
            if (act === 'manual') { st.ui = pairUi({ manual: true }); draw(); }
            else if (act === 'retry') load();
            else if (act === 'repair') { st.ui = pairUi({}); draw(); }
        });
        // Typing in a 自己寫 box ticks its own radio or checkbox.
        function own(e) {
            var el = e.target;
            if (!el || !el.getAttribute || el.getAttribute('data-own') === null) return;
            var box = el.closest ? el.closest('label') : null;
            var pick = box ? box.querySelector('input[value="__other"]') : null;
            if (pick) pick.checked = true;
        }
        d.addEventListener('input', own);
        d.addEventListener('focusin', own);
        d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && route().open) win.location.hash = '#/gates'; });
        d.addEventListener('visibilitychange', function () { if (d.visibilityState === 'visible' && st.ui.mode === 'app' && !route().open) load(); });
        win.addEventListener('hashchange', function () { draw(); if (route().open && !gateOf(route().open)) load(); });
        win.setInterval(function () {
            if (!st.loading && d.visibilityState === 'visible' && st.ui.mode === 'app' && !route().open) load();
        }, POLL_MS);
        if (win.navigator && win.navigator.serviceWorker) win.navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function () { /* the page works without it */ });
        load();
    }

    var api = {
        parseRoute: parseRoute, screen: screen, answersOf: answersOf, collect: collect, codeIn: codeIn, setLang: setLang, STR: STR,
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_M = api;
    if (w && w.document && w.document.getElementById && w.document.getElementById('app')) boot(w);
}(typeof window !== 'undefined' ? window : null));
