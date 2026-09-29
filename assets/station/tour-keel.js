// assets/station/tour-keel.js: the 30-second keel film. A keel-less
// dinghy capsizes, a keel drops, each of the seven stages raises one rib
// beside the component a developer knows it by, and the hull closes and
// sails. Styleframes: .fankeel/build/2026-09-29-promo30/mockup.html.
// The styleframes are 1280x720; the frame is 640x360, so every position
// and size below is the styleframe's halved.
(function (root, module) {
    'use strict';
    var E = root.tourEngine || require('./tour.js');
    var K = root.tourReelKit || require('./tour-reel-kit.js');

    var S = {
        hook: { zh: '你的 agent 很快，但它會跳步驟', en: 'Your agent is fast. It also skips steps.' },
        keel: { zh: 'fankeel：先給它一根龍骨', en: 'fankeel: give it a keel first.' },
        survey: { zh: '動手前，先讀懂已經有什麼', en: 'Before touching anything, read what is already there.' },
        design: { zh: '先看到畫面，逐塊調對', en: 'See the page first, then tune it block by block.' },
        plan: { zh: '拆成陌生人也能照做的任務', en: 'Break it into tasks a stranger could follow.' },
        build: { zh: '分派出去做，每一件都審', en: 'Hand the work out. Review every piece.' },
        verify: { zh: '要證據，不要自信', en: 'Evidence, not confidence.' },
        audit: { zh: '劃掉、蓋章、封存', en: 'Strike it, stamp it, archive it.' },
        land: { zh: '收尾比開工時更乾淨', en: 'Leave it cleaner than you found it.' },
        install: { zh: '一行裝好', en: 'One line to install.' },
        'hook.done': { zh: 'agent › 完成了 ✓', en: 'agent › all done ✓' },
        'hook.wrong': { zh: '改錯檔', en: 'wrong file' },
        'hook.meant': { zh: '要改的是 lib/login.js', en: 'meant: lib/login.js' },
        'hook.same': { zh: '同一個檔，兩邊都在改', en: 'one file, both editing' },
        'hook.nokeel': { zh: '沒有龍骨', en: 'no keel' },
        'survey.map': { zh: '先讀地圖', en: 'map first' },
        'survey.have': { zh: '已存在', en: 'exists' },
        'survey.read': { zh: '讀取中', en: 'reading' },
        'design.click': { zh: '點一下', en: 'click' },
        'design.crit': { zh: '驗收條件：現在紅，做完才會綠', en: 'Red now, green when it is done' },
        'plan.t1': { zh: '加 --json 旗標', en: 'Add a --json flag' },
        'plan.t2': { zh: 'cli 輸出測試', en: 'Test the cli output' },
        'plan.t3': { zh: 'README 新段落', en: 'New README section' },
        'plan.t4': { zh: '站點面板', en: 'Station panel' },
        'plan.a': { zh: '組 A', en: 'Group A' },
        'plan.b': { zh: '組 B', en: 'Group B' },
        'plan.par': { zh: '兩組互不相干 → 並排', en: 'independent → side by side' },
        'build.fan': { zh: '分派 4 個 agent', en: 'dispatch 4 agents' },
        'verify.h': { zh: '主張 → 證據', en: 'Claim → evidence' },
        'verify.n': { zh: '#', en: '#' },
        'verify.claim': { zh: '主張', en: 'Claim' },
        'verify.ev': { zh: '證據', en: 'Evidence' },
        'verify.res': { zh: '結果', en: 'Result' },
        'verify.c1': { zh: '--json 輸出合法', en: '--json output is valid' },
        'verify.c2': { zh: 'README 有新段落', en: 'README has the section' },
        'verify.c3': { zh: '改壞了測試會抓到', en: 'A break gets caught' },
        'verify.from': { zh: '來自 design', en: 'from design' },
        'audit.sent': { zh: '站點每 5 秒輪詢一次', en: 'The station polls every 5 s' },
        'audit.stale': { zh: '過期', en: 'STALE' },
        'land.q': { zh: '做完了，怎麼整合？', en: 'Done. How does it land?' },
        'land.merge': { zh: '合併回 main', en: 'Merge into main' },
        'land.pr': { zh: '推上去開 PR', en: 'Push, open a PR' },
        'land.keep': { zh: '先留著分支', en: 'Keep the branch' },
        'land.fold': { zh: '收起', en: 'removed' },
        'sail.copy': { zh: '複製', en: 'Copy' },
    };
    function t(P, key) { return S[key][P.lang]; }

    var W = E.W, H = E.H;
    // The styleframes' palette block, and the tints its components use.
    var C = {
        ink: '#18202C', paper: '#F2F4F3', keel: '#2D5BD8', signal: '#F4B72E', fail: '#C8323F', pass: '#16845A',
        card: '#FBFCFC', line: '#D8DEE4', mute: '#5E6775', faint: '#A9B3C1', block: '#CBD2DA',
        keelTint: '#E3EAFB', keelMid: '#9DB4EE', keelDeep: '#2349B8', dotLit: '#8FA9F2', dotOff: '#5B6678',
        failTint: '#FBE7E9', failInk: '#8E1F29', passTint: '#E0F2EA', passInk: '#0F5C3F', signalTint: '#FDEFC7', signalInk: '#7A5A00',
        term: '#C9D1DC', termDim: '#7C889A', termBad: '#FF8A94', termGood: '#6FD3A6', termDot: '#3A4556', termRule: '#2A3444',
    };
    var STRIPES = ['#8FA9F2', C.keel, '#6D8DEA', C.keelDeep, '#B9CAF5'];

    // ---- motion and drawing pieces ------------------------------------

    function eo(l, at, len) { return E.expoOut(E.prog(l, at, len)); }
    function bo(l, at, len) { return E.backOut(E.prog(l, at, len || 14)); }
    function setFont(ctx, P, size, weight, mono) { ctx.font = (weight || '400') + ' ' + size + 'px ' + (mono ? P.fMono : P.fUi); }
    function measure(ctx, P, s, size, weight, mono) { setFont(ctx, P, size, weight, mono); return ctx.measureText(s).width; }
    // One line of text; past maxW it shrinks to fit rather than overflow.
    function txt(ctx, P, s, x, y, o) {
        o = o || {};
        var size = o.size || 8;
        setFont(ctx, P, size, o.weight, o.mono);
        if (o.maxW) {
            var m = ctx.measureText(s).width;
            if (m > o.maxW) setFont(ctx, P, size * o.maxW / m, o.weight, o.mono);
        }
        ctx.fillStyle = o.fill || C.ink;
        ctx.textAlign = o.align || 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(s, x, y);
    }
    function group(ctx, x, y, s, rot, fn) {
        ctx.save();
        ctx.translate(x, y);
        if (rot) ctx.rotate(rot);
        if (s !== 1) ctx.scale(s, s);
        fn();
        ctx.restore();
    }
    function path(ctx, pts) {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    }
    function fillPoly(ctx, pts, fill, stroke, lw) {
        path(ctx, pts);
        ctx.closePath();
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.lineJoin = 'round'; ctx.stroke(); }
    }
    function quad(p0, p1, p2, n) {
        var out = [];
        for (var k = 0; k <= n; k++) {
            var u = k / n, a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
            out.push([a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1]]);
        }
        return out;
    }
    // Catmull-Rom through the points, as the styleframes' smooth() does,
    // sampled to a polyline.
    function smooth(pts) {
        var out = [pts[0]];
        for (var i = 0; i < pts.length - 1; i++) {
            var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
            var c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
            var c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
            for (var k = 1; k <= 8; k++) {
                var u = k / 8, v = 1 - u;
                out.push([
                    v * v * v * p1[0] + 3 * v * v * u * c1[0] + 3 * v * u * u * c2[0] + u * u * u * p2[0],
                    v * v * v * p1[1] + 3 * v * v * u * c1[1] + 3 * v * u * u * c2[1] + u * u * u * p2[1],
                ]);
            }
        }
        return out;
    }
    // Canvas shadows ignore the transform; scale them to the canvas.
    function panel(ctx, w, h, o) {
        o = o || {};
        var r = o.r == null ? 7 : o.r, sc = ctx.canvas ? ctx.canvas.width / W : 1;
        ctx.save();
        ctx.shadowColor = 'rgba(24,32,44,.24)';
        ctx.shadowBlur = (o.blur == null ? 12 : o.blur) * sc;
        ctx.shadowOffsetY = (o.dy == null ? 6 : o.dy) * sc;
        E.box(ctx, 0, 0, w, h, r, o.fill || C.card);
        ctx.restore();
        if (o.stroke) E.box(ctx, 0, 0, w, h, r, null, o.stroke, o.lw || 1);
    }
    // A card arriving: popped from `from` about its centre, back-out, a
    // short drop, faded in over its first third. fn draws in the card's
    // own coordinates, (0, 0) to (w, h).
    function enter(ctx, l, at, x, y, w, h, deg, fn, o) {
        o = o || {};
        var p = E.prog(l, at, o.len || 16);
        if (!(p > 0)) return;
        var s = E.lerp(o.from == null ? 0.6 : o.from, 1, E.backOut(p)), dy = (1 - E.expoOut(p)) * (o.dy == null ? 14 : o.dy);
        E.fade(ctx, p * 3, function () {
            group(ctx, x + w / 2, y + h / 2 + dy, s, (deg || 0) * Math.PI / 180, function () {
                ctx.translate(-w / 2, -h / 2);
                fn();
            });
        });
    }
    var BADGE = { md: [C.ink, C.card], js: [C.signal, C.ink], ts: [C.keel, C.card], dir: [C.faint, C.ink], wt: [C.faint, C.ink] };
    function badge(ctx, P, kind, s, x, y) {
        var c = BADGE[kind], w = Math.max(17, measure(ctx, P, s, 5.5, '700', true) + 6);
        E.box(ctx, x, y, w, 10, 3, c[0]);
        txt(ctx, P, s, x + w / 2, y + 7.3, { size: 5.5, weight: '700', mono: true, fill: c[1], align: 'center' });
        return w;
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
    function term(ctx, P, w, h) {
        panel(ctx, w, h, { fill: C.ink });
        for (var i = 0; i < 3; i++) E.circle(ctx, 9 + i * 8.5, 7.5, 2.75, C.termDot);
        E.line(ctx, [[0, 15], [w, 15]], C.termRule, 0.5);
    }
    // A stamp slammed on: scale 2.6 to 1, expo-out over 9 frames, rotated.
    function stamp(ctx, l, at, x, y, deg, w, h, color, fn) {
        var p = E.prog(l, at, 9);
        if (!(p > 0)) return;
        var s = E.lerp(2.6, 1, E.expoOut(p));
        E.fade(ctx, p * 2, function () {
            group(ctx, x, y, s, deg * Math.PI / 180, function () {
                E.box(ctx, -w / 2, -h / 2, w, h, 5, 'rgba(251,252,252,.85)', color, 2);
                E.box(ctx, -w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 3, null, color, 1);
                fn();
            });
        });
    }
    function wave(base, amp, period, phase, bottom) {
        var pts = [];
        for (var x = -10; x <= W + 10; x += 4) pts.push([x, base - amp * Math.sin((x + phase) / period * Math.PI * 2)]);
        pts.push([W + 10, bottom], [-10, bottom]);
        return pts;
    }

    // ---- the frame furniture: ground, pills, statusline, subtitle -------

    // Paper and a dot every 11 units, drifting up and left a little.
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
    // The first n step pills, top left; the last is this shot's, outlined,
    // and pops in at newAt.
    function pills(ctx, P, n, l, newAt) {
        var x = 22, y = 18, h = 16;
        for (var i = 0; i < n; i++) {
            var name = PILLS[i].slice(3), now = i === n - 1;
            var w = 21.5 + measure(ctx, P, name, 8, '600') + 6;
            var k = now ? bo(l, newAt, 14) : 1;
            if (k > 0) {
                group(ctx, x + w / 2, y + h / 2, k, 0, function () {
                    ctx.translate(-w / 2, -h / 2);
                    panel(ctx, w, h, { r: 8, blur: 4, dy: 1 });
                    if (now) E.box(ctx, 0, 0, w, h, 8, null, C.ink, 1);
                    E.box(ctx, 2.5, 2.5, 15, 11, 3, now ? C.keel : C.keelMid);
                    txt(ctx, P, PILLS[i].slice(0, 2), 10, 10.6, { size: 6.5, weight: '700', mono: true, fill: C.card, align: 'center' });
                    txt(ctx, P, name, 21.5, 11, { size: 8, weight: '600', fill: now ? C.ink : C.mute });
                });
            }
            x += w + 5;
        }
    }
    // [FANKEEL:<STAGE>] and n of seven dots lit, bottom right; the newest
    // pops at newAt with a ring.
    function status(ctx, P, n, l, newAt) {
        var label = '[FANKEEL:' + E.ROUTE[n - 1].toUpperCase() + ']';
        var lw = measure(ctx, P, label, 8.5, '400', true), w = 8 + lw + 6 + 49 + 5, h = 18;
        group(ctx, W - 20 - w, H - 18 - h, 1, 0, function () {
            panel(ctx, w, h, { fill: C.ink, r: 5 });
            txt(ctx, P, label, 8, 12.3, { size: 8.5, mono: true, fill: C.paper });
            for (var j = 0; j < 7; j++) {
                var cx = 8 + lw + 6 + j * 7 + 3, cy = 9;
                if (j < n) {
                    var now = j === n - 1;
                    E.circle(ctx, cx, cy, 2.6 * (now ? bo(l, newAt, 12) : 1), C.dotLit);
                    if (now) K.ring(ctx, cx, cy, 11, C.dotLit, l, newAt, 22, 1.5);
                } else E.circle(ctx, cx, cy, 2.1, null, C.dotOff, 1);
            }
        });
    }
    // The one line, bottom left, wiped in from the left from `at`.
    function sub(ctx, P, key, l, at, o) {
        o = o || {};
        var k = eo(l, at, 24);
        if (!(k > 0)) return;
        var x = o.x == null ? 24 : o.x, maxW = o.maxW || 430;
        E.fade(ctx, o.alpha == null ? 1 : o.alpha, function () {
            ctx.save();
            ctx.beginPath();
            ctx.rect(x - 4, 290, (maxW + 8) * k, 70);
            ctx.clip();
            txt(ctx, P, t(P, key), x - (1 - k) * 16, 338, { size: P.lang === 'zh' ? 18 : 15, weight: '700', fill: o.fill || C.ink, maxW: maxW });
            ctx.restore();
        });
    }

    // ---- the hull, as the styleframes' lofting plan --------------------

    // Seven frame stations along the keel; each rib is the hull's cross-
    // section at one, drawn in an oblique view (z runs up and right).
    var HB = [74, 90, 99, 102, 98, 86, 64], HD = [146, 152, 156, 158, 157, 155, 152];
    function HX(i) { return 120 + i * 58; }
    function hp(x, y, z) { return [x + 0.66 * z, 300 - y - 0.14 * z]; }
    function arm(i, side, upto) {
        var pts = [];
        for (var k = 0; k <= 16; k++) {
            var u = (k / 16) * upto;
            pts.push(hp(HX(i), HD[i] * Math.pow(u, 1.6), side * HB[i] * u));
        }
        return pts;
    }
    var KEEL = [[62, 222], [70, 300], [520, 300]].concat(quad([520, 300], [558, 300], [562, 214], 10).slice(1));
    var HULL = { x: 12, y: 56, s: 0.516 };
    function gatePos(i) { var top = hp(HX(i), HD[i], -HB[i]); return [top[0] - 16, top[1] - 20]; }
    // n ribs stand; rib n is rising (k, 0..1); the ✓ that let it go up
    // pops with `gate`. `wl` fades the waterline, the blocks and the
    // station numbers (the plan's furniture, gone once the hull sails).
    function hullFrame(ctx, P, o) {
        var n = o.n, k = o.k || 0, wl = o.wl == null ? 1 : o.wl;
        E.fade(ctx, wl, function () {
            E.line(ctx, [[30, 250], [600, 250]], C.keelMid, 1.5, [10, 6]);
            txt(ctx, P, 'WL', 604, 246, { size: 12, mono: true, fill: C.keelMid });
            for (var i = 0; i < 7; i++) E.box(ctx, HX(i) - 14, 310, 28, 12, 3, C.block);
        });
        function ribs(side) {
            for (var i = 0; i < 7; i++) {
                var up = i < n ? 1 : i === n ? k : 0;
                if (up < 1) E.fade(ctx, 0.6, function () { E.line(ctx, arm(i, side, 1), C.faint, 1.6, [5, 5]); });
                if (up > 0) E.line(ctx, arm(i, side, up), side > 0 ? C.keelMid : C.keel, side > 0 ? 6 : 9);
            }
        }
        ribs(1);
        E.line(ctx, KEEL, C.ink, 13);
        ribs(-1);
        E.fade(ctx, wl, function () {
            for (var i = 0; i < 7; i++) {
                var on = i < n || (i === n && k > 0.5);
                txt(ctx, P, String(i + 1), HX(i), 346, { size: 14, mono: true, weight: on ? '700' : '400', fill: on ? C.keel : C.faint, align: 'center' });
            }
        });
        if (o.gate > 0) {
            var g = gatePos(o.gi);
            E.fade(ctx, o.gateAlpha == null ? 1 : o.gateAlpha, function () {
                E.circle(ctx, g[0], g[1], 15 * o.gate, C.pass);
                E.tick(ctx, g[0] - 7, g[1], 0.93, E.prog(o.gate, 0.5, 0.5), C.card, 3.2);
            });
        }
    }
    function atHull(ctx, tf, fn) {
        group(ctx, tf.x, tf.y, tf.s, 0, fn);
    }

    // The closed hull: sheer lines through the rib tops, the near side
    // planked in hull ink, mast and two sails raised by `hoist`.
    var STERN = [70, 150, 50], STEM = [548, 140];
    function sheer(side) {
        var pts = [hp(STERN[0] - 10, STERN[1], side * STERN[2])];
        for (var i = 0; i < 7; i++) pts.push(hp(HX(i), HD[i], side * HB[i]));
        pts.push(STEM);
        return pts;
    }
    var NEAR = smooth(sheer(-1)), FAR = smooth(sheer(1));
    var SKIN = NEAR.concat(quad(STEM, [552, 300], [520, 300], 10).slice(1), [[70, 300]]);
    var INSIDE = NEAR.concat(FAR.slice().reverse());
    var PLANKS = [0.3, 0.55, 0.8].map(function (u) {
        var h = Math.pow(u, 1.6), pts = [hp(STERN[0] - 10 * h, STERN[1] * h, -STERN[2] * u)];
        for (var i = 0; i < 7; i++) pts.push(hp(HX(i), HD[i] * h, -HB[i] * u));
        pts.push([520 + 28 * h, 300 - 160 * h]);
        return smooth(pts);
    });
    function doneHull(ctx, hoist) {
        if (hoist > 0) {
            E.line(ctx, [[300, 150], [300, E.lerp(150, -70, hoist)]], C.ink, 7);
            group(ctx, 0, 132, 1, 0, function () {
                ctx.scale(1, Math.max(0.001, hoist));
                fillPoly(ctx, [[308, -190], [308, 0], [452, 0]], C.signal, C.ink, 3);
                fillPoly(ctx, [[292, -172], [292, -6], [196, -6]], C.card, C.ink, 3);
            });
        }
        fillPoly(ctx, INSIDE, C.keelTint);
        for (var i = 0; i < 7; i++) E.fade(ctx, 0.7, function () { E.line(ctx, arm(i, 1, 1), C.keel, 6); });
        fillPoly(ctx, SKIN, C.ink);
        PLANKS.forEach(function (p) { E.fade(ctx, 0.28, function () { E.line(ctx, p, C.card, 1.6); }); });
        E.line(ctx, NEAR, C.keel, 7);
        E.line(ctx, FAR, C.ink, 4);
    }

    // The mark: one keel, stern post to upturned stem, and seven ribs that
    // lean out toward the ends and follow the sheer, so it reads as a hull's
    // frame and not a comb. 240 x 100 units, like the styleframes' symbol.
    var MARK_KEEL = [[12, 26], [24, 70], [200, 70]].concat(quad([200, 70], [232, 70], [236, 14], 10).slice(1));
    var MARK_TOPS = [22, 30, 35, 37, 35, 28, 18];
    var MARK_RIBS = MARK_TOPS.map(function (top, i) {
        var x = 46 + i * 25, lean = (i - 3) * 6;
        return quad([x, 70], [x + lean * 0.35, (70 + top) / 2], [x + lean, top], 10);
    });
    function mark(ctx, l, x, y, w, at, colours) {
        var c = colours || { keel: C.ink, rib: C.keel };
        group(ctx, x, y, w / 240, 0, function () {
            MARK_RIBS.forEach(function (pts, i) {
                var k = bo(l, at + 4 + i * 3, 12);
                if (k > 0) E.line(ctx, pts.slice(0, Math.max(2, Math.round(Math.min(1, k) * pts.length))), c.rib, 10);
            });
            var kk = eo(l, at, 16);
            if (kk > 0) E.fade(ctx, kk * 2, function () {
                ctx.save();
                ctx.translate(-(1 - kk) * 80, 0);
                E.line(ctx, MARK_KEEL, c.keel, 12);
                ctx.restore();
            });
        });
    }

    // ---- 1 hook (0–179) --------------------------------------------------
    // A dinghy with no keel rocks harder each wave and capsizes; three error
    // cards land beside it on the beat; blue stripes wipe it away.
    function dinghy(ctx) {
        E.line(ctx, [[0, -10], [0, -190]], C.ink, 6);
        fillPoly(ctx, [[8, -180], [8, -24], [96, -24]], C.signal, C.ink, 3);
        fillPoly(ctx, [[-120, -14], [126, -14], [104, 40]].concat(quad([104, 40], [0, 50], [-96, 40], 8).slice(1)), C.card, C.ink, 5);
        E.fade(ctx, 0.35, function () {
            E.line(ctx, quad([-110, 6], [0, 16], [116, 4], 8), C.ink, 2.5);
            E.line(ctx, [[-80, -4], [80, -4]], C.ink, 2.5);
        });
    }
    // The left side of shot 1: the dinghy capsizing, and its "no keel" label.
    function hullOpen(ctx, P, l) {
        group(ctx, 15, 35, 0.5, 0, function () {
            var spin = E.prog(l, 64, 36);
            if (spin > 0) E.fade(ctx, Math.min(1, spin * 2), function () {
                var pts = [], a0 = -0.62, sweep = 4.9 * E.expoOut(spin);
                for (var k = 0; k <= 40; k++) { var a = a0 - sweep * k / 40; pts.push([290 + 190 * Math.cos(a), 240 + 150 * Math.sin(a)]); }
                E.line(ctx, pts, C.faint, 4, [2, 12]);
                var p = pts[40], q = pts[38], d = Math.atan2(p[1] - q[1], p[0] - q[0]);
                group(ctx, p[0], p[1], 1, d, function () { fillPoly(ctx, [[10, 0], [-8, -10], [-8, 10]], C.faint); });
            });
            fillPoly(ctx, wave(330 - 35, 15, 200, l * 2.2, 480).map(function (p) { return [p[0] * 2 - 20, p[1]]; }), C.keelMid);
            var rock = Math.sin(l * 0.13) * (0.1 + 0.32 * E.prog(l, 0, 104));
            var cap = K.inOut(E.prog(l, 100, 56));
            var ang = E.lerp(rock, -1.85, cap), sink = cap * 36 + Math.sin(l * 0.1) * 5;
            group(ctx, 300 + cap * 20, 318 + sink, 1, ang, function () { dinghy(ctx); });
            fillPoly(ctx, wave(360 - 35, 12.5, 240, l * 3, 480).map(function (p) { return [p[0] * 2 - 20, p[1]]; }), C.keel);
            var nk = E.prog(l, 118, 14);
            if (nk > 0) {
                E.fade(ctx, nk * 3, function () {
                    ctx.save();
                    ctx.lineDashOffset = -l * 0.6;
                    E.circle(ctx, 362, 380, 40 * E.backOut(nk), null, C.fail, 3);
                    ctx.restore();
                    E.line(ctx, [[396, 360], [E.lerp(396, 470, E.expoOut(nk)), E.lerp(360, 250, E.expoOut(nk))]], C.fail, 2.5);
                });
                enter(ctx, l, 122, 420, 214, 130, 36, 0, function () {
                    E.box(ctx, 0, 0, 130, 36, 10, C.fail);
                    txt(ctx, P, t(P, 'hook.nokeel'), 65, 24, { size: 17, weight: '700', fill: C.card, align: 'center', maxW: 116 });
                }, { from: 1.6 });
            }
            [[420, 280, 7], [446, 262, 4], [180, 290, 5]].forEach(function (b, i) {
                var k = bo(l, 30 + i * 22, 12);
                E.circle(ctx, b[0], b[1] - E.prog(l, 30 + i * 22, 90) * 30, b[2] * k, C.keelMid);
            });
        });
    }
    // Shot 1: the left side (LEFT.open; LEFT.openKey names the line), then the three error cards, the one
    // line, and the stripes coming down over the last frames.
    function hook(LEFT) { return function (ctx, P, l) {
        LEFT.open(ctx, P, l);
        // terminal: tests: skipped
        enter(ctx, l, 18, 325, 33, 195, 62, -3, function () {
            term(ctx, P, 195, 62);
            if (l >= 22) txt(ctx, P, '$ npm test', 9, 28, { size: 8, mono: true, fill: C.termDim });
            if (l >= 30) txt(ctx, P, 'tests: skipped', 9, 42 + (1 - bo(l, 30, 10)) * 4, { size: 11, mono: true, weight: '700', fill: C.termBad });
            if (l >= 42) txt(ctx, P, t(P, 'hook.done'), 9, 55, { size: 8, mono: true, fill: C.termDim, maxW: 176 });
        });
        // diff: the wrong file
        var sd = K.shake(l, 60, 3);
        enter(ctx, l, 56, 410 + sd[0], 118 + sd[1], 205, 78, 2.5, function () {
            panel(ctx, 205, 78, { stroke: C.fail, lw: 1 });
            var bw = badge(ctx, P, 'js', 'JS', 9, 7);
            txt(ctx, P, 'lib/billing.js', 9 + bw + 5, 15, { size: 8, weight: '700', mono: true });
            var fw = measure(ctx, P, t(P, 'hook.wrong'), 7, '700') + 12;
            E.box(ctx, 196 - fw, 5, fw, 13, 6.5, C.fail);
            txt(ctx, P, t(P, 'hook.wrong'), 196 - fw / 2, 14.2, { size: 7, weight: '700', fill: C.card, align: 'center' });
            E.line(ctx, [[0, 23], [205, 23]], '#F1C7CC', 0.5);
            ctx.fillStyle = C.failTint;
            ctx.fillRect(0, 27, 205 * eo(l, 62, 12), 14);
            txt(ctx, P, '-  const rate = 0.05;', 9, 37, { size: 7.5, mono: true, fill: C.failInk });
            ctx.fillStyle = C.passTint;
            ctx.fillRect(0, 41, 205 * eo(l, 68, 12), 14);
            if (l >= 68) txt(ctx, P, '+  const rate = 0.5;', 9, 51, { size: 7.5, mono: true, fill: C.passInk });
            txt(ctx, P, t(P, 'hook.meant'), 9, 69, { size: 7, fill: C.mute, maxW: 186 });
        });
        // clash: two sessions, one file
        var sc = K.shake(l, 118, 4);
        enter(ctx, l, 96, 330 + sc[0], 210 + sc[1], 195, 56, -1.5, function () {
            panel(ctx, 195, 56);
            var meet = K.inOut(E.prog(l, 100, 18)) - 0.25 * K.decay(l, 118, 8);
            [[-1, C.keel, 'A'], [1, C.ink, 'B']].forEach(function (s) {
                var x = 97.5 + s[0] * E.lerp(76, 70, meet);
                E.circle(ctx, x, 22, 14.5, C.card);
                E.circle(ctx, x, 22, 13, s[1]);
                txt(ctx, P, s[2], x, 25, { size: 8, weight: '700', fill: C.card, align: 'center' });
                txt(ctx, P, 'session ' + s[2], x, 47, { size: 5.5, mono: true, fill: C.mute, align: 'center' });
            });
            var hit = l >= 118;
            E.box(ctx, 62, 12, 71, 18, 5, C.card, C.fail, hit ? 1.5 : 1);
            badge(ctx, P, 'js', 'JS', 66, 16);
            txt(ctx, P, 'store.js', 87, 24, { size: 7.5, weight: '600', mono: true });
            if (hit) txt(ctx, P, t(P, 'hook.same'), 97.5, 41, { size: 6.5, weight: '700', fill: C.fail, align: 'center', maxW: 90 });
            K.ring(ctx, 97.5, 21, 60, C.fail, l, 118, 26, 2);
        });
        sub(ctx, P, LEFT.openKey || 'hook', l, 6, { maxW: 290 });
        // the stripes come down over the last frames and hand to the keel
        for (var j = 0; j < 5; j++) {
            var k = E.expoIn(E.prog(l, 156 + j * 3, 12));
            if (k > 0) { ctx.fillStyle = STRIPES[j]; ctx.fillRect(j * 128, 0, 128.5, H * k); }
        }
    }; }

    // ---- 2 keel (180–299) -----------------------------------------------
    // The stripes pull back to a band on the left; a keel falls from above
    // onto its seven building blocks, trembles and holds; then the plan
    // slides left to where the stage shots draw it.
    var HULL2 = { x: 210, y: 35, s: 0.5806 };
    function hullDrop(ctx, P, l) {
        var mv = K.inOut(E.prog(l, 94, 26));
        var tf = { x: E.lerp(HULL2.x, HULL.x, mv), y: E.lerp(HULL2.y, HULL.y, mv), s: E.lerp(HULL2.s, HULL.s, mv) };
        var sh = K.shake(l, 28, 4);
        atHull(ctx, { x: tf.x + sh[0], y: tf.y + sh[1], s: tf.s }, function () {
            E.fade(ctx, mv, function () { E.line(ctx, [[30, 250], [600, 250]], C.keelMid, 1.5, [10, 6]); });
            for (var i = 0; i < 7; i++) E.box(ctx, HX(i) - 14, 310, 28, 12, 3, C.block);
            E.fade(ctx, E.prog(l, 34, 20), function () {
                for (var i = 0; i < 7; i++) {
                    E.fade(ctx, 0.6 * E.prog(l, 34 + i * 3, 10), function () {
                        E.line(ctx, arm(i, 1, 1), C.faint, 1.6, [5, 5]);
                        E.line(ctx, arm(i, -1, 1), C.faint, 1.6, [5, 5]);
                    });
                    txt(ctx, P, String(i + 1), HX(i), 346, { size: 14, mono: true, fill: C.faint, align: 'center' });
                }
            });
            E.fade(ctx, 1 - E.prog(l, 28, 6), function () { E.line(ctx, KEEL, C.faint, 2, [6, 6]); });
            var fall = E.expoIn(E.prog(l, 12, 16)), dy = (1 - fall) * -340;
            var rot = l < 28 ? -0.026 : -0.03 * Math.cos((l - 28) * 0.55) * K.decay(l, 28, 12);
            var streak = l < 28 ? E.prog(l, 12, 6) : 1 - E.prog(l, 28, 10);
            if (streak > 0) E.fade(ctx, streak, function () {
                [140, 230, 330, 430].forEach(function (x, k) {
                    var y = 110 + (k % 2) * 16 + dy * 0.3;
                    E.line(ctx, [[x, y], [x, y + 44 + (1 - fall) * 40]], C.faint, 4);
                });
            });
            group(ctx, 300, 300 + dy, 1, rot, function () {
                ctx.translate(-300, -300);
                E.line(ctx, KEEL, C.ink, E.lerp(15, 13, mv));
            });
            var imp = K.decay(l, 28, 10);
            if (imp > 0) E.fade(ctx, imp * 0.6, function () {
                [[[52, 336], [38, 346]], [[62, 340], [58, 354]], [[530, 336], [544, 346]], [[520, 340], [524, 354]]].forEach(function (s) { E.line(ctx, s, C.ink, 3); });
            });
            K.ring(ctx, 300, 300, 300, C.keel, l, 28, 30, 4);
        });
    }
    // The stripe band that pulls back to the left in shot 2.
    function wipe(ctx, l) {
        var band = E.lerp(W, 150, eo(l, 0, 26)) * (1 - eo(l, 94, 22));
        for (var j = 0; j < 5; j++) {
            ctx.fillStyle = STRIPES[j];
            ctx.fillRect(j * band / 5, 0, band / 5 + 0.5, H);
        }
    }
    // Shot 2: the left side (LEFT.drop), the stripe band, then the one line
    // (LEFT.dropKey, 'keel' by default).
    function keel(LEFT) { return function (ctx, P, l) {
        LEFT.drop(ctx, P, l);
        wipe(ctx, l);
        sub(ctx, P, LEFT.dropKey || 'keel', l, 40, { x: 174, alpha: 1 - E.prog(l, 94, 14) });
    }; }

    // ---- 3–9 the stage shots ---------------------------------------------
    // promo30's left side for a stage shot: the plan with this stage's rib rising.
    function hullStage(ctx, P, i, l, n) {
        atHull(ctx, HULL, function () {
            hullFrame(ctx, P, { n: n - 1, k: eo(l, 12, 32), gate: bo(l, 4, 12), gi: n - 1 });
            var g = hp(HX(n - 1), HD[n - 1], -HB[n - 1]);
            K.ring(ctx, g[0], g[1], 44, C.keel, l, 30, 26, 4);
        });
    }
    // Every stage shot: the plan with this stage's rib rising (its ✓ first),
    // the component on the right, the step pills, the statusline and the
    // one line. `body` draws the component.
    // The left side is LEFT.stage(ctx, P, i, l, n); LEFT.stageSub, when
    // there is one, replaces the one line.
    function stageShot(LEFT, i, body) {
        return function (ctx, P, l) {
            var n = dots(STARTS[i + 2] + l);
            LEFT.stage(ctx, P, i, l, n);
            body(ctx, P, l);
            pills(ctx, P, n, l, 2);
            status(ctx, P, n, l, 14);
            if (LEFT.stageSub) LEFT.stageSub(ctx, P, i, l); else sub(ctx, P, E.ROUTE[i], l, 10);
        };
    }

    // survey: the repo tree, read top to bottom; what exists is ticked.
    var TREE = [
        ['d', '.fankeel/'], ['f', 'map.md', 'md'], ['d', 'lib/'], ['f', 'task.js', 'js'], ['f', 'index.d.ts', 'ts'],
        ['d', 'scripts/'], ['f', 'render.js', 'js'], ['f', 'tune.js', 'js'], ['d', 'skills/'], ['f', 'SKILL.md', 'md'],
    ];
    var SCAN = [1, 3, 4, 6], SCAN_AT = [18, 34, 50, 66];
    function survey(ctx, P, l) {
        enter(ctx, l, 8, 350, 48, 250, 212, 0, function () {
            panel(ctx, 250, 212);
            var bw = badge(ctx, P, 'dir', 'DIR', 9, 6);
            txt(ctx, P, 'fankeel/', 9 + bw + 5, 14.2, { size: 8, weight: '700', mono: true });
            var tg = t(P, 'survey.map'), tw = measure(ctx, P, tg, 6.5) + 10;
            E.box(ctx, 241 - tw, 5, tw, 12, 6, C.paper);
            txt(ctx, P, tg, 241 - tw / 2, 13.3, { size: 6.5, fill: C.mute, align: 'center' });
            E.line(ctx, [[0, 22], [250, 22]], C.line, 0.5);
            var row = function (r) { return 27 + r * 18; };
            var j = -1;
            for (var q = 0; q < SCAN.length; q++) if (l >= SCAN_AT[q]) j = q;
            if (j >= 0) {
                var y = E.lerp(j ? row(SCAN[j - 1]) : row(SCAN[0]) - 18, row(SCAN[j]), eo(l, SCAN_AT[j], 10));
                E.fade(ctx, E.prog(l, SCAN_AT[0], 6), function () {
                    ctx.fillStyle = C.signalTint;
                    ctx.fillRect(0, y, 250, 18);
                    ctx.fillStyle = C.signal;
                    ctx.fillRect(0, y, 2, 18);
                });
            }
            TREE.forEach(function (e, r) {
                var y = row(r) + 12;
                if (e[0] === 'd') {
                    E.box(ctx, 9, y - 7, 8, 6, 1, C.faint);
                    txt(ctx, P, e[1], 22, y, { size: 7.5, weight: '600', mono: true, fill: C.mute });
                    return;
                }
                E.line(ctx, [[13, row(r)], [13, row(r) + 18]], C.line, 0.5);
                var s = SCAN.indexOf(r), dim = s < 0;
                E.fade(ctx, dim ? 0.35 : 1, function () { badge(ctx, P, e[2], e[2].toUpperCase(), 24, y - 7.5); });
                txt(ctx, P, e[1], 46, y, { size: 7.5, mono: true, fill: dim ? C.faint : C.ink });
                if (s >= 0 && s < 3) {
                    var k = bo(l, SCAN_AT[s] + 8, 12);
                    if (k > 0) {
                        okDot(ctx, 206 - measure(ctx, P, t(P, 'survey.have'), 6.5, '600'), y - 2.5, 5, k);
                        E.fade(ctx, k, function () { txt(ctx, P, t(P, 'survey.have'), 241, y, { size: 6.5, weight: '600', fill: C.pass, align: 'right' }); });
                    }
                } else if (s === 3 && l >= SCAN_AT[3] + 6) {
                    var dotsN = Math.floor((l - SCAN_AT[3]) / 12) % 4;
                    txt(ctx, P, t(P, 'survey.read') + '...'.slice(0, dotsN), 241 - 10, y, { size: 6.5, weight: '600', fill: C.signalInk, align: 'right' });
                }
            });
        });
    }

    // design: the mockup page; the cursor Alt-clicks the hero block and only
    // it is rewritten, with a flash; then a red acceptance test beside it.
    function design(ctx, P, l) {
        var click = 72, done = l >= click;
        enter(ctx, l, 8, 345, 48, 235, 183, 0, function () {
            panel(ctx, 235, 183);
            for (var i = 0; i < 3; i++) E.circle(ctx, 9 + i * 8.5, 9, 2.75, C.line);
            E.box(ctx, 37, 3.5, 190, 11, 5.5, C.paper);
            txt(ctx, P, 'localhost:7819/mockup.html', 43, 11.5, { size: 6.5, mono: true, fill: C.mute });
            E.line(ctx, [[0, 18], [235, 18]], C.line, 0.5);
            E.box(ctx, 8, 26, 45, 11, 2, '#CDD3DB');
            for (var n = 0; n < 3; n++) E.box(ctx, 57 + n * 32, 26, 28, 11, 2, '#E1E5EA');
            var hy = 43, hw = 219;
            var sel = E.prog(l, 54, 8);
            if (sel > 0) E.fade(ctx, sel, function () { E.box(ctx, 6.5, hy - 1.5, hw + 3, 78, 4, null, C.keel, 1.5); });
            E.box(ctx, 8, hy, hw, 75, 3, done ? C.signalTint : '#EBEEF1');
            if (!done) {
                E.box(ctx, 18, hy + 10, 80, 9, 2, '#C3C9D1');
                E.box(ctx, 18, hy + 27, 150, 5, 2, '#D4D9DF');
                E.box(ctx, 18, hy + 36, 110, 5, 2, '#D4D9DF');
                E.box(ctx, 18, hy + 50, 55, 14, 7, '#C3C9D1');
            } else {
                var r = eo(l, click, 18);
                E.fade(ctx, 0.85, function () { E.box(ctx, 18, hy + 10, hw * 0.62 * r, 9, 2, C.ink); });
                E.fade(ctx, 0.6, function () {
                    E.box(ctx, 18, hy + 27, hw * 0.78 * eo(l, click + 4, 18), 5, 2, '#B8A26A');
                    E.box(ctx, 18, hy + 36, hw * 0.54 * eo(l, click + 8, 18), 5, 2, '#B8A26A');
                });
                E.box(ctx, 18, hy + 50, 55, 14, 7 * bo(l, click + 10, 12), C.keel);
                E.fade(ctx, K.decay(l, click, 8), function () { E.box(ctx, 8, hy, hw, 75, 3, C.card); });
            }
            if (sel > 0) {
                var lb = 'data-block="hero"', lw = measure(ctx, P, lb, 6, '400', true) + 8;
                E.fade(ctx, sel, function () {
                    E.box(ctx, 8 + hw - 5 - lw, hy + 5, lw, 11, 3, C.keel);
                    txt(ctx, P, lb, 8 + hw - 5 - lw / 2, hy + 12.8, { size: 6, mono: true, fill: C.card, align: 'center' });
                });
            }
            E.box(ctx, 8, 124, 106, 37, 3, '#EBEEF1');
            E.box(ctx, 121, 124, 106, 37, 3, '#EBEEF1');
            E.box(ctx, 8, 167, 88, 8, 3, '#EBEEF1');
            var fl = E.prog(l, click, 16);
            if (fl > 0 && fl < 1) E.fade(ctx, 1 - fl, function () {
                [-0.52, 0, 0.52].forEach(function (a, k) {
                    var ox = 8 + hw + 4 + fl * 8, oy = hy + 14 + k * 16;
                    group(ctx, ox, oy, 1, a, function () { E.box(ctx, 0, -2, 11, 4, 2, C.signal); });
                });
            });
        });
        // the cursor and Alt + click
        var mv = K.inOut(E.prog(l, 26, 34)), press = 1 - 0.18 * K.decay(l, click, 6) * (l >= click ? 1 : 0);
        if (l >= 24) {
            var cx = E.lerp(610, 500, mv), cy = E.lerp(300, 125, mv);
            K.ring(ctx, cx, cy, 22, C.keel, l, click, 22, 2);
            cursor(ctx, cx, cy, press);
            enter(ctx, l, 56, cx + 16, cy + 16, 70, 16, 0, function () {
                var kw = measure(ctx, P, 'Alt', 7, '700', true) + 10;
                E.box(ctx, 0, 1, kw, 13, 3, C.card, C.faint, 0.5);
                E.line(ctx, [[1, 14.5], [kw - 1, 14.5]], C.faint, 1.5);
                txt(ctx, P, 'Alt', kw / 2, 10.5, { size: 7, weight: '700', mono: true, align: 'center' });
                txt(ctx, P, '+ ' + t(P, 'design.click'), kw + 4, 11, { size: 7, weight: '600' });
            }, { from: 0.8, dy: 4 });
        }
        // the acceptance test: red now
        enter(ctx, l, 104, 465, 226, 145, 45, 1.5, function () {
            panel(ctx, 145, 45, { stroke: C.fail, lw: 1 });
            xDot(ctx, 16, 16, 5, bo(l, 108, 12));
            txt(ctx, P, 'criterion', 26, 19.5, { size: 9.5, weight: '700', mono: true, fill: C.fail });
            txt(ctx, P, t(P, 'design.crit'), 9, 36, { size: 7, fill: C.mute, maxW: 128 });
        });
    }

    // plan: plan.md splits into two groups side by side, each task with its
    // Files: list; the file both of group A's tasks touch is highlighted.
    var TASKS = [
        { id: 'T1', key: 'plan.t1', files: [['lib/cli.js', 1]], x: 344, y: 129, at: 34 },
        { id: 'T2', key: 'plan.t2', files: [['lib/cli.js', 1], ['tests/cli.test.js', 0]], x: 344, y: 185, at: 46 },
        { id: 'T3', key: 'plan.t3', files: [['README.md', 0]], x: 486, y: 129, at: 40 },
        { id: 'T4', key: 'plan.t4', files: [['lib/station.js', 0]], x: 486, y: 185, at: 52 },
    ];
    function taskCard(ctx, P, c, l, w) {
        var fw = [measure(ctx, P, 'Files:', 6.5, '700', true) + 7].concat(c.files.map(function (f) { return measure(ctx, P, f[0], 6.5, '400', true) + 7; }));
        var rows = 1, x = 8;
        fw.forEach(function (v, i) { if (i && x + v > w - 8) { rows++; x = 8; } x += v + 3; });
        var h = 36 + (rows - 1) * 13;
        panel(ctx, w, h);
        txt(ctx, P, c.id, 8, 14, { size: 6.5, weight: '600', mono: true, fill: C.mute });
        txt(ctx, P, t(P, c.key), 21, 14, { size: 8, weight: '700', maxW: w - 29 });
        var y = 20;
        x = 8;
        fw.forEach(function (v, i) {
            if (i && x + v > w - 8) { y += 13; x = 8; }
            if (!i) {
                E.box(ctx, x, y, v, 10, 3, C.keel);
                txt(ctx, P, 'Files:', x + 3.5, y + 7.3, { size: 6.5, weight: '700', mono: true, fill: C.card });
            } else {
                var f = c.files[i - 1], shared = f[1];
                E.box(ctx, x, y, v, 10, 3, shared ? C.signalTint : C.paper);
                if (shared) {
                    var pulse = 1 + 0.5 * K.decay(l, 70, 12);
                    E.line(ctx, [[x + 1, y + 9.5], [x + v - 1, y + 9.5]], C.signal, pulse);
                }
                txt(ctx, P, f[0], x + 3.5, y + 7.3, { size: 6.5, mono: true });
            }
            x += v + 3;
        });
    }
    function plan(ctx, P, l) {
        enter(ctx, l, 8, 431, 45, 80, 20, 0, function () {
            panel(ctx, 80, 20);
            var bw = badge(ctx, P, 'md', 'MD', 8, 5);
            txt(ctx, P, 'plan.md', 8 + bw + 5, 13, { size: 7.5, weight: '600', mono: true });
        });
        var ln = eo(l, 14, 20);
        if (ln > 0) {
            var mid = 91, dx = 71 * ln;
            E.line(ctx, [[471, 66], [471, E.lerp(66, mid, Math.min(1, ln * 2))]], C.faint, 1.25);
            if (ln > 0.5) {
                E.line(ctx, [[471, mid], [471 - dx, mid], [471 - dx, E.lerp(mid, 108, (ln - 0.5) * 2)]], C.faint, 1.25);
                E.line(ctx, [[471, mid], [471 + dx, mid], [471 + dx, E.lerp(mid, 108, (ln - 0.5) * 2)]], C.faint, 1.25);
            }
        }
        [['A', 'plan.a', 346], ['B', 'plan.b', 488]].forEach(function (g) {
            enter(ctx, l, 28, g[2], 109, 60, 14, 0, function () {
                E.box(ctx, 0, 1, 11, 11, 3, C.ink);
                txt(ctx, P, g[0], 5.5, 9.5, { size: 6.5, weight: '700', mono: true, fill: C.card, align: 'center' });
                txt(ctx, P, t(P, g[1]), 15, 10.5, { size: 7.5, weight: '700' });
            }, { from: 0.8, dy: 4 });
        });
        var par = t(P, 'plan.par'), pw = measure(ctx, P, par, 7, '700') + 12;
        enter(ctx, l, 30, 541 - pw / 2 + 20, 70, pw, 13, 0, function () {
            E.box(ctx, 0, 0, pw, 13, 6.5, C.keelTint);
            txt(ctx, P, par, pw / 2, 9.4, { size: 7, weight: '700', fill: C.keel, align: 'center' });
        }, { from: 0.8, dy: 4 });
        TASKS.forEach(function (c) {
            var p = E.prog(l, c.at, 20);
            if (!(p > 0)) return;
            var k = E.expoOut(p), s = E.lerp(0.35, 1, E.backOut(p));
            var x = E.lerp(471, c.x + 62.5, k), y = E.lerp(55, c.y + 20, k);
            E.fade(ctx, p * 3, function () {
                group(ctx, x, y, s, (1 - k) * (c.x < 400 ? -0.2 : 0.2), function () {
                    ctx.translate(-62.5, -20);
                    taskCard(ctx, P, c, l, 125);
                });
            });
        });
    }

    // build: one card splits into four agents that run side by side; each
    // is stamped reviewed as it comes back.
    var AGENTS = [
        { av: 'A1', id: 'T1', key: 'plan.t1', file: 'lib/cli.js', x: 345, y: 99, end: 90, deg: -9 },
        { av: 'A2', id: 'T3', key: 'plan.t3', file: 'README.md', x: 483, y: 99, end: 104, deg: 7 },
        { av: 'A3', id: 'T2', key: 'plan.t2', file: 'tests/cli.test.js', x: 345, y: 170, end: 128, deg: -6 },
        { av: 'A4', id: 'T4', key: 'plan.t4', file: 'lib/station.js', x: 483, y: 170, end: 150, deg: 6 },
    ];
    function build(ctx, P, l) {
        var fan = t(P, 'build.fan'), cw = measure(ctx, P, fan, 7.5, '600') + 36;
        enter(ctx, l, 8, 477.5 - cw / 2, 46, cw, 20, 0, function () {
            panel(ctx, cw, 20);
            var bw = badge(ctx, P, 'dir', '4×', 8, 5);
            txt(ctx, P, fan, 8 + bw + 5, 13, { size: 7.5, weight: '600' });
        });
        var ln = eo(l, 16, 16);
        if (ln > 0) {
            E.line(ctx, [[477.5, 67], [477.5, 80]], C.faint, 1.25);
            E.line(ctx, [[477.5, 80], [477.5 - 67.5 * ln, 80], [477.5 - 67.5 * ln, E.lerp(80, 97, ln)]], C.faint, 1.25);
            E.line(ctx, [[477.5, 80], [477.5 + 68.5 * ln, 80], [477.5 + 68.5 * ln, E.lerp(80, 97, ln)]], C.faint, 1.25);
        }
        AGENTS.forEach(function (a, j) {
            var p = E.prog(l, 20 + j * 2, 22);
            if (!(p > 0)) return;
            var k = E.expoOut(p), x = E.lerp(412.5, a.x, k), y = E.lerp(70, a.y, k);
            var run = E.prog(l, 42, a.end - 42), finished = l >= a.end;
            E.fade(ctx, Math.min(1, p * 4), function () {
                group(ctx, x, y, E.lerp(0.7, 1, E.backOut(p)), 0, function () {
                    panel(ctx, 130, 45);
                    E.circle(ctx, 17, 16, 8.5, C.ink);
                    txt(ctx, P, a.av, 17, 18.3, { size: 6.5, weight: '700', mono: true, fill: C.card, align: 'center' });
                    txt(ctx, P, a.id + ' ' + t(P, a.key), 30, 14.5, { size: 7.5, weight: '700', maxW: 94 });
                    txt(ctx, P, a.file, 30, 23, { size: 6, mono: true, fill: C.mute });
                    E.box(ctx, 8, 32, 114, 4, 2, C.line);
                    if (run > 0) E.box(ctx, 8, 32, 114 * run, 4, 2, finished ? C.pass : C.keel);
                    txt(ctx, P, Math.round(run * 100) + '%', 122, 43, { size: 5.5, mono: true, fill: C.mute, align: 'right' });
                });
            });
        });
        AGENTS.forEach(function (a) {
            var label = 'reviewed', lw = measure(ctx, P, label, 9.5, '700', true), w = lw + 30;
            stamp(ctx, l, a.end + 4, a.x + 80, a.y + 26, a.deg, w, 18, C.pass, function () {
                txt(ctx, P, label, -w / 2 + 8, 3.4, { size: 9.5, weight: '700', mono: true, fill: C.pass });
                E.tick(ctx, w / 2 - 17, 0, 0.6, 1, C.pass, 2);
            });
        });
    }

    // verify: claim to evidence, a row a beat; a mutation turns row 3 red
    // and the fix turns it back; the design's criterion goes green.
    var ROWS = [
        { n: '1', c: 'verify.c1', e: 'cli.test.js:42', at: 16 },
        { n: '2', c: 'verify.c2', e: 'git show --stat', at: 24 },
        { n: '3', c: 'verify.c3', e: 'mutate: return null', at: 32 },
        { n: '4', c: null, e: 'node --test', at: 40 },
    ];
    function res(ctx, P, x, cy, good, label, k) {
        var tw = label ? measure(ctx, P, label, 7, '700', true) + 4 : 0, w = 14 + tw + 3;
        E.box(ctx, x, cy - 6.5, w, 13, 6.5, good ? C.passTint : C.failTint);
        if (good) okDot(ctx, x + 6.5, cy, 5, k);
        else xDot(ctx, x + 6.5, cy, 5, k);
        if (label) txt(ctx, P, label, x + 15, cy + 2.5, { size: 7, weight: '700', mono: true, fill: good ? C.pass : C.fail });
        return w;
    }
    function verify(ctx, P, l) {
        var mut = 62, fix = 84, green = 108;
        enter(ctx, l, 8, 338, 52, 280, 160, 0, function () {
            panel(ctx, 280, 160);
            txt(ctx, P, t(P, 'verify.h'), 9, 14.5, { size: 8, weight: '700' });
            E.line(ctx, [[0, 22], [280, 22]], C.line, 0.5);
            [['verify.n', 8], ['verify.claim', 24], ['verify.ev', 122], ['verify.res', 198]].forEach(function (h) {
                txt(ctx, P, t(P, h[0]), h[1], 32, { size: 6.5, weight: '600', fill: C.mute });
            });
            E.line(ctx, [[0, 36], [280, 36]], C.line, 0.5);
            ROWS.forEach(function (r, i) {
                var p = E.prog(l, r.at, 14);
                if (!(p > 0)) return;
                var top = 36 + i * 31, cy = top + 15.5, k = E.expoOut(p);
                E.fade(ctx, Math.min(1, p * 2), function () {
                    ctx.save();
                    ctx.translate((1 - k) * -20, 0);
                    if (i === 3) {
                        var g = E.prog(l, green, 12);
                        if (g > 0) E.fade(ctx, g, function () {
                            ctx.fillStyle = C.passTint;
                            ctx.fillRect(0, top, 280, 31);
                            ctx.fillStyle = C.pass;
                            ctx.fillRect(0, top, 2, 31);
                        });
                    }
                    txt(ctx, P, r.n, 8, cy + 2.5, { size: 7.5, mono: true, fill: C.mute });
                    if (r.c) txt(ctx, P, t(P, r.c), 24, cy + 2.5, { size: 7.5, weight: '600', maxW: 92 });
                    else {
                        txt(ctx, P, 'criterion', 24, cy + 2.5, { size: 7.5, weight: '600', mono: true });
                        var fr = t(P, 'verify.from'), fw = measure(ctx, P, fr, 6, '600') + 8;
                        E.box(ctx, 68, cy - 5, fw, 10, 5, C.ink);
                        txt(ctx, P, fr, 68 + fw / 2, cy + 2, { size: 6, weight: '600', fill: C.card, align: 'center' });
                    }
                    var ew = measure(ctx, P, r.e, 6.5, '400', true) + 7;
                    E.box(ctx, 122, cy - 5.5, Math.min(ew, 72), 11, 3, C.paper);
                    txt(ctx, P, r.e, 125.5, cy + 2.3, { size: 6.5, mono: true, maxW: 65 });
                    if (i < 2) res(ctx, P, 198, cy, true, 'pass', bo(l, r.at + 8, 12));
                    else if (i === 2) {
                        if (l < mut) res(ctx, P, 198, cy, true, 'pass', bo(l, r.at + 8, 12));
                        else if (l < fix) {
                            var sh = K.shake(l, mut, 2.5);
                            res(ctx, P, 198 + sh[0], cy + sh[1], false, 'red', bo(l, mut, 10));
                        } else {
                            var rw = 0;
                            E.fade(ctx, 0.75, function () {
                                rw = res(ctx, P, 198, cy, false, 'red', 1);
                                E.line(ctx, [[201, cy], [201 + (rw - 6) * eo(l, fix, 10), cy]], C.fail, 1);
                            });
                            txt(ctx, P, '→', 198 + rw + 3, cy + 2.5, { size: 7, mono: true, fill: C.mute });
                            if (l >= fix + 6) res(ctx, P, 198 + rw + 13, cy, true, '', bo(l, fix + 6, 12));
                        }
                    } else if (l < green) res(ctx, P, 198, cy, false, 'criterion', bo(l, r.at + 8, 12));
                    else res(ctx, P, 198, cy, true, 'criterion', bo(l, green, 12));
                    ctx.restore();
                });
                if (i < 3) E.line(ctx, [[0, top + 31], [280, top + 31]], C.line, 0.5);
            });
            K.ring(ctx, 210, 36 + 3 * 31 + 15.5, 50, C.pass, l, green, 26, 2.5);
        });
    }

    // audit: a sentence in a doc is struck through, the page is stamped
    // stale, and the finished plan slides into 99-archive/.
    function audit(ctx, P, l) {
        var sh = K.shake(l, 58, 3);
        enter(ctx, l, 8, 342 + sh[0], 50 + sh[1], 165, 118, 0, function () {
            panel(ctx, 165, 118);
            var bw = badge(ctx, P, 'md', 'MD', 9, 6);
            txt(ctx, P, 'docs/station.md', 9 + bw + 5, 14.2, { size: 7.5, weight: '700', mono: true });
            E.line(ctx, [[0, 22], [165, 22]], C.line, 0.5);
            var bx = 10, bwid = 145;
            E.box(ctx, bx, 31, bwid * 0.55, 8, 2.5, '#C9D0D8');
            [[0.92, 45], [0.84, 55.5]].forEach(function (r) { E.box(ctx, bx, r[1], bwid * r[0], 5, 2.5, '#E3E7EB'); });
            var s = t(P, 'audit.sent'), sw = Math.min(bwid, measure(ctx, P, s, 8, '500'));
            txt(ctx, P, s, bx, 73, { size: 8, weight: '500', fill: '#7B8491', maxW: bwid });
            var st = eo(l, 30, 16);
            if (st > 0) { ctx.fillStyle = C.fail; ctx.fillRect(bx, 69.2, sw * st, 1.2); }
            [[0.88, 81], [0.6, 91.5], [0.8, 102]].forEach(function (r) { E.box(ctx, bx, r[1], bwid * r[0], 5, 2.5, '#E3E7EB'); });
        });
        var big = t(P, 'audit.stale'), zh = P.lang === 'zh';
        var sw2 = measure(ctx, P, big, 20, '800') + 22;
        stamp(ctx, l, 58, 452, 170, -12, sw2, zh ? 38 : 30, C.fail, function () {
            txt(ctx, P, big, 0, zh ? 3 : 7, { size: 20, weight: '800', fill: C.fail, align: 'center' });
            if (zh) txt(ctx, P, 'S T A L E', 0, 13, { size: 6, mono: true, fill: C.fail, align: 'center' });
        });
        // the folder, and the plan sliding into it between its back and front
        enter(ctx, l, 80, 520, 165, 100, 85, 0, function () {
            E.box(ctx, 0, 0, 60, 15, 5, C.keelDeep);
            E.box(ctx, 0, 9, 100, 76, 7, C.keelDeep);
            var p = K.inOut(E.prog(l, 90, 30)), y = E.lerp(-190, -22, p);
            if (l >= 90) {
                if (p < 1) E.fade(ctx, 0.8 * (1 - p), function () {
                    [[70, -30, 20], [90, -44, 28], [110, -26, 17]].forEach(function (s) { E.box(ctx, s[0] - 20, s[1] + y * 0.2, 2, s[2], 1, C.faint); });
                });
                group(ctx, 52.5, y + 37.5, 1, -0.1 * p, function () {
                    ctx.translate(-47.5, -37.5);
                    panel(ctx, 95, 75);
                    var bw = badge(ctx, P, 'md', 'MD', 7, 7);
                    txt(ctx, P, 'plan-0912.md', 7 + bw + 4, 15, { size: 6.5, weight: '600', mono: true, maxW: 95 - 18 - bw });
                    [0.9, 0.7, 0.82].forEach(function (w, i) { E.box(ctx, 7, 25 + i * 8.5, 81 * w, 4, 2, '#E3E7EB'); });
                });
            }
            ctx.save();
            ctx.shadowColor = 'rgba(24,32,44,.35)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetY = -3;
            E.box(ctx, 0, 32, 100, 53, 7, C.keel);
            ctx.restore();
            txt(ctx, P, '99-archive/', 10, 77, { size: 10, weight: '700', mono: true, fill: C.card, maxW: 82 });
            K.ring(ctx, 50, 40, 60, C.keel, l, 118, 26, 3);
        });
    }

    // land: merge is chosen, the spare worktrees fold away one by one, and
    // the terminal says clean.
    var OPTS = [['land.merge', 'merge'], ['land.pr', 'pr'], ['land.keep', 'keep']];
    var TREES = [{ name: 'wt-task-c', x: 535, y: 60, at: 56 }, { name: 'wt-task-b', x: 531, y: 75, at: 70 }, { name: 'wt-task-a', x: 527, y: 91, at: 84 }];
    function land(ctx, P, l) {
        var click = 36;
        enter(ctx, l, 8, 344, 50, 180, 104, 0, function () {
            panel(ctx, 180, 104);
            txt(ctx, P, t(P, 'land.q'), 9, 14.5, { size: 8, weight: '700', maxW: 162 });
            E.line(ctx, [[0, 22], [180, 22]], C.line, 0.5);
            OPTS.forEach(function (o, i) {
                var y = 26 + i * 24, sel = i === 0 ? eo(l, click, 10) : 0;
                if (sel > 0) E.fade(ctx, sel, function () { E.box(ctx, 5, y, 170, 24, 5, C.keelTint, C.keel, 1); });
                E.circle(ctx, 20, y + 12, 4.5, C.card, sel > 0.5 ? C.keel : C.faint, sel > 0.5 ? 2.5 : 1);
                txt(ctx, P, t(P, o[0]), 31, y + 15, { size: 8, weight: sel > 0.5 ? '700' : '400', fill: sel > 0.5 ? C.ink : C.mute, maxW: 100 });
                txt(ctx, P, o[1], 168, y + 15, { size: 6.5, mono: true, fill: sel > 0.5 ? C.keel : C.faint, align: 'right' });
            });
        });
        TREES.forEach(function (w, i) {
            var fold = E.expoIn(E.prog(l, w.at, 14));
            if (fold >= 1) return;
            var k = E.prog(l, 12 + i * 4, 14);
            if (!(k > 0)) return;
            E.fade(ctx, Math.min(1, k * 3) * (1 - fold), function () {
                group(ctx, w.x + 52.5 + fold * 30, w.y + 11 - fold * 10, E.backOut(k) * (1 - fold * 0.7), (i - 1) * 0.03 + fold * 0.4, function () {
                    ctx.translate(-52.5, -11);
                    panel(ctx, 105, 22, { blur: 8, dy: 3 });
                    var bw = badge(ctx, P, 'wt', 'WT', 7, 6);
                    txt(ctx, P, w.name, 7 + bw + 5, 14, { size: 7, mono: true });
                    if (l >= w.at - 10) txt(ctx, P, t(P, 'land.fold'), 99, 14, { size: 6, fill: C.mute, align: 'right' });
                });
            });
        });
        var mv = K.inOut(E.prog(l, 12, 22)), cx = E.lerp(560, 420, mv), cy = E.lerp(250, 88, mv);
        if (l >= 10 && l < 60) E.fade(ctx, 1 - E.prog(l, 48, 12), function () {
            K.ring(ctx, cx, cy, 20, C.keel, l, click, 20, 2);
            cursor(ctx, cx, cy, 1 - 0.18 * K.decay(l, click, 6) * (l >= click ? 1 : 0));
        });
        enter(ctx, l, 92, 380, 165, 220, 62, 0, function () {
            term(ctx, P, 220, 62);
            var cmd = '$ git worktree list', n = Math.max(0, Math.min(cmd.length, Math.floor((l - 96) / 0.8)));
            txt(ctx, P, cmd.slice(0, n), 9, 28, { size: 8, mono: true, fill: C.termDim });
            if (l >= 116) txt(ctx, P, 'F:/ymlab/fankeel  [main]', 9, 41, { size: 8, mono: true, fill: C.termDim });
            if (l >= 122) txt(ctx, P, 'git status: clean ✓', 9, 55 + (1 - bo(l, 122, 10)) * 4, { size: 11, weight: '700', mono: true, fill: C.termGood });
        });
        K.ring(ctx, 450, 215, 90, C.pass, l, 122, 30, 3);
    }

    // ---- 10 sail (1410–1799) ---------------------------------------------
    // The planks close along the ribs from stern to bow, the hull rights
    // itself onto the sea, the sails go up and it sails; on the resolve
    // (local 150, frame 1560) the mark locks up beside the wordmark, and
    // the install line types in under them.
    var CMD = '/plugin install fankeel';
    // Shot 10 as the hull left side draws it: the whole shot, right side included.
    function hullClose(ctx, P, l) {
        var ui = 1 - eo(l, 0, 18);
        var skin = K.inOut(E.prog(l, 8, 52));
        var mv = K.inOut(E.prog(l, 24, 60));
        var sea = eo(l, 30, 50), hoist = eo(l, 70, 36);
        var seaY = (1 - sea) * 150;
        fillPoly(ctx, wave(244 + seaY, 4, 75, l * 1.4, H + 10), C.keelMid);
        var rot = 0.08 * Math.sin(Math.PI * mv) - 0.035 * mv + Math.sin(l * 0.05) * 0.018 * sea;
        var bob = Math.sin(l * 0.07) * 2.5 * sea;
        atHull(ctx, { x: E.lerp(HULL.x, 20, mv), y: E.lerp(HULL.y, 105, mv) + bob, s: E.lerp(HULL.s, 0.5, mv) }, function () {
            ctx.translate(310, 300);
            ctx.rotate(rot);
            ctx.translate(-310, -300);
            // the bare frame shows only ahead of the planking's edge
            ctx.save();
            ctx.beginPath();
            ctx.rect(40 + 580 * skin, -400, 1200, 1200);
            ctx.clip();
            hullFrame(ctx, P, { n: 7, k: 0, gate: 1, gi: 6, gateAlpha: ui, wl: ui });
            ctx.restore();
            if (skin > 0) {
                ctx.save();
                ctx.beginPath();
                ctx.rect(-400, -400, 440 + 580 * skin, 1200);
                ctx.clip();
                doneHull(ctx, hoist);
                ctx.restore();
            }
        });
        fillPoly(ctx, wave(258 + seaY, 5, 95, l * 1.9, H + 10), C.keel);
        if (sea > 0) E.fade(ctx, 0.7 * sea, function () {
            [[20, 280, 30], [35, 290, 45], [10, 300, 25]].forEach(function (w, i) {
                var x = w[0] - ((l * 0.9 + i * 23) % 60);
                E.line(ctx, [[x, w[1]], [x + w[2], w[1]]], C.card, 2);
            });
        });
        E.fade(ctx, ui, function () {
            pills(ctx, P, 7, l, -99);
            status(ctx, P, 7, l, -99);
        });
        // the mark and the wordmark, locking up on the resolve
        var lockX = 360, lockY = 75;
        mark(ctx, l, lockX, lockY, 84, 146);
        group(ctx, lockX + 94, lockY + 33, 1 + 0.008 * Math.sin(l * 0.08), 0, function () {
            K.word(ctx, P, 'fankeel', 0, 0, 40, l, 150, { gap: 3, fill: C.ink });
        });
        K.ring(ctx, lockX + 42, lockY + 18, 120, C.keel, l, 150, 40, 3);
        // the install line
        var ik = E.prog(l, 190, 16);
        if (ik > 0) {
            var copy = t(P, 'sail.copy'), cw = measure(ctx, P, copy, 7, '700') + 14;
            var tw = measure(ctx, P, '> ' + CMD, 11, '400', true), w = 12 + tw + 8 + cw + 6, h = 24;
            E.fade(ctx, ik * 3, function () {
                group(ctx, lockX, lockY + 53 + (1 - E.expoOut(ik)) * 10, 1, 0, function () {
                    panel(ctx, w, h, { fill: C.ink, r: 12 });
                    txt(ctx, P, '>', 12, 16, { size: 11, mono: true, fill: C.dotLit });
                    var n = Math.max(0, Math.min(CMD.length, Math.floor((l - 196) / 1.3)));
                    var gx = 12 + measure(ctx, P, '> ', 11, '400', true);
                    txt(ctx, P, CMD.slice(0, n), gx, 16, { size: 11, mono: true, fill: C.paper });
                    if (n < CMD.length || Math.floor(l / 20) % 2 === 0) {
                        E.box(ctx, gx + measure(ctx, P, CMD.slice(0, n), 11, '400', true) + 1, 6, 5.5, 12, 1, C.dotLit);
                    }
                    var ck = bo(l, 232, 12);
                    if (ck > 0) group(ctx, w - 6 - cw / 2, h / 2, ck * (1 - 0.1 * K.decay(l, 290, 6) * (l >= 290 ? 1 : 0)), 0, function () {
                        E.box(ctx, -cw / 2, -7.5, cw, 15, 7.5, C.signal);
                        txt(ctx, P, copy, 0, 2.6, { size: 7, weight: '700', align: 'center' });
                    });
                });
            });
        }
        sub(ctx, P, 'install', l, 250, { fill: C.card });
    }

    // The shot table: name, length, the frames a block pops on, and `make`,
    // which takes a left side and returns the shot's draw(ctx, P, l). The
    // boundaries and pops are shared by every timeline built on it.
    var SHOTS = [
        { name: 'hook', len: 180, make: hook, pops: [18, 30, 56, 96, 118] },
        { name: 'keel', len: 120, make: keel, pops: [28] },
        { name: 'survey', len: 150, make: function (L) { return stageShot(L, 0, survey); }, pops: [4, 8, 26, 42, 58] },
        { name: 'design', len: 180, make: function (L) { return stageShot(L, 1, design); }, pops: [4, 8, 72, 104] },
        { name: 'plan', len: 120, make: function (L) { return stageShot(L, 2, plan); }, pops: [4, 8, 34, 40, 46, 52] },
        { name: 'build', len: 180, make: function (L) { return stageShot(L, 3, build); }, pops: [4, 8, 20, 94, 108, 132, 154] },
        { name: 'verify', len: 150, make: function (L) { return stageShot(L, 4, verify); }, pops: [4, 8, 62, 84, 108] },
        { name: 'audit', len: 180, make: function (L) { return stageShot(L, 5, audit); }, pops: [4, 8, 30, 58, 80, 118] },
        { name: 'land', len: 150, make: function (L) { return stageShot(L, 6, land); }, pops: [4, 8, 36, 56, 70, 84, 122] },
        { name: 'sail', len: 390, make: function (L) { return L.close; }, pops: [60, 150, 150 + 4, 153 + 4, 156 + 4, 159 + 4, 162 + 4, 165 + 4, 168 + 4, 190, 232] },
    ];
    var LENGTH = 1800;
    var STARTS = [];
    var end = SHOTS.reduce(function (at, c) { STARTS.push(at); return at + c.len; }, 0);
    if (end !== LENGTH) throw new Error('tour: promo30 runs to ' + end + ' frames, not ' + LENGTH);

    // Lit statusline dots: the stage shot the frame sits in, counted from 1;
    // all seven from land on.
    function dots(f) {
        var n = 0;
        for (var i = 2; i < SHOTS.length; i++) if (f >= STARTS[i]) n = Math.min(7, i - 1);
        return n;
    }

    // The step pills top-left, the reference film's device: a stage shot
    // shows the first dots(f) of these, its own outlined.
    var PILLS = E.ROUTE.map(function (s, i) { return '0' + (i + 1) + ' ' + s; });

    // A timeline over the shared shots and one left side: LEFT is
    // { open(ctx, P, l), drop(ctx, P, l), stage(ctx, P, i, l, n), close(ctx, P, l),
    //   openKey?, dropKey?, stageSub?(ctx, P, i, l) } as used above.
    function timeline(LEFT) {
        var drawers = SHOTS.map(function (c) { return c.make(LEFT); });
        function draw(ctx, f, P) {
            var i = SHOTS.length - 1;
            while (i > 0 && STARTS[i] > f) i--;
            ground(ctx, f);
            drawers[i](ctx, P, f - STARTS[i]);
        }
        return {
            length: LENGTH,
            beats: SHOTS.map(function (c, i) {
                var b = { at: STARTS[i], label: c.name };
                if (E.ROUTE.indexOf(c.name) >= 0) b.stage = c.name;
                return b;
            }),
            stills: STARTS.map(function (s, i) { return s + Math.floor(SHOTS[i].len / 2); }),
            cues: {
                cuts: STARTS.slice(),
                blocks: SHOTS.reduce(function (out, c, i) {
                    return out.concat(c.pops.map(function (b) { return STARTS[i] + b; }));
                }, []).sort(function (a, b) { return a - b; }).filter(function (b, i, a) { return !i || b > a[i - 1]; }),
            },
            strings: S,
            draw: draw,
        };
    }

    var HULL_LEFT = { open: hullOpen, drop: hullDrop, stage: hullStage, close: hullClose };
    var TOUR_PROMO30 = timeline(HULL_LEFT);
    E.register('promo30', TOUR_PROMO30);
    // tour-ring.js builds its timeline from timeline(LEFT), the palette C, the
    // caption table S (add keys there) and the shared right-side helpers.
    var helpers = {
        t: t, eo: eo, bo: bo, txt: txt, measure: measure, group: group, panel: panel,
        sub: sub, pills: pills, status: status,
    };
    module.exports = {
        TOUR_PROMO30: TOUR_PROMO30, S: S, dots: dots, PILLS: PILLS,
        timeline: timeline, C: C, helpers: helpers,
    };
    if (typeof window !== 'undefined') root.tourPromo30 = module.exports;
})(typeof window !== 'undefined' ? window : globalThis, typeof module !== 'undefined' ? module : {});
