// assets/station/tour-closing.js — the promo's last five cuts, frames
// 1920–3599: verify, audit, land, clash and the outro, each a document page
// from tour-doc.js. Every cut is a pure function of its own local frame `l`;
// a block rises on a beat (30 frames), and `beats` lists those frames for the
// score's plucks. The storyboard is
// .fankeel/build/2026-09-28-tour-blocks/mockup.html, blocks cut-verify …
// cut-outro; the frame numbers in the comments are its.
(function (root, module) {
    'use strict';
    var E = root.tourEngine || require('./tour.js');
    var D = root.tourDoc || require('./tour-doc.js');
    var t = D.t;
    var PROJECT = 'inventory-admin';

    // verify (f 1920–2279): the evidence table, its head then a row a beat.
    // At 180 row two turns red, ✓ becomes ✕, its evidence becomes the
    // failure and the row shakes (±3, 6 frames); at 270 it is fixed and
    // turns back.
    var ROW_H = 44;
    function verify(ctx, P, l) {
        var bad = l >= 180 && l < 270;
        var rows = [
            [[['li', t(P, 'verify.r1'), P.ink]], [['code', 'transfer.test.ts'], ['li', t(P, 'verify.pass')]], false],
            [[['li', t(P, 'verify.r2'), P.ink]], [['code', 'warehouse.test.ts'], ['li', t(P, l >= 270 ? 'verify.fixed' : l >= 180 ? 'verify.fail' : 'verify.pass')]], bad],
            [[['code', 'docs/inventory.md'], ['li', t(P, 'verify.r3'), P.ink]], [['code', 'docs-check'], ['li', t(P, 'verify.clean')]], false],
        ];
        var blocks = [{ at: 30, h: 24, draw: function (ctx, P, x, y) {
            E.fitText(ctx, P, 'note', t(P, 'verify.must'), x, y + 10, 220, { middle: true, lines: 1 });
            E.fitText(ctx, P, 'note', t(P, 'verify.ev'), x + 230, y + 10, 240, { middle: true, lines: 1 });
        } }];
        rows.forEach(function (r, i) {
            blocks.push({ at: 60 + 30 * i, h: ROW_H, draw: function (ctx, P, x, y, w) {
                var dx = r[2] ? 3 * Math.sin(E.prog(l, 180, 6) * Math.PI * 3) : 0;
                ctx.save();
                ctx.translate(dx, 0);
                if (r[2]) E.fade(ctx, E.prog(l, 180, 8), function () { E.box(ctx, x, y, w, ROW_H, 0, P.dnBg); });
                E.line(ctx, [[x, y + 0.5], [x + w, y + 0.5]], P.rule, 1);
                var tint = function (runs) { return r[2] ? runs.map(function (u) { return [u[0], u[1], P.bad]; }) : runs; };
                E.fitRuns(ctx, P, tint(r[0]), x, y + ROW_H / 2, 220);
                E.fitRuns(ctx, P, tint(r[1]), x + 230, y + ROW_H / 2, 240);
                E.fitText(ctx, P, 'ui', r[2] ? '✕' : '✓', x + w - 13, y + ROW_H / 2, 20, { middle: true, lines: 1, align: 'center', weight: '700', fill: r[2] ? P.bad : P.good });
                ctx.restore();
            } });
        });
        D.page(ctx, P, l, { tab: [['cm', '.fankeel/build/multi-warehouse/'], ['tab', 'verify.md']], head: 4, tall: true, blocks: blocks });
    }

    // audit (f 2280–2639): the docs tree a row a beat, children one step in.
    // At 180 stock.md and export-plan-v2.md are marked 過時 with why; at 270
    // export-plan-v2.md slides under archive/ and one step further in
    // (expo-out 24), its pill fading into 已歸檔, and archive/ moves up.
    var DROW = 38;
    function audit(ctx, P, l) {
        var mv = E.expoOut(E.prog(l, 270, 24)), marked = l >= 180;
        var rows = [
            { at: 30, code: 'docs/', slot: 0, ind: 0 },
            { at: 60, code: 'inventory.md', slot: 1, ind: 1, note: 'audit.rewritten' },
            { at: 90, code: 'stock.md', slot: 2, ind: 1, stale: true, note: mv >= 1 ? 'audit.stockTodo' : 'audit.stock' },
            { at: 120, code: 'export-plan-v2.md', slot: E.lerp(3, 4, mv), ind: E.lerp(1, 2, mv), stale: mv < 1, note: mv >= 1 ? 'audit.archived' : 'audit.landed', fade: 1 - mv },
            { at: 150, code: 'archive/', slot: E.lerp(4, 3, mv), ind: 1 },
        ];
        D.page(ctx, P, l, {
            tab: [['cm', PROJECT + '/'], ['tab', 'docs']], head: 5, tall: true,
            blocks: [{ at: 30, h: DROW * 5, draw: function (ctx, P, x, y, w, l) {
                rows.forEach(function (r) {
                    D.risen(ctx, D.rise(l, r.at), function () {
                        var ry = y + DROW * r.slot, rx = x + 6 + 22 * r.ind, cy = ry + DROW / 2;
                        ctx.font = E.font(P, 'code', { size: 15 });
                        var nx = rx + Math.min(200, ctx.measureText(r.code).width) + 10;
                        E.fitText(ctx, P, 'code', r.code, rx, cy, 200, { middle: true, lines: 1, size: 15 });
                        var pk = r.stale && marked ? (r.fade === undefined ? 1 : r.fade) : 0;
                        if (pk > 0) E.fade(ctx, pk, function () { nx += pk * (D.pill(ctx, P, t(P, 'audit.stale'), nx, cy, 'stale', { maxW: 80 }) + 8); });
                        if (r.note && (!r.stale || marked)) E.fitText(ctx, P, 'note', t(P, r.note), nx, cy, x + w - nx, { middle: true, lines: 1, size: 13.5 });
                    });
                });
            } }],
        });
    }

    // land (f 2640–2999): TODO.md. `## Ready` and its entries a beat each,
    // `## Blocked` and its print-format entry; at 210 the task's own entry is
    // struck left to right (10 frames); at 270 the working-tree callout, its
    // ✓ popping in last (back-out 8).
    function todo(ctx, P, x, y, w, stage, runs, strike) {
        var k = strike || 0;
        var all = [['cm', '- '], ['li', '〔' + stage + '〕', P.muted]].concat(runs.map(function (r) { return k >= 1 ? [r[0], r[1], P.faint] : r; }));
        E.fitRuns(ctx, P, all, x + 4, y + 15, w - 4);
        if (k > 0) {
            var end = x + 4 + Math.min(w - 4, D.runsWidth(ctx, P, all));
            E.line(ctx, [[x + 4, y + 15], [E.lerp(x + 4, end, k), y + 15]], P.faint, 1.2);
        }
    }
    function land(ctx, P, l) {
        D.page(ctx, P, l, {
            tab: [['tab', 'TODO.md']], head: 6, tall: true,
            blocks: [
                { at: 30, h: 32, draw: function (ctx, P, x, y, w) { D.heading(ctx, P, 'h2', '##', 'Ready', x, y + 12, w); } },
                { at: 60, h: 30, draw: function (ctx, P, x, y, w, l) { todo(ctx, P, x, y, w, 'build', [['li', t(P, 'task'), P.ink]], E.prog(l, 210, 10)); } },
                { at: 90, h: 30, draw: function (ctx, P, x, y, w) { todo(ctx, P, x, y, w, 'audit', [['code', 'docs/stock.md '], ['li', t(P, 'land.stock'), P.ink]]); } },
                { at: 120, h: 42, draw: function (ctx, P, x, y, w) { D.heading(ctx, P, 'h2', '##', 'Blocked', x, y + 22, w); } },
                { at: 150, h: 76, draw: function (ctx, P, x, y, w) {
                    D.heading(ctx, P, 'h3', '###', t(P, 'land.print'), x, y + 10, w);
                    E.fitRuns(ctx, P, [['cm', 'on: '], ['note', t(P, 'land.on')]], x, y + 32, w);
                    todo(ctx, P, x, y + 44, w, 'plan', [['li', t(P, 'land.slip'), P.ink]]);
                } },
                { at: 270, h: 56, draw: function (ctx, P, x, y, w, l) {
                    var ok = E.backOut(E.prog(l, 282, 8));
                    D.callout(ctx, P, x, y + 10, w, 40, P.good, [['ui', t(P, 'land.clean') + ' '], ['ui', ok > 0 ? '✓' : ' ', P.good], ['cm', '  nothing to commit, working tree clean']]);
                } },
            ],
        });
    }

    // clash (f 3000–3239): two session cards a beat apart; at 60 both grow
    // their 正在改 line; at 120 — on the bar line — both file names turn
    // amber and CLASH pops under them (back-out 10); at 150 the caption.
    function session(ctx, P, x, y, w, n, key, step, of, l) {
        E.box(ctx, x, y, w, 120, 10, P.inset);
        E.fitText(ctx, P, 'cm', 'session ' + n, x + 14, y + 18, 100, { middle: true, lines: 1 });
        D.pill(ctx, P, t(P, 'clash.running'), x + w - 14, y + 18, 'live', { right: true, maxW: 90 });
        E.fitText(ctx, P, 'ui', t(P, key), x + 14, y + 42, w - 28, { middle: true, lines: 1, size: 17 });
        D.dots(ctx, P, x + 14, y + 64, step, of, 8);
        E.fitRuns(ctx, P, [['m', 'build ', P.ink], ['cm', (step + 1) + '/' + of]], x + 14 + of * 11 + 14, y + 64, w - 40 - of * 11);
        var e = D.rise(l, 60);
        if (e <= 0) return;
        E.fade(ctx, e, function () {
            E.line(ctx, [[x + 14, y + 78.5], [x + w - 14, y + 78.5]], P.rule, 1);
            E.fitText(ctx, P, 'note', t(P, 'clash.editing'), x + 14, y + 90, w - 28, { middle: true, lines: 1 });
            var hot = l >= 120;
            if (hot) E.box(ctx, x + 12, y + 99, 196, 18, 3, P.staleBg);
            E.fitText(ctx, P, 'code', 'src/stock/warehouse.ts', x + 16, y + 108, 190, { middle: true, lines: 1, size: 14, fill: hot ? P.staleInk : P.ink });
        });
    }
    function clash(ctx, P, l) {
        var half = (D.CW - 14) / 2;
        D.page(ctx, P, l, {
            tab: [['note', t(P, 'tab.station'), P.muted], ['tab', PROJECT]], bottom: 294,
            blocks: [{ at: 0, h: 176, draw: function (ctx, P, x, y, w, l) {
                session(ctx, P, x, y, half, 1, 'task', 3, 7, l);
                D.risen(ctx, D.rise(l, 30), function () { session(ctx, P, x + half + 14, y, half, 2, 'task2', 2, 5, l); });
                var k = E.backOut(E.prog(l, 120, 10));
                if (k > 0) E.fade(ctx, Math.min(1, k), function () {
                    ctx.save();
                    ctx.translate(320, y + 148);
                    ctx.scale(k, k);
                    ctx.translate(-320, -(y + 148));
                    ctx.font = E.font(P, 'pill', { size: 14 });
                    var s = 'CLASH · ' + t(P, 'clash.same'), pw = ctx.measureText(s).width + 28;
                    E.box(ctx, 320 - pw / 2, y + 136, pw, 26, 13, P.staleBg);
                    E.fitText(ctx, P, 'pill', s, 320, y + 149, 240, { middle: true, lines: 1, size: 14, align: 'center', fill: P.stale });
                    ctx.restore();
                });
            } }],
        });
        if (l >= 150) D.cap(ctx, P, 'cap.clash', l, 150);
    }

    // outro (f 3240–3599): fankeel and an empty command box; each install
    // line typed at two characters a frame from its beat, the cursor resting
    // at its end; 兩行指令 at 90; the tagline at 120, on bar 29; the whole
    // route lit at once at 180, held to the last frame.
    var CMDS = ['claude plugin marketplace add FanFantom9452/FanKeel', 'claude plugin install fankeel@fankeel'];
    function outro(ctx, P, l) {
        D.page(ctx, P, l, {
            tab: [['note', t(P, 'outro.install'), P.ink]], top: 26,
            blocks: [
                { at: 0, h: 46, draw: function (ctx, P, x, y, w) { E.fitText(ctx, P, 'h1', 'fankeel', 320, y + 18, w, { middle: true, lines: 1, size: 30, align: 'center' }); } },
                { at: 0, h: 70, draw: function (ctx, P, x, y, w, l) {
                    E.box(ctx, x, y, w, 62, 6, P.inset);
                    CMDS.forEach(function (c, i) {
                        var n = Math.min(c.length, Math.floor(Math.max(0, l - 30 * (i + 1)) * 2));
                        if (n <= 0) return;
                        var s = c.slice(0, n), cy = y + 18 + 27 * i;
                        E.fitText(ctx, P, 'cm', '$', x + 16, cy, 12, { middle: true, lines: 1 });
                        var r = E.fitText(ctx, P, 'code', s, x + 32, cy, w - 48, { middle: true, lines: 1 });
                        if (n < c.length || i === 1) {
                            ctx.font = E.font(P, 'code', { size: r.size });
                            E.box(ctx, x + 34 + ctx.measureText(s).width, cy - 8, 7, 16, 0, P.ink2);
                        }
                    });
                } },
                { at: 90, h: 24, draw: function (ctx, P, x, y, w) { E.fitText(ctx, P, 'note', t(P, 'outro.two'), 320, y + 10, w, { middle: true, lines: 1, align: 'center' }); } },
                { at: 120, h: 58, draw: function (ctx, P, x, y, w) { E.fitText(ctx, P, 'tag', t(P, 'outro.tag'), 320, y + 22, w, { lines: 2, leading: 1.1, align: 'center' }); } },
                { at: 180, h: 52, draw: function (ctx, P, x, y, w) { D.rail(ctx, P, x, y + 4, w, 7, -1); } },
            ],
        });
    }

    var CUTS = [
        { name: 'verify', len: 360, beats: [0, 30, 60, 90, 120], draw: verify },
        { name: 'audit', len: 360, beats: [0, 30, 60, 90, 120, 150], draw: audit },
        { name: 'land', len: 360, beats: [0, 30, 60, 90, 120, 150, 270], draw: land },
        { name: 'clash', len: 240, beats: [0, 30, 60], draw: clash },
        { name: 'outro', len: 360, beats: [0, 30, 60, 90, 120, 180], draw: outro },
    ];

    module.exports = { CUTS: CUTS };
    if (typeof window !== 'undefined') root.tourClosing = module.exports;
})(typeof window !== 'undefined' ? window : globalThis, typeof module !== 'undefined' ? module : {});
