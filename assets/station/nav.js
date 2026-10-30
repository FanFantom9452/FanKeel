// 左欄 (FK_NAV): moved out of station.js (station-52).
// station.js calls make(K) once, on first use, handing it the helpers these
// bodies name; everything here only computes or builds strings.
(function (w) {
    'use strict';
    function make(K) {
        // One alias per name K carries: loc, esc, w, NAV_TREE, focusHref, mins.
        var loc = K.loc, esc = K.esc, w = K.w, NAV_TREE = K.NAV_TREE, focusHref = K.focusHref, mins = K.mins;
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
        return { recentRows: recentRows, navCounts: navCounts, icon: icon, navOn: navOn, navGroup: navGroup, navTop: navTop,
            themeBtnHtml: themeBtnHtml, navHtml: navHtml, navLinksHtml: navLinksHtml, jumpHtml: jumpHtml, jumpHits: jumpHits,
            jumpListHtml: jumpListHtml, subtabsHtml: subtabsHtml, shellsHtml: shellsHtml };
    }
    var api = { make: make };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_NAV = api;
}(typeof window !== 'undefined' ? window : null));
