// assets/station/tour-opening.js — the promo's first six cuts, frames 0–1919:
// hook, route, survey, design, plan and build, each a document page from
// tour-doc.js. Every cut is a pure function of its own local frame `l`; a
// block rises on a beat (30 frames), and `beats` lists those frames for the
// score's plucks. The storyboard is
// .fankeel/build/2026-09-28-tour-blocks/mockup.html, blocks cut-hook …
// cut-build; the frame numbers in the comments are its.
(function (root, module) {
    'use strict';
    var E = root.tourEngine || require('./tour.js');
    var D = root.tourDoc || require('./tour-doc.js');
    var t = D.t;
    var PROJECT = 'inventory-admin';

    // hook (f 0–239): docs/inventory.md grows a block a beat, the page
    // scrolls, then three blocks go grey and struck at 180 and are marked
    // 已過時 at 210, 214 and 218.
    function struck(ctx, P, runs, x, y, w, l) {
        var k = E.prog(l, 180, 8), end = x + Math.min(w, D.runsWidth(ctx, P, runs));
        if (k > 0) E.line(ctx, [[x, y], [E.lerp(x, end, k), y]], P.faint, 1.2);
    }
    function staleAt(ctx, P, x, cy, l, at) {
        var k = E.backOut(E.prog(l, at, 10));
        if (k <= 0) return;
        E.fade(ctx, Math.min(1, k), function () {
            ctx.save();
            ctx.translate(x, cy);
            ctx.scale(k, k);
            ctx.translate(-x, -cy);
            D.pill(ctx, P, t(P, 'stale'), x, cy, 'stale', { right: true, maxW: 90 });
            ctx.restore();
        });
    }
    function greyed(P, l, base) { return E.prog(l, 180, 8) >= 1 ? P.faint : base; }
    function hook(ctx, P, l) {
        D.page(ctx, P, l, {
            tab: [['cm', 'docs/'], ['tab', 'inventory.md']], bottom: 294, cap: 'cap.hook',
            blocks: [
                { at: 0, h: 42, draw: function (ctx, P, x, y, w) { E.fitText(ctx, P, 'h1', t(P, 'hook.title'), x, y + 16, w, { middle: true, lines: 1 }); } },
                { at: 30, h: 33, draw: function (ctx, P, x, y, w, l) {
                    var runs = [['code', 'getStock(sku)', greyed(P, l, P.ink)], ['li', '  ' + t(P, 'hook.getStock'), greyed(P, l, P.ink2)]];
                    D.li(ctx, P, x, y, w - 100, runs);
                    struck(ctx, P, runs, x, y + 17, w - 100, l);
                    staleAt(ctx, P, x + w, y + 17, l, 210);
                } },
                { at: 60, h: 33, draw: function (ctx, P, x, y, w) { D.li(ctx, P, x, y, w, [['li', t(P, 'hook.csv')]]); } },
                { at: 90, h: 48, draw: function (ctx, P, x, y, w, l) {
                    var runs = [['li', t(P, 'hook.sched'), greyed(P, l, P.ink)], ['code', 'export-plan-v2.md', greyed(P, l, P.ink)]];
                    D.callout(ctx, P, x, y, w - 100, 40, P.rule2, runs);
                    struck(ctx, P, runs, x + 12, y + 20, w - 124, l);
                    staleAt(ctx, P, x + w, y + 20, l, 214);
                } },
                { at: 120, h: 33, draw: function (ctx, P, x, y, w, l) {
                    var runs = [['li', t(P, 'hook.retry'), greyed(P, l, P.ink2)]];
                    D.li(ctx, P, x, y, w - 100, runs);
                    struck(ctx, P, runs, x, y + 17, w - 100, l);
                    staleAt(ctx, P, x + w, y + 17, l, 218);
                } },
                { at: 150, h: 96, draw: function (ctx, P, x, y, w) {
                    var c2 = x + 180;
                    E.fitText(ctx, P, 'note', t(P, 'hook.field'), x, y + 10, 170, { middle: true, lines: 1 });
                    E.fitText(ctx, P, 'note', t(P, 'hook.source'), c2, y + 10, w - 180, { middle: true, lines: 1 });
                    [[t(P, 'hook.product'), 'products'], [t(P, 'hook.qty'), 'getStock(sku)']].forEach(function (r, i) {
                        var ry = y + 22 + 33 * i;
                        E.line(ctx, [[x, ry + 0.5], [x + w, ry + 0.5]], P.rule, 1);
                        E.fitText(ctx, P, 'li', r[0], x, ry + 17, 170, { middle: true, lines: 1, fill: P.ink });
                        E.fitText(ctx, P, 'code', r[1], c2, ry + 17, w - 180, { middle: true, lines: 1 });
                    });
                } },
            ],
        });
    }

    // route (f 240–479): the task card rises with the caption; from local 30
    // one stage lights a beat, the newest ringed.
    function route(ctx, P, l) {
        var lit = Math.max(0, Math.min(7, Math.floor(l / 30)));
        D.page(ctx, P, l, {
            tab: [['note', t(P, 'tab.station'), P.muted], ['tab', PROJECT]], top: 46, bottom: 294, cap: 'cap.route',
            blocks: [
                { at: 0, h: 34, draw: function (ctx, P, x, y, w) { E.fitText(ctx, P, 'h1', t(P, 'task'), x, y + 15, w, { middle: true, lines: 1 }); } },
                { at: 0, h: 24, draw: function (ctx, P, x, y, w) { E.fitRuns(ctx, P, [['cm', PROJECT], ['note', t(P, 'route.n')]], x, y + 10, w); } },
                { at: 0, h: 48, draw: function (ctx, P, x, y, w) { D.rail(ctx, P, x, y + 4, w, lit, lit > 0 && lit < 7 ? lit - 1 : -1); } },
            ],
        });
    }

    // survey (f 480–839): the header, `## 已經有什麼`, three files a beat
    // each, the sixth beat left empty, and the class callout at 180 — its
    // bar drawn first over 6 frames.
    var FOUND = [['src/stock/warehouse.ts', 'survey.wh'], ['src/transfer/', 'survey.tr'], ['docs/inventory.md', 'survey.doc']];
    function survey(ctx, P, l) {
        var blocks = [{ at: 30, h: 34, draw: function (ctx, P, x, y, w) { D.heading(ctx, P, 'h2', '##', t(P, 'survey.h'), x, y + 12, w); } }];
        FOUND.forEach(function (r, i) {
            blocks.push({ at: 60 + 30 * i, h: 33, draw: function (ctx, P, x, y, w) { D.li(ctx, P, x, y, w, [['code', r[0]], ['li', '  ' + t(P, r[1])]]); } });
        });
        blocks.push({ at: 180, h: 50, draw: function (ctx, P, x, y, w, l) {
            D.callout(ctx, P, x, y + 10, w, 38, P.st.survey, [['code', 'class: bounded'], ['li', t(P, 'survey.class'), P.ink]], E.prog(l, 180, 12));
        } });
        D.page(ctx, P, l, { tab: [['cm', '.fankeel/build/multi-warehouse/'], ['tab', 'survey.md']], head: 0, tall: true, blocks: blocks });
    }

    // design (f 840–1199): the approach in one sentence; the file table, its
    // head then a row a beat; the gate card at 210; ✓ 核准 pressed at 270
    // (to 0.95, green, a halo; 改做法 fades to 40%); 已核准 at 300.
    var CHANGES = [['src/stock/warehouse.ts', 'design.wh'], ['src/transfer/transfer.ts', 'design.tr'], ['docs/inventory.md', 'design.doc']];
    function design(ctx, P, l) {
        var blocks = [
            { at: 30, h: 58, draw: function (ctx, P, x, y, w) { E.fitText(ctx, P, 'p', t(P, 'design.p'), x, y + 21, w, { lines: 2, leading: 1.5 }); } },
            { at: 60, h: 24, draw: function (ctx, P, x, y, w) {
                E.fitText(ctx, P, 'note', t(P, 'design.file'), x, y + 10, 200, { middle: true, lines: 1 });
                E.fitText(ctx, P, 'note', t(P, 'design.change'), x + 210, y + 10, w - 210, { middle: true, lines: 1 });
            } },
        ];
        CHANGES.forEach(function (r, i) {
            blocks.push({ at: 90 + 30 * i, h: 33, draw: function (ctx, P, x, y, w) {
                E.line(ctx, [[x, y + 0.5], [x + w, y + 0.5]], P.rule, 1);
                E.fitText(ctx, P, 'code', r[0], x, y + 17, 200, { middle: true, lines: 1 });
                E.fitText(ctx, P, 'li', t(P, r[1]), x + 210, y + 17, w - 210, { middle: true, lines: 1, fill: P.ink });
            } });
        });
        blocks.push({ at: 210, h: 104, draw: function (ctx, P, x, y, w, l) {
            var press = E.backOut(E.prog(l, 270, 10)), ok = l >= 300;
            E.box(ctx, x, y + 12, w, 90, 10, null, P.rule2, 1);
            var pw = D.pill(ctx, P, t(P, ok ? 'design.ok' : 'design.gate'), x + 14, y + 36, ok ? 'ok' : 'gate', { maxW: 150 });
            E.fitText(ctx, P, 'ui', t(P, 'design.q'), x + 24 + pw, y + 36, w - 38 - pw, { middle: true, lines: 1, weight: '600' });
            var bx = x + 14, by = y + 56, s = 1 - 0.05 * Math.min(1, press);
            ctx.font = E.font(P, 'p', { size: 16, weight: '600' });
            var yw = Math.min(200, ctx.measureText(t(P, 'design.yes')).width) + 36;
            if (press > 0) E.fade(ctx, Math.min(1, press), function () { E.box(ctx, bx - 4, by - 4, yw + 8, 44, 10, P.upBg); });
            ctx.save();
            ctx.translate(bx + yw / 2, by + 18);
            ctx.scale(s, s);
            ctx.translate(-(bx + yw / 2), -(by + 18));
            E.box(ctx, bx, by, yw, 36, 6, press > 0 ? P.good : P.ink);
            E.fitText(ctx, P, 'p', t(P, 'design.yes'), bx + 18, by + 18, 200, { middle: true, lines: 1, size: 16, weight: '600', fill: P.panel });
            ctx.restore();
            E.fade(ctx, press > 0 ? 1 - 0.6 * Math.min(1, press) : 1, function () {
                ctx.font = E.font(P, 'p', { size: 16 });
                var nw = Math.min(160, ctx.measureText(t(P, 'design.no')).width) + 36;
                E.box(ctx, bx + yw + 10, by, nw, 36, 6, null, P.rule2, 1);
                E.fitText(ctx, P, 'p', t(P, 'design.no'), bx + yw + 28, by + 18, 160, { middle: true, lines: 1, size: 16, fill: P.ink2 });
            });
        } });
        D.page(ctx, P, l, { tab: [['cm', '.fankeel/build/multi-warehouse/'], ['tab', 'design.md']], head: 1, tall: true, blocks: blocks });
    }

    // A task card (.tk): `Task A` in mono and its name, then its Files line
    // and, for C, its Consumes line.
    function card(ctx, P, x, y, w, h, id, key, files, consumes, hot) {
        E.box(ctx, x, y, w, h, 6, P.inset);
        E.fitRuns(ctx, P, [['mi', 'Task ' + id + '  ', P.muted], ['ui', t(P, key)]], x + 12, y + 17, w - 24);
        E.fitRuns(ctx, P, [['cm', 'Files: '], ['m', files]], x + 12, y + 38, w - 24);
        if (consumes) E.fitRuns(ctx, P, [['cm', 'Consumes: '], ['m', 'A', hot ? P.st.plan : P.ink2]], x + 12, y + 57, w - 24);
    }
    // The dashed-free arrow (.pd-a / .bl-ar): a 2-unit stem down from y0
    // to y1 at x, drawn to `p` of its length, a head once it is there, and
    // its label to the right.
    function arrow(ctx, P, x, y0, y1, p, label, c) {
        if (p <= 0) return;
        var y = E.lerp(y0, y1, p);
        E.line(ctx, [[x, y0], [x, y]], c, 2);
        if (p >= 1) {
            ctx.beginPath();
            ctx.moveTo(x - 6, y1 - 7);
            ctx.lineTo(x + 6, y1 - 7);
            ctx.lineTo(x, y1);
            ctx.closePath();
            ctx.fillStyle = c;
            ctx.fill();
        }
        E.fade(ctx, p, function () { E.fitText(ctx, P, 'ui', label, x + 12, (y0 + y1) / 2, 200, { middle: true, lines: 1, size: 14, weight: '600', fill: c }); });
    }
    // A frame round a pair of cards (.pd-par / .bl-par) in colour `c`, drawn
    // to `p` along its edge, its label sitting on the top edge.
    function parFrame(ctx, P, x, y, w, h, p, c, why) {
        if (p <= 0) return;
        ctx.save();
        ctx.setLineDash([2 * (w + h) * p, 4 * (w + h)]);
        E.rr(ctx, x, y, w, h, 10);
        ctx.strokeStyle = c;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        E.fade(ctx, p, function () {
            var runs = [['ui', t(P, 'par'), c]];
            if (why) runs.push(['note', '  ' + why]);
            E.box(ctx, x + 6, y - 10, Math.min(w - 12, D.runsWidth(ctx, P, runs) + 12), 20, 0, P.panel);
            E.fitRuns(ctx, P, runs, x + 12, y, w - 24);
        });
    }

    // plan (f 1200–1559): three cards a beat each (A and B side by side, C
    // under A); at 150 the 同時 frame draws round A and B as they slide into
    // it; at 180 C drops a row; at 210 the arrow from A to C, 等 A, and C's
    // `Consumes: A` turns the plan colour.
    var HALF = (D.CW - 24) / 2; // two cards or lanes inside a frame, 6 in and 12 apart
    function plan(ctx, P, l) {
        D.page(ctx, P, l, {
            tab: [['cm', 'docs/plans/'], ['tab', '2026-09-28-multi-warehouse.md']], head: 2, bottom: 302, cap: 'cap.plan',
            blocks: [{ at: 30, h: 180, draw: function (ctx, P, x, y, w, l) {
                var slide = E.expoOut(E.prog(l, 150, 18)), drop = E.expoOut(E.prog(l, 180, 18));
                parFrame(ctx, P, x, y + 8, w, 70, E.prog(l, 150, 12), P.st.plan, t(P, 'par.why'));
                var ay = E.lerp(y + 2, y + 15, slide);
                D.risen(ctx, D.rise(l, 30), function () { card(ctx, P, x + 6, ay, HALF, 56, 'A', 'plan.a', 'src/stock/warehouse.ts'); });
                D.risen(ctx, D.rise(l, 60), function () { card(ctx, P, x + 18 + HALF, ay, HALF, 56, 'B', 'plan.b', 'src/transfer/api.ts'); });
                var cy = E.lerp(y + 68, y + 108, drop);
                D.risen(ctx, D.rise(l, 90), function () { card(ctx, P, x + 6, cy, HALF, 70, 'C', 'plan.c', 'src/transfer/ui.vue', true, l >= 210); });
                arrow(ctx, P, x + 6 + HALF / 2, y + 80, y + 106, E.prog(l, 210, 10), t(P, 'waits'), P.st.plan);
            } }],
        });
    }

    // build (f 1560–1919): the ledger. A and B in one 同時 frame at 30, C
    // queued under them at 60 with its arrow; at 90 A and B go green
    // together; at 180 a reviewer each; at 210 both turn ○ to ✓ (squeezed to
    // nothing across 4 frames, opened across 4); C goes green only at 240,
    // its reviewer at 300, its ✓ at 330. Every dot has its words beside it.
    function lane(ctx, P, x, y, w, id, key, l, go, review, done) {
        var st = l >= done ? 'done' : l >= review ? 'review' : l >= go ? 'run' : 'queued';
        var wait = st === 'queued', busy = st === 'run' || st === 'review';
        if (wait) E.box(ctx, x, y, w, 50, 6, null, P.rule2, 1);
        else E.box(ctx, x, y, w, 50, 6, P.inset);
        var flip = l < done ? 1 - E.prog(l, done - 4, 4) : E.prog(l, done, 4);
        ctx.save();
        ctx.translate(x + 17, y + 17);
        ctx.scale(Math.max(0.001, flip), 1);
        ctx.translate(-(x + 17), -(y + 17));
        E.fitText(ctx, P, 'ui', st === 'done' ? '✓' : '○', x + 17, y + 17, 20, { middle: true, lines: 1, align: 'center', fill: st === 'done' ? P.good : P.muted });
        ctx.restore();
        if (st === 'done') E.fitText(ctx, P, 'code', 'Task ' + id + ': complete', x + 32, y + 17, w - 42, { middle: true, lines: 1, weight: '600', size: 14 });
        else E.fitRuns(ctx, P, [['ui', 'Task ' + id + ' · ', wait ? P.muted : P.ink], ['ui', t(P, key), wait ? P.muted : P.ink]], x + 32, y + 17, w - 42);
        var ax = x + 32, ay = y + 37;
        if (!wait) {
            E.circle(ctx, ax + 4.5, ay, 4.5, st === 'run' ? P.live : P.muted);
            ax += 15;
        }
        if (st === 'review' || st === 'done') {
            E.circle(ctx, ax + 3, ay, 3, st === 'review' ? P.live : P.muted);
            ax += 12;
        }
        var words = { queued: 'build.queued', run: 'build.run', review: 'build.review', done: 'build.done' }[st];
        E.fitText(ctx, P, 'note', t(P, words), ax, ay, x + w - ax - 8, { middle: true, lines: 1, fill: busy ? P.live : P.muted, weight: busy ? '600' : null });
    }
    function build(ctx, P, l) {
        D.page(ctx, P, l, {
            tab: [['cm', '.fankeel/build/2026-09-28-multi-warehouse/'], ['tab', 'progress.md']], head: 3, bottom: 302, cap: 'cap.build',
            blocks: [
                { at: 0, h: 22, draw: function (ctx, P, x, y, w) { E.fitRuns(ctx, P, [['cm', '# fankeel build ledger '], ['note', '—'], ['cm', ' plan: docs/plans/2026-09-28-multi-warehouse.md']], x, y + 8, w); } },
                { at: 30, h: 76, draw: function (ctx, P, x, y, w, l) {
                    parFrame(ctx, P, x, y + 10, w, 64, 1, P.st.build);
                    lane(ctx, P, x + 6, y + 17, HALF, 'A', 'plan.a', l, 90, 180, 210);
                    lane(ctx, P, x + 18 + HALF, y + 17, HALF, 'B', 'plan.b', l, 90, 180, 210);
                } },
                { at: 60, h: 82, draw: function (ctx, P, x, y, w, l) {
                    arrow(ctx, P, x + 6 + HALF / 2, y, y + 26, 1, t(P, 'waits'), P.st.build);
                    lane(ctx, P, x + 6, y + 30, HALF, 'C', 'plan.c', l, 240, 300, 330);
                } },
            ],
        });
    }

    var CUTS = [
        { name: 'hook', len: 240, beats: [0, 30, 60, 90, 120, 150], draw: hook },
        { name: 'route', len: 240, beats: [0, 30, 60, 90, 120, 150, 180, 210], draw: route },
        { name: 'survey', len: 360, beats: [0, 30, 60, 90, 120, 180], draw: survey },
        { name: 'design', len: 360, beats: [0, 30, 60, 90, 120, 150, 210], draw: design },
        { name: 'plan', len: 360, beats: [0, 30, 60, 90], draw: plan },
        { name: 'build', len: 360, beats: [0, 30, 60], draw: build },
    ];

    module.exports = { CUTS: CUTS };
    if (typeof window !== 'undefined') root.tourOpening = module.exports;
})(typeof window !== 'undefined' ? window : globalThis, typeof module !== 'undefined' ? module : {});
