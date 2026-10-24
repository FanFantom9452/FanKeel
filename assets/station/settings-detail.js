'use strict';
// assets/station/settings-detail.js — 詳細設定 `#/settings/detail[/<step>]`
// (station-39; mockup .fankeel/build/2026-10-21-station-redesign/
// route-settings-v9.html, its script :600-998 ported to HTML strings). One
// question a screen; the rail lists the ten chapters with their steps,
// done / current / remaining; a chapter ends on 到這裡就好 / 繼續. The ten
// quick questions come from FK_SETTINGS.questions(), the other 23 from
// FK_SETSTEPS.steps(), in FK_SETSTEPS.order(). Answers stay in memory; the
// final screen shows each changed key old → new, split project / this
// machine, and 寫入 posts them through FK_SETTINGS.post (POST /profile).
// station.js skips the poll's repaint on #/settings, so the page redraws only
// when the reader acts; typing updates state without a redraw (caret).
(function (w, doc) {
    var EN = {
        'sd.rail': 'Settings chapters',
        'sd.steps': 'Step by step',
        'sd.index': 'Chapters and steps',
        'sd.answered': '{d} / {t} answered',
        'sd.cut': 'Details: stop wherever you like',
        'sd.machine': 'This machine',
        'sd.machineTip': 'This chapter writes the whole machine\'s settings',
        'sd.na': 'Not asked',
        'sd.skipped': 'Skipped',
        'sd.check': 'Check and write',
        'sd.nChanges': '{n} changes',
        'sd.wrote': 'Written',
        'sd.wizard': 'Settings wizard',
        'sd.why': 'Why this question',
        'sd.now': 'Current',
        'sd.from': 'Carried',
        'sd.fromTip': 'Carried in by {by}',
        'sd.near': 'Closest',
        'sd.multi': 'Pick several, comma separated',
        'sd.noKeys': 'Fills no key',
        'sd.fills': 'Fills:',
        'sd.differs': '{n} away from your answers',
        'sd.typed': 'The value is what you type below',
        'sd.noChange': 'Changes no setting',
        'sd.unset': 'not written (unset)',
        'sd.onMachine': ' · this machine',
        'sd.notifyOff': 'notify.*: all off',
        'sd.and': ', ',
        'sd.mcHead': 'Also written to this machine',
        'sd.mcQ': 'What this card writes',
        'sd.mcWhy': 'Written to {f}. Only the machine settings are read for these two, so the project file would not take effect, and a cloned repo sends nothing to another machine. How the phone connects remotely is not settled.',
        'sd.mcGate': 'Push to the phone when a gate waits',
        'sd.mcRemote': 'Phone reaches the station remotely',
        'sd.pend': 'Pending',
        'sd.mcPend': 'Remote connection pending: Tailscale or a VPN that covers the LAN',
        'sd.mcOk': 'Confirm, write to this machine',
        'sd.mcNot': 'Not now',
        'sd.mcYes': 'It will be written to this machine.',
        'sd.mcNo': 'This machine stays as it is; you can turn these on under Away from the computer later.',
        'sd.mcWait': 'Confirm or say not now to go on.',
        'sd.byCard': 'Quick setup · question 7\'s machine card',
        'sd.byStyle': 'filled by {n}',
        'sd.langField': 'Language',
        'sd.langPh': 'Deutsch',
        'sd.prev': 'Back',
        'sd.skip': 'Skip this one',
        'sd.stop': 'Stop here',
        'sd.cont': 'Continue: ',
        'sd.next': 'Next',
        'sd.write': 'Write {n}',
        'sd.pos': '{c} · {k} / {n}',
        'sd.posFinal': 'Check before writing',
        'sd.finT': 'Write these changes?',
        'sd.finY': 'Nothing touches profile.json until you press write. The project and this machine are written apart; questions you did not reach keep their current values.',
        'sd.finQ': 'What gets written',
        'sd.finNone': 'Nothing to change: your answers match the current values.',
        'sd.project': 'Project',
        'sd.items': '{g} · {n}',
        'sd.byLine': 'From: {by}',
        'sd.to': 'changed to',
        'sd.left': 'The {n} questions you did not reach keep their current values; pick up from the left any time.',
        'sd.allDone': 'Every question has been through.',
        'sd.okN': '{n} written.',
        'sd.err': 'Not written: {e}',
        'sd.noTable': 'The settings table has not loaded.',
        'sd.sugErr': 'Recommendations are unavailable, so the front-end steps are not asked.',
        'sd.unsetV': 'unset',
        'sd.def': 'Default',
        'sd.promptName': 'Extra prompt ({st})',
        'sd.everyStage': 'every stage',
        'sd.agentModel': '{a} model',
        'sd.agentEffort': '{a} effort',
        'sd.none': 'None',
        'sd.changedN': '{n} changed',
        'sd.kept': 'Kept',
        'sd.stageCode': 'prompt.<stage>',
    };
    var STG = ['all', 'survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'];
    var MODELS = ['haiku', 'sonnet', 'opus', 'fable'];
    var EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
    // commit.format when /station/suggest has not answered (v9-data's value).
    var GIT_FMT = '^(chore|docs|feat|fix|merge|test)(\\([^)]+\\))?: ';
    // Keys whose builtin is `false` but whose "off" answer writes '' (unset).
    var BLANK = { 'stage.agents': 1, 'station.link': 1 };
    var CHECK = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5 6.5 11.5 12.5 5"/></svg>';
    var WARN = '<svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.2 14.2 13H1.8z"/><path d="M8 6.5v3M8 11.3v.01"/></svg>';
    var CHEV = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 6.2 8 9.8l3.5-3.6"/></svg>';
    var SAVE = '<svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2.5h7.5L13 5v8.5H3z"/><path d="M5.5 2.5v3h4v-3M5.5 13.5V9.5h5v4"/></svg>';

    function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    function kit() { return (w && w.FK_KIT) || {}; }
    function fill(s, vars) { return kit().fillVars ? kit().fillVars(s, vars) : s; }
    function loc(key, zh, vars) {
        var I = w && w.FK_I18N;
        return fill(I && I.lang === 'en' && has(EN, key) ? EN[key] : zh, vars);
    }
    function esc(s) { return kit().esc(s); }
    function setp() { return (w && w.FK_SETTINGS) || {}; }

    var st, cx = null, last = null, bound = false;
    function reset() {
        st = { at: null, ans: {}, inp: {}, mc: '', mck: { 'notify.gate': true, 'station.remote': true }, hist: [],
            wrote: 0, err: '', busy: false, over: {}, sug: null, sugErr: false, sugFor: '', hash: '', tip: '', rail: false, moving: false };
        cx = null;
    }
    reset();

    // ---- the table: quick questions and the step table, in order ----
    function fromQuick(q) {
        return { id: q.id, kind: 'one', title: q.title || q.r || q.id, why: q.why || '', cond: q.cond || '',
            field: q.id === 'lang' ? { label: loc('sd.langField', '語言'), ph: loc('sd.langPh', '日本語') } : null,
            opts: (q.opts || []).map(function (a) {
                var wr = a.w || {};
                return { o: a.o, label: a.t || a.s || a.o, effect: a.e || '', s: a.s || a.t || a.o, w: wr,
                    rec: a.rec || '', risk: a.risk || '', pend: a.pend || '', pendWhy: '',
                    input: Object.keys(wr).some(function (k) { return wr[k] === '$in'; }) };
            }) };
    }
    function project(S, o) {
        if (o && o.project) return o.project;
        return Object.keys((S && S.profiles && S.profiles.projects) || {})[0] || '';
    }
    function build(S, o) {
        var T = w && w.FK_SETSTEPS, qs = {}, own = {}, list = [], byId = {}, CHN = {};
        (setp().questions ? setp().questions() : []).forEach(function (q) { qs[q.id] = fromQuick(q); });
        (T ? T.steps() : []).forEach(function (s) { own[s.id] = s; });
        (T ? T.order() : []).forEach(function (e) {
            var s = own[e[0]] || qs[e[0]];
            if (!s) return;
            s.ch = e[1]; s.r = e[2]; s.i = list.length;
            list.push(s); byId[s.id] = s;
        });
        var chs = T ? T.chapters() : [];
        chs.forEach(function (c) { CHN[c.id] = c; });
        return { S: S || {}, o: o || {}, T: T, dir: project(S, o), steps: list, byId: byId, ch: chs, CHN: CHN };
    }

    // ---- values: what the files hold now, and what the answers write ----
    function isMachine(k) { return (setp().MACHINE || []).indexOf(k) >= 0 || k.indexOf('notify.') === 0; }
    function scopeOf(k) { return isMachine(k) ? 'machine' : 'project'; }
    function rawAgent(k) {
        var set = (cx.S.profileSpec && cx.S.profileSpec.set) || {};
        var p = (set.projects || {})[cx.dir] || {}, m = set.machine || {};
        return has(p, k) ? String(p[k]) : has(m, k) ? String(m[k]) : '';
    }
    function cur(k) {
        if (has(st.over, scopeOf(k) + ' ' + k)) return st.over[scopeOf(k) + ' ' + k];
        if (k === 'notify.*') return ['gate', 'stage', 'end'].filter(function (x) { return cur('notify.' + x) === 'true'; }).join(',');
        if (k === 'prompt.*') return STG.some(function (x) { return cur('prompt.' + x) !== ''; }) ? 'set' : '';
        if (k.indexOf('agent.') === 0) return rawAgent(k);
        var v = setp().cur ? setp().cur(cx.S, isMachine(k) ? '' : cx.dir, k) : '';
        v = v == null ? '' : String(v);
        return BLANK[k] && v === 'false' ? '' : v;
    }
    function gitFmt() { return (st.sug && st.sug.commitFormat) || GIT_FMT; }
    function front() { return !st.sugErr && (!st.sug || st.sug.front !== false); }
    function val(P, k) { return has(P, k) ? P[k].v : cur(k); }
    function optOf(s, o) { for (var i = 0; i < s.opts.length; i++) if (s.opts[i].o === o) return s.opts[i]; return null; }
    function applies(s, P) {
        if (s.cond === 'push') {
            var m = st.ans.main !== undefined ? st.ans.main : nowOf(cx.byId.main);
            return m !== 'pr' && m !== 'keep';
        }
        if (s.cond === 'front') return front();
        if (s.cond === 'skill') return front() && val(P, 'design.mockup') !== 'false';
        return true;
    }
    function writes(s, o, P) {
        var out = {};
        if (o === undefined || o === null) return out;
        if (s.kind === 'multi') {
            out[s.key] = s.opts.filter(function (x) { return o.indexOf(x.o) >= 0; }).map(function (x) { return x.o; }).join(',');
            return out;
        }
        if (s.kind === 'style') {
            if (o === 'none' || !cx.T.STY[o]) return out;
            Object.keys(cx.T.STY[o]).forEach(function (k) { if (!has(P, k)) out[k] = cx.T.STY[o][k]; });
            return out;
        }
        var t = st.inp[s.id] || {};
        if (s.kind === 'table') { // 'm:<agent>' / 'e:<agent>' -> agent.<agent>.model|effort; '' = 預設 (unset)
            Object.keys(t).forEach(function (k) { var p = k.split(':'); out['agent.' + p[1] + '.' + (p[0] === 'm' ? 'model' : 'effort')] = t[k]; });
            return out;
        }
        var a = optOf(s, o);
        if (!a) return out;
        Object.keys(a.w).forEach(function (k) {
            var v = a.w[k];
            if (v === '$each') { STG.forEach(function (x) { var y = String(t[x] || '').trim(); if (y) out['prompt.' + x] = y; }); return; }
            if (v === '$git') v = gitFmt();
            if (v === '$in') { v = String(t.text || '').trim(); if (!v) return; }
            out[k] = v;
        });
        return out;
    }
    function plan(upto) {
        var P = {}, n = upto == null ? cx.steps.length : upto;
        for (var i = 0; i < n; i++) {
            var s = cx.steps[i];
            if (!applies(s, P)) continue;
            var wr = writes(s, st.ans[s.id], P);
            Object.keys(wr).forEach(function (k) { P[k] = { v: wr[k], by: s.id }; });
            if (s.id === 'where' && st.ans.where === 'away' && st.mc === 'yes') {
                if (st.mck['notify.gate']) P['notify.*'] = { v: 'gate', by: 'card' };
                if (st.mck['station.remote']) P['station.remote'] = { v: 'true', by: 'card' };
            }
        }
        return P;
    }
    // does answer a describe the values get(k) returns?
    function matches(s, a, get) {
        var ks = Object.keys(a.w || {});
        if (!ks.length) return true;
        return ks.every(function (k) {
            if (k.indexOf('$') >= 0) return false;
            var v = a.w[k], g = get(k) || '';
            if (v === '$git') v = gitFmt();
            if (v === '$in') return !!g && !s.opts.some(function (x) { return x !== a && x.w && x.w[k] === g; });
            return g === v;
        });
    }
    function nowOf(s) {
        if (!s) return null;
        if (s.kind === 'multi') return cur(s.key).split(',').filter(Boolean);
        if (s.kind === 'style' || s.kind === 'table') return null;
        var hit = s.opts.filter(function (a) { return matches(s, a, cur); });
        return hit.length ? hit[0].o : null;
    }
    function derived(s, P) {
        if (s.kind === 'style' || s.kind === 'table') return null;
        if (s.kind === 'multi') return has(P, s.key) ? { o: P[s.key].v.split(',').filter(Boolean), by: P[s.key].by } : null;
        for (var i = 0; i < s.opts.length; i++) {
            var a = s.opts[i], by = null;
            Object.keys(a.w || {}).forEach(function (k) { if (has(P, k)) by = by || P[k].by; });
            if (by && matches(s, a, function (k) { return val(P, k); })) return { o: a.o, by: by };
        }
        return null;
    }
    function diffN(id, P) { return cx.T.SKEYS.filter(function (k) { return has(P, k) && cx.T.STY[id][k] !== P[k].v; }).length; }
    function near(P) {
        var best = cx.T.TIE[0];
        cx.T.TIE.forEach(function (id) { if (diffN(id, P) < diffN(best, P)) best = id; });
        return { id: best, d: diffN(best, P) };
    }
    function pre(s, P) {
        if (s.kind === 'style') return near(P).id;
        if (s.kind === 'table') return null;
        var d = derived(s, P);
        return d ? d.o : nowOf(s);
    }
    function sel(s, P) {
        if (st.ans[s.id] === null) return s.kind === 'multi' ? [] : null;
        return st.ans[s.id] !== undefined ? st.ans[s.id] : pre(s, P);
    }
    function chSteps(ch) { return cx.steps.filter(function (s) { return s.ch === ch && applies(s, plan(s.i)); }); }
    function nextFrom(i) { for (var j = i + 1; j < cx.steps.length; j++) if (applies(cx.steps[j], plan(j))) return cx.steps[j].id; return 'final'; }
    function prevFrom(i) { for (var j = i - 1; j >= 0; j--) if (applies(cx.steps[j], plan(j))) return cx.steps[j].id; return null; }
    function changes() {
        if (!cx) return [];
        var P = plan(), out = [];
        Object.keys(P).forEach(function (k) { if ((P[k].v || '') !== cur(k)) out.push({ k: k, from: cur(k), to: P[k].v, by: P[k].by }); });
        return out;
    }
    // prompt.* and notify.* are not keys: each becomes the keys it stands for.
    function expand(k, v) {
        if (k === 'notify.*') {
            var on = v ? v.split(',') : [];
            return ['gate', 'stage', 'end'].map(function (x) { return ['notify.' + x, on.indexOf(x) >= 0 ? 'true' : 'false']; });
        }
        if (k === 'prompt.*') return STG.map(function (x) { return ['prompt.' + x, '']; });
        return [[k, v]];
    }
    function rows() {
        var out = [];
        changes().forEach(function (c) {
            expand(c.k, c.to).forEach(function (kv) {
                var now = cur(kv[0]);
                if (kv[1] === now || (kv[1] === 'false' && now === '')) return;
                out.push({ scope: scopeOf(kv[0]), project: cx.dir, key: kv[0], value: kv[1] });
            });
        });
        return out;
    }

    // ---- labels ----
    function nameOf(k) {
        var N = setp().NAME || {};
        if (has(N, k)) return N[k];
        if (k.indexOf('prompt.') === 0) return loc('sd.promptName', '附加 prompt（{st}）', { st: k.slice(7) === 'all' ? loc('sd.everyStage', '每一站') : k.slice(7) });
        if (k.indexOf('agent.') === 0) {
            var a = k.split('.')[1].replace(/^fankeel-/, '');
            return /\.effort$/.test(k) ? loc('sd.agentEffort', '{a} 的 effort', { a: a }) : loc('sd.agentModel', '{a} 的模型', { a: a });
        }
        return k;
    }
    // A value's label: the short answer of the one option that writes only k=v.
    function labOf(k, v) {
        for (var i = 0; i < cx.steps.length; i++) {
            var s = cx.steps[i];
            for (var j = 0; j < s.opts.length; j++) {
                var a = s.opts[j], ks = Object.keys(a.w || {});
                if (ks.length === 1 && ks[0] === k && a.w[k] === v) return a.s;
            }
        }
        if (k === 'notify.*' || k === 'design.skill') {
            var ms = cx.byId[k === 'notify.*' ? 'notify' : 'skill'];
            return v ? v.split(',').map(function (x) { var a = ms && optOf(ms, x); return a ? a.s : x; }).join(loc('sd.and', '、')) : loc('sd.none', '都不');
        }
        if (k.indexOf('agent.') === 0) return v === '' ? loc('sd.def', '預設') : v;
        return v === '' ? loc('sd.unsetV', '未設') : v;
    }
    function byText(by) {
        if (by === 'card') return loc('sd.byCard', '快速設定 · 第 7 題的機器卡');
        var s = cx.byId[by];
        if (!s) return '';
        if (s.kind === 'style') { var a = optOf(s, st.ans.style); return loc('sd.byStyle', '「{n}」補上', { n: a ? a.label : '' }); }
        return (cx.CHN[s.ch] ? cx.CHN[s.ch].n : '') + ' · ' + s.r;
    }
    function shortOf(s, a) {
        if (s.kind === 'multi') return a.length ? a.map(function (o) { var x = optOf(s, o); return x ? x.s : o; }).join(loc('sd.and', '、')) : loc('sd.none', '都不');
        if (s.kind === 'table') {
            var tw = writes(s, a, {}), n = Object.keys(tw).filter(function (k) { return tw[k] !== cur(k); }).length;
            return n ? loc('sd.changedN', '改 {n} 項', { n: n }) : loc('sd.kept', '維持');
        }
        var x = optOf(s, a), t = st.inp[s.id] && st.inp[s.id].text;
        return !x ? '' : x.input && t ? t : x.s;
    }
    function code(k, v) {
        var real = k === 'notify.*' ? (v ? v.split(',').map(function (x) { return 'notify.' + x + ': true'; }).join(loc('sd.and', '、')) : loc('sd.notifyOff', 'notify.*: 全關')) : k + ': ' + v;
        return '<code>' + esc(real) + (v === '' && k !== 'notify.*' ? '<i>' + esc(loc('sd.unset', '不寫（未設）')) + '</i>' : '')
            + (isMachine(k) ? '<i>' + esc(loc('sd.onMachine', ' · 這台機器')) + '</i>' : '') + '</code>';
    }
    function codes(wr) {
        var ks = Object.keys(wr);
        return ks.length ? ks.map(function (k) { return code(k, wr[k]); }).join('') : '<small>' + esc(loc('sd.noChange', '不改任何設定')) + '</small>';
    }
    function sep() { return String(cx.o.configDir || cx.S.configDir || '').indexOf('\\') >= 0 ? '\\' : '/'; }
    function machineFile() { return String(cx.o.configDir || cx.S.configDir || '') + sep() + 'fankeel' + sep() + 'profile.json'; }
    function projectFile() { return cx.dir + sep() + '.fankeel' + sep() + 'profile.json'; }

    // ---- paint ----
    function help(id, aria, tipHtml) {
        return '<span class="v9-help"><button type="button" class="v9-qm" data-qm="' + esc(id) + '" aria-label="' + esc(aria) + '" aria-describedby="v9h-' + esc(id)
            + '" aria-expanded="' + (st.tip === id) + '">?</button><span class="v9-tip" role="tooltip" id="v9h-' + esc(id) + '">' + tipHtml + '</span></span>';
    }
    function wtip(s, a, P) {
        if (s.kind === 'multi') return s.key === 'notify.*' ? code('notify.' + a.o, 'true') : '<code>design.skill: ' + esc(a.o) + '</code><small>' + esc(loc('sd.multi', '可多選，逗號分隔')) + '</small>';
        if (s.kind === 'style') {
            if (a.o === 'none') return '<small>' + esc(loc('sd.noKeys', '不補任何鍵')) + '</small>';
            return '<small>' + esc(loc('sd.fills', '會補上：')) + '</small>' + codes(writes(s, a.o, P)) + '<small>' + esc(loc('sd.differs', '和你的答案差 {n} 項', { n: diffN(a.o, P) })) + '</small>';
        }
        var typed = st.inp[s.id] && st.inp[s.id].text;
        return codes(writes(s, a.o, P)) + (a.input && !typed ? '<small>' + esc(loc('sd.typed', '值是你在下面填的')) + '</small>' : '');
    }
    function optHtml(s, a, n, cv, nv, dv, nr, P) {
        var multi = s.kind === 'multi', on = multi ? (cv || []).indexOf(a.o) >= 0 : cv === a.o;
        var from = !!dv && (multi ? dv.o.indexOf(a.o) >= 0 : dv.o === a.o) && dv.by !== s.id;
        var now = !from && (multi ? !!(nv && nv.indexOf(a.o) >= 0) : nv === a.o);
        var id = 'v9w-' + s.id + '-' + n;
        var tags = (a.rec ? '<span class="v9-tag rec">' + esc(a.rec) + '</span>' : '')
            + (a.pend ? '<span class="v9-tag pend" title="' + esc(a.pendWhy) + '">' + esc(a.pend) + '</span>' : '')
            + (a.risk ? '<span class="v9-risk">' + WARN + esc(a.risk) + '</span>' : '')
            + (now ? '<span class="v9-tag now">' + esc(loc('sd.now', '目前')) + '</span>' : '')
            + (from ? '<span class="v9-tag from" title="' + esc(loc('sd.fromTip', '由「{by}」帶入', { by: byText(dv.by) })) + '">' + esc(loc('sd.from', '帶入')) + '</span>' : '')
            + (nr && nr.id === a.o ? '<span class="v9-tag near">' + esc(loc('sd.near', '最接近')) + '</span>' : '');
        return '<div class="v9-o"><button type="button" class="v9-opt" role="' + (multi ? 'checkbox' : 'radio') + '" aria-checked="' + on + '" tabindex="'
            + (multi || on || (cv == null && n === 0) ? 0 : -1) + '" data-o="' + esc(a.o) + '" aria-describedby="' + id + '"><span class="' + (multi ? 'v9-box' : 'v9-radio')
            + '" aria-hidden="true">' + (multi ? CHECK : '') + '</span><span class="v9-ot">' + esc(a.label) + tags + '</span><span class="v9-oe">' + esc(a.effect)
            + '</span></button><span class="v9-tip v9-wtip" role="tooltip" id="' + id + '">' + wtip(s, a, P) + '</span></div>';
    }
    function inputHtml(id, k, v, ph, mono, pre, mode) {
        return '<span class="v9-in wide' + (mono ? ' mono' : '') + '">' + (pre ? '<i>' + esc(pre) + '</i>' : '') + '<input id="' + id + '" data-in="' + k + '" value="' + esc(v)
            + '" placeholder="' + esc(ph || '') + '" autocomplete="off" spellcheck="false"' + (mode ? ' inputmode="' + mode + '"' : '') + '></span>';
    }
    function fieldsHtml(s, cv, nv) {
        var f = s.field, t = st.inp[s.id] || {};
        if (!f) return '';
        var a = s.opts.filter(function (x) { return x.input; })[0];
        if (!a) return '';
        if (f.each) {
            var g = STG.slice(1).map(function (x) {
                var v = has(t, x) ? t[x] : cur('prompt.' + x);
                return '<label class="v9-each-r" for="v9i-prompt-' + x + '"><code>' + x + '</code></label>' + inputHtml('v9i-prompt-' + x, x, v, fill(f.onePh, { stage: x })).replace('v9-in wide', 'v9-in');
            }).join('');
            return '<div class="v9-field v9-each" data-field="' + esc(a.o) + '"' + (cv === a.o ? '' : ' hidden') + '><label for="v9i-prompt-all">' + esc(f.label) + ' <code>prompt.all</code></label>'
                + inputHtml('v9i-prompt-all', 'all', has(t, 'all') ? t.all : cur('prompt.all'), f.ph) + '<p class="v9-each-h">' + esc(f.one) + ' <code>' + esc(loc('sd.stageCode', 'prompt.<站>')) + '</code></p><div class="v9-each-g">' + g + '</div></div>';
        }
        var key = Object.keys(a.w)[0], v = has(t, 'text') ? t.text : (cv === a.o && nv === cv ? cur(key) : '');
        return '<div class="v9-field" data-field="' + esc(a.o) + '"' + (cv === a.o ? '' : ' hidden') + '><label for="v9i-' + esc(s.id) + '">' + esc(f.label) + '</label>'
            + inputHtml('v9i-' + esc(s.id), 'text', v, f.ph, f.mono, f.pre, f.mode) + '</div>';
    }
    function agentsHtml(s) {
        var spec = cx.S.profileSpec || {}, ags = spec.agents || [], effs = spec.efforts || EFFORTS, tb = s.table, t = st.inp[s.id] || {};
        function pick(kind, a, list, def) {
            var k = kind + ':' + a.name, key = 'agent.' + a.name + '.' + (kind === 'm' ? 'model' : 'effort'), v = has(t, k) ? t[k] : cur(key);
            var short = a.name.replace(/^fankeel-/, '');
            return '<select data-in="' + esc(k) + '" aria-label="' + esc(fill(kind === 'm' ? tb.ariaM : tb.ariaE, { a: short })) + '"><option value=""' + (v === '' ? ' selected' : '') + '>'
                + esc(fill(tb.def, { v: def || '' })) + '</option>' + list.map(function (x) { return '<option value="' + esc(x) + '"' + (v === x ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select>';
        }
        function table(part) {
            return '<table class="v9-at"><thead><tr><th scope="col">' + esc(tb.agent) + '</th><th scope="col">' + esc(tb.model) + '</th><th scope="col">' + esc(tb.effort) + '</th></tr></thead><tbody>'
                + part.map(function (a) {
                    return '<tr><th scope="row"><code>' + esc(a.name.replace(/^fankeel-/, '')) + '</code></th><td>' + pick('m', a, MODELS, a.model) + '</td><td>' + pick('e', a, effs, a.effort) + '</td></tr>';
                }).join('') + '</tbody></table>';
        }
        var half = Math.ceil(ags.length / 2);
        return '<div class="v9-field v9-atab" data-field="table"><div class="v9-at2">' + table(ags.slice(0, half)) + table(ags.slice(half)) + '</div><p class="v9-at-n">' + esc(tb.note) + '</p></div>';
    }
    function cardHtml(cv) {
        if (cv !== 'away') return '';
        var say = st.mc === 'yes' ? loc('sd.mcYes', '會寫進這台機器。') : st.mc === 'no' ? loc('sd.mcNo', '這台機器的設定不動；之後可以在「離開電腦時」再開。') : loc('sd.mcWait', '按確認或先不要，才能到下一步。');
        function box(k, id, label) { return '<input type="checkbox" id="' + id + '" data-mk="' + k + '"' + (st.mck[k] ? ' checked' : '') + '><label for="' + id + '">' + esc(label) + '</label>'; }
        return '<div class="v9-mc" data-block="v9-machine-card" data-state="' + st.mc + '" role="group" aria-labelledby="v9mc-h"><div class="v9-mc-h"><b id="v9mc-h">' + esc(loc('sd.mcHead', '還要寫進這台機器')) + '</b>'
            + help('mc', loc('sd.mcQ', '這張卡寫什麼'), code('notify.gate', 'true') + code('station.remote', 'true') + '<small>' + esc(loc('sd.mcWhy', '寫進 {f}。這兩項只讀機器設定，寫在專案檔不會生效；clone 下來的 repo 也不會把問題送到別台。手機遠端怎麼連還沒定。', { f: machineFile() })) + '</small>')
            + '</div><ul class="v9-mc-l"><li>' + box('notify.gate', 'v9mc-n', loc('sd.mcGate', 'gate 等你時推播到手機')) + '</li><li>' + box('station.remote', 'v9mc-r', loc('sd.mcRemote', '手機遠端連進監控站'))
            + '<span class="v9-tag pend">' + esc(loc('sd.pend', '待定')) + '</span><span class="v9-mc-pend">' + esc(loc('sd.mcPend', '遠端連線方式待定：Tailscale 或支援區網的 VPN')) + '</span></li></ul>'
            + '<div class="v9-mc-f"><button type="button" class="v9-btn pri" data-mc="yes">' + esc(loc('sd.mcOk', '確認，寫進這台機器')) + '</button><button type="button" class="v9-btn" data-mc="no">'
            + esc(loc('sd.mcNot', '先不要')) + '</button><span class="v9-mc-say" role="status">' + esc(say) + '</span></div></div>';
    }
    function stepHtml(s) {
        var P = plan(s.i), cv = sel(s, P), nv = nowOf(s), dv = derived(s, P), nr = s.kind === 'style' ? near(P) : null;
        var h = '<div class="v9-step" data-block="' + (s.ch === 'quick' ? 'v9-q-' : 'v9-' + s.ch + '-') + esc(s.id) + '" data-step="' + esc(s.id) + '"><div class="v9-qh"><h2 class="v9-q" id="v9q-' + esc(s.id) + '" tabindex="-1">' + esc(s.title) + '</h2>'
            + (s.adv ? '<span class="v9-adv">' + esc(s.adv) + '</span>' : '') + help(s.id, loc('sd.why', '為什麼問這題'), esc(s.why)) + '</div>'
            + (s.warn ? '<p class="v9-warnline" role="note">' + WARN + '<span>' + esc(s.warn) + '</span></p>' : '');
        if (s.kind === 'table') h += agentsHtml(s);
        else {
            h += '<div class="v9-opts" role="' + (s.kind === 'multi' ? 'group' : 'radiogroup') + '" aria-labelledby="v9q-' + esc(s.id) + '">'
                + s.opts.map(function (a, n) { return optHtml(s, a, n, cv, nv, dv, nr, P); }).join('') + '</div>' + fieldsHtml(s, cv, nv);
        }
        if (s.id === 'where') h += cardHtml(cv);
        if (s.note && val(P, 'stage.agents') === '') h += '<p class="v9-ev is-warn">' + esc(s.note) + '</p>';
        if (s.id === 'remote' && w && w.FK_REMOTE && typeof w.FK_REMOTE.html === 'function') h += w.FK_REMOTE.html(cx.o.serve);
        return h + '</div>';
    }
    function finalHtml() {
        var ch = changes(), groups = { p: [], m: [] }, html = '';
        ch.forEach(function (c) { groups[isMachine(c.k) ? 'm' : 'p'].push(c); });
        if (!ch.length) html = '<p class="v9-fin-e">' + esc(loc('sd.finNone', '沒有要改的：你的答案和現在的值一樣。')) + '</p>';
        [['p', loc('sd.project', '專案'), projectFile()], ['m', loc('sd.machine', '這台機器'), machineFile()]].forEach(function (g) {
            if (!groups[g[0]].length) return;
            html += '<div class="v9-fin-g"><p class="v9-fin-h"><b>' + esc(loc('sd.items', '{g} · {n} 項', { g: g[1], n: groups[g[0]].length })) + '</b><code title="' + esc(g[2]) + '">' + esc(g[2]) + '</code></p><ul class="v9-fin-l">'
                + groups[g[0]].map(function (c, n) {
                    var id = 'v9f-' + g[0] + n, a = labOf(c.k, c.from), b = labOf(c.k, c.to);
                    return '<li><span class="v9-fk" tabindex="0" aria-describedby="' + id + '">' + esc(nameOf(c.k)) + '</span><span class="v9-tip" role="tooltip" id="' + id + '">' + code(c.k, c.to)
                        + '<small>' + esc(loc('sd.byLine', '來自：{by}', { by: byText(c.by) })) + '</small></span><span class="v9-chg"><s title="' + esc(a) + '">' + esc(a) + '</s><span aria-hidden="true">→</span><span class="hm-sr">'
                        + esc(loc('sd.to', '改成')) + '</span><b title="' + esc(b) + '">' + esc(b) + '</b></span></li>';
                }).join('') + '</ul></div>';
        });
        var left = cx.steps.filter(function (s) { return applies(s, plan(s.i)) && st.ans[s.id] === undefined; }).length;
        return '<div class="v9-step" data-block="v9-final" data-step="final"><div class="v9-qh"><h2 class="v9-q" id="v9q-final" tabindex="-1">' + esc(loc('sd.finT', '要寫入這些改動嗎？')) + '</h2>'
            + help('final', loc('sd.finQ', '寫入什麼'), esc(loc('sd.finY', '按寫入才會動 profile.json。專案和這台機器分開寫；沒走到的題目維持現在的值。'))) + '</div><div>' + html + '</div>'
            + '<p class="v9-fin-n">' + esc(left ? loc('sd.left', '沒走到的 {n} 題維持現在的值，之後隨時可以從左邊接著設定。', { n: left }) : loc('sd.allDone', '每一題都走過了。')) + '</p>'
            + (st.wrote ? '<p class="v9-fin-ok" role="status">' + CHECK + '<span>' + esc(loc('sd.okN', '已寫入 {n} 項。', { n: st.wrote })) + '</span></p>' : '')
            + (st.err ? '<p class="v9-ev is-warn" role="status">' + esc(loc('sd.err', '沒寫進去：{e}', { e: st.err })) + '</p>' : '') + '</div>';
    }
    function footHtml() {
        var fin = st.at === 'final', s = fin ? null : cx.byId[st.at];
        var prevOff = !st.hist.length && (fin ? false : !prevFrom(s.i));
        var h = '<div class="v9-foot" data-block="v9-wiz-foot"><button type="button" class="v9-btn" data-act="prev"' + (prevOff ? ' disabled' : '') + '>' + esc(loc('sd.prev', '上一步')) + '</button>';
        if (fin) {
            var n = rows().length;
            return h + '<span class="v9-pos" aria-live="polite">' + esc(loc('sd.posFinal', '寫入前檢查')) + '</span><button type="button" class="v9-btn pri" data-act="write"' + (!n || st.busy ? ' disabled' : '') + '>'
                + esc(st.wrote && !n ? loc('sd.wrote', '已寫入') : loc('sd.write', '寫入 {n} 項', { n: n })) + '</button></div>';
        }
        var list = chSteps(s.ch), nx = nextFrom(s.i), end = nx !== 'final' && cx.byId[nx].ch !== s.ch;
        var off = s.id === 'where' && sel(s, plan(s.i)) === 'away' && !st.mc ? ' disabled' : '';
        h += '<span class="v9-pos" aria-live="polite">' + esc(loc('sd.pos', '{c} · {k} / {n}', { c: cx.CHN[s.ch].n, k: list.indexOf(s) + 1, n: list.length })) + '</span>'
            + '<button type="button" class="v9-link" data-act="skip">' + esc(loc('sd.skip', '這題跳過')) + '</button>';
        if (end) {
            return h + '<button type="button" class="v9-btn" data-act="stop"' + off + '>' + esc(loc('sd.stop', '到這裡就好')) + '</button><button type="button" class="v9-btn pri" data-act="cont"' + off + '>'
                + esc(loc('sd.cont', '繼續：')) + '<b>' + esc(cx.CHN[cx.byId[nx].ch].n) + '</b></button></div>';
        }
        return h + '<button type="button" class="v9-btn pri" data-act="next"' + off + '>' + esc(nx === 'final' ? loc('sd.check', '檢查並寫入') : loc('sd.next', '下一步')) + '</button></div>';
    }
    function railHtml() {
        var total = 0, done = 0, curCh = st.at === 'final' ? null : cx.byId[st.at].ch, items = '';
        cx.ch.forEach(function (c, ci) {
            var app = 0, rec = 0, sl = '';
            cx.steps.forEach(function (s) {
                if (s.ch !== c.id) return;
                var ok = applies(s, plan(s.i)), a = st.ans[s.id];
                var sa = !ok ? loc('sd.na', '不適用') : a === null ? loc('sd.skipped', '跳過') : a !== undefined ? shortOf(s, a) : '';
                sl += '<li class="v9-s' + (!ok ? ' is-na' : s.id === st.at ? ' is-now' : a === null ? ' is-skip' : a !== undefined ? ' is-done' : '') + '" data-sid="' + esc(s.id) + '"><button type="button" class="v9-sb" data-go="' + esc(s.id) + '"'
                    + (ok ? '' : ' disabled') + (s.id === st.at ? ' aria-current="step"' : '') + '><span class="v9-sm">' + CHECK + '</span><span class="v9-st">' + esc(s.r) + '</span><span class="v9-sa">' + esc(sa) + '</span></button></li>';
                if (ok) { app++; if (a !== undefined) rec++; }
            });
            total += app; done += rec;
            var now = c.id === curCh;
            items += '<li class="v9-c' + (now ? ' is-now is-open' : app > 0 && rec === app ? ' is-done' : rec > 0 ? ' is-part' : '') + '" data-ch="' + esc(c.id) + '"><button type="button" class="v9-cb" data-gochap="' + esc(c.id) + '" aria-expanded="' + now + '">'
                + '<span class="v9-cm"><span>' + (ci + 1) + '</span>' + CHECK + '</span><span class="v9-cn">' + esc(c.n)
                + (c.machine ? '<span class="v9-mtag" title="' + esc(loc('sd.machineTip', '這一章寫進整台機器的設定')) + '">' + esc(loc('sd.machine', '這台機器')) + '</span>' : '')
                + '</span><span class="v9-cc">' + rec + '/' + app + '</span></button><ol class="v9-sl">' + sl + '</ol></li>';
            if (c.id === 'quick') items += '<li class="v9-cut" role="presentation">' + esc(loc('sd.cut', '細項：走到哪停都可以')) + '</li>';
        });
        var said = loc('sd.answered', '已答 {d} / {t}', { d: done, t: total });
        return '<aside class="dcard v9-rail" data-block="v9-rail" aria-label="' + esc(loc('sd.rail', '設定章節')) + '" data-open="' + st.rail + '"><button type="button" class="v9-rtog" data-rtog aria-expanded="' + st.rail + '"><b>'
            + esc(curCh ? cx.CHN[curCh].n : loc('sd.check', '檢查並寫入')) + '</b><span>' + esc(said) + '</span>' + CHEV + '</button><div class="v9-rh"><b>' + esc(loc('sd.steps', '逐步設定')) + '</b><span>' + esc(said) + '</span></div>'
            + '<nav class="v9-ix" data-block="v9-index" aria-label="' + esc(loc('sd.index', '章節與步驟')) + '"><ol>' + items + '</ol></nav><div class="v9-rail-end" data-block="v9-rail-end"><button type="button" class="v9-endb" data-go="final"'
            + (st.at === 'final' ? ' aria-current="step"' : '') + '>' + SAVE + '<span>' + esc(loc('sd.check', '檢查並寫入')) + '</span><b>' + esc(st.wrote && !changes().length ? loc('sd.wrote', '已寫入') : loc('sd.nChanges', '{n} 項改動', { n: changes().length })) + '</b></button></div></aside>';
    }

    // ---- moves ----
    function redraw() { if (last && typeof last.redraw === 'function') last.redraw(); }
    function later(fn) { if (w && typeof w.setTimeout === 'function') w.setTimeout(fn, 0); }
    function focus(sel) { later(function () { var x = doc && doc.querySelector ? doc.querySelector(sel) : null; if (x && x.focus) x.focus({ preventScroll: true }); }); }
    function reduced() { return !!(w && w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    function go(id, nohist) {
        if (id === st.at) return;
        if (!nohist) st.hist.push(st.at);
        st.at = id; st.rail = false; st.tip = ''; st.moving = !reduced();
        redraw();
        focus('[data-block="v9-wizard"] .v9-q');
    }
    function record() {
        if (st.at === 'final') return;
        var s = cx.byId[st.at];
        if (st.ans[s.id] === undefined) { var p = pre(s, plan(s.i)); st.ans[s.id] = p == null ? null : p; }
    }
    function choose(o) {
        var s = cx.byId[st.at];
        if (s.kind === 'multi') {
            var c = (sel(s, plan(s.i)) || []).slice(), i = c.indexOf(o);
            if (i >= 0) c.splice(i, 1); else c.push(o);
            st.ans[s.id] = c;
        } else st.ans[s.id] = o;
        if (s.id === 'main') st.hist = st.hist.filter(function (h) { return h === 'final' || applies(cx.byId[h], plan(cx.byId[h].i)); });
        st.wrote = 0; st.err = '';
        redraw();
        var a = optOf(s, o);
        if (a && a.input) focus('[data-field="' + o + '"] input');
    }
    function act(name) {
        var s = st.at === 'final' ? null : cx.byId[st.at];
        if (name === 'prev') {
            var h = null;
            while (st.hist.length) { h = st.hist.pop(); if (h === 'final' || (cx.byId[h] && applies(cx.byId[h], plan(cx.byId[h].i)))) break; h = null; }
            if (!h && s) h = prevFrom(s.i);
            if (h) go(h, true);
        } else if (name === 'skip' && s) { st.ans[s.id] = null; go(nextFrom(s.i)); }
        else if ((name === 'next' || name === 'cont') && s) { record(); go(nextFrom(s.i)); }
        else if (name === 'stop' && s) { record(); go('final'); }
        else if (name === 'write') write();
    }
    // FK_SETTINGS.post writes one scope a call — o = { scope, project }, rows [{ k, to }],
    // done(ok) — so the project rows go first, then the machine's; a failure stops there.
    function write() {
        var rs = rows();
        if (!rs.length || st.busy || typeof setp().post !== 'function') return;
        st.busy = true; st.err = '';
        var groups = ['project', 'machine'].map(function (sc) {
            return { scope: sc, rows: rs.filter(function (r) { return r.scope === sc; }) };
        }).filter(function (g) { return g.rows.length; });
        (function next(i) {
            if (i >= groups.length) { st.busy = false; st.wrote = rs.length; redraw(); return; }
            var g = groups[i];
            setp().post(cx.S, { scope: g.scope, project: cx.dir }, g.rows.map(function (r) { return { k: r.key, to: r.value }; }), function (ok) {
                if (!ok) {
                    st.busy = false;
                    st.err = g.scope === 'machine' ? machineFile() : projectFile();
                    redraw();
                    return;
                }
                g.rows.forEach(function (r) { st.over[r.scope + ' ' + r.key] = r.value; });
                next(i + 1);
            });
        })(0);
        redraw();
    }
    function suggest() {
        if (!cx.o.serve || !cx.dir || st.sugFor === cx.dir || typeof fetch !== 'function') return;
        st.sugFor = cx.dir;
        var p = fetch('station/suggest?project=' + encodeURIComponent(cx.dir));
        if (!p || typeof p.then !== 'function') return;
        var dir = cx.dir;
        // A failed answer is kept (sugErr), not retried on every repaint: the page says so, and the
        // front-end steps stay out because nothing says this repo has a front end.
        p.then(function (r) { return r && r.ok ? r.json() : null; }).then(function (j) {
            if (st.sugFor !== dir) return;
            if (j) st.sug = j; else st.sugErr = true;
            redraw();
        }, function () { if (st.sugFor === dir) { st.sugErr = true; redraw(); } });
    }

    // ---- events (bound on the first page(), on the document) ----
    function inPage(t) { return !!(t && typeof t.closest === 'function' && t.closest('[data-block="v9-page"]')); }
    function onClick(e) {
        var t = e && e.target;
        if (!cx || !t || typeof t.closest !== 'function') return;
        var qm = t.closest('[data-qm]');
        if (!qm && st.tip) { st.tip = ''; if (!inPage(t)) { redraw(); return; } }
        if (!inPage(t)) return;
        var b = t.closest('.v9-opt');
        if (b && st.at !== 'final') { choose(b.getAttribute('data-o')); return; }
        var m = t.closest('[data-mc]');
        if (m) { st.mc = m.getAttribute('data-mc'); redraw(); return; }
        if (qm) { var id = qm.getAttribute('data-qm'); st.tip = st.tip === id ? '' : id; redraw(); return; }
        var a = t.closest('[data-act]');
        if (a) { if (!a.disabled) act(a.getAttribute('data-act')); return; }
        if (t.closest('[data-rtog]')) { st.rail = !st.rail; redraw(); return; }
        var g = t.closest('[data-go]');
        if (g) { if (!g.disabled) go(g.getAttribute('data-go')); return; }
        var c = t.closest('[data-gochap]');
        if (c) {
            var list = chSteps(c.getAttribute('data-gochap'));
            var first = list.filter(function (s) { return st.ans[s.id] === undefined; })[0] || list[0];
            if (first) go(first.id);
        }
    }
    function onInput(e) {
        var x = e && e.target;
        if (!cx || st.at === 'final' || !inPage(x)) return;
        var mk = x.getAttribute('data-mk');
        if (mk) { if (e.type === 'change') { st.mck[mk] = !!x.checked; redraw(); } return; }
        var k = x.getAttribute('data-in');
        if (!k) return;
        var s = cx.byId[st.at], f = x.closest('[data-field]');
        st.inp[s.id] = st.inp[s.id] || {};
        st.inp[s.id][k] = x.value;
        if (f) st.ans[s.id] = f.getAttribute('data-field');
        st.wrote = 0;
        if (e.type === 'change') redraw();
    }
    function onKey(e) {
        if (!cx) return;
        if (e.key === 'Escape' && st.tip) { st.tip = ''; redraw(); return; }
        var b = e.target && typeof e.target.closest === 'function' ? e.target.closest('.v9-opt[role=radio]') : null;
        var d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
        if (!b || !d || st.at === 'final') return;
        e.preventDefault();
        var s = cx.byId[st.at], i = s.opts.indexOf(optOf(s, b.getAttribute('data-o')));
        var o = s.opts[(i + d + s.opts.length) % s.opts.length].o;
        choose(o);
        focus('.v9-opt[data-o="' + o + '"]');
    }
    function bind() {
        if (bound || !doc || typeof doc.addEventListener !== 'function') return;
        bound = true;
        doc.addEventListener('click', onClick);
        doc.addEventListener('input', onInput);
        doc.addEventListener('change', onInput);
        doc.addEventListener('keydown', onKey);
    }

    function page(S, o) {
        last = o || {};
        bind();
        cx = build(S, last);
        if (!cx.steps.length) return '<div class="st v9" data-block="v9-page"><p class="v9-ev">' + esc(loc('sd.noTable', '設定表還沒載入。')) + '</p></div>';
        suggest();
        // `#/settings/detail/<step>` opens that step once; moving on keeps the hash.
        var hash = String(last.hash || (w && w.location && w.location.hash) || '');
        if (hash !== st.hash) {
            st.hash = hash;
            var m = /^#\/settings\/detail\/([a-z]+)/.exec(hash);
            if (m && (cx.byId[m[1]] || m[1] === 'final')) st.at = m[1];
        }
        if (!st.at || (st.at !== 'final' && !cx.byId[st.at])) st.at = cx.steps[0].id;
        var moving = st.moving;
        st.moving = false;
        return '<div class="st v9' + (moving ? ' is-moving' : '') + '" data-block="v9-page">' + railHtml() + '<section class="dcard v9-wiz" data-block="v9-wizard" aria-label="' + esc(loc('sd.wizard', '設定精靈')) + '">'
            + (st.sugErr ? '<p class="v9-ev is-warn" role="status">' + esc(loc('sd.sugErr', '推薦取不到，前端相關的步驟先不問。')) + '</p>' : '')
            + (st.at === 'final' ? finalHtml() : stepHtml(cx.byId[st.at])) + footHtml() + '</section></div>';
    }
    function state() { return st; }

    var api = { page: page, onClick: onClick, onInput: onInput, onKey: onKey, changes: changes, rows: rows, state: state, reset: reset, EN: EN };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_SETDETAIL = api;
}(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null));
