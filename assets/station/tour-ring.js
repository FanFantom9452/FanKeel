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

    // ---- promo30v5: the guided tour, 74 seconds ------------------------------
    // Spec: .fankeel/build/task-20260930T014509/design.md. Styleframes:
    // .fankeel/build/2026-09-30-promo30-v5/mockup-v5-tour.html (43 blocks),
    // whose run-time drawing this is, moved here; its hook is that page's cut
    // of hook-variants.html's variant E, and the glyph, b1 and b5's word are
    // logo-v6-anim2.html's. Every beat draws its styleframe; what moves inside
    // a beat (a click, a line being drawn, a card in flight, a stamp, the lock)
    // is timed so the styleframe's own second lands on the styleframe, and
    // beats cross-fade over XF frames. No rail, pills, statusline, big left
    // glyph or counter: the header top left is the progress.
    var TOUR_PROMO30V5 = (function () {
        var P = null;               // the palette of the frame being drawn; draw() sets it
        var CUR = { l: 0, sl: 0 };  // the beat being drawn: its local frame, its styleframe frame
        var AGC = ['#2D5BD8', '#138A8A', '#7059C4', '#B26B0C'];     // AI 1..4
        var COL = { a: C.keel, b: C.ink };
        var XF = 10, CLICK_AT = 16;
        var has = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };
        // v5's strings first (tour-reel-kit.js V5), then v1's (its S), then the
        // film's own table (survey.map, survey.have, ring.task)
        function tt(k) {
            if (has(K.V5, k)) return K.V5[k][P.lang];
            if (has(K.S, k)) return K.t(P, k);
            return t(P, k);
        }
        function tx(ctx, s, x, y, o) { txt(ctx, P, s, x, y, o); }
        function ms(ctx, s, size, weight, mono) { return measure(ctx, P, s, size, weight, mono); }

        // ---- tour-keel.js's okDot, xDot, cursor, stamp, fillPoly and ground,
        // which its helpers table does not export; value for value.
        function fillPoly(ctx, pts, fill, stroke, lw) {
            ctx.beginPath();
            ctx.moveTo(pts[0][0], pts[0][1]);
            for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
            ctx.closePath();
            if (fill) { ctx.fillStyle = fill; ctx.fill(); }
            if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.lineJoin = 'round'; ctx.stroke(); }
        }
        function okDot(ctx, x, y, r, k) {
            if (!(k > 0)) return;
            E.circle(ctx, x, y, r * k, C.pass);
            E.tick(ctx, x - r * 0.5, y, r * 0.066 * k, E.prog(k, 0.4, 0.6), C.card, r * 0.3);
        }
        function xDot(ctx, x, y, r, k) {
            if (!(k > 0)) return;
            var d = r * 0.36 * k;
            E.circle(ctx, x, y, r * k, C.fail);
            E.line(ctx, [[x - d, y - d], [x + d, y + d]], C.card, r * 0.28);
            E.line(ctx, [[x + d, y - d], [x - d, y + d]], C.card, r * 0.28);
        }
        var CURSOR = [[0, 0], [0, 24], [6.5, 18], [11, 28], [15.5, 26], [11, 16.5], [20, 16.5]];
        function cursor(ctx, x, y, s) {
            group(ctx, x, y, 0.5 * (s || 1), 0, function () {
                ctx.save();
                ctx.shadowColor = 'rgba(24,32,44,.3)';
                ctx.shadowBlur = 3;
                ctx.shadowOffsetY = 2;
                fillPoly(ctx, CURSOR, C.ink);
                ctx.restore();
                fillPoly(ctx, CURSOR, null, C.card, 2);
            });
        }
        function stamp(ctx, l, at, x, y, deg, w, h, color, fn) {
            var p = E.prog(l, at, 9);
            if (!(p > 0)) return;
            var s = E.lerp(2.6, 1, E.expoOut(p));
            E.fade(ctx, p * 2, function () {
                group(ctx, x, y, s, deg * RAD, function () {
                    E.box(ctx, -w / 2, -h / 2, w, h, 5, 'rgba(251,252,252,.85)', color, 2);
                    E.box(ctx, -w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 3, null, color, 1);
                    fn();
                });
            });
        }
        function ground(ctx, f) {
            ctx.fillStyle = C.paper;
            ctx.fillRect(0, 0, W, H);
            var o = (f * 0.12) % 11;
            ctx.fillStyle = 'rgba(24,32,44,.13)';
            ctx.beginPath();
            for (var x = 5.5 - o; x < W + 11; x += 11) {
                for (var y = 5.5 - o; y < H + 11; y += 11) {
                    ctx.moveTo(x + 0.6, y);
                    ctx.arc(x, y, 0.6, 0, Math.PI * 2);
                }
            }
            ctx.fill();
        }
        // tour-reel.js's two install commands (that file does not export them)
        var CMDS = ['claude plugin marketplace add FanFantom9452/FanKeel', 'claude plugin install fankeel@fankeel'];

        // ---- file-type icons in place of the DIR / MD / JS text badge --------
        // Material Icon Theme 5.38.1 (PKief, MIT): the SVGs and the licence are
        // in assets/station/icons/, and ICON_SVG below is those files, byte for
        // byte, so the page needs no route to them. In a browser each is
        // decoded into an Image at load and `ready` resolves when all are; an
        // icon that fails to decode is logged by name with console.warn and
        // makes `ready` reject with that name. A frame drawn before `ready`
        // leaves the icons out. In Node there is no
        // Image: each is a plain record, so a draw stays a pure function of
        // its frame. An icon sits centred in the old badge's 17 x 10 slot and
        // the width returned is still 17, so no file name moves.
        var ICON_SVG = {
            'database': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path fill="#ffca28" d="M16 24c-5.525 0-10-.9-10-2v4c0 1.1 4.475 2 10 2s10-.9 10-2v-4c0 1.1-4.475 2-10 2m0-8c-5.525 0-10-.9-10-2v4c0 1.1 4.475 2 10 2s10-.9 10-2v-4c0 1.1-4.475 2-10 2m0-12C10.477 4 6 4.895 6 6v4c0 1.1 4.475 2 10 2s10-.9 10-2V6c0-1.105-4.477-2-10-2"/></svg>',
            'diff-light': '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/><path fill="#FBFCFC" d="M18 23H4c-1.1 0-2-.9-2-2V7h2v14h14zM14.5 7V5h-2v2h-2v2h2v2h2V9h2V7zm2 6h-6v2h6zM15 1H8c-1.1 0-1.99.9-1.99 2L6 17c0 1.1.89 2 1.99 2H19c1.1 0 2-.9 2-2V7zm4 16H8V3h6.17L19 7.83z"/></svg>',
            'folder': '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="m6.922 3.768-.644-.536A1 1 0 0 0 5.638 3H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H7.562a1 1 0 0 1-.64-.232" fill="#90a4ae" /></svg>',
            'folder-open': '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M14.483 6H4.721a1 1 0 0 0-.949.684L2 12V5h12a1 1 0 0 0-1-1H7.562a1 1 0 0 1-.64-.232l-.644-.536A1 1 0 0 0 5.638 3H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h11l2.403-5.606A1 1 0 0 0 14.483 6" fill="#90a4ae" /></svg>',
            'folder-temp': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path id="folder" fill="#0097a7" d="m6.922 3.768-.644-.536A1 1 0 0 0 5.638 3H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H7.562a1 1 0 0 1-.64-.232"/><g id="motive" fill="#b2ebf2"><path d="M12.688 12.39 10 10.24V7h1v2.76l2.313 1.85z"/><path d="M11 15a5 5 0 1 1 5-5 5.005 5.005 0 0 1-5 5m0-9a4 4 0 1 0 4 4 4.005 4.005 0 0 0-4-4"/></g></svg>',
            'html': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path fill="#e65100" d="m4 4 2 22 10 2 10-2 2-22Zm19.72 7H11.28l.29 3h11.86l-.802 9.335L15.99 25l-6.635-1.646L8.93 19h3.02l.19 2 3.86.77 3.84-.77.29-4H8.84L8 8h16Z"/></svg>',
            'javascript': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="#ffca28" d="M2 2v12h12V2zm6 6h1v4a1.003 1.003 0 0 1-1 1H7a1.003 1.003 0 0 1-1-1v-1h1v1h1zm3 0h2v1h-2v1h1a1.003 1.003 0 0 1 1 1v1a1.003 1.003 0 0 1-1 1h-2v-1h2v-1h-1a1.003 1.003 0 0 1-1-1V9a1.003 1.003 0 0 1 1-1"/></svg>',
            'log': '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/><path fill="#afb42b" d="M19 5v9h-5v5H5V5zm0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h10l6-6V5c0-1.1-.9-2-2-2m-7 11H7v-2h5zm5-4H7V8h10z"/></svg>',
            'markdown': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path fill="#42a5f5" d="m14 10-4 3.5L6 10H4v12h4v-6l2 2 2-2v6h4V10zm12 6v-6h-4v6h-4l6 8 6-8z"/></svg>',
            'python': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#0288d1" d="M9.86 2A2.86 2.86 0 0 0 7 4.86v1.68h4.29c.39 0 .71.57.71.96H4.86A2.86 2.86 0 0 0 2 10.36v3.781a2.86 2.86 0 0 0 2.86 2.86h1.18v-2.68a2.85 2.85 0 0 1 2.85-2.86h5.25c1.58 0 2.86-1.271 2.86-2.851V4.86A2.86 2.86 0 0 0 14.14 2zm-.72 1.61c.4 0 .72.12.72.71s-.32.891-.72.891c-.39 0-.71-.3-.71-.89s.32-.711.71-.711"/><path fill="#fdd835" d="M17.959 7v2.68a2.85 2.85 0 0 1-2.85 2.859H9.86A2.85 2.85 0 0 0 7 15.389v3.75a2.86 2.86 0 0 0 2.86 2.86h4.28A2.86 2.86 0 0 0 17 19.14v-1.68h-4.291c-.39 0-.709-.57-.709-.96h7.14A2.86 2.86 0 0 0 22 13.64V9.86A2.86 2.86 0 0 0 19.14 7zM8.32 11.513l-.004.004.038-.004zm6.54 7.276c.39 0 .71.3.71.89a.71.71 0 0 1-.71.71c-.4 0-.72-.12-.72-.71s.32-.89.72-.89"/></svg>',
            'robot-light': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path fill="#FBFCFC" d="M25.172 6 28 8.828v14.344L25.172 26H6.828L4 23.172V8.828L6.828 6zM26 4H6L2 8v16l4 4h20l4-4V8z"/><path fill="#FBFCFC" d="M8 20h16v2H8zm0-6v2h2v-2a2 2 0 0 1 2-2 2 2 0 0 1 2 2v2h2v-2a4 4 0 0 0-4-4 4 4 0 0 0-4 4m9.876.268 5.196-3 1 1.732-5.196 3z"/></svg>',
            'search-light': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path fill="#FBFCFC" d="M17 17a4 4 0 1 1-4 4 4.005 4.005 0 0 1 4-4m0-3a7 7 0 1 0 7 7 7 7 0 0 0-7-7"/><path fill="#FBFCFC" d="m19.586 26.414 2.828-2.828L26 27.17 23.17 30zM10 26H6V4h9.172L22 10.828V12h2v-2l-8-8H6a2 2 0 0 0-2 2v22a2 2 0 0 0 2 2h4Z"/><path fill="#FBFCFC" d="M22 12h-8V4h2l6 6zm0 0h2v2h-2z"/></svg>',
            'test-js': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path fill="#ffca28" d="M20 4v2h-2v4.531l.264.461 7.473 13.078a2 2 0 0 1 .263.992V26a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-.938a2 2 0 0 1 .264-.992l7.473-13.078.263-.46V6h-2V4zm0-2h-8a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2v2L4.527 23.078A4 4 0 0 0 4 25.062V26a4 4 0 0 0 4 4h16a4 4 0 0 0 4-4v-.938a4 4 0 0 0-.527-1.984L20 10V8a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2"/><circle cx="17" cy="17" r="1" fill="#ffca28"/><path fill="#ffca28" d="M19.72 20.715a1 1 0 0 0-1.134-.318 5 5 0 0 1-1.18.262 3.95 3.95 0 0 1-1.862-.292 2.74 2.74 0 0 0-3.371.489 2 2 0 0 0-.237.35L10 24h12Z"/></svg>',
            'verified-light': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#FBFCFC" d="M9 3 8 6H4l1 4-3 2 3 2-1 4h4l1 3 3-2 3 2 1-3h4l-1-4 3-2-3-2 1-4h-4l-1-3-3 2zm7 5 1 1-7 7-3-3 1-1 2 2z"/></svg>',
        };
        var ICONS = { dir: 'folder', dirOpen: 'folder-open', md: 'markdown', js: 'javascript', jsTest: 'test-js',
            py: 'python', html: 'html', db: 'database', searchLight: 'search-light', verifiedLight: 'verified-light',
            diffLight: 'diff-light', robotLight: 'robot-light', log: 'log', folderTemp: 'folder-temp' };
        var IMG = {}, BAD = {}, READY;
        if (typeof Image === 'function' && typeof document !== 'undefined') {
            READY = Promise.all(Object.keys(ICONS).map(function (k) {
                var im = new Image();
                im.src = 'data:image/svg+xml,' + encodeURIComponent(ICON_SVG[ICONS[k]]);
                IMG[k] = im;
                var done = im.decode ? im.decode() : new Promise(function (ok, no) { im.onload = ok; im.onerror = no; });
                return done.catch(function () {
                    var why = 'tour: promo30v5 icon ' + k + ' (' + ICONS[k] + '.svg) failed to decode';
                    BAD[k] = why;
                    if (typeof console !== 'undefined') console.warn(why);
                    throw new Error(why);
                });
            }));
        } else {
            Object.keys(ICONS).forEach(function (k) { IMG[k] = { icon: ICONS[k] }; });
            READY = Promise.resolve();
        }
        function icon(ctx, k, x, y, w, h) {
            var im = IMG[k];
            if (!im) throw new Error('tour: promo30v5 has no icon ' + k);
            // not decoded yet: left out; failed to decode: left out, and
            // every frame that skips it says which icon
            if (typeof im.complete === 'boolean' && !(im.complete && im.naturalWidth > 0)) {
                if (BAD[k] && typeof console !== 'undefined') console.warn(BAD[k] + '; left out of this frame');
                return;
            }
            ctx.drawImage(im, x, y, w, h);
        }
        function badge(ctx, P0, kind, s, x, y) {
            icon(ctx, kind, x + 2.5, y - 0.5, 12, 12);
            return 17;
        }

        // ---- logo-v6-anim2's glyph, one segment at a time, and b1 ------------
        var c0 = [60, 60];
        function unit(ctx, px, fn) { group(ctx, 0, 0, px / 120, 0, fn); }
        function rotPts(pts, s) { return pts.slice(s).concat(pts.slice(0, s)); }
        function strokePoly(ctx, pts, color, lw) {
            poly(ctx, pts); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke();
        }
        function sealLine(ctx, pts, color, lw, frac, start) {
            if (!(frac > 0)) return;
            if (frac >= 1) strokePoly(ctx, pts, color, lw);
            else E.line(ctx, partial(rotPts(pts, start || 0), frac), color, lw);
        }
        function inOut3(p) { p = E.clamp01(p); return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
        function gGeo(px) {
            var small = px < 48;
            return { Ro: 50, Ri: small ? 31 : 30, cut: small ? 7 : 4.5, ew: small ? 8 : 4.4, tr: small ? 21 : 20, small: small };
        }
        function segPts(i, Ri, Ro, cw) {
            var th = ANG[i], d = (cw / 2) / Math.sin(Math.PI / 3);
            var o0 = at(c0, Ro, th - 30), o1 = at(c0, Ro, th + 30), i0 = at(c0, Ri, th - 30), i1 = at(c0, Ri, th + 30);
            function mv(p, q) { var L = Math.hypot(q[0] - p[0], q[1] - p[1]); return [p[0] + (q[0] - p[0]) / L * d, p[1] + (q[1] - p[1]) / L * d]; }
            return [mv(o0, o1), mv(o1, o0), mv(i1, i0), mv(i0, i1)];
        }
        // o.seg(i) -> null (absent) or { k, off, sc, alpha, fill }; o.edge 0..1
        // drawn from corner o.edgeStart; o.task scale (0 = none)
        function glyph(ctx, px, col, o) {
            o = o || {};
            var s = gGeo(px);
            unit(ctx, px, function () {
                for (var i = 0; i < 6; i++) {
                    var sg = o.seg ? o.seg(i) : {};
                    if (!sg || (sg.k != null && !(sg.k > 0))) continue;
                    var pts = segPts(i, s.Ri, s.Ro, s.cut);
                    var m = [0, 1].map(function (n) { return (pts[0][n] + pts[1][n] + pts[2][n] + pts[3][n]) / 4; });
                    var d = at([0, 0], sg.off || 0, ANG[i]), sc = sg.sc == null ? 1 : sg.sc;
                    ctx.save();
                    ctx.translate(m[0] + d[0], m[1] + d[1]); ctx.scale(sc, sc); ctx.translate(-m[0], -m[1]);
                    ctx.globalAlpha = ctx.globalAlpha * (sg.alpha == null ? 1 : sg.alpha);
                    poly(ctx, pts); ctx.fillStyle = sg.fill || col.a; ctx.fill();
                    ctx.restore();
                }
                sealLine(ctx, hexPts(c0, s.Ro), col.b, s.ew, o.edge == null ? 1 : o.edge, o.edgeStart);
                var tk = o.task == null ? 1 : o.task;
                if (tk > 0) group(ctx, c0[0], c0[1], tk, 0, function () { hex(ctx, [0, 0], s.tr, col.b, col.b, 2); });
            });
        }
        // b1: slide in to a little apart, hold, snap, seal from the bottom
        function b1(ctx, px, col, p) {
            var snap = E.backOut(E.prog(p, 0.58, 0.12));
            glyph(ctx, px, col, {
                task: E.backOut(E.prog(p, 0, 0.1)),
                seg: function (i) {
                    var k = E.prog(p, 0.08 + i * 0.055, 0.13);
                    if (!(k > 0)) return null;
                    return { alpha: Math.min(1, k * 2.5), sc: E.lerp(0.5, 1, E.backOut(k)), off: 9 * (1 - snap) + (1 - E.expoOut(k)) * 14 };
                },
                edge: inOut3(E.prog(p, 0.68, 0.28)), edgeStart: 3,
            });
        }
        // b5's word: the lockup in glyph units (120 a side), the baseline at y
        // 85, the size .8 of the glyph, starting one task-channel past the edge;
        // in the station's UI face (Bahnschrift first) in both languages
        var WFAM = E.UI_FONTS.en;
        function wordSet(ctx, size) {
            ctx.font = '700 ' + size + 'px ' + WFAM;
            if ('letterSpacing' in ctx) ctx.letterSpacing = (-0.03 * size) + 'px';
        }
        function wordW(ctx, size) {
            ctx.save(); wordSet(ctx, size);
            var w = ctx.measureText('fankeel').width;
            ctx.restore();
            return w;
        }

        // ---- empty places, for any size ----------------------------------
        // At 80 and up: dashed slots and a dashed edge. Smaller: the dashes
        // would be dust, so a slot is a pale fill and the edge a thin line.
        function inGlyph(ctx, c, px, fn) { group(ctx, c[0] - px / 2, c[1] - px / 2, 1, 0, fn); }
        function slots(ctx, c, px, which, edgeA) {
            var s = gGeo(px), U = px / 120, big = px >= 80;
            inGlyph(ctx, c, px, function () {
                unit(ctx, px, function () {
                    which.forEach(function (i) {
                        poly(ctx, segPts(i, s.Ri, s.Ro, s.cut));
                        if (big) {
                            ctx.fillStyle = 'rgba(242,244,243,.6)'; ctx.fill();
                            ctx.setLineDash([2.5 / U, 2.5 / U]); ctx.strokeStyle = C.faint; ctx.lineWidth = 1 / U; ctx.lineJoin = 'round'; ctx.stroke();
                            ctx.setLineDash([]);
                        } else { ctx.fillStyle = C.block; ctx.fill(); }
                    });
                    if (edgeA > 0) E.fade(ctx, edgeA, function () {
                        poly(ctx, hexPts(c0, s.Ro));
                        if (big) ctx.setLineDash([3.5 / U, 3.5 / U]);
                        ctx.strokeStyle = C.faint; ctx.lineWidth = (big ? 1.5 : 0.9) / U; ctx.lineJoin = 'round'; ctx.stroke();
                        ctx.setLineDash([]);
                    });
                });
            });
        }
        function taskWords(ctx, c, px) {
            var U = px / 120, tr = gGeo(px).tr, two = P.lang === 'zh';
            tx(ctx, tt('ring.task'), c[0], c[1] + (two ? 1 : 4), { size: 12, weight: '700', fill: C.card, align: 'center', maxW: tr * U * 1.5 });
            if (two) tx(ctx, 'the task', c[0], c[1] + 12, { size: 6, mono: true, fill: C.faint, align: 'center' });
        }
        function emptyGlyph(ctx, c, px, a) {
            E.fade(ctx, a, function () {
                slots(ctx, c, px, [0, 1, 2, 3, 4, 5], 1);
                inGlyph(ctx, c, px, function () { glyph(ctx, px, COL, { seg: function () { return null; }, edge: 0, task: 1 }); });
                if (px >= 150) taskWords(ctx, c, px);
            });
        }

        // ---- the header: small glyph + wordmark + stage, top left -----------
        // The glyph and the word sit as b5's lockup does, in glyph units: the
        // word is .8 of the glyph, its baseline at y 85, starting at x 116.
        var HC = [34, 32], HP = 40;
        var HW = { size: 0.8 * HP, x: HC[0] - HP / 2 + 116 * HP / 120, y: HC[1] - HP / 2 + 85 * HP / 120 };
        function wordmark(ctx, a) {
            E.fade(ctx, a == null ? 1 : a, function () {
                ctx.save(); wordSet(ctx, HW.size);
                ctx.fillStyle = C.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
                ctx.fillText('fankeel', HW.x, HW.y);
                ctx.restore();
            });
        }
        function headLayout(ctx) {
            var div = HW.x + wordW(ctx, HW.size) + 12, cx = div + 12;
            var nw = ms(ctx, '04 / 07', 13, '700', true);
            return { divX: Math.round(div), countX: Math.round(cx), stageX: Math.round(cx + nw + 8) };
        }
        // the glyph at c, side px: locked segments, pale empty slots, the new
        // segment glowing (glowA, its alpha)
        function markAt(ctx, c, px, locked, o) {
            o = o || {};
            var empty = [0, 1, 2, 3, 4, 5].filter(function (j) { return locked.indexOf(j) < 0; });
            slots(ctx, c, px, empty, (o.edge || 0) >= 1 ? 0 : 1);
            // shadowBlur is in canvas pixels: 8 film units
            if (o.glow != null && o.glowA > 0) inGlyph(ctx, c, px, function () {
                ctx.save(); ctx.shadowColor = C.keel; ctx.shadowBlur = 8 * (ctx.canvas ? ctx.canvas.width / W : 1);
                E.fade(ctx, o.glowA, function () {
                    glyph(ctx, px, COL, { seg: function (k) { return k === o.glow ? { sc: 1.35, alpha: 0.7, fill: C.keelMid } : null; }, edge: 0, task: 0 });
                });
                ctx.restore();
            });
            inGlyph(ctx, c, px, function () {
                glyph(ctx, px, COL, {
                    seg: function (k) { return locked.indexOf(k) < 0 ? null : { off: o.apart || 0 }; },
                    edge: o.edge || 0, edgeStart: 3, task: 1,
                });
            });
        }
        // land's small glyph: apart on the merge click, closing again on the
        // tidy, snapped and sealed from the bottom corner in the result
        var LAND_SEAL = 48;
        function landGlyph(ph, l) {
            if (ph === 'action') return { apart: 9 * E.expoOut(E.prog(l, CLICK_AT, 30)), edge: 0 };
            if (ph === 'tidy') return { apart: E.lerp(9, 4, E.expoOut(E.prog(l, 0, 30))), edge: 0 };
            if (ph === 'result') return { apart: 4 * (1 - E.backOut(E.prog(l, 0, 12))), edge: E.prog(l, 0, LAND_SEAL) };
            return { apart: 0, edge: 0 };
        }
        function lockedOf(i, ph) {
            var out = [];
            for (var j = 0; j < 6; j++) if (j < i || (j === i && ph === 'result')) out.push(j);
            return out;
        }
        function header(ctx, i, ph, l) {
            var hl = headLayout(ctx), s = E.ROUTE[i], land = i === 6, locked = lockedOf(i, ph), res = ph === 'result';
            // the lock: a tinted halo behind the glyph and the new segment
            // glowing (a ripple ring crossed the word or the frame edge at 40 px)
            if (res) E.circle(ctx, HC[0], HC[1], 23 * E.backOut(E.prog(l, 0, 14)), land ? C.passTint : C.keelTint);
            var lg = land ? landGlyph(ph, l) : { apart: 0, edge: 0 };
            markAt(ctx, HC, HP, locked, { apart: lg.apart, edge: lg.edge, glow: res && !land ? i : null, glowA: 1 - 0.6 * E.prog(l, 24, 30) });
            wordmark(ctx, 1);
            // the count and the stage word come in with survey's first beat
            E.fade(ctx, i === 0 && ph === 'problem' ? E.prog(l, 0, 12) : 1, function () {
                E.line(ctx, [[hl.divX, 18], [hl.divX, 46]], C.block, 1.2);
                var c = P.st[s], ci = mix(c, C.ink, 0.28), num = '0' + (i + 1);
                tx(ctx, num, hl.countX, 40, { size: 13, weight: '700', mono: true, fill: ci });
                tx(ctx, ' / 07', hl.countX + ms(ctx, num, 13, '700', true), 40, { size: 13, weight: '700', mono: true, fill: C.mute });
                tx(ctx, s, hl.stageX, 40, { size: 18, weight: '700', fill: ci });
                E.box(ctx, hl.stageX, 44, ms(ctx, s, 18, '700'), 2.4, 1.2, c);
            });
        }

        // ---- the caption line: one line, centred on the whole frame ------
        // the red x (problem lines) and the words centred together as one
        // group; 700, 18 zh / 15 en, baseline 338; past CAP_W it shrinks.
        var CAP_Y = 338, CAP_W = 600;
        function caption(ctx, key, kind, i) {
            var s = tt(key), fill = C.ink, size = P.lang === 'zh' ? 18 : 15, dot = kind === 'problem' ? 22 : 0;
            if (kind === 'produce') fill = mix(P.st[E.ROUTE[i]], C.ink, 0.28);
            var tw = Math.min(ms(ctx, s, size, '700'), CAP_W - dot), x0 = W / 2 - (dot + tw) / 2;
            if (dot) xDot(ctx, x0 + 7, CAP_Y - 6, 7, 1);
            tx(ctx, s, x0 + dot, CAP_Y, { size: size, weight: '700', fill: fill, maxW: CAP_W - dot });
        }

        // ---- UI pieces ---------------------------------------------------
        function card(ctx, x, y, w, h, fn, o) {
            group(ctx, x, y, 1, 0, function () { panel(ctx, w, h, o); if (fn) fn(); });
        }
        // an old diagram drawn at scale s, then shifted by (ox, oy)
        function placeM(ctx, s, ox, oy, fn) {
            ctx.save(); ctx.translate(ox, oy); ctx.scale(s, s); fn(); ctx.restore();
        }
        // the click in this beat: the cursor glides in over CLICK_AT frames,
        // presses, and the ripple runs so that at the styleframe's frame it is
        // kStyle of the way out, as the styleframe draws it
        function rippleK(kStyle) {
            return E.prog(CUR.l, CLICK_AT, Math.max(1, (CUR.sl - CLICK_AT) / kStyle));
        }
        // st: idle | press | done. rip: [x, y, k], a click on this button; its
        // ripple is drawn under the button, so it never covers the label
        function btn(ctx, x, y, w, h, label, st, rip) {
            if (rip) {
                if (st === 'press' && CUR.l < CLICK_AT) st = 'idle';
                ripple(ctx, rip[0], rip[1], rippleK(rip[2]));
            }
            var fill = C.card, stroke = C.ink, ink = C.ink, press = st === 'press';
            if (press) { fill = C.keel; stroke = C.keelDeep; ink = C.card; }
            if (st === 'done') { fill = C.pass; stroke = C.passInk; ink = C.card; }
            group(ctx, x + w / 2, y + h / 2 + (press ? 1 : 0), press ? 0.95 : 1, 0, function () {
                if (!press) E.box(ctx, -w / 2, -h / 2 + 1.6, w, h, 5, 'rgba(24,32,44,.22)');
                E.box(ctx, -w / 2, -h / 2, w, h, 5, fill, stroke, 1.2);
                var tx0 = 0;
                if (st === 'done') { tx0 = 5; E.tick(ctx, -w / 2 + 7, 0, 0.42, 1, C.card, 1.7); }
                tx(ctx, label, tx0, 3.5, { size: 9.5, weight: '700', fill: ink, align: 'center', maxW: w - 12 });
            });
        }
        function ripple(ctx, x, y, k) {
            [0, 0.32].forEach(function (d) {
                var q = E.clamp01((k - d) / (1 - d));
                if (q > 0 && q < 1) E.fade(ctx, 1 - q, function () { E.circle(ctx, x, y, 5 + 17 * E.expoOut(q), null, C.keel, 2.2 * (1 - q) + 0.6); });
            });
        }
        // the arrow cursor with its tip on (x, y), pressed; the ripple too
        // unless the button under it already drew it (under)
        function click(ctx, x, y, kStyle, under) {
            var g = 1 - E.expoOut(E.prog(CUR.l, 0, CLICK_AT)), cx = x + 24 * g, cy = y + 30 * g;
            if (!under) ripple(ctx, x, y, rippleK(kStyle));
            if (CUR.l >= CLICK_AT) E.fade(ctx, 0.45, function () { E.circle(ctx, x, y, 6.5, C.keelMid); });
            cursor(ctx, cx, cy, 1.35);
        }
        function aiChip(ctx, x, y) {
            E.circle(ctx, x, y, 9, C.ink);
            tx(ctx, 'AI', x, y + 3, { size: 8, weight: '700', mono: true, fill: C.card, align: 'center' });
        }
        function arrow(ctx, a, b, col, lw, dash) {
            E.line(ctx, [a, b], col, lw || 1.4, dash);
            var ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
            group(ctx, b[0], b[1], 1, ang, function () { fillPoly(ctx, [[0, 0], [-6, -3.4], [-6, 3.4]], col); });
        }
        function curve(ctx, p0, p1, p2, col, lw, dash) {
            ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.quadraticCurveTo(p1[0], p1[1], p2[0], p2[1]);
            ctx.strokeStyle = col; ctx.lineWidth = lw || 1.6; ctx.lineCap = 'round'; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]);
        }
        // a terminal panel: lines of [text, colour]; the text is mono (ASCII)
        function terminal(ctx, x, y, w, h, lines) {
            group(ctx, x, y, 1, 0, function () {
                panel(ctx, w, h, { fill: C.ink });
                for (var i = 0; i < 3; i++) E.circle(ctx, 12 + i * 10, 11, 3, C.termDot);
                E.line(ctx, [[0, 21], [w, 21]], C.termRule, 0.8);
                lines.forEach(function (ln, k) {
                    tx(ctx, ln[0], 12, 40 + k * 19, { size: 9, mono: true, fill: ln[1] || C.term, maxW: w - 22 });
                });
            });
        }
        function pill(ctx, x, y, s, fill, ink) {
            var w = ms(ctx, s, 8.5, '700') + 14;
            E.box(ctx, x, y, w, 15, 4, fill);
            tx(ctx, s, x + w / 2, y + 11, { size: 8.5, weight: '700', fill: ink, align: 'center' });
            return w;
        }
        function spinner(ctx, x, y, r) {
            E.circle(ctx, x, y, r, null, C.line, 1.6);
            // turning; at the styleframe's frame it is where the page draws it
            var a0 = -Math.PI / 2 + (CUR.l - CUR.sl) * 0.12;
            ctx.beginPath(); ctx.arc(x, y, r, a0, a0 + Math.PI * 0.85);
            ctx.strokeStyle = C.keel; ctx.lineWidth = 1.8; ctx.stroke();
        }
        // the reviewer's verdict on a lane: a dark tick, or a red cross
        function verdict(ctx, x, y, ok) {
            if (!ok) { xDot(ctx, x, y, 7, 1); return; }
            E.circle(ctx, x, y, 7, C.ink);
            E.tick(ctx, x - 3.4, y + 0.4, 0.34, 1, C.card, 1.7);
        }
        // a dark avatar pill with a light icon
        function darkPill(ctx, x, y, ic, s) {
            var w = 28 + ms(ctx, s, 9, '700') + 10;
            E.box(ctx, x, y - 10, w, 20, 10, C.ink);
            icon(ctx, ic, x + 8, y - 6.5, 13, 13);
            tx(ctx, s, x + 26, y + 3.2, { size: 9, weight: '700', fill: C.card });
            return w;
        }

        // ---- hook: hook-variants.html's variant E, six beats ---------------
        // A generic project growing (names and numbers illustrative), then the
        // AI's two bad ways in: grep misses, reading all of it burns tokens.
        var RH = 18;
        function eLow(ctx, fn) { group(ctx, 0, 30, 1, 0, fn); }
        function chevron(ctx, x, y, open) {
            fillPoly(ctx, open ? [[x - 3, y - 1.8], [x + 3, y - 1.8], [x, y + 2.2]] : [[x - 1.8, y - 3], [x - 1.8, y + 3], [x + 2.2, y]], C.mute);
        }
        var TAG = { grey: 'e.orphan', red: 'e.contra', miss: 'e.miss' };
        function tagW(ctx, kind) { return ms(ctx, tt(TAG[kind]), 7.5, '700') + 10; }
        function eTag(ctx, xr, y, kind) {
            var s = tt(TAG[kind]), w = tagW(ctx, kind), grey = kind === 'grey';
            E.box(ctx, xr - w, y + 3.5, w, 11, 5.5, grey ? C.block : C.failTint);
            tx(ctx, s, xr - w / 2, y + 11.6, { size: 7.5, weight: '700', fill: grey ? C.ink : C.failInk, align: 'center' });
        }
        // one row: [kind, name, o]; kind dir | md | py | dots. o: ind, n,
        // delta, open, hot, tag grey|red|miss, pair, hit, dim, read, now
        function eRow(ctx, x, y, w, r) {
            var o = r[2] || {}, ind = o.ind ? 12 : 0;
            if (o.hot) E.box(ctx, x - 5, y + 0.5, w + 10, RH - 1, 4, C.keelTint, C.keelMid, 1);
            else if (o.hit || o.now != null) E.box(ctx, x - 5, y + 0.5, w + 10, RH - 1, 4, C.keelTint);
            if (o.now != null) E.box(ctx, x - 5, y + RH - 3, (w + 10) * o.now, 2, 1, C.keel);
            if (r[0] === 'dots') { tx(ctx, r[1], x + ind + 4, y + 12.3, { size: 8, mono: true, fill: C.mute }); return; }
            var right = (o.tag ? tagW(ctx, o.tag) + 6 : 0) + (o.pair ? 14 : 0) + (o.n != null ? 22 : 0) + (o.delta ? 18 : 0) + (o.read ? 10 : 0);
            E.fade(ctx, o.tag === 'grey' || o.dim ? 0.42 : 1, function () {
                var bx = x + ind;
                if (r[0] === 'dir') { chevron(ctx, bx + 3, y + 9, o.open); bx += 9; }
                var bw = badge(ctx, P, r[0] === 'dir' && o.open ? 'dirOpen' : r[0], '', bx, y + 4);
                tx(ctx, r[1], bx + bw + 5, y + 12.3, { size: 8.5, mono: true, weight: r[0] === 'dir' || o.hit ? '700' : '400', fill: o.hit ? C.keelDeep : C.ink, maxW: w - (bx - x) - bw - 5 - right });
            });
            if (o.read) E.circle(ctx, x + w - 3, y + 9, 2.6, C.keelMid);
            if (o.n != null) tx(ctx, String(o.n), x + w, y + 12.3, { size: 8, mono: true, weight: '700', fill: C.mute, align: 'right' });
            if (o.delta) tx(ctx, '+' + o.delta, x + w - 24, y + 12.3, { size: 8, mono: true, weight: '700', fill: C.keelDeep, align: 'right' });
            if (o.tag && o.tag !== 'red') eTag(ctx, x + w, y, o.tag);
            if (o.tag === 'red') eTag(ctx, x + w - 14, y, 'red');
        }
        function eList(ctx, x, y, w, rows) {
            var pairs = {};
            rows.forEach(function (r, i) {
                var yy = y + i * RH, p = (r[2] || {}).pair;
                eRow(ctx, x, yy, w, r);
                if (p) (pairs[p] = pairs[p] || []).push(yy);
            });
            Object.keys(pairs).forEach(function (k) {
                var a = pairs[k], bx = x + w - 4, y1 = a[0] + 9, y2 = a[1] + 9, ym = (y1 + y2) / 2;
                E.line(ctx, [[bx - 5, y1], [bx, y1], [bx, y2], [bx - 5, y2]], C.fail, 1.3);
                E.circle(ctx, bx, ym, 5.5, C.card, C.fail, 1.2);
                tx(ctx, '≠', bx, ym + 3, { size: 8.5, weight: '700', fill: C.fail, align: 'center' });
            });
        }
        function ePanel(ctx, x, y, w, h, path) {
            card(ctx, x, y, w, h, function () {
                badge(ctx, P, 'dirOpen', '', 12, 9);
                tx(ctx, path, 38, 17.5, { size: 10, weight: '700', mono: true });
                E.line(ctx, [[10, 28], [w - 10, 28]], C.line, 1);
            });
        }
        function eCounter(ctx, n, runs) {
            card(ctx, 24, 22, 126, 132, function () {
                tx(ctx, tt('e.files'), 12, 18, { size: 9, weight: '700', fill: C.mute });
                tx(ctx, String(n), 12, 56, { size: 34, weight: '700', mono: true });
                tx(ctx, tt('e.runs'), 12, 80, { size: 7.5, weight: '700', fill: C.mute });
                var base = 120, top = 88, bw = 102 / 24;
                for (var i = 0; i < runs; i++) {
                    var v = Math.max(0.05, Math.pow((i + 1) / 24, 1.4) * (0.9 + 0.1 * K.rnd(i + 5)));
                    E.box(ctx, 12 + i * bw, base - (base - top) * v, bw - 1.2, (base - top) * v, 0.8, i === runs - 1 ? C.keel : C.keelMid);
                }
                E.line(ctx, [[12, base + 0.5], [114, base + 0.5]], C.line, 1);
            });
        }
        function eLegend(ctx) {
            card(ctx, 24, 166, 126, 62, function () {
                eTag(ctx, 12 + tagW(ctx, 'grey'), 4, 'grey');
                tx(ctx, tt('e.lgGrey'), 12, 30, { size: 7.5, fill: C.mute, maxW: 104 });
                E.circle(ctx, 18, 44, 5.5, C.card, C.fail, 1.2);
                tx(ctx, '≠', 18, 47, { size: 8.5, weight: '700', fill: C.fail, align: 'center' });
                tx(ctx, tt('e.lgRed'), 29, 47.5, { size: 7.5, fill: C.mute, maxW: 88 });
            });
        }
        var EX = 164, EW = 452, CA = 180, CB = 400, CW = 204;
        var E1 = [['md', 'README.md'], ['md', 'CLAUDE.md'], ['md', 'TODO.md'], ['dir', 'docs/', { n: 2 }], ['dir', 'backend/', { n: 7 }], ['dir', 'frontend/', { n: 4 }]];
        var E2A = [['md', 'README.md'], ['md', 'CLAUDE.md'], ['md', 'TODO.md'], ['dir', 'frontend/', { n: 70, delta: 3 }], ['dir', 'docs/', { n: 160, open: true }],
            ['dir', 'architecture/', { ind: 1, n: 12 }], ['dir', 'adr/', { ind: 1, n: 30, delta: 1 }], ['dir', 'plans/', { ind: 1, n: 40, delta: 2 }],
            ['dir', 'specs/', { ind: 1, n: 28 }], ['dir', 'meetings/', { ind: 1, n: 30, delta: 1 }], ['dir', 'archive/', { ind: 1, n: 20 }]];
        var E2B = [['dir', 'backend/', { n: 240, open: true }], ['dir', 'app/', { ind: 1, n: 40, delta: 1 }], ['dir', 'api/', { ind: 1, n: 30 }],
            ['dir', 'models/', { ind: 1, n: 25 }], ['dir', 'services/', { ind: 1, n: 35 }], ['dir', 'migrations/', { ind: 1, n: 90, delta: 1 }],
            ['dir', 'tests/', { ind: 1, n: 20, delta: 1 }], ['dir', 'scripts/', { n: 7 }]];
        var E3A = [['dir', 'architecture/', { n: 12, open: true }], ['md', 'architecture.md', { ind: 1, tag: 'red', pair: 'a' }], ['md', 'architecture-v2.md', { ind: 1, pair: 'a' }],
            ['md', 'system-overview.md', { ind: 1, tag: 'grey' }], ['dir', 'adr/', { n: 30, open: true }], ['md', 'adr-001-database.md', { ind: 1 }],
            ['md', 'adr-002-auth.md', { ind: 1 }], ['md', 'adr-007-queue.md', { ind: 1 }], ['dir', 'plans/', { n: 40, open: true }],
            ['md', 'plan-auth.md', { ind: 1 }], ['md', 'plan-search.md', { ind: 1 }], ['md', 'plan-billing-draft.md', { ind: 1, tag: 'grey' }]];
        var E3B = [['dir', 'specs/', { n: 28, open: true }], ['md', 'api-spec.md', { ind: 1, tag: 'red', pair: 'b' }], ['md', 'api-spec-final.md', { ind: 1, pair: 'b' }],
            ['md', 'search-spec.md', { ind: 1 }], ['dir', 'meetings/', { n: 30, open: true }], ['md', '03-02-kickoff.md', { ind: 1 }],
            ['md', '03-02-kickoff-notes.md', { ind: 1, tag: 'grey' }], ['md', '04-15-sync.md', { ind: 1 }], ['dir', 'archive/', { n: 20, open: true }],
            ['md', 'plan-auth.md', { ind: 1, tag: 'grey' }], ['md', 'old-roadmap.md', { ind: 1, tag: 'grey' }], ['md', 'spec-v1.md', { ind: 1, tag: 'grey' }]];
        var E4A = [['dir', 'app/', { n: 40, open: true }], ['py', 'utils.py', { ind: 1 }], ['py', 'utils_old.py', { ind: 1, tag: 'grey' }],
            ['py', 'helpers.py', { ind: 1 }], ['py', 'helpers2.py', { ind: 1, tag: 'grey' }], ['dir', 'api/', { n: 30, open: true }],
            ['py', 'routes.py', { ind: 1 }], ['py', 'routes_v2.py', { ind: 1, tag: 'grey' }], ['dir', 'models/', { n: 25 }],
            ['dir', 'services/', { n: 35, open: true }], ['py', 'auth_service.py', { ind: 1 }], ['py', 'billing.py', { ind: 1 }]];
        var E4B = [['dir', 'migrations/', { n: 90, open: true }], ['py', '0001_init.py', { ind: 1 }], ['py', '0002_add_users.py', { ind: 1 }],
            ['dots', '⋮  0003 … 0085', { ind: 1 }], ['py', '0086_fix_index.py', { ind: 1 }], ['py', '0087_add_column.py', { ind: 1 }],
            ['py', '3f9a2c1b_merge.py', { ind: 1 }], ['py', 'a81e0d44_hotfix.py', { ind: 1 }], ['py', 'e5c07b19_temp.py', { ind: 1, tag: 'grey' }],
            ['dir', 'tests/', { n: 20, open: true }], ['py', 'test_helpers.py', { ind: 1 }], ['py', 'test_api.py', { ind: 1 }]];
        function eOpen(ctx, name, n, colA, colB) {
            eCounter(ctx, 480, 24); eLegend(ctx);
            ePanel(ctx, EX, 22, EW, 282, 'project/');
            eList(ctx, CA, 56, EW - 32, [['dir', name, { n: n, open: true, hot: true }]]);
            eList(ctx, CA, 80, CW, colA);
            eList(ctx, CB, 80, CW, colB);
            E.line(ctx, [[CB - 8, 82], [CB - 8, 294]], C.line, 1);
            click(ctx, CA + 150, 66, 0.42);
        }
        var GX = 248, GW = 368, GA = 262, GB = 442, GC = 162;
        var G5A = [['dir', 'docs/architecture/', { open: true }], ['md', 'architecture.md', { ind: 1, hit: true }], ['md', 'architecture-v2.md', { ind: 1, tag: 'miss' }],
            ['md', 'system-overview.md', { ind: 1, dim: true }], ['dir', 'docs/adr/', { open: true }], ['md', 'adr-001-database.md', { ind: 1, dim: true }],
            ['md', 'adr-002-auth.md', { ind: 1, tag: 'miss' }], ['dir', 'docs/plans/', { open: true }], ['md', 'plan-auth.md', { ind: 1, hit: true }],
            ['dir', 'docs/specs/', { open: true }], ['md', 'api-spec.md', { ind: 1, hit: true }], ['md', 'api-spec-final.md', { ind: 1, hit: true }]];
        var G5B = [['dir', 'backend/app/', { open: true }], ['py', 'utils.py', { ind: 1, dim: true }], ['py', 'helpers.py', { ind: 1, dim: true }],
            ['dir', 'backend/api/', { open: true }], ['py', 'routes.py', { ind: 1, hit: true }], ['py', 'routes_v2.py', { ind: 1, dim: true }],
            ['dir', 'backend/services/', { open: true }], ['py', 'auth_service.py', { ind: 1, tag: 'miss' }], ['py', 'billing.py', { ind: 1, dim: true }],
            ['dir', 'backend/tests/', { open: true }], ['py', 'test_api.py', { ind: 1, hit: true }], ['py', 'test_helpers.py', { ind: 1, dim: true }]];
        var GREP = ['docs/architecture/architecture.md: login', 'docs/plans/plan-auth.md: login flow', 'docs/specs/api-spec.md: POST /login',
            'docs/specs/api-spec-final.md: /login', 'backend/api/routes.py: def login(', 'backend/tests/test_api.py: test_login'];
        function readTo(rows, upTo, part) {
            return rows.map(function (r, i) {
                var o = { ind: r[2].ind, open: r[2].open };
                if (r[0] !== 'dir') { if (i < upTo) o.read = true; else if (i === upTo) o.now = part; }
                if (i > upTo) o.dim = true;
                return [r[0], r[1], o];
            });
        }
        function eTask(ctx) {
            card(ctx, 24, 22, 212, 50, function () {
                aiChip(ctx, 22, 25);
                tx(ctx, tt('b.task'), 38, 20, { size: 7.5, weight: '700', fill: C.mute });
                tx(ctx, tt('e.task'), 38, 35, { size: 10.5, weight: '700', maxW: 162 });
            });
        }
        function eTree(ctx, colA, colB) {
            ePanel(ctx, GX, 22, GW, 282, 'project/');
            eList(ctx, GA, 56, GC, colA);
            eList(ctx, GB, 56, GC, colB);
            E.line(ctx, [[GB - 9, 58], [GB - 9, 272]], C.line, 1);
        }
        function eGrep(ctx) {
            var w = 212, h = 150;
            group(ctx, 24, 82, 1, 0, function () {
                panel(ctx, w, h, { fill: C.ink });
                for (var i = 0; i < 3; i++) E.circle(ctx, 12 + i * 10, 11, 3, C.termDot);
                E.line(ctx, [[0, 21], [w, 21]], C.termRule, 0.8);
                tx(ctx, '$ grep -r "login" docs/ backend/', 12, 38, { size: 8, mono: true, weight: '700', fill: C.card, maxW: w - 22 });
                GREP.forEach(function (s, k) {
                    E.fade(ctx, E.prog(CUR.l, 4 + k * 4, 6), function () { tx(ctx, s, 12, 56 + k * 14.5, { size: 7.5, mono: true, fill: C.keelMid, maxW: w - 22 }); });
                });
            });
            card(ctx, 24, 242, w, 62, function () {
                E.box(ctx, 12, 11, 30, 11, 4, C.keelTint);
                tx(ctx, tt('e.lgHit'), 50, 20, { size: 7.5, fill: C.mute, maxW: w - 62 });
                var tw = tagW(ctx, 'miss');
                eTag(ctx, 12 + tw, 29, 'miss');
                tx(ctx, tt('e.lgMiss'), 20 + tw, 40.6, { size: 7.5, fill: C.mute, maxW: w - 32 - tw });
            });
        }
        function eBurn(ctx) {
            var w = 212;
            card(ctx, 24, 82, w, 222, function () {
                tx(ctx, tt('e.read'), 14, 20, { size: 8.5, weight: '700', fill: C.mute });
                tx(ctx, '330 / 480 ' + tt('e.nfiles'), w - 14, 20, { size: 8.5, weight: '700', mono: true, align: 'right' });
                E.box(ctx, 14, 27, w - 28, 3, 1.5, C.block);
                E.box(ctx, 14, 27, (w - 28) * 330 / 480, 3, 1.5, C.keel);
                tx(ctx, tt('b.tok'), 14, 50, { size: 8.5, weight: '700', fill: C.mute });
                // the counter, still climbing: its last digit leaves a trail
                var by = 84, lead = '1.', nx = 14 + ms(ctx, lead, 28, '700', true), dw = ms(ctx, '0', 28, '700', true);
                tx(ctx, lead, 14, by, { size: 28, weight: '700', mono: true, fill: C.fail });
                [[10, 0.1], [5, 0.22]].forEach(function (g) {
                    E.fade(ctx, g[1], function () { tx(ctx, '2', nx, by + g[0], { size: 28, weight: '700', mono: true, fill: C.fail }); });
                });
                tx(ctx, '2', nx, by, { size: 28, weight: '700', mono: true, fill: C.fail });
                tx(ctx, 'M', nx + dw, by, { size: 28, weight: '700', mono: true, fill: C.fail });
                // the bar: its box ends at 150 and the fill runs on out of it
                var bx = 14, bw = 136, tip = w - 24, yy = 98;
                E.box(ctx, bx, yy, tip - bx, 12, 6, C.fail);
                fillPoly(ctx, [[tip - 3, yy - 3.5], [tip + 8, yy + 6], [tip - 3, yy + 15.5]], C.fail);
                E.box(ctx, bx - 2.5, yy - 2.5, bw + 5, 17, 8.5, null, C.ink, 1.4);
                E.line(ctx, [[12, 124], [w - 12, 124]], C.line, 1);
                tx(ctx, tt('b.split'), 14, 142, { size: 8.5, weight: '700', fill: C.mute, maxW: w - 28 });
                E.box(ctx, 14, 150, w - 28, 10, 5, C.fail);
                E.box(ctx, 14, 168, 8, 8, 2, C.fail);
                tx(ctx, tt('b.old'), 26, 175.5, { size: 8 });
                var ox = 26 + ms(ctx, tt('b.old'), 8) + 14;
                E.box(ctx, ox, 168, 8, 8, 2, C.keel);
                tx(ctx, tt('b.work'), ox + 12, 175.5, { size: 8 });
                E.line(ctx, [[12, 188], [w - 12, 188]], C.line, 1);
                tx(ctx, tt('b.edit'), 14, 208, { size: 10, weight: '700' });
                xDot(ctx, w - 24, 204.5, 7, 1);
                tx(ctx, tt('b.none'), w - 38, 208, { size: 10, weight: '700', fill: C.failInk, align: 'right' });
            });
        }
        var HOOK = {
            1: function (ctx) {
                eLow(ctx, function () {
                    eCounter(ctx, 16, 1);
                    ePanel(ctx, EX, 22, 260, 40 + E1.length * RH, 'project/');
                    eList(ctx, EX + 16, 56, 228, E1);
                });
            },
            // it grows: the counter runs up to 480 by the styleframe's second
            2: function (ctx) {
                var g = E.expoOut(E.prog(CUR.l, 0, 40));
                eCounter(ctx, Math.round(E.lerp(16, 480, g)), Math.max(1, Math.ceil(24 * g)));
                ePanel(ctx, EX, 22, EW, 40 + E2A.length * RH, 'project/');
                eList(ctx, CA, 56, CW, E2A);
                eList(ctx, CB, 56, CW, E2B);
            },
            3: function (ctx) { eOpen(ctx, 'docs/', 160, E3A, E3B); },
            4: function (ctx) { eOpen(ctx, 'backend/', 240, E4A, E4B); },
            5: function (ctx) { eTask(ctx); eGrep(ctx); eTree(ctx, G5A, G5B); },
            6: function (ctx) { eTask(ctx); eBurn(ctx); eTree(ctx, readTo(G5A, 99, 0), readTo(G5B, 7, 0.55)); },
        };

        // ---- intro: the empty glyph, centred; then docking top left ---------
        var IC = [320, 150], IP = 196;
        function intro(ctx) {
            var k = E.prog(CUR.l, 0, 20);
            emptyGlyph(ctx, IC, IP * E.lerp(0.82, 1, E.backOut(k)), Math.min(1, k * 2));
            K.ring(ctx, IC[0], IC[1], 118, C.keel, CUR.l, CUR.sl - 14, 34, 3);
        }
        function flyTo(from, fpx, to, tpx, e) { return { c: [E.lerp(from[0], to[0], e), E.lerp(from[1], to[1], e)], px: E.lerp(fpx, tpx, e) }; }
        // The styleframe (13.7 s, local frame CUR.sl) has the flight 0.55 of
        // the way through its easing. A power warp puts p there at CUR.sl and
        // still runs 0 -> 1 over 13.4-14 s, so the flight ends on the header
        // glyph; the trail keeps its lags, as the styleframe's does.
        var DOCK = 36, DOCK_ST = 0.55;
        function introDock(ctx) {
            var p = Math.pow(E.prog(CUR.l, 0, DOCK), Math.log(DOCK_ST) / Math.log(CUR.sl / DOCK));
            // a short trail behind it while it moves
            [[0.35, 0.12], [0.19, 0.22]].forEach(function (q) {
                if (p < 1 && p - q[0] > 0) {
                    var g0 = flyTo(IC, IP, HC, HP, inOut3(p - q[0]));
                    emptyGlyph(ctx, g0.c, g0.px, q[1]);
                }
            });
            var g = flyTo(IC, IP, HC, HP, inOut3(p));
            emptyGlyph(ctx, g.c, g.px, 1);
            wordmark(ctx, E.prog(CUR.l, 6, 30));
        }

        // ---- the diagrams: x 24-616, y 64-300, under the header ------------
        var D = {};
        // survey's file tree, in the old diagram's own units (card at 338, 54)
        function tree(ctx, ph) {
            var x0 = 338, y0 = 54, w = 258;
            var ROWS = [['md', 'map.md', 0], ['dir', 'lib/', 0], ['js', 'task.js', 1], ['js', 'auth.js', 1], ['js', 'auth-new.js', 1]];
            function top(r) { return 42 + r * 28; }
            card(ctx, x0, y0, w, 190, function () {
                badge(ctx, P, 'dirOpen', '', 14, 11);
                tx(ctx, 'fankeel/', 38, 19.5, { size: 10, weight: '700', mono: true });
                btn(ctx, w - 86, 6, 74, 22, tt('survey.map'), ph === 'problem' ? 'idle' : ph === 'action' ? 'press' : 'done', ph === 'action' ? [w - 15, 25, 0.42] : null);
                E.line(ctx, [[10, 35], [w - 10, 35]], C.line, 1);
                E.line(ctx, [[20, top(2)], [20, top(4) + 24]], C.line, 1);
                ROWS.forEach(function (row, r) {
                    var y = top(r), dupe = r === 4;
                    if (dupe && ph === 'result') return;
                    var ok = ph === 'result' || (ph === 'action' && r < 2);
                    E.fade(ctx, dupe && ph === 'action' ? 0.3 : 1, function () {
                        if (dupe && ph === 'problem') E.box(ctx, 8, y + 2, w - 16, 24, 4, C.failTint);
                        if (ph === 'action' && r === 2) E.box(ctx, 8, y + 2, w - 16, 24, 4, C.keelTint);
                        var x = 14 + row[2] * 16;
                        var bw = badge(ctx, P, row[0] === 'dir' ? 'dirOpen' : row[0], '', x, y + 9);
                        tx(ctx, row[1], x + bw + 6, y + 18, { size: 9.5, mono: true, weight: dupe ? '700' : '400' });
                        if (dupe && ph === 'problem') {
                            var ex = x + bw + 6 + ms(ctx, row[1], 9.5, '700', true) + 2;
                            // the AI's caret, blinking as it types
                            if (Math.floor(CUR.l / 20) % 2 === 0) E.box(ctx, ex, y + 9, 1.6, 11, 0.5, C.ink);
                            aiChip(ctx, w - 26, y + 14);
                            tx(ctx, tt('d.dupe'), w - 42, y + 18, { size: 8.5, weight: '700', fill: C.fail, align: 'right' });
                        }
                        if (ok && !dupe) {
                            okDot(ctx, w - 70, y + 14, 5.5, 1);
                            tx(ctx, tt('survey.have'), w - 14, y + 18, { size: 8.5, weight: '700', fill: C.pass, align: 'right' });
                        }
                    });
                    if (dupe && ph === 'problem') {
                        var ax = 14 + 16, ay = top(3);
                        E.box(ctx, ax - 3, ay + 4, 26 + ms(ctx, 'auth.js', 9.5, '400', true), 20, 4, null, C.fail, 1.3);
                        curve(ctx, [ax - 6, y + 14], [ax - 18, y + 1], [ax - 6, ay + 14], C.fail, 1.3, [2, 2.5]);
                    }
                });
                if (ph === 'action') E.fade(ctx, 0.9, function () { E.box(ctx, 8, top(2) + 24, w - 16, 2.5, 1.2, C.keel); });
            });
            if (ph === 'action') click(ctx, x0 + w - 15, y0 + 25, 0.42, true);
        }
        var MAP = { x: 292, y: 66, w: 320, h: 230 };
        var NODES = {
            readme: [236, 58, 'md', 'README.md'], cli: [84, 62, 'js', 'cli.js'], task: [78, 134, 'js', 'task.js'],
            auth: [236, 128, 'js', 'auth.js'], test: [74, 200, 'jsTest', 'task.test.js'], store: [226, 198, 'js', 'store.js'],
        };
        var EDGES = [['readme', 'cli'], ['cli', 'task'], ['cli', 'auth'], ['task', 'store'], ['auth', 'store'], ['test', 'task'], ['auth', 'task']];
        function mapPanel(ctx, drawn, done) {
            card(ctx, MAP.x, MAP.y, MAP.w, MAP.h, function () {
                badge(ctx, P, 'md', '', 12, 10);
                tx(ctx, 'map.md', 36, 18.5, { size: 10, weight: '700', mono: true });
                E.line(ctx, [[10, 30], [MAP.w - 10, 30]], C.line, 1);
                E.line(ctx, [[MAP.w - 76, 18], [MAP.w - 58, 18]], C.keel, 1.8);
                tx(ctx, tt('d.uses'), MAP.w - 52, 21, { size: 8.5, weight: '700', fill: C.mute });
                EDGES.forEach(function (e, k) {
                    var a = NODES[e[0]], b = NODES[e[1]], u = drawn[k];
                    if (!(u > 0)) return;
                    var q = [E.lerp(a[0], b[0], u), E.lerp(a[1], b[1], u)];
                    E.line(ctx, [[a[0], a[1]], q], done ? C.keel : C.keelMid, 1.8);
                    if (u < 1) E.circle(ctx, q[0], q[1], 3, C.keel);
                });
                Object.keys(NODES).forEach(function (k) {
                    var n = NODES[k], nw = ms(ctx, n[3], 9, '700', true) + 36, nh = 22;
                    E.box(ctx, n[0] - nw / 2, n[1] - nh / 2, nw, nh, 5, done ? C.keelTint : C.card, done ? C.keelMid : C.line, 1.2);
                    badge(ctx, P, n[2], '', n[0] - nw / 2 + 6, n[1] - 5);
                    tx(ctx, n[3], n[0] - nw / 2 + 29, n[1] + 3.4, { size: 9, weight: '700', mono: true });
                });
                if (done) {
                    var a = NODES.auth;
                    okDot(ctx, a[0] + 38, a[1] - 11, 6, E.backOut(E.prog(CUR.l, 4, 12)));
                    tx(ctx, tt('survey.have'), a[0], a[1] + 24, { size: 8.5, weight: '700', fill: C.pass, align: 'center' });
                }
            });
        }
        D.survey = function (ctx, ph) {
            if (ph === 'problem' || ph === 'action') {
                // the tree large in the middle: [467, 149] of it at [320, 182], x1.2
                placeM(ctx, 1.2, 320 - 1.2 * 467, 182 - 1.2 * 149, function () { tree(ctx, ph); });
                return;
            }
            // map / result: the tree steps aside ([338, 54] at [34, 88], x0.8)
            // and becomes the map; in the map beat it slides there first
            var mv = ph === 'map' ? K.inOut(E.prog(CUR.l, 0, 20)) : 1;
            E.fade(ctx, ph === 'map' ? 1 : 0.4, function () {
                placeM(ctx, E.lerp(1.2, 0.8, mv), E.lerp(320 - 1.2 * 467, 34 - 0.8 * 338, mv), E.lerp(182 - 1.2 * 149, 88 - 0.8 * 54, mv),
                    function () { tree(ctx, 'result'); });
            });
            var mk = ph === 'map' ? E.prog(CUR.l, 8, 12) : 1;
            E.fade(ctx, mk, function () {
                arrow(ctx, [250, 170], [284, 170], C.keel, 1.8);
                mapPanel(ctx, ph === 'map' ? EDGES.map(function (e, k) { return E.prog(CUR.l, 11 * k, 24); }) : [1, 1, 1, 1, 1, 1, 1], ph === 'result');
            });
        };

        // design follows one small task: tell the customer when an order
        // ships. [kind, folder, name, lines added]; the lines add up to 1,200
        var PILE = [['js', 'notify/', 'email.js', 220], ['js', 'notify/', 'sms.js', 180], ['js', 'notify/', 'push.js', 200],
            ['dir', 'services/', 'queue/', 340], ['html', 'settings/', 'notify.html', 200], ['db', 'db/', '004_notify.sql', 60]];
        var OUT = [['d.out1', [0, 1, 2]], ['d.out2', [3, 4]], ['d.out3', [5]]];
        // one file chip: icon, name and, in the problem, the lines it adds
        function chip(ctx, x, y, f, o) {
            o = o || {};
            var size = o.size || 8.5, h = o.h || 22, name = o.full ? f[1] + f[2] : f[2];
            var nw = ms(ctx, name, size, '700', true), cnt = o.count ? '+' + f[3] : '';
            var cw = cnt ? ms(ctx, cnt, size, '700', true) + 8 : 0, w = 22 + nw + 7 + cw;
            E.box(ctx, x, y, w, h, 5, C.card, o.stroke || C.line, 1.1);
            badge(ctx, P, f[0], '', x + 4, y + h / 2 - 5.5);
            tx(ctx, name, x + 22, y + h / 2 + size * 0.36, { size: size, weight: '700', mono: true, fill: o.ink || C.ink });
            if (cnt) tx(ctx, cnt, x + w - 7, y + h / 2 + size * 0.36, { size: size, weight: '700', mono: true, fill: C.passInk, align: 'right' });
            return w;
        }
        // a rounded rectangle as a path from its top-left, clockwise, and the
        // first f of it: the boundary being drawn
        function rrPts(x, y, w, h, r) {
            var pts = [[x + r, y]];
            [[x + w - r, y + r, -90], [x + w - r, y + h - r, 0], [x + r, y + h - r, 90], [x + r, y + r, 180]].forEach(function (c) {
                for (var k = 0; k <= 6; k++) { var a = (c[2] + k * 15) * RAD; pts.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); }
            });
            return pts;
        }
        function boundary(ctx, x, y, w, h, f, big) {
            var lw = big ? 2.8 : 1.8;
            if (f >= 1) E.box(ctx, x, y, w, h, 10, 'rgba(227,234,251,.55)', C.keel, lw);
            else {
                E.box(ctx, x, y, w, h, 10, 'rgba(227,234,251,.3)');
                var pts = partialOpen(rrPts(x, y, w, h, 10), f), e = pts[pts.length - 1];
                E.line(ctx, pts, C.keel, lw);
                E.circle(ctx, e[0], e[1], 8, 'rgba(45,91,216,.18)');
                E.circle(ctx, e[0], e[1], 4, C.keel);
            }
            pill(ctx, x + 12, y - 7.5, tt('d.in'), C.keel, C.card);
        }
        function inItems(ctx, x, y, gap, size) {
            ['d.in1', 'd.in2', 'd.in3'].forEach(function (k, r) {
                var yy = y + r * gap;
                okDot(ctx, x + 6, yy - size * 0.36, size * 0.58, 1);
                tx(ctx, tt(k), x + 18, yy, { size: size, maxW: 232 });
            });
        }
        function minus(ctx, x, y) {
            E.circle(ctx, x, y, 5, null, C.faint, 1.2);
            E.line(ctx, [[x - 2.5, y], [x + 2.5, y]], C.faint, 1.3);
        }
        var SC = { x: 32, y: 66, w: 576, h: 232 };
        function specHead(ctx) {
            panel(ctx, SC.w, SC.h);
            badge(ctx, P, 'md', '', 12, 9);
            tx(ctx, 'spec.md', 36, 17.5, { size: 10, weight: '700', mono: true });
            E.line(ctx, [[10, 28], [SC.w - 10, 28]], C.line, 1);
            var gw = pill(ctx, 12, 37, tt('d.goal'), C.keelTint, C.keelDeep);
            tx(ctx, tt('d.goalLine'), 12 + gw + 8, 49, { size: 11, weight: '700', maxW: SC.w - gw - 40 });
        }
        // the boundary drawn so that at the styleframe's frame it is 0.86 round
        var DEFINE_LEN = 76;
        function specCard(ctx, ph) {
            group(ctx, SC.x, SC.y, 1, 0, function () {
                specHead(ctx);
                if (ph === 'define') {
                    boundary(ctx, 12, 74, 262, 146, E.prog(CUR.l, 0, DEFINE_LEN), true);
                    inItems(ctx, 26, 116, 36, 10.5);
                    tx(ctx, tt('d.out'), 306, 84, { size: 9, weight: '700', fill: C.faint });
                    OUT.forEach(function (row, r) {
                        var y = 110 + r * 40, x = 324;
                        arrow(ctx, [282, y + 6], [300, y + 6], C.faint, 1.3);
                        minus(ctx, 312, y - 3.5);
                        tx(ctx, tt(row[0]), 324, y, { size: 9.5, fill: C.mute });
                        E.fade(ctx, 0.55, function () {
                            row[1].forEach(function (k) { x += chip(ctx, x, y + 6, PILE[k], { size: 7.5, h: 17, ink: C.mute }) + 5; });
                        });
                    });
                    return;
                }
                var res = ph === 'result';
                boundary(ctx, 12, 74, 262, 80, 1, false);
                inItems(ctx, 24, 100, 19, 9.5);
                tx(ctx, tt('d.out'), 14, 178, { size: 8.5, weight: '700', fill: C.faint });
                E.fade(ctx, 0.5, function () {
                    var x = 14;
                    [0, 1, 2].forEach(function (k) { x += chip(ctx, x, 184, PILE[k], { size: 7.5, h: 16, ink: C.mute }) + 5; });
                    x = 14;
                    [3, 4, 5].forEach(function (k) { x += chip(ctx, x, 204, PILE[k], { size: 7.5, h: 16, ink: C.mute }) + 5; });
                });
                E.line(ctx, [[292, 64], [292, 220]], C.line, 1);
                pill(ctx, 306, 66, tt('d.accept'), C.passTint, C.passInk);
                ['d.acc1', 'd.acc2'].forEach(function (k, r) {
                    var y = 98 + r * 20;
                    E.box(ctx, 308, y - 9, 10, 10, 2.5, C.card, C.faint, 1.2);
                    if (res) E.tick(ctx, 310, y - 4, 0.28, E.prog(CUR.l, 2 + r * 4, 8), C.pass, 1.5);
                    tx(ctx, tt(k), 324, y, { size: 9.5, maxW: 240 });
                });
                pill(ctx, 306, 128, tt('d.how'), C.keelTint, C.keelDeep);
                tx(ctx, tt('d.howLine'), 306, 162, { size: 10.5, weight: '700', maxW: 258 });
                // the one screen it touches, attached and small
                var att = tt('d.attach'), aw = 46 + ms(ctx, att, 8.5, '400') + 10;
                E.box(ctx, 306, 188, aw, 28, 5, C.card, C.line, 1);
                E.box(ctx, 312, 192, 30, 20, 2, C.paper, C.line, 0.8);
                E.box(ctx, 315, 195, 18, 3, 1, C.block);
                E.box(ctx, 315, 200, 24, 5, 1, C.keelTint);
                E.box(ctx, 315, 200, 1.5, 5, 0.5, C.keel);
                E.box(ctx, 315, 207, 14, 2.5, 1, C.block);
                tx(ctx, att, 348, 205.5, { size: 8.5, fill: C.mute });
                btn(ctx, 476, 190, 88, 26, tt('d.agree'), res ? 'done' : 'press', res ? null : [550, 210, 0.45]);
            });
        }
        D.design = function (ctx, ph) {
            if (ph === 'problem') {
                card(ctx, 32, 128, 186, 80, function () {
                    pill(ctx, 12, 12, tt('d.want'), C.keelTint, C.keelDeep);
                    tx(ctx, tt('d.req'), 12, 52, { size: 11.5, weight: '700', maxW: 162 });
                });
                aiChip(ctx, 230, 168);
                arrow(ctx, [241, 168], [262, 168], C.fail, 1.6);
                var px = 268, py = 74, pw = 338, pH = 202, TILT = [-2, 1.5, 2.5, -1.5, -1, 2];
                card(ctx, px, py, pw, pH, function () {
                    tx(ctx, tt('d.got'), 14, 22, { size: 11, weight: '700', fill: C.mute });
                    var uw = ms(ctx, tt('d.linesU'), 10, '700');
                    tx(ctx, tt('d.linesU'), pw - 14, 23, { size: 10, weight: '700', fill: C.failInk, align: 'right' });
                    tx(ctx, '+1,200', pw - 18 - uw, 24, { size: 18, weight: '700', mono: true, fill: C.fail, align: 'right' });
                    E.line(ctx, [[10, 34], [pw - 10, 34]], C.line, 1);
                    PILE.forEach(function (f, k) {
                        var col = k % 2, row = (k / 2) | 0, pk = E.prog(CUR.l, 2 + k * 3, 10);
                        if (!(pk > 0)) return;
                        E.fade(ctx, Math.min(1, pk * 2), function () {
                            group(ctx, 14 + col * 164 + (row === 1 ? 6 : 0), 46 + row * 34 + (1 - E.expoOut(pk)) * 8, 1, TILT[k] * RAD, function () {
                                chip(ctx, 0, 0, f, { full: true, count: true });
                            });
                        });
                    });
                }, { stroke: C.fail, lw: 1.6 });
                xDot(ctx, px + pw, py, 8, 1);
                stamp(ctx, CUR.l, 30, px + pw / 2, py + 170, -7, 130, 34, C.fail, function () {
                    tx(ctx, tt('d.tooBig'), 0, 5.5, { size: 15, weight: '700', fill: C.fail, align: 'center' });
                });
                return;
            }
            specCard(ctx, ph);
            if (ph === 'direction') click(ctx, 32 + 550, 66 + 210, 0.45, true);
            else if (ph === 'result') stamp(ctx, CUR.l, 8, 546, 86, -6, 104, 32, C.pass, function () {
                tx(ctx, tt('design.ok'), 0, 5.5, { size: 14, weight: '700', fill: C.pass, align: 'center' });
            });
        };

        // plan picks up design's approved spec.md: one long document whose
        // attention strip fades, sliced by 自動拆解 into four short cards,
        // then the same cards as who waits on whom
        var TASKS = [
            { t: 'p.t1', f: ['js', 'orders/', 'status.js'], proof: ['jsTest', 'tests/', 'status.test.js'], waits: [] },
            { t: 'p.t2', f: ['js', 'components/', 'Notice.js'], proof: ['jsTest', 'tests/', 'Notice.test.js'], waits: [] },
            { t: 'p.t3', f: ['html', 'pages/', 'order.html'], proof: ['jsTest', 'tests/', 'order.test.js'], waits: [1, 2] },
            { t: 'p.t4', f: ['jsTest', 'tests/', 'notify.test.js'], proof: [null, '', 'npm test'], waits: [3] },
        ];
        // the attention strip: full, or fading from full blue at the top
        function heat(ctx, x, y, w, h, full, horiz) {
            var g = C.keel;
            if (!full) {
                g = horiz ? ctx.createLinearGradient(x, 0, x + w, 0) : ctx.createLinearGradient(0, y, 0, y + h);
                if (g && g.addColorStop) { g.addColorStop(0, C.keel); g.addColorStop(0.3, 'rgba(45,91,216,.6)'); g.addColorStop(1, 'rgba(45,91,216,.07)'); }
                else g = C.keelMid;
            }
            E.box(ctx, x, y, w, h, Math.min(w, h) / 2, g);
        }
        function num(ctx, x, y, n, r, fill) {
            E.circle(ctx, x, y, r, fill || C.keel);
            tx(ctx, String(n), x, y + r * 0.42, { size: r * 1.2, weight: '700', mono: true, fill: C.card, align: 'center' });
        }
        // a file's icon and its path on one baseline (the styleframes' plan
        // cards; the page's later audit helper of the same name is aLine)
        function pLine(ctx, x, by, f, size, o) {
            o = o || {};
            var ix = x;
            if (f[0]) { badge(ctx, P, f[0], '', x - 2, by - size * 0.36 - 5.5); ix = x + 17; }
            tx(ctx, f[1] + f[2], ix, by, { size: size, weight: o.weight || '400', mono: true, fill: o.ink || C.ink, maxW: o.maxW ? o.maxW - (ix - x) : 0 });
        }
        function waitWords(k) {
            return tt('p.waits') + ' ' + TASKS[k].waits.join(P.lang === 'zh' ? '、' : ', ');
        }
        function taskHead(ctx, k, w, h, size) {
            heat(ctx, 6, 7, 3.5, h - 14, true);
            badge(ctx, P, 'md', '', 14, h > 30 ? 9 : h / 2 - 5.5);
            tx(ctx, 'task-' + (k + 1) + '.md', 36, h > 30 ? 17.5 : h / 2 + size * 0.36, { size: size, weight: '700', mono: true });
        }
        var DOC = { x: 32, y: 66, w: 318, h: 232 };
        var CUTS = [90, 139, 196];
        function longDoc(ctx, ph) {
            var w = DOC.w, h = DOC.h, act = ph === 'action';
            group(ctx, DOC.x, DOC.y, 1, 0, function () {
                panel(ctx, w, h);
                badge(ctx, P, 'md', '', 12, 9);
                tx(ctx, 'spec.md', 36, 17.5, { size: 10, weight: '700', mono: true });
                pill(ctx, 42 + ms(ctx, 'spec.md', 10, '700', true), 7, tt('design.ok'), C.passTint, C.passInk);
                E.line(ctx, [[10, 28], [w - 10, 28]], C.line, 1);
                E.box(ctx, w - 8, 34, 3, h - 42, 1.5, C.paper);
                E.box(ctx, w - 8, 34, 3, 22, 1.5, C.block);
                heat(ctx, 10, 36, 5, h - 46, false);
                var x = 24;
                tx(ctx, tt('d.goalLine'), x, 47, { size: 9, weight: '700', maxW: w - 50 });
                ['d.in1', 'd.in2', 'd.in3'].forEach(function (k, r) {
                    okDot(ctx, x + 4, 58 + r * 12 - 3, 3.6, 1);
                    tx(ctx, tt(k), x + 12, 58 + r * 12, { size: 8, fill: C.ink, maxW: w - 60 });
                });
                tx(ctx, tt('p.more'), x, 102, { size: 8, weight: '700', fill: C.mute, maxW: w - 50 });
                for (var r = 0; r < 13; r++) {
                    var y = 110 + r * 6.5, bw = 80 + K.rnd(r + 7) * 180, ind = K.rnd(r + 30) > 0.7 ? 10 : 0;
                    E.box(ctx, x + ind, y, Math.min(bw, w - 50 - ind), 3, 1.5, C.block);
                }
                var my = 208;
                minus(ctx, x + 5, my - 3.5);
                tx(ctx, tt('d.out3'), x + 14, my, { size: 8.5, fill: C.mute });
                var mw = ms(ctx, tt('d.out3'), 8.5, '400');
                if (!act) {
                    ctx.setLineDash([2.5, 2]); E.box(ctx, x - 4, my - 11, mw + 24, 16, 3, null, C.fail, 1.2); ctx.setLineDash([]);
                    pill(ctx, x + mw + 26, my - 11.5, tt('p.miss'), C.failTint, C.failInk);
                }
                for (r = 0; r < 2; r++) E.box(ctx, x, 218 + r * 6, 70 + K.rnd(r + 60) * 120, 3, 1.5, C.block);
                if (act) {
                    // sliced after the click: a cut between the tasks, each
                    // piece numbered where it leaves
                    E.fade(ctx, E.prog(CUR.l, CLICK_AT, 8), function () {
                        CUTS.forEach(function (cy) { E.line(ctx, [[-6, cy], [w + 6, cy]], C.keel, 1.6, [5, 3.5]); });
                        [28].concat(CUTS).forEach(function (cy, k) { num(ctx, w - 20, (cy + (CUTS[k] || h)) / 2, k + 1, 6.5); });
                    });
                    btn(ctx, w - 100, 5, 86, 20, tt('p.split'), 'press', [w - 20, 21, 0.45]);
                }
            });
        }
        D.plan = function (ctx, ph) {
            if (ph === 'problem') {
                longDoc(ctx, ph);
                var rx = 380;
                tx(ctx, 'context', rx, 94, { size: 8.5, weight: '700', mono: true, fill: C.mute });
                E.box(ctx, rx, 100, 224, 10, 5, C.line);
                E.box(ctx, rx, 100, 224 * 0.94 * E.expoOut(E.prog(CUR.l, 0, 40)), 10, 5, C.keel);
                heat(ctx, rx, 132, 70, 6, false, true);
                tx(ctx, tt('p.attn'), rx + 78, 138, { size: 9, weight: '700', fill: C.mute });
                var cy = 206;
                aiChip(ctx, rx + 10, cy);
                arrow(ctx, [rx + 21, cy], [rx + 40, cy], C.fail, 1.6);
                var cw = chip(ctx, rx + 44, cy - 12, PILE[5], { full: true, size: 9, h: 24, stroke: C.fail });
                xDot(ctx, rx + 44 + cw, cy - 12, 7, 1);
                var ex = DOC.x + 24 + ms(ctx, tt('d.out3'), 8.5, '400') + 26 + ms(ctx, tt('p.miss'), 8.5, '700') + 14 + 3;
                curve(ctx, [ex, DOC.y + 204], [rx + 8, DOC.y + 204], [rx + 10, cy + 12], C.fail, 1.3, [2, 2.5]);
                return;
            }
            if (ph === 'action') {
                // four short cards leave the page after the click, one after another
                var sx = 390, sw = 216;
                [0, 1, 2, 3].forEach(function (k) {
                    var p = E.prog(CUR.l, 14 + 16 * k, 40), a = Math.min(1, 0.3 + p), off = -70 * (1 - p);
                    if (!(p > 0)) return;
                    var y = 76 + k * 52, cx = sx + off;
                    var from = [DOC.x + DOC.w, DOC.y + ([28].concat(CUTS)[k] + (CUTS[k] || DOC.h)) / 2];
                    if (k < 3) E.fade(ctx, a, function () { curve(ctx, from, [from[0] + 18, y + 21], [cx - 3, y + 21], C.keelMid, 1.3, [3, 3]); });
                    E.fade(ctx, a, function () {
                        card(ctx, cx, y, sw, 42, function () {
                            taskHead(ctx, k, sw, 42, 8.5);
                            tx(ctx, tt(TASKS[k].t), 14, 34, { size: 9.5, weight: '700', maxW: sw - 24 });
                        }, { blur: 8, dy: 4 });
                    });
                });
                longDoc(ctx, ph);
                click(ctx, DOC.x + DOC.w - 20, DOC.y + 21, 0.45, true);
                return;
            }
            if (ph === 'cards') {
                heat(ctx, 32, 83, 40, 5, true, true);
                tx(ctx, tt('p.attn'), 78, 88.5, { size: 9, weight: '700', fill: C.mute });
                var w = 138, h = 162;
                TASKS.forEach(function (T, k) {
                    card(ctx, 32 + k * 146, 104, w, h, function () {
                        taskHead(ctx, k, w, h, 9);
                        aiChip(ctx, w - 16, 16);
                        tx(ctx, tt(T.t), 16, 40, { size: 10, weight: '700', maxW: w - 26 });
                        E.line(ctx, [[16, 50], [w - 10, 50]], C.line, 1);
                        [['p.edits', 66], ['p.proof', 100], ['p.waits', 134]].forEach(function (l) {
                            tx(ctx, tt(l[0]), 16, l[1], { size: 7.5, weight: '700', fill: C.mute });
                        });
                        pLine(ctx, 18, 80, T.f, 7.5, { maxW: w - 26 });
                        pLine(ctx, 18, 114, T.proof, 7.5, { maxW: w - 26 });
                        if (!T.waits.length) tx(ctx, tt('p.noWait'), 16, 148, { size: 8, weight: '700', fill: C.passInk });
                        else T.waits.forEach(function (n, j) { num(ctx, 22 + j * 16, 145, n, 6); });
                    });
                });
                return;
            }
            // the result: 1 and 2 at once; 3 after both; 4 after 3
            var w2 = 158, h2 = 80, POS = [[36, 80], [36, 200], [240, 140], [446, 140]];
            var mid = function (k) { var p = POS[k]; return [p[0] + w2, p[1] + h2 / 2]; };
            E.line(ctx, [[36 + w2 / 2, 80 + h2], [36 + w2 / 2, 200]], C.keelMid, 1.4);
            var pw = ms(ctx, tt('par'), 8.5, '700') + 14;
            pill(ctx, 36 + w2 / 2 - pw / 2, 172.5, tt('par'), C.keelTint, C.keelDeep);
            arrow(ctx, mid(0), [POS[2][0] - 3, POS[2][1] + h2 / 2 - 10], C.mute, 1.4);
            arrow(ctx, mid(1), [POS[2][0] - 3, POS[2][1] + h2 / 2 + 10], C.mute, 1.4);
            arrow(ctx, mid(2), [POS[3][0] - 3, POS[3][1] + h2 / 2], C.mute, 1.4);
            TASKS.forEach(function (T, k) {
                var p = POS[k];
                card(ctx, p[0], p[1], w2, h2, function () {
                    taskHead(ctx, k, w2, h2, 9);
                    tx(ctx, tt(T.t), 16, 38, { size: 10, weight: '700', maxW: w2 - 24 });
                    pLine(ctx, 18, 56, T.f, 7.5, { maxW: w2 - 26 });
                    pLine(ctx, 18, 70, T.proof, 7.5, { maxW: w2 - 26, ink: C.mute });
                });
                if (T.waits.length) pill(ctx, p[0] + 12, p[1] - 7.5, waitWords(k), C.keel, C.card);
            });
        };

        // build: plan's four cards go to four agents, one each; six beats
        var LN = { y: [124, 166, 208, 250], av: 32, bx: 88, bw: 204, rv: 306, rz: 330 };
        var DL = { av: 300, bx: 356, deck: [32, 172], cw: 108, ch: 30 };   // deal only
        var WORK = [[0, 0.36], [0, 0.44], [0.5, 0.76], [0.78, 1]], FIX = [0.36, 0.46];
        // the deal: card k leaves the deck at DEAL.at + k * DEAL.gap and
        // lands DEAL.len later (at the styleframe 1 and 2 have landed, 3 is
        // half way, 4 is on the deck)
        var DEAL = { at: 20, gap: 22, len: 26 };
        function agentPill(ctx, x, y, k, a) {
            E.fade(ctx, a == null ? 1 : a, function () {
                E.box(ctx, x, y - 11, 42, 22, 11, AGC[k]);
                tx(ctx, 'AI ' + (k + 1), x + 21, y + 3.4, { size: 9.5, weight: '700', mono: true, fill: C.card, align: 'center' });
            });
        }
        function laneTrack(ctx, x, y, w) { E.box(ctx, x, y - 5, w, 10, 5, C.line); }
        function laneSpan(ctx, x, w, y, a, b, fill) { if (b > a) E.box(ctx, x + w * a, y - 5, w * (b - a), 10, 5, fill); }
        function laneTitle(ctx, x, y, k, w) {
            var n = 'task-' + (k + 1) + '.md', nw = ms(ctx, n, 7.5, '700', true);
            tx(ctx, n, x, y - 10, { size: 7.5, weight: '700', mono: true });
            tx(ctx, tt(TASKS[k].t), x + nw + 6, y - 10, { size: 8, weight: '700', fill: C.mute, maxW: w - nw - 6 });
        }
        function waitTag(ctx, x, y, k) {
            var s = waitWords(k), w = ms(ctx, s, 8.5, '700') + 14;
            E.box(ctx, x, y - 7.5, w, 15, 4, C.card, C.faint, 1);
            tx(ctx, s, x + w / 2, y + 3.5, { size: 8.5, weight: '700', fill: C.mute, align: 'center' });
        }
        function closedCard(ctx, x, y, k) {
            card(ctx, x, y, DL.cw, DL.ch, function () { taskHead(ctx, k, DL.cw, DL.ch, 8.5); }, { blur: 6, dy: 3 });
        }
        // task-1's change, as the reviewer reads it; fixed: after 退回
        function diffPanel(ctx, fixed) {
            var x = LN.rz, y = 104, w = 280, h = 188;
            group(ctx, x, y, 1, 0, function () {
                panel(ctx, w, h);
                badge(ctx, P, 'js', '', 10, 9);
                tx(ctx, 'orders/status.js', 32, 18, { size: 9, weight: '700', mono: true });
                var tl = 'task-1', tw = ms(ctx, tl, 8, '700', true) + 14;
                E.box(ctx, w - 12 - tw, 7, tw, 15, 7.5, AGC[0]);
                tx(ctx, tl, w - 12 - tw / 2, 17.8, { size: 8, weight: '700', mono: true, fill: C.card, align: 'center' });
                E.line(ctx, [[8, 28], [w - 8, 28]], C.line, 1);
                var rows = fixed
                    ? [[' ', "on('status', order => {"], ['+', "  if (order.status !== 'shipped') return", 'fix'], ['+', '  notify(order.customer)'], ['c'], [' ', '})']]
                    : [[' ', "on('status', order => {"], ['+', '  notify(order.customer)', 'flaw'], ['c'], [' ', '})']];
                var ly = 36, n = 12;
                rows.forEach(function (ln) {
                    if (ln[0] === 'c') {
                        var ch = 30;
                        E.box(ctx, 10, ly + 2, w - 20, ch, 5, fixed ? C.card : C.failTint, fixed ? C.line : C.fail, 1.2);
                        E.circle(ctx, 26, ly + 2 + ch / 2, 8, C.ink);
                        icon(ctx, 'searchLight', 20, ly + 2 + ch / 2 - 6, 12, 12);
                        var s = tt('b.flaw'), fy = ly + 2 + ch / 2 + 3.5;
                        tx(ctx, s, 42, fy, { size: 9.5, weight: '700', fill: fixed ? C.faint : C.failInk, maxW: w - 62 });
                        if (fixed) {
                            var sw = Math.min(ms(ctx, s, 9.5, '700'), w - 62);
                            E.line(ctx, [[40, fy - 3.4], [40 + (4 + sw) * E.prog(CUR.l, 10, 14), fy - 3.4]], C.faint, 1.3);
                        }
                        ly += ch + 6;
                        return;
                    }
                    if (ln[0] === '+') E.box(ctx, 6, ly, w - 12, 16, 3, C.passTint);
                    tx(ctx, String(n++), 22, ly + 11.5, { size: 7.5, mono: true, fill: C.faint, align: 'right' });
                    tx(ctx, ln[0], 29, ly + 11.5, { size: 8, weight: '700', mono: true, fill: ln[0] === '+' ? C.passInk : C.faint });
                    tx(ctx, ln[1], 38, ly + 11.5, { size: 8, mono: true, fill: C.ink });
                    if (ln[2] === 'flaw') E.box(ctx, 3, ly - 2, w - 6, 20, 4, null, C.fail, 1.5);
                    if (ln[2] === 'fix') E.box(ctx, 3, ly - 2, w - 6, 20, 4, null, C.pass, 1.5);
                    ly += 18;
                });
                if (fixed) stamp(ctx, CUR.l, 36, w - 70, h - 26, -6, 96, 30, C.pass, function () {
                    var s = tt('b.pass'), sw = ms(ctx, s, 13, '700') + 18;
                    E.tick(ctx, -sw / 2, 0.5, 0.42, 1, C.pass, 2.2);
                    tx(ctx, s, -sw / 2 + 18, 5, { size: 13, weight: '700', fill: C.pass });
                });
                else stamp(ctx, CUR.l, 36, w - 70, h - 26, -6, 96, 30, C.fail, function () {
                    tx(ctx, tt('b.back'), 0, 5, { size: 13, weight: '700', fill: C.fail, align: 'center' });
                });
            });
        }
        function buildDeal(ctx) {
            var d0 = [DL.deck[0] + DL.cw, DL.deck[1] + DL.ch / 2];
            var arcAt = function (k, u) {
                var p2 = [DL.av - 5, LN.y[k]], c = [226, LN.y[k]], v = 1 - u;
                return [v * v * d0[0] + 2 * u * v * c[0] + u * u * p2[0], v * v * d0[1] + 2 * u * v * c[1] + u * u * p2[1]];
            };
            var fly = [0, 1, 2, 3].map(function (k) { return E.prog(CUR.l, DEAL.at + k * DEAL.gap, DEAL.len); });
            // the arcs: one per card, from its launch; paler once it has landed
            [0, 1, 2, 3].forEach(function (k) {
                if (!(fly[k] > 0)) return;
                E.fade(ctx, fly[k] >= 1 ? 0.55 : 0.9, function () {
                    ctx.beginPath(); ctx.moveTo(d0[0] + 2, d0[1]); ctx.quadraticCurveTo(226, LN.y[k], DL.av - 5, LN.y[k]);
                    ctx.strokeStyle = AGC[k]; ctx.lineWidth = 1.4; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
                    group(ctx, DL.av - 3, LN.y[k], 1, 0, function () { fillPoly(ctx, [[0, 0], [-6, -3.4], [-6, 3.4]], AGC[k]); });
                });
            });
            // the deck: the cards not yet dealt, the last one on top
            for (var k = 3; k >= 0; k--) if (!(fly[k] > 0)) closedCard(ctx, DL.deck[0] - (3 - k) * 2, DL.deck[1] - (3 - k) * 2, k);
            LN.y.forEach(function (y, j) {
                agentPill(ctx, DL.av, y, j);
                laneTrack(ctx, DL.bx, y, LN.bw);
                if (fly[j] >= 1) {
                    var land = DEAL.at + j * DEAL.gap + DEAL.len;
                    E.fade(ctx, E.prog(CUR.l, land, 8), function () { laneTitle(ctx, DL.bx, y, j, LN.bw); });
                    laneSpan(ctx, DL.bx, LN.bw, y, 0, 0.06 * E.prog(CUR.l, land, 10), AGC[j]);
                }
            });
            [0, 1, 2, 3].forEach(function (j) {
                if (!(fly[j] > 0 && fly[j] < 1)) return;
                var q = arcAt(j, fly[j]);
                group(ctx, q[0], q[1], 1, 5 * RAD, function () { closedCard(ctx, -DL.cw / 2, -DL.ch / 2, j); });
            });
            click(ctx, 106, 92, 0.4, true);
        }
        D.build = function (ctx, ph) {
            if (ph === 'problem') {
                aiChip(ctx, 48, 118);
                var sw = 130;
                TASKS.forEach(function (T, k) {
                    var x = 68 + k * 136;
                    badge(ctx, P, 'md', '', x - 2, 89);
                    tx(ctx, 'task-' + (k + 1) + '.md', x + 17, 97.5, { size: 8.5, weight: '700', mono: true, fill: k ? C.mute : C.ink });
                    E.box(ctx, x, 112, sw, 12, 6, C.line);
                    if (!k) E.box(ctx, x, 112, sw * E.lerp(0.45, 0.62, E.prog(CUR.l, 0, 90)), 12, 6, C.keel);
                    else tx(ctx, tt('build.queued'), x + sw / 2, 142, { size: 8.5, weight: '700', fill: C.mute, align: 'center' });
                });
                E.line(ctx, [[32, 170], [608, 170]], C.block, 1, [3, 4]);
                var fw = 142, fh = 32, cy = 232, fx = 320 - fw / 2, fy = cy - fh / 2;
                [[176, C.keel, 'A'], [464, C.ink, 'B']].forEach(function (s) {
                    E.circle(ctx, s[0], cy, 13, s[1]);
                    tx(ctx, s[2], s[0], cy + 4, { size: 11, weight: '700', mono: true, fill: C.card, align: 'center' });
                    tx(ctx, 'session ' + s[2], s[0], cy + 28, { size: 8.5, mono: true, fill: C.mute, align: 'center' });
                });
                arrow(ctx, [191, cy], [fx - 3, cy], C.ink, 1.4);
                arrow(ctx, [449, cy], [fx + fw + 3, cy], C.ink, 1.4);
                card(ctx, fx, fy, fw, fh, function () {
                    badge(ctx, P, 'js', '', 10, 11);
                    tx(ctx, 'orders/status.js', 32, 20, { size: 10, weight: '700', mono: true });
                }, { stroke: C.fail, lw: 1.6 });
                xDot(ctx, fx + fw, fy, 6.5, 1);
                return;
            }
            var deal = ph === 'action';
            btn(ctx, 32, 74, 80, 24, tt('d.dispatch'), deal ? 'press' : 'done', deal ? [106, 92, 0.4] : null);
            if (deal) { buildDeal(ctx); return; }
            var run = ph === 'run', rev = ph === 'review', pass = ph === 'pass', res = ph === 'result';
            // run: the dealt lanes slide from the deal's place to LN first
            var slide = run ? (1 - K.inOut(E.prog(CUR.l, 0, 20))) * (DL.av - LN.av) : 0;
            var after = run ? E.prog(CUR.l, 16, 10) : 1;
            group(ctx, slide, 0, 1, 0, function () {
                LN.y.forEach(function (y, k) {
                    var waiting = (run || rev) ? k >= 2 : pass ? k === 3 : false;
                    agentPill(ctx, LN.av, y, k, waiting ? E.lerp(1, 0.5, after) : 1);
                    laneTrack(ctx, LN.bx, y, LN.bw);
                    E.fade(ctx, waiting ? E.lerp(1, 0.5, after) : 1, function () { laneTitle(ctx, LN.bx, y, k, LN.bw); });
                    if (waiting) { E.fade(ctx, after, function () { waitTag(ctx, LN.bx, y, k); }); return; }
                    var w = WORK[k], fill = res ? C.pass : AGC[k];
                    if (run) laneSpan(ctx, LN.bx, LN.bw, y, 0, E.lerp(0.06, 0.3, E.prog(CUR.l, 0, CUR.sl)) + 0.04 * E.prog(CUR.l, CUR.sl, 42), fill);
                    else if (rev) laneSpan(ctx, LN.bx, LN.bw, y, 0, k ? 0.42 : w[1], fill);
                    else if (pass && k === 2) laneSpan(ctx, LN.bx, LN.bw, y, w[0], E.lerp(w[0], 0.56, E.prog(CUR.l, 0, CUR.sl)), fill);
                    else laneSpan(ctx, LN.bx, LN.bw, y, w[0], k ? w[1] : FIX[1], fill);
                    if (rev && !k) {
                        var s = tt('b.back'), bw2 = ms(ctx, s, 8.5, '700') + 14;
                        E.box(ctx, LN.bx + LN.bw * w[1] + 5, y - 7.5, bw2, 15, 4, C.failTint, C.fail, 1);
                        tx(ctx, s, LN.bx + LN.bw * w[1] + 5 + bw2 / 2, y + 3.5, { size: 8.5, weight: '700', fill: C.failInk, align: 'center' });
                    }
                    if ((pass || res) && !k) E.line(ctx, [[LN.bx + LN.bw * FIX[0], y - 5], [LN.bx + LN.bw * FIX[0], y + 5]], C.card, 1.4);
                    if (rev && !k) verdict(ctx, LN.rv, y, false);
                    if ((pass && k < 2) || res) verdict(ctx, LN.rv, y, true);
                });
            });
            if (run) {
                E.fade(ctx, after, function () {
                    var fileAt = [];
                    TASKS.forEach(function (T, k) {
                        var y = LN.y[k], f = k === 1 ? TASKS[0].f : T.f;
                        E.fade(ctx, k >= 2 ? 0.4 : 1, function () {
                            fileAt[k] = chip(ctx, LN.rz, y - 9, f, { full: true, size: 7.5, h: 18, stroke: k < 2 ? C.signal : null });
                        });
                    });
                    var ex = LN.rz + fileAt[0] + 5, my = (LN.y[0] + LN.y[1]) / 2;
                    E.line(ctx, [[ex, LN.y[0]], [ex + 5, LN.y[0]], [ex + 5, LN.y[1]], [ex, LN.y[1]]], C.signal, 1.4);
                    var s2 = P.lang === 'zh' ? tt('clash.same') + ' · 1、2 ' + tt('clash.editing') : tt('clash.same') + ' · 1, 2 ' + tt('clash.editing').toLowerCase();
                    var tw = ms(ctx, s2, 8, '700') + 14;
                    E.box(ctx, ex + 11, my - 9, tw, 18, 5, C.signalTint, C.signal, 1.2);
                    tx(ctx, s2, ex + 11 + tw / 2, my + 3, { size: 8, weight: '700', fill: C.signalInk, align: 'center' });
                });
                return;
            }
            if (rev || pass) {
                // the reviewer: dark, with the magnifier
                var rs = tt('b.reviewer'), rw = 32 + ms(ctx, rs, 9.5, '700') + 11;
                E.box(ctx, LN.rz, 85 - 11, rw, 22, 11, C.ink);
                icon(ctx, 'searchLight', LN.rz + 9, 85 - 7, 14, 14);
                tx(ctx, rs, LN.rz + 29, 85 + 3.4, { size: 9.5, weight: '700', fill: C.card });
                diffPanel(ctx, pass);
                return;
            }
            // result: what changed, reviewed, and the gate to verify open
            tx(ctx, tt('b.reviewed'), LN.rv, 104, { size: 8.5, weight: '700', fill: C.mute, align: 'center' });
            tx(ctx, tt('b.changes'), LN.rz + 6, 104, { size: 8.5, weight: '700', fill: C.mute });
            var GX5 = 552, GY = (LN.y[1] + LN.y[2]) / 2, open = E.backOut(E.prog(CUR.l, 4, 16));
            TASKS.forEach(function (T, k) {
                var y = LN.y[k], fw2 = chip(ctx, LN.rz + 6, y - 9, T.f, { full: true, size: 7.5, h: 18 });
                curve(ctx, [LN.rz + 6 + fw2 + 4, y], [GX5 - 40, y], [GX5 - 6, GY + (k - 1.5) * 5], 'rgba(22,132,90,.45)', 1.3);
            });
            E.line(ctx, [[GX5, 100], [GX5, GY - 20]], C.faint, 2, [4, 3]);
            E.line(ctx, [[GX5, GY + 20], [GX5, 274]], C.faint, 2, [4, 3]);
            [-1, 1].forEach(function (d) {
                group(ctx, GX5, GY + d * 20, 1, d * 40 * open * RAD, function () { E.box(ctx, 0, -2.5, 18, 5, 2.5, C.pass); });
                E.circle(ctx, GX5, GY + d * 20, 3.6, C.ink);
            });
            arrow(ctx, [GX5 - 4, GY], [E.lerp(GX5 + 8, 604, E.expoOut(E.prog(CUR.l, 10, 16))), GY], C.pass, 2);
            var vc = mix(P.st.verify, C.ink, 0.28);
            tx(ctx, '05', 606, GY - 14, { size: 9, weight: '700', mono: true, fill: vc, align: 'right' });
            tx(ctx, 'verify', 606, GY + 22, { size: 11, weight: '700', fill: vc, align: 'right' });
        };

        // verify: evidence, not confidence; four beats on the same example
        var VT = { x: 32, y: 68, w: 576, h: 128 };
        var VCOL = { src: 14, crit: 30, cmd: 206, out: 374, mark: 560 };
        var VLOW = { y: 210, h: 88, lw: 300, tx: 344, tw: 264 };
        var VROWS = [
            { src: 'md', k: 'd.acc1', cmd: 'npm test notify', out: '4 passed' },
            { src: 'rev', k: 'v.cancel', cmd: 'tests/notify.test.js › cancelled', out: '0 notices' },
            { src: 'md', k: 'd.acc2', cmd: 'git diff --stat db/ services/', out: '' },
        ];
        function outChip(ctx, x, cy, s, col, ui) {
            var w = (ui ? ms(ctx, s, 8, '400') : ms(ctx, s, 7.5, '400', true)) + 14;
            E.box(ctx, x, cy - 8, w, 16, 3, C.ink);
            tx(ctx, s, x + 7, cy + 3, { size: ui ? 8 : 7.5, mono: !ui, fill: col });
            return w;
        }
        var TAGC = { bad: [C.failTint, C.fail, C.failInk], good: [C.passTint, C.pass, C.passInk], warn: [C.signalTint, C.signal, C.signalInk],
            plain: [C.card, C.faint, C.mute], blue: [C.keelTint, C.keelMid, C.keelDeep] };
        // a small tinted tag centred on cy; right: x is its right edge
        function aTag(ctx, x, cy, s, kind, right) {
            var c = TAGC[kind], w = ms(ctx, s, 8, '700') + 12;
            if (right) x -= w;
            E.box(ctx, x, cy - 7.5, w, 15, 4, c[0], c[1], 1);
            tx(ctx, s, x + w / 2, cy + 3, { size: 8, weight: '700', fill: c[2], align: 'center' });
            return w;
        }
        function vTag(ctx, x, cy, s, good, right) { return aTag(ctx, x, cy, s, good ? 'good' : 'bad', right); }
        function mutProof(ctx, x, cy) {
            var a = tt('v.brk'), b = tt('v.restored');
            if (P.lang === 'en') b = b.toLowerCase();
            var wa = ms(ctx, a, 8, '700'), wb = ms(ctx, b, 8, '700');
            var w = 8 + wa + 14 + 8 + wb + 14 + 2;
            E.box(ctx, x, cy - 8, w, 16, 8, C.card, C.line, 1);
            tx(ctx, a, x + 8, cy + 3, { size: 8, weight: '700', fill: C.mute });
            xDot(ctx, x + 8 + wa + 8, cy, 4.8, 1);
            tx(ctx, b, x + 8 + wa + 22, cy + 3, { size: 8, weight: '700', fill: C.mute });
            okDot(ctx, x + 8 + wa + 22 + wb + 8, cy, 4.8, 1);
        }
        // the rows fill in after the click, one after another; at the
        // styleframe the first two are in and the third is running
        var FILL = [CLICK_AT + 14, CLICK_AT + 34, 999];
        function evidenceTable(ctx, ph) {
            var ev = ph === 'evidence', mut = ph === 'mutation', res = ph === 'result';
            card(ctx, VT.x, VT.y, VT.w, VT.h, function () {
                var w = VT.w, s = tt('d.evi');
                tx(ctx, s, 14, 21, { size: 11, weight: '700' });
                var px = 14 + ms(ctx, s, 11, '700') + 12, pw = darkPill(ctx, px, 17.5, 'verifiedLight', tt('v.verifier'));
                tx(ctx, tt('v.indep'), px + pw + 8, 20.5, { size: 8.5, fill: C.mute });
                btn(ctx, w - 94, 6, 82, 22, tt('v.run'), ev ? 'press' : 'done', ev ? [w - 18, 25, 0.42] : null);
                E.line(ctx, [[10, 34], [w - 10, 34]], C.line, 1);
                [['d.accept', VCOL.crit], ['v.test', VCOL.cmd], ['v.out', VCOL.out]].forEach(function (c) {
                    tx(ctx, tt(c[0]), c[1], 46, { size: 8, weight: '700', fill: C.mute });
                });
                VROWS.forEach(function (row, r) {
                    var top = 52 + r * 24, cy = top + 12;
                    if (r) E.line(ctx, [[10, top], [w - 10, top]], C.line, 0.8);
                    E.fade(ctx, mut && r !== 1 ? 0.5 : 1, function () {
                        if (row.src === 'md') badge(ctx, P, 'md', '', VCOL.src - 8.5, cy - 5.5);
                        else { E.circle(ctx, VCOL.src, cy, 6, C.ink); icon(ctx, 'searchLight', VCOL.src - 4.5, cy - 4.5, 9, 9); }
                        tx(ctx, tt(row.k), VCOL.crit, cy + 3.2, { size: 9, weight: '700', maxW: VCOL.cmd - VCOL.crit - 12 });
                        tx(ctx, row.cmd, VCOL.cmd, cy + 3, { size: 7.5, mono: true, fill: C.ink, maxW: VCOL.out - VCOL.cmd - 10 });
                        var running = ev && CUR.l < FILL[r], bad = mut && r === 1;
                        if (running) {
                            if (CUR.l < CLICK_AT) return;
                            E.box(ctx, VCOL.out, cy - 8, 40, 16, 3, C.ink);
                            if (Math.floor(CUR.l / 20) % 2 === 0) E.box(ctx, VCOL.out + 7, cy - 4.5, 4.5, 9, 0.5, C.term);
                            spinner(ctx, VCOL.mark, cy, 6);
                            return;
                        }
                        var ow = row.out ? outChip(ctx, VCOL.out, cy, bad ? '1 notice' : row.out, bad ? C.termBad : C.termGood)
                            : outChip(ctx, VCOL.out, cy, tt('v.empty'), C.termDim, true);
                        if (bad) {
                            vTag(ctx, VCOL.out + ow + 6, cy, tt('v.caught'), false);
                            xDot(ctx, VCOL.mark, cy, 6.5, 1);
                            return;
                        }
                        if (res && r === 1) mutProof(ctx, VCOL.out + ow + 6, cy);
                        okDot(ctx, VCOL.mark, cy, 6.5, ev ? E.backOut(E.prog(CUR.l, FILL[r], 10)) : 1);
                    });
                });
            });
            if (ev) click(ctx, VT.x + VT.w - 18, VT.y + 25, 0.42, true);
        }
        function vSpec(ctx) {
            card(ctx, VT.x, VLOW.y, VLOW.lw, VLOW.h, function () {
                badge(ctx, P, 'md', '', 10, 9);
                tx(ctx, 'spec.md', 32, 18, { size: 9, weight: '700', mono: true });
                E.line(ctx, [[8, 28], [VLOW.lw - 8, 28]], C.line, 1);
                var s = tt('d.accept'), sw = ms(ctx, s, 8, '700') + 12;
                E.box(ctx, 12, 35, sw, 15, 4, C.passTint);
                tx(ctx, s, 12 + sw / 2, 45.5, { size: 8, weight: '700', fill: C.passInk, align: 'center' });
                ['d.acc1', 'd.acc2'].forEach(function (k, q) {
                    var y = 64 + q * 16;
                    E.box(ctx, 14, y - 7.5, 8, 8, 1.5, C.card, C.mute, 1);
                    tx(ctx, tt(k), 28, y, { size: 8.5, maxW: VLOW.lw - 40 });
                });
            });
        }
        function vDiff(ctx, broken) {
            group(ctx, VT.x, VLOW.y, 1, 0, function () {
                var w = VLOW.lw;
                panel(ctx, w, VLOW.h);
                badge(ctx, P, 'js', '', 10, 9);
                tx(ctx, 'orders/status.js', 32, 18, { size: 9, weight: '700', mono: true });
                vTag(ctx, w - 12, 15.5, broken ? tt('v.broken') : tt('v.restored'), !broken, true);
                E.line(ctx, [[8, 28], [w - 8, 28]], C.line, 1);
                var rows = [[' ', "on('status', order => {"], [broken ? '-' : ' ', "  if (order.status !== 'shipped') return", 1], [' ', '  notify(order.customer)']];
                rows.forEach(function (ln, k) {
                    var ly = 33 + k * 17;
                    if (ln[2]) E.box(ctx, 6, ly, w - 12, 16, 3, broken ? C.failTint : C.passTint, broken ? C.fail : C.pass, 1.3);
                    tx(ctx, String(12 + k), 22, ly + 11.5, { size: 7.5, mono: true, fill: C.faint, align: 'right' });
                    tx(ctx, ln[0], 29, ly + 11.5, { size: 8, weight: '700', mono: true, fill: ln[0] === '-' ? C.failInk : C.faint });
                    tx(ctx, ln[1], 38, ly + 11.5, { size: 8, mono: true, fill: ln[2] && broken ? C.failInk : C.ink });
                    if (ln[2] && broken) {
                        var sw = ms(ctx, ln[1], 8, '400', true);
                        E.line(ctx, [[38, ly + 8.5], [38 + sw * E.prog(CUR.l, 0, 16), ly + 8.5]], C.fail, 1.3);
                    }
                });
            });
        }
        function vProblem(ctx) {
            aiChip(ctx, 44, 110);
            var q = P.lang === 'zh' ? '「' + tt('d.should') + '」' : '“' + tt('d.should') + '”';
            var bw = ms(ctx, q, 12, '700') + 22;
            E.box(ctx, 62, 94, bw, 32, 9, C.card, C.line, 1);
            fillPoly(ctx, [[63, 104], [56, 110], [63, 113]], C.card);
            tx(ctx, q, 72, 114.5, { size: 12, weight: '700' });
            terminal(ctx, 32, 152, 268, 88, [['$ git commit -m "should work"'], ['$ git push', C.termDim], ['tests: not run', C.termBad]]);
            xDot(ctx, 300, 152, 7.5, 1);
            vTag(ctx, 32, 262, tt('d.notrun'), false);
            E.line(ctx, [[320, 78], [320, 286]], C.block, 1, [3, 4]);
            card(ctx, 340, 76, 268, 90, function () {
                badge(ctx, P, 'jsTest', '', 10, 9);
                tx(ctx, 'tests/notify.test.js', 32, 18, { size: 9, weight: '700', mono: true });
                E.line(ctx, [[8, 28], [260, 28]], C.line, 1);
                ["it('cancelled: no notice', () => {", '  cancel(order)', '  expect(true).toBe(true)', '})'].forEach(function (s, k) {
                    var ly = 44 + k * 13.5;
                    if (k === 2) { ctx.setLineDash([2.5, 2]); E.box(ctx, 8, ly - 10, 180, 14, 3, C.failTint, C.fail, 1.2); ctx.setLineDash([]); }
                    tx(ctx, s, 14, ly, { size: 8, mono: true, fill: k === 2 ? C.failInk : C.ink });
                });
            });
            xDot(ctx, 340 + 8 + 180, 76 + 44 + 27 - 3, 6.5, 1);
            terminal(ctx, 340, 176, 268, 64, [['$ npm test notify'], ['✓ 1 passed', C.termGood]]);
            vTag(ctx, 340, 262, tt('v.hollow'), false);
        }
        D.verify = function (ctx, ph) {
            if (ph === 'problem') { vProblem(ctx); return; }
            evidenceTable(ctx, ph);
            var T5;
            if (ph === 'evidence') {
                vSpec(ctx);
                T5 = [['$ npm test notify'], ['4 passed', C.termGood], ['$ git diff --stat db/ services/']];
            } else if (ph === 'mutation') {
                vDiff(ctx, true);
                T5 = [['$ npm test notify'], ['✕ cancelled → 1 notice', C.termBad], ['3 passed, 1 failed', C.termBad]];
            } else {
                vDiff(ctx, false);
                T5 = [['$ npm test notify'], ['✓ cancelled → 0 notices', C.termGood], ['4 passed', C.termGood]];
            }
            if (ph === 'evidence') {
                arrow(ctx, [166, VLOW.y - 2], [166, VT.y + VT.h + 3], C.keel, 1.6);
                arrow(ctx, [VCOL.out + VT.x + 20, VLOW.y - 2], [VCOL.out + VT.x + 20, VT.y + VT.h + 3], C.keel, 1.6);
            }
            terminal(ctx, VLOW.tx, VLOW.y, VLOW.tw, VLOW.h, T5);
            if (ph === 'result') stamp(ctx, CUR.l, 20, 546, 262, -6, 112, 30, C.pass, function () {
                var s = tt('v.proven'), sw = ms(ctx, s, 12, '700') + 17;
                E.tick(ctx, -sw / 2, 0.5, 0.4, 1, C.pass, 2.1);
                tx(ctx, s, -sw / 2 + 17, 4.5, { size: 12, weight: '700', fill: C.pass, maxW: 86 });
            });
        };

        // audit: what the change made false; six beats on the shipping notice
        var ACODE = ["on('status', order => {", "  if (order.status !== 'shipped') return", '  notify(order.customer)'];
        var AMEM = '- shipping flow: orders/ship.js';
        function fileHead(ctx, w, kind, name, note) {
            badge(ctx, P, kind, '', 10, 9);
            tx(ctx, name, 32, 18, { size: 9, weight: '700', mono: true });
            if (note) tx(ctx, note, w - 12, 18, { size: 8, fill: C.mute, align: 'right' });
            E.line(ctx, [[8, 28], [w - 8, 28]], C.line, 1);
        }
        var MARK = { bad: [C.failTint, C.fail, C.failInk], del: [C.failTint, C.fail, C.failInk], add: [C.passTint, C.pass, C.passInk], hot: [C.keelTint, C.keel, C.ink] };
        // one line of a file at ly: its number, a sign, the text (s null: a
        // grey bar `bar` wide); mark: bad, del (struck), add, hot; ui: prose
        function aLine(ctx, w, ly, n, s, mark, ui, bar) {
            var m = MARK[mark], sign = mark === 'del' ? '-' : mark === 'add' ? '+' : '';
            if (m) E.box(ctx, 6, ly, w - 12, 16, 3, m[0], m[1], 1.2);
            tx(ctx, String(n), 22, ly + 11.5, { size: 7.5, mono: true, fill: C.faint, align: 'right' });
            if (sign) tx(ctx, sign, 29, ly + 11.5, { size: 8, weight: '700', mono: true, fill: m[2] });
            if (s == null) { E.box(ctx, 38, ly + 5.5, bar, 5, 2.5, C.block); return; }
            var ink = m && mark !== 'hot' ? m[2] : C.ink, wt = ui && m && mark !== 'hot' ? '700' : '400';
            tx(ctx, s, 38, ly + 11.5, ui ? { size: 9, weight: wt, fill: ink, maxW: w - 50 } : { size: 8, mono: true, fill: ink, maxW: w - 50 });
            if (mark === 'del') {
                var sw = Math.min(w - 50, ui ? ms(ctx, s, 9, wt) : ms(ctx, s, 8, '400', true));
                E.line(ctx, [[38, ly + 8], [38 + sw * E.prog(CUR.l, 0, 16), ly + 8]], C.fail, 1.3);
            }
        }
        function ref(ctx, x, y, s, right) {
            var w = ms(ctx, s, 8, '700', true);
            if (right) x -= w;
            tx(ctx, s, x, y, { size: 8, weight: '700', mono: true, fill: C.keelDeep });
            E.line(ctx, [[x, y + 2.4], [x + w, y + 2.4]], C.keelMid, 1);
            return w;
        }
        function fileChip(ctx, x, y, kind, name, o) {
            o = o || {};
            var w = 22 + ms(ctx, name, 8.5, '700', true) + 9, h = 20;
            E.box(ctx, x, y, w, h, 4, C.card, o.dash ? null : C.line, 1.1);
            if (o.dash) { ctx.setLineDash([2.5, 2.5]); E.box(ctx, x, y, w, h, 4, null, C.faint, 1.1); ctx.setLineDash([]); }
            badge(ctx, P, kind, '', x + 4, y + h / 2 - 5.5);
            tx(ctx, name, x + 22, y + 13.5, { size: 8.5, weight: '700', mono: true, fill: o.dash ? C.mute : C.ink });
            return w;
        }
        // a file carried along the quadratic a-c-b by u(l), shifted so that at
        // the styleframe's frame it sits where the styleframe draws it (hit)
        function carried(a, c, b, hit, u) {
            var q = function (s) { var v = 1 - s; return [v * v * a[0] + 2 * s * v * c[0] + s * s * b[0], v * v * a[1] + 2 * s * v * c[1] + s * s * b[1]]; };
            var now = q(u(CUR.l)), then = q(u(CUR.sl));
            return [now[0] + hit[0] - then[0], now[1] + hit[1] - then[1]];
        }
        function slot(ctx, x, y, w, h) {
            ctx.setLineDash([3, 3]); E.box(ctx, x, y, w, h, 5, null, C.faint, 1); ctx.setLineDash([]);
        }
        function archiveFolder(ctx, x, y, inside, path, w) {
            w = w || 110;
            group(ctx, x, y, 1, 0, function () {
                E.box(ctx, 0, 0, 40, 14, 4, C.keelMid);
                E.box(ctx, 0, 6, w, 58, 6, C.keelMid);
                if (inside) inside();
                E.box(ctx, 0, 22, w, 42, 6, C.keel);
                tx(ctx, tt('audit.archived'), w / 2, path ? 41 : 47, { size: 10, weight: '700', fill: C.card, align: 'center' });
                if (path) tx(ctx, path, w / 2, 55, { size: 7, mono: true, fill: C.keelTint, align: 'center' });
            });
        }
        function notEq(ctx, x, y) {
            E.circle(ctx, x, y, 11, C.failTint, C.fail, 1.4);
            E.line(ctx, [[x - 5, y - 2.5], [x + 5, y - 2.5]], C.failInk, 1.6);
            E.line(ctx, [[x - 5, y + 2.5], [x + 5, y + 2.5]], C.failInk, 1.6);
            E.line(ctx, [[x + 3, y - 7], [x - 3, y + 7]], C.failInk, 1.6);
        }
        function aProblem(ctx) {
            var cw = 272, R = 336;
            card(ctx, 32, 74, cw, 90, function () {
                fileHead(ctx, cw, 'js', 'orders/status.js');
                ACODE.forEach(function (s, k) { aLine(ctx, cw, 34 + k * 17, 12 + k, s, k === 2 ? 'hot' : null); });
            });
            card(ctx, R, 74, cw, 90, function () {
                fileHead(ctx, cw, 'md', 'docs/notify.md');
                aLine(ctx, cw, 34, 2, null, null, false, 120);
                aLine(ctx, cw, 51, 3, tt('a.docOld'), 'bad', true);
                aLine(ctx, cw, 68, 4, null, null, false, 170);
            });
            curve(ctx, [32 + cw - 6, 150], [320, 150], [R + 6, 133], C.fail, 1.4, [2, 2.5]);
            xDot(ctx, R + cw - 6, 125, 6.5, 1);
            card(ctx, 32, 182, cw, 88, function () {
                fileHead(ctx, cw, 'md', 'MEMORY.md', tt('a.memory'));
                aLine(ctx, cw, 34, 7, null, null, false, 150);
                aLine(ctx, cw, 51, 8, AMEM, 'bad');
                aLine(ctx, cw, 68, 9, null, null, false, 110);
                aTag(ctx, cw - 10, 59, tt('a.gone'), 'bad', true);
            });
            card(ctx, R, 182, cw, 88, function () {
                fileHead(ctx, cw, 'md', 'CLAUDE.md', tt('a.load'));
                var x = 12, parts = [44, 30, 52, 26, 40, 34];
                parts.forEach(function (pw, k) { E.box(ctx, x, 40, pw - 2, 9, 2, k % 2 ? C.faint : C.block); x += pw; });
                tx(ctx, '≈ 5k tokens', 12, 70, { size: 8.5, weight: '700', mono: true, fill: C.ink });
                aTag(ctx, cw - 10, 67, tt('a.bloat'), 'bad', true);
            });
        }
        var SCANS = [['docs-check', 'a.c1', 'a.n1', 'good'], ['docs-audit', 'a.c2', 'a.n2', 'bad'], ['residue', 'a.c3', 'a.n3', 'bad'],
            ['memory-check', 'a.c4', 'a.n4', 'bad'], ['input-check', 'a.c5', null, 'warn']];
        function aScan(ctx) {
            var x = 32, y = 70, w = 576, h = 226, rh = 37;
            card(ctx, x, y, w, h, function () {
                tx(ctx, tt('a.five'), 14, 21, { size: 11, weight: '700' });
                btn(ctx, w - 94, 6, 82, 22, tt('a.run'), 'press', [w - 18, 25, 0.42]);
                E.line(ctx, [[10, 34], [w - 10, 34]], C.line, 1);
                E.box(ctx, 6, 38 + 3 * rh + 2, w - 12, 2 * rh - 4, 5, 'rgba(227,234,251,.75)');
                SCANS.forEach(function (sc, r) {
                    var top = 38 + r * rh, cy = top + rh / 2;
                    if (r && r !== 3) E.line(ctx, [[10, top], [w - 10, top]], C.line, 0.8);
                    var nw = ms(ctx, sc[0], 8.5, '700', true) + 16;
                    E.box(ctx, 14, cy - 9, nw, 18, 4, C.ink);
                    tx(ctx, sc[0], 22, cy + 3, { size: 8.5, weight: '700', mono: true, fill: C.term });
                    tx(ctx, tt(sc[1]), 128, cy + 3.2, { size: 9, maxW: 262 });
                    // the results come in after the click, one row after
                    // another; input-check is still running at the end
                    var done = CUR.l >= CLICK_AT + 6 + r * 7;
                    if (r === 4 || !done) {
                        if (CUR.l < CLICK_AT) return;
                        spinner(ctx, 406, cy, 6);
                        E.box(ctx, 420, cy - 4, 64, 8, 4, C.line);
                        return;
                    }
                    var tx0 = 400;
                    if (sc[3] === 'good') { okDot(ctx, tx0 + 6, cy, 6, 1); tx0 += 16; }
                    aTag(ctx, tx0, cy, tt(sc[2]), sc[3]);
                });
            });
            click(ctx, x + w - 18, y + 25, 0.42, true);
        }
        function aRead(ctx) {
            var cw = 262, R = 346, y = 96, h = 104;
            var pw = darkPill(ctx, 32, 80, 'diffLight', tt('a.reader'));
            tx(ctx, tt('a.readNote'), 32 + pw + 8, 83, { size: 8.5, fill: C.mute });
            card(ctx, 32, y, cw, h, function () {
                fileHead(ctx, cw, 'md', 'docs/notify.md');
                aLine(ctx, cw, 34, 2, null, null, false, 110);
                aLine(ctx, cw, 51, 3, tt('a.docOld'), 'bad', true);
                aLine(ctx, cw, 68, 4, null, null, false, 170);
                aLine(ctx, cw, 85, 5, null, null, false, 90);
            });
            card(ctx, R, y, cw, h, function () {
                fileHead(ctx, cw, 'js', 'orders/status.js');
                ACODE.forEach(function (s, k) { aLine(ctx, cw, 34 + k * 17, 12 + k, s, k === 2 ? 'bad' : null); });
                aLine(ctx, cw, 85, 15, '})');
            });
            E.line(ctx, [[32 + cw - 6, y + 59], [309, 162]], C.fail, 1.4, [2, 2.5]);
            E.line(ctx, [[331, 166], [R + 6, y + 76]], C.fail, 1.4, [2, 2.5]);
            notEq(ctx, 320, 164);
            // the findings, as the reader writes them: where, and why
            E.fade(ctx, E.prog(CUR.l, 24, 12), function () {
                card(ctx, 32, 212, 576, 36, function () {
                    var x = 12, cy = 18;
                    x += ref(ctx, x, cy + 3, 'docs/notify.md:3') + 14;
                    tx(ctx, tt('a.says'), x, cy + 3, { size: 8.5, fill: C.mute }); x += ms(ctx, tt('a.says'), 8.5, '400') + 6;
                    x += aTag(ctx, x, cy, tt('a.no'), 'bad') + 16;
                    tx(ctx, tt('a.does'), x, cy + 3, { size: 8.5, fill: C.mute }); x += ms(ctx, tt('a.does'), 8.5, '400') + 6;
                    aTag(ctx, x, cy, tt('a.yes'), 'good');
                    ref(ctx, 576 - 12, cy + 3, 'orders/status.js:14', true);
                });
            });
            E.fade(ctx, E.prog(CUR.l, 48, 12), function () {
                card(ctx, 32, 256, 576, 36, function () {
                    var x = 12, cy = 18;
                    x += ref(ctx, x, cy + 3, 'README.md:12') + 8;
                    x += aTag(ctx, x, cy, tt('a.email'), 'bad') + 10;
                    tx(ctx, '×', x, cy + 3.5, { size: 10, weight: '700', fill: C.mute }); x += 16;
                    x += ref(ctx, x, cy + 3, 'docs/orders.md:5') + 8;
                    x += aTag(ctx, x, cy, tt('a.inapp'), 'good');
                    var rw = ref(ctx, 576 - 12, cy + 3, 'components/Notice.js:8', true), s = tt('a.sides');
                    var sx = 576 - 12 - rw - 6 - ms(ctx, s, 8.5, '700');
                    tx(ctx, s, sx, cy + 3, { size: 8.5, weight: '700', fill: C.passInk });
                    arrow(ctx, [sx - 6, cy], [x + 6, cy], C.pass, 1.3);
                });
            });
        }
        var FIND = [['md', 'docs/notify.md:3', 'a.r1'], ['md', 'README.md:12 × docs/orders.md:5', 'a.r2'], ['md', 'MEMORY.md:8', 'a.r3'],
            ['md', 'docs/api.md:20', 'a.r4', 'a.r4no'], ['js', 'utils/legacyMailer.js', 'a.r5'], ['md', 'CLAUDE.md', 'a.r6']];
        // the adversary works down the list: row r is judged at ADV + r * 8
        // (at the styleframe five are judged and the last is being read)
        var ADV = 12;
        function aList(ctx, ph) {
            var adv = ph === 'adversary', rows = adv ? FIND : FIND.filter(function (f) { return !f[3]; });
            var w = 576, rh = adv ? 31 : 37;
            card(ctx, 32, 70, w, 226, function () {
                var s = tt('a.found');
                tx(ctx, s, 14, 21, { size: 11, weight: '700' });
                if (adv) {
                    var px = 14 + ms(ctx, s, 11, '700') + 12, pw = darkPill(ctx, px, 17.5, 'robotLight', tt('a.adv'));
                    tx(ctx, tt('a.advNote'), px + pw + 8, 20.5, { size: 8.5, fill: C.mute });
                }
                E.line(ctx, [[10, 34], [w - 10, 34]], C.line, 1);
                rows.forEach(function (f, r) {
                    var top = 36 + r * rh, cy = top + rh / 2, judged = !adv || (r < 5 && CUR.l >= ADV + r * 8), gone = adv && f[3] && judged;
                    if (r) E.line(ctx, [[10, top], [w - 10, top]], C.line, 0.8);
                    E.fade(ctx, gone ? 0.45 : adv ? 1 : 0.6, function () {
                        badge(ctx, P, f[0], '', 12, cy - 5.5);
                        tx(ctx, f[1], 34, cy + 3, { size: 8, weight: '700', mono: true });
                        if (gone) E.line(ctx, [[34, cy], [34 + ms(ctx, f[1], 8, '700', true), cy]], C.mute, 1.2);
                        aTag(ctx, 236, cy, tt(f[2]), gone ? 'plain' : 'bad');
                    });
                    var mx = w - 22;
                    if (!adv) {
                        okDot(ctx, mx, cy, 6.5, E.backOut(E.prog(CUR.l, 2 + r * 3, 10)));
                        tx(ctx, tt('a.done'), mx - 12, cy + 3.2, { size: 9, weight: '700', fill: C.passInk, align: 'right' });
                    } else if (!judged) {
                        if (r === 5 || CUR.l >= ADV + (r - 1) * 8) spinner(ctx, mx, cy, 6);
                    } else if (gone) {
                        xDot(ctx, mx, cy, 6.5, 1);
                        var d = tt('a.defeat');
                        tx(ctx, d, mx - 12, cy + 3.2, { size: 9, weight: '700', fill: C.failInk, align: 'right' });
                        aTag(ctx, mx - 20 - ms(ctx, d, 9, '700'), cy, tt('a.r4no'), 'plain', true);
                    } else {
                        verdict(ctx, mx, cy, true);
                        tx(ctx, tt('a.stands'), mx - 12, cy + 3.2, { size: 9, weight: '700', fill: C.mute, align: 'right' });
                    }
                });
            });
        }
        function aFix(ctx) {
            var lw = 292, R = 340, rw = 268;
            card(ctx, 32, 70, lw, 104, function () {
                fileHead(ctx, lw, 'md', 'docs/notify.md');
                aLine(ctx, lw, 34, 2, null, null, false, 110);
                aLine(ctx, lw, 51, 3, tt('a.docOld'), 'del', true);
                aLine(ctx, lw, 68, 3, tt('a.docNew'), 'add', true);
                aLine(ctx, lw, 85, 4, null, null, false, 170);
            });
            card(ctx, 32, 186, lw, 104, function () {
                fileHead(ctx, lw, 'md', 'README.md');
                aTag(ctx, lw - 10, 15, tt('a.one'), 'blue', true);
                aLine(ctx, lw, 34, 11, null, null, false, 90);
                aLine(ctx, lw, 51, 12, tt('a.readmeOld'), 'del', true);
                aLine(ctx, lw, 68, 12, tt('a.readmeNew'), 'add', true);
                aLine(ctx, lw, 85, 13, null, null, false, 140);
            });
            card(ctx, R, 70, rw, 88, function () {
                fileHead(ctx, rw, 'md', 'MEMORY.md', tt('a.memory'));
                aLine(ctx, rw, 34, 7, null, null, false, 150);
                aLine(ctx, rw, 51, 8, AMEM);
                aLine(ctx, rw, 68, 9, 'Corrected 2026-09-30: orders/status.js', 'add');
            });
            // the file nothing calls, carried along the dotted road to 已歸檔:
            // at the styleframe it is where the page draws it
            var sw = 22 + ms(ctx, 'utils/legacyMailer.js', 8.5, '700', true) + 9;
            var a = [R + sw / 2, 198], cc = [R + 30, 262], b = [520, 250];
            var pos = carried(a, cc, b, [424, 244], function (l) { return E.lerp(0.35, 0.75, E.prog(l, 0, 110)); });
            slot(ctx, R, 176, sw, 20);
            E.fade(ctx, 0.8, function () { curve(ctx, a, cc, b, C.faint, 1.4, [0.5, 4.5]); });
            archiveFolder(ctx, 498, 222);
            group(ctx, pos[0], pos[1], 1, -6 * RAD, function () {
                fileChip(ctx, -sw / 2, -10, 'js', 'utils/legacyMailer.js');
                aTag(ctx, -sw / 2, -19, tt('a.r5'), 'bad');
            });
            // held, not clicked: the cursor carries it, no ripple
            E.fade(ctx, 0.45, function () { E.circle(ctx, pos[0] + sw / 2 - 20, pos[1] + 8, 5.5, C.keelMid); });
            cursor(ctx, pos[0] + sw / 2 - 20, pos[1] + 8, 1.35);
        }
        D.audit = function (ctx, ph) {
            if (ph === 'problem') aProblem(ctx);
            else if (ph === 'scan') aScan(ctx);
            else if (ph === 'read') aRead(ctx);
            else if (ph === 'fix') aFix(ctx);
            else aList(ctx, ph);
        };

        // land: nothing left behind; four beats
        var LG = { main: 176, x0: 40, x1: 604, fork: 52, lane: [156, 136, 116, 96], tip: [252, 290, 232, 306], merge: [420, 460, 500, 540] };
        function lane(ctx, k, ph) {
            var y = LG.lane[k], tip = LG.tip[k], mx = LG.merge[k], merged = ph === 'tidy' || ph === 'result';
            var col = merged ? mix(AGC[k], C.paper, ph === 'result' ? 0.68 : 0.55) : AGC[k];
            curve(ctx, [LG.fork, LG.main], [LG.fork + 4, y], [LG.fork + 30, y], col, 2);
            E.line(ctx, [[LG.fork + 30, y], [tip, y]], col, 2);
            if (ph !== 'problem') {
                // back into main: in the action beat each draws in after the
                // click, the inner one first
                var mk = ph === 'action' ? E.prog(CUR.l, CLICK_AT + 4 + k * 8, 14) : 1;
                if (mk > 0) E.fade(ctx, mk, function () {
                    E.line(ctx, [[tip, y], [mx - 30, y]], col, 2, merged ? null : [4, 3]);
                    curve(ctx, [mx - 30, y], [mx - 4, y], [mx, LG.main - (merged ? 0 : 7)], col, 2);
                    if (!merged) group(ctx, mx, LG.main - 5, 1, Math.PI / 2, function () { fillPoly(ctx, [[2, 0], [-5, -3.6], [-5, 3.6]], col); });
                });
            }
            var n = k === 0 ? 3 : 2;
            for (var q = 1; q <= n; q++) {
                var cx = LG.fork + 30 + (tip - LG.fork - 30) * q / n;
                E.circle(ctx, cx, y, 3.4, q === n && ph === 'problem' ? C.card : col, col, 1.6);
            }
            if (k === 0) tx(ctx, 'fix', tip, y + 12, { size: 7, mono: true, fill: merged ? C.faint : C.mute, align: 'center' });
            if (!merged) tx(ctx, 'task-' + (k + 1), tip - 6, y - 5, { size: 8, weight: '700', mono: true, fill: C.ink, align: 'right' });
        }
        var TEMP = [['folderTemp', '.tmp/'], ['log', 'debug.log'], ['js', 'scratch.js']];
        D.land = function (ctx, ph) {
            var tidy = ph === 'tidy', res = ph === 'result', done = tidy || res;
            [3, 2, 1, 0].forEach(function (k) { lane(ctx, k, ph); });
            E.line(ctx, [[LG.x0, LG.main], [LG.x1, LG.main]], C.ink, 3);
            E.circle(ctx, LG.fork, LG.main, 3.8, C.ink);
            tx(ctx, 'main', LG.x0, LG.main + 15, { size: 9, weight: '700', mono: true });
            if (done) LG.merge.forEach(function (mx, k) { E.circle(ctx, mx, LG.main, 4.4, AGC[k], C.card, 1.4); });
            if (ph === 'action') {
                btn(ctx, 528, 68, 72, 24, tt('d.merge'), 'press', [588, 86, 0.4]);
                click(ctx, 588, 86, 0.4, true);
            }
            if (!res) E.fade(ctx, tidy ? E.lerp(1, 0.22, E.prog(CUR.l, 0, 24)) : 1, function () {
                var x = 32;
                TEMP.forEach(function (f) { x += fileChip(ctx, x, 204, f[0], f[1], { dash: true }) + 8; });
            });
            var sw = 22 + ms(ctx, 'spec.md', 8.5, '700', true) + 9;
            function pile(ox, oy) {
                for (var k = 3; k >= 0; k--) fileChip(ctx, ox + k * 5, oy - k * 4, 'md', 'task-' + (k + 1) + '.md');
            }
            if (!done) {
                fileChip(ctx, 32, 238, 'md', 'spec.md');
                for (var k = 0; k < 4; k++) fileChip(ctx, 104 + (k % 2) * 80, 238 + (k >> 1) * 26, 'md', 'task-' + (k + 1) + '.md');
            } else {
                if (tidy) slot(ctx, 32, 238, sw, 20);
                archiveFolder(ctx, 258, 228, function () {
                    group(ctx, 8, 0, 0.8, -4 * RAD, function () { pile(0, 10); });
                    if (res) group(ctx, 36, 4, 0.8, 5 * RAD, function () { fileChip(ctx, 0, 0, 'md', 'spec.md'); });
                }, 'docs/archive/', 92);
                if (tidy) {
                    // spec.md along the dotted road; at the styleframe it is
                    // where the page draws it, (176, 272)
                    var a = [32 + sw / 2, 258], cc = [150, 292], b = [262, 258];
                    var pos = carried(a, cc, b, [176, 272], function (l) { return E.lerp(0.3, 0.8, E.prog(l, 0, 90)); });
                    E.fade(ctx, 0.8, function () { curve(ctx, a, cc, b, C.faint, 1.4, [0.5, 4.5]); });
                    group(ctx, pos[0], pos[1], 1, -10 * RAD, function () { fileChip(ctx, -sw / 2, -10, 'md', 'spec.md'); });
                } else {
                    okDot(ctx, 258 + 92, 232, 7, E.backOut(E.prog(CUR.l, 4, 12)));
                    card(ctx, 32, 216, 158, 34, function () {
                        okDot(ctx, 20, 17, 7, 1);
                        tx(ctx, tt('land.clean'), 34, 21.5, { size: 11, weight: '700' });
                    });
                }
            }
            var T5 = ph === 'problem' ? [['$ git status --short'], ['?? .tmp/  debug.log  scratch.js', C.termBad], ['$ git branch'], ['  task-1  task-2  task-3  task-4', C.termBad]]
                : ph === 'action' ? [['$ git merge task-1', C.termDim], ['$ git merge task-2', C.termDim], ['$ git merge task-3', C.termDim], ['$ git merge task-4']]
                    : tidy ? [['$ git branch -d task-1 ... task-4', C.termDim], ['$ rm -r .tmp/ debug.log scratch.js', C.termDim], ['$ git mv spec.md task-*.md docs/archive/']]
                        : [['$ git status'], ['nothing to commit, working tree clean', C.termGood], ['$ git branch'], ['* main', C.termGood]];
            if (ph === 'action') T5 = T5.slice(0, Math.max(0, Math.min(4, Math.floor((CUR.l - CLICK_AT) / 8) + 1)));
            terminal(ctx, 358, 190, 250, 108, T5);
        };

        // ---- the outro: the sealed mark leaves the corner, then b1 into the
        // b5 lockup ------------------------------------------------------------
        var LP = 100, LY = 62;     // outroLockup's l counts from 67.0 s
        function lockGeom(ctx) {
            var ww = wordW(ctx, 96), wu = (116 + ww + 8);
            return { ww: ww, WU: wu, LX: (W - wu / 120 * LP) / 2 };
        }
        function outroGrow(ctx) {
            var OC = [W / 2, LY + LP / 2], p = E.prog(CUR.l, 0, 60);
            // the header's word goes first, so the glyph's trail crosses nothing
            wordmark(ctx, 1 - E.prog(CUR.l, 0, 8));
            [[0.3, 0.12], [0.16, 0.22]].forEach(function (q) {
                if (p < 1 && p - q[0] > 0) {
                    var g = flyTo(HC, HP, OC, LP, inOut3(p - q[0]));
                    E.fade(ctx, q[1], function () { inGlyph(ctx, g.c, g.px, function () { glyph(ctx, g.px, COL, {}); }); });
                }
            });
            var gm = flyTo(HC, HP, OC, LP, inOut3(p));
            inGlyph(ctx, gm.c, gm.px, function () { glyph(ctx, gm.px, COL, {}); });
        }
        function outroLockup(ctx, l) {
            var p1 = E.prog(l, 12, 150);
            if (!(p1 > 0)) return;
            var g = lockGeom(ctx);
            var gx = E.lerp((g.WU - 120) / 2, 0, inOut3(E.prog(l, 168, 36))), w = E.prog(l, 186, 54);
            group(ctx, g.LX, LY, 1, 0, function () {
                if (w > 0) unit(ctx, LP, function () {
                    ctx.save();
                    ctx.beginPath(); ctx.rect(gx + 106, 0, 116 - 106 + (g.ww + 8) * inOut3(w), 120); ctx.clip();
                    wordSet(ctx, 96);
                    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = COL.b;
                    ctx.fillText('fankeel', gx + 116, 85);
                    ctx.restore();
                });
                group(ctx, gx * LP / 120, 0, 1, 0, function () { b1(ctx, LP, COL, p1); });
            });
        }
        function outroFinal(ctx, l) {
            outroLockup(ctx, l);
            var k = E.prog(CUR.l, 6, 20);
            E.fade(ctx, k, function () {
                var bw = 330, bx = (W - bw) / 2, by = 204 + (1 - E.expoOut(k)) * 8;
                tx(ctx, tt('outro.two'), bx, by - 8, { size: 10, weight: '700', fill: C.mute });
                group(ctx, bx, by, 1, 0, function () {
                    panel(ctx, bw, 50, { fill: C.ink });
                    CMDS.forEach(function (c, j) {
                        var y = 21 + j * 17;
                        tx(ctx, '$', 12, y, { size: 8.5, mono: true, weight: '700', fill: C.termGood });
                        tx(ctx, c, 24, y, { size: 8.5, mono: true, fill: C.term, maxW: bw - 34 });
                    });
                });
            });
        }

        // ---- the timeline ---------------------------------------------------
        // Seconds: hook 0-11 (six beats), intro 11-13.4, dock 13.4-14; the
        // stages from 14, 20, 26, 32, 42, 50, 60; the outro 66-74. A beat is
        // { at, len, label, sl (its styleframe's local frame), ... }.
        var FPS5 = E.FPS, LENGTH5 = 74 * FPS5;
        var STAGE5 = [
            { at: 14, ph: [['problem', 0, 0.9], ['action', 1.5, 2.6], ['map', 3.5, 4.3], ['result', 5, 5.5]], len: 6 },
            { at: 20, ph: [['problem', 0, 0.9], ['define', 1.5, 2.6], ['direction', 3.5, 4.3], ['result', 5, 5.5]], len: 6 },
            { at: 26, ph: [['problem', 0, 0.9], ['action', 1.5, 2.6], ['cards', 3.5, 4.3], ['result', 5, 5.5]], len: 6 },
            { at: 32, ph: [['problem', 0, 0.9], ['action', 1.5, 2.8], ['run', 3.5, 4.3], ['review', 5, 6.2], ['pass', 7, 8.2], ['result', 9, 9.5]], len: 10 },
            { at: 42, ph: [['problem', 0, 0.9], ['evidence', 1.5, 2.9], ['mutation', 4, 5.3], ['result', 6.5, 7.4]], len: 8 },
            { at: 50, ph: [['problem', 0, 0.9], ['scan', 1.5, 2.4], ['read', 3, 4.5], ['adversary', 5.5, 6.4], ['fix', 7, 8.2], ['result', 9, 9.5]], len: 10 },
            { at: 60, ph: [['problem', 0, 0.9], ['action', 1.5, 2.6], ['tidy', 3.5, 4.3], ['result', 5, 5.5]], len: 6 },
        ];
        // beats whose caption is not what.<stage>
        var CAPK = { 'design-define': 'what.design.scope', 'plan-cards': 'what.plan.short', 'build-action': 'what.build.deal', 'build-run': 'what.build',
            'build-review': 'build.review', 'build-pass': 'build.pass', 'verify-mutation': 'verify.break',
            'audit-scan': 'audit.scan', 'audit-read': 'audit.read', 'audit-fix': 'audit.fix', 'land-action': 'land.merge', 'land-tidy': 'what.land' };
        // each entry: { label, s: start s, st: styleframe s, cap: caption key,
        // kind, xf, draw(ctx) }; draw reads the beat's local frame from CUR
        var HOOKCAP = ['cap.bigger', 'cap.grow', 'cap.docs', 'cap.orphan', 'cap.grep', 'cap.readall'];
        var SPEC = [];
        [[0, 0.8], [1.5, 2.3], [3, 4], [5, 6], [7, 8], [9, 10]].forEach(function (t0, k) {
            SPEC.push({ label: 'hook-' + (k + 1), s: t0[0], st: t0[1], cap: HOOKCAP[k], kind: k ? 'problem' : 'plain', xf: k > 0,
                draw: function (ctx) { HOOK[k + 1](ctx); } });
        });
        SPEC.push({ label: 'intro', s: 11, st: 12.4, cap: 'logo.tag', kind: 'plain', xf: true, draw: intro });
        SPEC.push({ label: 'intro-dock', s: 13.4, st: 13.7, cap: 'logo.tag', kind: 'plain', xf: false, draw: introDock });
        STAGE5.forEach(function (sg, i) {
            var s = E.ROUTE[i];
            sg.ph.forEach(function (q, j) {
                var ph = q[0], cap = ph === 'problem' ? 'prob.' + s : ph === 'result' ? 'pr.' + s : CAPK[s + '-' + ph] || 'what.' + s;
                SPEC.push({ label: s + '-' + ph, s: sg.at + q[1], st: sg.at + q[2], stage: s, i: i, ph: ph, cap: cap,
                    kind: ph === 'problem' ? 'problem' : ph === 'result' ? 'produce' : 'plain', xf: !(i === 0 && j === 0),
                    draw: function (ctx) { D[s](ctx, ph); } });
            });
        });
        SPEC.push({ label: 'outro-grow', s: 66, st: 66.5, cap: null, xf: true, draw: outroGrow });
        SPEC.push({ label: 'outro-b1', s: 67, st: 68, cap: null, xf: true, draw: function (ctx) { outroLockup(ctx, CUR.l); } });
        SPEC.push({ label: 'outro-final', s: 69.5, st: 72.5, cap: 'outro.tag', kind: 'plain', xf: false,
            draw: function (ctx) { outroFinal(ctx, CUR.l + 150); } });
        var BEATS5 = SPEC.map(function (b, k) {
            var at0 = Math.round(b.s * FPS5), end = k + 1 < SPEC.length ? Math.round(SPEC[k + 1].s * FPS5) : LENGTH5;
            return Object.assign({}, b, { at: at0, len: end - at0, sl: Math.round((b.st - b.s) * FPS5) });
        });
        if (BEATS5[BEATS5.length - 1].at + BEATS5[BEATS5.length - 1].len !== LENGTH5 || STAGE5[6].at + STAGE5[6].len !== 66) {
            throw new Error('tour: promo30v5 does not run to ' + LENGTH5 + ' frames');
        }
        function beatOf(f) {
            var k = BEATS5.length - 1;
            while (k > 0 && BEATS5[k].at > f) k--;
            return k;
        }
        function body(ctx, b, l) {
            CUR = { l: l, sl: b.sl };
            b.draw(ctx, l);
        }
        // What the frame shows, without drawing it: the beat, its caption, the
        // header glyph's locked segments and its edge. The tests read it.
        function state(f) {
            var b = BEATS5[beatOf(f)], l = f - b.at, st = { label: b.label, stage: b.stage || null, phase: b.ph || null, caption: b.cap, locked: 0, edge: 0 };
            if (b.stage) {
                st.locked = lockedOf(b.i, b.ph).length;
                if (b.i === 6) st.edge = landGlyph(b.ph, l).edge;
            } else if (/^outro/.test(b.label)) { st.locked = 6; st.edge = 1; }
            return st;
        }
        function draw(ctx, f, Pal) {
            P = Pal;
            var k = beatOf(f), b = BEATS5[k], l = f - b.at, prev = k > 0 ? BEATS5[k - 1] : null;
            ground(ctx, f);
            if (b.stage) header(ctx, b.i, b.ph, l);
            var xk = (b.xf && prev) || (b.stage && !b.xf) ? E.prog(l, 0, XF) : 1;
            // survey's first beat has no picture to fade from: its diagram fades in
            if (xk < 1 && b.xf) E.fade(ctx, 1 - xk, function () { body(ctx, prev, prev.len - 1); });
            E.fade(ctx, xk, function () { body(ctx, b, l); });
            // the caption: one line, changing with the beat
            var ck = E.prog(l, 0, XF);
            if (prev && prev.cap && prev.cap !== b.cap && ck < 1) E.fade(ctx, 1 - ck, function () { caption(ctx, prev.cap, prev.kind, prev.i); });
            if (b.cap) E.fade(ctx, prev && prev.cap === b.cap ? 1 : ck, function () { caption(ctx, b.cap, b.kind, b.i); });
        }
        var CUTS5 = [0, 660].concat(STAGE5.map(function (s) { return s.at * FPS5; }), [3960]);
        var BLOCKS5 = [];
        BEATS5.forEach(function (b) {
            if (CUTS5.indexOf(b.at) < 0) BLOCKS5.push(b.at);
            if (/-(action|define|direction|evidence|scan)$/.test(b.label) || /^hook-[34]$/.test(b.label)) BLOCKS5.push(b.at + CLICK_AT);
        });
        BLOCKS5.sort(function (a, b) { return a - b; });
        var strings5 = {};
        Object.keys(K.V5).forEach(function (k) { strings5[k] = K.V5[k]; });
        return {
            length: LENGTH5,
            beats: BEATS5.map(function (b) {
                var o = { at: b.at, label: b.label };
                if (b.stage) o.stage = b.stage;
                return o;
            }),
            // each beat's styleframe frame, the frame to compare with its render.png
            stills: BEATS5.map(function (b) { return b.at + b.sl; }),
            cues: { cuts: CUTS5, blocks: BLOCKS5 },
            strings: strings5,
            state: state,
            ready: READY,
            draw: draw,
        };
    }());
    E.register('promo30v5', TOUR_PROMO30V5);
    module.exports = {
        TOUR_PROMO30V3: TOUR_PROMO30V3,
        TOUR_PROMO30V4: TOUR_PROMO30V4,
        TOUR_PROMO30V5: TOUR_PROMO30V5,
    };
    if (typeof window !== 'undefined') root.tourRing = module.exports;
})(typeof window !== 'undefined' ? window : globalThis, typeof module !== 'undefined' ? module : {});
