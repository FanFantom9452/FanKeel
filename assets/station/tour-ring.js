// assets/station/tour-ring.js: the 30-second film, v3. The same shots as
// promo30 (tour-keel.js: its right side, pills, statusline and stripe
// wipe, shared through timeline(LEFT)), with the hull swapped for the
// honeycomb ring: the task at the centre, one load-bearing cell set
// against it per approved stage, and land sealing the ring. Spec:
// .fankeel/build/2026-09-29-promo30-v3/concept-ring.md; styleframes:
// mockup-ring.html beside it. The styleframes are 1280x720; the frame is
// 640x360, so every position and size below is the styleframe's halved.
(function (root, module) {
    'use strict';
    var E = root.tourEngine || require('./tour.js');
    var K = root.tourReelKit || require('./tour-reel-kit.js');
    var V2 = root.tourPromo30;
    if (!V2) {
        var keel = require('./tour-keel.js');
        V2 = { timeline: keel.timeline, C: keel.C, S: keel.S, helpers: keel.helpers };
    }

    var C = V2.C, S = V2.S, h = V2.helpers;
    var W = E.W, H = E.H;
    var t = h.t, eo = h.eo, bo = h.bo, txt = h.txt, measure = h.measure, group = h.group, panel = h.panel;

    // The captions are v1's (tour-reel-kit.js), verbatim; the ring's own
    // labels beside them. v2's hook.nokeel and keel lines are not used.
    ['hook.cap', 'route.h', 'outro.tag'].concat(E.ROUTE.map(function (s) { return 'pr.' + s; })).forEach(function (k) {
        S[k] = K.S[k];
    });
    S['ring.task'] = { zh: '任務', en: 'task' };
    S['ring.seal'] = { zh: '封環', en: 'seal' };
    S['ring.from'] = { zh: '從 design 來', en: 'from design' };
    S['ring.evi'] = { zh: '證據', en: 'evidence' };
    S['ring.stale'] = { zh: '過期', en: 'STALE' };

    var HATCH = C.keelMid, TINT = C.keelTint;

    // ---- hex geometry (mockup-ring-gen.js) --------------------------------
    var S3 = Math.sqrt(3), RAD = Math.PI / 180;
    var POINTY = [-90, -30, 30, 90, 150, 210];
    // stage i's cell sits at ANG[i] round the task, clockwise from lower
    // left, verify facing the cards
    var ANG = [120, 180, 240, 300, 0, 60];
    function at(c, r, a) { return [c[0] + r * Math.cos(a * RAD), c[1] + r * Math.sin(a * RAD)]; }
    function hexPts(c, r) { return POINTY.map(function (a) { return at(c, r, a); }); }
    function flower(c, R) { return [c].concat(ANG.map(function (a) { return at(c, S3 * R, a); })); }
    // the ring's outer edge: 18 walls, three per ring cell, clockwise
    function sealPts(c, R) {
        var out = [];
        [0, 60, 120, 180, 240, 300].forEach(function (th) {
            var q = at(c, S3 * R, th);
            out.push(at(q, R, th - 30), at(q, R, th + 30), at(q, R, th + 90));
        });
        return out;
    }
    // the convex outline: 12 outer tips (the small mark)
    function hull12(c, R) {
        var out = [];
        [0, 60, 120, 180, 240, 300].forEach(function (th) {
            var q = at(c, S3 * R, th);
            out.push(at(q, R, th - 30), at(q, R, th + 30));
        });
        return out;
    }
    function poly(ctx, pts) {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
    }
    function hex(ctx, c, r, fill, stroke, lw, dash) {
        poly(ctx, hexPts(c, r));
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) {
            ctx.strokeStyle = stroke;
            ctx.lineWidth = lw || 1;
            ctx.lineJoin = 'round';
            ctx.setLineDash(dash || []);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }
    // A closed polygon drawn to a fraction u of its perimeter from vertex 0.
    function partial(pts, u) {
        var n = pts.length, seg = [], total = 0, k;
        for (k = 0; k < n; k++) {
            var a = pts[k], b = pts[(k + 1) % n], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
            seg.push(d);
            total += d;
        }
        var left = total * Math.min(1, u), out = [pts[0]];
        for (k = 0; k < n && left > 0; k++) {
            var p = pts[k], q = pts[(k + 1) % n], f = Math.min(1, left / seg[k]);
            out.push([E.lerp(p[0], q[0], f), E.lerp(p[1], q[1], f)]);
            left -= seg[k];
        }
        return out;
    }

    // ---- the ring on the stage ----------------------------------------------
    var R0 = 36, HOME = [150, 163], DROP = [380, 160];
    var RDK = 61 / 72, SWK = 4 / 36;
    function geo(c, R) {
        var CL = flower(c, R);
        return {
            c: c, R: R, CL: CL,
            // the midpoint of one of cell i's walls, and a point just outside it
            wall: function (i, phi) { return at(CL[i + 1], S3 * R / 2, phi); },
            out: function (i, phi, d) { return at(at(CL[i + 1], S3 * R / 2, phi), d == null ? 6 : d, phi); },
        };
    }
    var G = geo(HOME, R0);

    // "0N name": the number in mono, the name in the UI face, centred.
    function cellLabel(ctx, P, j, x, y, fill, lit) {
        var num = '0' + (j + 1), name = ' ' + E.ROUTE[j];
        var nw = measure(ctx, P, num, 6, lit ? '700' : '400', true), mw = measure(ctx, P, name, 7, '600');
        var x0 = x - (nw + mw) / 2;
        txt(ctx, P, num, x0, y, { size: 6, weight: lit ? '700' : '400', mono: true, fill: fill });
        txt(ctx, P, name, x0 + nw, y, { size: 7, weight: '600', fill: fill });
    }

    // ---- the plates: the product each cell holds (mockup-ring's .pl) --------
    // Drawn in the styleframe's CSS pixels, 80 wide, scaled by s about the
    // bottom centre (x, y), or the centre when o.mid.
    var PLATE_H = { map: 74, mock: 54, plan: 59, build: 66, verify: 72, stale: 55 };
    var KIND = ['map', 'mock', 'plan', 'build', 'verify', 'stale'];
    function okDot(ctx, x, y, r, k) {
        if (!(k > 0)) return;
        E.circle(ctx, x, y, r * k, C.pass);
        E.tick(ctx, x - r * 0.5, y, r * 0.066 * k, 1, C.card, r * 0.3);
    }
    function bar(ctx, x, y, w, hh) { E.box(ctx, x, y, w, hh, hh / 2, '#DCE1E7'); }
    function plate(ctx, P, kind, x, y, s, o) {
        o = o || {};
        var ph = PLATE_H[kind];
        group(ctx, x, y, s, (o.rot || 0) * RAD, function () {
            ctx.translate(-40, o.mid ? -ph / 2 : -ph);
            panel(ctx, 80, ph, { r: 6, blur: 6, dy: 3 });
            var head = function (s2, fill, zh) { txt(ctx, P, s2, 6, 17, { size: 12, weight: '700', mono: !zh, fill: fill || C.ink, maxW: 68 }); };
            if (kind === 'map') {
                head('map.md');
                [1, 0.6, 0.72].forEach(function (w, r) {
                    bar(ctx, 6, 30 + r * 16 + 3, 54 * w, 6);
                    okDot(ctx, 68, 30 + r * 16 + 6, 6, 1);
                });
            } else if (kind === 'mock') {
                for (var d = 0; d < 3; d++) E.circle(ctx, 7 + d * 7, 7, 2, C.line);
                E.box(ctx, 4, 12, 72, 24, 4, null, C.keel, 2);
                E.box(ctx, 6, 14, 68, 20, 3, C.signalTint);
                E.fade(ctx, 0.8, function () { E.box(ctx, 10, 18, 40, 4, 2, C.ink); });
                E.box(ctx, 5, 38, 33, 12, 3, '#E3E7EB');
                E.box(ctx, 42, 38, 33, 12, 3, '#E3E7EB');
            } else if (kind === 'plan') {
                head('plan.md');
                ['A', 'B'].forEach(function (g, k) {
                    var x0 = 6 + k * 36.5;
                    E.box(ctx, x0, 28, 14, 13, 3, C.ink);
                    txt(ctx, P, g, x0 + 7, 38, { size: 9, weight: '700', mono: true, fill: C.card, align: 'center' });
                    bar(ctx, x0, 44, 31.5, 5);
                    bar(ctx, x0, 52, 31.5 * (k ? 0.55 : 0.7), 5);
                });
            } else if (kind === 'build') {
                head('reviewed', C.pass);
                var n = o.stamps == null ? 4 : o.stamps, tilt = [-6, 4, 3, -5];
                for (var q = 0; q < 4; q++) {
                    var k2 = q < n ? (o.stampK ? o.stampK[q] : 1) : 0;
                    if (!(k2 > 0)) continue;
                    var cx = 6 + (q % 2) * 36 + 16, cy = 28 + Math.floor(q / 2) * 20 + 8;
                    E.fade(ctx, Math.min(1, k2 * 2), function () {
                        group(ctx, cx, cy, E.lerp(2, 1, E.expoOut(k2)), tilt[q] * RAD, function () {
                            E.box(ctx, -15, -8, 30, 16, 4, C.card, C.pass, 2);
                            E.tick(ctx, -4, 0, 0.5, 1, C.pass, 1.8);
                        });
                    });
                }
            } else if (kind === 'verify') {
                head(t(P, 'ring.evi'), C.ink, P.lang === 'zh');
                [0.8, 0.62, 0.7].forEach(function (w, r) {
                    var y0 = 28 + r * 15;
                    if (r === 2) E.box(ctx, 5, y0, 70, 12, 3, C.passTint);
                    bar(ctx, 8, y0 + 3, 50 * w, 6);
                    okDot(ctx, 68, y0 + 6, 6, 1);
                });
            } else if (kind === 'stale') {
                group(ctx, 40, 27, 1, -5 * RAD, function () {
                    E.box(ctx, -34, -22, 68, 44, 6, null, C.fail, 3);
                    E.box(ctx, -30, -18, 60, 36, 4, null, C.fail, 1);
                    if (P.lang === 'zh') {
                        txt(ctx, P, t(P, 'ring.stale'), 0, 3, { size: 19, weight: '800', fill: C.fail, align: 'center' });
                        txt(ctx, P, 'S T A L E', 0, 14, { size: 7, weight: '700', mono: true, fill: C.fail, align: 'center' });
                    } else txt(ctx, P, 'STALE', 0, 6, { size: 15, weight: '800', mono: true, fill: C.fail, align: 'center' });
                });
            }
        });
    }
    var CELL_PLATE = 0.37;

    // The hatch of an archived cell: the tint, and mid stripes at 45°.
    function hatch(ctx, c, r) {
        ctx.save();
        poly(ctx, hexPts(c, r + 2));
        ctx.clip();
        ctx.fillStyle = TINT;
        ctx.fillRect(c[0] - r - 4, c[1] - r - 4, 2 * r + 8, 2 * r + 8);
        ctx.beginPath();
        for (var d = -2 * r; d <= 2 * r; d += 5) {
            ctx.moveTo(c[0] + d - r - 4, c[1] + r + 4);
            ctx.lineTo(c[0] + d + r + 4, c[1] - r - 4);
        }
        ctx.strokeStyle = HATCH;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }

    // The ring. st[j] = { slot, fill, arch, plate, stamps, stampK }, each
    // 0..1 (slot: the dashed ghost's alpha). o: seal (the ink's reach, 0..1),
    // ghostSeal, landLab, labels, plates, task (alpha of the task's words),
    // taskDy (the centre cell's fall), taskA (alpha of the whole task cell),
    // backing (paper fill under the seal), sealFrom (index the seal's ink
    // starts from), sealW (the seal's line width).
    function drawRing(ctx, P, g, st, o) {
        o = o || {};
        var c = g.c, R = g.R, CL = g.CL, RD = R * RDK, sw = R * SWK;
        var seal = sealPts(c, R);
        var labels = o.labels == null ? 1 : o.labels, plates = o.plates == null ? 1 : o.plates;
        if (o.backing) { poly(ctx, seal); ctx.fillStyle = C.paper; ctx.fill(); }
        if (o.ghostSeal > 0) E.fade(ctx, o.ghostSeal, function () {
            poly(ctx, seal);
            ctx.strokeStyle = C.faint;
            ctx.lineWidth = 1.5;
            ctx.lineJoin = 'round';
            ctx.setLineDash([3.5, 3.5]);
            ctx.stroke();
            ctx.setLineDash([]);
        });
        // the task, in ink
        var tc = [c[0], c[1] + (o.taskDy || 0)];
        if (o.taskA == null || o.taskA > 0) E.fade(ctx, o.taskA == null ? 1 : o.taskA, function () {
            hex(ctx, tc, RD, C.ink, C.ink, sw);
            var ta = o.task == null ? 1 : o.task;
            if (ta > 0) E.fade(ctx, ta, function () {
                var two = P.lang === 'zh';
                txt(ctx, P, t(P, 'ring.task'), tc[0], tc[1] + (two ? 1 : 4), { size: 12, weight: '700', fill: C.card, align: 'center', maxW: RD * 1.5 });
                if (two) txt(ctx, P, 'the task', tc[0], tc[1] + 12, { size: 6, mono: true, fill: C.faint, align: 'center' });
            });
        });
        for (var j = 0; j < 6; j++) {
            var s = st[j] || {}, q = CL[j + 1], fill = s.fill || 0, arch = s.arch || 0;
            var slot = s.slot == null ? 1 : s.slot;
            if (fill < 1 && slot > 0) {
                E.fade(ctx, slot, function () {
                    var k = E.backOut(Math.min(1, slot * 1.2));
                    hex(ctx, q, RD * Math.max(0.3, k), 'rgba(242,244,243,.6)', C.faint, 1, [2.5, 2.5]);
                    if (labels > 0) E.fade(ctx, labels, function () { cellLabel(ctx, P, j, q[0], q[1] + 3, C.faint, false); });
                });
            }
            if (fill > 0) {
                var sc = E.lerp(0.55, 1, E.backOut(Math.min(1, fill)));
                E.fade(ctx, Math.min(1, fill * 3), function () {
                    group(ctx, q[0], q[1], sc, 0, function () {
                        var o0 = [0, 0];
                        if (arch < 1) E.fade(ctx, 1 - arch, function () { hex(ctx, o0, RD, C.keel, C.keel, sw); });
                        if (arch > 0) E.fade(ctx, arch, function () {
                            hatch(ctx, o0, RD);
                            hex(ctx, o0, RD, null, HATCH, sw);
                        });
                    });
                    if (labels > 0) {
                        E.fade(ctx, labels * (1 - arch), function () { cellLabel(ctx, P, j, q[0], q[1] + 21, C.card, true); });
                        if (arch > 0) E.fade(ctx, labels * arch, function () {
                            cellLabel(ctx, P, j, q[0], q[1] + 1, C.keel, true);
                            txt(ctx, P, 'archived', q[0], q[1] + 11, { size: 6, mono: true, fill: C.mute, align: 'center' });
                        });
                    }
                });
                var pk = (s.plate == null ? 1 : s.plate) * plates;
                if (pk > 0) E.fade(ctx, Math.min(1, pk * 2), function () {
                    plate(ctx, P, KIND[j], q[0], q[1] + 11, CELL_PLATE * E.lerp(0.4, 1, E.backOut(Math.min(1, pk))), { stamps: s.stamps, stampK: s.stampK });
                });
            }
        }
        if (o.seal > 0) {
            var pts = seal.slice(o.sealFrom || 0).concat(seal.slice(0, o.sealFrom || 0));
            var run = o.seal >= 1 ? pts.concat([pts[0], pts[1]]) : partial(pts, o.seal);
            E.line(ctx, run, C.ink, o.sealW || R * 0.125);
            if (o.seal < 1) E.circle(ctx, run[run.length - 1][0], run[run.length - 1][1], (o.sealW || R * 0.125) * 0.9, C.ink);
        }
        // land is not a cell: it is the seal, named where the ring's left edge would close
        if (o.landLab > 0) E.fade(ctx, o.landLab, function () {
            var lx = CL[2][0] - S3 * R / 2 - 9, ly = CL[2][1];
            var num = '07', name = ' land', mw = measure(ctx, P, name, 7, '600');
            txt(ctx, P, name, lx, ly - 1, { size: 7, weight: '600', fill: C.faint, align: 'right' });
            txt(ctx, P, num, lx - mw, ly - 1, { size: 6, mono: true, fill: C.faint, align: 'right' });
            txt(ctx, P, t(P, 'ring.seal'), lx, ly + 8, { size: 6.5, weight: '500', fill: C.faint, align: 'right' });
        });
    }

    // The ✓ at a cell's wall: rays, a green disc, a tick; popped by k.
    function gate(ctx, x, y, k) {
        if (!(k > 0)) return;
        for (var n = 0; n < 8; n++) {
            var a = (n / 8) * Math.PI * 2 + Math.PI / 8, cc = Math.cos(a), d = Math.sin(a);
            E.line(ctx, [[x + 9 * cc * k, y + 9 * d * k], [x + 11 * cc * k, y + 11 * d * k]], C.pass, 1.5);
        }
        E.circle(ctx, x, y, 7 * k, C.pass, C.card, 1);
        E.tick(ctx, x - 3, y, 0.42 * k, E.prog(k, 0.4, 0.6), C.card, 1.5);
    }
    // The criterion bead: red with a cross, or green with a tick.
    function bead(ctx, x, y, green, k) {
        if (!(k > 0)) return;
        var r = 4.5 * k;
        E.circle(ctx, x, y, r, green ? C.pass : C.fail, C.card, 1);
        if (green) E.tick(ctx, x - 2, y, 0.27 * k, 1, C.card, 1.1);
        else {
            var d = r * 0.42;
            E.line(ctx, [[x - d, y - d], [x + d, y + d]], C.card, 1.3);
            E.line(ctx, [[x + d, y - d], [x - d, y + d]], C.card, 1.3);
        }
    }
    function bez(p0, p1, p2, p3, u) {
        var v = 1 - u;
        return [v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0],
            v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1]];
    }
    // A token's flight: a dotted trail from a card to just outside a wall
    // (gp, the ✓'s place), drawn to u; the token rides its head.
    function flight(ctx, P, f, u, o) {
        o = o || {};
        if (!(u > 0)) return;
        var end = at(f.gp, 6.5, f.phi), c2 = at(f.gp, 6.5 + f.k, f.phi), pts = [];
        var n = Math.max(1, Math.round(40 * Math.min(1, u)));
        for (var k = 0; k <= n; k++) pts.push(bez(f.from, f.c1, c2, end, Math.min(1, u) * k / n));
        var col = o.col || C.keelMid;
        E.fade(ctx, o.alpha == null ? 1 : o.alpha, function () {
            E.line(ctx, pts, col, o.w || 1.25, o.dash || [0.5, 4.5]);
            E.circle(ctx, f.from[0], f.from[1], 2, col);
        });
        if (u < 1 && o.token) o.token(pts[pts.length - 1], u);
    }

    // ---- the stages: when each token flies and lands ------------------------
    // launch, flight length, the card it leaves from, the curve's first
    // control point, the wall it enters by, the pull at the wall.
    var FLY = [
        { at: 28, len: 22, from: [350, 108], c1: [320, 236], phi: 60, d: 7, k: 55 },
        { at: 44, len: 22, from: [345, 125], c1: [280, 10], phi: 240, k: 50 },
        { at: 30, len: 22, from: [344, 151], c1: [300, 40], phi: 300, k: 40 },
        { at: 48, len: 24, from: [345, 121], c1: [300, 130], phi: 0, k: 45 },
        { at: 20, len: 22, from: [338, 98], c1: [300, 100], phi: 0, k: 35 },
        { at: 60, len: 22, from: [439, 189], c1: [350, 200], phi: 0, k: 40 },
        { at: 36, len: 14, from: [344, 92], c1: [300, 92], phi: 300, k: 30, cell: 4 },
    ];
    FLY.forEach(function (f, i) { f.gp = G.out(f.cell == null ? i : f.cell, f.phi, f.d == null ? 6 : f.d); f.land = f.at + f.len; });
    // build's plate gets its four stamps as the right side's land.
    var STAMPS = [94, 108, 132, 154];
    // the criterion: design's red card, the bead on 02's lower-left wall,
    // verify's ride over the top to 05's lower-right wall and green at 108.
    var CRIT = { from: [465, 245], c1: [300, 330], gp: G.out(1, 120, 6), phi: 120, k: 75, at: 112, len: 26 };
    var RIDE = { at: 84, len: 24 };
    var GREEN_AT = G.out(4, 60, 6);
    // the criterion's road: from 02's lower-left wall along the seal over
    // the top to 05's lower-right wall
    var ROAD = (function () {
        var a = G.wall(1, 120), b = G.wall(4, 60), c = G.c;
        var ang = function (p) { return Math.atan2(p[1] - c[1], p[0] - c[0]) / RAD; };
        var a0 = ang(a), norm = function (x) { var v = x; while (v <= a0) v += 360; return v; };
        var b1 = norm(ang(b));
        var mid = sealPts(c, G.R).map(function (p) { return { p: p, v: norm(ang(p)) }; })
            .filter(function (q) { return q.v < b1; }).sort(function (p, q) { return p.v - q.v; }).map(function (q) { return q.p; });
        return [CRIT.gp, a].concat(mid, [b, GREEN_AT]);
    }());
    // the seal starts and closes at 05's upper-right, where land's token lands
    var SEAL_FROM = (function () {
        var s = sealPts(G.c, G.R), g = FLY[6].gp, best = 0;
        s.forEach(function (p, k) { if (Math.hypot(p[0] - g[0], p[1] - g[1]) < Math.hypot(s[best][0] - g[0], s[best][1] - g[1])) best = k; });
        return best;
    }());
    var SEAL = { at: 48, len: 22 };
    var ARCH = { out: 96, len: 30 };
    var FOLDER = { x: 20, y: 52 };

    // How far stage i's own cell has filled at local frame l (0..1).
    function fillOf(i, l) { return E.prog(l, FLY[i].land, 14); }
    // The ring's cell states in stage shot i at local frame l.
    function states(i, l) {
        var st = [];
        for (var j = 0; j < 6; j++) {
            var s = { fill: j < i ? 1 : j === i ? fillOf(j, l) : 0 };
            if (j === i) s.plate = E.prog(l, FLY[j].land + 4, 14);
            if (j === 3) {
                s.stamps = 4;
                if (i === 3) s.stampK = STAMPS.map(function (a) { return E.prog(l, a, 9); });
            }
            if (j === 2 && i >= 5) {
                s.arch = i > 5 ? 1 : E.prog(l, ARCH.out + ARCH.len - 12, 16);
                s.plate = i > 5 ? 0 : 1 - E.prog(l, ARCH.out, 6);
            }
            st.push(s);
        }
        return st;
    }
    // Filled cells in stage shot i at local frame l: the artefact check's count.
    function filled(i, l) {
        return states(i, l).filter(function (s) { return s.fill >= 0.5; }).length;
    }

    function token(ctx, P, kind) {
        return function (p, u) {
            plate(ctx, P, kind, p[0], p[1], 0.2 * E.lerp(1.2, 0.8, u), { mid: true, rot: (1 - u) * 14 });
        };
    }

    // ---- LEFT.stage ------------------------------------------------------
    // stageShot calls it with n as the fifth argument; o (v4 only) moves
    // land's `git status: clean` pill to o.pillY.
    function ringStage(ctx, P, i, l, n, o) {
        var land = i === 6;
        var sealK = land ? E.prog(l, SEAL.at, SEAL.len) : 0;
        drawRing(ctx, P, G, states(i, l), {
            ghostSeal: sealK >= 1 ? 0 : 1,
            seal: land ? K.inOut(sealK) : 0,
            sealFrom: SEAL_FROM,
            landLab: land ? 1 - E.prog(l, SEAL.at - 6, 10) : 1,
        });
        // the criterion
        if (i === 1) {
            flight(ctx, P, CRIT, eo(l, CRIT.at, CRIT.len), { col: C.fail, alpha: 0.55, dash: [0.5, 5] });
            var rk = bo(l, CRIT.at + CRIT.len - 4, 12);
            bead(ctx, CRIT.gp[0], CRIT.gp[1], false, rk);
            if (rk > 0) E.fade(ctx, Math.min(1, rk), function () {
                txt(ctx, P, 'criterion', CRIT.gp[0] - 8, CRIT.gp[1] + 2.5, { size: 6.5, weight: '700', mono: true, fill: C.fail, align: 'right' });
                var cw = measure(ctx, P, 'criterion', 6.5, '700', true), xx = CRIT.gp[0] - 8 - cw - 5, yy = CRIT.gp[1];
                E.line(ctx, [[xx - 2, yy - 2], [xx + 2, yy + 2]], C.fail, 1.2);
                E.line(ctx, [[xx + 2, yy - 2], [xx - 2, yy + 2]], C.fail, 1.2);
            });
        } else if (i === 2 || i === 3) {
            bead(ctx, CRIT.gp[0], CRIT.gp[1], false, 1);
        } else if (i === 4) {
            var ride = K.inOut(E.prog(l, RIDE.at, RIDE.len)), green = l >= RIDE.at + RIDE.len;
            if (ride > 0) {
                var run = partialOpen(ROAD, ride);
                // the road it rode, red, turning green on arrival, then gone:
                // only the seal may run round the ring
                E.fade(ctx, 1 - E.prog(l, RIDE.at + RIDE.len + 8, 22), function () {
                    E.line(ctx, run, C.fail, 2.5);
                    if (green) E.fade(ctx, eo(l, RIDE.at + RIDE.len, 10), function () { E.line(ctx, run, C.pass, 2.5); });
                });
                var hd = run[run.length - 1];
                if (!green) {
                    bead(ctx, CRIT.gp[0], CRIT.gp[1], false, 0.3);
                    bead(ctx, hd[0], hd[1], false, 1);
                }
                if (l < RIDE.at + RIDE.len + 20) E.fade(ctx, 1 - E.prog(l, RIDE.at + RIDE.len, 20), function () {
                    txt(ctx, P, t(P, 'ring.from'), CRIT.gp[0] - 8, CRIT.gp[1] + 2.5, { size: 6.5, weight: '600', fill: C.fail, align: 'right' });
                });
            } else bead(ctx, CRIT.gp[0], CRIT.gp[1], false, 1);
            if (green) {
                // the table row that names it, tied to the bead
                var gl = eo(l, RIDE.at + RIDE.len, 16), row = [338, 196.5];
                var pts = [];
                for (var k = 0; k <= 20; k++) {
                    var u = gl * k / 20, v = 1 - u;
                    pts.push([v * v * row[0] + 2 * v * u * 280 + u * u * (GREEN_AT[0] + 5.5), v * v * row[1] + 2 * v * u * row[1] + u * u * (GREEN_AT[1] + 2.5)]);
                }
                E.line(ctx, pts, C.pass, 1, [2.5, 2.5]);
                E.circle(ctx, row[0], row[1], 2, C.pass);
                bead(ctx, GREEN_AT[0], GREEN_AT[1], true, bo(l, RIDE.at + RIDE.len, 12));
                K.ring(ctx, GREEN_AT[0], GREEN_AT[1], 14, C.pass, l, RIDE.at + RIDE.len, 22, 2);
            }
        } else if (i >= 5) {
            bead(ctx, GREEN_AT[0], GREEN_AT[1], true, 1);
        }
        // this stage's token, from the card to the wall, and the ✓ there
        var f = FLY[i];
        flight(ctx, P, f, eo(l, f.at, f.len), { token: land ? null : token(ctx, P, KIND[i]) });
        if (land) {
            // the pen's last stretch: speed ticks beside build's outer right wall
            var bw = G.wall(3, 0), tk = sealK > 0.55 ? Math.min(1, (sealK - 0.55) * 4) * (1 - E.prog(l, SEAL.at + SEAL.len, 20)) : 0;
            if (tk > 0) E.fade(ctx, 0.3 * tk, function () {
                [[5, 19], [9.5, 14], [14, 9]].forEach(function (s) { E.line(ctx, [[bw[0] + s[0], bw[1] + 4 - s[1]], [bw[0] + s[0], bw[1] + 4]], C.ink, 1.5); });
            });
            var close = SEAL.at + SEAL.len;
            gate(ctx, f.gp[0], f.gp[1], bo(l, close, 12));
            K.ring(ctx, f.gp[0], f.gp[1], 34, C.pass, l, close, 26, 2.5);
            // git status: clean, under the ring, as the terminal says it
            var gk = bo(l, 122, 12);
            if (gk > 0) group(ctx, G.c[0], o && o.pillY != null ? o.pillY : 272, gk, 0, function () {
                var s = 'git status: clean', w = measure(ctx, P, s, 7.5, '700', true) + 14;
                E.box(ctx, -w / 2, -8, w, 16, 8, C.ink);
                txt(ctx, P, s, 0, 2.6, { size: 7.5, weight: '700', mono: true, fill: C.termGood, align: 'center' });
            });
        } else {
            gate(ctx, f.gp[0], f.gp[1], bo(l, f.land, 12));
        }
        if (i === 5) archive(ctx, P, l);
    }
    // An open polyline drawn to a fraction u of its length.
    function partialOpen(pts, u) {
        var total = 0, k;
        for (k = 1; k < pts.length; k++) total += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
        var left = total * Math.min(1, u), out = [pts[0]];
        for (k = 1; k < pts.length && left > 0; k++) {
            var d = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]), f = Math.min(1, left / d);
            out.push([E.lerp(pts[k - 1][0], pts[k][0], f), E.lerp(pts[k - 1][1], pts[k][1], f)]);
            left -= d;
        }
        if (out.length < 2) out.push(pts[0]);
        return out;
    }
    // audit: cell 03's plan.md slides out into a small 99-archive/, top left
    function archive(ctx, P, l) {
        var k = E.prog(l, ARCH.out - 10, 14);
        if (!(k > 0)) return;
        var q = G.CL[3], fx = FOLDER.x, fy = FOLDER.y;
        E.fade(ctx, Math.min(1, k * 2), function () {
            group(ctx, fx + 30, fy + 16.5, E.lerp(0.7, 1, E.backOut(k)), 0, function () {
                ctx.translate(-30, -16.5);
                E.box(ctx, 0, 0, 26, 7, 3, C.keelDeep);
                E.box(ctx, 0, 4, 60, 29, 4, C.keelDeep);
            });
        });
        var p = K.inOut(E.prog(l, ARCH.out, ARCH.len));
        // the plate's road, dotted, from the cell to the folder
        var road = [];
        for (var n = 0; n <= 16; n++) {
            var u = n / 16, v = 1 - u, a = [q[0] - 10, q[1] - 15], c = [q[0] - 30, q[1] - 28], b = [fx + 30, fy + 18];
            road.push([v * v * a[0] + 2 * v * u * c[0] + u * u * b[0], v * v * a[1] + 2 * v * u * c[1] + u * u * b[1]]);
        }
        if (p > 0) E.fade(ctx, 0.9, function () { E.line(ctx, road.slice(0, Math.max(2, Math.round(p * 16) + 1)), C.faint, 1.25, [0.5, 4]); });
        if (p > 0) {
            var pos = road[Math.round(p * 16)];
            plate(ctx, P, 'plan', pos[0], pos[1] + 11 * (1 - p), E.lerp(CELL_PLATE, 0.36, p), { rot: -8 * p });
        }
        if (k > 0) E.fade(ctx, Math.min(1, k * 2), function () {
            group(ctx, fx + 30, fy + 16.5, E.lerp(0.7, 1, E.backOut(k)), 0, function () {
                ctx.translate(-30, -16.5);
                ctx.save();
                ctx.shadowColor = 'rgba(24,32,44,.35)';
                ctx.shadowBlur = 4;
                ctx.shadowOffsetY = -2;
                E.box(ctx, 0, 12, 60, 21, 4, C.keel);
                ctx.restore();
                txt(ctx, P, '99-archive/', 4, 29.5, { size: 6.5, weight: '700', mono: true, fill: C.card, maxW: 52 });
            });
        });
        K.ring(ctx, fx + 30, fy + 18, 26, C.keel, l, ARCH.out + ARCH.len, 24, 2);
    }

    // The one line and v1's product line under it, wiped in from the left.
    function stageSub(ctx, P, i, l) {
        var zh = P.lang === 'zh', x = 24, maxW = 430;
        [[E.ROUTE[i], 10, 320, zh ? 18 : 15, '700', C.ink], ['pr.' + E.ROUTE[i], 22, 340, zh ? 10 : 9, '600', C.keel]].forEach(function (r) {
            var k = eo(l, r[1], 24);
            if (!(k > 0)) return;
            ctx.save();
            ctx.beginPath();
            ctx.rect(x - 4, r[2] - 26, (maxW + 8) * k, 34);
            ctx.clip();
            txt(ctx, P, t(P, r[0]), x - (1 - k) * 16, r[2], { size: r[3], weight: r[4], fill: r[5], maxW: maxW });
            ctx.restore();
        });
    }

    // ---- LEFT.open: loose plates, nothing holding them ----------------------
    var LOOSE = [
        ['map', 66, 88, -12, 1, [-1, -0.4]], ['mock', 170, 64, 10, 1, [0.3, -1]], ['plan', 268, 107, -7, 0.95, [1, -0.3]],
        ['build', 88, 172, 16, 0.85, [-1, 0.5]], ['verify', 212, 180, -14, 0.65, [0.6, 0.8]], ['stale', 145, 246, 8, 0.45, [-0.4, 1]],
    ];
    function ringOpen(ctx, P, l) {
        LOOSE.forEach(function (c, n) {
            var k = E.prog(l, 4 + n * 7, 16);
            if (!(k > 0)) return;
            var L = Math.hypot(c[5][0], c[5][1]), ux = c[5][0] / L, uy = c[5][1] / L;
            var d = -10 + 0.11 * l, x = c[1] + ux * d, y = c[2] + uy * d;
            var rot = c[3] + Math.sin(l * 0.035 + n) * 2.5 + (1 - E.expoOut(k)) * 12;
            E.fade(ctx, c[4] * Math.min(1, k * 2), function () {
                // speed lines behind the drift
                E.fade(ctx, 0.8, function () {
                    for (var m = 0; m < 3; m++) {
                        var ox = -uy * (m - 1) * 6, oy = ux * (m - 1) * 6, back = 36 + (m % 2) * 5;
                        var x0 = x - ux * back + ox, y0 = y - uy * back + oy, len = 9 + m * 3;
                        E.line(ctx, [[x0, y0], [x0 - ux * len, y0 - uy * len]], C.faint, 1.5);
                    }
                });
                plate(ctx, P, c[0], x, y, 0.65 * E.lerp(0.6, 1, E.backOut(k)), { mid: true, rot: rot });
            });
        });
    }

    // ---- LEFT.drop: the task falls into the centre, the slots appear --------
    function ringDrop(ctx, P, l) {
        var mv = K.inOut(E.prog(l, 94, 26));
        var sh = K.shake(l, 28, 3);
        var c = [E.lerp(DROP[0], HOME[0], mv) + sh[0], E.lerp(DROP[1], HOME[1], mv) + sh[1]];
        var g = geo(c, R0);
        var fall = E.expoIn(E.prog(l, 10, 18)), dy = (1 - fall) * -230;
        var st = [];
        for (var j = 0; j < 6; j++) st.push({ slot: E.prog(l, 34 + j * 4, 12) });
        drawRing(ctx, P, g, st, {
            ghostSeal: E.prog(l, 58, 14), landLab: E.prog(l, 64, 12), taskDy: dy, taskA: E.prog(l, 8, 4),
        });
        // where it fell from: streaks above, gone after the landing
        var streak = l < 28 ? E.prog(l, 10, 6) : 1 - E.prog(l, 28, 24);
        if (streak > 0) E.fade(ctx, 0.6 * streak, function () {
            [-15, 0, 15].forEach(function (dx, k) {
                var y = c[1] - 125 - (k === 1 ? 5 : 0) + (l < 28 ? dy * 0.3 : 0);
                E.line(ctx, [[c[0] + dx, y], [c[0] + dx, y + (k === 1 ? 22 : 16)]], C.faint, 2);
            });
        });
        K.ring(ctx, c[0], c[1], 110, C.keel, l, 28, 30, 3);
    }

    // ---- LEFT.close: shot 10, whole ------------------------------------------
    // The plates leave, the sealed ring becomes the mark and settles into a
    // faint field of rings sealed before it; the mark locks up beside the
    // wordmark on the resolve (150), the install line types in under them,
    // and the tag.
    var FIELD = [
        [-60.45, 230.5, 0.8, 1], [-37.05, 352, 0.7, 0], [56.45, 271, 0.6, 0], [79.85, 392.5, 0.8, 1],
        [173.4, 311.5, 0.6, 0], [196.75, 433, 0.6, 1], [266.9, 230.5, 0.9, 1], [290.3, 352, 0.8, 0],
        [383.85, 271, 0.6, 1], [407.2, 392.5, 0.7, 1], [500.75, 311.5, 0.7, 1], [524.1, 433, 0.7, 1],
        [617.65, 352, 0.7, 1], [711.2, 271, 0.7, 1],
    ];
    var NEST = [150, 190], RN = 27;
    function fieldRing(ctx, c, R, a, alt) {
        var CL = flower(c, R), RD = R * (22.6 / 27);
        E.fade(ctx, a, function () {
            CL.forEach(function (q, k) {
                var col = k ? (alt ? '#DCE3F4' : TINT) : C.block;
                hex(ctx, q, RD, col, col, 3.05);
            });
            poly(ctx, sealPts(c, R));
            ctx.strokeStyle = C.faint;
            ctx.lineWidth = 1.85;
            ctx.lineJoin = 'round';
            ctx.stroke();
        });
    }
    // The mark: seven cells and one seal round them, no two arcs crossing.
    // 120 x 120 units like the styleframes' symbol; with `l` given, the
    // cells pop in from frame `at` (the task first) and the seal draws round
    // after them; `l == null` draws the whole mark.
    function markRing(ctx, x, y, size, col, l, at) {
        col = col || { a: C.keel, b: C.ink };
        group(ctx, x, y, size / 120, 0, function () {
            var c = [60, 60], Rr = 19.4, gap = 3.8, CL = flower(c, Rr);
            var sk = l == null ? 1 : eo(l, at + 22, 18);
            if (sk > 0) {
                var pts = sealPts(c, Rr);
                E.line(ctx, sk >= 1 ? pts.concat([pts[0], pts[1]]) : partial(pts, sk), col.b, 3.4);
            }
            CL.forEach(function (q, k) {
                var p = l == null ? 1 : bo(l, at + 4 + k * 3, 12);
                if (!(p > 0)) return;
                group(ctx, q[0], q[1], p, 0, function () { hex(ctx, [0, 0], Rr - gap, k ? col.a : col.b, k ? col.a : col.b, gap * 0.7); });
            });
        });
    }
    // The 24 px mark: seven cells blur into a flower there, so the ring
    // becomes its own twelve-tip band round the task, the ground showing
    // between them.
    function markBand(ctx, x, y, size, col) {
        col = col || { a: C.keel, b: C.ink };
        group(ctx, x, y, size / 120, 0, function () {
            var c = [60, 60], Rr = 20.5, g = 6;
            ctx.beginPath();
            var outer = hull12(c, Rr), hole = hexPts(c, Rr + g);
            ctx.moveTo(outer[0][0], outer[0][1]);
            for (var k = 1; k < outer.length; k++) ctx.lineTo(outer[k][0], outer[k][1]);
            ctx.closePath();
            ctx.moveTo(hole[0][0], hole[0][1]);
            for (k = 1; k < hole.length; k++) ctx.lineTo(hole[k][0], hole[k][1]);
            ctx.closePath();
            ctx.fillStyle = col.a;
            ctx.fill('evenodd');
            poly(ctx, outer);
            ctx.strokeStyle = col.b;
            ctx.lineWidth = 8;
            ctx.lineJoin = 'round';
            ctx.stroke();
            hex(ctx, c, Rr - g, col.b, col.b, 2);
        });
    }
    // The logo at `px` device pixels square, top left (x, y) in frame units:
    // the ring at 48 px and up, the band below.
    function logo(ctx, x, y, size, px, col) {
        if (px < 48) markBand(ctx, x, y, size, col);
        else markRing(ctx, x, y, size, col);
    }
    var CMD = '/plugin install fankeel';
    function ringClose(ctx, P, l) {
        var ui = 1 - eo(l, 0, 18);
        var mv = K.inOut(E.prog(l, 18, 42));
        var rise = eo(l, 20, 50);
        var imp = K.shake(l, 60, 2);
        FIELD.forEach(function (r, k) {
            var a = r[2] * E.prog(l, 20 + k * 2, 30);
            if (a > 0) fieldRing(ctx, [r[0] + imp[0] * 0.5, r[1] + (1 - rise) * 30 + imp[1] * 0.5], RN, a, r[3]);
        });
        // the wash the tag reads on
        var wash = E.prog(l, 30, 40);
        for (var y = 280; y < H && wash > 0; y += 2) {
            var ay = Math.min(1, (y - 280) / 32) * 0.9 * wash;
            ctx.fillStyle = K.hex(C.paper, ay);
            ctx.fillRect(0, y, 360, 2);
            for (var s = 0; s < 7; s++) {
                ctx.fillStyle = K.hex(C.paper, ay * (1 - (s + 1) / 8));
                ctx.fillRect(360 + s * 20, y, 20, 2);
            }
        }
        var c = [E.lerp(HOME[0], NEST[0], mv), E.lerp(HOME[1], NEST[1], mv)], R = E.lerp(R0, RN, mv);
        var g = geo(c, R), st = states(6, 999), off = 1 - E.prog(l, 0, 20);
        st.forEach(function (s, j) { s.plate = j === 2 ? 0 : off; if (j === 2) s.arch = 1 - E.prog(l, 12, 18); });
        drawRing(ctx, P, g, st, {
            backing: mv > 0, seal: 1, sealFrom: SEAL_FROM, sealW: E.lerp(4.5, 3.7, mv),
            labels: 1 - E.prog(l, 0, 16), task: 1 - E.prog(l, 6, 16),
        });
        K.ring(ctx, c[0], c[1], 120, C.keel, l, 60, 30, 3);
        E.fade(ctx, ui, function () {
            bead(ctx, GREEN_AT[0], GREEN_AT[1], true, 1);
            h.pills(ctx, P, 7, l, -99);
            h.status(ctx, P, 7, l, -99);
        });
        // the mark and the wordmark, locking up on the resolve
        var lockX = 360, lockY = 85, ms = 56;
        markRing(ctx, lockX, lockY, ms, null, l, 150);
        group(ctx, lockX + ms + 10, lockY + 44, 1 + 0.008 * Math.sin(l * 0.08), 0, function () {
            K.word(ctx, P, 'fankeel', 0, 0, 44, l, 150, { gap: 3, fill: C.ink });
        });
        K.ring(ctx, lockX + ms / 2, lockY + ms / 2, 120, C.keel, l, 150, 40, 3);
        // the install line
        var ik = E.prog(l, 190, 16);
        if (ik > 0) {
            var copy = t(P, 'sail.copy'), cw = measure(ctx, P, copy, 7, '700') + 14;
            var tw = measure(ctx, P, '> ' + CMD, 11, '400', true), w = 12 + tw + 8 + cw + 6, hh = 24;
            E.fade(ctx, ik * 3, function () {
                group(ctx, lockX, lockY + ms + 12 + (1 - E.expoOut(ik)) * 10, 1, 0, function () {
                    panel(ctx, w, hh, { fill: C.ink, r: 12 });
                    txt(ctx, P, '>', 12, 16, { size: 11, mono: true, fill: C.dotLit });
                    var n = Math.max(0, Math.min(CMD.length, Math.floor((l - 196) / 1.3)));
                    var gx = 12 + measure(ctx, P, '> ', 11, '400', true);
                    txt(ctx, P, CMD.slice(0, n), gx, 16, { size: 11, mono: true, fill: C.paper });
                    if (n < CMD.length || Math.floor(l / 20) % 2 === 0) {
                        E.box(ctx, gx + measure(ctx, P, CMD.slice(0, n), 11, '400', true) + 1, 6, 5.5, 12, 1, C.dotLit);
                    }
                    var ck = bo(l, 232, 12);
                    if (ck > 0) group(ctx, w - 6 - cw / 2, hh / 2, ck * (1 - 0.1 * K.decay(l, 290, 6) * (l >= 290 ? 1 : 0)), 0, function () {
                        E.box(ctx, -cw / 2, -7.5, cw, 15, 7.5, C.signal);
                        txt(ctx, P, copy, 0, 2.6, { size: 7, weight: '700', align: 'center' });
                    });
                });
            });
        }
        // the tag: one line across the frame
        h.sub(ctx, P, 'outro.tag', l, 210, { maxW: W - 48 });
    }

    var RING_LEFT = {
        open: ringOpen, drop: ringDrop, stage: ringStage, close: ringClose,
        openKey: 'hook.cap', dropKey: 'route.h', stageSub: stageSub,
    };
    var TOUR_PROMO30V3 = V2.timeline(RING_LEFT);
    E.register('promo30v3', TOUR_PROMO30V3);

    // ---- promo30v4: v3 at one minute, the stage readable ---------------------
    // Spec: .fankeel/build/2026-09-29-promo30-v4/concept-v4.md; styleframes:
    // mockup-v4.html beside it. v3's shots play at their own speed, re-timed:
    // a stage shot is 360 frames, its first 60 a v1-style entry (the stage
    // colour opening from the task, a big `0N / 07` and the stage word over a
    // wash) while v3 waits at its local 0; from 60 v3's beats run at original
    // speed and the rest holds on v3's last frame. Hook, route and outro hold
    // after their beats land; the hook and the route keep their hand-off
    // (the stripes, the ring sliding home) for the end of the longer shot.
    // The cue (rail, counter, word) settles into one row under the ring
    // (60–90) and stays for the shot. v3's own frames are drawn by a second
    // timeline(LEFT) whose only difference is land's pill, lifted clear of
    // the cue row.
    var V4_ENTRY = 60, V4_STAGE = 360, V4_PILL_Y = 266;
    var V3_CUTS = TOUR_PROMO30V3.cues.cuts, V3_LEN = V3_CUTS.map(function (a, k) {
        return (k + 1 < V3_CUTS.length ? V3_CUTS[k + 1] : TOUR_PROMO30V3.length) - a;
    });
    // len: v4 frames; hold: the v3 local frame the shot waits on (the extra
    // frames are spent there); stage: the route index of a stage shot.
    var V4_SHOTS = [{ len: 300, hold: 156 }, { len: 240, hold: 94 }];
    E.ROUTE.forEach(function (s, k) { V4_SHOTS.push({ len: V4_STAGE, stage: k }); });
    V4_SHOTS.push({ len: 540, hold: V3_LEN[9] - 1 });
    var V4_LENGTH = 3600, V4_STARTS = [];
    if (V4_SHOTS.reduce(function (at, s) { V4_STARTS.push(at); return at + s.len; }, 0) !== V4_LENGTH) throw new Error('tour: promo30v4 does not run to ' + V4_LENGTH + ' frames');
    // v4 shot k's local frame l as v3's local frame.
    function v3Local(k, l) {
        var s = V4_SHOTS[k], len3 = V3_LEN[k];
        if (s.stage != null) return l < V4_ENTRY ? 0 : Math.min(l - V4_ENTRY, len3 - 1);
        var extra = s.len - len3;
        return l <= s.hold ? l : l < s.hold + extra ? s.hold : l - extra;
    }
    // and back: v3's local frame b as the v4 local frame it plays on.
    function v4Local(k, b) {
        var s = V4_SHOTS[k];
        if (s.stage != null) return b + V4_ENTRY;
        return b <= s.hold ? b : b + s.len - V3_LEN[k];
    }

    var CUE_ROW = 294, CUE_RAIL = { x: 24, step: 13 };
    var CUE_COUNT_X = CUE_RAIL.x + 6 * CUE_RAIL.step + 16;
    // a mixed k of the way from colour a to b (both #rrggbb)
    function mix(a, b, k) {
        if (!/^#[0-9a-f]{6}$/i.test(a) || !/^#[0-9a-f]{6}$/i.test(b)) return a;
        var p = parseInt(a.slice(1), 16), q = parseInt(b.slice(1), 16);
        var ch = function (s) { return Math.round(E.lerp(p >> s & 255, q >> s & 255, k)); };
        return 'rgb(' + ch(16) + ',' + ch(8) + ',' + ch(0) + ')';
    }
    // The seven-dot rail: done dots in their stage colours, this stage's
    // pulsing, the rest hollow. Done dots = the ring's cells filled before
    // this shot.
    function cueRail(ctx, P, i, l) {
        var y = CUE_ROW - 5;
        E.line(ctx, [[CUE_RAIL.x, y], [CUE_RAIL.x + 6 * CUE_RAIL.step, y]], C.faint, 1.5);
        E.ROUTE.forEach(function (r, j) {
            var x = CUE_RAIL.x + j * CUE_RAIL.step, c = P.st[r];
            if (j < i) E.circle(ctx, x, y, 3.2, c, C.card, 1);
            else if (j === i) {
                var k = E.backOut(E.prog(l, 20, 14));
                E.circle(ctx, x, y, 4.4 * k, c, C.card, 1);
                E.circle(ctx, x, y, (7 + 1.3 * Math.sin(l * 0.2)) * k, null, c, 1.3);
            } else E.circle(ctx, x, y, 3, C.paper, C.faint, 1.3);
        });
    }
    // `0N / 07` and the stage word (v1's stageFrame), big over the wash,
    // then 60–90 shrinking into the row after the rail.
    function cueCounter(ctx, P, i, l) {
        var s = E.ROUTE[i], c = P.st[s], ci = mix(c, C.ink, 0.28);
        var m = K.inOut(E.prog(l, V4_ENTRY, 30));
        var cs = E.lerp(38, 11, m), cx = E.lerp(44, CUE_COUNT_X, m), cy = E.lerp(128, CUE_ROW, m);
        var wk = E.expoOut(E.prog(l, 8, 16));
        if (wk > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(cx - 4, cy - cs * 1.2, (measure(ctx, P, '04 / 07', cs, '700', true) + 8) * wk, cs * 1.5);
            ctx.clip();
            var num = '0' + (i + 1), nw = measure(ctx, P, num, cs, '700', true), ox = (1 - wk) * -24;
            txt(ctx, P, num, cx + ox, cy, { size: cs, weight: '700', mono: true, fill: ci });
            txt(ctx, P, ' / 07', cx + ox + nw, cy, { size: cs, weight: '700', mono: true, fill: C.mute });
            ctx.restore();
        }
        var ws = E.lerp(58, 16, m);
        var wx = E.lerp(44, CUE_COUNT_X + measure(ctx, P, '04 / 07', 11, '700', true) + 9, m), wy = E.lerp(200, CUE_ROW, m);
        var w = K.word(ctx, P, s, wx, wy, ws, l, 12, { gap: 3, fill: C.ink });
        E.box(ctx, wx, wy + ws * 0.17, w * E.expoOut(E.prog(l, 28, 24)), Math.max(2.2, ws * 0.085), 2, c);
    }
    // The stage cue over v3's frame at v4 local l of stage shot i.
    function stageCue(ctx, P, i, l) {
        var c = P.st[E.ROUTE[i]], next = E.ROUTE[i + 1];
        // the wash the big cue reads on, lifting 60–84
        var wash = 1 - E.prog(l, V4_ENTRY, 24);
        if (wash > 0) {
            ctx.fillStyle = K.hex(C.paper, 0.86 * wash);
            ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = K.hex(c, 0.1 * wash);
            ctx.fillRect(0, 0, W, H);
        }
        // the flood this shot came in on, opening from the task (v1: 4–30)
        var open = E.expoOut(E.prog(l, 4, 26));
        if (open < 1) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, W, H);
            ctx.arc(HOME[0], HOME[1], 560 * open, 0, Math.PI * 2);
            ctx.fillStyle = c;
            ctx.fill('evenodd');
            ctx.restore();
            K.ring(ctx, HOME[0], HOME[1], 560, c, l, 4, 26, 30);
        }
        cueRail(ctx, P, i, l);
        cueCounter(ctx, P, i, l);
        // the next stage's colour from its rail dot over the last 18 frames
        if (next) K.flood(ctx, l, V4_STAGE, CUE_RAIL.x + (i + 1) * CUE_RAIL.step, CUE_ROW - 5, P.st[next]);
    }

    var V4_V3 = V2.timeline(Object.assign({}, RING_LEFT, {
        stage: function (ctx, P, i, l, n) { ringStage(ctx, P, i, l, n, { pillY: V4_PILL_Y }); },
    }));
    function shotAt(f) {
        var k = V4_SHOTS.length - 1;
        while (k > 0 && V4_STARTS[k] > f) k--;
        return k;
    }
    var TOUR_PROMO30V4 = {
        length: V4_LENGTH,
        beats: TOUR_PROMO30V3.beats.map(function (b, k) {
            var o = { at: V4_STARTS[k], label: b.label };
            if (b.stage) o.stage = b.stage;
            return o;
        }),
        stills: V4_STARTS.map(function (a, k) { return a + Math.floor(V4_SHOTS[k].len / 2); }),
        cues: {
            cuts: V4_STARTS.slice(),
            blocks: TOUR_PROMO30V3.cues.blocks.map(function (b) {
                var k = V3_CUTS.length - 1;
                while (k > 0 && V3_CUTS[k] > b) k--;
                return V4_STARTS[k] + v4Local(k, b - V3_CUTS[k]);
            }).sort(function (a, b) { return a - b; }),
        },
        strings: V4_V3.strings,
        draw: function (ctx, f, P) {
            var k = shotAt(f), l = f - V4_STARTS[k], s = V4_SHOTS[k];
            V4_V3.draw(ctx, V3_CUTS[k] + v3Local(k, l), P);
            if (s.stage != null) stageCue(ctx, P, s.stage, l);
        },
    };
    E.register('promo30v4', TOUR_PROMO30V4);
    module.exports = {
        TOUR_PROMO30V3: TOUR_PROMO30V3,
        TOUR_PROMO30V4: TOUR_PROMO30V4,
    };
    if (typeof window !== 'undefined') root.tourRing = module.exports;
})(typeof window !== 'undefined' ? window : globalThis, typeof module !== 'undefined' ? module : {});
