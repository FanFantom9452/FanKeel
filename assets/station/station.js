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
            + (s.unknown ? ' title="這個 session 的 config directory 讀不到，'
                + '活著與否無法確認"' : '') + '><i class="dot ' + s.state
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
            if (!prev && !cur) return '<span class="delta flat">無可比</span>';
            var c2 = Math.abs(pp) < 0.5 ? 'flat' : pp > 0 ? 'dn' : 'up';
            return '<span class="delta ' + c2 + '">' + (pp > 0 ? '+' : '') + pp.toFixed(1)
                + ' pt ' + (c2 === 'up' ? '↘' : c2 === 'dn' ? '↗' : '') + '</span>';
        }
        if (!prev) return '<span class="delta flat">前期無資料</span>';
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
    var WHO_LABEL = { main: '主 session', agent: '背景 agent', workflow: 'workflow' };
    var DIM_LABEL = { model: '依 model', project: '依專案', stage: '依 stage', who: '主 session 對 agent',
        version: '依版本', kind: '依成分' };
    var METRIC_LABEL = { usd: '花費', tokens: 'token', time: '時間' };
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
    // `#/list` and `#/cmp` are the other pages the left bar opens; `#/p/<pkey>`
    // and `#/s/<id>[/<tab>]` are opened from rows. A hash is what a page opened
    // from file:// can go back through.
    var PAGES = ['live', 'sessions', 'projects', 'docs', 'settings'];
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
    function tokenSum(t) {
        return t ? TOKEN_KEYS.reduce(function (n, k) { return n + (t[k] || 0); }, 0) : 0;
    }
    // `kind` is not here: it is not one key per row, it is four (see
    // `dayBars`), so it never goes through `dimKey`.
    function dimKey(dim, s, r) {
        if (dim === 'model') return family(r.model);
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
        var fixed = dim === 'model' ? MODEL_KEYS : dim === 'stage' ? ROUTE.concat(['none'])
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
        if (dim === 'model') return 'var(--m-' + key + ')';
        if (dim === 'stage') return ROUTE.indexOf(key) >= 0 ? 'var(--st-' + key + ')' : 'var(--st-none)';
        if (dim === 'who') return 'var(--s-' + key + ')';
        if (dim === 'kind') return 'var(' + (KIND_COLOR[key] || '--st-none') + ')';
        if (dim === 'version' && key === 'none') return 'var(--st-none)';
        var i = (pkeys || []).indexOf(key);
        return 'var(--p-' + (i < 0 ? 5 : Math.min(i, 5)) + ')';
    }
    function keyLabel(dim, key, names) {
        if (dim === 'who') return WHO_LABEL[key] || key;
        if (dim === 'stage') return key === 'none' ? '第一步之前' : key;
        if (dim === 'project') return (names && names[key]) || key;
        if (dim === 'kind') return KIND_LABEL[key] || key;
        if (dim === 'version') return key === 'none' ? '未記版本' : key;
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
        return dim === 'version' && key === 'none' ? '跑的時候 registry 還沒有 version 這個欄位，不是別處來的 session' : '';
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
            return { days: [], keys: [], max: 0, disabled: '時間沒有 model 可分：spans 只記 stage 與誰在跑，不記 model' };
        }
        // Same reason as `model`, just above: with `時間` the bars come from
        // `s.spans`, and a span records only stage and who, so it carries no
        // tokens and no cost to split into kinds. `version` needs no such
        // guard — it is a property of the session, so it applies to spans too.
        if (metric === 'time' && dim === 'kind') {
            return { days: [], keys: [], max: 0, disabled: '時間沒有成分可分：spans 只記 stage 與誰在跑，不記 token 或花費' };
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
            + roHtml('30 天花費', usd(cur.usd), delta(cur.usd, prev.usd))
            + roHtml('token', tokens(cur.tokens), delta(cur.tokens, prev.tokens))
            + roHtml('active 時間', hours(cur.active), delta(cur.active, prev.active))
            + roHtml('<i class="hatchsw"></i>等待佔比', Math.round(share(cur) * 1000) / 10 + '<span class="u">%</span>',
                (prev.main + prev.wait ? delta(share(cur), share(prev), 'pt') : '<span class="delta flat">前期無資料</span>')
                + ' · ' + hours(cur.wait) + ' 等');
        var top = S.gates && S.gates.swapped && S.gates.swapped.length ? S.gates.swapped[0] : null;
        out += roHtml('最常被換掉', top ? esc(top.label) : '—', top ? top.lost + ' / ' + top.total : '');
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
                return '<i title="' + esc(k) + '（現在）" class="now" style="--c:var(--st-' + esc(k) + ');background:var(--c)"></i>';
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
            ? '<span class="runn" title="此刻有 ' + s.running + ' 個 agent 是 running"><i class="dot live"></i>running ' + s.running + '</span>'
            : '<span class="runn zero" title="此刻沒有 agent 是 running">running 0</span>';
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
        var out = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="近 ' + n + ' 天每日'
            + METRIC_LABEL[o.metric] + '，' + DIM_LABEL[o.dim] + '">';
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
            var label = b.day + ' 合計 ' + metricText(o.metric, b.total) + bars.keys.filter(function (k) { return b.parts[k]; })
                .map(function (k) { return '；' + keyLabel(o.dim, k, o.names) + ' ' + metricText(o.metric, b.parts[k]); }).join('');
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
                    + (b.day === o.today ? '今天' : Number(b.day.slice(5, 7)) + '月') + '</text>' : '');
        });
        return out + '<line class="hguide" x1="0" x2="0" y1="' + T + '" y2="' + base + '"/></svg>';
    }
    // The order `colorOf` ranks a palette dim by, with the keys in `o.off`
    // taken out first — so what the filter leaves is ranked, and coloured,
    // afresh. With nothing off it is the list the chart always used.
    function paletteOf(bars, o) {
        var off = o.off || {};
        return (o.dim === 'version' ? bars.keys : o.pkeys || []).filter(function (k) { return !off[k]; });
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
    var ICON_ORDER = '<svg viewBox="0 0 12 12" width="12" height="12" role="img" aria-label="由下而上"><title>由下而上：列在前面的疊在最底下</title>'
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
            ? '<span data-rest><i class="sw" style="background:var(--p-5)"></i>其他 ' + rest.length + ' 個</span>'
            : gone0.length ? '<span data-rest data-off><i class="sw" style="background:var(--p-5)"></i>其他 ' + gone0.length + ' 個</span>' : '');
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
            + ' aria-label="篩選' + (n ? '：顯示 ' + (bars.keys.length - n) + ' / ' + bars.keys.length : '') + '" title="篩選圖表的系列">' + ICON_FUNNEL
            + (n ? '<b>' + (bars.keys.length - n) + '/' + bars.keys.length + '</b>' : '') + '</button>'
            + (o.panel ? '<div class="fpanel" role="group" aria-label="圖表顯示哪些">'
                + '<div class="fall"><button type="button" data-fall="on">全選</button><button type="button" data-fall="off">全不選</button></div>'
                + own.map(row).join('')
                + (rest.length ? '<div class="fsub">其他 ' + rest.length + ' 個</div>' + rest.map(row).join('') : '')
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
        return '<div class="tt-day">' + esc(day) + (day === o.today ? ' · 今天' : '') + '</div>'
            + (key && b.parts[key]
                ? '<div class="tt-main">' + sw(key) + '<b>' + esc(keyLabel(o.dim, key, o.names)) + '</b></div>'
                    + '<div class="tt-val"><b>' + metricText(o.metric, b.parts[key]) + '</b><span>當天的 ' + pct(b.parts[key]) + '</span></div>'
                : '')
            + '<ul class="tt-list">' + keys.reverse().map(function (k) {
                return '<li' + (k === key ? ' data-hot' : '') + '>' + sw(k) + '<span>' + esc(keyLabel(o.dim, k, o.names))
                    + '</span><span class="tt-n">' + metricText(o.metric, b.parts[k]) + '</span></li>';
            }).join('') + '</ul>'
            + '<div class="tt-sum">當天合計 <b>' + metricText(o.metric, b.total) + '</b></div>';
    }
    function projectsHtml(rows, o) {
        return '<div class="h2">' + icon('projects') + '專案 <small>近 30 天</small></div>'
            + '<div class="projrow head"><span>專案</span><span>每日花費</span><span class="r">花費</span><span class="r">session</span>'
            + '<span class="r">最後活動</span></div>'
            + (rows.length ? rows.map(function (r) {
                var c = colorOf('project', r.pkey, o.pkeys);
                return '<a class="projrow" href="' + projectHash(r.pkey) + '"><span style="min-width:0"><span class="nm"><i class="sw" style="background:'
                    + c + '"></i>' + esc(o.names[r.pkey] || r.pkey) + '</span><span class="pth mono">' + esc(r.pkey) + '</span></span>'
                    + '<span>' + spark(r.daily, c) + '</span><span class="r">' + usd(r.usd) + '</span><span class="r">' + r.n + '</span>'
                    + '<span class="r muted">' + ago(r.last) + '</span></a>';
            }).join('') : '<p class="note">這台機器上沒有 session</p>');
    }
    function recentHtml(list, o) {
        return '<div class="h2">' + icon('sessions') + '最近 sessions <small>依最後動作，最新在上</small><span class="spacer"></span>'
            + '<a class="btn" href="#/list">看全部 →</a></div>'
            + '<div class="tbl-wrap"><table class="t"><thead><tr><th>任務</th><th>專案</th><th>stage</th><th class="r">花費</th>'
            + '<th class="r">token</th><th>狀態</th></tr></thead><tbody>'
            + list.map(function (s) {
                var t = sessionTotals(s);
                return '<tr class="link" data-href="' + sessionHash(s.id) + '"><td class="task"><a href="' + sessionHash(s.id) + '">'
                    + esc(s.task || '（未命名）') + '</a></td><td><span class="pchip"><i class="sw" style="background:'
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
        return '<div class="split"><div class="split-h"><span>狀態</span><span class="num mono">' + d.total + ' markdown files</span></div>'
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
            + '<span class="when">生成於 <span class="mono">' + stamp(Date.parse(d.generatedAt)) + '</span></span></summary>'
            + docSplitHtml(d)
            + '<div class="dgrid"><div>'
            + (d.plannedNotBuilt.length ? '<div class="dsub">還沒建 <span class="n">planned, not built — ' + d.plannedNotBuilt.length + '</span></div>'
                + docPathList(d.plannedNotBuilt) : '')
            + (d.undeclared.count ? '<div class="dsub">沒宣告狀態 <span class="n">undeclared — ' + d.undeclared.count + '</span></div>'
                + (d.undeclared.note ? '<div class="dnote">' + esc(d.undeclared.note) + '</div>' : '') + docPathList(d.undeclared.paths) : '')
            + '</div><div>'
            + (d.filing ? '<div class="dsub">歸檔位置 <span class="n">filing · index: ' + esc(d.filing.index) + '</span></div>' + docFilingHtml(d.filing) : '')
            + '</div></div></details>';
    }
    function docsCardHtml(list, o) {
        if (!list.length) return '';
        return '<section class="panel docs"><div class="h2">文件 <small>各專案已生成的 <span class="mono">.fankeel/map.md</span>，找不到的不列</small></div>'
            + list.map(function (d, i) { return docProjectHtml(d, o, i === 0); }).join('') + '</section>';
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
        var out = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="每個 session 的' + METRIC_LABEL[o.metric] + '，依開始時間">';
        [0, 0.25, 0.5, 0.75, 1].forEach(function (f) {
            out += '<line class="' + (f ? 'gridl' : 'base') + '" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(top * f) + '" y2="' + Y(top * f) + '"/>'
                + '<text class="tick" x="' + (L - 10) + '" y="' + (Number(Y(top * f)) + 4) + '" text-anchor="end">' + metricText(o.metric, top * f) + '</text>';
        });
        o.days.forEach(function (d, i) {
            var x = X(dayStart(d) + 432e5);
            if (i % 2 === 0 || d === o.today) out += '<text class="tick" x="' + x + '" y="' + (base + 17) + '" text-anchor="middle">' + Number(d.slice(8)) + '</text>';
            if (d === o.today || d.slice(8) === '01' || i === 0) {
                out += '<text x="' + x + '" y="' + (base + 33) + '" text-anchor="middle">' + (d === o.today ? '今天' : Number(d.slice(5, 7)) + '月') + '</text>';
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
        return '<span class="mini-mix" title="' + keys.map(function (k) { return k + ' ' + usd(models[k]); }).join('、') + '">'
            + keys.map(function (k) {
                return '<i style="width:' + (models[k] / tot * 100).toFixed(2) + '%;background:var(--m-' + k + ')"></i>';
            }).join('') + '</span>';
    }
    function projectSessionsHtml(list, picked) {
        if (!list.length) return '<p class="note">這個專案近 30 天沒有 session</p>';
        return '<div class="tbl-wrap"><table class="t"><thead><tr><th aria-label="選來比較"></th><th>任務</th><th>開始</th>'
            + '<th class="r">時長</th><th>stage 進度</th><th class="r">花費</th><th class="r">token</th><th>model 組成</th></tr></thead><tbody>'
            + list.map(function (s) {
                var t = sessionTotals(s), started = Date.parse(s.started);
                return '<tr class="link" data-href="' + sessionHash(s.id) + '"><td><input type="checkbox" data-cmp="' + esc(s.id)
                    + '" aria-label="選來比較"' + (picked.indexOf(s.id) >= 0 ? ' checked' : '')
                    + (s.hasDetail ? '' : ' disabled title="沒有 transcript，沒有細節可比"') + '></td>'
                    + '<td class="task"><a href="' + sessionHash(s.id) + '">' + esc(s.task || '（未命名）') + '</a></td>'
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
        if (!(m.t1 > m.t0)) return '<p class="note">這個 session 沒有帶時間的 request，畫不出時間線</p>';
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
        var out = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="session 時間線"' + (hi ? ' data-hi' : '') + '><defs>'
            + '<pattern id="hw" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)">'
            + '<rect width="5" height="5" style="fill:var(--hatch-bg)"/><rect width="1.4" height="5" style="fill:var(--hatch)"/></pattern></defs>'
            + '<text x="' + G + '" y="16" style="fill:var(--ink);font-weight:600">' + clock(m.t0) + '</text>'
            + '<text x="' + (W - R) + '" y="16" text-anchor="end" style="fill:var(--ink);font-weight:600">' + clock(m.t1) + '</text>'
            + '<text class="tick" x="' + (W - R) + '" y="' + (H - 8) + '" text-anchor="end">共 ' + mins(m.t1 - m.t0) + '</text>';
        // The gutter's lane names stay clear of the token ticks, which end
        // 8px left of G and are at most five characters wide.
        out += '<text class="lane-l" x="0" y="' + (sl + 13) + '">stage</text>'
            + '<text class="lane-l" x="0" y="' + (ctx0 + 10) + '">主 session context</text>'
            + '<text class="lane-s" x="0" y="' + (ctx0 + 26) + '">token；◆ 是 agent 回傳</text>';
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
            var lab = '等 ' + mins(w.ms), lw = textW(lab, 11);
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
        out += '<text class="lane-l" x="0" y="' + (rq0 + 11) + '">主 session 請求</text><text class="lane-s" x="0" y="' + (rq0 + 25) + '">'
            + m.ticks.length + ' 次，顏色 = model</text>';
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
                    + (g && isFinite(g.usd) && g.usd ? ' · 這段 stage ' + usd(g.usd) : '')) + '</title></rect>';
        });
        // The returns go over the reading columns, so each keeps its own title.
        var retRoom = labelRoom();
        m.rets.forEach(function (q) {
            var x = X(q.t), y = Yc(yAt(q.t));
            var lab = '+' + (q.chars >= 1000 ? (q.chars / 1000).toFixed(1) + 'k' : q.chars) + ' 字元', lw = textW(lab, 10.5);
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
        if (!shown.length) out += '<text class="lane-s" x="' + G + '" y="' + (d0 + 16) + '">這個 session 沒有派出 agent 或 workflow</text>';
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
                    (b.kind === 'wf' ? 'workflow · ' + b.n + ' 個 agent · ' : String(b.model || '—').replace(/^claude-/, '') + ' · ')
                    + tokens(b.tokens) + ' tok · ' + cents(b.cents)
                    + (b.ret !== null && b.ret !== undefined ? ' · 回傳 ' + comma(b.ret) + ' 字元' : ''))
                + '<line class="gridl" x1="0" x2="' + (W - R) + '" y1="' + (y + RH) + '" y2="' + (y + RH) + '"/>'
                + (b.kind === 'wf' ? '<rect class="wf-toggle" data-wf="' + esc(b.key) + '" x="0" y="' + y + '" width="' + (W - R)
                    + '" height="' + RH + '"><title>點一下收合或展開</title></rect>' : '');
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
        return '<tr class="loop">' + (foot ? '<td><span class="lp">主迴圈</span></td><td></td>' : '<td></td><td><span class="lp">主迴圈</span></td>')
            + '<td colspan="8"><div class="lf">'
            + '<span><b>' + lp.turns + '</b>回合</span>'
            + '<span' + (z ? ' class="zero"' : '') + '><b>' + lp.over + '</b>回合 ≥ 400k</span>'
            + '<span' + (z ? ' class="zero"' : '') + '><b>' + usd(lp.overUsd) + '</b>那些回合</span>'
            + '<span' + (z ? ' class="zero"' : '') + '><i class="mini" style="display:inline-flex;width:72px;vertical-align:middle;margin-right:8px">'
            + '<span style="width:' + Math.round(pct) + '%"></span></i><b>' + Math.round(pct) + '%</b>' + (foot ? '佔 session' : '佔這一站') + '</span>'
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
        var name = function (k) { return k === 'none' ? '第一步之前' : k; };
        var paid = L.rows.filter(function (g) { return g.usd > 0; });
        return '<div class="cshare" data-block="cost-share"><div class="h2">' + icon('spend') + '各 stage 花費占比'
            + '<small>合計 ' + usd(L.total) + '；點一段或一列，時間線標出那個 stage</small></div>'
            + (paid.length ? '<div class="csbar" role="group" aria-label="各 stage 花費占比">' + paid.map(function (g) {
                var p = pct(g.usd), on = hi === g.stage;
                return '<button type="button" class="csseg' + (on ? ' on' : '') + '" data-hist="' + esc(g.stage) + '" aria-pressed="' + on + '"'
                    + ' title="' + esc(name(g.stage) + ' ' + usd(g.usd) + ' · ' + p + '%') + '" style="flex:' + g.usd + ' 1 0;background:'
                    + colorOf('stage', g.stage) + '">' + (p >= 9 ? '<span>' + esc(name(g.stage)) + '</span><b>' + usd(g.usd) + ' · ' + p + '%</b>' : '')
                    + '</button>';
            }).join('') + '</div>' : '<p class="tally">這個 session 沒有按日的花費</p>')
            + '<div class="tbl-wrap"><table class="t cstbl"><thead><tr><th>stage</th><th class="r">時間</th><th class="r">花費</th><th class="r">占比</th>'
            + '<th>主 session / agent</th><th class="r">請求</th></tr></thead><tbody>' + L.rows.map(function (g) {
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
    function dispatchStagesHtml(L, id) {
        var paid = L.rows.filter(function (g) { return g.agent > 0; });
        if (!paid.length) return '';
        return '<div class="csagent" data-block="dispatch-stages"><span class="muted">派工花費，依 stage</span>' + paid.map(function (g) {
            return '<a class="cschip" href="' + sessionHash(id) + '" data-hist="' + esc(g.stage) + '"><i class="sw" style="background:'
                + colorOf('stage', g.stage) + '"></i>' + esc(g.stage === 'none' ? '第一步之前' : g.stage) + '<b>' + usd(g.agent) + '</b></a>';
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
        return '<div class="sumline"><div>合計花費<b>' + usd(m.total.usd) + '</b></div><div>主 session<b>' + usd(m.main.usd) + '</b></div>'
            + '<div>派工（agent + workflow）<b>' + usd(m.agent.usd) + '</b></div><div>output 佔花費<b>' + share(m.total.cost.output) + '</b></div>'
            + '<div>cache read 佔 token<b>' + (allTok ? Math.round(m.total.tokens.cacheRead / allTok * 1000) / 10 + '%' : '—') + '</b></div></div>'
            + '<div class="h2">stage × model <small>token 與各自的 USD；stage 列是小計</small></div>'
            + '<div class="tbl-wrap"><table class="t"><thead><tr><th rowspan="2">stage</th><th rowspan="2">model · 佔 session</th>'
            + KINDS.map(function (k) { return '<th colspan="2"><i class="sw" style="background:var(' + k[2] + ')"></i> ' + k[1] + '</th>'; }).join('')
            + '<th rowspan="2" class="r">USD</th></tr><tr>'
            + KINDS.map(function () { return '<th class="r">token</th><th class="r">USD</th>'; }).join('') + '</tr></thead><tbody>'
            + m.stages.map(function (g) {
                return '<tr class="sub"><td><span class="pchip"><i class="sw" style="background:' + colorOf('stage', g.stage) + '"></i>'
                    + esc(g.stage === 'none' ? '第一步之前' : g.stage) + '</span></td><td class="muted">' + share(g.sub.usd) + '</td>'
                    + cells(g.sub, '') + '</tr>' + g.models.map(function (mm) {
                        return '<tr class="child"><td></td><td><span class="pchip"><i class="sw" style="background:var(--m-' + family(mm.model)
                            + ')"></i>' + esc(String(mm.model).replace(/^claude-/, '')) + '</span></td>' + cells(mm.cell, '') + '</tr>';
                    }).join('') + (loops ? loopRow(loopBy[g.stage], g.sub.usd) : '');
            }).join('') + '</tbody><tfoot>'
            + '<tr><td>主 session</td><td></td>' + cells(m.main, 'total') + '</tr>'
            + '<tr><td>agent</td><td></td>' + cells(m.agent, 'total') + '</tr>'
            + '<tr><td>合計</td><td></td>' + cells(m.total, 'total') + '</tr>'
            + (loops ? loopRow(sumLoops(loops), m.total.usd, true) : '') + '</tfoot></table></div>';
    }
    function sessionHeadHtml(s, x) {
        var t = sessionTotals(s), m = x ? timelineModel(x) : null, agentUsd = costModel(s.days).agent.usd;
        var waited = m ? m.waits.reduce(function (n, w) { return n + w.ms; }, 0) : t.wait;
        var wakes = x && typeof x.wakes === 'number' ? x.wakes : null;
        return '<div class="readouts">'
            + roHtml('歷時', m && m.t1 > m.t0 ? mins(m.t1 - m.t0) : '—', 'active ' + hours(t.active))
            + roHtml('<i class="hatchsw"></i>等你回答', mins(waited), m ? m.waits.length + ' 次 gate' : '讀取細節…')
            + roHtml('花費', usd(t.usd), t.usd ? '派工佔 ' + Math.round(agentUsd / t.usd * 100) + '%' : '沒有按日的花費')
            + roHtml('token', tokens(t.tokens), x ? x.requests + ' 次主 session 請求' : '')
            + roHtml('派工', x ? x.rows.length + '<span class="u">agent</span>' : '—', x ? agentCounts(x, s) + x.runs.length + ' 個 workflow' : '')
            + roHtml('叫醒', wakes === null ? '—' : wakes + '<span class="u">次</span>', wakes === null ? '' : '派工回報叫醒主 session')
            + roHtml('context 峰值', x ? tokens(x.peak) : '—', '')
            + '</div>';
    }
    // Three tabs by what a reader comes for: 概覽 is the session's story —
    // time, context and money stage by stage — and 派工 and 事件 are its two
    // long lists. `cost` is still in TABS so an old `/cost` link parses; it
    // opens 概覽, which now holds everything that tab showed.
    var TAB_SHOWN = ['timeline', 'dispatch', 'events'];
    function tabsHtml(s, tab, x) {
        var label = { timeline: '概覽', dispatch: '派工', events: '事件' };
        var n = { dispatch: x ? x.rows.length : null, events: x ? x.events.length : null };
        var run = x ? x.rows.filter(function (r) { return agentState(x, r, s) === 'running'; }).length : 0;
        if (tab === 'cost') tab = 'timeline';
        return '<nav class="tabs" aria-label="session 檢視">' + TAB_SHOWN.map(function (k) {
            return '<a href="' + sessionHash(s.id, k) + '"' + (k === tab ? ' class="on" aria-current="page"' : '') + '>' + label[k]
                + (n[k] !== null && n[k] !== undefined ? '<small>' + n[k] + '</small>' : '')
                + (k === 'dispatch' && run ? '<i class="dot live" title="' + run + ' 個 agent running"></i>' : '') + '</a>';
        }).join('') + '</nav>';
    }

    // ---- the live page --------------------------------------------------------
    // A time to the second, for when the page last re-read and when a step began.
    function clockSec(ms) {
        var d = new Date(ms);
        return [d.getHours(), d.getMinutes(), d.getSeconds()].map(function (n) { return String(n).padStart(2, '0'); }).join(':');
    }
    function agoText(sec) { return sec <= 0 ? '剛更新' : sec + ' 秒前更新'; }
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
            ? '<span class="livetag" title="最後一次更新 ' + clockSec(polledMs) + '；session 還活著，這頁每 3 秒重拉一次，結束就停"><b>即時</b>・<span data-ago>'
                + agoText(Math.round((nowMs - polledMs) / 1000)) + '</span></span>'
            : '<span class="livetag off" title="session 結束後不再重拉"><b>已停止更新</b>・最後一次 ' + clockSec(polledMs) + '</span>';
    }
    // The route as a rail: a stop per stage, each one behind the current stage
    // timed by the registry's clock for it (`stages[].from` and `to`), the
    // current one ringed and — while `live` — counting up from when it was
    // entered. Not live, it keeps the time the stage had when the session stopped.
    function railHtml(s, live, nowMs) {
        var route = s.route || [], at = route.indexOf(s.stage), win = {};
        (s.stages || []).forEach(function (w) { win[w.stage] = w; });
        return '<ol class="rail" style="--n:' + route.length + '" aria-label="route ' + esc(route.join(' → '))
            + (at >= 0 ? '；現在在 ' + esc(s.stage) + '，第 ' + (at + 1) + ' 站，共 ' + route.length + ' 站' : '') + '">'
            + route.map(function (k, i) {
                var w = win[k], cls = at < 0 || i > at ? 'todo' : i < at ? 'done' : 'now' + (live ? ' live' : ''), tm = '';
                if (i < at && w) tm = '<span class="tm">' + mins(w.to - w.from) + '</span>';
                else if (i === at && w) {
                    tm = '<span class="tm">' + (live ? tk(-w.from / 1000, 1, true, nowMs / 1000) : mins(w.to - w.from)) + '</span>'
                        + '<span class="since">' + clock(w.from) + (live ? ' 進站' : ' 進站，停在這站') + '</span>';
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
        return '底下所有數字與狀態都凍結在 ' + genAbs + '（' + genRel + '），不會再更新。每 5 秒重試一次。';
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
    };
    function icon(name) {
        return ICONS[name] ? '<svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor"'
            + ' stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + ICONS[name] + '</svg>' : '';
    }
    // Five categories. A category with `kids` is a heading over its sub-pages,
    // and those same kids are the tab strip on each of their pages
    // (`subtabsHtml`), so the bar and the strip cannot list different pages.
    var NAV_TREE = [
        { ico: 'dash', label: '儀表板', v: 'now', href: '#/' },
        { ico: 'sessions', label: 'Sessions', fold: 'sessions', kids: [['live', '#/live', '進行中'], ['sessions', '#/sessions', '最近'],
            ['list', '#/list', '全部清單'], ['cmp', '#/cmp', '比較']] },
        { ico: 'spend', label: '花費', fold: 'spend', kids: [['days', '#/days', '近 30 天'], ['projects', '#/projects', '依專案']] },
        { ico: 'docs', label: '文件', v: 'docs', href: '#/docs' },
        { ico: 'settings', label: '設定', kids: [['settings', '#/settings', '精靈']] },
    ];
    // A detail page lights the page it was opened from.
    function navOn(active) { return active === 'project' ? 'projects' : active === 'session' ? 'sessions' : active; }
    function navGroup(v) {
        return NAV_TREE.filter(function (g) { return (g.kids || []).some(function (k) { return k[0] === v; }); })[0] || null;
    }
    // The three theme states the button at the foot of the bar cycles
    // through: [state, icon, what it says, the state a click moves to].
    var THEMES = { system: ['auto', '跟隨系統', 'light'], light: ['sun', '淺色', 'dark'], dark: ['moon', '深色', 'system'] };
    // `ui.shut` holds the `fold` keys the reader collapsed; `ui.theme` is one
    // of THEMES. A category with `fold` is one button, the whole row, that only
    // opens and shuts; its kids do the navigating. The chevron shows which.
    function navHtml(active, c, ui) {
        var on = navOn(active), shut = (ui && ui.shut) || {}, th = THEMES[ui && ui.theme] ? ui.theme : 'system';
        // Each badge sits on the page whose rows it counts.
        var badges = { now: null, live: [c.live + ' live', c.live ? 'live' : ''], days: [usd(c.usd)], sessions: [c.sessions],
            projects: [c.projects], docs: [c.docs] };
        var link = function (v, href, inner) {
            var b = badges[v];
            return '<a href="' + href + '"' + (on === v ? ' aria-current="page"' : '') + '>' + inner
                + (b ? '<span class="nb' + (b[1] ? ' ' + b[1] : '') + '">' + b[0] + '</span>' : '') + '</a>';
        };
        var t = THEMES[th];
        return '<nav class="sidenav" data-block="nav" aria-label="功能"><ul>' + NAV_TREE.map(function (g) {
            if (!g.kids) return '<li class="navcat">' + link(g.v, g.href, icon(g.ico) + '<span>' + g.label + '</span>') + '</li>';
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
            + ' title="主題：' + t[1] + '（按一下換' + THEMES[t[2]][1] + '）" aria-label="主題：' + t[1] + '，按一下換' + THEMES[t[2]][1] + '">'
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
    // 現在 (進行中, `#/live`): one card per registry that is still there, its
    // live and stale sessions under it. A session that is down has finished
    // and is on 最近 sessions instead. `tabs` is the Sessions tab strip.
    function nowHtml(projects, sessions, tabs) {
        var cards = projects.filter(function (p) { return !p.gone; }).map(function (p) {
            var own = sessions.filter(function (s) { return s.root === p.root && (s.state === 'live' || s.state === 'stale'); });
            return '<section class="reg"><div class="reg-h"><b class="mono reg-root">' + esc(p.root) + '</b><span class="spacer"></span>'
                + clearStaleControl(p, own) + '</div>'
                + (own.length ? own.map(function (s) {
                    return '<a class="srow ' + s.state + '" data-state="' + s.state + '" href="' + sessionHash(s.id) + '">'
                        + '<div class="srow-a">' + statePill(s) + '<span>' + esc(s.task || '（未命名）') + '</span></div>'
                        + '<div class="srow-b"><span class="mono">' + esc(s.stage || '—') + '</span><span class="ago">' + ago(s.updated) + '</span></div></a>';
                }).join('') : '<p class="none">沒有進行中的 session</p>') + '</section>';
        });
        return '<div class="phead"><h1>' + icon('now') + '現在</h1></div>' + (tabs || '') + '<div class="regs" data-block="now">'
            + (cards.length ? cards.join('') : '<p class="mute">沒有 registry</p>') + '</div>';
    }
    // ---- 設定: the seven-step wizard ----------------------------------------
    // Every question is a habit; a habit card recommends values and the
    // buttons under it take them or not. `val` holds strings or null (ask).
    var WIZ_STAGES = ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'];
    var WIZ_STEPS = [
        { id: 'land', t: '收尾', q: '一件工作做完，你通常怎麼收？', sub: '這決定 land 站停不停下來問你。選一個最像你的習慣，下面可以逐鍵改。', keys: ['land.integration', 'land.push', 'land.archivePlan'],
            habits: [
                { l: '本機 merge 就好', b: '直接合回 main，commit 留在本機，我自己決定什麼時候推。', s: { 'land.integration': 'merge', 'land.push': 'false', 'land.archivePlan': 'true' } },
                { l: '開 PR 給人看', b: '推上去開 PR，review 過再合。', s: { 'land.integration': 'pr', 'land.push': 'true', 'land.archivePlan': 'true' } },
                { l: '留在分支', b: '分支先留著，整合我自己來。計畫也先別封存。', s: { 'land.integration': 'keep', 'land.push': 'false', 'land.archivePlan': null } },
                { l: '每次都問我', b: '每個 repo 不一樣，到了收尾再決定。', s: { 'land.integration': null, 'land.push': null, 'land.archivePlan': null } },
            ] },
        { id: 'class', t: '任務大小', q: '你起的任務，多半是多大？', sub: '起任務沒指定類別時用這個預設；它決定走哪幾站。', keys: ['class.default'],
            habits: [
                { l: '試水溫', b: '先做個小實驗看行不行，做完可能丟掉。', s: { 'class.default': 'spike' } },
                { l: '範圍清楚的功能', b: '知道要改哪裡、改完怎麼驗。', s: { 'class.default': 'bounded' } },
                { l: '常動到架構', b: '牽動好幾個模組，需要先設計再動手。', s: { 'class.default': 'architectural' } },
                { l: '每次不一樣', b: '起任務時問我。', s: { 'class.default': null } },
            ] },
        { id: 'front', t: '前端', q: '這個專案有前端畫面嗎？', sub: '有的話，design 站會先做一頁 mockup 給你看，再談實作。', keys: ['design.mockup', 'design.skill'],
            habits: [
                { l: '沒有前端', b: 'CLI、函式庫或純文件，不用畫頁面。', s: { 'design.mockup': 'false' } },
                { l: '有，快速草圖', b: '先看個大概，sonnet 畫就夠。', s: { 'design.mockup': 'sonnet' } },
                { l: '有，要仔細畫', b: '畫面是重點，用 opus 做完整的頁面。', s: { 'design.mockup': 'opus' } },
                { l: '有，用最強的', b: '交給 fable 畫。', s: { 'design.mockup': 'fable' } },
            ] },
        { id: 'agents', t: 'context', q: '你在不在意主 session 的 context 被吃掉？', sub: '交給站 agent 的站，會在自己乾淨的 context 裡跑，主控只拿回一個路徑。', keys: ['stage.agents'],
            habits: [
                { l: '不在意，全部自己跑', b: '每一站都在主 session 裡，看得最清楚。', s: { 'stage.agents': 'false' } },
                { l: '只交出 survey', b: '讀 repo 最吃 context，只把這站交出去。', s: { 'stage.agents': 'survey' } },
                { l: '省 context', b: 'survey、build、verify 三站交出去。', s: { 'stage.agents': 'survey,build,verify' } },
                { l: '全部交出去', b: '主控只轉路徑，七站都給站 agent。', s: { 'stage.agents': 'all' } },
            ] },
        { id: 'guard', t: '撞檔', q: '別的 session 正在改同一個檔案時，你要怎樣？', sub: '兩個 session 同時動一個檔案，其中一邊的改動可能被蓋掉。', keys: ['guard'],
            habits: [
                { l: '先問我', b: '停下來讓我決定要不要繼續。', s: { guard: 'ask' } },
                { l: '直接擋掉', b: '被佔的檔案不准改，等對方放手。', s: { guard: 'deny' } },
                { l: '提醒一下就好', b: '我知道自己在做什麼，警告但不停。', s: { guard: 'off' } },
            ] },
        { id: 'model', t: '模型', q: '派出去的 agent，你比較在意錢還是品質？', sub: '最低模型是實作者和 reader 的下限；判官是卡住時問的那一個。', keys: ['dispatch.floor', 'judge.model'],
            habits: [
                { l: '省錢', b: '讀檔用 haiku 就夠，判官用 opus。', s: { 'dispatch.floor': 'haiku', 'judge.model': 'opus' } },
                { l: '平衡', b: '實作至少 sonnet，判官用 fable。', s: { 'dispatch.floor': 'sonnet', 'judge.model': 'fable' } },
                { l: '品質優先', b: '實作至少 opus，判官用 fable。', s: { 'dispatch.floor': 'opus', 'judge.model': 'fable' } },
            ] },
        { id: 'station', t: '監控站', q: '這個專案要出現在監控站上嗎？', sub: '隱藏後它的 session 和 profile 卡都不會在這頁出現；要再打開得用指令。', keys: ['station.hide'],
            habits: [
                { l: '要，照常顯示', b: '', s: { 'station.hide': 'false' } },
                { l: '不要，藏起來', b: '私人或暫時的專案。', s: { 'station.hide': 'true' } },
            ] },
        { id: 'answer', t: '答 gate', q: '要不要在監控站上直接回答 gate？', sub: 'gate 發出後，terminal 先等監控站的答案這麼多秒，逾時才在 terminal 問你；等的時候 terminal 不顯示問題。', keys: ['gate.station'],
            habits: [
                { l: '不用，在 terminal 答', b: '', s: { 'gate.station': 'off' } },
                { l: '等一分鐘', b: '人就在頁面旁邊時。', s: { 'gate.station': '60' } },
                { l: '等五分鐘', b: '常離開座位、用手機看頁面時。', s: { 'gate.station': '300' } },
            ] },
    ];
    function wizList(v) { return v === null || v === 'false' ? [] : v === 'true' ? ['survey'] : v === 'all' ? WIZ_STAGES.slice() : v.split(','); }
    function wizNorm(arr) {
        arr = WIZ_STAGES.filter(function (s) { return arr.indexOf(s) >= 0; });
        return !arr.length ? 'false' : arr.length === WIZ_STAGES.length ? 'all' : arr.join(',');
    }
    // A value off `lib/profile.js` `read()` — a boolean, a stage array or a
    // string — in the text form the buttons and the POST use.
    function wizText(v) {
        if (v === undefined || v === null) return null;
        return Array.isArray(v) ? wizNorm(v) : String(v);
    }
    function wizShow(v) { return v === null ? '(ask)' : String(v); }
    function wizSame(a, b) { return String(a) === String(b); }
    function wizOverridden(W, k) { return Object.prototype.hasOwnProperty.call(W.rec, k) && !wizSame(W.rec[k], W.val[k]); }
    // What this scope's own file holds for k.
    function wizOwn(profiles, scope, k) {
        var p = scope === 'machine' ? profiles.machine : (profiles.projects || {})[scope];
        var want = scope === 'machine' ? 'machine' : 'project';
        return p && p.sources && p.sources[k] === want ? { has: true, v: wizText(p.values[k]) } : { has: false, v: null };
    }
    // What the layers under this scope supply: machine, then builtin.
    function wizBelow(profiles, keys, scope, k) {
        var m = profiles.machine;
        if (scope !== 'machine' && m && m.sources && m.sources[k] === 'machine') return { v: wizText(m.values[k]), src: 'machine' };
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
        var out = [{ id: 'machine', label: '機器預設', file: (configDir ? String(configDir).replace(/[\\/]+$/, '') + '/' : '') + 'fankeel/profile.json' }];
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
            return '<div class="stations" role="group" aria-label="stage.agents 七站">' + WIZ_STAGES.map(function (s) {
                var p = on.indexOf(s) >= 0;
                return '<button type="button" class="wstn' + (ron.indexOf(s) >= 0 ? ' rec' : '') + '" data-k="' + k + '" data-st="' + s
                    + '" aria-pressed="' + p + '" style="--c:var(--st-' + s + ')"><i class="wpt"></i><span class="wnm">' + s
                    + '</span><span class="wst">' + (p ? '站 agent' : '主控') + '</span></button>';
            }).join('') + '</div><div class="stkey"><span>' + on.length + ' / 7 站交出去</span>'
                + (hasRec ? '<span><i></i>建議開的站</span>' : '') + '<span>寫進檔的值 <span class="wout">' + esc(wizNorm(on)) + '</span></span></div>';
        }
        var spec = keys[k], opts = spec.values.slice();
        if (spec.builtin === null) opts.push(null);
        var inh = v === null ? wizBelow(profiles, keys, W.scope, k).v : null;
        return '<span class="opts" role="group" aria-label="' + esc(k) + '">' + opts.map(function (o) {
            return '<button type="button" class="opt' + (o === null ? ' ask' : '') + (hasRec && wizSame(r, o) ? ' rec' : '')
                + (inh !== null && wizSame(inh, o) ? ' inh' : '') + '" data-k="' + esc(k) + '" data-o="' + (o === null ? '' : esc(o))
                + '" aria-pressed="' + wizSame(v, o) + '">' + (o === null ? '每次問我' : esc(o)) + '</button>';
        }).join('') + '</span>';
    }
    function wizStepsHtml(W) {
        var n = WIZ_STEPS.length;
        return WIZ_STEPS.map(function (st, i) {
            var c = i === W.step ? 'wcur' : (W.pick[i] !== undefined ? 'wdone' : '');
            var s = st.keys.map(function (k) { return wizShow(W.val[k]); }).join(' · ');
            return '<li class="' + c + '"><button type="button" data-go="' + i + '"><span class="wdotn">' + (i + 1) + '</span><span class="wt">'
                + st.t + '</span><span class="ws">' + esc(s) + '</span></button></li>';
        }).join('') + '<li class="wsumli' + (W.step === n ? ' wcur' : '') + '"><button type="button" data-go="' + n
            + '"><span class="wdotn">✓</span><span class="wt">摘要與寫入</span><span class="ws">' + Object.keys(W.val).length + ' 鍵</span></button></li>';
    }
    function wizStepHtml(keys, W, profiles) {
        var n = WIZ_STEPS.length, st = WIZ_STEPS[W.step];
        var fine = st.keys.filter(function (k) {
            return k !== 'design.skill' || (W.val['design.mockup'] !== null && W.val['design.mockup'] !== 'false');
        });
        return '<div class="wcard" data-block="wizard-step"><div class="prog" aria-hidden="true"><i style="width:' + Math.round((W.step + 1) / (n + 1) * 100) + '%"></i></div>'
            + '<div class="wtop"><span class="eyebrow">第 ' + (W.step + 1) + ' 題 · ' + st.t + '</span><span class="wof">' + (W.step + 1) + ' / ' + n
            + '</span><span class="spacer"></span><button class="wlk" type="button" data-go="' + n + '">跳到摘要 →</button></div>'
            + '<h2 class="wq">' + st.q + '</h2><p class="wqsub">' + st.sub + '</p>'
            + '<div class="habits" role="group" aria-label="' + st.t + '">' + st.habits.map(function (hb, j) {
                return '<button type="button" class="habit" data-h="' + j + '" aria-pressed="' + (W.pick[W.step] === j) + '"><b>' + hb.l + '</b>'
                    + (hb.b ? '<span class="wbl">' + hb.b + '</span>' : '')
                    + '<span class="wsets">' + Object.keys(hb.s).map(function (k) { return esc(k) + ' → ' + esc(wizShow(hb.s[k])); }).join('<br>') + '</span></button>';
            }).join('') + '</div>'
            + '<div class="fine"><div class="eyebrow">細調 · 這一題會設的鍵</div>' + fine.map(function (k) {
                return '<div class="fk"><span class="wk">' + esc(k) + '</span><span class="wd">' + esc(keys[k].desc || '') + '</span><span class="ctlc">'
                    + wizOpts(keys, W, profiles, k) + (wizOverridden(W, k) ? '<span class="ovr">改過建議</span>' : '') + '</span></div>';
            }).join('') + '</div>'
            + (st.id === 'station' && W.scope === 'machine' ? '<p class="wnote">現在寫的是機器預設：station.hide 設在這裡，會讓每個沒寫這個鍵的專案都跟著隱藏。</p>' : '')
            + '<div class="wnav"><button class="ctl" type="button" data-go="' + (W.step - 1) + '"' + (W.step ? '' : ' disabled') + '>← 上一題</button><span class="spacer"></span>'
            + '<span class="whint">' + (W.pick[W.step] === undefined ? '沒選也可以往下，這題的鍵維持現在的值' : '') + '</span>'
            + '<button class="ctl" type="button" data-go="' + (W.step + 1) + '">' + (W.step === n - 1 ? '看摘要 →' : '下一題 →') + '</button></div></div>';
    }
    function wizWriteHtml(ch, W, ctx, file) {
        var label = '寫入 ' + ch.length + ' 鍵';
        if (!ch.length) return '<button class="ctl" type="button" disabled>' + label + '</button>';
        if (!ctx.serve) {
            return '<div class="wcmd mono">' + ch.map(function (c) {
                return c.value === '' ? '從 ' + esc(file) + ' 刪掉 ' + esc(c.key)
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
                from = inh.src ? '往下讀到 <span class="mono">' + inh.src + ': ' + esc(inh.v) + '</span>' : '沒有下層值，到時候會問';
            } else if (m) { src = W.scope === 'machine' ? 'machine' : 'project'; from = '寫入後'; }
            else { src = now.src; from = src ? '' : '沒有值'; }
            return '<div class="sr' + (o ? ' ov' : '') + (m ? ' moved' : '') + '" data-key="' + esc(k) + '"><span class="wk">' + esc(k) + '</span><span class="wd">' + esc(keys[k].desc || '') + '</span>'
                + '<span class="ctlc">' + wizOpts(keys, W, profiles, k) + (o ? '<span class="ovr">改過建議 · 建議是 <span class="mono">' + esc(wizShow(W.rec[k])) + '</span></span>' : '') + '</span>'
                + '<span class="wmeta"><span class="from">' + from + (src ? ' <span class="src ' + src + (m && v !== null ? ' wpend' : '') + '">' + src + '</span>' : '') + '</span>'
                + '<button type="button" class="askb" data-ask="' + esc(k) + '"' + (v === null || (!own.has && !m) ? ' disabled' : '') + '>清成 <span class="wm">(ask)</span></button></span></div>';
        }).join('');
        var scopes = wizScopes(profiles, ctx.configDir), file = '';
        scopes.forEach(function (s) { if (s.id === W.scope) file = s.file; });
        return '<div class="wcard" data-block="wizard-summary"><div class="prog" aria-hidden="true"><i style="width:100%"></i></div>'
            + '<div class="wtop"><span class="eyebrow">摘要</span><span class="wof">' + Object.keys(keys).length + ' 鍵</span><span class="spacer"></span>'
            + '<button class="wlk" type="button" data-go="0">← 從第 1 題重來</button></div>'
            + '<h2 class="wq">答案換成的設定</h2><p class="wqsub">每一列都能直接按鈕改；和精靈建議不一樣的列會標出來。「清成 (ask)」是把這一鍵從這一層的檔案拿掉，改讀下一層。</p>'
            + '<div class="scopebar"><label>寫到</label><span class="seg" role="group" aria-label="寫到哪一層">' + scopes.map(function (s) {
                return '<button type="button" data-scope="' + esc(s.id) + '" aria-pressed="' + (W.scope === s.id) + '">' + esc(s.label) + '</button>';
            }).join('') + '</span></div>'
            + '<div class="pf-file">' + esc(file) + (W.scope === 'machine' ? ' · 每個專案沒寫的鍵都讀這裡' : ' · 沒寫的鍵往下讀機器預設，再往下是 builtin') + '</div>'
            + '<div class="srows">' + rows + '</div>'
            + '<div class="writebar"><span class="wsum">會改 <b>' + ch.length + '</b> 鍵' + (ov ? '，其中 <b>' + ov + '</b> 鍵和建議不同' : '') + '</span><span class="spacer"></span>'
            + '<button class="ctl" type="button" data-go="' + (n - 1) + '">← 回上一題</button>' + wizWriteHtml(ch, W, ctx, file) + '</div></div>';
    }
    function wizHtml(keys, W, profiles, ctx) {
        var body = W.step >= WIZ_STEPS.length ? wizSummaryHtml(keys, W, profiles, ctx) : wizStepHtml(keys, W, profiles);
        return '<div class="phead"><h1>' + icon('settings') + '設定</h1></div><div class="wz" data-block="wizard"><ol class="steps" data-block="wizard-steps">'
            + wizStepsHtml(W) + '</ol><div class="wbody">' + body + '</div></div>';
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
                + (q.multiSelect ? '<span class="multi">可多選</span>' : '') + '</legend><div class="opts2">'
                + (q.options || []).map(function (o) {
                    return '<label class="pgo o"><input type="' + type + '" name="pg-' + i + '" value="' + esc(o.label) + '"'
                        + (had.indexOf(o.label) >= 0 ? ' checked' : '') + dis + '> <b>' + esc(o.label) + '</b> <small>'
                        + esc(o.description || '') + '</small></label>';
                }).join('')
                + '<label class="pgo o other"><input type="' + type + '" name="pg-' + i + '" value="__other"'
                + (had.indexOf('__other') >= 0 ? ' checked' : '') + dis + '> <b>其他</b><input type="text" class="pgt" data-pg-other="' + i
                + '" value="' + esc(others[i]) + '" placeholder="自己寫…" aria-label="' + esc(q.header || q.question) + '：其他"' + dis + '></label>'
                + '</div></fieldset>';
        }).join('');
        return '<div class="pg gp" data-block="pending-gate" data-pg-root="' + esc(s.root) + '" data-pg-id="' + esc(s.id) + '">'
            + '<div class="h2">懸著的 gate <small>terminal 還等 ' + dur(left) + '，逾時就回 terminal 問</small></div>' + qs
            + (S.serve ? '<div class="act gpf"><span class="cnt">已答 <b class="pgn">' + (n - got.missing) + ' / ' + n + '</b></span>'
                + '<span class="why">每題都要有答案</span><span class="spacer"></span>'
                + '<button type="button" class="go" data-answer' + (got.missing ? ' disabled' : '') + '>送出答案</button></div>'
                + '<div class="pgr" role="status" aria-live="polite"></div>'
                : '<p class="tally">靜態頁不能作答：開 serve 的頁面，或回 terminal 答。</p>') + '</div>';
    }

    // The hero's eyebrow carries the frozen moment too, so a reader who has
    // scrolled past the bar is not reading numbers they take for live. The
    // hh:mm is the caller's, off the same `stamp()` the bar's absolute time
    // comes from: two places on the page, one clock read.
    function heroEyebrow(frozenAt) {
        return frozenAt ? '近 30 天 · 凍結於 ' + frozenAt : '近 30 天';
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
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
            localDay: localDay, lastDays: lastDays, parseHash: parseHash, family: family, sessionTotals: sessionTotals,
            windowTotals: windowTotals, dayBars: dayBars, projectRows: projectRows, kpiHtml: kpiHtml,
            histSvg: histSvg, legendHtml: legendHtml, projectsHtml: projectsHtml, recentHtml: recentHtml,
            dayStart: dayStart, projectHead: projectHead, sessionPoints: sessionPoints, projectChart: projectChart,
            projectSessionsHtml: projectSessionsHtml,
            timelineModel: timelineModel, timelineSvg: timelineSvg, costModel: costModel, costHtml: costHtml,
            sessionHeadHtml: sessionHeadHtml, tabsHtml: tabsHtml, serveLost: serveLost,
            heroEyebrow: heroEyebrow, docsCardHtml: docsCardHtml,
            railHtml: railHtml, liveTag: liveTag,
            navHtml: navHtml, navCounts: navCounts, recentRows: recentRows, nowHtml: nowHtml,
            WIZ_STEPS: WIZ_STEPS, wizLoad: wizLoad, wizApply: wizApply, wizChanges: wizChanges, wizHtml: wizHtml,
            segTip: segTip,
            tk: tk,
            stageShare: stageShare, costShareHtml: costShareHtml, subtabsHtml: subtabsHtml,
            dashLive: dashLive, dashGate: dashGate, dashSpend: dashSpend, dashRecent: dashRecent, dashPage: dashPage,
            NAV_TREE: NAV_TREE,
        };
    }
    if (!doc) return;
    var f = { q: '', state: '', project: '', stage: '' };
    var route = parseHash(w.location && w.location.hash), sel = null, sortKey = 'updated', sortDir = -1;
    // The home page's two segmented controls; Tasks 7 and 8 add their own keys.
    var view = { metric: 'usd', dim: 'model' };
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
        return (route || []).join(' → ') || '（沒有 route）';
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
        if (!groups.length) return '<div class="empty">這個篩選下沒有 session</div>';
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
                    + hours(ms) + ' 做事 · ' + hours(wait) + ' 等你 · ' + n + ' 個</div></td>'
                    + '<td class="r num mute">' + tokens(Math.round(x.burn / n)) + '</td>'
                    + '<td class="r num">' + usd(x.usd / n) + '</td>'
                    + '<td class="r num" style="color:' + (wait > ms ? 'var(--dn)' : 'var(--mute)') + '">'
                    + Math.round(wait / (ms + wait || 1) * 100) + '%</td></tr>';
            };
            return '<div class="rgh"><b>' + esc(g.name) + '</b><span class="mute">' + g.n + ' 個 session · 有倒退 '
                + g.backN + ' 個、倒退 ' + g.backtracks + ' 次</span></div>'
                + '<table><colgroup><col style="width:96px"><col><col style="width:64px"><col style="width:64px">'
                + '<col style="width:52px"></colgroup><thead><tr><th>階段</th><th>平均：做事 / 等你</th>'
                + '<th class="r">context</th><th class="r">花費</th><th class="r">等待</th></tr></thead><tbody>'
                + names.map(function (k) {
                    return line('<span class="chip" style="background:' + STAGE_C[k] + '1f;border-color:transparent;color:'
                        + STAGE_C[k] + ';font-weight:600">' + k + '</span>', g.stages[k], g.stages[k].n, STAGE_C[k]);
                }).join('')
                + (g.backN ? line('<span class="chip" style="color:var(--dn);border-color:var(--dn)">有倒退</span>',
                    g.back, g.backN, 'var(--dn)') : '')
                + '</tbody></table>';
        }).join('');
    }
    function taskCell(s) {
        return '<div class="ell" title="' + esc(s.task) + '" style="font-weight:500">'
            + esc(s.task || '（未命名）') + '</div>'
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
            + '<p class="mute" style="margin:0;flex:1">' + p.unreadable
            + ' 個 session 檔案讀不到</p>' + clearStaleControl(p, own) + '</div>'
            + '<p class="mute" style="margin:4px 0 0">map.md '
            + (p.mapAt ? '更新於 ' + day(p.mapAt) : '不存在') + '</p>'
            + (p.build.length
                ? '<p class="mute" style="margin:4px 0 0">build：' + p.build.map(function (b) {
                    return esc(b.name) + ' (' + b.files + ')';
                }).join('、') + '</p>'
                : '<p class="mute" style="margin:4px 0 0">沒有 build 資料夾</p>')
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
            + '<a class="dmore" href="' + href + '">查看全部 →</a></div>';
    }
    function dashRowName(s) { return esc(shortLabel(NAMES[s.pkey] || s.pkey)); }
    function dashLive(R) {
        var live = R.filter(function (s) { return s.state === 'live'; });
        return '<section class="dcard" data-block="dash-live">' + dashHead('now', '進行中', '#/live')
            + '<div class="dbig">' + live.length + '<small>個 live session</small></div>'
            + (live.length ? '<div class="dlist">' + live.map(function (s) {
                return '<a class="drow" href="' + sessionHash(s.id) + '"><span class="dp">' + dashRowName(s) + '</span>'
                    + '<span class="dt">' + esc(s.task || '（未命名）') + '</span>' + routeDots(s, true)
                    + '<span class="dr mono">' + mins(Date.now() - msOf(s.started)) + '</span></a>';
            }).join('') + '</div>' : '<p class="dnone">沒有進行中的 session</p>') + '</section>';
    }
    // Waiting is what `pendingGateHtml` answers: a pending file with questions.
    // The file's own start is not in the data, so the wait runs from the
    // session's last registry write, which is the gate's stage opening or later.
    function dashGate(R) {
        var now = S.serve ? Date.now() : NOW;
        var at = R.filter(function (s) { return s.pending && s.pending.questions && s.pending.questions.length; });
        return '<section class="dcard" data-block="dash-gate">' + dashHead('gate', '等你回答', '#/live')
            + '<div class="dbig' + (at.length ? ' warn' : '') + '">' + at.length + '<small>個 gate 在等</small></div>'
            + (at.length ? '<div class="dlist">' + at.map(function (s) {
                var since = msOf(s.pending.at || s.updated), q = s.pending.questions[0];
                return '<a class="drow" href="' + sessionHash(s.id) + '"><span class="dp">' + dashRowName(s) + '</span>'
                    + '<span class="dt">' + esc(q.header || q.question || s.task || '') + '</span>'
                    + '<span class="dr mono" title="還剩 ' + dur(Math.max(0, Math.round((s.pending.until - now) / 1000))) + '">等了 '
                    + (isFinite(since) ? mins(now - since) : '—') + '</span></a>';
            }).join('') + '</div>' : '<p class="dnone">沒有在等你的 gate</p>') + '</section>';
    }
    // The 近 30 天 chart's own bars, summed per day, drawn without axes.
    function dashSpend(R) {
        var list = dayBars(R, 'usd', 'project', DAYS).days, mx = Math.max.apply(null, list.map(function (b) { return b.total; }).concat([0])) || 1;
        var W = 300, H = 56, bw = W / list.length, tot = windowTotals(R, DAYS).usd;
        var svg = '<svg class="dspark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="近 30 天每日花費">'
            + list.map(function (b, i) {
                var h = b.total ? Math.max(2, b.total / mx * (H - 2)) : 0;
                return '<rect x="' + (i * bw + 1).toFixed(1) + '" y="' + (H - h).toFixed(1) + '" width="' + Math.max(1, bw - 2).toFixed(1)
                    + '" height="' + h.toFixed(1) + '" rx="1"' + (i === list.length - 1 ? ' class="today"' : '')
                    + '><title>' + b.day + ' ' + usd(b.total) + '</title></rect>';
            }).join('') + '<line x1="0" x2="' + W + '" y1="' + (H - .5) + '" y2="' + (H - .5) + '"/></svg>';
        var at = function (i) { var b = list[list.length - i]; return b ? usd(b.total) : '—'; };
        return '<section class="dcard" data-block="dash-spend">' + dashHead('spend', '近 30 天花費', '#/days')
            + '<div class="dbig">' + (tot ? usd(tot) : '$0') + '</div>' + svg
            + '<div class="dkv"><span>今天 <b>' + at(1) + '</b></span><span>昨天 <b>' + at(2) + '</b></span></div></section>';
    }
    function dashRecent(R) {
        var list = recentRows(R, DAYS).slice(0, 5);
        return '<section class="dcard" data-block="dash-recent">' + dashHead('sessions', '最近 sessions', '#/sessions')
            + (list.length ? '<div class="dlist">' + list.map(function (s) {
                return '<a class="drow" href="' + sessionHash(s.id) + '"><span class="dp">' + dashRowName(s) + '</span>'
                    + '<span class="dt">' + esc(s.task || '（未命名）') + '</span><span class="ds mono">' + esc(s.stage || '—') + '</span>'
                    + '<span class="dc mono">' + usd(sessionTotals(s).usd) + '</span><span class="dr">' + ago(s.updated) + '</span></a>';
            }).join('') + '</div>' : '<p class="dnone">近 30 天沒有 session</p>') + '</section>';
    }
    function dashPage() {
        var R = homeRows();
        return '<div class="phead"><h1>' + icon('dash') + '儀表板</h1></div><div class="dash" data-block="dashboard">'
            + dashLive(R) + dashGate(R) + dashSpend(R) + dashRecent(R) + '</div>';
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
            + '<div class="controls"><div class="ctlgrp"><label>長條高度</label>'
            + segHtml('metric', [['tokens', 'token'], ['usd', '花費'], ['time', '時間']], view.metric) + '</div>'
            + '<div class="ctlgrp"><label>分段</label>'
            + segHtml('dim', [['model', '依 model'], ['project', '依專案'], ['stage', '依 stage'], ['who', '主 session 對 agent'],
                ['version', '依版本'], ['kind', '依成分']],
                view.dim, view.metric === 'time' ? { model: '時間沒有 model 可分', kind: '時間沒有成分可分' } : null) + '</div></div>'
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
    function docsPage() {
        var list = [].concat.apply([], S.projects.map(function (p) { return p.docs || []; }));
        return '<div data-block="docs">' + (list.length ? docsCardHtml(list, homeOpts(null))
            : '<p class="mute">還沒有專案生成 <span class="mono">.fankeel/map.md</span></p>') + '</div>';
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
        if (!all.length) return '<section class="panel"><p class="note">這頁上沒有專案 ' + esc(r.pkey) + '</p></section>';
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
        return '<section class="panel"><div class="hero-top"><div><div class="eyebrow">專案</div>'
            + '<h1 class="s-title"><i class="sw" style="background:' + colorOf('project', r.pkey, PKEYS) + '"></i> '
            + esc(NAMES[r.pkey] || r.pkey) + '</h1><div class="mono muted">' + esc(r.pkey) + '</div></div>'
            + '<div class="readouts">' + ro('近 30 天花費', usd(head.usd)) + ro('token', tokens(head.tokens))
            + ro('active 時間', hours(head.active)) + ro('session', head.n) + '</div></div>'
            + '<div class="controls"><div class="ctlgrp"><label>縱軸</label>'
            + segHtml('pMetric', [['tokens', 'token'], ['usd', '花費']], view.pMetric) + '</div>'
            + (others.length ? '<div class="ctlgrp"><label>對照專案</label>' + segHtml('compare', [['', '無']].concat(others.map(function (k) {
                return [k, NAMES[k] || k];
            })), view.compare) + '</div>' : '')
            + '<div class="legend">' + series.map(function (s) {
                return '<span><i class="sw ln" style="background:' + s.colour + '"></i>' + esc(s.name) + ' <span class="muted">'
                    + s.points.length + ' 個</span></span>';
            }).join('') + '</div></div>'
            + '<div class="chart">' + projectChart(series, { metric: view.pMetric, t0: t0, t1: t1, days: DAYS, today: TODAY }) + '</div>'
            + '<div class="note">每個點是一個 session，放在它開始的時刻；線依時間先後連接，點一下開啟那個 session。</div></section>'
            + registryNote(all[0].root)
            + '<section class="panel"><div class="h2">Sessions <small>近 30 天 ' + list.length + ' 個，最新在上；勾兩列進比較</small>'
            + '</div>' + projectSessionsHtml(list, picked) + selbarHtml() + '</section>'
            + '<section class="panel"><div class="h2">各 route 的階段 <small>只算這個專案</small></div>' + routeLedger(mine) + '</section>';
    }
    VIEWS.project = projectPage;
    CRUMBS.project = function (r) { return [[NAMES[r.pkey] || r.pkey, null]]; };
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
    function dispatchUi(s) {
        return { open: view.open, prm: view.prm, ph: view.ph, filter: view.dfilter,
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
        if (!s) return '<section class="panel"><p class="note">這頁上沒有 session ' + esc(r.id) + '</p></section>';
        needDetail(s);
        var x = DETAIL[s.id] || null;
        // 概覽 draws its money from `days` on the data file, so that half answers
        // before the detail script has loaded; the timeline and the two lists
        // need the detail. The old 花費 tab's stage × model table is the
        // 明細 under the bar.
        var L = stageShare(s, x), hi = view.hiId === s.id ? view.hi : null;
        var legend = '<div class="lane-legend"><span><i class="sw" style="background:var(--st-build);opacity:.35"></i>stage 底色</span>'
            + '<span><i class="hatchsw"></i>等你回答（gate）</span>'
            + '<span><i class="sw ln" style="background:var(--ctx)"></i>主 session context</span>'
            + MODEL_KEYS.map(function (k) {
                return '<span><i class="sw" style="background:var(--m-' + k + ')"></i>' + k + '</span>';
            }).join('')
            + '<span><i class="sw" style="background:var(--s-agent)"></i>背景 agent</span>'
            + '<span><i class="sw" style="background:var(--s-workflow)"></i>workflow</span></div>';
        // The bar leads: it is short, and the timeline under it can run to
        // dozens of agent rows.
        var overview = costShareHtml(L, hi) + (x ? legend + '<div class="chart tl">' + timelineSvg(stageCost(timelineModel(x), s), view.closed, hi) + '</div>'
                + '<div class="note">橫軸是真實時間：stage 的底色寬度等於實際經過的時間，context 曲線畫在上面；'
                + '游標停在圖上看那一刻的 stage、時間與 context；點一下標出那個 stage；點 workflow 那列收合或展開。</div>'
            : detailNote(s))
            + '<details class="csmore"><summary>stage × model 明細 <small>token 與各自的 USD，主迴圈</small></summary>'
            + costHtml(costModel(s.days), x) + '</details>'
            + (x ? '<div class="det">' + ctxSection(s, x, true) + tasksHtml(x.tasks) + '</div>' : '');
        var body = r.tab === 'dispatch' ? (x ? dispatchStagesHtml(L, s.id) + '<div class="det">' + dispatchHtml(x, s, dispatchUi(s)) + '</div>' : detailNote(s))
            : r.tab === 'events' ? (x ? '<div class="det">' + replayHtml(x, view.kinds, s) + '</div>' : detailNote(s))
                : overview;
        return '<section class="panel"><div class="eyebrow">session <span class="mono">' + esc(String(s.id).slice(0, 8)) + '</span> · '
            + '<a href="' + projectHash(s.pkey) + '">' + esc(NAMES[s.pkey] || s.pkey) + '</a> · ' + stamp(Date.parse(s.started)) + '</div>'
            + '<h1 class="s-title">' + esc(s.task || '（未命名）') + '</h1>'
            + '<div class="s-meta">' + statePill(s) + (S.serve ? liveTag(s.state === 'live', polledAt, Date.now()) : '')
            + (s.model ? '<span class="chip"><i class="sw" style="background:var(--m-' + family(s.model) + ')"></i>主 session <span class="mono">'
                + esc(s.model) + '</span></span>' : '') + '</div>'
            + railHtml(s, Boolean(S.serve) && s.state === 'live', S.serve ? Date.now() : NOW)
            + pendingGateHtml(s, view.pg)
            + sessionHeadHtml(s, x) + '</section>'
            + tabsHtml(s, r.tab, x) + '<section class="panel">' + body + '</section>';
    }
    VIEWS.session = sessionPage;
    CRUMBS.session = function (r) {
        var s = S.sessions.filter(function (x) { return x.id === r.id; })[0];
        return s ? [[NAMES[s.pkey] || s.pkey, projectHash(s.pkey)], [s.task || String(s.id).slice(0, 8), null]] : [[r.id, null]];
    };
    // `started` has a column of its own because the page this replaces sorted
    // by it, and a sort key with no header is a sort nobody can reach.
    var COLS = [['task', '任務'], ['stage', '階段'], ['burn', 'context'],
        ['cost', '花費'], ['state', '狀態'], ['started', '開始'], ['updated', '最後動作']];
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
            + ' aria-label="' + name + '：' + esc(cur.sub || cur.main) + '" title="' + name + (cur.sub ? '：' + esc(cur.sub) : '') + '">'
            + ico + (cur.lead || '') + '<span class="fl">' + esc(cur.main) + '</span><b class="fc">' + cur.n + '</b>' + CARET + '</button>'
            + (cur.v ? '<button type="button" class="rclr" data-pickclr="' + key + '" aria-label="' + name + '回到全部" title="回到全部">×</button>' : '')
            + (open ? '<div class="rpop">'
                + (search ? '<input type="search" data-pickq placeholder="找 ' + name + '" aria-label="找 ' + name + '" value="' + esc(pickQ) + '">' : '')
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
            + pickHtml('state', FICON.state, '狀態', [{ v: '', main: '全部', n: all }].concat(['live', 'stale', 'down'].map(function (k) {
                return { v: k, main: k, n: n[k], lead: '<i class="dot ' + k + '"></i>' };
            })))
            + pickHtml('project', icon('projects'), 'Registry', [{ v: '', main: '全部', n: all }].concat(S.projects.map(function (p, i) {
                // The path's last segment, unless another registry ends the same way.
                var t = tail.filter(function (x) { return x === tail[i]; }).length > 1 ? LAB[p.root] || p.root : tail[i];
                return { v: p.root, main: t + (p.gone ? ' — gone' : ''), sub: p.root, n: byRoot[p.root] || 0 };
            })), S.projects.length > 6)
            // A stage's bar is its count against the busiest stage's.
            + pickHtml('stage', FICON.stage, '停在哪一階段', [{ v: '', main: '全部', n: all }].concat(stages.map(function (k) {
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
        return icon('cmp') + '<span>已選 <b id="ncmp">' + n + '</b> 個</span>'
            + (n >= 2 ? '<a class="sbtn pri" href="#/cmp">比較</a>'
                : '<span title="至少選 2 個"><button type="button" class="sbtn pri" disabled>比較</button></span>')
            + '<button type="button" class="sbtn" data-cmpclear' + (n ? '' : ' tabindex="-1"') + '>清除</button>';
    }
    function selbarHtml() {
        return '<div class="selbar" id="selbar" role="region" aria-label="比較勾選的 session"' + (picked.length ? ' data-on' : ' aria-hidden="true"') + '>'
            + selbarInner() + '</div>';
    }
    function listPage() {
        // A gone registry has no rows to lay out, so the note replaces the table
        // rather than sitting above it and pushing the list off the bottom.
        var head = '<div class="phead"><h1>' + icon('list') + '清單</h1><span class="chip" id="cnt"></span><span class="spacer"></span>';
        var gone = goneNote(f.project);
        var now = '<a class="ctl" href="#/live">' + icon('now') + '現在</a></div>' + subtabsHtml('list');
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
        doc.getElementById('lh').innerHTML = '<tr><th class="cmpth" aria-label="選來比較" title="勾兩個 session 來比較">' + icon('cmp') + '</th>' + COLS.map(function (c) {
            return '<th data-k="' + c[0] + '"'
                + (['burn', 'cost'].indexOf(c[0]) >= 0 ? ' class="r"' : '')
                + (sortKey === c[0] ? ' data-dir="' + (sortDir > 0 ? 'asc' : 'desc') + '"' : '')
                + '>' + c[1] + '</th>';
        }).join('') + '</tr>';
        doc.getElementById('lb').innerHTML = R.map(function (s) {
            return '<tr data-id="' + esc(s.id) + '" aria-selected="' + (sel === s.id) + '">'
                + '<td><input type="checkbox" data-cmp="' + esc(s.id) + '" aria-label="選來比較"'
                + (picked.indexOf(s.id) >= 0 ? ' checked' : '')
                + (s.hasDetail ? '' : ' disabled title="沒有 transcript，沒有細節可比"') + '></td>'
                + '<td>' + taskCell(s) + '</td><td>' + stageCell(s) + '</td>'
                + '<td class="r num mute">' + tokens(s.burn) + '</td>'
                + '<td class="r num">' + usd(cost(s)) + '</td>'
                + '<td class="c-state">' + statePill(s) + runningTag(s) + '</td>'
                + '<td class="num mute" style="font-size:11.5px">' + day(s.started) + '</td>'
                + '<td class="num mute" style="font-size:11.5px">' + ago(s.updated) + '</td></tr>';
        }).join('') || '<tr><td colspan="8"><div class="empty">沒有符合的 session</div></td></tr>';
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
        if (!hit.length) { d.innerHTML = '<div class="empty">選一列</div>'; return; }
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
            + esc(s.task || '（未命名）') + '</h2>'
            + secOpen('s-sum', '摘要', esc(s.stage || '—') + ' · ' + mins(tot)
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
                + '<thead><tr><th>階段</th><th class="r">時間</th><th class="r">ctx</th>'
                + '<th class="r">等你</th></tr></thead><tbody>'
                + s.stages.map(function (w) {
                    return '<tr><td><i class="dot" style="background:'
                        + (STAGE_C[w.stage] || '#888') + '"></i> ' + esc(w.stage) + '</td>'
                        + '<td class="r num">' + mins(w.to - w.from) + '</td>'
                        + '<td class="r num mute">' + tokens(w.burn) + '</td>'
                        + '<td class="r num mute">' + mins(w.waited) + '</td></tr>';
                }).join('') + '</tbody></table>'
                : '<p class="mute" style="font-size:12px">沒有分階段紀錄</p>')
            + (s.next ? '<div class="note"><b>下一步</b><br>' + esc(s.next) + '</div>' : '')
            + (s.notes.length
                ? '<div class="note" style="background:var(--soft)">'
                + s.notes.map(esc).join('<br>') + '</div>' : '')
            + '<dl class="dl"><dt>session</dt><dd class="mono" style="font-size:10.5px">'
            + esc(s.id) + '</dd>'
            + '<dt>route</dt><dd class="mono" style="font-size:11px">'
            + esc(s.route.join(' → ')) + '</dd>'
            + '<dt>開始</dt><dd class="num">' + stamp(Date.parse(s.started)) + '</dd>'
            + '<dt>最後</dt><dd class="num">' + stamp(s.updated) + '</dd>'
            + (s.ended ? '<dt>結束</dt><dd>' + esc(s.ended.reason) + '</dd>' : '')
            + '<dt>總計</dt><dd class="num">' + tokens(s.burn) + ' · ' + usd(cost(s))
            + (s.unpriced && s.unpriced.length ? ' (' + s.unpriced.length + ' unpriced)' : '')
            + (s.agents ? ' · ' + s.agents + ' agents' : '') + '</dd>'
            + (x ? '<dt>requests</dt><dd class="num">' + x.requests + '</dd>' : '')
            + '<dt>guard</dt><dd>' + esc(s.guard || 'ask (預設)') + '</dd></dl>'
            + '</details>'
            + secOpen('s-claims', 'claims', s.claims.length + ' 個檔', open)
            + (s.claims.length
                ? '<div class="claims">' + s.claims.map(function (p) {
                    return '<div title="' + esc(p) + '">' + esc(p) + '</div>';
                }).join('') + '</div>'
                : '<p class="mute" style="font-size:12px">沒有</p>')
            + clearControl(s) + '</details>'
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
        return '掃描於 ' + stamp(NOW)
            + ' · 價目表 ' + S.pricesVerified
            + (S.scanStats && S.scanStats.depthCuts
                ? ' · depth 中止掃描 ' + S.scanStats.depthCuts + ' 處' : '')
            + (S.scanStats && S.scanStats.timedOut ? ' · 掃描逾時未跑完' : '')
            + (!(route.view === 'list' && f.project) && totalUnreadable
                ? ' · ' + totalUnreadable + ' 個 session 檔案讀不到' : '')
            + (S.serve ? ' · 每 3 秒重讀一次，最後一次 ' + clockSec(polledAt) : '');
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
            ? '這台機器的 config dir 裡沒有這個 session 的 transcript，所以沒有 context、階段順序、派工與過程還原'
            : asked[s.id] === 'failed' ? '細節檔讀不到：station/detail/' + esc(s.id) + '.js'
                : '讀取細節…') + '</p>';
    }
    function detailSections(s, x, open) {
        return sec('s-ctx', 'context', tokens(x.peak) + ' 峰值 · ' + x.requests + ' requests', ctxSection(s, x), open)
            + sec('s-order', '階段順序', x.seq.length + ' 步 · 倒退 ' + x.backtracks, orderSection(s, x), open)
            + sec('s-split', '分工', splitCount(x), splitHtml(x), open)
            + sec('s-tasks', '任務', taskCount(x.tasks), tasksHtml(x.tasks), open)
            + sec('s-disp', '派工', x.rows.length + ' 個 agent · ' + cents(x.agentCents), dispatchHtml(x, s, dispatchUi(s)), open)
            + sec('s-rp', '過程還原', x.events.length + ' 列', replayHtml(x, view.kinds, s), open);
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
            out += '<circle class="hit" r="4" cx="' + X(p.t) + '" cy="' + Y(p.y) + '"><title>回合 ' + p.n + ' · '
                + stamp(p.t) + ' · ' + comma(p.y) + ' tokens</title></circle>';
        });
        out += '<text class="axis" x="' + L + '" y="' + (H - 4) + '">' + (o.elapsed ? '0m' : stamp(t0).slice(11)) + '</text>'
            + '<text class="axis" x="' + (W - R) + '" y="' + (H - 4) + '" text-anchor="end">'
            + (o.elapsed ? mins(t1 - t0) : stamp(t1).slice(11)) + '</text>';
        return out + '</svg>';
    }
    function riseText(r) {
        if (r.cause === 'self') return r.self.label + '，輸出 ' + comma(r.self.tok) + ' tokens';
        var top = r.top.map(function (x) { return x.label + ' ' + comma(x.chars) + ' 字元'; });
        return (top.join('；') || '沒有記到進來的輸出')
            + (r.restN ? '；另 ' + r.restN + ' 項 ' + comma(r.restChars) + ' 字元' : '');
    }
    function risesList(s, x) {
        if (!x.rises.length) return '<p class="tally">沒有上升</p>';
        return '<ol class="rz" aria-label="最大的五次上升">' + x.rises.map(function (r, i) {
            return '<li><span class="rzn">' + (i + 1) + '</span><div><div class="rzh"><span class="d">+' + tokens(r.dy)
                + '</span><span class="w">回合 ' + r.from + '→' + r.n + (isFinite(r.t) ? ' · ' + stamp(r.t).slice(11) : '')
                + '</span><span class="w">' + (r.cause === 'self' ? '模型自己的輸出' : '進來 ' + comma(r.inChars) + ' 字元')
                + '</span></div><div class="rzm">' + esc(riseText(r)) + '</div>'
                + todoSpot(riseTodo(s.id, r), r.cause === 'self' ? 'skills/fankeel/SKILL.md' : 'docs/station.md', s)
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
            dots.push({ t: d.out, kind: 'out', text: '派出 · ' + d.text });
            if (isFinite(d.back)) dots.push({ t: d.back, kind: 'back', text: '回來 · ' + d.text });
        });
        var same = P.length + x.noTime === x.requests;
        return '<div class="srcline">summarise() 的 byRequest：每個 request 的 input ＋ cache read ＋ cache write</div>'
            + (P.length && !bare ? '<div class="cx">' + lineChart(P, {
                W: 340, H: 170, t0: P[0].t, t1: P[P.length - 1].t, ymax: Math.ceil((x.peak || 1) / step) * step,
                marks: x.marks, dots: dots, rises: x.rises,
                label: String(s.id).slice(0, 8) + ' 的 context，' + P.length + ' 點，峰值 ' + tokens(x.peak),
            }) + '</div>' : '')
            + (bare ? '' : '<div class="key" aria-hidden="true"><span><i class="kl"></i>context / request</span>'
                + '<span><i class="ko"></i>派出</span><span><i class="kb"></i>回來</span><span><i class="ks"></i>階段</span></div>')
            + '<p class="tally">折線 <b>' + P.length + ' 點</b>' + (x.noTime ? ' ＋ ' + x.noTime + ' requests with no time' : '')
            + ' ＝ 摘要的 ' + x.requests + ' requests <span class="' + (same ? 'eq' : 'ne') + '">' + (same ? '一致' : '不一致')
            + '</span>' + (P.length > 240 ? ' · 超過 240 點，降取樣並保留峰值' : '')
            + ' · 峰值 ' + tokens(x.peak) + (x.peakN ? '（回合 ' + x.peakN + '）' : '') + '</p>'
            + risesList(s, x);
    }
    function seqHtml(seq, backs, route, stage, active) {
        var bk = {};
        (backs || []).forEach(function (b) { bk[b.i] = true; });
        var out = (seq || []).map(function (m, i) {
            var b = bk[i];
            return (i ? '<span class="ar' + (b ? ' bk' : '') + '" aria-hidden="true">' + (b ? '↩' : '→') + '</span>' : '')
                + '<span class="s' + (b ? ' bk' : '') + (m.source !== 'cmd' ? ' fb' : '') + '" role="listitem" title="'
                + esc(m.stage + ' · ' + stamp(m.at) + ' · ' + (m.source === 'cmd' ? 'task.js 指令' : m.source)) + '">'
                + '<span class="i">' + (i + 1) + '</span><i class="dot" style="background:' + (STAGE_C[m.stage] || '#888')
                + '"></i>' + esc(m.stage) + '</span>';
        }).join('');
        if (active) {
            (route || []).slice((route || []).indexOf(stage) + 1).forEach(function (n) {
                out += '<span class="ar" aria-hidden="true">→</span><span class="s todo" role="listitem">' + esc(n) + '</span>';
            });
        }
        return '<div class="seq" role="list" aria-label="階段移動次序">' + out + '</div>';
    }
    function backBlock(s, b) {
        return '<div class="bkl"><div class="hd2"><span class="ar">↩</span> ' + esc(b.from) + ' → ' + esc(b.to) + ' <span class="mono">'
            + stamp(b.at) + ' · ' + esc(b.from) + ' 待了 ' + mins(b.at - b.since) + '</span></div>'
            + '<a class="lk" tabindex="0" data-goto="' + b.since + '" data-until="' + b.at + '">過程還原裡它前面那幾列 ↓</a>'
            + todoSpot(backTodo(s.id, b), 'skills/fankeel-build/SKILL.md', s)
            + '</div>';
    }
    function orderSection(s, x) {
        return seqHtml(x.seq, x.backs, s.route, s.stage, s.state === 'live')
            + x.backs.map(function (b) { return backBlock(s, b); }).join('')
            + '<p class="tally">次序取 ' + (x.seqSource === 'task.js' ? 'transcript 裡真正執行的 task.js 指令'
                : x.seqSource === 'moves' ? 'moves（transcript 裡沒有 task.js 指令）'
                    : 'clock（沒有指令也沒有 moves，看不出回頭）') + '；倒退 ' + x.backtracks + ' 次</p>';
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
        return (x.loops && x.loops.length ? '主迴圈 ' + turns + ' 回合 · ' : '') + '派工 ' + (x.dispatches || []).length + ' 次';
    }
    function splitHtml(x) {
        var order = [], by = {};
        var row = function (st) {
            var k = st || 'task 開始前';
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
                if (r.wf) parts.push('Workflow ' + r.wf + ' 次（' + r.wfN + ' 個 agent）');
                var multiKeys = Object.keys(r.multi);
                if (multiKeys.length) {
                    var multiTotal = multiKeys.reduce(function (a, t) { return a + r.multi[t]; }, 0);
                    parts.push('同一回應並發 ' + multiKeys.length + ' 回（共 ' + multiTotal + ' 個）');
                }
                if (r.single) {
                    parts.push('單發 ' + r.single + ' 次' + (r.single > 1 ? '，各佔一個回合' : '')
                        + (r.early ? '，其中 ' + r.early + ' 次在前一次回來前就派出，本可一次發出' : ''));
                }
                var models = Object.keys(r.models).map(function (m) { return m + ' ×' + r.models[m]; }).join('、');
                return esc(r.stage) + ' — ' + (hasLoops ? '主迴圈 ' + r.turns + ' 回合；' : '')
                    + (parts.length ? '派工：' + parts.join('、') + (models ? '；' + models : '') : '沒有派工');
            });
        if (!hasLoops) lines.push('這份快取沒有逐站回合數（寫於 loops 欄位出現之前）');
        (x.tasks || []).forEach(function (p) {
            var hinted = p.groups.filter(function (g) { return g.hint; });
            var none = p.groups.filter(function (g) { return !g.turns.length; });
            var one = p.groups.length - hinted.length - none.length;
            var bits = [];
            if (one) bits.push(one + ' 組各在一個回合內派出');
            if (none.length) bits.push(none.length + ' 組沒有派工紀錄');
            if (hinted.length) {
                bits.push(hinted.length + ' 組本可一次發出：' + hinted.map(function (g) {
                    return 'G' + g.g + '（task ' + g.tasks.join('、') + '，分 ' + g.turns.length + ' 個回合）';
                }).join('、'));
            }
            lines.push('plan ' + esc(String(p.plan).split('/').pop()) + '：' + p.tasks.length + ' 個 task 分 ' + p.groups.length + ' 組；' + bits.join('、'));
        });
        if (!(x.tasks || []).length && (x.dispatches || []).length > 1) lines.push('這頁沒有任務表：其餘派工是否互不相依，無從判斷');
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
        if (!list || !list.length) return '沒有 plan';
        var n = 0, g = 0;
        list.forEach(function (p) { n += p.tasks.length; g += p.groups.length; });
        return n + ' 個 · ' + g + ' 組';
    }
    // One band per group `plantasks` would dispatch together, its tasks under
    // it, and the hint where one group went out over more than one turn.
    function tasksHtml(list) {
        if (!list || !list.length) return '<p class="tally">這個 session 的 claims 裡沒有 plan 檔，沒有任務表</p>';
        return list.map(function (p) {
            var byN = {};
            p.tasks.forEach(function (t) { byN[t.n] = t; });
            var done = p.tasks.filter(function (t) { return t.status === 'complete'; }).length;
            return '<div class="srcline" title="' + esc(p.plan) + '">' + esc(p.plan) + '</div>'
                + '<table class="x"><colgroup><col style="width:30px"><col><col style="width:96px"></colgroup>'
                + '<thead><tr><th>#</th><th>任務</th><th>狀態</th></tr></thead><tbody>'
                + p.groups.map(function (g) {
                    return '<tr class="band"><td colspan="3"><div class="bandrow"><span class="gb">G' + g.g + '</span>'
                        + '<span>Task ' + g.tasks.join('、') + ' · 建議 <span class="mono">' + esc(g.surface) + '</span></span>'
                        + '<span class="rt">' + (g.turns.length ? '回合 ' + g.turns.join(' · ') : '沒有派工') + '</span></div>'
                        + (g.hint ? '<div class="hint">could have gone in one response<span class="why">同組，分 '
                            + g.turns.length + ' 個回合派出</span></div>' : '') + '</td></tr>'
                        + g.tasks.map(function (n) {
                            var t = byN[n];
                            return '<tr><td class="num mute">' + n + '</td><td><div>' + esc(t ? t.title : '') + '</div>'
                                + '<div class="l2">' + (t && t.range ? esc(t.range) : '出自 plan 的 task 清單')
                                + (t && t.turns.length ? ' · 回合 ' + t.turns.join(' · ') : '') + '</div></td>'
                                + '<td><span class="pill sm ' + (t && t.status === 'complete' ? 'ok' : 'pend') + '">'
                                + esc(t ? t.status : 'no ledger line') + '</span></td></tr>';
                        }).join('');
                }).join('') + '</tbody></table>'
                + '<p class="tally">標為完成的 <b>' + done + ' 列</b> <span class="' + (done === p.ledgerLines ? 'eq">＝' : 'ne">≠')
                + '</span> ledger 的 Task 行 ' + p.ledgerLines
                + (p.unmatched.length ? '；label 裡沒有 task N 的派工 ' + p.unmatched.length + ' 個，不猜：'
                    + p.unmatched.map(esc).join('、') : '') + '</p>';
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
            return a;
        }, { c: 0, k: 0, s: 0, ti: 0, to: 0, ci: 0, co: 0 });
    }
    function numCells(t, unpriced, time) {
        return '<td class="r">' + (time || dur(t.s)) + '</td><td class="r">' + comma(t.k) + 'k</td><td class="r"'
            + (unpriced ? ' title="價目表不認得：' + esc(unpriced) + '"' : '') + '>'
            + (unpriced && !t.c ? 'unpriced' : cents(t.c)) + '</td>'
            + '<td class="r">' + tokens(t.ti || 0) + '</td><td class="r">$' + (t.ci || 0).toFixed(2) + '</td>'
            + '<td class="r">' + tokens(t.to || 0) + '</td><td class="r">$' + (t.co || 0).toFixed(2) + '</td>';
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
        if (k === 'edit' && w) return '寫';
        return { read: '讀', edit: '改', cmd: '指令', find: '搜', other: '其他' }[k] || k;
    }
    // One step; `mode` is `cur` for the step in progress and `stop` for the one a
    // lost agent never finished, and `tail` goes after it.
    function stepLi(y, mode, tail) {
        return '<li' + (mode ? ' class="' + mode + '"' : '') + '><span class="sk ' + esc(y.k) + '">' + stepLabel(y.k, y.w) + '</span><div>'
            + (y.f ? '<span class="fl">' + esc(y.f) + '</span>' : '<span class="cm">' + esc(y.c) + '</span>')
            + (!mode && y.r ? '<div class="rl">' + esc(y.r) + '</div>' : '') + '</div>' + (tail || '') + '</li>';
    }
    function agentPill(st) {
        var title = st === 'running' ? 'running：還沒回來，它的 transcript 還在長'
            : st === 'done' ? 'done：已經結束' : 'lost：它還沒結束，跑它的 session 就停了';
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
            return '<div class="nowl"><span class="k">正在</span><span class="c" title="' + what + '">' + what + '</span>'
                + (isNum(cur.t) ? '<span class="e">' + tk(-cur.t / 1000, 1, u.live, u.now / 1000) + '</span>' : '') + '</div>';
        }
        return '<div class="nowl lost"><span class="k">停在</span><span class="c" title="' + what + '">' + what + '</span>'
            + (isNum(cur.t) && isNum(steps.lastAt) ? '<span class="e">跑了 ' + dur(Math.round((steps.lastAt - cur.t) / 1000)) + '</span>' : '') + '</div>';
    }
    // The running and lost counts, for the session header's 派工 readout.
    function agentCounts(x, s) {
        var run = 0, lost = 0;
        x.rows.forEach(function (r) {
            var st = agentState(x, r, s);
            if (st === 'running') run += 1;
            else if (st === 'lost') lost += 1;
        });
        return (run ? '<span class="runn"><i class="dot live"></i>' + run + ' running</span> · ' : '') + (lost ? lost + ' lost · ' : '');
    }
    function agentRow(r, cls, attr, x, s, u) {
        var st = agentState(x, r, s), steps = x && x.steps ? x.steps[r.id] : null, open = !!u.open[r.id];
        var time = st === 'running' && isNum(r.from) ? tk(-r.from / 1000, 1, u.live, u.now / 1000) : null;
        return '<tr class="' + cls + ' is-' + st + '"' + (attr || '') + '><td><div class="stc">' + agentPill(st) + '<div class="bd">'
            + '<button type="button" class="axt" data-ag="' + esc(r.id) + '" data-key="ag-' + esc(r.id) + '" aria-expanded="' + open + '"'
            + ' title="' + (open ? '收起' : '展開') + ' prompt 與步驟"><span class="lab">' + esc(r.label || r.id) + '</span></button>'
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
        var note = steps && steps.droppedN ? '<p class="stn">上限 40 步，另有 ' + steps.droppedN + ' 步沒列出（'
            + Object.keys(steps.dropped || {}).map(function (k) { return stepLabel(k) + ' ' + steps.dropped[k]; }).join('、') + '）'
            + (cur && st === 'running' ? '；進行中的步驟不算在上限裡，永遠留在最後' : '') + '</p>' : '';
        var end = st === 'lost' && steps && isNum(steps.lastAt) ? steps.lastAt : r.to;
        var ran = st === 'running' ? '已跑 <b>' + tk(-r.from / 1000, 1, u.live, u.now / 1000) + '</b>'
            : '跑了 <b>' + (isNum(end) ? dur(Math.round((end - r.from) / 1000)) : '—') + '</b>';
        var prompt = steps && typeof steps.prompt === 'string'
            ? '<div class="prm' + (popen ? ' open' : '') + '"><div class="axl">prompt <span class="n">' + comma(steps.promptLen || steps.prompt.length) + ' 字元'
                + (steps.promptLen > steps.prompt.length ? '，存了前 ' + comma(steps.prompt.length) : '') + '</span>'
                + '<button type="button" class="lkb" data-prm="' + esc(r.id) + '" data-key="prm-' + esc(r.id) + '" aria-expanded="' + popen + '">'
                + (popen ? '收起' : '展開全部') + '</button></div><pre>' + esc(steps.prompt) + '</pre></div>'
            : '<div class="prm"><div class="axl">prompt <span class="n">transcript 裡沒有</span></div></div>';
        var foot;
        if (st === 'running') foot = '<div class="retl">還沒回來。回來後，這裡寫它回傳了多少字元。</div>';
        else if (st === 'lost') foot = '<div class="retl lost">沒有回傳：它還沒結束，跑它的 session 就停了，結果沒有進主 context。</div>';
        else if (!d) foot = '<div class="retl">沒有對上派工，不知道它回傳了多少。</div>';
        else if (d.surface === 'workflow') {
            foot = '<div class="retl">' + (steps && isNum(steps.lastAt) ? clockSec(steps.lastAt) + ' ' : '') + '結束。它的結果併在 workflow 的回報裡'
                + (isNum(d.back) && d.ret !== null && d.ret !== undefined ? '；workflow 回傳 <b>' + comma(d.ret) + '</b> 字元進主 context'
                    : '；workflow 還沒回來，還沒有回傳字元') + '。</div>';
        } else if (isNum(d.back) && d.ret !== null && d.ret !== undefined) {
            foot = '<div class="retl">' + clockSec(d.back) + ' 回來，回傳 <b>' + comma(d.ret) + '</b> 字元進主 context</div>';
        } else foot = '<div class="retl">已經結束，回報還沒進主 context。</div>';
        return '<tr class="ax ' + cls + ' is-' + st + '"><td colspan="9"><div class="axw">'
            + '<div class="axh">' + (isNum(r.from) ? '<span>派出 <b>' + clockSec(r.from) + '</b></span><span>' + ran + '</span>' : '')
            + '<span><b>' + n + '</b> 步</span><span>' + esc(modelOf(r)) + '</span></div>'
            + prompt
            + '<div><div class="axl">步驟 <span class="n">照順序，最新在下</span></div><ul class="stp">'
            + list.map(function (y, i) {
                if (!y.p) return stepLi(y);
                var mode = st === 'lost' ? 'stop' : 'cur';
                var tail = st === 'running'
                    ? '<span class="pg"><i class="dot live"></i>進行中' + (i === lastP && isNum(cur && cur.t)
                        ? ' ' + tk(-cur.t / 1000, 1, u.live, u.now / 1000) : '') + '</span>'
                    : st === 'lost'
                        ? '<span class="pg lost">沒跑完' + (i === lastP && isNum(cur && cur.t) && isNum(steps.lastAt)
                            ? '・跑了 ' + dur(Math.round((steps.lastAt - cur.t) / 1000)) : '') + '</span>'
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
            return '<div class="h2">派工 <small>這個 session 還沒派出 agent</small></div><div class="emptyd"><p class="et">還沒派出 agent</p><p class="es">'
                + (u.live && s && s.state === 'live' ? '一派出，它會在下一次更新（3 秒內）出現在這裡，連同它正在跑的工具。這頁不必重新整理。'
                    : '這個 session 沒有派出任何 agent。') + '</p></div>';
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
            return '<tr class="gaprow"><td colspan="9">session ' + (end !== null ? '<b>' + clock(end) + '</b> 結束，' : '')
                + '<b>' + clock(since) + '</b> 以同一個 session id 接回來；結束前派出、還沒回來的 agent 標成 lost</td></tr>';
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
                + (d ? d.surface : '—') + '</span><span class="ell">' + esc(d ? d.text : '沒有對上派工的 agent') + '</span>'
                + (wf ? agdots(x, list, s) + '<span class="phs">' + list.filter(function (r) { return agentState(x, r, s) === 'done'; }).length
                    + ' / ' + list.length + ' done</span>' : '')
                + '<span class="rt">' + (d && d.turn ? '回合 ' + d.turn : '')
                + (d && isNum(d.out) ? ' · ' + stamp(d.out).slice(11) + '→' + (isNum(d.back) ? stamp(d.back).slice(11) : gone ? '沒回來' : '…') : '')
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
        ['running', 'done', 'lost'].forEach(function (k) { if (!n[k]) off[k] = '沒有這個狀態的 agent'; });
        var dhead = '<div class="dhead"><div class="h2">派工 <small>這個 session 派了 <b>' + x.rows.length + '</b> 個 agent，分 '
            + x.dispatches.length + ' 次派工</small></div><span class="spacer"></span>'
            + segHtml('dfilter', [['all', '全部 ' + n.all], ['running', 'running ' + n.running], ['done', 'done ' + n.done], ['lost', 'lost ' + n.lost]], filter, off)
            + '</div>';
        var all = sums(x.rows);
        var ret = x.dispatches.reduce(function (m, d) { return m + (d.ret || 0); }, 0);
        var launch = x.dispatches.reduce(function (m, d) { return m + (d.launch || 0); }, 0);
        var wfRows = x.rows.filter(function (r) { return r.surface === 'workflow'; }).length;
        var wfRun = x.runs.reduce(function (m, r) { return m + r.agents; }, 0);
        var eq = function (a, b) { return '<span class="' + (a === b ? 'eq">＝' : 'ne">≠') + '</span>'; };
        return dhead + '<table class="x dx"><colgroup><col><col style="width:50px"><col style="width:54px"><col style="width:54px">'
            + '<col style="width:48px"><col style="width:54px"><col style="width:48px"><col style="width:54px">'
            + '<col style="width:58px"></colgroup><thead><tr><th>派工</th><th class="r">耗時</th><th class="r">tokens</th>'
            + '<th class="r">USD</th><th class="r">input</th><th class="r">input USD</th><th class="r">output</th><th class="r">output USD</th>'
            + '<th class="r rc" title="這次派工的結果進入主 context 的字元數">回傳字元</th></tr></thead>'
            + '<tbody>' + body + '</tbody><tfoot><tr><td>' + x.rows.length + ' 個 agent</td>' + numCells(all, '')
            + '<td class="r rc">' + comma(ret) + '</td></tr></tfoot></table>'
            + '<p class="tally">各列美元相加 <b>' + cents(all.c) + '</b> ' + eq(all.c, x.agentsTotal.cents) + ' agentsOf() 的 '
            + cents(x.agentsTotal.cents) + '；workflow 派工 ' + wfRows + ' 列 ' + eq(wfRows, wfRun) + ' run 檔的 workflow_agent '
            + wfRun + ' 列</p>'
            + '<p class="tally">回傳字元是派工的結果進入主 context 的長度：背景 agent 與 workflow 取 task-notification，前景的取 Agent 的'
            + ' tool_result。背景啟動時回來的確認不算在內，這個 session 合計 ' + comma(launch) + ' 字元。美元照價目表 '
            + esc(S.pricesVerified || '—') + (x.unpriced.length ? '；價目表不認得、寫 unpriced 的：' + x.unpriced.map(esc).join('、') : '')
            + '</p>'
            + (n.running ? '<p class="tally">running 的 ' + n.running + ' 列是到 ' + clockSec(isNum(x.at) ? x.at : u.now)
                + ' 為止的 tokens 與美元，下一次重拉會再變；耗時照秒走。</p>' : '')
            + (n.lost ? '<p class="tally">lost 的列沒有回傳字元：它的結果沒有進主 context。耗時算到它 transcript 的最後一行。</p>' : '');
    }
    function stepsFor(x, d) {
        if (!d) return '';
        var ids = d.ids.filter(function (id) { return x.steps[id]; });
        if (!ids.length) return '';
        var shown = 0, total = 0;
        ids.forEach(function (id) { shown += x.steps[id].steps.length; total += x.steps[id].steps.length + x.steps[id].droppedN; });
        return '<details class="stw" data-block="tool-collapsed" data-key="stw-' + esc(d.key) + '"><summary class="rpx">展開它自己的步驟 <span class="n">' + shown + ' / ' + total + ' 步'
            + (ids.length > 1 ? ' · ' + ids.length + ' agents' : '') + '</span></summary>' + '<div class="to" data-block="tool-output">' + ids.map(function (id) {
                var st = x.steps[id];
                var r = x.rows.filter(function (y) { return y.id === id; })[0];
                return (ids.length > 1 ? '<div class="stg">' + esc(r ? r.label : id) + '</div>' : '')
                    + '<ul class="stp">' + st.steps.map(function (y) {
                        return '<li' + (y.p ? ' class="cur"' : '') + '><span class="sk ' + y.k + '">' + stepLabel(y.k, y.w) + '</span><div>'
                            + (y.f ? '<span class="fl">' + esc(y.f) + '</span>' : '<span class="cm">' + esc(y.c) + '</span>')
                            + (y.r ? '<div class="rl">' + esc(y.r) + '</div>' : '')
                            + (y.p ? '<span class="pg"><i class="dot live"></i>進行中</span>' : '') + '</div></li>';
                    }).join('') + '</ul>'
                    + (st.droppedN ? '<p class="stn">上限 40 步，另有 ' + st.droppedN + ' 步沒列出（'
                        + Object.keys(st.dropped).map(function (k) { return stepLabel(k) + ' ' + st.dropped[k]; }).join('、') + '）</p>' : '');
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
        return [['prompt', 'prompt'], ['stage', '階段'], ['gate', 'gate'], ['out', '派出'], ['back', '回來'],
            ['edit', '改檔'], ['commit', 'commit'], ['test', '測試']];
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
                + (isFinite(e.askedAt) ? '等了 ' + dur(Math.round((e.t - e.askedAt) / 1000)) + '<span class="w">' + stamp(e.askedAt).slice(11) + ' 問 → '
                    + (isFinite(e.t) ? stamp(e.t).slice(11) : '—') + ' 答</span>' : '')
                + e.qs.map(function (q) {
                    var labels = Array.isArray(q.labels) ? q.labels : [];
                    return '<div class="qa"><span class="k">問</span><div class="q">' + esc(q.q)
                        + (labels.length ? '<div class="opts">' + labels.map(function (l) {
                            return '<span' + (l === q.a ? ' class="on"' : '') + '>' + esc(l) + '</span>';
                        }).join('') + '</div>' : '')
                        + '</div><span class="k">答</span><div class="a">'
                        + esc(q.a === null ? '（沒有答案）' : q.a) + (q.own ? '<span class="own">自己寫的</span>' : '') + '</div></div>';
                }).join('') + '</div>';
        } else if (e.kind === 'out') {
            // A dispatch is one card from out to back: who went, how long it
            // was away, what it returned, and its own steps folded.
            var d = x.dispatches[e.disp];
            var back = d && isNum(d.back) ? d.back : null;
            tx = '<div class="ad" data-block="agent-dispatch">' + rpTag('out') + esc(e.text) + '<div class="sub">'
                + esc(e.surface + (e.agentType ? ' · ' + e.agentType : '') + (e.alias ? ' · ' + e.alias : '')) + '</div>'
                + (d && isNum(d.out) ? '<div class="span"><span class="tt">' + stamp(d.out).slice(11) + '</span><span class="ln' + (back === null ? ' open' : '') + '"></span>'
                    + '<span class="tt">' + (back === null ? '還沒回來' : stamp(back).slice(11) + ' · ' + took(back - d.out)
                        + (isNum(d.ret) ? ' · 回傳 ' + comma(d.ret) + ' 字元' : '')) + '</span></div>' : '')
                + stepsFor(x, d) + '</div>';
        } else if (e.kind === 'edit') {
            tx = '<details class="tc" data-block="tool-collapsed" data-key="tc-' + i + '"><summary>' + rpTag('edit') + '改了 ' + e.files.length + ' 個檔</summary>'
                + '<div class="to" data-block="tool-output">' + e.files.map(function (f) {
                    return '<span class="fl">' + esc(f.f) + (f.n > 1 ? ' ×' + f.n : '') + '</span>';
                }).join('、') + '</div></details>';
        } else {
            var body;
            if (e.kind === 'prompt') body = '<span class="q">' + esc(e.text) + '</span>' + (e.cmd ? '<div class="sub">' + esc(e.cmd) + '</div>' : '');
            else if (e.kind === 'stage') {
                body = esc(e.verb === 'stage' ? e.stage : e.verb + (e.stage ? ' · ' + e.stage : ''))
                    + (e.text ? '<div class="sub">' + esc(e.text) + '</div>' : '');
            } else if (e.kind === 'back') {
                body = esc(e.text) + '<div class="sub">回傳 ' + (e.ret === null || e.ret === undefined ? '—' : comma(e.ret) + ' 字元') + '</div>';
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
        var name = function (g) { return g.stage || '未分段'; };
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
                    + (w > 9 ? text(g) : '') + (label === '時間' ? waits(g) : '') + '</button>';
            }).join('') + '</div><span class="val">' + value + '</span>';
        };
        var strip = '<div class="rpcs" data-block="cost-strip">' + (total ? '<div class="cs">'
            + track('時間', took(total), function (g) { return span(g) === null ? 0 : span(g) / total * 100; }, function (g) {
                return esc(name(g)) + '<span class="v">' + took(span(g)) + '</span>';
            })
            + (usdAll ? track('花費', usd(usdAll), function (g) { return (g.usd || 0) / usdAll * 100; }, function (g) { return usd(g.usd); }) : '')
            + '<div class="key">' + (waitAll ? '<span><i class="sw hatch"></i>等你回答 gate（' + took(waitAll) + '，佔 '
                + Math.round(waitAll / total * 100) + '%）</span>' : '') + '<span>點一段就跳到那個階段</span></div></div>' : '')
            + (s ? '<p class="tally">各段 context 相加 <b>' + comma(burnSum) + '</b> <span class="' + (burnSum === (s.burn || 0) ? 'eq">＝' : 'ne">≠')
                + '</span> 這個 session 的 burn ' + comma(s.burn || 0) + '</p>' : '') + '</div>';
        var KEY = { gate: 1, out: 1, commit: 1 };
        var keyText = function (e) {
            var t = e.kind === 'gate' ? (e.qs[0] ? (e.qs[0].a === null ? '（沒有答案）' : e.qs[0].a) : '')
                : e.kind === 'commit' ? e.sha + ' ' + e.text : e.text;
            return String(t || '').slice(0, 40);
        };
        var last = null;
        x.events.forEach(function (e) { if (isNum(e.t) && (last === null || e.t > last)) last = e.t; });
        var toc = '<nav class="rptoc" data-block="toc" aria-label="段落目錄"><div class="h">目錄</div><ol>' + segs.map(function (g, k) {
            var keys = g.rows.filter(function (r) { return KEY[r.e.kind]; });
            return '<li><button type="button" class="rs sg" data-rs="rs-' + k + '"><i class="bar" style="background:' + color(g) + '"></i><b>' + esc(name(g)) + '</b>'
                + '<span class="d">' + took(span(g)) + '</span><span class="m">' + (isNum(g.from) ? stamp(g.from).slice(11, 16) + ' · ' : '')
                + 'context ' + tokens(g.burn) + (g.usd === null ? '' : ' · ' + usd(g.usd)) + ' · ' + g.rows.length + ' 列</span></button>'
                + (keys.length ? '<ol>' + keys.map(function (r) {
                    return '<li><button type="button" class="rs" data-rs="rv-' + r.i + '"><span class="tm">' + (isFinite(r.e.t) ? stamp(r.e.t).slice(11, 16) : '—')
                        + '</span>' + rpTag(r.e.kind) + '<span class="kt">' + esc(keyText(r.e)) + '</span></button></li>';
                }).join('') + '</ol>' : '') + '</li>';
        }).join('') + '</ol><div class="tf">' + x.events.length + ' 列' + (last === null ? '' : '<br>最後一列 ' + stamp(last).slice(11)) + '</div></nav>';
        var bar = '<div class="rpf" data-block="filter-bar" role="group" aria-label="事件種類">' + rpKinds().map(function (k) {
            return '<button type="button" data-rk="' + k[0] + '" data-key="rk-' + k[0] + '" aria-pressed="' + !off[k[0]] + '">' + k[1] + '<span class="n">'
                + (count[k[0]] || 0) + '</span></button>';
        }).join('') + '<span class="spacer"></span><button type="button" class="rpx-all" data-xall>全部展開</button></div>';
        var body = segs.map(function (g, k) {
            var n = function (kind) { return g.rows.filter(function (r) { return r.e.kind === kind; }).length; };
            var prev = k > 0 && segs[k - 1].stage ? segs[k - 1].stage + ' → ' + name(g) : 'start';
            return '<details class="rpseg" id="rs-' + k + '" open><summary class="sh" data-block="segment-header" data-burn="' + (g.burn === null ? '' : g.burn) + '">'
                + '<i class="band" style="background:' + color(g) + '"></i><div><div class="t"><b>' + esc(name(g)) + '</b>'
                + (isNum(g.from) ? '<span class="from">' + esc(prev) + ' · ' + stamp(g.from).slice(11) + '</span>' : '')
                + '<span class="caret" aria-hidden="true">▶</span></div>'
                + '<div class="ct"><span><b>' + n('gate') + '</b> gate</span><span><b>' + n('out') + '</b> 派出</span><span><b>' + n('commit') + '</b> commit</span>'
                + '<span>' + g.rows.length + ' 列</span></div></div>'
                + '<dl class="m"><dt>耗時</dt><dd class="big">' + took(span(g)) + '</dd><dt>context</dt><dd>' + tokens(g.burn) + '</dd>'
                + (g.usd === null ? '' : '<dt>花費</dt><dd>' + usd(g.usd) + '</dd>')
                + (g.waited ? '<dt>等 gate</dt><dd>' + took(g.waited) + '</dd>' : '') + '</dl></summary>'
                + '<ol class="rp">' + g.rows.map(function (r) { return replayRow(x, r.e, r.i, off); }).join('') + '</ol></details>';
        }).join('');
        return '<div class="rpw">' + strip + '<div class="rpb">' + toc + '<div class="rpm">' + bar + body + '<p class="tally">' + x.events.length + ' 列'
            + (x.dropped ? '；超過 300 列，只留 gate、階段、commit 與派工，丟掉了 ' + x.dropped + ' 列' : '') + '</p></div></div></div>';
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
        return '〔station〕' + String(id).slice(0, 8) + ' 回合 ' + r.from + '→' + r.n + ' context +' + tokens(r.dy) + '：'
            + (r.cause === 'self' ? r.self.label
                : r.top[0] ? r.top[0].label + ' ' + comma(r.top[0].chars) + ' 字元' : '進來的輸出');
    }
    function backTodo(id, b) {
        return '〔station〕' + String(id).slice(0, 8) + ' ' + b.from + '→' + b.to + ' 倒退（' + stamp(b.at) + '，'
            + b.from + ' 待了 ' + mins(b.at - b.since) + '）：' + b.from + ' 抓到的，' + b.to + ' 為什麼沒抓到';
    }
    // Served, a form that posts the line to `/todo`, which checks it with
    // todo-check's own rules before writing and answers 400 with the rule that
    // failed. A file on disk cannot post, so it prints the line to copy.
    function todoSpot(text, link, s) {
        if (!S.serve) {
            return '<div class="td"><div class="tdc"><code>- ' + esc(todoEntry(text, link)) + '</code></div>'
                + '<div class="tds">靜態頁不寫檔：複製這一行，貼進 TODO.md 的 ## Needs a decision。</div></div>';
        }
        return '<details class="td"><summary class="tdb">記成 TODO <span class="m">POST /todo</span></summary>'
            + '<div class="tdf" data-todo-root="' + esc(s.root) + '" data-todo-id="' + esc(s.id) + '">'
            + '<label>條目（寫進 TODO.md 的 ## Needs a decision）</label><textarea rows="2" spellcheck="false">'
            + esc(text) + '</textarea><label>連結</label><input type="text" spellcheck="false" value="' + esc(link) + '">'
            + '<div class="help">送出前跑 todo-check 的同一套規則：≤ 200 字元、連結要存在、不指向 plan、decision、report、archive。</div>'
            + '<div class="act"><button type="button" class="go" data-todo>送出</button></div>'
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
                + esc(s.task) + '">' + esc(s.task) + '</span><span class="meta">' + stamp(f.t0) + ' 起 · ' + mins(f.t1 - f.t0)
                + ' · ' + s.route.length + ' 段</span></div><div class="cx">' + lineChart(x.points, {
                    W: 720, H: 180, t0: f.t0, t1: f.t0 + span, ymax: ymax, marks: x.marks, elapsed: true,
                    label: String(s.id).slice(0, 8) + ' 的 context，' + f.pts + ' 點，峰值 ' + tokens(f.peak),
                }) + '</div>';
        };
        var row = function (s, f) {
            return '<tr><td class="sid">' + esc(String(s.id).slice(0, 8)) + '<span class="s2">' + esc(s.state + ' · ' + s.stage) + '</span></td>'
                + '<td class="v r">' + tokens(f.peak) + '<span class="s2">' + (f.peakN ? '回合 ' + f.peakN + ' · ' : '') + comma(f.peak) + '</span></td>'
                + '<td class="v r">' + f.requests + '<span class="s2">' + f.pts + ' 點 ＋ ' + f.noTime + ' no time</span></td>'
                + '<td class="v r">' + cents(f.cents) + '<span class="s2">' + (f.cents === f.agentCents ? '＝' : '≠')
                + ' agentsOf() ' + cents(f.agentCents) + '</span></td>'
                + '<td class="v r">' + f.back + '</td></tr>';
        };
        return chart(a, xa, fa) + '<div style="height:14px"></div>' + chart(b, xb, fb)
            + '<p class="cmpnote">兩張圖共用 y 軸（0 到 ' + tokens(ymax) + '）與 x 軸的長度（' + mins(span)
            + '）；x 是從各自第一個 request 起算的經過時間，所以同一個橫座標是「開工後同樣久」。每張圖仍然只有一條線。</p>'
            + '<div class="figs"><table><thead><tr><th>session</th><th class="r">峰值 context</th><th class="r">requests</th>'
            + '<th class="r">派工 USD</th><th class="r">倒退</th></tr></thead><tbody>' + row(a, fa) + row(b, fb) + '</tbody></table></div>'
            + '<p class="cmpnote">每一格都和各自 session 的細節面板出自同一個欄位：峰值與 requests 是 context 折線的，'
            + '派工 USD 是派工表各列的和，倒退是階段順序的。</p>'
            + '<div class="cmpseq">' + [[a, xa], [b, xb]].map(function (p) {
                return '<h3>' + esc(String(p[0].id).slice(0, 8)) + ' · ' + p[1].seq.length + ' 步 · 倒退 ' + p[1].backtracks + '</h3>'
                    + seqHtml(p[1].seq, p[1].backs, p[0].route, p[0].stage, false);
            }).join('') + '</div>';
    }
    function cmpPage() {
        var two = picked.map(function (id) {
            return S.sessions.filter(function (s) { return s.id === id; })[0];
        }).filter(Boolean);
        var head = '<div class="phead"><h1>' + icon('cmp') + '比較</h1><span class="spacer"></span>'
            + '<a class="ctl" href="#/list">☰ 回清單</a></div>' + subtabsHtml('cmp');
        if (two.length < 2) {
            return head + '<div class="card"><div class="cbody"><p class="mute">在專案頁或清單上勾兩個有細節的 session，'
                + '這裡就上下並排比較它們。</p></div></div>';
        }
        two.forEach(needDetail);
        var xa = DETAIL[two[0].id], xb = DETAIL[two[1].id];
        return head + '<div class="card cmpcard"><div class="cbody">'
            + (xa && xb ? compareHtml(two[0], xa, two[1], xb) : '<p class="mute">讀取細節…</p>') + '</div></div>';
    }

    var NAV_LABEL = { live: '現在', days: '近 30 天', sessions: '最近 sessions', projects: '專案', docs: '文件', settings: '設定', list: '清單', cmp: '比較' };
    function drawSide() {
        var tail = CRUMBS[route.view] ? CRUMBS[route.view](route)
            : route.view === 'days' && route.day ? [['近 30 天', '#/days'], [route.day, null]]
                : NAV_LABEL[route.view] ? [[NAV_LABEL[route.view], null]] : [];
        doc.getElementById('side').innerHTML = crumbHtml([['儀表板', '#/']].concat(tail));
    }
    VIEWS.now = dashPage;
    VIEWS.live = livePage;
    VIEWS.days = daysPage;
    VIEWS.sessions = sessionsPage;
    VIEWS.projects = projectsPage;
    VIEWS.docs = docsPage;
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
        p.innerHTML = (VIEWS[route.view] || dashPage)(route);
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
            if (read.missing) { pgr.className = 'pgr bad'; pgr.textContent = '還有 ' + read.missing + ' 題沒答'; return; }
            var answers = read.answers;
            var form = new URLSearchParams();
            form.set('nonce', S.nonce || '');
            form.set('root', pg.getAttribute('data-pg-root'));
            form.set('id', pg.getAttribute('data-pg-id'));
            form.set('answers', JSON.stringify(answers));
            fetch('answer', { method: 'POST', body: form }).then(function (r) {
                return r.text().then(function (t) {
                    pgr.className = 'pgr ' + (r.ok ? 'ok' : 'bad');
                    pgr.textContent = (r.ok ? '已送出：' : r.status + ' — ') + t.trim();
                });
            }, function () {
                pgr.className = 'pgr bad';
                pgr.textContent = '送不出去：serve 還在跑嗎？';
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
                    said.textContent = (r.ok ? '寫進 TODO.md：' : r.status + ' — 沒有寫進去：') + t.trim();
                });
            }, function () {
                said.className = 'tdr bad';
                said.textContent = '送不出去：serve 還在跑嗎？';
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
                (d.plannedNotBuilt || []).forEach(function (x) { add(x, '還沒建'); });
                ((d.undeclared && d.undeclared.paths) || []).forEach(function (x) { add(x, '沒宣告狀態'); });
                ((d.filing && d.filing.rows) || []).forEach(function (r) { add(r.bucket, r.role); });
            });
        });
        var pname = function (pkey) { return shortLabel(NAMES[pkey] || pkey); };
        return [
            { t: 'Sessions', ico: 'sessions', n: sess.length, all: '#/list', rows: sess.slice(0, 5).map(function (s) {
                return { href: sessionHash(s.id), html: '<span class="qt">' + qMark(s.task || '（未命名）', q) + '</span>'
                    + (qHas(s.id, q) && !qHas(s.task, q) ? '<span class="qid mono">' + qMark(s.id, q) + '</span>' : '')
                    + '<span class="qp">' + qMark(pname(s.pkey), q) + '</span><span class="qs mono">' + esc(s.stage || '—') + '</span>'
                    + '<span class="qa">' + ago(s.updated) + '</span>' };
            }) },
            { t: '專案', ico: 'projects', n: proj.length, all: '#/projects', rows: proj.slice(0, 5).map(function (k) {
                return { href: projectHash(k), html: '<span class="qt">' + qMark(pname(k), q) + '</span><span class="qp mono">' + qMark(k, q) + '</span>' };
            }) },
            { t: '文件', ico: 'docs', n: docs.length, all: '#/docs', rows: docs.slice(0, 5).map(function (d) {
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
        qPop.innerHTML = '<div class="qin" data-block="search" role="listbox" aria-label="搜尋結果">' + (gs.length ? gs.map(function (g) {
            return '<div class="qg"><div class="qh">' + icon(g.ico) + '<b>' + g.t + '</b><span class="qn">' + g.n + '</span></div>'
                + g.rows.map(function (r) { return row(r.href, r.html, 'qrow'); }).join('')
                + (g.n > g.rows.length ? row(g.all, '看全部 ' + g.n + ' 筆 →', 'qall') : '') + '</div>';
        }).join('') : '<p class="qnone">沒有符合 “' + esc(q) + '” 的結果</p>') + '</div>';
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
            if (!el.title) el.title = off ? '按一下放回圖表' : '按一下先從圖表拿掉';
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

    doc.getElementById('nreg').textContent = S.projects.length + ' 個 registry · '
        + S.sessions.length + ' sessions';
    doc.getElementById('cfg').textContent = String(S.configDir || '').replace(/^.*[\\/]/, '')
        || S.configDir;
    doc.getElementById('cfg').title = S.configDir || '';

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
    function refresh() {
        if (busy || doc.hidden) return;
        busy = true;
        reload('station/station-data.js', function (ok) {
            if (!ok || !w.STATION || w.STATION === S) { busy = false; return; }
            // `cleared` rides on the one load `/clear-stale` redirected to, and
            // stays on the page rather than vanishing three seconds later.
            if (isFinite(S.cleared) && w.STATION.cleared === undefined) w.STATION.cleared = S.cleared;
            S = w.STATION;
            freshen();
            polledAt = Date.now();
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
        var open = {};
        [].forEach.call(doc.querySelectorAll('details[id],details[data-key]'), function (d) {
            open[d.id || d.getAttribute('data-key')] = d.open;
        });
        var box = doc.querySelectorAll('.listcard .scroll')[0];
        var boxTop = box ? box.scrollTop : 0;
        var y = w.scrollY || 0;
        draw();
        [].forEach.call(doc.querySelectorAll('details[id],details[data-key]'), function (d) {
            var k = d.id || d.getAttribute('data-key');
            if (Object.prototype.hasOwnProperty.call(open, k)) d.open = open[k];
        });
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
                head.innerHTML = '<i class="dot down"></i>serve 沒有回應';
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
                retry.textContent = '重試';
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
