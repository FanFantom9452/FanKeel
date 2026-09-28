// assets/station/tour-reel-stages.js — the kinetic promo's seven stage
// shots, two bars (240 frames) each, one picture a stage drawn about the
// origin (the kit's stageFrame puts it at 470, 172): survey's radar finding
// what is there, design's two approaches and the one approved, plan's block
// split into three, build's lanes racing, verify's red flipped green,
// audit's stale page struck and stamped, land's scattered files swept into
// one clean tick. `beats` are the local frames something lands on, all on
// a beat (30 frames), for the score's plucks.
(function (root, module) {
    'use strict';
    var E = root.tourEngine || require('./tour.js');
    var K = root.tourReelKit || require('./tour-reel-kit.js');
    var t = K.t;

    function card(ctx, P, x, y, w, h, stroke) { E.box(ctx, x, y, w, h, 8, P.panel, stroke || P.rule2, 1.5); }
    function bars(ctx, P, x, y, w, n) {
        for (var i = 0; i < n; i++) E.box(ctx, x, y + i * 12, w * (i === n - 1 ? 0.6 : 1), 5, 2.5, P.rule2);
    }

    // survey: the sweep turns from 30; each find lights when it passes.
    var FINDS = [[60, 70, 'db/warehouse'], [90, 50, 'api/transfer'], [120, 88, 'docs/stock.md']];
    function survey(ctx, P, l, c) {
        var k = E.backOut(E.prog(l, 0, 24));
        [36, 66, 96].forEach(function (r, i) { E.circle(ctx, 0, 0, r * E.backOut(E.prog(l, 6 + i * 5, 20)), null, P.rule2, 1.5); });
        E.line(ctx, [[-104 * k, 0], [104 * k, 0]], P.rule, 1);
        E.line(ctx, [[0, -104 * k], [0, 104 * k]], P.rule, 1);
        var a = (l - 30) * 0.08;
        if (l > 30) {
            for (var j = 0; j < 8; j++) {
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.arc(0, 0, 100, a - (j + 1) * 0.07, a - j * 0.07);
                ctx.closePath();
                ctx.fillStyle = K.hex(c, 0.32 * (1 - j / 8));
                ctx.fill();
            }
            E.line(ctx, [[0, 0], [Math.cos(a) * 100, Math.sin(a) * 100]], c, 2);
        }
        FINDS.forEach(function (fd, i) {
            var at = fd[0], ang = (at - 30) * 0.08, x = Math.cos(ang) * fd[1], y = Math.sin(ang) * fd[1];
            var p = E.backOut(E.prog(l, at, 12));
            if (!(p > 0)) return;
            E.circle(ctx, x, y, 5 * p, c);
            K.ring(ctx, x, y, 26, c, l, at, 28, 2);
            E.fade(ctx, E.prog(l, at + 4, 10), function () {
                var lx = x + (x < 0 ? -10 : 10);
                E.text(ctx, P, 'nm', fd[2], lx, y + 4 + (i === 1 ? -10 : 0), { align: x < 0 ? 'right' : 'left', fill: P.ink });
            });
        });
    }

    // design: A up at 30, B at 60; at 120 B drops away and A takes the
    // middle; the tick and 已核准 land at 150.
    function design(ctx, P, l, c) {
        var go = K.inOut(E.prog(l, 120, 24));
        [['A', 30, -52], ['B', 60, 52]].forEach(function (d, i) {
            var k = E.backOut(E.prog(l, d[1], 18));
            if (!(k > 0)) return;
            var x = d[2] + (i ? go * 40 : -go * d[2]), y = (1 - k) * 90 + (i ? go * 120 : 0), sc = i ? 1 - go * 0.4 : 1 + go * 0.18;
            E.fade(ctx, i ? 1 - go : 1, function () {
                ctx.save();
                ctx.translate(x, y);
                ctx.scale(sc, sc);
                ctx.rotate((1 - k) * (i ? 0.3 : -0.3));
                card(ctx, P, -44, -62, 88, 124, i ? P.rule2 : c);
                E.text(ctx, P, 'big', d[0], 0, -24, { align: 'center', fill: i ? P.muted : c, size: 28 });
                bars(ctx, P, -30, -4, 60, 4);
                ctx.restore();
            });
        });
        var tk = E.bounceOut(E.prog(l, 150, 20));
        if (tk > 0) {
            E.circle(ctx, 40, -60, 17 * E.backOut(E.prog(l, 150, 12)), c);
            E.tick(ctx, 32, -60, 1.1, tk, P.ground, 3);
            K.ring(ctx, 40, -60, 50, c, l, 150, 30, 3);
        }
        K.popText(ctx, P, 'pill', t(P, 'design.ok'), 0, 104, 150, l, 150, { fill: c });
    }

    // plan: one block at 0, split at 60 into A and B side by side and C
    // under A; 同時 over A and B at 120, C's dashed wait line at 150.
    var TILES = [[-58, -40], [58, -40], [-58, 52]];
    function plan(ctx, P, l, c) {
        var k = E.backOut(E.prog(l, 0, 20)), sp = K.inOut(E.prog(l, 60, 26));
        if (sp <= 0) {
            ctx.save();
            ctx.scale(k, k);
            E.box(ctx, -110, -80, 220, 160, 10, K.hex(c, 0.22), c, 2);
            bars(ctx, P, -80, -40, 160, 6);
            ctx.restore();
        }
        ['A', 'B', 'C'].forEach(function (n, i) {
            if (!(sp > 0)) return;
            var x = E.lerp(0, TILES[i][0], sp), y = E.lerp(0, TILES[i][1], sp), w = E.lerp(220, 100, sp), h = E.lerp(160, 66, sp);
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(Math.sin(sp * Math.PI) * (i - 1) * 0.25);
            E.box(ctx, -w / 2, -h / 2, w, h, 10, K.hex(c, i === 2 ? 0.1 : 0.22), c, 2);
            E.fade(ctx, E.prog(l, 80, 10), function () {
                E.text(ctx, P, 'mi', n, -w / 2 + 12, -h / 2 + 22, { fill: c });
                E.fitText(ctx, P, 's', t(P, 'plan.' + n.toLowerCase()), 0, 12, w - 16, { align: 'center', middle: true, fill: P.ink });
            });
            ctx.restore();
        });
        var par = E.expoOut(E.prog(l, 120, 18));
        if (par > 0) {
            E.line(ctx, [[-100, -84], [-100, -92], [-100 + 200 * par, -92], [-100 + 200 * par, -84]], c, 2);
            K.popText(ctx, P, 'pill', t(P, 'par'), 0, -108, 120, l, 120, { fill: c });
        }
        var wt = E.expoOut(E.prog(l, 150, 20));
        if (wt > 0) {
            E.line(ctx, [[-58, -7], [-58, E.lerp(-7, 19, wt)]], P.muted, 1.5, [4, 4]);
            E.fade(ctx, wt, function () { E.fitText(ctx, P, 's', t(P, 'waits'), 12, 57, 90, { middle: true }); });
        }
    }

    // build: lanes A and B race from 30 to 150; C queues until A is done
    // and runs 150–215. Each bar shows its percent.
    var LANES = [['A', 30, 150, 0], ['B', 30, 140, 1.7], ['C', 150, 215, 3.1]];
    function build(ctx, P, l, c) {
        LANES.forEach(function (ln, i) {
            var y = -56 + i * 52, k = E.expoOut(E.prog(l, i * 8, 20));
            if (!(k > 0)) return;
            ctx.save();
            ctx.translate((1 - k) * 160, y);
            E.text(ctx, P, 'mi', ln[0], -118, 5, { fill: c });
            E.box(ctx, -96, -8, 206, 16, 8, P.inset);
            var p = E.prog(l, ln[1], ln[2] - ln[1]), q = p <= 0 ? 0 : Math.min(1, p + 0.04 * Math.sin(l * 0.3 + ln[3]) * (1 - p));
            if (q > 0) E.box(ctx, -96, -8, 206 * q, 16, 8, c);
            if (p >= 1) E.tick(ctx, 116, 0, 0.7, E.bounceOut(E.prog(l, ln[2], 14)), c, 2.4);
            else if (p > 0) E.text(ctx, P, 'nm', Math.round(q * 100) + '%', 116, 4, { fill: P.ink });
            else E.fade(ctx, 0.6 + 0.4 * Math.sin(l * 0.25), function () { E.fitText(ctx, P, 's', t(P, 'build.queued'), 116, 0, 64, { middle: true }); });
            ctx.restore();
        });
        K.ring(ctx, 110, -56, 40, c, l, 150, 26, 2);
    }

    // verify: a light a row — row 1 green at 30, row 2 red at 60 (with a
    // shake) flipped green at 120, row 3 green at 150.
    var ROWS = [['verify.r1', 30, 0], ['verify.r2', 60, 120], ['verify.r3', 150, 0]];
    function verify(ctx, P, l, c) {
        ROWS.forEach(function (r, i) {
            var y = -54 + i * 54, k = E.expoOut(E.prog(l, i * 8, 18));
            if (!(k > 0)) return;
            var sh = r[2] ? K.shake(l, r[1], 6) : [0, 0];
            ctx.save();
            ctx.translate(sh[0] + (1 - k) * 120, y);
            E.box(ctx, -120, -20, 240, 40, 8, P.panel, P.rule2, 1);
            E.fitText(ctx, P, 's', t(P, r[0]), -80, 0, 190, { middle: true, fill: P.ink2 });
            var on = E.backOut(E.prog(l, r[1], 12));
            if (on > 0) {
                var flip = r[2] ? E.prog(l, r[2], 16) : 1, red = r[2] && flip < 0.5;
                var sx = r[2] ? Math.abs(Math.cos(flip * Math.PI)) : 1;
                ctx.save();
                ctx.translate(-100, 0);
                ctx.scale(Math.max(0.02, sx) * on, on);
                E.circle(ctx, 0, 0, 11, red ? P.bad : P.good);
                if (red) {
                    E.line(ctx, [[-4, -4], [4, 4]], P.ground, 2.4);
                    E.line(ctx, [[4, -4], [-4, 4]], P.ground, 2.4);
                } else E.tick(ctx, -6, 0, 0.8, E.bounceOut(E.prog(l, r[2] ? r[2] + 8 : r[1], 12)), P.ground, 2.4);
                ctx.restore();
                K.ring(ctx, -100, 0, 34, red ? P.bad : P.good, l, r[2] && flip >= 0.5 ? r[2] + 8 : r[1], 24, 2);
            }
            ctx.restore();
        });
    }

    // audit: three pages fan in at 30; the first is struck at 60 and
    // stamped 過時 at 90; the second goes grey as 已歸檔 at 120; the first
    // flies to TODO at 150.
    var PAGES = ['stock.md', 'plan.md', 'api.md'];
    function audit(ctx, P, l, c) {
        var fan = E.backOut(E.prog(l, 30, 22)), fly = K.inOut(E.prog(l, 150, 30));
        E.fade(ctx, E.prog(l, 150, 10), function () {
            var k = E.backOut(E.prog(l, 150, 14));
            E.box(ctx, 60, 76, 80 * k, 26, 6, null, c, 1.5);
            E.text(ctx, P, 'mi', 'TODO', 100, 94, { align: 'center', fill: c });
        });
        for (var i = PAGES.length - 1; i >= 0; i--) {
            var ang = (i - 1) * 0.18 * fan, x = (i - 1) * 64 * fan, y = (1 - E.expoOut(E.prog(l, 20 + i * 4, 20))) * 180;
            var grey = i === 1 ? E.prog(l, 120, 12) : 0;
            if (i === 0) { x = E.lerp(x, 100, fly); y = E.lerp(y, 89, fly); ang *= 1 - fly; }
            var sc = i === 0 ? 1 - fly * 0.72 : 1;
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(ang);
            ctx.scale(sc, sc);
            card(ctx, P, -46, -60, 92, 120, i === 0 && l >= 60 ? P.bad : P.rule2);
            E.text(ctx, P, 'nm', PAGES[i], -36, -40, { fill: grey ? P.faint : P.ink });
            bars(ctx, P, -36, -22, 72, 5);
            if (i === 0) {
                var st = E.expoOut(E.prog(l, 60, 14));
                if (st > 0) E.line(ctx, [[-40, -6], [-40 + 80 * st, 2]], P.bad, 3);
                K.popText(ctx, P, 'pill', t(P, 'audit.stale'), 0, 34, 80, l, 90, { fill: P.bad, from: 3 });
            }
            if (grey > 0) E.fade(ctx, grey, function () { E.fitText(ctx, P, 's', t(P, 'audit.archived'), 0, 38, 80, { align: 'center', middle: true }); });
            ctx.restore();
        }
    }

    // land: six files drift about until 90, snap into a column, and at 150
    // sweep into one circle that ticks; 工作樹乾淨 under it from 165.
    var FILES = ['stock.js', 'transfer.js', 'stock.md', 'api.md', 'ui.jsx', 'plan.md'];
    function land(ctx, P, l, c) {
        var snap = E.expoOut(E.prog(l, 90, 24)), gone = K.inOut(E.prog(l, 150, 22));
        FILES.forEach(function (n, i) {
            var k = E.backOut(E.prog(l, i * 5, 18));
            if (!(k > 0) || gone >= 1) return;
            var dx = (K.rnd(i) - 0.5) * 220 + Math.sin(l * 0.05 + i) * 10, dy = (K.rnd(i + 9) - 0.5) * 170 + Math.cos(l * 0.06 + i * 2) * 8;
            var x = E.lerp(E.lerp(dx, -40, snap), 0, gone), y = E.lerp(E.lerp(dy, -80 + i * 30, snap), 0, gone);
            var ang = (K.rnd(i + 20) - 0.5) * 0.7 * (1 - snap);
            E.fade(ctx, 1 - gone, function () {
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(ang);
                ctx.scale(k * (1 - gone * 0.8), k * (1 - gone * 0.8));
                E.box(ctx, -52, -11, 104, 22, 6, P.panel, P.rule2, 1);
                E.text(ctx, P, 'nm', n, -42, 4, { fill: P.ink2 });
                ctx.restore();
            });
        });
        var ok = E.backOut(E.prog(l, 165, 16));
        if (ok > 0) {
            E.circle(ctx, 0, -10, 34 * ok, P.good);
            E.tick(ctx, -14, -10, 1.8, E.bounceOut(E.prog(l, 170, 16)), P.ground, 4);
            K.ring(ctx, 0, -10, 90, P.good, l, 165, 34, 4);
            K.popText(ctx, P, 'ui', t(P, 'land.clean'), 0, 50, 200, l, 180, { from: 1.6 });
        }
    }

    var SHOTS = [
        { name: 'survey', pic: survey, beats: [0, 30, 60, 90, 120] },
        { name: 'design', pic: design, beats: [0, 30, 60, 120, 150] },
        { name: 'plan', pic: plan, beats: [0, 60, 120, 150] },
        { name: 'build', pic: build, beats: [0, 30, 150, 210] },
        { name: 'verify', pic: verify, beats: [0, 30, 60, 120, 150] },
        { name: 'audit', pic: audit, beats: [0, 30, 60, 90, 120, 150] },
        { name: 'land', pic: land, beats: [0, 90, 150, 180] },
    ].map(function (s, i) {
        return { name: s.name, len: 240, beats: s.beats, draw: function (ctx, P, l) { K.stageFrame(ctx, P, i, l, s.pic); } };
    });

    module.exports = { SHOTS: SHOTS };
    if (typeof window !== 'undefined') root.tourReelStages = module.exports;
})(typeof window !== 'undefined' ? window : globalThis, typeof module !== 'undefined' ? module : {});
