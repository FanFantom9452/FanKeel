'use strict';
// assets/station/mobile.js — the phone station, /m
// (docs/99-archive/2026-10-22-mobile-session-design.md; the approved
// mockup's direction A: m-home-a, m-chat-a, m-composer-a, m-tools, m-attach,
// m-background, m-idle, m-gate-inline, and pair-scan / pair-error from the
// remote design). The session list reads /station/mobile.json (lib/mobile.js)
// every five seconds; a session's conversation reads
// /station/phone.json?id=<id> every two, and redraws only what changed, so a
// reload never wipes what is being picked, typed or said. Messages go through
// POST /phone/say, which a holding Stop hook hands to the session; a held gate
// is answered through POST /answer. Pairs through POST /station/remote/pair,
// whose 201 sets the device cookie the browser sends itself. Carries its own
// strings — station.js's loc() table is not on this page. The drawing
// functions are pure and exported for the tests; `boot` runs only on a page
// with #app.
(function (w) {
    var STR = {
        zh: {
            'home.title': 'Session', 'home.hist': '完成的任務', 'home.sub': '訂閱通知', 'home.subWeb': '網頁', 'home.empty': '沒有在跑的 session',
            'sum.ask': '<b>{n}</b> 個等你', 'sum.run': '<b>{n}</b> 個在跑', 'sum.idle': '<b>{n}</b> 個閒置',
            'grp.ask': '等你答', 'grp.run': '在跑', 'grp.idle': '停下來',
            'st.ask': '等你答', 'st.held': '手機接著', 'st.run': '跑中', 'st.bg': '背景跑中 · {n}', 'st.idle': '閒置',
            'home.go': '去答', 'home.left': '剩 {t}', 'home.more': '+{n} 個', 'home.you': '你：', 'home.stopped': '停下來了，沒有在跑的工作',
            'chat.back': '回 Session 清單', 'chat.log': '對話', 'chat.gone': '這個 session 不在了',
            'who.pc': '電腦', 'who.ph': '手機', 'who.ai': 'Claude',
            'chat.sent': '已送進 session', 'chat.queued': '等這回合跑完就送進去', 'chat.work': 'Claude 正在做…',
            'give': '交還電腦', 'ro': '只能看',
            'att.go': '接上這個 session', 'att.run': '下一回合結束時改由手機接手，電腦會顯示它在手機上。', 'att.bg': '背景跑完、Claude 接著做完那一回合時，改由手機接手。',
            'bg.label': '背景工作', 'bg.still': '還在跑', 'bg.head': '背景工作 {n} 個', 'bg.start': '{kind} · {t} 開始', 'bg.run': '跑中',
            'bg.foot': '背景工作完成後 Claude 會自己接著做，不用回覆',
            'idle.title': '閒置的 session 手機推不動', 'idle.why': '停下來了，沒有在跑的工作。它停在電腦的輸入框等你打字，手機送的訊息沒有地方接。',
            'idle.give.t': '交給手機', 'idle.give': '在電腦打 <code>/fankeel-phone</code>，這回合一結束就換手機接。',
            'idle.wait.t': '或等它', 'idle.wait': '電腦那邊再送出任何一句，那回合結束時手機就能接上。',
            'steps.n': '{n} 個步驟', 'steps.files': '改了 {n} 個檔', 'steps.agents': '{n} 個 agent', 'steps.failed': '{n} 個失敗',
            'steps.ran': '跑了 {t}', 'steps.folded': '前 {n} 個收起', 'steps.now': '正在：{label}', 'steps.fail': '失敗',
            'dur.tenths': '{n} 秒', 'dur.sec': '{n} 秒', 'dur.min': '{m} 分 {s} 秒',
            'cmp.label': '給 Claude 的下一句', 'cmp.ph': '給 Claude 的下一句…', 'cmp.send': '送出',
            'cmp.held': '手機接著：送出就是下一句', 'cmp.next': '這回合跑完就送進去', 'cmp.waiting': '上一句還在等這回合跑完', 'cmp.voice': '按麥克風用講的',
            'mic.label': '用講的輸入', 'mic.answer': '用講的寫答案', 'mic.hint': '想用講的：按麥克風，會自動選這一項',
            'mic.on': '聆聽中… 再按一次停止', 'mic.done': '聽好了：可以改字，按送出才會送',
            'mic.denied': '沒有麥克風權限：到瀏覽器設定允許，或改按鍵盤上的語音鍵', 'mic.missed': '沒聽清楚：再按一次麥克風',
            'gc.head': '{stage} gate', 'gc.left': '剩 {t} · 之後轉回電腦',
            'gate.pick': '選一個答案', 'gate.pickMany': '可以選幾個', 'gate.own': '自己寫答案…', 'gate.rec': '建議', 'gate.send': '送出答案',
            'gate.sending': '送出中…', 'gate.sent': '送出了，等 Claude 接著做', 'gate.needAll': '每一題都要有答案',
            'gate.failed': '沒送到：可以再按一次', 'gate.gone': '這個 gate 已經不在等了', 'gate.refused': '測站沒收下（{code}）：{why}',
            'done.title': '完成', 'done.empty': '48 小時內沒有完成的', 'done.end': '任務結束', 'done.stage': '完成 ·', 'done.today': '今天', 'done.yesterday': '昨天', 'done.upTo': '到 {t}',
            'ago.now': '剛剛', 'ago.min': '{n} 分', 'ago.hour': '{n} 小時', 'ago.day': '{n} 天',
            'host.on': '已連上 {host}', 'host.station': '測站',
            'pair.title': '掃桌機測站上的 QR', 'pair.where': '在 <b>設定</b> › <b>手機遠端</b>', 'pair.frame': '相機取景框', 'pair.type': '輸入配對碼',
            'pair.code': '8 位配對碼', 'pair.go': '配對', 'pair.busy': '配對中…', 'pair.failed': '連不到測站：再試一次', 'pair.bad': '配對碼是 8 個英文字母或數字', 'pair.refused': '配對沒成功（{code}）：{why}',
            'off.title': '連不到 {host}', 'off.hint': '打開手機的 Tailscale 再試。', 'off.badge': 'Tailscale 未連線', 'off.retry': '重試', 'off.repair': '重新配對',
        },
        en: {
            'home.title': 'Session', 'home.hist': 'Finished tasks', 'home.sub': 'Get notified', 'home.subWeb': 'Web', 'home.empty': 'No session is running',
            'sum.ask': '<b>{n}</b> need you', 'sum.run': '<b>{n}</b> running', 'sum.idle': '<b>{n}</b> idle',
            'grp.ask': 'Needs you', 'grp.run': 'Running', 'grp.idle': 'Stopped',
            'st.ask': 'Needs you', 'st.held': 'On phone', 'st.run': 'Running', 'st.bg': 'Background · {n}', 'st.idle': 'Idle',
            'home.go': 'Answer', 'home.left': '{t} left', 'home.more': '+{n} more', 'home.you': 'You: ', 'home.stopped': 'Stopped, nothing running',
            'chat.back': 'Back to sessions', 'chat.log': 'Conversation', 'chat.gone': 'This session is gone',
            'who.pc': 'Desktop', 'who.ph': 'Phone', 'who.ai': 'Claude',
            'chat.sent': 'Sent to the session', 'chat.queued': 'Goes in when this turn ends', 'chat.work': 'Claude is working…',
            'give': 'Back to desktop', 'ro': 'Read only',
            'att.go': 'Take over this session', 'att.run': 'The phone takes over when this turn ends; the desktop shows it is on the phone.', 'att.bg': 'The phone takes over once the background work ends and Claude finishes that turn.',
            'bg.label': 'Background work', 'bg.still': 'Still running', 'bg.head': '{n} background jobs', 'bg.start': '{kind} · started {t}', 'bg.run': 'running',
            'bg.foot': 'When the background work ends Claude carries on by itself; no reply needed',
            'idle.title': 'The phone cannot push an idle session', 'idle.why': 'Stopped, nothing running. It waits at the desktop prompt, and a message from the phone has nowhere to go.',
            'idle.give.t': 'Hand it over', 'idle.give': 'Type <code>/fankeel-phone</code> on the desktop; the phone takes over when that turn ends.',
            'idle.wait.t': 'Or wait', 'idle.wait': 'Send anything from the desktop, and the phone can take over when that turn ends.',
            'steps.n': '{n} steps', 'steps.files': '{n} files changed', 'steps.agents': '{n} agents', 'steps.failed': '{n} failed',
            'steps.ran': 'ran {t}', 'steps.folded': 'first {n} folded', 'steps.now': 'Now: {label}', 'steps.fail': 'failed',
            'dur.tenths': '{n} s', 'dur.sec': '{n} s', 'dur.min': '{m} min {s} s',
            'cmp.label': 'Next message to Claude', 'cmp.ph': 'Next message to Claude…', 'cmp.send': 'Send',
            'cmp.held': 'On the phone: what you send is the next message', 'cmp.next': 'Goes in when this turn ends', 'cmp.waiting': 'The last message is still waiting for this turn to end', 'cmp.voice': 'tap the mic to speak',
            'mic.label': 'Speak instead of typing', 'mic.answer': 'Speak your answer', 'mic.hint': 'Tap the mic to speak; it picks this option',
            'mic.on': 'Listening… tap again to stop', 'mic.done': 'Heard: edit it if you like; only Send sends',
            'mic.denied': 'No microphone permission: allow it in the browser settings, or use the keyboard\'s voice key', 'mic.missed': 'Did not catch that: tap the mic again',
            'gc.head': '{stage} gate', 'gc.left': '{t} left · then back to the desktop',
            'gate.pick': 'Pick one answer', 'gate.pickMany': 'Pick any number', 'gate.own': 'Write your own answer…', 'gate.rec': 'Recommended', 'gate.send': 'Send answer',
            'gate.sending': 'Sending…', 'gate.sent': 'Sent; Claude carries on', 'gate.needAll': 'Every question needs an answer',
            'gate.failed': 'Not sent: press again', 'gate.gone': 'This gate is no longer waiting', 'gate.refused': 'The station refused it ({code}): {why}',
            'done.title': 'Done', 'done.empty': 'Nothing finished in the last 48 hours', 'done.end': 'Task ended', 'done.stage': 'done ·', 'done.today': 'Today', 'done.yesterday': 'Yesterday', 'done.upTo': 'up to {t}',
            'ago.now': 'now', 'ago.min': '{n} min', 'ago.hour': '{n} h', 'ago.day': '{n} d',
            'host.on': 'Connected to {host}', 'host.station': 'the station',
            'pair.title': 'Scan the QR on the desktop station', 'pair.where': 'Under <b>Settings</b> › <b>Phone remote</b>', 'pair.frame': 'Camera viewfinder', 'pair.type': 'Type the pairing code',
            'pair.code': '8-character code', 'pair.go': 'Pair', 'pair.busy': 'Pairing…', 'pair.failed': 'Could not reach the station: try again', 'pair.bad': 'A pairing code is 8 letters or digits', 'pair.refused': 'Pairing refused ({code}): {why}',
            'off.title': 'Cannot reach {host}', 'off.hint': 'Turn on Tailscale on this phone and try again.', 'off.badge': 'Tailscale not connected', 'off.retry': 'Retry', 'off.repair': 'Pair again',
        },
    };
    var lang = 'zh';
    var POLL_MS = 5000;
    var CHAT_MS = 2000;
    var STAGES = ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'];
    // Each state's screen root, as the mockup names its block.
    var SCREEN = {
        gate: 'data-block="m-gate-inline"', idle: 'data-block="m-idle"', background: 'data-block="m-background"',
        holding: 'data-block="m-chat-a"', attached: 'data-block="m-chat-a"', running: 'data-block="m-attach"',
    };
    var ORDER = { holding: 0, running: 1, background: 2 };
    // An assistant line past this is cut: a phone screen, not the transcript.
    var MSG_CAP = 2000;
    // A label ending in (Recommended) or (建議) is picked before anything is touched.
    var REC = /\s*\((?:Recommended|建議)\)\s*$/;
    var TOOL_IC = { Bash: 'term', Edit: 'pencil', Write: 'pencil', NotebookEdit: 'pencil', Agent: 'bot', Task: 'bot', Read: 'eye' };
    // The mockup's icons: Lucide (ISC) on 24, the station's own set on 16.
    var SPRITE = '<svg width="0" height="0" style="position:absolute" aria-hidden="true">'
        + '<symbol id="i-gate" viewBox="0 0 16 16"><path d="M8 1.8 13.5 4v4c0 3-2.4 5.3-5.5 6.2C4.9 13.3 2.5 11 2.5 8V4z"/><path d="M8 5.2v3.3M8 10.8v.01"/></symbol>'
        + '<symbol id="i-check" viewBox="0 0 16 16"><path d="M3.5 8.5 6.5 11.5 12.5 5"/></symbol>'
        + '<symbol id="i-chev" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></symbol>'
        + '<symbol id="i-back" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></symbol>'
        + '<symbol id="i-cc" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></symbol>'
        + '<symbol id="i-kbd" viewBox="0 0 24 24"><path d="M10 8h.01"/><path d="M12 12h.01"/><path d="M14 8h.01"/><path d="M16 12h.01"/><path d="M18 8h.01"/><path d="M6 8h.01"/><path d="M7 16h10"/><path d="M8 12h.01"/><rect width="20" height="16" x="2" y="4" rx="2"/></symbol>'
        + '<symbol id="i-pencil" viewBox="0 0 24 24"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></symbol>'
        + '<symbol id="i-laptop" viewBox="0 0 24 24"><path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"/></symbol>'
        + '<symbol id="i-phone" viewBox="0 0 24 24"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></symbol>'
        + '<symbol id="i-up" viewBox="0 0 24 24"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></symbol>'
        + '<symbol id="i-mic" viewBox="0 0 24 24"><path d="M12 19v3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><rect x="9" y="2" width="6" height="13" rx="3"/></symbol>'
        + '<symbol id="i-hist" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></symbol>'
        + '<symbol id="i-term" viewBox="0 0 24 24"><path d="M12 19h8"/><path d="m4 17 6-6-6-6"/></symbol>'
        + '<symbol id="i-bot" viewBox="0 0 24 24"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></symbol>'
        + '<symbol id="i-pause" viewBox="0 0 24 24"><rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/></symbol>'
        + '<symbol id="i-spin" viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></symbol>'
        + '<symbol id="i-eye" viewBox="0 0 24 24"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></symbol>'
        + '<symbol id="i-wifioff" viewBox="0 0 24 24"><path d="M12 20h.01"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/><path d="M5 12.859a10 10 0 0 1 5.17-2.69"/><path d="M19 12.859a10 10 0 0 0-2.007-1.523"/><path d="M2 8.82a15 15 0 0 1 4.177-2.643"/><path d="M22 8.82a15 15 0 0 0-11.288-3.764"/><path d="m2 2 20 20"/></symbol>'
        + '<symbol id="i-refresh" viewBox="0 0 24 24"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></symbol>'
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
    // m:ss, for a countdown or a step still running.
    function clock(ms) { var s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ':' + pad(s % 60); }
    function dayOf(at) { var d = new Date(at); return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); }
    function usd(v) { return num(v) ? '$' + v.toFixed(2) : '—'; }

    // #/ the session list, #/s/<id> one session's conversation (#/gate/<id>
    // and #/task/<id>, which lib/notify.js's taps open, land there too),
    // #/done the history, #/pair/<code> the desktop QR's pairing url.
    function parseRoute(hash) {
        var h = String(hash || '').replace(/^#/, '');
        var m = /^\/pair\/([A-Za-z0-9]{8})$/.exec(h);
        if (m) return { view: 'home', id: null, pair: m[1].toUpperCase() };
        m = /^\/(?:s|gate|task)\/([0-9A-Za-z-]+)$/.exec(h);
        if (m) return { view: 'chat', id: m[1], pair: null };
        if (h === '/done') return { view: 'done', id: null, pair: null };
        return { view: 'home', id: null, pair: null };
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

    // The gate card's inputs: every ticked value per question (`q<n>`), and a
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

    // Consecutive tool / tool-end lines are one group; an empty assistant
    // line ends a turn and draws nothing.
    function turnsOf(chat) {
        var out = [];
        var group = null;
        (chat || []).forEach(function (x) {
            if (x.role === 'tool' || x.role === 'tool-end') {
                if (!group) { group = { kind: 'steps', items: [], ends: {} }; out.push(group); }
                if (x.role === 'tool') group.items.push(x); else group.ends[x.id] = x;
                return;
            }
            group = null;
            if (x.role === 'assistant' && !String(x.text || '').trim()) return;
            out.push({ kind: 'msg', role: x.role, text: String(x.text || ''), at: x.at });
        });
        out.forEach(function (g) {
            if (g.kind !== 'steps') return;
            g.items = g.items.map(function (s) { var e = g.ends[s.id]; return Object.assign({}, s, { end: e ? e.at : null, ok: e ? e.ok !== false : null }); });
        });
        return out;
    }

    // 「N 個步驟 · 改了 K 個檔 · A 個 agent · F 個失敗」— a part only when it is not zero;
    // a step with no tool-end by the turn's end counts as failed (spec, Not verified).
    function stepsLine(items) {
        var files = {};
        var agents = 0;
        var failed = 0;
        items.forEach(function (s) {
            if (/^(Edit|Write|NotebookEdit)$/.test(s.tool)) files[s.label] = true;
            if (s.tool === 'Agent' || s.tool === 'Task') agents++;
            if (s.ok !== true) failed++;
        });
        var k = Object.keys(files).length;
        return [t('steps.n', { n: items.length })]
            .concat(k ? [t('steps.files', { n: k })] : [], agents ? [t('steps.agents', { n: agents })] : [], failed ? [t('steps.failed', { n: failed })] : [])
            .join(' · ');
    }

    function dur(ms) {
        var s = Math.max(0, ms) / 1000;
        if (s < 10) return t('dur.tenths', { n: s.toFixed(1) });
        if (s < 60) return t('dur.sec', { n: Math.floor(s) });
        return t('dur.min', { m: Math.floor(s / 60), s: Math.floor(s % 60) });
    }

    // A project's tile: initials of a two-part name, else its first two
    // characters, in one of six colours the name always picks.
    function avatar(name) {
        var s = String(name || '');
        var parts = s.split(/[\s._-]+/).filter(Boolean);
        var h = 0;
        for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
        var text = parts.length >= 2 ? parts[0].charAt(0) + parts[1].charAt(0) : s.slice(0, 2);
        return '<span class="av" style="--pc:var(--p-' + (Math.abs(h) % 6) + ')">' + esc(text) + '</span>';
    }

    // One state chip; a session the phone holds or is attached to reads 手機接著.
    function chip(x) {
        var bg = (x.background || []).length;
        if (x.state === 'gate') return '<span class="st ask">' + ic('gate') + t('st.ask') + '</span>';
        if (x.state === 'idle') return '<span class="st idle">' + ic('kbd') + t('st.idle') + '</span>';
        if (x.state === 'holding' || x.attached) return '<span class="st held">' + ic('phone') + t('st.held') + '</span>';
        if (x.state === 'background') return '<span class="st bg"><i class="lv"></i>' + t('st.bg', { n: bg }) + '</span>';
        return '<span class="st run"><i class="lv"></i>' + t('st.run') + '</span>';
    }

    function hostHtml(m) {
        return '<span class="host" aria-label="' + esc(t('host.on', { host: m.host || '' })) + '"><i class="dot live"></i>' + esc(m.host || t('host.station')) + '</span>';
    }

    function bgList(items, at) {
        var shown = items.slice(0, 2).map(function (b) {
            return '<li>' + ic(b.type === 'shell' ? 'term' : 'bot') + '<span class="d">' + esc(b.description || b.command) + '</span>'
                + (num(b.since) ? '<span class="t">' + esc(ago(at - b.since)) + '</span>' : '') + '</li>';
        }).join('');
        return '<ul class="bgl" aria-label="' + t('bg.label') + '">' + shown
            + (items.length > 2 ? '<li class="more">' + t('home.more', { n: items.length - 2 }) + '</li>' : '') + '</ul>';
    }

    function homeRow(x, at, m) {
        var head = '<a class="ha-row' + (x.state === 'holding' ? ' ha-held' : '') + '" href="#/s/' + esc(x.id) + '">' + avatar(x.project) + '<span class="ha-main">';
        var sub = '<span class="ha-sub">' + esc(x.project) + stw(x.stage) + chip(x) + '</span>';
        if (x.state === 'gate') {
            var g = ((m.gates || []).filter(function (y) { return y.id === x.id; })[0]) || {};
            var q = (g.questions || [])[0];
            return head + '<span class="ha-top"><span class="ha-t">' + esc(x.task) + '</span>'
                + (num(g.until) ? '<time>' + t('home.left', { t: clock(g.until - at) }) + '</time>' : '') + '</span>' + sub
                + '<span class="ha-q"><span>' + esc((q && q.question) || '') + '</span><span class="btn">' + t('home.go') + ic('chev') + '</span></span></span></a>';
        }
        var top = '<span class="ha-top"><span class="ha-t">' + esc(x.task) + '</span>'
            + (num(x.updated) ? '<time>' + esc(ago(at - x.updated)) + '</time>' : '') + '</span>';
        var tail = '';
        if (x.state === 'idle') tail = '<span class="ha-stop">' + ic('pause') + t('home.stopped') + '</span>';
        else if (x.state === 'background' && (x.background || []).length) tail = bgList(x.background, at);
        else if (x.last && x.last.text) tail = '<span class="ha-prev">' + (x.last.role === 'desktop' || x.last.role === 'phone' ? t('home.you') : '') + esc(x.last.text) + '</span>';
        return head + top + sub + tail + '</span></a>';
    }

    function homeHtml(m, at) {
        var tasks = m.tasks || [];
        var asks = tasks.filter(function (x) { return x.state === 'gate'; });
        var idle = tasks.filter(function (x) { return x.state === 'idle'; });
        var live = tasks.filter(function (x) { return x.state !== 'gate' && x.state !== 'idle'; })
            .map(function (x, i) { return { x: x, i: i }; })
            .sort(function (a, b) {
                var oa = ORDER[a.x.state] === undefined ? 3 : ORDER[a.x.state];
                var ob = ORDER[b.x.state] === undefined ? 3 : ORDER[b.x.state];
                return oa - ob || a.i - b.i;
            }).map(function (o) { return o.x; });
        function rows(list) { return list.map(function (x) { return homeRow(x, at, m); }).join(''); }
        function gh(key, n) { return '<p class="ha-gh">' + t(key) + ' <span>' + n + '</span></p>'; }
        var body = !tasks.length ? '<div class="empty"><h2>' + t('home.empty') + '</h2></div>'
            : '<p class="ha-sum"><span class="a">' + t('sum.ask', { n: asks.length }) + '</span><span class="sep">·</span><span class="r">' + t('sum.run', { n: live.length })
                + '</span><span class="sep">·</span><span class="i">' + t('sum.idle', { n: idle.length }) + '</span></p>'
                + (asks.length ? gh('grp.ask', asks.length) + '<div class="ha-ask">' + rows(asks) + '</div>' : '')
                + (live.length ? gh('grp.run', live.length) + '<div class="ha-list">' + rows(live) + '</div>' : '')
                + (idle.length ? gh('grp.idle', idle.length) + '<div class="ha-idle ha-list">' + rows(idle) + '</div>' : '');
        // The ntfy app opens its subscribe dialog from ntfy://; a phone
        // without the app uses the web topic beside it.
        var sub = m.notify && m.notify.app ? '<a class="ha-subscribe" href="' + esc(m.notify.app) + '">' + t('home.sub') + '</a>'
            + '<a class="ha-subscribe-web" href="' + esc(m.notify.web) + '" target="_blank" rel="noopener">' + t('home.subWeb') + '</a>' : '';
        return '<div class="pg" data-block="m-home-a"><header class="ab"><h1>' + t('home.title') + '</h1>' + (tasks.length ? '<span class="n">' + tasks.length + '</span>' : '')
            + '<span class="sp"></span>' + sub + '<a class="ha-hist" href="#/done" aria-label="' + t('home.hist') + '" title="' + t('home.hist') + '">' + ic('hist') + '</a>' + hostHtml(m) + '</header>'
            + '<div class="ha-body">' + body + '</div></div>';
    }

    // Claude's words: paragraphs on blank lines, `code`, line breaks; cut long.
    function prose(text) {
        var s = String(text || '');
        if (s.length > MSG_CAP) s = s.slice(0, MSG_CAP) + '…';
        return s.split(/\n\s*\n/).map(function (p) {
            return '<p>' + esc(p.trim()).replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\n/g, '<br>') + '</p>';
        }).join('');
    }

    function bubble(role, text, at, sent) {
        var when = num(at) ? ' <time>' + hm(at) + '</time>' : '';
        if (role === 'assistant') return '<div class="msg ai"><span class="who">' + t('who.ai') + when + '</span><div class="bub">' + prose(text) + '</div></div>';
        var pc = role === 'desktop';
        return '<div class="msg me ' + (pc ? 'pc' : 'ph') + '"><span class="who">' + ic(pc ? 'laptop' : 'phone') + t(pc ? 'who.pc' : 'who.ph') + when + '</span>'
            + '<p class="bub">' + esc(text) + '</p>' + (sent ? '<span class="sent">' + sent + '</span>' : '') + '</div>';
    }

    function stepRow(s, at) {
        if (s.end === null || s.end === undefined) {
            return '<li class="tl-row now">' + ic('spin') + '<span class="lb"><span><b>' + t('steps.now', { label: esc(s.label) }) + '</b></span></span>'
                + '<span class="tm">' + (num(s.at) ? clock(at - s.at) : '') + '</span></li>';
        }
        var took = num(s.at) && num(s.end) ? dur(s.end - s.at) : '';
        if (s.ok === false) {
            return '<li class="tl-row fail">' + ic(TOOL_IC[s.tool] || 'chev') + '<span class="lb"><span>' + esc(s.label) + '</span></span>'
                + '<span class="tm"><span class="bad"><i></i>' + t('steps.fail') + '</span>' + took + '</span></li>';
        }
        return '<li class="tl-row done">' + ic('check') + '<span class="lb"><span>' + esc(s.label) + '</span></span><span class="tm">' + took + '</span></li>';
    }

    // A turn's steps: one line once it is over (a tap opens them all); the
    // turn still running shows its last three rows under how long it has run.
    function stepsHtml(g, live, at, open) {
        var items = g.items;
        var key = String((items[0] && items[0].id) || '');
        if (live) {
            var first = items[0] && num(items[0].at) ? items[0].at : at;
            var head = [t('steps.n', { n: items.length }), t('steps.ran', { t: clock(at - first) })]
                .concat(items.length > 3 ? [t('steps.folded', { n: items.length - 3 })] : []).join(' · ');
            return '<div class="tl" data-block="m-tools" role="status"><p class="tl-sum">' + head + '</p><ol class="tl-list">'
                + items.slice(-3).map(function (s) { return stepRow(s, at); }).join('') + '</ol></div>';
        }
        var shown = Boolean(open && open[key]);
        return '<div class="tl" data-block="m-tools"><button type="button" class="tl-sum" data-act="steps" data-key="' + esc(key) + '" aria-expanded="' + shown + '">'
            + ic('chev', 'chev') + esc(stepsLine(items)) + '</button>'
            + (shown ? '<ol class="tl-list">' + items.map(function (s) { return stepRow(s, at); }).join('') + '</ol>' : '') + '</div>';
    }

    function bgPanel(items, at) {
        return '<section class="bgp" aria-label="' + t('bg.label') + '"><div class="bgp-h"><span class="st bg"><i class="lv"></i>' + t('bg.still') + '</span><b>'
            + t('bg.head', { n: items.length }) + '</b><span class="sp"></span></div><ol>'
            + items.map(function (b) {
                return '<li class="bgp-i"><span class="k">' + ic(b.type === 'shell' ? 'term' : 'bot') + '</span><span class="d"><b>' + esc(b.description || b.command) + '</b>'
                    + '<small>' + t('bg.start', { kind: esc(b.type), t: num(b.since) ? hm(b.since) : '' }) + '</small></span>'
                    + '<span class="t">' + (num(b.since) ? esc(ago(at - b.since)) : '') + '<span><i class="lv"></i>' + t('bg.run') + '</span></span></li>';
            }).join('') + '</ol><p class="bgp-f">' + ic('cc') + t('bg.foot') + '</p></section>';
    }

    function gateCard(p, at, u) {
        var g = p.gate || {};
        var body = (g.questions || []).map(function (q, qi) {
            var opts = Array.isArray(q.options) ? q.options : [];
            var type = q.multiSelect ? 'checkbox' : 'radio';
            return '<p class="gc-q" id="gc-q' + qi + '">' + esc(q.question || '') + '</p>'
                + '<fieldset class="opts" data-voice><legend class="vh">' + t(q.multiSelect ? 'gate.pickMany' : 'gate.pick') + '</legend>'
                + opts.map(function (o) { return optionHtml(q, qi, o, REC.test(String((o && o.label) || ''))); }).join('')
                + '<label class="opt other"><input type="' + type + '" name="q' + qi + '" value="__other"><span class="rd" aria-hidden="true"></span>'
                + '<textarea class="own" id="gc-own' + qi + '" data-own="' + qi + '" rows="1" placeholder="' + t('gate.own') + '" aria-label="' + t('gate.own') + '"></textarea>'
                + (u.mic ? '<button type="button" class="gmic" data-mic="gc-own' + qi + '" aria-label="' + t('mic.answer') + '">' + ic('mic') + '</button>' : '')
                + '</label><p class="gc-say" data-say>' + (u.mic ? t('mic.hint') : '') + '</p></fieldset>';
        }).join('');
        return '<form class="gc" id="gate-card" data-id="' + esc(p.id) + '" aria-labelledby="gc-q0">'
            + '<div class="gc-h">' + ic('gate') + t('gc.head', { stage: esc(p.stage) }) + '<span class="sp"></span>'
            + (num(g.until) ? '<span class="left">' + t('gc.left', { t: clock(g.until - at) }) + '</span>' : '') + '</div>'
            + '<div class="gc-b">' + body + '<p class="gc-st" role="status"></p><button type="submit" class="cta">' + t('gate.send') + '</button></div></form>';
    }

    // What .cv holds: the conversation, the steps, and the state's own last
    // card — the one part a poll redraws while the bar below stays.
    function cvInner(p, at, u) {
        var turns = turnsOf(p.chat);
        var live = p.state === 'running' || p.state === 'gate';
        var lastPhone = -1;
        turns.forEach(function (g, i) { if (g.kind === 'msg' && g.role === 'phone') lastPhone = i; });
        var openLast = live && turns.length && turns[turns.length - 1].kind === 'steps';
        var out = turns.map(function (g, i) {
            if (g.kind === 'steps') return stepsHtml(g, openLast && i === turns.length - 1, at, u.open);
            if (g.role !== 'desktop' && g.role !== 'phone' && g.role !== 'assistant') return '';
            return bubble(g.role, g.text, g.at, i === lastPhone ? ic('check') + t('chat.sent') : '');
        }).join('');
        if (p.state === 'running' && !openLast) {
            var start = null;
            turns.forEach(function (g) { if (g.kind === 'msg' && g.role !== 'assistant' && num(g.at)) start = g.at; });
            out += '<div class="work" role="status"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><b>' + t('chat.work') + '</b>'
                + (start !== null ? '<span class="mono">' + esc(ago(at - start)) + '</span>' : '') + '</div>';
        }
        if (p.waiting) out += bubble('phone', p.waiting.text, p.waiting.at, t('chat.queued'));
        if (p.state === 'background') out += bgPanel(p.background || [], at);
        if (p.state === 'idle') out += '<p class="ev"><span>' + ic('pause') + t('home.stopped') + '</span></p>';
        if (p.state === 'gate') out += gateCard(p, at, u);
        return out;
    }

    function composer(p, u) {
        var waiting = Boolean(p.waiting);
        var draft = String(u.draft || '');
        var hint = waiting ? t('cmp.waiting') : p.state === 'holding' ? t('cmp.held') : t('cmp.next');
        return '<form class="cmp" id="composer" data-block="m-composer-a"><div class="cmp-row' + (u.mic ? '' : ' no-mic') + '">'
            + (u.mic ? '<button type="button" class="mic" data-mic="cmp-box" aria-label="' + t('mic.label') + '">' + ic('mic') + '</button>' : '')
            + '<label class="vh" for="cmp-box">' + t('cmp.label') + '</label>'
            + '<textarea id="cmp-box" name="text" rows="1" placeholder="' + t('cmp.ph') + '"' + (waiting ? ' disabled' : '') + '>' + esc(draft) + '</textarea>'
            + '<button type="submit" class="send" aria-label="' + t('cmp.send') + '"' + (waiting || !draft.trim() ? ' disabled' : '') + '>' + ic('up') + '</button></div>'
            + '<p class="cmp-hint" data-say>' + hint + (u.mic && !waiting ? ' · ' + t('cmp.voice') : '') + '</p></form>';
    }

    function chatHtml(m, id, at, u, P) {
        var row = (m.tasks || []).filter(function (x) { return x.id === id; })[0];
        // Until its phone.json arrives, the session's mobile.json row stands in.
        var p = P || (row ? Object.assign({}, row, { chat: row.last ? [row.last] : [], waiting: null, gate: null }) : null);
        var back = '<a class="bk" href="#/" aria-label="' + t('chat.back') + '">' + ic('back') + '</a>';
        if (!p) return '<div class="pg"><header class="ch-h">' + back + '<span></span><span></span></header><div class="empty"><h2>' + t('chat.gone') + '</h2></div></div>';
        if (p.state === 'gate' && !p.gate) p = Object.assign({}, p, { gate: (m.gates || []).filter(function (g) { return g.id === id; })[0] || null });
        var attached = p.attached && p.state !== 'gate' && p.state !== 'idle';
        var side = attached ? '<button type="button" class="give" data-act="detach">' + ic('laptop') + t('give') + '</button>'
            : p.state === 'idle' ? '<span class="ro">' + ic('eye') + t('ro') + '</span>' : '<span></span>';
        var bottom = '';
        if (p.state === 'idle') {
            bottom = '<div class="idl" role="note"><h3><span class="ic-w">' + ic('kbd') + '</span>' + t('idle.title') + '</h3><p>' + t('idle.why') + '</p>'
                + '<dl><dt>' + t('idle.give.t') + '</dt><dd>' + t('idle.give') + '</dd><dt>' + t('idle.wait.t') + '</dt><dd>' + t('idle.wait') + '</dd></dl></div>';
        } else if (p.state === 'holding' || attached) {
            bottom = composer(p, u);
        } else if (p.state === 'running' || p.state === 'background') {
            bottom = '<div class="att"><button type="button" class="cta" data-act="attach">' + ic('phone') + t('att.go') + '</button><p>'
                + t(p.state === 'background' ? 'att.bg' : 'att.run') + '</p></div>';
        }
        return '<div class="pg" ' + SCREEN[attached ? 'attached' : p.state] + '><header class="ch-h">' + back
            + '<div><p class="ch-t">' + esc(p.task) + '</p><p class="ch-m">' + esc(p.project) + stw(p.stage) + chip(p) + '</p></div>' + side + '</header>'
            + '<div class="cv" role="log" aria-label="' + t('chat.log') + '">' + cvInner(p, at, u) + '</div>'
            + (u.note ? '<p class="note" role="status">' + esc(u.note) + '</p>' : '') + bottom + '</div>';
    }

    function optionHtml(q, qi, o, on) {
        var label = String((o && o.label) || '');
        var shown = label.replace(REC, '');
        return '<label class="opt"><input type="' + (q.multiSelect ? 'checkbox' : 'radio') + '" name="q' + qi + '" value="' + esc(label) + '"' + (on ? ' checked' : '') + '>'
            + '<span class="rd" aria-hidden="true"></span><span class="opt-l">' + esc(shown) + (shown !== label ? '<span class="gq-rec">' + t('gate.rec') + '</span>' : '') + '</span>'
            + (o && o.description ? '<span class="opt-d">' + esc(o.description) + '</span>' : '') + '</label>';
    }

    function doneRow(x) {
        var meta = x.kind === 'end'
            ? '<span class="end">' + ic('cc', 'g24') + t('done.end') + '</span><span>·</span>'
            : stw(x.stage) + '<span>' + t('done.stage') + '</span>';
        return '<a class="row' + (x.kind === 'end' ? ' fin' : '') + '" href="/f/' + esc(x.id) + '/' + esc(x.stage || 'gate') + '">'
            + '<div class="r-l"><div class="r-meta">' + meta + '<span class="pj">' + esc(x.project) + '</span></div><p class="r-t">' + esc(x.task) + '</p></div>'
            + '<div class="r-side"><span class="usd">' + usd(x.usd) + '</span><span class="ago">' + hm(x.at) + '</span></div></a>';
    }

    function doneBar(m) {
        return '<header class="ab"><a class="bk" href="#/" aria-label="' + t('chat.back') + '">' + ic('back') + '</a><h1>' + t('done.title') + '</h1><span class="sp"></span>' + hostHtml(m) + '</header>';
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

    // What #app holds: pair-scan, pair-error, the session list, the history,
    // or one session's conversation drawn from its phone.json `P`.
    function screen(M, R, now, ui, P) {
        var u = ui || {};
        if (u.mode === 'pair') return pairHtml(u);
        if (u.mode === 'off') return offHtml(u.host);
        var m = M || {};
        var r = R || parseRoute('');
        var at = num(now) ? now : Date.now();
        if (r.view === 'done') return '<div class="pg">' + doneBar(m) + doneHtml(m, at) + '</div>';
        if (r.view === 'chat') return chatHtml(m, r.id, at, u, P);
        return homeHtml(m, at);
    }

    // Voice fills the field and never sends; in a gate card it ticks 自己寫 first.
    function listen(win, btn, boxId, said, ended) {
        var SR = win.SpeechRecognition || win.webkitSpeechRecognition;
        var box = win.document.getElementById(boxId);
        if (!SR || !box) return null;
        var opt = btn.closest && btn.closest('.opt');
        var other = opt ? opt.querySelector('input[value="__other"]') : null;
        if (other) other.checked = true;
        var base = box.value ? box.value.replace(/\s*$/, ' ') : '';
        var failed = false;
        var rec = new SR();
        rec.lang = 'zh-TW';
        rec.interimResults = true;
        rec.continuous = true;
        btn.classList.add('on');
        said(t('mic.on'));
        rec.onresult = function (e) {
            var fin = '';
            var mid = '';
            for (var i = 0; i < e.results.length; i++) {
                if (e.results[i].isFinal) fin += e.results[i][0].transcript; else mid += e.results[i][0].transcript;
            }
            box.value = base + fin + mid;
            box.classList.toggle('interim', Boolean(mid));
            // The page's own input listener keeps the draft and the send button.
            if (win.Event) box.dispatchEvent(new win.Event('input', { bubbles: true }));
        };
        rec.onerror = function (e) {
            failed = true;
            said(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? t('mic.denied') : t('mic.missed'));
        };
        rec.onend = function () {
            btn.classList.remove('on');
            box.classList.remove('interim');
            if (!failed) said(box.value.trim() ? t('mic.done') : '');
            ended();
        };
        rec.start();
        return rec;
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

    // A session's phone.json less its read time, so an unchanged one compares equal.
    function sameKey(p) { return JSON.stringify(Object.assign({}, p, { at: 0 })); }

    function boot(win) {
        var d = win.document;
        var app = d.getElementById('app');
        setLang(pickLang(win));
        if (d.documentElement) d.documentElement.lang = lang === 'en' ? 'en' : 'zh-Hant';
        if (d.body && d.body.insertAdjacentHTML) d.body.insertAdjacentHTML('afterbegin', SPRITE);
        var camera = Boolean(win.BarcodeDetector && win.navigator && win.navigator.mediaDevices && win.navigator.mediaDevices.getUserMedia);
        // The app's own ui lives across pair-error and back, so a draft survives a lost station.
        var APP = { mode: 'app', mic: Boolean(win.SpeechRecognition || win.webkitSpeechRecognition), draft: '', open: {}, note: '' };
        var st = { M: null, P: null, ui: APP, loading: false, chatLoading: false, tried: null, stream: null, rec: null, gone: null };
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
        function rethrow(e) { win.setTimeout(function () { throw e; }); }
        function pairUi(extra) {
            var u = { mode: 'pair', camera: camera, manual: !camera, say: '' };
            for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) u[k] = extra[k];
            return u;
        }
        function offline() { st.ui = { mode: 'off', host: store('station.m.host') }; draw(); }
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
        // The session the chat route names: its phone.json, else its mobile.json row.
        function current() {
            var id = route().id;
            if (st.P && st.P.id === id) return st.P;
            return ((st.M && st.M.tasks) || []).filter(function (x) { return x.id === id; })[0] || null;
        }
        function cv() { return d.querySelector ? d.querySelector('.cv') : null; }
        function toEnd() { var c = cv(); if (c) c.scrollTop = c.scrollHeight; }
        function draw() {
            stopScan();
            if (st.rec) st.rec.stop();
            var R = route();
            app.innerHTML = screen(st.M, R, Date.now(), st.ui, R.view === 'chat' && st.P && st.P.id === R.id ? st.P : null);
            if (st.ui.mode === 'pair') scan();
            if (R.view === 'chat') toEnd();
        }
        // Only the conversation, so the composer keeps its focus, its text and its mic.
        function patch() {
            var c = cv();
            if (!c) return draw();
            var end = c.scrollHeight - c.scrollTop - c.clientHeight < 48;
            c.innerHTML = cvInner(st.P, Date.now(), st.ui);
            if (end) toEnd();
        }
        // A gate card is never redrawn while its gate stands, so what is
        // picked, typed or said stays; a new reply patches only .cv while the
        // state, the attach and the queued message are the same.
        function refresh(before, P) {
            st.P = P;
            if (!before || before.id !== P.id) return draw();
            if (sameKey(before) === sameKey(P)) return;
            if (before.state === 'gate' && P.state === 'gate' && before.gate && P.gate && before.gate.until === P.gate.until) return;
            if (before.state === P.state && before.attached === P.attached && JSON.stringify(before.waiting) === JSON.stringify(P.waiting)) return patch();
            draw();
        }
        function pairWith(code) {
            st.ui = pairUi({ manual: true, say: t('pair.busy') });
            draw();
            post('/station/remote/pair', { code: code, name: deviceName(win.navigator && win.navigator.userAgent) }).then(function (r) {
                if (r.status === 201) {
                    st.ui = APP;
                    win.location.hash = '#/';
                    return load();
                }
                return r.text().then(function (text) { st.ui = pairUi({ manual: true, say: t('pair.refused', { code: r.status, why: String(text || '').trim() }) }); draw(); });
            }, function () { st.ui = pairUi({ manual: true, say: t('pair.failed') }); draw(); });
        }
        // 401 is an unpaired phone; anything else that is not a 2xx, or no
        // whole reply at all, is a station this phone cannot reach. Only the
        // request is judged so: a drawing error is a bug, thrown where the
        // console shows it, never a pair-error screen.
        var UNPAIRED = {};
        var GONE = {};
        function load() {
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
                st.ui = APP;
                if (M && M.host) store('station.m.host', String(M.host));
                if (route().view === 'chat') return loadChat();
                draw();
            }, function () {
                st.loading = false;
                offline();
            }).then(null, rethrow);
        }
        function loadChat() {
            var id = route().id;
            if (!id) return null;
            st.chatLoading = true;
            return win.fetch('/station/phone.json?id=' + encodeURIComponent(id), { credentials: 'same-origin', cache: 'no-store' }).then(function (r) {
                if (r.status === 401) return UNPAIRED;
                if (r.status === 404) return GONE;
                if (!r.ok) throw new Error(String(r.status));
                return r.json();
            }).then(function (P) {
                st.chatLoading = false;
                if (P === UNPAIRED) { st.ui = pairUi({}); return draw(); }
                if (st.ui.mode !== 'app' || route().id !== id) return null;
                // Gone is drawn once: a redraw every read would take the composer's focus.
                if (P === GONE) {
                    if (st.gone === id) return null;
                    st.gone = id;
                    st.P = null;
                    return draw();
                }
                st.gone = null;
                return refresh(st.P && st.P.id === id ? st.P : null, P);
            }, function () {
                st.chatLoading = false;
                offline();
            }).then(null, rethrow);
        }
        // A refusal or a lost station says so under the conversation; the draft stays.
        function act(url, fields, done) {
            st.ui.note = '';
            return post(url, fields).then(function (r) {
                if (r.ok) { if (done) done(); return loadChat(); }
                return r.text().then(function (text) { st.ui.note = t('gate.refused', { code: r.status, why: String(text || '').trim() }); draw(); });
            }, function () { st.ui.note = t('gate.failed'); draw(); });
        }
        // phone.json first: a conversation never reads mobile.json again, so
        // its gates still hold the gate before this one for the same session.
        function gateOf(id) {
            var p = st.P && st.P.id === id && st.P.gate ? st.P : null;
            if (p) return { id: p.id, root: p.root, questions: p.gate.questions };
            return ((st.M && st.M.gates) || []).filter(function (x) { return x.id === id; })[0] || null;
        }
        // 送出答案: a refusal or a network error changes the card's one line
        // and nothing else, so what was picked stays picked.
        function answer(f) {
            var say = f.querySelector('.gc-st');
            var g = gateOf(f.getAttribute('data-id'));
            if (!g) { say.textContent = t('gate.gone'); return; }
            var got = collect(f.querySelectorAll('input,textarea'), (g.questions || []).length);
            var answers = answersOf(g.questions, got.picks, got.others);
            if (!answers) { say.textContent = t('gate.needAll'); return; }
            var btn = f.querySelector('.cta');
            btn.disabled = true;
            say.textContent = t('gate.sending');
            post('/answer', { root: g.root, id: g.id, answers: JSON.stringify(answers) }).then(function (r) {
                if (r.status === 201) { say.textContent = t('gate.sent'); return loadChat(); }
                return r.text().then(function (text) { btn.disabled = false; say.textContent = t('gate.refused', { code: r.status, why: String(text || '').trim() }); });
            }, function () { btn.disabled = false; say.textContent = t('gate.failed'); });
        }
        function say(f) {
            var p = current();
            var box = f.querySelector('textarea');
            var text = String((box && box.value) || '').trim();
            if (!p || !text) return;
            st.ui.draft = text;
            act('/phone/say', { root: p.root, id: p.id, text: text }, function () { st.ui.draft = ''; st.P = null; });
        }
        d.addEventListener('submit', function (e) {
            var f = e.target;
            if (!f || !f.getAttribute) return;
            if (f.id === 'gate-card') { e.preventDefault(); answer(f); return; }
            if (f.id === 'composer') { e.preventDefault(); say(f); return; }
            if (f.getAttribute('data-pair-form') !== null) {
                e.preventDefault();
                var input = f.querySelector('input');
                var code = codeIn(input ? input.value : '');
                if (code) pairWith(code);
                else { st.ui = pairUi({ manual: true, say: t('pair.bad') }); draw(); }
            }
        });
        d.addEventListener('click', function (e) {
            var el = e.target && e.target.closest ? e.target.closest('[data-act],[data-mic]') : null;
            if (!el) return;
            var mic = el.getAttribute('data-mic');
            if (mic) {
                if (st.rec) { st.rec.stop(); return; }
                var wrap = (el.closest && (el.closest('fieldset') || el.closest('form'))) || null;
                var line = wrap ? wrap.querySelector('[data-say]') : null;
                st.rec = listen(win, el, mic, function (text) { if (line) line.textContent = text; }, function () { st.rec = null; });
                return;
            }
            var what = el.getAttribute('data-act');
            var p = current();
            if (what === 'manual') { st.ui = pairUi({ manual: true }); draw(); }
            else if (what === 'retry') load();
            else if (what === 'repair') { st.ui = pairUi({}); draw(); }
            else if (what === 'attach' && p) act('/phone/attach', { root: p.root, id: p.id });
            else if (what === 'detach' && p) act('/phone/detach', { root: p.root, id: p.id });
            else if (what === 'steps') {
                var key = el.getAttribute('data-key');
                st.ui.open[key] = !st.ui.open[key];
                if (st.P) patch(); else draw();
            }
        });
        function grow(el) {
            if (!el.style) return;
            el.style.height = 'auto';
            el.style.height = el.scrollHeight + 'px';
        }
        // Typing in a 自己寫 box ticks its own radio or checkbox; the
        // composer's text is the draft a redraw puts back.
        function typed(e) {
            var el = e.target;
            if (!el || !el.getAttribute) return;
            if (el.id === 'cmp-box') {
                st.ui.draft = el.value;
                var send = d.querySelector ? d.querySelector('#composer .send') : null;
                if (send) send.disabled = !String(el.value || '').trim();
                grow(el);
                return;
            }
            if (el.getAttribute('data-own') === null) return;
            var box = el.closest ? el.closest('label') : null;
            var pick = box ? box.querySelector('input[value="__other"]') : null;
            if (pick) pick.checked = true;
            if (e.type === 'input') grow(el);
        }
        d.addEventListener('input', typed);
        d.addEventListener('focusin', typed);
        function poll(view) {
            if (d.visibilityState !== 'visible' || st.ui.mode !== 'app') return;
            var chat = route().view === 'chat';
            if (view === 'chat' && chat && !st.chatLoading) loadChat();
            else if (view === 'home' && !chat && !st.loading) load();
        }
        d.addEventListener('visibilitychange', function () {
            if (d.visibilityState !== 'visible' || st.ui.mode !== 'app') return;
            if (route().view === 'chat') loadChat(); else load();
        });
        win.addEventListener('hashchange', function () {
            st.ui.note = '';
            draw();
            if (st.ui.mode !== 'app') return;
            // The list drawn before a conversation is stale by now: read it again.
            if (route().view === 'chat') loadChat(); else load();
        });
        win.setInterval(function () { poll('home'); }, POLL_MS);
        win.setInterval(function () { poll('chat'); }, CHAT_MS);
        if (win.navigator && win.navigator.serviceWorker) win.navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function () { /* the page works without it */ });
        load();
    }

    var api = {
        parseRoute: parseRoute, screen: screen, answersOf: answersOf, collect: collect, codeIn: codeIn, setLang: setLang, STR: STR,
        turnsOf: turnsOf, stepsLine: stepsLine, dur: dur, SCREEN: SCREEN,
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_M = api;
    if (w && w.document && w.document.getElementById && w.document.getElementById('app')) boot(w);
}(typeof window !== 'undefined' ? window : null));
