'use strict';

// The station page, rendered in the browser from `window.STATION`. Loaded by
// `station.html` after `station-data.js`, so the model is already there.
//
// Everything above the `module.exports` guard is a pure function and is unit
// tested; everything below it touches the document and is checked against the
// served page instead. The split is not a preference — this repository carries
// no dependencies, so there is no DOM in `node --test` to render into.

(function (w, doc) {
    // The reader's theme goes on <html> before anything is drawn, so a page
    // set to 深色 does not flash light first. No attribute is 跟隨系統: the
    // stylesheet's media query decides. localStorage can throw (file://,
    // private mode) or be missing (node), and then there is no preference.
    function stored(k) { try { return w.localStorage.getItem(k); } catch (e) { return null; } }
    function store(k, v) { try { if (v === null) w.localStorage.removeItem(k); else w.localStorage.setItem(k, v); } catch (e) { /* not kept */ } }
    function themeSet(t) {
        if (!doc || !doc.documentElement) return;
        if (t === 'light' || t === 'dark') doc.documentElement.setAttribute('data-theme', t);
        else doc.documentElement.removeAttribute('data-theme');
    }
    themeSet(stored('station.theme'));
    var S = w.STATION || { sessions: [], projects: [] };
    // The language the page draws in (assets/station/i18n.js). `loc(key, zh,
    // vars)` is every string's one door: the Chinese is written at the call,
    // and English replaces it only when i18n.js is loaded and set to English.
    // Without i18n.js — node's tests, an old copy — the page is Chinese.
    var I18N = w.FK_I18N || null;
    function fillVars(s, vars) {
        if (!vars) return s;
        return String(s).replace(/\{(\w+)\}/g, function (m, k) { return Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m; });
    }
    function loc(key, zh, vars) { return I18N ? I18N.t(key, zh, vars) : fillVars(zh, vars); }
    var ROUTE = ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'];
    var STAGE_C = {
        survey: '#94a3b8', design: '#8b5cf6', plan: '#f472b6', build: '#4c3fd7',
        verify: '#14b8a6', audit: '#3b82f6', land: '#64748b',
    };

    function tokens(n) {
        if (n === null || n === undefined) return '—';
        if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M';
        if (n >= 1e3) return Math.round(n / 1e3) + 'k';
        return String(n);
    }
    function mins(ms) {
        if (ms === null || ms === undefined || !isFinite(ms)) return '—';
        var m = Math.round(ms / 60000);
        if (m < 60) return m + 'm';
        var h = Math.floor(m / 60);
        if (h < 24) return h + 'h' + (m % 60 ? (m % 60) + 'm' : '');
        return Math.floor(h / 24) + 'd' + (h % 24 ? (h % 24) + 'h' : '');
    }
    function hours(ms) { return (ms / 3.6e6).toFixed(ms >= 3.6e7 ? 0 : 1) + 'h'; }
    function quotaWeek() {
        var P = S.profiles || {}, ps = P.projects || {}, ks = Object.keys(ps);
        for (var i = 0; i < ks.length; i++) {
            var e = ps[ks[i]] || {}, v = e.values && e.values['quota.week'];
            if (e.sources && e.sources['quota.week'] === 'project' && typeof v === 'number' && v > 0) return v;
        }
        var m = P.machine && P.machine.values;
        return m && m['quota.week'];
    }
    // The share of the weekly quota, as '(N%)', or '' when no quota is set.
    function quotaPct(n) {
        var q = quotaWeek();
        if (!n || typeof q !== 'number' || !(q > 0)) return '';
        var p = n / q * 100;
        return '(' + (p >= 10 ? Math.round(p) : +p.toFixed(2)) + '%)';
    }
    // `plain` drops the share: axis ticks, per-bar labels and text drawn inside
    // a fixed-width box have no room for it.
    function usd(n, plain) {
        if (!n) return '—';
        var s = '$' + (n >= 100 ? n.toFixed(0) : n.toFixed(2));
        var q = plain ? '' : quotaPct(n);
        return q ? s + ' ' + q : s;
    }
    function ago(ms) {
        if (!ms) return '—';
        var d = Date.now() - ms;
        if (d < 60000) return 'just now';
        if (d < 3.6e6) return Math.round(d / 6e4) + 'm ago';
        if (d < 8.64e7) return Math.round(d / 3.6e6) + 'h ago';
        return Math.round(d / 8.64e7) + 'd ago';
    }
    function day(iso) { return typeof iso === 'string' ? iso.slice(0, 10) : '—'; }
    function stamp(ms) {
        return isFinite(ms) ? new Date(ms).toISOString().replace('T', ' ').slice(0, 16) : '—';
    }
    function esc(s) {
        return String(s === null || s === undefined ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function cost(s) { return (s.usd || 0) + (s.agentUsd || 0); }

    // `unknown` is `serialize()`'s way of saying liveness could not be
    // measured for this session — `data.active === true` but the config
    // directory it would have to read to confirm was unreadable, so `live` is
    // what it defaulted to rather than what was confirmed. The question mark
    // and the title are the only place that distinction reaches a reader:
    // `skills/fankeel/SKILL.md` tells every session to trust this page about
    // liveness, so a state that cannot be measured must not read as certain.
    function statePill(s) {
        return '<span class="pill ' + s.state + '"'
            + (s.unknown ? ' title="' + loc('fmt.unknownLiveness', '這個 session 的 config directory 讀不到，活著與否無法確認') + '"' : '') + '><i class="dot ' + s.state
            + (s.state === 'live' ? ' pulse' : '') + '"></i>' + s.state
            + (s.unknown ? '?' : '') + '</span>';
    }

    // The shortest tail of a root's segments that no other root shares. Moved
    // here from `lib/station.js`'s `navLabels` when the nav became a facet: the
    // rule is the same and `depth[i] < segs[i].length` still bounds it. Two
    // roots that split into the same segments — `/a/b` against `\a\b`, or
    // against `/a/b/` — are the only pair that reaches that bound still
    // colliding, and they share a label. TODO.md files that case. A nested
    // root is not it: it separates once the longer one grows past the shorter
    // one's own length.
    function labels(roots) {
        // Two roots are the same registry when, after dropping a trailing
        // separator and folding case, their strings are equal — that is
        // Windows, where `F:\a` and `f:\a\` are one directory. Fold before
        // the tails are computed, so the pair collapses to one group and one
        // card rather than reaching the shortest-unique-tail loop as if they
        // were two registries that happen to share a label. A nested root —
        // `F:\a` against `F:\a\b` — keeps a different key and stays two.
        function key(r) { return String(r).replace(/[\\/]+$/, '').toLowerCase(); }
        var uniq = [];
        var seen = {};
        roots.forEach(function (r) {
            var k = key(r);
            if (!seen[k]) { seen[k] = true; uniq.push(r); }
        });
        var segs = uniq.map(function (r) {
            return String(r).split(/[\\/]+/).filter(Boolean);
        });
        var depth = uniq.map(function () { return 1; });
        var at = function (i) { return segs[i].slice(-depth[i]).join('/'); };
        for (var guard = 0; guard < 50; guard++) {
            var ls = uniq.map(function (_, i) { return at(i); });
            var counts = {};
            ls.forEach(function (l) { counts[l] = (counts[l] || 0) + 1; });
            var grew = false;
            ls.forEach(function (l, i) {
                if (counts[l] > 1 && depth[i] < segs[i].length) { depth[i] += 1; grew = true; }
            });
            if (!grew) break;
        }
        var out = {};
        uniq.forEach(function (r, i) { out[r] = at(i); });
        return out;
    }

    // Two windows of very different completeness sit beside each other here:
    // this repository's usage records begin on 2026-09-04 and its burn records
    // on 08-28, so a previous window holding nothing would otherwise print
    // +13000%. An empty comparison says it is empty. A ratio moves in
    // percentage points, and a rise in waiting is the bad direction.
    function delta(cur, prev, unit) {
        if (unit === 'pt') {
            var pp = (cur - prev) * 100;
            if (!prev && !cur) return '<span class="delta flat">' + loc('fmt.noCompare', '無可比') + '</span>';
            var c2 = Math.abs(pp) < 0.5 ? 'flat' : pp > 0 ? 'dn' : 'up';
            return '<span class="delta ' + c2 + '">' + (pp > 0 ? '+' : '') + pp.toFixed(1)
                + ' pt ' + (c2 === 'up' ? '↘' : c2 === 'dn' ? '↗' : '') + '</span>';
        }
        if (!prev) return '<span class="delta flat">' + loc('fmt.noPriorData', '前期無資料') + '</span>';
        var d = (cur - prev) / prev * 100;
        var cls = Math.abs(d) < 0.5 ? 'flat' : d > 0 ? 'up' : 'dn';
        var n = Math.abs(d) >= 100 ? Math.round(d) : Number(d.toFixed(1));
        return '<span class="delta ' + cls + '">' + (d > 0 ? '+' : '') + n + '% '
            + (cls === 'up' ? '↗' : cls === 'dn' ? '↘' : '') + '</span>';
    }

    // One predicate for every view. A facet and the search box are AND-ed, so
    // the KPI cards, the charts and the table all narrow together — which is
    // the thing the old page could not do, because its rows were markup by the
    // time they reached the browser.
    function match(s, f) {
        if (f.state && s.state !== f.state) return false;
        if (f.project && s.root !== f.project) return false;
        if (f.stage && s.stage !== f.stage) return false;
        if (f.q) {
            // The model is in here because it was a filter term on the old page
            // and dropping it would be a silent loss: nothing tells a reader
            // that `opus` stopped matching.
            // Guarded, every one of them: an absent `model` joined raw puts the
            // string `undefined` in the haystack, and a search for it matches
            // every session that has no model.
            var t = [s.task, s.project, s.id, s.label, s.model || '', s.state,
                (s.claims || []).join(' '), (s.notes || []).join(' '), s.next || '']
                .join(' ').toLowerCase();
            if (t.indexOf(f.q.toLowerCase()) === -1) return false;
        }
        return true;
    }

    // ---- the three levels: shared -----------------------------------------
    // 2026-09-14. Every figure on the home, project and session pages is summed
    // from a session's `days` (dollars, tokens) and `spans` (milliseconds), split
    // by the local day each request happened on — never from the registry's
    // `usd`, which SessionEnd writes once and which is filed under the start day.
    var TABS = ['timeline', 'cost', 'dispatch', 'events', 'talk', 'plan', 'gate'];
    var MODEL_KEYS = ['fable', 'opus', 'sonnet', 'haiku', 'other'];
    var TOKEN_KEYS = ['input', 'output', 'cacheRead', 'cacheWrite5m', 'cacheWrite1h'];
    // `kind` splits a day's cost or tokens by where they went: the five token
    // kinds, the two cache-write rates kept apart, because they are two
    // caches — 1h is what the main session writes each turn, 5m what each
    // agent writes from its first turn on (station-30). The cost tab's
    // `costHtml`, the kind split on 花費 and the 7-day card share this order.
    var KIND_KEYS = ['input', 'output', 'cacheRead', 'cacheWrite1h', 'cacheWrite5m'];
    var KIND_LABEL = { input: 'input', output: 'output', cacheRead: 'cache read',
        cacheWrite1h: loc('shared.kindCw1h', 'cache write 1h · 主對話'), cacheWrite5m: loc('shared.kindCw5m', 'cache write 5m · agent') };
    var KIND_COLOR = { input: '--t-in', output: '--t-out', cacheRead: '--t-cr', cacheWrite1h: '--t-cw1h', cacheWrite5m: '--t-cw' };
    var WHO_LABEL = { main: loc('shared.main', '主 session'), agent: loc('shared.agent', '背景 agent'), workflow: 'workflow' };
    var DIM_LABEL = { model: loc('shared.byModel', '依 model'), project: loc('shared.byProject', '依專案'), stage: loc('shared.byStage', '依 stage'),
        who: loc('shared.mainVsAgent', '主 session 對 agent'), version: loc('shared.byVersion', '依版本'), kind: loc('shared.byKind', '依成分'),
        type: loc('shared.byAgentType', '依 agent 類型') };
    // An agent type is on a `days` row (lib/detail.js stamps it); a span
    // records only stage and who, so 時間 has none to split by.
    var NO_TIME_TYPE = loc('shared.noTimeByType', '時間沒有 agent 類型可分：spans 只記 stage 與誰在跑');
    // Dollars to the cent, whatever the size: a break's cost and the range
    // report's tables are compared against figures printed that way.
    function usd2(n) { return '$' + (n || 0).toFixed(2); }
    // What the page's own modules (assets/station/spend-*.js) draw with. They
    // load before this file and read `w.FK_KIT` only when they draw, so a
    // helper is written once, here.
    w.FK_KIT = { esc: esc, tokens: tokens, usd2: usd2, comma: comma, delta: delta, roHtml: roHtml, segHtml: segHtml,
        sessionHash: sessionHash, localDay: localDay, lastDays: lastDays, fillVars: fillVars,
        KIND_KEYS: KIND_KEYS, KIND_LABEL: KIND_LABEL, KIND_COLOR: KIND_COLOR };
    var METRIC_LABEL = { usd: loc('shared.cost', '花費'), tokens: 'token', time: loc('shared.time', '時間') };
    function localDay(ms) {
        var d = new Date(ms);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    // Calendar arithmetic rather than 864e5 steps, so a daylight-saving day
    // neither repeats nor drops a date.
    function lastDays(nowMs, n) {
        var d = new Date(nowMs), out = [];
        for (var i = n - 1; i >= 0; i--) {
            out.push(localDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() - i, 12).getTime()));
        }
        return out;
    }
    // `#/` is 儀表板 (the `now` view); `#/live` (what `#/` used to be, 現在),
    // `#/days`, `#/d/<day>`, `#/sessions`, `#/projects`, `#/docs`, `#/settings`,
    // `#/tour`, `#/list` and `#/cmp` are the other pages the left bar opens;
    // `#/p/<pkey>` and `#/s/<id>[/<tab>]` are opened from rows. A hash is what
    // a page opened from file:// can go back through. `#/p/<pkey>/todo` and
    // `#/p/<pkey>/todo/<id>` are the project page with its TODO panel, or that
    // entry in it, scrolled into view: the Pane's TODO buttons open them.
    var PAGES = ['live', 'sessions', 'projects', 'docs', 'settings', 'tour'];
    function parseHash(hash) {
        var p = String(hash || '').replace(/^#\/?/, '').split('/');
        var dec = function (v) { try { return decodeURIComponent(v); } catch (e) { return null; } };
        if (p[0] === 'd' && /^\d{4}-\d{2}-\d{2}$/.test(p[1] || '')) return { view: 'days', day: p[1] };
        if (p[0] === 'days') return { view: 'days', day: null };
        var seg = p[0] === 'p' && p[1] ? p.slice(1) : [], todo;
        if (seg.length > 1 && seg[seg.length - 1] === 'todo') { todo = ''; seg = seg.slice(0, -1); }
        else if (seg.length > 2 && seg[seg.length - 2] === 'todo') { todo = dec(seg[seg.length - 1]) || ''; seg = seg.slice(0, -2); }
        var key = seg.length ? dec(seg.join('/')) : null;
        if (key !== null) return todo === undefined ? { view: 'project', pkey: key } : { view: 'project', pkey: key, todo: todo };
        var id = p[0] === 's' && p[1] ? dec(p[1]) : null;
        if (id !== null) return { view: 'session', id: id, tab: TABS.indexOf(p[2]) >= 0 ? p[2] : 'timeline' };
        if (p[0] === 'list' || p[0] === 'cmp') return { view: p[0] };
        if (PAGES.indexOf(p[0]) >= 0) return { view: p[0] };
        return { view: 'now' };
    }
    function projectHash(pkey) { return '#/p/' + encodeURIComponent(pkey); }
    // The Pane builds a pkey from the engine's root, which may write `/` where
    // lib/station.js's path.resolve wrote `\`, or another case of the drive
    // letter: the key a session on the page carries wins, else `k` as it came.
    function knownPkey(k, sessions) {
        var flat = function (s) { return String(s).replace(/\\/g, '/').toLowerCase(); };
        var all = sessions || [];
        var hit = all.filter(function (s) { return s.pkey === k; })[0] || all.filter(function (s) { return flat(s.pkey) === flat(k); })[0];
        return hit ? hit.pkey : k;
    }
    function sessionHash(id, tab) { return '#/s/' + encodeURIComponent(id) + (tab && tab !== 'timeline' ? '/' + tab : ''); }
    function family(model) {
        var m = /claude-(fable|opus|sonnet|haiku)/.exec(String(model || ''));
        return m ? m[1] : 'other';
    }
    // The model dimension is the version: `claude-<family>-<major>[-<minor>]`,
    // with a trailing date or `[1m]` dropped. `family()` stays for colour.
    function modelKey(model) {
        var m = /claude-(fable|opus|sonnet|haiku)-(\d{1,2})(?:-(\d{1,2}))?(?!\d)/.exec(String(model || ''));
        return m ? m[1] + '-' + m[2] + (m[3] ? '-' + m[3] : '') : 'other';
    }
    function modelLabel(key) {
        var p = String(key).split('-');
        if (p.length < 2) return String(key);
        return p[0].charAt(0).toUpperCase() + p[0].slice(1) + ' ' + p.slice(1).join('.');
    }
    function tokenSum(t) {
        return t ? TOKEN_KEYS.reduce(function (n, k) { return n + (t[k] || 0); }, 0) : 0;
    }
    // `kind` is not here: it is not one key per row, it is five (see
    // `dayBars`), so it never goes through `dimKey`.
    function dimKey(dim, s, r) {
        if (dim === 'model') return modelKey(r.model);
        if (dim === 'project') return s.pkey;
        if (dim === 'stage') return r.stage || 'none';
        if (dim === 'version') return s.version || 'none';
        if (dim === 'type') return r.who === 'main' ? 'main' : (r.type || 'unknown');
        return r.who;
    }
    // Versions parsed as dotted numbers and compared newest first; a version
    // that does not parse falls back to a plain string compare so it still
    // sorts somewhere rather than throwing.
    function verCmp(a, b) {
        var pa = String(a).split('.'), pb = String(b).split('.'), n = Math.max(pa.length, pb.length);
        for (var i = 0; i < n; i++) {
            var na = Number(pa[i]), nb = Number(pb[i]);
            if (isNaN(na) || isNaN(nb)) return pa[i] === pb[i] ? 0 : (pa[i] || '') < (pb[i] || '') ? -1 : 1;
            if (na !== nb) return na - nb;
        }
        return 0;
    }
    // Models bottom-up by price, stages in route order, projects by size,
    // kind in the cost tab's order, versions newest first. `'none'` is put
    // last for `version` on purpose: it is usually the biggest group — every
    // session before this field existed lands there — and size-descending
    // would put it first, reading as "the newest version" when it means the
    // opposite.
    function orderKeys(dim, seen) {
        if (dim === 'model') {
            var fam = function (k) { var i = MODEL_KEYS.indexOf(String(k).split('-')[0]); return i < 0 ? MODEL_KEYS.length : i; };
            var ver = function (k) { return String(k).split('-').slice(1).join('.'); };
            return Object.keys(seen).filter(function (k) { return seen[k]; })
                .sort(function (a, b) { return fam(a) - fam(b) || verCmp(ver(b), ver(a)); });
        }
        var fixed = dim === 'stage' ? ROUTE.concat(['none'])
            : dim === 'who' ? ['main', 'agent', 'workflow'] : dim === 'kind' ? KIND_KEYS : null;
        var keys = Object.keys(seen).filter(function (k) { return seen[k]; });
        if (dim === 'version') {
            var real = keys.filter(function (k) { return k !== 'none'; }).sort(verCmp).reverse();
            return seen['none'] ? real.concat(['none']) : real;
        }
        if (!fixed) return keys.sort(function (a, b) { return seen[b] - seen[a] || (a < b ? -1 : 1); });
        return fixed.filter(function (k) { return seen[k]; })
            .concat(keys.filter(function (k) { return fixed.indexOf(k) < 0; }).sort());
    }
    // A project's colour is its place in `pkeys`, the 30-day order, so it is
    // the same on every chart; the sixth project on shares `--p-5`. `kind`
    // instead reuses the cost tab's own five custom properties. `version` has
    // no equivalent 30-day-order list of its own, so its callers hand this
    // the current bar set's own `bars.keys` in `pkeys`' place — already
    // newest-first from `orderKeys` — so the newest version lands on `--p-0`,
    // the next on `--p-1`, and so on, capped at `--p-5` the same way project
    // is; `'none'` is forced to the quiet grey before reaching that index so
    // it never claims a slot or reads as a colour peer of a real version.
    function colorOf(dim, key, pkeys) {
        // One hue per family, from `--m-<family>`; the newest version on the
        // chart is that colour, each older one mixed 30% further toward the
        // panel. `pkeys` is the bar set's own keys here, newest first.
        if (dim === 'model') {
            var f = String(key).split('-')[0];
            if (MODEL_KEYS.indexOf(f) < 0) f = 'other';
            var peers = (pkeys || []).filter(function (k) { return String(k).split('-')[0] === f; });
            var n = Math.max(0, peers.indexOf(key));
            return n === 0 ? 'var(--m-' + f + ')' : 'color-mix(in oklab, var(--m-' + f + ') ' + Math.max(100 - 30 * n, 25) + '%, var(--panel))';
        }
        if (dim === 'stage') return ROUTE.indexOf(key) >= 0 ? 'var(--st-' + key + ')' : 'var(--st-none)';
        if (dim === 'who') return 'var(--s-' + key + ')';
        if (dim === 'kind') return 'var(' + (KIND_COLOR[key] || '--st-none') + ')';
        if (dim === 'type' && key === 'main') return 'var(--s-main)';
        if (dim === 'version' && key === 'none') return 'var(--st-none)';
        var i = (pkeys || []).indexOf(key);
        return 'var(--p-' + (i < 0 ? 5 : Math.min(i, 5)) + ')';
    }
    function keyLabel(dim, key, names) {
        if (dim === 'who') return WHO_LABEL[key] || key;
        if (dim === 'stage') return key === 'none' ? loc('shared.beforeStepOne', '第一步之前') : key;
        if (dim === 'project') return (names && names[key]) || key;
        if (dim === 'kind') return KIND_LABEL[key] || key;
        if (dim === 'type') return key === 'main' ? WHO_LABEL.main : key === 'unknown' ? loc('shared.typeUnknown', '未記類型') : key;
        if (dim === 'version') return key === 'none' ? loc('shared.noVersionRecorded', '未記版本') : key;
        if (dim === 'model') return modelLabel(key);
        return key;
    }
    // One key so far needs more than its label. `version`'s `'none'` is drawn
    // in the quiet grey rather than a palette slot, and the grey has to say
    // what it means: the session ran before the registry carried a `version`
    // at all. It is not a session from somewhere else — every row on this page
    // comes from a registry entry, and only this plugin writes those — so the
    // bucket is "older than the field", not "not one of ours". Every other
    // key's label is the whole story, so this returns '' for them.
    function keyHint(dim, key) {
        if (dim === 'kind') return w.FK_KINDS ? w.FK_KINDS.notes(S.prices)[key] || '' : '';
        return dim === 'version' && key === 'none' ? loc('shared.noVersionField', '跑的時候 registry 還沒有 version 這個欄位，不是別處來的 session') : '';
    }
    function projectNames(sessions) {
        var lab = labels(sessions.map(function (s) { return s.root; }));
        var out = {};
        sessions.forEach(function (s) { out[s.pkey] = (lab[s.root] || s.root) + (s.project ? ' / ' + s.project : ''); });
        return out;
    }
    function niceTop(v) {
        if (!(v > 0)) return 1;
        var p = Math.pow(10, Math.floor(Math.log(v) / Math.LN10)), f = v / p;
        return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
    }
    function partEst(b, k) { return Boolean(b.est && b.est[k]); }
    // `est` marks a dollar figure that has an estimated-price request in it;
    // an axis tick is a scale, not a spend, and passes none.
    function metricText(metric, v, plain, est) {
        return metric === 'usd' ? (v ? usd(v, plain) + (est ? estMark({ estimated: true }) : '') : '$0') : metric === 'tokens' ? tokens(v) : hours(v);
    }
    function sessionTotals(s) {
        var t = { usd: 0, tokens: 0, active: 0, main: 0, wait: 0, models: {}, estModels: {}, estimated: false };
        (s.days || []).forEach(function (r) {
            var m = family(r.model);
            if (r.estimated && r.usd) { t.estimated = true; t.estModels[m] = true; }
            t.usd += r.usd || 0;
            t.tokens += tokenSum(r.tokens);
            t.models[m] = (t.models[m] || 0) + (r.usd || 0);
        });
        (s.spans || []).forEach(function (r) {
            if (r.who === 'wait') { t.wait += r.ms; return; }
            t.active += r.ms;
            if (r.who === 'main') t.main += r.ms;
        });
        return t;
    }
    // Time is main + agent + workflow, counted each on its own while they
    // overlap: it measures work, not the wall clock. Waiting is apart.
    function windowTotals(sessions, days) {
        var inside = {}, t = { usd: 0, tokens: 0, active: 0, main: 0, wait: 0, estimated: false };
        days.forEach(function (d) { inside[d] = true; });
        sessions.forEach(function (s) {
            (s.days || []).forEach(function (r) {
                if (!inside[r.day]) return;
                if (r.estimated && r.usd) t.estimated = true;
                t.usd += r.usd || 0;
                t.tokens += tokenSum(r.tokens);
            });
            (s.spans || []).forEach(function (r) {
                if (!inside[r.day]) return;
                if (r.who === 'wait') { t.wait += r.ms; return; }
                t.active += r.ms;
                if (r.who === 'main') t.main += r.ms;
            });
        });
        return t;
    }
    // One bar per day; a bar's total is added in the same pass as its parts,
    // so it is their sum and nothing else.
    function dayBars(sessions, metric, dim, days) {
        if (metric === 'time' && dim === 'model') {
            return { days: [], keys: [], max: 0, disabled: loc('shared.noTimeByModel', '時間沒有 model 可分：spans 只記 stage 與誰在跑，不記 model') };
        }
        // Same reason as `model`, just above: with `時間` the bars come from
        // `s.spans`, and a span records only stage and who, so it carries no
        // tokens and no cost to split into kinds. `version` needs no such
        // guard — it is a property of the session, so it applies to spans too.
        if (metric === 'time' && dim === 'kind') {
            return { days: [], keys: [], max: 0, disabled: loc('shared.noTimeByKind', '時間沒有成分可分：spans 只記 stage 與誰在跑，不記 token 或花費') };
        }
        if (metric === 'time' && dim === 'type') {
            return { days: [], keys: [], max: 0, disabled: NO_TIME_TYPE };
        }
        var at = {}, seen = {};
        days.forEach(function (d) { at[d] = { day: d, total: 0, parts: {}, est: {}, estimated: false }; });
        var add = function (d, key, v, e) {
            if (!at[d] || !v) return;
            if (e) { at[d].est[key] = true; at[d].estimated = true; }
            at[d].parts[key] = (at[d].parts[key] || 0) + v;
            at[d].total += v;
            seen[key] = (seen[key] || 0) + v;
        };
        sessions.forEach(function (s) {
            if (metric === 'time') {
                (s.spans || []).forEach(function (r) { if (r.who !== 'wait') add(r.day, dimKey(dim, s, r), r.ms); });
                return;
            }
            (s.days || []).forEach(function (r) {
                // `kind` is five segments of the same row, not one key per
                // row, so it calls `add` five times instead of once — the
                // comment above this function still holds: the total is
                // added in the same pass as the parts, so it stays their sum.
                // `r.cost`/`r.tokens` is null for a model `lib/prices.js` has
                // no rate for (or a kept v1 row with no detail); skip it, the
                // same as `r.usd || 0` already does for every other dim.
                if (dim === 'kind') {
                    var src = metric === 'usd' ? r.cost : r.tokens;
                    if (!src) return;
                    KIND_KEYS.forEach(function (k) { add(r.day, k, src[k], r.estimated); });
                    return;
                }
                add(r.day, dimKey(dim, s, r), metric === 'usd' ? r.usd || 0 : tokenSum(r.tokens), metric === 'usd' && r.estimated);
            });
        });
        var list = days.map(function (d) { return at[d]; });
        return {
            days: list, keys: orderKeys(dim, seen), disabled: null,
            max: Math.max.apply(null, list.map(function (b) { return b.total; }).concat([0])),
        };
    }
    // A session counts toward a project's `n` when it spent inside the window
    // or started inside it; one with no transcript has only its start.
    function projectRows(sessions, days) {
        var inside = {}, by = {}, list = [];
        days.forEach(function (d, i) { inside[d] = i + 1; });
        sessions.forEach(function (s) {
            var r = by[s.pkey];
            if (!r) {
                r = by[s.pkey] = { pkey: s.pkey, root: s.root, project: s.project || null, usd: 0, n: 0, last: 0, estimated: false,
                    daily: days.map(function () { return 0; }) };
                list.push(r);
            }
            var touched = false;
            (s.days || []).forEach(function (x) {
                if (!inside[x.day]) return;
                if (x.estimated && x.usd) r.estimated = true;
                r.usd += x.usd || 0;
                r.daily[inside[x.day] - 1] += x.usd || 0;
                touched = true;
            });
            if (touched || inside[localDay(Date.parse(s.started))]) r.n++;
            r.last = Math.max(r.last, s.updated || 0);
        });
        return list.sort(function (a, b) { return b.usd - a.usd || b.last - a.last; });
    }
    // One readout: its label, its value and the line under it.
    function roHtml(l, v, d) {
        return '<div class="ro"><div class="l">' + l + '</div><div class="v">' + v + '</div><div class="d">' + d + '</div></div>';
    }
    function kpiHtml(cur, prev, label) {
        var share = function (t) { return t.main + t.wait ? t.wait / (t.main + t.wait) : 0; };
        var out = '<div class="readouts">'
            + roHtml(label || loc('shared.cost30d', '30 天花費'), usd(cur.usd) + estMark(cur), delta(cur.usd, prev.usd) + (quotaDay() ? ' · ' + loc('shared.quotaCalibrated', '週額度 {d} 校準', { d: quotaDay() }) : ''))
            + roHtml('token', tokens(cur.tokens), delta(cur.tokens, prev.tokens))
            + roHtml(loc('shared.activeTime', 'active 時間'), hours(cur.active), delta(cur.active, prev.active))
            + roHtml('<i class="hatchsw"></i>' + loc('shared.waitShare', '等待佔比'), Math.round(share(cur) * 1000) / 10 + '<span class="u">%</span>',
                (prev.main + prev.wait ? delta(share(cur), share(prev), 'pt') : '<span class="delta flat">' + loc('shared.noPriorData', '前期無資料') + '</span>')
                + ' · ' + loc('shared.waitedFor', '{t} 等', { t: hours(cur.wait) }));
        var top = S.gates && S.gates.swapped && S.gates.swapped.length ? S.gates.swapped[0] : null;
        out += roHtml(loc('shared.mostSwapped', '最常被換掉'), top ? esc(top.label) : '—', top ? top.lost + ' / ' + top.total : '');
        return out + '</div>';
    }
    function spark(values, colour) {
        var W = 120, H = 30, mx = Math.max.apply(null, values.concat([0])) || 1, n = Math.max(values.length - 1, 1);
        return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" aria-hidden="true"><polyline points="'
            + values.map(function (v, i) {
                return (i / n * (W - 4) + 2).toFixed(1) + ',' + (H - 3 - v / mx * (H - 7)).toFixed(1);
            }).join(' ') + '" style="fill:none;stroke:' + colour + ';stroke-width:1.5;stroke-linejoin:round"/></svg>';
    }
    // `ring` circles the stage a live session is in, so a row that is still
    // running reads apart from one that stopped there.
    function routeDots(s, ring) {
        var route = s.route || [], at = route.indexOf(s.stage);
        return '<span class="route" aria-label="route ' + esc(route.join(' → ')) + '">' + route.map(function (k, i) {
            if (i === at && ring) {
                return '<i title="' + esc(loc('shared.stageNow', '{k}（現在）', { k: k })) + '" class="now" style="--c:var(--st-' + esc(k) + ');background:var(--c)"></i>';
            }
            return '<i title="' + esc(k) + '"' + (i <= at ? ' style="background:var(--st-' + esc(k) + ')"' : ' class="todo"') + '></i>';
        }).join('') + '</span>';
    }
    // The stage a row is at, by name and number beside its dots; the dots ring
    // it only while the session is live.
    function stageNow(s) {
        return routeDots(s, s.state === 'live') + '<span class="stname">' + esc(s.stage || '—')
            + (s.steps ? '<span class="of">' + s.step + '/' + s.steps + '</span>' : '') + '</span>';
    }
    // How many of a live row's agents are running this moment — `running` on the
    // list data, counted by lib/station.js from each agent's state. A row that is
    // not live, or has no detail to count from, says nothing rather than a zero
    // nobody measured.
    function runningTag(s) {
        if (s.state !== 'live' || typeof s.running !== 'number') return '';
        return s.running
            ? '<span class="runn" title="' + esc(loc('shared.nRunningNow', '此刻有 {n} 個 agent 是 running', { n: s.running })) + '"><i class="dot live"></i>running ' + s.running + '</span>'
            : '<span class="runn zero" title="' + esc(loc('shared.noneRunningNow', '此刻沒有 agent 是 running')) + '">running 0</span>';
    }
    // `off` maps an option to the reason it cannot be chosen right now.
    function segHtml(key, opts, current, off) {
        return '<div class="seg" role="group" data-seg="' + key + '">' + opts.map(function (o) {
            var why = off && off[o[0]];
            return '<button type="button" data-v="' + esc(o[0]) + '" aria-pressed="' + (current === o[0]) + '"'
                + (why ? ' disabled title="' + esc(why) + '"' : '') + '>' + esc(o[1]) + '</button>';
        }).join('') + '</div>';
    }
    function histSvg(bars, o) {
        if (bars.disabled) return '<p class="note">' + esc(bars.disabled) + '</p>';
        var W = 1200, H = 318, L = 52, R = 4, T = 26, AX = 48, plotH = H - T - AX, base = T + plotH;
        var n = bars.days.length || 1, slot = (W - L - R) / n, bw = Math.min(24, slot * 0.6);
        var top = niceTop(bars.max), y = function (v) { return v / top * plotH; }, pal = paletteOf(bars, o);
        var out = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="'
            + loc('shared.dailyOverDays', '近 {n} 天每日{metric}，{dim}', { n: n, metric: METRIC_LABEL[o.metric], dim: DIM_LABEL[o.dim] }) + '">';
        [0, 0.25, 0.5, 0.75, 1].forEach(function (f) {
            var yy = (base - f * plotH).toFixed(1);
            out += '<line class="' + (f ? 'gridl' : 'base') + '" x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '"/>'
                + '<text class="tick" x="' + (L - 10) + '" y="' + (Number(yy) + 4) + '" text-anchor="end">'
                + metricText(o.metric, top * f, true) + '</text>';
        });
        bars.days.forEach(function (b, i) {
            var cx = (L + i * slot + slot / 2).toFixed(1), x0 = (L + i * slot + slot / 2 - bw / 2).toFixed(1);
            var c = 0, open = b.day === o.sel, mark = open || b.day === o.today;
            var href = open ? '#/' : '#/d/' + b.day;
            var label = loc('shared.dayTotal', '{day} 合計 {total}', { day: b.day, total: metricText(o.metric, b.total, false, b.estimated) })
                + bars.keys.filter(function (k) { return b.parts[k]; })
                    .map(function (k) { return loc('shared.dayTotalSeg', '；{key} {v}', { key: keyLabel(o.dim, k, o.names), v: metricText(o.metric, b.parts[k], false, partEst(b, k)) }); }).join('');
            // The column's hit area goes first, so every segment drawn after it
            // sits on top and takes the hover itself.
            out += '<rect class="hit" data-href="' + href + '" data-day="' + b.day + '" data-cx="' + cx + '" x="' + (L + i * slot).toFixed(1)
                + '" y="' + (T - 10) + '" width="' + slot.toFixed(1) + '" height="' + (plotH + AX) + '" aria-label="' + esc(label) + '"/>';
            out += '<g class="bar"' + (o.sel && !open ? ' style="opacity:.36"' : '') + '>';
            bars.keys.forEach(function (k) {
                if (!b.parts[k]) return;
                var h = y(b.parts[k]);
                out += '<rect class="hseg" data-day="' + b.day + '" data-key="' + esc(k) + '" data-cx="' + cx + '" data-href="' + href
                    + '" x="' + x0 + '" y="' + (base - c - h).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="'
                    + Math.max(h - 1, 0.5).toFixed(1) + '" style="fill:' + colorOf(o.dim, k, pal) + '"/>';
                c += h;
            });
            out += '</g>'
                + (b.total ? '<text class="tick" x="' + cx + '" y="' + (base - c - 7).toFixed(1) + '" text-anchor="middle">'
                    + metricText(o.metric, b.total, true, b.estimated) + '</text>' : '')
                + '<text class="tick" x="' + cx + '" y="' + (base + 17) + '" text-anchor="middle"'
                + (mark ? ' style="fill:var(--ink);font-weight:600"' : '') + '>' + Number(b.day.slice(8)) + '</text>'
                + (b.day === o.today || b.day.slice(8) === '01' || i === 0
                    ? '<text x="' + cx + '" y="' + (base + 33) + '" text-anchor="middle">'
                    + (b.day === o.today ? loc('shared.today', '今天') : loc('shared.monthN', '{n}月', { n: Number(b.day.slice(5, 7)) })) + '</text>' : '');
        });
        return out + '<line class="hguide" x1="0" x2="0" y1="' + T + '" y2="' + base + '"/></svg>';
    }
    // The order `colorOf` ranks a palette dim by, with the keys in `o.off`
    // taken out first — so what the filter leaves is ranked, and coloured,
    // afresh. With nothing off it is the list the chart always used.
    function paletteOf(bars, o) {
        var off = o.off || {};
        return ((o.dim === 'version' || o.dim === 'model' || o.dim === 'type') ? bars.keys : o.pkeys || []).filter(function (k) { return !off[k]; });
    }
    // The shown keys that get a legend entry of their own; the rest share
    // 其他 N 個. Pass an `o` without `off` for the unfiltered grouping.
    function legendOwn(bars, o) {
        var off = o.off || {}, rank = paletteOf(bars, o);
        var keys = bars.keys.filter(function (k) { return !off[k]; });
        return (o.dim !== 'project' && o.dim !== 'version') ? keys : keys.filter(function (k) {
            if (o.dim === 'version' && k === 'none') return true;
            var i = rank.indexOf(k);
            return i >= 0 && i < 5;
        });
    }
    // The shown keys folded into 其他 N 個.
    function legendRest(bars, o) {
        var off = o.off || {}, own = legendOwn(bars, o);
        return bars.keys.filter(function (k) { return !off[k] && own.indexOf(k) < 0; });
    }
    // A project's label is `<root tail> / <project>`, and a root tail can be a
    // long path: the legend shows the part after the last ` / `, or else the
    // last path segment, and leaves the whole label to the entry's title.
    function shortLabel(full) {
        var s = String(full), i = s.lastIndexOf(' / ');
        if (i >= 0) return s.slice(i + 3);
        var parts = s.split(/[\\/]/).filter(Boolean);
        return parts.length > 1 ? parts[parts.length - 1] : s;
    }
    // The order hint's tooltip is the SVG's own <title>, so the legend's only
    // span with a title stays an entry that needs one.
    var ICON_ORDER = '<svg viewBox="0 0 12 12" width="12" height="12" role="img" aria-label="' + loc('shared.bottomUp', '由下而上')
        + '"><title>' + loc('shared.bottomUpHint', '由下而上：列在前面的疊在最底下') + '</title>'
        + '<path d="M6 10.5V2M3 4.8 6 1.8l3 3"'
        + ' fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var ICON_FUNNEL = '<svg viewBox="0 0 14 14" width="13" height="13" aria-hidden="true"><path d="M1.8 2.5h10.4L8.3 7.2v3.9l-2.6 1.3V7.2z"'
        + ' fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>';
    // `o.off` is the set of keys clicked out of the chart. The legend is the
    // chart after the filter — its own entries and 其他 re-ranked from what is
    // shown — plus, dimmed and `data-off`, each hidden key that had an entry
    // unfiltered, so a click can put it back. 其他 whose members are all hidden
    // stays as one dimmed entry that puts them back.
    function legendHtml(bars, o) {
        if (bars.disabled) return '';
        var off = o.off || {}, base = { dim: o.dim, pkeys: o.pkeys };
        var vis = legendOwn(bars, o), rest = legendRest(bars, o), own0 = legendOwn(bars, base);
        var gone0 = legendRest(bars, base).filter(function (k) { return off[k]; });
        var own = bars.keys.filter(function (k) { return vis.indexOf(k) >= 0 || (off[k] && own0.indexOf(k) >= 0); });
        var pal = paletteOf(bars, o), pal0 = paletteOf(bars, base);
        var full = own.map(function (k) { return keyLabel(o.dim, k, o.names); });
        var short = full.map(shortLabel);
        return '<span class="lord">' + ICON_ORDER + '</span>' + own.map(function (k, i) {
            var hint = keyHint(o.dim, k);
            // A short form only where it names one series alone; a label that
            // is shortened, or long anyway, is clipped and carries its whole self.
            var s = short.filter(function (x) { return x === short[i]; }).length > 1 ? full[i] : short[i];
            var cut = s !== full[i] || s.length > 20;
            var title = [cut ? full[i] : '', hint].filter(Boolean).join('\n');
            return '<span data-key="' + esc(k) + '"' + (title ? ' title="' + esc(title) + '"' : '') + (off[k] ? ' data-off' : '')
                + '><i class="sw" style="background:'
                + colorOf(o.dim, k, off[k] ? pal0 : pal) + '"></i>'
                + (cut ? '<span class="lt">' + esc(s) + '</span>' : esc(s)) + '</span>';
        }).join('') + (rest.length
            ? '<span data-rest><i class="sw" style="background:var(--p-5)"></i>' + loc('shared.othersN', '其他 {n} 個', { n: rest.length }) + '</span>'
            : gone0.length ? '<span data-rest data-off><i class="sw" style="background:var(--p-5)"></i>' + loc('shared.othersN', '其他 {n} 個', { n: gone0.length }) + '</span>' : '');
    }
    // The 篩選 panel: every series one checkbox, grouped the unfiltered way so
    // the list holds still while boxes are ticked; a swatch is the colour the
    // chart draws that series in now, or its unfiltered one while it is off.
    function filterHtml(bars, o) {
        if (bars.disabled || !bars.keys.length) return '';
        var off = o.off || {}, base = { dim: o.dim, pkeys: o.pkeys }, own = legendOwn(bars, base), rest = legendRest(bars, base);
        var pal = paletteOf(bars, o), pal0 = paletteOf(bars, base), n = bars.keys.filter(function (k) { return off[k]; }).length;
        var row = function (k) {
            return '<label><input type="checkbox" data-fk="' + esc(k) + '"' + (off[k] ? '' : ' checked') + '><i class="sw" style="background:'
                + colorOf(o.dim, k, off[k] ? pal0 : pal) + '"></i><span title="' + esc(keyLabel(o.dim, k, o.names)) + '">'
                + esc(keyLabel(o.dim, k, o.names)) + '</span></label>';
        };
        return '<div class="fwrap"><button type="button" class="fbtn" data-fbtn aria-haspopup="true" aria-expanded="' + !!o.panel + '"'
            + ' aria-label="' + loc('shared.filter', '篩選') + (n ? loc('shared.filterShownOf', '：顯示 {shown} / {total}', { shown: bars.keys.length - n, total: bars.keys.length }) : '')
            + '" title="' + loc('shared.filterSeriesHint', '篩選圖表的系列') + '">' + ICON_FUNNEL
            + (n ? '<b>' + (bars.keys.length - n) + '/' + bars.keys.length + '</b>' : '') + '</button>'
            + (o.panel ? '<div class="fpanel" role="group" aria-label="' + loc('shared.whichShown', '圖表顯示哪些') + '">'
                + '<div class="fall"><button type="button" data-fall="on">' + loc('shared.selectAll', '全選') + '</button><button type="button" data-fall="off">' + loc('shared.selectNone', '全不選') + '</button></div>'
                + own.map(row).join('')
                + (rest.length ? '<div class="fsub">' + loc('shared.othersN', '其他 {n} 個', { n: rest.length }) + '</div>' + rest.map(row).join('') : '')
                + '</div>' : '') + '</div>';
    }
    // The bars with the clicked-out series taken away: each day's total and
    // the max are summed again from what is left, so the axis fits the rest.
    // `keys` stays whole — the stacking order — and the colours come from
    // `paletteOf`, which ranks what is left.
    function visibleBars(bars, o) {
        var off = o.off || {};
        var gone = function (k) { return off[k]; };
        if (bars.disabled || !bars.keys.some(gone)) return bars;
        var list = bars.days.map(function (b) {
            var parts = {}, total = 0;
            Object.keys(b.parts).forEach(function (k) { if (!gone(k)) { parts[k] = b.parts[k]; total += b.parts[k]; } });
            return { day: b.day, total: total, parts: parts };
        });
        return { days: list, keys: bars.keys, disabled: null,
            max: Math.max.apply(null, list.map(function (b) { return b.total; }).concat([0])) };
    }
    // The hover card for one column of the 30-day chart: the day, the segment
    // under the pointer (none when the pointer is on the column's empty part),
    // every segment of that day top-down as stacked, and the day's total.
    function segTip(bars, o, day, key) {
        var b = null;
        bars.days.forEach(function (d) { if (d.day === day) b = d; });
        if (!b) return '';
        var pk = paletteOf(bars, o);
        var sw = function (k) { return '<i class="sw" style="background:' + colorOf(o.dim, k, pk) + '"></i>'; };
        var pct = function (v) { return b.total ? Math.round(v / b.total * 100) + '%' : '—'; };
        var keys = bars.keys.filter(function (k) { return b.parts[k]; });
        return '<div class="tt-day">' + esc(day) + (day === o.today ? ' · ' + loc('shared.today', '今天') : '') + '</div>'
            + (key && b.parts[key]
                ? '<div class="tt-main">' + sw(key) + '<b>' + esc(keyLabel(o.dim, key, o.names)) + '</b></div>'
                    + '<div class="tt-val"><b>' + metricText(o.metric, b.parts[key], false, partEst(b, key)) + '</b><span>' + loc('shared.dayShare', '當天的 {p}', { p: pct(b.parts[key]) }) + '</span></div>'
                : '')
            + '<ul class="tt-list">' + keys.reverse().map(function (k) {
                return '<li' + (k === key ? ' data-hot' : '') + '>' + sw(k) + '<span>' + esc(keyLabel(o.dim, k, o.names))
                    + '</span><span class="tt-n">' + metricText(o.metric, b.parts[k], false, partEst(b, k)) + '</span></li>';
            }).join('') + '</ul>'
            + '<div class="tt-sum">' + loc('shared.dayTotalLabel', '當天合計') + ' <b>' + metricText(o.metric, b.total, false, b.estimated) + '</b></div>';
    }
    function projectsHtml(rows, o) {
        return '<div class="h2">' + icon('projects') + loc('shared.projectsHeading', '專案 <small>近 30 天</small>') + '</div>'
            + '<div class="projrow head"><span>' + loc('shared.thProject', '專案') + '</span><span>' + loc('shared.thDailyCost', '每日花費') + '</span><span class="r">' + loc('shared.cost', '花費') + '</span><span class="r">session</span>'
            + '<span class="r">' + loc('shared.thLastActivity', '最後活動') + '</span></div>'
            + (rows.length ? rows.map(function (r) {
                var c = colorOf('project', r.pkey, o.pkeys);
                return '<a class="projrow" href="' + projectHash(r.pkey) + '"><span style="min-width:0"><span class="nm"><i class="sw" style="background:'
                    + c + '"></i>' + esc(o.names[r.pkey] || r.pkey) + '</span><span class="pth mono">' + esc(r.pkey) + '</span></span>'
                    + '<span>' + spark(r.daily, c) + '</span><span class="r">' + usd(r.usd, true) + estMark(r) + '</span><span class="r">' + r.n + '</span>'
                    + '<span class="r muted">' + ago(r.last) + '</span></a>';
            }).join('') : '<p class="note">' + loc('shared.machineNoSessions', '這台機器上沒有 session') + '</p>');
    }
    // 最近 sessions (`#/sessions`): the film's header lockup — the title, a
    // rule, the counts, `tabs` (the Sessions tab strip) and 看全部 on the
    // right — over one line a row. A stage on the row's route is the film's
    // glyph and `0N / 0M stage`; one the route does not name keeps its dots
    // and its name (`stageNow`).
    function recentHtml(list, o, tabs) {
        var live = list.filter(function (s) { return s.state === 'live'; }).length;
        return '<div class="phead khead" data-block="sessions-head"><h1>' + icon('sessions') + loc('shared.recentSessions', '最近 sessions') + '</h1>'
            + '<p class="kcap"><span>' + loc('shared.capSessions', '<b>{n}</b>個 session', { n: list.length }) + '</span>'
            + '<span>' + loc('shared.capLive', '<b>{n}</b>個 live', { n: live }) + '</span>'
            + '<span>' + loc('shared.capByLast', '依最後動作，最新在上') + '</span></p>'
            + '<span class="spacer"></span>' + (tabs || '') + '<a class="btn" href="#/list">' + loc('shared.seeAll', '看全部 →') + '</a></div>'
            + '<section class="panel ksess" data-block="sessions"><div class="tbl-wrap"><table class="t">'
            + '<colgroup><col><col style="width:150px"><col style="width:200px"><col style="width:84px"><col style="width:72px"><col style="width:168px"></colgroup>'
            + '<thead><tr><th>' + loc('shared.thTask', '任務') + '</th><th>' + loc('shared.thProject', '專案') + '</th><th>stage</th><th class="r">' + loc('shared.cost', '花費') + '</th>'
            + '<th class="r">token</th><th>' + loc('shared.thState', '狀態') + '</th></tr></thead><tbody>'
            + list.map(function (s) {
                var t = sessionTotals(s);
                return '<tr class="link" data-href="' + sessionHash(s.id) + '"><td class="task"><a href="' + sessionHash(s.id) + '" title="' + esc(s.task || '') + '">'
                    + esc(s.task || loc('shared.unnamed', '（未命名）')) + '</a></td><td><span class="pchip"><i class="sw" style="background:'
                    + colorOf('project', s.pkey, o.pkeys) + '"></i>' + esc(o.names[s.pkey] || s.pkey) + '</span></td>'
                    + '<td class="c-stage">' + (keelStage(s) ? '<span class="kstage">' + keelProgress(s) + keelStage(s) + '</span>' : stageNow(s)) + '</td>'
                    + '<td class="r">' + usd(t.usd) + estMark(t) + '</td><td class="r muted">' + tokens(t.tokens) + '</td>'
                    + '<td class="c-state">' + statePill(s) + runningTag(s) + '</td></tr>';
            }).join('') + '</tbody></table></div></section>';
    }
    // 導覽: the tour's own page in a frame. It is served from the plugin's
    // assets (scripts/station.js STATIC); the written file has no server.
    function tourPage(serve) {
        if (serve) return '<div class="tour" data-block="tour"><iframe class="tour-frame" src="station/tour.html" title="' + loc('shared.tourTitle', 'fankeel 導覽') + '"></iframe></div>';
        return '<section class="panel" data-block="tour"><p class="note">' + loc('shared.tourNeedsServe', '導覽要從 serve 開的頁面看：輸入 <code class="mono">/fankeel-station</code>，從它印出的網址開 <span class="mono">#/tour</span>。') + '</p></section>';
    }

    // ---- the project page -------------------------------------------------
    function dayStart(day) {
        return new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))).getTime();
    }
    function projectHead(sessions, pkey, days) {
        var mine = sessions.filter(function (s) { return s.pkey === pkey; });
        var t = windowTotals(mine, days), row = projectRows(mine, days)[0];
        return { pkey: pkey, usd: t.usd, estimated: t.estimated, tokens: t.tokens, active: t.active, n: row ? row.n : 0 };
    }
    // A session's whole spend, at the moment it started.
    function sessionPoints(sessions, metric, t0, t1) {
        return sessions.map(function (s) {
            var t = sessionTotals(s);
            return { id: s.id, task: s.task, t: Date.parse(s.started), v: metric === 'usd' ? t.usd : t.tokens, estimated: metric === 'usd' && t.estimated };
        }).filter(function (p) { return p.t >= t0 && p.t < t1; }).sort(function (a, b) { return a.t - b.t; });
    }
    // The 對照專案 line is a second series on the same axes, not a second chart.
    function projectChart(series, o) {
        var W = 1200, H = 340, L = 60, R = 24, T = 16, AX = 40, plotH = H - T - AX, base = T + plotH;
        var X = function (t) { return (L + (t - o.t0) / ((o.t1 - o.t0) || 1) * (W - L - R)).toFixed(1); };
        var all = [0];
        series.forEach(function (s) { s.points.forEach(function (p) { all.push(p.v); }); });
        var top = niceTop(Math.max.apply(null, all));
        var Y = function (v) { return (base - v / top * plotH).toFixed(1); };
        var out = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + loc('proj.perSessionByStart', '每個 session 的{metric}，依開始時間', { metric: METRIC_LABEL[o.metric] }) + '">';
        [0, 0.25, 0.5, 0.75, 1].forEach(function (f) {
            out += '<line class="' + (f ? 'gridl' : 'base') + '" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(top * f) + '" y2="' + Y(top * f) + '"/>'
                + '<text class="tick" x="' + (L - 10) + '" y="' + (Number(Y(top * f)) + 4) + '" text-anchor="end">' + metricText(o.metric, top * f, true) + '</text>';
        });
        o.days.forEach(function (d, i) {
            var x = X(dayStart(d) + 432e5);
            if (i % 2 === 0 || d === o.today) out += '<text class="tick" x="' + x + '" y="' + (base + 17) + '" text-anchor="middle">' + Number(d.slice(8)) + '</text>';
            if (d === o.today || d.slice(8) === '01' || i === 0) {
                out += '<text x="' + x + '" y="' + (base + 33) + '" text-anchor="middle">' + (d === o.today ? loc('proj.today', '今天') : loc('proj.monthN', '{n}月', { n: Number(d.slice(5, 7)) })) + '</text>';
            }
        });
        series.forEach(function (s) {
            if (!s.points.length) return;
            out += '<polyline points="' + s.points.map(function (p) { return X(p.t) + ',' + Y(p.v); }).join(' ')
                + '" style="fill:none;stroke:' + s.colour + ';stroke-width:2;stroke-linejoin:round"/>';
            s.points.forEach(function (p) {
                out += '<circle class="hit" data-href="' + sessionHash(p.id) + '" cx="' + X(p.t) + '" cy="' + Y(p.v) + '" r="5" style="fill:'
                    + s.colour + ';stroke:var(--panel);stroke-width:2"><title>' + esc(s.name + ' · ' + (p.task || p.id) + ' · ' + stamp(p.t)
                    + ' · ' + metricText(o.metric, p.v, false, p.estimated)) + '</title></circle>';
            });
        });
        return out + '</svg>';
    }
    function miniMix(models, est) {
        var keys = MODEL_KEYS.filter(function (k) { return models[k] > 0; });
        var tot = keys.reduce(function (n, k) { return n + models[k]; }, 0);
        if (!tot) return '<span class="muted">—</span>';
        return '<span class="mini-mix" title="' + keys.map(function (k) { return k + ' ' + usd(models[k]) + estMark({ estimated: est && est[k] }); }).join(loc('proj.listSep', '、')) + '">'
            + keys.map(function (k) {
                return '<i style="width:' + (models[k] / tot * 100).toFixed(2) + '%;background:var(--m-' + k + ')"></i>';
            }).join('') + '</span>';
    }
    function projectSessionsHtml(list, picked) {
        if (!list.length) return '<p class="note">' + loc('proj.noSessions30d', '這個專案近 30 天沒有 session') + '</p>';
        return '<div class="tbl-wrap"><table class="t"><thead><tr><th aria-label="' + loc('proj.pickToCompare', '選來比較') + '"></th><th>' + loc('proj.thTask', '任務') + '</th><th>' + loc('proj.thStart', '開始') + '</th>'
            + '<th class="r">' + loc('proj.thDuration', '時長') + '</th><th>' + loc('proj.thStageProgress', 'stage 進度') + '</th><th class="r">' + loc('proj.thCost', '花費') + '</th><th class="r">token</th><th>' + loc('proj.thModelMix', 'model 組成') + '</th></tr></thead><tbody>'
            + list.map(function (s) {
                var t = sessionTotals(s), started = Date.parse(s.started);
                return '<tr class="link" data-href="' + sessionHash(s.id) + '"><td><input type="checkbox" data-cmp="' + esc(s.id)
                    + '" aria-label="' + loc('proj.pickToCompare', '選來比較') + '"' + (picked.indexOf(s.id) >= 0 ? ' checked' : '')
                    + (s.hasDetail ? '' : ' disabled title="' + loc('proj.noTranscriptToCompare', '沒有 transcript，沒有細節可比') + '"') + '></td>'
                    + '<td class="task"><a href="' + sessionHash(s.id) + '">' + esc(s.task || loc('proj.unnamed', '（未命名）')) + '</a></td>'
                    + '<td class="muted">' + stamp(started) + '</td><td class="r">' + mins((s.updated || started) - started) + '</td>'
                    + '<td>' + routeDots(s) + ' <span class="muted">' + esc(s.stage || '—') + '</span></td>'
                    + '<td class="r">' + usd(t.usd) + estMark(t) + '</td><td class="r muted">' + tokens(t.tokens) + '</td><td>' + miniMix(t.models, t.estModels) + '</td></tr>';
            }).join('') + '</tbody></table></div>';
    }

    // ---- the session page -------------------------------------------------
    function clock(ms) { var d = new Date(ms); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
    // One real time axis, from the first stage step to the last request: a
    // stage is as wide as it lasted, a wait is the gap between a gate's question
    // and its answer, an agent runs from launch to return.
    function timelineModel(x) {
        var pts = (x.points || []).filter(function (p) { return isFinite(p.t); });
        var seq = x.seq || [], rows = x.rows || [], bars = [];
        var t0 = seq.length ? seq[0].at : pts.length ? pts[0].t : NaN;
        var t1 = pts.length ? pts[pts.length - 1].t : t0;
        var agent = function (r, kind, key, ret) {
            return { kind: kind, key: key, label: r.label || r.id, model: r.model, from: r.from, to: r.to,
                tokens: (r.k || 0) * 1000, cents: r.c || 0, ret: ret, estimated: (r.estimated || []).length > 0 };
        };
        (x.dispatches || []).forEach(function (d, i) {
            var kids = rows.filter(function (r) { return r.disp === i; });
            if (d.surface !== 'workflow') {
                kids.forEach(function (r) { bars.push(agent(r, 'agent', r.id, d.ret)); });
                return;
            }
            bars.push({ kind: 'wf', key: 'wf-' + i, label: d.text, model: null, from: d.out, to: d.back, ret: d.ret, n: kids.length,
                tokens: kids.reduce(function (n, r) { return n + (r.k || 0); }, 0) * 1000,
                cents: kids.reduce(function (n, r) { return n + (r.c || 0); }, 0),
                estimated: kids.some(function (r) { return (r.estimated || []).length > 0; }) });
            kids.forEach(function (r) { bars.push(agent(r, 'kid', 'wf-' + i, null)); });
        });
        rows.filter(function (r) { return r.disp === null; }).forEach(function (r) { bars.push(agent(r, 'agent', r.id, null)); });
        return {
            t0: t0, t1: t1, points: pts, bars: bars,
            segs: seq.map(function (m, i) { return { stage: m.stage, from: m.at, to: i + 1 < seq.length ? seq[i + 1].at : t1 }; })
                .filter(function (g) { return g.to > g.from; }),
            waits: (x.waits || []).map(function (w) {
                return { stage: w.stage, from: w.askedAt, to: w.answeredAt, ms: w.answeredAt - w.askedAt };
            }),
            ticks: pts.map(function (p) { return { t: p.t, family: family(p.model) }; }),
            rets: (x.dispatches || []).filter(function (d) { return isFinite(d.back) && d.ret !== null && d.ret !== undefined; })
                .map(function (d) { return { t: d.back, chars: d.ret }; }),
            rises: x.rises || [],
        };
    }
    // Roughly how wide a label is: a CJK glyph is about the font size, the rest
    // about half of it. Close enough to keep two labels apart, which is all it
    // is for — nothing here measures text, and a browser is the only thing that
    // could.
    function textW(s, size) {
        var n = 0;
        for (var i = 0; i < s.length; i++) n += s.charCodeAt(i) > 0x2e7f ? size : size * 0.55;
        return n;
    }
    // Labels along one axis, asked in the order they are drawn: a label is kept
    // only where it clears the last one kept. A dense session put a dozen of
    // them on the same pixels and none of the dozen could be read.
    function labelRoom() {
        var last = -1e9;
        return function (left, right) {
            if (left < last + 4) return false;
            last = right;
            return true;
        };
    }
    function timelineSvg(m, closed, hi) {
        if (!(m.t1 > m.t0)) return '<p class="note">' + loc('ses.noTimedRequests', '這個 session 沒有帶時間的 request，畫不出時間線') + '</p>';
        var shown = m.bars.filter(function (b) { return b.kind !== 'kid' || !closed[b.key]; });
        // One picture on one time axis, top to bottom: the stage names over
        // their columns, the context curve drawn across those columns on its
        // own token axis, the waits' lengths, a tick per request, then a row
        // per agent. A stage is a tinted column as wide as it lasted; a wait is
        // hatched through everything below the clock.
        var W = 1200, G = 160, R = 18, RH = 26, sl = 30, ctx0 = 56, ctxH = 160, ctxB = ctx0 + ctxH;
        var wl = ctxB + 15, rq0 = wl + 8, rqH = 14, d0 = rq0 + rqH + 26;
        var H = d0 + Math.max(1, shown.length) * RH + 34, bottom = H - 26;
        var X = function (t) { return G + (Math.min(Math.max(t, m.t0), m.t1) - m.t0) / (m.t1 - m.t0) * (W - G - R); };
        var ctop = niceTop(Math.max.apply(null, m.points.map(function (p) { return p.y; }).concat([1])));
        var Yc = function (v) { return ctxB - v / ctop * ctxH; };
        var yAt = function (t) { var y = 0; m.points.forEach(function (p) { if (p.t <= t) y = p.y; }); return y; };
        var segAt = function (t) { var g = null; m.segs.forEach(function (x) { if (x.from <= t) g = x; }); return g; };
        var f1 = function (n) { return n.toFixed(1); };
        // A bar's label sits to its right, and at the end of a session there is
        // no right left: one that would run past the edge takes the space on the
        // left instead, and stays on the right when the left is narrower still.
        var barLabel = function (x0, x1, y, text) {
            var w = textW(text, 11.5), left = x1 + 8 + w > W - R && x0 - 8 - w >= 0;
            return '<text x="' + f1(left ? x0 - 8 : x1 + 8) + '" y="' + y + '"' + (left ? ' text-anchor="end"' : '')
                + ' style="font-size:11.5px;fill:var(--ink2)">' + esc(text) + '</text>';
        };
        var out = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + loc('ses.timelineLabel', 'session 時間線') + '"' + (hi ? ' data-hi' : '') + '><defs>'
            + '<pattern id="hw" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)">'
            + '<rect width="5" height="5" style="fill:var(--hatch-bg)"/><rect width="1.4" height="5" style="fill:var(--hatch)"/></pattern></defs>'
            + '<text x="' + G + '" y="16" style="fill:var(--ink);font-weight:600">' + clock(m.t0) + '</text>'
            + '<text x="' + (W - R) + '" y="16" text-anchor="end" style="fill:var(--ink);font-weight:600">' + clock(m.t1) + '</text>'
            + '<text class="tick" x="' + (W - R) + '" y="' + (H - 8) + '" text-anchor="end">' + loc('ses.totalMins', '共 {t}', { t: mins(m.t1 - m.t0) }) + '</text>';
        // The gutter's lane names stay clear of the token ticks, which end
        // 8px left of G and are at most five characters wide.
        out += '<text class="lane-l" x="0" y="' + (sl + 13) + '">stage</text>'
            + '<text class="lane-l" x="0" y="' + (ctx0 + 10) + '">' + loc('ses.mainSessionContext', '主 session context') + '</text>'
            + '<text class="lane-s" x="0" y="' + (ctx0 + 26) + '">' + loc('ses.tokenAgentReturn', 'token；◆ 是 agent 回傳') + '</text>';
        // The stage columns first, so everything else draws over them.
        var stRoom = labelRoom();
        m.segs.forEach(function (g) {
            var x0 = X(g.from), w = Math.max(X(g.to) - x0, 0.5), c = colorOf('stage', g.stage);
            var text = g.stage + ' ' + mins(g.to - g.from) + (isFinite(g.usd) && g.usd ? ' · ' + usd(g.usd) + estMark(g) : ''), lw = textW(g.stage, 11.5) + 12;
            out += '<rect class="seg" x="' + f1(x0) + '" y="' + sl + '" width="' + f1(w) + '" height="' + (ctxB - sl) + '"'
                + (hi === g.stage ? ' data-on' : '') + ' style="fill:' + c + '"><title>' + esc(text) + '</title></rect>'
                + '<rect class="segcap" x="' + f1(x0) + '" y="' + sl + '" width="' + f1(w) + '" height="3" style="fill:' + c + '"/>'
                + '<line class="segl" x1="' + f1(x0) + '" x2="' + f1(x0) + '" y1="' + sl + '" y2="' + ctxB + '" style="stroke:' + c + '"/>'
                + (w > lw && stRoom(x0 + 6, x0 + 6 + lw)
                    ? '<text class="segn" x="' + f1(x0 + 6) + '" y="' + (sl + 16) + '" style="fill:' + c + '">' + esc(g.stage)
                        + (w > lw + textW(mins(g.to - g.from), 10.5) + 8 ? '<tspan class="segd"> ' + mins(g.to - g.from) + '</tspan>' : '') + '</text>'
                    : '');
        });
        m.waits.forEach(function (w) {
            out += '<rect class="wait" x="' + f1(X(w.from)) + '" y="' + (sl - 6) + '" width="' + f1(Math.max(X(w.to) - X(w.from), 1))
                + '" height="' + (bottom - sl + 6) + '" style="fill:url(#hw);opacity:.38"/>';
        });
        var step = niceStep(ctop);
        for (var gv = 0; gv <= ctop; gv += step) {
            out += '<line class="' + (gv ? 'gridl' : 'base') + '" x1="' + G + '" x2="' + (W - R) + '" y1="' + f1(Yc(gv)) + '" y2="' + f1(Yc(gv)) + '"/>'
                + '<text class="tick" x="' + (G - 8) + '" y="' + f1(Yc(gv) + 4) + '" text-anchor="end">' + tokens(gv) + '</text>';
        }
        if (m.points.length) {
            out += '<path d="' + m.points.map(function (p, i) { return (i ? 'L' : 'M') + f1(X(p.t)) + ',' + f1(Yc(p.y)); }).join('')
                + '" style="fill:none;stroke:var(--ctx);stroke-width:2;stroke-linejoin:round"/>';
        }
        // The five largest rises, numbered as the list under the chart numbers them.
        (m.rises || []).forEach(function (r, i) {
            if (!isFinite(r.t)) return;
            out += '<g class="rb"><circle r="7" cx="' + f1(X(r.t)) + '" cy="' + f1(Yc(r.y1)) + '"/><text x="' + f1(X(r.t)) + '" y="'
                + f1(Yc(r.y1) + 3) + '" text-anchor="middle">' + (i + 1) + '</text></g>';
        });
        // A wait's length, under the curve where no stage name competes with it.
        var waitRoom = labelRoom();
        m.waits.forEach(function (w) {
            var x0 = X(w.from), wd = Math.max(X(w.to) - x0, 1);
            var lab = loc('ses.waitedMins', '等 {t}', { t: mins(w.ms) }), lw = textW(lab, 11);
            // Centred on the band, except where that would hang off an edge: the
            // last wait of a session sits against the right margin.
            var cx = Math.min(x0 + wd / 2, W - R - lw / 2);
            out += '<rect class="waitst" x="' + f1(x0) + '" y="' + ctx0 + '" width="' + f1(wd) + '" height="' + ctxH
                + '" style="fill:url(#hw)"><title>' + esc(lab) + '</title></rect>'
                + (waitRoom(cx - lw / 2, cx + lw / 2)
                    ? '<text x="' + f1(cx) + '" y="' + wl + '" text-anchor="middle" style="font-size:11px;fill:var(--ink);font-weight:500">'
                        + lab + '</text>'
                    : '');
        });
        out += '<text class="lane-l" x="0" y="' + (rq0 + 11) + '">' + loc('ses.mainSessionRequests', '主 session 請求') + '</text><text class="lane-s" x="0" y="' + (rq0 + 25) + '">'
            + loc('ses.nTimesColorModel', '{n} 次，顏色 = model', { n: m.ticks.length }) + '</text>';
        m.ticks.forEach(function (q) {
            out += '<rect class="rq" x="' + f1(X(q.t) - 0.75) + '" y="' + rq0 + '" width="1.5" height="' + rqH + '" style="fill:var(--m-' + q.family + ')"/>';
        });
        // The reading under the pointer: a column per point (at most 240, the
        // peak kept), from halfway to the one before to halfway to the next.
        var hp = downsample(m.points, 240);
        hp.forEach(function (p, i) {
            var x = X(p.t), a = i ? (X(hp[i - 1].t) + x) / 2 : G, b = i + 1 < hp.length ? (x + X(hp[i + 1].t)) / 2 : W - R;
            var g = segAt(p.t);
            out += '<rect class="hitc" x="' + f1(a) + '" y="' + sl + '" width="' + f1(Math.max(b - a, 1)) + '" height="' + (rq0 + rqH - sl) + '"'
                + (g ? ' data-hist="' + esc(g.stage) + '"' : '') + '><title>'
                + esc((g ? g.stage : '—') + ' · ' + stamp(p.t) + ' · context ' + comma(p.y) + ' tokens'
                    + (p.model ? ' · ' + String(p.model).replace(/^claude-/, '') : '')
                    + (g && isFinite(g.usd) && g.usd ? ' · ' + loc('ses.thisStageCost', '這段 stage {v}', { v: usd(g.usd) + estMark(g) }) : '')) + '</title></rect>';
        });
        // The returns go over the reading columns, so each keeps its own title.
        var retRoom = labelRoom();
        m.rets.forEach(function (q) {
            var x = X(q.t), y = Yc(yAt(q.t));
            var lab = loc('ses.plusChars', '+{c} 字元', { c: q.chars >= 1000 ? (q.chars / 1000).toFixed(1) + 'k' : q.chars }), lw = textW(lab, 10.5);
            // It ends 9px left of its mark, unless that would run into the
            // token ticks left of G: then it starts 9px right of it instead.
            var right = x - 9 - lw < G + 2, lx = right ? x + 9 : x - 9;
            out += '<path d="M' + f1(x) + ' ' + f1(y - 6) + ' ' + f1(x + 6) + ' ' + f1(y) + ' ' + f1(x) + ' ' + f1(y + 6) + ' ' + f1(x - 6) + ' ' + f1(y)
                + 'Z" style="fill:var(--ink);stroke:var(--panel);stroke-width:2"><title>' + esc(lab) + '</title></path>'
                + (retRoom(right ? lx : lx - lw, right ? lx + lw : lx)
                    ? '<text x="' + f1(lx) + '" y="' + f1(y - 9) + '"' + (right ? '' : ' text-anchor="end"')
                        + ' style="font-size:10.5px;fill:var(--ink2)">' + lab + '</text>'
                    : '');
        });
        out += '<line class="base" x1="0" x2="' + (W - R) + '" y1="' + (d0 - 10) + '" y2="' + (d0 - 10) + '"/>';
        if (!shown.length) out += '<text class="lane-s" x="' + G + '" y="' + (d0 + 16) + '">' + loc('ses.noAgentsDispatched', '這個 session 沒有派出 agent 或 workflow') + '</text>';
        shown.forEach(function (b, i) {
            var y = d0 + i * RH, ok = isFinite(b.from) && isFinite(b.to);
            var x0 = ok ? X(b.from) : G, x1 = ok ? Math.max(X(b.to), x0 + 2) : G + 2;
            var name = (b.kind === 'wf' ? (closed[b.key] ? '▸ ' : '▾ ') : '') + b.label;
            out += '<text class="mono" x="' + (b.kind === 'kid' ? 14 : 0) + '" y="' + (y + 17) + '" style="font-size:11.5px;fill:var(--'
                + (b.kind === 'kid' ? 'ink2' : 'ink') + ')' + (b.kind === 'wf' ? ';font-weight:600' : '') + '">'
                + esc(name.length > 21 ? name.slice(0, 20) + '…' : name) + '</text>'
                + (b.kind === 'wf'
                    ? '<rect x="' + f1(x0) + '" y="' + (y + 4) + '" width="' + f1(x1 - x0) + '" height="18" rx="3" style="fill:var(--s-workflow);opacity:.2"/>'
                    : '<rect x="' + f1(x0) + '" y="' + (y + 7) + '" width="' + f1(x1 - x0) + '" height="12" rx="3" style="fill:var(--s-'
                    + (b.kind === 'kid' ? 'workflow' : 'agent') + ')"/>')
                + barLabel(x0, x1, y + 17,
                    (b.kind === 'wf' ? 'workflow · ' + loc('ses.nAgents', '{n} 個 agent', { n: b.n }) + ' · ' : String(b.model || '—').replace(/^claude-/, '') + ' · ')
                    + tokens(b.tokens) + ' tok · ' + cents(b.cents) + estMark(b)
                    + (b.ret !== null && b.ret !== undefined ? ' · ' + loc('ses.returnedChars', '回傳 {n} 字元', { n: comma(b.ret) }) : ''))
                + '<line class="gridl" x1="0" x2="' + (W - R) + '" y1="' + (y + RH) + '" y2="' + (y + RH) + '"/>'
                + (b.kind === 'wf' ? '<rect class="wf-toggle" data-wf="' + esc(b.key) + '" x="0" y="' + y + '" width="' + (W - R)
                    + '" height="' + RH + '"><title>' + loc('ses.clickToggle', '點一下收合或展開') + '</title></rect>' : '');
        });
        return out + '</svg>';
    }
    // Stage by model, each of the five token kinds with its own dollars, from
    // the session's `days` — the same rows the home page's bars add up.
    function costModel(days) {
        var cell = function () {
            var zero = function () { var o = {}; KIND_KEYS.forEach(function (k) { o[k] = 0; }); return o; };
            return { tokens: zero(), cost: zero(), usd: 0, estimated: false };
        };
        var add = function (a, r) {
            var t = r.tokens || {}, c = r.cost || {};
            KIND_KEYS.forEach(function (k) { a.tokens[k] += t[k] || 0; a.cost[k] += c[k] || 0; });
            a.usd += r.usd || 0;
            if (r.estimated && r.usd) a.estimated = true;
        };
        var by = {}, order = [], out = { stages: [], main: cell(), agent: cell(), total: cell() };
        (days || []).forEach(function (r) {
            var sk = r.stage || 'none', mk = r.model || '—';
            if (!by[sk]) { by[sk] = { sub: cell(), models: {} }; order.push(sk); }
            if (!by[sk].models[mk]) by[sk].models[mk] = cell();
            add(by[sk].sub, r);
            add(by[sk].models[mk], r);
            add(r.who === 'main' ? out.main : out.agent, r);
            add(out.total, r);
        });
        var rank = function (k) { var i = ROUTE.indexOf(k); return i < 0 ? ROUTE.length : i; };
        out.stages = order.sort(function (a, b) { return rank(a) - rank(b); }).map(function (k) {
            return { stage: k, sub: by[k].sub, models: Object.keys(by[k].models).sort().map(function (mk) {
                return { model: mk, cell: by[k].models[mk] };
            }) };
        });
        return out;
    }
    // One 主迴圈 row's arithmetic: how many of the session's own requests a
    // stage held, how many already carried `BUSY` tokens or more, what those
    // turns cost, and their share of the stage's own total (main and agents
    // alike — the same total the sub row's own last cell already prints).
    // `lp` is one row of `x.loops`, or `null` for a stage no main request
    // landed in; `usd()` already prints a dash for a zero dollar figure.
    // `foot` is the tfoot row: its label takes the first cell, as 主 session,
    // agent and 合計 do, and its share is of the whole session.
    function loopRow(lp, stageUsd, foot) {
        lp = lp || { turns: 0, over: 0, overUsd: 0, estimated: false };
        var pct = stageUsd ? lp.overUsd / stageUsd * 100 : 0;
        var z = lp.over === 0;
        return '<tr class="loop">' + (foot ? '<td><span class="lp">' + loc('ses.mainLoop', '主迴圈') + '</span></td><td></td>' : '<td></td><td><span class="lp">' + loc('ses.mainLoop', '主迴圈') + '</span></td>')
            + '<td colspan="' + KIND_KEYS.length * 2 + '"><div class="lf">'
            + '<span><b>' + lp.turns + '</b>' + loc('ses.turns', '回合') + '</span>'
            + '<span' + (z ? ' class="zero"' : '') + '><b>' + lp.over + '</b>' + loc('ses.turnsOver400k', '回合 ≥ 400k') + '</span>'
            + '<span' + (z ? ' class="zero"' : '') + '><b>' + usd(lp.overUsd) + (lp.overUsd ? estMark(lp) : '') + '</b>' + loc('ses.thoseTurns', '那些回合') + '</span>'
            + '<span' + (z ? ' class="zero"' : '') + '><i class="mini" style="display:inline-flex;width:72px;vertical-align:middle;margin-right:8px">'
            + '<span style="width:' + Math.round(pct) + '%"></span></i><b>' + Math.round(pct) + '%</b>' + (foot ? loc('ses.ofSession', '佔 session') : loc('ses.ofThisStage', '佔這一站')) + '</span>'
            + '</div></td><td class="r"></td></tr>';
    }
    function sumLoops(loops) {
        return (loops || []).reduce(function (a, r) {
            return { turns: a.turns + r.turns, over: a.over + r.over, overUsd: a.overUsd + r.overUsd, estimated: a.estimated || (r.estimated === true && r.overUsd > 0) };
        }, { turns: 0, over: 0, overUsd: 0, estimated: false });
    }
    // `x` is the session's detail (as everywhere else on this page — see
    // `sessionHeadHtml(s, x)`, `ctxSection(s, x)`) — optional, since the cost
    // tab answers before the detail script has loaded. With none, no 主迴圈
    // row is drawn: `x.loops` is what `lib/detail.js`'s `loopsOf` computed,
    // and there is nothing to show before it arrives.
    // 概覽's money, stage by stage: dollars from the session's `days` (main
    // and agent apart, the split costModel makes), time from the data file's
    // `stages`, requests from the detail's points placed by `seq`. `req` is
    // null until the detail is here.
    function stageShare(s, x) {
        var by = {}, order = [], total = 0;
        var row = function (k) {
            if (!by[k]) { by[k] = { stage: k, ms: null, usd: 0, main: 0, agent: 0, req: x ? 0 : null, estimated: false }; order.push(k); }
            return by[k];
        };
        (s.days || []).forEach(function (r) {
            var g = row(r.stage || 'none'), v = r.usd || 0;
            g.usd += v;
            total += v;
            if (r.who === 'main') g.main += v; else g.agent += v;
        });
        (s.stages || []).forEach(function (w) { var g = row(w.stage); if (w.estimated === true) g.estimated = true; g.ms = (g.ms || 0) + Math.max(w.to - w.from, 0); });
        if (x) {
            (x.points || []).forEach(function (pt) {
                var k = 'none';
                (x.seq || []).forEach(function (m) { if (m.at <= pt.t) k = m.stage; });
                row(k).req++;
            });
        }
        var rank = function (k) { var i = ROUTE.indexOf(k); return i < 0 ? ROUTE.length : i; };
        var rows = order.sort(function (a, b) { return rank(a) - rank(b); }).map(function (k) { return by[k]; })
            .filter(function (g) { return g.usd || g.ms || g.req; });
        return { total: total, estimated: rows.some(function (g) { return g.estimated && g.usd; }), rows: rows };
    }
    // One bar split by stage in the timeline's stage tints, and the table under
    // it. A segment or a row is a toggle: `hi` is the stage the timeline marks.
    function costShareHtml(L, hi) {
        var pct = function (v) { return L.total ? Math.round(v / L.total * 1000) / 10 : 0; };
        var name = function (k) { return k === 'none' ? loc('ses.beforeStepOne', '第一步之前') : k; };
        var paid = L.rows.filter(function (g) { return g.usd > 0; });
        return '<div class="cshare" data-block="cost-share"><div class="h2">' + icon('spend') + loc('ses.costShareByStage', '各 stage 花費占比')
            + '<small>' + loc('ses.costShareHint', '合計 {t}；點一段或一列，時間線標出那個 stage', { t: usd(L.total) + estMark(L) }) + '</small></div>'
            + (paid.length ? '<div class="csbar" role="group" aria-label="' + loc('ses.costShareByStage', '各 stage 花費占比') + '">' + paid.map(function (g) {
                var p = pct(g.usd), on = hi === g.stage;
                return '<button type="button" class="csseg' + (on ? ' on' : '') + '" data-hist="' + esc(g.stage) + '" aria-pressed="' + on + '"'
                    + ' title="' + esc(name(g.stage) + ' ' + usd(g.usd, true) + estMark(g) + ' · ' + p + '%') + '" style="flex:' + g.usd + ' 1 0;background:'
                    + colorOf('stage', g.stage) + '">' + (p >= 9 ? '<span>' + esc(name(g.stage)) + '</span><b>' + usd(g.usd, true) + estMark(g) + ' · ' + p + '%</b>' : '')
                    + '</button>';
            }).join('') + '</div>' : '<p class="tally">' + loc('ses.noDailyCost', '這個 session 沒有按日的花費') + '</p>')
            + '<div class="tbl-wrap"><table class="t cstbl"><thead><tr><th>stage</th><th class="r">' + loc('ses.thTime', '時間') + '</th><th class="r">' + loc('ses.thCost', '花費') + '</th><th class="r">' + loc('ses.thShare', '占比') + '</th>'
            + '<th>' + loc('ses.thMainVsAgent', '主 session / agent') + '</th><th class="r">' + loc('ses.thRequests', '請求') + '</th></tr></thead><tbody>' + L.rows.map(function (g) {
                var on = hi === g.stage;
                return '<tr class="csrow' + (on ? ' on' : '') + '" data-hist="' + esc(g.stage) + '" tabindex="0" aria-pressed="' + on + '">'
                    + '<td><span class="pchip"><i class="sw" style="background:' + colorOf('stage', g.stage) + '"></i>' + esc(name(g.stage)) + '</span></td>'
                    + '<td class="r muted">' + (g.ms === null ? '—' : mins(g.ms)) + '</td><td class="r">' + usd(g.usd) + estMark(g) + '</td>'
                    + '<td class="r muted">' + (g.usd ? pct(g.usd) + '%' : '—') + '</td>'
                    + '<td><span class="csplit"' + (g.usd ? '' : ' hidden') + '><i style="flex:' + g.main + ' 1 0;background:var(--s-main)"></i>'
                    + '<i style="flex:' + g.agent + ' 1 0;background:var(--s-agent)"></i></span>'
                    + '<span class="muted">' + usd(g.main) + ' / ' + usd(g.agent) + estMark(g) + '</span></td>'
                    + '<td class="r muted">' + (g.req === null ? '—' : g.req) + '</td></tr>';
            }).join('') + '</tbody></table></div></div>';
    }
    // 派工's tie to that bar: each stage's agent dollars, a link back to 概覽
    // with that stage marked.
    // One bar per stage, its length the stage's agent dollars against the
    // largest; a bar is the same toggle as 概覽's, `hi` the stage it marks.
    function dispatchStagesHtml(L, id, hi) {
        var paid = L.rows.filter(function (g) { return g.agent > 0; });
        if (!paid.length) return '';
        var max = Math.max.apply(null, paid.map(function (g) { return g.agent; }));
        var sum = paid.reduce(function (a, g) { return a + g.agent; }, 0);
        return '<div class="dstg" data-block="dispatch-stages"><div class="dxh">' + loc('ses.dispatchCostByStage', '派工花費，依 stage') + ' <small>' + loc('ses.totalV', '合計 {v}', { v: usd(sum) + estMark({ estimated: paid.some(function (g) { return g.estimated; }) }) }) + '</small></div>'
            + paid.map(function (g) {
                var nm = g.stage === 'none' ? loc('ses.beforeStepOne', '第一步之前') : g.stage, on = hi === g.stage;
                return '<a class="dsrow' + (on ? ' on' : '') + '" href="' + sessionHash(id) + '" data-hist="' + esc(g.stage) + '" aria-pressed="' + on + '"'
                    + ' title="' + esc(loc('ses.dispatchOfShare', '{nm} 派工 {v} · 占派工 {p}%', { nm: nm, v: usd(g.agent) + estMark(g), p: Math.round(g.agent / sum * 1000) / 10 })) + '">'
                    + '<span class="dsl">' + esc(nm) + '</span><span class="dst"><i style="width:' + (g.agent / max * 88).toFixed(1)
                    + '%;background:' + colorOf('stage', g.stage) + '"></i><b>' + usd(g.agent, true) + estMark(g) + '</b></span></a>';
            }).join('') + '</div>';
    }
    function costHtml(m, x) {
        var notes = w.FK_KINDS ? w.FK_KINDS.notes(S.prices) : {};
        var cells = function (a, cls) {
            return KIND_KEYS.map(function (k) {
                return '<td class="r muted">' + tokens(a.tokens[k]) + '</td><td class="r">' + usd(a.cost[k]) + (a.cost[k] ? estMark(a) : '') + '</td>';
            }).join('') + '<td class="r' + (cls ? ' ' + cls : '') + '">' + usd(a.usd) + estMark(a) + '</td>';
        };
        var share = function (v) { return m.total.usd ? Math.round(v / m.total.usd * 1000) / 10 + '%' : '—'; };
        var allTok = KIND_KEYS.reduce(function (n, k) { return n + m.total.tokens[k]; }, 0);
        var loops = x && Array.isArray(x.loops) ? x.loops : null;
        var loopBy = {};
        (loops || []).forEach(function (r) { loopBy[r.stage === null ? 'none' : r.stage] = r; });
        return '<div class="sumline"><div>' + loc('ses.totalCost', '合計花費') + '<b>' + usd(m.total.usd) + estMark(m.total) + '</b></div><div>' + loc('ses.mainSession', '主 session') + '<b>' + usd(m.main.usd) + estMark(m.main) + '</b></div>'
            + '<div>' + loc('ses.dispatchAgentWorkflow', '派工（agent + workflow）') + '<b>' + usd(m.agent.usd) + estMark(m.agent) + '</b></div><div>' + loc('ses.outputShareOfCost', 'output 佔花費') + '<b>' + share(m.total.cost.output) + '</b></div>'
            + '<div>' + loc('ses.cacheReadShareOfTokens', 'cache read 佔 token') + '<b>' + (allTok ? Math.round(m.total.tokens.cacheRead / allTok * 1000) / 10 + '%' : '—') + '</b></div></div>'
            + '<div class="h2">stage × model <small>' + loc('ses.stageModelHint', 'token 與各自的 USD；stage 列是小計') + '</small></div>'
            + '<div class="tbl-wrap"><table class="t"><thead><tr><th rowspan="2">stage</th><th rowspan="2">' + loc('ses.modelOfSession', 'model · 佔 session') + '</th>'
            + KIND_KEYS.map(function (k) { return '<th colspan="2"' + (notes[k] ? ' title="' + esc(notes[k]) + '"' : '') + '><i class="sw" style="background:var(' + KIND_COLOR[k] + ')"></i> ' + esc(KIND_LABEL[k]) + '</th>'; }).join('')
            + '<th rowspan="2" class="r">USD</th></tr><tr>'
            + KIND_KEYS.map(function () { return '<th class="r">token</th><th class="r">USD</th>'; }).join('') + '</tr></thead><tbody>'
            + m.stages.map(function (g) {
                return '<tr class="sub"><td><span class="pchip"><i class="sw" style="background:' + colorOf('stage', g.stage) + '"></i>'
                    + esc(g.stage === 'none' ? loc('ses.beforeStepOne', '第一步之前') : g.stage) + '</span></td><td class="muted">' + share(g.sub.usd) + '</td>'
                    + cells(g.sub, '') + '</tr>' + g.models.map(function (mm) {
                        return '<tr class="child"><td></td><td><span class="pchip"><i class="sw" style="background:var(--m-' + family(mm.model)
                            + ')"></i>' + esc(String(mm.model).replace(/^claude-/, '')) + '</span></td>' + cells(mm.cell, '') + '</tr>';
                    }).join('') + (loops ? loopRow(loopBy[g.stage], g.sub.usd) : '');
            }).join('') + '</tbody><tfoot>'
            + '<tr><td>' + loc('ses.mainSession', '主 session') + '</td><td></td>' + cells(m.main, 'total') + '</tr>'
            + '<tr><td>agent</td><td></td>' + cells(m.agent, 'total') + '</tr>'
            + '<tr><td>' + loc('ses.total', '合計') + '</td><td></td>' + cells(m.total, 'total') + '</tr>'
            + (loops ? loopRow(sumLoops(loops), m.total.usd, true) : '') + '</tfoot></table></div>';
    }
    function sessionHeadHtml(s, x) {
        var t = sessionTotals(s), m = x ? timelineModel(x) : null, agentUsd = costModel(s.days).agent.usd;
        var waited = m ? m.waits.reduce(function (n, w) { return n + w.ms; }, 0) : t.wait;
        var wakes = x && typeof x.wakes === 'number' ? x.wakes : null;
        return '<div class="readouts">'
            + roHtml(loc('ses.elapsed', '歷時'), m && m.t1 > m.t0 ? mins(m.t1 - m.t0) : '—', 'active ' + hours(t.active))
            + roHtml('<i class="hatchsw"></i>' + loc('ses.waitingForYou', '等你回答'), mins(waited), m ? loc('ses.nGates', '{n} 次 gate', { n: m.waits.length }) : loc('ses.loadingDetail', '讀取細節…'))
            + roHtml(loc('ses.cost', '花費'), usd(t.usd, true) + estMark(t), t.usd ? (quotaPct(t.usd) ? quotaPct(t.usd) + ' · ' : '') + loc('ses.dispatchShare', '派工佔 {p}%', { p: Math.round(agentUsd / t.usd * 100) }) : loc('ses.noDailyCost', '這個 session 沒有按日的花費'))
            + roHtml('token', tokens(t.tokens), x ? loc('ses.nMainSessionRequests', '{n} 次主 session 請求', { n: x.requests }) : '')
            + roHtml(loc('ses.dispatch', '派工'), x ? x.rows.length + '<span class="u">agent</span>' : '—', x ? agentCounts(x, s) + loc('ses.nWorkflows', '{n} 個 workflow', { n: x.runs.length }) : '')
            + roHtml(loc('ses.wakes', '叫醒'), wakes === null ? '—' : wakes + '<span class="u">' + loc('ses.times', '次') + '</span>', wakes === null ? '' : loc('ses.dispatchWokeMain', '派工回報叫醒主 session'))
            + roHtml(loc('ses.contextPeak', 'context 峰值'), x ? tokens(x.peak) : '—', '')
            + '</div>';
    }
    // Six tabs by what a reader comes for: 概覽 is the session's story —
    // time, context and money stage by stage — 派工 and 事件 are its two
    // long lists, 對話 is what was said, 計畫 the plan the session claimed and
    // 關卡 the report its stage waits at a gate with. `cost` is still in TABS so an old `/cost` link parses; it
    // opens 概覽, which now holds everything that tab showed. `talk` is the
    // 對話 tab's turn count, and nothing until its first page is in.
    var TAB_SHOWN = ['timeline', 'dispatch', 'events', 'talk', 'plan', 'gate'];
    function tabsHtml(s, tab, x, talk) {
        var label = { timeline: loc('ses.tabOverview', '概覽'), dispatch: loc('ses.tabDispatch', '派工'), events: loc('ses.tabEvents', '事件'), talk: loc('ses.tabTalk', '對話'), plan: loc('ses.tabPlan', '計畫'), gate: loc('ses.tabGate', '關卡') };
        // plan counts the newest claimed plan's tasks; plan wears the gate's hatch
        // at the plan stage with tasks to show, gate while `gateAt` says it waits.
        var plan = x && x.tasks && x.tasks.length ? x.tasks[x.tasks.length - 1] : null;
        var n = { dispatch: x ? x.rows.length : null, events: x ? x.events.length : null, talk: talk, plan: plan && plan.tasks.length ? plan.tasks.length : null };
        var run = x ? x.rows.filter(function (r) { return agentState(x, r, s) === 'running'; }).length : 0;
        if (tab === 'cost') tab = 'timeline';
        return '<nav class="tabs" data-block="session-tabs" aria-label="' + loc('ses.sessionView', 'session 檢視') + '">' + TAB_SHOWN.map(function (k) {
            return '<a href="' + sessionHash(s.id, k) + '"' + (k === tab ? ' class="on" aria-current="page"' : '') + '>' + label[k]
                + (n[k] !== null && n[k] !== undefined ? '<small>' + n[k] + '</small>' : '')
                + (k === 'dispatch' && run ? '<i class="dot live" title="' + loc('ses.nAgentsRunning', '{n} 個 agent running', { n: run }) + '"></i>' : '')
                + ((k === 'plan' && s.stage === 'plan' && n.plan) || (k === 'gate' && gateAt(s, x && x.gate)) ? '<i class="hatchsw pv-tabgate" aria-label="' + loc('ses.tabPlanGate', '等你回答') + '"></i>' : '') + '</a>';
        }).join('') + '</nav>';
    }

    // The 對話 tab. The turns come from `station/talk/<id>` (lib/conversation.js
    // behind scripts/station.js), 100 at a time, and the caller keeps them as
    // `{ turns, total, counts, skipped, state }`; everything here is a function
    // of that, so a redraw fetches nothing. `state` is '' when there is nothing
    // to say, `loading`, `failed`, `missing` (the transcript is not on this
    // machine) or `static` (a written copy has no server to ask).
    var TALK_PAGE = 100;
    // `MM-DD HH:MM` in the reader's own time zone.
    function talkStamp(at) {
        var ms = typeof at === 'string' ? Date.parse(at) : NaN;
        if (!isFinite(ms)) return '<time class="tm">—</time>';
        var d = new Date(ms), two = function (n) { return String(n).padStart(2, '0'); };
        return '<time class="tm" datetime="' + esc(at) + '">' + two(d.getMonth() + 1) + '-' + two(d.getDate()) + ' ' + two(d.getHours()) + ':' + two(d.getMinutes()) + '</time>';
    }
    // A turn's text as typed: line breaks kept (`.t` is pre-wrap) and no markdown
    // converted. The one exception is a run between two ``` lines, which is a
    // monospace block with the fence lines dropped; a fence never closed runs to
    // the end of the text.
    function talkBody(text) {
        var out = [], run = [], code = null;
        var flush = function () {
            if (code !== null) {
                out.push('<pre class="code"' + (code ? ' aria-label="' + loc('ses.talkCode', '程式碼區塊') + ' ' + esc(code) + '"' : '') + '>' + esc(run.join('\n')) + '</pre>');
            } else {
                var s = run.join('\n').replace(/^\n+|\n+$/g, '');
                if (s) out.push('<div class="t">' + esc(s) + '</div>');
            }
            run = [];
        };
        String(text === null || text === undefined ? '' : text).split(/\r?\n/).forEach(function (line) {
            if (code === null && /^\s*```/.test(line)) {
                flush();
                code = line.replace(/^\s*```/, '').trim().split(/\s+/)[0];
            } else if (code !== null && /^\s*```\s*$/.test(line)) {
                flush();
                code = null;
            } else {
                run.push(line);
            }
        });
        flush();
        return out.join('');
    }
    // The line over the turns: the whole conversation's counts, then the lines
    // the read left out, biggest first, a kind with none left unlisted.
    function talkCounts(h) {
        var b = function (n) { return '<b>' + comma(n) + '</b>'; };
        var left = Object.keys(h.skipped || {}).map(function (k, i) { return { k: k, n: h.skipped[k], i: i }; })
            .filter(function (e) { return e.n > 0; })
            .sort(function (a, c) { return c.n - a.n || a.i - c.i; });
        var parts = [
            loc('ses.talkUsers', '使用者 {n} 輪', { n: b(h.counts.user) }),
            loc('ses.talkClaudes', 'Claude {n} 輪', { n: b(h.counts.claude) }),
            loc('ses.talkCompacts', '{k} {n} 次', { k: '<code>compact</code>', n: b(h.counts.compact) }),
        ];
        if (left.length) {
            parts.push('<span class="out" title="' + loc('ses.talkSkipHint', 'transcript 裡沒有列進對話的行，依種類計數；0 筆的種類不列出') + '">'
                + loc('ses.talkSkipped', '略過 {list}', { list: left.map(function (e) { return '<code>' + esc(e.k) + '</code> ' + b(e.n); }).join(loc('ses.talkListSep', '、')) }) + '</span>');
        }
        return '<p class="tkc" data-block="talk-counts">' + parts.join('<i class="sep">·</i>') + '</p>';
    }
    // One user turn, one Claude turn, or the interruption line.
    function talkRow(t) {
        if (t.kind === 'act') return w.FK_TACT ? '<li class="tk-act">' + w.FK_TACT.html(t, '', 'talk-act-' + String(t.at)) + '</li>' : '';
        if (t.kind === 'interrupt') {
            return '<li class="tk-int" data-block="talk-turn-interrupt">' + talkStamp(t.at) + '<span class="who">' + loc('ses.talkWhoInt', '中斷') + '</span>'
                + '<div class="tx"><div class="t">' + loc('ses.talkIntText', '使用者中斷了 Claude 這一輪') + '<code>' + esc(t.text) + '</code></div></div></li>';
        }
        var user = t.kind === 'user';
        return '<li class="' + (user ? 'tk-user' : 'tk-claude') + '" data-block="talk-turn-' + (user ? 'user' : 'claude') + '">' + talkStamp(t.at)
            + '<span class="who">' + (user ? loc('ses.talkWhoUser', '使用者') : 'Claude') + '</span><div class="tx">' + talkBody(t.text) + '</div></li>';
    }
    // A compaction and the summary right after it are one block: the break
    // with its time, trigger and the context it compacted, the summary shut
    // until opened. `c` is the compact turn, `sum` the summary turn, either
    // may be missing — a summary not loaded yet draws the break alone — and
    // `i` is where the block starts, which a redraw finds an opened one by.
    function talkCut(c, sum, i, extra) {
        var meta = [];
        if (c && c.trigger) meta.push('<code>' + esc(c.trigger) + '</code>');
        if (c && c.preTokens !== null && c.preTokens !== undefined) meta.push(loc('ses.talkPreTokens', '壓縮前 context {n}', { n: '<b>' + tokens(c.preTokens) + '</b>' }));
        var head = '<code class="ck">compact</code><span class="cm">' + meta.join('<i class="sep">·</i>') + '</span>' + (extra || '') + '<i class="ln" aria-hidden="true"></i>';
        var at = talkStamp((c || sum).at);
        if (!sum) return '<li class="tk-cut" data-block="talk-compact">' + at + '<div class="cut"><div class="cutbar">' + head + '</div></div></li>';
        return '<li class="tk-cut" data-block="talk-compact">' + at + '<details class="cut" data-key="talk-cut-' + i + '"><summary>' + head
            + '<span class="ct"><span class="o">' + loc('ses.talkSumOpen', '看摘要') + '</span><span class="c">' + loc('ses.talkSumShut', '收起摘要') + '</span></span></summary>'
            + '<div class="sum"><div class="sl">' + loc('ses.talkSumNote', 'Claude Code 在壓縮時寫的摘要，之後的對話從這段接下去') + '</div>'
            + '<div class="t">' + esc(sum.text) + '</div></div></details></li>';
    }
    function talkRows(turns, spend, all) {
        // Break records from the server (lib/conversation.js `spendOf`) are
        // drawn by assets/station/spend-talk.js, with this file's own blocks.
        if (w.FK_TALK && spend && spend.marks && spend.marks.length) {
            return w.FK_TALK.rows(turns, spend, all, { cut: talkCut, row: talkRow, stamp: talkStamp });
        }
        var out = [];
        for (var i = 0; i < turns.length; i++) {
            var t = turns[i];
            if (t.kind === 'compact') {
                var next = turns[i + 1];
                if (next && next.kind === 'summary') {
                    out.push(talkCut(t, next, i));
                    i += 1;
                } else {
                    out.push(talkCut(t, null, i));
                }
            } else if (t.kind === 'summary') {
                out.push(talkCut(null, t, i));
            } else {
                out.push(talkRow(t));
            }
        }
        return out.join('');
    }
    function talkNote(title, why) {
        return '<div class="emptyd tkmiss" data-block="talk-missing"><p class="et">' + title + '</p><p class="es">' + why + '</p></div>';
    }
    // `held` is what the caller kept for this session, or nothing yet.
    function talkHtml(id, held) {
        var h = held || { turns: [], total: null, state: '' };
        var loading = loc('ses.talkLoading', '讀取中…'), failed = loc('ses.talkFailed', '讀不到對話'), retry = loc('ses.talkRetry', '重試');
        var btn = function (text) { return '<button type="button" class="ctl" data-talk="' + esc(id) + '">' + text + '</button>'; };
        if (h.state === 'missing') {
            return talkNote(loc('ses.talkMissing', '這台機器上已經沒有這個 session 的 transcript'),
                loc('ses.talkMissingWhy', '對話是直接從 transcript 讀出來的，檔案不在就沒有內容可以列。之後的 session 想留久一點，把 {file} 的 {key} 調大。',
                    { file: '<code>~/.claude/settings.json</code>', key: '<code>cleanupPeriodDays</code>' }));
        }
        if (h.state === 'static') {
            return talkNote(loc('ses.talkStatic', '要從 serve 開的頁面才讀得到對話'),
                loc('ses.talkStaticWhy', '對話不寫進這份檔案，全文只留在這台機器上，由 serve 讀 transcript 回答。用 {cmd} 開站，再回到這個分頁。',
                    { cmd: '<code>node scripts/station.js serve --open</code>' }));
        }
        if (h.total === null) {
            return h.state === 'failed'
                ? '<div class="tkmore" data-block="talk-more"><span>' + failed + '</span>' + btn(retry) + '</div>'
                : '<p class="tally">' + loading + '</p>';
        }
        var n = h.turns.length;
        var tail = h.state === 'loading' ? '<span>' + loading + '</span>'
            : h.state === 'failed' ? '<span>' + failed + '</span>' + btn(retry)
                : n < h.total ? btn(loc('ses.talkMore', '再載入 {n} 輪', { n: TALK_PAGE })) : '';
        if (h.total === 0) return talkCounts(h) + '<p class="tally">' + loc('ses.talkEmpty', 'transcript 裡沒有可列的對話') + '</p>';
        return talkCounts(h) + (w.FK_TALK ? w.FK_TALK.line(h.spend) : '') + '<ol class="tk" aria-label="' + loc('ses.talkList', '對話，依時間順序') + '">' + talkRows(h.turns, h.spend, n >= h.total) + '</ol>'
            + '<div class="tkmore" data-block="talk-more"><span>' + loc('ses.talkShown', '已顯示 {n} / {m} 輪', { n: '<b>' + comma(n) + '</b>', m: '<b>' + comma(h.total) + '</b>' })
            + '</span>' + tail + '</div>';
    }

    // ---- the live page --------------------------------------------------------
    // A time to the second, for when the page last re-read and when a step began.
    function clockSec(ms) {
        var d = new Date(ms);
        return [d.getHours(), d.getMinutes(), d.getSeconds()].map(function (n) { return String(n).padStart(2, '0'); }).join(':');
    }
    function agoText(sec) { return sec <= 0 ? loc('live.justUpdated', '剛更新') : loc('live.updatedSecAgo', '{s} 秒前更新', { s: sec }); }
    // A figure that keeps moving between re-reads, in seconds, `b + m × now`:
    // an elapsed time is `-start, 1`. Printed once from `nowSec`, and — only
    // while `live` — marked for the once-a-second tick below the guard to move.
    // `tkr`, because 比較 already gives `tk` to a task name.
    function tk(b, m, live, nowSec) {
        var v = dur(Math.max(0, Math.round(b + m * nowSec)));
        return live && m ? '<span class="tkr" data-b="' + b + '" data-m="' + m + '">' + v + '</span>' : v;
    }
    // Beside the session's state on its page, served: `即時` and how long ago the
    // page last re-read while the session is live, the moment it stopped once
    // it is not.
    function liveTag(live, polledMs, nowMs) {
        return live
            ? '<span class="livetag" title="' + esc(loc('live.lastUpdatedHint', '最後一次更新 {t}；session 還活著，這頁每 3 秒重拉一次，結束就停', { t: clockSec(polledMs) })) + '"><b>' + loc('live.live', '即時') + '</b>・<span data-ago>'
                + agoText(Math.round((nowMs - polledMs) / 1000)) + '</span></span>'
            : '<span class="livetag off" title="' + esc(loc('live.stoppedHint', 'session 結束後不再重拉')) + '"><b>' + loc('live.stoppedUpdating', '已停止更新') + '</b>・' + loc('live.lastAt', '最後一次 {t}', { t: clockSec(polledMs) }) + '</span>';
    }
    // The route as a rail: a stop per stage, each one behind the current stage
    // timed by the registry's clock for it (`stages[].from` and `to`), the
    // current one ringed and — while `live` — counting up from when it was
    // entered. Not live, it keeps the time the stage had when the session stopped.
    function railHtml(s, live, nowMs) {
        var route = s.route || [], at = route.indexOf(s.stage), win = {};
        (s.stages || []).forEach(function (w) { win[w.stage] = w; });
        return '<ol class="rail" style="--n:' + route.length + '" aria-label="route ' + esc(route.join(' → '))
            + (at >= 0 ? esc(loc('live.nowAtStopOf', '；現在在 {stage}，第 {n} 站，共 {total} 站', { stage: s.stage, n: at + 1, total: route.length })) : '') + '">'
            + route.map(function (k, i) {
                var w = win[k], cls = at < 0 || i > at ? 'todo' : i < at ? 'done' : 'now' + (live ? ' live' : ''), tm = '';
                if (i < at && w) tm = '<span class="tm">' + mins(w.to - w.from) + '</span>';
                else if (i === at && w) {
                    tm = '<span class="tm">' + (live ? tk(-w.from / 1000, 1, true, nowMs / 1000) : mins(w.to - w.from)) + '</span>'
                        + '<span class="since">' + clock(w.from) + (live ? loc('live.enteredStop', ' 進站') : loc('live.enteredStopStopped', ' 進站，停在這站')) + '</span>';
                }
                return '<li class="' + cls + '" style="--c:var(--st-' + esc(k) + ')"' + (i === at ? ' aria-current="step"' : '') + '>'
                    + '<span class="pt"></span><span class="nm">' + esc(k) + '</span>' + tm + '</li>';
            }).join('') + '</ol>';
    }

    // Whether the served page has lost its server, and what to say. Pure, so
    // it is unit tested; the fetch that feeds it and the banner it fills are
    // the document half below the guard. The sentence starts at 底下 rather
    // than at 伺服器已離線 because the bar's own heading now says
    // `serve 沒有回應` above it — mockup screen 3 splits it that way, and one
    // bar saying it twice reads as a stutter.
    function serveLost(lastOkMs, nowMs, genAbs, genRel) {
        if (lastOkMs === null || lastOkMs === undefined) return null;
        if (nowMs - lastOkMs < 15000) return null;
        return loc('live.frozenBelow', '底下所有數字與狀態都凍結在 {abs}（{rel}），不會再更新。每 5 秒重試一次。', { abs: genAbs, rel: genRel });
    }

    // ---- the left bar -------------------------------------------------------
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
    };
    function icon(name) {
        if (ICONS24[name]) {
            return '<svg class="ico g24" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor"'
                + ' stroke-linecap="round" stroke-linejoin="round">' + ICONS24[name] + '</svg>';
        }
        return ICONS[name] ? '<svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor"'
            + ' stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + ICONS[name] + '</svg>' : '';
    }
    // Six pages, one level, no folds (mockup 2026-10-21-station-home): 現在,
    // Sessions, 花費 and 文件, then 設定 and 導覽 pinned under them (`pin`).
    // `kids` are a page's filters — the strip on each of its pages
    // (`subtabsHtml`) — so the strip, the title and the lit entry agree.
    var NAV_TREE = [
        { ico: 'now', label: loc('nav.now', '現在'), v: 'now', href: '#/' },
        { ico: 'sessions', label: 'Sessions', v: 'sessions', href: '#/sessions', kids: [['live', '#/live', loc('nav.inProgress', '進行中')], ['sessions', '#/sessions', loc('nav.recent', '最近')],
            ['list', '#/list', loc('nav.fullList', '全部清單')], ['cmp', '#/cmp', loc('nav.compare', '比較')]] },
        { ico: 'spend', label: loc('nav.spend', '花費'), v: 'days', href: '#/days', kids: [['days', '#/days', loc('nav.last30d', '近 30 天')], ['projects', '#/projects', loc('nav.byProject', '依專案')]] },
        { ico: 'docs', label: loc('nav.docs', '文件'), v: 'docs', href: '#/docs' },
        { ico: 'settings', label: loc('nav.settings', '設定'), v: 'settings', href: '#/settings', pin: true, kids: [['settings', '#/settings', loc('nav.wizard', '精靈')]] },
        { ico: 'tour', label: loc('nav.tour', '導覽'), v: 'tour', href: '#/tour', pin: true, block: 'tour-nav', title: loc('nav.tourTitle', 'fankeel 怎麼跑一個任務，一段動畫看完') },
    ];
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
            + '<div id="navlinks">' + navLinksHtml(active, c) + '</div></div></nav>';
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
        var now = S.serve || !isFinite(NOW) ? Date.now() : NOW;
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
    // ---- 設定: the seven-step wizard ----------------------------------------

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
        var body = p.questions.length === 1 && !q.multiSelect && S.serve
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
            + (S.serve ? '<button type="button" class="gho" data-gho' + lock + '>' + loc('tune.handToTerminalPhone', '交給終端／手機') + '</button>'
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
        var left = Math.max(0, Math.round((p.until - (S.serve ? Date.now() : NOW)) / 1000));
        var picks = {}, others = {};
        p.questions.forEach(function (q, i) { picks[i] = on[s.id + ':' + i] || []; others[i] = on[s.id + ':' + i + ':other'] || ''; });
        var got = pgAnswers(p.questions, picks, others), n = p.questions.length;
        var dis = S.serve ? '' : ' disabled';
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
            + (S.serve ? '<div class="act gpf"><span class="cnt">' + loc('tune.answeredNOfM', '已答 <b class="pgn">{a} / {n}</b>', { a: n - got.missing, n: n }) + '</span>'
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
    // has the `/chartroom/` route (a file:// copy has none), only a registry
    // with `.fankeel/architecture.board` has a board (`board`, lib/station.js),
    // and only a machine whose profile names a Chartroom install can open it
    // (`station.chartroom`). The url segment is the root's folder name, the
    // one scripts/station.js matches; the trailing slash keeps the board
    // page's relative asset urls under its own prefix.
    function boardLinkHtml(p, serve, machine) {
        if (!serve || !p || !p.board || !machine || !machine['station.chartroom']) return '';
        var name = String(p.root).split(/[\\/]/).filter(Boolean).pop() || '';
        var href = '/chartroom/' + encodeURIComponent(name) + '/';
        return '<p class="mute" style="margin:4px 0 0">' + loc('proj.boardColon', '架構白板：')
            + '<a href="' + esc(href) + '" target="_blank" rel="noopener">' + loc('proj.boardOpen', '開啟') + '</a></p>';
    }
    // ---- the focus page: /f/<id>/<tab>, one session's plan or gate alone ----
    // docs/90-agent/plans/2026-10-21-station-focus-design.md §1. lib/station.js
    // `focusShell` sets `window.STATION_FOCUS`, loads one session's row and
    // detail (`serializeFocus`) in place of station-data.js, and loads
    // assets/station/focus-page.js (FK_FOCUS), which draws the page; `focusBoot`,
    // below the guard, paints it and returns before the full page's boot runs.
    // Below the guard's `if (!doc) return;`: draws once, then re-reads the one
    // session's script through `reload` every five seconds while the browser
    // tab is visible — the ledger moves while a build runs. Only `w.*` and
    // hoisted functions here: the full page's `var`s further down are never
    // assigned, which is why `reload` holds its timeout as a literal.

    function focusBoot() {
        var F = w.STATION_FOCUS, FO = w.FK_FOCUS;
        var el = doc.getElementById('focus');
        var open = {};
        if (el.addEventListener) el.addEventListener('click', function (e) {
            var t = e.target, sm = t && typeof t.closest === 'function' ? t.closest('details[data-gv] > summary') : null;
            if (sm && sm.parentNode) open[sm.parentNode.getAttribute('data-gv')] = !sm.parentNode.open;
        });
        var last = null;
        var paint = function () {
            var html = FO.keepOpen(FO.page(S, w.STATION_DETAIL, F), open);
            if (!FO.repaint(last, html, doc.activeElement)) return;
            last = html;
            el.innerHTML = html;
            if (w.FK_GATE && w.FK_GATE.diagrams) w.FK_GATE.diagrams(el);
        };
        paint();
        if (!S.serve || !w.setInterval) return;
        w.setInterval(function () {
            if (doc.hidden) return;
            // A stopped server, a 404 or a hang must not leave the last ledger looking current.
            reload('/station/focus/' + encodeURIComponent(F.id) + '.js', function (ok) {
                if (ok) { S = w.STATION || S; paint(); }
                el.classList.toggle('fm-stale', !ok);
            });
        }, 5000);
    }
    // What the redesigned pages' modules (assets/station/*-page.js, tip.js,
    // gate-frame.js) draw with, beside the spend modules' helpers above: a
    // session's cost is `usd + agentUsd` on every page (station redesign §6), and
    // the glyph, chips, ages and links are the ones the old pages drew. All
    // hoisted declarations, so this one assign sees them even though some are
    // written further down; it sits above `if (!doc) return;` so a module test
    // under `require` has them too.
    Object.assign(w.FK_KIT, { cost: cost, usd: usd, mins: mins, ago: ago, stamp: stamp, keelGlyph: keelGlyph, shortLabel: shortLabel,
        projectHash: projectHash, family: family, modelKey: modelKey, modelLabel: modelLabel, icon: icon, loc: loc, ROUTE: ROUTE,
        // The focus page (assets/station/focus-page.js) draws with these too.
        keelProgress: keelProgress, stageNow: stageNow, planNewest: planNewest, gateTabHtml: gateTabHtml, shellsHtml: shellsHtml });
    // ---- tune: a block changed, continued: what the tests import -----------

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            knownPkey: knownPkey,
            boardLinkHtml: boardLinkHtml,
            tokens: tokens, mins: mins, hours: hours, usd: usd, ago: ago, day: day,
            stamp: stamp, esc: esc, cost: cost, labels: labels, delta: delta, match: match,
            statePill: statePill, clearStaleControl: clearStaleControl,
            openSections: openSections, downsample: downsample, lineChart: lineChart,
            riseText: riseText, ctxSection: ctxSection, seqHtml: seqHtml, orderSection: orderSection,
            dur: dur, tasksHtml: tasksHtml, dispatchHtml: dispatchHtml, replayHtml: replayHtml, dispatchStagesHtml: dispatchStagesHtml, segmentsOf: segmentsOf, stageCost: stageCost, totalSuffix: totalSuffix, splitHtml: splitHtml, planTabHtml: planTabHtml, planRel: planRel, gateTabHtml: gateTabHtml,
            splitCount: splitCount, taskCount: taskCount,
            pendingGateHtml: pendingGateHtml, pgAnswers: pgAnswers, todoEntry: todoEntry, riseTodo: riseTodo, backTodo: backTodo, todoSpot: todoSpot,
            localDay: localDay, lastDays: lastDays, parseHash: parseHash, family: family, modelKey: modelKey, modelLabel: modelLabel, sessionTotals: sessionTotals,
            windowTotals: windowTotals, dayBars: dayBars, projectRows: projectRows, kpiHtml: kpiHtml,
            histSvg: histSvg, legendHtml: legendHtml, projectsHtml: projectsHtml, recentHtml: recentHtml,
            dayStart: dayStart, projectHead: projectHead, sessionPoints: sessionPoints, projectChart: projectChart,
            projectSessionsHtml: projectSessionsHtml,
            timelineModel: timelineModel, timelineSvg: timelineSvg, costModel: costModel, costHtml: costHtml,
            sessionHeadHtml: sessionHeadHtml, tabsHtml: tabsHtml, serveLost: serveLost, talkHtml: talkHtml, talkBody: talkBody,
            heroEyebrow: heroEyebrow, effortChip: effortChip, tourPage: tourPage,
            railHtml: railHtml, liveTag: liveTag,
            navHtml: navHtml, navCounts: navCounts, recentRows: recentRows, nowHtml: nowHtml,
            segTip: segTip,
            tk: tk,
            stageShare: stageShare, costShareHtml: costShareHtml, subtabsHtml: subtabsHtml,
            liveSubsHtml: liveSubsHtml, shellsHtml: shellsHtml,
            NAV_TREE: NAV_TREE,
            tuneOpen: tuneOpen, tuneEvents: tuneEvents, toastText: toastText, floatHtml: floatHtml, fkBoxParse: fkBoxParse, fkBoxClamp: fkBoxClamp, gateCountdownHtml: gateCountdownHtml, noteHtml: noteHtml, floatNotes: floatNotes, clock: gateClock,
            readAll: readAll, dismissNote: dismissNote, clearNotes: clearNotes, goneParse: goneParse, goneKeys: goneKeys,
            changedParts: changedParts, seenHtml: seenHtml, drawList: drawList, sessionPage: sessionPage,
            recordHtml: recordHtml, recordPageHtml: recordPageHtml, boardsHtml: boardsHtml, listAskRow: listAskRow,
        };
    }
    if (!doc) return;
    // The focus page (lib/station.js `focusShell`) has no nav, no dashboard
    // and no hash routes: it draws one session's tab and stops here.
    if (w.STATION_FOCUS) return focusBoot();
    var f = { q: '', state: '', project: '', stage: '' };
    var route = parseHash(w.location && w.location.hash), sel = null, sortKey = 'updated', sortDir = -1;
    // The home page's two segmented controls; Tasks 7 and 8 add their own keys.
    var view = { metric: 'usd', dim: 'model', notes: [], fkOpen: false };
    // `hh:mm` while the server is gone, `null` while it answers. The poll at
    // the bottom of this file owns it; the hero's eyebrow reads it, which is
    // why it is declared out here rather than beside the poll.
    var frozenAt = null;
    // When the data on screen was last read: at load, then at every re-read
    // below. The session page's live tag and the footer both say it.
    var polledAt = Date.now();
    // The sessions ticked for 比較, oldest tick first; a third tick drops the first.
    var picked = [];
    // `NOW`, `LAB`, `DAYS`, `PREV`, `TODAY`, `NAMES` and `PKEYS` are derived
    // from `S` by `freshen()`, below the live-refresh guard — called here for
    // the first draw and again on every re-read, so there is one derivation
    // rather than two that could drift apart.
    var NOW, LAB, DAYS, PREV, TODAY, NAMES, PKEYS;
    freshen();
    var VIEWS = {};
    var rows = function () {
        return S.sessions.filter(function (s) { return match(s, f); });
    };

    function taskCell(s) {
        return '<div class="ell" title="' + esc(s.task) + '" style="font-weight:500">'
            + esc(s.task || loc('tune.unnamed', '（未命名）')) + '</div>'
            + '<div class="mute ell" style="font-size:11px;margin-top:2px">'
            + esc(LAB[s.root]) + ' · ' + ago(s.updated) + '</div>';
    }
    function stageCell(s) {
        var pct = s.steps ? Math.round(s.step / s.steps * 100) : 0;
        return '<div style="display:flex;align-items:center;gap:8px">'
            + '<div class="mini" style="flex:1"><span style="width:' + pct + '%;background:'
            + (STAGE_C[s.stage] || 'var(--ind)') + '"></span></div>'
            + '<span class="mono mute" style="font-size:11px">' + s.step + '/' + s.steps
            + '</span></div><div class="mute" style="font-size:11px;margin-top:3px">'
            + esc(s.stage || '—') + '</div>';
    }
    // A gone registry keeps its facet, so selecting it has to say why the pane
    // went empty. Without this the page answers a click with a blank screen and
    // the reader cannot tell a gone registry from a filter that matched nothing.
    function goneNote(root) {
        if (!root) return '';
        var hit = S.projects.filter(function (p) { return p.root === root; });
        if (!hit.length || !hit[0].gone) return '';
        return '<div class="card" style="margin-bottom:14px"><div class="cbody">'
            + '<p style="margin:0"><b>' + esc(hit[0].root) + '</b></p>'
            + '<p class="mute" style="margin:4px 0 0">gone — no sessions/ here any more. '
            + 'The registry keeps its place until it is forgotten by name: '
            + '<code>station.js --forget</code>.</p></div></div>';
    }

    // The new layout has no per-registry meta line, so a selected (and not
    // gone) registry gets a small card in `goneNote()`'s place instead: how
    // many of its session files did not parse — the hooks drop a corrupt
    // entry silently and correctly, so this is the only place that count
    // surfaces — its build directories with a file count each, and when its
    // map.md last changed.
    function registryNote(root) {
        if (!root) return '';
        var hit = S.projects.filter(function (p) { return p.root === root; });
        if (!hit.length || hit[0].gone) return '';
        var p = hit[0];
        var own = S.sessions.filter(function (s) { return s.root === p.root; });
        return '<div class="card" style="margin-bottom:14px"><div class="cbody">'
            + '<div style="display:flex;align-items:center;gap:10px">'
            + '<p class="mute" style="margin:0;flex:1">' + loc('tune.nSessionFilesUnreadable', '{n} 個 session 檔案讀不到', { n: p.unreadable })
            + '</p>' + clearStaleControl(p, own) + '</div>'
            + '<p class="mute" style="margin:4px 0 0">map.md '
            + (p.mapAt ? loc('tune.updatedAt', '更新於 {t}', { t: day(p.mapAt) }) : loc('tune.doesNotExist', '不存在')) + '</p>'
            + (p.build.length
                ? '<p class="mute" style="margin:4px 0 0">' + loc('tune.buildColon', 'build：') + p.build.map(function (b) {
                    return esc(b.name) + ' (' + b.files + ')';
                }).join(loc('tune.listSep', '、')) + '</p>'
                : '<p class="mute" style="margin:4px 0 0">' + loc('tune.noBuildFolder', '沒有 build 資料夾') + '</p>')
            + boardLinkHtml(p, S.serve, S.profiles && S.profiles.machine && S.profiles.machine.values)
            + '</div></div>';
    }

    // The home page answers the search box and nothing else: the list page's
    // facets narrow the list page, and a facet left set there that quietly
    // shrank these totals would read as a quieter month.
    function homeRows() {
        return S.sessions.filter(function (s) { return match(s, { q: f.q, state: '', project: '', stage: '' }); });
    }
    function homeOpts(sel) {
        return { metric: view.metric, dim: view.dim, sel: sel, today: TODAY, days: DAYS, names: NAMES, pkeys: PKEYS };
    }
    // ---- 儀表板 (`#/`): four cards, each read off the rows its full page reads
    // — `homeRows()` through the same filters — so a card's number is the
    // number that page shows.
    function msOf(t) { return typeof t === 'number' ? t : Date.parse(t); }
    // Each card writes its own `data-block` literally, so the tune proxy and
    // tests/station-dispatch-view.test.js can find it in this file.
    function dashHead(ico, title, href, n, cls) {
        return '<div class="dcard-h">' + icon(ico) + '<b>' + title + '</b>'
            + (n === undefined ? '' : '<span class="kn' + (cls ? ' ' + cls : '') + '">' + n + '</span>')
            + '<span class="spacer"></span>'
            + '<a class="dmore" href="' + href + '">' + loc('dash.seeAll', '查看全部 →') + '</a></div>';
    }
    // The promo film's v5 glyph (assets/station/tour-ring.js promo30v5 `glyph`,
    // its small branch; ported from .fankeel/build/2026-10-01-station-redesign/
    // gen.js) as an SVG string: six segments survey..audit, the edge land, the
    // core the task. `o.seg(i)` and `o.edge` give each part's state — 'done',
    // 'now', 'todo' — or null to leave it out (`o.edge` undefined is 'done');
    // `o.c` is the colour of the stage now, `o.cls` more classes.
    function keelGlyph(o) {
        o = o || {};
        var segState = o.seg || function () { return 'done'; }, edgeState = o.edge === undefined ? 'done' : o.edge;
        var RAD = Math.PI / 180, POINTY = [-90, -30, 30, 90, 150, 210], ANG = [120, 180, 240, 300, 0, 60];
        var Ro = 50, Ri = 31, cut = 7, ew = 8, tr = 21, d = (cut / 2) / Math.sin(Math.PI / 3);
        var at = function (r, a) { return [60 + r * Math.cos(a * RAD), 60 + r * Math.sin(a * RAD)]; };
        var mv = function (p, q) { var L = Math.hypot(q[0] - p[0], q[1] - p[1]); return [p[0] + (q[0] - p[0]) / L * d, p[1] + (q[1] - p[1]) / L * d]; };
        var P = function (pts) { return 'M' + pts.map(function (p) { return p.map(function (v) { return v.toFixed(2); }).join(' '); }).join('L') + 'Z'; };
        var segs = ANG.map(function (a, i) {
            var st = segState(i);
            if (!st) return '';
            var o0 = at(Ro, a - 30), o1 = at(Ro, a + 30), i0 = at(Ri, a - 30), i1 = at(Ri, a + 30);
            return '<path class="gseg ' + st + '" style="--i:' + i + ';--dx:' + (14 * Math.cos(a * RAD)).toFixed(1) + 'px;--dy:' + (14 * Math.sin(a * RAD)).toFixed(1)
                + 'px" d="' + P([mv(o0, o1), mv(o1, o0), mv(i1, i0), mv(i0, i1)]) + '"/>';
        }).join('');
        return '<svg class="glyph k-only' + (o.cls ? ' ' + o.cls : '') + '" viewBox="0 0 120 120" aria-hidden="true"' + (o.c ? ' style="--c:' + o.c + '"' : '') + '>' + segs
            + (edgeState ? '<path class="gedge ' + edgeState + '" d="' + P(POINTY.map(function (a) { return at(Ro, a); })) + '" stroke-width="' + ew + '"/>' : '')
            + '<path class="gcore" d="' + P(POINTY.map(function (a) { return at(tr, a); })) + '"/></svg>';
    }
    // A session's progress on the glyph: a stage the route has passed is done,
    // the stage it is at is now, one still to come is todo, one the route skips
    // is left out; land is the edge. Then the film's header count, `04 / 07 build`.
    function keelProgress(s) {
        var route = s.route || [], at = route.indexOf(s.stage);
        var state = function (k) { var i = route.indexOf(k); return i < 0 ? null : i < at ? 'done' : i === at ? 'now' : 'todo'; };
        var live = s.state === 'live' && !s.gateAt && s.busy === true;
        return keelGlyph({ cls: 'prog' + (live ? ' live' : ''), seg: function (i) { return state(ROUTE[i]); }, edge: state('land'), c: at >= 0 ? 'var(--st-' + esc(s.stage) + ')' : '' });
    }
    function keelStage(s) {
        var route = s.route || [], at = route.indexOf(s.stage);
        if (at < 0) return '';
        var two = function (n) { return ('0' + n).slice(-2); };
        return '<span class="kst k-only" style="--c:var(--st-' + esc(s.stage) + ')"><b>' + two(at + 1) + '</b><i>&nbsp;/&nbsp;' + two(route.length) + '</i><u>' + esc(s.stage) + '</u></span>';
    }
    // A focus page link (`/f/<id>/<stage>`, scripts/station.js) where serve
    // answers one; a page opened from file:// has no server, so it keeps the hash.
    function focusHref(id, stage, serve) {
        return serve ? '/f/' + encodeURIComponent(id) + '/' + encodeURIComponent(stage || 'timeline') : sessionHash(id);
    }
    if (typeof module !== 'undefined' && module.exports) module.exports.focusHref = focusHref;
    function tdShow(dlg, st, focus) {
        [].forEach.call(dlg.querySelectorAll('[role=tab]'), function (b) {
            var on = b.getAttribute('data-st') === st;
            b.setAttribute('aria-selected', String(on));
            b.setAttribute('tabindex', on ? '0' : '-1');
            if (on && focus) b.focus();
        });
        [].forEach.call(dlg.querySelectorAll('[role=tabpanel]'), function (p) { p.hidden = p.getAttribute('data-st') !== st; });
    }
    doc.addEventListener('click', function (e) {
        var t = e.target;
        if (!t || !t.closest) return;
        var dlg = t.closest('.tdlg');
        if (!dlg) return;
        var tab = t.closest('[role=tab]');
        if (tab) tdShow(dlg, tab.getAttribute('data-st'), true);
        else if (t.closest('[data-tdlg-close]') || t === dlg) dlg.close();
    });
    doc.addEventListener('keydown', function (e) {
        var b = e.target && e.target.closest ? e.target.closest('.tdlg [role=tab]') : null;
        if (!b) return;
        var tabs = [].slice.call(b.parentNode.querySelectorAll('[role=tab]')), i = tabs.indexOf(b), n = tabs.length;
        var j = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i + n - 1) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
        if (j < 0) return;
        e.preventDefault();
        tdShow(b.closest('.tdlg'), tabs[j].getAttribute('data-st'), true);
    });
    // The eight cards the library adds (2026-10-16 mockup, dash-library), each
    // off by default and read off fields `window.STATION` already carries.
    // A list card's rows are `[k, t, v]`, already escaped.
    var DASH_SHOWN = 6;
    function dashTodoName(pkey) { return esc(shortLabel(NAMES[pkey] || pkey)); }
    // Sums of `dayBars` parts across the window, one per key, largest first.
    function dashParts(bars) {
        var sum = {}, est = {};
        bars.days.forEach(function (b) {
            Object.keys(b.parts).forEach(function (k) { sum[k] = (sum[k] || 0) + b.parts[k]; if (b.est[k]) est[k] = true; });
        });
        return Object.keys(sum).map(function (k) { return { k: k, v: sum[k], estimated: !!est[k] }; }).sort(function (a, b) { return b.v - a.v; });
    }
    function dashByProj(R) {
        var rows = dashParts(dayBars(R, 'usd', 'project', DAYS)), mx = rows.length ? rows[0].v : 1;
        return '<section class="dcard" data-block="dash-byproj">' + dashHead('barh', loc('dash.cardByProj', '依專案花費'), '#/projects')
            + (rows.length ? '<div class="xc-bars">' + rows.slice(0, DASH_SHOWN).map(function (r, i) {
                return '<span class="k" title="' + esc(NAMES[r.k] || r.k) + '">' + dashTodoName(r.k) + '</span><span class="bar' + (i ? '' : ' top') + '"><i style="--w:'
                    + (r.v / mx * 100).toFixed(1) + '%"></i></span><span class="v">' + usd(r.v, true) + estMark(r) + '</span>';
            }).join('') + '</div>' : '<p class="dnone">' + loc('dash.noSpend30d', '近 30 天沒有花費') + '</p>') + '</section>';
    }
    // The last seven days' tokens, the five kinds `dayBars` reads off `days[].tokens`.
    function dashTokens7(R) {
        var bars = dayBars(R, 'tokens', 'kind', DAYS.slice(-7)), list = bars.days, mx = bars.max || 1;
        var kind = {};
        var notes = w.FK_KINDS ? w.FK_KINDS.notes(S.prices) : {};
        dashParts(bars).forEach(function (r) { kind[r.k] = r.v; });
        var tot = list.reduce(function (n, b) { return n + b.total; }, 0);
        return '<section class="dcard" data-block="dash-tokens7">' + dashHead('barv', loc('dash.cardTokens7', '近 7 天 token'), '#/days')
            + '<div class="dbig">' + tokens(tot) + '</div>'
            + '<div class="xc-cols" role="img" aria-label="' + esc(loc('dash.cardTokens7', '近 7 天 token')) + '">' + list.map(function (b) {
                return '<i title="' + esc(b.day + ' ' + tokens(b.total)) + '" style="--h:' + (b.total / mx * 100).toFixed(1) + '%"></i>';
            }).join('') + '</div>' + (list.length ? '<div class="xc-days"><span>' + list[0].day.slice(5) + '</span><span>' + list[list.length - 1].day.slice(5) + '</span></div>' : '')
            + '<div class="dkv">' + KIND_KEYS.map(function (k) {
                return '<span' + (notes[k] ? ' title="' + esc(notes[k]) + '"' : '') + '>' + esc(KIND_LABEL[k]) + ' <b>' + tokens(kind[k] || 0) + '</b></span>';
            }).join('') + '</div></section>';
    }
    function dashModels(R) {
        var rows = dashParts(dayBars(R, 'usd', 'model', DAYS)), tot = rows.reduce(function (n, r) { return n + r.v; }, 0);
        var pct = function (r) { return Math.round(r.v / tot * 100) + '%'; };
        var c = function (r) { return 'var(--m-' + (r.k === 'other' ? 'other' : r.k.split('-')[0]) + ')'; };
        return '<section class="dcard" data-block="dash-models">' + dashHead('pie', loc('dash.cardModels', '模型用量分布'), '#/days')
            + (rows.length ? '<div class="xc-stack">' + rows.map(function (r) {
                return '<i title="' + esc(modelLabel(r.k)) + '" style="--w:' + (r.v / tot * 100).toFixed(1) + '%;--c:' + c(r) + '"></i>';
            }).join('') + '</div><ul class="xc-key">' + rows.map(function (r) {
                return '<li style="--c:' + c(r) + '">' + esc(modelLabel(r.k)) + ' <b>' + pct(r) + '</b></li>';
            }).join('') + '</ul><p class="xc-note">' + loc('dash.modelsBySpend', '按近 30 天的花費算') + '</p>' : '<p class="dnone">' + loc('dash.noSpend30d', '近 30 天沒有花費') + '</p>') + '</section>';
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports.dashByProj = dashByProj; module.exports.dashTokens7 = dashTokens7; module.exports.dashModels = dashModels;
    }
    // What daysPage last drew, so the hover card reads the same bars the chart
    // did. `chartOff` holds, per dim, the legend entries clicked out of the
    // chart — in memory only, so the 3 s redraw keeps them and a reload clears
    // them. `chartPin` is never set now that a click hides instead of pins;
    // `chartPanel` is whether the 篩選 panel is open, kept across redraws too.
    var chartBars = null, chartOpts = null, chartPin = null, chartHover = false, chartOff = {}, chartPanel = false;
    // What the pointer is on — a column `{day, key, cx}` or a legend entry
    // `{legend}` — so a redraw under a still pointer can put the hover back.
    var chartAt = null;
    function chartTipEl() {
        var t = doc.getElementById('charttip');
        if (!t) {
            t = doc.createElement('div');
            t.id = 'charttip';
            t.setAttribute('role', 'tooltip');
            doc.body.appendChild(t);
        }
        return t;
    }
    // Light one series everywhere — its segments and its legend entry. null clears.
    function chartFocus(key) {
        var svg = doc.querySelector('.chart svg');
        if (!svg) return;
        if (key) svg.setAttribute('data-focus', key); else svg.removeAttribute('data-focus');
        [].forEach.call(doc.querySelectorAll('.chart .hseg, .legend [data-key]'), function (el) {
            if (key && el.getAttribute('data-key') === key) el.setAttribute('data-hot', ''); else el.removeAttribute('data-hot');
        });
    }
    function chartGuide(cx) {
        var g = doc.querySelector('.chart .hguide');
        if (!g) return;
        if (cx === null) { g.removeAttribute('data-on'); return; }
        g.setAttribute('x1', cx);
        g.setAttribute('x2', cx);
        g.setAttribute('data-on', '');
    }
    function chartHide() {
        chartTipEl().removeAttribute('data-on');
        chartGuide(null);
        chartFocus(chartPin);
        chartHover = false;
        chartAt = null;
    }
    // Beside the pointer, flipped to its other side at the window's right or
    // bottom edge — measured against the card as it is now.
    function chartPlace(px, py) {
        var t = chartTipEl(), pad = 14, r = t.getBoundingClientRect(), x = px + pad, y = py + pad;
        if (x + r.width > w.innerWidth - 8) x = px - pad - r.width;
        if (y + r.height > w.innerHeight - 8) y = py - pad - r.height;
        t.style.left = Math.max(8, x) + 'px';
        t.style.top = Math.max(8, y) + 'px';
    }
    // The 3 s re-read redraws the chart under a pointer that has not moved:
    // redraw the card from the new bars and light the same things again.
    function chartRestore() {
        if (!chartAt) { chartHide(); return; }
        if (chartAt.legend) { chartFocus(chartAt.legend); return; }
        var html = segTip(chartBars, chartOpts, chartAt.day, chartAt.key);
        if (!html) { chartHide(); return; }
        chartTipEl().innerHTML = html;
        chartPlace(chartAt.px, chartAt.py);
        chartGuide(chartAt.cx);
        chartFocus(chartAt.key || chartPin);
    }
    doc.addEventListener('mousemove', function (e) {
        if (route.view !== 'days' || !chartBars || !e.target.closest) return;
        var lk = e.target.closest('.legend [data-key]:not([data-off])');
        if (lk) {
            chartHide();
            chartFocus(lk.getAttribute('data-key'));
            chartHover = true;
            chartAt = { legend: lk.getAttribute('data-key') };
            return;
        }
        var seg = e.target.closest('.chart .hseg'), cell = seg || e.target.closest('.chart .hit');
        if (!cell) { if (chartHover) chartHide(); return; }
        var t = chartTipEl();
        t.innerHTML = segTip(chartBars, chartOpts, cell.getAttribute('data-day'), seg ? seg.getAttribute('data-key') : null);
        t.setAttribute('data-on', '');
        chartPlace(e.clientX, e.clientY);
        chartGuide(cell.getAttribute('data-cx'));
        chartFocus(seg ? seg.getAttribute('data-key') : chartPin);
        chartHover = true;
        chartAt = { day: cell.getAttribute('data-day'), key: seg ? seg.getAttribute('data-key') : null, cx: cell.getAttribute('data-cx'),
            px: e.clientX, py: e.clientY };
    });
    // 近 30 天: the hero that used to open the home page. A day in the hash is
    // marked on the chart; there is no day panel any more.
    function daysPage(r) {
        var R = homeRows();
        var RG = w.FK_RANGE || null;
        // The range (assets/station/spend-range.js): 近 30 天 unless the
        // reader picked another; without the module the page is as it was.
        var rng = RG ? RG.rangeOf(view.range, NOW, view.rangeFrom, view.rangeTo) : { kind: '30d', days: DAYS, prev: PREV, from: DAYS[0], to: TODAY };
        var picked = RG && view.range === 'custom' ? 'custom' : rng.kind;
        var sel = r.day && rng.days.indexOf(r.day) >= 0 ? r.day : null;
        var o = homeOpts(sel);
        o.days = rng.days;
        o.today = rng.to;
        o.off = chartOff[view.dim] || {};
        o.panel = chartPanel;
        var all = dayBars(R, view.metric, view.dim, rng.days), bars = visibleBars(all, o);
        chartBars = bars;
        chartOpts = o;
        var held = null;
        if (RG) {
            RG.listen(doc, function (a, b) { view.range = 'custom'; view.rangeFrom = a; view.rangeTo = b; draw(); });
            held = S.serve ? RG.load(rng, function () { if (route.view === 'days') draw(); }) : RG.held(rng);
        }
        return subtabsHtml('days') + '<section class="panel hero" data-block="days"><div class="hero-top"><div class="hero-title"><div class="eyebrow">' + icon('days')
            + heroEyebrow(frozenAt) + '</div>'
            + '<h1><b>' + rng.from.slice(5) + '</b> — <b>' + rng.to.slice(5) + '</b></h1></div>'
            + kpiHtml(windowTotals(R, rng.days), windowTotals(R, rng.prev), picked === '30d' ? null : RG.costLabel()) + '</div>'
            + (RG ? RG.kpiHtml(held, Boolean(S.serve)) : '')
            + '<div class="controls">'
            + (RG ? RG.controlsHtml(picked, rng, view.rangeFrom, view.rangeTo) : '')
            + '<div class="ctlgrp"><label>' + loc('dash.barHeight', '長條高度') + '</label>'
            + segHtml('metric', [['tokens', 'token'], ['usd', loc('dash.cost', '花費')], ['time', loc('dash.time', '時間')]], view.metric) + '</div>'
            + '<div class="ctlgrp"><label>' + loc('dash.splitBy', '分段') + '</label>'
            + segHtml('dim', [['model', loc('dash.byModel', '依 model')], ['project', loc('dash.byProject', '依專案')], ['stage', loc('dash.byStage', '依 stage')], ['who', loc('dash.mainVsAgent', '主 session 對 agent')],
                ['type', DIM_LABEL.type], ['version', loc('dash.byVersion', '依版本')], ['kind', loc('dash.byKind', '依成分')]],
                view.dim, view.metric === 'time' ? { model: loc('dash.noTimeByModel', '時間沒有 model 可分'), kind: loc('dash.noTimeByKind', '時間沒有成分可分'), type: NO_TIME_TYPE } : null) + '</div></div>'
            // The legend has a strip of its own, one line high: however many
            // series a dim has, the switches above and the chart below stay
            // where they are. What does not fit scrolls; 篩選 lists everything.
            + '<div class="lstrip"><div class="legend">' + legendHtml(all, o) + '</div>' + filterHtml(all, o) + '</div>'
            + '<div class="chart">' + histSvg(bars, o) + '</div></section>'
            + (w.FK_PANEL ? w.FK_PANEL.html(held, S.prices, Boolean(S.serve)) : '')
            + '<div class="dash kdash pcards" data-block="spend-cards"><div class="dcol" data-col="main">' + dashByProj(R) + dashTokens7(R)
            + '</div><div class="dcol" data-col="side">' + dashModels(R) + '</div></div>'
            + (w.FK_KINDS ? w.FK_KINDS.table(S.prices, S.pricesVerified) : '');
    }
    if (typeof module !== 'undefined' && module.exports) module.exports.daysPage = daysPage;
    view.closed = {};
    // What 派工 and 事件 are showing, kept across every redraw: the agents and
    // prompts opened, the phases opened, the state filter, the replay's hidden
    // kinds — and, from `dispatchUi`, the clock its tickers start from.
    view.open = {};
    view.prm = {};
    view.ph = {};
    view.kinds = {};
    view.pg = {};
    view.dfilter = 'all';
    view.dxv = 'chart';
    view.dxm = 'c';
    function dispatchUi(s) {
        return { open: view.open, prm: view.prm, ph: view.ph, filter: view.dfilter, view: view.dxv, metric: view.dxm,
            now: S.serve ? Date.now() : NOW, live: Boolean(S.serve) && Boolean(s) && s.state === 'live' };
    }
    // A stage column's dollars, from the data file's per-stage `usd`. A stage
    // the session went through twice has one figure for both visits, so
    // neither column claims it.
    function stageCost(m, s) {
        var by = {}, est = {}, n = {};
        (s.stages || []).forEach(function (w) { by[w.stage] = w.usd; est[w.stage] = w.estimated === true; });
        m.segs.forEach(function (g) { n[g.stage] = (n[g.stage] || 0) + 1; });
        m.segs.forEach(function (g) { if (n[g.stage] === 1 && isFinite(by[g.stage])) { g.usd = by[g.stage]; g.estimated = est[g.stage]; } });
        return m;
    }
    // ---- the completion record: the six fields land files -------------------
    // The six-field record land files (scripts/record.js): first in the
    // detail, above the tabs on the session page, and its 要求 under a landed
    // row of the list. One muted line where there is none.
    function recLabel(k) {
        switch (k) {
        case 'ask': return loc('rec.ask', '要求');
        case 'did': return loc('rec.did', '做了什麼');
        case 'why': return loc('rec.why', '為什麼這樣做');
        case 'checked': return loc('rec.checked', '驗過・沒驗過');
        case 'cost': return loc('rec.cost', '花費');
        default: return loc('rec.left', '還剩什麼');
        }
    }
    function recTitle() { return loc('rec.title', '完成紀錄'); }
    function recordRows(f, cls) {
        return ['ask', 'did', 'why', 'checked', 'cost', 'left'].map(function (k) {
            var v = f[k];
            var body = k === 'did'
                ? '<ul class="rec-ul">' + (Array.isArray(v) ? v : []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>'
                : esc(v || '');
            return '<div class="' + cls + '-r' + (k === 'ask' ? ' ' + cls + '-ask' : '') + '"><dt>' + recLabel(k) + '</dt>'
                + '<dd' + (k === 'cost' ? ' class="rec-num"' : '') + '>' + body + '</dd></div>';
        }).join('');
    }
    function recordNone(s) {
        return s && s.state !== 'down' ? loc('rec.noneYet', '完成紀錄在 land 時寫。') : loc('rec.none', '這個任務沒有完成紀錄。');
    }
    function recordSrc(r, cls) {
        return r.file ? '<p class="' + cls + '-src">' + loc('rec.alsoIn', '也記在 {f}', { f: '<span class="mono">' + esc(r.file) + '</span>' }) + '</p>' : '';
    }
    function recordHtml(s) {
        var r = s && s.record;
        if (!r || !r.fields) return '<p class="rec-none" data-block="record-none">' + recordNone(s) + '</p>';
        return '<section class="rec" data-block="record" aria-labelledby="rec-h"><h3 class="rec-h" id="rec-h">' + recTitle() + '</h3>'
            + '<dl class="rec-f">' + recordRows(r.fields, 'rec') + '</dl>' + recordSrc(r, 'rec') + '</section>';
    }
    function recordPageHtml(s) {
        var r = s && s.record;
        if (!r || !r.fields) return '<p class="recp-none" data-block="record-page-none">' + recordNone(s) + '</p>';
        return '<section class="panel recp" data-block="record-page" aria-labelledby="recp-h"><div class="h2" id="recp-h">' + recTitle() + '</div>'
            + '<dl class="recp-f">' + recordRows(r.fields, 'recp') + '</dl>' + recordSrc(r, 'recp') + '</section>';
    }
    // A task's Chartroom boards (lib/board.js), drawn by the served station at
    // GET /station/board/<id>/<name>.svg — the mockup's data-block="boards".
    // An <img>, never inline SVG: the labels are an agent's, and an SVG in an
    // <img> runs no script. A static copy has no route to draw them, so it
    // shows no block; `?v=` is the file's mtime, so a redrawn board reloads.
    function boardsHtml(s, served) {
        var list = s && Array.isArray(s.boards) ? s.boards : [];
        if (!served || !list.length) return '';
        var id = encodeURIComponent(String(s.id));
        var at = String(s.started || '').replace(/[-:]/g, '').slice(0, 15);
        var icon = '<svg class="ico" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
            + '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>';
        return '<section class="panel boards" data-block="boards" aria-labelledby="boards-h"><div class="h2" id="boards-h">' + icon
            + loc('rec.boards', 'AI 畫的圖') + '<small>' + loc('rec.boardsHint', '{n} 張・點一下在新分頁開完整的圖', { n: list.length }) + '</small></div>'
            + '<ul class="bd-grid">' + list.map(function (b) {
                var src = 'station/board/' + id + '/' + encodeURIComponent(String(b.name)) + '.svg?v=' + encodeURIComponent(String(b.updated));
                return '<li><a class="bd" href="' + esc(src) + '" target="_blank" rel="noopener" title="' + esc(loc('rec.boardOpen', '{f}，在新分頁開完整的圖', { f: b.name + '.board' })) + '">'
                    + '<span class="bd-th"><img src="' + esc(src) + '" alt="' + esc(loc('rec.boardAlt', '{f} 的縮圖', { f: b.name })) + '" loading="lazy" decoding="async"></span>'
                    + '<span class="bd-ft"><span class="bd-nm"><b>' + esc(b.name) + '</b>.board</span><span class="bd-go">' + loc('rec.boardGo', '開新分頁') + '</span></span></a></li>';
            }).join('') + '</ul>'
            + (/^\d{8}T\d{6}$/.test(at) ? '<p class="bd-src">' + loc('rec.boardsIn', '檔案在 {d}', { d: '<span class="mono">' + esc('.fankeel/build/task-' + at + '/') + '</span>' }) + '</p>' : '')
            + '</section>';
    }
    function listAskRow(s, sel) {
        var a = s && s.record && s.record.fields ? s.record.fields.ask : '';
        if (!a) return '';
        return '<tr class="ask" data-block="list-ask" data-id="' + esc(s.id) + '" aria-selected="' + (sel === s.id) + '"><td></td><td colspan="7">'
            + '<div class="ask-l" title="' + esc(a) + '"><span class="ask-k">' + loc('rec.ask', '要求') + '</span>' + esc(a) + '</div></td></tr>';
    }
    // ---- 儀表板 (`#/`), again: the pages that draw it ---------
    function sessionPage(r) {
        var s = S.sessions.filter(function (x) { return x.id === r.id; })[0];
        // A session from the 花費 page's top list need not be in any
        // registry; its 對話 tab still has a transcript to read, which the
        // server's talk route finds under its own config dir.
        if (!s && r.tab === 'talk' && w.FK_PANEL) {
            if (S.serve && !TALK[r.id]) talkLoad(r.id, true);
            return w.FK_PANEL.talkOnly(r.id, talkHtml(r.id, S.serve ? TALK[r.id] : { turns: [], total: null, state: 'static' }));
        }
        if (!s) return '<section class="panel"><p class="note">' + loc('dash.noSessionOnPage', '這頁上沒有 session {id}', { id: esc(r.id) }) + '</p></section>';
        needDetail(s);
        var x = DETAIL[s.id] || null;
        // 概覽 draws its money from `days` on the data file, so that half answers
        // before the detail script has loaded; the timeline and the two lists
        // need the detail. The old 花費 tab's stage × model table is the
        // 明細 under the bar.
        var L = stageShare(s, x), hi = view.hiId === s.id ? view.hi : null;
        var legend = '<div class="lane-legend"><span><i class="sw" style="background:var(--st-build);opacity:.35"></i>' + loc('dash.stageTint', 'stage 底色') + '</span>'
            + '<span><i class="hatchsw"></i>' + loc('dash.waitingOnYouGate', '等你回答（gate）') + '</span>'
            + '<span><i class="sw ln" style="background:var(--ctx)"></i>' + loc('dash.mainSessionContext', '主 session context') + '</span>'
            + MODEL_KEYS.map(function (k) {
                return '<span><i class="sw" style="background:var(--m-' + k + ')"></i>' + k + '</span>';
            }).join('')
            + '<span><i class="sw" style="background:var(--s-agent)"></i>' + loc('dash.backgroundAgent', '背景 agent') + '</span>'
            + '<span><i class="sw" style="background:var(--s-workflow)"></i>workflow</span></div>';
        // The bar leads: it is short, and the timeline under it can run to
        // dozens of agent rows.
        var overview = costShareHtml(L, hi) + (x ? legend + '<div class="chart tl">' + timelineSvg(stageCost(timelineModel(x), s), view.closed, hi) + '</div>'
                + '<div class="note">' + loc('dash.timelineAxisHint', '橫軸是真實時間：stage 的底色寬度等於實際經過的時間，context 曲線畫在上面；游標停在圖上看那一刻的 stage、時間與 context；點一下標出那個 stage；點 workflow 那列收合或展開。') + '</div>'
            : detailNote(s))
            + '<details class="csmore"><summary>' + loc('dash.stageModelDetail', 'stage × model 明細') + ' <small>' + loc('dash.tokenUsdMainLoop', 'token 與各自的 USD，主迴圈') + '</small></summary>'
            + costHtml(costModel(s.days), x) + '</details>'
            + (x ? '<div class="det">' + ctxSection(s, x, true) + tasksHtml(x.tasks) + '</div>' : '');
        // 對話 is not in the detail script: its first visit asks the server for
        // the first page (`talkLoad`), and what came back stays in TALK. A page
        // written to a file has no server to ask.
        if (r.tab === 'talk' && S.serve && !TALK[s.id]) talkLoad(s.id, true);
        var talk = S.serve ? TALK[s.id] : { turns: [], total: null, state: 'static' };
        var body = r.tab === 'dispatch' ? (x ? dispatchStagesHtml(L, s.id, hi) + '<div class="det">' + dispatchHtml(x, s, dispatchUi(s)) + '</div>' : detailNote(s))
            : r.tab === 'events' ? (x ? '<div class="det">' + replayHtml(x, view.kinds, s) + '</div>' : detailNote(s))
                : r.tab === 'talk' ? talkHtml(s.id, talk)
                    : r.tab === 'plan' ? (x ? planTab(s, x) : detailNote(s))
                    : r.tab === 'gate' ? (x ? gateTab(s, x) : detailNote(s))
                        : overview;
        // The film's header (2026-10-01 layout): the glyph filled as the route
        // is, `0N / 0M stage` over the title, the meta chips beside them.
        return '<section class="panel kshead" data-block="session-head"><div class="eyebrow">session <span class="mono">' + esc(String(s.id).slice(0, 8)) + '</span> · '
            + '<a href="' + projectHash(s.pkey) + '">' + esc(NAMES[s.pkey] || s.pkey) + '</a> · ' + stamp(Date.parse(s.started)) + '</div>'
            + '<div class="ks-top">' + keelProgress(s) + '<div class="ks-t">' + keelStage(s)
            + '<h1 class="s-title">' + esc(s.task || loc('dash.unnamed', '（未命名）')) + '</h1></div>'
            + '<div class="s-meta">' + statePill(s) + (S.serve ? liveTag(s.state === 'live', polledAt, Date.now()) : '')
            + (s.model ? '<span class="chip"><i class="sw" style="background:var(--m-' + family(s.model) + ')"></i>' + loc('dash.mainSession', '主 session') + ' <span class="mono">'
                + esc(s.model) + '</span></span>' : '') + effortChip(s.effort) + '</div></div>'
            + railHtml(s, Boolean(S.serve) && s.state === 'live', S.serve ? Date.now() : NOW)
            + sessionHeadHtml(s, x) + '</section>' + recordPageHtml(s) + boardsHtml(s, Boolean(S.serve))
            + tabsHtml(s, r.tab, x, talk && talk.total !== null ? talk.total : null) + '<section class="panel' + (r.tab === 'plan' ? ' pv" data-block="plan-tab"' : r.tab === 'gate' ? ' pv gv" data-block="gate-tab"' : '"' + (r.tab === 'dispatch' ? ' data-block="dispatch"' : '')) + '>' + body + '</section>';
    }
    // 對話's turns, per session id, for as long as the page lives: a redraw
    // rewrites the panel, and what was fetched must not go with it. `talkLoad`
    // asks for the 100 turns after the ones held; `quiet` is for a call made
    // while a draw is under way, which must not start another. Its button is
    // heard by a click listener added on the first call: a button exists only
    // after one, and tests/station-hdl-c.test.js picks the page's document
    // listeners by their place in the order they were added at load.
    var TALK = {};
    var talkHeard = false;
    function talkLoad(id, quiet) {
        if (!talkHeard) {
            talkHeard = true;
            doc.addEventListener('click', function (e) {
                var t = e && e.target && e.target.closest ? e.target.closest('[data-talk]') : null;
                if (t) talkLoad(t.getAttribute('data-talk'));
            });
        }
        var held = TALK[id] || (TALK[id] = { turns: [], total: null, counts: null, skipped: null, state: '' });
        if (held.state === 'loading') return;
        held.state = 'loading';
        var redraw = function () { if (route.view === 'session' && route.id === id) draw(); };
        if (!quiet) redraw();
        fetch('station/talk/' + encodeURIComponent(id) + '?from=' + held.turns.length).then(function (r) {
            if (r.status === 404) return null;
            if (!r.ok) throw new Error(String(r.status));
            return r.json();
        }).then(function (page) {
            if (page) {
                held.turns = held.turns.concat(page.turns);
                held.total = page.total;
                held.counts = page.counts;
                held.skipped = page.skipped;
                held.spend = page.spend || null;
                held.state = '';
            } else {
                held.state = 'missing';
            }
            redraw();
        }, function () {
            held.state = 'failed';
            redraw();
        });
    }
    VIEWS.session = sessionPage;
    // `started` has a column of its own because the page this replaces sorted
    // by it, and a sort key with no header is a sort nobody can reach.
    var COLS = [['task', loc('dash.colTask', '任務')], ['stage', loc('dash.colStage', '階段')], ['burn', 'context'],
        ['cost', loc('dash.colCost', '花費')], ['state', loc('dash.colState', '狀態')], ['started', loc('dash.colStarted', '開始')], ['updated', loc('dash.colLastAction', '最後動作')]];
    function val(s, k) {
        if (k === 'cost') return cost(s);
        if (k === 'state') return { live: 0, stale: 1, down: 2 }[s.state];
        if (k === 'started') return Date.parse(s.started) || 0;
        return s[k];
    }
    // The 清單 facets' group icons, drawn the way `icon()` draws a page's.
    var FICON = {
        state: '<svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">'
            + '<circle cx="8" cy="8" r="5.8"/><path d="M8 2.2a5.8 5.8 0 0 1 0 11.6z" fill="currentColor" stroke="none"/></svg>',
        stage: '<svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"'
            + ' stroke-linecap="round"><circle cx="3" cy="8" r="1.6"/><circle cx="8" cy="8" r="1.6"/><circle cx="13" cy="8" r="1.6"/>'
            + '<path d="M4.6 8h1.8M9.6 8h1.8"/></svg>',
    };
    // Every 清單 facet is one pick, and in a row their options no longer fit,
    // so each is a trigger — its icon, the current pick with its count, a
    // caret — and its options live in a popover under it. The options are
    // still `[data-facet] button`s with `data-v` and `aria-pressed`, so the facet
    // click handler picks from here unchanged. A pick other than 全部 marks
    // the trigger and gets a × that puts it back. `pickOpen` (which one is
    // open) and `pickQ` (Registry's search box) are in memory, so the 3 s
    // redraw keeps the popover open and filtered.
    var pickOpen = null, pickQ = '', pickLast = null;
    var CARET = '<svg class="caret" viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><path d="M2 3.8 5 6.8l3-3" fill="none"'
        + ' stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    // `items` are `{ v, main, sub, n, lead, bar }`: `sub` a muted second line (and the
    // title), `lead` markup before the label, `bar` a 0–1 share drawn under it;
    // `search` puts a box over the rows.
    function pickHtml(key, ico, name, items, search) {
        var open = pickOpen === key, q = open ? pickQ.toLowerCase() : '', cur = items[0];
        items.forEach(function (it) { if (it.v === f[key]) cur = it; });
        // A pick whose option has gone (its last session moved on) still filters, so it still shows.
        if (f[key] && cur.v !== f[key]) cur = { v: f[key], main: f[key], n: 0 };
        var opt = function (it) {
            var on = f[key] === it.v, hide = q && (it.main + ' ' + (it.sub || '')).toLowerCase().indexOf(q) < 0;
            return '<button type="button" role="option" data-v="' + esc(it.v) + '" aria-pressed="' + on + '" aria-selected="' + on + '"'
                + (hide ? ' hidden' : '') + (it.sub ? ' title="' + esc(it.sub) + '"' : '') + '>' + (it.lead || '')
                + '<span class="ro-m"><span class="fl">' + esc(it.main) + '</span>'
                + (it.sub ? '<small>' + esc(it.sub) + '</small>' : '')
                + (it.bar !== undefined ? '<i class="rbar"><i style="width:' + Math.round(it.bar * 100) + '%"></i></i>' : '') + '</span>'
                + '<b class="fc">' + it.n + '</b></button>';
        };
        return '<div class="ctlgrp fg-' + key + '"><div class="rwrap"' + (cur.v ? ' data-set' : '') + '>'
            + '<button type="button" class="rbtn" data-pick="' + key + '" aria-haspopup="listbox" aria-expanded="' + open + '"'
            + ' aria-label="' + loc('dash.nameColonSub', '{name}：{sub}', { name: name, sub: esc(cur.sub || cur.main) }) + '" title="' + name + (cur.sub ? loc('dash.colonSub', '：{sub}', { sub: esc(cur.sub) }) : '') + '">'
            + ico + (cur.lead || '') + '<span class="fl">' + esc(cur.main) + '</span><b class="fc">' + cur.n + '</b>' + CARET + '</button>'
            + (cur.v ? '<button type="button" class="rclr" data-pickclr="' + key + '" aria-label="' + loc('dash.nameBackToAll', '{name}回到全部', { name: name }) + '" title="' + loc('dash.backToAll', '回到全部') + '">×</button>' : '')
            + (open ? '<div class="rpop">'
                + (search ? '<input type="search" data-pickq placeholder="' + loc('dash.findName', '找 {name}', { name: name }) + '" aria-label="' + loc('dash.findName', '找 {name}', { name: name }) + '" value="' + esc(pickQ) + '">' : '')
                + '<div class="seg" role="listbox" aria-label="' + name + '" data-facet="' + key + '">' + items.map(opt).join('') + '</div></div>' : '')
            + '</div></div>';
    }
    // The side bar's three facets, moved onto the page they narrow.
    function facetsHtml() {
        var n = { live: 0, stale: 0, down: 0 }, byStage = {}, byRoot = {}, all = S.sessions.length;
        S.sessions.forEach(function (s) {
            n[s.state]++;
            byStage[s.stage] = (byStage[s.stage] || 0) + 1;
            byRoot[s.root] = (byRoot[s.root] || 0) + 1;
        });
        var tail = S.projects.map(function (p) { return shortLabel(LAB[p.root] || p.root); });
        var stages = ROUTE.filter(function (k) { return byStage[k]; });
        var top = Math.max.apply(null, stages.map(function (k) { return byStage[k]; }).concat([1]));
        return '<div class="controls lctl">'
            + pickHtml('state', FICON.state, loc('dash.state', '狀態'), [{ v: '', main: loc('dash.all', '全部'), n: all }].concat(['live', 'stale', 'down'].map(function (k) {
                return { v: k, main: k, n: n[k], lead: '<i class="dot ' + k + '"></i>' };
            })))
            + pickHtml('project', icon('projects'), 'Registry', [{ v: '', main: loc('dash.all', '全部'), n: all }].concat(S.projects.map(function (p, i) {
                // The path's last segment, unless another registry ends the same way.
                var t = tail.filter(function (x) { return x === tail[i]; }).length > 1 ? LAB[p.root] || p.root : tail[i];
                return { v: p.root, main: t + (p.gone ? ' — gone' : ''), sub: p.root, n: byRoot[p.root] || 0 };
            })), S.projects.length > 6)
            // A stage's bar is its count against the busiest stage's.
            + pickHtml('stage', FICON.stage, loc('dash.whichStageStuck', '停在哪一階段'), [{ v: '', main: loc('dash.all', '全部'), n: all }].concat(stages.map(function (k) {
                return { v: k, main: k, n: byStage[k], lead: '<i class="dot" style="background:var(--st-' + esc(k) + ')"></i>', bar: byStage[k] / top };
            })))
            + '</div>';
    }
    // Ticking rows to compare: nothing in the header until one is ticked, then
    // a bar slides up from the bottom — how many, 比較 (live from two, since
    // 比較 lays two sessions side by side; a third tick drops the oldest), and
    // 清除. `#ncmp` is the count, rewritten in place on every tick.
    function selbarInner() {
        var n = picked.length;
        return icon('cmp') + '<span>' + loc('dash.pickedN', '已選 <b id="ncmp">{n}</b> 個', { n: n }) + '</span>'
            + (n >= 2 ? '<a class="sbtn pri" href="#/cmp">' + loc('dash.compare', '比較') + '</a>'
                : '<span title="' + loc('dash.pickAtLeastTwo', '至少選 2 個') + '"><button type="button" class="sbtn pri" disabled>' + loc('dash.compare', '比較') + '</button></span>')
            + '<button type="button" class="sbtn" data-cmpclear' + (n ? '' : ' tabindex="-1"') + '>' + loc('dash.clear', '清除') + '</button>';
    }
    function selbarHtml() {
        return '<div class="selbar" id="selbar" role="region" aria-label="' + loc('dash.checkedSessionsToCompare', '比較勾選的 session') + '"' + (picked.length ? ' data-on' : ' aria-hidden="true"') + '>'
            + selbarInner() + '</div>';
    }
    function listPage() {
        // A gone registry has no rows to lay out, so the note replaces the table
        // rather than sitting above it and pushing the list off the bottom.
        var head = '<div class="phead"><h1>' + icon('list') + loc('dash.listHeading', '清單') + '</h1><span class="chip" id="cnt"></span><span class="spacer"></span>';
        var gone = goneNote(f.project);
        var now = '<a class="ctl" href="#/live">' + icon('now') + loc('dash.now', '現在') + '</a></div>' + subtabsHtml('list');
        if (gone) return head + now + facetsHtml() + gone;
        return head + now + selbarHtml() + facetsHtml() + registryNote(f.project)
            + '<div class="listwrap">'
            + '<div class="card listcard"><div class="scroll"><table>'
            + '<colgroup><col style="width:34px"><col><col style="width:130px"><col style="width:80px">'
            + '<col style="width:78px"><col style="width:170px"><col style="width:86px">'
            + '<col style="width:92px"></colgroup>'
            + '<thead id="lh"></thead><tbody id="lb"></tbody></table></div></div>'
            + '<div class="card det" id="det"></div></div>';
    }
    function drawList() {
        // The gone-registry branch of listPage() renders no table.
        if (!doc.getElementById('lb')) return;
        var R = rows().sort(function (a, b) {
            var x = val(a, sortKey), y = val(b, sortKey);
            if (typeof x === 'string' || typeof y === 'string') {
                return sortDir * String(x).localeCompare(String(y));
            }
            return sortDir * ((x || 0) - (y || 0));
        });
        doc.getElementById('cnt').textContent = R.length + ' / ' + S.sessions.length;
        doc.getElementById('lh').innerHTML = '<tr><th class="cmpth" aria-label="' + loc('dash.pickToCompare', '選來比較') + '" title="' + loc('dash.checkTwoToCompare', '勾兩個 session 來比較') + '">' + icon('cmp') + '</th>' + COLS.map(function (c) {
            return '<th data-k="' + c[0] + '"'
                + (['burn', 'cost'].indexOf(c[0]) >= 0 ? ' class="r"' : '')
                + (sortKey === c[0] ? ' data-dir="' + (sortDir > 0 ? 'asc' : 'desc') + '"' : '')
                + '>' + c[1] + '</th>';
        }).join('') + '</tr>';
        doc.getElementById('lb').innerHTML = R.map(function (s) {
            var ask = listAskRow(s, sel);
            return '<tr' + (ask ? ' class="has-ask"' : '') + ' data-id="' + esc(s.id) + '" aria-selected="' + (sel === s.id) + '">'
                + '<td><input type="checkbox" data-cmp="' + esc(s.id) + '" aria-label="' + loc('dash.pickToCompare', '選來比較') + '"'
                + (picked.indexOf(s.id) >= 0 ? ' checked' : '')
                + (s.hasDetail ? '' : ' disabled title="' + loc('dash.noTranscriptToCompare', '沒有 transcript，沒有細節可比') + '"') + '></td>'
                + '<td>' + taskCell(s) + '</td><td>' + stageCell(s) + '</td>'
                + '<td class="r num mute">' + tokens(s.burn) + '</td>'
                + '<td class="r num">' + usd(cost(s), true) + estMark({ estimated: s.estimated && s.estimated.length }) + '</td>'
                + '<td class="c-state">' + statePill(s) + runningTag(s) + '</td>'
                + '<td class="num mute" style="font-size:11.5px">' + day(s.started) + '</td>'
                + '<td class="num mute" style="font-size:11.5px">' + ago(s.updated) + '</td></tr>' + ask;
        }).join('') || '<tr><td colspan="8"><div class="empty">' + loc('dash.noMatchingSessions', '沒有符合的 session') + '</div></td></tr>';
        if (R.length && !R.some(function (s) { return s.id === sel; })) sel = R[0].id;
        drawDetail();
    }

    // A registry-level bulk clear, beside its card's heading rather than a
    // row: counts how many of the rows handed to it are stale and, offline,
    // prints the same kind of copyable command each per-row control prints —
    // a static page cannot post either.
    function clearStaleControl(reg, rows) {
        var n = 0, i;
        for (i = 0; i < rows.length; i++) if (rows[i].state === 'stale') n++;
        if (!n) return '';
        if (!S.serve) {
            return '<code class="mono">node ' + esc(S.plugin || '<plugin>')
                + '/scripts/task.js clear &lt;id&gt;</code>';
        }
        return '<form method="post" action="/clear-stale">'
            + '<input type="hidden" name="nonce" value="' + esc(S.nonce || '') + '">'
            + '<input type="hidden" name="root" value="' + esc(reg.root) + '">'
            + '<button type="submit">clear ' + n + ' stale</button></form>';
    }
    // The clear control is the one place the served page and the written file
    // differ, and both forms come out of the data rather than out of two
    // renderers: `serve` is true only when a server produced this data file, and
    // `nonce` is the token that server will check. A file on disk has neither,
    // so it prints the command instead.
    function clearControl(s) {
        if (s.state !== 'stale') return '';
        if (S.serve) {
            return '<form class="clearform" method="post" action="/clear">'
                + '<input type="hidden" name="root" value="' + esc(s.root) + '">'
                + '<input type="hidden" name="id" value="' + esc(s.id) + '">'
                + '<input type="hidden" name="nonce" value="' + esc(S.nonce || '') + '">'
                + '<label><input type="checkbox" name="force" value="1"> force</label>'
                + '<button class="ctl" type="submit">clear</button></form>';
        }
        return '<div class="claims" style="margin-top:14px">node '
            + esc(S.plugin || '<plugin>') + '/scripts/task.js clear ' + esc(s.id)
            + ' --root "' + esc(s.root) + '" --session &lt;your session id&gt;</div>';
    }
    function drawDetail() {
        var d = doc.getElementById('det');
        if (!d) return;
        var hit = S.sessions.filter(function (x) { return x.id === sel; });
        if (!hit.length) { d.innerHTML = '<div class="empty">' + loc('dash.pickARow', '選一列') + '</div>'; return; }
        var s = hit[0];
        needDetail(s);
        var open = openSections(s);
        var x = DETAIL[s.id] || null;
        var tot = s.stages.reduce(function (n, w) {
            return n + Math.max(w.to - w.from, 0);
        }, 0) || 1;
        d.innerHTML = '<div class="cbody" style="padding-top:16px">'
            + '<div style="display:flex;gap:7px;align-items:center;margin-bottom:10px;'
            + 'flex-wrap:wrap">' + statePill(s)
            + '<span class="chip" title="' + esc(s.root) + '">' + esc(LAB[s.root])
            + '</span>'
            + (s.model ? '<span class="chip mono">'
                + esc(s.model.replace(/^claude-/, '')) + '</span>' : '') + '</div>'
            + '<h2 style="font-size:15px;line-height:1.45;margin-bottom:12px">'
            + esc(s.task || loc('dash.unnamed', '（未命名）')) + '</h2>'
            + recordHtml(s)
            + secOpen('s-sum', loc('dash.summary', '摘要'), esc(s.stage || '—') + ' · ' + mins(tot)
                + (x ? ' · ' + x.requests + ' requests' : ''), open)
            + (s.stages.length
                ? '<div class="strip">' + s.stages.map(function (w) {
                    var p = Math.max(w.to - w.from, 0) / tot * 100;
                    return '<div style="width:' + p + '%;background:'
                        + (STAGE_C[w.stage] || '#888') + '" title="' + esc(w.stage) + ' · '
                        + mins(w.to - w.from) + '">'
                        + (p > 11 ? esc(w.stage.slice(0, 5)) : '') + '</div>';
                }).join('') + '</div>'
                + '<table style="margin-top:10px"><colgroup><col><col style="width:56px">'
                + '<col style="width:58px"><col style="width:56px"></colgroup>'
                + '<thead><tr><th>' + loc('dash.thStage', '階段') + '</th><th class="r">' + loc('dash.thTime', '時間') + '</th><th class="r">ctx</th>'
                + '<th class="r">' + loc('dash.thWaitedOnYou', '等你') + '</th></tr></thead><tbody>'
                + s.stages.map(function (w) {
                    return '<tr><td><i class="dot" style="background:'
                        + (STAGE_C[w.stage] || '#888') + '"></i> ' + esc(w.stage) + '</td>'
                        + '<td class="r num">' + mins(w.to - w.from) + '</td>'
                        + '<td class="r num mute">' + tokens(w.burn) + '</td>'
                        + '<td class="r num mute">' + mins(w.waited) + '</td></tr>';
                }).join('') + '</tbody></table>'
                : '<p class="mute" style="font-size:12px">' + loc('dash.noStageRecord', '沒有分階段紀錄') + '</p>')
            + (s.next ? '<div class="note"><b>' + loc('dash.nextStep', '下一步') + '</b><br>' + esc(s.next) + '</div>' : '')
            + (s.notes.length
                ? '<div class="note" style="background:var(--soft)">'
                + s.notes.map(esc).join('<br>') + '</div>' : '')
            + '<dl class="dl"><dt>session</dt><dd class="mono" style="font-size:10.5px">'
            + esc(s.id) + '</dd>'
            + '<dt>route</dt><dd class="mono" style="font-size:11px">'
            + esc(s.route.join(' → ')) + '</dd>'
            + '<dt>' + loc('dash.started', '開始') + '</dt><dd class="num">' + stamp(Date.parse(s.started)) + '</dd>'
            + '<dt>' + loc('dash.last', '最後') + '</dt><dd class="num">' + stamp(s.updated) + '</dd>'
            + (s.ended ? '<dt>' + loc('dash.ended', '結束') + '</dt><dd>' + esc(s.ended.reason) + '</dd>' : '')
            + '<dt>' + loc('dash.total', '總計') + '</dt><dd class="num">' + tokens(s.burn) + ' · ' + usd(cost(s))
            + totalSuffix(s)
            + (s.agents ? ' · ' + s.agents + ' agents' : '') + '</dd>'
            + (x ? '<dt>requests</dt><dd class="num">' + x.requests + '</dd>' : '')
            + '<dt>guard</dt><dd>' + esc(s.guard || loc('dash.askDefault', 'ask (預設)')) + '</dd></dl>'
            + '</details>'
            + secOpen('s-claims', 'claims', loc('dash.nFiles', '{n} 個檔', { n: s.claims.length }), open)
            + (s.claims.length
                ? '<div class="claims">' + s.claims.map(function (p) {
                    return '<div title="' + esc(p) + '">' + esc(p) + '</div>';
                }).join('') + '</div>'
                : '<p class="mute" style="font-size:12px">' + loc('dash.none2', '沒有') + '</p>')
            + seenHtml(s.seen) + clearControl(s) + '</details>'
            + (x ? detailSections(s, x, open) : detailNote(s))
            + '</div>';
    }
    // The scan-time clauses were the old header's `depth stopped the scan in N
    // places` and `the scan ran out of time` — both are how a reader learns
    // the registry list may be incomplete. The unreadable-count clause is
    // separate: it is the total across every registry, and is hidden only on
    // 清單 once a registry there is selected, because `registryNote()`
    // already puts that registry's own count on the card in front of the
    // list — a corrupt-entry count must not require a click to find, so it
    // stays here everywhere else: home, session and the project page, whose
    // own card never hides it either.
    function genText() {
        var totalUnreadable = S.projects.reduce(function (n, p) {
            return n + (p.unreadable || 0);
        }, 0);
        return loc('dash.scannedAt', '掃描於 {t}', { t: stamp(NOW) })
            + loc('dash.pricesVerified', ' · 價目表 {t}', { t: S.pricesVerified })
            + (S.scanStats && S.scanStats.depthCuts
                ? loc('dash.depthCutScanAt', ' · depth 中止掃描 {n} 處', { n: S.scanStats.depthCuts }) : '')
            + (S.scanStats && S.scanStats.timedOut ? loc('dash.scanTimedOut', ' · 掃描逾時未跑完') : '')
            + (!(route.view === 'list' && f.project) && totalUnreadable
                ? loc('dash.nSessionFilesUnreadable', ' · {n} 個 session 檔案讀不到', { n: totalUnreadable }) : '')
            + (S.serve ? loc('dash.rereadEvery3s', ' · 每 3 秒重讀一次，最後一次 {t}', { t: clockSec(polledAt) }) : '');
    }
    // ---- the detail panel ----------------------------------------------
    // ' 估' after a dollar figure whose `g.estimated` is truthy: a stage, a day, a dispatch group or an aggregate
    // that carries a request priced from a family fallback. A session's own total counts ids with `totalSuffix`.
    function estMark(g) { return g && g.estimated ? ' ' + loc('det.estShort', '估') : ''; }
    function totalSuffix(s) {
        return (s.unpriced && s.unpriced.length ? ' (' + s.unpriced.length + ' unpriced)' : '')
            + (s.estimated && s.estimated.length ? ' (' + s.estimated.length + ' ' + loc('det.estShort', '估') + ')' : '');
    }
    // One session's detail is a script of its own, `station/detail/<id>.js`,
    // loaded the first time the session is opened: `lib/station.js` keeps it
    // out of `station-data.js`, which every `/fankeel` prompt rewrites.
    var DETAIL = w.STATION_DETAIL || (w.STATION_DETAIL = {});
    var asked = {};
    function needDetail(s) {
        if (!s.hasDetail || DETAIL[s.id] || asked[s.id]) return;
        asked[s.id] = 'loading';
        var el = doc.createElement('script');
        el.src = 'station/detail/' + encodeURIComponent(s.id) + '.js';
        var redraw = function () {
            if (route.view === 'cmp' || (route.view === 'session' && route.id === s.id)) draw();
            else if (sel === s.id) drawDetail();
        };
        el.onload = function () { asked[s.id] = 'loaded'; redraw(); };
        el.onerror = function () { asked[s.id] = 'failed'; redraw(); };
        doc.head.appendChild(el);
    }
    function detailNote(s) {
        return '<p class="tally">' + (!s.hasDetail
            ? loc('det.noTranscriptOnMachine', '這台機器的 config dir 裡沒有這個 session 的 transcript，所以沒有 context、階段順序、派工與過程還原')
            : asked[s.id] === 'failed' ? loc('det.detailFileUnreadable', '細節檔讀不到：station/detail/{id}.js', { id: esc(s.id) })
                : loc('det.loadingDetail', '讀取細節…')) + '</p>';
    }
    function detailSections(s, x, open) {
        return sec('s-ctx', 'context', loc('det.peakNRequests', '{peak} 峰值 · {n} requests', { peak: tokens(x.peak), n: x.requests }), ctxSection(s, x), open)
            + sec('s-order', loc('det.stageOrder', '階段順序'), loc('det.stepsBacktracks', '{n} 步 · 倒退 {b}', { n: x.seq.length, b: x.backtracks }), orderSection(s, x), open)
            + sec('s-split', loc('det.split', '分工'), splitCount(x), splitHtml(x), open)
            + sec('s-tasks', loc('det.tasks', '任務'), taskCount(x.tasks), tasksHtml(x.tasks), open)
            + sec('s-disp', loc('det.dispatch', '派工'), loc('det.nAgentsCents', '{n} 個 agent · {c}', { n: x.rows.length, c: cents(x.agentCents) + estMark({ estimated: estOf(x.rows) }) }), dispatchHtml(x, s, dispatchUi(s)), open)
            + sec('s-rp', loc('det.replay', '過程還原'), loc('det.nRows', '{n} 列', { n: x.events.length }), replayHtml(x, view.kinds, s), open);
    }

    // Which sections start open. A live session is watched for who is in which
    // file; an ended one is reviewed for what it cost. The replay starts closed
    // whatever the state: it is the longest section and the last one read.
    function openSections(s) {
        return s && s.state === 'live' ? ['s-sum', 's-claims', 's-split'] : ['s-ctx', 's-disp', 's-split'];
    }
    function secOpen(id, title, count, open) {
        return '<details class="sec" id="' + id + '"' + (open.indexOf(id) >= 0 ? ' open' : '') + '><summary>'
            + '<span class="t">' + title + '</span> <span class="cnt">' + count + '</span></summary>';
    }
    // What git saw this session write, under its claims and marked weak: git
    // names no writer, so none of it lights a clash. Nothing for none.
    function seenHtml(seen) {
        if (!seen || !seen.length) return '';
        return '<p class="mute" style="font-size:12px">' + loc('det.seenWeak', 'seen（弱：git 看到，沒有經過 hook）') + '</p>'
            + '<div class="claims">' + seen.map(function (p) {
                return '<div title="' + esc(p) + '">' + esc(p) + '</div>';
            }).join('') + '</div>';
    }
    function sec(id, title, count, body, open) {
        return secOpen(id, title, count, open) + body + '</details>';
    }
    function comma(n) {
        return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    function niceStep(v) {
        var steps = [1e3, 2e3, 5e3, 1e4, 25e3, 5e4, 1e5, 2e5, 25e4, 5e5, 1e6, 2e6, 5e6];
        for (var i = 0; i < steps.length; i++) if (v / steps[i] <= 5) return steps[i];
        return 1e7;
    }
    // At most `max` points, one per bucket, each bucket keeping its highest —
    // so the peak the tally names is a point the line still passes through.
    function downsample(points, max) {
        if (points.length <= max) return points.slice();
        var out = [];
        var size = points.length / max;
        for (var b = 0; b < max; b++) {
            var lo = Math.floor(b * size);
            var hi = Math.min(points.length, Math.floor((b + 1) * size));
            var best = points[lo];
            for (var i = lo + 1; i < hi; i++) if (points[i].y > best.y) best = points[i];
            out.push(best);
        }
        return out;
    }
    // One series: x is time, y the context each request carried. Stage moves
    // are vertical lines, dispatches out and back are dots on the line, the
    // five largest rises are numbered. `t0`, `t1` and `ymax` come from the
    // caller so two charts can share one scale.
    function lineChart(points, o) {
        var W = o.W || 340, H = o.H || 170, L = 40, R = 10, TOP = 14, B = 20;
        var t0 = o.t0, t1 = o.t1 > o.t0 ? o.t1 : o.t0 + 1, ymax = o.ymax || 1;
        var X = function (t) { return (L + (Math.max(Math.min(t, t1), t0) - t0) / (t1 - t0) * (W - L - R)).toFixed(1); };
        var Y = function (v) { return (H - B - Math.min(v, ymax) / ymax * (H - TOP - B)).toFixed(1); };
        var yAt = function (t) {
            var y = points.length ? points[0].y : 0;
            for (var i = 0; i < points.length && points[i].t <= t; i++) y = points[i].y;
            return y;
        };
        var pts = downsample(points, 240);
        var step = niceStep(ymax);
        var out = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.label || 'context') + '">';
        for (var v = 0; v <= ymax; v += step) {
            out += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '"/>'
                + '<text class="axis" x="' + (L - 4) + '" y="' + (Number(Y(v)) + 3) + '" text-anchor="end">' + tokens(v) + '</text>';
        }
        (o.marks || []).forEach(function (m) {
            if (!isFinite(m.t)) return;
            out += '<line class="bd ' + esc(m.kind) + '" x1="' + X(m.t) + '" x2="' + X(m.t) + '" y1="' + TOP + '" y2="' + (H - B)
                + '" stroke="' + (STAGE_C[m.stage] || 'var(--mute)') + '"><title>' + esc((m.stage || m.kind) + ' · ' + stamp(m.t)) + '</title></line>';
        });
        if (pts.length) {
            out += '<path class="ln" d="' + pts.map(function (p, i) { return (i ? 'L' : 'M') + X(p.t) + ' ' + Y(p.y); }).join(' ') + '"/>';
        }
        (o.dots || []).forEach(function (d) {
            if (!isFinite(d.t)) return;
            out += '<circle class="' + (d.kind === 'back' ? 'dback' : 'dout') + '" r="3.5" cx="' + X(d.t) + '" cy="' + Y(yAt(d.t))
                + '"><title>' + esc(d.text || d.kind) + '</title></circle>';
        });
        (o.rises || []).forEach(function (r, i) {
            if (!isFinite(r.t)) return;
            out += '<g class="rb"><circle r="7" cx="' + X(r.t) + '" cy="' + Y(r.y1) + '"/><text x="' + X(r.t) + '" y="'
                + (Number(Y(r.y1)) + 3) + '" text-anchor="middle">' + (i + 1) + '</text></g>';
        });
        pts.forEach(function (p) {
            out += '<circle class="hit" r="4" cx="' + X(p.t) + '" cy="' + Y(p.y) + '"><title>' + loc('det.turnN', '回合 {n}', { n: p.n }) + ' · '
                + stamp(p.t) + ' · ' + comma(p.y) + ' tokens</title></circle>';
        });
        out += '<text class="axis" x="' + L + '" y="' + (H - 4) + '">' + (o.elapsed ? '0m' : stamp(t0).slice(11)) + '</text>'
            + '<text class="axis" x="' + (W - R) + '" y="' + (H - 4) + '" text-anchor="end">'
            + (o.elapsed ? mins(t1 - t0) : stamp(t1).slice(11)) + '</text>';
        return out + '</svg>';
    }
    function riseText(r) {
        if (r.cause === 'self') return loc('det.selfOutputTokens', '{l}，輸出 {t} tokens', { l: r.self.label, t: comma(r.self.tok) });
        var top = r.top.map(function (x) { return loc('det.labelNChars', '{l} {n} 字元', { l: x.label, n: comma(x.chars) }); });
        return (top.join(loc('det.semicolon', '；')) || loc('det.noIncomingOutput', '沒有記到進來的輸出'))
            + (r.restN ? loc('det.andNMoreChars', '；另 {n} 項 {c} 字元', { n: r.restN, c: comma(r.restChars) }) : '');
    }
    function risesList(s, x) {
        if (!x.rises.length) return '<p class="tally">' + loc('det.noRises', '沒有上升') + '</p>';
        return '<ol class="rz" aria-label="' + loc('det.top5Rises', '最大的五次上升') + '">' + x.rises.map(function (r, i) {
            return '<li><span class="rzn">' + (i + 1) + '</span><div><div class="rzh"><span class="d">+' + tokens(r.dy)
                + '</span><span class="w">' + loc('det.turnFromTo', '回合 {from}→{to}', { from: r.from, to: r.n }) + (isFinite(r.t) ? ' · ' + stamp(r.t).slice(11) : '')
                + '</span><span class="w">' + (r.cause === 'self' ? loc('det.modelsOwnOutput', '模型自己的輸出') : loc('det.incomingNChars', '進來 {n} 字元', { n: comma(r.inChars) }))
                + '</span></div><div class="rzm">' + esc(riseText(r)) + '</div>'
                + todoSpot(riseTodo(s.id, r), r.cause === 'self' ? 'skills/fankeel/SKILL.md' : 'docs/90-agent/reference/station.md', s)
                + '</div></li>';
        }).join('') + '</ol>';
    }
    // `bare` leaves the small chart and its key out: the 時間線 tab draws the
    // same curve in its timeline, and the rises listed here are numbered there.
    function ctxSection(s, x, bare) {
        var P = x.points;
        var step = niceStep(x.peak || 1);
        var dots = [];
        x.dispatches.forEach(function (d) {
            dots.push({ t: d.out, kind: 'out', text: loc('det.dispatchedColon', '派出 · {t}', { t: d.text }) });
            if (isFinite(d.back)) dots.push({ t: d.back, kind: 'back', text: loc('det.returnedColon', '回來 · {t}', { t: d.text }) });
        });
        var same = P.length + x.noTime === x.requests;
        return '<div class="srcline">' + loc('det.summariseByRequest', 'summarise() 的 byRequest：每個 request 的 input ＋ cache read ＋ cache write') + '</div>'
            + (P.length && !bare ? '<div class="cx">' + lineChart(P, {
                W: 340, H: 170, t0: P[0].t, t1: P[P.length - 1].t, ymax: Math.ceil((x.peak || 1) / step) * step,
                marks: x.marks, dots: dots, rises: x.rises,
                label: loc('det.idContextNPointsPeak', '{id} 的 context，{n} 點，峰值 {peak}', { id: String(s.id).slice(0, 8), n: P.length, peak: tokens(x.peak) }),
            }) + '</div>' : '')
            + (bare ? '' : '<div class="key" aria-hidden="true"><span><i class="kl"></i>context / request</span>'
                + '<span><i class="ko"></i>' + loc('det.dispatched', '派出') + '</span><span><i class="kb"></i>' + loc('det.returned', '回來') + '</span><span><i class="ks"></i>' + loc('det.stage', '階段') + '</span></div>')
            + '<p class="tally">' + loc('det.lineBPoints', '折線 <b>{n} 點</b>', { n: P.length }) + (x.noTime ? loc('det.plusNRequestsNoTime', ' ＋ {n} requests with no time', { n: x.noTime }) : '')
            + loc('det.equalsSummaryRequests', ' ＝ 摘要的 {n} requests', { n: x.requests }) + ' <span class="' + (same ? 'eq' : 'ne') + '">' + (same ? loc('det.consistent', '一致') : loc('det.inconsistent', '不一致'))
            + '</span>' + (P.length > 240 ? loc('det.downsampledOver240', ' · 超過 240 點，降取樣並保留峰值') : '')
            + loc('det.peakColon', ' · 峰值 {v}', { v: tokens(x.peak) }) + (x.peakN ? loc('det.turnParen', '（回合 {n}）', { n: x.peakN }) : '') + '</p>'
            + risesList(s, x);
    }
    function seqHtml(seq, backs, route, stage, active) {
        var bk = {};
        (backs || []).forEach(function (b) { bk[b.i] = true; });
        var out = (seq || []).map(function (m, i) {
            var b = bk[i];
            return (i ? '<span class="ar' + (b ? ' bk' : '') + '" aria-hidden="true">' + (b ? '↩' : '→') + '</span>' : '')
                + '<span class="s' + (b ? ' bk' : '') + (m.source !== 'cmd' ? ' fb' : '') + '" role="listitem" title="'
                + esc(m.stage + ' · ' + stamp(m.at) + ' · ' + (m.source === 'cmd' ? loc('det.taskJsCommand', 'task.js 指令') : m.source)) + '">'
                + '<span class="i">' + (i + 1) + '</span><i class="dot" style="background:' + (STAGE_C[m.stage] || '#888')
                + '"></i>' + esc(m.stage) + '</span>';
        }).join('');
        if (active) {
            (route || []).slice((route || []).indexOf(stage) + 1).forEach(function (n) {
                out += '<span class="ar" aria-hidden="true">→</span><span class="s todo" role="listitem">' + esc(n) + '</span>';
            });
        }
        return '<div class="seq" role="list" aria-label="' + loc('det.stageOrderLabel', '階段移動次序') + '">' + out + '</div>';
    }
    function backBlock(s, b) {
        return '<div class="bkl"><div class="hd2"><span class="ar">↩</span> ' + esc(b.from) + ' → ' + esc(b.to) + ' <span class="mono">'
            + stamp(b.at) + ' · ' + loc('det.stayedFor', '{stage} 待了 {t}', { stage: esc(b.from), t: mins(b.at - b.since) }) + '</span></div>'
            + '<a class="lk" tabindex="0" data-goto="' + b.since + '" data-until="' + b.at + '">' + loc('det.rowsAboveInReplay', '過程還原裡它前面那幾列 ↓') + '</a>'
            + todoSpot(backTodo(s.id, b), 'skills/fankeel-build/SKILL.md', s)
            + '</div>';
    }
    function orderSection(s, x) {
        return seqHtml(x.seq, x.backs, s.route, s.stage, s.state === 'live')
            + x.backs.map(function (b) { return backBlock(s, b); }).join('')
            + '<p class="tally">' + loc('det.orderTakenFrom', '次序取 {src}；倒退 {n} 次', { src: x.seqSource === 'task.js' ? loc('det.realTaskJsCommands', 'transcript 裡真正執行的 task.js 指令')
                : x.seqSource === 'moves' ? loc('det.movesNoCommands', 'moves（transcript 裡沒有 task.js 指令）')
                    : loc('det.clockNoMoves', 'clock（沒有指令也沒有 moves，看不出回頭）'), n: x.backtracks }) + '</p>';
    }
    // 分工: a short prose account of how the main loop divided dispatch, one
    // line per stage in the order `seq` first entered it. A dispatch's stage
    // is its `out` time run through the same rule as `lib/detail.js:390`'s
    // `stageWhen` — the last `seq` entry at or before it, or `task 開始前`
    // when there is none.
    function splitStage(seq, t) {
        var st = null;
        (seq || []).forEach(function (m) { if (m.at <= t) st = m.stage; });
        return st;
    }
    function splitCount(x) {
        var turns = sumLoops(x.loops).turns;
        return (x.loops && x.loops.length ? loc('det.mainLoopNTurns', '主迴圈 {n} 回合 · ', { n: turns }) : '') + loc('det.dispatchNTimes', '派工 {n} 次', { n: (x.dispatches || []).length });
    }
    function splitHtml(x) {
        var order = [], by = {};
        var row = function (st) {
            var k = st || loc('det.beforeTaskStart', 'task 開始前');
            if (!by[k]) { by[k] = { stage: k, turns: 0, single: 0, early: 0, multi: {}, wf: 0, wfN: 0, models: {} }; order.push(k); }
            return by[k];
        };
        var hasLoops = !!(x.loops && x.loops.length);
        (x.seq || []).forEach(function (s) { row(s.stage); });
        (x.loops || []).forEach(function (l) { row(l.stage).turns += l.turns; });
        (x.dispatches || []).forEach(function (d, i) {
            var r = row(splitStage(x.seq, d.out));
            var kids = (x.rows || []).filter(function (k) { return k.disp === i; });
            if (d.surface === 'workflow') { r.wf++; r.wfN += kids.length; }
            else if (d.surface === 'agents') r.multi[d.turn] = (r.multi[d.turn] || 0) + Math.max(1, kids.length);
            else r.single++;
            kids.forEach(function (k) { var f = family(k.model || k.alias); r.models[f] = (r.models[f] || 0) + 1; });
        });
        var singles = (x.dispatches || []).filter(function (d) { return d.surface === 'agent' && isFinite(d.out); })
            .sort(function (a, b) { return a.out - b.out; });
        for (var si = 1; si < singles.length; si++) {
            var p = singles[si - 1], q = singles[si];
            if (isFinite(p.back) && q.out < p.back && q.turn !== p.turn) row(splitStage(x.seq, q.out)).early++;
        }
        var lines = order.map(function (k) { return by[k]; })
            .filter(function (r) { return r.turns || r.single || Object.keys(r.multi).length || r.wf; })
            .map(function (r) {
                var parts = [];
                if (r.wf) parts.push(loc('det.workflowNTimesNAgents', 'Workflow {n} 次（{k} 個 agent）', { n: r.wf, k: r.wfN }));
                var multiKeys = Object.keys(r.multi);
                if (multiKeys.length) {
                    var multiTotal = multiKeys.reduce(function (a, t) { return a + r.multi[t]; }, 0);
                    parts.push(loc('det.concurrentInOneResponse', '同一回應並發 {n} 回（共 {t} 個）', { n: multiKeys.length, t: multiTotal }));
                }
                if (r.single) {
                    parts.push(loc('det.singleNTimes', '單發 {n} 次', { n: r.single }) + (r.single > 1 ? loc('det.eachOneTurn', '，各佔一個回合') : '')
                        + (r.early ? loc('det.nCouldHaveBeenOneCall', '，其中 {n} 次在前一次回來前就派出，本可一次發出', { n: r.early }) : ''));
                }
                var models = Object.keys(r.models).map(function (m) { return m + ' ×' + r.models[m]; }).join(loc('det.listSep', '、'));
                return esc(r.stage) + ' — ' + (hasLoops ? loc('det.mainLoopNTurnsSemi', '主迴圈 {n} 回合；', { n: r.turns }) : '')
                    + (parts.length ? loc('det.dispatchColon', '派工：{p}', { p: parts.join(loc('det.listSep', '、')) }) + (models ? loc('det.semicolon', '；') + models : '') : loc('det.noDispatch', '沒有派工'));
            });
        if (!hasLoops) lines.push(loc('det.cacheHasNoPerStageTurns', '這份快取沒有逐站回合數（寫於 loops 欄位出現之前）'));
        var plans = (x.tasks || []).filter(function (p) { return !p.error; });
        plans.forEach(function (p) {
            var hinted = p.groups.filter(function (g) { return g.hint; });
            var none = p.groups.filter(function (g) { return !g.turns.length; });
            var one = p.groups.length - hinted.length - none.length;
            var bits = [];
            if (one) bits.push(loc('det.nGroupsOneTurn', '{n} 組各在一個回合內派出', { n: one }));
            if (none.length) bits.push(loc('det.nGroupsNoDispatch', '{n} 組沒有派工紀錄', { n: none.length }));
            if (hinted.length) {
                bits.push(loc('det.nGroupsCouldBeOne', '{n} 組本可一次發出：', { n: hinted.length }) + hinted.map(function (g) {
                    return loc('det.gTaskTurns', 'G{g}（task {tasks}，分 {n} 個回合）', { g: g.g, tasks: g.tasks.join(loc('det.listSep', '、')), n: g.turns.length });
                }).join(loc('det.listSep', '、')));
            }
            lines.push(loc('det.planTasksGroups', 'plan {p}：{n} 個 task 分 {g} 組；{bits}', { p: esc(String(p.plan).split('/').pop()), n: p.tasks.length, g: p.groups.length, bits: bits.join(loc('det.listSep', '、')) }));
        });
        if (!plans.length && (x.dispatches || []).length > 1) lines.push(loc('det.noTaskTableCannotTell', '這頁沒有任務表：其餘派工是否互不相依，無從判斷'));
        return lines.map(function (l) { return '<p class="tally">' + l + '</p>'; }).join('');
    }
    function cents(c) { return '$' + ((c || 0) / 100).toFixed(2); }
    function dur(sec) {
        if (!isFinite(sec)) return '—';
        if (sec < 60) return sec + 's';
        var m = Math.floor(sec / 60), r = sec % 60;
        if (m < 60) return m + 'm' + (r < 10 ? '0' : '') + r + 's';
        return Math.floor(m / 60) + 'h' + (m % 60 < 10 ? '0' : '') + (m % 60) + 'm';
    }
    function taskCount(list) {
        list = (list || []).filter(function (p) { return !p.error; });
        if (!list.length) return loc('det.noPlan', '沒有 plan');
        var n = 0, g = 0;
        list.forEach(function (p) { n += p.tasks.length; g += p.groups.length; });
        return loc('det.nTasksGGroups', '{n} 個 · {g} 組', { n: n, g: g });
    }
    // One band per group `plantasks` would dispatch together, its tasks under
    // it, and the hint where one group went out over more than one turn.
    function tasksHtml(list) {
        if (!list || !list.length) return '<p class="tally">' + loc('det.noPlanFileNoTaskTable', '這個 session 的 claims 裡沒有 plan 檔，沒有任務表') + '</p>';
        return list.map(function (p) {
            if (p.error) return '<div class="srcline" title="' + esc(p.plan) + '">' + esc(p.plan) + '</div><p class="tally">'
                + (p.error === 'unreadable' ? loc('det.planUnreadableShort', '讀不到這份 plan') : loc('det.planNoTasksShort', '這份 plan 裡沒有 task')) + '</p>';
            var byN = {};
            p.tasks.forEach(function (t) { byN[t.n] = t; });
            var done = p.tasks.filter(function (t) { return t.status === 'complete'; }).length;
            return '<div class="srcline" title="' + esc(p.plan) + '">' + esc(p.plan) + '</div>'
                + '<table class="x"><colgroup><col style="width:30px"><col><col style="width:96px"></colgroup>'
                + '<thead><tr><th>#</th><th>' + loc('det.task', '任務') + '</th><th>' + loc('det.state', '狀態') + '</th></tr></thead><tbody>'
                + p.groups.map(function (g) {
                    return '<tr class="band"><td colspan="3"><div class="bandrow"><span class="gb">G' + g.g + '</span>'
                        + '<span>Task ' + g.tasks.join(loc('det.listSep', '、')) + ' · ' + loc('det.suggested', '建議') + ' <span class="mono">' + esc(g.surface) + '</span></span>'
                        + '<span class="rt">' + (g.turns.length ? loc('det.turnColon', '回合 {t}', { t: g.turns.join(' · ') }) : loc('det.noDispatch', '沒有派工')) + '</span></div>'
                        + (g.hint ? '<div class="hint">could have gone in one response<span class="why">' + loc('det.sameGroupSplitTurns', '同組，分 {n} 個回合派出', { n: g.turns.length }) + '</span></div>' : '') + '</td></tr>'
                        + g.tasks.map(function (n) {
                            var t = byN[n];
                            return '<tr><td class="num mute">' + n + '</td><td><div>' + esc(t ? t.title : '') + '</div>'
                                + '<div class="l2">' + (t && t.range ? esc(t.range) : loc('det.fromPlanTaskList', '出自 plan 的 task 清單'))
                                + (t && t.turns.length ? loc('det.dotTurnColon', ' · 回合 {t}', { t: t.turns.join(' · ') }) : '') + '</div></td>'
                                + '<td><span class="pill sm ' + (t && t.status === 'complete' ? 'ok' : 'pend') + '">'
                                + esc(t ? t.status : 'no ledger line') + '</span></td></tr>';
                        }).join('');
                }).join('') + '</tbody></table>'
                + '<p class="tally">' + loc('det.markedDoneRows', '標為完成的 <b>{n} 列</b>', { n: done }) + ' <span class="' + (done === p.ledgerLines ? 'eq">' + loc('det.equalsSign', '＝') : 'ne">' + loc('det.notEqualsSign', '≠'))
                + '</span> ' + loc('det.ledgerTaskLines', 'ledger 的 Task 行 {n}', { n: p.ledgerLines })
                + (p.unmatched.length ? loc('det.unmatchedDispatches', '；label 裡沒有 task N 的派工 {n} 個，不猜：', { n: p.unmatched.length })
                    + p.unmatched.map(esc).join(loc('det.listSep', '、')) : '') + '</p>';
        }).join('');
    }
    // The plan tab (docs/90-agent/plans/2026-10-18-plan-gate-page-design.md
    // §2), drawn from the newest plan this session claimed: its dispatch
    // groups as columns of task cards. Each card names every earlier task
    // `plantasks.conflict` refused it beside — one 等 line per pair, so the
    // lines on the page and the pairs refused are one count. No edge is drawn
    // as a line: `focus` is the task hovered or focused, whose neighbours light
    // (`planRel`). While the session sits at `plan` a banner puts the gate's
    // question; the answer is given in Claude Desktop, never here. Classes are
    // `pv-`: `.pg` is the pending gate's.
    // The newest plan claimed: claims are kept newest last.
    function planNewest(list) { return list && list.length ? list[list.length - 1] : null; }
    // A path escaped first, then given a break after every `/`: Chrome breaks
    // a path at no `/` of its own, so a long one split mid-name in a card.
    function planPath(x) { return esc(x).replace(/\//g, '/<wbr>'); }
    // What one 等 line says about earlier task `w.n`, as waiting task `t` says it.
    function planReason(t, w) {
        var f = w.file ? '<code>' + planPath(w.file) + '</code>' : '';
        if (w.kind === 'files') return loc('det.planWaitFiles', '同改 {f}', { f: f });
        if (w.kind === 'interface') {
            return (t.consumes || []).indexOf(w.file) >= 0 ? loc('det.planWaitIface', '用它產出的 {f}', { f: f })
                : loc('det.planWaitIfaceRev', '它要用這裡產出的 {f}', { f: f });
        }
        if (w.kind === 'read') {
            var mine = (t.read || []).some(function (r) { return String(r).replace(/:\d+(-\d+)?$/, '') === w.file; });
            return mine ? loc('det.planWaitRead', '讀 {f}', { f: f }) : loc('det.planWaitItReads', '它讀 {f}', { f: f });
        }
        return loc('det.planWaitUndeclared', '有一方沒宣告檔案，保守地等');
    }
    // What lighting Task `f` lights: each task it waits for (`is-pre`) and each
    // task waiting on it (`is-post`), with the kind and the tag that card wears,
    // and the focused card's own tag. Every other card dims.
    function planRel(p, f) {
        var out = { pre: 0, post: 0, rel: {}, focus: '' };
        var me = ((p && p.tasks) || []).filter(function (t) { return t.n === f; })[0];
        if (!me) return out;
        (me.waits || []).forEach(function (w) {
            out.pre++;
            out.rel[w.n] = { cls: 'is-pre ' + w.kind, text: loc('det.planTagPre', 'Task {f} 等這張 · {r}', { f: f, r: planReason(me, w) }) };
        });
        p.tasks.forEach(function (t) {
            (t.waits || []).forEach(function (w) {
                if (w.n !== f) return;
                out.post++;
                out.rel[t.n] = { cls: 'is-post ' + w.kind, text: loc('det.planTagPost', '這張等 Task {f} · {r}', { f: f, r: planReason(t, w) }) };
            });
        });
        out.focus = (out.pre ? loc('det.planFocusPre', '等 {n} 張', { n: out.pre }) : loc('det.planFocusNoPre', '不等誰'))
            + ' · ' + (out.post ? loc('det.planFocusPost', '{n} 張等它', { n: out.post }) : loc('det.planFocusNoPost', '沒有卡等它'));
        return out;
    }
    // The class and tag card `n` wears while Task `f` is lit; null when nothing is.
    function planLit(r, n, f) {
        if (!r) return null;
        if (n === f) return { cls: 'is-focus', tag: esc(r.focus), hit: false };
        var x = r.rel[n];
        return x ? { cls: x.cls, tag: '<i class="pv-ln" aria-hidden="true"></i>' + x.text, hit: x.cls.indexOf('is-post') === 0 }
            : { cls: 'is-dim', tag: null, hit: false };
    }
    function planCard(t, lit, f) {
        var file = function (x) {
            var m = /^(.*?)(:\d+-\d+)?$/.exec(String(x));
            return '<code>' + planPath(m[1]) + (m[2] ? '<small>' + esc(m[2]) + '</small>' : '') + '</code>';
        };
        var disp = t.dispatch === 'implementer'
            ? 'implementer · <span class="pv-m"><i class="sw" style="background:var(--m-' + family('claude-' + t.model) + ')"></i>' + esc(t.model || '?')
                + '</span> · <span>effort ' + esc(t.effort || loc('det.planEffortDefault', '預設')) + '</span>'
            : t.dispatch === 'user' ? loc('det.planByUser', '交給你')
                : t.dispatch === 'in-session' ? loc('det.planInSession', '主 session 自己做')
                    : loc('det.planNoDispatch', '沒有 Dispatch 行');
        var waits = t.waits || [];
        var wait = waits.length
            ? '<div class="pv-wait"><span class="pv-wl">' + loc('det.planWaitLabel', '等') + '</span><ul>' + waits.map(function (w) {
                return '<li class="pv-dep ' + esc(w.kind) + (lit && lit.hit && w.n === f ? ' is-hit' : '') + '" data-from="' + w.n + '"><i class="pv-ln" aria-hidden="true"></i>'
                    + '<b>Task ' + w.n + '</b><span>' + planReason(t, w) + '</span></li>';
            }).join('') + '</ul></div>'
            : '<p class="pv-wait none">' + loc('det.planWaitsNone', '不等誰：這組一開就能跑') + '</p>';
        return '<article class="pv-card' + (lit ? ' ' + lit.cls : '') + '" data-block="task-card-' + t.n + '" data-n="' + t.n + '" tabindex="0" aria-label="Task ' + t.n + '">'
            + (lit && lit.tag !== null ? '<p class="pv-tag">' + lit.tag + '</p>' : '')
            + '<h3><span class="pv-num">' + t.n + '</span><span class="pv-tt">' + esc(t.title).replace(/`([^`]+)`/g, '<code>$1</code>') + '</span></h3>'
            + '<dl class="pv-files"><div><dt>' + loc('det.planModify', '改') + '</dt><dd>' + (t.modify || []).map(file).join('') + '</dd></div>'
            + ((t.test || []).length ? '<div><dt>' + loc('det.planTest', '測') + '</dt><dd>' + t.test.map(file).join('') + '</dd></div>' : '') + '</dl>'
            + '<p class="pv-disp">' + disp + '</p>' + wait + '</article>';
    }
    function planTabHtml(s, list, focus) {
        var PV_KINDS = ['files', 'read', 'interface'];
        var PV_THEN = '<svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 6.2 8 9.8l3.5-3.6"/></svg>';
        var PV_GATE = '<svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1.8 13.5 4v4c0 3-2.4 5.3-5.5 6.2C4.9 13.3 2.5 11 2.5 8V4z"/><path d="M8 5.2v3.3M8 10.8v.01"/></svg>';
        var p = planNewest(list);
        var code = function (x) { return '<code>' + esc(x) + '</code>'; };
        if (!p) return '<p class="pv-empty">' + loc('det.planNone', '這個 session 的 claims 裡還沒有 plan 檔。plan stage 寫出 plan 後，這裡列出它的 task 和分組。') + '</p>';
        if (p.error === 'unreadable') return '<p class="pv-empty err">' + loc('det.planUnreadable', '讀不到 {p}：檔案在，但打不開。', { p: code(p.plan) }) + '</p>';
        if (!p.tasks.length) return '<p class="pv-empty err">' + loc('det.planNoTasks', '{p} 裡找不到 <code>## Task N:</code> 標題，沒有 task 可畫。', { p: code(p.plan) }) + '</p>';
        var byN = {}, kinds = { files: 0, read: 0, interface: 0, undeclared: 0 }, edges = 0, models = {};
        p.tasks.forEach(function (t) {
            byN[t.n] = t;
            (t.waits || []).forEach(function (w) { edges++; kinds[w.kind] = (kinds[w.kind] || 0) + 1; });
            if (t.dispatch === 'implementer' && t.model) models[t.model] = (models[t.model] || 0) + 1;
        });
        var f = focus === null || focus === undefined ? null : Number(focus);
        var r = f !== null && byN[f] ? planRel(p, f) : null;
        var banner = s && s.stage === 'plan'
            ? '<div class="pv-banner" data-block="gate-banner"><div class="pv-q"><span class="pill gate">' + PV_GATE + 'gate</span>'
                + '<h2>' + loc('det.planGateQ', 'plan gate：要用這 {n} 個 task 進 build 嗎？', { n: p.tasks.length }) + '</h2></div>'
                + '<ul class="pv-counts"><li><b>' + p.tasks.length + '</b>task</li>'
                + '<li>' + loc('det.planGroupsRun', '<b>{n}</b>組，依序跑', { n: p.groups.length }) + '</li>'
                + '<li>' + loc('det.planEdges', '<b>{n}</b>條相依', { n: edges }) + '</li>'
                + (Object.keys(models).length ? '<li class="pv-mods"><span class="pv-ml">implementer</span>' + Object.keys(models).map(function (m) {
                    return '<span class="chip"><i class="sw" style="background:var(--m-' + family('claude-' + m) + ')"></i>' + esc(m) + ' × ' + models[m] + '</span>';
                }).join('') + '</li>' : '') + '</ul>'
                + '<div class="srcline pv-src" title="' + esc(p.plan) + '">' + esc(p.plan) + '</div>'
                + '<p class="pv-where"><i class="hatchsw" aria-hidden="true"></i><span>' + loc('det.planWhere', '回答在 Claude Desktop 那邊給；這頁只讓你看清楚要核准什麼，不收答案。') + '</span></p></div>'
            : '<div class="pv-hd" data-block="plan-head"><div class="srcline pv-src" title="' + esc(p.plan) + '">' + esc(p.plan) + '</div>'
                + '<ul class="pv-counts"><li><b>' + p.tasks.length + '</b>task</li><li>' + loc('det.planGroupsRun', '<b>{n}</b>組，依序跑', { n: p.groups.length }) + '</li></ul></div>';
        var label = { files: loc('det.planKindFiles', '同改一個檔'), read: loc('det.planKindRead', '一個讀、一個改'), interface: loc('det.planKindIface', '用到對方產出的介面'),
            undeclared: loc('det.planKindUndeclared', '有一方沒宣告檔案') };
        var legend = '<div class="pv-legend" data-block="legend"><span class="pv-lh">' + loc('det.planLegend', '相依') + '</span>'
            + PV_KINDS.concat(kinds.undeclared ? ['undeclared'] : []).map(function (k) {
                return '<span class="pv-li ' + k + (kinds[k] ? '' : ' zero') + '"><i class="pv-ln" aria-hidden="true"></i><b>' + k + '</b>' + label[k]
                    + '<small>' + (kinds[k] ? loc('det.planKindN', '{n} 條', { n: kinds[k] }) : loc('det.planKindZero', '這份 plan 沒有')) + '</small></span>';
            }).join('')
            + '<span class="pv-lnote">' + loc('det.planLegendNote', '一欄跑完才換下一欄，欄內並行；停在或 tab 到一張卡，亮出它等的和等它的卡，Esc 清掉。') + '</span></div>';
        var groups = p.groups.map(function (g, i) {
            var par = g.tasks.length === 1 ? loc('det.planAlone', '單獨 1 個') : loc('det.planParallel', '可並行 {n} 個', { n: g.tasks.length });
            return '<section class="pv-g" data-block="group-g' + g.g + '" aria-label="G' + g.g + ' · ' + par + '">'
                + '<header class="pv-gh"><span class="gb">G' + g.g + '</span><span class="pv-surf mono">' + esc(g.surface) + '</span><span class="pv-par">' + par + '</span></header>'
                + '<div class="pv-cards">' + g.tasks.map(function (n) { return byN[n] ? planCard(byN[n], planLit(r, n, f), f) : ''; }).join('') + '</div></section>'
                + (i < p.groups.length - 1 ? '<div class="pv-then">' + PV_THEN + '<span>' + loc('det.planThen', 'G{a} 全部回來，才派 G{b}', { a: g.g, b: g.g + 1 }) + '</span></div>' : '');
        }).join('');
        return banner + legend + '<div class="pv-groups" data-block="group-columns">' + groups + '</div>';
    }
    // The tab as the session page draws it: the lit task carried across a
    // redraw (`planAt`), and the hover, focus and Esc listeners added on the
    // first draw rather than at load — tests/station-hdl-c.test.js presses the
    // page's load-time listeners by their place in the order they were added.
    var planAt = null;
    var planHeard = false;
    function planTab(s, x) {
        planListen();
        return planTabHtml(s, x.tasks, planAt);
    }
    // Lights Task `f`'s neighbours on the drawn tab, or clears them for null,
    // without a redraw: a redraw would take the keyboard focus with it.
    function planFocus(f) {
        planAt = f === null || f === undefined ? null : Number(f);
        var grid = doc && doc.querySelector ? doc.querySelector('.pv-groups') : null;
        if (!grid) return;
        var x = route.view === 'session' ? DETAIL[route.id] : null;
        var p = x ? planNewest(x.tasks) : null;
        var r = p && planAt !== null ? planRel(p, planAt) : null;
        [].forEach.call(grid.querySelectorAll('.pv-card'), function (c) {
            c.classList.remove('is-focus', 'is-pre', 'is-post', 'is-dim', 'files', 'read', 'interface', 'undeclared');
            var old = c.querySelector('.pv-tag');
            if (old) old.parentNode.removeChild(old);
            [].forEach.call(c.querySelectorAll('.pv-dep.is-hit'), function (d) { d.classList.remove('is-hit'); });
            var lit = planLit(r, Number(c.getAttribute('data-n')), planAt);
            if (!lit) return;
            lit.cls.split(' ').forEach(function (k) { c.classList.add(k); });
            if (lit.hit) [].forEach.call(c.querySelectorAll('.pv-dep[data-from="' + planAt + '"]'), function (d) { d.classList.add('is-hit'); });
            if (lit.tag === null) return;
            var tag = doc.createElement('p');
            tag.className = 'pv-tag';
            tag.innerHTML = lit.tag;
            c.insertBefore(tag, c.firstChild);
        });
    }
    function planListen() {
        if (planHeard || !doc || !doc.addEventListener) return;
        planHeard = true;
        var near = function (e, sel) { return e && e.target && e.target.closest ? e.target.closest(sel) : null; };
        var on = function (e) {
            var c = near(e, '.pv-card');
            if (c && Number(c.getAttribute('data-n')) !== planAt) planFocus(c.getAttribute('data-n'));
        };
        doc.addEventListener('mouseover', on);
        doc.addEventListener('focusin', on);
        // Leaving the columns clears, unless a card in them holds the keyboard focus.
        doc.addEventListener('mouseout', function (e) {
            var g = near(e, '.pv-groups');
            if (!g || (e.relatedTarget && g.contains(e.relatedTarget)) || g.contains(doc.activeElement)) return;
            planFocus(null);
        });
        doc.addEventListener('focusout', function (e) {
            var g = near(e, '.pv-groups');
            if (g && !(e.relatedTarget && g.contains(e.relatedTarget))) planFocus(null);
        });
        doc.addEventListener('keydown', function (e) {
            if (!e || e.key !== 'Escape' || planAt === null) return;
            var a = doc.activeElement;
            planFocus(null);
            if (a && a.closest && a.closest('.pv-card') && a.blur) a.blur();
        });
    }
    if (typeof module !== 'undefined' && module.exports) module.exports.planTab = planTab;
    // ---- 關卡: the gate tab (docs/90-agent/plans/2026-10-18-gate-tab-design.md §4).
    // lib/gatereport.js reads the newest handoff report of the session's
    // current stage onto the detail's `gate`; this draws it by stage — survey
    // and build compact, design and land richer — under the plan tab's banner
    // while `gateAt` says the session waits at that stage's gate. Pure, and no listener:
    // nothing on it changes without a redraw.
    function gateStage(st) { return ['survey', 'design', 'build', 'land'].indexOf(st) >= 0; }
    // Waiting is the registry's `gateAt` stamp (lib/registry.js `gateOpen`) or a
    // pending file with questions: a group brain's build-g<N>.md lands mid-build.
    function gateAt(s, g) {
        var waits = s && (Number.isFinite(s.gateAt) || Boolean(s.pending && s.pending.questions && s.pending.questions.length));
        return Boolean(waits && g && !g.error && g.stage === s.stage && gateStage(g.stage));
    }
    // Report text: escaped, its `code` spans drawn as code; '' for none.
    function gateText(t) { return t ? esc(t).replace(/`([^`]+)`/g, '<code>$1</code>') : ''; }
    function gateSec(title, n, body) {
        if (!body) return '';
        return '<section class="gv-sec"><h3>' + title + (n !== null && n !== undefined ? ' <small>' + n + '</small>' : '') + '</h3>' + body + '</section>';
    }
    // rows: [label, value html, div class]; a row with no value is left out.
    function gateKv(rows, cls) {
        var got = rows.filter(function (r) { return r[1]; });
        if (!got.length) return '';
        return '<dl class="gv-kv' + (cls ? ' ' + cls : '') + '">' + got.map(function (r) {
            return '<div' + (r[2] ? ' class="' + r[2] + '"' : '') + '><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>';
        }).join('') + '</dl>';
    }
    // The lines no rule recognised, as written, never dropped.
    function gateRest(rest) {
        if (!rest || !rest.length) return '';
        var parts = [], plain = [], dg = false, i = 0, e, fence = /^\s*```\s*mermaid\b/i;
        var flush = function () { if (plain.length) parts.push('<pre class="gv-rest">' + esc(plain.join('\n')) + '</pre>'); plain = []; };
        while (i < rest.length) {
            if (w.FK_DIAGRAM && fence.test(rest[i])) {
                e = i + 1;
                while (e < rest.length && !/^\s*```/.test(rest[e])) e++;
                flush();
                // data-l here is the position in the rest block, not a report line
                parts.push(w.FK_DIAGRAM.fence(rest.slice(i + 1, e).join('\n'), i + 1));
                dg = true;
                i = e + 1;
            } else plain.push(rest[i++]);
        }
        flush();
        return '<details class="gv-more" data-gv="rest"' + (dg ? ' open' : '') + '><summary>' + loc('det.gateRest', '報告其餘') + '<small>' + loc('det.gateRestN', '{n} 行', { n: rest.length }) + '</small></summary>'
            + parts.join('') + '</details>';
    }
    // A report value `derive` (lib/gatereport.js) split into items: a list when it holds two or more, else the value as written.
    function gateList(list, text) {
        if (list && list.length > 1) return '<ul>' + list.map(function (x) { return '<li>' + gateText(x) + '</li>'; }).join('') + '</ul>';
        return gateText(text);
    }
    // A survey's TODO patrol (`derive`'s `patrol`), folded under its count and each disposition's,
    // its group lines inside.
    function gatePatrol(t) {
        if (!t) return '';
        var counts = ['do now', 'needs the user', 'waiting on', 'keep'].filter(function (k) { return t.counts && t.counts[k]; })
            .map(function (k) { return k + ' ' + t.counts[k]; }).join(' · ');
        return '<details class="gv-more" data-gv="patrol" data-block="gate-patrol"><summary>' + loc('det.gatePatrol', 'TODO 盤點 {n} 條', { n: t.listed === null ? '?' : t.listed })
            + (counts ? '<small>' + esc(counts) + '</small>' : '') + '</summary>'
            + gateKv((t.groups || []).map(function (x) { return [esc(x.name), gateText(x.text)]; })) + '</details>';
    }
    function gateSurvey(p) {
        var f = p.findings || [];
        var unknown = p.unknownList || [];
        var cls = p['class'] ? String(p['class']).split(' — ')[0] : '';
        var counts = '<li>' + loc('det.gateNFindings', '<b>{n}</b>處發現', { n: f.length }) + '</li>'
            + (unknown.length ? '<li>' + loc('det.gateNUnknown', '<b>{n}</b>件沒驗', { n: unknown.length }) + '</li>' : '')
            + (p.skippedFiles ? '<li>' + loc('det.gateNSkipped', '<b>{n}</b>個檔沒打開', { n: p.skippedFiles }) + '</li>' : '')
            + (cls ? '<li>class <code class="gv-sum">' + esc(cls) + '</code></li>' : '');
        var rows = f.length ? '<ul class="gv-rows" data-block="gate-findings">' + f.map(function (x) {
            return '<li><code class="gv-path">' + esc(x.path) + '<small>:' + esc(x.line) + '</small></code><span>' + gateText(x.what) + '</span></li>';
        }).join('') + '</ul>' : '';
        var side = gateSec(loc('det.gateSecClass', '分類與路線'), null, gateKv([['class', gateText(p['class'])], ['route', gateText(p.route)]]))
            + gateSec(loc('det.gateSecMissed', '沒查到、沒打開'), null, gateKv([['unknown', gateList(p.unknownList, p.unknown)], ['skipped', gateList(p.skippedList, p.skipped)],
                ['not built', gateText(p.planned)], ['not found', gateText(p.notFound)]]));
        var points = p.lead && p.lead.points ? p.lead.points : [];
        var lead = points.length
            ? '<div class="gv-lead">' + (p.lead.head ? '<b>' + gateText(p.lead.head) + '</b>' : '') + '<ol>' + points.map(function (x) { return '<li>' + gateText(x) + '</li>'; }).join('') + '</ol></div>'
            : p.conclusion ? '<p class="gv-lead">' + gateText(p.conclusion) + '</p>' : '';
        var body = lead
            + '<div class="gv-cols">' + gateSec(loc('det.gateSecFindings', '發現'), f.length, rows) + (side ? '<div class="gv-side">' + side + '</div>' : '') + '</div>'
            + gatePatrol(p.patrol);
        return { counts: counts, body: body };
    }
    // A file row's dispatch: `implementer, <model>[, <effort>]` as the model's swatch and the effort, the rest as written.
    function gateDisp(d) {
        var m = /^implementer,\s*([a-z]+)(?:,\s*(low|medium|high|xhigh|max))?/i.exec(String(d || ''));
        if (!m) return gateText(d);
        return '<span class="pv-m"><i class="sw" style="background:var(--m-' + family('claude-' + m[1].toLowerCase()) + ')"></i>' + esc(m[1]) + '</span>'
            + (m[2] ? ' · ' + esc(m[2]) : '') + gateText(String(d).slice(m[0].length));
    }
    function gateDesign(p, s) {
        var files = p.files || [];
        var proves = p.provesList || [];
        var unverified = p.unverifiedList || [];
        var counts = '<li>' + loc('det.gateNFiles', '<b>{n}</b>個檔', { n: files.length }) + '</li>'
            + (proves.length ? '<li>' + loc('det.gateNProves', '<b>{n}</b>條證明做完', { n: proves.length }) + '</li>' : '')
            + (unverified.length ? '<li>' + loc('det.gateNUnknown', '<b>{n}</b>件沒驗', { n: unverified.length }) + '</li>' : '')
            + (p.mockup ? '<li>' + loc('det.gateMockup', '附 mockup') + '</li>' : '');
        var tbl = files.length ? '<table class="gv-tbl"><thead><tr><th scope="col">' + loc('det.gateColFile', '檔') + '</th><th scope="col">'
            + loc('det.gateColChange', '改什麼') + '</th><th scope="col">' + loc('det.gateColDispatch', '派工') + '</th></tr></thead><tbody>' + files.map(function (f) {
                return '<tr><td><code class="gv-path">' + esc(f.path) + '</code></td><td>' + gateText(f.change) + '</td><td class="pv-disp">' + gateDisp(f.dispatch) + '</td></tr>';
            }).join('') + '</tbody></table>' : '';
        // Served, the screenshot comes from the station (GET /station/shot/<id>.png): a file:// image does not load in an http page.
        var src = p.mockup && p.mockup.shot ? (S.serve ? 'station/shot/' + encodeURIComponent(s && s.id ? s.id : '') + '.png' : p.mockup.shot.href) : '';
        // A file:// link from the served page may do nothing; the path is its text, so it still reads.
        var shot = p.mockup ? '<figure class="gv-shot">'
            + (src ? '<a href="' + esc(p.mockup.href) + '" target="_blank" rel="noopener"><img src="' + esc(src) + '" alt="' + loc('det.gateShotAlt', 'mockup 的截圖') + '" loading="lazy"></a>' : '')
            + '<figcaption><span>' + loc('det.gateShot', 'mockup，design gate 時核准用') + '</span><a href="'
            + esc(p.mockup.href) + '" target="_blank" rel="noopener">' + esc(p.mockup.path) + '</a></figcaption>'
            + (p.mockup.shotUnreadable ? '<p class="gv-red">' + loc('det.gateShotUnreadable', '讀不到截圖目錄 {path}：目錄在，但打不開。', { path: '<code>' + esc(p.mockup.shotUnreadable) + '</code>' }) + '</p>' : '') + '</figure>' : '';
        var body = (p.approach ? '<p class="gv-approach">' + gateText(p.approach) + '</p>' : '')
            + '<div class="gv-cols">' + gateSec(loc('det.gateSecFiles', '動到的檔'), files.length, tbl) + shot + '</div>'
            + gateKv([[loc('det.gateProves', '證明做完'), gateList(p.provesList, p.proves)], [loc('det.gateMap', '對照地圖'), gateText(p.map)],
                [loc('det.gateUnverified', '沒驗'), gateList(p.unverifiedList, p.unverified), 'warn'], ['spec', gateText(p.spec)]], 'gv-checks');
        return { counts: counts, body: body };
    }
    function gateBuild(p, plan) {
        var files = p.files || [];
        var add = 0, del = 0;
        files.forEach(function (f) { add += f.add || 0; del += f.del || 0; });
        var done = p.done && typeof p.done === 'object' ? p.done : null;
        var counts = (done && done.n !== null ? '<li>' + loc('det.gateNDone', '<b>{n}</b>/ {m} task 完成', { n: done.n, m: done.m }) + '</li>' : '')
            + '<li>' + loc('det.gateNFiles', '<b>{n}</b>個檔', { n: files.length }) + ' <span class="gv-sum"><span class="gv-add">+' + add + '</span> <span class="gv-del">\u2212' + del + '</span></span></li>'
            + (plan && typeof plan.fixes === 'number' ? '<li>' + loc('det.gateNFixes', '<b>{n}</b>輪修正', { n: plan.fixes }) + '</li>' : '')
            // gatereport.read: the session's verify -> build round trips from `moves`; none drawn at zero.
            + (p.rounds ? '<li>' + loc('det.gateNRounds', '<b>{n}</b>輪驗證往返', { n: p.rounds }) + '</li>' : '')
            // lib/detail.js tasksOf counts fixes and rulings from the ledger's `Fix:` and `Ruling:` lines.
            + (plan && typeof plan.rulings === 'number' ? '<li>' + loc('det.gateNRulings', '<b>{n}</b>條裁定', { n: plan.rulings }) + '</li>' : '');
        var tasks = plan && plan.tasks && plan.tasks.length ? '<div class="gv-tasks">' + plan.tasks.map(function (t) {
            var state = t.status === 'complete'
                ? '<span class="gv-ok">' + icon('check') + loc('det.gateDone', '完成') + '</span>' + (t.range ? '<code>' + esc(t.range) + '</code>' : '')
                : '<span>' + loc('det.gateNoLedger', '還沒有 ledger 行') + '</span>';
            var rounds = t.fixes ? '<span>' + loc('det.gateTaskFixes', '修 {n} 輪', { n: t.fixes }) + '</span>' : '';
            return '<article class="pv-card gv-mini" aria-label="Task ' + t.n + '"><h3><span class="pv-num">' + t.n + '</span><span class="pv-tt gv-tt">' + gateText(t.title) + '</span></h3>'
                + '<p class="gv-state">' + state + rounds + '</p></article>';
        }).join('') + '</div>' : '';
        var kindOf = function (f) { return /^tests\//.test(f.path) ? 'test' : /\.md$/.test(f.path) ? 'doc' : 'code'; };
        var kinds = [['code', loc('det.gateKindCode', '程式')], ['test', loc('det.gateKindTest', '測試')], ['doc', loc('det.gateKindDoc', '文件')]];
        var byKind = kinds.map(function (k) {
            var got = files.filter(function (f) { return kindOf(f) === k[0]; });
            if (!got.length) return '';
            var a = 0, d = 0;
            got.forEach(function (f) { a += f.add || 0; d += f.del || 0; });
            return '<p class="gv-fg"><b>' + k[1] + '</b><span>' + loc('det.gateKindN', '{n} 個', { n: got.length })
                + ' · <span class="gv-add">+' + a + '</span> <span class="gv-del">−' + d + '</span></span></p><ul class="gv-rows gv-files">' + got.map(function (f) {
                return '<li><code class="gv-path">' + esc(f.path) + '</code><span class="gv-d">' + (f.isNew ? loc('det.gateNew', '新檔')
                    : '<span class="gv-add">+' + f.add + '</span> <span class="gv-del">\u2212' + f.del + '</span>') + '</span><span>' + gateText(f.what) + '</span></li>';
            }).join('') + '</ul>';
        }).join('');
        var body = gateSec('task', done && done.n !== null ? done.n + ' / ' + done.m : null, tasks)
            + gateSec(loc('det.gateSecChanged', '改了的檔'), files.length, byKind)
            + gateKv([['done', done ? gateText(done.text) : ''], ['docs-check', gateText(p.docsCheck)], ['deferred', gateText(p.deferred)]]);
        return { counts: counts, body: body };
    }
    // The main session's time by stage, from the session row's `stages` (lib/station.js, each stage's
    // first and last touch): a bar, a stage as wide as it lasted, a legend under it, and the total.
    function gateTime(s) {
        var segs = (s && s.stages ? s.stages : []).filter(function (w) { return isFinite(w.from) && isFinite(w.to) && w.to > w.from; });
        if (!segs.length) return { total: 0, html: '' };
        var total = segs.reduce(function (n, w) { return n + (w.to - w.from); }, 0);
        var list = segs.map(function (w) { return esc(w.stage) + ' ' + mins(w.to - w.from); }).join(', ');
        var bar = '<div class="gv-bar" role="img" aria-label="' + loc('det.gateTimeAria', '主 session 各站時間：{list}', { list: list }) + '">' + segs.map(function (w) {
            return '<i style="--c:var(--st-' + esc(w.stage) + ');flex:' + Math.round((w.to - w.from) / 1000) + '"></i>';
        }).join('') + '</div>';
        var legend = '<ul class="gv-legend" aria-hidden="true">' + segs.map(function (w) {
            return '<li><i style="--c:var(--st-' + esc(w.stage) + ')"></i>' + esc(w.stage) + ' <b>' + mins(w.to - w.from) + '</b></li>';
        }).join('') + '</ul>';
        return { total: total, html: bar + legend };
    }
    function gateLand(p, s) {
        var ship = p.shipped || [];
        var time = gateTime(s);
        var counts = '<li>' + loc('det.gateNShipped', '<b>{n}</b>件做得到了', { n: ship.length }) + '</li>'
            + (time.total ? '<li>' + loc('det.gateMain', '<b>{t}</b>主 session', { t: mins(time.total) }) + '</li>' : '');
        // lib/gatereport.js: the task's suite.json, its last run. Which files it ran is recorded nowhere.
        var run = p.run;
        var badge = run && run.pass !== null && run.pass !== undefined
            ? '<span class="gv-suite' + (run.ok ? '' : ' gv-red') + '">' + (run.ok ? icon('check') : '') + loc('det.gateSuiteRun', '{p} 通過 · {f} 失敗', { p: esc(run.pass), f: esc(run.fail === null ? '?' : run.fail) }) + '</span>'
            : '';
        if (p.runUnreadable) badge += '<p class="gv-red">' + loc('det.gateRunUnreadable', '讀不到 {path}：檔案在，但打不開。', { path: '<code>' + esc(p.runUnreadable) + '</code>' }) + '</p>';
        var side = gateSec('suite', null, badge + (p.suite ? '<code class="gv-cmd">' + esc(p.suite) + '</code>' : ''))
            + gateSec(loc('det.gateSecCost', '花了多少'), null, p.cost ? '<div class="gv-split">' + gateText(p.cost) + '</div>' : '')
            + gateSec(loc('det.gateSecTime', '各站時間'), null, time.html)
            + gateSec(loc('det.gateSecOpen', '還沒完'), null, p.open ? '<ul class="gv-open"><li>' + gateText(p.open) + '</li></ul>' : '');
        var said = [['ask', recLabel('ask')], ['why', recLabel('why')], ['checked', recLabel('checked')]]
            .filter(function (k) { return p[k[0]]; });
        var lead = said.length
            ? '<section class="gv-plain" aria-label="' + recTitle() + '">' + said.map(function (k) {
                return '<h3>' + k[1] + '</h3><p>' + gateText(p[k[0]]) + '</p>';
            }).join('') + '</section>'
            : p.plain ? '<section class="gv-plain" aria-label="' + loc('det.gatePlain', '白話') + '"><h3>' + loc('det.gatePlain', '白話') + '</h3><p>' + gateText(p.plain) + '</p></section>' : '';
        var body = lead
            + (p.sha ? '<p class="gv-commit"><code>' + esc(p.sha) + '</code><span>' + gateText(p.subject) + '</span></p>' : '')
            + '<div class="gv-cols">' + gateSec(loc('det.gateSecShipped', '做得到了'), ship.length, ship.length ? '<ul class="gv-ship">' + ship.map(function (x) {
                return '<li>' + gateText(x) + '</li>';
            }).join('') + '</ul>' : '') + (side ? '<div class="gv-side">' + side + '</div>' : '') + '</div>';
        return { counts: counts, body: body };
    }
    function gateTabHtml(s, g, tasks) {
        var stage = g && g.stage ? g.stage : s && s.stage ? s.stage : '';
        // lib/gatereport.js reads no report at plan, verify or audit: none is not missing there.
        if (!g && !gateStage(stage)) return '<p class="pv-empty">' + loc('det.gateNoPage', '{s} 沒有關卡頁：這頁只列 survey、design、build、land 的 gate 報告；plan 的 gate 在「計畫」tab。', { s: esc(stage) }) + '</p>';
        if (!g || g.error === 'none') return '<p class="pv-empty">' + loc('det.gateNone', '這個 session 還沒寫出 {s} 的 handoff。stage 走到 gate 時，這裡列出它的報告。', { s: esc(stage) }) + '</p>';
        if (g.error) return '<p class="pv-empty err">' + loc('det.gateUnreadable', '讀不到 {p}：檔案在，但打不開。', { p: '<code>' + esc(g.path) + '</code>' }) + '</p>';
        var p = g.parts || {};
        var drawn = g.stage === 'survey' ? gateSurvey(p) : g.stage === 'design' ? gateDesign(p, s) : g.stage === 'build' ? gateBuild(p, planNewest(tasks))
            : g.stage === 'land' ? gateLand(p, s) : { counts: '', body: '' };
        var q = g.gate && g.gate.questions && g.gate.questions[0] ? g.gate.questions[0].question : '';
        var src = '<div class="srcline pv-src" title="' + esc(g.path) + '">' + esc(g.path) + '</div>';
        var counts = drawn.counts ? '<ul class="pv-counts">' + drawn.counts + '</ul>' : '';
        var head = gateAt(s, g)
            ? '<div class="pv-banner" data-block="gate-banner"><div class="pv-q"><span class="pill gate">' + icon('gate') + 'gate</span>'
                + '<h2>' + loc('det.gateQ', '{st} gate：{q}', { st: '<span class="gv-st" style="--c:var(--st-' + esc(g.stage) + ')">' + esc(g.stage) + '</span>',
                    q: q ? esc(q) : loc('det.gateNoQ', '報告裡沒有讀得出的 gate 問題') }) + '</h2></div>'
                + counts + src
                + '<p class="pv-where"><i class="hatchsw" aria-hidden="true"></i><span>' + loc('det.planWhere', '回答在 Claude Desktop 那邊給；這頁只讓你看清楚要核准什麼，不收答案。') + '</span></p></div>'
            : '<div class="pv-hd" data-block="gate-head">' + src + counts + '</div>';
        return head + '<div class="gv-body" data-block="gate-' + esc(g.stage) + '">' + drawn.body + gateRest(p.rest) + '</div>';
    }
    function gateTab(s, x) { return gateTabHtml(s, x.gate, x.tasks); }
    // Every column below is the sum of the rows under it: each row's cents,
    // thousands of tokens and seconds were rounded in `lib/detail.js` by the
    // largest remainder, so the page only adds.
    function sums(rows) {
        return rows.reduce(function (a, r) {
            a.c += r.c; a.k += r.k; a.s += r.s;
            a.ti += r.split ? r.split.input || 0 : 0;
            a.to += r.split ? r.split.output || 0 : 0;
            a.ci += r.cost ? r.cost.input || 0 : 0;
            a.co += r.cost ? r.cost.output || 0 : 0;
            a.requests += r.requests || 0;
            if ((r.peak || 0) > a.peak) a.peak = r.peak || 0;
            return a;
        }, { c: 0, k: 0, s: 0, ti: 0, to: 0, ci: 0, co: 0, requests: 0, peak: 0 });
    }
    // The estimated ids of these dispatch rows, unique, as `numCells` prints them; '' when none.
    function estOf(rows) {
        var ids = [];
        rows.forEach(function (r) { (r.estimated || []).forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); }); });
        return ids.join(', ');
    }
    function numCells(t, unpriced, time, estimated) {
        var tip = [], mark = estimated ? ' ' + loc('det.estShort', '估') : '';
        if (unpriced) tip.push(loc('det.priceListDoesNotKnow', '價目表不認得：{u}', { u: esc(unpriced) }));
        if (estimated) tip.push(loc('det.priceEstimated', '價目表沒有，照同家族最新一列估價：{u}', { u: esc(estimated) }));
        return '<td class="r">' + (time || dur(t.s)) + '</td><td class="r">' + comma(t.k) + 'k</td><td class="r"'
            + (tip.length ? ' title="' + tip.join('; ') + '"' : '') + '>'
            + (unpriced && !t.c ? 'unpriced' : cents(t.c)) + mark + '</td>'
            + '<td class="r">' + tokens(t.ti || 0) + '</td><td class="r">$' + (t.ci || 0).toFixed(2) + mark + '</td>'
            + '<td class="r">' + tokens(t.to || 0) + '</td><td class="r">$' + (t.co || 0).toFixed(2) + mark + '</td>'
            + '<td class="r">' + tokens(t.peak || 0) + '</td><td class="r">' + comma(t.requests || 0) + '</td>';
    }
    // `isFinite(null)` is true, and a dispatch that has not come back carries a
    // null `back`; every time below is asked this instead.
    function isNum(v) { return typeof v === 'number' && isFinite(v); }
    // ---- 派工: each agent's state, what it is on, and what it holds -------
    // `x.states` is the server's reading (`statesOf` in lib/detail.js) when the
    // detail was written. The list is re-read more often than the detail, and a
    // session that stops being live stops having its detail re-read, so an agent
    // still `running` there in a session the list now says is not live is
    // `lost`. A detail from before states existed reads `done`.
    function agentState(x, r, s) {
        var st = (x && x.states && x.states[r.id]) || 'done';
        return st === 'running' && s && s.state !== 'live' ? 'lost' : st;
    }
    // The tool a step names, the way the transcript named it.
    function toolText(c) {
        if (!c) return '';
        if (c.k === 'read' || c.k === 'edit') return (c.n || (c.k === 'read' ? 'Read' : c.w ? 'Write' : 'Edit')) + ' ' + c.f;
        if (c.k === 'cmd') return (c.n || 'Bash') + ': ' + c.c;
        return c.c || c.n || '';
    }
    function stepLabel(k, w) {
        if (k === 'edit' && w) return loc('disp.write', '寫');
        return { read: loc('disp.read', '讀'), edit: loc('disp.editShort', '改'), cmd: loc('disp.command', '指令'), find: loc('disp.find', '搜'), other: loc('disp.other', '其他') }[k] || k;
    }
    // One step; `mode` is `cur` for the step in progress and `stop` for the one a
    // lost agent never finished, and `tail` goes after it.
    function stepLi(y, mode, tail) {
        return '<li' + (mode ? ' class="' + mode + '"' : '') + '><span class="sk ' + esc(y.k) + '">' + stepLabel(y.k, y.w) + '</span><div>'
            + (y.f ? '<span class="fl">' + esc(y.f) + '</span>' : '<span class="cm">' + esc(y.c) + '</span>')
            + (!mode && y.r ? '<div class="rl">' + esc(y.r) + '</div>' : '') + '</div>' + (tail || '') + '</li>';
    }
    function agentPill(st) {
        var title = st === 'running' ? loc('disp.runningHint', 'running：還沒回來，它的 transcript 還在長')
            : st === 'done' ? loc('disp.doneHint', 'done：已經結束') : loc('disp.lostHint', 'lost：它還沒結束，跑它的 session 就停了');
        return '<span class="pill sm ' + st + '" title="' + title + '"><i class="dot '
            + (st === 'running' ? 'live' : st === 'done' ? 'down' : 'lost') + '"></i>' + st + '</span>';
    }
    function agdots(x, list, s) {
        return '<span class="agdots" aria-hidden="true">' + list.map(function (r) {
            return '<i class="' + agentState(x, r, s) + '"></i>';
        }).join('') + '</span>';
    }
    function stateTally(x, list, s) {
        var c = { running: 0, done: 0, lost: 0 };
        list.forEach(function (r) { c[agentState(x, r, s)] += 1; });
        return ['running', 'done', 'lost'].filter(function (k) { return c[k]; }).map(function (k) { return c[k] + ' ' + k; }).join(' · ');
    }
    function modelOf(r) { return (r.agentType || '—') + ' · ' + String(r.model || r.alias || '—').replace(/^claude-/, ''); }
    // Under a row's label: the tool a running agent is on and how long it has
    // been on it, or where a lost one stopped and how long it had been at it by
    // its transcript's last line.
    function nowLine(st, steps, u) {
        var cur = steps && steps.cur;
        if (!cur || (st !== 'running' && st !== 'lost')) return '';
        var what = esc(toolText(cur));
        if (st === 'running') {
            return '<div class="nowl"><span class="k">' + loc('disp.doingNow', '正在') + '</span><span class="c" title="' + what + '">' + what + '</span>'
                + (isNum(cur.t) ? '<span class="e">' + tk(-cur.t / 1000, 1, u.live, u.now / 1000) + '</span>' : '') + '</div>';
        }
        return '<div class="nowl lost"><span class="k">' + loc('disp.stoppedAt', '停在') + '</span><span class="c" title="' + what + '">' + what + '</span>'
            + (isNum(cur.t) && isNum(steps.lastAt) ? '<span class="e">' + loc('disp.ranFor', '跑了 {t}', { t: dur(Math.round((steps.lastAt - cur.t) / 1000)) }) + '</span>' : '') + '</div>';
    }
    // The running and lost counts, for the session header's 派工 readout.
    function agentCounts(x, s) {
        var run = 0, lost = 0;
        x.rows.forEach(function (r) {
            var st = agentState(x, r, s);
            if (st === 'running') run += 1;
            else if (st === 'lost') lost += 1;
        });
        return (run ? '<span class="runn"><i class="dot live"></i>' + run + ' running</span> · ' : '') + (lost ? loc('disp.nLost', '{n} lost · ', { n: lost }) : '');
    }
    function agentRow(r, cls, attr, x, s, u) {
        var st = agentState(x, r, s), steps = x && x.steps ? x.steps[r.id] : null, open = !!u.open[r.id];
        var time = st === 'running' && isNum(r.from) ? tk(-r.from / 1000, 1, u.live, u.now / 1000) : null;
        return '<tr class="' + cls + ' is-' + st + '"' + (attr || '') + '><td><div class="stc">' + agentPill(st) + '<div class="bd">'
            + '<button type="button" class="axt" data-ag="' + esc(r.id) + '" data-key="ag-' + esc(r.id) + '" aria-expanded="' + open + '"'
            + ' title="' + loc('disp.openPromptSteps', '{v} prompt 與步驟', { v: open ? loc('disp.collapse', '收起') : loc('disp.expand', '展開') }) + '"><span class="lab">' + esc(r.label || r.id) + '</span></button>'
            + '<div class="l2">' + esc(modelOf(r)) + '</div>' + nowLine(st, steps, u) + '</div></div></td>'
            + numCells(sums([r]), (r.unpriced || []).join(', '), time, (r.estimated || []).join(', ')) + '<td class="r rc"></td></tr>'
            + (open ? agentBody(r, cls, x, st, steps, u) : '');
    }
    // One agent opened: when it started and how long it ran, what it was sent
    // (three lines until opened in full), its steps in order with any not yet
    // answered marked in progress at their own position — `stepsOf` keeps
    // every one of those out of the forty the cap counts — and what it
    // returned. A `tool_use` still without a `tool_result` can only be the
    // last thing in the transcript (nothing answered runs before it gets its
    // result), so it and any other unanswered one from the same message are
    // always the list's trailing entries; only the last of them is the one
    // `cur` names and carries a start time — an earlier parallel call has
    // none, so it gets the same marker with no ticking clock.
    function agentBody(r, cls, x, st, steps, u) {
        var d = r.disp === null || r.disp === undefined ? null : x.dispatches[r.disp];
        var list = steps ? steps.steps || [] : [], cur = steps ? steps.cur : null, popen = !!u.prm[r.id];
        var lastP = -1;
        list.forEach(function (y, i) { if (y.p) lastP = i; });
        var n = list.length + (steps ? steps.droppedN || 0 : 0);
        var note = steps && steps.droppedN ? '<p class="stn">' + loc('disp.capNStepsNotListed', '上限 40 步，另有 {n} 步沒列出（', { n: steps.droppedN })
            + Object.keys(steps.dropped || {}).map(function (k) { return stepLabel(k) + ' ' + steps.dropped[k]; }).join(loc('disp.listSep', '、')) + loc('disp.closeParen', '）')
            + (cur && st === 'running' ? loc('disp.inProgressNotCounted', '；進行中的步驟不算在上限裡，永遠留在最後') : '') + '</p>' : '';
        var end = st === 'lost' && steps && isNum(steps.lastAt) ? steps.lastAt : r.to;
        var ran = st === 'running' ? loc('disp.ranSoFarB', '已跑 <b>{t}</b>', { t: tk(-r.from / 1000, 1, u.live, u.now / 1000) })
            : loc('disp.ranForB', '跑了 <b>{t}</b>', { t: isNum(end) ? dur(Math.round((end - r.from) / 1000)) : '—' });
        var prompt = steps && typeof steps.prompt === 'string'
            ? '<div class="prm' + (popen ? ' open' : '') + '"><div class="axl">prompt <span class="n">' + loc('disp.nChars', '{n} 字元', { n: comma(steps.promptLen || steps.prompt.length) })
                + (steps.promptLen > steps.prompt.length ? loc('disp.savedFirstN', '，存了前 {n}', { n: comma(steps.prompt.length) }) : '') + '</span>'
                + '<button type="button" class="lkb" data-prm="' + esc(r.id) + '" data-key="prm-' + esc(r.id) + '" aria-expanded="' + popen + '">'
                + (popen ? loc('disp.collapse', '收起') : loc('disp.expandAll', '展開全部')) + '</button></div><pre>' + esc(steps.prompt) + '</pre></div>'
            : '<div class="prm"><div class="axl">prompt <span class="n">' + loc('disp.notInTranscript', 'transcript 裡沒有') + '</span></div></div>';
        var foot;
        if (st === 'running') foot = '<div class="retl">' + loc('disp.notBackYet', '還沒回來。回來後，這裡寫它回傳了多少字元。') + '</div>';
        else if (st === 'lost') foot = '<div class="retl lost">' + loc('disp.noReturnLost', '沒有回傳：它還沒結束，跑它的 session 就停了，結果沒有進主 context。') + '</div>';
        else if (!d) foot = '<div class="retl">' + loc('disp.noMatchingDispatch', '沒有對上派工，不知道它回傳了多少。') + '</div>';
        else if (d.surface === 'workflow') {
            foot = '<div class="retl">' + (steps && isNum(steps.lastAt) ? clockSec(steps.lastAt) + ' ' : '') + loc('disp.endedMergedIntoWorkflow', '結束。它的結果併在 workflow 的回報裡')
                + (isNum(d.back) && d.ret !== null && d.ret !== undefined ? loc('disp.workflowReturnedChars', '；workflow 回傳 <b>{n}</b> 字元進主 context。', { n: comma(d.ret) })
                    : loc('disp.workflowNotBackYet', '；workflow 還沒回來，還沒有回傳字元。')) + '</div>';
        } else if (isNum(d.back) && d.ret !== null && d.ret !== undefined) {
            foot = '<div class="retl">' + loc('disp.backAtReturnedChars', '{t} 回來，回傳 <b>{n}</b> 字元進主 context', { t: clockSec(d.back), n: comma(d.ret) }) + '</div>';
        } else foot = '<div class="retl">' + loc('disp.endedReportNotIn', '已經結束，回報還沒進主 context。') + '</div>';
        return '<tr class="ax ' + cls + ' is-' + st + '"><td colspan="9"><div class="axw">'
            + '<div class="axh">' + (isNum(r.from) ? '<span>' + loc('disp.dispatchedAt', '派出 <b>{t}</b>', { t: clockSec(r.from) }) + '</span><span>' + ran + '</span>' : '')
            + '<span><b>' + n + '</b> ' + loc('disp.steps', '步') + '</span><span>' + esc(modelOf(r)) + '</span></div>'
            + prompt
            + '<div><div class="axl">' + loc('disp.stepsLabel', '步驟') + ' <span class="n">' + loc('disp.inOrderNewestBelow', '照順序，最新在下') + '</span></div><ul class="stp">'
            + list.map(function (y, i) {
                if (!y.p) return stepLi(y);
                var mode = st === 'lost' ? 'stop' : 'cur';
                var tail = st === 'running'
                    ? '<span class="pg"><i class="dot live"></i>' + loc('disp.inProgress', '進行中') + (i === lastP && isNum(cur && cur.t)
                        ? ' ' + tk(-cur.t / 1000, 1, u.live, u.now / 1000) : '') + '</span>'
                    : st === 'lost'
                        ? '<span class="pg lost">' + loc('disp.didNotFinish', '沒跑完') + (i === lastP && isNum(cur && cur.t) && isNum(steps.lastAt)
                            ? loc('disp.dotRanFor', '・跑了 {t}', { t: dur(Math.round((steps.lastAt - cur.t) / 1000)) }) : '') + '</span>'
                        : '';
                return stepLi(y, mode, tail);
            }).join('') + '</ul>' + note + '</div>'
            + foot + '</div></td></tr>';
    }
    // One band per dispatch in turn order, `surface` on the band, and a row per
    // agent carrying its state; a workflow folds into one row per phase until
    // the phase is opened, and agents no dispatch accounts for are a band of
    // their own. `s` is the session's list row — its liveness decides `lost` —
    // and `ui` what the reader has open: `open` and `prm` by agent id, `ph` by
    // phase key, `filter` one state or `all`, `now` the clock tickers start
    // from and `live` whether they tick. Both may be left out.
    function dispatchHtml(x, s, ui) {
        var u = {
            open: (ui && ui.open) || {}, prm: (ui && ui.prm) || {}, ph: (ui && ui.ph) || {},
            filter: (ui && ui.filter) || 'all', now: ui && isNum(ui.now) ? ui.now : Date.now(), live: !!(ui && ui.live),
        };
        if (!x.rows.length) {
            return '<div class="h2">' + loc('disp.dispatch', '派工') + ' <small>' + loc('disp.noAgentsYet', '這個 session 還沒派出 agent') + '</small></div><div class="emptyd"><p class="et">' + loc('disp.noAgentsYet2', '還沒派出 agent') + '</p><p class="es">'
                + (u.live && s && s.state === 'live' ? loc('disp.willAppearOnNextUpdate', '一派出，它會在下一次更新（3 秒內）出現在這裡，連同它正在跑的工具。這頁不必重新整理。')
                    : loc('disp.noAgentsDispatchedAtAll', '這個 session 沒有派出任何 agent。')) + '</p></div>';
        }
        var n = { all: x.rows.length, running: 0, done: 0, lost: 0 };
        x.rows.forEach(function (r) { n[agentState(x, r, s)] += 1; });
        var filter = u.filter !== 'all' && n[u.filter] ? u.filter : 'all';
        var pass = function (r) { return filter === 'all' || agentState(x, r, s) === filter; };
        // A stage agent's own agents: `parent` is the `parentAgentId` their
        // `.meta.json` names (`dispatchesOf` in lib/usage.js). One level: a row
        // whose parent is in the list and is itself at the top sits under it, in
        // its band; any other row is grouped as before.
        var byId = {};
        x.rows.forEach(function (r) { byId[r.id] = r; });
        var under = function (r) {
            var p = r.parent ? byId[r.parent] : null;
            return !!p && p !== r && !(p.parent && byId[p.parent]);
        };
        var kids = {};
        x.rows.forEach(function (r) { if (under(r)) (kids[r.parent] = kids[r.parent] || []).push(r); });
        var fam = function (list) { return list.reduce(function (m, r) { return m.concat([r], kids[r.id] || []); }, []); };
        var shows = function (r) { return pass(r) || (kids[r.id] || []).some(pass); };
        var withKids = function (r, cls, attr) {
            return agentRow(r, cls, attr, x, s, u) + (kids[r.id] || []).filter(pass).map(function (k) {
                return agentRow(k, cls + ' kid', attr, x, s, u);
            }).join('');
        };
        var groups = {}, order = [];
        x.rows.forEach(function (r) {
            if (under(r)) return;
            var k = r.disp === null || r.disp === undefined ? 'none' : String(r.disp);
            if (!groups[k]) { groups[k] = []; order.push(k); }
            groups[k].push(r);
        });
        order.sort(function (a, b) {
            if (a === 'none') return 1;
            if (b === 'none') return -1;
            var da = x.dispatches[a], db = x.dispatches[b];
            return (da.turn || 0) - (db.turn || 0) || (da.out || 0) - (db.out || 0);
        });
        // A session resumed under the same id: the process running it now
        // started after some of these went out, and any of those not back is
        // lost. One row says where the process changed.
        var since = isNum(x.since) ? x.since : null, gapDone = false;
        var early = since !== null && order.some(function (k) {
            return k !== 'none' && isNum(x.dispatches[k].out) && x.dispatches[k].out < since;
        });
        var gap = function () {
            var end = null;
            (x.points || []).forEach(function (p) { if (isNum(p.t) && p.t < since && (end === null || p.t > end)) end = p.t; });
            return '<tr class="gaprow"><td colspan="11">session ' + (end !== null ? loc('disp.endedAtB', '<b>{t}</b> 結束，', { t: clock(end) }) : '')
                + loc('disp.resumedSameIdLost', '<b>{t}</b> 以同一個 session id 接回來；結束前派出、還沒回來的 agent 標成 lost', { t: clock(since) }) + '</td></tr>';
        };
        var body = order.map(function (k) {
            var list = groups[k], d = k === 'none' ? null : x.dispatches[k], lead = '';
            if (early && !gapDone && d && isNum(d.out) && d.out >= since) {
                gapDone = true;
                if (filter === 'all' || filter === 'lost') lead = gap();
            }
            var vis = list.filter(shows);
            if (!vis.length) return lead;
            var wf = !!d && d.surface === 'workflow';
            var gone = !!d && !isNum(d.back) && list.every(function (r) { return agentState(x, r, s) !== 'running'; })
                && list.some(function (r) { return agentState(x, r, s) === 'lost'; });
            var head = '<tr class="band"><td><div class="bandrow"><span class="sf ' + (d ? d.surface : 'agent') + '">'
                + (d ? d.surface : '—') + '</span><span class="ell">' + esc(d ? d.text : loc('disp.noMatchingDispatchAgent', '沒有對上派工的 agent')) + '</span>'
                + (wf ? agdots(x, list, s) + '<span class="phs">' + list.filter(function (r) { return agentState(x, r, s) === 'done'; }).length
                    + ' / ' + list.length + ' done</span>' : '')
                + '<span class="rt">' + (d && d.turn ? loc('disp.turnN2', '回合 {n}', { n: d.turn }) : '')
                + (d && isNum(d.out) ? ' · ' + stamp(d.out).slice(11) + '→' + (isNum(d.back) ? stamp(d.back).slice(11) : gone ? loc('disp.notBack', '沒回來') : '…') : '')
                + '</span></div></td>' + numCells(sums(fam(list)), '', null, estOf(fam(list))) + '<td class="r rc">'
                + (d && d.ret !== null && d.ret !== undefined ? comma(d.ret) : d && !gone && !isNum(d.back) ? '…' : '—') + '</td></tr>';
            if (!wf) return lead + head + vis.map(function (r) { return withKids(r, 'ag', ''); }).join('');
            var phases = [];
            list.forEach(function (r) { var p = r.phase || '—'; if (phases.indexOf(p) < 0) phases.push(p); });
            return lead + head + phases.map(function (p, i) {
                var pr = list.filter(function (r) { return (r.phase || '—') === p; });
                var shown = pr.filter(shows);
                if (!shown.length) return '';
                var key = 'ph-' + k + '-' + i, open = !!u.ph[key] || filter !== 'all';
                return '<tr class="phr"><td><div class="phl"><button type="button" class="phb" data-ph="' + key + '" data-key="' + key
                    + '" aria-expanded="' + open + '">' + esc(p) + '<span class="n">· ' + pr.length + ' agents</span></button>'
                    + agdots(x, pr, s) + '<span class="phs">' + stateTally(x, pr, s) + '</span></div></td>' + numCells(sums(fam(pr)), '', null, estOf(fam(pr)))
                    + '<td class="r rc"></td></tr>'
                    + shown.map(function (r) { return withKids(r, 'wa', ' data-in="' + key + '"' + (open ? '' : ' hidden')); }).join('');
            }).join('');
        }).join('');
        if (early && !gapDone && (filter === 'all' || filter === 'lost')) body += gap();
        var off = {};
        ['running', 'done', 'lost'].forEach(function (k) { if (!n[k]) off[k] = loc('disp.noAgentsWithState', '沒有這個狀態的 agent'); });
        var dhead = '<div class="dhead"><div class="h2">' + loc('disp.dispatch', '派工') + ' <small>' + loc('disp.nAgentsNDispatches', '<b>{n}</b> 個 agent · {d} 次派工', { n: x.rows.length, d: x.dispatches.length }) + '</small></div><span class="spacer"></span>'
            + (ui && ui.view ? segHtml('dxv', [['chart', loc('disp.chart', '圖')], ['rows', loc('disp.perAgent', '逐個 agent')]], ui.view) : '')
            + segHtml('dfilter', [['all', loc('disp.allN', '全部 {n}', { n: n.all })], ['running', 'running ' + n.running], ['done', 'done ' + n.done], ['lost', 'lost ' + n.lost]], filter, off)
            + '</div>';
        var all = sums(x.rows);
        var ret = x.dispatches.reduce(function (m, d) { return m + (d.ret || 0); }, 0);
        var launch = x.dispatches.reduce(function (m, d) { return m + (d.launch || 0); }, 0);
        var wfRows = x.rows.filter(function (r) { return r.surface === 'workflow'; }).length;
        var wfRun = x.runs.reduce(function (m, r) { return m + r.agents; }, 0);
        var eq = function (a, b) { return '<span class="' + (a === b ? 'eq">' + loc('disp.equalsSign', '＝') : 'ne">' + loc('disp.notEqualsSign', '≠')) + '</span>'; };
        var vw = ui && ui.view ? ui.view : 'all';
        // The chart goes after the table in the markup: with no `ui.view`
        // both render, and the table's own order is what a reader of the
        // string walks first.
        var chart = vw === 'rows' ? '' : dxChartHtml(x, s, order, groups, fam, pass, all, ret, (ui && ui.metric) || 'c');
        var rows = vw === 'chart' ? '' : '<table class="x dx"><colgroup><col><col style="width:50px"><col style="width:54px"><col style="width:54px">'
            + '<col style="width:48px"><col style="width:54px"><col style="width:48px"><col style="width:54px">'
            + '<col style="width:54px"><col style="width:48px"><col style="width:58px"></colgroup><thead><tr><th>' + loc('disp.dispatch', '派工') + '</th><th class="r">' + loc('disp.timeSpent', '耗時') + '</th><th class="r">tokens</th>'
            + '<th class="r">USD</th><th class="r">input</th><th class="r">input USD</th><th class="r">output</th><th class="r">output USD</th>'
            + '<th class="r">' + loc('disp.contextPeak', 'context 峰值') + '</th><th class="r">' + loc('disp.requests', '請求數') + '</th>'
            + '<th class="r rc" title="' + loc('disp.charsReturnedHint', '這次派工的結果進入主 context 的字元數') + '">' + loc('disp.charsReturned', '回傳字元') + '</th></tr></thead>'
            + '<tbody>' + body + '</tbody><tfoot><tr><td>' + loc('disp.nAgents2', '{n} 個 agent', { n: x.rows.length }) + '</td>' + numCells(all, '', null, estOf(x.rows))
            + '<td class="r rc">' + comma(ret) + '</td></tr></tfoot></table>';
        // The chart has no row a running agent could stand in, so above it the
        // running ones keep their rows: the tool each is on, and the count the
        // session list gives.
        var live = x.rows.filter(function (r) { return agentState(x, r, s) === 'running' && pass(r); });
        if (vw === 'chart' && live.length) {
            rows = '<table class="x dx dxlive"><colgroup><col><col style="width:50px"><col style="width:54px"><col style="width:54px">'
                + '<col style="width:48px"><col style="width:54px"><col style="width:48px"><col style="width:54px">'
                + '<col style="width:54px"><col style="width:48px"><col style="width:58px"></colgroup><thead><tr><th>' + loc('disp.runningNow', '正在跑 {n}', { n: live.length }) + '</th><th class="r">' + loc('disp.timeSpent', '耗時') + '</th><th class="r">tokens</th>'
                + '<th class="r">USD</th><th class="r">input</th><th class="r">input USD</th><th class="r">output</th><th class="r">output USD</th>'
                + '<th class="r">' + loc('disp.contextPeak', 'context 峰值') + '</th><th class="r">' + loc('disp.requests', '請求數') + '</th>'
                + '<th class="r rc"></th></tr></thead><tbody>'
                + live.map(function (r) { return agentRow(r, 'ag', '', x, s, u); }).join('') + '</tbody></table>';
        }
        return dhead + rows + chart
            + '<details class="dxnote" data-key="dx-note"><summary>' + loc('disp.reconciliationAndNotes', '對帳與說明') + ' ' + eq(all.c, x.agentsTotal.cents) + eq(wfRows, wfRun) + '</summary>'
            + '<p class="tally">' + loc('disp.rowsUsdSum', '各列美元相加 <b>{a}</b>', { a: cents(all.c) + estMark({ estimated: estOf(x.rows) }) }) + ' ' + eq(all.c, x.agentsTotal.cents) + ' ' + loc('disp.agentsOfSum', 'agentsOf() 的 {a}', { a: cents(x.agentsTotal.cents) + estMark({ estimated: estOf(x.rows) }) })
            + loc('disp.workflowRowsVs', '；workflow 派工 {a} 列', { a: wfRows }) + ' ' + eq(wfRows, wfRun) + ' ' + loc('disp.runFileWorkflowAgentRows', 'run 檔的 workflow_agent {a} 列', { a: wfRun })
            + '</p>'
            + '<p class="tally">' + loc('disp.returnedCharsExplain', '回傳字元是派工的結果進入主 context 的長度：背景 agent 與 workflow 取 task-notification，前景的取 Agent 的 tool_result。背景啟動時回來的確認不算在內，這個 session 合計 {n} 字元。', { n: comma(launch) }) + loc('disp.usdByPriceList', '美元照價目表 {v}', { v: esc(S.pricesVerified || '—') }) + (x.unpriced.length ? loc('disp.unpricedList', '；價目表不認得、寫 unpriced 的：{list}', { list: x.unpriced.map(esc).join(loc('disp.listSep', '、')) }) : '')
                + ((x.estimated || []).length ? loc('disp.estimatedList', '；價目表沒有、照同家族最新一列估價的：{list}', { list: x.estimated.map(esc).join(loc('disp.listSep', '、')) }) : '')
            + '</p>'
            + (n.running ? '<p class="tally">' + loc('disp.runningRowsAsOf', 'running 的 {n} 列是到 {t} 為止的 tokens 與美元，下一次重拉會再變；耗時照秒走。', { n: n.running, t: clockSec(isNum(x.at) ? x.at : u.now) }) + '</p>' : '')
            + (n.lost ? '<p class="tally">' + loc('disp.lostRowsNoChars', 'lost 的列沒有回傳字元：它的結果沒有進主 context。耗時算到它 transcript 的最後一行。') + '</p>' : '')
            + '</details>';
    }
    // 派工 as bars: one row per dispatch in turn order, its length the metric
    // `m` picks (c cents, k thousand tokens, s seconds, r return chars), split
    // into its agents — a stage agent's own agents included — in the model
    // family's --m-* colour. Every figure the table has is on a title: the
    // row's label carries the band, each segment its agent. An agent the
    // state filter leaves out is dimmed, not dropped.
    function dxChartHtml(x, s, order, groups, fam, pass, all, ret, m) {
        var FMT = { c: cents, k: function (v) { return comma(v) + 'k'; }, s: dur, r: function (v) { return loc('disp.nChars2', '{v} 字', { v: comma(v) }); },
            peak: tokens, requests: comma };
        var f = FMT[m] ? FMT[m] : (m = 'c', FMT.c);
        var nums = function (t, est) {
            var mark = estMark({ estimated: est });
            return cents(t.c) + mark + ' · ' + comma(t.k) + 'k token · ' + dur(t.s) + ' · input ' + tokens(t.ti || 0) + ' $' + (t.ci || 0).toFixed(2) + mark
                + ' · output ' + tokens(t.to || 0) + ' $' + (t.co || 0).toFixed(2) + mark;
        };
        var fams = {};
        var rows = order.map(function (k) {
            var d = k === 'none' ? null : x.dispatches[k], list = fam(groups[k]), t = sums(list);
            var r = d && d.ret !== null && d.ret !== undefined ? d.ret : null;
            return { k: k, d: d, list: list, t: t, r: r, v: m === 'r' ? r || 0 : t[m] };
        });
        var max = Math.max.apply(null, rows.map(function (r) { return r.v; }).concat([0]));
        var total = m === 'r' ? ret : all[m];
        var body = rows.map(function (row) {
            var d = row.d, sf = d ? d.surface : 'agent';
            var tip = (d ? d.text : loc('disp.noMatchingDispatch2', '未對上派工')) + '\n' + (d && d.turn ? loc('disp.turnNDot', '回合 {n} · ', { n: d.turn }) : '')
                + (d && isNum(d.out) ? stamp(d.out).slice(11) + '→' + (isNum(d.back) ? stamp(d.back).slice(11) : '…') + ' · ' : '')
                + loc('disp.nAgentsNewline', '{n} 個 agent\n', { n: row.list.length }) + nums(row.t, estOf(row.list)) + loc('disp.newlineReturned', '\n回傳 {v}', { v: row.r === null ? '—' : loc('disp.nCharsSuffix', '{n} 字元', { n: comma(row.r) }) });
            var segs = m === 'r'
                ? (row.v ? '<i style="flex:1 1 0;background:var(--s-' + (sf === 'workflow' ? 'workflow' : 'agent') + ')"></i>' : '')
                : row.list.map(function (a) {
                    if (!a[m]) return '';
                    var fk = family(a.model || a.alias);
                    fams[fk] = true;
                    return '<i class="' + agentState(x, a, s) + (pass(a) ? '' : ' off') + '" style="flex:' + a[m] + ' 1 0;background:var(--m-' + fk + ')"'
                        + ' title="' + esc((a.label || a.id) + '\n' + modelOf(a) + ' · ' + agentState(x, a, s) + '\n' + nums(sums([a]), estOf([a]))) + '"></i>';
                }).join('');
            return '<div class="dxr" role="listitem" title="' + esc(tip) + '"><span class="dxl"><span class="sf ' + esc(sf) + '">' + esc(d ? sf : '—') + '</span>'
                + '<span class="dxn">' + esc(d ? d.text : loc('disp.noMatchingDispatch2', '未對上派工')) + '</span></span>'
                + '<span class="dxt"><span class="dxb" style="width:' + (max ? row.v / max * 88 : 0).toFixed(1) + '%">' + segs + '</span>'
                + '<b>' + (m === 'r' && row.r === null ? '—' : f(row.v)) + (m === 'c' ? estMark({ estimated: estOf(row.list) }) : '') + '</b></span></div>';
        }).join('');
        var legend = m === 'r'
            ? '<span><i class="sw" style="background:var(--s-agent)"></i>agent</span><span><i class="sw" style="background:var(--s-workflow)"></i>workflow</span>'
            : MODEL_KEYS.filter(function (k) { return fams[k]; }).map(function (k) {
                return '<span><i class="sw" style="background:var(--m-' + k + ')"></i>' + k + '</span>';
            }).join('');
        var DXM = { c: loc('disp.cost2', '花費'), k: 'token', s: loc('disp.timeSpent2', '耗時'), r: loc('disp.charsReturned2', '回傳字元'),
            peak: loc('disp.contextPeak', 'context 峰值'), requests: loc('disp.requests', '請求數') };
        return '<div class="dxc"><div class="dxch">'
            + segHtml('dxm', [['c', DXM.c], ['k', DXM.k], ['s', DXM.s], ['r', DXM.r], ['peak', DXM.peak], ['requests', DXM.requests]], m)
            + '<span class="dxsum" title="' + esc(loc('disp.nAgentsTotal', '{n} 個 agent 合計\n', { n: x.rows.length }) + nums(all, estOf(x.rows)) + loc('disp.newlineReturned', '\n回傳 {v}', { v: loc('disp.nCharsSuffix', '{n} 字元', { n: comma(ret) }) })) + '">' + loc('disp.totalB', '合計 <b>{v}</b>', { v: f(total) + (m === 'c' ? estMark({ estimated: estOf(x.rows) }) : '') }) + '</span>'
            + '<span class="spacer"></span><span class="lane-legend">' + legend + '</span></div>'
            + '<div class="dxg" role="list" aria-label="' + loc('disp.perDispatchMetric', '每次派工的{m}', { m: DXM[m] }) + '">' + body + '</div>'
            + '<div class="note">' + loc('disp.oneRowOneDispatch', '一列一次派工，照回合先後；一段一個 agent。游標停在列或段上看全部數字。') + '</div></div>';
    }
    function stepsFor(x, d) {
        if (!d) return '';
        var ids = d.ids.filter(function (id) { return x.steps[id]; });
        if (!ids.length) return '';
        var shown = 0, total = 0;
        ids.forEach(function (id) { shown += x.steps[id].steps.length; total += x.steps[id].steps.length + x.steps[id].droppedN; });
        return '<details class="stw" data-block="tool-collapsed" data-key="stw-' + esc(d.key) + '"><summary class="rpx">' + loc('disp.expandOwnSteps', '展開它自己的步驟') + ' <span class="n">' + loc('disp.shownOfTotalSteps', '{shown} / {total} 步', { shown: shown, total: total })
            + (ids.length > 1 ? ' · ' + ids.length + ' agents' : '') + '</span></summary>' + '<div class="to" data-block="tool-output">' + ids.map(function (id) {
                var st = x.steps[id];
                var r = x.rows.filter(function (y) { return y.id === id; })[0];
                return (ids.length > 1 ? '<div class="stg">' + esc(r ? r.label : id) + '</div>' : '')
                    + '<ul class="stp">' + st.steps.map(function (y) {
                        return '<li' + (y.p ? ' class="cur"' : '') + '><span class="sk ' + y.k + '">' + stepLabel(y.k, y.w) + '</span><div>'
                            + (y.f ? '<span class="fl">' + esc(y.f) + '</span>' : '<span class="cm">' + esc(y.c) + '</span>')
                            + (y.r ? '<div class="rl">' + esc(y.r) + '</div>' : '')
                            + (y.p ? '<span class="pg"><i class="dot live"></i>' + loc('disp.inProgress', '進行中') + '</span>' : '') + '</div></li>';
                    }).join('') + '</ul>'
                    + (st.droppedN ? '<p class="stn">' + loc('disp.capNStepsNotListed', '上限 40 步，另有 {n} 步沒列出（', { n: st.droppedN })
                        + Object.keys(st.dropped).map(function (k) { return stepLabel(k) + ' ' + st.dropped[k]; }).join(loc('disp.listSep', '、')) + loc('disp.closeParen', '）') + '</p>' : '');
            }).join('') + '</div></details>';
    }
    // The replay in segments, the direction the 2026-09-24 mockup approved:
    // a strip of what each stage took, a table of contents by segment, the
    // kind filter, then one folding section per stage. `s` is the session's
    // row: its `stages` carry each segment's window, `burn` and `usd` — the
    // same figures the summary table prints, and the only ones that add up to
    // the session's `burn`. Without it the rows are one segment.
    // A function, not a var: the module export above returns before a var
    // this far down is assigned, and a declaration is hoisted.
    function rpKinds() {
        return [['prompt', 'prompt'], ['stage', loc('disp.stage2', '階段')], ['gate', 'gate'], ['out', loc('disp.dispatchedOut', '派出')], ['back', loc('disp.returnedBack', '回來')],
            ['edit', loc('disp.editedFiles', '改檔')], ['commit', 'commit'], ['test', loc('disp.tests', '測試')]];
    }
    // Each event goes to the last stage entered at or before it, the way
    // `windowsFrom` in lib/registry.js buckets; one before every stage, or
    // with no time, goes to a segment of its own.
    function segmentsOf(events, stages) {
        var st = (stages || []).filter(function (w) { return w && isNum(w.from); })
            .slice().sort(function (a, b) { return a.from - b.from; });
        var segs = st.map(function (w) {
            return { stage: w.stage, from: w.from, to: isNum(w.to) ? w.to : null, burn: isNum(w.burn) ? w.burn : null,
                usd: isNum(w.usd) ? w.usd : null, estimated: w.estimated === true, waited: isNum(w.waited) ? w.waited : null, rows: [] };
        });
        var loose = { stage: null, from: null, to: null, burn: null, usd: null, waited: null, rows: [] };
        (events || []).forEach(function (e, i) {
            var k = -1;
            if (isNum(e.t)) for (var j = 0; j < segs.length; j++) if (segs[j].from <= e.t) k = j;
            (k < 0 ? loose : segs[k]).rows.push({ e: e, i: i });
        });
        return (loose.rows.length || !segs.length ? [loose] : []).concat(segs);
    }
    function rpTag(kind, extra) {
        var name = kind;
        rpKinds().forEach(function (k) { if (k[0] === kind) name = k[1]; });
        return '<span class="tg ' + esc(kind) + (extra ? ' ' + extra : '') + '">' + esc(name) + '</span>';
    }
    // A span of milliseconds to the second, the way the mockup reads a
    // segment's time; `mins` rounds too hard for a stage of a few minutes.
    function took(ms) { return isNum(ms) ? dur(Math.round(Math.max(ms, 0) / 1000)) : '—'; }
    function replayRow(x, e, i, off) {
        var tx;
        if (e.kind === 'gate') {
            // The question, the options offered with the one taken marked,
            // and the answer: a gate reads as the pair it was.
            tx = '<div class="gp" data-block="gate-pair">' + rpTag('gate')
                + (isFinite(e.askedAt) ? loc('disp.waitedT', '等了 {t}', { t: dur(Math.round((e.t - e.askedAt) / 1000)) }) + '<span class="w">' + loc('disp.askedArrowAnswered', '{a} 問 → {b} 答', { a: stamp(e.askedAt).slice(11), b: isFinite(e.t) ? stamp(e.t).slice(11) : '—' }) + '</span>' : '')
                + e.qs.map(function (q) {
                    var labels = Array.isArray(q.labels) ? q.labels : [];
                    return '<div class="qa"><span class="k">' + loc('disp.question', '問') + '</span><div class="q">' + esc(q.q)
                        + (labels.length ? '<div class="opts">' + labels.map(function (l) {
                            return '<span' + (l === q.a ? ' class="on"' : '') + '>' + esc(l) + '</span>';
                        }).join('') + '</div>' : '')
                        + '</div><span class="k">' + loc('disp.answer2', '答') + '</span><div class="a">'
                        + esc(q.a === null ? loc('disp.noAnswer', '（沒有答案）') : q.a) + (q.own ? '<span class="own">' + loc('disp.wroteOwn', '自己寫的') + '</span>' : '') + '</div></div>';
                }).join('') + '</div>';
        } else if (e.kind === 'out') {
            // A dispatch is one card from out to back: who went, how long it
            // was away, what it returned, and its own steps folded.
            var d = x.dispatches[e.disp];
            var back = d && isNum(d.back) ? d.back : null;
            tx = '<div class="ad" data-block="agent-dispatch">' + rpTag('out') + esc(e.text) + '<div class="sub">'
                + esc(e.surface + (e.agentType ? ' · ' + e.agentType : '') + (e.alias ? ' · ' + e.alias : '')) + '</div>'
                + (d && isNum(d.out) ? '<div class="span"><span class="tt">' + stamp(d.out).slice(11) + '</span><span class="ln' + (back === null ? ' open' : '') + '"></span>'
                    + '<span class="tt">' + (back === null ? loc('disp.notBackYet2', '還沒回來') : stamp(back).slice(11) + ' · ' + took(back - d.out)
                        + (isNum(d.ret) ? loc('disp.dotReturnedNChars', ' · 回傳 {n} 字元', { n: comma(d.ret) }) : '')) + '</span></div>' : '')
                + stepsFor(x, d) + '</div>';
        } else if (e.kind === 'edit') {
            tx = '<details class="tc" data-block="tool-collapsed" data-key="tc-' + i + '"><summary>' + rpTag('edit') + loc('disp.editedNFiles', '改了 {n} 個檔', { n: e.files.length }) + '</summary>'
                + '<div class="to" data-block="tool-output">' + e.files.map(function (f) {
                    return '<span class="fl">' + esc(f.f) + (f.n > 1 ? ' ×' + f.n : '') + '</span>';
                }).join(loc('disp.listSep', '、')) + '</div></details>';
        } else {
            var body;
            if (e.kind === 'prompt') body = '<span class="q">' + esc(e.text) + '</span>' + (e.cmd ? '<div class="sub">' + esc(e.cmd) + '</div>' : '');
            else if (e.kind === 'stage') {
                body = esc(e.verb === 'stage' ? e.stage : e.verb + (e.stage ? ' · ' + e.stage : ''))
                    + (e.text ? '<div class="sub">' + esc(e.text) + '</div>' : '');
            } else if (e.kind === 'back') {
                body = esc(e.text) + '<div class="sub">' + loc('disp.returnedColon2', '回傳 {v}', { v: e.ret === null || e.ret === undefined ? '—' : loc('disp.nCharsSuffix', '{n} 字元', { n: comma(e.ret) }) }) + '</div>';
            } else if (e.kind === 'commit') body = '<span class="sha">' + esc(e.sha) + '</span>' + esc(e.text);
            else body = esc(e.text);
            tx = rpTag(e.kind, e.kind === 'test' && /ℹ fail 0(?!\d)/.test(e.text || '') ? 'ok' : '') + body;
        }
        return '<li data-kind="' + esc(e.kind) + '" id="rv-' + i + '"' + (off[e.kind] ? ' hidden' : '') + ' data-t="' + (isFinite(e.t) ? e.t : '') + '"><span class="tm">'
            + (isFinite(e.t) ? stamp(e.t).slice(11) : '—') + '</span><div class="tx">' + tx + '</div></li>';
    }
    function replayHtml(x, hidden, s) {
        var off = hidden || {};
        var count = {};
        x.events.forEach(function (e) { count[e.kind] = (count[e.kind] || 0) + 1; });
        var segs = segmentsOf(x.events, s && s.stages);
        var span = function (g) { return isNum(g.from) && isNum(g.to) ? Math.max(g.to - g.from, 0) : null; };
        var total = segs.reduce(function (n, g) { return n + (span(g) || 0); }, 0);
        var usdAll = segs.reduce(function (n, g) { return n + (g.usd || 0); }, 0);
        var waitAll = segs.reduce(function (n, g) { return n + (g.waited || 0); }, 0);
        var name = function (g) { return g.stage || loc('disp.unsegmented', '未分段'); };
        var color = function (g) { return STAGE_C[g.stage] || '#888'; };
        var burnSum = segs.reduce(function (n, g) { return n + (g.burn || 0); }, 0);
        var pct = function (v) { return Math.min(Math.max(v, 0), 100).toFixed(1) + '%'; };
        // Where the session sat waiting on a gate, hatched over the stage it
        // was asked in: each gate row's askedAt to its answer, placed inside
        // its own segment's share of the track.
        var waits = function (g) {
            var sp = span(g);
            if (!sp) return '';
            return g.rows.filter(function (r) { return r.e.kind === 'gate' && isNum(r.e.askedAt) && isNum(r.e.t); }).map(function (r) {
                var a = Math.max(r.e.askedAt, g.from), b = Math.min(r.e.t, g.to);
                if (b <= a) return '';
                return '<i class="wait" style="left:' + pct((a - g.from) / sp * 100) + ';width:' + pct((b - a) / sp * 100) + '"></i>';
            }).join('');
        };
        var track = function (label, value, share, text) {
            return '<span class="lab">' + label + '</span><div class="trk">' + segs.map(function (g, k) {
                var w = share(g);
                if (!w) return '';
                return '<button type="button" class="rs" data-rs="rs-' + k + '" style="flex:0 0 ' + w.toFixed(1) + '%;background:' + color(g) + '" title="'
                    + esc(name(g)) + ' · ' + took(span(g)) + ' · context ' + tokens(g.burn) + (g.usd === null ? '' : ' · ' + usd(g.usd) + estMark(g)) + '">'
                    + (w > 9 ? text(g) : '') + (label === loc('disp.time2', '時間') ? waits(g) : '') + '</button>';
            }).join('') + '</div><span class="val">' + value + '</span>';
        };
        var strip = '<div class="rpcs" data-block="cost-strip">' + (total ? '<div class="cs">'
            + track(loc('disp.time2', '時間'), took(total), function (g) { return span(g) === null ? 0 : span(g) / total * 100; }, function (g) {
                return esc(name(g)) + '<span class="v">' + took(span(g)) + '</span>';
            })
            + (usdAll ? track(loc('disp.cost3', '花費'), usd(usdAll, true) + estMark({ estimated: segs.some(function (g) { return g.estimated; }) }), function (g) { return (g.usd || 0) / usdAll * 100; }, function (g) { return usd(g.usd, true) + estMark(g); }) : '')
            + '<div class="key">' + (waitAll ? '<span><i class="sw hatch"></i>' + loc('disp.waitingOnYouGatePct', '等你回答 gate（{t}，佔 {p}%）', { t: took(waitAll), p: Math.round(waitAll / total * 100) }) + '</span>' : '') + '<span>' + loc('disp.clickJumpToStage', '點一段就跳到那個階段') + '</span></div></div>' : '')
            + (s ? '<p class="tally">' + loc('disp.segmentsSumB', '各段 context 相加 <b>{n}</b>', { n: comma(burnSum) }) + ' <span class="' + (burnSum === (s.burn || 0) ? 'eq">' + loc('disp.equalsSign', '＝') : 'ne">' + loc('disp.notEqualsSign', '≠'))
                + '</span> ' + loc('disp.sessionsBurnN', '這個 session 的 burn {n}', { n: comma(s.burn || 0) }) + '</p>' : '') + '</div>';
        var KEY = { gate: 1, out: 1, commit: 1 };
        var keyText = function (e) {
            var t = e.kind === 'gate' ? (e.qs[0] ? (e.qs[0].a === null ? loc('disp.noAnswer', '（沒有答案）') : e.qs[0].a) : '')
                : e.kind === 'commit' ? e.sha + ' ' + e.text : e.text;
            return String(t || '').slice(0, 40);
        };
        var last = null;
        x.events.forEach(function (e) { if (isNum(e.t) && (last === null || e.t > last)) last = e.t; });
        var toc = '<nav class="rptoc" data-block="toc" aria-label="' + loc('disp.tableOfContents', '段落目錄') + '"><div class="h">' + loc('disp.contents', '目錄') + '</div><ol>' + segs.map(function (g, k) {
            var keys = g.rows.filter(function (r) { return KEY[r.e.kind]; });
            return '<li><button type="button" class="rs sg" data-rs="rs-' + k + '"><i class="bar" style="background:' + color(g) + '"></i><b>' + esc(name(g)) + '</b>'
                + '<span class="d">' + took(span(g)) + '</span><span class="m">' + (isNum(g.from) ? stamp(g.from).slice(11, 16) + ' · ' : '')
                + 'context ' + tokens(g.burn) + (g.usd === null ? '' : ' · ' + usd(g.usd, true) + estMark(g)) + ' · ' + loc('disp.nRows2', '{n} 列', { n: g.rows.length }) + '</span></button>'
                + (keys.length ? '<ol>' + keys.map(function (r) {
                    return '<li><button type="button" class="rs" data-rs="rv-' + r.i + '"><span class="tm">' + (isFinite(r.e.t) ? stamp(r.e.t).slice(11, 16) : '—')
                        + '</span>' + rpTag(r.e.kind) + '<span class="kt">' + esc(keyText(r.e)) + '</span></button></li>';
                }).join('') + '</ol>' : '') + '</li>';
        }).join('') + '</ol><div class="tf">' + loc('disp.nRows2', '{n} 列', { n: x.events.length }) + (last === null ? '' : loc('disp.lastRowAt', '<br>最後一列 {t}', { t: stamp(last).slice(11) })) + '</div></nav>';
        var bar = '<div class="rpf" data-block="filter-bar" role="group" aria-label="' + loc('disp.eventKinds', '事件種類') + '">' + rpKinds().map(function (k) {
            return '<button type="button" data-rk="' + k[0] + '" data-key="rk-' + k[0] + '" aria-pressed="' + !off[k[0]] + '">' + k[1] + '<span class="n">'
                + (count[k[0]] || 0) + '</span></button>';
        }).join('') + '<span class="spacer"></span><button type="button" class="rpx-all" data-xall>' + loc('disp.expandAll2', '全部展開') + '</button></div>';
        var body = segs.map(function (g, k) {
            var n = function (kind) { return g.rows.filter(function (r) { return r.e.kind === kind; }).length; };
            var prev = k > 0 && segs[k - 1].stage ? segs[k - 1].stage + ' → ' + name(g) : 'start';
            return '<details class="rpseg" id="rs-' + k + '" open><summary class="sh" data-block="segment-header" data-burn="' + (g.burn === null ? '' : g.burn) + '">'
                + '<i class="band" style="background:' + color(g) + '"></i><div><div class="t"><b>' + esc(name(g)) + '</b>'
                + (isNum(g.from) ? '<span class="from">' + esc(prev) + ' · ' + stamp(g.from).slice(11) + '</span>' : '')
                + '<span class="caret" aria-hidden="true">▶</span></div>'
                + '<div class="ct"><span><b>' + n('gate') + '</b> gate</span><span><b>' + n('out') + '</b> ' + loc('disp.dispatchedOut', '派出') + '</span><span><b>' + n('commit') + '</b> commit</span>'
                + '<span>' + loc('disp.nRows2', '{n} 列', { n: g.rows.length }) + '</span></div></div>'
                + '<dl class="m"><dt>' + loc('disp.timeSpent2', '耗時') + '</dt><dd class="big">' + took(span(g)) + '</dd><dt>context</dt><dd>' + tokens(g.burn) + '</dd>'
                + (g.usd === null ? '' : '<dt>' + loc('disp.cost3', '花費') + '</dt><dd>' + usd(g.usd) + estMark(g) + '</dd>')
                + (g.waited ? '<dt>' + loc('disp.waitedGate', '等 gate') + '</dt><dd>' + took(g.waited) + '</dd>' : '') + '</dl></summary>'
                + '<ol class="rp">' + g.rows.map(function (r) { return replayRow(x, r.e, r.i, off); }).join('') + '</ol></details>';
        }).join('');
        return '<div class="rpw">' + strip + '<div class="rpb">' + toc + '<div class="rpm">' + bar + body + '<p class="tally">' + loc('disp.nRows2', '{n} 列', { n: x.events.length })
            + (x.dropped ? loc('disp.over300RowsDropped', '；超過 300 列，只留 gate、階段、commit 與派工，丟掉了 {n} 列', { n: x.dropped }) : '') + '</p></div></div></div>';
    }

    // ---- 記成 TODO -------------------------------------------------------
    // One TODO line — an entry's description, or a TODO.md bullet — in the shape todo-check
    // reads: the text, then the link it points at. `scripts/station.js`
    // builds the line it writes with this same function.
    function todoEntry(text, link) {
        var l = String(link || '').trim();
        var label = l ? (l.split('#')[0].split('/').pop() || l) : '';
        return String(text || '').replace(/\s+/g, ' ').trim() + (l ? ' — [' + label + '](' + l + ')' : '');
    }
    function riseTodo(id, r) {
        return loc('todo.stationTag', '〔station〕') + String(id).slice(0, 8) + loc('todo.turnFromTo', ' 回合 {from}→{to}', { from: r.from, to: r.n }) + ' context +' + tokens(r.dy) + loc('todo.colon', '：')
            + (r.cause === 'self' ? r.self.label
                : r.top[0] ? loc('todo.labelNChars', '{l} {n} 字元', { l: r.top[0].label, n: comma(r.top[0].chars) }) : loc('todo.incomingOutput', '進來的輸出'));
    }
    function backTodo(id, b) {
        return loc('todo.stationTag', '〔station〕') + String(id).slice(0, 8) + ' ' + b.from + '→' + b.to + loc('todo.backtrackAtStayed', ' 倒退（{at}，{from} 待了 {t}）：', { at: stamp(b.at), from: b.from, t: mins(b.at - b.since) }) + loc('todo.caughtWhyNot', '{from} 抓到的，{to} 為什麼沒抓到', { from: b.from, to: b.to });
    }
    // Served, a form that posts the line to `/todo`, which checks it with
    // todo-check's own rules before writing and answers 400 with the rule that
    // failed. A file on disk cannot post, so it prints the line to copy.
    function todoSpot(text, link, s) {
        if (!S.serve) {
            return '<div class="td"><div class="tdc"><code>- ' + esc(todoEntry(text, link)) + '</code></div>'
                + '<div class="tds">' + loc('todo.staticPageCopyLine', '靜態頁不寫檔：有 todo 資料夾就用 todo.js new 記下這一行，否則貼進 TODO.md 的 ## Needs a decision。') + '</div></div>';
        }
        return '<details class="td"><summary class="tdb">' + loc('todo.recordAsTodo', '記成 TODO') + ' <span class="m">POST /todo</span></summary>'
            + '<div class="tdf" data-todo-root="' + esc(s.root) + '" data-todo-id="' + esc(s.id) + '">'
            + '<label>' + loc('todo.entryLabel', '條目（一行：todo 資料夾的 description，或 TODO.md 的 ## Needs a decision）') + '</label><textarea rows="2" spellcheck="false">'
            + esc(text) + '</textarea><label>' + loc('todo.link', '連結') + '</label><input type="text" spellcheck="false" value="' + esc(link) + '">'
            + '<label>' + loc('todo.bodyLabel', 'body（有 todo 資料夾時必填，至少 200 字元：從哪來、要做成什麼樣、怎樣算完成）') + '</label><textarea class="tdbd" rows="5" spellcheck="false"></textarea>'
            + '<div class="help">' + loc('todo.checkedBeforeSubmit', '送出前跑 todo-check 的同一套規則：條目 ≤ 200 字元、連結要存在、不指向 plan、decision、report、archive；有 todo 資料夾時 body 至少 200 字元。') + '</div>'
            + '<div class="act"><button type="button" class="go" data-todo>' + loc('todo.submit', '送出') + '</button></div>'
            + '<div class="tdr" role="status" aria-live="polite"></div></div></details>';
    }

    // ---- 比較 ----------------------------------------------------------------

    function pageTitle(r) {
        var v = navOn(r && r.view), hit = '';
        NAV_TREE.forEach(function (g) {
            if (g.v === v) hit = hit || g.label;
            // A group with one page is that page: 設定, not its only kid 精靈.
            (g.kids || []).forEach(function (k) { if (k[0] === v) hit = hit || (g.kids.length === 1 ? g.label : k[2]); });
        });
        return hit || NAV_TREE[0].label;
    }
    if (typeof module !== 'undefined' && module.exports) module.exports.pageTitle = pageTitle;
    function drawSide() {
        doc.getElementById('side').innerHTML = '<h1 class="ptitle">' + esc(pageTitle(route)) + '</h1>';
    }
    VIEWS.days = daysPage;
    // 文件 is FK_DOCS (assets/station/docs-page.js): the docs-health matrix,
    // its findings, the reader and the project dialog (station-38).
    VIEWS.docs = function (r) { return w.FK_DOCS.page(S, modOpts({ pkeys: PKEYS })); };
    VIEWS.tour = function () { return tourPage(Boolean(S.serve)); };
    VIEWS.list = listPage;
    // 設定 is FK_SETTINGS (assets/station/settings-page.js, 快速設定), which
    // hands #/settings/detail[/<step>] to FK_SETDETAIL itself; parseHash sends
    // every #/settings/… hash here (station-39).
    VIEWS.settings = function (r) { return w.FK_SETTINGS.page(S, modOpts({ hash: String(w.location.hash || ''), nonce: S.nonce, plugin: S.plugin, configDir: S.configDir })); };
    // The redesigned pages (station redesign §1–§4) are modules the shell
    // loads before this file; each is handed the station and what this file
    // derives from it. 計畫, 事件 and 關卡 stay on the session page this file
    // still draws (sessionPage), as does a session only the 花費 page knows.
    function modOpts(extra) {
        return Object.assign({ names: NAMES, now: S.serve ? Date.now() : NOW, serve: Boolean(S.serve), redraw: draw, clear: clearControl }, extra);
    }
    VIEWS.now = function (r) { return w.FK_LIVE.page(S, modOpts()); };
    VIEWS.live = function (r) { return w.FK_LIVE.page(S, modOpts()); };
    VIEWS.sessions = function (r) { return w.FK_SESSIONS.page(S, modOpts({ tray: false })); };
    // 比較 lands on the list with its compare tray, so it is never an empty page.
    VIEWS.cmp = function (r) { return w.FK_SESSIONS.page(S, modOpts({ tray: true })); };
    VIEWS.projects = function (r) { return w.FK_PROJECTS.page(S, modOpts({ hash: String(w.location.hash || '') })); };
    VIEWS.project = function (r) { return w.FK_PROJECT.page(S, r.pkey, modOpts({ todo: r.todo })); };
    var SESSION_TABS = ['timeline', 'cost', 'dispatch', 'talk'];
    VIEWS.session = function (r) {
        var s = S.sessions.filter(function (x) { return x.id === r.id; })[0];
        if (!s || SESSION_TABS.indexOf(r.tab) < 0) return sessionPage(r);
        needDetail(s);
        var tab = r.tab === 'cost' ? 'timeline' : r.tab, talk;
        if (tab === 'talk') {
            if (S.serve && !TALK[s.id]) talkLoad(s.id, true);
            talk = S.serve ? TALK[s.id] : { turns: [], total: null, state: 'static' };
        }
        return w.FK_SESSION.page(s, DETAIL[s.id] || null, modOpts({ tab: tab, talk: talk }));
    };
    var drawnHash = null;
    var drawnParts = null;
    // The page's top-level elements as markup, or null where this document
    // cannot parse a fragment (the test harness's fake DOM) or the view put
    // bare text at the top level — both mean draw it whole.
    function partsOf(html) {
        var t = doc.createElement('template');
        if (!t || !t.content || !t.content.children) return null;
        t.innerHTML = html;
        var loose = [].some.call(t.content.childNodes, function (n) { return n.nodeType === 3 && n.textContent.trim(); });
        return loose ? null : [].map.call(t.content.children, function (c) { return c.outerHTML; });
    }
    var fkRec = null;
    // The poll repaints this every few seconds; a box being typed in or a mic that is listening would
    // lose its place, so only a click (`force`) repaints then.
    function drawFloat(force) {
        var fk = doc.getElementById('fk');
        if (!fk) return;
        var ae = doc.activeElement;
        if (!force && (fkRec || (ae && ae.getAttribute && ae.getAttribute('data-gfree') !== null))) return;
        var held = S.sessions.some(function (s) { return s.pending && s.pending.questions && s.pending.questions.length; });
        if (!held) delete view.pg['fk:shut'];
        var old = doc.getElementById('fkp'), top = old ? old.scrollTop : 0;
        fk.innerHTML = floatHtml(S.sessions, view.notes, view.fkOpen, S.serve ? Date.now() : NOW, view.pg, w.Notification ? w.Notification.permission : 'denied', view.fkBox, view.gone);
        var p = doc.getElementById('fkp'); if (p && top) p.scrollTop = top;
        fk.className = 'fk' + (held ? ' hasgate' : '');
    }
    // Resizing the gate panel by its corner grip. The move/up/cancel listeners sit
    // on the window and pointerdown on the document, not on #fkp, because drawFloat
    // rebuilds #fkp every repaint; the size lives in view.fkBox, which pointermove
    // and the window resize write, fkDrop stores, and drawFloat passes to floatHtml
    // (which only reads it), so a repaint mid-drag draws it where it is.
    var FK_BOX_KEY = 'station.fkBox';
    var fkDrag = null;
    function fkFit(b) {
        var vw = w.innerWidth, vh = w.innerHeight;
        return vw && vh ? fkBoxClamp(b, vw, vh) : b;
    }
    view.fkBox = fkFit(fkBoxParse(stored(FK_BOX_KEY)));
    // Editing rows the reader dismissed with × (station-50), kept across
    // reloads; the request itself is settled by `tune.js drop` or its 24-hour
    // expiry (lib/tune.js statusOf), not by this.
    var FK_GONE_KEY = 'station.fkGone';
    view.gone = goneParse(stored(FK_GONE_KEY));
    function goneSave() { store(FK_GONE_KEY, JSON.stringify(goneKeys(view.gone))); }
    function fkApply() {
        var p = doc.getElementById('fkp'), b = view.fkBox;
        if (!p || !b) return;
        p.style.width = Math.round(b.w) + 'px';
        p.style.height = Math.round(b.h) + 'px';
    }
    doc.addEventListener('pointerdown', function (e) {
        var t = e.target;
        if (e.button || !t || !t.closest || !t.closest('#fk [data-fk-resize]')) return;
        var p = doc.getElementById('fkp');
        if (!p) return;
        var r = p.getBoundingClientRect();
        fkDrag = { sx: e.clientX, sy: e.clientY, box: { w: r.width, h: r.height } };
        e.preventDefault();
    });
    w.addEventListener('pointermove', function (e) {
        if (!fkDrag) return;
        var b = fkDrag.box;
        view.fkBox = fkFit({ w: b.w - (e.clientX - fkDrag.sx), h: b.h + e.clientY - fkDrag.sy });
        fkApply();
    });
    function fkDrop() {
        if (!fkDrag) return;
        fkDrag = null;
        if (view.fkBox) store(FK_BOX_KEY, JSON.stringify(view.fkBox));
    }
    w.addEventListener('pointerup', fkDrop);
    w.addEventListener('pointercancel', fkDrop);
    w.addEventListener('resize', function () {
        if (!view.fkBox) return;
        view.fkBox = fkFit(view.fkBox);
        fkApply();
    });
    // Close the panel, also when a held gate would keep it open: `fk:shut` stands until the gate is gone.
    function fkClose() {
        var heldNow = S.sessions.some(function (s) { return s.pending && s.pending.questions && s.pending.questions.length; });
        if (view.fkOpen) view.notes = readAll(view.notes);
        view.fkOpen = false;
        if (heldNow) view.pg['fk:shut'] = true;
        drawFloat(true);
    }
    // Voice fills the box and never sends. The same approach as assets/station/mobile.js `listen`.
    function fkListen(btn, box, say) {
        var SR = w.SpeechRecognition || w.webkitSpeechRecognition;
        if (!SR || !box) return null;
        var base = box.value ? box.value.replace(/\s*$/, ' ') : '', failed = false, rec = new SR();
        rec.lang = 'zh-TW';
        rec.interimResults = true;
        rec.continuous = true;
        btn.classList.add('on');
        btn.setAttribute('aria-pressed', 'true');
        say(loc('cmp.micOn', '聆聽中… 再按一次停止'), true);
        rec.onresult = function (e) {
            var fin = '', mid = '';
            for (var i = 0; i < e.results.length; i++) {
                if (e.results[i].isFinal) fin += e.results[i][0].transcript; else mid += e.results[i][0].transcript;
            }
            box.value = base + fin + mid;
            box.classList.toggle('interim', Boolean(mid));
            if (w.Event) box.dispatchEvent(new w.Event('input', { bubbles: true }));
        };
        rec.onerror = function (e) {
            failed = true;
            say(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? loc('cmp.micDenied', '沒有麥克風權限：到瀏覽器設定允許') : loc('cmp.micMissed', '沒聽清楚：再按一次麥克風'), false);
        };
        rec.onend = function () {
            btn.classList.remove('on');
            btn.setAttribute('aria-pressed', 'false');
            box.classList.remove('interim');
            if (!failed) say(box.value.trim() ? loc('cmp.micDone', '聽好了：可以改字，按送出才會送') : '', false);
            fkRec = null;
        };
        rec.start();
        return rec;
    }
    doc.addEventListener('input', function (e) {
        var t = e.target && e.target.closest ? e.target.closest('#fk [data-gfree]') : null;
        if (!t) return;
        view.pg[t.getAttribute('data-gfree') + ':free'] = t.value;
        var b = t.closest('.gc').querySelector('[data-gfs]');
        if (b) b.disabled = !t.value.trim();
    });
    var fkSheetY = null;
    doc.addEventListener('pointerdown', function (e) {
        if (e.target && e.target.closest && e.target.closest('#fk [data-fkg]')) fkSheetY = e.clientY;
    });
    w.addEventListener('pointerup', function (e) {
        var down = fkSheetY;
        fkSheetY = null;
        if (down !== null && e.clientY - down > 60) fkClose();
    });
    // The hash a `#/p/<pkey>/todo[/<id>]` arrived with, until its TODO panel or
    // entry is scrolled into view; null once it is. Tried after every draw, since
    // the panel can come with a later data read; a hash the reader has left is
    // not chased.
    var focusFor = w.location.hash;
    function focusTodo() {
        if (focusFor !== w.location.hash || route.view !== 'project' || route.todo === undefined) return;
        var to = (route.todo && doc.getElementById('todo-' + route.todo)) || doc.getElementById('todo');
        if (!to) return;
        focusFor = null;
        to.scrollIntoView({ block: 'start' });
    }
    function draw() {
        route = parseHash(w.location.hash);
        if (route.view === 'project') route.pkey = knownPkey(route.pkey, S.sessions);
        var p = doc.getElementById('page');
        p.className = 'page' + (route.view === 'list' ? ' fixed' : '');
        // A 篩選 checkbox with focus keeps it through the 3 s redraw.
        var fkAt = doc.activeElement && doc.activeElement.getAttribute ? doc.activeElement.getAttribute('data-fk') : null;
        // So does how far the days legend strip was scrolled.
        var STRIPS = '.lstrip .legend', stripKey = function () { return 'legend'; };
        var scrolled = {};
        if (doc.querySelectorAll && route.view === 'days') {
            [].forEach.call(doc.querySelectorAll(STRIPS), function (el) { if (el.scrollLeft) scrolled[stripKey(el)] = el.scrollLeft; });
        }
        // And an open facet popover keeps its focused row or search caret
        // and how far its list was scrolled.
        var rAct = pickOpen && doc.activeElement && doc.activeElement.closest ? doc.activeElement.closest('.rpop [data-v], .rpop [data-pickq]') : null;
        var rAt = rAct ? (rAct.hasAttribute('data-pickq') ? { q: rAct.selectionStart } : { v: rAct.getAttribute('data-v') }) : null;
        var rPop = pickOpen && doc.querySelector ? doc.querySelector('.rpop .seg') : null, rTop = rPop ? rPop.scrollTop : 0;
        // A <details> the reader opened or shut stays that way through a
        // redraw of the same page, found again by its id, data-key or data-block.
        var DETS = 'details[id],details[data-key],details[data-block]';
        var detKey = function (d) { return d.id || d.getAttribute('data-key') || d.getAttribute('data-block'); };
        var dets = {}, samePage = w.location.hash === drawnHash;
        if (samePage && doc.querySelectorAll) [].forEach.call(doc.querySelectorAll(DETS), function (d) { dets[detKey(d)] = d.open; });
        drawnHash = w.location.hash;
        var html = (VIEWS[route.view] || VIEWS.now)(route);
        var parts = partsOf(html);
        var changed = samePage && parts ? changedParts(drawnParts, parts) : null;
        if (changed && p.children && p.children.length === parts.length) {
            changed.forEach(function (i) {
                var t = doc.createElement('template');
                t.innerHTML = parts[i];
                p.replaceChild(t.content.firstElementChild, p.children[i]);
            });
        } else {
            p.innerHTML = html;
        }
        drawnParts = parts;
        if (samePage && doc.querySelectorAll) {
            [].forEach.call(doc.querySelectorAll(DETS), function (d) {
                var k = detKey(d);
                if (Object.prototype.hasOwnProperty.call(dets, k)) d.open = dets[k];
            });
        }
        if (rTop && (rPop = doc.querySelector('.rpop .seg'))) rPop.scrollTop = rTop;
        if (rAt && rAt.v !== undefined) pickFocus(rAt.v);
        if (rAt && rAt.q !== undefined) {
            var rq = doc.querySelector('.rpop [data-pickq]');
            if (rq) { rq.focus(); try { rq.setSelectionRange(rAt.q, rAt.q); } catch (err) { /* not a text box */ } }
        }
        if (Object.keys(scrolled).length) {
            [].forEach.call(doc.querySelectorAll(STRIPS), function (el) { if (scrolled[stripKey(el)]) el.scrollLeft = scrolled[stripKey(el)]; });
        }
        if (fkAt !== null) { var fkEl = doc.querySelector('.fpanel [data-fk="' + cssKey(fkAt) + '"]'); if (fkEl) fkEl.focus(); }
        if (route.view === 'list') drawList();
        // A redraw (the 3 s re-read too) replaces the chart under a live hover:
        // on 近 30 天 the hover is put back from the new bars, anywhere else it goes.
        if (chartHover && route.view === 'days') chartRestore();
        else if (chartHover) chartHide();
        else if (route.view === 'days') chartFocus(chartPin);
        if (route.view === 'days') legendArm();
        drawFloat();
        drawNav();
        drawSide();
        doc.getElementById('gen').textContent = genText();
        focusTodo();
    }
    // The bar: whole on the first draw, then only `#navlinks`, so the jump
    // box keeps its text and caret through the 3 s redraw.
    var navDrawn = false;
    function drawNav() {
        var c = navCounts(homeRows());
        if (navDrawn) doc.getElementById('navlinks').innerHTML = navLinksHtml(route.view, c);
        else { doc.getElementById('nav').innerHTML = navHtml(route.view, c); navDrawn = true; }
        drawTheme();
    }
    // The masthead's theme button: drawn with the bar, and again on its own
    // press. A redraw under the focused button keeps the focus.
    function drawTheme() {
        var box = doc.getElementById('appear');
        if (!box) return;
        var a = doc.activeElement && doc.activeElement.getAttribute ? doc.activeElement : null;
        var had = Boolean(a && a.hasAttribute('data-themecycle'));
        box.innerHTML = themeBtnHtml(stored('station.theme'));
        var back = had && box.querySelector ? box.querySelector('[data-themecycle]') : null;
        if (back) back.focus();
    }
    doc.addEventListener('click', function (e) {
        var n = e.target && e.target.closest ? e.target.closest('[data-jump]') : null;
        var to = n ? doc.getElementById(n.getAttribute('data-jump')) : null;
        if (!to) return;
        if (e.preventDefault) e.preventDefault();
        if (to.scrollIntoView) to.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
    doc.addEventListener('click', function (e) {
        var n = e.target.closest ? e.target.closest('[data-themecycle]') : null;
        if (!n) return;
        var t = n.getAttribute('data-themecycle');
        store('station.theme', t === 'system' ? null : t);
        themeSet(t);
        drawTheme();
    });
    // The jump box: typing lists matches, ↑ ↓ move the mark, Enter opens the
    // marked one, Esc clears; Ctrl K (⌘ K) from anywhere puts the caret in it.
    var jumpOn = 0, jumpList = [];
    function jumpName(s) { return s.project || shortLabel(NAMES[s.pkey] || s.pkey); }
    function jumpDraw() {
        var q = doc.getElementById('jq'), pop = doc.getElementById('jpop');
        if (!q || !pop) return;
        jumpList = jumpHits(S.sessions, q.value, jumpName, 8);
        jumpOn = Math.min(jumpOn, Math.max(jumpList.length - 1, 0));
        var open = Boolean(String(q.value || '').trim());
        pop.innerHTML = open ? jumpListHtml(jumpList, q.value, jumpOn, Boolean(S.serve), jumpName) : '';
        pop.hidden = !open;
        q.setAttribute('aria-expanded', String(open));
    }
    doc.addEventListener('input', function (e) {
        if (!e.target || e.target.id !== 'jq') return;
        jumpOn = 0;
        jumpDraw();
    });
    doc.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'k') {
            var q = doc.getElementById('jq');
            if (!q || !q.focus) return;
            e.preventDefault();
            q.focus();
            if (q.select) q.select();
            return;
        }
        if (!e.target || e.target.id !== 'jq') return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            var n = Math.max(jumpList.length, 1);
            jumpOn = (jumpOn + (e.key === 'ArrowDown' ? 1 : n - 1)) % n;
            jumpDraw();
        } else if (e.key === 'Enter' && jumpList[jumpOn]) {
            e.preventDefault();
            w.location.href = focusHref(jumpList[jumpOn].id, jumpList[jumpOn].stage, Boolean(S.serve));
        } else if (e.key === 'Escape') {
            e.target.value = '';
            jumpDraw();
        }
    });
    doc.addEventListener('click', function (e) {
        var pop = e.target && e.target.closest && !e.target.closest('.jump') ? doc.getElementById('jpop') : null;
        if (pop) pop.hidden = true;
    });
    if (typeof module !== 'undefined' && module.exports) {
        module.exports.jumpHits = jumpHits; module.exports.jumpListHtml = jumpListHtml; module.exports.navLinksHtml = navLinksHtml;
    }
    // 概覽's stage mark. Set from the bar, the table, the timeline or 派工's
    // chips; a second press on the same stage clears it. Keyed to the session
    // so another session's page opens unmarked.
    view.hi = null;
    view.hiId = null;
    function hiToggle(el) {
        var k = el.getAttribute('data-hist'), id = route.id, again = view.hiId === id && view.hi === k;
        view.hi = again ? null : k;
        view.hiId = id;
        var keep = doc.activeElement === el && el.tagName !== 'rect' ? '.' + el.getAttribute('class').split(' ')[0] : null;
        draw();
        var back = keep ? doc.querySelector(keep + '[data-hist="' + cssKey(k) + '"]') : null;
        if (back) back.focus();
    }
    doc.addEventListener('click', function (e) {
        var h = route.view === 'session' && e.target.closest ? e.target.closest('[data-hist]') : null;
        if (h) hiToggle(h);
    });
    doc.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        var h = route.view === 'session' && e.target.closest ? e.target.closest('tr[data-hist]') : null;
        if (!h) return;
        e.preventDefault();
        hiToggle(h);
    });
    // Back, forward and every link on the page arrive here.
    w.addEventListener('hashchange', function () {
        sel = null;
        focusFor = w.location.hash;
        draw();
        if (focusFor !== null) w.scrollTo(0, 0);
    });
    // The 繁中 / EN switch: registered ahead of the click handler below so a
    // harness that keeps only one listener per event type (this file's own
    // node tests among them) still runs the handler those tests exercise.
    doc.addEventListener('click', function (e) {
        var b = e.target && e.target.closest ? e.target.closest('[data-lang]') : null;
        if (!b || !I18N) return;
        var lang = b.getAttribute('data-lang');
        if (!I18N.set(lang)) return;
        // Served, the pick is also the machine profile's ui.lang, which the
        // Pane and the band read and which pick() puts ahead of this browser's
        // choice; the reload waits for the write. A page not served has no
        // server to write to.
        if (!S.serve || typeof fetch !== 'function') { w.location.reload(); return; }
        var form = new URLSearchParams();
        form.set('nonce', S.nonce || '');
        form.set('scope', 'machine');
        form.set('key', 'ui.lang');
        form.set('value', lang);
        // A failed write is not followed by a reload: pick() would read the
        // old machine ui.lang back and the page would show it with no word.
        var failed = function () {
            var n = doc.getElementById('langnote');
            if (!n) {
                n = doc.createElement('div');
                n.id = 'langnote';
                n.setAttribute('role', 'status');
                n.setAttribute('aria-live', 'polite');
                n.className = 'dead';
                (doc.body || doc.documentElement).appendChild(n);
            }
            n.textContent = loc('cmp.langWriteFailed', '語言沒有存成功，沒有切換。');
        };
        fetch('profile', { method: 'POST', body: form }).then(function (res) {
            if (res && res.ok) w.location.reload(); else failed();
        }, failed);
    });
    // The language menu (r-0036): the globe button opens and shuts #langpop;
    // a click anywhere else, or Escape, shuts it. Picking a language is the
    // [data-lang] listener above.
    function langMenu(open) {
        var b = doc.getElementById('langbtn'), pop = doc.getElementById('langpop');
        if (!b || !pop || !b.setAttribute) return;
        b.setAttribute('aria-expanded', String(open));
        pop.hidden = !open;
    }
    doc.addEventListener('click', function (e) {
        var t = e && e.target && e.target.closest ? e.target : null;
        if (t && t.closest('[data-langmenu]')) {
            var b = doc.getElementById('langbtn');
            langMenu(!(b && b.getAttribute && b.getAttribute('aria-expanded') === 'true'));
        } else if (!(t && t.closest('#langpop'))) langMenu(false);
    });
    doc.addEventListener('keydown', function (e) {
        if (e && e.key === 'Escape') langMenu(false);
    });
    doc.addEventListener('click', function (e) {
        // 篩選: the button opens and shuts the panel, a checkbox is one key,
        // 全選/全不選 are every key; a click anywhere else shuts it.
        if (route.view === 'days' && e.target.closest) {
            if (e.target.closest('[data-fbtn]')) { chartPanel = !chartPanel; draw(); var fb = doc.querySelector('[data-fbtn]'); if (fb) fb.focus(); return; }
            var fk = e.target.closest('.fpanel [data-fk]');
            if (fk) { chartSet([fk.getAttribute('data-fk')], fk.checked, '.fpanel [data-fk="' + cssKey(fk.getAttribute('data-fk')) + '"]'); return; }
            var fa = e.target.closest('.fpanel [data-fall]');
            if (fa) { chartSet(chartBars.keys, fa.getAttribute('data-fall') === 'on', '.fpanel [data-fall="' + fa.getAttribute('data-fall') + '"]'); return; }
            if (chartPanel && !e.target.closest('.fwrap')) { chartPanel = false; draw(); }
        }
        var lg = route.view === 'days' && e.target.closest ? e.target.closest('.legend [data-key], .legend [data-rest]') : null;
        if (lg) { legendToggle(lg); return; }
        if (e.target.closest('[data-fkb]')) {
            // Opening the panel counts as reading what it shows: the draw lights
            // the unread, the marking after it greys them for the next draw; a
            // close marks what arrived while it was open. Neither redraws.
            var wasOpen = view.fkOpen;
            view.fkOpen = !wasOpen;
            if (view.fkOpen) delete view.pg['fk:shut'];
            if (wasOpen) view.notes = readAll(view.notes);
            drawFloat(true);
            if (!wasOpen) view.notes = readAll(view.notes);
            return;
        }
        var nx = e.target.closest('[data-note-x]');
        if (nx) {
            var gone = dismissNote(view.notes, view.gone, nx.closest('.nt').getAttribute('data-note'));
            view.notes = gone.notes;
            view.gone = gone.gone;
            goneSave();
            drawFloat(true);
            return;
        }
        if (e.target.closest('[data-note-clear]')) {
            var cleared = clearNotes(S.sessions, view.notes, view.gone);
            view.notes = cleared.notes;
            view.gone = cleared.gone;
            goneSave();
            drawFloat(true);
            return;
        }
        if (e.target.closest('[data-fkx]') || e.target.id === 'fk') {
            fkClose();
            return;
        }
        var gmic = e.target.closest('#fk [data-mic]');
        if (gmic) {
            if (fkRec) { fkRec.stop(); return; }
            var gbox = doc.getElementById(gmic.getAttribute('data-mic'));
            var gsay = gmic.closest('.gfree').querySelector('.gsay');
            fkRec = fkListen(gmic, gbox, function (text, on) { if (gsay) { gsay.textContent = text; gsay.className = 'gsay' + (on ? ' on' : ''); } });
            return;
        }
        var gfs = e.target.closest('#fk [data-gfs]');
        if (gfs) {
            var gtext = gfs.closest('.gfree').querySelector('[data-gfree]').value.trim();
            if (!gtext) return;
            gatePost(gfs.closest('.gc'), function (form, who) {
                var q = who.pending.questions[0], a = {};
                a[q.question] = gtext;
                form.set('answers', JSON.stringify(a));
            }, loc('cmp.sentColon', '已送出：'));
            return;
        }
        var gop = e.target.closest('[data-gop]');
        if (gop) {
            gatePost(gop.closest('.gc'), function (form, who) {
                var q = who.pending.questions[0], o = q.options[Number(gop.getAttribute('data-gop'))], a = {};
                a[q.question] = o.label;
                form.set('answers', JSON.stringify(a));
            }, loc('cmp.sentColon', '已送出：'));
            return;
        }
        if (e.target.closest('[data-gho]')) {
            gatePost(e.target.closest('.gc'), function (form) { form.set('handoff', 'terminal'); }, loc('cmp.handedToTerminalColon', '已交給終端：'));
            return;
        }
        if (e.target.closest('[data-tune-notify]') && w.Notification) {
            w.Notification.requestPermission().then(function () { draw(); });
            return;
        }
        // 懸著的 gate: a tick is remembered across the poll's re-read, the
        // count and the button follow it, and 送出答案 posts every answer.
        var pgi = e.target.closest('.pg input[name^="pg-"]');
        if (pgi) {
            var pgb = pgi.closest('.pg');
            pgSync(pgb);
            return;
        }
        var ans = e.target.closest('[data-answer]');
        if (ans) {
            var pg = ans.closest('.pg'), pgr = pg.querySelector('.pgr');
            var who = S.sessions.filter(function (x) { return x.id === pg.getAttribute('data-pg-id'); })[0];
            var read = pgRead(pg, (who && who.pending && who.pending.questions) || []);
            if (read.missing) { pgr.className = 'pgr bad'; pgr.textContent = loc('cmp.stillNQuestionsUnanswered', '還有 {n} 題沒答', { n: read.missing }); return; }
            var answers = read.answers;
            var form = new URLSearchParams();
            form.set('nonce', S.nonce || '');
            form.set('root', pg.getAttribute('data-pg-root'));
            form.set('id', pg.getAttribute('data-pg-id'));
            form.set('answers', JSON.stringify(answers));
            answerPost(pg.getAttribute('data-pg-id'), pg, pgr, 'pgr', form, loc('cmp.sentColon', '已送出：'), loc('cmp.couldNotSendServeRunning', '送不出去：serve 還在跑嗎？'));
            return;
        }
        // 記成 TODO: the server checks the line and answers with the rule it
        // failed, or with the line it wrote.
        var todo = e.target.closest('[data-todo]');
        if (todo) {
            var box = todo.closest('.tdf');
            var said = box.querySelector('.tdr');
            var body = new URLSearchParams();
            body.set('nonce', S.nonce || '');
            body.set('root', box.getAttribute('data-todo-root'));
            body.set('id', box.getAttribute('data-todo-id'));
            body.set('text', box.querySelector('textarea').value);
            body.set('link', box.querySelector('input').value);
            body.set('body', box.querySelector('textarea.tdbd').value);
            fetch('todo', { method: 'POST', body: body }).then(function (r) {
                return r.text().then(function (t) {
                    said.className = 'tdr ' + (r.ok ? 'ok' : 'bad');
                    said.textContent = (r.ok ? loc('cmp.writtenToTodoColon', '記下了：') : r.status + loc('cmp.dashNotWrittenColon', ' — 沒有寫進去：')) + t.trim();
                });
            }, function () {
                said.className = 'tdr bad';
                said.textContent = loc('cmp.couldNotSendServeRunning', '送不出去：serve 還在跑嗎？');
            });
            return;
        }
        // A workflow phase opens into its agents, an agent into its prompt and
        // steps, a prompt in full. Each is remembered, so a re-read keeps it.
        var ph = e.target.closest('[data-ph]');
        if (ph) { view.ph[ph.getAttribute('data-ph')] = ph.getAttribute('aria-expanded') !== 'true'; repaint(); return; }
        var ag = e.target.closest('[data-ag]');
        if (ag) { view.open[ag.getAttribute('data-ag')] = ag.getAttribute('aria-expanded') !== 'true'; repaint(); return; }
        var pm = e.target.closest('[data-prm]');
        if (pm) { view.prm[pm.getAttribute('data-prm')] = pm.getAttribute('aria-expanded') !== 'true'; repaint(); return; }
        // The replay's strip and contents jump to a segment or a row, opening
        // the segment it sits in; 全部展開 opens every folded step, or shuts
        // them all when none is shut.
        var rs = e.target.closest('[data-rs]');
        if (rs) {
            var to = doc.getElementById(rs.getAttribute('data-rs'));
            if (!to) return;
            var seg = to.closest('details.rpseg');
            if (seg) seg.open = true;
            to.scrollIntoView({ block: 'start' });
            return;
        }
        if (e.target.closest('[data-xall]')) {
            var folds = doc.querySelectorAll('.rpw details.tc, .rpw details.stw');
            var shut = [].some.call(folds, function (d) { return !d.open; });
            [].forEach.call(folds, function (d) { d.open = shut; });
            return;
        }
        // A replay kind is hidden or shown again.
        var rk = e.target.closest('[data-rk]');
        if (rk) {
            var on = rk.getAttribute('aria-pressed') !== 'true';
            rk.setAttribute('aria-pressed', String(on));
            view.kinds[rk.getAttribute('data-rk')] = !on;
            [].forEach.call(doc.querySelectorAll('.rp > li[data-kind="' + rk.getAttribute('data-rk') + '"]'), function (li) { li.hidden = !on; });
            return;
        }
        // A backtrack opens the replay on the rows between entering the stage
        // it left and the step back — what that stage saw before it sent the
        // work back.
        var jump = e.target.closest('[data-goto]');
        if (jump) {
            var from = Number(jump.getAttribute('data-goto')), until = Number(jump.getAttribute('data-until'));
            var rp = doc.getElementById('s-rp');
            if (!rp) return;
            rp.open = true;
            var first = null;
            [].forEach.call(rp.querySelectorAll('.rp > li[data-t]'), function (li) {
                var t = Number(li.getAttribute('data-t'));
                var hit = li.getAttribute('data-t') !== '' && t >= from && t <= until;
                li.classList.toggle('hl', hit);
                if (hit && !first) first = li;
            });
            if (first) { var inSeg = first.closest('details.rpseg'); if (inSeg) inSeg.open = true; first.scrollIntoView({ block: 'center' }); }
            return;
        }
        if (e.target.closest('[data-cmpclear]')) {
            picked = [];
            if (route.view === 'project') { draw(); return; }
            selbarDraw();
            drawList();
            drawSide();
            return;
        }
        var cb = e.target.closest('input[data-cmp]');
        if (cb) {
            var id = cb.getAttribute('data-cmp');
            picked = picked.filter(function (x) { return x !== id; });
            if (cb.checked) picked.push(id);
            if (picked.length > 2) picked.shift();
            if (route.view === 'project') { draw(); return; }
            selbarDraw();
            drawList();
            drawSide();
            return;
        }
        var sg = e.target.closest('[data-seg] button');
        if (sg) { view[sg.parentNode.getAttribute('data-seg')] = sg.getAttribute('data-v'); draw(); return; }
        // 清單's facet triggers: one opens its popover (and shuts any other),
        // its × puts the facet back to 全部, and a click outside the open one
        // shuts it and still does whatever it was aimed at.
        if (route.view === 'list') {
            var pk = e.target.closest('[data-pick]');
            if (pk) {
                var pkKey = pk.getAttribute('data-pick');
                pickOpen = pickOpen === pkKey ? null : pkKey;
                pickLast = pkKey;
                pickQ = '';
                draw();
                pickFocus(pickOpen ? 'first' : 'btn');
                return;
            }
            var pc = e.target.closest('[data-pickclr]');
            if (pc) { pickLast = pc.getAttribute('data-pickclr'); f[pickLast] = ''; pickOpen = null; draw(); pickFocus('btn'); return; }
            if (pickOpen && !e.target.closest('.rpop')) { pickOpen = null; draw(); }
        }
        var fc = e.target.closest('[data-facet] button');
        if (fc) {
            var fcKey = fc.parentNode.getAttribute('data-facet');
            f[fcKey] = fc.getAttribute('data-v');
            // A pick in a popover shuts it and hands focus back to its trigger.
            if (pickOpen) { pickOpen = null; draw(); pickFocus('btn'); return; }
            draw();
            return;
        }
        var wfRow = e.target.closest('[data-wf]');
        if (wfRow) { view.closed[wfRow.getAttribute('data-wf')] = !view.closed[wfRow.getAttribute('data-wf')]; draw(); return; }
        var go = e.target.closest('[data-href]');
        if (go && !e.target.closest('a,button,input')) { w.location.hash = go.getAttribute('data-href'); return; }
        var th = e.target.closest('th[data-k]');
        if (th) {
            var k = th.getAttribute('data-k');
            if (k === sortKey) sortDir = -sortDir;
            else { sortKey = k; sortDir = k === 'task' ? 1 : -1; }
            drawList();
            return;
        }
        var tr = e.target.closest('tr[data-id]');
        if (tr && route.view === 'list') {
            sel = tr.getAttribute('data-id');
            [].forEach.call(doc.querySelectorAll('#lb tr'), function (x) {
                x.setAttribute('aria-selected', x.getAttribute('data-id') === sel);
            });
            drawDetail();
        }
    });
    // The selection bar redrawn in place — the same element, so it slides
    // rather than reappears, and the table under it keeps its scroll.
    function selbarDraw() {
        var sb = doc.getElementById('selbar');
        if (!sb) return;
        sb.innerHTML = selbarInner();
        if (picked.length) { sb.setAttribute('data-on', ''); sb.removeAttribute('aria-hidden'); }
        else { sb.removeAttribute('data-on'); sb.setAttribute('aria-hidden', 'true'); }
    }
    // Put focus on the last-opened facet trigger (`btn`), the popover's first way in
    // (`first`: the search box, or else the picked row), or a row by value.
    function pickFocus(what) {
        var el = what === 'btn' ? doc.querySelector('[data-pick="' + pickLast + '"]')
            : what === 'first' ? doc.querySelector('.rpop [data-pickq]') || doc.querySelector('.rpop [aria-pressed="true"]') || doc.querySelector('.rpop [data-v]')
            : [].filter.call(doc.querySelectorAll('.rpop [data-v]'), function (x) { return x.getAttribute('data-v') === what; })[0];
        if (el) el.focus();
    }
    // Typing in the popover's search box hides the rows that do not match,
    // in place, so the box keeps its caret; `pickQ` carries it into a redraw.
    doc.addEventListener('input', function (e) {
        if (!e.target.hasAttribute || !e.target.hasAttribute('data-pickq')) return;
        pickQ = e.target.value;
        var q = pickQ.toLowerCase();
        [].forEach.call(doc.querySelectorAll('.rpop [data-v]'), function (el) {
            el.hidden = !!q && el.textContent.concat(' ', el.title || '').toLowerCase().indexOf(q) < 0;
        });
    });
    doc.getElementById('q').addEventListener('input', function (e) {
        f.q = e.target.value;
        draw();
    });
    // ---- the header search: results grouped under the box ------------------
    // The box still filters every page through `f.q`, as it always has; 200 ms
    // after the typing stops it also opens a popover grouping what matches:
    // sessions by `match()` itself (so its count is the 清單 page's count),
    // projects by name or path, and the doc paths the map cards carry. A map
    // card holds no titles and no page text, only the paths it lists (還沒建,
    // 沒宣告狀態) and the filing buckets, so those are all 文件 can match.
    var qBox = doc.getElementById('q'), qPop = null, qTimer = null, qAt = -1;
    function qMark(text, q) {
        var s = String(text === null || text === undefined ? '' : text), i = q ? s.toLowerCase().indexOf(q.toLowerCase()) : -1;
        return i < 0 ? esc(s) : esc(s.slice(0, i)) + '<mark>' + esc(s.slice(i, i + q.length)) + '</mark>' + esc(s.slice(i + q.length));
    }
    function qHas(v, q) { return v !== null && v !== undefined && String(v).toLowerCase().indexOf(q.toLowerCase()) >= 0; }
    function qGroups(q) {
        var sess = S.sessions.filter(function (s) { return match(s, { q: q, state: '', project: '', stage: '' }); })
            .sort(function (a, b) { return (b.state === 'live') - (a.state === 'live') || (b.updated || 0) - (a.updated || 0); });
        var seen = {}, proj = [], docs = [];
        S.sessions.forEach(function (s) {
            if (seen[s.pkey]) return;
            seen[s.pkey] = true;
            if (qHas(NAMES[s.pkey], q) || qHas(s.pkey, q)) proj.push(s.pkey);
        });
        S.projects.forEach(function (p) {
            (p.docs || []).forEach(function (d) {
                var add = function (path, kind) { if (qHas(path, q)) docs.push({ pkey: d.pkey, path: path, kind: kind }); };
                (d.plannedNotBuilt || []).forEach(function (x) { add(x, loc('q.notBuiltYet', '還沒建')); });
                ((d.undeclared && d.undeclared.paths) || []).forEach(function (x) { add(x, loc('q.noStatusDeclared', '沒宣告狀態')); });
                ((d.filing && d.filing.rows) || []).forEach(function (r) { add(r.bucket, r.role); });
            });
        });
        var pname = function (pkey) { return shortLabel(NAMES[pkey] || pkey); };
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
    function qClose() {
        if (qTimer) { w.clearTimeout(qTimer); qTimer = null; }
        if (qPop) qPop.hidden = true;
        qAt = -1;
        qBox.setAttribute('aria-expanded', 'false');
        qBox.removeAttribute('aria-activedescendant');
    }
    function qDraw() {
        var q = qBox.value.trim(), i = 0;
        if (!q) { qClose(); return; }
        if (!qPop) {
            qPop = doc.createElement('div');
            qPop.id = 'qpop';
            qPop.className = 'qpop';
            // A press inside keeps the caret in the box; the click still lands.
            qPop.addEventListener('mousedown', function (e) { e.preventDefault(); });
            qPop.addEventListener('click', function (e) { if (e.target.closest('[data-qi]')) qClose(); });
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
        qAt = -1;
        qBox.setAttribute('aria-expanded', 'true');
        qBox.removeAttribute('aria-activedescendant');
    }
    function qMove(to) {
        var all = qPop ? qPop.querySelectorAll('[data-qi]') : [];
        if (!all.length) return;
        qAt = (to + all.length) % all.length;
        [].forEach.call(all, function (el, k) { el.setAttribute('aria-selected', String(k === qAt)); });
        all[qAt].scrollIntoView({ block: 'nearest' });
        qBox.setAttribute('aria-activedescendant', all[qAt].id);
    }
    // Guarded: tests/station-view.test.js hands in a stub box with no attributes.
    if (qBox.setAttribute) {
        qBox.setAttribute('role', 'combobox');
        qBox.setAttribute('aria-autocomplete', 'list');
        qBox.setAttribute('aria-controls', 'qpop');
        qBox.setAttribute('aria-expanded', 'false');
    }
    qBox.addEventListener('input', function () {
        if (qTimer) w.clearTimeout(qTimer);
        qTimer = w.setTimeout(function () { qTimer = null; qDraw(); }, 200);
    });
    qBox.addEventListener('focus', function () { if (qBox.value.trim()) qDraw(); });
    qBox.addEventListener('blur', qClose);
    qBox.addEventListener('keydown', function (e) {
        var open = qPop && !qPop.hidden;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            if (!open) qDraw();
            e.preventDefault();
            qMove(e.key === 'ArrowDown' ? qAt + 1 : qAt < 0 ? -1 : qAt - 1);
            return;
        }
        // Enter on nothing picked keeps what the box did before: the filter
        // stays on the page underneath, the popover gets out of its way.
        if (e.key === 'Enter' && open) {
            e.preventDefault();
            var pick = qAt >= 0 ? qPop.querySelectorAll('[data-qi]')[qAt] : null;
            qClose();
            if (pick) w.location.hash = pick.getAttribute('href');
            return;
        }
        if (e.key === 'Escape' && open) qClose();
    });
    w.addEventListener('hashchange', qClose);
    // Every legend entry is a toggle: armed here rather than in legendHtml so
    // the entry markup the tests read stays what it was.
    function legendArm() {
        [].forEach.call(doc.querySelectorAll('.legend [data-key], .legend [data-rest]'), function (el) {
            var off = el.hasAttribute('data-off');
            el.setAttribute('role', 'button');
            el.setAttribute('tabindex', '0');
            el.setAttribute('aria-pressed', off ? 'false' : 'true');
            if (!el.title) el.title = off ? loc('q.clickToPutBack', '按一下放回圖表') : loc('q.clickToRemoveFirst', '按一下先從圖表拿掉');
        });
    }
    // Set some keys off (`on` false) or back on, redraw, and put focus back on
    // whatever `sel` finds in the new DOM — the redraw lost the old element.
    function chartSet(keys, on, sel) {
        var off = chartOff[view.dim] || (chartOff[view.dim] = {});
        keys.forEach(function (k) { if (on) delete off[k]; else off[k] = true; });
        chartHover = false;
        chartAt = null;
        chartTipEl().removeAttribute('data-on');
        draw();
        var back = sel && doc.querySelector(sel);
        if (back) back.focus();
    }
    function cssKey(k) { return String(k).replace(/["\\]/g, '\\$&'); }
    // A legend entry takes its key out or puts it back; 其他 N 個 does all its
    // members at once — the shown ones out, or, dimmed, its hidden ones back.
    function legendToggle(el) {
        if (el.hasAttribute('data-rest')) {
            var back = el.hasAttribute('data-off'), off = chartOpts.off || {};
            chartSet(back ? legendRest(chartBars, { dim: chartOpts.dim, pkeys: chartOpts.pkeys }).filter(function (k) { return off[k]; })
                : legendRest(chartBars, chartOpts), back, '.legend [data-rest]');
            return;
        }
        var k = el.getAttribute('data-key');
        chartSet([k], el.hasAttribute('data-off'), '.legend [data-key="' + cssKey(k) + '"]');
    }
    function panelShut(focusBtn) {
        chartPanel = false;
        draw();
        if (focusBtn) { var b = doc.querySelector('[data-fbtn]'); if (b) b.focus(); }
    }
    doc.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && chartPanel && route.view === 'days') { e.preventDefault(); panelShut(true); return; }
        // An open facet popover: Esc shuts it, the arrows walk the rows shown
        // (from the search box too), Enter in the search box takes the first.
        if (pickOpen && route.view === 'list' && e.target.closest && e.target.closest('.rpop, .rwrap')) {
            var ropts = [].filter.call(doc.querySelectorAll('.rpop [data-v]'), function (el) { return !el.hidden; });
            var ri = ropts.indexOf(e.target);
            if (e.key === 'Escape') { e.preventDefault(); pickOpen = null; draw(); pickFocus('btn'); return; }
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                var rn = e.key === 'ArrowDown' ? Math.min(ri + 1, ropts.length - 1) : ri <= 0 ? -1 : ri - 1;
                var rto = rn < 0 ? doc.querySelector('.rpop [data-pickq]') || ropts[0] : ropts[rn];
                if (rto) rto.focus();
                return;
            }
            if (e.key === 'Enter' && e.target.hasAttribute('data-pickq') && ropts[0]) { e.preventDefault(); ropts[0].click(); return; }
        }
        var lgk = route.view === 'days' && e.target.closest ? e.target.closest('.legend [data-key], .legend [data-rest]') : null;
        if (lgk && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); legendToggle(lgk); return; }
        if (e.target.tagName === 'INPUT') { if (e.key === 'Escape') e.target.blur(); return; }
        if (e.key === '/') { e.preventDefault(); doc.getElementById('q').focus(); }
    });

    doc.getElementById('fkver').textContent = S.fankeel ? 'fankeel ' + S.fankeel : '';
    doc.getElementById('nreg').textContent = loc('q.nRegistryDot', '{n} 個 registry · ', { n: S.projects.length })
        + S.sessions.length + ' sessions';
    doc.getElementById('cfg').textContent = String(S.configDir || '').replace(/^.*[\\/]/, '')
        || S.configDir;
    doc.getElementById('cfg').title = S.configDir || '';

    // ---- language: the masthead and the switch -----------------------------
    // The shell's own words are Chinese on disk (assets/station/index.html);
    // they are set once here, before the first draw. The switch stores the
    // choice and reloads, so the left bar's labels and every other table built
    // at load are built again in the new language.
    // The serve state in the masthead is this plug and a dot; the words are
    // only in `title` and `aria-label`.
    var SERVE_ICON = '<svg class="ico" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor"'
        + ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/>'
        + '<path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/></svg>';
    function serveIconHtml(up) {
        var words = up ? loc('mast.serveUp', 'serve 連線中') : loc('mast.serveDown', 'serve 已停');
        return '<span class="pill ' + (up ? 'live srv up" id="serveup"' : 'down srv" id="servedown"') + ' role="status" aria-label="' + esc(words)
            + '" title="' + esc(words) + '">' + SERVE_ICON + '<i class="dot ' + (up ? 'live' : 'down') + '" aria-hidden="true"></i></span>';
    }
    if (typeof module !== 'undefined' && module.exports) module.exports.serveIconHtml = serveIconHtml;
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
    applyChrome();
    // The film's click ring: a keel ring opens out from a pressed action button.
    doc.addEventListener('pointerdown', function (e) {
        var b = e.target && e.target.closest ? e.target.closest('.btn.go, .td-mb') : null;
        if (!b || !b.classList) return;
        b.classList.remove('rip');
        void b.offsetWidth;
        b.classList.add('rip');
    });
    doc.addEventListener('animationend', function (e) {
        if (e.animationName === 'kring' && e.target && e.target.classList) e.target.classList.remove('rip');
    });

    // ---- live refresh --------------------------------------------------------
    // Served, the page keeps itself current: every three seconds it re-reads the
    // list and — while the session whose detail is on screen is live — that
    // session's detail, both asked for in the same tick, each through a script
    // tag the way it loaded them the first time, with a query string that only
    // keeps the browser from answering out of its cache. A session no longer
    // live has its detail re-read no more: nothing under it can move. A hidden
    // tab re-reads nothing, unless a tune request is open, and re-reads at once
    // when it is shown again. The file
    // `/fankeel` writes has no server to ask and keeps the moment it was written,
    // so `S.serve` gates all of this as well as the protocol. Armed before the
    // health poll, which stays the last interval this file sets.
    var POLL_MS = 3000;
    var busy = false;
    // Everything worked out from `S`: at load, above, and again on every
    // re-read below — one derivation rather than two that could drift apart.
    // `serialize()` never emits a `label` field — the shortest-unique-tail
    // rule lives only here, in `labels()`, since `navLabels` was deleted from
    // `lib/station.js` on purpose so the rule would not exist in two places —
    // and `match()`'s haystack still reads `s.label`, so it is reattached on
    // every call rather than once.
    function freshen() {
        NOW = Date.parse(S.generatedAt);
        LAB = labels(S.projects.map(function (p) { return p.root; }));
        S.sessions.forEach(function (s) { s.label = LAB[s.root]; });
        DAYS = lastDays(NOW, 30);
        PREV = lastDays(NOW - 30 * 864e5, 30);
        TODAY = DAYS[DAYS.length - 1];
        NAMES = projectNames(S.sessions);
        PKEYS = projectRows(S.sessions, DAYS).map(function (r) { return r.pkey; });
    }
    // A few seconds — well under anything a healthy local server needs — past
    // which a script that neither loaded nor errored (a hung server, a stuck
    // connection) is given up on: the tag is dropped and `done(false)` runs,
    // so `busy` always clears and the next tick tries again rather than going
    // silent forever. `settled` keeps a late `onload` after that point from
    // running `done` a second time. 4000 is a literal, not a `var`: the focus
    // page calls this before any `var` down here is assigned.
    function reload(src, done) {
        var el = doc.createElement('script');
        var settled = false;
        var timer = w.setTimeout(function () {
            if (settled) return;
            settled = true;
            if (el.parentNode) el.parentNode.removeChild(el);
            done(false);
        }, 4000);
        var finish = function (ok) {
            if (settled) return;
            settled = true;
            w.clearTimeout(timer);
            if (el.parentNode) el.parentNode.removeChild(el);
            done(ok);
        };
        el.onload = function () { finish(true); };
        el.onerror = function () { finish(false); };
        el.src = src + (src.indexOf('?') < 0 ? '?' : '&') + 't=' + Date.now();
        doc.head.appendChild(el);
    }
    // The answers the form holds right now, read off the DOM with `pgAnswers`,
    // and the same read written back into `view.pg` so a redraw keeps them.
    function pgRead(pgb, questions) {
        var id = pgb.getAttribute('data-pg-id'), picks = {}, others = {};
        questions.forEach(function (q, i) {
            picks[i] = [].map.call(pgb.querySelectorAll('input[name="pg-' + i + '"]:checked'), function (el) { return el.value; });
            var t = pgb.querySelector('[data-pg-other="' + i + '"]');
            others[i] = t ? t.value : '';
            view.pg[id + ':' + i] = picks[i];
            view.pg[id + ':' + i + ':other'] = others[i];
        });
        return pgAnswers(questions, picks, others);
    }
    function pgSync(pgb) {
        var who = S.sessions.filter(function (x) { return x.id === pgb.getAttribute('data-pg-id'); })[0];
        var qs = (who && who.pending && who.pending.questions) || [];
        var got = pgRead(pgb, qs), btn = pgb.querySelector('[data-answer]'), cnt = pgb.querySelector('.pgn');
        var sent = view.pg[pgb.getAttribute('data-pg-id') + ':send'];
        var sending = sent && who && who.pending && sent.gate === who.pending.until && (sent.busy || sent.cls === 'ok');
        if (btn) btn.disabled = got.missing > 0 || !!sending;
        if (cnt) cnt.textContent = (qs.length - got.missing) + ' / ' + qs.length;
    }
    // One POST /answer that says it is on its way. Every button in `box` is
    // disabled and `line` reads 送出中… until the reply. A reply ok leaves
    // them disabled; a refusal, a network error or no reply in SEND_MS gives
    // them back — the server's own gate waits 60 seconds (`gate.station`),
    // so 10 leaves room to press again. The state is kept in `view.pg` under
    // `<id>:send` first, because the poll's redraw replaces `box` and draws
    // from there (`gateCountdownHtml`, `pendingGateHtml`).
    var SEND_MS = 10000;
    function answerPost(id, box, line, cls, form, said, failed) {
        var btns = box.querySelectorAll ? [].slice.call(box.querySelectorAll('[data-gop],[data-gho],[data-answer],[data-gfs]')) : [];
        var who = S.sessions.filter(function (x) { return x.id === id; })[0], gate = who && who.pending ? who.pending.until : null;
        var ac = typeof AbortController === 'function' ? new AbortController() : null, over = false, timer;
        function show(busy, c, t) {
            view.pg[id + ':send'] = { busy: busy, cls: c, text: t, gate: gate };
            btns.forEach(function (b) { b.disabled = busy || c === 'ok'; });
            if (!line) return;
            line.className = cls + (c ? ' ' + c : '');
            line.textContent = t;
        }
        function give(c, t) {
            if (over) return;
            over = true;
            w.clearTimeout(timer);
            show(false, c, t);
        }
        show(true, 'wait', loc('poll.sending', '送出中…'));
        timer = w.setTimeout(function () {
            give('bad', loc('poll.notConfirmedRetry', '還沒確認送到：可以再按一次'));
            if (ac) ac.abort();
        }, SEND_MS);
        var init = { method: 'POST', body: form };
        if (ac) init.signal = ac.signal;
        fetch('answer', init).then(function (r) {
            return r.text().then(function (t) {
                give(r.ok ? 'ok' : 'bad', (r.ok ? said : r.status + ' — ') + t.trim());
            });
        }, function () { give('bad', failed + loc('poll.pressAgain', '可以再按一次')); });
    }
    // One POST /answer from the floating icon: an option, or the hand-off.
    function gatePost(gc, fill, said) {
        var id = gc.getAttribute('data-pg-id');
        var who = S.sessions.filter(function (x) { return x.id === id; })[0];
        if (!who || !who.pending) return;
        var form = new URLSearchParams();
        form.set('nonce', S.nonce || '');
        form.set('root', gc.getAttribute('data-pg-root'));
        form.set('id', id);
        fill(form, who);
        answerPost(id, gc, gc.querySelector('.gend'), 'gend', form, said, loc('poll.couldNotSendServeRunning', '送不出去：serve 還在跑嗎？'));
    }
    // The countdown moves every second between re-reads, on `tickNow`'s tick.
    function tickGates(now) {
        [].forEach.call(doc.querySelectorAll('#fk .gc[data-until]'), function (g) {
            var total = Number(g.getAttribute('data-total')) || 60;
            var left = Math.max(0, Math.min(total, Math.round((Number(g.getAttribute('data-until')) - now) / 1000)));
            var sec = g.querySelector('.gsec'), bar = g.querySelector('.gbar i');
            if (sec) sec.textContent = gateClock(left);
            if (bar) bar.style.width = (left / total * 100).toFixed(1) + '%';
        });
    }
    // 1–4 pick an option of the first held gate, the <kbd> on each button.
    doc.addEventListener('keydown', function (e) {
        if (!/^[1-4]$/.test(e.key) || e.altKey || e.ctrlKey || e.metaKey) return;
        var t = e.target;
        // A modal (the TODO quick look, the card library) owns the keys: the gate behind it is inert.
        if (doc.querySelector && doc.querySelector('dialog[open]')) return;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
        var b = doc.querySelector && doc.querySelector('#fk .gc [data-gop="' + (Number(e.key) - 1) + '"]');
        if (b) { e.preventDefault(); b.click(); }
    });
    // Typing in 其他 ticks its box, the way the mockup does, and re-counts.
    doc.addEventListener('input', function (e) {
        var t = e.target && e.target.closest ? e.target.closest('.pg [data-pg-other]') : null;
        if (!t) return;
        var box = t.closest('.o').querySelector('input[value="__other"]');
        if (box) box.checked = t.value.trim() !== '';
        pgSync(t.closest('.pg'));
    });
    // The session whose detail is on screen: the session page's, or the row
    // selected on 清單.
    function watched() {
        var id = route.view === 'session' ? route.id : route.view === 'list' ? sel : null;
        return id ? S.sessions.filter(function (x) { return x.id === id; })[0] || null : null;
    }
    // A settled tune request, kept as a note in the floating icon's panel
    // and — with the tab in the background and permission given — said as a
    // browser notification. The changed page reloads itself through tune's
    // own overlay.
    function tuneNotify(prev, next) {
        var evs = tuneEvents(prev, next);
        if (!evs.length) return;
        view.notes = evs.concat(view.notes).slice(0, 20);
        evs.forEach(function (ev) {
            if (doc.hidden && w.Notification && w.Notification.permission === 'granted') {
                try { new w.Notification(toastText(ev)); } catch (err) { /* the browser refused it */ }
            }
        });
        drawFloat();
    }
    function refresh() {
        if (busy || (doc.hidden && !tuneOpen(S.sessions))) return;
        busy = true;
        var before = S.sessions;
        // The detail on screen is asked for beside the list, not after it has
        // landed: two round trips in a row were most of a re-read's wait. Which
        // detail is read off the list as it stood; a session that went down in
        // between costs one read more, and the next tick asks for none.
        var on = doc.hidden || route.view === 'settings' || route.view === 'tour' ? null : watched();
        var left = on && on.state === 'live' && on.hasDetail ? 2 : 1;
        var fresh = false;
        var landed = function () {
            if (--left > 0) return;
            busy = false;
            if (!fresh || doc.hidden) return;
            // The settings wizard reads nothing live; a redraw there would only
            // throw away what the reader has open. The masthead still moves.
            if (route.view === 'settings' || route.view === 'tour') { drawFloat(); doc.getElementById('gen').textContent = genText(); return; }
            repaint();
        };
        reload('station/station-data.js', function (ok) {
            if (ok && w.STATION && w.STATION !== S) {
                // `cleared` rides on the one load `/clear-stale` redirected to, and
                // stays on the page rather than vanishing three seconds later.
                if (isFinite(S.cleared) && w.STATION.cleared === undefined) w.STATION.cleared = S.cleared;
                S = w.STATION;
                freshen();
                polledAt = Date.now();
                tuneNotify(before, S.sessions);
                fresh = true;
            }
            landed();
        });
        if (left === 2) reload('station/detail/' + encodeURIComponent(on.id) + '.js', landed);
    }
    // A redraw that keeps what the reader had: which sections were open, where
    // the list and the page were scrolled, and which control had focus, found
    // again by its `data-key`. A reader typing into a field on the page holds
    // the redraw back — it would throw the typing away — until the next re-read.
    function repaint() {
        var ae = doc.activeElement;
        var typing = ae && (ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT'
            || (ae.tagName === 'INPUT' && ae.id !== 'q' && !/^(checkbox|radio|button|submit)$/.test(ae.type || '')));
        if (typing) return;
        var key = ae && ae.getAttribute ? ae.getAttribute('data-key') : null;
        var box = doc.querySelectorAll('.listcard .scroll')[0];
        var boxTop = box ? box.scrollTop : 0;
        var y = w.scrollY || 0;
        draw();
        var again = doc.querySelectorAll('.listcard .scroll')[0];
        if (again) again.scrollTop = boxTop;
        if (typeof w.scrollTo === 'function') w.scrollTo(0, y);
        if (key) {
            var el = doc.querySelectorAll('[data-key="' + key + '"]')[0];
            if (el && el.focus) el.focus();
        }
    }
    // Once a second: every figure `tk()` marked, read through `tk()` itself
    // (`live: false` so it hands back the bare text rather than a span to
    // nest inside the one already on the page) rather than a second copy of
    // its arithmetic, and the `N 秒前更新` beside the live tag.
    function tickNow() {
        var now = Date.now();
        [].forEach.call(doc.querySelectorAll('.tkr'), function (el) {
            el.textContent = tk(Number(el.getAttribute('data-b')), Number(el.getAttribute('data-m')), false, now / 1000);
        });
        [].forEach.call(doc.querySelectorAll('[data-ago]'), function (el) {
            el.textContent = agoText(Math.round((now - polledAt) / 1000));
        });
        tickGates(now);
    }
    if (S.serve && w.location && w.location.protocol !== 'file:' && typeof w.setInterval === 'function') {
        w.setInterval(refresh, POLL_MS);
        w.setInterval(tickNow, 1000);
        // Back from hidden: every tick while away re-read nothing (unless a tune
        // request was open), so the page
        // re-reads now rather than up to three seconds from now.
        doc.addEventListener('visibilitychange', function () { if (!doc.hidden) refresh(); });
    }

    // ---- serve health polling ----------------------------------------------
    // Only `serve` (not `--open`, which writes a file) puts a server behind
    // this fetch, so a page opened straight from disk must never start the
    // poll — it would show a permanent death banner for a state that is
    // simply normal there. `w.setInterval` is also checked so a stripped-down
    // test harness that stubs `document` but not timers skips this quietly
    // instead of throwing.
    if (w.location && w.location.protocol !== 'file:' && typeof w.setInterval === 'function') {
        var lastOkMs = Date.now();
        var deadBar = null;
        var deadMsg = null;
        var setFrozen = function (on) {
            var page = doc.getElementById('page');
            if (page) page.style.cssText = on ? 'opacity:.72;filter:saturate(.3)' : '';
        };
        // The shell ships only #servedown; the "connected" twin is built the
        // first time the state is set, and the two swap by `hidden`.
        var servePill = function (on) {
            var pill = doc.getElementById('servedown');
            if (!pill) return;
            var upEl = doc.getElementById('serveup');
            if (!upEl && pill.insertAdjacentHTML) {
                pill.insertAdjacentHTML('beforebegin', serveIconHtml(true));
                upEl = doc.getElementById('serveup');
            }
            if (upEl) upEl.hidden = on;
            pill.hidden = !on;
        };
        servePill(false);
        var showDead = function (msg) {
            if (!deadBar) {
                deadBar = doc.createElement('div');
                deadBar.setAttribute('role', 'status');
                deadBar.setAttribute('aria-live', 'polite');
                deadBar.className = 'dead';
                var head = doc.createElement('b');
                head.innerHTML = '<i class="dot down"></i>' + esc(loc('health.serveNotResponding', 'serve 沒有回應'));
                deadBar.appendChild(head);
                deadMsg = doc.createElement('span');
                deadBar.appendChild(deadMsg);
                // What brings it back, as text to select rather than a
                // control: nothing on this page can start a server.
                var cmd = doc.createElement('code');
                cmd.textContent = 'node fankeel serve --open';
                deadBar.appendChild(cmd);
                var retry = doc.createElement('button');
                retry.type = 'button';
                retry.className = 'btn';
                retry.textContent = loc('health.retry', '重試');
                retry.style.cssText = 'border-color:var(--stale);color:var(--stale-ink)';
                retry.addEventListener('click', function () { poll(); });
                deadBar.appendChild(retry);
                var mast = doc.querySelector('.mast');
                mast.parentNode.insertBefore(deadBar, mast.nextSibling);
            }
            deadMsg.textContent = msg;
            deadBar.hidden = false;
            servePill(true);
            setFrozen(true);
            // The eyebrow is rendered, not patched, so the page has to be
            // drawn again — but only as the state flips. A redraw every five
            // seconds would throw away a scroll position and an opened row
            // for a page whose numbers cannot change any more.
            if (frozenAt === null) { frozenAt = stamp(NOW).slice(11); draw(); }
        };
        var hideDead = function () {
            if (deadBar) deadBar.hidden = true;
            servePill(false);
            setFrozen(false);
            if (frozenAt !== null) { frozenAt = null; draw(); }
        };
        var poll = function () {
            fetch('station/health').then(function (r) {
                if (r && r.ok) lastOkMs = Date.now();
            }).catch(function () {}).then(function () {
                var msg = serveLost(lastOkMs, Date.now(), stamp(NOW), ago(NOW));
                if (msg) showDead(msg); else hideDead();
            });
        };
        w.setInterval(poll, 5000);
    }

    // spend-1: the day scripts/quota.js calibrated the quota in force, or null
    // for a quota set by hand or a project's own, which carry no day.
    function quotaDay() {
        var m = S.profiles && S.profiles.machine && S.profiles.machine.values;
        var d = m && m['quota.calibrated'];
        var q = quotaWeek();
        return typeof d === 'string' && q && q === m['quota.week'] ? d : null;
    }

    draw();
}(typeof window === 'undefined' ? {} : window,
  typeof document === 'undefined' ? null : document));
