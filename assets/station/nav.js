// 左欄與舊 live 視圖 (FK_NAV): moved out of station.js (station-52). The old
// live widgets are dead at runtime and wait for station-63 to delete them.
// station.js calls make(K) once, on first use, handing it the helpers these
// bodies name; everything here only computes or builds strings.
(function (w) {
    'use strict';
    function make(K) {
        // One alias per name K carries, so the bodies below moved verbatim; the
        // station.js vars that are assigned later (S, NOW) are read as K.<name>().
        var loc = K.loc, esc = K.esc, w = K.w, NAV_TREE = K.NAV_TREE, focusHref = K.focusHref, family = K.family, mins = K.mins,
            clock = K.clock, modelKey = K.modelKey, modelLabel = K.modelLabel, keelProgress = K.keelProgress, keelStage = K.keelStage,
            sessionHash = K.sessionHash, projectHash = K.projectHash, ago = K.ago, statePill = K.statePill, msOf = K.msOf,
            clearStaleControl = K.clearStaleControl, clearControl = K.clearControl, labels = K.labels;
        // What 最近 sessions lists: anything that spent inside the window, and
        // anything still live whether or not it has spent yet. Newest first.
        function recentRows(sessions, days) {
            var inside = {};
            days.forEach(function (d) { inside[d] = true; });
            return sessions.filter(function (s) {
                return s.state === 'live' || (s.days || []).some(function (r) { return inside[r.day]; });
            }).sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); });
        }
        // The bar's one count: the sessions waiting on you, on 現在.
        function navCounts(sessions) {
            return { waiting: sessions.filter(function (s) { return s.state === 'live' && s.pending && s.pending.questions && s.pending.questions.length; }).length };
        }
        // One line icon per page, 16px on a 1.5px stroke in currentColor: the left
        // bar and each page's own header draw the same one, so a page is known by
        // its shape wherever it is named. Decoration only, hidden from readers.
        var ICONS = {
            now: '<circle cx="8" cy="8" r="1.5"/><path d="M5.2 5.2a4 4 0 0 0 0 5.6M10.8 5.2a4 4 0 0 1 0 5.6M3 3a7 7 0 0 0 0 10M13 3a7 7 0 0 1 0 10"/>',
            days: '<path d="M2 13.5h12M4 11V7.5M7 11V3.5M10 11V6M13 11V8.5"/>',
            sessions: '<circle cx="8" cy="8" r="6"/><path d="M8 4.8V8l2.2 1.5"/>',
            projects: '<path d="M2 4.5a1 1 0 0 1 1-1h3.3L8 5h5a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z"/>',
            docs: '<path d="M4 1.8h5l3.2 3.2v9.2H4z"/><path d="M8.8 1.8v3.4h3.4M6 8.3h4.2M6 11h4.2"/>',
            settings: '<path d="M2.5 4h6M11.5 4h2M2.5 8h2M7.5 8h6M2.5 12h7M12.5 12h1"/><circle cx="10" cy="4" r="1.5"/><circle cx="6" cy="8" r="1.5"/><circle cx="11" cy="12" r="1.5"/>',
            list: '<rect x="2" y="2.8" width="12" height="10.4" rx="1.2"/><path d="M2 6.3h12M2 9.8h12M6 2.8v10.4"/>',
            cmp: '<rect x="2" y="2.5" width="5" height="11" rx="1"/><rect x="9" y="2.5" width="5" height="11" rx="1"/><path d="M4.5 9.5v1.5M11.5 6.5V11"/>',
            spend: '<circle cx="8" cy="8" r="6"/><path d="M10 5.8c-.4-.6-1.1-.9-2-.9-1.2 0-2 .6-2 1.5 0 2 4 1.1 4 3.1 0 .9-.9 1.6-2 1.6-.9 0-1.7-.4-2.1-1M8 3.6v1.3M8 11.1v1.3"/>',
            chev: '<path d="M4.5 6.2 8 9.8l3.5-3.6"/>',
            sun: '<circle cx="8" cy="8" r="2.8"/><path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1"/>',
            moon: '<path d="M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8a5.6 5.6 0 1 0 6.8 6.8z"/>',
            auto: '<circle cx="8" cy="8" r="6"/><path d="M8 2v12a6 6 0 0 0 0-12z" fill="currentColor"/>',
            gate: '<path d="M8 1.8 13.5 4v4c0 3-2.4 5.3-5.5 6.2C4.9 13.3 2.5 11 2.5 8V4z"/><path d="M8 5.2v3.3M8 10.8v.01"/>',
            check: '<path d="M3.5 8.5 6.5 11.5 12.5 5"/>',
        };
        // Glyphs drawn on Lucide's 24 grid; `.sidenav .ico.g24` in station.css
        // keeps their stroke at the bar's 1.5-on-16 weight.
        var ICONS24 = {
            tour: '<circle cx="12" cy="12" r="10"/><path d="m10 8 6 4-6 4Z"/>',
            files: '<path d="M20 7h-3a2 2 0 0 1-2-2V2"/><path d="M9 18a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h7l4 4v10a2 2 0 0 1-2 2Z"/><path d="M3 7.6v12.8A1.6 1.6 0 0 0 4.6 22h9.8"/>',
            barh: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M7 16h8"/><path d="M7 11h12"/><path d="M7 6h3"/>',
            barv: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
            pie: '<path d="M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z"/><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>',
            timer: '<line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/>',
            commit: '<circle cx="12" cy="12" r="3"/><line x1="3" x2="9" y1="12" y2="12"/><line x1="15" x2="21" y1="12" y2="12"/>',
            bot: '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>',
            close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
            calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
        };
        function icon(name) {
            if (ICONS24[name]) {
                return '<svg class="ico g24" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor"'
                    + ' stroke-linecap="round" stroke-linejoin="round">' + ICONS24[name] + '</svg>';
            }
            return ICONS[name] ? '<svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor"'
                + ' stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + ICONS[name] + '</svg>' : '';
        }
        // A detail page lights the page it was opened from.
        function navOn(active) { return active === 'project' ? 'projects' : active === 'session' ? 'sessions' : active; }
        function navGroup(v) {
            return NAV_TREE.filter(function (g) { return (g.kids || []).some(function (k) { return k[0] === v; }); })[0] || null;
        }
        // The bar entry a view lights: the page itself, or the one whose filters hold it.
        function navTop(v) {
            return NAV_TREE.filter(function (g) { return g.v === v || (g.kids || []).some(function (k) { return k[0] === v; }); })[0] || null;
        }
        // The three theme states the button in the masthead cycles
        // through: [state, icon, what it says, the state a click moves to].
        var THEMES = { system: ['auto', loc('nav.themeSystem', '跟隨系統'), 'light'], light: ['sun', loc('nav.themeLight', '淺色'), 'dark'], dark: ['moon', loc('nav.themeDark', '深色'), 'system'] };
        // The theme button, in the masthead's `#appear` since the 2026-10-01
        // layout (r-0034): one press steps 跟隨系統 → 淺色 → 深色; its icon and
        // title name the theme now and the next one.
        function themeBtnHtml(theme) {
            var t = THEMES[THEMES[theme] ? theme : 'system'];
            return '<button type="button" class="themebtn" data-themecycle="' + t[2] + '"'
                + ' title="' + loc('nav.themeTitle', '主題：{cur}（按一下換{next}）', { cur: t[1], next: THEMES[t[2]][1] }) + '" aria-label="' + loc('nav.themeAriaLabel', '主題：{cur}，按一下換{next}', { cur: t[1], next: THEMES[t[2]][1] }) + '">'
                + icon(t[0]) + '</button>';
        }
        // The bar: the jump box, then `#navlinks`, which `drawNav` alone redraws.
        function navHtml(active, c) {
            return '<nav class="sidenav hm-flat" data-block="nav" aria-label="' + loc('nav.functions', '功能') + '"><div class="navbox">' + jumpHtml()
                + '<div id="navlinks">' + navLinksHtml(active, c) + '</div>'
                + (/[?&]full=1(&|$)/.test(String((w.location && w.location.search) || '')) ? '<a class="navback" href="/m">' + loc('nav.toPhone', '回手機版') + '</a>' : '') + '</div></nav>';
        }
        function navLinksHtml(active, c) {
            var on = navTop(navOn(active)), n = c && c.waiting;
            var item = function (g) {
                var b = g.v === 'now' && n ? '<span class="nb wait" title="' + esc(loc('nav.nWaiting', '{n} 個 session 在等你回答', { n: n })) + '">' + n + '</span>' : '';
                return '<li class="navcat"' + (g.block ? ' data-block="' + g.block + '"' : '') + '><a href="' + g.href + '"' + (on === g ? ' aria-current="page"' : '')
                    + (g.title ? ' title="' + esc(g.title) + '"' : '') + '>' + icon(g.ico) + '<span>' + g.label + '</span>' + b + '</a></li>';
            };
            return '<ul class="navmain">' + NAV_TREE.filter(function (g) { return !g.pin; }).map(item).join('') + '</ul>'
                + '<ul class="navpin">' + NAV_TREE.filter(function (g) { return g.pin; }).map(item).join('') + '</ul>';
        }
        // The jump box (mockup block jump): a session by task text, project or id
        // prefix, straight to its focus page (`focusHref`). Live sessions first.
        function jumpHtml() {
            return '<div class="jump" data-block="jump"><label class="hm-sr" for="jq">' + loc('nav.jumpLabel', '跳到 session：輸入任務文字或 id') + '</label>'
                + '<div class="jump-box"><input id="jq" autocomplete="off" placeholder="' + esc(loc('nav.jumpPlaceholder', '跳到 session…')) + '" role="combobox"'
                + ' aria-autocomplete="list" aria-controls="jpop" aria-expanded="false"><kbd>Ctrl K</kbd></div>'
                + '<div class="jpop" id="jpop" role="listbox" aria-label="' + esc(loc('nav.jumpMatches', '符合的 session')) + '" hidden></div></div>';
        }
        function jumpHits(sessions, q, nameOf, max) {
            var v = String(q || '').trim().toLowerCase();
            if (!v) return [];
            return (sessions || []).filter(function (s) {
                return String(s.id || '').toLowerCase().indexOf(v) === 0 || String(s.task || '').toLowerCase().indexOf(v) >= 0
                    || String(nameOf(s) || '').toLowerCase().indexOf(v) >= 0;
            }).sort(function (a, b) {
                return (b.state === 'live' ? 1 : 0) - (a.state === 'live' ? 1 : 0) || (b.updated || 0) - (a.updated || 0);
            }).slice(0, max || 8);
        }
        function jumpListHtml(hits, q, on, serve, nameOf) {
            var v = String(q || '').trim().toLowerCase();
            if (!hits.length) return '<p class="jnone">' + loc('nav.jumpNone', '沒有符合的 session。試試任務裡的一個詞，或 id 的前幾碼。') + '</p>';
            return hits.map(function (s, i) {
                var id8 = String(s.id).slice(0, 8), byId = String(s.id).toLowerCase().indexOf(v) === 0;
                var idm = byId ? '<mark>' + esc(id8.slice(0, v.length)) + '</mark>' + esc(id8.slice(v.length)) : esc(id8);
                return '<a class="hm-jr' + (i === on ? ' on' : '') + '" role="option" aria-selected="' + (i === on) + '" href="' + esc(focusHref(s.id, s.stage, serve)) + '">'
                    + '<span class="hm-jr-t">' + esc(s.task || loc('nav.unnamed', '（未命名）')) + '</span><span class="hm-jr-m">' + esc(nameOf(s)) + ' · ' + idm + '</span>'
                    + '<span class="hm-stw" style="--c:var(--st-' + esc(s.stage || '') + ')">' + esc(s.stage || '—') + '</span></a>';
            }).join('') + '<p class="jfoot">' + loc('nav.jumpFoot', '<kbd>↑↓</kbd> 選 · <kbd>Enter</kbd> 打開這個 session 的現在這一站') + '</p>';
        }
        // A page's filters (Sessions: 進行中 / 最近 / 全部清單 / 比較; 花費:
        // 近 30 天 / 依專案): its `kids`, the current one marked. Each keeps its
        // own hash, so an old link lands on its filter. Empty for a page with one.
        function subtabsHtml(active) {
            var g = navGroup(active);
            if (!g || g.kids.length < 2) return '';
            return '<nav class="subtabs" data-block="page-filter" aria-label="' + esc(g.label) + '">' + g.kids.map(function (k) {
                return '<a href="' + k[1] + '"' + (k[0] === active ? ' aria-current="page"' : '') + '>' + k[2] + '</a>';
            }).join('') + '</nav>';
        }
        // 現在 (進行中, `#/live`), four blocks top to bottom: the gates waiting on
        // the user, the sessions confirmed running, the ones the registry still
        // marks in progress but whose process could not be confirmed (`live?`) or
        // is gone (`stale`), and one line of chips for every registry with neither.
        // A session that is down has finished and is on 最近 sessions instead.
        // `tabs` is the Sessions tab strip. Each block writes its `data-block`
        // literally, so the tune proxy can find it in this file.
        //
        // The route as a line of stops for one lane: every stop before the current
        // one filled and titled with its time on the registry's clock, the current
        // one ringed — pulsing only while `live` is measured — with its time so
        // far, the rest hollow. A stage the route does not name is drawn as the
        // only stop, so a lane always shows where it is.
        function liveRail(s, live, now) {
            var route = (s.route || []).slice(), at = route.indexOf(s.stage);
            if (at < 0) { route = [s.stage || '—']; at = 0; }
            var win = {};
            (s.stages || []).forEach(function (w) { win[w.stage] = w; });
            var took = function (k, open) {
                var w = win[k], m = w && isFinite(w.from) ? mins((open ? now : w.to) - w.from) : '—';
                return m === '—' ? '' : m;
            };
            return '<ol class="lrail" aria-label="route ' + esc(route.join(' → ')) + esc(loc('nav.liveRailAt', '；{now}{stage}，第 {n} 站，共 {total} 站',
                { now: live ? loc('nav.liveRailNowAt', '現在在 ') : loc('nav.liveRailStoppedAt', '停在 '), stage: route[at], n: at + 1, total: route.length }))
                + '">' + route.map(function (k, i) {
                    var c = ' style="--c:var(--st-' + esc(k) + ')"', t;
                    if (i < at) {
                        t = took(k, false);
                        return '<li class="done"' + c + (t ? ' title="' + esc(k) + ' ' + t + '"' : '') + '><i></i><span>' + esc(k) + '</span></li>';
                    }
                    if (i === at) {
                        t = took(k, live);
                        return '<li class="now' + (live ? ' live' : '') + '"' + c + ' aria-current="step"><i></i><span>' + esc(k) + '</span>'
                            + (t ? '<em>' + t + '</em>' : '') + '</li>';
                    }
                    return '<li class="todo"><i></i><span>' + esc(k) + '</span></li>';
                }).join('') + '</ol>';
        }
        // What is running for one live session now: the stage agent in flight
        // (`inflight`, while it names the current stage) and every subagent
        // `runningAgents` in lib/usage.js reads as mid-turn. The stage agent has a
        // meta.json too, so its id is left out of the subagent rows.
        function saFamily(a, s) {
            var r = family(a.ranModel);
            if (r !== 'other') return r;
            var m = /^(fable|opus|sonnet|haiku)$/.exec(String(a.model || ''));
            if (m) return m[1];
            var d = /^(fable|opus|sonnet|haiku)\b/i.exec(String(a.description || ''));
            return d ? d[1].toLowerCase() : family(s.model);
        }
        // "opus 5.5 · inherit: station batch mockup" reads as its last part.
        function saShort(desc) { return String(desc || '').replace(/^[^·:]*·[^:]*:\s*/, ''); }
        function liveSubsHtml(s, now) {
            var mark = s.inflight && s.inflight.stage === s.stage ? s.inflight : null;
            var subs = (s.subagents || []).filter(function (a) { return !mark || a.id !== mark.agentId; });
            var open = '<div class="lane-subs" data-block="live-subagents">';
            if (!mark && !subs.length) return open + '<p class="sa-none">' + loc('nav.noStageOrSubagent', '沒有 stage agent 或 subagent 在跑，主 session 自己在做。') + '</p></div>';
            var head = [];
            if (mark) head.push(loc('nav.oneStageAgent', 'stage agent 1 個'));
            if (subs.length) head.push(loc('nav.nSubagents', 'subagent {n} 個', { n: subs.length }));
            return open + '<div class="sa-h"><b>' + loc('nav.runningNow', '現在在跑') + '</b><span>' + head.join(' · ') + '</span></div>'
                + (mark ? '<div class="sa inflight"><span class="sa-type">stage agent</span><span class="chip"><i class="sw" style="background:var(--st-'
                    + esc(mark.stage) + ')"></i>' + esc(mark.stage) + '</span><span class="sa-desc">'
                    + (isFinite(mark.at) ? loc('nav.sentNotReturned', '{t} 送出，還沒交回', { t: clock(mark.at) }) : loc('nav.notReturnedYet', '還沒交回')) + '</span><span class="sa-for">' + mins(now - mark.at) + '</span></div>' : '')
                + subs.map(function (a) {
                    var fam = saFamily(a, s), type = a.agentType || 'agent';
                    return '<div class="sa"><span class="sa-type" title="' + esc(type) + '">' + esc(type) + '</span>'
                        + '<span class="chip"><i class="sw" style="background:var(--m-' + fam + ')"></i>'
                        + (a.ranModel && modelKey(a.ranModel) !== 'other' ? esc(modelLabel(modelKey(a.ranModel))) : fam)
                        + (a.effort ? ' · ' + esc(a.effort) : '') + '</span>'
                        + '<span class="sa-desc" title="' + esc(a.description || '') + '">' + esc(saShort(a.description)) + '</span>'
                        + '<span class="sa-for">' + mins(now - a.startedAt) + '</span></div>';
                }).join('') + '</div>';
        }
        // A session's background shells (lib/shells.js shellsOf, already cut to
        // three, running first), on the subagent rows' grid: the shell's id, a pill
        // for running or how it ended (red for a non-zero exit), the command, and
        // the minutes since it started. None draws nothing, so home-running and the
        // focus header can call it for every session.
        function shellsHtml(shells, now) {
            var list = shells || [];
            if (!list.length) return '';
            var run = list.filter(function (x) { return x.state === 'running'; }).length;
            return '<div class="s-shells" data-block="s-shells" title="' + loc('nav.shellsRunning', '{n} 個在跑', { n: run }) + '">'
                + list.map(function (x) {
                    var t = Date.parse(x.startedAt);
                    var known = x.code !== null && x.code !== undefined;
                    var st = x.state === 'running'
                        ? '<span class="delta up"><i class="dot live"></i>' + loc('nav.shellRunning', '在跑') + '</span>'
                        : '<span class="delta ' + (known && x.code !== 0 ? 'dn' : 'flat') + '">' + loc('nav.shellEnded', '結束')
                            + (known ? ' · exit ' + esc(x.code) : '') + '</span>';
                    return '<div class="sa"><span class="sa-type">' + esc(x.id) + '</span>' + st
                        + '<span class="sa-desc" title="' + esc(x.command) + '">' + esc(x.command) + '</span>'
                        + '<span class="sa-for">' + (isFinite(t) ? mins(now - t) : '—') + '</span></div>';
                }).join('') + '</div>';
        }
        // One session: who (project, else the registry's short label, and the
        // root), the task, the rail, and when. A lane that is not confirmed live
        // carries its state pill instead of how long it has been open.
        function liveLane(s, name, now) {
            var sure = s.state === 'live' && !s.unknown;
            return '<a class="lane ' + (sure ? 'live wsubs' : 'unsure') + '" data-state="' + esc(s.state) + '" href="' + sessionHash(s.id) + '">' + keelProgress(s) + keelStage(s)
                + '<div class="lane-who"><b>' + esc(name(s)) + '</b><span class="mono" title="' + esc(s.root) + '">' + esc(s.root) + '</span></div>'
                + '<div class="lane-task" title="' + esc(s.task || '') + '">' + esc(s.task || loc('nav.unnamed', '（未命名）')) + '</div>'
                + liveRail(s, sure, now)
                + '<div class="lane-when"><b class="mono">' + ago(s.updated) + '</b>'
                + (sure ? '<small>' + loc('nav.lastWritten', '最後一次寫入') + '</small><small>' + loc('nav.openFor', '開了 {t}', { t: mins(now - msOf(s.started)) }) + '</small>' : statePill(s)) + '</div>'
                + (sure ? liveSubsHtml(s, now) : '') + '</a>';
        }
        // Waiting is what `pendingGateHtml` answers: a pending file with questions.
        // The wait runs from `gateAt`, stamped when the question went out
        // (`gateOpen` in lib/registry.js), else the pending file's `at`, else the
        // session's last registry write.
        function liveGate(rows, name, now) {
            var at = rows.filter(function (s) { return s.pending && s.pending.questions && s.pending.questions.length; });
            if (!at.length) {
                return '<section class="lv-gate is-empty" data-block="live-gate" aria-label="' + loc('nav.gatesWaitingOnYou', '等你回答的 gate') + '">' + icon('check')
                    + '<span>' + loc('nav.noGatesWaiting', '沒有在等你的 gate') + '</span></section>';
            }
            return '<section class="lv-gate" data-block="live-gate" aria-labelledby="h-gate"><div class="lv-h"><h2 id="h-gate">' + loc('nav.waitingOnYou', '等你回答') + '</h2>'
                + '<span class="lv-n mono">' + at.length + '</span></div>' + at.map(function (s) {
                    var since = msOf(s.gateAt || s.pending.at || s.updated), q = s.pending.questions[0];
                    var left = isFinite(s.pending.until) ? ' · ' + loc('nav.timeLeft', '還剩 {t}', { t: mins(Math.max(0, s.pending.until - now)) }) : '';
                    return '<a class="gate-row" href="' + sessionHash(s.id) + '"><span class="pill gate">' + icon('gate') + 'gate</span>'
                        + '<b class="gate-p">' + esc(name(s)) + '</b><span class="gate-q">' + esc(q.header || q.question || s.task || '') + '</span>'
                        + '<span class="gate-t mono">' + loc('nav.waitedFor', '等了 {t}', { t: isFinite(since) ? mins(now - since) : '—' }) + left + '</span>'
                        + '<span class="btn">' + loc('nav.goAnswer', '去回答') + '</span></a>';
                }).join('') + '</section>';
        }
        function liveRun(run, name, now) {
            return '<section class="lv-grp" data-block="live-run" aria-labelledby="h-run"><div class="lv-h"><h2 id="h-run">' + loc('nav.running', '正在跑') + '</h2>'
                + '<span class="lv-n mono">' + run.length + '</span><span class="lv-note">' + loc('nav.registryFoundProcess', 'registry 標著進行中，process 也找得到') + '</span></div>'
                + (run.length ? run.map(function (s) { return liveLane(s, name, now); }).join('')
                    : '<p class="lv-empty">' + loc('nav.noSessionRunning', '現在沒有 session 在跑。在任一個專案裡輸入 <code class="mono">/fankeel</code> 開始一個，它會出現在這裡。') + '</p>')
                + '</section>';
        }
        // `stale` and `live?` together: the registry says in progress and nothing
        // confirms it. Each registry with a stale row gets its clear control in the
        // heading, titled with its root so two of them read apart.
        function liveMaybe(maybe, open, name, now) {
            if (!maybe.length) return '';
            var clears = open.map(function (p) {
                var c = clearStaleControl(p, maybe.filter(function (s) { return s.root === p.root; }));
                return c ? '<span class="lv-clear" title="' + esc(p.root) + '">' + c + '</span>' : '';
            }).join('');
            return '<section class="lv-grp" data-block="live-maybe" aria-labelledby="h-maybe"><div class="lv-h"><h2 id="h-maybe">' + loc('nav.mayHaveStopped', '可能已經停了') + '</h2>'
                + '<span class="lv-n mono">' + maybe.length + '</span><span class="lv-note">' + loc('nav.registryUnconfirmedProcess', 'registry 還標著進行中，但確認不了 process 還在') + '</span>'
                + (clears ? '<span class="spacer"></span>' + clears : '') + '</div>'
                + '<div class="lv-card">' + maybe.map(function (s) {
                    return '<div class="lv-row">' + liveLane(s, name, now) + '<div class="lv-row-clear">' + clearControl(s) + '</div></div>';
                }).join('') + '</div></section>';
        }
        function liveIdle(idle, lab) {
            if (!idle.length) return '';
            return '<section class="lv-idle" data-block="live-idle" aria-labelledby="h-idle"><h2 id="h-idle">' + loc('nav.registriesNoSessions', '沒有 session 的 registry')
                + ' <span class="lv-n mono">' + idle.length + '</span></h2><ul>' + idle.map(function (p) {
                    return '<li><a href="' + projectHash(p.root) + '" title="' + esc(p.root) + '">' + esc(lab[p.root] || p.root) + '</a></li>';
                }).join('') + '</ul></section>';
        }
        function nowHtml(projects, sessions, tabs) {
            var open = projects.filter(function (p) { return !p.gone; });
            var lab = labels(open.map(function (p) { return p.root; }));
            var inOpen = {};
            open.forEach(function (p) { inOpen[p.root] = true; });
            var rows = sessions.filter(function (s) {
                return inOpen[s.root] && (s.state === 'live' || s.state === 'stale');
            }).sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); });
            var run = rows.filter(function (s) { return s.state === 'live' && !s.unknown; });
            var maybe = rows.filter(function (s) { return !(s.state === 'live' && !s.unknown); });
            var idle = open.filter(function (p) { return !rows.some(function (s) { return s.root === p.root; }); });
            var now = K.S().serve || !isFinite(K.NOW()) ? Date.now() : K.NOW();
            var name = function (s) { return s.project || lab[s.root] || s.root; };
            var gates = rows.filter(function (s) { return s.pending && s.pending.questions && s.pending.questions.length; }).length;
            return '<div class="phead khead" data-block="live-head"><h1>' + icon('now') + loc('nav.now', '現在') + '</h1>'
                + '<p class="kcap"><span>' + loc('nav.capRunning', '正在跑<b>{n}</b>', { n: run.length }) + '</span>'
                + '<span>' + (maybe.length ? '<a class="kcap-go" href="#/live" data-jump="h-maybe">' + loc('nav.capMaybe', '可能已經停了<b>{n}</b>', { n: maybe.length }) + '</a>'
                    : loc('nav.capMaybe', '可能已經停了<b>{n}</b>', { n: maybe.length })) + '</span>'
                + '<span' + (gates ? '' : ' class="ok"') + '>' + (gates ? loc('nav.capGates', '<b>{n}</b>個 gate 在等你', { n: gates }) : loc('nav.capNoGates', '沒有 gate 在等你')) + '</span></p>'
                + '<span class="spacer"></span>' + (tabs || '') + '</div><div class="lv klv" data-block="now">'
                + (open.length ? liveGate(rows, name, now) + liveRun(run, name, now) + liveMaybe(maybe, open, name, now) + liveIdle(idle, lab)
                    : '<p class="mute">' + loc('nav.noRegistry', '沒有 registry') + '</p>') + '</div>';
        }
        return { recentRows: recentRows, navCounts: navCounts, icon: icon, navOn: navOn, navGroup: navGroup, navTop: navTop,
            themeBtnHtml: themeBtnHtml, navHtml: navHtml, navLinksHtml: navLinksHtml, jumpHtml: jumpHtml, jumpHits: jumpHits,
            jumpListHtml: jumpListHtml, subtabsHtml: subtabsHtml, shellsHtml: shellsHtml, liveRail: liveRail, saFamily: saFamily,
            saShort: saShort, liveSubsHtml: liveSubsHtml, liveLane: liveLane, liveGate: liveGate, liveRun: liveRun, liveMaybe: liveMaybe,
            liveIdle: liveIdle, nowHtml: nowHtml };
    }
    var api = { make: make };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_NAV = api;
}(typeof window !== 'undefined' ? window : null));
