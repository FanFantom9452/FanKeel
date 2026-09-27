// assets/station/tour-stages.js — video 2, The stages (2:15, 8100 frames):
// a 300-frame prelude, the seven stages 960 frames each, a 1080-frame outro.
// Each stage: its name in its colour, a tagline, a scene, and — from local
// frame 720 — the line lib/stages.js STAGES[].produces gives it, word for word.
// The storyboard is the `video-stages` block of
// .fankeel/build/2026-09-27-tour/mockup.html; coordinates are its 640x360
// viewBox. The outro's numbers are tourEngine.SESSION, the quick start's.
(function (root, module) {
    'use strict';
    var E = root.tourEngine || require('./tour.js');
    var S = E.SESSION;

    var INTRO = 300, PER = 960, OUTRO = 7020;
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

    // survey — a scan band sweeps the tree (linear 360); a row lights once the
    // band has passed it; three readers split off (expo-out 30, 6 apart, from
    // local 220 = f 520); their lines meet in survey.md (expo-out 30), written
    // a line every 8 frames.
    // Re-timed from the stills: the scan starts at local 213 so the f 700 still
    // has the band on tests/. The note puts the merge at f 900 (local 600), but
    // the f 700 still already shows survey.md with all six lines written, so
    // the merge starts at local 300 (f 600) and the last line is out by local
    // 378, before the still.
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
            // Lit once the 16-unit band has passed below the row: the f 700
            // still has the band over tests/ and tests/ not yet lit.
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

    // design — three cards fall left to right (expo-out 30, 12 apart); at
    // local 300 (f 1560) the gate box pops (back-out 24) and its check lands
    // (bounce-out 30).
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
    // rows (linear, 10 each, from local 120); file capsules drop into three
    // columns, never one file in two (expo-out 24, 6 apart).
    // Re-timed from the still: the capsules start at local 347, so at the
    // f 2600 still (local 380) the last one started 3 frames ago and is still
    // falling, about half faded in, as the storyboard draws it (opacity .45).
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
            // mockup.html:337 draws the falling capsule's landing guide as a dashed line (M389 210V236)
            if (i === CAPS.length - 1 && k < 1) E.line(ctx, [[c[0] + 53, y + 36], [c[0] + 53, c[1] + 62]], P.faint, 1, [3, 4]);
            E.fade(ctx, k, function () {
                E.box(ctx, c[0], y, 106, 24, 5, P.inset);
                E.text(ctx, P, 'm', c[2], c[0] + 8, y + 17);
            });
        });
    }

    // build — three implementers move along their lanes (linear), leaving a
    // commit dot every 40 units; each that reaches the end gets the reviewer's
    // diamond turned 90° (expo-out 20), a check (bounce-out 30), and its ledger
    // row turns done. Speeds put lane 1 at the end and lanes 2 and 3 at 282
    // and 202 at the f 3560 still.
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

    // verify — each row: the claim (expo-out 24), an arrow (expo-out 16), the
    // evidence typed 2 frames a character, then a check (bounce-out 30); rows
    // 150 frames apart, so the third check is landing at the f 4520 still.
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

    // audit — two tool pills light, each page's untrue line is marked
    // (expo-out 18) and struck (linear 20), a line pulls it right (expo-out
    // 30), and the list item pops (back-out 20). Page 2 runs 90 frames later.
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

    // land — the suite bar fills and turns green (expo-out 40); the branch
    // arcs back into main (expo-out 36) and the merge rings (back-out 20); a
    // light band rewrites map.md top to bottom (linear 90), the "rewritten"
    // pill fading in as the band starts.
    // Re-timed from the still: the f 6440 still (local 380) shows the band
    // mid-page, its lower edge at y 190, beside a green suite and a ringed
    // merge, so the band starts at local 346 (lower edge 190 at local ~380)
    // rather than right after the merge.
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

    function stage(ctx, P, i, l) {
        var s = E.ROUTE[i], c = P.st[s];
        E.fade(ctx, 1 - E.expoIn(E.prog(l, PER - 12, 12)), function () {
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

    function prelude(ctx, P, f) {
        var t = E.expoOut(E.prog(f, 20, 36)) * (1 - E.expoIn(E.prog(f, 276, 12)));
        E.fade(ctx, t, function () {
            E.text(ctx, P, 'hc', 'The stages', 320, 150 + 10 * (1 - t), { align: 'center' });
            E.text(ctx, P, 'sub', 'Seven stops on one route, from a question to a landed change.', 320, 180, { align: 'center' });
        });
        var r = E.expoOut(E.prog(f, 90, 60));
        if (r > 0) E.line(ctx, [[110, 330], [E.lerp(110, 530, r), 330]], P.rule2, 5);
        E.ROUTE.forEach(function (s, i) {
            E.circle(ctx, 110 + 70 * i, 330, 6 * E.backOut(E.prog(f, 120 + 12 * i, 20)), P.ground, P.rule2, 1.5);
        });
    }

    // outro — all seven rail dots lit; copies of them rise and become the
    // bars, widths the stages' real durations (expo-out 48 from local 60); the
    // three numbers count up (expo-out 45 from local 120); the last 300 frames
    // are still.
    // Held to the still: the f 7560 still keeps the route rail at the bottom,
    // every dot lit (its rail is data-at 7), under the bars, so the rail stays
    // rather than fading out as the dots rise.
    function outro(ctx, P, o) {
        var t = E.expoOut(E.prog(o, 0, 24));
        E.fade(ctx, t, function () { E.text(ctx, P, 'hc', 'One real task, start to land', 320, 80, { align: 'center' }); });
        E.rail(ctx, P, 7, 1);
        var k = E.expoOut(E.prog(o, 60, 48));
        if (k < 1) {
            var R = E.barRects(60, 520);
            E.ROUTE.forEach(function (s, i) {
                E.box(ctx, E.lerp(110 + 70 * i - 6, R[i][0], k), E.lerp(324, 116, k), E.lerp(12, R[i][1], k), E.lerp(12, 24, k),
                    E.lerp(6, R[i][1] < 10 ? 1 : 2, k), P.st[s]);
            });
        } else E.bars(ctx, P, 60, 116, 520, 24, 162, 1);
        if (o < 120) return;
        var c = E.expoOut(E.prog(o, 120, 45));
        E.stats(ctx, P, [[200, E.fmtSpan(S.total * c), 'start to land'], [320, E.fmtUsd(S.usd * c), 'spent'], [440, String(Math.round(S.agents * c)), 'agents']], 226, 248);
    }

    function draw(ctx, f, P) {
        if (f < INTRO) return prelude(ctx, P, f);
        if (f < OUTRO) {
            var i = Math.floor((f - INTRO) / PER);
            return stage(ctx, P, i, f - INTRO - PER * i);
        }
        return outro(ctx, P, f - OUTRO);
    }

    var TOUR_STAGES = {
        length: 8100,
        beats: E.ROUTE.map(function (s, i) { return { at: INTRO + PER * i, label: s, stage: s }; }).concat([{ at: OUTRO, label: 'end' }]),
        stills: [700, 1650, 2600, 3560, 4520, 5480, 6440, 7560],
        draw: draw,
    };
    E.register('stages', TOUR_STAGES);

    module.exports = { TOUR_STAGES: TOUR_STAGES, PRODUCES: PRODUCES };
})(typeof window !== 'undefined' ? window : globalThis, typeof module !== 'undefined' ? module : {});
