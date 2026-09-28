// assets/station/tour-doc.js — what every cut of the promo is made of: the
// string table, one `{ zh, en }` pair per string the frames print, and the
// document page the storyboard draws each cut as
// (.fankeel/build/2026-09-28-tour-blocks/mockup.html): a panel with a file-name
// tab, an optional stage header, and blocks that rise into it one beat at a
// time, the page scrolling up when a new block would fall below the window.
// Every size and colour is the storyboard's, which are station.css's. The
// language is P.lang (tour.js palette); a string is `t(P, key)`.
(function (root, module) {
    'use strict';
    var E = root.tourEngine || require('./tour.js');

    // Every string the video prints, in both languages. Paths, commands and
    // stage names are the same in both and are not here; the English is the
    // storyboard's `?lang=en`.
    var S = {
        'cap.hook': { zh: '功能一層疊一層，文件一份接一份。', en: 'Features pile up. So do the docs.' },
        'cap.route': { zh: 'fankeel 替每個任務排一條工作流。', en: 'fankeel gives every task its own workflow.' },
        'cap.plan': { zh: '自動拆成任務，看出誰能一起做。', en: 'Split into tasks, and see which can run together.' },
        'cap.build': { zh: '能平行的一起跑，該排隊的排隊。', en: 'Parallel where it can, queued where it must.' },
        'cap.clash': { zh: '兩個 session 動到同一個檔，當下就標出來。', en: 'Two sessions touch one file, and it is flagged on the spot.' },
        'pr.survey': { zh: '產出：已經有什麼', en: 'Produces: a statement of what already exists' },
        'pr.design': { zh: '產出：一個有人同意的做法', en: 'Produces: an approach someone agreed to' },
        'pr.plan': { zh: '產出：沒上下文也能照做的拆解', en: 'Produces: steps a newcomer could execute' },
        'pr.build': { zh: '產出：改動本身', en: 'Produces: the change itself' },
        'pr.verify': { zh: '產出：證據，不是信心', en: 'Produces: evidence, not confidence' },
        'pr.audit': { zh: '產出：哪些已經不成立', en: 'Produces: a list of what is no longer true' },
        'pr.land': { zh: '產出：倉庫不比接手時亂', en: 'Produces: a repository no dirtier than you found it' },
        'task': { zh: '多倉庫庫存與調撥', en: 'Multi-warehouse transfers' },
        'task2': { zh: '庫存報表加 CSV 匯出', en: 'Stock report CSV export' },
        'tab.station': { zh: '監控站 · ', en: 'Station · ' },
        'stale': { zh: '已過時', en: 'Stale' },
        'hook.title': { zh: '庫存模組', en: 'Inventory' },
        'hook.getStock': { zh: '單倉庫存，回傳目前數量', en: 'Current quantity, single warehouse' },
        'hook.csv': { zh: '庫存報表可以匯出 CSV', en: 'Stock report exports to CSV' },
        'hook.sched': { zh: '匯出排程：見 ', en: 'Export schedule: see ' },
        'hook.retry': { zh: '匯出失敗時自動重試三次', en: 'Failed exports retry three times' },
        'hook.field': { zh: '報表欄位', en: 'Report field' },
        'hook.source': { zh: '從哪裡來', en: 'Source' },
        'hook.product': { zh: '商品', en: 'Product' },
        'hook.qty': { zh: '數量', en: 'Quantity' },
        'route.n': { zh: ' · 7 站', en: ' · 7 stages' },
        'survey.h': { zh: '已經有什麼', en: 'What already exists' },
        'survey.wh': { zh: '倉庫資料表，目前只有一個預設倉', en: 'Warehouse table, only the default one so far' },
        'survey.tr': { zh: '調撥的空殼，還沒接上路由', en: 'Transfer stub, not routed yet' },
        'survey.doc': { zh: '庫存說明，寫的是單倉', en: 'Inventory docs, still single-warehouse' },
        'survey.class': { zh: '　動庫存和調撥兩塊，訂單流程不動', en: ' Touches stock and transfers, not orders' },
        'design.p': { zh: '庫存改用（商品, 倉庫）當鍵；一張調撥單寫成兩筆方向相反的異動。', en: 'Key stock by (product, warehouse); a transfer writes two opposite movements.' },
        'design.file': { zh: '檔案', en: 'File' },
        'design.change': { zh: '改動', en: 'Change' },
        'design.wh': { zh: '加 warehouseId，舊呼叫帶預設倉', en: 'Add warehouseId; old calls get the default' },
        'design.tr': { zh: '新增：建立、確認調撥', en: 'New: create and confirm transfers' },
        'design.doc': { zh: '改寫成多倉', en: 'Rewrite for multi-warehouse' },
        'design.gate': { zh: '等你核准', en: 'Awaiting approval' },
        'design.q': { zh: '照這個做法做？', en: 'Go with this approach?' },
        'design.yes': { zh: '✓ 核准', en: '✓ Approve' },
        'design.no': { zh: '改做法', en: 'Revise' },
        'design.ok': { zh: '已核准', en: 'Approved' },
        'par': { zh: '同時', en: 'In parallel' },
        'par.why': { zh: 'Files 不重疊', en: 'Files don\'t overlap' },
        'plan.a': { zh: '倉庫維度', en: 'Warehouse key' },
        'plan.b': { zh: '調撥 API', en: 'Transfer API' },
        'plan.c': { zh: '調撥畫面', en: 'Transfer screen' },
        'waits': { zh: '等 A', en: 'waits on A' },
        'build.run': { zh: 'implementer 執行中', en: 'implementer running' },
        'build.review': { zh: 'reviewer 審查中', en: 'reviewer reviewing' },
        'build.done': { zh: 'implementer、reviewer 完成', en: 'implementer, reviewer done' },
        'build.queued': { zh: '排隊中', en: 'queued' },
        'verify.must': { zh: '要成立的', en: 'Must hold' },
        'verify.ev': { zh: '證據', en: 'Evidence' },
        'verify.r1': { zh: '調撥後兩倉加總不變', en: 'Transfers keep the total' },
        'verify.pass': { zh: ' 通過', en: ' passes' },
        'verify.r2': { zh: '單倉的舊呼叫照常', en: 'Old calls still work' },
        'verify.fail': { zh: ' 舊案例失敗：沒帶預設倉', en: ' old case fails: no default warehouse' },
        'verify.fixed': { zh: ' 補上預設倉後通過', en: ' passes with the default added' },
        'verify.r3': { zh: ' 寫的是多倉', en: ' describes multi-warehouse' },
        'verify.clean': { zh: ' 沒有錯', en: ' finds no errors' },
        'audit.rewritten': { zh: 'build 剛改寫', en: 'just rewritten by build' },
        'audit.stale': { zh: '過時', en: 'Stale' },
        'audit.stock': { zh: '還在寫 getStock(sku)', en: 'still says getStock(sku)' },
        'audit.stockTodo': { zh: '還在寫 getStock(sku)，進 TODO', en: 'still says getStock(sku), added to TODO' },
        'audit.landed': { zh: '計畫已經落地', en: 'plan has landed' },
        'audit.archived': { zh: '已歸檔', en: 'archived' },
        'land.stock': { zh: '改寫成多倉', en: 'needs a multi-warehouse rewrite' },
        'land.print': { zh: '列印格式', en: 'Print format' },
        'land.on': { zh: '倉庫給調撥單的列印格式.', en: 'the warehouse\'s print format for transfer slips.' },
        'land.slip': { zh: '調撥單列印', en: 'Print transfer slips' },
        'land.clean': { zh: '工作樹乾淨', en: 'Working tree clean' },
        'clash.running': { zh: '執行中', en: 'Running' },
        'clash.editing': { zh: '正在改', en: 'Editing' },
        'clash.same': { zh: '同一個檔', en: 'same file' },
        'outro.install': { zh: '安裝', en: 'Install' },
        'outro.two': { zh: '兩行指令，裝進 Claude Code。', en: 'Two commands, and it is in Claude Code.' },
        'outro.tag': { zh: '跟 AI 開發得再久，也不堆過時的引用和死程式。', en: 'Build with AI as long as you like — without piling up stale references and dead code.' },
    };
    function t(P, key) {
        if (!Object.prototype.hasOwnProperty.call(S, key)) throw new Error('tour: no string ' + key);
        return S[key][P.lang === 'en' ? 'en' : 'zh'];
    }

    // The storyboard's .win: 48 in from each side; the page's padding puts
    // the content at x 70, 500 wide.
    var X = 48, W = 544, CX = 70, CW = 500;
    var RISE = 18, SCROLL = 20;
    // A block rising in: 0 before `at`, 1 once it has settled (expo-out 18).
    function rise(l, at) { return E.expoOut(E.prog(l, at, RISE)); }
    // Draw `fn` risen by k: faded in and moved up the last 10 units.
    function risen(ctx, k, fn) {
        E.fade(ctx, k, function () {
            ctx.save();
            ctx.translate(0, 10 * (1 - k));
            fn();
            ctx.restore();
        });
    }

    function runsWidth(ctx, P, runs) {
        return runs.reduce(function (w, r) {
            ctx.font = E.font(P, r[0]);
            return w + ctx.measureText(r[1]).width;
        }, 0);
    }

    // A station pill (.pill, .pill.stale / .gate / .ok / .live): 20 high,
    // rounded, 9 either side of its text. `x` is its left edge, or its right
    // edge with o.right. Returns its width.
    var PILL = {
        stale: ['staleBg', 'stale'], gate: ['staleBg', 'staleInk'], ok: ['upBg', 'good'], live: ['liveBg', 'live'],
    };
    function pill(ctx, P, s, x, cy, kind, o) {
        o = o || {};
        var c = PILL[kind], dot = kind === 'live' ? 12 : 0;
        ctx.font = E.font(P, 'pill');
        var w = Math.min(o.maxW || 220, ctx.measureText(s).width) + 18 + dot;
        var x0 = o.right ? x - w : x;
        E.box(ctx, x0, cy - 10, w, 20, 10, P[c[0]]);
        if (dot) E.circle(ctx, x0 + 12, cy, 3.5, P[c[1]]);
        E.fitText(ctx, P, 'pill', s, x0 + 9 + dot, cy, (o.maxW || 220), { middle: true, lines: 1, fill: P[c[1]] });
        return w;
    }

    // The route as dots (.route): filled up to `at`, `at` itself filled and
    // ringed, hollow after. `n` stops (seven unless given), `d` across each.
    function dots(ctx, P, x, cy, at, n, d) {
        n = n || E.ROUTE.length;
        d = d || 8;
        var r = d / 2, cx = x + r;
        for (var j = 0; j < n; j++) {
            var c = P.st[E.ROUTE[j]];
            if (j === at) {
                cx += 3;
                E.circle(ctx, cx, cy, r, c);
                E.circle(ctx, cx, cy, r + 3, null, c, 1.5);
                cx += 3;
            } else if (j < at) E.circle(ctx, cx, cy, r, c);
            else E.circle(ctx, cx, cy, r - 0.75, null, P.rule2, 1.5);
            cx += d + 3;
        }
    }
    function dotsWidth(n, d, ringed) { return n * d + (n - 1) * 3 + (ringed ? 6 : 0); }

    // The session page's rail (.rail): seven columns across `w`, a 14-unit
    // dot over each stage's name, a solid link behind a lit stop and a dashed
    // one after. `lit` stops are lit; with `now`, that one is ringed.
    function rail(ctx, P, x, y, w, lit, now) {
        var col = w / E.ROUTE.length;
        E.ROUTE.forEach(function (s, j) {
            var cx = x + col * (j + 0.5), cy = y + 11, c = P.st[s];
            if (j < E.ROUTE.length - 1) {
                var solid = j < lit - 1 || (j < lit && now !== j);
                E.line(ctx, [[cx + 12, cy], [cx + col - 12, cy]], solid ? P.ink2 : P.rule2, 2, solid ? null : [5, 5]);
            }
            if (j === now) {
                E.circle(ctx, cx, cy, 11, c);
                E.circle(ctx, cx, cy, 7, P.panel);
                E.circle(ctx, cx, cy, 5.5, c);
            } else if (j < lit) E.circle(ctx, cx, cy, 7, c);
            else E.circle(ctx, cx, cy, 6.25, null, P.rule2, 1.5);
            E.text(ctx, P, 'nm', s, cx, cy + 27, { align: 'center', fill: j < lit ? P.ink2 : P.muted, weight: j === now ? '700' : null });
        });
    }

    // One list row (.bk-li): a rule on top, 33 high, runs centred in it.
    function li(ctx, P, x, y, w, runs) {
        E.line(ctx, [[x, y + 0.5], [x + w, y + 0.5]], P.rule, 1);
        E.fitRuns(ctx, P, runs, x, y + 17, w);
    }
    // A heading with its markdown marks (.bk-h2 / .bk-h3): `##` in mono,
    // muted, then the text.
    function heading(ctx, P, cls, marks, s, x, cy, w) {
        E.fitRuns(ctx, P, [['cm', marks + ' '], [cls, s]], x, cy, w);
    }
    // A callout (.bk-co): the inset panel with a 3-unit bar on its left in
    // `bar`'s colour, drawn to `p` of its height (the survey cut draws the bar
    // first), runs centred in it.
    function callout(ctx, P, x, y, w, h, bar, runs, p) {
        var k = p === undefined ? 1 : p;
        E.box(ctx, x, y, w, h, 6, P.inset);
        E.box(ctx, x, y, 3, h * Math.min(1, k * 2), 1.5, bar);
        if (k > 0.5) E.fade(ctx, (k - 0.5) * 2, function () { E.fitRuns(ctx, P, runs, x + 12, y + h / 2, w - 24); });
    }
    // The caption under a page (.cap): 21 semibold, centred, faded in from `at`.
    function cap(ctx, P, key, l, at) {
        E.fade(ctx, E.expoOut(E.prog(l, at || 0, 12)), function () {
            E.fitText(ctx, P, 'cap', t(P, key), 320, 333, 560, { align: 'center', lines: 1 });
        });
    }

    // The stage header (.pg-h): the stage name in its colour, what it
    // produces (two lines at most, when the longest English one needs them),
    // and the route dots with this stage ringed; a rule under it. 50 high.
    function head(ctx, P, i, y) {
        var s = E.ROUTE[i], cy = y + 14;
        ctx.font = E.font(P, 'ph');
        var nw = ctx.measureText(s).width;
        E.fitText(ctx, P, 'ph', s, CX, cy, 200, { middle: true, lines: 1, fill: P.st[s] });
        var dw = dotsWidth(7, 10, true);
        E.fitText(ctx, P, 'pd', t(P, 'pr.' + s), CX + nw + 12, cy, CW - nw - 12 - dw - 12, { middle: true, lines: 2, leading: 1.1 });
        dots(ctx, P, CX + CW - dw, cy, i, 7, 10);
        E.line(ctx, [[CX, y + 38.5], [CX + CW, y + 38.5]], P.rule, 1);
    }

    // The page. spec: tab — runs for the tab label; head — a stage index, or
    // none; top, bottom — the window (14 and 360 unless given; 294 with a
    // caption under it); tall — the panel runs to the frame's foot even when
    // the blocks do not; blocks — [{ at, h, draw(ctx, P, x, y, w, l) }] top to
    // bottom from under the header; cap — a caption key, in from frame 0.
    // The whole page rises at 0; each block at its own `at`; once a settled
    // block's foot would pass the window's, the page scrolls up by the
    // difference (expo-out 20 from that block's `at`).
    function page(ctx, P, l, spec) {
        var top = spec.top === undefined ? 14 : spec.top, bottom = spec.bottom || 360;
        var y0 = top + 26, y = y0 + 14 + (spec.head === undefined ? 0 : 50), ys = [], scroll = 0;
        spec.blocks.forEach(function (b) {
            ys.push(y);
            y += b.h;
            var need = y + 16 - bottom;
            if (need > 0) scroll = Math.max(scroll, need * E.expoOut(E.prog(l, b.at, SCROLL)));
        });
        var foot = Math.max(y + 16, spec.tall ? 360 + scroll : 0);
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, top, 640, bottom - top);
        ctx.clip();
        ctx.translate(0, -scroll);
        risen(ctx, rise(l, 0), function () {
            var tw = Math.min(W, runsWidth(ctx, P, spec.tab) + 24);
            E.box(ctx, X, y0 - 24, tw, 30, 6, P.panel);
            E.fitRuns(ctx, P, spec.tab, X + 12, y0 - 12, W - 24);
            E.box(ctx, X, y0, W, foot - y0, 10, P.panel);
            if (spec.head !== undefined) head(ctx, P, spec.head, y0 + 14);
        });
        spec.blocks.forEach(function (b, i) {
            var k = rise(l, b.at);
            if (k > 0) risen(ctx, k, function () { b.draw(ctx, P, CX, ys[i], CW, l); });
        });
        ctx.restore();
        if (spec.cap) cap(ctx, P, spec.cap, l, 0);
    }

    module.exports = {
        S: S, t: t, CX: CX, CW: CW, rise: rise, risen: risen, runsWidth: runsWidth,
        pill: pill, dots: dots, rail: rail, li: li, heading: heading, callout: callout, cap: cap, page: page,
    };
    if (typeof window !== 'undefined') root.tourDoc = module.exports;
})(typeof window !== 'undefined' ? window : globalThis, typeof module !== 'undefined' ? module : {});
