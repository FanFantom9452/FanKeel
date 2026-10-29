// 清單頁 (FK_LISTPAGE): moved out of station.js (station-52). station.js
// calls make(K) once, on first use, handing it the helpers and the page state
// these bodies name; the state that gets reassigned (S, route, pickOpen, …)
// comes as a getter.
(function (w) {
    'use strict';
    function make(K) {
        // One alias per name K carries, so the bodies below moved verbatim.
        var loc = K.loc, esc = K.esc, ago = K.ago, day = K.day, stamp = K.stamp, mins = K.mins, tokens = K.tokens,
            usd = K.usd, cost = K.cost, icon = K.icon, shortLabel = K.shortLabel, match = K.match, clockSec = K.clockSec,
            statePill = K.statePill, runningTag = K.runningTag, estMark = K.estMark, totalSuffix = K.totalSuffix,
            secOpen = K.secOpen, seenHtml = K.seenHtml, recordHtml = K.recordHtml, listAskRow = K.listAskRow,
            subtabsHtml = K.subtabsHtml, boardLinkHtml = K.boardLinkHtml, needDetail = K.needDetail,
            openSections = K.openSections, detailSections = K.detailSections, detailNote = K.detailNote,
            ROUTE = K.ROUTE, STAGE_C = K.STAGE_C, f = K.f, view = K.view, LS = K.LS, rows = K.rows, DETAIL = K.DETAIL,
            doc = K.doc;

        function taskCell(s) {
            return '<div class="ell" title="' + esc(s.task) + '" style="font-weight:500">'
                + esc(s.task || loc('tune.unnamed', '（未命名）')) + '</div>'
                + '<div class="mute ell" style="font-size:11px;margin-top:2px">'
                + esc(K.LAB()[s.root]) + ' · ' + ago(s.updated) + '</div>';
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
            var hit = K.S().projects.filter(function (p) { return p.root === root; });
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
            var hit = K.S().projects.filter(function (p) { return p.root === root; });
            if (!hit.length || hit[0].gone) return '';
            var p = hit[0];
            var own = K.S().sessions.filter(function (s) { return s.root === p.root; });
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
                + boardLinkHtml(p, K.S().serve)
                + '</div></div>';
        }

        // The home page answers the search box and nothing else: the list page's
        // facets narrow the list page, and a facet left set there that quietly
        // shrank these totals would read as a quieter month.
        function homeRows() {
            return K.S().sessions.filter(function (s) { return match(s, { q: f.q, state: '', project: '', stage: '' }); });
        }
        function homeOpts(sel) {
            return { metric: view.metric, dim: view.dim, sel: sel, today: K.TODAY(), days: K.DAYS(), names: K.NAMES(), pkeys: K.PKEYS() };
        }
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
        var CARET = '<svg class="caret" viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><path d="M2 3.8 5 6.8l3-3" fill="none"'
            + ' stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        // `items` are `{ v, main, sub, n, lead, bar }`: `sub` a muted second line (and the
        // title), `lead` markup before the label, `bar` a 0–1 share drawn under it;
        // `search` puts a box over the rows.
        function pickHtml(key, ico, name, items, search) {
            var open = K.pickOpen() === key, q = open ? K.pickQ().toLowerCase() : '', cur = items[0];
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
                    + (search ? '<input type="search" data-pickq placeholder="' + loc('dash.findName', '找 {name}', { name: name }) + '" aria-label="' + loc('dash.findName', '找 {name}', { name: name }) + '" value="' + esc(K.pickQ()) + '">' : '')
                    + '<div class="seg" role="listbox" aria-label="' + name + '" data-facet="' + key + '">' + items.map(opt).join('') + '</div></div>' : '')
                + '</div></div>';
        }
        // The side bar's three facets, moved onto the page they narrow.
        function facetsHtml() {
            var n = { live: 0, stale: 0, down: 0 }, byStage = {}, byRoot = {}, all = K.S().sessions.length;
            K.S().sessions.forEach(function (s) {
                n[s.state]++;
                byStage[s.stage] = (byStage[s.stage] || 0) + 1;
                byRoot[s.root] = (byRoot[s.root] || 0) + 1;
            });
            var tail = K.S().projects.map(function (p) { return shortLabel(K.LAB()[p.root] || p.root); });
            var stages = ROUTE.filter(function (k) { return byStage[k]; });
            var top = Math.max.apply(null, stages.map(function (k) { return byStage[k]; }).concat([1]));
            return '<div class="controls lctl">'
                + pickHtml('state', FICON.state, loc('dash.state', '狀態'), [{ v: '', main: loc('dash.all', '全部'), n: all }].concat(['live', 'stale', 'down'].map(function (k) {
                    return { v: k, main: k, n: n[k], lead: '<i class="dot ' + k + '"></i>' };
                })))
                + pickHtml('project', icon('projects'), 'Registry', [{ v: '', main: loc('dash.all', '全部'), n: all }].concat(K.S().projects.map(function (p, i) {
                    // The path's last segment, unless another registry ends the same way.
                    var t = tail.filter(function (x) { return x === tail[i]; }).length > 1 ? K.LAB()[p.root] || p.root : tail[i];
                    return { v: p.root, main: t + (p.gone ? ' — gone' : ''), sub: p.root, n: byRoot[p.root] || 0 };
                })), K.S().projects.length > 6)
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
            var n = LS.picked.length;
            return icon('cmp') + '<span>' + loc('dash.pickedN', '已選 <b id="ncmp">{n}</b> 個', { n: n }) + '</span>'
                + (n >= 2 ? '<a class="sbtn pri" href="#/cmp">' + loc('dash.compare', '比較') + '</a>'
                    : '<span title="' + loc('dash.pickAtLeastTwo', '至少選 2 個') + '"><button type="button" class="sbtn pri" disabled>' + loc('dash.compare', '比較') + '</button></span>')
                + '<button type="button" class="sbtn" data-cmpclear' + (n ? '' : ' tabindex="-1"') + '>' + loc('dash.clear', '清除') + '</button>';
        }
        function selbarHtml() {
            return '<div class="selbar" id="selbar" role="region" aria-label="' + loc('dash.checkedSessionsToCompare', '比較勾選的 session') + '"' + (LS.picked.length ? ' data-on' : ' aria-hidden="true"') + '>'
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
                var x = val(a, LS.sortKey), y = val(b, LS.sortKey);
                if (typeof x === 'string' || typeof y === 'string') {
                    return LS.sortDir * String(x).localeCompare(String(y));
                }
                return LS.sortDir * ((x || 0) - (y || 0));
            });
            doc.getElementById('cnt').textContent = R.length + ' / ' + K.S().sessions.length;
            doc.getElementById('lh').innerHTML = '<tr><th class="cmpth" aria-label="' + loc('dash.pickToCompare', '選來比較') + '" title="' + loc('dash.checkTwoToCompare', '勾兩個 session 來比較') + '">' + icon('cmp') + '</th>' + COLS.map(function (c) {
                return '<th data-k="' + c[0] + '"'
                    + (['burn', 'cost'].indexOf(c[0]) >= 0 ? ' class="r"' : '')
                    + (LS.sortKey === c[0] ? ' data-dir="' + (LS.sortDir > 0 ? 'asc' : 'desc') + '"' : '')
                    + '>' + c[1] + '</th>';
            }).join('') + '</tr>';
            doc.getElementById('lb').innerHTML = R.map(function (s) {
                var ask = listAskRow(s, LS.sel);
                return '<tr' + (ask ? ' class="has-ask"' : '') + ' data-id="' + esc(s.id) + '" aria-selected="' + (LS.sel === s.id) + '">'
                    + '<td><input type="checkbox" data-cmp="' + esc(s.id) + '" aria-label="' + loc('dash.pickToCompare', '選來比較') + '"'
                    + (LS.picked.indexOf(s.id) >= 0 ? ' checked' : '')
                    + (s.hasDetail ? '' : ' disabled title="' + loc('dash.noTranscriptToCompare', '沒有 transcript，沒有細節可比') + '"') + '></td>'
                    + '<td>' + taskCell(s) + '</td><td>' + stageCell(s) + '</td>'
                    + '<td class="r num mute">' + tokens(s.burn) + '</td>'
                    + '<td class="r num">' + usd(cost(s), true) + estMark({ estimated: s.estimated && s.estimated.length }) + '</td>'
                    + '<td class="c-state">' + statePill(s) + runningTag(s) + '</td>'
                    + '<td class="num mute" style="font-size:11.5px">' + day(s.started) + '</td>'
                    + '<td class="num mute" style="font-size:11.5px">' + ago(s.updated) + '</td></tr>' + ask;
            }).join('') || '<tr><td colspan="8"><div class="empty">' + loc('dash.noMatchingSessions', '沒有符合的 session') + '</div></td></tr>';
            if (R.length && !R.some(function (s) { return s.id === LS.sel; })) LS.sel = R[0].id;
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
            if (!K.S().serve) {
                return '<code class="mono">node ' + esc(K.S().plugin || '<plugin>')
                    + '/scripts/task.js clear &lt;id&gt;</code>';
            }
            return '<form method="post" action="/clear-stale">'
                + '<input type="hidden" name="nonce" value="' + esc(K.S().nonce || '') + '">'
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
            if (K.S().serve) {
                return '<form class="clearform" method="post" action="/clear">'
                    + '<input type="hidden" name="root" value="' + esc(s.root) + '">'
                    + '<input type="hidden" name="id" value="' + esc(s.id) + '">'
                    + '<input type="hidden" name="nonce" value="' + esc(K.S().nonce || '') + '">'
                    + '<label><input type="checkbox" name="force" value="1"> force</label>'
                    + '<button class="ctl" type="submit">clear</button></form>';
            }
            return '<div class="claims" style="margin-top:14px">node '
                + esc(K.S().plugin || '<plugin>') + '/scripts/task.js clear ' + esc(s.id)
                + ' --root "' + esc(s.root) + '" --session &lt;your session id&gt;</div>';
        }
        function drawDetail() {
            var d = doc.getElementById('det');
            if (!d) return;
            var hit = K.S().sessions.filter(function (x) { return x.id === LS.sel; });
            if (!hit.length) {
                claimsKeep(d); view.claimsFor = null;
                d.innerHTML = '<div class="empty">' + loc('dash.pickARow', '選一列') + '</div>';
                return;
            }
            var s = hit[0];
            needDetail(s);
            var open = openSections(s);
            var x = DETAIL[s.id] || null;
            var tot = s.stages.reduce(function (n, w) {
                return n + Math.max(w.to - w.from, 0);
            }, 0) || 1;
            claimsKeep(d);
            d.innerHTML = '<div class="cbody" style="padding-top:16px">'
                + '<div style="display:flex;gap:7px;align-items:center;margin-bottom:10px;'
                + 'flex-wrap:wrap">' + statePill(s)
                + '<span class="chip" title="' + esc(s.root) + '">' + esc(K.LAB()[s.root])
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
            claimsPut(d, s.id);
        }
        // A dragged .claims height lives on the element's inline style, which the
        // repaint above replaces; view.claimsH maps session id -> heights by
        // position, so each session keeps its own. view.claimsFor is the session
        // the DOM in #det was drawn for: only that DOM is read back, and it is
        // saved under that session, so A's drag survives a switch to B and back.
        function claimsKeep(d) {
            var f = view.claimsFor;
            if (!f) return;
            var h = [], any = false;
            var els = d.querySelectorAll ? d.querySelectorAll('.claims') : [];
            // no element in the DOM means no height was reset: keep what is saved
            if (!els.length) return;
            Array.prototype.forEach.call(els, function (el) {
                h.push(el.style.height || ''); if (el.style.height) any = true;
            });
            view.claimsH = view.claimsH || {};
            if (any) view.claimsH[f] = h; else delete view.claimsH[f];
        }
        function claimsPut(d, id) {
            view.claimsFor = id;
            var k = view.claimsH && view.claimsH[id];
            if (!k || !d.querySelectorAll) return;
            Array.prototype.forEach.call(d.querySelectorAll('.claims'), function (el, i) { if (k[i]) el.style.height = k[i]; });
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
            var totalUnreadable = K.S().projects.reduce(function (n, p) {
                return n + (p.unreadable || 0);
            }, 0);
            return loc('dash.scannedAt', '掃描於 {t}', { t: stamp(K.NOW()) })
                + loc('dash.pricesVerified', ' · 價目表 {t}', { t: K.S().pricesVerified })
                + (K.S().scanStats && K.S().scanStats.depthCuts
                    ? loc('dash.depthCutScanAt', ' · depth 中止掃描 {n} 處', { n: K.S().scanStats.depthCuts }) : '')
                + (K.S().scanStats && K.S().scanStats.timedOut ? loc('dash.scanTimedOut', ' · 掃描逾時未跑完') : '')
                + (!(K.route().view === 'list' && f.project) && totalUnreadable
                    ? loc('dash.nSessionFilesUnreadable', ' · {n} 個 session 檔案讀不到', { n: totalUnreadable }) : '')
                + (K.S().serve ? loc('dash.rereadEvery3s', ' · 每 3 秒重讀一次，最後一次 {t}', { t: clockSec(K.polledAt()) }) : '');
        }
        return { taskCell: taskCell, stageCell: stageCell, goneNote: goneNote, registryNote: registryNote, homeRows: homeRows, homeOpts: homeOpts, val: val, pickHtml: pickHtml, facetsHtml: facetsHtml, selbarInner: selbarInner, selbarHtml: selbarHtml, listPage: listPage, drawList: drawList, clearStaleControl: clearStaleControl, clearControl: clearControl, drawDetail: drawDetail, claimsKeep: claimsKeep, claimsPut: claimsPut, genText: genText, COLS: COLS, FICON: FICON, CARET: CARET };
    }
    var api = { make: make };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_LISTPAGE = api;
}(typeof window !== 'undefined' ? window : null));
