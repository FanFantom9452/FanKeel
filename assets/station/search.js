// 搜尋框與語言切換 (FK_SEARCH): moved out of station.js (station-52).
// station.js calls make(K) once, on first use, handing it the helpers these
// bodies name; the listeners, qClose and qMove (they assign qTimer/qAt) stay
// in station.js. qPop and qAt are station.js's, so they go through K.
(function (w) {
    'use strict';
    function make(K) {
        var esc = K.esc, loc = K.loc, doc = K.doc, icon = K.icon, ago = K.ago, match = K.match,
            shortLabel = K.shortLabel, sessionHash = K.sessionHash, projectHash = K.projectHash,
            I18N = K.I18N;
        function qMark(text, q) {
            var s = String(text === null || text === undefined ? '' : text), i = q ? s.toLowerCase().indexOf(q.toLowerCase()) : -1;
            return i < 0 ? esc(s) : esc(s.slice(0, i)) + '<mark>' + esc(s.slice(i, i + q.length)) + '</mark>' + esc(s.slice(i + q.length));
        }
        function qHas(v, q) { return v !== null && v !== undefined && String(v).toLowerCase().indexOf(q.toLowerCase()) >= 0; }
        function qGroups(q) {
            var sess = K.S().sessions.filter(function (s) { return match(s, { q: q, state: '', project: '', stage: '' }); })
                .sort(function (a, b) { return (b.state === 'live') - (a.state === 'live') || (b.updated || 0) - (a.updated || 0); });
            var seen = {}, proj = [], docs = [];
            K.S().sessions.forEach(function (s) {
                if (seen[s.pkey]) return;
                seen[s.pkey] = true;
                if (qHas(K.NAMES()[s.pkey], q) || qHas(s.pkey, q)) proj.push(s.pkey);
            });
            K.S().projects.forEach(function (p) {
                (p.docs || []).forEach(function (d) {
                    var add = function (path, kind) { if (qHas(path, q)) docs.push({ pkey: d.pkey, path: path, kind: kind }); };
                    (d.plannedNotBuilt || []).forEach(function (x) { add(x, loc('q.notBuiltYet', '還沒建')); });
                    ((d.undeclared && d.undeclared.paths) || []).forEach(function (x) { add(x, loc('q.noStatusDeclared', '沒宣告狀態')); });
                    ((d.filing && d.filing.rows) || []).forEach(function (r) { add(r.bucket, r.role); });
                });
            });
            var pname = function (pkey) { return shortLabel(K.NAMES()[pkey] || pkey); };
            return [
                { t: 'Sessions', ico: 'sessions', n: sess.length, all: '#/list', rows: sess.slice(0, 5).map(function (s) {
                    return { href: sessionHash(s.id), html: '<span class="qt">' + qMark(s.task || loc('q.unnamed', '（未命名）'), q) + '</span>'
                        + (qHas(s.id, q) && !qHas(s.task, q) ? '<span class="qid mono">' + qMark(s.id, q) + '</span>' : '')
                        + '<span class="qp">' + qMark(pname(s.pkey), q) + '</span><span class="qs mono">' + esc(s.stage || '—') + '</span>'
                        + '<span class="qa">' + ago(s.updated) + '</span>' };
                }) },
                { t: loc('q.projects', '專案'), ico: 'projects', n: proj.length, all: '#/projects', rows: proj.slice(0, 5).map(function (k) {
                    return { href: projectHash(k), html: '<span class="qt">' + qMark(pname(k), q) + '</span><span class="qp mono">' + qMark(k, q) + '</span>' };
                }) },
                { t: loc('q.docs', '文件'), ico: 'docs', n: docs.length, all: '#/docs', rows: docs.slice(0, 5).map(function (d) {
                    return { href: '#/docs', html: '<span class="qt mono">' + qMark(d.path, q) + '</span><span class="qp">' + esc(pname(d.pkey))
                        + '</span><span class="qs">' + esc(d.kind) + '</span>' };
                }) },
            ].filter(function (g) { return g.n; });
        }
        function qDraw() {
            var qBox = K.qBox, qPop = K.qPop(), q = qBox.value.trim(), i = 0;
            if (!q) { K.qClose(); return; }
            if (!qPop) {
                qPop = doc.createElement('div');
                K.setQPop(qPop);
                qPop.id = 'qpop';
                qPop.className = 'qpop';
                // A press inside keeps the caret in the box; the click still lands.
                qPop.addEventListener('mousedown', function (e) { e.preventDefault(); });
                qPop.addEventListener('click', function (e) { if (e.target.closest('[data-qi]')) K.qClose(); });
                qBox.parentNode.appendChild(qPop);
            }
            var gs = qGroups(q), row = function (href, html, cls) {
                var n = i++;
                return '<a class="' + cls + '" id="qr-' + n + '" data-qi="' + n + '" role="option" aria-selected="false" href="' + href + '">' + html + '</a>';
            };
            qPop.innerHTML = '<div class="qin" data-block="search" role="listbox" aria-label="' + loc('q.searchResults', '搜尋結果') + '">' + (gs.length ? gs.map(function (g) {
                return '<div class="qg"><div class="qh">' + icon(g.ico) + '<b>' + g.t + '</b><span class="qn">' + g.n + '</span></div>'
                    + g.rows.map(function (r) { return row(r.href, r.html, 'qrow'); }).join('')
                    + (g.n > g.rows.length ? row(g.all, loc('q.seeAllNRows', '看全部 {n} 筆 →', { n: g.n }), 'qall') : '') + '</div>';
            }).join('') : '<p class="qnone">' + loc('q.noResultsFor', '沒有符合 “{q}” 的結果', { q: esc(q) }) + '</p>') + '</div>';
            qPop.hidden = false;
            K.setQAt(-1);
            qBox.setAttribute('aria-expanded', 'true');
            qBox.removeAttribute('aria-activedescendant');
        }
        function cssKey(k) { return String(k).replace(/["\\]/g, '\\$&'); }
        var SERVE_ICON = '<svg class="ico" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor"'
            + ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/>'
            + '<path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/></svg>';
        function serveIconHtml(up) {
            var words = up ? loc('mast.serveUp', 'serve 連線中') : loc('mast.serveDown', 'serve 已停');
            return '<span class="pill ' + (up ? 'live srv up" id="serveup"' : 'down srv" id="servedown"') + ' role="status" aria-label="' + esc(words)
                + '" title="' + esc(words) + '">' + SERVE_ICON + '<i class="dot ' + (up ? 'live' : 'down') + '" aria-hidden="true"></i></span>';
        }
        function applyChrome() {
            if (!I18N) return;
            var en = I18N.lang === 'en';
            var set = function (id, fn) { var el = doc.getElementById(id); if (el) fn(el); };
            if (doc.documentElement && doc.documentElement.setAttribute) doc.documentElement.setAttribute('lang', en ? 'en' : 'zh-Hant');
            doc.title = loc('mast.title', 'fankeel 測站');
            set('brand', function (el) { el.setAttribute('aria-label', loc('mast.home', 'fankeel 測站 首頁')); });
            set('brandw', function (el) { el.textContent = ''; });
            set('side', function (el) { el.setAttribute('aria-label', loc('mast.crumbs', '位置')); });
            set('q', function (el) {
                el.placeholder = loc('mast.searchHint', '搜尋任務、session、碰過的檔案…');
                el.setAttribute('aria-label', loc('mast.search', '搜尋'));
            });
            set('servedown', function (el) {
                el.className = 'pill down srv';
                el.setAttribute('role', 'status');
                el.setAttribute('aria-label', loc('mast.serveDown', 'serve 已停'));
                el.title = loc('mast.serveDown', 'serve 已停');
                el.innerHTML = SERVE_ICON + '<i class="dot down" aria-hidden="true"></i>';
            });
            set('langzh', function (el) {
                el.setAttribute('aria-pressed', String(!en));
                el.setAttribute('aria-checked', String(!en));
                el.setAttribute('title', en ? '介面改用繁體中文' : '介面用繁體中文');
            });
            set('langen', function (el) {
                el.setAttribute('aria-pressed', String(en));
                el.setAttribute('aria-checked', String(en));
                el.setAttribute('title', en ? 'Interface is in English' : 'Switch the interface to English');
            });
            set('langcur', function (el) { el.textContent = en ? 'EN' : '繁中'; });
            set('appear', function (el) { el.setAttribute('aria-label', loc('mast.appearance', '外觀')); });
        }
        return { qMark: qMark, qHas: qHas, qGroups: qGroups, qDraw: qDraw, cssKey: cssKey,
            serveIconHtml: serveIconHtml, applyChrome: applyChrome };
    }
    var api = { make: make };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_SEARCH = api;
}(typeof window !== 'undefined' ? window : null));
