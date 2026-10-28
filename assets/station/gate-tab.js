// 關卡分頁 (FK_GATEVIEW): moved out of station.js (station-52). station.js
// calls make(K) once, on first use, handing it the helpers these bodies
// name; everything here only builds strings.
(function (w) {
    'use strict';
    function make(K) {
        // One alias per name K carries, so the bodies below moved verbatim.
        var loc = K.loc, esc = K.esc, family = K.family, mins = K.mins, icon = K.icon,
            recLabel = K.recLabel, recTitle = K.recTitle, planNewest = K.planNewest, w = K.w;
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
            var src = p.mockup && p.mockup.shot ? (K.S().serve ? 'station/shot/' + encodeURIComponent(s && s.id ? s.id : '') + '.png' : p.mockup.shot.href) : '';
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
        return {
            gateStage: gateStage, gateAt: gateAt, gateText: gateText, gateSec: gateSec, gateKv: gateKv, gateRest: gateRest,
            gateList: gateList, gatePatrol: gatePatrol, gateSurvey: gateSurvey, gateDisp: gateDisp, gateDesign: gateDesign,
            gateBuild: gateBuild, gateTime: gateTime, gateLand: gateLand, gateTabHtml: gateTabHtml, gateTab: gateTab
        };
    }
    var api = { make: make };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_GATEVIEW = api;
}(typeof window !== 'undefined' ? window : null));
