// assets/station/tour-stages.js — the promo (1:00, 3600 frames): a 240-frame
// pain hook, the seven stages 408 frames each (the illustrated scene sped up
// 3x, then a 108-frame hard cut to Claude Code's own three-line terminal
// statusline), and a 504-frame outro (install lines, then the tagline). One
// real task — 多倉庫庫存與調撥 (multi-warehouse inventory & transfers), in a
// project called `inventory-admin` — runs through all seven stages. The
// storyboard is `.fankeel/build/2026-09-27-tour-promo/mockup.html` (blocks
// promo-hook … promo-land, promo-outro); its own absolute frame numbers are
// this file's, since the block layout matches it exactly (240 + 408*7 + 504
// = 3600). The terminal cut's chrome and TokenBar's `lead()` statusline
// helper are moved here from tour-quickstart.js, whose only other consumer
// is deleted once this file is the sole one drawing them.
(function (root, module) {
    'use strict';
    var E = root.tourEngine || require('./tour.js');

    var ROUTE = E.ROUTE; // ['survey','design','plan','build','verify','audit','land']
    var PROJECT = 'inventory-admin';

    var INTRO = 240, PER = 408;
    var OUTRO = INTRO + PER * ROUTE.length; // 3096
    var LENGTH = OUTRO + 504; // 3600

    // lib/stages.js STAGES[].produces, in route order — tests/tour-stages.test.js
    // holds this against the source.
    var PRODUCES = [
        'a statement of what already exists',
        'an approach someone agreed to',
        'a decomposition someone with no context could execute',
        'the change itself',
        'evidence, not confidence',
        'a list of what is no longer true',
        'a repository no dirtier than you found it',
    ];
    var TAG = [
        'What is already here?',
        'One approach, agreed before building.',
        'Tasks that share no files.',
        'One implementer per task, a reviewer on each.',
        'Evidence, not confidence.',
        'What the change made untrue.',
        'Left no dirtier than it was found.',
    ];

    function curve(ctx, pts, color, lw) {
        ctx.beginPath();
        ctx.moveTo(pts[0], pts[1]);
        ctx.bezierCurveTo(pts[2], pts[3], pts[4], pts[5], pts[6], pts[7]);
        ctx.strokeStyle = color;
        ctx.lineWidth = lw;
        ctx.stroke();
    }

    // ===========================================================================
    // The seven illustrated scenes, unchanged from the 8100-frame file. Each is
    // still a pure function of a local frame in roughly 0..900; `stageHeader`
    // below feeds them a frame already run 3x fast, so the same internal
    // thresholds (the produces line at local >=720, the header reveal at 0)
    // land in the first 300 frames of a 408-frame block instead of the first
    // 900 of a 960-frame one.
    // ===========================================================================

    // survey — a scan band sweeps the tree; a row lights once the band has
    // passed it; three readers split off; their lines meet in survey.md,
    // written a line every 8 frames.
    var TREE = ['lib/', 'scripts/', 'docs/', 'tests/', 'hooks/', 'skills/', 'assets/'];
    var READER_Y = [140, 200, 260], READER_FROM = [[130, 150], [140, 194], [120, 238]], DOC_Y = [172, 200, 228];
    var DOC = [[156, 564], [174, 564], [192, 540], [210, 564], [228, 552], [246, 528]];
    var MERGE = 300;
    function scSurvey(ctx, P, l) {
        var c = P.st.survey;
        E.box(ctx, 40, 100, 196, 200, 8, P.panel);
        E.text(ctx, P, 'm', 'scripts/survey.js', 54, 122, { fill: c });
        E.line(ctx, [[40, 132], [236, 132]], P.rule2, 1.5);
        var band = 136 + 164 * E.prog(l, 213, 360);
        TREE.forEach(function (d, i) {
            var y = 154 + 22 * i;
            E.text(ctx, P, 'm', d, 54, y, y + 16 < band ? { fill: P.ink } : null);
        });
        if (l >= 213 && l < 573) {
            E.fade(ctx, 0.16, function () { E.box(ctx, 40, band - 16, 196, 16, 0, c); });
            E.line(ctx, [[40, band], [236, band]], c, 1.5);
        }
        READER_Y.forEach(function (y, i) {
            var k = E.expoOut(E.prog(l, 220 + 6 * i, 30));
            if (k <= 0) return;
            var from = READER_FROM[i], x = E.lerp(from[0], 340, k), ry = E.lerp(from[1], y, k);
            E.fade(ctx, 0.55 * k, function () { curve(ctx, [from[0], from[1], 260, from[1], 280, ry, x - 13, ry], c, 1.4); });
            E.circle(ctx, x, ry, 13, c);
        });
        if (l >= 226) E.text(ctx, P, 's', 'readers', 340, 296, { align: 'center' });
        var m = E.expoOut(E.prog(l, MERGE, 30));
        if (m <= 0) return;
        E.fade(ctx, m, function () {
            E.box(ctx, 460, 130, 120, 140, 6, P.panel);
            E.text(ctx, P, 'm', 'survey.md', 520, 292, { align: 'center' });
        });
        READER_Y.forEach(function (y, i) {
            E.fade(ctx, 0.55, function () {
                curve(ctx, [353, y, 410, y, 420, DOC_Y[i], E.lerp(353, 460, m), E.lerp(y, DOC_Y[i], m)], c, 1.4);
            });
        });
        DOC.forEach(function (d, i) {
            var w = E.prog(l, MERGE + 30 + 8 * i, 8);
            if (w > 0) E.line(ctx, [[476, d[0]], [E.lerp(476, d[1], w), d[0]]], P.rule2, 1.5);
        });
    }

    // design — three cards fall left to right; the gate box pops and its
    // check lands.
    function scDesign(ctx, P, l) {
        function card(i, fn) {
            var k = E.expoOut(E.prog(l, 40 + 12 * i, 30));
            E.fade(ctx, k, function () {
                ctx.save();
                ctx.translate(0, -30 * (1 - k));
                fn();
                ctx.restore();
            });
        }
        card(0, function () {
            E.box(ctx, 40, 100, 170, 190, 8, P.panel);
            E.text(ctx, P, 't', 'Approach', 56, 128);
            [[150, 192], [168, 192], [186, 170], [204, 184]].forEach(function (r) { E.line(ctx, [[56, r[0]], [r[1], r[0]]], P.rule2, 1.5); });
            E.box(ctx, 56, 250, 86, 22, 11, P.inset);
            E.text(ctx, P, 's', 'trade-offs', 99, 265, { align: 'center' });
        });
        card(1, function () {
            E.box(ctx, 226, 100, 170, 190, 8, P.panel);
            E.text(ctx, P, 't', 'Mockup', 242, 128);
            E.box(ctx, 242, 142, 138, 78, 4, P.inset, P.rule2, 1);
            E.box(ctx, 250, 150, 40, 62, 2, P.rule);
            E.box(ctx, 296, 150, 76, 28, 2, P.rule);
            E.box(ctx, 296, 184, 76, 28, 2, P.rule);
            E.text(ctx, P, 'm', 'mockup.html', 242, 264);
        });
        card(2, function () {
            E.box(ctx, 412, 100, 188, 86, 8, P.panel);
            E.text(ctx, P, 't', 'Fails if', 428, 128);
            E.text(ctx, P, 'm', 'export has 0 rows', 428, 154);
            E.line(ctx, [[574, 116], [584, 126]], P.bad, 2.4);
            E.line(ctx, [[584, 116], [574, 126]], P.bad, 2.4);
            E.text(ctx, P, 's', 'fails today', 428, 174, { fill: P.bad });
        });
        var g = E.backOut(E.prog(l, 300, 24));
        if (g <= 0) return;
        E.fade(ctx, Math.min(1, g), function () {
            ctx.save();
            ctx.translate(506, 245);
            ctx.scale(g, g);
            ctx.translate(-506, -245);
            E.box(ctx, 412, 200, 188, 90, 8, P.inset, P.st.design, 1.5);
            E.text(ctx, P, 't', 'Approve?', 428, 228);
            E.box(ctx, 424, 242, 164, 32, 5, P.rule);
            E.text(ctx, P, 'mi', '1', 436, 263);
            E.text(ctx, P, 'b', 'Approve', 456, 263);
            ctx.restore();
        });
        E.tick(ctx, 560, 258, 0.9, E.bounceOut(E.prog(l, 330, 30)), P.good);
    }

    // plan — the columns and the ledger fade in; the ledger writes three todo
    // rows; file capsules drop into three columns, never one file in two.
    var CAPS = [[52, 142, 'lib/csv.js'], [52, 174, 'csv.test.js'], [194, 142, 'report.html'], [194, 174, 'report.css'], [336, 142, 'README.md'], [336, 174, 'docs/csv.md']];
    function scPlan(ctx, P, l) {
        E.fade(ctx, E.expoOut(E.prog(l, 0, 24)), function () {
            [40, 182, 324].forEach(function (x, i) {
                E.box(ctx, x, 100, 130, 190, 8, P.panel);
                E.text(ctx, P, 't', 'Task ' + (i + 1), x + 14, 126);
            });
            E.box(ctx, 466, 100, 134, 190, 8, P.panel);
            E.text(ctx, P, 'mi', 'ledger', 480, 126);
            E.line(ctx, [[478, 138], [588, 138]], P.rule2, 1.5);
        });
        [162, 190, 218].forEach(function (y, i) {
            var r = E.prog(l, 120 + 10 * i, 10);
            if (r <= 0) return;
            E.fade(ctx, r, function () {
                E.text(ctx, P, 'm', String(i + 1), 480, y);
                E.text(ctx, P, 'm', 'todo', 500, y);
            });
            if (i < 2) E.line(ctx, [[478, y + 10], [E.lerp(478, 588, r), y + 10]], P.rule2, 1.5);
        });
        CAPS.forEach(function (c, i) {
            var k = E.expoOut(E.prog(l, 347 + 6 * i, 24));
            if (k <= 0) return;
            var y = E.lerp(c[1] - 60, c[1], k);
            if (i === CAPS.length - 1 && k < 1) E.line(ctx, [[c[0] + 53, y + 36], [c[0] + 53, c[1] + 62]], P.faint, 1, [3, 4]);
            E.fade(ctx, k, function () {
                E.box(ctx, c[0], y, 106, 24, 5, P.inset);
                E.text(ctx, P, 'm', c[2], c[0] + 8, y + 17);
            });
        });
    }

    // build — three implementers move along their lanes, leaving a commit dot
    // every 40 units; each that reaches the end gets the reviewer's diamond
    // turned 90°, a check, and its ledger row turns done.
    var LANE_V = [310 / 300, 222 / 340, 142 / 340];
    function scBuild(ctx, P, l) {
        var c = P.st.build;
        E.box(ctx, 466, 100, 134, 190, 8, P.panel);
        E.text(ctx, P, 'mi', 'ledger', 480, 126);
        E.line(ctx, [[478, 138], [588, 138]], P.rule2, 1.5);
        E.text(ctx, P, 's', 'reviewer', 414, 110, { align: 'center' });
        [140, 200, 260].forEach(function (y, i) {
            E.line(ctx, [[60, y], [380, y]], P.rule2, 1.5);
            E.text(ctx, P, 'm', String(i + 1), 40, y + 4);
            var x = Math.min(370, 60 + LANE_V[i] * Math.max(0, l - 40));
            for (var d = 90; d <= x; d += 40) E.circle(ctx, d, y, 4, c);
            if (x < 370) E.circle(ctx, x, y, 11, c);
            var arrive = 40 + 310 / LANE_V[i];
            var rv = E.expoOut(E.prog(l, arrive, 20));
            if (rv > 0) {
                E.line(ctx, [[380, y], [396, y]], P.rule2, 1.5);
                ctx.save();
                ctx.translate(414, y);
                ctx.rotate(rv * Math.PI / 2);
                ctx.beginPath();
                ctx.moveTo(0, -16);
                ctx.lineTo(16, 0);
                ctx.lineTo(0, 16);
                ctx.lineTo(-16, 0);
                ctx.closePath();
                ctx.fillStyle = P.ink2;
                ctx.fill();
                ctx.restore();
                E.tick(ctx, 406, y + 34, 1, E.bounceOut(E.prog(l, arrive + 20, 30)), P.good);
            }
            var ly = 162 + 28 * i, done = l >= arrive + 30;
            E.text(ctx, P, 'm', String(i + 1), 480, ly);
            E.text(ctx, P, 'm', done ? 'done' : l >= 40 ? 'building' : 'todo', 500, ly, done ? { fill: P.good } : null);
            if (i < 2) E.line(ctx, [[478, ly + 10], [588, ly + 10]], P.rule2, 1.5);
        });
    }

    // verify — each row: the claim, an arrow, the evidence typed 2 frames a
    // character, then a check.
    var ROWS = [['Tests pass', 'node --test · 0 failed'], ['Criterion met', 'failed before, passes now'], ['Docs still true', 'docs-check · exit 0']];
    function scVerify(ctx, P, l) {
        E.box(ctx, 40, 100, 560, 190, 8, P.panel);
        E.text(ctx, P, 's', 'claim', 60, 128);
        E.text(ctx, P, 's', 'evidence', 310, 128);
        E.line(ctx, [[52, 140], [588, 140]], P.st.verify, 2);
        ROWS.forEach(function (r, i) {
            var s = 150 * i, y = 174 + 48 * i, k = E.expoOut(E.prog(l, s, 24));
            if (i) E.line(ctx, [[52, y - 30], [588, y - 30]], P.rule2, 1.5);
            E.fade(ctx, k, function () { E.text(ctx, P, 'b', r[0], 60 + 12 * (1 - k), y); });
            var a = E.expoOut(E.prog(l, s + 20, 16));
            if (a > 0) E.line(ctx, [[250, y - 4], [E.lerp(250, 290, a), y - 4]], P.faint, 1.2);
            if (a >= 1) E.line(ctx, [[284, y - 9], [290, y - 4], [284, y + 1]], P.faint, 1.2);
            var n = Math.floor(E.prog(l, s + 36, 2 * r[1].length) * r[1].length);
            if (n > 0) E.text(ctx, P, 'm', r[1].slice(0, n), 310, y);
            E.tick(ctx, 560, y - 5, 1, E.bounceOut(E.prog(l, s + 40 + 2 * r[1].length, 30)), P.good);
        });
    }

    // audit — two tool pills light, each page's untrue line is marked and
    // struck, a line pulls it right, and the list item pops.
    var PAGES = [
        { x: 40, pill: 'docs-check', rows: [[152, 166], [170, 150], [188, 166], [206, 160], [224, 140], [242, 166], [260, 156]], hit: 3, at: 120, item: ['README.md', 'names a removed flag', 162], c1: 90, c2: 300 },
        { x: 200, pill: 'docs-audit', rows: [[152, 326], [170, 320], [188, 310], [206, 326], [224, 300], [242, 326], [260, 316]], hit: 1, at: 210, item: ['pipeline.md', 'old stage name', 210], c1: 20, c2: 350 },
    ];
    function scAudit(ctx, P, l) {
        var c = P.st.audit;
        E.fade(ctx, E.expoOut(E.prog(l, 24, 24)), function () {
            E.box(ctx, 380, 98, 220, 192, 8, P.panel);
            E.text(ctx, P, 't', 'No longer true', 396, 126);
        });
        PAGES.forEach(function (pg) {
            E.fade(ctx, E.expoOut(E.prog(l, pg.x === 40 ? 0 : 12, 24)), function () {
                E.box(ctx, pg.x, 98, 100, 22, 11, P.inset);
                E.text(ctx, P, 'm', pg.pill, pg.x + 50, 113, { align: 'center', fill: l >= pg.at - 60 ? P.ink : P.ink2 });
                E.box(ctx, pg.x, 130, 140, 160, 6, P.panel);
                pg.rows.forEach(function (r) { E.line(ctx, [[pg.x + 14, r[0]], [r[1], r[0]]], P.rule2, 1.5); });
            });
            var y = pg.rows[pg.hit][0], ty = pg.item[2] - 4, x0 = pg.x + 130;
            E.fade(ctx, 0.22 * E.expoOut(E.prog(l, pg.at, 18)), function () { E.box(ctx, pg.x + 10, y - 8, 120, 16, 2, c); });
            var s = E.prog(l, pg.at + 18, 20);
            if (s > 0) E.line(ctx, [[pg.x + 14, y], [E.lerp(pg.x + 14, pg.rows[pg.hit][1], s), y]], c, 1.6);
            var q = E.expoOut(E.prog(l, pg.at + 40, 30));
            if (q > 0) {
                E.fade(ctx, 0.5, function () {
                    curve(ctx, [x0, y, E.lerp(x0, x0 + pg.c1, q), y, E.lerp(x0, pg.c2, q), E.lerp(y, ty, q), E.lerp(x0, 380, q), E.lerp(y, ty, q)], c, 1.2);
                });
            }
            var it = E.backOut(E.prog(l, pg.at + 70, 20));
            E.fade(ctx, Math.min(1, it), function () {
                ctx.save();
                ctx.translate(396, pg.item[2]);
                ctx.scale(it, it);
                ctx.translate(-396, -pg.item[2]);
                E.text(ctx, P, 'mi', pg.item[0], 396, pg.item[2]);
                E.text(ctx, P, 's', pg.item[1], 396, pg.item[2] + 18);
                ctx.restore();
            });
        });
    }

    // land — the suite bar fills and turns green; the branch arcs back into
    // main and the merge rings; a light band rewrites map.md top to bottom.
    var MAP_ROWS = [[160, 584], [178, 560], [196, 584], [214, 548], [232, 584], [250, 570], [268, 530]];
    var REWRITE = 346;
    function scLand(ctx, P, l) {
        var c = P.st.land;
        E.text(ctx, P, 's', 'suite', 40, 118);
        E.box(ctx, 40, 126, 280, 12, 6, P.inset);
        var s = E.expoOut(E.prog(l, 24, 40));
        if (s > 0) E.box(ctx, 40, 126, 280 * s, 12, 6, s >= 1 ? P.good : P.ink2);
        if (s >= 1) E.text(ctx, P, 'm', 'green', 320, 118, { align: 'right', fill: P.good });
        E.line(ctx, [[40, 230], [330, 230]], P.rule2, 3);
        ctx.beginPath();
        ctx.moveTo(90, 230);
        ctx.bezierCurveTo(112, 230, 110, 190, 132, 190);
        ctx.lineTo(248, 190);
        ctx.strokeStyle = c;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        var m = E.expoOut(E.prog(l, 100, 36));
        if (m > 0) {
            ctx.beginPath();
            ctx.moveTo(248, 190);
            ctx.bezierCurveTo(270, 190, 268, 230, 290, 230);
            ctx.setLineDash([60 * m, 1000]);
            ctx.strokeStyle = c;
            ctx.lineWidth = 2.5;
            ctx.stroke();
            ctx.setLineDash([]);
        }
        E.circle(ctx, 60, 230, 5, P.ink2);
        E.circle(ctx, 90, 230, 5, P.ink2);
        E.fade(ctx, 0.4, function () { E.circle(ctx, 320, 230, 5, P.ink2); });
        [160, 195, 230].forEach(function (x) { E.circle(ctx, x, 190, 5, c); });
        var ring = E.backOut(E.prog(l, 136, 20));
        if (ring > 0) {
            E.circle(ctx, 290, 230, 6, c);
            E.circle(ctx, 290, 230, 10 * ring, null, c, 1.5);
            E.text(ctx, P, 'm', 'merge', 290, 258, { align: 'center', fill: c });
        }
        E.text(ctx, P, 'm', 'main', 40, 258);
        E.box(ctx, 380, 100, 220, 190, 8, P.panel);
        E.text(ctx, P, 'mi', 'map.md', 396, 128);
        var b = E.prog(l, REWRITE, 90), by = E.lerp(130, 290, b);
        MAP_ROWS.forEach(function (r) { E.line(ctx, [[396, r[0]], [r[1], r[0]]], r[0] < by ? P.faint : P.rule2, 1.5); });
        if (b > 0 && b < 1) {
            ctx.save();
            E.rr(ctx, 380, 100, 220, 190, 8);
            ctx.clip();
            E.fade(ctx, 0.1, function () { E.box(ctx, 380, by - 40, 220, 40, 0, c); });
            ctx.restore();
        }
        E.fade(ctx, E.expoOut(E.prog(l, REWRITE, 24)), function () {
            E.fade(ctx, 0.2, function () { E.box(ctx, 500, 113, 86, 22, 11, c); });
            E.text(ctx, P, 's', 'rewritten', 543, 128, { align: 'center', fill: c });
        });
    }

    var SCENES = [scSurvey, scDesign, scPlan, scBuild, scVerify, scAudit, scLand];

    // The header, scene and produces-line each stage drew in the 8100-frame
    // file, unchanged, driven by a frame already run 3x fast (see
    // `stageBlock`): the produces line still fades in once that frame passes
    // 720, and the fade-out guard at PER_OLD-12 never fires because the
    // scaled frame tops out at 897, well under 948.
    var PER_OLD = 960;
    function stageHeader(ctx, P, i, l) {
        var s = ROUTE[i], c = P.st[s];
        E.fade(ctx, 1 - E.expoIn(E.prog(l, PER_OLD - 12, 12)), function () {
            var h = E.expoOut(E.prog(l, 0, 24));
            E.fade(ctx, h, function () {
                E.text(ctx, P, 'h', s, 40 + 16 * (1 - h), 56, { fill: c });
                E.text(ctx, P, 'sub', TAG[i], 40, 80);
                E.text(ctx, P, 'm', (i + 1) + ' / 7', 600, 56, { align: 'right' });
            });
            SCENES[i](ctx, P, l);
            E.fade(ctx, E.expoOut(E.prog(l, 720, 24)), function () {
                E.text(ctx, P, 's', '→ ' + PRODUCES[i], 320, 314, { align: 'center', fill: c });
            });
        });
        E.rail(ctx, P, i, E.backOut(E.prog(l, 0, 20)));
    }

    // ===========================================================================
    // Terminal cuts: Claude Code in VS Code's terminal, running TokenBar's own
    // three-line statusline. Moved from tour-quickstart.js — its only other
    // consumer — since that file is deleted once this one is the sole reader.
    // ===========================================================================

    var PARTIAL = [' ', '▏', '▎', '▍', '▌', '▋', '▊', '▉'];
    function barStr(pct, width) {
        width = width || 10;
        if (pct == null) return '░'.repeat(width);
        var eighths = Math.round(E.clamp01(pct / 100) * width * 8);
        var full = Math.min(width, Math.floor(eighths / 8)), rem = eighths - full * 8;
        var s = '';
        for (var i = 0; i < full; i++) s += '█';
        if (full < width) { s += PARTIAL[rem]; s += '░'.repeat(Math.max(0, width - full - 1)); }
        return s;
    }
    function pctStr(pct) { return pct == null ? '--%' : Math.round(pct) + '%'; }
    // The route dots as `●`/`○` characters — this file's own route is all
    // seven stages (never the quick start's five), so `step` runs 0..7.
    function dotsStr(step, n) {
        var s = '';
        for (var i = 0; i < (n || ROUTE.length); i++) s += i < step ? '●' : '○';
        return s;
    }
    // TokenBar's own three-line statusline (docs/90-agent/reference/statusline.md):
    // one badge word, a lead line with the route dots, the guard word, a
    // collision flag and the claimed path, then the model/project/branch line
    // and the two usage bars — drawn as plain monospace text, never as
    // separate shapes, so the route dots read back as `●`/`○` characters.
    function lead(ctx, P, st) {
        var color = st.others ? P.bad : P.st[st.stage];
        var o = { size: st.size, fill: color };
        var l1 = '▌FANKEEL ' + st.stage.toUpperCase() + '   ' + dotsStr(st.step, st.n) + '  ⚿ ask'
            + (st.others ? '  ⚑' + st.others : '')
            + (st.where ? '  ' + st.where : '') + '  ' + st.title;
        var l2 = '▌ Opus 5 | ' + PROJECT + ' | main ↑2';
        var l3 = '▌ ctx ' + barStr(st.ctx) + '  ' + pctStr(st.ctx) + '  │  5h ' + barStr(st.h5) + '  ' + pctStr(st.h5);
        E.text(ctx, P, 'j', l1, st.x, st.y, o);
        E.text(ctx, P, 'j', l2, st.x, st.y + 13, { size: st.size });
        E.text(ctx, P, 'j', l3, st.x, st.y + 26, { size: st.size });
    }
    // VS Code with the terminal panel maximised: title bar, activity bar,
    // panel tabs, status bar — the storyboard's `.k-vs`, drawn with tour.js's
    // own primitives; no new chrome belongs in tour.js itself.
    function vsCode(ctx, P, split) {
        E.box(ctx, 0, 0, 640, 16, 0, P.panel);
        E.text(ctx, P, 's', PROJECT + ' — Visual Studio Code', 320, 11, { align: 'center', size: 8 });
        E.text(ctx, P, 's', '—    □    ×', 632, 11, { align: 'right', size: 8 });
        E.box(ctx, 0, 16, 20, 332, 0, P.panel);
        [24, 44, 64, 84].forEach(function (y) { E.box(ctx, 5, y, 10, 10, 2, P.inset); });
        E.line(ctx, [[20.5, 16], [20.5, 348]], P.rule2, 1);
        E.line(ctx, [[20, 36.5], [640, 36.5]], P.rule2, 1);
        [['PROBLEMS', 30], ['OUTPUT', 74], ['DEBUG CONSOLE', 110]].forEach(function (t) {
            E.text(ctx, P, 's', t[0], t[1], 29, { size: 8 });
        });
        E.text(ctx, P, 's', 'TERMINAL', 176, 29, { size: 8, fill: P.ink });
        E.line(ctx, [[176, 33.5], [212, 33.5]], P.ink, 1);
        E.text(ctx, P, 's', split ? 'pwsh  │  pwsh' : 'pwsh', 632, 29, { align: 'right', size: 8 });
        if (split) E.line(ctx, [[SPLIT + 0.5, 37], [SPLIT + 0.5, 348]], P.rule2, 1);
        E.box(ctx, 0, 348, 640, 12, 0, P.panel);
        E.line(ctx, [[0, 348.5], [640, 348.5]], P.rule2, 1);
        E.text(ctx, P, 's', 'main ↑2', 26, 357, { size: 8 });
    }

    // Each terminal shot, generated from the storyboard's own svg (its
    // `pm-<stage>-t` shots): the Claude Code transcript as lines of coloured
    // runs [text, colour, bold], the input box, the rings, the caption pill
    // and the statuslines with their k-sl data.
    var TERM = {
        survey: {"lines":[[30,50,9.5,[["> /fankeel 多倉庫庫存與調撥","c2",0]]],[30,76,9.5,[["⏺","cg",0],[" Bash",null,1],["(node scripts/orient.js)","c2",0]]],[30,89,9.5,[["  ⎿  ","cm",0],["inventory-admin · git · 214 files · map.md 3 天前寫的","c2",0]]],[30,102,9.5,[["     這棵樹裡沒有其他 live session","c2",0]]],[30,128,9.5,[["⏺","cg",0],[" Bash",null,1],["(node scripts/survey.js product picker select)","c2",0]]],[30,141,9.5,[["  ⎿  ","cm",0],["files whose name matches:","c2",0]]],[30,154,9.5,[["       ","c2",0],["src/orders/ProductPicker.tsx","ink",0],["  3.4 KB","c2",0]]],[30,167,9.5,[["       ","c2",0],["src/purchase/SkuSelect.tsx","ink",0],["    2.8 KB","c2",0]]],[30,180,9.5,[["       ","c2",0],["src/stock/ItemLookup.tsx","ink",0],["      2.1 KB","c2",0]]],[30,193,9.5,[["     … +9 lines (ctrl+o to expand)","cm",0]]],[30,219,9.5,[["⏺ 選商品的元件已經有三個。調撥單的品項直接用 src/orders/ProductPicker.tsx，",null,0]]],[30,232,9.5,[["  不寫第四個。",null,0]]],[38,259,9.5,[["> ","cm",0],["█","c2",0]]]],"boxes":[[30.5,244.5,598,22]],"rings":[[64,144,215,40]],"sl":[{"x":32,"y":284,"size":9.5,"stage":"survey","step":1,"n":7,"title":"多倉庫庫存與調撥","ctx":9,"h5":41}],"pill":[292,154,160,20],"note":[372,168,"已經有三個了，不寫第四個"]},
        design: {"lines":[[30,50,9.5,[["⏺ 做法：庫存改成每倉一筆（stock 加 warehouse_id），調撥記成一出一入兩筆異動。",null,0]]],[30,63,9.5,[["  會失敗的條件：任一商品各倉加總 ≠ 原本的總數。mockup 在 .fankeel/build/。","c2",0]]],[36,94,9.5,[["☐ 做法","ground",0]]],[32,117,9.5,[["這個做法可以嗎？",null,1]]],[32,139,9.5,[["❯ 1. 同意，進 plan (Recommended)","cs",0]]],[32,152,9.5,[["     照 mockup.html 這一版拆任務","cm",0]]],[32,170,9.5,[["  2. 先開 mockup 看看",null,0]]],[32,183,9.5,[["     在瀏覽器打開 mockup.html","cm",0]]],[32,201,9.5,[["  3. 換一個做法",null,0]]],[32,214,9.5,[["     說哪裡不對，重寫做法","cm",0]]],[32,232,9.5,[["  4. Type something.","c2",0]]],[32,254,9.5,[["Enter to select · ↑/↓ to navigate · Esc to cancel","cm",0]]]],"boxes":[],"rings":[],"sl":[{"x":32,"y":279,"size":9.5,"stage":"design","step":2,"n":7,"title":"多倉庫庫存與調撥","ctx":12,"h5":43}],"pill":[392,128,176,20],"note":[480,142,"你點頭之前，不寫一行程式"]},
        plan: {"lines":[[30,50,9.5,[["⏺","cg",0],[" Write",null,1],["(docs/plans/multi-warehouse.md)","c2",0]]],[30,63,9.5,[["  ⎿  ","cm",0],["Wrote 142 lines to docs/plans/multi-warehouse.md","c2",0]]],[30,89,9.5,[["⏺","cg",0],[" Bash",null,1],["(node scripts/ledger.js groups --plan docs/plans/multi-warehouse.md)","c2",0]]],[30,102,9.5,[["  ⎿  ","cm",0],["fankeel ledger — 2 groups over 4 tasks","c2",0]]],[30,115,9.5,[["       1: 1, 2, 3  — workflow","c2",0]]],[30,128,9.5,[["       2: 4  — agent","c2",0]]],[30,154,9.5,[["⏺ 1、2、3 不碰同一個檔案，同時交給三個實作者：",null,0]]],[30,167,9.5,[["     1  ","c2",0],["src/warehouse/stockAt.ts  tests/stock.test.ts","ink",0]]],[30,180,9.5,[["     2  ","c2",0],["api/transfers.ts  src/warehouse/Transfer.tsx","ink",0]]],[30,193,9.5,[["     3  ","c2",0],["src/stock/StockTable.tsx  src/stock/stock.css","ink",0]]],[30,206,9.5,[["  4 也要改 src/warehouse/stockAt.ts，排進第二組，等 1 做完再上。",null,0]]],[38,237,9.5,[["> ","cm",0],["█","c2",0]]]],"boxes":[[30.5,222.5,598,22]],"rings":[[58,158,280,39]],"sl":[{"x":32,"y":262,"size":9.5,"stage":"plan","step":3,"n":7,"title":"多倉庫庫存與調撥","ctx":15,"h5":44}],"pill":[350,168,162,20],"note":[431,182,"三個任務，沒有共用的檔案"]},
        build: {"lines":[[26,47,9,[["⏺","cg",0],[" Read",null,1],["(src/stock/StockTable.tsx)","c2",0]]],[26,60,9,[["  ⎿  ","cm",0],["Read 212 lines","c2",0]]],[26,76,9,[["⏺ task 3：庫存表加一欄倉庫。",null,0]]],[26,96,9,[["⏺","cg",0],[" Update",null,1],["(src/stock/StockTable.tsx)","c2",0]]],[26,118,9,[["Edit file",null,1]]],[32,136,9,[["41   { key: 'sku', label: '品號' },","cm",0]]],[32,149,9,[["42 ","cm",0],["+ { key: 'warehouse', label: '倉庫' },","cg",0]]],[26,170,9,[["fankeel: src/stock/StockTable.tsx is claimed by another live","cb",0]]],[26,183,9,[["session.","cb",0]]],[26,196,9,[["  - 庫存報表加 CSV 匯出 @ build","cb",0]]],[26,214,9,[["Do you want to make this edit to StockTable.tsx?",null,0]]],[26,230,9,[["❯ 1. Yes","cs",0]]],[26,243,9,[["  2. Yes, allow all edits during this session (shift+tab)",null,0]]],[26,256,9,[["  3. No, and tell Claude what to do differently (esc)",null,0]]],[388,50,9,[["> /fankeel 庫存報表加 CSV 匯出","c2",0]]],[388,76,9,[["⏺","cg",0],[" Update",null,1],["(src/stock/StockTable.tsx)","c2",0]]],[388,89,9,[["  ⎿  ","cm",0],["Updated src/stock/StockTable.tsx","c2",0]]],[388,102,9,[["     with 18 additions and 2 removals","c2",0]]],[388,128,9,[["✻ Building… ","co",0],["(esc to interrupt)","cm",0]]],[394,153,9,[["> ","cm",0],["█","c2",0]]]],"boxes":[[26.5,124.5,348,30],[386.5,138.5,246,22]],"rings":[],"sl":[{"x":26,"y":296,"size":9,"stage":"build","step":4,"n":7,"others":1,"where":"src/stock/StockTable.tsx","title":"多倉庫庫存與調撥","ctx":22,"h5":48},{"x":388,"y":180,"size":9,"stage":"build","step":3,"n":5,"others":1,"where":"src/stock/StockTable.tsx","title":"庫存報表加 CSV 匯出","ctx":22,"h5":48}],"pill":[392,236,236,20],"note":[510,250,"⚑ 另一個終端機也在改 StockTable.tsx"],"split":1},
        verify: {"lines":[[30,50,9.5,[["⏺","cg",0],[" Bash",null,1],["(node --test)","c2",0]]],[30,63,9.5,[["  ⎿  ","cm",0],["ℹ tests 118  ℹ pass 118  ℹ fail 0","c2",0]]],[30,89,9.5,[["⏺ 需求逐條對證據：",null,0]]],[30,102,9.5,[["  ",null,0],["✔","cg",0],[" 庫存按倉庫各記一筆",null,0]]],[250,102,9.5,[["tests/stock.test.ts:22","c2",0]]],[30,115,9.5,[["  ",null,0],["✔","cg",0],[" 調撥出倉扣、入倉加，總量不變",null,0]]],[250,115,9.5,[["tests/transfers.test.ts:38","c2",0]]],[30,128,9.5,[["  ",null,0],["✔","cg",0],[" 庫存不足拒絕調撥：改動前失敗、現在通過",null,0]]],[250,128,9.5,[["tests/transfers.test.ts:61","c2",0]]],[30,141,9.5,[["  ",null,0],["✔","cg",0],[" 單倉的訂單照樣扣庫",null,0]]],[250,141,9.5,[["tests/orders.test.ts:17","c2",0]]],[30,167,9.5,[["✻","co",0],[" Verifying… ","co",0],["(esc to interrupt)","cm",0]]],[38,237,9.5,[["> ","cm",0],["█","c2",0]]]],"boxes":[[30.5,222.5,598,22]],"rings":[],"sl":[{"x":32,"y":262,"size":9.5,"stage":"verify","step":5,"n":7,"where":"api/transfers.ts","title":"多倉庫庫存與調撥","ctx":34,"h5":58}],"pill":[420,84,130,20],"note":[485,98,"每一條都附證據"]},
        audit: {"lines":[[30,50,9.5,[["⏺","cg",0],[" Bash",null,1],["(node scripts/docs-check.js)","c2",0]]],[30,63,9.5,[["  ⎿  ","cm",0],["fankeel docs-check — 12 markdown files","c2",0]]],[30,89,9.5,[["     1 reference that no longer resolves:","c2",0]]],[30,102,9.5,[["       ","c2",0],["docs/stock.md:14","ink",0],["  ","c2",0],["src/stock/getStock.ts","cb",0]]],[30,128,9.5,[["⏺","cg",0],[" Update",null,1],["(docs/stock.md)","c2",0]]],[30,141,9.5,[["  ⎿  ","cm",0],["Updated docs/stock.md with 2 additions and 2 removals","c2",0]]],[30,167,9.5,[["⏺ docs/stock.md 還指著單倉的 src/stock/getStock.ts，這次已換成 src/warehouse/stockAt.ts。",null,0]]],[30,180,9.5,[["  改成新的路徑，docs-check 回到 0；不留給半年後的人再撲空一次。",null,0]]],[38,237,9.5,[["> ","cm",0],["█","c2",0]]]],"boxes":[[30.5,222.5,598,22]],"rings":[[64,93,236,13]],"sl":[{"x":32,"y":262,"size":9.5,"stage":"audit","step":6,"n":7,"where":"docs/stock.md","title":"多倉庫庫存與調撥","ctx":36,"h5":61}],"pill":[312,89,176,20],"note":[400,103,"這次改動讓哪一行說錯了"]},
        land: {"lines":[[30,50,9.5,[["⏺","cg",0],[" Bash",null,1],["(node --test)","c2",0]]],[30,63,9.5,[["  ⎿  ","cm",0],["ℹ tests 118  ℹ pass 118  ℹ fail 0","c2",0]]],[30,89,9.5,[["⏺","cg",0],[" Bash",null,1],["(git merge --no-ff fankeel/multi-warehouse)","c2",0]]],[30,102,9.5,[["  ⎿  ","cm",0],["Merge made by the 'ort' strategy.","c2",0]]],[30,115,9.5,[["      23 files changed, 1204 insertions(+), 318 deletions(-)","c2",0]]],[30,141,9.5,[["⏺","cg",0],[" Write",null,1],["(.fankeel/map.md)","c2",0]]],[30,154,9.5,[["  ⎿  ","cm",0],["Wrote 212 lines to .fankeel/map.md","c2",0]]],[30,180,9.5,[["⏺ land 完成：在本機合併，沒有 push。",null,0]]],[30,193,9.5,[["  起點到 land 2h 07m · 花費 $53.87 · 42 個 agent","c2",0]]],[38,237,9.5,[["> ","cm",0],["█","c2",0]]]],"boxes":[[30.5,222.5,598,22]],"rings":[],"sl":[{"x":32,"y":262,"size":9.5,"stage":"land","step":7,"n":7,"where":"api/transfers.ts","title":"多倉庫庫存與調撥","ctx":38,"h5":66}],"pill":[400,176,150,20],"note":[475,190,"七站走完，一個不少"]}
    };
    var RUN = { c2: 'ink2', cm: 'muted', cg: 'good', cb: 'bad', ink: 'ink', ground: 'ground' };
    var CC = { co: '#d77757', cs: '#b1b9f9' };
    function runs(ctx, P, x, y, size, segs) {
        segs.forEach(function (r) {
            ctx.font = (r[2] ? '700 ' : '400 ') + size + 'px ' + P.fMono;
            // AskUserQuestion's header chip: ground-coloured text on an ink2 tab.
            if (r[1] === 'ground') E.box(ctx, x - 4, y - 11, ctx.measureText(r[0]).width + 8, 15, 2, P.ink2);
            E.text(ctx, P, 'j', r[0], x, y, { size: size, weight: r[2] ? '700' : '400', fill: CC[r[1]] || P[RUN[r[1]] || 'ink'] });
            x += ctx.measureText(r[0]).width;
        });
    }
    // A split terminal keeps each pane's text inside its own half.
    var SPLIT = 380;
    function pane(ctx, T, x, fn) {
        if (!T.split) return fn();
        ctx.save();
        ctx.beginPath();
        if (x < SPLIT) ctx.rect(21, 37, SPLIT - 25, 311); else ctx.rect(SPLIT + 1, 37, 639 - SPLIT - 4, 311);
        ctx.clip();
        fn();
        ctx.restore();
    }
    function transcript(ctx, P, T) {
        T.lines.forEach(function (l) { pane(ctx, T, l[0], function () { runs(ctx, P, l[0], l[1], l[2], l[3]); }); });
        T.boxes.forEach(function (b) { E.box(ctx, b[0], b[1], b[2], b[3], 3, null, P.faint, 1); });
    }
    var CROSS = 6; // frames into a terminal cut where the lead crosses from the previous stage to this one

    // A single stage's terminal cut: the finished transcript on a hard cut;
    // for six frames the lead line still reads the previous stage (survey has
    // none to cross from, so it never holds), then it crosses to this block's
    // own stage and that stage's own route dot lights — one route, drawn in
    // two places, from one `i`. The ring and the caption pill come in after.
    function termCut(ctx, P, i, tl) {
        var s = ROUTE[i], T = TERM[s], prev = i > 0 ? ROUTE[i - 1] : s;
        vsCode(ctx, P, T.split);
        transcript(ctx, P, T);
        var crossed = i === 0 || tl >= CROSS;
        T.sl.forEach(function (sl, n) {
            var st = Object.assign({}, sl);
            if (n === 0 && !crossed) { st.stage = prev; st.step = sl.step - 1; }
            if (n === 0 && s === 'build' && tl < 12) st.others = undefined;
            var g = E.expoOut(E.prog(tl, 0, 12));
            pane(ctx, T, sl.x, function () { E.fade(ctx, g, function () { lead(ctx, P, st); }); });
        });
        var r = E.expoOut(E.prog(tl, 12, 12));
        E.fade(ctx, r, function () { T.rings.forEach(function (b) { E.box(ctx, b[0], b[1], b[2], b[3], 3, null, P.ink2, 1.2); }); });
        var k = E.backOut(E.prog(tl, 20, 14));
        if (k > 0) E.fade(ctx, Math.min(1, k), function () {
            var p = T.pill;
            E.box(ctx, p[0], p[1], p[2], p[3], p[3] / 2, P.panel, P.rule2, 1);
            E.text(ctx, P, 'b', T.note[2], T.note[0], T.note[1], { align: 'center', size: 11, weight: '600' });
        });
    }

    // land's terminal cut is two shots: the same crossing cut (72 frames),
    // then a close-up (36 frames) on its statusline with all seven route dots
    // lit at once — the video's one moment the whole rail moves together.
    function landCloseup(ctx, P, tl) {
        var T = TERM.land, sl = T.sl[0];
        vsCode(ctx, P);
        ctx.save();
        ctx.beginPath();
        ctx.rect(21, 37, 619, 311);
        ctx.clip();
        ctx.translate(sl.x, sl.y);
        ctx.scale(1.4, 1.4);
        ctx.translate(-sl.x, -sl.y);
        transcript(ctx, P, T);
        lead(ctx, P, sl);
        ctx.restore();
    }

    function stageBlock(ctx, P, i, l) {
        if (l < 300) return stageHeader(ctx, P, i, Math.min(l * 3, 899));
        var tl = l - 300;
        if (i === ROUTE.length - 1) {
            if (tl < 72) return termCut(ctx, P, i, tl);
            return landCloseup(ctx, P, tl - 72);
        }
        return termCut(ctx, P, i, tl);
    }

    // ===========================================================================
    // hook (f 0–239): pain visuals only, no persona — a leaning tower of
    // feature blocks, a dependency graph greying out with duplicate pickers
    // marked ×3, then the seven-stage route with three tasks sliding into
    // place.
    // ===========================================================================
    function hookPile(ctx, P, f) {
        E.text(ctx, P, 'h', '功能一層疊一層，文件一份接一份。', 320, 52, { align: 'center' });
        for (var i = 0; i < 8; i++) {
            var k = E.backOut(E.prog(f, 4 + 7 * i, 16));
            if (k <= 0) continue;
            var x = 56 + 13 * i, y = 296 - 24 * i - 40 * (1 - k);
            E.fade(ctx, Math.min(1, k), function () { E.box(ctx, x, y, 156, 24, 4, P.panel, P.rule2, 1); });
        }
        E.text(ctx, P, 's', PROJECT, 32, 344, { fill: P.muted });
    }
    function hookDead(ctx, P, f) {
        E.text(ctx, P, 'h', '沒人引用的程式越來越多。', 320, 52, { align: 'center' });
        var nodes = [[136, 120], [136, 190], [136, 260], [276, 96], [276, 190], [276, 260]];
        nodes.forEach(function (n, i) {
            var grey = E.prog(f, 6 * i, 12) >= 1;
            E.box(ctx, n[0], n[1], 108, 20, 4, P.panel, grey ? P.faint : P.rule2, 1);
        });
        if (f >= 40) E.text(ctx, P, 'm', '×3', 431, 157, { align: 'center', fill: P.bad });
        E.text(ctx, P, 's', PROJECT, 32, 344, { fill: P.muted });
    }
    function hookRoute(ctx, P, f) {
        E.text(ctx, P, 'h', 'fankeel 替每個任務排一條工作流。', 320, 72, { align: 'center' });
        E.text(ctx, P, 'm', PROJECT, 40, 122, { fill: P.muted });
        ROUTE.forEach(function (s, i) {
            var k = E.expoOut(E.prog(f, 8 + 2 * i, 14));
            E.fade(ctx, k, function () { E.text(ctx, P, 'm', s, 240 + 52 * i, 122, { align: 'center', fill: P.st[s] }); });
        });
        var rows = [[159, 2], [209, 5], [259, 7]];
        rows.forEach(function (r, i) {
            var k = E.backOut(E.prog(f, 18 + 12 * i, 20));
            ROUTE.forEach(function (s, j) {
                if (j >= r[1]) return;
                E.circle(ctx, 240 + 52 * j, r[0] - 20, 7 * k, P.st[s]);
            });
        });
        E.fade(ctx, E.expoOut(E.prog(f, 60, 16)), function () {
            E.text(ctx, P, 'sub', 'survey 先找已經有的，audit 抓已經過時的引用。', 320, 318, { align: 'center' });
        });
    }
    function hook(ctx, P, f) {
        if (f < 80) return hookPile(ctx, P, f);
        if (f < 140) return hookDead(ctx, P, f - 80);
        return hookRoute(ctx, P, f - 140);
    }

    // ===========================================================================
    // outro (f 3096–3599): a route flash, the install lines, then the tagline.
    // ===========================================================================
    function outroRoute(ctx, P, o) {
        E.fade(ctx, E.expoOut(E.prog(o, 0, 24)), function () { E.text(ctx, P, 'hc', '一個任務，一條路線。', 320, 150, { align: 'center' }); });
        E.rail(ctx, P, ROUTE.length, 1);
    }
    function installLines(ctx, P, y0) {
        E.text(ctx, P, 'm', '$ ', 118, y0, { fill: P.muted });
        E.text(ctx, P, 'm', 'claude plugin marketplace add FanFantom9452/FanKeel', 134, y0, { fill: P.ink2 });
        E.text(ctx, P, 'm', '$ ', 118, y0 + 22, { fill: P.muted });
        E.text(ctx, P, 'm', 'claude plugin install fankeel@fankeel', 134, y0 + 22);
    }
    function outroInstall(ctx, P, o) {
        E.fade(ctx, E.expoOut(E.prog(o, 0, 24)), function () { E.text(ctx, P, 'h', 'fankeel', 320, 120, { align: 'center' }); });
        E.fade(ctx, E.expoOut(E.prog(o, 20, 20)), function () { installLines(ctx, P, 172); });
        E.fade(ctx, E.expoOut(E.prog(o, 48, 20)), function () { E.text(ctx, P, 'sub', '兩行指令，裝進 Claude Code。', 320, 210, { align: 'center' }); });
    }
    function outroTag(ctx, P, o) {
        E.fade(ctx, E.expoOut(E.prog(o, 20, 24)), function () { E.text(ctx, P, 'hc', '跟 AI 開發得再久，也不堆過時的引用和死程式。', 320, 160, { align: 'center' }); });
        E.fade(ctx, E.expoOut(E.prog(o, 40, 20)), function () { installLines(ctx, P, 239); });
        E.rail(ctx, P, ROUTE.length, 1);
    }
    function outro(ctx, P, o) {
        if (o < 84) return outroRoute(ctx, P, o);
        if (o < 204) return outroInstall(ctx, P, o - 84);
        return outroTag(ctx, P, o - 204);
    }

    function draw(ctx, f, P) {
        if (f < INTRO) return hook(ctx, P, f);
        if (f < OUTRO) {
            var i = Math.floor((f - INTRO) / PER);
            return stageBlock(ctx, P, i, f - INTRO - PER * i);
        }
        return outro(ctx, P, f - OUTRO);
    }

    var STILLS = [120, 390, 590, 798, 998, 1206, 1406, 1614, 1814, 2022, 2222, 2430, 2630, 2838, 3038, 3300];

    var TOUR_STAGES = {
        length: LENGTH,
        beats: ROUTE.map(function (s, i) { return { at: INTRO + PER * i, label: s, stage: s }; }).concat([{ at: OUTRO, label: 'end' }]),
        stills: STILLS,
        draw: draw,
    };
    E.register('stages', TOUR_STAGES);

    module.exports = { TOUR_STAGES: TOUR_STAGES, PRODUCES: PRODUCES };
})(typeof window !== 'undefined' ? window : globalThis, typeof module !== 'undefined' ? module : {});
