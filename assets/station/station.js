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
    function usd(n) { return n ? '$' + (n >= 100 ? n.toFixed(0) : n.toFixed(2)) : '—'; }
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
    var TABS = ['timeline', 'cost', 'dispatch', 'events'];
    var MODEL_KEYS = ['fable', 'opus', 'sonnet', 'haiku', 'other'];
    var TOKEN_KEYS = ['input', 'output', 'cacheRead', 'cacheWrite5m', 'cacheWrite1h'];
    // `kind` splits a day's cost or tokens by where they went, folding the two
    // cache-write rates `TOKEN_KEYS` keeps apart back into one segment — the
    // same four kinds and order the cost tab's `costHtml` already shows.
    var KIND_KEYS = ['input', 'output', 'cacheRead', 'cacheWrite'];
    var KIND_LABEL = { input: 'input', output: 'output', cacheRead: 'cache read', cacheWrite: 'cache write' };
    var KIND_COLOR = { input: '--t-in', output: '--t-out', cacheRead: '--t-cr', cacheWrite: '--t-cw' };
    var WHO_LABEL = { main: loc('shared.main', '主 session'), agent: loc('shared.agent', '背景 agent'), workflow: 'workflow' };
    var DIM_LABEL = { model: loc('shared.byModel', '依 model'), project: loc('shared.byProject', '依專案'), stage: loc('shared.byStage', '依 stage'),
        who: loc('shared.mainVsAgent', '主 session 對 agent'), version: loc('shared.byVersion', '依版本'), kind: loc('shared.byKind', '依成分') };
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
    // a page opened from file:// can go back through.
    var PAGES = ['live', 'sessions', 'projects', 'docs', 'settings', 'tour'];
    function parseHash(hash) {
        var p = String(hash || '').replace(/^#\/?/, '').split('/');
        var dec = function (v) { try { return decodeURIComponent(v); } catch (e) { return null; } };
        if (p[0] === 'd' && /^\d{4}-\d{2}-\d{2}$/.test(p[1] || '')) return { view: 'days', day: p[1] };
        if (p[0] === 'days') return { view: 'days', day: null };
        var key = p[0] === 'p' && p[1] ? dec(p.slice(1).join('/')) : null;
        if (key !== null) return { view: 'project', pkey: key };
        var id = p[0] === 's' && p[1] ? dec(p[1]) : null;
        if (id !== null) return { view: 'session', id: id, tab: TABS.indexOf(p[2]) >= 0 ? p[2] : 'timeline' };
        if (p[0] === 'list' || p[0] === 'cmp') return { view: p[0] };
        if (PAGES.indexOf(p[0]) >= 0) return { view: p[0] };
        return { view: 'now' };
    }
    function projectHash(pkey) { return '#/p/' + encodeURIComponent(pkey); }
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
    // `kind` is not here: it is not one key per row, it is four (see
    // `dayBars`), so it never goes through `dimKey`.
    function dimKey(dim, s, r) {
        if (dim === 'model') return modelKey(r.model);
        if (dim === 'project') return s.pkey;
        if (dim === 'stage') return r.stage || 'none';
        if (dim === 'version') return s.version || 'none';
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
    // instead reuses the cost tab's own four custom properties. `version` has
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
        if (dim === 'version' && key === 'none') return 'var(--st-none)';
        var i = (pkeys || []).indexOf(key);
        return 'var(--p-' + (i < 0 ? 5 : Math.min(i, 5)) + ')';
    }
    function keyLabel(dim, key, names) {
        if (dim === 'who') return WHO_LABEL[key] || key;
        if (dim === 'stage') return key === 'none' ? loc('shared.beforeStepOne', '第一步之前') : key;
        if (dim === 'project') return (names && names[key]) || key;
        if (dim === 'kind') return KIND_LABEL[key] || key;
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
    function metricText(metric, v) {
        return metric === 'usd' ? (v ? usd(v) : '$0') : metric === 'tokens' ? tokens(v) : hours(v);
    }
    function sessionTotals(s) {
        var t = { usd: 0, tokens: 0, active: 0, main: 0, wait: 0, models: {} };
        (s.days || []).forEach(function (r) {
            var m = family(r.model);
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
        var inside = {}, t = { usd: 0, tokens: 0, active: 0, main: 0, wait: 0 };
        days.forEach(function (d) { inside[d] = true; });
        sessions.forEach(function (s) {
            (s.days || []).forEach(function (r) {
                if (!inside[r.day]) return;
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
        var at = {}, seen = {};
        days.forEach(function (d) { at[d] = { day: d, total: 0, parts: {} }; });
        var add = function (d, key, v) {
            if (!at[d] || !v) return;
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
                // `kind` is four segments of the same row, not one key per
                // row, so it calls `add` four times instead of once — the
                // comment above this function still holds: the total is
                // added in the same pass as the parts, so it stays their sum.
                // `r.cost`/`r.tokens` is null for a model `lib/prices.js` has
                // no rate for (or a kept v1 row with no detail); skip it, the
                // same as `r.usd || 0` already does for every other dim.
                if (dim === 'kind') {
                    var src = metric === 'usd' ? r.cost : r.tokens;
                    if (!src) return;
                    add(r.day, 'input', src.input);
                    add(r.day, 'output', src.output);
                    add(r.day, 'cacheRead', src.cacheRead);
                    add(r.day, 'cacheWrite', (src.cacheWrite5m || 0) + (src.cacheWrite1h || 0));
                    return;
                }
                add(r.day, dimKey(dim, s, r), metric === 'usd' ? r.usd || 0 : tokenSum(r.tokens));
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
                r = by[s.pkey] = { pkey: s.pkey, root: s.root, project: s.project || null, usd: 0, n: 0, last: 0,
                    daily: days.map(function () { return 0; }) };
                list.push(r);
            }
            var touched = false;
            (s.days || []).forEach(function (x) {
                if (!inside[x.day]) return;
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
    function kpiHtml(cur, prev) {
        var share = function (t) { return t.main + t.wait ? t.wait / (t.main + t.wait) : 0; };
        var out = '<div class="readouts">'
            + roHtml(loc('shared.cost30d', '30 天花費'), usd(cur.usd), delta(cur.usd, prev.usd))
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
    function crumbHtml(parts) {
        return parts.map(function (p, i) {
            return i === parts.length - 1 ? '<span class="cur">' + esc(p[0]) + '</span>'
                : '<a href="' + esc(p[1]) + '">' + esc(p[0]) + '</a>';
        }).join('<i>/</i>');
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
                + metricText(o.metric, top * f) + '</text>';
        });
        bars.days.forEach(function (b, i) {
            var cx = (L + i * slot + slot / 2).toFixed(1), x0 = (L + i * slot + slot / 2 - bw / 2).toFixed(1);
            var c = 0, open = b.day === o.sel, mark = open || b.day === o.today;
            var href = open ? '#/' : '#/d/' + b.day;
            var label = loc('shared.dayTotal', '{day} 合計 {total}', { day: b.day, total: metricText(o.metric, b.total) })
                + bars.keys.filter(function (k) { return b.parts[k]; })
                    .map(function (k) { return loc('shared.dayTotalSeg', '；{key} {v}', { key: keyLabel(o.dim, k, o.names), v: metricText(o.metric, b.parts[k]) }); }).join('');
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
                    + metricText(o.metric, b.total) + '</text>' : '')
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
        return ((o.dim === 'version' || o.dim === 'model') ? bars.keys : o.pkeys || []).filter(function (k) { return !off[k]; });
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
                    + '<div class="tt-val"><b>' + metricText(o.metric, b.parts[key]) + '</b><span>' + loc('shared.dayShare', '當天的 {p}', { p: pct(b.parts[key]) }) + '</span></div>'
                : '')
            + '<ul class="tt-list">' + keys.reverse().map(function (k) {
                return '<li' + (k === key ? ' data-hot' : '') + '>' + sw(k) + '<span>' + esc(keyLabel(o.dim, k, o.names))
                    + '</span><span class="tt-n">' + metricText(o.metric, b.parts[k]) + '</span></li>';
            }).join('') + '</ul>'
            + '<div class="tt-sum">' + loc('shared.dayTotalLabel', '當天合計') + ' <b>' + metricText(o.metric, b.total) + '</b></div>';
    }
    function projectsHtml(rows, o) {
        return '<div class="h2">' + icon('projects') + loc('shared.projectsHeading', '專案 <small>近 30 天</small>') + '</div>'
            + '<div class="projrow head"><span>' + loc('shared.thProject', '專案') + '</span><span>' + loc('shared.thDailyCost', '每日花費') + '</span><span class="r">' + loc('shared.cost', '花費') + '</span><span class="r">session</span>'
            + '<span class="r">' + loc('shared.thLastActivity', '最後活動') + '</span></div>'
            + (rows.length ? rows.map(function (r) {
                var c = colorOf('project', r.pkey, o.pkeys);
                return '<a class="projrow" href="' + projectHash(r.pkey) + '"><span style="min-width:0"><span class="nm"><i class="sw" style="background:'
                    + c + '"></i>' + esc(o.names[r.pkey] || r.pkey) + '</span><span class="pth mono">' + esc(r.pkey) + '</span></span>'
                    + '<span>' + spark(r.daily, c) + '</span><span class="r">' + usd(r.usd) + '</span><span class="r">' + r.n + '</span>'
                    + '<span class="r muted">' + ago(r.last) + '</span></a>';
            }).join('') : '<p class="note">' + loc('shared.machineNoSessions', '這台機器上沒有 session') + '</p>');
    }
    function recentHtml(list, o) {
        return '<div class="h2">' + icon('sessions') + loc('shared.recentSessionsHeading', '最近 sessions <small>依最後動作，最新在上</small>') + '<span class="spacer"></span>'
            + '<a class="btn" href="#/list">' + loc('shared.seeAll', '看全部 →') + '</a></div>'
            + '<div class="tbl-wrap"><table class="t"><thead><tr><th>' + loc('shared.thTask', '任務') + '</th><th>' + loc('shared.thProject', '專案') + '</th><th>stage</th><th class="r">' + loc('shared.cost', '花費') + '</th>'
            + '<th class="r">token</th><th>' + loc('shared.thState', '狀態') + '</th></tr></thead><tbody>'
            + list.map(function (s) {
                var t = sessionTotals(s);
                return '<tr class="link" data-href="' + sessionHash(s.id) + '"><td class="task"><a href="' + sessionHash(s.id) + '">'
                    + esc(s.task || loc('shared.unnamed', '（未命名）')) + '</a></td><td><span class="pchip"><i class="sw" style="background:'
                    + colorOf('project', s.pkey, o.pkeys) + '"></i>' + esc(o.names[s.pkey] || s.pkey) + '</span></td>'
                    + '<td class="c-stage">' + stageNow(s) + '</td><td class="r">' + usd(t.usd) + '</td><td class="r muted">' + tokens(t.tokens) + '</td>'
                    + '<td class="c-state">' + statePill(s) + runningTag(s) + '</td></tr>';
            }).join('') + '</tbody></table></div>';
    }
    // The 文件 card: one section per project whose `.fankeel/map.md` was
    // found, quoting `parseMapCard`'s own reading of it rather than
    // recomputing anything here. `d.label` colours and `o.names` name it the
    // same way every other project-keyed row on this page does.
    var DOC_STATUS_COLOUR = { current: 'var(--good)', planned: 'var(--p-0)', generated: 'var(--m-haiku)', undeclared: 'var(--stale)' };
    var DOC_HATCH = 'var(--hatch-bg) repeating-linear-gradient(45deg,var(--hatch) 0 1.3px,transparent 1.3px 4.5px)';
    function docSplitHtml(d) {
        if (!d.buckets.length || !d.total) return '';
        var swatch = function (label) {
            return 'background:' + (label === 'retired' ? DOC_HATCH : DOC_STATUS_COLOUR[label] || 'var(--muted)');
        };
        var legend = d.buckets.map(function (b) {
            return '<span><i class="sw" style="' + swatch(b.label) + '"></i>'
                + esc(b.label) + ' <b>' + b.count + '</b><em>' + Math.round(b.count / d.total * 100) + '%</em></span>';
        }).join('');
        var bar = d.buckets.map(function (b) {
            return '<i title="' + esc(b.label) + ' ' + b.count + '" style="flex:' + b.count + ' 1 0;' + swatch(b.label) + '"></i>';
        }).join('');
        return '<div class="split"><div class="split-h"><span>' + loc('shared.status', '狀態') + '</span><span class="num mono">' + d.total + ' markdown files</span></div>'
            + '<div class="split-bar" role="img">' + bar + '</div><div class="split-leg">' + legend + '</div></div>';
    }
    function docPathList(paths) {
        return '<div class="claims">' + paths.map(function (p) { return '<div title="' + esc(p) + '">' + esc(p) + '</div>'; }).join('') + '</div>';
    }
    function docFilingHtml(filing) {
        if (!filing || !filing.rows.length) return '';
        return '<table class="t"><thead><tr><th>bucket</th><th>role</th><th></th></tr></thead><tbody>'
            + filing.rows.map(function (r) {
                return '<tr><td class="mono">' + esc(r.bucket) + '</td><td><span class="chip">' + esc(r.role) + '</span></td>'
                    + '<td class="muted mono" style="font-size:11px;white-space:normal;line-height:1.35">'
                    + (r.note ? esc('retired — ' + r.note) : '') + '</td></tr>';
            }).join('') + '</tbody></table>';
    }
    function docProjectHtml(d, o, open) {
        return '<details class="dproj"' + (open ? ' open' : '') + '><summary><span class="nm"><i class="sw" style="background:'
            + colorOf('project', d.pkey, o.pkeys) + '"></i>' + esc(o.names[d.pkey] || d.pkey) + '</span>'
            + '<span class="mono muted">.fankeel/map.md</span><span class="spacer"></span>'
            + '<span class="when">' + loc('shared.generatedAt', '生成於') + ' <span class="mono">' + stamp(Date.parse(d.generatedAt)) + '</span></span></summary>'
            + docSplitHtml(d)
            + '<div class="dgrid"><div>'
            + (d.plannedNotBuilt.length ? '<div class="dsub">' + loc('shared.notBuiltYet', '還沒建') + ' <span class="n">planned, not built — ' + d.plannedNotBuilt.length + '</span></div>'
                + docPathList(d.plannedNotBuilt) : '')
            + (d.undeclared.count ? '<div class="dsub">' + loc('shared.noStatusDeclared', '沒宣告狀態') + ' <span class="n">undeclared — ' + d.undeclared.count + '</span></div>'
                + (d.undeclared.note ? '<div class="dnote">' + esc(d.undeclared.note) + '</div>' : '') + docPathList(d.undeclared.paths) : '')
            + '</div><div>'
            + (d.filing ? '<div class="dsub">' + loc('shared.filingLocation', '歸檔位置') + ' <span class="n">filing · index: ' + esc(d.filing.index) + '</span></div>' + docFilingHtml(d.filing) : '')
            + '</div></div></details>';
    }
    function docsCardHtml(list, o) {
        if (!list.length) return '';
        return '<section class="panel docs"><div class="h2">' + loc('shared.docsHeading', '文件 <small>各專案已生成的 <span class="mono">.fankeel/map.md</span>，找不到的不列</small>') + '</div>'
            + (o && o.search ? o.search : '')
            + list.map(function (d, i) { return docProjectHtml(d, o, i === 0); }).join('') + '</section>';
    }
    // 文件's full-text box. The page bodies live on disk, so only a served
    // page can search them (`GET station/search`, lib/docsearch.js); the file
    // `/fankeel` writes says where to open one. `st` is `view.dsx`.
    function dsxCount(st) { return st && st.res && st.res.q && !st.res.err ? loc('shared.nPages', '{n} 頁', { n: st.res.n }) : ''; }
    function dsxResultsHtml(st) {
        var res = st && st.res;
        if (!res || !res.q) return '';
        if (res.err) {
            return '<p class="dsx-none">' + loc('shared.searchFailed', '搜尋失敗，沒有連上伺服器或回應不是預期的內容。')
                + '<span>' + loc('shared.searchFailedHint', '再打一個字或刪一個字重試；還是不行就檢查 serve 是否還在跑。') + '</span></p>';
        }
        if (!res.hits.length) {
            return '<p class="dsx-none">' + loc('shared.noHitsFor', '沒有頁面的內文含「{q}」。', { q: esc(res.q) }) + '<span>' + loc('shared.noHitsHint', '換個較短的詞再試；archive、plan、report 頁不在搜尋範圍內，要找它們請用下方的專案清單。') + '</span></p>';
        }
        return '<ol class="dsx-list">' + res.hits.map(function (h) {
            return '<li><a class="dsx-row" href="#/docs" title="' + esc(h.pkey + '/' + h.path) + '"><span class="dsx-t">' + esc(h.title) + '</span>'
                + '<span class="chip">' + esc(h.role) + '</span>'
                + '<p class="dsx-snip">' + esc(h.before) + '<mark>' + esc(h.hit) + '</mark>' + esc(h.after) + '</p>'
                + '<span class="dsx-path mono">' + esc(h.project) + ' · ' + esc(h.path) + '</span></a></li>';
        }).join('') + '</ol>'
            + (res.n > res.hits.length ? '<p class="dsx-scope">' + loc('shared.listedTopOf', '列出前 {shown} 頁，共 {total} 頁；換個更精確的詞可以縮小。', { shown: res.hits.length, total: res.n }) + '</p>' : '');
    }
    function docsSearchHtml(st, serve) {
        if (!serve) {
            return '<div class="dsx" data-block="docs-search"><span class="dsx-l">' + loc('shared.fullTextSearch', '全文搜尋') + '</span>'
                + '<p class="dsx-scope">' + loc('shared.fullTextNeedsServe', '全文搜尋要由 serve 回答：輸入 <code class="mono">/fankeel-station</code>，從它印出的網址開這一頁。') + '</p></div>';
        }
        return '<div class="dsx" data-block="docs-search"><label class="dsx-l" for="dq">' + loc('shared.fullTextSearch', '全文搜尋') + '</label>'
            + '<div class="dsx-box"><input id="dq" type="search" value="' + esc((st && st.q) || '') + '" placeholder="' + loc('shared.fullTextPlaceholder', '輸入字詞，搜全部專案的文件內文') + '"'
            + ' autocomplete="off"><span class="dsx-n mono" id="dsxN">' + dsxCount(st) + '</span></div>'
            + '<p class="dsx-scope">' + loc('shared.fullTextScope', '搜 reference、guide、decision 三種頁面的內文；archive、plan、report 不搜。') + '</p>'
            + '<div id="dsxOut">' + dsxResultsHtml(st) + '</div></div>';
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
        return { pkey: pkey, usd: t.usd, tokens: t.tokens, active: t.active, n: row ? row.n : 0 };
    }
    // A session's whole spend, at the moment it started.
    function sessionPoints(sessions, metric, t0, t1) {
        return sessions.map(function (s) {
            var t = sessionTotals(s);
            return { id: s.id, task: s.task, t: Date.parse(s.started), v: metric === 'usd' ? t.usd : t.tokens };
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
                + '<text class="tick" x="' + (L - 10) + '" y="' + (Number(Y(top * f)) + 4) + '" text-anchor="end">' + metricText(o.metric, top * f) + '</text>';
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
                    + ' · ' + metricText(o.metric, p.v)) + '</title></circle>';
            });
        });
        return out + '</svg>';
    }
    function miniMix(models) {
        var keys = MODEL_KEYS.filter(function (k) { return models[k] > 0; });
        var tot = keys.reduce(function (n, k) { return n + models[k]; }, 0);
        if (!tot) return '<span class="muted">—</span>';
        return '<span class="mini-mix" title="' + keys.map(function (k) { return k + ' ' + usd(models[k]); }).join(loc('proj.listSep', '、')) + '">'
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
                    + '<td class="r">' + usd(t.usd) + '</td><td class="r muted">' + tokens(t.tokens) + '</td><td>' + miniMix(t.models) + '</td></tr>';
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
                tokens: (r.k || 0) * 1000, cents: r.c || 0, ret: ret };
        };
        (x.dispatches || []).forEach(function (d, i) {
            var kids = rows.filter(function (r) { return r.disp === i; });
            if (d.surface !== 'workflow') {
                kids.forEach(function (r) { bars.push(agent(r, 'agent', r.id, d.ret)); });
                return;
            }
            bars.push({ kind: 'wf', key: 'wf-' + i, label: d.text, model: null, from: d.out, to: d.back, ret: d.ret, n: kids.length,
                tokens: kids.reduce(function (n, r) { return n + (r.k || 0); }, 0) * 1000,
                cents: kids.reduce(function (n, r) { return n + (r.c || 0); }, 0) });
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
            var text = g.stage + ' ' + mins(g.to - g.from) + (isFinite(g.usd) && g.usd ? ' · ' + usd(g.usd) : ''), lw = textW(g.stage, 11.5) + 12;
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
                    + (g && isFinite(g.usd) && g.usd ? ' · ' + loc('ses.thisStageCost', '這段 stage {v}', { v: usd(g.usd) }) : '')) + '</title></rect>';
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
                    + tokens(b.tokens) + ' tok · ' + cents(b.cents)
                    + (b.ret !== null && b.ret !== undefined ? ' · ' + loc('ses.returnedChars', '回傳 {n} 字元', { n: comma(b.ret) }) : ''))
                + '<line class="gridl" x1="0" x2="' + (W - R) + '" y1="' + (y + RH) + '" y2="' + (y + RH) + '"/>'
                + (b.kind === 'wf' ? '<rect class="wf-toggle" data-wf="' + esc(b.key) + '" x="0" y="' + y + '" width="' + (W - R)
                    + '" height="' + RH + '"><title>' + loc('ses.clickToggle', '點一下收合或展開') + '</title></rect>' : '');
        });
        return out + '</svg>';
    }
    // Stage by model, each of the four token kinds with its own dollars, from
    // the session's `days` — the same rows the home page's bars add up.
    function costModel(days) {
        var cell = function () {
            return { tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, usd: 0 };
        };
        var add = function (a, r) {
            var t = r.tokens || {}, c = r.cost || {};
            ['input', 'output', 'cacheRead'].forEach(function (k) { a.tokens[k] += t[k] || 0; a.cost[k] += c[k] || 0; });
            a.tokens.cacheWrite += (t.cacheWrite5m || 0) + (t.cacheWrite1h || 0);
            a.cost.cacheWrite += (c.cacheWrite5m || 0) + (c.cacheWrite1h || 0);
            a.usd += r.usd || 0;
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
        lp = lp || { turns: 0, over: 0, overUsd: 0 };
        var pct = stageUsd ? lp.overUsd / stageUsd * 100 : 0;
        var z = lp.over === 0;
        return '<tr class="loop">' + (foot ? '<td><span class="lp">' + loc('ses.mainLoop', '主迴圈') + '</span></td><td></td>' : '<td></td><td><span class="lp">' + loc('ses.mainLoop', '主迴圈') + '</span></td>')
            + '<td colspan="8"><div class="lf">'
            + '<span><b>' + lp.turns + '</b>' + loc('ses.turns', '回合') + '</span>'
            + '<span' + (z ? ' class="zero"' : '') + '><b>' + lp.over + '</b>' + loc('ses.turnsOver400k', '回合 ≥ 400k') + '</span>'
            + '<span' + (z ? ' class="zero"' : '') + '><b>' + usd(lp.overUsd) + '</b>' + loc('ses.thoseTurns', '那些回合') + '</span>'
            + '<span' + (z ? ' class="zero"' : '') + '><i class="mini" style="display:inline-flex;width:72px;vertical-align:middle;margin-right:8px">'
            + '<span style="width:' + Math.round(pct) + '%"></span></i><b>' + Math.round(pct) + '%</b>' + (foot ? loc('ses.ofSession', '佔 session') : loc('ses.ofThisStage', '佔這一站')) + '</span>'
            + '</div></td><td class="r"></td></tr>';
    }
    function sumLoops(loops) {
        return (loops || []).reduce(function (a, r) {
            return { turns: a.turns + r.turns, over: a.over + r.over, overUsd: a.overUsd + r.overUsd };
        }, { turns: 0, over: 0, overUsd: 0 });
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
            if (!by[k]) { by[k] = { stage: k, ms: null, usd: 0, main: 0, agent: 0, req: x ? 0 : null }; order.push(k); }
            return by[k];
        };
        (s.days || []).forEach(function (r) {
            var g = row(r.stage || 'none'), v = r.usd || 0;
            g.usd += v;
            total += v;
            if (r.who === 'main') g.main += v; else g.agent += v;
        });
        (s.stages || []).forEach(function (w) { var g = row(w.stage); g.ms = (g.ms || 0) + Math.max(w.to - w.from, 0); });
        if (x) {
            (x.points || []).forEach(function (pt) {
                var k = 'none';
                (x.seq || []).forEach(function (m) { if (m.at <= pt.t) k = m.stage; });
                row(k).req++;
            });
        }
        var rank = function (k) { var i = ROUTE.indexOf(k); return i < 0 ? ROUTE.length : i; };
        return { total: total, rows: order.sort(function (a, b) { return rank(a) - rank(b); }).map(function (k) { return by[k]; })
            .filter(function (g) { return g.usd || g.ms || g.req; }) };
    }
    // One bar split by stage in the timeline's stage tints, and the table under
    // it. A segment or a row is a toggle: `hi` is the stage the timeline marks.
    function costShareHtml(L, hi) {
        var pct = function (v) { return L.total ? Math.round(v / L.total * 1000) / 10 : 0; };
        var name = function (k) { return k === 'none' ? loc('ses.beforeStepOne', '第一步之前') : k; };
        var paid = L.rows.filter(function (g) { return g.usd > 0; });
        return '<div class="cshare" data-block="cost-share"><div class="h2">' + icon('spend') + loc('ses.costShareByStage', '各 stage 花費占比')
            + '<small>' + loc('ses.costShareHint', '合計 {t}；點一段或一列，時間線標出那個 stage', { t: usd(L.total) }) + '</small></div>'
            + (paid.length ? '<div class="csbar" role="group" aria-label="' + loc('ses.costShareByStage', '各 stage 花費占比') + '">' + paid.map(function (g) {
                var p = pct(g.usd), on = hi === g.stage;
                return '<button type="button" class="csseg' + (on ? ' on' : '') + '" data-hist="' + esc(g.stage) + '" aria-pressed="' + on + '"'
                    + ' title="' + esc(name(g.stage) + ' ' + usd(g.usd) + ' · ' + p + '%') + '" style="flex:' + g.usd + ' 1 0;background:'
                    + colorOf('stage', g.stage) + '">' + (p >= 9 ? '<span>' + esc(name(g.stage)) + '</span><b>' + usd(g.usd) + ' · ' + p + '%</b>' : '')
                    + '</button>';
            }).join('') + '</div>' : '<p class="tally">' + loc('ses.noDailyCost', '這個 session 沒有按日的花費') + '</p>')
            + '<div class="tbl-wrap"><table class="t cstbl"><thead><tr><th>stage</th><th class="r">' + loc('ses.thTime', '時間') + '</th><th class="r">' + loc('ses.thCost', '花費') + '</th><th class="r">' + loc('ses.thShare', '占比') + '</th>'
            + '<th>' + loc('ses.thMainVsAgent', '主 session / agent') + '</th><th class="r">' + loc('ses.thRequests', '請求') + '</th></tr></thead><tbody>' + L.rows.map(function (g) {
                var on = hi === g.stage;
                return '<tr class="csrow' + (on ? ' on' : '') + '" data-hist="' + esc(g.stage) + '" tabindex="0" aria-pressed="' + on + '">'
                    + '<td><span class="pchip"><i class="sw" style="background:' + colorOf('stage', g.stage) + '"></i>' + esc(name(g.stage)) + '</span></td>'
                    + '<td class="r muted">' + (g.ms === null ? '—' : mins(g.ms)) + '</td><td class="r">' + usd(g.usd) + '</td>'
                    + '<td class="r muted">' + (g.usd ? pct(g.usd) + '%' : '—') + '</td>'
                    + '<td><span class="csplit"' + (g.usd ? '' : ' hidden') + '><i style="flex:' + g.main + ' 1 0;background:var(--s-main)"></i>'
                    + '<i style="flex:' + g.agent + ' 1 0;background:var(--s-agent)"></i></span>'
                    + '<span class="muted">' + usd(g.main) + ' / ' + usd(g.agent) + '</span></td>'
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
        return '<div class="dstg" data-block="dispatch-stages"><div class="dxh">' + loc('ses.dispatchCostByStage', '派工花費，依 stage') + ' <small>' + loc('ses.totalV', '合計 {v}', { v: usd(sum) }) + '</small></div>'
            + paid.map(function (g) {
                var nm = g.stage === 'none' ? loc('ses.beforeStepOne', '第一步之前') : g.stage, on = hi === g.stage;
                return '<a class="dsrow' + (on ? ' on' : '') + '" href="' + sessionHash(id) + '" data-hist="' + esc(g.stage) + '" aria-pressed="' + on + '"'
                    + ' title="' + esc(loc('ses.dispatchOfShare', '{nm} 派工 {v} · 占派工 {p}%', { nm: nm, v: usd(g.agent), p: Math.round(g.agent / sum * 1000) / 10 })) + '">'
                    + '<span class="dsl">' + esc(nm) + '</span><span class="dst"><i style="width:' + (g.agent / max * 88).toFixed(1)
                    + '%;background:' + colorOf('stage', g.stage) + '"></i><b>' + usd(g.agent) + '</b></span></a>';
            }).join('') + '</div>';
    }
    function costHtml(m, x) {
        var KINDS = [['input', 'input', '--t-in'], ['output', 'output', '--t-out'], ['cacheRead', 'cache read', '--t-cr'],
            ['cacheWrite', 'cache write', '--t-cw']];
        var cells = function (a, cls) {
            return KINDS.map(function (k) {
                return '<td class="r muted">' + tokens(a.tokens[k[0]]) + '</td><td class="r">' + usd(a.cost[k[0]]) + '</td>';
            }).join('') + '<td class="r' + (cls ? ' ' + cls : '') + '">' + usd(a.usd) + '</td>';
        };
        var share = function (v) { return m.total.usd ? Math.round(v / m.total.usd * 1000) / 10 + '%' : '—'; };
        var allTok = KINDS.reduce(function (n, k) { return n + m.total.tokens[k[0]]; }, 0);
        var loops = x && Array.isArray(x.loops) ? x.loops : null;
        var loopBy = {};
        (loops || []).forEach(function (r) { loopBy[r.stage === null ? 'none' : r.stage] = r; });
        return '<div class="sumline"><div>' + loc('ses.totalCost', '合計花費') + '<b>' + usd(m.total.usd) + '</b></div><div>' + loc('ses.mainSession', '主 session') + '<b>' + usd(m.main.usd) + '</b></div>'
            + '<div>' + loc('ses.dispatchAgentWorkflow', '派工（agent + workflow）') + '<b>' + usd(m.agent.usd) + '</b></div><div>' + loc('ses.outputShareOfCost', 'output 佔花費') + '<b>' + share(m.total.cost.output) + '</b></div>'
            + '<div>' + loc('ses.cacheReadShareOfTokens', 'cache read 佔 token') + '<b>' + (allTok ? Math.round(m.total.tokens.cacheRead / allTok * 1000) / 10 + '%' : '—') + '</b></div></div>'
            + '<div class="h2">stage × model <small>' + loc('ses.stageModelHint', 'token 與各自的 USD；stage 列是小計') + '</small></div>'
            + '<div class="tbl-wrap"><table class="t"><thead><tr><th rowspan="2">stage</th><th rowspan="2">' + loc('ses.modelOfSession', 'model · 佔 session') + '</th>'
            + KINDS.map(function (k) { return '<th colspan="2"><i class="sw" style="background:var(' + k[2] + ')"></i> ' + k[1] + '</th>'; }).join('')
            + '<th rowspan="2" class="r">USD</th></tr><tr>'
            + KINDS.map(function () { return '<th class="r">token</th><th class="r">USD</th>'; }).join('') + '</tr></thead><tbody>'
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
            + roHtml(loc('ses.cost', '花費'), usd(t.usd), t.usd ? loc('ses.dispatchShare', '派工佔 {p}%', { p: Math.round(agentUsd / t.usd * 100) }) : loc('ses.noDailyCost', '這個 session 沒有按日的花費'))
            + roHtml('token', tokens(t.tokens), x ? loc('ses.nMainSessionRequests', '{n} 次主 session 請求', { n: x.requests }) : '')
            + roHtml(loc('ses.dispatch', '派工'), x ? x.rows.length + '<span class="u">agent</span>' : '—', x ? agentCounts(x, s) + loc('ses.nWorkflows', '{n} 個 workflow', { n: x.runs.length }) : '')
            + roHtml(loc('ses.wakes', '叫醒'), wakes === null ? '—' : wakes + '<span class="u">' + loc('ses.times', '次') + '</span>', wakes === null ? '' : loc('ses.dispatchWokeMain', '派工回報叫醒主 session'))
            + roHtml(loc('ses.contextPeak', 'context 峰值'), x ? tokens(x.peak) : '—', '')
            + '</div>';
    }
    // Three tabs by what a reader comes for: 概覽 is the session's story —
    // time, context and money stage by stage — and 派工 and 事件 are its two
    // long lists. `cost` is still in TABS so an old `/cost` link parses; it
    // opens 概覽, which now holds everything that tab showed.
    var TAB_SHOWN = ['timeline', 'dispatch', 'events'];
    function tabsHtml(s, tab, x) {
        var label = { timeline: loc('ses.tabOverview', '概覽'), dispatch: loc('ses.tabDispatch', '派工'), events: loc('ses.tabEvents', '事件') };
        var n = { dispatch: x ? x.rows.length : null, events: x ? x.events.length : null };
        var run = x ? x.rows.filter(function (r) { return agentState(x, r, s) === 'running'; }).length : 0;
        if (tab === 'cost') tab = 'timeline';
        return '<nav class="tabs" aria-label="' + loc('ses.sessionView', 'session 檢視') + '">' + TAB_SHOWN.map(function (k) {
            return '<a href="' + sessionHash(s.id, k) + '"' + (k === tab ? ' class="on" aria-current="page"' : '') + '>' + label[k]
                + (n[k] !== null && n[k] !== undefined ? '<small>' + n[k] + '</small>' : '')
                + (k === 'dispatch' && run ? '<i class="dot live" title="' + loc('ses.nAgentsRunning', '{n} 個 agent running', { n: run }) + '"></i>' : '') + '</a>';
        }).join('') + '</nav>';
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
    // Every badge is the count of what its page shows, from the same rows.
    function navCounts(sessions, projects, days) {
        return {
            live: sessions.filter(function (s) { return s.state === 'live'; }).length,
            usd: windowTotals(sessions, days).usd,
            sessions: recentRows(sessions, days).length,
            projects: projectRows(sessions, days).length,
            docs: [].concat.apply([], projects.map(function (p) { return p.docs || []; })).length,
        };
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
        dash: '<rect x="2" y="2" width="5" height="6" rx="1"/><rect x="9" y="2" width="5" height="3.5" rx="1"/>'
            + '<rect x="2" y="10" width="5" height="4" rx="1"/><rect x="9" y="7.5" width="5" height="6.5" rx="1"/>',
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
    var ICONS24 = { tour: '<circle cx="12" cy="12" r="10"/><path d="m10 8 6 4-6 4Z"/>' };
    function icon(name) {
        if (ICONS24[name]) {
            return '<svg class="ico g24" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor"'
                + ' stroke-linecap="round" stroke-linejoin="round">' + ICONS24[name] + '</svg>';
        }
        return ICONS[name] ? '<svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor"'
            + ' stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + ICONS[name] + '</svg>' : '';
    }
    // Six categories. A category with `kids` is a heading over its sub-pages,
    // and those same kids are the tab strip on each of their pages
    // (`subtabsHtml`), so the bar and the strip cannot list different pages.
    var NAV_TREE = [
        { ico: 'dash', label: loc('nav.dashboard', '儀表板'), v: 'now', href: '#/' },
        { ico: 'sessions', label: 'Sessions', fold: 'sessions', kids: [['live', '#/live', loc('nav.inProgress', '進行中')], ['sessions', '#/sessions', loc('nav.recent', '最近')],
            ['list', '#/list', loc('nav.fullList', '全部清單')], ['cmp', '#/cmp', loc('nav.compare', '比較')]] },
        { ico: 'spend', label: loc('nav.spend', '花費'), fold: 'spend', kids: [['days', '#/days', loc('nav.last30d', '近 30 天')], ['projects', '#/projects', loc('nav.byProject', '依專案')]] },
        { ico: 'docs', label: loc('nav.docs', '文件'), v: 'docs', href: '#/docs' },
        { ico: 'settings', label: loc('nav.settings', '設定'), kids: [['settings', '#/settings', loc('nav.wizard', '精靈')]] },
        { ico: 'tour', label: loc('nav.tour', '導覽'), v: 'tour', href: '#/tour', block: 'tour-nav', title: loc('nav.tourTitle', 'fankeel 怎麼跑一個任務，一段動畫看完') },
    ];
    // A detail page lights the page it was opened from.
    function navOn(active) { return active === 'project' ? 'projects' : active === 'session' ? 'sessions' : active; }
    function navGroup(v) {
        return NAV_TREE.filter(function (g) { return (g.kids || []).some(function (k) { return k[0] === v; }); })[0] || null;
    }
    // The three theme states the button at the foot of the bar cycles
    // through: [state, icon, what it says, the state a click moves to].
    var THEMES = { system: ['auto', loc('nav.themeSystem', '跟隨系統'), 'light'], light: ['sun', loc('nav.themeLight', '淺色'), 'dark'], dark: ['moon', loc('nav.themeDark', '深色'), 'system'] };
    // `ui.shut` holds the `fold` keys the reader collapsed; `ui.theme` is one
    // of THEMES. A category with `fold` is one button, the whole row, that only
    // opens and shuts; its kids do the navigating. The chevron shows which.
    function navHtml(active, c, ui) {
        var on = navOn(active), shut = (ui && ui.shut) || {}, th = THEMES[ui && ui.theme] ? ui.theme : 'system';
        // Each badge sits on the page whose rows it counts.
        var badges = { now: null, live: [c.live + ' live', c.live ? 'live' : ''], days: [usd(c.usd)], sessions: [c.sessions],
            projects: [c.projects], docs: [c.docs] };
        var link = function (v, href, inner, title) {
            var b = badges[v];
            return '<a href="' + href + '"' + (on === v ? ' aria-current="page"' : '') + (title ? ' title="' + esc(title) + '"' : '') + '>' + inner
                + (b ? '<span class="nb' + (b[1] ? ' ' + b[1] : '') + '">' + b[0] + '</span>' : '') + '</a>';
        };
        var t = THEMES[th];
        return '<nav class="sidenav" data-block="nav" aria-label="' + loc('nav.functions', '功能') + '"><ul>' + NAV_TREE.map(function (g) {
            if (!g.kids) {
                return '<li class="navcat"' + (g.block ? ' data-block="' + g.block + '"' : '') + '>'
                    + link(g.v, g.href, icon(g.ico) + '<span>' + g.label + '</span>', g.title) + '</li>';
            }
            var inside = g.kids.some(function (k) { return k[0] === on; }), closed = Boolean(g.fold && shut[g.fold]);
            var kids = '<ul class="navkids"' + (g.fold ? ' id="navkids-' + g.fold + '"' : '') + '>' + g.kids.map(function (k) {
                return '<li>' + link(k[0], k[1], '<span>' + k[2] + '</span>') + '</li>';
            }).join('') + '</ul>';
            return '<li class="navcat' + (inside ? ' in' : '') + (closed ? ' shut' : '') + '"' + (g.fold ? ' data-fold="' + g.fold + '"' : '') + '>'
                + (g.fold ? '<button type="button" class="navrow navhd" data-navfold="' + g.fold + '"'
                    + ' aria-controls="navkids-' + g.fold + '" aria-expanded="' + !closed + '">' + icon(g.ico) + '<span>' + g.label + '</span>'
                    + '<span class="navchev">' + icon('chev') + '</span></button>'
                    : '<a class="navhd" href="' + g.kids[0][1] + '">' + icon(g.ico) + '<span>' + g.label + '</span></a>') + (g.fold ? '<div class="navwrap">' + kids + '</div>' : kids) + '</li>';
        }).join('') + '</ul><div class="navfoot"><button type="button" class="themebtn" data-themecycle="' + t[2] + '"'
            + ' title="' + loc('nav.themeTitle', '主題：{cur}（按一下換{next}）', { cur: t[1], next: THEMES[t[2]][1] }) + '" aria-label="' + loc('nav.themeAriaLabel', '主題：{cur}，按一下換{next}', { cur: t[1], next: THEMES[t[2]][1] }) + '">'
            + icon(t[0]) + '</button></div></nav>';
    }
    // The tab strip under a Sessions or 花費 page's header: its category's
    // kids, the current one marked. Empty for a page with no siblings.
    function subtabsHtml(active) {
        var g = navGroup(active);
        if (!g || g.kids.length < 2) return '';
        return '<nav class="subtabs" data-block="subtabs" aria-label="' + esc(g.label) + '">' + g.kids.map(function (k) {
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
    // One session: who (project, else the registry's short label, and the
    // root), the task, the rail, and when. A lane that is not confirmed live
    // carries its state pill instead of how long it has been open.
    function liveLane(s, name, now) {
        var sure = s.state === 'live' && !s.unknown;
        return '<a class="lane ' + (sure ? 'live wsubs' : 'unsure') + '" data-state="' + esc(s.state) + '" href="' + sessionHash(s.id) + '">'
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
    // session's last registry write, as on the dashboard's gate card.
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
            + maybe.map(function (s) { return liveLane(s, name, now); }).join('') + '</section>';
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
        return '<div class="phead"><h1>' + icon('now') + loc('nav.now', '現在') + '</h1></div>' + (tabs || '') + '<div class="lv" data-block="now">'
            + (open.length ? liveGate(rows, name, now) + liveRun(run, name, now) + liveMaybe(maybe, open, name, now) + liveIdle(idle, lab)
                : '<p class="mute">' + loc('nav.noRegistry', '沒有 registry') + '</p>') + '</div>';
    }
    // ---- 設定: the seven-step wizard ----------------------------------------
    // Every question is a habit; a habit card recommends values and the
    // buttons under it take them or not. `val` holds strings or null (ask).
    var WIZ_STAGES = ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'];
    // One scene per card on the five keys that have a habit to show, copied
    // from the 2026-09-26 mockup. Each rests on its end frame; `.play` plus a
    // chosen or hovered card runs it from the start (station.css).
    var WIZ_SCENES = {
        'land.integration': {
            merge: '<svg class="vg" viewBox="0 0 220 76" aria-hidden="true">'
                + '<path class="ln" d="M12 54H208"/><circle class="cm" cx="26" cy="54" r="3.2"/><text class="lbl" x="12" y="71">main</text>'
                + '<g class="scene"><path class="br dr d1" pathLength="1" d="M40 54C56 54 54 24 72 24H128"/>'
                + '<circle class="cb p1" cx="88" cy="24" r="3.4"/><circle class="cb p2" cx="112" cy="24" r="3.4"/>'
                + '<path class="br dr d3" pathLength="1" d="M128 24C146 24 144 54 162 54"/>'
                + '<circle class="cmg p4" cx="162" cy="54" r="5"/></g></svg>',
            pr: '<svg class="vg" viewBox="0 0 220 76" aria-hidden="true">'
                + '<path class="ln" d="M12 54H208"/><circle class="cm" cx="26" cy="54" r="3.2"/><text class="lbl" x="12" y="71">main</text>'
                + '<g class="scene"><path class="br dr d1" pathLength="1" d="M40 54C56 54 54 30 72 30H106"/>'
                + '<circle class="cb p1" cx="80" cy="30" r="3.4"/><circle class="cb p2" cx="98" cy="30" r="3.4"/>'
                + '<g class="rise"><rect class="pr" x="112" y="6" width="56" height="22" rx="5"/><text class="prt" x="120" y="21">PR</text>'
                + '<path class="ok dr d4" pathLength="1" d="M146 17l3.5 3.5 7-7"/></g>'
                + '<path class="br dr d5" pathLength="1" d="M106 30C150 30 150 54 172 54"/>'
                + '<circle class="cmg p6" cx="172" cy="54" r="5"/></g></svg>',
            keep: '<svg class="vg" viewBox="0 0 220 76" aria-hidden="true">'
                + '<path class="ln" d="M12 54H208"/><circle class="cm" cx="26" cy="54" r="3.2"/><text class="lbl" x="12" y="71">main</text>'
                + '<g class="scene"><path class="br dr d1" pathLength="1" d="M40 54C56 54 54 28 72 28H128"/>'
                + '<circle class="cb p1" cx="88" cy="28" r="3.4"/><circle class="cb p2" cx="110" cy="28" r="3.4"/>'
                + '<g class="p3"><circle class="tipr" cx="130" cy="28" r="6"/><path class="pen" d="M130 22V6h14l-4 4 4 4h-14"/></g>'
                + '<circle class="cm p4" cx="158" cy="54" r="3.2"/><circle class="cm p6" cx="188" cy="54" r="3.2"/></g></svg>',
        },
        'land.push': {
            'true': '<svg class="vg" viewBox="0 0 220 76" aria-hidden="true">'
                + '<rect class="box" x="10" y="16" width="70" height="42" rx="6"/><text class="lblc" x="45" y="71" text-anchor="middle">' + loc('wiz.local', '本機') + '</text>'
                + '<rect class="box" x="140" y="16" width="70" height="42" rx="6"/><text class="lblc" x="175" y="71" text-anchor="middle">' + loc('wiz.remote', '遠端') + '</text>'
                + '<path class="link" d="M80 37H140"/>'
                + '<g class="scene"><circle class="cb mvR" cx="175" cy="37" r="5.5"/>'
                + '<rect class="box hot p3" x="140" y="16" width="70" height="42" rx="6"/>'
                + '<path class="ok dr d5" pathLength="1" d="M194 25l3 3 6-6"/></g></svg>',
            'false': '<svg class="vg" viewBox="0 0 220 76" aria-hidden="true">'
                + '<rect class="box" x="10" y="16" width="70" height="42" rx="6"/><text class="lblc" x="45" y="71" text-anchor="middle">' + loc('wiz.local', '本機') + '</text>'
                + '<rect class="box ghost" x="140" y="16" width="70" height="42" rx="6"/><text class="lblc" x="175" y="71" text-anchor="middle">' + loc('wiz.remote', '遠端') + '</text>'
                + '<path class="link" d="M80 37H140" style="opacity:.5"/>'
                + '<g class="scene"><circle class="cb p1" cx="29" cy="37" r="5"/><circle class="cb p2" cx="45" cy="37" r="5"/><circle class="cb p3" cx="61" cy="37" r="5"/></g></svg>',
        },
        'land.archivePlan': {
            'true': '<svg class="vg" viewBox="0 0 220 76" aria-hidden="true">'
                + '<rect class="box" x="138" y="34" width="68" height="34" rx="4"/>'
                + '<g class="scene"><g class="mvDoc"><rect class="doc" x="156" y="36" width="30" height="36" rx="3"/><path class="docl" d="M162 45h18M162 51h18M162 57h11"/></g>'
                + '<rect class="front" x="138" y="46" width="68" height="22" rx="4"/><path class="handle" d="M162 57h20"/>'
                + '<path class="ok dr d5" pathLength="1" d="M190 52l3 3 6-6"/></g></svg>',
            'false': '<svg class="vg" viewBox="0 0 220 76" aria-hidden="true">'
                + '<rect class="box ghost" x="138" y="34" width="68" height="34" rx="4"/>'
                + '<g class="scene"><rect class="doc" x="52" y="10" width="44" height="54" rx="3"/>'
                + '<path class="docl dr d1" pathLength="1" d="M60 22h28"/><path class="docl dr d2" pathLength="1" d="M60 31h28"/><path class="docl dr d3" pathLength="1" d="M60 40h18"/>'
                + '<circle class="cb p4" cx="88" cy="52" r="3.4"/></g></svg>',
        },
        guard: {
            ask: '<svg class="vg" viewBox="0 0 220 76" aria-hidden="true">'
                + '<path class="file" d="M96 18h20l8 8v32H96z"/><path class="file" d="M116 18v8h8" style="fill:none"/>'
                + '<g class="scene"><rect class="own p2" x="91" y="13" width="38" height="50" rx="5"/>'
                + '<g class="mvA"><circle class="sa" cx="84" cy="38" r="8.5"/><text class="sl" x="84" y="41.5" text-anchor="middle">A</text></g>'
                + '<g class="mvBask"><g class="wait"><circle class="sb" cx="148" cy="38" r="8.5"/><text class="sl" x="148" y="41.5" text-anchor="middle">B</text></g></g>'
                + '<g class="p3 og-b"><rect class="bub" x="134" y="4" width="58" height="18" rx="9"/><path class="bub" d="M146 21.4l2 5 4-5" style="stroke-linejoin:round"/><text class="bubt" x="163" y="16.5" text-anchor="middle">' + loc('wiz.continue', '要繼續？') + '</text></g>'
                + '</g></svg>',
            deny: '<svg class="vg" viewBox="0 0 220 76" aria-hidden="true">'
                + '<path class="file" d="M96 18h20l8 8v32H96z"/><path class="file" d="M116 18v8h8" style="fill:none"/>'
                + '<g class="scene"><rect class="own p2" x="91" y="13" width="38" height="50" rx="5"/>'
                + '<rect class="wall p2" x="136" y="12" width="5" height="52" rx="2"/>'
                + '<g class="mvA"><circle class="sa" cx="84" cy="38" r="8.5"/><text class="sl" x="84" y="41.5" text-anchor="middle">A</text></g>'
                + '<g class="mvBdeny"><circle class="sb" cx="176" cy="38" r="8.5"/><text class="sl" x="176" y="41.5" text-anchor="middle">B</text></g>'
                + '</g></svg>',
            off: '<svg class="vg" viewBox="0 0 220 76" aria-hidden="true">'
                + '<path class="file warn" d="M96 18h20l8 8v32H96z"/><path class="file warn" d="M116 18v8h8" style="fill:none"/>'
                + '<g class="scene"><g class="mvA"><circle class="sa" cx="84" cy="38" r="8.5"/><text class="sl" x="84" y="41.5" text-anchor="middle">A</text></g>'
                + '<g class="mvBoff"><circle class="sb" cx="130" cy="38" r="8.5"/><text class="sl" x="130" y="41.5" text-anchor="middle">B</text></g>'
                + '<g class="warn"><path class="tri" d="M110 0.5l10 17h-20z"/><path class="tri-x" d="M110 6.5v5M110 14.6v.1"/></g>'
                + '</g></svg>',
        },
        'stage.agents': {
            'false': '<svg class="vg short" viewBox="0 0 220 60" aria-hidden="true">'
                + '<path class="ln" d="M12 30H208" style="stroke-width:5;opacity:.85"/><text class="lbl" x="12" y="52">' + loc('wiz.mainline', '主線') + '</text></svg>',
            survey: '<svg class="vg short" viewBox="0 0 220 60" aria-hidden="true">'
                + '<path class="ln" d="M12 16H208"/><text class="lbl" x="12" y="54">' + loc('wiz.mainline', '主線') + '</text>'
                + '<g class="scene"><path class="lane dr d1" pathLength="1" d="M48 16C60 16 58 36 70 36H150C162 36 160 16 172 16"/></g></svg>',
            'survey,build,verify': '<svg class="vg short" viewBox="0 0 220 60" aria-hidden="true">'
                + '<path class="ln" d="M12 12H208"/><text class="lbl" x="12" y="56">' + loc('wiz.mainline', '主線') + '</text>'
                + '<g class="scene"><path class="lane dr d1" pathLength="1" d="M48 12C60 12 58 26 70 26H150C162 26 160 12 172 12"/>'
                + '<path class="lane dr d1" pathLength="1" d="M48 12C60 12 58 36 70 36H150C162 36 160 12 172 12"/>'
                + '<path class="lane dr d1" pathLength="1" d="M48 12C60 12 58 46 70 46H150C162 46 160 12 172 12"/></g></svg>',
            all: '<svg class="vg short" viewBox="0 0 220 60" aria-hidden="true">'
                + '<path class="ln" d="M12 10H208"/><text class="lbl" x="12" y="57">' + loc('wiz.mainline', '主線') + '</text>'
                + '<g class="scene"><path class="lane dr d1" pathLength="1" d="M48 10C60 10 58 20 70 20H150C162 20 160 10 172 10"/>'
                + '<path class="lane dr d1" pathLength="1" d="M48 10C60 10 58 25.5 70 25.5H150C162 25.5 160 10 172 10"/>'
                + '<path class="lane dr d1" pathLength="1" d="M48 10C60 10 58 31 70 31H150C162 31 160 10 172 10"/>'
                + '<path class="lane dr d1" pathLength="1" d="M48 10C60 10 58 36.5 70 36.5H150C162 36.5 160 10 172 10"/>'
                + '<path class="lane dr d1" pathLength="1" d="M48 10C60 10 58 42 70 42H150C162 42 160 10 172 10"/>'
                + '<path class="lane dr d1" pathLength="1" d="M48 10C60 10 58 47.5 70 47.5H150C162 47.5 160 10 172 10"/>'
                + '<path class="lane dr d1" pathLength="1" d="M48 10C60 10 58 53 70 53H150C162 53 160 10 172 10"/></g></svg>',
        },
    };
    // gate.station's two svg scenes, copied verbatim from the .wstg spans of
    // the wizard-gate-station block in the approved mockup.
    WIZ_SCENES['gate.station'] = {
        '60': '<svg class="vg" viewBox="0 0 220 80" aria-hidden="true"><rect class="box" x="22" y="10" width="112" height="60" rx="4"/><path class="docl" d="M22 19H134"/><path class="docl" d="M32 30H88M32 38H78M32 46H84"/><circle class="fdot" cx="118" cy="56" r="6"/><circle class="fring cdn" pathLength="1" stroke-dasharray="1" cx="118" cy="56" r="9.5"/><path class="link" d="M138 40H150"/><rect class="box" x="154" y="24" width="48" height="34" rx="3"/><text class="lbl" x="160" y="38">$ gate</text><text class="lbl" x="160" y="50">…60s</text></svg>',
        off: '<svg class="vg" viewBox="0 0 220 80" aria-hidden="true"><rect class="box ghost" x="26" y="22" width="44" height="32" rx="3"/><path class="ln" d="M22 60 74 16" style="stroke:var(--faint)"/><rect class="box" x="92" y="12" width="96" height="56" rx="4"/><text class="qm" x="100" y="29">?</text><text class="lbl" x="110" y="29">' + loc('wiz.whichOne', '選哪個') + '</text><path class="docl" d="M110 40H160M110 48H150M110 56H156"/></svg>',
    };
    var WIZ_CARD_TEXT = {
        'land.integration': { merge: { l: loc('wiz.mergeL', '本機合併'), d: loc('wiz.mergeD', '分支併回 main，留在本機。') },
            pr: { l: loc('wiz.prL', '開 PR'), d: loc('wiz.prD', '推上去，review 過再合。') },
            keep: { l: loc('wiz.keepL', '留在分支'), d: loc('wiz.keepD', '分支停著，之後自己整合。') } },
        'land.push': { 'true': { l: loc('wiz.pushTrueL', '推上去'), d: loc('wiz.pushTrueD', '收尾就 push。') },
            'false': { l: loc('wiz.pushFalseL', '留在本機'), d: loc('wiz.pushFalseD', 'commit 在手上，自己推。') } },
        'land.archivePlan': { 'true': { l: loc('wiz.archiveTrueL', '封存'), d: loc('wiz.archiveTrueD', '做完就收進 archive。') },
            'false': { l: loc('wiz.archiveFalseL', '先留著'), d: loc('wiz.archiveFalseD', '計畫繼續開著。') } },
        guard: { ask: { l: loc('wiz.guardAskL', '先問我'), d: loc('wiz.guardAskD', 'B 停下來等你點頭。') },
            deny: { l: loc('wiz.guardDenyL', '擋掉'), d: loc('wiz.guardDenyD', '等 A 放手才能改。') },
            off: { l: loc('wiz.guardOffL', '只提醒'), d: loc('wiz.guardOffD', '兩邊都改，閃個警告。') } },
        'stage.agents': { 'false': { l: loc('wiz.agentsFalseL', '全自己跑'), d: loc('wiz.agentsFalseD', '看得最清楚。') },
            survey: { l: loc('wiz.agentsSurveyL', '只交 survey'), d: loc('wiz.agentsSurveyD', '讀 repo 最吃 context。') },
            'survey,build,verify': { l: loc('wiz.agentsThreeL', '交三站'), d: loc('wiz.agentsThreeD', 'survey、build、verify。') },
            all: { l: loc('wiz.agentsAllL', '全交出去'), d: loc('wiz.agentsAllD', '主線只轉路徑。') } },
    };
    // `stage.agents` is offered as the four the mockup draws; the seven-stage
    // toggles under them (`wizOpts`) still set any other list.
    var WIZ_CARD_VALUES = { 'stage.agents': ['false', 'survey', 'survey,build,verify', 'all'] };
    // gate.station as the mockup draws it: two cards, 60 s suggested whatever
    // the habit pills pre-picked, and off the builtin.
    WIZ_CARD_VALUES['gate.station'] = ['60', 'off'];
    WIZ_CARD_TEXT['gate.station'] = { '60': { l: loc('wiz.gate60L', '等 60 秒'), d: loc('wiz.gate60D', '人在頁面旁邊時，點一下就答完。') },
        off: { l: loc('wiz.gateOffL', '不用，在 terminal 答'), d: loc('wiz.gateOffD', 'gate 直接在 terminal 問，網頁不接。') } };
    var WIZ_SUGGEST = { 'gate.station': '60' };
    // The card a step is drawn in, named the way the approved mockup names it.
    var WIZ_BLOCK = { front: 'wizard-design', answer: 'wizard-gate-station' };
    // class.default as a route map: the seven stages as dots, each class
    // lighting the stops it takes (lib/stages.js CLASSES). Unset is the
    // default — the model picks the class in survey — and still posts ''.
    var WIZ_ROUTES = { spike: ['survey', 'build'], bounded: ['survey', 'design', 'build', 'verify', 'land'], architectural: WIZ_STAGES };
    var WIZ_STAGE_JOB = { survey: loc('wiz.jobSurvey', '看現況'), design: loc('wiz.jobDesign', '定方案'), plan: loc('wiz.jobPlan', '拆任務'),
        build: loc('wiz.jobBuild', '動手做'), verify: loc('wiz.jobVerify', '拿證據'), audit: loc('wiz.jobAudit', '查過期文件'), land: loc('wiz.jobLand', '收尾整合') };
    var WIZ_CLASS_TEXT = {
        '': { l: loc('wiz.classAutoL', '依任務自動判斷'), d: loc('wiz.classAutoD', '模型在 survey 依任務決定走哪幾站。'), n: loc('wiz.classAutoN', 'survey 看完任務，再決定後面走哪幾站') },
        spike: { l: loc('wiz.classSpikeL', '試水溫'), d: loc('wiz.classSpikeD', '看一眼就動手，做完可能丟掉。'), n: loc('wiz.classSpikeN', '2 站：survey → build') },
        bounded: { l: loc('wiz.classBoundedL', '範圍清楚'), d: loc('wiz.classBoundedD', '先定方案，做完拿證據再收。'), n: loc('wiz.classBoundedN', '5 站：跳過 plan 和 audit') },
        architectural: { l: loc('wiz.classArchL', '動到架構'), d: loc('wiz.classArchD', '七站全走，文件也一起查。'), n: loc('wiz.classArchN', '7 站全走') },
    };
    var WIZ_GH = { 'class.default': loc('wiz.classDefaultGh', '沒指定類別時，任務走哪幾站') };
    // How much of the main session's context each stage.agents card leaves
    // in use — the mockup's meter under the card, a picture not a measurement.
    var WIZ_ASK_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5z"/><path d="M10 7.8a2 2 0 1 1 2.6 1.9c-.4.2-.6.5-.6 1v.4"/><path d="M12 13.2h.01"/></svg>';
    var WIZ_STEPS = [
        { id: 'land', t: loc('wiz.landT', '收尾'), q: loc('wiz.landQ', '一件工作做完，你通常怎麼收？'), sub: loc('wiz.landSub', '這決定 land 站停不停下來問你。選一個最像你的習慣，下面可以逐鍵改。'), keys: ['land.integration', 'land.push', 'land.archivePlan'],
            habits: [
                { l: loc('wiz.landH0L', '本機 merge 就好'), b: loc('wiz.landH0B', '直接合回 main，commit 留在本機，我自己決定什麼時候推。'), s: { 'land.integration': 'merge', 'land.push': 'false', 'land.archivePlan': 'true' } },
                { l: loc('wiz.landH1L', '開 PR 給人看'), b: loc('wiz.landH1B', '推上去開 PR，review 過再合。'), s: { 'land.integration': 'pr', 'land.push': 'true', 'land.archivePlan': 'true' } },
                { l: loc('wiz.landH2L', '留在分支'), b: loc('wiz.landH2B', '分支先留著，整合我自己來。計畫也先別封存。'), s: { 'land.integration': 'keep', 'land.push': 'false', 'land.archivePlan': null } },
                { l: loc('wiz.landH3L', '每次都問我'), b: loc('wiz.landH3B', '每個 repo 不一樣，到了收尾再決定。'), s: { 'land.integration': null, 'land.push': null, 'land.archivePlan': null } },
            ] },
        { id: 'class', t: loc('wiz.classT', '任務大小'), q: loc('wiz.classQ', '你起的任務，多半是多大？'), sub: loc('wiz.classSub', '起任務沒指定類別時用這個預設；它決定走哪幾站。'), keys: ['class.default'],
            habits: [
                { l: loc('wiz.classH0L', '試水溫'), b: loc('wiz.classH0B', '先做個小實驗看行不行，做完可能丟掉。'), s: { 'class.default': 'spike' } },
                { l: loc('wiz.classH1L', '範圍清楚的功能'), b: loc('wiz.classH1B', '知道要改哪裡、改完怎麼驗。'), s: { 'class.default': 'bounded' } },
                { l: loc('wiz.classH2L', '常動到架構'), b: loc('wiz.classH2B', '牽動好幾個模組，需要先設計再動手。'), s: { 'class.default': 'architectural' } },
                { l: loc('wiz.classH3L', '依任務自動判斷'), b: loc('wiz.classH3B', '模型在 survey 依任務決定走哪幾站。'), s: { 'class.default': null } },
            ] },
        { id: 'front', t: loc('wiz.frontT', '前端'), q: loc('wiz.frontQ', '這個專案的前端，mockup 要怎麼畫？'), sub: loc('wiz.frontSub', '有前端的話，design 站會先畫一頁 mockup 給你看，再談實作。'), keys: ['design.mockup', 'design.skill'],
            habits: [
                { l: loc('wiz.frontH0L', '沒有前端'), b: loc('wiz.frontH0B', 'CLI、函式庫或純文件，不用畫頁面。'), s: { 'design.mockup': 'false' } },
                { l: loc('wiz.frontH1L', '有，快速草圖'), b: loc('wiz.frontH1B', '先看個大概，sonnet 畫就夠。'), s: { 'design.mockup': 'sonnet' } },
                { l: loc('wiz.frontH2L', '有，要仔細畫'), b: loc('wiz.frontH2B', '畫面是重點，用 opus 做完整的頁面。'), s: { 'design.mockup': 'opus' } },
                { l: loc('wiz.frontH3L', '有，用最強的'), b: loc('wiz.frontH3B', '交給 fable 畫。'), s: { 'design.mockup': 'fable' } },
                { l: loc('wiz.frontH4L', '有，自動畫'), b: loc('wiz.frontH4B', '前端工作不問就畫，畫完直接開頁面。'), s: { 'design.mockup': 'auto' } },
            ] },
        { id: 'agents', t: 'context', q: loc('wiz.agentsQ', '你在不在意主 session 的 context 被吃掉？'), sub: loc('wiz.agentsSub', '交給站 agent 的站，會在自己乾淨的 context 裡跑，主控只拿回一個路徑。'), keys: ['stage.agents'],
            habits: [
                { l: loc('wiz.agentsH0L', '不在意，全部自己跑'), b: loc('wiz.agentsH0B', '每一站都在主 session 裡，看得最清楚。'), s: { 'stage.agents': 'false' } },
                { l: loc('wiz.agentsH1L', '只交出 survey'), b: loc('wiz.agentsH1B', '讀 repo 最吃 context，只把這站交出去。'), s: { 'stage.agents': 'survey' } },
                { l: loc('wiz.agentsH2L', '省 context'), b: loc('wiz.agentsH2B', 'survey、build、verify 三站交出去。'), s: { 'stage.agents': 'survey,build,verify' } },
                { l: loc('wiz.agentsH3L', '全部交出去'), b: loc('wiz.agentsH3B', '主控只轉路徑，七站都給站 agent。'), s: { 'stage.agents': 'all' } },
            ] },
        { id: 'guard', t: loc('wiz.guardT', '撞檔'), q: loc('wiz.guardQ', '別的 session 正在改同一個檔案時，你要怎樣？'), sub: loc('wiz.guardSub', '兩個 session 同時動一個檔案，其中一邊的改動可能被蓋掉。'), keys: ['guard'],
            habits: [
                { l: loc('wiz.guardH0L', '先問我'), b: loc('wiz.guardH0B', '停下來讓我決定要不要繼續。'), s: { guard: 'ask' } },
                { l: loc('wiz.guardH1L', '直接擋掉'), b: loc('wiz.guardH1B', '被佔的檔案不准改，等對方放手。'), s: { guard: 'deny' } },
                { l: loc('wiz.guardH2L', '提醒一下就好'), b: loc('wiz.guardH2B', '我知道自己在做什麼，警告但不停。'), s: { guard: 'off' } },
            ] },
        { id: 'model', t: loc('wiz.modelT', '模型'), q: loc('wiz.modelQ', '派出去的 agent，你比較在意錢還是品質？'), sub: loc('wiz.modelSub', '最低模型是實作者和 reader 的下限；判官是卡住時問的那一個。'), keys: ['dispatch.floor', 'judge.model'],
            habits: [
                { l: loc('wiz.modelH0L', '省錢'), b: loc('wiz.modelH0B', '讀檔用 haiku 就夠，判官用 opus。'), s: { 'dispatch.floor': 'haiku', 'judge.model': 'opus' } },
                { l: loc('wiz.modelH1L', '平衡'), b: loc('wiz.modelH1B', '實作至少 sonnet，判官用 fable。'), s: { 'dispatch.floor': 'sonnet', 'judge.model': 'fable' } },
                { l: loc('wiz.modelH2L', '品質優先'), b: loc('wiz.modelH2B', '實作至少 opus，判官用 fable。'), s: { 'dispatch.floor': 'opus', 'judge.model': 'fable' } },
            ] },
        { id: 'station', t: loc('wiz.stationT', '監控站'), q: loc('wiz.stationQ', '這個專案要出現在監控站上嗎？'), sub: loc('wiz.stationSub', '隱藏後它的 session 和 profile 卡都不會在這頁出現；要再打開得用指令。'), keys: ['station.hide'],
            habits: [
                { l: loc('wiz.stationH0L', '要，照常顯示'), b: '', s: { 'station.hide': 'false' } },
                { l: loc('wiz.stationH1L', '不要，藏起來'), b: loc('wiz.stationH1B', '私人或暫時的專案。'), s: { 'station.hide': 'true' } },
            ] },
        { id: 'answer', t: loc('wiz.answerT', '答 gate'), q: loc('wiz.answerQ', '要不要在網頁上直接回答 gate？'), sub: loc('wiz.answerSub', 'gate 發出後，先在這頁右下角的圖示裡等你 60 秒；逾時，或你按「交給終端／手機」，問題就回到 terminal，Remote Control 也看得到。等的時候 terminal 不顯示問題。'), keys: ['gate.station'],
            habits: [
                { l: loc('wiz.answerH0L', '不用，在 terminal 答'), b: '', s: { 'gate.station': 'off' } },
                { l: loc('wiz.answerH1L', '等一分鐘'), b: loc('wiz.answerH1B', '人就在頁面旁邊時。'), s: { 'gate.station': '60' } },
                { l: loc('wiz.answerH2L', '等五分鐘'), b: loc('wiz.answerH2B', '常離開座位、用手機看頁面時。'), s: { 'gate.station': '300' } },
            ] },
    ];
    function wizList(v) { return v === null || v === 'false' ? [] : v === 'true' ? ['survey'] : v === 'all' ? WIZ_STAGES.slice() : v.split(','); }
    function wizNorm(arr) {
        arr = WIZ_STAGES.filter(function (s) { return arr.indexOf(s) >= 0; });
        return !arr.length ? 'false' : arr.length === WIZ_STAGES.length ? 'all' : arr.join(',');
    }
    // A value off `lib/profile.js` `read()` — a boolean, a stage array or a
    // string — in the text form the buttons and the POST use. `k` picks the
    // join: stage.agents collapses to its named shorthand, design.skill (and
    // anything else that is only ever a plain list) stays a comma list.
    function wizText(v, k) {
        if (v === undefined || v === null) return null;
        if (!Array.isArray(v)) return String(v);
        return k === 'stage.agents' ? wizNorm(v) : v.join(',');
    }
    function wizShow(v) { return v === null ? '(ask)' : String(v); }
    function wizSame(a, b) { return String(a) === String(b); }
    function wizOverridden(W, k) { return Object.prototype.hasOwnProperty.call(W.rec, k) && !wizSame(W.rec[k], W.val[k]); }
    // What this scope's own file holds for k.
    function wizOwn(profiles, scope, k) {
        var p = scope === 'machine' ? profiles.machine : (profiles.projects || {})[scope];
        var want = scope === 'machine' ? 'machine' : 'project';
        return p && p.sources && p.sources[k] === want ? { has: true, v: wizText(p.values[k], k) } : { has: false, v: null };
    }
    // What the layers under this scope supply: machine, then builtin.
    function wizBelow(profiles, keys, scope, k) {
        var m = profiles.machine;
        if (scope !== 'machine' && m && m.sources && m.sources[k] === 'machine') return { v: wizText(m.values[k], k), src: 'machine' };
        var b = keys[k] ? keys[k].builtin : null;
        return b !== null && b !== undefined ? { v: String(b), src: 'builtin' } : { v: null, src: '' };
    }
    function wizEff(profiles, keys, scope, k) {
        var own = wizOwn(profiles, scope, k);
        return own.has ? { v: own.v, src: scope === 'machine' ? 'machine' : 'project' } : wizBelow(profiles, keys, scope, k);
    }
    function wizLoad(profiles, keys, scope) {
        var W = { step: 0, scope: scope, pick: {}, val: {}, rec: {} };
        Object.keys(keys).forEach(function (k) { W.val[k] = wizEff(profiles, keys, scope, k).v; });
        // A habit card is pre-picked when every value it sets is what is effective today.
        WIZ_STEPS.forEach(function (st, i) {
            st.habits.forEach(function (h, j) {
                if (W.pick[i] !== undefined) return;
                if (Object.keys(h.s).every(function (k) { return wizSame(h.s[k], W.val[k]); })) {
                    W.pick[i] = j;
                    Object.keys(h.s).forEach(function (k) { W.rec[k] = h.s[k]; });
                }
            });
        });
        return W;
    }
    function wizScopes(profiles, configDir) {
        var out = [{ id: 'machine', label: loc('wiz.machineDefault', '機器預設'), file: (configDir ? String(configDir).replace(/[\\/]+$/, '') + '/' : '') + 'fankeel/profile.json' }];
        Object.keys((profiles && profiles.projects) || {}).forEach(function (dir) {
            out.push({ id: dir, label: dir.split(/[\\/]/).filter(Boolean).pop() || dir, file: dir.replace(/[\\/]+$/, '') + '/.fankeel/profile.json' });
        });
        return out;
    }
    // One entry per key the write would touch. A key this file does not hold
    // is written only when the choice differs from what the layers below give;
    // a key it does hold and that is now null is cleared (value '').
    function wizChanges(keys, W, profiles) {
        return Object.keys(keys).filter(function (k) {
            var own = wizOwn(profiles, W.scope, k), v = W.val[k];
            return own.has ? !wizSame(own.v, v) : v !== null && !wizSame(wizEff(profiles, keys, W.scope, k).v, v);
        }).map(function (k) { return { key: k, value: W.val[k] === null ? '' : String(W.val[k]) }; });
    }
    // One click, as the button's dataset. The station chip carries both
    // `k` and `st`, so `st` is read first.
    function wizApply(W, keys, profiles, d) {
        var n = WIZ_STEPS.length;
        if (d.go !== undefined) { var g = Number(d.go); if (g >= 0 && g <= n) W.step = g; return W; }
        if (d.h !== undefined) {
            var hb = WIZ_STEPS[W.step].habits[Number(d.h)];
            W.pick[W.step] = Number(d.h);
            Object.keys(hb.s).forEach(function (k) { W.rec[k] = hb.s[k]; W.val[k] = hb.s[k]; });
            return W;
        }
        // A design.skill chip toggles one skill in or out; the list keeps the
        // key's own order, and none at all is unset (fankeel's guide alone).
        if (d.m !== undefined) {
            var have = W.val[d.k] ? String(W.val[d.k]).split(',') : [], at = have.indexOf(d.m);
            if (at >= 0) have.splice(at, 1); else have.push(d.m);
            var order = keys[d.k] ? keys[d.k].values : have;
            have = order.filter(function (o) { return have.indexOf(o) >= 0; });
            W.val[d.k] = have.length ? have.join(',') : null;
            return W;
        }
        if (d.st !== undefined) {
            var on = wizList(W.val['stage.agents']), i = on.indexOf(d.st);
            if (i >= 0) on.splice(i, 1); else on.push(d.st);
            W.val['stage.agents'] = wizNorm(on);
            return W;
        }
        if (d.k !== undefined) { W.val[d.k] = d.o === '' ? null : d.o; return W; }
        if (d.ask !== undefined) { W.val[d.ask] = null; return W; }
        if (d.scope !== undefined) { var step = W.step; W = wizLoad(profiles, keys, d.scope); W.step = step; return W; }
        return W;
    }
    function wizOpts(keys, W, profiles, k) {
        var v = W.val[k], r = W.rec[k], hasRec = Object.prototype.hasOwnProperty.call(W.rec, k);
        if (k === 'stage.agents') {
            var on = wizList(v), ron = hasRec ? wizList(r) : [];
            return '<div class="stations" role="group" aria-label="' + loc('wiz.stageAgentsSevenStations', 'stage.agents 七站') + '">' + WIZ_STAGES.map(function (s) {
                var p = on.indexOf(s) >= 0;
                return '<button type="button" class="wstn' + (ron.indexOf(s) >= 0 ? ' rec' : '') + '" data-k="' + k + '" data-st="' + s
                    + '" aria-pressed="' + p + '" style="--c:var(--st-' + s + ')"><i class="wpt"></i><span class="wnm">' + s
                    + '</span><span class="wst">' + (p ? loc('wiz.stageAgent', '站 agent') : loc('wiz.mainControl', '主控')) + '</span></button>';
            }).join('') + '</div><div class="stkey"><span>' + loc('wiz.nOfSevenHandedOff', '{n} / 7 站交出去', { n: on.length }) + '</span>'
                + (hasRec ? '<span><i></i>' + loc('wiz.recommendedStations', '建議開的站') + '</span>' : '') + '<span>' + loc('wiz.valueWritten', '寫進檔的值') + ' <span class="wout">' + esc(wizNorm(on)) + '</span></span></div>';
        }
        var spec = keys[k], opts = spec.values.slice();
        if (spec.builtin === null) opts.push(null);
        var inh = v === null ? wizBelow(profiles, keys, W.scope, k).v : null;
        return '<span class="opts" role="group" aria-label="' + esc(k) + '">' + opts.map(function (o) {
            return '<button type="button" class="opt' + (o === null ? ' ask' : '') + (hasRec && wizSame(r, o) ? ' rec' : '')
                + (inh !== null && wizSame(inh, o) ? ' inh' : '') + '" data-k="' + esc(k) + '" data-o="' + (o === null ? '' : esc(o))
                + '" aria-pressed="' + wizSame(v, o) + '">' + (o === null ? (k === 'class.default' ? loc('wiz.autoDecide', '自動判斷') : loc('wiz.askEveryTime', '每次問我')) : esc(o)) + '</button>';
        }).join('') + '</span>';
    }
    // One card per value: a label, one line, and on the five keys in
    // WIZ_SCENES a scene that plays while its card is chosen or hovered.
    // `data-k`/`data-o` are what `wizApply` reads, so a card click is the same
    // click the buttons were.
    function wizCards(keys, W, k) {
        var v = W.val[k], r = W.rec[k], hasRec = Object.prototype.hasOwnProperty.call(W.rec, k);
        var opts = (WIZ_CARD_VALUES[k] || keys[k].values).slice(), n = opts.length;
        if (keys[k].builtin === null) opts.push(null);
        var text = WIZ_CARD_TEXT[k] || {}, scenes = WIZ_SCENES[k] || {};
        // c<n> counts the valued cards; the ask card, when there is one, takes
        // the narrow last column the mockup gives it.
        return '<div class="chs c' + n + (n === opts.length ? ' na' : '') + '" role="group" aria-label="' + esc(k) + '">' + opts.map(function (o) {
            var id = o === null ? '' : o, t = text[id] || { l: o === null ? loc('wiz.askMe', '問我') : o, d: o === null ? loc('wiz.decideLater', '到時再決定。') : '' };
            var scene = o === null ? WIZ_ASK_ICON : (scenes[id] || '');
            return '<button type="button" class="ch' + (o === null ? ' ask' : '') + '" data-k="' + esc(k) + '" data-o="' + esc(id)
                + '" aria-pressed="' + wizSame(v, o) + '">' + (wizSame(WIZ_SUGGEST[k] !== undefined ? WIZ_SUGGEST[k] : (hasRec ? r : undefined), o) ? '<span class="rec">' + loc('wiz.recommended', '建議') + '</span>' : '')
                + (scene ? '<span class="wstg">' + scene + '</span>' : '')
                + '<span class="cl">' + esc(t.l) + '</span>' + (t.d ? '<span class="cd">' + esc(t.d) + '</span>' : '')
                + (o === null ? '' : '<span class="cv">' + esc(o) + '</span>') + '</button>';
        }).join('') + '</div>';
    }
    // The class.default step: four cards (auto first, the default), then the
    // route map. `data-r` is what is chosen; hovering or focusing a card
    // previews its route (station.css, `:has`), the lit path drawing along.
    function wizRoute(W, k) {
        var v = W.val[k], r = W.rec[k], hasRec = Object.prototype.hasOwnProperty.call(W.rec, k);
        var opts = [null, 'spike', 'bounded', 'architectural'];
        var x = function (s) { return 50 + WIZ_STAGES.indexOf(s) * 100; };
        var paths = ['spike', 'bounded', 'architectural'].map(function (c) {
            var rt = WIZ_ROUTES[c], d = 'M' + x(rt[0]) + ' 26';
            for (var i = 1; i < rt.length; i++) {
                var a = x(rt[i - 1]), b = x(rt[i]);
                d += b - a > 100 ? 'C' + a + ' 4 ' + b + ' 4 ' + b + ' 26' : 'H' + b;
            }
            return '<path class="rpth p-' + c + '" pathLength="1" d="' + d + '"/>';
        }).join('');
        var cards = opts.map(function (o) {
            var id = o === null ? '' : o, t = WIZ_CLASS_TEXT[id];
            return '<button type="button" class="ch co' + (o === null ? ' auto' : '') + '" data-k="' + esc(k) + '" data-o="' + id
                + '" aria-pressed="' + wizSame(v, o) + '">' + (hasRec && wizSame(r, o) ? '<span class="rec">' + loc('wiz.recommended', '建議') + '</span>' : '')
                + '<span class="cl">' + t.l + (o === null ? '<span class="cdef">' + loc('wiz.default', '預設') + '</span>' : '') + '</span><span class="cd">' + t.d + '</span>'
                + (o === null ? '' : '<span class="cv">' + id + '</span>') + '</button>';
        }).join('');
        var stops = WIZ_STAGES.map(function (s, i) {
            var cls = ['cst'];
            Object.keys(WIZ_ROUTES).forEach(function (c) { if (WIZ_ROUTES[c].indexOf(s) >= 0) cls.push('in-' + c); });
            if (s === 'survey') cls.push('in-auto');
            return '<li class="' + cls.join(' ') + '" style="--c:var(--st-' + s + ');--i:' + i + '"><i class="cdot"></i>'
                + '<span class="cnm">' + s + '</span><span class="cjob">' + WIZ_STAGE_JOB[s] + '</span></li>';
        }).join('');
        var notes = opts.map(function (o) {
            var id = o === null ? '' : o;
            return '<span data-for="' + (o === null ? 'auto' : id) + '">' + WIZ_CLASS_TEXT[id].n + '</span>';
        }).join('');
        return '<div class="cls" data-r="' + (v === null ? 'auto' : esc(v)) + '">'
            + '<div class="chs c4 cops" role="group" aria-label="' + esc(k) + '">' + cards + '</div>'
            + '<div class="cmap"><svg class="crt" viewBox="0 0 700 30" preserveAspectRatio="none" aria-hidden="true">'
            + '<path class="rbase" d="M50 26H650"/>' + paths + '</svg>'
            + '<ol class="cflow" aria-label="' + loc('wiz.sevenStations', '七站') + '">' + stops + '</ol>'
            + '<p class="cnote">' + notes + '</p></div></div>';
    }
    var WIZ_TICK = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.3 5 8.6l4.5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var WIZ_LIST = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3.5h6M3 6h6M3 8.5h4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
    function wizStepsHtml(W) {
        var n = WIZ_STEPS.length, done = 0;
        var items = WIZ_STEPS.map(function (st, i) {
            var d = W.pick[i] !== undefined, c = i === W.step ? 'cur' : (d ? 'done' : '');
            if (d) done++;
            var s = st.keys.map(function (k) { return wizShow(W.val[k]); }).join(' · ');
            return '<li' + (c ? ' class="' + c + '"' : '') + '><button class="ri" type="button" data-go="' + i + '"><span class="rn">' + (c === 'done' ? WIZ_TICK : i + 1)
                + '</span><span class="rt">' + st.t + '</span><span class="rv">' + esc(s) + '</span></button></li>';
        }).join('');
        return '<nav class="wrail" data-block="wizard-steps" aria-label="' + loc('wiz.wizardProgress', '精靈進度') + '"><div class="rhead"><span>' + loc('wiz.answered', '已答') + '</span><b>' + done + ' / ' + n + '</b></div>'
            + '<div class="rbarx" aria-hidden="true"><i style="width:' + (done / n * 100) + '%"></i></div><ol>' + items
            + '<li class="sum' + (W.step === n ? ' cur' : '') + '"><button class="ri" type="button" data-go="' + n + '"><span class="rn">' + WIZ_LIST
            + '</span><span class="rt">' + loc('wiz.summaryAndWrite', '摘要與寫入') + '</span><span class="rv">' + loc('wiz.nKeys', '{n} 鍵', { n: Object.keys(W.val).length }) + '</span></button></li></ol></nav>';
    }
    // Step 3, 前端: two big blocks, yes or no; the model only once the answer
    // is yes, small under them. Every button is a habit (`data-h`), so a click
    // records the pick and the values stay the four design.mockup already
    // takes. design.skill waits under 進階.
    var WIZ_FE_NO = '<svg class="vg" viewBox="0 0 220 80" aria-hidden="true">'
        + '<rect class="box" x="72" y="10" width="76" height="50" rx="4"/><path class="ln" d="M100 70H120M110 60V70"/>'
        + '<text class="lbl" x="82" y="30">$ _</text><path class="ln" d="M64 70 156 6"/></svg>';
    var WIZ_FE_YES = '<svg class="vg" viewBox="0 0 220 80" aria-hidden="true">'
        + '<rect class="box" x="72" y="10" width="76" height="50" rx="4"/><path class="ln" d="M100 70H120M110 60V70"/>'
        + '<g class="scene"><path class="br dr d1" pathLength="1" d="M79 18H141"/>'
        + '<rect class="box hot dr d2" pathLength="1" x="79" y="25" width="26" height="28" rx="2"/>'
        + '<path class="docl dr d3" pathLength="1" d="M111 28H141M111 36H137M111 44H131"/></g></svg>';
    var WIZ_FE_MODELS = [
        { o: 'sonnet', h: 1, d: loc('wiz.feSonnet', '省額度'), cost: 1 },
        { o: 'opus', h: 2, d: loc('wiz.feOpus', '平衡'), cost: 2 },
        { o: 'fable', h: 3, d: loc('wiz.feFable', '很燒額度'), cost: 4, warn: true },
    ];
    var WIZ_FE_WARN = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1.6 11 10.4H1z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M6 5v2.4M6 8.9h.01" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';
    var WIZ_FE_OPEN = '<svg class="fopen" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2.5h4v4M13.5 2.5 8 8M11.5 9.5v3.5h-9v-9H6"/></svg>';
    var WIZ_FE_AUTO = { o: 'auto', h: 4, d: loc('wiz.feAuto', '直接畫，畫完開頁面'), open: true };
    var WIZ_FE_NONE = { o: 'false', h: 0, d: loc('wiz.feNone', '沒有前端，不畫') };
    function wizFrontHtml(keys, W) {
        var v = W.val['design.mockup'], on = v !== null && v !== 'false';
        var seg = function (m) {
            var chk = v === m.o, bars = '';
            if (m.cost) for (var j = 0; j < 4; j++) bars += '<i' + (j < m.cost ? ' class="on"' : '') + '></i>';
            return '<button type="button" class="fsg' + (m.warn ? ' warn' : '') + '" role="radio" aria-checked="' + chk + '" tabindex="'
                + (chk || (v === null && m.o === 'opus') ? 0 : -1) + '" data-h="' + m.h + '"><b>' + m.o
                + (m.o === 'opus' ? '<span class="frc">' + loc('wiz.recommended', '建議') + '</span>' : '') + '</b><span class="fsd">' + (m.warn ? WIZ_FE_WARN : '') + m.d + '</span>'
                + (m.cost ? '<span class="fcost" aria-hidden="true">' + bars + '</span>' : '') + (m.open ? WIZ_FE_OPEN : '') + '</button>';
        };
        return '<h2 class="q">' + loc('wiz.frontQ', '這個專案的前端，mockup 要怎麼畫？') + '</h2><p class="wqs">' + loc('wiz.frontSub', '有前端的話，design 站會先畫一頁 mockup 給你看，再談實作。') + '</p>'
            + '<div class="fem"><div class="fmh"><span class="fml">' + loc('wiz.whoDraws', '誰來畫') + '</span><code>design.mockup</code></div>'
            + '<div class="fq" role="radiogroup" aria-label="design.mockup">'
            + '<div class="fqc none" aria-hidden="true"></div><div class="fqc" aria-hidden="true"><span>' + loc('wiz.asksBeforeDrawing', '畫之前先問你') + '</span></div>'
            + '<div class="fqc" aria-hidden="true"><span>' + loc('wiz.doesNotAsk', '不問') + '</span></div>'
            + '<div class="fbar solo">' + seg(WIZ_FE_NONE) + '</div>'
            + '<div class="fbar">' + WIZ_FE_MODELS.map(seg).join('') + '</div>'
            + '<div class="fbar solo">' + seg(WIZ_FE_AUTO) + '</div></div>'
            + (on ? wizSkillHtml(keys, W) : '') + '</div>';
    }
    // design.skill: fankeel's guide always in, then any of the six on top,
    // grouped by the plugin before the colon. Each chip toggles one (`data-m`).
    function wizSkillHtml(keys, W) {
        var v = W.val['design.skill'], on = v ? String(v).split(',') : [], groups = [], by = {};
        (keys['design.skill'] ? keys['design.skill'].values : []).forEach(function (o) {
            var i = o.indexOf(':'), pl = i > 0 ? o.slice(0, i) : o;
            if (!by[pl]) { by[pl] = []; groups.push(pl); }
            by[pl].push(o);
        });
        return '<div class="fskw"><div class="fmh"><span class="fml">' + loc('wiz.designSkill', '設計 skill') + '</span><code>design.skill</code><span class="fmul">' + loc('wiz.multiSelect', '可多選') + '</span>'
            + '<span class="fskt">' + loc('wiz.theGuide', '指南') + (on.length ? ' + ' + loc('wiz.nMore', '{n} 個', { n: on.length }) : '') + '</span></div>'
            + '<p class="fskn">' + loc('wiz.guideAlwaysLoaded', 'fankeel 指南一律載入；另外勾的 skill，會一起交給畫 mockup 的 agent。') + '</p>'
            + '<div class="fskg" role="group" aria-label="design.skill">'
            + '<div class="fskc self"><span class="fskh">' + loc('wiz.builtin', '內建') + '</span><span class="fskl"><button type="button" class="fsk lock" aria-pressed="true" aria-disabled="true"'
            + ' title="' + loc('wiz.alwaysIncludedHint', '一律包含，不能取消') + '">fankeel ' + loc('wiz.theGuide', '指南') + '<span>' + loc('wiz.alwaysIncludedParen', '（一律包含）') + '</span></button></span></div>'
            + groups.map(function (pl) {
                return '<div class="fskc"><span class="fskh">' + esc(pl) + '</span><span class="fskl">' + by[pl].map(function (o) {
                    var i = o.indexOf(':');
                    return '<button type="button" class="fsk mul" data-k="design.skill" data-m="' + esc(o) + '" aria-pressed="' + (on.indexOf(o) >= 0) + '">'
                        + esc(i > 0 ? o.slice(i + 1) : o) + '</button>';
                }).join('') + '</span></div>';
            }).join('') + '</div></div>';
    }
    function wizStepHtml(keys, W, profiles) {
        var n = WIZ_STEPS.length, st = WIZ_STEPS[W.step];
        if (st.id === 'front') {
            return '<div class="wcard" data-block="' + (WIZ_BLOCK[st.id] || 'wizard-step') + '" data-step="' + st.id + '">'
                + '<div class="top"><span class="of">' + (W.step + 1) + ' / ' + n + '</span><span class="spacer"></span>'
                + '<button class="lk" type="button" data-go="' + n + '">' + loc('wiz.jumpToSummary', '跳到摘要') + '</button></div>'
                + wizFrontHtml(keys, W)
                + '<div class="nav"><button class="ctl" type="button" data-go="' + (W.step - 1) + '">' + loc('wiz.prevQuestion', '← 上一題') + '</button><span class="spacer"></span>'
                + '<button class="ctl pri" type="button" data-go="' + (W.step + 1) + '">' + loc('wiz.nextQuestion', '下一題 →') + '</button></div></div>';
        }
        var shown = st.keys.filter(function (k) {
            return k !== 'design.skill' || (W.val['design.mockup'] !== null && W.val['design.mockup'] !== 'false');
        });
        var ovr = function (k) { return wizOverridden(W, k) ? '<span class="ovr">' + loc('wiz.changedFromRec', '改過建議') + '</span>' : ''; };
        var big = function (k) { return WIZ_SCENES[k] || k === 'class.default'; };
        var full = shown.filter(big), mini = shown.filter(function (k) { return !big(k); });
        return '<div class="wcard" data-block="' + (WIZ_BLOCK[st.id] || 'wizard-step') + '" data-step="' + st.id + '">'
            + '<div class="top"><span class="of">' + (W.step + 1) + ' / ' + n + '</span><span class="spacer"></span>'
            + '<button class="lk" type="button" data-go="' + n + '">' + loc('wiz.jumpToSummary', '跳到摘要') + '</button></div>'
            + '<h2 class="q">' + st.q + '</h2><p class="wqs">' + st.sub + '</p>'
            + '<div class="presets"><span class="plab">' + loc('wiz.commonCombos', '常見組合') + '</span><span class="pills" role="group" aria-label="' + loc('wiz.tCommonCombos', '{t} 常見組合', { t: st.t }) + '">' + st.habits.map(function (hb, j) {
                return '<button type="button" class="pc" data-h="' + j + '" aria-pressed="' + (W.pick[W.step] === j) + '" title="'
                    + Object.keys(hb.s).map(function (k) { return esc(k) + ' → ' + esc(wizShow(hb.s[k])); }).join('&#10;') + '">' + hb.l + '</button>';
            }).join('') + '</span></div>'
            + full.map(function (k) {
                return '<div class="grp" role="group" aria-label="' + esc(k) + '"><div class="gh"><b>' + esc(WIZ_GH[k] || keys[k].desc || k) + '</b><code>' + esc(k) + '</code>' + ovr(k) + '</div>'
                    + (k === 'class.default' ? wizRoute(W, k) : wizCards(keys, W, k)) +(k === 'stage.agents' ? '<div class="stfine">' + wizOpts(keys, W, profiles, k) + '</div>' : '') + '</div>';
            }).join('')
            + (mini.length ? '<div class="wmini">' + mini.map(function (k) {
                return '<div class="mrow"><b>' + esc(keys[k].desc || k) + '<code>' + esc(k) + '</code></b><span class="ctlc">' + wizOpts(keys, W, profiles, k) + ovr(k) + '</span></div>';
            }).join('') + '</div>' : '')
            + (st.id === 'station' && W.scope === 'machine' ? '<p class="wnote">' + loc('wiz.machineDefaultNote', '現在寫的是機器預設：station.hide 設在這裡，會讓每個沒寫這個鍵的專案都跟著隱藏。') + '</p>' : '')
            + '<div class="nav"><button class="ctl" type="button" data-go="' + (W.step - 1) + '"' + (W.step ? '' : ' disabled') + '>' + loc('wiz.prevQuestion', '← 上一題') + '</button><span class="spacer"></span>'
            + '<span class="whint">' + (W.pick[W.step] === undefined ? loc('wiz.noPickStillMoves', '不選也能往下，這題的鍵維持現在的值') : '') + '</span>'
            + '<button class="ctl pri" type="button" data-go="' + (W.step + 1) + '">' + (W.step === n - 1 ? loc('wiz.seeSummary', '看摘要 →') : loc('wiz.nextQuestion', '下一題 →')) + '</button></div></div>';
    }
    function wizWriteHtml(ch, W, ctx, file) {
        var label = loc('wiz.writeNKeys', '寫入 {n} 鍵', { n: ch.length });
        if (!ch.length) return '<button class="ctl" type="button" disabled>' + label + '</button>';
        if (!ctx.serve) {
            return '<div class="wcmd mono">' + ch.map(function (c) {
                return c.value === '' ? loc('wiz.removeKeyFromFile', '從 {file} 刪掉 {key}', { file: esc(file), key: esc(c.key) })
                    : 'node ' + esc(ctx.plugin || '<plugin>') + '/scripts/task.js profile set ' + esc(c.key) + ' ' + esc(c.value)
                        + (W.scope === 'machine' ? ' --default' : ' --project "' + esc(W.scope) + '"');
            }).join('<br>') + '</div>';
        }
        return '<form method="post" action="/profile" class="wform">'
            + '<input type="hidden" name="nonce" value="' + esc(ctx.nonce || '') + '">'
            + '<input type="hidden" name="scope" value="' + (W.scope === 'machine' ? 'machine' : 'project') + '">'
            + (W.scope === 'machine' ? '' : '<input type="hidden" name="project" value="' + esc(W.scope) + '">')
            + '<input type="hidden" name="back" value="#/settings">'
            + ch.map(function (c) {
                return '<input type="hidden" name="key" value="' + esc(c.key) + '"><input type="hidden" name="value" value="' + esc(c.value) + '">';
            }).join('')
            + '<button class="ctl" type="submit">' + label + '</button></form>';
    }
    function wizSummaryHtml(keys, W, profiles, ctx) {
        var n = WIZ_STEPS.length, ch = wizChanges(keys, W, profiles), moved = {}, ov = 0;
        ch.forEach(function (c) { moved[c.key] = true; });
        var rows = Object.keys(keys).map(function (k) {
            var now = wizEff(profiles, keys, W.scope, k), v = W.val[k], m = Boolean(moved[k]), o = wizOverridden(W, k);
            var own = wizOwn(profiles, W.scope, k), src, from;
            if (o) ov++;
            if (m && v === null) {
                var inh = wizBelow(profiles, keys, W.scope, k);
                src = inh.src;
                from = inh.src ? loc('wiz.readsDownTo', '往下讀到 <span class="mono">{src}: {v}</span>', { src: inh.src, v: esc(inh.v) }) : loc('wiz.noLowerValueWillAsk', '沒有下層值，到時候會問');
            } else if (m) { src = W.scope === 'machine' ? 'machine' : 'project'; from = loc('wiz.afterWrite', '寫入後'); }
            else { src = now.src; from = src ? '' : loc('wiz.noValue', '沒有值'); }
            return '<div class="sr' + (o ? ' ov' : '') + (m ? ' moved' : '') + '" data-key="' + esc(k) + '"><span class="wk">' + esc(k) + '</span><span class="wd">' + esc(keys[k].desc || '') + '</span>'
                + '<span class="ctlc">' + wizOpts(keys, W, profiles, k) + (o ? '<span class="ovr">' + loc('wiz.changedRecIs', '改過建議 · 建議是 <span class="mono">{v}</span>', { v: esc(wizShow(W.rec[k])) }) + '</span>' : '') + '</span>'
                + '<span class="wmeta"><span class="from">' + from + (src ? ' <span class="src ' + src + (m && v !== null ? ' wpend' : '') + '">' + src + '</span>' : '') + '</span>'
                + '<button type="button" class="askb" data-ask="' + esc(k) + '"' + (v === null || (!own.has && !m) ? ' disabled' : '') + '>' + loc('wiz.clearToAsk', '清成 <span class="wm">(ask)</span>') + '</button></span></div>';
        }).join('');
        var scopes = wizScopes(profiles, ctx.configDir), file = '';
        scopes.forEach(function (s) { if (s.id === W.scope) file = s.file; });
        return '<div class="wcard" data-block="wizard-summary"><div class="prog" aria-hidden="true"><i style="width:100%"></i></div>'
            + '<div class="wtop"><span class="eyebrow">' + loc('wiz.summary', '摘要') + '</span><span class="wof">' + loc('wiz.nKeys', '{n} 鍵', { n: Object.keys(keys).length }) + '</span><span class="spacer"></span>'
            + '<button class="wlk" type="button" data-go="0">' + loc('wiz.restartFromQ1', '← 從第 1 題重來') + '</button></div>'
            + '<h2 class="wq">' + loc('wiz.answersBecomeSettings', '答案換成的設定') + '</h2><p class="wqsub">' + loc('wiz.summaryHint', '每一列都能直接按鈕改；和精靈建議不一樣的列會標出來。「清成 (ask)」是把這一鍵從這一層的檔案拿掉，改讀下一層。') + '</p>'
            + '<div class="scopebar"><label>' + loc('wiz.writeTo', '寫到') + '</label><span class="seg" role="group" aria-label="' + loc('wiz.writeToWhichLayer', '寫到哪一層') + '">' + scopes.map(function (s) {
                return '<button type="button" data-scope="' + esc(s.id) + '" aria-pressed="' + (W.scope === s.id) + '">' + esc(s.label) + '</button>';
            }).join('') + '</span></div>'
            + '<div class="pf-file">' + esc(file) + (W.scope === 'machine' ? loc('wiz.everyProjectReadsHere', ' · 每個專案沒寫的鍵都讀這裡') : loc('wiz.unwrittenReadsDown', ' · 沒寫的鍵往下讀機器預設，再往下是 builtin')) + '</div>'
            + '<div class="srows">' + rows + '</div>'
            + '<div class="writebar"><span class="wsum">' + loc('wiz.willChangeNKeys', '會改 <b>{n}</b> 鍵', { n: ch.length }) + (ov ? loc('wiz.ofWhichNDiffer', '，其中 <b>{n}</b> 鍵和建議不同', { n: ov }) : '') + '</span><span class="spacer"></span>'
            + '<button class="ctl" type="button" data-go="' + (n - 1) + '">' + loc('wiz.backToPrev', '← 回上一題') + '</button>' + wizWriteHtml(ch, W, ctx, file) + '</div></div>';
    }
    function wizHtml(keys, W, profiles, ctx) {
        var body = W.step >= WIZ_STEPS.length ? wizSummaryHtml(keys, W, profiles, ctx) : wizStepHtml(keys, W, profiles);
        return '<div class="phead"><h1>' + icon('settings') + loc('wiz.settingsHeading', '設定') + '</h1></div><div class="wz play" data-block="wizard">'
            + wizStepsHtml(W) + '<div class="body">' + body + '</div></div>';
    }

    // ---- tune: a block changed ----------------------------------------------
    // One project's queue can sit on several sessions' rows; an id is one
    // request wherever it appears. `tuneEvents` is every request that was in
    // progress on the last read and has settled on this one — a request first
    // seen settled is not news.
    function tuneItems(sessions) {
        var out = {};
        (sessions || []).forEach(function (s) {
            ((s.tune && s.tune.items) || []).forEach(function (it) { out[it.id] = it; });
        });
        return out;
    }
    function tuneOpen(sessions) {
        return (sessions || []).some(function (s) { return s.tune && s.tune.open > 0; });
    }
    function tuneEvents(prev, next) {
        var was = tuneItems(prev), now = tuneItems(next), out = [];
        Object.keys(now).forEach(function (id) {
            var a = was[id], b = now[id];
            if (a && (a.status === 'queued' || a.status === 'taken') && (b.status === 'done' || b.status === 'rejected')) {
                out.push({ id: b.id, block: b.block, status: b.status });
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
    function floatNotes(sessions, notes) {
        var editing = [];
        (sessions || []).forEach(function (s) {
            ((s.tune && s.tune.items) || []).forEach(function (it) {
                if (it.status === 'taken') editing.push({ id: it.id, block: it.block, status: 'edit' });
            });
        });
        return editing.concat(notes || []);
    }
    function noteHtml(n) {
        var t = n.status === 'edit' ? ['edit', '<i></i>', loc('tune.editingColon', '編輯中：'), loc('tune.editingHint', 'tune 正在改這個 block，頁面上有外框標出它。')]
            : n.status === 'done' ? ['done', '✓', loc('tune.doneColon', '已修改完成：'), loc('tune.doneHint', '改過的頁面由 tune 自己重新載入。')]
                : ['rej', '✕', loc('tune.notChangedColon', '沒有修改：'), loc('tune.rejectedHint', '要求超出這個 block，已退回。')];
        return '<div class="nt ' + t[0] + '" data-note="' + esc(n.id) + '"><span class="ti" aria-hidden="true">' + t[1] + '</span>'
            + '<span class="tt">' + t[2] + '<code>' + esc(n.block) + '</code></span>'
            + (n.status === 'edit' ? '' : '<button class="tx" type="button" data-note-x aria-label="' + loc('tune.close', '關閉') + '">×</button>')
            + '<span class="tb">' + t[3] + '</span></div>';
    }
    // Exported as `clock`; the page's own `clock(ms)` is the hh:mm one.
    function gateClock(sec) { return Math.floor(sec / 60) + ':' + (sec % 60 < 10 ? '0' : '') + (sec % 60); }
    // A held gate of one single-choice question is answered by its options as
    // buttons; any other shape keeps the full form, `pendingGateHtml`. The
    // countdown runs from the hook's own `at` to `until`.
    function gateCountdownHtml(s, now, picked) {
        var p = s.pending, q = p.questions[0];
        var total = Math.max(1, Math.round((p.until - (typeof p.at === 'number' && isFinite(p.at) ? p.at : p.until - 60000)) / 1000));
        var left = Math.max(0, Math.min(total, Math.round((p.until - now) / 1000)));
        var body = p.questions.length === 1 && !q.multiSelect && S.serve
            ? '<p class="gq"><small>' + esc(q.header || '') + '</small>' + esc(q.question) + '</p><div class="gops" role="group" aria-label="' + loc('tune.answer', '回答') + '">'
                + (q.options || []).map(function (o, i) {
                    return '<button type="button" class="gop" data-gop="' + i + '"><b>' + esc(o.label) + '</b><small>' + esc(o.description || '')
                        + '</small><kbd>' + (i + 1) + '</kbd></button>';
                }).join('') + '</div>'
            : pendingGateHtml(s, picked);
        return '<div class="gc" data-block="gate-countdown" data-pg-root="' + esc(s.root) + '" data-pg-id="' + esc(s.id) + '" data-until="' + p.until
            + '" data-total="' + total + '"><div class="gsrc"><span class="mono">' + esc(s.project || '') + '</span><i aria-hidden="true"></i><span class="mono">'
            + esc(s.stage || '') + '</span><span class="t">' + esc(s.task || '') + '</span></div>' + body
            + '<div class="gtm"><div class="gbar" aria-hidden="true"><i style="width:' + (left / total * 100).toFixed(1) + '%"></i></div>'
            + '<span class="gsec">' + gateClock(left) + '</span><small>' + loc('tune.timeUpAsksTerminal', '時間到，問題回到 terminal 問') + '</small></div>'
            + (S.serve ? '<button type="button" class="gho" data-gho>' + loc('tune.handToTerminalPhone', '交給終端／手機') + '</button>'
                + '<p class="ghs">' + loc('tune.handOffHint', '網頁不再等，問題馬上在 terminal 問；Remote Control 在手機上也看得到。') + '</p>' : '')
            + '<p class="gend" role="status" aria-live="polite"></p></div>';
    }
    var FK_BELL = '<svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'
        + '<path d="M5 8a5 5 0 0 1 10 0v4l1.5 2.5h-13L5 12z"/><path d="M8.2 16.5a2 2 0 0 0 3.6 0"/></svg>';
    function floatHtml(sessions, notes, open, now, picked, permission) {
        var held = (sessions || []).filter(function (s) { return s.pending && s.pending.questions && s.pending.questions.length; });
        var all = floatNotes(sessions, notes), n = held.length + all.length, tune = null, done = 0;
        (sessions || []).forEach(function (s) {
            if (!s.tune) return;
            done += s.tune.done;
            if (!tune && s.tune.url) tune = s.tune;
        });
        return '<section class="fkp" id="fkp" aria-label="' + loc('tune.notificationsAndGate', '通知與 gate') + '"' + (open || held.length ? '' : ' hidden') + '>'
            + '<div class="fkh"><b>' + loc('tune.notificationsAndGate', '通知與 gate') + '</b><span class="n">' + loc('tune.nItems', '{n} 件', { n: n }) + '</span><span class="spacer"></span>'
            + (all.some(function (x) { return x.status !== 'edit'; }) ? '<button class="lk" type="button" data-note-clear>' + loc('tune.clearNotifications', '清掉通知') + '</button>' : '') + '</div>'
            + (held.length ? '<div class="fks">' + loc('tune.waitingOnYou', '等你回答') + ' <b>' + held.length + '</b></div>'
                + held.map(function (s) { return gateCountdownHtml(s, now, picked); }).join('') : '')
            + '<div class="fks">' + loc('tune.notifications', '通知') + ' <b>' + all.length + '</b></div>' + all.map(noteHtml).join('')
            + (all.length ? '' : '<p class="fkempty">' + loc('tune.noNewNotifications', '沒有新通知。') + '</p>')
            + '<div class="fkf"><span>' + loc('tune.tuneDone', 'tune 完成') + ' <b>' + done + '</b></span>'
            + (tune ? '<a href="' + esc(tune.url) + '" target="_blank" rel="noopener">' + esc(tune.url.replace(/^https?:\/\//, '').replace(/\/$/, '')) + '</a>' : '')
            + '<span class="spacer"></span>'
            + (permission === 'default' ? '<button type="button" class="btn" data-tune-notify>' + loc('tune.notifyInBackground', '背景時通知我') + '</button>' : '') + '</div></section>'
            + '<button type="button" class="fkb" data-fkb aria-expanded="' + Boolean(open || held.length) + '" aria-controls="fkp" aria-label="' + loc('tune.notificationsAndGateNItems', '通知與 gate：{n} 件', { n: n })
            + (held.length ? loc('tune.nGatesWaiting', '，{n} 個 gate 在等', { n: held.length }) : '') + '">' + FK_BELL + '<span class="fkn">' + (n ? n : '') + '</span></button>';
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
                + '<button type="button" class="go" data-answer' + (got.missing ? ' disabled' : '') + '>' + loc('tune.submitAnswer', '送出答案') + '</button></div>'
                + '<div class="pgr" role="status" aria-live="polite"></div>'
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

    // ---- the project page, again: its TODO panel (`todoPanelHtml`) ---------
    // The approved mockup's three blocks — todo-head, todo-open, todo-done
    // (.fankeel/build/2026-09-29-todo-files/mockup.html). `t` is one `todos` row
    // off the data file; `sessions` is `S.sessions`, which says whether this
    // machine has a done entry's session to link.
    var TODO_STATES = [['ready', 'Ready'], ['decision', 'Needs a decision'], ['blocked', 'Blocked'], ['watch', 'Watch']];
    function todoGloss(state) {
        if (state === 'ready') return loc('proj.todoReadyGloss', '只等人動手');
        if (state === 'decision') return loc('proj.todoDecisionGloss', '等人決定要怎麼改');
        if (state === 'blocked') return loc('proj.todoBlockedGloss', '等一個 session 查得到的條件');
        return loc('proj.todoWatchGloss', '等一件只有碰上的人才知道的事');
    }
    function todoChip(label) {
        return label ? '<span class="chip td-lb">' + esc(label) + '</span>'
            : '<span class="td-lb td-nolb" aria-label="' + loc('proj.todoNoLabel', '沒有 label') + '"></span>';
    }
    function todoPanelHtml(t, sessions, doneOpen) {
        if (t && t.mode === 'error') {
            return '<section class="panel td" id="todo">'
                + '<div class="h2" data-block="todo-head">TODO</div>'
                + '<p class="note">' + loc('proj.todoReadError', '無法讀取 TODO：{msg}', { msg: esc(t.error) }) + '</p>'
                + '</section>';
        }
        if (!t || (!t.open.length && !t.done.length)) return '';
        var known = {};
        (sessions || []).forEach(function (s) { known[s.id] = true; });
        var md = function (s) { return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>'); };
        var open = TODO_STATES.map(function (st) {
            var list = t.open.filter(function (e) { return e.state === st[0]; });
            if (!list.length) return '';
            var timed = st[0] === 'blocked' || st[0] === 'watch', prev = null;
            return '<div class="rgh td-grp" data-st="' + st[0] + '"><b class="mono">' + st[1] + '</b><span class="mute">'
                + loc('proj.todoNRows', '{n} 筆 · {g}', { n: list.length, g: todoGloss(st[0]) }) + '</span></div>'
                + '<ul class="td-rows' + (timed ? ' timed' : '') + '">' + list.map(function (e) {
                    var rep = timed && e.condition === prev;
                    prev = timed ? e.condition : null;
                    return '<li class="td-row">' + todoChip(e.label) + '<span class="td-t">' + esc(e.title) + '</span>'
                        + '<span class="td-d" title="' + esc(e.description) + '">' + md(e.description) + '</span>'
                        + (timed ? '<span class="td-tm' + (rep ? ' rep' : '') + '" title="' + esc(e.condition || '') + '">' + esc(e.condition || '') + '</span>'
                            + '<span class="td-st" title="stamp ' + esc(e.stamp || '') + '">' + esc(String(e.stamp || '').slice(5)) + '</span>' : '')
                        + '</li>';
                }).join('') + '</ul>';
        }).join('');
        // The done list keeps its newest ten until 展開全部 is pressed
        // (station-9: it scrolled too long); `doneOpen` is the project page's
        // `view.tdOpen`. The keel look draws it as the verify frame's evidence
        // table (the k-only column heads) and the fold as the plan frame's cut.
        var NEWEST = 10, all = t.done.length, shut = all > NEWEST && !doneOpen;
        var doneRow = function (e, fold) {
            return '<li class="td-row' + (fold ? ' td-fold' : '') + '">' + todoChip(e.label) + '<span class="td-t">' + esc(e.title) + '</span>'
                + '<span class="td-at mono">' + esc(e.at) + '</span><span class="td-dp mono" data-dp="' + esc(e.disposition) + '">' + esc(e.disposition) + '</span>'
                + (e.session && known[e.session]
                    ? '<a class="td-rf mono" href="' + sessionHash(e.session) + '" title="' + loc('proj.todoOpenSession', '開啟 session {id}', { id: esc(e.session) }) + '">session ' + esc(e.session.slice(0, 8)) + '</a>'
                    : '<span class="td-rf mono muted" title="' + loc('proj.todoNoSessionHere', '這台機器沒有這個 session；commit {sha}', { sha: esc(e.sha) }) + '">sha ' + esc(String(e.sha).slice(0, 7)) + '</span>')
                + '</li>';
        };
        var doneHead = '<li class="td-row td-hd k-only" aria-hidden="true"><span class="td-lb">' + loc('proj.todoColLabel', '標籤') + '</span>'
            + '<span class="td-t">' + loc('proj.todoColEntry', '條目') + '</span><span class="td-at">' + loc('proj.todoColAt', '完成於') + '</span>'
            + '<span class="td-dp">' + loc('proj.todoColDisposition', '處置') + '</span><span class="td-rf">' + loc('proj.todoColRef', '出處') + '</span></li>';
        var more = all <= NEWEST ? '' : '<div class="td-more"><button type="button" class="btn td-mb" data-tdmore="' + (shut ? '1' : '0') + '" aria-expanded="' + String(!shut) + '" aria-controls="donel">' + icon('chev')
            + (shut ? loc('proj.todoShowAll', '展開全部（{n}）', { n: all }) : loc('proj.todoFoldBack', '收起，只留最新 {n} 筆', { n: NEWEST })) + '</button><span class="muted">'
            + (shut ? loc('proj.todoNMore', '還有 {n} 筆，{from} 到 {to}', { n: all - NEWEST, from: esc(t.done[NEWEST].at), to: esc(t.done[all - 1].at) })
                : loc('proj.todoFoldNote', '第 {n} 筆起是展開後才出現的', { n: NEWEST + 1 })) + '</span></div>';
        var done = !all ? '' : '<div class="rgh td-grp"><b>' + loc('proj.todoDone', '已完成') + '</b><span class="mute">'
            + loc('proj.todoDoneNewest', '{n} 筆，最新在上', { n: all }) + (shut ? ' · ' + loc('proj.todoShowingN', '顯示最新 {n} 筆', { n: NEWEST }) : '') + '</span></div>'
            + '<ul class="td-rows donel" id="donel">' + doneHead + (shut ? t.done.slice(0, NEWEST) : t.done).map(function (e, i) {
                return (i === NEWEST ? '<li class="td-cut k-only" aria-hidden="true"><span>' + loc('proj.todoCut', '第 {n} 筆起，展開後才出現', { n: NEWEST + 1 }) + '</span></li>' : '')
                    + doneRow(e, i === NEWEST);
            }).join('') + '</ul>' + more
            + '<p class="note">' + loc('proj.todoSessionNote', 'session 只在跑過它的那台機器上找得到；找不到時列出關掉它的 commit。') + '</p>';
        return '<section class="panel td" id="todo">'
            + '<div class="h2" data-block="todo-head">TODO <small><span class="num">' + loc('proj.todoOpenN', '未完成 {n}', { n: t.open.length }) + '</span>'
            + (t.mode === 'folder' ? ' · <span class="num">' + loc('proj.todoDoneN', '已完成 {n}', { n: t.done.length }) + '</span>' : '') + '</small>'
            + '<span class="td-src mono muted">' + esc(t.mode === 'folder' ? t.folder + '/' : 'TODO.md') + '</span></div>'
            + '<div data-block="todo-open">' + open + '</div>'
            + (done ? '<div class="td-done" data-block="todo-done">' + done + '</div>' : '')
            + '</section>';
    }
    // ---- tune: a block changed, continued: what the tests import -----------

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            todoPanelHtml: todoPanelHtml,
            tokens: tokens, mins: mins, hours: hours, usd: usd, ago: ago, day: day,
            stamp: stamp, esc: esc, cost: cost, labels: labels, delta: delta, match: match,
            statePill: statePill, clearStaleControl: clearStaleControl,
            openSections: openSections, downsample: downsample, lineChart: lineChart,
            riseText: riseText, ctxSection: ctxSection, seqHtml: seqHtml, orderSection: orderSection,
            dur: dur, tasksHtml: tasksHtml, dispatchHtml: dispatchHtml, replayHtml: replayHtml, segmentsOf: segmentsOf, splitHtml: splitHtml,
            splitCount: splitCount,
            pendingGateHtml: pendingGateHtml, pgAnswers: pgAnswers, todoEntry: todoEntry, riseTodo: riseTodo, backTodo: backTodo, todoSpot: todoSpot,
            figures: figures, compareHtml: compareHtml,
            routeGroups: routeGroups, routeLedger: routeLedger,
            localDay: localDay, lastDays: lastDays, parseHash: parseHash, family: family, modelKey: modelKey, modelLabel: modelLabel, sessionTotals: sessionTotals,
            windowTotals: windowTotals, dayBars: dayBars, projectRows: projectRows, kpiHtml: kpiHtml,
            histSvg: histSvg, legendHtml: legendHtml, projectsHtml: projectsHtml, recentHtml: recentHtml,
            dayStart: dayStart, projectHead: projectHead, sessionPoints: sessionPoints, projectChart: projectChart,
            projectSessionsHtml: projectSessionsHtml,
            timelineModel: timelineModel, timelineSvg: timelineSvg, costModel: costModel, costHtml: costHtml,
            sessionHeadHtml: sessionHeadHtml, tabsHtml: tabsHtml, serveLost: serveLost,
            heroEyebrow: heroEyebrow, effortChip: effortChip, docsCardHtml: docsCardHtml, docsSearchHtml: docsSearchHtml, tourPage: tourPage,
            railHtml: railHtml, liveTag: liveTag,
            navHtml: navHtml, navCounts: navCounts, recentRows: recentRows, nowHtml: nowHtml,
            WIZ_STEPS: WIZ_STEPS, wizLoad: wizLoad, wizApply: wizApply, wizChanges: wizChanges, wizHtml: wizHtml,
            segTip: segTip,
            tk: tk,
            stageShare: stageShare, costShareHtml: costShareHtml, subtabsHtml: subtabsHtml,
            dashLive: dashLive, dashGate: dashGate, liveSubsHtml: liveSubsHtml, dashSpend: dashSpend, dashRecent: dashRecent, dashPage: dashPage,
            dashTodo: dashTodo, dashOrder: dashOrder, dashChooserHtml: dashChooserHtml,
            NAV_TREE: NAV_TREE,
            tuneOpen: tuneOpen, tuneEvents: tuneEvents, toastText: toastText, floatHtml: floatHtml, gateCountdownHtml: gateCountdownHtml, noteHtml: noteHtml, floatNotes: floatNotes, clock: gateClock,
            changedParts: changedParts, seenHtml: seenHtml,
        };
    }
    if (!doc) return;
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
    var VIEWS = {}, CRUMBS = {};
    var rows = function () {
        return S.sessions.filter(function (s) { return match(s, f); });
    };

    // A seven-stage session and a three-stage one averaged together describe
    // neither, so every cross-session figure is taken inside one route: a
    // class's route under the class's name, a hand-written route under its
    // own stages, and no average crosses two groups. A session that stepped
    // back — `backtracks`, the count the detail panel's stage order prints —
    // is counted in its group but kept out of its averages, on a row of its
    // own.
    function routeName(route, classes) {
        var key = (route || []).join('>');
        for (var k in classes || {}) if ((classes[k] || []).join('>') === key) return k;
        return (route || []).join(' → ') || loc('tune.noRoute', '（沒有 route）');
    }
    function routeGroups(R, classes) {
        var by = {}, order = [];
        R.forEach(function (s) {
            var name = routeName(s.route, classes);
            if (!by[name]) {
                by[name] = { name: name, route: s.route || [], n: 0, clean: 0, backN: 0, backtracks: 0, stages: {},
                    back: { ms: 0, wait: 0, burn: 0, usd: 0 } };
                order.push(name);
            }
            var g = by[name];
            g.n++;
            if (s.backtracks > 0) {
                g.backN++;
                g.backtracks += s.backtracks;
                s.stages.forEach(function (w) {
                    g.back.ms += Math.max(w.to - w.from, 0);
                    g.back.wait += w.waited || 0;
                    g.back.burn += w.burn || 0;
                    g.back.usd += w.usd || 0;
                });
                return;
            }
            g.clean++;
            s.stages.forEach(function (w) {
                var x = g.stages[w.stage] || (g.stages[w.stage] = { n: 0, ms: 0, wait: 0, burn: 0, usd: 0 });
                x.n++;
                x.ms += Math.max(w.to - w.from, 0);
                x.wait += w.waited || 0;
                x.burn += w.burn || 0;
                x.usd += w.usd || 0;
            });
        });
        return order.map(function (k) { return by[k]; }).sort(function (a, b) { return b.n - a.n; });
    }
    // One table per route group; each stage row a per-session average over the
    // sessions in the group that reached the stage without stepping back, the
    // 有倒退 row the same averages over the ones that did. Nothing here is a
    // total, so nothing here has rows to add up to.
    function routeLedger(R) {
        var groups = routeGroups(R, S.classes);
        if (!groups.length) return '<div class="empty">' + loc('tune.noSessionsInFilter', '這個篩選下沒有 session') + '</div>';
        return groups.map(function (g) {
            var names = (g.route.length ? g.route : ROUTE).filter(function (k) { return g.stages[k]; });
            var per = names.map(function (k) { return (g.stages[k].ms + g.stages[k].wait) / g.stages[k].n; });
            if (g.backN) per.push((g.back.ms + g.back.wait) / g.backN);
            var max = Math.max.apply(null, per.concat([0])) || 1;
            var line = function (label, x, n, colour) {
                var ms = x.ms / n, wait = x.wait / n;
                return '<tr><td>' + label + '</td><td><div class="mini"><span style="width:' + (ms / max * 100)
                    + '%;background:' + colour + '"></span><span style="width:' + (wait / max * 100) + '%;background:'
                    + colour + '38"></span></div><div class="mute" style="font-size:10.5px;margin-top:4px">'
                    + loc('tune.workedWaitedN', '{a} 做事 · {b} 等你 · {n} 個', { a: hours(ms), b: hours(wait), n: n }) + '</div></td>'
                    + '<td class="r num mute">' + tokens(Math.round(x.burn / n)) + '</td>'
                    + '<td class="r num">' + usd(x.usd / n) + '</td>'
                    + '<td class="r num" style="color:' + (wait > ms ? 'var(--dn)' : 'var(--mute)') + '">'
                    + Math.round(wait / (ms + wait || 1) * 100) + '%</td></tr>';
            };
            return '<div class="rgh"><b>' + esc(g.name) + '</b><span class="mute">' + loc('tune.nSessionsBacktrack', '{n} 個 session · 有倒退 {backN} 個、倒退 {backT} 次', { n: g.n, backN: g.backN, backT: g.backtracks }) + '</span></div>'
                + '<table><colgroup><col style="width:96px"><col><col style="width:64px"><col style="width:64px">'
                + '<col style="width:52px"></colgroup><thead><tr><th>' + loc('tune.thStage', '階段') + '</th><th>' + loc('tune.thAvgWorkWait', '平均：做事 / 等你') + '</th>'
                + '<th class="r">context</th><th class="r">' + loc('tune.thCost', '花費') + '</th><th class="r">' + loc('tune.thWait', '等待') + '</th></tr></thead><tbody>'
                + names.map(function (k) {
                    return line('<span class="chip" style="background:' + STAGE_C[k] + '1f;border-color:transparent;color:'
                        + STAGE_C[k] + ';font-weight:600">' + k + '</span>', g.stages[k], g.stages[k].n, STAGE_C[k]);
                }).join('')
                + (g.backN ? line('<span class="chip" style="color:var(--dn);border-color:var(--dn)">' + loc('tune.hasBacktrack', '有倒退') + '</span>',
                    g.back, g.backN, 'var(--dn)') : '')
                + '</tbody></table>';
        }).join('');
    }
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
    function livePage() {
        return (isFinite(S.cleared) ? '<p class="cleared">cleared ' + S.cleared + ' stale rows</p>' : '')
            + nowHtml(S.projects, homeRows(), subtabsHtml('live'));
    }
    // ---- 儀表板 (`#/`): four cards, each read off the rows its full page reads
    // — `homeRows()` through the same filters — so a card's number is the
    // number that page shows.
    function msOf(t) { return typeof t === 'number' ? t : Date.parse(t); }
    // Each card writes its own `data-block` literally, so the tune proxy and
    // tests/station-dispatch-view.test.js can find it in this file.
    function dashHead(ico, title, href) {
        return '<div class="dcard-h">' + icon(ico) + '<b>' + title + '</b><span class="spacer"></span>'
            + '<a class="dmore" href="' + href + '">' + loc('dash.seeAll', '查看全部 →') + '</a></div>';
    }
    function dashRowName(s) { return esc(shortLabel(NAMES[s.pkey] || s.pkey)); }
    function dashLive(R) {
        var live = R.filter(function (s) { return s.state === 'live'; });
        return '<section class="dcard" data-block="dash-live">' + dashHead('now', loc('dash.inProgress', '進行中'), '#/live')
            + '<div class="dbig">' + live.length + '<small>' + loc('dash.nLiveSessions', '個 live session') + '</small></div>'
            + (live.length ? '<div class="dlist">' + live.map(function (s) {
                return '<a class="drow" href="' + sessionHash(s.id) + '"><span class="dp">' + dashRowName(s) + '</span>'
                    + '<span class="dt">' + esc(s.task || loc('dash.unnamed', '（未命名）')) + '</span>' + routeDots(s, true)
                    + '<span class="dr mono">' + mins(Date.now() - msOf(s.started)) + '</span></a>';
            }).join('') + '</div>' : '<p class="dnone">' + loc('dash.noneInProgress', '沒有進行中的 session') + '</p>') + '</section>';
    }
    // A wait in the card's own words: `12 分`, `1 時 5 分`, `2 時`.
    function waitFor(ms) {
        if (!isFinite(ms)) return '—';
        var m = Math.max(0, Math.floor(ms / 60000));
        if (m < 60) return loc('dash.mMins', '{m} 分', { m: m });
        return loc('dash.hHours', '{h} 時', { h: Math.floor(m / 60) }) + (m % 60 ? ' ' + loc('dash.mMins', '{m} 分', { m: m % 60 }) : '');
    }
    // Waiting is what `pendingGateHtml` answers: a pending file with questions.
    // The wait runs from `gateAt`, stamped when the question went out
    // (`gateOpen` in lib/registry.js), else the pending file's `at`, else the
    // session's last registry write. `at` is the clock a test hands in.
    function dashGate(R, at) {
        var now = isFinite(at) ? at : S.serve ? Date.now() : NOW;
        var rows = R.filter(function (s) { return s.pending && s.pending.questions && s.pending.questions.length; });
        return '<section class="dcard" data-block="waiting-card">' + dashHead('gate', loc('dash.waitingOnYou', '等你回答'), '#/live')
            + '<div class="dbig' + (rows.length ? ' warn' : '') + '">' + rows.length + '<small>' + loc('dash.gatesWaiting', '個 gate 在等')
            + (rows.length ? '<span class="dfrom">' + loc('dash.sinceQuestionSent', '從問題送出那一刻算起') + '</span>' : '') + '</small></div>'
            + (rows.length ? '<div class="dlist">' + rows.map(function (s) {
                var since = msOf(s.gateAt || s.pending.at || s.updated), q = s.pending.questions[0];
                var left = isFinite(s.pending.until) ? loc('dash.leftT', '，還剩 {t}', { t: waitFor(Math.max(0, s.pending.until - now)) }) : '';
                return '<a class="drow" href="' + sessionHash(s.id) + '"><span class="dp">' + dashRowName(s) + '</span>'
                    + (s.stage ? '<span class="chip dstage"><i class="sw" style="background:var(--st-' + esc(s.stage) + ')"></i>' + esc(s.stage) + '</span>' : '')
                    + '<span class="dt">' + esc(q.header || q.question || s.task || '') + '</span>'
                    + '<span class="dw" title="' + (isFinite(since) ? esc(loc('dash.questionSentAt', '問題 {t} 送出{left}', { t: clock(since), left: left })) : '') + '">' + loc('dash.waitedT', '等了 {t}', { t: waitFor(now - since) }) + '</span></a>';
            }).join('') + '</div>' : '<p class="dnone">' + loc('dash.noGatesWaiting', '沒有在等你的 gate') + '</p>') + '</section>';
    }
    // The 近 30 天 chart's own bars, summed per day, drawn without axes.
    function dashSpend(R) {
        var list = dayBars(R, 'usd', 'project', DAYS).days, mx = Math.max.apply(null, list.map(function (b) { return b.total; }).concat([0])) || 1;
        var W = 300, H = 56, bw = W / list.length, tot = windowTotals(R, DAYS).usd;
        var svg = '<svg class="dspark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="' + loc('dash.dailyCostLast30d', '近 30 天每日花費') + '">'
            + list.map(function (b, i) {
                var h = b.total ? Math.max(2, b.total / mx * (H - 2)) : 0;
                return '<rect x="' + (i * bw + 1).toFixed(1) + '" y="' + (H - h).toFixed(1) + '" width="' + Math.max(1, bw - 2).toFixed(1)
                    + '" height="' + h.toFixed(1) + '" rx="1"' + (i === list.length - 1 ? ' class="today"' : '')
                    + '><title>' + b.day + ' ' + usd(b.total) + '</title></rect>';
            }).join('') + '<line x1="0" x2="' + W + '" y1="' + (H - .5) + '" y2="' + (H - .5) + '"/></svg>';
        var at = function (i) { var b = list[list.length - i]; return b ? usd(b.total) : '—'; };
        return '<section class="dcard" data-block="dash-spend">' + dashHead('spend', loc('dash.last30dCost', '近 30 天花費'), '#/days')
            + '<div class="dbig">' + (tot ? usd(tot) : '$0') + '</div>' + svg
            + '<div class="dkv"><span>' + loc('dash.today', '今天') + ' <b>' + at(1) + '</b></span><span>' + loc('dash.yesterday', '昨天') + ' <b>' + at(2) + '</b></span></div></section>';
    }
    function dashRecent(R) {
        var list = recentRows(R, DAYS).slice(0, 5);
        return '<section class="dcard" data-block="dash-recent">' + dashHead('sessions', loc('dash.recentSessions', '最近 sessions'), '#/sessions')
            + (list.length ? '<div class="dlist">' + list.map(function (s) {
                return '<a class="drow" href="' + sessionHash(s.id) + '"><span class="dp">' + dashRowName(s) + '</span>'
                    + '<span class="dt">' + esc(s.task || loc('dash.unnamed', '（未命名）')) + '</span><span class="ds mono">' + esc(s.stage || '—') + '</span>'
                    + '<span class="dc mono">' + usd(sessionTotals(s).usd) + '</span><span class="dr">' + ago(s.updated) + '</span></a>';
            }).join('') + '</div>' : '<p class="dnone">' + loc('dash.noneLast30d', '近 30 天沒有 session') + '</p>') + '</section>';
    }
    // dash-todo (station-10): every project's `todos` rows off the data file,
    // the same rows the project page's TODO panel reads, so its Ready count is
    // that panel's. One row per project with a Ready entry, most first, its
    // first three titles; a project with none is named in the foot line, and a
    // list whose entries carry no state (a TODO.md) is counted there, not listed.
    function dashTodo(projects) {
        var SHOWN = 3, lists = [];
        (projects || []).forEach(function (p) {
            (p.todos || []).forEach(function (t) { if (t && t.open) lists.push(t); });
        });
        var rows = lists.filter(function (t) { return t.open.some(function (x) { return x.state; }); }).map(function (t) {
            var n = function (st) { return t.open.filter(function (x) { return x.state === st; }).length; };
            return { t: t, ready: t.open.filter(function (x) { return x.state === 'ready'; }), decision: n('decision'), blocked: n('blocked'), watch: n('watch') };
        });
        var unstated = lists.length - rows.length;
        var ready = rows.filter(function (r) { return r.ready.length; }).sort(function (a, b) { return b.ready.length - a.ready.length; });
        var quiet = rows.filter(function (r) { return !r.ready.length; });
        var total = ready.reduce(function (a, r) { return a + r.ready.length; }, 0);
        var side = function (r) { return [['decision', r.decision], ['blocked', r.blocked], ['watch', r.watch]].filter(function (x) { return x[1]; }); };
        var sep = loc('dash.clauseSep', '；');
        var foot = quiet.map(function (r) {
            return loc('dash.noReadyIn', '{p} 沒有 Ready（{rest}）', { p: esc(shortLabel(r.t.pkey)), rest: side(r).map(function (x) { return x[0] + ' ' + x[1]; }).join(loc('dash.listSep', '、')) });
        }).join(sep) + (unstated ? (quiet.length ? sep : '') + loc('dash.nUnstated', '另有 {n} 份 TODO 沒標狀態，不列', { n: unstated }) : '');
        return '<section class="dcard" data-block="dash-todo"><div class="dcard-h">' + icon('check') + '<b>' + loc('dash.readyToStart', '可以開工') + '</b></div>'
            + '<div class="dbig">' + total + '<small>' + loc('dash.nReadyInP', '筆 Ready，分在 {p} 個專案', { p: ready.length }) + '</small></div>'
            + (ready.length ? '<div class="dlist">' + ready.map(function (r) {
                var more = r.ready.length - SHOWN;
                return '<a class="drow trow" href="' + projectHash(r.t.pkey) + '" title="' + esc(loc('dash.openTodoOf', '開啟 {p} 的 TODO', { p: shortLabel(r.t.pkey) })) + '">'
                    + '<span class="trh"><span class="dp">' + esc(shortLabel(r.t.pkey)) + '</span><span class="tpill"><span class="tn">' + r.ready.length + '</span><span class="tnl">Ready</span></span>'
                    + '<span class="spacer"></span>' + side(r).map(function (x) { return '<span class="tq" data-st="' + x[0] + '">' + x[0] + ' <b>' + x[1] + '</b></span>'; }).join('') + '</span>'
                    + '<ul class="trl">' + r.ready.slice(0, SHOWN).map(function (x) {
                        var plain = function (s) { return String(s == null ? '' : s).split('**').join(''); };
                        return '<li>' + (x.label ? '<span class="tlb">' + esc(plain(x.label)) + '</span>' : '') + esc(plain(x.title)) + '</li>';
                    }).join('') + (more > 0 ? '<li class="tmore">' + loc('dash.nMoreTodo', '還有 {n} 筆', { n: more }) + '</li>' : '') + '</ul></a>';
            }).join('') + '</div>' : '<p class="dnone">' + loc('dash.noReady', '沒有 Ready 的條目') + '</p>')
            + (foot ? '<p class="dnone tfoot">' + foot + '</p>' : '') + '</section>';
    }
    // dash-chooser (station-11): which cards show, in what order. `station.dash`
    // in localStorage holds `{"order": [...], "off": [...]}`; an id this page
    // does not know is dropped, one the stored order lacks is appended shown,
    // and anything unreadable is the default: today's four cards and dash-todo.
    function dashCards() { return ['dash-live', 'waiting-card', 'dash-todo', 'dash-spend', 'dash-recent']; }
    function dashOrder(raw) {
        var saved = null;
        try { saved = JSON.parse(raw); } catch (e) { saved = null; }
        var order = saved && Array.isArray(saved.order) ? saved.order : [];
        var off = saved && Array.isArray(saved.off) ? saved.off : [];
        var known = dashCards();
        var ids = order.filter(function (id, i) { return known.indexOf(id) >= 0 && order.indexOf(id) === i; });
        known.forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); });
        return ids.map(function (id) { return { id: id, on: off.indexOf(id) < 0 }; });
    }
    function dashIsDefault(list) {
        return list.map(function (c) { return c.id + (c.on ? '' : '-'); }).join() === dashCards().join();
    }
    function dashChooserHtml(list) {
        var names = {
            'dash-live': [loc('dash.inProgress', '進行中'), loc('dash.cardLiveHint', '正在跑的 session 和它們走到哪一站')],
            'waiting-card': [loc('dash.waitingOnYou', '等你回答'), loc('dash.cardGateHint', '停在 gate、等你按下去的問題')],
            'dash-todo': [loc('dash.readyToStart', '可以開工'), loc('dash.cardTodoHint', '各專案 TODO 裡 Ready 的條目')],
            'dash-spend': [loc('dash.last30dCost', '近 30 天花費'), loc('dash.cardSpendHint', '每日花費長條、今天和昨天')],
            'dash-recent': [loc('dash.recentSessions', '最近 sessions'), loc('dash.cardRecentHint', '最近五個 session 的階段與花費')],
        };
        var same = dashIsDefault(list);
        return '<section class="panel dchooser" id="dchooser" data-block="dash-chooser" aria-labelledby="dchooser-h">'
            + '<div class="dch-h"><b id="dchooser-h">' + loc('dash.chooserTitle', '儀表板上的卡片') + '</b><span class="muted">'
            + loc('dash.chooserHint', '勾選要顯示的卡片，用 ↑ ↓ 排順序。只存在這個瀏覽器（<code>station.dash</code>）。') + '</span></div>'
            + '<ol class="dch-list">' + list.map(function (c, i) {
                var n = names[c.id];
                return '<li class="dch-row" data-card="' + c.id + '"><span class="dch-n">' + (i + 1) + '</span>'
                    + '<label class="dch-lb"><input type="checkbox"' + (c.on ? ' checked' : '') + ' data-dchshow="' + c.id + '"><span><b>' + n[0] + '</b><small>' + n[1] + '</small></span></label>'
                    + '<span class="dch-mv"><button type="button" class="dch-b" data-dchmv="-1" data-card="' + c.id + '" data-key="dch-up-' + c.id + '" aria-label="' + esc(loc('dash.moveUp', '{c} 上移', { c: n[0] })) + '"' + (i === 0 ? ' disabled' : '') + '>' + icon('chev') + '</button>'
                    + '<button type="button" class="dch-b" data-dchmv="1" data-card="' + c.id + '" data-key="dch-down-' + c.id + '" aria-label="' + esc(loc('dash.moveDown', '{c} 下移', { c: n[0] })) + '"' + (i === list.length - 1 ? ' disabled' : '') + '>' + icon('chev') + '</button></span></li>';
            }).join('') + '</ol>'
            + '<div class="dch-f"><span class="muted">' + (same ? loc('dash.chooserIsDefault', '目前是預設') : loc('dash.chooserNotDefault', '跟預設不同')) + '</span><span class="spacer"></span>'
            + '<button type="button" class="btn" data-dchreset="1"' + (same ? ' disabled' : '') + '>' + loc('dash.chooserReset', '還原預設') + '</button>'
            + '<button type="button" class="btn go" data-dchdone="1">' + loc('dash.chooserDone', '完成') + '</button></div></section>';
    }
    function dashPage() {
        var R = homeRows(), list = dashOrder(stored('station.dash'));
        var card = {
            'dash-live': dashLive, 'waiting-card': function (rows) { return dashGate(rows); }, 'dash-todo': function () { return dashTodo(S.projects); },
            'dash-spend': dashSpend, 'dash-recent': dashRecent,
        };
        return '<div class="phead"><h1>' + icon('dash') + loc('dash.dashboard', '儀表板') + '</h1><span class="spacer"></span>'
            + '<button type="button" class="btn' + (view.dchOpen ? ' on' : '') + '" id="dchtog" data-dchtog="1" data-key="dchtog" aria-expanded="' + String(!!view.dchOpen) + '" aria-controls="dchooser">'
            + icon('settings') + loc('dash.chooserOpen', '調整卡片') + '</button></div>'
            + (view.dchOpen ? dashChooserHtml(list) : '')
            + '<div class="dash" data-block="dashboard">' + list.filter(function (c) { return c.on; }).map(function (c) { return card[c.id](R); }).join('') + '</div>';
    }
    // The chooser's presses: 調整卡片 and 完成 open and shut it, ↑ ↓ move a
    // card, 還原預設 clears `station.dash`, a checkbox shows or hides a card.
    // The default order is stored as no key at all.
    view.dchOpen = false;
    function dashSave(list) {
        store('station.dash', dashIsDefault(list) ? null : JSON.stringify({
            order: list.map(function (c) { return c.id; }),
            off: list.filter(function (c) { return !c.on; }).map(function (c) { return c.id; }),
        }));
    }
    doc.addEventListener('click', function (e) {
        var b = e.target && e.target.closest ? e.target.closest('[data-dchtog], [data-dchmv], [data-dchreset], [data-dchdone]') : null;
        if (!b) return;
        if (b.hasAttribute('data-dchtog')) view.dchOpen = !view.dchOpen;
        else if (b.hasAttribute('data-dchdone')) view.dchOpen = false;
        else if (b.hasAttribute('data-dchreset')) store('station.dash', null);
        else {
            var list = dashOrder(stored('station.dash'));
            var i = list.map(function (c) { return c.id; }).indexOf(b.getAttribute('data-card')), j = i + Number(b.getAttribute('data-dchmv'));
            if (i < 0 || j < 0 || j >= list.length) return;
            list.splice(j, 0, list.splice(i, 1)[0]);
            dashSave(list);
        }
        repaint();
    });
    doc.addEventListener('change', function (e) {
        var id = e.target && e.target.getAttribute ? e.target.getAttribute('data-dchshow') : null;
        if (!id) return;
        var list = dashOrder(stored('station.dash'));
        list.forEach(function (c) { if (c.id === id) c.on = !!e.target.checked; });
        dashSave(list);
        repaint();
    });
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
        var sel = r.day && DAYS.indexOf(r.day) >= 0 ? r.day : null;
        var o = homeOpts(sel);
        o.off = chartOff[view.dim] || {};
        o.panel = chartPanel;
        var all = dayBars(R, view.metric, view.dim, DAYS), bars = visibleBars(all, o);
        chartBars = bars;
        chartOpts = o;
        return subtabsHtml('days') + '<section class="panel hero" data-block="days"><div class="hero-top"><div class="hero-title"><div class="eyebrow">' + icon('days')
            + heroEyebrow(frozenAt) + '</div>'
            + '<h1><b>' + DAYS[0].slice(5) + '</b> — <b>' + TODAY.slice(5) + '</b></h1></div>'
            + kpiHtml(windowTotals(R, DAYS), windowTotals(R, PREV)) + '</div>'
            + '<div class="controls"><div class="ctlgrp"><label>' + loc('dash.barHeight', '長條高度') + '</label>'
            + segHtml('metric', [['tokens', 'token'], ['usd', loc('dash.cost', '花費')], ['time', loc('dash.time', '時間')]], view.metric) + '</div>'
            + '<div class="ctlgrp"><label>' + loc('dash.splitBy', '分段') + '</label>'
            + segHtml('dim', [['model', loc('dash.byModel', '依 model')], ['project', loc('dash.byProject', '依專案')], ['stage', loc('dash.byStage', '依 stage')], ['who', loc('dash.mainVsAgent', '主 session 對 agent')],
                ['version', loc('dash.byVersion', '依版本')], ['kind', loc('dash.byKind', '依成分')]],
                view.dim, view.metric === 'time' ? { model: loc('dash.noTimeByModel', '時間沒有 model 可分'), kind: loc('dash.noTimeByKind', '時間沒有成分可分') } : null) + '</div></div>'
            // The legend has a strip of its own, one line high: however many
            // series a dim has, the switches above and the chart below stay
            // where they are. What does not fit scrolls; 篩選 lists everything.
            + '<div class="lstrip"><div class="legend">' + legendHtml(all, o) + '</div>' + filterHtml(all, o) + '</div>'
            + '<div class="chart">' + histSvg(bars, o) + '</div></section>';
    }
    function sessionsPage() {
        return subtabsHtml('sessions') + '<section class="panel" data-block="sessions">' + recentHtml(recentRows(homeRows(), DAYS), homeOpts(null)) + '</section>';
    }
    function projectsPage() {
        return subtabsHtml('projects') + '<section class="panel" data-block="projects">' + projectsHtml(projectRows(homeRows(), DAYS), homeOpts(null)) + '</section>';
    }
    view.dsx = { q: '', res: null };
    function docsPage() {
        var list = [].concat.apply([], S.projects.map(function (p) { return p.docs || []; }));
        var dsx = docsSearchHtml(view.dsx, Boolean(S.serve));
        return '<div data-block="docs">' + (list.length ? docsCardHtml(list, Object.assign(homeOpts(null), { search: dsx }))
            : '<section class="panel docs"><div class="h2">' + loc('dash.docs', '文件') + '</div>' + dsx
                + '<p class="mute">' + loc('dash.noProjectDocsYet', '還沒有專案生成 <span class="mono">.fankeel/map.md</span>') + '</p></section>') + '</div>';
    }
    view.pMetric = 'usd';
    view.compare = '';
    // A session counts on this page when it started inside the thirty days or
    // spent inside them.
    function inWindow(s) {
        return Date.parse(s.started) >= dayStart(DAYS[0]) || (s.days || []).some(function (x) { return DAYS.indexOf(x.day) >= 0; });
    }
    function projectPage(r) {
        var all = S.sessions.filter(function (s) { return s.pkey === r.pkey; });
        if (!all.length) return '<section class="panel"><p class="note">' + loc('dash.noProjectOnPage', '這頁上沒有專案 {p}', { p: esc(r.pkey) }) + '</p></section>';
        var R = homeRows(), mine = R.filter(function (s) { return s.pkey === r.pkey; });
        var head = projectHead(R, r.pkey, DAYS), t0 = dayStart(DAYS[0]), t1 = dayStart(TODAY) + 864e5;
        if (view.compare === r.pkey) view.compare = '';
        var series = [r.pkey].concat(view.compare ? [view.compare] : []).map(function (k) {
            return { pkey: k, name: NAMES[k] || k, colour: colorOf('project', k, PKEYS),
                points: sessionPoints(R.filter(function (s) { return s.pkey === k; }), view.pMetric, t0, t1) };
        });
        var others = PKEYS.filter(function (k) { return k !== r.pkey; });
        var list = mine.filter(inWindow).sort(function (a, b) { return Date.parse(b.started) - Date.parse(a.started); });
        var ro = function (l, v) { return '<div class="ro"><div class="l">' + l + '</div><div class="v">' + v + '</div></div>'; };
        return '<section class="panel"><div class="hero-top"><div><div class="eyebrow">' + loc('dash.project', '專案') + '</div>'
            + '<h1 class="s-title"><i class="sw" style="background:' + colorOf('project', r.pkey, PKEYS) + '"></i> '
            + esc(NAMES[r.pkey] || r.pkey) + '</h1><div class="mono muted">' + esc(r.pkey) + '</div></div>'
            + '<div class="readouts">' + ro(loc('dash.last30dCost', '近 30 天花費'), usd(head.usd)) + ro('token', tokens(head.tokens))
            + ro(loc('dash.activeTime', 'active 時間'), hours(head.active)) + ro('session', head.n) + '</div></div>'
            + '<div class="controls"><div class="ctlgrp"><label>' + loc('dash.yAxis', '縱軸') + '</label>'
            + segHtml('pMetric', [['tokens', 'token'], ['usd', loc('dash.cost', '花費')]], view.pMetric) + '</div>'
            + (others.length ? '<div class="ctlgrp"><label>' + loc('dash.compareProject', '對照專案') + '</label>' + segHtml('compare', [['', loc('dash.none', '無')]].concat(others.map(function (k) {
                return [k, NAMES[k] || k];
            })), view.compare) + '</div>' : '')
            + '<div class="legend">' + series.map(function (s) {
                return '<span><i class="sw ln" style="background:' + s.colour + '"></i>' + esc(s.name) + ' <span class="muted">'
                    + loc('dash.nItems', '{n} 個', { n: s.points.length }) + '</span></span>';
            }).join('') + '</div></div>'
            + '<div class="chart">' + projectChart(series, { metric: view.pMetric, t0: t0, t1: t1, days: DAYS, today: TODAY }) + '</div>'
            + '<div class="note">' + loc('dash.pointPerSessionHint', '每個點是一個 session，放在它開始的時刻；線依時間先後連接，點一下開啟那個 session。') + '</div></section>'
            + registryNote(all[0].root)
            + '<section class="panel"><div class="h2">Sessions <small>' + loc('dash.last30dNSorted', '近 30 天 {n} 個，最新在上；勾兩列進比較', { n: list.length }) + '</small>'
            + '</div>' + projectSessionsHtml(list, picked) + selbarHtml() + '</section>'
            + '<section class="panel"><div class="h2">' + loc('dash.stagesByRoute', '各 route 的階段') + ' <small>' + loc('dash.thisProjectOnly', '只算這個專案') + '</small></div>' + routeLedger(mine) + '</section>'
            + todoPanelHtml((S.projects || []).reduce(function (hit, p) {
                return hit || (p.todos || []).filter(function (x) { return x.pkey === r.pkey; })[0] || null;
            }, null), S.sessions, !!view.tdOpen);
    }
    VIEWS.project = projectPage;
    CRUMBS.project = function (r) { return [[NAMES[r.pkey] || r.pkey, null]]; };
    // The TODO panel's 已完成 list: 展開全部 / 收起 set `view.tdOpen`, which
    // holds across the 3 s redraw and resets on reload.
    view.tdOpen = false;
    doc.addEventListener('click', function (e) {
        var b = e.target && e.target.closest ? e.target.closest('[data-tdmore]') : null;
        if (!b) return;
        view.tdOpen = b.getAttribute('data-tdmore') === '1';
        repaint();
    });
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
        var by = {}, n = {};
        (s.stages || []).forEach(function (w) { by[w.stage] = w.usd; });
        m.segs.forEach(function (g) { n[g.stage] = (n[g.stage] || 0) + 1; });
        m.segs.forEach(function (g) { if (n[g.stage] === 1 && isFinite(by[g.stage])) g.usd = by[g.stage]; });
        return m;
    }
    function sessionPage(r) {
        var s = S.sessions.filter(function (x) { return x.id === r.id; })[0];
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
        var body = r.tab === 'dispatch' ? (x ? dispatchStagesHtml(L, s.id, hi) + '<div class="det">' + dispatchHtml(x, s, dispatchUi(s)) + '</div>' : detailNote(s))
            : r.tab === 'events' ? (x ? '<div class="det">' + replayHtml(x, view.kinds, s) + '</div>' : detailNote(s))
                : overview;
        return '<section class="panel"><div class="eyebrow">session <span class="mono">' + esc(String(s.id).slice(0, 8)) + '</span> · '
            + '<a href="' + projectHash(s.pkey) + '">' + esc(NAMES[s.pkey] || s.pkey) + '</a> · ' + stamp(Date.parse(s.started)) + '</div>'
            + '<h1 class="s-title">' + esc(s.task || loc('dash.unnamed', '（未命名）')) + '</h1>'
            + '<div class="s-meta">' + statePill(s) + (S.serve ? liveTag(s.state === 'live', polledAt, Date.now()) : '')
            + (s.model ? '<span class="chip"><i class="sw" style="background:var(--m-' + family(s.model) + ')"></i>' + loc('dash.mainSession', '主 session') + ' <span class="mono">'
                + esc(s.model) + '</span></span>' : '') + effortChip(s.effort) + '</div>'
            + railHtml(s, Boolean(S.serve) && s.state === 'live', S.serve ? Date.now() : NOW)
            + sessionHeadHtml(s, x) + '</section>'
            + tabsHtml(s, r.tab, x) + '<section class="panel"' + (r.tab === 'dispatch' ? ' data-block="dispatch"' : '') + '>' + body + '</section>';
    }
    VIEWS.session = sessionPage;
    CRUMBS.session = function (r) {
        var s = S.sessions.filter(function (x) { return x.id === r.id; })[0];
        return s ? [[NAMES[s.pkey] || s.pkey, projectHash(s.pkey)], [s.task || String(s.id).slice(0, 8), null]] : [[r.id, null]];
    };
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
            return '<tr data-id="' + esc(s.id) + '" aria-selected="' + (sel === s.id) + '">'
                + '<td><input type="checkbox" data-cmp="' + esc(s.id) + '" aria-label="' + loc('dash.pickToCompare', '選來比較') + '"'
                + (picked.indexOf(s.id) >= 0 ? ' checked' : '')
                + (s.hasDetail ? '' : ' disabled title="' + loc('dash.noTranscriptToCompare', '沒有 transcript，沒有細節可比') + '"') + '></td>'
                + '<td>' + taskCell(s) + '</td><td>' + stageCell(s) + '</td>'
                + '<td class="r num mute">' + tokens(s.burn) + '</td>'
                + '<td class="r num">' + usd(cost(s)) + '</td>'
                + '<td class="c-state">' + statePill(s) + runningTag(s) + '</td>'
                + '<td class="num mute" style="font-size:11.5px">' + day(s.started) + '</td>'
                + '<td class="num mute" style="font-size:11.5px">' + ago(s.updated) + '</td></tr>';
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
            + (s.unpriced && s.unpriced.length ? ' (' + s.unpriced.length + ' unpriced)' : '')
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
            + sec('s-disp', loc('det.dispatch', '派工'), loc('det.nAgentsCents', '{n} 個 agent · {c}', { n: x.rows.length, c: cents(x.agentCents) }), dispatchHtml(x, s, dispatchUi(s)), open)
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
    // is its `out` time run through the same rule as `lib/detail.js:397`'s
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
        (x.tasks || []).forEach(function (p) {
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
        if (!(x.tasks || []).length && (x.dispatches || []).length > 1) lines.push(loc('det.noTaskTableCannotTell', '這頁沒有任務表：其餘派工是否互不相依，無從判斷'));
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
        if (!list || !list.length) return loc('det.noPlan', '沒有 plan');
        var n = 0, g = 0;
        list.forEach(function (p) { n += p.tasks.length; g += p.groups.length; });
        return loc('det.nTasksGGroups', '{n} 個 · {g} 組', { n: n, g: g });
    }
    // One band per group `plantasks` would dispatch together, its tasks under
    // it, and the hint where one group went out over more than one turn.
    function tasksHtml(list) {
        if (!list || !list.length) return '<p class="tally">' + loc('det.noPlanFileNoTaskTable', '這個 session 的 claims 裡沒有 plan 檔，沒有任務表') + '</p>';
        return list.map(function (p) {
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
    function numCells(t, unpriced, time) {
        return '<td class="r">' + (time || dur(t.s)) + '</td><td class="r">' + comma(t.k) + 'k</td><td class="r"'
            + (unpriced ? ' title="' + loc('det.priceListDoesNotKnow', '價目表不認得：{u}', { u: esc(unpriced) }) + '"' : '') + '>'
            + (unpriced && !t.c ? 'unpriced' : cents(t.c)) + '</td>'
            + '<td class="r">' + tokens(t.ti || 0) + '</td><td class="r">$' + (t.ci || 0).toFixed(2) + '</td>'
            + '<td class="r">' + tokens(t.to || 0) + '</td><td class="r">$' + (t.co || 0).toFixed(2) + '</td>'
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
            + numCells(sums([r]), (r.unpriced || []).join(', '), time) + '<td class="r rc"></td></tr>'
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
                + '</span></div></td>' + numCells(sums(fam(list)), '') + '<td class="r rc">'
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
                    + agdots(x, pr, s) + '<span class="phs">' + stateTally(x, pr, s) + '</span></div></td>' + numCells(sums(fam(pr)), '')
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
            + '<tbody>' + body + '</tbody><tfoot><tr><td>' + loc('disp.nAgents2', '{n} 個 agent', { n: x.rows.length }) + '</td>' + numCells(all, '')
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
            + '<p class="tally">' + loc('disp.rowsUsdSum', '各列美元相加 <b>{a}</b>', { a: cents(all.c) }) + ' ' + eq(all.c, x.agentsTotal.cents) + ' ' + loc('disp.agentsOfSum', 'agentsOf() 的 {a}', { a: cents(x.agentsTotal.cents) })
            + loc('disp.workflowRowsVs', '；workflow 派工 {a} 列', { a: wfRows }) + ' ' + eq(wfRows, wfRun) + ' ' + loc('disp.runFileWorkflowAgentRows', 'run 檔的 workflow_agent {a} 列', { a: wfRun })
            + '</p>'
            + '<p class="tally">' + loc('disp.returnedCharsExplain', '回傳字元是派工的結果進入主 context 的長度：背景 agent 與 workflow 取 task-notification，前景的取 Agent 的 tool_result。背景啟動時回來的確認不算在內，這個 session 合計 {n} 字元。', { n: comma(launch) }) + loc('disp.usdByPriceList', '美元照價目表 {v}', { v: esc(S.pricesVerified || '—') }) + (x.unpriced.length ? loc('disp.unpricedList', '；價目表不認得、寫 unpriced 的：{list}', { list: x.unpriced.map(esc).join(loc('disp.listSep', '、')) }) : '')
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
        var nums = function (t) {
            return cents(t.c) + ' · ' + comma(t.k) + 'k token · ' + dur(t.s) + ' · input ' + tokens(t.ti || 0) + ' $' + (t.ci || 0).toFixed(2)
                + ' · output ' + tokens(t.to || 0) + ' $' + (t.co || 0).toFixed(2);
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
                + loc('disp.nAgentsNewline', '{n} 個 agent\n', { n: row.list.length }) + nums(row.t) + loc('disp.newlineReturned', '\n回傳 {v}', { v: row.r === null ? '—' : loc('disp.nCharsSuffix', '{n} 字元', { n: comma(row.r) }) });
            var segs = m === 'r'
                ? (row.v ? '<i style="flex:1 1 0;background:var(--s-' + (sf === 'workflow' ? 'workflow' : 'agent') + ')"></i>' : '')
                : row.list.map(function (a) {
                    if (!a[m]) return '';
                    var fk = family(a.model || a.alias);
                    fams[fk] = true;
                    return '<i class="' + agentState(x, a, s) + (pass(a) ? '' : ' off') + '" style="flex:' + a[m] + ' 1 0;background:var(--m-' + fk + ')"'
                        + ' title="' + esc((a.label || a.id) + '\n' + modelOf(a) + ' · ' + agentState(x, a, s) + '\n' + nums(sums([a]))) + '"></i>';
                }).join('');
            return '<div class="dxr" role="listitem" title="' + esc(tip) + '"><span class="dxl"><span class="sf ' + esc(sf) + '">' + esc(d ? sf : '—') + '</span>'
                + '<span class="dxn">' + esc(d ? d.text : loc('disp.noMatchingDispatch2', '未對上派工')) + '</span></span>'
                + '<span class="dxt"><span class="dxb" style="width:' + (max ? row.v / max * 88 : 0).toFixed(1) + '%">' + segs + '</span>'
                + '<b>' + (m === 'r' && row.r === null ? '—' : f(row.v)) + '</b></span></div>';
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
            + '<span class="dxsum" title="' + esc(loc('disp.nAgentsTotal', '{n} 個 agent 合計\n', { n: x.rows.length }) + nums(all) + loc('disp.newlineReturned', '\n回傳 {v}', { v: loc('disp.nCharsSuffix', '{n} 字元', { n: comma(ret) }) })) + '">' + loc('disp.totalB', '合計 <b>{v}</b>', { v: f(total) }) + '</span>'
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
                usd: isNum(w.usd) ? w.usd : null, waited: isNum(w.waited) ? w.waited : null, rows: [] };
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
                    + esc(name(g)) + ' · ' + took(span(g)) + ' · context ' + tokens(g.burn) + (g.usd === null ? '' : ' · ' + usd(g.usd)) + '">'
                    + (w > 9 ? text(g) : '') + (label === loc('disp.time2', '時間') ? waits(g) : '') + '</button>';
            }).join('') + '</div><span class="val">' + value + '</span>';
        };
        var strip = '<div class="rpcs" data-block="cost-strip">' + (total ? '<div class="cs">'
            + track(loc('disp.time2', '時間'), took(total), function (g) { return span(g) === null ? 0 : span(g) / total * 100; }, function (g) {
                return esc(name(g)) + '<span class="v">' + took(span(g)) + '</span>';
            })
            + (usdAll ? track(loc('disp.cost3', '花費'), usd(usdAll), function (g) { return (g.usd || 0) / usdAll * 100; }, function (g) { return usd(g.usd); }) : '')
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
                + 'context ' + tokens(g.burn) + (g.usd === null ? '' : ' · ' + usd(g.usd)) + ' · ' + loc('disp.nRows2', '{n} 列', { n: g.rows.length }) + '</span></button>'
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
                + (g.usd === null ? '' : '<dt>' + loc('disp.cost3', '花費') + '</dt><dd>' + usd(g.usd) + '</dd>')
                + (g.waited ? '<dt>' + loc('disp.waitedGate', '等 gate') + '</dt><dd>' + took(g.waited) + '</dd>' : '') + '</dl></summary>'
                + '<ol class="rp">' + g.rows.map(function (r) { return replayRow(x, r.e, r.i, off); }).join('') + '</ol></details>';
        }).join('');
        return '<div class="rpw">' + strip + '<div class="rpb">' + toc + '<div class="rpm">' + bar + body + '<p class="tally">' + loc('disp.nRows2', '{n} 列', { n: x.events.length })
            + (x.dropped ? loc('disp.over300RowsDropped', '；超過 300 列，只留 gate、階段、commit 與派工，丟掉了 {n} 列', { n: x.dropped }) : '') + '</p></div></div></div>';
    }

    // ---- 記成 TODO -------------------------------------------------------
    // One line for TODO.md's `## Needs a decision`, in the shape todo-check
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
                + '<div class="tds">' + loc('todo.staticPageCopyLine', '靜態頁不寫檔：複製這一行，貼進 TODO.md 的 ## Needs a decision。') + '</div></div>';
        }
        return '<details class="td"><summary class="tdb">' + loc('todo.recordAsTodo', '記成 TODO') + ' <span class="m">POST /todo</span></summary>'
            + '<div class="tdf" data-todo-root="' + esc(s.root) + '" data-todo-id="' + esc(s.id) + '">'
            + '<label>' + loc('todo.entryLabel', '條目（寫進 TODO.md 的 ## Needs a decision）') + '</label><textarea rows="2" spellcheck="false">'
            + esc(text) + '</textarea><label>' + loc('todo.link', '連結') + '</label><input type="text" spellcheck="false" value="' + esc(link) + '">'
            + '<div class="help">' + loc('todo.checkedBeforeSubmit', '送出前跑 todo-check 的同一套規則：≤ 200 字元、連結要存在、不指向 plan、decision、report、archive。') + '</div>'
            + '<div class="act"><button type="button" class="go" data-todo>' + loc('todo.submit', '送出') + '</button></div>'
            + '<div class="tdr" role="status" aria-live="polite"></div></div></details>';
    }

    // ---- 比較 ----------------------------------------------------------------
    // The figures the comparison sets side by side, each from the field the
    // session's own panel prints it from.
    function figures(x) {
        var P = x.points;
        return {
            peak: x.peak, peakN: x.peakN, requests: x.requests, pts: P.length, noTime: x.noTime,
            cents: x.rows.reduce(function (n, r) { return n + r.c; }, 0), agentCents: x.agentsTotal.cents,
            back: x.backtracks, t0: P.length ? P[0].t : 0, t1: P.length ? P[P.length - 1].t : 0,
        };
    }
    // Two lines one above the other, on one y axis and one x length, x being
    // the time since each one's first request — each chart still one series.
    function compareHtml(a, xa, b, xb) {
        var fa = figures(xa), fb = figures(xb);
        var span = Math.max(fa.t1 - fa.t0, fb.t1 - fb.t0) || 1;
        var top = Math.max(fa.peak, fb.peak) || 1;
        var ymax = Math.ceil(top / niceStep(top)) * niceStep(top);
        var chart = function (s, x, f) {
            return '<div class="cmph"><span class="sid">' + esc(String(s.id).slice(0, 8)) + '</span><span class="tk" title="'
                + esc(s.task) + '">' + esc(s.task) + '</span><span class="meta">' + loc('cmp.startedAtDot', '{t} 起 · ', { t: stamp(f.t0) }) + mins(f.t1 - f.t0)
                + loc('cmp.dotNSegments', ' · {n} 段', { n: s.route.length }) + '</span></div><div class="cx">' + lineChart(x.points, {
                    W: 720, H: 180, t0: f.t0, t1: f.t0 + span, ymax: ymax, marks: x.marks, elapsed: true,
                    label: loc('cmp.idContextNPointsPeak', '{id} 的 context，{n} 點，峰值 {peak}', { id: String(s.id).slice(0, 8), n: f.pts, peak: tokens(f.peak) }),
                }) + '</div>';
        };
        var row = function (s, f) {
            return '<tr><td class="sid">' + esc(String(s.id).slice(0, 8)) + '<span class="s2">' + esc(s.state + ' · ' + s.stage) + '</span></td>'
                + '<td class="v r">' + tokens(f.peak) + '<span class="s2">' + (f.peakN ? loc('cmp.turnNDot', '回合 {n} · ', { n: f.peakN }) : '') + comma(f.peak) + '</span></td>'
                + '<td class="v r">' + f.requests + '<span class="s2">' + loc('cmp.nPointsPlusNoTime', '{n} 點 ＋ {t} no time', { n: f.pts, t: f.noTime }) + '</span></td>'
                + '<td class="v r">' + cents(f.cents) + '<span class="s2">' + (f.cents === f.agentCents ? loc('cmp.equalsSign', '＝') : loc('cmp.notEqualsSign', '≠'))
                + ' agentsOf() ' + cents(f.agentCents) + '</span></td>'
                + '<td class="v r">' + f.back + '</td></tr>';
        };
        return chart(a, xa, fa) + '<div style="height:14px"></div>' + chart(b, xb, fb)
            + '<p class="cmpnote">' + loc('cmp.sharedAxesNote', '兩張圖共用 y 軸（0 到 {y}）與 x 軸的長度（{x}）；x 是從各自第一個 request 起算的經過時間，所以同一個橫座標是「開工後同樣久」。每張圖仍然只有一條線。', { y: tokens(ymax), x: mins(span) }) + '</p>'
            + '<div class="figs"><table><thead><tr><th>session</th><th class="r">' + loc('cmp.peakContext', '峰值 context') + '</th><th class="r">requests</th>'
            + '<th class="r">' + loc('cmp.dispatchUsd', '派工 USD') + '</th><th class="r">' + loc('cmp.backtrack', '倒退') + '</th></tr></thead><tbody>' + row(a, fa) + row(b, fb) + '</tbody></table></div>'
            + '<p class="cmpnote">' + loc('cmp.figuresSameSource', '每一格都和各自 session 的細節面板出自同一個欄位：峰值與 requests 是 context 折線的，派工 USD 是派工表各列的和，倒退是階段順序的。') + '</p>'
            + '<div class="cmpseq">' + [[a, xa], [b, xb]].map(function (p) {
                return '<h3>' + esc(String(p[0].id).slice(0, 8)) + loc('cmp.dotStepsBacktrack', ' · {n} 步 · 倒退 {b}', { n: p[1].seq.length, b: p[1].backtracks }) + '</h3>'
                    + seqHtml(p[1].seq, p[1].backs, p[0].route, p[0].stage, false);
            }).join('') + '</div>';
    }
    function cmpPage() {
        var two = picked.map(function (id) {
            return S.sessions.filter(function (s) { return s.id === id; })[0];
        }).filter(Boolean);
        var head = '<div class="phead"><h1>' + icon('cmp') + loc('cmp.compareHeading', '比較') + '</h1><span class="spacer"></span>'
            + '<a class="ctl" href="#/list">' + loc('cmp.backToList', '☰ 回清單') + '</a></div>' + subtabsHtml('cmp');
        if (two.length < 2) {
            return head + '<div class="card"><div class="cbody"><p class="mute">' + loc('cmp.pickTwoToCompareHint', '在專案頁或清單上勾兩個有細節的 session，這裡就上下並排比較它們。') + '</p></div></div>';
        }
        two.forEach(needDetail);
        var xa = DETAIL[two[0].id], xb = DETAIL[two[1].id];
        return head + '<div class="card cmpcard"><div class="cbody">'
            + (xa && xb ? compareHtml(two[0], xa, two[1], xb) : '<p class="mute">' + loc('cmp.loadingDetail2', '讀取細節…') + '</p>') + '</div></div>';
    }

    var NAV_LABEL = { live: loc('cmp.crumbLive', '現在'), days: loc('cmp.crumbDays', '近 30 天'), sessions: loc('cmp.crumbSessions', '最近 sessions'),
        projects: loc('cmp.crumbProjects', '專案'), docs: loc('cmp.crumbDocs', '文件'), settings: loc('cmp.crumbSettings', '設定'),
        list: loc('cmp.crumbList', '清單'), cmp: loc('cmp.crumbCmp', '比較'), tour: loc('cmp.crumbTour', '導覽') };
    function drawSide() {
        var tail = CRUMBS[route.view] ? CRUMBS[route.view](route)
            : route.view === 'days' && route.day ? [[loc('cmp.crumbDays', '近 30 天'), '#/days'], [route.day, null]]
                : NAV_LABEL[route.view] ? [[NAV_LABEL[route.view], null]] : [];
        doc.getElementById('side').innerHTML = crumbHtml([[loc('cmp.crumbDashboard', '儀表板'), '#/']].concat(tail));
    }
    VIEWS.now = dashPage;
    VIEWS.live = livePage;
    VIEWS.days = daysPage;
    VIEWS.sessions = sessionsPage;
    VIEWS.projects = projectsPage;
    VIEWS.docs = docsPage;
    VIEWS.tour = function () { return tourPage(Boolean(S.serve)); };
    // Typing in 文件's box asks the server 250 ms after the last key, and
    // paints the answer into its own two places so the box keeps its caret;
    // a redraw later draws the same answer from `view.dsx`.
    var dsxTimer = null;
    function dsxPaint() {
        var out = doc.getElementById('dsxOut'), n = doc.getElementById('dsxN');
        if (out) out.innerHTML = dsxResultsHtml(view.dsx);
        if (n) n.textContent = dsxCount(view.dsx);
    }
    doc.addEventListener('input', function (e) {
        if (!e.target || e.target.id !== 'dq') return;
        var q = e.target.value;
        view.dsx.q = q;
        if (dsxTimer) w.clearTimeout(dsxTimer);
        dsxTimer = w.setTimeout(function () {
            if (!q.trim()) { view.dsx.res = null; dsxPaint(); return; }
            fetch('station/search?q=' + encodeURIComponent(q)).then(function (r) { return r.json(); }).then(function (res) {
                if (view.dsx.q !== q) return;
                view.dsx.res = res;
                dsxPaint();
            }).catch(function () {
                if (view.dsx.q !== q) return;
                view.dsx.res = { q: q, err: true };
                dsxPaint();
            });
        }, 250);
    });
    VIEWS.list = listPage;
    VIEWS.cmp = cmpPage;
    // The wizard's state lives as long as the page: a re-read of the data
    // (the poll) keeps it, a write reloads the page and starts it fresh.
    var wiz = null;
    function settingsPage() {
        var profiles = S.profiles || { machine: null, projects: {} }, keys = S.profileKeys || {};
        if (!wiz) wiz = wizLoad(profiles, keys, Object.keys(profiles.projects || {})[0] || 'machine');
        return wizHtml(keys, wiz, profiles, { serve: Boolean(S.serve), nonce: S.nonce, plugin: S.plugin, configDir: S.configDir });
    }
    VIEWS.settings = settingsPage;
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
    function drawFloat() {
        var fk = doc.getElementById('fk');
        if (!fk) return;
        var held = S.sessions.some(function (s) { return s.pending && s.pending.questions && s.pending.questions.length; });
        fk.innerHTML = floatHtml(S.sessions, view.notes, view.fkOpen, S.serve ? Date.now() : NOW, view.pg, w.Notification ? w.Notification.permission : 'denied');
        fk.className = 'fk' + (held ? ' hasgate' : '');
    }
    function draw() {
        route = parseHash(w.location.hash);
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
        var html = (VIEWS[route.view] || dashPage)(route);
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
    }
    // The left bar's folds, kept as `{fold: true}` for each one the reader
    // shut. Arriving on a page opens its category once; shutting it again
    // while there holds through the 3 s redraw, and the heading shows active.
    var navShut = (function () { try { return JSON.parse(stored('station.nav.collapsed')) || {}; } catch (e) { return {}; } }());
    var navFold = null;
    function navSave() { store('station.nav.collapsed', JSON.stringify(navShut)); }
    function drawNav() {
        var g = navGroup(navOn(route.view)), fold = g && g.fold || null;
        if (fold && fold !== navFold && navShut[fold]) { delete navShut[fold]; navSave(); }
        navFold = fold;
        // A redraw under a focused chevron or theme button keeps the focus.
        var a = doc.activeElement && doc.activeElement.getAttribute ? doc.activeElement : null;
        var keep = a && a.hasAttribute('data-navfold') ? '[data-navfold="' + a.getAttribute('data-navfold') + '"]'
            : a && a.hasAttribute('data-themecycle') ? '[data-themecycle]' : null;
        doc.getElementById('nav').innerHTML = navHtml(route.view, navCounts(homeRows(), S.projects, DAYS),
            { shut: navShut, theme: stored('station.theme') });
        var back = keep && doc.querySelector ? doc.querySelector('#nav ' + keep) : null;
        if (back) back.focus();
    }
    // Folding changes the class on the row already drawn rather than
    // redrawing, so the height and chevron transitions have something to run.
    function navFoldSet(fold, closed) {
        if (closed) navShut[fold] = true; else delete navShut[fold];
        navSave();
        var li = doc.querySelector('#nav [data-fold="' + fold + '"]');
        if (!li) return;
        li.classList.toggle('shut', closed);
        var b = li.querySelector('[data-navfold]');
        if (b) b.setAttribute('aria-expanded', String(!closed));
    }
    doc.addEventListener('click', function (e) {
        var n = e.target.closest ? e.target.closest('#nav [data-navfold], #nav [data-themecycle]') : null;
        if (!n) return;
        if (n.hasAttribute('data-navfold')) {
            var fold = n.getAttribute('data-navfold');
            navFoldSet(fold, !navShut[fold]);
            return;
        }
        var t = n.getAttribute('data-themecycle');
        store('station.theme', t === 'system' ? null : t);
        themeSet(t);
        drawNav();
    });
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
        draw();
        w.scrollTo(0, 0);
    });
    // The 前端 step's model bar: arrow keys, Home and End walk the three
    // segments and choose as they go, the way a radio group does.
    function fePick(h) {
        wiz = wizApply(wiz, S.profileKeys || {}, S.profiles || { machine: null, projects: {} }, { h: String(h) });
        draw();
        var on = doc.querySelector('.fbar [aria-checked="true"]');
        if (on) on.focus();
    }
    doc.addEventListener('keydown', function (e) {
        var b = route.view === 'settings' && e.target.closest ? e.target.closest('.wz .fbar .fsg') : null;
        if (!b) return;
        var stops = [].slice.call(b.closest('.fq').querySelectorAll('.fsg')), i = stops.indexOf(b), j = i;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = Math.min(stops.length - 1, i + 1);
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = Math.max(0, i - 1);
        else if (e.key === 'Home') j = 0;
        else if (e.key === 'End') j = stops.length - 1;
        else return;
        e.preventDefault();
        fePick(stops[j].getAttribute('data-h'));
    });
    // The 繁中 / EN switch: registered ahead of the click handler below so a
    // harness that keeps only one listener per event type (this file's own
    // node tests among them) still runs the handler those tests exercise.
    doc.addEventListener('click', function (e) {
        var b = e.target && e.target.closest ? e.target.closest('[data-lang]') : null;
        if (!b || !I18N) return;
        if (I18N.set(b.getAttribute('data-lang'))) w.location.reload();
    });
    doc.addEventListener('click', function (e) {
        var wzt = route.view === 'settings' && e.target.closest
            ? e.target.closest('.wz [data-go], .wz [data-h], .wz [data-st], .wz [data-k], .wz [data-ask], .wz [data-scope]') : null;
        if (wzt) {
            wiz = wizApply(wiz, S.profileKeys || {}, S.profiles || { machine: null, projects: {} }, wzt.dataset);
            draw();
            return;
        }
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
        if (e.target.closest('[data-fkb]')) { view.fkOpen = !view.fkOpen; drawFloat(); return; }
        var nx = e.target.closest('[data-note-x]');
        if (nx) {
            var nid = nx.closest('.nt').getAttribute('data-note');
            view.notes = view.notes.filter(function (x) { return x.id !== nid; });
            drawFloat();
            return;
        }
        if (e.target.closest('[data-note-clear]')) { view.notes = []; drawFloat(); return; }
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
            fetch('answer', { method: 'POST', body: form }).then(function (r) {
                return r.text().then(function (t) {
                    pgr.className = 'pgr ' + (r.ok ? 'ok' : 'bad');
                    pgr.textContent = (r.ok ? loc('cmp.sentColon', '已送出：') : r.status + ' — ') + t.trim();
                });
            }, function () {
                pgr.className = 'pgr bad';
                pgr.textContent = loc('cmp.couldNotSendServeRunning', '送不出去：serve 還在跑嗎？');
            });
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
            fetch('todo', { method: 'POST', body: body }).then(function (r) {
                return r.text().then(function (t) {
                    said.className = 'tdr ' + (r.ok ? 'ok' : 'bad');
                    said.textContent = (r.ok ? loc('cmp.writtenToTodoColon', '寫進 TODO.md：') : r.status + loc('cmp.dashNotWrittenColon', ' — 沒有寫進去：')) + t.trim();
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
    function applyChrome() {
        if (!I18N) return;
        var en = I18N.lang === 'en';
        var set = function (id, fn) { var el = doc.getElementById(id); if (el) fn(el); };
        if (doc.documentElement && doc.documentElement.setAttribute) doc.documentElement.setAttribute('lang', en ? 'en' : 'zh-Hant');
        doc.title = loc('mast.title', 'fankeel 測站');
        set('brand', function (el) { el.setAttribute('aria-label', loc('mast.home', 'fankeel 測站 首頁')); });
        set('brandw', function (el) { el.textContent = loc('mast.station', '測站'); });
        set('side', function (el) { el.setAttribute('aria-label', loc('mast.crumbs', '位置')); });
        set('q', function (el) {
            el.placeholder = loc('mast.searchHint', '搜尋任務、session、碰過的檔案…');
            el.setAttribute('aria-label', loc('mast.search', '搜尋'));
        });
        set('servedown', function (el) { el.innerHTML = '<i class="dot down"></i>' + esc(loc('mast.serveDown', 'serve 已停')); });
        set('langzh', function (el) { el.setAttribute('aria-pressed', String(!en)); el.setAttribute('title', en ? '介面改用繁體中文' : '介面用繁體中文'); });
        set('langen', function (el) { el.setAttribute('aria-pressed', String(en)); el.setAttribute('title', en ? 'Interface is in English' : 'Switch the interface to English'); });
    }
    applyChrome();

    // ---- live refresh --------------------------------------------------------
    // Served, the page keeps itself current: every three seconds it re-reads the
    // list and — while the session whose detail is on screen is live — that
    // session's detail, each through a script tag the way it loaded them the
    // first time, with a query string that only keeps the browser from answering
    // out of its cache. A session no longer live has its detail re-read no more:
    // nothing under it can move. A hidden tab re-reads nothing. The file
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
    // running `done` a second time.
    var RELOAD_TIMEOUT_MS = 4000;
    function reload(src, done) {
        var el = doc.createElement('script');
        var settled = false;
        var timer = w.setTimeout(function () {
            if (settled) return;
            settled = true;
            if (el.parentNode) el.parentNode.removeChild(el);
            done(false);
        }, RELOAD_TIMEOUT_MS);
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
        if (btn) btn.disabled = got.missing > 0;
        if (cnt) cnt.textContent = (qs.length - got.missing) + ' / ' + qs.length;
    }
    // One POST /answer from the floating icon: an option, or the hand-off.
    function gatePost(gc, fill, said) {
        var who = S.sessions.filter(function (x) { return x.id === gc.getAttribute('data-pg-id'); })[0];
        var end = gc.querySelector('.gend');
        if (!who || !who.pending) return;
        var form = new URLSearchParams();
        form.set('nonce', S.nonce || '');
        form.set('root', gc.getAttribute('data-pg-root'));
        form.set('id', gc.getAttribute('data-pg-id'));
        fill(form, who);
        fetch('answer', { method: 'POST', body: form }).then(function (r) {
            return r.text().then(function (t) {
                end.className = 'gend ' + (r.ok ? 'ok' : 'bad');
                end.textContent = (r.ok ? said : r.status + ' — ') + t.trim();
            });
        }, function () {
            end.className = 'gend bad';
            end.textContent = loc('poll.couldNotSendServeRunning', '送不出去：serve 還在跑嗎？');
        });
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
        reload('station/station-data.js', function (ok) {
            if (!ok || !w.STATION || w.STATION === S) { busy = false; return; }
            // `cleared` rides on the one load `/clear-stale` redirected to, and
            // stays on the page rather than vanishing three seconds later.
            if (isFinite(S.cleared) && w.STATION.cleared === undefined) w.STATION.cleared = S.cleared;
            S = w.STATION;
            freshen();
            polledAt = Date.now();
            tuneNotify(before, S.sessions);
            if (doc.hidden) { busy = false; return; }
            // The settings wizard reads nothing live; a redraw there would only
            // throw away what the reader has open. The masthead still moves.
            if (route.view === 'settings' || route.view === 'tour') { busy = false; drawFloat(); doc.getElementById('gen').textContent = genText(); return; }
            var s = watched();
            var done = function () { busy = false; repaint(); };
            if (s && s.state === 'live' && s.hasDetail) reload('station/detail/' + encodeURIComponent(s.id) + '.js', done);
            else done();
        });
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
        var servePill = function (on) {
            var pill = doc.getElementById('servedown');
            if (pill) pill.hidden = !on;
        };
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

    draw();
}(typeof window === 'undefined' ? {} : window,
  typeof document === 'undefined' ? null : document));
