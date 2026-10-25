'use strict';
// assets/station/docs-page.js — the 文件 page `#/docs` as approved (station-38;
// mockup .fankeel/build/2026-10-21-station-redesign/route-docs.html, blocks
// docs-head, docs-health, docs-findings, docs-reader, docs-project). A find box
// whose hits drop into a popover (GET station/search); the docs-health matrix,
// a row a project and a column a check, zero a tick, read once a visit from
// GET station/docs-health (`?fresh=1` when asked to check again); the picked
// cell listed beside it; a reader dialog rendering one page's markdown from
// GET station/doc with the cited line marked, arrow keys walking the list it
// came from; a project's map from S.projects[].docs. No relation graph.
// The two dialogs live under <body>, outside #page, so the 3 s redraw never
// replaces them; the find box's HTML never changes, so the redraw's part diff
// leaves it and its caret alone, and hits are painted into #dq-pop directly.
// Reads `w.FK_KIT` (esc, fillVars, shortLabel) when it draws.
(function (w, doc) {
    var EN = {
        'dk.find': 'Find a page',
        'dk.findHint': 'Type a word, e.g. remote',
        'dk.hitsLabel': 'Matching pages',
        'dk.scope': 'Searches reference, guide and decision pages in every project<br>archive, plan and report are left out',
        'dk.healthLabel': 'Documents to handle',
        'dk.unserved': 'This table needs serve: a station written to disk does not run docs-check or docs-audit.',
        'dk.loadFail': 'Could not read the document checks: {e}',
        'dk.loading': 'Running docs-check and docs-audit on every project; the first time takes a few seconds…',
        'dk.keyFix': 'To fix: the number is how many, click for the list',
        'dk.keyCtx': 'Outside the checks, for reference only',
        'dk.keyOk': 'Nothing wrong',
        'dk.keyOrder': 'Projects in order of their latest session',
        'dk.runTip': 'Re-run docs-check and docs-audit on every project in the background; the table updates when they finish',
        'dk.running': 'Checking…',
        'dk.run': 'Check again',
        'dk.lastRun': 'last {t}',
        'dk.noTree': '{p} declares no document tree, so nothing is filed',
        'dk.none': '{p}: no {k}',
        'dk.noneSr': 'None',
        'dk.cellTip': '{p}: {k} {n}, click for the list',
        'dk.caption': 'How many findings each project has in each check',
        'dk.project': 'Project',
        'dk.projTip': '{root}: see its map (status, not built, filing)',
        'dk.files': '{n} files · {t}',
        'dk.capsProjects': '<b>{n}</b> projects',
        'dk.capsFiles': '<b>{n}</b> markdown files',
        'dk.capsBad': '<b>{n}</b> with defects',
        'dk.paneLabel': 'The picked cell, listed',
        'dk.allClear': 'Every check is clean in every project.',
        'dk.paneWait': 'Once the table is read, the cell you pick is listed here.',
        'dk.noItems': 'docs-audit gives only a count for this check, no file names.',
        'dk.readAt': 'Read this page at line {n}',
        'dk.read': 'Read this page',
        'dk.shown': 'First <b>{s}</b> of <b>{n}</b>',
        'dk.all': '<b>{n}</b> in all',
        'dk.unfiledCount': 'docs-audit counts <b>{n}</b>; above are the <b>{s}</b> docs-check lists under the doc root',
        'dk.full': 'Full list: ',
        'dk.verifiedAgo': 'verified {d} days ago',
        'dk.touchedAgo': 'last edited {d} days ago',
        'dk.changedAfter': '; since then <code>{t}</code> changed',
        'dk.landedNote': 'all {n} named files exist; untouched {d} days',
        'dk.indexDead': 'the index lists <code>{t}</code>, which is gone',
        'dk.indexMissing': 'not listed in the index',
        'dk.diagramNote': '<code>{dir}</code> has {total} files, the diagram names {named}; missing <code>{m}</code>',
        'dk.names': 'names ',
        'dk.links': 'links to ',
        'dk.after': 'Later commit: ',
        'dk.tagGone': 'target is gone',
        'dk.tagMoved': 'line moved',
        'dk.tagPastEnd': 'past the end of the file',
        'dk.tagOrphan': 'declaration not found',
        'dk.tagOpenFence': 'code fence left open',
        'dk.tagLong': 'sentence too long',
        'dk.tagArchive': 'points into archive',
        'dk.tagBinding': 'more than seven bindings',
        'dk.tagBare': 'code with no language',
        'dk.drift': 'Pages to re-read',
        'dk.driftTip': 'The code a page describes changed after the page was last confirmed, so the page may be wrong. Re-read it: if it still holds, update last_verified; if not, fix it.',
        'dk.driftWhat': 'The code this page describes changed after it was last confirmed.',
        'dk.driftFix': 'Re-read it: still right, update <code>last_verified</code>; not, fix the text.',
        'dk.landed': 'Plans to archive',
        'dk.landedTip': 'Every file the plan names is built or deleted, and it has not moved for 3 days or more: the work is done but it still sits in plans like a to-do. Once confirmed, move it into archive.',
        'dk.landedWhat': 'Every file the plan names exists, or git saw it deleted; the work looks done.',
        'dk.landedFix': 'Confirm it is done, then move the plan into archive.',
        'dk.index': 'README rows to fix',
        'dk.indexTip': 'The index docs/README.md lists a page that does not exist, or misses one that does. Add a row for the missing, delete the dead.',
        'dk.indexWhat': 'These pages are not listed in the index <code>{index}</code>, so it does not lead to them.',
        'dk.indexFix': 'Add a row to the index.',
        'dk.diagram': 'Diagrams missing files',
        'dk.diagramTip': 'A mermaid diagram draws most of a directory, but files added to it later are not in the drawing. Add the missing names to the diagram.',
        'dk.diagramWhat': 'The diagram lists a directory\'s files, and the directory has gained files since.',
        'dk.diagramFix': 'Add the missing file names to the diagram.',
        'dk.broken': 'Broken links',
        'dk.brokenTip': 'A link, file:line or program name in a document no longer finds what it points at. Change it to the current path or line.',
        'dk.brokenWhat': 'A link or <code>path:line</code> reference no longer matches.',
        'dk.brokenFix': 'Change it to the current path or line; quote the line too, so a shift is caught.',
        'dk.unfiled': 'Files nobody checks',
        'dk.unfiledTip': 'These markdown files are in no category of .fankeel/docs.json, so none of the five columns to the left checks them. If they are documents, give them a category in docs.json; this column is for reference and is not a defect.',
        'dk.unfiledWhat': 'In no bucket of <code>.fankeel/docs.json</code>, so none of the five checks to the left reads them.',
        'dk.unfiledFix': 'If they are documents, give them a bucket in <code>docs.json</code>.',
        'dk.prev': 'Previous',
        'dk.prevTip': 'Previous (←)',
        'dk.next': 'Next',
        'dk.nextTip': 'Next (→)',
        'dk.close': 'Close',
        'dk.walk': 'switch page',
        'dk.reading': 'Reading…',
        'dk.unreadable': 'Could not read this page.',
        'dk.empty': 'This page is empty.',
        'dk.searchOff': 'Search needs serve running.',
        'dk.searchFail': 'serve did not answer this search.',
        'dk.noHits': 'No page contains “{q}”.',
        'dk.hitsN': '<b>{n}</b> pages contain “{q}”, most mentions first',
        'dk.hitWhy': 'contains “{q}” {n} times',
        'dk.mapAt': '<span class="mono">.fankeel/map.md</span> written <span class="mono">{t}</span>',
        'dk.status': 'Status',
        'dk.mapCount': 'map counts {n}',
        'dk.oldMap': 'This map is in the old format, with no status counts; re-run <code>node scripts/map.js</code> to add them.',
        'dk.noMap': 'This project has no .fankeel/map.md; run <code>node scripts/map.js</code> to write one.',
        'dk.planned': 'Not built',
        'dk.nothing': 'None.',
        'dk.filing': 'Filing',
        'dk.noTreeShort': 'no document tree declared',
        'dk.allRef': 'Every markdown file is checked as reference.',
    };
    function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    function kit() { return (w && w.FK_KIT) || {}; }
    function loc(key, zh, vars) {
        var I = w && w.FK_I18N, s = I && I.lang === 'en' && has(EN, key) ? EN[key] : zh;
        return kit().fillVars ? kit().fillVars(s, vars) : s;
    }
    function esc(s) { return kit().esc(s); }
    var ICO = {
        ok: '<svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5 6.5 11.5 12.5 5"/></svg>',
        doc: '<svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 1.8h5l3.2 3.2v9.2H4z"/><path d="M8.8 1.8v3.4h3.4M6 8.3h4.2M6 11h4.2"/></svg>',
        find: '<svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3"/></svg>',
        run: '<svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 8a5 5 0 1 1-1.5-3.6"/><path d="M13 2.5v3h-3"/></svg>',
        prev: '<svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3.5 5.5 8l4.5 4.5"/></svg>',
        next: '<svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m6 3.5 4.5 4.5L6 12.5"/></svg>',
        x: '<svg class="ico" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'
    };
    // The six checks, in column order; built per draw so the language switch reaches them.
    function kinds() {
        return [
            { k: 'drift', src: 'docs-audit', l: loc('dk.drift', '要重讀的頁'),
                tip: loc('dk.driftTip', '頁面上次確認之後，它描述的程式碼又改了，內容可能已經不對。重讀一遍：還對就更新 last_verified，不對就改內容。'),
                what: loc('dk.driftWhat', '頁面上次確認之後，它描述的程式碼又改了。'),
                fix: loc('dk.driftFix', '重讀頁面：內容還對就更新 <code>last_verified</code>，不對就改內容。') },
            { k: 'landed', src: 'docs-audit', l: loc('dk.landed', '可歸檔的計畫'),
                tip: loc('dk.landedTip', '計畫點名的檔案都已建好或刪掉，而且 3 天以上沒動：工作做完了，卻還放在 plans 裡像待辦。確認做完就移進 archive。'),
                what: loc('dk.landedWhat', '計畫點名的檔案都已存在，或 git 看過它被刪；工作看來做完了。'),
                fix: loc('dk.landedFix', '確認做完，就把計畫移進 archive。') },
            { k: 'index', src: 'docs-audit', l: loc('dk.index', 'README 要改的列'),
                tip: loc('dk.indexTip', '索引 docs/README.md 列了不存在的頁，或漏了現有的頁。漏的補一列，指空的刪掉。'),
                what: loc('dk.indexWhat', '這些文件沒列在索引 <code>{index}</code> 裡，從索引走不到。'),
                fix: loc('dk.indexFix', '在索引加一列。') },
            { k: 'diagram', src: 'docs-audit', l: loc('dk.diagram', '要補檔的圖'),
                tip: loc('dk.diagramTip', '一張 mermaid 圖畫了某個目錄的大部分檔案，目錄後來新增的檔卻沒畫進去。把缺的檔名補進圖。'),
                what: loc('dk.diagramWhat', '圖列出某個目錄的檔案，目錄後來多了檔。'),
                fix: loc('dk.diagramFix', '把缺的檔名補進圖。') },
            { k: 'broken', src: 'docs-check', l: loc('dk.broken', '壞掉的連結'),
                tip: loc('dk.brokenTip', '文件裡的連結、檔案:行號或程式名稱，已經找不到對應的東西。改成現在的路徑或行號。'),
                what: loc('dk.brokenWhat', '連結或 <code>path:line</code> 引用已經對不上。'),
                fix: loc('dk.brokenFix', '改成現在的路徑或行號；引用附上引文，行號移位時就會被抓到。') },
            { k: 'unfiled', src: 'docs-audit', ctx: true, l: loc('dk.unfiled', '沒人檢查的檔'),
                tip: loc('dk.unfiledTip', '這些 markdown 不在 .fankeel/docs.json 的任何分類裡，左邊五欄都不檢查它們。是文件就在 docs.json 給它分類；這欄只供參考，不算缺陷。'),
                what: loc('dk.unfiledWhat', '不在 <code>.fankeel/docs.json</code> 任何 bucket 裡，左邊五項都沒檢查到它們。'),
                fix: loc('dk.unfiledFix', '是文件，就在 <code>docs.json</code> 給它們一個 bucket。') }
        ];
    }
    function kindOf(k) { var K = kinds(); for (var i = 0; i < K.length; i++) if (K[i].k === k) return K[i]; return null; }
    function tagOf(t) {
        var T = { gone: loc('dk.tagGone', '指向的東西不在了'), moved: loc('dk.tagMoved', '行號移位'), 'past-end': loc('dk.tagPastEnd', '超過檔尾'),
            orphan: loc('dk.tagOrphan', '找不到宣告'), 'open-fence': loc('dk.tagOpenFence', 'code fence 沒關'), 'long-sentence': loc('dk.tagLong', '句子太長'),
            'into-archive': loc('dk.tagArchive', '指進 archive'), binding: loc('dk.tagBinding', 'binding 超過七條'), 'bare-code': loc('dk.tagBare', '沒標語言的 code') };
        return has(T, t) ? T[t] : t;
    }
    function num(n) { return Number(n || 0).toLocaleString('en-US'); }
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function when(iso) {
        var d = new Date(iso);
        return iso && isFinite(d.getTime()) ? pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) : '—';
    }
    function splitPath(p) { var m = /^(.*?)(?::(\d+))?$/.exec(String(p || '')); return { file: m[1], line: m[2] ? Number(m[2]) : 0 }; }

    // A visit is a run of draws less than VISIT_MS apart (the redraw is every 3 s); a new visit reads the table again.
    var VISIT_MS = 10000;
    function blank() { return { S: null, data: null, err: null, loading: false, drawnAt: 0, sel: null, q: '', res: null, hits: [], seq: 0, timer: null, list: [], at: 0, readSeq: 0 }; }
    var st = blank(), last = null, bound = false;
    function redraw() { if (last && typeof last.redraw === 'function') last.redraw(); }
    function swOf(pkey) {
        var keys = (last && last.pkeys) || [], i = keys.indexOf(pkey);
        return 'var(--p-' + (i < 0 ? 5 : Math.min(i, 5)) + ')';
    }
    // The table's projects in the shell's order (latest session first), each with its row index, label and colour.
    function projects() {
        var P = (st.data && st.data.projects) || [], keys = (last && last.pkeys) || [], names = (last && last.names) || {};
        var rank = function (p) { var i = keys.indexOf(p.pkey); return i < 0 ? keys.length : i; };
        return P.slice().sort(function (a, b) { return rank(a) - rank(b); }).map(function (p, i) {
            return { i: i, p: p, sw: swOf(p.pkey), name: names[p.pkey] && kit().shortLabel ? kit().shortLabel(names[p.pkey]) : p.name };
        });
    }
    function defects(p) {
        return kinds().reduce(function (a, K) { var c = p.cells && p.cells[K.k]; return a + (K.ctx || !c ? 0 : c.n); }, 0);
    }
    // The picked cell, kept while it still holds findings; else the first defect, reading row by row.
    function selected() {
        var R = projects(), K = kinds(), i, j, c;
        if (st.sel) {
            for (i = 0; i < R.length; i++) {
                c = R[i].p.cells && R[i].p.cells[st.sel.k];
                if (R[i].p.pkey === st.sel.pkey && c && c.n) return { r: R[i], K: kindOf(st.sel.k) };
            }
        }
        for (i = 0; i < R.length; i++) {
            for (j = 0; j < K.length; j++) {
                c = R[i].p.cells && R[i].p.cells[K[j].k];
                if (!K[j].ctx && c && c.n) { st.sel = { pkey: R[i].p.pkey, k: K[j].k }; return { r: R[i], K: K[j] }; }
            }
        }
        st.sel = null;
        return null;
    }
    function load(fresh) {
        if (typeof fetch !== 'function') return;
        st.loading = true;
        fetch('station/docs-health' + (fresh ? '?fresh=1' : ''),{ cache: 'no-store' }).then(function (r) {
            if (!r.ok) throw new Error(String(r.status));
            return r.json();
        }).then(function (d) {
            st.data = d;
            st.err = null;
        }, function (e) {
            st.err = String((e && e.message) || e);
        }).then(function () {
            st.loading = false;
            redraw();
        });
    }

    // ---- the find box: its HTML is a constant of the language, so the redraw leaves it alone ----
    function headHtml() {
        return '<section class="dcard dk-head" data-block="docs-head" aria-label="' + loc('dk.find', '找文件') + '"><div class="dq">'
            + '<label for="dq">' + loc('dk.find', '找文件') + '</label>'
            + '<div class="dq-box">' + ICO.find + '<input id="dq" type="search" autocomplete="off" placeholder="' + loc('dk.findHint', '輸入字詞，例如 remote')
            + '" role="combobox" aria-autocomplete="list" aria-controls="dq-pop" aria-expanded="false"><kbd>/</kbd></div>'
            + '<div class="dq-pop" id="dq-pop" role="listbox" aria-label="' + loc('dk.hitsLabel', '符合的文件') + '" hidden></div></div>'
            + '<p class="dk-scope">' + loc('dk.scope', '搜全部專案 reference、guide、decision 的內文<br>archive、plan、report 不搜') + '</p></section>';
    }
    function paintHits(res) {
        var pop = doc && doc.getElementById('dq-pop'), q = doc && doc.getElementById('dq');
        if (!pop) return;
        var open = function (on) { pop.hidden = !on; if (q && q.setAttribute) q.setAttribute('aria-expanded', on ? 'true' : 'false'); };
        if (!res) { open(false); return; }
        var h;
        if (res.off) h = '<p class="dq-none">' + loc('dk.searchOff', '搜尋要 serve 開著才能用。') + '</p>';
        else if (res.err) h = '<p class="dq-none">' + loc('dk.searchFail', 'serve 沒有回答這次搜尋。') + '</p>';
        else if (!st.hits.length) h = '<p class="dq-none">' + esc(loc('dk.noHits', '沒有頁含「{q}」。', { q: res.q })) + '</p>';
        else {
            h = '<p class="dq-n">' + loc('dk.hitsN', '<b>{n}</b> 頁含「{q}」，次數多的在上', { n: res.n, q: esc(res.q) }) + '</p><ol class="dq-list">'
                + st.hits.map(function (x, i) {
                    return '<li><button type="button" class="dq-row" data-dk-hit="' + i + '"><span class="dq-t">' + esc(x.title || x.path) + '</span><span class="chip">' + esc(x.role) + '</span>'
                        + '<span class="dq-snip">' + esc(x.before) + '<mark>' + esc(x.hit) + '</mark>' + esc(x.after) + '</span>'
                        + '<span class="dq-path">' + esc(x.project) + ' · ' + esc(x.path) + '</span></button></li>';
                }).join('') + '</ol>';
        }
        pop.innerHTML = h;
        open(true);
    }
    function ask(q, n) {
        if (!last || !last.serve || typeof fetch !== 'function') { paintHits({ off: true }); return; }
        fetch('station/search?q=' + encodeURIComponent(q), { cache: 'no-store' }).then(function (r) {
            if (!r.ok) throw new Error(String(r.status));
            return r.json();
        }).then(function (res) {
            if (st.seq !== n) return;
            st.res = res;
            st.hits = res.hits || [];
            paintHits(res);
        }, function () {
            if (st.seq === n) paintHits({ err: true });
        });
    }

    // ---- the matrix: a row a project, a column a check ----
    function cellHtml(r, K) {
        var p = r.p, c = p.cells && p.cells[K.k];
        if (!c || !c.n) {
            if (K.k === 'unfiled' && p.noTree) return '<td class="dh-na"><span title="' + esc(loc('dk.noTree', '{p} 沒宣告文件樹，不分歸檔', { p: r.name })) + '">—</span></td>';
            return '<td class="dh-ok"><span title="' + esc(loc('dk.none', '{p}：{k} 沒有', { p: r.name, k: K.l })) + '">' + ICO.ok + '<span class="hm-sr">' + loc('dk.noneSr', '沒有') + '</span></span></td>';
        }
        var on = Boolean(st.sel && st.sel.pkey === p.pkey && st.sel.k === K.k);
        return '<td><button type="button" class="dh-n' + (K.ctx ? ' ctx' : '') + (on ? ' on' : '') + '" data-dk-cell="' + r.i + ' ' + K.k + '" aria-pressed="' + on + '" title="'
            + esc(loc('dk.cellTip', '{p}：{k} {n} 條，點開看清單', { p: r.name, k: K.l, n: c.n })) + '">' + num(c.n) + '</button></td>';
    }
    function matrixHtml() {
        var K = kinds();
        var h = '<table class="dh-t"><caption class="hm-sr">' + loc('dk.caption', '每個專案在每一項檢查的條數') + '</caption><colgroup><col>'
            + K.map(function (x) { return '<col class="c' + (x.ctx ? ' ctx' : '') + '">'; }).join('') + '</colgroup><thead><tr><th scope="col">' + loc('dk.project', '專案') + '</th>'
            + K.map(function (x) {
                return '<th scope="col" class="' + (x.ctx ? 'ctx' : '') + '"><span class="dh-h" tabindex="0" aria-describedby="dh-tip-' + x.k + '">' + x.l + '</span>'
                    + '<span class="dh-tip" role="tooltip" id="dh-tip-' + x.k + '">' + x.tip + '</span></th>';
            }).join('') + '</tr></thead><tbody>';
        projects().forEach(function (r) {
            h += '<tr' + (st.sel && st.sel.pkey === r.p.pkey ? ' class="on"' : '') + '><th scope="row"><button type="button" class="dh-p" data-dk-proj="' + r.i + '" aria-haspopup="dialog" title="'
                + esc(loc('dk.projTip', '{root}：看它的 map（狀態、還沒建、歸檔位置）', { root: r.p.dir })) + '"><i class="sw" style="background:' + r.sw + '" aria-hidden="true"></i><span class="dh-pn">' + esc(r.name) + '</span></button>'
                + '<span class="dh-pm">' + esc(loc('dk.files', '{n} 份 · {t}', { n: num(r.p.files), t: when(r.p.last) })) + '</span></th>'
                + K.map(function (x) { return cellHtml(r, x); }).join('') + '</tr>';
        });
        return h + '</tbody></table>';
    }
    function capsHtml() {
        var P = st.data.projects || [], bad = P.filter(function (p) { return defects(p) > 0; }).length;
        var files = P.reduce(function (a, p) { return a + (p.files || 0); }, 0);
        return '<span class="dh-caps"><span>' + loc('dk.capsProjects', '<b>{n}</b> 個專案', { n: P.length }) + '</span><span>' + loc('dk.capsFiles', '<b>{n}</b> 份 markdown', { n: num(files) }) + '</span>'
            + '<span class="warn">' + loc('dk.capsBad', '<b>{n}</b> 個有缺陷', { n: bad }) + '</span></span>';
    }
    function keyHtml() {
        return '<p class="dh-key"><span><i style="background:var(--signal-tint);box-shadow:inset 0 0 0 1px var(--signal-ink)"></i>' + loc('dk.keyFix', '要修：數字是條數，點開看清單') + '</span>'
            + '<span><i style="background:var(--inset);box-shadow:inset 0 0 0 1px var(--rule2)"></i>' + loc('dk.keyCtx', '不在檢查範圍，只供參考') + '</span>'
            + '<span>' + ICO.ok + loc('dk.keyOk', '沒問題') + '</span><span>' + loc('dk.keyOrder', '專案依最近的 session 排序') + '</span>'
            + '<button type="button" class="dh-run" data-dk-run="1"' + (st.loading ? ' disabled' : '') + ' title="' + loc('dk.runTip', '背景重跑每個專案的 docs-check 與 docs-audit；跑完這張表自己更新') + '">'
            + ICO.run + (st.loading ? loc('dk.running', '檢查中…') : loc('dk.run', '重新檢查'))
            + ' <span class="mono" style="color:var(--muted)">· ' + esc(loc('dk.lastRun', '上次 {t}', { t: when(st.data.at) })) + '</span></button></p>';
    }
    function healthHtml(o) {
        var h = '<section class="dcard dh" data-block="docs-health" aria-label="' + loc('dk.healthLabel', '要處理的文件') + '"><div class="dcard-h dh-hd">'
            + ICO.doc + '<b>' + loc('dk.healthLabel', '要處理的文件') + '</b>' + (st.data ? capsHtml() : '') + '</div>';
        if (!o.serve) return h + '<p class="df-none">' + loc('dk.unserved', '這張表要 serve 才讀得到：寫在磁碟上的 station 不跑 docs-check 與 docs-audit。') + '</p></section>';
        if (!st.data) {
            return h + '<p class="df-none">' + (st.err ? esc(loc('dk.loadFail', '讀不到文件檢查：{e}', { e: st.err }))
                : loc('dk.loading', '每個專案跑一次 docs-check 與 docs-audit，第一次要幾秒…')) + '</p></section>';
        }
        if (st.err) h += '<p class="df-none">' + esc(loc('dk.loadFail', '讀不到文件檢查：{e}', { e: st.err })) + '</p>';
        return h + '<div id="dh-body">' + matrixHtml() + '</div>' + keyHtml() + '</section>';
    }

    // ---- the list beside it: what one cell holds ----
    function noteOf(k, it) {
        var m;
        if (k === 'drift') {
            return (it.declared ? loc('dk.verifiedAgo', '{d} 天前確認過', { d: it.docAge }) : loc('dk.touchedAgo', '{d} 天前最後修改', { d: it.docAge }))
                + loc('dk.changedAfter', '；之後 <code>{t}</code> 又改了', { t: esc(it.target) });
        }
        if (k === 'landed') return loc('dk.landedNote', '點名的 {n} 個檔都在；{d} 天沒動', { n: it.named, d: it.age });
        if (k === 'index') return it.target ? loc('dk.indexDead', '索引列了 <code>{t}</code>，它不在了', { t: esc(it.target) }) : loc('dk.indexMissing', '索引沒列這份');
        if (k === 'diagram') {
            return loc('dk.diagramNote', '<code>{dir}</code> 有 {total} 個檔，圖只列 {named} 個；缺 <code>{m}</code>', { dir: esc(it.dir), total: it.total, named: it.named, m: esc(it.missing) });
        }
        if (k === 'broken') {
            m = /^(names|links to) (.*)$/.exec(it.note || '');
            if (m) return (m[1] === 'names' ? loc('dk.names', '點名 ') : loc('dk.links', '連到 ')) + '<code>' + esc(m[2]) + '</code>';
            return esc(it.note || '').replace(/`([^`]+)`/g, '<code>$1</code>');
        }
        return '';
    }
    function subOf(it) {
        if (!it.sub || /no commit subject/.test(it.sub)) return '';
        return '<span class="df-sub">' + loc('dk.after', '之後的提交：') + esc(it.sub) + '</span>';
    }
    function findingsHtml(pick) {
        var h = '<section class="dcard df" data-block="docs-findings" aria-label="' + loc('dk.paneLabel', '選中那一格的清單') + '"><div id="df-body">';
        if (!pick) {
            return h + '<div class="dcard-h df-h">' + ICO.doc + '<b>' + loc('dk.paneLabel', '選中那一格的清單') + '</b></div><p class="df-none">'
                + (st.data ? loc('dk.allClear', '每個專案每一項都沒問題。') : loc('dk.paneWait', '表讀到之後，這裡列出你點的那一格。')) + '</p></div></section>';
        }
        var r = pick.r, K = pick.K, p = r.p, c = p.cells[K.k], items = c.items || [];
        h += '<div class="dcard-h df-h">' + ICO.doc + '<b><i class="sw" style="background:' + r.sw + '" aria-hidden="true"></i>' + esc(r.name) + ' · ' + K.l + '</b>'
            + '<span class="kn' + (K.ctx ? '' : ' wait') + '">' + num(c.n) + '</span><span class="df-src">' + K.src + '</span></div>'
            + '<p class="df-what">' + K.what.replace('{index}', esc(p.index || '')) + ' ' + K.fix + '</p>';
        if (!items.length) h += '<p class="df-none">' + loc('dk.noItems', 'docs-audit 只給這一項的數字，不列檔名。') + '</p>';
        else {
            h += '<ol class="df-list" aria-label="' + esc(r.name + ' ' + K.l) + '">' + items.map(function (it, i) {
                var pl = splitPath(it.path), n = noteOf(K.k, it);
                return '<li><button type="button" class="df-row" data-dk-item="' + i + '" aria-haspopup="dialog" title="'
                    + esc(pl.line ? loc('dk.readAt', '讀這份文件，停在第 {n} 行', { n: pl.line }) : loc('dk.read', '讀這份文件')) + '">'
                    + '<span class="df-path">' + esc(pl.file) + (pl.line ? '<em>:' + pl.line + '</em>' : '') + '</span>'
                    + (it.tag ? '<span class="df-tag">' + esc(tagOf(it.tag)) + '</span>' : '')
                    + (n ? '<span class="df-note">' + n + '</span>' : '') + subOf(it) + '</button></li>';
            }).join('') + '</ol>';
        }
        var shown = items.length, cmd = 'node scripts/' + (K.k === 'unfiled' ? 'docs-check' : K.src) + '.js --root ' + p.dir;
        var count = K.k === 'unfiled' ? loc('dk.unfiledCount', 'docs-audit 數到 <b>{n}</b> 份；上面是 docs-check 列出的 doc root 底下 <b>{s}</b> 份', { n: num(c.n), s: shown })
            : shown < c.n ? loc('dk.shown', '列出前 <b>{s}</b> 條，共 <b>{n}</b> 條', { s: shown, n: num(c.n) }) : loc('dk.all', '共 <b>{n}</b> 條', { n: num(c.n) });
        return h + '<p class="df-ft"><span>' + count + '</span><span>' + loc('dk.full', '完整清單：') + '<code>' + esc(cmd) + '</code></span></p></div></section>';
    }

    // ---- dialogs: made once under <body>, outside #page, so a redraw never replaces them ----
    function dialogEl(id, cls, block, label, inner) {
        if (!doc) return null;
        var d = doc.getElementById(id);
        if (!d) {
            d = doc.createElement('dialog');
            d.id = id;
            if (doc.body) doc.body.appendChild(d);
        }
        if (!d.open) {
            d.className = cls;
            if (d.setAttribute) { d.setAttribute('data-block', block); d.setAttribute('aria-labelledby', label); }
            d.innerHTML = inner;
        }
        return d;
    }
    function showModal(d) { if (d && !d.open && typeof d.showModal === 'function') d.showModal(); }
    function closeBtn(extra) {
        return '<button type="button" class="tdlg-x" data-dk-close="1" aria-label="' + loc('dk.close', '關閉') + '" title="' + loc('dk.close', '關閉') + '"' + (extra || '') + '>' + ICO.x + '</button>';
    }

    // ---- the reader: one document in focus, the cited line marked; arrow keys walk the list ----
    function inline(s) {
        return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<span class="rd-a" title="$2">$1</span>');
    }
    // Markdown to blocks; every block remembers its first line, and the block holding `mark` is marked.
    function render(text, mark) {
        var L = String(text == null ? '' : text).split(/\r?\n/), i = 0, out = [], fm = null, j, l, a, m, e, n, rows, body, items, ol, q, p;
        var cells = function (r) { return r.trim().replace(/^\||\|$/g, '').split('|').map(function (c) { return c.trim(); }); };
        if (L[0] === '---') { j = 1; while (j < L.length && L[j] !== '---') j++; fm = L.slice(1, j); i = j + 1; }
        function blk(tag, from, to, html, cls) {
            var hit = mark && mark >= from && mark <= to;
            out.push('<' + tag + ' data-l="' + from + '"' + (hit || cls ? ' class="' + (cls || '') + (hit ? ' hl' : '') + '"' : '') + '>' + html + '</' + tag + '>');
        }
        while (i < L.length) {
            l = L[i];
            a = i + 1;
            if (!l.trim()) { i++; continue; }
            if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
            if (/^\s*```/.test(l)) {
                e = i + 1;
                while (e < L.length && !/^\s*```/.test(L[e])) e++;
                if (/^\s*```\s*mermaid\b/i.test(l) && w && w.FK_DIAGRAM) {
                    var fig = w.FK_DIAGRAM.fence(L.slice(i + 1, e).join('\n'), a);
                    out.push(mark && mark >= a && mark <= e + 1 ? fig.replace('<figure class="dg"', '<figure class="dg hl"') : fig);
                } else blk('pre', a, e + 1, '<code>' + esc(L.slice(i + 1, e).join('\n')) + '</code>');
                i = e + 1;
                continue;
            }
            if ((m = /^(#{1,6})\s+(.*)$/.exec(l))) { n = Math.min(m[1].length + 1, 5); blk('h' + n, a, a, inline(m[2])); i++; continue; }
            if (/^\s*\|/.test(l)) {
                rows = [];
                while (i < L.length && /^\s*\|/.test(L[i])) { rows.push(L[i]); i++; }
                body = rows.filter(function (r) { return !/^\s*\|[\s:|-]+\|\s*$/.test(r); });
                blk('div', a, i, '<table><thead><tr>' + cells(body[0]).map(function (c) { return '<th>' + inline(c) + '</th>'; }).join('') + '</tr></thead><tbody>'
                    + body.slice(1).map(function (r) { return '<tr>' + cells(r).map(function (c) { return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>'; }).join('')
                    + '</tbody></table>', 'rd-tw');
                continue;
            }
            if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
                items = [];
                ol = /^\s*\d+\./.test(l);
                while (i < L.length && L[i].trim() && (/^\s*([-*]|\d+\.)\s+/.test(L[i]) || /^\s{2,}\S/.test(L[i]))) {
                    if (/^\s*([-*]|\d+\.)\s+/.test(L[i])) items.push({ a: i + 1, t: L[i].replace(/^\s*([-*]|\d+\.)\s+/, '') });
                    else items[items.length - 1].t += ' ' + L[i].trim();
                    i++;
                }
                out.push('<' + (ol ? 'ol' : 'ul') + '>' + items.map(function (it) {
                    return '<li data-l="' + it.a + '"' + (mark === it.a ? ' class="hl"' : '') + '>' + inline(it.t) + '</li>';
                }).join('') + '</' + (ol ? 'ol' : 'ul') + '>');
                continue;
            }
            if (/^>/.test(l)) {
                q = [];
                while (i < L.length && /^>/.test(L[i])) { q.push(L[i].replace(/^>\s?/, '')); i++; }
                blk('blockquote', a, i, inline(q.join(' ')));
                continue;
            }
            p = [];
            while (i < L.length && L[i].trim() && !/^\s*(```|#{1,6}\s|\||([-*]|\d+\.)\s|>)/.test(L[i])) { p.push(L[i]); i++; }
            blk('p', a, i, inline(p.join(' ')));
        }
        var meta = {};
        (fm || []).forEach(function (f) { var mm = /^(\w+):\s*(.*)$/.exec(f); if (mm) meta[mm[1]] = mm[2]; });
        return { html: out.join(''), meta: meta };
    }
    function readerShell() {
        return '<div class="tdlg-in"><div class="tdlg-hd"><span class="rd-proj" id="rd-proj"></span><span class="rd-t" id="rd-t"></span><span class="rd-nav">'
            + '<button type="button" class="tdlg-x" id="rd-prev" data-dk-step="-1" aria-label="' + loc('dk.prev', '上一份') + '" title="' + loc('dk.prevTip', '上一份（←）') + '">' + ICO.prev + '</button>'
            + '<span class="rd-pos" id="rd-pos"></span>'
            + '<button type="button" class="tdlg-x" id="rd-next" data-dk-step="1" aria-label="' + loc('dk.next', '下一份') + '" title="' + loc('dk.nextTip', '下一份（→）') + '">' + ICO.next + '</button>'
            + closeBtn(' style="margin-left:6px"') + '</span></div>'
            + '<div class="rd-why" id="rd-why"></div><div class="tdlg-p"><div class="rd-meta" id="rd-meta"></div><div class="rd-body" id="rd-body"></div></div>'
            + '<div class="tdlg-ft"><span><kbd>←</kbd> <kbd>→</kbd> ' + loc('dk.walk', '換一份') + '</span><span class="rd-path" id="rd-path"></span></div></div>';
    }
    function show(text, line) {
        var r = render(text, line), body = doc.getElementById('rd-body');
        doc.getElementById('rd-meta').innerHTML = ['status', 'last_verified'].filter(function (k) { return r.meta[k]; }).map(function (k) {
            return '<span class="rd-fm"><i>' + k + '</i>' + esc(r.meta[k]) + '</span>';
        }).join('');
        body.innerHTML = r.html || '<p class="rd-load">' + loc('dk.empty', '這份文件是空的。') + '</p>';
        if (w && w.FK_DIAGRAM) w.FK_DIAGRAM.draw(body);
        var hl = body.querySelector ? body.querySelector('.hl') : null;
        if (hl && hl.scrollIntoView) hl.scrollIntoView({ block: 'center' });
    }
    function openAt(i) {
        var it = st.list[i];
        if (!it || !doc) return;
        st.at = i;
        var d = dialogEl('dlg-read', 'tdlg rd', 'docs-reader', 'rd-t', readerShell());
        var g = function (id) { return doc.getElementById(id); }, pl = splitPath(it.path), n = ++st.readSeq;
        g('rd-proj').innerHTML = '<i class="sw" style="background:' + it.sw + '" aria-hidden="true"></i>' + esc(it.proj);
        g('rd-t').textContent = pl.file.split('/').pop();
        g('rd-pos').textContent = (i + 1) + ' / ' + st.list.length;
        g('rd-prev').disabled = i === 0;
        g('rd-next').disabled = i === st.list.length - 1;
        g('rd-why').innerHTML = it.why;
        g('rd-path').textContent = pl.file + (pl.line ? ':' + pl.line : '');
        g('rd-meta').innerHTML = '';
        g('rd-body').innerHTML = '<p class="rd-load">' + loc('dk.reading', '讀取中…') + '</p>';
        if (typeof fetch === 'function') {
            fetch('station/doc?pkey=' + encodeURIComponent(it.pkey) + '&path=' + encodeURIComponent(pl.file), { cache: 'no-store' }).then(function (r) {
                if (!r.ok) throw new Error(String(r.status));
                return r.text();
            }).then(function (text) {
                if (st.readSeq === n) show(text, pl.line);
            }, function () {
                if (st.readSeq === n) g('rd-body').innerHTML = '<p class="rd-load">' + loc('dk.unreadable', '讀不到這份文件。') + '</p>';
            });
        }
        showModal(d);
    }
    function fromCell(i) {
        var pick = selected();
        if (!pick) return;
        var r = pick.r, K = pick.K;
        st.list = (r.p.cells[K.k].items || []).map(function (it) {
            var n = noteOf(K.k, it);
            return { pkey: r.p.pkey, proj: r.name, sw: r.sw, path: it.path,
                why: '<b>' + K.l + '</b>' + (it.tag ? '<span>' + esc(tagOf(it.tag)) + '</span>' : '') + (n ? '<span>' + n + '</span>' : '') };
        });
        openAt(i);
    }
    function fromHits(i) {
        var q = st.res ? st.res.q : st.q;
        st.list = st.hits.map(function (x) {
            return { pkey: x.pkey, proj: x.project, sw: swOf(x.pkey), path: x.path,
                why: '<b>' + esc(loc('dk.hitWhy', '含「{q}」{n} 處', { q: q, n: x.count })) + '</b><span>' + esc(x.title || '') + '</span>' };
        });
        paintHits(null);
        openAt(i);
    }

    // ---- a project's map: the status split, what was planned and not built, where each kind is filed ----
    var STATUS = { current: 'var(--good)', planned: 'var(--p-0)', generated: 'var(--m-haiku)', undeclared: 'var(--stale)' };
    var HATCH = 'var(--hatch-bg) repeating-linear-gradient(45deg,var(--hatch) 0 1.3px,transparent 1.3px 4.5px)';
    function cardOf(pkey) {
        var out = null;
        ((st.S && st.S.projects) || []).forEach(function (r) { (r.docs || []).forEach(function (d) { if (d.pkey === pkey) out = d; }); });
        return out;
    }
    function projHtml(m) {
        if (!m) return '<p class="pd-none">' + loc('dk.noMap', '這個專案沒有 .fankeel/map.md；跑 <code>node scripts/map.js</code> 寫一份。') + '</p>';
        var b = m.buckets || [], planned = m.plannedNotBuilt || [], f = m.filing, tot = b.reduce(function (a, x) { return a + x.count; }, 0);
        var sw = function (l) { return 'background:' + (l === 'retired' ? HATCH : STATUS[l] || 'var(--muted)'); };
        var h = tot ? '<div class="split"><div class="split-h"><span>' + loc('dk.status', '狀態') + '</span><span class="num mono">' + loc('dk.mapCount', 'map 數到 {n} 份', { n: tot }) + '</span></div>'
            + '<div class="split-bar" role="img" aria-label="' + esc(b.map(function (x) { return x.label + ' ' + x.count; }).join(', ')) + '">'
            + b.map(function (x) { return '<i title="' + esc(x.label + ' ' + x.count) + '" style="flex:' + x.count + ' 1 0;' + sw(x.label) + '"></i>'; }).join('') + '</div>'
            + '<div class="split-leg">' + b.map(function (x) {
                return '<span><i class="sw" style="' + sw(x.label) + '"></i>' + esc(x.label) + ' <b>' + x.count + '</b><em>' + Math.round(x.count / tot * 100) + '%</em></span>';
            }).join('') + '</div></div>'
            : '<p class="pd-none">' + loc('dk.oldMap', '這份 map 是舊格式，沒有狀態統計；重跑 <code>node scripts/map.js</code> 會補上。') + '</p>';
        h += '<div class="pd-cols"><div><h3>' + loc('dk.planned', '還沒建') + ' <span>planned, not built · ' + planned.length + '</span></h3>'
            + (planned.length ? '<ul class="pd-list">' + planned.map(function (x) { return '<li title="' + esc(x) + '">' + esc(x) + '</li>'; }).join('') + '</ul>'
                : '<p class="pd-none">' + loc('dk.nothing', '沒有。') + '</p>') + '</div>'
            + '<div><h3>' + loc('dk.filing', '歸檔位置') + ' <span>' + (f ? 'index · ' + esc(f.index) : loc('dk.noTreeShort', '沒宣告文件樹')) + '</span></h3>'
            + (f && f.rows.length ? '<table class="pd-t"><tbody>' + f.rows.map(function (r) {
                return '<tr><td>' + esc(r.bucket) + '</td><td><span class="chip">' + esc(r.role) + '</span></td></tr>';
            }).join('') + '</tbody></table>' : '<p class="pd-none">' + loc('dk.allRef', '每份 markdown 都當 reference 檢查。') + '</p>') + '</div></div>';
        return h;
    }
    function openProject(i) {
        var r = projects()[i];
        if (!r || !doc) return;
        var m = cardOf(r.p.pkey);
        var inner = '<div class="tdlg-in"><div class="tdlg-hd"><span class="pd-name" id="pd-name"><i class="sw" style="background:' + r.sw + '" aria-hidden="true"></i>' + esc(r.name) + '</span>'
            + '<span class="pd-root">' + esc(r.p.dir) + '</span>' + closeBtn('') + '</div><div class="tdlg-p">' + projHtml(m) + '</div>'
            + '<div class="tdlg-ft"><span>' + loc('dk.mapAt', '<span class="mono">.fankeel/map.md</span> 生成於 <span class="mono">{t}</span>', { t: m ? when(m.generatedAt) : '—' }) + '</span></div></div>';
        showModal(dialogEl('dlg-proj', 'tdlg pd', 'docs-project', 'pd-name', inner));
    }

    // ---- the page and its listeners ----
    function page(S, o) {
        o = o || {};
        last = o;
        st.S = S;
        bind();
        var t = Date.now();
        if (o.serve && !st.loading && ((!st.data && !st.err) || t - st.drawnAt > VISIT_MS)) load(false);
        st.drawnAt = t;
        var pick = st.data ? selected() : null;
        return '<div class="dk" data-block="docs-page">' + headHtml()
            + '<div class="dash kdash dk-grid" data-block="docs-columns">'
            + '<div class="dcol" data-col="main" data-block="docs-main">' + healthHtml(o) + '</div>'
            + '<div class="dcol" data-col="side" data-block="docs-side">' + findingsHtml(pick) + '</div></div></div>';
    }
    function attr(t, sel, name) { var a = t.closest(sel); return a ? a.getAttribute(name) : null; }
    function onClick(e) {
        var t = e && e.target, v, a;
        if (!t || typeof t.closest !== 'function') return;
        if ((v = attr(t, '[data-dk-cell]', 'data-dk-cell')) !== null) {
            var s = v.split(' '), r = projects()[Number(s[0])];
            if (r) {
                st.sel = { pkey: r.p.pkey, k: s[1] };
                redraw();
                a = doc && doc.querySelector ? doc.querySelector('.dh-n.on') : null;
                if (a && a.focus) a.focus({ preventScroll: true });
            }
            return;
        }
        if ((v = attr(t, '[data-dk-item]', 'data-dk-item')) !== null) { fromCell(Number(v)); return; }
        if ((v = attr(t, '[data-dk-hit]', 'data-dk-hit')) !== null) { fromHits(Number(v)); return; }
        if ((v = attr(t, '[data-dk-proj]', 'data-dk-proj')) !== null) { openProject(Number(v)); return; }
        if ((a = t.closest('[data-dk-step]'))) { if (!a.disabled) openAt(st.at + Number(a.getAttribute('data-dk-step'))); return; }
        if ((a = t.closest('[data-dk-close]'))) { a = a.closest('dialog'); if (a && a.close) a.close(); return; }
        if (t.closest('[data-dk-run]')) { if (!st.loading) { load(true); redraw(); } return; }
        if (!t.closest('.dq')) paintHits(null);
    }
    function onInput(e) {
        var t = e && e.target;
        if (!t || t.id !== 'dq') return;
        var q = String(t.value || '').trim(), n = ++st.seq;
        st.q = q;
        if (st.timer && w && typeof w.clearTimeout === 'function') w.clearTimeout(st.timer);
        if (!q) { st.hits = []; st.res = null; paintHits(null); return; }
        var go = function () { ask(q, n); };
        if (w && typeof w.setTimeout === 'function') st.timer = w.setTimeout(go, 200);
        else go();
    }
    function onFocus(e) {
        var t = e && e.target;
        if (t && t.id === 'dq' && st.q && st.res) paintHits(st.res);
    }
    function onKey(e) {
        var t = e && e.target, rd = doc && doc.getElementById('dlg-read'), q;
        if (rd && rd.open && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
            var j = st.at + (e.key === 'ArrowLeft' ? -1 : 1);
            if (j >= 0 && j < st.list.length) { e.preventDefault(); openAt(j); }
            return;
        }
        q = doc && doc.getElementById('dq');
        if (!q) return;
        if (e.key === 'Escape') { paintHits(null); return; }
        if (e.key !== '/') return;
        if (t && t.closest && t.closest('input,textarea,select')) return;
        if (doc.querySelector && doc.querySelector('dialog[open]')) return;
        e.preventDefault();
        if (q.focus) q.focus();
    }
    function bind() {
        if (bound || !doc || typeof doc.addEventListener !== 'function') return;
        bound = true;
        doc.addEventListener('click', onClick);
        doc.addEventListener('input', onInput);
        doc.addEventListener('keydown', onKey);
        doc.addEventListener('focusin', onFocus);
    }
    function state() { return st; }
    function reset() { st = blank(); last = null; }

    var api = { page: page, render: render, onClick: onClick, onInput: onInput, onKey: onKey, state: state, reset: reset, EN: EN };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_DOCS = api;
}(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null));
