// 調整浮窗與待答關卡 (FK_FLOAT): moved out of station.js (station-52).
// station.js calls make(K) once, on first use, handing it the helpers these
// bodies name; everything here only computes or builds strings.
(function (w) {
    'use strict';
    function make(K) {
        // One alias per name K carries, so the bodies below moved verbatim.
        var loc = K.loc, esc = K.esc, dur = K.dur, w = K.w;

        // ---- tune: a block changed ----------------------------------------------
        // One project's queue can sit on several sessions' rows; an id is one
        // request per project and id (queue ids repeat across projects). `tuneEvents` is every request that was in
        // progress on the last read and has settled on this one — a request first
        // seen settled is not news.
        function tuneItems(sessions) {
            var out = {};
            (sessions || []).forEach(function (s) {
                ((s.tune && s.tune.items) || []).forEach(function (it) { out[s.pkey + '|' + it.id] = it; });
            });
            return out;
        }
        function tuneOpen(sessions) {
            return (sessions || []).some(function (s) { return s.tune && s.tune.open > 0; });
        }
        function tuneEvents(prev, next) {
            var was = tuneItems(prev), now = tuneItems(next), out = [];
            Object.keys(now).forEach(function (key) {
                var a = was[key], b = now[key];
                if (a && (a.status === 'queued' || a.status === 'taken') && (b.status === 'done' || b.status === 'rejected')) {
                    out.push({ id: key, block: b.block, status: b.status });
                }
            });
            return out;
        }
        function toastText(ev) {
            return (ev.status === 'done' ? loc('tune.doneColon', '已修改完成：') : loc('tune.notChangedColon', '沒有修改：')) + ev.block;
        }
        // The one place notifications and held gates appear (2026-09-26 design
        // §3): a button in the corner with the count, a panel with the gates
        // first. `notes` are the page's own — settled tune requests, newest first
        // — and what tune is editing right now is read off each session's queue.
        function floatNotes(sessions, notes, gone) {
            var editing = [];
            (sessions || []).forEach(function (s) {
                ((s.tune && s.tune.items) || []).forEach(function (it) {
                    var key = s.pkey + '|' + it.id;
                    if (it.status === 'taken' && !(gone && gone[key])) editing.push({ id: key, block: it.block, status: 'edit' });
                });
            });
            return editing.concat(notes || []);
        }
        // The panel's bookkeeping, pure so a test can drive it (station-50). A note
        // is read once the reader has had the panel open; a read note stays,
        // greyed, and stops counting on the bell. `gone` holds the ids of editing
        // rows the reader dismissed with ×: those rows come off the sessions'
        // queues, not off `notes`, so they are remembered by project and id (queue ids repeat across projects).
        var GONE_KEEP = 100;
        function readAll(notes) {
            return (notes || []).map(function (x) { return x.read ? x : Object.assign({}, x, { read: true }); });
        }
        function dismissNote(notes, gone, id) {
            var all = notes || [], kept = all.filter(function (x) { return x.id !== id; }), g = Object.assign({}, gone);
            if (kept.length === all.length) g[id] = true;
            return { notes: kept, gone: g };
        }
        function clearNotes(sessions, notes, gone) {
            var g = Object.assign({}, gone);
            floatNotes(sessions, [], gone).forEach(function (x) { g[x.id] = true; });
            return { notes: [], gone: g };
        }
        function goneKeys(gone) { return Object.keys(gone || {}).slice(-GONE_KEEP); }
        function goneParse(raw) {
            var a, out = {};
            try { a = JSON.parse(raw); } catch (e) { return out; }
            if (Array.isArray(a)) a.slice(-GONE_KEEP).forEach(function (id) { if (typeof id === 'string') out[id] = true; });
            return out;
        }
        function noteHtml(n) {
            var t = n.status === 'edit' ? ['edit', '<i></i>', loc('tune.editingColon', '編輯中：'), loc('tune.editingHint', 'tune 正在改這個 block，頁面上有外框標出它。')]
                : n.status === 'done' ? ['done', '✓', loc('tune.doneColon', '已修改完成：'), loc('tune.doneHint', '改過的頁面由 tune 自己重新載入。')]
                    : ['rej', '✕', loc('tune.notChangedColon', '沒有修改：'), loc('tune.rejectedHint', '要求超出這個 block，已退回。')];
            return '<div class="nt ' + t[0] + (n.read ? ' read' : '') + '" data-note="' + esc(n.id) + '"><span class="ti" aria-hidden="true">' + t[1] + '</span>'
                + '<span class="tt">' + t[2] + '<code>' + esc(n.block) + '</code></span>'
                + '<button class="tx" type="button" data-note-x aria-label="' + loc('tune.close', '關閉') + '">×</button>'
                + '<span class="tb">' + t[3] + '</span></div>';
        }
        // Exported as `clock`; the page's own `clock(ms)` is the hh:mm one.
        function gateClock(sec) { return Math.floor(sec / 60) + ':' + (sec % 60 < 10 ? '0' : '') + (sec % 60); }
        function micOk() { return Boolean(w && (w.SpeechRecognition || w.webkitSpeechRecognition)); }
        var MIC_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'
            + '<path d="M12 19v3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><rect x="9" y="2" width="6" height="13" rx="3"/></svg>';
        // The free answer under a single-choice held gate's buttons: the text is the answer, sent through
        // the same /answer POST. `lock` is ' disabled' while a send is out or after it landed.
        function gateFreeHtml(s, picked, lock) {
            var id = 'gfree-' + s.id, draft = String((picked || {})[s.id + ':free'] || '');
            return '<div class="gfree" data-block="gate-free"><label for="' + esc(id) + '">' + loc('tune.freeLabel', '或自己寫答案') + '</label>'
                + '<div class="gfrow"><textarea id="' + esc(id) + '" data-gfree="' + esc(s.id) + '" rows="2" placeholder="' + loc('tune.freePlaceholder', '上面都不對的話，寫下你要的答案') + '">' + esc(draft) + '</textarea>'
                + (micOk() ? '<button type="button" class="gmic" data-mic="' + esc(id) + '" aria-pressed="false" aria-label="' + loc('tune.micLabel', '用講的寫答案') + '" title="' + loc('tune.micLabel', '用講的寫答案') + '">' + MIC_SVG + '</button>' : '')
                + '</div>' + (micOk() ? '<p class="gsay" role="status">' + loc('tune.micHint', '想用講的：按麥克風，講完可以改字再送出') + '</p>' : '')
                + '<button type="button" class="gfs" data-gfs' + (draft.trim() && !lock ? '' : ' disabled') + '>' + loc('tune.freeSend', '送出答案') + '</button></div>';
        }
        // A held gate of one single-choice question is answered by its options as
        // buttons; any other shape keeps the full form, `pendingGateHtml`. The
        // countdown runs from the hook's own `at` to `until`.
        function gateCountdownHtml(s, now, picked) {
            var p = s.pending, q = p.questions[0];
            var total = Math.max(1, Math.round((p.until - (typeof p.at === 'number' && isFinite(p.at) ? p.at : p.until - 60000)) / 1000));
            var left = Math.max(0, Math.min(total, Math.round((p.until - now) / 1000)));
            var sent = (picked || {})[s.id + ':send'];
            if (sent && sent.gate !== p.until) sent = null;
            var lock = sent && (sent.busy || sent.cls === 'ok') ? ' disabled' : '';
            var body = p.questions.length === 1 && !q.multiSelect && K.S().serve
                ? '<p class="gq"><small>' + esc(q.header || '') + '</small>' + esc(q.question) + '</p><div class="gops" role="group" aria-label="' + loc('tune.answer', '回答') + '">'
                    + (q.options || []).map(function (o, i) {
                        return '<button type="button" class="gop" data-gop="' + i + '"' + lock + '><b>' + esc(o.label) + '</b><small>' + esc(o.description || '')
                            + '</small><kbd>' + (i + 1) + '</kbd></button>';
                    }).join('') + gateFreeHtml(s, picked, lock) + '</div>'
                : pendingGateHtml(s, picked);
            return '<div class="gc" data-block="gate-countdown" data-pg-root="' + esc(s.root) + '" data-pg-id="' + esc(s.id) + '" data-until="' + p.until
                + '" data-total="' + total + '"><div class="gsrc"><span class="mono">' + esc(s.project || '') + '</span><i aria-hidden="true"></i><span class="mono">'
                + esc(s.stage || '') + '</span><span class="t">' + esc(s.task || '') + '</span></div>' + body
                + '<div class="gtm"><div class="gbar" aria-hidden="true"><i style="width:' + (left / total * 100).toFixed(1) + '%"></i></div>'
                + '<span class="gsec">' + gateClock(left) + '</span><small>' + loc('tune.timeUpAsksTerminal', '時間到，問題回到 terminal 問') + '</small></div>'
                + (K.S().serve ? '<button type="button" class="gho" data-gho' + lock + '>' + loc('tune.handToTerminalPhone', '交給終端／手機') + '</button>'
                    + '<p class="ghs">' + loc('tune.handOffHint', '網頁不再等，問題馬上在 terminal 問；Remote Control 在手機上也看得到。') + '</p>' : '')
                + '<p class="gend' + (sent && sent.cls ? ' ' + sent.cls : '') + '" role="status" aria-live="polite">' + (sent ? esc(sent.text) : '') + '</p></div>';
        }
        var FK_BELL = '<svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'
            + '<path d="M5 8a5 5 0 0 1 10 0v4l1.5 2.5h-13L5 12z"/><path d="M8.2 16.5a2 2 0 0 0 3.6 0"/></svg>';
        // The gate panel's own size once resized: {w, h} in px, kept in localStorage
        // as `station.fkBox`. Its place is the bell's, so a saved {x, y, w, h} from
        // before the bell moved into the masthead reads as its w and h alone.
        // Never smaller than 260 by 160, never taller than the window less the 82px
        // the keel .fkp max-height leaves (station.css), or the kept size renders capped.
        var FK_MIN_W = 260, FK_MIN_H = 160;
        function fkBoxParse(raw) {
            var b;
            try { b = JSON.parse(raw); } catch (e) { return null; }
            if (!b || ['w', 'h'].some(function (k) { return typeof b[k] !== 'number' || !isFinite(b[k]); })) return null;
            return { w: b.w, h: b.h };
        }
        function fkBoxClamp(b, vw, vh) {
            if (!b) return null;
            return { w: Math.max(FK_MIN_W, Math.min(b.w, vw - 64)), h: Math.max(FK_MIN_H, Math.min(b.h, vh - 82)) };
        }
        function fkBoxStyle(b) {
            return b ? ' style="width:' + Math.round(b.w) + 'px;height:' + Math.round(b.h) + 'px"' : '';
        }
        function floatHtml(sessions, notes, open, now, picked, permission, box, gone) {
            var held = (sessions || []).filter(function (s) { return s.pending && s.pending.questions && s.pending.questions.length; });
            var all = floatNotes(sessions, notes, gone), n = held.length + all.length, tune = null, done = 0;
            var lit = held.length + all.filter(function (x) { return !x.read; }).length;
            (sessions || []).forEach(function (s) {
                if (!s.tune) return;
                done += s.tune.done;
                if (!tune && s.tune.url) tune = s.tune;
            });
            var shown = Boolean(open || (held.length && !(picked && picked['fk:shut'])));
            return '<section class="fkp" id="fkp" aria-label="' + loc('tune.notificationsAndGate', '通知與 gate') + '"' + (shown ? '' : ' hidden') + fkBoxStyle(box) + '>'
                + '<div class="fkg" aria-hidden="true" data-fkg><i></i></div>'
                + '<div class="fkh"><b>' + loc('tune.notificationsAndGate', '通知與 gate') + '</b><span class="n">' + loc('tune.nItems', '{n} 件', { n: n }) + '</span><span class="spacer"></span>'
                + (all.length ? '<button class="lk" type="button" data-note-clear>' + loc('tune.clearNotifications', '清掉通知') + '</button>' : '')
                + '<button type="button" class="fkx" data-fkx aria-label="' + loc('tune.closePanel', '關閉通知與 gate') + '"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button></div>'
                + (held.length ? '<div class="fks">' + loc('tune.waitingOnYou', '等你回答') + ' <b>' + held.length + '</b></div>'
                    + held.map(function (s) { return gateCountdownHtml(s, now, picked); }).join('') : '')
                + '<div class="fks">' + loc('tune.notifications', '通知') + ' <b>' + all.length + '</b></div>' + all.map(noteHtml).join('')
                + (all.length ? '' : '<p class="fkempty">' + loc('tune.noNewNotifications', '沒有新通知。') + '</p>')
                + '<div class="fkf"><span>' + loc('tune.tuneDone', 'tune 完成') + ' <b>' + done + '</b></span>'
                + (tune ? '<a href="' + esc(tune.url) + '" target="_blank" rel="noopener">' + esc(tune.url.replace(/^https?:\/\//, '').replace(/\/$/, '')) + '</a>' : '')
                + '<span class="spacer"></span>'
                + (permission === 'default' ? '<button type="button" class="btn" data-tune-notify>' + loc('tune.notifyInBackground', '背景時通知我') + '</button>' : '') + '</div><span class="fkr" data-fk-resize aria-hidden="true"></span></section>'
                + '<button type="button" class="fkb" data-fkb aria-expanded="' + shown + '" aria-controls="fkp" aria-label="' + loc('tune.notificationsAndGateNItems', '通知與 gate：{n} 件', { n: lit })
                + (held.length ? loc('tune.nGatesWaiting', '，{n} 個 gate 在等', { n: held.length }) : '') + '">' + FK_BELL + '<span class="fkn">' + (lit ? lit : '') + '</span></button>';
        }

        // What 送出答案 sends, and how many questions have no answer yet. Typed
        // 其他 text is the answer on a single-choice question and one more pick on a
        // multi-select one; the `__other` box itself is never an answer.
        function pgAnswers(questions, picks, others) {
            var answers = {}, missing = 0;
            (questions || []).forEach(function (q, i) {
                var labels = ((picks || {})[i] || []).filter(function (l) { return l !== '__other'; });
                var text = String((others || {})[i] || '').trim();
                var a = q.multiSelect ? labels.concat(text ? [text] : []).join(', ') : (text || labels[0] || '');
                if (a) answers[q.question] = a;
                else missing++;
            });
            return { answers: answers, missing: missing };
        }

        // A gate hooks/gate.js is holding for this page (`gate.station`): the
        // questions, and under `serve` a form whose answer goes to `/answer`.
        // `picked` is what was ticked before the last re-read, keyed `<id>:<n>`,
        // so the three-second poll does not clear a half-answered form.
        function pendingGateHtml(s, picked) {
            var p = s && s.pending;
            if (!p || !p.questions || !p.questions.length) return '';
            var on = picked || {};
            var left = Math.max(0, Math.round((p.until - (K.S().serve ? Date.now() : K.NOW())) / 1000));
            var picks = {}, others = {};
            p.questions.forEach(function (q, i) { picks[i] = on[s.id + ':' + i] || []; others[i] = on[s.id + ':' + i + ':other'] || ''; });
            var got = pgAnswers(p.questions, picks, others), n = p.questions.length;
            var dis = K.S().serve ? '' : ' disabled';
            var sent = on[s.id + ':send'];
            if (sent && sent.gate !== p.until) sent = null;
            var lock = sent && (sent.busy || sent.cls === 'ok');
            var qs = p.questions.map(function (q, i) {
                var type = q.multiSelect ? 'checkbox' : 'radio', had = picks[i];
                return '<fieldset class="pgq"><legend>' + esc(q.header || '') + ' · ' + esc(q.question)
                    + (q.multiSelect ? '<span class="multi">' + loc('tune.multiSelect', '可多選') + '</span>' : '') + '</legend><div class="opts2">'
                    + (q.options || []).map(function (o) {
                        return '<label class="pgo o"><input type="' + type + '" name="pg-' + i + '" value="' + esc(o.label) + '"'
                            + (had.indexOf(o.label) >= 0 ? ' checked' : '') + dis + '> <b>' + esc(o.label) + '</b> <small>'
                            + esc(o.description || '') + '</small></label>';
                    }).join('')
                    + '<label class="pgo o other"><input type="' + type + '" name="pg-' + i + '" value="__other"'
                    + (had.indexOf('__other') >= 0 ? ' checked' : '') + dis + '> <b>' + loc('tune.other', '其他') + '</b><input type="text" class="pgt" data-pg-other="' + i
                    + '" value="' + esc(others[i]) + '" placeholder="' + loc('tune.writeYourOwn', '自己寫…') + '" aria-label="' + esc(q.header || q.question) + loc('tune.colonOther', '：其他') + '"' + dis + '></label>'
                    + '</div></fieldset>';
            }).join('');
            return '<div class="pg gp" data-block="pending-gate" data-pg-root="' + esc(s.root) + '" data-pg-id="' + esc(s.id) + '">'
                + '<div class="h2">' + loc('tune.pendingGate', '懸著的 gate') + ' <small>' + loc('tune.terminalWaiting', 'terminal 還等 {t}，逾時就回 terminal 問', { t: dur(left) }) + '</small></div>' + qs
                + (K.S().serve ? '<div class="act gpf"><span class="cnt">' + loc('tune.answeredNOfM', '已答 <b class="pgn">{a} / {n}</b>', { a: n - got.missing, n: n }) + '</span>'
                    + '<span class="why">' + loc('tune.everyQuestionNeedsAnswer', '每題都要有答案') + '</span><span class="spacer"></span>'
                    + '<button type="button" class="go" data-answer' + (got.missing || lock ? ' disabled' : '') + '>' + loc('tune.submitAnswer', '送出答案') + '</button></div>'
                    + '<div class="pgr' + (sent && sent.cls ? ' ' + sent.cls : '') + '" role="status" aria-live="polite">' + (sent ? esc(sent.text) : '') + '</div>'
                    : '<p class="tally">' + loc('tune.staticCannotAnswer', '靜態頁不能作答：開 serve 的頁面，或回 terminal 答。') + '</p>') + '</div>';
        }

        // Which of the page's top-level blocks a redraw has to replace: the
        // indices whose markup changed, or null when the list changed shape and
        // the page is drawn whole. `was` is what the last draw wrote, not what the
        // DOM holds now — a <details> the reader opened is the reader's.
        function changedParts(was, now) {
            if (!was || !now || was.length !== now.length) return null;
            var out = [];
            for (var i = 0; i < now.length; i++) if (was[i] !== now[i]) out.push(i);
            return out;
        }

        // The main session's effort, when its transcript said; nothing otherwise.
        function effortChip(effort) {
            return effort ? '<span class="chip" title="' + loc('tune.effortHint', '主 session 最後一次請求的 effort') + '">effort <span class="mono">' + esc(effort) + '</span></span>' : '';
        }

        // The hero's eyebrow carries the frozen moment too, so a reader who has
        // scrolled past the bar is not reading numbers they take for live. The
        // hh:mm is the caller's, off the same `stamp()` the bar's absolute time
        // comes from: two places on the page, one clock read.
        function heroEyebrow(frozenAt) {
            return frozenAt ? loc('tune.last30dFrozenAt', '近 30 天 · 凍結於 {t}', { t: frozenAt }) : loc('tune.last30d', '近 30 天');
        }

        // ---- the project page, again: its board link ------------------------------
        // The project card's line to its architecture board. Only a served page
        // has the `/chartroom/` route (a file:// copy has none), and only a registry
        // with `.fankeel/architecture.board` has a board (`board`, lib/station.js);
        // the station draws it itself (lib/board.js `boardPage`). The url segment
        // is the root's folder name, the one scripts/station.js matches; the
        // trailing slash keeps the page's `board.svg` under its own prefix.
        function boardLinkHtml(p, serve) {
            if (!serve || !p || !p.board) return '';
            var name = String(p.root).split(/[\\/]/).filter(Boolean).pop() || '';
            var href = '/chartroom/' + encodeURIComponent(name) + '/';
            return '<p class="mute" style="margin:4px 0 0">' + loc('proj.boardColon', '架構白板：')
                + '<a href="' + esc(href) + '" target="_blank" rel="noopener">' + loc('proj.boardOpen', '開啟') + '</a></p>';
        }
        return {
            tuneItems: tuneItems, tuneOpen: tuneOpen, tuneEvents: tuneEvents, toastText: toastText, floatNotes: floatNotes,
            readAll: readAll, dismissNote: dismissNote, clearNotes: clearNotes, goneKeys: goneKeys, goneParse: goneParse,
            noteHtml: noteHtml, gateClock: gateClock, micOk: micOk, gateFreeHtml: gateFreeHtml, gateCountdownHtml: gateCountdownHtml,
            fkBoxParse: fkBoxParse, fkBoxClamp: fkBoxClamp, fkBoxStyle: fkBoxStyle, floatHtml: floatHtml, pgAnswers: pgAnswers,
            pendingGateHtml: pendingGateHtml, changedParts: changedParts, effortChip: effortChip, heroEyebrow: heroEyebrow, boardLinkHtml: boardLinkHtml
        };
    }
    var api = { make: make };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_FLOAT = api;
}(typeof window !== 'undefined' ? window : null));
