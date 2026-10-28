// 共用格式化 (FK_FMT): moved out of station.js (station-52). station.js
// calls make(K) once, on first use, handing it the helpers these bodies
// name; everything here only computes or builds strings.
(function (w) {
    'use strict';
    function make(K) {
        // One alias per name K carries, so the bodies below moved verbatim.
        var w = K.w, loc = K.loc, tokens = K.tokens, hours = K.hours, usd = K.usd, estMark = K.estMark, labels = K.labels;
        var ROUTE = K.ROUTE, TABS = K.TABS, PAGES = K.PAGES, MODEL_KEYS = K.MODEL_KEYS, TOKEN_KEYS = K.TOKEN_KEYS;
        var KIND_KEYS = K.KIND_KEYS, KIND_LABEL = K.KIND_LABEL, KIND_COLOR = K.KIND_COLOR, WHO_LABEL = K.WHO_LABEL;
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
            if (dim === 'kind') return w.FK_KINDS ? w.FK_KINDS.notes(K.S().prices)[key] || '' : '';
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
        return { localDay, lastDays, parseHash, projectHash, knownPkey, sessionHash, family, modelKey, modelLabel, tokenSum, dimKey, verCmp, orderKeys, colorOf, keyLabel, keyHint, projectNames, niceTop, partEst, metricText, sessionTotals, windowTotals };
    }
    var api = { make: make };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_FMT = api;
}(typeof window !== 'undefined' ? window : null));
